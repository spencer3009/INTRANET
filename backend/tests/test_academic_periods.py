"""
Test suite for Academic Periods API (Phase 3)
Tests CRUD operations, validation rules, and business logic for academic periods.
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://accounting-upgrade.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"


class TestAcademicPeriodsAPI:
    """Test suite for Academic Periods endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Track created periods for cleanup
        self.created_period_ids = []
        
        yield
        
        # Cleanup: Delete test periods created during tests
        for period_id in self.created_period_ids:
            try:
                # First deactivate if active
                self.session.put(f"{BASE_URL}/api/academic/periods/{period_id}", json={"activo": False})
                self.session.delete(f"{BASE_URL}/api/academic/periods/{period_id}")
            except:
                pass
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/academic/periods - List all periods
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_periods_returns_list(self):
        """GET /api/academic/periods should return a list of periods"""
        response = self.session.get(f"{BASE_URL}/api/academic/periods")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/academic/periods returns list with {len(data)} periods")
    
    def test_get_periods_filter_by_active(self):
        """GET /api/academic/periods?activo=true should filter by active status"""
        response = self.session.get(f"{BASE_URL}/api/academic/periods?activo=true")
        assert response.status_code == 200
        data = response.json()
        # All returned periods should be active
        for period in data:
            assert period.get("activo") == True, "Filtered periods should all be active"
        print(f"✓ GET /api/academic/periods?activo=true returns {len(data)} active periods")
    
    def test_get_periods_requires_auth(self):
        """GET /api/academic/periods should require authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/academic/periods")
        assert response.status_code == 401, "Should require authentication"
        print("✓ GET /api/academic/periods requires authentication")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/academic/periods/active - Get active period
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_active_period(self):
        """GET /api/academic/periods/active should return active period or null"""
        response = self.session.get(f"{BASE_URL}/api/academic/periods/active")
        assert response.status_code == 200
        data = response.json()
        assert "active_period" in data, "Response should have active_period key"
        if data["active_period"]:
            assert data["active_period"]["activo"] == True, "Active period should have activo=True"
            print(f"✓ GET /api/academic/periods/active returns: {data['active_period']['nombre']}")
        else:
            print("✓ GET /api/academic/periods/active returns null (no active period)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/academic/periods - Create period
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_period_success(self):
        """POST /api/academic/periods should create a new period"""
        unique_name = f"TEST_Periodo_{uuid.uuid4().hex[:8]}"
        payload = {
            "nombre": unique_name,
            "fecha_inicio": "2030-01-01",
            "fecha_fin": "2030-03-31",
            "activo": False
        }
        response = self.session.post(f"{BASE_URL}/api/academic/periods", json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert "period" in data, "Response should have period key"
        period = data["period"]
        self.created_period_ids.append(period["id"])
        
        assert period["nombre"] == unique_name
        assert period["fecha_inicio"] == "2030-01-01"
        assert period["fecha_fin"] == "2030-03-31"
        assert period["activo"] == False
        assert "id" in period
        print(f"✓ POST /api/academic/periods creates period: {unique_name}")
    
    def test_create_period_validates_date_range(self):
        """POST /api/academic/periods should reject invalid date range (start >= end)"""
        payload = {
            "nombre": f"TEST_Invalid_{uuid.uuid4().hex[:8]}",
            "fecha_inicio": "2030-06-01",
            "fecha_fin": "2030-03-31",  # End before start
            "activo": False
        }
        response = self.session.post(f"{BASE_URL}/api/academic/periods", json=payload)
        assert response.status_code == 400, "Should reject invalid date range"
        data = response.json()
        assert "fecha" in data.get("detail", "").lower() or "anterior" in data.get("detail", "").lower()
        print("✓ POST /api/academic/periods validates date range (start < end)")
    
    def test_create_period_validates_duplicate_name(self):
        """POST /api/academic/periods should reject duplicate names"""
        unique_name = f"TEST_Duplicate_{uuid.uuid4().hex[:8]}"
        
        # Create first period
        payload1 = {
            "nombre": unique_name,
            "fecha_inicio": "2031-01-01",
            "fecha_fin": "2031-03-31",
            "activo": False
        }
        response1 = self.session.post(f"{BASE_URL}/api/academic/periods", json=payload1)
        assert response1.status_code == 200
        self.created_period_ids.append(response1.json()["period"]["id"])
        
        # Try to create second period with same name
        payload2 = {
            "nombre": unique_name,
            "fecha_inicio": "2031-04-01",
            "fecha_fin": "2031-06-30",
            "activo": False
        }
        response2 = self.session.post(f"{BASE_URL}/api/academic/periods", json=payload2)
        assert response2.status_code == 400, "Should reject duplicate name"
        print("✓ POST /api/academic/periods validates duplicate names")
    
    def test_create_period_validates_overlapping_dates(self):
        """POST /api/academic/periods should reject overlapping date ranges"""
        base_name = f"TEST_Overlap_{uuid.uuid4().hex[:8]}"
        
        # Create first period
        payload1 = {
            "nombre": f"{base_name}_1",
            "fecha_inicio": "2032-01-01",
            "fecha_fin": "2032-03-31",
            "activo": False
        }
        response1 = self.session.post(f"{BASE_URL}/api/academic/periods", json=payload1)
        assert response1.status_code == 200
        self.created_period_ids.append(response1.json()["period"]["id"])
        
        # Try to create overlapping period
        payload2 = {
            "nombre": f"{base_name}_2",
            "fecha_inicio": "2032-02-15",  # Overlaps with first period
            "fecha_fin": "2032-05-15",
            "activo": False
        }
        response2 = self.session.post(f"{BASE_URL}/api/academic/periods", json=payload2)
        assert response2.status_code == 400, "Should reject overlapping dates"
        assert "solapan" in response2.json().get("detail", "").lower()
        print("✓ POST /api/academic/periods validates overlapping dates")
    
    def test_create_period_with_activation_deactivates_previous(self):
        """POST /api/academic/periods with activo=true should deactivate previous active period"""
        base_name = f"TEST_Activate_{uuid.uuid4().hex[:8]}"
        
        # Create first period as active
        payload1 = {
            "nombre": f"{base_name}_First",
            "fecha_inicio": "2033-01-01",
            "fecha_fin": "2033-03-31",
            "activo": True
        }
        response1 = self.session.post(f"{BASE_URL}/api/academic/periods", json=payload1)
        assert response1.status_code == 200
        period1_id = response1.json()["period"]["id"]
        self.created_period_ids.append(period1_id)
        
        # Create second period as active (should deactivate first)
        payload2 = {
            "nombre": f"{base_name}_Second",
            "fecha_inicio": "2033-04-01",
            "fecha_fin": "2033-06-30",
            "activo": True
        }
        response2 = self.session.post(f"{BASE_URL}/api/academic/periods", json=payload2)
        assert response2.status_code == 200
        period2_id = response2.json()["period"]["id"]
        self.created_period_ids.append(period2_id)
        
        # Check that response indicates deactivation
        data2 = response2.json()
        assert "deactivated_period" in data2 or "desactivado" in data2.get("message", "").lower()
        
        # Verify first period is now inactive
        response_check = self.session.get(f"{BASE_URL}/api/academic/periods")
        periods = response_check.json()
        period1 = next((p for p in periods if p["id"] == period1_id), None)
        assert period1 is not None
        assert period1["activo"] == False, "First period should be deactivated"
        print("✓ POST /api/academic/periods with activo=true deactivates previous active period")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PUT /api/academic/periods/{id} - Update period
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_update_period_success(self):
        """PUT /api/academic/periods/{id} should update period"""
        # Create a period first
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/academic/periods", json={
            "nombre": unique_name,
            "fecha_inicio": "2034-01-01",
            "fecha_fin": "2034-03-31",
            "activo": False
        })
        assert create_response.status_code == 200
        period_id = create_response.json()["period"]["id"]
        self.created_period_ids.append(period_id)
        
        # Update the period
        new_name = f"{unique_name}_Updated"
        update_response = self.session.put(f"{BASE_URL}/api/academic/periods/{period_id}", json={
            "nombre": new_name,
            "fecha_fin": "2034-04-30"
        })
        assert update_response.status_code == 200
        updated_period = update_response.json()["period"]
        
        assert updated_period["nombre"] == new_name
        assert updated_period["fecha_fin"] == "2034-04-30"
        print("✓ PUT /api/academic/periods/{id} updates period successfully")
    
    def test_update_period_not_found(self):
        """PUT /api/academic/periods/{id} should return 404 for non-existent period"""
        fake_id = str(uuid.uuid4())
        response = self.session.put(f"{BASE_URL}/api/academic/periods/{fake_id}", json={
            "nombre": "Test"
        })
        assert response.status_code == 404
        print("✓ PUT /api/academic/periods/{id} returns 404 for non-existent period")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/academic/periods/{id}/activate - Activate period
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_activate_period_success(self):
        """POST /api/academic/periods/{id}/activate should activate period"""
        base_name = f"TEST_ActivateEndpoint_{uuid.uuid4().hex[:8]}"
        
        # Create inactive period
        create_response = self.session.post(f"{BASE_URL}/api/academic/periods", json={
            "nombre": base_name,
            "fecha_inicio": "2035-01-01",
            "fecha_fin": "2035-03-31",
            "activo": False
        })
        assert create_response.status_code == 200
        period_id = create_response.json()["period"]["id"]
        self.created_period_ids.append(period_id)
        
        # Activate the period
        activate_response = self.session.post(f"{BASE_URL}/api/academic/periods/{period_id}/activate")
        assert activate_response.status_code == 200
        data = activate_response.json()
        
        assert data["period"]["activo"] == True
        print("✓ POST /api/academic/periods/{id}/activate activates period")
    
    def test_activate_period_deactivates_previous(self):
        """POST /api/academic/periods/{id}/activate should deactivate previous active period"""
        base_name = f"TEST_ActivateDeact_{uuid.uuid4().hex[:8]}"
        
        # Create first period as active
        create1 = self.session.post(f"{BASE_URL}/api/academic/periods", json={
            "nombre": f"{base_name}_First",
            "fecha_inicio": "2036-01-01",
            "fecha_fin": "2036-03-31",
            "activo": True
        })
        assert create1.status_code == 200
        period1_id = create1.json()["period"]["id"]
        self.created_period_ids.append(period1_id)
        
        # Create second period as inactive
        create2 = self.session.post(f"{BASE_URL}/api/academic/periods", json={
            "nombre": f"{base_name}_Second",
            "fecha_inicio": "2036-04-01",
            "fecha_fin": "2036-06-30",
            "activo": False
        })
        assert create2.status_code == 200
        period2_id = create2.json()["period"]["id"]
        self.created_period_ids.append(period2_id)
        
        # Activate second period
        activate_response = self.session.post(f"{BASE_URL}/api/academic/periods/{period2_id}/activate")
        assert activate_response.status_code == 200
        data = activate_response.json()
        
        # Check deactivation message
        assert "deactivated_period" in data or "desactivado" in data.get("message", "").lower()
        
        # Verify first period is now inactive
        periods_response = self.session.get(f"{BASE_URL}/api/academic/periods")
        periods = periods_response.json()
        period1 = next((p for p in periods if p["id"] == period1_id), None)
        assert period1["activo"] == False
        print("✓ POST /api/academic/periods/{id}/activate deactivates previous active period")
    
    def test_activate_already_active_period(self):
        """POST /api/academic/periods/{id}/activate on already active period should return success"""
        base_name = f"TEST_AlreadyActive_{uuid.uuid4().hex[:8]}"
        
        # Create active period
        create_response = self.session.post(f"{BASE_URL}/api/academic/periods", json={
            "nombre": base_name,
            "fecha_inicio": "2037-01-01",
            "fecha_fin": "2037-03-31",
            "activo": True
        })
        assert create_response.status_code == 200
        period_id = create_response.json()["period"]["id"]
        self.created_period_ids.append(period_id)
        
        # Try to activate again
        activate_response = self.session.post(f"{BASE_URL}/api/academic/periods/{period_id}/activate")
        assert activate_response.status_code == 200
        assert "ya está activo" in activate_response.json().get("message", "").lower()
        print("✓ POST /api/academic/periods/{id}/activate handles already active period")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DELETE /api/academic/periods/{id} - Delete period
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_delete_inactive_period_success(self):
        """DELETE /api/academic/periods/{id} should delete inactive period"""
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        
        # Create inactive period
        create_response = self.session.post(f"{BASE_URL}/api/academic/periods", json={
            "nombre": unique_name,
            "fecha_inicio": "2038-01-01",
            "fecha_fin": "2038-03-31",
            "activo": False
        })
        assert create_response.status_code == 200
        period_id = create_response.json()["period"]["id"]
        
        # Delete the period
        delete_response = self.session.delete(f"{BASE_URL}/api/academic/periods/{period_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        periods_response = self.session.get(f"{BASE_URL}/api/academic/periods")
        periods = periods_response.json()
        assert not any(p["id"] == period_id for p in periods), "Period should be deleted"
        print("✓ DELETE /api/academic/periods/{id} deletes inactive period")
    
    def test_delete_active_period_fails(self):
        """DELETE /api/academic/periods/{id} should fail for active period"""
        unique_name = f"TEST_DeleteActive_{uuid.uuid4().hex[:8]}"
        
        # Create active period
        create_response = self.session.post(f"{BASE_URL}/api/academic/periods", json={
            "nombre": unique_name,
            "fecha_inicio": "2039-01-01",
            "fecha_fin": "2039-03-31",
            "activo": True
        })
        assert create_response.status_code == 200
        period_id = create_response.json()["period"]["id"]
        self.created_period_ids.append(period_id)
        
        # Try to delete active period
        delete_response = self.session.delete(f"{BASE_URL}/api/academic/periods/{period_id}")
        assert delete_response.status_code == 400, "Should not allow deleting active period"
        assert "activo" in delete_response.json().get("detail", "").lower()
        print("✓ DELETE /api/academic/periods/{id} prevents deleting active period")
    
    def test_delete_period_not_found(self):
        """DELETE /api/academic/periods/{id} should return 404 for non-existent period"""
        fake_id = str(uuid.uuid4())
        response = self.session.delete(f"{BASE_URL}/api/academic/periods/{fake_id}")
        assert response.status_code == 404
        print("✓ DELETE /api/academic/periods/{id} returns 404 for non-existent period")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
