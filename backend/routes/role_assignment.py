"""Role assignment endpoints — assign/revoke additional auxiliary roles to staff."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from routes.core import db, get_current_user, resolve_user_from_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["role-assignment"])

ASSIGNABLE_ROLES = ["auxiliar_alimentacion", "auxiliar_movilidad", "auxiliar_asistencia"]
INELIGIBLE_PRIMARY_ROLES = ["owner", "auxiliar_alimentacion", "auxiliar_movilidad", "auxiliar_asistencia", "student", "parent", "system_admin_global"]


def _require_owner(user):
    if not user or user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Solo el propietario puede gestionar roles")


@router.get("/role-assignment/eligible-users")
async def get_eligible_users(
    role_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user=Depends(get_current_user)
):
    user = await resolve_user_from_token(current_user)
    _require_owner(user)
    school_id = user.get("school_id")

    query = {"school_id": school_id, "role": {"$nin": INELIGIBLE_PRIMARY_ROLES}}
    if role_filter:
        query["role"] = role_filter
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"dni": {"$regex": search, "$options": "i"}},
        ]

    users = await db.users.find(query, {
        "_id": 0, "id": 1, "name": 1, "last_name": 1, "role": 1,
        "photo_url": 1, "dni": 1, "additional_roles": 1
    }).to_list(500)

    for u in users:
        u["additional_roles"] = u.get("additional_roles") or []

    return {"users": users}


@router.get("/users/{user_id}/roles")
async def get_user_roles(user_id: str, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    _require_owner(user)

    target = await db.users.find_one({"id": user_id, "school_id": user.get("school_id")}, {"_id": 0, "role": 1, "additional_roles": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"role": target.get("role"), "additional_roles": target.get("additional_roles", [])}


class AssignRoleRequest(BaseModel):
    role: str


@router.post("/users/{user_id}/additional-roles")
async def assign_additional_role(user_id: str, data: AssignRoleRequest, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    _require_owner(user)
    school_id = user.get("school_id")

    if data.role not in ASSIGNABLE_ROLES:
        raise HTTPException(status_code=400, detail=f"Rol no asignable: {data.role}")

    target = await db.users.find_one({"id": user_id, "school_id": school_id}, {"_id": 0, "role": 1, "additional_roles": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.get("role") in INELIGIBLE_PRIMARY_ROLES:
        raise HTTPException(status_code=400, detail="Este usuario no es elegible para roles auxiliares")

    current_additional = target.get("additional_roles", [])
    if data.role in current_additional:
        return {"message": "Rol ya asignado", "additional_roles": current_additional}

    await db.users.update_one(
        {"id": user_id},
        {"$addToSet": {"additional_roles": data.role}}
    )
    updated = current_additional + [data.role]
    logger.info(f"[ROLES] Assigned {data.role} to user {user_id}")
    return {"message": f"Rol {data.role} asignado correctamente", "additional_roles": updated}


@router.delete("/users/{user_id}/additional-roles/{role}")
async def revoke_additional_role(user_id: str, role: str, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    _require_owner(user)
    school_id = user.get("school_id")

    if role not in ASSIGNABLE_ROLES:
        raise HTTPException(status_code=400, detail=f"Rol no valido: {role}")

    await db.users.update_one(
        {"id": user_id, "school_id": school_id},
        {"$pull": {"additional_roles": role}}
    )
    logger.info(f"[ROLES] Revoked {role} from user {user_id}")
    return {"message": f"Rol {role} revocado correctamente"}
