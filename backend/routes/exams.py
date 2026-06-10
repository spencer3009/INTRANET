"""
Online exams, questions, attempts, Google Drive integration, exam schedules
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
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL,
    GOOGLE_DRIVE_SCOPES, GOOGLE_DRIVE_ALLOWED_EXTENSIONS, MIME_TYPE_MAP,
    encrypt_token, decrypt_token, fernet,
    GOOGLE_REDIRECT_URI,
    ACADEMIC_STUDENT_FILTER, ACADEMIC_STUDENT_FILTER_WITH_PENDING,
    PERU_TZ, to_peru_hhmm,
)

import jwt
import io
import time
import cloudinary
import cloudinary.uploader
from fastapi.responses import StreamingResponse, RedirectResponse, JSONResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

from services.register_sync import (
    sync_exam_to_register, sync_single_student, retry_pending_syncs,
    sync_to_register, sync_single_student_task,
    COLUMN_FIELD_MAP, VALID_COLUMNS, TASK_VALID_COLUMNS,
    get_valid_task_columns_for_school,
    get_valid_exam_columns_for_school,
    get_active_template_for_school,
    get_storage_field,
)

# ONLINE EXAMS MODULE - Premium Implementation
# ══════════════════════════════════════════════════════════════════════════════

class ExamStatus(str, Enum):
    draft = "draft"           # Created, only visible to teacher
    scheduled = "scheduled"   # Scheduled but not visible to students
    published = "published"   # Visible and accessible to students (within date/time)
    closed = "closed"         # Finished, read-only


class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_datetime: Optional[str] = None  # ISO format datetime (required for digital)
    end_datetime: Optional[str] = None    # ISO format datetime (required for digital)
    duration_minutes: Optional[int] = 60  # Default 60 minutes (required for digital)
    min_score_percentage: Optional[float] = 60.0
    # Register linkage — mutually exclusive, ONE column only
    period_id: Optional[str] = None          # Bimester period ID
    register_column: Optional[str] = None    # "EM" | "EB" | "P1" | "P2" | "P3" | null
    # Exam type
    type: Optional[str] = "digital"          # "digital" | "omr"
    # OMR-specific fields
    num_questions: Optional[int] = 20        # 5-100
    options_per_question: Optional[int] = 5  # 2-5 (A-E)
    answer_key: Optional[list] = None        # ["A", "C", "D", ...] length == num_questions
    points_per_question: Optional[float] = 1.0
    # Evidence upload — when True (digital only), students MUST attach one file
    # (image/pdf/word) as evidence before submitting.
    allow_evidence_upload: Optional[bool] = False


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    duration_minutes: Optional[int] = None
    min_score_percentage: Optional[float] = None
    status: Optional[ExamStatus] = None
    # Register linkage
    period_id: Optional[str] = None
    register_column: Optional[str] = None
    # OMR-specific fields
    num_questions: Optional[int] = None
    options_per_question: Optional[int] = None
    answer_key: Optional[list] = None
    points_per_question: Optional[float] = None
    # OMR PDF fields (written internally by generate endpoint)
    omr_pdf_url: Optional[str] = None
    bubble_map: Optional[dict] = None
    omr_pdf_generated_at: Optional[str] = None
    # Evidence upload toggle
    allow_evidence_upload: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════════════════
# UNIFIED REGISTER AVAILABILITY ENDPOINT (exams + tasks + manual grades)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/register/availability")
async def get_unified_register_availability(
    subject_id: str = Query(...),
    section_id: str = Query(None),
    period_id: str = Query(None),
    current_user=Depends(get_current_user)
):
    """
    Unified availability check resolved DYNAMICALLY from the school's active
    Registro Auxiliar template. Returns:

      - `availability`: legacy map keyed by column id with `{available, reason,
        assigned_to}` (kept for backward compatibility with the existing Tasks
        modal).
      - `columns`: NEW richer list-of-columns format used by the Exam modal.
        Each entry is `{id, field_key, label, criterion, criterion_label,
        type, available, blocked_reason, blocked_by}` and includes EVERY input
        subcolumna of the active plantilla PLUS its `columnas_finales`.

    Triple verification: exams + tasks + manual grades (top-level fields and
    `grades_dynamic.<column_id>`).
    """
    import asyncio as _asyncio
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    school_id = user["school_id"]

    # Auto-resolve period from active academic period when caller didn't pass one
    if period_id:
        active_period = await db.academic_periods.find_one(
            {"school_id": school_id, "id": period_id},
            {"_id": 0, "id": 1, "nombre": 1, "activo": 1}
        )
    else:
        active_period = await db.academic_periods.find_one(
            {"school_id": school_id, "activo": True},
            {"_id": 0, "id": 1, "nombre": 1}
        )
    if not active_period:
        return {
            "period_id": None,
            "period_name": None,
            "period_label": None,
            "period_active": False,
            "subject_id": subject_id,
            "section_id": section_id,
            "register_status": "open",
            "availability": {},
            "columns": [],
        }

    resolved_period_id = active_period["id"]
    period_name = active_period.get("nombre", "")

    # Resolve section_id from subject if not provided
    if not section_id:
        subject = await db.subjects.find_one(
            {"id": subject_id, "school_id": school_id},
            {"_id": 0, "section_id": 1}
        )
        section_id = subject.get("section_id") if subject else None

    grade_base_filter = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": resolved_period_id,
    }
    if section_id:
        grade_base_filter["section_id"] = section_id

    # Resolve the active template — drives the column list shown to teachers
    plantilla = await get_active_template_for_school(db, school_id)

    # Build the canonical column list from the plantilla.
    # IMPORTANT: We normalise the `field_key` here defensively so the
    # response is consistent regardless of how the plantilla doc was
    # serialized in MongoDB. Some legacy plantillas leaked the python
    # `None` as the literal string `"None"` which would otherwise be
    # truthy and propagate as a real (wrong) field_key.
    def _norm_fkey(raw):
        if raw is None:
            return None
        s = str(raw).strip()
        if s in ("", "None", "null", "NULL"):
            return None
        return s

    columns_meta: list[dict] = []
    if plantilla:
        for cri in plantilla.get("criterios", []) or []:
            cri_id = cri.get("id")
            cri_nombre = cri.get("nombre") or ""
            for sub in cri.get("subcolumnas", []) or []:
                if sub.get("tipo") != "input":
                    continue
                sid = sub.get("id")
                fkey = _norm_fkey(sub.get("field_key")) or sid
                columns_meta.append({
                    "id": sid,
                    "field_key": fkey,
                    "label": sub.get("label") or fkey,
                    "criterion": cri_id,
                    "criterion_label": cri_nombre,
                    "type": "input",
                })
        for col in plantilla.get("columnas_finales", []) or []:
            cid = col.get("id")
            fkey = _norm_fkey(col.get("field_key")) or cid
            columns_meta.append({
                "id": cid,
                "field_key": fkey,
                "label": col.get("label_corto") or col.get("label") or fkey,
                "criterion": "columnas_finales",
                "criterion_label": "EXÁMENES",
                "type": "input",
            })

    # Fetch linked exams, tasks and lock in parallel
    results = await _asyncio.gather(
        db.online_exams.find(
            {"school_id": school_id, "subject_id": subject_id,
             "period_id": resolved_period_id, "register_column": {"$ne": None}},
            {"_id": 0, "id": 1, "title": 1, "register_column": 1}
        ).to_list(100),
        db.course_posts.find(
            {"school_id": school_id, "subject_id": subject_id,
             "period_id": resolved_period_id, "register_column": {"$ne": None},
             "deleted_at": {"$exists": False},
             "$or": [{"post_type": "task"}, {"type": "task"}]},
            {"_id": 0, "id": 1, "title": 1, "register_column": 1}
        ).to_list(100),
        db.grade_locks.find_one(
            {"school_id": school_id, "subject_id": subject_id,
             "section_id": section_id, "period_id": resolved_period_id} if section_id
            else {"_id": None},
            {"_id": 0}
        ),
    )
    linked_exams, linked_tasks, lock = results

    exam_by_col = {e["register_column"]: e for e in linked_exams if e.get("register_column")}
    task_by_col = {t["register_column"]: t for t in linked_tasks if t.get("register_column")}

    # Manual grade counts: dispatch one count per column (static or dynamic field)
    async def _count_manual(col_meta: dict) -> int:
        column_key = col_meta["id"]
        ftype, fkey = await get_storage_field(db, column_key, school_id)
        if not ftype or not fkey:
            return 0
        path = fkey if ftype == "static" else f"grades_dynamic.{fkey}"
        return await db.student_grades.count_documents({**grade_base_filter, path: {"$ne": None}})

    manual_counts_list = await _asyncio.gather(*[_count_manual(c) for c in columns_meta]) \
        if columns_meta else []

    # Build the rich list-format response
    columns_response: list[dict] = []
    legacy_availability: dict = {}

    for idx, col in enumerate(columns_meta):
        keys_to_match = [col["id"], col["field_key"], col["label"]]
        # Match by ANY of the column's identifiers (id, field_key or label)
        # because tasks/exams might persist any of those as register_column.
        assigned_exam = next((exam_by_col[k] for k in keys_to_match if k in exam_by_col), None)
        assigned_task = next((task_by_col[k] for k in keys_to_match if k in task_by_col), None)
        manual_count = manual_counts_list[idx] if idx < len(manual_counts_list) else 0

        if assigned_exam:
            entry = {
                **col,
                "available": False,
                "blocked_reason": "exam_assigned",
                "blocked_by": {"type": "exam", "id": assigned_exam["id"],
                               "title": assigned_exam.get("title", "")},
            }
            legacy_availability[col["id"]] = {
                "available": False, "reason": "exam",
                "assigned_to": {"type": "exam", "id": assigned_exam["id"],
                                "title": assigned_exam.get("title", "")},
            }
        elif assigned_task:
            entry = {
                **col,
                "available": False,
                "blocked_reason": "task_assigned",
                "blocked_by": {"type": "task", "id": assigned_task["id"],
                               "title": assigned_task.get("title", "")},
            }
            legacy_availability[col["id"]] = {
                "available": False, "reason": "task",
                "assigned_to": {"type": "task", "id": assigned_task["id"],
                                "title": assigned_task.get("title", "")},
            }
        elif manual_count > 0:
            entry = {
                **col,
                "available": False,
                "blocked_reason": "manual_grades",
                "blocked_by": {"type": "manual", "id": None, "title": None},
            }
            legacy_availability[col["id"]] = {
                "available": False, "reason": "manual",
                "assigned_to": {"type": "manual", "id": None, "title": None},
            }
        else:
            entry = {**col, "available": True, "blocked_reason": None, "blocked_by": None}
            legacy_availability[col["id"]] = {"available": True, "reason": None, "assigned_to": None}

        # Mirror legacy availability under field_key and label as well so the
        # existing Tasks modal (which lookups by either id, field_key or label)
        # keeps working unchanged.
        legacy_availability[col["field_key"]] = legacy_availability[col["id"]]
        legacy_availability[col["label"]] = legacy_availability[col["id"]]

        columns_response.append(entry)

    # Backward-compat: ensure the legacy keys EM/EB/P1/P2/P3 always exist in
    # `availability` (even if the school's plantilla uses different ids), since
    # the Exam modal previously hard-checked those.
    legacy_static_static = {"EM": "exam_mensual", "EB": "exam_bimestral",
                            "P1": "part_p1", "P2": "part_p2", "P3": "part_p3"}
    for legacy_key, real_field in legacy_static_static.items():
        if legacy_key in legacy_availability:
            continue
        manual_count = await db.student_grades.count_documents(
            {**grade_base_filter, real_field: {"$ne": None}}
        )
        if legacy_key in exam_by_col:
            e = exam_by_col[legacy_key]
            legacy_availability[legacy_key] = {
                "available": False, "reason": "exam",
                "assigned_to": {"type": "exam", "id": e["id"], "title": e.get("title", "")},
            }
        elif legacy_key in task_by_col:
            t = task_by_col[legacy_key]
            legacy_availability[legacy_key] = {
                "available": False, "reason": "task",
                "assigned_to": {"type": "task", "id": t["id"], "title": t.get("title", "")},
            }
        elif manual_count > 0:
            legacy_availability[legacy_key] = {
                "available": False, "reason": "manual",
                "assigned_to": {"type": "manual", "id": None, "title": None},
            }
        else:
            legacy_availability[legacy_key] = {
                "available": True, "reason": None, "assigned_to": None,
            }

    register_status = "closed" if (lock and lock.get("locked")) else "open"

    return {
        "period_id": resolved_period_id,
        "period_name": period_name,
        "period_label": period_name,
        "period_active": True,
        "subject_id": subject_id,
        "section_id": section_id,
        "register_status": register_status,
        "availability": legacy_availability,
        "columns": columns_response,
    }


# Keep old endpoint for backward compat (redirects to unified logic)
@router.get("/exams/register-availability")
async def get_register_availability(
    subject_id: str = Query(...),
    section_id: str = Query(None),
    period_id: str = Query(None),
    current_user=Depends(get_current_user)
):
    """Legacy endpoint — delegates to unified availability."""
    return await get_unified_register_availability(
        subject_id=subject_id,
        section_id=section_id,
        period_id=period_id,
        current_user=current_user,
    )


async def _validate_register_linkage(
    school_id: str, subject_id: str, period_id: str,
    register_column: str | None,
    exclude_source_id: str | None = None,
    source_type: str = "exam",
):
    """
    Validate that the chosen column is not already taken by an exam, task, or manual grades.
    Uses register_column_assignments for cross-collection uniqueness.
    Falls back to direct queries for safety.
    """
    if not register_column:
        return

    if source_type == "task":
        # Task slots come from the school's active Registro Auxiliar
        # template (dynamic — not hard-coded P1/P2/P3).
        valid_task_cols = await get_valid_task_columns_for_school(db, school_id)
        if register_column not in valid_task_cols:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Esta columna no existe o no está habilitada para tareas en la "
                    "plantilla activa del Registro Auxiliar."
                ),
            )
    elif source_type == "exam":
        # Exam slots come dynamically from the school's active template
        # (input subcolumnas + columnas_finales). This replaces the old hard
        # limit to EM/EB/P1/P2/P3 so schools with custom plantillas can link
        # exams to any column they have configured.
        valid_exam_cols = await get_valid_exam_columns_for_school(db, school_id)
        if register_column not in valid_exam_cols:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Esta columna no existe o no está habilitada para exámenes en la "
                    "plantilla activa del Registro Auxiliar."
                ),
            )
    elif register_column not in VALID_COLUMNS:
        raise HTTPException(
            status_code=400,
            detail=f"register_column invalido: {register_column}. Valores validos: {', '.join(sorted(VALID_COLUMNS))}"
        )

    # Check register_column_assignments for cross-collection uniqueness
    assignment_query = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
        "register_column": register_column,
    }
    if exclude_source_id:
        assignment_query["source_id"] = {"$ne": exclude_source_id}

    conflict = await db.register_column_assignments.find_one(
        assignment_query, {"_id": 0}
    )
    if conflict:
        ctype = conflict.get("source_type", "exam")
        ctitle = conflict.get("source_title", "")
        label = "examen" if ctype == "exam" else "tarea"
        raise HTTPException(
            status_code=409,
            detail=f"La columna {register_column} ya fue asignada al {label} '{ctitle}'. Actualice la pagina e intente de nuevo."
        )

    # Also check manual grades — for static columns the field is a top-level
    # key in `student_grades`; for dynamic (custom-template) columns it lives
    # under `grades_dynamic.<column_id>`. `get_storage_field` resolves both.
    field_type, field_key = await get_storage_field(db, register_column, school_id)
    if field_type == "static":
        manual_query = {
            "school_id": school_id,
            "subject_id": subject_id,
            "period_id": period_id,
            field_key: {"$ne": None},
        }
    elif field_type == "dynamic":
        manual_query = {
            "school_id": school_id,
            "subject_id": subject_id,
            "period_id": period_id,
            f"grades_dynamic.{field_key}": {"$ne": None},
        }
    else:
        manual_query = None

    if manual_query is not None:
        manual_count = await db.student_grades.count_documents(manual_query)
        if manual_count > 0:
            raise HTTPException(
                status_code=409,
                detail=f"La columna {register_column} ya tiene notas registradas manualmente en el Registro Auxiliar."
            )


@router.get("/course/{subject_id}/exams")
async def get_course_exams(
    subject_id: str,
    current_user = Depends(get_current_user)
):
    """Get all exams for a course/subject"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Build query based on user role
    query = {"subject_id": subject_id, "school_id": user["school_id"]}
    
    # Students only see published exams
    if is_student(user):
        now = datetime.now(timezone.utc)
        query["status"] = ExamStatus.published.value
    
    exams = await db.online_exams.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # For students, add availability info
    if is_student(user):
        now = datetime.now(timezone.utc)
        for exam in exams:
            start = datetime.fromisoformat(exam["start_datetime"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(exam["end_datetime"].replace("Z", "+00:00"))
            exam["is_available"] = start <= now <= end
            exam["availability_message"] = None
            if now < start:
                exam["availability_message"] = "El examen aún no está disponible"
            elif now > end:
                exam["availability_message"] = "El tiempo para este examen ha finalizado"
    
    # Get creator info for each exam
    creator_ids = list(set(e.get("created_by") for e in exams if e.get("created_by")))
    creators = {}
    if creator_ids:
        creator_docs = await db.users.find({"id": {"$in": creator_ids}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1}).to_list(100)
        creators = {c["id"]: f"{c.get('name', '')} {c.get('last_name', '')}".strip() for c in creator_docs}
    
    for exam in exams:
        exam["creator_name"] = creators.get(exam.get("created_by"), "")
        # Check if any student has taken this exam (for deletion rules)
        attempts_count = await db.exam_attempts.count_documents({"exam_id": exam["id"]})
        exam["has_attempts"] = attempts_count > 0
        exam["attempts_count"] = attempts_count
    
    return exams


@router.post("/course/{subject_id}/exams")
async def create_exam(
    subject_id: str,
    data: ExamCreate,
    current_user = Depends(get_current_user)
):
    """Create a new exam for a course"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Only teachers and admins can create exams
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear exámenes")
    
    # Validate subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": user["school_id"]}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")

    school_id = user["school_id"]
    section_id = subject.get("section_id")
    exam_type = data.type or "digital"

    # Validate exam type
    if exam_type not in ("digital", "omr"):
        raise HTTPException(status_code=400, detail="Tipo de examen invalido. Debe ser 'digital' o 'omr'")

    # ── Type-specific validation ──
    if exam_type == "digital":
        # Digital exams require dates and duration
        if not data.start_datetime or not data.end_datetime:
            raise HTTPException(status_code=400, detail="Las fechas de inicio y fin son requeridas para exámenes digitales")
        try:
            start_dt = datetime.fromisoformat(data.start_datetime.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(data.end_datetime.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")
        if end_dt <= start_dt:
            raise HTTPException(status_code=400, detail="La fecha/hora de fin debe ser posterior a la de inicio")
        if not data.duration_minutes or data.duration_minutes < 1:
            raise HTTPException(status_code=400, detail="La duración del examen debe ser al menos 1 minuto")

    elif exam_type == "omr":
        # OMR exams require num_questions and options_per_question
        num_q = data.num_questions or 20
        opts = data.options_per_question or 5
        ppq = data.points_per_question or 1.0
        if not (5 <= num_q <= 100):
            raise HTTPException(status_code=400, detail="num_questions debe ser entre 5 y 100")
        if not (2 <= opts <= 5):
            raise HTTPException(status_code=400, detail="options_per_question debe ser entre 2 y 5")
        if ppq <= 0:
            raise HTTPException(status_code=400, detail="points_per_question debe ser positivo")
        # Validate answer_key if provided
        if data.answer_key is not None:
            if len(data.answer_key) != num_q:
                raise HTTPException(status_code=400, detail=f"answer_key debe tener exactamente {num_q} elementos")
            valid_letters = [chr(65 + i) for i in range(opts)]  # A, B, C, D, E
            for i, ans in enumerate(data.answer_key):
                if ans is not None and ans not in valid_letters:
                    raise HTTPException(status_code=400, detail=f"Pregunta {i+1}: respuesta '{ans}' invalida. Opciones validas: {', '.join(valid_letters)}")

    # Auto-resolve period_id from active academic period
    active_period = await db.academic_periods.find_one(
        {"school_id": school_id, "activo": True},
        {"_id": 0, "id": 1}
    )
    resolved_period_id = active_period["id"] if active_period else None

    # Validate register linkage uniqueness (if provided)
    if data.register_column:
        if not resolved_period_id:
            raise HTTPException(
                status_code=400,
                detail="No hay un periodo academico activo. Configure uno en Anos Academicos."
            )
        await _validate_register_linkage(
            school_id, subject_id, resolved_period_id, data.register_column,
            source_type="exam",
        )

    # Create exam
    exam_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    exam = {
        "id": exam_id,
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": section_id,
        "title": data.title,
        "description": data.description or "",
        "type": exam_type,
        "status": ExamStatus.draft.value,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
        # Register linkage — single column, period auto-resolved
        "period_id": resolved_period_id,
        "register_column": data.register_column,
        "sync_status": "not_linked" if not data.register_column else "pending",
    }

    if exam_type == "digital":
        exam.update({
            "start_datetime": data.start_datetime,
            "end_datetime": data.end_datetime,
            "duration_minutes": data.duration_minutes,
            "min_score_percentage": data.min_score_percentage or 60.0,
            "allow_evidence_upload": bool(data.allow_evidence_upload),
        })
    elif exam_type == "omr":
        num_q = data.num_questions or 20
        ppq = data.points_per_question or 1.0
        exam.update({
            "num_questions": num_q,
            "options_per_question": data.options_per_question or 5,
            "answer_key": data.answer_key,
            "points_per_question": ppq,
            "total_points": num_q * ppq,
        })
    
    # Evidence requires Google Drive (evidences are stored ONLY in Drive).
    if exam.get("allow_evidence_upload"):
        _sch = await db.schools.find_one({"id": school_id}, {"_id": 0, "google_drive_connected": 1, "google_drive_materials_folder_id": 1})
        if not (_sch and _sch.get("google_drive_connected") and _sch.get("google_drive_materials_folder_id")):
            raise HTTPException(
                status_code=400,
                detail="Para pedir evidencia primero debes conectar Google Drive (Ajustes → Integraciones). Las evidencias se guardan únicamente en tu Drive.",
            )

    await db.online_exams.insert_one(exam)

    # Insert register_column_assignments if linked
    if data.register_column and resolved_period_id:
        try:
            await db.register_column_assignments.insert_one({
                "school_id": school_id,
                "subject_id": subject_id,
                "section_id": section_id,
                "period_id": resolved_period_id,
                "register_column": data.register_column,
                "source_type": "exam",
                "source_id": exam_id,
                "source_title": data.title,
                "created_at": now,
            })
        except Exception:
            # Unique index violation = race condition
            await db.online_exams.delete_one({"id": exam_id})
            raise HTTPException(
                status_code=409,
                detail=f"La columna {data.register_column} ya fue asignada. Actualice la pagina e intente de nuevo."
            )
    
    # Remove _id for response
    exam.pop("_id", None)
    return exam


@router.post("/exams/{exam_id}/duplicate")
async def duplicate_exam(exam_id: str, current_user = Depends(get_current_user)):
    """Duplicate an exam with all its questions"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    original = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    new_exam_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    new_exam = {
        "id": new_exam_id,
        "school_id": original["school_id"],
        "subject_id": original["subject_id"],
        "title": f"{original['title']} (Copia)",
        "description": original.get("description", ""),
        "start_datetime": original.get("start_datetime"),
        "end_datetime": original.get("end_datetime"),
        "duration_minutes": original.get("duration_minutes", 60),
        "min_score_percentage": original.get("min_score_percentage", 60.0),
        "status": "draft",
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.online_exams.insert_one(new_exam)
    new_exam.pop("_id", None)
    
    # Duplicate questions
    questions = await db.exam_questions.find({"exam_id": exam_id}, {"_id": 0}).to_list(200)
    if questions:
        new_questions = []
        for q in questions:
            new_q = {**q, "id": str(uuid.uuid4()), "exam_id": new_exam_id}
            new_questions.append(new_q)
        await db.exam_questions.insert_many(new_questions)
        for nq in new_questions:
            nq.pop("_id", None)
    
    new_exam["questions_count"] = len(questions)
    return {"message": f"Examen duplicado con {len(questions)} preguntas", "exam": new_exam}


@router.get("/exams/{exam_id}")
async def get_exam_detail(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Get exam details"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Students can only see published exams
    if is_student(user) and exam["status"] != ExamStatus.published.value:
        raise HTTPException(status_code=403, detail="Este examen no está disponible")
    
    # Get subject info
    subject = await db.subjects.find_one({"id": exam["subject_id"]}, {"_id": 0, "name": 1, "color": 1})
    exam["subject_name"] = subject.get("name", "") if subject else ""
    exam["subject_color"] = subject.get("color", "#6366F1") if subject else "#6366F1"
    
    # Get creator info
    if exam.get("created_by"):
        creator = await db.users.find_one({"id": exam["created_by"]}, {"_id": 0, "name": 1, "last_name": 1})
        exam["creator_name"] = f"{creator.get('name', '')} {creator.get('last_name', '')}".strip() if creator else ""
    
    # Get attempts count
    attempts_count = await db.exam_attempts.count_documents({"exam_id": exam_id})
    exam["has_attempts"] = attempts_count > 0
    exam["attempts_count"] = attempts_count
    
    # For students, check availability
    if is_student(user):
        if exam.get("type", "digital") == "digital" and exam.get("start_datetime") and exam.get("end_datetime"):
            now = datetime.now(timezone.utc)
            start = datetime.fromisoformat(exam["start_datetime"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(exam["end_datetime"].replace("Z", "+00:00"))
            exam["is_available"] = start <= now <= end
        else:
            exam["is_available"] = False
    
    return exam


@router.put("/exams/{exam_id}")
async def update_exam(
    exam_id: str,
    data: ExamUpdate,
    current_user = Depends(get_current_user)
):
    """Update an exam"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Only teachers and admins can update exams
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar exámenes")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Cannot edit closed exams
    if exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se puede editar un examen cerrado")
    
    # Build update data
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title
    if data.description is not None:
        update_data["description"] = data.description
    if data.duration_minutes is not None:
        update_data["duration_minutes"] = data.duration_minutes
    if data.min_score_percentage is not None:
        update_data["min_score_percentage"] = data.min_score_percentage

    # ── OMR-specific fields ──
    exam_type = exam.get("type", "digital")
    if exam_type == "omr":
        eff_num_q = exam.get("num_questions", 20)
        eff_opts = exam.get("options_per_question", 5)
        eff_ppq = exam.get("points_per_question", 1.0)

        if data.num_questions is not None:
            if not (5 <= data.num_questions <= 100):
                raise HTTPException(status_code=400, detail="num_questions debe ser entre 5 y 100")
            update_data["num_questions"] = data.num_questions
            eff_num_q = data.num_questions
        if data.options_per_question is not None:
            if not (2 <= data.options_per_question <= 5):
                raise HTTPException(status_code=400, detail="options_per_question debe ser entre 2 y 5")
            update_data["options_per_question"] = data.options_per_question
            eff_opts = data.options_per_question
        if data.points_per_question is not None:
            if data.points_per_question <= 0:
                raise HTTPException(status_code=400, detail="points_per_question debe ser positivo")
            update_data["points_per_question"] = data.points_per_question
            eff_ppq = data.points_per_question

        # Validate answer_key
        if data.answer_key is not None:
            if len(data.answer_key) != eff_num_q:
                raise HTTPException(status_code=400, detail=f"answer_key debe tener exactamente {eff_num_q} elementos (indice 0 = pregunta 1)")
            valid_letters = [chr(65 + i) for i in range(eff_opts)]
            for i, ans in enumerate(data.answer_key):
                if ans is not None and ans not in valid_letters:
                    raise HTTPException(status_code=400, detail=f"Pregunta {i+1}: respuesta '{ans}' invalida. Opciones: {', '.join(valid_letters)}")
            update_data["answer_key"] = data.answer_key

        # Recalculate total_points if changed
        if "num_questions" in update_data or "points_per_question" in update_data:
            update_data["total_points"] = eff_num_q * eff_ppq

    if data.status is not None:
        # Validate status transitions
        new_status = data.status.value
        
        # Check if exam has attempts before allowing certain transitions
        attempts_count = await db.exam_attempts.count_documents({"exam_id": exam_id})
        
        if new_status == ExamStatus.draft.value and attempts_count > 0:
            raise HTTPException(status_code=400, detail="No se puede volver a borrador un examen que ya tiene intentos")
        
        update_data["status"] = new_status
    
    # Validate dates if being updated (only for digital exams)
    if exam_type == "digital":
        start_dt = data.start_datetime or exam.get("start_datetime", "")
        end_dt = data.end_datetime or exam.get("end_datetime", "")

        if data.start_datetime is not None or data.end_datetime is not None:
            try:
                start = datetime.fromisoformat(start_dt.replace("Z", "+00:00"))
                end = datetime.fromisoformat(end_dt.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato de fecha inválido")
            
            if end <= start:
                raise HTTPException(status_code=400, detail="La fecha/hora de fin debe ser posterior a la de inicio")
            
            if data.start_datetime is not None:
                update_data["start_datetime"] = data.start_datetime
            if data.end_datetime is not None:
                update_data["end_datetime"] = data.end_datetime

        if data.allow_evidence_upload is not None:
            update_data["allow_evidence_upload"] = bool(data.allow_evidence_upload)
            if data.allow_evidence_upload:
                _sch = await db.schools.find_one({"id": user["school_id"]}, {"_id": 0, "google_drive_connected": 1, "google_drive_materials_folder_id": 1})
                if not (_sch and _sch.get("google_drive_connected") and _sch.get("google_drive_materials_folder_id")):
                    raise HTTPException(
                        status_code=400,
                        detail="Para pedir evidencia primero debes conectar Google Drive (Ajustes → Integraciones). Las evidencias se guardan únicamente en tu Drive.",
                    )
    
    # Handle register linkage updates
    old_column = exam.get("register_column")
    old_period_id = exam.get("period_id")
    linkage_changed = False

    # Auto-resolve period from active academic period
    active_period = await db.academic_periods.find_one(
        {"school_id": user["school_id"], "activo": True},
        {"_id": 0, "id": 1}
    )
    resolved_period_id = active_period["id"] if active_period else old_period_id

    if data.register_column is not None:
        update_data["register_column"] = data.register_column if data.register_column else None
    # Always use the active period for linkage
    update_data["period_id"] = resolved_period_id

    eff_column = update_data.get("register_column", old_column)

    if eff_column != old_column or resolved_period_id != old_period_id:
        linkage_changed = True
        if eff_column:
            if not resolved_period_id:
                raise HTTPException(
                    status_code=400,
                    detail="No hay un periodo academico activo. Configure uno en Anos Academicos."
                )
            await _validate_register_linkage(
                user["school_id"], exam["subject_id"], resolved_period_id,
                eff_column, exclude_source_id=exam_id, source_type="exam",
            )
        update_data["sync_status"] = "not_linked" if not eff_column else "pending"

    await db.online_exams.update_one({"id": exam_id}, {"$set": update_data})

    # Update register_column_assignments if linkage changed
    if linkage_changed:
        # Remove old assignment
        if old_column:
            await db.register_column_assignments.delete_one({"source_id": exam_id})
            # Clean old grades
            await db.online_exams.update_one({"id": exam_id}, {"$set": {"register_column": old_column, "period_id": old_period_id}})
            await sync_exam_to_register(db, exam_id, "delete")
            await db.online_exams.update_one({"id": exam_id}, {"$set": update_data})
        # Insert new assignment
        if eff_column and resolved_period_id:
            try:
                await db.register_column_assignments.insert_one({
                    "school_id": user["school_id"],
                    "subject_id": exam["subject_id"],
                    "section_id": exam.get("section_id"),
                    "period_id": resolved_period_id,
                    "register_column": eff_column,
                    "source_type": "exam",
                    "source_id": exam_id,
                    "source_title": update_data.get("title", exam.get("title", "")),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                pass
            await sync_exam_to_register(db, exam_id, "update")

    # Return updated exam
    updated_exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0})
    return updated_exam


@router.post("/exams/{exam_id}/publish")
async def publish_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Publish an exam (make it visible to students)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para publicar exámenes")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    if exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se puede publicar un examen cerrado")
    
    if exam["status"] == ExamStatus.published.value:
        raise HTTPException(status_code=400, detail="El examen ya está publicado")
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"status": ExamStatus.published.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log activity
    try:
        activity = {
            "id": str(uuid.uuid4()),
            "school_id": user["school_id"],
            "subject_id": exam["subject_id"],
            "user_id": user["id"],
            "user_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
            "user_photo_url": user.get("profile_image"),
            "activity_type": "exam_scheduled",
            "content": {
                "exam_id": exam_id,
                "exam_title": exam["title"]
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.course_activities.insert_one(activity)
    except Exception as e:
        print(f"Error logging activity: {e}")
    
    # Create notification for exam publication
    try:
        from .courses import create_notification_for_subject
        await create_notification_for_subject(
            school_id=user["school_id"],
            subject_id=exam["subject_id"],
            title="Nuevo examen publicado",
            message=f"Se ha publicado un nuevo examen: {exam['title']}",
            notification_type="exam",
            reference_id=exam_id,
            author_id=user["id"],
            author_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip()
        )
    except Exception as e:
        print(f"Error creating notification: {e}")
    
    return {"message": "Examen publicado exitosamente", "status": ExamStatus.published.value}


@router.post("/exams/{exam_id}/close")
async def close_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Close an exam (no more attempts allowed)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para cerrar exámenes")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    if exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="El examen ya está cerrado")
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"status": ExamStatus.closed.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Examen cerrado exitosamente", "status": ExamStatus.closed.value}


class ReopenExamRequest(BaseModel):
    # Optional explicit new availability window. If omitted and the exam's
    # window already expired, it is auto-extended preserving the original length.
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None


@router.post("/exams/{exam_id}/reopen")
async def reopen_exam(
    exam_id: str,
    body: Optional[ReopenExamRequest] = None,
    current_user = Depends(get_current_user)
):
    """Reopen a closed exam back to published state.

    Útil cuando el docente cerró un examen por error o quiere extender el
    plazo. Solo aplica si el examen está cerrado; no toca intentos previos.

    IMPORTANTE: para exámenes digitales existe un cron que cierra
    automáticamente los exámenes publicados cuya `end_datetime` ya pasó. Por eso,
    si al reabrir la ventana de disponibilidad ya venció, se amplía
    automáticamente (preservando la duración original a partir de ahora) para que
    el examen NO se vuelva a cerrar solo. El docente puede pasar `start_datetime`
    / `end_datetime` para fijar una ventana específica.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para reabrir exámenes")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]},
        {"_id": 0}
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    if exam["status"] != ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="Solo se pueden reabrir exámenes cerrados")

    now = datetime.now(timezone.utc)
    update = {"status": ExamStatus.published.value, "updated_at": now.isoformat()}
    extended = False

    is_digital = exam.get("type", "digital") == "digital"
    if is_digital:
        def _parse(v):
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None
            except Exception:
                return None

        explicit_start = body.start_datetime if body else None
        explicit_end = body.end_datetime if body else None

        if explicit_end:
            # Teacher provided a specific window — validate it.
            new_end = _parse(explicit_end)
            new_start = _parse(explicit_start) or _parse(exam.get("start_datetime")) or now
            if not new_end:
                raise HTTPException(status_code=400, detail="Formato de fecha de fin inválido")
            if new_end <= now:
                raise HTTPException(status_code=400, detail="La fecha/hora de fin debe ser futura")
            if new_end <= new_start:
                raise HTTPException(status_code=400, detail="La fecha/hora de fin debe ser posterior a la de inicio")
            update["start_datetime"] = new_start.isoformat()
            update["end_datetime"] = new_end.isoformat()
            extended = True
        else:
            # No explicit window: auto-extend only if it already expired, so the
            # auto-close cron does not re-close it immediately.
            end_dt = _parse(exam.get("end_datetime"))
            if end_dt and end_dt <= now:
                start_dt = _parse(exam.get("start_datetime"))
                # Preserve the original availability window length.
                window = (end_dt - start_dt) if (start_dt and end_dt > start_dt) else None
                if not window or window.total_seconds() < 60:
                    mins = exam.get("duration_minutes") or 60
                    window = timedelta(minutes=max(int(mins), 1))
                update["start_datetime"] = now.isoformat()
                update["end_datetime"] = (now + window).isoformat()
                extended = True

    await db.online_exams.update_one({"id": exam_id}, {"$set": update})

    msg = "Examen reabierto exitosamente"
    if extended:
        msg += ". Se amplió la disponibilidad porque la fecha/hora ya había vencido."
    return {
        "message": msg,
        "status": ExamStatus.published.value,
        "extended": extended,
        "start_datetime": update.get("start_datetime", exam.get("start_datetime")),
        "end_datetime": update.get("end_datetime", exam.get("end_datetime")),
    }


@router.post("/exams/{exam_id}/schedule")
async def schedule_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Schedule an exam (intermediate state before publishing)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    if exam["status"] not in [ExamStatus.draft.value]:
        raise HTTPException(status_code=400, detail="Solo se pueden programar exámenes en estado borrador")
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"status": ExamStatus.scheduled.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Examen programado exitosamente", "status": ExamStatus.scheduled.value}


@router.delete("/exams/{exam_id}")
async def delete_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an exam (with restrictions)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar exámenes")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Clean up attempts if any
    await db.exam_attempts.delete_many({"exam_id": exam_id})
    
    # Clean up OMR scans if any
    await db.omr_scans.delete_many({"exam_id": exam_id})

    # Clean register linkage before deleting
    if exam.get("register_column"):
        await sync_exam_to_register(db, exam_id, "delete")
        await db.register_column_assignments.delete_one({"source_id": exam_id})

    await db.online_exams.delete_one({"id": exam_id})
    
    return {"message": "Examen eliminado exitosamente"}


@router.post("/exams/{exam_id}/archive")
async def archive_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Archive an exam (soft delete for closed exams or exams with attempts)"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"is_archived": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Examen archivado exitosamente"}


# ══════════════════════════════════════════════════════════════════════════════
# EXAM QUESTIONS MODULE - Premium Implementation
# ══════════════════════════════════════════════════════════════════════════════

class QuestionType(str, Enum):
    multiple_choice = "multiple_choice"  # Opción múltiple
    true_false = "true_false"            # Verdadero/Falso
    fill_blanks = "fill_blanks"          # Espacios en blanco


class QuestionOption(BaseModel):
    id: str
    text: str
    is_correct: bool = False


class QuestionCreate(BaseModel):
    question_type: QuestionType
    question_text: str
    points: float = 1.0
    options: Optional[List[dict]] = None  # For multiple choice
    correct_answer: Optional[str] = None  # For true/false: "true"/"false", for fill_blanks: comma-separated words
    image_url: Optional[str] = None  # Cloudinary URL for question image


class QuestionUpdate(BaseModel):
    question_type: Optional[QuestionType] = None
    question_text: Optional[str] = None
    points: Optional[float] = None
    options: Optional[List[dict]] = None
    correct_answer: Optional[str] = None
    order: Optional[int] = None
    image_url: Optional[str] = None  # Cloudinary URL for question image


@router.get("/exams/{exam_id}/questions")
async def get_exam_questions(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Get all questions for an exam"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Verify exam exists and user has access
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Get questions ordered
    questions = await db.exam_questions.find(
        {"exam_id": exam_id},
        {"_id": 0}
    ).sort("order", 1).to_list(200)
    
    # For students taking the exam, hide correct answers
    if is_student(user):
        for q in questions:
            # Hide correct answer
            q.pop("correct_answer", None)
            # For multiple choice, hide which option is correct
            if q.get("options"):
                for opt in q["options"]:
                    opt.pop("is_correct", None)
    
    return questions


@router.post("/exams/{exam_id}/questions")
async def create_exam_question(
    exam_id: str,
    data: QuestionCreate,
    current_user = Depends(get_current_user)
):
    """Create a new question for an exam"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear preguntas")
    
    # Verify exam exists
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Cannot add questions to closed exams
    if exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se pueden agregar preguntas a un examen cerrado")
    
    # Validate based on question type
    if data.question_type == QuestionType.multiple_choice:
        if not data.options or len(data.options) < 2:
            raise HTTPException(status_code=400, detail="Las preguntas de opción múltiple requieren al menos 2 opciones")
        # Check at least one correct answer
        has_correct = any(opt.get("is_correct") for opt in data.options)
        if not has_correct:
            raise HTTPException(status_code=400, detail="Debe marcar al menos una respuesta correcta")
    
    elif data.question_type == QuestionType.true_false:
        if not data.correct_answer or data.correct_answer not in ["true", "false"]:
            raise HTTPException(status_code=400, detail="Debe indicar si la respuesta es verdadero o falso")
    
    elif data.question_type == QuestionType.fill_blanks:
        if "_" not in data.question_text:
            raise HTTPException(status_code=400, detail="La pregunta debe contener al menos un espacio en blanco marcado con '_'")
        if not data.correct_answer:
            raise HTTPException(status_code=400, detail="Debe proporcionar las palabras correctas separadas por coma")
    
    # Get next order number
    last_question = await db.exam_questions.find_one(
        {"exam_id": exam_id},
        sort=[("order", -1)]
    )
    next_order = (last_question.get("order", 0) + 1) if last_question else 1
    
    # Create question
    question_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Process options for multiple choice
    options = None
    if data.question_type == QuestionType.multiple_choice and data.options:
        options = []
        for i, opt in enumerate(data.options):
            options.append({
                "id": str(uuid.uuid4()),
                "text": opt.get("text", ""),
                "is_correct": opt.get("is_correct", False)
            })
    
    question = {
        "id": question_id,
        "exam_id": exam_id,
        "school_id": user["school_id"],
        "question_type": data.question_type.value,
        "question_text": data.question_text,
        "points": data.points,
        "options": options,
        "correct_answer": data.correct_answer,
        "image_url": data.image_url,
        "order": next_order,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.exam_questions.insert_one(question)
    
    # Update exam total points
    await update_exam_total_points(exam_id)
    
    question.pop("_id", None)
    return question


async def update_exam_total_points(exam_id: str):
    """Recalculate and update exam total points"""
    pipeline = [
        {"$match": {"exam_id": exam_id}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ]
    result = await db.exam_questions.aggregate(pipeline).to_list(1)
    total_points = result[0]["total"] if result else 0
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"total_points": total_points, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )


@router.put("/exams/questions/{question_id}")
async def update_exam_question(
    question_id: str,
    data: QuestionUpdate,
    current_user = Depends(get_current_user)
):
    """Update an exam question"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar preguntas")
    
    question = await db.exam_questions.find_one({"id": question_id, "school_id": user["school_id"]}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    
    # Check exam is not closed
    exam = await db.online_exams.find_one({"id": question["exam_id"]}, {"_id": 0})
    if exam and exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se pueden editar preguntas de un examen cerrado")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.question_type is not None:
        update_data["question_type"] = data.question_type.value
    if data.question_text is not None:
        update_data["question_text"] = data.question_text
    if data.points is not None:
        update_data["points"] = data.points
    if data.correct_answer is not None:
        update_data["correct_answer"] = data.correct_answer
    if data.order is not None:
        update_data["order"] = data.order
    if data.options is not None:
        # Process options
        options = []
        for opt in data.options:
            options.append({
                "id": opt.get("id") or str(uuid.uuid4()),
                "text": opt.get("text", ""),
                "is_correct": opt.get("is_correct", False)
            })
        update_data["options"] = options
    
    # Handle image update - delete old image from Cloudinary if replacing
    if data.image_url is not None:
        old_image_url = question.get("image_url")
        if old_image_url and "cloudinary.com" in old_image_url and old_image_url != data.image_url:
            try:
                # Extract public_id from Cloudinary URL
                parts = old_image_url.split("/upload/")
                if len(parts) > 1:
                    public_id_with_ext = parts[1].split("/", 1)[-1] if "/" in parts[1] else parts[1]
                    public_id = public_id_with_ext.rsplit(".", 1)[0]
                    cloudinary.uploader.destroy(public_id)
            except Exception as e:
                print(f"Error deleting old question image from Cloudinary: {e}")
        update_data["image_url"] = data.image_url
    
    await db.exam_questions.update_one({"id": question_id}, {"$set": update_data})
    
    # Update exam total points
    await update_exam_total_points(question["exam_id"])
    
    updated = await db.exam_questions.find_one({"id": question_id}, {"_id": 0})
    return updated


@router.delete("/exams/questions/{question_id}")
async def delete_exam_question(
    question_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an exam question"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar preguntas")
    
    question = await db.exam_questions.find_one({"id": question_id, "school_id": user["school_id"]}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    
    # Check exam is not closed
    exam = await db.online_exams.find_one({"id": question["exam_id"]}, {"_id": 0})
    if exam and exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se pueden eliminar preguntas de un examen cerrado")
    
    # Delete image from Cloudinary if exists
    if question.get("image_url") and "cloudinary.com" in question["image_url"]:
        try:
            parts = question["image_url"].split("/upload/")
            if len(parts) > 1:
                public_id_with_ext = parts[1].split("/", 1)[-1] if "/" in parts[1] else parts[1]
                public_id = public_id_with_ext.rsplit(".", 1)[0]
                cloudinary.uploader.destroy(public_id)
        except Exception as e:
            print(f"Error deleting question image from Cloudinary: {e}")
    
    exam_id = question["exam_id"]
    await db.exam_questions.delete_one({"id": question_id})
    
    # Update exam total points
    await update_exam_total_points(exam_id)
    
    # Reorder remaining questions
    remaining = await db.exam_questions.find({"exam_id": exam_id}).sort("order", 1).to_list(200)
    for i, q in enumerate(remaining):
        await db.exam_questions.update_one({"id": q["id"]}, {"$set": {"order": i + 1}})
    
    return {"message": "Pregunta eliminada exitosamente"}



@router.delete("/exams/questions/{question_id}/image")
async def delete_question_image(
    question_id: str,
    current_user = Depends(get_current_user)
):
    """Delete only the image from a question"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    question = await db.exam_questions.find_one({"id": question_id, "school_id": user["school_id"]}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    
    # Delete from Cloudinary
    if question.get("image_url") and "cloudinary.com" in question["image_url"]:
        try:
            parts = question["image_url"].split("/upload/")
            if len(parts) > 1:
                public_id_with_ext = parts[1].split("/", 1)[-1] if "/" in parts[1] else parts[1]
                public_id = public_id_with_ext.rsplit(".", 1)[0]
                cloudinary.uploader.destroy(public_id)
        except Exception as e:
            print(f"Error deleting question image: {e}")
    
    # Remove image_url from question
    await db.exam_questions.update_one(
        {"id": question_id},
        {"$set": {"image_url": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Imagen eliminada exitosamente"}


@router.post("/exams/questions/{question_id}/reorder")
async def reorder_exam_question(
    question_id: str,
    new_order: int,
    current_user = Depends(get_current_user)
):
    """Reorder a question within an exam"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    question = await db.exam_questions.find_one({"id": question_id, "school_id": user["school_id"]}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    
    exam_id = question["exam_id"]
    old_order = question["order"]
    
    if new_order == old_order:
        return {"message": "Sin cambios"}
    
    # Get all questions for this exam
    questions = await db.exam_questions.find({"exam_id": exam_id}).sort("order", 1).to_list(200)
    
    # Reorder
    if new_order < old_order:
        # Moving up
        for q in questions:
            if q["order"] >= new_order and q["order"] < old_order:
                await db.exam_questions.update_one({"id": q["id"]}, {"$set": {"order": q["order"] + 1}})
    else:
        # Moving down
        for q in questions:
            if q["order"] > old_order and q["order"] <= new_order:
                await db.exam_questions.update_one({"id": q["id"]}, {"$set": {"order": q["order"] - 1}})
    
    # Set new order for moved question
    await db.exam_questions.update_one({"id": question_id}, {"$set": {"order": new_order}})
    
    return {"message": "Orden actualizado"}


@router.get("/exams/{exam_id}/full")
async def get_exam_full_detail(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Get full exam details including subject info and questions count"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Get subject info
    subject = await db.subjects.find_one({"id": exam["subject_id"]}, {"_id": 0})
    if subject:
        exam["subject_name"] = subject.get("name", "")
        exam["subject_color"] = subject.get("color", "#6366F1")
        
        # Get grade info
        if subject.get("grade_id"):
            grade = await db.grades.find_one({"id": subject["grade_id"]}, {"_id": 0})
            exam["grade_name"] = grade.get("nombre", "") if grade else ""
        
        # Get level info
        if subject.get("level_id"):
            level = await db.academic_levels.find_one({"id": subject["level_id"]}, {"_id": 0})
            exam["level_name"] = level.get("nombre", "") if level else ""
    
    # Get questions count and total points
    questions = await db.exam_questions.find({"exam_id": exam_id}, {"_id": 0}).to_list(200)
    exam["questions_count"] = len(questions)
    if exam.get("type") == "omr":
        exam["total_points"] = exam.get("total_points", 0)
    else:
        exam["total_points"] = sum(q.get("points", 0) for q in questions)
    
    # Get creator info
    if exam.get("created_by"):
        creator = await db.users.find_one({"id": exam["created_by"]}, {"_id": 0, "name": 1, "last_name": 1})
        exam["creator_name"] = f"{creator.get('name', '')} {creator.get('last_name', '')}".strip() if creator else ""
    
    return exam


# ══════════════════════════════════════════════════════════════════════════════
# OMR PDF GENERATION ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/exams/{exam_id}/generate-omr-pdf")
async def generate_omr_pdf(
    exam_id: str,
    current_user=Depends(get_current_user)
):
    """Generate the OMR answer sheet PDF and upload to Cloudinary."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    if exam.get("type") != "omr":
        raise HTTPException(status_code=400, detail="Este examen no es de tipo OMR")

    # Permission check
    if not has_role(user, STAFF_ROLES):
        raise HTTPException(status_code=403, detail="No tiene permisos")

    num_q = exam.get("num_questions", 20)
    opts = exam.get("options_per_question", 5)
    if not (5 <= num_q <= 100):
        raise HTTPException(status_code=400, detail="num_questions debe ser entre 5 y 100")
    if not (2 <= opts <= 5):
        raise HTTPException(status_code=400, detail="options_per_question debe ser entre 2 y 5")

    from services.omr_pdf_generator import generate_omr_sheet

    pdf_bytes, bubble_map = generate_omr_sheet({
        "id": exam_id,
        "title": exam.get("title", "Examen OMR"),
        "num_questions": num_q,
        "options_per_question": opts,
    })

    # Delete previous PDF from Cloudinary if exists
    old_url = exam.get("omr_pdf_url")
    if old_url and "cloudinary.com" in old_url:
        try:
            parts = old_url.split("/upload/")
            if len(parts) > 1:
                raw_path = parts[1]
                if "/" in raw_path:
                    raw_path = "/".join(raw_path.split("/")[1:])  # skip version
                public_id = raw_path.rsplit(".", 1)[0] if "." in raw_path else raw_path
                cloudinary.uploader.destroy(public_id, resource_type="raw")
        except Exception as e:
            logger.warning(f"Could not delete old OMR PDF: {e}")

    # Upload new PDF to Cloudinary
    result = cloudinary.uploader.upload(
        io.BytesIO(pdf_bytes),
        folder="edunet/omr-sheets",
        public_id=f"omr_{exam_id}",
        resource_type="raw",
        overwrite=True,
        format="pdf",
    )
    pdf_url = result["secure_url"]

    # Save to exam document
    now_str = datetime.now(timezone.utc).isoformat()
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {
            "omr_pdf_url": pdf_url,
            "bubble_map": bubble_map,
            "omr_pdf_generated_at": now_str,
            "updated_at": now_str,
        }}
    )

    return {"pdf_url": pdf_url, "message": "Hoja OMR generada exitosamente"}


@router.get("/exams/{exam_id}/omr-pdf")
async def get_omr_pdf(
    exam_id: str,
    current_user=Depends(get_current_user)
):
    """Get the OMR PDF URL for an exam."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]},
        {"_id": 0, "omr_pdf_url": 1, "omr_pdf_generated_at": 1, "type": 1}
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    if exam.get("type") != "omr":
        raise HTTPException(status_code=400, detail="Este examen no es de tipo OMR")

    if not exam.get("omr_pdf_url"):
        raise HTTPException(status_code=404, detail="La hoja OMR aun no ha sido generada")

    return {
        "pdf_url": exam["omr_pdf_url"],
        "generated_at": exam.get("omr_pdf_generated_at"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# OMR SCANNING ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/exams/{exam_id}/omr-students")
async def get_omr_students(exam_id: str, current_user=Depends(get_current_user)):
    """Get students in the exam's section with scan status."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]},
        {"_id": 0, "section_id": 1, "school_id": 1, "type": 1}
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    if exam.get("type") != "omr":
        raise HTTPException(status_code=400, detail="No es un examen OMR")

    section_id = exam.get("section_id")
    school_id = exam["school_id"]

    student_filter = {
        "school_id": school_id,
        "role": "student",
        "student_status": {"$in": ["enrolled", "active"]},
        "seccion_id": section_id,
    }
    students = await db.users.find(
        student_filter,
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "dni": 1}
    ).sort([("last_name", 1), ("name", 1)]).to_list(200)

    if not students:
        student_filter["section_id"] = student_filter.pop("seccion_id")
        students = await db.users.find(
            student_filter,
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "dni": 1}
        ).sort([("last_name", 1), ("name", 1)]).to_list(200)

    scans = await db.omr_scans.find(
        {"exam_id": exam_id}, {"_id": 0, "student_id": 1, "score": 1, "total": 1}
    ).to_list(200)
    scan_map = {s["student_id"]: s for s in scans}

    result = []
    for st in students:
        scan = scan_map.get(st["id"])
        result.append({
            "id": st["id"],
            "name": st.get("name", ""),
            "last_name": st.get("last_name", ""),
            "full_name": f"{st.get('last_name', '')} {st.get('name', '')}".strip(),
            "has_scan": scan is not None,
            "scan_score": scan["score"] if scan else None,
            "scan_total": scan["total"] if scan else None,
        })

    return result


@router.post("/exams/{exam_id}/omr-scan")
async def process_omr_scan_endpoint(
    exam_id: str,
    image: UploadFile = File(...),
    student_id: str = Form(...),
    current_user=Depends(get_current_user),
):
    """Process an OMR sheet scan for a student."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if not has_role(user, STAFF_ROLES):
        raise HTTPException(status_code=403, detail="No tiene permisos")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    if exam.get("type") != "omr":
        raise HTTPException(status_code=400, detail="No es un examen OMR")

    answer_key = exam.get("answer_key")
    if not answer_key:
        raise HTTPException(status_code=400, detail="Debe configurar la clave de respuestas antes de escanear")
    bubble_map = exam.get("bubble_map")
    if not bubble_map:
        raise HTTPException(status_code=400, detail="Debe generar la hoja de respuestas antes de escanear")

    if image.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="Formato de imagen no soportado. Use JPEG o PNG.")

    image_bytes = await image.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen excede el limite de 10MB")

    from services.omr_scanner import process_omr_scan as run_omr

    result = run_omr(image_bytes, bubble_map, answer_key, exam.get("options_per_question", 5))

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    # Nota: Las imagenes no se almacenan. Solo se procesan en memoria con OpenCV
    # y se guardan los datos extraidos (detected_answers, score, details)

    grade_vig = round(result["percentage"] * 20 / 100)

    # Check for existing scan
    existing = await db.omr_scans.find_one(
        {"exam_id": exam_id, "student_id": student_id}, {"_id": 0, "id": 1}
    )
    if existing:
        return JSONResponse(
            status_code=409,
            content={
                "message": "Ya existe un resultado para este alumno",
                "existing_scan_id": existing["id"],
                "new_result": {
                    **result,
                    "grade_vigesimal": grade_vig,
                },
            },
        )

    scan_doc = {
        "id": str(uuid.uuid4()),
        "exam_id": exam_id,
        "student_id": student_id,
        "school_id": user["school_id"],
        "detected_answers": result["detected_answers"],
        "score": result["score"],
        "total": result["total"],
        "percentage": result["percentage"],
        "grade_vigesimal": grade_vig,
        "details": result["details"],
        "confidence": result["confidence"],
        "status": "corrected",
        "registered_to_gradebook": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"],
    }
    await db.omr_scans.insert_one(scan_doc)
    del scan_doc["_id"]

    return scan_doc


@router.put("/exams/{exam_id}/omr-scan/{scan_id}")
async def overwrite_omr_scan(
    exam_id: str,
    scan_id: str,
    image: UploadFile = File(...),
    student_id: str = Form(...),
    current_user=Depends(get_current_user),
):
    """Overwrite an existing OMR scan."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not exam or exam.get("type") != "omr":
        raise HTTPException(status_code=404, detail="Examen OMR no encontrado")

    answer_key = exam.get("answer_key")
    bubble_map = exam.get("bubble_map")
    if not answer_key or not bubble_map:
        raise HTTPException(status_code=400, detail="Faltan clave o hoja generada")

    image_bytes = await image.read()
    from services.omr_scanner import process_omr_scan as run_omr

    result = run_omr(image_bytes, bubble_map, answer_key, exam.get("options_per_question", 5))
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    grade_vig = round(result["percentage"] * 20 / 100)

    await db.omr_scans.update_one(
        {"id": scan_id},
        {"$set": {
            "detected_answers": result["detected_answers"],
            "score": result["score"],
            "total": result["total"],
            "percentage": result["percentage"],
            "grade_vigesimal": grade_vig,
            "details": result["details"],
            "confidence": result["confidence"],
            "status": "corrected",
            "registered_to_gradebook": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    updated = await db.omr_scans.find_one({"id": scan_id}, {"_id": 0})
    return updated


@router.get("/exams/{exam_id}/omr-results")
async def get_omr_results(exam_id: str, current_user=Depends(get_current_user)):
    """Get all OMR scan results for an exam."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    scans = await db.omr_scans.find(
        {"exam_id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    ).to_list(200)

    student_ids = list(set(s["student_id"] for s in scans))
    students = {}
    if student_ids:
        docs = await db.users.find(
            {"id": {"$in": student_ids}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1}
        ).to_list(200)
        students = {d["id"]: d for d in docs}

    results = []
    for s in scans:
        st = students.get(s["student_id"], {})
        results.append({
            "scan_id": s["id"],
            "student_id": s["student_id"],
            "student_name": f"{st.get('last_name', '')} {st.get('name', '')}".strip(),
            "score": s["score"],
            "total": s["total"],
            "percentage": s["percentage"],
            "grade_vigesimal": s.get("grade_vigesimal", 0),
            "confidence": s.get("confidence", 0),
            "registered_to_gradebook": s.get("registered_to_gradebook", False),
            "created_at": s.get("created_at", ""),
            "details": s.get("details", []),
        })

    results.sort(key=lambda x: x["student_name"])
    return results


async def _resolve_exam_linkage(exam: dict) -> dict:
    """Resolve human-readable linkage info for an exam: which Registro Auxiliar
    column + bimestre the exam is wired to, if any."""
    register_column = exam.get("register_column")
    school_id = exam.get("school_id")
    period_id = exam.get("period_id")
    info = {
        "linked": bool(register_column),
        "register_column": register_column,
        "register_column_label": None,
        "period_id": period_id,
        "period_name": None,
        "sync_status": exam.get("sync_status"),
    }
    if period_id and school_id:
        period_doc = await db.academic_periods.find_one(
            {"id": period_id, "school_id": school_id},
            {"_id": 0, "nombre": 1, "orden": 1},
        )
        if period_doc:
            info["period_name"] = period_doc.get("nombre") or (
                f"Bimestre {period_doc.get('orden')}" if period_doc.get("orden") else None
            )
    if register_column and school_id:
        label = None
        try:
            tpl = await get_active_template_for_school(db, school_id)
            for cri in (tpl or {}).get("criterios", []) or []:
                for sub in cri.get("subcolumnas", []) or []:
                    key = sub.get("field_key") or sub.get("id")
                    if str(key) == str(register_column):
                        label = f"{cri.get('nombre', '')} → {sub.get('label') or sub.get('id')}"
                        break
                if label:
                    break
            if not label:
                for col in (tpl or {}).get("columnas_finales", []) or []:
                    key = col.get("field_key") or col.get("id")
                    if str(key) == str(register_column):
                        label = col.get("label") or col.get("label_corto") or col.get("id")
                        break
        except Exception:
            pass
        info["register_column_label"] = label or register_column
    return info


@router.get("/exams/{exam_id}/results")
async def get_exam_results(exam_id: str, current_user=Depends(get_current_user)):
    """List all digital exam attempts (who took the exam + their grades) for the
    teacher/admin. Returns score, percentage and vigesimal grade per student."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if not is_admin_user(user) and user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Solo profesores o administradores pueden ver los resultados")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]},
        {"_id": 0, "title": 1, "total_points": 1, "min_score_percentage": 1,
         "register_column": 1, "period_id": 1, "section_id": 1, "subject_id": 1,
         "school_id": 1, "sync_status": 1}
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    attempts = await db.exam_attempts.find(
        {"exam_id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    ).to_list(5000)

    student_ids = list({a.get("student_id") for a in attempts if a.get("student_id")})
    students = {}
    if student_ids:
        docs = await db.users.find(
            {"id": {"$in": student_ids}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "profile_image": 1, "photo_url": 1}
        ).to_list(5000)
        students = {d["id"]: d for d in docs}

    results = []
    for a in attempts:
        st = students.get(a.get("student_id"), {})
        full_name = f"{st.get('last_name', '')} {st.get('name', '')}".strip() or a.get("student_name") or "—"
        pct = a.get("percentage")
        grade_vig = round(pct * 20 / 100) if pct is not None else None
        results.append({
            "attempt_id": a.get("id"),
            "student_id": a.get("student_id"),
            "student_name": full_name,
            "profile_image": st.get("profile_image") or st.get("photo_url"),
            "status": a.get("status"),
            "score": a.get("score"),
            "max_score": a.get("max_score") or exam.get("total_points"),
            "percentage": pct,
            "grade_vigesimal": grade_vig,
            "passed": a.get("passed"),
            "correct_count": a.get("correct_count"),
            "incorrect_count": a.get("incorrect_count"),
            "unanswered_count": a.get("unanswered_count"),
            "submitted_at": a.get("end_time") or a.get("start_time"),
            "time_used_seconds": a.get("time_used_seconds"),
        })

    # Completed first, then alphabetical by student name
    results.sort(key=lambda x: (x["status"] != "completed", x["student_name"]))

    linkage = await _resolve_exam_linkage(exam)
    return {
        "exam_title": exam.get("title"),
        "total_points": exam.get("total_points"),
        "min_score_percentage": exam.get("min_score_percentage", 60),
        "count": len(results),
        "results": results,
        **linkage,
    }

@router.get("/exams/{exam_id}/attempts/{attempt_id}/review")
async def get_exam_attempt_review(exam_id: str, attempt_id: str, current_user=Depends(get_current_user)):
    """Teacher/admin-only: full per-question review of a single student's attempt,
    showing the student's answer next to the correct answer. This is the data that
    used to be exposed to students (and that they abused to cheat) — now it lives
    behind a teacher/admin gate."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if not is_admin_user(user) and user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Solo profesores o administradores pueden ver las respuestas")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    attempt = await db.exam_attempts.find_one(
        {"id": attempt_id, "exam_id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")

    questions = await db.exam_questions.find(
        {"exam_id": exam_id}, {"_id": 0}
    ).sort("order", 1).to_list(200)

    graded_answers = attempt.get("graded_answers", {})
    questions_review = []
    for idx, q in enumerate(questions):
        q_id = q["id"]
        graded = graded_answers.get(q_id, {})

        correct_option_id = None
        if q.get("question_type") == "multiple_choice":
            for opt in q.get("options", []):
                if opt.get("is_correct"):
                    correct_option_id = opt.get("id")
                    break

        questions_review.append({
            "id": q_id,
            "number": idx + 1,
            "question_text": q.get("question_text"),
            "question_type": q.get("question_type"),
            "image_url": q.get("image_url"),
            "options": q.get("options", []),
            "correct_option_id": correct_option_id,
            "correct_answer": q.get("correct_answer"),
            "student_answer": graded.get("selected_option_id") or graded.get("text_answer"),
            "is_correct": graded.get("is_correct", False),
            "points_earned": graded.get("points_earned", 0),
            "points_possible": graded.get("points_possible", q.get("points", 1)),
        })

    pct = attempt.get("percentage")
    return {
        "attempt_id": attempt_id,
        "exam_id": exam_id,
        "exam_title": exam.get("title", ""),
        "student_name": attempt.get("student_name", ""),
        "status": attempt.get("status"),
        "score": attempt.get("score", 0),
        "max_score": attempt.get("max_score") or exam.get("total_points", 0),
        "percentage": pct,
        "grade_vigesimal": round(pct * 20 / 100) if pct is not None else None,
        "passed": attempt.get("passed", False),
        "correct_count": attempt.get("correct_count", 0),
        "incorrect_count": attempt.get("incorrect_count", 0),
        "unanswered_count": attempt.get("unanswered_count", 0),
        "questions": questions_review,
        "allow_evidence_upload": bool(exam.get("allow_evidence_upload")),
        "evidence_file": attempt.get("evidence_file"),
    }


# ── Evidence upload (digital exams) ─────────────────────────────────────────
EVIDENCE_ALLOWED_EXTENSIONS = {
    "jpg", "jpeg", "png", "webp", "gif", "heic", "heif",
    "pdf", "doc", "docx",
}
EVIDENCE_MAX_BYTES = 15 * 1024 * 1024  # 15 MB recommended cap


async def _ensure_exam_evidence_folder(service, materials_folder_id: str) -> str:
    """Find or create the 'Evidencias Examenes' subfolder under materials."""
    q = (
        f"name='Evidencias Examenes' and '{materials_folder_id}' in parents and "
        f"mimeType='application/vnd.google-apps.folder' and trashed=false"
    )
    results = service.files().list(q=q, fields="files(id)").execute()
    folders = results.get("files", [])
    if folders:
        return folders[0]["id"]
    folder = service.files().create(
        body={
            "name": "Evidencias Examenes",
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [materials_folder_id],
        },
        fields="id",
    ).execute()
    return folder.get("id")


@router.post("/exam-attempts/{attempt_id}/upload-evidence")
async def upload_exam_evidence(
    attempt_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Student uploads a single evidence file (image / pdf / word) for an
    in-progress attempt, when the exam has `allow_evidence_upload` enabled.
    Stored ONLY in the school's Google Drive ('Evidencias Examenes' folder)."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    attempt = await db.exam_attempts.find_one(
        {"id": attempt_id, "student_id": user["id"]}, {"_id": 0}
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    if attempt.get("status") != ExamAttemptStatus.in_progress.value:
        raise HTTPException(status_code=400, detail="El examen ya no está en progreso")

    exam = await db.online_exams.find_one({"id": attempt["exam_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    if not exam.get("allow_evidence_upload"):
        raise HTTPException(status_code=400, detail="Este examen no admite evidencia")

    f_name = file.filename or "evidencia"
    ext = f_name.split(".")[-1].lower() if "." in f_name else ""
    if ext not in EVIDENCE_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Formato no permitido. Usa imagen (JPG/PNG), PDF o Word.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    if len(content) > EVIDENCE_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail="El archivo supera el límite de 15 MB.",
        )

    school_id = user["school_id"]
    student_id = user["id"]
    att_id = str(uuid.uuid4())
    evidence = {
        "id": att_id,
        "file_name": f_name,
        "file_type": file.content_type,
        "file_size": len(content),
        "file_url": None,
        "drive_file_id": None,
        "storage_type": None,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }

    # Storage: Google Drive ONLY (no Cloudinary fallback — per requirement).
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not (school and school.get("google_drive_connected") and school.get("google_drive_materials_folder_id")):
        raise HTTPException(
            status_code=400,
            detail="El colegio aún no tiene Google Drive conectado. Pide a tu profesor o administrador que conecte Google Drive en Ajustes para poder subir tu evidencia.",
        )
    try:
        service = await get_drive_service(school_id)
        folder_id = await _ensure_exam_evidence_folder(
            service, school["google_drive_materials_folder_id"]
        )
        mime_type = MIME_TYPE_MAP.get(ext, file.content_type or "application/octet-stream")
        drive_file = service.files().create(
            body={"name": f"{student_id}_{att_id}_{f_name}", "parents": [folder_id]},
            media_body=MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type, resumable=True),
            fields="id, webViewLink",
        ).execute()
        evidence["drive_file_id"] = drive_file.get("id")
        evidence["file_url"] = drive_file.get("webViewLink")
        evidence["storage_type"] = "google_drive"
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EVIDENCE] Drive upload failed: {e}")
        raise HTTPException(status_code=500, detail="No se pudo subir la evidencia a Google Drive. Inténtalo de nuevo.")

    await db.exam_attempts.update_one(
        {"id": attempt_id}, {"$set": {"evidence_file": evidence}}
    )
    return {"evidence_file": evidence}


@router.get("/exams/{exam_id}/attempts/{attempt_id}/evidence")
async def download_exam_evidence(exam_id: str, attempt_id: str, current_user=Depends(get_current_user)):
    """Download/stream the evidence file of an attempt. Allowed to teacher/admin
    of the school or the owning student."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    attempt = await db.exam_attempts.find_one(
        {"id": attempt_id, "exam_id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")

    is_owner_student = (user.get("role") == "student" and attempt.get("student_id") == user["id"])
    if not (is_admin_user(user) or user.get("role") == "teacher" or is_owner_student):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta evidencia")

    ev = attempt.get("evidence_file")
    if not ev:
        raise HTTPException(status_code=404, detail="Sin evidencia")

    if ev.get("storage_type") == "cloudinary" and ev.get("file_url"):
        return RedirectResponse(url=ev["file_url"])

    drive_file_id = ev.get("drive_file_id")
    if not drive_file_id:
        raise HTTPException(status_code=404, detail="Archivo no disponible")

    file_name = ev.get("file_name", "evidencia")
    mime_type = ev.get("file_type") or "application/octet-stream"
    try:
        service = await get_drive_service(user["school_id"])

        def stream_from_drive():
            request = service.files().get_media(fileId=drive_file_id)
            buf = io.BytesIO()
            downloader = MediaIoBaseDownload(buf, request, chunksize=1024 * 1024)
            done = False
            while not done:
                _status, done = downloader.next_chunk()
                chunk = buf.getvalue()
                if chunk:
                    yield chunk
                    buf.seek(0)
                    buf.truncate(0)

        return StreamingResponse(
            stream_from_drive(),
            media_type=mime_type,
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )
    except Exception as e:
        logger.error(f"[EVIDENCE] Drive download failed: {e}")
        raise HTTPException(status_code=500, detail="Error al descargar la evidencia")





@router.post("/exams/{exam_id}/sync-register")
async def sync_exam_to_register_manual(exam_id: str, current_user=Depends(get_current_user)):
    """Force-push the completed attempts of a digital exam into the Registro
    Auxiliar. Use case: the auto-sync didn't reflect the grades (e.g. the subject
    had no section_id so the grades landed on section-less docs, or the exam was
    linked after students had already finished). Returns a clear diagnosis."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if not is_admin_user(user) and user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Solo profesores o administradores pueden registrar notas")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    linkage = await _resolve_exam_linkage(exam)
    register_column = exam.get("register_column")
    if not register_column:
        return {
            "ok": False,
            "reason": "not_linked",
            "synced": 0,
            "message": "Este examen no está vinculado a ninguna columna del Registro Auxiliar. Edítalo y selecciona la columna destino.",
            **linkage,
        }

    # Resolve storage field — if the column can't be matched against any
    # template the grade can't be written.
    school_id = exam.get("school_id")
    grade_field = COLUMN_FIELD_MAP.get(register_column)
    if not grade_field:
        field_type, _fk = await get_storage_field(db, register_column, school_id)
        if not field_type:
            return {
                "ok": False,
                "reason": "column_unknown",
                "synced": 0,
                "message": f"La columna '{linkage.get('register_column_label')}' ya no existe en la plantilla activa. Re-vincula el examen a una columna válida.",
                **linkage,
            }

    # Respect register lock.
    lock = await db.grade_locks.find_one({
        "school_id": school_id,
        "subject_id": exam.get("subject_id"),
        "period_id": exam.get("period_id"),
        **({"section_id": exam.get("section_id")} if exam.get("section_id") else {}),
    }, {"_id": 0})
    if lock and lock.get("locked"):
        return {
            "ok": False,
            "reason": "locked",
            "synced": 0,
            "message": "El Registro Auxiliar de este bimestre está cerrado. Reábrelo para poder registrar las notas.",
            **linkage,
        }

    completed = await db.exam_attempts.count_documents(
        {"exam_id": exam_id, "school_id": school_id, "status": "completed"}
    )
    if completed == 0:
        return {
            "ok": False,
            "reason": "no_attempts",
            "synced": 0,
            "message": "Aún no hay alumnos que hayan completado este examen.",
            **linkage,
        }

    await sync_to_register(db, exam_id, "exam", "update")

    return {
        "ok": True,
        "reason": "synced",
        "synced": completed,
        "message": f"Se registraron {completed} nota(s) en la columna '{linkage.get('register_column_label')}' ({linkage.get('period_name') or 'periodo activo'}). Si el Registro Auxiliar está abierto, actualiza la página para verlas.",
        **linkage,
    }



@router.post("/exams/{exam_id}/omr-register-grades")
async def register_omr_grades(exam_id: str, current_user=Depends(get_current_user)):
    """Register all OMR scan grades to the Registro Auxiliar."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    exam = await db.online_exams.find_one(
        {"id": exam_id, "school_id": user["school_id"]}, {"_id": 0}
    )
    if not exam or exam.get("type") != "omr":
        raise HTTPException(status_code=404, detail="Examen OMR no encontrado")

    register_column = exam.get("register_column")
    if not register_column:
        raise HTTPException(
            status_code=400,
            detail="Debe configurar el destino en el Registro Auxiliar (EM, EB, P1, P2, P3)",
        )

    scans = await db.omr_scans.find(
        {"exam_id": exam_id, "status": "corrected"}, {"_id": 0}
    ).to_list(200)

    if not scans:
        raise HTTPException(status_code=400, detail="No hay resultados de escaneo para registrar")

    registered = 0
    for scan in scans:
        attempt_doc = {
            "id": str(uuid.uuid4()),
            "exam_id": exam_id,
            "student_id": scan["student_id"],
            "school_id": exam["school_id"],
            "status": "completed",
            "score": scan["score"],
            "max_score": scan["total"],
            "percentage": scan["percentage"],
            "source": "omr_scan",
            "scan_id": scan["id"],
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }

        await db.exam_attempts.update_one(
            {"exam_id": exam_id, "student_id": scan["student_id"]},
            {"$set": attempt_doc},
            upsert=True,
        )

        await sync_single_student(db, exam_id, scan["student_id"], scan["percentage"])

        await db.omr_scans.update_one(
            {"id": scan["id"]},
            {"$set": {"registered_to_gradebook": True}},
        )
        registered += 1

    return {
        "registered": registered,
        "total": len(scans),
        "message": f"Se registraron {registered} notas en el Registro Auxiliar",
    }


@router.get("/exams/{exam_id}/omr-scan/{student_id}")
async def get_omr_scan_detail(
    exam_id: str,
    student_id: str,
    current_user=Depends(get_current_user),
):
    """Get full detail of a single OMR scan for a student."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    scan = await db.omr_scans.find_one(
        {"exam_id": exam_id, "student_id": student_id, "school_id": user["school_id"]},
        {"_id": 0},
    )
    if not scan:
        raise HTTPException(status_code=404, detail="No se encontro resultado de escaneo para este alumno")

    exam = await db.online_exams.find_one(
        {"id": exam_id}, {"_id": 0, "answer_key": 1, "title": 1, "options_per_question": 1}
    )
    student = await db.users.find_one(
        {"id": student_id}, {"_id": 0, "name": 1, "last_name": 1}
    )

    scan["answer_key"] = exam.get("answer_key", []) if exam else []
    scan["exam_title"] = exam.get("title", "") if exam else ""
    scan["options_per_question"] = exam.get("options_per_question", 5) if exam else 5
    scan.pop("image_url", None)
    if student:
        scan["student_name"] = f"{student.get('last_name', '')} {student.get('name', '')}".strip()
    else:
        scan["student_name"] = ""

    return scan


# ══════════════════════════════════════════════════════════════════════════════

# GOOGLE DRIVE INTEGRATION
# ══════════════════════════════════════════════════════════════════════════════

def create_google_drive_flow(redirect_uri: str, state: str = None):
    """Create Google OAuth flow for Drive API"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google Drive no está configurado en el servidor")
    
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_DRIVE_SCOPES,
        redirect_uri=redirect_uri
    )
    
    if state:
        flow.state = state
    
    return flow

async def get_drive_service(school_id: str):
    """Get authenticated Google Drive service for a school — with automatic token refresh"""
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")

    if not school.get("google_drive_connected"):
        raise HTTPException(status_code=401, detail={
            "code": "DRIVE_REAUTH_REQUIRED",
            "message": "Google Drive no esta conectado para este colegio"
        })

    encrypted_refresh_token = school.get("google_drive_refresh_token")
    if not encrypted_refresh_token:
        raise HTTPException(status_code=401, detail={
            "code": "DRIVE_REAUTH_REQUIRED",
            "message": "No se encontro el token de Google Drive. Reconecte su cuenta."
        })

    try:
        refresh_token = decrypt_token(encrypted_refresh_token)
    except Exception as e:
        logger.error(f"[GoogleDrive] Error decrypting token for school {school_id}: {e}")
        # Mark as disconnected
        await db.schools.update_one({"id": school_id}, {"$set": {"google_drive_connected": False}})
        raise HTTPException(status_code=401, detail={
            "code": "DRIVE_REAUTH_REQUIRED",
            "message": "Token de Google Drive invalido. Por favor reconecte su cuenta."
        })

    # Create credentials with refresh token
    from google.auth.transport.requests import Request as GoogleAuthRequest
    credentials = Credentials(
        token=school.get("google_drive_access_token"),
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=GOOGLE_DRIVE_SCOPES
    )

    # Force refresh if token is missing or expired
    try:
        if not credentials.token or not credentials.valid:
            logger.info(f"[GoogleDrive] Token expirado. Intentando refresh para school {school_id}...")
            credentials.refresh(GoogleAuthRequest())
            logger.info(f"[GoogleDrive] Token renovado exitosamente. Nuevo expiry: {credentials.expiry}")

            # Persist the new access token and expiry
            update_fields = {
                "google_drive_access_token": credentials.token,
                "google_drive_token_expiry": credentials.expiry.isoformat() if credentials.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            # If Google rotated the refresh token, persist the new one
            if credentials.refresh_token and credentials.refresh_token != refresh_token:
                update_fields["google_drive_refresh_token"] = encrypt_token(credentials.refresh_token)
                logger.info("[GoogleDrive] Refresh token rotado, guardando nuevo token")

            await db.schools.update_one({"id": school_id}, {"$set": update_fields})
    except Exception as refresh_err:
        logger.error(f"[GoogleDrive] Error al renovar token: {refresh_err}. Se requiere reautenticacion.")
        # Mark as disconnected
        await db.schools.update_one({"id": school_id}, {"$set": {"google_drive_connected": False}})
        raise HTTPException(status_code=401, detail={
            "code": "DRIVE_REAUTH_REQUIRED",
            "message": "Tu conexion con Google Drive ha expirado. Por favor, vuelve a conectarlo desde Ajustes."
        })

    try:
        service = build('drive', 'v3', credentials=credentials)
        return service
    except Exception as e:
        logger.error(f"[GoogleDrive] Error creating Drive service for school {school_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al conectar con Google Drive")

async def create_drive_folder(service, name: str, parent_id: str = None):
    """Create a folder in Google Drive"""
    file_metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]
    
    folder = service.files().create(body=file_metadata, fields='id').execute()
    return folder.get('id')

async def find_or_create_folder(service, name: str, parent_id: str = None):
    """Find existing folder or create new one"""
    query = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
    
    results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    files = results.get('files', [])
    
    if files:
        return files[0]['id']
    
    return await create_drive_folder(service, name, parent_id)

@router.get("/integrations/google-drive/status")
async def get_google_drive_status(current_user=Depends(get_current_user)):
    """Get Google Drive connection status for the school"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    # Check if Drive is properly configured on server
    server_configured = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    
    return {
        "server_configured": server_configured,
        "connected": school.get("google_drive_connected", False),
        "email": school.get("google_drive_email"),
        "connected_at": school.get("google_drive_connected_at"),
        "folder_id": school.get("google_drive_folder_id"),
        "materials_folder_id": school.get("google_drive_materials_folder_id")
    }

@router.get("/integrations/google-drive/auth")
async def initiate_google_drive_auth(
    request: Request,
    school_id: str = Query(...),
    current_user=Depends(get_current_user)
):
    """
    Initiate Google Drive OAuth flow.
    Only accessible by school owners (propietarios).
    """
    # Verify user is owner
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Check if user is owner/propietario
    if user.get("role") not in ["owner", "director"] and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Solo el propietario puede configurar Google Drive")
    
    # Verify school belongs to user
    if user.get("school_id") != school_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para este colegio")
    
    # Get school subdomain for redirect after callback
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "subdomain": 1})
    subdomain = school.get("subdomain", "") if school else ""
    
    # Use fixed redirect_uri from env var — MUST match Google Cloud Console exactly
    redirect_uri = GOOGLE_REDIRECT_URI
    
    logger.info(f"[GoogleDrive] connect - redirect_uri: {redirect_uri}")
    
    # Create the flow first to get Google's generated state
    flow = create_google_drive_flow(redirect_uri, None)
    
    authorization_url, generated_state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    # Now store the data using Google's generated state as the key
    await db.oauth_states.delete_many({"school_id": school_id})  # Clean old states for this school
    await db.oauth_states.insert_one({
        "state_id": generated_state,
        "school_id": school_id,
        "user_id": user['id'],
        "subdomain": subdomain,
        "redirect_uri": redirect_uri,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    })
    
    logger.info(f"Initiating Google Drive auth for school {school_id}, subdomain: {subdomain}, state: {generated_state[:20]}...")
    
    return {"authorization_url": authorization_url}

@router.get("/integrations/google-drive/callback")
async def google_drive_callback(
    request: Request,
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None)
):
    """
    Handle Google Drive OAuth callback.
    Creates folder structure and saves tokens.
    """
    # Retrieve state data from database
    state_data = None
    if state:
        state_data = await db.oauth_states.find_one({"state_id": state})
        if state_data:
            # Delete the used state
            await db.oauth_states.delete_one({"state_id": state})
    
    # Extract data from state
    if state_data:
        school_id = state_data.get("school_id")
        user_id = state_data.get("user_id")
        subdomain = state_data.get("subdomain", "")
        logger.info(f"OAuth callback - Retrieved state for school: {school_id}, subdomain: {subdomain}")
    else:
        school_id = None
        user_id = None
        subdomain = ""
        logger.error(f"OAuth callback - State not found in database: {state}")
    
    # ALWAYS use the same fixed redirect_uri as connect — MUST match exactly
    redirect_uri = GOOGLE_REDIRECT_URI
    logger.info(f"[GoogleDrive] callback - redirect_uri: {redirect_uri}")
    
    # Build the correct settings URL with subdomain — use BASE_URL for production
    base = BASE_URL.rstrip("/")
    if subdomain:
        settings_url = f"{base}/{subdomain}/settings"
    else:
        settings_url = f"{base}/settings"
    
    if error:
        logger.error(f"Google Drive OAuth error: {error}")
        return RedirectResponse(url=f"{settings_url}?error=oauth_denied")
    
    if not code or not state:
        return RedirectResponse(url=f"{settings_url}?error=invalid_callback")
    
    if not school_id or not user_id:
        logger.error("Invalid state in Google Drive callback - state not found or expired")
        return RedirectResponse(url=f"{settings_url}?error=invalid_state")
    
    try:
        # Exchange code for tokens
        flow = create_google_drive_flow(redirect_uri, state)
        flow.fetch_token(code=code)
        
        credentials = flow.credentials
        
        if not credentials.refresh_token:
            logger.error("No refresh token received from Google")
            return RedirectResponse(url=f"{settings_url}?error=no_refresh_token")
        
        # Build service to get user info
        service = build('drive', 'v3', credentials=credentials)
        
        # Get user info from the about endpoint
        about = service.about().get(fields="user").execute()
        user_email = about.get("user", {}).get("emailAddress", "")
        
        # Create folder structure: EduNet/Materiales
        logger.info(f"Creating folder structure for school {school_id}")
        
        # Find or create EduNet folder
        edunet_folder_id = await find_or_create_folder(service, "EduNet")
        
        # Find or create Materiales folder inside EduNet
        materials_folder_id = await find_or_create_folder(service, "Materiales", edunet_folder_id)
        
        # Encrypt refresh token before storing
        encrypted_refresh_token = encrypt_token(credentials.refresh_token)
        
        # Update school with Drive connection info
        await db.schools.update_one(
            {"id": school_id},
            {"$set": {
                "google_drive_connected": True,
                "google_drive_email": user_email,
                "google_drive_refresh_token": encrypted_refresh_token,
                "google_drive_folder_id": edunet_folder_id,
                "google_drive_materials_folder_id": materials_folder_id,
                "google_drive_connected_at": datetime.now(timezone.utc).isoformat(),
                "google_drive_connected_by": user_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Google Drive connected successfully for school {school_id}, email: {user_email}")
        
        # Redirect to settings with success
        return RedirectResponse(url=f"{settings_url}?success=google_drive_connected")
        
    except Exception as e:
        logger.error(f"Error in Google Drive callback: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return RedirectResponse(url=f"{settings_url}?error=connection_failed")

@router.post("/integrations/google-drive/disconnect")
async def disconnect_google_drive(current_user=Depends(get_current_user)):
    """
    Disconnect Google Drive from the school.
    Only accessible by school owners (propietarios).
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Check if user is owner/propietario
    if user.get("role") not in ["owner", "director"] and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Solo el propietario puede desconectar Google Drive")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    # Clear Drive connection (but don't delete files in Drive)
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {
            "google_drive_connected": False,
            "google_drive_email": None,
            "google_drive_refresh_token": None,
            "google_drive_folder_id": None,
            "google_drive_materials_folder_id": None,
            "google_drive_disconnected_at": datetime.now(timezone.utc).isoformat(),
            "google_drive_disconnected_by": user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Google Drive disconnected for school {school_id}")
    
    return {"message": "Google Drive desconectado correctamente"}

@router.post("/materials/upload")
async def upload_material_to_drive(
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    current_user=Depends(get_current_user)
):
    """Upload a material file to Google Drive — with token refresh retry"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")

    # Check if Drive is connected
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school or not school.get("google_drive_connected"):
        raise HTTPException(status_code=401, detail={
            "code": "DRIVE_REAUTH_REQUIRED",
            "message": "Debes conectar Google Drive desde Ajustes antes de subir materiales."
        })

    # Validate file extension
    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if file_ext not in GOOGLE_DRIVE_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Extensiones validas: {', '.join(GOOGLE_DRIVE_ALLOWED_EXTENSIONS)}"
        )

    # Read file content once
    file_content = await file.read()
    mime_type = MIME_TYPE_MAP.get(file_ext, "application/octet-stream")
    materials_folder_id = school.get("google_drive_materials_folder_id")
    if not materials_folder_id:
        raise HTTPException(status_code=400, detail="Carpeta de materiales no encontrada en Drive")

    # Helper to perform the actual upload
    async def _do_upload(svc):
        file_metadata = {'name': file.filename, 'parents': [materials_folder_id]}
        media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type, resumable=True)
        drive_file = svc.files().create(
            body=file_metadata, media_body=media,
            fields='id, name, mimeType, size, webContentLink'
        ).execute()
        return drive_file

    # Attempt upload with 1 retry on auth failure
    drive_file = None
    for attempt in range(2):
        try:
            service = await get_drive_service(school_id)
            drive_file = await _do_upload(service)
            logger.info(f"[GoogleDrive] Subida exitosa: {file.filename} -> {drive_file.get('id')}")
            break
        except HTTPException as he:
            # If it's a DRIVE_REAUTH_REQUIRED, propagate immediately (no retry)
            detail = he.detail
            if isinstance(detail, dict) and detail.get("code") == "DRIVE_REAUTH_REQUIRED":
                raise
            # Other HTTP exceptions — propagate
            raise
        except Exception as e:
            error_str = str(e).lower()
            if attempt == 0 and ("invalid_grant" in error_str or "401" in error_str or "token" in error_str):
                logger.warning(f"[GoogleDrive] Error en subida: {e}. Reintentando con token renovado...")
                # Force re-fetch of service (which triggers refresh)
                # Clear the cached access token to force a fresh refresh
                await db.schools.update_one(
                    {"id": school_id},
                    {"$unset": {"google_drive_access_token": ""}}
                )
                continue
            else:
                logger.error(f"[GoogleDrive] Error en subida (intento {attempt+1}): {e}")
                raise HTTPException(status_code=500, detail=f"Error al subir archivo a Google Drive: {str(e)}")

    if not drive_file:
        raise HTTPException(status_code=500, detail="No se pudo subir el archivo despues de reintentar")

    # Create material record in database
    material_id = str(uuid.uuid4())
    material_doc = {
        "id": material_id,
        "school_id": school_id,
        "subject_id": subject_id,
        "title": title,
        "description": description,
        "type": "material",
        "post_type": "material",
        "drive_file_id": drive_file.get('id'),
        "drive_file_name": drive_file.get('name'),
        "mime_type": mime_type,
        "file_extension": file_ext,
        "file_size": len(file_content),
        "storage_type": "google_drive",
        "author_id": user["id"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    await db.course_posts.insert_one(material_doc)

    logger.info(f"[GoogleDrive] Material guardado en DB: {file.filename} id={material_id}")

    return {
        "id": material_id,
        "title": title,
        "drive_file_id": drive_file.get('id'),
        "drive_file_name": drive_file.get('name'),
        "file_size": len(file_content),
        "message": "Material subido correctamente a Google Drive"
    }


@router.post("/files/upload-to-drive")
async def upload_file_to_drive_only(
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    current_user=Depends(get_current_user)
):
    """Upload a file to Google Drive WITHOUT creating a DB record — with token refresh retry"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")

    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school or not school.get("google_drive_connected"):
        raise HTTPException(status_code=401, detail={
            "code": "DRIVE_REAUTH_REQUIRED",
            "message": "Debes conectar Google Drive desde Ajustes antes de subir archivos."
        })

    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if file_ext not in GOOGLE_DRIVE_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Extensiones validas: {', '.join(GOOGLE_DRIVE_ALLOWED_EXTENSIONS)}"
        )

    file_content = await file.read()
    mime_type = MIME_TYPE_MAP.get(file_ext, "application/octet-stream")
    materials_folder_id = school.get("google_drive_materials_folder_id")
    if not materials_folder_id:
        raise HTTPException(status_code=400, detail="Carpeta de materiales no encontrada en Drive")

    async def _do_upload(svc):
        file_metadata = {'name': file.filename, 'parents': [materials_folder_id]}
        media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type, resumable=True)
        return svc.files().create(body=file_metadata, media_body=media, fields='id, name, mimeType, size').execute()

    drive_file = None
    for attempt in range(2):
        try:
            service = await get_drive_service(school_id)
            drive_file = await _do_upload(service)
            logger.info(f"[GoogleDrive] Subida exitosa (sin post): {file.filename} -> {drive_file.get('id')}")
            break
        except HTTPException as he:
            detail = he.detail
            if isinstance(detail, dict) and detail.get("code") == "DRIVE_REAUTH_REQUIRED":
                raise
            raise
        except Exception as e:
            error_str = str(e).lower()
            if attempt == 0 and ("invalid_grant" in error_str or "401" in error_str or "token" in error_str):
                logger.warning(f"[GoogleDrive] Error en subida: {e}. Reintentando con token renovado...")
                await db.schools.update_one({"id": school_id}, {"$unset": {"google_drive_access_token": ""}})
                continue
            else:
                logger.error(f"[GoogleDrive] Error en subida (intento {attempt+1}): {e}")
                raise HTTPException(status_code=500, detail=f"Error al subir archivo a Google Drive: {str(e)}")

    if not drive_file:
        raise HTTPException(status_code=500, detail="No se pudo subir el archivo despues de reintentar")

    return {
        "drive_file_id": drive_file.get('id'),
        "drive_file_name": drive_file.get('name'),
        "mime_type": mime_type,
        "file_size": len(file_content),
        "file_extension": file_ext,
        "message": "Archivo subido correctamente a Google Drive"
    }


@router.get("/materials/download/{material_id}")
async def download_material_from_drive(
    material_id: str,
    current_user=Depends(get_current_user)
):
    """
    Download a file from Google Drive.
    Works for any post type (material, task, forum, board) that has a drive_file_id.
    Streams the file through the backend - student never sees Drive link.
    Uses true streaming for immediate response.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    # Get post from database - look for any post with drive_file_id
    # This works for materials, tasks, forum posts, and board posts
    post = await db.course_posts.find_one({
        "id": material_id,
        "school_id": school_id,
        "drive_file_id": {"$exists": True, "$ne": None}
    }, {"_id": 0})
    
    if not post:
        # Also try to find by storage_type for backwards compatibility
        post = await db.course_posts.find_one({
            "id": material_id,
            "school_id": school_id,
            "storage_type": "google_drive"
        }, {"_id": 0})
    
    if not post:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    drive_file_id = post.get("drive_file_id")
    if not drive_file_id:
        raise HTTPException(status_code=400, detail="Archivo no encontrado en Drive")
    
    # Validate student access - check if they belong to the course
    if user.get("role") == "student":
        # Get student's assigned subjects via section_id (source of truth)
        section_subjects = await db.subjects.find({
            "school_id": school_id,
            "section_id": user.get("seccion_id"),
            "status": "active"
        }, {"_id": 0, "id": 1}).to_list(100)
        
        subject_ids = [s["id"] for s in section_subjects]
        if post.get("subject_id") not in subject_ids:
            raise HTTPException(status_code=403, detail="No tienes acceso a este archivo")
    
    # Get file metadata
    file_name = post.get("drive_file_name", post.get("file_name", "archivo"))
    mime_type = post.get("mime_type", post.get("file_type", "application/octet-stream"))
    file_size = post.get("file_size")
    
    try:
        # Get Drive service
        service = await get_drive_service(school_id)
        
        logger.info(f"Starting download stream for: {file_name} by user {user['id']}")
        
        # Create a generator that streams directly from Google Drive
        def stream_from_drive():
            """Generator that streams file chunks from Google Drive"""
            request = service.files().get_media(fileId=drive_file_id)
            
            # Use chunked download for streaming
            file_buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(file_buffer, request, chunksize=1024*1024)  # 1MB chunks
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
                # Yield the chunk that was just downloaded
                chunk = file_buffer.getvalue()
                if chunk:
                    yield chunk
                    file_buffer.seek(0)
                    file_buffer.truncate(0)
        
        # Build headers
        headers_dict = {
            "Content-Disposition": f"attachment; filename=\"{file_name}\"",
            "Cache-Control": "no-cache",
        }
        
        # Add content-length if known (helps browser show progress)
        if file_size:
            headers_dict["Content-Length"] = str(file_size)
        
        # Return streaming response immediately
        return StreamingResponse(
            stream_from_drive(),
            media_type=mime_type,
            headers=headers_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading from Drive: {e}")
        raise HTTPException(status_code=500, detail="Error al descargar archivo de Google Drive")

@router.get("/materials/drive-check")
async def check_drive_for_materials(
    subject_id: str = Query(...),
    current_user=Depends(get_current_user)
):
    """
    Check if Google Drive is connected and can be used for materials.
    Returns status and message for UI display.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    is_connected = school.get("google_drive_connected", False)
    
    return {
        "connected": is_connected,
        "email": school.get("google_drive_email") if is_connected else None,
        "can_upload": is_connected,
        "message": "Google Drive conectado" if is_connected else "Debes conectar Google Drive desde Ajustes para subir materiales"
    }


# ══════════════════════════════════════════════════════════════════════════════

# EXAM ATTEMPTS - STUDENT EXAM TAKING SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

class ExamAttemptStatus(str, Enum):
    in_progress = "in_progress"
    completed = "completed"
    expired = "expired"
    abandoned = "abandoned"

class StartExamResponse(BaseModel):
    attempt_id: str
    exam_id: str
    remaining_seconds: int
    total_questions: int

class SaveAnswerRequest(BaseModel):
    question_id: str
    selected_option_id: Optional[str] = None
    text_answer: Optional[str] = None

class SubmitExamRequest(BaseModel):
    answers: Optional[List[dict]] = None  # Optional - for bulk submission


@router.get("/exams/{exam_id}/debug")
async def debug_exam_data(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """
    DEBUG ENDPOINT - Temporary endpoint to check exam data.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get exam with all fields
    exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0})
    
    if not exam:
        return {"error": "Examen no encontrado", "exam_id": exam_id}
    
    # Get questions count
    questions_count = await db.exam_questions.count_documents({"exam_id": exam_id})
    
    duration_raw = exam.get("duration_minutes")
    
    return {
        "exam_id": exam_id,
        "title": exam.get("title"),
        "school_id": exam.get("school_id"),
        "user_school_id": user.get("school_id"),
        "school_match": exam.get("school_id") == user.get("school_id"),
        "status": exam.get("status"),
        "duration_minutes": {
            "raw_value": duration_raw,
            "type": type(duration_raw).__name__,
            "is_none": duration_raw is None,
            "is_empty_string": duration_raw == "",
            "bool_value": bool(duration_raw)
        },
        "start_datetime": exam.get("start_datetime"),
        "end_datetime": exam.get("end_datetime"),
        "questions_count": questions_count,
        "all_keys": list(exam.keys())
    }


@router.get("/exams/{exam_id}/info")
async def get_exam_info_for_student(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Get basic exam info (title, subject) for showing on rules screen before starting."""
    try:
        exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0, "title": 1, "subject_id": 1, "duration_minutes": 1, "status": 1})
        if not exam:
            raise HTTPException(status_code=404, detail="Examen no encontrado")
        subject = await db.subjects.find_one({"id": exam.get("subject_id")}, {"_id": 0, "name": 1, "color": 1})
        questions_count = await db.exam_questions.count_documents({"exam_id": exam_id})
        return {
            "title": exam.get("title", ""),
            "subject_name": subject.get("name", "") if subject else "",
            "subject_color": subject.get("color", "#6366f1") if subject else "#6366f1",
            "duration_minutes": exam.get("duration_minutes"),
            "questions_count": questions_count,
            "status": exam.get("status", "draft")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/exams/{exam_id}/start")
async def start_exam_attempt(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """
    Start an exam attempt. Creates a new attempt record.
    Returns attempt_id and remaining time.
    """
    try:
        user = await resolve_user_from_token(current_user)
        if not user:
            raise HTTPException(status_code=403, detail="Usuario no encontrado")
        
        # Only students can take exams
        if user.get("role") != "student":
            raise HTTPException(status_code=403, detail="Solo los estudiantes pueden rendir exámenes")
        
        # Get exam
        exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
        if not exam:
            raise HTTPException(status_code=404, detail="Examen no encontrado")
        
        # DEBUG: Log exam data
        duration_raw = exam.get("duration_minutes")
        logger.info(f"EXAM DEBUG - ID: {exam_id}")
        logger.info(f"EXAM DEBUG - duration_minutes raw value: {duration_raw}")
        logger.info(f"EXAM DEBUG - duration_minutes type: {type(duration_raw)}")
        logger.info(f"EXAM DEBUG - exam keys: {list(exam.keys())}")
        
        # Robust conversion to int - handle string, None, empty string, etc.
        duration_minutes = 0
        try:
            if duration_raw is not None and duration_raw != "" and duration_raw != "null":
                duration_minutes = int(float(str(duration_raw)))
        except (TypeError, ValueError) as e:
            logger.warning(f"EXAM DEBUG - Could not convert duration: {e}")
            duration_minutes = 0
        
        logger.info(f"EXAM DEBUG - duration_minutes after conversion: {duration_minutes}")
        
        if duration_minutes <= 0:
            raise HTTPException(
                status_code=400, 
                detail=f"El examen no tiene duración configurada (valor recibido: {duration_raw}, tipo: {type(duration_raw).__name__})"
            )
        
        # Validate exam is published
        if exam.get("status") != "published":
            raise HTTPException(status_code=400, detail="Este examen no está disponible")
        
        # Validate date range
        now = datetime.now(timezone.utc)
        
        start_datetime_str = exam.get("start_datetime")
        end_datetime_str = exam.get("end_datetime")
        
        if not start_datetime_str or not end_datetime_str:
            raise HTTPException(status_code=400, detail="El examen no tiene fechas configuradas")
        
        start_dt = datetime.fromisoformat(start_datetime_str.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_datetime_str.replace("Z", "+00:00"))
        
        if now < start_dt:
            raise HTTPException(status_code=400, detail="El examen aún no está disponible")
        if now > end_dt:
            raise HTTPException(status_code=400, detail="El tiempo para este examen ha finalizado")
        
        # Check for existing attempt
        existing_attempt = await db.exam_attempts.find_one({
            "exam_id": exam_id,
            "student_id": user["id"]
        }, {"_id": 0})
        
        if existing_attempt:
            # Check status
            if existing_attempt["status"] == ExamAttemptStatus.completed.value:
                raise HTTPException(status_code=400, detail="Ya has completado este examen")
            if existing_attempt["status"] == ExamAttemptStatus.expired.value:
                raise HTTPException(status_code=400, detail="Tu tiempo para este examen ha expirado")
            
            # If in_progress, return existing attempt
            if existing_attempt["status"] == ExamAttemptStatus.in_progress.value:
                # Calculate remaining time
                start_time = datetime.fromisoformat(existing_attempt["start_time"].replace("Z", "+00:00"))
                elapsed = (now - start_time).total_seconds()
                duration_seconds = duration_minutes * 60
                
                # Calculate time until exam window closes
                time_until_end = (end_dt - now).total_seconds()
                
                # Remaining time is the minimum of: (duration - elapsed) OR time until window closes
                remaining_by_duration = duration_seconds - elapsed
                remaining = max(0, min(remaining_by_duration, time_until_end))
                
                # Check if time has run out
                if remaining <= 0:
                    # Auto-expire the attempt
                    await db.exam_attempts.update_one(
                        {"id": existing_attempt["id"]},
                        {"$set": {"status": ExamAttemptStatus.expired.value, "end_time": now.isoformat()}}
                    )
                    raise HTTPException(status_code=400, detail="Tu tiempo para este examen ha expirado")
                
                # Get questions count
                questions_count = await db.exam_questions.count_documents({"exam_id": exam_id})
                
                return {
                    "attempt_id": existing_attempt["id"],
                    "exam_id": exam_id,
                    "remaining_seconds": int(remaining),
                    "total_questions": questions_count,
                    "resumed": True
                }
        
        # Create new attempt
        attempt_id = str(uuid.uuid4())
        questions_count = await db.exam_questions.count_documents({"exam_id": exam_id})
        
        if questions_count == 0:
            raise HTTPException(status_code=400, detail="Este examen no tiene preguntas")
        
        attempt = {
            "id": attempt_id,
            "exam_id": exam_id,
            "student_id": user["id"],
            "student_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
            "school_id": user["school_id"],
            "start_time": now.isoformat(),
            "end_time": None,
            "status": ExamAttemptStatus.in_progress.value,
            "score": None,
            "max_score": None,
            "percentage": None,
            "passed": None,
            "answers": {},  # Dict of question_id -> answer
            "tab_changes": 0,
            "created_at": now.isoformat()
        }
        
        await db.exam_attempts.insert_one(attempt)
        
        # Calculate remaining time as minimum of: duration OR time until window closes
        duration_seconds = duration_minutes * 60
        time_until_end = (end_dt - now).total_seconds()
        remaining_seconds = int(min(duration_seconds, time_until_end))
        
        return {
            "attempt_id": attempt_id,
            "exam_id": exam_id,
            "remaining_seconds": remaining_seconds,
            "total_questions": questions_count,
            "resumed": False
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting exam attempt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al iniciar el examen: {str(e)}")


@router.get("/exams/{exam_id}/questions-for-student")
async def get_exam_questions_for_student(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get exam questions for a student taking the exam.
    Does NOT include correct answers.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Verify student has an active attempt
    attempt = await db.exam_attempts.find_one({
        "exam_id": exam_id,
        "student_id": user["id"],
        "status": ExamAttemptStatus.in_progress.value
    }, {"_id": 0})
    
    if not attempt:
        raise HTTPException(status_code=400, detail="No tienes un intento activo para este examen")
    
    # Get questions without correct_answer field
    questions = await db.exam_questions.find(
        {"exam_id": exam_id},
        {"_id": 0, "correct_answer": 0, "correct_option_id": 0}  # Exclude answers
    ).sort("order", 1).to_list(200)
    
    # Get exam for subject info
    exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0, "title": 1, "subject_id": 1, "duration_minutes": 1, "allow_evidence_upload": 1})
    subject = await db.subjects.find_one({"id": exam.get("subject_id")}, {"_id": 0, "name": 1, "color": 1}) if exam else None
    
    # Get previously saved answers
    saved_answers = attempt.get("answers", {})
    
    return {
        "exam_id": exam_id,
        "exam_title": exam.get("title", "") if exam else "",
        "subject_name": subject.get("name", "") if subject else "",
        "subject_color": subject.get("color", "#6366F1") if subject else "#6366F1",
        "questions": questions,
        "saved_answers": saved_answers,
        "total_questions": len(questions),
        "allow_evidence_upload": bool(exam.get("allow_evidence_upload")) if exam else False,
        "evidence_file": attempt.get("evidence_file"),
    }


@router.post("/exam-attempts/{attempt_id}/save-answer")
async def save_exam_answer(
    attempt_id: str,
    data: SaveAnswerRequest,
    current_user = Depends(get_current_user)
):
    """
    Save a single answer during exam. Auto-save functionality.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get attempt
    attempt = await db.exam_attempts.find_one({
        "id": attempt_id,
        "student_id": user["id"]
    }, {"_id": 0})
    
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    
    if attempt["status"] != ExamAttemptStatus.in_progress.value:
        raise HTTPException(status_code=400, detail="Este intento ya no está activo")
    
    # Check if time has expired
    exam = await db.online_exams.find_one({"id": attempt["exam_id"]}, {"_id": 0})
    if exam:
        start_time = datetime.fromisoformat(attempt["start_time"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        elapsed = (now - start_time).total_seconds()
        
        # Safely get duration_minutes
        duration_minutes = exam.get("duration_minutes")
        try:
            if duration_minutes:
                duration_seconds = int(float(str(duration_minutes))) * 60
            else:
                duration_seconds = 60 * 60  # Default 60 minutes if not set
        except (TypeError, ValueError):
            duration_seconds = 60 * 60
        
        if elapsed > duration_seconds:
            # Auto-expire
            await db.exam_attempts.update_one(
                {"id": attempt_id},
                {"$set": {"status": ExamAttemptStatus.expired.value, "end_time": now.isoformat()}}
            )
            raise HTTPException(status_code=400, detail="El tiempo ha expirado")
    
    # Save answer
    answer_data = {
        "selected_option_id": data.selected_option_id,
        "text_answer": data.text_answer,
        "saved_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.exam_attempts.update_one(
        {"id": attempt_id},
        {"$set": {f"answers.{data.question_id}": answer_data}}
    )
    
    return {"message": "Respuesta guardada", "question_id": data.question_id}


@router.post("/exam-attempts/{attempt_id}/report-tab-change")
async def report_tab_change(
    attempt_id: str,
    current_user = Depends(get_current_user)
):
    """
    Report when student changes browser tab. Anti-cheat measure.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    attempt = await db.exam_attempts.find_one({
        "id": attempt_id,
        "student_id": user["id"],
        "status": ExamAttemptStatus.in_progress.value
    }, {"_id": 0})
    
    if not attempt:
        return {"message": "Intento no encontrado o ya finalizado", "force_submit": False}
    
    new_count = attempt.get("tab_changes", 0) + 1
    
    await db.exam_attempts.update_one(
        {"id": attempt_id},
        {"$set": {"tab_changes": new_count}}
    )
    
    # If 3 or more tab changes, force submit
    force_submit = new_count >= 3
    
    return {
        "tab_changes": new_count,
        "force_submit": force_submit,
        "warning": f"Advertencia: Has cambiado de pestaña {new_count} vez(es). Al llegar a 3, el examen se enviará automáticamente." if new_count < 3 else "Se ha excedido el límite de cambios de pestaña."
    }


@router.post("/exam-attempts/{attempt_id}/submit")
async def submit_exam_attempt(
    attempt_id: str,
    data: Optional[SubmitExamRequest] = None,
    current_user = Depends(get_current_user)
):
    """
    Submit exam and auto-grade.
    Can be called manually by student or automatically when time runs out.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get attempt
    attempt = await db.exam_attempts.find_one({
        "id": attempt_id,
        "student_id": user["id"]
    }, {"_id": 0})
    
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    
    # Allow submission even if expired (for auto-submit on timeout)
    if attempt["status"] == ExamAttemptStatus.completed.value:
        raise HTTPException(status_code=400, detail="Este examen ya fue enviado")
    
    # Get exam
    exam = await db.online_exams.find_one({"id": attempt["exam_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    # Evidence gate — if the teacher enabled evidence upload, the student MUST
    # have attached their evidence file before the exam can be submitted.
    if exam.get("allow_evidence_upload") and not attempt.get("evidence_file"):
        raise HTTPException(
            status_code=400,
            detail="Debes adjuntar tu evidencia antes de enviar el examen.",
        )

    # Get all questions with answers
    questions = await db.exam_questions.find(
        {"exam_id": attempt["exam_id"]},
        {"_id": 0}
    ).to_list(200)
    
    # Calculate score
    total_points = 0
    earned_points = 0
    correct_count = 0
    incorrect_count = 0
    unanswered_count = 0
    
    answers = attempt.get("answers", {})
    graded_answers = {}
    
    for question in questions:
        q_id = question["id"]
        q_points = question.get("points", 1)
        total_points += q_points
        
        student_answer = answers.get(q_id, {})
        selected_option = student_answer.get("selected_option_id")
        text_answer = student_answer.get("text_answer")
        
        is_correct = False
        
        if question["question_type"] == "multiple_choice":
            # Find the correct option from the options array
            correct_option_id = None
            options = question.get("options", [])
            for opt in options:
                if opt.get("is_correct"):
                    correct_option_id = opt.get("id")
                    break
            
            if selected_option and correct_option_id and selected_option == correct_option_id:
                is_correct = True
                earned_points += q_points
                correct_count += 1
            elif selected_option:
                incorrect_count += 1
            else:
                unanswered_count += 1
        
        elif question["question_type"] == "true_false":
            correct_answer = question.get("correct_answer")
            if selected_option:
                # selected_option will be "true" or "false"
                if selected_option.lower() == str(correct_answer).lower():
                    is_correct = True
                    earned_points += q_points
                    correct_count += 1
                else:
                    incorrect_count += 1
            else:
                unanswered_count += 1
        
        elif question["question_type"] == "fill_blanks":
            correct_answer = question.get("correct_answer", "").lower().strip()
            if text_answer and text_answer.lower().strip() == correct_answer:
                is_correct = True
                earned_points += q_points
                correct_count += 1
            elif text_answer:
                incorrect_count += 1
            else:
                unanswered_count += 1
        
        graded_answers[q_id] = {
            "selected_option_id": selected_option,
            "text_answer": text_answer,
            "is_correct": is_correct,
            "points_earned": q_points if is_correct else 0,
            "points_possible": q_points
        }
    
    # Calculate percentage and pass/fail
    percentage = (earned_points / total_points * 100) if total_points > 0 else 0
    min_percentage = exam.get("min_score_percentage", 60)
    passed = percentage >= min_percentage
    
    now = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(attempt["start_time"].replace("Z", "+00:00"))
    time_used_seconds = int((now - start_time).total_seconds())
    
    # Update attempt
    await db.exam_attempts.update_one(
        {"id": attempt_id},
        {"$set": {
            "status": ExamAttemptStatus.completed.value,
            "end_time": now.isoformat(),
            "score": earned_points,
            "max_score": total_points,
            "percentage": round(percentage, 2),
            "passed": passed,
            "correct_count": correct_count,
            "incorrect_count": incorrect_count,
            "unanswered_count": unanswered_count,
            "graded_answers": graded_answers,
            "time_used_seconds": time_used_seconds
        }}
    )

    # Sync to register if exam has linkage (only if linked)
    if exam.get("register_column"):
        try:
            await sync_single_student(db, exam["id"], attempt["student_id"], round(percentage, 2))
        except Exception as e:
            logger.error(f"[SYNC] Failed to sync student grade for attempt {attempt_id}: {e}")
    
    return {
        "message": "Examen enviado exitosamente",
        "attempt_id": attempt_id,
        "score": earned_points,
        "max_score": total_points,
        "percentage": round(percentage, 2),
        "passed": passed,
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "unanswered_count": unanswered_count,
        "time_used_seconds": time_used_seconds,
        "min_percentage": min_percentage
    }


@router.get("/exam-attempts/{attempt_id}/result")
async def get_exam_result(
    attempt_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get exam result after completion.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get attempt
    attempt = await db.exam_attempts.find_one({
        "id": attempt_id,
        "student_id": user["id"]
    }, {"_id": 0})
    
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    
    if attempt["status"] not in [ExamAttemptStatus.completed.value, ExamAttemptStatus.expired.value]:
        raise HTTPException(status_code=400, detail="El examen aún no ha sido completado")
    
    # Get exam info
    exam = await db.online_exams.find_one({"id": attempt["exam_id"]}, {"_id": 0})
    
    # Get subject info
    subject = None
    if exam:
        subject = await db.subjects.find_one({"id": exam.get("subject_id")}, {"_id": 0, "name": 1, "color": 1})
    
    # Get questions for review.
    # ANTI-CHEAT (Jun 2026): students must NOT see the question text, the options,
    # nor the correct answer when reviewing their finished exam — they were sharing
    # the correct answers with classmates. We only expose, per question, whether they
    # got it right/wrong and the points earned. The full review (with correct answers)
    # is available only to teachers/admins via /exams/{exam_id}/attempts/{id}/review.
    questions = await db.exam_questions.find(
        {"exam_id": attempt["exam_id"]},
        {"_id": 0, "id": 1, "order": 1, "points": 1}
    ).sort("order", 1).to_list(200)
    
    # Build minimal result (no question content, no correct answers)
    graded_answers = attempt.get("graded_answers", {})
    questions_review = []
    
    for idx, q in enumerate(questions):
        q_id = q["id"]
        graded = graded_answers.get(q_id, {})
        questions_review.append({
            "id": q_id,
            "number": idx + 1,
            "is_correct": graded.get("is_correct", False),
            "points_earned": graded.get("points_earned", 0),
            "points_possible": graded.get("points_possible", q.get("points", 1))
        })
    
    return {
        "attempt_id": attempt_id,
        "exam_id": attempt["exam_id"],
        "exam_title": exam.get("title", "") if exam else "",
        "subject_name": subject.get("name", "") if subject else "",
        "subject_color": subject.get("color", "#6366F1") if subject else "#6366F1",
        "student_name": attempt.get("student_name", ""),
        "start_time": attempt.get("start_time"),
        "end_time": attempt.get("end_time"),
        "time_used_seconds": attempt.get("time_used_seconds", 0),
        "score": attempt.get("score", 0),
        "max_score": attempt.get("max_score", 0),
        "percentage": attempt.get("percentage", 0),
        "passed": attempt.get("passed", False),
        "min_percentage": exam.get("min_score_percentage", 60) if exam else 60,
        "correct_count": attempt.get("correct_count", 0),
        "incorrect_count": attempt.get("incorrect_count", 0),
        "unanswered_count": attempt.get("unanswered_count", 0),
        "questions": questions_review,
        "tab_changes": attempt.get("tab_changes", 0)
    }


@router.get("/exams/{exam_id}/my-attempt")
async def get_my_exam_attempt(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """
    Check if student has an attempt for this exam.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    attempt = await db.exam_attempts.find_one({
        "exam_id": exam_id,
        "student_id": user["id"]
    }, {"_id": 0})
    
    if not attempt:
        return {"has_attempt": False, "attempt": None}
    
    return {
        "has_attempt": True,
        "attempt": {
            "id": attempt["id"],
            "status": attempt["status"],
            "score": attempt.get("score"),
            "max_score": attempt.get("max_score"),
            "percentage": attempt.get("percentage"),
            "passed": attempt.get("passed"),
            "start_time": attempt.get("start_time"),
            "end_time": attempt.get("end_time")
        }
    }


# ══════════════════════════════════════════════════════════════════════════════

# EXAM SCHEDULES (Horario de Exámenes)
# ══════════════════════════════════════════════════════════════════════════════

class ExamScheduleCreate(BaseModel):
    grade_id: str  # OBLIGATORIO
    section_id: str  # OBLIGATORIO
    subject_id: str
    teacher_id: str
    classroom_id: Optional[str] = None
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    type: str  # "parcial", "final", "práctica", "quiz"
    title: str
    description: Optional[str] = None

class ExamScheduleUpdate(BaseModel):
    subject_id: Optional[str] = None
    teacher_id: Optional[str] = None
    classroom_id: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None

# Exam type colors and labels
EXAM_TYPES = {
    "parcial": {"label": "Parcial", "color": "#6366F1"},
    "final": {"label": "Final", "color": "#DC2626"},
    "práctica": {"label": "Práctica", "color": "#059669"},
    "quiz": {"label": "Quiz", "color": "#F59E0B"}
}

def calculate_exam_status(exam_date: str, start_time: str, end_time: str) -> str:
    """Calculate exam status: upcoming, ongoing, finished"""
    now = datetime.now(timezone.utc)
    exam_start = datetime.fromisoformat(f"{exam_date}T{start_time}:00+00:00")
    exam_end = datetime.fromisoformat(f"{exam_date}T{end_time}:00+00:00")
    
    if now < exam_start:
        return "upcoming"
    elif exam_start <= now <= exam_end:
        return "ongoing"
    else:
        return "finished"

def calculate_duration_minutes(start_time: str, end_time: str) -> int:
    """Calculate duration in minutes"""
    start_h, start_m = map(int, start_time.split(':'))
    end_h, end_m = map(int, end_time.split(':'))
    return (end_h * 60 + end_m) - (start_h * 60 + start_m)

@router.get("/exam-schedules")
async def get_exam_schedules(
    grade_id: str,
    section_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get exam schedules filtered by grade and section (REQUIRED)"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Build query - grade_id and section_id are ALWAYS required
    query = {
        "school_id": school_id,
        "grade_id": grade_id,
        "section_id": section_id
    }
    
    # Date range filter for performance
    if from_date or to_date:
        date_filter = {}
        if from_date:
            date_filter["$gte"] = from_date
        if to_date:
            date_filter["$lte"] = to_date
        if date_filter:
            query["date"] = date_filter
    
    exams = await db.exam_schedules.find(query, {"_id": 0}).sort([("date", 1), ("start_time", 1)]).to_list(200)
    
    # Enrich with teacher, subject info and calculate status
    enriched_exams = []
    for exam in exams:
        # Get teacher info
        teacher_name = None
        teacher_photo = None
        if exam.get("teacher_id"):
            teacher = await db.users.find_one(
                {"id": exam["teacher_id"]},
                {"_id": 0, "name": 1, "last_name": 1, "profile_image": 1, "photo_url": 1}
            )
            if teacher:
                teacher_name = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
                teacher_photo = teacher.get("profile_image") or teacher.get("photo_url")
        
        # Get subject info
        subject_name = None
        subject_color = None
        if exam.get("subject_id"):
            subject = await db.subjects.find_one(
                {"id": exam["subject_id"]},
                {"_id": 0, "nombre": 1, "color": 1}
            )
            if subject:
                subject_name = subject.get("name") or subject.get("nombre")
                subject_color = subject.get("color")
        
        # Get classroom info
        classroom_name = None
        if exam.get("classroom_id"):
            classroom = await db.classrooms.find_one(
                {"id": exam["classroom_id"]},
                {"_id": 0, "nombre": 1}
            )
            if classroom:
                classroom_name = classroom.get("nombre")
        
        # Calculate status dynamically
        status = calculate_exam_status(exam["date"], exam["start_time"], exam["end_time"])
        
        enriched_exams.append({
            **exam,
            "teacher_name": teacher_name,
            "teacher_photo": teacher_photo,
            "subject_name": subject_name or exam.get("subject_name"),
            "subject_color": subject_color or "#6366F1",
            "classroom_name": classroom_name,
            "status": status,
            "type_label": EXAM_TYPES.get(exam.get("type"), {}).get("label", exam.get("type")),
            "type_color": EXAM_TYPES.get(exam.get("type"), {}).get("color", "#6366F1")
        })
    
    return {"exams": enriched_exams}

@router.post("/exam-schedules")
async def create_exam_schedule(
    data: ExamScheduleCreate,
    current_user = Depends(get_current_user)
):
    """Create a new exam schedule for a specific grade/section"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden programar exámenes")
    
    school_id = user["school_id"]
    
    # Validate grade exists
    grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
    if not grade:
        raise HTTPException(status_code=400, detail="Grado no válido")
    
    # Validate section exists
    section = await db.sections.find_one({"id": data.section_id, "school_id": school_id})
    if not section:
        raise HTTPException(status_code=400, detail="Sección no válida")
    
    # Validate subject exists
    subject = await db.subjects.find_one({"id": data.subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=400, detail="Materia no válida")
    
    # Validate teacher exists
    teacher = await db.users.find_one({"id": data.teacher_id, "school_id": school_id, "role": "teacher"})
    if not teacher:
        raise HTTPException(status_code=400, detail="Profesor no válido")
    
    # Validate end_time > start_time
    if data.end_time <= data.start_time:
        raise HTTPException(status_code=400, detail="La hora fin debe ser mayor a la hora inicio")
    
    # Calculate duration
    duration_minutes = calculate_duration_minutes(data.start_time, data.end_time)
    
    # VALIDATION 1: Check section conflict (same section, date, overlapping time)
    section_conflict = await db.exam_schedules.find_one({
        "school_id": school_id,
        "section_id": data.section_id,
        "date": data.date,
        "start_time": {"$lt": data.end_time},
        "end_time": {"$gt": data.start_time}
    })
    if section_conflict:
        raise HTTPException(
            status_code=400,
            detail=f"Ya hay un examen programado para esta sección en ese horario: {section_conflict.get('title')} ({section_conflict['start_time']} - {section_conflict['end_time']})"
        )
    
    # VALIDATION 2: Check teacher conflict (same teacher, date, overlapping time)
    teacher_conflict = await db.exam_schedules.find_one({
        "school_id": school_id,
        "teacher_id": data.teacher_id,
        "date": data.date,
        "start_time": {"$lt": data.end_time},
        "end_time": {"$gt": data.start_time}
    })
    if teacher_conflict:
        raise HTTPException(
            status_code=400,
            detail="El profesor ya tiene otro examen programado en ese horario"
        )
    
    # VALIDATION 3: Check classroom conflict (if classroom_id provided)
    if data.classroom_id:
        classroom_conflict = await db.exam_schedules.find_one({
            "school_id": school_id,
            "classroom_id": data.classroom_id,
            "date": data.date,
            "start_time": {"$lt": data.end_time},
            "end_time": {"$gt": data.start_time}
        })
        if classroom_conflict:
            raise HTTPException(
                status_code=400,
                detail="El aula ya está reservada para otro examen en ese horario"
            )
    
    # Get nivel_id from grade
    nivel_id = grade.get("nivel_id")
    
    # Create exam record
    exam_data = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "nivel_id": nivel_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "subject_id": data.subject_id,
        "teacher_id": data.teacher_id,
        "classroom_id": data.classroom_id,
        "date": data.date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "duration_minutes": duration_minutes,
        "type": data.type,
        "title": data.title,
        "description": data.description,
        "subject_name": subject.get("name") or subject.get("nombre"),
        "grade_name": grade.get("nombre"),
        "section_name": section.get("nombre"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.exam_schedules.insert_one(exam_data)
    if "_id" in exam_data:
        del exam_data["_id"]
    
    # Add status
    exam_data["status"] = calculate_exam_status(data.date, data.start_time, data.end_time)
    
    return {"message": "Examen programado correctamente", "exam": exam_data}

@router.put("/exam-schedules/{exam_id}")
async def update_exam_schedule(
    exam_id: str,
    data: ExamScheduleUpdate,
    current_user = Depends(get_current_user)
):
    """Update an exam schedule"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar exámenes")
    
    school_id = user["school_id"]
    
    existing = await db.exam_schedules.find_one({"id": exam_id, "school_id": school_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    # Get values for validation
    new_date = update_data.get("date", existing["date"])
    new_start = update_data.get("start_time", existing["start_time"])
    new_end = update_data.get("end_time", existing["end_time"])
    new_teacher = update_data.get("teacher_id", existing["teacher_id"])
    new_classroom = update_data.get("classroom_id", existing.get("classroom_id"))
    
    # Validate end_time > start_time
    if new_end <= new_start:
        raise HTTPException(status_code=400, detail="La hora fin debe ser mayor a la hora inicio")
    
    # Check conflicts if time/date changed
    if "date" in update_data or "start_time" in update_data or "end_time" in update_data:
        # Section conflict
        section_conflict = await db.exam_schedules.find_one({
            "school_id": school_id,
            "section_id": existing["section_id"],
            "date": new_date,
            "id": {"$ne": exam_id},
            "start_time": {"$lt": new_end},
            "end_time": {"$gt": new_start}
        })
        if section_conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Conflicto con otro examen de la sección: {section_conflict.get('title')}"
            )
    
    # Teacher conflict
    if "teacher_id" in update_data or "date" in update_data or "start_time" in update_data or "end_time" in update_data:
        teacher_conflict = await db.exam_schedules.find_one({
            "school_id": school_id,
            "teacher_id": new_teacher,
            "date": new_date,
            "id": {"$ne": exam_id},
            "start_time": {"$lt": new_end},
            "end_time": {"$gt": new_start}
        })
        if teacher_conflict:
            raise HTTPException(
                status_code=400,
                detail="El profesor ya tiene otro examen en ese horario"
            )
    
    # Classroom conflict
    if new_classroom and ("classroom_id" in update_data or "date" in update_data or "start_time" in update_data or "end_time" in update_data):
        classroom_conflict = await db.exam_schedules.find_one({
            "school_id": school_id,
            "classroom_id": new_classroom,
            "date": new_date,
            "id": {"$ne": exam_id},
            "start_time": {"$lt": new_end},
            "end_time": {"$gt": new_start}
        })
        if classroom_conflict:
            raise HTTPException(
                status_code=400,
                detail="El aula ya está reservada en ese horario"
            )
    
    # Update duration if times changed
    if "start_time" in update_data or "end_time" in update_data:
        update_data["duration_minutes"] = calculate_duration_minutes(new_start, new_end)
    
    # Update subject name if subject changed
    if "subject_id" in update_data:
        subject = await db.subjects.find_one({"id": update_data["subject_id"]})
        if subject:
            update_data["subject_name"] = subject.get("name") or subject.get("nombre")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.exam_schedules.update_one({"id": exam_id}, {"$set": update_data})
    
    updated = await db.exam_schedules.find_one({"id": exam_id}, {"_id": 0})
    updated["status"] = calculate_exam_status(updated["date"], updated["start_time"], updated["end_time"])
    
    return {"message": "Examen actualizado", "exam": updated}

@router.delete("/exam-schedules/{exam_id}")
async def delete_exam_schedule(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an exam schedule"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar exámenes")
    
    result = await db.exam_schedules.delete_one({
        "id": exam_id,
        "school_id": user["school_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    return {"message": "Examen eliminado correctamente"}

# Student endpoint - auto-filtered by student's grade/section
@router.get("/student/exam-schedule")
async def get_student_exam_schedule(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get exam schedule for student - auto-filtered by their grade/section.
    NO parameters for grade/section - extracted from authenticated user.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # SECURITY: Only students can access this endpoint
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    grade_id = user.get("grado_id")
    section_id = user.get("seccion_id")
    
    # Get grade and section names for header
    grade_name = None
    section_name = None
    
    if grade_id:
        grade = await db.grades.find_one({"id": grade_id, "school_id": school_id}, {"_id": 0, "nombre": 1})
        if grade:
            grade_name = grade.get("nombre")
    
    if section_id:
        section = await db.sections.find_one({"id": section_id, "school_id": school_id}, {"_id": 0, "nombre": 1})
        if section:
            section_name = section.get("nombre")
    
    # If no grade, return empty
    if not grade_id:
        return {
            "exams": [],
            "grade_name": grade_name,
            "section_name": section_name
        }
    
    # Get all subjects for the student's grade
    subjects = await db.subjects.find(
        {"grade_id": grade_id, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "teacher_id": 1}
    ).to_list(100)
    subject_ids = [s["id"] for s in subjects]
    subject_map = {s["id"]: s for s in subjects}
    
    if not subject_ids:
        return {
            "exams": [],
            "grade_name": grade_name,
            "section_name": section_name
        }
    
    # Query online_exams for published exams in these subjects
    query = {
        "school_id": school_id,
        "subject_id": {"$in": subject_ids},
        "status": "published"
    }
    
    # Date range filter on start_datetime
    if from_date or to_date:
        date_filter = {}
        if from_date:
            date_filter["$gte"] = from_date + "T00:00:00Z"
        if to_date:
            date_filter["$lte"] = to_date + "T23:59:59Z"
        if date_filter:
            query["start_datetime"] = date_filter
    
    exams = await db.online_exams.find(query, {"_id": 0}).sort("start_datetime", 1).to_list(100)
    
    # Enrich exams with teacher/subject info and status
    enriched_exams = []
    now = datetime.now(timezone.utc)
    
    for exam in exams:
        subject_info = subject_map.get(exam.get("subject_id"), {})
        teacher_name = None
        teacher_photo = None
        teacher_id = subject_info.get("teacher_id") or exam.get("created_by")
        
        if teacher_id:
            teacher = await db.users.find_one(
                {"id": teacher_id},
                {"_id": 0, "name": 1, "last_name": 1, "profile_image": 1, "photo_url": 1}
            )
            if teacher:
                teacher_name = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
                teacher_photo = teacher.get("profile_image") or teacher.get("photo_url")
        
        # Parse start/end datetime
        start_dt_str = exam.get("start_datetime", "")
        end_dt_str = exam.get("end_datetime", "")
        
        try:
            start_dt = datetime.fromisoformat(start_dt_str.replace("Z", "+00:00"))
        except Exception:
            start_dt = now
        try:
            end_dt = datetime.fromisoformat(end_dt_str.replace("Z", "+00:00"))
        except Exception:
            end_dt = now
        
        # Calculate exam status
        exam_date = start_dt.strftime("%Y-%m-%d")
        start_time = start_dt.strftime("%H:%M")
        end_time = end_dt.strftime("%H:%M")
        
        if now < start_dt:
            status = "upcoming"
        elif start_dt <= now <= end_dt:
            status = "in_progress"
        else:
            status = "completed"
        
        # Check if student already attempted
        attempt = await db.exam_attempts.find_one(
            {"exam_id": exam["id"], "student_id": user["id"]},
            {"_id": 0, "id": 1, "status": 1, "score": 1}
        )
        
        enriched_exams.append({
            "id": exam["id"],
            "title": exam.get("title", ""),
            "description": exam.get("description", ""),
            "subject_id": exam.get("subject_id"),
            "subject_name": subject_info.get("name", ""),
            "date": exam_date,
            "start_time": start_time,
            "end_time": end_time,
            "start_datetime": start_dt_str,
            "end_datetime": end_dt_str,
            "duration_minutes": exam.get("duration_minutes", 60),
            "teacher_name": teacher_name,
            "teacher_photo": teacher_photo,
            "status": status,
            "is_available": start_dt <= now <= end_dt,
            "has_attempted": attempt is not None,
            "attempt_status": attempt.get("status") if attempt else None,
            "attempt_score": attempt.get("score") if attempt else None,
            "type": exam.get("type", "regular"),
            "type_label": "Examen",
            "type_color": "#6366F1"
        })
    
    return {
        "exams": enriched_exams,
        "grade_name": grade_name,
        "section_name": section_name
    }

# ══════════════════════════════════════════════════════════════════════════════



# ══════════════════════════════════════════════════════════════════════════════
# EXAM AUTO-CLOSE CRON — Runs every 60 seconds
# ══════════════════════════════════════════════════════════════════════════════

async def close_expired_exams_cron():
    """
    Background task: checks every 60s for published exams past their end_datetime.
    For each:
      1. Changes status to "closed"
      2. Expires any in-progress attempts
      3. Creates score=0 attempts for students who never took the exam
      4. Syncs all grades to the registro auxiliar (if linked)
    """
    import asyncio
    while True:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()

            # Find published exams whose end_datetime has passed
            expired_exams = await db.online_exams.find(
                {
                    "status": ExamStatus.published.value,
                    "end_datetime": {"$lte": now_iso},
                },
                {"_id": 0}
            ).to_list(100)

            for exam in expired_exams:
                exam_id = exam["id"]
                school_id = exam["school_id"]
                section_id = exam.get("section_id")

                # 1. Close the exam
                await db.online_exams.update_one(
                    {"id": exam_id},
                    {"$set": {"status": ExamStatus.closed.value, "updated_at": now_iso}}
                )

                # 2. Expire any in-progress attempts
                await db.exam_attempts.update_many(
                    {"exam_id": exam_id, "status": ExamAttemptStatus.in_progress.value},
                    {"$set": {"status": ExamAttemptStatus.expired.value, "end_time": now_iso}}
                )

                # 3. Find students who should have taken the exam but didn't
                # Get all students in this section
                student_query = {"school_id": school_id, "role": "estudiante", "status": {"$ne": "inactive"}}
                if section_id:
                    student_query["seccion_id"] = section_id

                all_students = await db.users.find(
                    student_query, {"_id": 0, "id": 1}
                ).to_list(500)
                all_student_ids = {s["id"] for s in all_students}

                # Get students who already have a completed attempt
                completed_attempts = await db.exam_attempts.find(
                    {"exam_id": exam_id, "status": ExamAttemptStatus.completed.value},
                    {"_id": 0, "student_id": 1}
                ).to_list(500)
                completed_ids = {a["student_id"] for a in completed_attempts}

                # Students who didn't take the exam
                absent_ids = all_student_ids - completed_ids

                if absent_ids:
                    # Create score=0 attempts for absent students
                    absent_attempts = []
                    for sid in absent_ids:
                        # Check no attempt at all (could have expired/abandoned)
                        existing = await db.exam_attempts.find_one(
                            {"exam_id": exam_id, "student_id": sid, "status": ExamAttemptStatus.completed.value}
                        )
                        if existing:
                            continue

                        attempt_doc = {
                            "id": str(uuid.uuid4()),
                            "exam_id": exam_id,
                            "student_id": sid,
                            "school_id": school_id,
                            "status": ExamAttemptStatus.completed.value,
                            "start_time": now_iso,
                            "end_time": now_iso,
                            "score": 0,
                            "max_score": 20,
                            "percentage": 0.0,
                            "passed": False,
                            "correct_count": 0,
                            "incorrect_count": 0,
                            "unanswered_count": 0,
                            "graded_answers": [],
                            "time_used_seconds": 0,
                            "auto_zero": True,  # Flag: auto-assigned zero
                        }
                        absent_attempts.append(attempt_doc)

                    if absent_attempts:
                        await db.exam_attempts.insert_many(absent_attempts)
                        logger.info(f"[EXAM-CRON] Exam {exam_id}: assigned 0 to {len(absent_attempts)} absent students")

                # 4. Sync all grades to register if linked
                if exam.get("register_column"):
                    try:
                        await sync_exam_to_register(db, exam_id, "create")
                    except Exception as e:
                        logger.error(f"[EXAM-CRON] Sync failed for exam {exam_id}: {e}")

                logger.info(f"[EXAM-CRON] Closed exam '{exam.get('title', exam_id)}' — {len(completed_ids)} completed, {len(absent_ids)} absent")

            if expired_exams:
                logger.info(f"[EXAM-CRON] Processed {len(expired_exams)} expired exams")

        except Exception as e:
            logger.error(f"[EXAM-CRON] Error: {e}")

        await asyncio.sleep(60)  # Check every 60 seconds


# ══════════════════════════════════════════════════════════════════════════════
# TASK AUTO-CLOSE CRON — Runs every 60 seconds
# ══════════════════════════════════════════════════════════════════════════════

async def close_expired_tasks_cron():
    """
    Background task: checks every 60s for active tasks past their due_date.
    For each:
      1. Changes status to "closed"
      2. For each enrolled student without a submission → assigns grade=0
      3. Syncs all grades to the registro auxiliar (if linked via register_column)
    """
    import asyncio
    while True:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()

            # Find active tasks with a due_date set. We do NOT filter by
            # `due_date <= now_iso` in Mongo any more: that comparison was
            # lexicographic on the raw string, which is WRONG for documents
            # with mixed timezone offsets (e.g. "2026-04-20T23:59:00-05:00"
            # sorts BEFORE "2026-04-21T04:00:00+00:00" alphabetically even
            # though cronologically the first is LATER). We parse each
            # due_date into an aware datetime and compare against `now`.
            candidates = await db.course_posts.find(
                {
                    "$or": [{"post_type": "task"}, {"type": "task"}],
                    "status": "active",
                    "due_date": {"$exists": True, "$ne": None},
                    "deleted_at": {"$exists": False},
                },
                {"_id": 0},
            ).to_list(1000)

            expired_tasks = []
            for task in candidates:
                raw = task.get("due_date")
                try:
                    deadline = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                    if deadline.tzinfo is None:
                        # Assume UTC for naive timestamps (legacy docs)
                        deadline = deadline.replace(tzinfo=timezone.utc)
                    if deadline <= now:
                        expired_tasks.append(task)
                except Exception as e:
                    logger.warning(
                        f"[TASK-CRON] skipping task {task.get('id')}: "
                        f"invalid due_date={raw!r} ({e})"
                    )
                    continue

            for task in expired_tasks:
                task_id = task["id"]
                school_id = task.get("school_id")
                section_id = task.get("section_id")

                # 1. Close the task
                await db.course_posts.update_one(
                    {"id": task_id},
                    {"$set": {"status": "closed", "closed_at": now_iso}}
                )

                # 2. Find students who should have submitted
                student_query = {
                    "school_id": school_id,
                    "role": "estudiante",
                    "status": {"$ne": "inactive"},
                }
                if section_id:
                    student_query["seccion_id"] = section_id

                all_students = await db.users.find(
                    student_query, {"_id": 0, "id": 1}
                ).to_list(500)
                all_student_ids = {s["id"] for s in all_students}

                # Get students who already submitted
                submissions = task.get("submissions", [])
                submitted_ids = {s.get("student_id") for s in submissions if s.get("student_id")}

                # Students who didn't submit
                absent_ids = all_student_ids - submitted_ids

                if absent_ids:
                    # Add grade=0 submissions for absent students
                    new_submissions = []
                    for sid in absent_ids:
                        new_submissions.append({
                            "id": str(uuid.uuid4()),
                            "student_id": sid,
                            "submitted_at": now_iso,
                            "grade": 0,
                            "feedback": "No entregado - nota asignada automaticamente",
                            "graded_at": now_iso,
                            "graded_by": "system",
                            "auto_zero": True,
                            "content": "",
                            "files": [],
                        })

                    if new_submissions:
                        await db.course_posts.update_one(
                            {"id": task_id},
                            {"$push": {"submissions": {"$each": new_submissions}}}
                        )
                        logger.info(
                            f"[TASK-CRON] Task '{task.get('title', task_id)}': "
                            f"assigned 0 to {len(new_submissions)} absent students"
                        )

                # 3. Sync all grades to register if linked
                if task.get("register_column"):
                    try:
                        await sync_to_register(db, task_id, "task", "close_exam")
                    except Exception as e:
                        logger.error(f"[TASK-CRON] Sync failed for task {task_id}: {e}")

                logger.info(
                    f"[TASK-CRON] Closed task '{task.get('title', task_id)}' — "
                    f"{len(submitted_ids)} submitted, {len(absent_ids)} absent"
                )

            if expired_tasks:
                logger.info(f"[TASK-CRON] Processed {len(expired_tasks)} expired tasks")

        except Exception as e:
            logger.error(f"[TASK-CRON] Error: {e}")

        await asyncio.sleep(60)  # Check every 60 seconds


# ══════════════════════════════════════════════════════════════════════════════
# CLONE EXAM TO OTHER SECTIONS
# ══════════════════════════════════════════════════════════════════════════════

class CloneExamRequest(BaseModel):
    destinos: List[dict] = []
    clonar_en_misma_seccion: bool = False

@router.post("/exams/{exam_id}/clonar")
async def clone_exam(exam_id: str, data: CloneExamRequest, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if user.get("role") not in ["owner", "admin", "teacher", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="No tienes permisos")

    school_id = user["school_id"]
    original = await db.online_exams.find_one({"id": exam_id, "school_id": school_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    questions = await db.exam_questions.find({"exam_id": exam_id}, {"_id": 0}).to_list(500)
    now = datetime.now(timezone.utc).isoformat()
    clonados = 0
    errores = []

    async def create_clone(subject_id):
        nonlocal clonados
        new_id = str(uuid.uuid4())
        clone = {
            "id": new_id,
            "school_id": school_id,
            "subject_id": subject_id,
            "title": f"{original['title']} (copia)",
            "description": original.get("description", ""),
            "start_datetime": original.get("start_datetime"),
            "end_datetime": original.get("end_datetime"),
            "duration_minutes": original.get("duration_minutes", 60),
            "min_score_percentage": original.get("min_score_percentage", 60.0),
            "status": "draft",
            "created_by": user["id"],
            "created_at": now,
            "updated_at": now,
        }
        await db.online_exams.insert_one(clone)
        clone.pop("_id", None)
        if questions:
            new_qs = [{**q, "id": str(uuid.uuid4()), "exam_id": new_id} for q in questions]
            await db.exam_questions.insert_many(new_qs)
            for nq in new_qs:
                nq.pop("_id", None)
        clonados += 1

    if data.clonar_en_misma_seccion:
        try:
            await create_clone(original["subject_id"])
        except Exception as e:
            errores.append(f"Misma seccion: {str(e)}")

    for dest in data.destinos:
        dest_subject_id = dest.get("subject_id")
        if not dest_subject_id:
            continue
        dest_subject = await db.subjects.find_one({"id": dest_subject_id, "school_id": school_id}, {"_id": 0, "id": 1})
        if not dest_subject:
            errores.append("Asignatura destino no encontrada")
            continue
        try:
            await create_clone(dest_subject_id)
        except Exception as e:
            errores.append(str(e))

    return {"clonados": clonados, "errores": errores}
