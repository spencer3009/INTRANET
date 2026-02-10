"""
Test suite for Academic Subjects Module
Tests CRUD operations for subjects including:
- Create subject without specific grade (all grades in level)
- Create subject with specific grade
- Edit existing subject
- List subjects with filters (level, grade, status)
- Delete subject
- Grade selector behavior
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"

class TestSubjectsModule:
    """Test suite for subjects CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get levels and grades for testing
        self.levels = self.session.get(f"{BASE_URL}/api/academic/levels").json()
        self.grades = self.session.get(f"{BASE_URL}/api/academic/grades").json()
        
        # Find Primaria level and its grades
        self.primaria_level = next((l for l in self.levels if l.get("nombre") == "Primaria" and l.get("activo")), None)
        if self.primaria_level:
            self.primaria_grades = [g for g in self.grades if g.get("nivel_id") == self.primaria_level["id"] and g.get("activo")]
        else:
            self.primaria_grades = []
        
        yield
        
        # Cleanup: Delete test subjects
        subjects = self.session.get(f"{BASE_URL}/api/academic/subjects").json()
        for subject in subjects:
            if subject.get("code", "").startswith("TEST-"):
                self.session.delete(f"{BASE_URL}/api/academic/subjects/{subject['id']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PREREQUISITE TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_levels_endpoint_works(self):
        """Test that levels endpoint returns data"""
        response = self.session.get(f"{BASE_URL}/api/academic/levels")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} levels")
    
    def test_02_grades_endpoint_works(self):
        """Test that grades endpoint returns data"""
        response = self.session.get(f"{BASE_URL}/api/academic/grades")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} grades")
    
    def test_03_primaria_level_exists(self):
        """Test that Primaria level exists"""
        assert self.primaria_level is not None, "Primaria level not found"
        print(f"✓ Primaria level found: {self.primaria_level['id']}")
    
    def test_04_primaria_has_grades(self):
        """Test that Primaria level has grades"""
        assert len(self.primaria_grades) > 0, "No grades found for Primaria"
        print(f"✓ Primaria has {len(self.primaria_grades)} grades")
        for g in self.primaria_grades:
            print(f"  - {g['nombre']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CREATE SUBJECT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_05_create_subject_without_grade(self):
        """Create subject for all grades in a level (no specific grade)"""
        if not self.primaria_level:
            pytest.skip("Primaria level not found")
        
        unique_code = f"TEST-{str(uuid.uuid4())[:6].upper()}"
        payload = {
            "name": f"TEST Asignatura Sin Grado {unique_code}",
            "code": unique_code,
            "description": "Asignatura de prueba para todos los grados",
            "level_id": self.primaria_level["id"],
            "grade_id": "",  # Empty = all grades
            "weekly_hours": 3,
            "color": "#3B82F6",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=payload)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Failed to create subject: {response.text}"
        data = response.json()
        assert "subject" in data
        assert data["subject"]["name"] == payload["name"]
        assert data["subject"]["level_id"] == self.primaria_level["id"]
        assert data["subject"]["grade_id"] is None or data["subject"]["grade_id"] == ""
        print(f"✓ Created subject without specific grade: {data['subject']['id']}")
    
    def test_06_create_subject_with_specific_grade(self):
        """Create subject for a specific grade - THIS WAS THE BUG FIX"""
        if not self.primaria_level or not self.primaria_grades:
            pytest.skip("Primaria level or grades not found")
        
        # Get first grade of Primaria
        first_grade = self.primaria_grades[0]
        unique_code = f"TEST-{str(uuid.uuid4())[:6].upper()}"
        
        payload = {
            "name": f"TEST Asignatura Con Grado {unique_code}",
            "code": unique_code,
            "description": f"Asignatura de prueba para {first_grade['nombre']}",
            "level_id": self.primaria_level["id"],
            "grade_id": first_grade["id"],  # Specific grade
            "weekly_hours": 4,
            "color": "#10B981",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=payload)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        # THIS IS THE KEY TEST - Previously returned "El grado seleccionado no existe"
        assert response.status_code == 200, f"BUG: Failed to create subject with grade: {response.text}"
        data = response.json()
        assert "subject" in data
        assert data["subject"]["grade_id"] == first_grade["id"]
        print(f"✓ Created subject with specific grade: {first_grade['nombre']}")
    
    def test_07_create_subject_invalid_grade(self):
        """Test that invalid grade_id returns proper error"""
        if not self.primaria_level:
            pytest.skip("Primaria level not found")
        
        payload = {
            "name": "TEST Invalid Grade Subject",
            "code": f"TEST-{str(uuid.uuid4())[:6].upper()}",
            "level_id": self.primaria_level["id"],
            "grade_id": "invalid-grade-id-12345",
            "weekly_hours": 2,
            "color": "#EF4444",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=payload)
        assert response.status_code == 400
        assert "grado" in response.text.lower() or "no existe" in response.text.lower()
        print(f"✓ Invalid grade correctly rejected: {response.json().get('detail')}")
    
    def test_08_create_subject_invalid_level(self):
        """Test that invalid level_id returns proper error"""
        payload = {
            "name": "TEST Invalid Level Subject",
            "code": f"TEST-{str(uuid.uuid4())[:6].upper()}",
            "level_id": "invalid-level-id-12345",
            "grade_id": "",
            "weekly_hours": 2,
            "color": "#EF4444",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=payload)
        assert response.status_code == 400
        assert "nivel" in response.text.lower() or "no existe" in response.text.lower()
        print(f"✓ Invalid level correctly rejected: {response.json().get('detail')}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # LIST AND FILTER TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_09_list_all_subjects(self):
        """List all subjects"""
        response = self.session.get(f"{BASE_URL}/api/academic/subjects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} subjects")
        for s in data[:5]:  # Show first 5
            print(f"  - {s['name']} ({s['code']}) - {s.get('level_name', 'N/A')}")
    
    def test_10_filter_subjects_by_level(self):
        """Filter subjects by level"""
        if not self.primaria_level:
            pytest.skip("Primaria level not found")
        
        response = self.session.get(
            f"{BASE_URL}/api/academic/subjects",
            params={"level_id": self.primaria_level["id"]}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned subjects should be for Primaria
        for subject in data:
            assert subject["level_id"] == self.primaria_level["id"]
        
        print(f"✓ Filtered by Primaria: {len(data)} subjects")
    
    def test_11_filter_subjects_by_grade(self):
        """Filter subjects by specific grade"""
        if not self.primaria_grades:
            pytest.skip("No Primaria grades found")
        
        first_grade = self.primaria_grades[0]
        response = self.session.get(
            f"{BASE_URL}/api/academic/subjects",
            params={"grade_id": first_grade["id"]}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Filtered by grade {first_grade['nombre']}: {len(data)} subjects")
    
    def test_12_filter_subjects_by_status(self):
        """Filter subjects by status"""
        response = self.session.get(
            f"{BASE_URL}/api/academic/subjects",
            params={"status": "active"}
        )
        assert response.status_code == 200
        data = response.json()
        
        for subject in data:
            assert subject["status"] == "active"
        
        print(f"✓ Filtered by active status: {len(data)} subjects")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UPDATE SUBJECT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_13_update_subject(self):
        """Update an existing subject"""
        if not self.primaria_level:
            pytest.skip("Primaria level not found")
        
        # First create a subject
        unique_code = f"TEST-{str(uuid.uuid4())[:6].upper()}"
        create_payload = {
            "name": f"TEST Subject To Update {unique_code}",
            "code": unique_code,
            "level_id": self.primaria_level["id"],
            "grade_id": "",
            "weekly_hours": 2,
            "color": "#3B82F6",
            "status": "active"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=create_payload)
        assert create_response.status_code == 200
        subject_id = create_response.json()["subject"]["id"]
        
        # Now update it
        update_payload = {
            "name": f"TEST Updated Subject {unique_code}",
            "weekly_hours": 5,
            "color": "#EF4444",
            "status": "inactive"
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/academic/subjects/{subject_id}",
            json=update_payload
        )
        
        assert update_response.status_code == 200
        updated = update_response.json()["subject"]
        assert updated["name"] == update_payload["name"]
        assert updated["weekly_hours"] == 5
        assert updated["color"] == "#EF4444"
        assert updated["status"] == "inactive"
        print(f"✓ Updated subject successfully")
    
    def test_14_update_subject_change_grade(self):
        """Update subject to change grade - tests the bug fix"""
        if not self.primaria_level or len(self.primaria_grades) < 2:
            pytest.skip("Need Primaria level with at least 2 grades")
        
        first_grade = self.primaria_grades[0]
        second_grade = self.primaria_grades[1]
        
        # Create subject with first grade
        unique_code = f"TEST-{str(uuid.uuid4())[:6].upper()}"
        create_payload = {
            "name": f"TEST Subject Change Grade {unique_code}",
            "code": unique_code,
            "level_id": self.primaria_level["id"],
            "grade_id": first_grade["id"],
            "weekly_hours": 2,
            "color": "#3B82F6",
            "status": "active"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=create_payload)
        assert create_response.status_code == 200
        subject_id = create_response.json()["subject"]["id"]
        
        # Update to second grade
        update_response = self.session.put(
            f"{BASE_URL}/api/academic/subjects/{subject_id}",
            json={"grade_id": second_grade["id"]}
        )
        
        assert update_response.status_code == 200, f"Failed to update grade: {update_response.text}"
        updated = update_response.json()["subject"]
        assert updated["grade_id"] == second_grade["id"]
        print(f"✓ Changed grade from {first_grade['nombre']} to {second_grade['nombre']}")
    
    def test_15_update_nonexistent_subject(self):
        """Test updating non-existent subject returns 404"""
        response = self.session.put(
            f"{BASE_URL}/api/academic/subjects/nonexistent-id-12345",
            json={"name": "Test"}
        )
        assert response.status_code == 404
        print(f"✓ Non-existent subject correctly returns 404")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DELETE SUBJECT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_16_delete_subject(self):
        """Delete a subject"""
        if not self.primaria_level:
            pytest.skip("Primaria level not found")
        
        # Create a subject to delete
        unique_code = f"TEST-{str(uuid.uuid4())[:6].upper()}"
        create_payload = {
            "name": f"TEST Subject To Delete {unique_code}",
            "code": unique_code,
            "level_id": self.primaria_level["id"],
            "grade_id": "",
            "weekly_hours": 2,
            "color": "#3B82F6",
            "status": "active"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=create_payload)
        assert create_response.status_code == 200
        subject_id = create_response.json()["subject"]["id"]
        
        # Delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/academic/subjects/{subject_id}")
        assert delete_response.status_code == 200
        
        # Verify it's gone
        get_response = self.session.get(f"{BASE_URL}/api/academic/subjects")
        subjects = get_response.json()
        assert not any(s["id"] == subject_id for s in subjects)
        print(f"✓ Deleted subject successfully")
    
    def test_17_delete_nonexistent_subject(self):
        """Test deleting non-existent subject returns 404"""
        response = self.session.delete(f"{BASE_URL}/api/academic/subjects/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"✓ Non-existent subject delete correctly returns 404")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEACHER ASSIGNMENT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_18_get_subject_teachers(self):
        """Get teachers assigned to a subject"""
        # Get existing subjects
        subjects_response = self.session.get(f"{BASE_URL}/api/academic/subjects")
        subjects = subjects_response.json()
        
        if not subjects:
            pytest.skip("No subjects found")
        
        subject = subjects[0]
        response = self.session.get(f"{BASE_URL}/api/academic/subjects/{subject['id']}/teachers")
        assert response.status_code == 200
        data = response.json()
        assert "teachers" in data
        print(f"✓ Got teachers for subject {subject['name']}: {len(data['teachers'])} teachers")
    
    def test_19_assign_teachers_to_subject(self):
        """Assign teachers to a subject"""
        if not self.primaria_level:
            pytest.skip("Primaria level not found")
        
        # Get teachers
        users_response = self.session.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        teachers = [u for u in users if u.get("role") == "teacher"]
        
        if not teachers:
            pytest.skip("No teachers found")
        
        # Create a subject
        unique_code = f"TEST-{str(uuid.uuid4())[:6].upper()}"
        create_payload = {
            "name": f"TEST Subject Teachers {unique_code}",
            "code": unique_code,
            "level_id": self.primaria_level["id"],
            "grade_id": "",
            "weekly_hours": 2,
            "color": "#3B82F6",
            "status": "active"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=create_payload)
        assert create_response.status_code == 200
        subject_id = create_response.json()["subject"]["id"]
        
        # Assign first teacher
        teacher_ids = [teachers[0]["id"]]
        assign_response = self.session.post(
            f"{BASE_URL}/api/academic/subjects/{subject_id}/teachers",
            json={"teacher_ids": teacher_ids}
        )
        
        assert assign_response.status_code == 200
        print(f"✓ Assigned teacher to subject")
        
        # Verify assignment
        get_teachers = self.session.get(f"{BASE_URL}/api/academic/subjects/{subject_id}/teachers")
        assert get_teachers.status_code == 200
        assigned = get_teachers.json()["teachers"]
        assert len(assigned) == 1
        assert assigned[0]["id"] == teachers[0]["id"]
        print(f"✓ Verified teacher assignment")


class TestSubjectsValidation:
    """Test validation rules for subjects"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        self.levels = self.session.get(f"{BASE_URL}/api/academic/levels").json()
        self.primaria_level = next((l for l in self.levels if l.get("nombre") == "Primaria" and l.get("activo")), None)
        
        yield
        
        # Cleanup
        subjects = self.session.get(f"{BASE_URL}/api/academic/subjects").json()
        for subject in subjects:
            if subject.get("code", "").startswith("TEST-"):
                self.session.delete(f"{BASE_URL}/api/academic/subjects/{subject['id']}")
    
    def test_duplicate_code_rejected(self):
        """Test that duplicate codes are rejected"""
        if not self.primaria_level:
            pytest.skip("Primaria level not found")
        
        unique_code = f"TEST-{str(uuid.uuid4())[:6].upper()}"
        payload = {
            "name": f"TEST Duplicate Code 1 {unique_code}",
            "code": unique_code,
            "level_id": self.primaria_level["id"],
            "grade_id": "",
            "weekly_hours": 2,
            "color": "#3B82F6",
            "status": "active"
        }
        
        # Create first
        response1 = self.session.post(f"{BASE_URL}/api/academic/subjects", json=payload)
        assert response1.status_code == 200
        
        # Try to create with same code
        payload["name"] = f"TEST Duplicate Code 2 {unique_code}"
        response2 = self.session.post(f"{BASE_URL}/api/academic/subjects", json=payload)
        assert response2.status_code == 400
        assert "código" in response2.text.lower() or "code" in response2.text.lower()
        print(f"✓ Duplicate code correctly rejected")
    
    def test_missing_name_rejected(self):
        """Test that missing name is rejected"""
        if not self.primaria_level:
            pytest.skip("Primaria level not found")
        
        payload = {
            "name": "",
            "code": f"TEST-{str(uuid.uuid4())[:6].upper()}",
            "level_id": self.primaria_level["id"],
            "grade_id": "",
            "weekly_hours": 2,
            "color": "#3B82F6",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=payload)
        # Should be 422 (validation) or 400 (business rule)
        assert response.status_code in [400, 422]
        print(f"✓ Empty name correctly rejected")
    
    def test_missing_level_rejected(self):
        """Test that missing level is rejected"""
        payload = {
            "name": "TEST No Level Subject",
            "code": f"TEST-{str(uuid.uuid4())[:6].upper()}",
            "level_id": "",
            "grade_id": "",
            "weekly_hours": 2,
            "color": "#3B82F6",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/subjects", json=payload)
        assert response.status_code in [400, 422]
        print(f"✓ Empty level correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
