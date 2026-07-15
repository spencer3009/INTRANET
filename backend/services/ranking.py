# -*- coding: utf-8 -*-
"""
Helper compartido para calcular ORDEN DE MÉRITO y TERCIO de alumnos de una
sección en un período determinado.

Refactorizado desde `routes/grades.py::get_consolidated_report` (líneas 700-810).
La libreta individual y el consolidado de notas consumen ESTE helper para
garantizar resultados idénticos.

Comportamiento:
    1. Cada `student_grades.final_grade` se redondea a entero (mismo criterio
       que el consolidado actual).
    2. `puntaje`  = suma de notas redondeadas.
    3. `promedio` = suma / nº de notas, redondeado a 2 decimales.
    4. Ranking ordena por (-puntaje, last_name+name).
    5. Tercio:  posición/total ≤ 1/3 → SUP
                 posición/total ≤ 2/3 → MED
                 resto              → INF
    6. `cursos_desaprobados` = nº de notas < 11.
"""
from typing import Dict, List, Optional, TypedDict


class RankingInfo(TypedDict):
    puntaje: Optional[int]
    promedio: Optional[float]
    orden_merito: Optional[int]
    tercio: Optional[str]              # "SUP" | "MED" | "INF" | None
    cursos_desaprobados: int


async def compute_ranking(
    db,
    school_id: str,
    section_id: str,
    period_id: str,
) -> Dict[str, RankingInfo]:
    """Devuelve {student_id: RankingInfo} para todos los alumnos de la sección.

    El alumno sin notas obtiene `puntaje=None, promedio=None, orden_merito=None,
    tercio=None, cursos_desaprobados=0`.
    """
    # 1) Alumnos activos de la sección (orden alfabético APELLIDO, NOMBRE)
    student_filter = {
        "school_id": school_id,
        "role": "student",
        "student_status": {"$in": ["enrolled", "active"]},
        "seccion_id": section_id,
    }
    students = await db.users.find(
        student_filter,
        {"_id": 0, "id": 1, "name": 1, "last_name": 1},
    ).sort([("last_name", 1), ("name", 1)]).to_list(500)

    # Compatibilidad: algunos colegios usan `section_id` en vez de `seccion_id`
    if not students:
        student_filter["section_id"] = student_filter.pop("seccion_id")
        students = await db.users.find(
            student_filter,
            {"_id": 0, "id": 1, "name": 1, "last_name": 1},
        ).sort([("last_name", 1), ("name", 1)]).to_list(500)

    # 2) Asignaturas de la sección (incluye las del grado como fallback)
    section = await db.sections.find_one(
        {"id": section_id, "school_id": school_id}, {"_id": 0, "grado_id": 1}
    )
    grado_id = section.get("grado_id") if section else None

    subjects = await db.subjects.find(
        {"school_id": school_id, "section_id": section_id, "status": {"$ne": "inactive"}},
        {"_id": 0, "id": 1},
    ).to_list(200)
    if not subjects and grado_id:
        subjects = await db.subjects.find(
            {"school_id": school_id, "grade_id": grado_id, "status": {"$ne": "inactive"}},
            {"_id": 0, "id": 1},
        ).to_list(200)
    subject_ids = [s["id"] for s in subjects]

    # 3) Notas finales de los alumnos — fetch full row so we can recompute
    # final_grade on-the-fly when a school uses a CUSTOM dynamic template.
    all_grades: List[dict] = []
    if subject_ids:
        all_grades = await db.student_grades.find(
            {
                "school_id": school_id,
                "section_id": section_id,
                "period_id": period_id,
                "subject_id": {"$in": subject_ids},
            },
            {"_id": 0},
        ).to_list(20000)

    # Pre-load active template + fallback recomputer for custom (dynamic) schools.
    from services.register_sync import get_active_template_for_school
    from routes.grades import calculate_final_grade, GRADE_SUB_FIELDS
    template = await get_active_template_for_school(db, school_id)
    is_custom_template = bool(template and not template.get("es_sistema"))

    grades_lookup: Dict[str, Dict[str, Optional[float]]] = {}
    for g in all_grades:
        sid = g["student_id"]
        manual = g.get("final_grade_manual")
        if manual is not None:
            grades_lookup.setdefault(sid, {})[g["subject_id"]] = manual
            continue
        final_val = g.get("final_grade")
        if is_custom_template and (g.get("grades_dynamic") or any(g.get(f) is not None for f in GRADE_SUB_FIELDS)):
            try:
                recomputed = calculate_final_grade(g, {}, template=template)
                if recomputed is not None:
                    final_val = recomputed
            except Exception:
                pass
        grades_lookup.setdefault(sid, {})[g["subject_id"]] = final_val

    # 4) Calcular puntaje, promedio, desaprobados por alumno
    rows: List[Dict] = []
    for s in students:
        st_grades = grades_lookup.get(s["id"], {})
        rounded_grades: List[int] = []
        desaprobados = 0
        for subj_id in subject_ids:
            val = st_grades.get(subj_id)
            if val is None:
                continue
            try:
                rv = int(round(float(val)))
            except (TypeError, ValueError):
                continue
            rounded_grades.append(rv)
            if rv < 11:
                desaprobados += 1

        puntaje = sum(rounded_grades) if rounded_grades else None
        promedio = (
            round(sum(rounded_grades) / len(rounded_grades), 2)
            if rounded_grades
            else None
        )
        rows.append({
            "student_id": s["id"],
            "tiebreak": f"{(s.get('last_name') or '')} {(s.get('name') or '')}".strip(),
            "puntaje": puntaje,
            "promedio": promedio,
            "cursos_desaprobados": desaprobados,
        })

    # 5) Ranking — sólo alumnos con puntaje
    ranked = sorted(
        [r for r in rows if r["puntaje"] is not None],
        key=lambda r: (-r["puntaje"], r["tiebreak"]),
    )
    total_ranked = len(ranked)

    result: Dict[str, RankingInfo] = {}
    for r in rows:
        result[r["student_id"]] = {
            "puntaje": r["puntaje"],
            "promedio": r["promedio"],
            "orden_merito": None,
            "tercio": None,
            "cursos_desaprobados": r["cursos_desaprobados"],
        }

    for idx, r in enumerate(ranked):
        rank = idx + 1
        pos = rank / total_ranked if total_ranked else 0
        if pos <= 1 / 3:
            tercio = "SUP"
        elif pos <= 2 / 3:
            tercio = "MED"
        else:
            tercio = "INF"
        result[r["student_id"]]["orden_merito"] = rank
        result[r["student_id"]]["tercio"] = tercio

    return result
