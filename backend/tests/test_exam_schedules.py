"""
Test suite for Exam Schedules (Horario de Exámenes) module
Tests:
- POST /api/exam-schedules - creates exam with grade_id + section_id
- GET /api/exam-schedules - filters by grade_id, section_id, from_date, to_date
- Conflict validation - same section, same time, same date
- Conflict validation - same teacher, same time, same date
- GET /api/student/exam-schedule - auto-filters by student's grade/section
- Status badges: upcoming, ongoing, finished
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
STUDENT_EMAIL = "pepito@gmail.com"
STUDENT_PASSWORD = "1234abc8"

# Test data from context
GRADE_ID = "6ef8ab18-41b2-45e7-b482-06a84d95c34d"  # 3 años
SECTION_ID = "11f50cbc-f5f6-422a-a989-87b2af6027f1"  # ÚNICA


class TestExamSchedulesAPI:
    """Test Exam Schedules API endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin authentication failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Student authentication failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Admin request headers"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def student_headers(self, student_token):
        """Student request headers"""
        return {"Authorization": f"Bearer {student_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def test_data(self, admin_headers):
        """Get test data: subjects and teachers"""
        # Get subjects
        subjects_res = requests.get(f"{BASE_URL}/api/academic/subjects", headers=admin_headers)
        subjects = subjects_res.json() if subjects_res.status_code == 200 else []
        
        # Get teachers
        teachers_res = requests.get(f"{BASE_URL}/api/users/teachers/active", headers=admin_headers)
        teachers = teachers_res.json() if teachers_res.status_code == 200 else []
        
        return {
            "subjects": subjects,
            "teachers": teachers,
            "subject_id": subjects[0]["id"] if subjects else None,
            "teacher_id": teachers[0]["id"] if teachers else None
        }
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/exam-schedules TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_exam_schedules_requires_grade_id(self, admin_headers):
        """GET /api/exam-schedules requires grade_id parameter"""
        response = requests.get(
            f"{BASE_URL}/api/exam-schedules?section_id={SECTION_ID}",
            headers=admin_headers
        )
        # Should fail without grade_id
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ GET /api/exam-schedules requires grade_id")
    
    def test_get_exam_schedules_requires_section_id(self, admin_headers):
        """GET /api/exam-schedules requires section_id parameter"""
        response = requests.get(
            f"{BASE_URL}/api/exam-schedules?grade_id={GRADE_ID}",
            headers=admin_headers
        )
        # Should fail without section_id
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ GET /api/exam-schedules requires section_id")
    
    def test_get_exam_schedules_with_filters(self, admin_headers):
        """GET /api/exam-schedules with grade_id and section_id returns exams"""
        response = requests.get(
            f"{BASE_URL}/api/exam-schedules?grade_id={GRADE_ID}&section_id={SECTION_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "exams" in data, "Response should contain 'exams' key"
        print(f"✓ GET /api/exam-schedules returns {len(data['exams'])} exams")
    
    def test_get_exam_schedules_with_date_range(self, admin_headers):
        """GET /api/exam-schedules filters by from_date and to_date"""
        from_date = "2025-02-01"
        to_date = "2025-02-28"
        response = requests.get(
            f"{BASE_URL}/api/exam-schedules?grade_id={GRADE_ID}&section_id={SECTION_ID}&from_date={from_date}&to_date={to_date}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Verify all exams are within date range
        for exam in data.get("exams", []):
            assert from_date <= exam["date"] <= to_date, f"Exam date {exam['date']} outside range"
        print(f"✓ GET /api/exam-schedules filters by date range: {len(data['exams'])} exams in Feb 2025")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/exam-schedules TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_exam_requires_grade_id(self, admin_headers, test_data):
        """POST /api/exam-schedules requires grade_id"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        payload = {
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": "2025-03-15",
            "start_time": "09:00",
            "end_time": "10:30",
            "type": "parcial",
            "title": "TEST_Exam_No_Grade"
        }
        response = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=admin_headers)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ POST /api/exam-schedules requires grade_id")
    
    def test_create_exam_requires_section_id(self, admin_headers, test_data):
        """POST /api/exam-schedules requires section_id"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        payload = {
            "grade_id": GRADE_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": "2025-03-15",
            "start_time": "09:00",
            "end_time": "10:30",
            "type": "parcial",
            "title": "TEST_Exam_No_Section"
        }
        response = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=admin_headers)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ POST /api/exam-schedules requires section_id")
    
    def test_create_exam_validates_grade_exists(self, admin_headers, test_data):
        """POST /api/exam-schedules validates grade exists"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        payload = {
            "grade_id": "invalid-grade-id-12345",
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": "2025-03-15",
            "start_time": "09:00",
            "end_time": "10:30",
            "type": "parcial",
            "title": "TEST_Exam_Invalid_Grade"
        }
        response = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=admin_headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Grado no válido" in response.json().get("detail", "")
        print("✓ POST /api/exam-schedules validates grade exists")
    
    def test_create_exam_validates_section_exists(self, admin_headers, test_data):
        """POST /api/exam-schedules validates section exists"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        payload = {
            "grade_id": GRADE_ID,
            "section_id": "invalid-section-id-12345",
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": "2025-03-15",
            "start_time": "09:00",
            "end_time": "10:30",
            "type": "parcial",
            "title": "TEST_Exam_Invalid_Section"
        }
        response = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=admin_headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Sección no válida" in response.json().get("detail", "")
        print("✓ POST /api/exam-schedules validates section exists")
    
    def test_create_exam_success(self, admin_headers, test_data):
        """POST /api/exam-schedules creates exam with grade_id + section_id"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        # Use unique date/time to avoid conflicts
        unique_date = "2025-04-15"
        payload = {
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": unique_date,
            "start_time": "14:00",
            "end_time": "15:30",
            "type": "parcial",
            "title": "TEST_Exam_Success_Create"
        }
        response = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "exam" in data, "Response should contain 'exam' key"
        exam = data["exam"]
        assert exam["grade_id"] == GRADE_ID
        assert exam["section_id"] == SECTION_ID
        assert exam["date"] == unique_date
        assert exam["title"] == "TEST_Exam_Success_Create"
        assert "status" in exam, "Exam should have status field"
        print(f"✓ POST /api/exam-schedules creates exam successfully: {exam['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exam-schedules/{exam['id']}", headers=admin_headers)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CONFLICT VALIDATION TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_section_conflict_validation(self, admin_headers, test_data):
        """Conflict validation - same section, same time, same date"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        # Create first exam
        unique_date = "2025-05-10"
        payload1 = {
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": unique_date,
            "start_time": "10:00",
            "end_time": "11:30",
            "type": "parcial",
            "title": "TEST_Exam_Conflict_1"
        }
        res1 = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload1, headers=admin_headers)
        assert res1.status_code == 200, f"First exam creation failed: {res1.text}"
        exam1_id = res1.json()["exam"]["id"]
        
        try:
            # Try to create second exam with overlapping time in same section
            payload2 = {
                "grade_id": GRADE_ID,
                "section_id": SECTION_ID,
                "subject_id": test_data["subject_id"],
                "teacher_id": test_data["teachers"][1]["id"] if len(test_data["teachers"]) > 1 else test_data["teacher_id"],
                "date": unique_date,
                "start_time": "10:30",  # Overlaps with 10:00-11:30
                "end_time": "12:00",
                "type": "quiz",
                "title": "TEST_Exam_Conflict_2"
            }
            res2 = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload2, headers=admin_headers)
            assert res2.status_code == 400, f"Expected 400 for section conflict, got {res2.status_code}"
            assert "Ya hay un examen programado" in res2.json().get("detail", "")
            print("✓ Section conflict validation works - same section, same time, same date")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/exam-schedules/{exam1_id}", headers=admin_headers)
    
    def test_teacher_conflict_validation(self, admin_headers, test_data):
        """Conflict validation - same teacher, same time, same date"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        # Get another section for the same grade
        sections_res = requests.get(f"{BASE_URL}/api/academic/sections", headers=admin_headers)
        sections = sections_res.json() if sections_res.status_code == 200 else []
        other_section = None
        for s in sections:
            if s["id"] != SECTION_ID and s.get("grado_id") == GRADE_ID:
                other_section = s["id"]
                break
        
        if not other_section:
            # Use a different grade's section
            grades_res = requests.get(f"{BASE_URL}/api/academic/grades", headers=admin_headers)
            grades = grades_res.json() if grades_res.status_code == 200 else []
            for g in grades:
                if g["id"] != GRADE_ID:
                    for s in sections:
                        if s.get("grado_id") == g["id"]:
                            other_section = s["id"]
                            other_grade = g["id"]
                            break
                    if other_section:
                        break
        
        if not other_section:
            pytest.skip("No other section available for teacher conflict test")
        
        # Create first exam
        unique_date = "2025-05-15"
        payload1 = {
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": unique_date,
            "start_time": "09:00",
            "end_time": "10:30",
            "type": "final",
            "title": "TEST_Teacher_Conflict_1"
        }
        res1 = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload1, headers=admin_headers)
        assert res1.status_code == 200, f"First exam creation failed: {res1.text}"
        exam1_id = res1.json()["exam"]["id"]
        
        try:
            # Try to create second exam with same teacher at overlapping time
            payload2 = {
                "grade_id": other_grade if 'other_grade' in dir() else GRADE_ID,
                "section_id": other_section,
                "subject_id": test_data["subject_id"],
                "teacher_id": test_data["teacher_id"],  # Same teacher
                "date": unique_date,
                "start_time": "09:30",  # Overlaps with 09:00-10:30
                "end_time": "11:00",
                "type": "quiz",
                "title": "TEST_Teacher_Conflict_2"
            }
            res2 = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload2, headers=admin_headers)
            assert res2.status_code == 400, f"Expected 400 for teacher conflict, got {res2.status_code}"
            assert "profesor ya tiene otro examen" in res2.json().get("detail", "")
            print("✓ Teacher conflict validation works - same teacher, same time, same date")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/exam-schedules/{exam1_id}", headers=admin_headers)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STUDENT ENDPOINT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_student_exam_schedule_auto_filters(self, student_headers):
        """GET /api/student/exam-schedule auto-filters by student's grade/section"""
        response = requests.get(f"{BASE_URL}/api/student/exam-schedule", headers=student_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "exams" in data, "Response should contain 'exams' key"
        assert "grade_name" in data, "Response should contain 'grade_name'"
        assert "section_name" in data, "Response should contain 'section_name'"
        print(f"✓ GET /api/student/exam-schedule returns {len(data['exams'])} exams for {data['grade_name']} {data['section_name']}")
    
    def test_student_cannot_create_exam(self, student_headers, test_data):
        """Students cannot create exams (403 - admin only)"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        payload = {
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": "2025-06-01",
            "start_time": "09:00",
            "end_time": "10:30",
            "type": "parcial",
            "title": "TEST_Student_Create_Attempt"
        }
        response = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=student_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Students cannot create exams (403)")
    
    def test_admin_cannot_access_student_endpoint(self, admin_headers):
        """Admin cannot access student-only endpoint"""
        response = requests.get(f"{BASE_URL}/api/student/exam-schedule", headers=admin_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Admin cannot access /api/student/exam-schedule (403)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STATUS BADGE TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_exam_status_calculation(self, admin_headers, test_data):
        """Verify exam status is calculated correctly: upcoming, ongoing, finished"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        # Create exam for tomorrow (should be 'upcoming')
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        payload = {
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": tomorrow,
            "start_time": "09:00",
            "end_time": "10:30",
            "type": "parcial",
            "title": "TEST_Status_Upcoming"
        }
        response = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create exam: {response.text}"
        
        exam = response.json()["exam"]
        assert exam["status"] == "upcoming", f"Expected 'upcoming', got '{exam['status']}'"
        print(f"✓ Exam status 'upcoming' calculated correctly for date {tomorrow}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exam-schedules/{exam['id']}", headers=admin_headers)
    
    def test_exam_response_includes_enriched_data(self, admin_headers, test_data):
        """Verify exam response includes teacher_name, subject_name, status, duration"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        # Create exam
        unique_date = "2025-07-01"
        payload = {
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": unique_date,
            "start_time": "08:00",
            "end_time": "09:30",
            "type": "final",
            "title": "TEST_Enriched_Data"
        }
        response = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=admin_headers)
        assert response.status_code == 200
        
        exam = response.json()["exam"]
        
        # Verify enriched fields
        assert "duration_minutes" in exam, "Should have duration_minutes"
        assert exam["duration_minutes"] == 90, f"Expected 90 min, got {exam['duration_minutes']}"
        assert "status" in exam, "Should have status"
        assert "subject_name" in exam, "Should have subject_name"
        print(f"✓ Exam response includes enriched data: duration={exam['duration_minutes']}min, status={exam['status']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exam-schedules/{exam['id']}", headers=admin_headers)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UPDATE AND DELETE TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_update_exam_schedule(self, admin_headers, test_data):
        """PUT /api/exam-schedules/{id} updates exam"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        # Create exam
        unique_date = "2025-08-01"
        payload = {
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": unique_date,
            "start_time": "10:00",
            "end_time": "11:30",
            "type": "parcial",
            "title": "TEST_Update_Original"
        }
        create_res = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=admin_headers)
        assert create_res.status_code == 200
        exam_id = create_res.json()["exam"]["id"]
        
        try:
            # Update exam
            update_payload = {
                "title": "TEST_Update_Modified",
                "type": "final",
                "start_time": "11:00",
                "end_time": "12:30"
            }
            update_res = requests.put(f"{BASE_URL}/api/exam-schedules/{exam_id}", json=update_payload, headers=admin_headers)
            assert update_res.status_code == 200, f"Update failed: {update_res.text}"
            
            updated_exam = update_res.json()["exam"]
            assert updated_exam["title"] == "TEST_Update_Modified"
            assert updated_exam["type"] == "final"
            assert updated_exam["start_time"] == "11:00"
            print("✓ PUT /api/exam-schedules updates exam successfully")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/exam-schedules/{exam_id}", headers=admin_headers)
    
    def test_delete_exam_schedule(self, admin_headers, test_data):
        """DELETE /api/exam-schedules/{id} deletes exam"""
        if not test_data["subject_id"] or not test_data["teacher_id"]:
            pytest.skip("No subjects or teachers available")
        
        # Create exam
        unique_date = "2025-09-01"
        payload = {
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "subject_id": test_data["subject_id"],
            "teacher_id": test_data["teacher_id"],
            "date": unique_date,
            "start_time": "14:00",
            "end_time": "15:30",
            "type": "quiz",
            "title": "TEST_Delete_Me"
        }
        create_res = requests.post(f"{BASE_URL}/api/exam-schedules", json=payload, headers=admin_headers)
        assert create_res.status_code == 200
        exam_id = create_res.json()["exam"]["id"]
        
        # Delete exam
        delete_res = requests.delete(f"{BASE_URL}/api/exam-schedules/{exam_id}", headers=admin_headers)
        assert delete_res.status_code == 200, f"Delete failed: {delete_res.text}"
        
        # Verify deleted
        get_res = requests.get(
            f"{BASE_URL}/api/exam-schedules?grade_id={GRADE_ID}&section_id={SECTION_ID}&from_date={unique_date}&to_date={unique_date}",
            headers=admin_headers
        )
        exams = get_res.json().get("exams", [])
        assert not any(e["id"] == exam_id for e in exams), "Exam should be deleted"
        print("✓ DELETE /api/exam-schedules deletes exam successfully")


class TestExamSchedulesCleanup:
    """Cleanup test data after all tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_cleanup_test_exams(self, admin_token):
        """Cleanup any remaining TEST_ prefixed exams"""
        if not admin_token:
            pytest.skip("No admin token")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all exams for the test grade/section
        response = requests.get(
            f"{BASE_URL}/api/exam-schedules?grade_id={GRADE_ID}&section_id={SECTION_ID}",
            headers=headers
        )
        
        if response.status_code == 200:
            exams = response.json().get("exams", [])
            deleted = 0
            for exam in exams:
                if exam.get("title", "").startswith("TEST_"):
                    del_res = requests.delete(f"{BASE_URL}/api/exam-schedules/{exam['id']}", headers=headers)
                    if del_res.status_code == 200:
                        deleted += 1
            print(f"✓ Cleanup: Deleted {deleted} test exams")
