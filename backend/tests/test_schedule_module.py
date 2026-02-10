"""
Test suite for EduNet Schedule Module
Tests: Login, Settings API, Grades API, Users/Teachers API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"
SUBDOMAIN = "demosettings"


class TestLogin:
    """Test login functionality"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["role"] == "owner"
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.pe",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


class TestPublicSettings:
    """Test public settings endpoint"""
    
    def test_public_settings_returns_logo(self):
        """Test that public settings returns logo_url"""
        response = requests.get(f"{BASE_URL}/api/schools/public/{SUBDOMAIN}")
        assert response.status_code == 200, f"Public settings failed: {response.text}"
        
        data = response.json()
        assert "logo_url" in data, "logo_url not in response"
        assert data["logo_url"] is not None, "logo_url is None"
        assert "cloudinary" in data["logo_url"], "Logo URL should be from Cloudinary"
        assert data["subdomain"] == SUBDOMAIN
        assert data["school_name"] == "Colegio Demo Settings"
        print(f"✓ Public settings returns logo: {data['logo_url'][:60]}...")


class TestAuthenticatedSettings:
    """Test authenticated settings endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_settings_endpoint_returns_logo(self, auth_token):
        """Test /api/settings returns logo_url"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        
        assert response.status_code == 200, f"Settings failed: {response.text}"
        
        data = response.json()
        assert "logo_url" in data, "logo_url not in response"
        assert data["logo_url"] is not None, "logo_url is None"
        assert "cloudinary" in data["logo_url"], "Logo URL should be from Cloudinary"
        print(f"✓ Settings endpoint returns logo: {data['logo_url'][:60]}...")


class TestGradesAPI:
    """Test grades API for schedule module"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_grades_returns_14_grades(self, auth_token):
        """Test that grades API returns 14 grades (Inicial, Primaria, Secundaria)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
        
        assert response.status_code == 200, f"Grades API failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 14, f"Expected 14 grades, got {len(data)}"
        
        # Count grades by level
        inicial_count = sum(1 for g in data if g.get("nivel_nombre") == "Inicial")
        primaria_count = sum(1 for g in data if g.get("nivel_nombre") == "Primaria")
        secundaria_count = sum(1 for g in data if g.get("nivel_nombre") == "Secundaria")
        
        assert inicial_count == 3, f"Expected 3 Inicial grades, got {inicial_count}"
        assert primaria_count == 6, f"Expected 6 Primaria grades, got {primaria_count}"
        assert secundaria_count == 5, f"Expected 5 Secundaria grades, got {secundaria_count}"
        
        print(f"✓ Grades API returns 14 grades: {inicial_count} Inicial, {primaria_count} Primaria, {secundaria_count} Secundaria")
    
    def test_grades_have_required_fields(self, auth_token):
        """Test that each grade has required fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["id", "nombre", "nivel_id", "nivel_nombre", "activo"]
        for grade in data:
            for field in required_fields:
                assert field in grade, f"Grade missing field: {field}"
        
        print("✓ All grades have required fields")


class TestUsersTeachersAPI:
    """Test users API for teachers"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_users_returns_teachers(self, auth_token):
        """Test that users API returns teachers"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        assert response.status_code == 200, f"Users API failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Filter teachers
        teachers = [u for u in data if u.get("role") == "teacher"]
        assert len(teachers) == 5, f"Expected 5 teachers, got {len(teachers)}"
        
        # Verify teacher names
        teacher_names = [f"{t.get('name')} {t.get('last_name', '')}" for t in teachers]
        print(f"✓ Users API returns 5 teachers: {teacher_names}")
    
    def test_teachers_have_required_fields(self, auth_token):
        """Test that each teacher has required fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        teachers = [u for u in data if u.get("role") == "teacher"]
        required_fields = ["id", "name", "role"]
        
        for teacher in teachers:
            for field in required_fields:
                assert field in teacher, f"Teacher missing field: {field}"
        
        print("✓ All teachers have required fields")


class TestAcademicLevelsAPI:
    """Test academic levels API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_levels_returns_3_levels(self, auth_token):
        """Test that levels API returns 3 levels (Inicial, Primaria, Secundaria)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/academic/levels", headers=headers)
        
        assert response.status_code == 200, f"Levels API failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 3, f"Expected 3 levels, got {len(data)}"
        
        level_names = [l.get("nombre") for l in data]
        assert "Inicial" in level_names, "Inicial level not found"
        assert "Primaria" in level_names, "Primaria level not found"
        assert "Secundaria" in level_names, "Secundaria level not found"
        
        print(f"✓ Levels API returns 3 levels: {level_names}")


class TestSectionsAPI:
    """Test sections API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_sections_returns_data(self, auth_token):
        """Test that sections API returns sections"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
        
        assert response.status_code == 200, f"Sections API failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Expected at least 1 section"
        
        print(f"✓ Sections API returns {len(data)} sections")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
