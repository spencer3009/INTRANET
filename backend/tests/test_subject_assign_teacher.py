"""
Pytest: POST /api/subjects/{subject_id}/assign-teacher

Feature (Jun 2026): "Asignar docente" desde el menú de 3 puntos en la página
de Asignaturas. Crea un academic_assignments (fuente de verdad de
`primary_teacher`) derivando level/grade/section de la propia asignatura.

E2E contra el backend de preview (El Roble). Limpia los datos creados.
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


@pytest.fixture(scope="module")
def ctx():
    token = _login()
    headers = {"Authorization": f"Bearer {token}"}
    subs = requests.get(f"{BASE}/api/academic/subjects", headers=headers, timeout=30).json()
    free = [s for s in subs if s.get("section_id") and s.get("status") == "active" and not s.get("primary_teacher")]
    assert free, "Necesito una asignatura activa con sección y sin docente"
    subject = free[0]
    teachers = requests.get(f"{BASE}/api/users/teachers/active", headers=headers, timeout=30).json()
    assert teachers, "Necesito al menos un docente activo"
    yield {"headers": headers, "subject": subject, "teacher": teachers[0]}
    # cleanup
    async def _clean():
        c = AsyncIOMotorClient(MONGO)
        await c[DBN].academic_assignments.delete_many(
            {"subject_id": subject["id"], "teacher_id": teachers[0]["id"]})
    asyncio.get_event_loop().run_until_complete(_clean())


def test_assign_then_reflects_primary_teacher(ctx):
    h, subj, t = ctx["headers"], ctx["subject"], ctx["teacher"]
    r = requests.post(f"{BASE}/api/subjects/{subj['id']}/assign-teacher",
                      json={"teacher_id": t["id"], "role": "titular"}, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["teacher"]["id"] == t["id"]
    # primary_teacher must now be set on the subjects listing
    subs = requests.get(f"{BASE}/api/academic/subjects", headers=h, timeout=30).json()
    updated = [s for s in subs if s["id"] == subj["id"]][0]
    assert updated.get("primary_teacher") and updated["primary_teacher"]["id"] == t["id"]


def test_assign_is_idempotent(ctx):
    h, subj, t = ctx["headers"], ctx["subject"], ctx["teacher"]
    r = requests.post(f"{BASE}/api/subjects/{subj['id']}/assign-teacher",
                      json={"teacher_id": t["id"], "role": "titular"}, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    assert "ya estaba" in r.json()["message"].lower()


def test_assign_unknown_teacher_404(ctx):
    h, subj = ctx["headers"], ctx["subject"]
    r = requests.post(f"{BASE}/api/subjects/{subj['id']}/assign-teacher",
                      json={"teacher_id": "does-not-exist", "role": "titular"}, headers=h, timeout=30)
    assert r.status_code == 404
