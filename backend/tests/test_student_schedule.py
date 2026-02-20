"""
Test Student Schedule Endpoint - Read-Only Portal
Tests GET /api/student/schedule endpoint for student portal
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
STUDENT_EMAIL = "pepito@gmail.com"
STUDENT_PASSWORD = "1234abc8"
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"


class TestStudentScheduleEndpoint:
    """Tests for GET /api/student/schedule endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_student_token(self):
        """Get authentication token for student"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        assert response.status_code == 200, f"Student login failed: {response.text}"
        data = response.json()
        assert data.get("user", {}).get("role") == "student", "User is not a student"
        return data["token"]
    
    def get_admin_token(self):
        """Get authentication token for admin"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    def test_student_login_returns_correct_role(self):
        """Test that student login returns role=student"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "student"
        assert data["user"]["email"] == STUDENT_EMAIL
        print(f"✓ Student login successful: {data['user']['name']} ({data['user']['role']})")
    
    def test_student_schedule_returns_200(self):
        """Test that student can access schedule endpoint"""
        token = self.get_student_token()
        response = self.session.get(
            f"{BASE_URL}/api/student/schedule",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Student schedule endpoint returns 200")
    
    def test_student_schedule_returns_schedules_array(self):
        """Test that response contains schedules array"""
        token = self.get_student_token()
        response = self.session.get(
            f"{BASE_URL}/api/student/schedule",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = response.json()
        assert "schedules" in data, "Response missing 'schedules' field"
        assert isinstance(data["schedules"], list), "'schedules' should be a list"
        print(f"✓ Schedules array returned with {len(data['schedules'])} items")
    
    def test_student_schedule_returns_breaks_array(self):
        """Test that response contains breaks array"""
        token = self.get_student_token()
        response = self.session.get(
            f"{BASE_URL}/api/student/schedule",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = response.json()
        assert "breaks" in data, "Response missing 'breaks' field"
        assert isinstance(data["breaks"], list), "'breaks' should be a list"
        print(f"✓ Breaks array returned with {len(data['breaks'])} items")
        
        # Verify break structure
        for brk in data["breaks"]:
            assert "type" in brk, "Break missing 'type' field"
            assert "label" in brk, "Break missing 'label' field"
            assert "start_time" in brk, "Break missing 'start_time' field"
            assert "end_time" in brk, "Break missing 'end_time' field"
            print(f"  - {brk['label']} ({brk['type']}): {brk['start_time']} - {brk['end_time']}")
    
    def test_student_schedule_returns_settings(self):
        """Test that response contains settings object"""
        token = self.get_student_token()
        response = self.session.get(
            f"{BASE_URL}/api/student/schedule",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = response.json()
        assert "settings" in data, "Response missing 'settings' field"
        settings = data["settings"]
        
        # Verify settings structure
        assert "start_hour" in settings, "Settings missing 'start_hour'"
        assert "end_hour" in settings, "Settings missing 'end_hour'"
        assert "time_format" in settings, "Settings missing 'time_format'"
        print(f"✓ Settings returned: {settings.get('start_hour')} - {settings.get('end_hour')}, format: {settings.get('time_format')}")
    
    def test_student_schedule_returns_grade_name(self):
        """Test that response contains grade_name"""
        token = self.get_student_token()
        response = self.session.get(
            f"{BASE_URL}/api/student/schedule",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = response.json()
        assert "grade_name" in data, "Response missing 'grade_name' field"
        print(f"✓ Grade name returned: {data['grade_name']}")
    
    def test_student_schedule_returns_section_name(self):
        """Test that response contains section_name"""
        token = self.get_student_token()
        response = self.session.get(
            f"{BASE_URL}/api/student/schedule",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = response.json()
        assert "section_name" in data, "Response missing 'section_name' field"
        print(f"✓ Section name returned: {data['section_name']}")
    
    def test_schedule_contains_teacher_info(self):
        """Test that schedules contain teacher name and photo"""
        token = self.get_student_token()
        response = self.session.get(
            f"{BASE_URL}/api/student/schedule",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = response.json()
        
        if len(data["schedules"]) > 0:
            schedule = data["schedules"][0]
            assert "profesor_nombre" in schedule, "Schedule missing 'profesor_nombre'"
            assert "profesor_foto" in schedule, "Schedule missing 'profesor_foto'"
            print(f"✓ Teacher info present: {schedule.get('profesor_nombre')}")
        else:
            print("⚠ No schedules to verify teacher info")
    
    def test_admin_cannot_access_student_schedule(self):
        """Test that admin users cannot access student schedule endpoint"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/student/schedule",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, f"Expected 403 for admin, got {response.status_code}"
        data = response.json()
        assert "estudiantes" in data.get("detail", "").lower() or "student" in data.get("detail", "").lower(), \
            f"Expected student-only error message, got: {data.get('detail')}"
        print("✓ Admin correctly denied access to student schedule")
    
    def test_unauthenticated_cannot_access_student_schedule(self):
        """Test that unauthenticated users cannot access endpoint"""
        response = self.session.get(f"{BASE_URL}/api/student/schedule")
        assert response.status_code == 401, f"Expected 401 for unauthenticated, got {response.status_code}"
        print("✓ Unauthenticated request correctly denied")
    
    def test_schedule_structure_complete(self):
        """Test that schedule items have all required fields"""
        token = self.get_student_token()
        response = self.session.get(
            f"{BASE_URL}/api/student/schedule",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = response.json()
        
        required_fields = ["id", "materia", "dia", "hora_inicio", "hora_fin", "color"]
        
        for schedule in data["schedules"]:
            for field in required_fields:
                assert field in schedule, f"Schedule missing required field: {field}"
        
        print(f"✓ All {len(data['schedules'])} schedules have complete structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
