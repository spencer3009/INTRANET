"""
Test Suite: Support Panel - Global Support Admin
Tests for: Login, Dashboard Overview, School Management, Profile Management, RBAC
Credentials:
  - Support Global: spencer3009@gmail.com / Socios3009
  - Normal User (Owner): admin@elroble.edu / 1234abc8
  - School El Roble ID: b9f27249-6568-49ae-94d3-e1f16750d7d9
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fichas-clinical.preview.emergentagent.com')

# Test credentials
SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"
NORMAL_USER_EMAIL = "admin@elroble.edu"
NORMAL_USER_PASSWORD = "1234abc8"
SCHOOL_ID_EL_ROBLE = "b9f27249-6568-49ae-94d3-e1f16750d7d9"


@pytest.fixture(scope="module")
def support_token():
    """Get token for global support user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPPORT_EMAIL,
        "password": SUPPORT_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip(f"Support login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def normal_user_token():
    """Get token for normal user (owner role)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": NORMAL_USER_EMAIL,
        "password": NORMAL_USER_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip(f"Normal user login failed: {response.status_code} - {response.text}")


@pytest.fixture
def support_headers(support_token):
    """Headers for support user"""
    return {"Authorization": f"Bearer {support_token}"}


@pytest.fixture
def normal_headers(normal_user_token):
    """Headers for normal user"""
    return {"Authorization": f"Bearer {normal_user_token}"}


# ═══════════════════════════════════════════════════════════════════════════════
# AUTHENTICATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSupportLogin:
    """Test support global user login"""

    def test_login_support_user_success(self):
        """Login with support global user should return token and is_support_global flag"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": SUPPORT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user info"
        
        user = data["user"]
        assert user["role"] == "system_admin_global", f"User role should be system_admin_global, got {user['role']}"
        assert user.get("is_support_global") == True, "is_support_global should be True"
        assert data.get("redirect_to_support") == True, "redirect_to_support should be True"

    def test_login_support_user_invalid_password(self):
        """Login with wrong password should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": "wrong_password"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD OVERVIEW TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSupportOverview:
    """Test GET /api/support/overview"""

    def test_overview_returns_metrics(self, support_headers):
        """Support overview should return global metrics"""
        response = requests.get(f"{BASE_URL}/api/support/overview", headers=support_headers)
        assert response.status_code == 200, f"Overview failed: {response.text}"
        
        data = response.json()
        assert "total_schools" in data, "Should have total_schools"
        assert "my_assigned_schools" in data, "Should have my_assigned_schools"
        assert "total_users_global" in data, "Should have total_users_global"
        assert "last_schools_created" in data, "Should have last_schools_created"
        
        # Validate types
        assert isinstance(data["total_schools"], int)
        assert isinstance(data["my_assigned_schools"], int)
        assert isinstance(data["total_users_global"], int)
        assert isinstance(data["last_schools_created"], list)
        
        print(f"Overview: total_schools={data['total_schools']}, my_assigned={data['my_assigned_schools']}, total_users={data['total_users_global']}")

    def test_overview_requires_auth(self):
        """Overview should require authentication"""
        response = requests.get(f"{BASE_URL}/api/support/overview")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"


# ═══════════════════════════════════════════════════════════════════════════════
# SCHOOL LISTING TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSupportSchools:
    """Test GET /api/support/schools (my assigned schools)"""

    def test_schools_returns_assigned_list(self, support_headers):
        """Should return list of schools assigned to support user"""
        response = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        assert response.status_code == 200, f"Schools list failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            school = data[0]
            assert "id" in school, "School should have id"
            assert "name" in school or "subdomain" in school, "School should have name or subdomain"
            assert "student_count" in school, "School should have student_count"
            assert "teacher_count" in school, "School should have teacher_count"
            assert "total_users" in school, "School should have total_users"
            print(f"Found {len(data)} assigned school(s)")
            for s in data:
                print(f"  - {s.get('name', s.get('subdomain'))} (ID: {s['id']})")


class TestSupportAllSchools:
    """Test GET /api/support/all-schools"""

    def test_all_schools_returns_list_with_assigned_flag(self, support_headers):
        """Should return all schools with is_assigned flag"""
        response = requests.get(f"{BASE_URL}/api/support/all-schools", headers=support_headers)
        assert response.status_code == 200, f"All schools failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            school = data[0]
            assert "id" in school, "School should have id"
            assert "is_assigned" in school, "School should have is_assigned flag"
            
            assigned = [s for s in data if s.get("is_assigned")]
            unassigned = [s for s in data if not s.get("is_assigned")]
            print(f"Total schools: {len(data)}, Assigned: {len(assigned)}, Unassigned: {len(unassigned)}")


# ═══════════════════════════════════════════════════════════════════════════════
# SCHOOL ASSIGNMENT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSupportAssignSchool:
    """Test POST /api/support/assign-school"""

    def test_assign_school_already_assigned(self, support_headers):
        """Assigning already assigned school should return 400"""
        # First get assigned schools to find one
        schools_res = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        if schools_res.status_code == 200 and len(schools_res.json()) > 0:
            assigned_school_id = schools_res.json()[0]["id"]
            
            response = requests.post(f"{BASE_URL}/api/support/assign-school", 
                headers=support_headers,
                json={"school_id": assigned_school_id}
            )
            assert response.status_code == 400, f"Expected 400 for already assigned, got {response.status_code}"
        else:
            pytest.skip("No assigned schools to test")

    def test_assign_nonexistent_school(self, support_headers):
        """Assigning non-existent school should return 404"""
        response = requests.post(f"{BASE_URL}/api/support/assign-school",
            headers=support_headers,
            json={"school_id": "non-existent-id-12345"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestSupportUnassignSchool:
    """Test DELETE /api/support/unassign-school/{school_id}"""

    def test_unassign_nonexistent_assignment(self, support_headers):
        """Unassigning non-existent assignment should return 404"""
        response = requests.delete(
            f"{BASE_URL}/api/support/unassign-school/non-existent-id-12345",
            headers=support_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


# ═══════════════════════════════════════════════════════════════════════════════
# SWITCH SCHOOL (CONTEXT SWITCHING) TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSupportSwitchSchool:
    """Test POST /api/support/switch-school"""

    def test_switch_to_assigned_school(self, support_headers):
        """Switching to assigned school should return new JWT with school context"""
        # First get an assigned school
        schools_res = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        if schools_res.status_code != 200 or len(schools_res.json()) == 0:
            pytest.skip("No assigned schools to test switch")
        
        assigned_school_id = schools_res.json()[0]["id"]
        
        response = requests.post(f"{BASE_URL}/api/support/switch-school",
            headers=support_headers,
            json={"school_id": assigned_school_id}
        )
        assert response.status_code == 200, f"Switch failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain new token"
        assert "school" in data, "Response should contain school info"
        assert "user" in data, "Response should contain user info"
        
        # Verify school context in response
        assert data["school"]["id"] == assigned_school_id
        
        # Verify user context
        user = data["user"]
        assert user["role"] == "owner", f"Switched user role should be owner, got {user['role']}"
        assert user.get("original_role") == "system_admin_global", "original_role should be system_admin_global"
        assert user.get("is_support_session") == True, "is_support_session should be True"
        assert user.get("school_id") == assigned_school_id
        
        print(f"Successfully switched to school: {data['school'].get('name', data['school'].get('subdomain'))}")

    def test_switch_to_unassigned_school_fails(self, support_headers):
        """Switching to unassigned school should return 403"""
        # Find an unassigned school
        all_schools_res = requests.get(f"{BASE_URL}/api/support/all-schools", headers=support_headers)
        if all_schools_res.status_code != 200:
            pytest.skip("Could not get all schools")
        
        unassigned = [s for s in all_schools_res.json() if not s.get("is_assigned")]
        if not unassigned:
            pytest.skip("No unassigned schools to test")
        
        response = requests.post(f"{BASE_URL}/api/support/switch-school",
            headers=support_headers,
            json={"school_id": unassigned[0]["id"]}
        )
        assert response.status_code == 403, f"Expected 403 for unassigned school, got {response.status_code}"


# ═══════════════════════════════════════════════════════════════════════════════
# PROFILE MANAGEMENT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSupportProfile:
    """Test GET/PUT /api/support/me"""

    def test_get_profile(self, support_headers):
        """GET /api/support/me should return support user profile"""
        response = requests.get(f"{BASE_URL}/api/support/me", headers=support_headers)
        assert response.status_code == 200, f"Get profile failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Profile should have id"
        assert "name" in data, "Profile should have name"
        assert "email" in data, "Profile should have email"
        assert data.get("role") == "system_admin_global", f"Role should be system_admin_global"
        
        print(f"Support profile: {data.get('name')} - {data.get('email')}")

    def test_update_profile(self, support_headers):
        """PUT /api/support/me should update profile"""
        # Get current profile
        current = requests.get(f"{BASE_URL}/api/support/me", headers=support_headers).json()
        original_name = current.get("name", "Soporte")
        
        # Update with test value
        test_name = "Soporte EduNet Updated"
        response = requests.put(f"{BASE_URL}/api/support/me",
            headers=support_headers,
            json={"name": test_name}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        data = response.json()
        assert data.get("name") == test_name, f"Name should be updated to {test_name}"
        
        # Restore original
        requests.put(f"{BASE_URL}/api/support/me", headers=support_headers, json={"name": original_name})
        print("Profile update test passed, restored original name")

    def test_update_profile_empty_fails(self, support_headers):
        """PUT /api/support/me with no data should return 400"""
        response = requests.put(f"{BASE_URL}/api/support/me",
            headers=support_headers,
            json={}
        )
        assert response.status_code == 400, f"Expected 400 for empty update, got {response.status_code}"


class TestSupportPasswordChange:
    """Test PUT /api/support/me/password"""

    def test_change_password_wrong_current(self, support_headers):
        """Changing password with wrong current password should fail"""
        response = requests.put(f"{BASE_URL}/api/support/me/password",
            headers=support_headers,
            json={
                "current_password": "wrong_password",
                "new_password": "new_secure_password"
            }
        )
        assert response.status_code == 400, f"Expected 400 for wrong current password, got {response.status_code}"

    def test_change_password_too_short(self, support_headers):
        """New password too short should fail validation"""
        response = requests.put(f"{BASE_URL}/api/support/me/password",
            headers=support_headers,
            json={
                "current_password": SUPPORT_PASSWORD,
                "new_password": "123"  # Too short (min 6)
            }
        )
        assert response.status_code == 422, f"Expected 422 for short password, got {response.status_code}"


# ═══════════════════════════════════════════════════════════════════════════════
# RBAC TESTS - NON-SUPPORT USER ACCESS DENIED
# ═══════════════════════════════════════════════════════════════════════════════

class TestSupportRBAC:
    """Test that normal users cannot access support endpoints"""

    def test_normal_user_cannot_access_overview(self, normal_headers):
        """Normal user (owner) should get 403 on /api/support/overview"""
        response = requests.get(f"{BASE_URL}/api/support/overview", headers=normal_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("RBAC: Normal user correctly denied access to /api/support/overview")

    def test_normal_user_cannot_access_schools(self, normal_headers):
        """Normal user should get 403 on /api/support/schools"""
        response = requests.get(f"{BASE_URL}/api/support/schools", headers=normal_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_normal_user_cannot_access_all_schools(self, normal_headers):
        """Normal user should get 403 on /api/support/all-schools"""
        response = requests.get(f"{BASE_URL}/api/support/all-schools", headers=normal_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_normal_user_cannot_switch_school(self, normal_headers):
        """Normal user should get 403 on /api/support/switch-school"""
        response = requests.post(f"{BASE_URL}/api/support/switch-school",
            headers=normal_headers,
            json={"school_id": SCHOOL_ID_EL_ROBLE}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_normal_user_cannot_access_support_profile(self, normal_headers):
        """Normal user should get 403 on /api/support/me"""
        response = requests.get(f"{BASE_URL}/api/support/me", headers=normal_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_normal_user_cannot_assign_school(self, normal_headers):
        """Normal user should get 403 on /api/support/assign-school"""
        response = requests.post(f"{BASE_URL}/api/support/assign-school",
            headers=normal_headers,
            json={"school_id": SCHOOL_ID_EL_ROBLE}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TEST - FULL FLOW
# ═══════════════════════════════════════════════════════════════════════════════

class TestSupportFullFlow:
    """Integration test: Login -> Overview -> Schools -> Switch"""

    def test_full_support_flow(self):
        """Test complete support panel flow"""
        # 1. Login as support
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": SUPPORT_PASSWORD
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        
        token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("1. Login successful, redirect_to_support:", login_res.json().get("redirect_to_support"))
        
        # 2. Get overview
        overview_res = requests.get(f"{BASE_URL}/api/support/overview", headers=headers)
        assert overview_res.status_code == 200, f"Overview failed: {overview_res.text}"
        overview = overview_res.json()
        print(f"2. Overview: {overview['total_schools']} schools, {overview['my_assigned_schools']} assigned")
        
        # 3. Get assigned schools
        schools_res = requests.get(f"{BASE_URL}/api/support/schools", headers=headers)
        assert schools_res.status_code == 200, f"Schools failed: {schools_res.text}"
        schools = schools_res.json()
        print(f"3. Assigned schools: {len(schools)}")
        
        # 4. If there are assigned schools, try switch
        if len(schools) > 0:
            school = schools[0]
            switch_res = requests.post(f"{BASE_URL}/api/support/switch-school",
                headers=headers,
                json={"school_id": school["id"]}
            )
            assert switch_res.status_code == 200, f"Switch failed: {switch_res.text}"
            switch_data = switch_res.json()
            print(f"4. Switched to school: {switch_data['school'].get('name', switch_data['school'].get('subdomain'))}")
            print(f"   New token role: {switch_data['user']['role']}")
            print(f"   Original role preserved: {switch_data['user'].get('original_role')}")
        else:
            print("4. No assigned schools to switch to")
        
        print("Full support flow completed successfully!")
