"""
P1 Guard: verify that students with non-active status get 403 across services.
- enrollment_status == "rejected"    -> 403
- student_status == "pending" without override -> 403
- status back to active -> 200
"""
import os
import pytest
import requests
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
STUDENT_EMAIL = "mickycalle65@gmail.com"
STUDENT_PASSWORD = "Student123!"

PROTECTED_ENDPOINTS = [
    "/api/student/dashboard",
    "/api/student/profile",
    "/api/student/courses",
]


@pytest.fixture(scope="module")
def db():
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return cli[os.environ["DB_NAME"]]


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _set_status(db, enrollment_status=None, student_status=None):
    updates = {}
    if enrollment_status is not None:
        updates["enrollment_status"] = enrollment_status
    if student_status is not None:
        updates["student_status"] = student_status
    _run(db.users.update_one({"email": STUDENT_EMAIL}, {"$set": updates}))


def _login():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": STUDENT_EMAIL, "password": STUDENT_PASSWORD})
    return r


@pytest.fixture(scope="module")
def active_token(db):
    _set_status(db, enrollment_status="active", student_status="active")
    r = _login()
    assert r.status_code == 200, r.text
    yield r.json()["token"]
    # cleanup
    _set_status(db, enrollment_status="active", student_status="active")


def test_active_student_can_access(active_token):
    headers = {"Authorization": f"Bearer {active_token}"}
    for ep in PROTECTED_ENDPOINTS:
        r = requests.get(f"{BASE_URL}{ep}", headers=headers)
        assert r.status_code == 200, f"{ep} -> {r.status_code}: {r.text[:200]}"


def test_rejected_enrollment_blocks_services(db, active_token):
    _set_status(db, enrollment_status="rejected")
    try:
        headers = {"Authorization": f"Bearer {active_token}"}
        for ep in PROTECTED_ENDPOINTS:
            r = requests.get(f"{BASE_URL}{ep}", headers=headers)
            assert r.status_code == 403, f"{ep} expected 403, got {r.status_code}"
            assert "rechaz" in r.json().get("detail", "").lower()
    finally:
        _set_status(db, enrollment_status="active")


def test_pending_without_override_blocks_services(db, active_token):
    _set_status(db, enrollment_status="pending", student_status="pending")
    try:
        headers = {"Authorization": f"Bearer {active_token}"}
        r = requests.get(f"{BASE_URL}/api/student/dashboard", headers=headers)
        assert r.status_code == 403
        assert "pendiente" in r.json().get("detail", "").lower()
    finally:
        _set_status(db, enrollment_status="active", student_status="active")


def test_rejected_blocks_login(db):
    _set_status(db, enrollment_status="rejected")
    try:
        r = _login()
        assert r.status_code == 403, r.text
    finally:
        _set_status(db, enrollment_status="active")
