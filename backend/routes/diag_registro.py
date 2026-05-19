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
