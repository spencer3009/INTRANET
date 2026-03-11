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
    }

# ══════════════════════════════════════════════════════════════════════════════

