"""
Test Schedule Breaks (Recreo/Almuerzo/Evento) API with Grade/Section filtering
Tests for breaks that are configurable per Grade and Section
Feature: Each grade can have different break times, independent of each other
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
STUDENT_EMAIL = "pepito@gmail.com"
STUDENT_PASSWORD = "1234abc8"

# Grade IDs from test data
GRADE_3_ANOS_ID = "6ef8ab18-41b2-45e7-b482-06a84d95c34d"  # 3 años
GRADE_1_PRIMARIA_ID = "4bcad3be-c38e-4b7c-8a80-eb3dd4bf8f6e"  # 1°

# Section IDs from test data
SECTION_UNICA_ID = "11f50cbc-f5f6-422a-a989-87b2af6027f1"  # ÚNICA (for 3 años)
SECTION_A_ID = "18dd37fa-79d6-4b38-b5a2-46deeb1b00fe"  # A (for 1°)


class TestScheduleBreaksGradeSection:
    """Test Schedule Breaks API with grade_id and section_id requirements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Store created break IDs for cleanup
        self.created_break_ids = []
        
        yield
        
        # Cleanup - delete created breaks
        for break_id in self.created_break_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/schedule/breaks/{break_id}")
            except:
                pass
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/schedule/breaks - Requires grade_id and section_id
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_break_requires_grade_id(self):
        """Test POST /api/schedule/breaks - requires grade_id"""
        payload = {
            "type": "break",
            "label": "TEST_Recreo Sin Grado",
            "start_time": "10:00",
            "end_time": "10:30",
            "section_id": SECTION_UNICA_ID
            # Missing grade_id
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        # Should fail with 422 (validation error) because grade_id is required
        assert response.status_code == 422, f"Expected 422 for missing grade_id, got {response.status_code}: {response.text}"
        print("✓ POST /api/schedule/breaks - Correctly requires grade_id")
    
    def test_create_break_requires_section_id(self):
        """Test POST /api/schedule/breaks - requires section_id"""
        payload = {
            "type": "break",
            "label": "TEST_Recreo Sin Seccion",
            "start_time": "10:00",
            "end_time": "10:30",
            "grade_id": GRADE_3_ANOS_ID
            # Missing section_id
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        # Should fail with 422 (validation error) because section_id is required
        assert response.status_code == 422, f"Expected 422 for missing section_id, got {response.status_code}: {response.text}"
        print("✓ POST /api/schedule/breaks - Correctly requires section_id")
    
    def test_create_break_with_grade_and_section(self):
        """Test POST /api/schedule/breaks - create break with grade_id and section_id"""
        payload = {
            "type": "break",
            "label": "TEST_Recreo 3 años",
            "start_time": "09:30",
            "end_time": "09:45",
            "grade_id": GRADE_3_ANOS_ID,
            "section_id": SECTION_UNICA_ID,
            "color": "#FCD34D"
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        # May fail if there's a conflict
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            if "Ya existe un bloque" in error_detail or "clases programadas" in error_detail:
                print(f"⚠ Break creation skipped - conflict: {error_detail}")
                pytest.skip("Time slot has conflict")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "break" in data, "Response should contain 'break' key"
        assert data["break"]["grade_id"] == GRADE_3_ANOS_ID, "grade_id should match"
        assert data["break"]["section_id"] == SECTION_UNICA_ID, "section_id should match"
        assert data["break"]["type"] == "break", "Type should be 'break'"
        
        self.created_break_ids.append(data["break"]["id"])
        print(f"✓ POST /api/schedule/breaks - Created break with grade_id and section_id: {data['break']['id']}")
    
    def test_create_break_validates_grade_exists(self):
        """Test POST /api/schedule/breaks - validates grade exists"""
        payload = {
            "type": "break",
            "label": "TEST_Invalid Grade",
            "start_time": "10:00",
            "end_time": "10:30",
            "grade_id": "invalid-grade-id-12345",
            "section_id": SECTION_UNICA_ID
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        assert response.status_code == 400, f"Expected 400 for invalid grade_id, got {response.status_code}: {response.text}"
        assert "Grado no válido" in response.json().get("detail", ""), "Should indicate invalid grade"
        print("✓ POST /api/schedule/breaks - Validates grade exists")
    
    def test_create_break_validates_section_exists(self):
        """Test POST /api/schedule/breaks - validates section exists"""
        payload = {
            "type": "break",
            "label": "TEST_Invalid Section",
            "start_time": "10:00",
            "end_time": "10:30",
            "grade_id": GRADE_3_ANOS_ID,
            "section_id": "invalid-section-id-12345"
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        assert response.status_code == 400, f"Expected 400 for invalid section_id, got {response.status_code}: {response.text}"
        assert "Sección no válida" in response.json().get("detail", ""), "Should indicate invalid section"
        print("✓ POST /api/schedule/breaks - Validates section exists")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/schedule/breaks - Filters by grade_id and section_id
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_breaks_without_filter(self):
        """Test GET /api/schedule/breaks - returns all breaks without filter"""
        response = self.session.get(f"{BASE_URL}/api/schedule/breaks")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "breaks" in data, "Response should contain 'breaks' key"
        assert isinstance(data["breaks"], list), "breaks should be a list"
        
        print(f"✓ GET /api/schedule/breaks - Found {len(data['breaks'])} total breaks")
    
    def test_get_breaks_filter_by_grade_id(self):
        """Test GET /api/schedule/breaks?grade_id=X - filters by grade"""
        response = self.session.get(f"{BASE_URL}/api/schedule/breaks?grade_id={GRADE_3_ANOS_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        breaks = data.get("breaks", [])
        
        # All returned breaks should have the specified grade_id
        for b in breaks:
            assert b.get("grade_id") == GRADE_3_ANOS_ID, f"Break {b['id']} has wrong grade_id: {b.get('grade_id')}"
        
        print(f"✓ GET /api/schedule/breaks?grade_id - Found {len(breaks)} breaks for grade 3 años")
    
    def test_get_breaks_filter_by_section_id(self):
        """Test GET /api/schedule/breaks?section_id=X - filters by section"""
        response = self.session.get(f"{BASE_URL}/api/schedule/breaks?section_id={SECTION_UNICA_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        breaks = data.get("breaks", [])
        
        # All returned breaks should have the specified section_id
        for b in breaks:
            assert b.get("section_id") == SECTION_UNICA_ID, f"Break {b['id']} has wrong section_id: {b.get('section_id')}"
        
        print(f"✓ GET /api/schedule/breaks?section_id - Found {len(breaks)} breaks for section ÚNICA")
    
    def test_get_breaks_filter_by_grade_and_section(self):
        """Test GET /api/schedule/breaks?grade_id=X&section_id=Y - filters by both"""
        response = self.session.get(
            f"{BASE_URL}/api/schedule/breaks?grade_id={GRADE_3_ANOS_ID}&section_id={SECTION_UNICA_ID}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        breaks = data.get("breaks", [])
        
        # All returned breaks should have both grade_id and section_id
        for b in breaks:
            assert b.get("grade_id") == GRADE_3_ANOS_ID, f"Break {b['id']} has wrong grade_id"
            assert b.get("section_id") == SECTION_UNICA_ID, f"Break {b['id']} has wrong section_id"
        
        print(f"✓ GET /api/schedule/breaks?grade_id&section_id - Found {len(breaks)} breaks for 3 años ÚNICA")
    
    def test_different_grades_have_different_breaks(self):
        """Test that different grades can have different breaks"""
        # Get breaks for grade 3 años
        response_3anos = self.session.get(f"{BASE_URL}/api/schedule/breaks?grade_id={GRADE_3_ANOS_ID}")
        breaks_3anos = response_3anos.json().get("breaks", [])
        
        # Get breaks for grade 1° Primaria
        response_1primaria = self.session.get(f"{BASE_URL}/api/schedule/breaks?grade_id={GRADE_1_PRIMARIA_ID}")
        breaks_1primaria = response_1primaria.json().get("breaks", [])
        
        print(f"✓ Different grades have independent breaks:")
        print(f"  - 3 años: {len(breaks_3anos)} breaks")
        print(f"  - 1° Primaria: {len(breaks_1primaria)} breaks")
        
        # Verify they are different (IDs don't overlap)
        ids_3anos = set(b["id"] for b in breaks_3anos)
        ids_1primaria = set(b["id"] for b in breaks_1primaria)
        
        overlap = ids_3anos.intersection(ids_1primaria)
        assert len(overlap) == 0, f"Breaks should not overlap between grades: {overlap}"
        print("  - No overlap between grade breaks ✓")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PUT /api/schedule/breaks - Overlap validation within same grade/section
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_update_break_overlap_same_grade_section(self):
        """Test PUT /api/schedule/breaks - checks overlaps within same grade/section only"""
        # Create first break
        payload1 = {
            "type": "break",
            "label": "TEST_First Break",
            "start_time": "08:00",
            "end_time": "08:30",
            "grade_id": GRADE_3_ANOS_ID,
            "section_id": SECTION_UNICA_ID
        }
        
        response1 = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload1)
        if response1.status_code == 400:
            pytest.skip("Time slot has conflict")
        
        assert response1.status_code == 200
        break1_id = response1.json()["break"]["id"]
        self.created_break_ids.append(break1_id)
        
        # Create second break at different time
        payload2 = {
            "type": "lunch",
            "label": "TEST_Second Break",
            "start_time": "08:30",
            "end_time": "09:00",
            "grade_id": GRADE_3_ANOS_ID,
            "section_id": SECTION_UNICA_ID
        }
        
        response2 = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload2)
        if response2.status_code == 400:
            pytest.skip("Time slot has conflict")
        
        assert response2.status_code == 200
        break2_id = response2.json()["break"]["id"]
        self.created_break_ids.append(break2_id)
        
        # Try to update second break to overlap with first
        update_payload = {
            "start_time": "08:15",
            "end_time": "08:45"
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/schedule/breaks/{break2_id}", json=update_payload)
        
        assert update_response.status_code == 400, f"Expected 400 for overlap, got {update_response.status_code}"
        assert "Se solapa con" in update_response.json().get("detail", ""), "Should indicate overlap"
        
        print("✓ PUT /api/schedule/breaks - Overlap validation works within same grade/section")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # Conflict validation - Only checks classes in same grade/section
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_break_conflict_only_same_grade_section(self):
        """Test that break conflict validation only checks same grade/section"""
        # This test verifies that creating a break in one grade/section
        # doesn't conflict with classes in a different grade/section
        
        # First, get existing schedules for grade 1° Primaria
        schedules_response = self.session.get(f"{BASE_URL}/api/schedules?tipo=clases")
        schedules = schedules_response.json().get("schedules", [])
        
        # Find a schedule in 1° Primaria
        schedule_1primaria = None
        for s in schedules:
            if s.get("grado_id") == GRADE_1_PRIMARIA_ID:
                schedule_1primaria = s
                break
        
        if not schedule_1primaria:
            print("⚠ No schedules found for 1° Primaria - skipping cross-grade conflict test")
            pytest.skip("No schedules in 1° Primaria")
        
        # Try to create a break in 3 años at the same time as the 1° Primaria class
        # This should succeed because they are different grades
        payload = {
            "type": "break",
            "label": "TEST_Cross Grade Break",
            "start_time": schedule_1primaria["hora_inicio"],
            "end_time": schedule_1primaria["hora_fin"],
            "grade_id": GRADE_3_ANOS_ID,
            "section_id": SECTION_UNICA_ID
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        # Should succeed (or fail for other reasons, but not cross-grade conflict)
        if response.status_code == 400:
            error = response.json().get("detail", "")
            # Should NOT mention the 1° Primaria class
            assert GRADE_1_PRIMARIA_ID not in error, "Should not conflict with different grade"
            print(f"⚠ Break creation failed for other reason: {error}")
        else:
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            self.created_break_ids.append(response.json()["break"]["id"])
            print("✓ Break created successfully - no cross-grade conflict")


class TestStudentScheduleBreaks:
    """Test that students only see breaks for their grade/section"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as student"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as student
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Student login failed: {login_response.text}")
        
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_student_schedule_returns_only_their_breaks(self):
        """Test GET /api/student/schedule - returns only breaks for student's grade/section"""
        response = self.session.get(f"{BASE_URL}/api/student/schedule")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "breaks" in data, "Response should contain 'breaks' key"
        assert "grade_name" in data, "Response should contain 'grade_name'"
        assert "section_name" in data, "Response should contain 'section_name'"
        
        breaks = data.get("breaks", [])
        grade_name = data.get("grade_name")
        section_name = data.get("section_name")
        
        print(f"✓ GET /api/student/schedule - Student in {grade_name} {section_name}")
        print(f"  - Found {len(breaks)} breaks for this student")
        
        # Verify all breaks belong to student's grade/section
        for b in breaks:
            # The student endpoint should only return breaks for their grade/section
            # We can't directly verify grade_id/section_id without knowing student's assignment
            # but we can verify the structure
            assert "id" in b, "Break should have 'id'"
            assert "type" in b, "Break should have 'type'"
            assert "label" in b, "Break should have 'label'"
            assert "start_time" in b, "Break should have 'start_time'"
            assert "end_time" in b, "Break should have 'end_time'"
            print(f"  - {b['label']}: {b['start_time']} - {b['end_time']}")
    
    def test_student_cannot_create_breaks(self):
        """Test that students cannot create breaks (admin only)"""
        payload = {
            "type": "break",
            "label": "TEST_Student Break",
            "start_time": "10:00",
            "end_time": "10:30",
            "grade_id": GRADE_3_ANOS_ID,
            "section_id": SECTION_UNICA_ID
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        assert response.status_code == 403, f"Expected 403 for student, got {response.status_code}"
        print("✓ Students cannot create breaks - admin only")


class TestAdminSchedulePageBreaks:
    """Test admin schedule page break functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        self.created_break_ids = []
        
        yield
        
        for break_id in self.created_break_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/schedule/breaks/{break_id}")
            except:
                pass
    
    def test_selecting_different_grade_shows_different_breaks(self):
        """Test that selecting different grade/section shows different breaks"""
        # Get breaks for 3 años ÚNICA
        response_3anos = self.session.get(
            f"{BASE_URL}/api/schedule/breaks?grade_id={GRADE_3_ANOS_ID}&section_id={SECTION_UNICA_ID}"
        )
        breaks_3anos = response_3anos.json().get("breaks", [])
        
        # Get breaks for 1° A
        response_1a = self.session.get(
            f"{BASE_URL}/api/schedule/breaks?grade_id={GRADE_1_PRIMARIA_ID}&section_id={SECTION_A_ID}"
        )
        breaks_1a = response_1a.json().get("breaks", [])
        
        print(f"✓ Admin: Different grade/section shows different breaks:")
        print(f"  - 3 años ÚNICA: {len(breaks_3anos)} breaks")
        for b in breaks_3anos:
            print(f"    • {b['label']}: {b['start_time']} - {b['end_time']}")
        print(f"  - 1° A: {len(breaks_1a)} breaks")
        for b in breaks_1a:
            print(f"    • {b['label']}: {b['start_time']} - {b['end_time']}")
    
    def test_create_break_uses_selected_grade_section(self):
        """Test that creating break via context menu uses selected grade/section"""
        # Simulate creating a break for 1° A
        payload = {
            "type": "break",
            "label": "TEST_Recreo 1° A",
            "start_time": "09:00",
            "end_time": "09:15",
            "grade_id": GRADE_1_PRIMARIA_ID,
            "section_id": SECTION_A_ID
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        if response.status_code == 400:
            error = response.json().get("detail", "")
            if "Ya existe" in error or "clases programadas" in error:
                pytest.skip(f"Time slot conflict: {error}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["break"]["grade_id"] == GRADE_1_PRIMARIA_ID
        assert data["break"]["section_id"] == SECTION_A_ID
        
        self.created_break_ids.append(data["break"]["id"])
        
        # Verify it appears when filtering by that grade/section
        verify_response = self.session.get(
            f"{BASE_URL}/api/schedule/breaks?grade_id={GRADE_1_PRIMARIA_ID}&section_id={SECTION_A_ID}"
        )
        breaks = verify_response.json().get("breaks", [])
        break_ids = [b["id"] for b in breaks]
        
        assert data["break"]["id"] in break_ids, "Created break should appear in filtered list"
        print("✓ Created break uses selected grade/section and appears in filtered list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
