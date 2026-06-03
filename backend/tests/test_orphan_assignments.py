# -*- coding: utf-8 -*-
"""
Tests for orphan teacher-assignment cleanup.

Orphan = an `academic_assignment` whose `subject_id` is missing or points to a
subject (course) that no longer exists. The UI shows these with no linked course.

Covers:
- GET  /api/academic/assignments/orphans  lists them (subject_name empty, enriched).
- DELETE /api/academic/assignments/orphans bulk-deletes them.
- A normal assignment with a valid subject is NOT treated as orphan.
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
async def test_orphan_assignments_list_and_bulk_delete():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    token = _login(*OWNER)
    headers = {"Authorization": f"Bearer {token}"}
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=30).json()
    school_id = me["school_id"]
    now = datetime.now(timezone.utc).isoformat()

    teacher = await db.users.find_one({"school_id": school_id, "role": "teacher"}, {"id": 1})
    valid_subject = await db.subjects.find_one({"school_id": school_id}, {"id": 1})
    tag = uuid.uuid4().hex[:8]
    orphan_id = f"ORPHTEST_{tag}"
    valid_id = f"VALIDTEST_{tag}"
    try:
        # An orphan (subject_id points to a nonexistent subject).
        await db.academic_assignments.insert_one({
            "id": orphan_id, "school_id": school_id,
            "teacher_id": teacher["id"] if teacher else None,
            "subject_id": f"NONEXISTENT_{tag}", "grade_id": None, "section_id": None,
            "status": "activo", "school_year": 2026, "created_at": now,
        })
        # A valid assignment (must NOT be flagged as orphan).
        if valid_subject:
            await db.academic_assignments.insert_one({
                "id": valid_id, "school_id": school_id,
                "teacher_id": teacher["id"] if teacher else None,
                "subject_id": valid_subject["id"], "grade_id": None, "section_id": None,
                "status": "activo", "school_year": 2026, "created_at": now,
            })

        # GET orphans -> includes our orphan, excludes the valid one.
        r = requests.get(f"{BASE_URL}/api/academic/assignments/orphans", headers=headers, timeout=30)
        r.raise_for_status()
        orphans = r.json()
        ids = {o["id"] for o in orphans}
        assert orphan_id in ids
        if valid_subject:
            assert valid_id not in ids
        ours = next(o for o in orphans if o["id"] == orphan_id)
        assert ours["subject_name"] == ""  # no linked course

        # DELETE orphans -> removes all orphans (including ours).
        rd = requests.delete(f"{BASE_URL}/api/academic/assignments/orphans", headers=headers, timeout=60)
        rd.raise_for_status()
        assert rd.json()["deleted_count"] >= 1

        assert await db.academic_assignments.find_one({"id": orphan_id}) is None
        if valid_subject:
            # The valid assignment must survive the orphan purge.
            assert await db.academic_assignments.find_one({"id": valid_id}) is not None
    finally:
        await db.academic_assignments.delete_many({"id": {"$in": [orphan_id, valid_id]}})
        client.close()
