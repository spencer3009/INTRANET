# Test: exam attempt audit trail (IP / device / shared-IP alert) shown to teacher.
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://grades-passthrough.preview.emergentagent.com").rstrip("/")
EXAM_ID = "DEMO-RETAKE-EXAM"
SAME_IP = "203.0.113.77"
UA = "Mozilla/5.0 (Linux; Android 13) Chrome/120"


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password, "subdomain": "elroble"},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"]


def _take_exam(token, ip):
    """Start + answer + submit the demo exam from a given IP, return attempt_id."""
    h = {"Authorization": f"Bearer {token}", "X-Forwarded-For": ip, "User-Agent": UA}
    r = requests.post(f"{BASE_URL}/api/exams/{EXAM_ID}/start", headers=h, timeout=20)
    assert r.status_code == 200, f"start failed {r.status_code} {r.text}"
    attempt_id = r.json()["attempt_id"]
    requests.post(
        f"{BASE_URL}/api/exam-attempts/{attempt_id}/save-answer",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"question_id": "DEMO-Q1", "selected_option_id": "o1"},
        timeout=20,
    )
    requests.post(
        f"{BASE_URL}/api/exam-attempts/{attempt_id}/submit",
        headers=h, json={}, timeout=20,
    )
    return attempt_id


def _enable_retake(admin_token, student_id):
    """Teacher/admin re-enables the (closed) demo exam for a student so they can
    take it again — keeps this suite independent from the exam's open/closed state."""
    requests.post(
        f"{BASE_URL}/api/exams/{EXAM_ID}/enable-retake",
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
        json={"student_id": student_id, "hours": 24},
        timeout=20,
    )


@pytest.fixture(scope="module")
def setup_two_attempts():
    """Both demo students take the exam from the SAME IP (via retake override)."""
    admin = _login("admin@elroble.edu", "1234abc8")
    _enable_retake(admin, "DEMO-RETAKE-STUDENT")
    _enable_retake(admin, "DEMO-RETAKE-STUDENT-2")
    t1 = _login("demo.reintento@elroble.edu", "Demo1234!")
    t2 = _login("demo.dos@elroble.edu", "Demo1234!")
    a1 = _take_exam(t1, SAME_IP)
    _take_exam(t2, SAME_IP)
    return {"admin": admin, "attempt_id": a1}


def test_review_returns_audit_block(setup_two_attempts):
    admin = setup_two_attempts["admin"]
    aid = setup_two_attempts["attempt_id"]
    r = requests.get(
        f"{BASE_URL}/api/exams/{EXAM_ID}/attempts/{aid}/review",
        headers={"Authorization": f"Bearer {admin}"}, timeout=20,
    )
    assert r.status_code == 200, r.text
    audit = r.json().get("audit")
    assert audit is not None
    assert audit["ip_address"] == SAME_IP
    assert audit["device"] == "Chrome en Android"
    assert audit["has_audit_data"] is True
    assert audit["origin"] == "online"


def test_shared_ip_alert_lists_other_student(setup_two_attempts):
    admin = setup_two_attempts["admin"]
    aid = setup_two_attempts["attempt_id"]
    r = requests.get(
        f"{BASE_URL}/api/exams/{EXAM_ID}/attempts/{aid}/review",
        headers={"Authorization": f"Bearer {admin}"}, timeout=20,
    )
    audit = r.json()["audit"]
    assert audit["shared_ip"] is True
    names = [s["student_name"] for s in audit["shared_ip_students"]]
    assert any("Demo Dos" in n for n in names), f"other student not flagged: {names}"
