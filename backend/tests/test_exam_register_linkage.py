"""
Test suite for Exam ↔ Registro Auxiliar (Gradebook) Linkage Feature
Tests the following:
- GET /api/academic/periods - returns bimesters
- GET /api/exams/register-availability - returns slot availability
- POST /api/course/{subject_id}/exams - creates exam with register linkage
- POST /api/course/{subject_id}/exams - 409 conflict on duplicate slot
- DELETE /api/exams/{id} - cleans up register linkage
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials for elroble school
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"
TEST_SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"
TEST_PERIOD_ID_BIM1 = "093a0bee-92c4-449c-b82c-942f16847759"
TEST_PERIOD_ID_BIM2 = "89969bea-6534-43bc-8dc1-f8ae43da3029"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for testing"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "subdomain": TEST_SUBDOMAIN
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestAcademicPeriods:
    """Test GET /api/academic/periods endpoint"""
    
    def test_get_periods_returns_200(self, headers):
        """GET /api/academic/periods returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/academic/periods", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/academic/periods returns 200 OK")
    
    def test_periods_returns_4_bimesters(self, headers):
        """Periods endpoint returns 4 bimesters for elroble school"""
        response = requests.get(f"{BASE_URL}/api/academic/periods", headers=headers)
        assert response.status_code == 200
        periods = response.json()
        
        # Should have at least 4 bimesters
        assert len(periods) >= 4, f"Expected at least 4 periods, got {len(periods)}"
        
        # Check that bimesters are named correctly
        period_names = [p.get("nombre", "") for p in periods]
        bimester_count = sum(1 for name in period_names if "BIMESTRE" in name.upper())
        assert bimester_count >= 4, f"Expected 4 bimesters, found {bimester_count} in {period_names}"
        print(f"✓ Found {bimester_count} bimesters: {period_names}")
    
    def test_periods_have_required_fields(self, headers):
        """Each period has id, nombre, orden fields"""
        response = requests.get(f"{BASE_URL}/api/academic/periods", headers=headers)
        assert response.status_code == 200
        periods = response.json()
        
        for period in periods:
            assert "id" in period, "Period missing 'id' field"
            assert "nombre" in period or "name" in period, "Period missing 'nombre' field"
            print(f"✓ Period {period.get('nombre', period.get('name', 'unknown'))} has required fields")


class TestRegisterAvailability:
    """Test GET /api/exams/register-availability endpoint"""
    
    def test_availability_returns_200(self, headers):
        """GET /api/exams/register-availability returns 200 OK"""
        params = f"subject_id={TEST_SUBJECT_ID}&period_id={TEST_PERIOD_ID_BIM1}"
        response = requests.get(f"{BASE_URL}/api/exams/register-availability?{params}", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/exams/register-availability returns 200 OK")
    
    def test_availability_returns_5_slots(self, headers):
        """Availability returns all 5 slots: EM, EB, P1, P2, P3"""
        params = f"subject_id={TEST_SUBJECT_ID}&period_id={TEST_PERIOD_ID_BIM1}"
        response = requests.get(f"{BASE_URL}/api/exams/register-availability?{params}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        availability = data.get("availability", {})
        
        expected_slots = ["EM", "EB", "P1", "P2", "P3"]
        for slot in expected_slots:
            assert slot in availability, f"Missing slot '{slot}' in availability"
            assert "available" in availability[slot], f"Slot '{slot}' missing 'available' field"
            print(f"✓ Slot {slot}: available={availability[slot]['available']}")
    
    def test_availability_slot_structure(self, headers):
        """Each slot has 'available' boolean and 'assigned_exam' field"""
        params = f"subject_id={TEST_SUBJECT_ID}&period_id={TEST_PERIOD_ID_BIM1}"
        response = requests.get(f"{BASE_URL}/api/exams/register-availability?{params}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        availability = data.get("availability", {})
        
        for slot_key, slot_data in availability.items():
            assert isinstance(slot_data.get("available"), bool), f"Slot {slot_key} 'available' should be boolean"
            assert "assigned_exam" in slot_data, f"Slot {slot_key} missing 'assigned_exam' field"
            print(f"✓ Slot {slot_key} has correct structure")
    
    def test_availability_returns_register_status(self, headers):
        """Availability response includes register_status field"""
        params = f"subject_id={TEST_SUBJECT_ID}&period_id={TEST_PERIOD_ID_BIM1}"
        response = requests.get(f"{BASE_URL}/api/exams/register-availability?{params}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "register_status" in data, "Response missing 'register_status' field"
        assert data["register_status"] in ["open", "closed"], f"Invalid register_status: {data['register_status']}"
        print(f"✓ Register status: {data['register_status']}")


class TestExamCreationWithLinkage:
    """Test POST /api/course/{subject_id}/exams with register linkage"""
    
    @pytest.fixture
    def unique_exam_data(self):
        """Generate unique exam data for each test"""
        unique_id = str(uuid.uuid4())[:8]
        return {
            "title": f"TEST_Exam_Linkage_{unique_id}",
            "description": "Test exam for register linkage",
            "start_datetime": "2026-02-15T09:00:00Z",
            "end_datetime": "2026-02-15T11:00:00Z",
            "duration_minutes": 60,
            "min_score_percentage": 60.0,
            "period_id": TEST_PERIOD_ID_BIM2,  # Use Bimestre 2 to avoid conflicts
        }
    
    def test_create_exam_without_linkage(self, headers, unique_exam_data):
        """Create exam without register linkage succeeds"""
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=unique_exam_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        exam = response.json()
        assert exam.get("id"), "Exam should have an ID"
        assert exam.get("period_id") == TEST_PERIOD_ID_BIM2, "Exam should have period_id"
        assert exam.get("register_type") is None, "register_type should be None"
        assert exam.get("register_participation") is None, "register_participation should be None"
        assert exam.get("sync_status") == "not_linked", "sync_status should be 'not_linked'"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{exam['id']}", headers=headers)
        print(f"✓ Created exam without linkage: {exam['title']}")
    
    def test_create_exam_with_em_linkage(self, headers, unique_exam_data):
        """Create exam with EM (Examen Mensual) linkage"""
        unique_exam_data["register_type"] = "EM"
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=unique_exam_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        exam = response.json()
        assert exam.get("register_type") == "EM", "register_type should be 'EM'"
        assert exam.get("sync_status") == "pending", "sync_status should be 'pending' when linked"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{exam['id']}", headers=headers)
        print(f"✓ Created exam with EM linkage: {exam['title']}")
    
    def test_create_exam_with_participation_linkage(self, headers, unique_exam_data):
        """Create exam with P2 (Participation) linkage"""
        unique_exam_data["register_participation"] = "P2"
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=unique_exam_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        exam = response.json()
        assert exam.get("register_participation") == "P2", "register_participation should be 'P2'"
        assert exam.get("sync_status") == "pending", "sync_status should be 'pending' when linked"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{exam['id']}", headers=headers)
        print(f"✓ Created exam with P2 linkage: {exam['title']}")
    
    def test_create_exam_with_both_linkages(self, headers, unique_exam_data):
        """Create exam with both EB and P3 linkage"""
        unique_exam_data["register_type"] = "EB"
        unique_exam_data["register_participation"] = "P3"
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=unique_exam_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        exam = response.json()
        assert exam.get("register_type") == "EB", "register_type should be 'EB'"
        assert exam.get("register_participation") == "P3", "register_participation should be 'P3'"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{exam['id']}", headers=headers)
        print(f"✓ Created exam with EB + P3 linkage: {exam['title']}")


class TestConflictValidation:
    """Test 409 Conflict when duplicate register slots are used"""
    
    def test_duplicate_register_type_returns_409(self, headers):
        """Creating exam with already-used register_type returns 409"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create first exam with EM
        exam1_data = {
            "title": f"TEST_Conflict_First_{unique_id}",
            "description": "First exam",
            "start_datetime": "2026-03-15T09:00:00Z",
            "end_datetime": "2026-03-15T11:00:00Z",
            "duration_minutes": 60,
            "period_id": TEST_PERIOD_ID_BIM2,
            "register_type": "EM"
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=exam1_data
        )
        assert response1.status_code == 200, f"First exam creation failed: {response1.text}"
        exam1 = response1.json()
        
        try:
            # Try to create second exam with same EM slot
            exam2_data = {
                "title": f"TEST_Conflict_Second_{unique_id}",
                "description": "Second exam - should fail",
                "start_datetime": "2026-03-16T09:00:00Z",
                "end_datetime": "2026-03-16T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID_BIM2,
                "register_type": "EM"  # Same slot!
            }
            
            response2 = requests.post(
                f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
                headers=headers,
                json=exam2_data
            )
            
            assert response2.status_code == 409, f"Expected 409 Conflict, got {response2.status_code}: {response2.text}"
            print(f"✓ Duplicate EM slot correctly returns 409 Conflict")
            
        finally:
            # Cleanup first exam
            requests.delete(f"{BASE_URL}/api/exams/{exam1['id']}", headers=headers)
    
    def test_duplicate_participation_returns_409(self, headers):
        """Creating exam with already-used register_participation returns 409"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create first exam with P1
        exam1_data = {
            "title": f"TEST_Conflict_P1_First_{unique_id}",
            "description": "First exam with P1",
            "start_datetime": "2026-03-17T09:00:00Z",
            "end_datetime": "2026-03-17T11:00:00Z",
            "duration_minutes": 60,
            "period_id": TEST_PERIOD_ID_BIM2,
            "register_participation": "P1"
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=exam1_data
        )
        assert response1.status_code == 200, f"First exam creation failed: {response1.text}"
        exam1 = response1.json()
        
        try:
            # Try to create second exam with same P1 slot
            exam2_data = {
                "title": f"TEST_Conflict_P1_Second_{unique_id}",
                "description": "Second exam - should fail",
                "start_datetime": "2026-03-18T09:00:00Z",
                "end_datetime": "2026-03-18T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID_BIM2,
                "register_participation": "P1"  # Same slot!
            }
            
            response2 = requests.post(
                f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
                headers=headers,
                json=exam2_data
            )
            
            assert response2.status_code == 409, f"Expected 409 Conflict, got {response2.status_code}: {response2.text}"
            print(f"✓ Duplicate P1 slot correctly returns 409 Conflict")
            
        finally:
            # Cleanup first exam
            requests.delete(f"{BASE_URL}/api/exams/{exam1['id']}", headers=headers)


class TestAvailabilityAfterAssignment:
    """Test that availability shows assigned slots correctly"""
    
    def test_assigned_slot_shows_unavailable(self, headers):
        """After creating exam with EM, availability shows EM as unavailable"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create exam with EM
        exam_data = {
            "title": f"TEST_Availability_Check_{unique_id}",
            "description": "Test exam",
            "start_datetime": "2026-04-15T09:00:00Z",
            "end_datetime": "2026-04-15T11:00:00Z",
            "duration_minutes": 60,
            "period_id": TEST_PERIOD_ID_BIM2,
            "register_type": "EM"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=exam_data
        )
        assert response.status_code == 200
        exam = response.json()
        
        try:
            # Check availability
            params = f"subject_id={TEST_SUBJECT_ID}&period_id={TEST_PERIOD_ID_BIM2}"
            avail_response = requests.get(f"{BASE_URL}/api/exams/register-availability?{params}", headers=headers)
            assert avail_response.status_code == 200
            
            availability = avail_response.json().get("availability", {})
            em_slot = availability.get("EM", {})
            
            assert em_slot.get("available") == False, "EM slot should be unavailable"
            assert em_slot.get("assigned_exam", {}).get("id") == exam["id"], "assigned_exam should reference our exam"
            assert em_slot.get("assigned_exam", {}).get("title") == exam["title"], "assigned_exam should have exam title"
            
            print(f"✓ EM slot correctly shows as unavailable with exam title: {exam['title']}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/exams/{exam['id']}", headers=headers)


class TestExamDeletion:
    """Test DELETE /api/exams/{id} cleans up register linkage"""
    
    def test_delete_exam_frees_slot(self, headers):
        """Deleting exam frees up the register slot"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create exam with EB
        exam_data = {
            "title": f"TEST_Delete_Slot_{unique_id}",
            "description": "Test exam for deletion",
            "start_datetime": "2026-05-15T09:00:00Z",
            "end_datetime": "2026-05-15T11:00:00Z",
            "duration_minutes": 60,
            "period_id": TEST_PERIOD_ID_BIM2,
            "register_type": "EB"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=exam_data
        )
        assert response.status_code == 200
        exam = response.json()
        
        # Verify EB is unavailable
        params = f"subject_id={TEST_SUBJECT_ID}&period_id={TEST_PERIOD_ID_BIM2}"
        avail_before = requests.get(f"{BASE_URL}/api/exams/register-availability?{params}", headers=headers)
        assert avail_before.json()["availability"]["EB"]["available"] == False
        
        # Delete the exam
        delete_response = requests.delete(f"{BASE_URL}/api/exams/{exam['id']}", headers=headers)
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify EB is now available
        avail_after = requests.get(f"{BASE_URL}/api/exams/register-availability?{params}", headers=headers)
        assert avail_after.json()["availability"]["EB"]["available"] == True, "EB slot should be available after deletion"
        
        print(f"✓ Deleting exam correctly freed EB slot")


class TestInvalidInputs:
    """Test validation of invalid inputs"""
    
    def test_invalid_register_type_returns_400(self, headers):
        """Invalid register_type returns 400"""
        exam_data = {
            "title": "TEST_Invalid_Type",
            "description": "Test",
            "start_datetime": "2026-06-15T09:00:00Z",
            "end_datetime": "2026-06-15T11:00:00Z",
            "duration_minutes": 60,
            "period_id": TEST_PERIOD_ID_BIM2,
            "register_type": "INVALID"  # Invalid!
        }
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=exam_data
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Invalid register_type correctly returns 400")
    
    def test_invalid_participation_returns_400(self, headers):
        """Invalid register_participation returns 400"""
        exam_data = {
            "title": "TEST_Invalid_Part",
            "description": "Test",
            "start_datetime": "2026-06-16T09:00:00Z",
            "end_datetime": "2026-06-16T11:00:00Z",
            "duration_minutes": 60,
            "period_id": TEST_PERIOD_ID_BIM2,
            "register_participation": "P99"  # Invalid!
        }
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=exam_data
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Invalid register_participation correctly returns 400")
    
    def test_linkage_without_period_returns_400(self, headers):
        """Register linkage without period_id returns 400"""
        exam_data = {
            "title": "TEST_No_Period",
            "description": "Test",
            "start_datetime": "2026-06-17T09:00:00Z",
            "end_datetime": "2026-06-17T11:00:00Z",
            "duration_minutes": 60,
            # No period_id!
            "register_type": "EM"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            headers=headers,
            json=exam_data
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Linkage without period_id correctly returns 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
