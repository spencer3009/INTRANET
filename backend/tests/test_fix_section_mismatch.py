"""
Regression test for the support-only "Corregir sección cruzada" fix
(Eusebio Arróniz, jun-2026).

Validates the actual endpoint function `fix_section_mismatch`:
  - support session is required (non-support → 403)
  - subject.section_id is re-pointed to the assignment section
  - student_grades / evaluation_config / grade_register_status stored under the
    OLD section are migrated to the NEW section (collisions skipped)
Seeds isolated docs with a unique prefix and cleans up afterwards.
"""
import asyncio
import os
import uuid
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
PREFIX = f"test-fix-{uuid.uuid4().hex[:8]}"


@pytest.mark.asyncio
async def test_fix_section_mismatch_endpoint():
    import sys
    sys.path.insert(0, "/app/backend")
    from routes.admin_portal import fix_section_mismatch, FixSectionMismatchRequest

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    school = f"{PREFIX}-school"
    sec_old = f"{PREFIX}-secOld"   # wrong section the subject points to
    sec_new = f"{PREFIX}-secNew"   # correct section (assignment)
    subject = f"{PREFIX}-subject"
    teacher = f"{PREFIX}-teacher"

    support_user = {
        "scope": "support_switch", "sub": "support-tester",
        "email": "s@x", "name": "S", "school_id": school, "active_school_id": school,
        "role": "owner", "original_role": "system_admin_global",
    }
    normal_user = {"sub": f"{PREFIX}-owner"}

    try:
        await db.subjects.insert_one({"id": subject, "school_id": school, "name": "Inglés", "section_id": sec_old})
        await db.academic_assignments.insert_one({
            "id": f"{PREFIX}-assign", "school_id": school, "teacher_id": teacher,
            "subject_id": subject, "section_id": sec_new, "status": "activo", "role": "titular",
        })
        # A grade + config + register-status under the WRONG (old) section.
        await db.student_grades.insert_one({
            "id": f"{PREFIX}-g1", "school_id": school, "subject_id": subject,
            "section_id": sec_old, "student_id": f"{PREFIX}-stu1", "period_id": "p1", "final_grade": 18,
        })
        await db.evaluation_config.insert_one({
            "id": f"{PREFIX}-cfg", "school_id": school, "subject_id": subject, "section_id": sec_old,
        })
        await db.grade_register_status.insert_one({
            "id": f"{PREFIX}-st", "school_id": school, "subject_id": subject, "section_id": sec_old, "period_id": "p1",
        })
        # Seed a normal (non-support) user for the 403 check.
        await db.users.insert_one({"id": f"{PREFIX}-owner", "school_id": school, "role": "owner", "is_owner": True})

        # 1) Non-support is rejected.
        denied = False
        try:
            await fix_section_mismatch(FixSectionMismatchRequest(subject_id=subject, target_section_id=sec_new), normal_user)
        except Exception as e:
            denied = getattr(e, "status_code", None) == 403
        assert denied, "non-support must get 403"

        # 2) Support fix succeeds and re-points the subject.
        res = await fix_section_mismatch(
            FixSectionMismatchRequest(subject_id=subject, target_section_id=sec_new), support_user)
        assert res["changed"] is True, res
        assert res["new_section_id"] == sec_new

        subj = await db.subjects.find_one({"id": subject})
        assert subj["section_id"] == sec_new, "subject must point to new section"

        # 3) Grades + config + status migrated to the new section.
        g = await db.student_grades.find_one({"id": f"{PREFIX}-g1"})
        assert g["section_id"] == sec_new, "grade must follow to new section"
        cfg = await db.evaluation_config.find_one({"id": f"{PREFIX}-cfg"})
        assert cfg["section_id"] == sec_new
        st = await db.grade_register_status.find_one({"id": f"{PREFIX}-st"})
        assert st["section_id"] == sec_new
        assert res["migrated"]["student_grades"] == 1

        # 4) Invalid target (no assignment) is rejected.
        bad = False
        try:
            await fix_section_mismatch(
                FixSectionMismatchRequest(subject_id=subject, target_section_id=f"{PREFIX}-nope"), support_user)
        except Exception as e:
            bad = getattr(e, "status_code", None) == 400
        assert bad, "target without assignment must 400"

        print("PASS: fix_section_mismatch re-points subject and migrates grades/config/status")
    finally:
        await db.subjects.delete_many({"id": subject})
        await db.academic_assignments.delete_many({"id": f"{PREFIX}-assign"})
        await db.student_grades.delete_many({"id": f"{PREFIX}-g1"})
        await db.evaluation_config.delete_many({"id": f"{PREFIX}-cfg"})
        await db.grade_register_status.delete_many({"id": f"{PREFIX}-st"})
        await db.users.delete_many({"id": f"{PREFIX}-owner"})
        client.close()


if __name__ == "__main__":
    asyncio.run(test_fix_section_mismatch_endpoint())
