"""
Regression test for the P0 Registro Auxiliar bug (Eusebio Arróniz, jun-2026):
A subject linked to a DUPLICATE section ("4° A") shows an empty register to the
teacher while the owner sees all students. Validates:
  - _resolve_sibling_section_ids gathers duplicate sections (same grado_id+nombre)
  - _fetch_section_students surfaces students enrolled in any sibling section
  - _assert_teacher_assignment accepts a teacher whose assignment is on a sibling
    section even when the subject's section_id points to the other duplicate.
Seeds isolated docs with a unique prefix and cleans up afterwards.
"""
import asyncio
import os
import uuid
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

PREFIX = f"test-dupsec-{uuid.uuid4().hex[:8]}"


@pytest.mark.asyncio
async def test_duplicate_section_register():
    import sys
    sys.path.insert(0, "/app/backend")
    # Patch the module-level db to point at the real (test) database, then import helpers.
    from routes import grades

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    # Ensure helpers use this db (they import `db` from .core which is the same instance)
    school = f"{PREFIX}-school"
    grado = f"{PREFIX}-grado"
    sec_A1 = f"{PREFIX}-secA1"   # subject points here (empty)
    sec_A2 = f"{PREFIX}-secA2"   # students actually enrolled here, teacher assigned here
    teacher = f"{PREFIX}-teacher"
    subject = f"{PREFIX}-subject"

    try:
        # Two duplicate "A" sections in the same grade.
        await db.sections.insert_many([
            {"id": sec_A1, "school_id": school, "grado_id": grado, "nombre": "A"},
            {"id": sec_A2, "school_id": school, "grado_id": grado, "nombre": "A"},
        ])
        # 3 students enrolled in sec_A2 (the duplicate).
        students = []
        for i, ln in enumerate(["Zarate", "Alvarez", "Mendoza"]):
            students.append({
                "id": f"{PREFIX}-stu{i}", "school_id": school, "role": "student",
                "student_status": "active", "seccion_id": sec_A2, "grado_id": grado,
                "name": f"N{i}", "last_name": ln,
            })
        await db.users.insert_many(students)
        # Teacher assignment is on sec_A2.
        await db.academic_assignments.insert_one({
            "id": f"{PREFIX}-assign", "school_id": school, "teacher_id": teacher,
            "subject_id": subject, "section_id": sec_A2, "status": "activo", "role": "titular",
        })

        # 1) Sibling resolution: from sec_A1 we should reach both A1 and A2.
        sibs = await grades._resolve_sibling_section_ids(school, sec_A1)
        assert set(sibs) == {sec_A1, sec_A2}, f"siblings={sibs}"

        # 2) Students surfaced via siblings (sorted by last_name).
        fetched = await grades._fetch_section_students(school, sibs)
        assert len(fetched) == 3, f"got {len(fetched)} students"
        assert [s["last_name"] for s in fetched] == ["Alvarez", "Mendoza", "Zarate"]

        # 3) Teacher guard: subject linked to sec_A1, assignment on sec_A2 → must pass.
        assignment = await grades._assert_teacher_assignment(school, teacher, subject, sec_A1)
        assert assignment["section_id"] == sec_A2

        # 4) Teacher guard denies a teacher with no assignment.
        denied = False
        try:
            await grades._assert_teacher_assignment(school, "someone-else", subject, sec_A1)
        except Exception as e:
            denied = "403" in str(getattr(e, "status_code", "")) or getattr(e, "status_code", None) == 403
        assert denied, "expected 403 for unassigned teacher"

        print("PASS: duplicate-section register fix validated")
    finally:
        await db.sections.delete_many({"id": {"$in": [sec_A1, sec_A2]}})
        await db.users.delete_many({"id": {"$regex": f"^{PREFIX}-stu"}})
        await db.academic_assignments.delete_many({"id": f"{PREFIX}-assign"})
        client.close()


if __name__ == "__main__":
    asyncio.run(test_duplicate_section_register())
