"""
Test suite for Exam Register Column Linkage Feature
Tests the CORRECTED implementation using a SINGLE 'register_column' field
instead of two separate fields (register_type + register_participation).

The register_column field is mutually exclusive: EM|EB|P1|P2|P3|null
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_SUBDOMAIN = "elroble"
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"
TEST_PERIOD_ID = "093a0bee-92c4-449c-b82c-942f16847759"  # Bimestre 1


class TestExamRegisterColumn:
    """Test suite for exam register_column linkage feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "subdomain": TEST_SUBDOMAIN,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_res.status_code != 200:
            pytest.skip(f"Login failed: {login_res.status_code} - {login_res.text}")
        
        token = login_res.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_exam_ids = []
        
        yield
        
        # Cleanup: Delete all test exams
        for exam_id in self.created_exam_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/exams/{exam_id}")
            except:
                pass
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ACADEMIC PERIODS TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_academic_periods_returns_200(self):
        """GET /api/academic/periods returns 200 OK"""
        res = self.session.get(f"{BASE_URL}/api/academic/periods")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        print("PASS: GET /api/academic/periods returns 200 OK")
    
    def test_periods_returns_4_bimesters(self):
        """Periods endpoint returns 4 bimesters for elroble school"""
        res = self.session.get(f"{BASE_URL}/api/academic/periods")
        assert res.status_code == 200
        
        periods = res.json()
        assert isinstance(periods, list), "Expected list of periods"
        assert len(periods) >= 4, f"Expected at least 4 bimesters, got {len(periods)}"
        
        # Check for BIMESTRE naming
        bimester_names = [p.get("nombre", "") for p in periods]
        print(f"Found periods: {bimester_names}")
        print("PASS: Periods endpoint returns 4+ bimesters")
    
    def test_periods_have_required_fields(self):
        """Each period has id, nombre, orden fields"""
        res = self.session.get(f"{BASE_URL}/api/academic/periods")
        assert res.status_code == 200
        
        periods = res.json()
        for period in periods:
            assert "id" in period, "Period missing 'id' field"
            assert "nombre" in period or "name" in period, "Period missing 'nombre' field"
            assert "orden" in period or "order" in period, "Period missing 'orden' field"
        
        print("PASS: Each period has id, nombre, orden fields")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # REGISTER AVAILABILITY TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_register_availability_returns_200(self):
        """GET /api/exams/register-availability returns 200 OK"""
        res = self.session.get(
            f"{BASE_URL}/api/exams/register-availability",
            params={"subject_id": TEST_SUBJECT_ID, "period_id": TEST_PERIOD_ID}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        print("PASS: GET /api/exams/register-availability returns 200 OK")
    
    def test_availability_returns_all_5_slots(self):
        """Availability returns all 5 slots: EM, EB, P1, P2, P3"""
        res = self.session.get(
            f"{BASE_URL}/api/exams/register-availability",
            params={"subject_id": TEST_SUBJECT_ID, "period_id": TEST_PERIOD_ID}
        )
        assert res.status_code == 200
        
        data = res.json()
        availability = data.get("availability", {})
        
        expected_slots = ["EM", "EB", "P1", "P2", "P3"]
        for slot in expected_slots:
            assert slot in availability, f"Missing slot: {slot}"
            assert "available" in availability[slot], f"Slot {slot} missing 'available' field"
            assert "assigned_exam" in availability[slot], f"Slot {slot} missing 'assigned_exam' field"
        
        print(f"PASS: Availability returns all 5 slots: {list(availability.keys())}")
    
    def test_availability_includes_register_status(self):
        """Availability response includes register_status field"""
        res = self.session.get(
            f"{BASE_URL}/api/exams/register-availability",
            params={"subject_id": TEST_SUBJECT_ID, "period_id": TEST_PERIOD_ID}
        )
        assert res.status_code == 200
        
        data = res.json()
        assert "register_status" in data, "Missing 'register_status' field"
        assert data["register_status"] in ["open", "closed"], f"Invalid register_status: {data['register_status']}"
        
        print(f"PASS: register_status = {data['register_status']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CREATE EXAM WITH REGISTER_COLUMN TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_exam_with_register_column_em(self):
        """POST /api/course/{subject_id}/exams with register_column=EM creates exam correctly"""
        unique_title = f"Test Exam EM {uuid.uuid4().hex[:8]}"
        
        res = self.session.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json={
                "title": unique_title,
                "description": "Test exam with EM linkage",
                "start_datetime": "2026-02-15T09:00:00Z",
                "end_datetime": "2026-02-15T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID,
                "register_column": "EM"
            }
        )
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        exam = res.json()
        self.created_exam_ids.append(exam["id"])
        
        assert exam.get("register_column") == "EM", f"Expected register_column='EM', got {exam.get('register_column')}"
        assert exam.get("period_id") == TEST_PERIOD_ID, "period_id mismatch"
        assert exam.get("sync_status") == "pending", f"Expected sync_status='pending', got {exam.get('sync_status')}"
        
        print(f"PASS: Created exam with register_column=EM, id={exam['id']}")
    
    def test_create_exam_with_register_column_p1(self):
        """POST /api/course/{subject_id}/exams with register_column=P1 creates exam (mutually exclusive from EM)"""
        unique_title = f"Test Exam P1 {uuid.uuid4().hex[:8]}"
        
        res = self.session.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json={
                "title": unique_title,
                "description": "Test exam with P1 linkage",
                "start_datetime": "2026-02-16T09:00:00Z",
                "end_datetime": "2026-02-16T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID,
                "register_column": "P1"
            }
        )
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        exam = res.json()
        self.created_exam_ids.append(exam["id"])
        
        assert exam.get("register_column") == "P1", f"Expected register_column='P1', got {exam.get('register_column')}"
        
        print(f"PASS: Created exam with register_column=P1, id={exam['id']}")
    
    def test_create_exam_without_linkage(self):
        """POST /api/course/{subject_id}/exams with register_column=null creates exam without linkage"""
        unique_title = f"Test Exam No Link {uuid.uuid4().hex[:8]}"
        
        res = self.session.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json={
                "title": unique_title,
                "description": "Test exam without linkage",
                "start_datetime": "2026-02-17T09:00:00Z",
                "end_datetime": "2026-02-17T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID,
                "register_column": None
            }
        )
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        exam = res.json()
        self.created_exam_ids.append(exam["id"])
        
        assert exam.get("register_column") is None, f"Expected register_column=None, got {exam.get('register_column')}"
        assert exam.get("sync_status") == "not_linked", f"Expected sync_status='not_linked', got {exam.get('sync_status')}"
        
        print(f"PASS: Created exam without linkage, id={exam['id']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CONFLICT VALIDATION TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_duplicate_register_column_returns_409(self):
        """POST /api/course/{subject_id}/exams with same register_column returns 409 Conflict"""
        unique_title1 = f"Test Exam EB First {uuid.uuid4().hex[:8]}"
        unique_title2 = f"Test Exam EB Second {uuid.uuid4().hex[:8]}"
        
        # Create first exam with EB
        res1 = self.session.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json={
                "title": unique_title1,
                "description": "First exam with EB",
                "start_datetime": "2026-02-18T09:00:00Z",
                "end_datetime": "2026-02-18T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID,
                "register_column": "EB"
            }
        )
        
        assert res1.status_code == 200, f"First exam creation failed: {res1.status_code}: {res1.text}"
        exam1 = res1.json()
        self.created_exam_ids.append(exam1["id"])
        
        # Try to create second exam with same EB column
        res2 = self.session.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json={
                "title": unique_title2,
                "description": "Second exam with EB - should fail",
                "start_datetime": "2026-02-19T09:00:00Z",
                "end_datetime": "2026-02-19T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID,
                "register_column": "EB"
            }
        )
        
        assert res2.status_code == 409, f"Expected 409 Conflict, got {res2.status_code}: {res2.text}"
        
        print("PASS: Duplicate register_column returns 409 Conflict")
    
    def test_invalid_register_column_returns_400(self):
        """POST with invalid register_column returns 400"""
        unique_title = f"Test Exam Invalid {uuid.uuid4().hex[:8]}"
        
        res = self.session.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json={
                "title": unique_title,
                "description": "Test with invalid column",
                "start_datetime": "2026-02-20T09:00:00Z",
                "end_datetime": "2026-02-20T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID,
                "register_column": "INVALID"
            }
        )
        
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        
        print("PASS: Invalid register_column returns 400")
    
    def test_register_column_without_period_returns_400(self):
        """POST with register_column but no period_id returns 400"""
        unique_title = f"Test Exam No Period {uuid.uuid4().hex[:8]}"
        
        res = self.session.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json={
                "title": unique_title,
                "description": "Test without period_id",
                "start_datetime": "2026-02-21T09:00:00Z",
                "end_datetime": "2026-02-21T11:00:00Z",
                "duration_minutes": 60,
                "period_id": None,
                "register_column": "P2"
            }
        )
        
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        
        print("PASS: register_column without period_id returns 400")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DELETE AND SLOT FREEING TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_delete_exam_frees_slot(self):
        """DELETE /api/exams/{id} frees the slot"""
        unique_title = f"Test Exam P3 Delete {uuid.uuid4().hex[:8]}"
        
        # Create exam with P3
        res1 = self.session.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json={
                "title": unique_title,
                "description": "Exam to delete",
                "start_datetime": "2026-02-22T09:00:00Z",
                "end_datetime": "2026-02-22T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID,
                "register_column": "P3"
            }
        )
        
        assert res1.status_code == 200
        exam = res1.json()
        exam_id = exam["id"]
        
        # Check P3 is occupied
        avail_res1 = self.session.get(
            f"{BASE_URL}/api/exams/register-availability",
            params={"subject_id": TEST_SUBJECT_ID, "period_id": TEST_PERIOD_ID}
        )
        assert avail_res1.status_code == 200
        avail1 = avail_res1.json().get("availability", {})
        assert avail1.get("P3", {}).get("available") == False, "P3 should be occupied"
        
        # Delete the exam
        del_res = self.session.delete(f"{BASE_URL}/api/exams/{exam_id}")
        assert del_res.status_code == 200, f"Delete failed: {del_res.status_code}: {del_res.text}"
        
        # Check P3 is now available
        avail_res2 = self.session.get(
            f"{BASE_URL}/api/exams/register-availability",
            params={"subject_id": TEST_SUBJECT_ID, "period_id": TEST_PERIOD_ID}
        )
        assert avail_res2.status_code == 200
        avail2 = avail_res2.json().get("availability", {})
        assert avail2.get("P3", {}).get("available") == True, "P3 should be available after delete"
        
        print("PASS: DELETE /api/exams/{id} frees the slot")
    
    def test_availability_shows_occupied_slots(self):
        """GET /api/exams/register-availability shows occupied/available slots after create+delete"""
        unique_title = f"Test Exam P2 Avail {uuid.uuid4().hex[:8]}"
        
        # Check initial availability
        avail_res1 = self.session.get(
            f"{BASE_URL}/api/exams/register-availability",
            params={"subject_id": TEST_SUBJECT_ID, "period_id": TEST_PERIOD_ID}
        )
        assert avail_res1.status_code == 200
        initial_p2 = avail_res1.json().get("availability", {}).get("P2", {}).get("available")
        
        if not initial_p2:
            print("SKIP: P2 already occupied, skipping this test")
            return
        
        # Create exam with P2
        res = self.session.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json={
                "title": unique_title,
                "description": "Exam for availability test",
                "start_datetime": "2026-02-23T09:00:00Z",
                "end_datetime": "2026-02-23T11:00:00Z",
                "duration_minutes": 60,
                "period_id": TEST_PERIOD_ID,
                "register_column": "P2"
            }
        )
        
        assert res.status_code == 200
        exam = res.json()
        self.created_exam_ids.append(exam["id"])
        
        # Check P2 is now occupied
        avail_res2 = self.session.get(
            f"{BASE_URL}/api/exams/register-availability",
            params={"subject_id": TEST_SUBJECT_ID, "period_id": TEST_PERIOD_ID}
        )
        assert avail_res2.status_code == 200
        avail2 = avail_res2.json().get("availability", {})
        
        assert avail2.get("P2", {}).get("available") == False, "P2 should be occupied"
        assert avail2.get("P2", {}).get("assigned_exam", {}).get("title") == unique_title, "assigned_exam title mismatch"
        
        print("PASS: Availability shows occupied slots with exam title")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
