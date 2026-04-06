"""
PAE (Programa de Alimentación Escolar) Module
Turno configuration CRUD endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import logging

from .core import (
    db, get_current_user, resolve_user_from_token, is_admin_user,
    require_role, now_iso, generate_id,
    ADMIN_ROLES,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pae")

# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class TurnoCreate(BaseModel):
    nombre: str
    hora_inicio: str  # HH:mm
    hora_fin: str      # HH:mm
    orden: int = 1

class TurnoUpdate(BaseModel):
    nombre: Optional[str] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    orden: Optional[int] = None

# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def validate_time_format(t: str) -> bool:
    """Validate HH:mm format."""
    if not t or len(t) != 5 or t[2] != ':':
        return False
    try:
        h, m = int(t[:2]), int(t[3:])
        return 0 <= h <= 23 and 0 <= m <= 59
    except ValueError:
        return False

def time_to_minutes(t: str) -> int:
    """Convert HH:mm to total minutes for comparison."""
    h, m = int(t[:2]), int(t[3:])
    return h * 60 + m

def turnos_overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    """Check if two time ranges overlap."""
    a0, a1 = time_to_minutes(a_start), time_to_minutes(a_end)
    b0, b1 = time_to_minutes(b_start), time_to_minutes(b_end)
    return a0 < b1 and b0 < a1

# ══════════════════════════════════════════════════════════════════════════════
# ENSURE INDEXES
# ══════════════════════════════════════════════════════════════════════════════

async def ensure_pae_indexes():
    """Create required indexes for PAE collections."""
    try:
        await db.pae_turnos.create_index(
            [("school_id", 1), ("orden", 1)],
            name="idx_pae_turnos_school_orden"
        )
        await db.pae_registros.create_index(
            [("school_id", 1), ("student_id", 1), ("turno_id", 1), ("fecha", 1)],
            unique=True,
            name="idx_pae_registros_unique"
        )
        logger.info("PAE indexes ensured")
    except Exception as e:
        logger.warning(f"PAE index creation: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# TURNO CRUD ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/turnos")
async def list_turnos(user=Depends(require_role(ADMIN_ROLES))):
    """List all turnos for the school (active and inactive)."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    cursor = db.pae_turnos.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("orden", 1)
    turnos = await cursor.to_list(length=100)
    return turnos


@router.post("/turnos", status_code=201)
async def create_turno(data: TurnoCreate, user=Depends(require_role(ADMIN_ROLES))):
    """Create a new turno for the school."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    # Validate time format
    if not validate_time_format(data.hora_inicio):
        raise HTTPException(status_code=400, detail="Formato de hora_inicio invalido. Use HH:mm")
    if not validate_time_format(data.hora_fin):
        raise HTTPException(status_code=400, detail="Formato de hora_fin invalido. Use HH:mm")

    # Validate hora_fin > hora_inicio
    if time_to_minutes(data.hora_fin) <= time_to_minutes(data.hora_inicio):
        raise HTTPException(status_code=400, detail="La hora de fin debe ser posterior a la hora de inicio")

    # Check for overlapping turnos
    existing = await db.pae_turnos.find(
        {"school_id": school_id, "activo": True},
        {"_id": 0, "hora_inicio": 1, "hora_fin": 1, "nombre": 1}
    ).to_list(length=100)

    for t in existing:
        if turnos_overlap(data.hora_inicio, data.hora_fin, t["hora_inicio"], t["hora_fin"]):
            raise HTTPException(
                status_code=400,
                detail=f"El horario se solapa con el turno '{t['nombre']}' ({t['hora_inicio']} - {t['hora_fin']})"
            )

    now = datetime.now(timezone.utc).isoformat()
    turno = {
        "id": generate_id(),
        "school_id": school_id,
        "nombre": data.nombre.strip(),
        "hora_inicio": data.hora_inicio,
        "hora_fin": data.hora_fin,
        "orden": data.orden,
        "activo": True,
        "created_at": now,
        "updated_at": now,
    }

    await db.pae_turnos.insert_one(turno)

    # Return without _id
    turno.pop("_id", None)
    return turno


@router.put("/turnos/{turno_id}")
async def update_turno(turno_id: str, data: TurnoUpdate, user=Depends(require_role(ADMIN_ROLES))):
    """Update an existing turno."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    existing = await db.pae_turnos.find_one(
        {"id": turno_id, "school_id": school_id},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    updates = {}
    hora_inicio = data.hora_inicio or existing["hora_inicio"]
    hora_fin = data.hora_fin or existing["hora_fin"]

    if data.nombre is not None:
        updates["nombre"] = data.nombre.strip()
    if data.hora_inicio is not None:
        if not validate_time_format(data.hora_inicio):
            raise HTTPException(status_code=400, detail="Formato de hora_inicio invalido. Use HH:mm")
        updates["hora_inicio"] = data.hora_inicio
    if data.hora_fin is not None:
        if not validate_time_format(data.hora_fin):
            raise HTTPException(status_code=400, detail="Formato de hora_fin invalido. Use HH:mm")
        updates["hora_fin"] = data.hora_fin
    if data.orden is not None:
        updates["orden"] = data.orden

    # Validate hora_fin > hora_inicio (using merged values)
    if time_to_minutes(hora_fin) <= time_to_minutes(hora_inicio):
        raise HTTPException(status_code=400, detail="La hora de fin debe ser posterior a la hora de inicio")

    # Check overlapping with other active turnos (exclude self)
    others = await db.pae_turnos.find(
        {"school_id": school_id, "activo": True, "id": {"$ne": turno_id}},
        {"_id": 0, "hora_inicio": 1, "hora_fin": 1, "nombre": 1}
    ).to_list(length=100)

    for t in others:
        if turnos_overlap(hora_inicio, hora_fin, t["hora_inicio"], t["hora_fin"]):
            raise HTTPException(
                status_code=400,
                detail=f"El horario se solapa con el turno '{t['nombre']}' ({t['hora_inicio']} - {t['hora_fin']})"
            )

    if not updates:
        raise HTTPException(status_code=400, detail="No se proporcionaron campos para actualizar")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.pae_turnos.update_one(
        {"id": turno_id, "school_id": school_id},
        {"$set": updates}
    )

    updated = await db.pae_turnos.find_one(
        {"id": turno_id, "school_id": school_id},
        {"_id": 0}
    )
    return updated


@router.patch("/turnos/{turno_id}/toggle")
async def toggle_turno(turno_id: str, user=Depends(require_role(ADMIN_ROLES))):
    """Toggle active/inactive state of a turno."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    existing = await db.pae_turnos.find_one(
        {"id": turno_id, "school_id": school_id},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    new_state = not existing.get("activo", True)

    await db.pae_turnos.update_one(
        {"id": turno_id, "school_id": school_id},
        {"$set": {"activo": new_state, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"id": turno_id, "activo": new_state, "message": f"Turno {'activado' if new_state else 'desactivado'} correctamente"}
