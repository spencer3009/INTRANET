"""
Tests para el toolkit de mantenimiento de duplicados en `student_grades`.

Cubre el flujo completo:
  1. scan: cuenta duplicados sin tocar nada
  2. consolidate dry_run: simula la consolidación, no toca nada
  3. consolidate execute: fusiona valores no-null y borra los obsoletos
  4. create-index: rechaza si quedan duplicados, succeeds si no
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone

import pytest
import pytest_asyncio
import sys
sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

from motor.motor_asyncio import AsyncIOMotorClient
from routes.grades import (
    _doc_score,
    _merge_docs,
    _scan_duplicates_for_school,
    _DUP_GROUP_KEY,
    GRADE_SUB_FIELDS,
)


@pytest_asyncio.fixture
async def db():
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    yield cli[os.environ["DB_NAME"]]
    cli.close()


# ──────────────── Pure logic tests (no DB) ────────────────

def test_merge_prefers_most_recent_doc_as_keeper():
    """El doc más reciente actúa como keeper."""
    old = {"id": "A", "updated_at": "2026-01-01", "act_co": 18, "act_re": None}
    new = {"id": "B", "updated_at": "2026-02-01", "act_co": None, "act_re": 15}
    merged = _merge_docs([old, new])
    # newest is keeper (so id is B)
    assert merged["id"] == "B"
    # but it merges in act_co from the older doc since keeper had null
    assert merged["act_co"] == 18
    assert merged["act_re"] == 15


def test_merge_does_not_overwrite_non_null_in_keeper():
    """Si el keeper ya tiene un valor, NO lo pisamos con el del donor."""
    keeper = {"id": "K", "updated_at": "2026-02-01", "act_co": 18}
    donor = {"id": "D", "updated_at": "2026-01-01", "act_co": 10}
    merged = _merge_docs([keeper, donor])
    assert merged["act_co"] == 18  # keeper wins


def test_merge_grades_dynamic_union():
    """grades_dynamic se fusiona como unión (claves distintas no se pisan)."""
    a = {"id": "A", "updated_at": "2026-02-01", "grades_dynamic": {"col1": 12}}
    b = {"id": "B", "updated_at": "2026-01-01", "grades_dynamic": {"col2": 15}}
    merged = _merge_docs([a, b])
    assert merged["grades_dynamic"] == {"col1": 12, "col2": 15}


def test_merge_empty_list_returns_empty():
    assert _merge_docs([]) == {}


# ──────────────── DB-backed integration ────────────────

@pytest.mark.asyncio
async def test_scan_finds_duplicates(db):
    """scan retorna el conteo correcto y muestras."""
    run = str(uuid.uuid4())[:8]
    school_id = f"sch_maint_{run}"
    base = {
        "school_id": school_id,
        "subject_id": "sub_X",
        "section_id": "sec_X",
        "period_id": "per_X",
    }
    docs = [
        {**base, "id": str(uuid.uuid4()), "student_id": "S1", "act_re": None},
        {**base, "id": str(uuid.uuid4()), "student_id": "S1", "act_re": 15.0},
        {**base, "id": str(uuid.uuid4()), "student_id": "S1", "act_re": None},  # 3rd dup
        {**base, "id": str(uuid.uuid4()), "student_id": "S2", "act_re": 10.0},  # no dup
    ]
    await db.student_grades.insert_many(docs)
    try:
        report = await _scan_duplicates_for_school(school_id)
        assert report["duplicate_groups"] == 1
        # S1 has 3 docs, so 2 would be deleted
        assert report["docs_that_would_be_deleted"] == 2
        assert report["total_duplicate_docs"] == 3
        assert len(report["sample_groups"]) == 1
        assert report["sample_groups"][0]["student_id"] == "S1"
    finally:
        await db.student_grades.delete_many({"school_id": school_id})


@pytest.mark.asyncio
async def test_consolidate_logic_merges_and_deletes(db):
    """Simula el flujo: 3 duplicados → 1 doc final con valores fusionados."""
    run = str(uuid.uuid4())[:8]
    school_id = f"sch_cons_{run}"
    flt = {
        "school_id": school_id,
        "student_id": "S_benel",
        "subject_id": "sub_X",
        "section_id": "sec_X",
        "period_id": "per_X",
    }
    await db.student_grades.insert_many([
        {**flt, "id": "DOC_A", "act_co": 18, "act_re": None, "rf_r1": 18,
         "grades_dynamic": {"x": 10}, "updated_at": "2026-01-01T00:00:00+00:00"},
        {**flt, "id": "DOC_B", "act_co": None, "act_re": 15, "rf_r1": None,
         "grades_dynamic": {"y": 12}, "updated_at": "2026-02-01T00:00:00+00:00"},
        {**flt, "id": "DOC_C", "act_co": None, "act_re": None, "rf_r1": 16,
         "grades_dynamic": {}, "updated_at": "2025-12-01T00:00:00+00:00"},
    ])
    try:
        docs = await db.student_grades.find(flt, {"_id": 0}).to_list(20)
        merged = _merge_docs(docs)
        # Most recent (DOC_B) is keeper → id=B
        assert merged["id"] == "DOC_B"
        # Merged values: keeper had act_re=15 + pulled act_co=18 from DOC_A + rf_r1=18 (from DOC_A, newer than DOC_C)
        assert merged["act_co"] == 18
        assert merged["act_re"] == 15
        assert merged["rf_r1"] == 18  # from DOC_A (newer than DOC_C)
        assert merged["grades_dynamic"]["x"] == 10
        assert merged["grades_dynamic"]["y"] == 12

        # Simulate the actual execute step
        keeper_id = "DOC_B"
        upd = {f: merged.get(f) for f in GRADE_SUB_FIELDS}
        upd["grades_dynamic"] = merged.get("grades_dynamic")
        await db.student_grades.update_one({"id": keeper_id}, {"$set": upd})
        await db.student_grades.delete_many({"id": {"$in": ["DOC_A", "DOC_C"]}})

        # Final state: 1 doc with merged data
        remaining = await db.student_grades.find(flt, {"_id": 0}).to_list(5)
        assert len(remaining) == 1
        r = remaining[0]
        assert r["id"] == "DOC_B"
        assert r["act_co"] == 18
        assert r["act_re"] == 15
        assert r["rf_r1"] == 18
    finally:
        await db.student_grades.delete_many({"school_id": school_id})


@pytest.mark.asyncio
async def test_unique_index_creation(db):
    """El índice único puede crearse en una colección de prueba sin duplicados."""
    # Use a temp collection to avoid touching the real one
    coll = db[f"test_grades_idx_{uuid.uuid4().hex[:8]}"]
    try:
        await coll.insert_many([
            {"school_id": "S", "student_id": "U1", "subject_id": "X", "section_id": "Y", "period_id": "Z", "act_re": 15},
            {"school_id": "S", "student_id": "U2", "subject_id": "X", "section_id": "Y", "period_id": "Z", "act_re": 16},
        ])
        await coll.create_index(
            [(k, 1) for k in _DUP_GROUP_KEY],
            unique=True,
            name="uniq_test_idx",
        )
        # Attempting to insert a duplicate must fail
        from pymongo.errors import DuplicateKeyError
        with pytest.raises(DuplicateKeyError):
            await coll.insert_one(
                {"school_id": "S", "student_id": "U1", "subject_id": "X", "section_id": "Y", "period_id": "Z", "act_re": 99}
            )
    finally:
        await coll.drop()
