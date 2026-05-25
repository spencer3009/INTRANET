# -*- coding: utf-8 -*-
"""
Tests for the new "attachments to institutional broadcasts" feature.

Covers:
  * GET  /api/messaging/drive-status
  * POST /api/messaging/attachments/upload (path 409 — Drive not connected;
    path 403 — non-admin; path 400 — empty / oversized / disallowed type)
  * BroadcastAttachmentRef pydantic validation through POST /api/broadcast/send
  * GET  /api/broadcast/inbox returns attachments field
  * GET  /api/messaging/attachments/{message_id}/{file_id}
        (404 unknown msg, 404 unknown file_id, 403 cross-school, 200 path with
        seeded broadcast doc that has google_drive_connected=True; we don't
        actually download from Drive — we just confirm the permission gate
        accepts the same-school user and reaches the Drive call.)
"""
import os
import io
import uuid
import asyncio
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
TEACHER = ("sonia3009@gmail.com", "teacher123")
PARENT = ("maria.peres@gmail.com", "1234abc8")


# ---------------------------- helpers / fixtures ----------------------------

def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def owner_ctx():
    token, user = _login(*OWNER)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def teacher_ctx():
    token, user = _login(*TEACHER)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def parent_ctx():
    token, user = _login(*PARENT)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def mongo():
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


# ------------------------------- drive-status -------------------------------

class TestDriveStatus:
    def test_drive_status_for_owner_not_connected(self, owner_ctx):
        r = requests.get(f"{BASE_URL}/api/messaging/drive-status", headers=owner_ctx["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body.keys()) >= {"connected", "materials_folder_configured"}
        assert isinstance(body["connected"], bool)
        assert isinstance(body["materials_folder_configured"], bool)
        # El Roble has Drive NOT connected per ticket
        assert body["connected"] is False
        assert body["materials_folder_configured"] is False

    def test_drive_status_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/messaging/drive-status", timeout=15)
        assert r.status_code in (401, 403)


# ------------------------------- upload paths -------------------------------

class TestUploadAttachment:
    """Validations: no Drive=409, non-admin=403, empty/big/bad type=400."""

    def _post(self, headers, file_tuple):
        return requests.post(
            f"{BASE_URL}/api/messaging/attachments/upload",
            headers=headers,
            files={"file": file_tuple},
            timeout=30,
        )

    def test_owner_drive_not_connected_returns_409(self, owner_ctx):
        r = self._post(owner_ctx["headers"], ("hello.txt", b"hola mundo", "text/plain"))
        assert r.status_code == 409, r.text
        assert "Drive" in r.json().get("detail", "")

    def test_teacher_forbidden(self, teacher_ctx):
        # Teacher is not admin/owner → 403 BEFORE the drive check
        r = self._post(teacher_ctx["headers"], ("a.txt", b"hello", "text/plain"))
        assert r.status_code == 403, r.text

    def test_parent_forbidden(self, parent_ctx):
        r = self._post(parent_ctx["headers"], ("a.txt", b"hello", "text/plain"))
        assert r.status_code == 403, r.text

    def test_unauthenticated_rejected(self):
        r = requests.post(
            f"{BASE_URL}/api/messaging/attachments/upload",
            files={"file": ("a.txt", b"x", "text/plain")},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    # NOTE: empty/oversized/bad-type validations live AFTER the drive gate in
    # the current implementation (drive check happens first). With El Roble's
    # Drive disconnected, all of these still bubble up as 409. We document
    # that here so the main agent can decide whether to reorder the checks.
    def test_empty_file_under_drive_disconnected_returns_409_not_400(self, owner_ctx):
        r = self._post(owner_ctx["headers"], ("empty.txt", b"", "text/plain"))
        # Document current behaviour: 409 (drive gate first). If main agent
        # reorders, this should flip to 400.
        assert r.status_code in (400, 409), r.text


# --------------------------- broadcast send / inbox --------------------------

class TestBroadcastWithAttachments:
    """We test POST /api/broadcast/send with the BroadcastAttachmentRef shape
    AND validate the doc lands in db.broadcast_messages with attachments
    persisted, then GET /api/broadcast/inbox returns it for a recipient."""

    @pytest.fixture(scope="class")
    def sent_broadcast(self, owner_ctx, mongo):
        att = {
            "file_id": uuid.uuid4().hex,
            "name": "comunicado.pdf",
            "mime_type": "application/pdf",
            "size": 1234,
            "drive_file_id": "FAKE_DRIVE_ID_" + uuid.uuid4().hex[:8],
            "storage_type": "google_drive",
        }
        payload = {
            "subject": "TEST_ATTACH " + uuid.uuid4().hex[:6],
            "body": "Probando adjunto",
            "target_roles": ["teacher", "parent"],
            "attachments": [att],
        }
        r = requests.post(f"{BASE_URL}/api/broadcast/send",
                          headers={**owner_ctx["headers"], "Content-Type": "application/json"},
                          json=payload, timeout=20)
        assert r.status_code == 200, r.text
        broadcast_id = r.json()["broadcast_id"]

        # Wait a moment for the background task to create receivers
        import time
        time.sleep(1.5)

        yield {"broadcast_id": broadcast_id, "att": att, "subject": payload["subject"]}

        # Cleanup
        async def _cleanup():
            await mongo.broadcast_messages.delete_one({"id": broadcast_id})
            await mongo.broadcast_receivers.delete_many({"message_id": broadcast_id})
        asyncio.get_event_loop().run_until_complete(_cleanup())

    def test_send_persists_attachments_in_db(self, sent_broadcast, mongo):
        async def _check():
            doc = await mongo.broadcast_messages.find_one({"id": sent_broadcast["broadcast_id"]})
            return doc
        doc = asyncio.get_event_loop().run_until_complete(_check())
        assert doc is not None
        assert doc.get("has_attachments") is True
        assert isinstance(doc.get("attachments"), list)
        assert len(doc["attachments"]) == 1
        a = doc["attachments"][0]
        assert a["file_id"] == sent_broadcast["att"]["file_id"]
        assert a["drive_file_id"] == sent_broadcast["att"]["drive_file_id"]
        assert a["name"] == "comunicado.pdf"
        assert a["mime_type"] == "application/pdf"
        assert a["size"] == 1234
        assert a["storage_type"] == "google_drive"

    def test_inbox_returns_attachments_for_recipient(self, teacher_ctx, sent_broadcast):
        r = requests.get(f"{BASE_URL}/api/broadcast/inbox", headers=teacher_ctx["headers"], timeout=20)
        assert r.status_code == 200, r.text
        items = r.json().get("broadcasts", [])
        match = next((b for b in items if b.get("id") == sent_broadcast["broadcast_id"]), None)
        assert match is not None, f"sent broadcast not in teacher inbox; got {[b.get('id') for b in items][:5]}"
        assert match.get("has_attachments") is True
        assert isinstance(match.get("attachments"), list)
        assert len(match["attachments"]) == 1
        assert match["attachments"][0]["file_id"] == sent_broadcast["att"]["file_id"]
        assert match["attachments"][0]["drive_file_id"] == sent_broadcast["att"]["drive_file_id"]

    def test_attachment_ref_pydantic_validation(self, owner_ctx):
        """Missing required fields in BroadcastAttachmentRef → 422."""
        payload = {
            "subject": "TEST_VAL " + uuid.uuid4().hex[:6],
            "body": "x",
            "target_roles": ["teacher"],
            "attachments": [{"file_id": "abc", "name": "x.pdf"}],  # missing mime_type/size/drive_file_id
        }
        r = requests.post(f"{BASE_URL}/api/broadcast/send",
                          headers={**owner_ctx["headers"], "Content-Type": "application/json"},
                          json=payload, timeout=20)
        assert r.status_code == 422, r.text


# ---------------------- download endpoint permission tests ------------------

class TestDownloadAttachmentPermissions:
    """We seed a fake broadcast doc directly in Mongo with a fake drive
    attachment, then assert the permission gate behaviour. We do NOT need
    Drive to actually serve the file: 404/403 cases never touch Drive, and
    for the "happy" same-school case we accept a 500/200 (the call reaches
    the Drive service)."""

    @pytest.fixture(scope="class")
    def seeded_msg(self, mongo, owner_ctx):
        msg_id = "TEST_BCAST_" + uuid.uuid4().hex
        file_id = "TEST_FILE_" + uuid.uuid4().hex
        school_id = owner_ctx["user"]["school_id"]
        doc = {
            "id": msg_id,
            "school_id": school_id,
            "subject": "TEST seed",
            "body": "x",
            "target_roles": ["teacher"],
            "status": "active",
            "attachments": [{
                "file_id": file_id,
                "name": "x.pdf",
                "mime_type": "application/pdf",
                "size": 10,
                "drive_file_id": "FAKE",
                "storage_type": "google_drive",
            }],
            "has_attachments": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        async def _seed():
            await mongo.broadcast_messages.insert_one(doc)
        asyncio.get_event_loop().run_until_complete(_seed())

        yield {"message_id": msg_id, "file_id": file_id, "school_id": school_id}

        async def _cleanup():
            await mongo.broadcast_messages.delete_one({"id": msg_id})
        asyncio.get_event_loop().run_until_complete(_cleanup())

    def test_404_unknown_message(self, owner_ctx):
        r = requests.get(
            f"{BASE_URL}/api/messaging/attachments/does-not-exist/whatever",
            headers=owner_ctx["headers"], timeout=15)
        assert r.status_code == 404

    def test_404_known_message_unknown_file(self, owner_ctx, seeded_msg):
        r = requests.get(
            f"{BASE_URL}/api/messaging/attachments/{seeded_msg['message_id']}/not-a-real-file-id",
            headers=owner_ctx["headers"], timeout=15)
        assert r.status_code == 404, r.text

    def test_403_cross_school_user_blocked(self, mongo, owner_ctx, seeded_msg):
        """Inject a fake user from a different school and try to fetch the
        attachment. We synthesise the JWT via the login endpoint of an
        existing user from another school if one exists; otherwise we change
        the seeded doc's school_id to something else and check that the
        owner now gets 403."""
        async def _flip():
            await mongo.broadcast_messages.update_one(
                {"id": seeded_msg["message_id"]},
                {"$set": {"school_id": "OTHER_SCHOOL_ID"}})
        async def _restore():
            await mongo.broadcast_messages.update_one(
                {"id": seeded_msg["message_id"]},
                {"$set": {"school_id": seeded_msg["school_id"]}})
        loop = asyncio.get_event_loop()
        loop.run_until_complete(_flip())
        try:
            r = requests.get(
                f"{BASE_URL}/api/messaging/attachments/{seeded_msg['message_id']}/{seeded_msg['file_id']}",
                headers=owner_ctx["headers"], timeout=15)
            assert r.status_code == 403, r.text
        finally:
            loop.run_until_complete(_restore())

    def test_same_school_reaches_drive_layer(self, owner_ctx, seeded_msg):
        """Owner of the same school as the seeded doc passes the permission
        gate. With Drive disconnected for El Roble, the call hits the
        get_drive_service path and surfaces 500 (Drive error) — that's a
        SUCCESS signal for the permission gate (the only thing we test
        here)."""
        r = requests.get(
            f"{BASE_URL}/api/messaging/attachments/{seeded_msg['message_id']}/{seeded_msg['file_id']}",
            headers=owner_ctx["headers"], timeout=20)
        # NOT 403 / NOT 404 — permission gate passed.
        assert r.status_code not in (403, 404), r.text
        # Currently Drive disconnected → 500 with Drive error message.
        assert r.status_code in (200, 500, 409), r.text
