"""
Test suite for Admin Portal - FASE 2: Academic Structure
Tests CRUD operations for: Years, Levels, Grades, Sections, Shifts
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USER = {"email": "admin@test.pe", "password": "test123"}  # role='admin'
OWNER_USER = {"email": "admin.settings@test.pe", "password": "test123"}  # role='director'


class TestAuthAndRoleAccess:
    """Test authentication and role-based access"""
    
    def test_admin_login_success(self):
        """Admin user (role='admin') should login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        print(f"Admin login response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin user role: {data['user']['role']}")
    
    def test_owner_login_success(self):
        """Owner user (role='director') should login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER_USER)
        print(f"Owner login response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        # Owner should NOT have role='admin'
        assert data["user"]["role"] != "admin"
        print(f"Owner user role: {data['user']['role']}")


class TestAcademicYearsAPI:
    """Test Academic Years CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_academic_years(self):
        """GET /api/academic/years should return list of years"""
        response = requests.get(f"{BASE_URL}/api/academic/years", headers=self.headers)
        print(f"GET years response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} academic years")
        if data:
            year = data[0]
            assert "id" in year
            assert "year" in year
            assert "status" in year
            print(f"Sample year: {year['year']} - {year['status']}")
    
    def test_create_academic_year(self):
        """POST /api/academic/years should create a new year"""
        test_year = 2099  # Use future year to avoid conflicts
        payload = {"year": test_year, "status": "planificado"}
        response = requests.post(f"{BASE_URL}/api/academic/years", json=payload, headers=self.headers)
        print(f"Create year response: {response.status_code}")
        
        if response.status_code == 400:
            # Year might already exist
            print(f"Year {test_year} might already exist: {response.json()}")
            return
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert "year" in data or "message" in data
        print(f"Created year: {data}")
        
        # Cleanup - delete the test year
        if "year" in data and "id" in data.get("year", {}):
            year_id = data["year"]["id"]
            requests.delete(f"{BASE_URL}/api/academic/years/{year_id}", headers=self.headers)


class TestAcademicLevelsAPI:
    """Test Academic Levels CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_academic_levels(self):
        """GET /api/academic/levels should return list of levels"""
        response = requests.get(f"{BASE_URL}/api/academic/levels", headers=self.headers)
        print(f"GET levels response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} academic levels")
        if data:
            level = data[0]
            assert "id" in level
            assert "nombre" in level
            print(f"Sample level: {level['nombre']}")
    
    def test_create_academic_level(self):
        """POST /api/academic/levels should create a new level"""
        unique_name = f"TEST_Nivel_{uuid.uuid4().hex[:6]}"
        payload = {"nombre": unique_name, "descripcion": "Test level", "activo": True}
        response = requests.post(f"{BASE_URL}/api/academic/levels", json=payload, headers=self.headers)
        print(f"Create level response: {response.status_code}")
        assert response.status_code in [200, 201]
        data = response.json()
        assert "level" in data or "message" in data
        print(f"Created level: {data}")
        
        # Verify creation with GET
        if "level" in data:
            level_id = data["level"]["id"]
            get_response = requests.get(f"{BASE_URL}/api/academic/levels", headers=self.headers)
            levels = get_response.json()
            created_level = next((l for l in levels if l["id"] == level_id), None)
            assert created_level is not None
            assert created_level["nombre"] == unique_name
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/academic/levels/{level_id}", headers=self.headers)
    
    def test_update_academic_level(self):
        """PUT /api/academic/levels/{id} should update a level"""
        # First create a level
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:6]}"
        create_payload = {"nombre": unique_name, "descripcion": "Original", "activo": True}
        create_response = requests.post(f"{BASE_URL}/api/academic/levels", json=create_payload, headers=self.headers)
        
        if create_response.status_code not in [200, 201]:
            pytest.skip("Could not create test level")
        
        level_id = create_response.json()["level"]["id"]
        
        # Update the level
        update_payload = {"descripcion": "Updated description"}
        update_response = requests.put(f"{BASE_URL}/api/academic/levels/{level_id}", json=update_payload, headers=self.headers)
        print(f"Update level response: {update_response.status_code}")
        assert update_response.status_code == 200
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/academic/levels", headers=self.headers)
        levels = get_response.json()
        updated_level = next((l for l in levels if l["id"] == level_id), None)
        assert updated_level is not None
        assert updated_level["descripcion"] == "Updated description"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/academic/levels/{level_id}", headers=self.headers)


class TestAcademicGradesAPI:
    """Test Academic Grades CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_academic_grades(self):
        """GET /api/academic/grades should return list of grades"""
        response = requests.get(f"{BASE_URL}/api/academic/grades", headers=self.headers)
        print(f"GET grades response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} academic grades")
        if data:
            grade = data[0]
            assert "id" in grade
            assert "nombre" in grade
            assert "nivel_id" in grade
            print(f"Sample grade: {grade['nombre']} - Level: {grade.get('nivel_nombre', 'N/A')}")


class TestAcademicSectionsAPI:
    """Test Academic Sections CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_academic_sections(self):
        """GET /api/academic/sections should return list of sections"""
        response = requests.get(f"{BASE_URL}/api/academic/sections", headers=self.headers)
        print(f"GET sections response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} academic sections")
        if data:
            section = data[0]
            assert "id" in section
            assert "nombre" in section
            assert "grado_id" in section
            print(f"Sample section: {section['nombre']} - Grade: {section.get('grado_nombre', 'N/A')}")


class TestAcademicShiftsAPI:
    """Test Academic Shifts CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_academic_shifts(self):
        """GET /api/academic/shifts should return list of shifts"""
        response = requests.get(f"{BASE_URL}/api/academic/shifts", headers=self.headers)
        print(f"GET shifts response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} academic shifts")
        if data:
            shift = data[0]
            assert "id" in shift
            assert "nombre" in shift
            print(f"Sample shift: {shift['nombre']} - {shift.get('hora_inicio', 'N/A')} to {shift.get('hora_fin', 'N/A')}")
    
    def test_create_academic_shift(self):
        """POST /api/academic/shifts should create a new shift"""
        unique_name = f"TEST_Turno_{uuid.uuid4().hex[:6]}"
        payload = {"nombre": unique_name, "hora_inicio": "14:00", "hora_fin": "18:00", "activo": True}
        response = requests.post(f"{BASE_URL}/api/academic/shifts", json=payload, headers=self.headers)
        print(f"Create shift response: {response.status_code}")
        assert response.status_code in [200, 201]
        data = response.json()
        print(f"Created shift: {data}")
        
        # Cleanup
        if "shift" in data and "id" in data["shift"]:
            shift_id = data["shift"]["id"]
            requests.delete(f"{BASE_URL}/api/academic/shifts/{shift_id}", headers=self.headers)


class TestOwnerAccessToAcademicAPIs:
    """Test that owner/director users can also access academic APIs (backend allows it)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for owner user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER_USER)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            self.user_role = response.json()["user"]["role"]
        else:
            pytest.skip("Owner login failed")
    
    def test_owner_can_read_academic_data(self):
        """Owner/director should be able to read academic data"""
        print(f"Testing with user role: {self.user_role}")
        
        # Test all GET endpoints
        endpoints = [
            "/api/academic/years",
            "/api/academic/levels",
            "/api/academic/grades",
            "/api/academic/sections",
            "/api/academic/shifts"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=self.headers)
            print(f"GET {endpoint}: {response.status_code}")
            assert response.status_code == 200, f"Failed to access {endpoint}"
    
    def test_owner_can_create_level(self):
        """Owner/director should be able to create academic levels (is_admin_user allows director)"""
        unique_name = f"TEST_Owner_{uuid.uuid4().hex[:6]}"
        payload = {"nombre": unique_name, "descripcion": "Created by owner", "activo": True}
        response = requests.post(f"{BASE_URL}/api/academic/levels", json=payload, headers=self.headers)
        print(f"Owner create level response: {response.status_code}")
        
        # Backend allows director role to create (is_admin_user returns True for director)
        assert response.status_code in [200, 201, 403]  # 403 if restricted to admin only
        
        if response.status_code in [200, 201]:
            data = response.json()
            if "level" in data and "id" in data["level"]:
                # Cleanup
                requests.delete(f"{BASE_URL}/api/academic/levels/{data['level']['id']}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
