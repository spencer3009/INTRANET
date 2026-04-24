"""
Attendance module: student, teacher, reports, entry/exit, QR
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
from services.qr_service import generate_user_qr

try:
    from .notifications import send_attendance_notification
except Exception:
    async def send_attendance_notification(*args, **kwargs):
        pass

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# ══════════════════════════════════════════════════════════════════════════════
# HELPER: Normalize ID for flexible MongoDB queries (String or ObjectId)
# ══════════════════════════════════════════════════════════════════════════════

from bson import ObjectId

def flexible_id_filter(field: str, value: str) -> dict:
    """Build a MongoDB filter that matches both String and ObjectId versions of an ID."""
    if not value:
        return {}
    try:
        oid = ObjectId(value)
        return {field: {"$in": [value, oid]}}
    except Exception:
        return {field: value}


# ══════════════════════════════════════════════════════════════════════════════
# HELPER: Effective teacher schedule (per-level override or global)
# ══════════════════════════════════════════════════════════════════════════════

async def get_horario_efectivo_docente(teacher_id: str, school_id: str) -> dict:
    """Return the effective entry_time/exit_time for a teacher.

    Resolution order:
      1. Load `schools.attendance_config.teachers`.
      2. If `horario_por_nivel_activo` is False → return the global times.
      3. If True → pick the teacher's dominant nivel_id from
         `academic_assignments` (the nivel with the most assignments;
         ties broken alphabetically by nivel_id).
         a. If the teacher has no assignments → fallback to global.
         b. Look up `horario_por_nivel[nivel_id]`. If the override has an
            `entry_time`/`exit_time` field it is used; otherwise that field
            inherits the global value.

    Returns:
        {
            "entry_time": "HH:MM",
            "exit_time": "HH:MM",
            "source": "global" | "level",
            "nivel_id": Optional[str],
        }
    """
    school = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "attendance_config": 1}
    )
    attendance_config = (school or {}).get("attendance_config", {}) or {}
    teachers_cfg = attendance_config.get("teachers", {}) or {}

    global_entry = teachers_cfg.get("entry_time", "07:15")
    global_exit = teachers_cfg.get("exit_time", "13:00")
    default_result = {
        "entry_time": global_entry,
        "exit_time": global_exit,
        "source": "global",
        "nivel_id": None,
    }

    if not teachers_cfg.get("horario_por_nivel_activo"):
        return default_result

    overrides = teachers_cfg.get("horario_por_nivel") or {}
    if not overrides:
        return default_result

    # Count assignments per nivel_id for this teacher
    pipeline = [
        {"$match": {"teacher_id": teacher_id, "school_id": school_id}},
        {"$group": {"_id": "$nivel_id", "count": {"$sum": 1}}},
    ]
    try:
        counts = await db.academic_assignments.aggregate(pipeline).to_list(50)
    except Exception:
        counts = []

    counts = [c for c in counts if c.get("_id")]
    if not counts:
        return default_result

    # Pick dominant nivel: most assignments, then lexicographic tie-break
    counts.sort(key=lambda c: (-c["count"], str(c["_id"])))
    dominant_nivel_id = counts[0]["_id"]

    override = overrides.get(dominant_nivel_id) or {}
    entry = override.get("entry_time") or global_entry
    exit_ = override.get("exit_time") or global_exit
    return {
        "entry_time": entry,
        "exit_time": exit_,
        "source": "level" if (override.get("entry_time") or override.get("exit_time")) else "global",
        "nivel_id": dominant_nivel_id,
    }


# ATTENDANCE MODULE
# ══════════════════════════════════════════════════════════════════════════════

class AttendanceRecord(BaseModel):
    """Single attendance record for batch save"""
    user_id: str
    status: Literal["present", "late", "absent", "justified"]
    justification_reason: Optional[str] = None
    justification_note: Optional[str] = None

JUSTIFICATION_REASONS = {
    "salud": "Salud / Enfermedad",
    "permiso_familiar": "Permiso familiar",
    "tramite": "Trámite personal",
    "duelo": "Duelo familiar",
    "viaje": "Viaje",
    "otro": "Otro",
}

class AttendanceBatchSave(BaseModel):
    """Batch save attendance records"""
    date: str  # ISO date string (YYYY-MM-DD)
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    records: List[AttendanceRecord]

class TeacherAttendanceSave(BaseModel):
    """Save teacher attendance"""
    date: str
    records: List[AttendanceRecord]

# ─────────────────────────────────────────────────────────────────────────────
# STUDENT ATTENDANCE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/attendance/students")
async def get_students_for_attendance(
    grade_id: str,
    section_id: str,
    date: str,
    current_user = Depends(get_current_user)
):
    """
    Get students for a specific grade/section with their attendance status for the given date.
    If no attendance exists for that date, returns students with default status 'present'.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    logger.info(f"=== DEBUG ATTENDANCE ===")
    logger.info(f"Received params - grade_id: {grade_id} (type: {type(grade_id).__name__})")
    logger.info(f"Received params - section_id: {section_id} (type: {type(section_id).__name__})")
    logger.info(f"Received params - school_id: {school_id} (type: {type(school_id).__name__})")
    
    # Build flexible query that handles both String and ObjectId types
    student_query = {
        "role": "student",
        **ACADEMIC_STUDENT_FILTER
    }
    student_query.update(flexible_id_filter("school_id", school_id))
    student_query.update(flexible_id_filter("grado_id", grade_id))
    student_query.update(flexible_id_filter("seccion_id", section_id))
    
    logger.info(f"MongoDB student_query: {student_query}")
    
    # Get students for this grade/section (exclude pending)
    students_cursor = db.users.find(
        student_query,
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    students = await students_cursor.to_list(length=500)
    
    logger.info(f"Students found: {len(students)}")
    
    # If 0 students, run diagnostic queries
    if len(students) == 0:
        total_in_school = await db.users.count_documents({"school_id": school_id, "role": "student"})
        logger.info(f"DIAG: Total students in school (exact school_id match): {total_in_school}")
        
        # Try without ACADEMIC_STUDENT_FILTER
        diag_q = {"role": "student"}
        diag_q.update(flexible_id_filter("school_id", school_id))
        total_no_filter = await db.users.count_documents(diag_q)
        logger.info(f"DIAG: Total students in school (flexible, no status filter): {total_no_filter}")
        
        # Check with only grade
        diag_q2 = {"role": "student"}
        diag_q2.update(flexible_id_filter("school_id", school_id))
        diag_q2.update(flexible_id_filter("grado_id", grade_id))
        with_grade = await db.users.count_documents(diag_q2)
        logger.info(f"DIAG: Students matching school+grade: {with_grade}")
        
        # Check with only section
        diag_q3 = {"role": "student"}
        diag_q3.update(flexible_id_filter("school_id", school_id))
        diag_q3.update(flexible_id_filter("seccion_id", section_id))
        with_section = await db.users.count_documents(diag_q3)
        logger.info(f"DIAG: Students matching school+section: {with_section}")
        
        # Sample a student to see what fields they have
        sample = await db.users.find_one({"school_id": school_id, "role": "student"}, {"_id": 0, "grado_id": 1, "seccion_id": 1, "grade_id": 1, "section_id": 1, "student_status": 1, "name": 1})
        logger.info(f"DIAG: Sample student: {sample}")
        
        # Check student_status distribution
        pipeline = [
            {"$match": {"school_id": school_id, "role": "student"}},
            {"$group": {"_id": "$student_status", "count": {"$sum": 1}}}
        ]
        statuses = await db.users.aggregate(pipeline).to_list(10)
        logger.info(f"DIAG: Student status distribution: {statuses}")
    
    # Get existing attendance records for this date (also flexible)
    att_query = {
        "type": "student",
        "date": date
    }
    att_query.update(flexible_id_filter("school_id", school_id))
    att_query.update(flexible_id_filter("grade_id", grade_id))
    att_query.update(flexible_id_filter("section_id", section_id))
    
    attendance_cursor = db.attendances.find(att_query, {"_id": 0})
    attendance_records = await attendance_cursor.to_list(length=500)
    
    # Build attendance map
    attendance_map = {a["user_id"]: a for a in attendance_records}
    
    # Build result with attendance status
    result = []
    for s in students:
        attendance = attendance_map.get(s["id"])
        entry_time_str = None
        exit_time_str = None
        if attendance:
            entry_time_str = to_peru_hhmm(attendance.get("entry_time")) or attendance.get("check_in_time")
            exit_time_str = to_peru_hhmm(attendance.get("exit_time"))
        
        result.append({
            "id": s["id"],
            "name": s.get("name", ""),
            "last_name": s.get("last_name", ""),
            "full_name": f"{s.get('name', '')} {s.get('last_name', '')}".strip(),
            "photo_url": s.get("photo_url"),
            "email": s.get("email"),
            "status": attendance["status"] if attendance else "pending",
            "has_record": attendance is not None,
            "entry_time": entry_time_str,
            "exit_time": exit_time_str,
            "entry_method": attendance.get("entry_method") if attendance else None,
            "exit_method": attendance.get("exit_method") if attendance else None,
            "total_minutes": attendance.get("total_minutes") if attendance else None,
            "justification_reason": attendance.get("justification_reason") if attendance else None,
            "justification_note": attendance.get("justification_note") if attendance else None,
            "justified_by": attendance.get("justified_by") if attendance else None,
            "justified_by_name": attendance.get("justified_by_name") if attendance else None,
            "justified_at": attendance.get("justified_at") if attendance else None,
        })
    
    # Sort by name
    result.sort(key=lambda x: x["full_name"].lower())
    
    return {
        "date": date,
        "grade_id": grade_id,
        "section_id": section_id,
        "students": result,
        "total": len(result),
        "has_saved_records": len(attendance_records) > 0
    }

@router.post("/attendance/students/save")
async def save_student_attendance(data: AttendanceBatchSave, current_user = Depends(get_current_user)):
    """
    Save attendance records for students in batch.
    Creates or updates records for the specified date.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Use upsert instead of delete+insert to preserve entry_time/exit_time data
    for record in data.records:
        set_data = {
            "status": record.status,
            "grade_id": data.grade_id,
            "section_id": data.section_id,
            "recorded_by": current_user["sub"],
            "updated_at": now
        }
        # Persist justification data when status is justified
        if record.status == "justified" and record.justification_reason:
            if record.justification_reason not in JUSTIFICATION_REASONS:
                raise HTTPException(status_code=400, detail=f"Motivo de justificación inválido: {record.justification_reason}")
            if record.justification_note and len(record.justification_note) > 500:
                raise HTTPException(status_code=400, detail="La nota de justificación no puede exceder 500 caracteres")
            set_data["justification_reason"] = record.justification_reason
            set_data["justification_note"] = record.justification_note or ""
            set_data["justified_by"] = current_user["sub"]
            set_data["justified_at"] = now
        elif record.status != "justified":
            # Clear justification fields if status changed away from justified
            set_data["justification_reason"] = None
            set_data["justification_note"] = None
            set_data["justified_by"] = None
            set_data["justified_at"] = None

        await db.attendances.update_one(
            {
                "school_id": school_id,
                "type": "student",
                "user_id": record.user_id,
                "date": data.date
            },
            {
                "$set": set_data,
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "type": "student",
                    "user_id": record.user_id,
                    "date": data.date,
                    "created_at": now
                }
            },
            upsert=True
        )
    
    # Calculate summary
    summary = {"present": 0, "late": 0, "absent": 0}
    for r in data.records:
        if r.status in summary:
            summary[r.status] += 1
    
    logger.info(f"Student attendance saved for {data.date} by {current_user['sub']}: {len(data.records)} records")
    
    return {
        "message": "Asistencia guardada correctamente",
        "date": data.date,
        "total_records": len(data.records),
        "summary": summary
    }


# ─────────────────────────────────────────────────────────────────────────────
# JUSTIFY INDIVIDUAL ATTENDANCE RECORD
# ─────────────────────────────────────────────────────────────────────────────

class JustifyAttendanceRequest(BaseModel):
    student_id: str
    date: str
    justification_reason: str
    justification_note: Optional[str] = None

@router.post("/attendance/justify")
async def justify_attendance(data: JustifyAttendanceRequest, current_user=Depends(get_current_user)):
    """Mark a student's attendance as justified with reason and optional note."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No autorizado")
    if not is_admin_user(user) and user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="No tienes permisos para justificar asistencias")

    school_id = user["school_id"]

    if data.justification_reason not in JUSTIFICATION_REASONS:
        raise HTTPException(status_code=400, detail=f"Motivo inválido: {data.justification_reason}")
    if data.justification_note and len(data.justification_note) > 500:
        raise HTTPException(status_code=400, detail="La nota no puede exceder 500 caracteres")

    now = datetime.now(timezone.utc).isoformat()

    # Find the justified_by user name for display
    justified_by_name = user.get("name", "")
    if user.get("last_name"):
        justified_by_name = f"{user['name']} {user['last_name']}"

    # Get student info for grade_id and section_id
    student = await db.users.find_one(
        {"id": data.student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "grado_id": 1, "seccion_id": 1}
    )
    student_grade_id = student.get("grado_id") if student else None
    student_section_id = student.get("seccion_id") if student else None

    # Check if record exists to determine if we need to set grade_id/section_id
    existing_record = await db.attendances.find_one({
        "school_id": school_id,
        "user_id": data.student_id,
        "date": data.date,
        "type": "student"
    })

    set_data = {
        "status": "justified",
        "justification_reason": data.justification_reason,
        "justification_note": data.justification_note or "",
        "justified_by": current_user["sub"],
        "justified_by_name": justified_by_name,
        "justified_at": now,
        "updated_at": now
    }

    # If record exists but doesn't have grade_id/section_id, add them
    if existing_record:
        if not existing_record.get("grade_id"):
            set_data["grade_id"] = student_grade_id
        if not existing_record.get("section_id"):
            set_data["section_id"] = student_section_id

    result = await db.attendances.update_one(
        {
            "school_id": school_id,
            "user_id": data.student_id,
            "date": data.date,
            "type": "student"
        },
        {
            "$set": set_data,
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "type": "student",
                "user_id": data.student_id,
                "date": data.date,
                "grade_id": student_grade_id,
                "section_id": student_section_id,
                "created_at": now
            }
        },
        upsert=True
    )

    logger.info(f"Attendance justified: student={data.student_id}, date={data.date}, reason={data.justification_reason}, by={current_user['sub']}")

    return {
        "message": "Justificación registrada correctamente",
        "justification_reason": data.justification_reason,
        "justification_reason_label": JUSTIFICATION_REASONS[data.justification_reason],
        "justification_note": data.justification_note or "",
        "justified_by": current_user["sub"],
        "justified_by_name": justified_by_name,
        "justified_at": now
    }

@router.get("/attendance/justification-reasons")
async def get_justification_reasons():
    """Return the list of valid justification reasons."""
    return {"reasons": [{"id": k, "label": v} for k, v in JUSTIFICATION_REASONS.items()]}


@router.get("/attendance/students/history")
async def get_student_attendance_history(
    student_id: str,
    start_date: str,
    end_date: str,
    current_user = Depends(get_current_user)
):
    """Get attendance history for a specific student within a date range."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Get attendance records
    records_cursor = db.attendances.find(
        {
            "school_id": school_id,
            "type": "student",
            "user_id": student_id,
            "date": {"$gte": start_date, "$lte": end_date}
        },
        {"_id": 0}
    ).sort("date", -1)
    
    records = await records_cursor.to_list(length=365)
    
    # Calculate summary
    summary = {"present": 0, "late": 0, "absent": 0, "total_days": len(records)}
    for r in records:
        if r["status"] in summary:
            summary[r["status"]] += 1
    
    return {
        "student_id": student_id,
        "start_date": start_date,
        "end_date": end_date,
        "records": records,
        "summary": summary
    }

# ─────────────────────────────────────────────────────────────────────────────
# TEACHER ATTENDANCE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/attendance/teachers")
async def get_teachers_for_attendance(
    date: str,
    include_schedule: bool = False,
    current_user = Depends(get_current_user)
):
    """
    Get all teachers with their attendance status for the given date.
    If no attendance exists, returns teachers with default status 'present'.
    When `include_schedule=true`, also returns the effective entry/exit time
    each teacher would use (global or per-level override).
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Get all teachers
    teachers_cursor = db.users.find(
        {"school_id": school_id, "role": "teacher"},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    teachers = await teachers_cursor.to_list(length=500)
    
    # Get existing attendance records for this date
    attendance_cursor = db.attendances.find(
        {
            "school_id": school_id,
            "type": "teacher",
            "date": date
        },
        {"_id": 0}
    )
    attendance_records = await attendance_cursor.to_list(length=500)
    
    # Build attendance map
    attendance_map = {a["user_id"]: a for a in attendance_records}

    # Preload level names if schedule is requested
    level_name_by_id = {}
    per_level_active = False
    if include_schedule:
        school_doc = await db.schools.find_one(
            {"id": school_id},
            {"_id": 0, "attendance_config.teachers": 1}
        )
        per_level_active = bool(
            ((school_doc or {}).get("attendance_config", {}) or {})
            .get("teachers", {})
            .get("horario_por_nivel_activo", False)
        )
        if per_level_active:
            levels = await db.academic_levels.find(
                {"school_id": school_id},
                {"_id": 0, "id": 1, "nombre": 1, "name": 1}
            ).to_list(50)
            for lv in levels:
                level_name_by_id[lv["id"]] = lv.get("nombre") or lv.get("name") or ""

    # Build result
    result = []
    for t in teachers:
        attendance = attendance_map.get(t["id"])
        item = {
            "id": t["id"],
            "name": t.get("name", ""),
            "last_name": t.get("last_name", ""),
            "full_name": f"{t.get('name', '')} {t.get('last_name', '')}".strip(),
            "photo_url": t.get("photo_url"),
            "email": t.get("email"),
            "status": attendance["status"] if attendance else "pending",  # Default to PENDING
            "has_record": attendance is not None
        }
        if include_schedule and per_level_active:
            eff = await get_horario_efectivo_docente(t["id"], school_id)
            item["effective_schedule"] = {
                "entry_time": eff["entry_time"],
                "exit_time": eff["exit_time"],
                "source": eff["source"],
                "nivel_id": eff["nivel_id"],
                "nivel_name": level_name_by_id.get(eff["nivel_id"], "") if eff["nivel_id"] else "",
            }
        result.append(item)
    
    # Sort by name
    result.sort(key=lambda x: x["full_name"].lower())
    
    return {
        "date": date,
        "teachers": result,
        "total": len(result),
        "has_saved_records": len(attendance_records) > 0,
        "per_level_schedule_active": per_level_active,
    }

@router.post("/attendance/teachers/save")
async def save_teacher_attendance(data: TeacherAttendanceSave, current_user = Depends(get_current_user)):
    """
    Save attendance records for teachers in batch.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Delete existing records for this date
    await db.attendances.delete_many({
        "school_id": school_id,
        "type": "teacher",
        "date": data.date
    })
    
    # Insert new records
    records_to_insert = []
    for record in data.records:
        records_to_insert.append({
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "type": "teacher",
            "user_id": record.user_id,
            "grade_id": None,
            "section_id": None,
            "date": data.date,
            "status": record.status,
            "recorded_by": current_user["sub"],
            "created_at": now
        })
    
    if records_to_insert:
        await db.attendances.insert_many(records_to_insert)
    
    # Calculate summary
    summary = {"present": 0, "late": 0, "absent": 0, "justified": 0}
    for r in data.records:
        if r.status in summary:
            summary[r.status] += 1
    
    logger.info(f"Teacher attendance saved for {data.date} by {current_user['sub']}: {len(data.records)} records")
    
    return {
        "message": "Asistencia de profesores guardada correctamente",
        "date": data.date,
        "total_records": len(data.records),
        "summary": summary
    }

# ─────────────────────────────────────────────────────────────────────────────
# ATTENDANCE REPORTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/attendance/reports/teachers")
async def get_teacher_attendance_report(
    teacher_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get teacher attendance report with summary statistics.
    Can filter by specific teacher and/or date range.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id, "type": "teacher"}
    
    if teacher_id:
        query["user_id"] = teacher_id
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    # Get attendance records
    records_cursor = db.attendances.find(query, {"_id": 0}).sort("date", -1)
    records = await records_cursor.to_list(length=1000)
    
    # Get teacher info
    teacher_ids = list(set(r["user_id"] for r in records))
    teachers_cursor = db.users.find(
        {"id": {"$in": teacher_ids}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}
    )
    teachers = await teachers_cursor.to_list(length=500)
    teachers_map = {t["id"]: t for t in teachers}
    
    # Build report by teacher
    report_by_teacher = {}
    for r in records:
        tid = r["user_id"]
        if tid not in report_by_teacher:
            teacher = teachers_map.get(tid, {})
            report_by_teacher[tid] = {
                "teacher_id": tid,
                "teacher_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
                "teacher_photo": teacher.get("photo_url"),
                "present": 0,
                "late": 0,
                "absent": 0,
                "justified": 0,
                "total_days": 0,
                "attendance_rate": 0
            }
        
        report_by_teacher[tid]["total_days"] += 1
        if r["status"] in report_by_teacher[tid]:
            report_by_teacher[tid][r["status"]] += 1
    
    # Calculate attendance rate
    for tid, data in report_by_teacher.items():
        if data["total_days"] > 0:
            attended = data["present"] + data["late"] + data["justified"]
            data["attendance_rate"] = round((attended / data["total_days"]) * 100, 1)
    
    # Convert to list and sort by name
    report_list = list(report_by_teacher.values())
    report_list.sort(key=lambda x: x["teacher_name"].lower())
    
    # Overall summary
    overall_summary = {
        "total_records": len(records),
        "present": sum(1 for r in records if r["status"] == "present"),
        "late": sum(1 for r in records if r["status"] == "late"),
        "absent": sum(1 for r in records if r["status"] == "absent"),
        "justified": sum(1 for r in records if r["status"] == "justified")
    }
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "teacher_id": teacher_id,
        "report": report_list,
        "summary": overall_summary,
        "records": records[:100]  # Return last 100 records for detail view
    }

@router.get("/attendance/reports/students")
async def get_student_attendance_report(
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get student attendance report with summary statistics.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Build query
    query = {"type": "student"}
    query.update(flexible_id_filter("school_id", school_id))
    
    if grade_id:
        query.update(flexible_id_filter("grade_id", grade_id))
    if section_id:
        query.update(flexible_id_filter("section_id", section_id))
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    # Get attendance records
    records_cursor = db.attendances.find(query, {"_id": 0}).sort("date", -1)
    records = await records_cursor.to_list(length=5000)
    
    # Get student info
    student_ids = list(set(r["user_id"] for r in records))
    students_cursor = db.users.find(
        {"id": {"$in": student_ids}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}
    )
    students = await students_cursor.to_list(length=1000)
    students_map = {s["id"]: s for s in students}
    
    # Build report by student
    report_by_student = {}
    for r in records:
        sid = r["user_id"]
        if sid not in report_by_student:
            student = students_map.get(sid, {})
            report_by_student[sid] = {
                "student_id": sid,
                "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
                "student_photo": student.get("photo_url"),
                "present": 0,
                "late": 0,
                "absent": 0,
                "total_days": 0,
                "attendance_rate": 0
            }
        
        report_by_student[sid]["total_days"] += 1
        if r["status"] in report_by_student[sid]:
            report_by_student[sid][r["status"]] += 1
    
    # Calculate attendance rate
    for sid, data in report_by_student.items():
        if data["total_days"] > 0:
            attended = data["present"] + data["late"]
            data["attendance_rate"] = round((attended / data["total_days"]) * 100, 1)
    
    # Convert to list and sort
    report_list = list(report_by_student.values())
    report_list.sort(key=lambda x: x["student_name"].lower())
    
    # Overall summary
    overall_summary = {
        "total_records": len(records),
        "present": sum(1 for r in records if r["status"] == "present"),
        "late": sum(1 for r in records if r["status"] == "late"),
        "absent": sum(1 for r in records if r["status"] == "absent")
    }
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "grade_id": grade_id,
        "section_id": section_id,
        "report": report_list,
        "summary": overall_summary
    }


@router.get("/attendance/reports/student-detail")
async def get_student_attendance_detail(
    student_id: str = Query(..., description="ID del estudiante"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get detailed attendance records for a specific student (admin/owner)."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No autorizado")
    
    query = {"school_id": user["school_id"], "user_id": student_id, "type": "student"}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    records = await db.attendances.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return {"records": records}


# ══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE ENTRY / EXIT SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

class MarkEntryRequest(BaseModel):
    student_id: str
    date: Optional[str] = None
    method: Literal["manual", "qr"] = "manual"

class MarkExitRequest(BaseModel):
    student_id: str
    date: Optional[str] = None
    method: Literal["manual", "qr"] = "manual"

@router.post("/attendance/mark-entry")
async def mark_attendance_entry(data: MarkEntryRequest, current_user=Depends(get_current_user)):
    """Mark a student's entry for the day."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No autorizado")
    school_id = user["school_id"]
    today = data.date or datetime.now(PERU_TZ).strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    now_time = datetime.now(PERU_TZ).strftime("%H:%M")

    # Get student info for grade/section
    student = await db.users.find_one({"id": data.student_id, "school_id": school_id, "role": "student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    # Check existing record
    existing = await db.attendances.find_one({
        "school_id": school_id, "user_id": data.student_id, "date": today, "type": "student"
    })

    if existing and existing.get("entry_time"):
        raise HTTPException(status_code=400, detail="Entrada ya registrada para hoy")

    # Upsert attendance with entry
    await db.attendances.update_one(
        {"school_id": school_id, "user_id": data.student_id, "date": today, "type": "student"},
        {
            "$set": {
                "status": "present",
                "entry_time": now_iso,
                "entry_method": data.method,
                "check_in_time": now_time,
                "recorded_by": current_user["sub"],
                "updated_at": now_iso
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "user_id": data.student_id,
                "type": "student",
                "grade_id": student.get("grado_id"),
                "section_id": student.get("seccion_id"),
                "date": today,
                "created_at": now_iso
            }
        },
        upsert=True
    )

    return {
        "status": "success",
        "message": "Entrada registrada",
        "entry_time": now_time,
        "student_id": data.student_id
    }

@router.post("/attendance/mark-exit")
async def mark_attendance_exit(data: MarkExitRequest, current_user=Depends(get_current_user)):
    """Mark a student's exit for the day."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No autorizado")
    school_id = user["school_id"]
    today = data.date or datetime.now(PERU_TZ).strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    now_time = datetime.now(PERU_TZ).strftime("%H:%M")

    existing = await db.attendances.find_one({
        "school_id": school_id, "user_id": data.student_id, "date": today, "type": "student"
    })

    if not existing or not existing.get("entry_time"):
        raise HTTPException(status_code=400, detail="No hay entrada registrada para hoy")

    if existing.get("exit_time"):
        raise HTTPException(status_code=400, detail="Salida ya registrada para hoy")

    # Calculate total minutes
    total_minutes = None
    try:
        entry_dt = datetime.fromisoformat(existing["entry_time"])
        if entry_dt.tzinfo is None:
            entry_dt = entry_dt.replace(tzinfo=timezone.utc)
        exit_dt = datetime.now(timezone.utc)
        total_minutes = int((exit_dt - entry_dt).total_seconds() / 60)
    except Exception:
        pass

    await db.attendances.update_one(
        {"_id": existing["_id"]},
        {"$set": {
            "exit_time": now_iso,
            "exit_method": data.method,
            "total_minutes": total_minutes,
            "updated_at": now_iso
        }}
    )

    return {
        "status": "success",
        "message": "Salida registrada",
        "exit_time": now_time,
        "total_minutes": total_minutes,
        "student_id": data.student_id
    }

# ══════════════════════════════════════════════════════════════════════════════
# QR CODE ATTENDANCE SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

class QRScanRequest(BaseModel):
    """Request to scan QR and register attendance"""
    qr_token: str
    mode: Literal["entry", "exit", "auto"] = "auto"

@router.post("/attendance/qr/scan")
async def scan_qr_attendance(data: QRScanRequest, current_user = Depends(get_current_user)):
    """
    Scan student/teacher QR code and register attendance.
    Supports both new short QR (qr_id) and legacy JWT tokens.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No autorizado")
    
    school_id = user["school_id"]
    raw = data.qr_token.strip()

    # --- NEW: Short QR (URL or plain qr_id) ---
    qr_id = None
    if raw.startswith("http"):
        # Extract qr_id from URL like https://app.edunet.pe/qr/abc12345
        parts = raw.rstrip("/").split("/")
        qr_id = parts[-1] if parts else None
    elif len(raw) <= 12 and not raw.startswith("ey"):
        qr_id = raw

    if qr_id:
        scanned_user = await db.users.find_one(
            {"qr_id": qr_id, "school_id": school_id},
            {"_id": 0, "password": 0}
        )
        if not scanned_user:
            raise HTTPException(status_code=400, detail={
                "status": "error",
                "message": "QR no reconocido o no pertenece a esta institucion",
                "code": "QR_INVALID"
            })
        is_teacher_qr = scanned_user.get("role") == "teacher"
        scanned_user_id = scanned_user["id"]
        scanned_role = "teacher" if is_teacher_qr else "student"
    else:
        # --- LEGACY: JWT token ---
        try:
            qr_data = jwt.decode(raw, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=400, detail={
                "status": "error", "message": "QR expirado", "code": "QR_EXPIRED"
            })
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=400, detail={
                "status": "error", "message": "QR invalido", "code": "QR_INVALID"
            })
        
        qr_type = qr_data.get("type")
        if qr_type not in ("student_qr", "teacher_qr"):
            raise HTTPException(status_code=400, detail={
                "status": "error", "message": "Este QR no es valido para asistencia", "code": "QR_WRONG_TYPE"
            })
        
        if qr_data.get("school_id") != school_id:
            raise HTTPException(status_code=403, detail={
                "status": "error", "message": "Este usuario no pertenece a tu institucion", "code": "SCHOOL_MISMATCH"
            })
        
        is_teacher_qr = qr_type == "teacher_qr"
        scanned_user_id = qr_data.get("teacher_id") if is_teacher_qr else qr_data.get("student_id")
        scanned_role = "teacher" if is_teacher_qr else "student"
        
        scanned_user = await db.users.find_one(
            {"id": scanned_user_id, "school_id": school_id, "role": scanned_role},
            {"_id": 0, "password": 0}
        )
    
    if not scanned_user:
        raise HTTPException(status_code=404, detail={
            "status": "error",
            "message": f"{'Profesor' if is_teacher_qr else 'Estudiante'} no encontrado",
            "code": "USER_NOT_FOUND"
        })
    
    # Check if attendance already marked today
    today = datetime.now(PERU_TZ).strftime("%Y-%m-%d")
    now = datetime.now(timezone.utc)
    now_time = datetime.now(PERU_TZ).strftime("%H:%M")
    now_iso = now.isoformat()
    
    attendance_type = scanned_role  # "student" or "teacher"
    
    # Check main attendances collection (only records with active entry)
    existing = await db.attendances.find_one({
        "user_id": scanned_user_id,
        "date": today,
        "school_id": school_id,
        "type": attendance_type,
        "$or": [
            {"entry_status": "active"},
            {"entry_status": {"$exists": False}},
        ]
    })
    
    # Also check student_attendance (legacy QR collection) and sync if needed (students only)
    if not is_teacher_qr:
        existing_legacy = await db.student_attendance.find_one({
            "student_id": scanned_user_id, "date": today, "school_id": school_id,
            "status": {"$nin": ["anulado", "entrada_anulada"]}
        })
        if existing_legacy and not existing:
            await db.attendances.update_one(
                {"school_id": school_id, "type": "student", "user_id": scanned_user_id, "date": today},
                {
                    "$set": {
                        "status": existing_legacy.get("status", "present"),
                        "entry_time": existing_legacy.get("created_at"),
                        "entry_method": "qr",
                        "check_in_time": existing_legacy.get("check_in_time", ""),
                        "method": "qr_scan",
                        "recorded_by": existing_legacy.get("scanned_by", current_user["sub"]),
                        "created_at": existing_legacy.get("created_at", now_iso)
                    },
                    "$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "school_id": school_id, "type": "student", "user_id": scanned_user_id,
                        "grade_id": scanned_user.get("grado_id"), "section_id": scanned_user.get("seccion_id"),
                        "date": today
                    }
                },
                upsert=True
            )
            existing = await db.attendances.find_one({
                "user_id": scanned_user_id, "date": today, "school_id": school_id, "type": "student",
                "$or": [
                    {"entry_status": "active"},
                    {"entry_status": {"$exists": False}},
                ]
            })
    
    # Build user info for response
    user_info = {
        "id": scanned_user["id"],
        "name": scanned_user.get("name", ""),
        "last_name": scanned_user.get("last_name", ""),
        "full_name": f"{scanned_user.get('name', '')} {scanned_user.get('last_name', '')}".strip(),
        "photo_url": scanned_user.get("photo_url"),
        "role": scanned_role,
    }
    
    if not is_teacher_qr:
        # Get grade and section names for students
        grade = await db.grados.find_one({"id": scanned_user.get("grado_id")}, {"_id": 0, "nombre": 1})
        section = await db.secciones.find_one({"id": scanned_user.get("seccion_id")}, {"_id": 0, "nombre": 1})
        if not grade:
            grade = await db.grades.find_one({"id": scanned_user.get("grado_id")}, {"_id": 0, "nombre": 1})
        if not section:
            section = await db.sections.find_one({"id": scanned_user.get("seccion_id")}, {"_id": 0, "nombre": 1})
        user_info["grade_name"] = grade.get("nombre") if grade else None
        user_info["section_name"] = section.get("nombre") if section else None
        user_info["grado_id"] = scanned_user.get("grado_id")
        user_info["seccion_id"] = scanned_user.get("seccion_id")
    else:
        user_info["grade_name"] = None
        user_info["section_name"] = None
    
    mode = data.mode  # entry, exit, auto
    
    has_entry = existing and existing.get("entry_time") and existing.get("entry_status", "active") != "anulado"
    has_exit = existing and existing.get("exit_time") and existing.get("exit_status", "active") != "anulado"
    
    # Determine action based on mode
    if mode == "auto":
        if not has_entry:
            action = "entry"
        elif not has_exit:
            action = "exit"
        else:
            action = "already_both"
    elif mode == "entry":
        if has_entry:
            action = "already_entry"
        else:
            action = "entry"
    elif mode == "exit":
        if not has_entry:
            action = "no_entry"
        elif has_exit:
            action = "already_exit"
        else:
            action = "exit"
    else:
        action = "entry"
    
    # Execute action
    if action == "entry":
        # Determine status based on attendance config (auto tardanza by level)
        entry_status = "present"
        attendance_config = {}
        try:
            school_doc = await db.schools.find_one({"id": school_id}, {"_id": 0, "attendance_config": 1})
            attendance_config = (school_doc or {}).get("attendance_config", {})
        except Exception:
            pass

        auto_late = attendance_config.get("auto_late_enabled", False)
        if auto_late:
            # Find the right schedule: teachers (with optional per-level override) or student by level
            config_time_str = None
            if is_teacher_qr:
                effective = await get_horario_efectivo_docente(
                    scanned_user.get("id"), school_id
                )
                config_time_str = effective.get("entry_time")
            else:
                # Find student's level and match in levels config
                student_level_id = scanned_user.get("nivel_id") or scanned_user.get("level_id")
                levels_config = attendance_config.get("levels", [])
                for lc in levels_config:
                    if lc.get("level_id") == student_level_id:
                        config_time_str = lc.get("entry_time")
                        break
                # Fallback: old flat format
                if not config_time_str:
                    config_time_str = attendance_config.get("student_entry_time")

            if config_time_str:
                try:
                    ch, cm = map(int, config_time_str.split(":"))
                    # Teacher-specific rules override global when enabled
                    teachers_cfg = attendance_config.get("teachers", {}) or {}
                    teacher_rules_on = bool(teachers_cfg.get("reglas_propias_activo"))
                    global_tol = attendance_config.get("tolerance_minutes", 0) or 0
                    global_abs = attendance_config.get("mark_absent_after_minutes", 0) or 0
                    if is_teacher_qr and teacher_rules_on:
                        tolerance = teachers_cfg.get("tolerance_minutes")
                        if tolerance is None:
                            tolerance = global_tol
                        absent_limit = teachers_cfg.get("mark_absent_after_minutes")
                        if absent_limit is None:
                            absent_limit = global_abs
                    else:
                        tolerance = global_tol
                        absent_limit = global_abs
                    nh, nm = map(int, now_time.split(":"))
                    current_mins = nh * 60 + nm
                    limit_mins = ch * 60 + cm
                    if absent_limit > 0 and current_mins > limit_mins + absent_limit:
                        entry_status = "absent"
                    elif current_mins > limit_mins + tolerance:
                        entry_status = "late"
                except Exception:
                    pass

        entry_update = {
            "$set": {
                "status": entry_status,
                "entry_time": now_iso,
                "entry_method": "qr",
                "check_in_time": now_time,
                "method": "qr_scan",
                "recorded_by": current_user["sub"],
                "updated_at": now_iso
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "school_id": school_id, "type": attendance_type, "user_id": scanned_user_id,
                "date": today, "created_at": now_iso
            }
        }
        if not is_teacher_qr:
            student_grade = scanned_user.get("grado_id") or scanned_user.get("grade_id")
            student_section = scanned_user.get("seccion_id") or scanned_user.get("section_id")
            entry_update["$set"]["grade_id"] = student_grade
            entry_update["$set"]["section_id"] = student_section
            entry_update["$setOnInsert"]["grade_id"] = student_grade
            entry_update["$setOnInsert"]["section_id"] = student_section
        
        # Save to attendances - only update active records, else create new
        active_filter = {
            "school_id": school_id, "type": attendance_type, "user_id": scanned_user_id, "date": today,
            "$or": [
                {"entry_status": "active"},
                {"entry_status": {"$exists": False}},
            ]
        }
        active_record = await db.attendances.find_one(active_filter)
        if active_record:
            await db.attendances.update_one({"_id": active_record["_id"]}, {"$set": entry_update["$set"]})
        else:
            new_doc = {**entry_update["$setOnInsert"], **entry_update["$set"], "entry_status": "active", "exit_status": "active"}
            await db.attendances.insert_one(new_doc)

        # Also save to legacy collection (students only)
        if not is_teacher_qr:
            legacy_filter = {
                "student_id": scanned_user_id, "date": today, "school_id": school_id,
                "status": {"$nin": ["anulado", "entrada_anulada"]}
            }
            legacy_record = await db.student_attendance.find_one(legacy_filter)
            legacy_set = {"status": entry_status, "check_in_time": now_time, "method": "qr_scan",
                         "scanned_by": current_user["sub"], "created_at": now_iso,
                         "grado_id": scanned_user.get("grado_id"), "seccion_id": scanned_user.get("seccion_id")}
            if legacy_record:
                await db.student_attendance.update_one({"_id": legacy_record["_id"]}, {"$set": legacy_set})
            else:
                await db.student_attendance.insert_one({
                    "id": str(uuid.uuid4()), "student_id": scanned_user_id,
                    "school_id": school_id, "date": today, **legacy_set
                })
        
        logger.info(f"QR Entry ({scanned_role}): {user_info['full_name']} at {now_time} [{entry_status}]")
        
        # Send push notification to parent (students only)
        if not is_teacher_qr:
            notif_event = "tardanza" if entry_status == "late" else "ingreso"
            try:
                await send_attendance_notification(
                    student_id=scanned_user_id,
                    school_id=school_id,
                    entry_time=now_time,
                    event_type=notif_event
                )
            except Exception as notif_err:
                logger.error(f"Push notification error: {notif_err}")
        
        return {
            "status": "success",
            "action": "entry",
            "message": f"Entrada registrada para {user_info['full_name']}",
            "student": user_info,
            "attendance": {
                "status": entry_status, "entry_time": now_time, "exit_time": None, "date": today
            }
        }
    
    elif action == "exit":
        total_minutes = None
        try:
            entry_dt = datetime.fromisoformat(existing["entry_time"])
            if entry_dt.tzinfo is None:
                entry_dt = entry_dt.replace(tzinfo=timezone.utc)
            total_minutes = int((now - entry_dt).total_seconds() / 60)
        except Exception:
            pass
        
        exit_update_fields = {
                "exit_time": now_iso, "exit_method": "qr",
                "total_minutes": total_minutes, "updated_at": now_iso
        }
        if not is_teacher_qr:
            exit_update_fields["grade_id"] = scanned_user.get("grado_id") or scanned_user.get("grade_id")
            exit_update_fields["section_id"] = scanned_user.get("seccion_id") or scanned_user.get("section_id")
        await db.attendances.update_one(
            {"_id": existing["_id"]},
            {"$set": exit_update_fields}
        )
        
        entry_time_str = to_peru_hhmm(existing.get("entry_time")) or existing.get("check_in_time", "")
        logger.info(f"QR Exit ({scanned_role}): {user_info['full_name']} at {now_time} (total: {total_minutes}min)")
        
        # Send push notification to parent (students only)
        if not is_teacher_qr:
            try:
                await send_attendance_notification(
                    student_id=scanned_user_id,
                    school_id=school_id,
                    entry_time=now_time,
                    event_type="salida"
                )
            except Exception as notif_err:
                logger.error(f"Push notification error: {notif_err}")
        
        return {
            "status": "success",
            "action": "exit",
            "message": f"Salida registrada para {user_info['full_name']}",
            "student": user_info,
            "attendance": {
                "status": existing.get("status", "present"),
                "entry_time": entry_time_str,
                "exit_time": now_time,
                "total_minutes": total_minutes,
                "date": today
            }
        }
    
    elif action == "already_both":
        entry_time_str = to_peru_hhmm(existing.get("entry_time")) or existing.get("check_in_time", "")
        exit_time_str = to_peru_hhmm(existing.get("exit_time")) or ""
        
        return {
            "status": "already_marked",
            "action": "already_both",
            "message": f"Ya se registró entrada y salida hoy para {user_info['full_name']}",
            "student": user_info,
            "attendance": {
                "status": existing.get("status"),
                "entry_time": entry_time_str,
                "exit_time": exit_time_str,
                "total_minutes": existing.get("total_minutes"),
                "date": today
            }
        }
    
    elif action == "already_entry":
        entry_time_str = to_peru_hhmm(existing.get("entry_time")) or existing.get("check_in_time", "")
        return {
            "status": "already_marked",
            "action": "already_entry",
            "message": f"Entrada ya registrada para {user_info['full_name']}",
            "student": user_info,
            "attendance": {
                "status": existing.get("status"),
                "entry_time": entry_time_str,
                "exit_time": None,
                "date": today
            }
        }
    
    elif action == "already_exit":
        entry_time_str = to_peru_hhmm(existing.get("entry_time")) or existing.get("check_in_time", "")
        exit_time_str = to_peru_hhmm(existing.get("exit_time"))
        return {
            "status": "already_marked",
            "action": "already_exit",
            "message": f"Salida ya registrada para {user_info['full_name']}",
            "student": user_info,
            "attendance": {
                "status": existing.get("status"),
                "entry_time": entry_time_str,
                "exit_time": exit_time_str,
                "date": today
            }
        }
    
    else:  # no_entry
        return {
            "status": "error",
            "action": "no_entry",
            "message": f"No hay entrada registrada para {user_info['full_name']}. Debe registrar entrada primero.",
            "student": user_info,
            "attendance": {"status": None, "entry_time": None, "exit_time": None, "date": today}
        }


@router.post("/attendance/qr/generate")
async def generate_qr_for_existing_users(current_user = Depends(get_current_user)):
    """Generate optimized short QR IDs for users that don't have one."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta accion")
    
    school_id = user["school_id"]
    updated_count = 0
    
    # Students without qr_id
    students = await db.users.find({
        "school_id": school_id, "role": "student",
        "$or": [{"qr_id": {"$exists": False}}, {"qr_id": None}]
    }).to_list(None)
    
    for s in students:
        qr_id, qr_url = await generate_user_qr(db)
        await db.users.update_one({"id": s["id"]}, {"$set": {"qr_id": qr_id, "qr_token": qr_url, "qr_version": 2}})
        updated_count += 1
    
    # Teachers without qr_id
    teachers = await db.users.find({
        "school_id": school_id, "role": "teacher",
        "$or": [{"qr_id": {"$exists": False}}, {"qr_id": None}]
    }).to_list(None)
    
    for t in teachers:
        qr_id, qr_url = await generate_user_qr(db)
        await db.users.update_one({"id": t["id"]}, {"$set": {"qr_id": qr_id, "qr_token": qr_url, "qr_version": 2}})
        updated_count += 1
    
    return {
        "message": f"QR generados para {updated_count} usuarios ({len(students)} estudiantes, {len(teachers)} profesores)",
        "updated_count": updated_count,
        "students_updated": len(students),
        "teachers_updated": len(teachers)
    }


@router.post("/attendance/qr/regenerate-all")
async def regenerate_all_qr(current_user = Depends(get_current_user)):
    """Regenerate ALL QR codes with optimized short IDs. Admin/owner only. Old QR codes become invalid."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta accion")
    
    school_id = user["school_id"]
    
    students = await db.users.find({"school_id": school_id, "role": "student"}, {"_id": 0, "id": 1}).to_list(None)
    teachers = await db.users.find({"school_id": school_id, "role": "teacher"}, {"_id": 0, "id": 1}).to_list(None)
    
    total = len(students) + len(teachers)
    if total == 0:
        return {"message": "No hay usuarios para regenerar", "total": 0}
    
    count = 0
    for s in students:
        qr_id, qr_url = await generate_user_qr(db)
        await db.users.update_one({"id": s["id"]}, {"$set": {"qr_id": qr_id, "qr_token": qr_url, "qr_version": 2}})
        count += 1
    
    for t in teachers:
        qr_id, qr_url = await generate_user_qr(db)
        await db.users.update_one({"id": t["id"]}, {"$set": {"qr_id": qr_id, "qr_token": qr_url, "qr_version": 2}})
        count += 1
    
    # Log the operation
    await db.qr_regeneration_logs.insert_one({
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "performed_by": user["id"],
        "performed_by_name": f"{user.get('name','')} {user.get('last_name','')}".strip(),
        "total_regenerated": count,
        "students": len(students),
        "teachers": len(teachers),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    logger.info(f"QR regeneration: {count} users in school {school_id}")
    
    return {
        "message": f"Todos los codigos QR fueron optimizados correctamente",
        "total": count,
        "students": len(students),
        "teachers": len(teachers),
    }

@router.post("/attendance/qr/regenerate/{user_id}")
async def regenerate_individual_qr(user_id: str, current_user=Depends(get_current_user)):
    """Regenerate QR code for a single user. Admin/support only."""
    caller = await resolve_user_from_token(current_user)
    if not caller or not is_admin_user(caller):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta accion")

    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "role": 1, "school_id": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    qr_id, qr_url = await generate_user_qr(db)
    await db.users.update_one({"id": user_id}, {"$set": {"qr_id": qr_id, "qr_token": qr_url, "qr_version": 2}})

    logger.info(f"Individual QR regeneration: user {user_id} by {caller.get('id')}")
    return {
        "message": f"QR de {target_user.get('name','')} {target_user.get('last_name','')} optimizado correctamente",
        "user_id": user_id,
        "qr_id": qr_id,
    }



@router.get("/attendance/qr/history")
async def get_qr_attendance_history(
    limit: int = 20,
    role: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get recent QR attendance scan history for today (students + teachers).
    Optional role filter: 'student' or 'teacher'.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No autorizado")
    
    school_id = user["school_id"]
    today = datetime.now(PERU_TZ).strftime("%Y-%m-%d")
    
    history = []
    
    # Get student QR scans from attendances collection directly
    if role != "teacher":
        student_records = await db.attendances.find({
            "school_id": school_id,
            "date": today,
            "type": "student",
            "method": "qr_scan"
        }, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(None)
        
        for record in student_records:
            student = await db.users.find_one(
                {"id": record["user_id"]},
                {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1, "grado_id": 1, "seccion_id": 1}
            )
            if student:
                grade = await db.grados.find_one({"id": student.get("grado_id")}, {"_id": 0, "nombre": 1})
                section = await db.secciones.find_one({"id": student.get("seccion_id")}, {"_id": 0, "nombre": 1})
                
                entry_t = to_peru_hhmm(record.get("entry_time")) or record.get("check_in_time")
                exit_t = to_peru_hhmm(record.get("exit_time"))
                
                history.append({
                    "id": record.get("id"),
                    "attendance_id": record.get("id"),
                    "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
                    "name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
                    "photo_url": student.get("photo_url"),
                    "grade_name": grade.get("nombre") if grade else None,
                    "section_name": section.get("nombre") if section else None,
                    "role": "student",
                    "status": record.get("status"),
                    "entry_status": record.get("entry_status", "active"),
                    "exit_status": record.get("exit_status", "active"),
                    "time": entry_t,
                    "entry_time": entry_t,
                    "exit_time": exit_t,
                    "created_at": record.get("created_at")
                })
    
    # Get teacher QR scans (skip if filtering for students only)
    if role != "student":
        teacher_records = await db.attendances.find({
            "school_id": school_id,
            "date": today,
            "type": "teacher",
            "method": "qr_scan"
        }).sort("created_at", -1).limit(limit).to_list(None)
        
        for record in teacher_records:
            teacher = await db.users.find_one(
                {"id": record["user_id"]},
                {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1}
            )
            if teacher:
                entry_t = to_peru_hhmm(record.get("entry_time")) or record.get("check_in_time")
                exit_t = to_peru_hhmm(record.get("exit_time"))
                history.append({
                    "id": record.get("id"),
                    "attendance_id": record.get("id"),
                    "student_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
                    "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
                    "photo_url": teacher.get("photo_url"),
                    "grade_name": None,
                    "section_name": None,
                    "role": "teacher",
                    "status": record.get("status"),
                    "entry_status": record.get("entry_status", "active"),
                    "exit_status": record.get("exit_status", "active"),
                    "time": entry_t,
                    "entry_time": entry_t,
                    "exit_time": exit_t,
                    "created_at": record.get("created_at")
                })
    
    # Sort combined results by created_at descending
    history.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    history = history[:limit]
    
    return {
        "date": today,
        "total_scans": len(history),
        "history": history
    }


# ══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE ANNULMENT
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# MY SCANS TODAY (for auxiliar_asistencia)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/attendance/my-scans-today")
async def get_my_scans_today(current_user=Depends(get_current_user)):
    """
    Get attendance records registered by the current user today.
    Used by auxiliar_asistencia to verify their own scans.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No autorizado")

    school_id = user["school_id"]
    user_id = user["id"]
    today = datetime.now(PERU_TZ).strftime("%Y-%m-%d")

    # Get all attendance records registered by this user today
    records = await db.attendances.find(
        {
            "school_id": school_id,
            "date": today,
            "recorded_by": user_id,
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    results = []
    for record in records:
        # Get the scanned person's info
        scanned = await db.users.find_one(
            {"id": record.get("user_id")},
            {"_id": 0, "name": 1, "last_name": 1, "role": 1, "grado_id": 1, "seccion_id": 1}
        )
        if not scanned:
            continue

        grade_name = ""
        section_name = ""
        if scanned.get("grado_id"):
            grade = await db.grados.find_one({"id": scanned["grado_id"]}, {"_id": 0, "nombre": 1})
            grade_name = (grade or {}).get("nombre", "")
        if scanned.get("seccion_id"):
            section = await db.secciones.find_one({"id": scanned["seccion_id"]}, {"_id": 0, "nombre": 1})
            section_name = (section or {}).get("nombre", "")

        entry_time = record.get("check_in_time") or ""
        if not entry_time and record.get("entry_time"):
            try:
                entry_time = datetime.fromisoformat(record["entry_time"]).astimezone(PERU_TZ).strftime("%H:%M")
            except Exception:
                entry_time = ""

        results.append({
            "id": record.get("id", ""),
            "name": scanned.get("name", ""),
            "last_name": scanned.get("last_name", ""),
            "type": record.get("type", "student"),
            "grade": grade_name,
            "section": section_name,
            "entry_time": entry_time,
            "status": record.get("status", "present"),
            "created_at": record.get("created_at", ""),
        })

    return {
        "total": len(results),
        "date": today,
        "records": results,
    }


@router.get("/attendance/aux-dashboard-stats")
async def get_aux_dashboard_stats(current_user=Depends(get_current_user)):
    """
    Returns attendance stats for the auxiliar dashboard:
    - Daily student attendance counts (last 14 days)
    - Daily teacher attendance counts (last 14 days)
    - Today's summary
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No autorizado")

    school_id = user["school_id"]
    today = datetime.now(PERU_TZ)
    today_str = today.strftime("%Y-%m-%d")

    # Last 14 days range
    dates_range = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(13, -1, -1)]

    pipeline_base = [
        {"$match": {"school_id": school_id, "date": {"$in": dates_range}}},
        {"$group": {
            "_id": {"date": "$date", "type": "$type", "status": "$status"},
            "count": {"$sum": 1}
        }}
    ]

    raw = await db.attendances.aggregate(pipeline_base).to_list(500)

    # Build daily stats
    student_daily = {}
    teacher_daily = {}
    for d in dates_range:
        student_daily[d] = {"present": 0, "late": 0, "absent": 0, "justified": 0}
        teacher_daily[d] = {"present": 0, "late": 0, "absent": 0, "justified": 0}

    for r in raw:
        date = r["_id"]["date"]
        typ = r["_id"]["type"]
        status = r["_id"]["status"]
        count = r["count"]
        bucket = "present" if status == "present" else "late" if status == "late" else "absent" if status == "absent" else "justified" if status == "justified" else None
        if not bucket:
            continue
        if typ == "student" and date in student_daily:
            student_daily[date][bucket] += count
        elif typ == "teacher" and date in teacher_daily:
            teacher_daily[date][bucket] += count

    def format_daily(daily_dict):
        result = []
        for d in dates_range:
            vals = daily_dict[d]
            total = vals["present"] + vals["late"] + vals["absent"] + vals["justified"]
            dt = datetime.strptime(d, "%Y-%m-%d")
            result.append({
                "date": d,
                "label": dt.strftime("%d/%m"),
                "day_name": dt.strftime("%a"),
                "present": vals["present"],
                "late": vals["late"],
                "absent": vals["absent"],
                "justified": vals["justified"],
                "total": total,
            })
        return result

    # Today summary
    today_students = student_daily.get(today_str, {"present": 0, "late": 0, "absent": 0, "justified": 0})
    today_teachers = teacher_daily.get(today_str, {"present": 0, "late": 0, "absent": 0, "justified": 0})

    return {
        "student_daily": format_daily(student_daily),
        "teacher_daily": format_daily(teacher_daily),
        "today_summary": {
            "students": {
                "present": today_students["present"],
                "late": today_students["late"],
                "absent": today_students["absent"],
                "justified": today_students["justified"],
                "total": sum(today_students.values()),
            },
            "teachers": {
                "present": today_teachers["present"],
                "late": today_teachers["late"],
                "absent": today_teachers["absent"],
                "justified": today_teachers["justified"],
                "total": sum(today_teachers.values()),
            },
        },
    }




class AnnulAttendanceRequest(BaseModel):
    annul_type: Literal["entry", "exit", "both"]
    reason: str = Field(..., min_length=3)

@router.post("/attendance/{attendance_id}/annul")
async def annul_attendance(
    attendance_id: str,
    data: AnnulAttendanceRequest,
    current_user = Depends(get_current_user)
):
    """Annul an attendance record (entry, exit or both). Admin+ only."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden anular asistencias")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No autorizado")

    record = await db.attendances.find_one({"id": attendance_id, "school_id": school_id})
    if not record:
        raise HTTPException(status_code=404, detail="Registro de asistencia no encontrado")

    now_iso = datetime.now(timezone.utc).isoformat()
    annulled_by = user["id"]
    annulled_by_name = f"{user.get('name', '')} {user.get('last_name', '')}".strip()

    prev_entry_status = record.get("entry_status", "active")
    prev_exit_status = record.get("exit_status", "active")

    update = {"$set": {"updated_at": now_iso}}

    if data.annul_type in ("entry", "both"):
        update["$set"]["entry_status"] = "anulado"
        update["$set"]["entry_annulled_at"] = now_iso
        update["$set"]["entry_annulled_by"] = annulled_by
        update["$set"]["entry_annulment_reason"] = data.reason

    if data.annul_type in ("exit", "both"):
        update["$set"]["exit_status"] = "anulado"
        update["$set"]["exit_annulled_at"] = now_iso
        update["$set"]["exit_annulled_by"] = annulled_by
        update["$set"]["exit_annulment_reason"] = data.reason

    new_entry = update["$set"].get("entry_status", prev_entry_status)
    new_exit = update["$set"].get("exit_status", prev_exit_status)
    if new_entry == "anulado" and new_exit == "anulado":
        update["$set"]["status"] = "anulado"
    elif new_entry == "anulado":
        update["$set"]["status"] = "entrada_anulada"
    elif new_exit == "anulado":
        update["$set"]["status"] = "salida_anulada"

    await db.attendances.update_one({"_id": record["_id"]}, update)

    if record.get("type") == "student":
        await db.student_attendance.update_one(
            {"student_id": record["user_id"], "date": record["date"], "school_id": school_id,
             "status": {"$ne": "anulado"}},
            {"$set": {"status": update["$set"].get("status", "anulado"), "updated_at": now_iso}}
        )

    audit = {
        "id": str(uuid.uuid4()),
        "attendance_id": attendance_id,
        "school_id": school_id,
        "user_id": record.get("user_id"),
        "user_type": record.get("type", "student"),
        "action_type": f"annul_{data.annul_type}",
        "reason": data.reason,
        "performed_by_user_id": annulled_by,
        "performed_by_name": annulled_by_name,
        "performed_at": now_iso,
        "previous_entry_status": prev_entry_status,
        "previous_exit_status": prev_exit_status,
        "previous_entry_time": str(record.get("entry_time")) if record.get("entry_time") else None,
        "previous_exit_time": str(record.get("exit_time")) if record.get("exit_time") else None,
        "new_entry_status": new_entry,
        "new_exit_status": new_exit,
    }
    await db.attendance_annulment_logs.insert_one(audit)

    logger.info(f"Attendance {attendance_id} annulled ({data.annul_type}) by {annulled_by_name}: {data.reason}")

    return {
        "message": "Asistencia anulada correctamente",
        "attendance_id": attendance_id,
        "annul_type": data.annul_type,
        "new_status": update["$set"].get("status", "anulado"),
    }





# ══════════════════════════════════════════════════════════════════════════════
# BULK QR DOWNLOAD
# ══════════════════════════════════════════════════════════════════════════════

class BulkQRRequest(BaseModel):
    nivel_id: str
    grado_id: str
    seccion_id: str
    turno_id: Optional[str] = None
    formato: Literal["pdf_grid", "zip", "pdf_list"] = "pdf_grid"
    incluir_codigo_alumno: bool = False
    incluir_foto: bool = True
    ordenar_alfabetico: bool = True


async def _do_student_qr_bulk(data, school_id, user):
    """Internal implementation for student QR bulk download — memory-safe."""
    from fastapi.responses import StreamingResponse
    import qrcode
    from io import BytesIO
    import zipfile
    import httpx
    from PIL import Image as PILImage
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as pdf_canvas
    from reportlab.lib.utils import ImageReader
    from reportlab.lib.colors import HexColor

    logger.info(f"[Student QR Bulk] === Starting for school {school_id} ===")

    # Phase 1: Fetch students
    student_filter = {
        "school_id": school_id,
        "role": "student",
        "nivel_id": data.nivel_id,
        "grado_id": data.grado_id,
        "seccion_id": data.seccion_id,
    }
    if data.turno_id:
        student_filter["turno_id"] = data.turno_id

    students = await db.users.find(
        student_filter,
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "qr_token": 1, "codigo_alumno": 1, "username": 1, "photo_url": 1}
    ).to_list(1000)

    logger.info(f"[Student QR Bulk] Phase 1 - Found {len(students)} students")

    if not students:
        raise HTTPException(status_code=404, detail="No se encontraron estudiantes con esos filtros")

    if data.ordenar_alfabetico:
        students.sort(key=lambda s: f"{s.get('last_name', '')} {s.get('name', '')}".strip().lower())

    # Get names for file naming
    nivel = await db.academic_levels.find_one({"id": data.nivel_id}, {"_id": 0, "nombre": 1, "name": 1})
    grado = await db.grados.find_one({"id": data.grado_id}, {"_id": 0, "nombre": 1, "name": 1})
    if not grado:
        grado = await db.grades.find_one({"id": data.grado_id}, {"_id": 0, "nombre": 1, "name": 1})
    seccion = await db.secciones.find_one({"id": data.seccion_id}, {"_id": 0, "nombre": 1, "name": 1})
    if not seccion:
        seccion = await db.sections.find_one({"id": data.seccion_id}, {"_id": 0, "nombre": 1, "name": 1})
    nivel_name = (nivel or {}).get("nombre") or (nivel or {}).get("name") or "nivel"
    grado_name = (grado or {}).get("nombre") or (grado or {}).get("name") or "grado"
    seccion_name = (seccion or {}).get("nombre") or (seccion or {}).get("name") or "seccion"
    file_base = f"qr_{nivel_name}_{grado_name}_{seccion_name}".lower().replace(" ", "_")

    def make_qr_image(token_data: str, size: int = 200):
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=2)
        qr.add_data(token_data)
        qr.make(fit=True)
        return qr.make_image(fill_color="black", back_color="white").resize((size, size))

    def student_label(s):
        full = f"{s.get('last_name', '')} {s.get('name', '')}".strip()
        if data.incluir_codigo_alumno and s.get("codigo_alumno"):
            full += f" ({s['codigo_alumno']})"
        return full or s.get("username", "Alumno")

    # ZIP format — no photos, safe as-is
    if data.formato == "zip":
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for s in students:
                if not s.get("qr_token"):
                    continue
                img = make_qr_image(s["qr_token"], 300)
                img_buf = BytesIO()
                img.save(img_buf, format="PNG")
                fname = f"{s.get('last_name', '')}_{s.get('name', '')}".strip().replace(" ", "_")
                if s.get("codigo_alumno"):
                    fname += f"_{s['codigo_alumno']}"
                zf.writestr(f"{fname}_qr.png", img_buf.getvalue())
                del img_buf
        buf.seek(0)
        logger.info(f"[Student QR Bulk] === SUCCESS: ZIP generated for {len(students)} students ===")
        return StreamingResponse(buf, media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={file_base}.zip"})

    # PDF generation
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "name": 1, "school_name": 1, "nombre": 1, "logo_url": 1, "subdomain": 1})
    school_name = (school or {}).get("name") or (school or {}).get("school_name") or (school or {}).get("nombre") or "Colegio"
    school_logo_url = (school or {}).get("logo_url")
    school_domain = f"{(school or {}).get('subdomain', '')}.edunet.pe"
    curso_label = f"{grado_name} - {seccion_name}"

    # Pre-fetch school logo (async, with resize to save memory)
    logo_img = None
    if school_logo_url:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                resp = await client.get(school_logo_url)
                if resp.status_code == 200:
                    pil_logo = PILImage.open(BytesIO(resp.content))
                    if pil_logo.mode in ('RGBA', 'P', 'LA'):
                        pil_logo = pil_logo.convert('RGB')
                    pil_logo.thumbnail((200, 200))
                    logo_img = BytesIO()
                    pil_logo.save(logo_img, format='JPEG', quality=75)
                    logo_img.seek(0)
                    del pil_logo
                    logger.info("[Student QR Bulk] School logo downloaded and resized OK")
        except Exception as e:
            logger.warning(f"[Student QR Bulk] School logo download failed: {e}")

    buf = BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    if data.formato == "pdf_grid":
        cols, rows = 3, 3
        card_w = 60 * mm
        card_h = 88 * mm
        margin_x = (w - cols * card_w) / (cols + 1)
        margin_y = (h - rows * card_h) / (rows + 1)

        navy = HexColor("#001f4b")
        teal = HexColor("#94a3b8")
        gray = HexColor("#64748b")
        light_bg = HexColor("#f1f5f9")
        border_color = HexColor("#d1d5db")

        total_students = len([s for s in students if s.get("qr_token")])
        logger.info(f"[Student QR Bulk] Phase 2 - PDF grid generation: {total_students} students with QR tokens")

        card_idx = 0
        for s in students:
            if not s.get("qr_token"):
                continue
            if card_idx > 0 and card_idx % (cols * rows) == 0:
                c.showPage()

            pos = card_idx % (cols * rows)
            col = pos % cols
            row = pos // cols
            x = margin_x + col * (card_w + margin_x)
            y = h - margin_y - (row + 1) * card_h - row * margin_y

            # Card border
            c.setFillColor(HexColor("#ffffff"))
            c.setStrokeColor(border_color)
            c.setLineWidth(0.5)
            c.roundRect(x, y, card_w, card_h, 2 * mm, fill=1, stroke=1)

            # Top bar
            c.setFillColor(teal)
            c.rect(x + 0.5, y + card_h - 4 * mm, card_w - 1, 4 * mm, fill=1, stroke=0)

            # Logo + School name header
            logo_y = y + card_h - 19 * mm
            if logo_img:
                try:
                    logo_img.seek(0)
                    c.drawImage(ImageReader(logo_img), x + (card_w - 10 * mm) / 2, logo_y + 2 * mm, 10 * mm, 10 * mm, preserveAspectRatio=True, mask='auto')
                except Exception:
                    pass

            c.setFillColor(navy)
            c.setFont("Helvetica-Bold", 6)
            display_name = school_name if school_name.lower().startswith("colegio") else f"Colegio {school_name}"
            name_trunc = display_name[:30]
            tw = c.stringWidth(name_trunc, "Helvetica-Bold", 6)
            c.drawString(x + (card_w - tw) / 2, logo_y - 2 * mm, name_trunc)

            # Divider
            c.setStrokeColor(HexColor("#e2e8f0"))
            c.setLineWidth(0.4)
            c.line(x + 4 * mm, logo_y - 4 * mm, x + card_w - 4 * mm, logo_y - 4 * mm)

            # Student photo — sequential download + Pillow resize
            if data.incluir_foto:
                photo_size = 20 * mm
                photo_x = x + (card_w - photo_size) / 2
                photo_y = logo_y - 5 * mm - photo_size
                student_photo_buf = None
                photo_url = s.get("photo_url")
                if photo_url:
                    try:
                        logger.info(f"[Student QR Bulk] Downloading photo {card_idx + 1}/{total_students}: student {s.get('id')}")
                        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as photo_client:
                            resp = await photo_client.get(photo_url)
                            if resp.status_code == 200:
                                pil_img = PILImage.open(BytesIO(resp.content))
                                if pil_img.mode in ('RGBA', 'P', 'LA'):
                                    pil_img = pil_img.convert('RGB')
                                pil_img.thumbnail((200, 200))
                                student_photo_buf = BytesIO()
                                pil_img.save(student_photo_buf, format='JPEG', quality=75)
                                student_photo_buf.seek(0)
                                del pil_img
                    except Exception as photo_err:
                        logger.warning(f"[Student QR Bulk] Photo download failed for student {s.get('id')}: {photo_err}")
                        student_photo_buf = None

                if student_photo_buf:
                    try:
                        c.saveState()
                        path = c.beginPath()
                        cx_p = photo_x + photo_size / 2
                        cy_p = photo_y + photo_size / 2
                        path.circle(cx_p, cy_p, photo_size / 2)
                        path.close()
                        c.clipPath(path, stroke=0)
                        c.drawImage(ImageReader(student_photo_buf), photo_x, photo_y, photo_size, photo_size, preserveAspectRatio=True, mask='auto')
                        c.restoreState()
                        c.setStrokeColor(HexColor("#cbd5e1"))
                        c.setLineWidth(0.8)
                        c.circle(cx_p, cy_p, photo_size / 2, fill=0, stroke=1)
                    except Exception:
                        try:
                            c.restoreState()
                        except Exception:
                            pass
                        c.setFillColor(light_bg)
                        c.circle(photo_x + photo_size / 2, photo_y + photo_size / 2, photo_size / 2, fill=1, stroke=0)
                        c.setFillColor(navy)
                        c.setFont("Helvetica-Bold", 16)
                        c.drawCentredString(photo_x + photo_size / 2, photo_y + photo_size / 2 - 3, (s.get("name", "?")[:1]).upper())
                else:
                    c.setFillColor(light_bg)
                    c.circle(photo_x + photo_size / 2, photo_y + photo_size / 2, photo_size / 2, fill=1, stroke=0)
                    c.setFillColor(navy)
                    c.setFont("Helvetica-Bold", 16)
                    c.drawCentredString(photo_x + photo_size / 2, photo_y + photo_size / 2 - 3, (s.get("name", "?")[:1]).upper())
                content_top = photo_y - 4 * mm

                # Free photo buffer
                if student_photo_buf:
                    try:
                        student_photo_buf.close()
                    except Exception:
                        pass
                    del student_photo_buf
            else:
                content_top = logo_y - 8 * mm

            # Student name
            info_y = content_top
            c.setFillColor(navy)
            c.setFont("Helvetica-Bold", 7)
            full_name = f"{s.get('name', '')} {s.get('last_name', '')}".strip()
            if len(full_name) > 22:
                full_name = full_name[:21] + "."
            tw = c.stringWidth(full_name, "Helvetica-Bold", 7)
            c.drawString(x + (card_w - tw) / 2, info_y, full_name)

            # Level - Grade - Section
            c.setFillColor(gray)
            c.setFont("Helvetica", 5.5)
            info_line = f"{nivel_name} - {curso_label}"
            tw2 = c.stringWidth(info_line, "Helvetica", 5.5)
            c.drawString(x + (card_w - tw2) / 2, info_y - 4 * mm, info_line)

            # QR
            footer_y = y + 2 * mm
            qr_top = info_y - 7 * mm
            qr_bottom = footer_y + 4 * mm
            available = qr_top - qr_bottom
            qr_size_px = min(available, 32 * mm)
            qr_size_px = max(qr_size_px, 18 * mm)

            qr_img = make_qr_image(s["qr_token"], 250)
            qr_buf = BytesIO()
            qr_img.save(qr_buf, format="PNG")
            qr_buf.seek(0)
            qr_x = x + (card_w - qr_size_px) / 2
            qr_y = qr_bottom + (available - qr_size_px) / 2
            c.drawImage(ImageReader(qr_buf), qr_x, qr_y, qr_size_px, qr_size_px)

            # Free QR buffer
            del qr_buf

            # QR label
            c.setFillColor(HexColor("#94a3b8"))
            c.setFont("Helvetica", 4)
            c.drawCentredString(x + card_w / 2, footer_y, "Personal e intransferible")

            card_idx += 1

    elif data.formato == "pdf_list":
        c.setFont("Helvetica-Bold", 14)
        c.drawString(30, h - 40, f"QR Estudiantes - {nivel_name} {grado_name} {seccion_name}")
        c.setFont("Helvetica-Bold", 8)
        c.drawString(30, h - 65, "Nombre")
        c.drawString(250, h - 65, "Codigo")
        c.drawString(380, h - 65, "QR")
        c.line(30, h - 68, w - 30, h - 68)
        y_pos = h - 85
        row_h = 55

        for s in students:
            if not s.get("qr_token"):
                continue
            if y_pos < 60:
                c.showPage()
                y_pos = h - 50

            c.setFont("Helvetica", 8)
            c.drawString(30, y_pos - 10, f"{s.get('last_name', '')} {s.get('name', '')}".strip())
            c.drawString(250, y_pos - 10, s.get("codigo_alumno", s.get("username", "")))

            qr_img = make_qr_image(s["qr_token"], 120)
            img_buf = BytesIO()
            qr_img.save(img_buf, format="PNG")
            img_buf.seek(0)
            c.drawImage(ImageReader(img_buf), 370, y_pos - 40, 40, 40)
            del img_buf

            y_pos -= row_h

    c.save()
    buf.seek(0)

    # Free logo
    if logo_img:
        try:
            logo_img.close()
        except Exception:
            pass
        del logo_img

    logger.info(f"[Student QR Bulk] === SUCCESS: PDF generated for {len(students)} students, school {school_id} ===")
    return StreamingResponse(buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={file_base}.pdf"})


@router.post("/students/qr/bulk-download")
async def bulk_download_qr(data: BulkQRRequest, current_user=Depends(get_current_user)):
    """Generate and download QR codes for a group of students. Admin/owner only."""
    from fastapi.responses import JSONResponse

    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden descargar QR masivos")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No autorizado")

    try:
        return await _do_student_qr_bulk(data, school_id, user)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[Student QR Bulk] CRITICAL: Error generating student QR PDF for school {school_id}: {e}")
        return JSONResponse(status_code=500, content={"detail": f"Error generando QR de alumnos: {str(e)}"})
