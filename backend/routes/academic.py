"""
Academic structure: levels, grades, sections, shifts, years, periods, assignments
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
import unicodedata
import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# ACADEMIC SETTINGS - NIVELES EDUCATIVOS
# ══════════════════════════════════════════════════════════════════════════════

class AcademicLevelCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    activo: bool = True
    orden: int = 0
    crear_grados_estandar: bool = False

class AcademicLevelUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    activo: Optional[bool] = None
    orden: Optional[int] = None

@router.get("/academic/levels")
async def get_academic_levels(
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all academic levels for the current tenant"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    if activo is not None:
        query["activo"] = activo
    
    levels = await db.academic_levels.find(query, {"_id": 0}).sort("orden", 1).to_list(100)
    
    # Add grade count for each level
    for level in levels:
        grade_count = await db.grades.count_documents({
            "school_id": user["school_id"],
            "nivel_id": level["id"]
        })
        level["grade_count"] = grade_count
    
    return levels

@router.post("/academic/levels")
async def create_academic_level(
    data: AcademicLevelCreate,
    current_user = Depends(get_current_user)
):
    """Create a new academic level"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear niveles")
    
    # Check for duplicate name
    existing = await db.academic_levels.find_one({
        "school_id": user["school_id"],
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un nivel con ese nombre")
    
    # Get next order number if not provided
    if data.orden == 0:
        max_order = await db.academic_levels.find_one(
            {"school_id": user["school_id"]},
            sort=[("orden", -1)]
        )
        next_order = (max_order.get("orden", 0) + 1) if max_order else 1
    else:
        next_order = data.orden

    level = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "nombre": data.nombre,
        "descripcion": data.descripcion,
        "imagen_url": data.imagen_url,
        "activo": data.activo,
        "orden": next_order,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.academic_levels.insert_one(level)
    level.pop("_id", None)
    level["grade_count"] = 0
    
    # Auto-create standard grades for Primaria/Secundaria
    created_grades = []
    if data.crear_grados_estandar:
        nombre_norm = unicodedata.normalize("NFD", data.nombre.strip()).encode("ascii", "ignore").decode("ascii").upper()
        standard_grades = []
        if nombre_norm == "PRIMARIA":
            standard_grades = [("1°", 1), ("2°", 2), ("3°", 3), ("4°", 4), ("5°", 5), ("6°", 6)]
        elif nombre_norm == "SECUNDARIA":
            standard_grades = [("1°", 1), ("2°", 2), ("3°", 3), ("4°", 4), ("5°", 5)]
        elif nombre_norm == "INICIAL":
            standard_grades = [("3 AÑOS", 1), ("4 AÑOS", 2), ("5 AÑOS", 3)]
        
        now = datetime.now(timezone.utc).isoformat()
        for grade_name, orden in standard_grades:
            existing_grade = await db.grades.find_one({
                "school_id": user["school_id"],
                "nivel_id": level["id"],
                "nombre": {"$regex": f"^{re.escape(grade_name)}$", "$options": "i"}
            })
            if not existing_grade:
                grade_doc = {
                    "id": str(uuid.uuid4()),
                    "school_id": user["school_id"],
                    "nombre": grade_name,
                    "nivel_id": level["id"],
                    "orden": orden,
                    "activo": True,
                    "created_at": now,
                    "updated_at": now
                }
                await db.grades.insert_one(grade_doc)
                grade_doc.pop("_id", None)
                created_grades.append(grade_doc)
        
        level["grade_count"] = len(created_grades)
    
    return {"message": "Nivel creado correctamente", "level": level, "created_grades": created_grades}

@router.put("/academic/levels/{level_id}")
async def update_academic_level(
    level_id: str,
    data: AcademicLevelUpdate,
    current_user = Depends(get_current_user)
):
    """Update an academic level"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar niveles")
    
    # Find the level
    level = await db.academic_levels.find_one({
        "id": level_id,
        "school_id": user["school_id"]
    })
    if not level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    
    # Check for duplicate name if name is being changed
    if data.nombre and data.nombre.lower() != level["nombre"].lower():
        existing = await db.academic_levels.find_one({
            "school_id": user["school_id"],
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": level_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un nivel con ese nombre")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.descripcion is not None:
        update_data["descripcion"] = data.descripcion
    if data.imagen_url is not None:
        update_data["imagen_url"] = data.imagen_url
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.academic_levels.update_one({"id": level_id}, {"$set": update_data})
    
    # Get updated level
    updated_level = await db.academic_levels.find_one({"id": level_id}, {"_id": 0})
    grade_count = await db.grades.count_documents({
        "school_id": user["school_id"],
        "nivel_id": level_id
    })
    updated_level["grade_count"] = grade_count
    
    return {"message": "Nivel actualizado correctamente", "level": updated_level}

@router.delete("/academic/levels/{level_id}")
async def delete_academic_level(
    level_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an academic level (only if no grades are associated)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar niveles")
    
    # Find the level
    level = await db.academic_levels.find_one({
        "id": level_id,
        "school_id": user["school_id"]
    })
    if not level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    
    # Check if level has grades
    grade_count = await db.grades.count_documents({
        "school_id": user["school_id"],
        "nivel_id": level_id
    })
    if grade_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar el nivel porque tiene {grade_count} grado(s) asociado(s). Elimina primero los grados."
        )
    
    # Delete image from Cloudinary if exists
    if level.get("imagen_url") and "cloudinary.com" in level["imagen_url"]:
        try:
            parts = level["imagen_url"].split("/upload/")
            if len(parts) > 1:
                path_with_ext = parts[1]
                if path_with_ext.startswith("v"):
                    path_with_ext = "/".join(path_with_ext.split("/")[1:])
                public_id = path_with_ext.rsplit(".", 1)[0]
                cloudinary.uploader.destroy(public_id)
        except Exception as e:
            logger.error(f"Error deleting Cloudinary image: {e}")
    
    await db.academic_levels.delete_one({"id": level_id})
    
    return {"message": "Nivel eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - GRADOS
# ══════════════════════════════════════════════════════════════════════════════

class GradeCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    nivel_id: str
    orden: Optional[int] = 0
    activo: bool = True

class GradeUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    nivel_id: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None

@router.get("/academic/grades")
async def get_grades(
    nivel_id: Optional[str] = None,
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all grades for the current tenant"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    if nivel_id:
        query["nivel_id"] = nivel_id
    if activo is not None:
        query["activo"] = activo
    
    grades_raw = await db.grades.find(query).sort([("nivel_id", 1), ("orden", 1)]).to_list(200)
    
    logger.info(f"=== DEBUG GRADES === school_id={user['school_id']}, raw count={len(grades_raw)}")
    for g in grades_raw[:3]:
        logger.info(f"  Grade RAW: _id={g.get('_id')} type={type(g.get('_id')).__name__}, id={g.get('id')} type={type(g.get('id')).__name__ if g.get('id') else 'NONE'}, nombre={g.get('nombre')}")
    
    # Normalize: ensure every grade has a string `id` field
    grades = []
    for g in grades_raw:
        g["id"] = str(g.get("id") or g.get("_id"))
        g.pop("_id", None)
        grades.append(g)
    
    # Add level info and section count for each grade
    levels_cache = {}
    for grade in grades:
        # Get level info
        nivel_id = grade.get("nivel_id")
        if nivel_id and nivel_id not in levels_cache:
            level = await db.academic_levels.find_one({"id": nivel_id}, {"_id": 0, "nombre": 1})
            levels_cache[nivel_id] = level["nombre"] if level else "Sin nivel"
        grade["nivel_nombre"] = levels_cache.get(nivel_id, "Sin nivel")
        
        # Get section count
        section_count = await db.sections.count_documents({
            "school_id": user["school_id"],
            "grado_id": grade["id"]
        })
        grade["section_count"] = section_count
    
    return grades

def validate_grade_name(nombre: str, level_name: str = "") -> str:
    """
    Validate that a grade name does not contain section-like patterns.
    Returns error message if invalid, empty string if valid.
    """
    clean = nombre.strip()
    upper = clean.upper()
    
    # Patterns that indicate a section was mixed into the grade name
    # Single letter at end: "4 AÑOS A", "1° B"
    if re.search(r'\s+[A-Z]$', upper) and not re.search(r'\d+\s*AÑOS$', upper):
        return "section_pattern"
    # Explicit: ends with single letter after grade-like content
    if re.search(r'(AÑOS|°|GRADO)\s+[A-Z]$', upper):
        return "section_pattern"
    # Common section words
    section_words = ["SECCION", "SECCIÓN", "AULA", "ALAMO", "ÁLAMO", "ROBLE", "CEDRO", "PINO", "SAUCE", "OLIVO"]
    for word in section_words:
        if word in upper and word != upper:
            return "section_word"
    # Pattern: "X AÑOS <extra_text>" where extra_text is not empty
    m = re.match(r'^(\d+)\s*(AÑOS?)\s+(.+)$', upper)
    if m and m.group(3).strip():
        extra = m.group(3).strip()
        # Allow if extra is just ordinal-like (e.g. nothing else)
        if len(extra) <= 2 or extra in section_words:
            return "section_pattern"
    # Pattern: grade + letter: "1°A", "2° B", "PRIMERO A"
    if re.search(r'°\s*[A-Z]$', upper):
        return "section_pattern"
    
    return ""

@router.post("/academic/grades")
async def create_grade(
    data: GradeCreate,
    current_user = Depends(get_current_user)
):
    """Create a new grade"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear grados")
    
    # Verify level exists
    level = await db.academic_levels.find_one({
        "id": data.nivel_id,
        "school_id": user["school_id"]
    })
    if not level:
        raise HTTPException(status_code=400, detail="El nivel educativo no existe")
    
    # Strict validation: only allow preset grades for standard levels
    VALID_GRADES_BY_LEVEL = {
        "INICIAL": ["3 AÑOS", "4 AÑOS", "5 AÑOS"],
        "PRIMARIA": ["1°", "2°", "3°", "4°", "5°", "6°"],
        "SECUNDARIA": ["1°", "2°", "3°", "4°", "5°"],
    }
    level_name_norm = unicodedata.normalize("NFD", level.get("nombre", "").strip()).encode("ascii", "ignore").decode("ascii").upper()
    if level_name_norm in VALID_GRADES_BY_LEVEL:
        allowed = [g.upper() for g in VALID_GRADES_BY_LEVEL[level_name_norm]]
        if data.nombre.strip().upper() not in allowed:
            raise HTTPException(status_code=400, detail=f"Grado inválido para {level.get('nombre')}. Solo se permite: {', '.join(VALID_GRADES_BY_LEVEL[level_name_norm])}")
    
    # Validate grade name doesn't contain section patterns
    validation_error = validate_grade_name(data.nombre, level.get("nombre", ""))
    if validation_error:
        raise HTTPException(
            status_code=400,
            detail="El nombre parece incluir una sección (ej: A, B, Álamo). Crea el grado como '4 AÑOS' y luego agrega la sección desde 'Agregar sección'."
        )
    
    # Check for duplicate name within the same level
    existing = await db.grades.find_one({
        "school_id": user["school_id"],
        "nivel_id": data.nivel_id,
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un grado con ese nombre en este nivel")
    
    # Auto-calculate order if not provided
    orden = data.orden
    if orden == 0:
        last_grade = await db.grades.find_one(
            {"school_id": user["school_id"], "nivel_id": data.nivel_id},
            sort=[("orden", -1)]
        )
        orden = (last_grade["orden"] + 1) if last_grade else 1
    
    grade = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "nombre": data.nombre,
        "nivel_id": data.nivel_id,
        "orden": orden,
        "activo": data.activo,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.grades.insert_one(grade)
    grade.pop("_id", None)
    grade["nivel_nombre"] = level["nombre"]
    grade["section_count"] = 0
    
    return {"message": "Grado creado correctamente", "grade": grade}

@router.put("/academic/grades/{grade_id}")
async def update_grade(
    grade_id: str,
    data: GradeUpdate,
    current_user = Depends(get_current_user)
):
    """Update a grade"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar grados")
    
    # Find the grade
    grade = await db.grades.find_one({
        "id": grade_id,
        "school_id": user["school_id"]
    })
    if not grade:
        raise HTTPException(status_code=404, detail="Grado no encontrado")
    
    # If changing level, verify new level exists
    new_nivel_id = data.nivel_id if data.nivel_id else grade["nivel_id"]
    if data.nivel_id and data.nivel_id != grade["nivel_id"]:
        level = await db.academic_levels.find_one({
            "id": data.nivel_id,
            "school_id": user["school_id"]
        })
        if not level:
            raise HTTPException(status_code=400, detail="El nivel educativo no existe")
    
    # Validate grade name doesn't contain section patterns
    if data.nombre:
        level_doc = await db.academic_levels.find_one({"id": new_nivel_id}, {"_id": 0, "nombre": 1})
        level_name = level_doc.get("nombre", "") if level_doc else ""
        
        # Strict validation: only allow preset grades for standard levels
        VALID_GRADES_BY_LEVEL = {
            "INICIAL": ["3 AÑOS", "4 AÑOS", "5 AÑOS"],
            "PRIMARIA": ["1°", "2°", "3°", "4°", "5°", "6°"],
            "SECUNDARIA": ["1°", "2°", "3°", "4°", "5°"],
        }
        level_name_norm = unicodedata.normalize("NFD", level_name.strip()).encode("ascii", "ignore").decode("ascii").upper()
        if level_name_norm in VALID_GRADES_BY_LEVEL:
            allowed = [g.upper() for g in VALID_GRADES_BY_LEVEL[level_name_norm]]
            if data.nombre.strip().upper() not in allowed:
                raise HTTPException(status_code=400, detail=f"Grado inválido para {level_name}. Solo se permite: {', '.join(VALID_GRADES_BY_LEVEL[level_name_norm])}")
        
        validation_error = validate_grade_name(data.nombre, level_name)
        if validation_error:
            raise HTTPException(
                status_code=400,
                detail="El nombre parece incluir una sección (ej: A, B, Álamo). Crea el grado como '4 AÑOS' y luego agrega la sección desde 'Agregar sección'."
            )
    
    # Check for duplicate name within the same level
    if data.nombre and (data.nombre.lower() != grade["nombre"].lower() or new_nivel_id != grade["nivel_id"]):
        existing = await db.grades.find_one({
            "school_id": user["school_id"],
            "nivel_id": new_nivel_id,
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": grade_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un grado con ese nombre en este nivel")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.nivel_id is not None:
        update_data["nivel_id"] = data.nivel_id
    if data.orden is not None:
        update_data["orden"] = data.orden
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.grades.update_one({"id": grade_id}, {"$set": update_data})
    
    # Get updated grade with level info
    updated_grade = await db.grades.find_one({"id": grade_id}, {"_id": 0})
    level = await db.academic_levels.find_one({"id": updated_grade["nivel_id"]}, {"_id": 0, "nombre": 1})
    updated_grade["nivel_nombre"] = level["nombre"] if level else "Sin nivel"
    section_count = await db.sections.count_documents({
        "school_id": user["school_id"],
        "grado_id": grade_id
    })
    updated_grade["section_count"] = section_count
    
    return {"message": "Grado actualizado correctamente", "grade": updated_grade}

@router.delete("/academic/grades/{grade_id}")
async def delete_grade(
    grade_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a grade (only if no sections are associated)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar grados")
    
    # Find the grade
    grade = await db.grades.find_one({
        "id": grade_id,
        "school_id": user["school_id"]
    })
    if not grade:
        raise HTTPException(status_code=404, detail="Grado no encontrado")
    
    # Check if grade has sections
    section_count = await db.sections.count_documents({
        "school_id": user["school_id"],
        "grado_id": grade_id
    })
    if section_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar el grado porque tiene {section_count} sección(es) asociada(s). Elimina primero las secciones."
        )
    
    # TODO: Check for enrolled students when that module is implemented
    student_count = await db.users.count_documents({
        "school_id": user["school_id"],
        "grado_id": grade_id,
        "role": "student"
    })
    if student_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar el grado porque tiene {student_count} estudiante(s) asignado(s). Reasigna o retira los estudiantes primero."
        )
    
    await db.grades.delete_one({"id": grade_id})
    
    return {"message": "Grado eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - SECTION TYPES (CATALOG)
# ══════════════════════════════════════════════════════════════════════════════

# Predefined section types catalog
DEFAULT_SECTION_TYPES = [
    {"key": "A", "label": "A", "orden": 1},
    {"key": "B", "label": "B", "orden": 2},
    {"key": "C", "label": "C", "orden": 3},
    {"key": "D", "label": "D", "orden": 4},
    {"key": "E", "label": "E", "orden": 5},
    {"key": "F", "label": "F", "orden": 6},
    {"key": "UNICA", "label": "ÚNICA", "orden": 7},
]

@router.get("/academic/section-types")
async def get_section_types(
    current_user = Depends(get_current_user)
):
    """Get all section types for the current tenant (creates default catalog if empty)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Check if section types exist for this school
    types = await db.section_types.find({"school_id": school_id}, {"_id": 0}).sort("orden", 1).to_list(50)
    
    # If no types exist, create the default catalog
    if not types:
        for st in DEFAULT_SECTION_TYPES:
            section_type = {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "key": st["key"],
                "label": st["label"],
                "orden": st["orden"],
                "activo": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.section_types.insert_one(section_type)
        
        types = await db.section_types.find({"school_id": school_id}, {"_id": 0}).sort("orden", 1).to_list(50)
    
    return types

@router.post("/academic/section-types")
async def create_section_type(
    key: str = Body(...),
    label: str = Body(...),
    current_user = Depends(get_current_user)
):
    """Create a new section type (admin only)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear tipos de sección")
    
    school_id = user["school_id"]
    
    # Check for duplicate key
    existing = await db.section_types.find_one({
        "school_id": school_id,
        "key": key.upper()
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un tipo de sección con esa clave")
    
    # Get next order
    last_type = await db.section_types.find_one(
        {"school_id": school_id},
        sort=[("orden", -1)]
    )
    orden = (last_type["orden"] + 1) if last_type else 1
    
    section_type = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "key": key.upper(),
        "label": label,
        "orden": orden,
        "activo": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.section_types.insert_one(section_type)
    del section_type["_id"]
    
    return {"message": "Tipo de sección creado", "section_type": section_type}

# NOTE: /reorder must be defined BEFORE /{type_id} to avoid route matching issues
@router.put("/academic/section-types/reorder")
async def reorder_section_types(
    order: List[str] = Body(..., embed=True, description="List of section type IDs in desired order"),
    current_user = Depends(get_current_user)
):
    """Reorder section types (admin only)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden reordenar tipos de sección")
    
    school_id = user["school_id"]
    
    # Update order for each type
    for idx, type_id in enumerate(order, start=1):
        await db.section_types.update_one(
            {"id": type_id, "school_id": school_id},
            {"$set": {"orden": idx}}
        )
    
    # Return updated list
    types = await db.section_types.find({"school_id": school_id}, {"_id": 0}).sort("orden", 1).to_list(50)
    return {"message": "Orden actualizado", "section_types": types}

@router.put("/academic/section-types/{type_id}")
async def update_section_type(
    type_id: str,
    label: str = Body(None),
    activo: bool = Body(None),
    current_user = Depends(get_current_user)
):
    """Update a section type (admin only)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar tipos de sección")
    
    school_id = user["school_id"]
    
    # Find the section type
    section_type = await db.section_types.find_one({
        "id": type_id,
        "school_id": school_id
    })
    if not section_type:
        raise HTTPException(status_code=404, detail="Tipo de sección no encontrado")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if label is not None:
        update_data["label"] = label
    if activo is not None:
        # Check if deactivating - verify no sections are using this type
        if not activo:
            sections_using = await db.sections.count_documents({
                "school_id": school_id,
                "section_type_id": type_id
            })
            if sections_using > 0:
                raise HTTPException(
                    status_code=400, 
                    detail=f"No se puede desactivar: {sections_using} secciones usan este tipo"
                )
        update_data["activo"] = activo
    
    await db.section_types.update_one(
        {"id": type_id},
        {"$set": update_data}
    )
    
    # Get updated record
    updated = await db.section_types.find_one({"id": type_id}, {"_id": 0})
    return {"message": "Tipo de sección actualizado", "section_type": updated}

@router.delete("/academic/section-types/{type_id}")
async def delete_section_type(
    type_id: str,
    current_user = Depends(get_current_user)
):
    """Soft delete a section type (admin only) - sets activo=false"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar tipos de sección")
    
    school_id = user["school_id"]
    
    # Find the section type
    section_type = await db.section_types.find_one({
        "id": type_id,
        "school_id": school_id
    })
    if not section_type:
        raise HTTPException(status_code=404, detail="Tipo de sección no encontrado")
    
    # Check if any sections are using this type
    sections_using = await db.sections.count_documents({
        "school_id": school_id,
        "section_type_id": type_id
    })
    if sections_using > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar: {sections_using} secciones usan este tipo. Desactívelo en su lugar."
        )
    
    # Soft delete - just set activo to false
    await db.section_types.update_one(
        {"id": type_id},
        {"$set": {"activo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Tipo de sección desactivado"}


# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - SECCIONES
# ══════════════════════════════════════════════════════════════════════════════

class SectionCreate(BaseModel):
    section_type_id: str  # Changed from nombre to section_type_id
    grado_id: str
    capacidad_maxima: Optional[int] = None
    activo: bool = True

class SectionUpdate(BaseModel):
    section_type_id: Optional[str] = None  # Changed from nombre to section_type_id
    grado_id: Optional[str] = None
    capacidad_maxima: Optional[int] = None
    activo: Optional[bool] = None

@router.get("/academic/sections")
async def get_sections(
    grado_id: Optional[str] = None,
    nivel_id: Optional[str] = None,
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all sections for the current tenant"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    query = {"school_id": school_id}
    if grado_id:
        # Flexible match: handle both String and ObjectId
        try:
            from bson import ObjectId as BsonObjectId
            query["grado_id"] = {"$in": [grado_id, BsonObjectId(grado_id)]}
        except Exception:
            query["grado_id"] = grado_id
    if activo is not None:
        query["activo"] = activo
    
    # If filtering by nivel_id, first get all grades of that level
    if nivel_id:
        grades_in_level = await db.grades.find(
            {"school_id": school_id, "nivel_id": nivel_id}
        ).to_list(100)
        grade_ids = []
        for g in grades_in_level:
            gid = str(g.get("id") or g.get("_id"))
            grade_ids.append(gid)
            try:
                grade_ids.append(BsonObjectId(gid))
            except Exception:
                pass
        query["grado_id"] = {"$in": grade_ids}
    
    sections_raw = await db.sections.find(query).sort("nombre", 1).to_list(500)
    
    logger.info(f"=== DEBUG SECTIONS === school_id={school_id}, query={query}, raw count={len(sections_raw)}")
    for s in sections_raw[:3]:
        logger.info(f"  Section RAW: _id={s.get('_id')} type={type(s.get('_id')).__name__}, id={s.get('id')} type={type(s.get('id')).__name__ if s.get('id') else 'NONE'}, grado_id={s.get('grado_id')} type={type(s.get('grado_id')).__name__}, nombre={s.get('nombre')}")
    
    # Normalize: ensure every section has string `id` and `grado_id`
    sections = []
    for s in sections_raw:
        s["id"] = str(s.get("id") or s.get("_id"))
        s["grado_id"] = str(s["grado_id"]) if s.get("grado_id") else s.get("grado_id")
        s.pop("_id", None)
        sections.append(s)
    
    # Load section types for mapping (for backward compatibility)
    section_types = await db.section_types.find({"school_id": school_id}, {"_id": 0}).to_list(50)
    section_types_by_key = {st["key"]: st for st in section_types}
    section_types_by_label = {st["label"]: st for st in section_types}
    
    # Add grade and level info for each section
    grades_cache = {}
    levels_cache = {}
    for section in sections:
        # Backward compatibility: assign section_type_id if not present
        if not section.get("section_type_id") and section.get("nombre"):
            # Try to match by key (uppercase) first, then by label
            nombre_upper = section["nombre"].upper().replace("ÚNICA", "UNICA")
            matched_type = section_types_by_key.get(nombre_upper) or section_types_by_label.get(section["nombre"])
            if matched_type:
                section["section_type_id"] = matched_type["id"]
                # Update the record in DB for future requests
                await db.sections.update_one(
                    {"id": section["id"]},
                    {"$set": {"section_type_id": matched_type["id"]}}
                )
        
        # Get grade info
        if section["grado_id"] not in grades_cache:
            grade = await db.grades.find_one({"id": section["grado_id"]}, {"_id": 0, "nombre": 1, "nivel_id": 1})
            grades_cache[section["grado_id"]] = grade
        grade_info = grades_cache[section["grado_id"]]
        section["grado_nombre"] = grade_info["nombre"] if grade_info else "Sin grado"
        
        # Get level info
        if grade_info and grade_info.get("nivel_id"):
            nivel_id = grade_info["nivel_id"]
            if nivel_id not in levels_cache:
                level = await db.academic_levels.find_one({"id": nivel_id}, {"_id": 0, "nombre": 1})
                levels_cache[nivel_id] = level
            level_info = levels_cache[nivel_id]
            section["nivel_id"] = nivel_id
            section["nivel_nombre"] = level_info["nombre"] if level_info else "Sin nivel"
        else:
            section["nivel_id"] = None
            section["nivel_nombre"] = "Sin nivel"
        
        # TODO: Add student count when that module is implemented
        section["student_count"] = 0
    
    return sections

@router.post("/academic/sections")
async def create_section(
    data: SectionCreate,
    current_user = Depends(get_current_user)
):
    """Create a new section"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear secciones")
    
    school_id = user["school_id"]
    
    # Verify grade exists
    grade = await db.grades.find_one({
        "id": data.grado_id,
        "school_id": school_id
    })
    if not grade:
        raise HTTPException(status_code=400, detail="El grado no existe")
    
    # Verify section type exists
    section_type = await db.section_types.find_one({
        "id": data.section_type_id,
        "school_id": school_id
    })
    if not section_type:
        raise HTTPException(status_code=400, detail="El tipo de sección no existe")
    
    # Check for duplicate: same section type in the same grade
    existing = await db.sections.find_one({
        "school_id": school_id,
        "grado_id": data.grado_id,
        "section_type_id": data.section_type_id
    })
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Ya existe la sección '{section_type['label']}' en este grado"
        )
    
    section = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "section_type_id": data.section_type_id,
        "nombre": section_type["label"],  # Store label for display
        "grado_id": data.grado_id,
        "capacidad_maxima": data.capacidad_maxima,
        "activo": data.activo,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sections.insert_one(section)
    section.pop("_id", None)
    
    # Add grade and level info
    section["grado_nombre"] = grade["nombre"]
    level = await db.academic_levels.find_one({"id": grade["nivel_id"]}, {"_id": 0, "nombre": 1})
    section["nivel_id"] = grade["nivel_id"]
    section["nivel_nombre"] = level["nombre"] if level else "Sin nivel"
    section["student_count"] = 0
    
    return {"message": "Sección creada correctamente", "section": section}

@router.put("/academic/sections/{section_id}")
async def update_section(
    section_id: str,
    data: SectionUpdate,
    current_user = Depends(get_current_user)
):
    """Update a section"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar secciones")
    
    school_id = user["school_id"]
    
    # Find the section
    section = await db.sections.find_one({
        "id": section_id,
        "school_id": school_id
    })
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    
    # If changing grade, verify new grade exists
    new_grado_id = data.grado_id if data.grado_id else section["grado_id"]
    if data.grado_id and data.grado_id != section["grado_id"]:
        grade = await db.grades.find_one({
            "id": data.grado_id,
            "school_id": school_id
        })
        if not grade:
            raise HTTPException(status_code=400, detail="El grado no existe")
    
    # If changing section type, verify and check duplicates
    new_section_type_id = data.section_type_id if data.section_type_id else section.get("section_type_id")
    if data.section_type_id:
        section_type = await db.section_types.find_one({
            "id": data.section_type_id,
            "school_id": school_id
        })
        if not section_type:
            raise HTTPException(status_code=400, detail="El tipo de sección no existe")
        
        # Check for duplicate: same section type in the same grade
        if new_section_type_id != section.get("section_type_id") or new_grado_id != section["grado_id"]:
            existing = await db.sections.find_one({
                "school_id": school_id,
                "grado_id": new_grado_id,
                "section_type_id": new_section_type_id,
                "id": {"$ne": section_id}
            })
            if existing:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Ya existe la sección '{section_type['label']}' en este grado"
                )
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.section_type_id is not None:
        section_type = await db.section_types.find_one({"id": data.section_type_id, "school_id": school_id})
        if section_type:
            update_data["section_type_id"] = data.section_type_id
            update_data["nombre"] = section_type["label"]
    if data.grado_id is not None:
        update_data["grado_id"] = data.grado_id
    if data.capacidad_maxima is not None:
        update_data["capacidad_maxima"] = data.capacidad_maxima
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.sections.update_one({"id": section_id}, {"$set": update_data})
    
    # Get updated section with grade and level info
    updated_section = await db.sections.find_one({"id": section_id}, {"_id": 0})
    grade = await db.grades.find_one({"id": updated_section["grado_id"]}, {"_id": 0})
    updated_section["grado_nombre"] = grade["nombre"] if grade else "Sin grado"
    if grade:
        level = await db.academic_levels.find_one({"id": grade["nivel_id"]}, {"_id": 0, "nombre": 1})
        updated_section["nivel_id"] = grade["nivel_id"]
        updated_section["nivel_nombre"] = level["nombre"] if level else "Sin nivel"
    updated_section["student_count"] = 0
    
    return {"message": "Sección actualizada correctamente", "section": updated_section}

@router.delete("/academic/sections/{section_id}")
async def delete_section(
    section_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a section (only if no students are enrolled)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar secciones")
    
    # Find the section
    section = await db.sections.find_one({
        "id": section_id,
        "school_id": user["school_id"]
    })
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    
    # Check for enrolled students
    student_count = await db.users.count_documents({
        "school_id": user["school_id"],
        "seccion_id": section_id,
        "role": "student"
    })
    if student_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar la sección porque tiene {student_count} estudiante(s) asignado(s). Reasigna o retira los estudiantes primero."
        )
    
    await db.sections.delete_one({"id": section_id})
    
    return {"message": "Sección eliminada correctamente"}

@router.get("/academic/sections/{section_id}/students-count")
async def get_section_students_count(
    section_id: str,
    current_user = Depends(get_current_user)
):
    """Get the number of students assigned to a section"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    count = await db.users.count_documents({
        "school_id": user["school_id"],
        "seccion_id": section_id,
        "role": "student"
    })
    return {"count": count}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - TURNOS
# ══════════════════════════════════════════════════════════════════════════════

class ShiftCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    hora_inicio: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    hora_fin: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    color: Optional[str] = "#3B82F6"
    activo: bool = True

class ShiftUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    hora_inicio: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    hora_fin: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    color: Optional[str] = None
    activo: Optional[bool] = None

@router.get("/academic/shifts")
async def get_shifts(
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all shifts for the current tenant"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    if activo is not None:
        query["activo"] = activo
    
    shifts = await db.shifts.find(query, {"_id": 0}).sort("hora_inicio", 1).to_list(50)
    
    return shifts

@router.post("/academic/shifts")
async def create_shift(
    data: ShiftCreate,
    current_user = Depends(get_current_user)
):
    """Create a new shift"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear turnos")
    
    # Check for duplicate name
    existing = await db.shifts.find_one({
        "school_id": user["school_id"],
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un turno con ese nombre")
    
    # Validate time range
    if data.hora_inicio >= data.hora_fin:
        raise HTTPException(status_code=400, detail="La hora de inicio debe ser menor que la hora de fin")
    
    shift = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "nombre": data.nombre,
        "hora_inicio": data.hora_inicio,
        "hora_fin": data.hora_fin,
        "color": data.color or "#3B82F6",
        "activo": data.activo,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.shifts.insert_one(shift)
    shift.pop("_id", None)
    
    return {"message": "Turno creado correctamente", "shift": shift}

@router.put("/academic/shifts/{shift_id}")
async def update_shift(
    shift_id: str,
    data: ShiftUpdate,
    current_user = Depends(get_current_user)
):
    """Update a shift"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar turnos")
    
    # Find the shift
    shift = await db.shifts.find_one({
        "id": shift_id,
        "school_id": user["school_id"]
    })
    if not shift:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    
    # Check for duplicate name if name is being changed
    if data.nombre and data.nombre.lower() != shift["nombre"].lower():
        existing = await db.shifts.find_one({
            "school_id": user["school_id"],
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": shift_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un turno con ese nombre")
    
    # Validate time range if times are being changed
    new_hora_inicio = data.hora_inicio if data.hora_inicio else shift["hora_inicio"]
    new_hora_fin = data.hora_fin if data.hora_fin else shift["hora_fin"]
    if new_hora_inicio >= new_hora_fin:
        raise HTTPException(status_code=400, detail="La hora de inicio debe ser menor que la hora de fin")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.hora_inicio is not None:
        update_data["hora_inicio"] = data.hora_inicio
    if data.hora_fin is not None:
        update_data["hora_fin"] = data.hora_fin
    if data.color is not None:
        update_data["color"] = data.color
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.shifts.update_one({"id": shift_id}, {"$set": update_data})
    
    updated_shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    
    return {"message": "Turno actualizado correctamente", "shift": updated_shift}

@router.delete("/academic/shifts/{shift_id}")
async def delete_shift(
    shift_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a shift"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar turnos")
    
    # Find the shift
    shift = await db.shifts.find_one({
        "id": shift_id,
        "school_id": user["school_id"]
    })
    if not shift:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    
    # TODO: Check if shift is in use (schedules, etc.) when that module is implemented
    
    await db.shifts.delete_one({"id": shift_id})
    
    return {"message": "Turno eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - PERÍODOS ACADÉMICOS
# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC YEARS & PERIODS MODELS (Premium SaaS Architecture)
# ══════════════════════════════════════════════════════════════════════════════

class AcademicYearCreate(BaseModel):
    year: int = Field(..., ge=2020, le=2100)
    status: Literal["activo", "futuro", "cerrado"] = "futuro"
    clone_from_year: Optional[int] = None  # Optional: clone periods from this year

class AcademicYearUpdate(BaseModel):
    year: Optional[int] = None
    status: Optional[Literal["activo", "futuro", "cerrado"]] = None

class AcademicPeriodCreate(BaseModel):
    academic_year_id: str = Field(...)  # Required: FK to academic year
    nombre: str = Field(..., min_length=1, max_length=100)
    fecha_inicio: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    fecha_fin: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    activo: bool = False

class AcademicPeriodUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    fecha_inicio: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    fecha_fin: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    activo: Optional[bool] = None

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC YEARS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/academic/years")
async def get_academic_years(
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all academic years for the current tenant"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    if status:
        query["status"] = status
    
    years = await db.academic_years.find(query, {"_id": 0}).sort("year", -1).to_list(50)
    
    # Count periods for each year
    for year in years:
        period_count = await db.academic_periods.count_documents({
            "school_id": user["school_id"],
            "academic_year_id": year["id"]
        })
        year["period_count"] = period_count
        
        # Get active period name if exists
        active_period = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "academic_year_id": year["id"],
            "activo": True
        }, {"_id": 0, "nombre": 1})
        year["active_period_name"] = active_period["nombre"] if active_period else None
    
    return years

@router.get("/academic/years/active")
async def get_active_academic_year(current_user = Depends(get_current_user)):
    """Get the currently active academic year"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    year = await db.academic_years.find_one(
        {"school_id": user["school_id"], "status": "activo"},
        {"_id": 0}
    )
    
    if not year:
        return {"active_year": None, "message": "No hay año académico activo"}
    
    return {"active_year": year}

@router.post("/academic/years")
async def create_academic_year(
    data: AcademicYearCreate,
    current_user = Depends(get_current_user)
):
    """Create a new academic year with optional period cloning"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear años académicos")
    
    school_id = user["school_id"]
    
    # Check for duplicate year
    existing = await db.academic_years.find_one({
        "school_id": school_id,
        "year": data.year
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"El año académico {data.year} ya existe")
    
    deactivated_year = None
    # If setting as active, deactivate current active year (set to cerrado)
    if data.status == "activo":
        current_active = await db.academic_years.find_one({
            "school_id": school_id,
            "status": "activo"
        })
        if current_active:
            await db.academic_years.update_one(
                {"id": current_active["id"]},
                {"$set": {"status": "cerrado", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            deactivated_year = current_active["year"]
    
    academic_year = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "year": data.year,
        "status": data.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.academic_years.insert_one(academic_year)
    del academic_year["_id"]
    
    # Clone periods from another year if requested
    cloned_periods = []
    if data.clone_from_year:
        source_year = await db.academic_years.find_one({
            "school_id": school_id,
            "year": data.clone_from_year
        })
        if source_year:
            source_periods = await db.academic_periods.find({
                "school_id": school_id,
                "academic_year_id": source_year["id"]
            }, {"_id": 0}).sort("orden", 1).to_list(20)
            
            for idx, sp in enumerate(source_periods, start=1):
                new_period = {
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "academic_year_id": academic_year["id"],
                    "nombre": sp["nombre"],  # Just the name without year (e.g., "Bimestre I")
                    "fecha_inicio": None,  # Empty for editing
                    "fecha_fin": None,
                    "orden": sp.get("orden", idx),
                    "activo": False,  # Always inactive when cloned
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await db.academic_periods.insert_one(new_period)
                del new_period["_id"]
                cloned_periods.append(new_period)
    
    response = {
        "message": f"Año académico {data.year} creado correctamente",
        "academic_year": academic_year
    }
    
    if cloned_periods:
        response["cloned_periods"] = cloned_periods
        response["message"] += f". Se clonaron {len(cloned_periods)} períodos del año {data.clone_from_year}."
    
    if deactivated_year:
        response["deactivated_year"] = deactivated_year
        response["message"] = f"Año {data.year} activado. El año {deactivated_year} ha sido cerrado."
    
    return response

@router.put("/academic/years/{year_id}")
async def update_academic_year(
    year_id: str,
    data: AcademicYearUpdate,
    current_user = Depends(get_current_user)
):
    """Update an academic year status or year number"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar años académicos")
    
    school_id = user["school_id"]
    
    year = await db.academic_years.find_one({
        "id": year_id,
        "school_id": school_id
    })
    if not year:
        raise HTTPException(status_code=404, detail="Año académico no encontrado")
    
    # If changing year number, check it doesn't already exist
    if data.year is not None and data.year != year["year"]:
        existing = await db.academic_years.find_one({
            "school_id": school_id,
            "year": data.year,
            "id": {"$ne": year_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"El año {data.year} ya existe")
    
    deactivated_year = None
    # If setting to active, close current active year
    if data.status == "activo" and year["status"] != "activo":
        current_active = await db.academic_years.find_one({
            "school_id": school_id,
            "status": "activo",
            "id": {"$ne": year_id}
        })
        if current_active:
            await db.academic_years.update_one(
                {"id": current_active["id"]},
                {"$set": {"status": "cerrado", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            deactivated_year = current_active["year"]
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.year is not None:
        update_data["year"] = data.year
    if data.status is not None:
        update_data["status"] = data.status
    
    await db.academic_years.update_one(
        {"id": year_id},
        {"$set": update_data}
    )
    
    updated_year = await db.academic_years.find_one({"id": year_id}, {"_id": 0})
    
    response = {"message": "Año académico actualizado", "academic_year": updated_year}
    if deactivated_year:
        response["deactivated_year"] = deactivated_year
        response["message"] = f"Año {year['year']} activado. El año {deactivated_year} ha sido cerrado."
    
    return response

@router.get("/academic/years/{year_id}/can-delete")
async def check_year_can_delete(
    year_id: str,
    current_user = Depends(get_current_user)
):
    """Check if an academic year can be safely deleted and return dependency info"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    year = await db.academic_years.find_one({
        "id": year_id,
        "school_id": school_id
    }, {"_id": 0})
    
    if not year:
        raise HTTPException(status_code=404, detail="Año académico no encontrado")
    
    # Count all dependencies
    dependencies = {
        "periods": await db.academic_periods.count_documents({"school_id": school_id, "academic_year_id": year_id}),
        "assignments": await db.academic_assignments.count_documents({"school_id": school_id, "academic_year_id": year_id}),
        "course_posts": await db.course_posts.count_documents({"school_id": school_id, "academic_year_id": year_id}),
    }
    
    # Check if there are any dependencies
    has_dependencies = any(count > 0 for count in dependencies.values())
    
    # Determine if can be deleted
    can_delete = (
        year["status"] == "futuro" and 
        not has_dependencies
    )
    
    # Build reason message
    reasons = []
    if year["status"] == "activo":
        reasons.append("El año está activo. Debe activar otro año primero.")
    elif year["status"] == "cerrado":
        reasons.append("El año está cerrado y contiene datos históricos.")
    
    if dependencies["periods"] > 0:
        reasons.append(f"Tiene {dependencies['periods']} período(s) académico(s) configurado(s).")
    if dependencies["assignments"] > 0:
        reasons.append(f"Tiene {dependencies['assignments']} asignación(es) docente(s).")
    if dependencies["course_posts"] > 0:
        reasons.append(f"Tiene {dependencies['course_posts']} publicación(es) en cursos.")
    
    return {
        "can_delete": can_delete,
        "year": year,
        "dependencies": dependencies,
        "has_dependencies": has_dependencies,
        "reasons": reasons,
        "recommended_action": "delete" if can_delete else ("close" if year["status"] == "activo" else "archive")
    }


@router.delete("/academic/years/{year_id}")
async def delete_academic_year(
    year_id: str,
    current_user = Depends(get_current_user)
):
    """
    Delete an academic year - ONLY if it's in 'futuro' status with NO dependencies.
    This is a safe delete for years created by mistake and never used.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar años académicos")
    
    school_id = user["school_id"]
    
    year = await db.academic_years.find_one({
        "id": year_id,
        "school_id": school_id
    })
    if not year:
        raise HTTPException(status_code=404, detail="Año académico no encontrado")
    
    # RULE 1: Cannot delete active years
    if year["status"] == "activo":
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar un año académico activo. Los años activos deben cerrarse primero."
        )
    
    # RULE 2: Cannot delete closed years (historical data)
    if year["status"] == "cerrado":
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar un año académico cerrado. Los datos históricos deben preservarse. Puede archivar el año en su lugar."
        )
    
    # RULE 3: Check for ANY dependencies
    dependencies = {
        "periods": await db.academic_periods.count_documents({"school_id": school_id, "academic_year_id": year_id}),
        "assignments": await db.academic_assignments.count_documents({"school_id": school_id, "academic_year_id": year_id}),
        "course_posts": await db.course_posts.count_documents({"school_id": school_id, "academic_year_id": year_id}),
    }
    
    has_dependencies = any(count > 0 for count in dependencies.values())
    
    if has_dependencies:
        detail_parts = ["Este año académico no puede eliminarse porque tiene información asociada:"]
        if dependencies["periods"] > 0:
            detail_parts.append(f"• {dependencies['periods']} período(s) académico(s)")
        if dependencies["assignments"] > 0:
            detail_parts.append(f"• {dependencies['assignments']} asignación(es) docente(s)")
        if dependencies["course_posts"] > 0:
            detail_parts.append(f"• {dependencies['course_posts']} publicación(es) en cursos")
        detail_parts.append("Elimine primero los datos asociados o cierre el año en su lugar.")
        
        raise HTTPException(status_code=400, detail=" ".join(detail_parts))
    
    # SAFE TO DELETE: Status is 'futuro' and no dependencies
    await db.academic_years.delete_one({"id": year_id})
    
    return {
        "message": f"Año académico {year['year']} eliminado correctamente",
        "deleted_year": year["year"]
    }

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC PERIODS ENDPOINTS (Modified for Year dependency)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/academic/periods")
async def get_academic_periods(
    academic_year_id: Optional[str] = None,
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all academic periods for the current tenant, optionally filtered by year"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    query = {"school_id": school_id}
    
    if academic_year_id:
        query["academic_year_id"] = academic_year_id
    if activo is not None:
        query["activo"] = activo
    
    periods = await db.academic_periods.find(query, {"_id": 0}).sort([("orden", 1), ("fecha_inicio", -1)]).to_list(100)
    
    # Enrich with year info
    year_ids = list(set([p.get("academic_year_id") for p in periods if p.get("academic_year_id")]))
    years_map = {}
    if year_ids:
        years = await db.academic_years.find({"id": {"$in": year_ids}}, {"_id": 0, "id": 1, "year": 1, "status": 1}).to_list(50)
        years_map = {y["id"]: y for y in years}
    
    for period in periods:
        year_data = years_map.get(period.get("academic_year_id"))
        if year_data:
            period["year"] = year_data["year"]
            period["year_status"] = year_data["status"]
        else:
            # Legacy period without year - try to extract from name
            period["year"] = None
            period["year_status"] = None
    
    return periods

@router.get("/academic/periods/active")
async def get_active_academic_period(current_user = Depends(get_current_user)):
    """Get the currently active academic period for the tenant"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    period = await db.academic_periods.find_one(
        {"school_id": user["school_id"], "activo": True},
        {"_id": 0}
    )
    
    if not period:
        return {"active_period": None, "message": "No hay período académico activo"}
    
    return {"active_period": period}

@router.post("/academic/periods")
async def create_academic_period(
    data: AcademicPeriodCreate,
    current_user = Depends(get_current_user)
):
    """Create a new academic period within an academic year"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear períodos")
    
    school_id = user["school_id"]
    
    # Validate academic year exists
    academic_year = await db.academic_years.find_one({
        "id": data.academic_year_id,
        "school_id": school_id
    })
    if not academic_year:
        raise HTTPException(status_code=404, detail="Año académico no encontrado")
    
    # Validate date range if both dates provided
    if data.fecha_inicio and data.fecha_fin:
        if data.fecha_inicio >= data.fecha_fin:
            raise HTTPException(status_code=400, detail="La fecha de inicio debe ser anterior a la fecha de fin")
    
    # Check for duplicate name within the same year
    existing = await db.academic_periods.find_one({
        "school_id": school_id,
        "academic_year_id": data.academic_year_id,
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe un período '{data.nombre}' en el año {academic_year['year']}")
    
    # Check for overlapping dates within the same year (only if dates provided)
    if data.fecha_inicio and data.fecha_fin:
        overlapping = await db.academic_periods.find_one({
            "school_id": school_id,
            "academic_year_id": data.academic_year_id,
            "fecha_inicio": {"$ne": None},
            "fecha_fin": {"$ne": None},
            "$or": [
                {"fecha_inicio": {"$lte": data.fecha_inicio}, "fecha_fin": {"$gte": data.fecha_inicio}},
                {"fecha_inicio": {"$lte": data.fecha_fin}, "fecha_fin": {"$gte": data.fecha_fin}},
                {"fecha_inicio": {"$gte": data.fecha_inicio}, "fecha_fin": {"$lte": data.fecha_fin}}
            ]
        })
        if overlapping:
            raise HTTPException(
                status_code=400, 
                detail=f"Las fechas se solapan con el período '{overlapping['nombre']}'"
            )
    
    deactivated_period = None
    # If setting as active, deactivate any currently active period in ANY year
    if data.activo:
        current_active = await db.academic_periods.find_one({
            "school_id": school_id,
            "activo": True
        })
        if current_active:
            await db.academic_periods.update_one(
                {"id": current_active["id"]},
                {"$set": {"activo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            deactivated_period = current_active["nombre"]
    
    # Get next order number
    max_order = await db.academic_periods.find_one(
        {"school_id": school_id, "academic_year_id": data.academic_year_id},
        sort=[("orden", -1)]
    )
    next_order = (max_order.get("orden", 0) + 1) if max_order else 1
    
    period = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "academic_year_id": data.academic_year_id,
        "nombre": data.nombre,
        "fecha_inicio": data.fecha_inicio,
        "fecha_fin": data.fecha_fin,
        "orden": next_order,
        "activo": data.activo,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.academic_periods.insert_one(period)
    period.pop("_id", None)
    
    # Add year info to response
    period["year"] = academic_year["year"]
    
    response = {"message": "Período creado correctamente", "period": period}
    if deactivated_period:
        response["deactivated_period"] = deactivated_period
        response["message"] = f"Período creado y activado. El período '{deactivated_period}' ha sido desactivado."
    
    return response

@router.put("/academic/periods/{period_id}")
async def update_academic_period(
    period_id: str,
    data: AcademicPeriodUpdate,
    current_user = Depends(get_current_user)
):
    """Update an academic period"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar períodos")
    
    # Find the period
    period = await db.academic_periods.find_one({
        "id": period_id,
        "school_id": user["school_id"]
    })
    if not period:
        raise HTTPException(status_code=404, detail="Período no encontrado")
    
    # Calculate new values
    new_fecha_inicio = data.fecha_inicio if data.fecha_inicio else period["fecha_inicio"]
    new_fecha_fin = data.fecha_fin if data.fecha_fin else period["fecha_fin"]
    
    # Validate date range
    if new_fecha_inicio >= new_fecha_fin:
        raise HTTPException(status_code=400, detail="La fecha de inicio debe ser anterior a la fecha de fin")
    
    # Check for duplicate name if name is being changed (only within the same academic year)
    if data.nombre and data.nombre.lower() != period["nombre"].lower():
        existing = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "academic_year_id": period["academic_year_id"],  # Only check within the same academic year
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": period_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un período con ese nombre en este año académico")
    
    # Check for overlapping dates if dates are being changed (only within the same academic year)
    if data.fecha_inicio or data.fecha_fin:
        overlapping = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "academic_year_id": period["academic_year_id"],  # Only check within the same academic year
            "id": {"$ne": period_id},
            "fecha_inicio": {"$ne": None},
            "fecha_fin": {"$ne": None},
            "$or": [
                {"fecha_inicio": {"$lte": new_fecha_inicio}, "fecha_fin": {"$gte": new_fecha_inicio}},
                {"fecha_inicio": {"$lte": new_fecha_fin}, "fecha_fin": {"$gte": new_fecha_fin}},
                {"fecha_inicio": {"$gte": new_fecha_inicio}, "fecha_fin": {"$lte": new_fecha_fin}}
            ]
        })
        if overlapping:
            raise HTTPException(
                status_code=400, 
                detail=f"Las fechas se solapan con el período '{overlapping['nombre']}' ({overlapping['fecha_inicio']} - {overlapping['fecha_fin']})"
            )
    
    deactivated_period = None
    # If activating this period, deactivate any other active period
    if data.activo is True and not period["activo"]:
        current_active = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "activo": True,
            "id": {"$ne": period_id}
        })
        if current_active:
            await db.academic_periods.update_one(
                {"id": current_active["id"]},
                {"$set": {"activo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            deactivated_period = current_active["nombre"]
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.fecha_inicio is not None:
        update_data["fecha_inicio"] = data.fecha_inicio
    if data.fecha_fin is not None:
        update_data["fecha_fin"] = data.fecha_fin
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.academic_periods.update_one({"id": period_id}, {"$set": update_data})
    
    updated_period = await db.academic_periods.find_one({"id": period_id}, {"_id": 0})
    
    response = {"message": "Período actualizado correctamente", "period": updated_period}
    if deactivated_period:
        response["deactivated_period"] = deactivated_period
        response["message"] = f"Período activado. El período '{deactivated_period}' ha sido desactivado."
    
    return response

@router.post("/academic/periods/{period_id}/activate")
async def activate_academic_period(
    period_id: str,
    current_user = Depends(get_current_user)
):
    """Activate an academic period (deactivates any other active period)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden activar períodos")
    
    # Find the period
    period = await db.academic_periods.find_one({
        "id": period_id,
        "school_id": user["school_id"]
    })
    if not period:
        raise HTTPException(status_code=404, detail="Período no encontrado")
    
    if period["activo"]:
        return {"message": "El período ya está activo", "period": period}
    
    # Deactivate any currently active period
    deactivated_period = None
    current_active = await db.academic_periods.find_one({
        "school_id": user["school_id"],
        "activo": True
    })
    if current_active:
        await db.academic_periods.update_one(
            {"id": current_active["id"]},
            {"$set": {"activo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        deactivated_period = current_active["nombre"]
    
    # Activate this period
    await db.academic_periods.update_one(
        {"id": period_id},
        {"$set": {"activo": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_period = await db.academic_periods.find_one({"id": period_id}, {"_id": 0})
    
    response = {
        "message": f"Período '{period['nombre']}' activado correctamente",
        "period": updated_period
    }
    if deactivated_period:
        response["deactivated_period"] = deactivated_period
        response["message"] = f"Período '{period['nombre']}' activado. El período '{deactivated_period}' ha sido desactivado."
    
    return response

@router.delete("/academic/periods/{period_id}")
async def delete_academic_period(
    period_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an academic period (only if not active and not in use)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar períodos")
    
    # Find the period
    period = await db.academic_periods.find_one({
        "id": period_id,
        "school_id": user["school_id"]
    })
    if not period:
        raise HTTPException(status_code=404, detail="Período no encontrado")
    
    # Cannot delete active period
    if period["activo"]:
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar un período activo. Activa otro período primero."
        )
    
    # TODO: Check if period is in use (enrollments, attendance, grades) when those modules are implemented
    # enrollment_count = await db.enrollments.count_documents({"period_id": period_id})
    # if enrollment_count > 0:
    #     raise HTTPException(
    #         status_code=400,
    #         detail=f"No se puede eliminar el período porque tiene {enrollment_count} matrícula(s) asociada(s)"
    #     )
    
    await db.academic_periods.delete_one({"id": period_id})
    
    return {"message": "Período eliminado correctamente"}

class ClonePeriodsRequest(BaseModel):
    source_year_id: str
    target_year_id: str

@router.post("/academic/periods/clone")
async def clone_periods_to_year(
    data: ClonePeriodsRequest,
    current_user = Depends(get_current_user)
):
    """Clone periods from one academic year to another."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden clonar períodos")
    
    school_id = user["school_id"]
    
    # Verify source year exists and has periods
    source_year = await db.academic_years.find_one({
        "id": data.source_year_id,
        "school_id": school_id
    })
    if not source_year:
        raise HTTPException(status_code=404, detail="Año origen no encontrado")
    
    # Verify target year exists
    target_year = await db.academic_years.find_one({
        "id": data.target_year_id,
        "school_id": school_id
    })
    if not target_year:
        raise HTTPException(status_code=404, detail="Año destino no encontrado")
    
    # Check if target year already has periods
    existing_periods = await db.academic_periods.count_documents({
        "school_id": school_id,
        "academic_year_id": data.target_year_id
    })
    if existing_periods > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"El año {target_year['year']} ya tiene {existing_periods} período(s). Elimínalos primero si deseas clonar."
        )
    
    # Get source periods
    source_periods = await db.academic_periods.find({
        "school_id": school_id,
        "academic_year_id": data.source_year_id
    }, {"_id": 0}).sort("orden", 1).to_list(20)
    
    if not source_periods:
        raise HTTPException(status_code=400, detail="El año origen no tiene períodos para clonar")
    
    # Calculate year difference for date adjustment
    year_diff = target_year["year"] - source_year["year"]
    
    # Clone periods
    cloned = []
    for sp in source_periods:
        # Adjust dates if present
        new_fecha_inicio = None
        new_fecha_fin = None
        
        if sp.get("fecha_inicio"):
            try:
                fecha = datetime.strptime(sp["fecha_inicio"], "%Y-%m-%d")
                new_fecha_inicio = fecha.replace(year=fecha.year + year_diff).strftime("%Y-%m-%d")
            except Exception:
                new_fecha_inicio = sp["fecha_inicio"]
        
        if sp.get("fecha_fin"):
            try:
                fecha = datetime.strptime(sp["fecha_fin"], "%Y-%m-%d")
                new_fecha_fin = fecha.replace(year=fecha.year + year_diff).strftime("%Y-%m-%d")
            except Exception:
                new_fecha_fin = sp["fecha_fin"]
        
        new_period = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "academic_year_id": data.target_year_id,
            "nombre": sp["nombre"],
            "fecha_inicio": new_fecha_inicio,
            "fecha_fin": new_fecha_fin,
            "orden": sp["orden"],
            "activo": False,  # New periods start inactive
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.academic_periods.insert_one(new_period)
        del new_period["_id"]
        cloned.append(new_period)
    
    return {
        "message": f"Se clonaron {len(cloned)} período(s) del año {source_year['year']} al año {target_year['year']}",
        "cloned_periods": cloned
    }

@router.post("/academic/migrate-to-years")
async def migrate_periods_to_years(
    current_user = Depends(get_current_user)
):
    """
    Migration endpoint: Convert legacy periods to the new AcademicYear + AcademicPeriod structure.
    - Creates academic years based on period names (extracts year from "Bimestre I - 2025")
    - Assigns periods to their respective years
    - Cleans period names (removes year suffix)
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar migraciones")
    
    school_id = user["school_id"]
    
    # Get all periods without academic_year_id
    legacy_periods = await db.academic_periods.find({
        "school_id": school_id,
        "$or": [
            {"academic_year_id": {"$exists": False}},
            {"academic_year_id": None}
        ]
    }, {"_id": 0}).to_list(100)
    
    if not legacy_periods:
        return {
            "message": "No hay períodos para migrar",
            "migrated_count": 0,
            "years_created": []
        }
    
    years_created = []
    periods_migrated = []
    warnings = []
    
    # Get existing academic years
    existing_years = await db.academic_years.find({"school_id": school_id}, {"_id": 0}).to_list(50)
    years_map = {y["year"]: y for y in existing_years}
    
    # Get active year for fallback
    active_year = await db.academic_years.find_one({"school_id": school_id, "status": "activo"})
    
    for period in legacy_periods:
        nombre = period.get("nombre", "")
        
        # Try to extract year from name (e.g., "Bimestre I - 2025" -> 2025)
        year_match = re.search(r'\b(20\d{2})\b', nombre)
        
        if year_match:
            year = int(year_match.group(1))
            # Clean the period name (remove year and separators)
            clean_name = re.sub(r'\s*[-–]\s*(20\d{2})', '', nombre).strip()
        elif active_year:
            # Fallback to active year
            year = active_year["year"]
            clean_name = nombre
            warnings.append(f"Período '{nombre}' asignado al año activo {year} (no se pudo extraer año del nombre)")
        else:
            # Last fallback: current year
            year = datetime.now().year
            clean_name = nombre
            warnings.append(f"Período '{nombre}' asignado al año actual {year} (no hay año activo)")
        
        # Create academic year if doesn't exist
        if year not in years_map:
            new_year = {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "year": year,
                "status": "cerrado" if year < datetime.now().year else "futuro",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.academic_years.insert_one(new_year)
            del new_year["_id"]
            years_map[year] = new_year
            years_created.append(year)
        
        # Update period with academic_year_id and clean name
        await db.academic_periods.update_one(
            {"id": period["id"]},
            {"$set": {
                "academic_year_id": years_map[year]["id"],
                "nombre": clean_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        periods_migrated.append({
            "original_name": nombre,
            "new_name": clean_name,
            "assigned_year": year
        })
    
    return {
        "message": f"Migración completada: {len(periods_migrated)} períodos migrados",
        "migrated_count": len(periods_migrated),
        "years_created": years_created,
        "periods_migrated": periods_migrated,
        "warnings": warnings if warnings else None
    }

# ══════════════════════════════════════════════════════════════════════════════

# ACADEMIC ASSIGNMENTS API (Teacher-Subject Pivot Table)
# ══════════════════════════════════════════════════════════════════════════════

class AcademicAssignmentCreate(BaseModel):
    teacher_id: str
    level_id: str
    grade_id: str
    section_id: str
    subject_id: str
    academic_year_id: Optional[str] = None  # Changed from period_id - assignments are ANNUAL
    school_year: int = 2026  # Keep for backward compatibility
    role: Literal["titular", "auxiliar"] = "titular"
    status: Literal["activo", "inactivo"] = "activo"

class AcademicAssignmentUpdate(BaseModel):
    teacher_id: Optional[str] = None
    level_id: Optional[str] = None
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    subject_id: Optional[str] = None
    academic_year_id: Optional[str] = None  # Changed from period_id
    school_year: Optional[int] = None
    role: Optional[Literal["titular", "auxiliar"]] = None
    status: Optional[Literal["activo", "inactivo"]] = None

@router.get("/academic/assignments")
async def get_academic_assignments(
    level_id: Optional[str] = None,
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    school_year: Optional[int] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all academic assignments with optional filters"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    query = {"school_id": school_id}
    # Tutor assignments live in the same collection (role="tutor") but belong to
    # "Gestión de Tutorías", NOT to teacher↔subject assignment. They legitimately
    # have no subject, so they must NOT appear here (otherwise they show up as
    # "Sin curso vinculado"). `$ne` also keeps legacy docs with no role field.
    query["role"] = {"$ne": "tutor"}
    
    # Apply filters
    if level_id:
        query["level_id"] = level_id
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    if subject_id:
        query["subject_id"] = subject_id
    if teacher_id:
        query["teacher_id"] = teacher_id
    if school_year:
        query["school_year"] = school_year
    if status:
        query["status"] = status
    
    assignments = await db.academic_assignments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with related data
    if assignments:
        # Get all unique IDs
        teacher_ids = list(set(a.get("teacher_id") for a in assignments if a.get("teacher_id")))
        level_ids = list(set(a.get("level_id") for a in assignments if a.get("level_id")))
        grade_ids = list(set(a.get("grade_id") for a in assignments if a.get("grade_id")))
        section_ids = list(set(a.get("section_id") for a in assignments if a.get("section_id")))
        subject_ids = list(set(a.get("subject_id") for a in assignments if a.get("subject_id")))
        
        # Fetch related data
        teachers = await db.users.find({"id": {"$in": teacher_ids}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}).to_list(500)
        levels = await db.academic_levels.find({"id": {"$in": level_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
        grades = await db.grades.find({"id": {"$in": grade_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
        sections = await db.sections.find({"id": {"$in": section_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
        subjects = await db.subjects.find({"id": {"$in": subject_ids}}, {"_id": 0, "id": 1, "name": 1, "code": 1, "color": 1}).to_list(len(subject_ids) + 10)
        
        # Get academic years for assignments that have academic_year_id
        year_ids = list(set([a.get("academic_year_id") for a in assignments if a.get("academic_year_id")]))
        years = await db.academic_years.find({"id": {"$in": year_ids}}, {"_id": 0, "id": 1, "year": 1, "status": 1}).to_list(50) if year_ids else []
        
        # Create lookup maps
        teachers_map = {t["id"]: t for t in teachers}
        levels_map = {lvl["id"]: lvl for lvl in levels}
        grades_map = {g["id"]: g for g in grades}
        sections_map = {s["id"]: s for s in sections}
        subjects_map = {s["id"]: s for s in subjects}
        years_map = {y["id"]: y for y in years}
        
        # Enrich assignments
        for a in assignments:
            teacher = teachers_map.get(a.get("teacher_id", ""), {})
            a["teacher_name"] = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
            a["teacher_photo"] = teacher.get("photo_url")
            
            level = levels_map.get(a.get("level_id", ""), {})
            a["level_name"] = level.get("nombre", "")
            
            grade = grades_map.get(a.get("grade_id", ""), {})
            a["grade_name"] = grade.get("nombre", "")
            
            section = sections_map.get(a.get("section_id", ""), {})
            a["section_name"] = section.get("nombre", "")
            
            subject = subjects_map.get(a.get("subject_id", ""), {})
            a["subject_name"] = subject.get("name", "")
            a["subject_code"] = subject.get("code", "")
            a["subject_color"] = subject.get("color", "#3B82F6")
            
            # Add academic year info
            if a.get("academic_year_id"):
                year_data = years_map.get(a["academic_year_id"], {})
                a["academic_year"] = year_data.get("year", a.get("school_year"))
                a["academic_year_status"] = year_data.get("status", "")
        
        # Hide orphan assignments (their course was deleted/recreated, so the
        # subject_id no longer resolves) from the normal "Asignación docente"
        # view — they only confuse the user as "Sin curso vinculado". They stay
        # in the DB and remain available to Support via the "Huérfanas" tool.
        assignments = [a for a in assignments if a.get("subject_id") in subjects_map]
    
    return assignments

@router.get("/academic/assignments/by-teacher/{teacher_id}")
async def get_assignments_by_teacher(
    teacher_id: str,
    school_year: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    """Get all assignments for a specific teacher (for profile view)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    query = {"school_id": school_id, "teacher_id": teacher_id, "status": "activo"}
    
    if school_year:
        query["school_year"] = school_year
    
    assignments = await db.academic_assignments.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with related data
    for a in assignments:
        level = await db.academic_levels.find_one({"id": a["level_id"]}, {"_id": 0, "nombre": 1})
        grade = await db.grades.find_one({"id": a["grade_id"]}, {"_id": 0, "nombre": 1})
        section = await db.sections.find_one({"id": a["section_id"]}, {"_id": 0, "nombre": 1})
        subject = await db.subjects.find_one({"id": a["subject_id"]}, {"_id": 0, "name": 1, "code": 1, "color": 1})
        
        a["level_name"] = level.get("nombre", "") if level else ""
        a["grade_name"] = grade.get("nombre", "") if grade else ""
        a["section_name"] = section.get("nombre", "") if section else ""
        a["subject_name"] = subject.get("name", "") if subject else ""
        a["subject_code"] = subject.get("code", "") if subject else ""
        a["subject_color"] = subject.get("color", "#3B82F6") if subject else "#3B82F6"
    
    return assignments

@router.get("/academic/assignments/teachers-summary")
async def get_teachers_assignments_summary(
    school_year: Optional[int] = 2026,
    current_user = Depends(get_current_user)
):
    """Get summary of assignments per teacher (for load visualization)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Get all active teachers
    teachers = await db.users.find(
        {"school_id": school_id, "role": "teacher", "status": {"$ne": "inactive"}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}
    ).to_list(500)
    
    # Get assignment counts per teacher
    result = []
    for teacher in teachers:
        count = await db.academic_assignments.count_documents({
            "school_id": school_id,
            "teacher_id": teacher["id"],
            "school_year": school_year,
            "status": "activo"
        })
        result.append({
            "id": teacher["id"],
            "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
            "photo_url": teacher.get("photo_url"),
            "assignments_count": count
        })
    
    # Sort by assignment count descending
    result.sort(key=lambda x: x["assignments_count"], reverse=True)
    
    return result

@router.post("/academic/assignments")
async def create_academic_assignment(
    data: AcademicAssignmentCreate,
    current_user = Depends(get_current_user)
):
    """Create a new academic assignment"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear asignaciones")
    
    school_id = user["school_id"]
    
    # Validate teacher exists and is a teacher
    teacher = await db.users.find_one({
        "id": data.teacher_id,
        "school_id": school_id,
        "role": "teacher"
    })
    if not teacher:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    
    # Validate level exists
    level = await db.academic_levels.find_one({"id": data.level_id, "school_id": school_id})
    if not level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    
    # Validate grade exists and belongs to level
    grade = await db.grades.find_one({
        "id": data.grade_id,
        "school_id": school_id,
        "nivel_id": data.level_id
    })
    if not grade:
        raise HTTPException(status_code=404, detail="Grado no encontrado o no pertenece al nivel")
    
    # Validate section exists
    section = await db.sections.find_one({
        "id": data.section_id,
        "school_id": school_id
    })
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    
    # Validate subject exists
    subject = await db.subjects.find_one({
        "id": data.subject_id,
        "school_id": school_id
    })
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Validate academic year if provided
    academic_year = None
    if data.academic_year_id:
        academic_year = await db.academic_years.find_one({
            "id": data.academic_year_id,
            "school_id": school_id
        })
        if not academic_year:
            raise HTTPException(status_code=404, detail="Año académico no encontrado")
        # Update school_year from the academic year
        data.school_year = academic_year.get("year", data.school_year)
    
    # Check for exact duplicate - now using academic_year_id
    duplicate_query = {
        "school_id": school_id,
        "teacher_id": data.teacher_id,
        "level_id": data.level_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "subject_id": data.subject_id,
    }
    # Add year criterion
    if data.academic_year_id:
        duplicate_query["academic_year_id"] = data.academic_year_id
    else:
        duplicate_query["school_year"] = data.school_year
    
    duplicate = await db.academic_assignments.find_one(duplicate_query)
    if duplicate:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una asignación exacta para este profesor, asignatura, nivel, grado, sección y año escolar"
        )
    
    assignment = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "teacher_id": data.teacher_id,
        "level_id": data.level_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "subject_id": data.subject_id,
        "academic_year_id": data.academic_year_id,
        "school_year": data.school_year,
        "role": data.role,
        "status": data.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.academic_assignments.insert_one(assignment)
    
    # Remove _id for response
    if "_id" in assignment:
        del assignment["_id"]
    
    # Enrich response
    assignment["teacher_name"] = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
    assignment["level_name"] = level.get("nombre", "")
    assignment["grade_name"] = grade.get("nombre", "")
    assignment["section_name"] = section.get("nombre", "")
    assignment["subject_name"] = subject.get("name", "")
    
    logger.info(f"Academic assignment created: {assignment['id']} for school {school_id}")
    
    return {"message": "Asignación creada correctamente", "assignment": assignment}

class BulkAssignmentCreate(BaseModel):
    teacher_id: str
    level_id: str
    grade_ids: List[str]
    section_ids: List[str]
    subject_ids: List[str]
    academic_year_id: Optional[str] = None
    school_year: int = 2026
    role: Literal["titular", "auxiliar"] = "titular"

@router.post("/academic/assignments/bulk")
async def create_bulk_academic_assignments(
    data: BulkAssignmentCreate,
    current_user = Depends(get_current_user)
):
    """Create multiple academic assignments in one operation (cartesian product)."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear asignaciones")

    school_id = user["school_id"]

    # Validate teacher
    teacher = await db.users.find_one({"id": data.teacher_id, "school_id": school_id, "role": "teacher"})
    if not teacher:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")

    # Validate level
    level = await db.academic_levels.find_one({"id": data.level_id, "school_id": school_id})
    if not level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")

    # Validate academic year
    academic_year = None
    if data.academic_year_id:
        academic_year = await db.academic_years.find_one({"id": data.academic_year_id, "school_id": school_id})
        if not academic_year:
            raise HTTPException(status_code=404, detail="Ano academico no encontrado")
        data.school_year = academic_year.get("year", data.school_year)

    # Pre-fetch valid grades, sections, subjects for this school+level
    valid_grades = {g["id"]: g for g in await db.grades.find(
        {"id": {"$in": data.grade_ids}, "school_id": school_id, "nivel_id": data.level_id}, {"_id": 0}
    ).to_list(100)}
    valid_sections = {s["id"]: s for s in await db.sections.find(
        {"id": {"$in": data.section_ids}, "school_id": school_id}, {"_id": 0}
    ).to_list(200)}
    valid_subjects = {s["id"]: s for s in await db.subjects.find(
        {"id": {"$in": data.subject_ids}, "school_id": school_id}, {"_id": 0}
    ).to_list(500)}

    now = datetime.now(timezone.utc).isoformat()
    created = 0
    skipped = 0
    failed = []
    details = []

    # Cartesian product: grades × sections × subjects
    for grade_id in data.grade_ids:
        if grade_id not in valid_grades:
            failed.append({"grade_id": grade_id, "reason": "Grado no encontrado o no pertenece al nivel"})
            continue

        for section_id in data.section_ids:
            if section_id not in valid_sections:
                failed.append({"section_id": section_id, "reason": "Seccion no encontrada"})
                continue
            section = valid_sections[section_id]
            # Verify this section belongs to this grade
            if section.get("grado_id") != grade_id:
                continue  # silently skip — not an error, just an invalid combination

            for subject_id in data.subject_ids:
                if subject_id not in valid_subjects:
                    failed.append({"subject_id": subject_id, "reason": "Asignatura no encontrada"})
                    continue

                # Check for duplicate
                dup_query = {
                    "school_id": school_id,
                    "teacher_id": data.teacher_id,
                    "level_id": data.level_id,
                    "grade_id": grade_id,
                    "section_id": section_id,
                    "subject_id": subject_id,
                }
                if data.academic_year_id:
                    dup_query["academic_year_id"] = data.academic_year_id
                else:
                    dup_query["school_year"] = data.school_year

                existing = await db.academic_assignments.find_one(dup_query)
                if existing:
                    skipped += 1
                    details.append({
                        "grade": valid_grades[grade_id].get("nombre", ""),
                        "section": section.get("nombre", ""),
                        "subject": valid_subjects[subject_id].get("name", ""),
                        "status": "skipped"
                    })
                    continue

                assignment = {
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "teacher_id": data.teacher_id,
                    "level_id": data.level_id,
                    "grade_id": grade_id,
                    "section_id": section_id,
                    "subject_id": subject_id,
                    "academic_year_id": data.academic_year_id,
                    "school_year": data.school_year,
                    "role": data.role,
                    "status": "activo",
                    "created_at": now,
                    "created_by": user["id"]
                }
                await db.academic_assignments.insert_one(assignment)
                created += 1
                details.append({
                    "grade": valid_grades[grade_id].get("nombre", ""),
                    "section": section.get("nombre", ""),
                    "subject": valid_subjects[subject_id].get("name", ""),
                    "status": "created"
                })

    teacher_name = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
    logger.info(f"Bulk assignment: {created} created, {skipped} skipped for teacher {teacher_name} in school {school_id}")

    return {
        "created": created,
        "skipped": skipped,
        "failed": failed,
        "details": details,
        "teacher_name": teacher_name
    }


@router.put("/academic/assignments/{assignment_id}")
async def update_academic_assignment(
    assignment_id: str,
    data: AcademicAssignmentUpdate,
    current_user = Depends(get_current_user)
):
    """Update an academic assignment"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar asignaciones")
    
    school_id = user["school_id"]
    
    assignment = await db.academic_assignments.find_one({
        "id": assignment_id,
        "school_id": school_id
    })
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    update_data = {}
    
    # Validate and update each field
    if data.teacher_id is not None:
        teacher = await db.users.find_one({"id": data.teacher_id, "school_id": school_id, "role": "teacher"})
        if not teacher:
            raise HTTPException(status_code=404, detail="Profesor no encontrado")
        update_data["teacher_id"] = data.teacher_id
    
    if data.level_id is not None:
        level = await db.academic_levels.find_one({"id": data.level_id, "school_id": school_id})
        if not level:
            raise HTTPException(status_code=404, detail="Nivel no encontrado")
        update_data["level_id"] = data.level_id
    
    if data.grade_id is not None:
        grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
        if not grade:
            raise HTTPException(status_code=404, detail="Grado no encontrado")
        update_data["grade_id"] = data.grade_id
    
    if data.section_id is not None:
        section = await db.sections.find_one({"id": data.section_id, "school_id": school_id})
        if not section:
            raise HTTPException(status_code=404, detail="Sección no encontrada")
        update_data["section_id"] = data.section_id
    
    if data.subject_id is not None:
        subject = await db.subjects.find_one({"id": data.subject_id, "school_id": school_id})
        if not subject:
            raise HTTPException(status_code=404, detail="Asignatura no encontrada")
        update_data["subject_id"] = data.subject_id
    
    if data.academic_year_id is not None:
        academic_year = await db.academic_years.find_one({"id": data.academic_year_id, "school_id": school_id})
        if not academic_year:
            raise HTTPException(status_code=404, detail="Año académico no encontrado")
        update_data["academic_year_id"] = data.academic_year_id
        update_data["school_year"] = academic_year.get("year", data.school_year if data.school_year else assignment.get("school_year"))
    
    if data.school_year is not None and data.academic_year_id is None:
        update_data["school_year"] = data.school_year
    
    if data.role is not None:
        update_data["role"] = data.role
    
    if data.status is not None:
        update_data["status"] = data.status
    
    if update_data:
        # Check for duplicate after update
        check_data = {**assignment, **update_data}
        duplicate_query = {
            "school_id": school_id,
            "teacher_id": check_data["teacher_id"],
            "level_id": check_data["level_id"],
            "grade_id": check_data["grade_id"],
            "section_id": check_data["section_id"],
            "subject_id": check_data["subject_id"],
            "id": {"$ne": assignment_id}  # Exclude current assignment
        }
        # Add year criterion
        if check_data.get("academic_year_id"):
            duplicate_query["academic_year_id"] = check_data["academic_year_id"]
        else:
            duplicate_query["school_year"] = check_data.get("school_year")
        
        duplicate = await db.academic_assignments.find_one(duplicate_query)
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Ya existe una asignación con esta combinación"
            )
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.academic_assignments.update_one({"id": assignment_id}, {"$set": update_data})
    
    updated = await db.academic_assignments.find_one({"id": assignment_id}, {"_id": 0})
    
    return {"message": "Asignación actualizada correctamente", "assignment": updated}

async def _get_orphan_assignment_ids(school_id: str):
    """Orphan assignment = a teacher assignment whose `subject_id` is missing or
    points to a subject (course) that no longer exists. These show up in the UI
    with no linked course."""
    rows = await db.academic_assignments.find(
        {"school_id": school_id, "role": {"$ne": "tutor"}}, {"_id": 0, "id": 1, "subject_id": 1}
    ).to_list(5000)
    subject_ids = list({r.get("subject_id") for r in rows if r.get("subject_id")})
    existing = set()
    if subject_ids:
        subs = await db.subjects.find(
            {"id": {"$in": subject_ids}}, {"_id": 0, "id": 1}
        ).to_list(5000)
        existing = {s["id"] for s in subs}
    return [r["id"] for r in rows if not r.get("subject_id") or r.get("subject_id") not in existing]


@router.get("/academic/assignments/orphans")
async def get_orphan_assignments(current_user = Depends(get_current_user)):
    """List teacher assignments with no valid linked course (huérfanas).

    Restringido a sesiones de Soporte: ni el propietario ni el administrador del
    colegio deben ver/usar esta herramienta de mantenimiento."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not user.get("is_support_session"):
        raise HTTPException(status_code=403, detail="Solo soporte puede acceder a las asignaciones huérfanas")

    school_id = user["school_id"]
    orphan_ids = await _get_orphan_assignment_ids(school_id)
    if not orphan_ids:
        return []

    assignments = await db.academic_assignments.find(
        {"school_id": school_id, "id": {"$in": orphan_ids}}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)

    # Enrich with teacher / level / grade / section names (subject is missing).
    teacher_ids = list({a.get("teacher_id") for a in assignments if a.get("teacher_id")})
    level_ids = list({a.get("level_id") for a in assignments if a.get("level_id")})
    grade_ids = list({a.get("grade_id") for a in assignments if a.get("grade_id")})
    section_ids = list({a.get("section_id") for a in assignments if a.get("section_id")})
    year_ids = list({a.get("academic_year_id") for a in assignments if a.get("academic_year_id")})

    teachers = await db.users.find({"id": {"$in": teacher_ids}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}).to_list(500)
    levels = await db.academic_levels.find({"id": {"$in": level_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
    grades = await db.grades.find({"id": {"$in": grade_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
    sections = await db.sections.find({"id": {"$in": section_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
    years = await db.academic_years.find({"id": {"$in": year_ids}}, {"_id": 0, "id": 1, "year": 1, "status": 1}).to_list(50) if year_ids else []

    teachers_map = {t["id"]: t for t in teachers}
    levels_map = {lv["id"]: lv for lv in levels}
    grades_map = {g["id"]: g for g in grades}
    sections_map = {s["id"]: s for s in sections}
    years_map = {y["id"]: y for y in years}

    for a in assignments:
        teacher = teachers_map.get(a.get("teacher_id", ""), {})
        a["teacher_name"] = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
        a["teacher_photo"] = teacher.get("photo_url")
        a["level_name"] = levels_map.get(a.get("level_id", ""), {}).get("nombre", "")
        a["grade_name"] = grades_map.get(a.get("grade_id", ""), {}).get("nombre", "")
        a["section_name"] = sections_map.get(a.get("section_id", ""), {}).get("nombre", "")
        a["subject_name"] = ""
        a["subject_code"] = ""
        a["subject_color"] = "#9CA3AF"
        if a.get("academic_year_id"):
            yd = years_map.get(a["academic_year_id"], {})
            a["academic_year"] = yd.get("year", a.get("school_year"))
            a["academic_year_status"] = yd.get("status", "")

    return assignments


@router.delete("/academic/assignments/orphans")
async def delete_orphan_assignments(current_user = Depends(get_current_user)):
    """Bulk-delete all orphan teacher assignments (no valid linked course).

    Restringido a sesiones de Soporte únicamente."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not user.get("is_support_session"):
        raise HTTPException(status_code=403, detail="Solo soporte puede eliminar las asignaciones huérfanas")

    school_id = user["school_id"]
    orphan_ids = await _get_orphan_assignment_ids(school_id)
    if not orphan_ids:
        return {"message": "No hay asignaciones huérfanas", "deleted_count": 0}

    result = await db.academic_assignments.delete_many(
        {"school_id": school_id, "id": {"$in": orphan_ids}}
    )
    logger.info(f"Deleted {result.deleted_count} orphan academic assignments for school {school_id}")
    return {
        "message": f"{result.deleted_count} asignación(es) huérfana(s) eliminada(s)",
        "deleted_count": result.deleted_count,
    }


class BulkDeleteAssignments(BaseModel):
    ids: List[str]


@router.post("/academic/assignments/bulk-delete")
async def bulk_delete_academic_assignments(
    data: BulkDeleteAssignments,
    current_user = Depends(get_current_user)
):
    """Delete multiple academic assignments at once (selected via checkboxes)."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar asignaciones")

    ids = [i for i in (data.ids or []) if i]
    if not ids:
        raise HTTPException(status_code=400, detail="No se seleccionaron asignaciones")

    school_id = user["school_id"]
    result = await db.academic_assignments.delete_many({
        "id": {"$in": ids},
        "school_id": school_id
    })

    logger.info(f"Bulk-deleted {result.deleted_count} academic assignments for school {school_id}")
    return {
        "message": f"{result.deleted_count} asignación(es) eliminada(s)",
        "deleted_count": result.deleted_count,
    }



@router.delete("/academic/assignments/{assignment_id}")
async def delete_academic_assignment(
    assignment_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an academic assignment"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar asignaciones")
    
    school_id = user["school_id"]
    
    result = await db.academic_assignments.delete_one({
        "id": assignment_id,
        "school_id": school_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    logger.info(f"Academic assignment deleted: {assignment_id}")
    
    return {"message": "Asignación eliminada correctamente"}

@router.get("/users/teachers/active")
async def get_active_teachers(
    current_user = Depends(get_current_user)
):
    """Get all active teachers for the school"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    teachers = await db.users.find(
        {
            "school_id": school_id,
            "role": "teacher",
            "status": {"$ne": "inactive"}
        },
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1}
    ).sort("name", 1).to_list(500)
    
    return teachers



# ══════════════════════════════════════════════════════════════════════════════

