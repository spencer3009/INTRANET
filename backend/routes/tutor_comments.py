# -*- coding: utf-8 -*-
"""
Comentarios del Tutor por bimestre — Fase 2 Turno B

Colección: `tutor_comments`
Índice único: (school_id, student_id, period_id)
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from .core import (
    db, get_current_user, resolve_user_from_token,
    ADMIN_ROLES,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


# ════════════════════════════════════════════════════════════════════════════
# MODELS
# ════════════════════════════════════════════════════════════════════════════

class TutorCommentUpsert(BaseModel):
    student_id: str
    period_id: str
    comment: str  # "" → borrar


# ════════════════════════════════════════════════════════════════════════════
# HELPERS (idénticos en intención a conduct.py)
# ════════════════════════════════════════════════════════════════════════════

async def _require_user(current_user):
    u = await resolve_user_from_token(current_user)
    if not u or not u.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no autenticado")
    return u


async def _is_tutor(user: dict, section_id: str) -> bool:
    a = await db.academic_assignments.find_one(
        {
            "school_id": user["school_id"],
            "section_id": section_id,
            "role": "tutor",
            "status": "activo",
            "teacher_id": user["id"],
        }, {"_id": 0, "id": 1},
    )
    return a is not None


async def _get_student(user: dict, student_id: str) -> dict:
    s = await db.users.find_one(
        {"id": student_id, "role": "student"},
        {"_id": 0, "id": 1, "school_id": 1, "seccion_id": 1, "section_id": 1, "padre_id": 1},
    )
    if not s:
        raise HTTPException(status_code=404, detail="No se encontró al estudiante")
    if s.get("school_id") != user["school_id"]:
        raise HTTPException(status_code=403, detail="El estudiante no pertenece a tu colegio")
    return s


async def _can_read(user: dict, student: dict) -> bool:
    role = user.get("role")
    if role in ADMIN_ROLES:
        return True
    if role == "student":
        return user["id"] == student["id"]
    if role == "parent":
        return student.get("padre_id") == user["id"]
    if role == "teacher":
        # SOLO el tutor lee. Profesor no-tutor: SIN acceso (regla del prompt).
        section_id = student.get("seccion_id") or student.get("section_id")
        if not section_id:
            return False
        return await _is_tutor(user, section_id)
    return False


async def _can_write(user: dict, student: dict) -> bool:
    role = user.get("role")
    if role in ADMIN_ROLES:
        return True
    if role == "teacher":
        section_id = student.get("seccion_id") or student.get("section_id")
        if not section_id:
            return False
        return await _is_tutor(user, section_id)
    return False


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/tutor-comments/{student_id}")
async def get_comments(
    student_id: str,
    period_id: Optional[str] = Query(default=None),
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    student = await _get_student(user, student_id)
    if not await _can_read(user, student):
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar esta acción")

    q = {"school_id": user["school_id"], "student_id": student_id}
    if period_id:
        q["period_id"] = period_id
        doc = await db.tutor_comments.find_one(q, {"_id": 0})
        return {"comment": doc}
    items = await db.tutor_comments.find(q, {"_id": 0}).to_list(20)
    return {"items": items}


@router.put("/tutor-comments")
async def upsert_comment(
    body: TutorCommentUpsert,
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    student = await _get_student(user, body.student_id)
    if not await _can_write(user, student):
        raise HTTPException(status_code=403, detail="Solo el tutor o el administrador pueden escribir comentarios")

    period = await db.academic_periods.find_one(
        {"id": body.period_id, "school_id": user["school_id"]}, {"_id": 0, "id": 1}
    )
    if not period:
        raise HTTPException(status_code=404, detail="No se encontró el bimestre indicado")

    comment_clean = (body.comment or "").strip()
    now = datetime.now(timezone.utc).isoformat()
    section_id = student.get("seccion_id") or student.get("section_id")

    # Bloqueo si el bimestre ya está cerrado
    from .libreta import is_period_closed
    if await is_period_closed(user["school_id"], body.student_id, body.period_id):
        raise HTTPException(
            status_code=423,
            detail="Este bimestre ya está cerrado. Para modificar el comentario, solicita al propietario la reapertura del bimestre.",
        )

    # Caso "" → borrar
    if not comment_clean:
        await db.tutor_comments.delete_many(
            {
                "school_id": user["school_id"],
                "student_id": body.student_id,
                "period_id": body.period_id,
            }
        )
        return {"comment": None, "deleted": True}

    existing = await db.tutor_comments.find_one(
        {
            "school_id": user["school_id"],
            "student_id": body.student_id,
            "period_id": body.period_id,
        }, {"_id": 0},
    )
    if existing:
        await db.tutor_comments.update_one(
            {"id": existing["id"]},
            {"$set": {
                "comment": comment_clean,
                "updated_by": user["id"],
                "updated_at": now,
                "section_id": section_id,
            }},
        )
        doc = await db.tutor_comments.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        new = {
            "id": str(uuid.uuid4()),
            "school_id": user["school_id"],
            "section_id": section_id,
            "student_id": body.student_id,
            "period_id": body.period_id,
            "comment": comment_clean,
            "created_by": user["id"],
            "created_at": now,
            "updated_by": user["id"],
            "updated_at": now,
        }
        await db.tutor_comments.insert_one(new)
        new.pop("_id", None)
        doc = new
    return {"comment": doc}


@router.delete("/tutor-comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: str,
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    doc = await db.tutor_comments.find_one(
        {"id": comment_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    student = await _get_student(user, doc["student_id"])
    if not await _can_write(user, student):
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar esta acción")
    await db.tutor_comments.delete_one({"id": comment_id})
    return None


# ════════════════════════════════════════════════════════════════════════════
# HELPER PÚBLICO (usado por routes/libreta.py)
# ════════════════════════════════════════════════════════════════════════════

async def get_comments_payload_for_libreta(
    school_id: str, student_id: str, period_ids: List[str]
) -> dict:
    docs = await db.tutor_comments.find(
        {
            "school_id": school_id,
            "student_id": student_id,
            "period_id": {"$in": period_ids},
        }, {"_id": 0, "period_id": 1, "comment": 1},
    ).to_list(20)
    by_period = {d["period_id"]: d.get("comment") for d in docs}
    return {pid: by_period.get(pid) for pid in period_ids}


async def ensure_tutor_comments_indexes():
    try:
        await db.tutor_comments.create_index(
            [("school_id", 1), ("student_id", 1), ("period_id", 1)],
            unique=True, name="uniq_tutor_comment_student_period",
        )
    except Exception as e:
        logger.warning(f"[tutor_comments] index creation: {e}")


# ════════════════════════════════════════════════════════════════════════════
# "Mis Tutorías" — bulk endpoints (Fase 3 Turno F3 — UX tutor)
# ════════════════════════════════════════════════════════════════════════════

@router.get("/mis-tutorias/sections")
async def list_my_tutor_sections(current_user=Depends(get_current_user)):
    """Devuelve las secciones donde el usuario actual es tutor activo + admins ven todas."""
    user = await _require_user(current_user)
    school_id = user["school_id"]

    if user.get("role") in ADMIN_ROLES:
        # Admin/owner: todas las secciones del colegio
        sections = await db.sections.find({"school_id": school_id}, {"_id": 0}).to_list(500)
    else:
        # Solo donde sea tutor activo
        asg = await db.academic_assignments.find(
            {"school_id": school_id, "teacher_id": user["id"], "role": "tutor", "status": "activo"},
            {"_id": 0, "section_id": 1},
        ).to_list(200)
        sec_ids = list({a["section_id"] for a in asg if a.get("section_id")})
        if not sec_ids:
            return {"sections": []}
        sections = await db.sections.find({"id": {"$in": sec_ids}}, {"_id": 0}).to_list(500)

    # Enriquecer con grado + nivel + count alumnos
    grade_ids = list({s.get("grado_id") for s in sections if s.get("grado_id")})
    grades = await db.grades.find({"id": {"$in": grade_ids}}, {"_id": 0}).to_list(500) if grade_ids else []
    grades_map = {g["id"]: g for g in grades}
    level_ids = list({g.get("nivel_id") for g in grades if g.get("nivel_id")})
    levels = await db.academic_levels.find({"id": {"$in": level_ids}}, {"_id": 0}).to_list(500) if level_ids else []
    levels_map = {n["id"]: n for n in levels}

    result = []
    for s in sections:
        g = grades_map.get(s.get("grado_id"))
        n = levels_map.get(g.get("nivel_id")) if g else None
        count = await db.users.count_documents({
            "school_id": school_id,
            "role": "student",
            "$or": [{"seccion_id": s["id"]}, {"section_id": s["id"]}],
        })
        result.append({
            "section_id": s["id"],
            "nombre": s.get("nombre"),
            "grado_nombre": g.get("nombre") if g else None,
            "nivel_nombre": n.get("nombre") if n else None,
            "student_count": count,
        })

    NIVEL_ORDER = {"INICIAL": 1, "PRIMARIA": 2, "SECUNDARIA": 3}
    def _key(x):
        nv = NIVEL_ORDER.get((x.get("nivel_nombre") or "").upper(), 99)
        return (nv, x.get("grado_nombre") or "", x.get("nombre") or "")
    result.sort(key=_key)
    return {"sections": result}


@router.get("/mis-tutorias/bulk")
async def bulk_tutor_comments(
    section_id: str = Query(...),
    period_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    """Devuelve alumnos + comentarios + estado de cierre para una sección + bimestre."""
    user = await _require_user(current_user)
    school_id = user["school_id"]

    # Permisos: admin OR tutor activo de la sección
    if user.get("role") not in ADMIN_ROLES and not await _is_tutor(user, section_id):
        raise HTTPException(status_code=403, detail="Solo el tutor o el administrador pueden ver este listado")

    # Periodo
    period = await db.academic_periods.find_one(
        {"id": period_id, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "activo": 1, "orden": 1},
    )
    if not period:
        raise HTTPException(status_code=404, detail="No se encontró el bimestre indicado")

    # Alumnos de la sección
    students = await db.users.find(
        {
            "school_id": school_id,
            "role": "student",
            "$or": [{"seccion_id": section_id}, {"section_id": section_id}],
        },
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "student_code": 1, "codigo": 1},
    ).to_list(500)
    students.sort(key=lambda s: ((s.get("last_name") or "").upper(), (s.get("first_name") or "").upper()))
    student_ids = [s["id"] for s in students]

    # Comentarios existentes
    comments_docs = await db.tutor_comments.find(
        {"school_id": school_id, "student_id": {"$in": student_ids}, "period_id": period_id},
        {"_id": 0, "student_id": 1, "comment": 1},
    ).to_list(500)
    comments_map = {c["student_id"]: c.get("comment", "") for c in comments_docs}

    # Bimestre cerrado por alumno (snapshots)
    closed_docs = await db.report_cards_snapshots.find(
        {"school_id": school_id, "student_id": {"$in": student_ids}, "period_id": period_id},
        {"_id": 0, "student_id": 1},
    ).to_list(500)
    closed_set = {c["student_id"] for c in closed_docs}

    rows = []
    for idx, s in enumerate(students, start=1):
        full_name = f"{(s.get('last_name') or '').strip()}, {(s.get('first_name') or '').strip()}".strip(", ")
        rows.append({
            "number": idx,
            "student_id": s["id"],
            "student_name": full_name,
            "student_code": s.get("student_code") or s.get("codigo"),
            "comment": comments_map.get(s["id"], ""),
            "is_closed": s["id"] in closed_set,
        })

    return {
        "period": {"id": period["id"], "nombre": period.get("nombre"), "activo": period.get("activo"), "orden": period.get("orden")},
        "students": rows,
        "total_students": len(rows),
        "closed_count": len(closed_set),
    }
