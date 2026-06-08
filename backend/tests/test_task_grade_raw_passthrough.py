"""
Behavior change (requested by user, Jun 2026): task grades must be copied
AS-IS to the Registro Auxiliar — NO rescaling against the task max.

Before: a task with max_grade=18 graded 18/18 was rescaled to 18*20/18 = 20.
Now: the register shows exactly what the teacher typed (18 -> 18), clamped to
the valid vigesimal range [0, 20].
"""
import asyncio
import uuid
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient
from services.register_sync import task_score_to_vigesimal, sync_to_register

v = dotenv_values('/app/backend/.env')


def test_raw_passthrough_unit():
    # The teacher-entered grade is returned verbatim (clamped to 0..20).
    assert task_score_to_vigesimal(18) == 18          # was 20 before (18/18*20)
    assert task_score_to_vigesimal(9) == 9            # was 10 before (9/18*20)
    assert task_score_to_vigesimal(20) == 20
    assert task_score_to_vigesimal(17.5) == 17.5      # decimals preserved
    assert task_score_to_vigesimal(25) == 20          # clamp high
    assert task_score_to_vigesimal(-3) == 0           # clamp low
    assert task_score_to_vigesimal(None) == 0
    print("PASS: task grade raw passthrough unit (18->18, 9->9, clamp 0..20)")


async def _run_sync():
    client = AsyncIOMotorClient(v['MONGO_URL'])
    db = client[v['DB_NAME']]

    school_id = f"test-school-{uuid.uuid4()}"
    section_id = f"test-section-{uuid.uuid4()}"
    subject_id = f"test-subject-{uuid.uuid4()}"
    period_id = f"test-period-{uuid.uuid4()}"
    col_id = f"col-{uuid.uuid4()}"
    student_id = f"test-student-{uuid.uuid4()}"
    task_id = f"test-task-{uuid.uuid4()}"
    tpl_id = f"tpl-{uuid.uuid4()}"

    try:
        await db.users.insert_one({
            "id": student_id, "school_id": school_id, "role": "student",
            "name": "Test", "last_name": "Alumno", "seccion_id": section_id,
            "student_status": "active",
        })
        await db.registro_auxiliar_plantillas.insert_one({
            "id": tpl_id, "school_id": school_id, "nombre": "Plantilla",
            "es_sistema": False, "estado": "activa", "es_predeterminada": True,
            "criterios": [{
                "id": "crit-1", "nombre": "TAREAS", "porcentaje": 20,
                "subcolumnas": [{"id": col_id, "label": "SEM3", "tipo": "input"}],
            }],
            "columnas_finales": [],
        })
        # Task whose MAX is 18 (not 20), graded 18/18 by the teacher.
        await db.course_posts.insert_one({
            "id": task_id, "school_id": school_id, "subject_id": subject_id,
            "section_id": section_id, "post_type": "task", "type": "task",
            "title": "Tarea Sem 3", "period_id": period_id,
            "register_column": col_id, "sync_status": "pending",
            "max_grade": 18,
            "submissions": [{"student_id": student_id, "grade": 18}],
        })

        await sync_to_register(db, task_id, "task", "update")

        doc = await db.student_grades.find_one({
            "school_id": school_id, "subject_id": subject_id,
            "section_id": section_id, "period_id": period_id,
            "student_id": student_id,
        })
        assert doc is not None, "FAIL: no student_grades doc created"
        gd = doc.get("grades_dynamic") or {}
        assert gd.get(col_id) == 18, (
            f"FAIL: expected 18 (raw) in register, got {gd.get(col_id)}"
        )
        print("PASS: task graded 18/18 syncs to register as 18 (no rescale to 20)")
    finally:
        await db.users.delete_one({"id": student_id})
        await db.registro_auxiliar_plantillas.delete_many({"school_id": school_id})
        await db.course_posts.delete_one({"id": task_id})
        await db.student_grades.delete_many({"school_id": school_id})
        client.close()


def test_task_sync_raw_passthrough_e2e():
    asyncio.get_event_loop().run_until_complete(_run_sync())


if __name__ == "__main__":
    test_raw_passthrough_unit()
    asyncio.run(_run_sync())
