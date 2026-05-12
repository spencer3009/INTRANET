# -*- coding: utf-8 -*-
"""
Conducta MINEDU — Fase 2 Turno B

Colección: `conduct_grades`
Índice único: (school_id, student_id, period_id)

Reglas:
- Letra ∈ {AD, A, B, C}
- score_numeric ∈ [0, 20] opcional
- Si vienen ambos, deben ser consistentes con escala MINEDU:
    0-10 → C   |   11-13 → B   |   14-17 → A   |   18-20 → AD
- Si solo viene score_numeric → letra se calcula automáticamente
- Si solo viene letra → score_numeric queda null
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from .core import (
    db, get_current_user, resolve_user_from_token,
    has_role, ADMIN_ROLES,
)
from services.grades_literal import numerica_a_letra

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

VALID_LETRAS = {"AD", "A", "B", "C"}


# ════════════════════════════════════════════════════════════════════════════
# MODELS
# ════════════════════════════════════════════════════════════════════════════

class ConductUpsert(BaseModel):
    student_id: str
    period_id: str
    letra: Optional[str] = None
    score_numeric: Optional[float] = Field(default=None, ge=0, le=20)
    observation: Optional[str] = None


# ════════════════════════════════════════════════════════════════════════════
# HELPERS
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


async def _teaches_in_section(user: dict, section_id: str) -> bool:
    a = await db.academic_assignments.find_one(
        {
            "school_id": user["school_id"],
            "section_id": section_id,
            "teacher_id": user["id"],
            "status": "activo",
        }, {"_id": 0, "id": 1},
    )
    return a is not None


async def _get_student_for_access(user: dict, student_id: str) -> dict:
    """Carga el estudiante validando que pertenece al mismo colegio."""
    s = await db.users.find_one(
        {"id": student_id, "role": "student"},
        {"_id": 0, "id": 1, "school_id": 1, "seccion_id": 1, "section_id": 1, "padre_id": 1},
    )
    if not s:
        raise HTTPException(status_code=404, detail="No se encontró al estudiante")
    if s.get("school_id") != user["school_id"]:
        raise HTTPException(status_code=403, detail="El estudiante no pertenece a tu colegio")
    return s


async def _can_read_conduct(user: dict, student: dict) -> bool:
    role = user.get("role")
    if role in ADMIN_ROLES:
        return True
    if role == "student":
        return user["id"] == student["id"]
    if role == "parent":
        return student.get("padre_id") == user["id"]
    if role == "teacher":
        section_id = student.get("seccion_id") or student.get("section_id")
        if not section_id:
            return False
        return await _teaches_in_section(user, section_id)
    return False


async def _can_write_conduct(user: dict, student: dict) -> bool:
    role = user.get("role")
    if role in ADMIN_ROLES:
        return True
    if role == "teacher":
        section_id = student.get("seccion_id") or student.get("section_id")
        if not section_id:
            return False
        return await _is_tutor(user, section_id)
    return False


def _validate_letra_score(letra: Optional[str], score: Optional[float]) -> str:
    """Valida y devuelve la letra final a almacenar. Lanza 400 si inconsistente."""
    if letra is not None and letra not in VALID_LETRAS:
        raise HTTPException(status_code=400, detail=f"Letra inválida: {letra}. Debe ser AD/A/B/C.")
    if score is not None:
        computed = numerica_a_letra(score)
        if letra is not None and letra != computed:
            raise HTTPException(
                status_code=400,
                detail=f"Inconsistencia: score={score} corresponde a '{computed}', pero se envió '{letra}'.",
            )
        return computed  # tipo: ignore[return-value]
    if letra is None:
        raise HTTPException(status_code=400, detail="Debes enviar 'letra' o 'score_numeric'.")
    return letra


def _project(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/conduct/section/{section_id}")
async def list_conduct_by_section(
    section_id: str,
    period_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    role = user.get("role")
    # Permisos lectura sección completa
    allowed = role in ADMIN_ROLES
    if not allowed and role == "teacher":
        allowed = await _teaches_in_section(user, section_id)
    if not allowed:
        raise HTTPException(status_code=403, detail="Sin permiso para leer conducta de la sección")

    docs = await db.conduct_grades.find(
        {
            "school_id": user["school_id"],
            "section_id": section_id,
            "period_id": period_id,
        }, {"_id": 0},
    ).to_list(500)
    return {"items": docs}


@router.get("/conduct/{student_id}")
async def get_conduct_for_student(
    student_id: str,
    period_id: Optional[str] = Query(default=None),
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    student = await _get_student_for_access(user, student_id)
    if not await _can_read_conduct(user, student):
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar esta acción")

    query: dict = {"school_id": user["school_id"], "student_id": student_id}
    if period_id:
        query["period_id"] = period_id
        doc = await db.conduct_grades.find_one(query, {"_id": 0})
        return {"conduct": doc}  # None si no existe
    items = await db.conduct_grades.find(query, {"_id": 0}).to_list(20)
    return {"items": items}


@router.put("/conduct")
async def upsert_conduct(
    body: ConductUpsert,
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    student = await _get_student_for_access(user, body.student_id)
    if not await _can_write_conduct(user, student):
        raise HTTPException(status_code=403, detail="Solo el tutor o el administrador pueden calificar la conducta")

    # Validar period_id existe en el colegio
    period = await db.academic_periods.find_one(
        {"id": body.period_id, "school_id": user["school_id"]}, {"_id": 0, "id": 1}
    )
    if not period:
        raise HTTPException(status_code=404, detail="No se encontró el bimestre indicado")

    final_letra = _validate_letra_score(body.letra, body.score_numeric)
    now = datetime.now(timezone.utc).isoformat()
    section_id = student.get("seccion_id") or student.get("section_id")

    # Bloqueo si el bimestre ya está cerrado (snapshot existe)
    from .libreta import is_period_closed  # import diferido para evitar ciclo
    if await is_period_closed(user["school_id"], body.student_id, body.period_id):
        raise HTTPException(
            status_code=423,
            detail="Este bimestre ya está cerrado. Para modificar la conducta, solicita al propietario la reapertura del bimestre.",
        )

    existing = await db.conduct_grades.find_one(
        {
            "school_id": user["school_id"],
            "student_id": body.student_id,
            "period_id": body.period_id,
        }, {"_id": 0},
    )

    update_doc = {
        "letra": final_letra,
        "score_numeric": body.score_numeric,
        "observation": body.observation,
        "updated_by": user["id"],
        "updated_at": now,
        "section_id": section_id,
    }

    if existing:
        await db.conduct_grades.update_one(
            {"id": existing["id"]}, {"$set": update_doc}
        )
        doc = await db.conduct_grades.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        new = {
            "id": str(uuid.uuid4()),
            "school_id": user["school_id"],
            "section_id": section_id,
            "student_id": body.student_id,
            "period_id": body.period_id,
            "created_by": user["id"],
            "created_at": now,
            **update_doc,
        }
        await db.conduct_grades.insert_one(new)
        doc = _project(new)

    return {"conduct": doc}


@router.delete("/conduct/{conduct_id}", status_code=204)
async def delete_conduct(
    conduct_id: str,
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    doc = await db.conduct_grades.find_one(
        {"id": conduct_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Registro de conducta no encontrado")
    student = await _get_student_for_access(user, doc["student_id"])
    if not await _can_write_conduct(user, student):
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar esta acción")
    await db.conduct_grades.delete_one({"id": conduct_id})
    return None


# ════════════════════════════════════════════════════════════════════════════
# HELPER PÚBLICO (usado por routes/libreta.py)
# ════════════════════════════════════════════════════════════════════════════

async def get_conduct_payload_for_libreta(
    school_id: str, student_id: str, period_ids: List[str]
) -> dict:
    """Devuelve {period_id: {letra, score_numeric, observation} | None}."""
    docs = await db.conduct_grades.find(
        {
            "school_id": school_id,
            "student_id": student_id,
            "period_id": {"$in": period_ids},
        }, {"_id": 0, "period_id": 1, "letra": 1, "score_numeric": 1, "observation": 1},
    ).to_list(20)
    by_period = {d["period_id"]: {
        "letra": d.get("letra"),
        "score_numeric": d.get("score_numeric"),
        "observation": d.get("observation"),
    } for d in docs}
    return {pid: by_period.get(pid) for pid in period_ids}


# ════════════════════════════════════════════════════════════════════════════
# INDEX
# ════════════════════════════════════════════════════════════════════════════

async def ensure_conduct_indexes():
    try:
        await db.conduct_grades.create_index(
            [("school_id", 1), ("student_id", 1), ("period_id", 1)],
            unique=True, name="uniq_conduct_student_period",
        )
    except Exception as e:
        logger.warning(f"[conduct] index creation: {e}")
