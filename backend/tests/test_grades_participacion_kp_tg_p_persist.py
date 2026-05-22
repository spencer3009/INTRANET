"""
E2E test — Bug P0 fix verification: KP/TG/P columns (p4/p5/p6 in
SYSTEM template, with labels EXP/TG/P) must persist correctly when
the frontend overrides legacy_field_map to point p4→part_exp,
p5→part_tg, p6→part_p (which ARE in GRADE_SUB_FIELDS).

Also verifies P1/P2/P3 historical path still works AND that
final_grade reflects all 6 participaciones.
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

BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL_FOR_TESTS") or "http://localhost:8001"
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"

SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"
SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"
SECTION_ID = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
PERIOD_ID = "093a0bee-92c4-449c-b82c-942f16847759"


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
            timeout=15.0,
        )
        r.raise_for_status()
        return r.json()["token"]


@pytest.mark.asyncio
async def test_register_endpoint_returns_legacy_field_map(token):
    """Verify backend GET /api/grades/register returns legacy_field_map (regardless of
    what p4/p5/p6 map to). Frontend will override p4/p5/p6 with the patch."""
    async with httpx.AsyncClient() as cli:
        r = await cli.get(
            f"{BACKEND_URL}/api/grades/register/{SUBJECT_ID}/{SECTION_ID}/{PERIOD_ID}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20.0,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "students" in data
        assert isinstance(data.get("legacy_field_map"), dict)
        # We do NOT require p4/p5/p6 to be correct here — the frontend
        # patches them client-side. We only need the GET to expose the map.


@pytest.mark.asyncio
async def test_kp_tg_p_persist_in_part_exp_tg_p(db, token):
    """Simulate the frontend save AFTER the patch:
    KP/TG/P → part_exp/part_tg/part_p (not part_p4/p5/p6).
    Values must persist to those fields and final_grade must be computed."""
    student_id = f"TEST_KPTGP_{uuid.uuid4().hex[:8]}"
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
                        # KP/TG/P with frontend patch
                        "part_exp": 17,
                        "part_tg": 15,
                        "part_p": 13,
                    }],
                },
                timeout=15.0,
            )
            assert r.status_code == 200, r.text
            assert r.json()["saved"] == 1

        doc = await db.student_grades.find_one(
            {"student_id": student_id}, {"_id": 0}
        )
        assert doc is not None, "Doc not persisted"
        # Values must land in part_exp/part_tg/part_p (NOT in part_p4/p5/p6)
        assert doc.get("part_exp") == 17, f"part_exp expected 17, got {doc.get('part_exp')}"
        assert doc.get("part_tg") == 15, f"part_tg expected 15, got {doc.get('part_tg')}"
        assert doc.get("part_p") == 13, f"part_p expected 13, got {doc.get('part_p')}"
        # The ghost fields part_p4/p5/p6 must NOT be set (legacy filter dropped them)
        assert doc.get("part_p4") in (None, ), f"part_p4 leaked: {doc.get('part_p4')}"
        assert doc.get("part_p5") in (None, ), f"part_p5 leaked: {doc.get('part_p5')}"
        assert doc.get("part_p6") in (None, ), f"part_p6 leaked: {doc.get('part_p6')}"
    finally:
        await db.student_grades.delete_many({"student_id": student_id})


@pytest.mark.asyncio
async def test_regression_p1_p2_p3_still_persist(db, token):
    """REGRESION: P1/P2/P3 (mapping to part_p1/p2/p3) must still persist."""
    student_id = f"TEST_P123_{uuid.uuid4().hex[:8]}"
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
                        "part_p1": 18,
                        "part_p2": 16,
                        "part_p3": 14,
                    }],
                },
                timeout=15.0,
            )
            assert r.status_code == 200, r.text

        doc = await db.student_grades.find_one(
            {"student_id": student_id}, {"_id": 0}
        )
        assert doc is not None
        assert doc.get("part_p1") == 18
        assert doc.get("part_p2") == 16
        assert doc.get("part_p3") == 14
    finally:
        await db.student_grades.delete_many({"student_id": student_id})


@pytest.mark.asyncio
async def test_all_six_participations_persist_and_final_grade_computed(db, token):
    """All 6 participations (P1..P3, EXP, TG, P) must persist together
    and final_grade should be computed (not null)."""
    student_id = f"TEST_ALL6_{uuid.uuid4().hex[:8]}"
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
                        "part_p1": 18, "part_p2": 16, "part_p3": 14,
                        "part_exp": 17, "part_tg": 15, "part_p": 13,
                        # plus a few other criteria so final_grade can be computed
                        "act_co": 15, "act_re": 15,
                        "rf_r1": 14, "rf_r2": 14,
                        "comp_c1": 15, "comp_c2": 14,
                        "exam_mensual": 14, "exam_bimestral": 15,
                    }],
                },
                timeout=15.0,
            )
            assert r.status_code == 200, r.text

        doc = await db.student_grades.find_one(
            {"student_id": student_id}, {"_id": 0}
        )
        assert doc is not None
        # All 6 participation fields landed
        assert doc.get("part_p1") == 18
        assert doc.get("part_p2") == 16
        assert doc.get("part_p3") == 14
        assert doc.get("part_exp") == 17
        assert doc.get("part_tg") == 15
        assert doc.get("part_p") == 13
        # Final grade computed
        assert doc.get("final_grade") is not None, "final_grade should be computed"
        # Sanity range
        assert 10 <= float(doc["final_grade"]) <= 20
    finally:
        await db.student_grades.delete_many({"student_id": student_id})
