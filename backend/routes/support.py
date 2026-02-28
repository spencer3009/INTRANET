"""
Support Panel Router - Global Support Admin endpoints
Handles: Dashboard overview, school listing, school switching, profile management
Only accessible by users with role 'system_admin_global'
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid
import bcrypt

from .core import (
    db, get_current_user, hash_password, verify_password,
    JWT_SECRET, JWT_ALGORITHM, now_iso
)
import jwt

router = APIRouter(prefix="/api/support", tags=["support"])

# ══════════════════════════════════════════════════════════════════════════════
# AUTH HELPER - Require system_admin_global role
# ══════════════════════════════════════════════════════════════════════════════

async def require_support_admin(current_user=Depends(get_current_user)):
    """Only system_admin_global users can access support endpoints"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user or user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo administradores de soporte global.")
    return user


# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════

class SwitchSchoolRequest(BaseModel):
    school_id: str

class SupportProfileUpdate(BaseModel):
    name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None

class SupportPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/overview")
async def support_overview(user=Depends(require_support_admin)):
    """Dashboard overview: global metrics for support admin"""
    total_schools = await db.schools.count_documents({})
    
    # Schools assigned to this support user
    assignments = await db.user_school_roles.count_documents({"user_id": user["id"]})
    
    # Total users globally
    total_users = await db.users.count_documents({})
    
    # Last 5 schools created
    last_schools_cursor = db.schools.find(
        {}, {"_id": 0, "id": 1, "name": 1, "subdomain": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5)
    last_schools = await last_schools_cursor.to_list(length=5)
    
    return {
        "total_schools": total_schools,
        "my_assigned_schools": assignments,
        "total_users_global": total_users,
        "last_schools_created": last_schools
    }


@router.get("/schools")
async def support_schools(user=Depends(require_support_admin)):
    """List all schools assigned to the support user via user_school_roles"""
    # Get assignments
    assignments_cursor = db.user_school_roles.find(
        {"user_id": user["id"]}, {"_id": 0}
    )
    assignments = await assignments_cursor.to_list(length=500)
    
    if not assignments:
        return []
    
    school_ids = [a["school_id"] for a in assignments]
    assignment_map = {a["school_id"]: a for a in assignments}
    
    # Fetch school details
    schools_cursor = db.schools.find(
        {"id": {"$in": school_ids}},
        {"_id": 0, "id": 1, "name": 1, "subdomain": 1, "created_at": 1, "expiration_date": 1, "logo_url": 1, "pricing_override": 1}
    )
    schools = await schools_cursor.to_list(length=500)
    
    # Enrich with user counts and role info
    result = []
    for school in schools:
        sid = school["id"]
        student_count = await db.users.count_documents({"school_id": sid, "role": "student"})
        teacher_count = await db.users.count_documents({"school_id": sid, "role": "teacher"})
        total_count = await db.users.count_documents({"school_id": sid})
        
        assignment = assignment_map.get(sid, {})
        result.append({
            **school,
            "role_in_school": assignment.get("role_in_school", "system_admin"),
            "is_system_assignment": assignment.get("is_system_assignment", True),
            "student_count": student_count,
            "teacher_count": teacher_count,
            "total_users": total_count
        })
    
    # Sort by name
    result.sort(key=lambda x: x.get("name", ""))
    return result


@router.get("/all-schools")
async def support_all_schools(user=Depends(require_support_admin)):
    """List ALL schools in the system (for assignment management)"""
    schools_cursor = db.schools.find(
        {}, {"_id": 0, "id": 1, "name": 1, "subdomain": 1, "created_at": 1, "expiration_date": 1, "pricing_override": 1}
    )
    schools = await schools_cursor.to_list(length=1000)
    
    # Get current assignments
    assignments_cursor = db.user_school_roles.find(
        {"user_id": user["id"]}, {"_id": 0, "school_id": 1}
    )
    assignments = await assignments_cursor.to_list(length=1000)
    assigned_ids = {a["school_id"] for a in assignments}
    
    for school in schools:
        school["is_assigned"] = school["id"] in assigned_ids
    
    return schools


@router.post("/assign-school")
async def assign_school(req: SwitchSchoolRequest, user=Depends(require_support_admin)):
    """Assign a school to the support user"""
    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    existing = await db.user_school_roles.find_one(
        {"user_id": user["id"], "school_id": req.school_id}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes acceso a este colegio")
    
    await db.user_school_roles.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "school_id": req.school_id,
        "role_in_school": "system_admin",
        "is_system_assignment": True,
        "created_at": now_iso(),
        "updated_at": now_iso()
    })
    
    return {"message": f"Acceso asignado a {school.get('name', school.get('subdomain'))}"}


@router.delete("/unassign-school/{school_id}")
async def unassign_school(school_id: str, user=Depends(require_support_admin)):
    """Remove school assignment from support user"""
    result = await db.user_school_roles.delete_one(
        {"user_id": user["id"], "school_id": school_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asignacion no encontrada")
    return {"message": "Acceso removido"}


class UpdateExpirationRequest(BaseModel):
    school_id: str
    expiration_date: str

@router.put("/school-expiration")
async def update_school_expiration(req: UpdateExpirationRequest, user=Depends(require_support_admin)):
    """Update a school's expiration date"""
    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0, "id": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    await db.schools.update_one(
        {"id": req.school_id},
        {"$set": {
            "expiration_date": req.expiration_date,
            "updated_at": now_iso()
        }}
    )
    return {"message": "Fecha de vencimiento actualizada"}


# ══════════════════════════════════════════════════════════════════════════════
# PRICING CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

class GlobalPricingRequest(BaseModel):
    base_monthly_fee: float = Field(..., description="Base mensual en soles")
    per_student_fee: float = Field(..., description="Precio por alumno")
    per_student_from_month: int = Field(..., description="Mes desde el que aplica cobro por alumno")

class SchoolPricingRequest(BaseModel):
    school_id: str
    base_monthly_fee: Optional[float] = None
    per_student_fee: Optional[float] = None
    per_student_from_month: Optional[int] = None
    discount_notes: Optional[str] = None

@router.get("/pricing")
async def get_global_pricing(user=Depends(require_support_admin)):
    """Get global pricing configuration"""
    config = await db.pricing_config.find_one({"id": "global"}, {"_id": 0})
    if not config:
        config = {
            "id": "global",
            "base_monthly_fee": 50.0,
            "per_student_fee": 0.70,
            "per_student_from_month": 3,
            "currency": "PEN"
        }
        await db.pricing_config.insert_one(config)
    return config

@router.put("/pricing")
async def update_global_pricing(req: GlobalPricingRequest, user=Depends(require_support_admin)):
    """Update global pricing configuration"""
    await db.pricing_config.update_one(
        {"id": "global"},
        {"$set": {
            "id": "global",
            "base_monthly_fee": req.base_monthly_fee,
            "per_student_fee": req.per_student_fee,
            "per_student_from_month": req.per_student_from_month,
            "currency": "PEN",
            "updated_at": now_iso()
        }},
        upsert=True
    )
    return {"message": "Configuracion de precios actualizada"}

@router.put("/school-pricing")
async def update_school_pricing(req: SchoolPricingRequest, user=Depends(require_support_admin)):
    """Set custom pricing override for a specific school"""
    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0, "id": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    override = {}
    if req.base_monthly_fee is not None:
        override["base_monthly_fee"] = req.base_monthly_fee
    if req.per_student_fee is not None:
        override["per_student_fee"] = req.per_student_fee
    if req.per_student_from_month is not None:
        override["per_student_from_month"] = req.per_student_from_month
    if req.discount_notes is not None:
        override["discount_notes"] = req.discount_notes
    
    if not override:
        # Clear override
        await db.schools.update_one({"id": req.school_id}, {"$unset": {"pricing_override": ""}})
        return {"message": "Precio personalizado eliminado, se usara el global"}
    
    override["updated_at"] = now_iso()
    await db.schools.update_one(
        {"id": req.school_id},
        {"$set": {"pricing_override": override, "updated_at": now_iso()}}
    )
    return {"message": "Precio personalizado actualizado"}

@router.delete("/school-pricing/{school_id}")
async def delete_school_pricing(school_id: str, user=Depends(require_support_admin)):
    """Remove custom pricing override for a school"""
    await db.schools.update_one({"id": school_id}, {"$unset": {"pricing_override": ""}})
    return {"message": "Precio personalizado eliminado"}

@router.get("/school-pricing/{school_id}")
async def get_school_pricing(school_id: str, user=Depends(require_support_admin)):
    """Get pricing for a specific school (global + override)"""
    global_config = await db.pricing_config.find_one({"id": "global"}, {"_id": 0})
    if not global_config:
        global_config = {"base_monthly_fee": 50.0, "per_student_fee": 0.70, "per_student_from_month": 3}
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "pricing_override": 1, "created_at": 1})
    override = school.get("pricing_override") if school else None
    
    # Calculate current month number
    months_active = 1
    if school and school.get("created_at"):
        try:
            created = datetime.fromisoformat(school["created_at"].replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            months_active = max(1, (now.year - created.year) * 12 + now.month - created.month + 1)
        except:
            pass
    
    # Effective pricing
    eff = {
        "base_monthly_fee": override.get("base_monthly_fee", global_config["base_monthly_fee"]) if override else global_config["base_monthly_fee"],
        "per_student_fee": override.get("per_student_fee", global_config["per_student_fee"]) if override else global_config["per_student_fee"],
        "per_student_from_month": override.get("per_student_from_month", global_config["per_student_from_month"]) if override else global_config["per_student_from_month"],
    }
    
    # Count students
    student_count = await db.users.count_documents({"school_id": school_id, "role": "student"})
    
    # Calculate price
    base = eff["base_monthly_fee"]
    student_charge = 0
    if months_active >= eff["per_student_from_month"]:
        student_charge = student_count * eff["per_student_fee"]
    
    return {
        "global": global_config,
        "override": override,
        "effective": eff,
        "months_active": months_active,
        "student_count": student_count,
        "calculated_price": round(base + student_charge, 2),
        "base_charge": base,
        "student_charge": round(student_charge, 2)
    }




@router.post("/switch-school")
async def switch_school(req: SwitchSchoolRequest, user=Depends(require_support_admin)):
    """
    Switch context to a specific school.
    Returns a new JWT with active_school_id and scope: support_switch.
    Only works if user has assignment to that school.
    """
    # Verify membership
    assignment = await db.user_school_roles.find_one(
        {"user_id": user["id"], "school_id": req.school_id}
    )
    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso a este colegio. Asignalo primero."
        )
    
    # Get school details
    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    subdomain = school.get("subdomain")
    
    # Create a special JWT with school context
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": "owner",  # In school context, support acts as owner
        "original_role": "system_admin_global",
        "school_id": req.school_id,
        "subdomain": subdomain,
        "email_verified": True,
        "scope": "support_switch",
        "active_school_id": req.school_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return {
        "token": token,
        "school": {
            "id": req.school_id,
            "name": school.get("name", ""),
            "subdomain": subdomain,
            "logo_url": school.get("logo_url")
        },
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "last_name": user.get("last_name", ""),
            "role": "owner",
            "original_role": "system_admin_global",
            "school_id": req.school_id,
            "subdomain": subdomain,
            "email_verified": True,
            "is_owner": True,
            "is_super_admin": False,
            "is_protected": True,
            "is_demo_user": False,
            "is_support_session": True,
            "photo_url": user.get("photo_url"),
            "permissions": {
                "role": "owner",
                "is_owner": True,
                "is_admin": False,
                "sections": {
                    "settings": True,
                    "accounting": True,
                    "users": True,
                    "grades": True,
                    "courses": True,
                    "attendance": True,
                    "reports": True,
                    "schedule": True,
                    "exams": True,
                    "internal_mail": True
                }
            }
        }
    }


@router.get("/me")
async def get_support_profile(user=Depends(require_support_admin)):
    """Get support user profile"""
    return {
        "id": user["id"],
        "name": user.get("name", ""),
        "last_name": user.get("last_name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "photo_url": user.get("photo_url"),
        "role": user.get("role"),
        "created_at": user.get("created_at")
    }


@router.put("/me")
async def update_support_profile(data: SupportProfileUpdate, user=Depends(require_support_admin)):
    """Update support user profile (name, email, photo)"""
    update_fields = {}
    
    if data.name is not None:
        update_fields["name"] = data.name.strip()
    if data.last_name is not None:
        update_fields["last_name"] = data.last_name.strip()
    if data.email is not None:
        # Check email not taken by another user
        existing = await db.users.find_one(
            {"email": data.email.lower().strip(), "id": {"$ne": user["id"]}},
            {"_id": 0, "id": 1}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Este correo ya esta en uso")
        update_fields["email"] = data.email.lower().strip()
    if data.photo_url is not None:
        update_fields["photo_url"] = data.photo_url
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    
    update_fields["updated_at"] = now_iso()
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
    
    # Return updated user
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return {
        "id": updated["id"],
        "name": updated.get("name", ""),
        "last_name": updated.get("last_name", ""),
        "email": updated.get("email", ""),
        "phone": updated.get("phone", ""),
        "photo_url": updated.get("photo_url"),
        "role": updated.get("role"),
        "created_at": updated.get("created_at")
    }


@router.put("/me/password")
async def change_support_password(data: SupportPasswordChange, user=Depends(require_support_admin)):
    """Change support user password"""
    # Get full user with password hash
    full_user = await db.users.find_one({"id": user["id"]})
    if not full_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if not verify_password(data.current_password, full_user["password"]):
        raise HTTPException(status_code=400, detail="Contrasena actual incorrecta")
    
    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password": new_hash, "updated_at": now_iso()}}
    )
    
    return {"message": "Contrasena actualizada correctamente"}


# ══════════════════════════════════════════════════════════════════════════════
# STARTUP: Ensure global support user exists
# ══════════════════════════════════════════════════════════════════════════════

SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"

async def ensure_global_support_user():
    """
    Ensure the global support user exists.
    Called on app startup.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    existing = await db.users.find_one(
        {"role": "system_admin_global"},
        {"_id": 0}
    )
    
    if existing:
        # Make sure email/password are correct
        if existing.get("email") != SUPPORT_EMAIL:
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {"email": SUPPORT_EMAIL, "updated_at": now_iso()}}
            )
            logger.info("Updated global support user email")
        
        # Verify password works, if not update it
        full = await db.users.find_one({"id": existing["id"]})
        if full and not verify_password(SUPPORT_PASSWORD, full.get("password", "")):
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {"password": hash_password(SUPPORT_PASSWORD), "updated_at": now_iso()}}
            )
            logger.info("Updated global support user password")
        
        logger.info(f"Global support user exists: {existing['id']}")
        return existing["id"]
    
    # Create new global support user
    user_id = str(uuid.uuid4())
    support_user = {
        "id": user_id,
        "username": "soporte_global",
        "password": hash_password(SUPPORT_PASSWORD),
        "name": "Soporte",
        "last_name": "EduNet",
        "email": SUPPORT_EMAIL,
        "role": "system_admin_global",
        "is_system_user": True,
        "is_protected": True,
        "email_verified": True,
        "created_at": now_iso(),
        "updated_at": now_iso()
    }
    
    await db.users.insert_one(support_user)
    logger.info(f"Global support user created: {user_id}")
    
    # Create index for user_school_roles
    await db.user_school_roles.create_index(
        [("user_id", 1), ("school_id", 1)],
        unique=True
    )
    
    return user_id
