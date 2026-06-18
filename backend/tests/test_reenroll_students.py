"""Verify reenroll-students moves students to a section and relocates their
subject grades. Relocates, never deletes."""
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
    s3, s4 = f"S3-{tag}", f"S4-{tag}"   # 3 años (wrong), 4 años (target)
    stu = f"STU-{tag}"
    headers = {"Authorization": f"Bearer {tok()}"}

    await db.sections.insert_many([
        {"id": s3, "school_id": SCHOOL_ID, "nombre": "ÚNICA", "grado_id": "g3"},
        {"id": s4, "school_id": SCHOOL_ID, "nombre": "ÚNICA", "grado_id": "g4"},
    ])
    await db.users.insert_one({"id": stu, "school_id": SCHOOL_ID, "role": "student", "name": "Valeria", "last_name": "Beltran", "seccion_id": s3, "student_status": "enrolled"})
    gid = str(uuid.uuid4())
    await db.student_grades.insert_one({"id": gid, "school_id": SCHOOL_ID, "subject_id": subj, "section_id": s3, "student_id": stu, "period_id": "p1", "grade": 17})

    try:
        async with httpx.AsyncClient(timeout=60) as c:
            res = await c.post(f"{API}/admin/data-integrity/reenroll-students", headers=headers, json={
                "student_ids": [stu], "target_section_id": s4, "move_subject_id": subj,
            })
            assert res.status_code == 200, res.text
            body = res.json()
            assert body["reenrolled"] == 1 and body["grades_moved"] == 1, body
            print("REENROLL OK:", body)

        u = await db.users.find_one({"id": stu})
        assert u["seccion_id"] == s4 and u["section_id"] == s4, u
        g = await db.student_grades.find_one({"id": gid})
        assert g["section_id"] == s4, g
        print("VERIFIED: alumno y su nota ahora en 4 años")
        print("ALL PASS")
    finally:
        await db.sections.delete_many({"id": {"$in": [s3, s4]}})
        await db.users.delete_many({"id": stu})
        await db.student_grades.delete_many({"subject_id": subj})


if __name__ == "__main__":
    asyncio.run(main())
