"""
Verifies the FCM migration of attendance push (FASE 1 ampliada).

All async tests are executed inside a single asyncio.run() so the shared
Motor client (bound to the loop on first use) is never used from a closed
loop — this mirrors test_attendance_push_targets.py.
"""
import asyncio
import inspect
import re
import uuid
from unittest.mock import AsyncMock, patch

import os
from motor.motor_asyncio import AsyncIOMotorClient

import routes.notifications as N
import routes.attendance as A

# NOTE: We re-bind the shared `db` reference in routes.notifications/attendance
# to a fresh Motor client tied to the CURRENT event loop right before running
# the async scenarios. This avoids "Event loop is closed" when another test
# file (e.g. test_attendance_push_targets.py) already consumed the original
# client's loop in this pytest session.
def _fresh_db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


db = N.db  # used only by source-inspecting (sync) tests; not by DB tests


# ──────────────────────────────────────────────────────────────────────────────
# Sync (source-level) tests — safe to run as separate test functions.
# ──────────────────────────────────────────────────────────────────────────────
def test_send_attendance_notification_does_not_use_push_tokens_collection():
    src = inspect.getsource(N.send_attendance_notification)
    # Strip line comments so the migration note ('...sobre push_tokens...') is not flagged.
    code_only = "\n".join(re.sub(r"#.*$", "", line) for line in src.splitlines())
    assert "push_tokens" not in code_only, (
        "send_attendance_notification must NOT reference db.push_tokens anymore."
    )
    assert "send_attendance_push(" in code_only, (
        "send_attendance_notification must delegate FCM to send_attendance_push."
    )


def test_qr_scan_teacher_branches_use_send_attendance_push():
    src = inspect.getsource(A)
    matches = re.findall(r"await\s+send_attendance_push\s*\(", src)
    assert len(matches) >= 2, (
        f"Expected >=2 'await send_attendance_push(' in routes/attendance.py "
        f"(QR teacher entry + exit). Found {len(matches)}."
    )


def test_save_endpoints_schedule_push_in_background():
    src = inspect.getsource(A)
    assert re.search(
        r'asyncio\.create_task\(\s*_push_attendance_batch\([^)]*"student"\s*\)\s*\)', src
    ), "save_student_attendance must schedule _push_attendance_batch(..., 'student')"
    assert re.search(
        r'asyncio\.create_task\(\s*_push_attendance_batch\([^)]*"teacher"\s*\)\s*\)', src
    ), "save_teacher_attendance must schedule _push_attendance_batch(..., 'teacher')"
    assert re.search(
        r'asyncio\.create_task\(\s*_push_attendance_batch\([^)]*"maintenance"\s*\)\s*\)', src
    ), "save_maintenance_attendance must schedule _push_attendance_batch(..., 'maintenance')"


def test_send_fcm_to_devices_supports_data_only_kwarg():
    from services.fcm_service import send_fcm_to_devices
    sig = inspect.signature(send_fcm_to_devices)
    assert "data_only" in sig.parameters
    assert sig.parameters["data_only"].default is False


# ──────────────────────────────────────────────────────────────────────────────
# Async DB-touching scenarios — all consolidated under ONE asyncio.run() to
# keep the motor client bound to a single live loop.
# ──────────────────────────────────────────────────────────────────────────────
async def _scenario_notification_with_parent():
    uid_s = str(uuid.uuid4())
    uid_p = str(uuid.uuid4())
    school_id = f"test-school-{uuid.uuid4()}"
    await db.users.insert_one({
        "id": uid_s, "role": "student", "school_id": school_id,
        "name": "Juan", "last_name": "Perez", "parent_id": uid_p,
    })
    await db.users.insert_one({
        "id": uid_p, "role": "parent", "school_id": school_id,
        "name": "Padre", "last_name": "Perez",
        "linked_students": [uid_s], "children_ids": [uid_s],
    })
    await db.schools.insert_one({"id": school_id, "name": "TestSchool"})
    try:
        mock_push = AsyncMock(return_value=(1, 0))
        with patch.object(N, "send_attendance_push", new=mock_push), \
             patch.object(N, "ws_manager") as mock_ws:
            mock_ws.send_to_user = AsyncMock(return_value=None)
            await N.send_attendance_notification(
                student_id=uid_s, school_id=school_id,
                entry_time="08:15", event_type="ingreso",
            )
        assert mock_push.await_count == 1, mock_push.await_count
        args, kwargs = mock_push.await_args
        assert args[0] == uid_s
        assert kwargs.get("rol") == "student"
        nrow = await db.parent_notifications.find_one(
            {"parent_id": uid_p, "school_id": school_id}, {"_id": 0}
        )
        assert nrow is not None
        assert nrow.get("type") == "ingreso"
        assert "Juan" in nrow.get("body", "")
    finally:
        await db.users.delete_many({"id": {"$in": [uid_s, uid_p]}})
        await db.schools.delete_one({"id": school_id})
        await db.parent_notifications.delete_many({"school_id": school_id})
        await db.notification_audit.delete_many({"school_id": school_id})


async def _scenario_notification_without_parents():
    uid_s = str(uuid.uuid4())
    school_id = f"test-school-{uuid.uuid4()}"
    await db.users.insert_one({
        "id": uid_s, "role": "student", "school_id": school_id,
        "name": "Solo", "last_name": "Student",
    })
    try:
        mock_push = AsyncMock(return_value=(1, 0))
        with patch.object(N, "send_attendance_push", new=mock_push):
            await N.send_attendance_notification(
                student_id=uid_s, school_id=school_id,
                entry_time=None, event_type="ingreso",
            )
        assert mock_push.await_count == 1
        args, kwargs = mock_push.await_args
        assert args[0] == uid_s
        assert kwargs.get("rol") == "student"
    finally:
        await db.users.delete_one({"id": uid_s})


async def _scenario_batch_dedupes_and_swallows_errors():
    uid_a = str(uuid.uuid4())
    uid_b = str(uuid.uuid4())
    await db.users.insert_one({"id": uid_a, "role": "teacher", "name": "A", "last_name": "A"})
    await db.users.insert_one({"id": uid_b, "role": "teacher", "name": "B", "last_name": "B"})
    try:
        # Dedupe (with empties + None).
        mock_push = AsyncMock(return_value=(0, 0))
        with patch.object(A, "send_attendance_push", new=mock_push):
            await A._push_attendance_batch(
                [uid_a, uid_a, uid_b, "", None, uid_b], "teacher"
            )
        assert mock_push.await_count == 2, mock_push.await_count
        ids = sorted([c.args[0] for c in mock_push.await_args_list])
        assert ids == sorted([uid_a, uid_b])

        # Errors are swallowed (logged) — must not raise.
        async def boom(*a, **kw):
            raise RuntimeError("FCM down")
        with patch.object(A, "send_attendance_push", new=boom):
            await A._push_attendance_batch([uid_a], "teacher")
    finally:
        await db.users.delete_many({"id": {"$in": [uid_a, uid_b]}})


async def _scenario_save_student_does_not_await_push():
    """
    Smoke check that the helper itself is non-blocking-by-design: simulate
    that send_attendance_push sleeps a long time and ensure asyncio.create_task
    does NOT block the caller. (We don't hit the HTTP endpoint because of the
    suspension middleware on the only test colegios available.)
    """
    uid = str(uuid.uuid4())
    await db.users.insert_one({"id": uid, "role": "teacher", "name": "X", "last_name": "Y"})
    try:
        slow = AsyncMock(side_effect=lambda *a, **kw: asyncio.sleep(2))
        with patch.object(A, "send_attendance_push", new=slow):
            t0 = asyncio.get_event_loop().time()
            task = asyncio.create_task(A._push_attendance_batch([uid], "teacher"))
            # Yield once: caller should return immediately, task still running.
            await asyncio.sleep(0)
            elapsed = asyncio.get_event_loop().time() - t0
            assert elapsed < 0.5, f"create_task should not block caller; took {elapsed:.2f}s"
            assert not task.done()
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    finally:
        await db.users.delete_one({"id": uid})


async def _run_all_async():
    await _scenario_notification_with_parent()
    await _scenario_notification_without_parents()
    await _scenario_batch_dedupes_and_swallows_errors()
    await _scenario_save_student_does_not_await_push()


def test_async_db_scenarios():
    # Re-bind motor `db` to a client tied to the current asyncio.run loop.
    fresh = _fresh_db()
    orig_n_db = N.db
    orig_a_db = A.db
    N.db = fresh
    A.db = fresh
    global db
    db = fresh
    try:
        asyncio.run(_run_all_async())
    finally:
        N.db = orig_n_db
        A.db = orig_a_db
