# -*- coding: utf-8 -*-
"""
Situación Final del Estudiante — Fase 2 Turno B

Colección: `final_status`
Índice único: (school_id, student_id, year)
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
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

VALID_SITUACIONES = {"PROMOVIDO", "REQ_RECUPERACION", "REPITE"}


# ════════════════════════════════════════════════════════════════════════════
# MODELS
# ════════════════════════════════════════════════════════════════════════════

class FinalStatusUpsert(BaseModel):
    student_id: str
    year: int = Field(ge=2000, le=2100)
    situacion: Optional[str] = None  # None permite limpiar
    cursos_para_recuperar: List[str] = []


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


async def _get_student(user: dict, student_id: str) -> dict:
    s = await db.users.find_one(
        {"id": student_id, "role": "student"},
        {"_id": 0, "id": 1, "school_id": 1, "seccion_id": 1, "section_id": 1, "padre_id": 1},
    )
    if not s:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
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
        section_id = student.get("seccion_id") or student.get("section_id")
        if not section_id:
            return False
        # Cualquier profesor de la sección puede leer (no exclusivo del tutor)
        a = await db.academic_assignments.find_one(
            {
                "school_id": user["school_id"],
                "section_id": section_id,
                "teacher_id": user["id"],
                "status": "activo",
            }, {"_id": 0, "id": 1},
        )
        return a is not None
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


async def _validate_cursos(school_id: str, cursos_ids: List[str]) -> List[dict]:
    """Devuelve lista de {id, name} validando que todos los cursos existan."""
    if not cursos_ids:
        return []
    docs = await db.subjects.find(
        {"id": {"$in": cursos_ids}, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1},
    ).to_list(100)
    found_ids = {d["id"] for d in docs}
    missing = [c for c in cursos_ids if c not in found_ids]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Asignaturas no encontradas: {', '.join(missing)}",
        )
    return docs


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/final-status/{student_id}")
async def get_final_status(
    student_id: str,
    year: Optional[int] = Query(default=None),
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    student = await _get_student(user, student_id)
    if not await _can_read(user, student):
        raise HTTPException(status_code=403, detail="Sin permiso")

    q = {"school_id": user["school_id"], "student_id": student_id}
    if year is not None:
        q["year"] = year
        doc = await db.final_status.find_one(q, {"_id": 0})
        if not doc:
            return {"final_status": None}
        cursos = await _resolve_cursos(user["school_id"], doc.get("cursos_para_recuperar") or [])
        doc["cursos_para_recuperar"] = cursos
        return {"final_status": doc}

    items = await db.final_status.find(q, {"_id": 0}).to_list(20)
    return {"items": items}


@router.put("/final-status")
async def upsert_final_status(
    body: FinalStatusUpsert,
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    student = await _get_student(user, body.student_id)
    if not await _can_write(user, student):
        raise HTTPException(status_code=403, detail="Solo el tutor o admin puede editar situación final")

    # Validar situacion
    if body.situacion is not None and body.situacion not in VALID_SITUACIONES:
        raise HTTPException(
            status_code=400,
            detail=f"Situación inválida. Valores válidos: {sorted(VALID_SITUACIONES)}",
        )

    cursos = list(body.cursos_para_recuperar or [])
    # Validar consistencia
    if body.situacion == "REQ_RECUPERACION" and not cursos:
        raise HTTPException(
            status_code=400,
            detail="Si la situación es REQ_RECUPERACION debes indicar al menos un curso a recuperar.",
        )
    if body.situacion == "PROMOVIDO" and cursos:
        raise HTTPException(
            status_code=400,
            detail="PROMOVIDO no admite cursos para recuperar.",
        )

    # Validar que los cursos existen
    await _validate_cursos(user["school_id"], cursos)

    now = datetime.now(timezone.utc).isoformat()
    section_id = student.get("seccion_id") or student.get("section_id")
    existing = await db.final_status.find_one(
        {
            "school_id": user["school_id"],
            "student_id": body.student_id,
            "year": body.year,
        }, {"_id": 0},
    )

    update_doc = {
        "situacion": body.situacion,
        "cursos_para_recuperar": cursos,
        "section_id": section_id,
        "updated_by": user["id"],
        "updated_at": now,
    }

    if existing:
        await db.final_status.update_one(
            {"id": existing["id"]}, {"$set": update_doc}
        )
        doc = await db.final_status.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        new = {
            "id": str(uuid.uuid4()),
            "school_id": user["school_id"],
            "student_id": body.student_id,
            "year": body.year,
            "created_by": user["id"],
            "created_at": now,
            **update_doc,
        }
        await db.final_status.insert_one(new)
        new.pop("_id", None)
        doc = new

    cursos_resolved = await _resolve_cursos(user["school_id"], doc.get("cursos_para_recuperar") or [])
    doc["cursos_para_recuperar"] = cursos_resolved
    return {"final_status": doc}


# ════════════════════════════════════════════════════════════════════════════
# HELPERS PÚBLICOS
# ════════════════════════════════════════════════════════════════════════════

async def _resolve_cursos(school_id: str, cursos_ids: List[str]) -> List[dict]:
    if not cursos_ids:
        return []
    docs = await db.subjects.find(
        {"id": {"$in": cursos_ids}, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1},
    ).to_list(100)
    by_id = {d["id"]: d for d in docs}
    return [{"id": cid, "name": (by_id.get(cid) or {}).get("name", cid)} for cid in cursos_ids]


async def get_final_status_payload_for_libreta(
    school_id: str, student_id: str, year: int
) -> Optional[dict]:
    doc = await db.final_status.find_one(
        {"school_id": school_id, "student_id": student_id, "year": year},
        {"_id": 0, "situacion": 1, "cursos_para_recuperar": 1},
    )
    if not doc:
        return None
    cursos = await _resolve_cursos(school_id, doc.get("cursos_para_recuperar") or [])
    return {"situacion": doc.get("situacion"), "cursos_para_recuperar": cursos}


async def ensure_final_status_indexes():
    try:
        await db.final_status.create_index(
            [("school_id", 1), ("student_id", 1), ("year", 1)],
            unique=True, name="uniq_final_status_student_year",
        )
    except Exception as e:
        logger.warning(f"[final_status] index creation: {e}")
