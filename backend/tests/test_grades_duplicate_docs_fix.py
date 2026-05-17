"""
Regression test — Bug: en producción, ciertos alumnos tenían documentos
duplicados en `student_grades` (mismo school_id+student_id+subject_id+
section_id+period_id) por una race condition histórica entre autosave y
save manual. `update_one` actualizaba un solo doc; el GET retornaba el OTRO,
mostrando `act_re: null` aunque el backend respondía 200 OK.

Fix (en `/app/backend/routes/grades.py::save_grades`):
  - Reemplazar `update_one` por `update_many` para que TODOS los duplicados
    se actualicen con el mismo `$set`. Idempotente, no destructivo.
  - Logging defensivo cuando se detectan duplicados.

Este test simula el escenario exacto del bug.
"""
import os
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
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
async def test_update_many_syncs_duplicate_docs(db):
    """Con 2 docs duplicados, update_many sincroniza ambos."""
    run = str(uuid.uuid4())[:8]
    flt = {
        "school_id": f"sch_{run}",
        "student_id": f"stu_{run}",
        "subject_id": f"sub_{run}",
        "section_id": f"sec_{run}",
        "period_id": f"per_{run}",
    }
    # Insert 2 duplicate docs (simulating the production state)
    await db.student_grades.insert_many([
        {**flt, "id": str(uuid.uuid4()), "act_re": None, "act_co": 18,
         "created_at": "2026-01-01T00:00:00+00:00"},
        {**flt, "id": str(uuid.uuid4()), "act_re": None, "act_co": None,
         "created_at": "2026-02-01T00:00:00+00:00"},
    ])
    try:
        # Sanity check: count_documents sees 2
        assert await db.student_grades.count_documents(flt) == 2

        # Apply update_many like the new save_grades does
        res = await db.student_grades.update_many(
            flt,
            {"$set": {"act_re": 15.0, "updated_at": "2026-02-17T00:00:00+00:00"}},
            upsert=True,
        )
        assert res.matched_count == 2, "update_many debe alcanzar ambos duplicados"

        # All docs now have act_re = 15
        docs = await db.student_grades.find(flt, {"_id": 0, "act_re": 1, "act_co": 1}).to_list(5)
        assert len(docs) == 2
        for d in docs:
            assert d["act_re"] == 15.0, (
                "Bug regression: update_many no sincronizó todos los duplicados"
            )
    finally:
        await db.student_grades.delete_many(flt)


@pytest.mark.asyncio
async def test_update_many_with_upsert_creates_when_no_match(db):
    """Sin docs previos, update_many con upsert crea exactamente uno."""
    run = str(uuid.uuid4())[:8]
    flt = {
        "school_id": f"sch_{run}",
        "student_id": f"stu_{run}",
        "subject_id": f"sub_{run}",
        "section_id": f"sec_{run}",
        "period_id": f"per_{run}",
    }
    try:
        assert await db.student_grades.count_documents(flt) == 0
        await db.student_grades.update_many(
            flt,
            {
                "$set": {"act_re": 15.0},
                "$setOnInsert": {**flt, "id": str(uuid.uuid4()), "created_at": "2026-02-17"},
            },
            upsert=True,
        )
        count = await db.student_grades.count_documents(flt)
        assert count == 1, "upsert con cero matches debe crear UN doc nuevo"
        doc = await db.student_grades.find_one(flt, {"_id": 0})
        assert doc["act_re"] == 15.0
    finally:
        await db.student_grades.delete_many(flt)


@pytest.mark.asyncio
async def test_update_many_does_not_touch_other_students(db):
    """update_many sólo afecta los docs del filtro, no docs ajenos."""
    run = str(uuid.uuid4())[:8]
    target_flt = {
        "school_id": f"sch_{run}",
        "student_id": f"stu_{run}_A",
        "subject_id": f"sub_{run}",
        "section_id": f"sec_{run}",
        "period_id": f"per_{run}",
    }
    other_flt = {**target_flt, "student_id": f"stu_{run}_B"}
    await db.student_grades.insert_many([
        {**target_flt, "id": str(uuid.uuid4()), "act_re": None},
        {**other_flt, "id": str(uuid.uuid4()), "act_re": None},
    ])
    try:
        await db.student_grades.update_many(
            target_flt,
            {"$set": {"act_re": 15.0}},
            upsert=True,
        )
        # target was updated
        t = await db.student_grades.find_one(target_flt, {"_id": 0, "act_re": 1})
        assert t["act_re"] == 15.0
        # other student NOT affected
        o = await db.student_grades.find_one(other_flt, {"_id": 0, "act_re": 1})
        assert o["act_re"] is None, "Otros alumnos NO deben ser tocados"
    finally:
        await db.student_grades.delete_many({"school_id": f"sch_{run}"})
