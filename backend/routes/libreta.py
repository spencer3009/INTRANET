# -*- coding: utf-8 -*-
"""
Libreta Individual del Estudiante — Fase 2 (Turno A)

Endpoints:
    PUT  /api/sections/{section_id}/tutor   (owner/admin/director)
    GET  /api/sections/{section_id}/tutor   (cualquier auth del mismo school)
    GET  /api/libreta/{student_id}          (owner/admin/director/tutor/profesor/padre/alumno)

Fuente única de notas: `student_grades` (Ola 1 ya alineó portales).
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from .core import (
    db, get_current_user, resolve_user_from_token,
    is_admin_user, has_role,
    ADMIN_ROLES,
)
from services.ranking import compute_ranking
from services.libreta_format import format_section_libreta
from services.attendance_summary import summary_by_period
from services.grades_literal import numerica_a_letra, numerica_a_letra_escala, normalizar_escala, promedio_numerico
from .conduct import get_conduct_payload_for_libreta
from .conducta_extendida import get_conducta_extendida_payload_for_libreta
from .tutor_comments import get_comments_payload_for_libreta
from .final_status import get_final_status_payload_for_libreta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ════════════════════════════════════════════════════════════════════════════
# MODELS
# ════════════════════════════════════════════════════════════════════════════

class TutorAssignBody(BaseModel):
    teacher_id: Optional[str] = None  # null para desasignar


# ════════════════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════════════════

TUTOR_ASSIGN_ROLES = ["owner", "admin", "director"]


async def _require_user(current_user):
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no autenticado")
    return user


async def _get_active_tutor(school_id: str, section_id: str) -> Optional[dict]:
    """Devuelve el tutor activo (academic_assignments role:tutor) o None."""
    a = await db.academic_assignments.find_one(
        {
            "school_id": school_id,
            "section_id": section_id,
            "role": "tutor",
            "status": "activo",
        },
        {"_id": 0},
    )
    if not a:
        return None
    teacher = await db.users.find_one(
        {"id": a.get("teacher_id"), "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "role": 1},
    )
    return teacher


def _fmt_full_name(user: dict) -> str:
    return f"{user.get('last_name', '') or ''} {user.get('name', '') or ''}".strip()


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINTS — TUTOR DE SECCIÓN
# ════════════════════════════════════════════════════════════════════════════

@router.put("/sections/{section_id}/tutor")
async def assign_section_tutor(
    section_id: str,
    body: TutorAssignBody,
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    if not has_role(user, TUTOR_ASSIGN_ROLES):
        raise HTTPException(status_code=403, detail="Solo owner/admin/director pueden asignar tutor")

    school_id = user["school_id"]

    # 1) Validar que la sección existe
    section = await db.sections.find_one(
        {"id": section_id, "school_id": school_id}, {"_id": 0, "id": 1}
    )
    if not section:
        raise HTTPException(status_code=404, detail="No se encontró la sección solicitada")

    now = datetime.now(timezone.utc).isoformat()

    # 2) Caso desasignar (teacher_id = null)
    if body.teacher_id is None:
        result = await db.academic_assignments.update_many(
            {
                "school_id": school_id,
                "section_id": section_id,
                "role": "tutor",
                "status": "activo",
            },
            {"$set": {"status": "inactivo", "updated_at": now}},
        )
        return {
            "message": "Tutor desasignado",
            "deactivated": result.modified_count,
            "tutor": None,
        }

    # 3) Validar teacher
    teacher = await db.users.find_one(
        {"id": body.teacher_id, "school_id": school_id},
        {"_id": 0, "id": 1, "role": 1, "name": 1, "last_name": 1},
    )
    if not teacher:
        raise HTTPException(status_code=400, detail="El profesor no existe o pertenece a otro colegio")
    if teacher.get("role") != "teacher":
        raise HTTPException(status_code=400, detail="El usuario debe tener rol 'teacher'")

    # 4) Desactivar cualquier tutor previo de esta sección
    await db.academic_assignments.update_many(
        {
            "school_id": school_id,
            "section_id": section_id,
            "role": "tutor",
            "status": "activo",
        },
        {"$set": {"status": "inactivo", "updated_at": now}},
    )

    # 5) Insertar nuevo doc activo
    new_doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "section_id": section_id,
        "teacher_id": teacher["id"],
        "role": "tutor",
        "status": "activo",
        "assigned_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.academic_assignments.insert_one(new_doc)

    return {
        "message": "Tutor asignado correctamente",
        "tutor": {
            "id": teacher["id"],
            "nombres_completos": _fmt_full_name(teacher),
        },
    }


@router.get("/sections/{section_id}/tutor")
async def get_section_tutor(
    section_id: str,
    current_user=Depends(get_current_user),
):
    user = await _require_user(current_user)
    school_id = user["school_id"]

    # Validar que la sección pertenece al mismo colegio
    section = await db.sections.find_one(
        {"id": section_id, "school_id": school_id}, {"_id": 0, "id": 1}
    )
    if not section:
        raise HTTPException(status_code=404, detail="No se encontró la sección solicitada")

    teacher = await _get_active_tutor(school_id, section_id)
    if not teacher:
        return {"tutor": None}

    return {
        "tutor": {
            "id": teacher["id"],
            "nombres_completos": _fmt_full_name(teacher),
        }
    }


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINT — LIBRETA INDIVIDUAL
# ════════════════════════════════════════════════════════════════════════════

async def _can_view_libreta(viewer: dict, student: dict, section_id: str) -> bool:
    """Reglas de permisos para GET /api/libreta/{student_id}."""
    if viewer.get("school_id") != student.get("school_id"):
        return False

    role = viewer.get("role")

    if role in ADMIN_ROLES:        # owner, admin, director, coordinator
        return True

    if role == "student":
        return viewer["id"] == student["id"]

    if role == "parent":
        return student.get("padre_id") == viewer["id"]

    if role == "teacher":
        # Tutor de la sección
        tutor_assign = await db.academic_assignments.find_one(
            {
                "school_id": viewer["school_id"],
                "section_id": section_id,
                "role": "tutor",
                "status": "activo",
                "teacher_id": viewer["id"],
            },
            {"_id": 0, "id": 1},
        )
        if tutor_assign:
            return True
        # Profesor asignado a la sección (titular/auxiliar de cualquier asignatura)
        any_assign = await db.academic_assignments.find_one(
            {
                "school_id": viewer["school_id"],
                "section_id": section_id,
                "teacher_id": viewer["id"],
                "status": "activo",
            },
            {"_id": 0, "id": 1},
        )
        if any_assign:
            return True

    return False


def _compute_n_orden(students_sorted: List[dict], student_id: str) -> Optional[int]:
    for i, s in enumerate(students_sorted):
        if s.get("id") == student_id:
            return i + 1
    return None


@router.get("/libreta/{student_id}")
async def get_libreta(
    student_id: str,
    period_id: Optional[str] = Query(default=None),
    year: Optional[int] = Query(default=None),
    all_periods: bool = Query(default=False),
    current_user=Depends(get_current_user),
):
    """Genera el payload completo de la libreta del estudiante.

    Si `period_id` no viene, usa el periodo `activo: true` del colegio.
    Si `year` viene y existe un snapshot persistido para ese (student, year),
    devuelve el snapshot tal cual (libreta congelada / histórica).
    Si `all_periods=true` (vista acumulada del Consolidado), se ignora el
    snapshot por bimestre y se muestran TODOS los bimestres calificados en vivo.
    """
    viewer = await _require_user(current_user)

    # 0) Snapshot read-through: libreta OFICIAL de un solo bimestre.
    #    Se OMITE en la vista acumulada (all_periods=true), que usa el cálculo
    #    en vivo de TODOS los bimestres (más abajo).
    snap = None
    if period_id and not all_periods:
        snap = await db.report_cards_snapshots.find_one(
            {"school_id": viewer["school_id"], "student_id": student_id, "period_id": period_id},
            {"_id": 0},
        )

    if snap:
            stu = await db.users.find_one(
                {"id": student_id, "role": "student"},
                {"_id": 0, "id": 1, "school_id": 1, "padre_id": 1,
                 "seccion_id": 1, "section_id": 1},
            )
            if not stu:
                raise HTTPException(status_code=404, detail="No se encontró al estudiante")
            sec_id = stu.get("seccion_id") or stu.get("section_id")
            if not await _can_view_libreta(viewer, stu, sec_id):
                raise HTTPException(status_code=403, detail="No tienes permisos para ver esta libreta")
            payload = snap.get("payload_json") or {}
            prev_meta = payload.get("metadata") or {}
            # Re-read the school doc so that "display" settings (grade format,
            # hide toggles, etc.) ALWAYS reflect the current school config —
            # snapshots only freeze grades, not how they're rendered.
            snap_school = await db.schools.find_one(
                {"id": stu.get("school_id")},
                {"_id": 0, "libreta_grade_format": 1, "show_padres_grade": 1,
                 "hide_conducta_in_libreta": 1, "hide_tutor_comments_in_libreta": 1,
                 "hide_asistencia_in_libreta": 1, "hide_situacion_final_in_libreta": 1,
                 "libreta_tutor_comments_periods": 1, "libreta_print_format": 1,
                 "libreta_header_template": 1, "libreta_color_palette": 1,
                 "libreta_cell_bold": 1, "libreta_cell_size": 1, "libreta_all_bold": 1,
                 "libreta_director_name": 1, "libreta_stamp_mode": 1, "libreta_stamp_config": 1,
                 "libreta_director_signature": 1, "libreta_stamp_image": 1, "libreta_signature_layout": 1,
                 "libreta_signature_block_offset": 1,
                 "libreta_mode": 1},
            ) or {}
            payload["metadata"] = {
                "generated_at": prev_meta.get("generated_at"),
                "is_snapshot": True,
                "period_closed": True,
                "year_closed": False,
                "closed_at": snap.get("closed_at"),
                "closed_by": snap.get("closed_by"),
                "snapshot_version": snap.get("snapshot_version", "1.0"),
                "libreta_mode": snap_school.get("libreta_mode") or prev_meta.get("libreta_mode"),
                "show_padres_grade": bool(snap_school.get("show_padres_grade", prev_meta.get("show_padres_grade", False))),
                "libreta_grade_format": snap_school.get("libreta_grade_format") or prev_meta.get("libreta_grade_format") or "numeric",
                "hide_conducta_in_libreta": bool(snap_school.get("hide_conducta_in_libreta", prev_meta.get("hide_conducta_in_libreta", False))),
                "hide_tutor_comments_in_libreta": bool(snap_school.get("hide_tutor_comments_in_libreta", prev_meta.get("hide_tutor_comments_in_libreta", False))),
                "hide_asistencia_in_libreta": bool(snap_school.get("hide_asistencia_in_libreta", prev_meta.get("hide_asistencia_in_libreta", False))),
                "hide_situacion_final_in_libreta": bool(snap_school.get("hide_situacion_final_in_libreta", prev_meta.get("hide_situacion_final_in_libreta", False))),
                "tutor_comments_periods": ([int(x) for x in (snap_school.get("libreta_tutor_comments_periods") or []) if isinstance(x, (int, float))] or prev_meta.get("tutor_comments_periods") or []),
                "print_format": snap_school.get("libreta_print_format") or prev_meta.get("print_format") or {},
                "header_template": snap_school.get("libreta_header_template") or prev_meta.get("header_template") or {},
                "color_palette": snap_school.get("libreta_color_palette") or prev_meta.get("color_palette") or {},
                "cell_bold": snap_school.get("libreta_cell_bold") or prev_meta.get("cell_bold") or {},
                "cell_size": snap_school.get("libreta_cell_size") or prev_meta.get("cell_size") or {},
                "all_bold": bool(snap_school.get("libreta_all_bold", prev_meta.get("all_bold", False))),
                "director_name": snap_school.get("libreta_director_name") or prev_meta.get("director_name") or "",
                "stamp_mode": snap_school.get("libreta_stamp_mode") or prev_meta.get("stamp_mode") or "generated",
                "stamp_config": snap_school.get("libreta_stamp_config") or prev_meta.get("stamp_config") or {},
                "director_signature": snap_school.get("libreta_director_signature") or prev_meta.get("director_signature") or "",
                "stamp_image": snap_school.get("libreta_stamp_image") or prev_meta.get("stamp_image") or "",
                "signature_layout": snap_school.get("libreta_signature_layout") or prev_meta.get("signature_layout") or {},
                "signature_block_offset": (snap_school.get("libreta_signature_block_offset") if isinstance(snap_school.get("libreta_signature_block_offset"), (int, float)) else prev_meta.get("signature_block_offset", 30)),
                "conducta_template_mode": prev_meta.get("conducta_template_mode") or "default",
            }

            # Filter snapshot payload to only show the requested bimester.
            # The snapshot was generated with the FULL year payload, so it may
            # contain grades from BIM II/III/IV that were already in the system
            # when BIM I was closed. Blank them out so the libreta del BIM I
            # solo muestre BIM I.
            _blank_cell = {"numeric": None, "letter": None}
            for area in payload.get("areas", []) or []:
                for subj in area.get("subjects", []) or []:
                    grades = subj.get("grades") or {}
                    for pid in list(grades.keys()):
                        if pid != period_id:
                            grades[pid] = dict(_blank_cell)
                    subj["promedio_final"] = dict(_blank_cell)
                promedio_area = area.get("promedio_area") or {}
                for pid in list(promedio_area.keys()):
                    if pid == period_id or pid == "final":
                        continue
                    promedio_area[pid] = dict(_blank_cell)
                if "final" in promedio_area:
                    promedio_area["final"] = dict(_blank_cell)
            for subj in payload.get("subjects_without_area", []) or []:
                grades = subj.get("grades") or {}
                for pid in list(grades.keys()):
                    if pid != period_id:
                        grades[pid] = dict(_blank_cell)
                subj["promedio_final"] = dict(_blank_cell)
            ranking = payload.get("ranking") or {}
            for pid in list(ranking.keys()):
                if pid != period_id:
                    ranking[pid] = {
                        "puntaje": None, "promedio": None,
                        "orden_merito": None, "tercio": None,
                        "cursos_desaprobados": 0,
                    }
            asistencia = payload.get("asistencia") or {}
            for pid in list(asistencia.keys()):
                if pid != period_id:
                    asistencia[pid] = {"presente": 0, "tardanza": 0, "falta": 0, "justificada": 0}
            conducta = payload.get("conducta") or {}
            for pid in list(conducta.keys()):
                if pid != period_id:
                    conducta[pid] = None
            tutor_comments = payload.get("tutor_comments") or {}
            for pid in list(tutor_comments.keys()):
                if pid != period_id:
                    tutor_comments[pid] = None
            conducta_ext = payload.get("conducta_extendida") or {}
            by_period = conducta_ext.get("by_period") or {}
            for pid in list(by_period.keys()):
                if pid != period_id:
                    by_period[pid] = None
            # Hide year-level "situación final".
            if isinstance(payload.get("final_status"), dict):
                payload["final_status"] = {
                    **payload["final_status"],
                    "situacion": None,
                    "promedio_anual": None,
                    "cursos_a_recuperacion": [],
                }
            return payload

    # 1) Cargar estudiante
    student = await db.users.find_one(
        {"id": student_id, "role": "student"},
        {
            "_id": 0,
            "id": 1, "name": 1, "last_name": 1, "school_id": 1,
            "seccion_id": 1, "section_id": 1, "grado_id": 1, "nivel_id": 1,
            "student_code": 1, "photo_url": 1, "padre_id": 1,
        },
    )
    if not student:
        raise HTTPException(status_code=404, detail="No se encontró al estudiante")

    section_id = student.get("seccion_id") or student.get("section_id")
    if not section_id:
        raise HTTPException(status_code=400, detail="El estudiante aún no tiene una sección asignada")

    # 2) Validar permisos
    if not await _can_view_libreta(viewer, student, section_id):
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta libreta")

    school_id = student["school_id"]

    # 3) Cargar school, section, grado, level (paralelo)
    section_doc = await db.sections.find_one(
        {"id": section_id, "school_id": school_id}, {"_id": 0}
    )
    if not section_doc:
        raise HTTPException(status_code=404, detail="No se encontró la sección solicitada")
    grado_id = section_doc.get("grado_id") or student.get("grado_id")

    school_doc = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "id": 1, "name": 1, "school_name": 1, "legal_name": 1, "logo_url": 1, "libreta_mode": 1, "show_padres_grade": 1, "libreta_grade_format": 1, "hide_conducta_in_libreta": 1, "hide_tutor_comments_in_libreta": 1, "hide_asistencia_in_libreta": 1, "hide_situacion_final_in_libreta": 1, "libreta_tutor_comments_periods": 1, "libreta_print_format": 1, "libreta_header_template": 1, "libreta_color_palette": 1, "libreta_cell_bold": 1, "libreta_cell_size": 1, "libreta_all_bold": 1, "libreta_grade_scale_mode": 1, "libreta_grade_scale": 1, "libreta_director_name": 1, "libreta_stamp_mode": 1, "libreta_stamp_config": 1, "libreta_director_signature": 1, "libreta_stamp_image": 1, "libreta_signature_layout": 1, "libreta_signature_block_offset": 1},
    ) or {}

    grade_doc = await db.grades.find_one(
        {"id": grado_id, "school_id": school_id},
        {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1},
    ) if grado_id else None

    level_id = (grade_doc or {}).get("nivel_id") or student.get("nivel_id")
    level_doc = await db.academic_levels.find_one(
        {"id": level_id, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}
    ) if level_id else None

    # 4) Periodos académicos del año (activo del colegio)
    all_periods = await db.academic_periods.find(
        {"school_id": school_id},
        {"_id": 0, "id": 1, "nombre": 1, "orden": 1, "activo": 1,
         "fecha_inicio": 1, "fecha_fin": 1, "academic_year_id": 1},
    ).sort("orden", 1).to_list(20)

    if not all_periods:
        raise HTTPException(status_code=400, detail="No hay bimestres académicos configurados")

    active_period = next((p for p in all_periods if p.get("activo")), None) or all_periods[0]

    # Periodo solicitado (si viene)
    requested_period = None
    if period_id:
        requested_period = next((p for p in all_periods if p["id"] == period_id), None)
        if not requested_period:
            raise HTTPException(status_code=404, detail="No se encontró el bimestre indicado")

    period_ids = [p["id"] for p in all_periods]

    # 5) Subjects de la sección + curricular_areas
    subjects = await db.subjects.find(
        {"school_id": school_id, "section_id": section_id, "status": {"$ne": "inactive"}},
        {"_id": 0, "id": 1, "name": 1, "area_id": 1, "area_name": 1, "area_order": 1},
    ).to_list(200)
    if not subjects and grado_id:
        subjects = await db.subjects.find(
            {"school_id": school_id, "grade_id": grado_id, "status": {"$ne": "inactive"}},
            {"_id": 0, "id": 1, "name": 1, "area_id": 1, "area_name": 1, "area_order": 1},
        ).to_list(200)

    subject_ids = [s["id"] for s in subjects]

    areas_map = {}
    if any(s.get("area_id") for s in subjects):
        area_ids = list({s["area_id"] for s in subjects if s.get("area_id")})
        area_docs = await db.curricular_areas.find(
            {"school_id": school_id, "id": {"$in": area_ids}},
            {"_id": 0, "id": 1, "name": 1, "order": 1},
        ).to_list(50)
        areas_map = {a["id"]: a for a in area_docs}

    # 6) Notas del alumno (todas las del año) — fetch full row so we can
    # recompute final_grade on-the-fly when the school uses a CUSTOM
    # (dynamic) Registro Auxiliar template. Without this, the libreta
    # appears empty for any subject whose grades live in `grades_dynamic`.
    student_grade_docs: List[dict] = []
    if subject_ids and period_ids:
        student_grade_docs = await db.student_grades.find(
            {
                "school_id": school_id,
                "student_id": student_id,
                "subject_id": {"$in": subject_ids},
                "period_id": {"$in": period_ids},
            },
            {"_id": 0},
        ).to_list(2000)

    # Pre-load active template + helpers for the on-the-fly recompute path.
    from services.register_sync import get_active_template_for_school
    from routes.grades import calculate_final_grade, GRADE_SUB_FIELDS
    libreta_template = await get_active_template_for_school(db, school_id)
    is_custom_template = bool(libreta_template and not libreta_template.get("es_sistema"))

    # Lookup: notes[subject_id][period_id] = final_grade
    # Precedencia idéntica al Consolidado (routes/grades.py):
    #   final_grade_manual (override del profesor desde el portal de notas) >
    #   final_grade (calculado automáticamente desde el Registro Auxiliar) >
    #   on-the-fly recompute (solo para plantillas custom).
    #
    # ROBUSTEZ ante FILAS DUPLICADAS: puede existir MÁS de una fila de
    # student_grades para el mismo (subject_id, period_id) — típicamente una con
    # notas reales y otra vacía (creada por cambios de sección, re-sync, etc.).
    # Antes se usaba "la última gana", por lo que una fila vacía podía pisar a la
    # buena según el orden de Mongo (causa de que a un alumno le faltara el BIM I
    # y a otro el BIM II en la libreta). Ahora se elige la MEJOR fila por grupo:
    # prioridad manual(3) > valor real(2) > vacía(0-1); a igualdad, se prefiere la
    # fila de la SECCIÓN ACTUAL del alumno.
    def _row_candidate(g):
        manual = g.get("final_grade_manual")
        if manual is not None:
            return manual, 3
        final_val = g.get("final_grade")
        has_data = g.get("grades_dynamic") or any(g.get(f) is not None for f in GRADE_SUB_FIELDS)
        if is_custom_template and has_data:
            try:
                recomputed = calculate_final_grade(g, {}, template=libreta_template)
                if recomputed is not None:
                    final_val = recomputed
            except Exception as e:
                logger.warning(f"[LIBRETA] on-the-fly recompute failed for student={student_id} subj={g.get('subject_id')}: {e}")
        if final_val is not None:
            return final_val, 2
        return None, (1 if has_data else 0)

    notes_lookup: Dict[str, Dict[str, Optional[float]]] = {}
    _best_rank: Dict[str, Dict[str, tuple]] = {}
    for g in student_grade_docs:
        subj_id = g.get("subject_id")
        period_id_g = g.get("period_id")
        if not subj_id or not period_id_g:
            continue
        val, prio = _row_candidate(g)
        sec_match = 1 if (g.get("section_id") == section_id) else 0
        prev = _best_rank.get(subj_id, {}).get(period_id_g)
        if prev is None or (prio, sec_match) > (prev[0], prev[1]):
            _best_rank.setdefault(subj_id, {})[period_id_g] = (prio, sec_match)
            notes_lookup.setdefault(subj_id, {})[period_id_g] = val

    # 7) Tutor de la sección
    tutor = await _get_active_tutor(school_id, section_id)
    tutor_payload = None
    if tutor:
        tutor_payload = {
            "id": tutor["id"],
            "nombres_completos": _fmt_full_name(tutor),
        }

    # 8) N° de orden (mismo orden alfabético que el consolidado)
    students_in_section = await db.users.find(
        {
            "school_id": school_id,
            "role": "student",
            "student_status": {"$in": ["enrolled", "active"]},
            "is_disabled": {"$ne": True},
            "seccion_id": section_id,
        },
        {"_id": 0, "id": 1, "name": 1, "last_name": 1},
    ).sort([("last_name", 1), ("name", 1)]).to_list(500)
    if not any(s["id"] == student_id for s in students_in_section):
        # Fallback con `section_id`
        students_in_section = await db.users.find(
            {
                "school_id": school_id,
                "role": "student",
                "student_status": {"$in": ["enrolled", "active"]},
                "is_disabled": {"$ne": True},
                "section_id": section_id,
            },
            {"_id": 0, "id": 1, "name": 1, "last_name": 1},
        ).sort([("last_name", 1), ("name", 1)]).to_list(500)

    n_orden = _compute_n_orden(students_in_section, student_id)

    # 9) Ranking por bimestre
    ranking_payload: Dict[str, Any] = {}
    for p in all_periods:
        full = await compute_ranking(db, school_id, section_id, p["id"])
        info = full.get(student_id, {
            "puntaje": None, "promedio": None,
            "orden_merito": None, "tercio": None, "cursos_desaprobados": 0,
        })
        ranking_payload[p["id"]] = info

    # 10) Asistencia por bimestre
    asistencia_payload: Dict[str, Any] = {}
    for p in all_periods:
        asistencia_payload[p["id"]] = await summary_by_period(
            db, school_id, student_id, p["id"]
        )

    # 11) Construir áreas + subjects sin área
    by_area: Dict[str, dict] = {}
    subjects_without_area: List[dict] = []

    # Resolver nota numérica → letra usando la escala del colegio.
    # Si el modo es "custom" y la escala es válida, se usa; de lo contrario MINEDU.
    _scale_mode = (school_doc.get("libreta_grade_scale_mode") or "default")
    _custom_scale = school_doc.get("libreta_grade_scale")
    if _scale_mode == "custom" and normalizar_escala(_custom_scale) is not None:
        def to_letter(v):
            return numerica_a_letra_escala(v, _custom_scale) if v is not None else None
    else:
        def to_letter(v):
            return numerica_a_letra(v) if v is not None else None

    for s in subjects:
        # grades por periodo
        per_period: Dict[str, Dict[str, Any]] = {}
        finals_for_avg: List[float] = []
        for p in all_periods:
            num = notes_lookup.get(s["id"], {}).get(p["id"])
            per_period[p["id"]] = {
                "numeric": num,
                "letter": to_letter(num),
            }
            if num is not None:
                finals_for_avg.append(float(num))

        prom_num = promedio_numerico(finals_for_avg) if finals_for_avg else None
        subj_block = {
            "id": s["id"],
            "name": s["name"],
            "grades": per_period,
            "promedio_final": {
                "numeric": prom_num,
                "letter": to_letter(prom_num),
            },
        }

        area_id = s.get("area_id")
        if area_id and area_id in areas_map:
            area = areas_map[area_id]
            if area_id not in by_area:
                by_area[area_id] = {
                    "id": area_id,
                    "name": area.get("name", ""),
                    "order": s.get("area_order") if s.get("area_order") is not None else area.get("order", 999),
                    "subjects": [],
                }
            by_area[area_id]["subjects"].append(subj_block)
        elif s.get("area_name"):
            # Subject con area_name pero sin area_id formal (legacy)
            key = f"_legacy_{s['area_name']}"
            if key not in by_area:
                by_area[key] = {
                    "id": key,
                    "name": s["area_name"],
                    "order": s.get("area_order") or 999,
                    "subjects": [],
                }
            by_area[key]["subjects"].append(subj_block)
        else:
            subjects_without_area.append(subj_block)

    # Promedios de área por periodo
    areas_list: List[dict] = []
    for area in sorted(by_area.values(), key=lambda a: (a["order"], a["name"])):
        promedio_area: Dict[str, Any] = {}
        all_finals_for_area_final: List[float] = []
        for p in all_periods:
            vals: List[float] = []
            for subj in area["subjects"]:
                num = subj["grades"].get(p["id"], {}).get("numeric")
                if num is not None:
                    vals.append(float(num))
            avg = promedio_numerico(vals) if vals else None
            promedio_area[p["id"]] = {
                "numeric": avg,
                "letter": to_letter(avg),
            }
            if avg is not None:
                all_finals_for_area_final.append(avg)
        # Promedio FINAL del área = promedio de los promedios por bimestre
        final_avg = promedio_numerico(all_finals_for_area_final) if all_finals_for_area_final else None
        promedio_area["final"] = {
            "numeric": final_avg,
            "letter": to_letter(final_avg),
        }
        area_out = {
            "id": area["id"],
            "name": area["name"],
            "order": area["order"],
            "subjects": area["subjects"],
            "promedio_area": promedio_area,
        }
        areas_list.append(area_out)

    # 12) Año académico
    year_doc = await db.academic_years.find_one(
        {"school_id": school_id}, {"_id": 0, "year": 1}, sort=[("year", -1)]
    )
    year_val = (year_doc or {}).get("year") or datetime.now().year

    # 13) Display de sección
    section_display = format_section_libreta(grade_doc, section_doc, level_doc)

    # 14) Apellidos y Nombres (formato libreta del Roble: "APELLIDOS, Nombres")
    apellidos = (student.get("last_name") or "").strip()
    nombres = (student.get("name") or "").strip()
    apellidos_nombres = f"{apellidos.upper()}, {nombres}" if apellidos else nombres

    # 15) Conducta, comentarios del tutor, situación final (Turno B)
    conducta_payload = await get_conduct_payload_for_libreta(
        school_id, student_id, period_ids
    )
    conducta_ext_payload = await get_conducta_extendida_payload_for_libreta(
        school_id, student_id, period_ids
    )
    comments_payload = await get_comments_payload_for_libreta(
        school_id, student_id, period_ids
    )
    final_status_payload = await get_final_status_payload_for_libreta(
        school_id, student_id, year_val
    )

    # 16) Determinar qué bimestres mantener visibles:
    #   • Si el usuario pidió un `period_id` específico (ej. al abrir libreta
    #     desde el Consolidado filtrado por bimestre) → SOLO ese bimestre.
    #   • Si no se pidió, aplicar `school.libreta_mode`:
    #       - "bimestral":  solo el último bimestre cerrado.
    #       - "acumulada":  todos los bimestres cerrados.
    #   • Si no se pidió y no hay snapshots cerrados → mostrar todo.
    libreta_mode = (school_doc.get("libreta_mode") or "acumulada").lower()
    closed_snapshots = await db.report_cards_snapshots.find(
        {"school_id": school_id, "student_id": student_id,
         "period_id": {"$in": period_ids}},
        {"_id": 0, "period_id": 1},
    ).to_list(20)
    closed_period_ids = {s["period_id"] for s in closed_snapshots}

    apply_filter = False
    keep_ids: set = set()
    if all_periods:
        # Vista ACUMULADA: mostrar TODOS los bimestres calificados, sin recortar.
        apply_filter = False
    elif period_id:
        # Vista por bimestre puntual: SOLO ese bimestre.
        apply_filter = True
        keep_ids = {period_id}
    elif closed_period_ids:
        apply_filter = True
        if libreta_mode == "bimestral":
            ordered_closed = sorted(
                [p for p in all_periods if p["id"] in closed_period_ids],
                key=lambda p: p.get("orden", 0),
                reverse=True,
            )
            keep_ids = {ordered_closed[0]["id"]} if ordered_closed else set()
        else:
            keep_ids = closed_period_ids

    if apply_filter:
        for p in all_periods:
            pid = p["id"]
            if pid in keep_ids:
                continue
            for area in areas_list:
                for subj in area.get("subjects", []):
                    if pid in subj.get("grades", {}):
                        subj["grades"][pid] = {"numeric": None, "letter": None}
                if pid in area.get("promedio_area", {}):
                    area["promedio_area"][pid] = {"numeric": None, "letter": None}
            for subj in subjects_without_area:
                if pid in subj.get("grades", {}):
                    subj["grades"][pid] = {"numeric": None, "letter": None}
            if pid in ranking_payload:
                ranking_payload[pid] = {
                    "puntaje": None, "promedio": None,
                    "orden_merito": None, "tercio": None, "cursos_desaprobados": 0,
                }
            if pid in asistencia_payload:
                asistencia_payload[pid] = {"presente": 0, "tardanza": 0, "falta": 0, "justificada": 0}
            conducta_payload[pid] = None
            comments_payload[pid] = None
            if conducta_ext_payload.get("by_period") and pid in conducta_ext_payload["by_period"]:
                conducta_ext_payload["by_period"][pid] = None

        # Cuando se filtra por bimestre puntual (no es vista acumulada de
        # cerrados), los "promedios finales" (subject y área) pierden sentido
        # porque solo hay datos de UN bimestre — los blanqueamos para que no
        # se vea un promedio engañoso en la libreta filtrada.
        if period_id:
            for area in areas_list:
                for subj in area.get("subjects", []):
                    subj["promedio_final"] = {"numeric": None, "letter": None}
                if "final" in area.get("promedio_area", {}):
                    area["promedio_area"]["final"] = {"numeric": None, "letter": None}
            for subj in subjects_without_area:
                subj["promedio_final"] = {"numeric": None, "letter": None}
            # final_status (situación final del año) tampoco aplica.
            if isinstance(final_status_payload, dict):
                final_status_payload = {
                    **final_status_payload,
                    "situacion": None,
                    "promedio_anual": None,
                    "cursos_a_recuperacion": [],
                }

    return {
        "student": {
            "id": student["id"],
            "student_code": student.get("student_code") or "—",
            "apellidos_nombres": apellidos_nombres,
            "photo_url": student.get("photo_url"),
            "n_orden": n_orden,
        },
        "school": {
            "id": school_id,
            "name": school_doc.get("name") or school_doc.get("school_name", ""),
            "legal_name": school_doc.get("legal_name"),  # se llena en Turno B
            "logo_url": school_doc.get("logo_url"),
        },
        "section": {
            "id": section_id,
            "display": section_display,
            "nivel": (level_doc or {}).get("nombre"),
            "grado": (grade_doc or {}).get("nombre"),
            "nombre": section_doc.get("nombre"),
        },
        "tutor": tutor_payload,
        "year": year_val,
        "period_active": {
            "id": active_period["id"],
            "nombre": active_period.get("nombre"),
            "orden": active_period.get("orden"),
        },
        "period_requested": (
            {
                "id": requested_period["id"],
                "nombre": requested_period.get("nombre"),
                "orden": requested_period.get("orden"),
            } if requested_period else None
        ),
        "all_periods": [
            {"id": p["id"], "nombre": p.get("nombre"), "orden": p.get("orden")}
            for p in all_periods
        ],
        "areas": areas_list,
        "subjects_without_area": subjects_without_area,
        "ranking": ranking_payload,
        "asistencia": asistencia_payload,
        "conducta": conducta_payload,
        "conducta_extendida": conducta_ext_payload,
        "tutor_comments": comments_payload,
        "final_status": final_status_payload,
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "is_snapshot": False,
            "period_closed": False,
            "year_closed": False,
            "libreta_mode": libreta_mode,
            "closed_periods_count": len(closed_period_ids),
            "show_padres_grade": bool(school_doc.get("show_padres_grade", False)),
            "libreta_grade_format": school_doc.get("libreta_grade_format") or "numeric",
            "hide_conducta_in_libreta": bool(school_doc.get("hide_conducta_in_libreta")),
            "hide_tutor_comments_in_libreta": bool(school_doc.get("hide_tutor_comments_in_libreta")),
            "hide_asistencia_in_libreta": bool(school_doc.get("hide_asistencia_in_libreta")),
            "hide_situacion_final_in_libreta": bool(school_doc.get("hide_situacion_final_in_libreta")),
            "tutor_comments_periods": [int(x) for x in (school_doc.get("libreta_tutor_comments_periods") or []) if isinstance(x, (int, float))],
            "print_format": school_doc.get("libreta_print_format") or {},
            "header_template": school_doc.get("libreta_header_template") or {},
            "color_palette": school_doc.get("libreta_color_palette") or {},
            "cell_bold": school_doc.get("libreta_cell_bold") or {},
            "cell_size": school_doc.get("libreta_cell_size") or {},
            "all_bold": bool(school_doc.get("libreta_all_bold")),
            "director_name": school_doc.get("libreta_director_name") or "",
            "stamp_mode": school_doc.get("libreta_stamp_mode") or "generated",
            "stamp_config": school_doc.get("libreta_stamp_config") or {},
            "director_signature": school_doc.get("libreta_director_signature") or "",
            "stamp_image": school_doc.get("libreta_stamp_image") or "",
            "signature_layout": school_doc.get("libreta_signature_layout") or {},
            "signature_block_offset": (school_doc.get("libreta_signature_block_offset") if isinstance(school_doc.get("libreta_signature_block_offset"), (int, float)) else 30),
            "conducta_template_mode": conducta_ext_payload.get("mode") or "default",
        },
    }


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINT — LEGAL NAME (razón social del colegio)
# ════════════════════════════════════════════════════════════════════════════

class SchoolLegalInfoUpdate(BaseModel):
    legal_name: Optional[str] = None
    libreta_mode: Optional[str] = None  # "bimestral" | "acumulada"


@router.put("/school/legal-info")
async def update_school_legal_info(
    body: SchoolLegalInfoUpdate,
    current_user=Depends(get_current_user),
):
    """Solo el owner puede editar la razón social y el modo de libreta del colegio."""
    user = await _require_user(current_user)
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Solo el propietario puede editar la configuración del colegio")

    school_id = user["school_id"]
    updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.legal_name is not None:
        updates["legal_name"] = (body.legal_name or "").strip() or None
    if body.libreta_mode is not None:
        mode = (body.libreta_mode or "").strip().lower()
        if mode not in ("bimestral", "acumulada"):
            raise HTTPException(status_code=400, detail="libreta_mode debe ser 'bimestral' o 'acumulada'")
        updates["libreta_mode"] = mode

    await db.schools.update_one({"id": school_id}, {"$set": updates})
    school = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "id": 1, "name": 1, "school_name": 1, "legal_name": 1, "logo_url": 1, "libreta_mode": 1},
    )
    return {"school": school}


# ════════════════════════════════════════════════════════════════════════════
# HELPER PÚBLICO — está un período cerrado para un alumno?
# ════════════════════════════════════════════════════════════════════════════

async def is_period_closed(school_id: str, student_id: str, period_id: str) -> bool:
    """Devuelve True si existe snapshot del bimestre para ese alumno."""
    snap = await db.report_cards_snapshots.find_one(
        {"school_id": school_id, "student_id": student_id, "period_id": period_id},
        {"_id": 0, "id": 1},
    )
    return snap is not None


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINT — closed-periods (consulta al frontend)
# ════════════════════════════════════════════════════════════════════════════

@router.get("/libreta/closed-periods/{student_id}")
async def list_closed_periods(
    student_id: str,
    year: Optional[int] = Query(default=None),
    current_user=Depends(get_current_user),
):
    viewer = await _require_user(current_user)
    student = await db.users.find_one(
        {"id": student_id, "role": "student"},
        {"_id": 0, "id": 1, "school_id": 1, "padre_id": 1, "seccion_id": 1, "section_id": 1},
    )
    if not student:
        raise HTTPException(status_code=404, detail="No se encontró al estudiante")
    sec_id = student.get("seccion_id") or student.get("section_id")
    if not await _can_view_libreta(viewer, student, sec_id):
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta libreta")

    school_id = student["school_id"]
    periods = await db.academic_periods.find(
        {"school_id": school_id},
        {"_id": 0, "id": 1, "nombre": 1, "orden": 1, "fecha_inicio": 1, "fecha_fin": 1},
    ).sort("orden", 1).to_list(20)
    period_ids = [p["id"] for p in periods]

    snaps_q: Dict[str, Any] = {
        "school_id": school_id, "student_id": student_id,
        "period_id": {"$in": period_ids},
    }
    if year is not None:
        snaps_q["year"] = year
    snaps = await db.report_cards_snapshots.find(
        snaps_q,
        {"_id": 0, "period_id": 1, "closed_at": 1, "closed_by": 1, "year": 1},
    ).to_list(20)
    snap_by_pid = {s["period_id"]: s for s in snaps}

    closed: List[dict] = []
    open_: List[dict] = []
    for p in periods:
        if p["id"] in snap_by_pid:
            s = snap_by_pid[p["id"]]
            closed.append({
                "period_id": p["id"], "period_name": p.get("nombre"),
                "orden": p.get("orden"),
                "closed_at": s.get("closed_at"),
                "closed_by": s.get("closed_by"),
                "year": s.get("year"),
            })
        else:
            open_.append({
                "period_id": p["id"], "period_name": p.get("nombre"),
                "orden": p.get("orden"),
            })

    return {
        "student_id": student_id,
        "year": year,
        "closed_periods": closed,
        "open_periods": open_,
    }


@router.get("/libreta/admin/closed-periods")
async def list_closed_periods_admin(current_user=Depends(get_current_user)):
    """For the owner: returns all closed (period × section) groups across the
    school so the admin UI can show the full history and offer "Reabrir"
    buttons even for closures done in previous sessions or by other admins."""
    user = await _require_user(current_user)
    if user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver el historial de cierres")
    school_id = user["school_id"]

    periods = await db.academic_periods.find(
        {"school_id": school_id},
        {"_id": 0, "id": 1, "nombre": 1, "orden": 1},
    ).sort("orden", 1).to_list(20)
    period_by_id = {p["id"]: p for p in periods}

    snaps = await db.report_cards_snapshots.find(
        {"school_id": school_id, "period_id": {"$in": list(period_by_id.keys())}},
        {"_id": 0, "period_id": 1, "student_id": 1, "closed_at": 1, "closed_by": 1},
    ).to_list(50000)
    if not snaps:
        return {"history": []}

    # Map student → section
    sids = list({s["student_id"] for s in snaps})
    students = await db.users.find(
        {"id": {"$in": sids}, "role": "student"},
        {"_id": 0, "id": 1, "seccion_id": 1, "section_id": 1},
    ).to_list(50000)
    stu_section = {
        s["id"]: (s.get("seccion_id") or s.get("section_id"))
        for s in students
    }

    sections = await db.sections.find(
        {"school_id": school_id},
        {"_id": 0, "id": 1, "nombre": 1},
    ).to_list(500)
    section_name_by_id = {s["id"]: s.get("nombre") for s in sections}

    closers = await db.users.find(
        {"id": {"$in": list({s.get("closed_by") for s in snaps if s.get("closed_by")})}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1},
    ).to_list(500)
    closer_name_by_id = {
        u["id"]: " ".join(filter(None, [u.get("name"), u.get("last_name")])) or u["id"]
        for u in closers
    }

    # Group by (period_id, section_id)
    groups: Dict[tuple, dict] = {}
    for s in snaps:
        pid = s["period_id"]
        sec_id = stu_section.get(s["student_id"])
        key = (pid, sec_id)
        g = groups.setdefault(key, {
            "period_id": pid,
            "period_name": period_by_id.get(pid, {}).get("nombre"),
            "orden": period_by_id.get(pid, {}).get("orden"),
            "section_id": sec_id,
            "section_name": section_name_by_id.get(sec_id) if sec_id else None,
            "students": 0,
            "closed_at": None,
            "closed_by": None,
            "closed_by_name": None,
        })
        g["students"] += 1
        closed_at = s.get("closed_at")
        if closed_at and (g["closed_at"] is None or closed_at > g["closed_at"]):
            g["closed_at"] = closed_at
            g["closed_by"] = s.get("closed_by")
            g["closed_by_name"] = closer_name_by_id.get(s.get("closed_by"))

    history = sorted(
        groups.values(),
        key=lambda x: (x.get("closed_at") or ""),
        reverse=True,
    )
    return {"history": history}


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINTS — CIERRE POR BIMESTRE (Turno B+: corrección conceptual)
# ════════════════════════════════════════════════════════════════════════════

class ClosePeriodBody(BaseModel):
    period_id: str
    section_id: Optional[str] = None


@router.post("/libreta/close-period")
async def close_period(
    body: ClosePeriodBody,
    force: bool = Query(default=False),
    current_user=Depends(get_current_user),
):
    """Persiste un snapshot de la libreta de cada alumno para un bimestre.

    - Solo owner.
    - Si `section_id` viene: cierra solo esa sección.
    - 409 sin force si TODOS los alumnos ya tenían snapshot.
    """
    user = await _require_user(current_user)
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Solo el propietario puede cerrar el bimestre")

    school_id = user["school_id"]

    period = await db.academic_periods.find_one(
        {"id": body.period_id, "school_id": school_id},
        {"_id": 0, "id": 1, "nombre": 1, "orden": 1, "academic_year_id": 1, "year": 1},
    )
    if not period:
        raise HTTPException(status_code=404, detail="No se encontró el bimestre indicado")

    # Year derivado del periodo (académico o calendario)
    year_doc = await db.academic_years.find_one(
        {"id": period.get("academic_year_id"), "school_id": school_id}, {"_id": 0, "year": 1}
    ) if period.get("academic_year_id") else None
    period_year = (year_doc or {}).get("year") or period.get("year") or datetime.now().year

    # Lista de alumnos
    student_filter: Dict[str, Any] = {
        "school_id": school_id,
        "role": "student",
        "student_status": {"$in": ["enrolled", "active"]},
        "is_disabled": {"$ne": True},
    }
    if body.section_id:
        student_filter["seccion_id"] = body.section_id
    students = await db.users.find(student_filter, {"_id": 0, "id": 1}).to_list(5000)
    if body.section_id and not students:
        student_filter["section_id"] = student_filter.pop("seccion_id")
        students = await db.users.find(student_filter, {"_id": 0, "id": 1}).to_list(5000)

    snapshots_created = 0
    snapshots_overwritten = 0
    snapshots_skipped_existing = 0
    errors: List[Dict[str, str]] = []
    now = datetime.now(timezone.utc).isoformat()

    for s in students:
        sid = s["id"]
        existing = await db.report_cards_snapshots.find_one(
            {"school_id": school_id, "student_id": sid, "period_id": body.period_id},
            {"_id": 0, "id": 1},
        )
        if existing and not force:
            snapshots_skipped_existing += 1
            continue
        try:
            # Generar libreta con period_id explícito (modo override)
            payload = await get_libreta(
                sid, period_id=body.period_id, year=None, current_user=current_user
            )
        except HTTPException as exc:
            errors.append({"student_id": sid, "error": str(exc.detail)})
            continue
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"[close-period] error en alumno {sid}: {exc}")
            errors.append({"student_id": sid, "error": "Error interno"})
            continue

        prev_meta = payload.get("metadata") or {}
        payload["metadata"] = {
            "generated_at": now,
            "is_snapshot": False,
            "period_closed": False,
            "year_closed": False,
            "libreta_mode": prev_meta.get("libreta_mode"),
            "show_padres_grade": bool(prev_meta.get("show_padres_grade", False)),
            "libreta_grade_format": prev_meta.get("libreta_grade_format") or "numeric",
            "hide_conducta_in_libreta": bool(prev_meta.get("hide_conducta_in_libreta", False)),
            "hide_tutor_comments_in_libreta": bool(prev_meta.get("hide_tutor_comments_in_libreta", False)),
            "hide_asistencia_in_libreta": bool(prev_meta.get("hide_asistencia_in_libreta", False)),
            "hide_situacion_final_in_libreta": bool(prev_meta.get("hide_situacion_final_in_libreta", False)),
            "tutor_comments_periods": prev_meta.get("tutor_comments_periods") or [],
            "print_format": prev_meta.get("print_format") or {},
            "header_template": prev_meta.get("header_template") or {},
            "color_palette": prev_meta.get("color_palette") or {},
            "cell_bold": prev_meta.get("cell_bold") or {},
            "cell_size": prev_meta.get("cell_size") or {},
            "all_bold": bool(prev_meta.get("all_bold", False)),
            "director_name": prev_meta.get("director_name") or "",
            "stamp_mode": prev_meta.get("stamp_mode") or "generated",
            "stamp_config": prev_meta.get("stamp_config") or {},
            "director_signature": prev_meta.get("director_signature") or "",
            "stamp_image": prev_meta.get("stamp_image") or "",
            "signature_layout": prev_meta.get("signature_layout") or {},
            "signature_block_offset": prev_meta.get("signature_block_offset", 30),
            "conducta_template_mode": prev_meta.get("conducta_template_mode") or "default",
        }

        doc = {
            "id": existing["id"] if existing else str(uuid.uuid4()),
            "school_id": school_id,
            "student_id": sid,
            "period_id": body.period_id,
            "year": period_year,
            "payload_json": payload,
            "closed_at": now,
            "closed_by": user["id"],
            "snapshot_version": "1.0",
        }
        if existing:
            await db.report_cards_snapshots.update_one({"id": existing["id"]}, {"$set": doc})
            snapshots_overwritten += 1
        else:
            await db.report_cards_snapshots.insert_one(doc)
            snapshots_created += 1

    no_action_taken = (
        snapshots_created == 0 and snapshots_overwritten == 0
        and snapshots_skipped_existing > 0 and not force
    )
    response = {
        "period_id": body.period_id,
        "period_name": period.get("nombre"),
        "section_id": body.section_id,
        "snapshots_created": snapshots_created,
        "snapshots_overwritten": snapshots_overwritten,
        "snapshots_skipped_existing": snapshots_skipped_existing,
        "errors": errors,
        "total_students": len(students),
    }
    if no_action_taken:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Las libretas de este bimestre ya están cerradas para todos los alumnos. Si necesitas actualizarlas, usa la opción 'Volver a generar las libretas'.",
                **response,
            },
        )
    return response


class ReopenPeriodBody(BaseModel):
    period_id: str
    section_id: Optional[str] = None
    student_id: Optional[str] = None
    reason: Optional[str] = None


@router.delete("/libreta/close-period")
async def reopen_period(
    body: ReopenPeriodBody,
    current_user=Depends(get_current_user),
):
    """Reabre un bimestre cerrado. Solo owner. Registra en `period_reopen_audit_log`."""
    user = await _require_user(current_user)
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Solo el propietario puede reabrir bimestres")

    school_id = user["school_id"]

    snap_q: Dict[str, Any] = {"school_id": school_id, "period_id": body.period_id}
    if body.student_id:
        snap_q["student_id"] = body.student_id
    elif body.section_id:
        # Filtrar alumnos de la sección
        sec_students = await db.users.find(
            {
                "school_id": school_id, "role": "student", "is_disabled": {"$ne": True},
                "$or": [{"seccion_id": body.section_id}, {"section_id": body.section_id}],
            }, {"_id": 0, "id": 1},
        ).to_list(5000)
        sec_ids = [s["id"] for s in sec_students]
        if not sec_ids:
            return {"deleted": 0, "period_id": body.period_id, "section_id": body.section_id}
        snap_q["student_id"] = {"$in": sec_ids}

    # Tomar snapshot que vamos a borrar (para audit)
    to_delete = await db.report_cards_snapshots.find(snap_q, {"_id": 0, "student_id": 1}).to_list(5000)
    del_res = await db.report_cards_snapshots.delete_many(snap_q)

    # Registrar audit log
    now = datetime.now(timezone.utc).isoformat()
    audit_doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "period_id": body.period_id,
        "section_id": body.section_id,
        "student_id": body.student_id,
        "students_affected": [s["student_id"] for s in to_delete],
        "reopened_by": user["id"],
        "reopened_at": now,
        "reason": body.reason,
    }
    await db.period_reopen_audit_log.insert_one(audit_doc)

    return {
        "deleted": del_res.deleted_count,
        "period_id": body.period_id,
        "section_id": body.section_id,
        "student_id": body.student_id,
        "audit_id": audit_doc["id"],
    }


# ════════════════════════════════════════════════════════════════════════════
# INDEX
# ════════════════════════════════════════════════════════════════════════════

async def ensure_libreta_indexes():
    try:
        await db.report_cards_snapshots.create_index(
            [("school_id", 1), ("student_id", 1), ("period_id", 1)],
            unique=True, name="uniq_snapshot_student_period",
        )
    except Exception as e:
        logger.warning(f"[libreta] snapshot index creation: {e}")
    try:
        await db.period_reopen_audit_log.create_index(
            [("school_id", 1), ("period_id", 1), ("reopened_at", -1)],
            name="audit_log_period_recent",
        )
    except Exception as e:
        logger.warning(f"[libreta] audit_log index creation: {e}")

