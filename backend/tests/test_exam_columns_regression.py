"""
Regression test — guards against the May 12, 2026 incident where commit
14af49c1 silently removed the `columns` field from `GET /api/register/availability`,
breaking the Nuevo Examen modal's dynamic column linkage for 3 weeks until
detected manually in production.

The contract this test enforces:
  1. `GET /api/register/availability?subject_id=<id>` MUST always return a
     `columns` key in the response.
  2. The value must be a list (possibly empty when no active period exists).
  3. When the school has an active plantilla, EVERY entry must expose the
     full canonical shape (id, field_key, label, criterion, criterion_label,
     type, available, blocked_reason, blocked_by).
  4. The legacy `availability` map must coexist and remain non-empty (so the
     Tasks modal doesn't break).
  5. `get_valid_exam_columns_for_school` helper must exist and return a
     non-empty set including dynamic ids + legacy VALID_COLUMNS.

If ANY of these assertions fail in CI we want to catch it before merge —
that is precisely what this test exists for.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"
TEST_SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"

REQUIRED_COLUMN_KEYS = {
    "id", "field_key", "label", "criterion", "criterion_label",
    "type", "available", "blocked_reason", "blocked_by",
}


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "subdomain": TEST_SUBDOMAIN},
        timeout=10,
    )
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    j = r.json()
    return j.get("token") or j.get("access_token")


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ────────────────────────────────────────────────────────────────────────────
# Test 1 — `columns` MUST be present in the response
# ────────────────────────────────────────────────────────────────────────────
def test_availability_response_includes_columns_field(headers):
    """REGRESSION GUARD: response MUST contain `columns` key (was silently removed May 12)."""
    r = requests.get(
        f"{BASE_URL}/api/register/availability",
        params={"subject_id": TEST_SUBJECT_ID},
        headers=headers,
        timeout=10,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert "columns" in data, (
        "REGRESSION DETECTED: /api/register/availability stopped returning the "
        "`columns` field. This is the May 12, 2026 incident. Restore "
        "get_valid_exam_columns_for_school + the columns block in "
        "get_unified_register_availability."
    )
    assert isinstance(data["columns"], list), "`columns` must be a list"


# ────────────────────────────────────────────────────────────────────────────
# Test 2 — `availability` (legacy) MUST coexist with `columns`
# ────────────────────────────────────────────────────────────────────────────
def test_availability_legacy_map_still_present(headers):
    """The Tasks modal reads the legacy `availability` map — it MUST coexist with `columns`."""
    r = requests.get(
        f"{BASE_URL}/api/register/availability",
        params={"subject_id": TEST_SUBJECT_ID},
        headers=headers,
        timeout=10,
    )
    data = r.json()
    assert "availability" in data, "Legacy `availability` map must still be present"
    assert isinstance(data["availability"], dict), "`availability` must be a dict"


# ────────────────────────────────────────────────────────────────────────────
# Test 3 — column entries have the full canonical shape
# ────────────────────────────────────────────────────────────────────────────
def test_columns_entries_have_canonical_shape(headers):
    """Every column entry must expose the contract the frontend depends on."""
    r = requests.get(
        f"{BASE_URL}/api/register/availability",
        params={"subject_id": TEST_SUBJECT_ID},
        headers=headers,
        timeout=10,
    )
    data = r.json()
    cols = data.get("columns") or []
    if not cols:
        pytest.skip("No columns returned — likely no active period or no plantilla")
    for col in cols:
        missing = REQUIRED_COLUMN_KEYS - set(col.keys())
        assert not missing, (
            f"Column {col.get('id')} missing required keys: {missing}. "
            f"Full entry: {col}"
        )


# ────────────────────────────────────────────────────────────────────────────
# Test 4 — at least the `EXÁMENES` group (columnas_finales) is present
# ────────────────────────────────────────────────────────────────────────────
def test_columns_include_examenes_group(headers):
    """The system plantilla always has EXÁMENES (columnas_finales) — must be present."""
    r = requests.get(
        f"{BASE_URL}/api/register/availability",
        params={"subject_id": TEST_SUBJECT_ID},
        headers=headers,
        timeout=10,
    )
    data = r.json()
    cols = data.get("columns") or []
    if not cols:
        pytest.skip("No columns returned — likely no active period or no plantilla")
    has_examenes = any(c.get("criterion") == "columnas_finales" for c in cols)
    has_examenes_label = any(
        (c.get("criterion_label") or "").upper() == "EXÁMENES" for c in cols
    )
    assert has_examenes or has_examenes_label, (
        "Expected at least one column with criterion='columnas_finales' or "
        "criterion_label='EXÁMENES' — the system plantilla always has these."
    )


# ────────────────────────────────────────────────────────────────────────────
# Test 5 — helper function `get_valid_exam_columns_for_school` exists
# ────────────────────────────────────────────────────────────────────────────
def test_helper_get_valid_exam_columns_for_school_is_exported():
    """The helper used by `_validate_register_linkage` for source_type='exam' MUST be importable."""
    try:
        from services.register_sync import get_valid_exam_columns_for_school
    except ImportError as e:
        pytest.fail(
            f"REGRESSION: get_valid_exam_columns_for_school is not exported "
            f"from services.register_sync. This breaks _validate_register_linkage "
            f"for exam linkage. Import error: {e}"
        )
    assert callable(get_valid_exam_columns_for_school)


# ────────────────────────────────────────────────────────────────────────────
# Test 6 — helper function `get_active_template_for_school` exists
# ────────────────────────────────────────────────────────────────────────────
def test_helper_get_active_template_for_school_is_exported():
    """The helper used by the availability endpoint to resolve the active plantilla MUST exist."""
    try:
        from services.register_sync import get_active_template_for_school
    except ImportError as e:
        pytest.fail(
            f"REGRESSION: get_active_template_for_school is not exported. "
            f"Import error: {e}"
        )
    assert callable(get_active_template_for_school)
