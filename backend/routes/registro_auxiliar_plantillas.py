"""
registro_auxiliar_plantillas.py — Sistema de Plantillas de Registro Auxiliar.
Cada colegio puede tener múltiples plantillas. Existe una plantilla del sistema (solo lectura).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid
import logging

from routes.core import db, get_current_user, require_role, now_iso

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

TEMPLATE_READ_ROLES = ["owner", "director", "admin", "teacher"]
TEMPLATE_WRITE_ROLES = ["owner", "director", "admin"]


# ── Models ──────────────────────────────────────────────────────

class SubcolumnaInput(BaseModel):
    id: Optional[str] = None
    label: str
    tipo: Literal["input", "promedio_auto"] = "input"
    orden: int = 0

class CriterioInput(BaseModel):
    id: Optional[str] = None
    nombre: str
    porcentaje: float = 0
    color: str = "#F1C40F"
    orden: int = 0
    subcolumnas: List[SubcolumnaInput] = []

class ColumnaFinalInput(BaseModel):
    id: Optional[str] = None
    label: str
    label_corto: str = ""
    porcentaje: float = 0
    orden: int = 0

class PlantillaCreateUpdate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    descripcion: Optional[str] = ""
    estado: Literal["borrador", "activa"] = "borrador"
    criterios: List[CriterioInput] = []
    columnas_finales: List[ColumnaFinalInput] = []
    label_promedio_final: str = "PROM. BIMESTRAL"
    escala_minima: float = 0
    escala_maxima: float = 20

class EstadoUpdate(BaseModel):
    estado: Literal["activa", "borrador", "archivada"]

class CloneBody(BaseModel):
    nombre: Optional[str] = None

# ── Models: editar solo textos de la plantilla del sistema ──────

class SubcolumnaTextEdit(BaseModel):
    id: str
    label: str

class CriterioTextEdit(BaseModel):
    id: str
    nombre: str
    subcolumnas: List[SubcolumnaTextEdit] = []

class ColumnaFinalTextEdit(BaseModel):
    id: str
    label: str
    label_corto: str = ""

class SystemTextsUpdate(BaseModel):
    """Edición de textos de la plantilla del sistema (no toca porcentajes ni IDs)."""
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    label_promedio_final: Optional[str] = None
    criterios: List[CriterioTextEdit] = []
    columnas_finales: List[ColumnaFinalTextEdit] = []


# ── Helpers ─────────────────────────────────────────────────────

def gen_id():
    return str(uuid.uuid4())[:8]

def ensure_ids(criterios: list, columnas_finales: list):
    """Generate IDs for criterios/subcolumnas/columnas that don't have one."""
    for c in criterios:
        if not c.get("id"):
            c["id"] = f"criterio_{gen_id()}"
        for s in c.get("subcolumnas", []):
            if not s.get("id"):
                s["id"] = f"{c['id']}_col_{gen_id()}"
    for col in columnas_finales:
        if not col.get("id"):
            col["id"] = f"final_{gen_id()}"

def calc_sum(criterios: list, columnas_finales: list) -> float:
    total = sum(c.get("porcentaje", 0) for c in criterios)
    total += sum(c.get("porcentaje", 0) for c in columnas_finales)
    return round(total, 2)

def validate_percentage_sum(criterios: list, columnas_finales: list):
    total = calc_sum(criterios, columnas_finales)
    if total != 100:
        raise HTTPException(400, f"La suma de porcentajes debe ser exactamente 100%. Actual: {total}%")

def clean_doc(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def _normalize_fkey(raw):
    """Return a clean field_key or None.

    Defends against legacy serialization bugs where Python `None` got
    persisted as the literal string ``"None"`` in MongoDB. We treat any
    of {None, "", "None", "null", "NULL", "undefined"} as absent so the
    frontend can fall back to `sub.id` consistently.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if s in ("", "None", "null", "NULL", "undefined"):
        return None
    return s


def normalize_plantilla_doc(doc):
    """Sanitize a plantilla dict before returning it to the client.

    Walks every subcolumna in `criterios` and every `columnas_finales`
    entry, rewriting `field_key` so the response is always either a
    real string or `null`. Does not mutate MongoDB — the caller can
    pair this with a one-shot migration if they want to persist the
    cleanup.
    """
    if not doc:
        return doc
    for cri in doc.get("criterios", []) or []:
        for sub in cri.get("subcolumnas", []) or []:
            if "field_key" in sub:
                sub["field_key"] = _normalize_fkey(sub.get("field_key"))
    for col in doc.get("columnas_finales", []) or []:
        if "field_key" in col:
            col["field_key"] = _normalize_fkey(col.get("field_key"))
    return doc


# ── Seed ────────────────────────────────────────────────────────

SYSTEM_TEMPLATE = {
    "school_id": None,
    "es_sistema": True,
    "nombre": "Plantilla del Sistema",
    "descripcion": "Configuración estándar de EduNet. Solo lectura.",
    "estado": "activa",
    "es_predeterminada": False,
    "criterios": [
        {
            "id": "actitudinal", "nombre": "ACTITUDINAL", "porcentaje": 10,
            "color": "#F1C40F", "orden": 0,
            "subcolumnas": [
                {"id": "io", "label": "IO", "tipo": "input", "orden": 0},
                {"id": "re", "label": "RE", "tipo": "input", "orden": 1},
                {"id": "p_actitudinal", "label": "PROMEDIO", "tipo": "promedio_auto", "orden": 2},
            ]
        },
        {
            "id": "tareas", "nombre": "TAREAS", "porcentaje": 25,
            "color": "#F1C40F", "orden": 1,
            "subcolumnas": [
                {"id": "t1", "label": "T1", "tipo": "input", "orden": 0},
                {"id": "t2", "label": "T2", "tipo": "input", "orden": 1},
                {"id": "t3", "label": "T3", "tipo": "input", "orden": 2},
                {"id": "t4", "label": "T4", "tipo": "input", "orden": 3},
                {"id": "t5", "label": "T5", "tipo": "input", "orden": 4},
                {"id": "p_tareas", "label": "PROMEDIO", "tipo": "promedio_auto", "orden": 5},
            ]
        },
        {
            "id": "competencia", "nombre": "COMPETENCIA", "porcentaje": 5,
            "color": "#F1C40F", "orden": 2,
            "subcolumnas": [
                {"id": "c1", "label": "C1", "tipo": "input", "orden": 0},
                {"id": "c2", "label": "C2", "tipo": "input", "orden": 1},
                {"id": "p_competencia", "label": "PROMEDIO", "tipo": "promedio_auto", "orden": 2},
            ]
        },
        {
            "id": "pasitos", "nombre": "PASITOS", "porcentaje": 25,
            "color": "#D3D3D3", "orden": 3,
            "subcolumnas": [
                {"id": "p1", "label": "P1", "tipo": "input", "orden": 0},
                {"id": "p2", "label": "P2", "tipo": "input", "orden": 1},
                {"id": "p3", "label": "P3", "tipo": "input", "orden": 2},
                {"id": "p4", "label": "P4", "tipo": "input", "orden": 3},
                {"id": "p5", "label": "P5", "tipo": "input", "orden": 4},
                {"id": "p6", "label": "P6", "tipo": "input", "orden": 5},
                {"id": "p_pasitos", "label": "PROMEDIO", "tipo": "promedio_auto", "orden": 6},
            ]
        },
    ],
    "columnas_finales": [
        {"id": "examen_mensual", "label": "EXAMEN MENSUAL", "label_corto": "EM", "porcentaje": 15, "orden": 0},
        {"id": "examen_bimestral", "label": "EXAMEN BIMESTRAL", "label_corto": "EB", "porcentaje": 20, "orden": 1},
    ],
    "label_promedio_final": "PROM. BIMESTRAL",
    "escala_minima": 0,
    "escala_maxima": 20,
}


async def seed_system_template():
    """Ensure the system template exists. Called on app startup."""
    existing = await db.registro_auxiliar_plantillas.find_one({"es_sistema": True})
    if not existing:
        doc = {
            **SYSTEM_TEMPLATE,
            "id": "system_default",
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "created_by": "system",
            "updated_by": "system",
        }
        await db.registro_auxiliar_plantillas.insert_one(doc)
        logger.info("[PLANTILLAS] Plantilla del sistema creada (seed)")
    else:
        logger.info("[PLANTILLAS] Plantilla del sistema ya existe")


# ══════════════════════════════════════════════════════════════════
#  1. GET /api/schools/{school_id}/registro-auxiliar/plantillas
# ══════════════════════════════════════════════════════════════════

@router.get("/schools/{school_id}/registro-auxiliar/plantillas")
async def list_plantillas(school_id: str, estado: Optional[str] = None, current_user=Depends(require_role(TEMPLATE_READ_ROLES))):
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    # Build query for school templates
    school_query = {"school_id": school_id}
    if estado and estado != "todas":
        estados = [e.strip() for e in estado.split(",")]
        school_query["estado"] = {"$in": estados}
    else:
        school_query["estado"] = {"$in": ["activa", "borrador"]}

    school_templates = await db.registro_auxiliar_plantillas.find(school_query, {"_id": 0}).sort("updated_at", -1).to_list(100)

    # Always include system template
    system_template = await db.registro_auxiliar_plantillas.find_one({"es_sistema": True}, {"_id": 0})

    # Auto-promote: if there is NO `es_predeterminada` template and exactly
    # ONE active custom template exists, mark it as default automatically.
    # This handles legacy schools that created a custom plantilla but never
    # explicitly clicked "marcar predeterminada" — without this, the gradebook
    # falls back to the system template and ignores user-defined columns
    # (SEM1, SEM2, …) silently.
    try:
        has_predeterminada = any(
            t.get("es_predeterminada") and not t.get("es_sistema")
            for t in school_templates
        )
        active_customs = [
            t for t in school_templates
            if not t.get("es_sistema") and t.get("estado") == "activa"
        ]
        if not has_predeterminada and len(active_customs) == 1:
            target = active_customs[0]
            await db.registro_auxiliar_plantillas.update_one(
                {"id": target["id"]},
                {"$set": {"es_predeterminada": True, "updated_at": now_iso()}},
            )
            target["es_predeterminada"] = True
            logger.info(
                f"[PLANTILLAS] Auto-promoted plantilla '{target.get('nombre')}' "
                f"(id={target['id']}) as default for school {school_id}"
            )
    except Exception as e:
        logger.warning(f"[PLANTILLAS] auto-promote failed for school {school_id}: {e}")

    result = []
    if system_template:
        result.append(normalize_plantilla_doc(system_template))
    result.extend(normalize_plantilla_doc(t) for t in school_templates)

    return {"plantillas": result, "total": len(result)}


# ══════════════════════════════════════════════════════════════════
#  2. GET /api/schools/{school_id}/registro-auxiliar/plantillas/{id}
# ══════════════════════════════════════════════════════════════════

@router.get("/schools/{school_id}/registro-auxiliar/plantillas/{plantilla_id}")
async def get_plantilla(school_id: str, plantilla_id: str, current_user=Depends(require_role(TEMPLATE_READ_ROLES))):
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    doc = await db.registro_auxiliar_plantillas.find_one(
        {"id": plantilla_id, "$or": [{"school_id": school_id}, {"es_sistema": True}]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Plantilla no encontrada")
    return normalize_plantilla_doc(doc)


# ══════════════════════════════════════════════════════════════════
#  3. POST /api/schools/{school_id}/registro-auxiliar/plantillas
# ══════════════════════════════════════════════════════════════════

@router.post("/schools/{school_id}/registro-auxiliar/plantillas")
async def create_plantilla(school_id: str, data: PlantillaCreateUpdate, current_user=Depends(require_role(TEMPLATE_WRITE_ROLES))):
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    criterios = [c.dict() for c in data.criterios]
    columnas_finales = [c.dict() for c in data.columnas_finales]
    ensure_ids(criterios, columnas_finales)

    if data.estado == "activa":
        validate_percentage_sum(criterios, columnas_finales)

    now = now_iso()
    user_id = current_user.get("id") or current_user.get("sub")

    # Check if this is the first active template for the school
    es_predeterminada = False
    if data.estado == "activa":
        active_count = await db.registro_auxiliar_plantillas.count_documents({"school_id": school_id, "estado": "activa"})
        if active_count == 0:
            es_predeterminada = True

    doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "es_sistema": False,
        "nombre": data.nombre,
        "descripcion": data.descripcion or "",
        "estado": data.estado,
        "es_predeterminada": es_predeterminada,
        "criterios": criterios,
        "columnas_finales": columnas_finales,
        "label_promedio_final": data.label_promedio_final,
        "escala_minima": data.escala_minima,
        "escala_maxima": data.escala_maxima,
        "created_at": now,
        "updated_at": now,
        "created_by": user_id,
        "updated_by": user_id,
    }

    await db.registro_auxiliar_plantillas.insert_one(doc)
    doc.pop("_id", None)
    logger.info(f"[PLANTILLAS] Created template '{data.nombre}' for school {school_id} (id={doc['id']})")
    return doc


# ══════════════════════════════════════════════════════════════════
#  4. POST /{plantilla_id}/clonar
# ══════════════════════════════════════════════════════════════════

@router.post("/schools/{school_id}/registro-auxiliar/plantillas/{plantilla_id}/clonar")
async def clone_plantilla(school_id: str, plantilla_id: str, body: CloneBody = CloneBody(), current_user=Depends(require_role(TEMPLATE_WRITE_ROLES))):
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    original = await db.registro_auxiliar_plantillas.find_one(
        {"id": plantilla_id, "$or": [{"school_id": school_id}, {"es_sistema": True}]},
        {"_id": 0}
    )
    if not original:
        raise HTTPException(404, "Plantilla no encontrada")

    now = now_iso()
    user_id = current_user.get("id") or current_user.get("sub")
    new_name = body.nombre or f"Copia de {original['nombre']}"

    # Deep copy criterios with new IDs
    new_criterios = []
    for c in original.get("criterios", []):
        new_c_id = f"criterio_{gen_id()}"
        new_subs = []
        for s in c.get("subcolumnas", []):
            new_subs.append({**s, "id": f"{new_c_id}_col_{gen_id()}"})
        new_criterios.append({**c, "id": new_c_id, "subcolumnas": new_subs})

    new_columnas = []
    for col in original.get("columnas_finales", []):
        new_columnas.append({**col, "id": f"final_{gen_id()}"})

    clone = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "es_sistema": False,
        "nombre": new_name,
        "descripcion": original.get("descripcion", ""),
        "estado": "borrador",
        "es_predeterminada": False,
        "criterios": new_criterios,
        "columnas_finales": new_columnas,
        "label_promedio_final": original.get("label_promedio_final", "PROM. BIMESTRAL"),
        "escala_minima": original.get("escala_minima", 0),
        "escala_maxima": original.get("escala_maxima", 20),
        "created_at": now,
        "updated_at": now,
        "created_by": user_id,
        "updated_by": user_id,
    }

    await db.registro_auxiliar_plantillas.insert_one(clone)
    clone.pop("_id", None)
    logger.info(f"[PLANTILLAS] Cloned '{original['nombre']}' -> '{new_name}' for school {school_id}")
    return clone


# ══════════════════════════════════════════════════════════════════
#  5. PUT /{plantilla_id} — Edit template
# ══════════════════════════════════════════════════════════════════

@router.put("/schools/{school_id}/registro-auxiliar/plantillas/{plantilla_id}")
async def update_plantilla(school_id: str, plantilla_id: str, data: PlantillaCreateUpdate, current_user=Depends(require_role(TEMPLATE_WRITE_ROLES))):
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    existing = await db.registro_auxiliar_plantillas.find_one({"id": plantilla_id}, {"_id": 0, "es_sistema": 1, "school_id": 1})
    if not existing:
        raise HTTPException(404, "Plantilla no encontrada")
    if existing.get("es_sistema"):
        raise HTTPException(403, "La plantilla del sistema no es editable. Clónala para personalizarla.")
    if existing.get("school_id") != school_id:
        raise HTTPException(403, "No tienes permiso para editar esta plantilla")

    criterios = [c.dict() for c in data.criterios]
    columnas_finales = [c.dict() for c in data.columnas_finales]
    ensure_ids(criterios, columnas_finales)

    if data.estado == "activa":
        validate_percentage_sum(criterios, columnas_finales)

    user_id = current_user.get("id") or current_user.get("sub")

    update = {
        "nombre": data.nombre,
        "descripcion": data.descripcion or "",
        "estado": data.estado,
        "criterios": criterios,
        "columnas_finales": columnas_finales,
        "label_promedio_final": data.label_promedio_final,
        "escala_minima": data.escala_minima,
        "escala_maxima": data.escala_maxima,
        "updated_at": now_iso(),
        "updated_by": user_id,
    }

    await db.registro_auxiliar_plantillas.update_one({"id": plantilla_id}, {"$set": update})
    updated = await db.registro_auxiliar_plantillas.find_one({"id": plantilla_id}, {"_id": 0})
    logger.info(f"[PLANTILLAS] Updated template '{data.nombre}' (id={plantilla_id})")
    return updated


# ══════════════════════════════════════════════════════════════════
#  6. PATCH /{plantilla_id}/estado
# ══════════════════════════════════════════════════════════════════

@router.patch("/schools/{school_id}/registro-auxiliar/plantillas/{plantilla_id}/estado")
async def change_estado(school_id: str, plantilla_id: str, data: EstadoUpdate, current_user=Depends(require_role(TEMPLATE_WRITE_ROLES))):
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    doc = await db.registro_auxiliar_plantillas.find_one(
        {"id": plantilla_id, "$or": [{"school_id": school_id}, {"es_sistema": True}]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Plantilla no encontrada")
    if doc.get("es_sistema"):
        raise HTTPException(403, "No se puede cambiar el estado de la plantilla del sistema")
    if doc.get("school_id") != school_id:
        raise HTTPException(403, "No tienes permiso")

    if data.estado == "activa":
        validate_percentage_sum(doc.get("criterios", []), doc.get("columnas_finales", []))

    if data.estado == "archivada":
        active_count = await db.registro_auxiliar_plantillas.count_documents({"school_id": school_id, "estado": "activa", "id": {"$ne": plantilla_id}})
        if active_count == 0 and doc.get("estado") == "activa":
            raise HTTPException(400, "No puedes archivar la única plantilla activa. Activa otra primero.")

    user_id = current_user.get("id") or current_user.get("sub")
    await db.registro_auxiliar_plantillas.update_one(
        {"id": plantilla_id},
        {"$set": {"estado": data.estado, "updated_at": now_iso(), "updated_by": user_id}}
    )

    logger.info(f"[PLANTILLAS] Template {plantilla_id} estado -> {data.estado}")
    return {"message": f"Estado cambiado a '{data.estado}'", "estado": data.estado}


# ══════════════════════════════════════════════════════════════════
#  7. PATCH /{plantilla_id}/predeterminada
# ══════════════════════════════════════════════════════════════════

@router.patch("/schools/{school_id}/registro-auxiliar/plantillas/{plantilla_id}/predeterminada")
async def set_predeterminada(school_id: str, plantilla_id: str, current_user=Depends(require_role(TEMPLATE_WRITE_ROLES))):
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    doc = await db.registro_auxiliar_plantillas.find_one(
        {"id": plantilla_id, "$or": [{"school_id": school_id}, {"es_sistema": True}]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Plantilla no encontrada")
    if doc.get("es_sistema"):
        raise HTTPException(403, "La plantilla del sistema no puede ser predeterminada")
    if doc.get("school_id") != school_id:
        raise HTTPException(403, "No tienes permiso")
    if doc.get("estado") != "activa":
        raise HTTPException(400, "Solo plantillas activas pueden ser predeterminadas")

    # Unset all others
    await db.registro_auxiliar_plantillas.update_many(
        {"school_id": school_id, "id": {"$ne": plantilla_id}},
        {"$set": {"es_predeterminada": False}}
    )
    await db.registro_auxiliar_plantillas.update_one(
        {"id": plantilla_id},
        {"$set": {"es_predeterminada": True, "updated_at": now_iso()}}
    )

    logger.info(f"[PLANTILLAS] Template {plantilla_id} set as default for school {school_id}")
    return {"message": "Plantilla marcada como predeterminada"}


# ══════════════════════════════════════════════════════════════════
#  8. DELETE /{plantilla_id}
# ══════════════════════════════════════════════════════════════════

@router.delete("/schools/{school_id}/registro-auxiliar/plantillas/{plantilla_id}")
async def delete_plantilla(school_id: str, plantilla_id: str, current_user=Depends(require_role(TEMPLATE_WRITE_ROLES))):
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    doc = await db.registro_auxiliar_plantillas.find_one(
        {"id": plantilla_id, "$or": [{"school_id": school_id}, {"es_sistema": True}]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Plantilla no encontrada")
    if doc.get("es_sistema"):
        raise HTTPException(403, "La plantilla del sistema no se puede eliminar")
    if doc.get("school_id") != school_id:
        raise HTTPException(403, "No tienes permiso para eliminar esta plantilla")

    # Check if any registro auxiliar uses this template
    linked = await db.registro_auxiliar.count_documents({"plantilla_id": plantilla_id})
    if linked > 0:
        raise HTTPException(400, "Esta plantilla tiene registros con notas guardadas. Archívala en lugar de eliminarla.")

    await db.registro_auxiliar_plantillas.delete_one({"id": plantilla_id})
    logger.info(f"[PLANTILLAS] Deleted template {plantilla_id} from school {school_id}")
    return {"message": "Plantilla eliminada"}


# ══════════════════════════════════════════════════════════════════
#  9. POST /usar-sistema — Desactiva todas las plantillas del colegio
#     para que los docentes pasen a usar la plantilla del sistema.
# ══════════════════════════════════════════════════════════════════

@router.post("/schools/{school_id}/registro-auxiliar/plantillas/usar-sistema")
async def usar_plantilla_sistema(school_id: str, current_user=Depends(require_role(TEMPLATE_WRITE_ROLES))):
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    user_id = current_user.get("id") or current_user.get("sub")
    result = await db.registro_auxiliar_plantillas.update_many(
        {"school_id": school_id, "estado": "activa"},
        {"$set": {
            "estado": "borrador",
            "es_predeterminada": False,
            "updated_at": now_iso(),
            "updated_by": user_id,
        }}
    )
    logger.info(f"[PLANTILLAS] School {school_id} switched to SYSTEM template. Deactivated {result.modified_count} custom templates.")
    return {
        "message": "Ahora el colegio usa la plantilla del sistema.",
        "deactivated_count": result.modified_count,
    }


# ══════════════════════════════════════════════════════════════════
#  10. GET /usage — Resumen de cursos/secciones con notas registradas
# ══════════════════════════════════════════════════════════════════

STATIC_GRADE_FIELDS = [
    "act_co", "act_re",
    "rf_r1", "rf_r2", "rf_r3", "rf_r4", "rf_r5",
    "comp_c1", "comp_c2",
    "part_p1", "part_p2", "part_p3", "part_exp", "part_tg", "part_p",
    "exam_mensual", "exam_bimestral",
]


@router.get("/schools/{school_id}/registro-auxiliar/usage")
async def get_registro_auxiliar_usage(school_id: str, current_user=Depends(require_role(TEMPLATE_READ_ROLES))):
    """Return distinct (subject, section) combinations where the school has
    registered grades, with nivel/grado/sección/curso names and cell counts."""
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    # Query: records with at least one static field set OR any grades_dynamic key
    has_value_clauses = [{f: {"$ne": None}} for f in STATIC_GRADE_FIELDS]
    has_value_clauses.append({"grades_dynamic": {"$exists": True, "$ne": {}, "$not": {"$size": 0}}})

    pipeline = [
        {"$match": {"school_id": school_id, "$or": has_value_clauses}},
        {"$group": {
            "_id": {"subject_id": "$subject_id", "section_id": "$section_id"},
            "records_count": {"$sum": 1},
            "last_updated": {"$max": "$updated_at"},
            "has_dynamic": {"$max": {"$cond": [{"$gt": [{"$size": {"$objectToArray": {"$ifNull": ["$grades_dynamic", {}]}}}, 0]}, 1, 0]}},
            "has_static": {"$max": {"$cond": [
                {"$or": [{"$ne": [f"${f}", None]} for f in STATIC_GRADE_FIELDS]},
                1, 0,
            ]}},
        }},
        {"$sort": {"last_updated": -1}},
    ]

    raw = await db.student_grades.aggregate(pipeline).to_list(2000)

    # Enrich with names
    out = []
    subject_cache, section_cache, grade_cache, level_cache = {}, {}, {}, {}

    async def _get(cache, coll, _id, fields):
        if not _id:
            return None
        if _id in cache:
            return cache[_id]
        doc = await coll.find_one({"id": _id}, {"_id": 0, **{f: 1 for f in fields}})
        cache[_id] = doc
        return doc

    for item in raw:
        subj_id = item["_id"].get("subject_id")
        sec_id = item["_id"].get("section_id")
        subj = await _get(subject_cache, db.subjects, subj_id, ["name", "nombre", "code"])
        sec = await _get(section_cache, db.sections, sec_id, ["name", "nombre", "grado_id"])
        grado_id = sec.get("grado_id") if sec else None
        grade = await _get(grade_cache, db.grades, grado_id, ["nombre", "name", "nivel_id"])
        nivel_id = grade.get("nivel_id") if grade else None
        level = await _get(level_cache, db.academic_levels, nivel_id, ["nombre", "name"])

        out.append({
            "subject_id": subj_id,
            "section_id": sec_id,
            "subject_name": (subj or {}).get("name") or (subj or {}).get("nombre") or "—",
            "section_name": (sec or {}).get("name") or (sec or {}).get("nombre") or "—",
            "grade_name": (grade or {}).get("nombre") or (grade or {}).get("name") or "—",
            "level_name": (level or {}).get("nombre") or (level or {}).get("name") or "—",
            "records_count": item.get("records_count", 0),
            "last_updated": item.get("last_updated"),
            "has_dynamic": bool(item.get("has_dynamic")),
            "has_static": bool(item.get("has_static")),
        })

    return {"usage": out, "total": len(out)}



# ══════════════════════════════════════════════════════════════════
#  PATCH /plantillas/system/textos — Editar SOLO los textos de la plantilla del sistema
# ══════════════════════════════════════════════════════════════════

@router.patch("/schools/{school_id}/registro-auxiliar/plantillas/system/textos")
async def update_system_template_texts(
    school_id: str,
    data: SystemTextsUpdate,
    current_user=Depends(require_role(TEMPLATE_WRITE_ROLES)),
):
    """Actualiza únicamente los textos (nombres y labels) de la plantilla del sistema.
    No modifica IDs, orden, porcentajes ni colores. Solo owner/admin/director."""
    user_school = current_user.get("school_id")
    if user_school != school_id:
        raise HTTPException(403, "No tienes acceso a este colegio")

    existing = await db.registro_auxiliar_plantillas.find_one({"es_sistema": True}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Plantilla del sistema no encontrada")

    # Index incoming edits by ID
    crit_edits = {c.id: c for c in data.criterios}
    col_edits = {c.id: c for c in data.columnas_finales}

    # Apply text-only updates preserving structure
    new_criterios = []
    for c in existing.get("criterios", []):
        edit = crit_edits.get(c.get("id"))
        new_c = {**c}
        if edit:
            if edit.nombre and edit.nombre.strip():
                new_c["nombre"] = edit.nombre.strip()
            sub_edit_map = {s.id: s for s in edit.subcolumnas}
            new_subs = []
            for s in c.get("subcolumnas", []):
                se = sub_edit_map.get(s.get("id"))
                new_s = {**s}
                if se and se.label and se.label.strip():
                    new_s["label"] = se.label.strip()
                new_subs.append(new_s)
            new_c["subcolumnas"] = new_subs
        new_criterios.append(new_c)

    new_columnas = []
    for col in existing.get("columnas_finales", []):
        edit = col_edits.get(col.get("id"))
        new_col = {**col}
        if edit:
            if edit.label and edit.label.strip():
                new_col["label"] = edit.label.strip()
            if edit.label_corto and edit.label_corto.strip():
                new_col["label_corto"] = edit.label_corto.strip()
        new_columnas.append(new_col)

    update_doc = {
        "criterios": new_criterios,
        "columnas_finales": new_columnas,
        "updated_at": now_iso(),
        "updated_by": current_user.get("id") or current_user.get("sub"),
    }
    if data.nombre and data.nombre.strip():
        update_doc["nombre"] = data.nombre.strip()
    if data.descripcion is not None:
        update_doc["descripcion"] = data.descripcion.strip()
    if data.label_promedio_final and data.label_promedio_final.strip():
        update_doc["label_promedio_final"] = data.label_promedio_final.strip()

    await db.registro_auxiliar_plantillas.update_one(
        {"es_sistema": True},
        {"$set": update_doc},
    )
    updated = await db.registro_auxiliar_plantillas.find_one({"es_sistema": True}, {"_id": 0})
    logger.info(f"[PLANTILLAS] System template texts updated by {current_user.get('id')}")
    return updated


# ══════════════════════════════════════════════════════════════════
#  MIGRATION: fix legacy plantillas where field_key was persisted as
#  the literal string "None"/"null". Idempotent — safe to run multiple
#  times. Returns counts so the caller can audit the change.
# ══════════════════════════════════════════════════════════════════

@router.post("/admin/maintenance/fix-plantilla-field-keys")
async def fix_plantilla_field_keys(current_user=Depends(require_role(["owner", "director", "admin", "support"]))):
    """Normalize ``field_key`` in every plantilla of the current school.

    Walks all `criterios.subcolumnas` and `columnas_finales` of every
    plantilla owned by the caller's school (plus the system template if
    corrupted somehow) and rewrites any `field_key` that is the literal
    string ``"None"``, ``""``, ``"null"`` or similar to a real Python
    ``None``. Idempotent: a clean plantilla is left untouched.
    """
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(403, "Sin colegio asociado")

    LEGACY_KEYS = ("None", "null", "NULL", "undefined", "")

    docs = await db.registro_auxiliar_plantillas.find(
        {"$or": [{"school_id": school_id}, {"es_sistema": True}]},
        {"_id": 0, "id": 1, "es_sistema": 1, "criterios": 1, "columnas_finales": 1, "nombre": 1},
    ).to_list(50)

    plantillas_touched = 0
    subs_fixed = 0
    cols_fixed = 0

    for doc in docs:
        changed = False
        new_criterios = []
        for cri in doc.get("criterios", []) or []:
            new_subs = []
            for sub in cri.get("subcolumnas", []) or []:
                fk = sub.get("field_key")
                if isinstance(fk, str) and fk.strip() in LEGACY_KEYS:
                    sub = {**sub, "field_key": None}
                    subs_fixed += 1
                    changed = True
                new_subs.append(sub)
            new_criterios.append({**cri, "subcolumnas": new_subs})

        new_finales = []
        for col in doc.get("columnas_finales", []) or []:
            fk = col.get("field_key")
            if isinstance(fk, str) and fk.strip() in LEGACY_KEYS:
                col = {**col, "field_key": None}
                cols_fixed += 1
                changed = True
            new_finales.append(col)

        if changed:
            await db.registro_auxiliar_plantillas.update_one(
                {"id": doc["id"]},
                {"$set": {
                    "criterios": new_criterios,
                    "columnas_finales": new_finales,
                    "updated_at": now_iso(),
                }},
            )
            plantillas_touched += 1
            logger.info(f"[PLANTILLAS] Migration cleaned plantilla {doc.get('id')} ({doc.get('nombre')})")

    # Also clean grades_dynamic.None / .null buckets in student_grades for the
    # caller's school. These were created when a corrupted plantilla forced
    # the gradebook to write every column onto the same key.
    sg_cleaned = await db.student_grades.update_many(
        {"school_id": school_id, "grades_dynamic.None": {"$exists": True}},
        {"$unset": {"grades_dynamic.None": ""}},
    )
    sg_cleaned_null = await db.student_grades.update_many(
        {"school_id": school_id, "grades_dynamic.null": {"$exists": True}},
        {"$unset": {"grades_dynamic.null": ""}},
    )

    return {
        "message": "Plantillas y notas dinámicas normalizadas",
        "plantillas_touched": plantillas_touched,
        "subcolumnas_fixed": subs_fixed,
        "columnas_finales_fixed": cols_fixed,
        "student_grades_None_bucket_cleared": sg_cleaned.modified_count,
        "student_grades_null_bucket_cleared": sg_cleaned_null.modified_count,
    }
