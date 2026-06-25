"""
Psychology Agenda & Workshops Module
Appointments calendar + Group workshops management
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query

from .core import db, require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")

APPOINTMENT_TYPES = [
    "sesion_individual", "sesion_grupal", "sesion_familiar",
    "reunion_padres", "observacion_aula", "evaluacion", "otro"
]
APPOINTMENT_STATUSES = ["programada", "completada", "cancelada", "reprogramada", "no_asistio"]
WORKSHOP_CATEGORIES = [
    "manejo_emociones", "prevencion_bullying", "autoestima", "habilidades_sociales",
    "orientacion_vocacional", "habitos_estudio", "sexualidad", "prevencion_drogas",
    "convivencia", "otro"
]
WORKSHOP_STATUSES = ["planificado", "en_curso", "completado", "cancelado"]


# ══════════════════════════════════════════════════════════════════════════════
# MODELS - APPOINTMENTS
# ══════════════════════════════════════════════════════════════════════════════

class AppointmentCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    appointment_type: str
    date: str  # ISO datetime
    duration_minutes: Optional[int] = 45
    student_id: Optional[str] = None
    parent_id: Optional[str] = None
    location: Optional[str] = ""
    recurrence_type: Optional[str] = "none"  # none|weekly|biweekly|monthly
    recurrence_end_date: Optional[str] = None

class AppointmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    appointment_type: Optional[str] = None
    date: Optional[str] = None
    duration_minutes: Optional[int] = None
    student_id: Optional[str] = None
    parent_id: Optional[str] = None
    location: Optional[str] = None
    edit_scope: Optional[str] = "single"  # single|future

class AppointmentStatusUpdate(BaseModel):
    status: str
    notes_post: Optional[str] = ""


# ══════════════════════════════════════════════════════════════════════════════
# MODELS - WORKSHOPS
# ══════════════════════════════════════════════════════════════════════════════

class WorkshopCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    topic_category: str
    date: str
    duration_minutes: Optional[int] = 60
    target_level: Optional[str] = "todos"
    target_grades: Optional[List[str]] = []
    target_sections: Optional[List[str]] = []
    expected_attendees: Optional[int] = 0
    location: Optional[str] = ""
    objectives: Optional[List[str]] = []
    methodology: Optional[str] = ""
    materials: Optional[List[dict]] = []

class WorkshopUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    topic_category: Optional[str] = None
    date: Optional[str] = None
    duration_minutes: Optional[int] = None
    target_level: Optional[str] = None
    target_grades: Optional[List[str]] = None
    target_sections: Optional[List[str]] = None
    expected_attendees: Optional[int] = None
    location: Optional[str] = None
    objectives: Optional[List[str]] = None
    methodology: Optional[str] = None
    materials: Optional[List[dict]] = None
    status: Optional[str] = None  # Allow status updates (planificado, en_curso, cancelado)

class WorkshopAttendance(BaseModel):
    attendee_list: List[dict]  # [{student_id, attended}]

class WorkshopComplete(BaseModel):
    observations: Optional[str] = ""
    outcomes: Optional[str] = ""
    actual_attendees: Optional[int] = None
    photos: Optional[List[dict]] = []


# ══════════════════════════════════════════════════════════════════════════════
# APPOINTMENTS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/psychology/appointments")
async def list_appointments(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    appointment_type: Optional[str] = None,
    user=Depends(require_role(["psicologo"]))
):
    school_id = user["school_id"]
    psych_id = user["id"]
    query = {"institution_id": school_id, "psychologist_id": psych_id}

    if not start_date:
        now = datetime.now(timezone.utc)
        start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0).isoformat()
    if not end_date:
        now = datetime.now(timezone.utc)
        end_date = (now + timedelta(days=6 - now.weekday())).replace(hour=23, minute=59, second=59).isoformat()

    query["date"] = {"$gte": start_date, "$lte": end_date}
    if status:
        query["status"] = status
    if appointment_type:
        query["appointment_type"] = appointment_type

    appointments = await db.psychological_appointments.find(
        query, {"_id": 0}
    ).sort("date", 1).to_list(500)

    student_ids = list(set(a.get("student_id") for a in appointments if a.get("student_id")))
    parent_ids = list(set(a.get("parent_id") for a in appointments if a.get("parent_id")))
    all_ids = list(set(student_ids + parent_ids))

    users_map = {}
    if all_ids:
        users = await db.users.find(
            {"id": {"$in": all_ids}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "grade": 1, "section": 1, "photo_url": 1}
        ).to_list(200)
        users_map = {u["id"]: u for u in users}

    for a in appointments:
        if a.get("student_id"):
            s = users_map.get(a["student_id"], {})
            a["student_name"] = f"{s.get('name', '')} {s.get('last_name', '')}".strip()
            a["student_grade"] = s.get("grade", "")
            a["student_section"] = s.get("section", "")
        if a.get("parent_id"):
            p = users_map.get(a["parent_id"], {})
            a["parent_name"] = f"{p.get('name', '')} {p.get('last_name', '')}".strip()

    return {"appointments": appointments}


@router.get("/psychology/appointments/today")
async def today_appointments(user=Depends(require_role(["psicologo"]))):
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    end = now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()

    appointments = await db.psychological_appointments.find(
        {"psychologist_id": user["id"], "date": {"$gte": start, "$lte": end}, "status": {"$ne": "cancelada"}},
        {"_id": 0}
    ).sort("date", 1).to_list(50)

    student_ids = [a.get("student_id") for a in appointments if a.get("student_id")]
    students_map = {}
    if student_ids:
        students = await db.users.find({"id": {"$in": student_ids}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}).to_list(50)
        students_map = {s["id"]: s for s in students}
    for a in appointments:
        if a.get("student_id"):
            s = students_map.get(a["student_id"], {})
            a["student_name"] = f"{s.get('name', '')} {s.get('last_name', '')}".strip()
            a["student_photo"] = s.get("photo_url", "")

    return {"appointments": appointments, "count": len(appointments)}


@router.get("/psychology/appointments/week-summary")
async def week_summary(user=Depends(require_role(["psicologo"]))):
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = (week_start + timedelta(days=6)).replace(hour=23, minute=59, second=59)

    appointments = await db.psychological_appointments.find(
        {"psychologist_id": user["id"], "date": {"$gte": week_start.isoformat(), "$lte": week_end.isoformat()}},
        {"_id": 0, "date": 1, "status": 1}
    ).to_list(200)

    days = {}
    for i in range(7):
        day = (week_start + timedelta(days=i)).strftime("%Y-%m-%d")
        days[day] = {"total": 0, "completadas": 0, "pendientes": 0}

    for a in appointments:
        day_key = a["date"][:10]
        if day_key in days:
            days[day_key]["total"] += 1
            if a.get("status") == "completada":
                days[day_key]["completadas"] += 1
            elif a.get("status") in ["programada", "reprogramada"]:
                days[day_key]["pendientes"] += 1

    return {"week_start": week_start.isoformat(), "days": days}


@router.get("/psychology/appointments/check-conflict")
async def check_conflict(
    date: str,
    duration_minutes: int = 45,
    exclude_id: Optional[str] = None,
    user=Depends(require_role(["psicologo"]))
):
    """Check for appointment conflicts - must be before {appointment_id} route"""
    try:
        dt = datetime.fromisoformat(date.replace("Z", "+00:00"))
        end_dt = dt + timedelta(minutes=duration_minutes)
    except Exception:
        return {"has_conflict": False}

    query = {
        "psychologist_id": user["id"],
        "status": {"$in": ["programada", "reprogramada"]},
        "date": {"$lt": end_dt.isoformat()},
        "end_time": {"$gt": date}
    }
    if exclude_id:
        query["id"] = {"$ne": exclude_id}

    conflict = await db.psychological_appointments.find_one(query, {"_id": 0, "id": 1, "title": 1, "date": 1})
    return {"has_conflict": conflict is not None, "conflict": {"title": conflict["title"], "date": conflict["date"]} if conflict else None}


@router.get("/psychology/appointments/{appointment_id}")
async def get_appointment(appointment_id: str, user=Depends(require_role(["psicologo"]))):
    appt = await db.psychological_appointments.find_one(
        {"id": appointment_id, "psychologist_id": user["id"]}, {"_id": 0}
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return appt


@router.post("/psychology/appointments")
async def create_appointment(data: AppointmentCreate, user=Depends(require_role(["psicologo"]))):
    school_id = user["school_id"]
    psych_id = user["id"]
    now = datetime.now(timezone.utc).isoformat()

    # Check for conflicts
    appt_date = data.date
    end_time = ""
    try:
        dt = datetime.fromisoformat(appt_date.replace("Z", "+00:00"))
        end_dt = dt + timedelta(minutes=data.duration_minutes or 45)
        end_time = end_dt.isoformat()
    except Exception:
        end_time = appt_date

    conflict = await db.psychological_appointments.find_one({
        "psychologist_id": psych_id,
        "status": {"$in": ["programada", "reprogramada"]},
        "date": {"$lt": end_time},
        "end_time": {"$gt": appt_date}
    }, {"_id": 0, "title": 1, "date": 1})

    appointments_to_create = []
    base_appt = {
        "institution_id": school_id,
        "psychologist_id": psych_id,
        "title": data.title,
        "description": data.description or "",
        "appointment_type": data.appointment_type,
        "date": data.date,
        "duration_minutes": data.duration_minutes or 45,
        "end_time": end_time,
        "student_id": data.student_id,
        "parent_id": data.parent_id,
        "location": data.location or "",
        "status": "programada",
        "recurrence": {"type": data.recurrence_type or "none", "end_date": data.recurrence_end_date, "parent_appointment_id": None},
        "reminder_sent": False,
        "notes_post": "",
        "linked_session_id": None,
        "created_at": now,
        "updated_at": now
    }

    if data.recurrence_type and data.recurrence_type != "none" and data.recurrence_end_date:
        parent_id_appt = str(uuid.uuid4())
        base_appt["id"] = parent_id_appt
        base_appt["recurrence"]["parent_appointment_id"] = None
        appointments_to_create.append({**base_appt})

        try:
            current_dt = datetime.fromisoformat(data.date.replace("Z", "+00:00"))
            end_recurrence = datetime.fromisoformat(data.recurrence_end_date.replace("Z", "+00:00"))
            delta = {"weekly": 7, "biweekly": 14, "monthly": 30}.get(data.recurrence_type, 7)

            for _ in range(78):  # max ~6 months
                current_dt += timedelta(days=delta)
                if current_dt > end_recurrence:
                    break
                new_end = current_dt + timedelta(minutes=data.duration_minutes or 45)
                rec_appt = {**base_appt}
                rec_appt["id"] = str(uuid.uuid4())
                rec_appt["date"] = current_dt.isoformat()
                rec_appt["end_time"] = new_end.isoformat()
                rec_appt["recurrence"] = {**base_appt["recurrence"], "parent_appointment_id": parent_id_appt}
                rec_appt["created_at"] = now
                rec_appt["updated_at"] = now
                appointments_to_create.append(rec_appt)
        except Exception as e:
            logger.error(f"Recurrence error: {e}")
    else:
        base_appt["id"] = str(uuid.uuid4())
        appointments_to_create.append(base_appt)

    for a in appointments_to_create:
        await db.psychological_appointments.insert_one(a)
        a.pop("_id", None)

    return {
        "message": f"{'Citas creadas' if len(appointments_to_create) > 1 else 'Cita creada'} ({len(appointments_to_create)})",
        "conflict": {"title": conflict["title"], "date": conflict["date"]} if conflict else None,
        "appointments": appointments_to_create
    }


@router.put("/psychology/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, data: AppointmentUpdate, user=Depends(require_role(["psicologo"]))):
    appt = await db.psychological_appointments.find_one({"id": appointment_id, "psychologist_id": user["id"]}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    update = {k: v for k, v in data.dict().items() if v is not None and k != "edit_scope"}
    if "date" in update and "duration_minutes" in update:
        try:
            dt = datetime.fromisoformat(update["date"].replace("Z", "+00:00"))
            update["end_time"] = (dt + timedelta(minutes=update["duration_minutes"])).isoformat()
        except Exception:
            pass
    elif "date" in update:
        try:
            dt = datetime.fromisoformat(update["date"].replace("Z", "+00:00"))
            update["end_time"] = (dt + timedelta(minutes=appt.get("duration_minutes", 45))).isoformat()
        except Exception:
            pass

    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    if data.edit_scope == "future" and appt.get("recurrence", {}).get("parent_appointment_id"):
        parent_id = appt["recurrence"]["parent_appointment_id"]
        await db.psychological_appointments.update_many(
            {"$or": [{"id": parent_id}, {"recurrence.parent_appointment_id": parent_id}], "date": {"$gte": appt["date"]}},
            {"$set": update}
        )
    else:
        await db.psychological_appointments.update_one({"id": appointment_id}, {"$set": update})

    return {"message": "Cita actualizada"}


@router.put("/psychology/appointments/{appointment_id}/status")
async def update_appointment_status(appointment_id: str, data: AppointmentStatusUpdate, user=Depends(require_role(["psicologo"]))):
    appt = await db.psychological_appointments.find_one({"id": appointment_id, "psychologist_id": user["id"]}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    update = {"status": data.status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if data.notes_post:
        update["notes_post"] = data.notes_post

    await db.psychological_appointments.update_one({"id": appointment_id}, {"$set": update})

    suggest_session = data.status == "completada" and appt.get("student_id")
    return {"message": "Estado actualizado", "suggest_create_session": suggest_session, "student_id": appt.get("student_id")}


@router.delete("/psychology/appointments/{appointment_id}")
async def delete_appointment(
    appointment_id: str,
    delete_scope: str = Query("single", regex="^(single|future|all)$"),
    user=Depends(require_role(["psicologo"]))
):
    appt = await db.psychological_appointments.find_one({"id": appointment_id, "psychologist_id": user["id"]}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    if delete_scope == "all" and appt.get("recurrence", {}).get("parent_appointment_id"):
        parent_id = appt["recurrence"]["parent_appointment_id"]
        await db.psychological_appointments.delete_many(
            {"$or": [{"id": parent_id}, {"recurrence.parent_appointment_id": parent_id}]}
        )
    elif delete_scope == "future" and appt.get("recurrence", {}).get("parent_appointment_id"):
        parent_id = appt["recurrence"]["parent_appointment_id"]
        await db.psychological_appointments.delete_many(
            {"$or": [{"id": parent_id}, {"recurrence.parent_appointment_id": parent_id}], "date": {"$gte": appt["date"]}}
        )
    else:
        await db.psychological_appointments.delete_one({"id": appointment_id})

    return {"message": "Cita eliminada"}


# ══════════════════════════════════════════════════════════════════════════════
# WORKSHOPS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/psychology/workshops")
async def list_workshops(
    status: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user=Depends(require_role(["psicologo"]))
):
    query = {"institution_id": user["school_id"], "psychologist_id": user["id"]}
    if status:
        query["status"] = status
    if category:
        query["topic_category"] = category
    if start_date or end_date:
        query["date"] = {}
        if start_date:
            query["date"]["$gte"] = start_date
        if end_date:
            query["date"]["$lte"] = end_date

    total = await db.psychological_workshops.count_documents(query)
    skip = (page - 1) * limit
    workshops = await db.psychological_workshops.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)

    return {"workshops": workshops, "total": total, "page": page}


@router.get("/psychology/workshops/upcoming")
async def upcoming_workshops(user=Depends(require_role(["psicologo"]))):
    now = datetime.now(timezone.utc).isoformat()
    workshops = await db.psychological_workshops.find(
        {"psychologist_id": user["id"], "status": "planificado", "date": {"$gte": now}},
        {"_id": 0}
    ).sort("date", 1).limit(3).to_list(3)
    return {"workshops": workshops}


@router.get("/psychology/workshops/{workshop_id}")
async def get_workshop(workshop_id: str, user=Depends(require_role(["psicologo"]))):
    ws = await db.psychological_workshops.find_one(
        {"id": workshop_id, "psychologist_id": user["id"]}, {"_id": 0}
    )
    if not ws:
        raise HTTPException(status_code=404, detail="Taller no encontrado")
    return ws


@router.post("/psychology/workshops")
async def create_workshop(data: WorkshopCreate, user=Depends(require_role(["psicologo"]))):
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()

    attendee_list = []
    if data.target_grades and data.target_sections:
        query = {"school_id": school_id, "role": "student", "is_disabled": {"$ne": True}}
        if data.target_grades:
            query["grade"] = {"$in": data.target_grades}
        if data.target_sections:
            query["section"] = {"$in": data.target_sections}
        students = await db.users.find(query, {"_id": 0, "id": 1}).to_list(500)
        attendee_list = [{"student_id": s["id"], "attended": False} for s in students]

    workshop = {
        "id": str(uuid.uuid4()),
        "institution_id": school_id,
        "psychologist_id": user["id"],
        "title": data.title,
        "description": data.description or "",
        "topic_category": data.topic_category,
        "date": data.date,
        "duration_minutes": data.duration_minutes or 60,
        "target_level": data.target_level or "todos",
        "target_grades": data.target_grades or [],
        "target_sections": data.target_sections or [],
        "expected_attendees": data.expected_attendees or len(attendee_list),
        "actual_attendees": None,
        "attendee_list": attendee_list,
        "location": data.location or "",
        "objectives": data.objectives or [],
        "methodology": data.methodology or "",
        "observations": "",
        "outcomes": "",
        "materials": data.materials or [],
        "photos": [],
        "status": "planificado",
        "created_at": now,
        "updated_at": now
    }
    await db.psychological_workshops.insert_one(workshop)
    workshop.pop("_id", None)
    return {"message": "Taller creado", "workshop": workshop}


@router.put("/psychology/workshops/{workshop_id}")
async def update_workshop(workshop_id: str, data: WorkshopUpdate, user=Depends(require_role(["psicologo"]))):
    ws = await db.psychological_workshops.find_one({"id": workshop_id, "psychologist_id": user["id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(status_code=404, detail="Taller no encontrado")

    update = {k: v for k, v in data.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.psychological_workshops.update_one({"id": workshop_id}, {"$set": update})
    return {"message": "Taller actualizado"}


@router.put("/psychology/workshops/{workshop_id}/attendance")
async def update_attendance(workshop_id: str, data: WorkshopAttendance, user=Depends(require_role(["psicologo"]))):
    ws = await db.psychological_workshops.find_one({"id": workshop_id, "psychologist_id": user["id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(status_code=404, detail="Taller no encontrado")

    actual = sum(1 for a in data.attendee_list if a.get("attended"))
    await db.psychological_workshops.update_one(
        {"id": workshop_id},
        {"$set": {"attendee_list": data.attendee_list, "actual_attendees": actual, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Asistencia actualizada", "actual_attendees": actual}


@router.put("/psychology/workshops/{workshop_id}/complete")
async def complete_workshop(workshop_id: str, data: WorkshopComplete, user=Depends(require_role(["psicologo"]))):
    ws = await db.psychological_workshops.find_one({"id": workshop_id, "psychologist_id": user["id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(status_code=404, detail="Taller no encontrado")

    update = {
        "status": "completado",
        "observations": data.observations or "",
        "outcomes": data.outcomes or "",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if data.actual_attendees is not None:
        update["actual_attendees"] = data.actual_attendees
    if data.photos:
        update["photos"] = data.photos
    await db.psychological_workshops.update_one({"id": workshop_id}, {"$set": update})
    return {"message": "Taller completado"}


@router.delete("/psychology/workshops/{workshop_id}")
async def delete_workshop(workshop_id: str, user=Depends(require_role(["psicologo"]))):
    ws = await db.psychological_workshops.find_one({"id": workshop_id, "psychologist_id": user["id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(status_code=404, detail="Taller no encontrado")
    if ws.get("status") != "planificado":
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar talleres planificados")
    await db.psychological_workshops.delete_one({"id": workshop_id})
    return {"message": "Taller eliminado"}
