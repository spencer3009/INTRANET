# -*- coding: utf-8 -*-
"""
Áreas Curriculares — gestión + migración inicial MINEDU.

Cada documento de la colección `curricular_areas` es:
    { id, school_id, name, order, color, is_active, created_at, updated_at }

Solo `owner`/`admin`/`director` pueden mutar. Listar lo puede cualquier rol
autenticado del mismo colegio (lo usan los selectores del registro auxiliar y
la libreta del estudiante).
"""
import logging
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routes.core import (
    db,
    get_current_user,
    resolve_user_from_token,
    ADMIN_ROLES,
)

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────
class CurricularAreaIn(BaseModel):
    name: str
    order: int = 0
    color: Optional[str] = "#0F172A"


class CurricularAreaUpdate(BaseModel):
    name: Optional[str] = None
    order: Optional[int] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class SubjectAreaIn(BaseModel):
    area_id: Optional[str] = None  # null = desvincular


# ─────────────────────────────────────────────────────────────────────────────
# Defaults MINEDU + fuzzy-match para la migración inicial
# ─────────────────────────────────────────────────────────────────────────────
DEFAULT_AREAS = [
    {"name": "Comunicación", "order": 1},
    {"name": "Matemática", "order": 2},
    {"name": "Inglés", "order": 3},
    {"name": "Ciencia y Tecnología", "order": 4},
    {"name": "Ciencias Sociales", "order": 5},
    {"name": "Desarrollo Personal, Ciudadanía y Cívica", "order": 6},
    {"name": "Educación Religiosa", "order": 7},
    {"name": "Educación Física", "order": 8},
    {"name": "Arte y Cultura", "order": 9},
    {"name": "Educación para el Trabajo", "order": 10},
]

FUZZY_MAP = {
    "Comunicación": ["comunicac", "lenguaje", "literatura", "plan lector", "raz. verbal", "razonamiento verbal", "raz verbal"],
    "Matemática": ["matemat", "algebra", "geometr", "aritmet", "trigonometr", "raz. matem", "razonamiento matem", "raz matem"],
    "Inglés": ["ingles", "english"],
    "Ciencia y Tecnología": ["ciencia", "tecnolog", "fisica", "quimica", "biolog"],
    "Ciencias Sociales": ["historia", "geografia", "ciencias sociales", "hist universal", "hist. del peru", "hist del peru"],
    "Desarrollo Personal, Ciudadanía y Cívica": ["desarrollo personal", "ciudadan", "civica", "psicolog", "economia", "valores", "dpcc"],
    "Educación Religiosa": ["religi"],
    "Educación Física": ["educacion fisica", "ed. fisica", "ed fisica"],
    "Arte y Cultura": ["arte", "musica"],
    "Educación para el Trabajo": ["ept", "trabajo", "computacion"],
}


def _slug(s: str) -> str:
    """Normaliza: minúsculas + sin tildes/ñ → n."""
    if not s:
        return ""
    s = s.strip().lower()
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _resolve_area_by_subject_name(subject_name: str) -> Optional[str]:
    """Devuelve el nombre del área canónica que matchea, o None."""
    s = _slug(subject_name)
    if not s:
        return None
    # Match más específico primero (longitud del fragmento)
    matches = []
    for area_name, fragments in FUZZY_MAP.items():
        for frag in fragments:
            if frag in s:
                matches.append((len(frag), area_name))
                break
    if not matches:
        return None
    matches.sort(reverse=True)  # mayor longitud primero
    return matches[0][1]


def _serialize(area: dict) -> dict:
    """Excluye _id y normaliza datetimes a ISO."""
    return {
        "id": area.get("id"),
        "name": area.get("name"),
        "order": area.get("order", 0),
        "color": area.get("color"),
        "is_active": area.get("is_active", True),
        "created_at": area.get("created_at"),
        "updated_at": area.get("updated_at"),
    }


async def _require_admin(current_user) -> dict:
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden gestionar áreas curriculares")
    return user


# ─────────────────────────────────────────────────────────────────────────────
# CRUD
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/curricular-areas")
async def list_curricular_areas(
    include_inactive: bool = Query(False),
    current_user=Depends(get_current_user),
):
    """Lista las áreas del colegio del usuario. Permitido a cualquier rol autenticado."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    school_id = user["school_id"]
    query = {"school_id": school_id}
    if not include_inactive:
        query["is_active"] = {"$ne": False}
    cursor = db.curricular_areas.find(query, {"_id": 0}).sort([("order", 1), ("name", 1)])
    areas = await cursor.to_list(200)

    # Conteo de asignaturas por área (solo activas) — útil para la UI
    counts = {}
    pipeline = [
        {"$match": {"school_id": school_id, "area_id": {"$ne": None},
                    "status": {"$ne": "deleted"}}},
        {"$group": {"_id": "$area_id", "count": {"$sum": 1}}},
    ]
    async for row in db.subjects.aggregate(pipeline):
        counts[row["_id"]] = row["count"]

    return [{**_serialize(a), "subjects_count": counts.get(a["id"], 0)} for a in areas]


@router.post("/curricular-areas")
async def create_curricular_area(
    payload: CurricularAreaIn,
    current_user=Depends(get_current_user),
):
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del área es obligatorio")

    # Unicidad por nombre dentro del colegio (case-insensitive)
    existing = await db.curricular_areas.find_one(
        {"school_id": school_id, "name": {"$regex": f"^{name}$", "$options": "i"}},
        {"_id": 0, "id": 1},
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un área con ese nombre")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "name": name,
        "order": payload.order,
        "color": payload.color or "#0F172A",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.curricular_areas.insert_one(doc)
    return _serialize(doc)


@router.put("/curricular-areas/{area_id}")
async def update_curricular_area(
    area_id: str,
    payload: CurricularAreaUpdate,
    current_user=Depends(get_current_user),
):
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    area = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0})
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")

    update_fields = {}
    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        if new_name.lower() != (area.get("name") or "").lower():
            dup = await db.curricular_areas.find_one(
                {"school_id": school_id, "name": {"$regex": f"^{new_name}$", "$options": "i"},
                 "id": {"$ne": area_id}},
                {"_id": 0, "id": 1},
            )
            if dup:
                raise HTTPException(status_code=409, detail="Ya existe un área con ese nombre")
        update_fields["name"] = new_name
    if payload.order is not None:
        update_fields["order"] = payload.order
    if payload.color is not None:
        update_fields["color"] = payload.color
    if payload.is_active is not None:
        update_fields["is_active"] = payload.is_active

    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.curricular_areas.update_one({"id": area_id, "school_id": school_id}, {"$set": update_fields})

    updated = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0})
    return _serialize(updated)


@router.delete("/curricular-areas/{area_id}")
async def delete_curricular_area(area_id: str, current_user=Depends(get_current_user)):
    """Soft delete: marca is_active=false. Asignaturas vinculadas quedan
    huérfanas (area_id apunta a un área inactiva). Para reasignarlas,
    desde la UI."""
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    res = await db.curricular_areas.update_one(
        {"id": area_id, "school_id": school_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    return {"message": "Área desactivada"}


@router.put("/subjects/{subject_id}/area")
async def assign_subject_area(
    subject_id: str,
    payload: SubjectAreaIn,
    current_user=Depends(get_current_user),
):
    """Vincula (o desvincula con area_id=null) una asignatura a un área."""
    user = await _require_admin(current_user)
    school_id = user["school_id"]

    subj = await db.subjects.find_one({"id": subject_id, "school_id": school_id}, {"_id": 0, "id": 1, "name": 1})
    if not subj:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")

    area_doc = None
    if payload.area_id:
        area_doc = await db.curricular_areas.find_one(
            {"id": payload.area_id, "school_id": school_id}, {"_id": 0}
        )
        if not area_doc:
            raise HTTPException(status_code=404, detail="Área no encontrada")

    update_fields = {
        "area_id": payload.area_id,
        "area_name": area_doc.get("name") if area_doc else None,
        "area_order": area_doc.get("order") if area_doc else None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.subjects.update_one({"id": subject_id, "school_id": school_id}, {"$set": update_fields})
    return {"message": "Área asignada", "subject_id": subject_id, "area_id": payload.area_id}


# ─────────────────────────────────────────────────────────────────────────────
# Gestión manual de asignaturas vinculadas (Fase 1 — listado + bulk link/unlink)
# ─────────────────────────────────────────────────────────────────────────────
class SubjectBulkIn(BaseModel):
    subject_ids: List[str] = Field(default_factory=list, min_length=1)


async def _enrich_subjects(school_id: str, subjects: List[dict]) -> List[dict]:
    """Agrega grade_name, section_name, teacher_name, current_area_name a cada subject."""
    grade_ids = list({s.get("grade_id") for s in subjects if s.get("grade_id")})
    section_ids = list({s.get("section_id") for s in subjects if s.get("section_id")})
    teacher_ids = list({s.get("teacher_id") for s in subjects if s.get("teacher_id")})
    area_ids = list({s.get("area_id") for s in subjects if s.get("area_id")})

    grades = {g["id"]: g async for g in db.grades.find({"id": {"$in": grade_ids}, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1})} if grade_ids else {}
    sections = {x["id"]: x async for x in db.sections.find({"id": {"$in": section_ids}, "school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1})} if section_ids else {}
    teachers = {t["id"]: t async for t in db.users.find({"id": {"$in": teacher_ids}, "school_id": school_id}, {"_id": 0, "id": 1, "first_name": 1, "last_name": 1})} if teacher_ids else {}
    areas = {a["id"]: a async for a in db.curricular_areas.find({"id": {"$in": area_ids}, "school_id": school_id}, {"_id": 0, "id": 1, "name": 1})} if area_ids else {}

    result = []
    for s in subjects:
        g = grades.get(s.get("grade_id"))
        sec = sections.get(s.get("section_id"))
        t = teachers.get(s.get("teacher_id"))
        a = areas.get(s.get("area_id"))
        teacher_name = None
        if t:
            teacher_name = f"{(t.get('first_name') or '').strip()} {(t.get('last_name') or '').strip()}".strip() or None
        result.append({
            "id": s["id"],
            "name": s.get("name"),
            "code": s.get("code"),
            "grade_id": s.get("grade_id"),
            "grade_name": g.get("nombre") if g else None,
            "section_id": s.get("section_id"),
            "section_name": sec.get("nombre") if sec else None,
            "teacher_id": s.get("teacher_id"),
            "teacher_name": teacher_name,
            "current_area_id": s.get("area_id"),
            "current_area_name": a.get("name") if a else s.get("area_name"),
        })
    return result


@router.get("/curricular-areas/{area_id}/subjects")
async def list_area_subjects(
    area_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None),
    grade_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    """Lista paginada de asignaturas vinculadas al área.

    Restringido a owner/admin/director del mismo colegio (consistente con
    el resto de endpoints de gestión de áreas).

    Excluye asignaturas con `status: deleted`.
    """
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    area = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0, "id": 1})
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")

    query = {
        "school_id": school_id,
        "area_id": area_id,
        "status": {"$ne": "deleted"},
    }
    if search:
        query["name"] = {"$regex": search.strip(), "$options": "i"}
    if grade_id:
        query["grade_id"] = grade_id

    total = await db.subjects.count_documents(query)
    skip = (page - 1) * page_size
    docs = await db.subjects.find(query, {"_id": 0}).sort([("name", 1)]).skip(skip).limit(page_size).to_list(page_size)
    subjects = await _enrich_subjects(school_id, docs)
    return {"subjects": subjects, "total": total, "page": page, "page_size": page_size}


@router.get("/curricular-areas/{area_id}/available-subjects")
async def list_available_subjects(
    area_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None),
    unassigned_only: bool = Query(False),
    current_user=Depends(get_current_user),
):
    """Asignaturas del colegio que NO están vinculadas al área actual.
    Con `unassigned_only=true` solo devuelve las que no tienen área."""
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    area = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0, "id": 1})
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")

    query = {
        "school_id": school_id,
        "status": {"$ne": "deleted"},
    }
    if unassigned_only:
        query["$or"] = [{"area_id": {"$exists": False}}, {"area_id": None}]
    else:
        # Cualquiera excepto el área actual
        query["$or"] = [
            {"area_id": {"$exists": False}},
            {"area_id": None},
            {"area_id": {"$ne": area_id}},
        ]
    if search:
        query["name"] = {"$regex": search.strip(), "$options": "i"}

    total = await db.subjects.count_documents(query)
    skip = (page - 1) * page_size
    docs = await db.subjects.find(query, {"_id": 0}).sort([("name", 1)]).skip(skip).limit(page_size).to_list(page_size)
    subjects = await _enrich_subjects(school_id, docs)
    return {"subjects": subjects, "total": total, "page": page, "page_size": page_size}


@router.post("/curricular-areas/{area_id}/subjects/unlink")
async def bulk_unlink_subjects(
    area_id: str,
    payload: SubjectBulkIn,
    current_user=Depends(get_current_user),
):
    """Desvincula múltiples asignaturas del área (`area_id` queda `null`).

    Comportamiento de **fallo parcial (best-effort)**:
    - Procesa todas las asignaturas válidas en una sola operación de Mongo.
    - Si alguna asignatura no existe, no pertenece al área o tiene `status: deleted`,
      se reporta individualmente en `errors[]` con su motivo y se omite del update.
    - No hay rollback global: las asignaturas válidas SÍ se desvinculan aunque
      otras del mismo request fallen.

    Response:
    - `unlinked_count`: cantidad efectivamente actualizada
    - `unlinked`: `[{subject_id, subject_name}]` — útil para feedback al usuario
    - `errors`: `[{subject_id, error}]` — motivo individual por cada fallo
    """
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    area = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0, "id": 1, "name": 1})
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")

    ids = list({s for s in payload.subject_ids if s})
    if not ids:
        raise HTTPException(status_code=400, detail="Debes indicar al menos una asignatura para desvincular")

    # Asignaturas válidas: del colegio, del área, y NO soft-deleted
    matching = await db.subjects.find(
        {
            "id": {"$in": ids},
            "school_id": school_id,
            "area_id": area_id,
            "status": {"$ne": "deleted"},
        },
        {"_id": 0, "id": 1, "name": 1},
    ).to_list(1000)
    matching_ids = [m["id"] for m in matching]

    # Identificar el motivo de cada fallo individual (best-effort, no rollback)
    errors: List[dict] = []
    for nf in set(ids) - set(matching_ids):
        # Inspeccionar si existe pero está deleted / en otra área / fuera del tenant
        ref = await db.subjects.find_one({"id": nf, "school_id": school_id}, {"_id": 0, "status": 1, "area_id": 1})
        if not ref:
            errors.append({"subject_id": nf, "error": "La asignatura no existe en tu colegio."})
        elif ref.get("status") == "deleted":
            errors.append({"subject_id": nf, "error": "La asignatura está eliminada."})
        elif ref.get("area_id") != area_id:
            errors.append({"subject_id": nf, "error": "La asignatura no pertenece a esta área."})
        else:
            errors.append({"subject_id": nf, "error": "No se pudo desvincular."})

    unlinked: List[dict] = []
    if matching_ids:
        now = datetime.now(timezone.utc).isoformat()
        res = await db.subjects.update_many(
            {"id": {"$in": matching_ids}, "school_id": school_id, "status": {"$ne": "deleted"}},
            {"$set": {"area_id": None, "area_name": None, "area_order": None, "updated_at": now}},
        )
        unlinked = [{"subject_id": m["id"], "subject_name": m.get("name")} for m in matching]
        logger.info(f"[curricular_areas] unlink area={area_id} count={res.modified_count} by={user.get('id')}")
        unlinked_count = res.modified_count
    else:
        unlinked_count = 0

    return {"unlinked_count": unlinked_count, "unlinked": unlinked, "errors": errors}


@router.post("/curricular-areas/{area_id}/subjects/link")
async def bulk_link_subjects(
    area_id: str,
    payload: SubjectBulkIn,
    current_user=Depends(get_current_user),
):
    """Vincula múltiples asignaturas al área.

    Si una asignatura ya estaba vinculada a otra área, registra la reasignación
    en `reassigned[]` y sobrescribe el `area_id`. Las asignaturas ya vinculadas
    al mismo área NO se cuentan en `linked_count` (no se contabilizan no-ops).

    Comportamiento de **fallo parcial (best-effort)**:
    - Procesa todas las asignaturas válidas en una sola operación de Mongo.
    - Si una asignatura no existe en el colegio o tiene `status: deleted`,
      se reporta en `errors[]` con su motivo y se omite del update.
    - No hay rollback global: las válidas SÍ se vinculan aunque otras fallen.

    Response:
    - `linked_count`: cantidad efectivamente actualizada
    - `reassigned`: `[{subject_id, subject_name, previous_area_id, previous_area_name, new_area_id, new_area_name}]`
    - `errors`: `[{subject_id, error}]`
    """
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    area = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0})
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")

    ids = list({s for s in payload.subject_ids if s})
    if not ids:
        raise HTTPException(status_code=400, detail="Debes indicar al menos una asignatura para vincular")

    # Asignaturas válidas (excluye deleted)
    existing = await db.subjects.find(
        {"id": {"$in": ids}, "school_id": school_id, "status": {"$ne": "deleted"}},
        {"_id": 0, "id": 1, "name": 1, "area_id": 1, "area_name": 1},
    ).to_list(1000)
    existing_map = {s["id"]: s for s in existing}

    # Errores individuales (best-effort)
    errors: List[dict] = []
    for nid in set(ids) - set(existing_map.keys()):
        ref = await db.subjects.find_one({"id": nid, "school_id": school_id}, {"_id": 0, "status": 1})
        if not ref:
            errors.append({"subject_id": nid, "error": "La asignatura no existe en tu colegio."})
        elif ref.get("status") == "deleted":
            errors.append({"subject_id": nid, "error": "La asignatura está eliminada."})
        else:
            errors.append({"subject_id": nid, "error": "No se pudo vincular."})

    # Separar reasignaciones de vínculos nuevos
    reassigned: List[dict] = []
    to_update_ids: List[str] = []
    for sid, s in existing_map.items():
        prev_area_id = s.get("area_id")
        if prev_area_id == area_id:
            # Ya estaba en esta área, no se cuenta (no-op)
            continue
        if prev_area_id:
            reassigned.append({
                "subject_id": sid,
                "subject_name": s.get("name"),
                "previous_area_id": prev_area_id,
                "previous_area_name": s.get("area_name"),
                "new_area_id": area_id,
                "new_area_name": area.get("name"),
            })
        to_update_ids.append(sid)

    linked_count = 0
    if to_update_ids:
        now = datetime.now(timezone.utc).isoformat()
        res = await db.subjects.update_many(
            {"id": {"$in": to_update_ids}, "school_id": school_id, "status": {"$ne": "deleted"}},
            {"$set": {
                "area_id": area_id,
                "area_name": area.get("name"),
                "area_order": area.get("order"),
                "updated_at": now,
            }},
        )
        linked_count = res.modified_count
        logger.info(
            f"[curricular_areas] link area={area_id} new={linked_count} "
            f"reassigned={len(reassigned)} by={user.get('id')}"
        )

    return {"linked_count": linked_count, "reassigned": reassigned, "errors": errors}


# Índice para acelerar las consultas por área (idempotente — se ejecuta al startup)
async def ensure_curricular_subject_indexes():
    try:
        await db.subjects.create_index(
            [("school_id", 1), ("area_id", 1), ("status", 1)],
            name="idx_subjects_school_area_status",
        )
        await db.subjects.create_index(
            [("school_id", 1), ("name", 1)],
            name="idx_subjects_school_name",
        )
    except Exception as e:
        logger.warning(f"[curricular_areas] index creation: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Migración inicial — Seed áreas estándar + fuzzy-match a asignaturas
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/migration/seed-curricular-areas")
async def seed_curricular_areas(current_user=Depends(get_current_user)):
    """Inicializa las 10 áreas MINEDU para el colegio del usuario y vincula
    asignaturas existentes por fuzzy-match. Idempotente: re-llamarlo NO crea
    duplicados ni sobrescribe áreas ya asignadas.

    Devuelve conteos:
      { areas_created, areas_already_existing, subjects_assigned,
        subjects_unassigned, unassigned_list }
    """
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()

    # 1) Crear áreas que no existan aún (match case-insensitive)
    existing_areas = await db.curricular_areas.find(
        {"school_id": school_id}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(200)
    existing_by_slug = {_slug(a["name"]): a for a in existing_areas}
    areas_created = 0
    name_to_id = {a["name"]: a["id"] for a in existing_areas}
    for default in DEFAULT_AREAS:
        key = _slug(default["name"])
        if key in existing_by_slug:
            name_to_id[default["name"]] = existing_by_slug[key]["id"]
            continue
        new = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "name": default["name"],
            "order": default["order"],
            "color": "#0F172A",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        await db.curricular_areas.insert_one(new)
        name_to_id[default["name"]] = new["id"]
        areas_created += 1

    # 2) Fuzzy-match sobre asignaturas sin área
    subjects = await db.subjects.find(
        {
            "school_id": school_id,
            "status": {"$ne": "deleted"},
            "$or": [{"area_id": {"$exists": False}}, {"area_id": None}],
        },
        {"_id": 0, "id": 1, "name": 1},
    ).to_list(1000)

    subjects_assigned = 0
    unassigned_list: List[str] = []
    for s in subjects:
        target_area = _resolve_area_by_subject_name(s.get("name", ""))
        if target_area and target_area in name_to_id:
            area_id = name_to_id[target_area]
            target_order = next((a["order"] for a in DEFAULT_AREAS if a["name"] == target_area), None)
            await db.subjects.update_one(
                {"id": s["id"], "school_id": school_id},
                {"$set": {
                    "area_id": area_id,
                    "area_name": target_area,
                    "area_order": target_order,
                    "updated_at": now,
                }},
            )
            subjects_assigned += 1
        else:
            unassigned_list.append(s.get("name") or s["id"])

    logger.info(
        f"[curricular_areas] seed school={school_id} "
        f"areas_created={areas_created} subjects_assigned={subjects_assigned} "
        f"unassigned={len(unassigned_list)}"
    )

    return {
        "areas_created": areas_created,
        "areas_already_existing": len(DEFAULT_AREAS) - areas_created,
        "subjects_assigned": subjects_assigned,
        "subjects_unassigned": len(unassigned_list),
        "unassigned_list": unassigned_list[:50],  # tope de payload
    }
