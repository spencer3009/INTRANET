from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, timezone
import uuid
import logging

from routes.core import db, get_current_user, resolve_user_from_token, is_admin_user

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# ─── Models ───────────────────────────────────────────────────────────────────

class TopicoRecordCreate(BaseModel):
    student_id: str
    student_name: str
    grade_id: str
    grade_name: str
    section_id: str
    section_name: str
    date: str
    time: str
    incident_type: Literal["dolor", "golpe", "fiebre", "malestar_general", "emergencia", "otro"]
    weight: float  # in kilograms
    height: float  # in centimeters
    description: str
    action_taken: str
    status: Literal["atendido", "derivado", "en_observacion"]
    responsible: str

class TopicoRecordUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    incident_type: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    description: Optional[str] = None
    action_taken: Optional[str] = None
    status: Optional[str] = None
    responsible: Optional[str] = None

class PsicologiaRecordCreate(BaseModel):
    student_id: str
    student_name: str
    grade_id: str
    grade_name: str
    section_id: str
    section_name: str
    date: str
    time: str
    record_type: Literal["conductual", "emocional", "academico_relacionado", "otro"]
    reason: str
    professional_observation: str
    alert_level: Literal["bajo", "medio", "alto"]
    requires_followup: bool = False
    status: Literal["en_seguimiento", "caso_cerrado", "derivado_externamente"]
    responsible: str

class PsicologiaRecordUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    record_type: Optional[str] = None
    reason: Optional[str] = None
    professional_observation: Optional[str] = None
    alert_level: Optional[str] = None
    requires_followup: Optional[bool] = None
    status: Optional[str] = None
    responsible: Optional[str] = None

# ─── Permission Helpers ───────────────────────────────────────────────────────

async def _get_health_permissions(school_id: str) -> dict:
    """Get health wellness permissions from school settings."""
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "health_wellness_permissions": 1})
    raw = (school or {}).get("health_wellness_permissions") or {}
    return {
        "admin_can_manage": raw.get("admin_can_manage", True),
        "teacher_can_manage": raw.get("teacher_can_manage", False),
    }


async def _require_health_access(current_user, write=False):
    """
    Check health module access based on dynamic permissions.
    - owner: always full access (read + write)
    - admin/director: always READ. Write only if admin_can_manage is True
    - teacher: always READ. Write only if teacher_can_manage is True
    - parent: handled separately via _require_parent
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    role = user.get("role", "")
    is_owner = user.get("is_owner") or role == "owner"

    if is_owner:
        return user

    # Auxiliar de Tópico: always full access (read + write) — dedicated health role
    if role == "auxiliar_topico":
        return user

    if role in ["admin", "director"]:
        if not write:
            return user
        perms = await _get_health_permissions(user["school_id"])
        if perms.get("admin_can_manage", True):
            return user
        raise HTTPException(status_code=403, detail="No tienes permisos para crear registros. Contacta al propietario.")

    if role == "teacher":
        if not write:
            return user
        perms = await _get_health_permissions(user["school_id"])
        if perms.get("teacher_can_manage", False):
            return user
        raise HTTPException(status_code=403, detail="No tienes permisos para crear registros. Contacta al propietario.")

    raise HTTPException(status_code=403, detail="Acceso restringido")


async def _require_parent(current_user):
    """Resolve user and ensure parent role."""
    user = await resolve_user_from_token(current_user)
    if not user or user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para padres/apoderados")
    return user


async def _verify_parent_child(parent_user, student_id):
    """Check parent has access to student."""
    student = await db.users.find_one({
        "id": student_id,
        "role": "student",
        "school_id": parent_user.get("school_id"),
        "is_active": {"$ne": False}
    }, {"_id": 0, "id": 1, "name": 1, "last_name": 1})

    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    parent_id = parent_user.get("id")
    # Check all linkage methods
    parent_student_ids = parent_user.get("student_ids") or parent_user.get("children_ids") or []

    linked = await db.users.find_one({
        "id": student_id,
        "$or": [
            {"padre_id": parent_id},
            {"parent_id": parent_id},
        ]
    }, {"_id": 0, "id": 1})

    if not linked and student_id not in parent_student_ids and parent_id not in parent_student_ids:
        raise HTTPException(status_code=403, detail="No tienes acceso a este estudiante")

    return student


# ═══════════════════════════════════════════════════════════════════════════════
# TÓPICO ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/health/topico")
async def list_topico_records(
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    student_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user=Depends(get_current_user),
):
    user = await _require_health_access(current_user)
    query = {"institution_id": user["school_id"]}

    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        query["date"] = date_filter

    total = await db.topico_records.count_documents(query)
    skip = (page - 1) * limit
    records = await db.topico_records.find(query, {"_id": 0}).sort([("date", -1), ("time", -1)]).skip(skip).limit(limit).to_list(limit)

    return {"records": records, "total": total, "page": page, "limit": limit}


@router.post("/health/topico")
async def create_topico_record(data: TopicoRecordCreate, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user, write=True)
    now = datetime.now(timezone.utc)

    record = {
        "id": str(uuid.uuid4()),
        "institution_id": user["school_id"],
        "student_id": data.student_id,
        "student_name": data.student_name,
        "grade_id": data.grade_id,
        "grade_name": data.grade_name,
        "section_id": data.section_id,
        "section_name": data.section_name,
        "date": data.date,
        "time": data.time,
        "incident_type": data.incident_type,
        "weight": data.weight,
        "height": data.height,
        "description": data.description,
        "action_taken": data.action_taken,
        "status": data.status,
        "responsible": data.responsible,
        "parent_notified": False,
        "created_by": user.get("id", user.get("user_id", "")),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    await db.topico_records.insert_one(record)
    record.pop("_id", None)
    return {"message": "Registro creado", "record": record}


@router.get("/health/topico/{record_id}")
async def get_topico_record(record_id: str, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user)
    record = await db.topico_records.find_one(
        {"id": record_id, "institution_id": user["school_id"]}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return record


@router.put("/health/topico/{record_id}")
async def update_topico_record(record_id: str, data: TopicoRecordUpdate, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user, write=True)
    update_fields = {k: v for k, v in data.dict().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.topico_records.update_one(
        {"id": record_id, "institution_id": user["school_id"]},
        {"$set": update_fields},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    updated = await db.topico_records.find_one({"id": record_id}, {"_id": 0})
    return {"message": "Registro actualizado", "record": updated}


@router.delete("/health/topico/{record_id}")
async def delete_topico_record(record_id: str, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user, write=True)
    result = await db.topico_records.delete_one(
        {"id": record_id, "institution_id": user["school_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"message": "Registro eliminado"}


@router.get("/health/topico/student/{student_id}")
async def get_student_topico_history(student_id: str, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user)
    records = await db.topico_records.find(
        {"student_id": student_id, "institution_id": user["school_id"]}, {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).to_list(200)
    return {"records": records, "total": len(records)}


# ═══════════════════════════════════════════════════════════════════════════════
# PSICOLOGÍA ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/health/psicologia")
async def list_psicologia_records(
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    student_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    alert_level: Optional[str] = None,
    requires_followup: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user=Depends(get_current_user),
):
    user = await _require_health_access(current_user)
    query = {"institution_id": user["school_id"], "is_deleted": {"$ne": True}}

    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
    if alert_level:
        query["alert_level"] = alert_level
    if requires_followup is not None:
        query["requires_followup"] = requires_followup
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        query["date"] = date_filter

    total = await db.psicologia_records.count_documents(query)
    skip = (page - 1) * limit
    records = await db.psicologia_records.find(query, {"_id": 0}).sort([("date", -1), ("time", -1)]).skip(skip).limit(limit).to_list(limit)

    return {"records": records, "total": total, "page": page, "limit": limit}


@router.post("/health/psicologia")
async def create_psicologia_record(data: PsicologiaRecordCreate, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user, write=True)
    now = datetime.now(timezone.utc)
    user_id = user.get("id", user.get("user_id", ""))

    record = {
        "id": str(uuid.uuid4()),
        "institution_id": user["school_id"],
        "student_id": data.student_id,
        "student_name": data.student_name,
        "grade_id": data.grade_id,
        "grade_name": data.grade_name,
        "section_id": data.section_id,
        "section_name": data.section_name,
        "date": data.date,
        "time": data.time,
        "record_type": data.record_type,
        "reason": data.reason,
        "professional_observation": data.professional_observation,
        "alert_level": data.alert_level,
        "requires_followup": data.requires_followup,
        "status": data.status,
        "responsible": data.responsible,
        "parent_notified": False,
        "created_by": user_id,
        "updated_by": user_id,
        "is_deleted": False,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    await db.psicologia_records.insert_one(record)
    record.pop("_id", None)
    return {"message": "Registro creado", "record": record}


@router.get("/health/psicologia/{record_id}")
async def get_psicologia_record(record_id: str, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user)
    record = await db.psicologia_records.find_one(
        {"id": record_id, "institution_id": user["school_id"], "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return record


@router.put("/health/psicologia/{record_id}")
async def update_psicologia_record(record_id: str, data: PsicologiaRecordUpdate, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user, write=True)
    update_fields = {k: v for k, v in data.dict().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_fields["updated_by"] = user.get("id", user.get("user_id", ""))

    result = await db.psicologia_records.update_one(
        {"id": record_id, "institution_id": user["school_id"], "is_deleted": {"$ne": True}},
        {"$set": update_fields},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    updated = await db.psicologia_records.find_one({"id": record_id}, {"_id": 0})
    return {"message": "Registro actualizado", "record": updated}


@router.delete("/health/psicologia/{record_id}")
async def delete_psicologia_record(record_id: str, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user, write=True)
    result = await db.psicologia_records.update_one(
        {"id": record_id, "institution_id": user["school_id"], "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user.get("id", user.get("user_id", ""))}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"message": "Registro eliminado"}


@router.get("/health/psicologia/student/{student_id}")
async def get_student_psicologia_history(student_id: str, current_user=Depends(get_current_user)):
    user = await _require_health_access(current_user)
    records = await db.psicologia_records.find(
        {"student_id": student_id, "institution_id": user["school_id"], "is_deleted": {"$ne": True}}, {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).to_list(200)
    return {"records": records, "total": len(records)}


# ═══════════════════════════════════════════════════════════════════════════════
# PARENT HEALTH ENDPOINTS (read-only + alerts)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/health/parent/alerts")
async def get_parent_health_alerts(
    student_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    """Get unacknowledged health alerts for a parent's child."""
    user = await _require_parent(current_user)
    await _verify_parent_child(user, student_id)
    school_id = user.get("school_id")

    # Get topico records not yet notified
    topico_alerts = await db.topico_records.find(
        {"student_id": student_id, "institution_id": school_id, "parent_notified": {"$ne": True}},
        {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).to_list(50)

    # Get psicologia records not yet notified (exclude soft-deleted)
    psicologia_alerts = await db.psicologia_records.find(
        {"student_id": student_id, "institution_id": school_id, "parent_notified": {"$ne": True}, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).to_list(50)

    # Tag each with its type
    for r in topico_alerts:
        r["alert_type"] = "topico"
    for r in psicologia_alerts:
        r["alert_type"] = "psicologia"

    # Merge and sort by date desc
    all_alerts = topico_alerts + psicologia_alerts
    all_alerts.sort(key=lambda x: (x.get("date", ""), x.get("time", "")), reverse=True)

    return {"alerts": all_alerts, "total": len(all_alerts)}


@router.post("/health/parent/alerts/{record_id}/acknowledge")
async def acknowledge_health_alert(
    record_id: str,
    data: dict,
    current_user=Depends(get_current_user),
):
    """Mark a health record as notified by the parent."""
    user = await _require_parent(current_user)
    alert_type = data.get("type")
    if alert_type not in ("topico", "psicologia"):
        raise HTTPException(status_code=400, detail="Tipo debe ser 'topico' o 'psicologia'")

    school_id = user.get("school_id")
    collection = db.topico_records if alert_type == "topico" else db.psicologia_records

    query = {"id": record_id, "institution_id": school_id}
    if alert_type == "psicologia":
        query["is_deleted"] = {"$ne": True}

    result = await collection.update_one(query, {"$set": {"parent_notified": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    return {"message": "Alerta marcada como notificada"}


@router.get("/health/parent/topico")
async def get_parent_topico_history(
    student_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    """Get topico history for a parent's child (read-only)."""
    user = await _require_parent(current_user)
    await _verify_parent_child(user, student_id)

    records = await db.topico_records.find(
        {"student_id": student_id, "institution_id": user["school_id"]},
        {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).to_list(200)

    return {"records": records, "total": len(records)}


@router.get("/health/parent/psicologia")
async def get_parent_psicologia_history(
    student_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    """Get psicologia history for a parent's child (read-only, excludes soft-deleted)."""
    user = await _require_parent(current_user)
    await _verify_parent_child(user, student_id)

    records = await db.psicologia_records.find(
        {"student_id": student_id, "institution_id": user["school_id"], "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).to_list(200)

    return {"records": records, "total": len(records)}


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH PERMISSIONS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/settings/health-permissions")
async def get_health_permissions(current_user=Depends(get_current_user)):
    """Get health wellness permissions. Any authenticated user with a school can read."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    perms = await _get_health_permissions(user["school_id"])
    return perms


@router.put("/settings/health-permissions")
async def update_health_permissions(
    data: dict,
    current_user=Depends(get_current_user),
):
    """Update health wellness permissions. Only owner."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    role = user.get("role", "")
    if not (user.get("is_owner") or role == "owner"):
        raise HTTPException(status_code=403, detail="Solo el propietario puede modificar esta configuración")

    perms = {}
    if "admin_can_manage" in data:
        perms["health_wellness_permissions.admin_can_manage"] = bool(data["admin_can_manage"])
    if "teacher_can_manage" in data:
        perms["health_wellness_permissions.teacher_can_manage"] = bool(data["teacher_can_manage"])

    if perms:
        perms["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.schools.update_one(
            {"id": user["school_id"]},
            {"$set": perms}
        )

    updated = await _get_health_permissions(user["school_id"])
    return {"message": "Permisos actualizados", "permissions": updated}
