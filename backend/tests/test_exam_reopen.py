# -*- coding: utf-8 -*-
"""
Regression test for: reopening a closed exam must keep it open.

Bug: a 60s cron (`close_expired_exams_cron`) auto-closes any *published* exam
whose `end_datetime` is in the past. So reopening an exam whose window already
expired published it for a moment, then the cron re-closed it (CERRADO again on
F5), and the exam could no longer be edited ("No se puede editar un examen
cerrado").

Fix: POST /api/exams/{id}/reopen now auto-extends the availability window
(preserving the original length, starting from now) when it has already expired,
so the exam stays published and the cron does not re-close it.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

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


async def _seed_closed_exam(db, school_id, *, start, end):
    eid = "TESTEXAM_" + uuid.uuid4().hex[:8]
    await db.online_exams.insert_one({
        "id": eid, "school_id": school_id, "subject_id": "testsubj", "section_id": None,
        "title": "TEST Reopen", "type": "digital", "status": "closed",
        "start_datetime": start, "end_datetime": end, "duration_minutes": 60,
        "created_by": "test", "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return eid


@pytest.mark.asyncio
async def test_reopen_expired_exam_extends_window():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    token = _login(*OWNER)
    headers = {"Authorization": f"Bearer {token}"}
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=30).json()
    school_id = me["school_id"]
    now = datetime.now(timezone.utc)
    eids = []
    try:
        # Case 1: expired window -> reopen must extend it to the future.
        eid = await _seed_closed_exam(
            db, school_id,
            start=(now - timedelta(hours=2)).isoformat(),
            end=(now - timedelta(hours=1)).isoformat())
        eids.append(eid)
        r = requests.post(f"{BASE_URL}/api/exams/{eid}/reopen", headers=headers, json={}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "published"
        assert body["extended"] is True
        new_end = datetime.fromisoformat(body["end_datetime"].replace("Z", "+00:00"))
        assert new_end > datetime.now(timezone.utc), "end must be in the future (cron-safe)"

        doc = await db.online_exams.find_one({"id": eid}, {"_id": 0, "status": 1, "end_datetime": 1})
        assert doc["status"] == "published"
        assert datetime.fromisoformat(doc["end_datetime"].replace("Z", "+00:00")) > datetime.now(timezone.utc)

        # Case 2: window still in the future -> reopen must NOT extend.
        eid2 = await _seed_closed_exam(
            db, school_id,
            start=(now - timedelta(minutes=10)).isoformat(),
            end=(now + timedelta(hours=3)).isoformat())
        eids.append(eid2)
        r2 = requests.post(f"{BASE_URL}/api/exams/{eid2}/reopen", headers=headers, json={}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json()["extended"] is False
        assert r2.json()["status"] == "published"
    finally:
        for e in eids:
            await db.online_exams.delete_one({"id": e})
        client.close()
