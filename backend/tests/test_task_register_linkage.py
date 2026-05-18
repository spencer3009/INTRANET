"""
Tests for new endpoints supporting the Entregas-page Registro Auxiliar linkage:
  - GET /api/course/tasks/{task_id}/submissions (extended fields)
  - PUT /api/course/tasks/{task_id}/register-linkage (new)

Validates: idempotency, conflict 409, invalid column 400, unlink (null),
period switching, active-period fallback, re-sync, RBAC (parent/student 403),
and the resynced_submissions counter.
"""
import os
import pytest
import requests

def _read_backend_url():
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if val:
        return val
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _read_backend_url().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASS = "1234abc8"
TEACHER_EMAIL = "sonia3009@gmail.com"
TEACHER_PASS = "teacher123"
PARENT_EMAIL = "maria.peres@gmail.com"
PARENT_PASS = "1234abc8"

# Known seed from review_request
KNOWN_TASK_ID = "e6009ab7-bf55-4e42-b23b-7b27a37d3f4b"
KNOWN_COLUMN = "criterio_mo361cxa_sub_1776445933301"
KNOWN_PERIOD = "093a0bee-92c4-449c-b82c-942f16847759"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.status_code} {r.text}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def teacher_token():
    return _login(TEACHER_EMAIL, TEACHER_PASS)


@pytest.fixture(scope="module")
def parent_token():
    return _login(PARENT_EMAIL, PARENT_PASS)


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ─────────────────────────────────────────────────────────────
# GET submissions: extended payload
# ─────────────────────────────────────────────────────────────
class TestGetSubmissionsExtended:
    def test_get_submissions_includes_linkage_fields(self, admin_token):
        r = requests.get(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/submissions",
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("register_column", "register_column_label", "period_id",
                    "period_name", "subject_id", "section_id",
                    "submissions", "submissions_count", "graded_count"):
            assert key in data, f"missing {key} in payload: {list(data.keys())}"
        # Should be linked
        assert data["register_column"] == KNOWN_COLUMN
        assert data["period_id"] == KNOWN_PERIOD
        assert data["period_name"]  # non-empty
        assert isinstance(data["submissions"], list)

    def test_get_submissions_requires_admin_or_teacher(self, parent_token):
        r = requests.get(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/submissions",
            headers=_h(parent_token), timeout=20,
        )
        assert r.status_code == 403, f"expected 403 for parent, got {r.status_code}"


# ─────────────────────────────────────────────────────────────
# PUT register-linkage: behavior matrix
# ─────────────────────────────────────────────────────────────
class TestPutRegisterLinkage:
    def test_idempotent_same_values(self, admin_token):
        body = {"register_column": KNOWN_COLUMN, "period_id": KNOWN_PERIOD}
        r1 = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token), json=body, timeout=20,
        )
        assert r1.status_code == 200, r1.text
        j1 = r1.json()
        assert j1["register_column"] == KNOWN_COLUMN
        assert j1["period_id"] == KNOWN_PERIOD
        assert "resynced_submissions" in j1
        assert isinstance(j1["resynced_submissions"], int)
        # Repeat — must remain 200 (no 409 against itself)
        r2 = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token), json=body, timeout=20,
        )
        assert r2.status_code == 200, r2.text

    def test_invalid_column_returns_400(self, admin_token):
        body = {"register_column": "NOT_A_REAL_COLUMN_xyz", "period_id": KNOWN_PERIOD}
        r = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token), json=body, timeout=20,
        )
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "no existe" in detail or "no está habilitada" in detail or "habilitada" in detail

    def test_active_period_fallback(self, admin_token):
        # Omit period_id → should use active bimestre. KNOWN_PERIOD is the
        # active one per seed context.
        body = {"register_column": KNOWN_COLUMN}
        r = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token), json=body, timeout=20,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["period_id"]  # resolved
        # If active = KNOWN_PERIOD, should match. We don't assert equality
        # because the school may have switched the active bimestre, but
        # name should be present.
        assert j.get("period_name")

    def test_requires_admin_or_teacher(self, parent_token):
        body = {"register_column": KNOWN_COLUMN, "period_id": KNOWN_PERIOD}
        r = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(parent_token), json=body, timeout=20,
        )
        assert r.status_code == 403, f"expected 403 for parent, got {r.status_code}"

    def test_conflict_with_another_task_same_slot(self, admin_token):
        """Create a second task in the same subject/period, try to link to
        the same column → expect 409. Then clean up."""
        # Get the subject of the known task
        sub_r = requests.get(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/submissions",
            headers=_h(admin_token), timeout=20,
        )
        assert sub_r.status_code == 200
        subject_id = sub_r.json()["subject_id"]
        assert subject_id

        # Create a new task in the same subject (no register_column on create)
        create_r = requests.post(
            f"{API}/course/{subject_id}/posts",
            headers=_h(admin_token),
            json={
                "subject_id": subject_id,
                "title": "TEST_LINKAGE_CONFLICT",
                "content": "fixture for conflict test",
                "post_type": "task",
                "metadata": {"due_date": "2030-01-01T00:00:00Z", "points": 20},
            },
            timeout=20,
        )
        assert create_r.status_code in (200, 201), create_r.text
        new_task_id = create_r.json()["post"]["id"]

        try:
            # Now try linking it to the same column as the known task → 409
            conf_r = requests.put(
                f"{API}/course/tasks/{new_task_id}/register-linkage",
                headers=_h(admin_token),
                json={"register_column": KNOWN_COLUMN, "period_id": KNOWN_PERIOD},
                timeout=20,
            )
            assert conf_r.status_code == 409, f"expected 409 conflict, got {conf_r.status_code} {conf_r.text}"
            detail = (conf_r.json().get("detail") or "").lower()
            assert "asignada" in detail or "ya fue" in detail
        finally:
            # Cleanup
            requests.delete(f"{API}/course/posts/{new_task_id}",
                            headers=_h(admin_token), timeout=20)

    def test_unlink_with_null_column(self, admin_token):
        """null register_column → unlink: removes assignment row,
        course_posts.register_column=null, sync_status='not_linked'."""
        # First ensure linked
        link_r = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token),
            json={"register_column": KNOWN_COLUMN, "period_id": KNOWN_PERIOD},
            timeout=20,
        )
        assert link_r.status_code == 200, link_r.text

        # Unlink
        unlink_r = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token),
            json={"register_column": None, "period_id": KNOWN_PERIOD},
            timeout=20,
        )
        assert unlink_r.status_code == 200, unlink_r.text
        j = unlink_r.json()
        assert j["register_column"] is None
        assert j["resynced_submissions"] == 0  # no resync on unlink

        # Verify via GET submissions: register_column should be null
        sub_r = requests.get(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/submissions",
            headers=_h(admin_token), timeout=20,
        )
        assert sub_r.status_code == 200
        sub_data = sub_r.json()
        assert sub_data["register_column"] is None
        assert sub_data["register_column_label"] is None

        # Re-link to restore state for downstream tests
        relink_r = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token),
            json={"register_column": KNOWN_COLUMN, "period_id": KNOWN_PERIOD},
            timeout=20,
        )
        assert relink_r.status_code == 200, relink_r.text

    def test_resync_count_matches_graded_submissions(self, admin_token):
        """When re-linking to the same slot, resynced_submissions must
        equal the number of graded submissions in the task."""
        sub_r = requests.get(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/submissions",
            headers=_h(admin_token), timeout=20,
        )
        assert sub_r.status_code == 200
        graded_expected = sub_r.json().get("graded_count", 0)

        r = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token),
            json={"register_column": KNOWN_COLUMN, "period_id": KNOWN_PERIOD},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        synced = r.json().get("resynced_submissions")
        assert synced == graded_expected, (
            f"resynced_submissions={synced} != graded_count={graded_expected}"
        )

    def test_change_period_explicit(self, admin_token):
        """Pass another (existing) period_id and ensure persistence — then
        revert. Uses /api/academic/periods to find a second period."""
        # find another period for the school
        periods_r = requests.get(f"{API}/academic/periods",
                                 headers=_h(admin_token), timeout=20)
        if periods_r.status_code != 200:
            pytest.skip(f"cannot list periods: {periods_r.status_code}")
        periods = periods_r.json() if isinstance(periods_r.json(), list) else periods_r.json().get("periods", [])
        other = next((p for p in periods if p.get("id") and p["id"] != KNOWN_PERIOD), None)
        if not other:
            pytest.skip("no second period available to switch to")

        # Try switching. May fail with 409 if column already has manual
        # grades in the other period — that's an acceptable backend behavior.
        r = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token),
            json={"register_column": KNOWN_COLUMN, "period_id": other["id"]},
            timeout=20,
        )
        if r.status_code == 409:
            pytest.skip(f"target period has conflicting state: {r.text}")
        assert r.status_code == 200, r.text
        assert r.json()["period_id"] == other["id"]

        # Revert
        rev = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(admin_token),
            json={"register_column": KNOWN_COLUMN, "period_id": KNOWN_PERIOD},
            timeout=20,
        )
        assert rev.status_code == 200, rev.text


# ─────────────────────────────────────────────────────────────
# Teacher RBAC (sonia)
# ─────────────────────────────────────────────────────────────
class TestResyncWithSeededGradedSubmission:
    """Deep validation: seed a graded submission directly via mongo into the
    known task, call PUT register-linkage with a different valid column, and
    verify that student_grades.grades_dynamic.<new_column> is upserted to
    the vigesimal value. Cleans up after itself."""

    def test_resync_writes_to_student_grades(self, admin_token):
        import asyncio
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
        except Exception:
            pytest.skip("motor not available")

        TASK = KNOWN_TASK_ID
        ORIG_COL = KNOWN_COLUMN
        # Other valid input subcolumn of plantilla 7e98aa42 (same school)
        OTHER_COL = "criterio_mo361cxa_sub_1776445937421"  # 'SEM3'
        PERIOD = KNOWN_PERIOD
        FAKE_STUDENT = "TEST_resync_student_xyz"

        async def seed():
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client["database"]
            # Make sure the task has a graded submission for FAKE_STUDENT
            await db.course_posts.update_one(
                {"id": TASK},
                {"$pull": {"submissions": {"student_id": FAKE_STUDENT}}},
            )
            await db.course_posts.update_one(
                {"id": TASK},
                {"$push": {"submissions": {
                    "id": "TEST_sub_resync_1",
                    "student_id": FAKE_STUDENT,
                    "submitted_at": "2026-05-01T10:00:00Z",
                    "grade": 15,  # over 20 → vigesimal 15
                    "feedback": "seed",
                }}},
            )
            # Make sure max_grade exists
            await db.course_posts.update_one(
                {"id": TASK},
                {"$set": {"max_grade": 20}},
            )
            # Cleanup any pre-existing student_grades doc for this fake student
            await db.student_grades.delete_one({
                "student_id": FAKE_STUDENT,
                "period_id": PERIOD,
            })
            client.close()

        async def verify_and_cleanup(expected_col):
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client["database"]
            sg = await db.student_grades.find_one({
                "student_id": FAKE_STUDENT,
                "period_id": PERIOD,
            }, {"_id": 0})
            # Cleanup seeded submission AND student_grades
            await db.course_posts.update_one(
                {"id": TASK},
                {"$pull": {"submissions": {"student_id": FAKE_STUDENT}}},
            )
            await db.student_grades.delete_one({"student_id": FAKE_STUDENT})
            client.close()
            return sg

        asyncio.run(seed())

        try:
            # 1) Re-link to OTHER_COL (different from current) → expect resync
            r = requests.put(
                f"{API}/course/tasks/{TASK}/register-linkage",
                headers=_h(admin_token),
                json={"register_column": OTHER_COL, "period_id": PERIOD},
                timeout=30,
            )
            assert r.status_code == 200, r.text
            j = r.json()
            assert j["register_column"] == OTHER_COL
            assert j["resynced_submissions"] >= 1, (
                f"expected >=1 resync, got {j['resynced_submissions']}"
            )

            sg = asyncio.run(verify_and_cleanup(OTHER_COL))
            assert sg, "student_grades doc not created after re-sync"
            dyn = sg.get("grades_dynamic") or {}
            assert OTHER_COL in dyn, (
                f"expected {OTHER_COL} in grades_dynamic, got {list(dyn.keys())}"
            )
            # grade 15/20 → vigesimal 15
            assert dyn[OTHER_COL] == 15, f"expected 15, got {dyn[OTHER_COL]}"
        finally:
            # Always restore original linkage so subsequent runs are deterministic
            requests.put(
                f"{API}/course/tasks/{TASK}/register-linkage",
                headers=_h(admin_token),
                json={"register_column": ORIG_COL, "period_id": PERIOD},
                timeout=30,
            )


class TestTeacherRBAC:
    def test_teacher_can_read_submissions(self, teacher_token):
        # Teacher may or may not have access to this specific task's subject.
        r = requests.get(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/submissions",
            headers=_h(teacher_token), timeout=20,
        )
        # Either 200 (has access) or 404 (different subject) — must NOT be 403,
        # because the endpoint only role-checks (teacher OR admin)
        assert r.status_code in (200, 404), f"unexpected {r.status_code}: {r.text}"

    def test_teacher_role_accepted_on_linkage(self, teacher_token):
        # Idempotent re-save with same values; teacher role should pass RBAC.
        r = requests.put(
            f"{API}/course/tasks/{KNOWN_TASK_ID}/register-linkage",
            headers=_h(teacher_token),
            json={"register_column": KNOWN_COLUMN, "period_id": KNOWN_PERIOD},
            timeout=20,
        )
        # 200 (allowed by role); 404 acceptable if task not in their school
        assert r.status_code in (200, 404), f"unexpected {r.status_code}: {r.text}"
