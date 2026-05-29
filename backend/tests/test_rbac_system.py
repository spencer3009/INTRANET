"""
RBAC System Tests - Role-Based Access Control
Tests for Admin vs Owner permissions:
1. Admin login redirects to /dashboard (not /admin)
2. Admin cannot access /api/settings (403)
3. Admin cannot access /api/accounting/payments when flag=false (403)
4. Owner can enable allow_admin_accounting from Settings
5. Admin CAN access /api/accounting/payments when flag=true
6. Owner can access all endpoints normally
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://report-card-hub-6.preview.emergentagent.com').rstrip('/')

# Test credentials
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
ADMIN_EMAIL = "admin.prueba@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
SCHOOL_SUBDOMAIN = "elroble"


class TestRBACAuthentication:
    """Test authentication and role-based redirects"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_owner_login_success(self):
        """TEST 1: Owner can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        data = response.json()
        
        # Verify owner role
        assert "user" in data
        assert data["user"]["role"] in ["owner", "director"], f"Expected owner/director role, got {data['user']['role']}"
        assert "token" in data
        print(f"✓ Owner login successful - Role: {data['user']['role']}")
        
        # Check permissions in response
        if "permissions" in data["user"]:
            permissions = data["user"]["permissions"]
            print(f"  Owner permissions: {permissions}")
            assert permissions.get("sections", {}).get("settings") == True, "Owner should have settings access"
            assert permissions.get("sections", {}).get("accounting") == True, "Owner should have accounting access"
    
    def test_admin_login_success(self):
        """TEST 2: Admin can login successfully and gets redirected to dashboard"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        # Verify admin role
        assert "user" in data
        assert data["user"]["role"] == "admin", f"Expected admin role, got {data['user']['role']}"
        assert "token" in data
        print(f"✓ Admin login successful - Role: {data['user']['role']}")
        
        # Admin should NOT be redirected to a separate /admin portal
        # The redirect_url should be to the main domain dashboard
        if "redirect_url" in data:
            assert "/admin" not in data["redirect_url"] or "dashboard" in data["redirect_url"], \
                f"Admin should not be redirected to separate admin portal: {data.get('redirect_url')}"
        
        # Check permissions in response
        if "permissions" in data["user"]:
            permissions = data["user"]["permissions"]
            print(f"  Admin permissions: {permissions}")
            # Admin should NOT have settings access
            assert permissions.get("sections", {}).get("settings") == False, "Admin should NOT have settings access"


class TestRBACSettingsAccess:
    """Test Settings endpoint access control"""
    
    @pytest.fixture
    def owner_token(self):
        """Get owner authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Owner authentication failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_owner_can_access_settings(self, owner_token):
        """TEST 3: Owner CAN access /api/settings"""
        response = requests.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200, f"Owner should access settings: {response.text}"
        data = response.json()
        print(f"✓ Owner can access settings - Response keys: {list(data.keys())}")
        
        # Verify settings structure
        assert "allow_admin_accounting" in data or "system_name" in data, \
            "Settings response should contain expected fields"
    
    def test_admin_cannot_access_settings(self, admin_token):
        """TEST 4: Admin CANNOT access /api/settings (403)"""
        response = requests.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 403, \
            f"Admin should get 403 for settings, got {response.status_code}: {response.text}"
        print(f"✓ Admin correctly denied access to settings (403)")
    
    def test_admin_cannot_update_settings(self, admin_token):
        """TEST 5: Admin CANNOT update /api/settings (403)"""
        response = requests.put(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"system_name": "Test Name"}
        )
        
        assert response.status_code == 403, \
            f"Admin should get 403 for settings update, got {response.status_code}: {response.text}"
        print(f"✓ Admin correctly denied settings update (403)")
    
    def test_admin_cannot_update_role_settings(self, admin_token):
        """TEST 6: Admin CANNOT update /api/settings/roles (403)"""
        response = requests.put(
            f"{BASE_URL}/api/settings/roles",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"allow_admin_accounting": True}
        )
        
        assert response.status_code == 403, \
            f"Admin should get 403 for role settings, got {response.status_code}: {response.text}"
        print(f"✓ Admin correctly denied role settings update (403)")


class TestRBACAccountingAccess:
    """Test Accounting endpoint access control with feature flag"""
    
    @pytest.fixture
    def owner_token(self):
        """Get owner authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Owner authentication failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_owner_can_access_accounting(self, owner_token):
        """TEST 7: Owner CAN always access /api/accounting/payments"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200, \
            f"Owner should access accounting: {response.text}"
        data = response.json()
        print(f"✓ Owner can access accounting - Total payments: {data.get('total', 0)}")
    
    def test_owner_can_toggle_admin_accounting_flag(self, owner_token):
        """TEST 8: Owner can toggle allow_admin_accounting flag"""
        # First, get current settings
        settings_response = requests.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert settings_response.status_code == 200
        current_flag = settings_response.json().get("allow_admin_accounting", False)
        print(f"  Current allow_admin_accounting: {current_flag}")
        
        # Toggle the flag to False first (ensure clean state)
        response = requests.put(
            f"{BASE_URL}/api/settings/roles",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"allow_admin_accounting": False}
        )
        
        assert response.status_code == 200, \
            f"Owner should update role settings: {response.text}"
        data = response.json()
        assert data.get("allow_admin_accounting") == False, \
            f"Flag should be False: {data}"
        print(f"✓ Owner set allow_admin_accounting to False")
    
    def test_admin_cannot_access_accounting_when_flag_false(self, owner_token, admin_token):
        """TEST 9: Admin CANNOT access /api/accounting/payments when flag=false"""
        # First ensure flag is False
        requests.put(
            f"{BASE_URL}/api/settings/roles",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"allow_admin_accounting": False}
        )
        
        # Now test admin access
        response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 403, \
            f"Admin should get 403 for accounting when flag=false, got {response.status_code}: {response.text}"
        print(f"✓ Admin correctly denied accounting access when flag=false (403)")
    
    def test_admin_can_access_accounting_when_flag_true(self, owner_token, admin_token):
        """TEST 10: Admin CAN access /api/accounting/payments when flag=true"""
        # First enable the flag
        toggle_response = requests.put(
            f"{BASE_URL}/api/settings/roles",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"allow_admin_accounting": True}
        )
        assert toggle_response.status_code == 200, \
            f"Failed to enable flag: {toggle_response.text}"
        print(f"  Owner enabled allow_admin_accounting")
        
        # Now test admin access
        response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, \
            f"Admin should access accounting when flag=true, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Admin CAN access accounting when flag=true - Total payments: {data.get('total', 0)}")
        
        # Reset flag to False for clean state
        requests.put(
            f"{BASE_URL}/api/settings/roles",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"allow_admin_accounting": False}
        )


class TestRBACPermissionsEndpoint:
    """Test the /api/auth/permissions endpoint"""
    
    @pytest.fixture
    def owner_token(self):
        """Get owner authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Owner authentication failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_owner_permissions_endpoint(self, owner_token):
        """TEST 11: Owner permissions endpoint returns correct sections"""
        response = requests.get(
            f"{BASE_URL}/api/auth/permissions",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200, f"Permissions endpoint failed: {response.text}"
        data = response.json()
        
        assert "role" in data
        assert "sections" in data
        assert data["role"] in ["owner", "director"]
        
        # Owner should have access to all sections
        sections = data["sections"]
        assert sections.get("settings") == True, "Owner should have settings access"
        assert sections.get("accounting") == True, "Owner should have accounting access"
        assert sections.get("users") == True, "Owner should have users access"
        print(f"✓ Owner permissions correct - Role: {data['role']}, Settings: {sections.get('settings')}, Accounting: {sections.get('accounting')}")
    
    def test_admin_permissions_endpoint(self, admin_token, owner_token):
        """TEST 12: Admin permissions endpoint returns correct sections"""
        # Ensure flag is False
        requests.put(
            f"{BASE_URL}/api/settings/roles",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"allow_admin_accounting": False}
        )
        
        response = requests.get(
            f"{BASE_URL}/api/auth/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Permissions endpoint failed: {response.text}"
        data = response.json()
        
        assert "role" in data
        assert "sections" in data
        assert data["role"] == "admin"
        
        # Admin should NOT have settings access
        sections = data["sections"]
        assert sections.get("settings") == False, "Admin should NOT have settings access"
        # Admin accounting depends on flag (currently False)
        assert sections.get("accounting") == False, "Admin should NOT have accounting access when flag=false"
        print(f"✓ Admin permissions correct - Role: {data['role']}, Settings: {sections.get('settings')}, Accounting: {sections.get('accounting')}")
    
    def test_admin_permissions_with_accounting_enabled(self, admin_token, owner_token):
        """TEST 13: Admin permissions show accounting=true when flag enabled"""
        # Enable the flag
        requests.put(
            f"{BASE_URL}/api/settings/roles",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"allow_admin_accounting": True}
        )
        
        response = requests.get(
            f"{BASE_URL}/api/auth/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        sections = data["sections"]
        
        # Admin should now have accounting access
        assert sections.get("accounting") == True, "Admin should have accounting access when flag=true"
        # But still no settings access
        assert sections.get("settings") == False, "Admin should still NOT have settings access"
        print(f"✓ Admin permissions with flag=true - Accounting: {sections.get('accounting')}, Settings: {sections.get('settings')}")
        
        # Reset flag
        requests.put(
            f"{BASE_URL}/api/settings/roles",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"allow_admin_accounting": False}
        )


class TestRBACMeEndpoint:
    """Test the /api/auth/me endpoint includes permissions"""
    
    @pytest.fixture
    def owner_token(self):
        """Get owner authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Owner authentication failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_owner_me_includes_permissions(self, owner_token):
        """TEST 14: /api/auth/me includes permissions for owner"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "permissions" in data, "Me endpoint should include permissions"
        assert data["permissions"]["sections"]["settings"] == True
        print(f"✓ Owner /me endpoint includes permissions with settings=true")
    
    def test_admin_me_includes_permissions(self, admin_token):
        """TEST 15: /api/auth/me includes permissions for admin"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "permissions" in data, "Me endpoint should include permissions"
        assert data["permissions"]["sections"]["settings"] == False, "Admin should not have settings access"
        print(f"✓ Admin /me endpoint includes permissions with settings=false")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
