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
