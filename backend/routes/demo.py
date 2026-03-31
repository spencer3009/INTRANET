"""
Demo Management Router — Create demo schools for prospects
Handles: School cloning with ID remapping, demo access management, auto-cleanup
Only accessible by users with role 'system_admin_global'
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import random
import logging
from urllib.parse import quote

from .core import db, get_current_user, hash_password
from .support import require_support_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/support/demo", tags=["demo"])

# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

NOMBRES_FICTICIOS = [
    "María", "José", "Ana", "Carlos", "Lucía", "Pedro", "Sofía", "Diego",
    "Valentina", "Mateo", "Isabella", "Santiago", "Camila", "Sebastián",
    "Mariana", "Nicolás", "Gabriela", "Alejandro", "Daniela", "Fernando",
    "Andrea", "Miguel", "Paula", "Tomás", "Valeria", "Eduardo", "Natalia",
    "Joaquín", "Carolina", "Emilio", "Laura", "Ricardo", "Fernanda", "Adrián",
]

APELLIDOS_FICTICIOS = [
    "García", "Rodríguez", "López", "Martínez", "Torres", "Flores",
    "Hernández", "Ramírez", "Díaz", "Sánchez", "Morales", "Castillo",
    "Vargas", "Mendoza", "Rojas", "Gutiérrez", "Ortiz", "Silva",
    "Delgado", "Reyes", "Cruz", "Vega", "Castro", "Jiménez",
    "Ríos", "Chávez", "Peña", "Aguilar", "Navarro", "Paredes",
]

# Collections to clone, in dependency order (parents before children)
CLONE_ORDER = [
    # Level 0 — no internal deps
    "shifts",
    "section_types",
    # Level 1 — depend on schools
    "academic_levels",
    "academic_years",
    "payment_concepts",
    "discount_types",
    # Level 2 — depend on level 1
    "grades",
    "academic_periods",
    # Level 3 — depend on level 2
    "sections",
    # Level 4 — depend on structure
    "users",
    # Level 5 — depend on users + structure
    "subjects",
    "subject_teachers",
    "academic_assignments",
    "schedules",
    "schedule_breaks",
    "attendances",
    "student_attendance",
    "payments",
    "expenses",
    "online_exams",
    "student_grades",
    "calendar_events",
    "news",
    "announcements",
    "broadcast_messages",
    "institutional_messages",
    "messages",
    "academic_threads",
    "support_tickets",
    "surveys",
    "discipline_reports",
    "live_classes",
    "course_posts",
    "dashboard_banners",
    # Level 6 — depend on level 5
    "exam_questions",
    "exam_attempts",
    "exam_schedules",
    "register_column_assignments",
    "survey_answers",
]

# Fields that hold references to other document IDs, per collection
REFERENCE_FIELDS = {
    "users": ["school_id", "grado_id", "seccion_id", "nivel_id", "turno_id", "parent_id"],
    "academic_levels": ["school_id"],
    "grades": ["school_id", "nivel_id"],
    "sections": ["school_id", "section_type_id", "grado_id"],
    "section_types": ["school_id"],
    "shifts": ["school_id"],
    "academic_years": ["school_id"],
    "academic_periods": ["school_id", "academic_year_id"],
    "subjects": ["school_id", "level_id", "grade_id", "section_id"],
    "subject_teachers": ["school_id", "subject_id", "teacher_id"],
    "academic_assignments": ["school_id", "teacher_id", "level_id", "grade_id", "section_id", "subject_id", "created_by"],
    "schedules": ["school_id", "grado_id", "seccion_id", "profesor_id", "subject_id"],
    "schedule_breaks": ["school_id", "grade_id", "section_id"],
    "attendances": ["school_id", "user_id", "grade_id", "section_id", "recorded_by"],
    "student_attendance": ["school_id", "student_id"],
    "payments": ["school_id", "student_id", "grade_id", "section_id", "created_by"],
    "expenses": ["school_id", "created_by"],
    "payment_concepts": ["school_id"],
    "discount_types": ["school_id"],
    "online_exams": ["school_id", "subject_id", "section_id", "period_id", "created_by"],
    "exam_questions": ["school_id", "exam_id", "created_by"],
    "exam_attempts": ["school_id", "exam_id", "student_id"],
    "exam_schedules": ["school_id", "nivel_id", "grade_id", "section_id", "subject_id", "teacher_id", "created_by"],
    "register_column_assignments": ["school_id", "subject_id", "section_id", "period_id", "source_id"],
    "student_grades": ["school_id", "student_id", "subject_id", "section_id", "period_id"],
    "calendar_events": ["school_id", "created_by"],
    "news": ["school_id", "author_id"],
    "announcements": ["school_id", "created_by"],
    "broadcast_messages": ["school_id", "sender_id"],
    "institutional_messages": ["school_id", "author_id"],
    "messages": ["school_id", "sender_id", "receiver_id"],
    "academic_threads": ["school_id", "subject_id"],
    "support_tickets": ["school_id", "creator_id"],
    "surveys": ["school_id", "created_by"],
    "survey_answers": ["survey_id", "user_id"],
    "discipline_reports": ["school_id", "student_id", "grade_id", "section_id", "created_by", "reviewed_by"],
    "live_classes": ["school_id", "subject_id", "section_id", "teacher_id"],
    "course_posts": ["school_id", "subject_id", "academic_year_id", "author_id"],
    "dashboard_banners": ["school_id", "created_by"],
}

# Fields that are arrays of IDs
ARRAY_REFERENCE_FIELDS = {
    "academic_threads": ["participant_ids"],
    "broadcast_messages": ["target_roles"],
    "institutional_messages": ["target_roles", "target_levels", "target_grades"],
}

# Nested object fields that contain IDs needing remapping
NESTED_REFERENCE_FIELDS = {
    "calendar_events": {"visibility": ["grades", "sections", "levels"]},
    "news": {"visibility": ["grades", "sections"]},
}


# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════

class CloneDemoRequest(BaseModel):
    source_school_id: str

class CreateDemoAccessRequest(BaseModel):
    prospect_name: str = Field(..., min_length=2)
    prospect_phone: str = Field(..., min_length=8)
    expiration_days: int = Field(default=5, ge=1, le=30)


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def remap_id(value, id_map):
    """Replace an ID with its mapped value if it exists in the map."""
    if value and isinstance(value, str) and value in id_map:
        return id_map[value]
    return value


def remap_array_ids(arr, id_map):
    """Replace IDs in an array with their mapped values."""
    if not arr or not isinstance(arr, list):
        return arr
    return [id_map.get(item, item) if isinstance(item, str) else item for item in arr]


def remap_nested_ids(doc, collection_name, id_map):
    """Remap IDs inside nested objects (e.g., visibility.grades)."""
    nested_config = NESTED_REFERENCE_FIELDS.get(collection_name)
    if not nested_config:
        return
    for parent_field, child_fields in nested_config.items():
        parent_obj = doc.get(parent_field)
        if not parent_obj or not isinstance(parent_obj, dict):
            continue
        for child_field in child_fields:
            if child_field in parent_obj and isinstance(parent_obj[child_field], list):
                parent_obj[child_field] = remap_array_ids(parent_obj[child_field], id_map)


def anonymize_user(doc, index):
    """Anonymize student and parent personal data."""
    role = doc.get("role", "")
    if role in ("student", "parent"):
        doc["name"] = random.choice(NOMBRES_FICTICIOS)
        doc["last_name"] = random.choice(APELLIDOS_FICTICIOS)
        doc["email"] = f"demo.user{index}@edunet.pe"
        doc["phone"] = ""
        if doc.get("username"):
            doc["username"] = f"demo_user_{index}"
        if doc.get("parent_email"):
            doc["parent_email"] = f"demo.parent{index}@edunet.pe"
        if doc.get("dni"):
            doc["dni"] = f"DEMO{str(index).zfill(5)}"
    return doc


async def delete_demo_school_data(demo_school_id: str):
    """Delete ALL data for a demo school across all collections."""
    deleted_counts = {}
    all_collections = CLONE_ORDER + ["schools"]
    for coll_name in all_collections:
        try:
            if coll_name == "schools":
                result = await db.schools.delete_one({"id": demo_school_id})
            elif coll_name == "survey_answers":
                # survey_answers don't have school_id directly, find via surveys
                survey_ids = await db.surveys.find(
                    {"school_id": demo_school_id}, {"_id": 0, "id": 1}
                ).to_list(None)
                s_ids = [s["id"] for s in survey_ids]
                if s_ids:
                    result = await db.survey_answers.delete_many({"survey_id": {"$in": s_ids}})
                else:
                    continue
            else:
                result = await db[coll_name].delete_many({"school_id": demo_school_id})
            count = getattr(result, "deleted_count", 0)
            if count > 0:
                deleted_counts[coll_name] = count
        except Exception as e:
            logger.warning(f"[DEMO] Error deleting {coll_name}: {e}")
    return deleted_counts


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def demo_status(user=Depends(require_support_admin)):
    """Get current demo school status and active accesses count."""
    demo_school = await db.schools.find_one({"is_demo": True}, {"_id": 0})
    if not demo_school:
        return {"has_demo": False, "demo_school": None, "access_count": 0}

    access_count = await db.users.count_documents({
        "school_id": demo_school["id"],
        "is_demo_user": True,
    })
    # Get source school name
    source = None
    if demo_school.get("source_school_id"):
        source = await db.schools.find_one(
            {"id": demo_school["source_school_id"]}, {"_id": 0, "school_name": 1}
        )

    return {
        "has_demo": True,
        "demo_school": {
            "id": demo_school["id"],
            "school_name": demo_school.get("school_name", "Demo EduNet"),
            "subdomain": demo_school.get("subdomain"),
            "source_school_id": demo_school.get("source_school_id"),
            "source_school_name": source.get("school_name") if source else "Desconocido",
            "created_at": demo_school.get("created_at"),
            "collections_cloned": demo_school.get("collections_cloned", 0),
            "documents_cloned": demo_school.get("documents_cloned", 0),
            "students_anonymized": demo_school.get("students_anonymized", 0),
            "parents_anonymized": demo_school.get("parents_anonymized", 0),
        },
        "access_count": access_count,
    }


@router.post("/clone")
async def clone_demo_school(req: CloneDemoRequest, user=Depends(require_support_admin)):
    """Clone a source school into a demo school with anonymized data."""
    # Check if demo already exists
    existing = await db.schools.find_one({"is_demo": True}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un colegio demo. Elimínalo primero o usa re-clonar."
        )

    # Validate source school
    source_school = await db.schools.find_one({"id": req.source_school_id}, {"_id": 0})
    if not source_school:
        raise HTTPException(status_code=404, detail="Colegio fuente no encontrado")

    logger.info(f"[DEMO] Starting clone from '{source_school.get('school_name')}' ({req.source_school_id})")

    # 1. Create demo school document
    new_school_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    demo_school = {
        "id": new_school_id,
        "school_name": "Demo EduNet",
        "subdomain": "demo-edunet",
        "full_domain": "demo.edunet.pe",
        "status": "demo",
        "is_demo": True,
        "source_school_id": req.source_school_id,
        "owner_user_id": user["id"],
        "created_at": now,
        "updated_at": now,
        "expiration_date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
    }
    await db.schools.insert_one(demo_school)
    demo_school.pop("_id", None)

    # 2. Build ID map: old_id → new_id
    id_map = {req.source_school_id: new_school_id}
    total_docs = 0
    students_anonymized = 0
    parents_anonymized = 0
    user_index = 0

    try:
        # 3. Clone collections in dependency order
        for coll_name in CLONE_ORDER:
            ref_fields = REFERENCE_FIELDS.get(coll_name, ["school_id"])
            arr_fields = ARRAY_REFERENCE_FIELDS.get(coll_name, [])

            # Build query — most use school_id, survey_answers uses survey_id
            if coll_name == "survey_answers":
                # Get survey IDs specifically
                source_surveys = await db.surveys.find(
                    {"school_id": req.source_school_id}, {"_id": 0, "id": 1}
                ).to_list(None)
                survey_old_ids = [s["id"] for s in source_surveys]
                if not survey_old_ids:
                    continue
                documents = await db.survey_answers.find(
                    {"survey_id": {"$in": survey_old_ids}}, {"_id": 0}
                ).to_list(None)
            else:
                documents = await db[coll_name].find(
                    {"school_id": req.source_school_id}, {"_id": 0}
                ).to_list(None)

            if not documents:
                continue

            new_documents = []
            for doc in documents:
                old_id = doc.get("id")
                new_id = str(uuid.uuid4())
                if old_id:
                    id_map[old_id] = new_id
                    doc["id"] = new_id

                # Remap all reference fields
                for field in ref_fields:
                    if doc.get(field):
                        doc[field] = remap_id(doc[field], id_map)

                # Remap array reference fields
                for field in arr_fields:
                    if doc.get(field) and isinstance(doc[field], list):
                        # Only remap if items look like UUIDs (not role strings)
                        if doc[field] and isinstance(doc[field][0], str) and len(doc[field][0]) > 20:
                            doc[field] = remap_array_ids(doc[field], id_map)

                # Remap nested objects (visibility.grades, etc.)
                remap_nested_ids(doc, coll_name, id_map)

                # Remap embedded messages in threads/tickets
                if coll_name == "academic_threads" and doc.get("messages"):
                    for msg in doc["messages"]:
                        if isinstance(msg, dict) and msg.get("sender_id"):
                            msg["sender_id"] = remap_id(msg["sender_id"], id_map)
                if coll_name == "support_tickets" and doc.get("messages"):
                    for msg in doc["messages"]:
                        if isinstance(msg, dict) and msg.get("sender_id"):
                            msg["sender_id"] = remap_id(msg["sender_id"], id_map)

                # Anonymize students and parents
                if coll_name == "users":
                    user_index += 1
                    role = doc.get("role", "")
                    if role == "student":
                        students_anonymized += 1
                    elif role == "parent":
                        parents_anonymized += 1
                    anonymize_user(doc, user_index)

                new_documents.append(doc)

            if new_documents:
                await db[coll_name].insert_many(new_documents)
                total_docs += len(new_documents)

            logger.info(f"[DEMO] Cloned {coll_name}: {len(new_documents)} docs")

    except Exception as e:
        # Rollback: delete whatever was cloned
        logger.error(f"[DEMO] Clone failed at collection, rolling back: {e}")
        await delete_demo_school_data(new_school_id)
        raise HTTPException(status_code=500, detail=f"Error durante el clonado: {str(e)}")

    # Update demo school with stats
    cloned_collection_count = 0
    for c in CLONE_ORDER:
        try:
            if c == "survey_answers":
                cnt = 0  # already counted in total_docs
            else:
                cnt = await db[c].count_documents({"school_id": new_school_id})
            if cnt > 0:
                cloned_collection_count += 1
        except Exception:
            pass

    await db.schools.update_one(
        {"id": new_school_id},
        {"$set": {
            "collections_cloned": cloned_collection_count,
            "documents_cloned": total_docs,
            "students_anonymized": students_anonymized,
            "parents_anonymized": parents_anonymized,
        }}
    )

    logger.info(f"[DEMO] Clone complete: {total_docs} docs, {students_anonymized} students anonymized")

    return {
        "success": True,
        "demo_school": {
            "id": new_school_id,
            "school_name": "Demo EduNet",
            "subdomain": "demo-edunet",
            "source_school_name": source_school.get("school_name", ""),
            "collections_cloned": len(CLONE_ORDER),
            "documents_cloned": total_docs,
            "students_anonymized": students_anonymized,
            "parents_anonymized": parents_anonymized,
        }
    }


@router.delete("/clone")
async def delete_demo_clone(user=Depends(require_support_admin)):
    """Delete the demo school and ALL its associated data."""
    demo_school = await db.schools.find_one({"is_demo": True}, {"_id": 0, "id": 1, "school_name": 1})
    if not demo_school:
        raise HTTPException(status_code=404, detail="No hay colegio demo para eliminar")

    # Also delete demo access users
    await db.users.delete_many({
        "school_id": demo_school["id"],
        "is_demo_user": True,
    })

    deleted = await delete_demo_school_data(demo_school["id"])

    logger.info(f"[DEMO] Deleted demo school {demo_school['id']}: {deleted}")

    return {
        "success": True,
        "message": "Colegio demo y toda su data eliminados",
        "deleted": deleted,
    }


@router.post("/reclone")
async def reclone_demo(req: CloneDemoRequest, user=Depends(require_support_admin)):
    """Delete existing demo and clone fresh from source."""
    # Delete existing demo if any
    existing = await db.schools.find_one({"is_demo": True}, {"_id": 0, "id": 1})
    if existing:
        await db.users.delete_many({"school_id": existing["id"], "is_demo_user": True})
        await delete_demo_school_data(existing["id"])
        logger.info("[DEMO] Deleted existing demo for re-clone")

    # Clone fresh
    return await clone_demo_school(req, user)


# ══════════════════════════════════════════════════════════════════════════════
# DEMO ACCESS MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/access")
async def create_demo_access(req: CreateDemoAccessRequest, user=Depends(require_support_admin)):
    """Create a temporary admin user for a prospect to access the demo school."""
    demo_school = await db.schools.find_one({"is_demo": True}, {"_id": 0, "id": 1, "subdomain": 1})
    if not demo_school:
        raise HTTPException(status_code=400, detail="No hay colegio demo clonado. Clone uno primero.")

    # Generate credentials
    random_suffix = str(uuid.uuid4())[:6]
    email = f"demo_{random_suffix}@edunet.pe"
    password_plain = f"Demo{random_suffix}!"
    password_hash = hash_password(password_plain)

    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=req.expiration_days)).isoformat()

    demo_user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password": password_hash,
        "name": req.prospect_name,
        "last_name": "",
        "role": "owner",
        "school_id": demo_school["id"],
        "is_demo_user": True,
        "is_owner": True,
        "is_super_admin": True,
        "prospect_phone": req.prospect_phone,
        "expires_at": expires_at,
        "email_verified": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.users.insert_one(demo_user)
    demo_user.pop("_id", None)

    # Generate WhatsApp link
    subdomain = demo_school.get("subdomain", "demo-edunet")
    message = (
        f"Hola {req.prospect_name}!\n\n"
        f"Aquí tienes tu acceso demo a EduNet:\n\n"
        f"Link: https://edunet.pe/{subdomain}/login\n"
        f"Usuario: {email}\n"
        f"Contraseña: {password_plain}\n\n"
        f"Tu acceso estará activo por {req.expiration_days} días.\n\n"
        f"Explora todo el sistema! Si tienes preguntas, escríbenos."
    )
    phone = req.prospect_phone.replace("+", "").replace(" ", "")
    whatsapp_link = f"https://wa.me/{phone}?text={quote(message)}"

    logger.info(f"[DEMO] Access created for '{req.prospect_name}' -> {email}")

    return {
        "success": True,
        "demo_user_id": demo_user["id"],
        "email": email,
        "password": password_plain,
        "expires_at": expires_at,
        "whatsapp_link": whatsapp_link,
        "login_url": f"https://edunet.pe/{subdomain}/login",
    }


@router.get("/accesses")
async def list_demo_accesses(user=Depends(require_support_admin)):
    """List all active demo access users."""
    demo_school = await db.schools.find_one({"is_demo": True}, {"_id": 0, "id": 1})
    if not demo_school:
        return {"accesses": []}

    users = await db.users.find(
        {"school_id": demo_school["id"], "is_demo_user": True},
        {"_id": 0, "password": 0}
    ).sort("created_at", -1).to_list(100)

    now = datetime.now(timezone.utc)
    accesses = []
    for u in users:
        expires_at = u.get("expires_at", "")
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            is_expired = now > exp_dt
            days_remaining = max(0, (exp_dt - now).days)
        except Exception:
            is_expired = False
            days_remaining = 0

        accesses.append({
            "id": u["id"],
            "prospect_name": u.get("name", ""),
            "prospect_phone": u.get("prospect_phone", ""),
            "email": u.get("email", ""),
            "created_at": u.get("created_at", ""),
            "expires_at": expires_at,
            "days_remaining": days_remaining,
            "is_expired": is_expired,
        })

    return {"accesses": accesses}


@router.delete("/access/{user_id}")
async def revoke_demo_access(user_id: str, user=Depends(require_support_admin)):
    """Revoke a demo access by deleting the user."""
    result = await db.users.delete_one({"id": user_id, "is_demo_user": True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Acceso demo no encontrado")

    logger.info(f"[DEMO] Access revoked: {user_id}")
    return {"success": True, "message": "Acceso demo revocado"}


# ══════════════════════════════════════════════════════════════════════════════
# CRON: Auto-cleanup expired demo accesses (called from server.py)
# ══════════════════════════════════════════════════════════════════════════════

async def cleanup_expired_demo_accesses():
    """Background task: delete expired demo users every 24 hours."""
    import asyncio
    while True:
        try:
            await asyncio.sleep(86400)  # 24 hours
            now = datetime.now(timezone.utc).isoformat()
            result = await db.users.delete_many({
                "is_demo_user": True,
                "expires_at": {"$lt": now},
            })
            if result.deleted_count > 0:
                logger.info(f"[DEMO CRON] Cleaned up {result.deleted_count} expired demo users")
        except Exception as e:
            logger.error(f"[DEMO CRON] Error: {e}")
