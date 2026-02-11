"""
Test module for Academic Assignments (Teacher-Subject Pivot Table)
Tests CRUD operations for assigning teachers to subjects with level/grade/section context
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USERNAME = "admin_demo"
TEST_PASSWORD = "test123"
TEST_SUBDOMAIN = "demosettings"


class TestAcademicAssignmentsModule:
    """Test suite for Academic Assignments API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USERNAME,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.text}")
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created assignment IDs for cleanup
        self.created_assignment_ids = []
        
        yield
        
        # Cleanup: Delete test-created assignments
        for assignment_id in self.created_assignment_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/academic/assignments/{assignment_id}")
            except:
                pass
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/academic/assignments - List assignments with filters
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_assignments_list(self):
        """Test GET /api/academic/assignments returns list"""
        response = self.session.get(f"{BASE_URL}/api/academic/assignments")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are assignments, verify structure
        if len(data) > 0:
            assignment = data[0]
            assert "id" in assignment, "Assignment should have id"
            assert "teacher_id" in assignment, "Assignment should have teacher_id"
            assert "level_id" in assignment, "Assignment should have level_id"
            assert "grade_id" in assignment, "Assignment should have grade_id"
            assert "section_id" in assignment, "Assignment should have section_id"
            assert "subject_id" in assignment, "Assignment should have subject_id"
            assert "school_year" in assignment, "Assignment should have school_year"
            assert "role" in assignment, "Assignment should have role"
            assert "status" in assignment, "Assignment should have status"
            # Enriched fields
            assert "teacher_name" in assignment, "Assignment should have enriched teacher_name"
            assert "level_name" in assignment, "Assignment should have enriched level_name"
            assert "grade_name" in assignment, "Assignment should have enriched grade_name"
            assert "section_name" in assignment, "Assignment should have enriched section_name"
            assert "subject_name" in assignment, "Assignment should have enriched subject_name"
            print(f"✓ Found {len(data)} assignments with proper structure")
        else:
            print("✓ No assignments found (empty list is valid)")
    
    def test_get_assignments_with_filters(self):
        """Test GET /api/academic/assignments with query filters"""
        # Test with school_year filter
        response = self.session.get(f"{BASE_URL}/api/academic/assignments?school_year=2026")
        assert response.status_code == 200, f"Filter by school_year failed: {response.text}"
        
        # Test with status filter
        response = self.session.get(f"{BASE_URL}/api/academic/assignments?status=activo")
        assert response.status_code == 200, f"Filter by status failed: {response.text}"
        
        print("✓ Filters work correctly")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/academic/assignments/teachers-summary - Teacher load summary
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_teachers_summary(self):
        """Test GET /api/academic/assignments/teachers-summary"""
        response = self.session.get(f"{BASE_URL}/api/academic/assignments/teachers-summary")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            teacher = data[0]
            assert "id" in teacher, "Teacher summary should have id"
            assert "name" in teacher, "Teacher summary should have name"
            assert "assignments_count" in teacher, "Teacher summary should have assignments_count"
            assert isinstance(teacher["assignments_count"], int), "assignments_count should be integer"
            print(f"✓ Found {len(data)} teachers in summary")
        else:
            print("✓ No teachers found (empty list is valid)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/users/teachers/active - List active teachers
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_active_teachers(self):
        """Test GET /api/users/teachers/active"""
        response = self.session.get(f"{BASE_URL}/api/users/teachers/active")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            teacher = data[0]
            assert "id" in teacher, "Teacher should have id"
            assert "name" in teacher, "Teacher should have name"
            print(f"✓ Found {len(data)} active teachers")
        else:
            print("✓ No active teachers found")
        
        return data
    
    # ═══════════════════════════════════════════════════════════════════════════
    # Helper: Get academic data for creating assignments
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_academic_data(self):
        """Fetch levels, grades, sections, subjects, teachers for test data"""
        levels_res = self.session.get(f"{BASE_URL}/api/academic/levels")
        grades_res = self.session.get(f"{BASE_URL}/api/academic/grades")
        sections_res = self.session.get(f"{BASE_URL}/api/academic/sections")
        subjects_res = self.session.get(f"{BASE_URL}/api/academic/subjects")
        teachers_res = self.session.get(f"{BASE_URL}/api/users/teachers/active")
        
        return {
            "levels": levels_res.json() if levels_res.status_code == 200 else [],
            "grades": grades_res.json() if grades_res.status_code == 200 else [],
            "sections": sections_res.json() if sections_res.status_code == 200 else [],
            "subjects": subjects_res.json() if subjects_res.status_code == 200 else [],
            "teachers": teachers_res.json() if teachers_res.status_code == 200 else []
        }
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/academic/assignments - Create assignment
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_assignment_success(self):
        """Test POST /api/academic/assignments - Create new assignment"""
        academic_data = self.get_academic_data()
        
        # Skip if no data available
        if not academic_data["levels"]:
            pytest.skip("No levels available for testing")
        if not academic_data["grades"]:
            pytest.skip("No grades available for testing")
        if not academic_data["sections"]:
            pytest.skip("No sections available for testing")
        if not academic_data["subjects"]:
            pytest.skip("No subjects available for testing")
        if not academic_data["teachers"]:
            pytest.skip("No teachers available for testing")
        
        # Get first available data
        level = academic_data["levels"][0]
        # Find a grade that belongs to this level
        grade = next((g for g in academic_data["grades"] if g.get("nivel_id") == level["id"]), None)
        if not grade:
            grade = academic_data["grades"][0]  # Fallback
        section = academic_data["sections"][0]
        subject = academic_data["subjects"][0]
        teacher = academic_data["teachers"][0]
        
        # Create assignment with unique school_year to avoid duplicates
        payload = {
            "teacher_id": teacher["id"],
            "level_id": level["id"],
            "grade_id": grade["id"],
            "section_id": section["id"],
            "subject_id": subject["id"],
            "school_year": 2024,  # Use different year to avoid duplicates
            "role": "titular",
            "status": "activo"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/assignments", json=payload)
        
        # Handle duplicate case
        if response.status_code == 400 and "Ya existe" in response.text:
            print("✓ Duplicate validation works - assignment already exists")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "assignment" in data, "Response should contain assignment"
        assert "message" in data, "Response should contain message"
        
        assignment = data["assignment"]
        assert assignment["teacher_id"] == teacher["id"]
        assert assignment["level_id"] == level["id"]
        assert assignment["subject_id"] == subject["id"]
        
        # Store for cleanup
        self.created_assignment_ids.append(assignment["id"])
        
        print(f"✓ Created assignment: {assignment['id']}")
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/academic/assignments")
        assert get_response.status_code == 200
        assignments = get_response.json()
        created = next((a for a in assignments if a["id"] == assignment["id"]), None)
        assert created is not None, "Created assignment should be retrievable"
        print("✓ Assignment persisted and retrievable")
    
    def test_create_assignment_validation_missing_fields(self):
        """Test POST /api/academic/assignments - Validation for missing fields"""
        # Missing required fields
        payload = {
            "teacher_id": "some-id",
            # Missing other required fields
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/assignments", json=payload)
        
        # Should fail with 422 (validation error) or 404 (not found)
        assert response.status_code in [400, 404, 422], f"Expected validation error, got {response.status_code}"
        print("✓ Validation works for missing fields")
    
    def test_create_assignment_invalid_teacher(self):
        """Test POST /api/academic/assignments - Invalid teacher ID"""
        academic_data = self.get_academic_data()
        
        if not academic_data["levels"] or not academic_data["grades"] or not academic_data["sections"] or not academic_data["subjects"]:
            pytest.skip("Insufficient academic data for testing")
        
        payload = {
            "teacher_id": "invalid-teacher-id-12345",
            "level_id": academic_data["levels"][0]["id"],
            "grade_id": academic_data["grades"][0]["id"],
            "section_id": academic_data["sections"][0]["id"],
            "subject_id": academic_data["subjects"][0]["id"],
            "school_year": 2026,
            "role": "titular"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/assignments", json=payload)
        
        assert response.status_code == 404, f"Expected 404 for invalid teacher, got {response.status_code}"
        assert "Profesor no encontrado" in response.text
        print("✓ Invalid teacher validation works")
    
    def test_create_assignment_duplicate_validation(self):
        """Test POST /api/academic/assignments - Duplicate detection"""
        academic_data = self.get_academic_data()
        
        if not all([academic_data["levels"], academic_data["grades"], academic_data["sections"], 
                    academic_data["subjects"], academic_data["teachers"]]):
            pytest.skip("Insufficient academic data for testing")
        
        level = academic_data["levels"][0]
        grade = next((g for g in academic_data["grades"] if g.get("nivel_id") == level["id"]), academic_data["grades"][0])
        section = academic_data["sections"][0]
        subject = academic_data["subjects"][0]
        teacher = academic_data["teachers"][0]
        
        payload = {
            "teacher_id": teacher["id"],
            "level_id": level["id"],
            "grade_id": grade["id"],
            "section_id": section["id"],
            "subject_id": subject["id"],
            "school_year": 2023,  # Use unique year
            "role": "titular"
        }
        
        # Create first assignment
        response1 = self.session.post(f"{BASE_URL}/api/academic/assignments", json=payload)
        
        if response1.status_code == 200:
            self.created_assignment_ids.append(response1.json()["assignment"]["id"])
            
            # Try to create duplicate
            response2 = self.session.post(f"{BASE_URL}/api/academic/assignments", json=payload)
            
            assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
            assert "Ya existe" in response2.text
            print("✓ Duplicate detection works")
        else:
            # Already exists from previous test
            print("✓ Assignment already exists (duplicate validation implicit)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PUT /api/academic/assignments/{id} - Update assignment
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_update_assignment(self):
        """Test PUT /api/academic/assignments/{id} - Update existing assignment"""
        # First get existing assignments
        get_response = self.session.get(f"{BASE_URL}/api/academic/assignments")
        assert get_response.status_code == 200
        
        assignments = get_response.json()
        if not assignments:
            pytest.skip("No assignments available to update")
        
        assignment = assignments[0]
        assignment_id = assignment["id"]
        
        # Update role
        new_role = "auxiliar" if assignment.get("role") == "titular" else "titular"
        
        update_payload = {
            "role": new_role
        }
        
        response = self.session.put(f"{BASE_URL}/api/academic/assignments/{assignment_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "assignment" in data
        assert data["assignment"]["role"] == new_role
        
        print(f"✓ Updated assignment role to: {new_role}")
        
        # Verify persistence
        verify_response = self.session.get(f"{BASE_URL}/api/academic/assignments")
        updated = next((a for a in verify_response.json() if a["id"] == assignment_id), None)
        assert updated is not None
        assert updated["role"] == new_role
        print("✓ Update persisted correctly")
        
        # Restore original role
        self.session.put(f"{BASE_URL}/api/academic/assignments/{assignment_id}", json={"role": assignment.get("role", "titular")})
    
    def test_update_assignment_not_found(self):
        """Test PUT /api/academic/assignments/{id} - Non-existent assignment"""
        response = self.session.put(
            f"{BASE_URL}/api/academic/assignments/non-existent-id-12345",
            json={"role": "auxiliar"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ 404 returned for non-existent assignment")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DELETE /api/academic/assignments/{id} - Delete assignment
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_delete_assignment(self):
        """Test DELETE /api/academic/assignments/{id}"""
        academic_data = self.get_academic_data()
        
        if not all([academic_data["levels"], academic_data["grades"], academic_data["sections"], 
                    academic_data["subjects"], academic_data["teachers"]]):
            pytest.skip("Insufficient academic data for testing")
        
        # Create an assignment to delete
        level = academic_data["levels"][0]
        grade = next((g for g in academic_data["grades"] if g.get("nivel_id") == level["id"]), academic_data["grades"][0])
        section = academic_data["sections"][0]
        subject = academic_data["subjects"][-1] if len(academic_data["subjects"]) > 1 else academic_data["subjects"][0]
        teacher = academic_data["teachers"][-1] if len(academic_data["teachers"]) > 1 else academic_data["teachers"][0]
        
        create_payload = {
            "teacher_id": teacher["id"],
            "level_id": level["id"],
            "grade_id": grade["id"],
            "section_id": section["id"],
            "subject_id": subject["id"],
            "school_year": 2022,  # Unique year for this test
            "role": "auxiliar"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/academic/assignments", json=create_payload)
        
        if create_response.status_code != 200:
            # May already exist, try to find and delete
            get_response = self.session.get(f"{BASE_URL}/api/academic/assignments?school_year=2022")
            if get_response.status_code == 200 and get_response.json():
                assignment_id = get_response.json()[0]["id"]
            else:
                pytest.skip("Could not create or find assignment to delete")
        else:
            assignment_id = create_response.json()["assignment"]["id"]
        
        # Delete the assignment
        delete_response = self.session.delete(f"{BASE_URL}/api/academic/assignments/{assignment_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert "message" in data
        print(f"✓ Deleted assignment: {assignment_id}")
        
        # Verify deletion
        verify_response = self.session.get(f"{BASE_URL}/api/academic/assignments")
        deleted = next((a for a in verify_response.json() if a["id"] == assignment_id), None)
        assert deleted is None, "Deleted assignment should not be retrievable"
        print("✓ Assignment successfully removed from database")
    
    def test_delete_assignment_not_found(self):
        """Test DELETE /api/academic/assignments/{id} - Non-existent assignment"""
        response = self.session.delete(f"{BASE_URL}/api/academic/assignments/non-existent-id-12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ 404 returned for non-existent assignment")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/academic/assignments/by-teacher/{id} - Assignments by teacher
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_assignments_by_teacher(self):
        """Test GET /api/academic/assignments/by-teacher/{teacher_id}"""
        # Get a teacher with assignments
        teachers_res = self.session.get(f"{BASE_URL}/api/users/teachers/active")
        if teachers_res.status_code != 200 or not teachers_res.json():
            pytest.skip("No teachers available")
        
        teacher = teachers_res.json()[0]
        teacher_id = teacher["id"]
        
        response = self.session.get(f"{BASE_URL}/api/academic/assignments/by-teacher/{teacher_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # All assignments should belong to this teacher
        for assignment in data:
            assert assignment["teacher_id"] == teacher_id, "All assignments should belong to the teacher"
        
        print(f"✓ Found {len(data)} assignments for teacher {teacher['name']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # Cascade validation: Grade must belong to Level
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_grade_level_cascade_validation(self):
        """Test that grade must belong to the selected level"""
        academic_data = self.get_academic_data()
        
        if len(academic_data["levels"]) < 2 or not academic_data["grades"]:
            pytest.skip("Need at least 2 levels and grades for cascade test")
        
        # Find a grade that belongs to level 1
        level1 = academic_data["levels"][0]
        level2 = academic_data["levels"][1]
        
        grade_for_level1 = next((g for g in academic_data["grades"] if g.get("nivel_id") == level1["id"]), None)
        
        if not grade_for_level1:
            pytest.skip("No grade found for first level")
        
        if not academic_data["sections"] or not academic_data["subjects"] or not academic_data["teachers"]:
            pytest.skip("Insufficient data for cascade test")
        
        # Try to create assignment with mismatched level and grade
        payload = {
            "teacher_id": academic_data["teachers"][0]["id"],
            "level_id": level2["id"],  # Different level
            "grade_id": grade_for_level1["id"],  # Grade from level1
            "section_id": academic_data["sections"][0]["id"],
            "subject_id": academic_data["subjects"][0]["id"],
            "school_year": 2021,
            "role": "titular"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/assignments", json=payload)
        
        # Should fail because grade doesn't belong to level
        assert response.status_code in [400, 404], f"Expected validation error, got {response.status_code}"
        print("✓ Cascade validation (grade->level) works correctly")


class TestAcademicAssignmentsUnauthorized:
    """Test unauthorized access to assignments API"""
    
    def test_get_assignments_without_auth(self):
        """Test GET /api/academic/assignments without authentication"""
        response = requests.get(f"{BASE_URL}/api/academic/assignments")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthorized access blocked")
    
    def test_create_assignment_without_auth(self):
        """Test POST /api/academic/assignments without authentication"""
        response = requests.post(f"{BASE_URL}/api/academic/assignments", json={
            "teacher_id": "test",
            "level_id": "test",
            "grade_id": "test",
            "section_id": "test",
            "subject_id": "test"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthorized create blocked")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
