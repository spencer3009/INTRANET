"""
Message center, internal mail system
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
    ws_manager,
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# MESSAGE CENTER MODULE - Premium Communication System
# ══════════════════════════════════════════════════════════════════════════════

class MessageType(str, Enum):
    institutional = "institutional"
    support = "support"
    academic = "academic"

class MessagePriority(str, Enum):
    normal = "normal"
    important = "important"
    urgent = "urgent"

class SupportTicketStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    responded = "responded"
    closed = "closed"

class AttachmentRef(BaseModel):
    """Reference to an attachment uploaded to Google Drive."""
    file_id: str               # internal stable id (uuid)
    name: str
    mime_type: str
    size: int
    drive_file_id: str         # id in Google Drive
    storage_type: str = "google_drive"


class InstitutionalMessageCreate(BaseModel):
    title: str
    content: str
    priority: MessagePriority = MessagePriority.normal
    target_roles: List[str] = []
    target_levels: List[str] = []
    target_grades: List[str] = []
    expires_at: Optional[str] = None
    attachments: List[AttachmentRef] = []
    
class SupportTicketCreate(BaseModel):
    subject: str
    category: str
    description: str
    
class SupportTicketReply(BaseModel):
    content: str

class AcademicMessageCreate(BaseModel):
    receiver_id: str
    subject_id: Optional[str] = None
    content: str

@router.get("/messaging/office-hours")
async def get_office_hours(current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school = await db.schools.find_one({"id": user["school_id"]}, {"_id": 0})
    office_hours = school.get("office_hours", {
        "enabled": True,
        "timezone": "America/Lima",
        "schedule": {
            "monday": {"start": "08:00", "end": "17:00", "enabled": True},
            "tuesday": {"start": "08:00", "end": "17:00", "enabled": True},
            "wednesday": {"start": "08:00", "end": "17:00", "enabled": True},
            "thursday": {"start": "08:00", "end": "17:00", "enabled": True},
            "friday": {"start": "08:00", "end": "17:00", "enabled": True},
            "saturday": {"start": "08:00", "end": "12:00", "enabled": False},
            "sunday": {"start": "00:00", "end": "00:00", "enabled": False}
        },
        "out_of_hours_message": "Gracias por tu mensaje. Será atendido en horario escolar."
    }) if school else {}
    
    office_hours["is_currently_open"] = True
    return office_hours

@router.post("/messaging/institutional")
async def create_institutional_message(
    data: InstitutionalMessageCreate,
    current_user = Depends(get_current_user)
):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if user.get("role") not in ["admin", "owner", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    message = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "type": MessageType.institutional.value,
        "title": data.title,
        "content": data.content,
        "priority": data.priority.value,
        "target_roles": data.target_roles,
        "target_levels": data.target_levels,
        "target_grades": data.target_grades,
        "expires_at": data.expires_at,
        "attachments": [a.dict() for a in (data.attachments or [])],
        "has_attachments": bool(data.attachments),
        "author_id": user["id"],
        "author_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "author_role": user.get("role"),
        "author_photo": user.get("photo_url"),
        "read_by": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.institutional_messages.insert_one(message)
    # Remove _id added by MongoDB before returning
    message.pop("_id", None)
    return {"message": "Comunicado enviado", "data": message}

@router.get("/messaging/institutional")
async def get_institutional_messages(
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    messages = await db.institutional_messages.find(
        {"school_id": user["school_id"], "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for msg in messages:
        msg["is_read"] = user["id"] in msg.get("read_by", [])
    
    unread_count = sum(1 for m in messages if not m["is_read"])
    return {"messages": messages, "unread_count": unread_count, "total_count": len(messages)}

@router.post("/messaging/institutional/{message_id}/read")
async def mark_institutional_read(message_id: str, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    await db.institutional_messages.update_one({"id": message_id}, {"$addToSet": {"read_by": user["id"]}})
    return {"message": "Marcado como leído"}

@router.delete("/messaging/institutional/{message_id}")
async def delete_institutional_message(message_id: str, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user or user.get("role") not in ["admin", "owner", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    await db.institutional_messages.update_one(
        {"id": message_id, "school_id": user["school_id"]},
        {"$set": {"status": "deleted"}}
    )
    return {"message": "Comunicado eliminado"}

@router.post("/messaging/support")
async def create_support_ticket(data: SupportTicketCreate, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    ticket = {
        "id": str(uuid.uuid4()),
        "ticket_number": f"TKT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
        "school_id": user["school_id"],
        "subject": data.subject,
        "category": data.category,
        "status": SupportTicketStatus.open.value,
        "creator_id": user["id"],
        "creator_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "creator_role": user.get("role"),
        "creator_photo": user.get("photo_url"),
        "messages": [{
            "id": str(uuid.uuid4()),
            "sender_id": user["id"],
            "sender_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
            "sender_photo": user.get("photo_url"),
            "content": data.description,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_staff": False
        }],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.insert_one(ticket)
    # Remove _id added by MongoDB before returning
    ticket.pop("_id", None)
    return {"message": "Ticket creado", "data": ticket}

@router.get("/messaging/support")
async def get_support_tickets(status: Optional[str] = None, limit: int = 50, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    query = {"school_id": user["school_id"]}
    if user.get("role") not in ["admin", "owner", "director", "coordinator"]:
        query["creator_id"] = user["id"]
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("updated_at", -1).limit(limit).to_list(limit)
    return {"tickets": tickets, "total_count": len(tickets)}

@router.get("/messaging/support/{ticket_id}")
async def get_support_ticket(ticket_id: str, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    ticket = await db.support_tickets.find_one({"id": ticket_id, "school_id": user["school_id"]}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    return ticket

@router.post("/messaging/support/{ticket_id}/reply")
async def reply_support_ticket(ticket_id: str, data: SupportTicketReply, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    is_staff = user.get("role") in ["admin", "owner", "director", "coordinator"]
    reply = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "sender_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "sender_photo": user.get("photo_url"),
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_staff": is_staff
    }
    
    new_status = "responded" if is_staff else "open"
    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$push": {"messages": reply}, "$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Respuesta enviada", "reply": reply}

@router.put("/messaging/support/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, status: str = Body(..., embed=True), current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user or user.get("role") not in ["admin", "owner", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    await db.support_tickets.update_one({"id": ticket_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Estado actualizado"}

@router.get("/messaging/academic/contacts")
async def get_academic_contacts(current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    contacts = []
    user_role = user.get("role", "student")
    
    # Base filter to exclude demo/test users from contacts
    demo_filter = {"is_demo": {"$ne": True}}
    
    # Get all threads where user is participant to count unread messages
    user_threads = await db.academic_threads.find({
        "school_id": user["school_id"],
        "participant_ids": user["id"]
    }, {"_id": 0}).to_list(500)
    
    # Build a map of contact_id -> unread_count
    unread_by_contact = {}
    for thread in user_threads:
        if user["id"] in thread.get("unread_by", []):
            # Find the other participant
            other_participant_id = None
            for pid in thread.get("participant_ids", []):
                if pid != user["id"]:
                    other_participant_id = pid
                    break
            if other_participant_id:
                unread_by_contact[other_participant_id] = unread_by_contact.get(other_participant_id, 0) + 1
    
    if user_role == "teacher":
        # Build categorized contact list for teachers
        added_ids = set()
        categorized_contacts = {
            "mis_alumnos": [],
            "padres_apoderados": [],
            "personal_administrativo": [],
            "otros_profesores": []
        }
        
        # 1. MIS ALUMNOS - Get students from subjects taught by this teacher
        # First, get subjects from subjects collection
        subjects = await db.subjects.find({"school_id": user["school_id"], "teacher_id": user["id"]}, {"_id": 0}).to_list(100)
        grade_ids_taught = set()
        seccion_ids_taught = set()
        
        for subject in subjects:
            grade_id = subject.get("grade_id")
            if grade_id:
                grade_ids_taught.add(grade_id)
                # Get sections for this subject
                seccion_id = subject.get("seccion_id")
                if seccion_id:
                    seccion_ids_taught.add(seccion_id)
        
        # Also check academic_assignments for more complete coverage
        assignments = await db.academic_assignments.find({
            "school_id": user["school_id"],
            "teacher_id": user["id"],
            "status": "activo"
        }, {"_id": 0}).to_list(100)
        
        for assignment in assignments:
            grade_id = assignment.get("grade_id")
            seccion_id = assignment.get("seccion_id")
            if grade_id:
                grade_ids_taught.add(grade_id)
            if seccion_id:
                seccion_ids_taught.add(seccion_id)
        
        # Fetch students in taught grades/sections (exclude pending)
        student_query = {
            "school_id": user["school_id"],
            "role": "student",
            "is_active": {"$ne": False}, "is_demo": {"$ne": True},
            **ACADEMIC_STUDENT_FILTER
        }
        
        if seccion_ids_taught:
            # If we have specific sections, prefer those
            student_query["seccion_id"] = {"$in": list(seccion_ids_taught)}
        elif grade_ids_taught:
            # Otherwise use grades
            student_query["$or"] = [
                {"grade_id": {"$in": list(grade_ids_taught)}},
                {"grado_id": {"$in": list(grade_ids_taught)}}
            ]
        
        if grade_ids_taught or seccion_ids_taught:
            students = await db.users.find(student_query, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1, "grade_id": 1, "grado_id": 1, "seccion_id": 1}).to_list(500)
            
            for student in students:
                if student["id"] not in added_ids:
                    added_ids.add(student["id"])
                    categorized_contacts["mis_alumnos"].append({
                        "id": student["id"],
                        "name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
                        "photo_url": student.get("photo_url"),
                        "email": student.get("email"),
                        "role": "student",
                        "category": "mis_alumnos",
                        "unread_count": unread_by_contact.get(student["id"], 0)
                    })
        
        # 2. PADRES/APODERADOS - Get parents of the students we just found
        student_ids = [s["id"] for s in categorized_contacts["mis_alumnos"]]
        if student_ids:
            parents = await db.users.find({
                "school_id": user["school_id"],
                "role": "parent",
                "is_active": {"$ne": False}, "is_demo": {"$ne": True},
                "$or": [
                    {"student_ids": {"$in": student_ids}},
                    {"children_ids": {"$in": student_ids}}
                ]
            }, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1, "student_ids": 1, "children_ids": 1}).to_list(500)
            
            for parent in parents:
                if parent["id"] not in added_ids:
                    added_ids.add(parent["id"])
                    # Find linked student names for context
                    linked_student_ids = parent.get("student_ids") or parent.get("children_ids") or []
                    linked_students = [s for s in categorized_contacts["mis_alumnos"] if s["id"] in linked_student_ids]
                    linked_names = ", ".join([s["name"] for s in linked_students[:2]])
                    if len(linked_students) > 2:
                        linked_names += f" (+{len(linked_students) - 2})"
                    
                    categorized_contacts["padres_apoderados"].append({
                        "id": parent["id"],
                        "name": f"{parent.get('name', '')} {parent.get('last_name', '')}".strip(),
                        "photo_url": parent.get("photo_url"),
                        "email": parent.get("email"),
                        "role": "parent",
                        "category": "padres_apoderados",
                        "linked_students": linked_names,
                        "unread_count": unread_by_contact.get(parent["id"], 0)
                    })
        
        # 3. PERSONAL ADMINISTRATIVO - Admins, directors, coordinators, owner
        admin_roles = ["admin", "owner", "director", "coordinator"]
        admin_users = await db.users.find({
            "school_id": user["school_id"],
            "role": {"$in": admin_roles},
            "id": {"$ne": user["id"]},
            "is_active": {"$ne": False}, "is_demo": {"$ne": True}
        }, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1, "role": 1}).to_list(50)
        
        for admin in admin_users:
            if admin["id"] not in added_ids:
                added_ids.add(admin["id"])
                role_display = {
                    "owner": "Propietario",
                    "admin": "Administrador",
                    "director": "Director",
                    "coordinator": "Coordinador"
                }.get(admin.get("role"), admin.get("role", ""))
                
                categorized_contacts["personal_administrativo"].append({
                    "id": admin["id"],
                    "name": f"{admin.get('name', '')} {admin.get('last_name', '')}".strip(),
                    "photo_url": admin.get("photo_url"),
                    "email": admin.get("email"),
                    "role": admin.get("role"),
                    "role_display": role_display,
                    "category": "personal_administrativo",
                    "unread_count": unread_by_contact.get(admin["id"], 0)
                })
        
        # 4. OTROS PROFESORES - Other teachers in the same school
        other_teachers = await db.users.find({
            "school_id": user["school_id"],
            "role": "teacher",
            "id": {"$ne": user["id"]},
            "is_active": {"$ne": False}, "is_demo": {"$ne": True}
        }, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1}).to_list(100)
        
        for teacher in other_teachers:
            if teacher["id"] not in added_ids:
                added_ids.add(teacher["id"])
                categorized_contacts["otros_profesores"].append({
                    "id": teacher["id"],
                    "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
                    "photo_url": teacher.get("photo_url"),
                    "email": teacher.get("email"),
                    "role": "teacher",
                    "category": "otros_profesores",
                    "unread_count": unread_by_contact.get(teacher["id"], 0)
                })
        
        # Sort each category by unread count, then by name
        for category in categorized_contacts:
            categorized_contacts[category].sort(key=lambda x: (-x.get("unread_count", 0), x.get("name", "")))
        
        # Build flat contacts list with category info for backward compatibility
        for category_name in ["mis_alumnos", "otros_profesores", "padres_apoderados", "personal_administrativo"]:
            contacts.extend(categorized_contacts[category_name])
        
        # Return both flat list and categorized for flexible frontend use
        return {
            "contacts": contacts,
            "categorized": categorized_contacts,
            "categories": [
                {"key": "mis_alumnos", "label": "Mis Alumnos", "icon": "users", "count": len(categorized_contacts["mis_alumnos"])},
                {"key": "otros_profesores", "label": "Profesores", "icon": "chalkboard-teacher", "count": len(categorized_contacts["otros_profesores"])},
                {"key": "padres_apoderados", "label": "Padres/Apoderados", "icon": "user-friends", "count": len(categorized_contacts["padres_apoderados"])},
                {"key": "personal_administrativo", "label": "Personal Administrativo", "icon": "user-tie", "count": len(categorized_contacts["personal_administrativo"])}
            ]
        }
    elif user_role == "student":
        # Build categorized contact list for students
        grade_id = user.get("grade_id") or user.get("grado_id")
        seccion_id = user.get("seccion_id")
        school_id = user.get("school_id")
        added_ids = set()
        categorized_contacts = {
            "mis_profesores": [],
            "companeros": [],
            "personal_administrativo": []
        }
        
        if grade_id:
            # 1. MIS PROFESORES - teachers from subjects
            subjects = await db.subjects.find({"grade_id": grade_id, "teacher_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(100)
            for subject in subjects:
                teacher_id = subject.get("teacher_id")
                if teacher_id and teacher_id not in added_ids:
                    teacher = await db.users.find_one({"id": teacher_id, "is_active": {"$ne": False}, "is_demo": {"$ne": True}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1})
                    if teacher:
                        added_ids.add(teacher["id"])
                        categorized_contacts["mis_profesores"].append({
                            "id": teacher["id"],
                            "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
                            "last_name": teacher.get("last_name", ""),
                            "email": teacher.get("email"),
                            "photo_url": teacher.get("photo_url"),
                            "role": "teacher",
                            "subject_name": subject.get("name", ""),
                            "category": "mis_profesores",
                            "unread_count": unread_by_contact.get(teacher["id"], 0)
                        })
            
            # Also check academic_assignments
            assignments = await db.academic_assignments.find({
                "school_id": school_id,
                "grade_id": grade_id,
                "teacher_id": {"$exists": True, "$ne": None},
                "status": "activo"
            }, {"_id": 0, "teacher_id": 1, "subject_id": 1}).to_list(100)
            
            for assignment in assignments:
                teacher_id = assignment.get("teacher_id")
                if teacher_id and teacher_id not in added_ids:
                    teacher = await db.users.find_one({"id": teacher_id, "is_active": {"$ne": False}, "is_demo": {"$ne": True}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1})
                    if teacher:
                        subject = await db.subjects.find_one({"id": assignment.get("subject_id")}, {"_id": 0, "name": 1})
                        subject_name = subject.get("name", "") if subject else ""
                        added_ids.add(teacher["id"])
                        categorized_contacts["mis_profesores"].append({
                            "id": teacher["id"],
                            "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
                            "last_name": teacher.get("last_name", ""),
                            "email": teacher.get("email"),
                            "photo_url": teacher.get("photo_url"),
                            "role": "teacher",
                            "subject_name": subject_name,
                            "category": "mis_profesores",
                            "unread_count": unread_by_contact.get(teacher["id"], 0)
                        })
        
        # 2. COMPANEROS - classmates (exclude pending)
        classmate_query = {"school_id": school_id, "role": "student", "id": {"$ne": user["id"]}, "is_active": {"$ne": False}, "is_demo": {"$ne": True}, **ACADEMIC_STUDENT_FILTER}
        if seccion_id:
            classmate_query["seccion_id"] = seccion_id
        elif grade_id:
            classmate_query["$or"] = [{"grade_id": grade_id}, {"grado_id": grade_id}]
        
        if seccion_id or grade_id:
            classmates = await db.users.find(classmate_query, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1}).to_list(100)
            for classmate in classmates:
                if classmate["id"] not in added_ids:
                    added_ids.add(classmate["id"])
                    categorized_contacts["companeros"].append({
                        "id": classmate["id"],
                        "name": f"{classmate.get('name', '')} {classmate.get('last_name', '')}".strip(),
                        "last_name": classmate.get("last_name", ""),
                        "email": classmate.get("email"),
                        "photo_url": classmate.get("photo_url"),
                        "role": "student",
                        "category": "companeros",
                        "unread_count": unread_by_contact.get(classmate["id"], 0)
                    })
        
        # 3. PERSONAL ADMINISTRATIVO
        admin_roles = ["admin", "owner", "director", "coordinator"]
        admin_users = await db.users.find({
            "school_id": school_id,
            "role": {"$in": admin_roles},
            "is_active": {"$ne": False}, "is_demo": {"$ne": True}
        }, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1, "role": 1}).to_list(50)
        
        role_display_map = {
            "owner": "Propietario", "admin": "Administrador",
            "director": "Director", "coordinator": "Coordinador"
        }
        
        for admin in admin_users:
            if admin["id"] not in added_ids:
                added_ids.add(admin["id"])
                categorized_contacts["personal_administrativo"].append({
                    "id": admin["id"],
                    "name": f"{admin.get('name', '')} {admin.get('last_name', '')}".strip(),
                    "photo_url": admin.get("photo_url"),
                    "email": admin.get("email"),
                    "role": admin.get("role"),
                    "role_display": role_display_map.get(admin.get("role"), ""),
                    "category": "personal_administrativo",
                    "unread_count": unread_by_contact.get(admin["id"], 0)
                })
        
        for category in categorized_contacts:
            categorized_contacts[category].sort(key=lambda x: (-x.get("unread_count", 0), x.get("name", "")))
        
        for cat_name in categorized_contacts:
            contacts.extend(categorized_contacts[cat_name])
        
        return {
            "contacts": contacts,
            "categorized": categorized_contacts,
            "categories": [
                {"key": "mis_profesores", "label": "Mis Profesores", "icon": "chalkboard-teacher", "count": len(categorized_contacts["mis_profesores"])},
                {"key": "companeros", "label": "Compañeros de Clase", "icon": "users", "count": len(categorized_contacts["companeros"])},
                {"key": "personal_administrativo", "label": "Personal Administrativo", "icon": "user-tie", "count": len(categorized_contacts["personal_administrativo"])}
            ]
        }
    elif user_role in ["admin", "owner", "director", "coordinator"]:
        # Build categorized contact list for admin/owner roles
        added_ids = set()
        categorized_contacts = {
            "profesores": [],
            "alumnos": [],
            "padres_apoderados": [],
            "personal_administrativo": []
        }
        
        all_users = await db.users.find({
            "school_id": user["school_id"],
            "id": {"$ne": user["id"]},
            "is_active": {"$ne": False}, "is_demo": {"$ne": True}
        }, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1, "email": 1}).to_list(500)
        
        admin_roles = ["admin", "owner", "director", "coordinator"]
        role_display_map = {
            "owner": "Propietario", "admin": "Administrador",
            "director": "Director", "coordinator": "Coordinador"
        }
        
        for u in all_users:
            uid = u["id"]
            if uid in added_ids:
                continue
            added_ids.add(uid)
            
            contact = {
                "id": uid,
                "name": f"{u.get('name', '')} {u.get('last_name', '')}".strip(),
                "photo_url": u.get("photo_url"),
                "email": u.get("email"),
                "role": u.get("role", "student"),
                "unread_count": unread_by_contact.get(uid, 0)
            }
            
            r = u.get("role", "student")
            if r == "teacher":
                contact["category"] = "profesores"
                categorized_contacts["profesores"].append(contact)
            elif r == "student":
                contact["category"] = "alumnos"
                categorized_contacts["alumnos"].append(contact)
            elif r == "parent":
                contact["category"] = "padres_apoderados"
                categorized_contacts["padres_apoderados"].append(contact)
            elif r in admin_roles:
                contact["role_display"] = role_display_map.get(r, r)
                contact["category"] = "personal_administrativo"
                categorized_contacts["personal_administrativo"].append(contact)
        
        for category in categorized_contacts:
            categorized_contacts[category].sort(key=lambda x: (-x.get("unread_count", 0), x.get("name", "")))
        
        for cat_name in categorized_contacts:
            contacts.extend(categorized_contacts[cat_name])
        
        return {
            "contacts": contacts,
            "categorized": categorized_contacts,
            "categories": [
                {"key": "alumnos", "label": "Alumnos", "icon": "users", "count": len(categorized_contacts["alumnos"])},
                {"key": "profesores", "label": "Profesores", "icon": "chalkboard-teacher", "count": len(categorized_contacts["profesores"])},
                {"key": "padres_apoderados", "label": "Padres/Apoderados", "icon": "user-friends", "count": len(categorized_contacts["padres_apoderados"])},
                {"key": "personal_administrativo", "label": "Personal Administrativo", "icon": "user-tie", "count": len(categorized_contacts["personal_administrativo"])}
            ]
        }
    elif user_role == "parent":
        # Build categorized contact list for parents
        added_ids = set()
        categorized_contacts = {
            "profesores_hijos": [],
            "personal_administrativo": [],
            "otros_padres": []
        }
        
        school_id = user.get("school_id")
        student_ids = user.get("student_ids") or user.get("children_ids") or []
        
        # 1. PROFESORES DE MIS HIJOS - teachers who teach subjects to linked students
        if student_ids:
            # Get grade/section from linked students
            linked_students = await db.users.find({
                "id": {"$in": student_ids},
                "school_id": school_id,
                "role": "student"
            }, {"_id": 0, "id": 1, "grade_id": 1, "grado_id": 1, "seccion_id": 1, "name": 1, "last_name": 1}).to_list(20)
            
            grade_ids = set()
            for s in linked_students:
                gid = s.get("grade_id") or s.get("grado_id")
                if gid:
                    grade_ids.add(gid)
            
            if grade_ids:
                subjects = await db.subjects.find({
                    "school_id": school_id,
                    "grade_id": {"$in": list(grade_ids)},
                    "teacher_id": {"$exists": True, "$ne": None}
                }, {"_id": 0, "teacher_id": 1, "name": 1}).to_list(100)
                
                teacher_ids_added = set()
                for subj in subjects:
                    tid = subj.get("teacher_id")
                    if tid and tid not in teacher_ids_added:
                        teacher_ids_added.add(tid)
                        teacher = await db.users.find_one({"id": tid, "is_active": {"$ne": False}, "is_demo": {"$ne": True}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1})
                        if teacher and teacher["id"] not in added_ids:
                            added_ids.add(teacher["id"])
                            categorized_contacts["profesores_hijos"].append({
                                "id": teacher["id"],
                                "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
                                "photo_url": teacher.get("photo_url"),
                                "email": teacher.get("email"),
                                "role": "teacher",
                                "subject_name": subj.get("name", ""),
                                "category": "profesores_hijos",
                                "unread_count": unread_by_contact.get(teacher["id"], 0)
                            })
        
        # 2. PERSONAL ADMINISTRATIVO
        admin_roles = ["admin", "owner", "director", "coordinator"]
        admin_users = await db.users.find({
            "school_id": school_id,
            "role": {"$in": admin_roles},
            "id": {"$ne": user["id"]},
            "is_active": {"$ne": False}, "is_demo": {"$ne": True}
        }, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1, "role": 1}).to_list(50)
        
        role_display_map = {
            "owner": "Propietario", "admin": "Administrador",
            "director": "Director", "coordinator": "Coordinador"
        }
        
        for admin in admin_users:
            if admin["id"] not in added_ids:
                added_ids.add(admin["id"])
                categorized_contacts["personal_administrativo"].append({
                    "id": admin["id"],
                    "name": f"{admin.get('name', '')} {admin.get('last_name', '')}".strip(),
                    "photo_url": admin.get("photo_url"),
                    "email": admin.get("email"),
                    "role": admin.get("role"),
                    "role_display": role_display_map.get(admin.get("role"), ""),
                    "category": "personal_administrativo",
                    "unread_count": unread_by_contact.get(admin["id"], 0)
                })
        
        # 3. OTROS PADRES in the same school
        other_parents = await db.users.find({
            "school_id": school_id,
            "role": "parent",
            "id": {"$ne": user["id"]},
            "is_active": {"$ne": False}, "is_demo": {"$ne": True}
        }, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1}).to_list(200)
        
        for p in other_parents:
            if p["id"] not in added_ids:
                added_ids.add(p["id"])
                categorized_contacts["otros_padres"].append({
                    "id": p["id"],
                    "name": f"{p.get('name', '')} {p.get('last_name', '')}".strip(),
                    "photo_url": p.get("photo_url"),
                    "email": p.get("email"),
                    "role": "parent",
                    "category": "otros_padres",
                    "unread_count": unread_by_contact.get(p["id"], 0)
                })
        
        for category in categorized_contacts:
            categorized_contacts[category].sort(key=lambda x: (-x.get("unread_count", 0), x.get("name", "")))
        
        for cat_name in categorized_contacts:
            contacts.extend(categorized_contacts[cat_name])
        
        return {
            "contacts": contacts,
            "categorized": categorized_contacts,
            "categories": [
                {"key": "profesores_hijos", "label": "Profesores de mis Hijos", "icon": "chalkboard-teacher", "count": len(categorized_contacts["profesores_hijos"])},
                {"key": "personal_administrativo", "label": "Personal Administrativo", "icon": "user-tie", "count": len(categorized_contacts["personal_administrativo"])},
                {"key": "otros_padres", "label": "Otros Padres", "icon": "user-friends", "count": len(categorized_contacts["otros_padres"])}
            ]
        }
    
    # Sort contacts: those with unread messages first
    contacts.sort(key=lambda x: (-x.get("unread_count", 0), x.get("name", "")))
    
    return {"contacts": contacts}

@router.post("/messaging/academic")
async def send_academic_message(data: AcademicMessageCreate, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    receiver = await db.users.find_one({"id": data.receiver_id}, {"_id": 0})
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")
    
    if user.get("role") == "student" and receiver.get("role") == "student":
        # Allow students to message classmates in the same section/grade
        user_seccion = user.get("seccion_id")
        receiver_seccion = receiver.get("seccion_id")
        user_grade = user.get("grade_id") or user.get("grado_id")
        receiver_grade = receiver.get("grade_id") or receiver.get("grado_id")
        
        # Must be in the same section or at least same grade
        if user_seccion and receiver_seccion and user_seccion != receiver_seccion:
            raise HTTPException(status_code=403, detail="Solo puedes enviar mensajes a compañeros de tu misma sección")
        if not user_seccion and user_grade != receiver_grade:
            raise HTTPException(status_code=403, detail="Solo puedes enviar mensajes a compañeros de tu mismo grado")
    
    thread = await db.academic_threads.find_one({
        "school_id": user["school_id"],
        "$or": [{"participant_ids": [user["id"], data.receiver_id]}, {"participant_ids": [data.receiver_id, user["id"]]}]
    }, {"_id": 0})
    
    if not thread:
        thread = {
            "id": str(uuid.uuid4()),
            "school_id": user["school_id"],
            "participant_ids": [user["id"], data.receiver_id],
            "participants": [
                {"id": user["id"], "name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(), "role": user.get("role"), "photo_url": user.get("photo_url")},
                {"id": receiver["id"], "name": f"{receiver.get('name', '')} {receiver.get('last_name', '')}".strip(), "role": receiver.get("role"), "photo_url": receiver.get("photo_url")}
            ],
            "subject_id": data.subject_id,
            "messages": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "unread_by": []
        }
        await db.academic_threads.insert_one(thread)
        # Remove _id added by MongoDB
        thread.pop("_id", None)
    
    message = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "sender_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "sender_photo": user.get("photo_url"),
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.academic_threads.update_one(
        {"id": thread["id"]},
        {"$push": {"messages": message}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}, "$addToSet": {"unread_by": data.receiver_id}}
    )
    
    # Push real-time notification to receiver via WebSocket
    try:
        await ws_manager.send_to_user(data.receiver_id, {
            "type": "new_message",
            "thread_id": thread["id"],
            "sender_name": message["sender_name"],
            "content": data.content[:100],
            "created_at": message["created_at"]
        })
    except Exception as e:
        logger.warning(f"WebSocket message push error: {e}")
    
    return {"message": "Mensaje enviado", "data": message, "thread_id": thread["id"]}

# Edit academic message
@router.put("/messaging/academic/{thread_id}/messages/{message_id}")
async def edit_academic_message(thread_id: str, message_id: str, data: dict, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # First find the thread
    thread = await db.academic_threads.find_one({
        "id": thread_id, 
        "school_id": user["school_id"],
        "participant_ids": user["id"]
    }, {"_id": 0})
    
    if not thread:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    
    # Find the message and verify ownership
    message = next((m for m in thread.get("messages", []) if m["id"] == message_id and m["sender_id"] == user["id"]), None)
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado o no tienes permisos")
    
    if message.get("deleted"):
        raise HTTPException(status_code=400, detail="No se puede editar un mensaje eliminado")
    
    new_content = data.get("content", "").strip()
    if not new_content:
        raise HTTPException(status_code=400, detail="El contenido no puede estar vacío")
    
    # Update using arrayFilters for precise update
    await db.academic_threads.update_one(
        {"id": thread_id},
        {"$set": {
            "messages.$[msg].content": new_content,
            "messages.$[msg].edited": True,
            "messages.$[msg].edited_at": datetime.now(timezone.utc).isoformat()
        }},
        array_filters=[{"msg.id": message_id}]
    )
    return {"message": "Mensaje editado"}

# Delete academic message
@router.delete("/messaging/academic/{thread_id}/messages/{message_id}")
async def delete_academic_message(thread_id: str, message_id: str, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # First find the thread
    thread = await db.academic_threads.find_one({
        "id": thread_id, 
        "school_id": user["school_id"],
        "participant_ids": user["id"]
    }, {"_id": 0})
    
    if not thread:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    
    # Find the message and verify ownership
    message = next((m for m in thread.get("messages", []) if m["id"] == message_id and m["sender_id"] == user["id"]), None)
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado o no tienes permisos")
    
    # Update using arrayFilters for precise update
    await db.academic_threads.update_one(
        {"id": thread_id},
        {"$set": {
            "messages.$[msg].content": "Este mensaje fue eliminado",
            "messages.$[msg].deleted": True,
            "messages.$[msg].deleted_at": datetime.now(timezone.utc).isoformat()
        }},
        array_filters=[{"msg.id": message_id}]
    )
    return {"message": "Mensaje eliminado"}

@router.get("/messaging/academic")
async def get_academic_threads(limit: int = 50, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    threads = await db.academic_threads.find({"school_id": user["school_id"], "participant_ids": user["id"]}, {"_id": 0}).sort("updated_at", -1).limit(limit).to_list(limit)
    
    # Get demo user IDs to filter them out
    demo_users = await db.users.find({"is_demo": True}, {"_id": 0, "id": 1}).to_list(500)
    demo_ids = {u["id"] for u in demo_users}
    
    filtered_threads = []
    for thread in threads:
        thread["has_unread"] = user["id"] in thread.get("unread_by", [])
        other = next((p for p in thread.get("participants", []) if p["id"] != user["id"]), None)
        thread["other_participant"] = other
        # Skip threads where the other participant is a demo user
        if other and other.get("id") in demo_ids:
            continue
        filtered_threads.append(thread)
    
    unread_count = sum(1 for t in filtered_threads if t["has_unread"])
    return {"threads": filtered_threads, "unread_count": unread_count, "total_count": len(filtered_threads)}

@router.get("/messaging/academic/{thread_id}")
async def get_academic_thread(thread_id: str, current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    thread = await db.academic_threads.find_one({"id": thread_id, "school_id": user["school_id"], "participant_ids": user["id"]}, {"_id": 0})
    if not thread:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    
    # Calculate other_participant for the current user
    other_participant = None
    for p in thread.get("participants", []):
        if p.get("id") != user["id"]:
            other_participant = p
            break
    thread["other_participant"] = other_participant
    
    await db.academic_threads.update_one({"id": thread_id}, {"$pull": {"unread_by": user["id"]}})
    return thread

@router.get("/messaging/stats")
async def get_messaging_stats(current_user = Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    unread_inst = await db.institutional_messages.count_documents({"school_id": user["school_id"], "status": "active", "read_by": {"$ne": user["id"]}})
    
    support_query = {"school_id": user["school_id"]}
    if user.get("role") in ["admin", "owner", "director", "coordinator"]:
        support_query["status"] = {"$in": ["open", "in_progress"]}
    else:
        support_query.update({"creator_id": user["id"], "status": "responded"})
    unread_support = await db.support_tickets.count_documents(support_query)
    
    unread_academic = await db.academic_threads.count_documents({"school_id": user["school_id"], "participant_ids": user["id"], "unread_by": user["id"]})
    
    return {"total_unread": unread_inst + unread_support + unread_academic, "institutional": unread_inst, "support": unread_support, "academic": unread_academic}


# ══════════════════════════════════════════════════════════════════════════════

# INTERNAL MAIL SYSTEM - Premium Email-like Messaging
# ══════════════════════════════════════════════════════════════════════════════

class InternalMailCreate(BaseModel):
    subject: str
    body: str
    recipient_ids: List[str]  # List of user IDs
    recipient_type: Optional[str] = "individual"  # individual, role, section
    attachments: Optional[List[dict]] = []

class InternalMailReply(BaseModel):
    body: str
    attachments: Optional[List[dict]] = []

# Get inbox messages
@router.get("/internal-mail/inbox")
async def get_inbox(
    page: int = 1,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get inbox messages for current user (includes broadcast messages)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    skip = (page - 1) * limit
    
    # Find regular messages where user is recipient and not deleted
    pipeline = [
        {"$match": {
            "recipients.user_id": user["id"],
            "recipients.is_deleted": {"$ne": True}
        }},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    messages = await db.internal_mail.aggregate(pipeline).to_list(limit)
    
    # Get total count of regular messages
    total_regular = await db.internal_mail.count_documents({
        "recipients.user_id": user["id"],
        "recipients.is_deleted": {"$ne": True}
    })
    
    # Get broadcast messages for this user
    broadcast_receivers = await db.broadcast_receivers.find(
        {"user_id": user["id"], "school_id": user.get("school_id")},
        {"_id": 0}
    ).to_list(None)
    
    broadcast_map = {r["message_id"]: r for r in broadcast_receivers}
    broadcast_ids = list(broadcast_map.keys())
    
    broadcasts = []
    if broadcast_ids:
        broadcasts = await db.broadcast_messages.find(
            {"id": {"$in": broadcast_ids}, "status": "active"},
            {"_id": 0}
        ).sort("created_at", -1).to_list(None)
    
    # Enrich regular messages
    enriched = []
    for msg in messages:
        sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "password": 0})
        
        # Find this user's recipient entry
        recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), {})
        
        enriched.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body_preview": msg["body"][:150] + "..." if len(msg["body"]) > 150 else msg["body"],
            "body": msg["body"],
            "sender": {
                "id": sender["id"] if sender else None,
                "name": sender.get("name", "Usuario") if sender else "Usuario eliminado",
                "email": sender.get("email", "") if sender else "",
                "photo_url": sender.get("photo_url") if sender else None,
                "role": sender.get("role", "") if sender else ""
            },
            "created_at": msg["created_at"],
            "is_read": recipient_entry.get("is_read", False),
            "is_starred": recipient_entry.get("is_starred", False),
            "is_archived": recipient_entry.get("is_archived", False),
            "has_attachments": len(msg.get("attachments", [])) > 0,
            "attachments": msg.get("attachments", []),
            "recipient_count": len(msg.get("recipients", [])),
            "message_type": "normal"
        })
    
    # Add broadcast messages to the list
    for b in broadcasts:
        recv = broadcast_map.get(b["id"], {})
        enriched.append({
            "id": b["id"],
            "subject": b["subject"],
            "body_preview": b["body"][:150] + "..." if len(b["body"]) > 150 else b["body"],
            "body": b["body"],
            "sender": {
                "id": b.get("sender_id"),
                "name": b.get("sender_name", "Propietario"),
                "email": "",
                "photo_url": b.get("sender_photo"),
                "role": b.get("sender_role", "owner")
            },
            "created_at": b["created_at"],
            "is_read": recv.get("read_at") is not None,
            "is_starred": False,
            "is_archived": False,
            "has_attachments": False,
            "attachments": [],
            "recipient_count": b.get("total_recipients", 0),
            "message_type": "broadcast",
            "target_roles": b.get("target_roles", [])
        })
    
    # Sort all by date descending
    enriched.sort(key=lambda x: x["created_at"], reverse=True)
    
    total = total_regular + len(broadcasts)
    
    return {
        "messages": enriched,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# Get sent messages
@router.get("/internal-mail/sent")
async def get_sent(
    page: int = 1,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get sent messages for current user"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    skip = (page - 1) * limit
    
    messages = await db.internal_mail.find(
        {"sender_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.internal_mail.count_documents({"sender_id": user["id"]})
    
    enriched = []
    for msg in messages:
        # Get recipient names
        recipient_ids = [r["user_id"] for r in msg.get("recipients", [])]
        recipients = await db.users.find(
            {"id": {"$in": recipient_ids}},
            {"_id": 0, "id": 1, "name": 1, "photo_url": 1}
        ).to_list(100)
        
        enriched.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body_preview": msg["body"][:150] + "..." if len(msg["body"]) > 150 else msg["body"],
            "body": msg["body"],
            "recipients": recipients,
            "created_at": msg["created_at"],
            "has_attachments": len(msg.get("attachments", [])) > 0,
            "attachments": msg.get("attachments", []),
            "recipient_count": len(recipients)
        })
    
    return {
        "messages": enriched,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# Get unread messages
@router.get("/internal-mail/unread")
async def get_unread(current_user = Depends(get_current_user)):
    """Get unread messages count and list"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Count unread
    pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user["id"],
                    "is_read": False,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    
    result = await db.internal_mail.aggregate(pipeline).to_list(1)
    count = result[0]["count"] if result else 0
    
    return {"unread_count": count}

# Get archived messages
@router.get("/internal-mail/archived")
async def get_archived(
    page: int = 1,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get archived messages (both received and sent)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    skip = (page - 1) * limit
    
    # Get archived received messages
    received_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user["id"],
                    "is_archived": True,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$addFields": {"message_type": "received"}}
    ]
    
    # Get archived sent messages
    sent_pipeline = [
        {"$match": {
            "sender_id": user["id"],
            "sender_archived": True,
            "sender_deleted": {"$ne": True}
        }},
        {"$addFields": {"message_type": "sent"}}
    ]
    
    # Combine both
    all_messages = []
    received = await db.internal_mail.aggregate(received_pipeline).to_list(100)
    sent = await db.internal_mail.aggregate(sent_pipeline).to_list(100)
    all_messages = received + sent
    
    # Sort by created_at and paginate
    all_messages.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    messages = all_messages[skip:skip + limit]
    
    enriched = []
    for msg in messages:
        if msg.get("message_type") == "sent":
            # For sent messages, show recipient info
            first_recipient_id = msg["recipients"][0]["user_id"] if msg.get("recipients") else None
            recipient = await db.users.find_one({"id": first_recipient_id}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}) if first_recipient_id else None
            enriched.append({
                "id": msg["id"],
                "subject": msg["subject"],
                "body_preview": msg["body"][:150] + "..." if len(msg.get("body", "")) > 150 else msg.get("body", ""),
                "body": msg.get("body", ""),
                "sender": {
                    "id": user["id"],
                    "name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
                    "photo_url": user.get("photo_url"),
                },
                "recipient": {
                    "id": recipient["id"] if recipient else first_recipient_id,
                    "name": f"{recipient.get('name', '')} {recipient.get('last_name', '')}".strip() if recipient else "Usuario",
                    "photo_url": recipient.get("photo_url") if recipient else None,
                },
                "created_at": msg["created_at"],
                "is_read": True,
                "message_type": "sent",
                "has_attachments": len(msg.get("attachments", [])) > 0
            })
        else:
            # For received messages, show sender info
            sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "password": 0})
            recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), {})
            enriched.append({
                "id": msg["id"],
                "subject": msg["subject"],
                "body_preview": msg["body"][:150] + "..." if len(msg.get("body", "")) > 150 else msg.get("body", ""),
                "body": msg.get("body", ""),
                "sender": {
                    "id": sender["id"] if sender else None,
                    "name": f"{sender.get('name', '')} {sender.get('last_name', '')}".strip() if sender else "Usuario eliminado",
                    "photo_url": sender.get("photo_url") if sender else None,
                    "role": sender.get("role") if sender else None,
                    "email": sender.get("email") if sender else None,
                },
                "created_at": msg["created_at"],
                "is_read": recipient_entry.get("is_read", False),
                "message_type": "received",
                "has_attachments": len(msg.get("attachments", [])) > 0
            })
    
    return {"messages": enriched}

# Get trash messages
@router.get("/internal-mail/trash")
async def get_trash(
    page: int = 1,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get deleted/trash messages (both received and sent)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    skip = (page - 1) * limit
    
    # Get deleted received messages
    received_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user["id"],
                    "is_deleted": True
                }
            }
        }},
        {"$addFields": {"message_type": "received"}}
    ]
    
    # Get deleted sent messages
    sent_pipeline = [
        {"$match": {
            "sender_id": user["id"],
            "sender_deleted": True
        }},
        {"$addFields": {"message_type": "sent"}}
    ]
    
    # Combine both
    all_messages = []
    received = await db.internal_mail.aggregate(received_pipeline).to_list(100)
    sent = await db.internal_mail.aggregate(sent_pipeline).to_list(100)
    all_messages = received + sent
    
    # Sort by created_at and paginate
    all_messages.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    messages = all_messages[skip:skip + limit]
    
    enriched = []
    for msg in messages:
        if msg.get("message_type") == "sent":
            first_recipient_id = msg["recipients"][0]["user_id"] if msg.get("recipients") else None
            recipient = await db.users.find_one({"id": first_recipient_id}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}) if first_recipient_id else None
            enriched.append({
                "id": msg["id"],
                "subject": msg["subject"],
                "body_preview": msg["body"][:150] + "..." if len(msg.get("body", "")) > 150 else msg.get("body", ""),
                "body": msg.get("body", ""),
                "sender": {
                    "id": user["id"],
                    "name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
                    "photo_url": user.get("photo_url"),
                },
                "recipient": {
                    "id": recipient["id"] if recipient else first_recipient_id,
                    "name": f"{recipient.get('name', '')} {recipient.get('last_name', '')}".strip() if recipient else "Usuario",
                    "photo_url": recipient.get("photo_url") if recipient else None,
                },
                "created_at": msg["created_at"],
                "message_type": "sent",
                "has_attachments": len(msg.get("attachments", [])) > 0
            })
        else:
            sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "password": 0})
            enriched.append({
                "id": msg["id"],
                "subject": msg["subject"],
                "body_preview": msg["body"][:150] + "..." if len(msg.get("body", "")) > 150 else msg.get("body", ""),
                "body": msg.get("body", ""),
                "sender": {
                    "id": sender["id"] if sender else None,
                    "name": f"{sender.get('name', '')} {sender.get('last_name', '')}".strip() if sender else "Usuario eliminado",
                    "photo_url": sender.get("photo_url") if sender else None,
                    "role": sender.get("role") if sender else None,
                    "email": sender.get("email") if sender else None,
                },
                "created_at": msg["created_at"],
                "message_type": "received",
                "has_attachments": len(msg.get("attachments", [])) > 0
            })
    
    return {"messages": enriched}


# Get mail stats - MUST be before {message_id} route
@router.get("/internal-mail/stats")
async def get_mail_stats(current_user = Depends(get_current_user)):
    """Get mail statistics for badges"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    
    # Unread count
    unread_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user_id,
                    "is_read": False,
                    "is_deleted": {"$ne": True},
                    "is_archived": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    unread_result = await db.internal_mail.aggregate(unread_pipeline).to_list(1)
    unread = unread_result[0]["count"] if unread_result else 0
    
    # Inbox count (not archived, not deleted)
    inbox_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user_id,
                    "is_deleted": {"$ne": True},
                    "is_archived": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    inbox_result = await db.internal_mail.aggregate(inbox_pipeline).to_list(1)
    inbox = inbox_result[0]["count"] if inbox_result else 0
    
    # Sent count
    sent = await db.internal_mail.count_documents({"sender_id": user_id})
    
    # Archived count
    archived_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user_id,
                    "is_archived": True,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    archived_result = await db.internal_mail.aggregate(archived_pipeline).to_list(1)
    archived = archived_result[0]["count"] if archived_result else 0
    
    # Trash count
    trash_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user_id,
                    "is_deleted": True
                }
            }
        }},
        {"$count": "count"}
    ]
    trash_result = await db.internal_mail.aggregate(trash_pipeline).to_list(1)
    trash = trash_result[0]["count"] if trash_result else 0
    
    # Also count unread broadcasts
    broadcast_unread = await db.broadcast_receivers.count_documents({
        "user_id": user_id,
        "read_at": None
    })
    
    return {
        "unread": unread + broadcast_unread,
        "inbox": inbox,
        "sent": sent,
        "archived": archived,
        "trash": trash
    }


# Get single message
@router.get("/internal-mail/{message_id}")
async def get_message(message_id: str, current_user = Depends(get_current_user)):
    """Get a single message and mark as read"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    msg = await db.internal_mail.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        # Fallback: the inbox also surfaces broadcast messages, whose id lives in
        # `broadcast_messages` (not `internal_mail`). Resolve & return those too so
        # they can be opened (previously this 404'd and the detail never rendered).
        broadcast = await db.broadcast_messages.find_one({"id": message_id}, {"_id": 0})
        if broadcast:
            recv = await db.broadcast_receivers.find_one(
                {"message_id": message_id, "user_id": user["id"]}, {"_id": 0}
            )
            if not recv:
                raise HTTPException(status_code=403, detail="No tienes acceso a este mensaje")
            # Mark broadcast as read for this user
            if not recv.get("read_at"):
                await db.broadcast_receivers.update_one(
                    {"message_id": message_id, "user_id": user["id"]},
                    {"$set": {"read_at": datetime.now(timezone.utc).isoformat()}}
                )
            return {
                "id": broadcast["id"],
                "subject": broadcast.get("subject", ""),
                "body": broadcast.get("body", ""),
                "sender": {
                    "id": broadcast.get("sender_id"),
                    "name": broadcast.get("sender_name", "Propietario"),
                    "email": "",
                    "photo_url": broadcast.get("sender_photo"),
                    "role": broadcast.get("sender_role", "owner"),
                },
                "recipients": [],
                "created_at": broadcast.get("created_at"),
                "attachments": broadcast.get("attachments", []),
                "is_read": True,
                "is_starred": False,
                "is_archived": False,
                "thread_id": None,
                "reply_to_id": None,
                "read_stats": None,
                "message_type": "broadcast",
            }
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    # Check if user is sender or recipient
    is_sender = msg["sender_id"] == user["id"]
    recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), None)
    
    if not is_sender and not recipient_entry:
        raise HTTPException(status_code=403, detail="No tienes acceso a este mensaje")
    
    # Mark as read if recipient
    if recipient_entry and not recipient_entry.get("is_read"):
        await db.internal_mail.update_one(
            {"id": message_id, "recipients.user_id": user["id"]},
            {"$set": {"recipients.$.is_read": True, "recipients.$.read_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Get sender info
    sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "password": 0})
    
    # Get all recipients info
    recipient_ids = [r["user_id"] for r in msg.get("recipients", [])]
    recipients_data = await db.users.find(
        {"id": {"$in": recipient_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "photo_url": 1, "role": 1}
    ).to_list(100)
    
    # Build read stats for sender
    read_stats = None
    if is_sender:
        all_recipients = msg.get("recipients", [])
        total = len(all_recipients)
        read_count = sum(1 for r in all_recipients if r.get("is_read"))
        pending = total - read_count
        read_stats = {"total": total, "read": read_count, "pending": pending}
    
    return {
        "id": msg["id"],
        "subject": msg["subject"],
        "body": msg["body"],
        "sender": {
            "id": sender["id"] if sender else None,
            "name": sender.get("name", "Usuario") if sender else "Usuario eliminado",
            "email": sender.get("email", "") if sender else "",
            "photo_url": sender.get("photo_url") if sender else None,
            "role": sender.get("role", "") if sender else ""
        },
        "recipients": recipients_data,
        "created_at": msg["created_at"],
        "attachments": msg.get("attachments", []),
        "is_read": recipient_entry.get("is_read", True) if recipient_entry else True,
        "is_starred": recipient_entry.get("is_starred", False) if recipient_entry else False,
        "is_archived": recipient_entry.get("is_archived", False) if recipient_entry else False,
        "thread_id": msg.get("thread_id"),
        "reply_to_id": msg.get("reply_to_id"),
        "read_stats": read_stats
    }

# Send new message
@router.post("/internal-mail/send")
async def send_internal_mail(data: InternalMailCreate, current_user = Depends(get_current_user)):
    """Send a new internal mail message"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if not data.subject.strip():
        raise HTTPException(status_code=400, detail="El asunto es requerido")
    
    if not data.body.strip():
        raise HTTPException(status_code=400, detail="El cuerpo del mensaje es requerido")
    
    if not data.recipient_ids:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos un destinatario")
    
    # RBAC: Students cannot send mass messages
    if user.get("role") == "student" and len(data.recipient_ids) > 5:
        raise HTTPException(status_code=403, detail="Los estudiantes no pueden enviar mensajes masivos")
    
    # Create recipient entries
    recipients = []
    for rid in data.recipient_ids:
        recipients.append({
            "user_id": rid,
            "is_read": False,
            "is_starred": False,
            "is_archived": False,
            "is_deleted": False
        })
    
    message_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())  # New thread
    
    message = {
        "id": message_id,
        "thread_id": thread_id,
        "sender_id": user["id"],
        "subject": data.subject.strip(),
        "body": data.body,
        "recipients": recipients,
        "attachments": data.attachments or [],
        "school_id": user.get("school_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_mail.insert_one(message)
    
    return {"id": message_id, "thread_id": thread_id, "message": "Mensaje enviado correctamente"}

# Reply to message
@router.post("/internal-mail/{message_id}/reply")
async def reply_to_mail(message_id: str, data: InternalMailReply, current_user = Depends(get_current_user)):
    """Reply to a message"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    original = await db.internal_mail.find_one({"id": message_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Mensaje original no encontrado")
    
    # Reply goes to original sender
    reply_to_id = original["sender_id"]
    
    # Create recipient entry for original sender
    recipients = [{
        "user_id": reply_to_id,
        "is_read": False,
        "is_starred": False,
        "is_archived": False,
        "is_deleted": False
    }]
    
    new_id = str(uuid.uuid4())
    
    reply = {
        "id": new_id,
        "thread_id": original.get("thread_id", message_id),
        "reply_to_id": message_id,
        "sender_id": user["id"],
        "subject": f"Re: {original['subject']}" if not original['subject'].startswith("Re:") else original['subject'],
        "body": data.body,
        "recipients": recipients,
        "attachments": data.attachments or [],
        "school_id": user.get("school_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_mail.insert_one(reply)
    
    return {"id": new_id, "message": "Respuesta enviada correctamente"}

# Mark message as read/unread
@router.put("/internal-mail/{message_id}/read")
async def toggle_read(message_id: str, is_read: bool = True, current_user = Depends(get_current_user)):
    """Mark message as read or unread"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    result = await db.internal_mail.update_one(
        {"id": message_id, "recipients.user_id": user["id"]},
        {"$set": {"recipients.$.is_read": is_read}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    return {"success": True}

# Star/unstar message
@router.put("/internal-mail/{message_id}/star")
async def toggle_star(message_id: str, is_starred: bool = True, current_user = Depends(get_current_user)):
    """Star or unstar a message"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    await db.internal_mail.update_one(
        {"id": message_id, "recipients.user_id": user["id"]},
        {"$set": {"recipients.$.is_starred": is_starred}}
    )
    
    return {"success": True}

# Archive message
@router.put("/internal-mail/{message_id}/archive")
async def archive_message(message_id: str, is_archived: bool = True, current_user = Depends(get_current_user)):
    """Archive or unarchive a message"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Check if user is sender or recipient
    message = await db.internal_mail.find_one({"id": message_id}, {"_id": 0, "sender_id": 1, "recipients": 1})
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    if message.get("sender_id") == user["id"]:
        # User is sender - update sender_archived flag
        await db.internal_mail.update_one(
            {"id": message_id},
            {"$set": {"sender_archived": is_archived}}
        )
    else:
        # User is recipient - update recipient's is_archived
        await db.internal_mail.update_one(
            {"id": message_id, "recipients.user_id": user["id"]},
            {"$set": {"recipients.$.is_archived": is_archived}}
        )
    
    return {"success": True}

# Delete message (soft delete)
@router.delete("/internal-mail/{message_id}")
async def delete_internal_mail(message_id: str, current_user = Depends(get_current_user)):
    """Soft delete a message (move to trash)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Check if user is sender or recipient
    message = await db.internal_mail.find_one({"id": message_id}, {"_id": 0, "sender_id": 1, "recipients": 1})
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    if message.get("sender_id") == user["id"]:
        # User is sender - update sender_deleted flag
        await db.internal_mail.update_one(
            {"id": message_id},
            {"$set": {"sender_deleted": True, "sender_deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # User is recipient - update recipient's is_deleted
        await db.internal_mail.update_one(
            {"id": message_id, "recipients.user_id": user["id"]},
            {"$set": {"recipients.$.is_deleted": True, "recipients.$.deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"success": True}

# Restore from trash
@router.put("/internal-mail/{message_id}/restore")
async def restore_message(message_id: str, current_user = Depends(get_current_user)):
    """Restore a message from trash"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Check if user is sender or recipient
    message = await db.internal_mail.find_one({"id": message_id}, {"_id": 0, "sender_id": 1})
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    if message.get("sender_id") == user["id"]:
        # User is sender
        await db.internal_mail.update_one(
            {"id": message_id},
            {"$set": {"sender_deleted": False}, "$unset": {"sender_deleted_at": ""}}
        )
    else:
        # User is recipient
        await db.internal_mail.update_one(
            {"id": message_id, "recipients.user_id": user["id"]},
            {"$set": {"recipients.$.is_deleted": False}, "$unset": {"recipients.$.deleted_at": ""}}
        )
    
    return {"success": True}

# Permanently delete message from trash
@router.delete("/internal-mail/{message_id}/permanent")
async def permanent_delete_message(message_id: str, current_user = Depends(get_current_user)):
    """Permanently delete a message from trash (cannot be recovered)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Check if user is sender or recipient
    message = await db.internal_mail.find_one({"id": message_id}, {"_id": 0, "sender_id": 1, "recipients": 1})
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    if message.get("sender_id") == user["id"]:
        # User is sender - check if it's in their trash
        if message.get("sender_deleted"):
            # Delete the entire message if user is the sender
            await db.internal_mail.delete_one({"id": message_id})
    else:
        # User is recipient - remove them from recipients array
        recipient_entry = next((r for r in message.get("recipients", []) if r.get("user_id") == user["id"]), None)
        if recipient_entry and recipient_entry.get("is_deleted"):
            # Remove recipient from the message
            await db.internal_mail.update_one(
                {"id": message_id},
                {"$pull": {"recipients": {"user_id": user["id"]}}}
            )
            # If no recipients left and sender also deleted, remove the entire message
            updated_msg = await db.internal_mail.find_one({"id": message_id}, {"_id": 0, "recipients": 1, "sender_deleted": 1})
            if updated_msg and len(updated_msg.get("recipients", [])) == 0 and updated_msg.get("sender_deleted"):
                await db.internal_mail.delete_one({"id": message_id})
    
    return {"success": True}

# Empty entire trash
@router.delete("/internal-mail/trash/empty")
async def empty_trash(current_user = Depends(get_current_user)):
    """Permanently delete all messages in trash"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get all messages in user's trash (both sent and received)
    # Received messages in trash
    received_in_trash = await db.internal_mail.find({
        "recipients": {
            "$elemMatch": {
                "user_id": user["id"],
                "is_deleted": True
            }
        }
    }, {"_id": 0, "id": 1}).to_list(1000)
    
    # Remove user from recipients for received messages
    for msg in received_in_trash:
        await db.internal_mail.update_one(
            {"id": msg["id"]},
            {"$pull": {"recipients": {"user_id": user["id"]}}}
        )
    
    # Sent messages in trash - delete entirely
    await db.internal_mail.delete_many({
        "sender_id": user["id"],
        "sender_deleted": True
    })
    
    # Clean up messages with no recipients and deleted sender
    await db.internal_mail.delete_many({
        "recipients": {"$size": 0}
    })
    
    return {"success": True, "message": "Papelera vaciada correctamente"}

# Get contacts for composing
@router.get("/internal-mail/contacts/search")
async def search_contacts(q: str = "", current_user = Depends(get_current_user)):
    """Search contacts for message composition"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    
    query = {
        "school_id": school_id,
        "id": {"$ne": user["id"]},  # Exclude self
        "is_active": {"$ne": False}  # Include users with is_active=True or missing field
    }
    
    if q:
        # Search in name, first_name, last_name and email
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"first_name": {"$regex": q, "$options": "i"}},
            {"last_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}}
        ]
    
    # RBAC: Parents can only see teachers of their children
    if user.get("role") == "parent":
        # Get children's teacher IDs
        children = await db.users.find({"parent_ids": user["id"]}, {"_id": 0, "id": 1}).to_list(100)
        child_ids = [c["id"] for c in children]
        
        enrollments = await db.enrollments.find({"student_id": {"$in": child_ids}}, {"_id": 0, "course_id": 1}).to_list(100)
        course_ids = list(set([e["course_id"] for e in enrollments]))
        
        courses = await db.courses.find({"id": {"$in": course_ids}}, {"_id": 0, "teacher_id": 1}).to_list(100)
        teacher_ids = list(set([c["teacher_id"] for c in courses if c.get("teacher_id")]))
        
        query["id"] = {"$in": teacher_ids}
    
    contacts = await db.users.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "role": 1, "photo_url": 1}
    ).limit(50).to_list(50)
    
    return {"contacts": contacts}


# ══════════════════════════════════════════════════════════════════════════════

