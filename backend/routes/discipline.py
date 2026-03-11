"""
Discipline reports module
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
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# DISCIPLINE MODULE - REPORTES DISCIPLINARIOS
# ══════════════════════════════════════════════════════════════════════════════

DISCIPLINE_PRIORITIES = {
    "low": {"label": "Baja", "color": "#22C55E"},
    "medium": {"label": "Media", "color": "#EAB308"},
    "high": {"label": "Alta", "color": "#F97316"},
    "critical": {"label": "Crítica", "color": "#EF4444"}
}

DISCIPLINE_STATUSES = {
    "open": {"label": "Abierto", "color": "#3B82F6"},
    "in_review": {"label": "En revisión", "color": "#8B5CF6"},
    "resolved": {"label": "Resuelto", "color": "#22C55E"},
    "archived": {"label": "Archivado", "color": "#64748B"}
}

class DisciplineAttachment(BaseModel):
    url: str
    type: Literal["image", "pdf", "doc", "other"] = "other"
    filename: Optional[str] = None

class DisciplineReportCreate(BaseModel):
    student_id: str
    grade_id: str
    section_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    incident_date: str  # ISO date string
    attachments: Optional[List[DisciplineAttachment]] = []

class DisciplineReportUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    priority: Optional[Literal["low", "medium", "high", "critical"]] = None
    incident_date: Optional[str] = None
    attachments: Optional[List[DisciplineAttachment]] = None

class DisciplineStatusUpdate(BaseModel):
    status: Literal["open", "in_review", "resolved", "archived"]

@router.get("/discipline")
async def get_discipline_reports(
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    student_id: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get discipline reports with filters.
    - Professors can only see reports they created
    - Directors/Admins can see all reports
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    # Build query
    query = {"school_id": school_id}
    
    # Professors can only see their own reports
    if not is_admin:
        query["created_by"] = user["id"]
    
    # Apply filters
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    if student_id:
        query["student_id"] = student_id
    if priority:
        query["priority"] = priority
    if status:
        query["status"] = status
    if date_from:
        query["incident_date"] = {"$gte": date_from}
    if date_to:
        if "incident_date" in query:
            query["incident_date"]["$lte"] = date_to
        else:
            query["incident_date"] = {"$lte": date_to}
    
    reports_cursor = db.discipline_reports.find(query, {"_id": 0}).sort("created_at", -1)
    reports = await reports_cursor.to_list(500)
    
    # Enrich reports with student, grade, section names
    students_cache = {}
    grades_cache = {}
    sections_cache = {}
    creators_cache = {}
    
    for report in reports:
        # Get student info
        if report["student_id"] not in students_cache:
            student = await db.users.find_one({"id": report["student_id"]}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
            students_cache[report["student_id"]] = student
        student_info = students_cache[report["student_id"]]
        report["student_name"] = f"{student_info.get('name', '')} {student_info.get('last_name', '')}".strip() if student_info else "Desconocido"
        report["student_photo"] = student_info.get("photo_url") if student_info else None
        
        # Get grade info
        if report["grade_id"] not in grades_cache:
            grade = await db.grades.find_one({"id": report["grade_id"]}, {"_id": 0, "nombre": 1})
            grades_cache[report["grade_id"]] = grade
        grade_info = grades_cache[report["grade_id"]]
        report["grade_name"] = grade_info.get("nombre") if grade_info else "Sin grado"
        
        # Get section info
        if report["section_id"] not in sections_cache:
            section = await db.sections.find_one({"id": report["section_id"]}, {"_id": 0, "nombre": 1})
            sections_cache[report["section_id"]] = section
        section_info = sections_cache[report["section_id"]]
        report["section_name"] = section_info.get("nombre") if section_info else "Sin sección"
        
        # Get creator info
        if report["created_by"] not in creators_cache:
            creator = await db.users.find_one({"id": report["created_by"]}, {"_id": 0, "name": 1, "last_name": 1})
            creators_cache[report["created_by"]] = creator
        creator_info = creators_cache[report["created_by"]]
        report["created_by_name"] = f"{creator_info.get('name', '')} {creator_info.get('last_name', '')}".strip() if creator_info else "Desconocido"
        
        # Add labels
        report["priority_label"] = DISCIPLINE_PRIORITIES.get(report.get("priority", ""), {}).get("label", report.get("priority", ""))
        report["priority_color"] = DISCIPLINE_PRIORITIES.get(report.get("priority", ""), {}).get("color", "#64748B")
        report["status_label"] = DISCIPLINE_STATUSES.get(report.get("status", ""), {}).get("label", report.get("status", ""))
        report["status_color"] = DISCIPLINE_STATUSES.get(report.get("status", ""), {}).get("color", "#64748B")
    
    return reports

@router.get("/discipline/{report_id}")
async def get_discipline_report(report_id: str, current_user = Depends(get_current_user)):
    """Get a single discipline report by ID"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    report = await db.discipline_reports.find_one({"id": report_id, "school_id": school_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    # Check permissions
    if not is_admin and report["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este reporte")
    
    # Enrich with names
    student = await db.users.find_one({"id": report["student_id"]}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
    report["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Desconocido"
    report["student_photo"] = student.get("photo_url") if student else None
    
    grade = await db.grades.find_one({"id": report["grade_id"]}, {"_id": 0, "nombre": 1})
    report["grade_name"] = grade.get("nombre") if grade else "Sin grado"
    
    section = await db.sections.find_one({"id": report["section_id"]}, {"_id": 0, "nombre": 1})
    report["section_name"] = section.get("nombre") if section else "Sin sección"
    
    creator = await db.users.find_one({"id": report["created_by"]}, {"_id": 0, "name": 1, "last_name": 1})
    report["created_by_name"] = f"{creator.get('name', '')} {creator.get('last_name', '')}".strip() if creator else "Desconocido"
    
    if report.get("reviewed_by"):
        reviewer = await db.users.find_one({"id": report["reviewed_by"]}, {"_id": 0, "name": 1, "last_name": 1})
        report["reviewed_by_name"] = f"{reviewer.get('name', '')} {reviewer.get('last_name', '')}".strip() if reviewer else None
    
    # Add labels
    report["priority_label"] = DISCIPLINE_PRIORITIES.get(report.get("priority", ""), {}).get("label", "")
    report["priority_color"] = DISCIPLINE_PRIORITIES.get(report.get("priority", ""), {}).get("color", "#64748B")
    report["status_label"] = DISCIPLINE_STATUSES.get(report.get("status", ""), {}).get("label", "")
    report["status_color"] = DISCIPLINE_STATUSES.get(report.get("status", ""), {}).get("color", "#64748B")
    
    return report

@router.post("/discipline")
async def create_discipline_report(data: DisciplineReportCreate, current_user = Depends(get_current_user)):
    """
    Create a new discipline report.
    Teachers, Directors, and Admins can create reports.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Only teachers, directors, admins can create
    if user.get("role") not in ["owner", "admin", "director", "teacher"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear reportes disciplinarios")
    
    school_id = user["school_id"]
    
    # Verify student exists and belongs to same school
    student = await db.users.find_one({"id": data.student_id, "school_id": school_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=400, detail="Estudiante no encontrado")
    
    # Verify grade exists
    grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
    if not grade:
        raise HTTPException(status_code=400, detail="Grado no encontrado")
    
    # Verify section exists
    section = await db.sections.find_one({"id": data.section_id, "school_id": school_id})
    if not section:
        raise HTTPException(status_code=400, detail="Sección no encontrada")
    
    # Create report
    report = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "student_id": data.student_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "title": data.title.strip(),
        "description": data.description.strip(),
        "priority": data.priority,
        "status": "open",
        "incident_date": data.incident_date,
        "created_by": user["id"],
        "reviewed_by": None,
        "attachments": [att.model_dump() for att in data.attachments] if data.attachments else [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.discipline_reports.insert_one(report)
    report.pop("_id", None)
    
    # Enrich response
    report["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
    report["grade_name"] = grade.get("nombre")
    report["section_name"] = section.get("nombre")
    report["created_by_name"] = f"{user.get('name', '')} {user.get('last_name', '')}".strip()
    report["priority_label"] = DISCIPLINE_PRIORITIES.get(data.priority, {}).get("label", "")
    report["priority_color"] = DISCIPLINE_PRIORITIES.get(data.priority, {}).get("color", "#64748B")
    report["status_label"] = DISCIPLINE_STATUSES.get("open", {}).get("label", "")
    report["status_color"] = DISCIPLINE_STATUSES.get("open", {}).get("color", "#64748B")
    
    logger.info(f"Discipline report created: {report['id']} by {user['id']}")
    
    return {"message": "Reporte disciplinario creado correctamente", "report": report}

@router.put("/discipline/{report_id}")
async def update_discipline_report(report_id: str, data: DisciplineReportUpdate, current_user = Depends(get_current_user)):
    """
    Update a discipline report.
    - Professors can only edit their own open reports
    - Directors/Admins can edit any non-resolved report
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    report = await db.discipline_reports.find_one({"id": report_id, "school_id": school_id})
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    # Check permissions
    if not is_admin:
        if report["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Solo puedes editar tus propios reportes")
        if report["status"] != "open":
            raise HTTPException(status_code=400, detail="Solo puedes editar reportes abiertos")
    else:
        if report["status"] == "resolved":
            raise HTTPException(status_code=400, detail="No se puede editar un reporte resuelto")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.description is not None:
        update_data["description"] = data.description.strip()
    if data.priority is not None:
        update_data["priority"] = data.priority
    if data.incident_date is not None:
        update_data["incident_date"] = data.incident_date
    if data.attachments is not None:
        update_data["attachments"] = [att.model_dump() for att in data.attachments]
    
    await db.discipline_reports.update_one({"id": report_id}, {"$set": update_data})
    
    # Get updated report
    updated_report = await db.discipline_reports.find_one({"id": report_id}, {"_id": 0})
    
    logger.info(f"Discipline report updated: {report_id} by {user['id']}")
    
    return {"message": "Reporte actualizado correctamente", "report": updated_report}

@router.put("/discipline/{report_id}/status")
async def update_discipline_status(report_id: str, data: DisciplineStatusUpdate, current_user = Depends(get_current_user)):
    """
    Change the status of a discipline report.
    Only Directors and Admins can change status.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Only admin/director can change status
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo directores y administradores pueden cambiar el estado")
    
    school_id = user["school_id"]
    
    report = await db.discipline_reports.find_one({"id": report_id, "school_id": school_id})
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    # Update status and reviewer
    update_data = {
        "status": data.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Set reviewer if moving to in_review or resolved
    if data.status in ["in_review", "resolved"] and not report.get("reviewed_by"):
        update_data["reviewed_by"] = user["id"]
    
    await db.discipline_reports.update_one({"id": report_id}, {"$set": update_data})
    
    logger.info(f"Discipline report status changed: {report_id} -> {data.status} by {user['id']}")
    
    return {
        "message": f"Estado actualizado a '{DISCIPLINE_STATUSES.get(data.status, {}).get('label', data.status)}'",
        "status": data.status,
        "status_label": DISCIPLINE_STATUSES.get(data.status, {}).get("label", ""),
        "status_color": DISCIPLINE_STATUSES.get(data.status, {}).get("color", "#64748B")
    }

@router.delete("/discipline/{report_id}")
async def delete_discipline_report(report_id: str, current_user = Depends(get_current_user)):
    """
    Delete a discipline report.
    Only Admins can delete reports.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Only admin can delete
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar reportes")
    
    school_id = user["school_id"]
    
    result = await db.discipline_reports.delete_one({"id": report_id, "school_id": school_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    logger.info(f"Discipline report deleted: {report_id} by {user['id']}")
    
    return {"message": "Reporte eliminado correctamente"}

@router.get("/discipline/stats/summary")
async def get_discipline_stats(current_user = Depends(get_current_user)):
    """Get summary statistics for discipline reports"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Count by status
    total = await db.discipline_reports.count_documents({"school_id": school_id})
    open_count = await db.discipline_reports.count_documents({"school_id": school_id, "status": "open"})
    in_review = await db.discipline_reports.count_documents({"school_id": school_id, "status": "in_review"})
    resolved = await db.discipline_reports.count_documents({"school_id": school_id, "status": "resolved"})
    archived = await db.discipline_reports.count_documents({"school_id": school_id, "status": "archived"})
    
    # Count by priority
    critical = await db.discipline_reports.count_documents({"school_id": school_id, "priority": "critical"})
    high = await db.discipline_reports.count_documents({"school_id": school_id, "priority": "high"})
    medium = await db.discipline_reports.count_documents({"school_id": school_id, "priority": "medium"})
    low = await db.discipline_reports.count_documents({"school_id": school_id, "priority": "low"})
    
    return {
        "total": total,
        "by_status": {
            "open": open_count,
            "in_review": in_review,
            "resolved": resolved,
            "archived": archived
        },
        "by_priority": {
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low
        }
    }

# ══════════════════════════════════════════════════════════════════════════════

