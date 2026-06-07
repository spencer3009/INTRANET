"""
Pytest: PUT /api/course/tasks/{task_id}/submissions/{submission_id}/grade

Bug (Jun 2026): En el portal del profesor, al borrar una nota mal puesta y
guardar, la nota NO se eliminaba (seguía visible). Causa: el backend solo
hacía $set cuando grade != None; un grade=None (celda vacía) se ignoraba.
Fix: grade/feedback en None ahora hacen $unset del campo. Además el frontend
envía el valor EFECTIVO de cada campo, así editar solo el feedback no borra la
nota (y viceversa).

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


def test_clearing_a_grade_removes_it():
    token = _login()
    headers = {"Authorization": f"Bearer {token}"}

    async def run():
        c = AsyncIOMotorClient(MONGO)
        db = c[DBN]
        school = (await db.users.find_one({"email": "admin@elroble.edu"}))["school_id"]
        student = await db.users.find_one({"school_id": school, "role": "student"})
        task_id, sub_id = str(uuid.uuid4()), str(uuid.uuid4())
        await db.course_posts.insert_one({
            "id": task_id, "school_id": school, "post_type": "task",
            "title": "PYTEST clear-grade", "max_grade": 20,
            "submissions": [{
                "id": sub_id, "student_id": student["id"],
                "submitted_at": "2026-06-01T00:00:00", "grade": None,
            }],
        })
        try:
            # 1) Set a grade + feedback
            r1 = requests.put(
                f"{BASE}/api/course/tasks/{task_id}/submissions/{sub_id}/grade",
                json={"grade": 15, "feedback": "bien"}, headers=headers, timeout=30)
            assert r1.status_code == 200, r1.text
            doc = await db.course_posts.find_one({"id": task_id})
            assert doc["submissions"][0].get("grade") == 15.0

            # 2) Clear the grade (empty cell -> null) keeping feedback
            r2 = requests.put(
                f"{BASE}/api/course/tasks/{task_id}/submissions/{sub_id}/grade",
                json={"grade": None, "feedback": "bien"}, headers=headers, timeout=30)
            assert r2.status_code == 200, r2.text
            doc = await db.course_posts.find_one({"id": task_id})
            sub = doc["submissions"][0]
            assert "grade" not in sub, "grade debe eliminarse al borrarla"
            assert sub.get("feedback") == "bien", "feedback no debe borrarse al solo limpiar la nota"
        finally:
            await db.course_posts.delete_one({"id": task_id})

    asyncio.get_event_loop().run_until_complete(run())
