"""
Unified Register Sync Service.
Handles ALL sync between exams/tasks and the Registro Auxiliar (student_grades).
Central, IDEMPOTENT function — safe to call multiple times.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Maps register_column value to the student_grades field name
COLUMN_FIELD_MAP = {
    "EM": "exam_mensual",
    "EB": "exam_bimestral",
    "P1": "part_p1",
    "P2": "part_p2",
    "P3": "part_p3",
}

VALID_COLUMNS = set(COLUMN_FIELD_MAP.keys())
# Legacy hard-coded set — kept for backward-compatibility fallback only.
# Task columns are now resolved dynamically from the school's active
# Registro Auxiliar template (see `get_valid_task_columns_for_school`).
TASK_VALID_COLUMNS = {"P1", "P2", "P3"}


async def get_valid_task_columns_for_school(db, school_id: str) -> set:
    """
    Return the set of register columns a TASK may be linked to, resolved
    dynamically from the school's Registro Auxiliar templates.

    Rule of thumb (mirrors the frontend modal `taskSubcolumnasVinculables`):
      - Every subcolumna of every criterio that has `tipo == "input"` is
        valid for tasks.
      - `columnas_finales` are reserved for EXAMS (EM, EB and similar) and
        are excluded from tasks.

    Resolution order (tolerant):
      1. The school's ACTIVE template (estado == "activa")
      2. Any other template belonging to the school (estado != deleted)
      3. The SYSTEM template (es_sistema: True)
      4. Legacy hard-coded {P1, P2, P3}

    We union (1)+(2)+(3) so older schools whose template was seeded but
    not explicitly marked "activa" keep working. Normalized keys are also
    stored in both lower-case and upper-case to tolerate casing drift.
    """
    def _extract(plantilla) -> set:
        out = set()
        for cri in (plantilla or {}).get("criterios", []) or []:
            for sub in cri.get("subcolumnas", []) or []:
                if sub.get("tipo") != "input":
                    continue
                key = sub.get("field_key") or sub.get("id")
                if key:
                    out.add(key)
                    out.add(str(key).upper())
                    out.add(str(key).lower())
                # Also accept the visible label (frontend occasionally sends
                # `label` instead of `id` as register_column — e.g. "R2", "CO").
                label = sub.get("label")
                if label:
                    out.add(label)
                    out.add(str(label).upper())
                    out.add(str(label).lower())
        return out

    try:
        cols: set = set()
        # 1. Any template that belongs to this school (regardless of state)
        async for p in db.registro_auxiliar_plantillas.find(
            {"school_id": school_id},
            {"_id": 0, "criterios": 1, "estado": 1},
        ):
            if p.get("estado") == "eliminada":
                continue
            cols |= _extract(p)

        # 2. System template (always accepted as safety net)
        system = await db.registro_auxiliar_plantillas.find_one(
            {"es_sistema": True}, {"_id": 0, "criterios": 1}
        )
        if system:
            cols |= _extract(system)

        # 3. Legacy slots — so a freshly-created school with no templates
        #    at all still accepts the historic P1/P2/P3.
        cols |= set(TASK_VALID_COLUMNS)

        return cols
    except Exception as e:
        logger.warning(f"[register] dynamic task-columns lookup failed for {school_id}: {e}")
        return set(TASK_VALID_COLUMNS)


def exam_score_to_vigesimal(percentage: float) -> int:
    """Convert exam percentage (0-100) to vigesimal scale (0-20), integer."""
    if percentage is None:
        return 0
    return round(percentage * 20 / 100)


def task_score_to_vigesimal(score: float, max_points: float) -> int:
    """Convert task score to vigesimal scale (0-20), integer."""
    if score is None or max_points is None or max_points <= 0:
        return 0
    return round(score * 20 / max_points)


async def sync_to_register(db, source_id: str, source_type: str, action: str):
    """
    Central sync function for both exams and tasks.
    
    Args:
        db: Motor database instance
        source_id: The exam or task document ID
        source_type: "exam" | "task"
        action: "create" | "update" | "delete" | "regrade" | "retry" | "close_exam"
    """
    if source_type == "exam":
        source = await db.online_exams.find_one({"id": source_id}, {"_id": 0})
        collection = db.online_exams
    elif source_type == "task":
        source = await db.course_posts.find_one({"id": source_id}, {"_id": 0})
        collection = db.course_posts
    else:
        logger.error(f"[SYNC] Invalid source_type: {source_type}")
        return

    if not source:
        logger.warning(f"[SYNC] {source_type} {source_id} not found")
        return

    register_column = source.get("register_column")

    if not register_column:
        await collection.update_one(
            {"id": source_id},
            {"$set": {"sync_status": "not_linked"}}
        )
        return

    grade_field = COLUMN_FIELD_MAP.get(register_column)
    if not grade_field:
        logger.error(f"[SYNC] Invalid register_column '{register_column}' for {source_type} {source_id}")
        return

    period_id = source.get("period_id")
    subject_id = source.get("subject_id")
    section_id = source.get("section_id")
    school_id = source.get("school_id")

    if not all([period_id, subject_id, school_id]):
        logger.error(f"[SYNC] {source_type} {source_id} missing required fields for sync")
        return

    # Check if the register is locked
    lock_query = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
    }
    if section_id:
        lock_query["section_id"] = section_id

    lock = await db.grade_locks.find_one(lock_query, {"_id": 0})

    if lock and lock.get("locked") and action != "retry":
        await collection.update_one(
            {"id": source_id},
            {"$set": {"sync_status": "pending"}}
        )
        logger.info(f"[SYNC] Register locked for {source_type} {source_id}, marking pending")
        return

    grade_filter_base = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
    }
    if section_id:
        grade_filter_base["section_id"] = section_id

    if source_type == "exam":
        await _sync_exam_grades(db, source, source_id, grade_field, grade_filter_base, action)
    elif source_type == "task":
        await _sync_task_grades(db, source, source_id, grade_field, grade_filter_base, action)

    new_status = "synced" if action != "delete" else "not_linked"
    await collection.update_one(
        {"id": source_id},
        {"$set": {"sync_status": new_status}}
    )

    logger.info(
        f"[SYNC] {source_type} {source_id} action={action} "
        f"(column={register_column} -> field={grade_field})"
    )


async def _sync_exam_grades(db, exam, exam_id, grade_field, grade_filter_base, action):
    """Sync exam grades to student_grades."""
    attempts = await db.exam_attempts.find(
        {"exam_id": exam_id, "status": "completed"},
        {"_id": 0, "student_id": 1, "percentage": 1}
    ).to_list(500)

    for attempt in attempts:
        student_id = attempt["student_id"]
        if action == "delete":
            update_fields = {grade_field: None}
        else:
            update_fields = {grade_field: exam_score_to_vigesimal(attempt.get("percentage", 0))}

        await db.student_grades.update_one(
            {**grade_filter_base, "student_id": student_id},
            {"$set": update_fields},
            upsert=True,
        )


async def _sync_task_grades(db, task, task_id, grade_field, grade_filter_base, action):
    """Sync task grades to student_grades."""
    max_points = task.get("max_grade") or task.get("metadata", {}).get("points") or 100
    if max_points <= 0:
        max_points = 100

    submissions = task.get("submissions", [])
    
    # Re-fetch task to get latest submissions (especially after cron adds auto-zero)
    fresh_task = await db.course_posts.find_one({"id": task_id}, {"_id": 0, "submissions": 1})
    if fresh_task and fresh_task.get("submissions"):
        submissions = fresh_task["submissions"]

    for sub in submissions:
        student_id = sub.get("student_id")
        grade = sub.get("grade")
        if not student_id:
            continue

        if action == "delete":
            update_fields = {grade_field: None}
        elif grade is not None:
            update_fields = {grade_field: task_score_to_vigesimal(grade, max_points)}
        else:
            continue  # No grade yet, skip

        await db.student_grades.update_one(
            {**grade_filter_base, "student_id": student_id},
            {"$set": update_fields},
            upsert=True,
        )


async def sync_single_student_exam(db, exam_id: str, student_id: str, percentage: float):
    """
    Sync a single student's exam grade after submission.
    Called from submit_exam_attempt for immediate feedback.
    """
    exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0})
    if not exam or not exam.get("register_column"):
        return

    grade_field = COLUMN_FIELD_MAP.get(exam["register_column"])
    if not grade_field:
        return

    period_id = exam.get("period_id")
    subject_id = exam.get("subject_id")
    section_id = exam.get("section_id")
    school_id = exam.get("school_id")

    if not all([period_id, subject_id, school_id]):
        return

    # Check lock
    lock_query = {"school_id": school_id, "subject_id": subject_id, "period_id": period_id}
    if section_id:
        lock_query["section_id"] = section_id
    lock = await db.grade_locks.find_one(lock_query, {"_id": 0})

    if lock and lock.get("locked"):
        await db.online_exams.update_one(
            {"id": exam_id},
            {"$set": {"sync_status": "pending"}}
        )
        return

    grade_value = exam_score_to_vigesimal(percentage)
    grade_filter = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
        "student_id": student_id,
    }
    if section_id:
        grade_filter["section_id"] = section_id

    await db.student_grades.update_one(
        grade_filter,
        {"$set": {grade_field: grade_value}},
        upsert=True,
    )
    logger.info(f"[SYNC] Student {student_id} exam grade synced: {grade_field}={grade_value}")


async def sync_single_student_task(db, task_id: str, student_id: str, grade: float):
    """
    Sync a single student's task grade after grading.
    Called from grade_task_submission for immediate feedback.
    """
    task = await db.course_posts.find_one({"id": task_id}, {"_id": 0})
    if not task or not task.get("register_column"):
        return

    grade_field = COLUMN_FIELD_MAP.get(task["register_column"])
    if not grade_field:
        return

    period_id = task.get("period_id")
    subject_id = task.get("subject_id")
    section_id = task.get("section_id")
    school_id = task.get("school_id")

    if not all([period_id, subject_id, school_id]):
        return

    max_points = task.get("max_grade") or task.get("metadata", {}).get("points") or 100
    if max_points <= 0:
        max_points = 100

    # Check lock
    lock_query = {"school_id": school_id, "subject_id": subject_id, "period_id": period_id}
    if section_id:
        lock_query["section_id"] = section_id
    lock = await db.grade_locks.find_one(lock_query, {"_id": 0})

    if lock and lock.get("locked"):
        await db.course_posts.update_one(
            {"id": task_id},
            {"$set": {"sync_status": "pending"}}
        )
        return

    grade_value = task_score_to_vigesimal(grade, max_points)
    grade_filter = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
        "student_id": student_id,
    }
    if section_id:
        grade_filter["section_id"] = section_id

    await db.student_grades.update_one(
        grade_filter,
        {"$set": {grade_field: grade_value}},
        upsert=True,
    )
    logger.info(f"[SYNC] Student {student_id} task grade synced: {grade_field}={grade_value}")


async def retry_pending_syncs(db, school_id: str, subject_id: str, section_id: str, period_id: str):
    """
    Retry all pending syncs when a register is reopened.
    Handles both exams and tasks.
    """
    # Retry pending exams
    pending_exams = await db.online_exams.find(
        {
            "school_id": school_id,
            "subject_id": subject_id,
            "section_id": section_id,
            "period_id": period_id,
            "sync_status": "pending",
        },
        {"_id": 0, "id": 1}
    ).to_list(50)

    for exam in pending_exams:
        await sync_to_register(db, exam["id"], "exam", "retry")

    # Retry pending tasks
    pending_tasks = await db.course_posts.find(
        {
            "school_id": school_id,
            "subject_id": subject_id,
            "section_id": section_id,
            "period_id": period_id,
            "sync_status": "pending",
            "$or": [{"post_type": "task"}, {"type": "task"}],
        },
        {"_id": 0, "id": 1}
    ).to_list(50)

    for task in pending_tasks:
        await sync_to_register(db, task["id"], "task", "retry")

    total = len(pending_exams) + len(pending_tasks)
    if total:
        logger.info(f"[SYNC] Retried {total} pending syncs ({len(pending_exams)} exams, {len(pending_tasks)} tasks) for period {period_id}")


# Backward-compatible aliases
async def sync_exam_to_register(db, exam_id: str, action: str):
    """Backward-compatible wrapper."""
    await sync_to_register(db, exam_id, "exam", action)


async def sync_single_student(db, exam_id: str, student_id: str, percentage: float):
    """Backward-compatible wrapper."""
    await sync_single_student_exam(db, exam_id, student_id, percentage)
