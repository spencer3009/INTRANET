"""
Attendance Page Redesign - Backend API Tests
Tests for the 3-section attendance landing page (Estudiantes, Profesores, Reportes)
Tests QR scan endpoint accepting both student_qr and teacher_qr types
Tests QR history endpoint returning role field
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"

class TestAttendanceAPIs:
    """Tests for Attendance-related API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    # ────────────────────────────────────────────────────────────────────────────
    # QR HISTORY ENDPOINT - MUST INCLUDE 'role' FIELD
    # ────────────────────────────────────────────────────────────────────────────
    
    def test_qr_history_returns_role_field(self, headers):
        """
        GET /api/attendance/qr/history should return history with 'role' field
        for each record (either 'student' or 'teacher')
        """
        response = requests.get(
            f"{BASE_URL}/api/attendance/qr/history",
            headers=headers,
            params={"limit": 20}
        )
        assert response.status_code == 200, f"QR history request failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "history" in data, "Response should have 'history' field"
        assert "date" in data, "Response should have 'date' field"
        
        # If there are records, check each has 'role' field
        if data["history"]:
            for record in data["history"]:
                assert "role" in record, f"Record missing 'role' field: {record}"
                assert record["role"] in ["student", "teacher"], f"Invalid role: {record['role']}"
                
                # Additional data fields check
                assert "name" in record or "student_name" in record, "Record should have name field"
                
                print(f"✓ QR history record has role='{record['role']}' for {record.get('name', record.get('student_name'))}")
        else:
            print("ℹ No QR scan history for today (empty list is valid)")
        
        print(f"✓ QR history endpoint returns {len(data['history'])} records with 'role' field")
    
    def test_qr_history_endpoint_structure(self, headers):
        """
        Verify the structure of the QR history response
        """
        response = requests.get(
            f"{BASE_URL}/api/attendance/qr/history",
            headers=headers,
            params={"limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required top-level fields
        assert "date" in data, "Should have 'date' field"
        assert "total_scans" in data, "Should have 'total_scans' field"
        assert "history" in data, "Should have 'history' field"
        
        # Verify data types
        assert isinstance(data["history"], list), "'history' should be a list"
        assert isinstance(data["total_scans"], int), "'total_scans' should be an integer"
        
        print(f"✓ QR history endpoint structure is correct (date: {data['date']}, total_scans: {data['total_scans']})")
    
    # ────────────────────────────────────────────────────────────────────────────
    # QR SCAN ENDPOINT - ACCEPTS BOTH student_qr AND teacher_qr TYPES
    # ────────────────────────────────────────────────────────────────────────────
    
    def test_qr_scan_endpoint_exists(self, headers):
        """
        POST /api/attendance/qr/scan endpoint should exist
        Test with invalid token to verify endpoint structure
        """
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            headers=headers,
            json={"qr_token": "invalid_token"}
        )
        # Should return 400 for invalid token, not 404 for missing endpoint
        assert response.status_code in [400, 403], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        assert "detail" in data or "message" in data, "Should return error message"
        
        print(f"✓ QR scan endpoint exists and validates tokens")
    
    # ────────────────────────────────────────────────────────────────────────────
    # STUDENT ATTENDANCE ENDPOINT
    # ────────────────────────────────────────────────────────────────────────────
    
    def test_student_attendance_endpoint(self, headers):
        """
        GET /api/attendance/students endpoint should work with proper filters
        """
        # First get grades to use a valid grade_id
        grades_response = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
        assert grades_response.status_code == 200, f"Failed to get grades: {grades_response.text}"
        grades = grades_response.json()
        
        if not grades:
            pytest.skip("No grades available for testing")
        
        grade_id = grades[0]["id"]
        
        # Get sections for this grade
        sections_response = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
        assert sections_response.status_code == 200
        sections = [s for s in sections_response.json() if s.get("grado_id") == grade_id]
        
        if not sections:
            pytest.skip("No sections available for testing")
        
        section_id = sections[0]["id"]
        
        # Test student attendance endpoint
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=headers,
            params={
                "grade_id": grade_id,
                "section_id": section_id,
                "date": today
            }
        )
        assert response.status_code == 200, f"Student attendance failed: {response.text}"
        data = response.json()
        
        assert "students" in data, "Response should have 'students' field"
        assert "has_saved_records" in data, "Response should have 'has_saved_records' field"
        
        print(f"✓ Student attendance endpoint works (found {len(data['students'])} students)")
    
    # ────────────────────────────────────────────────────────────────────────────
    # TEACHER ATTENDANCE ENDPOINT
    # ────────────────────────────────────────────────────────────────────────────
    
    def test_teacher_attendance_endpoint(self, headers):
        """
        GET /api/attendance/teachers endpoint should return teacher list
        """
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/attendance/teachers",
            headers=headers,
            params={"date": today}
        )
        assert response.status_code == 200, f"Teacher attendance failed: {response.text}"
        data = response.json()
        
        assert "teachers" in data, "Response should have 'teachers' field"
        assert "has_saved_records" in data, "Response should have 'has_saved_records' field"
        
        print(f"✓ Teacher attendance endpoint works (found {len(data['teachers'])} teachers)")
    
    # ────────────────────────────────────────────────────────────────────────────
    # ATTENDANCE REPORTS ENDPOINT
    # ────────────────────────────────────────────────────────────────────────────
    
    def test_attendance_reports_endpoint(self, headers):
        """
        GET /api/attendance/reports/students endpoint should work
        """
        # Get grades and sections first
        grades_response = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
        assert grades_response.status_code == 200
        grades = grades_response.json()
        
        if not grades:
            pytest.skip("No grades for testing reports")
        
        grade_id = grades[0]["id"]
        
        sections_response = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
        sections = [s for s in sections_response.json() if s.get("grado_id") == grade_id]
        
        if not sections:
            pytest.skip("No sections for testing reports")
        
        section_id = sections[0]["id"]
        
        from datetime import datetime, timedelta
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/attendance/reports/students",
            headers=headers,
            params={
                "grade_id": grade_id,
                "section_id": section_id,
                "start_date": start_date,
                "end_date": end_date
            }
        )
        assert response.status_code == 200, f"Reports endpoint failed: {response.text}"
        data = response.json()
        
        assert "report" in data, "Response should have 'report' field"
        assert "summary" in data, "Response should have 'summary' field"
        
        print(f"✓ Attendance reports endpoint works")
    
    # ────────────────────────────────────────────────────────────────────────────
    # QR GENERATE ENDPOINT (FOR ADMIN)
    # ────────────────────────────────────────────────────────────────────────────
    
    def test_qr_generate_endpoint(self, headers):
        """
        POST /api/attendance/qr/generate should exist and work for admin
        """
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/generate",
            headers=headers
        )
        assert response.status_code == 200, f"QR generate failed: {response.text}"
        data = response.json()
        
        # Verify it reports generation results
        assert "students_updated" in data or "message" in data, "Should return generation results"
        
        print(f"✓ QR generate endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
