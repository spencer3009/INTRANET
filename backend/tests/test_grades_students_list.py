"""Verify grades-students lists owners of a subject's grades + enrolled section."""
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
    subj = f"SUBJ-{tag}"
    s3 = f"S3-{tag}"
    g3 = f"G3-{tag}"
    stuA = f"A-{tag}"  # enrolled in s3 (matches)
    stuB = f"B-{tag}"  # enrolled elsewhere (mismatch)
    headers = {"Authorization": f"Bearer {tok()}"}

    await db.grades.insert_one({"id": g3, "school_id": SCHOOL_ID, "nombre": "3 años"})
    await db.sections.insert_one({"id": s3, "school_id": SCHOOL_ID, "nombre": "ÚNICA", "grado_id": g3})
    await db.users.insert_many([
        {"id": stuA, "school_id": SCHOOL_ID, "role": "student", "name": "Ana", "last_name": "Perez", "seccion_id": s3},
        {"id": stuB, "school_id": SCHOOL_ID, "role": "student", "name": "Beto", "last_name": "Lopez", "seccion_id": "OTRA-SEC"},
    ])
    await db.student_grades.insert_many([
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "subject_id": subj, "section_id": s3, "student_id": stuA, "period_id": "p1", "grade": 18},
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "subject_id": subj, "section_id": s3, "student_id": stuB, "period_id": "p1", "grade": 14},
    ])
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            res = (await c.get(f"{API}/admin/data-integrity/subject/{subj}/grades-students",
                               headers=headers, params={"section_id": s3})).json()
        assert res["count"] == 2, res
        by = {s["student_id"]: s for s in res["students"]}
        assert by[stuA]["matches_grade_section"] is True, res
        assert by[stuB]["matches_grade_section"] is False, res
        print("OK:", [(s["name"], s["enrolled_section"], s["matches_grade_section"]) for s in res["students"]])
        print("ALL PASS")
    finally:
        await db.grades.delete_many({"id": g3})
        await db.sections.delete_many({"id": s3})
        await db.users.delete_many({"id": {"$in": [stuA, stuB]}})
        await db.student_grades.delete_many({"subject_id": subj})


if __name__ == "__main__":
    asyncio.run(main())
