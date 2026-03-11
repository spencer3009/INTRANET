"""
Test suite for Grades Module: Registro Auxiliar + Consolidado de Notas
Tests grade CRUD, autosave, lock/unlock, consolidated view, and Excel export.
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials provided
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"

# Test IDs provided
TEST_SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"
TEST_SECTION_ID = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
TEST_PERIOD_ID = "093a0bee-92c4-449c-b82c-942f16847759"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user."""
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "subdomain": TEST_SUBDOMAIN,
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    data = res.json()
    # API returns 'token' not 'access_token'
    assert "token" in data, f"No token in response: {data}"
    return data["token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}"}


class TestGradeConfig:
    """Test evaluation config endpoints"""
    
    def test_get_eval_config(self, headers):
        """GET /api/grades/config/{subject_id}/{section_id} - returns config weights"""
        res = requests.get(
            f"{BASE_URL}/api/grades/config/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}",
            headers=headers
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        # Verify config structure has weight fields
        assert "attitude_weight" in data, "Missing attitude_weight"
        assert "worksheets_weight" in data, "Missing worksheets_weight"
        assert "competency_weight" in data, "Missing competency_weight"
        assert "participation_weight" in data, "Missing participation_weight"
        assert "monthly_exam_weight" in data, "Missing monthly_exam_weight"
        assert "bimestral_exam_weight" in data, "Missing bimestral_exam_weight"
        
        # Verify weights are valid decimals
        assert 0 <= data["attitude_weight"] <= 1, "Invalid attitude_weight"
        assert 0 <= data["worksheets_weight"] <= 1, "Invalid worksheets_weight"
        print(f"✓ Eval config retrieved: {data}")
    
    def test_get_config_requires_auth(self):
        """GET /api/grades/config without auth returns 401/403"""
        res = requests.get(
            f"{BASE_URL}/api/grades/config/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}"
        )
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print(f"✓ Config endpoint requires auth")


class TestGradeRegister:
    """Test grade register (Registro Auxiliar) endpoints"""
    
    def test_get_grade_register(self, headers):
        """GET /api/grades/register/{subject_id}/{section_id}/{period_id} - returns students, config, status"""
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
        
        # Status should be 'open', 'closed' or 'approved'
        assert data["status"] in ["open", "closed", "approved"], f"Invalid status: {data['status']}"
        
        # Config should have weights
        config = data["config"]
        assert "attitude_weight" in config, "Missing attitude_weight in config"
        assert "bimestral_exam_weight" in config, "Missing bimestral_exam_weight in config"
        
        # Students should be a list with proper structure
        assert isinstance(data["students"], list), "Students should be a list"
        print(f"✓ Grade register retrieved: {len(data['students'])} students, status: {data['status']}")
        
        # If students exist, verify structure
        if data["students"]:
            student = data["students"][0]
            assert "student_id" in student, "Missing student_id"
            assert "student_name" in student, "Missing student_name"
            # Grade fields should exist (can be null)
            for field in ["attitude_grade", "worksheets_grade", "competency_grade", 
                         "participation_grade", "monthly_exam_grade", "bimestral_exam_grade"]:
                assert field in student, f"Missing {field}"
            print(f"✓ Student structure verified: {student['student_name']}")
    
    def test_get_register_requires_auth(self):
        """GET /api/grades/register without auth returns 401/403"""
        res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print("✓ Register endpoint requires auth")


class TestGradeSave:
    """Test grade save and autosave endpoints"""
    
    def test_save_grades(self, headers):
        """POST /api/grades/save - saves grades for multiple students"""
        # First get students to have valid student_ids
        reg_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert reg_res.status_code == 200
        reg_data = reg_res.json()
        
        # If no students, skip this test
        if not reg_data["students"]:
            pytest.skip("No students available to test grade saving")
        
        # Get first student's ID
        student = reg_data["students"][0]
        student_id = student["student_id"]
        
        # Save valid grades
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [
                {
                    "student_id": student_id,
                    "attitude_grade": 15,
                    "worksheets_grade": 16,
                    "competency_grade": 14,
                    "participation_grade": 17,
                    "monthly_exam_grade": 15,
                    "bimestral_exam_grade": 16
                }
            ]
        }
        
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        # Should return saved count
        assert "saved" in data, "Missing saved count"
        assert data["saved"] >= 1, "Should have saved at least 1 grade"
        print(f"✓ Grades saved successfully: {data}")
        
        # Verify grades were persisted by fetching again
        verify_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        
        saved_student = next((s for s in verify_data["students"] if s["student_id"] == student_id), None)
        assert saved_student is not None, "Student not found after save"
        assert saved_student["attitude_grade"] == 15, "Attitude grade not persisted"
        print(f"✓ Grades verified in database: attitude={saved_student['attitude_grade']}")
    
    def test_autosave_grades(self, headers):
        """POST /api/grades/autosave - same as save but for auto-save"""
        reg_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert reg_res.status_code == 200
        reg_data = reg_res.json()
        
        if not reg_data["students"]:
            pytest.skip("No students available to test autosave")
        
        student = reg_data["students"][0]
        
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [
                {
                    "student_id": student["student_id"],
                    "attitude_grade": 16
                }
            ]
        }
        
        res = requests.post(f"{BASE_URL}/api/grades/autosave", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "saved" in data
        print(f"✓ Autosave worked: {data}")
    
    def test_save_grades_validation(self, headers):
        """POST /api/grades/save - validates grades are 0-20"""
        reg_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert reg_res.status_code == 200
        reg_data = reg_res.json()
        
        if not reg_data["students"]:
            pytest.skip("No students available to test validation")
        
        student_id = reg_data["students"][0]["student_id"]
        
        # Test invalid grade above 20
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [
                {
                    "student_id": student_id,
                    "attitude_grade": 25  # Invalid - above 20
                }
            ]
        }
        
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 400, f"Expected 400 for invalid grade, got {res.status_code}"
        print(f"✓ Grade validation (>20) works: {res.json()}")
        
        # Test invalid grade below 0
        payload["grades"][0]["attitude_grade"] = -5  # Invalid - below 0
        res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert res.status_code == 400, f"Expected 400 for negative grade, got {res.status_code}"
        print(f"✓ Grade validation (<0) works: {res.json()}")
    
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
        print("✓ Save endpoint requires auth")


class TestGradeLocking:
    """Test period locking and unlocking"""
    
    def test_lock_period(self, headers):
        """POST /api/grades/lock_period - locks the register"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID
        }
        
        res = requests.post(f"{BASE_URL}/api/grades/lock_period", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        # Verify status is now closed
        verify_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert verify_res.status_code == 200
        assert verify_res.json()["status"] == "closed", "Status should be closed after lock"
        print("✓ Period locked successfully")
    
    def test_unlock_period_admin(self, headers):
        """POST /api/grades/unlock_period - unlocks (admin only)"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID
        }
        
        res = requests.post(f"{BASE_URL}/api/grades/unlock_period", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        # Verify status is now open
        verify_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert verify_res.status_code == 200
        assert verify_res.json()["status"] == "open", "Status should be open after unlock"
        print("✓ Period unlocked successfully")
    
    def test_lock_requires_auth(self):
        """POST /api/grades/lock_period without auth returns 401/403"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID
        }
        res = requests.post(f"{BASE_URL}/api/grades/lock_period", json=payload)
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print("✓ Lock endpoint requires auth")
    
    def test_unlock_requires_auth(self):
        """POST /api/grades/unlock_period without auth returns 401/403"""
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID
        }
        res = requests.post(f"{BASE_URL}/api/grades/unlock_period", json=payload)
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print("✓ Unlock endpoint requires auth")


class TestConsolidated:
    """Test consolidated grades view"""
    
    def test_get_consolidated(self, headers):
        """GET /api/grades/consolidated/{section_id}/{period_id} - returns consolidated view"""
        res = requests.get(
            f"{BASE_URL}/api/grades/consolidated/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        # Verify structure
        assert "students" in data, "Missing students"
        assert "subjects" in data, "Missing subjects"
        assert "section_name" in data, "Missing section_name"
        assert "period_name" in data, "Missing period_name"
        
        # Students should have grades dict, average, rank
        assert isinstance(data["students"], list), "Students should be a list"
        assert isinstance(data["subjects"], list), "Subjects should be a list"
        
        print(f"✓ Consolidated retrieved: {len(data['students'])} students, {len(data['subjects'])} subjects")
        
        # If students exist, verify structure
        if data["students"]:
            student = data["students"][0]
            assert "student_id" in student, "Missing student_id"
            assert "student_name" in student, "Missing student_name"
            assert "grades" in student, "Missing grades dict"
            assert "average" in student, "Missing average"
            assert "rank" in student or student.get("rank") is None, "Missing rank field"
            print(f"✓ Student structure: {student['student_name']}, avg: {student['average']}, rank: {student['rank']}")
    
    def test_consolidated_requires_auth(self):
        """GET /api/grades/consolidated without auth returns 401/403"""
        res = requests.get(
            f"{BASE_URL}/api/grades/consolidated/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print("✓ Consolidated endpoint requires auth")
    
    def test_consolidated_invalid_section(self, headers):
        """GET /api/grades/consolidated with invalid section returns 404"""
        res = requests.get(
            f"{BASE_URL}/api/grades/consolidated/invalid-section-id/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        print("✓ Invalid section returns 404")


class TestConsolidatedExport:
    """Test Excel export for consolidated grades"""
    
    def test_export_excel(self, headers):
        """GET /api/grades/consolidated/{section_id}/{period_id}/export/excel - returns Excel file"""
        res = requests.get(
            f"{BASE_URL}/api/grades/consolidated/{TEST_SECTION_ID}/{TEST_PERIOD_ID}/export/excel",
            headers=headers
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        # Verify content type is Excel
        content_type = res.headers.get("Content-Type", "")
        assert "spreadsheetml" in content_type or "application/vnd" in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Verify Content-Disposition has filename
        disposition = res.headers.get("Content-Disposition", "")
        assert "filename" in disposition, f"Missing filename in Content-Disposition: {disposition}"
        assert ".xlsx" in disposition, f"Expected .xlsx file: {disposition}"
        
        # Verify we got actual content
        assert len(res.content) > 0, "Empty Excel file"
        print(f"✓ Excel export successful: {len(res.content)} bytes, {disposition}")
    
    def test_export_requires_auth(self):
        """GET /api/grades/consolidated/.../export/excel without auth returns 401/403"""
        res = requests.get(
            f"{BASE_URL}/api/grades/consolidated/{TEST_SECTION_ID}/{TEST_PERIOD_ID}/export/excel"
        )
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print("✓ Excel export requires auth")


class TestFinalGradeCalculation:
    """Test final grade calculation with weighted formula"""
    
    def test_final_grade_calculated_on_save(self, headers):
        """Verify final grade is calculated using weighted formula"""
        # Get students
        reg_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert reg_res.status_code == 200
        reg_data = reg_res.json()
        
        if not reg_data["students"]:
            pytest.skip("No students available")
        
        student = reg_data["students"][0]
        student_id = student["student_id"]
        
        # Save specific grades to verify calculation
        # Formula: ACT*0.10 + RF*0.25 + COMP*0.05 + PART*0.25 + EM*0.15 + EB*0.20
        payload = {
            "subject_id": TEST_SUBJECT_ID,
            "section_id": TEST_SECTION_ID,
            "period_id": TEST_PERIOD_ID,
            "grades": [
                {
                    "student_id": student_id,
                    "attitude_grade": 10,        # 10 * 0.10 = 1.0
                    "worksheets_grade": 12,      # 12 * 0.25 = 3.0
                    "competency_grade": 14,      # 14 * 0.05 = 0.7
                    "participation_grade": 16,   # 16 * 0.25 = 4.0
                    "monthly_exam_grade": 18,    # 18 * 0.15 = 2.7
                    "bimestral_exam_grade": 20   # 20 * 0.20 = 4.0
                    # Total = 1.0 + 3.0 + 0.7 + 4.0 + 2.7 + 4.0 = 15.4
                }
            ]
        }
        
        save_res = requests.post(f"{BASE_URL}/api/grades/save", json=payload, headers=headers)
        assert save_res.status_code == 200
        
        # Verify final grade
        verify_res = requests.get(
            f"{BASE_URL}/api/grades/register/{TEST_SUBJECT_ID}/{TEST_SECTION_ID}/{TEST_PERIOD_ID}",
            headers=headers
        )
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        
        saved_student = next((s for s in verify_data["students"] if s["student_id"] == student_id), None)
        assert saved_student is not None
        
        # Check final grade is approximately correct (allowing for rounding)
        final_grade = saved_student.get("final_grade")
        assert final_grade is not None, "Final grade should be calculated"
        expected_final = 15.4  # Calculated above
        assert abs(final_grade - expected_final) < 0.2, \
            f"Final grade {final_grade} should be close to {expected_final}"
        print(f"✓ Final grade calculation verified: {final_grade} (expected ~{expected_final})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
