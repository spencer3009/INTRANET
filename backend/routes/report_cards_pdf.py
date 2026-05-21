"""
Report Cards PDF — upload, listing, download and switch settings.

Admins/owners can upload a single PDF per student/period to Google Drive.
The PDF lives under a "Libretas/<bimestre>" subfolder of the school's
Drive materials folder. Persistence:
  - `schools.report_card_source` ∈ {"generated","pdf_upload"} → switch
  - `student_report_cards_pdf` documents the uploaded files

NO existing files (libreta.py, snapshots, generated mode) are altered:
this module is additive.
"""
import io
import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from googleapiclient.http import MediaIoBaseUpload

from .core import db, get_current_user, resolve_user_from_token, now_iso, generate_id
from .exams import get_drive_service
from .admin_portal import _ensure_submissions_folder  # not used; kept as ref

logger = logging.getLogger(__name__)
router = APIRouter(tags=["report_cards_pdf"])

MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ADMIN_ROLES = {"owner", "director", "admin"}


# ───────────────────────── Helpers ─────────────────────────


async def _require_admin(current_user) -> dict:
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    role = user.get("role")
    is_owner = bool(user.get("is_owner"))
    if not (is_owner or role in ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar libretas PDF")
    return user


async def _resolve_school(school_id: str) -> dict:
    s = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    return s


async def _ensure_libretas_folder(service, materials_folder_id: str, period_name: str) -> str:
    """Find or create 'Libretas' subfolder, then a subfolder per bimester."""
    async def _find_or_create(name: str, parent: str) -> str:
        q = (
            f"name='{name}' and '{parent}' in parents and "
            f"mimeType='application/vnd.google-apps.folder' and trashed=false"
        )
        res = service.files().list(q=q, fields="files(id)").execute()
        items = res.get("files", [])
        if items:
            return items[0]["id"]
        meta = {
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent],
        }
        f = service.files().create(body=meta, fields="id").execute()
        return f.get("id")

    libretas_id = await _find_or_create("Libretas", materials_folder_id)
    safe_period = (period_name or "Bimestre").strip().replace("/", "_") or "Bimestre"
    bim_id = await _find_or_create(safe_period, libretas_id)
    return bim_id


async def _parent_is_linked_to_student(user: dict, student_id: str, school_id: str) -> bool:
    """Determine whether a `parent`-role user is linked to a given student.
    Mirrors the logic of /api/parent/me which considers both directions:
      1. Reverse: student doc has padre_id/parent_id == parent.id
      2. Forward: parent doc has student_id in children / children_ids / student_ids
    """
    # 1) Reverse lookup on the student doc
    found = await db.users.find_one(
        {
            "id": student_id,
            "role": "student",
            "school_id": school_id,
            "$or": [{"padre_id": user["id"]}, {"parent_id": user["id"]}],
        },
        {"_id": 0, "id": 1},
    )
    if found:
        return True
    # 2) Forward array on the parent doc
    linked_ids = (
        (user.get("children") or [])
        + (user.get("children_ids") or [])
        + (user.get("student_ids") or [])
    )
    return student_id in linked_ids


# ───────────────────────── Settings switch ─────────────────────────


class ReportCardSettingsUpdate(BaseModel):
    report_card_source: Optional[str] = None  # "generated" | "pdf_upload"
    libreta_grade_format: Optional[str] = None  # "numeric" | "letters" | "mixed"


@router.get("/api/report-cards/settings")
async def get_report_card_settings(current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio")
    school = await _resolve_school(school_id)
    return {
        "school_id": school_id,
        "report_card_source": school.get("report_card_source") or "generated",
        "libreta_grade_format": school.get("libreta_grade_format") or "numeric",
        "google_drive_connected": bool(school.get("google_drive_connected")),
    }


@router.put("/api/report-cards/settings")
async def update_report_card_settings(
    body: ReportCardSettingsUpdate,
    current_user=Depends(get_current_user),
):
    user = await _require_admin(current_user)
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio")
    update_fields: dict = {}
    if body.report_card_source is not None:
        src = body.report_card_source.strip().lower()
        if src not in ("generated", "pdf_upload"):
            raise HTTPException(status_code=400, detail="report_card_source debe ser 'generated' o 'pdf_upload'")
        update_fields["report_card_source"] = src
    if body.libreta_grade_format is not None:
        fmt = body.libreta_grade_format.strip().lower()
        if fmt not in ("numeric", "letters", "mixed"):
            raise HTTPException(status_code=400, detail="libreta_grade_format debe ser 'numeric', 'letters' o 'mixed'")
        update_fields["libreta_grade_format"] = fmt
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nada para actualizar")
    await db.schools.update_one({"id": school_id}, {"$set": update_fields})
    school = await _resolve_school(school_id)
    return {
        "ok": True,
        "report_card_source": school.get("report_card_source") or "generated",
        "libreta_grade_format": school.get("libreta_grade_format") or "numeric",
    }


# ───────────────────────── Listing per section ─────────────────────────


@router.get("/api/report-cards/by-section")
async def list_report_cards_by_section(
    section_id: str = Query(...),
    period_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    """For the modal: list students in the section + which already have a
    PDF uploaded for that bimester."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio")

    school = await _resolve_school(school_id)
    drive_connected = bool(school.get("google_drive_connected"))

    section = await db.sections.find_one(
        {"id": section_id, "school_id": school_id}, {"_id": 0}
    )
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    period = await db.academic_periods.find_one(
        {"id": period_id, "school_id": school_id}, {"_id": 0}
    )
    if not period:
        raise HTTPException(status_code=404, detail="Bimestre no encontrado")

    students = await db.users.find(
        {"school_id": school_id, "role": "student", "seccion_id": section_id, "is_active": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "second_last_name": 1, "photo_url": 1, "student_code": 1, "codigo": 1},
    ).to_list(1000)
    students.sort(key=lambda s: ((s.get("last_name") or "") + " " + (s.get("second_last_name") or "") + " " + (s.get("name") or "")).lower())

    uploads = await db.student_report_cards_pdf.find(
        {"school_id": school_id, "section_id": section_id, "period_id": period_id},
        {"_id": 0},
    ).to_list(2000)
    by_student = {u["student_id"]: u for u in uploads}

    rows = []
    for s in students:
        u = by_student.get(s["id"])
        rows.append({
            "student_id": s["id"],
            "student_name": f"{s.get('last_name','')} {s.get('second_last_name','')} {s.get('name','')}".strip(),
            "code": s.get("student_code") or s.get("codigo"),
            "photo_url": s.get("photo_url"),
            "uploaded": bool(u),
            "report_card_id": u["id"] if u else None,
            "file_name": u.get("file_name") if u else None,
            "file_size": u.get("file_size") if u else None,
            "uploaded_at": u.get("uploaded_at") if u else None,
            "storage_type": u.get("storage_type") if u else None,
        })

    return {
        "section": {"id": section["id"], "name": section.get("name"), "grade_name": section.get("grade_name"), "level": section.get("level")},
        "period": {"id": period["id"], "name": period.get("name") or period.get("nombre")},
        "drive_connected": drive_connected,
        "students": rows,
    }


# ───────────────────────── Upload PDF ─────────────────────────


@router.post("/api/report-cards/upload")
async def upload_report_card_pdf(
    student_id: str = Form(...),
    period_id: str = Form(...),
    section_id: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    user = await _require_admin(current_user)
    school_id = user.get("school_id")

    # Validate ownership (students live in `users` with role='student')
    student = await db.users.find_one(
        {"id": student_id, "school_id": school_id, "role": "student"},
        {"_id": 0, "id": 1, "seccion_id": 1, "name": 1, "last_name": 1},
    )
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    if student.get("seccion_id") != section_id:
        raise HTTPException(status_code=400, detail="El alumno no pertenece a esta sección")

    period = await db.academic_periods.find_one(
        {"id": period_id, "school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "nombre": 1}
    )
    if not period:
        raise HTTPException(status_code=404, detail="Bimestre no encontrado")
    period_name = period.get("name") or period.get("nombre") or "Bimestre"

    # Validate file
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
    content = await file.read()
    if len(content) > MAX_PDF_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera el límite de 10 MB")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    # Drive connectivity
    school = await _resolve_school(school_id)
    if not school.get("google_drive_connected"):
        raise HTTPException(
            status_code=409,
            detail="Google Drive no está conectado. Ve a Ajustes para conectarlo.",
        )
    materials_folder_id = school.get("google_drive_materials_folder_id")
    if not materials_folder_id:
        raise HTTPException(
            status_code=409,
            detail="Google Drive no tiene carpeta de materiales configurada.",
        )

    # Upload to Drive
    try:
        service = await get_drive_service(school_id)
        bim_folder_id = await _ensure_libretas_folder(service, materials_folder_id, period_name)
        safe_student_label = f"{student.get('last_name','')}_{student.get('name','')}".strip().replace(" ", "_") or student_id
        file_metadata = {
            "name": f"{safe_student_label}_{period_name}.pdf",
            "parents": [bim_folder_id],
        }
        media = MediaIoBaseUpload(io.BytesIO(content), mimetype="application/pdf", resumable=True)
        drive_file = service.files().create(body=file_metadata, media_body=media, fields="id, name").execute()
        drive_file_id = drive_file.get("id")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to upload report card PDF to Drive")
        raise HTTPException(status_code=500, detail=f"Error subiendo a Google Drive: {e}")

    # Replace existing (uploaded_at policy: replace same student+period; old
    # Drive file is left orphaned in Drive — user can clean up there. We do
    # NOT delete cross-period: each bimester keeps its own row).
    existing = await db.student_report_cards_pdf.find_one(
        {"school_id": school_id, "student_id": student_id, "period_id": period_id},
        {"_id": 0},
    )
    new_id = existing["id"] if existing else generate_id()
    doc = {
        "id": new_id,
        "school_id": school_id,
        "student_id": student_id,
        "section_id": section_id,
        "period_id": period_id,
        "period_name": period_name,
        "file_name": file.filename,
        "file_size": len(content),
        "storage_type": "google_drive",
        "drive_file_id": drive_file_id,
        "uploaded_by": user["id"],
        "uploaded_at": now_iso(),
    }
    if existing:
        await db.student_report_cards_pdf.update_one({"id": new_id}, {"$set": doc})
    else:
        await db.student_report_cards_pdf.insert_one(doc)

    return {"ok": True, "report_card_id": new_id, "drive_file_id": drive_file_id}


# ───────────────────────── Download / Student access ─────────────────────────


async def _stream_drive_pdf(school_id: str, drive_file_id: str, file_name: str):
    """Buffered download of a PDF from Drive (consistent with submissions)."""
    service = await get_drive_service(school_id)
    request = service.files().get_media(fileId=drive_file_id)
    buf = io.BytesIO()
    from googleapiclient.http import MediaIoBaseDownload
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _status, done = downloader.next_chunk()
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@router.get("/api/report-cards/download/{report_card_id}")
async def download_report_card(report_card_id: str, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    school_id = user.get("school_id")
    role = user.get("role")
    is_owner = bool(user.get("is_owner"))

    rc = await db.student_report_cards_pdf.find_one(
        {"id": report_card_id, "school_id": school_id}, {"_id": 0}
    )
    if not rc:
        raise HTTPException(status_code=404, detail="Libreta no encontrada")

    # Authorization: admin/owner; the student themself; a parent linked
    # to the student (either via student.padre_id/parent_id reverse lookup
    # or via parent.children/children_ids/student_ids forward array).
    allowed = is_owner or role in ADMIN_ROLES
    if not allowed:
        if role == "student" and user.get("id") == rc["student_id"]:
            allowed = True
        elif role == "parent":
            allowed = await _parent_is_linked_to_student(user, rc["student_id"], school_id)
    if not allowed:
        raise HTTPException(status_code=403, detail="No autorizado para descargar esta libreta")

    if rc.get("storage_type") != "google_drive" or not rc.get("drive_file_id"):
        raise HTTPException(status_code=409, detail="Libreta sin archivo en Drive")
    return await _stream_drive_pdf(school_id, rc["drive_file_id"], rc.get("file_name") or "libreta.pdf")


@router.get("/api/report-cards/student/{student_id}")
async def get_student_report_cards(
    student_id: str,
    period_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    """Used by parent/student portals to list the PDFs available for the
    student (optionally filtered by bimester)."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    school_id = user.get("school_id")
    role = user.get("role")
    is_owner = bool(user.get("is_owner"))

    # AuthZ
    allowed = is_owner or role in ADMIN_ROLES
    if not allowed:
        if role == "student" and user.get("id") == student_id:
            allowed = True
        elif role == "parent":
            allowed = await _parent_is_linked_to_student(user, student_id, school_id)
        elif role == "teacher":
            # Teachers don't need to see PDFs directly; deny.
            allowed = False
    if not allowed:
        raise HTTPException(status_code=403, detail="No autorizado")

    q = {"school_id": school_id, "student_id": student_id}
    if period_id:
        q["period_id"] = period_id
    docs = await db.student_report_cards_pdf.find(q, {"_id": 0}).to_list(50)
    return {"items": docs}


# ───────────────────────── Delete ─────────────────────────


@router.delete("/api/report-cards/{report_card_id}")
async def delete_report_card(report_card_id: str, current_user=Depends(get_current_user)):
    user = await _require_admin(current_user)
    school_id = user.get("school_id")

    rc = await db.student_report_cards_pdf.find_one(
        {"id": report_card_id, "school_id": school_id}, {"_id": 0}
    )
    if not rc:
        raise HTTPException(status_code=404, detail="Libreta no encontrada")

    # Best-effort delete on Drive (don't block if Drive fails).
    if rc.get("storage_type") == "google_drive" and rc.get("drive_file_id"):
        try:
            service = await get_drive_service(school_id)
            service.files().delete(fileId=rc["drive_file_id"]).execute()
        except Exception as e:
            logger.warning(f"Drive delete failed for libreta {report_card_id}: {e}")

    await db.student_report_cards_pdf.delete_one({"id": report_card_id, "school_id": school_id})
    return {"ok": True}
