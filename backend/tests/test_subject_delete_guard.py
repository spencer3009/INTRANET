# -*- coding: utf-8 -*-
"""
Test: deleting a course (subject) must be BLOCKED while it still has teacher
assignments, so the system never leaves orphaned `academic_assignments` behind.

The user must first unlink the teacher(s) in "Asignación Docente".
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
assert MONGO_URL and DB_NAME

OWNER = ("admin@elroble.edu", "1234abc8")


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


@pytest.mark.asyncio
async def test_cannot_delete_subject_with_assignments():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    token = _login(*OWNER)
    headers = {"Authorization": f"Bearer {token}"}
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=30).json()
    school_id = me["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    tag = uuid.uuid4().hex[:6]
    subj_with = f"SUBJW_{tag}"
    subj_without = f"SUBJN_{tag}"
    assign_id = f"ASSN_{tag}"
    teacher = await db.users.find_one({"school_id": school_id, "role": "teacher"}, {"id": 1})
    try:
        await db.subjects.insert_one({"id": subj_with, "school_id": school_id, "name": "Con docente", "created_at": now})
        await db.academic_assignments.insert_one({
            "id": assign_id, "school_id": school_id,
            "teacher_id": teacher["id"] if teacher else None,
            "subject_id": subj_with, "status": "activo", "school_year": 2026, "created_at": now,
        })
        await db.subjects.insert_one({"id": subj_without, "school_id": school_id, "name": "Sin docente", "created_at": now})

        # 1. With assignment -> blocked (400) and NOT deleted.
        r = requests.delete(f"{BASE_URL}/api/academic/subjects/{subj_with}", headers=headers, timeout=30)
        assert r.status_code == 400, r.text
        assert "asignación" in r.json()["detail"].lower() or "asignacion" in r.json()["detail"].lower()
        assert await db.subjects.find_one({"id": subj_with}) is not None  # still there
        assert await db.academic_assignments.find_one({"id": assign_id}) is not None  # no orphan created

        # 2. Without assignment -> deletes fine (200).
        r2 = requests.delete(f"{BASE_URL}/api/academic/subjects/{subj_without}", headers=headers, timeout=30)
        assert r2.status_code == 200, r2.text
        assert await db.subjects.find_one({"id": subj_without}) is None

        # 3. After unlinking the assignment, the course can be deleted.
        await db.academic_assignments.delete_one({"id": assign_id})
        r3 = requests.delete(f"{BASE_URL}/api/academic/subjects/{subj_with}", headers=headers, timeout=30)
        assert r3.status_code == 200, r3.text
    finally:
        await db.subjects.delete_many({"id": {"$in": [subj_with, subj_without]}})
        await db.academic_assignments.delete_many({"id": assign_id})
        client.close()
