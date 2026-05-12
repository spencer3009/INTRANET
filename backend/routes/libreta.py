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
from pydantic import BaseModel
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
from services.grades_literal import numerica_a_letra, promedio_numerico

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
        raise HTTPException(status_code=404, detail="Sección no encontrada")

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
        raise HTTPException(status_code=404, detail="Sección no encontrada")

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
    current_user=Depends(get_current_user),
):
    """Genera el payload completo de la libreta del estudiante.

    Si `period_id` no viene, usa el periodo `activo: true` del colegio.
    """
    viewer = await _require_user(current_user)

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
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    section_id = student.get("seccion_id") or student.get("section_id")
    if not section_id:
        raise HTTPException(status_code=400, detail="El estudiante no tiene sección asignada")

    # 2) Validar permisos
    if not await _can_view_libreta(viewer, student, section_id):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta libreta")

    school_id = student["school_id"]

    # 3) Cargar school, section, grado, level (paralelo)
    section_doc = await db.sections.find_one(
        {"id": section_id, "school_id": school_id}, {"_id": 0}
    )
    if not section_doc:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    grado_id = section_doc.get("grado_id") or student.get("grado_id")

    school_doc = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "id": 1, "name": 1, "school_name": 1, "legal_name": 1, "logo_url": 1},
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
        raise HTTPException(status_code=400, detail="No hay periodos académicos configurados")

    active_period = next((p for p in all_periods if p.get("activo")), None) or all_periods[0]

    # Periodo solicitado (si viene)
    requested_period = None
    if period_id:
        requested_period = next((p for p in all_periods if p["id"] == period_id), None)
        if not requested_period:
            raise HTTPException(status_code=404, detail="Periodo no encontrado")

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

    # 6) Notas del alumno (todas las del año)
    student_grade_docs: List[dict] = []
    if subject_ids and period_ids:
        student_grade_docs = await db.student_grades.find(
            {
                "school_id": school_id,
                "student_id": student_id,
                "subject_id": {"$in": subject_ids},
                "period_id": {"$in": period_ids},
            },
            {"_id": 0, "subject_id": 1, "period_id": 1, "final_grade": 1},
        ).to_list(2000)

    # Lookup: notes[subject_id][period_id] = final_grade
    notes_lookup: Dict[str, Dict[str, Optional[float]]] = {}
    for g in student_grade_docs:
        notes_lookup.setdefault(g["subject_id"], {})[g["period_id"]] = g.get("final_grade")

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

    for s in subjects:
        # grades por periodo
        per_period: Dict[str, Dict[str, Any]] = {}
        finals_for_avg: List[float] = []
        for p in all_periods:
            num = notes_lookup.get(s["id"], {}).get(p["id"])
            per_period[p["id"]] = {
                "numeric": num,
                "letter": numerica_a_letra(num) if num is not None else None,
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
                "letter": numerica_a_letra(prom_num) if prom_num is not None else None,
            },
        }

        area_id = s.get("area_id")
        if area_id and area_id in areas_map:
            area = areas_map[area_id]
            if area_id not in by_area:
                by_area[area_id] = {
                    "id": area_id,
                    "name": area.get("name", ""),
                    "order": area.get("order", 999),
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
                "letter": numerica_a_letra(avg) if avg is not None else None,
            }
            if avg is not None:
                all_finals_for_area_final.append(avg)
        # Promedio FINAL del área = promedio de los promedios por bimestre
        final_avg = promedio_numerico(all_finals_for_area_final) if all_finals_for_area_final else None
        promedio_area["final"] = {
            "numeric": final_avg,
            "letter": numerica_a_letra(final_avg) if final_avg is not None else None,
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
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "is_snapshot": False,
            "year_closed": False,
        },
    }
