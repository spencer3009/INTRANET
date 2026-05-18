"""Sprint C - Backend tests for curricular areas scope_grade_ids (area-level scope).

Validates the new fields `scope_grade_ids` and `scope_label` on:
- GET /api/curricular-areas?include_inactive=true
- POST /api/curricular-areas (with scope_grade_ids)
- PUT /api/curricular-areas/{id} (3 cases: null/[ ]/[g1,g2])
- POST with scope_grade_ids=[] creates a global area

Cleanup: all areas created here are prefixed TEST_ and archived (soft-delete) at end.
"""
import os
import uuid as _uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://teacher-grades-fix.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token") or data.get("jwt")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def client(auth_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def shortcuts(client):
    r = client.get(f"{BASE_URL}/api/curricular-areas/grade-shortcuts", timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def created_areas(client):
    """Track area ids created during tests for teardown."""
    ids = []
    yield ids
    # Cleanup: soft-delete each test area
    for aid in ids:
        try:
            client.delete(f"{BASE_URL}/api/curricular-areas/{aid}", timeout=30)
        except Exception:
            pass


# ── TEST 1: List returns scope_grade_ids + scope_label ──────────────────────
class TestListScopeFields:
    def test_list_includes_scope_fields(self, client):
        r = client.get(f"{BASE_URL}/api/curricular-areas?include_inactive=true", timeout=30)
        assert r.status_code == 200, r.text
        areas = r.json()
        assert isinstance(areas, list) and len(areas) > 0
        for a in areas:
            assert "scope_grade_ids" in a, f"Missing scope_grade_ids in {a.get('name')}"
            assert "scope_label" in a, f"Missing scope_label in {a.get('name')}"
            assert isinstance(a["scope_grade_ids"], list)
            assert isinstance(a["scope_label"], str)

    def test_minedu_areas_are_global(self, client):
        """The 10 MINEDU default areas should have scope_grade_ids=[] and label 'Global (todos los grados)'."""
        r = client.get(f"{BASE_URL}/api/curricular-areas?include_inactive=true", timeout=30)
        assert r.status_code == 200
        areas = r.json()
        minedu_names = {
            "Comunicación", "Matemática", "Inglés", "Ciencia y Tecnología",
            "Ciencias Sociales", "Desarrollo Personal, Ciudadanía y Cívica",
            "Educación Religiosa", "Educación Física", "Arte y Cultura",
            "Educación para el Trabajo",
        }
        found = [a for a in areas if a["name"] in minedu_names]
        assert len(found) >= 1, "No MINEDU areas found"
        for a in found:
            assert a["scope_grade_ids"] == [], f"{a['name']} has non-empty scope: {a['scope_grade_ids']}"
            assert a["scope_label"] == "Global (todos los grados)", f"{a['name']} label: {a['scope_label']}"


# ── TEST 2: POST with scope_grade_ids creates scoped area ───────────────────
class TestCreateScopedArea:
    def test_create_with_scope_returns_label(self, client, shortcuts, created_areas):
        grades = shortcuts["grades"]
        if len(grades) < 2:
            pytest.skip("Not enough grades")
        # pick 2 grades of same level
        from collections import defaultdict
        by_lvl = defaultdict(list)
        for g in grades:
            by_lvl[g["level_name"]].append(g)
        target_grades = next((v for v in by_lvl.values() if len(v) >= 2), None)
        assert target_grades, "No level with 2+ grades"
        gids = [g["id"] for g in target_grades[:2]]
        payload = {
            "name": f"TEST_SC_Scoped_{_uuid.uuid4().hex[:6]}",
            "order": 99,
            "color": "#FF5733",
            "scope_grade_ids": gids,
        }
        r = client.post(f"{BASE_URL}/api/curricular-areas", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        created_areas.append(data["id"])
        assert data["scope_grade_ids"] == gids
        # Verify persistence via GET
        r2 = client.get(f"{BASE_URL}/api/curricular-areas?include_inactive=true", timeout=30)
        a = next((x for x in r2.json() if x["id"] == data["id"]), None)
        assert a, "Created area not in list"
        assert a["scope_grade_ids"] == gids
        # Scope label should include level name and grade names
        lvl = target_grades[0]["level_name"]
        assert lvl in a["scope_label"], f"Label missing level: {a['scope_label']}"
        assert " a " in a["scope_label"] or "·" in a["scope_label"], f"Unexpected label format: {a['scope_label']}"


# ── TEST 3: PUT with scope_grade_ids — 3 cases ──────────────────────────────
class TestUpdateScope:
    def test_update_scope_three_cases(self, client, shortcuts, created_areas):
        grades = shortcuts["grades"]
        if len(grades) < 2:
            pytest.skip("Not enough grades")
        # Create scoped area
        gid1 = grades[0]["id"]
        gid2 = grades[1]["id"]
        payload = {"name": f"TEST_SC_PUT_{_uuid.uuid4().hex[:6]}", "scope_grade_ids": [gid1]}
        r = client.post(f"{BASE_URL}/api/curricular-areas", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        aid = r.json()["id"]
        created_areas.append(aid)

        # CASE A: null → no tocar (only update name)
        r1 = client.put(f"{BASE_URL}/api/curricular-areas/{aid}", json={"name": payload["name"] + "_v2"}, timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.json()["scope_grade_ids"] == [gid1], "Scope should be unchanged when not provided"

        # CASE B: [] → volver a global
        r2 = client.put(f"{BASE_URL}/api/curricular-areas/{aid}", json={"scope_grade_ids": []}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json()["scope_grade_ids"] == []
        # Verify label is now global
        rl = client.get(f"{BASE_URL}/api/curricular-areas?include_inactive=true", timeout=30)
        a = next(x for x in rl.json() if x["id"] == aid)
        assert a["scope_label"] == "Global (todos los grados)"

        # CASE C: [gid1, gid2] → new scope
        r3 = client.put(f"{BASE_URL}/api/curricular-areas/{aid}", json={"scope_grade_ids": [gid1, gid2]}, timeout=30)
        assert r3.status_code == 200, r3.text
        assert set(r3.json()["scope_grade_ids"]) == {gid1, gid2}


# ── TEST 4: POST with scope_grade_ids=[] creates global area ────────────────
class TestCreateGlobalArea:
    def test_empty_scope_is_global(self, client, created_areas):
        payload = {"name": f"TEST_SC_Global_{_uuid.uuid4().hex[:6]}", "scope_grade_ids": []}
        r = client.post(f"{BASE_URL}/api/curricular-areas", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        created_areas.append(data["id"])
        assert data["scope_grade_ids"] == []
        # Verify via list
        r2 = client.get(f"{BASE_URL}/api/curricular-areas?include_inactive=true", timeout=30)
        a = next((x for x in r2.json() if x["id"] == data["id"]), None)
        assert a["scope_label"] == "Global (todos los grados)"

    def test_no_scope_field_is_global(self, client, created_areas):
        """Omitting scope_grade_ids entirely should also default to global."""
        payload = {"name": f"TEST_SC_NoScope_{_uuid.uuid4().hex[:6]}"}
        r = client.post(f"{BASE_URL}/api/curricular-areas", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        created_areas.append(data["id"])
        assert data["scope_grade_ids"] == []


# ── TEST 5: Regression — grade-shortcuts still works ────────────────────────
class TestRegressionShortcuts:
    def test_shortcuts_shape_preserved(self, shortcuts):
        assert "shortcuts" in shortcuts and "grades" in shortcuts
        keys = [s["key"] for s in shortcuts["shortcuts"]]
        assert "all" in keys
        assert any(k.startswith("level:") for k in keys)


# ── TEST 6: Regression — area/{id}/subjects still returns grade_breakdown ───
class TestRegressionAreaSubjects:
    def test_grade_breakdown_intact(self, client):
        r = client.get(f"{BASE_URL}/api/curricular-areas", timeout=30)
        assert r.status_code == 200
        areas = [a for a in r.json() if a.get("subjects_count", 0) > 0]
        if not areas:
            pytest.skip("No areas with subjects")
        a = areas[0]
        r2 = client.get(f"{BASE_URL}/api/curricular-areas/{a['id']}/subjects?page_size=50", timeout=30)
        assert r2.status_code == 200, r2.text
        groups = r2.json()["subjects"]
        if groups:
            assert "grade_breakdown" in groups[0]


# ── TEST 7: Regression — Libreta/consolidated endpoints not broken ──────────
class TestRegressionLibreta:
    def test_consolidated_lives(self, client):
        r = client.get(f"{BASE_URL}/api/sections", timeout=30)
        if r.status_code != 200:
            pytest.skip(f"sections endpoint unavailable: {r.status_code}")
        secs = r.json() if isinstance(r.json(), list) else r.json().get("sections", [])
        if not secs:
            pytest.skip("No sections")
        sid = secs[0].get("id") or secs[0].get("section_id")
        candidates = [
            f"/api/grades/consolidated/{sid}",
            f"/api/grades/consolidated?section_id={sid}",
            f"/api/libreta/students/{sid}",
        ]
        for ep in candidates:
            rc = client.get(f"{BASE_URL}{ep}", timeout=30)
            if rc.status_code < 500:
                return
        pytest.fail("All consolidated/libreta endpoints returned 5xx")
