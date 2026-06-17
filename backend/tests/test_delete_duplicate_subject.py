"""E2E test for support-only duplicate subject deletion + impact preview.

Mints a support_switch token, seeds a throwaway subject with an assignment and
a grade, verifies the impact endpoint counts them, deletes the subject and
asserts everything tied to it is purged (no orphans), then cleans up.
"""
import os
import asyncio
import uuid
import jwt
import httpx
from motor.motor_asyncio import AsyncIOMotorClient

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
API = f"{BASE}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"  # El Roble (preview)


def support_token():
    return jwt.encode({
        "sub": "test-support-agent",
        "email": "support@edunet.test",
        "name": "Soporte Test",
        "scope": "support_switch",
        "active_school_id": SCHOOL_ID,
        "original_role": "system_admin_global",
        "exp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).timestamp() + 3600,
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def main():
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    sid = f"TEST-DUP-SUBJ-{uuid.uuid4().hex[:8]}"
    sec = await db.sections.find_one({"school_id": SCHOOL_ID}, {"_id": 0, "id": 1})
    section_id = sec["id"]
    teacher = await db.users.find_one({"school_id": SCHOOL_ID, "role": "teacher"}, {"_id": 0, "id": 1})
    teacher_id = teacher["id"]

    # Seed
    await db.subjects.insert_one({"id": sid, "school_id": SCHOOL_ID, "name": "INGLES (DUP TEST)", "section_id": section_id})
    await db.academic_assignments.insert_one({"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "subject_id": sid, "section_id": section_id, "teacher_id": teacher_id, "status": "active"})
    await db.student_grades.insert_one({"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "subject_id": sid, "section_id": section_id, "student_id": "x", "period_id": "p1", "grade": 15})

    headers = {"Authorization": f"Bearer {support_token()}"}
    async with httpx.AsyncClient(timeout=30) as c:
        imp = (await c.get(f"{API}/admin/data-integrity/subject/{sid}/impact", headers=headers)).json()
        assert imp["impact"]["assignments"] == 1, imp
        assert imp["impact"]["grades"] == 1, imp
        print("IMPACT OK:", imp["impact"])

        res = await c.delete(f"{API}/admin/data-integrity/subject/{sid}", headers=headers)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["deleted"]["subject"] == 1, body
        assert body["deleted"]["assignments"] == 1, body
        assert body["deleted"]["grades"] == 1, body
        print("DELETE OK:", body["deleted"])

    # Verify no orphans
    assert await db.subjects.count_documents({"id": sid}) == 0
    assert await db.academic_assignments.count_documents({"subject_id": sid}) == 0
    assert await db.student_grades.count_documents({"subject_id": sid}) == 0
    print("NO ORPHANS — PASS")

    # Non-support is rejected (404 endpoints require support; use a plain owner-less token)
    bad = jwt.encode({"sub": "nobody", "exp": 9999999999}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.delete(f"{API}/admin/data-integrity/subject/whatever", headers={"Authorization": f"Bearer {bad}"})
        assert r.status_code == 403, r.text
        print("AUTH GUARD OK:", r.status_code)


if __name__ == "__main__":
    asyncio.run(main())
