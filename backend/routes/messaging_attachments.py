# -*- coding: utf-8 -*-
"""
Attachments for institutional messages — Google Drive backed.

Adds:
  - POST /api/messaging/attachments/upload — admin uploads a file; if the
    school has Google Drive connected, the file goes to a "Comunicados"
    subfolder. Returns metadata that the frontend later includes in the
    create-message payload (institutional_messages.attachments).
  - GET  /api/messaging/attachments/{message_id}/{file_id} — streams the
    file from Drive to whoever can see the message. Permission re-uses the
    existing visibility logic (anyone who can read the message can read its
    attachments).
"""
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timezone
import io
import uuid
import logging

from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

from .core import db, get_current_user, resolve_user_from_token, ADMIN_ROLES
from .exams import get_drive_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["messaging-attachments"])

MAX_ATTACHMENT_SIZE_BYTES = 200 * 1024 * 1024  # 200 MB per file (videos)
ALLOWED_MIME_PREFIXES = (
    "application/pdf",
    "application/vnd.openxmlformats-officedocument",  # docx/xlsx/pptx
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "image/",
    "video/",
    "audio/",
    "text/",
    "application/zip",
)


async def _resolve_school(school_id: str) -> dict:
    return await db.schools.find_one({"id": school_id}, {"_id": 0}) or {}


async def _ensure_comunicados_folder(service, materials_folder_id: str) -> str:
    """Ensure (and cache) a 'Comunicados' subfolder inside the school's
    materials folder. Returns the folder id."""
    query = (
        f"'{materials_folder_id}' in parents and name='Comunicados' "
        f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )
    res = service.files().list(q=query, fields="files(id, name)").execute()
    existing = res.get("files") or []
    if existing:
        return existing[0]["id"]
    folder = service.files().create(
        body={
            "name": "Comunicados",
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [materials_folder_id],
        },
        fields="id",
    ).execute()
    return folder["id"]


def _is_admin(user: dict) -> bool:
    return bool(user.get("is_owner")) or user.get("role") in ADMIN_ROLES


@router.post("/messaging/attachments/upload")
async def upload_message_attachment(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Upload one attachment to Google Drive and return a stable reference
    that the frontend later includes when creating the institutional
    message."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no autenticado")
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden adjuntar archivos a comunicados")

    school_id = user["school_id"]
    school = await _resolve_school(school_id)

    # Validate payload BEFORE the Drive gate so size/type errors surface as
    # 400 even when Drive isn't connected yet (helps onboarding clients).
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(content) > MAX_ATTACHMENT_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera el límite de 200 MB")

    mime_type = file.content_type or "application/octet-stream"
    if not any(mime_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no permitido: {mime_type}")

    # Drive connectivity gate
    if not school.get("google_drive_connected"):
        raise HTTPException(
            status_code=409,
            detail="Google Drive no está conectado. Ve a Ajustes → Google Drive y conéctalo para poder adjuntar archivos.",
        )
    materials_folder_id = school.get("google_drive_materials_folder_id")
    if not materials_folder_id:
        raise HTTPException(
            status_code=409,
            detail="Google Drive no tiene una carpeta de materiales configurada. Reconecta Drive desde Ajustes.",
        )

    # Upload to Drive
    try:
        service = await get_drive_service(school_id)
        comunicados_folder_id = await _ensure_comunicados_folder(service, materials_folder_id)
        # Prefix filename with timestamp to avoid collisions when same file
        # is uploaded again later.
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_name = (file.filename or "adjunto").replace("/", "_")
        drive_name = f"{ts}_{safe_name}"
        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type, resumable=True)
        drive_file = service.files().create(
            body={"name": drive_name, "parents": [comunicados_folder_id]},
            media_body=media,
            fields="id, name",
        ).execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to upload announcement attachment to Drive")
        raise HTTPException(status_code=500, detail=f"Error subiendo a Google Drive: {e}")

    file_id = uuid.uuid4().hex
    # Persist a side record so we can stream the file later regardless of
    # whether the message ends up being created (orphans are fine — they
    # remain in Drive's "Comunicados" folder and can be cleaned up there).
    record = {
        "id": file_id,
        "school_id": school_id,
        "name": file.filename or drive_name,
        "drive_name": drive_name,
        "mime_type": mime_type,
        "size": len(content),
        "drive_file_id": drive_file["id"],
        "storage_type": "google_drive",
        "uploaded_by": user["id"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.message_attachments.insert_one(record)

    return {
        "file_id": file_id,
        "name": record["name"],
        "mime_type": mime_type,
        "size": len(content),
        "drive_file_id": drive_file["id"],
        "storage_type": "google_drive",
    }


@router.get("/messaging/attachments/{message_id}/{file_id}")
async def download_message_attachment(
    message_id: str,
    file_id: str,
    current_user=Depends(get_current_user),
):
    """Stream a message attachment from Drive. Anyone who can see the
    message can see its attachments; we keep the check simple: the user
    must belong to the same school as the message."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no autenticado")

    msg = await db.broadcast_messages.find_one(
        {"id": message_id},
        {"_id": 0, "school_id": 1, "attachments": 1},
    )
    if not msg:
        # Fallback to legacy institutional_messages collection.
        msg = await db.institutional_messages.find_one(
            {"id": message_id},
            {"_id": 0, "school_id": 1, "attachments": 1},
        )
    if not msg:
        raise HTTPException(status_code=404, detail="Comunicado no encontrado")
    if msg.get("school_id") != user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes acceso a este comunicado")

    # Locate the attachment within the message
    att = next((a for a in (msg.get("attachments") or []) if a.get("file_id") == file_id), None)
    if not att:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado en el comunicado")

    drive_file_id = att.get("drive_file_id")
    if not drive_file_id:
        raise HTTPException(status_code=409, detail="Adjunto sin archivo en Drive")

    try:
        service = await get_drive_service(user["school_id"])
        req = service.files().get_media(fileId=drive_file_id)
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, req)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        buf.seek(0)
    except Exception as e:
        logger.exception("Failed to fetch attachment from Drive")
        raise HTTPException(status_code=500, detail=f"Error descargando desde Drive: {e}")

    headers = {
        "Content-Disposition": f'inline; filename="{att.get("name", "adjunto")}"',
    }
    return StreamingResponse(buf, media_type=att.get("mime_type") or "application/octet-stream", headers=headers)


@router.get("/messaging/drive-status")
async def get_drive_status_for_messaging(current_user=Depends(get_current_user)):
    """Lightweight ping so the frontend can show a 'Drive not connected'
    banner before the user even tries to attach."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no autenticado")
    school = await _resolve_school(user["school_id"])
    return {
        "connected": bool(school.get("google_drive_connected")),
        "materials_folder_configured": bool(school.get("google_drive_materials_folder_id")),
    }
