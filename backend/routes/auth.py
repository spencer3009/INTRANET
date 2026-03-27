"""
Authentication, school creation, subdomain management
Extracted from server.py during modularization.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Form, UploadFile, File, BackgroundTasks, Request
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import re
import logging

from .core import (
    db, get_current_user, resolve_user_from_token, is_admin_user,
    require_role, require_admin, require_staff, require_section_access,
    is_demo_user, check_demo_user_block, require_not_demo, is_real_owner,
    is_system_user, check_system_user_block, is_protected_user,
    has_role, is_student, is_parent, is_staff,
    can_access_section, get_user_permissions,
    hash_password, verify_password, create_token,
    get_academic_filter,
    JWT_SECRET, JWT_ALGORITHM, now_iso, generate_id,
    ADMIN_ROLES, STAFF_ROLES, ROLE_HIERARCHY,
    RESERVED_SUBDOMAINS,
    create_system_support_user,
    seed_demo_data_for_school,
)

import jwt
import cloudinary
import cloudinary.utils

from .core import BASE_DOMAIN

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

class UserRegister(BaseModel):
    school_name: str
    email: str
    password: str
    username: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class VerifyEmailRequest(BaseModel):
    email: str
    code: str

class CheckSubdomainRequest(BaseModel):
    subdomain: str

class CreateSchoolRequest(BaseModel):
    subdomain: str

class CheckSubdomainResponse(BaseModel):
    available: bool
    subdomain: str = ""
    reason: str = ""

# AUTH ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/auth/register")
async def register(data: UserRegister):
    """
    Step 1: Register user ONLY (school is NOT created yet)
    User starts with:
      - email_verified = false
      - school_id = null
    """
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Este correo ya está registrado")

    user_id = str(uuid.uuid4())
    verification_code = str(uuid.uuid4())[:6].upper()

    # Create user with school_id = null
    user_doc = {
        "id": user_id,
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "name": data.school_name,  # Store school name in user for now
        "role": "owner",
        "school_id": None,  # NO SCHOOL YET
        "email_verified": False,
        "verification_code": verification_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    logger.info(f"User registered: {data.email}, verification code: {verification_code}")

    return {
        "message": "Cuenta creada exitosamente",
        "user_id": user_id,
        "verification_code": verification_code,  # For demo/testing
        "email": data.email.lower()
    }

@router.post("/auth/verify-email")
async def verify_email(data: VerifyEmailRequest):
    """
    Step 2: Verify email
    After this:
      - email_verified = true
      - school_id still null (must complete onboarding)
    """
    user = await db.users.find_one({"email": data.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.get("email_verified"):
        # Already verified, just return token
        token = create_token(
            user["id"], user["email"], user["name"], user["role"],
            user.get("school_id"), None, True
        )
        return {
            "message": "Email ya verificado",
            "verified": True,
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "school_id": user.get("school_id"),
                "subdomain": None,
                "email_verified": True
            }
        }

    if user.get("verification_code") != data.code.upper():
        raise HTTPException(status_code=400, detail="Código de verificación incorrecto")

    # Mark email as verified
    await db.users.update_one(
        {"email": data.email.lower()},
        {"$set": {
            "email_verified": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    token = create_token(
        user["id"], user["email"], user["name"], user["role"],
        None, None, True  # school_id still null
    )

    logger.info(f"Email verified: {data.email}")

    return {
        "message": "Email verificado correctamente",
        "verified": True,
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "school_id": None,  # Still null!
            "subdomain": None,
            "email_verified": True
        }
    }

@router.post("/auth/login")
async def login(creds: UserLogin):
    """
    Login user and return:
      - If has school_id AND school has subdomain: include subdomain for redirect
      - If no school_id OR school has no subdomain: indicate onboarding needed
      - If system_admin_global: return is_support_global flag for redirect to /support
    Accepts email OR username for login.
    """
    try:
        identifier = creds.email.lower().strip()
        logger.info(f"[LOGIN] Attempt for: {identifier}")
        
        # First, check for global support user (priority over school-specific users)
        try:
            global_support = await db.users.find_one({
                "email": identifier,
                "role": "system_admin_global"
            })
        except Exception as db_err:
            logger.error(f"[LOGIN] Database error on global support lookup: {db_err}")
            raise HTTPException(status_code=503, detail="Error de conexion a la base de datos. Intente mas tarde.")
        
        if global_support:
            try:
                pwd_ok = verify_password(creds.password, global_support.get("password", ""))
            except Exception as pwd_err:
                logger.error(f"[LOGIN] Password verification error for support user: {pwd_err}")
                pwd_ok = False
            
            if pwd_ok:
                logger.info(f"[LOGIN] Global support login OK: {identifier}")
                token = create_token(
                    global_support["id"], global_support["email"], global_support["name"],
                    global_support["role"], None, None, True
                )
                return {
                    "token": token,
                    "user": {
                        "id": global_support["id"],
                        "email": global_support["email"],
                        "username": global_support.get("username"),
                        "name": global_support["name"],
                        "last_name": global_support.get("last_name", ""),
                        "role": global_support["role"],
                        "school_id": None,
                        "subdomain": None,
                        "email_verified": True,
                        "is_owner": False,
                        "is_super_admin": False,
                        "is_protected": True,
                        "is_demo_user": False,
                        "is_support_global": True,
                        "photo_url": global_support.get("photo_url"),
                        "phone": global_support.get("phone"),
                        "permissions": {
                            "role": "system_admin_global",
                            "is_owner": False,
                            "is_admin": False,
                            "is_support_global": True,
                            "sections": {}
                        }
                    },
                    "redirect_to_subdomain": False,
                    "redirect_url": None,
                    "redirect_to_support": True
                }
        
        # Standard user login (exclude global support user from results)
        try:
            user = await db.users.find_one({
                "$or": [
                    {"email": identifier},
                    {"username": identifier}
                ],
                "role": {"$ne": "system_admin_global"}
            })
        except Exception as db_err:
            logger.error(f"[LOGIN] Database error on user lookup: {db_err}")
            raise HTTPException(status_code=503, detail="Error de conexion a la base de datos. Intente mas tarde.")
        
        if not user:
            logger.info(f"[LOGIN] User not found: {identifier}")
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        try:
            pwd_valid = verify_password(creds.password, user.get("password", ""))
        except Exception as pwd_err:
            logger.error(f"[LOGIN] Password verification error for {identifier}: {pwd_err}")
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        if not pwd_valid:
            logger.info(f"[LOGIN] Invalid password for: {identifier}")
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        logger.info(f"[LOGIN] Password OK for: {identifier}, role: {user.get('role')}")
        
        # Get school info if user has one
        subdomain = None
        school_id = user.get("school_id")
        
        if school_id:
            try:
                school = await db.schools.find_one({"id": school_id}, {"_id": 0})
            except Exception as db_err:
                logger.error(f"[LOGIN] DB error fetching school {school_id}: {db_err}")
                school = None
            
            if school and school.get("subdomain"):
                subdomain = school.get("subdomain")
                
                # Check debt-based access restriction for students and parents
                try:
                    if school.get("restrict_grades_if_debt", False) and user.get("role") in ("student", "parent"):
                        student_id = user["id"]
                        if user["role"] == "parent":
                            linked = await db.users.find_one({"school_id": school_id, "role": "student", "parent_id": user["id"]}, {"_id": 0, "id": 1})
                            if not linked:
                                linked = await db.users.find_one({"school_id": school_id, "role": "student", "parent_email": user.get("email")}, {"_id": 0, "id": 1})
                            student_id = linked["id"] if linked else None
                        
                        if student_id:
                            pending_count = await db.payments.count_documents({
                                "student_id": student_id, "school_id": school_id,
                                "payment_status": "pending"
                            })
                            if pending_count > 0:
                                raise HTTPException(
                                    status_code=403,
                                    detail="El acceso está restringido por pagos pendientes. Comuníquese con la administración."
                                )
                except HTTPException:
                    raise
                except Exception as debt_err:
                    logger.error(f"[LOGIN] Error checking debt restrictions: {debt_err}")

                # Block login based on subscription state (calculate in real-time)
                try:
                    from .subscription import calculate_plan_state
                    plan_estado, dias_vencido = await calculate_plan_state(school)
                    user_role = user.get("role", "")
                    is_owner_or_admin = user_role in ("owner", "admin") or user.get("is_owner") or user.get("is_super_admin")
                    # SUSPENDIDO (7+ days) or PAGO_OBLIGATORIO (4-6 days): block everyone EXCEPT owner/admin
                    if plan_estado in ("SUSPENDIDO", "PAGO_OBLIGATORIO") and not is_owner_or_admin:
                        logger.info(f"[LOGIN] Blocked {user_role} '{identifier}' - school subscription: {plan_estado} ({dias_vencido} dias)")
                        raise HTTPException(
                            status_code=403,
                            detail="El acceso a la plataforma esta temporalmente suspendido. Comuniquese con la administracion de su colegio."
                        )
                except HTTPException:
                    raise
                except Exception as sub_err:
                    logger.error(f"[LOGIN] Error checking subscription: {sub_err}")
                
                # Student status login restriction
                if user.get("role") == "student":
                    sstatus = user.get("student_status", "active")
                    if sstatus == "pending":
                        allow_pending = school.get("permitir_acceso_estudiantes_pendientes", False) if school else False
                        if not allow_pending:
                            raise HTTPException(
                                status_code=403,
                                detail="Su matrícula aún no ha sido registrada. Por favor comuníquese con la administración del colegio."
                            )
                    if sstatus == "withdrawn":
                        raise HTTPException(
                            status_code=403,
                            detail="Tu cuenta de estudiante está en estado retirado. Comunícate con la administración."
                        )
            else:
                school_id = None

        try:
            token = create_token(
                user["id"], user["email"], user["name"], user["role"],
                school_id, subdomain, user.get("email_verified", False)
            )
        except Exception as token_err:
            logger.error(f"[LOGIN] Token creation error: {token_err}")
            raise HTTPException(status_code=500, detail="Error al generar sesion. Contacte soporte.")
        
        # Get RBAC permissions for the user
        try:
            permissions = await get_user_permissions(user, school_id)
        except Exception as perm_err:
            logger.error(f"[LOGIN] Permissions error: {perm_err}")
            permissions = {"role": user.get("role"), "is_owner": user.get("is_owner", False), "is_admin": False, "sections": {}}

        logger.info(f"[LOGIN] Success for: {identifier}, subdomain: {subdomain}")
        
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "username": user.get("username"),
                "name": user["name"],
                "last_name": user.get("last_name", ""),
                "role": user["role"],
                "school_id": school_id,
                "subdomain": subdomain,
                "email_verified": user.get("email_verified", False),
                "is_owner": user.get("is_owner", False),
                "is_super_admin": user.get("is_super_admin", False),
                "is_protected": user.get("is_protected", False),
                "is_demo_user": user.get("is_demo_user", False),
                "photo_url": user.get("photo_url"),
                "phone": user.get("phone"),
                "permissions": permissions
            },
            "redirect_to_subdomain": subdomain is not None,
            "redirect_url": f"https://{subdomain}.{BASE_DOMAIN}" if subdomain else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LOGIN] Unexpected error for {creds.email}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {type(e).__name__}")

@router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    """Get current user with school info and RBAC permissions"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Get school info - only if school has a subdomain (completed onboarding)
    subdomain = None
    school_id = user.get("school_id")
    
    if school_id:
        school = await db.schools.find_one({"id": school_id}, {"_id": 0})
        if school and school.get("subdomain"):
            subdomain = school.get("subdomain")
        else:
            # Legacy user - treat as not onboarded
            school_id = None
    
    # Get RBAC permissions
    permissions = await get_user_permissions(user, school_id)
    
    return {
        **user,
        "school_id": school_id,
        "subdomain": subdomain,
        "permissions": permissions
    }

@router.get("/auth/permissions")
async def get_permissions(current_user=Depends(get_current_user)):
    """Get RBAC permissions for the current user"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    permissions = await get_user_permissions(user)
    return permissions

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    
class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)

@router.put("/auth/profile")
async def update_profile(data: ProfileUpdate, current_user=Depends(get_current_user)):
    """Update current user's profile"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name.strip()
    if data.last_name is not None:
        update_data["last_name"] = data.last_name.strip()
    if data.username is not None:
        username = data.username.strip().lower()
        # Validate username format
        if username:
            if len(username) < 3:
                raise HTTPException(status_code=400, detail="El nombre de usuario debe tener al menos 3 caracteres")
            if len(username) > 30:
                raise HTTPException(status_code=400, detail="El nombre de usuario no puede tener más de 30 caracteres")
            if not re.match(r'^[a-z0-9_]+$', username):
                raise HTTPException(status_code=400, detail="El nombre de usuario solo puede contener letras, números y guiones bajos")
            # Check if username is already taken by another user
            existing = await db.users.find_one({
                "username": username,
                "id": {"$ne": user["id"]}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Este nombre de usuario ya está en uso")
            update_data["username"] = username
        else:
            update_data["username"] = None
    if data.phone is not None:
        update_data["phone"] = data.phone.strip()
    if data.photo_url is not None:
        # Delete old photo from Cloudinary if changing to new one
        if user.get("photo_url") and user["photo_url"] != data.photo_url:
            try:
                if "cloudinary.com" in user["photo_url"]:
                    parts = user["photo_url"].split("/upload/")
                    if len(parts) > 1:
                        path_with_ext = parts[1]
                        if path_with_ext.startswith("v"):
                            path_with_ext = "/".join(path_with_ext.split("/")[1:])
                        public_id = path_with_ext.rsplit(".", 1)[0]
                        cloudinary.uploader.destroy(public_id)
                        logger.info(f"Deleted old profile photo: {public_id}")
            except Exception as e:
                logger.error(f"Error deleting old photo: {e}")
        update_data["photo_url"] = data.photo_url
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0, "verification_code": 0})
    return {"message": "Perfil actualizado correctamente", "user": updated_user}

@router.put("/auth/password")
async def change_password(data: PasswordChange, current_user=Depends(get_current_user)):
    """Change current user's password"""
    user = await db.users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Verify current password
    if not bcrypt.checkpw(data.current_password.encode(), user["password"].encode()):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    
    # Hash new password
    new_hashed = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password": new_hashed,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Contraseña actualizada correctamente"}

@router.get("/auth/check-username/{username}")
async def check_username_availability(username: str, current_user=Depends(get_current_user)):
    """Check if a username is available"""
    username = username.strip().lower()
    
    if len(username) < 3:
        return {"available": False, "message": "Mínimo 3 caracteres"}
    if len(username) > 30:
        return {"available": False, "message": "Máximo 30 caracteres"}
    if not re.match(r'^[a-z0-9_]+$', username):
        return {"available": False, "message": "Solo letras, números y guiones bajos"}
    
    # Check if username is taken by another user
    existing = await db.users.find_one({
        "username": username,
        "id": {"$ne": current_user["sub"]}
    })
    
    if existing:
        return {"available": False, "message": "Este nombre de usuario ya está en uso"}
    
    return {"available": True, "message": "Nombre de usuario disponible"}

# ══════════════════════════════════════════════════════════════════════════════
# SUBDOMAIN ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/subdomain/check")
async def check_subdomain(subdomain: str) -> CheckSubdomainResponse:
    """
    Check if subdomain is available.
    Validates ONLY against database, NOT DNS.
    """
    subdomain = subdomain.lower().strip()
    
    # Validate format: ^[a-z0-9]{3,}$
    if not re.match(r'^[a-z0-9]+$', subdomain):
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="Solo letras minúsculas y números, sin espacios ni caracteres especiales"
        )
    
    # Minimum length: 3
    if len(subdomain) < 3:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="El subdominio debe tener al menos 3 caracteres"
        )
    
    # Maximum length: 30
    if len(subdomain) > 30:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="El subdominio debe tener máximo 30 caracteres"
        )

    # Check reserved subdomains
    if subdomain in RESERVED_SUBDOMAINS:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="Este subdominio está reservado"
        )

    # Check database for existing subdomain (case-insensitive)
    existing = await db.schools.find_one({"subdomain": subdomain})
    if existing:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="Este subdominio ya está en uso. Prueba otro nombre."
        )

    return CheckSubdomainResponse(
        available=True, 
        subdomain=subdomain,
        reason="¡Disponible!"
    )

# ══════════════════════════════════════════════════════════════════════════════
# SCHOOL (TENANT) CREATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/schools/create")
async def create_school(data: CreateSchoolRequest, current_user=Depends(get_current_user)):
    """
    Step 3: Create school (tenant) with subdomain.
    This is REQUIRED before accessing dashboard.
    
    Actions:
      1. Validate subdomain
      2. Create or update school record
      3. Update user.school_id
      4. Return redirect URL
    """
    # Check if user already has a school
    user = await db.users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    existing_school = None
    if user.get("school_id"):
        # User has a school_id, check if that school has a subdomain
        existing_school = await db.schools.find_one({"id": user["school_id"]}, {"_id": 0})
        if existing_school and existing_school.get("subdomain"):
            # School already has subdomain - user already completed onboarding
            return {
                "message": "Ya tienes un colegio creado",
                "subdomain": existing_school["subdomain"],
                "full_domain": existing_school["full_domain"],
                "redirect_url": f"https://{existing_school['subdomain']}.{BASE_DOMAIN}"
            }
        # If school exists but has no subdomain, we'll update it below
    
    # Check email verification
    if not user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Debes verificar tu email primero")

    subdomain = data.subdomain.lower().strip()
    
    # Validate format
    if not re.match(r'^[a-z0-9]{3,}$', subdomain):
        raise HTTPException(status_code=400, detail="Formato de subdominio inválido")

    # Check reserved
    if subdomain in RESERVED_SUBDOMAINS:
        raise HTTPException(status_code=400, detail="Este subdominio está reservado")

    # Check availability one more time
    existing = await db.schools.find_one({"subdomain": subdomain})
    if existing:
        raise HTTPException(status_code=400, detail="Este subdominio ya está en uso. Prueba otro nombre.")

    full_domain = f"{subdomain}.{BASE_DOMAIN}"

    if existing_school:
        # UPDATE existing school record (legacy user completing onboarding)
        school_id = existing_school["id"]
        update_fields = {
            "subdomain": subdomain,
            "full_domain": full_domain,
            "status": "active",
            "owner_user_id": user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        # Set expiration_date if not already set
        if not existing_school.get("expiration_date"):
            update_fields["expiration_date"] = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        await db.schools.update_one(
            {"id": school_id},
            {"$set": update_fields}
        )
        
        # Update owner user with super admin privileges
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "role": "owner",
                "is_owner": True,
                "is_super_admin": True,
                "is_protected": True,  # Cannot be deleted or demoted
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"School updated with subdomain: {subdomain}.{BASE_DOMAIN} for user {user['email']} (Super Admin)")
        
        # Create system support user (Admin Técnico) if not exists
        existing_support = await db.users.find_one({
            "school_id": school_id,
            "is_system_user": True
        })
        if not existing_support:
            await create_system_support_user(db, school_id)
        
        # Seed demo data for the school
        await seed_demo_data_for_school(db, school_id, user["id"])
    else:
        # CREATE new school record
        school_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        expiration_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        school_doc = {
            "id": school_id,
            "school_name": user["name"],
            "subdomain": subdomain,
            "full_domain": full_domain,
            "status": "active",
            "owner_user_id": user["id"],
            "created_at": created_at,
            "expiration_date": expiration_date,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.schools.insert_one(school_doc)
        
        # Update user with school_id and super admin privileges
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "school_id": school_id,
                "role": "owner",
                "is_owner": True,
                "is_super_admin": True,
                "is_protected": True,  # Cannot be deleted or demoted
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"School created: {subdomain}.{BASE_DOMAIN} for user {user['email']} (Super Admin)")
        
        # Create system support user (Admin Técnico) for the new school
        await create_system_support_user(db, school_id)
        
        # Seed demo data for the new school
        await seed_demo_data_for_school(db, school_id, user["id"])

    # Create new token with school info
    new_token = create_token(
        user["id"], user["email"], user["name"], "owner",
        school_id, subdomain, True
    )

    return {
        "message": "¡Tu intranet ha sido creada!",
        "school_id": school_id,
        "subdomain": subdomain,
        "full_domain": full_domain,
        "redirect_url": f"https://{full_domain}",
        "token": new_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": "owner",
            "is_owner": True,
            "is_super_admin": True,
            "school_id": school_id,
            "subdomain": subdomain,
            "email_verified": True
        }
    }

# ══════════════════════════════════════════════════════════════════════════════
# TENANT INFO ROUTE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/tenant/info")
async def get_tenant_info(request: Request):
    """
    Get current tenant info based on Host header.
    Used by frontend to determine routing behavior.
    """
    tenant = await get_tenant_from_request(request)
    
    if tenant["is_main_domain"]:
        return {
            "is_main_domain": True,
            "subdomain": None,
            "school": None,
            "message": "Dominio principal"
        }
    
    if not tenant["school"]:
        return {
            "is_main_domain": False,
            "subdomain": tenant["subdomain"],
            "school": None,
            "error": "Este colegio no existe o fue desactivado"
        }
    
    return {
        "is_main_domain": False,
        "subdomain": tenant["subdomain"],
        "school": {
            "id": tenant["school"]["id"],
            "school_name": tenant["school"]["school_name"],
            "subdomain": tenant["school"]["subdomain"],
            "full_domain": tenant["school"]["full_domain"],
            "status": tenant["school"]["status"]
        }
    }

# ══════════════════════════════════════════════════════════════════════════════
# FIX/REPAIR OWNER PERMISSIONS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/auth/fix-owner-permissions")
async def fix_owner_permissions(current_user=Depends(get_current_user)):
    """
    Fix owner permissions for the current user.
    If the user is the owner of the school (owner_user_id matches), 
    this will grant them proper owner/super_admin flags.
    Also seeds demo data if the school is empty.
    """
    user = await db.users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if not user.get("school_id"):
        raise HTTPException(status_code=400, detail="No tienes un colegio asociado")
    
    # Get the school
    school = await db.schools.find_one({"id": user["school_id"]})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    # Check if user is the owner of this school
    is_school_owner = school.get("owner_user_id") == user["id"]
    
    # Also check if user was the first user in the school
    first_user = await db.users.find_one(
        {"school_id": user["school_id"]},
        sort=[("created_at", 1)]
    )
    is_first_user = first_user and first_user["id"] == user["id"]
    
    if is_school_owner or is_first_user:
        # Grant owner/super_admin permissions
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "role": "director",
                "is_owner": True,
                "is_super_admin": True,
                "is_protected": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update school owner_user_id if not set
        if not school.get("owner_user_id"):
            await db.schools.update_one(
                {"id": school["id"]},
                {"$set": {"owner_user_id": user["id"]}}
            )
        
        # Check if demo data needs to be seeded
        levels_count = await db.academic_levels.count_documents({"school_id": user["school_id"]})
        if levels_count == 0:
            # Seed demo data
            await seed_demo_data_for_school(db, user["school_id"], user["id"])
            seeded = True
        else:
            seeded = False
        
        # Generate new token with correct permissions
        new_token = create_token(
            user["id"], user["email"], user["name"], "director",
            user["school_id"], school.get("subdomain"), True
        )
        
        return {
            "success": True,
            "message": "Permisos de propietario restaurados correctamente",
            "token": new_token,
            "demo_data_seeded": seeded,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": "director",
                "is_owner": True,
                "is_super_admin": True,
                "school_id": user["school_id"],
                "subdomain": school.get("subdomain")
            }
        }
    else:
        raise HTTPException(
            status_code=403, 
            detail="No eres el propietario de esta intranet"
        )

# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC SCHOOL INFO (For branded login pages)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/schools/public/{subdomain}")
async def get_school_public_info(subdomain: str):
    """
    Get public info for a school by subdomain.
    Used to display branded login pages.
    Returns: school_name, logo_url, colors, etc.
    """
    subdomain = subdomain.lower().strip()
    
    school = await db.schools.find_one(
        {"subdomain": subdomain, "status": "active"},
        {"_id": 0, "password": 0, "owner_user_id": 0}
    )
    
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    return {
        "subdomain": school.get("subdomain"),
        "school_name": school.get("school_name"),
        "full_domain": school.get("full_domain"),
        "logo_url": school.get("logo_url"),  # Can be null
        "primary_color": school.get("primary_color", "#001f4b"),
        "secondary_color": school.get("secondary_color", "#e1b82c"),
        "login_background_url": school.get("login_background_url"),
    }

# ══════════════════════════════════════════════════════════════════════════════

