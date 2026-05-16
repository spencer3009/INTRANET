"""
enrollment.py — Auto-registro de alumnos por padres con flujo de aprobación.
Los padres registran a sus hijos desde el portal. Admin/director aprueban o rechazan.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import string
import random
import logging

from routes.core import (
    db, get_current_user, require_role, hash_password,
    now_iso, resolve_user_from_token
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

ADMIN_ROLES = ["owner", "admin", "director"]


def generate_temp_password(length=8):
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(length))


# ── Models ──────────────────────────────────────────────────────

class SelfRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = None
    dni: str = Field(..., min_length=1, max_length=20)
    birthday: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    # Academic (referential)
    nivel_id: Optional[str] = None
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    turno_id: Optional[str] = None
    # Procedencia Academica
    colegio_anterior: Optional[str] = None
    codigo_modular: Optional[str] = None
    ultimo_grado_cursado: Optional[str] = None
    ano_lectivo_anterior: Optional[str] = None
    # Complementary info
    condiciones_medicas: Optional[str] = None
    alergias: Optional[str] = None
    doctor_nombre: Optional[str] = None
    doctor_telefono: Optional[str] = None
    persona_autorizada: Optional[str] = None
    persona_autorizada_telefono: Optional[str] = None
    notas: Optional[str] = None


class ApproveRequest(BaseModel):
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    nivel_id: Optional[str] = None
    turno_id: Optional[str] = None


class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


# ── Helper: create in-app notification ──────────────────────────

async def create_internal_notification(user_id: str, school_id: str, title: str, body: str, metadata: dict = None):
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "school_id": school_id,
        "title": title,
        "body": body,
        "read": False,
        "read_at": None,
        "metadata": metadata or {},
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(notif)
    notif.pop("_id", None)
    return notif


# ══════════════════════════════════════════════════════════════════
#  1. POST /api/enrollment/self-register — Parent registers child
# ══════════════════════════════════════════════════════════════════

@router.post("/enrollment/self-register")
async def self_register_student(data: SelfRegisterRequest, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Solo los padres pueden registrar alumnos")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="No tienes un colegio asociado")

    # Check school enrollment config
    school = await db.schools.find_one({"school_id": school_id}, {"_id": 0, "settings": 1})
    enrollment_cfg = (school or {}).get("settings", {}).get("parent_self_enrollment", {})
    if not enrollment_cfg.get("enabled", False):
        # Also check tenant_settings as fallback
        ts = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "parent_self_enrollment": 1})
        ts_cfg = (ts or {}).get("parent_self_enrollment", {})
        if not ts_cfg.get("enabled", False):
            raise HTTPException(status_code=403, detail="El auto-registro no está habilitado en este colegio")
        enrollment_cfg = ts_cfg

    parent_id = user["id"]
    dni = data.dni.strip()

    # Check if active student with same DNI already exists
    existing = await db.users.find_one({
        "school_id": school_id,
        "role": "student",
        "dni": dni,
        "enrollment_status": {"$in": ["active", None]},
        "student_status": {"$ne": "deleted"},
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un alumno registrado con ese DNI")

    # Check if there's already a pending enrollment with same DNI from this parent
    pending = await db.users.find_one({
        "school_id": school_id,
        "role": "student",
        "dni": dni,
        "enrollment_status": "pending",
    })
    if pending:
        raise HTTPException(status_code=400, detail="Ya existe una solicitud pendiente para este DNI")

    # Generate username and temp password
    username = dni.lower()
    # Check username collision
    existing_user = await db.users.find_one({"username": username, "school_id": school_id})
    if existing_user:
        username = f"{dni.lower()}_{random.randint(100,999)}"

    # Password = DNI (as per school policy)
    now = datetime.now(timezone.utc).isoformat()

    new_student = {
        "id": str(uuid.uuid4()),
        "username": username,
        "password": hash_password(dni),
        "plain_password": dni,
        "name": data.name.strip(),
        "last_name": (data.last_name or "").strip(),
        "email": None,
        "phone": data.phone,
        "birthday": data.birthday,
        "gender": data.gender,
        "address": data.address,
        "role": "student",
        "photo_url": data.photo_url,
        "school_id": school_id,
        "email_verified": True,
        "is_demo_user": False,
        "dni": dni,
        # Academic (referential from parent)
        "nivel_id": data.nivel_id,
        "grado_id": data.grado_id,
        "seccion_id": data.seccion_id,
        "turno_id": data.turno_id,
        # Link to parent
        "padre_id": parent_id,
        # Enrollment fields
        "enrollment_status": "pending",
        "enrollment_submitted_by_parent_id": parent_id,
        "enrollment_submitted_at": now,
        "enrollment_reviewed_by": None,
        "enrollment_reviewed_at": None,
        "enrollment_rejection_reason": None,
        # Student status
        "student_status": "pending",
        # Procedencia Academica
        "colegio_anterior": data.colegio_anterior,
        "codigo_modular": data.codigo_modular,
        "ultimo_grado_cursado": data.ultimo_grado_cursado,
        "ano_lectivo_anterior": data.ano_lectivo_anterior,
        # Complementary
        "condiciones_medicas": data.condiciones_medicas,
        "alergias": data.alergias,
        "doctor_nombre": data.doctor_nombre,
        "doctor_telefono": data.doctor_telefono,
        "persona_autorizada": data.persona_autorizada,
        "persona_autorizada_telefono": data.persona_autorizada_telefono,
        "notas": data.notas,
        "created_at": now,
        "updated_at": now,
    }

    await db.users.insert_one(new_student)
    new_student.pop("_id", None)

    full_name = f"{data.name} {data.last_name or ''}".strip()

    # Notify all admin/director users of the school
    admins = await db.users.find(
        {"school_id": school_id, "role": {"$in": ADMIN_ROLES}, "student_status": {"$ne": "deleted"}},
        {"_id": 0, "id": 1}
    ).to_list(100)

    for admin in admins:
        await create_internal_notification(
            user_id=admin["id"],
            school_id=school_id,
            title="Nueva solicitud de matrícula",
            body=f"Nuevo alumno pendiente de aprobación: {full_name} (DNI: {dni})",
            metadata={"type": "enrollment_pending", "student_id": new_student["id"]},
        )

    logger.info(f"[ENROLLMENT] Parent {parent_id} submitted enrollment for {full_name} (DNI: {dni}), student_id={new_student['id']}")

    return {
        "message": "Solicitud de matrícula enviada correctamente",
        "student": {
            "id": new_student["id"],
            "name": new_student["name"],
            "last_name": new_student["last_name"],
            "dni": dni,
            "enrollment_status": "pending",
        },
    }


# ══════════════════════════════════════════════════════════════════
#  2. GET /api/students/pending — List pending enrollments
# ══════════════════════════════════════════════════════════════════

@router.get("/enrollment/pending")
async def get_pending_students(current_user=Depends(require_role(["owner", "admin", "director"]))):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="school_id no encontrado")

    pipeline = [
        {"$match": {"school_id": school_id, "role": "student", "enrollment_status": "pending"}},
        {"$sort": {"enrollment_submitted_at": -1}},
        {"$lookup": {
            "from": "users",
            "let": {"pid": "$enrollment_submitted_by_parent_id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$id", "$$pid"]}}},
                {"$project": {"_id": 0, "id": 1, "name": 1, "last_name": 1, "phone": 1, "email": 1}},
            ],
            "as": "parent_info",
        }},
        {"$lookup": {
            "from": "grados",
            "let": {"gid": "$grado_id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$id", "$$gid"]}}},
                {"$project": {"_id": 0, "nombre": 1, "name": 1}},
            ],
            "as": "grado_info",
        }},
        {"$lookup": {
            "from": "secciones",
            "let": {"sid": "$seccion_id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$id", "$$sid"]}}},
                {"$project": {"_id": 0, "nombre": 1, "name": 1}},
            ],
            "as": "seccion_info",
        }},
        {"$lookup": {
            "from": "niveles",
            "let": {"nid": "$nivel_id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$id", "$$nid"]}}},
                {"$project": {"_id": 0, "nombre": 1, "name": 1}},
            ],
            "as": "nivel_info",
        }},
        {"$project": {
            "_id": 0,
            "id": 1,
            "name": 1,
            "last_name": 1,
            "dni": 1,
            "phone": 1,
            "birthday": 1,
            "gender": 1,
            "photo_url": 1,
            "nivel_id": 1,
            "grado_id": 1,
            "seccion_id": 1,
            "turno_id": 1,
            "enrollment_submitted_at": 1,
            "enrollment_submitted_by_parent_id": 1,
            "condiciones_medicas": 1,
            "alergias": 1,
            "notas": 1,
            "parent_info": {"$arrayElemAt": ["$parent_info", 0]},
            "grado_name": {"$let": {
                "vars": {"g": {"$arrayElemAt": ["$grado_info", 0]}},
                "in": {"$ifNull": ["$$g.nombre", {"$ifNull": ["$$g.name", ""]}]},
            }},
            "seccion_name": {"$let": {
                "vars": {"s": {"$arrayElemAt": ["$seccion_info", 0]}},
                "in": {"$ifNull": ["$$s.nombre", {"$ifNull": ["$$s.name", ""]}]},
            }},
            "nivel_name": {"$let": {
                "vars": {"n": {"$arrayElemAt": ["$nivel_info", 0]}},
                "in": {"$ifNull": ["$$n.nombre", {"$ifNull": ["$$n.name", ""]}]},
            }},
        }},
    ]

    results = await db.users.aggregate(pipeline).to_list(500)
    return {"pending": results, "total": len(results)}


# ══════════════════════════════════════════════════════════════════
#  3. POST /api/enrollment/{student_id}/approve
# ══════════════════════════════════════════════════════════════════

@router.post("/enrollment/{student_id}/approve")
async def approve_student(student_id: str, data: ApproveRequest, current_user=Depends(require_role(["owner", "admin", "director"]))):
    school_id = current_user.get("school_id")
    reviewer_id = current_user.get("id") or current_user.get("sub")

    student = await db.users.find_one({"id": student_id, "school_id": school_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    if student.get("enrollment_status") != "pending":
        raise HTTPException(status_code=400, detail="Este alumno no está en estado pendiente")

    # Validar que el alumno tenga nivel asignado (override o ya existente) para
    # prevenir "alumnos huérfanos" sin nivel_id que desaparecen de los listados.
    final_nivel_id = data.nivel_id or student.get("nivel_id")
    if not final_nivel_id:
        raise HTTPException(
            status_code=400,
            detail="No se puede aprobar la matrícula: el alumno no tiene nivel académico asignado. Edita la matrícula y asigna un nivel antes de aprobar.",
        )

    now = datetime.now(timezone.utc).isoformat()

    update_fields = {
        "enrollment_status": "active",
        "student_status": "active",
        "enrollment_reviewed_by": reviewer_id,
        "enrollment_reviewed_at": now,
        "updated_at": now,
    }

    # Override academic fields if provided
    if data.grade_id:
        update_fields["grado_id"] = data.grade_id
    if data.section_id:
        update_fields["seccion_id"] = data.section_id
    if data.nivel_id:
        update_fields["nivel_id"] = data.nivel_id
    if data.turno_id:
        update_fields["turno_id"] = data.turno_id

    await db.users.update_one({"id": student_id}, {"$set": update_fields})

    full_name = f"{student.get('name', '')} {student.get('last_name', '')}".strip()

    # Notify parent
    parent_id = student.get("enrollment_submitted_by_parent_id") or student.get("padre_id")
    if parent_id:
        await create_internal_notification(
            user_id=parent_id,
            school_id=school_id,
            title="Matrícula aprobada",
            body=f"La matrícula de {full_name} ha sido aprobada. Ya puede acceder a todos los servicios del colegio.",
            metadata={"type": "enrollment_approved", "student_id": student_id},
        )

    logger.info(f"[ENROLLMENT] Student {student_id} approved by {reviewer_id}")
    return {"message": f"Matrícula de {full_name} aprobada correctamente"}


# ══════════════════════════════════════════════════════════════════
#  4. POST /api/enrollment/{student_id}/reject
# ══════════════════════════════════════════════════════════════════

@router.post("/enrollment/{student_id}/reject")
async def reject_student(student_id: str, data: RejectRequest, current_user=Depends(require_role(["owner", "admin", "director"]))):
    school_id = current_user.get("school_id")
    reviewer_id = current_user.get("id") or current_user.get("sub")

    student = await db.users.find_one({"id": student_id, "school_id": school_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    if student.get("enrollment_status") != "pending":
        raise HTTPException(status_code=400, detail="Este alumno no está en estado pendiente")

    now = datetime.now(timezone.utc).isoformat()

    await db.users.update_one({"id": student_id}, {"$set": {
        "enrollment_status": "rejected",
        "student_status": "inactive",
        "enrollment_reviewed_by": reviewer_id,
        "enrollment_reviewed_at": now,
        "enrollment_rejection_reason": data.reason.strip(),
        "updated_at": now,
    }})

    full_name = f"{student.get('name', '')} {student.get('last_name', '')}".strip()

    # Notify parent
    parent_id = student.get("enrollment_submitted_by_parent_id") or student.get("padre_id")
    if parent_id:
        await create_internal_notification(
            user_id=parent_id,
            school_id=school_id,
            title="Matrícula no aprobada",
            body=f"La matrícula de {full_name} no fue aprobada. Motivo: {data.reason.strip()}",
            metadata={"type": "enrollment_rejected", "student_id": student_id},
        )

    logger.info(f"[ENROLLMENT] Student {student_id} rejected by {reviewer_id}: {data.reason}")
    return {"message": f"Matrícula de {full_name} rechazada"}


# ══════════════════════════════════════════════════════════════════
#  5. GET /api/enrollment/pending/count — For sidebar badge
# ══════════════════════════════════════════════════════════════════

@router.get("/enrollment/pending/count")
async def get_pending_count(current_user=Depends(require_role(["owner", "admin", "director"]))):
    school_id = current_user.get("school_id")
    count = await db.users.count_documents({
        "school_id": school_id,
        "role": "student",
        "enrollment_status": "pending",
    })
    return {"count": count}



# ══════════════════════════════════════════════════════════════════
#  6. GET /api/school/enrollment-config — Read config (any user)
# ══════════════════════════════════════════════════════════════════

@router.get("/school/enrollment-config")
async def get_enrollment_config(current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="school_id no encontrado")

    # Check both schools and tenant_settings collections
    school = await db.schools.find_one({"school_id": school_id}, {"_id": 0, "settings": 1})
    cfg = (school or {}).get("settings", {}).get("parent_self_enrollment", {})

    # Fallback to tenant_settings
    if not cfg:
        ts = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "parent_self_enrollment": 1})
        cfg = (ts or {}).get("parent_self_enrollment", {})

    return {
        "parent_self_enrollment_enabled": cfg.get("enabled", False),
        "academic_info_editable": cfg.get("academic_info_editable", False),
    }


# ══════════════════════════════════════════════════════════════════
#  7. PATCH /api/school/settings/enrollment — Update config
# ══════════════════════════════════════════════════════════════════

class EnrollmentConfigUpdate(BaseModel):
    enabled: bool
    academic_info_editable: bool = False

@router.patch("/school/settings/enrollment")
async def update_enrollment_config(
    data: EnrollmentConfigUpdate,
    current_user=Depends(require_role(["owner", "admin"]))
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="school_id no encontrado")

    # Business rule: if enabled=false, academic_info_editable must be false
    if not data.enabled:
        data.academic_info_editable = False

    config = {
        "enabled": data.enabled,
        "academic_info_editable": data.academic_info_editable,
    }

    # Store in tenant_settings (main config collection)
    await db.tenant_settings.update_one(
        {"school_id": school_id},
        {"$set": {"parent_self_enrollment": config}},
        upsert=True,
    )

    logger.info(f"[ENROLLMENT] Config updated for school {school_id}: enabled={data.enabled}, academic={data.academic_info_editable}")
    return {
        "parent_self_enrollment_enabled": data.enabled,
        "academic_info_editable": data.academic_info_editable,
        "message": "Configuración guardada correctamente",
    }
