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
    scope_grade_ids: Optional[List[str]] = None  # None/[] = global; lista = scope acotado


class CurricularAreaUpdate(BaseModel):
    name: Optional[str] = None
    order: Optional[int] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    scope_grade_ids: Optional[List[str]] = None  # None = no tocar; [] = volver a global; lista = nuevo scope


class SubjectAreaIn(BaseModel):
    area_id: Optional[str] = None  # null = desvincular


# ─────────────────────────────────────────────────────────────────────────────
# Helpers de unicidad por scope de grados
# ─────────────────────────────────────────────────────────────────────────────
async def _find_name_conflict(school_id: str, name: str, scope_grade_ids, exclude_id: Optional[str] = None):
    """Busca un área existente con el mismo nombre cuyo scope se solape con el nuevo.

    Reglas:
      - Si el área NUEVA tiene scope_grade_ids vacío/None → es global; conflictúa con
        cualquier otra área del mismo nombre (sin importar su scope).
      - Si el área EXISTENTE es global → conflictúa con cualquier nueva del mismo nombre.
      - Si ambas tienen scope específico → conflictúa solo si comparten al menos un grado.
    Retorna el documento conflictivo o None.
    """
    query = {
        "school_id": school_id,
        "name": {"$regex": f"^{name}$", "$options": "i"},
    }
    if exclude_id:
        query["id"] = {"$ne": exclude_id}

    candidates = await db.curricular_areas.find(
        query, {"_id": 0, "id": 1, "name": 1, "scope_grade_ids": 1}
    ).to_list(50)

    new_scope = set(scope_grade_ids or [])

    for c in candidates:
        existing_scope = set(c.get("scope_grade_ids") or [])
        # Cualquiera de las dos es global → conflicto total con ese nombre
        if not new_scope or not existing_scope:
            return c
        # Ambas tienen scope acotado → conflicto solo si comparten algún grado
        if new_scope & existing_scope:
            return c
    return None


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
    """Normaliza un nombre a su "group_key" canónico.

    Patrón arquitectónico (introducido en sprint Feb-2026 / módulo Áreas):
    EduNet guarda 1 doc en `subjects` por cada (grado, sección) — por eso un
    colegio mediano tiene ~90 instancias de "Comunicación" (1 por sección).
    Para que el director gestione vinculaciones a nivel conceptual y no por
    instancia, el módulo de Áreas Curriculares **agrupa** por este slug.

    Reglas: minúsculas + trim + NFD (descompone) + filtra marcas combinatorias
    (Mn). Resultado: "Aritmética A" y "ARITMETICA-A" colapsan al mismo grupo;
    "Aritmética" y "Aritmetica B" NO colapsan (los sufijos cuentan).

    NOTA: este helper es la fuente de verdad de la agrupación en TODOS los
    endpoints de `/curricular-areas/{id}/subjects(*)`. No reusarlo desde
    `register_sync.py` (allí la normalización es de keys de columnas
    de plantilla, no de nombres de asignaturas — son dominios distintos).
    """
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
        "scope_grade_ids": area.get("scope_grade_ids") or [],
        "created_at": area.get("created_at"),
        "updated_at": area.get("updated_at"),
    }


def _compute_scope_label(scope_grade_ids: list, grades_by_id: dict) -> str:
    """Produce un label legible del scope de un área.

    Reglas:
    - vacío/None → "Global (todos los grados)"
    - 1 grado → "Inicial · 3 años"
    - varios contiguos del mismo nivel → "Primaria · 1° a 6°"
    - rangos partidos → "Primaria · 4° a 6° + Secundaria · 1° a 5°"
    - sin contigüidad → enumeración corta
    """
    if not scope_grade_ids:
        return "Global (todos los grados)"
    grades = [grades_by_id.get(gid) for gid in scope_grade_ids if grades_by_id.get(gid)]
    if not grades:
        return "Grados no encontrados"
    # agrupar por nivel
    by_lvl: dict = {}
    for g in grades:
        lid = g.get("level_id")
        by_lvl.setdefault(lid, {"level_name": g.get("level_name"), "level_order": g.get("level_order", 0), "items": []})
        by_lvl[lid]["items"].append(g)
    parts = []
    for lvl in sorted(by_lvl.values(), key=lambda x: x["level_order"]):
        items = sorted(lvl["items"], key=lambda g: g.get("order", 0))
        names = [g.get("name") or "" for g in items]
        if len(items) == 1:
            parts.append(f"{lvl['level_name']} · {names[0]}")
        else:
            parts.append(f"{lvl['level_name']} · {names[0]} a {names[-1]}")
    return " + ".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# Sprint B — Scope por grado en vinculaciones área↔asignatura
#
# Cada doc en `subjects` ya tiene `grade_id` (65/70 en El Roble) — los pocos sin
# grade_id son templates conceptuales que se tratan como bucket "(sin grado)".
# El scope por grado vive en la RELACIÓN área↔subject (campo `area_id` del
# subject) — no en el área (que sigue siendo única y global).
# ─────────────────────────────────────────────────────────────────────────────
async def _load_school_grade_index(school_id: str) -> dict:
    """Lee niveles + grados del colegio y devuelve estructuras para enriquecer
    respuestas y construir atajos dinámicos. NO asume hardcoded nivels."""
    levels = {}
    async for lvl_doc in db.academic_levels.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "orden": 1}):
        levels[lvl_doc["id"]] = {"id": lvl_doc["id"], "name": lvl_doc.get("nombre"), "order": lvl_doc.get("orden", 0)}

    grades_by_id: dict = {}
    grades_by_level: dict = {lid: [] for lid in levels.keys()}
    async for G in db.grades.find({"school_id": school_id, "activo": {"$ne": False}}, {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1, "orden": 1}):
        lvl = levels.get(G.get("nivel_id")) or {"name": None, "order": 0}
        info = {
            "id": G["id"],
            "name": G.get("nombre"),
            "order": G.get("orden", 0),
            "level_id": G.get("nivel_id"),
            "level_name": lvl["name"],
            "level_order": lvl["order"],
        }
        grades_by_id[G["id"]] = info
        if G.get("nivel_id") in grades_by_level:
            grades_by_level[G["nivel_id"]].append(info)

    for lid in grades_by_level:
        grades_by_level[lid].sort(key=lambda g: g["order"])

    return {"levels": levels, "grades_by_id": grades_by_id, "grades_by_level": grades_by_level}


@router.get("/curricular-areas/grade-shortcuts")
async def grade_shortcuts(current_user=Depends(get_current_user)):
    """Atajos dinámicos para selección de grados destino al vincular asignaturas.

    Lee dinámicamente niveles/grados del colegio. NO hardcodea "Primaria 1-6" si
    el colegio sólo llega hasta 4° Primaria. Para SECUNDARIA, además devuelve
    sub-atajos "1°-3°" y "4°-5°" (división MINEDU típica) cuando existan los
    grados respectivos.

    Response: `{shortcuts: [{key, label, grade_ids: [...]}], grades: [{id,name,level_name,level_order,grade_order}]}`
    """
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    idx = await _load_school_grade_index(school_id)
    levels_sorted = sorted(idx["levels"].values(), key=lambda x: x["order"])

    all_grades = []
    for lvl in levels_sorted:
        all_grades.extend(idx["grades_by_level"].get(lvl["id"], []))

    shortcuts: list = []
    if all_grades:
        shortcuts.append({"key": "all", "label": "Todos los grados", "grade_ids": [g["id"] for g in all_grades]})

    # Atajos por nivel completo
    for lvl in levels_sorted:
        grades = idx["grades_by_level"].get(lvl["id"], [])
        if grades:
            shortcuts.append({
                "key": f"level:{lvl['id']}",
                "label": f"Todo {lvl['name']}".strip(),
                "grade_ids": [g["id"] for g in grades],
            })

    # Sub-atajos típicos en SECUNDARIA (1°-3° y 4°-5°) — dinámicos según grados existentes
    sec_levels = [lvl for lvl in levels_sorted if _slug(lvl["name"] or "") == "secundaria"]
    for sec in sec_levels:
        grades = idx["grades_by_level"].get(sec["id"], [])
        if not grades:
            continue
        first_three = [g for g in grades if g["order"] in (1, 2, 3)]
        last_two = [g for g in grades if g["order"] in (4, 5)]
        if first_three:
            shortcuts.append({
                "key": f"sec_first_{sec['id']}",
                "label": f"{sec['name']} 1°-3°",
                "grade_ids": [g["id"] for g in first_three],
            })
        if last_two:
            shortcuts.append({
                "key": f"sec_last_{sec['id']}",
                "label": f"{sec['name']} 4°-5°",
                "grade_ids": [g["id"] for g in last_two],
            })

    return {
        "shortcuts": shortcuts,
        "grades": all_grades,  # útil para checkboxes individuales
    }


async def _require_admin(current_user) -> dict:
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden gestionar áreas curriculares")
    return user


# ─────────────────────────────────────────────────────────────────────────────
# CONSOLIDAR + ORDENAR ÁREAS DE UNA SECCIÓN (para que la libreta no salga fragmentada)
# ─────────────────────────────────────────────────────────────────────────────
class ConsolidateSectionRequest(BaseModel):
    section_id: str


class ReorderAreasRequest(BaseModel):
    area_ids: List[str]


async def _section_area_blocks(school_id: str, section_id: str):
    """Construye los bloques de área tal como saldrán en la libreta para una
    sección, y detecta nombres de área fragmentados (mismo nombre, varios area_id)."""
    areas = await db.curricular_areas.find(
        {"school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "order": 1}
    ).to_list(200)
    areas_map = {a["id"]: a for a in areas}

    subjects = await db.subjects.find(
        {"school_id": school_id, "section_id": section_id, "status": {"$ne": "inactive"}},
        {"_id": 0, "id": 1, "name": 1, "area_id": 1, "code": 1},
    ).to_list(500)

    blocks = {}
    without_area = []
    for s in subjects:
        aid = s.get("area_id")
        if aid and aid in areas_map:
            blk = blocks.setdefault(aid, {
                "area_id": aid,
                "area_name": areas_map[aid].get("name", ""),
                "order": areas_map[aid].get("order", 999),
                "subjects": [],
            })
            blk["subjects"].append(s.get("name"))
        else:
            without_area.append(s.get("name"))

    block_list = sorted(blocks.values(), key=lambda b: (b["order"], b["area_name"]))
    # nombres fragmentados (mismo nombre normalizado en >1 bloque)
    name_count = {}
    for b in block_list:
        name_count[_slug(b["area_name"])] = name_count.get(_slug(b["area_name"]), 0) + 1
    for b in block_list:
        b["fragmented"] = name_count.get(_slug(b["area_name"]), 0) > 1
    return block_list, without_area


@router.get("/curricular-areas/section-layout")
async def get_section_area_layout(section_id: str, current_user=Depends(get_current_user)):
    """Vista previa del orden/fragmentación de las áreas de una sección."""
    user = await _require_admin(current_user)
    block_list, without_area = await _section_area_blocks(user["school_id"], section_id)
    return {
        "section_id": section_id,
        "areas": block_list,
        "subjects_without_area": without_area,
        "has_fragmentation": any(b["fragmented"] for b in block_list),
    }


@router.post("/curricular-areas/consolidate-section")
async def consolidate_section_areas(req: ConsolidateSectionRequest, current_user=Depends(get_current_user)):
    """Consolida las asignaturas de la sección: por cada NOMBRE de área, re-vincula
    todas las asignaturas a un área canónica (la de menor `order`). Así los bloques
    repetidos se unen y heredan el orden correcto (como la sección de referencia)."""
    user = await _require_admin(current_user)
    school_id = user["school_id"]

    areas = await db.curricular_areas.find(
        {"school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "order": 1}
    ).to_list(200)
    # Canónica por nombre normalizado = menor order (desempate: menor id)
    canonical = {}
    for a in areas:
        key = _slug(a.get("name", ""))
        cur = canonical.get(key)
        if cur is None or (a.get("order", 999), a["id"]) < (cur.get("order", 999), cur["id"]):
            canonical[key] = a

    subjects = await db.subjects.find(
        {"school_id": school_id, "section_id": req.section_id, "status": {"$ne": "inactive"}},
        {"_id": 0, "id": 1, "name": 1, "area_id": 1},
    ).to_list(500)
    areas_by_id = {a["id"]: a for a in areas}

    updated = 0
    for s in subjects:
        aid = s.get("area_id")
        if not aid or aid not in areas_by_id:
            continue
        key = _slug(areas_by_id[aid].get("name", ""))
        canon = canonical.get(key)
        if canon and canon["id"] != aid:
            await db.subjects.update_one(
                {"id": s["id"], "school_id": school_id},
                {"$set": {"area_id": canon["id"], "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            updated += 1

    block_list, _ = await _section_area_blocks(school_id, req.section_id)
    return {
        "updated": updated,
        "areas_after": [{"area_name": b["area_name"], "order": b["order"], "subjects": len(b["subjects"])} for b in block_list],
        "has_fragmentation": any(b["fragmented"] for b in block_list),
    }



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

    # Indexa grados del colegio una sola vez para computar scope_label
    idx = await _load_school_grade_index(school_id)
    gby = idx["grades_by_id"]

    out = []
    for a in areas:
        ser = _serialize(a)
        ser["subjects_count"] = counts.get(a["id"], 0)
        ser["scope_label"] = _compute_scope_label(ser["scope_grade_ids"], gby)
        out.append(ser)
    return out


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

    # Unicidad por nombre dentro del colegio, considerando scope_grade_ids:
    # se permite repetir el nombre si los grados no se solapan.
    conflict = await _find_name_conflict(school_id, name, payload.scope_grade_ids)
    if conflict:
        conflict_scope = conflict.get("scope_grade_ids") or []
        if conflict_scope:
            detail = "Ya existe un área con ese nombre que cubre uno o más de los grados seleccionados."
        else:
            detail = "Ya existe un área global con ese nombre. Acótala a grados específicos o usa otro nombre."
        raise HTTPException(status_code=409, detail=detail)

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "name": name,
        "order": payload.order,
        "color": payload.color or "#0F172A",
        "is_active": True,
        "scope_grade_ids": list(payload.scope_grade_ids or []),
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

    # Determinar el scope efectivo tras el update (para validar nombre y posibles re-scopings)
    effective_scope = list(payload.scope_grade_ids) if payload.scope_grade_ids is not None else (area.get("scope_grade_ids") or [])
    effective_name = (payload.name.strip() if payload.name is not None else area.get("name") or "")

    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        update_fields["name"] = new_name

    # Validar conflicto si cambia el nombre o el scope (porque ambos afectan la unicidad)
    name_changed = payload.name is not None and effective_name.lower() != (area.get("name") or "").lower()
    scope_changed = payload.scope_grade_ids is not None and set(effective_scope) != set(area.get("scope_grade_ids") or [])
    if name_changed or scope_changed:
        conflict = await _find_name_conflict(school_id, effective_name, effective_scope, exclude_id=area_id)
        if conflict:
            conflict_scope = conflict.get("scope_grade_ids") or []
            if conflict_scope:
                detail = "Ya existe un área con ese nombre que cubre uno o más de los grados seleccionados."
            else:
                detail = "Ya existe un área global con ese nombre. Acótala a grados específicos o usa otro nombre."
            raise HTTPException(status_code=409, detail=detail)
    if payload.order is not None:
        update_fields["order"] = payload.order
    if payload.color is not None:
        update_fields["color"] = payload.color
    if payload.is_active is not None:
        update_fields["is_active"] = payload.is_active
    if payload.scope_grade_ids is not None:
        update_fields["scope_grade_ids"] = list(payload.scope_grade_ids)

    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.curricular_areas.update_one({"id": area_id, "school_id": school_id}, {"$set": update_fields})

    updated = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0})
    return _serialize(updated)


@router.delete("/curricular-areas/{area_id}")
async def delete_curricular_area(area_id: str, current_user=Depends(get_current_user)):
    """Soft delete del área + auto-unlink de sus asignaturas.

    El DELETE auto-desvincula las asignaturas vinculadas antes del soft
    delete del área para evitar referencias huérfanas a áreas inactivas.
    Las asignaturas mantienen su existencia y TODAS sus relaciones (notas,
    horarios, profesores, secciones); sólo pierden su clasificación
    curricular (`area_id`, `area_name`, `area_order` → null).

    Response incluye un breakdown para que el frontend muestre el resumen:
    - `subjects_unlinked_count`: cantidad de instancias afectadas
    - `groups_unlinked_count`: cantidad de grupos (slug del nombre) afectados
    """
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()

    area = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0, "id": 1, "name": 1})
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")

    # 1) Auto-unlink: cuántos subjects y cuántos grupos (slug distintos) están vinculados
    linked_subjects = await db.subjects.find(
        {"school_id": school_id, "area_id": area_id, "status": {"$ne": "deleted"}},
        {"_id": 0, "id": 1, "name": 1},
    ).to_list(5000)
    groups_unlinked_count = len({_slug(s.get("name") or "") for s in linked_subjects if s.get("name")})
    subjects_unlinked_count = 0
    if linked_subjects:
        ids = [s["id"] for s in linked_subjects]
        res = await db.subjects.update_many(
            {"id": {"$in": ids}, "school_id": school_id, "status": {"$ne": "deleted"}},
            {"$set": {"area_id": None, "area_name": None, "area_order": None, "updated_at": now}},
        )
        subjects_unlinked_count = res.modified_count

    # 2) Soft delete del área
    await db.curricular_areas.update_one(
        {"id": area_id, "school_id": school_id},
        {"$set": {"is_active": False, "updated_at": now}},
    )

    logger.info(
        f"[curricular_areas] archive area={area_id} name='{area.get('name')}' "
        f"subjects_unlinked={subjects_unlinked_count} groups_unlinked={groups_unlinked_count} "
        f"by={user.get('id')}"
    )

    return {
        "message": "Área desactivada",
        "deactivated_area_id": area_id,
        "subjects_unlinked_count": subjects_unlinked_count,
        "groups_unlinked_count": groups_unlinked_count,
    }


class HardResetIn(BaseModel):
    confirm: str  # debe ser exactamente "RESETEAR" (literal, case-sensitive)


@router.post("/curricular-areas/hard-reset")
async def hard_reset_curricular_areas(
    payload: HardResetIn,
    current_user=Depends(get_current_user),
):
    """Hard delete TODAS las áreas curriculares del colegio (activas e inactivas)
    + desvincula físicamente las asignaturas que apunten a ellas.

    OPERACIÓN IRREVERSIBLE. Requiere body {confirm: "RESETEAR"}.

    Lo que toca:
    - DELETE físico de todos los docs en `curricular_areas` del school.
    - UPDATE en `subjects` del school: `area_id`, `area_name`, `area_order` → null
      (las asignaturas y sus notas/horarios/profesores/secciones se conservan).

    Lo que NO toca: subjects.id, grades, sections, students, teachers, libreta,
    consolidados, registros auxiliares, plantillas, etc.
    """
    user = await _require_admin(current_user)
    school_id = user["school_id"]

    if (payload.confirm or "").strip() != "RESETEAR":
        raise HTTPException(
            status_code=400,
            detail='Confirmación inválida. Debes enviar exactamente "RESETEAR".',
        )

    now = datetime.now(timezone.utc).isoformat()

    # 1) Conteo previo (para log + response)
    areas_total = await db.curricular_areas.count_documents({"school_id": school_id})
    subjects_with_area = await db.subjects.count_documents(
        {"school_id": school_id, "area_id": {"$ne": None}, "status": {"$ne": "deleted"}}
    )

    # 2) Desvincular asignaturas (subjects.area_id → null)
    unlink_res = await db.subjects.update_many(
        {"school_id": school_id, "area_id": {"$ne": None}, "status": {"$ne": "deleted"}},
        {"$set": {"area_id": None, "area_name": None, "area_order": None, "updated_at": now}},
    )

    # 3) Hard delete de las áreas
    del_res = await db.curricular_areas.delete_many({"school_id": school_id})

    logger.warning(
        f"[curricular_areas] HARD RESET by={user.get('id')} school={school_id} "
        f"areas_deleted={del_res.deleted_count} subjects_unlinked={unlink_res.modified_count}"
    )

    return {
        "message": "Reset completado",
        "areas_deleted": del_res.deleted_count,
        "areas_total_before": areas_total,
        "subjects_unlinked": unlink_res.modified_count,
        "subjects_with_area_before": subjects_with_area,
    }



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
# Gestión manual de asignaturas vinculadas (Fase 1+ — agrupado por nombre)
#
# Patrón nuevo (Feb-2026): los endpoints de gestión devuelven **grupos**
# (agrupados por slug del nombre), no instancias individuales. El cuerpo de
# link/unlink acepta `group_keys` (preferido) o `subject_ids` (legacy, para
# que otros módulos como `PUT /api/subjects/{id}/area` o imports masivos
# sigan funcionando sin cambios). Ver `_slug()` para la justificación.
# ─────────────────────────────────────────────────────────────────────────────
class SubjectBulkIn(BaseModel):
    # Legacy: lista de subject_ids individuales
    subject_ids: List[str] = Field(default_factory=list)
    # Nuevo: lista de group_keys (slug del nombre)
    group_keys: List[str] = Field(default_factory=list)
    # Sprint B: filtro opcional por grado. Si presente, sólo afecta las
    # instancias cuyo `subjects.grade_id ∈ grade_ids`. Si vacío/None se
    # interpreta como "todos los grados" (comportamiento Sprint A).
    grade_ids: List[str] = Field(default_factory=list)


def _pick_display_name(names: List[str]) -> str:
    """Elige el display_name de un grupo: el más frecuente (desempate alfabético)."""
    if not names:
        return ""
    from collections import Counter
    c = Counter([n for n in names if n])
    if not c:
        return names[0] or ""
    # most_common preserva orden de inserción para desempates de Counter en Python 3.7+
    top_count = c.most_common(1)[0][1]
    candidates = sorted([n for n, k in c.items() if k == top_count])
    return candidates[0]


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
    current_user=Depends(get_current_user),
):
    """Asignaturas vinculadas al área, **agrupadas por nombre normalizado**.

    Cada fila del response es un grupo conceptual (p.ej. "Aritmética") que
    consolida todas las instancias por grado/sección. `instances_count` es el
    número de instancias vinculadas A ESTA área (no las totales del colegio).
    Ver `_slug()` para la justificación del patrón.

    Restringido a owner/admin/director del mismo colegio.
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
    docs = await db.subjects.find(query, {"_id": 0, "id": 1, "name": 1, "grade_id": 1}).to_list(5000)

    # Sprint B: pre-cargar índice de grados para enriquecer breakdown
    grade_idx = await _load_school_grade_index(school_id)
    grade_lookup = grade_idx["grades_by_id"]

    groups: dict = {}
    for d in docs:
        key = _slug(d.get("name") or "")
        if not key:
            continue
        g = groups.setdefault(key, {"group_key": key, "_names": [], "instance_ids": [], "_by_grade": {}})
        g["_names"].append(d.get("name") or "")
        g["instance_ids"].append(d["id"])
        gid = d.get("grade_id") or "__no_grade__"
        bkt = g["_by_grade"].setdefault(gid, {"grade_id": d.get("grade_id"), "instance_ids": []})
        bkt["instance_ids"].append(d["id"])

    out = []
    for k, g in groups.items():
        # Construir grade_breakdown ordenado por (level_order, grade_order)
        breakdown = []
        for gid, b in g["_by_grade"].items():
            if gid == "__no_grade__":
                breakdown.append({
                    "grade_id": None,
                    "grade_name": None,
                    "level_id": None,
                    "level_name": None,
                    "level_order": 999,
                    "grade_order": 999,
                    "instances_count": len(b["instance_ids"]),
                    "instance_ids": b["instance_ids"],
                })
            else:
                info = grade_lookup.get(gid, {})
                breakdown.append({
                    "grade_id": gid,
                    "grade_name": info.get("name"),
                    "level_id": info.get("level_id"),
                    "level_name": info.get("level_name"),
                    "level_order": info.get("level_order", 999),
                    "grade_order": info.get("order", 999),
                    "instances_count": len(b["instance_ids"]),
                    "instance_ids": b["instance_ids"],
                })
        breakdown.sort(key=lambda x: (x["level_order"], x["grade_order"]))

        out.append({
            "group_key": k,
            "display_name": _pick_display_name(g["_names"]),
            "instances_count": len(g["instance_ids"]),
            "instance_ids": g["instance_ids"],
            "grade_breakdown": breakdown,
        })

    # Búsqueda sobre el slug (normalizada igual que el group_key)
    if search:
        s_slug = _slug(search)
        if s_slug:
            out = [g for g in out if s_slug in g["group_key"] or s_slug in _slug(g["display_name"])]

    out.sort(key=lambda g: g["display_name"].lower())
    total = len(out)
    skip = (page - 1) * page_size
    page_items = out[skip:skip + page_size]
    return {"subjects": page_items, "total": total, "page": page, "page_size": page_size}


@router.get("/curricular-areas/{area_id}/available-subjects")
async def list_available_subjects(
    area_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None),
    unassigned_only: bool = Query(False),
    grade_ids: Optional[str] = Query(None, description="CSV de grade_ids para filtrar"),
    current_user=Depends(get_current_user),
):
    """Asignaturas disponibles para vincular al área, **agrupadas por nombre**.

    `instances_count` = instancias del grupo que están disponibles (no en el
    área destino). `current_area_name` indica de dónde vienen las instancias
    disponibles (`null` si todas sin área, "Mixto (varias áreas)" si están
    repartidas entre 2+ áreas, o el nombre del área si todas en la misma).

    Sprint B: con `grade_ids` (CSV) solo se incluyen instancias cuyo
    `grade_id` esté en la lista. Útil cuando el director selecciona grados
    destino antes de elegir asignaturas.
    """
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
        query["$and"] = [
            {"$or": [
                {"area_id": {"$exists": False}},
                {"area_id": None},
                {"area_id": {"$ne": area_id}},
            ]},
        ]

    grade_filter = None
    if grade_ids:
        grade_filter = [g.strip() for g in grade_ids.split(",") if g.strip()]
        if grade_filter:
            query["grade_id"] = {"$in": grade_filter}

    docs = await db.subjects.find(query, {"_id": 0, "id": 1, "name": 1, "area_id": 1, "area_name": 1, "grade_id": 1}).to_list(5000)

    # Pre-fetch area names para enriquecer (más eficiente que un find por subject)
    other_area_ids = {d.get("area_id") for d in docs if d.get("area_id")}
    area_name_map = {}
    if other_area_ids:
        cursor = db.curricular_areas.find(
            {"id": {"$in": list(other_area_ids)}, "school_id": school_id},
            {"_id": 0, "id": 1, "name": 1},
        )
        async for a in cursor:
            area_name_map[a["id"]] = a.get("name")

    groups: dict = {}
    for d in docs:
        key = _slug(d.get("name") or "")
        if not key:
            continue
        g = groups.setdefault(key, {
            "_names": [],
            "instance_ids": [],
            "area_ids_seen": set(),
            "has_unassigned": False,
        })
        g["_names"].append(d.get("name") or "")
        g["instance_ids"].append(d["id"])
        aid = d.get("area_id")
        if aid:
            g["area_ids_seen"].add(aid)
        else:
            g["has_unassigned"] = True

    out = []
    for k, g in groups.items():
        aids = g["area_ids_seen"]
        is_mixed = False
        current_area_name = None
        if len(aids) == 0:
            # Todas sin área
            current_area_name = None
        elif len(aids) == 1 and not g["has_unassigned"]:
            # Todas en la misma área
            only_id = next(iter(aids))
            current_area_name = area_name_map.get(only_id)
        else:
            # Split: dos+ áreas, o áreas+sin área
            is_mixed = True
            current_area_name = "Mixto (varias áreas)"
        out.append({
            "group_key": k,
            "display_name": _pick_display_name(g["_names"]),
            "instances_count": len(g["instance_ids"]),
            "instance_ids": g["instance_ids"],
            "current_area_name": current_area_name,
            "is_mixed": is_mixed,
        })

    if search:
        s_slug = _slug(search)
        if s_slug:
            out = [g for g in out if s_slug in g["group_key"] or s_slug in _slug(g["display_name"])]

    out.sort(key=lambda g: g["display_name"].lower())
    total = len(out)
    skip = (page - 1) * page_size
    page_items = out[skip:skip + page_size]
    return {"subjects": page_items, "total": total, "page": page, "page_size": page_size}


@router.post("/curricular-areas/{area_id}/subjects/unlink")
async def bulk_unlink_subjects(
    area_id: str,
    payload: SubjectBulkIn,
    current_user=Depends(get_current_user),
):
    """Desvincula asignaturas del área. Acepta `group_keys` (preferido) o
    `subject_ids` (legacy).

    Con `group_keys`: resuelve todas las instancias del colegio cuyo
    `_slug(name) in group_keys` Y `area_id == area_id_actual`. NO toca
    instancias de los mismos grupos que ya estén sin área (caso a confirmado
    en planning: solo desvincula las que están en esta área).

    Best-effort: errores individuales en `errors[]` no abortan el resto.

    Response (campos nuevos + legacy):
    - `unlinked_count`: instancias afectadas (legacy)
    - `unlinked`: [{subject_id, subject_name}] (legacy, sampled)
    - `groups_affected`: cantidad de grupos procesados
    - `total_instances_affected`: alias semántico de `unlinked_count`
    - `unlinked_groups`: [{group_key, display_name, instances_count}]
    - `errors`: [{subject_id|group_key, error}]
    """
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    area = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0, "id": 1, "name": 1})
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")

    errors: List[dict] = []
    unlinked_groups: List[dict] = []
    matching_docs: List[dict] = []

    if payload.group_keys:
        # Resolver group_keys -> instance ids dentro del área
        keys = list({k for k in payload.group_keys if k})
        if not keys:
            raise HTTPException(status_code=400, detail="Debes indicar al menos un grupo para desvincular")

        base_query = {"school_id": school_id, "area_id": area_id, "status": {"$ne": "deleted"}}
        # Sprint B: filtrar por grado si se especifica
        grade_filter = list({g for g in (payload.grade_ids or []) if g})
        if grade_filter:
            base_query["grade_id"] = {"$in": grade_filter}

        docs = await db.subjects.find(
            base_query,
            {"_id": 0, "id": 1, "name": 1},
        ).to_list(5000)
        # Agrupar por slug
        by_key: dict = {}
        for d in docs:
            k = _slug(d.get("name") or "")
            if k in keys:
                by_key.setdefault(k, []).append(d)
        for k in keys:
            if k not in by_key:
                err_msg = "El grupo no tiene instancias en esta área."
                if grade_filter:
                    err_msg = "El grupo no tiene instancias en los grados seleccionados."
                errors.append({"group_key": k, "error": err_msg})
            else:
                instances = by_key[k]
                matching_docs.extend(instances)
                unlinked_groups.append({
                    "group_key": k,
                    "display_name": _pick_display_name([d.get("name") or "" for d in instances]),
                    "instances_count": len(instances),
                })
    elif payload.subject_ids:
        # Legacy: subject_ids individuales
        ids = list({s for s in payload.subject_ids if s})
        if not ids:
            raise HTTPException(status_code=400, detail="Debes indicar al menos una asignatura para desvincular")

        matching = await db.subjects.find(
            {"id": {"$in": ids}, "school_id": school_id, "area_id": area_id, "status": {"$ne": "deleted"}},
            {"_id": 0, "id": 1, "name": 1},
        ).to_list(1000)
        matching_docs = matching
        matching_ids = {m["id"] for m in matching}
        for nf in set(ids) - matching_ids:
            ref = await db.subjects.find_one({"id": nf, "school_id": school_id}, {"_id": 0, "status": 1, "area_id": 1})
            if not ref:
                errors.append({"subject_id": nf, "error": "La asignatura no existe en tu colegio."})
            elif ref.get("status") == "deleted":
                errors.append({"subject_id": nf, "error": "La asignatura está eliminada."})
            elif ref.get("area_id") != area_id:
                errors.append({"subject_id": nf, "error": "La asignatura no pertenece a esta área."})
            else:
                errors.append({"subject_id": nf, "error": "No se pudo desvincular."})
    else:
        raise HTTPException(status_code=400, detail="Debes indicar `group_keys` o `subject_ids`")

    unlinked_count = 0
    unlinked: List[dict] = []
    if matching_docs:
        now = datetime.now(timezone.utc).isoformat()
        ids_to_update = [d["id"] for d in matching_docs]
        res = await db.subjects.update_many(
            {"id": {"$in": ids_to_update}, "school_id": school_id, "status": {"$ne": "deleted"}},
            {"$set": {"area_id": None, "area_name": None, "area_order": None, "updated_at": now}},
        )
        unlinked_count = res.modified_count
        unlinked = [{"subject_id": d["id"], "subject_name": d.get("name")} for d in matching_docs[:50]]
        logger.info(
            f"[curricular_areas] unlink area={area_id} count={unlinked_count} "
            f"groups={len(unlinked_groups)} by={user.get('id')}"
        )

    return {
        "unlinked_count": unlinked_count,
        "unlinked": unlinked,
        "groups_affected": len(unlinked_groups),
        "total_instances_affected": unlinked_count,
        "unlinked_groups": unlinked_groups,
        "errors": errors,
    }


@router.post("/curricular-areas/{area_id}/subjects/link")
async def bulk_link_subjects(
    area_id: str,
    payload: SubjectBulkIn,
    current_user=Depends(get_current_user),
):
    """Vincula asignaturas al área. Acepta `group_keys` (preferido) o
    `subject_ids` (legacy).

    Con `group_keys`: resuelve todas las instancias del colegio cuyo
    `_slug(name) in group_keys` Y `area_id != area_id_destino` (incluye
    instancias sin área y/o en otras áreas — caso b confirmado en planning:
    mueve TODAS las instancias del grupo al área destino).

    Best-effort: errores individuales en `errors[]` no abortan el resto.

    Response (campos nuevos + legacy):
    - `linked_count`: instancias efectivamente actualizadas (legacy)
    - `reassigned`: [{subject_id, ...}] por instancia (legacy, sampled)
    - `groups_affected`: cantidad de grupos procesados
    - `total_instances_affected`: alias de `linked_count`
    - `linked_groups`: [{group_key, display_name, new_instances, reassigned_instances, previous_area_names}]
    - `reassigned_groups`: [{group_key, display_name, previous_area_name, instances_count}]
    - `errors`: [{subject_id|group_key, error}]
    """
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    area = await db.curricular_areas.find_one({"id": area_id, "school_id": school_id}, {"_id": 0})
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")

    errors: List[dict] = []
    linked_groups: List[dict] = []
    reassigned_groups: List[dict] = []
    matching_docs: List[dict] = []  # docs a actualizar

    if payload.group_keys:
        keys = list({k for k in payload.group_keys if k})
        if not keys:
            raise HTTPException(status_code=400, detail="Debes indicar al menos un grupo para vincular")

        # Sprint B: filtrar por grado si se especifica
        grade_filter = list({g for g in (payload.grade_ids or []) if g})
        base_query = {
            "school_id": school_id,
            "status": {"$ne": "deleted"},
            "$or": [
                {"area_id": {"$exists": False}},
                {"area_id": None},
                {"area_id": {"$ne": area_id}},
            ],
        }
        if grade_filter:
            base_query["grade_id"] = {"$in": grade_filter}

        docs = await db.subjects.find(
            base_query,
            {"_id": 0, "id": 1, "name": 1, "area_id": 1, "area_name": 1, "grade_id": 1},
        ).to_list(5000)

        by_key: dict = {}
        for d in docs:
            k = _slug(d.get("name") or "")
            if k in keys:
                by_key.setdefault(k, []).append(d)

        for k in keys:
            instances = by_key.get(k, [])
            if not instances:
                err_msg = "El grupo no tiene instancias disponibles para vincular."
                if grade_filter:
                    err_msg = "El grupo no tiene instancias disponibles en los grados seleccionados."
                errors.append({"group_key": k, "error": err_msg})
                continue
            matching_docs.extend(instances)
            new_count = sum(1 for d in instances if not d.get("area_id"))
            reassigned_instances = [d for d in instances if d.get("area_id")]
            prev_area_names = sorted({d.get("area_name") for d in reassigned_instances if d.get("area_name")})
            display = _pick_display_name([d.get("name") or "" for d in instances])
            linked_groups.append({
                "group_key": k,
                "display_name": display,
                "instances_count": len(instances),
                "new_instances": new_count,
                "reassigned_instances": len(reassigned_instances),
                "previous_area_names": prev_area_names,
            })
            if reassigned_instances:
                # Si vienen de >1 área, reportar la más común; el frontend ya
                # ve la lista completa en `previous_area_names`.
                prev_main = _pick_display_name(
                    [d.get("area_name") or "" for d in reassigned_instances]
                )
                reassigned_groups.append({
                    "group_key": k,
                    "display_name": display,
                    "previous_area_name": prev_main or None,
                    "instances_count": len(reassigned_instances),
                })
    elif payload.subject_ids:
        # Legacy individual
        ids = list({s for s in payload.subject_ids if s})
        if not ids:
            raise HTTPException(status_code=400, detail="Debes indicar al menos una asignatura para vincular")

        existing = await db.subjects.find(
            {"id": {"$in": ids}, "school_id": school_id, "status": {"$ne": "deleted"}},
            {"_id": 0, "id": 1, "name": 1, "area_id": 1, "area_name": 1},
        ).to_list(1000)
        existing_map = {s["id"]: s for s in existing}

        for nid in set(ids) - set(existing_map.keys()):
            ref = await db.subjects.find_one({"id": nid, "school_id": school_id}, {"_id": 0, "status": 1})
            if not ref:
                errors.append({"subject_id": nid, "error": "La asignatura no existe en tu colegio."})
            elif ref.get("status") == "deleted":
                errors.append({"subject_id": nid, "error": "La asignatura está eliminada."})
            else:
                errors.append({"subject_id": nid, "error": "No se pudo vincular."})

        for sid, s in existing_map.items():
            if s.get("area_id") == area_id:
                continue  # no-op
            matching_docs.append(s)
    else:
        raise HTTPException(status_code=400, detail="Debes indicar `group_keys` o `subject_ids`")

    # Calcular reassigned legacy (lista de instancias individuales) para retro-compat
    reassigned_legacy = []
    for d in matching_docs:
        if d.get("area_id") and d.get("area_id") != area_id:
            reassigned_legacy.append({
                "subject_id": d["id"],
                "subject_name": d.get("name"),
                "previous_area_id": d.get("area_id"),
                "previous_area_name": d.get("area_name"),
                "new_area_id": area_id,
                "new_area_name": area.get("name"),
            })

    linked_count = 0
    if matching_docs:
        now = datetime.now(timezone.utc).isoformat()
        ids_to_update = [d["id"] for d in matching_docs]
        res = await db.subjects.update_many(
            {"id": {"$in": ids_to_update}, "school_id": school_id, "status": {"$ne": "deleted"}},
            {"$set": {
                "area_id": area_id,
                "area_name": area.get("name"),
                "area_order": area.get("order"),
                "updated_at": now,
            }},
        )
        linked_count = res.modified_count
        logger.info(
            f"[curricular_areas] link area={area_id} count={linked_count} "
            f"groups={len(linked_groups)} reassigned_groups={len(reassigned_groups)} "
            f"by={user.get('id')}"
        )

    return {
        "linked_count": linked_count,
        "reassigned": reassigned_legacy[:50],  # cap legacy payload
        "groups_affected": len(linked_groups) if payload.group_keys else 0,
        "total_instances_affected": linked_count,
        "linked_groups": linked_groups,
        "reassigned_groups": reassigned_groups,
        "errors": errors,
    }


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
            "scope_grade_ids": [],
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
