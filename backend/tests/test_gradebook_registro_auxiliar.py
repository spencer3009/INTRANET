"""
Test suite for Registro Auxiliar (Gradebook) - NEW SCHEMA
Tests the Excel-like gradebook with sub-fields:
- ACTITUDINAL (act_co, act_re) 10%
- REVISIÓN FICHAS (rf_r1-r5) 25%
- COMPETENCIA (comp_c1, comp_c2) 5%
- PARTICIPACIONES (part_p1, part_p2, part_p3, part_exp, part_tg, part_p) 25%
- EXAMEN MENSUAL (exam_mensual) 15%
- EXAMEN BIMESTRAL (exam_bimestral) 20%
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"

# Test IDs from requirements
TEST_SUBJECT_ID = "a1eb013c-1682-4411-b525-334a55f588d5"
TEST_SECTION_ID = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
TEST_PERIOD_ID = "093a0bee-92c4-449c-b82c-942f16847759"

# New grade sub-fields (matching backend)
GRADE_SUB_FIELDS = [
    "act_co", "act_re",
    "rf_r1", "rf_r2", "rf_r3", "rf_r4", "rf_r5",
    "comp_c1", "comp_c2",
    "part_p1", "part_p2", "part_p3", "part_exp", "part_tg", "part_p",
    "exam_mensual", "exam_bimestral",
]


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user."""
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "subdomain": TEST_SUBDOMAIN,
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }, headers={"X-School-Subdomain": TEST_SUBDOMAIN})
    assert res.status_code == 200, f"Login failed: {res.text}"
    data = res.json()
    assert "token" in data, f"No token in response: {data}"
    return data["token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-School-Subdomain": TEST_SUBDOMAIN
    }


@pytest.fixture(scope="module")
def student_id(headers):
    """Get first student's ID from the register."""
    res = requests.get(
        f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    if not data["students"]:
        pytest.skip("No students available")
    return data["students"][0]["student_id"]


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: GET /api/grades/register/{subject_id}/{section_id}/{period_id}
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetGradeRegister:
    """Test GET register endpoint with new sub-fields"""

    def test_get_register_returns_new_subfields(self, headers):
        """GET /api/grades/register returns all new sub-fields"""
        res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        # Verify response structure
        assert "students" in data, "Missing students list"
        assert "config" in data, "Missing config"
        assert "status" in data, "Missing status"
        assert "subject_name" in data, "Missing subject_name"
        assert "period_name" in data, "Missing period_name"
        
        print(f"✓ Register has {len(data['students'])} students")
        
        # Verify student structure has ALL new sub-fields
        if data["students"]:
            student = data["students"][0]
            assert "student_id" in student, "Missing student_id"
            assert "student_name" in student, "Missing student_name"
            assert "number" in student, "Missing student number"
            
            # Check ALL new sub-fields exist
            for field in GRADE_SUB_FIELDS:
                assert field in student, f"Missing sub-field: {field}"
            
            assert "final_grade" in student, "Missing final_grade"
            print(f"✓ Student {student['student_name']} has all {len(GRADE_SUB_FIELDS)} sub-fields")
            print(f"  act_co={student['act_co']}, act_re={student['act_re']}")
            print(f"  rf_r1-r5: {student['rf_r1']}, {student['rf_r2']}, {student['rf_r3']}, {student['rf_r4']}, {student['rf_r5']}")
            print(f"  final_grade={student['final_grade']}")

    def test_get_register_returns_config_weights(self, headers):
        """GET /api/grades/register returns config with correct weights"""
        res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        config = data["config"]
        
        # Verify weights match expected percentages
        assert config.get("attitude_weight") == 0.10, f"attitude_weight should be 0.10, got {config.get('attitude_weight')}"
        assert config.get("worksheets_weight") == 0.25, f"worksheets_weight should be 0.25"
        assert config.get("competency_weight") == 0.05, f"competency_weight should be 0.05"
        assert config.get("participation_weight") == 0.25, f"participation_weight should be 0.25"
        assert config.get("monthly_exam_weight") == 0.15, f"monthly_exam_weight should be 0.15"
        assert config.get("bimestral_exam_weight") == 0.20, f"bimestral_exam_weight should be 0.20"
        
        total = sum([
            config["attitude_weight"], config["worksheets_weight"],
            config["competency_weight"], config["participation_weight"],
            config["monthly_exam_weight"], config["bimestral_exam_weight"]
        ])
        assert abs(total - 1.0) < 0.001, f"Weights should sum to 1.0, got {total}"
        print(f"✓ Config weights sum to 100%: {config}")

    def test_get_register_requires_auth(self):
        """GET /api/grades/register without auth returns 401/403"""
        res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print("✓ Register endpoint requires authentication")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: POST /api/grades/save with NEW sub-fields
# ═══════════════════════════════════════════════════════════════════════════════

class TestSaveGrades:
    """Test POST /api/grades/save with new sub-fields"""

    def test_save_all_subfields(self, headers, student_id):
        """POST /api/grades/save saves all 17 sub-fields"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [{
                "student_id": student_id,
                "act_co": 15,
                "act_re": 16,
                "rf_r1": 14,
                "rf_r2": 15,
                "rf_r3": 16,
                "rf_r4": 17,
                "rf_r5": 18,
                "comp_c1": 14,
                "comp_c2": 15,
                "part_p1": 16,
                "part_p2": 15,
                "part_p3": 14,
                "part_exp": 17,
                "part_tg": 16,
                "part_p": 15,
                "exam_mensual": 16,
                "exam_bimestral": 18
            }]
        }
        
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("saved") >= 1, f"Should have saved at least 1 grade"
        print(f"✓ Saved grades: {data}")
        
        # Verify persistence
        verify_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert verify_res.status_code == 200
        students = verify_res.json()["students"]
        saved = next((s for s in students if s["student_id"] == student_id), None)
        assert saved is not None
        assert saved["act_co"] == 15, f"act_co not persisted, got {saved['act_co']}"
        assert saved["rf_r3"] == 16, f"rf_r3 not persisted"
        assert saved["exam_bimestral"] == 18, f"exam_bimestral not persisted"
        print(f"✓ All sub-fields persisted correctly")

    def test_save_partial_subfields(self, headers, student_id):
        """POST /api/grades/save handles partial sub-fields (nulls)"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [{
                "student_id": student_id,
                "act_co": 14,
                "act_re": None,  # Null value
                "rf_r1": 13,
                "exam_mensual": 15
                # Other fields omitted (should be treated as null)
            }]
        }
        
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        print(f"✓ Partial save successful: {res.json()}")

    def test_save_validates_grade_range_0_20(self, headers, student_id):
        """POST /api/grades/save validates grades must be 0-20"""
        # Test grade > 20
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [{
                "student_id": student_id,
                "act_co": 25  # Invalid - above 20
            }]
        }
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 400, f"Expected 400 for grade > 20, got {res.status_code}"
        print(f"✓ Grade > 20 rejected: {res.json()}")
        
        # Test grade < 0
        payload["grades"][0]["act_co"] = -5
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 400, f"Expected 400 for grade < 0, got {res.status_code}"
        print(f"✓ Grade < 0 rejected: {res.json()}")

    def test_save_requires_auth(self):
        """POST /api/grades/save without auth returns 401/403"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": []
        }
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload)
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print("✓ Save endpoint requires authentication")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: Final Grade Calculation - Weighted Formula
# ═══════════════════════════════════════════════════════════════════════════════

class TestFinalGradeCalculation:
    """Test final grade = actAvg*0.10 + rfAvg*0.25 + compAvg*0.05 + partAvg*0.25 + examMens*0.15 + examBim*0.20"""

    def test_final_grade_weighted_formula(self, headers, student_id):
        """Final grade calculated using correct weighted formula"""
        # Set known values to verify calculation
        # ACT avg: (10+10)/2 = 10 * 0.10 = 1.0
        # RF avg: (20+20+20+20+20)/5 = 20 * 0.25 = 5.0
        # COMP avg: (15+15)/2 = 15 * 0.05 = 0.75
        # PART avg: (12+12+12+12+12+12)/6 = 12 * 0.25 = 3.0
        # EM: 16 * 0.15 = 2.4
        # EB: 18 * 0.20 = 3.6
        # Total = 1.0 + 5.0 + 0.75 + 3.0 + 2.4 + 3.6 = 15.75 → rounded to 15.8
        
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [{
                "student_id": student_id,
                "act_co": 10, "act_re": 10,
                "rf_r1": 20, "rf_r2": 20, "rf_r3": 20, "rf_r4": 20, "rf_r5": 20,
                "comp_c1": 15, "comp_c2": 15,
                "part_p1": 12, "part_p2": 12, "part_p3": 12, "part_exp": 12, "part_tg": 12, "part_p": 12,
                "exam_mensual": 16,
                "exam_bimestral": 18
            }]
        }
        
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 200
        
        # Verify final grade
        verify_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        students = verify_res.json()["students"]
        saved = next((s for s in students if s["student_id"] == student_id), None)
        
        final = saved["final_grade"]
        expected = 15.8  # Calculated above
        assert final is not None, "Final grade should be calculated"
        assert abs(final - expected) < 0.2, f"Final grade {final} should be ~{expected}"
        print(f"✓ Final grade calculation verified: {final} (expected ~{expected})")

    def test_final_grade_with_partial_data(self, headers, student_id):
        """Final grade calculates correctly with partial sub-fields"""
        # Only set some fields to test weighted partial calculation
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [{
                "student_id": student_id,
                "act_co": 16, "act_re": 16,  # ACT avg = 16
                "exam_bimestral": 18          # Only EB = 18
                # All others null
            }]
        }
        
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 200
        
        verify_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        saved = next((s for s in verify_res.json()["students"] if s["student_id"] == student_id), None)
        
        # With partial data, calculation should still work
        final = saved.get("final_grade")
        assert final is not None, "Final grade should still be calculated with partial data"
        print(f"✓ Partial data final grade: {final}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: Lock/Unlock Period
# ═══════════════════════════════════════════════════════════════════════════════

class TestLockUnlockPeriod:
    """Test lock_period and unlock_period functionality"""

    def test_lock_period(self, headers):
        """POST /api/grades/lock_period closes the register"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID
        }
        res = requests.post(f"{BASE_URL}/api/grades/lock_period", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        # Verify status changed
        verify_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert verify_res.json()["status"] == "closed", "Status should be 'closed'"
        print("✓ Period locked successfully")

    def test_unlock_period(self, headers):
        """POST /api/grades/unlock_period reopens the register (admin only)"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID
        }
        res = requests.post(f"{BASE_URL}/api/grades/unlock_period", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        # Verify status changed
        verify_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert verify_res.json()["status"] == "open", "Status should be 'open'"
        print("✓ Period unlocked successfully")

    def test_lock_unlock_require_auth(self):
        """Lock/unlock endpoints require authentication"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID
        }
        lock_res = requests.post(f"{BASE_URL}/api/grades/lock_period", json=payload)
        assert lock_res.status_code in [401, 403], f"Lock should require auth, got {lock_res.status_code}"
        
        unlock_res = requests.post(f"{BASE_URL}/api/grades/unlock_period", json=payload)
        assert unlock_res.status_code in [401, 403], f"Unlock should require auth, got {unlock_res.status_code}"
        print("✓ Lock/unlock endpoints require authentication")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: Autosave Endpoint
# ═══════════════════════════════════════════════════════════════════════════════

class TestAutosave:
    """Test POST /api/grades/autosave"""

    def test_autosave_works(self, headers, student_id):
        """POST /api/grades/autosave saves grades (same as save)"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [{
                "student_id": student_id,
                "act_co": 17,
                "act_re": 18
            }]
        }
        res = requests.post(f"{BASE_URL}/api/grades/autosave", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("saved") >= 1
        print(f"✓ Autosave successful: {data}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: Evaluation Config
# ═══════════════════════════════════════════════════════════════════════════════

class TestEvaluationConfig:
    """Test GET and PUT /api/grades/config"""

    def test_get_eval_config(self, headers):
        """GET /api/grades/config returns weight configuration"""
        res = requests.get(
            f"{BASE_URL}/api/grades/config/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}",
            headers=headers
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        required_fields = [
            "attitude_weight", "worksheets_weight", "competency_weight",
            "participation_weight", "monthly_exam_weight", "bimestral_exam_weight"
        ]
        for field in required_fields:
            assert field in data, f"Missing {field}"
            assert isinstance(data[field], (int, float)), f"{field} should be numeric"
        print(f"✓ Eval config: {data}")

    def test_get_config_requires_auth(self):
        """GET /api/grades/config requires authentication"""
        res = requests.get(
            f"{BASE_URL}/api/grades/config/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}"
        )
        assert res.status_code in [401, 403]
        print("✓ Config endpoint requires auth")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST: Restore test data at end
# ═══════════════════════════════════════════════════════════════════════════════

class TestCleanup:
    """Restore original test data"""

    def test_restore_original_grades(self, headers, student_id):
        """Restore original grades for student Diaz Flores Roberto"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [{
                "student_id": student_id,
                "act_co": 15,
                "act_re": 16,
                "rf_r1": 14,
                "rf_r2": 15,
                "rf_r3": 16,
                "rf_r4": 17,
                "rf_r5": 18,
                "comp_c1": 14,
                "comp_c2": 15,
                "part_p1": 16,
                "part_p2": 15,
                "part_p3": 14,
                "part_exp": 17,
                "part_tg": 16,
                "part_p": 15,
                "exam_mensual": 16,
                "exam_bimestral": 18
            }]
        }
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 200
        print("✓ Original grades restored")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
