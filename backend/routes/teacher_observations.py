"""
Teacher Observations — Comunicación interna profesor ⇄ tutor sobre alumnos.

Módulo dedicado para que un profesor reporte incidencias/observaciones de un alumno
al tutor de la sección de ese alumno. Es comunicación INTERNA — el padre nunca ve esto.

Endpoints:
  POST   /api/teacher/observations              — crear observación (profesor)
  GET    /api/teacher/observations/sent         — listar enviadas por el profesor actual
  GET    /api/teacher/observations/{id}         — detalle (autor o tutor receptor)
  POST   /api/teacher/observations/{id}/reply   — responder en el hilo
  GET    /api/tutor/observations                — inbox del tutor (sus secciones)
  PATCH  /api/tutor/observations/{id}/status    — cambiar estado (en_seguimiento|cerrada)
  GET    /api/students/{student_id}/observations — historial por alumno (admin/tutor)
  GET    /api/teacher/students-with-tutor       — alumnos del profesor con info de su tutor (composer)

Tutor = teacher con academic_assignments.role="tutor", status="activo".
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime, timezone
import os
import uuid
import logging

from .core import db, get_current_user, resolve_user_from_token


async def _require_user(token_payload):
    user = await resolve_user_from_token(token_payload)
    if not user:
        raise HTTPException(401, "No autenticado")
    return user


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["teacher_observations"])

CATEGORIES = {"academica", "conductual", "asistencia", "salud", "otro"}
SEVERITIES = {"info", "atencion", "urgente"}
STATUSES = {"abierta", "en_seguimiento", "cerrada"}


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────
class ObservationIn(BaseModel):
    student_id: str
    category: Literal["academica", "conductual", "asistencia", "salud", "otro"]
    severity: Literal["info", "atencion", "urgente"]
    title: str
    description: str
    fecha_incidente: Optional[str] = None  # YYYY-MM-DD


class ReplyIn(BaseModel):
    text: str


class StatusIn(BaseModel):
    status: Literal["en_seguimiento", "cerrada"]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
async def _resolve_tutor_for_section(school_id: str, section_id: str):
    """Retorna el doc de usuario del tutor activo de la sección, o None."""
    asg = await db.academic_assignments.find_one(
        {"school_id": school_id, "section_id": section_id, "role": "tutor", "status": "activo"},
        {"_id": 0, "teacher_id": 1}
    )
    if not asg:
        return None
    tutor = await db.users.find_one(
        {"id": asg["teacher_id"]},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "email": 1, "photo_url": 1}
    )
    return tutor


def _full_name(u: dict) -> str:
    if not u:
        return "—"
    return f"{(u.get('last_name') or '').strip()} {(u.get('name') or '').strip()}".strip() or u.get('email') or "—"


async def _student_summary(student_id: str):
    s = await db.users.find_one(
        {"id": student_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "seccion_id": 1, "grado_id": 1, "nivel_id": 1}
    )
    if not s:
        return None
    grade = await db.grades.find_one({"id": s.get("grado_id")}, {"_id": 0, "nombre": 1}) if s.get("grado_id") else None
    section = await db.sections.find_one({"id": s.get("seccion_id")}, {"_id": 0, "nombre": 1}) if s.get("seccion_id") else None
    level = await db.academic_levels.find_one({"id": s.get("nivel_id")}, {"_id": 0, "nombre": 1}) if s.get("nivel_id") else None
    return {
        "id": s["id"],
        "full_name": _full_name(s),
        "photo_url": s.get("photo_url"),
        "seccion_id": s.get("seccion_id"),
        "level_name": (level or {}).get("nombre"),
        "grade_name": (grade or {}).get("nombre"),
        "section_name": (section or {}).get("nombre"),
    }


async def _enrich_observation(obs: dict) -> dict:
    """Pega nombres de autor/tutor/alumno al doc para el frontend."""
    author = await db.users.find_one({"id": obs["author_id"]}, {"_id": 0, "name": 1, "last_name": 1, "email": 1, "photo_url": 1})
    tutor = await db.users.find_one({"id": obs["recipient_tutor_id"]}, {"_id": 0, "name": 1, "last_name": 1, "email": 1, "photo_url": 1}) if obs.get("recipient_tutor_id") else None
    student = await _student_summary(obs["student_id"])
    # Enriquecer cada autor del thread
    thread = []
    for msg in (obs.get("thread") or []):
        u = await db.users.find_one({"id": msg.get("author_id")}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
        thread.append({
            **msg,
            "author_name": _full_name(u),
            "author_photo": (u or {}).get("photo_url"),
        })
    return {
        **{k: v for k, v in obs.items() if k != "_id"},
        "author_name": _full_name(author),
        "author_photo": (author or {}).get("photo_url"),
        "tutor_name": _full_name(tutor) if tutor else None,
        "tutor_photo": (tutor or {}).get("photo_url") if tutor else None,
        "student": student,
        "thread": thread,
    }


async def _send_urgent_push_to_tutor(tutor_id: str, observation: dict, school_id: str):
    """Envía push solo si severity == 'urgente'."""
    try:
        from utils.firebase_admin_sdk import send_push_notification
    except Exception:
        logger.warning("[OBS] firebase_admin_sdk no disponible — saltando push")
        return
    try:
        tokens = await db.push_tokens.find({"user_id": tutor_id}, {"_id": 0, "token": 1}).to_list(10)
        student = observation.get("student", {})
        student_name = student.get("full_name") or "un alumno"
        title = f"⚠ Observación urgente sobre {student_name}"
        body = (observation.get("title") or "")[:120]
        for t in tokens:
            ok = send_push_notification(
                token=t["token"],
                title=title,
                body=body,
                data={
                    "type": "teacher_observation_urgent",
                    "observation_id": observation["id"],
                    "student_id": observation["student_id"],
                },
            )
            if not ok:
                await db.push_tokens.delete_one({"token": t["token"]})
    except Exception as e:
        logger.error(f"[OBS] error enviando push urgente: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints — Profesor (emisor)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/teacher/students-with-tutor")
async def list_my_students_with_tutor(current_user=Depends(get_current_user)):
    current_user = await _require_user(current_user)
    """Devuelve los alumnos a los que el profesor enseña, con info del tutor de su sección."""
    school_id = current_user["school_id"]
    teacher_id = current_user["id"]

    # Secciones donde el profesor enseña (cualquier asignación con subject_id)
    asg = await db.academic_assignments.find(
        {"school_id": school_id, "teacher_id": teacher_id, "subject_id": {"$ne": None}, "status": {"$ne": "inactivo"}},
        {"_id": 0, "section_id": 1}
    ).to_list(500)
    section_ids = list({a["section_id"] for a in asg if a.get("section_id")})
    if not section_ids:
        return {"students": []}

    # Cargar alumnos de esas secciones
    students = await db.users.find(
        {"school_id": school_id, "role": "student", "seccion_id": {"$in": section_ids}, "is_deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "seccion_id": 1, "grado_id": 1, "nivel_id": 1}
    ).to_list(2000)

    # Pre-cargar tutor por sección
    tutors_by_section: dict = {}
    for sid in section_ids:
        tutors_by_section[sid] = await _resolve_tutor_for_section(school_id, sid)

    # Pre-cargar nombres de grado/sección
    grades = {g["id"]: g["nombre"] for g in await db.grades.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(500)}
    sections = {s["id"]: s["nombre"] for s in await db.sections.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(500)}

    out = []
    for s in students:
        tutor = tutors_by_section.get(s.get("seccion_id"))
        # Excluir alumnos donde el profesor ES el tutor (no se reporta a sí mismo)
        if tutor and tutor.get("id") == teacher_id:
            tutor_info = {"id": tutor["id"], "name": _full_name(tutor), "self": True}
        elif tutor:
            tutor_info = {"id": tutor["id"], "name": _full_name(tutor), "self": False}
        else:
            tutor_info = None
        out.append({
            "id": s["id"],
            "full_name": _full_name(s),
            "photo_url": s.get("photo_url"),
            "grade_name": grades.get(s.get("grado_id")),
            "section_name": sections.get(s.get("seccion_id")),
            "section_id": s.get("seccion_id"),
            "tutor": tutor_info,
        })
    # Ordenar por sección + apellido
    out.sort(key=lambda x: (x.get("section_name") or "", x.get("full_name") or ""))
    return {"students": out}


@router.get("/teacher/my-tutors")
async def list_my_tutors(current_user=Depends(get_current_user)):
    """Directorio de tutores de las secciones donde enseño y NO soy tutor.

    Agrupado por tutor (un mismo tutor puede aparecer con varias secciones).
    Cada item incluye conteos: mensajes enviados, hilos con respuesta nueva del tutor,
    y avisos de secciones sin tutor.
    """
    current_user = await _require_user(current_user)
    school_id = current_user["school_id"]
    teacher_id = current_user["id"]

    # Secciones donde el profesor enseña (asignación con subject_id)
    asg = await db.academic_assignments.find(
        {"school_id": school_id, "teacher_id": teacher_id, "subject_id": {"$ne": None}, "status": {"$ne": "inactivo"}},
        {"_id": 0, "section_id": 1}
    ).to_list(500)
    section_ids = list({a["section_id"] for a in asg if a.get("section_id")})

    if not section_ids:
        return {"tutors": [], "warnings": [], "summary": {"sections_total": 0, "sections_with_tutor": 0, "sections_without_tutor": 0}}

    # Nombres de grado/sección/nivel — el nivel viene desde el grado
    grades = {g["id"]: g for g in await db.grades.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1}).to_list(500)}
    sections = {s["id"]: s for s in await db.sections.find({"school_id": school_id, "id": {"$in": section_ids}}, {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1}).to_list(500)}
    niveles = {n["id"]: n.get("nombre") for n in await db.academic_levels.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(50)}

    # Contar alumnos por sección
    students_count_pipeline = [
        {"$match": {"school_id": school_id, "role": "student", "is_deleted": {"$ne": True}, "seccion_id": {"$in": section_ids}}},
        {"$group": {"_id": "$seccion_id", "n": {"$sum": 1}}},
    ]
    students_count = {row["_id"]: row["n"] async for row in db.users.aggregate(students_count_pipeline)}

    # Conteo de mensajes por (recipient_tutor_id, section_id) para este profesor
    msg_pipeline = [
        {"$match": {"school_id": school_id, "author_id": teacher_id}},
        {"$group": {
            "_id": {"tutor_id": "$recipient_tutor_id", "section_id": "$section_id"},
            "total": {"$sum": 1},
            "last_at": {"$max": "$created_at"},
        }},
    ]
    msg_counts = {}
    async for row in db.teacher_observations.aggregate(msg_pipeline):
        key = (row["_id"]["tutor_id"], row["_id"]["section_id"])
        msg_counts[key] = {"total": row["total"], "last_at": row.get("last_at")}

    # Conteo de hilos con respuesta nueva (último msg del thread es del TUTOR y read_by_author_at es null)
    pending_replies_pipeline = [
        {"$match": {
            "school_id": school_id,
            "author_id": teacher_id,
            "thread.0": {"$exists": True},
            "read_by_author_at": None,
        }},
        {"$addFields": {"last_msg": {"$arrayElemAt": ["$thread", -1]}}},
        {"$match": {"$expr": {"$ne": ["$last_msg.author_id", "$author_id"]}}},
        {"$group": {
            "_id": {"tutor_id": "$recipient_tutor_id", "section_id": "$section_id"},
            "n": {"$sum": 1},
        }},
    ]
    pending_counts = {}
    async for row in db.teacher_observations.aggregate(pending_replies_pipeline):
        key = (row["_id"]["tutor_id"], row["_id"]["section_id"])
        pending_counts[key] = row["n"]

    # Resolver tutor por sección, agrupar por tutor.id
    tutors_map: dict = {}  # tutor_id -> { tutor, sections: [] }
    warnings: list = []
    sections_with_tutor = 0
    for sid in section_ids:
        sec = sections.get(sid)
        if not sec:
            continue
        grade = grades.get(sec.get("grado_id")) or {}
        grade_name = grade.get("nombre")
        nivel_name = niveles.get(grade.get("nivel_id"))
        section_label = f"{nivel_name + ' ' if nivel_name else ''}{grade_name or ''} {sec.get('nombre') or ''}".strip()
        tutor = await _resolve_tutor_for_section(school_id, sid)
        if not tutor:
            warnings.append({
                "section_id": sid,
                "section_label": section_label,
                "grade_name": grade_name,
                "section_name": sec.get("nombre"),
                "nivel_name": nivel_name,
                "reason": "sin_tutor_asignado",
            })
            continue
        if tutor.get("id") == teacher_id:
            # Soy yo el tutor de esa sección — se gestiona desde Mis Tutorías
            continue
        sections_with_tutor += 1
        key = tutor["id"]
        if key not in tutors_map:
            tutors_map[key] = {
                "tutor": {
                    "id": tutor["id"],
                    "name": _full_name(tutor),
                    "email": tutor.get("email"),
                    "photo_url": tutor.get("photo_url"),
                },
                "sections": [],
                "totals": {"messages_sent": 0, "pending_replies": 0},
            }
        msg_key = (tutor["id"], sid)
        msg_info = msg_counts.get(msg_key, {"total": 0, "last_at": None})
        pending = pending_counts.get(msg_key, 0)
        tutors_map[key]["sections"].append({
            "section_id": sid,
            "section_name": sec.get("nombre"),
            "grade_name": grade_name,
            "nivel_name": nivel_name,
            "students_count": students_count.get(sid, 0),
            "messages_sent": msg_info["total"],
            "last_message_at": msg_info["last_at"],
            "pending_replies": pending,
        })
        tutors_map[key]["totals"]["messages_sent"] += msg_info["total"]
        tutors_map[key]["totals"]["pending_replies"] += pending

    tutors_list = list(tutors_map.values())
    # Ordenar: primero los que tienen pending_replies, luego por messages_sent desc, luego alfabético
    tutors_list.sort(key=lambda t: (-t["totals"]["pending_replies"], -t["totals"]["messages_sent"], t["tutor"]["name"].lower()))

    return {
        "tutors": tutors_list,
        "warnings": warnings,
        "summary": {
            "sections_total": len(section_ids),
            "sections_with_tutor": sections_with_tutor,
            "sections_without_tutor": len(warnings),
            "tutors_count": len(tutors_list),
        },
    }


@router.post("/teacher/observations")
async def create_observation(payload: ObservationIn, current_user=Depends(get_current_user)):
    current_user = await _require_user(current_user)
    school_id = current_user["school_id"]
    teacher_id = current_user["id"]

    # Validar alumno
    student = await db.users.find_one(
        {"id": payload.student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "id": 1, "seccion_id": 1}
    )
    if not student:
        raise HTTPException(404, "Alumno no encontrado en este colegio")

    section_id = student.get("seccion_id")
    if not section_id:
        raise HTTPException(400, "El alumno no tiene sección asignada. No es posible reportarle.")

    # Validar que el profesor SÍ enseñe en esa sección
    teaches_here = await db.academic_assignments.find_one({
        "school_id": school_id,
        "teacher_id": teacher_id,
        "section_id": section_id,
        "subject_id": {"$ne": None},
        "status": {"$ne": "inactivo"},
    })
    if not teaches_here:
        raise HTTPException(403, "No enseñas en la sección de este alumno")

    # Encontrar tutor de la sección
    tutor = await _resolve_tutor_for_section(school_id, section_id)
    if not tutor:
        raise HTTPException(409, "Esta sección no tiene tutor asignado. Pide al administrador que asigne uno antes de reportar.")

    if tutor["id"] == teacher_id:
        raise HTTPException(400, "Eres el tutor de esta sección — registra la observación como nota propia desde 'Mis Tutorías'.")

    now = datetime.now(timezone.utc).isoformat()
    obs_id = str(uuid.uuid4())
    doc = {
        "id": obs_id,
        "school_id": school_id,
        "student_id": payload.student_id,
        "section_id": section_id,
        "author_id": teacher_id,
        "recipient_tutor_id": tutor["id"],
        "category": payload.category,
        "severity": payload.severity,
        "title": payload.title.strip()[:200],
        "description": payload.description.strip()[:4000],
        "fecha_incidente": payload.fecha_incidente or now[:10],
        "status": "abierta",
        "thread": [],
        "read_by_tutor_at": None,
        "closed_at": None,
        "closed_by": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.teacher_observations.insert_one(doc)
    doc.pop("_id", None)

    enriched = await _enrich_observation(doc)

    # Push urgente
    if payload.severity == "urgente":
        await _send_urgent_push_to_tutor(tutor["id"], enriched, school_id)

    return enriched


@router.get("/teacher/observations/sent")
async def list_sent(status: Optional[str] = None, current_user=Depends(get_current_user)):
    current_user = await _require_user(current_user)
    school_id = current_user["school_id"]
    teacher_id = current_user["id"]
    q = {"school_id": school_id, "author_id": teacher_id}
    if status and status in STATUSES:
        q["status"] = status
    docs = await db.teacher_observations.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"observations": [await _enrich_observation(d) for d in docs]}


@router.get("/teacher/observations/{obs_id}")
async def get_observation(obs_id: str, current_user=Depends(get_current_user)):
    current_user = await _require_user(current_user)
    obs = await db.teacher_observations.find_one(
        {"id": obs_id, "school_id": current_user["school_id"]},
        {"_id": 0}
    )
    if not obs:
        raise HTTPException(404, "Observación no encontrada")
    # Solo autor, tutor receptor o staff (owner/admin/director) pueden verla
    role = current_user.get("role")
    is_party = current_user["id"] in {obs.get("author_id"), obs.get("recipient_tutor_id")}
    is_staff = role in {"owner", "admin", "director", "coordinator"}
    if not (is_party or is_staff):
        raise HTTPException(403, "No tienes acceso a esta observación")
    # Marcar como leída
    now_iso = datetime.now(timezone.utc).isoformat()
    is_tutor_recipient = current_user["id"] == obs.get("recipient_tutor_id")
    is_author = current_user["id"] == obs.get("author_id")
    if is_tutor_recipient and not obs.get("read_by_tutor_at"):
        await db.teacher_observations.update_one(
            {"id": obs_id},
            {"$set": {"read_by_tutor_at": now_iso}}
        )
        obs["read_by_tutor_at"] = now_iso
    if is_author and not obs.get("read_by_author_at"):
        await db.teacher_observations.update_one(
            {"id": obs_id},
            {"$set": {"read_by_author_at": now_iso}}
        )
        obs["read_by_author_at"] = now_iso
    return await _enrich_observation(obs)


@router.post("/teacher/observations/{obs_id}/reply")
async def reply_observation(obs_id: str, payload: ReplyIn, current_user=Depends(get_current_user)):
    current_user = await _require_user(current_user)
    obs = await db.teacher_observations.find_one({"id": obs_id, "school_id": current_user["school_id"]}, {"_id": 0})
    if not obs:
        raise HTTPException(404, "Observación no encontrada")
    if current_user["id"] not in {obs.get("author_id"), obs.get("recipient_tutor_id")}:
        raise HTTPException(403, "No participas en este hilo")
    if obs.get("status") == "cerrada":
        raise HTTPException(409, "El hilo está cerrado. Reábrelo desde el inbox del tutor para continuar.")
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(400, "El mensaje no puede estar vacío")
    now = datetime.now(timezone.utc).isoformat()
    entry = {"id": str(uuid.uuid4()), "author_id": current_user["id"], "text": text[:2000], "ts": now}
    # Cuando uno responde, el OTRO debe ver "no leído" hasta abrir el hilo.
    is_author = current_user["id"] == obs.get("author_id")
    unset_field = "read_by_tutor_at" if is_author else "read_by_author_at"
    await db.teacher_observations.update_one(
        {"id": obs_id},
        {"$push": {"thread": entry}, "$set": {"updated_at": now, unset_field: None}}
    )
    updated = await db.teacher_observations.find_one({"id": obs_id}, {"_id": 0})
    return await _enrich_observation(updated)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints — Tutor (receptor)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/tutor/observations")
async def tutor_inbox(
    section_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    current_user = await _require_user(current_user)
    school_id = current_user["school_id"]
    q = {"school_id": school_id, "recipient_tutor_id": current_user["id"]}
    if section_id:
        q["section_id"] = section_id
    if status and status in STATUSES:
        q["status"] = status
    if severity and severity in SEVERITIES:
        q["severity"] = severity
    docs = await db.teacher_observations.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = [await _enrich_observation(d) for d in docs]
    # Counts por estado para badges
    counts = {
        "total": len(docs),
        "abierta": sum(1 for d in docs if d.get("status") == "abierta"),
        "en_seguimiento": sum(1 for d in docs if d.get("status") == "en_seguimiento"),
        "cerrada": sum(1 for d in docs if d.get("status") == "cerrada"),
        "unread": sum(1 for d in docs if not d.get("read_by_tutor_at")),
    }
    return {"observations": out, "counts": counts}


@router.patch("/tutor/observations/{obs_id}/status")
async def change_status(obs_id: str, payload: StatusIn, current_user=Depends(get_current_user)):
    current_user = await _require_user(current_user)
    obs = await db.teacher_observations.find_one({"id": obs_id, "school_id": current_user["school_id"]}, {"_id": 0})
    if not obs:
        raise HTTPException(404, "Observación no encontrada")
    if obs.get("recipient_tutor_id") != current_user["id"]:
        raise HTTPException(403, "Solo el tutor receptor puede cambiar el estado")
    now = datetime.now(timezone.utc).isoformat()
    update = {"status": payload.status, "updated_at": now}
    if payload.status == "cerrada":
        update["closed_at"] = now
        update["closed_by"] = current_user["id"]
    else:
        # Reabrir
        update["closed_at"] = None
        update["closed_by"] = None
    await db.teacher_observations.update_one({"id": obs_id}, {"$set": update})
    updated = await db.teacher_observations.find_one({"id": obs_id}, {"_id": 0})
    return await _enrich_observation(updated)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint — Historial por alumno (admin / tutor de la sección actual)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/students/{student_id}/observations")
async def history_by_student(student_id: str, current_user=Depends(get_current_user)):
    current_user = await _require_user(current_user)
    school_id = current_user["school_id"]
    role = current_user.get("role")

    student = await db.users.find_one(
        {"id": student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "seccion_id": 1}
    )
    if not student:
        raise HTTPException(404, "Alumno no encontrado")

    # Permisos: staff o tutor activo de la sección o autor de alguna obs sobre este alumno
    is_staff = role in {"owner", "admin", "director", "coordinator"}
    is_tutor_here = False
    if not is_staff:
        if student.get("seccion_id"):
            tutor = await _resolve_tutor_for_section(school_id, student["seccion_id"])
            is_tutor_here = tutor and tutor["id"] == current_user["id"]
    if not (is_staff or is_tutor_here):
        raise HTTPException(403, "Sin permisos para ver el historial de este alumno")

    docs = await db.teacher_observations.find(
        {"school_id": school_id, "student_id": student_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"observations": [await _enrich_observation(d) for d in docs]}
