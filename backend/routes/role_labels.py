# -*- coding: utf-8 -*-
"""
Role Label Overrides — Multi-tenant.

Permite que cada colegio renombre las etiquetas visibles de ciertos roles
del sistema (ej. "Aux. Asistencia" → "Aux. Disciplina"). El override afecta
la cabecera de la página de usuarios y los carnets QR generados.

Por ahora soporta solo `auxiliar_asistencia`. Si más adelante el usuario
quiere editar más roles, este endpoint ya está preparado (dict abierto).
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone

from .core import db, get_current_user, resolve_user_from_token, ADMIN_ROLES

router = APIRouter(prefix="/api", tags=["role-labels"])

# Roles cuya etiqueta el colegio puede sobreescribir actualmente.
EDITABLE_ROLES = {"auxiliar_asistencia"}

# Defaults shown when there's no override yet.
DEFAULTS = {
    "auxiliar_asistencia": "Auxiliar de Asistencia",
}


class RoleLabelUpdate(BaseModel):
    role: str
    label: str


@router.get("/schools/role-labels")
async def get_role_labels(current_user=Depends(get_current_user)):
    """Return role label overrides for the current user's school."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no autenticado")
    s = await db.schools.find_one(
        {"id": user["school_id"]},
        {"_id": 0, "role_label_overrides": 1},
    ) or {}
    overrides = s.get("role_label_overrides") or {}
    # Merge defaults + overrides so the frontend always gets a value per role.
    return {
        "labels": {role: overrides.get(role) or DEFAULTS[role] for role in EDITABLE_ROLES},
        "overrides": overrides,
        "editable_roles": sorted(EDITABLE_ROLES),
    }


@router.put("/schools/role-labels")
async def update_role_label(body: RoleLabelUpdate, current_user=Depends(get_current_user)):
    """Set a role label override. Admins only."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no autenticado")
    if not (user.get("is_owner") or user.get("role") in ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar etiquetas")
    if body.role not in EDITABLE_ROLES:
        raise HTTPException(status_code=400, detail=f"El rol '{body.role}' no se puede renombrar")
    label = (body.label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    if len(label) > 60:
        raise HTTPException(status_code=400, detail="Máximo 60 caracteres")

    await db.schools.update_one(
        {"id": user["school_id"]},
        {"$set": {
            f"role_label_overrides.{body.role}": label,
            "role_label_overrides_updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True, "role": body.role, "label": label}


# ─────────────────────────────────────────────────────────────────────────
# Helper público para otros endpoints (qr_templates, libreta, etc.)
# ─────────────────────────────────────────────────────────────────────────

async def resolve_role_label(school_id: str, role: str, default: str) -> str:
    """Return the school-specific override for a role, or the provided default."""
    if role not in EDITABLE_ROLES:
        return default
    s = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "role_label_overrides": 1},
    ) or {}
    return ((s.get("role_label_overrides") or {}).get(role)) or default
