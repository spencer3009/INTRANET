"""
Regression test for the P0 Registro Auxiliar bug (Eusebio Arróniz, jun-2026).

Root cause: the teacher's assignment section can differ from the subject's
stored section_id (duplicate grade/section docs). The strict guard 403'd, and
the frontend masked it as "No hay alumnos".

Correct fix (validated here):
  - _assert_teacher_assignment: grants permission via exact match OR any
    assignment for (teacher, subject). Raises 403 only when none exists.
  - _fetch_section_students: returns the roster for the REQUESTED section only
    (matching seccion_id OR section_id). NO cross-section merging, so teacher
    and owner see the identical list. Two distinct "A" sections are never merged.
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
async def test_register_section_isolation_and_permission():
    import sys
    sys.path.insert(0, "/app/backend")
    from routes import grades

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    school = f"{PREFIX}-school"
    grado = f"{PREFIX}-grado"
    sec_owner = f"{PREFIX}-secOwner"   # subject.section_id (owner & register use this)
    sec_assign = f"{PREFIX}-secAssign"  # teacher's assignment section (different "A")
    teacher = f"{PREFIX}-teacher"
    subject = f"{PREFIX}-subject"

    try:
        await db.sections.insert_many([
            {"id": sec_owner, "school_id": school, "grado_id": grado, "nombre": "A"},
            {"id": sec_assign, "school_id": school, "grado_id": grado, "nombre": "A"},
        ])
        # 3 students in sec_owner, 2 DIFFERENT students in sec_assign.
        owner_students = [
            {"id": f"{PREFIX}-o{i}", "school_id": school, "role": "student",
             "student_status": "active", "seccion_id": sec_owner, "grado_id": grado,
             "name": f"O{i}", "last_name": ln}
            for i, ln in enumerate(["Zarate", "Alvarez", "Mendoza"])
        ]
        assign_students = [
            {"id": f"{PREFIX}-a{i}", "school_id": school, "role": "student",
             "student_status": "active", "seccion_id": sec_assign, "grado_id": grado,
             "name": f"A{i}", "last_name": ln}
            for i, ln in enumerate(["Quispe", "Rojas"])
        ]
        await db.users.insert_many(owner_students + assign_students)
        # Teacher assignment is on sec_assign; subject is linked to sec_owner.
        await db.academic_assignments.insert_one({
            "id": f"{PREFIX}-assign", "school_id": school, "teacher_id": teacher,
            "subject_id": subject, "section_id": sec_assign, "status": "activo", "role": "titular",
        })

        # 1) Roster isolation: fetching sec_owner returns ONLY its 3 students
        #    (never merged with sec_assign), sorted by last name.
        roster = await grades._fetch_section_students(school, sec_owner)
        assert [s["last_name"] for s in roster] == ["Alvarez", "Mendoza", "Zarate"], roster
        assert len(roster) == 3

        # 2) Teacher permission granted even though their assignment is on a
        #    DIFFERENT section than the requested one (subject.section_id).
        assignment = await grades._assert_teacher_assignment(school, teacher, subject, sec_owner)
        assert assignment["id"] == f"{PREFIX}-assign"

        # 3) Exact-section assignment still works.
        assignment2 = await grades._assert_teacher_assignment(school, teacher, subject, sec_assign)
        assert assignment2["id"] == f"{PREFIX}-assign"

        # 4) A teacher with NO assignment for this subject is denied (403).
        denied = False
        try:
            await grades._assert_teacher_assignment(school, "other-teacher", subject, sec_owner)
        except Exception as e:
            denied = getattr(e, "status_code", None) == 403
        assert denied, "expected 403 for unassigned teacher"

        print("PASS: register section isolation + permission validated")
    finally:
        await db.sections.delete_many({"id": {"$in": [sec_owner, sec_assign]}})
        await db.users.delete_many({"id": {"$regex": f"^{PREFIX}-"}})
        await db.academic_assignments.delete_many({"id": f"{PREFIX}-assign"})
        client.close()


if __name__ == "__main__":
    asyncio.run(test_register_section_isolation_and_permission())
