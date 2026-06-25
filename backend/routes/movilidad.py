"""
Movilidad (Transporte Escolar) Module
Turno configuration CRUD endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from pymongo.errors import DuplicateKeyError
from datetime import datetime, timezone
import logging

from .core import (
    db, get_current_user, resolve_user_from_token, is_admin_user,
    require_role, now_iso, generate_id,
    ADMIN_ROLES, safe_create_index,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/movilidad")

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

async def ensure_movilidad_indexes():
    """Create required indexes for PAE collections."""
    try:
        await safe_create_index(db.movilidad_turnos, 
            [("school_id", 1), ("orden", 1)],
            name="idx_movilidad_turnos_school_orden"
        )
        await safe_create_index(db.movilidad_registros, 
            [("school_id", 1), ("student_id", 1), ("turno_id", 1), ("fecha", 1)],
            unique=True,
            name="idx_movilidad_registros_unique"
        )
        logger.info("PAE indexes ensured")
    except Exception as e:
        logger.warning(f"PAE index creation: {e}")


DEFAULT_MOVILIDAD_TURNOS = [
    {"nombre": "Entrada", "hora_inicio": "07:00", "hora_fin": "08:30", "orden": 1, "activo": True},
    {"nombre": "Salida", "hora_inicio": "13:00", "hora_fin": "15:30", "orden": 2, "activo": True},
]


async def seed_movilidad_default_turnos(school_id: str):
    """Seed default PAE turnos for a school if none exist."""
    existing = await db.movilidad_turnos.count_documents({"school_id": school_id})
    if existing > 0:
        return False  # Already has turnos

    now = datetime.now(timezone.utc).isoformat()
    for t in DEFAULT_MOVILIDAD_TURNOS:
        await db.movilidad_turnos.insert_one({
            "id": generate_id(),
            "school_id": school_id,
            "nombre": t["nombre"],
            "hora_inicio": t["hora_inicio"],
            "hora_fin": t["hora_fin"],
            "orden": t["orden"],
            "activo": t["activo"],
            "created_at": now,
            "updated_at": now,
        })
    return True

# ══════════════════════════════════════════════════════════════════════════════
# TURNO CRUD ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/turnos")
async def list_turnos(user=Depends(require_role(ADMIN_ROLES))):
    """List all turnos for the school (active and inactive)."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    cursor = db.movilidad_turnos.find(
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
    existing = await db.movilidad_turnos.find(
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

    await db.movilidad_turnos.insert_one(turno)

    # Return without _id
    turno.pop("_id", None)
    return turno


@router.put("/turnos/{turno_id}")
async def update_turno(turno_id: str, data: TurnoUpdate, user=Depends(require_role(ADMIN_ROLES))):
    """Update an existing turno."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    existing = await db.movilidad_turnos.find_one(
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
    others = await db.movilidad_turnos.find(
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

    await db.movilidad_turnos.update_one(
        {"id": turno_id, "school_id": school_id},
        {"$set": updates}
    )

    updated = await db.movilidad_turnos.find_one(
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

    existing = await db.movilidad_turnos.find_one(
        {"id": turno_id, "school_id": school_id},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    new_state = not existing.get("activo", True)

    await db.movilidad_turnos.update_one(
        {"id": turno_id, "school_id": school_id},
        {"$set": {"activo": new_state, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"id": turno_id, "activo": new_state, "message": f"Turno {'activado' if new_state else 'desactivado'} correctamente"}


@router.delete("/turnos/{turno_id}")
async def delete_turno(turno_id: str, user=Depends(require_role(ADMIN_ROLES))):
    """Delete a turno. Only if it has no registros associated."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    existing = await db.movilidad_turnos.find_one(
        {"id": turno_id, "school_id": school_id},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    # Check if turno has registros
    count = await db.movilidad_registros.count_documents({"turno_id": turno_id, "school_id": school_id})
    if count > 0:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar: este turno tiene {count} registros asociados. Desactivelo en su lugar.")

    await db.movilidad_turnos.delete_one({"id": turno_id, "school_id": school_id})
    return {"message": "Turno eliminado correctamente"}


# ══════════════════════════════════════════════════════════════════════════════
# REGISTRO (ESCANEO) ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

MOVILIDAD_SCAN_ROLES = ["auxiliar_movilidad", "owner", "admin"]

class RegistroCreate(BaseModel):
    qr_data: str
    turno_id: str


def resolve_qr_to_id(raw: str):
    """Extract qr_id from raw QR data (URL or plain short ID)."""
    raw = raw.strip()
    if raw.startswith("http"):
        parts = raw.rstrip("/").split("/")
        return parts[-1] if parts else None
    if len(raw) <= 12 and not raw.startswith("ey"):
        return raw
    return None


@router.post("/registro", status_code=201)
async def registrar_asistencia(data: RegistroCreate, user=Depends(require_role(MOVILIDAD_SCAN_ROLES))):
    """Register a student's meal attendance via QR scan."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    # 1. Resolve QR → student
    qr_id = resolve_qr_to_id(data.qr_data)
    if not qr_id:
        raise HTTPException(status_code=404, detail="Codigo QR no reconocido.")

    student = await db.users.find_one(
        {"qr_id": qr_id, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "role": 1,
         "student_status": 1, "grado_id": 1, "seccion_id": 1, "school_id": 1}
    )

    # 2. QR not found
    if not student:
        raise HTTPException(status_code=404, detail="Codigo QR no reconocido.")

    # 3. Must be same school
    if student.get("school_id") != school_id:
        raise HTTPException(status_code=403, detail="Estudiante no pertenece a este colegio.")

    # Must be a student
    if student.get("role") not in ("student", "estudiante"):
        raise HTTPException(status_code=400, detail="Este QR no corresponde a un estudiante.")

    # 4. Student must be active
    if student.get("student_status") not in ("active", "enrolled"):
        raise HTTPException(status_code=400, detail="Estudiante no activo. Contacte al administrador.")

    # 5. Turno must exist and be active
    turno = await db.movilidad_turnos.find_one(
        {"id": data.turno_id, "school_id": school_id},
        {"_id": 0}
    )
    if not turno:
        raise HTTPException(status_code=400, detail="Turno no encontrado.")
    if not turno.get("activo", False):
        raise HTTPException(status_code=400, detail="Este turno no esta habilitado.")

    # Resolve grado/seccion names for metadata snapshot
    grado_nombre = ""
    seccion_nombre = ""
    if student.get("grado_id"):
        grado = await db.grades.find_one({"id": student["grado_id"]}, {"_id": 0, "nombre": 1})
        grado_nombre = grado.get("nombre", "") if grado else ""
    if student.get("seccion_id"):
        seccion = await db.sections.find_one({"id": student["seccion_id"]}, {"_id": 0, "nombre": 1})
        seccion_nombre = seccion.get("nombre", "") if seccion else ""

    nombre_completo = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
    now = datetime.now(timezone.utc)
    fecha_hoy = now.strftime("%Y-%m-%d")

    registro = {
        "id": generate_id(),
        "school_id": school_id,
        "student_id": student["id"],
        "turno_id": data.turno_id,
        "auxiliar_id": user["id"],
        "fecha": fecha_hoy,
        "hora_registro": now.isoformat(),
        "estado": "registrado",
        "metadata": {
            "nombre_estudiante": nombre_completo,
            "grado": grado_nombre,
            "seccion": seccion_nombre,
        },
        "created_at": now.isoformat(),
    }

    # 6. Insert — DuplicateKeyError = anti-duplicate
    try:
        await db.movilidad_registros.insert_one(registro)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail=f"{nombre_completo} ya fue registrado en este turno."
        )

    # Count total for this turno+date
    total_turno = await db.movilidad_registros.count_documents(
        {"school_id": school_id, "turno_id": data.turno_id, "fecha": fecha_hoy, "estado": "registrado"}
    )

    return {
        "success": True,
        "estudiante": {
            "nombre": nombre_completo,
            "grado": grado_nombre,
            "seccion": seccion_nombre,
        },
        "hora_registro": now.isoformat(),
        "total_turno": total_turno,
    }


@router.get("/registro/turno/{turno_id}")
async def list_registros_turno(turno_id: str, fecha: Optional[str] = None, user=Depends(require_role(MOVILIDAD_SCAN_ROLES))):
    """List records for a turno on a given date (default: today)."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    if not fecha:
        fecha = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    cursor = db.movilidad_registros.find(
        {"school_id": school_id, "turno_id": turno_id, "fecha": fecha},
        {"_id": 0}
    ).sort("hora_registro", -1).limit(50)

    registros = await cursor.to_list(length=50)
    return registros


@router.get("/registro/dashboard")
async def get_dashboard(user=Depends(require_role(MOVILIDAD_SCAN_ROLES))):
    """Dashboard data for the auxiliar: counts per turno, last records, alerts."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    fecha_hoy = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Active turnos
    turnos = await db.movilidad_turnos.find(
        {"school_id": school_id, "activo": True},
        {"_id": 0}
    ).sort("orden", 1).to_list(length=20)

    # Count per turno
    conteo_por_turno = []
    for t in turnos:
        total = await db.movilidad_registros.count_documents(
            {"school_id": school_id, "turno_id": t["id"], "fecha": fecha_hoy, "estado": "registrado"}
        )
        conteo_por_turno.append({
            "turno_id": t["id"],
            "turno_nombre": t["nombre"],
            "hora_inicio": t["hora_inicio"],
            "hora_fin": t["hora_fin"],
            "total": total,
        })

    # Last 10 records today (any turno)
    ultimos = await db.movilidad_registros.find(
        {"school_id": school_id, "fecha": fecha_hoy},
        {"_id": 0}
    ).sort("hora_registro", -1).limit(10).to_list(length=10)

    return {
        "fecha": fecha_hoy,
        "conteo_por_turno": conteo_por_turno,
        "ultimos_registros": ultimos,
        "alertas_recientes": [],
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN READ-ONLY: Registros del día
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/registros-dia")
async def get_registros_dia(
    fecha: Optional[str] = None,
    turno_id: Optional[str] = None,
    nivel_id: Optional[str] = None,
    grado_id: Optional[str] = None,
    seccion_id: Optional[str] = None,
    user=Depends(require_role(ADMIN_ROLES))
):
    """Admin view: list all PAE records for a date, with academic filters."""
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    if not fecha:
        fecha = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # If academic filters, get matching student_ids first
    student_ids = None
    if nivel_id or grado_id or seccion_id:
        student_query = {"school_id": school_id, "role": "student", "is_disabled": {"$ne": True}}
        if nivel_id:
            student_query["nivel_id"] = nivel_id
        if grado_id:
            student_query["grado_id"] = grado_id
        if seccion_id:
            student_query["seccion_id"] = seccion_id
        matching = await db.users.find(student_query, {"_id": 0, "id": 1}).to_list(length=5000)
        student_ids = [s["id"] for s in matching]

    query = {"school_id": school_id, "fecha": fecha, "estado": "registrado"}
    if turno_id:
        query["turno_id"] = turno_id
    if student_ids is not None:
        query["student_id"] = {"$in": student_ids}

    registros = await db.movilidad_registros.find(query, {"_id": 0}).sort("hora_registro", -1).to_list(length=500)

    # Get turno names map
    turnos = await db.movilidad_turnos.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(length=20)
    turno_map = {t["id"]: t["nombre"] for t in turnos}

    # Enrich with turno name
    for r in registros:
        r["turno_nombre"] = turno_map.get(r.get("turno_id"), "")

    # Summary counts
    counts = {}
    for r in registros:
        tid = r.get("turno_id", "")
        counts[tid] = counts.get(tid, 0) + 1

    summary = [{"turno_id": tid, "turno_nombre": turno_map.get(tid, ""), "total": c} for tid, c in counts.items()]

    return {
        "fecha": fecha,
        "total": len(registros),
        "resumen_por_turno": summary,
        "registros": registros,
    }
