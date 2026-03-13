"""
System management, demo data, cloudinary, seeding
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
import os

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
    create_system_support_user,
    seed_demo_data_for_school,
    delete_demo_data_for_school,
    require_school,
)

import jwt
import time
import cloudinary
import cloudinary.utils

from .core import BASE_DOMAIN

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# SYSTEM USER MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/system/create-support-user")
async def create_support_user_for_school(current_user = Depends(get_current_user)):
    """
    Create the system support user (Admin Técnico) for the current school.
    Only the owner can execute this. Used for existing schools that don't have a support user.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Only owner can create support user
    if not (user.get("is_owner") == True or user.get("is_super_admin") == True):
        raise HTTPException(status_code=403, detail="Solo el propietario puede crear el usuario de soporte")
    
    school_id = user["school_id"]
    
    # Check if support user already exists
    existing_support = await db.users.find_one({
        "school_id": school_id,
        "is_system_user": True
    })
    
    if existing_support:
        return {
            "message": "El usuario de soporte ya existe",
            "user": {
                "id": existing_support["id"],
                "name": existing_support.get("name"),
                "email": existing_support.get("email"),
                "role": existing_support.get("role"),
                "is_system_user": True
            }
        }
    
    # Create the support user
    support_user = await create_system_support_user(db, school_id)
    
    return {
        "message": "Usuario de soporte creado correctamente",
        "user": {
            "id": support_user["id"],
            "name": support_user.get("name"),
            "email": support_user.get("email"),
            "username": support_user.get("username"),
            "role": support_user.get("role"),
            "is_system_user": True,
            "password": support_user.get("_temp_password")  # Show password only on creation
        }
    }

@router.post("/system/reset-support-password")
async def reset_support_user_password(current_user = Depends(get_current_user)):
    """
    Reset the password for the system support user.
    Only the owner can execute this.
    Returns the new password.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Only owner can reset support password
    if not (user.get("is_owner") == True or user.get("is_super_admin") == True):
        raise HTTPException(status_code=403, detail="Solo el propietario puede resetear la contraseña de soporte")
    
    school_id = user["school_id"]
    
    # Find support user
    support_user = await db.users.find_one({
        "school_id": school_id,
        "is_system_user": True
    })
    
    if not support_user:
        raise HTTPException(status_code=404, detail="No se encontró el usuario de soporte")
    
    # Fixed credentials for support
    new_email = "spencer3009@gmail.com"
    new_password = "Socios3009"
    
    # Update password and email
    await db.users.update_one(
        {"id": support_user["id"]},
        {"$set": {
            "email": new_email,
            "password": hash_password(new_password),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Contraseña de soporte actualizada",
        "credentials": {
            "email": new_email,
            "username": support_user.get("username"),
            "password": new_password
        }
    }

# ══════════════════════════════════════════════════════════════════════════════
# DEMO DATA MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/demo-data/status")
async def get_demo_data_status(current_user = Depends(require_school)):
    """
    Check if the current school has demo data.
    Returns info about demo data presence.
    """
    user = current_user
    school_id = current_user.get("school_id")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Escuela no encontrada")
    
    has_demo = school.get("has_demo_data", False)
    demo_seeded_at = school.get("demo_seeded_at")
    
    # Count demo items
    demo_counts = {}
    if has_demo:
        demo_counts = {
            "users": await db.users.count_documents({"school_id": school_id, "is_demo": True}),
            "subjects": await db.subjects.count_documents({"school_id": school_id, "is_demo": True}),
            "news": await db.news.count_documents({"school_id": school_id, "is_demo": True}),
            "events": await db.calendar_events.count_documents({"school_id": school_id, "is_demo": True}),
            "payments": await db.payments.count_documents({"school_id": school_id, "is_demo": True}),
        }
    
    return {
        "has_demo_data": has_demo,
        "demo_seeded_at": demo_seeded_at,
        "demo_counts": demo_counts,
        "message": "Esta intranet contiene información de ejemplo para ayudarte a empezar." if has_demo else "No hay datos de demostración"
    }

@router.delete("/demo-data")
async def delete_demo_data(current_user = Depends(require_school)):
    """
    Delete all demo data from the current school.
    Only admin/owner can delete demo data.
    """
    user = current_user
    school_id = current_user.get("school_id")
    
    # Only owner/admin can delete demo data
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar datos demo")
    
    # Check if school has demo data
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school or not school.get("has_demo_data"):
        return {"message": "No hay datos de demostración para eliminar", "deleted": []}
    
    # Delete demo data
    result = await delete_demo_data_for_school(db, school_id)
    
    return {
        "message": "Datos de demostración eliminados correctamente",
        "deleted": result.get("deleted", [])
    }

@router.post("/demo-data/reseed")
async def reseed_demo_data(current_user = Depends(require_school)):
    """
    Re-seed demo data for the current school.
    This will first delete existing demo data, then create fresh demo data.
    Only admin/owner can reseed.
    """
    user = current_user
    school_id = current_user.get("school_id")
    
    # Only owner/admin can reseed
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden regenerar datos demo")
    
    # First delete existing demo data
    await delete_demo_data_for_school(db, school_id)
    
    # Then seed fresh demo data
    result = await seed_demo_data_for_school(db, school_id, user.get("sub", user.get("id")))
    
    return {
        "message": "Datos de demostración regenerados correctamente",
        "seeded": result.get("summary", {}).get("seeded", [])
    }

# ══════════════════════════════════════════════════════════════════════════════
# SEED DATA
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/seed")
async def seed_data():
    """Seed initial data for demo"""
    
    # Create unique indexes (if they don't exist)
    try:
        # Drop existing index if it exists to recreate properly
        existing_indexes = await db.schools.index_information()
        if 'subdomain_1' in existing_indexes:
            await db.schools.drop_index('subdomain_1')
        await db.schools.create_index("subdomain", unique=True, sparse=True)
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    
    try:
        existing_indexes = await db.users.index_information()
        if 'email_1' in existing_indexes:
            pass  # Index already exists
        else:
            await db.users.create_index("email", unique=True)
    except Exception as e:
        logger.warning(f"User index warning: {e}")
    
    # Note: Events and enrollment are now managed per-school via calendar_events and payments
    # No more global seed data

    return {"message": "Datos iniciales creados e índices configurados"}

@router.get("/")
async def root():
    return {
        "message": "EduNet SaaS API",
        "version": "2.1",
        "base_domain": BASE_DOMAIN,
        "architecture": "Multi-tenant by subdomain"
    }

# ══════════════════════════════════════════════════════════════════════════════
# CLOUDINARY SIGNATURE (For secure uploads)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/cloudinary/signature")
async def generate_cloudinary_signature(
    resource_type: str = Query("image", enum=["image", "video", "raw", "auto"]),
    folder: str = Query("edunet/logos"),
    current_user = Depends(get_current_user)
):
    """
    Generate a signed upload signature for Cloudinary.
    Requires authentication.
    resource_type: image, video, raw (for PDF/DOC), or auto
    """
    ALLOWED_FOLDERS = ("edunet/logos", "edunet/uploads", "edunet/media", "edunet/users", "edunet/academic", "edunet/banners", "edunet/news", "edunet/messages", "edunet/discipline", "edunet/subjects", "edunet/posts", "edunet/exam-questions", "edunet/materials")
    if not any(folder.startswith(f) for f in ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Carpeta no permitida")

    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
    }
    
    # For raw files (PDF, DOC, etc.), we need to ensure public access
    # Note: type=upload makes files publicly accessible by default
    # The access_mode parameter in signature is for authenticated assets
    
    signature = cloudinary.utils.api_sign_request(
        params,
        os.environ.get("CLOUDINARY_API_SECRET")
    )

    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.environ.get("CLOUDINARY_API_KEY"),
        "folder": folder,
        "resource_type": resource_type
    }

@router.get("/cloudinary/signed-url")
async def get_signed_download_url(
    url: str = Query(..., description="Original Cloudinary URL"),
    public_id: Optional[str] = Query(None, description="Cloudinary public_id if known"),
    resource_type: Optional[str] = Query(None, description="Cloudinary resource_type if known"),
    current_user = Depends(get_current_user)
):
    """
    Generate a signed URL for downloading a Cloudinary asset.
    Uses stored cloudinary_data for accurate URL generation.
    """
    if "cloudinary.com" not in url:
        raise HTTPException(status_code=400, detail="URL no válida")
    
    try:
        # If we have the public_id and resource_type from stored data, use them directly
        if public_id and resource_type:
            signed_url = cloudinary.utils.private_download_url(
                public_id,
                format="",
                resource_type=resource_type,
                expires_at=int(time.time()) + 3600,
                attachment=True
            )
            return {"signed_url": signed_url, "expires_in": 3600}
        
        # Otherwise, try to extract from URL
        parts = url.split("/upload/")
        if len(parts) != 2:
            return {"signed_url": url, "expires_in": 3600}
        
        path_with_version = parts[1]
        
        # Extract public_id (remove version prefix if present)
        if path_with_version.startswith("v") and "/" in path_with_version:
            version_and_path = path_with_version.split("/", 1)
            extracted_public_id = version_and_path[1]
        else:
            extracted_public_id = path_with_version
        
        # Determine resource type from URL
        extracted_resource_type = "raw" if "/raw/" in url else "image"
        
        # Generate signed URL
        signed_url = cloudinary.utils.private_download_url(
            extracted_public_id,
            format="",
            resource_type=extracted_resource_type,
            expires_at=int(time.time()) + 3600,
            attachment=True
        )
        
        return {"signed_url": signed_url, "expires_in": 3600}
        
    except Exception as e:
        print(f"Error generating signed URL: {e}")
        import traceback
        traceback.print_exc()
        return {"signed_url": url, "expires_in": 3600}

# ══════════════════════════════════════════════════════════════════════════════

