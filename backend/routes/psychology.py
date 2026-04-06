"""
Psychology Module - Backend Routes
CRUD for psychologists + psychological records + sessions
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query

from .core import db, get_current_user, resolve_user_from_token, require_role, ADMIN_ROLES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")

PSYCHOLOGY_ADMIN_ROLES = ADMIN_ROLES  # owner, admin, director, coordinator
PSYCHOLOGY_ACCESS_ROLES = ADMIN_ROLES + ["psicologo"]

# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class PsychologistCreate(BaseModel):
    name: str
    last_name: str
    email: str
    phone: Optional[str] = ""
    password: str
    specialty: Optional[str] = ""
    license_number: Optional[str] = ""
    assigned_levels: Optional[List[str]] = []
    office_location: Optional[str] = ""
    schedule_notes: Optional[str] = ""
    photo_url: Optional[str] = ""

class PsychologistUpdate(BaseModel):
    name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    specialty: Optional[str] = None
    license_number: Optional[str] = None
    assigned_levels: Optional[List[str]] = None
    office_location: Optional[str] = None
    schedule_notes: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[str] = None

class PsychologicalRecordCreate(BaseModel):
    student_id: str
    reason: Optional[str] = ""
    reason_category: Optional[str] = "Otro"
    observations: Optional[str] = ""
    diagnosis: Optional[str] = ""
    family_structure: Optional[str] = ""
    family_members: Optional[List[dict]] = []
    home_environment: Optional[str] = ""
    developmental_history: Optional[str] = ""
    medical_history: Optional[str] = ""
    previous_interventions: Optional[str] = ""
    general_observations: Optional[str] = ""
    risk_level: Optional[str] = "bajo"
    status: Optional[str] = "nuevo"

class PsychologicalRecordUpdate(BaseModel):
    reason: Optional[str] = None
    reason_category: Optional[str] = None
    observations: Optional[str] = None
    diagnosis: Optional[str] = None
    family_structure: Optional[str] = None
    family_members: Optional[List[dict]] = None
    home_environment: Optional[str] = None
    developmental_history: Optional[str] = None
    medical_history: Optional[str] = None
    previous_interventions: Optional[str] = None
    general_observations: Optional[str] = None
    risk_level: Optional[str] = None
    status: Optional[str] = None

class SessionCreate(BaseModel):
    student_id: str
    date: str
    session_type: str
    reason_category: str
    reason_detail: Optional[str] = ""
    notes: Optional[str] = ""
    observations: Optional[str] = ""
    duration_minutes: Optional[int] = 45
    techniques_used: Optional[str] = ""
    agreements: Optional[str] = ""
    recommendations: Optional[str] = ""
    next_session_date: Optional[str] = None
    next_session_notes: Optional[str] = ""
    mood_assessment: Optional[str] = ""
    attachments: Optional[List[dict]] = []
    is_confidential: Optional[bool] = False

class SessionUpdate(BaseModel):
    date: Optional[str] = None
    session_type: Optional[str] = None
    reason_category: Optional[str] = None
    reason_detail: Optional[str] = None
    notes: Optional[str] = None
    observations: Optional[str] = None
    duration_minutes: Optional[int] = None
    techniques_used: Optional[str] = None
    agreements: Optional[str] = None
    recommendations: Optional[str] = None
    next_session_date: Optional[str] = None
    next_session_notes: Optional[str] = None
    mood_assessment: Optional[str] = None
    attachments: Optional[List[dict]] = None
    is_confidential: Optional[bool] = None

# ══════════════════════════════════════════════════════════════════════════════
# AUDIT LOG HELPER
# ══════════════════════════════════════════════════════════════════════════════

async def log_audit(psychologist_id, action, resource_type, resource_id, student_id, school_id):
    try:
        await db.psychology_audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "psychologist_id": psychologist_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "student_id": student_id,
            "school_id": school_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Audit log error: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# PSYCHOLOGIST CRUD (admin-facing)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/psychologists")
async def list_psychologists(user=Depends(require_role(PSYCHOLOGY_ADMIN_ROLES))):
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    psychologists = await db.users.find(
        {"school_id": school_id, "role": "psicologo"},
        {"_id": 0, "password": 0}
    ).to_list(100)
    return psychologists

@router.get("/psychologists/count")
async def count_psychologists(user=Depends(require_role(PSYCHOLOGY_ADMIN_ROLES))):
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    count = await db.users.count_documents({"school_id": school_id, "role": "psicologo", "status": {"$ne": "inactive"}})
    return {"count": count}

# ── Self-profile (must be before /{psychologist_id} to avoid route conflict) ──

@router.get("/psychologists/me/profile")
async def get_my_profile(user=Depends(require_role(["psicologo"]))):
    profile = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return profile

@router.put("/psychologists/me/profile")
async def update_my_profile(data: PsychologistUpdate, user=Depends(require_role(["psicologo"]))):
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.phone is not None: update["phone"] = data.phone
    if data.photo_url is not None: update["photo_url"] = data.photo_url
    if data.office_location is not None: update["psychologist_profile.office_location"] = data.office_location
    if data.schedule_notes is not None: update["psychologist_profile.schedule_notes"] = data.schedule_notes
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    return {"message": "Perfil actualizado"}

@router.get("/psychologists/{psychologist_id}")
async def get_psychologist(psychologist_id: str, user=Depends(require_role(PSYCHOLOGY_ADMIN_ROLES))):
    school_id = user.get("school_id")
    psych = await db.users.find_one(
        {"id": psychologist_id, "school_id": school_id, "role": "psicologo"},
        {"_id": 0, "password": 0}
    )
    if not psych:
        raise HTTPException(status_code=404, detail="Psicólogo no encontrado")
    return psych

@router.post("/psychologists")
async def create_psychologist(data: PsychologistCreate, user=Depends(require_role(PSYCHOLOGY_ADMIN_ROLES))):
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    existing = await db.users.find_one({"email": data.email, "school_id": school_id}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con este email")

    import bcrypt
    hashed = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    now = datetime.now(timezone.utc).isoformat()

    psychologist = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "subdomain": user.get("subdomain", ""),
        "name": data.name,
        "last_name": data.last_name,
        "email": data.email,
        "phone": data.phone or "",
        "password": hashed,
        "role": "psicologo",
        "status": "active",
        "email_verified": True,
        "photo_url": data.photo_url or "",
        "psychologist_profile": {
            "specialty": data.specialty or "",
            "license_number": data.license_number or "",
            "assigned_levels": data.assigned_levels or [],
            "office_location": data.office_location or "",
            "schedule_notes": data.schedule_notes or ""
        },
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(psychologist)
    psychologist.pop("_id", None)
    psychologist.pop("password", None)
    return {"message": "Psicólogo creado correctamente", "psychologist": psychologist}

@router.put("/psychologists/{psychologist_id}")
async def update_psychologist(psychologist_id: str, data: PsychologistUpdate, user=Depends(require_role(PSYCHOLOGY_ADMIN_ROLES))):
    school_id = user.get("school_id")
    psych = await db.users.find_one({"id": psychologist_id, "school_id": school_id, "role": "psicologo"}, {"_id": 0})
    if not psych:
        raise HTTPException(status_code=404, detail="Psicólogo no encontrado")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    profile_update = {}

    if data.name is not None: update["name"] = data.name
    if data.last_name is not None: update["last_name"] = data.last_name
    if data.phone is not None: update["phone"] = data.phone
    if data.photo_url is not None: update["photo_url"] = data.photo_url
    if data.status is not None: update["status"] = data.status
    if data.email is not None:
        if data.email != psych.get("email"):
            dup = await db.users.find_one({"email": data.email, "school_id": school_id, "id": {"$ne": psychologist_id}}, {"_id": 0, "id": 1})
            if dup:
                raise HTTPException(status_code=400, detail="Ya existe un usuario con este email")
        update["email"] = data.email
    if data.password:
        import bcrypt
        update["password"] = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    if data.specialty is not None: profile_update["psychologist_profile.specialty"] = data.specialty
    if data.license_number is not None: profile_update["psychologist_profile.license_number"] = data.license_number
    if data.assigned_levels is not None: profile_update["psychologist_profile.assigned_levels"] = data.assigned_levels
    if data.office_location is not None: profile_update["psychologist_profile.office_location"] = data.office_location
    if data.schedule_notes is not None: profile_update["psychologist_profile.schedule_notes"] = data.schedule_notes

    await db.users.update_one({"id": psychologist_id}, {"$set": {**update, **profile_update}})
    return {"message": "Psicólogo actualizado correctamente"}

@router.delete("/psychologists/{psychologist_id}")
async def delete_psychologist(psychologist_id: str, user=Depends(require_role(PSYCHOLOGY_ADMIN_ROLES))):
    school_id = user.get("school_id")
    psych = await db.users.find_one({"id": psychologist_id, "school_id": school_id, "role": "psicologo"}, {"_id": 0})
    if not psych:
        raise HTTPException(status_code=404, detail="Psicólogo no encontrado")
    await db.users.update_one({"id": psychologist_id}, {"$set": {"status": "inactive", "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Psicólogo desactivado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# PSYCHOLOGY STUDENTS LIST (for psychologist portal)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/psychology/students")
async def list_psychology_students(
    search: Optional[str] = None,
    nivel_id: Optional[str] = None,
    grado_id: Optional[str] = None,
    seccion_id: Optional[str] = None,
    turno_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_role(["psicologo"]))
):
    school_id = user.get("school_id")
    profile = user.get("psychologist_profile", {})
    assigned_levels = profile.get("assigned_levels", [])

    query = {"school_id": school_id, "role": {"$in": ["student", "estudiante"]}}
    if assigned_levels:
        levels = await db.niveles.find({"school_id": school_id, "nombre": {"$in": [l.capitalize() for l in assigned_levels]}}, {"_id": 0, "id": 1}).to_list(10)
        level_ids = [l["id"] for l in levels]
        if level_ids:
            query["nivel_id"] = {"$in": level_ids}
    if nivel_id: query["nivel_id"] = nivel_id
    if grado_id: query["grado_id"] = grado_id
    if seccion_id: query["seccion_id"] = seccion_id
    if turno_id: query["turno_id"] = turno_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}}
        ]

    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    students = await db.users.find(query, {"_id": 0, "password": 0}).sort("last_name", 1).skip(skip).limit(limit).to_list(limit)

    student_ids = [s["id"] for s in students]
    records = await db.psychological_records.find({"student_id": {"$in": student_ids}, "school_id": school_id}, {"_id": 0, "student_id": 1}).to_list(500)
    record_set = {r["student_id"] for r in records}

    pipeline = [
        {"$match": {"student_id": {"$in": student_ids}, "school_id": school_id}},
        {"$group": {"_id": "$student_id", "total_sessions": {"$sum": 1}, "last_session_date": {"$max": "$date"}}}
    ]
    session_stats = {s["_id"]: s for s in await db.psychological_sessions.aggregate(pipeline).to_list(500)}

    for s in students:
        sid = s["id"]
        s["has_psychological_record"] = sid in record_set
        stats = session_stats.get(sid, {})
        s["total_sessions"] = stats.get("total_sessions", 0)
        s["last_session_date"] = stats.get("last_session_date")

    return {"students": students, "total": total, "page": page, "limit": limit}

# ══════════════════════════════════════════════════════════════════════════════
# PSYCHOLOGICAL RECORDS
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/psychology/records")
async def list_records(
    search: Optional[str] = None,
    status: Optional[str] = None,
    reason_category: Optional[str] = None,
    nivel_id: Optional[str] = None,
    grado_id: Optional[str] = None,
    seccion_id: Optional[str] = None,
    turno_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_role(["psicologo"]))
):
    school_id = user.get("school_id")
    query = {"school_id": school_id}
    if status:
        query["status"] = status
    if reason_category:
        query["reason_category"] = reason_category

    # If filtering by academic structure, first find matching student_ids
    student_filter = {}
    if nivel_id or grado_id or seccion_id or turno_id:
        student_filter = {"school_id": school_id, "role": {"$in": ["student", "estudiante"]}}
        if nivel_id: student_filter["nivel_id"] = nivel_id
        if grado_id: student_filter["grado_id"] = grado_id
        if seccion_id: student_filter["seccion_id"] = seccion_id
        if turno_id: student_filter["turno_id"] = turno_id
        matching_students = await db.users.find(student_filter, {"_id": 0, "id": 1}).to_list(5000)
        matching_ids = [s["id"] for s in matching_students]
        query["student_id"] = {"$in": matching_ids}

    total = await db.psychological_records.count_documents(query)
    skip = (page - 1) * limit
    records = await db.psychological_records.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)

    student_ids = [r["student_id"] for r in records]
    students = await db.users.find(
        {"id": {"$in": student_ids}, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "nivel_id": 1, "grado_id": 1, "seccion_id": 1, "turno_id": 1}
    ).to_list(500)
    student_map = {s["id"]: s for s in students}

    # Resolve academic names
    all_nivel_ids = list({st.get("nivel_id") for st in students if st.get("nivel_id")})
    all_grado_ids = list({st.get("grado_id") for st in students if st.get("grado_id")})
    all_seccion_ids = list({st.get("seccion_id") for st in students if st.get("seccion_id")})
    nivel_map = {n["id"]: n["nombre"] for n in await db.niveles.find({"id": {"$in": all_nivel_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(20)} if all_nivel_ids else {}
    grado_map = {g["id"]: g["nombre"] for g in await db.grades.find({"id": {"$in": all_grado_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)} if all_grado_ids else {}
    seccion_map = {s["id"]: s["nombre"] for s in await db.sections.find({"id": {"$in": all_seccion_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(200)} if all_seccion_ids else {}

    session_pipeline = [
        {"$match": {"student_id": {"$in": student_ids}, "school_id": school_id}},
        {"$group": {"_id": "$student_id", "total_sessions": {"$sum": 1}, "last_session": {"$max": "$date"}}}
    ]
    session_stats = {s["_id"]: s for s in await db.psychological_sessions.aggregate(session_pipeline).to_list(500)}

    if search:
        search_lower = search.lower()

    enriched = []
    for r in records:
        st = student_map.get(r["student_id"], {})
        full_name = f"{st.get('name', '')} {st.get('last_name', '')}"
        if search and search.lower() not in full_name.lower():
            continue
        stats = session_stats.get(r["student_id"], {})
        enriched.append({
            **r,
            "student_name": full_name.strip(),
            "student_photo": st.get("photo_url"),
            "student_nivel": nivel_map.get(st.get("nivel_id", ""), ""),
            "student_grado": grado_map.get(st.get("grado_id", ""), ""),
            "student_seccion": seccion_map.get(st.get("seccion_id", ""), ""),
            "total_sessions": stats.get("total_sessions", 0),
            "last_session": stats.get("last_session"),
        })

    if search:
        total = len(enriched)

    return {"records": enriched, "total": total, "page": page, "limit": limit}


@router.get("/psychology/records/{student_id}")
async def get_record(student_id: str, user=Depends(require_role(["psicologo"]))):
    school_id = user.get("school_id")
    student = await db.users.find_one(
        {"id": student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "password": 0}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    record = await db.psychological_records.find_one(
        {"student_id": student_id, "school_id": school_id}, {"_id": 0}
    )
    if record:
        await log_audit(user["id"], "view", "record", record.get("id"), student_id, school_id)
    return {"student": student, "record": record}

@router.post("/psychology/records")
async def create_record(data: PsychologicalRecordCreate, user=Depends(require_role(["psicologo"]))):
    school_id = user.get("school_id")
    existing = await db.psychological_records.find_one({"student_id": data.student_id, "school_id": school_id}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una ficha psicológica para este estudiante")
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid.uuid4()),
        "student_id": data.student_id,
        "school_id": school_id,
        "created_by": user["id"],
        "reason": data.reason,
        "reason_category": data.reason_category,
        "observations": data.observations,
        "diagnosis": data.diagnosis,
        "family_structure": data.family_structure,
        "family_members": data.family_members,
        "home_environment": data.home_environment,
        "developmental_history": data.developmental_history,
        "medical_history": data.medical_history,
        "previous_interventions": data.previous_interventions,
        "general_observations": data.general_observations,
        "risk_level": data.risk_level,
        "status": data.status,
        "created_at": now,
        "updated_at": now
    }
    await db.psychological_records.insert_one(record)
    record.pop("_id", None)
    await log_audit(user["id"], "create", "record", record["id"], data.student_id, school_id)
    return {"message": "Ficha creada correctamente", "record": record}

@router.put("/psychology/records/{student_id}")
async def update_record(student_id: str, data: PsychologicalRecordUpdate, user=Depends(require_role(["psicologo"]))):
    school_id = user.get("school_id")
    record = await db.psychological_records.find_one({"student_id": student_id, "school_id": school_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Ficha no encontrada")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.psychological_records.update_one({"student_id": student_id, "school_id": school_id}, {"$set": update_data})
    await log_audit(user["id"], "edit", "record", record.get("id"), student_id, school_id)
    return {"message": "Ficha actualizada correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# PSYCHOLOGICAL SESSIONS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/psychology/sessions")
async def list_sessions(
    student_id: Optional[str] = None,
    session_type: Optional[str] = None,
    reason_category: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_role(["psicologo"]))
):
    school_id = user.get("school_id")
    query = {"school_id": school_id}
    if student_id: query["student_id"] = student_id
    if session_type: query["session_type"] = session_type
    if reason_category: query["reason_category"] = reason_category

    total = await db.psychological_sessions.count_documents(query)
    skip = (page - 1) * limit
    sessions = await db.psychological_sessions.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    return {"sessions": sessions, "total": total, "page": page, "limit": limit}

@router.get("/psychology/sessions/{session_id}")
async def get_session(session_id: str, user=Depends(require_role(["psicologo"]))):
    school_id = user.get("school_id")
    session = await db.psychological_sessions.find_one({"id": session_id, "school_id": school_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    await log_audit(user["id"], "view", "session", session_id, session.get("student_id"), school_id)
    return session

@router.post("/psychology/sessions")
async def create_session(data: SessionCreate, user=Depends(require_role(["psicologo"]))):
    school_id = user.get("school_id")
    now = datetime.now(timezone.utc).isoformat()
    session = {
        "id": str(uuid.uuid4()),
        "student_id": data.student_id,
        "psychologist_id": user["id"],
        "school_id": school_id,
        "date": data.date,
        "session_type": data.session_type,
        "reason_category": data.reason_category,
        "reason_detail": data.reason_detail,
        "notes": data.notes,
        "observations": data.observations,
        "duration_minutes": data.duration_minutes,
        "techniques_used": data.techniques_used,
        "agreements": data.agreements,
        "recommendations": data.recommendations,
        "next_session_date": data.next_session_date,
        "next_session_notes": data.next_session_notes,
        "mood_assessment": data.mood_assessment,
        "attachments": data.attachments or [],
        "is_confidential": data.is_confidential or False,
        "created_at": now,
        "updated_at": now
    }
    await db.psychological_sessions.insert_one(session)
    session.pop("_id", None)
    await log_audit(user["id"], "create", "session", session["id"], data.student_id, school_id)
    return {"message": "Sesión registrada correctamente", "session": session}

@router.put("/psychology/sessions/{session_id}")
async def update_session(session_id: str, data: SessionUpdate, user=Depends(require_role(["psicologo"]))):
    school_id = user.get("school_id")
    session = await db.psychological_sessions.find_one({"id": session_id, "school_id": school_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.get("psychologist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Solo el psicólogo que creó la sesión puede editarla")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.psychological_sessions.update_one({"id": session_id}, {"$set": update_data})
    await log_audit(user["id"], "edit", "session", session_id, session.get("student_id"), school_id)
    return {"message": "Sesión actualizada correctamente"}

@router.delete("/psychology/sessions/{session_id}")
async def delete_session(session_id: str, user=Depends(require_role(["psicologo"]))):
    school_id = user.get("school_id")
    session = await db.psychological_sessions.find_one({"id": session_id, "school_id": school_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.get("psychologist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Solo el psicólogo que creó la sesión puede eliminarla")
    await db.psychological_sessions.delete_one({"id": session_id})
    await log_audit(user["id"], "delete", "session", session_id, session.get("student_id"), school_id)
    return {"message": "Sesión eliminada correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD STATS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/psychology/dashboard/stats")
async def dashboard_stats(user=Depends(require_role(["psicologo"]))):
    school_id = user.get("school_id")
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    total_records = await db.psychological_records.count_documents({"school_id": school_id})
    total_sessions_month = await db.psychological_sessions.count_documents({"school_id": school_id, "date": {"$gte": month_start}})
    new_records_month = await db.psychological_records.count_documents({"school_id": school_id, "created_at": {"$gte": month_start}})

    recent_sessions = await db.psychological_sessions.find(
        {"school_id": school_id}, {"_id": 0}
    ).sort("date", -1).limit(10).to_list(10)

    # Enrich with student names
    student_ids = list(set(s.get("student_id") for s in recent_sessions if s.get("student_id")))
    students_map = {}
    if student_ids:
        students = await db.users.find({"id": {"$in": student_ids}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}).to_list(100)
        students_map = {s["id"]: s for s in students}

    for s in recent_sessions:
        st = students_map.get(s.get("student_id"), {})
        s["student_name"] = f"{st.get('name', '')} {st.get('last_name', '')}".strip()
        s["student_photo"] = st.get("photo_url", "")

    return {
        "total_in_seguimiento": total_records,
        "sessions_this_month": total_sessions_month,
        "sessions_today": 0,
        "new_cases_this_month": new_records_month,
        "recent_sessions": recent_sessions
    }
