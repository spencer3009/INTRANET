"""
Test suite for the Discount System (Sistema de Descuentos y Pensiones Variables)
Tests discount types CRUD, student discount assignment, pension calculation, and sibling detection.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://safe-blob-handler.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"

# Test student with siblings: Pepito Peres Rios
# Parent: Miguel Sandoval Diaz (has 3 children)


class TestDiscountSystem:
    """Test suite for discount types and student discounts"""
    
    token = None
    created_discount_type_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before tests"""
        if not TestDiscountSystem.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestDiscountSystem.token = data.get("token")
        self.headers = {"Authorization": f"Bearer {TestDiscountSystem.token}"}
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DISCOUNT TYPES CRUD TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_get_discount_types_returns_seed_types(self):
        """GET /api/accounting/discount-types should return 4 seed discount types"""
        response = requests.get(f"{BASE_URL}/api/accounting/discount-types", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 4, f"Expected at least 4 seed discount types, got {len(data)}"
        
        # Verify seed types exist
        names = [dt["name"] for dt in data]
        assert "Descuento por hermanos" in names, "Missing 'Descuento por hermanos' seed type"
        assert "Primeros puestos" in names, "Missing 'Primeros puestos' seed type"
        assert "Bajos recursos" in names, "Missing 'Bajos recursos' seed type"
        assert "Beca completa" in names, "Missing 'Beca completa' seed type"
        
        # Verify structure of discount types
        sibling_discount = next((dt for dt in data if dt["name"] == "Descuento por hermanos"), None)
        assert sibling_discount is not None
        assert sibling_discount["application_mode"] == "automatic"
        assert sibling_discount["automatic_rule"] == "has_active_siblings"
        assert sibling_discount["discount_type"] == "percentage"
        assert sibling_discount["value"] == 10
        assert sibling_discount["is_active"] == True
        print(f"SUCCESS: Found {len(data)} discount types including 4 seed types")
    
    def test_02_create_discount_type_manual(self):
        """POST /api/accounting/discount-types - create a new manual discount type"""
        payload = {
            "name": "TEST_Descuento Especial",
            "description": "Descuento de prueba para testing",
            "discount_type": "percentage",
            "value": 20,
            "application_mode": "manual",
            "is_active": True
        }
        response = requests.post(f"{BASE_URL}/api/accounting/discount-types", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Failed to create discount type: {response.text}"
        
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["discount_type"] == "percentage"
        assert data["value"] == 20
        assert data["application_mode"] == "manual"
        assert "id" in data
        
        TestDiscountSystem.created_discount_type_id = data["id"]
        print(f"SUCCESS: Created discount type with ID: {data['id']}")
    
    def test_03_create_discount_type_fixed_amount(self):
        """POST /api/accounting/discount-types - create fixed amount discount"""
        payload = {
            "name": "TEST_Descuento Fijo",
            "description": "Descuento de monto fijo",
            "discount_type": "fixed_amount",
            "value": 50,
            "application_mode": "manual",
            "is_active": True
        }
        response = requests.post(f"{BASE_URL}/api/accounting/discount-types", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["discount_type"] == "fixed_amount"
        assert data["value"] == 50
        print(f"SUCCESS: Created fixed amount discount type")
    
    def test_04_update_discount_type(self):
        """PUT /api/accounting/discount-types/{id} - update a discount type"""
        if not TestDiscountSystem.created_discount_type_id:
            pytest.skip("No discount type created to update")
        
        payload = {
            "value": 25,
            "description": "Descripcion actualizada"
        }
        response = requests.put(
            f"{BASE_URL}/api/accounting/discount-types/{TestDiscountSystem.created_discount_type_id}",
            json=payload,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to update: {response.text}"
        
        data = response.json()
        assert data["value"] == 25
        assert data["description"] == "Descripcion actualizada"
        print(f"SUCCESS: Updated discount type value to 25%")
    
    def test_05_create_duplicate_name_fails(self):
        """POST /api/accounting/discount-types - duplicate name should fail with 409"""
        payload = {
            "name": "Descuento por hermanos",  # Already exists as seed
            "discount_type": "percentage",
            "value": 5,
            "application_mode": "manual"
        }
        response = requests.post(f"{BASE_URL}/api/accounting/discount-types", json=payload, headers=self.headers)
        assert response.status_code == 409, f"Expected 409 for duplicate name, got {response.status_code}"
        print("SUCCESS: Duplicate name correctly rejected with 409")
    
    def test_06_percentage_over_100_fails(self):
        """POST /api/accounting/discount-types - percentage > 100 should fail"""
        payload = {
            "name": "TEST_Invalid Percentage",
            "discount_type": "percentage",
            "value": 150,
            "application_mode": "manual"
        }
        response = requests.post(f"{BASE_URL}/api/accounting/discount-types", json=payload, headers=self.headers)
        assert response.status_code == 400, f"Expected 400 for invalid percentage, got {response.status_code}"
        print("SUCCESS: Percentage > 100 correctly rejected with 400")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SIBLING DISCOUNT SYNC TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_07_sync_sibling_discounts(self):
        """POST /api/accounting/discounts/sync - sync sibling discounts"""
        response = requests.post(f"{BASE_URL}/api/accounting/discounts/sync", json={}, headers=self.headers)
        assert response.status_code == 200, f"Failed to sync: {response.text}"
        
        data = response.json()
        assert "assigned" in data
        assert "removed" in data
        assert "families_processed" in data or "message" in data
        print(f"SUCCESS: Sync completed - assigned: {data.get('assigned', 0)}, removed: {data.get('removed', 0)}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STUDENT DISCOUNTS TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_08_find_student_with_siblings(self):
        """Find Pepito Peres Rios (student with siblings)"""
        response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert response.status_code == 200
        
        users = response.json()
        students = [u for u in users if u.get("role") == "student"]
        
        # Find Pepito Peres Rios
        pepito = next((s for s in students if "Pepito" in s.get("name", "") or "Peres" in s.get("last_name", "")), None)
        
        if pepito:
            TestDiscountSystem.test_student_id = pepito["id"]
            print(f"SUCCESS: Found test student: {pepito.get('name')} {pepito.get('last_name')} (ID: {pepito['id']})")
        else:
            # Use first active student as fallback
            active_students = [s for s in students if s.get("student_status") in ["active", "activo", "enrolled", "matriculado"]]
            if active_students:
                TestDiscountSystem.test_student_id = active_students[0]["id"]
                print(f"FALLBACK: Using student: {active_students[0].get('name')} {active_students[0].get('last_name')}")
            else:
                pytest.skip("No active students found")
    
    def test_09_get_student_siblings(self):
        """GET /api/accounting/students/{id}/siblings - get sibling info"""
        if not hasattr(TestDiscountSystem, 'test_student_id'):
            pytest.skip("No test student found")
        
        response = requests.get(
            f"{BASE_URL}/api/accounting/students/{TestDiscountSystem.test_student_id}/siblings",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "student_id" in data
        assert "siblings" in data
        assert "active_siblings_count" in data
        assert "has_parent_linked" in data
        assert "qualifies_for_sibling_discount" in data
        
        print(f"SUCCESS: Student has {data['active_siblings_count']} active siblings, parent linked: {data['has_parent_linked']}")
        if data["siblings"]:
            for sib in data["siblings"]:
                print(f"  - Sibling: {sib.get('name')} {sib.get('last_name')}")
    
    def test_10_get_student_discounts(self):
        """GET /api/accounting/students/{id}/discounts - get student's assigned discounts"""
        if not hasattr(TestDiscountSystem, 'test_student_id'):
            pytest.skip("No test student found")
        
        response = requests.get(
            f"{BASE_URL}/api/accounting/students/{TestDiscountSystem.test_student_id}/discounts",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "student_id" in data
        assert "student_name" in data
        assert "discounts" in data
        
        print(f"SUCCESS: Student {data['student_name']} has {len(data['discounts'])} discounts")
        for d in data["discounts"]:
            print(f"  - {d.get('type_name')}: {d.get('discount_type')} = {d.get('default_value')} ({d.get('application_mode')})")
    
    def test_11_get_student_pension(self):
        """GET /api/accounting/students/{id}/pension - get pension calculation with discounts"""
        if not hasattr(TestDiscountSystem, 'test_student_id'):
            pytest.skip("No test student found")
        
        response = requests.get(
            f"{BASE_URL}/api/accounting/students/{TestDiscountSystem.test_student_id}/pension",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "student_id" in data
        assert "base_pension" in data
        assert "discounts" in data
        assert "total_discount" in data
        assert "final_pension" in data
        
        print(f"SUCCESS: Pension calculation:")
        print(f"  Base pension: S/ {data['base_pension']}")
        print(f"  Total discount: S/ {data['total_discount']}")
        print(f"  Final pension: S/ {data['final_pension']}")
        
        if data["discounts"]:
            print("  Discounts applied:")
            for d in data["discounts"]:
                print(f"    - {d['name']}: -{d['amount']} ({d['type']} = {d['value']})")
    
    def test_12_assign_manual_discount_to_student(self):
        """POST /api/accounting/students/{id}/discounts - assign manual discount"""
        if not hasattr(TestDiscountSystem, 'test_student_id'):
            pytest.skip("No test student found")
        if not TestDiscountSystem.created_discount_type_id:
            pytest.skip("No discount type created")
        
        payload = {
            "discount_type_id": TestDiscountSystem.created_discount_type_id
        }
        response = requests.post(
            f"{BASE_URL}/api/accounting/students/{TestDiscountSystem.test_student_id}/discounts",
            json=payload,
            headers=self.headers
        )
        
        # Could be 200 (success) or 409 (already assigned)
        if response.status_code == 200:
            data = response.json()
            assert "discount" in data
            TestDiscountSystem.assigned_discount_id = data["discount"]["id"]
            print(f"SUCCESS: Assigned discount to student")
        elif response.status_code == 409:
            print("INFO: Discount already assigned to student (409)")
        else:
            assert False, f"Unexpected status: {response.status_code} - {response.text}"
    
    def test_13_cannot_assign_automatic_discount_manually(self):
        """POST /api/accounting/students/{id}/discounts - cannot assign automatic discount manually"""
        if not hasattr(TestDiscountSystem, 'test_student_id'):
            pytest.skip("No test student found")
        
        # Get the automatic sibling discount type
        response = requests.get(f"{BASE_URL}/api/accounting/discount-types", headers=self.headers)
        assert response.status_code == 200
        
        types = response.json()
        auto_type = next((t for t in types if t.get("application_mode") == "automatic"), None)
        
        if not auto_type:
            pytest.skip("No automatic discount type found")
        
        payload = {"discount_type_id": auto_type["id"]}
        response = requests.post(
            f"{BASE_URL}/api/accounting/students/{TestDiscountSystem.test_student_id}/discounts",
            json=payload,
            headers=self.headers
        )
        assert response.status_code == 400, f"Expected 400 for automatic discount, got {response.status_code}"
        print("SUCCESS: Cannot manually assign automatic discount (400)")
    
    def test_14_remove_manual_discount(self):
        """DELETE /api/accounting/students/{id}/discounts/{discountId} - remove manual discount"""
        if not hasattr(TestDiscountSystem, 'test_student_id'):
            pytest.skip("No test student found")
        if not hasattr(TestDiscountSystem, 'assigned_discount_id'):
            pytest.skip("No discount assigned to remove")
        
        response = requests.delete(
            f"{BASE_URL}/api/accounting/students/{TestDiscountSystem.test_student_id}/discounts/{TestDiscountSystem.assigned_discount_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to remove: {response.text}"
        print("SUCCESS: Removed manual discount from student")
    
    def test_15_cannot_remove_automatic_discount(self):
        """DELETE /api/accounting/students/{id}/discounts/{discountId} - cannot remove automatic discount"""
        if not hasattr(TestDiscountSystem, 'test_student_id'):
            pytest.skip("No test student found")
        
        # Get student's discounts to find an automatic one
        response = requests.get(
            f"{BASE_URL}/api/accounting/students/{TestDiscountSystem.test_student_id}/discounts",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        auto_discount = next((d for d in data.get("discounts", []) if d.get("origin") == "automatic"), None)
        
        if not auto_discount:
            print("INFO: No automatic discount assigned to this student - skipping test")
            pytest.skip("No automatic discount to test removal")
        
        response = requests.delete(
            f"{BASE_URL}/api/accounting/students/{TestDiscountSystem.test_student_id}/discounts/{auto_discount['id']}",
            headers=self.headers
        )
        assert response.status_code == 400, f"Expected 400 for automatic discount removal, got {response.status_code}"
        print("SUCCESS: Cannot remove automatic discount (400)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DELETE DISCOUNT TYPE TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_16_delete_discount_type_with_assignments_fails(self):
        """DELETE /api/accounting/discount-types/{id} - should fail if assigned to students"""
        # Get the sibling discount type (likely has assignments)
        response = requests.get(f"{BASE_URL}/api/accounting/discount-types", headers=self.headers)
        assert response.status_code == 200
        
        types = response.json()
        sibling_type = next((t for t in types if t.get("name") == "Descuento por hermanos"), None)
        
        if not sibling_type:
            pytest.skip("Sibling discount type not found")
        
        if sibling_type.get("assigned_count", 0) == 0:
            print("INFO: Sibling discount has no assignments - skipping test")
            pytest.skip("No assignments to test deletion failure")
        
        response = requests.delete(
            f"{BASE_URL}/api/accounting/discount-types/{sibling_type['id']}",
            headers=self.headers
        )
        assert response.status_code == 409, f"Expected 409 for assigned discount, got {response.status_code}"
        print(f"SUCCESS: Cannot delete discount type with {sibling_type.get('assigned_count')} assignments (409)")
    
    def test_17_delete_unassigned_discount_type(self):
        """DELETE /api/accounting/discount-types/{id} - delete unassigned discount type"""
        # Create a new discount type to delete
        payload = {
            "name": "TEST_To Delete",
            "discount_type": "percentage",
            "value": 5,
            "application_mode": "manual"
        }
        create_response = requests.post(f"{BASE_URL}/api/accounting/discount-types", json=payload, headers=self.headers)
        
        if create_response.status_code != 200:
            pytest.skip("Could not create discount type to delete")
        
        type_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/accounting/discount-types/{type_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete: {response.text}"
        print("SUCCESS: Deleted unassigned discount type")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CLEANUP
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_99_cleanup_test_data(self):
        """Cleanup TEST_ prefixed discount types"""
        response = requests.get(f"{BASE_URL}/api/accounting/discount-types", headers=self.headers)
        if response.status_code != 200:
            return
        
        types = response.json()
        test_types = [t for t in types if t.get("name", "").startswith("TEST_")]
        
        deleted = 0
        for t in test_types:
            del_response = requests.delete(f"{BASE_URL}/api/accounting/discount-types/{t['id']}", headers=self.headers)
            if del_response.status_code == 200:
                deleted += 1
        
        print(f"CLEANUP: Deleted {deleted} test discount types")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
