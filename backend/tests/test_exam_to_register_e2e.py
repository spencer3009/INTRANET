"""
End-to-end test: Exam → Auto-grade → sync to Registro Auxiliar
Verifies the full flow described in iteration_204 request:
  1) Admin creates an exam linked to a register_column
  2) Admin adds multiple-choice questions
  3) Admin publishes the exam
  4) Student starts attempt, saves answer, submits → auto-graded
  5) Grade syncs to Registro Auxiliar (static field or grades_dynamic.{col})
  6) GET /api/grades/register/... returns the grade
"""
import os
import time
import json
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://grades-passthrough.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
STUDENT_EMAIL = "mickycalle65@gmail.com"
STUDENT_PASSWORD = "91616119"
SUBJECT_ID_MUSICA = "e04de272-54ec-4af9-868a-bc7604e2b4b4"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    j = r.json()
    token = j.get("access_token") or j.get("token")
    assert token, f"No token in response: {j}"
    return token, j.get("user", {})


@pytest.fixture(scope="module")
def admin_session():
    token, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, user


@pytest.fixture(scope="module")
def student_session():
    token, user = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, user


@pytest.fixture(scope="module")
def context(admin_session, student_session):
    """Resolve subject + section + active period + available column."""
    admin, admin_user = admin_session
    _, student_user = student_session
    ctx = {"admin_user": admin_user, "student_user": student_user, "subject_id": SUBJECT_ID_MUSICA}

    # Known seed values (verified via direct DB inspection).
    # School "El Roble", subject "Música", active period BIMESTRE I.
    ctx["section_id"] = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
    ctx["school_id"] = "b9f27249-6568-49ae-94d3-e1f16750d7d9"
    ctx["period_id"] = "093a0bee-92c4-449c-b82c-942f16847759"  # BIMESTRE I (activo=True)
    ctx["period_name"] = "BIMESTRE I"
    print(f"[CTX] subject_id={ctx['subject_id']} section_id={ctx['section_id']} school_id={ctx['school_id']}")
    print(f"[CTX] period_id={ctx['period_id']} ({ctx['period_name']})")

    # Get availability for register columns to pick a free one
    avail_url = f"{BASE_URL}/api/exams/register-availability"
    r = admin.get(avail_url, params={
        "subject_id": ctx["subject_id"],
        "section_id": ctx["section_id"],
        "period_id": ctx["period_id"],
    }, timeout=30)
    print(f"[CTX] availability status={r.status_code} body={r.text[:500]}")
    chosen_col = None
    if r.status_code == 200:
        avail = r.json()
        cols = avail.get("columns") or avail.get("available") or avail
        if isinstance(cols, list):
            for c in cols:
                if isinstance(c, dict):
                    if c.get("available") or c.get("free") or c.get("disponible"):
                        chosen_col = c.get("id") or c.get("column") or c.get("key")
                        if chosen_col:
                            break
                elif isinstance(c, str):
                    chosen_col = c
                    break
    # Fallback to legacy known-good column 'EM' (exam_mensual) which is static
    if not chosen_col:
        chosen_col = "EM"
    ctx["register_column"] = chosen_col
    print(f"[CTX] register_column={ctx['register_column']}")
    return ctx


def test_01_create_exam_linked_to_register(admin_session, context):
    admin, _ = admin_session
    now = datetime.now(timezone.utc)
    payload = {
        "title": f"TEST_E2E ExamSync {int(time.time())}",
        "description": "E2E test exam linked to register",
        "subject_id": context["subject_id"],
        "section_id": context["section_id"],
        "period_id": context["period_id"],
        "register_column": context["register_column"],
        "duration_minutes": 30,
        "shuffle_questions": False,
        "show_results_immediately": True,
        "start_datetime": (now - timedelta(minutes=5)).isoformat(),
        "end_datetime": (now + timedelta(hours=2)).isoformat(),
        "type": "digital",
        "min_score_percentage": 60.0,
    }
    r = admin.post(f"{BASE_URL}/api/course/{context['subject_id']}/exams", json=payload, timeout=30)
    print(f"[CREATE EXAM] status={r.status_code} body={r.text[:600]}")
    assert r.status_code in (200, 201), f"Create exam failed: {r.status_code} {r.text}"
    data = r.json()
    exam_id = data.get("id") or data.get("exam_id") or (data.get("exam") or {}).get("id")
    assert exam_id, f"No exam id in response: {data}"
    context["exam_id"] = exam_id
    # Validate persistence
    print(f"[CREATE EXAM] exam_id={exam_id} register_column={data.get('register_column')}")


def test_02_add_questions(admin_session, context):
    admin, _ = admin_session
    exam_id = context["exam_id"]
    question_payload = {
        "question_text": "¿Cuánto es 2 + 2?",
        "question_type": "multiple_choice",
        "points": 10,
        "options": [
            {"text": "3", "is_correct": False},
            {"text": "4", "is_correct": True},
            {"text": "5", "is_correct": False},
        ],
    }
    r = admin.post(f"{BASE_URL}/api/exams/{exam_id}/questions", json=question_payload, timeout=30)
    print(f"[ADD Q1] status={r.status_code} body={r.text[:400]}")
    assert r.status_code in (200, 201), f"Add question failed: {r.status_code} {r.text}"
    data = r.json()
    q1_id = data.get("id") or data.get("question_id") or (data.get("question") or {}).get("id")
    assert q1_id, f"No question id: {data}"
    context["q1_id"] = q1_id
    # Capture correct option id from response
    options = data.get("options") or (data.get("question") or {}).get("options") or []
    correct_opt = next((o for o in options if o.get("is_correct")), None)
    assert correct_opt, f"No correct option returned: {options}"
    context["q1_correct_option_id"] = correct_opt.get("id") or correct_opt.get("option_id")
    print(f"[ADD Q1] q1_id={q1_id} correct_option_id={context['q1_correct_option_id']}")


def test_03_publish_exam(admin_session, context):
    admin, _ = admin_session
    exam_id = context["exam_id"]
    r = admin.post(f"{BASE_URL}/api/exams/{exam_id}/publish", json={}, timeout=30)
    print(f"[PUBLISH] status={r.status_code} body={r.text[:400]}")
    assert r.status_code in (200, 201), f"Publish failed: {r.status_code} {r.text}"


def test_04_student_takes_exam(student_session, context):
    student, student_user = student_session
    exam_id = context["exam_id"]

    # Start attempt
    r = student.post(f"{BASE_URL}/api/exams/{exam_id}/start", json={}, timeout=30)
    print(f"[START] status={r.status_code} body={r.text[:600]}")
    assert r.status_code in (200, 201), f"Start attempt failed: {r.status_code} {r.text}"
    data = r.json()
    attempt_id = data.get("attempt_id") or data.get("id") or (data.get("attempt") or {}).get("id")
    assert attempt_id, f"No attempt_id: {data}"
    context["attempt_id"] = attempt_id

    # Get questions (if not in start response) to know the actual question/options
    questions = data.get("questions") or []
    if not questions:
        r2 = student.get(f"{BASE_URL}/api/exam-attempts/{attempt_id}", timeout=30)
        if r2.status_code == 200:
            questions = (r2.json().get("questions")) or []
    print(f"[START] questions count={len(questions)}")

    # Save answer (correct one). Use option_id we captured.
    q1_id = context["q1_id"]
    correct_opt_id = context["q1_correct_option_id"]
    # If start returned different question structure, prefer those
    if questions:
        q = questions[0]
        q1_id = q.get("id") or q.get("question_id") or q1_id
        opts = q.get("options") or []
        correct = next((o for o in opts if o.get("is_correct")), None)
        if correct and (correct.get("id") or correct.get("option_id")):
            correct_opt_id = correct.get("id") or correct.get("option_id")

    save_payload = {
        "question_id": q1_id,
        "selected_option_id": correct_opt_id,
    }
    r = student.post(f"{BASE_URL}/api/exam-attempts/{attempt_id}/save-answer", json=save_payload, timeout=30)
    print(f"[SAVE-ANSWER] status={r.status_code} body={r.text[:400]}")
    assert r.status_code in (200, 201), f"Save answer failed: {r.status_code} {r.text}"

    # Submit
    r = student.post(f"{BASE_URL}/api/exam-attempts/{attempt_id}/submit", json={}, timeout=60)
    print(f"[SUBMIT] status={r.status_code} body={r.text[:800]}")
    assert r.status_code in (200, 201), f"Submit failed: {r.status_code} {r.text}"
    data = r.json()
    # Validate auto-grade present
    pct = data.get("percentage")
    if pct is None:
        pct = data.get("score_percentage") or (data.get("attempt") or {}).get("percentage")
    print(f"[SUBMIT] percentage={pct} correct_count={data.get('correct_count')} score={data.get('score')}")
    context["percentage"] = pct
    assert pct is not None, f"No percentage returned: {data}"
    assert data.get("correct_count") == 1, f"Expected 1 correct, got {data.get('correct_count')}. data={data}"


def test_05_grade_synced_to_register(admin_session, student_session, context):
    admin, _ = admin_session
    _, student_user = student_session
    student_id = student_user.get("id") or student_user.get("user_id")

    # Give a moment for sync (it's awaited in submit, but just in case)
    time.sleep(2)

    url = f"{BASE_URL}/api/grades/register/{context['subject_id']}/{context['section_id']}/{context['period_id']}"
    r = admin.get(url, timeout=30)
    print(f"[REGISTER] status={r.status_code}")
    assert r.status_code == 200, f"GET register failed: {r.status_code} {r.text[:500]}"
    register = r.json()

    # Save a snippet
    with open("/tmp/register_snapshot.json", "w") as f:
        json.dump(register, f, indent=2, default=str)

    # Find this student's row
    grades = register.get("grades") or register.get("students") or register.get("rows") or register
    if isinstance(grades, dict):
        grades = grades.get("items", []) or list(grades.values())

    student_row = None
    if isinstance(grades, list):
        for row in grades:
            sid = row.get("student_id") or (row.get("student") or {}).get("id") or row.get("id")
            if sid == student_id:
                student_row = row
                break
    print(f"[REGISTER] student_id={student_id} row_found={bool(student_row)} keys={list(student_row.keys()) if student_row else None}")
    assert student_row, f"Student {student_id} row not found in register. Got {len(grades) if isinstance(grades, list) else 'n/a'} rows"

    # Check expected field
    col = context["register_column"]
    # Static field mapping (full map from register_sync.py)
    STATIC_MAP = {
        "EM": "exam_mensual", "EB": "exam_bimestral",
        "examen_mensual": "exam_mensual", "examen_bimestral": "exam_bimestral",
        "io": "act_co", "IO": "act_co", "CO": "act_co",
        "re": "act_re", "RE": "act_re",
        "t1": "rf_r1", "T1": "rf_r1", "t2": "rf_r2", "T2": "rf_r2",
        "t3": "rf_r3", "T3": "rf_r3", "t4": "rf_r4", "T4": "rf_r4",
        "t5": "rf_r5", "T5": "rf_r5",
        "c1": "comp_c1", "C1": "comp_c1", "c2": "comp_c2", "C2": "comp_c2",
        "p1": "part_p1", "P1": "part_p1", "p2": "part_p2", "P2": "part_p2",
        "p3": "part_p3", "P3": "part_p3",
    }
    expected_static = STATIC_MAP.get(col) or col  # if col is already a static field

    static_val = student_row.get(expected_static)
    dyn_val = (student_row.get("grades_dynamic") or {}).get(col)
    print(f"[REGISTER] expected_static_field={expected_static} static_val={static_val} dyn_val={dyn_val}")

    found_val = static_val if static_val is not None else dyn_val
    assert found_val is not None, (
        f"Grade NOT synced. register_column={col} expected_field={expected_static} "
        f"static_val={static_val} dyn_val={dyn_val} row={student_row}"
    )
    # Should be a vigesimal value (0-20). For correct answer expect 20.
    print(f"[REGISTER] SYNCED VALUE = {found_val} (vigesimal)")
    context["synced_grade"] = found_val
    assert isinstance(found_val, (int, float)) and 0 <= float(found_val) <= 20
