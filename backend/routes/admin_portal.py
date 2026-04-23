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
)

import jwt
import io
from fastapi.responses import StreamingResponse
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
@router.post("/course/tasks/{task_id}/submit")
async def submit_task(
    task_id: str,
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user = Depends(get_current_user)
):
    """Submit a task as a student."""
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
            # Parse due date and compare with current time
            if isinstance(due_date, str):
                deadline = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            else:
                deadline = due_date
            
            now = datetime.now(timezone.utc)
            
            # Check if task allows late submissions
            allow_late = task.get("metadata", {}).get("allow_late_submissions", False)
            
            if deadline < now and not allow_late:
                raise HTTPException(
                    status_code=400, 
                    detail="El plazo para entregar esta tarea ha vencido. No se permiten entregas tardías."
                )
        except (ValueError, TypeError):
            pass  # If date parsing fails, allow submission
    
    # Check if already submitted — allow replacing the existing
    # submission while the task is still open and NOT yet graded. This
    # lets students fix mistakes before the deadline. Once the teacher
    # assigns a grade, the submission is locked.
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
    
    # Validate that at least one of text or file is provided
    if not text_content and not file:
        raise HTTPException(status_code=400, detail="Debes proporcionar texto o archivo")
    
    # Handle file upload if provided
    file_url = None
    file_name = None
    file_type = None
    drive_file_id = None
    storage_type = None
    
    if file:
        # Read file content
        content = await file.read()
        file_name = file.filename
        file_type = file.content_type
        
        # Check if school has Google Drive connected
        school = await db.schools.find_one({"id": school_id}, {"_id": 0})
        use_google_drive = school and school.get("google_drive_connected")
        
        if use_google_drive:
            # Upload to Google Drive
            try:
                service = await get_drive_service(school_id)
                
                # Get or create submissions folder
                materials_folder_id = school.get("google_drive_materials_folder_id")
                if materials_folder_id:
                    # Create a subfolder for submissions if it doesn't exist
                    submissions_folder_query = f"name='Entregas' and '{materials_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
                    results = service.files().list(q=submissions_folder_query, fields="files(id)").execute()
                    submissions_folders = results.get('files', [])
                    
                    if submissions_folders:
                        submissions_folder_id = submissions_folders[0]['id']
                    else:
                        # Create submissions folder
                        folder_metadata = {
                            'name': 'Entregas',
                            'mimeType': 'application/vnd.google-apps.folder',
                            'parents': [materials_folder_id]
                        }
                        folder = service.files().create(body=folder_metadata, fields='id').execute()
                        submissions_folder_id = folder.get('id')
                    
                    # Upload file to Drive
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
                    
                    drive_file_id = drive_file.get('id')
                    storage_type = 'google_drive'
                    logger.info(f"Student submission uploaded to Drive: {file_name} for task {task_id}")
                else:
                    raise Exception("No materials folder configured")
                    
            except Exception as e:
                logger.warning(f"Failed to upload to Drive, falling back to Cloudinary: {e}")
                use_google_drive = False
        
        # Fallback to Cloudinary if Drive is not available or failed
        if not use_google_drive or not drive_file_id:
            try:
                import cloudinary.uploader
                result = cloudinary.uploader.upload(
                    content,
                    folder=f"edunet/submissions/{task_id}",
                    resource_type="auto",
                    public_id=f"{student_id}_{file_name}"
                )
                file_url = result.get("secure_url")
                storage_type = 'cloudinary'
            except Exception as e:
                logger.error(f"Cloudinary upload failed: {e}")
                raise HTTPException(status_code=500, detail="Error al subir el archivo")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create submission object — reuse the previous submission id when
    # replacing so that any download links remembered by the student
    # (and the auditable history kept by the teacher's view) stay
    # stable.
    submission = {
        "id": (existing_submission or {}).get("id") or str(uuid.uuid4()),
        "student_id": student_id,
        "student_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "text_content": text_content,
        "file_url": file_url,
        "file_name": file_name,
        "file_type": file_type,
        "drive_file_id": drive_file_id,
        "storage_type": storage_type,
        "submitted_at": now,
        "grade": None,
        "feedback": None
    }
    
    # Add or replace submission in the embedded array.
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
        "storage_type": storage_type,
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
    current_user = Depends(get_current_user)
):
    """Download a student's submission file (works with both Google Drive and Cloudinary)."""
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
    
    # Check if user has permission (admin/teacher or the student who submitted)
    is_admin = is_admin_user(user)
    is_owner = submission.get("student_id") == user.get("id")
    
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="No tienes permiso para descargar este archivo")
    
    # Check storage type
    storage_type = submission.get("storage_type")
    drive_file_id = submission.get("drive_file_id")
    file_url = submission.get("file_url")
    file_name = submission.get("file_name", "archivo")
    
    if storage_type == "google_drive" and drive_file_id:
        # Download from Google Drive
        try:
            service = await get_drive_service(school_id)
            
            # Get file metadata
            file_metadata = service.files().get(fileId=drive_file_id, fields='mimeType, size').execute()
            mime_type = file_metadata.get('mimeType', 'application/octet-stream')
            
            # Stream the file
            request = service.files().get_media(fileId=drive_file_id)
            
            def generate():
                downloader = MediaIoBaseDownload(io.BytesIO(), request, chunksize=1024*1024)
                fh = io.BytesIO()
                downloader = MediaIoBaseDownload(fh, request)
                done = False
                while not done:
                    status, done = downloader.next_chunk()
                    if status:
                        fh.seek(0)
                        yield fh.read()
                        fh.seek(0)
                        fh.truncate()
                fh.seek(0)
                yield fh.read()
            
            return StreamingResponse(
                generate(),
                media_type=mime_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{file_name}"'
                }
            )
        except Exception as e:
            logger.error(f"Error downloading from Drive: {e}")
            raise HTTPException(status_code=500, detail="Error al descargar desde Google Drive")
    
    elif file_url:
        # Redirect to Cloudinary URL or return the URL
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=file_url)
    
    else:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")


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

