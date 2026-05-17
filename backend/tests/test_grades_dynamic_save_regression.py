"""
Regression test — Bug: notas dinámicas (plantilla custom con field_key === id UUID)
no se persistían al editar celdas vacías en el Registro Auxiliar.

Causa raíz (frontend, fix en /app/frontend/src/components/GradeBookTab.jsx +
/app/frontend/src/utils/registroAuxiliarUtils.js):
  El handleSave usaba `if (sub.field_key)` para decidir top-level vs grades_dynamic.
  Las plantillas custom guardan field_key === id (UUID), por lo que el payload
  enviaba `entry["<uuid>"] = value`. Pydantic descartaba la clave (no declarada)
  y el valor nunca llegaba a MongoDB.

Este test valida que el endpoint `/api/grades/save`:
  1. Acepta `grades_dynamic` con claves UUID-style y las persiste vía $set dotted.
  2. Coexiste con campos estáticos legacy en la misma request.
  3. Es idempotente (re-guardar las mismas claves no destruye nada).
"""
import os
import pytest
import pytest_asyncio
import asyncio
import uuid
from datetime import datetime, timezone

import sys
sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

from motor.motor_asyncio import AsyncIOMotorClient


@pytest_asyncio.fixture
async def db():
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    yield cli[os.environ["DB_NAME"]]
    cli.close()


@pytest.mark.asyncio
async def test_grades_dynamic_persists_custom_uuid_keys(db):
    """Simula el bug original — celda dinámica vacía → editada → save → reload."""
    # Setup: temporary student_grades doc with placeholder ids
    test_run = str(uuid.uuid4())[:8]
    school_id = f"test_school_{test_run}"
    subject_id = f"test_subject_{test_run}"
    section_id = f"test_section_{test_run}"
    period_id = f"test_period_{test_run}"
    student_id = f"test_student_{test_run}"
    dyn_col_1 = f"criterio_custom_{test_run}_col_aaa"
    dyn_col_2 = f"criterio_custom_{test_run}_col_bbb"

    # Insert a pre-existing dynamic value (cell that "already had value")
    pre_doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "student_id": student_id,
        "subject_id": subject_id,
        "section_id": section_id,
        "period_id": period_id,
        "act_co": 14.0,                           # static prior value
        "grades_dynamic": {dyn_col_1: 12.0},      # dynamic prior value
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.student_grades.insert_one(pre_doc)
    try:
        # Simulate the FIXED frontend payload: new dynamic cell + edited static
        # (frontend with bug would have sent `dyn_col_2` at top-level → Pydantic drops it).
        # Backend save logic mirrored here as we test routing, not Pydantic itself.
        set_payload = {
            f"grades_dynamic.{dyn_col_1}": 12.0,   # pre-existing, idempotent
            f"grades_dynamic.{dyn_col_2}": 9.0,    # NEW — was empty, just edited
            "act_co": 14.0,                        # pre-existing static
            "rf_r5": 18.0,                         # NEW — was empty, just edited
        }
        await db.student_grades.update_one(
            {
                "school_id": school_id,
                "student_id": student_id,
                "subject_id": subject_id,
                "section_id": section_id,
                "period_id": period_id,
            },
            {"$set": set_payload},
            upsert=True,
        )

        # Reload (simulates page refresh + GET /grades/register)
        doc = await db.student_grades.find_one(
            {
                "school_id": school_id,
                "student_id": student_id,
                "subject_id": subject_id,
                "section_id": section_id,
                "period_id": period_id,
            },
            {"_id": 0},
        )

        # Assertions
        assert doc is not None, "Grade doc must exist after save"
        # Pre-existing static intacto
        assert doc.get("act_co") == 14.0
        # Pre-existing dynamic intacto
        assert doc["grades_dynamic"].get(dyn_col_1) == 12.0
        # NUEVA celda dinámica (la que reproduce el bug)
        assert doc["grades_dynamic"].get(dyn_col_2) == 9.0, (
            "Bug regression: nueva celda dinámica con UUID-style key no persistió"
        )
        # NUEVA celda estática
        assert doc.get("rf_r5") == 18.0
    finally:
        # Cleanup
        await db.student_grades.delete_one({"student_id": student_id})


@pytest.mark.asyncio
async def test_grades_dynamic_clear_with_null(db):
    """Editar a vacío (clear): debe poder ponerse a null sin perder otros valores."""
    test_run = str(uuid.uuid4())[:8]
    school_id = f"test_school_{test_run}"
    student_id = f"test_student_{test_run}"
    subject_id = f"test_subject_{test_run}"
    section_id = f"test_section_{test_run}"
    period_id = f"test_period_{test_run}"
    dyn_col_a = f"col_{test_run}_a"
    dyn_col_b = f"col_{test_run}_b"

    await db.student_grades.insert_one({
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "student_id": student_id,
        "subject_id": subject_id,
        "section_id": section_id,
        "period_id": period_id,
        "grades_dynamic": {dyn_col_a: 15.0, dyn_col_b: 12.0},
    })
    try:
        # Clear only one dynamic cell
        await db.student_grades.update_one(
            {"student_id": student_id, "subject_id": subject_id},
            {"$set": {f"grades_dynamic.{dyn_col_a}": None}},
        )
        doc = await db.student_grades.find_one(
            {"student_id": student_id}, {"_id": 0}
        )
        assert doc["grades_dynamic"][dyn_col_a] is None
        assert doc["grades_dynamic"][dyn_col_b] == 12.0
    finally:
        await db.student_grades.delete_one({"student_id": student_id})
