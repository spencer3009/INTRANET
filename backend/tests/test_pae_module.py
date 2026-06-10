"""
PAE (Programa de Alimentación Escolar) Module Tests
Tests for turno CRUD endpoints and role-based access control.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://grades-passthrough.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
AUXILIAR_EMAIL = "carlos.comedor@elroble.edu"
AUXILIAR_PASSWORD = "Comedor123!"
SUBDOMAIN = "elroble"


class TestPAEModule:
    """PAE Module - Turno CRUD and Role-Based Access Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        self.auxiliar_token = None
        self.created_turno_id = None
    
    def get_admin_token(self):
        """Get admin/owner token for testing"""
        if self.admin_token:
            return self.admin_token
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        
        if response.status_code == 200:
            data = response.json()
            self.admin_token = data.get("token")
            return self.admin_token
        return None
    
    def get_auxiliar_token(self):
        """Get auxiliar_alimentacion token for testing"""
        if self.auxiliar_token:
            return self.auxiliar_token
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUXILIAR_EMAIL,
            "password": AUXILIAR_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        
        if response.status_code == 200:
            data = response.json()
            self.auxiliar_token = data.get("token")
            return self.auxiliar_token
        return None
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ADMIN LOGIN AND ROLE VERIFICATION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_admin_login(self):
        """Test admin/owner can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] in ["owner", "admin", "director", "coordinator"], f"Unexpected role: {data['user']['role']}"
        print(f"SUCCESS: Admin login - role: {data['user']['role']}")
    
    def test_02_auxiliar_alimentacion_login(self):
        """Test auxiliar_alimentacion user can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUXILIAR_EMAIL,
            "password": AUXILIAR_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        
        assert response.status_code == 200, f"Auxiliar login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "auxiliar_alimentacion", f"Expected auxiliar_alimentacion role, got: {data['user']['role']}"
        print(f"SUCCESS: Auxiliar alimentacion login - role: {data['user']['role']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET TURNOS - ADMIN ACCESS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_03_get_turnos_as_admin(self):
        """Test GET /api/pae/turnos - Admin can list turnos"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"GET turnos failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check if existing turnos are present (Desayuno Escolar and Almuerzo)
        turno_names = [t.get("nombre") for t in data]
        print(f"SUCCESS: GET turnos - found {len(data)} turnos: {turno_names}")
        
        # Verify turno structure
        if len(data) > 0:
            turno = data[0]
            assert "id" in turno, "Turno should have id"
            assert "nombre" in turno, "Turno should have nombre"
            assert "hora_inicio" in turno, "Turno should have hora_inicio"
            assert "hora_fin" in turno, "Turno should have hora_fin"
            assert "activo" in turno, "Turno should have activo"
            print(f"SUCCESS: Turno structure verified - {turno['nombre']} ({turno['hora_inicio']} - {turno['hora_fin']})")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET TURNOS - AUXILIAR ACCESS DENIED
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_04_get_turnos_as_auxiliar_denied(self):
        """Test GET /api/pae/turnos - Auxiliar alimentacion should get 403"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("SUCCESS: Auxiliar alimentacion correctly denied access to GET turnos (403)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CREATE TURNO - ADMIN ACCESS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_05_create_turno_as_admin(self):
        """Test POST /api/pae/turnos - Admin can create turno"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # Create a new turno with non-overlapping time
        turno_data = {
            "nombre": "TEST_Merienda",
            "hora_inicio": "15:00",
            "hora_fin": "16:00",
            "orden": 3
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"},
            json=turno_data
        )
        
        assert response.status_code == 201, f"Create turno failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Created turno should have id"
        assert data["nombre"] == turno_data["nombre"], "Nombre mismatch"
        assert data["hora_inicio"] == turno_data["hora_inicio"], "hora_inicio mismatch"
        assert data["hora_fin"] == turno_data["hora_fin"], "hora_fin mismatch"
        assert data["activo"] == True, "New turno should be active"
        
        self.__class__.created_turno_id = data["id"]
        print(f"SUCCESS: Created turno - id: {data['id']}, nombre: {data['nombre']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CREATE TURNO - AUXILIAR ACCESS DENIED
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_06_create_turno_as_auxiliar_denied(self):
        """Test POST /api/pae/turnos - Auxiliar alimentacion should get 403"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        turno_data = {
            "nombre": "TEST_Unauthorized",
            "hora_inicio": "17:00",
            "hora_fin": "18:00",
            "orden": 4
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"},
            json=turno_data
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("SUCCESS: Auxiliar alimentacion correctly denied access to POST turnos (403)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # VALIDATION - HORA_FIN > HORA_INICIO
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_07_create_turno_invalid_time_range(self):
        """Test POST /api/pae/turnos - hora_fin must be > hora_inicio"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # Invalid: hora_fin <= hora_inicio
        turno_data = {
            "nombre": "TEST_Invalid",
            "hora_inicio": "10:00",
            "hora_fin": "09:00",  # Invalid: before start
            "orden": 5
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"},
            json=turno_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "hora de fin" in data.get("detail", "").lower() or "posterior" in data.get("detail", "").lower(), f"Expected time validation error, got: {data}"
        print(f"SUCCESS: Time validation works - {data.get('detail')}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # VALIDATION - NO OVERLAP
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_08_create_turno_overlap_validation(self):
        """Test POST /api/pae/turnos - No overlapping turnos allowed"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # Try to create turno that overlaps with existing (Desayuno: 07:00-08:30)
        turno_data = {
            "nombre": "TEST_Overlap",
            "hora_inicio": "07:30",  # Overlaps with Desayuno
            "hora_fin": "09:00",
            "orden": 6
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"},
            json=turno_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "solapa" in data.get("detail", "").lower(), f"Expected overlap error, got: {data}"
        print(f"SUCCESS: Overlap validation works - {data.get('detail')}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UPDATE TURNO - ADMIN ACCESS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_09_update_turno_as_admin(self):
        """Test PUT /api/pae/turnos/{turno_id} - Admin can update turno"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        turno_id = getattr(self.__class__, 'created_turno_id', None)
        if not turno_id:
            pytest.skip("No turno created in previous test")
        
        update_data = {
            "nombre": "TEST_Merienda_Updated",
            "hora_inicio": "15:30",
            "hora_fin": "16:30"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/pae/turnos/{turno_id}",
            headers={"Authorization": f"Bearer {token}"},
            json=update_data
        )
        
        assert response.status_code == 200, f"Update turno failed: {response.text}"
        data = response.json()
        
        assert data["nombre"] == update_data["nombre"], "Nombre not updated"
        assert data["hora_inicio"] == update_data["hora_inicio"], "hora_inicio not updated"
        assert data["hora_fin"] == update_data["hora_fin"], "hora_fin not updated"
        print(f"SUCCESS: Updated turno - {data['nombre']} ({data['hora_inicio']} - {data['hora_fin']})")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UPDATE TURNO - AUXILIAR ACCESS DENIED
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_10_update_turno_as_auxiliar_denied(self):
        """Test PUT /api/pae/turnos/{turno_id} - Auxiliar alimentacion should get 403"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        turno_id = getattr(self.__class__, 'created_turno_id', None)
        if not turno_id:
            pytest.skip("No turno created in previous test")
        
        update_data = {
            "nombre": "TEST_Unauthorized_Update"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/pae/turnos/{turno_id}",
            headers={"Authorization": f"Bearer {token}"},
            json=update_data
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("SUCCESS: Auxiliar alimentacion correctly denied access to PUT turnos (403)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UPDATE TURNO - OVERLAP VALIDATION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_11_update_turno_overlap_validation(self):
        """Test PUT /api/pae/turnos/{turno_id} - No overlapping on update"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        turno_id = getattr(self.__class__, 'created_turno_id', None)
        if not turno_id:
            pytest.skip("No turno created in previous test")
        
        # Try to update to overlap with existing (Almuerzo: 12:00-13:30)
        update_data = {
            "hora_inicio": "12:30",
            "hora_fin": "14:00"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/pae/turnos/{turno_id}",
            headers={"Authorization": f"Bearer {token}"},
            json=update_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "solapa" in data.get("detail", "").lower(), f"Expected overlap error, got: {data}"
        print(f"SUCCESS: Update overlap validation works - {data.get('detail')}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TOGGLE TURNO - ADMIN ACCESS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_12_toggle_turno_as_admin(self):
        """Test PATCH /api/pae/turnos/{turno_id}/toggle - Admin can toggle turno"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        turno_id = getattr(self.__class__, 'created_turno_id', None)
        if not turno_id:
            pytest.skip("No turno created in previous test")
        
        # Toggle to inactive
        response = self.session.patch(
            f"{BASE_URL}/api/pae/turnos/{turno_id}/toggle",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Toggle turno failed: {response.text}"
        data = response.json()
        
        assert "activo" in data, "Response should have activo field"
        assert data["activo"] == False, "Turno should be inactive after toggle"
        print(f"SUCCESS: Toggled turno to inactive - {data}")
        
        # Toggle back to active
        response = self.session.patch(
            f"{BASE_URL}/api/pae/turnos/{turno_id}/toggle",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Toggle turno back failed: {response.text}"
        data = response.json()
        assert data["activo"] == True, "Turno should be active after second toggle"
        print(f"SUCCESS: Toggled turno back to active - {data}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TOGGLE TURNO - AUXILIAR ACCESS DENIED
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_13_toggle_turno_as_auxiliar_denied(self):
        """Test PATCH /api/pae/turnos/{turno_id}/toggle - Auxiliar alimentacion should get 403"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        turno_id = getattr(self.__class__, 'created_turno_id', None)
        if not turno_id:
            pytest.skip("No turno created in previous test")
        
        response = self.session.patch(
            f"{BASE_URL}/api/pae/turnos/{turno_id}/toggle",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("SUCCESS: Auxiliar alimentacion correctly denied access to PATCH toggle (403)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # VERIFY TURNO PERSISTENCE
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_14_verify_turno_persistence(self):
        """Test that created turno persists in database"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        turno_id = getattr(self.__class__, 'created_turno_id', None)
        if not turno_id:
            pytest.skip("No turno created in previous test")
        
        # Get all turnos and verify our test turno exists
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"GET turnos failed: {response.text}"
        data = response.json()
        
        test_turno = next((t for t in data if t.get("id") == turno_id), None)
        assert test_turno is not None, f"Test turno {turno_id} not found in list"
        assert "TEST_" in test_turno["nombre"], "Test turno should have TEST_ prefix"
        print(f"SUCCESS: Verified turno persistence - {test_turno['nombre']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CLEANUP - DELETE TEST TURNO (via toggle to inactive)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_15_cleanup_test_turno(self):
        """Cleanup: Deactivate test turno"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        turno_id = getattr(self.__class__, 'created_turno_id', None)
        if not turno_id:
            pytest.skip("No turno to cleanup")
        
        # First check if turno is active
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            test_turno = next((t for t in data if t.get("id") == turno_id), None)
            
            if test_turno and test_turno.get("activo"):
                # Toggle to inactive for cleanup
                response = self.session.patch(
                    f"{BASE_URL}/api/pae/turnos/{turno_id}/toggle",
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if response.status_code == 200:
                    print(f"SUCCESS: Cleanup - deactivated test turno {turno_id}")
                else:
                    print(f"WARNING: Could not deactivate test turno: {response.text}")
            else:
                print(f"INFO: Test turno already inactive or not found")
        else:
            print(f"WARNING: Could not verify turno status for cleanup")


class TestRoleHierarchy:
    """Test role hierarchy and STAFF_ROLES configuration"""
    
    def test_auxiliar_alimentacion_in_staff_roles(self):
        """Verify auxiliar_alimentacion is in STAFF_ROLES (can login to school)"""
        # This is verified by successful login in test_02
        # The role should be in STAFF_ROLES to allow school access
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUXILIAR_EMAIL,
            "password": AUXILIAR_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        
        assert response.status_code == 200, f"Auxiliar login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "auxiliar_alimentacion"
        assert data["user"]["school_id"] is not None, "Auxiliar should have school_id"
        print("SUCCESS: auxiliar_alimentacion is in STAFF_ROLES and can access school")
    
    def test_auxiliar_alimentacion_not_in_admin_roles(self):
        """Verify auxiliar_alimentacion is NOT in ADMIN_ROLES (cannot manage turnos)"""
        # Login as auxiliar
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUXILIAR_EMAIL,
            "password": AUXILIAR_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        
        assert response.status_code == 200
        token = response.json().get("token")
        
        # Try to access admin-only endpoint
        response = requests.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: auxiliar_alimentacion is NOT in ADMIN_ROLES (correctly denied)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
