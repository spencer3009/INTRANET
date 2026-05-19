"""
Test Submission Download Authorization
======================================
Regression test for the bug where teachers (role='teacher') got 403 when
downloading student submission attachments. Verifies that all staff roles
of the same school can download, in addition to admins and the submission
owner. Non-owner students remain forbidden.

Talks to the running backend (uses REACT_APP_BACKEND_URL) and seeds extra
users directly in MongoDB to bypass the admin-create endpoint.
"""

import asyncio
import io
import os
import uuid
import pytest
import requests
import bcrypt
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


async def _seed_users(school_id: str, section_id: str, uid: str):
    """Create teacher + 2 students directly in MongoDB."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    pw_hash = _hash("test123456")
    now = datetime.now(timezone.utc).isoformat()
    users = {}
    for role, suffix in [("teacher", "t1"), ("student", "s1"), ("student", "s2")]:
        u = {
            "id": str(uuid.uuid4()),
            "email": f"dlauth_{role}_{uid}_{suffix}@test.local",
            "password": pw_hash,
            "name": f"DLAUTH_{role}_{suffix}",
            "last_name": "Test",
            "role": role,
            "school_id": school_id,
            "created_at": now,
        }
        if role == "student":
            u["seccion_id"] = section_id
            u["student_status"] = "active"
        await db.users.insert_one(u)
        u.pop("_id", None)
        users[f"{role}_{suffix}"] = u
    client.close()
    return users


@pytest.fixture(scope="module")
def ctx():
    assert BASE_URL, "REACT_APP_BACKEND_URL not set"
    data = {}
    uid = str(uuid.uuid4())[:8]

    # Login admin (owner of El Roble)
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@elroble.edu", "password": "1234abc8"})
    assert r.status_code == 200, r.text
    data["admin_token"] = r.json()["token"]
    headers = {"Authorization": f"Bearer {data['admin_token']}"}

    me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers).json()
    data["school_id"] = me["school_id"]

    # Pick the known Música subject + 3 años A section used in previous tests.
    data["subject_id"] = "e04de272-54ec-4af9-868a-bc7604e2b4b4"
    data["section_id"] = "11f50cbc-f5f6-422a-a989-87b2af6027f1"

    # Seed users directly in DB
    users = asyncio.run(_seed_users(data["school_id"], data["section_id"], uid))
    data["users"] = users

    def login(u):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": u["email"], "password": "test123456"})
        assert r.status_code == 200, f"login failed: {r.text}"
        return r.json()["token"]

    data["teacher_token"] = login(users["teacher_t1"])
    data["student_owner_token"] = login(users["student_s1"])
    data["student_other_token"] = login(users["student_s2"])

    # Create a task as admin
    task_payload = {
        "title": f"DLAUTH Task {uid}",
        "content": "Auth regression task",
        "post_type": "task",
        "delivery_type": "Archivos",
        "subject_id": data["subject_id"],
        "section_id": data["section_id"],
        "metadata": {"max_score": 20, "allow_late_submissions": True},
    }
    r = requests.post(f"{BASE_URL}/api/course/{data['subject_id']}/posts",
                      json=task_payload, headers=headers)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    data["task_id"] = body.get("post", {}).get("id") or body.get("id")

    # Student owner submits a file
    files = [("files", ("hello.txt", io.BytesIO(b"hello world"), "text/plain"))]
    r = requests.post(f"{BASE_URL}/api/course/tasks/{data['task_id']}/submit",
                      files=files,
                      headers={"Authorization": f"Bearer {data['student_owner_token']}"})
    assert r.status_code == 200, r.text
    data["submission_id"] = r.json()["submission_id"]

    # Fetch attachment_id
    r = requests.get(f"{BASE_URL}/api/course/tasks/{data['task_id']}/submissions",
                     headers=headers)
    assert r.status_code == 200, r.text
    subs = r.json()["submissions"]
    sub = next(s for s in subs if s["id"] == data["submission_id"])
    assert sub["attachments"], "no attachments"
    data["attachment_id"] = sub["attachments"][0]["id"]
    return data


def _download(ctx, token):
    return requests.get(
        f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submissions/{ctx['submission_id']}/download",
        params={"attachment_id": ctx["attachment_id"]},
        headers={"Authorization": f"Bearer {token}"},
        allow_redirects=False,
    )


def test_admin_can_download(ctx):
    r = _download(ctx, ctx["admin_token"])
    assert r.status_code in (200, 302, 307), f"admin should be allowed: {r.status_code} {r.text[:200]}"


def test_owner_student_can_download(ctx):
    r = _download(ctx, ctx["student_owner_token"])
    assert r.status_code in (200, 302, 307), f"owner student should be allowed: {r.status_code} {r.text[:200]}"


def test_teacher_can_download(ctx):
    """Original bug: teacher (staff role) got 403. Must now be 200/302."""
    r = _download(ctx, ctx["teacher_token"])
    assert r.status_code in (200, 302, 307), f"teacher MUST be allowed: {r.status_code} {r.text[:200]}"


def test_other_student_forbidden(ctx):
    r = _download(ctx, ctx["student_other_token"])
    assert r.status_code == 403, f"non-owner student must be forbidden: {r.status_code} {r.text[:200]}"
