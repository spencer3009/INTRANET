"""Verify remove-assignment removes ONLY one section of a multi-section subject,
keeping the subject and its OTHER sections' grades intact (Diana INGLES safety).
"""
import os, asyncio, uuid, jwt, httpx, datetime
from motor.motor_asyncio import AsyncIOMotorClient

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
API = f"{BASE}/api"
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"


def tok():
    return jwt.encode({"sub": "t-sup", "scope": "support_switch", "active_school_id": SCHOOL_ID,
                       "original_role": "system_admin_global",
                       "exp": datetime.datetime.now(datetime.timezone.utc).timestamp() + 3600},
                      JWT_SECRET, algorithm="HS256")


async def main():
    tag = uuid.uuid4().hex[:6]
    teacher = f"T-{tag}"
    subj = f"SUBJ-{tag}"           # INGLES multi-section
    s3, s4 = f"S3-{tag}", f"S4-{tag}"
    headers = {"Authorization": f"Bearer {tok()}"}

    await db.subjects.insert_one({"id": subj, "school_id": SCHOOL_ID, "name": "INGLES", "section_id": s4})
    await db.academic_assignments.insert_many([
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "teacher_id": teacher, "subject_id": subj, "section_id": s3, "status": "activo"},
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "teacher_id": teacher, "subject_id": subj, "section_id": s4, "status": "activo"},
    ])
    # 31 notes in s3 (must SURVIVE), 0 in s4 (the empty section to remove)
    g3 = str(uuid.uuid4())
    await db.student_grades.insert_one({"id": g3, "school_id": SCHOOL_ID, "subject_id": subj, "section_id": s3, "student_id": "x", "period_id": "p1", "grade": 17})

    try:
        async with httpx.AsyncClient(timeout=60) as c:
            res = await c.post(f"{API}/admin/data-integrity/remove-assignment", headers=headers,
                               json={"subject_id": subj, "section_id": s4, "teacher_id": teacher})
            assert res.status_code == 200, res.text
            print("REMOVE OK:", res.json()["deleted"])

        # s4 assignment gone, s3 assignment + grade SURVIVE, subject SURVIVES
        assert await db.academic_assignments.count_documents({"subject_id": subj, "section_id": s4}) == 0
        assert await db.academic_assignments.count_documents({"subject_id": subj, "section_id": s3}) == 1
        assert await db.subjects.count_documents({"id": subj}) == 1
        assert await db.student_grades.count_documents({"id": g3}) == 1
        # subject.section_id repointed away from removed s4 to remaining s3
        s = await db.subjects.find_one({"id": subj})
        assert s["section_id"] == s3, s
        print("SAFETY VERIFIED: 3 años notes + subject intact; only 4 años removed")
        print("ALL PASS")
    finally:
        await db.subjects.delete_many({"id": subj})
        await db.academic_assignments.delete_many({"teacher_id": teacher})
        await db.student_grades.delete_many({"subject_id": subj})


if __name__ == "__main__":
    asyncio.run(main())
