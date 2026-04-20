"""
Student portal endpoints
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
    STUDENT_TASKS_CACHE,
    STUDENT_DASHBOARD_CACHE,
    ACADEMIC_STUDENT_FILTER, ACADEMIC_STUDENT_FILTER_WITH_PENDING,
    PERU_TZ, to_peru_hhmm,
)

import jwt
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

class InternalMailCreate(BaseModel):
    subject: str
    body: str
    recipient_ids: List[str]
    recipient_type: Optional[str] = "individual"
    attachments: Optional[List[dict]] = []

# STUDENT PORTAL ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/student/profile")
async def get_student_profile(current_user = Depends(get_current_user)):
    """
    Get complete student profile with academic context.
    Returns all necessary info for student portal navigation.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    
    # Get academic context
    nivel = None
    grado = None
    seccion = None
    turno = None
    
    if user.get("nivel_id"):
        nivel = await db.academic_levels.find_one({"id": user["nivel_id"], "school_id": school_id}, {"_id": 0})
    
    if user.get("grado_id"):
        grado = await db.grades.find_one({"id": user["grado_id"], "school_id": school_id}, {"_id": 0})
    
    if user.get("seccion_id"):
        seccion = await db.sections.find_one({"id": user["seccion_id"], "school_id": school_id}, {"_id": 0})
    
    if user.get("turno_id"):
        turno = await db.shifts.find_one({"id": user["turno_id"], "school_id": school_id}, {"_id": 0})
    
    # Get enrolled courses (subjects assigned to student's section - source of truth: section_id)
    courses = []
    if user.get("seccion_id"):
        courses = await db.subjects.find({
            "school_id": school_id,
            "section_id": user["seccion_id"],
            "status": "active"
        }, {"_id": 0}).to_list(100)
    
    # Get pending tasks count
    pending_tasks = 0
    if courses:
        subject_ids = [c["id"] for c in courses]
        pending_tasks = await db.course_posts.count_documents({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "$or": [{"post_type": "task"}, {"type": "task"}],
            "due_date": {"$gte": datetime.now(timezone.utc).isoformat()},
            "deleted_at": {"$exists": False}
        })
    
    # Get unread messages count from internal_mail
    unread_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user["id"],
                    "is_read": False,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    unread_result = await db.internal_mail.aggregate(unread_pipeline).to_list(1)
    unread_messages = unread_result[0]["count"] if unread_result else 0
    
    return {
        "user": {
            "id": user["id"],
            "name": user.get("name", ""),
            "last_name": user.get("last_name", ""),
            "email": user.get("email"),
            "photo_url": user.get("photo_url"),
            "role": user.get("role")
        },
        "academic": {
            "nivel": nivel,
            "grado": grado,
            "seccion": seccion,
            "turno": turno,
            "nivel_id": user.get("nivel_id"),
            "grado_id": user.get("grado_id"),
            "seccion_id": user.get("seccion_id"),
            "turno_id": user.get("turno_id")
        },
        "courses_count": len(courses),
        "pending_tasks": pending_tasks,
        "unread_messages": unread_messages,
        "school_id": school_id
    }

@router.get("/student/courses")
async def get_student_courses(current_user = Depends(get_current_user)):
    """
    Get courses/subjects assigned to student's section.
    Includes teacher info for each course.
    Uses academic_assignments collection.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    
    if not seccion_id:
        return {"courses": [], "message": "No tienes una sección asignada"}
    
    # Get section info with grade and level names
    section = await db.sections.find_one({"id": seccion_id, "school_id": school_id}, {"_id": 0})
    section_name = section.get("nombre", "-") if section else "-"
    
    grade = None
    grade_name = "-"
    level_name = "-"
    if section and section.get("grado_id"):
        grade = await db.grades.find_one({"id": section["grado_id"], "school_id": school_id}, {"_id": 0})
        grade_name = grade.get("nombre", "-") if grade else "-"
        if grade and grade.get("nivel_id"):
            level = await db.academic_levels.find_one({"id": grade["nivel_id"], "school_id": school_id}, {"_id": 0})
            level_name = level.get("nombre", "-") if level else "-"
    
    # Source of truth: subjects assigned to this section via section_id
    grade_id = section.get("grado_id") if section else None
    section_subjects = await db.subjects.find({
        "school_id": school_id,
        "section_id": seccion_id,
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    # Build a lookup of teacher assignments for this section
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0}).to_list(100)
    teacher_by_subject = {}
    for a in assignments:
        sid = a.get("subject_id")
        if sid and sid not in teacher_by_subject:
            teacher_by_subject[sid] = a.get("teacher_id")
    
    courses = []
    for subject in section_subjects:
        teacher_id = teacher_by_subject.get(subject["id"])
        teacher = None
        if teacher_id:
            teacher = await db.users.find_one({"id": teacher_id}, {"_id": 0, "password": 0})
        
        materials_count = await db.course_posts.count_documents({
            "school_id": school_id,
            "subject_id": subject["id"],
            "type": "material",
            "deleted_at": {"$exists": False}
        })
        tasks_count = await db.course_posts.count_documents({
            "school_id": school_id,
            "subject_id": subject["id"],
            "type": "task",
            "deleted_at": {"$exists": False}
        })
        
        courses.append({
            "id": subject["id"],
            "name": subject.get("name"),
            "description": subject.get("description"),
            "image_url": subject.get("image_url"),
            "color": subject.get("color"),
            "teacher": {
                "id": teacher["id"] if teacher else None,
                "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() if teacher else "Sin asignar",
                "photo_url": teacher.get("photo_url") if teacher else None
            },
            "materials_count": materials_count,
            "tasks_count": tasks_count,
            "section_id": seccion_id,
            "section_name": section_name,
            "grade_id": grade_id,
            "grade_name": grade_name,
            "level_name": level_name
        })
    
    return {"courses": courses}

@router.get("/student/classmates")
async def get_student_classmates(current_user = Depends(get_current_user)):
    """
    Get all students in the same section (including current user).
    Used for displaying student list in tasks and other views.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    
    if not seccion_id:
        return {"students": [], "message": "No tienes una sección asignada"}
    
    # Get ALL students in the same section (including current user) - exclude pending
    students_cursor = db.users.find(
        {
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            **ACADEMIC_STUDENT_FILTER
        },
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    students = await students_cursor.to_list(length=100)
    
    # Return student info with contact details for messaging
    return {
        "students": [
            {
                "id": s.get("id"),
                "name": s.get("name"),
                "last_name": s.get("last_name"),
                "photo_url": s.get("photo_url"),
                "username": s.get("username"),
                "email": s.get("email"),
                "phone": s.get("phone")
            }
            for s in students
        ]
    }

@router.get("/student/tasks")
async def get_student_tasks(
    current_user = Depends(get_current_user),
    request: Request = None
):
    """
    Get ALL tasks assigned to a student across all their courses.
    
    OPTIMIZATIONS:
    - Single endpoint - no multiple requests from frontend
    - In-memory TTL cache (60s) per student
    - Batch queries to avoid N+1
    - Proper indexing on course_posts.subject_id, task_submissions.student_id
    
    Returns tasks with course info, submission status, and due dates.
    Response includes Cache-Control headers for client-side caching.
    """
    student_id = current_user["sub"]
    
    # Check cache first
    cached = STUDENT_TASKS_CACHE.get(student_id)
    if cached:
        response = JSONResponse(
            content=cached,
            headers={
                "Cache-Control": "private, max-age=60",
                "X-Cache": "HIT"
            }
        )
        return response
    
    user = await db.users.find_one({"id": student_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    
    empty_response = {"tasks": [], "stats": {"total": 0, "pending": 0, "submitted": 0, "graded": 0, "late": 0}}
    
    if not seccion_id:
        return JSONResponse(content=empty_response, headers={"Cache-Control": "private, max-age=60"})
    
    # Source of truth: subjects assigned to this section via section_id
    section_subjects = await db.subjects.find({
        "school_id": school_id,
        "section_id": seccion_id,
        "status": "active"
    }, {"_id": 0, "id": 1}).to_list(100)
    
    subject_ids = [s["id"] for s in section_subjects]
    
    if not subject_ids:
        STUDENT_TASKS_CACHE[student_id] = empty_response
        return JSONResponse(content=empty_response, headers={"Cache-Control": "private, max-age=60"})
    
    # BATCH QUERY 1: Get subjects info
    subjects = await db.subjects.find(
        {"id": {"$in": subject_ids}, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "color": 1}
    ).to_list(100)
    subjects_map = {s["id"]: s for s in subjects}
    
    # BATCH QUERY 2: Get ALL tasks for these subjects (including their
    # embedded `submissions` array — that's the single source of truth
    # populated by the submit flow in admin_portal.py).
    raw_tasks = await db.course_posts.find({
        "school_id": school_id,
        "subject_id": {"$in": subject_ids},
        "$or": [{"type": "task"}, {"post_type": "task"}],
        "deleted_at": {"$exists": False}
    }, {
        "_id": 0, "id": 1, "title": 1, "content": 1, "description": 1,
        "due_date": 1, "created_at": 1, "subject_id": 1, "metadata": 1,
        "submissions": 1,
    }).to_list(500)

    # Build a map {task_id -> this student's submission} from the embedded
    # array. The legacy `db.task_submissions` collection is NOT populated by
    # the submit flow, so querying it always returned nothing — which made
    # every task appear as "Pendiente"/"Atrasada" even after the student
    # submitted. Reading from the embedded array keeps this endpoint aligned
    # with the teacher grading view and the submissions_count in the tasks
    # list.
    submissions_map = {}
    for t in raw_tasks:
        for sub in (t.get("submissions") or []):
            if sub.get("student_id") == student_id:
                submissions_map[t.get("id")] = {
                    "id": sub.get("id"),
                    "submitted_at": sub.get("submitted_at"),
                    "grade": sub.get("grade"),
                    "feedback": sub.get("feedback"),
                }
                break
    
    # Process tasks with status
    now = datetime.now(timezone.utc)
    tasks = []
    stats = {"total": 0, "pending": 0, "submitted": 0, "graded": 0, "late": 0}
    
    for task in raw_tasks:
        task_id = task.get("id")
        subject_id = task.get("subject_id")
        subject = subjects_map.get(subject_id, {})
        submission = submissions_map.get(task_id)
        
        # Determine due date
        due_date = task.get("due_date") or task.get("metadata", {}).get("due_date")
        is_past_due = False
        if due_date:
            try:
                due_dt = datetime.fromisoformat(due_date.replace("Z", "+00:00")) if isinstance(due_date, str) else due_date
                is_past_due = due_dt < now
            except:
                pass
        
        # Determine status
        if submission:
            if submission.get("grade") is not None:
                status = "graded"
            else:
                status = "submitted"
        elif is_past_due:
            status = "late"
        else:
            status = "pending"
        
        stats["total"] += 1
        stats[status] += 1
        
        tasks.append({
            "id": task_id,
            "title": task.get("title"),
            "description": task.get("content") or task.get("description"),
            "due_date": due_date,
            "created_at": task.get("created_at"),
            "course_id": subject_id,
            "course_name": subject.get("name", "Sin curso"),
            "course_color": subject.get("color", "#f59e0b"),
            "status": status,
            "submission": {
                "id": submission.get("id"),
                "submitted_at": submission.get("submitted_at"),
                "grade": submission.get("grade"),
                "feedback": submission.get("feedback")
            } if submission else None
        })
    
    # Sort by status priority then due date
    status_order = {"pending": 0, "late": 1, "submitted": 2, "graded": 3}
    tasks.sort(key=lambda t: (status_order.get(t.get("status"), 4), t.get("due_date") or "9999"))
    
    result = {"tasks": tasks, "stats": stats}
    
    # Store in cache
    STUDENT_TASKS_CACHE[student_id] = result
    
    return JSONResponse(
        content=result,
        headers={
            "Cache-Control": "private, max-age=60",
            "X-Cache": "MISS"
        }
    )

@router.get("/student/schedule")
async def get_student_schedule(current_user = Depends(get_current_user)):
    """
    Get complete schedule for student based on their section/grade.
    Returns schedules, breaks, settings, and academic context.
    NO parameters accepted - all data extracted from authenticated user.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # SECURITY: Only students can access this endpoint
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    grado_id = user.get("grado_id")
    
    # Get grade and section info for header
    grade_name = None
    section_name = None
    
    if grado_id:
        grado = await db.grades.find_one({"id": grado_id, "school_id": school_id}, {"_id": 0, "nombre": 1})
        if grado:
            grade_name = grado.get("nombre")
    
    if seccion_id:
        seccion = await db.sections.find_one({"id": seccion_id, "school_id": school_id}, {"_id": 0, "nombre": 1})
        if seccion:
            section_name = seccion.get("nombre")
    
    # Get schedule settings for this school
    settings = await db.schedule_settings.find_one({"school_id": school_id}, {"_id": 0})
    if not settings:
        settings = {
            "start_hour": "07:00",
            "end_hour": "18:00",
            "time_format": "24h",
            "block_duration": 45,
            "view_mode": "horizontal",
            "include_saturday": False,
            "include_sunday": False
        }
    
    # Get breaks (recreo, almuerzo, evento) ONLY for student's grade and section
    breaks_query = {"school_id": school_id}
    if grado_id:
        breaks_query["grade_id"] = grado_id
    if seccion_id:
        breaks_query["section_id"] = seccion_id
    breaks = await db.schedule_breaks.find(breaks_query, {"_id": 0}).to_list(50)
    
    # If no section/grade, return empty but with context
    if not seccion_id and not grado_id:
        return {
            "schedules": [],
            "breaks": [],
            "settings": settings,
            "grade_name": grade_name,
            "section_name": section_name
        }
    
    # Build query - get schedules for student's section or grade
    query = {
        "school_id": school_id,
        "tipo": "clases"
    }
    
    # Try section first, then grade
    if seccion_id:
        query["seccion_id"] = seccion_id
    elif grado_id:
        query["grado_id"] = grado_id
    
    schedules = await db.schedules.find(query, {"_id": 0}).sort([("dia", 1), ("hora_inicio", 1)]).to_list(100)
    
    # Enrich with teacher info (name + photo)
    enriched_schedules = []
    for schedule in schedules:
        profesor_nombre = None
        profesor_foto = None
        
        if schedule.get("profesor_id"):
            teacher = await db.users.find_one(
                {"id": schedule["profesor_id"]}, 
                {"_id": 0, "name": 1, "last_name": 1, "profile_image": 1, "photo_url": 1}
            )
            if teacher:
                profesor_nombre = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
                profesor_foto = teacher.get("profile_image") or teacher.get("photo_url")
        
        enriched_schedules.append({
            **schedule,
            "profesor_nombre": profesor_nombre or schedule.get("profesor_nombre"),
            "profesor_foto": profesor_foto
        })
    
    return {
        "schedules": enriched_schedules,
        "breaks": breaks,
        "settings": settings,
        "grade_name": grade_name,
        "section_name": section_name
    }

@router.get("/student/dashboard")
async def get_student_dashboard(current_user = Depends(get_current_user)):
    """
    Get dashboard data for student portal.
    Includes upcoming tasks, recent announcements, schedule preview.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    
    # Get student's courses from subjects collection (source of truth: section_id)
    subject_ids = []
    if seccion_id:
        section_subjects = await db.subjects.find({
            "school_id": school_id,
            "section_id": seccion_id,
            "status": "active"
        }, {"_id": 0, "id": 1}).to_list(100)
        subject_ids = [s["id"] for s in section_subjects]
    
    # Upcoming tasks (next 7 days) - only tasks the student has NOT submitted yet
    upcoming_tasks = []
    if subject_ids:
        now = datetime.now(timezone.utc)
        week_later = now + timedelta(days=7)
        tasks = await db.course_posts.find({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "$or": [{"post_type": "task"}, {"type": "task"}],  # Support both field names
            "due_date": {"$gte": now.isoformat(), "$lte": week_later.isoformat()},
            "deleted_at": {"$exists": False}
        }, {"_id": 0}).sort("due_date", 1).to_list(50)
        
        # Single source of truth: embedded `course_posts.submissions` array.
        # The legacy `db.task_submissions` collection is no longer populated
        # by the submit flow, so we check the embedded array only (same
        # approach as GET /api/student/tasks).
        for task in tasks:
            submissions = task.get("submissions", []) or []
            student_submitted = any(s.get("student_id") == user["id"] for s in submissions)
            
            # Only show tasks that haven't been submitted
            if not student_submitted:
                subject = await db.subjects.find_one({"id": task["subject_id"]}, {"_id": 0})
                upcoming_tasks.append({
                    "id": task["id"],
                    "title": task.get("title"),
                    "subject_name": subject.get("name") if subject else "Sin asignatura",
                    "subject_color": subject.get("color") if subject else "#6366f1",
                    "due_date": task.get("due_date"),
                    "subject_id": task["subject_id"]
                })
        
        # Limit to 10 most urgent
        upcoming_tasks = upcoming_tasks[:10]
    
    # Recent announcements (institutional messages)
    announcements = await db.institutional_messages.find({
        "school_id": school_id,
        "status": "active"
    }, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    # Format announcements
    recent_announcements = []
    for ann in announcements:
        recent_announcements.append({
            "id": ann["id"],
            "title": ann.get("title"),
            "priority": ann.get("priority", "normal"),
            "created_at": ann.get("created_at"),
            "is_read": user["id"] in ann.get("read_by", [])
        })
    
    # Get attendance summary (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Check both attendance collections for compatibility
    # Primary: attendances (new format with user_id)
    attendance_records = await db.attendances.find({
        "school_id": school_id,
        "user_id": user["id"],
        "type": "student",
        "date": {"$gte": thirty_days_ago}
    }, {"_id": 0}).to_list(100)
    
    # Also check student_attendance (QR-based attendance)
    qr_attendance = await db.student_attendance.find({
        "school_id": school_id,
        "student_id": user["id"],
        "date": {"$gte": thirty_days_ago}
    }, {"_id": 0}).to_list(100)
    
    # Merge records (avoid duplicates by date)
    attendance_dates = {a.get("date") for a in attendance_records}
    for qr in qr_attendance:
        if qr.get("date") not in attendance_dates:
            attendance_records.append(qr)
    
    attendance_summary = {
        "present": sum(1 for a in attendance_records if a.get("status") == "present"),
        "absent": sum(1 for a in attendance_records if a.get("status") == "absent"),
        "late": sum(1 for a in attendance_records if a.get("status") == "late"),
        "justified": sum(1 for a in attendance_records if a.get("status") == "justified")
    }
    
    # Calculate average grade from graded submissions
    average_grade = None
    if subject_ids:
        all_grades = []
        # Get all tasks with submissions for this student
        tasks_with_grades = await db.course_posts.find({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "$or": [{"post_type": "task"}, {"type": "task"}],
            "submissions.student_id": user["id"],
            "submissions.grade": {"$exists": True, "$ne": None},
            "deleted_at": {"$exists": False}
        }, {"_id": 0, "submissions": 1, "max_grade": 1}).to_list(500)
        
        for task in tasks_with_grades:
            max_grade = task.get("max_grade", 20)
            for sub in task.get("submissions", []):
                if sub.get("student_id") == user["id"] and sub.get("grade") is not None:
                    # Normalize to 20-point scale
                    normalized_grade = (sub["grade"] / max_grade) * 20 if max_grade > 0 else sub["grade"]
                    all_grades.append(normalized_grade)
        
        if all_grades:
            average_grade = sum(all_grades) / len(all_grades)
    
    # Calculate task progress (total, submitted, pending)
    task_progress = {
        "total_tasks": 0,
        "tasks_submitted": 0,
        "tasks_pending": 0,
        "percentage": 0
    }
    
    if subject_ids:
        # Get ALL tasks assigned to the student (any due date)
        all_tasks = await db.course_posts.find({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "$or": [{"post_type": "task"}, {"type": "task"}],
            "deleted_at": {"$exists": False}
        }, {"_id": 0, "id": 1, "submissions": 1}).to_list(500)
        
        total = len(all_tasks)
        submitted = 0
        
        for task in all_tasks:
            submissions = task.get("submissions", [])
            # Check if this student submitted
            if any(s.get("student_id") == user["id"] for s in submissions):
                submitted += 1
        
        task_progress = {
            "total_tasks": total,
            "tasks_submitted": submitted,
            "tasks_pending": total - submitted,
            "percentage": round((submitted / total) * 100) if total > 0 else 0
        }
    
    # Get number of classmates in the same section
    section_students_count = 0
    if seccion_id:
        section_students_count = await db.users.count_documents({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "id": {"$ne": user["id"]},
            **ACADEMIC_STUDENT_FILTER
        })
    
    return {
        "upcoming_tasks": upcoming_tasks,
        "recent_announcements": recent_announcements,
        "attendance_summary": attendance_summary,
        "courses_count": len(subject_ids),
        "average_grade": average_grade,
        "task_progress": task_progress,
        "section_students_count": section_students_count
    }

@router.get("/attendance/student")
async def get_student_attendance(
    start_date: str = None,
    end_date: str = None,
    current_user = Depends(get_current_user)
):
    """
    Get attendance records for the current student.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    student_id = user["id"]
    
    # Build base query for date filters
    date_filter = {}
    if start_date and end_date:
        date_filter["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        date_filter["date"] = {"$gte": start_date}
    elif end_date:
        date_filter["date"] = {"$lte": end_date}
    
    # Query main attendances collection (user_id field)
    query_attendances = {
        "school_id": school_id,
        "user_id": student_id,
        "type": "student",
        **date_filter
    }
    records_attendances = await db.attendances.find(query_attendances, {"_id": 0}).to_list(500)
    
    # Query QR-based attendance (student_id field)
    query_qr = {
        "school_id": school_id,
        "student_id": student_id,
        **date_filter
    }
    records_qr = await db.student_attendance.find(query_qr, {"_id": 0}).to_list(500)
    
    # Merge records avoiding duplicates by date
    all_records = []
    dates_seen = set()
    
    # Add records from main collection first
    for r in records_attendances:
        date = r.get("date")
        if date and date not in dates_seen:
            dates_seen.add(date)
            all_records.append({
                "id": r.get("id", ""),
                "date": date,
                "status": r.get("status", "present"),
                "check_in_time": r.get("check_in_time", ""),
                "method": r.get("method", "manual")
            })
    
    # Add QR records if date not already covered
    for r in records_qr:
        date = r.get("date")
        if date and date not in dates_seen:
            dates_seen.add(date)
            all_records.append({
                "id": r.get("id", ""),
                "date": date,
                "status": r.get("status", "present"),
                "check_in_time": r.get("check_in_time", ""),
                "method": r.get("method", "qr_scan")
            })
    
    # Sort by date descending
    all_records.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    return {"records": all_records}

# ══════════════════════════════════════════════════════════════════════════════

# STUDENT PORTAL - MESSAGES (Course Context)
# Uses subject_id as course identifier, academic_assignments for teacher info,
# and seccion_id for classmates
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/student-portal/messages/allowed-recipients")
async def get_student_allowed_recipients(course_id: str, current_user = Depends(get_current_user)):
    """Get allowed recipients for a student within a subject/course context
    course_id is actually subject_id from the frontend
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Solo estudiantes pueden acceder a este endpoint")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    subject_id = course_id  # course_id is actually subject_id
    
    # Get subject name
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id}, {"_id": 0, "name": 1})
    subject_name = subject.get("name") if subject else "Asignatura"
    
    allowed_recipients = []
    
    # 1. Add school owner/admin first (priority)
    owners = await db.users.find({
        "school_id": school_id,
        "role": {"$in": ["owner", "admin"]},
        "is_active": {"$ne": False}
    }, {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "photo_url": 1, "role": 1}).to_list(10)
    
    for owner in owners:
        full_name = f"{owner.get('name', '')} {owner.get('last_name', '')}".strip() or owner.get('first_name', '')
        allowed_recipients.append({
            "id": owner["id"],
            "name": full_name,
            "email": owner.get("email"),
            "photo_url": owner.get("photo_url"),
            "role": "owner" if (owner.get("role") == "owner" or owner.get("is_owner")) else "admin",
            "role_label": "Propietario" if (owner.get("role") == "owner" or owner.get("is_owner")) else "Administrador"
        })
    
    # 2. Find teacher from academic_assignments for this subject and section
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0, "teacher_id": 1})
    
    if assignment and assignment.get("teacher_id"):
        teacher = await db.users.find_one(
            {"id": assignment["teacher_id"]},
            {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "photo_url": 1, "role": 1}
        )
        if teacher:
            full_name = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() or teacher.get('first_name', '')
            allowed_recipients.append({
                "id": teacher["id"],
                "name": full_name,
                "email": teacher.get("email"),
                "photo_url": teacher.get("photo_url"),
                "role": "teacher",
                "course_name": subject_name
            })
    
    # 3. Add classmates (students in same section)
    if seccion_id:
        classmates = await db.users.find({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "id": {"$ne": user["id"]},
            "is_active": {"$ne": False}
        }, {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "photo_url": 1, "role": 1}).to_list(100)
        
        for student in classmates:
            full_name = f"{student.get('name', '')} {student.get('last_name', '')}".strip() or student.get('first_name', '')
            allowed_recipients.append({
                "id": student["id"],
                "name": full_name,
                "email": student.get("email"),
                "photo_url": student.get("photo_url"),
                "role": "student"
            })
    
    return {"recipients": allowed_recipients, "course_name": subject_name}


@router.get("/student-portal/messages/inbox")
async def get_student_messages_inbox(
    course_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get inbox messages for a student within a course context"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    subject_id = course_id
    
    # Build list of allowed sender IDs (teacher + classmates)
    allowed_ids = [user["id"]]  # Include self for sent messages in same context
    
    # Get teacher
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0, "teacher_id": 1})
    
    if assignment and assignment.get("teacher_id"):
        allowed_ids.append(assignment["teacher_id"])
    
    # Get classmates
    if seccion_id:
        classmates = await db.users.find({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "is_active": {"$ne": False}
        }, {"_id": 0, "id": 1}).to_list(100)
        allowed_ids.extend([c["id"] for c in classmates])
    
    # Also include school owner/admin messages
    owners = await db.users.find({
        "school_id": school_id,
        "role": {"$in": ["owner", "admin"]}
    }, {"_id": 0, "id": 1}).to_list(20)
    allowed_ids.extend([o["id"] for o in owners])
    
    # Remove duplicates
    allowed_ids = list(set(allowed_ids))
    
    # Get messages where user is recipient and sender is in allowed list
    pipeline = [
        {
            "$match": {
                "recipients": {
                    "$elemMatch": {
                        "user_id": user["id"],
                        "is_deleted": {"$ne": True},
                        "is_archived": {"$ne": True}
                    }
                },
                "sender_id": {"$in": allowed_ids}
            }
        },
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    messages = await db.internal_mail.aggregate(pipeline).to_list(limit)
    
    # Enrich with sender info
    result = []
    for msg in messages:
        sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1})
        
        recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), None)
        
        result.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body": msg["body"][:200] + "..." if len(msg.get("body", "")) > 200 else msg.get("body", ""),
            "sender": {
                "id": sender["id"] if sender else msg["sender_id"],
                "name": f"{sender.get('name', '')} {sender.get('last_name', '')}".strip() if sender else "Usuario",
                "photo_url": sender.get("photo_url") if sender else None,
                "role": sender.get("role") if sender else None
            },
            "is_read": recipient_entry.get("is_read", False) if recipient_entry else False,
            "is_starred": recipient_entry.get("is_starred", False) if recipient_entry else False,
            "created_at": msg["created_at"],
            "thread_id": msg.get("thread_id")
        })
    
    # Total count
    total_pipeline = [
        {
            "$match": {
                "recipients": {
                    "$elemMatch": {
                        "user_id": user["id"],
                        "is_deleted": {"$ne": True},
                        "is_archived": {"$ne": True}
                    }
                },
                "sender_id": {"$in": allowed_ids}
            }
        },
        {"$count": "total"}
    ]
    total_result = await db.internal_mail.aggregate(total_pipeline).to_list(1)
    total = total_result[0]["total"] if total_result else 0
    
    return {"messages": result, "total": total}


@router.get("/student-portal/messages/sent")
async def get_student_messages_sent(
    course_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get sent messages for a student"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get sent messages (exclude deleted and archived by sender)
    messages = await db.internal_mail.find(
        {
            "sender_id": user["id"],
            "sender_deleted": {"$ne": True},
            "sender_archived": {"$ne": True}
        },
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for msg in messages:
        # Get first recipient info
        first_recipient_id = msg["recipients"][0]["user_id"] if msg.get("recipients") else None
        recipient = await db.users.find_one({"id": first_recipient_id}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}) if first_recipient_id else None
        
        result.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body": msg["body"][:200] + "..." if len(msg.get("body", "")) > 200 else msg.get("body", ""),
            "recipient": {
                "id": recipient["id"] if recipient else first_recipient_id,
                "name": f"{recipient.get('name', '')} {recipient.get('last_name', '')}".strip() if recipient else "Usuario",
                "photo_url": recipient.get("photo_url") if recipient else None,
                "role": recipient.get("role") if recipient else None
            },
            "recipients_count": len(msg.get("recipients", [])),
            "created_at": msg["created_at"],
            "thread_id": msg.get("thread_id")
        })
    
    total = await db.internal_mail.count_documents({
        "sender_id": user["id"],
        "sender_deleted": {"$ne": True},
        "sender_archived": {"$ne": True}
    })
    
    return {"messages": result, "total": total}


@router.get("/student-portal/messages/stats")
async def get_student_messages_stats(course_id: str, current_user = Depends(get_current_user)):
    """Get message stats for a student"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    subject_id = course_id
    
    # Build allowed IDs
    allowed_ids = [user["id"]]
    
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0, "teacher_id": 1})
    
    if assignment and assignment.get("teacher_id"):
        allowed_ids.append(assignment["teacher_id"])
    
    if seccion_id:
        classmates = await db.users.find({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "is_active": {"$ne": False}
        }, {"_id": 0, "id": 1}).to_list(100)
        allowed_ids.extend([c["id"] for c in classmates])
    
    owners = await db.users.find({
        "school_id": school_id,
        "role": {"$in": ["owner", "admin"]}
    }, {"_id": 0, "id": 1}).to_list(20)
    allowed_ids.extend([o["id"] for o in owners])
    
    allowed_ids = list(set(allowed_ids))
    
    # Unread count
    unread_pipeline = [
        {
            "$match": {
                "recipients": {
                    "$elemMatch": {
                        "user_id": user["id"],
                        "is_read": False,
                        "is_deleted": {"$ne": True},
                        "is_archived": {"$ne": True}
                    }
                },
                "sender_id": {"$in": allowed_ids}
            }
        },
        {"$count": "count"}
    ]
    unread_result = await db.internal_mail.aggregate(unread_pipeline).to_list(1)
    unread = unread_result[0]["count"] if unread_result else 0
    
    # Inbox count
    inbox_pipeline = [
        {
            "$match": {
                "recipients": {
                    "$elemMatch": {
                        "user_id": user["id"],
                        "is_deleted": {"$ne": True},
                        "is_archived": {"$ne": True}
                    }
                },
                "sender_id": {"$in": allowed_ids}
            }
        },
        {"$count": "count"}
    ]
    inbox_result = await db.internal_mail.aggregate(inbox_pipeline).to_list(1)
    inbox = inbox_result[0]["count"] if inbox_result else 0
    
    # Sent count (exclude deleted and archived by sender)
    sent = await db.internal_mail.count_documents({
        "sender_id": user["id"],
        "sender_deleted": {"$ne": True},
        "sender_archived": {"$ne": True}
    })
    
    # Archived count (both received and sent)
    archived_received = await db.internal_mail.count_documents({
        "recipients": {
            "$elemMatch": {
                "user_id": user["id"],
                "is_archived": True,
                "is_deleted": {"$ne": True}
            }
        }
    })
    archived_sent = await db.internal_mail.count_documents({
        "sender_id": user["id"],
        "sender_archived": True,
        "sender_deleted": {"$ne": True}
    })
    archived = archived_received + archived_sent
    
    # Trash count (both received and sent)
    trash_received = await db.internal_mail.count_documents({
        "recipients": {
            "$elemMatch": {
                "user_id": user["id"],
                "is_deleted": True
            }
        }
    })
    trash_sent = await db.internal_mail.count_documents({
        "sender_id": user["id"],
        "sender_deleted": True
    })
    trash = trash_received + trash_sent
    
    return {"unread": unread, "inbox": inbox, "sent": sent, "archived": archived, "trash": trash}


@router.post("/student-portal/messages/send")
async def send_student_message(data: InternalMailCreate, course_id: str, current_user = Depends(get_current_user)):
    """Send a message from student within course context"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Solo estudiantes pueden usar este endpoint")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    subject_id = course_id
    
    # Build allowed recipient IDs
    allowed_ids = set()
    
    # Teacher
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0, "teacher_id": 1})
    
    if assignment and assignment.get("teacher_id"):
        allowed_ids.add(assignment["teacher_id"])
    
    # Classmates
    if seccion_id:
        classmates = await db.users.find({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "is_active": {"$ne": False}
        }, {"_id": 0, "id": 1}).to_list(100)
        for c in classmates:
            allowed_ids.add(c["id"])
    
    # Owners/Admins
    owners = await db.users.find({
        "school_id": school_id,
        "role": {"$in": ["owner", "admin"]}
    }, {"_id": 0, "id": 1}).to_list(20)
    for o in owners:
        allowed_ids.add(o["id"])
    
    # CRITICAL VALIDATION: Check all recipients are allowed
    for rid in data.recipient_ids:
        if rid not in allowed_ids:
            raise HTTPException(status_code=403, detail="No puedes enviar mensajes a usuarios fuera de tu asignatura")
    
    # Create recipient entries
    recipients = []
    for rid in data.recipient_ids:
        recipients.append({
            "user_id": rid,
            "is_read": False,
            "is_starred": False,
            "is_archived": False,
            "is_deleted": False
        })
    
    message_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())
    
    message = {
        "id": message_id,
        "thread_id": thread_id,
        "sender_id": user["id"],
        "subject": data.subject.strip(),
        "body": data.body,
        "recipients": recipients,
        "attachments": data.attachments or [],
        "school_id": school_id,
        "course_id": subject_id,  # Track course context
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_mail.insert_one(message)
    
    return {"id": message_id, "thread_id": thread_id, "message": "Mensaje enviado correctamente"}


@router.get("/student-portal/messages/{message_id}")
async def get_student_message_detail(message_id: str, current_user = Depends(get_current_user)):
    """Get message detail for student"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    msg = await db.internal_mail.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    # Check if user is sender or recipient
    is_sender = msg["sender_id"] == user["id"]
    recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), None)
    
    if not is_sender and not recipient_entry:
        raise HTTPException(status_code=403, detail="No tienes acceso a este mensaje")
    
    # Mark as read if recipient
    if recipient_entry and not recipient_entry.get("is_read"):
        await db.internal_mail.update_one(
            {"id": message_id, "recipients.user_id": user["id"]},
            {"$set": {"recipients.$.is_read": True}}
        )
    
    # Get sender info
    sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1})
    
    return {
        "id": msg["id"],
        "subject": msg["subject"],
        "body": msg["body"],
        "sender": {
            "id": sender["id"] if sender else msg["sender_id"],
            "name": f"{sender.get('name', '')} {sender.get('last_name', '')}".strip() if sender else "Usuario",
            "photo_url": sender.get("photo_url") if sender else None,
            "role": sender.get("role") if sender else None
        },
        "created_at": msg["created_at"],
        "thread_id": msg.get("thread_id"),
        "attachments": msg.get("attachments", [])
    }


@router.put("/student-portal/messages/{message_id}/read")
async def mark_student_message_read(message_id: str, current_user = Depends(get_current_user)):
    """Mark message as read"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    result = await db.internal_mail.update_one(
        {"id": message_id, "recipients.user_id": user["id"]},
        {"$set": {"recipients.$.is_read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    return {"message": "Marcado como leído"}

# ══════════════════════════════════════════════════════════════════════════════

