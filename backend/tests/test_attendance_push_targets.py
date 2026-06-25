"""
Verifica el enrutamiento de push de asistencia (un solo event loop):
- Alumno  -> su propia cuenta + apoderados (children_ids/linked_students/padre_id).
- Profesor -> solo su propia cuenta (sin vinculados).
- Dedupe por fcm_token, exclusión de inactivos y de otros alumnos.
- send_attendance_push sin tokens devuelve (0, 0).
"""
import asyncio
import uuid

import routes.notifications as N

db = N.db


async def _mkuser(role, **extra):
    uid = str(uuid.uuid4())
    await db.users.insert_one({"id": uid, "role": role, "school_id": "test-school",
                               "name": "T", "last_name": "U", **extra})
    return uid


async def _mktoken(user_id, fcm_token, active=True):
    await db.device_tokens.insert_one({"id": str(uuid.uuid4()), "user_id": user_id,
                                       "fcm_token": fcm_token, "active": active})


async def _run_all():
    users, tokens = [], []
    try:
        student = await _mkuser("student")
        other = await _mkuser("student")
        parent = await _mkuser("parent", children_ids=[student], linked_students=[student])
        await db.users.update_one({"id": student}, {"$set": {"padre_id": parent}})
        teacher = await _mkuser("teacher")
        users += [student, other, parent, teacher]

        for uid, tok, act in [(student, "S1", True), (parent, "P1", True), (parent, "P2", True),
                              (other, "O1", True), (teacher, "T1", True), (teacher, "T_OFF", False)]:
            await _mktoken(uid, tok, act)
            tokens.append(tok)

        st = sorted(d["fcm_token"] for d in await N.get_attendance_push_targets(student))
        assert st == ["P1", "P2", "S1"], st

        te = sorted(d["fcm_token"] for d in await N.get_attendance_push_targets(teacher))
        assert te == ["T1"], te

        empty_user = await _mkuser("teacher")
        users.append(empty_user)
        assert await N.send_attendance_push(empty_user, "Nadie", rol="teacher") == (0, 0)
    finally:
        await db.users.delete_many({"id": {"$in": users}})
        await db.device_tokens.delete_many({"fcm_token": {"$in": tokens}})


def test_attendance_push_routing():
    asyncio.run(_run_all())
