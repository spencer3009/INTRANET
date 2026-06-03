# -*- coding: utf-8 -*-
"""
Tests for orphan teacher-assignment cleanup (SUPPORT-only tool).

Orphan = an `academic_assignment` whose `subject_id` is missing or points to a
subject (course) that no longer exists.

Covers:
- Owner/admin of the school is FORBIDDEN (403) from listing/deleting orphans.
- A Soporte session (support_switch token) CAN list them (subject_name empty)
  and bulk-delete them; a valid assignment is never deleted.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import jwt
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET", "edunet-saas-secret-key-2026-dev-only")
assert MONGO_URL and DB_NAME

OWNER = ("admin@elroble.edu", "1234abc8")


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


def _support_token(school_id):
    payload = {
        "sub": "support-test", "scope": "support_switch",
        "active_school_id": school_id, "school_id": school_id,
        "email": "soporte@edunet.pe", "name": "Soporte",
        "original_role": "system_admin_global",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@pytest.mark.asyncio
async def test_orphans_support_only_and_bulk_delete():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    owner_token = _login(*OWNER)
    owner_h = {"Authorization": f"Bearer {owner_token}"}
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=owner_h, timeout=30).json()
    school_id = me["school_id"]
    sup_h = {"Authorization": f"Bearer {_support_token(school_id)}"}

    now = datetime.now(timezone.utc).isoformat()
    teacher = await db.users.find_one({"school_id": school_id, "role": "teacher"}, {"id": 1})
    valid_subject = await db.subjects.find_one({"school_id": school_id}, {"id": 1})
    tag = uuid.uuid4().hex[:8]
    orphan_id = f"ORPHTEST_{tag}"
    valid_id = f"VALIDTEST_{tag}"
    try:
        await db.academic_assignments.insert_one({
            "id": orphan_id, "school_id": school_id,
            "teacher_id": teacher["id"] if teacher else None,
            "subject_id": f"NONEXISTENT_{tag}", "status": "activo", "school_year": 2026, "created_at": now,
        })
        if valid_subject:
            await db.academic_assignments.insert_one({
                "id": valid_id, "school_id": school_id,
                "teacher_id": teacher["id"] if teacher else None,
                "subject_id": valid_subject["id"], "status": "activo", "school_year": 2026, "created_at": now,
            })

        # Owner is forbidden.
        assert requests.get(f"{BASE_URL}/api/academic/assignments/orphans", headers=owner_h, timeout=30).status_code == 403
        assert requests.delete(f"{BASE_URL}/api/academic/assignments/orphans", headers=owner_h, timeout=30).status_code == 403

        # Support can list.
        r = requests.get(f"{BASE_URL}/api/academic/assignments/orphans", headers=sup_h, timeout=30)
        assert r.status_code == 200, r.text
        ids = {o["id"] for o in r.json()}
        assert orphan_id in ids
        if valid_subject:
            assert valid_id not in ids

        # Support can bulk-delete.
        rd = requests.delete(f"{BASE_URL}/api/academic/assignments/orphans", headers=sup_h, timeout=60)
        assert rd.status_code == 200, rd.text
        assert rd.json()["deleted_count"] >= 1
        assert await db.academic_assignments.find_one({"id": orphan_id}) is None
        if valid_subject:
            assert await db.academic_assignments.find_one({"id": valid_id}) is not None
    finally:
        await db.academic_assignments.delete_many({"id": {"$in": [orphan_id, valid_id]}})
        client.close()
