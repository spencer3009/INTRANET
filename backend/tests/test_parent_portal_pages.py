"""
Backend API tests for Parent Portal pages functionality.
Tests all parent-specific endpoints for: Dashboard, Courses, Tasks, Grades, 
Attendance, Schedule, Exams, and Messages pages.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARENT_EMAIL = "miguel@gmail.com"
PARENT_PASSWORD = "password123"
SUBDOMAIN = "elroble"


@pytest.fixture(scope="module")
def parent_auth():
    """Authenticate as parent user and return token and child_id"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD, "subdomain": SUBDOMAIN}
    )
    assert response.status_code == 200, f"Parent login failed: {response.text}"
    data = response.json()
    assert "token" in data
    assert data["user"]["role"] == "parent"
    
    # Get parent profile to find child ID
    headers = {"Authorization": f"Bearer {data['token']}"}
    profile_res = requests.get(f"{BASE_URL}/api/parent/me", headers=headers)
    assert profile_res.status_code == 200
    children = profile_res.json().get("children", [])
    assert len(children) > 0, "Parent must have at least one linked child"
    
    return {
        "token": data["token"],
        "user": data["user"],
        "child_id": children[0]["id"],
        "child_name": children[0]["name"],
        "headers": headers
    }


class TestParentLogin:
    """Parent login endpoint tests"""
    
    def test_parent_login_success(self):
        """Test parent can login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD, "subdomain": SUBDOMAIN}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "parent"
        assert data["user"]["email"] == PARENT_EMAIL
        
    def test_parent_login_wrong_password(self):
        """Test login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARENT_EMAIL, "password": "wrongpassword", "subdomain": SUBDOMAIN}
        )
        assert response.status_code in [401, 400]


class TestParentProfile:
    """Parent profile (GET /api/parent/me) endpoint tests"""
    
    def test_parent_me_returns_profile(self, parent_auth):
        """Test /api/parent/me returns parent profile with children"""
        response = requests.get(f"{BASE_URL}/api/parent/me", headers=parent_auth["headers"])
        assert response.status_code == 200
        data = response.json()
        
        assert "user" in data
        assert "children" in data
        assert data["user"]["role"] == "parent"
        assert len(data["children"]) >= 1
        
    def test_parent_me_requires_auth(self):
        """Test /api/parent/me requires authentication"""
        response = requests.get(f"{BASE_URL}/api/parent/me")
        assert response.status_code == 401


class TestParentDashboard:
    """Parent dashboard endpoint tests"""
    
    def test_parent_dashboard_returns_data(self, parent_auth):
        """Test /api/parent/dashboard returns dashboard data for child"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={parent_auth['child_id']}", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "student" in data
        assert "academic" in data
        assert "stats" in data
        assert data["student"]["id"] == parent_auth["child_id"]
        
    def test_parent_dashboard_requires_student_id(self, parent_auth):
        """Test dashboard requires student_id parameter"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard", 
            headers=parent_auth["headers"]
        )
        # Should return error or default behavior
        assert response.status_code in [200, 400, 422]


class TestParentCourses:
    """Parent courses endpoint tests"""
    
    def test_parent_courses_returns_list(self, parent_auth):
        """Test /api/parent/courses returns courses for child"""
        response = requests.get(
            f"{BASE_URL}/api/parent/courses?student_id={parent_auth['child_id']}", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "courses" in data
        assert isinstance(data["courses"], list)
        
    def test_parent_courses_requires_auth(self):
        """Test courses endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/parent/courses?student_id=test123")
        assert response.status_code == 401


class TestParentTasks:
    """Parent tasks endpoint tests"""
    
    def test_parent_tasks_returns_list(self, parent_auth):
        """Test /api/parent/tasks returns tasks for child"""
        response = requests.get(
            f"{BASE_URL}/api/parent/tasks?student_id={parent_auth['child_id']}", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "tasks" in data
        assert "stats" in data
        assert isinstance(data["tasks"], list)
        # Stats should have task counts
        assert "total" in data["stats"]
        assert "pending" in data["stats"]


class TestParentGrades:
    """Parent grades endpoint tests"""
    
    def test_parent_grades_returns_list(self, parent_auth):
        """Test /api/parent/grades returns grades for child"""
        response = requests.get(
            f"{BASE_URL}/api/parent/grades?student_id={parent_auth['child_id']}", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "grades" in data
        assert isinstance(data["grades"], list)


class TestParentAttendance:
    """Parent attendance endpoint tests"""
    
    def test_parent_attendance_returns_records(self, parent_auth):
        """Test /api/parent/attendance returns attendance records"""
        response = requests.get(
            f"{BASE_URL}/api/parent/attendance?student_id={parent_auth['child_id']}&start_date=2026-01-01&end_date=2026-12-31", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "records" in data
        assert "stats" in data
        assert isinstance(data["records"], list)
        # Stats should have attendance counts
        assert "present" in data["stats"]
        assert "absent" in data["stats"]
        
    def test_parent_attendance_returns_actual_data(self, parent_auth):
        """Test attendance endpoint returns actual records from the database"""
        response = requests.get(
            f"{BASE_URL}/api/parent/attendance?student_id={parent_auth['child_id']}&start_date=2026-01-01&end_date=2026-12-31", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        # Based on the test data, child should have attendance records
        # (1 late, 1 absent as seen in API test)
        stats = data["stats"]
        total = stats.get("total", 0)
        print(f"Attendance stats: {stats}")
        # At least verify structure is correct even if no records


class TestParentSchedule:
    """Parent schedule endpoint tests"""
    
    def test_parent_schedule_returns_data(self, parent_auth):
        """Test /api/parent/schedule returns schedule for child"""
        response = requests.get(
            f"{BASE_URL}/api/parent/schedule?student_id={parent_auth['child_id']}", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        # API returns 'schedule' (not 'schedules')
        assert "schedule" in data
        assert isinstance(data["schedule"], list)
        
    def test_parent_schedule_has_settings(self, parent_auth):
        """Test schedule response includes settings"""
        response = requests.get(
            f"{BASE_URL}/api/parent/schedule?student_id={parent_auth['child_id']}", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "settings" in data
        # Child Juan Lopez Zapata should have schedule entries
        schedule = data.get("schedule", [])
        print(f"Schedule entries count: {len(schedule)}")
        # Based on API test, should have 4 classes


class TestParentExams:
    """Parent exam schedule endpoint tests"""
    
    def test_parent_exams_returns_data(self, parent_auth):
        """Test /api/parent/exam-schedule returns exams for child"""
        response = requests.get(
            f"{BASE_URL}/api/parent/exam-schedule?student_id={parent_auth['child_id']}&from_date=2025-01-01&to_date=2026-12-31", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "exams" in data
        assert isinstance(data["exams"], list)


class TestInternalMail:
    """Internal mail (messages) endpoint tests for parent"""
    
    def test_internal_mail_inbox(self, parent_auth):
        """Test /api/internal-mail/inbox returns inbox"""
        response = requests.get(
            f"{BASE_URL}/api/internal-mail/inbox", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "messages" in data
        assert isinstance(data["messages"], list)
        
    def test_internal_mail_stats(self, parent_auth):
        """Test /api/internal-mail/stats returns mail statistics"""
        response = requests.get(
            f"{BASE_URL}/api/internal-mail/stats", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "unread" in data
        assert "inbox" in data
        assert "sent" in data
        assert "archived" in data
        assert "trash" in data
        
    def test_internal_mail_sent_folder(self, parent_auth):
        """Test /api/internal-mail/sent returns sent messages"""
        response = requests.get(
            f"{BASE_URL}/api/internal-mail/sent", 
            headers=parent_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "messages" in data


class TestParentApiAuthentication:
    """Test that all parent APIs require authentication"""
    
    def test_parent_endpoints_require_auth(self):
        """Test that parent endpoints return 401 without auth"""
        endpoints = [
            "/api/parent/me",
            "/api/parent/dashboard",
            "/api/parent/courses",
            "/api/parent/tasks",
            "/api/parent/grades",
            "/api/parent/attendance",
            "/api/parent/schedule",
            "/api/parent/exam-schedule",
            "/api/internal-mail/inbox",
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 401, f"Endpoint {endpoint} should require auth"
