"""
Test Admin Portal - FASE 3: Gestión Académica
Tests for Grades, Attendance, Tasks, and Exams management endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.pe"
ADMIN_PASSWORD = "test123"
SUBDOMAIN = "demosettings"


class TestAdminAuthentication:
    """Test admin login and token retrieval"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    def test_admin_login_success(self, admin_token):
        """Verify admin can login successfully"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"SUCCESS: Admin login successful, token length: {len(admin_token)}")


class TestAdminGradesManagement:
    """Test Admin Grades Management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_get_grades_summary(self, headers):
        """Test GET /api/admin/grades/summary returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/grades/summary", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "summary" in data, "Response should contain 'summary' key"
        assert isinstance(data["summary"], list), "Summary should be a list"
        
        # If there are sections, verify structure
        if len(data["summary"]) > 0:
            item = data["summary"][0]
            expected_keys = ["section_id", "section_name", "students_count", "grades_count"]
            for key in expected_keys:
                assert key in item, f"Summary item should contain '{key}'"
        
        print(f"SUCCESS: Grades summary returned {len(data['summary'])} sections")
    
    def test_get_admin_grades_list(self, headers):
        """Test GET /api/admin/grades returns grades list"""
        response = requests.get(f"{BASE_URL}/api/admin/grades", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "grades" in data, "Response should contain 'grades' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["grades"], list), "Grades should be a list"
        
        print(f"SUCCESS: Admin grades returned {data['total']} grades")
    
    def test_get_admin_grades_with_filter(self, headers):
        """Test GET /api/admin/grades with section filter"""
        # First get sections to get a valid section_id
        sections_response = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
        if sections_response.status_code == 200:
            sections = sections_response.json()
            if len(sections) > 0:
                section_id = sections[0]["id"]
                response = requests.get(f"{BASE_URL}/api/admin/grades?section_id={section_id}", headers=headers)
                assert response.status_code == 200, f"Failed: {response.text}"
                print(f"SUCCESS: Grades filter by section works")
        else:
            print("SKIP: No sections available for filter test")


class TestAdminAttendanceManagement:
    """Test Admin Attendance Management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_get_attendance_summary(self, headers):
        """Test GET /api/admin/attendance/summary returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/attendance/summary", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "summary" in data, "Response should contain 'summary' key"
        assert "date_range" in data, "Response should contain 'date_range' key"
        assert isinstance(data["summary"], list), "Summary should be a list"
        
        # Verify date_range structure
        assert "from" in data["date_range"], "date_range should have 'from'"
        assert "to" in data["date_range"], "date_range should have 'to'"
        
        # If there are sections, verify structure
        if len(data["summary"]) > 0:
            item = data["summary"][0]
            expected_keys = ["section_id", "section_name", "present", "absent", "late", "justified", "total", "attendance_rate"]
            for key in expected_keys:
                assert key in item, f"Summary item should contain '{key}'"
        
        print(f"SUCCESS: Attendance summary returned {len(data['summary'])} sections")
    
    def test_get_attendance_summary_with_date_range(self, headers):
        """Test GET /api/admin/attendance/summary with date range filter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/attendance/summary?date_from=2026-01-01&date_to=2026-01-31", 
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["date_range"]["from"] == "2026-01-01"
        assert data["date_range"]["to"] == "2026-01-31"
        print("SUCCESS: Attendance summary with date range filter works")
    
    def test_get_admin_attendance_list(self, headers):
        """Test GET /api/admin/attendance returns attendance records"""
        response = requests.get(f"{BASE_URL}/api/admin/attendance", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "records" in data, "Response should contain 'records' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["records"], list), "Records should be a list"
        
        print(f"SUCCESS: Admin attendance returned {data['total']} records")
    
    def test_get_admin_attendance_with_filters(self, headers):
        """Test GET /api/admin/attendance with status filter"""
        response = requests.get(f"{BASE_URL}/api/admin/attendance?status=present", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print("SUCCESS: Attendance filter by status works")


class TestAdminTasksManagement:
    """Test Admin Tasks Management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_get_tasks_summary(self, headers):
        """Test GET /api/admin/tasks/summary returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/tasks/summary", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        expected_keys = ["total", "active", "expired", "closed", "total_submissions", "total_graded", "pending_grading"]
        for key in expected_keys:
            assert key in data, f"Response should contain '{key}'"
        
        # Verify values are integers
        assert isinstance(data["total"], int), "total should be an integer"
        assert isinstance(data["active"], int), "active should be an integer"
        
        print(f"SUCCESS: Tasks summary - Total: {data['total']}, Active: {data['active']}, Expired: {data['expired']}, Closed: {data['closed']}")
    
    def test_get_admin_tasks_list(self, headers):
        """Test GET /api/admin/tasks returns tasks list"""
        response = requests.get(f"{BASE_URL}/api/admin/tasks", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "tasks" in data, "Response should contain 'tasks' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["tasks"], list), "Tasks should be a list"
        
        # If there are tasks, verify structure
        if len(data["tasks"]) > 0:
            task = data["tasks"][0]
            expected_keys = ["id", "title", "subject_name", "teacher_name", "status"]
            for key in expected_keys:
                assert key in task, f"Task should contain '{key}'"
        
        print(f"SUCCESS: Admin tasks returned {data['total']} tasks")
    
    def test_get_admin_tasks_with_status_filter(self, headers):
        """Test GET /api/admin/tasks with status filter"""
        for status in ["active", "expired", "closed"]:
            response = requests.get(f"{BASE_URL}/api/admin/tasks?status={status}", headers=headers)
            assert response.status_code == 200, f"Failed for status {status}: {response.text}"
        print("SUCCESS: Tasks filter by status works for all statuses")


class TestAdminExamsManagement:
    """Test Admin Exams Management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_get_exams_summary(self, headers):
        """Test GET /api/admin/exams/summary returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/exams/summary", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        expected_keys = ["total", "draft", "published", "scheduled", "closed", "archived"]
        for key in expected_keys:
            assert key in data, f"Response should contain '{key}'"
        
        # Verify values are integers
        assert isinstance(data["total"], int), "total should be an integer"
        
        print(f"SUCCESS: Exams summary - Total: {data['total']}, Draft: {data['draft']}, Published: {data['published']}, Scheduled: {data['scheduled']}")
    
    def test_get_admin_exams_list(self, headers):
        """Test GET /api/admin/exams returns exams list"""
        response = requests.get(f"{BASE_URL}/api/admin/exams", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "exams" in data, "Response should contain 'exams' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["exams"], list), "Exams should be a list"
        
        # If there are exams, verify structure
        if len(data["exams"]) > 0:
            exam = data["exams"][0]
            expected_keys = ["id", "title", "subject_name", "teacher_name"]
            for key in expected_keys:
                assert key in exam, f"Exam should contain '{key}'"
        
        print(f"SUCCESS: Admin exams returned {data['total']} exams")
    
    def test_get_admin_exams_with_status_filter(self, headers):
        """Test GET /api/admin/exams with status filter"""
        for status in ["draft", "published", "scheduled", "closed", "archived"]:
            response = requests.get(f"{BASE_URL}/api/admin/exams?status={status}", headers=headers)
            assert response.status_code == 200, f"Failed for status {status}: {response.text}"
        print("SUCCESS: Exams filter by status works for all statuses")


class TestAdminAcademicDataDependencies:
    """Test that required academic data endpoints work for the admin pages"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_get_academic_levels(self, headers):
        """Test GET /api/academic/levels for filter dropdowns"""
        response = requests.get(f"{BASE_URL}/api/academic/levels", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Levels should be a list"
        print(f"SUCCESS: Academic levels returned {len(data)} levels")
    
    def test_get_academic_grades(self, headers):
        """Test GET /api/academic/grades for filter dropdowns"""
        response = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Grades should be a list"
        print(f"SUCCESS: Academic grades returned {len(data)} grades")
    
    def test_get_academic_sections(self, headers):
        """Test GET /api/academic/sections for filter dropdowns"""
        response = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Sections should be a list"
        print(f"SUCCESS: Academic sections returned {len(data)} sections")
    
    def test_get_subjects(self, headers):
        """Test GET /api/academic/subjects for filter dropdowns"""
        response = requests.get(f"{BASE_URL}/api/academic/subjects", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Subjects should be a list"
        print(f"SUCCESS: Academic subjects returned {len(data)} subjects")
    
    def test_get_active_teachers(self, headers):
        """Test GET /api/users/teachers/active for filter dropdowns"""
        response = requests.get(f"{BASE_URL}/api/users/teachers/active", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Teachers should be a list"
        print(f"SUCCESS: Active teachers returned {len(data)} teachers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
