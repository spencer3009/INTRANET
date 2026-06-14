"""
Pytest: control de acceso (corrección de fuga reportada Jun 2026).

Bug reportado: alumnos accedían desde el portal a notas de toda la sección y a
notificaciones administrativas (matrícula) de otras familias.

Causa raíz:
  1. Endpoints de notas en grades.py solo restringían al rol 'teacher'; el rol
     'student'/'parent' caía fuera y accedía (lectura y escritura).
  2. GET /notifications/all devolvía notificaciones con `subject_id == None`
     (incluyendo las personales/matrícula de OTROS usuarios) a cualquiera.

Fix:
  - _deny_students() bloquea student/parent en endpoints de notas + /register/availability.
  - /notifications/all filtra: cursos del usuario + personales del propio user_id
    + broadcasts reales (sin destinatario). Nunca avisos de otros usuarios.

E2E contra el backend de preview. Usa cuentas demo.
"""
from __future__ import annotations
import pytest
import requests


def _env(path, key):
    for line in open(path):
        line = line.strip()
        if line.startswith(key + "="):
            return line.split("=", 1)[1]
    return None


BASE = _env("/app/frontend/.env", "REACT_APP_BACKEND_URL").rstrip("/")

# Datos reales de la sección/curso/periodo del colegio demo (El Roble)
SUBJECT = "aefeda33-713a-4492-8d12-d680a2cdf1fb"
SECTION = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
PERIOD = "093a0bee-92c4-449c-b82c-942f16847759"
STUDENT_ID = "DEMO-RETAKE-STUDENT"


def _login(email, password):
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


@pytest.fixture(scope="module")
def student_headers():
    return {"Authorization": f"Bearer {_login('demo.reintento@elroble.edu', 'Demo1234!')}"}


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login('admin@elroble.edu', '1234abc8')}"}


def test_student_blocked_from_grade_reads(student_headers):
    endpoints = [
        f"/api/grades/consolidated/{SECTION}/{PERIOD}",
        f"/api/grades/register/{SUBJECT}/{SECTION}/{PERIOD}",
        f"/api/grades/config/{SUBJECT}/{SECTION}",
        f"/api/register/availability?subject_id={SUBJECT}",
    ]
    for ep in endpoints:
        r = requests.get(f"{BASE}{ep}", headers=student_headers, timeout=30)
        assert r.status_code == 403, f"{ep} devolvió {r.status_code} (esperado 403)"


def test_student_blocked_from_grade_writes(student_headers):
    # Guardar notas
    r = requests.post(
        f"{BASE}/api/grades/save",
        json={"subject_id": SUBJECT, "section_id": SECTION, "period_id": PERIOD, "grades": []},
        headers=student_headers, timeout=30,
    )
    assert r.status_code == 403, f"save devolvió {r.status_code} (esperado 403)"


def test_student_notifications_have_no_foreign_items(student_headers):
    r = requests.get(f"{BASE}/api/notifications/all?limit=50", headers=student_headers, timeout=30)
    assert r.status_code == 200, r.text
    notifs = r.json().get("notifications", [])
    foreign = [n for n in notifs if n.get("user_id") and n.get("user_id") != STUDENT_ID]
    assert not foreign, f"La campana del alumno aún muestra {len(foreign)} avisos ajenos: " \
                        f"{[n.get('title') for n in foreign[:5]]}"


def test_admin_still_has_access(admin_headers):
    for ep in [
        f"/api/grades/consolidated/{SECTION}/{PERIOD}",
        f"/api/grades/register/{SUBJECT}/{SECTION}/{PERIOD}",
    ]:
        r = requests.get(f"{BASE}{ep}", headers=admin_headers, timeout=30)
        assert r.status_code == 200, f"{ep} devolvió {r.status_code} para admin (esperado 200)"
