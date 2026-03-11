"""
Legacy messaging system
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

# MESSAGES / INTERNAL COMMUNICATIONS
# ══════════════════════════════════════════════════════════════════════════════

class MessageCreate(BaseModel):
    """Create a new message (chat or mail type)"""
    receiver_id: str
    type: Literal["chat", "mail"] = "chat"
    subject: Optional[str] = None
    message: str
    attachments: Optional[List[dict]] = None  # [{url, name, type, size}]

class MessageUpdate(BaseModel):
    """Update message (mark as read)"""
    read: bool

@router.get("/messages/users")
async def get_message_users(current_user = Depends(get_current_user)):
    """
    Get all users in the same school, grouped by role.
    Includes online/offline status and sorts online users first.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    timeout_threshold = now - timedelta(minutes=PRESENCE_TIMEOUT_MINUTES)
    
    # Get all users except current user
    users_cursor = db.users.find(
        {"school_id": school_id, "id": {"$ne": current_user["sub"]}},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    users = await users_cursor.to_list(length=1000)
    
    # Get presence data for all users
    presence_cursor = db.presence.find(
        {"school_id": school_id},
        {"_id": 0}
    )
    presence_records = await presence_cursor.to_list(length=1000)
    
    # Build presence map
    presence_map = {}
    for p in presence_records:
        last_seen = None
        if p.get("last_seen"):
            try:
                last_seen = datetime.fromisoformat(p["last_seen"].replace("Z", "+00:00"))
            except:
                pass
        is_online = last_seen and last_seen > timeout_threshold if last_seen else False
        presence_map[p["user_id"]] = {
            "is_online": is_online,
            "last_seen": p.get("last_seen")
        }
    
    # Group by role
    role_order = ["owner", "admin", "director", "teacher", "parent", "student"]
    role_labels = {
        "owner": "Directores",
        "admin": "Administradores", 
        "director": "Directores",
        "teacher": "Profesores",
        "parent": "Padres",
        "student": "Estudiantes"
    }
    
    grouped = {}
    for u in users:
        role = u.get("role", "other")
        label = role_labels.get(role, "Otros")
        if label not in grouped:
            grouped[label] = []
        
        # Get presence info
        presence = presence_map.get(u["id"], {"is_online": False, "last_seen": None})
        
        grouped[label].append({
            "id": u["id"],
            "name": u.get("name", ""),
            "last_name": u.get("last_name", ""),
            "full_name": f"{u.get('name', '')} {u.get('last_name', '')}".strip(),
            "email": u.get("email"),
            "role": role,
            "photo_url": u.get("photo_url"),
            "is_online": presence["is_online"],
            "last_seen": presence["last_seen"]
        })
    
    # Sort users within each group: online first, then by name
    for label in grouped:
        grouped[label].sort(key=lambda x: (not x["is_online"], x["full_name"].lower()))
    
    # Return in order
    result = []
    for role in role_order:
        label = role_labels.get(role)
        if label and label in grouped:
            result.append({
                "label": label,
                "users": grouped[label]
            })
            del grouped[label]
    
    # Add any remaining groups
    for label, users_list in grouped.items():
        result.append({"label": label, "users": users_list})
    
    return result

@router.get("/messages/chats")
async def get_chat_list(current_user = Depends(get_current_user)):
    """
    Get list of all chat conversations for current user.
    Returns unique conversations with last message preview and presence status.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    user_id = current_user["sub"]
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    timeout_threshold = now - timedelta(minutes=PRESENCE_TIMEOUT_MINUTES)
    
    # Get all chat messages involving current user
    messages = await db.messages.find({
        "school_id": school_id,
        "type": "chat",
        "$or": [
            {"sender_id": user_id},
            {"receiver_id": user_id}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(5000)
    
    # Group by conversation partner
    conversations = {}
    for msg in messages:
        partner_id = msg["receiver_id"] if msg["sender_id"] == user_id else msg["sender_id"]
        
        if partner_id not in conversations:
            conversations[partner_id] = {
                "partner_id": partner_id,
                "last_message": msg["message"][:100] + ("..." if len(msg["message"]) > 100 else ""),
                "last_message_time": msg["created_at"],
                "unread_count": 0,
                "is_sender": msg["sender_id"] == user_id
            }
        
        # Count unread messages sent TO current user
        if msg["receiver_id"] == user_id and not msg.get("read", False):
            conversations[partner_id]["unread_count"] += 1
    
    # Get partner user info
    partner_ids = list(conversations.keys())
    partners = await db.users.find(
        {"id": {"$in": partner_ids}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
    ).to_list(1000)
    
    partners_map = {p["id"]: p for p in partners}
    
    # Get presence data for partners
    presence_cursor = db.presence.find(
        {"user_id": {"$in": partner_ids}},
        {"_id": 0}
    )
    presence_records = await presence_cursor.to_list(length=1000)
    
    presence_map = {}
    for p in presence_records:
        last_seen = None
        if p.get("last_seen"):
            try:
                last_seen = datetime.fromisoformat(p["last_seen"].replace("Z", "+00:00"))
            except:
                pass
        is_online = last_seen and last_seen > timeout_threshold if last_seen else False
        presence_map[p["user_id"]] = {
            "is_online": is_online,
            "last_seen": p.get("last_seen")
        }
    
    # Build result
    result = []
    for partner_id, conv in conversations.items():
        partner = partners_map.get(partner_id, {})
        presence = presence_map.get(partner_id, {"is_online": False, "last_seen": None})
        result.append({
            "partner_id": partner_id,
            "partner_name": f"{partner.get('name', '')} {partner.get('last_name', '')}".strip(),
            "partner_photo": partner.get("photo_url"),
            "partner_role": partner.get("role"),
            "last_message": conv["last_message"],
            "last_message_time": conv["last_message_time"],
            "unread_count": conv["unread_count"],
            "is_sender": conv["is_sender"],
            "is_online": presence["is_online"],
            "last_seen": presence["last_seen"]
        })
    
    # Sort by last message time
    result.sort(key=lambda x: x["last_message_time"], reverse=True)
    
    return result

@router.get("/messages/chats/{partner_id}")
async def get_chat_history(partner_id: str, current_user = Depends(get_current_user)):
    """
    Get chat history with a specific user.
    Also marks messages as read. Includes partner's presence status.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    user_id = current_user["sub"]
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    timeout_threshold = now - timedelta(minutes=PRESENCE_TIMEOUT_MINUTES)
    
    # Verify partner exists and is in same school
    partner = await db.users.find_one(
        {"id": partner_id, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
    )
    if not partner:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Get partner's presence status
    presence_record = await db.presence.find_one(
        {"user_id": partner_id},
        {"_id": 0}
    )
    
    is_online = False
    last_seen = None
    if presence_record and presence_record.get("last_seen"):
        try:
            last_seen_dt = datetime.fromisoformat(presence_record["last_seen"].replace("Z", "+00:00"))
            is_online = last_seen_dt > timeout_threshold
            last_seen = presence_record["last_seen"]
        except:
            pass
    
    # Get all messages between users
    messages = await db.messages.find({
        "school_id": school_id,
        "type": "chat",
        "$or": [
            {"sender_id": user_id, "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": user_id}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    # Mark received messages as read
    await db.messages.update_many(
        {
            "school_id": school_id,
            "type": "chat",
            "sender_id": partner_id,
            "receiver_id": user_id,
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    return {
        "partner": {
            "id": partner["id"],
            "name": f"{partner.get('name', '')} {partner.get('last_name', '')}".strip(),
            "photo_url": partner.get("photo_url"),
            "role": partner.get("role"),
            "is_online": is_online,
            "last_seen": last_seen
        },
        "messages": messages
    }

@router.post("/messages/chats/send")
async def send_chat_message(data: MessageCreate, current_user = Depends(get_current_user)):
    """Send a chat message to another user"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Verify receiver exists and is in same school
    receiver = await db.users.find_one(
        {"id": data.receiver_id, "school_id": school_id},
        {"_id": 0, "id": 1}
    )
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")
    
    message = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "sender_id": current_user["sub"],
        "receiver_id": data.receiver_id,
        "type": "chat",
        "subject": None,
        "message": data.message,
        "attachments": data.attachments or [],
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    if "_id" in message:
        del message["_id"]
    
    return {"message": "Mensaje enviado", "data": message}

@router.get("/messages/inbox")
async def get_inbox(
    type: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get inbox messages (mail type) for current user.
    Can filter by type: 'received', 'sent', or all.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    user_id = current_user["sub"]
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id, "type": "mail"}
    
    if type == "received":
        query["receiver_id"] = user_id
    elif type == "sent":
        query["sender_id"] = user_id
    else:
        # All messages involving user
        query["$or"] = [
            {"sender_id": user_id},
            {"receiver_id": user_id}
        ]
    
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get user info for senders/receivers
    user_ids = set()
    for msg in messages:
        user_ids.add(msg["sender_id"])
        user_ids.add(msg["receiver_id"])
    
    users_data = await db.users.find(
        {"id": {"$in": list(user_ids)}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
    ).to_list(1000)
    
    users_map = {u["id"]: u for u in users_data}
    
    # Enrich messages with user info
    result = []
    for msg in messages:
        sender = users_map.get(msg["sender_id"], {})
        receiver = users_map.get(msg["receiver_id"], {})
        
        result.append({
            **msg,
            "sender_name": f"{sender.get('name', '')} {sender.get('last_name', '')}".strip(),
            "sender_photo": sender.get("photo_url"),
            "sender_role": sender.get("role"),
            "receiver_name": f"{receiver.get('name', '')} {receiver.get('last_name', '')}".strip(),
            "receiver_photo": receiver.get("photo_url"),
            "receiver_role": receiver.get("role"),
            "is_sent_by_me": msg["sender_id"] == user_id
        })
    
    return result

@router.post("/messages/send")
async def send_mail_message(data: MessageCreate, current_user = Depends(get_current_user)):
    """Send a mail-type message (formal internal communication)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Verify receiver exists and is in same school
    receiver = await db.users.find_one(
        {"id": data.receiver_id, "school_id": school_id},
        {"_id": 0, "id": 1}
    )
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")
    
    if not data.subject:
        raise HTTPException(status_code=400, detail="El asunto es requerido para mensajes tipo correo")
    
    message = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "sender_id": current_user["sub"],
        "receiver_id": data.receiver_id,
        "type": "mail",
        "subject": data.subject,
        "message": data.message,
        "attachments": data.attachments or [],
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    if "_id" in message:
        del message["_id"]
    
    logger.info(f"Mail sent from {current_user['sub']} to {data.receiver_id}: {data.subject}")
    
    return {"message": "Mensaje enviado correctamente", "data": message}

@router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str, current_user = Depends(get_current_user)):
    """Mark a message as read"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Find message and verify it's for current user
    message = await db.messages.find_one({
        "id": message_id,
        "school_id": user["school_id"],
        "receiver_id": current_user["sub"]
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"read": True}}
    )
    
    return {"message": "Mensaje marcado como leído"}

@router.get("/messages/unread-count")
async def get_unread_count(current_user = Depends(get_current_user)):
    """Get total unread message count for current user"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    count = await db.messages.count_documents({
        "school_id": user["school_id"],
        "receiver_id": current_user["sub"],
        "read": False
    })
    
    return {"unread_count": count}

@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, current_user = Depends(get_current_user)):
    """Delete a message (only sender can delete)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Find message and verify ownership
    message = await db.messages.find_one({
        "id": message_id,
        "school_id": user["school_id"],
        "sender_id": current_user["sub"]
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado o no tienes permiso")
    
    await db.messages.delete_one({"id": message_id})
    
    return {"message": "Mensaje eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════

