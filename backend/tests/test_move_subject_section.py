"""E2E test for support-only move-subject-section + duplicate-name detection.

Seeds a Diana-like scenario: two English subjects ("INGLES" / "INGLÉS") in the
SAME section (should be flagged as dup_in_section), plus a move of a course to a
different section (assignment + grades migrate). Cleans up afterwards.
"""
import os
import asyncio
import uuid
import jwt
import httpx
import datetime
from motor.motor_asyncio import AsyncIOMotorClient

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
API = f"{BASE}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"


def support_token():
    return jwt.encode({
        "sub": "test-support", "email": "s@t.test", "name": "Soporte",
        "scope": "support_switch", "active_school_id": SCHOOL_ID,
        "original_role": "system_admin_global",
        "exp": datetime.datetime.now(datetime.timezone.utc).timestamp() + 3600,
    }, JWT_SECRET, algorithm="HS256")


async def main():
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    tag = uuid.uuid4().hex[:6]
    teacher_id = f"T-DIANA-{tag}"
    sec_a = f"SEC-A-{tag}"   # 4 años ÚNICA
    sec_b = f"SEC-B-{tag}"   # 3 años ÚNICA
    subj_ingles = f"SUBJ-INGLES-{tag}"   # "INGLES"  (no accent) in sec_a
    subj_inglesA = f"SUBJ-INGLESA-{tag}" # "INGLÉS" (accent) in sec_a  -> duplicate of above
    grade_a = f"G-A-{tag}"
    grade_b = f"G-B-{tag}"

    await db.grades.insert_many([
        {"id": grade_a, "school_id": SCHOOL_ID, "nombre": "4 años (TEST)"},
        {"id": grade_b, "school_id": SCHOOL_ID, "nombre": "3 años (TEST)"},
    ])
    await db.sections.insert_many([
        {"id": sec_a, "school_id": SCHOOL_ID, "nombre": "ÚNICA", "grado_id": grade_a},
        {"id": sec_b, "school_id": SCHOOL_ID, "nombre": "ÚNICA", "grado_id": grade_b},
    ])
    await db.subjects.insert_many([
        {"id": subj_ingles, "school_id": SCHOOL_ID, "name": "INGLES", "section_id": sec_a},
        {"id": subj_inglesA, "school_id": SCHOOL_ID, "name": "INGLÉS", "section_id": sec_a},
    ])
    await db.academic_assignments.insert_many([
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "teacher_id": teacher_id, "subject_id": subj_ingles, "section_id": sec_a, "status": "activo"},
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "teacher_id": teacher_id, "subject_id": subj_inglesA, "section_id": sec_a, "status": "activo"},
    ])
    await db.student_grades.insert_one({"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "subject_id": subj_ingles, "section_id": sec_a, "student_id": "stud1", "period_id": "p1", "grade": 18})

    headers = {"Authorization": f"Bearer {support_token()}"}
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            ts = (await c.get(f"{API}/admin/data-integrity/teacher-sections", headers=headers)).json()
            mine = [r for r in ts["rows"] if r["teacher_id"] == teacher_id]
            assert len(mine) == 2, mine
            # Both INGLES/INGLÉS in sec_a must be flagged as duplicate-in-section.
            assert all(r["dup_in_section"] for r in mine), mine
            assert ts["dup_subject_count"] >= 2
            print("DUP DETECTION OK: both flagged dup_in_section")

            # Move "INGLES" from sec_a (4 años) to sec_b (3 años).
            res = await c.post(f"{API}/admin/data-integrity/move-subject-section", headers=headers, json={
                "subject_id": subj_ingles, "from_section_id": sec_a,
                "target_section_id": sec_b, "teacher_id": teacher_id,
            })
            assert res.status_code == 200, res.text
            moved = res.json()["moved"]
            assert moved["assignments"] == 1, moved
            assert moved["subject_repointed"] is True, moved
            assert moved["student_grades"] == 1, moved
            print("MOVE OK:", moved)

        # Verify DB state
        a = await db.academic_assignments.find_one({"subject_id": subj_ingles})
        assert a["section_id"] == sec_b, a
        s = await db.subjects.find_one({"id": subj_ingles})
        assert s["section_id"] == sec_b, s
        g = await db.student_grades.find_one({"subject_id": subj_ingles})
        assert g["section_id"] == sec_b, g
        print("DB STATE OK — course moved to 3 años")
        print("ALL PASS")
    finally:
        await db.grades.delete_many({"id": {"$in": [grade_a, grade_b]}})
        await db.sections.delete_many({"id": {"$in": [sec_a, sec_b]}})
        await db.subjects.delete_many({"id": {"$in": [subj_ingles, subj_inglesA]}})
        await db.academic_assignments.delete_many({"teacher_id": teacher_id})
        await db.student_grades.delete_many({"subject_id": {"$in": [subj_ingles, subj_inglesA]}})


if __name__ == "__main__":
    asyncio.run(main())
