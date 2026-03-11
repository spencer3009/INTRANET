"""
Subjects (asignaturas) module
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
import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# SUBJECTS MODULE (ASIGNATURAS)
# ══════════════════════════════════════════════════════════════════════════════

# Subject colors for UI
SUBJECT_COLORS = [
    "#3B82F6",  # Blue
    "#10B981",  # Emerald
    "#F59E0B",  # Amber
    "#EF4444",  # Red
    "#8B5CF6",  # Violet
    "#EC4899",  # Pink
    "#06B6D4",  # Cyan
    "#6366F1",  # Indigo
    "#14B8A6",  # Teal
    "#F97316",  # Orange
    "#84CC16",  # Lime
    "#A855F7",  # Purple
]

class SubjectCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = ""
    level_id: str
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    weekly_hours: int = 1
    color: str = "#3B82F6"
    status: str = "active"
    image_url: Optional[str] = None
    area_name: Optional[str] = None
    area_order: Optional[int] = None

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    level_id: Optional[str] = None
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    weekly_hours: Optional[int] = None
    color: Optional[str] = None
    status: Optional[str] = None
    image_url: Optional[str] = None
    area_name: Optional[str] = None
    area_order: Optional[int] = None

class SubjectTeacherAssign(BaseModel):
    teacher_ids: List[str]

# ─────────────────────────────────────────────────────────────────────────────
# SUBJECTS CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/academic/subjects")
async def get_subjects(
    level_id: Optional[str] = None,
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all subjects for a school"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if level_id:
        query["level_id"] = level_id
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    if status:
        query["status"] = status
    
    subjects_cursor = db.subjects.find(query, {"_id": 0}).sort("name", 1)
    subjects = await subjects_cursor.to_list(500)
    
    # Enrich subjects with level and grade names
    levels = {l["id"]: l["nombre"] for l in await db.academic_levels.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)}
    grades = {g["id"]: g for g in await db.grades.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1}).to_list(200)}
    sections_map = {s["id"]: s for s in await db.sections.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1}).to_list(500)}
    
    # Get all users (teachers) for assignment lookup - include both profile_image and photo_url
    users_cache = {u["id"]: u for u in await db.users.find({"school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "profile_image": 1, "photo_url": 1}).to_list(500)}
    
    for subject in subjects:
        subject["level_name"] = levels.get(subject.get("level_id"), "")
        grade = grades.get(subject.get("grade_id"))
        subject["grade_name"] = grade.get("nombre", "") if grade else "Todos"
        section = sections_map.get(subject.get("section_id"))
        subject["section_name"] = section.get("nombre", "") if section else ""
        
        # Get assigned teachers from academic_assignments (the new architecture)
        assignments = await db.academic_assignments.find({
            "school_id": school_id,
            "subject_id": subject["id"],
            "status": "activo"
        }, {"_id": 0, "teacher_id": 1, "role": 1}).to_list(10)
        
        subject["teacher_count"] = len(assignments)
        subject["assigned_teachers"] = []
        
        for assignment in assignments:
            teacher = users_cache.get(assignment.get("teacher_id"))
            if teacher:
                # Use profile_image or photo_url (whichever is available)
                teacher_photo = teacher.get("profile_image") or teacher.get("photo_url")
                subject["assigned_teachers"].append({
                    "id": teacher["id"],
                    "name": teacher["name"],
                    "profile_image": teacher_photo,
                    "role": assignment.get("role", "titular")
                })
        
        # Set primary teacher (first titular, or first if no titular)
        if subject["assigned_teachers"]:
            titular = next((t for t in subject["assigned_teachers"] if t.get("role") == "titular"), None)
            subject["primary_teacher"] = titular or subject["assigned_teachers"][0]
        else:
            subject["primary_teacher"] = None
    
    return subjects

@router.get("/academic/teacher-subjects")
async def get_teacher_subjects(
    teacher_id: str,
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get subjects assigned to a specific teacher, optionally filtered by grade and section"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Build query for academic_assignments
    query = {
        "school_id": school_id,
        "teacher_id": teacher_id
    }
    
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    
    # Get assignments for this teacher
    assignments = await db.academic_assignments.find(query, {"_id": 0}).to_list(100)
    
    # Get unique subject IDs
    subject_ids = list(set([a.get("subject_id") for a in assignments if a.get("subject_id")]))
    
    if not subject_ids:
        return []
    
    # Get subjects
    subjects = await db.subjects.find({
        "id": {"$in": subject_ids},
        "school_id": school_id
    }, {"_id": 0}).to_list(100)
    
    # Add assignment info to each subject
    for subject in subjects:
        assignment = next((a for a in assignments if a.get("subject_id") == subject["id"]), None)
        if assignment:
            subject["assignment_id"] = assignment.get("id")
            subject["role"] = assignment.get("role", "titular")
    
    return subjects

@router.post("/academic/subjects")
async def create_subject(data: SubjectCreate, current_user = Depends(get_current_user)):
    """Create a new subject"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para crear asignaturas")
    
    school_id = user["school_id"]
    
    # Verify level exists
    level = await db.academic_levels.find_one({"id": data.level_id, "school_id": school_id})
    if not level:
        raise HTTPException(status_code=400, detail="El nivel seleccionado no existe")
    
    # Verify grade exists if provided
    if data.grade_id:
        grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
        if not grade:
            raise HTTPException(status_code=400, detail="El grado seleccionado no existe")
    
    # Verify section exists if provided
    if data.section_id:
        section = await db.sections.find_one({"id": data.section_id, "school_id": school_id})
        if not section:
            raise HTTPException(status_code=400, detail="La sección seleccionada no existe")
        # Auto-set grade_id from section if not provided
        if not data.grade_id:
            data.grade_id = section.get("grado_id")
    
    # Check for duplicates (name + level + grade + section)
    duplicate_query = {
        "school_id": school_id,
        "name": {"$regex": f"^{re.escape(data.name.strip())}$", "$options": "i"},
        "level_id": data.level_id
    }
    if data.section_id:
        duplicate_query["section_id"] = data.section_id
    elif data.grade_id:
        duplicate_query["grade_id"] = data.grade_id
        duplicate_query["$or"] = [{"section_id": None}, {"section_id": {"$exists": False}}, {"section_id": ""}]
    else:
        duplicate_query["$or"] = [{"grade_id": None}, {"grade_id": {"$exists": False}}]
    
    existing = await db.subjects.find_one(duplicate_query)
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una asignatura con ese nombre para el mismo nivel/grado")
    
    # Check code uniqueness
    code_exists = await db.subjects.find_one({
        "school_id": school_id,
        "code": {"$regex": f"^{data.code}$", "$options": "i"}
    })
    if code_exists:
        raise HTTPException(status_code=400, detail="El código de asignatura ya está en uso")
    
    now = datetime.now(timezone.utc).isoformat()
    
    subject = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "name": data.name.strip(),
        "code": data.code.strip().upper(),
        "description": data.description.strip() if data.description else "",
        "level_id": data.level_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "weekly_hours": max(1, data.weekly_hours),
        "color": data.color,
        "status": data.status,
        "image_url": data.image_url,
        "area_name": data.area_name.strip().upper() if data.area_name else None,
        "area_order": data.area_order,
        "created_at": now,
        "updated_at": now
    }
    
    await db.subjects.insert_one(subject)
    
    # Remove _id before returning
    subject.pop("_id", None)
    
    logger.info(f"Subject created: {subject['name']} ({subject['code']}) by {user['id']}")
    
    return {"message": "Asignatura creada correctamente", "subject": subject}

class ReplicateSubjectsRequest(BaseModel):
    source_section_id: str
    target_section_id: str

@router.post("/academic/subjects/replicate")
async def replicate_subjects(data: ReplicateSubjectsRequest, current_user = Depends(get_current_user)):
    """Replicate all subjects from one section to another"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para replicar asignaturas")

    school_id = user["school_id"]

    source_section = await db.sections.find_one({"id": data.source_section_id, "school_id": school_id})
    if not source_section:
        raise HTTPException(status_code=404, detail="Seccion origen no encontrada")

    target_section = await db.sections.find_one({"id": data.target_section_id, "school_id": school_id})
    if not target_section:
        raise HTTPException(status_code=404, detail="Seccion destino no encontrada")

    source_subjects = await db.subjects.find({
        "school_id": school_id,
        "section_id": data.source_section_id
    }, {"_id": 0}).to_list(200)

    if not source_subjects:
        raise HTTPException(status_code=400, detail="La seccion origen no tiene asignaturas")

    existing_target = await db.subjects.find({
        "school_id": school_id,
        "section_id": data.target_section_id
    }, {"_id": 0, "name": 1}).to_list(200)
    existing_names = {s["name"].strip().lower() for s in existing_target}

    now = datetime.now(timezone.utc).isoformat()
    created = []
    skipped = []

    for src in source_subjects:
        if src["name"].strip().lower() in existing_names:
            skipped.append(src["name"])
            continue

        base_code = src.get("code", "")
        section_suffix = (target_section.get("nombre", "")[:1] or "X").upper()
        new_code = f"{base_code}-{section_suffix}"
        code_counter = 1
        while await db.subjects.find_one({"school_id": school_id, "code": {"$regex": f"^{re.escape(new_code)}$", "$options": "i"}}):
            new_code = f"{base_code}-{section_suffix}{code_counter}"
            code_counter += 1

        new_subject = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "name": src["name"],
            "code": new_code,
            "description": src.get("description", ""),
            "level_id": target_section.get("nivel_id") or src.get("level_id"),
            "grade_id": target_section.get("grado_id") or src.get("grade_id"),
            "section_id": data.target_section_id,
            "weekly_hours": src.get("weekly_hours", 1),
            "color": src.get("color", "#3B82F6"),
            "status": "active",
            "image_url": src.get("image_url"),
            "created_at": now,
            "updated_at": now,
        }
        await db.subjects.insert_one(new_subject)
        new_subject.pop("_id", None)
        created.append(new_subject)

    logger.info(f"Replicated {len(created)} subjects from section {data.source_section_id} to {data.target_section_id} by {user['id']}")

    return {
        "message": f"Se replicaron {len(created)} asignaturas correctamente",
        "created_count": len(created),
        "skipped_count": len(skipped),
        "skipped_names": skipped,
        "subjects": created,
    }

@router.put("/academic/subjects/{subject_id}")
async def update_subject(subject_id: str, data: SubjectUpdate, current_user = Depends(get_current_user)):
    """Update a subject"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar asignaturas")
    
    school_id = user["school_id"]
    
    # Check subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        # Check for duplicates if name is changing
        duplicate_query = {
            "school_id": school_id,
            "name": {"$regex": f"^{data.name}$", "$options": "i"},
            "level_id": data.level_id if data.level_id else subject["level_id"],
            "id": {"$ne": subject_id}
        }
        grade_id = data.grade_id if data.grade_id is not None else subject.get("grade_id")
        if grade_id:
            duplicate_query["grade_id"] = grade_id
        
        existing = await db.subjects.find_one(duplicate_query)
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe una asignatura con ese nombre para el mismo nivel/grado")
        
        update_data["name"] = data.name.strip()
    
    if data.code is not None:
        # Check code uniqueness
        code_exists = await db.subjects.find_one({
            "school_id": school_id,
            "code": {"$regex": f"^{data.code}$", "$options": "i"},
            "id": {"$ne": subject_id}
        })
        if code_exists:
            raise HTTPException(status_code=400, detail="El código de asignatura ya está en uso")
        update_data["code"] = data.code.strip().upper()
    
    if data.description is not None:
        update_data["description"] = data.description.strip()
    
    if data.level_id is not None:
        level = await db.academic_levels.find_one({"id": data.level_id, "school_id": school_id})
        if not level:
            raise HTTPException(status_code=400, detail="El nivel seleccionado no existe")
        update_data["level_id"] = data.level_id
    
    if data.grade_id is not None:
        if data.grade_id == "":
            update_data["grade_id"] = None
        else:
            grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
            if not grade:
                raise HTTPException(status_code=400, detail="El grado seleccionado no existe")
            update_data["grade_id"] = data.grade_id
    
    if data.section_id is not None:
        if data.section_id == "":
            update_data["section_id"] = None
        else:
            section = await db.sections.find_one({"id": data.section_id, "school_id": school_id})
            if not section:
                raise HTTPException(status_code=400, detail="La sección seleccionada no existe")
            update_data["section_id"] = data.section_id
            if not data.grade_id:
                update_data["grade_id"] = section.get("grado_id")
    
    if data.weekly_hours is not None:
        update_data["weekly_hours"] = max(1, data.weekly_hours)
    
    if data.color is not None:
        update_data["color"] = data.color
    
    if data.status is not None:
        update_data["status"] = data.status
    
    if data.image_url is not None:
        # Delete old image from Cloudinary if exists and is being replaced
        old_image = subject.get("image_url")
        if old_image and "cloudinary.com" in old_image and data.image_url != old_image:
            try:
                parts = old_image.split("/upload/")
                if len(parts) > 1:
                    path_part = parts[1]
                    public_id = path_part.rsplit(".", 1)[0]
                    if "/" in public_id:
                        public_id = public_id.split("/", 1)[1] if public_id.startswith("v") else public_id
                    cloudinary.uploader.destroy(public_id)
            except Exception as e:
                logger.warning(f"Failed to delete old subject image: {e}")
        update_data["image_url"] = data.image_url
    
    await db.subjects.update_one({"id": subject_id}, {"$set": update_data})
    
    updated_subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    
    logger.info(f"Subject updated: {subject_id} by {user['id']}")
    
    return {"message": "Asignatura actualizada correctamente", "subject": updated_subject}


@router.post("/academic/subjects/migrate-to-sections")
async def migrate_subjects_to_sections(current_user = Depends(get_current_user)):
    """Migrate existing subjects without section_id by duplicating them to all sections of their grade"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden realizar la migración")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Find subjects without section_id
    subjects_no_section = await db.subjects.find({
        "school_id": school_id,
        "$or": [{"section_id": None}, {"section_id": {"$exists": False}}, {"section_id": ""}]
    }, {"_id": 0}).to_list(500)
    
    created = 0
    updated = 0
    
    for subj in subjects_no_section:
        grade_id = subj.get("grade_id")
        if not grade_id:
            continue
        
        # Find all sections for this grade
        sections = await db.sections.find({"grado_id": grade_id, "school_id": school_id}, {"_id": 0}).to_list(50)
        
        if len(sections) == 0:
            continue
        
        if len(sections) == 1:
            # Only one section: assign directly to the original subject
            await db.subjects.update_one({"id": subj["id"]}, {"$set": {"section_id": sections[0]["id"], "updated_at": now}})
            updated += 1
        else:
            # Multiple sections: assign first to original, duplicate for the rest
            await db.subjects.update_one({"id": subj["id"]}, {"$set": {"section_id": sections[0]["id"], "updated_at": now}})
            updated += 1
            for sec in sections[1:]:
                # Check if duplicate already exists
                exists = await db.subjects.find_one({
                    "school_id": school_id,
                    "name": subj["name"],
                    "level_id": subj["level_id"],
                    "grade_id": grade_id,
                    "section_id": sec["id"]
                })
                if not exists:
                    new_subj = {**subj, "id": str(uuid.uuid4()), "section_id": sec["id"], "created_at": now, "updated_at": now}
                    new_subj.pop("_id", None)
                    await db.subjects.insert_one(new_subj)
                    created += 1
    
    return {"message": f"Migración completada: {updated} actualizados, {created} nuevos creados", "updated": updated, "created": created}

@router.delete("/academic/subjects/{subject_id}")
async def delete_subject(subject_id: str, current_user = Depends(get_current_user)):
    """Delete a subject"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar asignaturas")
    
    school_id = user["school_id"]
    
    # Check subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Check if subject is linked to schedules
    schedule_link = await db.schedules.find_one({"subject_id": subject_id, "school_id": school_id})
    if schedule_link:
        raise HTTPException(status_code=400, detail="No se puede eliminar: la asignatura está vinculada a horarios")
    
    # Delete subject and related teacher assignments
    await db.subject_teachers.delete_many({"subject_id": subject_id, "school_id": school_id})
    await db.subjects.delete_one({"id": subject_id})
    
    logger.info(f"Subject deleted: {subject_id} by {user['id']}")
    
    return {"message": "Asignatura eliminada correctamente"}

# ─────────────────────────────────────────────────────────────────────────────
# SUBJECT TEACHERS ASSIGNMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/academic/subjects/{subject_id}/teachers")
async def get_subject_teachers(subject_id: str, current_user = Depends(get_current_user)):
    """Get teachers assigned to a subject"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Check subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Get teacher assignments
    assignments = await db.subject_teachers.find(
        {"subject_id": subject_id, "school_id": school_id},
        {"_id": 0}
    ).to_list(100)
    
    teacher_ids = [a["teacher_id"] for a in assignments]
    
    # Get teacher details
    teachers = []
    if teacher_ids:
        teachers_cursor = db.users.find(
            {"id": {"$in": teacher_ids}, "school_id": school_id},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "email": 1, "photo_url": 1, "activo": 1}
        )
        teachers = await teachers_cursor.to_list(100)
    
    return {"subject_id": subject_id, "teachers": teachers}

@router.post("/academic/subjects/{subject_id}/teachers")
async def assign_subject_teachers(subject_id: str, data: SubjectTeacherAssign, current_user = Depends(get_current_user)):
    """Assign teachers to a subject"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para asignar profesores")
    
    school_id = user["school_id"]
    
    # Check subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    if subject.get("status") != "active":
        raise HTTPException(status_code=400, detail="No se pueden asignar profesores a una asignatura inactiva")
    
    # Remove all current assignments
    await db.subject_teachers.delete_many({"subject_id": subject_id, "school_id": school_id})
    
    # Add new assignments
    now = datetime.now(timezone.utc).isoformat()
    
    for teacher_id in data.teacher_ids:
        # Verify teacher exists and is a teacher
        teacher = await db.users.find_one({
            "id": teacher_id,
            "school_id": school_id,
            "role": "teacher"
        })
        
        if teacher:
            assignment = {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "subject_id": subject_id,
                "teacher_id": teacher_id,
                "created_at": now
            }
            await db.subject_teachers.insert_one(assignment)
    
    logger.info(f"Teachers assigned to subject {subject_id}: {data.teacher_ids} by {user['id']}")
    
    return {"message": "Profesores asignados correctamente", "count": len(data.teacher_ids)}

@router.delete("/academic/subjects/{subject_id}/teachers/{teacher_id}")
async def remove_subject_teacher(subject_id: str, teacher_id: str, current_user = Depends(get_current_user)):
    """Remove a teacher from a subject"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para desasignar profesores")
    
    school_id = user["school_id"]
    
    result = await db.subject_teachers.delete_one({
        "subject_id": subject_id,
        "teacher_id": teacher_id,
        "school_id": school_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    logger.info(f"Teacher {teacher_id} removed from subject {subject_id} by {user['id']}")
    
    return {"message": "Profesor desasignado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════

