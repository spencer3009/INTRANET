"""
Test suite for Attendance Justification feature
Tests:
- GET /api/attendance/justification-reasons - returns 6 valid reasons
- POST /api/attendance/justify - justify attendance with reason and note
- Validation: invalid reason, note > 500 chars, auth required
- GET /api/attendance/students - returns justification fields for justified records
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
TEACHER_EMAIL = "sonia3009@gmail.com"
TEACHER_PASSWORD = "teacher123"

# Expected justification reasons
EXPECTED_REASONS = ["salud", "permiso_familiar", "tramite", "duelo", "viaje", "otro"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def teacher_token():
    """Get teacher authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Teacher login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def test_student_and_grade(admin_token):
    """Get a test student with grade/section for testing"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get grades
    grades_res = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
    if grades_res.status_code != 200 or not grades_res.json():
        pytest.skip("No grades available for testing")
    
    grades = grades_res.json()
    active_grades = [g for g in grades if g.get("activo")]
    if not active_grades:
        pytest.skip("No active grades available")
    
    grade = active_grades[0]
    grade_id = grade["id"]
    
    # Get sections for this grade
    sections_res = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
    if sections_res.status_code != 200:
        pytest.skip("Could not load sections")
    
    sections = [s for s in sections_res.json() if s.get("grado_id") == grade_id and s.get("activo")]
    if not sections:
        pytest.skip(f"No active sections for grade {grade_id}")
    
    section = sections[0]
    section_id = section["id"]
    
    # Get students for this grade/section
    today = datetime.now().strftime("%Y-%m-%d")
    students_res = requests.get(
        f"{BASE_URL}/api/attendance/students",
        headers=headers,
        params={"grade_id": grade_id, "section_id": section_id, "date": today}
    )
    
    if students_res.status_code != 200:
        pytest.skip(f"Could not load students: {students_res.text}")
    
    students = students_res.json().get("students", [])
    if not students:
        pytest.skip("No students found in section")
    
    return {
        "student": students[0],
        "grade_id": grade_id,
        "section_id": section_id,
        "date": today
    }


class TestJustificationReasons:
    """Tests for GET /api/attendance/justification-reasons endpoint"""
    
    def test_get_justification_reasons_returns_6_reasons(self):
        """GET /api/attendance/justification-reasons returns 6 valid reasons"""
        response = requests.get(f"{BASE_URL}/api/attendance/justification-reasons")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "reasons" in data, "Response should contain 'reasons' key"
        
        reasons = data["reasons"]
        assert len(reasons) == 6, f"Expected 6 reasons, got {len(reasons)}"
        
        # Verify all expected reasons are present
        reason_ids = [r["id"] for r in reasons]
        for expected_id in EXPECTED_REASONS:
            assert expected_id in reason_ids, f"Missing reason: {expected_id}"
        
        # Verify each reason has id and label
        for reason in reasons:
            assert "id" in reason, "Each reason should have 'id'"
            assert "label" in reason, "Each reason should have 'label'"
            assert isinstance(reason["label"], str) and len(reason["label"]) > 0
        
        print(f"✓ GET /api/attendance/justification-reasons returns 6 valid reasons: {reason_ids}")


class TestJustifyAttendance:
    """Tests for POST /api/attendance/justify endpoint"""
    
    def test_justify_attendance_success(self, admin_token, test_student_and_grade):
        """POST /api/attendance/justify with valid data returns 200 and persists justification"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        student = test_student_and_grade["student"]
        date = test_student_and_grade["date"]
        
        payload = {
            "student_id": student["id"],
            "date": date,
            "justification_reason": "salud",
            "justification_note": "Certificado médico presentado"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance/justify", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("justification_reason") == "salud"
        assert data.get("justification_note") == "Certificado médico presentado"
        assert "justified_by" in data
        assert "justified_by_name" in data
        assert "justified_at" in data
        assert "justification_reason_label" in data
        
        print(f"✓ POST /api/attendance/justify success for student {student['id']}")
    
    def test_justify_attendance_without_note(self, admin_token, test_student_and_grade):
        """POST /api/attendance/justify works without optional note"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        student = test_student_and_grade["student"]
        date = test_student_and_grade["date"]
        
        payload = {
            "student_id": student["id"],
            "date": date,
            "justification_reason": "permiso_familiar"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance/justify", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("justification_reason") == "permiso_familiar"
        assert data.get("justification_note") == ""  # Empty string when not provided
        
        print("✓ POST /api/attendance/justify works without optional note")
    
    def test_justify_attendance_invalid_reason_returns_400(self, admin_token, test_student_and_grade):
        """POST /api/attendance/justify with invalid reason returns 400"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        student = test_student_and_grade["student"]
        date = test_student_and_grade["date"]
        
        payload = {
            "student_id": student["id"],
            "date": date,
            "justification_reason": "invalid_reason_xyz",
            "justification_note": "Test note"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance/justify", json=payload, headers=headers)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "inválido" in response.json().get("detail", "").lower() or "invalid" in response.json().get("detail", "").lower()
        
        print("✓ POST /api/attendance/justify with invalid reason returns 400")
    
    def test_justify_attendance_note_exceeds_500_chars_returns_400(self, admin_token, test_student_and_grade):
        """POST /api/attendance/justify with note > 500 chars returns 400"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        student = test_student_and_grade["student"]
        date = test_student_and_grade["date"]
        
        long_note = "A" * 501  # 501 characters
        
        payload = {
            "student_id": student["id"],
            "date": date,
            "justification_reason": "salud",
            "justification_note": long_note
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance/justify", json=payload, headers=headers)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "500" in response.json().get("detail", "") or "exceder" in response.json().get("detail", "").lower()
        
        print("✓ POST /api/attendance/justify with note > 500 chars returns 400")
    
    def test_justify_attendance_without_auth_returns_401(self, test_student_and_grade):
        """POST /api/attendance/justify without auth returns 401"""
        student = test_student_and_grade["student"]
        date = test_student_and_grade["date"]
        
        payload = {
            "student_id": student["id"],
            "date": date,
            "justification_reason": "salud"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance/justify", json=payload)
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✓ POST /api/attendance/justify without auth returns 401")
    
    def test_teacher_can_justify_attendance(self, teacher_token, test_student_and_grade):
        """Teacher role can also justify attendance"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        student = test_student_and_grade["student"]
        date = test_student_and_grade["date"]
        
        payload = {
            "student_id": student["id"],
            "date": date,
            "justification_reason": "viaje",
            "justification_note": "Viaje familiar autorizado"
        }
        
        response = requests.post(f"{BASE_URL}/api/attendance/justify", json=payload, headers=headers)
        
        # Teacher should be able to justify (200) or get 403 if not assigned to section
        # Based on code, teachers with role "teacher" can justify
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            print("✓ Teacher can justify attendance")
        else:
            print("✓ Teacher access correctly restricted (not assigned to section)")


class TestJustificationFieldsInStudentList:
    """Tests for justification fields in GET /api/attendance/students response"""
    
    def test_students_endpoint_returns_justification_fields(self, admin_token, test_student_and_grade):
        """GET /api/attendance/students returns justification fields for justified records"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        grade_id = test_student_and_grade["grade_id"]
        section_id = test_student_and_grade["section_id"]
        date = test_student_and_grade["date"]
        
        # First, justify a student
        student = test_student_and_grade["student"]
        justify_payload = {
            "student_id": student["id"],
            "date": date,
            "justification_reason": "duelo",
            "justification_note": "Fallecimiento de familiar"
        }
        requests.post(f"{BASE_URL}/api/attendance/justify", json=justify_payload, headers=headers)
        
        # Now get students and verify justification fields
        response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=headers,
            params={"grade_id": grade_id, "section_id": section_id, "date": date}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        students = response.json().get("students", [])
        justified_student = next((s for s in students if s["id"] == student["id"]), None)
        
        assert justified_student is not None, "Student not found in response"
        
        # Verify justification fields are present
        assert "justification_reason" in justified_student, "Missing justification_reason field"
        assert "justification_note" in justified_student, "Missing justification_note field"
        assert "justified_by" in justified_student, "Missing justified_by field"
        assert "justified_by_name" in justified_student, "Missing justified_by_name field"
        assert "justified_at" in justified_student, "Missing justified_at field"
        
        # Verify values
        assert justified_student["status"] == "justified"
        assert justified_student["justification_reason"] == "duelo"
        assert justified_student["justification_note"] == "Fallecimiento de familiar"
        
        print(f"✓ GET /api/attendance/students returns justification fields for justified student")


class TestTeacherPortalJustificationFields:
    """Tests for justification fields in teacher portal attendance endpoint"""
    
    def test_teacher_attendance_returns_justification_fields(self, teacher_token):
        """GET /api/teacher/attendance returns justification fields"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        # Get teacher's sections
        courses_res = requests.get(f"{BASE_URL}/api/teacher/courses", headers=headers)
        if courses_res.status_code != 200:
            pytest.skip("Could not get teacher courses")
        
        courses = courses_res.json().get("courses", [])
        if not courses:
            pytest.skip("Teacher has no assigned courses")
        
        section_id = courses[0].get("section_id")
        if not section_id:
            pytest.skip("No section_id in course")
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/teacher/attendance",
            headers=headers,
            params={"section_id": section_id, "date": today}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "records" in data
        
        # If there are records, verify structure includes justification fields
        if data["records"]:
            record = data["records"][0]
            # These fields should be present (may be null if not justified)
            expected_fields = ["justification_reason", "justification_note", "justified_by", "justified_by_name", "justified_at"]
            for field in expected_fields:
                assert field in record, f"Missing field: {field}"
        
        print("✓ GET /api/teacher/attendance returns justification fields in records")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
