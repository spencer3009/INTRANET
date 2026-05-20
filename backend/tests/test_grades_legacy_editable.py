"""
E2E test — Fase 2 del render legacy: edición + save de notas en formato
legacy aun cuando la plantilla activa del colegio es CUSTOM (dinámica).

Hits the live FastAPI backend via HTTP, mirroring what the frontend
does. Requires the supervisor backend to be running.

Escenario:
  - Colegio con plantilla custom activa + predeterminada.
  - Bimestre con docs `student_grades` en formato legacy: `grades_dynamic`
    vacío/ausente, campos planos poblados.
  - El profesor incorpora alumno nuevo y carga notas legacy.

Antes del fix: final_grade quedaba null porque el backend ruteaba al
algoritmo dinámico (que lee grades_dynamic vacío).
Después del fix: ruta al algoritmo legacy (template=None) sin migrar.
"""
import os
import sys
import uuid
import pytest
import pytest_asyncio
import httpx

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from motor.motor_asyncio import AsyncIOMotorClient


BACKEND_URL = "http://localhost:8001"
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"


@pytest_asyncio.fixture
async def db():
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    yield cli[os.environ["DB_NAME"]]
    cli.close()


@pytest_asyncio.fixture
async def token():
    async with httpx.AsyncClient() as cli:
        r = await cli.post(
            f"{BACKEND_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        r.raise_for_status()
        return r.json()["token"]


SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"      # El Roble (preview)
SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"     # Ciencias Naturales
SECTION_ID = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
PERIOD_ID = "093a0bee-92c4-449c-b82c-942f16847759"      # BIMESTRE I


@pytest.mark.asyncio
async def test_save_legacy_row_with_custom_template_recomputes_final_grade(db, token):
    """Core scenario: school has custom template active, row is in
    legacy format. Save legacy fields → final_grade computed via legacy
    weighted-average algorithm."""
    student_id = f"DUMMY_LEG_{uuid.uuid4().hex[:8]}"
    try:
        async with httpx.AsyncClient() as cli:
            r = await cli.post(
                f"{BACKEND_URL}/api/grades/save",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "subject_id": SUBJECT_ID,
                    "section_id": SECTION_ID,
                    "period_id": PERIOD_ID,
                    "grades": [{
                        "student_id": student_id,
                        "act_co": 15, "act_re": 16,
                        "rf_r1": 14, "rf_r2": 13, "rf_r3": 18,
                        "rf_r4": None, "rf_r5": None,
                        "comp_c1": 15, "comp_c2": 14,
                        "part_p1": 16, "part_p2": None, "part_p3": None,
                        "part_exp": None, "part_tg": None, "part_p": None,
                        "exam_mensual": 13, "exam_bimestral": 14,
                    }],
                },
                timeout=15.0,
            )
            assert r.status_code == 200, r.text
            assert r.json()["saved"] == 1

        doc = await db.student_grades.find_one({"student_id": student_id}, {"_id": 0})
        assert doc is not None
        assert doc["act_co"] == 15
        assert doc["rf_r1"] == 14
        assert doc["exam_bimestral"] == 14
        assert doc.get("final_grade") is not None, \
            f"final_grade must NOT be null for legacy row, got {doc.get('final_grade')}"
        # Expected ~14.8 with default weights.
        assert 14.5 <= doc["final_grade"] <= 15.1, \
            f"final_grade should be ~14.8, got {doc['final_grade']}"
    finally:
        await db.student_grades.delete_many({"student_id": student_id})


@pytest.mark.asyncio
async def test_save_dynamic_row_with_custom_template_still_uses_dynamic_branch(db, token):
    """When the entry has grades_dynamic, the dynamic branch must
    still drive final_grade (no hijack by the legacy fallback)."""
    student_id = f"DUMMY_DYN_{uuid.uuid4().hex[:8]}"
    try:
        # Discover an active subcol id for the school template.
        tpl = await db.registro_auxiliar_plantillas.find_one(
            {"school_id": SCHOOL_ID, "es_predeterminada": True, "estado": "activa"},
            {"_id": 0},
        )
        assert tpl, "Test prerequisite: active+default custom template"
        sub_ids = []
        for c in tpl.get("criterios", []):
            for s in c.get("subcolumnas", []):
                if s.get("tipo", "input") == "input":
                    sub_ids.append(s["id"])
        assert len(sub_ids) >= 2

        async with httpx.AsyncClient() as cli:
            r = await cli.post(
                f"{BACKEND_URL}/api/grades/save",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "subject_id": SUBJECT_ID,
                    "section_id": SECTION_ID,
                    "period_id": PERIOD_ID,
                    "grades": [{
                        "student_id": student_id,
                        "grades_dynamic": {sub_ids[0]: 16, sub_ids[1]: 14},
                    }],
                },
                timeout=15.0,
            )
            assert r.status_code == 200, r.text

        doc = await db.student_grades.find_one({"student_id": student_id}, {"_id": 0})
        assert doc["grades_dynamic"][sub_ids[0]] == 16
        assert doc["grades_dynamic"][sub_ids[1]] == 14
        # final = avg of (16, 14) = 15.0
        assert doc.get("final_grade") == 15.0, \
            f"Dynamic-branch final must be 15.0, got {doc.get('final_grade')}"
    finally:
        await db.student_grades.delete_many({"student_id": student_id})


@pytest.mark.asyncio
async def test_save_mixed_row_uses_dynamic_branch_not_legacy(db, token):
    """Hybrid: existing doc already has dynamic; entry sends only legacy.
    Legacy fallback must NOT kick in — dynamic still drives final."""
    student_id = f"DUMMY_MIX_{uuid.uuid4().hex[:8]}"
    try:
        tpl = await db.registro_auxiliar_plantillas.find_one(
            {"school_id": SCHOOL_ID, "es_predeterminada": True, "estado": "activa"},
            {"_id": 0},
        )
        sub_a = None
        for c in tpl.get("criterios", []):
            for s in c.get("subcolumnas", []):
                if s.get("tipo", "input") == "input":
                    sub_a = s["id"]; break
            if sub_a: break
        assert sub_a

        # Pre-seed: doc already has dynamic data.
        await db.student_grades.insert_one({
            "id": f"pre-{uuid.uuid4().hex[:6]}",
            "school_id": SCHOOL_ID, "student_id": student_id,
            "subject_id": SUBJECT_ID, "section_id": SECTION_ID, "period_id": PERIOD_ID,
            "grades_dynamic": {sub_a: 18.0},
        })

        async with httpx.AsyncClient() as cli:
            r = await cli.post(
                f"{BACKEND_URL}/api/grades/save",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "subject_id": SUBJECT_ID, "section_id": SECTION_ID, "period_id": PERIOD_ID,
                    "grades": [{"student_id": student_id, "act_co": 15, "rf_r1": 12}],
                },
                timeout=15.0,
            )
            assert r.status_code == 200, r.text

        doc = await db.student_grades.find_one({"student_id": student_id}, {"_id": 0})
        # Dynamic branch wins — final based on dynamic col only = 18.0.
        assert doc.get("final_grade") == 18.0, \
            f"Mixed-case final must come from dynamic branch (=18), got {doc.get('final_grade')}"
        # Legacy fields still persisted (data isn't lost).
        assert doc.get("act_co") == 15
        assert doc.get("rf_r1") == 12
    finally:
        await db.student_grades.delete_many({"student_id": student_id})
