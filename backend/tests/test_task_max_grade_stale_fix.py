"""
Pytest: el "máximo" de una tarea sale /19 en vez de /20 al calificar.

Bug (Jun 2026, producción): el profesor crea una tarea con Puntos=20 pero al
calificar las entregas la columna NOTA muestra "/19" y no deja poner 20.
Causa raíz: al CREAR se guardaba `max_grade = metadata.points`, pero al EDITAR
la tarea (`PUT /course/posts/{id}`) solo se actualizaba `metadata` y NO el
`max_grade` raíz. Si la tarea tuvo 19 y luego se editó a 20, `max_grade` quedó
"pegado" en 19 y todos los lectores lo usaban primero.

Fix: (1) el edit ahora sincroniza `max_grade` con metadata.points; (2) los
lectores (GET submissions + validación de nota) prefieren metadata.points sobre
un max_grade obsoleto, reparando datos ya divergentes sin migración.

E2E contra el backend de preview (El Roble). Limpia los datos creados.
"""
from __future__ import annotations
import asyncio
import uuid
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


def _env(path, key):
    for line in open(path):
        line = line.strip()
        if line.startswith(key + "="):
            return line.split("=", 1)[1]
    return None


BASE = _env("/app/frontend/.env", "REACT_APP_BACKEND_URL").rstrip("/")
MONGO = _env("/app/backend/.env", "MONGO_URL")
DBN = _env("/app/backend/.env", "DB_NAME")


def _login():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": "admin@elroble.edu", "password": "1234abc8"}, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


def test_stale_max_grade_is_repaired_and_20_is_acceptable():
    token = _login()
    headers = {"Authorization": f"Bearer {token}"}

    async def run():
        c = AsyncIOMotorClient(MONGO)
        db = c[DBN]
        school = (await db.users.find_one({"email": "admin@elroble.edu"}))["school_id"]
        student = await db.users.find_one({"school_id": school, "role": "student"})
        task_id, sub_id = str(uuid.uuid4()), str(uuid.uuid4())
        # Simula el dato roto en producción: metadata.points=20 pero max_grade=19.
        await db.course_posts.insert_one({
            "id": task_id, "school_id": school, "post_type": "task",
            "title": "PYTEST stale-max-grade", "max_grade": 19,
            "metadata": {"points": 20, "delivery_type": "files"},
            "submissions": [{
                "id": sub_id, "student_id": student["id"],
                "submitted_at": "2026-06-01T00:00:00", "grade": None,
            }],
        })
        try:
            # 1) GET submissions ahora debe reportar max_grade=20 (no 19).
            r0 = requests.get(
                f"{BASE}/api/course/tasks/{task_id}/submissions",
                headers=headers, timeout=30)
            assert r0.status_code == 200, r0.text
            assert r0.json()["max_grade"] == 20, f"max_grade reportado: {r0.json()['max_grade']}"

            # 2) Poner 20 debe ser aceptado (antes daba 400 'no mayor a 19').
            r1 = requests.put(
                f"{BASE}/api/course/tasks/{task_id}/submissions/{sub_id}/grade",
                json={"grade": 20, "feedback": None}, headers=headers, timeout=30)
            assert r1.status_code == 200, r1.text
            doc = await db.course_posts.find_one({"id": task_id})
            assert doc["submissions"][0].get("grade") == 20.0
        finally:
            await db.course_posts.delete_one({"id": task_id})

    asyncio.get_event_loop().run_until_complete(run())


def test_editing_points_keeps_max_grade_in_sync():
    token = _login()
    headers = {"Authorization": f"Bearer {token}"}

    async def run():
        c = AsyncIOMotorClient(MONGO)
        db = c[DBN]
        admin = await db.users.find_one({"email": "admin@elroble.edu"})
        school = admin["school_id"]
        task_id = str(uuid.uuid4())
        await db.course_posts.insert_one({
            "id": task_id, "school_id": school, "post_type": "task",
            "author_id": admin["id"], "title": "PYTEST edit-points",
            "content": "x", "max_grade": 19,
            "metadata": {"points": 19, "delivery_type": "files"},
            "submissions": [],
        })
        try:
            # Editar la tarea a 20 puntos.
            r = requests.put(
                f"{BASE}/api/course/posts/{task_id}",
                json={"metadata": {"points": 20, "delivery_type": "files"}},
                headers=headers, timeout=30)
            assert r.status_code == 200, r.text
            doc = await db.course_posts.find_one({"id": task_id})
            assert doc.get("max_grade") == 20, f"max_grade tras editar: {doc.get('max_grade')}"
        finally:
            await db.course_posts.delete_one({"id": task_id})

    asyncio.get_event_loop().run_until_complete(run())
