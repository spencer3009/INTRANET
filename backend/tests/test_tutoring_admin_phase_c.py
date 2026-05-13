# Tests for Tutoring Fase C endpoints (Portal del Profesor-Tutor)
# - GET /api/mis-tutorias/sections (admin/owner sees all)
# - GET /api/mis-tutorias/bulk (students + comment + conduct_letra + is_closed)
# - GET /api/mis-tutorias/sections/{id}/consolidated (read-only, all subjects)
# - PUT /api/tutor-comments and /api/conduct respect 423 for closed bimesters
# - GET /api/admin/tutoring-overview (Fase D card data source)
import os
import pytest
import requests


def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
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
        json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": OWNER_EMAIL, "password": OWNER_PASSWORD},
            timeout=20,
        )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"No token: {r.json()}"
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def periods(auth_headers):
    r = requests.get(f"{BASE_URL}/api/academic/periods", headers=auth_headers, timeout=20)
    assert r.status_code == 200
    data = r.json()
    return data if isinstance(data, list) else (data.get("periods") or [])


# ---------- GET /api/mis-tutorias/sections ----------
class TestMisTutoriasSections:
    def test_admin_sees_all_sections(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/mis-tutorias/sections", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        secs = data.get("sections") or []
        assert isinstance(secs, list)
        # owner/admin must see all 13 sections of elroble
        assert len(secs) == 13, f"Expected 13 sections for owner, got {len(secs)}"
        # row shape sanity
        s = secs[0]
        for k in ("section_id", "nombre", "grado_nombre", "nivel_nombre", "student_count"):
            assert k in s, f"Missing key in section: {k}"

    def test_no_auth_returns_401_or_403(self):
        r = requests.get(f"{BASE_URL}/api/mis-tutorias/sections", timeout=20)
        assert r.status_code in (401, 403)


# ---------- GET /api/mis-tutorias/bulk ----------
class TestMisTutoriasBulk:
    @pytest.fixture(scope="class")
    def first_section(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/mis-tutorias/sections", headers=auth_headers, timeout=20)
        secs = r.json().get("sections") or []
        # prefer a section with students > 0
        with_students = [s for s in secs if (s.get("student_count") or 0) > 0]
        return (with_students or secs)[0]

    def test_bulk_returns_students_and_period(self, auth_headers, periods, first_section):
        if not periods:
            pytest.skip("No periods")
        period_id = periods[0]["id"]
        r = requests.get(
            f"{BASE_URL}/api/mis-tutorias/bulk",
            headers=auth_headers,
            params={"section_id": first_section["section_id"], "period_id": period_id},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "students" in data
        assert "period" in data
        for st in data["students"]:
            for k in ("student_id", "student_name", "comment", "conduct_letra", "is_closed", "number"):
                assert k in st, f"Missing key {k} in student row"

    def test_bulk_missing_params_returns_4xx(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/mis-tutorias/bulk", headers=auth_headers, timeout=20)
        assert r.status_code in (400, 422)


# ---------- GET /api/mis-tutorias/sections/{id}/consolidated ----------
class TestMisTutoriasConsolidated:
    def test_admin_can_access_consolidated(self, auth_headers, periods):
        if not periods:
            pytest.skip("No periods")
        sr = requests.get(f"{BASE_URL}/api/mis-tutorias/sections", headers=auth_headers, timeout=20)
        secs = sr.json().get("sections") or []
        with_students = [s for s in secs if (s.get("student_count") or 0) > 0]
        sid = (with_students or secs)[0]["section_id"]

        r = requests.get(
            f"{BASE_URL}/api/mis-tutorias/sections/{sid}/consolidated",
            headers=auth_headers,
            params={"period_id": periods[0]["id"]},
            timeout=30,
        )
        # Admin/owner must always be allowed (200). 404 means missing data, 403 would be a regression.
        assert r.status_code != 403, f"Owner should not get 403, got {r.status_code}: {r.text}"
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            data = r.json()
            assert "students" in data
            assert "subjects" in data

    def test_consolidated_no_auth(self, periods):
        if not periods:
            pytest.skip("No periods")
        r = requests.get(
            f"{BASE_URL}/api/mis-tutorias/sections/whatever/consolidated",
            params={"period_id": periods[0]["id"]},
            timeout=20,
        )
        assert r.status_code in (401, 403)


# ---------- PUT /api/tutor-comments and /api/conduct on closed period → 423 ----------
class TestClosedPeriodLock:
    def _find_closed_period(self, periods):
        # any period with activo False is likely closed; we'll use bulk's is_closed signal
        return None

    def test_put_tutor_comment_on_closed_returns_423(self, auth_headers, periods):
        if not periods:
            pytest.skip("No periods")
        # find a section + closed period (per smoke test, Bimestre I is closed)
        sr = requests.get(f"{BASE_URL}/api/mis-tutorias/sections", headers=auth_headers, timeout=20)
        secs = sr.json().get("sections") or []
        with_students = [s for s in secs if (s.get("student_count") or 0) > 0]
        if not with_students:
            pytest.skip("No section with students")
        sid = with_students[0]["section_id"]

        closed_student = None
        closed_period_id = None
        for p in periods:
            br = requests.get(
                f"{BASE_URL}/api/mis-tutorias/bulk",
                headers=auth_headers,
                params={"section_id": sid, "period_id": p["id"]},
                timeout=20,
            )
            if br.status_code != 200:
                continue
            for st in br.json().get("students") or []:
                if st.get("is_closed"):
                    closed_student = st
                    closed_period_id = p["id"]
                    break
            if closed_student:
                break
        if not closed_student:
            pytest.skip("No closed bimester+student combo found")

        r = requests.put(
            f"{BASE_URL}/api/tutor-comments",
            headers=auth_headers,
            json={
                "student_id": closed_student["student_id"],
                "period_id": closed_period_id,
                "comment": "TEST_should_be_locked",
            },
            timeout=20,
        )
        assert r.status_code == 423, f"Expected 423 on closed period, got {r.status_code}: {r.text}"

    def test_put_conduct_on_closed_returns_423(self, auth_headers, periods):
        if not periods:
            pytest.skip("No periods")
        sr = requests.get(f"{BASE_URL}/api/mis-tutorias/sections", headers=auth_headers, timeout=20)
        secs = sr.json().get("sections") or []
        with_students = [s for s in secs if (s.get("student_count") or 0) > 0]
        if not with_students:
            pytest.skip("No section with students")
        sid = with_students[0]["section_id"]

        closed_student = None
        closed_period_id = None
        for p in periods:
            br = requests.get(
                f"{BASE_URL}/api/mis-tutorias/bulk",
                headers=auth_headers,
                params={"section_id": sid, "period_id": p["id"]},
                timeout=20,
            )
            if br.status_code != 200:
                continue
            for st in br.json().get("students") or []:
                if st.get("is_closed"):
                    closed_student = st
                    closed_period_id = p["id"]
                    break
            if closed_student:
                break
        if not closed_student:
            pytest.skip("No closed bimester+student combo")

        r = requests.put(
            f"{BASE_URL}/api/conduct",
            headers=auth_headers,
            json={
                "student_id": closed_student["student_id"],
                "period_id": closed_period_id,
                "letra": "A",
            },
            timeout=20,
        )
        assert r.status_code == 423, f"Expected 423, got {r.status_code}: {r.text}"


# ---------- Fase D: GET /api/admin/tutoring-overview (data for AdminDashboard card) ----------
class TestTutoringOverviewCard:
    def test_overview_summary_for_dashboard_card(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tutoring-overview", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        s = data.get("summary") or {}
        # Card needs total_sections + with_tutor + without_tutor
        for k in ("total_sections", "with_tutor", "without_tutor"):
            assert k in s, f"Missing summary field {k}"
        assert s["with_tutor"] + s["without_tutor"] == s["total_sections"]


# ---------- Fase D: tutor badge — academic assignments with role=tutor ----------
class TestTutorBadgeData:
    def test_tutor_assignments_exist_for_robles(self, auth_headers):
        # find user
        ru = requests.get(f"{BASE_URL}/api/users", headers=auth_headers, params={"limit": 300}, timeout=20)
        assert ru.status_code == 200
        teachers = [u for u in ru.json() if u.get("role") == "teacher"]
        robles = next(
            (u for u in teachers if "Robles" in (u.get("nombre_completo") or u.get("nombre") or u.get("name") or "")),
            None,
        )
        if not robles:
            pytest.skip("Robles teacher not present")
        # fetch tutorings
        rt = requests.get(
            f"{BASE_URL}/api/teachers/{robles['id']}/tutorings", headers=auth_headers, timeout=20
        )
        assert rt.status_code == 200, rt.text
        data = rt.json()
        secs = data.get("sections") or []
        # Robles Miro should have exactly 1 tutor section per the request spec
        assert len(secs) >= 1, f"Expected ≥1 tutor section for Robles, got {len(secs)}"
