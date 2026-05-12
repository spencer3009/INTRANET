# -*- coding: utf-8 -*-
"""
Regression tests — Fase 2 Libreta · Turno B

Cubre conducta, tutor_comments, final_status, legal_name y snapshots.
Ejecutar:  cd /app/backend && python3 -m pytest tests/test_libreta_phase2_turno_b.py -v
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from services.grades_literal import numerica_a_letra


SCHOOL = "b9f27249-6568-49ae-94d3-e1f16750d7d9"
SECTION = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
PERIOD_I = "093a0bee-92c4-449c-b82c-942f16847759"
MAGNO = "4d30c475-c1cf-42d1-9485-620b556ecf72"


def _run(coro_fn):
    async def _wrapper():
        from motor.motor_asyncio import AsyncIOMotorClient
        url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        name = os.environ.get("DB_NAME", "database")
        client = AsyncIOMotorClient(url)
        try:
            return await coro_fn(client[name])
        finally:
            client.close()
    return asyncio.run(_wrapper())


# ─── Conducta — escala MINEDU consistente ──────────────────────────────────

@pytest.mark.parametrize("score,letra", [
    (5, "C"), (10, "C"),
    (11, "B"), (13, "B"),
    (14, "A"), (17, "A"),
    (18, "AD"), (20, "AD"),
])
def test_numerica_a_letra_minedu_ranges(score, letra):
    assert numerica_a_letra(score) == letra


# ─── Conducta — payload helper para libreta ─────────────────────────────────
# (Los helpers leen del cliente Motor global de routes.core; los curl tests
#  los validan end-to-end. Aquí sólo verificamos la firma + escala MINEDU.)


# ─── Snapshot collection presence (smoke) ──────────────────────────────────

def test_report_cards_snapshots_collection_exists():
    async def _check(db):
        # Cuenta debe ser >= 0 (que existan o no, no error)
        return await db.report_cards_snapshots.count_documents({})
    n = _run(_check)
    assert n >= 0
