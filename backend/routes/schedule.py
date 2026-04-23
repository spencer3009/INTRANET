"""
Schedule settings, breaks, entries, presence
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

# SCHEDULES API
# ══════════════════════════════════════════════════════════════════════════════

# Schedule Settings Model (persistent per school)
class ScheduleSettingsCreate(BaseModel):
    start_hour: str = "07:00"
    end_hour: str = "18:00"
    time_format: str = "24h"  # "12h" or "24h"
    block_duration: int = 45  # minutes
    view_mode: str = "horizontal"  # "horizontal" (time ranges in rows) or "vertical" (time in column)
    include_saturday: bool = False
    include_sunday: bool = False
    permitir_profesor_multiples_horarios: bool = False
    # ── Time slots customization ──────────────────────────────────────
    # Configurable tick interval for the left column of the horizontal grid.
    # Valid values: 10, 15, 20, 30, 45, 60 minutes.
    slot_interval_minutes: int = 60
    # Manual ticks (HH:MM strings). When non-empty, these override the
    # interval generator: the grid draws exactly these ticks and nothing else.
    manual_ticks: List[str] = []
    # Scope of the settings payload when saving: "global" (whole school) or
    # "by_section" (per {school_id, grade_id, section_id}). Read-only field
    # when returned to clients; only used during POST.
    slot_scope: str = "global"
    grade_id: Optional[str] = None
    section_id: Optional[str] = None

class ScheduleCreate(BaseModel):
    tipo: str  # "clases", "profesores", "examenes"
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    profesor_id: Optional[str] = None
    materia: str
    subject_id: Optional[str] = None
    dia: str
    hora_inicio: str
    hora_fin: str
    aula: Optional[str] = None
    color: Optional[str] = "#3B82F6"

class ScheduleUpdate(BaseModel):
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    profesor_id: Optional[str] = None
    materia: Optional[str] = None
    subject_id: Optional[str] = None
    dia: Optional[str] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    aula: Optional[str] = None
    color: Optional[str] = None

# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULE SETTINGS ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/schedule-settings")
async def get_schedule_settings(
    grade_id: Optional[str] = Query(None),
    section_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
):
    """Get schedule settings for school.

    Resolution order when grade_id + section_id are provided:
      1. Look up per-section override in `schedule_slot_overrides`.
         If found, merge it on top of the global settings (override wins
         for the slot-related fields only: start_hour, end_hour,
         slot_interval_minutes, manual_ticks).
      2. Fallback: return the global settings as usual.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    school_id = user["school_id"]

    # Load global settings (or defaults)
    settings = await db.schedule_settings.find_one(
        {"school_id": school_id},
        {"_id": 0},
    )
    if not settings:
        settings = {
            "school_id": school_id,
            "start_hour": "07:00",
            "end_hour": "18:00",
            "time_format": "24h",
            "block_duration": 45,
            "view_mode": "horizontal",
            "include_saturday": False,
            "include_sunday": False,
            "permitir_profesor_multiples_horarios": False,
            "slot_interval_minutes": 60,
            "manual_ticks": [],
        }

    # Defaults for new fields on legacy documents
    settings.setdefault("permitir_profesor_multiples_horarios", False)
    settings.setdefault("slot_interval_minutes", 60)
    settings.setdefault("manual_ticks", [])

    # Default scope flag reported back to clients (UI reads this to show
    # whether it is editing a global or section-level config).
    settings["slot_scope"] = "global"
    settings["grade_id"] = None
    settings["section_id"] = None

    # Per-section override resolution
    if grade_id and section_id:
        override = await db.schedule_slot_overrides.find_one(
            {
                "school_id": school_id,
                "grade_id": grade_id,
                "section_id": section_id,
            },
            {"_id": 0},
        )
        if override:
            # Only the slot-related fields are overridden; everything else
            # (view_mode, time_format, weekend flags, etc.) stays global.
            for key in ("start_hour", "end_hour", "slot_interval_minutes", "manual_ticks"):
                if key in override:
                    settings[key] = override[key]
            settings["slot_scope"] = "by_section"
            settings["grade_id"] = grade_id
            settings["section_id"] = section_id

    return settings


@router.post("/schedule-settings")
async def save_schedule_settings(
    data: ScheduleSettingsCreate,
    current_user = Depends(get_current_user)
):
    """Save or update schedule settings for the school.

    - `slot_scope="global"`  → upsert in `schedule_settings`.
    - `slot_scope="by_section"` → upsert in `schedule_slot_overrides`,
      keyed by {school_id, grade_id, section_id}. Only slot fields are
      persisted there; everything else stays global.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar configuración")

    school_id = user["school_id"]
    timestamp = datetime.now(timezone.utc).isoformat()

    # Validate manual_ticks format (each must be "HH:MM")
    if data.manual_ticks:
        for tick in data.manual_ticks:
            parts = tick.split(":")
            if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
                raise HTTPException(status_code=400, detail=f"Tick inválido: '{tick}'. Usa formato HH:MM.")
            h, m = int(parts[0]), int(parts[1])
            if not (0 <= h < 24 and 0 <= m < 60):
                raise HTTPException(status_code=400, detail=f"Tick fuera de rango: '{tick}'.")

    if data.slot_interval_minutes not in (10, 15, 20, 30, 45, 60):
        raise HTTPException(status_code=400, detail="slot_interval_minutes debe ser 10, 15, 20, 30, 45 o 60")

    # ── Per-section override path ────────────────────────────────────
    if data.slot_scope == "by_section":
        if not data.grade_id or not data.section_id:
            raise HTTPException(status_code=400, detail="Para alcance por sección se requieren grade_id y section_id")
        override_doc = {
            "school_id": school_id,
            "grade_id": data.grade_id,
            "section_id": data.section_id,
            "start_hour": data.start_hour,
            "end_hour": data.end_hour,
            "slot_interval_minutes": data.slot_interval_minutes,
            "manual_ticks": data.manual_ticks,
            "updated_at": timestamp,
        }
        await db.schedule_slot_overrides.update_one(
            {
                "school_id": school_id,
                "grade_id": data.grade_id,
                "section_id": data.section_id,
            },
            {"$set": override_doc},
            upsert=True,
        )
        return {
            "message": "Configuración guardada solo para esta sección",
            "scope": "by_section",
            "settings": override_doc,
        }

    # ── Global path (default) ────────────────────────────────────────
    settings_data = {
        "school_id": school_id,
        "start_hour": data.start_hour,
        "end_hour": data.end_hour,
        "time_format": data.time_format,
        "block_duration": data.block_duration,
        "view_mode": data.view_mode,
        "include_saturday": data.include_saturday,
        "include_sunday": data.include_sunday,
        "permitir_profesor_multiples_horarios": data.permitir_profesor_multiples_horarios,
        "slot_interval_minutes": data.slot_interval_minutes,
        "manual_ticks": data.manual_ticks,
        "updated_at": timestamp,
    }

    await db.schedule_settings.update_one(
        {"school_id": school_id},
        {"$set": settings_data},
        upsert=True,
    )

    return {"message": "Configuración guardada correctamente", "scope": "global", "settings": settings_data}

# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULE BREAKS (Recreo, Almuerzo, Eventos)
# ─────────────────────────────────────────────────────────────────────────────

class ScheduleBreakCreate(BaseModel):
    type: str  # "break" (recreo), "lunch" (almuerzo), "event" (evento)
    label: str
    start_time: str
    end_time: str
    grade_id: str  # Required - break belongs to specific grade
    section_id: str  # Required - break belongs to specific section
    color: Optional[str] = None

class ScheduleBreakUpdate(BaseModel):
    type: Optional[str] = None
    label: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    color: Optional[str] = None
    # grade_id and section_id cannot be changed after creation

# Default colors for break types
BREAK_COLORS = {
    "break": "#FCD34D",   # Yellow - Recreo
    "lunch": "#FB923C",   # Orange - Almuerzo
    "event": "#60A5FA"    # Blue - Evento
}

BREAK_LABELS = {
    "break": "Recreo",
    "lunch": "Almuerzo", 
    "event": "Evento"
}

@router.get("/schedule/breaks")
async def get_schedule_breaks(
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get schedule breaks (recreos, almuerzos, eventos) filtered by grade and section"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    
    # Filter by grade and section if provided
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    
    breaks = await db.schedule_breaks.find(query, {"_id": 0}).sort("start_time", 1).to_list(100)
    
    return {"breaks": breaks}

@router.post("/schedule/breaks")
async def create_schedule_break(
    data: ScheduleBreakCreate,
    current_user = Depends(get_current_user)
):
    """Create a new schedule break (recreo, almuerzo, evento) for specific grade/section"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar bloques")
    
    school_id = user["school_id"]
    
    # Validate grade and section exist
    grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
    if not grade:
        raise HTTPException(status_code=400, detail="Grado no válido")
    
    section = await db.sections.find_one({"id": data.section_id, "school_id": school_id})
    if not section:
        raise HTTPException(status_code=400, detail="Sección no válida")
    
    # Check for overlapping breaks in the SAME grade/section
    overlap_query = {
        "school_id": school_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "start_time": {"$lt": data.end_time},
        "end_time": {"$gt": data.start_time}
    }
    existing_break = await db.schedule_breaks.find_one(overlap_query)
    if existing_break:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un bloque en ese horario: {existing_break['label']} ({existing_break['start_time']} - {existing_break['end_time']})"
        )
    
    # Check for overlapping classes in the SAME grade/section
    class_overlap = await db.schedules.find_one({
        "school_id": school_id,
        "grado_id": data.grade_id,
        "seccion_id": data.section_id,
        "hora_inicio": {"$lt": data.end_time},
        "hora_fin": {"$gt": data.start_time}
    })
    if class_overlap:
        raise HTTPException(
            status_code=400,
            detail=f"Hay clases programadas en ese horario ({class_overlap['materia']}). Elimínalas primero."
        )
    
    break_data = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "type": data.type,
        "label": data.label or BREAK_LABELS.get(data.type, "Bloque"),
        "start_time": data.start_time,
        "end_time": data.end_time,
        "color": data.color or BREAK_COLORS.get(data.type, "#94A3B8"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.schedule_breaks.insert_one(break_data)
    if "_id" in break_data:
        del break_data["_id"]
    
    return {"message": "Bloque creado correctamente", "break": break_data}

@router.put("/schedule/breaks/{break_id}")
async def update_schedule_break(
    break_id: str,
    data: ScheduleBreakUpdate,
    current_user = Depends(get_current_user)
):
    """Update a schedule break"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar bloques")
    
    school_id = user["school_id"]
    
    existing = await db.schedule_breaks.find_one({"id": break_id, "school_id": school_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    # If changing time, check for overlaps within SAME grade/section
    new_start = update_data.get("start_time", existing["start_time"])
    new_end = update_data.get("end_time", existing["end_time"])
    
    if "start_time" in update_data or "end_time" in update_data:
        overlap_query = {
            "school_id": school_id,
            "grade_id": existing.get("grade_id"),
            "section_id": existing.get("section_id"),
            "id": {"$ne": break_id},
            "start_time": {"$lt": new_end},
            "end_time": {"$gt": new_start}
        }
        overlapping = await db.schedule_breaks.find_one(overlap_query)
        if overlapping:
            raise HTTPException(
                status_code=400,
                detail=f"Se solapa con: {overlapping['label']} ({overlapping['start_time']} - {overlapping['end_time']})"
            )
        
        # Also check for overlapping classes
        class_overlap = await db.schedules.find_one({
            "school_id": school_id,
            "grado_id": existing.get("grade_id"),
            "seccion_id": existing.get("section_id"),
            "hora_inicio": {"$lt": new_end},
            "hora_fin": {"$gt": new_start}
        })
        if class_overlap:
            raise HTTPException(
                status_code=400,
                detail=f"Hay clases programadas en ese horario ({class_overlap['materia']}). Elimínalas primero."
            )
    
    # Update color if type changed
    if "type" in update_data and "color" not in update_data:
        update_data["color"] = BREAK_COLORS.get(update_data["type"], existing.get("color"))
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.schedule_breaks.update_one({"id": break_id}, {"$set": update_data})
    
    updated = await db.schedule_breaks.find_one({"id": break_id}, {"_id": 0})
    return {"message": "Bloque actualizado", "break": updated}

@router.delete("/schedule/breaks/{break_id}")
async def delete_schedule_break(
    break_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a schedule break"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar bloques")
    
    result = await db.schedule_breaks.delete_one({
        "id": break_id,
        "school_id": user["school_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    
    return {"message": "Bloque eliminado correctamente"}

# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULE ENTRIES ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/schedules")
async def get_schedules(
    tipo: str = "clases",
    grado_id: Optional[str] = None,
    seccion_id: Optional[str] = None,
    profesor_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get schedules filtered by type and criteria"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    
    # Only filter by tipo if explicitly provided for classes
    if tipo:
        query["tipo"] = tipo
    
    if grado_id:
        query["grado_id"] = grado_id
    if seccion_id:
        query["seccion_id"] = seccion_id
    if profesor_id:
        query["profesor_id"] = profesor_id
    
    schedules = await db.schedules.find(query, {"_id": 0}).sort([("dia", 1), ("hora_inicio", 1)]).to_list(500)
    return {"schedules": schedules}

async def check_schedule_conflicts(
    school_id: str, 
    dia: str, 
    hora_inicio: str, 
    hora_fin: str,
    grado_id: Optional[str] = None,
    seccion_id: Optional[str] = None,
    profesor_id: Optional[str] = None,
    aula: Optional[str] = None,
    exclude_id: Optional[str] = None
) -> list:
    """
    Check for schedule conflicts:
    0. Break conflict: blocked time slot (recreo, almuerzo, evento)
    1. Teacher conflict: same teacher at same time in ANY section
    2. Room conflict: same room at same time
    3. Section conflict: same section already has class at this time
    
    IMPORTANT: Overlap detection uses STRICT comparison (< and >) NOT (<= and >=)
    This allows consecutive schedules like 07:00-08:00 and 08:00-09:00 without conflict.
    Overlap exists when: new_start < existing_end AND new_end > existing_start
    
    Returns list of conflict descriptions
    """
    conflicts = []
    
    # 0. Check for break/block conflicts (recreo, almuerzo, evento)
    # Use $lt and $gt for strict comparison (consecutive times don't overlap)
    # Filter by grade_id + section_id so breaks are per-section, not school-wide
    break_query = {
        "school_id": school_id,
        "start_time": {"$lt": hora_fin},   # existing starts before new ends
        "end_time": {"$gt": hora_inicio}    # existing ends after new starts
    }
    if grado_id:
        break_query["grade_id"] = grado_id
    if seccion_id:
        break_query["section_id"] = seccion_id
    break_conflict = await db.schedule_breaks.find_one(break_query, {"_id": 0})
    
    if break_conflict:
        conflicts.append({
            "type": "break",
            "message": f"Este horario está bloqueado: {break_conflict['label']} ({break_conflict['start_time']} - {break_conflict['end_time']})"
        })
        return conflicts  # Return immediately, can't create class in blocked time
    
    # Base time overlap query using STRICT comparison
    # This ensures consecutive schedules don't conflict:
    # - 07:00-08:00 and 08:00-09:00 -> NO conflict (08:00 is NOT < 08:00)
    # - 07:00-08:30 and 08:00-09:00 -> CONFLICT (08:00 < 08:30 AND 09:00 > 08:00)
    time_overlap = {
        "school_id": school_id,
        "dia": dia,
        "hora_inicio": {"$lt": hora_fin},   # existing starts before new ends
        "hora_fin": {"$gt": hora_inicio}     # existing ends after new starts
    }
    
    if exclude_id:
        time_overlap["id"] = {"$ne": exclude_id}
    
    # 1. Check teacher conflict (teacher busy at this time in ANY section)
    if profesor_id:
        # Check if school allows teacher in multiple schedules
        skip_teacher_check = False
        try:
            sched_settings = await db.schedule_settings.find_one(
                {"school_id": school_id}, {"_id": 0, "permitir_profesor_multiples_horarios": 1}
            )
            if sched_settings and sched_settings.get("permitir_profesor_multiples_horarios", False):
                skip_teacher_check = True
        except Exception:
            pass

        if not skip_teacher_check:
            teacher_query = {**time_overlap, "profesor_id": profesor_id}
            teacher_conflict = await db.schedules.find_one(teacher_query, {"_id": 0})
            if teacher_conflict:
                # Get section name for better message
                section = await db.secciones.find_one({"id": teacher_conflict.get("seccion_id")}, {"_id": 0, "nombre": 1})
                section_name = section.get("nombre") if section else "otra sección"
                conflicts.append({
                    "type": "teacher",
                    "message": f"El profesor ya tiene clase de '{teacher_conflict['materia']}' en {section_name} ({teacher_conflict['hora_inicio']} - {teacher_conflict['hora_fin']})"
                })
    
    # 2. Check room conflict (room occupied at this time)
    if aula and aula.strip():
        room_query = {**time_overlap, "aula": aula}
        room_conflict = await db.schedules.find_one(room_query, {"_id": 0})
        if room_conflict:
            conflicts.append({
                "type": "room", 
                "message": f"El aula '{aula}' ya está ocupada con '{room_conflict['materia']}' ({room_conflict['hora_inicio']} - {room_conflict['hora_fin']})"
            })
    
    # 3. Check section conflict (section already has class at this time)
    if grado_id and seccion_id:
        section_query = {**time_overlap, "grado_id": grado_id, "seccion_id": seccion_id}
        section_conflict = await db.schedules.find_one(section_query, {"_id": 0})
        if section_conflict:
            conflicts.append({
                "type": "section",
                "message": f"Esta sección ya tiene '{section_conflict['materia']}' a esta hora ({section_conflict['hora_inicio']} - {section_conflict['hora_fin']})"
            })
    
    return conflicts

@router.post("/schedules")
async def create_schedule(
    data: ScheduleCreate,
    current_user = Depends(get_current_user)
):
    """Create a new schedule entry with robust conflict validation"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar horarios")
    
    school_id = user["school_id"]
    
    # Comprehensive conflict check
    conflicts = await check_schedule_conflicts(
        school_id=school_id,
        dia=data.dia,
        hora_inicio=data.hora_inicio,
        hora_fin=data.hora_fin,
        grado_id=data.grado_id,
        seccion_id=data.seccion_id,
        profesor_id=data.profesor_id,
        aula=data.aula
    )
    
    if conflicts:
        # Return first conflict as main error, all conflicts in detail
        raise HTTPException(
            status_code=400, 
            detail={
                "message": conflicts[0]["message"],
                "conflicts": conflicts
            }
        )
    
    schedule = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "tipo": data.tipo,
        "grado_id": data.grado_id,
        "seccion_id": data.seccion_id,
        "profesor_id": data.profesor_id,
        "materia": data.materia,
        "subject_id": data.subject_id,
        "dia": data.dia,
        "hora_inicio": data.hora_inicio,
        "hora_fin": data.hora_fin,
        "aula": data.aula,
        "color": data.color,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.schedules.insert_one(schedule)
    if "_id" in schedule:
        del schedule["_id"]
    
    return {"message": "Horario creado correctamente", "schedule": schedule}

@router.put("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    current_user = Depends(get_current_user)
):
    """Update a schedule entry with conflict validation"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar horarios")
    
    school_id = user["school_id"]
    
    schedule = await db.schedules.find_one({
        "id": schedule_id,
        "school_id": school_id
    })
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    
    # Merge existing data with updates
    updated_fields = {k: v for k, v in data.dict().items() if v is not None}
    merged = {**schedule, **updated_fields}
    
    # Check for conflicts (excluding current schedule)
    if any(k in updated_fields for k in ['dia', 'hora_inicio', 'hora_fin', 'profesor_id', 'aula', 'grado_id', 'seccion_id']):
        conflicts = await check_schedule_conflicts(
            school_id=school_id,
            dia=merged.get("dia"),
            hora_inicio=merged.get("hora_inicio"),
            hora_fin=merged.get("hora_fin"),
            grado_id=merged.get("grado_id"),
            seccion_id=merged.get("seccion_id"),
            profesor_id=merged.get("profesor_id"),
            aula=merged.get("aula"),
            exclude_id=schedule_id  # Exclude self from conflict check
        )
        
        if conflicts:
            raise HTTPException(
                status_code=400, 
                detail={
                    "message": conflicts[0]["message"],
                    "conflicts": conflicts
                }
            )
    
    updated_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.schedules.update_one({"id": schedule_id}, {"$set": updated_fields})
    
    updated = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    return {"message": "Horario actualizado correctamente", "schedule": updated}

@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a schedule entry"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar horarios")
    
    result = await db.schedules.delete_one({
        "id": schedule_id,
        "school_id": user["school_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    
    return {"message": "Horario eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# USER PRESENCE (ONLINE / OFFLINE)
# ══════════════════════════════════════════════════════════════════════════════

# Presence timeout in minutes - user is offline if no heartbeat in this time
PRESENCE_TIMEOUT_MINUTES = 5

@router.post("/presence/heartbeat")
async def send_heartbeat(current_user = Depends(get_current_user)):
    """
    Send heartbeat to mark user as online.
    Should be called periodically (every 30-60 seconds) by the frontend.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    now = datetime.now(timezone.utc)
    
    # Upsert presence record
    await db.presence.update_one(
        {"user_id": current_user["sub"]},
        {
            "$set": {
                "user_id": current_user["sub"],
                "school_id": user["school_id"],
                "is_online": True,
                "last_seen": now.isoformat()
            }
        },
        upsert=True
    )
    
    return {"status": "ok", "last_seen": now.isoformat()}

@router.get("/presence/users")
async def get_presence_status(
    subject_id: Optional[str] = Query(None, description="Filter by course subject_id"),
    current_user = Depends(get_current_user)
):
    """
    Get online/offline status — optimized.
    If subject_id is provided, only returns presence for users in that course.
    Otherwise returns all school users (backward compatible).
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    timeout_threshold = now - timedelta(minutes=PRESENCE_TIMEOUT_MINUTES)

    presence_filter = {"school_id": school_id}

    # If subject_id provided, scope to course participants only
    if subject_id:
        # Get the subject to find section_id
        subject = await db.subjects.find_one(
            {"id": subject_id},
            {"_id": 0, "seccion_id": 1, "profesor_id": 1}
        )
        if subject:
            # Get student IDs in this section + teacher
            user_ids = []
            if subject.get("profesor_id"):
                user_ids.append(subject["profesor_id"])
            if subject.get("seccion_id"):
                students = await db.users.find(
                    {"school_id": school_id, "seccion_id": subject["seccion_id"],
                     "role": "estudiante", "status": {"$ne": "inactive"}},
                    {"_id": 0, "id": 1}
                ).to_list(200)
                user_ids.extend(s["id"] for s in students)
            if user_ids:
                presence_filter["user_id"] = {"$in": user_ids}

    presence_records = await db.presence.find(
        presence_filter, {"_id": 0}
    ).to_list(length=500)

    result = []
    for p in presence_records:
        last_seen = None
        if p.get("last_seen"):
            try:
                last_seen = datetime.fromisoformat(p["last_seen"].replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass
        is_online = last_seen is not None and last_seen > timeout_threshold
        result.append({
            "user_id": p["user_id"],
            "is_online": is_online,
            "last_seen": p.get("last_seen")
        })

    return {"users": result}

@router.post("/presence/offline")
async def mark_offline(current_user = Depends(get_current_user)):
    """
    Explicitly mark user as offline (called on logout or window close).
    """
    await db.presence.update_one(
        {"user_id": current_user["sub"]},
        {
            "$set": {
                "is_online": False,
                "last_seen": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    return {"status": "ok"}

# ══════════════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────────────
# DUPLICATE SCHEDULES
# ─────────────────────────────────────────────────────────────────────────────

class DuplicateSource(BaseModel):
    grado_id: str
    seccion_id: str
    dia: Optional[str] = None  # required for mode="day"

class DuplicateTarget(BaseModel):
    grado_ids: Optional[List[str]] = None     # mode="section"
    seccion_ids: Optional[List[str]] = None   # mode="section"
    dias: Optional[List[str]] = None          # mode="day"
    anio_academico: Optional[int] = None      # mode="year"

class DuplicateOptions(BaseModel):
    keep_teacher: bool = True
    overwrite_existing: bool = False
    skip_conflicts: bool = True

class DuplicateRequest(BaseModel):
    mode: Literal["section", "day", "year"]
    source: DuplicateSource
    target: DuplicateTarget
    options: DuplicateOptions = DuplicateOptions()

@router.post("/schedules/duplicate")
async def duplicate_schedules(
    data: DuplicateRequest,
    dry_run: bool = Query(False),
    current_user = Depends(get_current_user)
):
    """Duplicate schedule blocks with 3 modes: section, day, year."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden duplicar horarios")

    school_id = user["school_id"]

    # Read multi-schedule setting
    sched_settings = await db.schedule_settings.find_one(
        {"school_id": school_id}, {"_id": 0, "permitir_profesor_multiples_horarios": 1}
    )
    multi_horario = bool(sched_settings and sched_settings.get("permitir_profesor_multiples_horarios", False))

    # Load source blocks
    src_query = {
        "school_id": school_id,
        "grado_id": data.source.grado_id,
        "seccion_id": data.source.seccion_id,
    }
    if data.mode == "day" and data.source.dia:
        src_query["dia"] = data.source.dia

    source_blocks = await db.schedules.find(src_query, {"_id": 0}).to_list(500)
    if not source_blocks:
        raise HTTPException(status_code=400, detail="No hay bloques de horario en el origen seleccionado")

    # Build destination list based on mode
    destinations = []
    if data.mode == "section":
        target_grado_ids = data.target.grado_ids or []
        target_seccion_ids = data.target.seccion_ids or []
        # Validate sections belong to grades
        valid_sections = await db.sections.find(
            {"id": {"$in": target_seccion_ids}, "school_id": school_id}, {"_id": 0}
        ).to_list(200)
        sec_map = {s["id"]: s for s in valid_sections}
        for gid in target_grado_ids:
            for sid in target_seccion_ids:
                sec = sec_map.get(sid)
                if sec and sec.get("grado_id") == gid:
                    destinations.append({"grado_id": gid, "seccion_id": sid, "dia": None})
    elif data.mode == "day":
        target_dias = data.target.dias or []
        destinations = [
            {"grado_id": data.source.grado_id, "seccion_id": data.source.seccion_id, "dia": d}
            for d in target_dias if d != data.source.dia
        ]
    elif data.mode == "year":
        destinations = [
            {"grado_id": data.source.grado_id, "seccion_id": data.source.seccion_id, "dia": None, "year": data.target.anio_academico}
        ]

    if not destinations:
        raise HTTPException(status_code=400, detail="No hay destinos validos para la duplicacion")

    # Pre-load teacher names for conflict messages
    teacher_ids = list(set(b.get("profesor_id") for b in source_blocks if b.get("profesor_id")))
    teachers_list = await db.users.find({"id": {"$in": teacher_ids}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1}).to_list(100) if teacher_ids else []
    teacher_names = {t["id"]: f"{t.get('name','')} {t.get('last_name','')}".strip() for t in teachers_list}

    # Pre-load section names
    all_sec_ids = list(set(d.get("seccion_id") for d in destinations))
    secs = await db.sections.find({"id": {"$in": all_sec_ids}, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
    sec_names = {s["id"]: s.get("nombre", "?") for s in secs}

    grade_ids_all = list(set(d.get("grado_id") for d in destinations))
    grs = await db.grades.find({"id": {"$in": grade_ids_all}, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
    grade_names = {g["id"]: g.get("nombre", "?") for g in grs}

    now = datetime.now(timezone.utc).isoformat()
    created = 0
    skipped = 0
    deleted = 0
    conflicts = []
    to_insert = []

    for dest in destinations:
        for block in source_blocks:
            dia = dest.get("dia") or block["dia"]
            new_block = {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "tipo": block.get("tipo", "clases"),
                "grado_id": dest["grado_id"],
                "seccion_id": dest["seccion_id"],
                "profesor_id": block.get("profesor_id") if data.options.keep_teacher else None,
                "materia": block["materia"],
                "subject_id": block.get("subject_id"),
                "dia": dia,
                "hora_inicio": block["hora_inicio"],
                "hora_fin": block["hora_fin"],
                "aula": block.get("aula"),
                "color": block.get("color", "#3B82F6"),
                "created_at": now,
                "updated_at": now,
            }

            # Check slot conflict (same section, same day/time)
            slot_conflict = await db.schedules.find_one({
                "school_id": school_id,
                "grado_id": dest["grado_id"],
                "seccion_id": dest["seccion_id"],
                "dia": dia,
                "hora_inicio": {"$lt": block["hora_fin"]},
                "hora_fin": {"$gt": block["hora_inicio"]},
            })

            if slot_conflict:
                if data.options.overwrite_existing:
                    if not dry_run:
                        await db.schedules.delete_one({"id": slot_conflict["id"], "school_id": school_id})
                    deleted += 1
                else:
                    dest_label = f"{grade_names.get(dest['grado_id'],'?')} {sec_names.get(dest['seccion_id'],'?')}"
                    conflicts.append({
                        "tipo": "slot",
                        "dia": dia,
                        "hora": f"{block['hora_inicio']}-{block['hora_fin']}",
                        "razon": f"Ya existe '{slot_conflict['materia']}' en {dest_label} el {dia} {block['hora_inicio']}-{block['hora_fin']}"
                    })
                    if data.options.skip_conflicts:
                        skipped += 1
                        continue
                    else:
                        return {
                            "created": 0, "skipped": 0, "deleted": 0,
                            "conflicts": conflicts,
                            "setting_multi_horario_activo": multi_horario,
                            "aborted": True,
                            "abort_reason": conflicts[-1]["razon"]
                        }

            # Check teacher conflict (only if setting disabled)
            prof_id = new_block["profesor_id"]
            if prof_id and not multi_horario:
                teacher_conflict = await db.schedules.find_one({
                    "school_id": school_id,
                    "profesor_id": prof_id,
                    "dia": dia,
                    "hora_inicio": {"$lt": block["hora_fin"]},
                    "hora_fin": {"$gt": block["hora_inicio"]},
                    "seccion_id": {"$ne": dest["seccion_id"]},
                })
                if teacher_conflict:
                    t_name = teacher_names.get(prof_id, "Profesor")
                    t_sec = await db.sections.find_one({"id": teacher_conflict.get("seccion_id")}, {"_id": 0, "nombre": 1})
                    t_sec_name = t_sec.get("nombre", "otra seccion") if t_sec else "otra seccion"
                    conflicts.append({
                        "tipo": "profesor",
                        "dia": dia,
                        "hora": f"{block['hora_inicio']}-{block['hora_fin']}",
                        "razon": f"{t_name} ya tiene '{teacher_conflict['materia']}' en {t_sec_name} el {dia} {block['hora_inicio']}-{block['hora_fin']}"
                    })
                    if data.options.skip_conflicts:
                        skipped += 1
                        continue
                    else:
                        return {
                            "created": 0, "skipped": 0, "deleted": 0,
                            "conflicts": conflicts,
                            "setting_multi_horario_activo": multi_horario,
                            "aborted": True,
                            "abort_reason": conflicts[-1]["razon"]
                        }

            to_insert.append(new_block)
            created += 1

    # Insert all if not dry_run
    if not dry_run and to_insert:
        await db.schedules.insert_many(to_insert)
        # Clean _id from response
        for b in to_insert:
            b.pop("_id", None)

    return {
        "created": created,
        "skipped": skipped,
        "deleted": deleted,
        "conflicts": conflicts,
        "setting_multi_horario_activo": multi_horario,
        "dry_run": dry_run,
    }

