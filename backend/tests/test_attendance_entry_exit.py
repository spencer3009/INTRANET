"""
Test cases for Attendance Module Entry/Exit Tracking and Teacher Reports
Features:
- QR history with role filter (?role=student or ?role=teacher)
- QR scan response includes action field (entry/exit/already_both)
- Manual attendance mark-entry endpoint stores entry_time, entry_method, check_in_time
- Teacher reports endpoint returns report data
- Reportes section has 2 buttons: Reportes Estudiantes and Reportes Profesores
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for owner"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": OWNER_EMAIL,
        "password": OWNER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}")
    data = response.json()
    return data.get("token")

@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestQRHistoryRoleFilter:
    """Test QR attendance history with role filter"""
    
    def test_qr_history_returns_all_roles_by_default(self, api_client):
        """GET /api/attendance/qr/history returns both students and teachers"""
        response = api_client.get(f"{BASE_URL}/api/attendance/qr/history?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "history" in data
        assert "date" in data
        assert "total_scans" in data
        
        # Check that role field is present in history items (if any)
        for item in data.get("history", []):
            assert "role" in item, "Each history item should have a 'role' field"
            assert item["role"] in ["student", "teacher"], f"Role should be 'student' or 'teacher', got {item['role']}"
        
        print(f"QR history returned {len(data.get('history', []))} records")
    
    def test_qr_history_filter_students_only(self, api_client):
        """GET /api/attendance/qr/history?role=student returns only student records"""
        response = api_client.get(f"{BASE_URL}/api/attendance/qr/history?role=student&limit=20")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "history" in data
        
        # All records should be students
        for item in data.get("history", []):
            assert item["role"] == "student", f"Expected role='student', got {item['role']}"
        
        print(f"Student-filtered history returned {len(data.get('history', []))} student records")
    
    def test_qr_history_filter_teachers_only(self, api_client):
        """GET /api/attendance/qr/history?role=teacher returns only teacher records"""
        response = api_client.get(f"{BASE_URL}/api/attendance/qr/history?role=teacher&limit=20")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "history" in data
        
        # All records should be teachers
        for item in data.get("history", []):
            assert item["role"] == "teacher", f"Expected role='teacher', got {item['role']}"
        
        print(f"Teacher-filtered history returned {len(data.get('history', []))} teacher records")


class TestTeacherReportsEndpoint:
    """Test Teacher Attendance Reports endpoint"""
    
    def test_teacher_reports_endpoint_exists(self, api_client):
        """GET /api/attendance/reports/teachers endpoint exists and returns data"""
        response = api_client.get(f"{BASE_URL}/api/attendance/reports/teachers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "summary" in data, "Response should contain 'summary'"
        assert "report" in data, "Response should contain 'report'"
        
        # Check summary structure
        summary = data["summary"]
        assert "total_records" in summary
        assert "present" in summary
        assert "late" in summary
        assert "absent" in summary
        assert "justified" in summary
        
        print(f"Teacher reports: {summary['total_records']} total records")
    
    def test_teacher_reports_with_date_filters(self, api_client):
        """GET /api/attendance/reports/teachers with date range filters"""
        # Test with date range (last 30 days)
        today = datetime.now().strftime("%Y-%m-%d")
        start = datetime.now().replace(day=1).strftime("%Y-%m-%d")
        
        response = api_client.get(
            f"{BASE_URL}/api/attendance/reports/teachers?start_date={start}&end_date={today}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "summary" in data
        assert "report" in data
        assert data.get("start_date") == start
        assert data.get("end_date") == today
        
        # Report items should have required fields
        for teacher in data.get("report", []):
            assert "teacher_id" in teacher
            assert "teacher_name" in teacher
            assert "present" in teacher
            assert "late" in teacher
            assert "absent" in teacher
            assert "justified" in teacher
            assert "attendance_rate" in teacher
            assert "total_days" in teacher
        
        print(f"Teacher reports with date filter: {len(data.get('report', []))} teachers")


class TestMarkEntryEndpoint:
    """Test manual attendance mark-entry endpoint"""
    
    def test_mark_entry_endpoint_response_format(self, api_client):
        """POST /api/attendance/mark-entry returns proper response format"""
        # First get a grade and section to find a student
        grades_response = api_client.get(f"{BASE_URL}/api/academic/grades")
        if grades_response.status_code != 200:
            pytest.skip("Could not get grades")
        
        grades = grades_response.json()
        if not grades:
            pytest.skip("No grades found")
        
        # Get students from attendance endpoint which ensures same school
        grade_id = grades[0].get("id")
        sections_response = api_client.get(f"{BASE_URL}/api/academic/sections")
        sections = sections_response.json() if sections_response.status_code == 200 else []
        grade_sections = [s for s in sections if s.get("grado_id") == grade_id]
        
        if not grade_sections:
            pytest.skip("No sections found for grade")
        
        section_id = grade_sections[0].get("id")
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get students from attendance endpoint
        students_response = api_client.get(
            f"{BASE_URL}/api/attendance/students?grade_id={grade_id}&section_id={section_id}&date={today}"
        )
        if students_response.status_code != 200:
            pytest.skip("Could not get students from attendance endpoint")
        
        students_data = students_response.json()
        students = students_data.get("students", [])
        if not students:
            pytest.skip("No students found for testing")
        
        student_id = students[0].get("id")
        
        # Attempt to mark entry (may fail if already marked)
        response = api_client.post(f"{BASE_URL}/api/attendance/mark-entry", json={
            "student_id": student_id,
            "date": today,
            "method": "manual"
        })
        
        # Check response structure (either success or already marked)
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
            assert "entry_time" in data
            assert "student_id" in data
            print(f"Mark entry success: entry_time={data.get('entry_time')}")
        elif response.status_code == 400:
            # Already marked - this is expected behavior
            error_detail = response.json().get("detail", "")
            assert "ya registrada" in error_detail.lower() or "already" in error_detail.lower()
            print(f"Entry already marked (expected): {error_detail}")
        elif response.status_code == 404:
            pytest.skip(f"Student not found in school context: {response.text}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}: {response.text}")


class TestQRScanResponse:
    """Test QR scan endpoint response format"""
    
    def test_qr_scan_validates_token_format(self, api_client):
        """POST /api/attendance/qr/scan validates QR token"""
        # Test with invalid token
        response = api_client.post(f"{BASE_URL}/api/attendance/qr/scan", json={
            "qr_token": "invalid_token_12345",
            "mode": "auto"
        })
        
        # Should return 400 with error
        assert response.status_code == 400, f"Expected 400 for invalid token, got {response.status_code}"
        
        data = response.json()
        detail = data.get("detail", {})
        if isinstance(detail, dict):
            assert "status" in detail or "message" in detail
            assert detail.get("status") == "error" or "message" in detail
        print(f"Invalid QR token correctly rejected: {detail}")


class TestStudentReportsEndpoint:
    """Test Student Attendance Reports endpoint"""
    
    def test_student_reports_endpoint_exists(self, api_client):
        """GET /api/attendance/reports/students endpoint exists"""
        response = api_client.get(f"{BASE_URL}/api/attendance/reports/students")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "summary" in data, "Response should contain 'summary'"
        assert "report" in data, "Response should contain 'report'"
        
        print(f"Student reports: {data['summary'].get('total_records', 0)} total records")


class TestStudentAttendanceEndpoints:
    """Test student attendance list endpoints"""
    
    def test_get_students_attendance(self, api_client):
        """GET /api/attendance/students returns student list with attendance"""
        # First get a grade and section
        grades_response = api_client.get(f"{BASE_URL}/api/academic/grades")
        if grades_response.status_code != 200:
            pytest.skip("Could not get grades")
        
        grades = grades_response.json()
        if not grades:
            pytest.skip("No grades found")
        
        grade_id = grades[0].get("id")
        
        sections_response = api_client.get(f"{BASE_URL}/api/academic/sections")
        if sections_response.status_code != 200:
            pytest.skip("Could not get sections")
        
        sections = sections_response.json()
        grade_sections = [s for s in sections if s.get("grado_id") == grade_id]
        if not grade_sections:
            pytest.skip("No sections found for grade")
        
        section_id = grade_sections[0].get("id")
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = api_client.get(
            f"{BASE_URL}/api/attendance/students?grade_id={grade_id}&section_id={section_id}&date={today}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "students" in data
        assert "has_saved_records" in data
        
        print(f"Got {len(data.get('students', []))} students for attendance")


class TestTeacherAttendanceEndpoints:
    """Test teacher attendance endpoints"""
    
    def test_get_teachers_attendance(self, api_client):
        """GET /api/attendance/teachers returns teacher list"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = api_client.get(f"{BASE_URL}/api/attendance/teachers?date={today}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "teachers" in data
        assert "has_saved_records" in data
        
        print(f"Got {len(data.get('teachers', []))} teachers for attendance")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
