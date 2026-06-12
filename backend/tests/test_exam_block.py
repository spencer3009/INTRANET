# Test: teacher blocks an exam for a student (inasistencia) -> grade annulled,
# student cannot take it and sees it blocked; unblock removes the block.
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://grades-passthrough.preview.emergentagent.com").rstrip("/")
EXAM_ID = "DEMO-RETAKE-EXAM"
SUBJECT_ID = "e04de272-54ec-4af9-868a-bc7604e2b4b4"
STUDENT_ID = "DEMO-RETAKE-STUDENT"


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password, "subdomain": "elroble"},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def ctx():
    admin = _login("admin@elroble.edu", "1234abc8")
    student = _login("demo.reintento@elroble.edu", "Demo1234!")
    # student takes the exam first (via retake override) so there is a grade to annul
    ah = {"Authorization": f"Bearer {admin}", "Content-Type": "application/json"}
    requests.post(f"{BASE_URL}/api/exams/{EXAM_ID}/enable-retake", headers=ah,
                  json={"student_id": STUDENT_ID, "hours": 24}, timeout=20)
    sh = {"Authorization": f"Bearer {student}"}
    aid = requests.post(f"{BASE_URL}/api/exams/{EXAM_ID}/start", headers=sh, timeout=20).json()["attempt_id"]
    requests.post(f"{BASE_URL}/api/exam-attempts/{aid}/save-answer",
                  headers={**sh, "Content-Type": "application/json"},
                  json={"question_id": "DEMO-Q1", "selected_option_id": "o1"}, timeout=20)
    requests.post(f"{BASE_URL}/api/exam-attempts/{aid}/submit",
                  headers={**sh, "Content-Type": "application/json"}, json={}, timeout=20)
    yield {"admin": admin, "student": student}
    # cleanup: make sure the student is not left blocked
    requests.post(f"{BASE_URL}/api/exams/{EXAM_ID}/unblock-student", headers=ah,
                  json={"student_id": STUDENT_ID}, timeout=20)


def test_block_annuls_and_prevents_start(ctx):
    admin, student = ctx["admin"], ctx["student"]
    # Block
    r = requests.post(
        f"{BASE_URL}/api/exams/{EXAM_ID}/block-student",
        headers={"Authorization": f"Bearer {admin}", "Content-Type": "application/json"},
        json={"student_id": STUDENT_ID}, timeout=20,
    )
    assert r.status_code == 200, r.text
    assert r.json()["reason"] == "Bloqueado por inasistencia"

    # Student can no longer start
    s = requests.post(f"{BASE_URL}/api/exams/{EXAM_ID}/start",
                      headers={"Authorization": f"Bearer {student}"}, timeout=20)
    assert s.status_code == 403, f"expected 403 got {s.status_code} {s.text}"
    assert "inasistencia" in s.text.lower()


def test_student_list_shows_blocked(ctx):
    student = ctx["student"]
    r = requests.get(
        f"{BASE_URL}/api/course/{SUBJECT_ID}/exams",
        headers={"Authorization": f"Bearer {student}"}, timeout=20,
    )
    exam = next((e for e in r.json() if e.get("id") == EXAM_ID), None)
    assert exam is not None, "blocked exam should still appear in the list"
    assert exam.get("is_blocked") is True
    assert exam.get("block_reason") == "Bloqueado por inasistencia"
    assert exam.get("is_available") is False


def test_eligible_students_marks_blocked(ctx):
    admin = ctx["admin"]
    r = requests.get(
        f"{BASE_URL}/api/exams/{EXAM_ID}/eligible-students",
        headers={"Authorization": f"Bearer {admin}"}, timeout=20,
    )
    row = next((s for s in r.json() if s["id"] == STUDENT_ID), None)
    assert row is not None
    assert row["blocked"] is True


def test_unblock_removes_block(ctx):
    admin, student = ctx["admin"], ctx["student"]
    r = requests.post(
        f"{BASE_URL}/api/exams/{EXAM_ID}/unblock-student",
        headers={"Authorization": f"Bearer {admin}", "Content-Type": "application/json"},
        json={"student_id": STUDENT_ID}, timeout=20,
    )
    assert r.status_code == 200, r.text
    rr = requests.get(
        f"{BASE_URL}/api/exams/{EXAM_ID}/eligible-students",
        headers={"Authorization": f"Bearer {admin}"}, timeout=20,
    )
    row = next((s for s in rr.json() if s["id"] == STUDENT_ID), None)
    assert row is not None and row["blocked"] is False
