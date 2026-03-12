"""
Test Support Panel School Unassign/Reassign Feature
Tests the 'X' button functionality to remove schools from support user's view
and the reassignment capability.

Key scenarios:
1. Login with support user (system_admin_global)
2. GET /api/support/schools returns assigned schools
3. DELETE /api/support/unassign-school/{school_id} marks school as unassigned
4. After unassigning, GET /api/support/schools should NOT include the unassigned school
5. GET /api/support/all-schools should show unassigned school with is_assigned=false
6. POST /api/support/assign-school can re-assign previously unassigned school
7. After re-assigning, school appears back in the list
8. GET /api/support/overview shows correct count of assigned schools
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Support user credentials
SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"


class TestSupportSchoolUnassign:
    """Tests for support panel school unassign/reassign functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as support user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": SUPPORT_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Cannot login as support user: {login_response.status_code} - {login_response.text}")
        
        data = login_response.json()
        self.token = data.get("token")
        self.user = data.get("user", {})
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Verify user is system_admin_global
        assert self.user.get("role") == "system_admin_global", f"Expected system_admin_global role, got {self.user.get('role')}"
    
    def test_01_login_support_user(self):
        """Test: Support login with spencer3009@gmail.com / Socios3009"""
        # Already done in setup, verify token exists
        assert self.token is not None, "Login should return a token"
        assert self.user.get("role") == "system_admin_global", "User should be system_admin_global"
        print(f"✓ Support user logged in successfully. Role: {self.user.get('role')}")
    
    def test_02_get_support_schools_returns_list(self):
        """Test: GET /api/support/schools returns list of assigned schools"""
        response = self.session.get(f"{BASE_URL}/api/support/schools")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        schools = response.json()
        assert isinstance(schools, list), "Response should be a list"
        
        # Store school info for later tests
        self.assigned_schools = schools
        print(f"✓ GET /api/support/schools returned {len(schools)} schools")
        
        if schools:
            for school in schools:
                print(f"  - {school.get('name', school.get('subdomain'))} (id: {school.get('id')[:8]}...)")
        
        return schools
    
    def test_03_get_all_schools(self):
        """Test: GET /api/support/all-schools returns all schools with is_assigned flag"""
        response = self.session.get(f"{BASE_URL}/api/support/all-schools")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        schools = response.json()
        assert isinstance(schools, list), "Response should be a list"
        
        # Verify each school has is_assigned field
        for school in schools:
            assert "is_assigned" in school, f"School {school.get('id')} missing is_assigned field"
        
        print(f"✓ GET /api/support/all-schools returned {len(schools)} schools")
        assigned_count = sum(1 for s in schools if s.get("is_assigned"))
        unassigned_count = sum(1 for s in schools if not s.get("is_assigned"))
        print(f"  Assigned: {assigned_count}, Unassigned: {unassigned_count}")
        
        return schools
    
    def test_04_get_support_overview(self):
        """Test: GET /api/support/overview shows correct counts"""
        response = self.session.get(f"{BASE_URL}/api/support/overview")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "total_schools" in data, "Missing total_schools in overview"
        assert "my_assigned_schools" in data, "Missing my_assigned_schools in overview"
        
        print(f"✓ GET /api/support/overview:")
        print(f"  Total schools: {data.get('total_schools')}")
        print(f"  My assigned schools: {data.get('my_assigned_schools')}")
        
        return data
    
    def test_05_unassign_school(self):
        """Test: DELETE /api/support/unassign-school/{school_id} marks school as unassigned"""
        # First get the list of schools
        schools_response = self.session.get(f"{BASE_URL}/api/support/schools")
        schools = schools_response.json()
        
        if not schools:
            pytest.skip("No schools to unassign")
        
        # Pick the first school to unassign
        test_school = schools[0]
        school_id = test_school.get("id")
        school_name = test_school.get("name", test_school.get("subdomain"))
        
        print(f"Testing unassign on school: {school_name} (id: {school_id[:8]}...)")
        
        # Unassign the school
        response = self.session.delete(f"{BASE_URL}/api/support/unassign-school/{school_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        
        print(f"✓ DELETE /api/support/unassign-school/{school_id[:8]}... returned: {data.get('message')}")
        
        return school_id, school_name
    
    def test_06_unassigned_school_not_in_schools_list(self):
        """Test: After unassigning, GET /api/support/schools should NOT include the unassigned school"""
        # Get schools before unassign
        schools_before = self.session.get(f"{BASE_URL}/api/support/schools").json()
        
        if not schools_before:
            pytest.skip("No schools available to test")
        
        # Pick a school to unassign
        test_school = schools_before[0]
        school_id = test_school.get("id")
        school_name = test_school.get("name", test_school.get("subdomain"))
        
        # Unassign
        self.session.delete(f"{BASE_URL}/api/support/unassign-school/{school_id}")
        
        # Get schools after unassign
        schools_after = self.session.get(f"{BASE_URL}/api/support/schools").json()
        
        # Verify the unassigned school is NOT in the list
        school_ids_after = [s.get("id") for s in schools_after]
        assert school_id not in school_ids_after, f"School {school_name} should NOT be in schools list after unassign"
        
        print(f"✓ School '{school_name}' is NOT in /api/support/schools after unassign")
        print(f"  Schools before: {len(schools_before)}, Schools after: {len(schools_after)}")
        
        # Re-assign for cleanup
        self.session.post(f"{BASE_URL}/api/support/assign-school", json={"school_id": school_id})
        
        return school_id
    
    def test_07_unassigned_school_shows_in_all_schools_with_false(self):
        """Test: GET /api/support/all-schools should show unassigned school with is_assigned=false"""
        # Get all schools before
        all_schools_before = self.session.get(f"{BASE_URL}/api/support/all-schools").json()
        
        # Find an assigned school
        assigned_schools = [s for s in all_schools_before if s.get("is_assigned")]
        if not assigned_schools:
            pytest.skip("No assigned schools to test")
        
        test_school = assigned_schools[0]
        school_id = test_school.get("id")
        school_name = test_school.get("name", test_school.get("subdomain"))
        
        # Unassign
        self.session.delete(f"{BASE_URL}/api/support/unassign-school/{school_id}")
        
        # Get all schools after
        all_schools_after = self.session.get(f"{BASE_URL}/api/support/all-schools").json()
        
        # Find the school and verify is_assigned=false
        found_school = next((s for s in all_schools_after if s.get("id") == school_id), None)
        assert found_school is not None, f"School {school_name} should still appear in all-schools"
        assert found_school.get("is_assigned") == False, f"School {school_name} should have is_assigned=false"
        
        print(f"✓ School '{school_name}' shows in /api/support/all-schools with is_assigned=false")
        
        # Re-assign for cleanup
        self.session.post(f"{BASE_URL}/api/support/assign-school", json={"school_id": school_id})
        
        return school_id
    
    def test_08_reassign_previously_unassigned_school(self):
        """Test: POST /api/support/assign-school can re-assign a previously unassigned school"""
        # Get schools and unassign one
        schools_before = self.session.get(f"{BASE_URL}/api/support/schools").json()
        
        if not schools_before:
            pytest.skip("No schools available")
        
        test_school = schools_before[0]
        school_id = test_school.get("id")
        school_name = test_school.get("name", test_school.get("subdomain"))
        
        # Unassign
        unassign_response = self.session.delete(f"{BASE_URL}/api/support/unassign-school/{school_id}")
        assert unassign_response.status_code == 200
        
        # Verify unassigned
        schools_after_unassign = self.session.get(f"{BASE_URL}/api/support/schools").json()
        assert school_id not in [s.get("id") for s in schools_after_unassign]
        
        # Re-assign
        reassign_response = self.session.post(f"{BASE_URL}/api/support/assign-school", json={"school_id": school_id})
        assert reassign_response.status_code == 200, f"Expected 200, got {reassign_response.status_code}: {reassign_response.text}"
        
        data = reassign_response.json()
        assert "message" in data, "Response should have message"
        print(f"✓ POST /api/support/assign-school reassigned: {data.get('message')}")
        
        return school_id
    
    def test_09_after_reassign_school_appears_back(self):
        """Test: After re-assigning, the school appears back in the list"""
        # Get schools
        schools = self.session.get(f"{BASE_URL}/api/support/schools").json()
        
        if not schools:
            pytest.skip("No schools available")
        
        test_school = schools[0]
        school_id = test_school.get("id")
        school_name = test_school.get("name", test_school.get("subdomain"))
        
        # Unassign
        self.session.delete(f"{BASE_URL}/api/support/unassign-school/{school_id}")
        
        # Verify removed
        schools_removed = self.session.get(f"{BASE_URL}/api/support/schools").json()
        assert school_id not in [s.get("id") for s in schools_removed], "School should be removed"
        
        # Re-assign
        self.session.post(f"{BASE_URL}/api/support/assign-school", json={"school_id": school_id})
        
        # Verify back
        schools_reassigned = self.session.get(f"{BASE_URL}/api/support/schools").json()
        assert school_id in [s.get("id") for s in schools_reassigned], f"School {school_name} should be back in the list"
        
        print(f"✓ School '{school_name}' appears back in list after reassignment")
    
    def test_10_overview_count_updates_after_unassign(self):
        """Test: GET /api/support/overview shows correct count (minus unassigned)"""
        # Get initial overview
        overview_before = self.session.get(f"{BASE_URL}/api/support/overview").json()
        initial_count = overview_before.get("my_assigned_schools", 0)
        
        # Get schools and unassign one
        schools = self.session.get(f"{BASE_URL}/api/support/schools").json()
        
        if not schools:
            pytest.skip("No schools to test")
        
        test_school = schools[0]
        school_id = test_school.get("id")
        
        # Unassign
        self.session.delete(f"{BASE_URL}/api/support/unassign-school/{school_id}")
        
        # Get overview after
        overview_after = self.session.get(f"{BASE_URL}/api/support/overview").json()
        new_count = overview_after.get("my_assigned_schools", 0)
        
        # Verify count decreased
        assert new_count == initial_count - 1, f"Expected count to decrease from {initial_count} to {initial_count - 1}, got {new_count}"
        
        print(f"✓ Overview count updated: {initial_count} -> {new_count} after unassign")
        
        # Cleanup: re-assign
        self.session.post(f"{BASE_URL}/api/support/assign-school", json={"school_id": school_id})
        
        # Verify count restored
        overview_final = self.session.get(f"{BASE_URL}/api/support/overview").json()
        final_count = overview_final.get("my_assigned_schools", 0)
        assert final_count == initial_count, f"Expected count to restore to {initial_count}, got {final_count}"
        
        print(f"✓ Overview count restored: {new_count} -> {final_count} after re-assign")
    
    def test_11_auto_assign_does_not_recreate_unassigned(self):
        """Test: Auto-assign logic should NOT re-create explicitly unassigned schools"""
        # Get schools
        schools = self.session.get(f"{BASE_URL}/api/support/schools").json()
        
        if not schools:
            pytest.skip("No schools to test")
        
        test_school = schools[0]
        school_id = test_school.get("id")
        school_name = test_school.get("name", test_school.get("subdomain"))
        
        # Unassign
        self.session.delete(f"{BASE_URL}/api/support/unassign-school/{school_id}")
        
        # Call /schools again (this triggers auto-assign logic for global admins)
        schools_after_call = self.session.get(f"{BASE_URL}/api/support/schools").json()
        
        # Verify the unassigned school is STILL NOT in the list
        assert school_id not in [s.get("id") for s in schools_after_call], \
            f"Auto-assign should NOT re-add explicitly unassigned school '{school_name}'"
        
        print(f"✓ Auto-assign did NOT re-create unassigned school '{school_name}'")
        
        # Cleanup
        self.session.post(f"{BASE_URL}/api/support/assign-school", json={"school_id": school_id})


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
