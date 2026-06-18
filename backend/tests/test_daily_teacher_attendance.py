"""
Tests para el reporte diario premium de asistencia de profesores
(endpoint GET /api/asistencia/profesores?fecha=YYYY-MM-DD).

Valida:
- Helpers _hhmm_to_minutes / _initials.
- Estructura de respuesta (resumen + profesores con las 7 columnas).
- Lógica de estados (Ausente / Tardanza) contra datos reales del seed.
"""
import os
import pytest
import httpx

from routes.attendance import _hhmm_to_minutes, _initials, TOLERANCIA_TARDANZA_MIN

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"


def test_hhmm_to_minutes():
    assert _hhmm_to_minutes("07:15") == 7 * 60 + 15
    assert _hhmm_to_minutes("00:00") == 0
    assert _hhmm_to_minutes("19:01") == 19 * 60 + 1
    assert _hhmm_to_minutes(None) is None
    assert _hhmm_to_minutes("abc") is None


def test_initials():
    assert _initials("Velasquez Romero Sonia") == "VS"
    assert _initials("Castillo") == "CA"
    assert _initials("") == "P"


def test_tolerancia_constante():
    assert TOLERANCIA_TARDANZA_MIN == 10


def _login():
    r = httpx.post(f"{API}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data.get("token") or data.get("access_token")


def test_endpoint_structure_and_states():
    token = _login()
    headers = {"Authorization": f"Bearer {token}"}

    # Día sin marcaciones -> todos Ausente
    r = httpx.get(f"{API}/api/asistencia/profesores", params={"fecha": "2026-06-18"}, headers=headers, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"fecha", "resumen", "profesores"}
    assert set(body["resumen"].keys()) == {"total", "completos", "tardanzas", "ausentes", "justificados"}
    assert body["resumen"]["total"] == len(body["profesores"])
    # Sin marcaciones: ausentes == total
    assert body["resumen"]["ausentes"] == body["resumen"]["total"]

    # Cada profesor expone las columnas de la tabla
    for p in body["profesores"]:
        assert {"id", "nombre", "iniciales", "tipo", "horario_inicio",
                "horario_fin", "entrada", "salida", "minutos_trabajados", "estado"} <= set(p.keys())
        assert p["tipo"] == "Profesor"

    # Día con una marcación tardía conocida (entrada 19:01 vs inicio 07:15)
    r2 = httpx.get(f"{API}/api/asistencia/profesores", params={"fecha": "2026-05-19"}, headers=headers, timeout=30)
    assert r2.status_code == 200
    body2 = r2.json()
    assert body2["resumen"]["tardanzas"] >= 1
    late_rows = [p for p in body2["profesores"] if p["estado"] == "Tardanza"]
    assert len(late_rows) >= 1
    assert any(p["entrada"] for p in late_rows)
