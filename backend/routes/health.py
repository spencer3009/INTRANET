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
    description: str
    action_taken: str
    status: Literal["atendido", "derivado", "en_observacion"]
    responsible: str

class TopicoRecordUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    incident_type: Optional[str] = None
    description: Optional[str] = None
    action_taken: Optional[str] = None
    status: Optional[str] = None
    responsible: Optional[str] = None

# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _require_admin(current_user):
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
    return user

# ─── Endpoints ────────────────────────────────────────────────────────────────

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
    user = await _require_admin(current_user)
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
    user = await _require_admin(current_user)
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
        "description": data.description,
        "action_taken": data.action_taken,
        "status": data.status,
        "responsible": data.responsible,
        "created_by": user.get("id", user.get("user_id", "")),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    await db.topico_records.insert_one(record)
    record.pop("_id", None)
    return {"message": "Registro creado", "record": record}


@router.get("/health/topico/{record_id}")
async def get_topico_record(record_id: str, current_user=Depends(get_current_user)):
    user = await _require_admin(current_user)
    record = await db.topico_records.find_one(
        {"id": record_id, "institution_id": user["school_id"]}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return record


@router.put("/health/topico/{record_id}")
async def update_topico_record(record_id: str, data: TopicoRecordUpdate, current_user=Depends(get_current_user)):
    user = await _require_admin(current_user)
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
    user = await _require_admin(current_user)
    result = await db.topico_records.delete_one(
        {"id": record_id, "institution_id": user["school_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"message": "Registro eliminado"}


@router.get("/health/topico/student/{student_id}")
async def get_student_topico_history(student_id: str, current_user=Depends(get_current_user)):
    user = await _require_admin(current_user)
    records = await db.topico_records.find(
        {"student_id": student_id, "institution_id": user["school_id"]}, {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).to_list(200)
    return {"records": records, "total": len(records)}
