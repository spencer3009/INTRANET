"""
Teacher Observations + Enrollment nivel_id validation tests.
Covers POST/GET/PATCH /api/teacher/observations and /api/tutor/observations
plus POST /api/enrollment/{id}/approve nivel_id requirement.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

# Known seed data (from MongoDB inspection)
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PWD = "1234abc8"
TEACHER_EMAIL = "sonia3009@gmail.com"   # teaches in section with tutor Rafa
TEACHER_PWD = "teacher123"
TUTOR_EMAIL = "rafa@gmail.com"          # tutor of section 11f50cbc
TUTOR_PWD = "Tutor123!"

STUDENT_ID_VALID = "4d30c475-c1cf-42d1-9485-620b556ecf72"  # Magno, Rafa is tutor
STUDENT_NOT_TAUGHT = "3e4e7280-80c5-4ab4-865d-2b91aea3872f"  # Ana, in test-seccion-stress
STUDENT_PENDING_NO_NIVEL = "d33161f8-8694-45d0-85f8-496b7691c607"  # Lucia, pending no nivel_id


# ──────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code != 200:
        return None
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_token():
    t = _login(ADMIN_EMAIL, ADMIN_PWD)
    if not t:
        pytest.skip("admin login failed")
    return t


@pytest.fixture(scope="module")
def teacher_token():
    t = _login(TEACHER_EMAIL, TEACHER_PWD)
    if not t:
        pytest.skip("teacher (Sonia) login failed")
    return t


@pytest.fixture(scope="module")
def tutor_token():
    t = _login(TUTOR_EMAIL, TUTOR_PWD)
    if not t:
        pytest.skip("tutor (Rafa) login failed")
    return t


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ──────────────────────────────────────────
# Teacher endpoints — composer + create
# ──────────────────────────────────────────
class TestTeacherObservationsCompose:
    def test_students_with_tutor_list(self, teacher_token):
        r = requests.get(f"{API}/teacher/students-with-tutor", headers=_h(teacher_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "students" in data
        assert isinstance(data["students"], list)
        # Should contain the seed student with tutor info
        magno = next((s for s in data["students"] if s["id"] == STUDENT_ID_VALID), None)
        assert magno is not None, "Expected Magno in teacher's students-with-tutor list"
        assert magno.get("tutor") is not None
        assert magno["tutor"].get("self") is False  # Sonia is not the tutor

    def test_create_observation_403_when_not_teaching(self, teacher_token):
        r = requests.post(
            f"{API}/teacher/observations",
            headers=_h(teacher_token),
            json={
                "student_id": STUDENT_NOT_TAUGHT,
                "category": "academica",
                "severity": "info",
                "title": "Test no teach",
                "description": "should fail 403",
            },
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_create_observation_404_unknown_student(self, teacher_token):
        r = requests.post(
            f"{API}/teacher/observations",
            headers=_h(teacher_token),
            json={
                "student_id": "00000000-0000-0000-0000-000000000000",
                "category": "academica",
                "severity": "info",
                "title": "Test unknown",
                "description": "should fail 404",
            },
            timeout=15,
        )
        assert r.status_code == 404, r.text


# ──────────────────────────────────────────
# Full flow: create → sent → get (tutor) → reply → status
# ──────────────────────────────────────────
class TestObservationFullFlow:
    obs_id = None

    def test_create_observation_ok(self, teacher_token):
        r = requests.post(
            f"{API}/teacher/observations",
            headers=_h(teacher_token),
            json={
                "student_id": STUDENT_ID_VALID,
                "category": "conductual",
                "severity": "atencion",
                "title": "TEST_Observación de prueba",
                "description": "Descripción de prueba automatizada",
                "fecha_incidente": "2026-01-15",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"]
        assert data["status"] == "abierta"
        assert data["category"] == "conductual"
        assert data["severity"] == "atencion"
        assert data["author_name"]
        assert data["tutor_name"]
        assert data["student"]["id"] == STUDENT_ID_VALID
        TestObservationFullFlow.obs_id = data["id"]

    def test_list_sent(self, teacher_token):
        r = requests.get(f"{API}/teacher/observations/sent", headers=_h(teacher_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "observations" in data
        ids = [o["id"] for o in data["observations"]]
        assert TestObservationFullFlow.obs_id in ids

    def test_tutor_inbox_sees_it(self, tutor_token):
        r = requests.get(f"{API}/tutor/observations", headers=_h(tutor_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "observations" in data
        assert "counts" in data
        counts = data["counts"]
        for k in ("total", "abierta", "en_seguimiento", "cerrada", "unread"):
            assert k in counts
        ids = [o["id"] for o in data["observations"]]
        assert TestObservationFullFlow.obs_id in ids

    def test_get_observation_marks_read_by_tutor(self, tutor_token):
        obs_id = TestObservationFullFlow.obs_id
        assert obs_id, "previous test must have created the observation"
        r = requests.get(f"{API}/tutor/observations", headers=_h(tutor_token), timeout=15)
        before = r.json()["counts"]["unread"]

        r2 = requests.get(f"{API}/teacher/observations/{obs_id}", headers=_h(tutor_token), timeout=15)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data["id"] == obs_id
        assert data.get("read_by_tutor_at") is not None

        r3 = requests.get(f"{API}/tutor/observations", headers=_h(tutor_token), timeout=15)
        after = r3.json()["counts"]["unread"]
        assert after <= before  # decreased or stayed (if already read)

    def test_reply_by_tutor(self, tutor_token):
        obs_id = TestObservationFullFlow.obs_id
        r = requests.post(
            f"{API}/teacher/observations/{obs_id}/reply",
            headers=_h(tutor_token),
            json={"text": "TEST_reply from tutor"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["thread"]) >= 1
        assert data["thread"][-1]["text"] == "TEST_reply from tutor"

    def test_reply_by_author_teacher(self, teacher_token):
        obs_id = TestObservationFullFlow.obs_id
        r = requests.post(
            f"{API}/teacher/observations/{obs_id}/reply",
            headers=_h(teacher_token),
            json={"text": "TEST_reply from teacher"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert any(m["text"] == "TEST_reply from teacher" for m in r.json()["thread"])

    def test_reply_by_third_party_forbidden(self, admin_token):
        obs_id = TestObservationFullFlow.obs_id
        r = requests.post(
            f"{API}/teacher/observations/{obs_id}/reply",
            headers=_h(admin_token),
            json={"text": "should fail"},
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_status_change_only_by_tutor(self, teacher_token, tutor_token):
        obs_id = TestObservationFullFlow.obs_id
        # Teacher (author) should NOT be allowed
        r = requests.patch(
            f"{API}/tutor/observations/{obs_id}/status",
            headers=_h(teacher_token),
            json={"status": "en_seguimiento"},
            timeout=15,
        )
        assert r.status_code == 403, r.text

        # Tutor should be allowed: en_seguimiento
        r2 = requests.patch(
            f"{API}/tutor/observations/{obs_id}/status",
            headers=_h(tutor_token),
            json={"status": "en_seguimiento"},
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "en_seguimiento"

        # Close
        r3 = requests.patch(
            f"{API}/tutor/observations/{obs_id}/status",
            headers=_h(tutor_token),
            json={"status": "cerrada"},
            timeout=15,
        )
        assert r3.status_code == 200, r3.text
        assert r3.json()["status"] == "cerrada"
        assert r3.json().get("closed_at")

    def test_reply_on_closed_is_409(self, teacher_token):
        obs_id = TestObservationFullFlow.obs_id
        r = requests.post(
            f"{API}/teacher/observations/{obs_id}/reply",
            headers=_h(teacher_token),
            json={"text": "after close"},
            timeout=15,
        )
        assert r.status_code == 409, r.text

    def test_reopen_by_tutor(self, tutor_token):
        obs_id = TestObservationFullFlow.obs_id
        r = requests.patch(
            f"{API}/tutor/observations/{obs_id}/status",
            headers=_h(tutor_token),
            json={"status": "en_seguimiento"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "en_seguimiento"
        assert r.json().get("closed_at") is None

    def test_inbox_filters(self, tutor_token):
        # status filter
        r = requests.get(f"{API}/tutor/observations?status=en_seguimiento", headers=_h(tutor_token), timeout=15)
        assert r.status_code == 200
        for o in r.json()["observations"]:
            assert o["status"] == "en_seguimiento"
        # severity filter
        r2 = requests.get(f"{API}/tutor/observations?severity=atencion", headers=_h(tutor_token), timeout=15)
        assert r2.status_code == 200
        for o in r2.json()["observations"]:
            assert o["severity"] == "atencion"


# ──────────────────────────────────────────
# Self-tutor 400 (teacher attempting to report a student in his/her OWN tutor section)
# Rafa is tutor of section 11f50cbc with student Magno. If Rafa also teaches a subject there,
# create endpoint should return 400. If not teaching → 403. Validate both branches by best-effort.
# ──────────────────────────────────────────
class TestSelfTutorBlocked:
    def test_tutor_reports_own_student(self, tutor_token):
        r = requests.post(
            f"{API}/teacher/observations",
            headers=_h(tutor_token),
            json={
                "student_id": STUDENT_ID_VALID,
                "category": "otro",
                "severity": "info",
                "title": "TEST_self",
                "description": "should be 400 if teaches, 403 otherwise",
            },
            timeout=15,
        )
        # Either 400 (is tutor & teaches) or 403 (doesn't teach subject there)
        assert r.status_code in (400, 403), r.text


# ──────────────────────────────────────────
# Enrollment nivel_id validation
# ──────────────────────────────────────────
class TestEnrollmentApproveNivel:
    def test_approve_without_nivel_returns_400(self, admin_token):
        # Lucia is pending with nivel_id=None — body without nivel_id must fail
        r = requests.post(
            f"{API}/enrollment/{STUDENT_PENDING_NO_NIVEL}/approve",
            headers=_h(admin_token),
            json={},
            timeout=15,
        )
        assert r.status_code == 400, r.text
        body = r.json()
        msg = (body.get("detail") or body.get("message") or "").lower()
        assert "nivel" in msg

    def test_approve_with_body_nivel_succeeds(self, admin_token):
        # Find a level id
        # Use first level from levels listing
        # Try /api/academic/levels or /api/niveles
        levels = None
        for url in (f"{API}/academic/levels", f"{API}/niveles"):
            try:
                rr = requests.get(url, headers=_h(admin_token), timeout=15)
                if rr.status_code == 200:
                    data = rr.json()
                    if isinstance(data, list) and data:
                        levels = data
                        break
                    if isinstance(data, dict):
                        for k in ("levels", "niveles", "items", "data"):
                            if isinstance(data.get(k), list) and data[k]:
                                levels = data[k]
                                break
                    if levels:
                        break
            except Exception:
                pass
        if not levels:
            pytest.skip("could not list academic levels")
        nivel_id = levels[0].get("id") or levels[0].get("_id")
        assert nivel_id

        r = requests.post(
            f"{API}/enrollment/{STUDENT_PENDING_NO_NIVEL}/approve",
            headers=_h(admin_token),
            json={"nivel_id": nivel_id},
            timeout=20,
        )
        # Could be 200 OK, or 400 if already approved by previous test run.
        # First-pass should be 200.
        assert r.status_code in (200, 400), r.text
        if r.status_code == 400:
            assert "pendiente" in (r.json().get("detail") or "").lower()
