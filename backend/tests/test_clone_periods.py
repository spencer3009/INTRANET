"""
Test suite for Academic Periods Clone functionality
Tests the POST /api/academic/periods/clone endpoint and related period CRUD operations
"""
import pytest
import requests
import os
import uuid
import random

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def cleanup_test_periods(headers, year_id):
    """Helper to clean up all periods in a year"""
    periods = requests.get(
        f"{BASE_URL}/api/academic/periods?academic_year_id={year_id}", 
        headers=headers
    ).json()
    for p in periods:
        requests.delete(f"{BASE_URL}/api/academic/periods/{p['id']}", headers=headers)


class TestClonePeriods:
    """Tests for cloning academic periods between years"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.pe",
            "password": "test123",
            "subdomain": "demosettings"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        
        # Get academic years
        years_response = requests.get(f"{BASE_URL}/api/academic/years", headers=self.headers)
        assert years_response.status_code == 200
        self.years = years_response.json()
        
        # Find years by their year number
        self.year_2026 = next((y for y in self.years if y["year"] == 2026), None)
        self.year_2025 = next((y for y in self.years if y["year"] == 2025), None)
        self.year_2099 = next((y for y in self.years if y["year"] == 2099), None)
    
    def test_get_academic_years(self):
        """Test GET /api/academic/years returns years with period_count"""
        response = requests.get(f"{BASE_URL}/api/academic/years", headers=self.headers)
        assert response.status_code == 200
        
        years = response.json()
        assert isinstance(years, list)
        assert len(years) >= 3  # At least 2025, 2026, 2099
        
        # Verify structure
        for year in years:
            assert "id" in year
            assert "year" in year
            assert "status" in year
            assert "period_count" in year
    
    def test_get_periods_for_year_2026(self):
        """Test GET /api/academic/periods?academic_year_id=... returns periods for 2026"""
        assert self.year_2026 is not None, "Year 2026 not found"
        
        response = requests.get(
            f"{BASE_URL}/api/academic/periods?academic_year_id={self.year_2026['id']}", 
            headers=self.headers
        )
        assert response.status_code == 200
        
        periods = response.json()
        assert isinstance(periods, list)
        assert len(periods) == 4, f"Expected 4 periods for 2026, got {len(periods)}"
        
        # Verify period structure
        for period in periods:
            assert "id" in period
            assert "nombre" in period
            assert "fecha_inicio" in period
            assert "fecha_fin" in period
            assert "orden" in period
            assert "activo" in period
            assert period["academic_year_id"] == self.year_2026["id"]
        
        # Verify period names
        period_names = [p["nombre"] for p in periods]
        assert "Bimestre I" in period_names
        assert "Bimestre II" in period_names
        assert "Bimestre III" in period_names
        assert "Bimestre IV" in period_names
    
    def test_clone_periods_to_empty_year(self):
        """Test POST /api/academic/periods/clone clones periods to year without periods"""
        assert self.year_2026 is not None, "Year 2026 not found"
        assert self.year_2099 is not None, "Year 2099 not found"
        
        # First clean up any existing periods in 2099
        cleanup_test_periods(self.headers, self.year_2099['id'])
        
        # Clone from 2026 to 2099
        response = requests.post(
            f"{BASE_URL}/api/academic/periods/clone",
            headers=self.headers,
            json={
                "source_year_id": self.year_2026["id"],
                "target_year_id": self.year_2099["id"]
            }
        )
        assert response.status_code == 200, f"Clone failed: {response.text}"
        
        result = response.json()
        assert "message" in result
        assert "cloned_periods" in result
        assert len(result["cloned_periods"]) == 4
        
        # Verify dates were adjusted (+73 years from 2026 to 2099)
        for cloned in result["cloned_periods"]:
            assert cloned["activo"] == False  # New periods start inactive
            assert "2099" in cloned["fecha_inicio"]  # Dates adjusted to 2099
            assert "2099" in cloned["fecha_fin"]
        
        # Verify periods exist in target year
        periods_after = requests.get(
            f"{BASE_URL}/api/academic/periods?academic_year_id={self.year_2099['id']}", 
            headers=self.headers
        ).json()
        assert len(periods_after) == 4
        
        # Cleanup: Delete cloned periods
        cleanup_test_periods(self.headers, self.year_2099['id'])
    
    def test_clone_periods_to_year_with_existing_periods_fails(self):
        """Test POST /api/academic/periods/clone fails when target has periods"""
        assert self.year_2026 is not None, "Year 2026 not found"
        
        # Try to clone to 2026 which already has periods
        response = requests.post(
            f"{BASE_URL}/api/academic/periods/clone",
            headers=self.headers,
            json={
                "source_year_id": self.year_2026["id"],
                "target_year_id": self.year_2026["id"]  # Same year - should fail
            }
        )
        assert response.status_code == 400
        assert "ya tiene" in response.json()["detail"]
    
    def test_clone_from_year_without_periods_fails(self):
        """Test POST /api/academic/periods/clone fails when source has no periods"""
        assert self.year_2025 is not None, "Year 2025 not found"
        assert self.year_2099 is not None, "Year 2099 not found"
        
        # First ensure 2025 has no periods
        cleanup_test_periods(self.headers, self.year_2025['id'])
        
        # Ensure 2099 has no periods
        cleanup_test_periods(self.headers, self.year_2099['id'])
        
        # Try to clone from 2025 (no periods) to 2099
        response = requests.post(
            f"{BASE_URL}/api/academic/periods/clone",
            headers=self.headers,
            json={
                "source_year_id": self.year_2025["id"],
                "target_year_id": self.year_2099["id"]
            }
        )
        assert response.status_code == 400
        assert "no tiene períodos" in response.json()["detail"]
    
    def test_clone_with_invalid_source_year_fails(self):
        """Test POST /api/academic/periods/clone fails with invalid source year"""
        assert self.year_2099 is not None, "Year 2099 not found"
        
        response = requests.post(
            f"{BASE_URL}/api/academic/periods/clone",
            headers=self.headers,
            json={
                "source_year_id": "invalid-uuid-12345",
                "target_year_id": self.year_2099["id"]
            }
        )
        assert response.status_code == 404
        assert "origen no encontrado" in response.json()["detail"]
    
    def test_clone_with_invalid_target_year_fails(self):
        """Test POST /api/academic/periods/clone fails with invalid target year"""
        assert self.year_2026 is not None, "Year 2026 not found"
        
        response = requests.post(
            f"{BASE_URL}/api/academic/periods/clone",
            headers=self.headers,
            json={
                "source_year_id": self.year_2026["id"],
                "target_year_id": "invalid-uuid-12345"
            }
        )
        assert response.status_code == 404
        assert "destino no encontrado" in response.json()["detail"]


class TestPeriodsCRUD:
    """Tests for period CRUD operations - uses year 2025 to avoid conflicts"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.pe",
            "password": "test123",
            "subdomain": "demosettings"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        
        # Get year 2025 for testing (should be empty)
        years_response = requests.get(f"{BASE_URL}/api/academic/years", headers=self.headers)
        self.years = years_response.json()
        self.year_2025 = next((y for y in self.years if y["year"] == 2025), None)
        
        # Clean up any existing periods in 2025
        if self.year_2025:
            cleanup_test_periods(self.headers, self.year_2025['id'])
    
    def test_create_period(self):
        """Test POST /api/academic/periods creates a new period"""
        assert self.year_2025 is not None, "Year 2025 not found"
        
        # Use unique name
        unique_name = f"TEST_Period_{uuid.uuid4().hex[:8]}"
        
        # Create new period
        response = requests.post(
            f"{BASE_URL}/api/academic/periods",
            headers=self.headers,
            json={
                "academic_year_id": self.year_2025["id"],
                "nombre": unique_name,
                "fecha_inicio": "2025-06-01",
                "fecha_fin": "2025-06-30",
                "orden": 1,
                "activo": False
            }
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        result = response.json()
        # API returns {"message": ..., "period": {...}}
        assert "period" in result, f"Expected 'period' in response: {result}"
        period = result["period"]
        
        assert period["nombre"] == unique_name
        assert period["orden"] == 1 or period["orden"] == 2  # orden may be auto-incremented
        assert period["activo"] == False
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/academic/periods/{period['id']}", headers=self.headers)
    
    def test_update_period(self):
        """Test PUT /api/academic/periods/{id} updates a period"""
        assert self.year_2025 is not None, "Year 2025 not found"
        
        # Use unique name
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        
        # Create a period first
        create_response = requests.post(
            f"{BASE_URL}/api/academic/periods",
            headers=self.headers,
            json={
                "academic_year_id": self.year_2025["id"],
                "nombre": unique_name,
                "fecha_inicio": "2025-01-01",
                "fecha_fin": "2025-01-31",
                "orden": 1,
                "activo": False
            }
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        period_id = create_response.json()["period"]["id"]
        
        # Update the period
        updated_name = f"TEST_Updated_{uuid.uuid4().hex[:8]}"
        update_response = requests.put(
            f"{BASE_URL}/api/academic/periods/{period_id}",
            headers=self.headers,
            json={
                "nombre": updated_name,
                "fecha_inicio": "2025-02-01",
                "fecha_fin": "2025-02-28",
                "orden": 2,
                "activo": False
            }
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        result = update_response.json()
        # API returns {"message": ..., "period": {...}}
        assert "period" in result, f"Expected 'period' in response: {result}"
        updated = result["period"]
        assert updated["nombre"] == updated_name
        assert updated["fecha_inicio"] == "2025-02-01"
        assert updated["fecha_fin"] == "2025-02-28"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/academic/periods/{period_id}", headers=self.headers)
    
    def test_toggle_period_active(self):
        """Test PUT /api/academic/periods/{id} can toggle active status"""
        assert self.year_2025 is not None, "Year 2025 not found"
        
        # Use unique name
        unique_name = f"TEST_Toggle_{uuid.uuid4().hex[:8]}"
        
        # Create a period
        create_response = requests.post(
            f"{BASE_URL}/api/academic/periods",
            headers=self.headers,
            json={
                "academic_year_id": self.year_2025["id"],
                "nombre": unique_name,
                "fecha_inicio": "2025-03-01",
                "fecha_fin": "2025-03-31",
                "orden": 1,
                "activo": False
            }
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        period = create_response.json()["period"]
        assert period["activo"] == False
        
        # Toggle to active
        toggle_response = requests.put(
            f"{BASE_URL}/api/academic/periods/{period['id']}",
            headers=self.headers,
            json={
                "nombre": period["nombre"],
                "activo": True
            }
        )
        assert toggle_response.status_code == 200
        result1 = toggle_response.json()
        assert "period" in result1, f"Expected 'period' in response: {result1}"
        assert result1["period"]["activo"] == True
        
        # Toggle back to inactive
        toggle_response2 = requests.put(
            f"{BASE_URL}/api/academic/periods/{period['id']}",
            headers=self.headers,
            json={
                "nombre": period["nombre"],
                "activo": False
            }
        )
        assert toggle_response2.status_code == 200
        result2 = toggle_response2.json()
        assert "period" in result2, f"Expected 'period' in response: {result2}"
        assert result2["period"]["activo"] == False
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/academic/periods/{period['id']}", headers=self.headers)
    
    def test_delete_period(self):
        """Test DELETE /api/academic/periods/{id} deletes a period"""
        assert self.year_2025 is not None, "Year 2025 not found"
        
        # Use unique name
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        
        # Create a period
        create_response = requests.post(
            f"{BASE_URL}/api/academic/periods",
            headers=self.headers,
            json={
                "academic_year_id": self.year_2025["id"],
                "nombre": unique_name,
                "fecha_inicio": "2025-04-01",
                "fecha_fin": "2025-04-30",
                "orden": 1,
                "activo": False
            }
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        period_id = create_response.json()["period"]["id"]
        
        # Delete the period
        delete_response = requests.delete(
            f"{BASE_URL}/api/academic/periods/{period_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200
        
        # Verify it's deleted
        get_response = requests.get(
            f"{BASE_URL}/api/academic/periods?academic_year_id={self.year_2025['id']}", 
            headers=self.headers
        )
        periods = get_response.json()
        period_ids = [p["id"] for p in periods]
        assert period_id not in period_ids


class TestCreateYearWithClone:
    """Tests for creating academic year with period cloning option"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.pe",
            "password": "test123",
            "subdomain": "demosettings"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        
        # Clean up test year 2098 if exists
        years_response = requests.get(f"{BASE_URL}/api/academic/years", headers=self.headers)
        years = years_response.json()
        year_2098 = next((y for y in years if y["year"] == 2098), None)
        if year_2098:
            requests.delete(f"{BASE_URL}/api/academic/years/{year_2098['id']}", headers=self.headers)
    
    def test_create_year_without_clone(self):
        """Test POST /api/academic/years creates year without cloning"""
        # Create a new year
        response = requests.post(
            f"{BASE_URL}/api/academic/years",
            headers=self.headers,
            json={
                "year": 2098,
                "status": "futuro"
            }
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        result = response.json()
        # API returns {"message": ..., "academic_year": {...}}
        assert "academic_year" in result, f"Expected 'academic_year' in response: {result}"
        year = result["academic_year"]
        
        assert year["year"] == 2098
        assert year["status"] == "futuro"
        
        # Verify no periods were created
        periods = requests.get(
            f"{BASE_URL}/api/academic/periods?academic_year_id={year['id']}", 
            headers=self.headers
        ).json()
        assert len(periods) == 0
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/academic/years/{year['id']}", headers=self.headers)
    
    def test_years_with_periods_available_for_cloning(self):
        """Test that years with periods are available for cloning"""
        response = requests.get(f"{BASE_URL}/api/academic/years", headers=self.headers)
        assert response.status_code == 200
        
        years = response.json()
        years_with_periods = [y for y in years if y.get("period_count", 0) > 0]
        
        # At least 2026 should have periods
        assert len(years_with_periods) >= 1
        year_2026 = next((y for y in years_with_periods if y["year"] == 2026), None)
        assert year_2026 is not None
        assert year_2026["period_count"] == 4
