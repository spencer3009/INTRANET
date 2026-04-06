"""
PAE Module Settings Adjustments Tests
Tests for:
1. PAE Turnos CRUD in Settings page (admin/owner)
2. DELETE /api/pae/turnos/{id} - returns 400 if turno has registros
3. GET /api/school/info - public school info endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
AUXILIAR_EMAIL = "carlos.comedor@elroble.edu"
AUXILIAR_PASSWORD = "Comedor123!"


class TestPaeSettingsAdjustments:
    """Tests for PAE module settings adjustments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_admin_token(self):
        """Get admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": "elroble"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin authentication failed: {response.status_code}")
        
    def get_auxiliar_token(self):
        """Get auxiliar authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUXILIAR_EMAIL,
            "password": AUXILIAR_PASSWORD,
            "subdomain": "elroble"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Auxiliar authentication failed: {response.status_code}")

    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/school/info - Public school info
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_school_info_admin(self):
        """Test GET /api/school/info returns logo and school name for admin"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/school/info",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "logo_url" in data, "Response should contain logo_url"
        assert "school_name" in data, "Response should contain school_name"
        print(f"✓ School info for admin: logo_url={data.get('logo_url')}, school_name={data.get('school_name')}")
        
    def test_school_info_auxiliar(self):
        """Test GET /api/school/info returns logo and school name for auxiliar"""
        token = self.get_auxiliar_token()
        response = self.session.get(
            f"{BASE_URL}/api/school/info",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "logo_url" in data, "Response should contain logo_url"
        assert "school_name" in data, "Response should contain school_name"
        print(f"✓ School info for auxiliar: logo_url={data.get('logo_url')}, school_name={data.get('school_name')}")

    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/pae/turnos - List turnos (admin only)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_list_turnos_admin(self):
        """Test GET /api/pae/turnos returns all turnos for admin"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        turnos = response.json()
        assert isinstance(turnos, list), "Response should be a list"
        print(f"✓ Listed {len(turnos)} turnos for admin")
        for t in turnos:
            print(f"  - {t.get('nombre')} ({t.get('hora_inicio')}-{t.get('hora_fin')}) activo={t.get('activo')}")
        return turnos
        
    def test_list_turnos_auxiliar_forbidden(self):
        """Test GET /api/pae/turnos returns 403 for auxiliar (admin-only endpoint)"""
        token = self.get_auxiliar_token()
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, f"Expected 403 for auxiliar, got {response.status_code}"
        print("✓ Auxiliar correctly denied access to /api/pae/turnos")

    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/pae/turnos - Create turno
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_turno(self):
        """Test POST /api/pae/turnos creates a new turno"""
        token = self.get_admin_token()
        
        # Create a test turno with unique time to avoid overlap
        payload = {
            "nombre": "TEST_Cena_Escolar",
            "hora_inicio": "18:00",
            "hora_fin": "19:00",
            "orden": 99
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pae/turnos",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("nombre") == "TEST_Cena_Escolar"
        assert data.get("hora_inicio") == "18:00"
        assert data.get("hora_fin") == "19:00"
        assert data.get("activo") == True
        assert "id" in data
        print(f"✓ Created turno: {data.get('nombre')} with id={data.get('id')}")
        return data.get("id")
        
    def test_create_turno_invalid_time_format(self):
        """Test POST /api/pae/turnos rejects invalid time format"""
        token = self.get_admin_token()
        
        payload = {
            "nombre": "Invalid Turno",
            "hora_inicio": "25:00",  # Invalid hour
            "hora_fin": "26:00",
            "orden": 1
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pae/turnos",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid time format correctly rejected")

    # ═══════════════════════════════════════════════════════════════════════════
    # PUT /api/pae/turnos/{id} - Update turno
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_update_turno(self):
        """Test PUT /api/pae/turnos/{id} updates a turno"""
        token = self.get_admin_token()
        
        # First get existing turnos
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        turnos = response.json()
        test_turno = next((t for t in turnos if t.get("nombre", "").startswith("TEST_")), None)
        
        if not test_turno:
            pytest.skip("No test turno found to update")
            
        turno_id = test_turno.get("id")
        original_name = test_turno.get("nombre")
        
        # Update only the name (keep same times to avoid overlap issues)
        payload = {
            "nombre": f"{original_name}_Updated"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/pae/turnos/{turno_id}",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "_Updated" in data.get("nombre", "")
        print(f"✓ Updated turno to: {data.get('nombre')}")

    # ═══════════════════════════════════════════════════════════════════════════
    # PATCH /api/pae/turnos/{id}/toggle - Toggle turno active/inactive
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_toggle_turno(self):
        """Test PATCH /api/pae/turnos/{id}/toggle toggles active state"""
        token = self.get_admin_token()
        
        # Get existing turnos
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        turnos = response.json()
        test_turno = next((t for t in turnos if t.get("nombre", "").startswith("TEST_")), None)
        
        if not test_turno:
            pytest.skip("No test turno found to toggle")
            
        turno_id = test_turno.get("id")
        original_state = test_turno.get("activo")
        
        # Toggle
        response = self.session.patch(
            f"{BASE_URL}/api/pae/turnos/{turno_id}/toggle",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("activo") != original_state, "Active state should have toggled"
        print(f"✓ Toggled turno from activo={original_state} to activo={data.get('activo')}")
        
        # Toggle back
        response = self.session.patch(
            f"{BASE_URL}/api/pae/turnos/{turno_id}/toggle",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

    # ═══════════════════════════════════════════════════════════════════════════
    # DELETE /api/pae/turnos/{id} - Delete turno
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_delete_turno_with_registros_fails(self):
        """Test DELETE /api/pae/turnos/{id} returns 400 if turno has registros"""
        token = self.get_admin_token()
        
        # Get turnos and find "Desayuno Escolar" which has registros
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        turnos = response.json()
        desayuno = next((t for t in turnos if "Desayuno" in t.get("nombre", "")), None)
        
        if not desayuno:
            pytest.skip("Desayuno Escolar turno not found")
            
        turno_id = desayuno.get("id")
        
        # Try to delete - should fail with 400
        response = self.session.delete(
            f"{BASE_URL}/api/pae/turnos/{turno_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 (has registros), got {response.status_code}: {response.text}"
        data = response.json()
        assert "registros" in data.get("detail", "").lower() or "no se puede eliminar" in data.get("detail", "").lower()
        print(f"✓ Delete correctly blocked for turno with registros: {data.get('detail')}")
        
    def test_delete_turno_without_registros_succeeds(self):
        """Test DELETE /api/pae/turnos/{id} succeeds for turno without registros"""
        token = self.get_admin_token()
        
        # First create a test turno
        payload = {
            "nombre": "TEST_ToDelete",
            "hora_inicio": "20:00",
            "hora_fin": "21:00",
            "orden": 100
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/pae/turnos",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if create_response.status_code != 201:
            pytest.skip(f"Could not create test turno: {create_response.text}")
            
        turno_id = create_response.json().get("id")
        
        # Delete it
        response = self.session.delete(
            f"{BASE_URL}/api/pae/turnos/{turno_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Successfully deleted turno without registros")
        
        # Verify it's gone
        get_response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        turnos = get_response.json()
        assert not any(t.get("id") == turno_id for t in turnos), "Deleted turno should not appear in list"
        print("✓ Verified turno no longer in list")

    # ═══════════════════════════════════════════════════════════════════════════
    # PAE Dashboard for auxiliar
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_pae_dashboard_auxiliar(self):
        """Test GET /api/pae/registro/dashboard works for auxiliar"""
        token = self.get_auxiliar_token()
        response = self.session.get(
            f"{BASE_URL}/api/pae/registro/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "conteo_por_turno" in data
        assert "ultimos_registros" in data
        print(f"✓ Auxiliar can access PAE dashboard: {len(data.get('conteo_por_turno', []))} turnos")


# Cleanup test data
class TestCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_test_turnos(self):
        """Remove any TEST_ prefixed turnos"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": "elroble"
        })
        if response.status_code != 200:
            pytest.skip("Could not login for cleanup")
            
        token = response.json().get("token")
        
        # Get all turnos
        response = session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code != 200:
            return
            
        turnos = response.json()
        test_turnos = [t for t in turnos if t.get("nombre", "").startswith("TEST_")]
        
        for t in test_turnos:
            try:
                session.delete(
                    f"{BASE_URL}/api/pae/turnos/{t.get('id')}",
                    headers={"Authorization": f"Bearer {token}"}
                )
                print(f"  Cleaned up: {t.get('nombre')}")
            except:
                pass
                
        print(f"✓ Cleanup complete: removed {len(test_turnos)} test turnos")
