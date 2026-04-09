"""
Test suite for Auxiliar de Asistencia portal endpoints
Tests: login redirect, my-scans-today endpoint, qr/scan access
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
AUX_ASISTENCIA_EMAIL = "marco.perez@elroble.edu"
AUX_ASISTENCIA_PASSWORD = "Auxiliar123!"
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"


class TestAuxAsistenciaAuth:
    """Test authentication and role-based access for auxiliar_asistencia"""
    
    @pytest.fixture(scope="class")
    def aux_token(self):
        """Get auth token for auxiliar_asistencia user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUX_ASISTENCIA_EMAIL,
            "password": AUX_ASISTENCIA_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("user", {}).get("role") == "auxiliar_asistencia", f"Wrong role: {data.get('user', {}).get('role')}"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    def test_aux_asistencia_login_success(self):
        """Test that auxiliar_asistencia can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUX_ASISTENCIA_EMAIL,
            "password": AUX_ASISTENCIA_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify user data
        assert "token" in data
        assert "user" in data
        user = data["user"]
        assert user["email"] == AUX_ASISTENCIA_EMAIL
        assert user["role"] == "auxiliar_asistencia"
        assert "school_id" in user
        assert "subdomain" in user
        print(f"✓ Login successful for auxiliar_asistencia: {user.get('name')}")
    
    def test_aux_asistencia_login_wrong_password(self):
        """Test login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUX_ASISTENCIA_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400]
        print("✓ Login correctly rejected with wrong password")


class TestMyScansToday:
    """Test /api/attendance/my-scans-today endpoint"""
    
    @pytest.fixture(scope="class")
    def aux_token(self):
        """Get auth token for auxiliar_asistencia user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUX_ASISTENCIA_EMAIL,
            "password": AUX_ASISTENCIA_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate auxiliar_asistencia")
        return response.json()["token"]
    
    def test_my_scans_today_returns_valid_json(self, aux_token):
        """Test that my-scans-today returns valid JSON with total and records"""
        headers = {"Authorization": f"Bearer {aux_token}"}
        response = requests.get(f"{BASE_URL}/api/attendance/my-scans-today", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total" in data, "Response missing 'total' field"
        assert "records" in data, "Response missing 'records' field"
        assert "date" in data, "Response missing 'date' field"
        
        # Verify data types
        assert isinstance(data["total"], int), "total should be an integer"
        assert isinstance(data["records"], list), "records should be a list"
        assert isinstance(data["date"], str), "date should be a string"
        
        print(f"✓ my-scans-today returned: total={data['total']}, date={data['date']}, records_count={len(data['records'])}")
    
    def test_my_scans_today_unauthorized(self):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/attendance/my-scans-today")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Endpoint correctly requires authentication")


class TestQRScanAccess:
    """Test /api/attendance/qr/scan endpoint access for auxiliar_asistencia"""
    
    @pytest.fixture(scope="class")
    def aux_token(self):
        """Get auth token for auxiliar_asistencia user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUX_ASISTENCIA_EMAIL,
            "password": AUX_ASISTENCIA_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate auxiliar_asistencia")
        return response.json()["token"]
    
    def test_qr_scan_accessible_by_aux_asistencia(self, aux_token):
        """Test that auxiliar_asistencia can access qr/scan endpoint (not 403)"""
        headers = {"Authorization": f"Bearer {aux_token}"}
        
        # Send a test scan request with invalid QR (to test access, not actual scan)
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            headers=headers,
            json={"qr_token": "test_invalid_qr", "mode": "auto"}
        )
        
        # Should NOT be 403 (forbidden) - auxiliar_asistencia should have access
        assert response.status_code != 403, f"auxiliar_asistencia should have access to qr/scan, got 403"
        
        # Expected: 400 (invalid QR) since we sent a fake QR token
        assert response.status_code == 400, f"Expected 400 for invalid QR, got {response.status_code}: {response.text}"
        
        print("✓ auxiliar_asistencia has access to qr/scan endpoint (not 403)")
    
    def test_qr_scan_unauthorized(self):
        """Test that endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": "test", "mode": "auto"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ qr/scan endpoint correctly requires authentication")


class TestAdminNoRegression:
    """Test that admin/owner can still access their dashboard normally"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate admin")
        return response.json()["token"]
    
    def test_admin_login_success(self):
        """Test that admin can still login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "owner"
        print(f"✓ Admin login successful: {data['user'].get('name')}")
    
    def test_admin_can_access_users_endpoint(self, admin_token):
        """Test that admin can access /api/users endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        assert response.status_code == 200, f"Admin should access /api/users, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Users endpoint should return a list"
        print(f"✓ Admin can access users endpoint, found {len(data)} users")
    
    def test_admin_can_access_attendance_endpoint(self, admin_token):
        """Test that admin can access attendance endpoints"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/attendance/qr/history",
            headers=headers
        )
        
        assert response.status_code == 200, f"Admin should access attendance history, got {response.status_code}"
        print("✓ Admin can access attendance history endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
