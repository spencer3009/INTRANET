# Regression: tutor assignments (role="tutor", no subject) must NOT be flagged as
# orphan teacher↔subject assignments ("Sin curso vinculado").
from datetime import datetime, timezone
import pytest
from routes import academic

SCHOOL = "TEST-ORPHAN-SCHOOL-PYTEST"


def _now():
    return datetime.now(timezone.utc).isoformat()


@pytest.mark.asyncio(loop_scope="session")
async def test_tutor_not_flagged_as_orphan():
    db = academic.db
    await db.academic_assignments.delete_many({"school_id": SCHOOL})
    await db.academic_assignments.insert_many([
        {"id": "A-TUTOR", "school_id": SCHOOL, "teacher_id": "T1", "section_id": "S1", "role": "tutor", "created_at": _now()},
        {"id": "A-ORPHAN", "school_id": SCHOOL, "teacher_id": "T2", "subject_id": "GHOST", "role": "teacher", "created_at": _now()},
        {"id": "A-NOSUBJ", "school_id": SCHOOL, "teacher_id": "T3", "role": "teacher", "created_at": _now()},
    ])
    ids = set(await academic._get_orphan_assignment_ids(SCHOOL))
    await db.academic_assignments.delete_many({"school_id": SCHOOL})
    assert "A-TUTOR" not in ids, "Tutor assignment wrongly flagged as orphan"
    assert "A-ORPHAN" in ids, "Assignment with dangling subject should be orphan"
    assert "A-NOSUBJ" in ids, "Teacher assignment without subject should be orphan"
