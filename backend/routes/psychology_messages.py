"""
Psychology Messages Module - Backend Routes
Messaging between psychologists and parents, plus message templates
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query

from .core import db, require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")


# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class SendMessage(BaseModel):
    student_id: str
    to_user_id: str
    subject: Optional[str] = ""
    body: str
    requires_response: Optional[bool] = False
    is_urgent: Optional[bool] = False
    attachments: Optional[List[dict]] = []
    template_used: Optional[str] = None

class ParentReply(BaseModel):
    conversation_id: str
    body: str
    attachments: Optional[List[dict]] = []

class TemplateCreate(BaseModel):
    name: str
    subject: Optional[str] = ""
    body: str
    category: Optional[str] = "general"
    is_shared: Optional[bool] = False

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    is_shared: Optional[bool] = None


def make_conversation_id(psych_id: str, parent_id: str, student_id: str) -> str:
    parts = sorted([psych_id, parent_id])
    return f"{parts[0]}_{parts[1]}_{student_id}"


# ══════════════════════════════════════════════════════════════════════════════
# PSYCHOLOGIST MESSAGE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/psychology/messages/unread-count")
async def get_unread_count(user=Depends(require_role(["psicologo"]))):
    count = await db.psychological_messages.count_documents({
        "to_user_id": user["id"],
        "read": False
    })
    return {"unread_count": count}


@router.get("/psychology/messages/conversations")
async def list_conversations(
    search: Optional[str] = None,
    user=Depends(require_role(["psicologo"]))
):
    school_id = user["school_id"]
    psych_id = user["id"]

    pipeline = [
        {"$match": {
            "institution_id": school_id,
            "$or": [{"from_user_id": psych_id}, {"to_user_id": psych_id}]
        }},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$conversation_id",
            "last_message": {"$first": "$$ROOT"},
            "unread_count": {"$sum": {
                "$cond": [{"$and": [
                    {"$eq": ["$to_user_id", psych_id]},
                    {"$eq": ["$read", False]}
                ]}, 1, 0]
            }},
            "has_requires_response": {"$max": {
                "$cond": [{"$and": [
                    {"$eq": ["$to_user_id", psych_id]},
                    {"$eq": ["$requires_response", True]},
                    {"$eq": ["$read", False]}
                ]}, True, False]
            }},
            "total_messages": {"$sum": 1}
        }},
        {"$sort": {"unread_count": -1, "last_message.created_at": -1}}
    ]

    convos_raw = await db.psychological_messages.aggregate(pipeline).to_list(200)

    parent_ids = set()
    student_ids = set()
    for c in convos_raw:
        lm = c["last_message"]
        pid = lm["to_user_id"] if lm["from_user_id"] == psych_id else lm["from_user_id"]
        parent_ids.add(pid)
        student_ids.add(lm.get("student_id", ""))

    parents_map = {}
    if parent_ids:
        parents = await db.users.find(
            {"id": {"$in": list(parent_ids)}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}
        ).to_list(200)
        parents_map = {p["id"]: p for p in parents}

    students_map = {}
    if student_ids:
        students = await db.users.find(
            {"id": {"$in": list(student_ids)}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "grade": 1, "section": 1, "photo_url": 1}
        ).to_list(200)
        students_map = {s["id"]: s for s in students}

    conversations = []
    for c in convos_raw:
        lm = c["last_message"]
        pid = lm["to_user_id"] if lm["from_user_id"] == psych_id else lm["from_user_id"]
        sid = lm.get("student_id", "")
        parent = parents_map.get(pid, {})
        student = students_map.get(sid, {})

        parent_name = f"{parent.get('name', '')} {parent.get('last_name', '')}".strip()
        student_name = f"{student.get('name', '')} {student.get('last_name', '')}".strip()

        if search:
            q = search.lower()
            if q not in parent_name.lower() and q not in student_name.lower():
                continue

        conversations.append({
            "conversation_id": c["_id"],
            "parent_id": pid,
            "parent_name": parent_name,
            "parent_photo": parent.get("photo_url", ""),
            "student_id": sid,
            "student_name": student_name,
            "student_grade": student.get("grade", ""),
            "student_section": student.get("section", ""),
            "last_message_preview": (lm.get("body", ""))[:100],
            "last_message_date": lm.get("created_at", ""),
            "last_message_from": lm.get("from_role", ""),
            "unread_count": c["unread_count"],
            "has_requires_response": c.get("has_requires_response", False),
            "total_messages": c["total_messages"]
        })

    return {"conversations": conversations}


@router.get("/psychology/messages/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(require_role(["psicologo"]))
):
    psych_id = user["id"]
    skip = (page - 1) * limit

    await db.psychological_messages.update_many(
        {"conversation_id": conversation_id, "to_user_id": psych_id, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )

    total = await db.psychological_messages.count_documents({"conversation_id": conversation_id})
    messages = await db.psychological_messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)

    return {"messages": messages, "total": total, "page": page}


@router.post("/psychology/messages")
async def send_message(data: SendMessage, user=Depends(require_role(["psicologo"]))):
    school_id = user["school_id"]
    psych_id = user["id"]

    parent = await db.users.find_one(
        {"id": data.to_user_id, "school_id": school_id, "role": "parent"},
        {"_id": 0, "id": 1, "linked_students": 1}
    )
    if not parent:
        raise HTTPException(status_code=404, detail="Padre/apoderado no encontrado")

    if data.student_id not in (parent.get("linked_students") or []):
        raise HTTPException(status_code=400, detail="El padre no esta vinculado a este estudiante")

    student = await db.users.find_one(
        {"id": data.student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "id": 1}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    conv_id = make_conversation_id(psych_id, data.to_user_id, data.student_id)
    now = datetime.now(timezone.utc).isoformat()

    message = {
        "id": str(uuid.uuid4()),
        "institution_id": school_id,
        "student_id": data.student_id,
        "conversation_id": conv_id,
        "from_user_id": psych_id,
        "from_role": "psicologo",
        "to_user_id": data.to_user_id,
        "to_role": "padre",
        "subject": data.subject or "",
        "body": data.body,
        "read": False,
        "read_at": None,
        "requires_response": data.requires_response or False,
        "is_urgent": data.is_urgent or False,
        "attachments": data.attachments or [],
        "template_used": data.template_used,
        "created_at": now,
        "updated_at": now
    }
    await db.psychological_messages.insert_one(message)
    message.pop("_id", None)
    return {"message": "Mensaje enviado", "data": message}


@router.put("/psychology/messages/{message_id}/read")
async def mark_read(message_id: str, user=Depends(require_role(["psicologo"]))):
    result = await db.psychological_messages.update_one(
        {"id": message_id, "to_user_id": user["id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    return {"message": "Marcado como leido"}


# ══════════════════════════════════════════════════════════════════════════════
# PARENT MESSAGE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/parents/psychology-messages")
async def parent_list_conversations(
    search: Optional[str] = None,
    user=Depends(require_role(["parent"]))
):
    parent_id = user["id"]
    school_id = user["school_id"]

    pipeline = [
        {"$match": {
            "institution_id": school_id,
            "$or": [{"from_user_id": parent_id}, {"to_user_id": parent_id}]
        }},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$conversation_id",
            "last_message": {"$first": "$$ROOT"},
            "unread_count": {"$sum": {
                "$cond": [{"$and": [
                    {"$eq": ["$to_user_id", parent_id]},
                    {"$eq": ["$read", False]}
                ]}, 1, 0]
            }},
            "total_messages": {"$sum": 1}
        }},
        {"$sort": {"unread_count": -1, "last_message.created_at": -1}}
    ]

    convos_raw = await db.psychological_messages.aggregate(pipeline).to_list(100)

    psych_ids = set()
    student_ids = set()
    for c in convos_raw:
        lm = c["last_message"]
        pid = lm["to_user_id"] if lm["from_user_id"] == parent_id else lm["from_user_id"]
        psych_ids.add(pid)
        student_ids.add(lm.get("student_id", ""))

    psychs_map = {}
    if psych_ids:
        psychs = await db.users.find(
            {"id": {"$in": list(psych_ids)}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "psychologist_profile": 1}
        ).to_list(50)
        psychs_map = {p["id"]: p for p in psychs}

    students_map = {}
    if student_ids:
        students = await db.users.find(
            {"id": {"$in": list(student_ids)}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "grade": 1, "section": 1}
        ).to_list(100)
        students_map = {s["id"]: s for s in students}

    conversations = []
    for c in convos_raw:
        lm = c["last_message"]
        pid = lm["to_user_id"] if lm["from_user_id"] == parent_id else lm["from_user_id"]
        sid = lm.get("student_id", "")
        psych = psychs_map.get(pid, {})
        student = students_map.get(sid, {})

        conversations.append({
            "conversation_id": c["_id"],
            "psychologist_id": pid,
            "psychologist_name": f"{psych.get('name', '')} {psych.get('last_name', '')}".strip(),
            "psychologist_photo": psych.get("photo_url", ""),
            "psychologist_specialty": psych.get("psychologist_profile", {}).get("specialty", ""),
            "student_id": sid,
            "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
            "student_grade": student.get("grade", ""),
            "last_message_preview": (lm.get("body", ""))[:100],
            "last_message_date": lm.get("created_at", ""),
            "last_message_from": lm.get("from_role", ""),
            "unread_count": c["unread_count"],
            "total_messages": c["total_messages"]
        })

    return {"conversations": conversations}


@router.get("/parents/psychology-messages/{conversation_id}")
async def parent_get_conversation(
    conversation_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(require_role(["parent"]))
):
    parent_id = user["id"]

    first_msg = await db.psychological_messages.find_one(
        {"conversation_id": conversation_id},
        {"_id": 0, "from_user_id": 1, "to_user_id": 1}
    )
    if not first_msg:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    if parent_id not in [first_msg.get("from_user_id"), first_msg.get("to_user_id")]:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta conversacion")

    await db.psychological_messages.update_many(
        {"conversation_id": conversation_id, "to_user_id": parent_id, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )

    skip = (page - 1) * limit
    total = await db.psychological_messages.count_documents({"conversation_id": conversation_id})
    messages = await db.psychological_messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)

    return {"messages": messages, "total": total, "page": page}


@router.post("/parents/psychology-messages")
async def parent_reply(data: ParentReply, user=Depends(require_role(["parent"]))):
    parent_id = user["id"]
    school_id = user["school_id"]

    last_msg = await db.psychological_messages.find_one(
        {"conversation_id": data.conversation_id},
        {"_id": 0}
    )
    if not last_msg:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    if parent_id not in [last_msg.get("from_user_id"), last_msg.get("to_user_id")]:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta conversacion")

    psych_id = last_msg["to_user_id"] if last_msg["from_user_id"] == parent_id else last_msg["from_user_id"]
    now = datetime.now(timezone.utc).isoformat()

    message = {
        "id": str(uuid.uuid4()),
        "institution_id": school_id,
        "student_id": last_msg.get("student_id", ""),
        "conversation_id": data.conversation_id,
        "from_user_id": parent_id,
        "from_role": "padre",
        "to_user_id": psych_id,
        "to_role": "psicologo",
        "subject": "",
        "body": data.body,
        "read": False,
        "read_at": None,
        "requires_response": False,
        "is_urgent": False,
        "attachments": data.attachments or [],
        "template_used": None,
        "created_at": now,
        "updated_at": now
    }
    await db.psychological_messages.insert_one(message)
    message.pop("_id", None)
    return {"message": "Respuesta enviada", "data": message}


@router.get("/parents/psychology-messages/unread-count")
async def parent_unread_count(user=Depends(require_role(["parent"]))):
    count = await db.psychological_messages.count_documents({
        "to_user_id": user["id"],
        "read": False
    })
    return {"unread_count": count}


# ══════════════════════════════════════════════════════════════════════════════
# MESSAGE TEMPLATES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/psychology/templates")
async def list_templates(
    category: Optional[str] = None,
    user=Depends(require_role(["psicologo"]))
):
    school_id = user["school_id"]
    query = {"$or": [
        {"psychologist_id": user["id"]},
        {"institution_id": school_id, "is_shared": True}
    ]}
    if category:
        query["category"] = category

    templates = await db.message_templates.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    return {"templates": templates}


@router.post("/psychology/templates")
async def create_template(data: TemplateCreate, user=Depends(require_role(["psicologo"]))):
    now = datetime.now(timezone.utc).isoformat()
    template = {
        "id": str(uuid.uuid4()),
        "institution_id": user["school_id"],
        "psychologist_id": user["id"],
        "name": data.name,
        "subject": data.subject or "",
        "body": data.body,
        "category": data.category or "general",
        "is_shared": data.is_shared or False,
        "created_at": now,
        "updated_at": now
    }
    await db.message_templates.insert_one(template)
    template.pop("_id", None)
    return {"message": "Plantilla creada", "template": template}


@router.put("/psychology/templates/{template_id}")
async def update_template(template_id: str, data: TemplateUpdate, user=Depends(require_role(["psicologo"]))):
    tpl = await db.message_templates.find_one({"id": template_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    if tpl.get("psychologist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Solo el creador puede editar")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.message_templates.update_one({"id": template_id}, {"$set": update_data})
    return {"message": "Plantilla actualizada"}


@router.delete("/psychology/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(require_role(["psicologo"]))):
    tpl = await db.message_templates.find_one({"id": template_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    if tpl.get("psychologist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Solo el creador puede eliminar")
    await db.message_templates.delete_one({"id": template_id})
    return {"message": "Plantilla eliminada"}


# ══════════════════════════════════════════════════════════════════════════════
# HELPER: Get parents of a student (for psychologist's "New Message" modal)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/psychology/students/{student_id}/parents")
async def get_student_parents(student_id: str, user=Depends(require_role(["psicologo"]))):
    school_id = user["school_id"]
    student = await db.users.find_one(
        {"id": student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    parents = await db.users.find(
        {"school_id": school_id, "role": "parent", "linked_students": student_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "email": 1, "phone": 1, "photo_url": 1}
    ).to_list(10)

    return {"student": student, "parents": parents}
