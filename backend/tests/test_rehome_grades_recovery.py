"""Reproduce Diana's grade-loss and verify recovery.

Scenario: ONE subject "INGLES" assigned to 3 sections (3/4/5 años), subject
points to 3 años. 3 años students have grades stored under 3 años. The OLD
"Corregir" would migrate those grades to another section (data loss). Now:
  1) fix-section-mismatch REFUSES for multi-section subjects (no corruption).
  2) After a simulated bad migration, rehome-grades relocates each grade back
     to the student's real section (recovery).
Cleans up afterwards.
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
    subj = f"SUBJ-{tag}"
    s3, s4, s5 = f"S3-{tag}", f"S4-{tag}", f"S5-{tag}"
    stu3 = f"STU3-{tag}"  # enrolled in 3 años
    headers = {"Authorization": f"Bearer {tok()}"}

    await db.sections.insert_many([
        {"id": s3, "school_id": SCHOOL_ID, "nombre": "ÚNICA", "grado_id": "g3"},
        {"id": s4, "school_id": SCHOOL_ID, "nombre": "ÚNICA", "grado_id": "g4"},
        {"id": s5, "school_id": SCHOOL_ID, "nombre": "ÚNICA", "grado_id": "g5"},
    ])
    await db.subjects.insert_one({"id": subj, "school_id": SCHOOL_ID, "name": "INGLES", "section_id": s3})
    await db.academic_assignments.insert_many([
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "teacher_id": teacher, "subject_id": subj, "section_id": s3, "status": "activo"},
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "teacher_id": teacher, "subject_id": subj, "section_id": s4, "status": "activo"},
        {"id": str(uuid.uuid4()), "school_id": SCHOOL_ID, "teacher_id": teacher, "subject_id": subj, "section_id": s5, "status": "activo"},
    ])
    await db.users.insert_one({"id": stu3, "school_id": SCHOOL_ID, "role": "student", "seccion_id": s3, "name": "Niño", "last_name": "Tres"})
    # Grade for the 3-años student, but stored under 4 años (simulating the bad migration).
    gid = str(uuid.uuid4())
    await db.student_grades.insert_one({"id": gid, "school_id": SCHOOL_ID, "subject_id": subj, "section_id": s4, "student_id": stu3, "period_id": "p1", "grade": 17})

    try:
        async with httpx.AsyncClient(timeout=60) as c:
            # 1) fix-section-mismatch must REFUSE (multi-section).
            r = await c.post(f"{API}/admin/data-integrity/fix-section-mismatch", headers=headers,
                             json={"subject_id": subj, "target_section_id": s4})
            assert r.status_code == 400 and "multi" in r.text.lower(), r.text
            print("GUARD OK: Corregir bloqueado para multi-sección")

            # 2) preview rehome → 1 grade to relocate (s4 -> s3)
            pv = (await c.get(f"{API}/admin/data-integrity/rehome-grades/{subj}/preview", headers=headers)).json()
            assert pv["to_relocate"] == 1, pv
            print("PREVIEW OK:", pv["breakdown"])

            # 3) rehome → grade moves back to s3 (student's real section)
            rh = (await c.post(f"{API}/admin/data-integrity/rehome-grades/{subj}", headers=headers)).json()
            assert rh["relocated"] == 1, rh
            print("REHOME OK:", rh["relocated"], "movida(s)")

        g = await db.student_grades.find_one({"id": gid})
        assert g["section_id"] == s3, g
        print("RECOVERY VERIFIED: nota de vuelta en 3 años")
        print("ALL PASS")
    finally:
        await db.sections.delete_many({"id": {"$in": [s3, s4, s5]}})
        await db.subjects.delete_many({"id": subj})
        await db.academic_assignments.delete_many({"teacher_id": teacher})
        await db.users.delete_many({"id": stu3})
        await db.student_grades.delete_many({"subject_id": subj})


if __name__ == "__main__":
    asyncio.run(main())
