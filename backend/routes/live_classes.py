"""
Live classes module
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
)

import jwt
import time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# LIVE CLASSES MODULE
# ══════════════════════════════════════════════════════════════════════════════

class LiveClassCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    subject_id: str
    section_id: str
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    meeting_link: str
    platform: str = "meet"  # meet / zoom / otro

class LiveClassUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    meeting_link: Optional[str] = None
    platform: Optional[str] = None

def sanitize_meeting_link(link: str) -> str:
    """Basic sanitization for meeting links."""
    link = link.strip()
    if not link.startswith(("https://", "http://")):
        link = "https://" + link
    return link

def compute_class_status(date_str: str, start_time: str, end_time: str) -> str:
    """Compute class status based on current Peru time."""
    now = datetime.now(PERU_TZ)
    try:
        class_start = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M").replace(tzinfo=PERU_TZ)
        class_end = datetime.strptime(f"{date_str} {end_time}", "%Y-%m-%d %H:%M").replace(tzinfo=PERU_TZ)
    except ValueError:
        return "scheduled"
    if now < class_start:
        return "scheduled"
    elif now <= class_end:
        return "active"
    else:
        return "finished"

@router.post("/live-classes")
async def create_live_class(data: LiveClassCreate, current_user=Depends(get_current_user)):
    """Create a new live class. Teacher or admin."""
    user = await resolve_user_from_token(current_user)
    allowed_roles = ("teacher", "owner", "admin", "director", "coordinator")
    if not user or user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear clases en vivo")
    school_id = user.get("school_id")
    # Verify assignment exists for this subject+section (skip for admins)
    if user.get("role") == "teacher":
        assignment = await db.academic_assignments.find_one({
            "school_id": school_id,
            "teacher_id": user["id"],
            "subject_id": data.subject_id,
            "section_id": data.section_id
        })
        if not assignment:
            raise HTTPException(status_code=403, detail="No tienes asignación para este curso/sección")
    else:
        assignment = await db.academic_assignments.find_one({
            "school_id": school_id,
            "subject_id": data.subject_id,
            "section_id": data.section_id
        })
        if not assignment:
            raise HTTPException(status_code=404, detail="No existe asignación para este curso/sección")
    # Validate times
    try:
        start_dt = datetime.strptime(data.start_time, "%H:%M")
        end_dt = datetime.strptime(data.end_time, "%H:%M")
        if start_dt >= end_dt:
            raise HTTPException(status_code=400, detail="La hora de inicio debe ser menor que la hora de fin")
        datetime.strptime(data.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha/hora inválido")
    sanitized_link = sanitize_meeting_link(data.meeting_link)
    now_iso = datetime.now(timezone.utc).isoformat()
    live_class = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "title": data.title.strip(),
        "description": (data.description or "").strip(),
        "subject_id": data.subject_id,
        "section_id": data.section_id,
        "teacher_id": assignment.get("teacher_id", user["id"]),
        "date": data.date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "meeting_link": sanitized_link,
        "platform": data.platform,
        "status": "scheduled",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.live_classes.insert_one(live_class)
    live_class.pop("_id", None)
    live_class["status"] = compute_class_status(data.date, data.start_time, data.end_time)
    return live_class

@router.get("/live-classes")
async def get_live_classes(current_user=Depends(get_current_user)):
    """Get live classes based on role."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    school_id = user.get("school_id")
    role = user.get("role")

    if role == "teacher":
        classes = await db.live_classes.find(
            {"school_id": school_id, "teacher_id": user["id"]}, {"_id": 0}
        ).sort("date", -1).to_list(200)
    elif role == "student":
        seccion_id = user.get("seccion_id")
        if not seccion_id:
            return {"classes": []}
        assignments = await db.academic_assignments.find(
            {"school_id": school_id, "section_id": seccion_id}, {"_id": 0}
        ).to_list(100)
        subject_ids = list(set(a.get("subject_id") for a in assignments if a.get("subject_id")))
        if not subject_ids:
            return {"classes": []}
        classes = await db.live_classes.find(
            {"school_id": school_id, "section_id": seccion_id, "subject_id": {"$in": subject_ids}}, {"_id": 0}
        ).sort("date", -1).to_list(200)
    elif role in ("owner", "admin", "director", "coordinator"):
        classes = await db.live_classes.find(
            {"school_id": school_id}, {"_id": 0}
        ).sort("date", -1).to_list(500)
    else:
        return {"classes": []}

    # Enrich with computed status & teacher/subject names
    for c in classes:
        c["status"] = compute_class_status(c.get("date", ""), c.get("start_time", ""), c.get("end_time", ""))
        # Fetch teacher name
        teacher = await db.users.find_one({"id": c.get("teacher_id"), "school_id": school_id}, {"_id": 0, "name": 1, "last_name": 1})
        c["teacher_name"] = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() if teacher else "Profesor"
        # Fetch subject name
        subject = await db.subjects.find_one({"id": c.get("subject_id"), "school_id": school_id}, {"_id": 0, "name": 1})
        c["subject_name"] = subject.get("name", "Curso") if subject else "Curso"
        # Fetch section info
        section = await db.sections.find_one({"id": c.get("section_id"), "school_id": school_id}, {"_id": 0, "nombre": 1})
        c["section_name"] = section.get("nombre", "") if section else ""
        # Attendance count
        c["attendance_count"] = await db.live_class_attendance.count_documents({"class_id": c["id"]})

    return {"classes": classes}

@router.get("/live-classes/{class_id}")
async def get_live_class_detail(class_id: str, current_user=Depends(get_current_user)):
    """Get a single live class detail."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    school_id = user.get("school_id")
    lc = await db.live_classes.find_one({"id": class_id, "school_id": school_id}, {"_id": 0})
    if not lc:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    lc["status"] = compute_class_status(lc.get("date", ""), lc.get("start_time", ""), lc.get("end_time", ""))
    return lc

@router.put("/live-classes/{class_id}")
async def update_live_class(class_id: str, data: LiveClassUpdate, current_user=Depends(get_current_user)):
    """Update a live class. Teacher owner or admin."""
    user = await resolve_user_from_token(current_user)
    allowed_roles = ("teacher", "owner", "admin", "director", "coordinator")
    if not user or user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar clases")
    school_id = user.get("school_id")
    query = {"id": class_id, "school_id": school_id}
    if user.get("role") == "teacher":
        query["teacher_id"] = user["id"]
    lc = await db.live_classes.find_one(query)
    if not lc:
        raise HTTPException(status_code=404, detail="Clase no encontrada o no eres el profesor asignado")
    update_fields = {}
    for field in ["title", "description", "date", "start_time", "end_time", "platform"]:
        val = getattr(data, field, None)
        if val is not None:
            update_fields[field] = val.strip() if isinstance(val, str) else val
    if data.meeting_link is not None:
        update_fields["meeting_link"] = sanitize_meeting_link(data.meeting_link)
    if data.start_time and data.end_time:
        try:
            if datetime.strptime(data.start_time, "%H:%M") >= datetime.strptime(data.end_time, "%H:%M"):
                raise HTTPException(status_code=400, detail="La hora de inicio debe ser menor que la hora de fin")
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de hora inválido")
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.live_classes.update_one({"id": class_id}, {"$set": update_fields})
    updated = await db.live_classes.find_one({"id": class_id}, {"_id": 0})
    updated["status"] = compute_class_status(updated.get("date", ""), updated.get("start_time", ""), updated.get("end_time", ""))
    return updated

@router.delete("/live-classes/{class_id}")
async def delete_live_class(class_id: str, current_user=Depends(get_current_user)):
    """Delete a live class. Teacher owner or admin."""
    user = await resolve_user_from_token(current_user)
    allowed_roles = ("teacher", "owner", "admin", "director", "coordinator")
    if not user or user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar clases")
    school_id = user.get("school_id")
    query = {"id": class_id, "school_id": school_id}
    if user.get("role") == "teacher":
        query["teacher_id"] = user["id"]
    result = await db.live_classes.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    await db.live_class_attendance.delete_many({"class_id": class_id})
    return {"message": "Clase eliminada correctamente"}

@router.post("/live-classes/{class_id}/join")
async def join_live_class(class_id: str, current_user=Depends(get_current_user)):
    """Student joins a live class. Records attendance and returns meeting link."""
    user = await resolve_user_from_token(current_user)
    if not user or user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Solo estudiantes pueden unirse a clases")
    school_id = user.get("school_id")
    lc = await db.live_classes.find_one({"id": class_id, "school_id": school_id}, {"_id": 0})
    if not lc:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    # Verify student is in the correct section
    if user.get("seccion_id") != lc.get("section_id"):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta clase")
    # Check if class is accessible (start_time - 10 min)
    now = datetime.now(PERU_TZ)
    try:
        class_start = datetime.strptime(f"{lc['date']} {lc['start_time']}", "%Y-%m-%d %H:%M").replace(tzinfo=PERU_TZ)
        class_end = datetime.strptime(f"{lc['date']} {lc['end_time']}", "%Y-%m-%d %H:%M").replace(tzinfo=PERU_TZ)
    except ValueError:
        raise HTTPException(status_code=400, detail="Error en formato de fecha/hora de la clase")
    early_access = class_start - timedelta(minutes=10)
    if now < early_access:
        raise HTTPException(status_code=400, detail="La clase aún no está disponible. Podrás entrar 10 minutos antes del inicio.")
    if now > class_end:
        raise HTTPException(status_code=400, detail="La clase ya ha finalizado")
    # Check existing attendance
    existing = await db.live_class_attendance.find_one({"class_id": class_id, "student_id": user["id"]})
    if not existing:
        attendance = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "class_id": class_id,
            "student_id": user["id"],
            "status": "present",
            "join_time": now.strftime("%H:%M"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.live_class_attendance.insert_one(attendance)
    return {"meeting_link": lc.get("meeting_link"), "message": "Asistencia registrada"}

@router.get("/live-classes/{class_id}/attendance")
async def get_live_class_attendance(class_id: str, current_user=Depends(get_current_user)):
    """Get attendance list for a live class. Teacher only."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    school_id = user.get("school_id")
    # Verify the class belongs to the teacher's school
    lc = await db.live_classes.find_one({"id": class_id, "school_id": school_id}, {"_id": 0})
    if not lc:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    records = await db.live_class_attendance.find(
        {"class_id": class_id}, {"_id": 0}
    ).to_list(500)
    # Enrich with student names
    for r in records:
        student = await db.users.find_one({"id": r.get("student_id"), "school_id": school_id}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
        if student:
            r["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
            r["student_photo"] = student.get("photo_url")
        else:
            r["student_name"] = "Alumno"
            r["student_photo"] = None
    return {"attendance": records, "class_info": lc}
