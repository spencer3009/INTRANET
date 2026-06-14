"""
Pytest: Evidencia de exámenes con 2 modos (Jun 2026).

El profesor elige el modo de evidencia en el examen:
  • "end"          → el alumno adjunta hasta 5 archivos al final.
  • "per_question" → 1 archivo OBLIGATORIO por pregunta.

Drive NO está conectado en preview, por lo que la subida real a Drive se valida
en producción. Aquí se prueba:
  1. Persistencia de `evidence_mode` al crear/editar (vía API).
  2. El "candado" de envío:
     - end: bloquea si no hay ningún archivo; pasa con ≥1.
     - per_question: bloquea si falta evidencia en alguna pregunta; pasa con todas.

Se seedea directamente en Mongo para los casos del gate. Limpia lo creado.
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


def _login(email, password):
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


def test_create_and_update_persists_evidence_mode():
    token = _login("admin@elroble.edu", "1234abc8")
    headers = {"Authorization": f"Bearer {token}"}

    async def run():
        c = AsyncIOMotorClient(MONGO)
        db = c[DBN]
        admin = await db.users.find_one({"email": "admin@elroble.edu"})
        school = admin["school_id"]
        subject = await db.subjects.find_one({"school_id": school}, {"_id": 0, "id": 1})
        sid = subject["id"]

        # Crear examen digital SIN pedir evidencia (evita el gate de Drive) pero
        # con evidence_mode = per_question → debe persistir igual.
        payload = {
            "title": f"PYTEST evidence mode {uuid.uuid4().hex[:6]}",
            "type": "digital",
            "start_datetime": "2026-06-01T09:00:00Z",
            "end_datetime": "2026-12-31T10:00:00Z",
            "duration_minutes": 60,
            "min_score_percentage": 55,
            "allow_evidence_upload": False,
            "evidence_mode": "per_question",
        }
        r = requests.post(f"{BASE}/api/course/{sid}/exams", json=payload, headers=headers, timeout=30)
        assert r.status_code in (200, 201), r.text
        exam_id = r.json().get("id") or r.json().get("exam", {}).get("id")
        assert exam_id, r.text
        try:
            doc = await db.online_exams.find_one({"id": exam_id})
            assert doc.get("evidence_mode") == "per_question", doc.get("evidence_mode")

            # Editar a "end"
            ru = requests.put(f"{BASE}/api/exams/{exam_id}",
                              json={"evidence_mode": "end"}, headers=headers, timeout=30)
            assert ru.status_code == 200, ru.text
            doc = await db.online_exams.find_one({"id": exam_id})
            assert doc.get("evidence_mode") == "end", doc.get("evidence_mode")
        finally:
            await db.online_exams.delete_one({"id": exam_id})

    asyncio.get_event_loop().run_until_complete(run())


def _detail(resp):
    try:
        return (resp.json() or {}).get("detail", "")
    except Exception:
        return resp.text


def test_submit_gate_end_mode():
    token = _login("demo.reintento@elroble.edu", "Demo1234!")
    headers = {"Authorization": f"Bearer {token}"}

    async def run():
        c = AsyncIOMotorClient(MONGO)
        db = c[DBN]
        student = await db.users.find_one({"email": "demo.reintento@elroble.edu"})
        school = student["school_id"]
        exam_id = f"PYTEST-EV-END-{uuid.uuid4().hex[:6]}"
        attempt_id = str(uuid.uuid4())
        q_id = str(uuid.uuid4())
        await db.online_exams.insert_one({
            "id": exam_id, "school_id": school, "type": "digital",
            "title": "PYTEST end-gate", "status": "published",
            "allow_evidence_upload": True, "evidence_mode": "end",
            "total_points": 1,
        })
        await db.exam_questions.insert_one({
            "id": q_id, "exam_id": exam_id, "school_id": school, "order": 1,
            "question_type": "open", "question_text": "x", "points": 1,
        })
        await db.exam_attempts.insert_one({
            "id": attempt_id, "exam_id": exam_id, "school_id": school,
            "student_id": student["id"], "student_name": "Demo",
            "status": "in_progress", "answers": {}, "graded_answers": {},
            "start_time": "2026-06-01T09:00:00+00:00",
        })
        try:
            # Sin evidencia → 400 bloqueo
            r1 = requests.post(f"{BASE}/api/exam-attempts/{attempt_id}/submit",
                               json={"auto_submitted": False}, headers=headers, timeout=30)
            assert r1.status_code == 400, r1.text
            assert "evidencia" in _detail(r1).lower(), _detail(r1)

            # Con 1 evidencia seedeada → pasa el gate (no error de evidencia)
            await db.exam_attempts.update_one(
                {"id": attempt_id},
                {"$set": {"evidence_files": [{"id": "e1", "file_name": "foto.jpg",
                                              "drive_file_id": "x", "storage_type": "google_drive"}]}},
            )
            r2 = requests.post(f"{BASE}/api/exam-attempts/{attempt_id}/submit",
                               json={"auto_submitted": False}, headers=headers, timeout=30)
            d2 = _detail(r2).lower()
            assert "debes adjuntar" not in d2, d2
        finally:
            await db.exam_attempts.delete_one({"id": attempt_id})
            await db.exam_questions.delete_one({"id": q_id})
            await db.online_exams.delete_one({"id": exam_id})

    asyncio.get_event_loop().run_until_complete(run())


def test_submit_gate_per_question_mode():
    token = _login("demo.reintento@elroble.edu", "Demo1234!")
    headers = {"Authorization": f"Bearer {token}"}

    async def run():
        c = AsyncIOMotorClient(MONGO)
        db = c[DBN]
        student = await db.users.find_one({"email": "demo.reintento@elroble.edu"})
        school = student["school_id"]
        exam_id = f"PYTEST-EV-PQ-{uuid.uuid4().hex[:6]}"
        attempt_id = str(uuid.uuid4())
        q1, q2 = str(uuid.uuid4()), str(uuid.uuid4())
        await db.online_exams.insert_one({
            "id": exam_id, "school_id": school, "type": "digital",
            "title": "PYTEST pq-gate", "status": "published",
            "allow_evidence_upload": True, "evidence_mode": "per_question",
            "total_points": 2,
        })
        await db.exam_questions.insert_many([
            {"id": q1, "exam_id": exam_id, "school_id": school, "order": 1,
             "question_type": "open", "question_text": "a", "points": 1},
            {"id": q2, "exam_id": exam_id, "school_id": school, "order": 2,
             "question_type": "open", "question_text": "b", "points": 1},
        ])
        await db.exam_attempts.insert_one({
            "id": attempt_id, "exam_id": exam_id, "school_id": school,
            "student_id": student["id"], "student_name": "Demo",
            "status": "in_progress", "answers": {}, "graded_answers": {},
            "start_time": "2026-06-01T09:00:00+00:00",
            "question_evidence": {q1: {"id": "e1", "file_name": "p1.jpg",
                                       "drive_file_id": "x", "storage_type": "google_drive"}},
        })
        try:
            # Falta evidencia en q2 → 400
            r1 = requests.post(f"{BASE}/api/exam-attempts/{attempt_id}/submit",
                               json={"auto_submitted": False}, headers=headers, timeout=30)
            assert r1.status_code == 400, r1.text
            assert "cada pregunta" in _detail(r1).lower(), _detail(r1)

            # Completar q2 → pasa el gate
            await db.exam_attempts.update_one(
                {"id": attempt_id},
                {"$set": {f"question_evidence.{q2}": {"id": "e2", "file_name": "p2.jpg",
                                                      "drive_file_id": "y", "storage_type": "google_drive"}}},
            )
            r2 = requests.post(f"{BASE}/api/exam-attempts/{attempt_id}/submit",
                               json={"auto_submitted": False}, headers=headers, timeout=30)
            d2 = _detail(r2).lower()
            assert "cada pregunta" not in d2, d2

            # Auto-submit (timer) NO debe bloquear aunque falte evidencia
            await db.exam_attempts.update_one(
                {"id": attempt_id}, {"$set": {"status": "in_progress"}, "$unset": {"question_evidence": ""}})
            r3 = requests.post(f"{BASE}/api/exam-attempts/{attempt_id}/submit",
                               json={"auto_submitted": True}, headers=headers, timeout=30)
            d3 = _detail(r3).lower()
            assert "cada pregunta" not in d3, d3
        finally:
            await db.exam_attempts.delete_one({"id": attempt_id})
            await db.exam_questions.delete_many({"id": {"$in": [q1, q2]}})
            await db.online_exams.delete_one({"id": exam_id})

    asyncio.get_event_loop().run_until_complete(run())
