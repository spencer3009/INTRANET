"""
Tests for the exam answer-review split (Jun 2026):

Task 1 (teacher): GET /api/exams/{exam_id}/attempts/{attempt_id}/review
  - teacher/admin only; returns FULL per-question review WITH correct answers.

Task 2 (anti-cheat, student): GET /api/exam-attempts/{attempt_id}/result
  - must NOT leak question text, options, correct_option_id, correct_answer
    nor student_answer — only id/number/is_correct/points per question.

Single asyncio.run (one event loop) because the route handlers use the
module-level motor client (exams.db), which caches its loop on first use.
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import routes.exams as exams  # noqa: E402

db = exams.db


def _now():
    return datetime.now(timezone.utc).isoformat()


def _cu(uid):
    return {"sub": uid}


async def _seed():
    school_id = str(uuid.uuid4())
    s = dict(
        school_id=school_id,
        exam_id=str(uuid.uuid4()),
        student_id=str(uuid.uuid4()),
        teacher_id=str(uuid.uuid4()),
        attempt_id=str(uuid.uuid4()),
        q1=str(uuid.uuid4()), q2=str(uuid.uuid4()),
        opt_a=str(uuid.uuid4()), opt_b=str(uuid.uuid4()),
    )
    await db.online_exams.insert_one({
        "id": s["exam_id"], "school_id": school_id, "title": "EXAMEN PRUEBA ANTICHEAT",
        "total_points": 2, "min_score_percentage": 60, "subject_id": str(uuid.uuid4()),
    })
    await db.exam_questions.insert_many([
        {"id": s["q1"], "exam_id": s["exam_id"], "order": 0, "points": 1,
         "question_type": "multiple_choice", "question_text": "¿2+2?",
         "options": [{"id": s["opt_a"], "text": "4", "is_correct": True},
                     {"id": s["opt_b"], "text": "5", "is_correct": False}]},
        {"id": s["q2"], "exam_id": s["exam_id"], "order": 1, "points": 1,
         "question_type": "true_false", "question_text": "El sol es una estrella",
         "correct_answer": "true"},
    ])
    await db.exam_attempts.insert_one({
        "id": s["attempt_id"], "exam_id": s["exam_id"], "school_id": school_id,
        "student_id": s["student_id"], "student_name": "Alumno Prueba",
        "status": "completed", "start_time": _now(), "end_time": _now(),
        "score": 1, "max_score": 2, "percentage": 50.0, "passed": False,
        "correct_count": 1, "incorrect_count": 1, "unanswered_count": 0,
        "graded_answers": {
            s["q1"]: {"selected_option_id": s["opt_a"], "is_correct": True, "points_earned": 1, "points_possible": 1},
            s["q2"]: {"selected_option_id": "false", "is_correct": False, "points_earned": 0, "points_possible": 1},
        },
    })
    await db.users.insert_many([
        {"id": s["teacher_id"], "school_id": school_id, "role": "teacher",
         "email": f"t_{s['teacher_id']}@x.edu", "name": "Profe", "status": "activo"},
        {"id": s["student_id"], "school_id": school_id, "role": "student",
         "email": f"s_{s['student_id']}@x.edu", "name": "Alumno", "status": "activo"},
    ])
    return s


async def _cleanup(s):
    await db.online_exams.delete_one({"id": s["exam_id"]})
    await db.exam_questions.delete_many({"exam_id": s["exam_id"]})
    await db.exam_attempts.delete_one({"id": s["attempt_id"]})
    await db.users.delete_many({"id": {"$in": [s["teacher_id"], s["student_id"]]}})


async def _run_all():
    s = await _seed()
    try:
        # --- Task 1: teacher review exposes correct answers ---
        res = await exams.get_exam_attempt_review(
            s["exam_id"], s["attempt_id"], current_user=_cu(s["teacher_id"]))
        assert res["student_name"] == "Alumno Prueba"
        assert res["grade_vigesimal"] == 10
        q1 = res["questions"][0]
        assert q1["question_text"] == "¿2+2?"
        assert q1["correct_option_id"] == s["opt_a"]
        assert q1["student_answer"] == s["opt_a"]
        assert q1["is_correct"] is True
        q2 = res["questions"][1]
        assert q2["correct_answer"] == "true"
        assert q2["student_answer"] == "false"
        assert q2["is_correct"] is False

        # --- Task 1 authz: students blocked from teacher review ---
        raised = False
        try:
            await exams.get_exam_attempt_review(
                s["exam_id"], s["attempt_id"], current_user=_cu(s["student_id"]))
        except HTTPException as e:
            raised = (e.status_code == 403)
        assert raised, "Student must NOT be able to call the teacher review endpoint"

        # --- Task 2: student result hides correct answers ---
        sres = await exams.get_exam_result(
            s["attempt_id"], current_user=_cu(s["student_id"]))
        assert sres["score"] == 1
        assert sres["correct_count"] == 1
        assert sres["incorrect_count"] == 1
        for q in sres["questions"]:
            assert set(q.keys()) == {"id", "number", "is_correct", "points_earned", "points_possible"}
            for forbidden in ("question_text", "options", "correct_option_id", "correct_answer", "student_answer"):
                assert forbidden not in q
    finally:
        await _cleanup(s)


def test_exam_review_anticheat():
    asyncio.run(_run_all())
