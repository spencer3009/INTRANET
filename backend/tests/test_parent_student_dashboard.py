"""
Parent Student Dashboard Tests
Tests the new /api/parent/dashboard endpoint and the ParentStudentDashboardPage frontend component.
This dashboard is a replica of the Student Dashboard for parents to view their children's data.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARENT_EMAIL = "miguel@gmail.com"
PARENT_PASSWORD = "1234abc8"

# Children IDs for testing
PEPITO_ID = "b41a1387-5520-47b9-bd13-bf5dada51813"
JUAN_ID = "a5afef05-95f4-4a18-864e-7afa893fbf57"
JORGE_ID = "bb5797a7-8734-4e81-968f-c6d772843c67"


@pytest.fixture(scope="module")
def parent_token():
    """Login as parent and get token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    assert data["user"]["role"] == "parent", "User is not a parent"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(parent_token):
    """Return authorization headers"""
    return {"Authorization": f"Bearer {parent_token}"}


class TestParentProfile:
    """Tests for /api/parent/me endpoint"""
    
    def test_get_parent_profile_with_children(self, auth_headers):
        """Parent profile should include list of linked children"""
        response = requests.get(f"{BASE_URL}/api/parent/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "user" in data, "Response missing 'user' field"
        assert "children" in data, "Response missing 'children' field"
        assert data["children_count"] == 3, f"Expected 3 children, got {data['children_count']}"
        
        # Verify children names
        child_names = [c["name"] for c in data["children"]]
        assert "Pepito" in child_names
        assert "Juan" in child_names
        assert "Jorge" in child_names
    
    def test_parent_profile_requires_auth(self):
        """Endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/parent/me")
        assert response.status_code == 401 or response.status_code == 403


class TestParentDashboard:
    """Tests for /api/parent/dashboard endpoint - Student Dashboard replica"""
    
    def test_dashboard_returns_full_student_data(self, auth_headers):
        """Dashboard should return comprehensive student data for parent view"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={PEPITO_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Student info
        assert "student" in data
        assert data["student"]["name"] == "Pepito"
        assert data["student"]["last_name"] == "Peres Rios"
        
        # Academic context
        assert "academic" in data
        assert data["academic"]["grado"] is not None
        assert data["academic"]["seccion"] is not None
        
        # Stats
        assert "stats" in data
        assert "courses_count" in data["stats"]
        assert "pending_tasks" in data["stats"]
        assert "unread_messages" in data["stats"]
        assert "attendance_rate" in data["stats"]
        assert "section_students_count" in data["stats"]
    
    def test_dashboard_returns_task_progress(self, auth_headers):
        """Dashboard should include task_progress object"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={PEPITO_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "task_progress" in data
        assert "total_tasks" in data["task_progress"]
        assert "tasks_submitted" in data["task_progress"]
        assert "percentage" in data["task_progress"]
    
    def test_dashboard_returns_upcoming_tasks(self, auth_headers):
        """Dashboard should include upcoming_tasks list"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={PEPITO_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "upcoming_tasks" in data
        assert isinstance(data["upcoming_tasks"], list)
        
        # Check task structure if any tasks exist
        if len(data["upcoming_tasks"]) > 0:
            task = data["upcoming_tasks"][0]
            assert "id" in task
            assert "title" in task
            assert "subject_name" in task
            assert "due_date" in task
    
    def test_dashboard_returns_attendance_summary(self, auth_headers):
        """Dashboard should include attendance_summary"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={PEPITO_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "attendance_summary" in data
        assert "present" in data["attendance_summary"]
        assert "absent" in data["attendance_summary"]
        assert "late" in data["attendance_summary"]
        assert "justified" in data["attendance_summary"]
    
    def test_dashboard_returns_recent_announcements(self, auth_headers):
        """Dashboard should include recent_announcements"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={PEPITO_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "recent_announcements" in data
        assert isinstance(data["recent_announcements"], list)
    
    def test_dashboard_different_children_return_different_data(self, auth_headers):
        """Dashboard data should change when querying different children"""
        # Get Pepito's data
        response1 = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={PEPITO_ID}",
            headers=auth_headers
        )
        data1 = response1.json()
        
        # Get Juan's data
        response2 = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={JUAN_ID}",
            headers=auth_headers
        )
        data2 = response2.json()
        
        # Student names should be different
        assert data1["student"]["name"] == "Pepito"
        assert data2["student"]["name"] == "Juan"
    
    def test_dashboard_requires_student_id(self, auth_headers):
        """Dashboard endpoint requires student_id parameter"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard",
            headers=auth_headers
        )
        assert response.status_code == 422, "Should return 422 for missing student_id"
    
    def test_dashboard_requires_auth(self):
        """Dashboard endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={PEPITO_ID}"
        )
        assert response.status_code in [401, 403]


class TestParentCourses:
    """Tests for /api/parent/courses endpoint"""
    
    def test_courses_returns_list(self, auth_headers):
        """Courses endpoint should return list of student's courses"""
        response = requests.get(
            f"{BASE_URL}/api/parent/courses?student_id={PEPITO_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "courses" in data
        assert isinstance(data["courses"], list)
        assert len(data["courses"]) > 0, "Pepito should have courses assigned"
    
    def test_courses_include_teacher_info(self, auth_headers):
        """Each course should include teacher information"""
        response = requests.get(
            f"{BASE_URL}/api/parent/courses?student_id={PEPITO_ID}",
            headers=auth_headers
        )
        data = response.json()
        
        if len(data["courses"]) > 0:
            course = data["courses"][0]
            assert "teacher" in course
            assert "name" in course["teacher"]


class TestParentDashboardDataConsistency:
    """Tests for data consistency between dashboard and individual endpoints"""
    
    def test_courses_count_matches_dashboard(self, auth_headers):
        """courses_count from dashboard should match courses list length"""
        # Get dashboard
        dashboard = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={PEPITO_ID}",
            headers=auth_headers
        ).json()
        
        # Get courses
        courses = requests.get(
            f"{BASE_URL}/api/parent/courses?student_id={PEPITO_ID}",
            headers=auth_headers
        ).json()
        
        dashboard_count = dashboard.get("courses_count") or dashboard.get("stats", {}).get("courses_count", 0)
        courses_count = len(courses.get("courses", []))
        
        assert dashboard_count == courses_count, f"Dashboard shows {dashboard_count} courses but API returns {courses_count}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
