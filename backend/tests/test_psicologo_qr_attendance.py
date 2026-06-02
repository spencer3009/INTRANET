# -*- coding: utf-8 -*-
"""
Tests for: Psicólogos get a QR code and can take attendance from
"Personal Administrativo".

Covers:
1. Creating a psicólogo auto-generates a QR (qr_id / qr_version 2).
2. The psicólogo shows up in GET /attendance/maintenance (Personal Administrativo).
3. Scanning the psicólogo QR records attendance as type="maintenance"
   (NOT type="student") and reflects "present" in the maintenance list.
"""
import os
import uuid

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
assert MONGO_URL and DB_NAME

OWNER = ("admin@elroble.edu", "1234abc8")
TAG = uuid.uuid4().hex[:8]


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


@pytest.mark.asyncio
async def test_psicologo_qr_and_maintenance_attendance():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    token = _login(*OWNER)
    headers = {"Authorization": f"Bearer {token}"}
    created_id = None
    try:
        # 1. Create a psicólogo -> should auto-generate a QR.
        r = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "name": f"PsiQR{TAG}", "last_name": "Test", "role": "psicologo",
            "dni": f"7{TAG[:7]}", "username": f"psiqr_{TAG}",
            "password": "Test1234", "email": f"psiqr_{TAG}@elroble.edu",
        }, timeout=30)
        assert r.status_code in (200, 201), r.text
        user = r.json().get("user", r.json())
        created_id = user["id"]
        qr_id = user.get("qr_id")
        assert qr_id, "psicólogo created without a QR"
        assert user.get("qr_version") == 2

        # 2. Appears in Personal Administrativo (maintenance) list.
        today = "2099-01-01"  # fixed future date to avoid clashing real data
        r = requests.get(f"{BASE_URL}/api/attendance/maintenance?date={today}",
                         headers=headers, timeout=30)
        r.raise_for_status()
        people = r.json().get("maintenance", [])
        match = [p for p in people if p["id"] == created_id]
        assert match, "psicólogo not listed in Personal Administrativo"
        assert match[0]["role_label"] == "Psicólogo"
        assert match[0]["status"] == "pending"

        # 3. Scan the QR -> must record as type="maintenance", present.
        r = requests.post(f"{BASE_URL}/api/attendance/qr/scan", headers=headers,
                          json={"qr_token": qr_id, "mode": "entry"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "success"
        assert body["student"]["role"] == "psicologo"

        rec = await db.attendances.find_one(
            {"user_id": created_id, "type": "maintenance"}, {"_id": 0})
        assert rec is not None, "attendance was not stored as type=maintenance"
        assert rec["status"] == "present"
        assert rec.get("method") == "qr_scan"
        # It must NOT have been mis-recorded as a student.
        student_rec = await db.attendances.find_one(
            {"user_id": created_id, "type": "student"})
        assert student_rec is None, "psicólogo wrongly recorded as student"
    finally:
        await db.attendances.delete_many({"user_id": created_id})
        if created_id:
            await db.users.delete_one({"id": created_id})
        client.close()
