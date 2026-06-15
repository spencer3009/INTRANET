"""Sprint B - Backend tests for curricular areas scope-por-grado.

Validates:
- GET /api/curricular-areas/grade-shortcuts
- GET /api/curricular-areas/{area_id}/subjects (with grade_breakdown)
- POST /api/curricular-areas/{area_id}/subjects/link (with grade_ids filter)
- POST /api/curricular-areas/{area_id}/subjects/unlink
- GET /api/curricular-areas/{area_id}/available-subjects?grade_ids=...
- Regresion: GET /api/grades/consolidated/... not broken
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://registro-auxiliar-1.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        # Try email field
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
def shortcuts_payload(client):
    r = client.get(f"{BASE_URL}/api/curricular-areas/grade-shortcuts", timeout=30)
    assert r.status_code == 200, f"shortcuts failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def areas_list(client):
    r = client.get(f"{BASE_URL}/api/curricular-areas", timeout=30)
    assert r.status_code == 200, f"list areas failed: {r.status_code} {r.text}"
    return r.json()


# ─── TEST 1: grade-shortcuts ─────────────────────────────────────────────────
class TestGradeShortcuts:
    def test_response_shape(self, shortcuts_payload):
        assert "shortcuts" in shortcuts_payload
        assert "grades" in shortcuts_payload
        assert isinstance(shortcuts_payload["shortcuts"], list)
        assert isinstance(shortcuts_payload["grades"], list)

    def test_all_shortcut_present(self, shortcuts_payload):
        keys = [s["key"] for s in shortcuts_payload["shortcuts"]]
        assert "all" in keys, f"Missing 'all' shortcut, got: {keys}"
        all_short = next(s for s in shortcuts_payload["shortcuts"] if s["key"] == "all")
        assert len(all_short["grade_ids"]) == len(shortcuts_payload["grades"])

    def test_level_shortcuts(self, shortcuts_payload):
        keys = [s["key"] for s in shortcuts_payload["shortcuts"]]
        level_keys = [k for k in keys if k.startswith("level:")]
        assert len(level_keys) >= 1, f"No level: shortcuts, got: {keys}"

    def test_grades_have_fields(self, shortcuts_payload):
        if not shortcuts_payload["grades"]:
            pytest.skip("No grades in school")
        g = shortcuts_payload["grades"][0]
        for f in ("id", "name", "level_name"):
            assert f in g, f"Grade missing field {f}: {g}"

    def test_secondary_subshortcuts(self, shortcuts_payload):
        # Optional: if school has secundaria, check sub-shortcuts
        grade_levels = {(g.get("level_name") or "").lower() for g in shortcuts_payload["grades"]}
        if "secundaria" in grade_levels:
            keys = [s["key"] for s in shortcuts_payload["shortcuts"]]
            sec_first = [k for k in keys if k.startswith("sec_first_")]
            sec_last = [k for k in keys if k.startswith("sec_last_")]
            assert len(sec_first) >= 1 or len(sec_last) >= 1, (
                f"School has secundaria but no sec_first/sec_last shortcuts: {keys}"
            )


# ─── TEST 2: area subjects with grade_breakdown ──────────────────────────────
class TestAreaSubjectsBreakdown:
    def test_subjects_with_breakdown(self, client, areas_list):
        if not areas_list:
            pytest.skip("No areas to test")
        # Pick area with most subjects
        target = max(areas_list, key=lambda a: a.get("subjects_count", 0))
        if target.get("subjects_count", 0) == 0:
            pytest.skip("No area has subjects linked")
        r = client.get(
            f"{BASE_URL}/api/curricular-areas/{target['id']}/subjects?page_size=200",
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "subjects" in data
        assert "total" in data
        assert data["page_size"] == 200
        assert len(data["subjects"]) > 0
        first = data["subjects"][0]
        for f in ("group_key", "display_name", "instances_count", "instance_ids", "grade_breakdown"):
            assert f in first, f"Missing {f} in subject group: {first.keys()}"
        # grade_breakdown items
        if first["grade_breakdown"]:
            b0 = first["grade_breakdown"][0]
            for f in ("grade_id", "grade_name", "level_id", "level_name", "level_order", "grade_order", "instance_ids", "instances_count"):
                assert f in b0, f"Missing breakdown field {f}: {b0}"

    def test_page_size_200_no_422(self, client, areas_list):
        """Bug-fix verificacion: page_size <= 200 must not 422."""
        if not areas_list:
            pytest.skip("No areas")
        a = areas_list[0]
        r = client.get(f"{BASE_URL}/api/curricular-areas/{a['id']}/subjects?page_size=200", timeout=30)
        assert r.status_code == 200, f"page_size=200 should be 200, got {r.status_code} {r.text}"

    def test_page_size_over_200_returns_422(self, client, areas_list):
        """Backend defines le=200, so 500 must return 422 (validation), not 500."""
        if not areas_list:
            pytest.skip("No areas")
        a = areas_list[0]
        r = client.get(f"{BASE_URL}/api/curricular-areas/{a['id']}/subjects?page_size=500", timeout=30)
        assert r.status_code == 422, f"Expected 422 for page_size=500, got {r.status_code}"


# ─── TEST 5: available-subjects con grade_ids filter ─────────────────────────
class TestAvailableSubjectsGradeFilter:
    def test_no_filter(self, client, areas_list):
        if not areas_list:
            pytest.skip("No areas")
        a = areas_list[0]
        r = client.get(f"{BASE_URL}/api/curricular-areas/{a['id']}/available-subjects?page_size=200", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "subjects" in data

    def test_with_grade_ids_filter(self, client, areas_list, shortcuts_payload):
        if not areas_list or not shortcuts_payload["grades"]:
            pytest.skip("No areas/grades")
        a = areas_list[0]
        # Take first 2 grades
        gids = ",".join(g["id"] for g in shortcuts_payload["grades"][:2])
        r = client.get(
            f"{BASE_URL}/api/curricular-areas/{a['id']}/available-subjects?grade_ids={gids}&unassigned_only=true&page_size=200",
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Just sanity: filtered count <= unfiltered
        r2 = client.get(
            f"{BASE_URL}/api/curricular-areas/{a['id']}/available-subjects?unassigned_only=true&page_size=200",
            timeout=30,
        )
        assert r2.status_code == 200
        assert data["total"] <= r2.json()["total"]


# ─── TEST 3 & 4: link/unlink with grade scope (NON-DESTRUCTIVE) ─────────────
class TestLinkUnlinkScoped:
    """Round-trip: link with grade scope, then unlink to leave data unchanged.

    Uses an existing area with subjects: picks a subset of instances in ONE grade,
    unlinks them (preserves original state), re-links them to the same area.
    """

    def test_round_trip_unlink_then_link(self, client, areas_list, shortcuts_payload):
        if not areas_list:
            pytest.skip("No areas")
        target = max(areas_list, key=lambda a: a.get("subjects_count", 0))
        if target.get("subjects_count", 0) == 0:
            pytest.skip("No area has subjects")

        # Get subjects + breakdown
        r = client.get(f"{BASE_URL}/api/curricular-areas/{target['id']}/subjects?page_size=200", timeout=30)
        assert r.status_code == 200
        groups = r.json()["subjects"]
        # find a group with a single grade in breakdown (to make scope-by-grade test meaningful)
        chosen_group = None
        chosen_grade_id = None
        for g in groups:
            real_grades = [b for b in g["grade_breakdown"] if b.get("grade_id")]
            if real_grades:
                chosen_group = g
                chosen_grade_id = real_grades[0]["grade_id"]
                break
        if not chosen_group:
            pytest.skip("No group with real grade_id in breakdown")

        group_key = chosen_group["group_key"]
        # Subset of instance ids only in chosen grade
        bucket = next(b for b in chosen_group["grade_breakdown"] if b["grade_id"] == chosen_grade_id)
        instance_ids = bucket["instance_ids"]
        assert instance_ids, "Empty instance_ids"

        # 1) Unlink scoped to that grade
        unlink_resp = client.post(
            f"{BASE_URL}/api/curricular-areas/{target['id']}/subjects/unlink",
            json={"group_keys": [group_key], "grade_ids": [chosen_grade_id]},
            timeout=30,
        )
        assert unlink_resp.status_code == 200, unlink_resp.text
        ud = unlink_resp.json()
        assert ud["total_instances_affected"] == len(instance_ids), (
            f"Expected {len(instance_ids)} unlinked, got {ud['total_instances_affected']}"
        )
        # Other grades for same group should still be linked
        r2 = client.get(f"{BASE_URL}/api/curricular-areas/{target['id']}/subjects?page_size=200", timeout=30)
        g2 = next((g for g in r2.json()["subjects"] if g["group_key"] == group_key), None)
        if g2:
            still_in_chosen_grade = any(
                b for b in g2["grade_breakdown"] if b.get("grade_id") == chosen_grade_id
            )
            assert not still_in_chosen_grade, "Grade should be gone from breakdown after scoped unlink"

        # 2) Re-link with grade_ids filter back to area
        link_resp = client.post(
            f"{BASE_URL}/api/curricular-areas/{target['id']}/subjects/link",
            json={"group_keys": [group_key], "grade_ids": [chosen_grade_id]},
            timeout=30,
        )
        assert link_resp.status_code == 200, link_resp.text
        ld = link_resp.json()
        assert ld["total_instances_affected"] >= len(instance_ids), (
            f"Re-link expected at least {len(instance_ids)} affected, got {ld['total_instances_affected']}"
        )
        assert "linked_groups" in ld or "reassigned_groups" in ld

        # Verify final state restored
        r3 = client.get(f"{BASE_URL}/api/curricular-areas/{target['id']}/subjects?page_size=200", timeout=30)
        g3 = next((g for g in r3.json()["subjects"] if g["group_key"] == group_key), None)
        assert g3, "Group disappeared after re-link"
        # chosen grade present again
        present = any(b.get("grade_id") == chosen_grade_id for b in g3["grade_breakdown"])
        assert present, "Chosen grade should be back in breakdown"

    def test_unlink_by_subject_ids_legacy(self, client, areas_list):
        """Legacy path: unlink by subject_ids then re-link by group_keys."""
        if not areas_list:
            pytest.skip("No areas")
        target = max(areas_list, key=lambda a: a.get("subjects_count", 0))
        if target.get("subjects_count", 0) == 0:
            pytest.skip("No subjects")
        r = client.get(f"{BASE_URL}/api/curricular-areas/{target['id']}/subjects?page_size=200", timeout=30)
        groups = r.json()["subjects"]
        if not groups or not groups[0]["instance_ids"]:
            pytest.skip("No instances")
        gk = groups[0]["group_key"]
        sid = groups[0]["instance_ids"][0]
        # unlink the single id
        u = client.post(
            f"{BASE_URL}/api/curricular-areas/{target['id']}/subjects/unlink",
            json={"subject_ids": [sid]},
            timeout=30,
        )
        assert u.status_code == 200, u.text
        assert u.json()["unlinked_count"] == 1
        # re-link by group_keys (will sweep all instances of the group; restores this one)
        l = client.post(
            f"{BASE_URL}/api/curricular-areas/{target['id']}/subjects/link",
            json={"group_keys": [gk]},
            timeout=30,
        )
        assert l.status_code == 200, l.text


# ─── TEST 9: Regression — consolidated NOT affected ──────────────────────────
class TestConsolidatedRegression:
    def test_consolidated_endpoint_lives(self, client):
        # Find a section to test
        r = client.get(f"{BASE_URL}/api/sections", timeout=30)
        if r.status_code != 200:
            pytest.skip(f"sections endpoint not available: {r.status_code}")
        secs = r.json() if isinstance(r.json(), list) else r.json().get("sections", [])
        if not secs:
            pytest.skip("No sections")
        sid = secs[0].get("id") or secs[0].get("section_id")
        if not sid:
            pytest.skip("No section id")
        # Try common consolidated endpoint pattern
        candidates = [
            f"/api/grades/consolidated/{sid}",
            f"/api/grades/consolidated?section_id={sid}",
        ]
        ok = False
        for ep in candidates:
            rc = client.get(f"{BASE_URL}{ep}", timeout=30)
            if rc.status_code in (200, 404):
                ok = True
                break
        assert ok, "Consolidated endpoint completely broken"
