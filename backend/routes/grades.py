"""
Grades module: Registro Auxiliar + Consolidado de Notas
Handles grade entry, auto-save, period locking, and consolidated views.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid
import logging
import math

from .core import (
    db, get_current_user, resolve_user_from_token,
    require_role, require_admin, require_staff,
    is_admin_user, has_role, is_demo_user, check_demo_user_block,
    JWT_SECRET, JWT_ALGORITHM, now_iso, generate_id,
    ADMIN_ROLES, STAFF_ROLES, ACADEMIC_STUDENT_FILTER,
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class GradeEntry(BaseModel):
    student_id: str
    # Actitudinal sub-fields
    act_co: Optional[float] = None
    act_re: Optional[float] = None
    # Revisión de Fichas sub-fields
    rf_r1: Optional[float] = None
    rf_r2: Optional[float] = None
    rf_r3: Optional[float] = None
    rf_r4: Optional[float] = None
    rf_r5: Optional[float] = None
    # Competencia sub-fields
    comp_c1: Optional[float] = None
    comp_c2: Optional[float] = None
    # Participaciones sub-fields
    part_p1: Optional[float] = None
    part_p2: Optional[float] = None
    part_p3: Optional[float] = None
    part_exp: Optional[float] = None
    part_tg: Optional[float] = None
    part_p: Optional[float] = None
    # Single-column fields
    exam_mensual: Optional[float] = None
    exam_bimestral: Optional[float] = None

GRADE_SUB_FIELDS = [
    "act_co", "act_re",
    "rf_r1", "rf_r2", "rf_r3", "rf_r4", "rf_r5",
    "comp_c1", "comp_c2",
    "part_p1", "part_p2", "part_p3", "part_exp", "part_tg", "part_p",
    "exam_mensual", "exam_bimestral",
]

class GradeSaveRequest(BaseModel):
    subject_id: str
    section_id: str
    period_id: str
    grades: List[GradeEntry]

class EvalConfigUpdate(BaseModel):
    attitude_weight: Optional[float] = 0.10
    worksheets_weight: Optional[float] = 0.25
    competency_weight: Optional[float] = 0.05
    participation_weight: Optional[float] = 0.25
    monthly_exam_weight: Optional[float] = 0.15
    bimestral_exam_weight: Optional[float] = 0.20

class LockRequest(BaseModel):
    subject_id: str
    section_id: str
    period_id: str

# ══════════════════════════════════════════════════════════════════════════════
# HELPER: Calculate final grade
# ══════════════════════════════════════════════════════════════════════════════

def _avg(values):
    """Calculate average of non-None values. Returns None if all are None."""
    nums = [v for v in values if v is not None]
    if not nums:
        return None
    return round(sum(nums) / len(nums), 1)

def calculate_final_grade(grade: dict, config: dict) -> Optional[float]:
    """Calculate final bimestral grade from sub-fields using weighted averages."""
    # Calculate category averages from sub-fields
    act_avg = _avg([grade.get("act_co"), grade.get("act_re")])
    rf_avg = _avg([grade.get("rf_r1"), grade.get("rf_r2"), grade.get("rf_r3"), grade.get("rf_r4"), grade.get("rf_r5")])
    comp_avg = _avg([grade.get("comp_c1"), grade.get("comp_c2")])
    part_avg = _avg([grade.get("part_p1"), grade.get("part_p2"), grade.get("part_p3"), grade.get("part_exp"), grade.get("part_tg"), grade.get("part_p")])
    exam_mens = grade.get("exam_mensual")
    exam_bim = grade.get("exam_bimestral")

    weighted = [
        (act_avg, config.get("attitude_weight", 0.10)),
        (rf_avg, config.get("worksheets_weight", 0.25)),
        (comp_avg, config.get("competency_weight", 0.05)),
        (part_avg, config.get("participation_weight", 0.25)),
        (exam_mens, config.get("monthly_exam_weight", 0.15)),
        (exam_bim, config.get("bimestral_exam_weight", 0.20)),
    ]

    total = 0.0
    total_weight = 0.0
    for val, weight in weighted:
        if val is not None:
            total += val * weight
            total_weight += weight
    if total_weight == 0:
        return None
    result = total / total_weight if total_weight < 1.0 else total
    return round(result, 1)


# ══════════════════════════════════════════════════════════════════════════════
# EVALUATION CONFIG
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/grades/config/{subject_id}/{section_id}")
async def get_eval_config(subject_id: str, section_id: str, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    school_id = user.get("school_id")

    config = await db.evaluation_config.find_one(
        {"school_id": school_id, "subject_id": subject_id, "section_id": section_id},
        {"_id": 0}
    )
    if not config:
        config = {
            "attitude_weight": 0.10,
            "worksheets_weight": 0.25,
            "competency_weight": 0.05,
            "participation_weight": 0.25,
            "monthly_exam_weight": 0.15,
            "bimestral_exam_weight": 0.20,
        }
    return config

@router.put("/grades/config/{subject_id}/{section_id}")
async def update_eval_config(subject_id: str, section_id: str, data: EvalConfigUpdate, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    check_demo_user_block(user)
    school_id = user.get("school_id")

    # Validate weights sum to 1.0
    total = (data.attitude_weight + data.worksheets_weight + data.competency_weight +
             data.participation_weight + data.monthly_exam_weight + data.bimestral_exam_weight)
    if abs(total - 1.0) > 0.01:
        raise HTTPException(status_code=400, detail=f"Los pesos deben sumar 100%. Actualmente suman {total*100:.0f}%")

    config_data = {
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": section_id,
        **data.model_dump(),
        "updated_at": now_iso(),
        "updated_by": user["id"],
    }

    await db.evaluation_config.update_one(
        {"school_id": school_id, "subject_id": subject_id, "section_id": section_id},
        {"$set": config_data, "$setOnInsert": {"id": generate_id(), "created_at": now_iso()}},
        upsert=True
    )
    return {"message": "Configuracion actualizada"}


# ══════════════════════════════════════════════════════════════════════════════
# GET REGISTER (Registro Auxiliar)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/grades/register/{subject_id}/{section_id}/{period_id}")
async def get_grade_register(subject_id: str, section_id: str, period_id: str, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    school_id = user.get("school_id")
    role = user.get("role")

    # Teachers can only see their own assignments
    if role == "teacher":
        assignment = await db.academic_assignments.find_one({
            "school_id": school_id,
            "teacher_id": user["id"],
            "subject_id": subject_id,
            "section_id": section_id,
            "status": "activo"
        })
        if not assignment:
            raise HTTPException(status_code=403, detail="No tienes asignacion para este curso")

    # Get students in section
    section = await db.sections.find_one({"id": section_id}, {"_id": 0, "grado_id": 1})
    grade_id = section.get("grado_id") if section else None

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
        # Fallback: try with section_id field
        student_filter_alt = {
            "school_id": school_id,
            "role": "student",
            "student_status": {"$in": ["enrolled", "active"]},
            "section_id": section_id,
        }
        students = await db.users.find(
            student_filter_alt,
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "dni": 1}
        ).sort([("last_name", 1), ("name", 1)]).to_list(200)

    # Get existing grades
    grades = await db.student_grades.find(
        {"school_id": school_id, "subject_id": subject_id, "section_id": section_id, "period_id": period_id},
        {"_id": 0}
    ).to_list(200)
    grades_map = {g["student_id"]: g for g in grades}

    # Get eval config
    config = await db.evaluation_config.find_one(
        {"school_id": school_id, "subject_id": subject_id, "section_id": section_id},
        {"_id": 0}
    )
    if not config:
        config = {
            "attitude_weight": 0.10,
            "worksheets_weight": 0.25,
            "competency_weight": 0.05,
            "participation_weight": 0.25,
            "monthly_exam_weight": 0.15,
            "bimestral_exam_weight": 0.20,
        }

    # Get register status
    reg_status = await db.grade_register_status.find_one(
        {"school_id": school_id, "subject_id": subject_id, "section_id": section_id, "period_id": period_id},
        {"_id": 0}
    )

    # Build response
    student_grades = []
    for i, student in enumerate(students):
        g = grades_map.get(student["id"], {})
        entry = {
            "number": i + 1,
            "student_id": student["id"],
            "student_name": f"{student.get('last_name', '')} {student.get('name', '')}".strip(),
            # Actitudinal
            "act_co": g.get("act_co"),
            "act_re": g.get("act_re"),
            # Revisión Fichas
            "rf_r1": g.get("rf_r1"),
            "rf_r2": g.get("rf_r2"),
            "rf_r3": g.get("rf_r3"),
            "rf_r4": g.get("rf_r4"),
            "rf_r5": g.get("rf_r5"),
            # Competencia
            "comp_c1": g.get("comp_c1"),
            "comp_c2": g.get("comp_c2"),
            # Participaciones
            "part_p1": g.get("part_p1"),
            "part_p2": g.get("part_p2"),
            "part_p3": g.get("part_p3"),
            "part_exp": g.get("part_exp"),
            "part_tg": g.get("part_tg"),
            "part_p": g.get("part_p"),
            # Exámenes
            "exam_mensual": g.get("exam_mensual"),
            "exam_bimestral": g.get("exam_bimestral"),
            "final_grade": g.get("final_grade"),
        }
        student_grades.append(entry)

    # Get subject and period info
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0, "name": 1, "code": 1})
    period = await db.academic_periods.find_one({"id": period_id}, {"_id": 0, "nombre": 1})

    return {
        "students": student_grades,
        "config": {k: v for k, v in config.items() if k not in ("school_id", "subject_id", "section_id", "id", "created_at", "updated_at", "updated_by")},
        "status": reg_status.get("status", "open") if reg_status else "open",
        "locked_at": reg_status.get("locked_at") if reg_status else None,
        "locked_by_name": reg_status.get("locked_by_name") if reg_status else None,
        "subject_name": subject.get("name", "") if subject else "",
        "period_name": period.get("nombre", "") if period else "",
    }


# ══════════════════════════════════════════════════════════════════════════════
# SAVE / AUTOSAVE GRADES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/grades/save")
async def save_grades(data: GradeSaveRequest, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    check_demo_user_block(user)
    school_id = user.get("school_id")
    role = user.get("role")

    # Check if register is locked
    reg_status = await db.grade_register_status.find_one(
        {"school_id": school_id, "subject_id": data.subject_id, "section_id": data.section_id, "period_id": data.period_id}
    )
    if reg_status and reg_status.get("status") in ("closed", "approved"):
        if role not in ADMIN_ROLES:
            raise HTTPException(status_code=403, detail="El registro esta cerrado. Solo un administrador puede reabrirlo.")

    # Teachers can only save their own assignments
    if role == "teacher":
        assignment = await db.academic_assignments.find_one({
            "school_id": school_id,
            "teacher_id": user["id"],
            "subject_id": data.subject_id,
            "section_id": data.section_id,
            "status": "activo"
        })
        if not assignment:
            raise HTTPException(status_code=403, detail="No tienes asignacion para este curso")

    # Get eval config
    config = await db.evaluation_config.find_one(
        {"school_id": school_id, "subject_id": data.subject_id, "section_id": data.section_id},
        {"_id": 0}
    )
    if not config:
        config = {
            "attitude_weight": 0.10, "worksheets_weight": 0.25, "competency_weight": 0.05,
            "participation_weight": 0.25, "monthly_exam_weight": 0.15, "bimestral_exam_weight": 0.20,
        }

    saved_count = 0
    for entry in data.grades:
        grade_data = {}
        for field in GRADE_SUB_FIELDS:
            grade_data[field] = getattr(entry, field, None)

        # Validate grades are 0-20
        for field, val in grade_data.items():
            if val is not None and (val < 0 or val > 20):
                raise HTTPException(status_code=400, detail=f"Nota invalida para {field}: {val}. Debe ser entre 0 y 20")

        # Calculate final grade
        final = calculate_final_grade(grade_data, config)
        grade_data["final_grade"] = final
        grade_data["updated_at"] = now_iso()
        grade_data["updated_by"] = user["id"]

        await db.student_grades.update_one(
            {
                "school_id": school_id,
                "student_id": entry.student_id,
                "subject_id": data.subject_id,
                "section_id": data.section_id,
                "period_id": data.period_id,
            },
            {
                "$set": grade_data,
                "$setOnInsert": {
                    "id": generate_id(),
                    "school_id": school_id,
                    "student_id": entry.student_id,
                    "subject_id": data.subject_id,
                    "section_id": data.section_id,
                    "period_id": data.period_id,
                    "teacher_id": user["id"],
                    "created_at": now_iso(),
                }
            },
            upsert=True
        )
        saved_count += 1

    return {"message": f"{saved_count} notas guardadas", "saved": saved_count}

@router.post("/grades/autosave")
async def autosave_grades(data: GradeSaveRequest, current_user=Depends(get_current_user)):
    """Same as save but with lighter response for auto-save"""
    return await save_grades(data, current_user)


# ══════════════════════════════════════════════════════════════════════════════
# LOCK / UNLOCK PERIOD
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/grades/lock_period")
async def lock_period(data: LockRequest, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    check_demo_user_block(user)
    school_id = user.get("school_id")

    await db.grade_register_status.update_one(
        {"school_id": school_id, "subject_id": data.subject_id, "section_id": data.section_id, "period_id": data.period_id},
        {
            "$set": {
                "status": "closed",
                "locked_at": now_iso(),
                "locked_by": user["id"],
                "locked_by_name": f"{user.get('name','')} {user.get('last_name','')}".strip(),
            },
            "$setOnInsert": {
                "id": generate_id(),
                "school_id": school_id,
                "subject_id": data.subject_id,
                "section_id": data.section_id,
                "period_id": data.period_id,
                "created_at": now_iso(),
            }
        },
        upsert=True
    )
    return {"message": "Registro cerrado exitosamente"}

@router.post("/grades/unlock_period")
async def unlock_period(data: LockRequest, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo un administrador puede reabrir el registro")
    school_id = user.get("school_id")

    await db.grade_register_status.update_one(
        {"school_id": school_id, "subject_id": data.subject_id, "section_id": data.section_id, "period_id": data.period_id},
        {"$set": {"status": "open", "unlocked_at": now_iso(), "unlocked_by": user["id"]}}
    )
    return {"message": "Registro reabierto exitosamente"}


# ══════════════════════════════════════════════════════════════════════════════
# CONSOLIDATED VIEW
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/grades/consolidated/{section_id}/{period_id}")
async def get_consolidated(section_id: str, period_id: str, current_user=Depends(get_current_user)):
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    school_id = user.get("school_id")

    # Get section info
    section = await db.sections.find_one({"id": section_id}, {"_id": 0})
    if not section:
        raise HTTPException(status_code=404, detail="Seccion no encontrada")

    grade_id = section.get("grado_id")

    # Get all subjects for this section
    subjects = await db.subjects.find(
        {"school_id": school_id, "section_id": section_id},
        {"_id": 0, "id": 1, "name": 1, "code": 1}
    ).sort("name", 1).to_list(50)

    if not subjects:
        # Fallback: get subjects for this grade
        subjects = await db.subjects.find(
            {"school_id": school_id, "grade_id": grade_id},
            {"_id": 0, "id": 1, "name": 1, "code": 1}
        ).sort("name", 1).to_list(50)

    subject_ids = [s["id"] for s in subjects]

    # Get students in section (try seccion_id first, then section_id)
    student_filter = {
        "school_id": school_id,
        "role": "student",
        "student_status": {"$in": ["enrolled", "active"]},
        "seccion_id": section_id,
    }
    students = await db.users.find(
        student_filter,
        {"_id": 0, "id": 1, "name": 1, "last_name": 1}
    ).sort([("last_name", 1), ("name", 1)]).to_list(200)

    if not students:
        student_filter["section_id"] = student_filter.pop("seccion_id")
        students = await db.users.find(
            student_filter,
            {"_id": 0, "id": 1, "name": 1, "last_name": 1}
        ).sort([("last_name", 1), ("name", 1)]).to_list(200)

    # Get all grades for this section/period
    all_grades = await db.student_grades.find(
        {"school_id": school_id, "section_id": section_id, "period_id": period_id, "subject_id": {"$in": subject_ids}},
        {"_id": 0, "student_id": 1, "subject_id": 1, "final_grade": 1}
    ).to_list(5000)

    # Build grades lookup: {student_id: {subject_id: final_grade}}
    grades_lookup = {}
    for g in all_grades:
        sid = g["student_id"]
        if sid not in grades_lookup:
            grades_lookup[sid] = {}
        grades_lookup[sid][g["subject_id"]] = g.get("final_grade")

    # Build consolidated data
    consolidated = []
    for i, student in enumerate(students):
        student_data = {
            "number": i + 1,
            "student_id": student["id"],
            "student_name": f"{student.get('last_name', '')} {student.get('name', '')}".strip(),
            "grades": {},
            "average": None,
        }
        grades_for_student = grades_lookup.get(student["id"], {})
        valid_grades = []
        for subj in subjects:
            grade_val = grades_for_student.get(subj["id"])
            student_data["grades"][subj["id"]] = grade_val
            if grade_val is not None:
                valid_grades.append(grade_val)

        if valid_grades:
            student_data["average"] = round(sum(valid_grades) / len(valid_grades), 1)

        consolidated.append(student_data)

    # Sort by average descending for ranking
    ranked = sorted([s for s in consolidated if s["average"] is not None], key=lambda x: -x["average"])
    for rank, student in enumerate(ranked):
        student["rank"] = rank + 1
    # Students without average get no rank
    for student in consolidated:
        if "rank" not in student:
            student["rank"] = None

    # Get period and section names
    period = await db.academic_periods.find_one({"id": period_id}, {"_id": 0, "nombre": 1})
    grade = await db.grades.find_one({"id": grade_id}, {"_id": 0, "nombre": 1})

    return {
        "students": consolidated,
        "subjects": [{"id": s["id"], "name": s["name"], "code": s.get("code", "")} for s in subjects],
        "section_name": section.get("nombre", ""),
        "grade_name": grade.get("nombre", "") if grade else "",
        "period_name": period.get("nombre", "") if period else "",
    }


# ══════════════════════════════════════════════════════════════════════════════
# EXPORT CONSOLIDATED (Excel)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/grades/consolidated/{section_id}/{period_id}/export/excel")
async def export_consolidated_excel(section_id: str, period_id: str, current_user=Depends(get_current_user)):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from fastapi.responses import StreamingResponse
    import io

    data = await get_consolidated(section_id, period_id, current_user)

    wb = Workbook()
    ws = wb.active
    ws.title = "Consolidado"

    # Styles
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=10)
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )
    red_fill = PatternFill(start_color="FF6B6B", end_color="FF6B6B", fill_type="solid")
    yellow_fill = PatternFill(start_color="FFD93D", end_color="FFD93D", fill_type="solid")
    green_fill = PatternFill(start_color="6BCB77", end_color="6BCB77", fill_type="solid")

    # Title
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=3 + len(data["subjects"]) + 2)
    title_cell = ws.cell(row=1, column=1, value=f"CONSOLIDADO DE NOTAS - {data['grade_name']} {data['section_name']} - {data['period_name']}")
    title_cell.font = Font(bold=True, size=14)
    title_cell.alignment = center

    # Headers
    row = 3
    headers = ["N°", "Apellidos y Nombres"] + [s["name"] for s in data["subjects"]] + ["Promedio", "Puesto"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center
        cell.border = thin_border

    # Data
    for student in data["students"]:
        row += 1
        ws.cell(row=row, column=1, value=student["number"]).border = thin_border
        ws.cell(row=row, column=1).alignment = center
        ws.cell(row=row, column=2, value=student["student_name"]).border = thin_border

        for j, subj in enumerate(data["subjects"]):
            grade_val = student["grades"].get(subj["id"])
            cell = ws.cell(row=row, column=3 + j, value=grade_val)
            cell.alignment = center
            cell.border = thin_border
            if grade_val is not None:
                if grade_val < 10:
                    cell.fill = red_fill
                elif grade_val <= 13:
                    cell.fill = yellow_fill
                else:
                    cell.fill = green_fill

        avg_col = 3 + len(data["subjects"])
        avg_cell = ws.cell(row=row, column=avg_col, value=student["average"])
        avg_cell.alignment = center
        avg_cell.border = thin_border
        avg_cell.font = Font(bold=True)
        if student["average"] is not None:
            if student["average"] < 10:
                avg_cell.fill = red_fill
            elif student["average"] <= 13:
                avg_cell.fill = yellow_fill
            else:
                avg_cell.fill = green_fill

        rank_cell = ws.cell(row=row, column=avg_col + 1, value=student["rank"])
        rank_cell.alignment = center
        rank_cell.border = thin_border
        rank_cell.font = Font(bold=True)

    # Column widths
    ws.column_dimensions["A"].width = 5
    ws.column_dimensions["B"].width = 30
    for i in range(len(data["subjects"]) + 2):
        col_letter = chr(67 + i) if i < 24 else chr(65) + chr(65 + i - 24)
        try:
            ws.column_dimensions[col_letter].width = 14
        except:
            pass

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"consolidado_{data['grade_name']}_{data['section_name']}_{data['period_name']}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.spreadsheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
