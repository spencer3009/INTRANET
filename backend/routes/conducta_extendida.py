# -*- coding: utf-8 -*-
"""
Conducta Extendida — Plantilla configurable de evaluación conductual + PP.FF.

Modo alternativo (opt-in por colegio) al campo de Conducta MINEDU tradicional.
Cuando un colegio activa `schools.conducta_template_mode == "extended"`, la
libreta y el portal del tutor muestran una tabla con N criterios agrupados en
secciones (EVALUACIÓN CONDUCTUAL, PARTICIPACIÓN DE PP.FF., etc) — todo
configurable por el admin/director.

Storage:
  - schools.conducta_template_mode: "default" | "extended"
  - schools.conducta_extended_template: { secciones: [{id, nombre, criterios: [{id, nombre, orden}], orden}] }
  - conducta_extendida_grades: { id, school_id, student_id, period_id, scores: {<criterio_id>: float|None}, updated_at, updated_by }

No reemplaza ni borra la conducta tradicional (`conduct_grades`); coexisten en
BD. La UI muestra una u otra según el modo activo.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from .core import (
    db, get_current_user, resolve_user_from_token, has_role, ADMIN_ROLES,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["conducta_extendida"])


# ══════════════════════════════════════════════════════════════════════════════
# DEFAULT TEMPLATE
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_TEMPLATE = {
    "secciones": [
        {
            "id": "eval_conductual",
            "nombre": "EVALUACIÓN CONDUCTUAL",
            "orden": 0,
            "criterios": [
                {"id": "asist_punt", "nombre": "Asistencia y puntualidad", "orden": 0},
                {"id": "pres_personal", "nombre": "Presentación personal", "orden": 1},
                {"id": "cumpl_normas", "nombre": "Cumplimiento de normas", "orden": 2},
                {"id": "resp_tareas", "nombre": "Responsabilidad en cumplimiento de tareas", "orden": 3},
            ],
        },
        {
            "id": "part_ppff",
            "nombre": "PARTICIPACIÓN DE PP.FF.",
            "orden": 1,
            "criterios": [
                {"id": "ppff_asist_escuela", "nombre": "Asistencia a Escuela para Padres", "orden": 0},
                {"id": "ppff_monitoreo", "nombre": "Monitoreo y seguimiento de la participación del estudiante", "orden": 1},
                {"id": "ppff_reuniones", "nombre": "Participación en reuniones y/o llamados del tutor(a)", "orden": 2},
            ],
        },
    ],
}


# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class CriterioIn(BaseModel):
    id: Optional[str] = None  # auto-generated if missing
    nombre: str
    orden: int = 0


class SeccionIn(BaseModel):
    id: Optional[str] = None
    nombre: str
    orden: int = 0
    criterios: List[CriterioIn] = []


class TemplateUpdate(BaseModel):
    mode: Optional[str] = None  # "default" | "extended"
    secciones: Optional[List[SeccionIn]] = None  # only required if updating template


class ScoreEntry(BaseModel):
    student_id: str
    scores: Dict[str, Optional[float]] = Field(default_factory=dict)


class SaveScoresRequest(BaseModel):
    section_id: str
    period_id: str
    entries: List[ScoreEntry]


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

async def _require_user(current_user) -> dict:
    u = await resolve_user_from_token(current_user)
    if not u or not u.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no autenticado")
    return u


def _is_admin(user: dict) -> bool:
    return bool(user.get("is_owner")) or user.get("role") in ADMIN_ROLES


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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_template_shape(raw: Any) -> Dict[str, Any]:
    """Normalize a template dict from DB → {secciones: [{id,nombre,orden,criterios:[…]}]}."""
    if not isinstance(raw, dict) or not isinstance(raw.get("secciones"), list):
        return {"secciones": []}
    secciones = []
    for s in raw["secciones"]:
        if not isinstance(s, dict):
            continue
        criterios = []
        for c in (s.get("criterios") or []):
            if not isinstance(c, dict):
                continue
            criterios.append({
                "id": str(c.get("id") or uuid.uuid4().hex[:10]),
                "nombre": str(c.get("nombre") or "").strip(),
                "orden": int(c.get("orden") or 0),
            })
        criterios.sort(key=lambda x: (x["orden"], x["nombre"]))
        secciones.append({
            "id": str(s.get("id") or uuid.uuid4().hex[:10]),
            "nombre": str(s.get("nombre") or "").strip(),
            "orden": int(s.get("orden") or 0),
            "criterios": criterios,
        })
    secciones.sort(key=lambda x: (x["orden"], x["nombre"]))
    return {"secciones": secciones}


async def _get_school_template(school_id: str) -> Dict[str, Any]:
    """Return {mode, template} for a school, applying defaults when missing."""
    s = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "conducta_template_mode": 1, "conducta_extended_template": 1},
    ) or {}
    mode = (s.get("conducta_template_mode") or "default").strip().lower()
    if mode not in ("default", "extended"):
        mode = "default"
    raw = s.get("conducta_extended_template")
    template = _ensure_template_shape(raw) if raw else dict(DEFAULT_TEMPLATE)
    # If extended is on but template is empty, seed with default in-memory (don't persist).
    if not template.get("secciones"):
        template = dict(DEFAULT_TEMPLATE)
    return {"mode": mode, "template": template}


def _flatten_criterio_ids(template: Dict[str, Any]) -> set:
    ids = set()
    for s in (template.get("secciones") or []):
        for c in (s.get("criterios") or []):
            if c.get("id"):
                ids.add(c["id"])
    return ids


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS — TEMPLATE (settings)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/conducta-extendida/template")
async def get_template(current_user=Depends(get_current_user)):
    user = await _require_user(current_user)
    data = await _get_school_template(user["school_id"])
    return {
        "school_id": user["school_id"],
        "mode": data["mode"],
        "template": data["template"],
        "default_template": DEFAULT_TEMPLATE,
    }


@router.put("/conducta-extendida/template")
async def update_template(body: TemplateUpdate, current_user=Depends(get_current_user)):
    user = await _require_user(current_user)
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar la plantilla")
    update_fields: Dict[str, Any] = {}
    if body.mode is not None:
        mode = body.mode.strip().lower()
        if mode not in ("default", "extended"):
            raise HTTPException(status_code=400, detail="mode debe ser 'default' o 'extended'")
        update_fields["conducta_template_mode"] = mode
    if body.secciones is not None:
        raw = {"secciones": [s.dict() for s in body.secciones]}
        normalized = _ensure_template_shape(raw)
        # Validate: at least one sección with at least one criterio if extended
        if not normalized["secciones"]:
            raise HTTPException(status_code=400, detail="Debes definir al menos una sección")
        for s in normalized["secciones"]:
            if not s["nombre"]:
                raise HTTPException(status_code=400, detail="Cada sección debe tener nombre")
            if not s["criterios"]:
                raise HTTPException(status_code=400, detail=f"La sección '{s['nombre']}' debe tener al menos un criterio")
            for c in s["criterios"]:
                if not c["nombre"]:
                    raise HTTPException(status_code=400, detail=f"Cada criterio de '{s['nombre']}' debe tener nombre")
        update_fields["conducta_extended_template"] = normalized
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nada para actualizar")
    update_fields["conducta_template_updated_at"] = _now()
    await db.schools.update_one({"id": user["school_id"]}, {"$set": update_fields})
    data = await _get_school_template(user["school_id"])
    return {"ok": True, "mode": data["mode"], "template": data["template"]}


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS — SCORES (tutor / admin)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/conducta-extendida")
async def list_scores(
    section_id: str = Query(...),
    period_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    school_id = user["school_id"]
    is_admin = _is_admin(user)
    is_tutor = await _is_tutor(user, section_id)
    if not (is_admin or is_tutor):
        raise HTTPException(status_code=403, detail="Solo el tutor o un administrador puede ver esta sección")

    # Validate section/period belong to school
    section = await db.sections.find_one({"id": section_id, "school_id": school_id}, {"_id": 0, "id": 1})
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    period = await db.academic_periods.find_one({"id": period_id, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1})
    if not period:
        raise HTTPException(status_code=404, detail="Bimestre no encontrado")

    # Students of the section
    students = await db.users.find(
        {"school_id": school_id, "role": "student", "seccion_id": section_id, "$or": [{"active": True}, {"active": {"$exists": False}}]},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "student_code": 1, "number": 1},
    ).to_list(2000)
    students.sort(key=lambda s: (s.get("last_name") or "").upper() + (s.get("name") or "").upper())

    # Existing scores for this section/period
    sids = [s["id"] for s in students]
    docs = await db.conducta_extendida_grades.find(
        {"school_id": school_id, "period_id": period_id, "student_id": {"$in": sids}},
        {"_id": 0, "student_id": 1, "scores": 1, "updated_at": 1},
    ).to_list(2000)
    by_student = {d["student_id"]: (d.get("scores") or {}) for d in docs}

    template_info = await _get_school_template(school_id)
    return {
        "section_id": section_id,
        "period_id": period_id,
        "period_name": period.get("nombre"),
        "mode": template_info["mode"],
        "template": template_info["template"],
        "students": [
            {
                "student_id": s["id"],
                "student_code": s.get("student_code"),
                "name": s.get("name"),
                "last_name": s.get("last_name"),
                "full_name": f"{s.get('last_name') or ''} {s.get('name') or ''}".strip(),
                "scores": by_student.get(s["id"]) or {},
            } for s in students
        ],
    }


@router.post("/conducta-extendida")
async def save_scores(body: SaveScoresRequest, current_user=Depends(get_current_user)):
    user = await _require_user(current_user)
    school_id = user["school_id"]
    is_admin = _is_admin(user)
    is_tutor = await _is_tutor(user, body.section_id)
    if not (is_admin or is_tutor):
        raise HTTPException(status_code=403, detail="Solo el tutor o un administrador puede guardar estas notas")

    # Validate section
    section = await db.sections.find_one({"id": body.section_id, "school_id": school_id}, {"_id": 0, "id": 1})
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")

    # Validate period & not closed
    period = await db.academic_periods.find_one({"id": body.period_id, "school_id": school_id}, {"_id": 0, "id": 1})
    if not period:
        raise HTTPException(status_code=404, detail="Bimestre no encontrado")
    closed = await db.period_closures.find_one({"school_id": school_id, "period_id": body.period_id}, {"_id": 0, "id": 1})
    if closed and not is_admin:
        raise HTTPException(status_code=423, detail="El bimestre está cerrado")

    template_info = await _get_school_template(school_id)
    valid_ids = _flatten_criterio_ids(template_info["template"])

    saved = 0
    for e in body.entries:
        # Sanitize scores: only valid criterio ids, floats 0-20 or None
        clean: Dict[str, Optional[float]] = {}
        for cid, val in (e.scores or {}).items():
            if cid not in valid_ids:
                continue
            if val is None or val == "":
                clean[cid] = None
            else:
                try:
                    f = float(val)
                except Exception:
                    continue
                if f < 0 or f > 20:
                    raise HTTPException(status_code=400, detail=f"Nota fuera de rango (0-20) para alumno {e.student_id}")
                clean[cid] = round(f, 2)

        existing = await db.conducta_extendida_grades.find_one(
            {"school_id": school_id, "student_id": e.student_id, "period_id": body.period_id},
            {"_id": 0, "id": 1, "scores": 1},
        )
        merged_scores = dict(existing.get("scores") or {}) if existing else {}
        merged_scores.update(clean)
        # Drop keys no longer in template (cleanup)
        merged_scores = {k: v for k, v in merged_scores.items() if k in valid_ids}

        if existing:
            await db.conducta_extendida_grades.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "scores": merged_scores,
                    "updated_at": _now(),
                    "updated_by": user["id"],
                }},
            )
        else:
            await db.conducta_extendida_grades.insert_one({
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "student_id": e.student_id,
                "period_id": body.period_id,
                "scores": merged_scores,
                "created_at": _now(),
                "updated_at": _now(),
                "updated_by": user["id"],
            })
        saved += 1

    return {"ok": True, "saved": saved}


# ══════════════════════════════════════════════════════════════════════════════
# LIBRETA HELPER (used by routes/libreta.py)
# ══════════════════════════════════════════════════════════════════════════════

async def get_conducta_extendida_payload_for_libreta(
    school_id: str, student_id: str, period_ids: List[str]
) -> Dict[str, Any]:
    """Return template + scores per period for a single student.

    Shape:
      {
        mode: "default" | "extended",
        template: { secciones: [...] },
        by_period: { <period_id>: { <criterio_id>: <float|None> } | None }
      }
    """
    info = await _get_school_template(school_id)
    docs = await db.conducta_extendida_grades.find(
        {"school_id": school_id, "student_id": student_id, "period_id": {"$in": period_ids}},
        {"_id": 0, "period_id": 1, "scores": 1},
    ).to_list(20)
    by_period = {d["period_id"]: (d.get("scores") or {}) for d in docs}
    return {
        "mode": info["mode"],
        "template": info["template"],
        "by_period": {pid: by_period.get(pid) or None for pid in period_ids},
    }


# ══════════════════════════════════════════════════════════════════════════════
# INDEX
# ══════════════════════════════════════════════════════════════════════════════

async def ensure_conducta_extendida_indexes():
    try:
        await db.conducta_extendida_grades.create_index(
            [("school_id", 1), ("student_id", 1), ("period_id", 1)],
            unique=True, name="uniq_conducta_ext_student_period",
        )
    except Exception as e:
        logger.warning(f"[conducta_extendida] index creation: {e}")
