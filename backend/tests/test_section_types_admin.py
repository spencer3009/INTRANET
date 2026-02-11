"""
Test module for Section Types Admin Modal functionality
Tests:
1. PUT /api/academic/section-types/{id} - update label and activo status
2. PUT /api/academic/section-types/reorder - reorder types
3. DELETE /api/academic/section-types/{id} - soft-delete (set activo=false)
4. Cannot deactivate a type that is in use by existing sections
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"


class TestSectionTypesAdminModule:
    """Test section types admin CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.created_types = []  # Track created types for cleanup
        
    def _login(self):
        """Login and get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        return data
    
    def _cleanup_created_types(self):
        """Cleanup types created during tests"""
        for type_id in self.created_types:
            try:
                # Hard delete by setting activo=false (soft delete)
                self.session.delete(f"{BASE_URL}/api/academic/section-types/{type_id}")
            except:
                pass
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: Authentication
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_login_success(self):
        """Test login with provided credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: GET /api/academic/section-types (baseline)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_02_get_section_types_baseline(self):
        """Test GET /api/academic/section-types returns the catalog"""
        self._login()
        
        response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        assert response.status_code == 200, f"Failed to get section types: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 7, f"Expected at least 7 section types, got {len(data)}"
        
        print(f"✓ GET /api/academic/section-types returned {len(data)} types")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: POST /api/academic/section-types (create new type for testing)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_03_create_section_type_for_testing(self):
        """Create a new section type for subsequent tests"""
        self._login()
        
        payload = {
            "key": "TEST_X",
            "label": "Test X"
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/section-types", json=payload)
        assert response.status_code == 200, f"Failed to create section type: {response.text}"
        
        data = response.json()
        assert "section_type" in data, "Response missing 'section_type'"
        
        section_type = data["section_type"]
        assert section_type["key"] == "TEST_X"
        assert section_type["label"] == "Test X"
        assert section_type["activo"] == True
        
        self.created_types.append(section_type["id"])
        print(f"✓ Created test section type: {section_type['label']} (id: {section_type['id']})")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: PUT /api/academic/section-types/{id} - Update label
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_04_update_section_type_label(self):
        """Test PUT /api/academic/section-types/{id} updates label"""
        self._login()
        
        # First create a test type
        create_response = self.session.post(f"{BASE_URL}/api/academic/section-types", json={
            "key": "TEST_LABEL",
            "label": "Original Label"
        })
        assert create_response.status_code == 200, f"Failed to create: {create_response.text}"
        
        type_id = create_response.json()["section_type"]["id"]
        self.created_types.append(type_id)
        
        # Update the label
        update_response = self.session.put(
            f"{BASE_URL}/api/academic/section-types/{type_id}",
            json={"label": "Updated Label"}
        )
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        data = update_response.json()
        assert "section_type" in data, "Response missing 'section_type'"
        assert data["section_type"]["label"] == "Updated Label", "Label not updated"
        
        # Verify by GET
        get_response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        types = get_response.json()
        updated_type = next((t for t in types if t["id"] == type_id), None)
        assert updated_type is not None, "Updated type not found"
        assert updated_type["label"] == "Updated Label", "Label not persisted"
        
        print(f"✓ PUT /api/academic/section-types/{type_id} updated label successfully")
        
        # Cleanup
        self._cleanup_created_types()
    
    def test_05_update_section_type_activo_status(self):
        """Test PUT /api/academic/section-types/{id} updates activo status"""
        self._login()
        
        # Create a test type
        create_response = self.session.post(f"{BASE_URL}/api/academic/section-types", json={
            "key": "TEST_ACTIVO",
            "label": "Test Activo"
        })
        assert create_response.status_code == 200
        
        type_id = create_response.json()["section_type"]["id"]
        self.created_types.append(type_id)
        
        # Deactivate the type
        update_response = self.session.put(
            f"{BASE_URL}/api/academic/section-types/{type_id}",
            json={"activo": False}
        )
        assert update_response.status_code == 200, f"Failed to deactivate: {update_response.text}"
        
        data = update_response.json()
        assert data["section_type"]["activo"] == False, "activo not updated to False"
        
        # Reactivate the type
        reactivate_response = self.session.put(
            f"{BASE_URL}/api/academic/section-types/{type_id}",
            json={"activo": True}
        )
        assert reactivate_response.status_code == 200
        assert reactivate_response.json()["section_type"]["activo"] == True
        
        print(f"✓ PUT /api/academic/section-types/{type_id} toggle activo works correctly")
        
        # Cleanup
        self._cleanup_created_types()
    
    def test_06_update_nonexistent_type_returns_404(self):
        """Test PUT /api/academic/section-types/{id} with invalid ID returns 404"""
        self._login()
        
        response = self.session.put(
            f"{BASE_URL}/api/academic/section-types/nonexistent-id-12345",
            json={"label": "Test"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ PUT with nonexistent ID correctly returns 404")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: PUT /api/academic/section-types/reorder
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_07_reorder_section_types(self):
        """Test PUT /api/academic/section-types/reorder changes order"""
        self._login()
        
        # Get current types
        get_response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        assert get_response.status_code == 200
        
        types = get_response.json()
        assert len(types) >= 2, "Need at least 2 types to test reorder"
        
        # Get original order
        original_order = [t["id"] for t in types]
        
        # Reverse the order
        reversed_order = list(reversed(original_order))
        
        # Reorder
        reorder_response = self.session.put(
            f"{BASE_URL}/api/academic/section-types/reorder",
            json={"order": reversed_order}
        )
        assert reorder_response.status_code == 200, f"Failed to reorder: {reorder_response.text}"
        
        data = reorder_response.json()
        assert "section_types" in data, "Response missing 'section_types'"
        
        # Verify new order
        new_types = data["section_types"]
        new_order = [t["id"] for t in new_types]
        
        # Check that orden values are updated
        for idx, t in enumerate(new_types):
            assert t["orden"] == idx + 1, f"Type {t['key']} has wrong orden: expected {idx + 1}, got {t['orden']}"
        
        print(f"✓ PUT /api/academic/section-types/reorder successfully reordered {len(types)} types")
        
        # Restore original order
        self.session.put(
            f"{BASE_URL}/api/academic/section-types/reorder",
            json={"order": original_order}
        )
    
    def test_08_reorder_with_partial_ids(self):
        """Test reorder with only some IDs (should update only those)"""
        self._login()
        
        # Get current types
        get_response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        types = get_response.json()
        
        if len(types) < 3:
            pytest.skip("Need at least 3 types to test partial reorder")
        
        # Reorder only first 3
        partial_order = [types[2]["id"], types[0]["id"], types[1]["id"]]
        
        reorder_response = self.session.put(
            f"{BASE_URL}/api/academic/section-types/reorder",
            json={"order": partial_order}
        )
        assert reorder_response.status_code == 200
        
        print("✓ Partial reorder works correctly")
        
        # Restore original order
        original_order = [t["id"] for t in types]
        self.session.put(
            f"{BASE_URL}/api/academic/section-types/reorder",
            json={"order": original_order}
        )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: DELETE /api/academic/section-types/{id} (soft-delete)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_09_delete_section_type_soft_deletes(self):
        """Test DELETE /api/academic/section-types/{id} sets activo=false"""
        self._login()
        
        # Create a test type
        create_response = self.session.post(f"{BASE_URL}/api/academic/section-types", json={
            "key": "TEST_DELETE",
            "label": "Test Delete"
        })
        assert create_response.status_code == 200
        
        type_id = create_response.json()["section_type"]["id"]
        
        # Delete (soft-delete)
        delete_response = self.session.delete(f"{BASE_URL}/api/academic/section-types/{type_id}")
        assert delete_response.status_code == 200, f"Failed to delete: {delete_response.text}"
        
        # Verify it's deactivated (not hard deleted)
        get_response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        types = get_response.json()
        deleted_type = next((t for t in types if t["id"] == type_id), None)
        
        # The type should still exist but be inactive
        assert deleted_type is not None, "Type was hard deleted instead of soft deleted"
        assert deleted_type["activo"] == False, "Type should be inactive after delete"
        
        print(f"✓ DELETE /api/academic/section-types/{type_id} soft-deleted (activo=false)")
    
    def test_10_delete_nonexistent_type_returns_404(self):
        """Test DELETE /api/academic/section-types/{id} with invalid ID returns 404"""
        self._login()
        
        response = self.session.delete(f"{BASE_URL}/api/academic/section-types/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ DELETE with nonexistent ID correctly returns 404")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: Cannot deactivate type in use by sections
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_11_cannot_deactivate_type_in_use(self):
        """Test that deactivating a type in use by sections fails"""
        self._login()
        
        # Get existing sections
        sections_response = self.session.get(f"{BASE_URL}/api/academic/sections")
        sections = sections_response.json()
        
        if not sections:
            pytest.skip("No sections exist to test this scenario")
        
        # Find a section with a section_type_id
        section_with_type = next((s for s in sections if s.get("section_type_id")), None)
        
        if not section_with_type:
            pytest.skip("No sections with section_type_id found")
        
        type_id = section_with_type["section_type_id"]
        
        # Try to deactivate this type
        update_response = self.session.put(
            f"{BASE_URL}/api/academic/section-types/{type_id}",
            json={"activo": False}
        )
        
        # Should fail with 400
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}"
        
        error_data = update_response.json()
        assert "detail" in error_data
        assert "secciones" in error_data["detail"].lower() or "sections" in error_data["detail"].lower()
        
        print(f"✓ Cannot deactivate type '{type_id}' that is in use by sections")
    
    def test_12_cannot_delete_type_in_use(self):
        """Test that deleting a type in use by sections fails"""
        self._login()
        
        # Get existing sections
        sections_response = self.session.get(f"{BASE_URL}/api/academic/sections")
        sections = sections_response.json()
        
        if not sections:
            pytest.skip("No sections exist to test this scenario")
        
        # Find a section with a section_type_id
        section_with_type = next((s for s in sections if s.get("section_type_id")), None)
        
        if not section_with_type:
            pytest.skip("No sections with section_type_id found")
        
        type_id = section_with_type["section_type_id"]
        
        # Try to delete this type
        delete_response = self.session.delete(f"{BASE_URL}/api/academic/section-types/{type_id}")
        
        # Should fail with 400
        assert delete_response.status_code == 400, f"Expected 400, got {delete_response.status_code}"
        
        error_data = delete_response.json()
        assert "detail" in error_data
        assert "secciones" in error_data["detail"].lower() or "sections" in error_data["detail"].lower()
        
        print(f"✓ Cannot delete type '{type_id}' that is in use by sections")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: Update both label and activo in single request
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_13_update_label_and_activo_together(self):
        """Test updating both label and activo in a single PUT request"""
        self._login()
        
        # Create a test type
        create_response = self.session.post(f"{BASE_URL}/api/academic/section-types", json={
            "key": "TEST_BOTH",
            "label": "Original"
        })
        assert create_response.status_code == 200
        
        type_id = create_response.json()["section_type"]["id"]
        self.created_types.append(type_id)
        
        # Update both fields
        update_response = self.session.put(
            f"{BASE_URL}/api/academic/section-types/{type_id}",
            json={"label": "New Label", "activo": False}
        )
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["section_type"]["label"] == "New Label"
        assert data["section_type"]["activo"] == False
        
        print("✓ Can update both label and activo in single request")
        
        # Cleanup
        self._cleanup_created_types()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
