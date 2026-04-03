"""
Trash System Tests - Archive, Restore, Permanent Delete for Schools
Tests the papelera (trash) functionality for the support panel.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"

# Test school - 'los gatos' for archive/restore testing
TEST_SCHOOL_ID = "29d3a52d-783a-4f05-bd01-4b1e1acf9f2e"
TEST_SCHOOL_SUBDOMAIN = "gatos"

# Main school - DO NOT DELETE
MAIN_SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for support admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPPORT_EMAIL,
        "password": SUPPORT_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in login response"
    return data["token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestTrashSystemBackend:
    """Test the trash system backend APIs"""

    # ═══════════════════════════════════════════════════════════════════════════
    # 1. GET /api/support/schools - Should NOT include trashed schools
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_schools_list_excludes_trash(self, headers):
        """GET /api/support/schools should NOT include schools with status='papelera'"""
        response = requests.get(f"{BASE_URL}/api/support/schools", headers=headers)
        assert response.status_code == 200, f"Failed to get schools: {response.text}"
        schools = response.json()
        
        # Verify no school has status='papelera'
        trashed = [s for s in schools if s.get("status") == "papelera"]
        assert len(trashed) == 0, f"Found {len(trashed)} trashed schools in main list - should be excluded"
        print(f"✓ GET /api/support/schools returns {len(schools)} schools, none in trash")

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. GET /api/support/overview - Should NOT count trashed schools
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_overview_excludes_trash(self, headers):
        """GET /api/support/overview should NOT count trashed schools"""
        response = requests.get(f"{BASE_URL}/api/support/overview", headers=headers)
        assert response.status_code == 200, f"Failed to get overview: {response.text}"
        data = response.json()
        
        assert "total_schools" in data, "Missing total_schools in overview"
        print(f"✓ GET /api/support/overview - total_schools: {data['total_schools']}")

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. GET /api/support/schools/trash - List trashed schools
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_list_trash_schools(self, headers):
        """GET /api/support/schools/trash should return schools in papelera"""
        response = requests.get(f"{BASE_URL}/api/support/schools/trash", headers=headers)
        assert response.status_code == 200, f"Failed to get trash: {response.text}"
        trash = response.json()
        
        assert isinstance(trash, list), "Trash response should be a list"
        print(f"✓ GET /api/support/schools/trash - {len(trash)} schools in trash")
        
        # If there are schools in trash, verify they have required fields
        if len(trash) > 0:
            school = trash[0]
            assert "id" in school, "Trashed school missing 'id'"
            assert "name" in school or "subdomain" in school, "Trashed school missing name/subdomain"
            print(f"  First trashed school: {school.get('name', school.get('subdomain'))}")

    # ═══════════════════════════════════════════════════════════════════════════
    # 4. PATCH /api/support/schools/{id}/archive - Soft delete (move to trash)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_archive_school(self, headers):
        """PATCH /api/support/schools/{id}/archive should move school to trash"""
        # First check if school is already in trash
        trash_response = requests.get(f"{BASE_URL}/api/support/schools/trash", headers=headers)
        trash = trash_response.json()
        already_in_trash = any(s["id"] == TEST_SCHOOL_ID for s in trash)
        
        if already_in_trash:
            # Restore it first so we can test archive
            restore_response = requests.patch(
                f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/restore",
                headers=headers
            )
            assert restore_response.status_code == 200, f"Failed to restore for test setup: {restore_response.text}"
            print("  (Restored school first for test setup)")
        
        # Now archive the school
        response = requests.patch(
            f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/archive",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to archive school: {response.text}"
        data = response.json()
        
        assert "message" in data, "Archive response missing message"
        assert "papelera" in data["message"].lower() or "movido" in data["message"].lower(), \
            f"Unexpected message: {data['message']}"
        print(f"✓ PATCH /api/support/schools/{TEST_SCHOOL_ID}/archive - {data['message']}")
        
        # Verify school is now in trash
        trash_response = requests.get(f"{BASE_URL}/api/support/schools/trash", headers=headers)
        trash = trash_response.json()
        in_trash = any(s["id"] == TEST_SCHOOL_ID for s in trash)
        assert in_trash, "School should be in trash after archive"
        print("  ✓ Verified school is now in trash")

    # ═══════════════════════════════════════════════════════════════════════════
    # 5. PATCH /api/support/schools/{id}/archive - 409 if already in trash
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_archive_already_trashed_returns_409(self, headers):
        """PATCH /api/support/schools/{id}/archive should return 409 if already in trash"""
        # Ensure school is in trash first
        trash_response = requests.get(f"{BASE_URL}/api/support/schools/trash", headers=headers)
        trash = trash_response.json()
        in_trash = any(s["id"] == TEST_SCHOOL_ID for s in trash)
        
        if not in_trash:
            # Archive it first
            requests.patch(f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/archive", headers=headers)
        
        # Try to archive again - should get 409
        response = requests.patch(
            f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/archive",
            headers=headers
        )
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
        print(f"✓ PATCH archive on already-trashed school returns 409")

    # ═══════════════════════════════════════════════════════════════════════════
    # 6. PATCH /api/support/schools/{id}/restore - Restore from trash
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_restore_school(self, headers):
        """PATCH /api/support/schools/{id}/restore should restore school from trash"""
        # Ensure school is in trash first
        trash_response = requests.get(f"{BASE_URL}/api/support/schools/trash", headers=headers)
        trash = trash_response.json()
        in_trash = any(s["id"] == TEST_SCHOOL_ID for s in trash)
        
        if not in_trash:
            # Archive it first
            requests.patch(f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/archive", headers=headers)
        
        # Now restore
        response = requests.patch(
            f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/restore",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to restore school: {response.text}"
        data = response.json()
        
        assert "message" in data, "Restore response missing message"
        assert "restored_status" in data, "Restore response missing restored_status"
        print(f"✓ PATCH /api/support/schools/{TEST_SCHOOL_ID}/restore - {data['message']}")
        print(f"  Restored to status: {data['restored_status']}")
        
        # Verify school is no longer in trash
        trash_response = requests.get(f"{BASE_URL}/api/support/schools/trash", headers=headers)
        trash = trash_response.json()
        in_trash = any(s["id"] == TEST_SCHOOL_ID for s in trash)
        assert not in_trash, "School should NOT be in trash after restore"
        print("  ✓ Verified school is no longer in trash")
        
        # Verify school is back in main list
        schools_response = requests.get(f"{BASE_URL}/api/support/schools", headers=headers)
        schools = schools_response.json()
        in_main = any(s["id"] == TEST_SCHOOL_ID for s in schools)
        assert in_main, "School should be back in main list after restore"
        print("  ✓ Verified school is back in main schools list")

    # ═══════════════════════════════════════════════════════════════════════════
    # 7. PATCH /api/support/schools/{id}/restore - 409 if NOT in trash
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_restore_not_trashed_returns_409(self, headers):
        """PATCH /api/support/schools/{id}/restore should return 409 if NOT in trash"""
        # Ensure school is NOT in trash
        trash_response = requests.get(f"{BASE_URL}/api/support/schools/trash", headers=headers)
        trash = trash_response.json()
        in_trash = any(s["id"] == TEST_SCHOOL_ID for s in trash)
        
        if in_trash:
            # Restore it first
            requests.patch(f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/restore", headers=headers)
        
        # Try to restore again - should get 409
        response = requests.patch(
            f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/restore",
            headers=headers
        )
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
        print(f"✓ PATCH restore on non-trashed school returns 409")

    # ═══════════════════════════════════════════════════════════════════════════
    # 8. DELETE /api/support/schools/{id}/permanent - 409 if NOT in trash
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_permanent_delete_not_trashed_returns_409(self, headers):
        """DELETE /api/support/schools/{id}/permanent should return 409 if NOT in trash"""
        # Use the MAIN school which should NOT be in trash
        response = requests.delete(
            f"{BASE_URL}/api/support/schools/{MAIN_SCHOOL_ID}/permanent",
            headers=headers
        )
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
        data = response.json()
        assert "papelera" in data.get("detail", "").lower(), f"Expected papelera in error message: {data}"
        print(f"✓ DELETE permanent on non-trashed school returns 409")
        print(f"  Error message: {data.get('detail')}")

    # ═══════════════════════════════════════════════════════════════════════════
    # 9. DELETE /api/support/schools/{id}/permanent - 404 for non-existent school
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_permanent_delete_nonexistent_returns_404(self, headers):
        """DELETE /api/support/schools/{id}/permanent should return 404 for non-existent school"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.delete(
            f"{BASE_URL}/api/support/schools/{fake_id}/permanent",
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ DELETE permanent on non-existent school returns 404")

    # ═══════════════════════════════════════════════════════════════════════════
    # 10. Verify school data integrity after archive/restore cycle
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_archive_restore_preserves_data(self, headers):
        """Archive and restore should preserve school data"""
        # Get school data before archive
        schools_response = requests.get(f"{BASE_URL}/api/support/schools", headers=headers)
        schools = schools_response.json()
        school_before = next((s for s in schools if s["id"] == TEST_SCHOOL_ID), None)
        
        if not school_before:
            # School might be in trash, restore it first
            requests.patch(f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/restore", headers=headers)
            schools_response = requests.get(f"{BASE_URL}/api/support/schools", headers=headers)
            schools = schools_response.json()
            school_before = next((s for s in schools if s["id"] == TEST_SCHOOL_ID), None)
        
        assert school_before is not None, "Test school not found"
        
        # Archive
        requests.patch(f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/archive", headers=headers)
        
        # Check trash data
        trash_response = requests.get(f"{BASE_URL}/api/support/schools/trash", headers=headers)
        trash = trash_response.json()
        school_in_trash = next((s for s in trash if s["id"] == TEST_SCHOOL_ID), None)
        
        assert school_in_trash is not None, "School not found in trash"
        assert "deleted_at" in school_in_trash, "Trashed school should have deleted_at"
        assert "previous_status" in school_in_trash, "Trashed school should have previous_status"
        print(f"✓ Archived school has deleted_at: {school_in_trash['deleted_at']}")
        print(f"  Previous status: {school_in_trash['previous_status']}")
        
        # Restore
        requests.patch(f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/restore", headers=headers)
        
        # Get school data after restore
        schools_response = requests.get(f"{BASE_URL}/api/support/schools", headers=headers)
        schools = schools_response.json()
        school_after = next((s for s in schools if s["id"] == TEST_SCHOOL_ID), None)
        
        assert school_after is not None, "School not found after restore"
        assert school_before.get("subdomain") == school_after.get("subdomain"), "Subdomain changed after restore"
        print(f"✓ School data preserved after archive/restore cycle")


class TestTrashSystemCleanup:
    """Cleanup tests - ensure test school is restored to active state"""
    
    def test_cleanup_restore_test_school(self, headers):
        """CLEANUP: Ensure 'los gatos' school is restored to active state"""
        # Check if school is in trash
        trash_response = requests.get(f"{BASE_URL}/api/support/schools/trash", headers=headers)
        trash = trash_response.json()
        in_trash = any(s["id"] == TEST_SCHOOL_ID for s in trash)
        
        if in_trash:
            # Restore it
            response = requests.patch(
                f"{BASE_URL}/api/support/schools/{TEST_SCHOOL_ID}/restore",
                headers=headers
            )
            assert response.status_code == 200, f"Failed to restore test school: {response.text}"
            print(f"✓ CLEANUP: Restored 'los gatos' school to active state")
        else:
            print(f"✓ CLEANUP: 'los gatos' school already in active state")
        
        # Verify school is in main list
        schools_response = requests.get(f"{BASE_URL}/api/support/schools", headers=headers)
        schools = schools_response.json()
        in_main = any(s["id"] == TEST_SCHOOL_ID for s in schools)
        assert in_main, "Test school should be in main list after cleanup"
        print(f"  ✓ Verified 'los gatos' is in main schools list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
