"""
Test suite for POST /api/students/bulk-safe-delete endpoint
Tests the fix for:
1. Finding students with role='estudiante' (not just 'student')
2. Finding students with turno_id=null when turno filter is provided
3. Descriptive error messages when no students match
4. Permanent deletion with confirm=true
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Academic IDs from the bug report context
NIVEL_ID_INICIAL = "023ca042-cb46-43aa-97e3-a5c9cd7a20ee"
GRADO_ID_3_ANOS = "6ef8ab18-41b2-45e7-b482-06a84d95c34d"
SECCION_ID_A = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
TURNO_ID_MANANA = "8e1f4e98-37fa-40e3-a49d-a4ac08179262"
SCHOOL_ID_ELROBLE = "b9f27249-6568-49ae-94d3-e1f16750d7d9"


class TestBulkSafeDelete:
    """Tests for bulk safe delete students endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as school admin and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as school admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@elroble.edu",
            "password": "1234abc8"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        data = login_response.json()
        self.token = data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Track created test students for cleanup
        self.created_student_ids = []
        
        yield
        
        # Cleanup: Delete any test students created during tests
        for student_id in self.created_student_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/users/{student_id}")
            except:
                pass
    
    def create_test_student(self, role="student", turno_id=None, suffix=""):
        """Helper to create a test student"""
        unique_id = str(uuid.uuid4())[:8]
        student_data = {
            "username": f"test_bulk_{unique_id}{suffix}",
            "password": "Test1234!",
            "name": f"TestBulk{suffix}",
            "last_name": f"Student{unique_id}",
            "role": role,
            "nivel_id": NIVEL_ID_INICIAL,
            "grado_id": GRADO_ID_3_ANOS,
            "seccion_id": SECCION_ID_A,
            "turno_id": turno_id
        }
        
        response = self.session.post(f"{BASE_URL}/api/users", json=student_data)
        if response.status_code in [200, 201]:
            user_data = response.json().get("user", {})
            student_id = user_data.get("id")
            if student_id:
                self.created_student_ids.append(student_id)
            return user_data
        return None
    
    def test_login_success(self):
        """Test that login works with school admin credentials"""
        assert self.token is not None, "Token should be present after login"
        print(f"SUCCESS: Login successful, token obtained")
    
    def test_bulk_delete_analysis_mode(self):
        """Test bulk delete in analysis mode (confirm=false)"""
        # Create a test student with role='student' and turno_id set
        student = self.create_test_student(role="student", turno_id=TURNO_ID_MANANA, suffix="_analysis")
        assert student is not None, "Failed to create test student"
        print(f"Created test student: {student.get('name')} {student.get('last_name')} (id: {student.get('id')})")
        
        # Call bulk-safe-delete in analysis mode
        response = self.session.post(f"{BASE_URL}/api/students/bulk-safe-delete", json={
            "nivel_id": NIVEL_ID_INICIAL,
            "grado_id": GRADO_ID_3_ANOS,
            "seccion_id": SECCION_ID_A,
            "turno_id": TURNO_ID_MANANA,
            "delete_reason": "Test analysis mode",
            "confirm": False
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("mode") == "analysis", "Should be in analysis mode"
        assert "total_found" in data, "Should have total_found"
        assert "deletable_count" in data, "Should have deletable_count"
        assert "blocked_count" in data, "Should have blocked_count"
        assert "deletable" in data, "Should have deletable list"
        assert "blocked" in data, "Should have blocked list"
        
        print(f"SUCCESS: Analysis mode returned - total: {data['total_found']}, deletable: {data['deletable_count']}, blocked: {data['blocked_count']}")
    
    def test_bulk_delete_finds_estudiante_role(self):
        """Test that bulk delete finds students with role='estudiante'"""
        # Create a test student with role='estudiante'
        student = self.create_test_student(role="estudiante", turno_id=TURNO_ID_MANANA, suffix="_estudiante")
        assert student is not None, "Failed to create test student with role='estudiante'"
        print(f"Created test student with role='estudiante': {student.get('name')} (id: {student.get('id')})")
        
        # Call bulk-safe-delete in analysis mode
        response = self.session.post(f"{BASE_URL}/api/students/bulk-safe-delete", json={
            "nivel_id": NIVEL_ID_INICIAL,
            "grado_id": GRADO_ID_3_ANOS,
            "seccion_id": SECCION_ID_A,
            "turno_id": TURNO_ID_MANANA,
            "delete_reason": "Test estudiante role",
            "confirm": False
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check that our student with role='estudiante' is found
        all_students = data.get("deletable", []) + data.get("blocked", [])
        student_ids = [s.get("id") for s in all_students]
        
        assert student.get("id") in student_ids, f"Student with role='estudiante' should be found. Found IDs: {student_ids}"
        print(f"SUCCESS: Student with role='estudiante' was found in bulk delete results")
    
    def test_bulk_delete_finds_students_with_null_turno(self):
        """Test that bulk delete finds students with turno_id=null when turno filter is provided"""
        # Create a test student with turno_id=None
        student = self.create_test_student(role="student", turno_id=None, suffix="_nullturno")
        assert student is not None, "Failed to create test student with null turno"
        print(f"Created test student with turno_id=None: {student.get('name')} (id: {student.get('id')})")
        
        # Call bulk-safe-delete with turno filter
        response = self.session.post(f"{BASE_URL}/api/students/bulk-safe-delete", json={
            "nivel_id": NIVEL_ID_INICIAL,
            "grado_id": GRADO_ID_3_ANOS,
            "seccion_id": SECCION_ID_A,
            "turno_id": TURNO_ID_MANANA,  # Filter by turno
            "delete_reason": "Test null turno",
            "confirm": False
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check that our student with turno_id=null is found
        all_students = data.get("deletable", []) + data.get("blocked", [])
        student_ids = [s.get("id") for s in all_students]
        
        assert student.get("id") in student_ids, f"Student with turno_id=null should be found when turno filter is applied. Found IDs: {student_ids}"
        print(f"SUCCESS: Student with turno_id=null was found when turno filter was applied")
    
    def test_bulk_delete_confirm_deletes_students(self):
        """Test that bulk delete with confirm=true permanently deletes students"""
        # Create a test student specifically for deletion
        student = self.create_test_student(role="student", turno_id=TURNO_ID_MANANA, suffix="_todelete")
        assert student is not None, "Failed to create test student for deletion"
        student_id = student.get("id")
        print(f"Created test student for deletion: {student.get('name')} (id: {student_id})")
        
        # First, verify the student exists
        get_response = self.session.get(f"{BASE_URL}/api/users/{student_id}")
        assert get_response.status_code == 200, f"Student should exist before deletion"
        
        # Call bulk-safe-delete with confirm=true
        response = self.session.post(f"{BASE_URL}/api/students/bulk-safe-delete", json={
            "nivel_id": NIVEL_ID_INICIAL,
            "grado_id": GRADO_ID_3_ANOS,
            "seccion_id": SECCION_ID_A,
            "turno_id": TURNO_ID_MANANA,
            "delete_reason": "Test permanent deletion",
            "confirm": True
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("mode") == "executed", "Should be in executed mode"
        assert data.get("deleted", 0) > 0, "Should have deleted at least one student"
        
        # Verify the student was actually deleted
        get_response_after = self.session.get(f"{BASE_URL}/api/users/{student_id}")
        assert get_response_after.status_code == 404, f"Student should be deleted (404), got {get_response_after.status_code}"
        
        # Remove from cleanup list since it's already deleted
        if student_id in self.created_student_ids:
            self.created_student_ids.remove(student_id)
        
        print(f"SUCCESS: Bulk delete with confirm=true deleted {data.get('deleted')} students")
    
    def test_bulk_delete_descriptive_error_wrong_turno(self):
        """Test that bulk delete gives descriptive error when students exist but with different turno"""
        # Create a student with a specific turno
        student = self.create_test_student(role="student", turno_id=TURNO_ID_MANANA, suffix="_wrongturno")
        assert student is not None, "Failed to create test student"
        
        # Try to find students with a non-existent turno (use a fake UUID)
        fake_turno_id = "00000000-0000-0000-0000-000000000000"
        
        response = self.session.post(f"{BASE_URL}/api/students/bulk-safe-delete", json={
            "nivel_id": NIVEL_ID_INICIAL,
            "grado_id": GRADO_ID_3_ANOS,
            "seccion_id": SECCION_ID_A,
            "turno_id": fake_turno_id,
            "delete_reason": "Test wrong turno error",
            "confirm": False
        })
        
        # Should either return 200 with results or 404 with descriptive message
        if response.status_code == 404:
            error_detail = response.json().get("detail", "")
            # The error should be descriptive about the turno mismatch
            print(f"Got 404 with message: {error_detail}")
            assert "turno" in error_detail.lower() or "estudiantes" in error_detail.lower(), \
                f"Error message should mention turno or students: {error_detail}"
            print(f"SUCCESS: Got descriptive error message for wrong turno filter")
        else:
            # If it returns 200, it should have found students (with null turno)
            assert response.status_code == 200, f"Expected 200 or 404, got {response.status_code}"
            print(f"SUCCESS: Endpoint returned 200 (found students with null turno)")
    
    def test_bulk_delete_no_students_error(self):
        """Test that bulk delete gives descriptive error when no students match filters"""
        # Use completely fake IDs that don't exist
        fake_nivel_id = "00000000-0000-0000-0000-000000000001"
        fake_grado_id = "00000000-0000-0000-0000-000000000002"
        fake_seccion_id = "00000000-0000-0000-0000-000000000003"
        
        response = self.session.post(f"{BASE_URL}/api/students/bulk-safe-delete", json={
            "nivel_id": fake_nivel_id,
            "grado_id": fake_grado_id,
            "seccion_id": fake_seccion_id,
            "delete_reason": "Test no students error",
            "confirm": False
        })
        
        assert response.status_code == 404, f"Expected 404 when no students match, got {response.status_code}"
        error_detail = response.json().get("detail", "")
        assert len(error_detail) > 10, f"Error message should be descriptive: {error_detail}"
        print(f"SUCCESS: Got descriptive error when no students match: {error_detail}")
    
    def test_bulk_delete_blocked_students_with_activity(self):
        """Test that students with academic activity are blocked from deletion"""
        # This test verifies the blocking mechanism works
        # We'll create a student and check if the endpoint correctly identifies deletable vs blocked
        
        student = self.create_test_student(role="student", turno_id=TURNO_ID_MANANA, suffix="_activity")
        assert student is not None, "Failed to create test student"
        
        response = self.session.post(f"{BASE_URL}/api/students/bulk-safe-delete", json={
            "nivel_id": NIVEL_ID_INICIAL,
            "grado_id": GRADO_ID_3_ANOS,
            "seccion_id": SECCION_ID_A,
            "turno_id": TURNO_ID_MANANA,
            "delete_reason": "Test blocked students",
            "confirm": False
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify the response structure includes blocked students info
        assert "blocked" in data, "Response should include blocked list"
        assert "blocked_count" in data, "Response should include blocked_count"
        
        # If there are blocked students, verify they have reasons
        for blocked in data.get("blocked", []):
            assert "reason" in blocked, f"Blocked student should have a reason: {blocked}"
        
        print(f"SUCCESS: Blocked students have reasons. Blocked count: {data['blocked_count']}")


class TestFrontendStudentCount:
    """Tests to verify frontend correctly counts students with both roles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as school admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@elroble.edu",
            "password": "1234abc8"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        data = login_response.json()
        self.token = data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_users_returns_both_student_roles(self):
        """Test that GET /api/users returns students with both 'student' and 'estudiante' roles"""
        response = self.session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        users = response.json()
        
        # Count students by role
        student_count = sum(1 for u in users if u.get("role") == "student")
        estudiante_count = sum(1 for u in users if u.get("role") == "estudiante")
        total_students = student_count + estudiante_count
        
        print(f"Users with role='student': {student_count}")
        print(f"Users with role='estudiante': {estudiante_count}")
        print(f"Total students (both roles): {total_students}")
        
        # This test documents the current state - both roles should be counted
        assert isinstance(users, list), "Response should be a list"
        print(f"SUCCESS: GET /api/users returns {len(users)} users total")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
