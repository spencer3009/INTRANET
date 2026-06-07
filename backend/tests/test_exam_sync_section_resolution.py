"""
Regression: exam grades synced to the Registro Auxiliar must be visible even
when the subject (and therefore the exam) has NO section_id.

Root cause fixed: the Registro Auxiliar GET queries student_grades strictly by
section_id. The sync used to upsert WITHOUT section_id when the exam inherited a
null section_id from its subject, so the grade landed on a section-less doc the
register could never surface -> "el modal muestra notas pero el registro sale
vacío".

Fix: sync resolves the section from the student's own enrollment (seccion_id)
when the source has none.
"""
import asyncio
import uuid
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient
from services.register_sync import sync_to_register

v = dotenv_values('/app/backend/.env')


async def _run():
    client = AsyncIOMotorClient(v['MONGO_URL'])
    db = client[v['DB_NAME']]

    school_id = f"test-school-{uuid.uuid4()}"
    section_id = f"test-section-{uuid.uuid4()}"
    subject_id = f"test-subject-{uuid.uuid4()}"
    period_id = f"test-period-{uuid.uuid4()}"
    col_id = f"col-{uuid.uuid4()}"  # dynamic custom column
    student_id = f"test-student-{uuid.uuid4()}"
    exam_id = f"test-exam-{uuid.uuid4()}"

    created = []
    try:
        # Student enrolled in a section
        await db.users.insert_one({
            "id": student_id, "school_id": school_id, "role": "student",
            "name": "Test", "last_name": "Alumno", "seccion_id": section_id,
            "student_status": "active",
        })
        created.append(("users", student_id))

        # Custom template owning the dynamic column
        tpl_id = f"tpl-{uuid.uuid4()}"
        await db.registro_auxiliar_plantillas.insert_one({
            "id": tpl_id, "school_id": school_id, "nombre": "Nueva Plantilla",
            "es_sistema": False, "estado": "activa", "es_predeterminada": True,
            "criterios": [{
                "id": "crit-pasitos", "nombre": "PASITOS", "porcentaje": 20,
                "subcolumnas": [
                    {"id": col_id, "label": "PASITOS 2", "tipo": "input"},
                ],
            }],
            "columnas_finales": [],
        })
        created.append(("registro_auxiliar_plantillas", tpl_id))

        # Exam with NO section_id (inherited from a section-less subject)
        await db.online_exams.insert_one({
            "id": exam_id, "school_id": school_id, "subject_id": subject_id,
            "section_id": None, "title": "PASITO 2", "type": "digital",
            "status": "published", "period_id": period_id,
            "register_column": col_id, "sync_status": "pending",
        })
        created.append(("online_exams", exam_id))

        # Completed attempt (75% -> 15/20)
        attempt_id = f"att-{uuid.uuid4()}"
        await db.exam_attempts.insert_one({
            "id": attempt_id, "exam_id": exam_id, "school_id": school_id,
            "student_id": student_id, "status": "completed", "percentage": 75.0,
            "score": 15, "max_score": 20,
        })
        created.append(("exam_attempts", attempt_id))

        # Run the sync (mirrors edit/force re-sync path)
        await sync_to_register(db, exam_id, "exam", "update")

        # The Registro Auxiliar query is strict on section_id -> this must match
        doc = await db.student_grades.find_one({
            "school_id": school_id, "subject_id": subject_id,
            "section_id": section_id, "period_id": period_id,
            "student_id": student_id,
        })
        assert doc is not None, "FAIL: no student_grades doc with section_id was created"
        gd = doc.get("grades_dynamic") or {}
        assert gd.get(col_id) == 15, f"FAIL: expected 15 in grades_dynamic[{col_id}], got {gd.get(col_id)}"
        print("PASS: exam grade visible in section-scoped Registro Auxiliar (15/20)")

        # cleanup synthetic student_grades doc too
        created.append(("student_grades", doc.get("id") or doc.get("_id")))
    finally:
        await db.users.delete_one({"id": student_id})
        await db.registro_auxiliar_plantillas.delete_many({"school_id": school_id})
        await db.online_exams.delete_one({"id": exam_id})
        await db.exam_attempts.delete_many({"exam_id": exam_id})
        await db.student_grades.delete_many({"school_id": school_id})
        client.close()


def test_exam_sync_resolves_student_section():
    asyncio.get_event_loop().run_until_complete(_run())


if __name__ == "__main__":
    asyncio.run(_run())
