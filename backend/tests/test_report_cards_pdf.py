"""
E2E tests — Report Cards PDF (Fase 3): switch + upload + list + download
+ delete + authZ. Hits live FastAPI via httpx.
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
SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"
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
        )
        r.raise_for_status()
        return r.json()["token"]


@pytest.mark.asyncio
async def test_get_settings_returns_default_generated(token):
    async with httpx.AsyncClient() as cli:
        r = await cli.get(f"{BACKEND_URL}/api/report-cards/settings",
                          headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["report_card_source"] in ("generated", "pdf_upload")
        assert "google_drive_connected" in data


@pytest.mark.asyncio
async def test_put_settings_round_trip(token, db):
    async with httpx.AsyncClient() as cli:
        try:
            # Set to pdf_upload
            r = await cli.put(
                f"{BACKEND_URL}/api/report-cards/settings",
                headers={"Authorization": f"Bearer {token}"},
                json={"report_card_source": "pdf_upload"},
            )
            assert r.status_code == 200
            assert r.json()["report_card_source"] == "pdf_upload"
            # Confirm persisted
            s = await db.schools.find_one({"id": SCHOOL_ID}, {"_id": 0, "report_card_source": 1})
            assert s["report_card_source"] == "pdf_upload"
            # Bad value rejected
            r = await cli.put(
                f"{BACKEND_URL}/api/report-cards/settings",
                headers={"Authorization": f"Bearer {token}"},
                json={"report_card_source": "invalid"},
            )
            assert r.status_code == 400
        finally:
            # Revert
            await cli.put(
                f"{BACKEND_URL}/api/report-cards/settings",
                headers={"Authorization": f"Bearer {token}"},
                json={"report_card_source": "generated"},
            )


@pytest.mark.asyncio
async def test_upload_without_drive_returns_409(token, db):
    """When Drive isn't connected, upload must fail with a clear 409
    instead of silently corrupting state."""
    student_id = f"DUMMY_RC_{uuid.uuid4().hex[:6]}"
    try:
        # Seed a student in `users` with role=student.
        await db.users.insert_one({
            "id": student_id, "school_id": SCHOOL_ID, "seccion_id": SECTION_ID,
            "role": "student", "name": "Test", "last_name": "Alumno",
            "is_active": True,
        })
        async with httpx.AsyncClient() as cli:
            files = {"file": ("libreta.pdf", b"%PDF-1.4 fake content", "application/pdf")}
            r = await cli.post(
                f"{BACKEND_URL}/api/report-cards/upload",
                headers={"Authorization": f"Bearer {token}"},
                data={"student_id": student_id, "period_id": PERIOD_ID, "section_id": SECTION_ID},
                files=files,
            )
            assert r.status_code == 409, r.text
            assert "drive" in r.text.lower()
    finally:
        await db.users.delete_many({"id": student_id})


@pytest.mark.asyncio
async def test_upload_rejects_non_pdf_extension(token, db):
    student_id = f"DUMMY_RC_{uuid.uuid4().hex[:6]}"
    try:
        await db.users.insert_one({
            "id": student_id, "school_id": SCHOOL_ID, "seccion_id": SECTION_ID,
            "role": "student", "name": "Test", "last_name": "Alumno",
            "is_active": True,
        })
        async with httpx.AsyncClient() as cli:
            files = {"file": ("notes.txt", b"hello", "text/plain")}
            r = await cli.post(
                f"{BACKEND_URL}/api/report-cards/upload",
                headers={"Authorization": f"Bearer {token}"},
                data={"student_id": student_id, "period_id": PERIOD_ID, "section_id": SECTION_ID},
                files=files,
            )
            assert r.status_code == 400, r.text
            assert "pdf" in r.text.lower()
    finally:
        await db.users.delete_many({"id": student_id})


@pytest.mark.asyncio
async def test_upload_rejects_files_over_10mb(token, db):
    student_id = f"DUMMY_RC_{uuid.uuid4().hex[:6]}"
    try:
        await db.users.insert_one({
            "id": student_id, "school_id": SCHOOL_ID, "seccion_id": SECTION_ID,
            "role": "student", "name": "Test", "last_name": "Alumno",
            "is_active": True,
        })
        # 10.5 MB synthetic content
        huge = b"%PDF-1.4 " + (b"X" * (10 * 1024 * 1024 + 500_000))
        async with httpx.AsyncClient() as cli:
            files = {"file": ("big.pdf", huge, "application/pdf")}
            r = await cli.post(
                f"{BACKEND_URL}/api/report-cards/upload",
                headers={"Authorization": f"Bearer {token}"},
                data={"student_id": student_id, "period_id": PERIOD_ID, "section_id": SECTION_ID},
                files=files,
                timeout=30.0,
            )
            assert r.status_code == 400, r.text
            assert "10" in r.text or "límite" in r.text.lower() or "mb" in r.text.lower()
    finally:
        await db.users.delete_many({"id": student_id})


@pytest.mark.asyncio
async def test_by_section_lists_real_students_in_users_collection(token, db):
    """Regression for the production bug: students live in `users` with
    role='student' and field `seccion_id`. Real section in preview has 36
    students — the endpoint must list them (>=1) and include known ones."""
    async with httpx.AsyncClient() as cli:
        r = await cli.get(
            f"{BACKEND_URL}/api/report-cards/by-section",
            headers={"Authorization": f"Bearer {token}"},
            params={"section_id": SECTION_ID, "period_id": PERIOD_ID},
        )
        assert r.status_code == 200
        d = r.json()
        assert "students" in d
        assert "drive_connected" in d
        # Section must have at least one real student.
        assert len(d["students"]) > 0, "by-section returned 0 students — fix likely regressed"
        # Each row has student_id + student_name + uploaded flag.
        row = d["students"][0]
        for key in ("student_id", "student_name", "uploaded"):
            assert key in row


@pytest.mark.asyncio
async def test_by_section_with_seeded_student(token, db):
    """Seed a synthetic student in the section and verify the endpoint
    surfaces them with uploaded=False."""
    student_id = f"DUMMY_RC_{uuid.uuid4().hex[:6]}"
    try:
        await db.users.insert_one({
            "id": student_id, "school_id": SCHOOL_ID, "seccion_id": SECTION_ID,
            "role": "student", "name": "ZZZTest", "last_name": "Lista",
            "is_active": True,
        })
        async with httpx.AsyncClient() as cli:
            r = await cli.get(
                f"{BACKEND_URL}/api/report-cards/by-section",
                headers={"Authorization": f"Bearer {token}"},
                params={"section_id": SECTION_ID, "period_id": PERIOD_ID},
            )
            assert r.status_code == 200
            d = r.json()
            ids = [s["student_id"] for s in d["students"]]
            assert student_id in ids
            row = next(s for s in d["students"] if s["student_id"] == student_id)
            assert row["uploaded"] is False
    finally:
        await db.users.delete_many({"id": student_id})


@pytest.mark.asyncio
async def test_student_endpoint_returns_empty_when_none(token):
    async with httpx.AsyncClient() as cli:
        r = await cli.get(
            f"{BACKEND_URL}/api/report-cards/student/nonexistent-student-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Admin/owner can query any student. Empty result is fine.
        assert r.status_code == 200
        assert r.json()["items"] == []


@pytest.mark.asyncio
async def test_unauthorized_user_cannot_change_settings():
    """A request without token must be rejected."""
    async with httpx.AsyncClient() as cli:
        r = await cli.put(
            f"{BACKEND_URL}/api/report-cards/settings",
            json={"report_card_source": "pdf_upload"},
        )
        # FastAPI auth dependency returns 401/403
        assert r.status_code in (401, 403)
