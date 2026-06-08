"""
Regression P0: an exam linked to a CUSTOM final column (columnas_finales),
e.g. "PARCIALES" with a UUID id, used to fail at sync time with the false
error "La columna 'PARCIALES' ya no existe en la plantilla activa".

Root cause: get_storage_field -> _column_exists_in only scanned
`criterios > subcolumnas` and IGNORED `columnas_finales`, while link-time
validation (get_valid_exam_columns_for_school) DID include columnas_finales.
So linking succeeded but syncing returned (None, None) -> column_unknown.

Fix: _column_exists_in now also scans columnas_finales (id/field_key/label/
label_corto), resolving the custom final column to dynamic storage.
"""
import asyncio
import uuid
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient
from services.register_sync import get_storage_field, sync_to_register

v = dotenv_values('/app/backend/.env')


async def _run():
    client = AsyncIOMotorClient(v['MONGO_URL'])
    db = client[v['DB_NAME']]

    school_id = f"test-school-{uuid.uuid4()}"
    section_id = f"test-section-{uuid.uuid4()}"
    subject_id = f"test-subject-{uuid.uuid4()}"
    period_id = f"test-period-{uuid.uuid4()}"
    final_col_id = f"finalcol-{uuid.uuid4()}"  # custom final column "PARCIALES"
    student_id = f"test-student-{uuid.uuid4()}"
    exam_id = f"test-exam-{uuid.uuid4()}"
    tpl_id = f"tpl-{uuid.uuid4()}"

    try:
        await db.users.insert_one({
            "id": student_id, "school_id": school_id, "role": "student",
            "name": "Test", "last_name": "Alumno", "seccion_id": section_id,
            "student_status": "active",
        })

        # Custom template with a CUSTOM final column "PARCIALES" (UUID id).
        await db.registro_auxiliar_plantillas.insert_one({
            "id": tpl_id, "school_id": school_id, "nombre": "Plantilla Parciales",
            "es_sistema": False, "estado": "activa", "es_predeterminada": True,
            "criterios": [{
                "id": "crit-1", "nombre": "PASITOS", "porcentaje": 20,
                "subcolumnas": [{"id": "p1", "label": "P1", "tipo": "input"}],
            }],
            "columnas_finales": [
                {"id": final_col_id, "label": "PARCIALES", "label_corto": "PARC",
                 "porcentaje": 30, "orden": 0},
            ],
        })

        # 1) get_storage_field must resolve the custom final column to dynamic.
        field_type, field_key = await get_storage_field(db, final_col_id, school_id)
        assert field_type == "dynamic", (
            f"FAIL: expected dynamic for custom final column, got {field_type}"
        )
        assert field_key == final_col_id, f"FAIL: field_key={field_key}"
        print("PASS: get_storage_field resolves custom 'PARCIALES' final column -> dynamic")

        # Exam linked to the final column.
        await db.online_exams.insert_one({
            "id": exam_id, "school_id": school_id, "subject_id": subject_id,
            "section_id": None, "title": "Parcial 1", "type": "digital",
            "status": "published", "period_id": period_id,
            "register_column": final_col_id, "sync_status": "pending",
        })
        attempt_id = f"att-{uuid.uuid4()}"
        await db.exam_attempts.insert_one({
            "id": attempt_id, "exam_id": exam_id, "school_id": school_id,
            "student_id": student_id, "status": "completed", "percentage": 80.0,
            "score": 16, "max_score": 20,
        })

        # 2) Full sync must land the grade (16/20) under grades_dynamic.
        await sync_to_register(db, exam_id, "exam", "update")
        doc = await db.student_grades.find_one({
            "school_id": school_id, "subject_id": subject_id,
            "section_id": section_id, "period_id": period_id,
            "student_id": student_id,
        })
        assert doc is not None, "FAIL: no section-scoped student_grades doc created"
        gd = doc.get("grades_dynamic") or {}
        assert gd.get(final_col_id) == 16, (
            f"FAIL: expected 16 in grades_dynamic[{final_col_id}], got {gd.get(final_col_id)}"
        )

        exam_doc = await db.online_exams.find_one({"id": exam_id}, {"_id": 0, "sync_status": 1})
        assert exam_doc.get("sync_status") == "synced", (
            f"FAIL: exam not marked synced, got {exam_doc.get('sync_status')}"
        )
        print("PASS: exam synced to custom 'PARCIALES' final column (16/20)")
    finally:
        await db.users.delete_one({"id": student_id})
        await db.registro_auxiliar_plantillas.delete_many({"school_id": school_id})
        await db.online_exams.delete_one({"id": exam_id})
        await db.exam_attempts.delete_many({"exam_id": exam_id})
        await db.student_grades.delete_many({"school_id": school_id})
        client.close()


def test_exam_sync_custom_final_column():
    asyncio.get_event_loop().run_until_complete(_run())


if __name__ == "__main__":
    asyncio.run(_run())
