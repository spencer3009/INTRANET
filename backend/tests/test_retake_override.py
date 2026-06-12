# Test: student retake override flow (re-enabled exam after closed)
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://grades-passthrough.preview.emergentagent.com").rstrip("/")
EXAM_ID = "DEMO-RETAKE-EXAM"
SUBJECT_ID = "e04de272-54ec-4af9-868a-bc7604e2b4b4"


@pytest.fixture(scope="module")
def student_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "demo.reintento@elroble.edu", "password": "Demo1234!", "subdomain": "elroble"},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"]


def test_course_exams_lists_retake_enabled_closed_exam(student_token):
    r = requests.get(
        f"{BASE_URL}/api/course/{SUBJECT_ID}/exams",
        headers={"Authorization": f"Bearer {student_token}"},
        timeout=20,
    )
    assert r.status_code == 200
    exams = r.json()
    target = next((e for e in exams if e.get("id") == EXAM_ID), None)
    assert target is not None, f"DEMO-RETAKE-EXAM not in list {exams}"
    assert target.get("status") == "closed"
    assert target.get("retake_enabled") is True
    assert target.get("is_available") is True


def test_start_exam_with_override_returns_200(student_token):
    r = requests.post(
        f"{BASE_URL}/api/exams/{EXAM_ID}/start",
        headers={"Authorization": f"Bearer {student_token}", "Content-Type": "application/json"},
        timeout=20,
    )
    # The override should bypass the closed/end-date check
    assert r.status_code == 200, f"Expected 200 got {r.status_code} body={r.text}"
    data = r.json()
    assert "attempt_id" in data or "id" in data or "exam_id" in data
