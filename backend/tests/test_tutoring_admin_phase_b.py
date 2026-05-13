# Tests for Tutoring Admin (Phase B) endpoints:
# - GET  /api/admin/tutoring-overview
# - PUT  /api/sections/{section_id}/tutor (single assign/remove)
# - POST /api/admin/tutorings/transfer (bulk)
# - GET  /api/teachers/{teacher_id}/tutorings
import os
import pytest
import requests

def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # Read from frontend/.env
        env_path = "/app/frontend/.env"
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
    assert url, "REACT_APP_BACKEND_URL not set"
    return url.rstrip("/")


BASE_URL = _load_base_url()
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": OWNER_EMAIL, "password": OWNER_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        # Fallback: try email field
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
            timeout=20,
        )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"No token in: {r.json()}"
    return {"Authorization": f"Bearer {token}"}


# ---------- GET /api/admin/tutoring-overview ----------
class TestTutoringOverview:
    def test_overview_returns_rows_and_summary(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rows" in data and "summary" in data and "tutors" in data
        assert isinstance(data["rows"], list)
        assert len(data["rows"]) == 13, f"Expected 13 sections, got {len(data['rows'])}"

        s = data["summary"]
        assert s["total_sections"] == 13
        assert s["with_tutor"] + s["without_tutor"] == 13
        assert s["unique_tutors"] >= 0

        # Each row has expected keys
        row = data["rows"][0]
        for k in ("section_id", "section_name", "grade_name", "level_name", "tutor_id", "tutor_name", "student_count"):
            assert k in row, f"Missing key in row: {k}"

    def test_overview_with_period_id(self, auth_headers):
        # Get periods
        rp = requests.get(f"{BASE_URL}/api/academic/periods", headers=auth_headers, timeout=20)
        assert rp.status_code == 200
        periods = rp.json() or []
        if not periods:
            pytest.skip("No academic periods available")
        period_id = periods[0]["id"]

        r = requests.get(
            f"{BASE_URL}/api/admin/tutoring-overview",
            headers=auth_headers,
            params={"period_id": period_id},
            timeout=20,
        )
        assert r.status_code == 200
        rows = r.json()["rows"]
        # When period_id is passed, comments_pct/conduct_pct should be computed (None or int)
        for row in rows:
            assert row.get("comments_pct") is None or isinstance(row["comments_pct"], int)
            assert row.get("conduct_pct") is None or isinstance(row["conduct_pct"], int)


# ---------- Permission: non-admin must get 403 ----------
class TestPermissions:
    def test_no_auth_returns_401_or_403(self):
        r = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", timeout=20)
        assert r.status_code in (401, 403), f"Unexpected status: {r.status_code}"

    def test_transfer_no_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/tutorings/transfer",
            json={"section_ids": ["x"]},
            timeout=20,
        )
        assert r.status_code in (401, 403)


# ---------- PUT /api/sections/{id}/tutor + POST /api/admin/tutorings/transfer ----------
class TestAssignAndTransfer:
    """End-to-end: pick unassigned section, assign, change, then bulk transfer."""

    @pytest.fixture(scope="class")
    def context(self, auth_headers):
        # Snapshot overview + teachers
        r = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        rows = r.json()["rows"]
        ru = requests.get(f"{BASE_URL}/api/users", headers=auth_headers, params={"limit": 300}, timeout=20)
        assert ru.status_code == 200
        teachers = [u for u in ru.json() if u.get("role") == "teacher"]
        assert len(teachers) >= 2, "Need at least 2 teachers for change/transfer tests"

        unassigned = [r for r in rows if not r["tutor_id"]]
        assigned = [r for r in rows if r["tutor_id"]]

        return {
            "rows": rows,
            "teachers": teachers,
            "unassigned": unassigned,
            "assigned": assigned,
            "headers": auth_headers,
        }

    def test_single_assign_then_change_then_remove(self, context):
        h = context["headers"]
        teachers = context["teachers"]
        # Use any section (prefer unassigned)
        target_row = (context["unassigned"] or context["assigned"])[0]
        sid = target_row["section_id"]
        original_tid = target_row["tutor_id"]
        t1 = teachers[0]["id"]
        t2 = teachers[1]["id"]

        # 1) Assign t1
        r1 = requests.put(
            f"{BASE_URL}/api/sections/{sid}/tutor",
            headers=h,
            json={"teacher_id": t1},
            timeout=20,
        )
        assert r1.status_code in (200, 201), r1.text

        # Verify via overview
        ov = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", headers=h, timeout=20).json()
        row = next(r for r in ov["rows"] if r["section_id"] == sid)
        assert row["tutor_id"] == t1, f"Expected tutor {t1}, got {row['tutor_id']}"

        # 2) Change to t2
        r2 = requests.put(
            f"{BASE_URL}/api/sections/{sid}/tutor",
            headers=h,
            json={"teacher_id": t2},
            timeout=20,
        )
        assert r2.status_code in (200, 201)
        ov = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", headers=h, timeout=20).json()
        row = next(r for r in ov["rows"] if r["section_id"] == sid)
        assert row["tutor_id"] == t2

        # 3) Remove via teacher_id=null
        r3 = requests.put(
            f"{BASE_URL}/api/sections/{sid}/tutor",
            headers=h,
            json={"teacher_id": None},
            timeout=20,
        )
        assert r3.status_code in (200, 201, 204)
        ov = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", headers=h, timeout=20).json()
        row = next(r for r in ov["rows"] if r["section_id"] == sid)
        assert row["tutor_id"] is None

        # 4) Restore original assignment so we leave a section assigned (as request asks)
        if original_tid:
            requests.put(
                f"{BASE_URL}/api/sections/{sid}/tutor",
                headers=h,
                json={"teacher_id": original_tid},
                timeout=20,
            )
        else:
            # Leave at least one section assigned per agent_to_agent_context_note: re-assign to t1
            requests.put(
                f"{BASE_URL}/api/sections/{sid}/tutor",
                headers=h,
                json={"teacher_id": t1},
                timeout=20,
            )

    def test_bulk_transfer_and_restore(self, context):
        h = context["headers"]
        teachers = context["teachers"]
        rows = context["rows"]
        # Pick two sections
        targets = rows[:2]
        sids = [r["section_id"] for r in targets]
        originals = {r["section_id"]: r["tutor_id"] for r in targets}
        t_target = teachers[0]["id"]

        # Bulk transfer to t_target
        r = requests.post(
            f"{BASE_URL}/api/admin/tutorings/transfer",
            headers=h,
            json={"section_ids": sids, "new_teacher_id": t_target},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("assigned") == 2
        # Verify
        ov = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", headers=h, timeout=20).json()
        by_sid = {r["section_id"]: r for r in ov["rows"]}
        for sid in sids:
            assert by_sid[sid]["tutor_id"] == t_target

        # Bulk remove
        r = requests.post(
            f"{BASE_URL}/api/admin/tutorings/transfer",
            headers=h,
            json={"section_ids": sids, "new_teacher_id": None},
            timeout=20,
        )
        assert r.status_code == 200
        ov = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", headers=h, timeout=20).json()
        by_sid = {r["section_id"]: r for r in ov["rows"]}
        for sid in sids:
            assert by_sid[sid]["tutor_id"] is None

        # Restore originals so we leave the school as we found it (and leave at least 1 assigned)
        for sid, tid in originals.items():
            if tid:
                requests.put(
                    f"{BASE_URL}/api/sections/{sid}/tutor",
                    headers=h,
                    json={"teacher_id": tid},
                    timeout=20,
                )

    def test_transfer_invalid_section(self, context):
        h = context["headers"]
        r = requests.post(
            f"{BASE_URL}/api/admin/tutorings/transfer",
            headers=h,
            json={"section_ids": ["nonexistent-id-xxx"], "new_teacher_id": None},
            timeout=20,
        )
        assert r.status_code == 400

    def test_transfer_empty_section_ids(self, context):
        h = context["headers"]
        r = requests.post(
            f"{BASE_URL}/api/admin/tutorings/transfer",
            headers=h,
            json={"section_ids": [], "new_teacher_id": None},
            timeout=20,
        )
        assert r.status_code == 400


# ---------- GET /api/teachers/{id}/tutorings ----------
class TestTeacherTutorings:
    def test_teacher_tutorings(self, auth_headers):
        ov = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", headers=auth_headers, timeout=20).json()
        # find any tutor with at least one section
        tutors = ov["tutors"]
        if not tutors:
            pytest.skip("No tutors with assignments to test")
        tid = tutors[0]["id"]
        r = requests.get(f"{BASE_URL}/api/teachers/{tid}/tutorings", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "teacher" in data and "sections" in data
        assert isinstance(data["sections"], list)
        assert len(data["sections"]) >= 1
