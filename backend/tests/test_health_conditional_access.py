"""
Test Health & Wellness Conditional Access for Teachers and Admins
Tests the new feature: conditional sidebar visibility based on health permissions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
OWNER_CREDS = {"email": "admin@elroble.edu", "password": "1234abc8", "subdomain": "elroble"}
TEACHER_CREDS = {"email": "sonia3009@gmail.com", "password": "Test1234!", "subdomain": "elroble"}
PARENT_CREDS = {"email": "maria.peres@gmail.com", "password": "Test1234!", "subdomain": "elroble"}


class TestHealthPermissionsAPI:
    """Test GET/PUT /api/settings/health-permissions endpoint access"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for different user roles"""
        self.owner_token = self._login(OWNER_CREDS)
        self.teacher_token = self._login(TEACHER_CREDS)
        self.parent_token = self._login(PARENT_CREDS)
        
    def _login(self, creds):
        """Helper to login and get token"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
        if resp.status_code == 200:
            return resp.json().get("token")
        return None
    
    def test_owner_can_get_health_permissions(self):
        """Owner should be able to GET health permissions"""
        assert self.owner_token, "Owner login failed"
        resp = requests.get(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "admin_can_manage" in data
        assert "teacher_can_manage" in data
        print(f"PASS: Owner GET health-permissions: {data}")
    
    def test_teacher_can_get_health_permissions(self):
        """Teacher should be able to GET health permissions (new feature)"""
        assert self.teacher_token, "Teacher login failed"
        resp = requests.get(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "admin_can_manage" in data
        assert "teacher_can_manage" in data
        print(f"PASS: Teacher GET health-permissions: {data}")
    
    def test_parent_can_get_health_permissions(self):
        """Parent should be able to GET health permissions (any authenticated user)"""
        assert self.parent_token, "Parent login failed"
        resp = requests.get(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.parent_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "admin_can_manage" in data
        assert "teacher_can_manage" in data
        print(f"PASS: Parent GET health-permissions: {data}")
    
    def test_owner_can_put_health_permissions(self):
        """Owner should be able to PUT health permissions"""
        assert self.owner_token, "Owner login failed"
        
        # First get current state
        get_resp = requests.get(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        original = get_resp.json()
        
        # Update permissions
        resp = requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"admin_can_manage": True, "teacher_can_manage": True}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "permissions" in data
        print(f"PASS: Owner PUT health-permissions: {data}")
    
    def test_teacher_cannot_put_health_permissions(self):
        """Teacher should NOT be able to PUT health permissions (owner-only)"""
        assert self.teacher_token, "Teacher login failed"
        resp = requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.teacher_token}"},
            json={"teacher_can_manage": True}
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print(f"PASS: Teacher PUT health-permissions correctly denied (403)")
    
    def test_parent_cannot_put_health_permissions(self):
        """Parent should NOT be able to PUT health permissions (owner-only)"""
        assert self.parent_token, "Parent login failed"
        resp = requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.parent_token}"},
            json={"teacher_can_manage": True}
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print(f"PASS: Parent PUT health-permissions correctly denied (403)")


class TestTeacherHealthAccess:
    """Test teacher access to health module based on permissions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens"""
        self.owner_token = self._login(OWNER_CREDS)
        self.teacher_token = self._login(TEACHER_CREDS)
        
    def _login(self, creds):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
        if resp.status_code == 200:
            return resp.json().get("token")
        return None
    
    def _set_teacher_permission(self, enabled: bool):
        """Helper to set teacher_can_manage permission"""
        resp = requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": enabled}
        )
        return resp.status_code == 200
    
    def test_teacher_can_access_topico_when_enabled(self):
        """Teacher should access topico when teacher_can_manage=true"""
        assert self.owner_token and self.teacher_token
        
        # Enable teacher access
        assert self._set_teacher_permission(True), "Failed to enable teacher permission"
        
        # Teacher tries to access topico list
        resp = requests.get(
            f"{BASE_URL}/api/health/topico",
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: Teacher can access topico when enabled")
    
    def test_teacher_can_access_psicologia_when_enabled(self):
        """Teacher should access psicologia when teacher_can_manage=true"""
        assert self.owner_token and self.teacher_token
        
        # Enable teacher access
        assert self._set_teacher_permission(True), "Failed to enable teacher permission"
        
        # Teacher tries to access psicologia list
        resp = requests.get(
            f"{BASE_URL}/api/health/psicologia",
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: Teacher can access psicologia when enabled")
    
    def test_teacher_denied_topico_when_disabled(self):
        """Teacher should be denied topico when teacher_can_manage=false"""
        assert self.owner_token and self.teacher_token
        
        # Disable teacher access
        assert self._set_teacher_permission(False), "Failed to disable teacher permission"
        
        # Teacher tries to access topico list
        resp = requests.get(
            f"{BASE_URL}/api/health/topico",
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("PASS: Teacher correctly denied topico when disabled")
        
        # Re-enable for other tests
        self._set_teacher_permission(True)
    
    def test_teacher_denied_psicologia_when_disabled(self):
        """Teacher should be denied psicologia when teacher_can_manage=false"""
        assert self.owner_token and self.teacher_token
        
        # Disable teacher access
        assert self._set_teacher_permission(False), "Failed to disable teacher permission"
        
        # Teacher tries to access psicologia list
        resp = requests.get(
            f"{BASE_URL}/api/health/psicologia",
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("PASS: Teacher correctly denied psicologia when disabled")
        
        # Re-enable for other tests
        self._set_teacher_permission(True)


class TestOwnerAlwaysHasAccess:
    """Test that owner always has access regardless of permission settings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.owner_token = self._login(OWNER_CREDS)
        
    def _login(self, creds):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
        if resp.status_code == 200:
            return resp.json().get("token")
        return None
    
    def test_owner_can_access_topico_always(self):
        """Owner should always access topico regardless of admin_can_manage setting"""
        assert self.owner_token
        
        # Even if we set admin_can_manage=false, owner should still have access
        requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"admin_can_manage": False}
        )
        
        resp = requests.get(
            f"{BASE_URL}/api/health/topico",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: Owner always has topico access")
        
        # Reset
        requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"admin_can_manage": True}
        )
    
    def test_owner_can_access_psicologia_always(self):
        """Owner should always access psicologia regardless of admin_can_manage setting"""
        assert self.owner_token
        
        resp = requests.get(
            f"{BASE_URL}/api/health/psicologia",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: Owner always has psicologia access")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
