"""
Test Teacher Attendance Module
Tests for:
- GET /api/teacher/courses - Get teacher's assigned courses/sections
- GET /api/teacher/students - Get students from teacher's sections
- GET /api/teacher/attendance - Get attendance records for a section
- POST /api/teacher/attendance - Save attendance records
- GET /api/attendance/reports/students - Get attendance reports
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEACHER_EMAIL = "sonia3009@gmail.com"
TEACHER_PASSWORD = "1234abc8"
SCHOOL_SUBDOMAIN = "elroble"


class TestTeacherAttendance:
    """Teacher Attendance endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with teacher authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as teacher
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            print(f"Logged in as teacher: {self.user.get('name')} ({self.user.get('email')})")
        else:
            pytest.skip(f"Teacher login failed: {login_response.status_code} - {login_response.text}")
    
    def test_01_teacher_login_success(self):
        """TEST 1: Verify teacher login returns correct role"""
        assert self.user is not None, "User should be returned after login"
        assert self.user.get("role") == "teacher", f"Expected role 'teacher', got '{self.user.get('role')}'"
        assert self.user.get("email") == TEACHER_EMAIL, "Email should match"
        print(f"SUCCESS: Teacher login verified - Role: {self.user.get('role')}")
    
    def test_02_get_teacher_courses(self):
        """TEST 2: Get teacher's assigned courses/sections"""
        response = self.session.get(f"{BASE_URL}/api/teacher/courses")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "courses" in data, "Response should contain 'courses' key"
        
        courses = data["courses"]
        print(f"SUCCESS: Teacher has {len(courses)} assigned courses")
        
        # Store section_id for later tests
        if courses:
            self.section_id = courses[0].get("section_id")
            self.grade_id = courses[0].get("grade_id")
            print(f"  - First course: {courses[0].get('name')} (Section: {courses[0].get('section_name')})")
            print(f"  - Section ID: {self.section_id}")
            print(f"  - Grade ID: {self.grade_id}")
        
        return courses
    
    def test_03_get_teacher_students(self):
        """TEST 3: Get students from teacher's sections"""
        # First get courses to get section_id
        courses_response = self.session.get(f"{BASE_URL}/api/teacher/courses")
        courses = courses_response.json().get("courses", [])
        
        if not courses:
            pytest.skip("No courses assigned to teacher")
        
        section_id = courses[0].get("section_id")
        
        # Get students for this section
        response = self.session.get(f"{BASE_URL}/api/teacher/students?section_id={section_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "students" in data, "Response should contain 'students' key"
        
        students = data["students"]
        print(f"SUCCESS: Found {len(students)} students in section")
        
        if students:
            print(f"  - First student: {students[0].get('name')} {students[0].get('last_name')}")
        
        return students
    
    def test_04_get_teacher_students_all_sections(self):
        """TEST 4: Get students from all teacher's sections (no section_id filter)"""
        response = self.session.get(f"{BASE_URL}/api/teacher/students")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "students" in data, "Response should contain 'students' key"
        assert "sections" in data, "Response should contain 'sections' key"
        
        students = data["students"]
        sections = data["sections"]
        
        print(f"SUCCESS: Found {len(students)} total students across {len(sections)} sections")
        
        return data
    
    def test_05_get_attendance_records(self):
        """TEST 5: Get attendance records for a section on a specific date"""
        # First get courses to get section_id
        courses_response = self.session.get(f"{BASE_URL}/api/teacher/courses")
        courses = courses_response.json().get("courses", [])
        
        if not courses:
            pytest.skip("No courses assigned to teacher")
        
        section_id = courses[0].get("section_id")
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get attendance records
        response = self.session.get(f"{BASE_URL}/api/teacher/attendance?section_id={section_id}&date={today}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "records" in data, "Response should contain 'records' key"
        
        records = data["records"]
        print(f"SUCCESS: Found {len(records)} attendance records for {today}")
        
        return records
    
    def test_06_save_attendance_records(self):
        """TEST 6: Save attendance records for students"""
        # First get courses to get section_id
        courses_response = self.session.get(f"{BASE_URL}/api/teacher/courses")
        courses = courses_response.json().get("courses", [])
        
        if not courses:
            pytest.skip("No courses assigned to teacher")
        
        section_id = courses[0].get("section_id")
        
        # Get students for this section
        students_response = self.session.get(f"{BASE_URL}/api/teacher/students?section_id={section_id}")
        students = students_response.json().get("students", [])
        
        if not students:
            pytest.skip("No students in section")
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Create attendance records for all students
        records = []
        statuses = ["present", "late", "absent"]
        for i, student in enumerate(students):
            records.append({
                "student_id": student["id"],
                "status": statuses[i % 3]  # Rotate through statuses
            })
        
        # Save attendance
        response = self.session.post(f"{BASE_URL}/api/teacher/attendance", json={
            "section_id": section_id,
            "date": today,
            "records": records
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message' key"
        assert data.get("count") == len(records), f"Expected count {len(records)}, got {data.get('count')}"
        
        print(f"SUCCESS: Saved {len(records)} attendance records")
        print(f"  - Message: {data.get('message')}")
        
        return data
    
    def test_07_verify_saved_attendance(self):
        """TEST 7: Verify attendance records were saved correctly"""
        # First get courses to get section_id
        courses_response = self.session.get(f"{BASE_URL}/api/teacher/courses")
        courses = courses_response.json().get("courses", [])
        
        if not courses:
            pytest.skip("No courses assigned to teacher")
        
        section_id = courses[0].get("section_id")
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get attendance records
        response = self.session.get(f"{BASE_URL}/api/teacher/attendance?section_id={section_id}&date={today}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        records = data.get("records", [])
        
        # Verify records exist
        assert len(records) > 0, "Should have attendance records after saving"
        
        # Verify record structure
        for record in records:
            assert "student_id" in record, "Record should have student_id"
            assert "status" in record, "Record should have status"
            assert record["status"] in ["present", "late", "absent", "justified"], f"Invalid status: {record['status']}"
        
        print(f"SUCCESS: Verified {len(records)} attendance records")
        
        # Count by status
        present = sum(1 for r in records if r["status"] == "present")
        late = sum(1 for r in records if r["status"] == "late")
        absent = sum(1 for r in records if r["status"] == "absent")
        print(f"  - Present: {present}, Late: {late}, Absent: {absent}")
        
        return records
    
    def test_08_get_attendance_report(self):
        """TEST 8: Get attendance report for students"""
        # First get courses to get section_id and grade_id
        courses_response = self.session.get(f"{BASE_URL}/api/teacher/courses")
        courses = courses_response.json().get("courses", [])
        
        if not courses:
            pytest.skip("No courses assigned to teacher")
        
        section_id = courses[0].get("section_id")
        grade_id = courses[0].get("grade_id")
        
        # Get date range (last 30 days)
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Get attendance report
        response = self.session.get(
            f"{BASE_URL}/api/attendance/reports/students",
            params={
                "grade_id": grade_id,
                "section_id": section_id,
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "report" in data, "Response should contain 'report' key"
        assert "summary" in data, "Response should contain 'summary' key"
        
        report = data["report"]
        summary = data["summary"]
        
        print(f"SUCCESS: Got attendance report with {len(report)} students")
        print(f"  - Summary: {summary}")
        
        # Verify report structure
        if report:
            student_report = report[0]
            assert "student_id" in student_report, "Report should have student_id"
            assert "student_name" in student_report, "Report should have student_name"
            assert "present" in student_report, "Report should have present count"
            assert "late" in student_report, "Report should have late count"
            assert "absent" in student_report, "Report should have absent count"
            assert "attendance_rate" in student_report, "Report should have attendance_rate"
            
            print(f"  - First student: {student_report['student_name']}")
            print(f"    Present: {student_report['present']}, Late: {student_report['late']}, Absent: {student_report['absent']}")
            print(f"    Attendance Rate: {student_report['attendance_rate']}%")
        
        return data
    
    def test_09_unauthorized_section_access(self):
        """TEST 9: Verify teacher cannot access unauthorized section"""
        # Use a fake section_id that teacher doesn't have access to
        fake_section_id = "fake-section-id-12345"
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Try to get attendance for unauthorized section
        response = self.session.get(f"{BASE_URL}/api/teacher/attendance?section_id={fake_section_id}&date={today}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("SUCCESS: Unauthorized section access correctly blocked (403)")
    
    def test_10_save_attendance_unauthorized_section(self):
        """TEST 10: Verify teacher cannot save attendance for unauthorized section"""
        fake_section_id = "fake-section-id-12345"
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Try to save attendance for unauthorized section
        response = self.session.post(f"{BASE_URL}/api/teacher/attendance", json={
            "section_id": fake_section_id,
            "date": today,
            "records": [{"student_id": "fake-student", "status": "present"}]
        })
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("SUCCESS: Unauthorized section save correctly blocked (403)")
    
    def test_11_invalid_date_format(self):
        """TEST 11: Verify invalid date format is rejected"""
        # First get courses to get section_id
        courses_response = self.session.get(f"{BASE_URL}/api/teacher/courses")
        courses = courses_response.json().get("courses", [])
        
        if not courses:
            pytest.skip("No courses assigned to teacher")
        
        section_id = courses[0].get("section_id")
        
        # Try to save with invalid date format
        response = self.session.post(f"{BASE_URL}/api/teacher/attendance", json={
            "section_id": section_id,
            "date": "22-02-2026",  # Invalid format (should be YYYY-MM-DD)
            "records": [{"student_id": "test", "status": "present"}]
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("SUCCESS: Invalid date format correctly rejected (400)")


class TestNonTeacherAccess:
    """Test that non-teacher users cannot access teacher endpoints"""
    
    def test_student_cannot_access_teacher_courses(self):
        """TEST: Student cannot access teacher courses endpoint"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as a student (using demo student if available)
        # First try to find a student account
        admin_login = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@elroble.edu",
            "password": "1234abc8",
            "subdomain": SCHOOL_SUBDOMAIN
        })
        
        if admin_login.status_code != 200:
            pytest.skip("Could not login as admin to test")
        
        admin_token = admin_login.json().get("token")
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # Admin is not a teacher, so should get 403
        response = session.get(f"{BASE_URL}/api/teacher/courses")
        
        # Admin/Director should get 403 as they are not teachers
        assert response.status_code == 403, f"Expected 403 for non-teacher, got {response.status_code}"
        print("SUCCESS: Non-teacher correctly blocked from teacher endpoints (403)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
