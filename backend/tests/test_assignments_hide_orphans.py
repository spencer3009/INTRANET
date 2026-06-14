# Regression: GET /academic/assignments must HIDE assignments whose subject was
# deleted (dangling subject_id) so the owner never sees confusing
# "Sin curso vinculado" cards. Valid assignments still show.
from datetime import datetime, timezone
import pytest
from routes import academic

SCHOOL = "TEST-HIDE-ORPHANS-SCHOOL"


async def _coro(v):
    return v


@pytest.mark.asyncio(loop_scope="session")
async def test_orphan_assignments_hidden_from_main_list():
    db = academic.db
    now = datetime.now(timezone.utc).isoformat()
    await db.academic_assignments.delete_many({"school_id": SCHOOL})
    await db.subjects.delete_many({"school_id": SCHOOL})
    await db.subjects.insert_one({"id": "SUBJ-OK", "school_id": SCHOOL, "name": "Matemática", "status": "active"})
    await db.academic_assignments.insert_many([
        {"id": "ASSIGN-OK", "school_id": SCHOOL, "teacher_id": "T1", "role": "titular", "status": "activo", "subject_id": "SUBJ-OK", "created_at": now},
        {"id": "ASSIGN-ORPHAN", "school_id": SCHOOL, "teacher_id": "T2", "role": "titular", "status": "activo", "subject_id": "GHOST", "created_at": now},
        {"id": "ASSIGN-NOSUBJ", "school_id": SCHOOL, "teacher_id": "T3", "role": "titular", "status": "activo", "created_at": now},
    ])
    fake_user = {"id": "owner1", "school_id": SCHOOL, "role": "owner"}
    orig = academic.resolve_user_from_token
    academic.resolve_user_from_token = lambda *a, **k: _coro(fake_user)
    try:
        result = await academic.get_academic_assignments(current_user={"sub": "owner1"})
    finally:
        academic.resolve_user_from_token = orig
    ids = {a.get("id") for a in result}
    await db.academic_assignments.delete_many({"school_id": SCHOOL})
    await db.subjects.delete_many({"school_id": SCHOOL})
    assert "ASSIGN-OK" in ids, "Valid assignment must be visible"
    assert "ASSIGN-ORPHAN" not in ids, "Assignment with deleted subject must be hidden"
    assert "ASSIGN-NOSUBJ" not in ids, "Assignment without subject must be hidden"
