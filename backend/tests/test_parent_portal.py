"""
Test Parent Portal API Endpoints
Tests for EduNet Parent Portal - Replica of Student Portal for parents/guardians
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SCHOOL_SUBDOMAIN = "elroble"
PARENT_EMAIL = "maria.peres@gmail.com"
PARENT_PASSWORD = "1234abc8"
LINKED_STUDENT_ID = "b41a1387-5520-47b9-bd13-bf5dada51813"
LINKED_STUDENT_NAME = "Pepito Peres Rios"
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"


class TestParentAuthentication:
    """Test parent login and authentication"""
    
    def test_parent_login_success(self):
        """Parent can login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        # Verify user role is parent
        user = data.get("user", {})
        assert user.get("role") == "parent", f"Expected role 'parent', got '{user.get('role')}'"
        print(f"✓ Parent login successful: {user.get('name')} {user.get('last_name')}")
    
    def test_parent_login_invalid_credentials(self):
        """Parent login fails with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PARENT_EMAIL,
                "password": "wrongpassword",
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


class TestParentProfile:
    """Test GET /api/parent/me endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        """Get parent authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Parent login failed: {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_get_parent_profile(self, parent_token):
        """GET /api/parent/me returns parent profile with linked children"""
        response = requests.get(
            f"{BASE_URL}/api/parent/me",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify user info
        assert "user" in data, "Missing 'user' in response"
        user = data["user"]
        assert user.get("role") == "parent", f"Expected role 'parent', got '{user.get('role')}'"
        
        # Verify children list
        assert "children" in data, "Missing 'children' in response"
        children = data["children"]
        assert isinstance(children, list), "children should be a list"
        assert len(children) > 0, "Parent should have at least one linked child"
        
        # Verify linked student is in children list
        child_ids = [c["id"] for c in children]
        assert LINKED_STUDENT_ID in child_ids, f"Expected student {LINKED_STUDENT_ID} in children list"
        
        # Verify child has required fields
        child = next((c for c in children if c["id"] == LINKED_STUDENT_ID), None)
        assert child is not None, "Linked student not found"
        assert "name" in child, "Child missing 'name'"
        assert "grado_name" in child or "grado_id" in child, "Child missing grade info"
        
        print(f"✓ Parent profile retrieved with {len(children)} children")
        print(f"  - Linked child: {child.get('name')} {child.get('last_name')}")
    
    def test_parent_profile_requires_auth(self):
        """GET /api/parent/me requires authentication"""
        response = requests.get(f"{BASE_URL}/api/parent/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated request correctly rejected")


class TestParentStudents:
    """Test GET /api/parent/students endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        """Get parent authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Parent login failed: {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_get_parent_students(self, parent_token):
        """GET /api/parent/students returns list of linked students"""
        response = requests.get(
            f"{BASE_URL}/api/parent/students",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "students" in data, "Missing 'students' in response"
        students = data["students"]
        assert isinstance(students, list), "students should be a list"
        assert len(students) > 0, "Parent should have at least one linked student"
        
        # Verify student has academic info
        student = students[0]
        assert "id" in student, "Student missing 'id'"
        assert "name" in student, "Student missing 'name'"
        
        print(f"✓ Parent has {len(students)} linked students")
        for s in students:
            print(f"  - {s.get('name')} {s.get('last_name')} ({s.get('grado_name', 'N/A')})")


class TestParentDashboard:
    """Test GET /api/parent/dashboard endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        """Get parent authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Parent login failed: {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_get_dashboard_for_linked_student(self, parent_token):
        """GET /api/parent/dashboard returns dashboard data for linked student"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={LINKED_STUDENT_ID}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify student info
        assert "student" in data, "Missing 'student' in response"
        student = data["student"]
        assert student.get("id") == LINKED_STUDENT_ID, "Wrong student returned"
        
        # Verify academic info
        assert "academic" in data, "Missing 'academic' in response"
        
        # Verify stats
        assert "stats" in data, "Missing 'stats' in response"
        stats = data["stats"]
        assert "courses_count" in stats, "Missing courses_count in stats"
        assert "pending_tasks" in stats, "Missing pending_tasks in stats"
        assert "attendance_rate" in stats, "Missing attendance_rate in stats"
        
        # Verify attendance summary
        assert "attendance_summary" in data, "Missing 'attendance_summary' in response"
        
        print(f"✓ Dashboard retrieved for {student.get('name')}")
        print(f"  - Courses: {stats.get('courses_count')}")
        print(f"  - Pending tasks: {stats.get('pending_tasks')}")
        print(f"  - Attendance rate: {stats.get('attendance_rate')}%")
    
    def test_dashboard_requires_student_id(self, parent_token):
        """GET /api/parent/dashboard requires student_id parameter"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Missing student_id correctly rejected")
    
    def test_dashboard_access_denied_for_unlinked_student(self, parent_token):
        """Parent cannot access dashboard of unlinked student"""
        fake_student_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={fake_student_id}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print("✓ Access to unlinked student correctly denied")


class TestParentTasks:
    """Test GET /api/parent/tasks endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        """Get parent authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Parent login failed: {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_get_tasks_for_linked_student(self, parent_token):
        """GET /api/parent/tasks returns tasks for linked student"""
        response = requests.get(
            f"{BASE_URL}/api/parent/tasks?student_id={LINKED_STUDENT_ID}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "tasks" in data, "Missing 'tasks' in response"
        assert "stats" in data, "Missing 'stats' in response"
        
        tasks = data["tasks"]
        assert isinstance(tasks, list), "tasks should be a list"
        
        stats = data["stats"]
        assert "pending" in stats, "Missing 'pending' in stats"
        assert "submitted" in stats, "Missing 'submitted' in stats"
        assert "graded" in stats, "Missing 'graded' in stats"
        
        print(f"✓ Tasks retrieved: {len(tasks)} total")
        print(f"  - Pending: {stats.get('pending')}")
        print(f"  - Submitted: {stats.get('submitted')}")
        print(f"  - Graded: {stats.get('graded')}")
        
        # Verify task structure if tasks exist
        if tasks:
            task = tasks[0]
            assert "id" in task, "Task missing 'id'"
            assert "title" in task, "Task missing 'title'"
            assert "status" in task, "Task missing 'status'"
            assert "subject_name" in task, "Task missing 'subject_name'"
    
    def test_tasks_filter_by_status(self, parent_token):
        """GET /api/parent/tasks can filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/parent/tasks?student_id={LINKED_STUDENT_ID}&status=pending",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        tasks = data.get("tasks", [])
        for task in tasks:
            assert task.get("status") == "pending", f"Expected pending task, got {task.get('status')}"
        
        print(f"✓ Status filter working: {len(tasks)} pending tasks")


class TestParentGrades:
    """Test GET /api/parent/grades endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        """Get parent authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Parent login failed: {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_get_grades_for_linked_student(self, parent_token):
        """GET /api/parent/grades returns grades for linked student"""
        response = requests.get(
            f"{BASE_URL}/api/parent/grades?student_id={LINKED_STUDENT_ID}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "grades" in data, "Missing 'grades' in response"
        assert "subjects" in data, "Missing 'subjects' in response"
        assert "average" in data, "Missing 'average' in response"
        
        grades = data["grades"]
        subjects = data["subjects"]
        
        print(f"✓ Grades retrieved: {len(grades)} grades across {len(subjects)} subjects")
        print(f"  - Overall average: {data.get('average')}")
        
        # Verify grade structure if grades exist
        if grades:
            grade = grades[0]
            assert "id" in grade or "grade" in grade, "Grade missing identifier"
            assert "subject_name" in grade, "Grade missing 'subject_name'"
            assert "grade" in grade, "Grade missing 'grade' value"
        
        # Verify subject structure
        if subjects:
            subject = subjects[0]
            assert "id" in subject, "Subject missing 'id'"
            assert "name" in subject, "Subject missing 'name'"
            assert "average" in subject, "Subject missing 'average'"


class TestParentAttendance:
    """Test GET /api/parent/attendance endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        """Get parent authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Parent login failed: {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_get_attendance_for_linked_student(self, parent_token):
        """GET /api/parent/attendance returns attendance for linked student"""
        response = requests.get(
            f"{BASE_URL}/api/parent/attendance?student_id={LINKED_STUDENT_ID}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "records" in data, "Missing 'records' in response"
        assert "stats" in data, "Missing 'stats' in response"
        assert "attendance_rate" in data, "Missing 'attendance_rate' in response"
        
        records = data["records"]
        stats = data["stats"]
        
        # Verify stats structure
        assert "present" in stats, "Missing 'present' in stats"
        assert "absent" in stats, "Missing 'absent' in stats"
        assert "late" in stats, "Missing 'late' in stats"
        assert "total" in stats, "Missing 'total' in stats"
        
        print(f"✓ Attendance retrieved: {len(records)} records")
        print(f"  - Present: {stats.get('present')}")
        print(f"  - Absent: {stats.get('absent')}")
        print(f"  - Late: {stats.get('late')}")
        print(f"  - Attendance rate: {data.get('attendance_rate')}%")
    
    def test_attendance_filter_by_month(self, parent_token):
        """GET /api/parent/attendance can filter by month"""
        response = requests.get(
            f"{BASE_URL}/api/parent/attendance?student_id={LINKED_STUDENT_ID}&month=2025-01",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        records = data.get("records", [])
        for record in records:
            date = record.get("date", "")
            assert date.startswith("2025-01"), f"Expected January 2025, got {date}"
        
        print(f"✓ Month filter working: {len(records)} records for 2025-01")


class TestParentAccessControl:
    """Test parent access control - parent can only see linked children"""
    
    @pytest.fixture
    def parent_token(self):
        """Get parent authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Parent login failed: {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "subdomain": SCHOOL_SUBDOMAIN
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_parent_cannot_access_unlinked_student_dashboard(self, parent_token):
        """Parent cannot access dashboard of student not linked to them"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard?student_id={fake_id}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print("✓ Parent cannot access unlinked student dashboard")
    
    def test_parent_cannot_access_unlinked_student_tasks(self, parent_token):
        """Parent cannot access tasks of student not linked to them"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/parent/tasks?student_id={fake_id}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print("✓ Parent cannot access unlinked student tasks")
    
    def test_parent_cannot_access_unlinked_student_grades(self, parent_token):
        """Parent cannot access grades of student not linked to them"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/parent/grades?student_id={fake_id}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print("✓ Parent cannot access unlinked student grades")
    
    def test_parent_cannot_access_unlinked_student_attendance(self, parent_token):
        """Parent cannot access attendance of student not linked to them"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/parent/attendance?student_id={fake_id}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print("✓ Parent cannot access unlinked student attendance")
    
    def test_non_parent_cannot_access_parent_endpoints(self, admin_token):
        """Non-parent users cannot access parent-specific endpoints"""
        response = requests.get(
            f"{BASE_URL}/api/parent/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-parent user correctly denied access to parent endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
