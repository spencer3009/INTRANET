"""
Regression test for the P0 Registro Auxiliar bug (Eusebio Arróniz, jun-2026).

Final root cause: a subject's stored `section_id` is SWAPPED/mismatched vs the
section recorded on the course's academic_assignment. The teacher dashboard card
and Usuarios/Estudiantes use the ASSIGNMENT section (e.g. A=22), but the Registro
Auxiliar used subject.section_id (e.g. B=19) → crossed rosters.

Fix (validated here): the register resolves its roster from the course's
assignment section via `_resolve_effective_section_id`, so it always matches the
card. `_fetch_section_students` returns a single section's roster (no merging).
Seeds isolated docs with a unique prefix and cleans up afterwards.
"""
import asyncio
import os
import uuid
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

PREFIX = f"test-xsec-{uuid.uuid4().hex[:8]}"


@pytest.mark.asyncio
async def test_effective_section_resolves_from_assignment():
    import sys
    sys.path.insert(0, "/app/backend")
    from routes import grades

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    school = f"{PREFIX}-school"
    grado = f"{PREFIX}-grado"
    sec_A = f"{PREFIX}-secA"   # official A, 3 students; teacher assignment here
    sec_B = f"{PREFIX}-secB"   # official B, 2 students; subject.section_id (swapped) here
    teacher = f"{PREFIX}-teacher"
    subject = f"{PREFIX}-subject"

    try:
        await db.sections.insert_many([
            {"id": sec_A, "school_id": school, "grado_id": grado, "nombre": "A"},
            {"id": sec_B, "school_id": school, "grado_id": grado, "nombre": "B"},
        ])
        sec_A_students = [
            {"id": f"{PREFIX}-a{i}", "school_id": school, "role": "student",
             "student_status": "active", "seccion_id": sec_A, "grado_id": grado,
             "name": f"A{i}", "last_name": ln}
            for i, ln in enumerate(["Zarate", "Alvarez", "Mendoza"])
        ]
        sec_B_students = [
            {"id": f"{PREFIX}-b{i}", "school_id": school, "role": "student",
             "student_status": "active", "seccion_id": sec_B, "grado_id": grado,
             "name": f"B{i}", "last_name": ln}
            for i, ln in enumerate(["Quispe", "Rojas"])
        ]
        await db.users.insert_many(sec_A_students + sec_B_students)
        # Course's assignment is on sec_A (the card/Usuarios source of truth).
        await db.academic_assignments.insert_one({
            "id": f"{PREFIX}-assign", "school_id": school, "teacher_id": teacher,
            "subject_id": subject, "section_id": sec_A, "status": "activo", "role": "titular",
        })

        # 1) Subject.section_id is SWAPPED (points to B), but the register must
        #    resolve to the assignment section (A) for both teacher and owner.
        eff_teacher = await grades._resolve_effective_section_id(
            school, subject, sec_B, role="teacher", teacher_id=teacher)
        assert eff_teacher == sec_A, eff_teacher
        eff_owner = await grades._resolve_effective_section_id(
            school, subject, sec_B, role="owner", teacher_id=None)
        assert eff_owner == sec_A, eff_owner

        # 2) Roster for the resolved section = the 3 A students (matches the card).
        roster = await grades._fetch_section_students(school, eff_teacher)
        assert [s["last_name"] for s in roster] == ["Alvarez", "Mendoza", "Zarate"]
        assert len(roster) == 3

        # 3) No merging: fetching B alone returns only the 2 B students.
        roster_b = await grades._fetch_section_students(school, sec_B)
        assert len(roster_b) == 2

        # 4) Fallback: with no assignment, effective section = requested section.
        eff_fb = await grades._resolve_effective_section_id(
            school, f"{PREFIX}-no-subject", sec_B, role="owner")
        assert eff_fb == sec_B

        # 5) Permission still denies an unassigned teacher.
        denied = False
        try:
            await grades._assert_teacher_assignment(school, "other-teacher", subject, sec_A)
        except Exception as e:
            denied = getattr(e, "status_code", None) == 403
        assert denied

        print("PASS: effective section resolves from assignment (crossed-data fix)")
    finally:
        await db.sections.delete_many({"id": {"$in": [sec_A, sec_B]}})
        await db.users.delete_many({"id": {"$regex": f"^{PREFIX}-"}})
        await db.academic_assignments.delete_many({"id": f"{PREFIX}-assign"})
        client.close()


if __name__ == "__main__":
    asyncio.run(test_effective_section_resolves_from_assignment())
