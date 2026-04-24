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

    result = []
    if system_template:
        result.append(system_template)
    result.extend(school_templates)

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
    return doc


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
