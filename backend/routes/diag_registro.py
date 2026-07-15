"""
Diagnostic — Registro Auxiliar
==============================

TEMPORARY READ-ONLY tooling to inspect Registro Auxiliar plantillas and
student_grades rows. Used to track down cases where the frontend renders
empty cells because the data lives in legacy static fields while the
active template expects dynamic keys (or vice-versa).

Access is restricted to platform owners and support sessions. ABSOLUTELY
NO WRITES — every handler uses `db.find` / `db.count_documents` only.
"""

import re
import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Query

from .core import db, get_current_user, resolve_user_from_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/diag", tags=["diagnostics"])


LEGACY_GRADE_FIELDS = [
    "act_co", "act_re",
    "rf_r1", "rf_r2", "rf_r3", "rf_r4", "rf_r5",
    "comp_c1", "comp_c2",
    "part_p1", "part_p2", "part_p3", "part_exp", "part_tg", "part_p",
    "exam_mensual", "exam_bimestral",
]


async def _require_owner_or_support(current_user) -> dict:
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    is_owner = user.get("role") == "owner" or user.get("is_owner") is True
    is_support = user.get("is_support_session") is True or user.get("is_super_admin") is True
    if not (is_owner or is_support):
        raise HTTPException(status_code=403, detail="Solo propietarios o soporte pueden acceder a esta herramienta")
    return user


@router.get("/plantilla")
async def diag_get_plantilla(
    nombre: str = Query(..., description="Nombre exacto o parcial de la plantilla"),
    school_name: Optional[str] = Query(None, description="Nombre del colegio (parcial, case-insensitive)"),
    school_id: Optional[str] = Query(None, description="ID exacto de colegio si lo conoces"),
    current_user=Depends(get_current_user),
):
    """Find Registro Auxiliar plantilla(s) by name + optional school. Returns
    the full document of each match, including every criterio + subcolumna
    with id/label/field_key/tipo. READ-ONLY."""
    await _require_owner_or_support(current_user)

    # School filter — accept either id or fuzzy name
    school_ids: Optional[List[str]] = None
    matched_schools = []
    if school_id:
        school_ids = [school_id]
        s = await db.schools.find_one({"id": school_id}, {"_id": 0, "id": 1, "name": 1})
        if s:
            matched_schools = [s]
    elif school_name:
        regex = {"$regex": re.escape(school_name), "$options": "i"}
        schools = await db.schools.find({"name": regex}, {"_id": 0, "id": 1, "name": 1}).to_list(50)
        matched_schools = schools
        school_ids = [s["id"] for s in schools]
        if not school_ids:
            return {
                "query": {"nombre": nombre, "school_name": school_name, "school_id": school_id},
                "matched_schools": [],
                "warning": "Ningún colegio coincide con ese nombre",
                "results": [],
            }

    # Plantilla filter — name regex + (optional) school filter
    query: dict = {"nombre": {"$regex": re.escape(nombre), "$options": "i"}}
    if school_ids is not None:
        query["school_id"] = {"$in": school_ids}

    plantillas = await db.registro_auxiliar_plantillas.find(query, {"_id": 0}).to_list(50)

    school_name_by_id = {s["id"]: s.get("name") for s in matched_schools}
    if school_ids is None:
        ids_to_resolve = list({p.get("school_id") for p in plantillas if p.get("school_id")})
        if ids_to_resolve:
            extra = await db.schools.find(
                {"id": {"$in": ids_to_resolve}}, {"_id": 0, "id": 1, "name": 1}
            ).to_list(50)
            for s in extra:
                school_name_by_id[s["id"]] = s.get("name")

    results = []
    for p in plantillas:
        criterios_view = []
        seen_sub_ids = {}
        for cri in p.get("criterios", []) or []:
            subs_view = []
            for sub in cri.get("subcolumnas", []) or []:
                sid = sub.get("id")
                seen_sub_ids.setdefault(sid, []).append(cri.get("nombre"))
                subs_view.append({
                    "id": sid,
                    "field_key": sub.get("field_key"),
                    "label": sub.get("label"),
                    "tipo": sub.get("tipo") or "input",
                })
            criterios_view.append({
                "criterio_id": cri.get("id"),
                "criterio_nombre": cri.get("nombre"),
                "porcentaje": cri.get("porcentaje"),
                "subcolumnas": subs_view,
            })

        # Highlight any duplicate subcolumn ids (very rare but worth flagging)
        duplicate_subcol_ids = [
            {"id": k, "occurrences": v}
            for k, v in seen_sub_ids.items() if len(v) > 1
        ]

        columnas_finales_view = []
        for col in p.get("columnas_finales", []) or []:
            columnas_finales_view.append({
                "id": col.get("id"),
                "field_key": col.get("field_key"),
                "label": col.get("label"),
                "tipo": col.get("tipo"),
                "porcentaje": col.get("porcentaje"),
            })

        results.append({
            "plantilla_id": p.get("id"),
            "nombre": p.get("nombre"),
            "es_sistema": p.get("es_sistema"),
            "estado": p.get("estado"),
            "es_predeterminada": p.get("es_predeterminada"),
            "school_id": p.get("school_id"),
            "school_name": school_name_by_id.get(p.get("school_id")),
            "label_promedio_final": p.get("label_promedio_final"),
            "escala_minima": p.get("escala_minima"),
            "escala_maxima": p.get("escala_maxima"),
            "created_at": p.get("created_at"),
            "updated_at": p.get("updated_at"),
            "criterios": criterios_view,
            "columnas_finales": columnas_finales_view,
            "duplicate_subcol_ids": duplicate_subcol_ids,
        })

    return {
        "query": {"nombre": nombre, "school_name": school_name, "school_id": school_id},
        "matched_schools": matched_schools,
        "total_results": len(results),
        "results": results,
    }


@router.get("/grades-legacy-only")
async def diag_grades_legacy_only(
    school_id: Optional[str] = Query(None, description="Filtra a un colegio en particular"),
    limit_samples: int = Query(5, ge=0, le=50, description="Cuántas filas-muestra incluir por grupo"),
    current_user=Depends(get_current_user),
):
    """Count student_grades docs where `grades_dynamic` is empty {} (or missing)
    AND at least one legacy field is populated (non-null).

    Returns: total count + per-school / per-subject / per-period breakdown,
    optionally with a small sample of student_ids per group. READ-ONLY."""
    await _require_owner_or_support(current_user)

    legacy_or = [{f: {"$ne": None}} for f in LEGACY_GRADE_FIELDS]
    legacy_or.extend([{f: {"$exists": True, "$ne": None}} for f in LEGACY_GRADE_FIELDS])

    base_match: dict = {
        "$and": [
            {"$or": [
                {"grades_dynamic": {"$exists": False}},
                {"grades_dynamic": {}},
                {"grades_dynamic": None},
            ]},
            {"$or": [{f: {"$ne": None}} for f in LEGACY_GRADE_FIELDS]},
        ]
    }
    if school_id:
        base_match["school_id"] = school_id

    total = await db.student_grades.count_documents(base_match)

    pipeline = [
        {"$match": base_match},
        {"$group": {
            "_id": {
                "school_id": "$school_id",
                "subject_id": "$subject_id",
                "section_id": "$section_id",
                "period_id": "$period_id",
            },
            "rows": {"$sum": 1},
            "sample_students": {"$push": "$student_id"},
        }},
        {"$sort": {"rows": -1}},
        {"$limit": 500},
    ]
    grouped = await db.student_grades.aggregate(pipeline).to_list(500)

    # Resolve names (best-effort, only for groups returned)
    school_ids = list({g["_id"]["school_id"] for g in grouped if g["_id"].get("school_id")})
    subject_ids = list({g["_id"]["subject_id"] for g in grouped if g["_id"].get("subject_id")})
    period_ids = list({g["_id"]["period_id"] for g in grouped if g["_id"].get("period_id")})
    section_ids = list({g["_id"]["section_id"] for g in grouped if g["_id"].get("section_id")})

    schools = await db.schools.find({"id": {"$in": school_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(200) if school_ids else []
    subjects = await db.subjects.find({"id": {"$in": subject_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(2000) if subject_ids else []
    periods = await db.academic_periods.find({"id": {"$in": period_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(200) if period_ids else []
    sections = await db.sections.find({"id": {"$in": section_ids}}, {"_id": 0, "id": 1, "name": 1, "grade_name": 1}).to_list(500) if section_ids else []

    sname = {s["id"]: s.get("name") for s in schools}
    subjname = {s["id"]: s.get("name") for s in subjects}
    pname = {p["id"]: p.get("name") for p in periods}
    secname = {s["id"]: f"{s.get('grade_name', '')} {s.get('name', '')}".strip() for s in sections}

    breakdown = []
    for g in grouped:
        key = g["_id"]
        samples = g.get("sample_students") or []
        breakdown.append({
            "school_id":  key.get("school_id"),
            "school":     sname.get(key.get("school_id")),
            "subject_id": key.get("subject_id"),
            "subject":    subjname.get(key.get("subject_id")),
            "section_id": key.get("section_id"),
            "section":    secname.get(key.get("section_id")),
            "period_id":  key.get("period_id"),
            "period":     pname.get(key.get("period_id")),
            "affected_rows": g["rows"],
            "sample_students": samples[:limit_samples],
        })

    return {
        "query": {"school_id": school_id, "limit_samples": limit_samples},
        "criteria": {
            "grades_dynamic": "missing OR empty {} OR null",
            "legacy_fields_required_any_non_null": LEGACY_GRADE_FIELDS,
        },
        "total_affected_docs": total,
        "groups_returned": len(breakdown),
        "by_school_subject_period": breakdown,
    }



# ══════════════════════════════════════════════════════════════════════════
# DUPLICATE SUBJECTS DETECTOR + CLEANUP  (SUPPORT ONLY)
# ══════════════════════════════════════════════════════════════════════════

async def _require_support(current_user) -> dict:
    """Support-only guard (destructive/sensitive tooling)."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    is_support = (
        user.get("role") == "system_admin_global"
        or user.get("is_support_session") is True
        or user.get("is_super_admin") is True
        or user.get("is_support_global") is True
    )
    if not is_support:
        raise HTTPException(status_code=403, detail="Solo soporte técnico puede acceder a esta herramienta")
    return user


async def _resolve_school_ids(school_id: Optional[str], school_name: Optional[str]):
    if school_id:
        s = await db.schools.find_one({"id": school_id}, {"_id": 0, "id": 1, "name": 1})
        return ([school_id], [s] if s else [])
    if school_name:
        regex = {"$regex": re.escape(school_name), "$options": "i"}
        schools = await db.schools.find({"name": regex}, {"_id": 0, "id": 1, "name": 1}).to_list(50)
        return ([s["id"] for s in schools], schools)
    return (None, [])


async def _subject_impact(school_id: str, subject_id: str, section_id: Optional[str]):
    flt = {"school_id": school_id, "subject_id": subject_id}
    assignments = await db.academic_assignments.count_documents(flt)
    materials = await db.course_posts.count_documents({**flt, "type": "material"})
    tasks = await db.course_posts.count_documents({**flt, "type": "task"})
    exams = await db.online_exams.count_documents(flt)
    grades = await db.student_grades.count_documents(flt)
    students = 0
    if section_id:
        students = await db.users.count_documents(
            {"school_id": school_id, "role": "student", "seccion_id": section_id})
    return {
        "assignments": assignments, "materials": materials, "tasks": tasks,
        "exams": exams, "grades": grades, "students_in_section": students,
        "activity_score": assignments + materials + tasks + exams + grades,
    }


@router.get("/duplicate-subjects")
async def diag_duplicate_subjects(
    school_id: Optional[str] = Query(None),
    school_name: Optional[str] = Query(None),
    section_id: Optional[str] = Query(None, description="Filtrar a una sola sección (opcional)"),
    current_user=Depends(get_current_user),
):
    """SUPPORT ONLY (read-only). Detecta asignaturas duplicadas dentro de una
    misma sección (mismo section_id + mismo nombre normalizado). Para cada grupo
    marca cuál es el ORIGINAL (el de mayor actividad; empate → el más antiguo) y
    cuáles son DUPLICADOS, con el impacto de cada uno para decidir con seguridad."""
    await _require_support(current_user)
    school_ids, matched = await _resolve_school_ids(school_id, school_name)
    if school_ids is not None and not school_ids:
        return {"matched_schools": [], "warning": "Ningún colegio coincide", "groups": []}
    if not school_ids or len(school_ids) != 1:
        raise HTTPException(status_code=400, detail="Indica un colegio (school_id o nombre exacto de un solo colegio)")

    sid_school = school_ids[0]
    subj_query = {"school_id": sid_school}
    if section_id:
        subj_query["section_id"] = section_id
    subjects = await db.subjects.find(subj_query, {"_id": 0}).to_list(5000)

    # Cache section names
    sec_ids = list({s.get("section_id") for s in subjects if s.get("section_id")})
    sections = {s["id"]: s for s in await db.sections.find({"id": {"$in": sec_ids}}, {"_id": 0, "id": 1, "nombre": 1, "grado_id": 1}).to_list(5000)}
    grade_ids = list({s.get("grado_id") for s in sections.values() if s.get("grado_id")})
    grades = {g["id"]: g.get("nombre") for g in await db.grades.find({"id": {"$in": grade_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(2000)}

    # Group by (section_id, normalized name)
    groups_map = {}
    for s in subjects:
        key = (s.get("section_id"), (s.get("name") or "").strip().lower())
        groups_map.setdefault(key, []).append(s)

    groups = []
    for (sec_id, _), grp in groups_map.items():
        if len(grp) <= 1:
            continue
        items = []
        for s in grp:
            impact = await _subject_impact(sid_school, s["id"], sec_id)
            items.append({
                "subject_id": s["id"],
                "name": s.get("name"),
                "code": s.get("code"),
                "created_at": s.get("created_at"),
                "impact": impact,
            })
        # Original = highest activity; tie-break oldest created_at.
        items.sort(key=lambda x: (-x["impact"]["activity_score"], str(x.get("created_at") or "")))
        for i, it in enumerate(items):
            it["role"] = "original" if i == 0 else "duplicado"
            it["role_label"] = (
                "ORIGINAL (mantener) — es el que tiene más actividad/datos"
                if i == 0 else
                "DUPLICADO (candidato a eliminar) — sin actividad o creado después"
            )
        sec = sections.get(sec_id, {})
        groups.append({
            "section_id": sec_id,
            "section_name": sec.get("nombre") or "(sin sección)",
            "grade_name": grades.get(sec.get("grado_id"), ""),
            "name": grp[0].get("name"),
            "count": len(grp),
            "subjects": items,
        })

    groups.sort(key=lambda g: (g["grade_name"], g["section_name"], g["name"]))
    return {
        "school_id": sid_school,
        "school_name": (matched[0].get("name") if matched else None),
        "has_duplicates": bool(groups),
        "group_count": len(groups),
        "groups": groups,
    }


@router.delete("/duplicate-subjects/{subject_id}")
async def diag_delete_duplicate_subject(
    subject_id: str,
    school_id: str = Query(..., description="ID del colegio (obligatorio por seguridad)"),
    current_user=Depends(get_current_user),
):
    """SUPPORT ONLY. Elimina una asignatura duplicada y limpia TODAS sus
    referencias (asignaciones, notas, config de evaluación, posts, exámenes) para
    no dejar huérfanos. Requiere school_id explícito."""
    await _require_support(current_user)
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "section_id": 1})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada en ese colegio")

    flt = {"school_id": school_id, "subject_id": subject_id}
    deleted = {
        "assignments": (await db.academic_assignments.delete_many(flt)).deleted_count,
        "grades": (await db.student_grades.delete_many(flt)).deleted_count,
        "evaluation_config": (await db.evaluation_config.delete_many(flt)).deleted_count,
        "grade_register_status": (await db.grade_register_status.delete_many(flt)).deleted_count,
        "subject_teachers": (await db.subject_teachers.delete_many(flt)).deleted_count,
        "course_posts": (await db.course_posts.delete_many(flt)).deleted_count,
        "online_exams": (await db.online_exams.delete_many(flt)).deleted_count,
        "subject": (await db.subjects.delete_one({"id": subject_id, "school_id": school_id})).deleted_count,
    }
    logger.info(f"[DIAG-DUP-DELETE] subject {subject_id} ('{subject.get('name')}') school={school_id} deleted={deleted}")
    return {"ok": True, "deleted_subject": {"id": subject_id, "name": subject.get("name")}, "cleaned": deleted}



# ══════════════════════════════════════════════════════════════════════════════
# FINAL GRADE DIAGNOSTIC — why does a subject show grade X in the Consolidado?
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/final-grade")
async def diag_final_grade(
    student_name: str = Query(..., description="Nombre o apellido del alumno (parcial)"),
    subject_name: Optional[str] = Query(None, description="Nombre del curso (parcial)"),
    period_name: Optional[str] = Query(None, description="Nombre del periodo (parcial, ej. '2do')"),
    school_name: Optional[str] = Query(None, description="Nombre del colegio (parcial)"),
    school_id: Optional[str] = Query(None, description="ID exacto del colegio"),
    current_user=Depends(get_current_user),
):
    """Muestra, para un alumno/curso/periodo, la nota guardada, la recalculada y el
    desglose paso a paso (criterios, columnas finales, pesos), más la fórmula de la
    plantilla activa. READ-ONLY. Para diagnosticar diferencias entre el Registro
    Auxiliar y el Consolidado."""
    await _require_owner_or_support(current_user)

    from services.register_sync import get_active_template_for_school
    from routes.grades import (
        calculate_final_grade, _criterio_avg, _resolve_dynamic_value, GRADE_SUB_FIELDS,
    )

    # Resolve school
    sid = school_id
    if not sid and school_name:
        s = await db.schools.find_one({"name": {"$regex": re.escape(school_name), "$options": "i"}}, {"_id": 0, "id": 1})
        sid = s["id"] if s else None
    if not sid:
        u = await resolve_user_from_token(current_user)
        sid = u.get("school_id")
    if not sid:
        raise HTTPException(status_code=400, detail="No se pudo determinar el colegio")

    # Resolve students by name/last_name — token-based so "Samuel Perez" matches
    # name~Samuel AND last_name~Perez (in any order).
    tokens = [t for t in re.split(r"\s+", student_name.strip()) if t]
    and_clauses = []
    for tok in tokens:
        rx = {"$regex": re.escape(tok), "$options": "i"}
        and_clauses.append({"$or": [{"name": rx}, {"last_name": rx}, {"dni": rx}]})
    stu_query = {"school_id": sid, "role": "student"}
    if and_clauses:
        stu_query["$and"] = and_clauses
    students = await db.users.find(
        stu_query,
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "grado_id": 1, "seccion_id": 1},
    ).to_list(30)
    if not students:
        sample = await db.users.find(
            {"school_id": sid, "role": "student"},
            {"_id": 0, "name": 1, "last_name": 1},
        ).limit(15).to_list(15)
        sample_names = [f"{s.get('name','')} {s.get('last_name','')}".strip() for s in sample]
        return {"school_id": sid, "warning": "Ningún alumno coincide con ese nombre",
                "ejemplos_de_nombres_en_este_colegio": sample_names, "students": []}

    template = await get_active_template_for_school(db, sid)
    is_custom = bool(template and not template.get("es_sistema"))

    def _breakdown(g):
        """Return the per-criterio / per-columna-final breakdown for a grade doc."""
        grades_dyn = g.get("grades_dynamic") or {}
        out = {"modo": (template or {}).get("modo_ponderacion") or "criterio", "es_sistema": (template or {}).get("es_sistema", True)}
        if not is_custom:
            out["nota"] = "Plantilla del Sistema (algoritmo estático)"
            return out
        crits = []
        for c in template.get("criterios") or []:
            subs = []
            for s in c.get("subcolumnas") or []:
                subs.append({"id": s.get("id"), "label": s.get("label"), "tipo": s.get("tipo"),
                             "value": _resolve_dynamic_value(s.get("id"), s.get("field_key"), g, grades_dyn)})
            crits.append({"id": c.get("id"), "nombre": c.get("nombre"), "porcentaje": c.get("porcentaje"),
                          "promedio_criterio": _criterio_avg(c, g, grades_dyn), "subcolumnas": subs})
        finales = []
        for col in template.get("columnas_finales") or []:
            finales.append({"id": col.get("id"), "label": col.get("label"), "porcentaje": col.get("porcentaje"),
                            "value": _resolve_dynamic_value(col.get("id"), col.get("field_key"), g, grades_dyn)})
        grupos = template.get("grupos") or []
        out.update({"criterios": crits, "columnas_finales": finales, "grupos": grupos})
        return out

    results = []
    for stu in students:
        gq = {"school_id": sid, "student_id": stu["id"]}
        if period_name:
            periods = await db.academic_periods.find(
                {"school_id": sid, "nombre": {"$regex": re.escape(period_name), "$options": "i"}},
                {"_id": 0, "id": 1, "nombre": 1}).to_list(10)
            if periods:
                gq["period_id"] = {"$in": [p["id"] for p in periods]}
        grade_docs = await db.student_grades.find(gq, {"_id": 0}).to_list(300)

        subj_ids = list({d.get("subject_id") for d in grade_docs if d.get("subject_id")})
        subj_docs = await db.subjects.find({"id": {"$in": subj_ids}}, {"_id": 0, "id": 1, "name": 1, "section_id": 1}).to_list(500)
        subj_by_id = {s["id"]: s for s in subj_docs}

        rows = []
        for d in grade_docs:
            subj = subj_by_id.get(d.get("subject_id"), {})
            if subject_name and subject_name.lower() not in (subj.get("name") or "").lower():
                continue
            stored = d.get("final_grade")
            manual = d.get("final_grade_manual")
            recomputed = None
            try:
                recomputed = calculate_final_grade(d, {}, template=template) if is_custom else None
            except Exception as e:
                recomputed = f"ERROR: {e}"
            rows.append({
                "subject_id": d.get("subject_id"),
                "subject_name": subj.get("name"),
                "section_id": subj.get("section_id") or d.get("section_id"),
                "period_id": d.get("period_id"),
                "final_grade_stored": stored,
                "final_grade_manual": manual,
                "final_grade_recomputed": recomputed,
                "display_stored": (round(stored) if isinstance(stored, (int, float)) else None),
                "display_recomputed": (round(recomputed) if isinstance(recomputed, (int, float)) else None),
                "breakdown": _breakdown(d),
            })
        results.append({
            "student": {"id": stu["id"], "name": f"{stu.get('last_name','')} {stu.get('name','')}".strip()},
            "grades": rows,
        })

    return {
        "school_id": sid,
        "template": {"id": (template or {}).get("id"), "nombre": (template or {}).get("nombre"),
                     "es_sistema": (template or {}).get("es_sistema"), "is_custom": is_custom,
                     "modo_ponderacion": (template or {}).get("modo_ponderacion")},
        "students": results,
    }
