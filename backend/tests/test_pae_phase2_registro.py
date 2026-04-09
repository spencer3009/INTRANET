"""
PAE (Programa de Alimentación Escolar) Module - Phase 2 Tests
Tests for registro (scanning) endpoints and dashboard functionality.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://memory-optimized-qr.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
AUXILIAR_EMAIL = "carlos.comedor@elroble.edu"
AUXILIAR_PASSWORD = "Comedor123!"
SUBDOMAIN = "elroble"

# Known test data
EXISTING_QR_ID = "32a2b825"  # Magno Eduardo Calle Marquez - already registered in Desayuno Escolar


class TestPAEPhase2Registro:
    """PAE Module Phase 2 - Registro (Scanning) Endpoints Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        self.auxiliar_token = None
        self.desayuno_turno_id = None
        self.almuerzo_turno_id = None
    
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
    
    def get_turno_ids(self, token):
        """Get turno IDs for testing"""
        response = self.session.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            turnos = response.json()
            for t in turnos:
                if "desayuno" in t.get("nombre", "").lower():
                    self.desayuno_turno_id = t["id"]
                elif "almuerzo" in t.get("nombre", "").lower():
                    self.almuerzo_turno_id = t["id"]
        return self.desayuno_turno_id, self.almuerzo_turno_id
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DASHBOARD ENDPOINT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_dashboard_as_admin(self):
        """Test GET /api/pae/registro/dashboard - Admin can access dashboard"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        response = self.session.get(
            f"{BASE_URL}/api/pae/registro/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify dashboard structure
        assert "fecha" in data, "Dashboard should have fecha"
        assert "conteo_por_turno" in data, "Dashboard should have conteo_por_turno"
        assert "ultimos_registros" in data, "Dashboard should have ultimos_registros"
        assert isinstance(data["conteo_por_turno"], list), "conteo_por_turno should be a list"
        assert isinstance(data["ultimos_registros"], list), "ultimos_registros should be a list"
        
        print(f"SUCCESS: Dashboard - fecha: {data['fecha']}, turnos: {len(data['conteo_por_turno'])}, ultimos: {len(data['ultimos_registros'])}")
        
        # Verify conteo_por_turno structure
        if len(data["conteo_por_turno"]) > 0:
            turno = data["conteo_por_turno"][0]
            assert "turno_id" in turno, "conteo should have turno_id"
            assert "turno_nombre" in turno, "conteo should have turno_nombre"
            assert "total" in turno, "conteo should have total"
            print(f"SUCCESS: Turno conteo structure verified - {turno['turno_nombre']}: {turno['total']}")
    
    def test_02_dashboard_as_auxiliar(self):
        """Test GET /api/pae/registro/dashboard - Auxiliar can access dashboard"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        response = self.session.get(
            f"{BASE_URL}/api/pae/registro/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Dashboard failed for auxiliar: {response.text}"
        data = response.json()
        
        assert "conteo_por_turno" in data, "Dashboard should have conteo_por_turno"
        print(f"SUCCESS: Auxiliar can access dashboard - {len(data['conteo_por_turno'])} turnos")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # REGISTRO ENDPOINT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_03_registro_invalid_qr(self):
        """Test POST /api/pae/registro - Invalid QR returns 404"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        # Get turno IDs first
        admin_token = self.get_admin_token()
        self.get_turno_ids(admin_token)
        
        assert self.desayuno_turno_id, "No desayuno turno found"
        
        response = self.session.post(
            f"{BASE_URL}/api/pae/registro",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "qr_data": "invalid_qr_code_xyz",
                "turno_id": self.desayuno_turno_id
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "no reconocido" in data.get("detail", "").lower(), f"Expected QR not recognized error: {data}"
        print(f"SUCCESS: Invalid QR returns 404 - {data.get('detail')}")
    
    def test_04_registro_duplicate_returns_409(self):
        """Test POST /api/pae/registro - Duplicate registration returns 409"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        # Get turno IDs
        admin_token = self.get_admin_token()
        self.get_turno_ids(admin_token)
        
        assert self.desayuno_turno_id, "No desayuno turno found"
        
        # Try to register the already registered student (Magno Eduardo in Desayuno)
        response = self.session.post(
            f"{BASE_URL}/api/pae/registro",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "qr_data": EXISTING_QR_ID,
                "turno_id": self.desayuno_turno_id
            }
        )
        
        assert response.status_code == 409, f"Expected 409 for duplicate, got {response.status_code}: {response.text}"
        data = response.json()
        assert "ya fue registrado" in data.get("detail", "").lower(), f"Expected duplicate error: {data}"
        print(f"SUCCESS: Duplicate registration returns 409 - {data.get('detail')}")
    
    def test_05_registro_inactive_turno_returns_400(self):
        """Test POST /api/pae/registro - Inactive turno returns 400"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        # Use a fake turno ID that doesn't exist
        response = self.session.post(
            f"{BASE_URL}/api/pae/registro",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "qr_data": EXISTING_QR_ID,
                "turno_id": "nonexistent_turno_id"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "turno" in data.get("detail", "").lower(), f"Expected turno error: {data}"
        print(f"SUCCESS: Invalid turno returns 400 - {data.get('detail')}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET REGISTROS POR TURNO TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_06_get_registros_turno_as_auxiliar(self):
        """Test GET /api/pae/registro/turno/{turno_id} - Auxiliar can list records"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        # Get turno IDs
        admin_token = self.get_admin_token()
        self.get_turno_ids(admin_token)
        
        assert self.desayuno_turno_id, "No desayuno turno found"
        
        response = self.session.get(
            f"{BASE_URL}/api/pae/registro/turno/{self.desayuno_turno_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"GET registros turno failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET registros turno - found {len(data)} records")
        
        # Verify record structure if any exist
        if len(data) > 0:
            record = data[0]
            assert "id" in record, "Record should have id"
            assert "student_id" in record, "Record should have student_id"
            assert "turno_id" in record, "Record should have turno_id"
            assert "fecha" in record, "Record should have fecha"
            assert "metadata" in record, "Record should have metadata"
            print(f"SUCCESS: Record structure verified - {record.get('metadata', {}).get('nombre_estudiante', 'N/A')}")
    
    def test_07_get_registros_turno_with_date_filter(self):
        """Test GET /api/pae/registro/turno/{turno_id}?fecha=YYYY-MM-DD"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        # Get turno IDs
        admin_token = self.get_admin_token()
        self.get_turno_ids(admin_token)
        
        assert self.desayuno_turno_id, "No desayuno turno found"
        
        # Test with today's date
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/pae/registro/turno/{self.desayuno_turno_id}?fecha={today}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"GET registros with date failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET registros with date filter - {len(data)} records for {today}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ADMIN REGISTROS-DIA ENDPOINT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_08_registros_dia_as_admin(self):
        """Test GET /api/pae/registros-dia - Admin can access daily records"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        response = self.session.get(
            f"{BASE_URL}/api/pae/registros-dia",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"GET registros-dia failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "fecha" in data, "Response should have fecha"
        assert "total" in data, "Response should have total"
        assert "resumen_por_turno" in data, "Response should have resumen_por_turno"
        assert "registros" in data, "Response should have registros"
        
        print(f"SUCCESS: GET registros-dia - fecha: {data['fecha']}, total: {data['total']}")
        
        # Verify resumen structure
        if len(data["resumen_por_turno"]) > 0:
            resumen = data["resumen_por_turno"][0]
            assert "turno_id" in resumen, "Resumen should have turno_id"
            assert "turno_nombre" in resumen, "Resumen should have turno_nombre"
            assert "total" in resumen, "Resumen should have total"
            print(f"SUCCESS: Resumen structure verified - {resumen['turno_nombre']}: {resumen['total']}")
    
    def test_09_registros_dia_with_turno_filter(self):
        """Test GET /api/pae/registros-dia?turno_id=xxx - Filter by turno"""
        token = self.get_admin_token()
        assert token, "Failed to get admin token"
        
        # Get turno IDs
        self.get_turno_ids(token)
        
        if not self.desayuno_turno_id:
            pytest.skip("No desayuno turno found")
        
        response = self.session.get(
            f"{BASE_URL}/api/pae/registros-dia?turno_id={self.desayuno_turno_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"GET registros-dia with filter failed: {response.text}"
        data = response.json()
        
        # All records should be for the filtered turno
        for r in data.get("registros", []):
            assert r.get("turno_id") == self.desayuno_turno_id, f"Record has wrong turno_id: {r.get('turno_id')}"
        
        print(f"SUCCESS: GET registros-dia with turno filter - {len(data.get('registros', []))} records")
    
    def test_10_registros_dia_as_auxiliar_denied(self):
        """Test GET /api/pae/registros-dia - Auxiliar should get 403"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        response = self.session.get(
            f"{BASE_URL}/api/pae/registros-dia",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("SUCCESS: Auxiliar correctly denied access to registros-dia (403)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # QR RESOLUTION TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_11_qr_resolution_url_format(self):
        """Test QR resolution with URL format"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        # Get turno IDs
        admin_token = self.get_admin_token()
        self.get_turno_ids(admin_token)
        
        # Test with URL format (should extract the QR ID from URL)
        # This will return 409 if already registered, which is expected
        response = self.session.post(
            f"{BASE_URL}/api/pae/registro",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "qr_data": f"https://example.com/qr/{EXISTING_QR_ID}",
                "turno_id": self.desayuno_turno_id
            }
        )
        
        # Should be 409 (duplicate) or 201 (success) - not 404 (invalid QR)
        assert response.status_code in [201, 409], f"URL QR resolution failed: {response.status_code} - {response.text}"
        print(f"SUCCESS: QR URL format resolved correctly - status: {response.status_code}")
    
    def test_12_qr_resolution_plain_id(self):
        """Test QR resolution with plain ID format"""
        token = self.get_auxiliar_token()
        assert token, "Failed to get auxiliar token"
        
        # Get turno IDs
        admin_token = self.get_admin_token()
        self.get_turno_ids(admin_token)
        
        # Test with plain ID format
        response = self.session.post(
            f"{BASE_URL}/api/pae/registro",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "qr_data": EXISTING_QR_ID,
                "turno_id": self.desayuno_turno_id
            }
        )
        
        # Should be 409 (duplicate) - not 404 (invalid QR)
        assert response.status_code in [201, 409], f"Plain QR resolution failed: {response.status_code} - {response.text}"
        print(f"SUCCESS: Plain QR ID resolved correctly - status: {response.status_code}")


class TestPAEPhase2RoleAccess:
    """Test role-based access for PAE Phase 2 endpoints"""
    
    def test_auxiliar_can_access_scan_endpoints(self):
        """Verify auxiliar_alimentacion can access scanning endpoints"""
        # Login as auxiliar
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUXILIAR_EMAIL,
            "password": AUXILIAR_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        
        assert response.status_code == 200, f"Auxiliar login failed: {response.text}"
        token = response.json().get("token")
        
        # Test dashboard access
        response = requests.get(
            f"{BASE_URL}/api/pae/registro/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, "Auxiliar should access dashboard"
        
        # Test registro endpoint (will fail with invalid data but should not be 403)
        response = requests.post(
            f"{BASE_URL}/api/pae/registro",
            headers={"Authorization": f"Bearer {token}"},
            json={"qr_data": "test", "turno_id": "test"}
        )
        assert response.status_code != 403, "Auxiliar should have access to registro endpoint"
        
        print("SUCCESS: Auxiliar has access to PAE scanning endpoints")
    
    def test_admin_can_access_all_pae_endpoints(self):
        """Verify admin can access all PAE endpoints"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        token = response.json().get("token")
        
        # Test dashboard
        response = requests.get(
            f"{BASE_URL}/api/pae/registro/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, "Admin should access dashboard"
        
        # Test registros-dia (admin only)
        response = requests.get(
            f"{BASE_URL}/api/pae/registros-dia",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, "Admin should access registros-dia"
        
        # Test turnos (admin only)
        response = requests.get(
            f"{BASE_URL}/api/pae/turnos",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, "Admin should access turnos"
        
        print("SUCCESS: Admin has access to all PAE endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
