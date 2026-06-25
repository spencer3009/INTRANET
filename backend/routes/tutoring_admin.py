# -*- coding: utf-8 -*-
"""
Tutoring Admin — Endpoints de gobernanza de tutorías.

Endpoints:
    GET  /api/admin/tutoring-overview         — Matriz consolidada (admin)
    GET  /api/teachers/{teacher_id}/tutorings — Tutorías de un profesor (admin)
    POST /api/admin/tutorings/transfer        — Reasignación masiva (admin)
    GET  /api/mis-tutorias/sections/{section_id}/consolidated
                                              — Consolidado scoped al salón del tutor
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging

from .core import db, get_current_user, resolve_user_from_token, has_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

ADMIN_ASSIGN_ROLES = ["owner", "admin", "director"]


async def _require_user(current_user):
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no autenticado")
    return user


async def _require_admin(current_user):
    user = await _require_user(current_user)
    if not has_role(user, ADMIN_ASSIGN_ROLES):
        raise HTTPException(status_code=403, detail="Requiere rol owner/admin/director")
    return user


def _fmt_full_name(u: dict) -> str:
    return f"{(u.get('last_name') or '').strip()} {(u.get('name') or u.get('first_name') or '').strip()}".strip()


# ════════════════════════════════════════════════════════════════════════════
# 1) GET /api/admin/tutoring-overview — Matriz consolidada
# ════════════════════════════════════════════════════════════════════════════
@router.get("/admin/tutoring-overview")
async def tutoring_overview(
    period_id: Optional[str] = Query(None, description="Bimestre activo para calcular % avance"),
    current_user=Depends(get_current_user),
):
    user = await _require_admin(current_user)
    school_id = user["school_id"]

    # 1) Cargar todas las secciones del colegio
    sections = await db.sections.find(
        {"school_id": school_id, "activo": {"$ne": False}},
        {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1, "student_count": 1},
    ).to_list(500)

    # 2) Cargar grados (con su nivel_id y nombre) y niveles
    grade_ids = list({s.get("grado_id") for s in sections if s.get("grado_id")})
    grades = {g["id"]: g async for g in db.grades.find({"id": {"$in": grade_ids}}, {"_id": 0})}
    level_ids = list({g.get("nivel_id") for g in grades.values() if g.get("nivel_id")})
    levels = {lv["id"]: lv async for lv in db.academic_levels.find({"id": {"$in": level_ids}}, {"_id": 0})}

    # 3) Cargar tutores activos en bulk
    section_ids = [s["id"] for s in sections]
    tutor_assigns = await db.academic_assignments.find(
        {
            "school_id": school_id,
            "section_id": {"$in": section_ids},
            "role": "tutor",
            "status": "activo",
        },
        {"_id": 0, "section_id": 1, "teacher_id": 1},
    ).to_list(1000)
    tutor_by_section = {a["section_id"]: a["teacher_id"] for a in tutor_assigns}

    # 4) Cargar info de los tutores
    teacher_ids = list({a["teacher_id"] for a in tutor_assigns})
    teachers = {
        t["id"]: t async for t in db.users.find(
            {"id": {"$in": teacher_ids}}, {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1}
        )
    }

    # 5) Conteo de estudiantes por sección (real, no el campo cacheado)
    pipe = [
        {"$match": {"school_id": school_id, "role": "student", "seccion_id": {"$in": section_ids}, "is_disabled": {"$ne": True}}},
        {"$group": {"_id": "$seccion_id", "count": {"$sum": 1}}},
    ]
    student_counts = {row["_id"]: row["count"] async for row in db.users.aggregate(pipe)}

    # 6) Si nos pasaron period_id, calcular avance de comentarios + conducta
    comments_pct = {}
    conduct_pct = {}
    if period_id:
        # comentarios
        comments_docs = await db.tutor_comments.find(
            {"school_id": school_id, "period_id": period_id},
            {"_id": 0, "student_id": 1, "comment": 1},
        ).to_list(5000)
        students_with_comment = {c["student_id"] for c in comments_docs if (c.get("comment") or "").strip()}

        conduct_docs = await db.conduct_grades.find(
            {"school_id": school_id, "period_id": period_id},
            {"_id": 0, "student_id": 1, "letra": 1},
        ).to_list(5000)
        students_with_conduct = {c["student_id"] for c in conduct_docs if c.get("letra")}

        # Por sección: cuántos alumnos tienen comentario / conducta
        students_in_section: dict = {}
        async for st in db.users.find(
            {"school_id": school_id, "role": "student", "seccion_id": {"$in": section_ids}, "is_disabled": {"$ne": True}},
            {"_id": 0, "id": 1, "seccion_id": 1},
        ):
            sid = st.get("seccion_id")
            students_in_section.setdefault(sid, []).append(st["id"])

        for sid, ids in students_in_section.items():
            total = len(ids) or 1
            comments_pct[sid] = round(100 * sum(1 for x in ids if x in students_with_comment) / total)
            conduct_pct[sid] = round(100 * sum(1 for x in ids if x in students_with_conduct) / total)

    # 7) Armar filas de la matriz
    rows = []
    sin_tutor = 0
    for s in sections:
        sid = s["id"]
        gid = s.get("grado_id")
        g = grades.get(gid) or {}
        lvl_id = g.get("nivel_id")
        lv = levels.get(lvl_id) or {}
        teacher_id = tutor_by_section.get(sid)
        teacher = teachers.get(teacher_id) if teacher_id else None

        if not teacher_id:
            sin_tutor += 1

        rows.append({
            "section_id": sid,
            "section_name": s.get("nombre"),
            "grade_id": gid,
            "grade_name": g.get("nombre") or g.get("name"),
            "grade_order": g.get("orden") or g.get("order") or 0,
            "level_id": lvl_id,
            "level_name": lv.get("nombre") or lv.get("name"),
            "level_order": lv.get("orden") or lv.get("order") or 0,
            "tutor_id": teacher_id,
            "tutor_name": _fmt_full_name(teacher) if teacher else None,
            "student_count": student_counts.get(sid, s.get("student_count", 0)),
            "comments_pct": comments_pct.get(sid),
            "conduct_pct": conduct_pct.get(sid),
        })

    rows.sort(key=lambda r: (r["level_order"], r["grade_order"], r["section_name"] or ""))

    # 8) Lista de tutores únicos (para filtros del frontend)
    unique_tutors = sorted(
        [{"id": t["id"], "name": _fmt_full_name(t), "section_count": sum(1 for r in rows if r["tutor_id"] == t["id"])}
         for t in teachers.values()],
        key=lambda x: x["name"],
    )

    return {
        "rows": rows,
        "summary": {
            "total_sections": len(rows),
            "with_tutor": len(rows) - sin_tutor,
            "without_tutor": sin_tutor,
            "unique_tutors": len(unique_tutors),
        },
        "tutors": unique_tutors,
    }


# ════════════════════════════════════════════════════════════════════════════
# 2) GET /api/teachers/{teacher_id}/tutorings — Tutorías de un profesor
# ════════════════════════════════════════════════════════════════════════════
@router.get("/teachers/{teacher_id}/tutorings")
async def teacher_tutorings(
    teacher_id: str,
    current_user=Depends(get_current_user),
):
    user = await _require_admin(current_user)
    school_id = user["school_id"]

    teacher = await db.users.find_one(
        {"id": teacher_id, "school_id": school_id, "role": "teacher"},
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1},
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")

    assigns = await db.academic_assignments.find(
        {
            "school_id": school_id,
            "teacher_id": teacher_id,
            "role": "tutor",
            "status": "activo",
        },
        {"_id": 0, "section_id": 1, "created_at": 1},
    ).to_list(50)

    if not assigns:
        return {"teacher": {"id": teacher_id, "name": _fmt_full_name(teacher)}, "sections": []}

    section_ids = [a["section_id"] for a in assigns]
    sections = await db.sections.find(
        {"id": {"$in": section_ids}, "school_id": school_id},
        {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1, "student_count": 1},
    ).to_list(50)

    grade_ids = list({s.get("grado_id") for s in sections if s.get("grado_id")})
    grades = {g["id"]: g async for g in db.grades.find({"id": {"$in": grade_ids}}, {"_id": 0})}
    level_ids = list({g.get("nivel_id") for g in grades.values() if g.get("nivel_id")})
    levels = {lv["id"]: lv async for lv in db.academic_levels.find({"id": {"$in": level_ids}}, {"_id": 0})}

    # student counts
    pipe = [
        {"$match": {"school_id": school_id, "role": "student", "seccion_id": {"$in": section_ids}, "is_disabled": {"$ne": True}}},
        {"$group": {"_id": "$seccion_id", "count": {"$sum": 1}}},
    ]
    counts = {row["_id"]: row["count"] async for row in db.users.aggregate(pipe)}

    out = []
    for s in sections:
        g = grades.get(s.get("grado_id")) or {}
        lv = levels.get(g.get("nivel_id")) or {}
        out.append({
            "section_id": s["id"],
            "section_name": s.get("nombre"),
            "grade_name": g.get("nombre") or g.get("name"),
            "grade_order": g.get("orden") or g.get("order") or 0,
            "level_name": lv.get("nombre") or lv.get("name"),
            "level_order": lv.get("orden") or lv.get("order") or 0,
            "student_count": counts.get(s["id"], s.get("student_count", 0)),
        })
    out.sort(key=lambda x: (x["level_order"], x["grade_order"], x["section_name"] or ""))

    return {
        "teacher": {"id": teacher_id, "name": _fmt_full_name(teacher)},
        "sections": out,
    }


# ════════════════════════════════════════════════════════════════════════════
# 3) POST /api/admin/tutorings/transfer — Reasignación masiva
# ════════════════════════════════════════════════════════════════════════════
class TutoringTransferBody(BaseModel):
    section_ids: List[str]
    new_teacher_id: Optional[str] = None  # None = quitar tutor


@router.post("/admin/tutorings/transfer")
async def tutoring_transfer(
    body: TutoringTransferBody,
    current_user=Depends(get_current_user),
):
    user = await _require_admin(current_user)
    school_id = user["school_id"]

    if not body.section_ids:
        raise HTTPException(status_code=400, detail="Debes indicar al menos una sección")

    # Validar que las secciones pertenecen al colegio
    sections = await db.sections.find(
        {"id": {"$in": body.section_ids}, "school_id": school_id},
        {"_id": 0, "id": 1},
    ).to_list(500)
    valid_ids = {s["id"] for s in sections}
    if len(valid_ids) != len(body.section_ids):
        raise HTTPException(status_code=400, detail="Algunas secciones no existen o pertenecen a otro colegio")

    now = datetime.now(timezone.utc).isoformat()

    # Validar nuevo tutor si se pasa
    if body.new_teacher_id:
        teacher = await db.users.find_one(
            {"id": body.new_teacher_id, "school_id": school_id, "role": "teacher"},
            {"_id": 0, "id": 1},
        )
        if not teacher:
            raise HTTPException(status_code=400, detail="El profesor destino no existe o no pertenece al colegio")

    # Desactivar tutores activos previos en las secciones objetivo
    deact = await db.academic_assignments.update_many(
        {
            "school_id": school_id,
            "section_id": {"$in": list(valid_ids)},
            "role": "tutor",
            "status": "activo",
        },
        {"$set": {"status": "inactivo", "updated_at": now}},
    )

    inserted = 0
    if body.new_teacher_id:
        new_docs = [{
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "section_id": sid,
            "teacher_id": body.new_teacher_id,
            "role": "tutor",
            "status": "activo",
            "assigned_by": user["id"],
            "created_at": now,
            "updated_at": now,
        } for sid in valid_ids]
        if new_docs:
            await db.academic_assignments.insert_many(new_docs)
            inserted = len(new_docs)

    return {
        "message": "Reasignación completada" if body.new_teacher_id else "Tutorías quitadas",
        "deactivated": deact.modified_count,
        "assigned": inserted,
    }


# ════════════════════════════════════════════════════════════════════════════
# 4) GET /api/mis-tutorias/sections/{section_id}/consolidated
#    Consolidado scoped al salón que el tutor gestiona (read-only)
# ════════════════════════════════════════════════════════════════════════════
async def _is_tutor_of(school_id: str, teacher_id: str, section_id: str) -> bool:
    a = await db.academic_assignments.find_one(
        {
            "school_id": school_id,
            "section_id": section_id,
            "teacher_id": teacher_id,
            "role": "tutor",
            "status": "activo",
        },
        {"_id": 0, "id": 1},
    )
    return a is not None


@router.get("/mis-tutorias/sections/{section_id}/consolidated")
async def tutor_section_consolidated(
    section_id: str,
    period_id: str = Query(..., description="Bimestre obligatorio"),
    current_user=Depends(get_current_user),
):
    """Devuelve el consolidado de la sección para el tutor (lectura).

    Permisos:
    - owner/admin/director: siempre
    - teacher: solo si es tutor activo de la sección
    - otros roles: 403
    """
    user = await _require_user(current_user)
    school_id = user["school_id"]

    role = user.get("role")
    if role in ADMIN_ASSIGN_ROLES + ["coordinator"]:
        pass
    elif role == "teacher":
        if not await _is_tutor_of(school_id, user["id"], section_id):
            raise HTTPException(status_code=403, detail="No eres tutor activo de esta sección")
    else:
        raise HTTPException(status_code=403, detail="Acceso no autorizado")

    # Delegamos al endpoint canónico de grades.py (reutiliza toda su lógica
    # de agrupación por área, conducta, asistencia, etc.).
    from .grades import get_consolidated
    return await get_consolidated(section_id, period_id, current_user)
