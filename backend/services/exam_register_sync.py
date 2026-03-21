"""
Exam ↔ Registro Auxiliar synchronization service.
Central function that handles ALL sync between exams and the gradebook.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# Grade fields that can be linked from exams
REGISTER_TYPE_MAP = {
    "EM": "exam_mensual",
    "EB": "exam_bimestral",
}

PARTICIPATION_MAP = {
    "P1": "part_p1",
    "P2": "part_p2",
    "P3": "part_p3",
}


def score_to_vigesimal(percentage: float) -> int:
    """Convert exam percentage (0-100) to vigesimal scale (0-20), integer."""
    if percentage is None:
        return 0
    return round(percentage * 20 / 100)


async def sync_exam_to_register(db, exam_id: str, action: str):
    """
    Central sync function. IDEMPOTENT — safe to call multiple times.

    Args:
        db: Motor database instance
        exam_id: The exam document ID
        action: "create" | "update" | "delete" | "regrade" | "retry"
    """
    exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0})
    if not exam:
        logger.warning(f"[SYNC] Exam {exam_id} not found")
        return

    register_type = exam.get("register_type")
    register_participation = exam.get("register_participation")

    # If no linkage, mark and exit
    if not register_type and not register_participation:
        await db.online_exams.update_one(
            {"id": exam_id},
            {"$set": {"sync_status": "not_linked"}}
        )
        return

    period_id = exam.get("period_id")
    subject_id = exam.get("subject_id")
    section_id = exam.get("section_id")
    school_id = exam.get("school_id")

    if not all([period_id, subject_id, school_id]):
        logger.error(f"[SYNC] Exam {exam_id} missing required fields for sync")
        return

    # Check if the register is locked
    lock = await db.grade_locks.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": section_id,
        "period_id": period_id,
    }, {"_id": 0})

    if lock and lock.get("locked") and action != "retry":
        await db.online_exams.update_one(
            {"id": exam_id},
            {"$set": {"sync_status": "pending"}}
        )
        logger.info(f"[SYNC] Register locked for exam {exam_id}, marking pending")
        return

    # Get all completed attempts for this exam
    attempts = await db.exam_attempts.find(
        {"exam_id": exam_id, "status": "completed"},
        {"_id": 0, "student_id": 1, "percentage": 1}
    ).to_list(500)

    # Build the field names to update
    type_field = REGISTER_TYPE_MAP.get(register_type) if register_type else None
    part_field = PARTICIPATION_MAP.get(register_participation) if register_participation else None

    for attempt in attempts:
        student_id = attempt["student_id"]
        grade_value = score_to_vigesimal(attempt.get("percentage", 0))

        update_fields = {}
        if action == "delete":
            if type_field:
                update_fields[type_field] = None
            if part_field:
                update_fields[part_field] = None
        else:
            if type_field:
                update_fields[type_field] = grade_value
            if part_field:
                update_fields[part_field] = grade_value

        if update_fields:
            await db.student_grades.update_one(
                {
                    "school_id": school_id,
                    "subject_id": subject_id,
                    "section_id": section_id,
                    "period_id": period_id,
                    "student_id": student_id,
                },
                {"$set": update_fields},
                upsert=True,
            )

    new_status = "synced" if action != "delete" else "not_linked"
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"sync_status": new_status}}
    )

    logger.info(
        f"[SYNC] Exam {exam_id} action={action} synced {len(attempts)} students "
        f"(type={register_type}, part={register_participation})"
    )


async def sync_single_student(db, exam_id: str, student_id: str, percentage: float):
    """
    Sync a single student's grade after exam submission.
    Called from submit_exam_attempt for immediate feedback.
    """
    exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0})
    if not exam:
        return

    register_type = exam.get("register_type")
    register_participation = exam.get("register_participation")

    if not register_type and not register_participation:
        return

    period_id = exam.get("period_id")
    subject_id = exam.get("subject_id")
    section_id = exam.get("section_id")
    school_id = exam.get("school_id")

    if not all([period_id, subject_id, school_id]):
        return

    # Check lock
    lock = await db.grade_locks.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": section_id,
        "period_id": period_id,
    }, {"_id": 0})

    if lock and lock.get("locked"):
        await db.online_exams.update_one(
            {"id": exam_id},
            {"$set": {"sync_status": "pending"}}
        )
        return

    grade_value = score_to_vigesimal(percentage)
    update_fields = {}

    type_field = REGISTER_TYPE_MAP.get(register_type) if register_type else None
    part_field = PARTICIPATION_MAP.get(register_participation) if register_participation else None

    if type_field:
        update_fields[type_field] = grade_value
    if part_field:
        update_fields[part_field] = grade_value

    if update_fields:
        await db.student_grades.update_one(
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "section_id": section_id,
                "period_id": period_id,
                "student_id": student_id,
            },
            {"$set": update_fields},
            upsert=True,
        )
        logger.info(f"[SYNC] Student {student_id} grade synced for exam {exam_id}: {update_fields}")


async def retry_pending_syncs(db, school_id: str, subject_id: str, section_id: str, period_id: str):
    """
    Retry all pending syncs when a register is reopened.
    Called from unlock_period endpoint.
    """
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
        await sync_exam_to_register(db, exam["id"], "retry")

    if pending_exams:
        logger.info(f"[SYNC] Retried {len(pending_exams)} pending syncs for period {period_id}")
