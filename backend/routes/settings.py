"""
Tenant settings management
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
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

class TenantSettings(BaseModel):
    logo_url: Optional[str] = None
    system_name: Optional[str] = None
    system_title: Optional[str] = None
    system_email: Optional[str] = None
    currency: Optional[Literal["PEN", "USD", "EUR"]] = "PEN"
    whatsapp: Optional[str] = None
    website_url: Optional[str] = None

class TenantSettingsUpdate(BaseModel):
    logo_url: Optional[str] = None
    system_name: Optional[str] = None
    system_title: Optional[str] = None
    system_email: Optional[str] = None
    currency: Optional[Literal["PEN", "USD", "EUR"]] = None
    whatsapp: Optional[str] = None
    website_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None

# TENANT SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/settings")
async def get_tenant_settings(current_user = Depends(require_section_access("settings"))):
    """
    Get settings for the current user's tenant.
    RBAC: Only owner can access this section.
    """
    user = current_user  # Already validated by require_section_access
    school_id = user.get("school_id")
    
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Get school info
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    # Get or create settings
    settings = await db.tenant_settings.find_one(
        {"school_id": school_id},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults based on school
        settings = {
            "school_id": school_id,
            "logo_url": None,
            "system_name": school.get("school_name", ""),
            "system_title": f"{school.get('school_name', '')} - Intranet",
            "system_email": user.get("email", ""),
            "currency": "PEN",
            "whatsapp": None,
            "website_url": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Include school-level role settings
    settings["allow_admin_accounting"] = school.get("allow_admin_accounting", False)
    settings["restrict_grades_if_debt"] = school.get("restrict_grades_if_debt", False)
    settings["permitir_acceso_estudiantes_pendientes"] = school.get("permitir_acceso_estudiantes_pendientes", False)
    settings["allow_admin_broadcast"] = school.get("allow_admin_broadcast", False)
    
    # Include attendance config (new structure with levels)
    default_config = {
        "teachers": {"entry_time": "07:15", "exit_time": "13:00"},
        "levels": [],
        "tolerance_minutes": 5,
        "mark_absent_after_minutes": 30,
        "auto_late_enabled": False,
    }
    raw_config = school.get("attendance_config", {})
    # Migrate old flat format to new structure
    if "student_entry_time" in raw_config and "teachers" not in raw_config:
        raw_config = {
            "teachers": {"entry_time": raw_config.get("teacher_entry_time", "07:15"), "exit_time": "13:00"},
            "levels": [],
            "tolerance_minutes": raw_config.get("tolerance_minutes", 5),
            "mark_absent_after_minutes": raw_config.get("mark_absent_after_minutes", 30),
            "auto_late_enabled": raw_config.get("auto_late_enabled", False),
        }
    settings["attendance_config"] = {**default_config, **raw_config}
    
    return settings

@router.put("/settings")
async def update_tenant_settings(
    data: TenantSettingsUpdate,
    current_user = Depends(require_section_access("settings"))
):
    """
    Update settings for the current user's tenant.
    RBAC: Only owner can access this section.
    """
    user = current_user  # Already validated by require_section_access
    school_id = user.get("school_id")
    
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Build update document (only include non-None values)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Upsert settings
    result = await db.tenant_settings.update_one(
        {"school_id": school_id},
        {
            "$set": update_data,
            "$setOnInsert": {
                "school_id": school_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Also update logo_url in schools collection for public access
    if data.logo_url is not None:
        await db.schools.update_one(
            {"id": school_id},
            {"$set": {"logo_url": data.logo_url}}
        )
    
    # Return updated settings
    settings = await db.tenant_settings.find_one(
        {"school_id": school_id},
        {"_id": 0}
    )
    
    logger.info(f"Settings updated for school {school_id}")
    
    return {
        "message": "Ajustes guardados correctamente",
        "settings": settings
    }

@router.put("/settings/roles")
async def update_role_settings(
    data: dict = Body(...),
    current_user = Depends(require_section_access("settings"))
):
    """
    Update role-specific settings (feature flags).
    RBAC: Only owner can access this section.
    """
    user = current_user
    school_id = user.get("school_id")
    
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Update allowed fields only
    allowed_fields = ["allow_admin_accounting", "restrict_grades_if_debt", "permitir_acceso_estudiantes_pendientes", "allow_admin_broadcast"]
    update_data = {}
    for field in allowed_fields:
        if field in data:
            update_data[field] = bool(data[field])
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.schools.update_one(
            {"id": school_id},
            {"$set": update_data}
        )
    
    # Get updated school
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "allow_admin_accounting": 1, "restrict_grades_if_debt": 1, "permitir_acceso_estudiantes_pendientes": 1, "allow_admin_broadcast": 1})
    
    logger.info(f"Role settings updated for school {school_id}: {update_data}")
    
    return {
        "message": "Configuración de roles actualizada",
        "allow_admin_accounting": school.get("allow_admin_accounting", False),
        "restrict_grades_if_debt": school.get("restrict_grades_if_debt", False),
        "permitir_acceso_estudiantes_pendientes": school.get("permitir_acceso_estudiantes_pendientes", False),
        "allow_admin_broadcast": school.get("allow_admin_broadcast", False)
    }


class AttendanceLevelConfig(BaseModel):
    level_id: str
    entry_time: str
    exit_time: str

class AttendanceTeacherConfig(BaseModel):
    entry_time: str
    exit_time: str

class AttendanceConfigUpdate(BaseModel):
    teachers: Optional[AttendanceTeacherConfig] = None
    levels: Optional[List[AttendanceLevelConfig]] = None
    tolerance_minutes: Optional[int] = None
    mark_absent_after_minutes: Optional[int] = None
    auto_late_enabled: Optional[bool] = None

@router.put("/settings/attendance")
async def update_attendance_config(
    data: AttendanceConfigUpdate,
    current_user = Depends(require_section_access("settings"))
):
    """Update attendance configuration for the school (levels-based)."""
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    update_data = {}
    if data.teachers is not None:
        update_data["attendance_config.teachers"] = data.teachers.model_dump()
    if data.levels is not None:
        update_data["attendance_config.levels"] = [l.model_dump() for l in data.levels]
    if data.tolerance_minutes is not None:
        update_data["attendance_config.tolerance_minutes"] = data.tolerance_minutes
    if data.mark_absent_after_minutes is not None:
        update_data["attendance_config.mark_absent_after_minutes"] = data.mark_absent_after_minutes
    if data.auto_late_enabled is not None:
        update_data["attendance_config.auto_late_enabled"] = data.auto_late_enabled

    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.schools.update_one({"id": school_id}, {"$set": update_data})

    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "attendance_config": 1})
    logger.info(f"Attendance config updated for school {school_id}")
    return {
        "message": "Configuracion de asistencia actualizada",
        "attendance_config": school.get("attendance_config", {})
    }


@router.get("/settings/public/{subdomain}")
async def get_public_settings(subdomain: str):
    """
    Get public settings for a school by subdomain.
    Used to customize login pages, etc.
    """
    subdomain = subdomain.lower().strip()
    
    school = await db.schools.find_one(
        {"subdomain": subdomain, "status": "active"},
        {"_id": 0}
    )
    
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    settings = await db.tenant_settings.find_one(
        {"school_id": school["id"]},
        {"_id": 0}
    )
    
    # Merge school info with settings
    return {
        "subdomain": school.get("subdomain"),
        "school_name": school.get("school_name"),
        "full_domain": school.get("full_domain"),
        "logo_url": settings.get("logo_url") if settings else school.get("logo_url"),
        "system_name": settings.get("system_name") if settings else school.get("school_name"),
        "system_title": settings.get("system_title") if settings else f"{school.get('school_name')} - Intranet",
        "primary_color": school.get("primary_color", "#001f4b"),
        "secondary_color": school.get("secondary_color", "#e1b82c"),
        "login_background_url": school.get("login_background_url"),
    }

# ══════════════════════════════════════════════════════════════════════════════



# ══════════════════════════════════════════════════════════════════════════════
# LOGIN BACKGROUND IMAGE
# ══════════════════════════════════════════════════════════════════════════════

import cloudinary
import cloudinary.uploader

@router.put("/settings/login-background")
async def upload_login_background(
    file: UploadFile = File(...),
    current_user = Depends(require_section_access("settings"))
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    if file.content_type not in ["image/jpeg", "image/jpg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Formato no soportado. Usa JPG, PNG o WebP.")

    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "id": 1, "login_background_public_id": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")

    # Delete old image from Cloudinary if exists
    old_public_id = school.get("login_background_public_id")
    if old_public_id:
        try:
            cloudinary.uploader.destroy(old_public_id)
        except Exception as e:
            logger.warning(f"Failed to delete old login background from Cloudinary: {e}")

    # Upload new image
    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            folder=f"schools/{school_id}/login_background",
            format="webp",
            transformation=[{"width": 1500, "crop": "limit"}],
            resource_type="image"
        )
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(status_code=500, detail="Error al subir la imagen")

    login_bg_url = result.get("secure_url")
    login_bg_public_id = result.get("public_id")

    await db.schools.update_one(
        {"id": school_id},
        {"$set": {
            "login_background_url": login_bg_url,
            "login_background_public_id": login_bg_public_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {"message": "Imagen de fondo actualizada", "login_background_url": login_bg_url}


@router.delete("/settings/login-background")
async def delete_login_background(
    current_user = Depends(require_section_access("settings"))
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "id": 1, "login_background_public_id": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")

    old_public_id = school.get("login_background_public_id")
    if old_public_id:
        try:
            cloudinary.uploader.destroy(old_public_id)
        except Exception as e:
            logger.warning(f"Failed to delete login background from Cloudinary: {e}")

    await db.schools.update_one(
        {"id": school_id},
        {"$set": {
            "login_background_url": None,
            "login_background_public_id": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {"message": "Imagen de fondo eliminada"}


@router.get("/settings/login-background")
async def get_login_background(
    current_user = Depends(require_section_access("settings"))
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "id": 1, "login_background_url": 1})
    return {"login_background_url": school.get("login_background_url") if school else None}
