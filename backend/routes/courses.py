"""
Course feed, posts, likes, comments, activity, reminders, notifications
Extracted from server.py during modularization.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Form, UploadFile, File, BackgroundTasks, Request
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import re
import logging

from .core import (
    db, get_current_user, resolve_user_from_token, is_admin_user,
    require_role, require_admin, require_staff, require_section_access,
    is_demo_user, check_demo_user_block, require_not_demo, is_real_owner,
    is_system_user, check_system_user_block, is_protected_user,
    has_role, is_student, is_parent, is_staff,
    can_access_section, get_user_permissions,
    hash_password, verify_password, create_token,
    get_academic_filter,
    JWT_SECRET, JWT_ALGORITHM, now_iso, generate_id,
    ADMIN_ROLES, STAFF_ROLES, ROLE_HIERARCHY,
    ws_manager,
    invalidate_student_cache,
    invalidate_course_caches,
    ACADEMIC_STUDENT_FILTER, ACADEMIC_STUDENT_FILTER_WITH_PENDING,
)

import jwt
import cloudinary
import cloudinary.uploader

from services.register_sync import (
    sync_single_student_task, sync_to_register,
    COLUMN_FIELD_MAP, TASK_VALID_COLUMNS,
    get_valid_task_columns_for_school,
)
from .exams import get_drive_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# COURSE FEED API - Posts, Likes, Comments
# ══════════════════════════════════════════════════════════════════════════════

class CoursePostCreate(BaseModel):
    subject_id: str
    title: Optional[str] = None  # Required for task, material, forum
    content: str = ""
    post_type: Literal["announcement", "task", "material", "forum"] = "announcement"
    image_url: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    # Google Drive fields
    drive_file_id: Optional[str] = None
    storage_type: Optional[str] = None  # "google_drive" or "cloudinary"
    # Metadata for tasks: due_date, delivery_type, show_to_students, points
    metadata: Optional[dict] = None
    # Cloudinary data for proper file handling
    cloudinary_data: Optional[dict] = None
    # Register linkage for tasks
    register_column: Optional[str] = None  # "P1"|"P2"|"P3"|null (tasks only)
    # YouTube material fields
    tipo_material: Optional[str] = None  # "archivo" or "youtube"
    url: Optional[str] = None  # YouTube URL
    video_id: Optional[str] = None  # Extracted YouTube video ID

class CoursePostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    # Metadata for tasks: due_date, delivery_type, show_to_students, points
    metadata: Optional[dict] = None

class PostCommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None  # For reply to another comment

@router.get("/course/{subject_id}/posts")
async def get_course_posts(
    subject_id: str,
    post_type: Optional[str] = Query(None, description="Filter by type: announcement, task, material, forum"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user)
):
    """Get all posts for a course/subject — optimized batch queries"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    school_id = user["school_id"]
    user_id = user["id"]

    # Teacher/course feed: show all tasks regardless of whether their
    # due_date has passed. A background cron flips expired tasks from
    # "active" to "closed" (see close_expired_tasks_cron in exams.py),
    # so filtering strictly on status="active" here made vencidas tasks
    # — even those with submissions and grades — disappear from the
    # teacher's view. We only want to hide archived/deleted posts; the
    # student portal has its own due_date filter for "upcoming tasks".
    query_filter = {
        "subject_id": subject_id,
        "school_id": school_id,
        "status": {"$nin": ["archived", "deleted"]},
        "deleted_at": {"$exists": False}
    }

    if post_type and post_type in ["announcement", "task", "material", "forum"]:
        query_filter["$or"] = [
            {"post_type": post_type},
            {"type": post_type}
        ]

    # Projection: exclude heavy fields (submissions[]) from list view
    list_projection = {
        "_id": 0,
        "id": 1, "subject_id": 1, "section_id": 1, "school_id": 1, "title": 1, "content": 1,
        "post_type": 1, "type": 1, "status": 1, "author_id": 1,
        "created_at": 1, "updated_at": 1, "image_url": 1,
        "file_url": 1, "file_name": 1,
        "drive_file_id": 1, "drive_file_name": 1, "file_extension": 1,
        "file_type": 1, "file_size": 1, "storage_type": 1,
        "mime_type": 1, "due_date": 1, "metadata": 1,
        "cloudinary_data": 1,
        "tipo_material": 1, "url": 1, "video_id": 1,
        # Registro Auxiliar linkage — required by the Editar Tarea modal
        # and by the Entregas linkage banner to pre-select the saved
        # bimestre + column. Excluding these fields made the UI always
        # render "Sin vinculación" for tasks that actually were linked.
        "register_column": 1, "period_id": 1, "sync_status": 1,
    }

    # 1. Get posts + total count in parallel
    import asyncio
    posts_future = db.course_posts.find(
        query_filter, list_projection
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)

    total_future = db.course_posts.count_documents(query_filter)

    posts, total = await asyncio.gather(posts_future, total_future)

    if not posts:
        return {"posts": [], "total": total}

    # Extract unique IDs for batch queries
    post_ids = [p["id"] for p in posts if p.get("id")]
    author_ids = list(set(p.get("author_id") for p in posts if p.get("author_id")))

    # 2. Batch queries in parallel (5 queries instead of 200)
    authors_future = db.users.find(
        {"id": {"$in": author_ids}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
    ).to_list(len(author_ids))

    likes_agg_future = db.post_likes.aggregate([
        {"$match": {"post_id": {"$in": post_ids}}},
        {"$group": {"_id": "$post_id", "count": {"$sum": 1}}}
    ]).to_list(len(post_ids))

    comments_agg_future = db.post_comments.aggregate([
        {"$match": {"post_id": {"$in": post_ids}, "status": "active"}},
        {"$group": {"_id": "$post_id", "count": {"$sum": 1}}}
    ]).to_list(len(post_ids))

    user_likes_future = db.post_likes.find(
        {"post_id": {"$in": post_ids}, "user_id": user_id},
        {"_id": 0, "post_id": 1}
    ).to_list(len(post_ids))

    # For tasks: get submission counts via aggregation
    task_post_ids = [p["id"] for p in posts if p.get("post_type") == "task" or p.get("type") == "task"]

    # Gather all batch queries in parallel
    gather_futures = [authors_future, likes_agg_future, comments_agg_future, user_likes_future]
    if task_post_ids:
        # Submissions are stored as an embedded array inside each
        # `course_posts` document — this is the single source of truth
        # used by /course/tasks/{task_id}/submissions and the grading UI.
        # Counting from db.task_submissions (a separate collection) was
        # incorrect: that collection is not populated by the submit flow,
        # so the list view always showed 0 while the detail view showed
        # the real count. Aggregate directly on course_posts so both
        # views stay consistent. school_id is included for multi-tenant
        # isolation.
        #
        # We also expose the CURRENT user's submission (only their own)
        # so the student course view can show the correct badge
        # ("Pendiente" / "Entregada" / "Calificada") without loading
        # everyone's submissions. The full `submissions` array stays
        # excluded from the projection to keep the payload light.
        gather_futures.append(db.course_posts.aggregate([
            {"$match": {
                "id": {"$in": task_post_ids},
                "school_id": school_id,
            }},
            {"$project": {
                "_id": 0,
                "id": 1,
                "total": {"$size": {"$ifNull": ["$submissions", []]}},
                "graded": {
                    "$size": {
                        "$filter": {
                            "input": {"$ifNull": ["$submissions", []]},
                            "as": "s",
                            "cond": {"$ne": ["$$s.grade", None]},
                        }
                    }
                },
                "my_submission": {
                    "$first": {
                        "$filter": {
                            "input": {"$ifNull": ["$submissions", []]},
                            "as": "s",
                            "cond": {"$eq": ["$$s.student_id", user_id]},
                        }
                    }
                },
            }},
        ]).to_list(len(task_post_ids)))

    results = await asyncio.gather(*gather_futures)

    authors_list = results[0]
    likes_agg = results[1]
    comments_agg = results[2]
    user_likes_list = results[3]
    subs_agg = results[4] if task_post_ids else []

    # 3. Build lookup dictionaries (O(1) access)
    authors_map = {a["id"]: a for a in authors_list}
    likes_map = {item["_id"]: item["count"] for item in likes_agg}
    comments_map = {item["_id"]: item["count"] for item in comments_agg}
    user_liked_set = {item["post_id"] for item in user_likes_list}
    subs_map = {item["id"]: item for item in (subs_agg or [])}

    # 4. Enrich posts in memory — ZERO additional DB queries
    for post in posts:
        pid = post.get("id")
        post["author"] = authors_map.get(post.get("author_id"))
        post["likes_count"] = likes_map.get(pid, 0)
        post["user_liked"] = pid in user_liked_set
        post["comments_count"] = comments_map.get(pid, 0)

        if post.get("post_type") == "task" or post.get("type") == "task":
            sub_info = subs_map.get(pid, {})
            post["submissions_count"] = sub_info.get("total", 0)
            post["graded_count"] = sub_info.get("graded", 0)
            # Expose a one-element `submissions` array (only the current
            # user's submission) so the student course page can compute
            # its status badge using the existing frontend logic
            # (`task.submissions?.find(s => s.student_id === studentId)`).
            my_sub = sub_info.get("my_submission")
            post["submissions"] = [my_sub] if my_sub else []

    return {"posts": posts, "total": total}

@router.post("/course/{subject_id}/posts")
async def create_course_post(
    subject_id: str,
    data: CoursePostCreate,
    current_user = Depends(get_current_user)
):
    """Create a new post in a course"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Validate: must have content or attachment (file_url or drive_file_id) or YouTube link
    is_youtube = data.tipo_material == "youtube" and data.post_type in ("material", "task")
    if not is_youtube:
        if not data.content.strip() and not data.image_url and not data.file_url and not data.drive_file_id:
            raise HTTPException(status_code=400, detail="La publicación debe tener texto, imagen o archivo")
    else:
        if data.url and data.url.strip():
            # Extract video_id from YouTube URL
            import re
            yt_match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})', data.url)
            if not yt_match:
                raise HTTPException(status_code=400, detail="URL de YouTube no válida")
            data.video_id = yt_match.group(1)
    
    # For task, material, forum - title is required
    if data.post_type in ["task", "material", "forum"]:
        if not data.title or not data.title.strip():
            raise HTTPException(status_code=400, detail="El título es obligatorio para este tipo de publicación")
    
    # Verify subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Get active academic year
    active_year = await db.academic_years.find_one({"school_id": school_id, "status": "activo"})
    academic_year_id = active_year["id"] if active_year else None
    
    now = datetime.now(timezone.utc).isoformat()
    
    post = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "subject_id": subject_id,
        "academic_year_id": academic_year_id,
        "author_id": user["id"],
        "title": data.title.strip() if data.title else None,
        "content": data.content.strip(),
        "post_type": data.post_type,
        "image_url": data.image_url,
        "file_url": data.file_url,
        "file_name": data.file_name,
        "file_type": data.file_type,
        "file_size": data.file_size,
        "drive_file_id": data.drive_file_id,
        "storage_type": data.storage_type,
        "tipo_material": data.tipo_material or "archivo",
        "url": data.url,
        "video_id": data.video_id,
        "status": "active",
        "created_at": now,
        "updated_at": now
    }
    
    # Store Cloudinary metadata for proper file handling (download, etc.)
    if data.cloudinary_data:
        post["cloudinary_data"] = data.cloudinary_data
    
    # Store metadata for tasks (due_date, delivery_type, points, etc.)
    if data.metadata:
        post["metadata"] = data.metadata
        # Also store due_date at root level for easier querying.
        # IMPORTANT: normalise to UTC-Z so the close-expired cron can
        # compare documents with mixed timezone offsets via a simple
        # string comparison (all documents share the same "...Z" format).
        if data.post_type == "task" and data.metadata.get("due_date"):
            due_raw = data.metadata["due_date"]
            try:
                dt = datetime.fromisoformat(str(due_raw).replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                due_utc_iso = dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
                post["due_date"] = due_utc_iso
            except Exception:
                post["due_date"] = due_raw
        if data.post_type == "task" and data.metadata.get("points"):
            post["max_grade"] = data.metadata["points"]
    
    # Handle register linkage for tasks
    resolved_period_id = None
    if data.post_type == "task":
        # Auto-resolve active period
        active_period = await db.academic_periods.find_one(
            {"school_id": school_id, "activo": True},
            {"_id": 0, "id": 1}
        )
        resolved_period_id = active_period["id"] if active_period else None
        post["period_id"] = resolved_period_id

        register_column = data.register_column
        if register_column:
            # Tasks must land on a subcolumna (type "input") of the active
            # Registro Auxiliar template. Falls back to legacy P1/P2/P3
            # only if the school has no custom template.
            valid_task_cols = await get_valid_task_columns_for_school(db, school_id)
            if register_column not in valid_task_cols:
                logger.warning(
                    f"[task-register] school={school_id} rejected column={register_column!r} | "
                    f"valid={sorted(valid_task_cols)}"
                )
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Esta columna no existe o no está habilitada para tareas en la "
                        "plantilla activa del Registro Auxiliar."
                    ),
                )
            if not resolved_period_id:
                raise HTTPException(status_code=400, detail="No hay un periodo academico activo. Configure uno en Anos Academicos.")
            # Validate uniqueness via register_column_assignments
            conflict = await db.register_column_assignments.find_one({
                "school_id": school_id,
                "subject_id": subject_id,
                "period_id": resolved_period_id,
                "register_column": register_column,
            }, {"_id": 0})
            if conflict:
                ctype = conflict.get("source_type", "exam")
                ctitle = conflict.get("source_title", "")
                label = "examen" if ctype == "exam" else "tarea"
                raise HTTPException(
                    status_code=409,
                    detail=f"La columna {register_column} ya fue asignada al {label} '{ctitle}'. Actualice la pagina e intente de nuevo."
                )
            # Check manual grades
            field = COLUMN_FIELD_MAP.get(register_column)
            if field:
                manual_count = await db.student_grades.count_documents({
                    "school_id": school_id,
                    "subject_id": subject_id,
                    "period_id": resolved_period_id,
                    field: {"$ne": None},
                })
                if manual_count > 0:
                    raise HTTPException(
                        status_code=409,
                        detail=f"La columna {register_column} ya tiene notas registradas manualmente en el Registro Auxiliar."
                    )

        post["register_column"] = register_column
        post["section_id"] = subject.get("section_id") if subject else None
        post["sync_status"] = "not_linked" if not register_column else "pending"
    
    await db.course_posts.insert_one(post)

    # Insert register_column_assignments for tasks
    if data.post_type == "task" and data.register_column and resolved_period_id:
        try:
            await db.register_column_assignments.insert_one({
                "school_id": school_id,
                "subject_id": subject_id,
                "section_id": subject.get("section_id") if subject else None,
                "period_id": resolved_period_id,
                "register_column": data.register_column,
                "source_type": "task",
                "source_id": post["id"],
                "source_title": data.title.strip() if data.title else "",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            await db.course_posts.delete_one({"id": post["id"]})
            raise HTTPException(
                status_code=409,
                detail=f"La columna {data.register_column} ya fue asignada. Actualice la pagina e intente de nuevo."
            )
    
    # Register activity in the course stream
    activity_type_map = {
        "announcement": "announcement",
        "material": "material_uploaded",
        "task": "task_assigned",
        "forum": "post_created"
    }
    activity_type = activity_type_map.get(data.post_type, "post_created")
    
    activity_title_map = {
        "announcement": "publicó un aviso",
        "material": "subió nuevo material",
        "task": "asignó una tarea",
        "forum": "publicó en el foro"
    }
    activity_desc = activity_title_map.get(data.post_type, "publicó algo")
    
    await register_course_activity(
        school_id=user["school_id"],
        subject_id=data.subject_id,
        activity_type=activity_type,
        user_id=user["id"],
        user_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        user_photo=user.get("photo_url"),
        title=activity_desc,
        description=data.title or (data.content[:100] + "..." if len(data.content) > 100 else data.content),
        reference_id=post["id"],
        reference_type="post"
    )
    
    # Create notification for task, material, forum posts
    if data.post_type in ["task", "material", "forum"]:
        notification_titles = {
            "task": "Nueva tarea publicada",
            "material": "Nuevo material de estudio",
            "forum": "Nuevo tema en el foro"
        }
        notification_messages = {
            "task": f"Se ha asignado una nueva tarea: {data.title}",
            "material": f"Se ha subido nuevo material: {data.title}",
            "forum": f"Nuevo tema de discusión: {data.title}"
        }
        
        await create_notification_for_subject(
            school_id=school_id,
            subject_id=subject_id,
            title=notification_titles.get(data.post_type, "Nueva publicación"),
            message=notification_messages.get(data.post_type, data.title or ""),
            notification_type=data.post_type,
            reference_id=post["id"],
            author_id=user["id"],
            author_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip()
        )
    
    # Return post with author info
    post_copy = {k: v for k, v in post.items() if k != "_id"}
    post_copy["author"] = {
        "id": user["id"],
        "name": user.get("name", ""),
        "last_name": user.get("last_name", ""),
        "photo_url": user.get("photo_url"),
        "role": user.get("role", "")
    }
    post_copy["likes_count"] = 0
    post_copy["user_liked"] = False
    post_copy["comments_count"] = 0
    
    return {"message": "Publicación creada", "post": post_copy}

@router.put("/course/posts/{post_id}")
async def update_course_post(
    post_id: str,
    data: CoursePostUpdate,
    current_user = Depends(get_current_user)
):
    """Update a post (only author can update)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    post = await db.course_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    # Only author or admin can update
    if post["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta publicación")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    
    if data.content is not None:
        if not data.content.strip() and not post.get("image_url") and not post.get("file_url"):
            raise HTTPException(status_code=400, detail="La publicación debe tener contenido")
        update_data["content"] = data.content.strip()
    
    if data.image_url is not None:
        update_data["image_url"] = data.image_url
    
    if data.file_url is not None:
        update_data["file_url"] = data.file_url
        update_data["file_name"] = data.file_name
        update_data["file_type"] = data.file_type
    
    # Handle metadata for tasks
    if data.metadata is not None:
        update_data["metadata"] = data.metadata
        # Also update root-level due_date for backwards compatibility
        if data.metadata.get("due_date"):
            update_data["due_date"] = data.metadata.get("due_date")
    
    await db.course_posts.update_one({"id": post_id}, {"$set": update_data})
    
    # Fetch the updated post to return it
    updated_post = await db.course_posts.find_one({"id": post_id}, {"_id": 0})
    
    return {"message": "Publicación actualizada", "post": updated_post}

@router.delete("/course/posts/{post_id}")
async def delete_course_post(
    post_id: str,
    current_user = Depends(get_current_user)
):
    """
    Delete a post (soft delete). 
    For tasks: Only allows deletion if there are NO submissions.
    If task has submissions, returns error - user must archive instead.
    For materials stored in Google Drive: Also deletes the file from Drive.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    post = await db.course_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    # Only author or admin can delete
    if post["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta publicación")
    
    # For tasks: count submissions for the audit trail. We used to
    # block the delete when there were submissions and force the
    # teacher to archive instead, but product decision is now to let
    # the teacher delete the task outright (with a strong confirmation
    # modal on the frontend). The soft-delete below hides the task
    # from every student view via the `deleted_at` filter.
    submissions_count_for_audit = 0
    graded_count_for_audit = 0
    if post.get("post_type") == "task":
        submissions = post.get("submissions", []) or []
        submissions_count_for_audit = len(submissions)
        graded_count_for_audit = sum(1 for s in submissions if s.get("grade") is not None)
    
    # For materials stored in Google Drive: Delete from Drive
    if post.get("storage_type") == "google_drive" and post.get("drive_file_id"):
        try:
            school_id = user.get("school_id")
            if school_id:
                service = await get_drive_service(school_id)
                service.files().delete(fileId=post["drive_file_id"]).execute()
                logger.info(f"Deleted file from Google Drive: {post.get('drive_file_id')}")
        except Exception as e:
            # Log error but continue with soft delete
            logger.error(f"Error deleting file from Google Drive: {e}")

    # Clean register linkage for tasks
    if post.get("post_type") == "task" and post.get("register_column"):
        try:
            await sync_to_register(db, post_id, "task", "delete")
            await db.register_column_assignments.delete_one({"source_id": post_id})
        except Exception as e:
            logger.warning(f"Error cleaning task register linkage: {e}")
    
    # Soft delete - do NOT delete files from Cloudinary
    # Files are preserved for potential restoration
    soft_delete_fields = {
        "status": "deleted", 
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "deleted_by": user["id"],
    }
    # Clear register linkage fields on soft delete
    if post.get("register_column"):
        soft_delete_fields["register_column"] = None
        soft_delete_fields["sync_status"] = "not_linked"

    await db.course_posts.update_one(
        {"id": post_id},
        {"$set": soft_delete_fields}
    )
    
    # Create audit log
    audit_log = {
        "id": str(uuid.uuid4()),
        "task_id": post_id,
        "action": "delete",
        "performed_by": user["id"],
        "performed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "school_id": user.get("school_id"),
        "details": {
            "task_title": post.get("title"),
            "had_submissions": submissions_count_for_audit > 0,
            "submissions_count": submissions_count_for_audit,
            "graded_count": graded_count_for_audit,
        }
    }
    await db.task_audit_logs.insert_one(audit_log)
    
    return {"message": "Publicación eliminada"}

@router.get("/course/tasks/{task_id}/submission-stats")
async def get_task_submission_stats(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """Get submission statistics for a task before deletion/archiving"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Support both type fields
    task = await db.course_posts.find_one({
        "id": task_id, 
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    submissions = task.get("submissions", [])
    submissions_count = len(submissions)
    graded_count = sum(1 for s in submissions if s.get("grade") is not None)
    
    return {
        "task_id": task_id,
        "title": task.get("title"),
        "submissions_count": submissions_count,
        "graded_count": graded_count,
        "has_submissions": submissions_count > 0,
        "can_delete": submissions_count == 0
    }

@router.get("/course/tasks/{task_id}/submissions")
async def get_task_submissions(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get all submissions for a task with student details.
    Used by teachers/owners to view and grade student work.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Only admin/teacher can view submissions
    if not is_admin_user(user) and user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Solo profesores o administradores pueden ver las entregas")
    
    # Support both type fields
    task = await db.course_posts.find_one({
        "id": task_id,
        "school_id": school_id,
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    submissions = task.get("submissions", [])
    
    # Enrich submissions with student details
    enriched_submissions = []
    for sub in submissions:
        student_id = sub.get("student_id")
        student = await db.users.find_one(
            {"id": student_id},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "profile_pic": 1, "roll_number": 1}
        )
        
        # Determine submission status (on time or late)
        due_date = task.get("due_date") or task.get("metadata", {}).get("due_date")
        submitted_at = sub.get("submitted_at")
        status = "a_tiempo"  # Default to on time
        
        if due_date and submitted_at:
            try:
                if isinstance(due_date, str):
                    deadline = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                else:
                    deadline = due_date
                    
                if isinstance(submitted_at, str):
                    submit_time = datetime.fromisoformat(submitted_at.replace('Z', '+00:00'))
                else:
                    submit_time = submitted_at
                    
                if submit_time > deadline:
                    status = "tarde"
            except (ValueError, TypeError):
                pass
        
        enriched_submissions.append({
            "id": sub.get("id") or f"{student_id}_{sub.get('submitted_at', '')}",  # Generate fallback ID for old submissions
            "student_id": student_id,
            "student": {
                "id": student.get("id") if student else student_id,
                "name": f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else sub.get("student_name", "Estudiante desconocido"),
                "photo_url": student.get("photo_url") or student.get("profile_pic") if student else None,
                "roll_number": student.get("roll_number") if student else None
            },
            "text_content": sub.get("text_content"),
            "attachments": sub.get("attachments") or [],
            "file_url": sub.get("file_url"),
            "file_name": sub.get("file_name"),
            "file_type": sub.get("file_type"),
            "drive_file_id": sub.get("drive_file_id"),
            "storage_type": sub.get("storage_type"),
            "submitted_at": submitted_at,
            "status": status,
            "grade": sub.get("grade"),
            "feedback": sub.get("feedback")
        })
    
    # Sort by submitted_at (most recent first)
    enriched_submissions.sort(key=lambda x: x.get("submitted_at", ""), reverse=True)

    # Enrich with register linkage info (period + column) so the Entregas UI
    # can show the user which slot in the Registro Auxiliar will receive the
    # grades. Resolves the period name and a friendly label for the column.
    register_column = task.get("register_column")
    period_id = task.get("period_id")
    period_name = None
    if period_id:
        period_doc = await db.academic_periods.find_one(
            {"id": period_id, "school_id": school_id},
            {"_id": 0, "nombre": 1, "orden": 1, "activo": 1},
        )
        if period_doc:
            period_name = period_doc.get("nombre") or (f"Bimestre {period_doc.get('orden')}" if period_doc.get("orden") else None)
    register_column_label = None
    if register_column:
        # Try to resolve the column's human label from the active template.
        try:
            from services.register_sync import get_active_template_for_school
            tpl = await get_active_template_for_school(db, school_id)
            for cri in (tpl or {}).get("criterios", []) or []:
                for sub in cri.get("subcolumnas", []) or []:
                    key = sub.get("field_key") or sub.get("id")
                    if str(key) == str(register_column):
                        register_column_label = f"{cri.get('nombre','')} → {sub.get('label') or sub.get('id')}"
                        break
                if register_column_label:
                    break
        except Exception:
            pass
        if not register_column_label:
            register_column_label = register_column

    return {
        "task_id": task_id,
        "task_title": task.get("title"),
        "subject_id": task.get("subject_id"),
        "section_id": task.get("section_id"),
        "max_grade": task.get("max_grade") or task.get("metadata", {}).get("points", 20),
        "due_date": task.get("due_date") or task.get("metadata", {}).get("due_date"),
        "submissions_count": len(submissions),
        "graded_count": sum(1 for s in submissions if s.get("grade") is not None),
        "register_column": register_column,
        "register_column_label": register_column_label,
        "period_id": period_id,
        "period_name": period_name,
        "submissions": enriched_submissions
    }

class GradeSubmissionRequest(BaseModel):
    grade: Optional[float] = None
    feedback: Optional[str] = None

class TaskRegisterLinkageRequest(BaseModel):
    register_column: Optional[str] = None  # column id/field_key; null to unlink
    period_id: Optional[str] = None        # bimestre id (must exist in school)


@router.put("/course/tasks/{task_id}/register-linkage")
async def update_task_register_linkage(
    task_id: str,
    data: TaskRegisterLinkageRequest,
    current_user = Depends(get_current_user)
):
    """Update or set the (period_id, register_column) linkage of an existing task.

    Behavior:
      - Validates the column exists in the school's active Registro Auxiliar
        template (legacy P1/P2/P3 fallback is honoured).
      - Validates uniqueness via `register_column_assignments` so two
        exams/tasks don't collide on the same slot.
      - Validates the column is not already filled with manual grades in
        the chosen period.
      - Updates `course_posts.{period_id, register_column}` and rewrites
        the `register_column_assignments` row to point at this task.
      - Triggers a sync of all existing graded submissions to the new
        column so the Registro Auxiliar reflects the change immediately.
      - Passing `register_column=None` unlinks the task (removes the
        assignment doc; existing notes in the previous column are left
        untouched but new grades won't sync).
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    school_id = user["school_id"]
    if not is_admin_user(user) and user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Solo profesores o administradores pueden actualizar la vinculación")

    task = await db.course_posts.find_one(
        {"id": task_id, "school_id": school_id, "$or": [{"post_type": "task"}, {"type": "task"}]},
        {"_id": 0},
    )
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    subject_id = task.get("subject_id")
    section_id = task.get("section_id")
    new_period_id = data.period_id
    new_column = data.register_column

    # Resolve period (use active when caller didn't pass one)
    if new_period_id:
        period_doc = await db.academic_periods.find_one(
            {"id": new_period_id, "school_id": school_id},
            {"_id": 0, "id": 1, "nombre": 1, "orden": 1},
        )
        if not period_doc:
            raise HTTPException(status_code=400, detail="Bimestre no válido")
    else:
        period_doc = await db.academic_periods.find_one(
            {"school_id": school_id, "activo": True},
            {"_id": 0, "id": 1, "nombre": 1, "orden": 1},
        )
        if not period_doc:
            raise HTTPException(status_code=400, detail="No hay un periodo académico activo. Configure uno en Años Académicos.")
        new_period_id = period_doc["id"]

    # Validate column (only when linking; null = unlink)
    if new_column:
        valid_cols = await get_valid_task_columns_for_school(db, school_id)
        if new_column not in valid_cols:
            raise HTTPException(status_code=400, detail="Esta columna no existe o no está habilitada para tareas en la plantilla activa del Registro Auxiliar.")

        # Uniqueness — excluding this same task (idempotent re-saves allowed)
        conflict = await db.register_column_assignments.find_one({
            "school_id": school_id,
            "subject_id": subject_id,
            "period_id": new_period_id,
            "register_column": new_column,
            "source_id": {"$ne": task_id},
        }, {"_id": 0})
        if conflict:
            ctype = conflict.get("source_type", "exam")
            ctitle = conflict.get("source_title", "")
            label = "examen" if ctype == "exam" else "tarea"
            raise HTTPException(status_code=409, detail=f"La columna {new_column} ya fue asignada al {label} '{ctitle}'.")

        # Block when the target field already has manual grades in this period
        field = COLUMN_FIELD_MAP.get(new_column)
        if field:
            manual_count = await db.student_grades.count_documents({
                "school_id": school_id,
                "subject_id": subject_id,
                "period_id": new_period_id,
                field: {"$ne": None},
            })
            if manual_count > 0:
                # Tolerate the case where the grades came from this same task
                # (i.e. the user is just re-pointing the same column to itself).
                same_slot = (
                    task.get("register_column") == new_column
                    and task.get("period_id") == new_period_id
                )
                if not same_slot:
                    raise HTTPException(status_code=409, detail=f"La columna {new_column} ya tiene notas registradas manualmente en el Registro Auxiliar.")

    # Persist on the task
    await db.course_posts.update_one(
        {"id": task_id},
        {"$set": {
            "register_column": new_column,
            "period_id": new_period_id,
            "section_id": section_id,
            "sync_status": "pending" if new_column else "not_linked",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    # Rewrite assignment registry: remove old, add new (only if column set)
    await db.register_column_assignments.delete_many({"source_id": task_id})
    if new_column:
        try:
            await db.register_column_assignments.insert_one({
                "school_id": school_id,
                "subject_id": subject_id,
                "section_id": section_id,
                "period_id": new_period_id,
                "register_column": new_column,
                "source_type": "task",
                "source_id": task_id,
                "source_title": task.get("title", ""),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            # Race: someone else won the slot between validation and insert
            raise HTTPException(status_code=409, detail=f"La columna {new_column} ya fue asignada. Actualice la página e intente de nuevo.")

    # If this re-link moves the task from an OLD column to a different
    # one (and/or to a different period), clear the previous column so we
    # don't leave orphan grades behind. Matches the user's "sobrescribe"
    # contract: only one slot per task at any time.
    old_column = task.get("register_column")
    old_period_id = task.get("period_id")
    cleared = 0
    if old_column and (old_column != new_column or old_period_id != new_period_id):
        old_field = COLUMN_FIELD_MAP.get(old_column)
        # Only clear cells that came from this task's submissions. We do
        # this per-student to avoid wiping unrelated values that happened
        # to live in that column.
        for sub in task.get("submissions", []) or []:
            sid = sub.get("student_id")
            if not sid:
                continue
            try:
                if old_field:
                    # Static column → top-level field
                    await db.student_grades.update_many(
                        {
                            "school_id": school_id,
                            "subject_id": subject_id,
                            "section_id": section_id,
                            "student_id": sid,
                            "period_id": old_period_id,
                        },
                        {"$unset": {old_field: ""}}
                    )
                else:
                    # Dynamic column → grades_dynamic.<key>
                    await db.student_grades.update_many(
                        {
                            "school_id": school_id,
                            "subject_id": subject_id,
                            "section_id": section_id,
                            "student_id": sid,
                            "period_id": old_period_id,
                        },
                        {"$unset": {f"grades_dynamic.{old_column}": ""}}
                    )
                cleared += 1
            except Exception as e:
                logger.warning(f"[task-linkage] clear old column failed for student={sid}: {e}")

    # Re-sync existing graded submissions into the new column (best-effort).
    synced = 0
    if new_column:
        for sub in task.get("submissions", []) or []:
            if sub.get("grade") is None:
                continue
            student_id = sub.get("student_id")
            if not student_id:
                continue
            try:
                await sync_single_student_task(db, task_id, student_id, sub.get("grade"))
                synced += 1
            except Exception as e:
                logger.warning(f"[task-linkage] resync failed for student={student_id}: {e}")

    return {
        "message": "Vinculación al Registro Auxiliar actualizada",
        "task_id": task_id,
        "register_column": new_column,
        "period_id": new_period_id,
        "period_name": period_doc.get("nombre"),
        "resynced_submissions": synced,
        "cleared_old_column": cleared,
    }


@router.put("/course/tasks/{task_id}/submissions/{submission_id}/grade")
async def grade_task_submission(
    task_id: str,
    submission_id: str,
    data: GradeSubmissionRequest,
    current_user = Depends(get_current_user)
):
    """
    Grade a student's submission.
    Teachers/owners can set a grade and feedback for each submission.
    """
    logger.info(f"Grading submission: task_id={task_id}, submission_id={submission_id}, data={data}")
    
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    logger.info(f"User school_id: {school_id}, user_role: {user.get('role')}")
    
    # Only admin/teacher can grade
    if not is_admin_user(user) and user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Solo profesores o administradores pueden calificar")
    
    # Support both type fields
    task = await db.course_posts.find_one({
        "id": task_id,
        "school_id": school_id,
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    
    logger.info(f"Task found: {task is not None}")
    
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Find the submission
    submissions = task.get("submissions", [])
    logger.info(f"Number of submissions: {len(submissions)}")
    
    submission_idx = None
    for idx, sub in enumerate(submissions):
        logger.info(f"Checking submission {idx}: id={sub.get('id')}")
        if sub.get("id") == submission_id:
            submission_idx = idx
            break
    
    if submission_idx is None:
        # Try to find by fallback ID pattern (student_id_submitted_at) or by student_id
        for idx, sub in enumerate(submissions):
            fallback_id = f"{sub.get('student_id', '')}_{sub.get('submitted_at', '')}"
            if fallback_id == submission_id or sub.get("student_id") == submission_id:
                submission_idx = idx
                logger.info(f"Found submission by fallback ID at index {idx}")
                break
    
    if submission_idx is None:
        logger.error(f"Submission not found: {submission_id}")
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    
    # Validate grade against max_grade
    max_grade = task.get("max_grade") or task.get("metadata", {}).get("points") or 20
    if max_grade <= 0:
        max_grade = 20  # Default if no valid max_grade
    
    logger.info(f"Max grade: {max_grade}, Data grade: {data.grade}")
    
    if data.grade is not None:
        if data.grade < 0:
            raise HTTPException(status_code=400, detail="La nota no puede ser negativa")
        if data.grade > max_grade:
            raise HTTPException(status_code=400, detail=f"La nota no puede ser mayor a {max_grade}")
    
    # Build update. Treat an explicit `null` as "clear the field" so a teacher
    # can DELETE a wrongly-entered grade/feedback (previously null was ignored
    # and the old value persisted). The frontend always sends the effective
    # value of both fields, so null here genuinely means "cleared".
    set_fields = {
        f"submissions.{submission_idx}.graded_at": datetime.now(timezone.utc).isoformat(),
        f"submissions.{submission_idx}.graded_by": user["id"]
    }
    unset_fields = {}

    if data.grade is not None:
        set_fields[f"submissions.{submission_idx}.grade"] = data.grade
    else:
        unset_fields[f"submissions.{submission_idx}.grade"] = ""

    if data.feedback is not None:
        set_fields[f"submissions.{submission_idx}.feedback"] = data.feedback.strip()
    else:
        unset_fields[f"submissions.{submission_idx}.feedback"] = ""

    update_doc = {"$set": set_fields}
    if unset_fields:
        update_doc["$unset"] = unset_fields

    logger.info(f"Updating task {task_id} with: {update_doc}")
    
    # Update the submission
    try:
        result = await db.course_posts.update_one(
            {"id": task_id},
            update_doc
        )
        logger.info(f"Update result: matched={result.matched_count}, modified={result.modified_count}")
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")
    
    # Trigger sync to Registro Auxiliar if task is linked. Runs even when the
    # grade was CLEARED (data.grade is None) so the register cell is emptied too.
    if task.get("register_column"):
        sub = submissions[submission_idx] if submission_idx < len(submissions) else {}
        student_id = sub.get("student_id")
        if student_id:
            try:
                await sync_single_student_task(db, task_id, student_id, data.grade)
            except Exception as sync_err:
                logger.warning(f"[SYNC] Task grade sync failed: {sync_err}")

    return {
        "message": "Calificación guardada exitosamente",
        "grade": data.grade,
        "feedback": data.feedback
    }

    # Note: The sync is triggered AFTER response below via background logic

@router.post("/course/tasks/{task_id}/archive")
async def archive_task(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """
    Archive a task. Used when task has submissions and cannot be deleted.
    Preserves all data: submissions, grades, files.
    Task becomes invisible in main view but data remains for reports.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Support both type fields
    task = await db.course_posts.find_one({
        "id": task_id, 
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Only author or admin can archive
    if task["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para archivar esta tarea")
    
    if task.get("status") == "archived":
        raise HTTPException(status_code=400, detail="Esta tarea ya está archivada")
    
    submissions = task.get("submissions", [])
    submissions_count = len(submissions)
    graded_count = sum(1 for s in submissions if s.get("grade") is not None)
    
    # Archive the task
    await db.course_posts.update_one(
        {"id": task_id},
        {"$set": {
            "status": "archived",
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "archived_by": user["id"]
        }}
    )
    
    # Create audit log
    audit_log = {
        "id": str(uuid.uuid4()),
        "task_id": task_id,
        "action": "archive",
        "performed_by": user["id"],
        "performed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "school_id": user.get("school_id"),
        "details": {
            "task_title": task.get("title"),
            "submissions_count": submissions_count,
            "graded_count": graded_count
        }
    }
    await db.task_audit_logs.insert_one(audit_log)
    
    return {
        "message": "Tarea archivada correctamente",
        "task_id": task_id,
        "archived_at": audit_log["timestamp"]
    }

@router.post("/course/tasks/{task_id}/restore")
async def restore_task(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """Restore an archived task back to active status"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    task = await db.course_posts.find_one({"id": task_id, "post_type": "task"}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Only author or admin can restore
    if task["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para restaurar esta tarea")
    
    if task.get("status") == "active":
        raise HTTPException(status_code=400, detail="Esta tarea ya está activa")
    
    # Restore the task
    await db.course_posts.update_one(
        {"id": task_id},
        {
            "$set": {
                "status": "active",
                "restored_at": datetime.now(timezone.utc).isoformat(),
                "restored_by": user["id"]
            },
            "$unset": {
                "archived_at": "",
                "archived_by": "",
                "deleted_at": "",
                "deleted_by": ""
            }
        }
    )
    
    # Create audit log
    audit_log = {
        "id": str(uuid.uuid4()),
        "task_id": task_id,
        "action": "restore",
        "performed_by": user["id"],
        "performed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "school_id": user.get("school_id"),
        "details": {
            "task_title": task.get("title"),
            "previous_status": task.get("status")
        }
    }
    await db.task_audit_logs.insert_one(audit_log)
    
    return {
        "message": "Tarea restaurada correctamente",
        "task_id": task_id
    }

@router.get("/course/{subject_id}/tasks/archived")
async def get_archived_tasks(
    subject_id: str,
    current_user = Depends(get_current_user)
):
    """Get all archived tasks for a subject"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get archived tasks
    tasks = await db.course_posts.find(
        {
            "subject_id": subject_id,
            "post_type": "task",
            "status": "archived"
        },
        {"_id": 0}
    ).sort("archived_at", -1).to_list(100)
    
    # Enrich with submission counts
    for task in tasks:
        submissions = task.get("submissions", [])
        task["submissions_count"] = len(submissions)
        task["graded_count"] = sum(1 for s in submissions if s.get("grade") is not None)
        
        # Get archiver info
        if task.get("archived_by"):
            archiver = await db.users.find_one(
                {"id": task["archived_by"]},
                {"_id": 0, "name": 1, "last_name": 1}
            )
            if archiver:
                task["archived_by_name"] = f"{archiver.get('name', '')} {archiver.get('last_name', '')}".strip()
    
    return {"tasks": tasks, "total": len(tasks)}

# ═══════════════════════════════════════════════════════════════════
# LIKES
# ═══════════════════════════════════════════════════════════════════

@router.post("/course/posts/{post_id}/like")
async def toggle_post_like(
    post_id: str,
    current_user = Depends(get_current_user)
):
    """Toggle like on a post (like/unlike)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    
    # Check if post exists
    post = await db.course_posts.find_one({"id": post_id, "status": "active"})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    # Check if user already liked
    existing_like = await db.post_likes.find_one({"post_id": post_id, "user_id": user_id})
    
    if existing_like:
        # Unlike
        await db.post_likes.delete_one({"post_id": post_id, "user_id": user_id})
        liked = False
    else:
        # Like
        like = {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.post_likes.insert_one(like)
        liked = True
    
    # Get new likes count
    likes_count = await db.post_likes.count_documents({"post_id": post_id})
    
    return {"liked": liked, "likes_count": likes_count}

# ═══════════════════════════════════════════════════════════════════
# COMMENTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/course/posts/{post_id}/comments")
async def get_post_comments(
    post_id: str,
    current_user = Depends(get_current_user)
):
    """Get all comments for a post, organized with replies"""
    # Check if post exists
    post = await db.course_posts.find_one({"id": post_id, "status": "active"})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    comments = await db.post_comments.find(
        {"post_id": post_id, "status": "active"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    
    # Enrich with author info
    for comment in comments:
        author = await db.users.find_one(
            {"id": comment.get("author_id")},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
        )
        comment["author"] = author
    
    # Organize comments: top-level and their replies
    top_level_comments = []
    replies_map = {}
    
    for comment in comments:
        parent_id = comment.get("parent_id")
        if parent_id:
            if parent_id not in replies_map:
                replies_map[parent_id] = []
            replies_map[parent_id].append(comment)
        else:
            top_level_comments.append(comment)
    
    # Attach replies to their parent comments
    for comment in top_level_comments:
        comment["replies"] = replies_map.get(comment["id"], [])
    
    return top_level_comments

@router.post("/course/posts/{post_id}/comments")
async def create_post_comment(
    post_id: str,
    data: PostCommentCreate,
    current_user = Depends(get_current_user)
):
    """Add a comment to a post"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío")
    
    # Check if post exists
    post = await db.course_posts.find_one({"id": post_id, "status": "active"})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    now = datetime.now(timezone.utc).isoformat()
    
    comment = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "author_id": user["id"],
        "parent_id": data.parent_id,  # None for top-level comments, ID for replies
        "content": data.content.strip(),
        "status": "active",
        "created_at": now
    }
    
    await db.post_comments.insert_one(comment)
    
    # Register activity in the course stream
    await register_course_activity(
        school_id=user["school_id"],
        subject_id=post.get("subject_id"),
        activity_type="comment_added",
        user_id=user["id"],
        user_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        user_photo=user.get("photo_url"),
        title="comentó en una publicación",
        description=data.content[:80] + "..." if len(data.content) > 80 else data.content,
        reference_id=post_id,
        reference_type="post"
    )
    
    # Return comment with author info
    comment_copy = {k: v for k, v in comment.items() if k != "_id"}
    comment_copy["author"] = {
        "id": user["id"],
        "name": user.get("name", ""),
        "last_name": user.get("last_name", ""),
        "photo_url": user.get("photo_url"),
        "role": user.get("role", "")
    }
    
    return {"message": "Comentario agregado", "comment": comment_copy}

@router.delete("/course/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a comment"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    comment = await db.post_comments.find_one({"id": comment_id}, {"_id": 0})
    if not comment:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    
    # Only author or admin can delete
    if comment["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar este comentario")
    
    await db.post_comments.update_one(
        {"id": comment_id},
        {"$set": {"status": "deleted", "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Comentario eliminado"}


# ══════════════════════════════════════════════════════════════════════════════
# COURSE ACTIVITY STREAM - Real-time activity feed (Google Classroom Style)
# ══════════════════════════════════════════════════════════════════════════════

class CourseActivityType(str, Enum):
    post_created = "post_created"           # Profesor publica algo
    material_uploaded = "material_uploaded" # Se sube material
    task_assigned = "task_assigned"         # Se asigna tarea
    task_submitted = "task_submitted"       # Alumno entrega tarea
    comment_added = "comment_added"         # Alguien comenta
    reminder_created = "reminder_created"   # Se crea recordatorio
    announcement = "announcement"           # Aviso publicado
    exam_scheduled = "exam_scheduled"       # Examen programado

# Helper function to register course activity
async def register_course_activity(
    school_id: str,
    subject_id: str,
    activity_type: str,
    user_id: str,
    user_name: str,
    user_photo: str = None,
    title: str = None,
    description: str = None,
    reference_id: str = None,
    reference_type: str = None
):
    """Register a new activity in the course activity stream"""
    activity_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    activity = {
        "id": activity_id,
        "school_id": school_id,
        "subject_id": subject_id,
        "activity_type": activity_type,
        "user_id": user_id,
        "user_name": user_name,
        "user_photo": user_photo,
        "title": title,
        "description": description,
        "reference_id": reference_id,
        "reference_type": reference_type,
        "created_at": now
    }
    
    await db.course_activities.insert_one(activity)
    return activity_id


@router.get("/course/{subject_id}/activities")
async def get_course_activities(
    subject_id: str,
    limit: int = 20,
    offset: int = 0,
    current_user = Depends(get_current_user)
):
    """Get activity stream for a course"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Verify subject exists
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Get activities for this course, ordered by most recent
    activities = await db.course_activities.find(
        {"subject_id": subject_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Get total count
    total = await db.course_activities.count_documents({"subject_id": subject_id})
    
    return {
        "activities": activities,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/course/{subject_id}/sidebar-summary")
async def get_course_sidebar_summary(
    subject_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get sidebar summary — fully parallelized.
    Phase 2 optimization: 11 sequential queries → 2 parallel batches.
    """
    import asyncio
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0, "id": 1})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")

    now = datetime.now(timezone.utc)
    now_iso_date = now.isoformat()[:10]
    week_ago = (now - timedelta(days=7)).isoformat()
    week_ahead = (now + timedelta(days=14)).isoformat()[:10]
    month_ago = (now - timedelta(days=30)).isoformat()

    # ══════════════════════════════════════════════════════════════════════
    # BATCH 1: News queries + all count queries in ONE asyncio.gather()
    # ══════════════════════════════════════════════════════════════════════
    base_filter = {"subject_id": subject_id, "status": "active"}

    (
        upcoming_reminders,
        recent_announcements,
        upcoming_tasks,
        materials_count,
        pending_tasks_post_count,
        pending_task_reminders_count,
        videos_count,
        forum_count,
        announcements_count,
        total_posts,
        total_reminders,
    ) = await asyncio.gather(
        # News: reminders
        db.course_reminders.find(
            {"subject_id": subject_id, "status": "active",
             "date": {"$gte": now_iso_date, "$lte": week_ahead}},
            {"_id": 0, "id": 1, "title": 1, "date": 1, "reminder_type": 1, "is_important": 1}
        ).sort("date", 1).limit(5).to_list(5),
        # News: announcements
        db.course_posts.find(
            {"subject_id": subject_id, "post_type": "announcement", "status": "active",
             "created_at": {"$gte": week_ago}},
            {"_id": 0, "id": 1, "title": 1, "content": 1, "created_at": 1}
        ).sort("created_at", -1).limit(3).to_list(3),
        # News: tasks
        db.course_posts.find(
            {"subject_id": subject_id, "post_type": "task", "status": "active",
             "created_at": {"$gte": week_ago}},
            {"_id": 0, "id": 1, "title": 1, "content": 1, "created_at": 1}
        ).sort("created_at", -1).limit(3).to_list(3),
        # Counts: materials
        db.course_posts.count_documents({**base_filter, "post_type": "material"}),
        # Counts: pending tasks (last 30d)
        db.course_posts.count_documents({**base_filter, "post_type": "task", "created_at": {"$gte": month_ago}}),
        # Counts: pending task reminders
        db.course_reminders.count_documents({
            "subject_id": subject_id, "reminder_type": "task",
            "status": "active", "date": {"$gte": now_iso_date}
        }),
        # Counts: videos — indexed file_type only, NO regex on content
        db.course_posts.count_documents({**base_filter, "file_type": {"$regex": "^video", "$options": "i"}}),
        # Counts: forum
        db.course_posts.count_documents({**base_filter, "post_type": "forum"}),
        # Counts: announcements
        db.course_posts.count_documents({**base_filter, "post_type": "announcement"}),
        # Stats: total posts
        db.course_posts.count_documents(base_filter),
        # Stats: total reminders
        db.course_reminders.count_documents({"subject_id": subject_id, "status": "active"}),
    )

    # ══════════════════════════════════════════════════════════════════════
    # Build news items in memory
    # ══════════════════════════════════════════════════════════════════════
    news_items = []
    reminder_type_labels = {
        "exam": "Examen programado",
        "task": "Tarea pendiente",
        "notice": "Aviso"
    }
    for r in upcoming_reminders:
        news_items.append({
            "id": r["id"], "type": "reminder", "subtype": r["reminder_type"],
            "title": r["title"], "date": r["date"], "icon": r["reminder_type"],
            "is_important": r.get("is_important", False),
            "label": reminder_type_labels.get(r["reminder_type"], "Recordatorio")
        })

    for p in recent_announcements:
        title = p.get("title") or (p["content"][:60] + "..." if len(p.get("content", "")) > 60 else p.get("content", ""))
        news_items.append({
            "id": p["id"], "type": "announcement", "subtype": "announcement",
            "title": title, "date": p["created_at"][:10],
            "icon": "announcement", "is_important": False, "label": "Aviso publicado"
        })

    for t in upcoming_tasks:
        title = t.get("title") or (t["content"][:60] + "..." if len(t.get("content", "")) > 60 else t.get("content", ""))
        news_items.append({
            "id": t["id"], "type": "task", "subtype": "task",
            "title": title, "date": t["created_at"][:10],
            "icon": "task", "is_important": False, "label": "Nueva tarea"
        })

    news_items.sort(key=lambda x: (not x.get("is_important", False), x.get("date", "")))
    news_items = news_items[:5]

    pending_tasks_count = pending_tasks_post_count + pending_task_reminders_count

    return {
        "news": news_items,
        "quick_access": [
            {"id": "materials", "label": "Materiales", "count": materials_count,
             "icon": "folder", "color": "blue", "filter": "material"},
            {"id": "tasks", "label": "Tareas pendientes", "count": pending_tasks_count,
             "icon": "task", "color": "amber", "filter": "task"},
            {"id": "videos", "label": "Clases grabadas", "count": videos_count,
             "icon": "video", "color": "rose", "filter": "video"},
            {"id": "forum", "label": "Foro del curso", "count": forum_count,
             "icon": "forum", "color": "violet", "filter": "forum"},
        ],
        "stats": {
            "total_posts": total_posts,
            "total_reminders": total_reminders,
            "materials_count": materials_count,
            "announcements_count": announcements_count
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# COURSE REMINDERS - Premium Feature (Google Classroom Style)
# ══════════════════════════════════════════════════════════════════════════════

class CourseReminderCreate(BaseModel):
    subject_id: str
    title: str
    description: Optional[str] = None
    date: str  # ISO date string
    reminder_type: Literal["task", "exam", "notice"] = "notice"
    is_important: bool = False  # Mark as important for notifications
    notify_all: bool = False  # Notify all students

class CourseReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    reminder_type: Optional[Literal["task", "exam", "notice"]] = None
    status: Optional[Literal["active", "completed", "cancelled"]] = None
    is_important: Optional[bool] = None
    notify_all: Optional[bool] = None


@router.get("/course/{subject_id}/reminders")
async def get_course_reminders(
    subject_id: str,
    status: Optional[str] = Query(None, description="Filter by status: active, completed, cancelled"),
    current_user = Depends(get_current_user)
):
    """Get all reminders for a course/subject"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Build query filter
    query_filter = {
        "school_id": user["school_id"],
        "subject_id": subject_id
    }
    
    if status:
        query_filter["status"] = status
    else:
        # By default, exclude cancelled
        query_filter["status"] = {"$ne": "cancelled"}
    
    # Get reminders sorted by date
    reminders = await db.course_reminders.find(
        query_filter,
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Add creator info
    for reminder in reminders:
        if reminder.get("created_by"):
            creator = await db.users.find_one(
                {"id": reminder["created_by"]},
                {"_id": 0, "id": 1, "name": 1, "profile_image": 1}
            )
            reminder["creator"] = creator
    
    return reminders


@router.post("/course/{subject_id}/reminders")
async def create_course_reminder(
    subject_id: str,
    data: CourseReminderCreate,
    current_user = Depends(get_current_user)
):
    """Create a new reminder for a course (teachers/admins only)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Only teachers, admins, directors and owners can create reminders
    if user.get("role") not in ["teacher", "admin", "owner", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para crear recordatorios")
    
    # Verify subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": user["school_id"]}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Get current academic year
    current_year = await db.academic_years.find_one({
        "school_id": user["school_id"],
        "estado": "activo"
    }, {"_id": 0})
    
    reminder_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    reminder = {
        "id": reminder_id,
        "school_id": user["school_id"],
        "subject_id": subject_id,
        "academic_year_id": current_year["id"] if current_year else None,
        "title": data.title.strip(),
        "description": data.description.strip() if data.description else None,
        "date": data.date,
        "reminder_type": data.reminder_type,
        "is_important": data.is_important,
        "notify_all": data.notify_all,
        "viewed_by": [],  # Track which users have seen this reminder
        "status": "active",
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.course_reminders.insert_one(reminder)
    
    # Register activity in the course stream
    reminder_type_labels = {
        "task": "programó una tarea",
        "exam": "programó un examen",
        "notice": "creó un recordatorio"
    }
    activity_title = reminder_type_labels.get(data.reminder_type, "creó un recordatorio")
    
    await register_course_activity(
        school_id=user["school_id"],
        subject_id=subject_id,
        activity_type="reminder_created" if data.reminder_type == "notice" else ("exam_scheduled" if data.reminder_type == "exam" else "task_assigned"),
        user_id=user["id"],
        user_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        user_photo=user.get("photo_url"),
        title=activity_title,
        description=data.title,
        reference_id=reminder_id,
        reference_type="reminder"
    )
    
    # Add creator info for response
    reminder["creator"] = {
        "id": user["id"],
        "name": user.get("name"),
        "profile_image": user.get("profile_image")
    }
    
    # Remove MongoDB _id
    reminder.pop("_id", None)
    
    return reminder


@router.put("/course/reminders/{reminder_id}")
async def update_course_reminder(
    reminder_id: str,
    data: CourseReminderUpdate,
    current_user = Depends(get_current_user)
):
    """Update a course reminder"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    reminder = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    # Only creator, admins, or owners can update
    if reminder["created_by"] != user["id"] and user.get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar este recordatorio")
    
    # Build update data
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.description is not None:
        update_data["description"] = data.description.strip() if data.description else None
    if data.date is not None:
        update_data["date"] = data.date
    if data.reminder_type is not None:
        update_data["reminder_type"] = data.reminder_type
    if data.status is not None:
        update_data["status"] = data.status
    if data.is_important is not None:
        update_data["is_important"] = data.is_important
    if data.notify_all is not None:
        update_data["notify_all"] = data.notify_all
    
    await db.course_reminders.update_one({"id": reminder_id}, {"$set": update_data})
    
    # Return updated reminder
    updated = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    return updated


@router.delete("/course/reminders/{reminder_id}")
async def delete_course_reminder(
    reminder_id: str,
    current_user = Depends(get_current_user)
):
    """Delete (cancel) a course reminder"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    reminder = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    # Only creator, admins, or owners can delete
    if reminder["created_by"] != user["id"] and user.get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar este recordatorio")
    
    # Soft delete by setting status to cancelled
    await db.course_reminders.update_one(
        {"id": reminder_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": user["id"]
        }}
    )
    
    return {"message": "Recordatorio eliminado"}


@router.post("/course/reminders/{reminder_id}/complete")
async def complete_course_reminder(
    reminder_id: str,
    current_user = Depends(get_current_user)
):
    """Mark a reminder as completed"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    reminder = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    # Only creator, admins, or owners can complete
    if reminder["created_by"] != user["id"] and user.get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para completar este recordatorio")
    
    await db.course_reminders.update_one(
        {"id": reminder_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "completed_by": user["id"]
        }}
    )
    
    return {"message": "Recordatorio marcado como completado"}


@router.post("/course/reminders/{reminder_id}/mark-viewed")
async def mark_reminder_viewed(
    reminder_id: str,
    current_user = Depends(get_current_user)
):
    """Mark a reminder as viewed by the current user"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    reminder = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    # Add user to viewed_by array if not already there
    await db.course_reminders.update_one(
        {"id": reminder_id},
        {"$addToSet": {"viewed_by": user["id"]}}
    )
    
    return {"message": "Recordatorio marcado como visto"}


@router.get("/notifications/reminders")
async def get_notification_reminders(
    current_user = Depends(get_current_user)
):
    """
    Get reminders for notification bell across ALL courses the user has access to.
    Returns:
    - Important reminders
    - Upcoming reminders (within 48 hours)
    - New (unviewed) reminders
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    
    # Calculate 48 hours from now
    upcoming_threshold = (now + timedelta(hours=48)).isoformat()
    now_iso_str = now.isoformat()
    
    # Get all subjects the user has access to
    if user.get("role") in ["admin", "owner", "director", "coordinator"]:
        # Admin roles see all subjects in their school
        subjects = await db.subjects.find(
            {"school_id": school_id},
            {"_id": 0, "id": 1, "name": 1, "color": 1}
        ).to_list(500)
    elif user.get("role") == "teacher":
        # Teachers see their assigned subjects
        subjects = await db.subjects.find(
            {"school_id": school_id, "teacher_id": user_id},
            {"_id": 0, "id": 1, "name": 1, "color": 1}
        ).to_list(100)
    else:
        # Students/Parents - get subjects from their enrollments
        enrollments = await db.enrollments.find(
            {"school_id": school_id, "user_id": user_id, "status": "active"},
            {"_id": 0, "subject_ids": 1}
        ).to_list(100)
        
        subject_ids = []
        for enrollment in enrollments:
            subject_ids.extend(enrollment.get("subject_ids", []))
        
        # Also get from grade enrollment if exists
        if user.get("grade_id"):
            grade = await db.grades.find_one({"id": user["grade_id"]}, {"_id": 0})
            if grade and grade.get("subjects"):
                subject_ids.extend([s.get("subject_id") for s in grade["subjects"] if s.get("subject_id")])
        
        subject_ids = list(set(subject_ids))
        
        subjects = await db.subjects.find(
            {"school_id": school_id, "id": {"$in": subject_ids}},
            {"_id": 0, "id": 1, "name": 1, "color": 1}
        ).to_list(100)
    
    subject_ids = [s["id"] for s in subjects]
    subject_map = {s["id"]: s for s in subjects}
    
    if not subject_ids:
        return {
            "important": [],
            "upcoming": [],
            "new": [],
            "total_count": 0
        }
    
    # Get all active reminders for these subjects
    all_reminders = await db.course_reminders.find(
        {
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "status": "active"
        },
        {"_id": 0}
    ).sort("date", 1).to_list(500)
    
    important_reminders = []
    upcoming_reminders = []
    new_reminders = []
    
    for reminder in all_reminders:
        reminder_date = reminder.get("date", "")
        is_important = reminder.get("is_important", False)
        viewed_by = reminder.get("viewed_by", [])
        is_viewed = user_id in viewed_by
        
        # Add subject info
        subject_info = subject_map.get(reminder["subject_id"], {})
        reminder["subject_name"] = subject_info.get("name", "")
        reminder["subject_color"] = subject_info.get("color", "#6366f1")
        reminder["is_viewed"] = is_viewed
        
        # Categorize reminders
        # Important reminders (not viewed)
        if is_important and not is_viewed:
            important_reminders.append(reminder)
        # Upcoming within 48h (not viewed or important)
        elif reminder_date and reminder_date <= upcoming_threshold and reminder_date >= now_iso_str[:10]:
            if not is_viewed:
                upcoming_reminders.append(reminder)
        # New (not viewed, not in other categories)
        elif not is_viewed:
            new_reminders.append(reminder)
    
    # Limit results
    important_reminders = important_reminders[:10]
    upcoming_reminders = upcoming_reminders[:10]
    new_reminders = new_reminders[:10]
    
    total_count = len(important_reminders) + len(upcoming_reminders) + len(new_reminders)
    
    return {
        "important": important_reminders,
        "upcoming": upcoming_reminders,
        "new": new_reminders,
        "total_count": total_count
    }


@router.get("/notifications/reminders/popup")
async def get_popup_reminders(
    current_user = Depends(get_current_user)
):
    """
    Get reminders that should trigger a popup notification.
    Rules:
    - Important reminders not viewed today
    - Reminders due within 24 hours not viewed
    - Overdue reminders not viewed
    Returns max 1 reminder to show as popup
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    now_date = now.date().isoformat()
    
    # Calculate 24 hours from now
    upcoming_24h = (now + timedelta(hours=24)).isoformat()
    
    # Get user's popup history from user document or separate collection
    popup_history = user.get("reminder_popup_history", {})
    
    # Get all subjects the user has access to (same logic as above)
    if user.get("role") in ["admin", "owner", "director", "coordinator"]:
        subjects = await db.subjects.find(
            {"school_id": school_id},
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(500)
    elif user.get("role") == "teacher":
        subjects = await db.subjects.find(
            {"school_id": school_id, "teacher_id": user_id},
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(100)
    else:
        enrollments = await db.enrollments.find(
            {"school_id": school_id, "user_id": user_id, "status": "active"},
            {"_id": 0, "subject_ids": 1}
        ).to_list(100)
        
        subject_ids = []
        for enrollment in enrollments:
            subject_ids.extend(enrollment.get("subject_ids", []))
        
        if user.get("grade_id"):
            grade = await db.grades.find_one({"id": user["grade_id"]}, {"_id": 0})
            if grade and grade.get("subjects"):
                subject_ids.extend([s.get("subject_id") for s in grade["subjects"] if s.get("subject_id")])
        
        subject_ids = list(set(subject_ids))
        subjects = await db.subjects.find(
            {"school_id": school_id, "id": {"$in": subject_ids}},
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(100)
    
    subject_ids = [s["id"] for s in subjects]
    subject_map = {s["id"]: s for s in subjects}
    
    if not subject_ids:
        return {"reminder": None}
    
    # Get active reminders that qualify for popup
    reminders = await db.course_reminders.find(
        {
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "status": "active",
            "$or": [
                {"is_important": True},
                {"date": {"$lte": upcoming_24h}}  # Due within 24h or overdue
            ]
        },
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Find the first reminder that:
    # 1. User hasn't viewed
    # 2. Wasn't shown as popup today
    for reminder in reminders:
        reminder_id = reminder["id"]
        viewed_by = reminder.get("viewed_by", [])
        
        # Skip if already viewed
        if user_id in viewed_by:
            continue
        
        # Skip if popup was shown today
        last_popup_date = popup_history.get(reminder_id)
        if last_popup_date == now_date:
            continue
        
        # This reminder should be shown as popup
        subject_info = subject_map.get(reminder["subject_id"], {})
        reminder["subject_name"] = subject_info.get("name", "")
        
        return {"reminder": reminder}
    
    return {"reminder": None}


@router.post("/notifications/reminders/{reminder_id}/dismiss-popup")
async def dismiss_popup_reminder(
    reminder_id: str,
    current_user = Depends(get_current_user)
):
    """Record that user dismissed a popup for a reminder (once per day limit)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    now_date = datetime.now(timezone.utc).date().isoformat()
    
    # Update user's popup history
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {f"reminder_popup_history.{reminder_id}": now_date}}
    )
    
    return {"message": "Popup dismissal recorded"}


# ══════════════════════════════════════════════════════════════════════════════

# GENERAL NOTIFICATIONS SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

class NotificationType(str, Enum):
    task = "task"
    exam = "exam"
    material = "material"
    forum = "forum"
    reminder = "reminder"
    announcement = "announcement"

class NotificationCreate(BaseModel):
    title: str
    message: str
    notification_type: NotificationType
    subject_id: Optional[str] = None
    reference_id: Optional[str] = None  # ID of the task/exam/material/forum post
    reference_url: Optional[str] = None

async def create_notification_for_subject(
    school_id: str,
    subject_id: str,
    title: str,
    message: str,
    notification_type: str,
    reference_id: str = None,
    author_id: str = None,
    author_name: str = None,
    link_destino: str = None
):
    """Helper function to create a notification for a subject"""
    # Get subject info
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0, "name": 1, "grade_id": 1})
    
    # Auto-generate link_destino based on notification type if not provided
    if not link_destino and reference_id:
        link_map = {
            "task": f"/curso/{subject_id}?tab=tasks&post={reference_id}",
            "exam": "/admin/exams",
            "material": f"/curso/{subject_id}?tab=materials&post={reference_id}",
            "forum": f"/curso/{subject_id}?tab=forum&post={reference_id}",
            "reminder": f"/curso/{subject_id}",
            "announcement": f"/curso/{subject_id}",
        }
        link_destino = link_map.get(notification_type, f"/curso/{subject_id}")
    
    notification = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "subject_id": subject_id,
        "subject_name": subject.get("name") if subject else None,
        "title": title,
        "message": message,
        "notification_type": notification_type,
        "reference_id": reference_id,
        "link_destino": link_destino,
        "author_id": author_id,
        "author_name": author_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read_by": []  # List of user IDs who have read this notification
    }
    
    await db.notifications.insert_one(notification)
    
    # Broadcast via WebSocket to relevant users
    try:
        notif_for_ws = {k: v for k, v in notification.items() if k not in ("_id", "read_by")}
        notif_for_ws["is_read"] = False
        
        # Find target users based on subject access
        target_user_ids = []
        if subject_id:
            # Students enrolled via grade
            subject_doc = await db.subjects.find_one({"id": subject_id}, {"_id": 0, "grade_id": 1})
            if subject_doc and subject_doc.get("grade_id"):
                students = await db.users.find(
                    {"school_id": school_id, "role": "student", "is_active": {"$ne": False}, "is_demo": {"$ne": True},
                     **ACADEMIC_STUDENT_FILTER,
                     "$or": [{"grade_id": subject_doc["grade_id"]}, {"grado_id": subject_doc["grade_id"]}]},
                    {"_id": 0, "id": 1}
                ).to_list(500)
                target_user_ids.extend([s["id"] for s in students])
        
        # Admin/owner/director/coordinator of the school always get notifications
        admins = await db.users.find(
            {"school_id": school_id, "role": {"$in": ["admin", "owner", "director", "coordinator"]}, "is_active": {"$ne": False}, "is_demo": {"$ne": True}},
            {"_id": 0, "id": 1}
        ).to_list(50)
        target_user_ids.extend([a["id"] for a in admins])
        
        # Teachers of this subject
        if subject_id:
            teachers = await db.users.find(
                {"school_id": school_id, "role": "teacher", "is_active": {"$ne": False}, "is_demo": {"$ne": True}},
                {"_id": 0, "id": 1}
            ).to_list(100)
            target_user_ids.extend([t["id"] for t in teachers])
        
        # Remove duplicates and the author
        target_user_ids = list(set(uid for uid in target_user_ids if uid != author_id))
        
        await ws_manager.broadcast_to_users(target_user_ids, {
            "type": "new_notification",
            "notification": notif_for_ws
        })
    except Exception as e:
        logger.warning(f"WebSocket broadcast error: {e}")
    
    notification.pop("_id", None)
    return notification

@router.get("/notifications/all")
async def get_all_notifications(
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get all notifications for the current user (from their subjects)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    school_id = user["school_id"]
    
    # Get all subjects the user has access to
    if user.get("role") in ["admin", "owner", "director", "coordinator"]:
        subjects = await db.subjects.find(
            {"school_id": school_id},
            {"_id": 0, "id": 1}
        ).to_list(500)
    elif user.get("role") == "teacher":
        subjects = await db.subjects.find(
            {"school_id": school_id, "teacher_id": user_id},
            {"_id": 0, "id": 1}
        ).to_list(100)
    else:
        # Students get notifications from enrolled subjects
        enrollments = await db.enrollments.find(
            {"school_id": school_id, "user_id": user_id, "status": "active"},
            {"_id": 0, "subject_ids": 1}
        ).to_list(100)
        
        subject_ids = []
        for enrollment in enrollments:
            subject_ids.extend(enrollment.get("subject_ids", []))
        
        if user.get("grade_id"):
            grade = await db.grades.find_one({"id": user["grade_id"]}, {"_id": 0})
            if grade and grade.get("subjects"):
                subject_ids.extend([s.get("subject_id") for s in grade["subjects"] if s.get("subject_id")])
        
        subjects = [{"id": sid} for sid in list(set(subject_ids))]
    
    subject_ids = [s["id"] for s in subjects]
    
    # Get notifications from these subjects OR school-wide notifications
    notifications = await db.notifications.find(
        {
            "school_id": school_id,
            "$or": [
                {"subject_id": {"$in": subject_ids}},
                {"subject_id": None}  # School-wide notifications
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark which ones are read and clean response
    for notif in notifications:
        notif["is_read"] = user_id in notif.get("read_by", [])
        notif.pop("read_by", None)  # Don't send full list to frontend
    
    # Count unread
    unread_count = sum(1 for n in notifications if not n["is_read"])
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total_count": len(notifications)
    }

@router.post("/notifications/test-push")
async def test_push_notification(current_user = Depends(get_current_user)):
    """Test endpoint: Creates a notification and broadcasts via WebSocket"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    subject = await db.subjects.find_one({"school_id": school_id}, {"_id": 0, "id": 1, "name": 1})
    
    notif = await create_notification_for_subject(
        school_id=school_id,
        subject_id=subject["id"] if subject else None,
        title="Notificacion en tiempo real",
        message="Esta notificacion fue enviada via WebSocket push",
        notification_type="announcement",
        author_id=user["id"],
        author_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip()
    )
    
    return {"success": True, "notification_id": notif["id"], "online_users": ws_manager.get_online_count()}


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user = Depends(get_current_user)
):
    """Mark a notification as read"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    await db.notifications.update_one(
        {"id": notification_id},
        {"$addToSet": {"read_by": user["id"]}}
    )
    
    # Calculate remaining unread count
    school_id = user["school_id"]
    user_id = user["id"]
    subject_ids = await _get_user_subject_ids(user)
    
    unread_count = await db.notifications.count_documents({
        "school_id": school_id,
        "$or": [{"subject_id": {"$in": subject_ids}}, {"subject_id": None}],
        "read_by": {"$ne": user_id}
    })
    
    return {"success": True, "unread_count": unread_count}

@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user = Depends(get_current_user)
):
    """Mark all notifications as read for the current user"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user["school_id"]
    user_id = user["id"]
    subject_ids = await _get_user_subject_ids(user)
    
    await db.notifications.update_many(
        {
            "school_id": school_id,
            "$or": [
                {"subject_id": {"$in": subject_ids}},
                {"subject_id": None}
            ]
        },
        {"$addToSet": {"read_by": user_id}}
    )
    
    return {"success": True, "unread_count": 0}

@router.get("/notifications/unread-count")
async def get_notifications_unread_count(current_user = Depends(get_current_user)):
    """Get unread notification count for the bell badge"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    subject_ids = await _get_user_subject_ids(user)
    
    unread_count = await db.notifications.count_documents({
        "school_id": user["school_id"],
        "$or": [{"subject_id": {"$in": subject_ids}}, {"subject_id": None}],
        "read_by": {"$ne": user["id"]}
    })
    
    return {"unread_count": unread_count}


async def _get_user_subject_ids(user):
    """Helper to get subject IDs a user has access to"""
    school_id = user.get("school_id")
    user_id = user.get("id")
    role = user.get("role", "student")
    
    if role in ["admin", "owner", "director", "coordinator"]:
        subjects = await db.subjects.find({"school_id": school_id}, {"_id": 0, "id": 1}).to_list(500)
    elif role == "teacher":
        subjects = await db.subjects.find({"school_id": school_id, "teacher_id": user_id}, {"_id": 0, "id": 1}).to_list(100)
    else:
        subject_ids = []
        enrollments = await db.enrollments.find(
            {"school_id": school_id, "user_id": user_id, "status": "active"},
            {"_id": 0, "subject_ids": 1}
        ).to_list(100)
        for enrollment in enrollments:
            subject_ids.extend(enrollment.get("subject_ids", []))
        if user.get("grade_id"):
            grade = await db.grades.find_one({"id": user["grade_id"]}, {"_id": 0})
            if grade and grade.get("subjects"):
                subject_ids.extend([s.get("subject_id") for s in grade["subjects"] if s.get("subject_id")])
        return list(set(subject_ids))
    
    return [s["id"] for s in subjects]


# ══════════════════════════════════════════════════════════════════════════════


# ══════════════════════════════════════════════════════════════════════════════
# CLONE ACTIVITY (post: task/forum/material) TO OTHER SECTIONS
# ══════════════════════════════════════════════════════════════════════════════

class CloneRequest(BaseModel):
    destinos: List[dict] = []
    clonar_en_misma_seccion: bool = False

@router.post("/course/posts/{post_id}/clonar")
async def clone_post(post_id: str, data: CloneRequest, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if user.get("role") not in ["owner", "admin", "teacher", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="No tienes permisos")

    school_id = user["school_id"]
    original = await db.course_posts.find_one({"id": post_id, "school_id": school_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")

    now = datetime.now(timezone.utc).isoformat()
    clonados = 0
    errores = []

    # Clone in same section
    if data.clonar_en_misma_seccion:
        clone = {**original}
        clone["id"] = str(uuid.uuid4())
        clone["title"] = f"{original.get('title', '')} (copia)"
        clone["status"] = original.get("status", "active")
        clone["created_at"] = now
        clone["updated_at"] = now
        clone["created_by"] = user["id"]
        clone["author_id"] = user["id"]
        clone.pop("submissions", None)
        clone.pop("closed_at", None)
        try:
            await db.course_posts.insert_one(clone)
            clone.pop("_id", None)
            clonados += 1
        except Exception as e:
            errores.append(f"Misma seccion: {str(e)}")

    # Clone to other subjects
    for dest in data.destinos:
        dest_subject_id = dest.get("subject_id")
        if not dest_subject_id:
            errores.append("Destino sin subject_id")
            continue

        dest_subject = await db.subjects.find_one({"id": dest_subject_id, "school_id": school_id}, {"_id": 0, "id": 1})
        if not dest_subject:
            errores.append("Asignatura destino no encontrada")
            continue

        clone = {**original}
        clone["id"] = str(uuid.uuid4())
        clone["subject_id"] = dest_subject_id
        clone["title"] = f"{original.get('title', '')} (copia)"
        clone["status"] = original.get("status", "active")
        clone["created_at"] = now
        clone["updated_at"] = now
        clone["created_by"] = user["id"]
        clone["author_id"] = user["id"]
        clone.pop("submissions", None)
        clone.pop("closed_at", None)
        try:
            await db.course_posts.insert_one(clone)
            clone.pop("_id", None)
            clonados += 1
        except Exception as e:
            errores.append(str(e))

    return {"clonados": clonados, "errores": errores}

