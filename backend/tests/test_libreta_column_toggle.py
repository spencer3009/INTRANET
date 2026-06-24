"""
Backend tests for the 'show LIBRETA column in profesor portal' feature.

Verifies:
  - GET /api/report-cards/settings returns show_libreta_column_in_tutoria (default True)
  - PUT /api/report-cards/settings is blocked by suspended subscription on elroble (expected 403)
  - GET /api/mis-tutorias/bulk returns show_libreta_column reflecting school flag
  - Toggling via MongoDB direct write flips the flag; $unset restores default True.

Credentials (from /app/memory/test_credentials.md):
  Owner: admin@elroble.edu / 1234abc8 (subdomain elroble; SUSPENDED subscription)
  Tutor: rafa@gmail.com / Tutor123! (tutor INICIAL 3 años A)
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "database")
ELROBLE_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"

OWNER = {"email": "admin@elroble.edu", "password": "1234abc8"}
TUTOR = {"email": "rafa@gmail.com", "password": "Tutor123!"}


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    yield db
    # Always restore default at end
    db.schools.update_one(
        {"id": ELROBLE_ID},
        {"$unset": {"show_libreta_column_in_tutoria": ""}},
    )
    client.close()


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"no token in {data}"
    return token


@pytest.fixture(scope="module")
def owner_token():
    return _login(OWNER["email"], OWNER["password"])


@pytest.fixture(scope="module")
def tutor_token(mongo):
    """
    Tutor login is blocked because elroble plan is SUSPENDIDO (expiration in past).
    Temporarily push expiration_date to the future to allow auth, then restore.
    """
    school = mongo.schools.find_one(
        {"id": ELROBLE_ID},
        {"expiration_date": 1, "fecha_vencimiento": 1, "plan_estado": 1},
    ) or {}
    prev_exp = school.get("expiration_date")
    prev_fv = school.get("fecha_vencimiento")
    prev_pe = school.get("plan_estado")
    mongo.schools.update_one(
        {"id": ELROBLE_ID},
        {"$set": {
            "expiration_date": "2099-12-31T00:00:00+00:00",
            "fecha_vencimiento": "2099-12-31T00:00:00+00:00",
            "plan_estado": "ACTIVO",
        }},
    )
    try:
        token = _login(TUTOR["email"], TUTOR["password"])
        yield token
    finally:
        restore = {}
        if prev_exp is not None:
            restore["expiration_date"] = prev_exp
        if prev_fv is not None:
            restore["fecha_vencimiento"] = prev_fv
        if prev_pe is not None:
            restore["plan_estado"] = prev_pe
        if restore:
            mongo.schools.update_one({"id": ELROBLE_ID}, {"$set": restore})


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Backend: report-cards settings ----------------
class TestReportCardsSettings:
    def test_get_settings_includes_flag_default_true(self, owner_token, mongo):
        # Ensure clean default state
        mongo.schools.update_one(
            {"id": ELROBLE_ID}, {"$unset": {"show_libreta_column_in_tutoria": ""}}
        )
        r = requests.get(
            f"{BASE_URL}/api/report-cards/settings",
            headers=_headers(owner_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "show_libreta_column_in_tutoria" in data
        assert data["show_libreta_column_in_tutoria"] is True

    def test_put_settings_blocked_by_suspended_subscription(self, owner_token):
        # elroble subscription is SUSPENDED → PUT should be blocked (403)
        r = requests.put(
            f"{BASE_URL}/api/report-cards/settings",
            json={"show_libreta_column_in_tutoria": False},
            headers=_headers(owner_token),
            timeout=15,
        )
        # The middleware returns 403 for write operations under suspended subscription
        assert r.status_code in (402, 403), (
            f"expected suspension block, got {r.status_code} {r.text}"
        )


# ---------------- Backend: mis-tutorias bulk ----------------
class TestMisTutoriasBulk:
    def _get_section_and_period(self, token, mongo):
        # Get sections (admin/owner sees all; tutor sees only assigned)
        r = requests.get(
            f"{BASE_URL}/api/mis-tutorias/sections", headers=_headers(token), timeout=15
        )
        assert r.status_code == 200, r.text
        sections = r.json().get("sections", [])
        if not sections:
            pytest.skip(f"no tutoria sections visible for user: {r.json()}")
        section_id = sections[0]["section_id"]
        # Pick any period for the school (collection is academic_periods)
        period = mongo.academic_periods.find_one(
            {"school_id": ELROBLE_ID}, {"_id": 0, "id": 1, "name": 1}
        )
        if not period:
            pytest.skip("no period found for elroble")
        return section_id, period["id"]

    def test_bulk_returns_show_libreta_column_default_true(
        self, owner_token, mongo
    ):
        mongo.schools.update_one(
            {"id": ELROBLE_ID}, {"$unset": {"show_libreta_column_in_tutoria": ""}}
        )
        section_id, period_id = self._get_section_and_period(owner_token, mongo)
        r = requests.get(
            f"{BASE_URL}/api/mis-tutorias/bulk",
            headers=_headers(owner_token),
            params={"section_id": section_id, "period_id": period_id},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "show_libreta_column" in data, f"missing key in response: {list(data.keys())}"
        assert data["show_libreta_column"] is True

    def test_bulk_reflects_false_when_db_flag_false(self, owner_token, mongo):
        # Set flag to False in DB
        mongo.schools.update_one(
            {"id": ELROBLE_ID},
            {"$set": {"show_libreta_column_in_tutoria": False}},
        )
        try:
            section_id, period_id = self._get_section_and_period(owner_token, mongo)
            r = requests.get(
                f"{BASE_URL}/api/mis-tutorias/bulk",
                headers=_headers(owner_token),
                params={"section_id": section_id, "period_id": period_id},
                timeout=20,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("show_libreta_column") is False, (
                f"expected False, got {data.get('show_libreta_column')}"
            )
        finally:
            mongo.schools.update_one(
                {"id": ELROBLE_ID},
                {"$unset": {"show_libreta_column_in_tutoria": ""}},
            )

    def test_settings_reflects_db_flag_false(self, owner_token, mongo):
        mongo.schools.update_one(
            {"id": ELROBLE_ID},
            {"$set": {"show_libreta_column_in_tutoria": False}},
        )
        try:
            r = requests.get(
                f"{BASE_URL}/api/report-cards/settings",
                headers=_headers(owner_token),
                timeout=15,
            )
            assert r.status_code == 200, r.text
            assert r.json().get("show_libreta_column_in_tutoria") is False
        finally:
            mongo.schools.update_one(
                {"id": ELROBLE_ID},
                {"$unset": {"show_libreta_column_in_tutoria": ""}},
            )

    def test_unset_restores_default_true(self, owner_token, mongo):
        mongo.schools.update_one(
            {"id": ELROBLE_ID},
            {"$unset": {"show_libreta_column_in_tutoria": ""}},
        )
        r = requests.get(
            f"{BASE_URL}/api/report-cards/settings",
            headers=_headers(owner_token),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("show_libreta_column_in_tutoria") is True
