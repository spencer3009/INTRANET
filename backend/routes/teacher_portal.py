"""
Teacher portal endpoints
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
    require_school,
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# TEACHER PORTAL ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/teacher/profile")
async def get_teacher_profile(current_user = Depends(get_current_user)):
    """Get teacher profile with assigned courses and sections."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher assignments
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    # Get unique sections and courses
    section_ids = list(set([a.get("section_id") for a in assignments if a.get("section_id")]))
    subject_ids = list(set([a.get("subject_id") for a in assignments if a.get("subject_id")]))
    
    sections = []
    if section_ids:
        sections = await db.sections.find({"id": {"$in": section_ids}, "school_id": school_id}, {"_id": 0}).to_list(100)
    
    courses = []
    if subject_ids:
        courses = await db.subjects.find({"id": {"$in": subject_ids}, "school_id": school_id}, {"_id": 0}).to_list(100)
    
    return {
        "user": {
            "id": user["id"],
            "name": user.get("name", ""),
            "last_name": user.get("last_name", ""),
            "email": user.get("email"),
            "photo_url": user.get("photo_url"),
            "role": user.get("role")
        },
        "assigned_courses": courses,
        "assigned_sections": sections,
        "assignments_count": len(assignments),
        "school_id": school_id
    }

@router.get("/teacher/dashboard")
async def get_teacher_dashboard(current_user = Depends(get_current_user)):
    """Get dashboard data for teacher portal."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher assignments
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    subject_ids = list(set([a.get("subject_id") for a in assignments if a.get("subject_id")]))
    section_ids = list(set([a.get("section_id") for a in assignments if a.get("section_id")]))
    
    # Get courses with section info
    courses = []
    for assignment in assignments:
        subject = await db.subjects.find_one({"id": assignment.get("subject_id"), "school_id": school_id}, {"_id": 0})
        section = await db.sections.find_one({"id": assignment.get("section_id"), "school_id": school_id}, {"_id": 0})
        grade = await db.grades.find_one({"id": assignment.get("grade_id"), "school_id": school_id}, {"_id": 0})
        
        if subject:
            # Count students in this section (exclude pending)
            students_count = await db.users.count_documents({
                "school_id": school_id,
                "role": "student",
                "seccion_id": assignment.get("section_id"),
                **ACADEMIC_STUDENT_FILTER
            })
            
            courses.append({
                "id": subject["id"],
                "name": subject.get("name"),
                "color": subject.get("color"),
                "image_url": subject.get("image_url"),
                "section_id": assignment.get("section_id"),
                "section_name": section.get("nombre") if section else None,
                "grade_name": grade.get("nombre") if grade else None,
                "students_count": students_count
            })
    
    # Count total unique students across all sections
    total_students = 0
    if section_ids:
        total_students = await db.users.count_documents({
            "school_id": school_id,
            "role": "student",
            "seccion_id": {"$in": section_ids},
            **ACADEMIC_STUDENT_FILTER
        })
    
    # Count pending reviews (submissions without grades)
    pending_reviews = 0
    recent_submissions = []
    if subject_ids:
        tasks = await db.course_posts.find({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "type": "task"
        }, {"_id": 0}).to_list(200)
        
        for task in tasks:
            for submission in task.get("submissions", []):
                if submission.get("grade") is None:
                    pending_reviews += 1
                    # Get student info for recent submissions
                    student = await db.users.find_one({"id": submission.get("student_id")}, {"_id": 0})
                    recent_submissions.append({
                        "id": f"{task['id']}-{submission.get('student_id')}",
                        "task_id": task["id"],
                        "task_title": task.get("title"),
                        "student_id": submission.get("student_id"),
                        "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Alumno",
                        "student_photo": student.get("photo_url") if student else None,
                        "submitted_at": submission.get("submitted_at"),
                        "graded": False
                    })
        
        # Sort and limit recent submissions
        recent_submissions.sort(key=lambda x: x.get("submitted_at", ""), reverse=True)
        recent_submissions = recent_submissions[:5]
    
    # Check today's attendance
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_attendance_pending = []
    for section_id in section_ids:
        # Check if attendance was already taken for this section today
        existing = await db.attendance.find_one({
            "school_id": school_id,
            "section_id": section_id,
            "date": today
        })
        if not existing:
            section = await db.sections.find_one({"id": section_id, "school_id": school_id}, {"_id": 0})
            if section:
                today_attendance_pending.append({
                    "section_id": section_id,
                    "section_name": section.get("nombre")
                })
    
    # Unread messages
    unread_messages = await db.institutional_messages.count_documents({
        "school_id": school_id,
        "read_by": {"$ne": user["id"]}
    })
    
    # Recent announcements (from announcements collection)
    announcements_cursor = db.announcements.find({
        "school_id": school_id,
        "active": True
    }, {"_id": 0}).sort("created_at", -1).limit(5)
    announcements_list = await announcements_cursor.to_list(5)
    
    recent_announcements = []
    for ann in announcements_list:
        recent_announcements.append({
            "id": ann.get("id"),
            "title": ann.get("title"),
            "content": ann.get("content"),
            "priority": ann.get("priority", "normal"),
            "created_at": ann.get("created_at"),
            "is_read": user["id"] in ann.get("read_by", [])
        })
    
    return {
        "courses": courses,
        "total_students": total_students,
        "pending_reviews": pending_reviews,
        "recent_submissions": recent_submissions,
        "today_attendance_pending": today_attendance_pending,
        "unread_messages": unread_messages,
        "recent_announcements": recent_announcements
    }

@router.get("/teacher/courses")
async def get_teacher_courses(current_user = Depends(get_current_user)):
    """Get all courses assigned to teacher."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher assignments
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    courses = []
    for assignment in assignments:
        subject = await db.subjects.find_one({"id": assignment.get("subject_id"), "school_id": school_id}, {"_id": 0})
        section = await db.sections.find_one({"id": assignment.get("section_id"), "school_id": school_id}, {"_id": 0})
        grade = await db.grades.find_one({"id": assignment.get("grade_id"), "school_id": school_id}, {"_id": 0})
        
        # Get level name from grade
        level_name = None
        if grade and grade.get("nivel_id"):
            level = await db.academic_levels.find_one({"id": grade["nivel_id"], "school_id": school_id}, {"_id": 0})
            level_name = level.get("nombre") if level else None
        
        if subject:
            # Count students (exclude pending)
            students_count = await db.users.count_documents({
                "school_id": school_id,
                "role": "student",
                "seccion_id": assignment.get("section_id"),
                **ACADEMIC_STUDENT_FILTER
            })
            
            # Count materials and tasks
            materials_count = await db.course_posts.count_documents({
                "school_id": school_id,
                "subject_id": subject["id"],
                "type": "material"
            })
            tasks_count = await db.course_posts.count_documents({
                "school_id": school_id,
                "subject_id": subject["id"],
                "type": "task"
            })
            
            courses.append({
                "id": subject["id"],
                "name": subject.get("name"),
                "description": subject.get("description"),
                "color": subject.get("color"),
                "image_url": subject.get("image_url"),
                "section_id": assignment.get("section_id"),
                "section_name": section.get("nombre") if section else None,
                "grade_id": assignment.get("grade_id"),
                "grade_name": grade.get("nombre") if grade else None,
                "level_name": level_name,
                "students_count": students_count,
                "materials_count": materials_count,
                "tasks_count": tasks_count
            })
    
    return {"courses": courses}

@router.get("/teacher/students")
async def get_teacher_students(
    section_id: str = None,
    current_user = Depends(get_current_user)
):
    """Get students from teacher's assigned sections."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher's assigned sections
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    allowed_section_ids = list(set([a.get("section_id") for a in assignments if a.get("section_id")]))
    
    if not allowed_section_ids:
        return {"students": [], "sections": []}
    
    # Filter by specific section if provided
    if section_id and section_id in allowed_section_ids:
        query_sections = [section_id]
    else:
        query_sections = allowed_section_ids
    
    # Get students (exclude pending)
    students = await db.users.find({
        "school_id": school_id,
        "role": "student",
        "seccion_id": {"$in": query_sections},
        **ACADEMIC_STUDENT_FILTER
    }, {"_id": 0, "password": 0}).to_list(500)
    
    # Get section info for each student
    sections_map = {}
    for sid in allowed_section_ids:
        section = await db.sections.find_one({"id": sid, "school_id": school_id}, {"_id": 0})
        if section:
            sections_map[sid] = section
    
    # Get grades and levels info
    grades_map = {}
    levels_map = {}
    grades = await db.grades.find({"school_id": school_id}, {"_id": 0}).to_list(200)
    levels = await db.academic_levels.find({"school_id": school_id}, {"_id": 0}).to_list(50)
    
    for grade in grades:
        grades_map[grade["id"]] = grade
    for level in levels:
        levels_map[level["id"]] = level
    
    # Enrich student data
    enriched_students = []
    for student in students:
        section = sections_map.get(student.get("seccion_id"), {})
        grade = grades_map.get(student.get("grado_id"), {})
        level = levels_map.get(grade.get("nivel_id"), {})
        
        enriched_students.append({
            "id": student["id"],
            "name": student.get("name", ""),
            "last_name": student.get("last_name", ""),
            "photo_url": student.get("photo_url"),
            "email": student.get("email"),
            "phone": student.get("phone"),
            "section_id": student.get("seccion_id"),
            "section_name": section.get("nombre"),
            "grade_id": student.get("grado_id"),
            "grade_name": grade.get("nombre"),
            "level_id": grade.get("nivel_id"),
            "level_name": level.get("nombre"),
            "qr_code": student.get("qr_code"),
            "created_at": student.get("created_at")
        })
    
    # Get sections for filter dropdown
    sections = [{"id": s["id"], "nombre": s.get("nombre")} for s in sections_map.values()]
    
    return {"students": enriched_students, "sections": sections}

@router.get("/teacher/students/{student_id}")
async def get_teacher_student_detail(
    student_id: str,
    current_user = Depends(get_current_user)
):
    """Get detailed academic info for a specific student (read-only view for teachers)."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher's assigned sections
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    allowed_section_ids = list(set([a.get("section_id") for a in assignments if a.get("section_id")]))
    
    # Get student - verify teacher has access
    student = await db.users.find_one({
        "id": student_id,
        "school_id": school_id,
        "role": "student",
        "seccion_id": {"$in": allowed_section_ids}
    }, {"_id": 0, "password": 0})
    
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado o sin acceso")
    
    # Get attendance summary (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    attendance_records = await db.attendance.find({
        "school_id": school_id,
        "student_id": student_id,
        "date": {"$gte": thirty_days_ago}
    }, {"_id": 0}).to_list(100)
    
    attendance_summary = {
        "present": sum(1 for a in attendance_records if a.get("status") == "present"),
        "absent": sum(1 for a in attendance_records if a.get("status") == "absent"),
        "late": sum(1 for a in attendance_records if a.get("status") == "late"),
        "justified": sum(1 for a in attendance_records if a.get("status") == "justified")
    }
    
    # Get grades summary
    grades_records = await db.grades.find({
        "school_id": school_id,
        "student_id": student_id
    }, {"_id": 0}).to_list(100)
    
    grades_values = [g.get("grade") for g in grades_records if g.get("grade") is not None]
    grades_summary = {
        "average": sum(grades_values) / len(grades_values) if grades_values else None,
        "subjects_count": len(set([g.get("subject_id") for g in grades_records]))
    }
    
    # Get pending tasks count
    subject_ids = [a.get("subject_id") for a in assignments]
    pending_tasks = await db.course_posts.count_documents({
        "school_id": school_id,
        "subject_id": {"$in": subject_ids},
        "type": "task",
        "submissions.student_id": {"$ne": student_id},
        "due_date": {"$gte": datetime.now(timezone.utc).isoformat()}
    })
    
    return {
        "user": student,
        "attendance_summary": attendance_summary,
        "grades_summary": grades_summary,
        "pending_tasks": pending_tasks
    }

@router.get("/teacher/tasks")
async def get_teacher_tasks(current_user = Depends(get_current_user)):
    """Get all tasks created by or assigned to teacher's courses."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher assignments
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    subject_ids = list(set([a.get("subject_id") for a in assignments if a.get("subject_id")]))
    
    if not subject_ids:
        return {"tasks": []}
    
    # Get tasks from teacher's courses (match both type and post_type for compatibility)
    tasks = await db.course_posts.find({
        "school_id": school_id,
        "subject_id": {"$in": subject_ids},
        "$or": [{"type": "task"}, {"post_type": "task"}]
    }, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with subject/section info
    enriched_tasks = []
    for task in tasks:
        subject = await db.subjects.find_one({"id": task.get("subject_id"), "school_id": school_id}, {"_id": 0})
        
        # Get assignment for section info
        assignment = next((a for a in assignments if a.get("subject_id") == task.get("subject_id")), None)
        section = None
        if assignment and assignment.get("section_id"):
            section = await db.sections.find_one({"id": assignment.get("section_id"), "school_id": school_id}, {"_id": 0})
        
        # Count submissions and pending reviews
        submissions = task.get("submissions", [])
        pending_reviews = sum(1 for s in submissions if s.get("grade") is None)
        
        enriched_tasks.append({
            "id": task["id"],
            "title": task.get("title"),
            "content": task.get("content"),
            "due_date": task.get("due_date") or task.get("metadata", {}).get("due_date"),
            "subject_id": task.get("subject_id"),
            "subject_name": subject.get("name") if subject else "Sin asignatura",
            "course_color": subject.get("color") if subject else "#F59E0B",
            "section_name": section.get("nombre") if section else None,
            "submissions_count": len(submissions),
            "pending_reviews": pending_reviews,
            "created_at": task.get("created_at")
        })
    
    return {"tasks": enriched_tasks}

@router.get("/teacher/grades")
async def get_teacher_grades(
    subject_id: str,
    section_id: str,
    current_user = Depends(get_current_user)
):
    """Get grades for a specific subject/section."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Verify teacher has access to this subject/section
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "teacher_id": user["id"],
        "subject_id": subject_id,
        "section_id": section_id
    })
    
    if not assignment:
        raise HTTPException(status_code=403, detail="No tienes acceso a este curso/sección")
    
    # Get grades
    grades = await db.grades.find({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": section_id
    }, {"_id": 0}).to_list(500)
    
    return {"grades": grades}

class GradeEntry(BaseModel):
    student_id: str
    grade: Optional[float] = None

class SaveGradesRequest(BaseModel):
    subject_id: str
    section_id: str
    grades: List[GradeEntry]

@router.post("/teacher/grades")
async def save_teacher_grades(data: SaveGradesRequest, current_user = Depends(get_current_user)):
    """Save grades for students in a subject/section."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Verify teacher has access
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "teacher_id": user["id"],
        "subject_id": data.subject_id,
        "section_id": data.section_id
    })
    
    if not assignment:
        raise HTTPException(status_code=403, detail="No tienes acceso a este curso/sección")
    
    # Save each grade
    for entry in data.grades:
        if entry.grade is None:
            # Delete grade if null
            await db.grades.delete_one({
                "school_id": school_id,
                "subject_id": data.subject_id,
                "section_id": data.section_id,
                "student_id": entry.student_id
            })
        else:
            # Upsert grade
            await db.grades.update_one(
                {
                    "school_id": school_id,
                    "subject_id": data.subject_id,
                    "section_id": data.section_id,
                    "student_id": entry.student_id
                },
                {
                    "$set": {
                        "grade": entry.grade,
                        "teacher_id": user["id"],
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "school_id": school_id,
                        "subject_id": data.subject_id,
                        "section_id": data.section_id,
                        "student_id": entry.student_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                upsert=True
            )
    
    return {"message": "Notas guardadas correctamente", "count": len(data.grades)}

@router.get("/teacher/attendance")
async def get_teacher_attendance(
    section_id: str,
    date: str,
    current_user = Depends(get_current_user)
):
    """Get attendance records for a section on a specific date."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Verify teacher has access to this section
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "teacher_id": user["id"],
        "section_id": section_id
    })
    
    if not assignment:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta sección")
    
    # Get attendance records from attendances collection (compatible with reports)
    records = await db.attendances.find({
        "school_id": school_id,
        "section_id": section_id,
        "date": date,
        "type": "student"
    }, {"_id": 0}).to_list(500)
    
    # Map user_id to student_id for frontend compatibility and include entry/exit
    formatted_records = []
    for r in records:
        entry_time_str = to_peru_hhmm(r.get("entry_time")) or r.get("check_in_time")
        exit_time_str = to_peru_hhmm(r.get("exit_time"))
        formatted_records.append({
            "student_id": r.get("user_id", r.get("student_id")),
            "status": r.get("status"),
            "entry_time": entry_time_str,
            "exit_time": exit_time_str,
            "entry_method": r.get("entry_method"),
            "exit_method": r.get("exit_method"),
            "total_minutes": r.get("total_minutes")
        })
    
    return {"records": formatted_records}

class AttendanceRecord(BaseModel):
    student_id: str
    status: str  # present, absent, late, justified

class SaveAttendanceRequest(BaseModel):
    section_id: str
    date: str
    records: List[AttendanceRecord]

@router.post("/teacher/attendance")
async def save_teacher_student_attendance(data: SaveAttendanceRequest, current_user = Depends(get_current_user)):
    """Save attendance records for a section (teacher recording student attendance)."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Verify teacher has access
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "teacher_id": user["id"],
        "section_id": data.section_id
    })
    
    if not assignment:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta sección")
    
    # Get section info to obtain grade_id
    section = await db.academic_sections.find_one({"id": data.section_id}, {"_id": 0})
    grade_id = section.get("grado_id") if section else None
    
    # Validate date format
    try:
        datetime.strptime(data.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (YYYY-MM-DD)")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Save each attendance record to attendances collection (compatible with reports)
    for record in data.records:
        await db.attendances.update_one(
            {
                "school_id": school_id,
                "section_id": data.section_id,
                "date": data.date,
                "user_id": record.student_id,
                "type": "student"
            },
            {
                "$set": {
                    "status": record.status,
                    "recorded_by": user["id"],
                    "updated_at": now
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "section_id": data.section_id,
                    "grade_id": grade_id,
                    "date": data.date,
                    "user_id": record.student_id,
                    "type": "student",
                    "created_at": now
                }
            },
            upsert=True
        )
    
    return {"message": "Asistencia guardada correctamente", "count": len(data.records)}

@router.get("/dashboard/events")
async def get_events(current_user=Depends(require_school)):
    """Get upcoming events for current school from calendar_events"""
    user = await resolve_user_from_token(current_user)
    school_id = (user or {}).get("school_id") or current_user.get("school_id")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get upcoming events from calendar_events (real data)
    events_cursor = db.calendar_events.find(
        {"school_id": school_id, "start_date": {"$gte": today}},
        {"_id": 0}
    ).sort("start_date", 1).limit(10)
    events = await events_cursor.to_list(10)
    
    # Transform to the expected format
    result = []
    for e in events:
        result.append({
            "id": e.get("id", ""),
            "title": e.get("title", ""),
            "date": e.get("start_date", ""),
            "time": e.get("start_time", ""),
            "category": e.get("type", "evento"),
            "color": e.get("color", "#001f4b"),
            "description": e.get("description", ""),
            "location": e.get("location", ""),
            "end_date": e.get("end_date", ""),
            "all_day": e.get("all_day", True),
        })
    
    return result

@router.get("/dashboard/enrollment")
async def get_enrollment(current_user=Depends(require_school)):
    """Get real enrollment data per month for current school"""
    user = await resolve_user_from_token(current_user)
    school_id = (user or {}).get("school_id") or current_user.get("school_id")
    
    year = datetime.now(timezone.utc).year
    current_month = datetime.now(timezone.utc).month
    months_es = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
    
    # Count students created up to the end of each month
    total_students = await db.users.count_documents({"school_id": school_id, "role": "student", **ACADEMIC_STUDENT_FILTER})
    
    result = []
    for month_idx in range(12):
        month_num = month_idx + 1
        if month_num > current_month:
            break
        result.append({"month": months_es[month_idx], "students": total_students})
    
    return result

@router.get("/dashboard/school")
async def get_school_info(current_user=Depends(require_school)):
    """Get current user's school info - REQUIRES SCHOOL"""
    school_id = current_user.get("school_id")
    
    school = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "password": 0}
    )
    
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    # Calculate pricing info for subscription card
    global_pricing = await db.pricing_config.find_one({"id": "global"}, {"_id": 0})
    if not global_pricing:
        global_pricing = {"billing_mode": "base_plus_student", "base_monthly_fee": 50.0, "per_student_fee": 0.70, "per_student_from_month": 3, "flat_fee": 0.0}
    
    override = school.get("pricing_override")
    def _ev(key, default):
        if override and key in override:
            return override[key]
        return global_pricing.get(key, default)
    
    eff_mode = _ev("billing_mode", "base_plus_student")
    eff_base = _ev("base_monthly_fee", 50.0)
    eff_student_fee = _ev("per_student_fee", 0.70)
    eff_from_month = _ev("per_student_from_month", 3)
    eff_flat = _ev("flat_fee", 0.0)
    
    student_count = await db.users.count_documents({"school_id": school_id, "role": "student"})
    
    months_active = 1
    if school.get("created_at"):
        try:
            created = datetime.fromisoformat(str(school["created_at"]).replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            months_active = max(1, (now.year - created.year) * 12 + now.month - created.month + 1)
        except Exception:
            pass
    
    # Use same calc_price logic
    if eff_mode == "flat_fee":
        calculated_price = round(eff_flat, 2)
        student_charge = 0.0
        base_charge = round(eff_flat, 2)
    elif eff_mode == "student_only":
        student_charge = round(student_count * eff_student_fee, 2) if months_active >= eff_from_month else 0.0
        calculated_price = student_charge
        base_charge = 0.0
    else:
        student_charge = round(student_count * eff_student_fee, 2) if months_active >= eff_from_month else 0.0
        base_charge = eff_base
        calculated_price = round(base_charge + student_charge, 2)
    
    school["pricing"] = {
        "billing_mode": eff_mode,
        "calculated_price": calculated_price,
        "base_charge": base_charge,
        "student_charge": student_charge,
        "per_student_fee": eff_student_fee,
        "per_student_from_month": eff_from_month,
        "flat_fee": eff_flat,
        "student_count": student_count,
        "months_active": months_active,
        "per_student_applies": eff_mode != "flat_fee" and months_active >= eff_from_month
    }
    
    return school

# ══════════════════════════════════════════════════════════════════════════════

