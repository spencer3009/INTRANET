# -*- coding: utf-8 -*-
"""
Regression tests — Fase 2 Libreta · Turno A

Cubre los helpers nuevos y el endpoint principal.
Ejecutar:  cd /app/backend && python3 -m pytest tests/test_libreta_phase2_turno_a.py -v
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from services.libreta_format import format_section_libreta
from services.ranking import compute_ranking
from services.attendance_summary import summary_by_period


# ─── format_section_libreta ────────────────────────────────────────────────

@pytest.mark.parametrize("grado,seccion,nivel,esperado", [
    ("5 años", "A", "Inicial", "5 AÑOS A INICIAL"),
    ("3 años", "A", "Inicial", "3 AÑOS A INICIAL"),
    ("1°", "A", "Primaria", "1ER GRADO A PRIMARIA"),
    ("6°", "A", "Primaria", "6TO GRADO A PRIMARIA"),
    ("1°", "A", "Secundaria", "1ER AÑO A SECUNDARIA"),
    ("2°", "B", "Secundaria", "2DO AÑO B SECUNDARIA"),
    ("3°", "A", "Secundaria", "3ER AÑO A SECUNDARIA"),
    ("4°", "A", "Secundaria", "4TO AÑO A SECUNDARIA"),
    ("5°", "C", "Secundaria", "5TO AÑO C SECUNDARIA"),
])
def test_format_section_libreta(grado, seccion, nivel, esperado):
    out = format_section_libreta({"nombre": grado}, {"nombre": seccion}, {"nombre": nivel})
    assert out == esperado, f"{grado} {seccion} {nivel}: esperado {esperado!r} got {out!r}"


def test_format_section_libreta_fallback():
    """Grado fuera de 1-6 hace fallback genérico uppercase."""
    out = format_section_libreta({"nombre": "7°"}, {"nombre": "A"}, {"nombre": "Otro"})
    assert out == "7° A OTRO"


def test_format_section_libreta_inicial_sin_numero():
    out = format_section_libreta({"nombre": "Pre-K"}, {"nombre": "A"}, {"nombre": "Inicial"})
    assert "INICIAL" in out


# ─── compute_ranking (data real El Roble preview) ───────────────────────────

EL_ROBLE_SCHOOL = "b9f27249-6568-49ae-94d3-e1f16750d7d9"
EL_ROBLE_SECTION = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
EL_ROBLE_PERIOD_I = "093a0bee-92c4-449c-b82c-942f16847759"


@pytest.fixture(scope="module")
def mongo_settings():
    return (
        os.environ.get("MONGO_URL", "mongodb://localhost:27017"),
        os.environ.get("DB_NAME", "database"),
    )


def _run(coro_fn):
    """Run an async function with a fresh Motor client to avoid loop reuse."""
    async def _wrapper():
        from motor.motor_asyncio import AsyncIOMotorClient as _C
        url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        name = os.environ.get("DB_NAME", "database")
        client = _C(url)
        try:
            return await coro_fn(client[name])
        finally:
            client.close()
    return asyncio.run(_wrapper())


def test_compute_ranking_returns_all_students(mongo_settings):
    res = _run(lambda db: compute_ranking(db, EL_ROBLE_SCHOOL, EL_ROBLE_SECTION, EL_ROBLE_PERIOD_I))
    assert isinstance(res, dict)
    assert len(res) >= 1


def test_compute_ranking_top1_consistency(mongo_settings):
    """El #1 debe ser Acuña Peralta Cesar con puntaje 13 (data real preview)."""
    res = _run(lambda db: compute_ranking(db, EL_ROBLE_SCHOOL, EL_ROBLE_SECTION, EL_ROBLE_PERIOD_I))
    ranked = sorted(
        [(sid, info) for sid, info in res.items() if info["orden_merito"]],
        key=lambda kv: kv[1]["orden_merito"],
    )
    assert len(ranked) >= 1
    top = ranked[0][1]
    assert top["orden_merito"] == 1
    assert top["puntaje"] == 13
    assert top["promedio"] == 13.0
    assert top["tercio"] in ("SUP", "MED", "INF")


def test_compute_ranking_students_without_grades(mongo_settings):
    res = _run(lambda db: compute_ranking(db, EL_ROBLE_SCHOOL, EL_ROBLE_SECTION, EL_ROBLE_PERIOD_I))
    sin_notas = [info for info in res.values() if info["puntaje"] is None]
    for info in sin_notas:
        assert info["orden_merito"] is None
        assert info["tercio"] is None
        assert info["promedio"] is None
        assert info["cursos_desaprobados"] == 0


# ─── attendance_summary ────────────────────────────────────────────────────

def test_attendance_summary_zero_for_nonexistent_student(mongo_settings):
    out = _run(lambda db: summary_by_period(db, EL_ROBLE_SCHOOL, "FAKE_ID", EL_ROBLE_PERIOD_I))
    assert out == {"presente": 0, "tardanza": 0, "falta": 0, "justificada": 0}


def test_attendance_summary_returns_4_buckets(mongo_settings):
    MAGNO = "4d30c475-c1cf-42d1-9485-620b556ecf72"
    out = _run(lambda db: summary_by_period(db, EL_ROBLE_SCHOOL, MAGNO, EL_ROBLE_PERIOD_I))
    assert set(out.keys()) == {"presente", "tardanza", "falta", "justificada"}
    for v in out.values():
        assert isinstance(v, int)
        assert v >= 0
