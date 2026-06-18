"""Verify merge-grades moves grades INGLES -> INGLÉS (same section) and that
teacher-sections returns all_sections + dup_siblings."""
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
    subjA = f"INGLES-{tag}"   # has notes
    subjB = f"INGLES-ACC-{tag}"  # empty (INGLÉS)
    s4 = f"S4-{tag}"
    g4 = f"G4-{tag}"
    headers = {"Authorization": f"Bearer {tok()}"}

    await db.grades.insert_one({"id": g4, "school_id": SCHOOL_ID, "nombre": "4 años"})
    await db.sections.insert_one({"id": s4, "school_id": SCHOOL_ID, "nombre": "ÚNICA", "grado_id": g4})
    await db.subjects.insert_many([
        {"id": subjA, "school_id": SCHOOL_ID, "name": "INGLES", "section_id": s4},
        {"id": subjB, "school_id": SCHOOL_ID, "name": "INGLÉS", "section_id": s4},
    ])
    await db.academic_assignments.insert_many([
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "teacher_id": teacher, "subject_id": subjA, "section_id": s4, "status": "activo"},
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "teacher_id": teacher, "subject_id": subjB, "section_id": s4, "status": "activo"},
    ])
    gid = str(uuid.uuid4())
    await db.student_grades.insert_one({"id": gid, "school_id": SCHOOL_ID, "subject_id": subjA, "section_id": s4, "student_id": "stud1", "period_id": "p1", "grade": 17})

    try:
        async with httpx.AsyncClient(timeout=60) as c:
            ts = (await c.get(f"{API}/admin/data-integrity/teacher-sections", headers=headers)).json()
            assert isinstance(ts.get("all_sections"), list) and len(ts["all_sections"]) > 0, "all_sections missing"
            mine = [r for r in ts["rows"] if r["teacher_id"] == teacher]
            rowA = next(r for r in mine if r["subject_id"] == subjA)
            sib_ids = [s["subject_id"] for s in rowA.get("dup_siblings", [])]
            assert subjB in sib_ids, rowA.get("dup_siblings")
            print("all_sections + dup_siblings OK")

            res = await c.post(f"{API}/admin/data-integrity/merge-grades", headers=headers, json={
                "from_subject_id": subjA, "to_subject_id": subjB, "section_id": s4,
            })
            assert res.status_code == 200, res.text
            assert res.json()["moved"] == 1, res.json()
            print("MERGE OK:", res.json())

        g = await db.student_grades.find_one({"id": gid})
        assert g["subject_id"] == subjB and g["section_id"] == s4, g
        print("VERIFIED: nota ahora bajo INGLÉS")
        print("ALL PASS")
    finally:
        await db.grades.delete_many({"id": g4})
        await db.sections.delete_many({"id": s4})
        await db.subjects.delete_many({"id": {"$in": [subjA, subjB]}})
        await db.academic_assignments.delete_many({"teacher_id": teacher})
        await db.student_grades.delete_many({"subject_id": {"$in": [subjA, subjB]}})


if __name__ == "__main__":
    asyncio.run(main())
