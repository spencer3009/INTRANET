"""
Pytest: GET /api/grades/register/{subject}/{section}/{period} surfaces
`final_grade_manual` in the PROM. BIMESTRAL column.

Bug P0 (Jun 2026 — CEP Científica Andahuaylas): el Consolidado mostraba notas
(14, 15...) pero el Registro Auxiliar salía TODO vacío (incluida la columna del
promedio final). Causa: el register GET solo devolvía `final_grade`, mientras
que el Consolidado prioriza `final_grade_manual` (notas cargadas vía el portal
"Notas del Profesor"). Fix: el register GET ahora resuelve el final con la misma
precedencia (final_grade_manual > final_grade > recompute custom template).

E2E contra el backend de preview (El Roble). Restaura los docs tocados.
"""
from __future__ import annotations
import asyncio
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


def test_register_surfaces_final_grade_manual():
    token = _login()
    headers = {"Authorization": f"Bearer {token}"}

    async def run():
        c = AsyncIOMotorClient(MONGO)
        db = c[DBN]
        school = (await db.users.find_one({"email": "admin@elroble.edu"}))["school_id"]
        period = await db.academic_periods.find_one({"school_id": school})
        student = await db.users.find_one(
            {"school_id": school, "role": "student", "seccion_id": {"$ne": None}})
        assert student, "Necesito un estudiante con seccion_id"
        sec = student["seccion_id"]
        subj = await db.subjects.find_one({"school_id": school, "section_id": sec, "status": "active"}) \
            or await db.subjects.find_one({"school_id": school, "status": "active"})
        sid, pid, stid = subj["id"], period["id"], student["id"]
        key = {"school_id": school, "subject_id": sid, "section_id": sec,
               "period_id": pid, "student_id": stid}
        orig = await db.student_grades.find_one(key)
        # seed manual-only row (no detail, no final_grade)
        await db.student_grades.update_one(
            key,
            {"$set": {**key, "final_grade_manual": 15.0, "final_grade": None},
             "$unset": {"act_co": "", "grades_dynamic": ""}},
            upsert=True)
        try:
            r = requests.get(f"{BASE}/api/grades/register/{sid}/{sec}/{pid}",
                             headers=headers, timeout=30).json()
            row = [s for s in r["students"] if s["student_id"] == stid]
            assert row, "El estudiante debe aparecer en el registro"
            assert row[0]["final_grade"] == 15.0, "PROM. BIMESTRAL debe reflejar final_grade_manual"
            assert row[0].get("final_grade_manual") == 15.0
        finally:
            if orig:
                await db.student_grades.replace_one(key, orig)
            else:
                await db.student_grades.delete_one(key)

    asyncio.get_event_loop().run_until_complete(run())
