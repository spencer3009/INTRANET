# -*- coding: utf-8 -*-
"""
Regression test for the "0 profesores" bug.

Root cause: GET /api/users used `to_list(length=1000)` with no sort. In a school
with 1000+ students/parents created earlier, newly-imported teachers (inserted
last in natural order) fell past the cap and were silently truncated — so the
Teachers tab showed "0 profesores" even though the teachers existed in the DB
(which is why activating one reported "DNI ya existe como profesor").

This test seeds enough dummy users in the El Roble school so the total exceeds
1000, inserts one tagged teacher LAST, and asserts GET /api/users still returns
that teacher (i.e. no truncation).
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
assert MONGO_URL and DB_NAME, "MONGO_URL / DB_NAME not set"

OWNER = ("admin@elroble.edu", "1234abc8")
TAG = "CAPTEST_" + uuid.uuid4().hex[:8]


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


@pytest.mark.asyncio
async def test_users_list_returns_teacher_beyond_1000_cap():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    try:
        token = _login(*OWNER)
        me = requests.get(f"{BASE_URL}/api/auth/me",
                          headers={"Authorization": f"Bearer {token}"}, timeout=30).json()
        school_id = me["school_id"]

        now = datetime.now(timezone.utc).isoformat()

        # How many users already exist for this school?
        existing = await db.users.count_documents({"school_id": school_id})
        # Insert enough dummy students so total comfortably exceeds 1000.
        needed = max(0, 1010 - existing)
        dummies = [{
            "id": str(uuid.uuid4()),
            "name": f"Dummy{i}",
            "role": "student",
            "school_id": school_id,
            "username": f"{TAG}_stu_{i}",
            "_captest_tag": TAG,
            "created_at": now,
        } for i in range(needed)]
        if dummies:
            await db.users.insert_many(dummies)

        # Insert the tagged TEACHER LAST so it sits at the end of natural order.
        teacher_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": teacher_id,
            "name": "Profesor CapTest",
            "last_name": "Final",
            "dni": "99999001",
            "role": "teacher",
            "school_id": school_id,
            "status": "active",
            "username": f"{TAG}_teacher",
            "_captest_tag": TAG,
            "created_at": now,
        })

        # Act: list users via the API.
        r = requests.get(f"{BASE_URL}/api/users",
                         headers={"Authorization": f"Bearer {token}"}, timeout=60)
        r.raise_for_status()
        users = r.json()

        total = await db.users.count_documents({"school_id": school_id})
        assert total > 1000, f"precondition: expected >1000 users, got {total}"

        ids = {u.get("id") for u in users}
        assert teacher_id in ids, (
            "Teacher inserted after the 1000th user was truncated from GET /api/users "
            "(the 0-profesores bug)."
        )

        teachers = [u for u in users if u.get("role") == "teacher"]
        assert any(u.get("id") == teacher_id for u in teachers)
    finally:
        await db.users.delete_many({"_captest_tag": TAG})
        client.close()
