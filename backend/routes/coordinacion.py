"""
Coordinacion module: incidencias, seguimientos, derivaciones, reuniones
Routes prefixed with /api/coordinacion
"""
import uuid
import logging
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from .core import db, get_current_user, resolve_user_from_token, require_role, JWT_SECRET

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coordinacion", tags=["coordinacion"])

# ══════════════════════════════════════════════════════════════════════════════
# ROLE CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

COORD_VIEW_ROLES = ["owner", "admin", "director", "coordinator", "psicologo"]
COORD_WRITE_ROLES = ["coordinator", "admin", "owner"]
COORD_DELETE_ROLES = ["admin", "owner"]

# ══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ══════════════════════════════════════════════════════════════════════════════

INCIDENCIA_TYPES = [
    "conducta_disruptiva", "falta_respeto", "agresion_verbal",
    "agresion_fisica", "incumplimiento_normas", "conflicto_companeros",
    "ausencias_reiteradas", "incumplimiento_academico", "observacion_preventiva"
]
INCIDENCIA_SEVERITIES = ["baja", "media", "alta", "critica"]
INCIDENCIA_STATUSES = [
    "nueva", "en_revision", "en_seguimiento", "citacion_programada",
    "derivada", "resuelta", "cerrada"
]
PARENT_INVOLVEMENT_OPTIONS = ["ninguna", "informada", "presente", "comprometida"]

DERIVACION_AREAS = ["psicologia", "direccion", "tutoria", "orientacion_familiar", "externa"]
DERIVACION_STATUSES = ["pendiente", "en_proceso", "resuelta", "cancelada"]
DERIVACION_PRIORITIES = ["baja", "media", "alta", "urgente"]

DERIVACION_AREA_LABELS = {
    "psicologia": "Psicologia",
    "direccion": "Direccion",
    "tutoria": "Tutoria",
    "orientacion_familiar": "Orientacion familiar",
    "externa": "Derivacion externa"
}

# Map area to role for auto-assignment
AREA_TO_ROLE = {
    "psicologia": "psicologo",
    "direccion": "director",
    "tutoria": "teacher",
}

INCIDENCIA_TYPE_LABELS = {
    "conducta_disruptiva": "Conducta disruptiva",
    "falta_respeto": "Falta de respeto",
    "agresion_verbal": "Agresion verbal",
    "agresion_fisica": "Agresion fisica",
    "incumplimiento_normas": "Incumplimiento de normas",
    "conflicto_companeros": "Conflicto entre companeros",
    "ausencias_reiteradas": "Ausencias reiteradas",
    "incumplimiento_academico": "Incumplimiento academico",
    "observacion_preventiva": "Observacion preventiva"
}

SEVERITY_LABELS = {
    "baja": "Baja", "media": "Media", "alta": "Alta", "critica": "Critica"
}

STATUS_LABELS = {
    "nueva": "Nueva", "en_revision": "En revision", "en_seguimiento": "En seguimiento",
    "citacion_programada": "Citacion programada", "derivada": "Derivada",
    "resuelta": "Resuelta", "cerrada": "Cerrada"
}

# ══════════════════════════════════════════════════════════════════════════════
# AUDIT LOG (parametrized from psychology pattern)
# ══════════════════════════════════════════════════════════════════════════════

async def log_coordinacion_audit(user_id, action, resource_type, resource_id, student_id, school_id):
    try:
        await db.coordinacion_audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "student_id": student_id,
            "school_id": school_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Coordinacion audit log error: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# INDEXES (called from server.py startup)
# ══════════════════════════════════════════════════════════════════════════════

async def ensure_coordinacion_indexes():
    try:
        await db.coordinacion_incidencias.create_index([("school_id", 1), ("status", 1), ("severity", -1)])
        await db.coordinacion_incidencias.create_index([("school_id", 1), ("student_id", 1), ("occurred_at", -1)])
        await db.coordinacion_incidencias.create_index([("school_id", 1), ("grade_id", 1), ("section_id", 1)])
        await db.coordinacion_incidencias.create_index([("school_id", 1), ("assigned_to", 1), ("status", 1)])
        await db.coordinacion_incidencias.create_index([("school_id", 1), ("deleted_at", 1)])
        await db.coordinacion_seguimientos.create_index([("school_id", 1), ("incidencia_id", 1), ("entry_date", -1)])
        await db.coordinacion_seguimientos.create_index([("school_id", 1), ("student_id", 1), ("entry_date", -1)])
        await db.coordinacion_derivaciones.create_index([("school_id", 1), ("incidencia_id", 1)])
        await db.coordinacion_derivaciones.create_index([("school_id", 1), ("status", 1), ("to_area", 1)])
        await db.coordinacion_derivaciones.create_index([("school_id", 1), ("to_user_id", 1), ("status", 1)])
        await db.coordinacion_charlas.create_index([("school_id", 1), ("scheduled_at", -1)])
        await db.coordinacion_charlas.create_index([("school_id", 1), ("status", 1)])
        await db.coordinacion_reuniones.create_index([("school_id", 1), ("student_id", 1), ("scheduled_at", -1)])
        await db.coordinacion_reuniones.create_index([("school_id", 1), ("status", 1)])
        logger.info("Coordinacion indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating coordinacion indexes: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════

class IncidenciaCreate(BaseModel):
    student_id: str
    grade_id: str
    section_id: str
    type: str
    severity: str
    title: str = Field(max_length=140)
    description: str = Field(max_length=4000)
    occurred_at: str
    assigned_to: Optional[str] = None
    initial_action: Optional[str] = None
    confidential: bool = False
    notify_parents: bool = False
    tags: List[str] = []

class IncidenciaUpdate(BaseModel):
    type: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    initial_action: Optional[str] = None
    confidential: Optional[bool] = None
    notify_parents: Optional[bool] = None
    tags: Optional[List[str]] = None

class SeguimientoCreate(BaseModel):
    observation: str = Field(max_length=4000)
    commitment: Optional[str] = None
    student_response: Optional[str] = None
    parent_involvement: str = "ninguna"
    next_steps: Optional[str] = None
    next_review_at: Optional[str] = None
    new_status: str

class DerivacionCreate(BaseModel):
    incidencia_id: str
    to_area: str
    priority: str = "media"
    reason: str = Field(max_length=4000)
    notes: Optional[str] = None
    to_user_id: Optional[str] = None

class DerivacionUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    resolution_notes: Optional[str] = None
    to_user_id: Optional[str] = None

REUNION_STATUSES = ["programada", "confirmada", "realizada", "cancelada", "no_asistio"]

class ReunionCreate(BaseModel):
    student_id: str
    incidencia_id: Optional[str] = None
    scheduled_at: str
    location: str = "Oficina de Coordinacion"
    agenda: str = Field(max_length=4000)
    parent_ids: List[str] = []
    notes: Optional[str] = None

class ReunionUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_at: Optional[str] = None
    location: Optional[str] = None
    agenda: Optional[str] = None
    notes: Optional[str] = None
    outcome: Optional[str] = None
    commitments: Optional[str] = None

# ══════════════════════════════════════════════════════════════════════════════
# ENUMS ENDPOINT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/enums")
async def get_enums(current_user=Depends(require_role(COORD_VIEW_ROLES))):
    return {
        "types": [{"id": k, "label": v} for k, v in INCIDENCIA_TYPE_LABELS.items()],
        "severities": [{"id": k, "label": v} for k, v in SEVERITY_LABELS.items()],
        "statuses": [{"id": k, "label": v} for k, v in STATUS_LABELS.items()],
        "parent_involvement": PARENT_INVOLVEMENT_OPTIONS,
        "derivacion_areas": [{"id": k, "label": v} for k, v in DERIVACION_AREA_LABELS.items()],
        "derivacion_statuses": DERIVACION_STATUSES,
        "derivacion_priorities": DERIVACION_PRIORITIES,
    }

# ══════════════════════════════════════════════════════════════════════════════
# GRADES, SECTIONS, STUDENTS (for incidencia form)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/grades")
async def get_coordinacion_grades(user=Depends(require_role(COORD_VIEW_ROLES))):
    """Get grades for the coordinator's school"""
    school_id = user["school_id"]
    grades = await db.grades.find(
        {"school_id": school_id, "activo": True},
        {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1, "orden": 1}
    ).sort("orden", 1).to_list(100)
    return grades

@router.get("/sections")
async def get_coordinacion_sections(
    grade_id: str,
    user=Depends(require_role(COORD_VIEW_ROLES))
):
    """Get sections for a specific grade"""
    school_id = user["school_id"]
    sections = await db.sections.find(
        {"school_id": school_id, "grado_id": grade_id, "activo": True},
        {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1}
    ).sort("nombre", 1).to_list(50)
    return sections

@router.get("/students")
async def get_coordinacion_students(
    section_id: str,
    user=Depends(require_role(COORD_VIEW_ROLES))
):
    """Get students for a specific section"""
    school_id = user["school_id"]
    students = await db.users.find(
        {
            "school_id": school_id,
            "seccion_id": section_id,
            "role": "student",
            "student_status": {"$in": ["enrolled", "active"]}
        },
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}
    ).sort([("last_name", 1), ("name", 1)]).to_list(100)
    return students

# ══════════════════════════════════════════════════════════════════════════════
# INCIDENCIAS CRUD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/incidencias")
async def list_incidencias(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    student_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user=Depends(require_role(COORD_VIEW_ROLES))
):
    school_id = user["school_id"]
    query = {"school_id": school_id, "deleted_at": None}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    if student_id:
        query["student_id"] = student_id
    if assigned_to:
        query["assigned_to"] = assigned_to
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}}
        ]

    total = await db.coordinacion_incidencias.count_documents(query)
    skip = (page - 1) * page_size
    items = await db.coordinacion_incidencias.find(
        query, {"_id": 0}
    ).sort("occurred_at", -1).skip(skip).limit(page_size).to_list(page_size)

    # Enrich with student names
    student_ids = list({i["student_id"] for i in items if i.get("student_id")})
    if student_ids:
        students = await db.users.find(
            {"id": {"$in": student_ids}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}
        ).to_list(500)
        student_map = {s["id"]: s for s in students}
        for item in items:
            s = student_map.get(item.get("student_id"), {})
            item["student_name"] = f"{s.get('name', '')} {s.get('last_name', '')}".strip()
            item["student_photo"] = s.get("photo_url")

    # Enrich with assigned_to names
    assigned_ids = list({i["assigned_to"] for i in items if i.get("assigned_to")})
    if assigned_ids:
        assignees = await db.users.find(
            {"id": {"$in": assigned_ids}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1}
        ).to_list(50)
        assignee_map = {u["id"]: f"{u.get('name', '')} {u.get('last_name', '')}".strip() for u in assignees}
        for item in items:
            if item.get("assigned_to"):
                item["assigned_to_name"] = assignee_map.get(item["assigned_to"], "")

    return {"items": items, "page": page, "page_size": page_size, "total": total}


@router.get("/incidencias/{incidencia_id}")
async def get_incidencia(incidencia_id: str, user=Depends(require_role(COORD_VIEW_ROLES))):
    school_id = user["school_id"]
    inc = await db.coordinacion_incidencias.find_one(
        {"id": incidencia_id, "school_id": school_id, "deleted_at": None}, {"_id": 0}
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    # Enrich student info
    student = await db.users.find_one(
        {"id": inc["student_id"]},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1}
    )
    if student:
        inc["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
        inc["student_photo"] = student.get("photo_url")

    # Enrich grade/section names
    if inc.get("grade_id"):
        grade = await db.grades.find_one({"id": inc["grade_id"]}, {"_id": 0, "nombre": 1})
        inc["grade_name"] = grade.get("nombre", "") if grade else ""
    if inc.get("section_id"):
        section = await db.sections.find_one({"id": inc["section_id"]}, {"_id": 0, "nombre": 1})
        inc["section_name"] = section.get("nombre", "") if section else ""

    # Get seguimientos count
    seg_count = await db.coordinacion_seguimientos.count_documents(
        {"incidencia_id": incidencia_id, "school_id": school_id, "deleted_at": None}
    )
    inc["seguimientos_count"] = seg_count

    await log_coordinacion_audit(user["id"], "view", "incidencia", incidencia_id, inc["student_id"], school_id)
    return inc


@router.post("/incidencias")
async def create_incidencia(data: IncidenciaCreate, user=Depends(require_role(COORD_WRITE_ROLES))):
    school_id = user["school_id"]

    if data.type not in INCIDENCIA_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo invalido: {data.type}")
    if data.severity not in INCIDENCIA_SEVERITIES:
        raise HTTPException(status_code=400, detail=f"Severidad invalida: {data.severity}")

    # Verify student belongs to school
    student = await db.users.find_one(
        {"id": data.student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    now = datetime.now(timezone.utc).isoformat()
    inc_id = str(uuid.uuid4())

    incidencia = {
        "id": inc_id,
        "school_id": school_id,
        "student_id": data.student_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "type": data.type,
        "severity": data.severity,
        "status": "nueva",
        "title": data.title,
        "description": data.description,
        "occurred_at": data.occurred_at,
        "reported_by": user["id"],
        "assigned_to": data.assigned_to or user["id"],
        "evidence": [],
        "initial_action": data.initial_action,
        "confidential": data.confidential,
        "notify_parents": data.notify_parents,
        "tags": data.tags,
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "updated_by": user["id"],
        "deleted_at": None,
    }

    await db.coordinacion_incidencias.insert_one(incidencia)
    del incidencia["_id"]

    await log_coordinacion_audit(user["id"], "create", "incidencia", inc_id, data.student_id, school_id)
    logger.info(f"Incidencia created: {inc_id} by {user['id']} school={school_id}")

    return incidencia


@router.patch("/incidencias/{incidencia_id}")
async def update_incidencia(incidencia_id: str, data: IncidenciaUpdate, user=Depends(require_role(COORD_WRITE_ROLES))):
    school_id = user["school_id"]
    inc = await db.coordinacion_incidencias.find_one(
        {"id": incidencia_id, "school_id": school_id, "deleted_at": None}, {"_id": 0, "id": 1, "student_id": 1}
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    update = {}
    if data.type is not None:
        if data.type not in INCIDENCIA_TYPES:
            raise HTTPException(status_code=400, detail=f"Tipo invalido: {data.type}")
        update["type"] = data.type
    if data.severity is not None:
        if data.severity not in INCIDENCIA_SEVERITIES:
            raise HTTPException(status_code=400, detail=f"Severidad invalida: {data.severity}")
        update["severity"] = data.severity
    if data.status is not None:
        if data.status not in INCIDENCIA_STATUSES:
            raise HTTPException(status_code=400, detail=f"Estado invalido: {data.status}")
        update["status"] = data.status
    if data.title is not None:
        update["title"] = data.title
    if data.description is not None:
        update["description"] = data.description
    if data.assigned_to is not None:
        update["assigned_to"] = data.assigned_to
    if data.initial_action is not None:
        update["initial_action"] = data.initial_action
    if data.confidential is not None:
        update["confidential"] = data.confidential
    if data.notify_parents is not None:
        update["notify_parents"] = data.notify_parents
    if data.tags is not None:
        update["tags"] = data.tags

    if not update:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    update["updated_by"] = user["id"]

    await db.coordinacion_incidencias.update_one({"id": incidencia_id}, {"$set": update})
    await log_coordinacion_audit(user["id"], "update", "incidencia", incidencia_id, inc["student_id"], school_id)

    updated = await db.coordinacion_incidencias.find_one({"id": incidencia_id}, {"_id": 0})
    return updated


@router.delete("/incidencias/{incidencia_id}")
async def delete_incidencia(incidencia_id: str, user=Depends(require_role(COORD_DELETE_ROLES))):
    school_id = user["school_id"]
    inc = await db.coordinacion_incidencias.find_one(
        {"id": incidencia_id, "school_id": school_id, "deleted_at": None},
        {"_id": 0, "id": 1, "student_id": 1}
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    now = datetime.now(timezone.utc).isoformat()

    # Soft-delete cascade: incidencia + seguimientos + derivaciones
    await db.coordinacion_incidencias.update_one(
        {"id": incidencia_id}, {"$set": {"deleted_at": now, "updated_by": user["id"]}}
    )
    await db.coordinacion_seguimientos.update_many(
        {"incidencia_id": incidencia_id, "school_id": school_id},
        {"$set": {"deleted_at": now}}
    )
    await db.coordinacion_derivaciones.update_many(
        {"incidencia_id": incidencia_id, "school_id": school_id},
        {"$set": {"deleted_at": now}}
    )

    await log_coordinacion_audit(user["id"], "delete", "incidencia", incidencia_id, inc["student_id"], school_id)
    logger.info(f"Incidencia soft-deleted: {incidencia_id} by {user['id']}")

    return {"message": "Incidencia eliminada correctamente"}


# ══════════════════════════════════════════════════════════════════════════════
# SEGUIMIENTOS CRUD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/incidencias/{incidencia_id}/seguimientos")
async def list_seguimientos(incidencia_id: str, user=Depends(require_role(COORD_VIEW_ROLES))):
    school_id = user["school_id"]

    # Verify incidencia exists and belongs to school
    inc = await db.coordinacion_incidencias.find_one(
        {"id": incidencia_id, "school_id": school_id, "deleted_at": None},
        {"_id": 0, "id": 1}
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    items = await db.coordinacion_seguimientos.find(
        {"incidencia_id": incidencia_id, "school_id": school_id, "deleted_at": None},
        {"_id": 0}
    ).sort("entry_date", -1).to_list(200)

    # Enrich with creator names
    creator_ids = list({s["created_by"] for s in items if s.get("created_by")})
    if creator_ids:
        creators = await db.users.find(
            {"id": {"$in": creator_ids}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1}
        ).to_list(50)
        creator_map = {u["id"]: f"{u.get('name', '')} {u.get('last_name', '')}".strip() for u in creators}
        for item in items:
            item["created_by_name"] = creator_map.get(item.get("created_by"), "")

    return {"items": items, "total": len(items)}


@router.post("/incidencias/{incidencia_id}/seguimientos")
async def create_seguimiento(
    incidencia_id: str,
    data: SeguimientoCreate,
    user=Depends(require_role(["coordinator"]))
):
    school_id = user["school_id"]

    inc = await db.coordinacion_incidencias.find_one(
        {"id": incidencia_id, "school_id": school_id, "deleted_at": None},
        {"_id": 0, "id": 1, "student_id": 1, "status": 1}
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    if data.new_status not in INCIDENCIA_STATUSES:
        raise HTTPException(status_code=400, detail=f"Estado invalido: {data.new_status}")
    if data.parent_involvement not in PARENT_INVOLVEMENT_OPTIONS:
        raise HTTPException(status_code=400, detail=f"Tipo de participacion invalido: {data.parent_involvement}")

    now = datetime.now(timezone.utc).isoformat()
    seg_id = str(uuid.uuid4())

    seguimiento = {
        "id": seg_id,
        "school_id": school_id,
        "incidencia_id": incidencia_id,
        "student_id": inc["student_id"],
        "entry_date": now,
        "observation": data.observation,
        "commitment": data.commitment,
        "student_response": data.student_response,
        "parent_involvement": data.parent_involvement,
        "next_steps": data.next_steps,
        "next_review_at": data.next_review_at,
        "new_status": data.new_status,
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "deleted_at": None,
    }

    await db.coordinacion_seguimientos.insert_one(seguimiento)
    del seguimiento["_id"]

    # Atomically update incidencia status
    await db.coordinacion_incidencias.update_one(
        {"id": incidencia_id},
        {"$set": {"status": data.new_status, "updated_at": now, "updated_by": user["id"]}}
    )

    await log_coordinacion_audit(user["id"], "create", "seguimiento", seg_id, inc["student_id"], school_id)
    logger.info(f"Seguimiento created: {seg_id} for incidencia {incidencia_id}")

    return seguimiento


@router.patch("/seguimientos/{seguimiento_id}")
async def update_seguimiento(seguimiento_id: str, data: SeguimientoCreate, user=Depends(require_role(["coordinator"]))):
    school_id = user["school_id"]
    seg = await db.coordinacion_seguimientos.find_one(
        {"id": seguimiento_id, "school_id": school_id, "deleted_at": None}, {"_id": 0}
    )
    if not seg:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")

    now = datetime.now(timezone.utc).isoformat()
    update = {
        "observation": data.observation,
        "commitment": data.commitment,
        "student_response": data.student_response,
        "parent_involvement": data.parent_involvement,
        "next_steps": data.next_steps,
        "next_review_at": data.next_review_at,
        "new_status": data.new_status,
        "updated_at": now,
    }
    await db.coordinacion_seguimientos.update_one({"id": seguimiento_id}, {"$set": update})

    # Update parent incidencia status
    await db.coordinacion_incidencias.update_one(
        {"id": seg["incidencia_id"]},
        {"$set": {"status": data.new_status, "updated_at": now, "updated_by": user["id"]}}
    )

    return {"message": "Seguimiento actualizado"}


# ══════════════════════════════════════════════════════════════════════════════
# DERIVACIONES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/derivaciones")
async def create_derivacion(data: DerivacionCreate, user=Depends(require_role(COORD_WRITE_ROLES))):
    school_id = user["school_id"]

    # Validate area
    if data.to_area not in DERIVACION_AREAS:
        raise HTTPException(status_code=400, detail=f"Area invalida: {data.to_area}")
    if data.priority not in DERIVACION_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Prioridad invalida: {data.priority}")

    # Validate incidencia exists and belongs to school
    inc = await db.coordinacion_incidencias.find_one(
        {"id": data.incidencia_id, "school_id": school_id, "deleted_at": None},
        {"_id": 0, "id": 1, "student_id": 1, "title": 1}
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    # Try auto-assign if to_user_id not provided
    to_user_id = data.to_user_id
    if not to_user_id and data.to_area in AREA_TO_ROLE:
        target_role = AREA_TO_ROLE[data.to_area]
        candidates = await db.users.find(
            {"school_id": school_id, "role": target_role, "status": {"$ne": "inactive"}},
            {"_id": 0, "id": 1}
        ).to_list(10)
        if len(candidates) == 1:
            to_user_id = candidates[0]["id"]
        # If 0 or multiple candidates, leave unassigned

    now = datetime.now(timezone.utc).isoformat()
    deriv_id = str(uuid.uuid4())

    derivacion = {
        "id": deriv_id,
        "school_id": school_id,
        "incidencia_id": data.incidencia_id,
        "student_id": inc["student_id"],
        "from_user_id": user["id"],
        "to_area": data.to_area,
        "to_user_id": to_user_id,
        "status": "pendiente",
        "priority": data.priority,
        "reason": data.reason,
        "notes": data.notes,
        "resolution_notes": None,
        "status_changed_at": now,
        "seen_by_coordinator": True,
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "deleted_at": None,
    }

    await db.coordinacion_derivaciones.insert_one(derivacion)
    del derivacion["_id"]

    # Update incidencia status to "derivada"
    await db.coordinacion_incidencias.update_one(
        {"id": data.incidencia_id},
        {"$set": {"status": "derivada", "updated_at": now, "updated_by": user["id"]}}
    )

    await log_coordinacion_audit(user["id"], "create", "derivacion", deriv_id, inc["student_id"], school_id)
    logger.info(f"Derivacion created: {deriv_id} to {data.to_area} for incidencia {data.incidencia_id}")

    return derivacion


@router.get("/derivaciones")
async def list_derivaciones(
    status: Optional[str] = None,
    to_area: Optional[str] = None,
    unassigned: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(require_role(COORD_VIEW_ROLES))
):
    school_id = user["school_id"]
    query = {"school_id": school_id, "deleted_at": None}

    if status:
        query["status"] = status
    if to_area:
        query["to_area"] = to_area
    if unassigned:
        query["to_user_id"] = None

    total = await db.coordinacion_derivaciones.count_documents(query)
    items = await db.coordinacion_derivaciones.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)

    # Enrich with names
    student_ids = list(set(i.get("student_id") for i in items if i.get("student_id")))
    user_ids = list(set(
        [i.get("from_user_id") for i in items if i.get("from_user_id")] +
        [i.get("to_user_id") for i in items if i.get("to_user_id")]
    ))
    all_ids = list(set(student_ids + user_ids))

    name_map = {}
    if all_ids:
        users_data = await db.users.find(
            {"id": {"$in": all_ids}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1}
        ).to_list(100)
        name_map = {u["id"]: f"{u.get('name','')} {u.get('last_name','')}".strip() for u in users_data}

    # Enrich with incidencia titles
    inc_ids = list(set(i.get("incidencia_id") for i in items if i.get("incidencia_id")))
    inc_map = {}
    if inc_ids:
        incs = await db.coordinacion_incidencias.find(
            {"id": {"$in": inc_ids}}, {"_id": 0, "id": 1, "title": 1}
        ).to_list(100)
        inc_map = {i["id"]: i.get("title", "") for i in incs}

    for item in items:
        item["student_name"] = name_map.get(item.get("student_id"), "")
        item["from_user_name"] = name_map.get(item.get("from_user_id"), "")
        item["to_user_name"] = name_map.get(item.get("to_user_id"), "Sin asignar")
        item["incidencia_title"] = inc_map.get(item.get("incidencia_id"), "")

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/derivaciones/notifications")
async def get_derivacion_notifications(user=Depends(require_role(COORD_WRITE_ROLES))):
    """Count derivations with status changes not yet seen by coordinator"""
    school_id = user["school_id"]
    count = await db.coordinacion_derivaciones.count_documents({
        "school_id": school_id,
        "deleted_at": None,
        "from_user_id": user["id"],
        "seen_by_coordinator": False,
    })
    return {"unseen_count": count}


@router.get("/derivaciones/{derivacion_id}")
async def get_derivacion(derivacion_id: str, user=Depends(require_role(COORD_VIEW_ROLES))):
    school_id = user["school_id"]
    deriv = await db.coordinacion_derivaciones.find_one(
        {"id": derivacion_id, "school_id": school_id, "deleted_at": None}, {"_id": 0}
    )
    if not deriv:
        raise HTTPException(status_code=404, detail="Derivacion no encontrada")

    # Enrich with names
    ids_to_resolve = [deriv.get("student_id"), deriv.get("from_user_id"), deriv.get("to_user_id")]
    ids_to_resolve = [i for i in ids_to_resolve if i]
    name_map = {}
    if ids_to_resolve:
        users_data = await db.users.find(
            {"id": {"$in": ids_to_resolve}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1}
        ).to_list(10)
        name_map = {u["id"]: f"{u.get('name','')} {u.get('last_name','')}".strip() for u in users_data}

    deriv["student_name"] = name_map.get(deriv.get("student_id"), "")
    deriv["from_user_name"] = name_map.get(deriv.get("from_user_id"), "")
    deriv["to_user_name"] = name_map.get(deriv.get("to_user_id"), "Sin asignar")

    # Get incidencia title
    inc = await db.coordinacion_incidencias.find_one(
        {"id": deriv.get("incidencia_id")}, {"_id": 0, "title": 1}
    )
    deriv["incidencia_title"] = inc.get("title", "") if inc else ""

    # Mark as seen by coordinator
    if deriv.get("from_user_id") == user["id"] and not deriv.get("seen_by_coordinator"):
        await db.coordinacion_derivaciones.update_one(
            {"id": derivacion_id},
            {"$set": {"seen_by_coordinator": True}}
        )

    return deriv


@router.patch("/derivaciones/{derivacion_id}")
async def update_derivacion(derivacion_id: str, data: DerivacionUpdate, user=Depends(require_role(COORD_VIEW_ROLES))):
    """Update derivacion - coordinators, target area users, admin, director can update"""
    school_id = user["school_id"]
    deriv = await db.coordinacion_derivaciones.find_one(
        {"id": derivacion_id, "school_id": school_id, "deleted_at": None},
        {"_id": 0, "id": 1, "student_id": 1, "from_user_id": 1, "status": 1}
    )
    if not deriv:
        raise HTTPException(status_code=404, detail="Derivacion no encontrada")

    now = datetime.now(timezone.utc).isoformat()
    update = {"updated_at": now, "updated_by": user["id"]}

    if data.status:
        if data.status not in DERIVACION_STATUSES:
            raise HTTPException(status_code=400, detail=f"Status invalido: {data.status}")
        update["status"] = data.status
        update["status_changed_at"] = now
        # If someone other than the original coordinator changes status, mark unseen
        if user["id"] != deriv.get("from_user_id"):
            update["seen_by_coordinator"] = False
    if data.notes is not None:
        update["notes"] = data.notes
    if data.resolution_notes is not None:
        update["resolution_notes"] = data.resolution_notes
    if data.to_user_id is not None:
        # Validate user exists in school
        target_user = await db.users.find_one(
            {"id": data.to_user_id, "school_id": school_id}, {"_id": 0, "id": 1}
        )
        if not target_user:
            raise HTTPException(status_code=404, detail="Usuario destino no encontrado")
        update["to_user_id"] = data.to_user_id

    await db.coordinacion_derivaciones.update_one({"id": derivacion_id}, {"$set": update})
    await log_coordinacion_audit(user["id"], "update", "derivacion", derivacion_id, deriv.get("student_id"), school_id)

    # If derivacion resolved/cancelled, optionally update incidencia
    if data.status in ("resuelta", "cancelada"):
        # Check if there are other active derivations for this incidencia
        inc_id = deriv.get("incidencia_id") if "incidencia_id" not in update else None
        if not inc_id:
            d_full = await db.coordinacion_derivaciones.find_one({"id": derivacion_id}, {"_id": 0, "incidencia_id": 1})
            inc_id = d_full.get("incidencia_id") if d_full else None
        if inc_id:
            active_derivs = await db.coordinacion_derivaciones.count_documents({
                "incidencia_id": inc_id, "school_id": school_id,
                "deleted_at": None, "status": {"$in": ["pendiente", "en_proceso"]},
                "id": {"$ne": derivacion_id}
            })
            if active_derivs == 0 and data.status == "resuelta":
                await db.coordinacion_incidencias.update_one(
                    {"id": inc_id, "status": "derivada"},
                    {"$set": {"status": "resuelta", "updated_at": now}}
                )

    return {"message": "Derivacion actualizada"}


@router.get("/staff/{area}")
async def get_staff_by_area(area: str, user=Depends(require_role(COORD_VIEW_ROLES))):
    """Get staff members that can be assigned to a derivation area"""
    school_id = user["school_id"]
    role = AREA_TO_ROLE.get(area)
    if not role:
        return {"staff": []}
    staff = await db.users.find(
        {"school_id": school_id, "role": role, "status": {"$ne": "inactive"}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "role": 1}
    ).to_list(50)
    for s in staff:
        s["full_name"] = f"{s.get('name','')} {s.get('last_name','')}".strip()
    return {"staff": staff}


# ══════════════════════════════════════════════════════════════════════════════
# REUNIONES CON PADRES
# ══════════════════════════════════════════════════════════════════════════════

def generate_reunion_token(reunion_id, parent_id, school_id):
    """Generate a short-lived JWT for parent confirmation (7 days)"""
    payload = {
        "reunion_id": reunion_id,
        "parent_id": parent_id,
        "school_id": school_id,
        "purpose": "reunion_confirm",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@router.post("/reuniones")
async def create_reunion(data: ReunionCreate, user=Depends(require_role(COORD_WRITE_ROLES))):
    school_id = user["school_id"]

    # Validate student exists in school
    student = await db.users.find_one(
        {"id": data.student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    # If no parent_ids provided, find linked parents
    parent_ids = data.parent_ids
    if not parent_ids:
        parents = await db.users.find(
            {"school_id": school_id, "role": "parent", "children": data.student_id},
            {"_id": 0, "id": 1}
        ).to_list(10)
        parent_ids = [p["id"] for p in parents]

    # Validate incidencia if provided
    if data.incidencia_id:
        inc = await db.coordinacion_incidencias.find_one(
            {"id": data.incidencia_id, "school_id": school_id, "deleted_at": None},
            {"_id": 0, "id": 1}
        )
        if not inc:
            raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    now = datetime.now(timezone.utc).isoformat()
    reunion_id = str(uuid.uuid4())

    reunion = {
        "id": reunion_id,
        "school_id": school_id,
        "student_id": data.student_id,
        "incidencia_id": data.incidencia_id,
        "scheduled_at": data.scheduled_at,
        "location": data.location,
        "agenda": data.agenda,
        "parent_ids": parent_ids,
        "confirmed_parents": [],
        "status": "programada",
        "notes": data.notes,
        "outcome": None,
        "commitments": None,
        "created_at": now,
        "updated_at": now,
        "created_by": user["id"],
        "deleted_at": None,
    }

    await db.coordinacion_reuniones.insert_one(reunion)
    del reunion["_id"]

    # Generate confirmation tokens for each parent
    confirmation_links = []
    for pid in parent_ids:
        token_str = generate_reunion_token(reunion_id, pid, school_id)
        confirmation_links.append({
            "parent_id": pid,
            "token": token_str,
        })

    # Update incidencia status if linked
    if data.incidencia_id:
        await db.coordinacion_incidencias.update_one(
            {"id": data.incidencia_id},
            {"$set": {"status": "citacion_programada", "updated_at": now}}
        )

    await log_coordinacion_audit(user["id"], "create", "reunion", reunion_id, data.student_id, school_id)
    logger.info(f"Reunion created: {reunion_id} for student {data.student_id}")

    reunion["confirmation_links"] = confirmation_links
    return reunion


@router.post("/reuniones/confirm")
async def confirm_reunion(token_str: str = Query(..., alias="token")):
    """Public endpoint - parent confirms reunion attendance via JWT token"""
    try:
        payload = jwt.decode(token_str, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="El enlace de confirmacion ha expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Enlace de confirmacion invalido")

    if payload.get("purpose") != "reunion_confirm":
        raise HTTPException(status_code=400, detail="Token invalido")

    reunion_id = payload["reunion_id"]
    parent_id = payload["parent_id"]
    school_id = payload["school_id"]

    reunion = await db.coordinacion_reuniones.find_one(
        {"id": reunion_id, "school_id": school_id, "deleted_at": None},
        {"_id": 0, "id": 1, "parent_ids": 1, "confirmed_parents": 1, "status": 1}
    )
    if not reunion:
        raise HTTPException(status_code=404, detail="Reunion no encontrada")

    if parent_id not in reunion.get("parent_ids", []):
        raise HTTPException(status_code=403, detail="No estas invitado a esta reunion")

    confirmed = reunion.get("confirmed_parents", [])
    if parent_id in confirmed:
        return {"message": "Ya confirmaste tu asistencia", "already_confirmed": True}

    confirmed.append(parent_id)
    update = {"confirmed_parents": confirmed, "updated_at": datetime.now(timezone.utc).isoformat()}

    # Auto-update status to confirmed if at least one parent confirms
    if reunion["status"] == "programada":
        update["status"] = "confirmada"

    await db.coordinacion_reuniones.update_one({"id": reunion_id}, {"$set": update})

    return {"message": "Asistencia confirmada correctamente", "already_confirmed": False}


@router.get("/reuniones")
async def list_reuniones(
    status: Optional[str] = None,
    student_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(require_role(COORD_VIEW_ROLES))
):
    school_id = user["school_id"]
    query = {"school_id": school_id, "deleted_at": None}

    if status:
        query["status"] = status
    if student_id:
        query["student_id"] = student_id

    total = await db.coordinacion_reuniones.count_documents(query)
    items = await db.coordinacion_reuniones.find(
        query, {"_id": 0}
    ).sort("scheduled_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)

    # Enrich with names
    all_user_ids = set()
    for item in items:
        if item.get("student_id"):
            all_user_ids.add(item["student_id"])
        for pid in item.get("parent_ids", []):
            all_user_ids.add(pid)
        if item.get("created_by"):
            all_user_ids.add(item["created_by"])

    name_map = {}
    if all_user_ids:
        users_data = await db.users.find(
            {"id": {"$in": list(all_user_ids)}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1}
        ).to_list(100)
        name_map = {u["id"]: f"{u.get('name','')} {u.get('last_name','')}".strip() for u in users_data}

    for item in items:
        item["student_name"] = name_map.get(item.get("student_id"), "")
        item["created_by_name"] = name_map.get(item.get("created_by"), "")
        item["parent_names"] = [name_map.get(pid, "") for pid in item.get("parent_ids", [])]

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/reuniones/{reunion_id}")
async def get_reunion(reunion_id: str, user=Depends(require_role(COORD_VIEW_ROLES))):
    school_id = user["school_id"]
    reunion = await db.coordinacion_reuniones.find_one(
        {"id": reunion_id, "school_id": school_id, "deleted_at": None}, {"_id": 0}
    )
    if not reunion:
        raise HTTPException(status_code=404, detail="Reunion no encontrada")

    # Enrich with names
    all_ids = [reunion.get("student_id"), reunion.get("created_by")] + reunion.get("parent_ids", [])
    all_ids = [i for i in all_ids if i]
    name_map = {}
    if all_ids:
        users_data = await db.users.find(
            {"id": {"$in": all_ids}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1}
        ).to_list(50)
        name_map = {u["id"]: f"{u.get('name','')} {u.get('last_name','')}".strip() for u in users_data}

    reunion["student_name"] = name_map.get(reunion.get("student_id"), "")
    reunion["created_by_name"] = name_map.get(reunion.get("created_by"), "")
    reunion["parent_names"] = [name_map.get(pid, "") for pid in reunion.get("parent_ids", [])]
    reunion["confirmed_parent_names"] = [name_map.get(pid, "") for pid in reunion.get("confirmed_parents", [])]

    # Generate confirmation links for coordinator to share
    confirmation_links = []
    for pid in reunion.get("parent_ids", []):
        if pid not in reunion.get("confirmed_parents", []):
            token_str = generate_reunion_token(reunion_id, pid, school_id)
            confirmation_links.append({
                "parent_id": pid,
                "parent_name": name_map.get(pid, ""),
                "token": token_str,
            })
    reunion["pending_confirmation_links"] = confirmation_links

    return reunion


@router.patch("/reuniones/{reunion_id}")
async def update_reunion(reunion_id: str, data: ReunionUpdate, user=Depends(require_role(COORD_WRITE_ROLES))):
    school_id = user["school_id"]
    reunion = await db.coordinacion_reuniones.find_one(
        {"id": reunion_id, "school_id": school_id, "deleted_at": None},
        {"_id": 0, "id": 1, "student_id": 1}
    )
    if not reunion:
        raise HTTPException(status_code=404, detail="Reunion no encontrada")

    now = datetime.now(timezone.utc).isoformat()
    update = {"updated_at": now, "updated_by": user["id"]}

    if data.status:
        if data.status not in REUNION_STATUSES:
            raise HTTPException(status_code=400, detail=f"Estado invalido: {data.status}")
        update["status"] = data.status
    if data.scheduled_at is not None:
        update["scheduled_at"] = data.scheduled_at
    if data.location is not None:
        update["location"] = data.location
    if data.agenda is not None:
        update["agenda"] = data.agenda
    if data.notes is not None:
        update["notes"] = data.notes
    if data.outcome is not None:
        update["outcome"] = data.outcome
    if data.commitments is not None:
        update["commitments"] = data.commitments

    await db.coordinacion_reuniones.update_one({"id": reunion_id}, {"$set": update})
    await log_coordinacion_audit(user["id"], "update", "reunion", reunion_id, reunion.get("student_id"), school_id)

    return {"message": "Reunion actualizada"}


@router.get("/parents/{student_id}")
async def get_student_parents(student_id: str, user=Depends(require_role(COORD_VIEW_ROLES))):
    """Get parents linked to a student"""
    school_id = user["school_id"]
    parents = await db.users.find(
        {"school_id": school_id, "role": "parent", "children": student_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "email": 1, "phone": 1}
    ).to_list(20)
    for p in parents:
        p["full_name"] = f"{p.get('name','')} {p.get('last_name','')}".strip()
    return {"parents": parents}


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_dashboard(user=Depends(require_role(COORD_VIEW_ROLES))):
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    import asyncio

    async def get_kpis():
        base = {"school_id": school_id, "deleted_at": None}
        active_statuses = ["nueva", "en_revision", "en_seguimiento", "citacion_programada", "derivada"]
        active = await db.coordinacion_incidencias.count_documents({**base, "status": {"$in": active_statuses}})
        new_today = await db.coordinacion_incidencias.count_documents({
            **base, "created_at": {"$regex": f"^{today_str}"}
        })
        students_in_followup = len(await db.coordinacion_incidencias.distinct(
            "student_id", {**base, "status": "en_seguimiento"}
        ))
        reuniones_pending = await db.coordinacion_reuniones.count_documents({
            "school_id": school_id, "deleted_at": None, "status": {"$in": ["programada", "confirmada"]}
        })
        charlas_upcoming = await db.coordinacion_charlas.count_documents({
            "school_id": school_id, "deleted_at": None, "status": "programada"
        })
        derivaciones_pending = await db.coordinacion_derivaciones.count_documents({
            "school_id": school_id, "deleted_at": None, "status": "pendiente"
        })
        return {
            "incidencias_activas": active,
            "incidencias_nuevas_hoy": new_today,
            "estudiantes_en_seguimiento": students_in_followup,
            "reuniones_pendientes": reuniones_pending,
            "charlas_proximas": charlas_upcoming,
            "derivaciones_pendientes": derivaciones_pending,
        }

    async def get_by_severity():
        base = {"school_id": school_id, "deleted_at": None}
        result = {}
        for sev in INCIDENCIA_SEVERITIES:
            result[sev] = await db.coordinacion_incidencias.count_documents({**base, "severity": sev})
        return result

    async def get_by_grade():
        pipeline = [
            {"$match": {"school_id": school_id, "deleted_at": None}},
            {"$group": {"_id": "$grade_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 20}
        ]
        results = await db.coordinacion_incidencias.aggregate(pipeline).to_list(20)
        grade_ids = [r["_id"] for r in results if r["_id"]]
        grade_map = {}
        if grade_ids:
            grades = await db.grades.find({"id": {"$in": grade_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(20)
            grade_map = {g["id"]: g["nombre"] for g in grades}
        return [{"grade_id": r["_id"], "grade_name": grade_map.get(r["_id"], ""), "count": r["count"]} for r in results]

    async def get_reincidentes():
        from datetime import timedelta
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        pipeline = [
            {"$match": {"school_id": school_id, "deleted_at": None, "created_at": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": "$student_id", "count": {"$sum": 1}}},
            {"$match": {"count": {"$gte": 3}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        results = await db.coordinacion_incidencias.aggregate(pipeline).to_list(10)
        student_ids = [r["_id"] for r in results]
        student_map = {}
        if student_ids:
            students = await db.users.find(
                {"id": {"$in": student_ids}},
                {"_id": 0, "id": 1, "name": 1, "last_name": 1, "grado_id": 1}
            ).to_list(10)
            for s in students:
                student_map[s["id"]] = {
                    "full_name": f"{s.get('name', '')} {s.get('last_name', '')}".strip(),
                    "grade": s.get("grado_id", "")
                }
        return [
            {
                "student_id": r["_id"],
                "full_name": student_map.get(r["_id"], {}).get("full_name", ""),
                "grade": student_map.get(r["_id"], {}).get("grade", ""),
                "count": r["count"]
            }
            for r in results
        ]

    async def get_recent_incidencias():
        items = await db.coordinacion_incidencias.find(
            {"school_id": school_id, "deleted_at": None},
            {"_id": 0, "id": 1, "title": 1, "severity": 1, "status": 1, "student_id": 1, "created_at": 1}
        ).sort("created_at", -1).limit(5).to_list(5)
        student_ids = [i["student_id"] for i in items if i.get("student_id")]
        if student_ids:
            students = await db.users.find(
                {"id": {"$in": student_ids}},
                {"_id": 0, "id": 1, "name": 1, "last_name": 1}
            ).to_list(50)
            sm = {s["id"]: f"{s.get('name','')} {s.get('last_name','')}".strip() for s in students}
            for i in items:
                i["student_name"] = sm.get(i.get("student_id"), "")
        return items

    kpis, by_severity, by_grade, reincidentes, recent = await asyncio.gather(
        get_kpis(), get_by_severity(), get_by_grade(), get_reincidentes(), get_recent_incidencias()
    )

    # Build alerts from reincidentes
    alertas = []
    for r in reincidentes:
        alertas.append({
            "type": "reincidencia",
            "student_id": r["student_id"],
            "message": f"{r['full_name']} tiene {r['count']} incidencias en los ultimos 30 dias"
        })

    return {
        "kpis": kpis,
        "by_severity": by_severity,
        "by_grade": by_grade,
        "reincidentes": reincidentes,
        "alertas": alertas,
        "recent_incidencias": recent,
    }
