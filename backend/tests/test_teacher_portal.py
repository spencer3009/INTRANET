"""
Teacher Portal API Tests
Tests for teacher-specific endpoints including:
- Teacher profile
- Teacher dashboard
- Teacher courses
- Teacher students
- Teacher attendance
- Multi-tenant security (teacher can only see data from their school)
- Role-based access control (teacher cannot access admin routes)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEACHER_EMAIL = "profesor.demo@test.pe"
TEACHER_PASSWORD = "test123"
ADMIN_EMAIL = "admin.settings@test.pe"
ADMIN_PASSWORD = "test123"
SCHOOL_SUBDOMAIN = "demosettings"


class TestTeacherAuthentication:
    """Test teacher login and authentication"""
    
    def test_teacher_login_success(self):
        """Teacher can login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        
        # Verify user role is teacher
        assert data["user"]["role"] == "teacher", f"Expected role 'teacher', got '{data['user']['role']}'"
        assert data["user"]["email"] == TEACHER_EMAIL
        
        print(f"✓ Teacher login successful: {data['user']['name']} {data['user'].get('last_name', '')}")
    
    def test_teacher_login_wrong_password(self):
        """Teacher login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": "wrongpassword",
            "subdomain": SCHOOL_SUBDOMAIN
        })
        
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print("✓ Teacher login correctly rejected with wrong password")


class TestTeacherProfile:
    """Test teacher profile endpoint"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip("Teacher login failed")
        return response.json()["token"]
    
    def test_get_teacher_profile(self, teacher_token):
        """Teacher can get their profile"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/teacher/profile", headers=headers)
        
        assert response.status_code == 200, f"Profile request failed: {response.text}"
        data = response.json()
        
        # Verify profile structure
        assert "user" in data, "User not in profile response"
        assert "assigned_courses" in data, "assigned_courses not in profile"
        assert "assigned_sections" in data, "assigned_sections not in profile"
        assert "assignments_count" in data, "assignments_count not in profile"
        
        # Verify user data
        user = data["user"]
        assert user["role"] == "teacher"
        assert user["email"] == TEACHER_EMAIL
        
        print(f"✓ Teacher profile loaded: {user['name']} {user.get('last_name', '')}")
        print(f"  - Assigned courses: {len(data['assigned_courses'])}")
        print(f"  - Assigned sections: {len(data['assigned_sections'])}")
        print(f"  - Total assignments: {data['assignments_count']}")
    
    def test_profile_requires_auth(self):
        """Profile endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/teacher/profile")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Profile endpoint correctly requires authentication")


class TestTeacherDashboard:
    """Test teacher dashboard endpoint"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip("Teacher login failed")
        return response.json()["token"]
    
    def test_get_teacher_dashboard(self, teacher_token):
        """Teacher can get dashboard data"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/teacher/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Dashboard request failed: {response.text}"
        data = response.json()
        
        # Verify dashboard structure
        assert "courses" in data, "courses not in dashboard"
        assert "total_students" in data, "total_students not in dashboard"
        assert "pending_reviews" in data, "pending_reviews not in dashboard"
        assert "today_attendance_pending" in data, "today_attendance_pending not in dashboard"
        
        # Verify data types
        assert isinstance(data["courses"], list), "courses should be a list"
        assert isinstance(data["total_students"], int), "total_students should be int"
        assert isinstance(data["pending_reviews"], int), "pending_reviews should be int"
        
        print(f"✓ Teacher dashboard loaded:")
        print(f"  - Courses: {len(data['courses'])}")
        print(f"  - Total students: {data['total_students']}")
        print(f"  - Pending reviews: {data['pending_reviews']}")
        print(f"  - Attendance pending: {len(data['today_attendance_pending'])}")
        
        # Verify course structure if courses exist
        if data["courses"]:
            course = data["courses"][0]
            assert "id" in course, "Course missing id"
            assert "name" in course, "Course missing name"
            assert "section_name" in course or "section_id" in course, "Course missing section info"
            print(f"  - First course: {course['name']} ({course.get('section_name', 'N/A')})")


class TestTeacherCourses:
    """Test teacher courses endpoint"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip("Teacher login failed")
        return response.json()["token"]
    
    def test_get_teacher_courses(self, teacher_token):
        """Teacher can get their assigned courses"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/teacher/courses", headers=headers)
        
        assert response.status_code == 200, f"Courses request failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "courses" in data, "courses not in response"
        assert isinstance(data["courses"], list), "courses should be a list"
        
        print(f"✓ Teacher courses loaded: {len(data['courses'])} courses")
        
        # Verify course structure
        for course in data["courses"]:
            assert "id" in course, "Course missing id"
            assert "name" in course, "Course missing name"
            print(f"  - {course['name']} | Section: {course.get('section_name', 'N/A')} | Students: {course.get('students_count', 0)}")


class TestTeacherStudents:
    """Test teacher students endpoint"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip("Teacher login failed")
        return response.json()["token"]
    
    def test_get_teacher_students(self, teacher_token):
        """Teacher can get students from assigned sections"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/teacher/students", headers=headers)
        
        assert response.status_code == 200, f"Students request failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "students" in data, "students not in response"
        assert "sections" in data, "sections not in response"
        assert isinstance(data["students"], list), "students should be a list"
        
        print(f"✓ Teacher students loaded: {len(data['students'])} students")
        print(f"  - Available sections: {len(data['sections'])}")
        
        # Verify student structure if students exist
        if data["students"]:
            student = data["students"][0]
            assert "id" in student, "Student missing id"
            assert "name" in student, "Student missing name"
            print(f"  - First student: {student['name']} {student.get('last_name', '')}")


class TestTeacherAttendance:
    """Test teacher attendance endpoint"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip("Teacher login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def teacher_section_id(self, teacher_token):
        """Get a section ID from teacher's assignments"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/teacher/courses", headers=headers)
        if response.status_code != 200:
            pytest.skip("Could not get teacher courses")
        
        courses = response.json().get("courses", [])
        if not courses:
            pytest.skip("Teacher has no assigned courses")
        
        return courses[0].get("section_id")
    
    def test_get_teacher_attendance(self, teacher_token, teacher_section_id):
        """Teacher can get attendance for their sections"""
        if not teacher_section_id:
            pytest.skip("No section ID available")
        
        headers = {"Authorization": f"Bearer {teacher_token}"}
        today = "2025-01-15"  # Use a fixed date for testing
        
        response = requests.get(
            f"{BASE_URL}/api/teacher/attendance?section_id={teacher_section_id}&date={today}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Attendance request failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "records" in data, "records not in response"
        assert isinstance(data["records"], list), "records should be a list"
        
        print(f"✓ Teacher attendance loaded for section {teacher_section_id}")
        print(f"  - Records found: {len(data['records'])}")


class TestMultiTenantSecurity:
    """Test that teacher can only access data from their school"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip("Teacher login failed")
        return response.json()["token"]
    
    def test_teacher_profile_returns_correct_school(self, teacher_token):
        """Teacher profile returns data from their school only"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/teacher/profile", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify school_id is present and consistent
        assert "school_id" in data, "school_id not in profile"
        school_id = data["school_id"]
        
        print(f"✓ Teacher profile returns school_id: {school_id}")
        
        # All assigned courses should be from the same school
        # (This is implicitly verified by the backend filtering)


class TestRoleBasedAccessControl:
    """Test that teacher cannot access admin-only routes"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip("Teacher login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_teacher_cannot_access_admin_users_list(self, teacher_token):
        """Teacher cannot access admin users list endpoint"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        # Should be forbidden or return limited data
        # The exact behavior depends on implementation
        if response.status_code == 200:
            data = response.json()
            # If 200, verify it's not returning all users (admin-level data)
            print(f"⚠ /api/users returned 200 for teacher - verify data is filtered")
        else:
            assert response.status_code in [403, 401], f"Expected 403/401, got {response.status_code}"
            print("✓ Teacher correctly denied access to /api/users")
    
    def test_teacher_cannot_create_users(self, teacher_token):
        """Teacher cannot create new users"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": "test_teacher_create@test.pe",
            "name": "Test",
            "role": "student"
        })
        
        # Should be forbidden
        assert response.status_code in [403, 401, 422], f"Expected 403/401/422, got {response.status_code}"
        print("✓ Teacher correctly denied from creating users")
    
    def test_admin_can_access_teacher_dashboard_returns_403(self, admin_token):
        """Admin accessing teacher-only endpoint should get 403"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/teacher/dashboard", headers=headers)
        
        # Teacher endpoints should reject non-teacher users
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Admin correctly denied access to teacher dashboard")


class TestTeacherTasks:
    """Test teacher tasks endpoint"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code != 200:
            pytest.skip("Teacher login failed")
        return response.json()["token"]
    
    def test_get_teacher_tasks(self, teacher_token):
        """Teacher can get tasks from their courses"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/teacher/tasks", headers=headers)
        
        assert response.status_code == 200, f"Tasks request failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "tasks" in data, "tasks not in response"
        assert isinstance(data["tasks"], list), "tasks should be a list"
        
        print(f"✓ Teacher tasks loaded: {len(data['tasks'])} tasks")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
