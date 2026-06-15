"""
Admin portal - academic management
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
    ACADEMIC_STUDENT_FILTER, ACADEMIC_STUDENT_FILTER_WITH_PENDING,
    PERU_TZ, to_peru_hhmm,
    MIME_TYPE_MAP,
)
from .exams import get_drive_service

import jwt
import io
from fastapi.responses import StreamingResponse, Response
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# ADMIN PORTAL - GESTIÓN ACADÉMICA ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class AdminGradeUpdate(BaseModel):
    grade: float
    motivo: str = Field(..., min_length=5, description="Motivo de la corrección administrativa")

@router.get("/admin/grades")
async def get_admin_grades(
    level_id: Optional[str] = None,
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    period_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all grades for admin view with filters."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id}
    if section_id:
        query["section_id"] = section_id
    if subject_id:
        query["subject_id"] = subject_id
    if period_id:
        query["period_id"] = period_id
    
    # Get grades
    grades = await db.student_grades.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with student, subject, section info
    enriched_grades = []
    for g in grades:
        student = await db.users.find_one({"id": g.get("student_id")}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
        subject = await db.subjects.find_one({"id": g.get("subject_id")}, {"_id": 0, "name": 1})
        section = await db.sections.find_one({"id": g.get("section_id")}, {"_id": 0, "nombre": 1})
        teacher = await db.users.find_one({"id": g.get("teacher_id")}, {"_id": 0, "name": 1, "last_name": 1}) if g.get("teacher_id") else None
        
        enriched_grades.append({
            **g,
            "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Desconocido",
            "student_photo": student.get("photo_url") if student else None,
            "subject_name": subject.get("name") if subject else "Sin asignatura",
            "section_name": section.get("nombre") if section else "Sin sección",
            "teacher_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() if teacher else None
        })
    
    return {"grades": enriched_grades, "total": len(enriched_grades)}

@router.get("/admin/grades/summary")
async def get_admin_grades_summary(
    level_id: Optional[str] = None,
    grade_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get grades summary by section for admin dashboard."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Get sections with optional filter
    section_query = {"school_id": school_id, "activo": True}
    if grade_id:
        section_query["grado_id"] = grade_id
    
    sections = await db.sections.find(section_query, {"_id": 0}).to_list(100)
    
    summary = []
    for section in sections:
        # Count students in section (exclude pending)
        students_count = await db.users.count_documents({
            "school_id": school_id,
            "role": "student",
            "seccion_id": section["id"],
            **ACADEMIC_STUDENT_FILTER
        })
        
        # Get grades for this section
        grades = await db.student_grades.find({
            "school_id": school_id,
            "section_id": section["id"]
        }, {"_id": 0, "grade": 1}).to_list(1000)
        
        grade_values = [g["grade"] for g in grades if g.get("grade") is not None]
        avg_grade = sum(grade_values) / len(grade_values) if grade_values else None
        
        # Get grade info
        grade = await db.grades.find_one({"id": section.get("grado_id")}, {"_id": 0, "nombre": 1, "nivel_id": 1})
        level = await db.academic_levels.find_one({"id": grade.get("nivel_id")}, {"_id": 0, "nombre": 1}) if grade else None
        
        summary.append({
            "section_id": section["id"],
            "section_name": section.get("nombre"),
            "grade_name": grade.get("nombre") if grade else None,
            "level_name": level.get("nombre") if level else None,
            "students_count": students_count,
            "grades_count": len(grade_values),
            "average_grade": round(avg_grade, 2) if avg_grade else None
        })
    
    return {"summary": summary}

@router.put("/admin/grades/{grade_id}")
async def update_admin_grade(
    grade_id: str,
    data: AdminGradeUpdate,
    current_user = Depends(get_current_user)
):
    """Update a grade with administrative reason (audit trail)."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar notas")
    
    school_id = user["school_id"]
    
    # Find the grade
    grade_doc = await db.student_grades.find_one({"id": grade_id, "school_id": school_id})
    if not grade_doc:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    
    old_grade = grade_doc.get("grade")
    
    # Create audit log entry
    audit_entry = {
        "old_grade": old_grade,
        "new_grade": data.grade,
        "motivo": data.motivo,
        "admin_id": user["id"],
        "admin_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Update grade with audit trail
    await db.student_grades.update_one(
        {"id": grade_id},
        {
            "$set": {
                "grade": data.grade,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_admin_edit": audit_entry
            },
            "$push": {
                "admin_edits": audit_entry
            }
        }
    )
    
    return {"message": "Nota actualizada correctamente", "old_grade": old_grade, "new_grade": data.grade}

# Admin Attendance Endpoints
@router.get("/admin/attendance")
async def get_admin_attendance(
    section_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get attendance records for admin view with filters."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id}
    if section_id:
        query["section_id"] = section_id
    if status:
        query["status"] = status
    if date_from and date_to:
        query["date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["date"] = {"$gte": date_from}
    elif date_to:
        query["date"] = {"$lte": date_to}
    
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    
    # Enrich with student info
    enriched = []
    for r in records:
        student = await db.users.find_one({"id": r.get("student_id")}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
        section = await db.sections.find_one({"id": r.get("section_id")}, {"_id": 0, "nombre": 1})
        
        enriched.append({
            **r,
            "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Desconocido",
            "student_photo": student.get("photo_url") if student else None,
            "section_name": section.get("nombre") if section else None
        })
    
    return {"records": enriched, "total": len(enriched)}

@router.get("/admin/attendance/summary")
async def get_admin_attendance_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get attendance summary by section."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Default to last 30 days
    if not date_from:
        date_from = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    sections = await db.sections.find({"school_id": school_id, "activo": True}, {"_id": 0}).to_list(100)
    
    summary = []
    for section in sections:
        # Get attendance records for this section
        records = await db.attendance.find({
            "school_id": school_id,
            "section_id": section["id"],
            "date": {"$gte": date_from, "$lte": date_to}
        }, {"_id": 0, "status": 1}).to_list(5000)
        
        present = sum(1 for r in records if r.get("status") == "present")
        absent = sum(1 for r in records if r.get("status") == "absent")
        late = sum(1 for r in records if r.get("status") == "late")
        justified = sum(1 for r in records if r.get("status") == "justified")
        total = len(records)
        
        # Get grade info
        grade = await db.grades.find_one({"id": section.get("grado_id")}, {"_id": 0, "nombre": 1, "nivel_id": 1})
        level = await db.academic_levels.find_one({"id": grade.get("nivel_id")}, {"_id": 0, "nombre": 1}) if grade else None
        
        summary.append({
            "section_id": section["id"],
            "section_name": section.get("nombre"),
            "grade_name": grade.get("nombre") if grade else None,
            "level_name": level.get("nombre") if level else None,
            "present": present,
            "absent": absent,
            "late": late,
            "justified": justified,
            "total": total,
            "attendance_rate": round((present / total) * 100, 1) if total > 0 else 0
        })
    
    return {"summary": summary, "date_range": {"from": date_from, "to": date_to}}

class AdminAttendanceUpdate(BaseModel):
    status: Literal["present", "absent", "late", "justified"]
    motivo: str = Field(..., min_length=5, description="Motivo de la corrección")

@router.put("/admin/attendance/{record_id}")
async def update_admin_attendance(
    record_id: str,
    data: AdminAttendanceUpdate,
    current_user = Depends(get_current_user)
):
    """Update attendance record with administrative reason."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden corregir asistencia")
    
    school_id = user["school_id"]
    
    record = await db.attendance.find_one({"id": record_id, "school_id": school_id})
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    old_status = record.get("status")
    
    # Create audit entry
    audit_entry = {
        "old_status": old_status,
        "new_status": data.status,
        "motivo": data.motivo,
        "admin_id": user["id"],
        "admin_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.attendance.update_one(
        {"id": record_id},
        {
            "$set": {
                "status": data.status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_admin_edit": audit_entry
            },
            "$push": {
                "admin_edits": audit_entry
            }
        }
    )
    
    return {"message": "Asistencia actualizada correctamente", "old_status": old_status, "new_status": data.status}

# Admin Tasks Endpoints
@router.get("/admin/tasks")
async def get_admin_tasks(
    subject_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all tasks for admin view."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Build query - support both "type" and "post_type" for backwards compatibility
    query = {"school_id": school_id, "$or": [{"post_type": "task"}, {"type": "task"}]}
    if subject_id:
        query["subject_id"] = subject_id
    if teacher_id:
        query["created_by"] = teacher_id
    
    tasks = await db.course_posts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Determine status and enrich
    now = datetime.now(timezone.utc).isoformat()
    enriched = []
    for t in tasks:
        subject = await db.subjects.find_one({"id": t.get("subject_id")}, {"_id": 0, "name": 1})
        teacher = await db.users.find_one({"id": t.get("created_by")}, {"_id": 0, "name": 1, "last_name": 1})
        
        submissions = t.get("submissions", [])
        submissions_count = len(submissions)
        graded_count = sum(1 for s in submissions if s.get("grade") is not None)
        
        # Calculate task status
        due_date = t.get("due_date")
        task_status = "active"
        if due_date and due_date < now:
            task_status = "expired"
        if t.get("status") == "closed":
            task_status = "closed"
        
        # Filter by status if provided
        if status and task_status != status:
            continue
        
        enriched.append({
            "id": t["id"],
            "title": t.get("title"),
            "due_date": due_date,
            "created_at": t.get("created_at"),
            "subject_id": t.get("subject_id"),
            "subject_name": subject.get("name") if subject else "Sin asignatura",
            "teacher_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() if teacher else "Desconocido",
            "submissions_count": submissions_count,
            "graded_count": graded_count,
            "status": task_status,
            "max_grade": t.get("max_grade", 20)
        })
    
    return {"tasks": enriched, "total": len(enriched)}

@router.get("/admin/tasks/summary")
async def get_admin_tasks_summary(current_user = Depends(get_current_user)):
    """Get tasks summary for admin dashboard."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Count tasks by status
    all_tasks = await db.course_posts.find({"school_id": school_id, "type": "task"}, {"_id": 0, "due_date": 1, "status": 1, "submissions": 1}).to_list(1000)
    
    active = 0
    expired = 0
    closed = 0
    total_submissions = 0
    total_graded = 0
    
    for t in all_tasks:
        due_date = t.get("due_date")
        if t.get("status") == "closed":
            closed += 1
        elif due_date and due_date < now:
            expired += 1
        else:
            active += 1
        
        submissions = t.get("submissions", [])
        total_submissions += len(submissions)
        total_graded += sum(1 for s in submissions if s.get("grade") is not None)
    
    return {
        "total": len(all_tasks),
        "active": active,
        "expired": expired,
        "closed": closed,
        "total_submissions": total_submissions,
        "total_graded": total_graded,
        "pending_grading": total_submissions - total_graded
    }

class AdminTaskStatusUpdate(BaseModel):
    status: Literal["active", "closed"]

@router.put("/admin/tasks/{task_id}/status")
async def update_admin_task_status(
    task_id: str,
    data: AdminTaskStatusUpdate,
    current_user = Depends(get_current_user)
):
    """Update task status (close/reopen)."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden cambiar estado")
    
    school_id = user["school_id"]
    
    task = await db.course_posts.find_one({"id": task_id, "school_id": school_id, "type": "task"})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    new_status = "closed" if data.status == "closed" else None
    
    await db.course_posts.update_one(
        {"id": task_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Estado de tarea actualizado a {data.status}"}

# Student Task Submission Endpoint
async def _upload_submission_file_to_drive(
    service,
    submissions_folder_id: str,
    student_id: str,
    file_name: str,
    file_type: Optional[str],
    content: bytes,
):
    """Upload a single submission file to Google Drive. Returns drive_file_id."""
    file_ext = file_name.split(".")[-1].lower() if "." in file_name else ""
    mime_type = MIME_TYPE_MAP.get(file_ext, file_type or "application/octet-stream")

    file_metadata = {
        'name': f"{student_id}_{file_name}",
        'parents': [submissions_folder_id]
    }
    media = MediaIoBaseUpload(
        io.BytesIO(content),
        mimetype=mime_type,
        resumable=True
    )
    drive_file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, name'
    ).execute()
    return drive_file.get('id')


async def _ensure_submissions_folder(service, materials_folder_id: str) -> str:
    """Find or create the 'Entregas' subfolder under materials_folder_id."""
    submissions_folder_query = (
        f"name='Entregas' and '{materials_folder_id}' in parents and "
        f"mimeType='application/vnd.google-apps.folder' and trashed=false"
    )
    results = service.files().list(q=submissions_folder_query, fields="files(id)").execute()
    submissions_folders = results.get('files', [])
    if submissions_folders:
        return submissions_folders[0]['id']
    folder_metadata = {
        'name': 'Entregas',
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [materials_folder_id]
    }
    folder = service.files().create(body=folder_metadata, fields='id').execute()
    return folder.get('id')


@router.post("/course/tasks/{task_id}/submit")
async def submit_task(
    task_id: str,
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    files: List[UploadFile] = File(default_factory=list),
    current_user = Depends(get_current_user)
):
    """Submit a task as a student. Supports multiple file attachments."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    school_id = user["school_id"]
    student_id = user["id"]

    # Find the task - support both "type" (old system) and "post_type" (new system)
    task = await db.course_posts.find_one({
        "id": task_id,
        "school_id": school_id,
        "$or": [{"post_type": "task"}, {"type": "task"}]
    })
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    # Check if task deadline has passed
    due_date = task.get("due_date") or task.get("metadata", {}).get("due_date")
    if due_date:
        try:
            if isinstance(due_date, str):
                deadline = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            else:
                deadline = due_date
            now = datetime.now(timezone.utc)
            allow_late = task.get("metadata", {}).get("allow_late_submissions", False)
            if deadline < now and not allow_late:
                raise HTTPException(
                    status_code=400,
                    detail="El plazo para entregar esta tarea ha vencido. No se permiten entregas tardías."
                )
        except HTTPException:
            raise
        except (ValueError, TypeError):
            pass  # If date parsing fails, allow submission

    # Check if already submitted — allow replacing while task open and not graded.
    existing_submission = None
    existing_index = None
    for idx, sub in enumerate(task.get("submissions", []) or []):
        if sub.get("student_id") == student_id:
            existing_submission = sub
            existing_index = idx
            break

    if existing_submission and existing_submission.get("grade") is not None:
        raise HTTPException(
            status_code=400,
            detail="Tu entrega ya fue calificada y no puede modificarse",
        )

    # Normalize incoming files into a single list (supports both `file` legacy
    # field and the new `files` list field). Filter out empty/blank entries
    # FastAPI may sometimes pass when no file was selected on the form.
    incoming_files: List[UploadFile] = []
    if files:
        for f in files:
            if f and getattr(f, "filename", None):
                incoming_files.append(f)
    if file and getattr(file, "filename", None):
        incoming_files.append(file)

    # Validate that at least text or one file is provided
    if not text_content and not incoming_files:
        raise HTTPException(status_code=400, detail="Debes proporcionar texto o al menos un archivo")

    # Limit number of files per submission to avoid abuse / timeouts.
    MAX_FILES_PER_SUBMISSION = 20
    if len(incoming_files) > MAX_FILES_PER_SUBMISSION:
        raise HTTPException(
            status_code=400,
            detail=f"No puedes adjuntar más de {MAX_FILES_PER_SUBMISSION} archivos por entrega",
        )

    # Resolve school's Google Drive config once for the whole batch.
    school = await db.schools.find_one({"id": school_id}, {"_id": 0}) if incoming_files else None
    use_google_drive = bool(school and school.get("google_drive_connected"))
    drive_service = None
    submissions_folder_id = None
    if use_google_drive and incoming_files:
        try:
            drive_service = await get_drive_service(school_id)
            materials_folder_id = school.get("google_drive_materials_folder_id")
            if materials_folder_id:
                submissions_folder_id = await _ensure_submissions_folder(drive_service, materials_folder_id)
            else:
                use_google_drive = False
        except Exception as e:
            logger.warning(f"Failed to init Drive for submissions, falling back to Cloudinary: {e}")
            use_google_drive = False

    # Process each file
    attachments: List[dict] = []
    for up in incoming_files:
        content = await up.read()
        f_name = up.filename
        f_type = up.content_type
        f_size = len(content) if content is not None else 0

        att = {
            "id": str(uuid.uuid4()),
            "file_name": f_name,
            "file_type": f_type,
            "file_size": f_size,
            "file_url": None,
            "drive_file_id": None,
            "storage_type": None,
        }

        uploaded = False
        if use_google_drive and submissions_folder_id:
            try:
                drive_id = await _upload_submission_file_to_drive(
                    drive_service, submissions_folder_id,
                    student_id, f_name, f_type, content,
                )
                att["drive_file_id"] = drive_id
                att["storage_type"] = "google_drive"
                uploaded = True
                logger.info(f"Submission file uploaded to Drive: {f_name} for task {task_id}")
            except Exception as e:
                logger.warning(f"Drive upload failed for {f_name}, fallback to Cloudinary: {e}")

        if not uploaded:
            try:
                import cloudinary.uploader
                result = cloudinary.uploader.upload(
                    content,
                    folder=f"edunet/submissions/{task_id}",
                    resource_type="auto",
                    public_id=f"{student_id}_{att['id']}_{f_name}"
                )
                att["file_url"] = result.get("secure_url")
                att["storage_type"] = "cloudinary"
            except Exception as e:
                logger.error(f"Cloudinary upload failed for {f_name}: {e}")
                raise HTTPException(status_code=500, detail=f"Error al subir el archivo {f_name}")

        attachments.append(att)

    now = datetime.now(timezone.utc).isoformat()

    # Legacy single-file fields are populated from the first attachment so old
    # clients/views that read `file_url`/`drive_file_id` keep working.
    first = attachments[0] if attachments else {}
    submission = {
        "id": (existing_submission or {}).get("id") or str(uuid.uuid4()),
        "student_id": student_id,
        "student_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "text_content": text_content,
        "attachments": attachments,
        # Legacy single-file fields (kept for backward compatibility)
        "file_url": first.get("file_url"),
        "file_name": first.get("file_name"),
        "file_type": first.get("file_type"),
        "drive_file_id": first.get("drive_file_id"),
        "storage_type": first.get("storage_type"),
        "submitted_at": now,
        "grade": None,
        "feedback": None,
    }

    if existing_submission is not None:
        await db.course_posts.update_one(
            {"id": task_id},
            {"$set": {f"submissions.{existing_index}": submission}}
        )
        message = "Entrega actualizada exitosamente"
    else:
        await db.course_posts.update_one(
            {"id": task_id},
            {"$push": {"submissions": submission}}
        )
        message = "Tarea entregada exitosamente"

    return {
        "message": message,
        "submission_id": submission["id"],
        "storage_type": first.get("storage_type"),
        "attachments_count": len(attachments),
        "replaced": existing_submission is not None,
    }


@router.delete("/course/tasks/{task_id}/submission")
async def retract_task_submission(
    task_id: str,
    current_user = Depends(get_current_user),
):
    """Retract (delete) the current student's submission for a task.

    Rules:
      * Only the owning student can retract their own submission.
      * Blocked if the submission has already been graded.
      * Blocked if the deadline has passed (regardless of `allow_late_submissions`)
        — per product decision: once the plazo closes, no retracting.
      * Removes the submission from `course_posts.submissions` array.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Solo los estudiantes pueden retirar su entrega")

    # Enforce active-student guard (pending/rejected cannot act)
    from .core import enforce_student_active
    await enforce_student_active(user)

    school_id = user["school_id"]
    student_id = user["id"]

    # Locate the task
    task = await db.course_posts.find_one({
        "id": task_id,
        "school_id": school_id,
        "$or": [{"post_type": "task"}, {"type": "task"}],
    }, {"_id": 0, "id": 1, "due_date": 1, "metadata": 1, "submissions": 1, "submissions_count": 1})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    # Find the student's submission
    existing = None
    for sub in (task.get("submissions") or []):
        if sub.get("student_id") == student_id:
            existing = sub
            break
    if not existing:
        raise HTTPException(status_code=404, detail="No tienes una entrega para esta tarea")

    # Block if graded
    if existing.get("grade") is not None:
        raise HTTPException(
            status_code=400,
            detail="Tu entrega ya fue calificada y no puede retirarse. Habla con tu profesor.",
        )

    # Block if deadline passed (strict — even if late submissions allowed)
    due_date = task.get("due_date") or (task.get("metadata") or {}).get("due_date")
    if due_date:
        try:
            if isinstance(due_date, str):
                deadline = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
            else:
                deadline = due_date
            now = datetime.now(timezone.utc)
            if deadline < now:
                raise HTTPException(
                    status_code=400,
                    detail="El plazo de la tarea ya venció. No puedes retirar tu entrega.",
                )
        except HTTPException:
            raise
        except (ValueError, TypeError):
            pass  # Ignore unparsable dates, allow retraction

    # Pull the submission out of the embedded array + decrement counter
    update_doc = {
        "$pull": {"submissions": {"student_id": student_id}},
    }
    current_count = task.get("submissions_count") or 0
    if current_count > 0:
        update_doc["$inc"] = {"submissions_count": -1}

    await db.course_posts.update_one(
        {"id": task_id, "school_id": school_id},
        update_doc,
    )

    # Audit log (best-effort, non-fatal)
    try:
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "user_id": student_id,
            "action": "task_submission_retracted",
            "resource_type": "task_submission",
            "resource_id": existing.get("id"),
            "metadata": {"task_id": task_id},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    return {
        "message": "Entrega retirada. Ya puedes volver a enviar tu tarea antes del plazo.",
        "task_id": task_id,
    }


@router.get("/course/tasks/{task_id}/submissions/{submission_id}/download")
async def download_submission_file(
    task_id: str,
    submission_id: str,
    attachment_index: Optional[int] = Query(None, ge=0),
    attachment_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """Download a student's submission file.

    Supports multi-attachment submissions: pass `attachment_index` (0-based) or
    `attachment_id` to fetch a specific file. Without those params, falls back
    to legacy single-file fields for backward compatibility.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Find the task - support both "type" (old system) and "post_type" (new system)
    task = await db.course_posts.find_one({
        "id": task_id,
        "school_id": school_id,
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Find the submission
    submission = None
    for sub in task.get("submissions", []):
        if sub.get("id") == submission_id:
            submission = sub
            break
    
    if not submission:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    
    # Check if user has permission: admins, staff (teachers/coordinators/etc.)
    # of the same school, or the student who owns the submission.
    is_admin = is_admin_user(user)
    is_owner = submission.get("student_id") == user.get("id")
    is_school_staff = is_staff(user) and user.get("school_id") == school_id

    if not (is_admin or is_owner or is_school_staff):
        raise HTTPException(status_code=403, detail="No tienes permiso para descargar este archivo")

    # Pick the target file: either a specific attachment from the new
    # `attachments` array, or fall back to the legacy single-file fields.
    attachments = submission.get("attachments") or []
    target = None
    if attachment_id and attachments:
        target = next((a for a in attachments if a.get("id") == attachment_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Archivo adjunto no encontrado")
    elif attachment_index is not None and attachments:
        if attachment_index >= len(attachments):
            raise HTTPException(status_code=404, detail="Índice de adjunto inválido")
        target = attachments[attachment_index]
    elif attachments:
        # No specific attachment requested: default to the first one in the new array
        target = attachments[0]

    if target:
        storage_type = target.get("storage_type")
        drive_file_id = target.get("drive_file_id")
        file_url = target.get("file_url")
        file_name = target.get("file_name", "archivo")
    else:
        # Legacy single-file submission
        storage_type = submission.get("storage_type")
        drive_file_id = submission.get("drive_file_id")
        file_url = submission.get("file_url")
        file_name = submission.get("file_name", "archivo")
    
    if storage_type == "google_drive" and drive_file_id:
        # Download from Google Drive — buffer the whole file and return it as
        # a single Response. Streaming chunk-by-chunk has been flaky in
        # production (some chunks silently truncate the response on the
        # client), buffering is more reliable for the size of files students
        # typically upload.
        try:
            service = await get_drive_service(school_id)

            # Get file metadata
            file_metadata = service.files().get(fileId=drive_file_id, fields='mimeType, size').execute()
            mime_type = file_metadata.get('mimeType', 'application/octet-stream')

            # Download fully into memory
            request = service.files().get_media(fileId=drive_file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request, chunksize=2 * 1024 * 1024)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            content = fh.getvalue()

            # URL-encode the filename so non-ASCII names don't break headers
            from urllib.parse import quote
            safe_name = quote(file_name or "archivo")
            return Response(
                content=content,
                media_type=mime_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{file_name}"; filename*=UTF-8\'\'{safe_name}',
                    "Content-Length": str(len(content)),
                },
            )
        except Exception as e:
            logger.error(
                f"[DRIVE-DOWNLOAD] Failed for task={task_id} submission={submission_id} "
                f"drive_file_id={drive_file_id} school={school_id}: {type(e).__name__}: {e}",
                exc_info=True,
            )
            raise HTTPException(
                status_code=502,
                detail=f"Error al descargar desde Google Drive ({type(e).__name__}). "
                       f"Vuelve a intentarlo. Si persiste, contacta al administrador.",
            )
    
    elif file_url:
        # Redirect to Cloudinary URL or return the URL
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=file_url)
    
    else:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")


@router.get("/course/tasks/{task_id}/submissions/{submission_id}/download-all")
async def download_all_submission_files(
    task_id: str,
    submission_id: str,
    current_user = Depends(get_current_user),
):
    """Download ALL attachments of a submission bundled into a single ZIP.

    Useful when a student uploads multiple files and the teacher wants a
    one-click download. Supports both Google Drive (streamed via API) and
    Cloudinary (fetched via HTTPS). Falls back gracefully if any file is
    unavailable — that file is replaced inside the zip by a small `.txt`
    note so the rest still arrives.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    school_id = user["school_id"]

    task = await db.course_posts.find_one({
        "id": task_id,
        "school_id": school_id,
        "$or": [{"post_type": "task"}, {"type": "task"}],
    }, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    submission = next((s for s in task.get("submissions", []) if s.get("id") == submission_id), None)
    if not submission:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    # Same auth rule as single-file download.
    is_admin = is_admin_user(user)
    is_owner = submission.get("student_id") == user.get("id")
    is_school_staff = is_staff(user) and user.get("school_id") == school_id
    if not (is_admin or is_owner or is_school_staff):
        raise HTTPException(status_code=403, detail="No tienes permiso para descargar estos archivos")

    # Resolve the attachment list (multi) or fall back to legacy single-file fields.
    attachments = submission.get("attachments") or []
    if not attachments and (submission.get("file_name") or submission.get("file_url") or submission.get("drive_file_id")):
        attachments = [{
            "id": None,
            "file_name": submission.get("file_name") or "archivo",
            "file_type": submission.get("file_type"),
            "file_url": submission.get("file_url"),
            "drive_file_id": submission.get("drive_file_id"),
            "storage_type": submission.get("storage_type"),
        }]
    if not attachments:
        raise HTTPException(status_code=404, detail="Esta entrega no tiene archivos para descargar")

    import zipfile
    import requests as _http

    # Pre-resolve Drive service if any attachment uses it (so we hit the
    # auth flow at most once for the whole batch).
    drive_service = None
    if any((a.get("storage_type") == "google_drive" and a.get("drive_file_id")) for a in attachments):
        try:
            drive_service = await get_drive_service(school_id)
        except Exception as e:
            logger.warning(f"Drive service init failed for zip download: {e}")

    def _safe_name(name: str) -> str:
        return re.sub(r'[\\/:*?"<>|]+', "_", (name or "archivo")).strip() or "archivo"

    used_names = {}
    def _unique(name: str) -> str:
        # avoid collisions when several attachments share the same filename
        if name not in used_names:
            used_names[name] = 1
            return name
        used_names[name] += 1
        if "." in name:
            base, ext = name.rsplit(".", 1)
            return f"{base} ({used_names[name]}).{ext}"
        return f"{name} ({used_names[name]})"

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, att in enumerate(attachments):
            fname = _unique(_safe_name(att.get("file_name") or f"archivo_{idx + 1}"))
            content: Optional[bytes] = None
            try:
                if att.get("storage_type") == "google_drive" and att.get("drive_file_id") and drive_service:
                    req = drive_service.files().get_media(fileId=att["drive_file_id"])
                    fh = io.BytesIO()
                    downloader = MediaIoBaseDownload(fh, req)
                    done = False
                    while not done:
                        _, done = downloader.next_chunk()
                    content = fh.getvalue()
                elif att.get("file_url"):
                    r = _http.get(att["file_url"], timeout=30)
                    if r.status_code == 200:
                        content = r.content
                    else:
                        logger.warning(f"Cloudinary fetch failed for zip: {att['file_url']} -> {r.status_code}")
            except Exception as e:
                logger.warning(f"Skipping attachment {fname} in zip: {e}")

            if content is None:
                zf.writestr(
                    fname + ".NO_DISPONIBLE.txt",
                    f"No se pudo recuperar este archivo ({att.get('storage_type') or 'unknown'}).",
                )
            else:
                zf.writestr(fname, content)

    zip_buf.seek(0)
    student_name = submission.get("student_name") or "entrega"
    zip_filename = _safe_name(f"{student_name}_entrega.zip")
    return StreamingResponse(
        iter([zip_buf.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )


# Admin Exams Endpoints
@router.get("/admin/exams")
async def get_admin_exams(
    subject_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all exams for admin view."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if subject_id:
        query["subject_id"] = subject_id
    if status:
        query["status"] = status
    
    exams = await db.exams.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    enriched = []
    for e in exams:
        subject = await db.subjects.find_one({"id": e.get("subject_id")}, {"_id": 0, "name": 1})
        teacher = await db.users.find_one({"id": e.get("created_by")}, {"_id": 0, "name": 1, "last_name": 1})
        
        enriched.append({
            **e,
            "subject_name": subject.get("name") if subject else "Sin asignatura",
            "teacher_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() if teacher else "Desconocido"
        })
    
    return {"exams": enriched, "total": len(enriched)}

@router.get("/admin/drive/diagnose")
async def diagnose_drive_connection(current_user = Depends(get_current_user)):
    """Diagnostic endpoint that checks the school's Google Drive connection AND
    reports a breakdown of where existing task submissions actually live
    (Google Drive vs Cloudinary vs unknown).

    Designed to be called when a teacher reports a 500 on submission
    download — it tells you WHY before having to dig through logs.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar este diagnóstico")

    school_id = user["school_id"]
    report: dict = {
        "school_id": school_id,
        "checked_at": now_iso(),
        "drive_connected_flag": False,
        "has_refresh_token": False,
        "materials_folder_id": None,
        "service_initialized": False,
        "materials_folder_reachable": False,
        "submissions_folder_id": None,
        "submissions_folder_reachable": False,
        "list_sample_count": None,
        "errors": [],
        "status": "unknown",
        "submission_storage_stats": None,
        "recent_submissions": [],
    }

    try:
        school = await db.schools.find_one({"id": school_id}, {"_id": 0}) or {}
        report["drive_connected_flag"] = bool(school.get("google_drive_connected"))
        report["has_refresh_token"] = bool(school.get("google_drive_refresh_token"))
        report["materials_folder_id"] = school.get("google_drive_materials_folder_id")

        if not report["drive_connected_flag"]:
            report["errors"].append("school.google_drive_connected is False — el colegio no tiene Drive conectado en la BD")
        if not report["has_refresh_token"]:
            report["errors"].append("school.google_drive_refresh_token está vacío — no se puede autenticar con Drive")
        if not report["materials_folder_id"]:
            report["errors"].append("school.google_drive_materials_folder_id está vacío — no se sabe dónde están las carpetas")

        # Storage stats: para cada entrega de cada tarea del colegio,
        # cuenta el storage_type tanto del array `attachments` (nuevo
        # multi-archivo) como del campo legacy single-file.
        stats = {"google_drive": 0, "cloudinary": 0, "unknown": 0, "no_storage": 0}
        recent = []
        task_cursor = db.course_posts.find(
            {"school_id": school_id, "$or": [{"post_type": "task"}, {"type": "task"}]},
            {"_id": 0, "id": 1, "title": 1, "submissions": 1, "created_at": 1},
        )
        async for task in task_cursor:
            for sub in (task.get("submissions") or []):
                # Build per-submission storage breakdown
                atts = sub.get("attachments") or []
                sub_storages = []
                if atts:
                    for a in atts:
                        st = a.get("storage_type") or "unknown"
                        stats[st if st in stats else "unknown"] = stats.get(st if st in stats else "unknown", 0) + 1
                        sub_storages.append(st)
                else:
                    # Legacy single-file fields
                    st = sub.get("storage_type")
                    if st:
                        stats[st if st in stats else "unknown"] = stats.get(st if st in stats else "unknown", 0) + 1
                        sub_storages.append(st)
                    elif sub.get("file_url") or sub.get("drive_file_id") or sub.get("file_name"):
                        stats["unknown"] += 1
                        sub_storages.append("unknown")
                    else:
                        stats["no_storage"] += 1
                        sub_storages.append("no_storage")
                # Add to recent list (we'll trim later)
                recent.append({
                    "task_title": task.get("title"),
                    "task_id": task.get("id"),
                    "submission_id": sub.get("id"),
                    "student_name": sub.get("student_name"),
                    "submitted_at": sub.get("submitted_at"),
                    "attachments_count": len(atts) if atts else (1 if sub.get("file_name") else 0),
                    "storage_types": sub_storages,
                })
        # Keep only the most recent 10 by submitted_at for readability
        recent.sort(key=lambda x: (x.get("submitted_at") or ""), reverse=True)
        report["recent_submissions"] = recent[:10]
        report["submission_storage_stats"] = stats

        try:
            service = await get_drive_service(school_id)
            report["service_initialized"] = True
        except Exception as e:
            report["errors"].append(f"get_drive_service falló: {type(e).__name__}: {e}")
            report["status"] = "drive_auth_failed"
            return report

        # Materials folder reachable?
        if report["materials_folder_id"]:
            try:
                meta = service.files().get(
                    fileId=report["materials_folder_id"],
                    fields="id, name, trashed",
                ).execute()
                report["materials_folder_reachable"] = not meta.get("trashed", False)
                if meta.get("trashed"):
                    report["errors"].append("La carpeta de materiales está en la papelera de Drive")
            except Exception as e:
                report["errors"].append(f"No se puede acceder a la carpeta de materiales: {type(e).__name__}: {e}")

        # Submissions folder exists?
        if report["materials_folder_reachable"]:
            try:
                q = (
                    f"name='Entregas' and '{report['materials_folder_id']}' in parents "
                    f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
                )
                results = service.files().list(q=q, fields="files(id, name)").execute()
                folders = results.get("files", [])
                if folders:
                    report["submissions_folder_id"] = folders[0]["id"]
                    report["submissions_folder_reachable"] = True
                    files = service.files().list(
                        q=f"'{folders[0]['id']}' in parents and trashed=false",
                        fields="files(id, name)",
                        pageSize=5,
                    ).execute()
                    report["list_sample_count"] = len(files.get("files", []))
                else:
                    report["errors"].append("La subcarpeta 'Entregas' aún no existe (se crea al primer upload)")
            except Exception as e:
                report["errors"].append(f"Error al listar carpeta de entregas: {type(e).__name__}: {e}")

        if not report["errors"]:
            report["status"] = "ok"
        elif report["service_initialized"]:
            report["status"] = "partially_ok"
        else:
            report["status"] = "broken"
    except Exception as e:
        report["errors"].append(f"Excepción inesperada: {type(e).__name__}: {e}")
        report["status"] = "exception"
        logger.exception("[DRIVE-DIAGNOSE] unexpected error")

    return report



@router.get("/admin/exams/summary")
async def get_admin_exams_summary(current_user = Depends(get_current_user)):
    """Get exams summary for admin dashboard."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Count by status
    draft = await db.exams.count_documents({"school_id": school_id, "status": "draft"})
    published = await db.exams.count_documents({"school_id": school_id, "status": "published"})
    scheduled = await db.exams.count_documents({"school_id": school_id, "status": "scheduled"})
    closed = await db.exams.count_documents({"school_id": school_id, "status": "closed"})
    archived = await db.exams.count_documents({"school_id": school_id, "status": "archived"})
    
    return {
        "total": draft + published + scheduled + closed + archived,
        "draft": draft,
        "published": published,
        "scheduled": scheduled,
        "closed": closed,
        "archived": archived
    }

class AdminExamUpdate(BaseModel):
    status: Optional[Literal["draft", "published", "scheduled", "closed", "archived"]] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None

@router.put("/admin/exams/{exam_id}")
async def update_admin_exam(
    exam_id: str,
    data: AdminExamUpdate,
    current_user = Depends(get_current_user)
):
    """Update exam status/schedule from admin."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar exámenes")
    
    school_id = user["school_id"]
    
    exam = await db.exams.find_one({"id": exam_id, "school_id": school_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.status:
        update_data["status"] = data.status
    if data.scheduled_date:
        update_data["scheduled_date"] = data.scheduled_date
    if data.scheduled_time:
        update_data["scheduled_time"] = data.scheduled_time
    
    await db.exams.update_one({"id": exam_id}, {"$set": update_data})
    
    return {"message": "Examen actualizado correctamente"}

# Admin Announcements Endpoints
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    audience: Literal["all", "teachers", "students", "parents"] = "all"
    status: Literal["draft", "published", "scheduled", "archived"] = "draft"
    publish_date: Optional[str] = None
    attachments: Optional[List[dict]] = []

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    audience: Optional[Literal["all", "teachers", "students", "parents"]] = None
    status: Optional[Literal["draft", "published", "scheduled", "archived"]] = None
    publish_date: Optional[str] = None
    attachments: Optional[List[dict]] = None

@router.get("/admin/announcements")
async def get_admin_announcements(
    status: Optional[str] = None,
    audience: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all announcements for admin view."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if status:
        query["status"] = status
    if audience:
        query["audience"] = audience
    
    announcements = await db.announcements.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"announcements": announcements, "total": len(announcements)}

@router.post("/admin/announcements")
async def create_announcement(
    data: AnnouncementCreate,
    current_user = Depends(get_current_user)
):
    """Create a new announcement."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear comunicados")
    
    school_id = user["school_id"]
    
    announcement = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "title": data.title,
        "content": data.content,
        "audience": data.audience,
        "status": data.status,
        "publish_date": data.publish_date,
        "attachments": data.attachments or [],
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.announcements.insert_one(announcement)
    del announcement["_id"]
    
    return {"message": "Comunicado creado correctamente", "announcement": announcement}

@router.put("/admin/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: str,
    data: AnnouncementUpdate,
    current_user = Depends(get_current_user)
):
    """Update an announcement."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar comunicados")
    
    school_id = user["school_id"]
    
    announcement = await db.announcements.find_one({"id": announcement_id, "school_id": school_id})
    if not announcement:
        raise HTTPException(status_code=404, detail="Comunicado no encontrado")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.announcements.update_one({"id": announcement_id}, {"$set": update_data})
    
    return {"message": "Comunicado actualizado correctamente"}

@router.delete("/admin/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an announcement."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar comunicados")
    
    school_id = user["school_id"]
    
    result = await db.announcements.delete_one({"id": announcement_id, "school_id": school_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comunicado no encontrado")
    
    return {"message": "Comunicado eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════



# ══════════════════════════════════════════════════════════════════════════════
# DATA INTEGRITY — duplicate grade/section detector (READ-ONLY, owner/admin)
# ──────────────────────────────────────────────────────────────────────────────
# Production schools sometimes end up with DUPLICATE grade or section documents
# (same nombre under the same parent), with students/subjects/assignments split
# across them. This causes the Registro Auxiliar to show a different roster than
# Usuarios/Estudiantes (the bug reported at Eusebio Arróniz, jun-2026: course
# "Álgebra 4° A" linked to a duplicate section with a different set of children).
#
# This endpoint only READS and reports the duplicates so the owner can see the
# real state of their data and decide how to clean it up using the existing
# section/grade/student management screens. It performs NO writes.
# ══════════════════════════════════════════════════════════════════════════════

async def _count_students_in_section(school_id: str, section_id: str) -> int:
    return await db.users.count_documents({
        "school_id": school_id,
        "role": "student",
        "$or": [{"seccion_id": section_id}, {"section_id": section_id}],
    })


@router.get("/admin/data-integrity/duplicates")
async def get_data_integrity_duplicates(current_user=Depends(get_current_user)):
    """READ-ONLY: report duplicate grade and section documents for this school.

    A grade group is duplicated when two `grades` docs share the same (nivel_id,
    nombre). A section group is duplicated when two `sections` docs share the
    same (grado_id, nombre). For each duplicated section we surface how many
    students, subjects (courses) and teacher assignments point to it, so the
    owner can identify the canonical one and remove/migrate the stragglers."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    school_id = user["school_id"]

    # Caches
    levels = {l["id"]: l.get("nombre", "") for l in await db.academic_levels.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(200)}
    grades = await db.grades.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1}).to_list(500)
    grades_by_id = {g["id"]: g for g in grades}
    sections = await db.sections.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1}).to_list(2000)

    # ── Duplicate grades (same nivel_id + nombre) ──
    grade_groups = {}
    for g in grades:
        key = (g.get("nivel_id"), (g.get("nombre") or "").strip().lower())
        grade_groups.setdefault(key, []).append(g)
    duplicate_grades = []
    for (nivel_id, _), grp in grade_groups.items():
        if len(grp) > 1:
            duplicate_grades.append({
                "nivel_id": nivel_id,
                "level_name": levels.get(nivel_id, ""),
                "nombre": grp[0].get("nombre", ""),
                "count": len(grp),
                "grade_ids": [x["id"] for x in grp],
            })

    # ── Duplicate sections (same grado_id + nombre) ──
    section_groups = {}
    for s in sections:
        key = (s.get("grado_id"), (s.get("nombre") or "").strip().lower())
        section_groups.setdefault(key, []).append(s)

    duplicate_sections = []
    for (grado_id, _), grp in section_groups.items():
        if len(grp) <= 1:
            continue
        grade_doc = grades_by_id.get(grado_id, {})
        items = []
        for s in grp:
            sid = s["id"]
            student_count = await _count_students_in_section(school_id, sid)
            subject_count = await db.subjects.count_documents({"school_id": school_id, "section_id": sid})
            assignment_count = await db.academic_assignments.count_documents({"school_id": school_id, "section_id": sid})
            items.append({
                "section_id": sid,
                "nombre": s.get("nombre", ""),
                "student_count": student_count,
                "subject_count": subject_count,
                "assignment_count": assignment_count,
            })
        # Sort so the section with the most students (likely canonical) is first.
        items.sort(key=lambda x: -x["student_count"])
        duplicate_sections.append({
            "grado_id": grado_id,
            "grade_name": grade_doc.get("nombre", ""),
            "level_name": levels.get(grade_doc.get("nivel_id"), ""),
            "nombre": grp[0].get("nombre", ""),
            "count": len(grp),
            "sections": items,
        })

    duplicate_sections.sort(key=lambda x: (x["level_name"], x["grade_name"], x["nombre"]))

    return {
        "school_id": school_id,
        "has_duplicates": bool(duplicate_grades or duplicate_sections),
        "duplicate_grades": duplicate_grades,
        "duplicate_sections": duplicate_sections,
        "summary": {
            "duplicate_grade_groups": len(duplicate_grades),
            "duplicate_section_groups": len(duplicate_sections),
        },
    }
