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

from .notifications import send_attendance_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# ATTENDANCE MODULE
# ══════════════════════════════════════════════════════════════════════════════

class AttendanceRecord(BaseModel):
    """Single attendance record for batch save"""
    user_id: str
    status: Literal["present", "late", "absent", "justified"]

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
    
    # Get students for this grade/section (exclude pending)
    students_cursor = db.users.find(
        {
            "school_id": school_id,
            "role": "student",
            "grado_id": grade_id,
            "seccion_id": section_id,
            **ACADEMIC_STUDENT_FILTER
        },
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    students = await students_cursor.to_list(length=500)
    
    # Get existing attendance records for this date
    attendance_cursor = db.attendances.find(
        {
            "school_id": school_id,
            "type": "student",
            "grade_id": grade_id,
            "section_id": section_id,
            "date": date
        },
        {"_id": 0}
    )
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
            "total_minutes": attendance.get("total_minutes") if attendance else None
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
        await db.attendances.update_one(
            {
                "school_id": school_id,
                "type": "student",
                "user_id": record.user_id,
                "date": data.date
            },
            {
                "$set": {
                    "status": record.status,
                    "grade_id": data.grade_id,
                    "section_id": data.section_id,
                    "recorded_by": current_user["sub"],
                    "updated_at": now
                },
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
    current_user = Depends(get_current_user)
):
    """
    Get all teachers with their attendance status for the given date.
    If no attendance exists, returns teachers with default status 'present'.
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
    
    # Build result
    result = []
    for t in teachers:
        attendance = attendance_map.get(t["id"])
        result.append({
            "id": t["id"],
            "name": t.get("name", ""),
            "last_name": t.get("last_name", ""),
            "full_name": f"{t.get('name', '')} {t.get('last_name', '')}".strip(),
            "photo_url": t.get("photo_url"),
            "email": t.get("email"),
            "status": attendance["status"] if attendance else "pending",  # Default to PENDING
            "has_record": attendance is not None
        })
    
    # Sort by name
    result.sort(key=lambda x: x["full_name"].lower())
    
    return {
        "date": date,
        "teachers": result,
        "total": len(result),
        "has_saved_records": len(attendance_records) > 0
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
    query = {"school_id": school_id, "type": "student"}
    
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    
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
    Scan student QR code and register attendance.
    Returns student info and attendance status.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No autorizado")
    
    school_id = user["school_id"]
    
    # Validate QR token (JWT)
    try:
        qr_data = jwt.decode(data.qr_token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail={
            "status": "error",
            "message": "QR expirado",
            "code": "QR_EXPIRED"
        })
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail={
            "status": "error", 
            "message": "QR inválido",
            "code": "QR_INVALID"
        })
    
    # Verify QR type
    qr_type = qr_data.get("type")
    if qr_type not in ("student_qr", "teacher_qr"):
        raise HTTPException(status_code=400, detail={
            "status": "error",
            "message": "Este QR no es válido para asistencia",
            "code": "QR_WRONG_TYPE"
        })
    
    # Verify school match
    if qr_data.get("school_id") != school_id:
        raise HTTPException(status_code=403, detail={
            "status": "error",
            "message": "Este usuario no pertenece a tu institución",
            "code": "SCHOOL_MISMATCH"
        })
    
    # Determine if scanning a student or teacher
    is_teacher_qr = qr_type == "teacher_qr"
    scanned_user_id = qr_data.get("teacher_id") if is_teacher_qr else qr_data.get("student_id")
    scanned_role = "teacher" if is_teacher_qr else "student"
    
    # Get user info
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
    
    # Check main attendances collection (exclude fully annulled records)
    existing = await db.attendances.find_one({
        "user_id": scanned_user_id,
        "date": today,
        "school_id": school_id,
        "type": attendance_type,
        "$or": [
            {"entry_status": {"$ne": "anulado"}},
            {"exit_status": {"$ne": "anulado"}},
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
                    {"entry_status": {"$ne": "anulado"}},
                    {"exit_status": {"$ne": "anulado"}},
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
    
    has_entry = existing and existing.get("entry_time")
    has_exit = existing and existing.get("exit_time")
    
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
            # Find the right schedule: teachers or student by level
            config_time_str = None
            if is_teacher_qr:
                teachers_config = attendance_config.get("teachers", {})
                config_time_str = teachers_config.get("entry_time")
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
                    tolerance = attendance_config.get("tolerance_minutes", 0)
                    absent_limit = attendance_config.get("mark_absent_after_minutes", 0)
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
            entry_update["$setOnInsert"]["grade_id"] = scanned_user.get("grado_id")
            entry_update["$setOnInsert"]["section_id"] = scanned_user.get("seccion_id")
        
        # Save to attendances - only update active records, else create new
        active_filter = {
            "school_id": school_id, "type": attendance_type, "user_id": scanned_user_id, "date": today,
            "$or": [
                {"entry_status": {"$ne": "anulado"}},
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
        
        await db.attendances.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "exit_time": now_iso, "exit_method": "qr",
                "total_minutes": total_minutes, "updated_at": now_iso
            }}
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
    """
    Generate QR tokens for existing students and teachers that don't have one.
    Admin only endpoint.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta acción")
    
    school_id = user["school_id"]
    
    updated_count = 0
    
    # Generate for students without qr_token
    students_without_qr = await db.users.find({
        "school_id": school_id,
        "role": "student",
        "qr_token": {"$exists": False}
    }).to_list(None)
    
    for student in students_without_qr:
        qr_payload = {
            "student_id": student["id"],
            "school_id": school_id,
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "type": "student_qr"
        }
        qr_token = jwt.encode(qr_payload, JWT_SECRET, algorithm="HS256")
        await db.users.update_one(
            {"id": student["id"]},
            {"$set": {"qr_token": qr_token}}
        )
        updated_count += 1
    
    # Generate for teachers without qr_token
    teachers_without_qr = await db.users.find({
        "school_id": school_id,
        "role": "teacher",
        "qr_token": {"$exists": False}
    }).to_list(None)
    
    for teacher in teachers_without_qr:
        qr_payload = {
            "teacher_id": teacher["id"],
            "school_id": school_id,
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "type": "teacher_qr"
        }
        qr_token = jwt.encode(qr_payload, JWT_SECRET, algorithm="HS256")
        await db.users.update_one(
            {"id": teacher["id"]},
            {"$set": {"qr_token": qr_token}}
        )
        updated_count += 1
    
    return {
        "message": f"QR generados para {updated_count} usuarios ({len(students_without_qr)} estudiantes, {len(teachers_without_qr)} profesores)",
        "updated_count": updated_count,
        "students_updated": len(students_without_qr),
        "teachers_updated": len(teachers_without_qr)
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
    
    # Get student QR scans (skip if filtering for teachers only)
    if role != "teacher":
        student_records = await db.student_attendance.find({
            "school_id": school_id,
            "date": today,
            "method": "qr_scan"
        }).sort("created_at", -1).limit(limit).to_list(None)
        
        # Cross-reference with attendances collection for entry/exit times
        student_ids_today = [r["student_id"] for r in student_records]
        attendance_records = {}
        if student_ids_today:
            att_list = await db.attendances.find({
                "school_id": school_id, "date": today, "type": "student",
                "user_id": {"$in": student_ids_today}
            }, {"_id": 0, "id": 1, "user_id": 1, "entry_time": 1, "exit_time": 1, "status": 1, "entry_status": 1, "exit_status": 1}).to_list(None)
            attendance_records = {a["user_id"]: a for a in att_list}
        
        for record in student_records:
            student = await db.users.find_one(
                {"id": record["student_id"]},
                {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1, "grado_id": 1, "seccion_id": 1}
            )
            if student:
                grade = await db.grados.find_one({"id": student.get("grado_id")}, {"_id": 0, "nombre": 1})
                section = await db.secciones.find_one({"id": student.get("seccion_id")}, {"_id": 0, "nombre": 1})
                
                att = attendance_records.get(record["student_id"], {})
                entry_t = to_peru_hhmm(att.get("entry_time")) or to_peru_hhmm(record.get("created_at")) or record.get("check_in_time")
                exit_t = to_peru_hhmm(att.get("exit_time"))
                
                history.append({
                    "id": record.get("id"),
                    "attendance_id": att.get("id") or record.get("id"),
                    "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
                    "name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
                    "photo_url": student.get("photo_url"),
                    "grade_name": grade.get("nombre") if grade else None,
                    "section_name": section.get("nombre") if section else None,
                    "role": "student",
                    "status": att.get("status") or record.get("status"),
                    "entry_status": att.get("entry_status", "active"),
                    "exit_status": att.get("exit_status", "active"),
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

# Event types with default colors
EVENT_TYPES = {
    "academic": {"label": "Académico", "color": "#3B82F6"},      # Blue
    "institutional": {"label": "Institucional", "color": "#8B5CF6"},  # Purple
    "administrative": {"label": "Administrativo", "color": "#64748B"},  # Gray
    "holiday": {"label": "Feriado", "color": "#EF4444"},         # Red
    "special": {"label": "Evento especial", "color": "#F59E0B"},  # Amber
    "communication": {"label": "Comunicación", "color": "#10B981"}  # Green
}


# ══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE ANNULMENT
# ══════════════════════════════════════════════════════════════════════════════

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

    # Find the attendance record
    record = await db.attendances.find_one({"id": attendance_id, "school_id": school_id})
    if not record:
        raise HTTPException(status_code=404, detail="Registro de asistencia no encontrado")

    now_iso = datetime.now(timezone.utc).isoformat()
    annulled_by = user["id"]
    annulled_by_name = f"{user.get('name', '')} {user.get('last_name', '')}".strip()

    # Save previous state for audit
    prev_entry_status = record.get("entry_status", "active")
    prev_exit_status = record.get("exit_status", "active")
    prev_entry_time = record.get("entry_time")
    prev_exit_time = record.get("exit_time")

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

    # Derive overall status
    new_entry = update["$set"].get("entry_status", prev_entry_status)
    new_exit = update["$set"].get("exit_status", prev_exit_status)
    if new_entry == "anulado" and new_exit == "anulado":
        update["$set"]["status"] = "anulado"
    elif new_entry == "anulado":
        update["$set"]["status"] = "entrada_anulada"
    elif new_exit == "anulado":
        update["$set"]["status"] = "salida_anulada"

    await db.attendances.update_one({"_id": record["_id"]}, update)

    # Also update legacy student_attendance if student
    if record.get("type") == "student":
        await db.student_attendance.update_one(
            {"student_id": record["user_id"], "date": record["date"], "school_id": school_id},
            {"$set": {
                "status": update["$set"].get("status", record.get("status")),
                "updated_at": now_iso,
            }}
        )

    # Audit log
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
        "previous_entry_time": str(prev_entry_time) if prev_entry_time else None,
        "previous_exit_time": str(prev_exit_time) if prev_exit_time else None,
        "new_entry_status": new_entry,
        "new_exit_status": new_exit,
    }
    await db.attendance_annulment_logs.insert_one(audit)

    logger.info(f"Attendance {attendance_id} annulled ({data.annul_type}) by {annulled_by_name}: {data.reason}")

    return {
        "message": "Asistencia anulada correctamente",
        "attendance_id": attendance_id,
        "annul_type": data.annul_type,
        "new_status": update["$set"].get("status", record.get("status")),
    }



