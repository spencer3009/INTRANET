"""
Broadcast (comunicado masivo) module
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
    ws_manager,
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# BROADCAST (COMUNICADO MASIVO) MODULE
# ══════════════════════════════════════════════════════════════════════════════

class BroadcastAttachmentRef(BaseModel):
    file_id: str
    name: str
    mime_type: str
    size: int
    drive_file_id: str
    storage_type: str = "google_drive"


class BroadcastCreate(BaseModel):
    subject: str
    body: str
    target_roles: List[str]  # ["teacher", "student", "parent", "admin"]
    attachments: List[BroadcastAttachmentRef] = []

async def check_broadcast_permission(user: dict) -> bool:
    """Check if user can send broadcast messages"""
    role = user.get("role")
    if role == "owner":
        return True
    if role == "admin":
        school = await db.schools.find_one({"id": user.get("school_id")}, {"_id": 0, "allow_admin_broadcast": 1})
        return school.get("allow_admin_broadcast", False) if school else False
    return False

@router.get("/broadcast/permission")
async def get_broadcast_permission(current_user=Depends(get_current_user)):
    """Check if the current user has broadcast permission"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    can_send = await check_broadcast_permission(user)
    return {"can_send_broadcast": can_send}

@router.get("/broadcast/recipients-count")
async def get_broadcast_recipients_count(
    roles: str = "",
    current_user=Depends(get_current_user)
):
    """Get the count of recipients per role for the school"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    can_send = await check_broadcast_permission(user)
    if not can_send:
        raise HTTPException(status_code=403, detail="No tienes permiso para enviar comunicados")
    
    school_id = user.get("school_id")
    target_roles = [r.strip() for r in roles.split(",") if r.strip()] if roles else []
    
    counts = {}
    for role in ["teacher", "student", "parent", "admin"]:
        count = await db.users.count_documents({
            "school_id": school_id,
            "role": role,
            "is_active": {"$ne": False}
        })
        counts[role] = count
    
    # Calculate total for selected roles
    total = sum(counts.get(r, 0) for r in target_roles) if target_roles else 0
    
    return {"counts": counts, "total": total, "selected_roles": target_roles}

@router.post("/broadcast/send")
async def send_broadcast(data: BroadcastCreate, background_tasks: BackgroundTasks, current_user=Depends(get_current_user)):
    """Send a broadcast message to selected role groups"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    can_send = await check_broadcast_permission(user)
    if not can_send:
        raise HTTPException(status_code=403, detail="No tienes permiso para enviar comunicados institucionales")
    
    if not data.target_roles:
        raise HTTPException(status_code=400, detail="Debes seleccionar al menos un grupo de destinatarios")
    if not data.subject.strip():
        raise HTTPException(status_code=400, detail="El asunto es requerido")
    if not data.body.strip():
        raise HTTPException(status_code=400, detail="El mensaje es requerido")
    
    school_id = user.get("school_id")
    broadcast_id = str(uuid.uuid4())
    
    # Get recipient count
    recipients = await db.users.find(
        {"school_id": school_id, "role": {"$in": data.target_roles}, "is_active": {"$ne": False}},
        {"_id": 0, "id": 1}
    ).to_list(None)
    
    recipient_ids = [r["id"] for r in recipients]
    
    # Create broadcast message
    broadcast = {
        "id": broadcast_id,
        "school_id": school_id,
        "subject": data.subject.strip(),
        "body": data.body,
        "target_roles": data.target_roles,
        "sender_id": user["id"],
        "sender_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "sender_role": user.get("role"),
        "sender_photo": user.get("photo_url"),
        "total_recipients": len(recipient_ids),
        "read_count": 0,
        "message_type": "broadcast",
        "priority": "high",
        "status": "active",
        "attachments": [a.dict() for a in (data.attachments or [])],
        "has_attachments": bool(data.attachments),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.broadcast_messages.insert_one(broadcast)
    
    # Create receiver records in background to avoid blocking
    async def create_receivers():
        receivers = []
        for uid in recipient_ids:
            receivers.append({
                "id": str(uuid.uuid4()),
                "message_id": broadcast_id,
                "user_id": uid,
                "school_id": school_id,
                "read_at": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        if receivers:
            await db.broadcast_receivers.insert_many(receivers)
    
    background_tasks.add_task(create_receivers)
    
    broadcast.pop("_id", None)
    return {"message": "Comunicado enviado exitosamente", "broadcast_id": broadcast_id, "total_recipients": len(recipient_ids)}

@router.get("/broadcast/unread")
async def get_unread_broadcasts(current_user=Depends(get_current_user)):
    """Get unread broadcast messages for the current user"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    user_id = user["id"]
    
    # Find broadcasts where this user is a receiver and hasn't read
    unread_receivers = await db.broadcast_receivers.find(
        {"user_id": user_id, "school_id": school_id, "read_at": None},
        {"_id": 0, "message_id": 1}
    ).to_list(None)
    
    if not unread_receivers:
        return {"broadcasts": [], "count": 0}
    
    message_ids = [r["message_id"] for r in unread_receivers]
    broadcasts = await db.broadcast_messages.find(
        {"id": {"$in": message_ids}, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    
    return {"broadcasts": broadcasts, "count": len(broadcasts)}

@router.post("/broadcast/{broadcast_id}/read")
async def mark_broadcast_read(broadcast_id: str, current_user=Depends(get_current_user)):
    """Mark a broadcast as read by the current user"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    now = datetime.now(timezone.utc).isoformat()
    result = await db.broadcast_receivers.update_one(
        {"message_id": broadcast_id, "user_id": user["id"], "read_at": None},
        {"$set": {"read_at": now}}
    )
    
    if result.modified_count > 0:
        await db.broadcast_messages.update_one(
            {"id": broadcast_id},
            {"$inc": {"read_count": 1}}
        )
    
    return {"message": "Comunicado marcado como leído"}

@router.get("/broadcast/sent")
async def get_sent_broadcasts(
    page: int = 1,
    limit: int = 50,
    current_user=Depends(get_current_user)
):
    """Get broadcasts sent by the current user (owner/admin) with read stats"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    can_send = await check_broadcast_permission(user)
    if not can_send:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    
    school_id = user.get("school_id")
    skip = (page - 1) * limit
    total = await db.broadcast_messages.count_documents({"school_id": school_id, "status": "active"})
    broadcasts = await db.broadcast_messages.find(
        {"school_id": school_id, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"broadcasts": broadcasts, "total": total, "page": page, "pages": (total + limit - 1) // limit if total > 0 else 1}

@router.get("/broadcast/{broadcast_id}/stats")
async def get_broadcast_stats(broadcast_id: str, current_user=Depends(get_current_user)):
    """Get detailed read statistics for a broadcast"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    can_send = await check_broadcast_permission(user)
    if not can_send:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    
    broadcast = await db.broadcast_messages.find_one({"id": broadcast_id}, {"_id": 0})
    if not broadcast:
        raise HTTPException(status_code=404, detail="Comunicado no encontrado")
    
    total = await db.broadcast_receivers.count_documents({"message_id": broadcast_id})
    read = await db.broadcast_receivers.count_documents({"message_id": broadcast_id, "read_at": {"$ne": None}})
    pending = total - read
    
    return {
        "broadcast": broadcast,
        "total": total,
        "read": read,
        "pending": pending
    }

@router.get("/broadcast/inbox")
async def get_broadcast_inbox(current_user=Depends(get_current_user)):
    """Get all broadcast messages received by the current user"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    user_id = user["id"]
    
    # Find all receivers for this user
    receivers = await db.broadcast_receivers.find(
        {"user_id": user_id, "school_id": school_id},
        {"_id": 0}
    ).to_list(None)
    
    if not receivers:
        return {"broadcasts": []}
    
    receiver_map = {r["message_id"]: r for r in receivers}
    message_ids = list(receiver_map.keys())
    
    broadcasts = await db.broadcast_messages.find(
        {"id": {"$in": message_ids}, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    
    for b in broadcasts:
        recv = receiver_map.get(b["id"], {})
        b["is_read"] = recv.get("read_at") is not None
        b["read_at"] = recv.get("read_at")
    
    return {"broadcasts": broadcasts}


# ══════════════════════════════════════════════════════════════════════════════

