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
from asyncio import wait_for

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
    area_id: Optional[str] = None
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
    area_id: Optional[str] = None
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
    """Get all subjects for a school — enriched with safe fallbacks"""
    try:
        user = await resolve_user_from_token(current_user)
        if not user or not user.get("school_id"):
            return []

        school_id = user["school_id"]

        # ── 1. QUERY SUBJECTS ────────────────────────────────────────────
        query = {"school_id": school_id}
        if level_id:
            query["level_id"] = level_id
        if grade_id:
            query["grade_id"] = grade_id
        if section_id:
            query["section_id"] = section_id
        if status:
            query["status"] = status

        subjects = await db.subjects.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
        logger.info(f"[GET_SUBJECTS] encontrados={len(subjects)} school_id={school_id}")

        if not subjects:
            return []

        # ── 2. CACHE MULTICOLECCION (levels, grades, sections) ───────────
        # Levels: academic_levels + niveles
        levels = {}
        try:
            for doc in await db.academic_levels.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100):
                if doc.get("id"):
                    levels[doc["id"]] = doc.get("nombre", "")
        except Exception:
            pass
        try:
            for doc in await db.niveles.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100):
                if doc.get("id") and doc["id"] not in levels:
                    levels[doc["id"]] = doc.get("nombre", "")
        except Exception:
            pass

        # Grades: grades + grados
        grades = {}
        try:
            for doc in await db.grades.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1}).to_list(200):
                if doc.get("id"):
                    grades[doc["id"]] = doc
        except Exception:
            pass
        try:
            for doc in await db.grados.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1}).to_list(200):
                if doc.get("id") and doc["id"] not in grades:
                    grades[doc["id"]] = doc
        except Exception:
            pass

        # Sections: sections + secciones
        sections_map = {}
        try:
            for doc in await db.sections.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1}).to_list(500):
                if doc.get("id"):
                    sections_map[doc["id"]] = doc
        except Exception:
            pass
        try:
            for doc in await db.secciones.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1}).to_list(500):
                if doc.get("id") and doc["id"] not in sections_map:
                    sections_map[doc["id"]] = doc
        except Exception:
            pass

        # Users cache
        users_cache = {}
        try:
            for doc in await db.users.find({"school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "profile_image": 1, "photo_url": 1}).to_list(500):
                if doc.get("id"):
                    users_cache[doc["id"]] = doc
        except Exception:
            pass

        # ── 3. TEACHER ASSIGNMENTS: academic_assignments (fuente de verdad) ─
        subject_ids = [s.get("id") for s in subjects if s.get("id")]
        teacher_assignments = {}
        try:
            assign_query = {"school_id": school_id, "subject_id": {"$in": subject_ids}}
            if level_id:
                assign_query["level_id"] = level_id
            if grade_id:
                assign_query["grade_id"] = grade_id
            if section_id:
                assign_query["section_id"] = section_id
            all_assignments = await db.academic_assignments.find(
                assign_query,
                {"_id": 0, "subject_id": 1, "teacher_id": 1, "role": 1, "section_id": 1}
            ).to_list(2000)
            for a in all_assignments:
                sid = a.get("subject_id")
                if sid:
                    teacher_assignments.setdefault(sid, []).append(a)
        except Exception:
            pass

        # ── 4. ENRIQUECER CADA ASIGNATURA (try/except individual) ────────
        result = []
        for subject in subjects:
            try:
                subject["level_name"] = levels.get(subject.get("level_id"), "Sin nivel")

                grade_doc = grades.get(subject.get("grade_id"))
                subject["grade_name"] = grade_doc.get("nombre", "Sin grado") if grade_doc else "Sin grado"

                section_doc = sections_map.get(subject.get("section_id"))
                subject["section_name"] = section_doc.get("nombre", "") if section_doc else ""

                assigns = teacher_assignments.get(subject.get("id"), [])
                subject["teacher_count"] = len(assigns)
                subject["assigned_teachers"] = []

                for a in assigns:
                    teacher = users_cache.get(a.get("teacher_id"))
                    if teacher:
                        subject["assigned_teachers"].append({
                            "id": teacher.get("id", ""),
                            "name": teacher.get("name", ""),
                            "profile_image": teacher.get("profile_image") or teacher.get("photo_url"),
                            "role": a.get("role", "titular")
                        })

                if subject["assigned_teachers"]:
                    titular = next((t for t in subject["assigned_teachers"] if t.get("role") == "titular"), None)
                    subject["primary_teacher"] = titular or subject["assigned_teachers"][0]
                else:
                    subject["primary_teacher"] = None

            except Exception as enrich_err:
                logger.error(f"[GET_SUBJECTS] Error enriching {subject.get('id')}: {enrich_err}")
                subject.setdefault("level_name", "Sin nivel")
                subject.setdefault("grade_name", "Sin grado")
                subject.setdefault("section_name", "")
                subject.setdefault("teacher_count", 0)
                subject.setdefault("assigned_teachers", [])
                subject.setdefault("primary_teacher", None)

            result.append(subject)

        return result
    except Exception as e:
        logger.error(f"[GET_SUBJECTS] CRASH: {type(e).__name__}: {e}")
        return []

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
    
    # Check if school allows teacher in multiple schedules
    allow_multi = False
    try:
        sched_settings = await db.schedule_settings.find_one(
            {"school_id": school_id}, {"_id": 0, "permitir_profesor_multiples_horarios": 1}
        )
        if sched_settings and sched_settings.get("permitir_profesor_multiples_horarios", False):
            allow_multi = True
    except Exception:
        pass
    
    # Build query for academic_assignments
    query = {
        "school_id": school_id,
        "teacher_id": teacher_id
    }
    
    # Always filter by grade/section when provided
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
    
    # Get subjects - also filter by grade/section on the subject itself
    subject_query = {
        "id": {"$in": subject_ids},
        "school_id": school_id
    }
    if grade_id:
        subject_query["grade_id"] = grade_id
    if section_id:
        subject_query["section_id"] = section_id
    
    subjects = await db.subjects.find(subject_query, {"_id": 0}).to_list(100)
    
    # If no subjects found with strict filter, try without grade/section filter on subjects
    # (for subjects that don't have grade_id/section_id stored)
    if not subjects and subject_ids:
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
    """Create a new subject — hardened with detailed logging and structured errors"""
    try:
        # ── 1. LOG INCOMING PAYLOAD ──────────────────────────────────────
        logger.info(f"[CREATE_SUBJECT] Payload: name={data.name!r} code={data.code!r} "
                     f"level_id={data.level_id!r} grade_id={data.grade_id!r} "
                     f"section_id={data.section_id!r} hours={data.weekly_hours}")

        # ── 2. AUTH ──────────────────────────────────────────────────────
        try:
            user = await resolve_user_from_token(current_user)
        except Exception as auth_err:
            logger.error(f"[CREATE_SUBJECT] resolve_user_from_token failed: {auth_err}")
            raise HTTPException(status_code=403, detail="Error al resolver usuario")

        if not user or not user.get("school_id"):
            raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

        if user.get("role") not in ["owner", "admin", "director"]:
            raise HTTPException(status_code=403, detail="No tienes permiso para crear asignaturas")

        school_id = user["school_id"]
        logger.info(f"[CREATE_SUBJECT] User={user['id']} school={school_id} role={user.get('role')}")

        # Use local variables — NEVER mutate the Pydantic model
        safe_name = (data.name or "").strip()
        safe_code = (data.code or "").strip().upper()
        safe_level_id = str(data.level_id) if data.level_id else None
        safe_grade_id = str(data.grade_id) if data.grade_id else None
        safe_section_id = str(data.section_id) if data.section_id else None

        if not safe_name:
            raise HTTPException(status_code=400, detail={
                "error": "Campo requerido vacio", "field": "name",
                "detail": "El nombre de la asignatura es requerido"
            })
        if not safe_code:
            raise HTTPException(status_code=400, detail={
                "error": "Campo requerido vacio", "field": "code",
                "detail": "El codigo de la asignatura es requerido"
            })

        # ── 3. VERIFY LEVEL ─────────────────────────────────────────────
        try:
            level = await db.academic_levels.find_one(
                {"id": safe_level_id, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}
            )
            if not level:
                # Try alternate collection
                level = await db.niveles.find_one(
                    {"id": safe_level_id, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}
                )
        except Exception as lvl_err:
            logger.error(f"[CREATE_SUBJECT] Level lookup error: {lvl_err}")
            level = None

        if not level:
            logger.warning(f"[CREATE_SUBJECT] BLOCKED: level_id={safe_level_id} not found for school={school_id}")
            raise HTTPException(status_code=400, detail={
                "error": "Nivel no encontrado", "field": "level_id",
                "detail": f"El nivel con id '{safe_level_id}' no existe en este colegio",
                "value": safe_level_id
            })
        logger.info(f"[CREATE_SUBJECT] Level OK: {level.get('nombre', '?')}")

        # ── 4. VERIFY GRADE ──────────────────────────────────────────────
        grade = None
        if safe_grade_id:
            try:
                grade = await db.grades.find_one(
                    {"id": safe_grade_id, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1}
                )
                if not grade:
                    grade = await db.grados.find_one(
                        {"id": safe_grade_id, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1}
                    )
            except Exception as grd_err:
                logger.error(f"[CREATE_SUBJECT] Grade lookup error: {grd_err}")
                grade = None

            if not grade:
                logger.warning(f"[CREATE_SUBJECT] BLOCKED: grade_id={safe_grade_id} not found")
                raise HTTPException(status_code=400, detail={
                    "error": "Grado no encontrado", "field": "grade_id",
                    "detail": f"El grado con id '{safe_grade_id}' no existe en este colegio",
                    "value": safe_grade_id
                })
            # FIX PREVENTIVO: derivar level_id del grado para evitar inconsistencias
            if grade.get("nivel_id"):
                derived_level = str(grade["nivel_id"])
                if derived_level != safe_level_id:
                    logger.warning(f"[CREATE_SUBJECT] level_id mismatch: frontend sent {safe_level_id}, grade belongs to {derived_level}. Using grade's level.")
                    safe_level_id = derived_level
            logger.info(f"[CREATE_SUBJECT] Grade OK: {grade.get('nombre', '?')}")

        # ── 5. VERIFY SECTION ────────────────────────────────────────────
        section = None
        if safe_section_id:
            try:
                section = await db.sections.find_one(
                    {"id": safe_section_id, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1}
                )
                if not section:
                    section = await db.secciones.find_one(
                        {"id": safe_section_id, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1}
                    )
            except Exception as sec_err:
                logger.error(f"[CREATE_SUBJECT] Section lookup error: {sec_err}")
                section = None

            if not section:
                logger.warning(f"[CREATE_SUBJECT] BLOCKED: section_id={safe_section_id} not found")
                raise HTTPException(status_code=400, detail={
                    "error": "Seccion no encontrada", "field": "section_id",
                    "detail": f"La seccion con id '{safe_section_id}' no existe en este colegio",
                    "value": safe_section_id
                })
            # Auto-fill grade from section if not provided
            if not safe_grade_id:
                safe_grade_id = section.get("grado_id")
            logger.info(f"[CREATE_SUBJECT] Section OK: {section.get('nombre', '?')}")

        # ── 6. CHECK DUPLICATE NAME ──────────────────────────────────────
        try:
            escaped_name = re.escape(safe_name or "")
            duplicate_query = {
                "school_id": school_id,
                "name": {"$regex": f"^{escaped_name}$", "$options": "i"},
                "level_id": safe_level_id
            }
            if safe_section_id:
                duplicate_query["section_id"] = safe_section_id
            elif safe_grade_id:
                duplicate_query["grade_id"] = safe_grade_id
                duplicate_query["$or"] = [
                    {"section_id": None},
                    {"section_id": {"$exists": False}}
                ]
            else:
                duplicate_query["$or"] = [
                    {"grade_id": None},
                    {"grade_id": {"$exists": False}}
                ]

            logger.info(f"[CREATE_SUBJECT] Duplicate name query: {duplicate_query}")
            existing = await db.subjects.find_one(duplicate_query, {"_id": 0, "id": 1, "name": 1, "section_id": 1})
        except Exception as dup_err:
            logger.error(f"[CREATE_SUBJECT] Duplicate name check error: {dup_err}")
            existing = None

        if existing:
            logger.warning(f"[CREATE_SUBJECT] BLOCKED: duplicate name '{safe_name}' found: {existing}")
            raise HTTPException(status_code=400, detail={
                "error": "Nombre duplicado", "field": "name",
                "detail": f"Ya existe una asignatura '{safe_name}' en esta seccion/grado",
                "existing_id": existing.get("id"),
                "value": safe_name
            })

        # ── 7. CHECK DUPLICATE CODE (SCOPED) ─────────────────────────────
        try:
            if safe_code:
                escaped_code = re.escape(safe_code)
            else:
                escaped_code = None

            code_query = {
                "school_id": school_id,
                "level_id": safe_level_id
            }

            if escaped_code:
                code_query["code"] = {"$regex": f"^{escaped_code}$", "$options": "i"}

            # Caso 1: si hay section_id → validar dentro de esa sección
            if safe_section_id:
                code_query["section_id"] = safe_section_id

            # Caso 2: si NO hay section_id pero SÍ grade_id → validar dentro del grado
            elif safe_grade_id:
                code_query["grade_id"] = safe_grade_id
                code_query["$or"] = [
                    {"section_id": None},
                    {"section_id": {"$exists": False}}
                ]

            # Caso 3: solo nivel
            else:
                code_query["$or"] = [
                    {"grade_id": None},
                    {"grade_id": {"$exists": False}}
                ]

            logger.info(f"[CREATE_SUBJECT] Duplicate code query: {code_query}")
            code_exists = await db.subjects.find_one(code_query, {"_id": 0, "id": 1, "code": 1, "name": 1}) if escaped_code else None
        except Exception as code_err:
            logger.error(f"[CREATE_SUBJECT] Code uniqueness check error: {code_err}")
            code_exists = None

        if code_exists:
            logger.warning(f"[CREATE_SUBJECT] BLOCKED: duplicate code '{safe_code}' found: {code_exists}")
            raise HTTPException(status_code=400, detail={
                "error": "Codigo duplicado", "field": "code",
                "detail": f"El codigo '{safe_code}' ya esta en uso por la asignatura '{code_exists.get('name', '?')}'",
                "existing_id": code_exists.get("id"),
                "value": safe_code
            })

        # ── 8. INSERT ────────────────────────────────────────────────────
        now = datetime.now(timezone.utc).isoformat()

        # Hard validation types
        try:
            weekly_hours = int(data.weekly_hours)
        except Exception:
            weekly_hours = 1
        weekly_hours = max(1, weekly_hours)

        # Clean subject object — all fields explicitly typed
        subject = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "name": str(safe_name),
            "code": str(safe_code),
            "description": str((data.description or "").strip()),
            "level_id": str(safe_level_id),
            "grade_id": str(safe_grade_id) if safe_grade_id else None,
            "section_id": str(safe_section_id) if safe_section_id else None,
            "weekly_hours": weekly_hours,
            "color": str(data.color or "#3B82F6"),
            "status": str(data.status or "active"),
            "image_url": data.image_url if data.image_url else None,
            "area_name": str(data.area_name.strip().upper()) if data.area_name else None,
            "area_order": int(data.area_order) if isinstance(data.area_order, int) else None,
            "created_at": now,
            "updated_at": now
        }

        logger.info(f"[CREATE_SUBJECT] FINAL DOC BEFORE INSERT: {subject}")

        try:
            await wait_for(db.subjects.insert_one(subject), timeout=5)
        except Exception as insert_err:
            logger.error(f"[CREATE_SUBJECT] INSERT FAILED: {insert_err}")
            raise HTTPException(status_code=500, detail={
                "error": "Error de base de datos", "field": "db",
                "detail": f"No se pudo guardar en la base de datos: {str(insert_err)}"
            })

        # Remove _id before returning
        subject.pop("_id", None)

        logger.info(f"[CREATE_SUBJECT] SUCCESS: {subject['name']} ({subject['code']}) id={subject['id']}")

        return {"message": "Asignatura creada correctamente", "subject": subject}

    except HTTPException:
        # Re-raise HTTP exceptions as-is (our explicit validation errors)
        raise
    except Exception as global_err:
        # Catch-all for any unexpected error — never leave the system in a broken state
        logger.error(f"[CREATE_SUBJECT] UNEXPECTED ERROR: {type(global_err).__name__}: {global_err}", exc_info=True)
        raise HTTPException(status_code=500, detail={
            "error": "Error interno inesperado", "field": "unknown",
            "detail": f"{type(global_err).__name__}: {str(global_err)}"
        })

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
            "level_id": None,  # Will be derived from grade below
            "grade_id": target_section.get("grado_id") or src.get("grade_id"),
            "section_id": data.target_section_id,
            "weekly_hours": src.get("weekly_hours", 1),
            "color": src.get("color", "#3B82F6"),
            "status": "active",
            "image_url": src.get("image_url"),
            "created_at": now,
            "updated_at": now,
        }
        # FIX PREVENTIVO: derivar level_id del grado de la sección destino
        target_grade_id = new_subject["grade_id"]
        if target_grade_id:
            tg = await db.grades.find_one({"id": target_grade_id, "school_id": school_id}, {"_id": 0, "nivel_id": 1})
            if tg and tg.get("nivel_id"):
                new_subject["level_id"] = str(tg["nivel_id"])
        if not new_subject["level_id"]:
            new_subject["level_id"] = target_section.get("nivel_id") or src.get("level_id")
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
            # FIX PREVENTIVO: derivar level_id del grado
            if grade.get("nivel_id"):
                update_data["level_id"] = str(grade["nivel_id"])
    
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

@router.post("/academic/subjects/fix-level-ids")
async def fix_subject_level_ids(current_user = Depends(get_current_user)):
    """Migration: fix level_id on subjects whose grade belongs to a different level.
    For each subject with a grade_id, look up the grade's nivel_id and correct
    the subject's level_id if they don't match.  DRY-RUN by default (pass ?apply=true to write)."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if user.get("role") not in ["owner", "admin", "support"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta migración")

    school_id = user["school_id"]

    # Build grade_id → nivel_id map from both collections
    grade_level_map = {}
    for col in [db.grades, db.grados]:
        try:
            docs = await col.find({"school_id": school_id}, {"_id": 0, "id": 1, "nivel_id": 1}).to_list(500)
            for g in docs:
                if g.get("id") and g.get("nivel_id"):
                    grade_level_map[str(g["id"])] = str(g["nivel_id"])
        except Exception:
            pass

    # Fetch all subjects for this school
    subjects = await db.subjects.find({"school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "grade_id": 1, "level_id": 1}).to_list(5000)

    mismatches = []
    fixed = 0
    for s in subjects:
        gid = s.get("grade_id")
        if not gid:
            continue
        correct_level = grade_level_map.get(str(gid))
        if not correct_level:
            continue
        if s.get("level_id") != correct_level:
            mismatches.append({
                "subject_id": s["id"],
                "name": s.get("name"),
                "grade_id": gid,
                "old_level_id": s.get("level_id"),
                "correct_level_id": correct_level
            })
            # Apply the fix
            await db.subjects.update_one(
                {"id": s["id"]},
                {"$set": {"level_id": correct_level, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            fixed += 1

    logger.info(f"[FIX_LEVEL_IDS] school={school_id} total_subjects={len(subjects)} mismatches={len(mismatches)} fixed={fixed}")

    return {
        "message": f"Migración completada: {fixed} asignaturas corregidas de {len(subjects)} totales",
        "total_subjects": len(subjects),
        "mismatches_found": len(mismatches),
        "fixed": fixed,
        "details": mismatches
    }

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
    
    # Check if subject has teacher assignments. We must NOT leave orphaned
    # academic_assignments behind, so block deletion and force the user to
    # unlink the teacher(s) first (in "Asignación Docente").
    assignment_count = await db.academic_assignments.count_documents(
        {"subject_id": subject_id, "school_id": school_id}
    )
    if assignment_count > 0:
        plural = "es" if assignment_count != 1 else ""
        raise HTTPException(
            status_code=400,
            detail=(
                f"No se puede eliminar: el curso tiene {assignment_count} asignación{plural} "
                f"docente{'s' if assignment_count != 1 else ''}. Primero desvincula al/los docente(s) "
                f"de este curso en \"Asignación Docente\" y luego elimínalo."
            ),
        )
    
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

