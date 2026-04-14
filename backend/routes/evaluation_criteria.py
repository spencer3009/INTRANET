"""
evaluation_criteria.py — Personalización global de nombres de columnas del Registro Auxiliar.
Los IDs internos (category_id, column_id) NUNCA cambian. Solo display_name es editable.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from routes.core import db, require_role, get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

ADMIN_EDIT_ROLES = ["owner", "admin", "director"]

# ── Default criteria structure ──────────────────────────────────
DEFAULT_CATEGORIES = [
    {
        "category_id": "actitudinal",
        "display_name": "ACTITUDINAL",
        "percentage": 10,
        "subcolumns": [
            {"column_id": "CO", "display_name": "CO"},
            {"column_id": "RE", "display_name": "RE"},
        ],
    },
    {
        "category_id": "revision_fichas",
        "display_name": "REVISION FICHAS",
        "percentage": 25,
        "subcolumns": [
            {"column_id": "R1", "display_name": "R1"},
            {"column_id": "R2", "display_name": "R2"},
            {"column_id": "R3", "display_name": "R3"},
            {"column_id": "R4", "display_name": "R4"},
            {"column_id": "R5", "display_name": "R5"},
        ],
    },
    {
        "category_id": "competencia",
        "display_name": "COMPETENCIA",
        "percentage": 5,
        "subcolumns": [
            {"column_id": "C1", "display_name": "C1"},
            {"column_id": "C2", "display_name": "C2"},
        ],
    },
    {
        "category_id": "participaciones",
        "display_name": "PARTICIPACIONES",
        "percentage": 25,
        "subcolumns": [
            {"column_id": "P1", "display_name": "P1"},
            {"column_id": "P2", "display_name": "P2"},
            {"column_id": "P3", "display_name": "P3"},
            {"column_id": "EXP", "display_name": "EXP"},
            {"column_id": "TG", "display_name": "TG"},
            {"column_id": "P", "display_name": "P"},
        ],
    },
    {
        "category_id": "examen_mensual",
        "display_name": "EXAMEN MENSUAL",
        "percentage": 15,
        "subcolumns": [
            {"column_id": "EM", "display_name": "EM"},
        ],
    },
    {
        "category_id": "examen_bimestral",
        "display_name": "EXAMEN BIMESTRAL",
        "percentage": 20,
        "subcolumns": [
            {"column_id": "EB", "display_name": "EB"},
        ],
    },
]

# Map category_id → expected column_ids for validation
EXPECTED_STRUCTURE = {
    c["category_id"]: [s["column_id"] for s in c["subcolumns"]]
    for c in DEFAULT_CATEGORIES
}
EXPECTED_CATEGORY_IDS = [c["category_id"] for c in DEFAULT_CATEGORIES]


class SubcolumnUpdate(BaseModel):
    column_id: str
    display_name: str = Field(..., min_length=1, max_length=30)

class CategoryUpdate(BaseModel):
    category_id: str
    display_name: str = Field(..., min_length=1, max_length=30)
    subcolumns: List[SubcolumnUpdate]

class CriteriaUpdate(BaseModel):
    categories: List[CategoryUpdate]


async def get_or_create_config(school_id: str):
    doc = await db.evaluation_criteria_config.find_one(
        {"school_id": school_id}, {"_id": 0}
    )
    if doc:
        return doc
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "school_id": school_id,
        "categories": DEFAULT_CATEGORIES,
        "created_at": now,
        "updated_at": now,
        "updated_by": None,
    }
    await db.evaluation_criteria_config.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/evaluation-criteria")
async def get_evaluation_criteria(current_user=Depends(get_current_user)):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="school_id no encontrado")
    config = await get_or_create_config(school_id)
    return config


@router.put("/evaluation-criteria")
async def update_evaluation_criteria(
    data: CriteriaUpdate,
    current_user=Depends(require_role(["owner", "admin", "director"]))
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="school_id no encontrado")

    # Validate structure matches exactly
    incoming_ids = [c.category_id for c in data.categories]
    if incoming_ids != EXPECTED_CATEGORY_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"Las categorias deben ser exactamente: {EXPECTED_CATEGORY_IDS}"
        )

    for cat in data.categories:
        if cat.display_name.strip() == "":
            raise HTTPException(status_code=400, detail=f"El nombre de '{cat.category_id}' no puede estar vacio")

        expected_cols = EXPECTED_STRUCTURE.get(cat.category_id, [])
        incoming_cols = [s.column_id for s in cat.subcolumns]
        if incoming_cols != expected_cols:
            raise HTTPException(
                status_code=400,
                detail=f"Las subcolumnas de '{cat.category_id}' deben ser: {expected_cols}"
            )

        for sub in cat.subcolumns:
            if sub.display_name.strip() == "":
                raise HTTPException(
                    status_code=400,
                    detail=f"El nombre de la subcolumna '{sub.column_id}' no puede estar vacio"
                )

    now = datetime.now(timezone.utc).isoformat()
    categories_dict = [
        {
            "category_id": c.category_id,
            "display_name": c.display_name.strip(),
            "percentage": next(
                (d["percentage"] for d in DEFAULT_CATEGORIES if d["category_id"] == c.category_id),
                0
            ),
            "subcolumns": [
                {"column_id": s.column_id, "display_name": s.display_name.strip()}
                for s in c.subcolumns
            ],
        }
        for c in data.categories
    ]

    await db.evaluation_criteria_config.update_one(
        {"school_id": school_id},
        {
            "$set": {
                "categories": categories_dict,
                "updated_at": now,
                "updated_by": current_user.get("id"),
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    updated = await db.evaluation_criteria_config.find_one(
        {"school_id": school_id}, {"_id": 0}
    )
    logger.info(f"Evaluation criteria updated for school {school_id} by {current_user.get('id')}")
    return updated
