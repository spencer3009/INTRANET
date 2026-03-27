"""
User CRUD, student import
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
    ACADEMIC_STUDENT_FILTER, ACADEMIC_STUDENT_FILTER_WITH_PENDING,
    create_system_support_user,
)

from services.qr_service import generate_user_qr
import io
import csv
import unicodedata
import cloudinary
import cloudinary.uploader
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, Protection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# USERS MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/users")
async def get_tenant_users(current_user = Depends(get_current_user)):
    """
    Get all users for the current tenant.
    Only admins/directors/owners/super_admins can view users.
    System users (Admin Técnico) are only visible to owners and system_admins.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check role - owners, super_admins, directors and admins can view users
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver usuarios")
    
    school_id = user["school_id"]
    
    # Build query - system users only visible to owners and system_admins
    query = {"school_id": school_id, "student_status": {"$ne": "deleted"}}
    
    # Only owners and system_admins can see system users
    can_see_system_users = (
        user.get("is_owner") == True or 
        user.get("role") == "system_admin" or
        user.get("is_super_admin") == True
    )
    
    if not can_see_system_users:
        query["is_system_user"] = {"$ne": True}
    
    # Get all users for this school
    users_cursor = db.users.find(
        query,
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    users = await users_cursor.to_list(length=1000)
    
    return users

@router.get("/users/{user_id}")
async def get_user_by_id(user_id: str, current_user = Depends(get_current_user)):
    """Get a specific user by ID"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check role - owners, super_admins, directors and admins can view users
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver usuarios")
    
    target_user = await db.users.find_one(
        {"id": user_id, "school_id": user["school_id"]},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return target_user

class CreateUserRequest(BaseModel):
    """Request to create a new user"""
    username: str
    password: str
    name: str
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    birthday: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    role: str = "teacher"
    photo_url: Optional[str] = None
    # Demo user flag - only owner can create demo users
    is_demo_user: Optional[bool] = False
    # Academic fields for students
    nivel_id: Optional[str] = None
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    turno_id: Optional[str] = None
    padre_id: Optional[str] = None  # Link student to parent
    # Student complementary info
    condiciones_medicas: Optional[str] = None
    alergias: Optional[str] = None
    doctor_nombre: Optional[str] = None
    doctor_telefono: Optional[str] = None
    persona_autorizada: Optional[str] = None
    persona_autorizada_telefono: Optional[str] = None
    notas: Optional[str] = None
    # Parent-specific fields
    dni: Optional[str] = None
    ocupacion: Optional[str] = None
    lugar_trabajo: Optional[str] = None
    telefono_trabajo: Optional[str] = None

@router.get("/users/check-username/{username}")
async def check_username(username: str, current_user = Depends(get_current_user)):
    """Check if username is available"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    existing = await db.users.find_one({
        "username": username.lower(),
        "school_id": user["school_id"]
    })
    
    return {
        "available": existing is None,
        "username": username
    }

@router.post("/users")
async def create_user(data: CreateUserRequest, current_user = Depends(get_current_user)):
    """
    Create a new user for the current tenant.
    Only admins/owners can create users.
    Demo users can only be created by the real owner.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Block demo users from creating users
    check_demo_user_block(user)
    
    # Check role - only owner or admin can create users
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear usuarios")
    
    # Only real owner can create demo users
    if data.is_demo_user:
        if not is_real_owner(user):
            raise HTTPException(status_code=403, detail="Solo el propietario puede crear usuarios demo")
    
    school_id = user["school_id"]
    
    # Check if username already exists in this school
    existing = await db.users.find_one({
        "username": data.username.lower(),
        "school_id": school_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    # Check if email already exists (if provided)
    if data.email:
        existing_email = await db.users.find_one({
            "email": data.email.lower(),
            "school_id": school_id
        })
        if existing_email:
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    # Create user
    new_user = {
        "id": str(uuid.uuid4()),
        "username": data.username.lower(),
        "password": hash_password(data.password),
        "plain_password": data.password,
        "name": data.name,
        "last_name": data.last_name,
        "email": data.email.lower() if data.email else None,
        "phone": data.phone,
        "birthday": data.birthday,
        "gender": data.gender,
        "address": data.address,
        "role": data.role,
        "photo_url": data.photo_url,
        "school_id": school_id,
        "email_verified": True,  # Created by admin, no verification needed
        "is_demo_user": data.is_demo_user or False,  # Demo user flag
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add academic fields for students
    if data.role == "student":
        new_user["nivel_id"] = data.nivel_id
        new_user["grado_id"] = data.grado_id
        new_user["seccion_id"] = data.seccion_id
        new_user["turno_id"] = data.turno_id
        # Check activation mode from financial settings
        fin_settings = await db.school_financial_settings.find_one(
            {"school_id": school_id}, {"_id": 0, "activacion_modo": 1}
        )
        activation_mode = (fin_settings or {}).get("activacion_modo", "on_create")
        if activation_mode == "on_create":
            new_user["student_status"] = "active"
        else:
            new_user["student_status"] = "pending"
        if data.padre_id:
            new_user["padre_id"] = data.padre_id
        # Complementary info
        if data.condiciones_medicas:
            new_user["condiciones_medicas"] = data.condiciones_medicas
        if data.alergias:
            new_user["alergias"] = data.alergias
        if data.doctor_nombre:
            new_user["doctor_nombre"] = data.doctor_nombre
        if data.doctor_telefono:
            new_user["doctor_telefono"] = f"+51{data.doctor_telefono}" if data.doctor_telefono and not data.doctor_telefono.startswith("+") else data.doctor_telefono
        if data.persona_autorizada:
            new_user["persona_autorizada"] = data.persona_autorizada
        if data.persona_autorizada_telefono:
            new_user["persona_autorizada_telefono"] = f"+51{data.persona_autorizada_telefono}" if data.persona_autorizada_telefono and not data.persona_autorizada_telefono.startswith("+") else data.persona_autorizada_telefono
        if data.notas:
            new_user["notas"] = data.notas
        
        # Generate short QR (centralized service)
        qr_id, qr_token = await generate_user_qr(db)
        new_user["qr_id"] = qr_id
        new_user["qr_token"] = qr_token
        new_user["qr_version"] = 2
    
    # Add parent-specific fields
    if data.role == "parent":
        new_user["dni"] = data.dni
        new_user["ocupacion"] = data.ocupacion
        new_user["lugar_trabajo"] = data.lugar_trabajo
        new_user["telefono_trabajo"] = data.telefono_trabajo
    
    # Generate short QR for teachers (centralized service)
    if data.role == "teacher":
        qr_id, qr_token = await generate_user_qr(db)
        new_user["qr_id"] = qr_id
        new_user["qr_token"] = qr_token
        new_user["qr_version"] = 2
    
    await db.users.insert_one(new_user)
    
    # Remove sensitive fields before returning
    del new_user["password"]
    if "_id" in new_user:
        del new_user["_id"]
    
    logger.info(f"User created: {data.username} with role {data.role} in school {school_id}")
    
    return {
        "message": "Usuario creado correctamente",
        "user": new_user
    }

class UpdateUserRequest(BaseModel):
    """Request to update an existing user"""
    name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    birthday: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    role: Optional[str] = None
    photo_url: Optional[str] = None
    password: Optional[str] = None  # For password changes
    # Academic fields for students
    nivel_id: Optional[str] = None
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    turno_id: Optional[str] = None
    padre_id: Optional[str] = None
    parent_id: Optional[str] = None  # Alias for padre_id (frontend compatibility)
    # Student complementary info
    condiciones_medicas: Optional[str] = None
    alergias: Optional[str] = None
    doctor_nombre: Optional[str] = None
    doctor_telefono: Optional[str] = None
    persona_autorizada: Optional[str] = None
    persona_autorizada_telefono: Optional[str] = None
    notas: Optional[str] = None
    # Parent-specific fields
    dni: Optional[str] = None
    ocupacion: Optional[str] = None
    lugar_trabajo: Optional[str] = None
    telefono_trabajo: Optional[str] = None

@router.put("/users/{user_id}")
async def update_user(user_id: str, data: UpdateUserRequest, current_user = Depends(get_current_user)):
    """Update an existing user"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar usuarios")
    
    # Find target user
    target = await db.users.find_one({"id": user_id, "school_id": user["school_id"]})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # SYSTEM USERS CANNOT BE EDITED AT ALL
    if target.get("is_system_user"):
        raise HTTPException(status_code=403, detail=SYSTEM_USER_BLOCKED_MESSAGE)
    
    # Cannot change role of protected users (owner)
    if (target.get("is_protected") or target.get("is_owner")) and data.role and data.role != target.get("role"):
        raise HTTPException(status_code=400, detail="No se puede cambiar el rol del propietario de la intranet")
    
    # Build update data
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.last_name is not None:
        update_data["last_name"] = data.last_name
    if data.username is not None:
        # Check if username is already used by another user in the same school
        existing_username = await db.users.find_one({
            "username": data.username.lower(),
            "school_id": user["school_id"],
            "id": {"$ne": user_id}
        })
        if existing_username:
            raise HTTPException(status_code=400, detail="Este nombre de usuario ya está en uso")
        update_data["username"] = data.username.lower()
    if data.email is not None:
        # Check if email is already used by another user
        existing = await db.users.find_one({
            "email": data.email.lower(),
            "school_id": user["school_id"],
            "id": {"$ne": user_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Este correo ya está registrado")
        update_data["email"] = data.email.lower()
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.birthday is not None:
        update_data["birthday"] = data.birthday
    if data.gender is not None:
        update_data["gender"] = data.gender
    if data.address is not None:
        update_data["address"] = data.address
    if data.role is not None:
        update_data["role"] = data.role
    if data.photo_url is not None:
        update_data["photo_url"] = data.photo_url
    # Academic fields
    if data.nivel_id is not None:
        update_data["nivel_id"] = data.nivel_id
    if data.grado_id is not None:
        update_data["grado_id"] = data.grado_id
    if data.seccion_id is not None:
        update_data["seccion_id"] = data.seccion_id
    if data.turno_id is not None:
        update_data["turno_id"] = data.turno_id
    if data.padre_id is not None:
        update_data["padre_id"] = data.padre_id
    # Student medical/contact info
    if data.condiciones_medicas is not None:
        update_data["condiciones_medicas"] = data.condiciones_medicas
    if data.alergias is not None:
        update_data["alergias"] = data.alergias
    if data.doctor_nombre is not None:
        update_data["doctor_nombre"] = data.doctor_nombre
    if data.doctor_telefono is not None:
        update_data["doctor_telefono"] = data.doctor_telefono
    if data.persona_autorizada is not None:
        update_data["persona_autorizada"] = data.persona_autorizada
    if data.persona_autorizada_telefono is not None:
        update_data["persona_autorizada_telefono"] = data.persona_autorizada_telefono
    if data.notas is not None:
        update_data["notas"] = data.notas
    # Parent fields
    if data.dni is not None:
        update_data["dni"] = data.dni
    if data.ocupacion is not None:
        update_data["ocupacion"] = data.ocupacion
    if data.lugar_trabajo is not None:
        update_data["lugar_trabajo"] = data.lugar_trabajo
    if data.telefono_trabajo is not None:
        update_data["telefono_trabajo"] = data.telefono_trabajo
    
    # Handle password change
    if data.password is not None and data.password.strip():
        update_data["password"] = hash_password(data.password)
        update_data["plain_password"] = data.password
        logger.info(f"Password changed for user {user_id}")
    
    # Handle parent_id (frontend sends parent_id, backend uses padre_id)
    if data.parent_id is not None:
        update_data["padre_id"] = data.parent_id if data.parent_id else None
        update_data["parent_id"] = data.parent_id if data.parent_id else None
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Return updated user
    updated_user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    
    logger.info(f"User {user_id} updated by {user['id']}")
    
    return {"message": "Usuario actualizado correctamente", "user": updated_user}

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user = Depends(get_current_user)):
    """Delete a user and all their related data (cascade delete)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar usuarios")
    
    # Cannot delete yourself
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    
    # Find target user
    target = await db.users.find_one({"id": user_id, "school_id": user["school_id"]})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # SYSTEM USERS CANNOT BE DELETED
    if target.get("is_system_user"):
        raise HTTPException(status_code=403, detail=SYSTEM_USER_BLOCKED_MESSAGE)
    
    # PROTECTED USERS CANNOT BE DELETED (owner, super_admin)
    if target.get("is_protected") or target.get("is_owner") or target.get("is_super_admin"):
        raise HTTPException(status_code=400, detail="Este usuario es el propietario de la intranet y no puede ser eliminado")
    
    school_id = user["school_id"]
    target_role = target.get("role", "")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CASCADE DELETE - Clean up all related data based on user role
    # ═══════════════════════════════════════════════════════════════════════════
    
    try:
        # STUDENT-SPECIFIC CLEANUP
        if target_role == "student":
            # Delete attendance records
            await db.attendance.delete_many({"student_id": user_id, "school_id": school_id})
            await db.attendances.delete_many({"student_id": user_id, "school_id": school_id})
            
            # Delete grades
            await db.grades.delete_many({"student_id": user_id, "school_id": school_id})
            
            # Delete exam attempts and submissions
            await db.exam_attempts.delete_many({"student_id": user_id, "school_id": school_id})
            
            # Remove from exam submissions (embedded in online_exams)
            await db.online_exams.update_many(
                {"school_id": school_id},
                {"$pull": {"submissions": {"student_id": user_id}}}
            )
            
            # Remove from task submissions (embedded in academic_assignments)
            await db.academic_assignments.update_many(
                {"school_id": school_id},
                {"$pull": {"submissions": {"student_id": user_id}}}
            )
            
            # Delete discipline reports
            await db.discipline_reports.delete_many({"student_id": user_id, "school_id": school_id})
            
            # Delete survey answers
            await db.survey_answers.delete_many({"user_id": user_id, "school_id": school_id})
            
            # Remove from enrolled_students in subjects/courses
            await db.subjects.update_many(
                {"school_id": school_id},
                {"$pull": {"enrolled_students": user_id}}
            )
            
            # Remove likes from course posts
            await db.course_posts.update_many(
                {"school_id": school_id},
                {"$pull": {"likes": user_id}}
            )
            
            # Remove student from parent's children list
            await db.users.update_many(
                {"school_id": school_id, "children": user_id},
                {"$pull": {"children": user_id}}
            )
            
            logger.info(f"Cleaned up student data for user {user_id}")
        
        # TEACHER-SPECIFIC CLEANUP
        elif target_role == "teacher":
            # Remove teacher from subjects
            await db.subjects.update_many(
                {"school_id": school_id, "teacher_id": user_id},
                {"$set": {"teacher_id": None}}
            )
            
            # Remove as secondary teacher
            await db.subjects.update_many(
                {"school_id": school_id},
                {"$pull": {"secondary_teachers": user_id}}
            )
            
            logger.info(f"Cleaned up teacher data for user {user_id}")
        
        # PARENT-SPECIFIC CLEANUP
        elif target_role == "parent":
            # Remove parent reference from children (if any)
            await db.users.update_many(
                {"school_id": school_id, "parent_id": user_id},
                {"$unset": {"parent_id": ""}}
            )
            
            logger.info(f"Cleaned up parent data for user {user_id}")
        
        # COMMON CLEANUP FOR ALL USERS
        # Delete messages sent by user
        await db.messages.delete_many({"sender_id": user_id, "school_id": school_id})
        
        # Delete internal mail
        await db.internal_mail.delete_many({
            "$or": [
                {"sender_id": user_id},
                {"recipient_ids": user_id}
            ],
            "school_id": school_id
        })
        
        # Remove from recipients in internal mail
        await db.internal_mail.update_many(
            {"school_id": school_id},
            {"$pull": {"recipient_ids": user_id, "read_by": user_id, "deleted_by": user_id}}
        )
        
        # Delete academic thread messages
        await db.academic_threads.update_many(
            {"school_id": school_id},
            {"$pull": {"messages": {"sender_id": user_id}}}
        )
        
    except Exception as e:
        logger.error(f"Error during cascade delete for user {user_id}: {e}")
        # Continue with user deletion even if some cleanup fails
    
    # Delete photo from Cloudinary if exists
    if target.get("photo_url"):
        try:
            photo_url = target["photo_url"]
            if "cloudinary.com" in photo_url:
                parts = photo_url.split("/upload/")
                if len(parts) > 1:
                    path_with_ext = parts[1]
                    if path_with_ext.startswith("v"):
                        path_with_ext = "/".join(path_with_ext.split("/")[1:])
                    public_id = path_with_ext.rsplit(".", 1)[0]
                    cloudinary.uploader.destroy(public_id)
                    logger.info(f"Deleted Cloudinary image: {public_id}")
        except Exception as e:
            logger.error(f"Error deleting Cloudinary image: {e}")
    
    # Finally, delete the user
    await db.users.delete_one({"id": user_id})
    
    logger.info(f"User {user_id} ({target_role}) deleted with cascade cleanup by {user['id']}")
    
    return {"message": "Usuario eliminado correctamente junto con todos sus datos relacionados"}

# ══════════════════════════════════════════════════════════════════════════════
# STUDENT IMPORT - Excel/CSV mass import
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/students/import/template")
async def generate_student_template(
    nivel_id: str = "",
    grado_id: str = "",
    seccion_id: str = "",
    turno_id: str = "",
    current_user = Depends(get_current_user)
):
    """Generate Excel template for student import"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden generar plantillas")

    school_id = user["school_id"]

    nivel_name = ""
    grado_name = ""
    seccion_name = ""
    turno_name = ""

    if nivel_id:
        nivel = await db.academic_levels.find_one({"id": nivel_id, "school_id": school_id}, {"_id": 0})
        nivel_name = nivel.get("nombre", nivel.get("name", "")) if nivel else ""
    if grado_id:
        grado = await db.grades.find_one({"id": grado_id, "school_id": school_id}, {"_id": 0})
        grado_name = grado.get("nombre", grado.get("name", "")) if grado else ""
    if seccion_id:
        seccion = await db.sections.find_one({"id": seccion_id, "school_id": school_id}, {"_id": 0})
        seccion_name = seccion.get("nombre", seccion.get("name", "")) if seccion else ""
    if turno_id:
        turno = await db.shifts.find_one({"id": turno_id, "school_id": school_id}, {"_id": 0})
        turno_name = turno.get("nombre", turno.get("name", "")) if turno else ""

    # Get active academic year
    active_year = await db.academic_years.find_one({"school_id": school_id, "is_active": True}, {"_id": 0})
    anio_escolar = str(active_year.get("year", "")) if active_year else str(datetime.now(timezone.utc).year)

    wb = Workbook()
    ws = wb.active
    ws.title = "Estudiantes"

    header_fill = PatternFill(start_color="1B5E20", end_color="1B5E20", fill_type="solid")
    header_font = Font(name="Arial", bold=True, color="FFFFFF", size=11)
    info_fill = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")
    info_font = Font(name="Arial", italic=True, size=10, color="2E7D32")
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )

    ws.merge_cells("A1:I1")
    ws["A1"] = "Plantilla de Importacion de Estudiantes"
    ws["A1"].font = Font(name="Arial", bold=True, size=14, color="1B5E20")

    # Row 2-3: Academic filter headers + values (locked/protected)
    filter_header_fill = PatternFill(start_color="1B5E20", end_color="1B5E20", fill_type="solid")
    filter_header_font = Font(name="Arial", bold=True, color="FFFFFF", size=10)
    filter_labels = ["Nivel", "Grado", "Seccion", "Turno"]
    for col, label in enumerate(filter_labels, 1):
        cell = ws.cell(row=2, column=col, value=label)
        cell.fill = filter_header_fill
        cell.font = filter_header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
        cell.protection = Protection(locked=True)

    filter_value_fill = PatternFill(start_color="C8E6C9", end_color="C8E6C9", fill_type="solid")
    filter_value_font = Font(name="Arial", bold=True, size=11, color="1B5E20")
    filter_values = [nivel_name or "---", grado_name or "---", seccion_name or "---", turno_name or "---"]
    for col, val in enumerate(filter_values, 1):
        cell = ws.cell(row=3, column=col, value=val)
        cell.fill = filter_value_fill
        cell.font = filter_value_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
        cell.protection = Protection(locked=True)

    # Row 5: Instructions
    instruction_font = Font(name="Arial", italic=True, size=9, color="666666")
    ws.merge_cells("A5:I5")
    ws["A5"] = "Instrucciones: Complete los datos de los estudiantes en las filas inferiores y luego vuelva a subir este archivo en el sistema para importarlos automaticamente."
    ws["A5"].font = instruction_font

    # Row 6: Auto-generated credentials note
    note_font = Font(name="Arial", italic=True, size=9, color="1565C0")
    ws.merge_cells("A6:I6")
    ws["A6"] = "Nota: El usuario y contrasena del estudiante seran generados automaticamente por el sistema."
    ws["A6"].font = note_font

    # Row 8: Student column headers
    student_headers = ["Nombre", "Apellido", "DNI", "Cumpleanos", "Genero", "Celular", "Correo", "Direccion", "Observaciones"]
    for col, hdr in enumerate(student_headers, 1):
        cell = ws.cell(row=8, column=col, value=hdr)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    col_widths = [20, 20, 15, 15, 14, 15, 30, 35, 30]
    for i, w in enumerate(col_widths, 1):
        ws.column_dimensions[ws.cell(row=8, column=i).column_letter].width = w

    # Freeze at row 9 so headers always visible
    ws.freeze_panes = "A9"

    # Row 9: Example row (unlocked)
    example_data = ["Juan", "Perez", "78451236", "15/03/2010", "Masculino", "987654321", "juan@email.com", "Av. Lima 123", "---"]
    example_font = Font(name="Arial", italic=True, size=10, color="999999")
    for col, val in enumerate(example_data, 1):
        cell = ws.cell(row=9, column=col, value=val)
        cell.font = example_font
        cell.border = thin_border
        cell.protection = Protection(locked=False)

    # Empty rows for student data (unlocked)
    for row in range(10, 510):
        for col in range(1, 10):
            cell = ws.cell(row=row, column=col)
            if row < 15:
                cell.border = thin_border
            cell.protection = Protection(locked=False)

    # Lock rows 1-8 (title, filters, instructions, headers)
    for row in range(1, 9):
        for col in range(1, 10):
            ws.cell(row=row, column=col).protection = Protection(locked=True)

    # Apply sheet protection
    from openpyxl.worksheet.protection import SheetProtection
    ws.protection = SheetProtection(
        sheet=True, objects=True, scenarios=True,
        formatCells=False, formatColumns=False, formatRows=False,
        insertRows=True, deleteRows=True,
        selectLockedCells=True, selectUnlockedCells=False
    )

    # ── Hidden metadata sheet for verification ──
    meta_ws = wb.create_sheet("edunet_metadata")
    meta_ws.sheet_state = "hidden"
    meta_keys = ["school_id", "nivel_id", "nivel_name", "grado_id", "grado_name",
                 "seccion_id", "seccion_name", "turno_id", "turno_name",
                 "anio_escolar", "fecha_generacion"]
    meta_vals = [school_id, nivel_id, nivel_name, grado_id, grado_name,
                 seccion_id, seccion_name, turno_id or "", turno_name,
                 anio_escolar, datetime.now(timezone.utc).isoformat()]
    for i, (k, v) in enumerate(zip(meta_keys, meta_vals), 1):
        meta_ws.cell(row=i, column=1, value=k)
        meta_ws.cell(row=i, column=2, value=v)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    safe_nivel = nivel_name.replace(" ", "_") or "todos"
    safe_grado = grado_name.replace(" ", "_") or "todos"
    safe_seccion = seccion_name.replace(" ", "_") or "todas"
    filename = f"plantilla_estudiantes_{safe_nivel}_{safe_grado}_{safe_seccion}.xlsx"

    from starlette.responses import StreamingResponse
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/students/import")
async def import_students(
    file: UploadFile = File(...),
    nivel_id: str = Form(""),
    grado_id: str = Form(""),
    seccion_id: str = Form(""),
    turno_id: str = Form(""),
    use_file_config: str = Form("false"),
    current_user = Depends(get_current_user)
):
    """Import students from Excel or CSV file"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden importar estudiantes")

    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()

    ext = file.filename.lower().rsplit(".", 1)[-1] if file.filename else ""
    if ext not in ("xlsx", "xls", "csv"):
        raise HTTPException(status_code=400, detail="Formato no soportado. Use .xlsx, .xls o .csv")

    content = await file.read()
    rows = []

    # ── Metadata verification for xlsx files ──
    file_metadata = {}
    if ext == "xlsx":
        try:
            meta_wb = load_workbook(io.BytesIO(content), read_only=True)
            if "edunet_metadata" in meta_wb.sheetnames:
                meta_ws = meta_wb["edunet_metadata"]
                for row in meta_ws.iter_rows(values_only=True):
                    if row and row[0] and row[1] is not None:
                        file_metadata[str(row[0]).strip()] = str(row[1]).strip()
            meta_wb.close()
        except Exception:
            pass  # No metadata - old template or manual file

    if file_metadata and use_file_config != "true":
        mismatches = []
        meta_nivel = file_metadata.get("nivel_id", "")
        meta_grado = file_metadata.get("grado_id", "")
        meta_seccion = file_metadata.get("seccion_id", "")
        meta_turno = file_metadata.get("turno_id", "")
        meta_school = file_metadata.get("school_id", "")
        meta_year = file_metadata.get("anio_escolar", "")

        if meta_school and meta_school != school_id:
            mismatches.append("school_id")
        if meta_nivel and nivel_id and meta_nivel != nivel_id:
            mismatches.append("nivel")
        if meta_grado and grado_id and meta_grado != grado_id:
            mismatches.append("grado")
        if meta_seccion and seccion_id and meta_seccion != seccion_id:
            mismatches.append("seccion")
        if meta_turno and turno_id and meta_turno != turno_id:
            mismatches.append("turno")

        # Check academic year
        active_year_doc = await db.academic_years.find_one({"school_id": school_id, "is_active": True}, {"_id": 0})
        current_year = str(active_year_doc.get("year", "")) if active_year_doc else str(datetime.now(timezone.utc).year)
        year_mismatch = meta_year and current_year and meta_year != current_year

        if mismatches or year_mismatch:
            return {
                "metadata_mismatch": True,
                "file_config": {
                    "nivel_id": meta_nivel, "nivel_name": file_metadata.get("nivel_name", ""),
                    "grado_id": meta_grado, "grado_name": file_metadata.get("grado_name", ""),
                    "seccion_id": meta_seccion, "seccion_name": file_metadata.get("seccion_name", ""),
                    "turno_id": meta_turno, "turno_name": file_metadata.get("turno_name", ""),
                    "anio_escolar": meta_year,
                    "fecha_generacion": file_metadata.get("fecha_generacion", ""),
                },
                "current_config": {
                    "nivel_id": nivel_id, "grado_id": grado_id,
                    "seccion_id": seccion_id, "turno_id": turno_id,
                    "anio_escolar": current_year,
                },
                "mismatches": mismatches,
                "year_mismatch": year_mismatch,
            }

    # If use_file_config is true, override filters with file metadata
    if use_file_config == "true" and file_metadata:
        nivel_id = file_metadata.get("nivel_id", nivel_id)
        grado_id = file_metadata.get("grado_id", grado_id)
        seccion_id = file_metadata.get("seccion_id", seccion_id)
        turno_id = file_metadata.get("turno_id", turno_id)

    try:
        if ext == "csv":
            text = content.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            for r in reader:
                rows.append({k.strip(): (v.strip() if v else "") for k, v in r.items()})
        elif ext == "xlsx":
            wb = load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            all_rows = list(ws.iter_rows(values_only=True))
            header_row_idx = None
            for i, row in enumerate(all_rows):
                if row and any(str(c or "").strip().lower() in ("nombre", "name") for c in row):
                    header_row_idx = i
                    break
            if header_row_idx is None:
                raise HTTPException(status_code=400, detail="No se encontro la fila de encabezados (Nombre, Apellido...)")
            headers_raw = [str(c or "").strip() for c in all_rows[header_row_idx]]
            for row in all_rows[header_row_idx + 1:]:
                if not row or all(c is None or str(c).strip() == "" for c in row):
                    continue
                d = {}
                for j, h in enumerate(headers_raw):
                    d[h] = str(row[j]).strip() if j < len(row) and row[j] is not None else ""
                rows.append(d)
            wb.close()
        elif ext == "xls":
            import xlrd
            book = xlrd.open_workbook(file_contents=content)
            sheet = book.sheet_by_index(0)
            header_row_idx = None
            for i in range(min(10, sheet.nrows)):
                vals = [str(sheet.cell_value(i, j)).strip() for j in range(sheet.ncols)]
                if any(v.lower() in ("nombre", "name") for v in vals):
                    header_row_idx = i
                    break
            if header_row_idx is None:
                raise HTTPException(status_code=400, detail="No se encontro la fila de encabezados")
            headers_raw = [str(sheet.cell_value(header_row_idx, j)).strip() for j in range(sheet.ncols)]
            for i in range(header_row_idx + 1, sheet.nrows):
                vals = [str(sheet.cell_value(i, j)).strip() for j in range(sheet.ncols)]
                if all(v == "" for v in vals):
                    continue
                d = {}
                for j, h in enumerate(headers_raw):
                    d[h] = vals[j] if j < len(vals) else ""
                rows.append(d)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer archivo: {str(e)}")

    if not rows:
        raise HTTPException(status_code=400, detail="El archivo no contiene datos de estudiantes")

    COL_MAP = {
        "nombre": "name", "name": "name",
        "apellido": "last_name", "apellidos": "last_name", "last_name": "last_name",
        "dni": "dni", "documento": "dni",
        "cumpleanos": "birthday", "cumpleaños": "birthday", "birthday": "birthday", "fecha_nacimiento": "birthday",
        "genero": "gender", "género": "gender", "gender": "gender", "sexo": "gender",
        "celular": "phone", "telefono": "phone", "phone": "phone",
        "correo": "email", "email": "email",
        "direccion": "address", "address": "address",
        "observaciones": "notes", "notas": "notes", "notes": "notes",
    }

    def normalize_key(k):
        k = k.lower().strip()
        k = unicodedata.normalize("NFD", k)
        k = "".join(c for c in k if unicodedata.category(c) != "Mn")
        return COL_MAP.get(k, k)

    created = []
    pending = []

    # Check activation mode
    fin_settings = await db.school_financial_settings.find_one(
        {"school_id": school_id}, {"_id": 0, "activacion_modo": 1}
    )
    activation_mode = (fin_settings or {}).get("activacion_modo", "matricula_pension")

    last_code = await db.users.find_one(
        {"school_id": school_id, "student_code": {"$exists": True}},
        sort=[("student_code", -1)],
        projection={"student_code": 1, "_id": 0}
    )
    code_counter = 1
    if last_code and last_code.get("student_code"):
        try:
            code_counter = int(last_code["student_code"].split("-")[1]) + 1
        except (ValueError, IndexError):
            pass

    for idx, raw_row in enumerate(rows):
        row = {normalize_key(k): v for k, v in raw_row.items() if k.strip()}
        name = row.get("name", "").strip()
        last_name = row.get("last_name", "").strip()

        # Skip example row from template
        if name.lower() == "juan" and last_name.lower() == "perez" and row.get("dni", "").strip() == "78451236":
            continue

        dni = row.get("dni", "").strip()
        email = row.get("email", "").strip().lower()
        phone = row.get("phone", "").strip()
        address = row.get("address", "").strip()
        notes = row.get("notes", "").strip()
        birthday_raw = row.get("birthday", "").strip()
        gender_raw = row.get("gender", "").strip().lower()

        # Parse birthday
        birthday = ""
        if birthday_raw:
            birthday_str = str(birthday_raw).strip()
            for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y"):
                try:
                    birthday = datetime.strptime(birthday_str, fmt).strftime("%Y-%m-%d")
                    break
                except (ValueError, TypeError):
                    pass
            if not birthday:
                birthday = birthday_str

        # Normalize gender
        errors = []
        gender = ""
        if gender_raw:
            if gender_raw in ("masculino", "male", "m", "hombre"):
                gender = "Masculino"
            elif gender_raw in ("femenino", "female", "f", "mujer"):
                gender = "Femenino"
            else:
                gender = ""
                errors.append("Genero no valido")
        if not name:
            errors.append("Nombre vacio")
        if not last_name:
            errors.append("Apellido vacio")

        if dni:
            existing_dni = await db.users.find_one({"school_id": school_id, "dni": dni}, {"_id": 0, "id": 1})
            if existing_dni:
                errors.append(f"DNI {dni} ya existe")

        if email:
            existing_email = await db.users.find_one({"school_id": school_id, "email": email}, {"_id": 0, "id": 1})
            if existing_email:
                errors.append(f"Correo {email} ya existe")

        student_code = f"STU-{code_counter:06d}"
        code_counter += 1

        base_username = f"{name.lower().replace(' ', '')}.{last_name.lower().replace(' ', '')}" if name and last_name else f"est{idx}"
        base_username = "".join(c for c in unicodedata.normalize("NFD", base_username) if unicodedata.category(c) != "Mn")
        username = base_username
        suffix = 1
        while await db.users.find_one({"username": username, "school_id": school_id}):
            username = f"{base_username}{suffix}"
            suffix += 1

        new_student = {
            "id": str(uuid.uuid4()),
            "username": username,
            "password": hash_password(dni if dni else "123456"),
            "name": name,
            "last_name": last_name,
            "email": email or None,
            "phone": phone or None,
            "dni": dni or None,
            "birthday": birthday or None,
            "gender": gender or None,
            "address": address or None,
            "role": "student",
            "school_id": school_id,
            "email_verified": True,
            "nivel_id": nivel_id or None,
            "grado_id": grado_id or None,
            "seccion_id": seccion_id or None,
            "turno_id": turno_id or None,
            "student_code": student_code,
            "student_status": "pending" if errors else ("active" if activation_mode == "on_create" else "active"),
            "import_status": "pending" if errors else "imported",
            "import_errors": errors if errors else None,
            "import_notes": notes or None,
            "created_at": now,
            "updated_at": now,
        }

        # Generate short QR (centralized service)
        qr_id, qr_token = await generate_user_qr(db)
        new_student["qr_id"] = qr_id
        new_student["qr_token"] = qr_token
        new_student["qr_version"] = 2

        if errors:
            pending.append({"row": idx + 1, "name": f"{name} {last_name}", "errors": errors, "student_code": student_code})
            new_student["student_status"] = "pending"
        else:
            new_student["student_status"] = "active"

        await db.users.insert_one(new_student)
        new_student.pop("_id", None)
        new_student.pop("password", None)

        if not errors:
            created.append({"name": f"{name} {last_name}", "student_code": student_code})

    logger.info(f"Student import: {len(created)} created, {len(pending)} pending by {user['id']}")

    return {
        "message": f"Importacion completada",
        "created_count": len(created),
        "pending_count": len(pending),
        "created": created,
        "pending": pending,
    }

@router.get("/students/pending")
async def get_pending_students(current_user = Depends(get_current_user)):
    """Get students with import errors"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    students = await db.users.find(
        {"school_id": user["school_id"], "role": "student", "import_status": "pending"},
        {"_id": 0, "password": 0}
    ).to_list(500)
    return students

@router.put("/students/pending/{student_id}/activate")
async def activate_pending_student(student_id: str, current_user = Depends(get_current_user)):
    """Activate a pending student after fixing errors"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    result = await db.users.update_one(
        {"id": student_id, "school_id": user["school_id"], "role": "student"},
        {"$set": {"import_status": "imported", "student_status": "active", "import_errors": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    return {"message": "Estudiante activado correctamente"}

@router.put("/students/pending/{student_id}/edit")
async def edit_pending_student(student_id: str, request: Request, current_user = Depends(get_current_user)):
    """Edit a pending student's data to fix import errors"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")

    body = await request.json()
    allowed = {"name", "last_name", "dni", "email", "phone", "address", "birthday", "gender", "notes"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="Sin campos para actualizar")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Re-validate: check DNI/email uniqueness
    new_errors = []
    school_id = user["school_id"]
    if "dni" in updates and updates["dni"]:
        existing = await db.users.find_one(
            {"school_id": school_id, "dni": updates["dni"], "id": {"$ne": student_id}}, {"_id": 0, "id": 1}
        )
        if existing:
            new_errors.append(f"DNI {updates['dni']} ya existe")
    if "email" in updates and updates["email"]:
        existing = await db.users.find_one(
            {"school_id": school_id, "email": updates["email"], "id": {"$ne": student_id}}, {"_id": 0, "id": 1}
        )
        if existing:
            new_errors.append(f"Correo {updates['email']} ya existe")

    if new_errors:
        updates["import_errors"] = new_errors
    else:
        updates["import_errors"] = None
        updates["import_status"] = "imported"
        updates["student_status"] = "active"

    result = await db.users.update_one(
        {"id": student_id, "school_id": school_id, "role": "student"},
        {"$set": updates}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    updated = await db.users.find_one({"id": student_id}, {"_id": 0, "password": 0})
    return {"message": "Estudiante actualizado" + (" y activado" if not new_errors else ""), "student": updated, "errors": new_errors}

@router.delete("/students/pending/{student_id}")
async def delete_pending_student(student_id: str, current_user = Depends(get_current_user)):
    """Delete a pending student"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    result = await db.users.delete_one(
        {"id": student_id, "school_id": user["school_id"], "role": "student", "import_status": "pending"}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Estudiante pendiente no encontrado")
    return {"message": "Estudiante eliminado"}

# ══════════════════════════════════════════════════════════════════════════════



# ══════════════════════════════════════════════════════════════════════════════
# BULK SAFE DELETE STUDENTS
# ══════════════════════════════════════════════════════════════════════════════

class BulkSafeDeleteRequest(BaseModel):
    nivel_id: str
    grado_id: str
    seccion_id: str
    turno_id: Optional[str] = None
    delete_reason: str = Field(..., min_length=3)
    confirm: bool = False  # True = execute, False = analyze only

@router.post("/students/bulk-safe-delete")
async def bulk_safe_delete_students(data: BulkSafeDeleteRequest, current_user=Depends(get_current_user)):
    """Analyze and optionally soft-delete students without academic activity. Admin/owner only."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta accion")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No autorizado")

    # Find students - filter by grado_id + seccion_id (nivel is implicit in grado)
    student_filter = {
        "school_id": school_id,
        "role": "student",
        "grado_id": data.grado_id,
        "seccion_id": data.seccion_id,
        "student_status": {"$ne": "deleted"},
    }
    if data.turno_id:
        student_filter["turno_id"] = data.turno_id

    students = await db.users.find(student_filter, {"_id": 0, "id": 1, "name": 1, "last_name": 1}).to_list(2000)
    if not students:
        # Fallback: try without seccion_id filter in case field name differs
        student_filter2 = {
            "school_id": school_id,
            "role": "student",
            "grado_id": data.grado_id,
            "student_status": {"$ne": "deleted"},
        }
        all_in_grade = await db.users.find(student_filter2, {"_id": 0, "id": 1, "seccion_id": 1}).to_list(5)
        if all_in_grade:
            raise HTTPException(status_code=404, detail=f"No se encontraron estudiantes en esa seccion. Hay {len(all_in_grade)} en el grado pero con otra seccion.")
        raise HTTPException(status_code=404, detail="No se encontraron estudiantes con esos filtros")

    student_ids = [s["id"] for s in students]

    # Optimized: batch check activity across all collections
    attendance_ids = set(await db.attendances.distinct("user_id", {"user_id": {"$in": student_ids}, "school_id": school_id}))
    legacy_att_ids = set(await db.student_attendance.distinct("student_id", {"student_id": {"$in": student_ids}, "school_id": school_id}))
    grade_ids = set(await db.student_grades.distinct("student_id", {"student_id": {"$in": student_ids}, "school_id": school_id}))
    task_ids = set(await db.task_submissions.distinct("student_id", {"student_id": {"$in": student_ids}, "school_id": school_id}))
    exam_ids = set(await db.exam_attempts.distinct("student_id", {"student_id": {"$in": student_ids}, "school_id": school_id}))
    payment_ids = set(await db.payments.distinct("student_id", {"student_id": {"$in": student_ids}, "school_id": school_id}))

    blocked_ids = attendance_ids | legacy_att_ids | grade_ids | task_ids | exam_ids | payment_ids

    deletable = []
    blocked = []
    for s in students:
        sid = s["id"]
        full_name = f"{s.get('name', '')} {s.get('last_name', '')}".strip()
        if sid in blocked_ids:
            reasons = []
            if sid in attendance_ids or sid in legacy_att_ids:
                reasons.append("Tiene asistencias")
            if sid in grade_ids:
                reasons.append("Tiene notas")
            if sid in task_ids:
                reasons.append("Tiene tareas")
            if sid in exam_ids:
                reasons.append("Tiene examenes")
            if sid in payment_ids:
                reasons.append("Tiene pagos")
            blocked.append({"id": sid, "name": full_name, "reason": ", ".join(reasons)})
        else:
            deletable.append({"id": sid, "name": full_name})

    # Analysis mode (confirm=false)
    if not data.confirm:
        return {
            "mode": "analysis",
            "total_found": len(students),
            "deletable_count": len(deletable),
            "blocked_count": len(blocked),
            "deletable": deletable,
            "blocked": blocked,
        }

    # Execute soft delete
    if not deletable:
        raise HTTPException(status_code=400, detail="No hay alumnos eliminables. Todos tienen actividad academica.")

    now_iso = datetime.now(timezone.utc).isoformat()
    deletable_ids = [d["id"] for d in deletable]

    await db.users.update_many(
        {"id": {"$in": deletable_ids}, "school_id": school_id},
        {"$set": {
            "student_status": "deleted",
            "deleted_at": now_iso,
            "deleted_by": user["id"],
            "delete_reason": data.delete_reason,
        }}
    )

    # Audit log
    await db.bulk_delete_logs.insert_one({
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "action": "bulk_safe_delete_students",
        "filters": {"nivel_id": data.nivel_id, "grado_id": data.grado_id, "seccion_id": data.seccion_id, "turno_id": data.turno_id},
        "deleted_count": len(deletable),
        "blocked_count": len(blocked),
        "deleted_ids": deletable_ids,
        "reason": data.delete_reason,
        "performed_by": user["id"],
        "performed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "created_at": now_iso,
    })

    logger.info(f"Bulk safe delete: {len(deletable)} deleted, {len(blocked)} blocked in school {school_id}")

    return {
        "mode": "executed",
        "total_found": len(students),
        "deleted": len(deletable),
        "blocked": len(blocked),
        "blocked_students": blocked,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  GET /api/students/export-credentials — Export student credentials as Excel
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/students/export-credentials")
async def export_student_credentials(
    nivel_id: str = "",
    grado_id: str = "",
    seccion_id: str = "",
    turno_id: str = "",
    current_user=Depends(get_current_user)
):
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=400, detail="school_id es requerido")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden exportar credenciales")

    if not nivel_id or not grado_id or not seccion_id or not turno_id:
        raise HTTPException(status_code=400, detail="Todos los filtros son requeridos: nivel, grado, seccion y turno")

    school_id = user["school_id"]
    query = {"role": "student", "school_id": school_id, "student_status": {"$ne": "deleted"}}
    query["nivel_id"] = nivel_id
    query["grado_id"] = grado_id
    query["seccion_id"] = seccion_id
    query["turno_id"] = turno_id

    students = await db.users.find(
        query,
        {"_id": 0, "name": 1, "last_name": 1, "username": 1, "dni": 1}
    ).to_list(5000)

    if not students:
        raise HTTPException(status_code=404, detail="No se encontraron estudiantes con los filtros aplicados")

    # Resolve filter names
    nivel_doc = await db.academic_levels.find_one({"id": nivel_id, "school_id": school_id}, {"_id": 0, "name": 1, "nombre": 1})
    grado_doc = await db.grades.find_one({"id": grado_id, "school_id": school_id}, {"_id": 0, "name": 1, "nombre": 1})
    seccion_doc = await db.sections.find_one({"id": seccion_id, "school_id": school_id}, {"_id": 0, "name": 1, "nombre": 1})
    turno_doc = await db.shifts.find_one({"id": turno_id, "school_id": school_id}, {"_id": 0, "name": 1, "nombre": 1})

    nivel_name = (nivel_doc.get("name") or nivel_doc.get("nombre") or nivel_id) if nivel_doc else nivel_id
    grado_name = (grado_doc.get("name") or grado_doc.get("nombre") or grado_id) if grado_doc else grado_id
    seccion_name = (seccion_doc.get("name") or seccion_doc.get("nombre") or seccion_id) if seccion_doc else seccion_id
    turno_name = (turno_doc.get("name") or turno_doc.get("nombre") or turno_id) if turno_doc else turno_id

    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from datetime import datetime, timezone

    wb = Workbook()
    ws = wb.active
    ws.title = "Credenciales"

    ws.column_dimensions["A"].width = 35
    ws.column_dimensions["B"].width = 25
    ws.column_dimensions["C"].width = 20

    title_font = Font(name="Arial", bold=True, size=14, color="1565C0")
    label_font = Font(name="Arial", bold=True, size=11, color="333333")
    value_font = Font(name="Arial", size=11, color="333333")
    header_fill = PatternFill(start_color="1565C0", end_color="1565C0", fill_type="solid")
    header_font = Font(name="Arial", bold=True, color="FFFFFF", size=11)
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )

    # Row 1: Title
    ws.merge_cells("A1:C1")
    ws["A1"] = "Credenciales de Estudiantes"
    ws["A1"].font = title_font

    # Row 3-8: Metadata
    meta = [
        ("Nivel:", nivel_name),
        ("Grado:", grado_name),
        ("Seccion:", seccion_name),
        ("Turno:", turno_name),
        ("Fecha de exportacion:", datetime.now(timezone.utc).strftime("%d/%m/%Y")),
        ("Total de estudiantes:", str(len(students))),
    ]
    for i, (label, value) in enumerate(meta, 3):
        ws.cell(row=i, column=1, value=label).font = label_font
        ws.cell(row=i, column=2, value=value).font = value_font

    # Row 10: Table headers
    data_start = 10
    headers = ["Nombre completo", "Usuario", "Contrasena"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=data_start, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    ws.freeze_panes = f"A{data_start + 1}"

    # Data rows
    for idx, s in enumerate(students, data_start + 1):
        full_name = f"{s.get('name', '')} {s.get('last_name', '')}".strip()
        username = s.get("username", "")
        dni = (s.get("dni") or "").strip()
        password = dni if dni else "123456"

        ws.cell(row=idx, column=1, value=full_name).border = thin_border
        ws.cell(row=idx, column=2, value=username).border = thin_border
        ws.cell(row=idx, column=3, value=password).border = thin_border

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    # Build descriptive filename
    import re as _re
    def sanitize(s):
        s = unicodedata.normalize("NFD", s)
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        s = _re.sub(r"[^a-zA-Z0-9]+", "_", s.lower()).strip("_")
        return s or "x"

    filename = f"credenciales_{sanitize(nivel_name)}_{sanitize(grado_name)}_{sanitize(seccion_name)}.xlsx"

    from starlette.responses import StreamingResponse
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
