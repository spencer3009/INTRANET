"""
Push Notifications routes - Parent portal notifications
Handles FCM token registration, notification storage, and push delivery
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from .core import db, get_current_user, ws_manager
from utils.firebase_admin_sdk import send_push_notification
from services.fcm_service import send_fcm_to_devices

router = APIRouter()
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE PUSH — destinatarios y envío (sistema FCM nuevo, device_tokens)
# ══════════════════════════════════════════════════════════════════════════════

async def get_attendance_push_targets(user_id: str) -> list:
    """
    Devuelve la lista de device_tokens (docs con fcm_token) a notificar por una
    marca de asistencia. SIEMPRE incluye al propio user_id. Si el usuario es
    ALUMNO, añade además sus apoderados vinculados (children_ids / linked_students
    + el padre_id del alumno). Dedupe por fcm_token, solo tokens activos.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "role": 1, "school_id": 1, "padre_id": 1})
    if not user:
        return []

    recipient_ids = {user_id}

    if user.get("role") == "student":
        if user.get("padre_id"):
            recipient_ids.add(user["padre_id"])
        parents = await db.users.find(
            {"role": "parent", "$or": [{"children_ids": user_id}, {"linked_students": user_id}]},
            {"_id": 0, "id": 1},
        ).to_list(None)
        for p in parents:
            recipient_ids.add(p["id"])

    devices = await db.device_tokens.find(
        {"user_id": {"$in": list(recipient_ids)}, "active": {"$ne": False}},
        {"_id": 0, "fcm_token": 1, "user_id": 1},
    ).to_list(None)

    seen = set()
    out = []
    for d in devices:
        tok = d.get("fcm_token")
        if tok and tok not in seen:
            seen.add(tok)
            out.append(d)
    return out


async def send_attendance_push(user_id: str, nombre: str, rol: str = None) -> tuple:
    """
    Envía la push de asistencia (data-only, con playSound) al usuario marcado
    (+ apoderados si es alumno). Reutiliza el sistema FCM nuevo (device_tokens).
    Un token inválido no aborta el resto (manejado por send_fcm_to_devices).
    """
    targets = await get_attendance_push_targets(user_id)
    if not targets:
        logger.info(f"[ATTENDANCE-PUSH] Sin tokens para user_id={user_id}")
        return (0, 0)

    title = "Asistencia registrada"
    body = f"Se registró la asistencia de {nombre}".strip()
    data = {
        "type": "attendance",
        "user_id": user_id,
        "title": title,
        "body": body,
        "silent": "false",
        "playSound": "true",
    }
    sent, failed = await send_fcm_to_devices(db, targets, title, body, data, data_only=True)
    logger.info(f"[ATTENDANCE-PUSH] user_id={user_id} rol={rol} -> sent={sent} failed={failed} targets={len(targets)}")
    return (sent, failed)


# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class RegisterTokenRequest(BaseModel):
    token: str

class MarkReadRequest(BaseModel):
    notification_id: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# FCM TOKEN MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/api/push/register-token")
async def register_fcm_token(req: RegisterTokenRequest, user=Depends(get_current_user)):
    """Register or update FCM push token for current user"""
    if not req.token.strip():
        raise HTTPException(status_code=400, detail="Token vacio")

    user_id = user.get("sub") or user.get("id") or user.get("user_id")
    now = datetime.now(timezone.utc).isoformat()

    # Upsert token: one token per user-device combo
    existing = await db.push_tokens.find_one({"token": req.token}, {"_id": 0})
    if existing:
        await db.push_tokens.update_one(
            {"token": req.token},
            {"$set": {"user_id": user_id, "updated_at": now}}
        )
    else:
        await db.push_tokens.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "token": req.token,
            "created_at": now,
            "updated_at": now,
        })

    logger.info(f"FCM token registered for user {user_id}")
    return {"status": "ok"}


@router.delete("/api/push/remove-token")
async def remove_fcm_token(req: RegisterTokenRequest, user=Depends(get_current_user)):
    """Remove FCM token (on logout or permission revoke)"""
    await db.push_tokens.delete_many({"token": req.token})
    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICATION QUERIES (Parent attendance notifications)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/api/push/attendance-notifications")
async def list_attendance_notifications(limit: int = 30, user=Depends(get_current_user)):
    """List attendance push notifications for current parent user"""
    user_id = user.get("sub") or user.get("id") or user.get("user_id")
    cursor = db.parent_notifications.find(
        {"parent_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    notifications = await cursor.to_list(length=limit)
    return notifications


@router.get("/api/push/unread-count")
async def push_unread_count(user=Depends(get_current_user)):
    """Get total unread push notification count for parent"""
    user_id = user.get("sub") or user.get("id") or user.get("user_id")
    count = await db.parent_notifications.count_documents({
        "parent_id": user_id,
        "read_at": None
    })
    return {"count": count}


@router.post("/api/push/mark-read")
async def push_mark_read(req: MarkReadRequest, user=Depends(get_current_user)):
    """Mark a single notification or all as read"""
    user_id = user.get("sub") or user.get("id") or user.get("user_id")
    now = datetime.now(timezone.utc).isoformat()

    if req.notification_id:
        await db.parent_notifications.update_one(
            {"id": req.notification_id, "parent_id": user_id},
            {"$set": {"read_at": now}}
        )
    else:
        # Mark all as read
        await db.parent_notifications.update_many(
            {"parent_id": user_id, "read_at": None},
            {"$set": {"read_at": now}}
        )

    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════════════════════
# SEND ATTENDANCE NOTIFICATION (called internally from attendance flow)
# ══════════════════════════════════════════════════════════════════════════════

async def send_attendance_notification(student_id: str, school_id: str, entry_time: str = None, event_type: str = "ingreso"):
    """
    Create notification and send push when student attendance is recorded.
    Called internally from attendance routes.
    
    event_type: "ingreso" | "salida" | "tardanza" | "inasistencia"
    entry_time: optional time string (e.g. "08:15") to include in the message
    """
    # Get student info
    student = await db.users.find_one(
        {"id": student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "parent_id": 1, "parent_email": 1}
    )
    if not student:
        logger.warning(f"[NOTIF] Student {student_id} not found in school {school_id}")
        return

    student_name = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
    if not student_name:
        student_name = "tu hijo(a)"

    # Find parent(s) - by parent_id or parent_email
    parent_filters = []
    if student.get("parent_id"):
        parent_filters.append({"id": student["parent_id"], "school_id": school_id})
    if student.get("parent_email"):
        parent_filters.append({"email": student["parent_email"], "school_id": school_id, "role": "parent"})

    parents = []
    for f in parent_filters:
        parent = await db.users.find_one(f, {"_id": 0, "id": 1, "name": 1})
        if parent and parent["id"] not in [p["id"] for p in parents]:
            parents.append(parent)

    # Also find parents linked by student lookup
    extra_parents = await db.users.find(
        {"school_id": school_id, "role": "parent", "linked_students": student_id},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(10)
    for p in extra_parents:
        if p["id"] not in [pp["id"] for pp in parents]:
            parents.append(p)

    if not parents:
        logger.info(f"[NOTIF] No parents found for student {student_id}; enviando push solo al alumno")
        try:
            await send_attendance_push(student_id, student_name, rol="student")
        except Exception as fcm_err:
            logger.error(f"[NOTIF] FCM attendance push error (sin padres): {fcm_err}")
        return

    # Build notification content
    time_suffix = ""
    if entry_time:
        try:
            parts = entry_time.split(":")
            h, m = int(parts[0]), int(parts[1])
            period = "a. m." if h < 12 else "p. m."
            h12 = h if 1 <= h <= 12 else (h - 12 if h > 12 else 12)
            time_suffix = f" a las {h12}:{m:02d} {period}"
        except Exception:
            time_suffix = f" a las {entry_time}"
    event_messages = {
        "ingreso": f"Tu hijo(a) {student_name} ingresó al colegio{time_suffix}",
        "salida": f"Tu hijo(a) {student_name} salió del colegio{time_suffix}",
        "tardanza": f"Tu hijo(a) {student_name} llegó tarde al colegio{time_suffix}",
        "inasistencia": f"Tu hijo(a) {student_name} tiene inasistencia registrada",
    }
    title = "Asistencia registrada"
    body = event_messages.get(event_type, f"Asistencia de {student_name} registrada")

    now = datetime.now(timezone.utc).isoformat()

    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "name": 1})
    school_name = school.get("name", "") if school else ""

    for parent in parents:
        parent_id = parent["id"]

        # Check for duplicate (same student, same event type, same day)
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
        duplicate = await db.parent_notifications.find_one({
            "parent_id": parent_id,
            "student_id": student_id,
            "type": event_type,
            "created_at": {"$gte": today_start}
        }, {"_id": 0, "id": 1})
        if duplicate:
            logger.info(f"[NOTIF] Duplicate prevented: {parent_id}/{student_id}/{event_type}")
            continue

        # Create notification record
        notif_id = str(uuid.uuid4())
        notification = {
            "id": notif_id,
            "parent_id": parent_id,
            "student_id": student_id,
            "student_name": student_name,
            "school_id": school_id,
            "school_name": school_name,
            "type": event_type,
            "title": title,
            "body": body,
            "read_at": None,
            "created_at": now,
            "metadata": {
                "event_type": event_type,
                "student_id": student_id,
            }
        }
        await db.parent_notifications.insert_one(notification)
        logger.info(f"[NOTIF] Created notification {notif_id} for parent {parent_id}")

        # Push via WebSocket to connected parent (real-time in-app)
        try:
            await ws_manager.send_to_user(parent_id, {
                "type": "attendance_notification",
                "notification": {
                    "id": notif_id,
                    "title": title,
                    "body": body,
                    "event_type": event_type,
                    "student_id": student_id,
                    "student_name": student_name,
                    "school_name": school_name,
                    "created_at": now,
                }
            })
            logger.info(f"[NOTIF] WebSocket push sent to parent {parent_id}")
        except Exception as ws_err:
            logger.error(f"[NOTIF] WebSocket push error: {ws_err}")

        # Audit log (FCM se envía vía el sistema nuevo, fuera de este loop)
        await db.notification_audit.insert_one({
            "id": str(uuid.uuid4()),
            "parent_id": parent_id,
            "student_id": student_id,
            "event_type": event_type,
            "notification_id": notif_id,
            "school_id": school_id,
            "created_at": now,
        })

    # Envío FCM (sistema nuevo: device_tokens) — al ALUMNO + sus apoderados.
    # Reemplaza el antiguo loop sobre push_tokens. Un token inválido no aborta.
    try:
        await send_attendance_push(student_id, student_name, rol="student")
    except Exception as fcm_err:
        logger.error(f"[NOTIF] FCM attendance push error: {fcm_err}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST NOTIFICATION (Support panel — send push to all parents of a school)
# ══════════════════════════════════════════════════════════════════════════════

class TestNotificationRequest(BaseModel):
    school_id: str


@router.post("/api/notifications/test")
async def test_notification(req: TestNotificationRequest, current_user=Depends(get_current_user)):
    """Send a test push notification to all registered devices in a school."""
    user_id = current_user.get("sub") or current_user.get("id")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1, "is_support_session": 1})
    if not user or (user.get("role") != "system_admin_global" and not user.get("is_support_session")):
        raise HTTPException(status_code=403, detail="Solo soporte puede enviar notificaciones de prueba")

    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0, "name": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")

    school_name = school.get("name", "Colegio")

    # Get all push tokens for parents in this school
    parents = await db.users.find(
        {"school_id": req.school_id, "role": "parent"},
        {"_id": 0, "id": 1}
    ).to_list(500)
    parent_ids = [p["id"] for p in parents]

    if not parent_ids:
        raise HTTPException(status_code=404, detail="No hay apoderados registrados en este colegio")

    tokens_cursor = db.push_tokens.find(
        {"user_id": {"$in": parent_ids}},
        {"_id": 0, "token": 1, "user_id": 1}
    )
    tokens = await tokens_cursor.to_list(500)

    if not tokens:
        raise HTTPException(status_code=404, detail="No hay dispositivos con notificaciones activas en este colegio")

    title = f"{school_name} - Prueba"
    body = "Esta es una notificacion de prueba del sistema EduNet. Si la recibes, todo funciona correctamente."

    sent = 0
    failed = 0
    for t in tokens:
        success = send_push_notification(
            token=t["token"],
            title=title,
            body=body,
            data={"type": "test", "school_id": req.school_id}
        )
        if success:
            sent += 1
        else:
            failed += 1
            await db.push_tokens.delete_one({"token": t["token"]})

    logger.info(f"[TEST-NOTIF] School '{school_name}' ({req.school_id}): {sent} sent, {failed} failed, {len(tokens)} total tokens")

    return {
        "success": True,
        "school_name": school_name,
        "tokens_found": len(tokens),
        "sent": sent,
        "failed": failed,
    }


# ══════════════════════════════════════════════════════════════════════════════
# DEVICE TOKEN REGISTRATION (new device_tokens collection)
# ══════════════════════════════════════════════════════════════════════════════

class RegisterDeviceRequest(BaseModel):
    fcm_token: str
    platform: str = "web"
    user_agent: str = ""


@router.post("/api/notifications/register-device")
async def register_device_token(req: RegisterDeviceRequest, current_user=Depends(get_current_user)):
    """Register or update a device token in device_tokens collection."""
    if not req.fcm_token.strip():
        raise HTTPException(status_code=400, detail="fcm_token vacio")

    user_id = current_user.get("sub") or current_user.get("id") or current_user.get("user_id")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "school_id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    school_id = user.get("school_id", "")
    now = datetime.now(timezone.utc).isoformat()

    # If token already exists with a different user, reassign it
    existing = await db.device_tokens.find_one({"fcm_token": req.fcm_token}, {"_id": 0})
    if existing:
        await db.device_tokens.update_one(
            {"fcm_token": req.fcm_token},
            {"$set": {
                "user_id": user_id,
                "school_id": school_id,
                "platform": req.platform,
                "user_agent": req.user_agent,
                "last_seen_at": now,
                "active": True,
            }}
        )
    else:
        await db.device_tokens.insert_one({
            "user_id": user_id,
            "school_id": school_id,
            "fcm_token": req.fcm_token,
            "platform": req.platform,
            "user_agent": req.user_agent,
            "created_at": now,
            "last_seen_at": now,
            "active": True,
        })

    # Also keep push_tokens in sync for backward compat
    existing_push = await db.push_tokens.find_one({"token": req.fcm_token}, {"_id": 0})
    if existing_push:
        await db.push_tokens.update_one(
            {"token": req.fcm_token},
            {"$set": {"user_id": user_id, "updated_at": now}}
        )
    else:
        await db.push_tokens.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "token": req.fcm_token,
            "created_at": now,
            "updated_at": now,
        })

    logger.info(f"[DEVICE] Registered device token for user {user_id} (platform={req.platform})")
    return {"status": "ok"}
