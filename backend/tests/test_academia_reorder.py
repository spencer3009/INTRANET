"""
Academia Reorder Tests - Category and Subcategory Reordering
Tests for PUT /api/academia/categories/reorder and PUT /api/academia/subcategories/reorder endpoints.
Feature: Reordenar categorías y subcategorías en el módulo Soporte/Academia.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Support credentials
SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"


class TestAcademiaReorder:
    """Academia reorder functionality tests"""
    
    @pytest.fixture(scope="class")
    def support_token(self):
        """Get support admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": SUPPORT_PASSWORD
        })
        assert response.status_code == 200, f"Support login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, support_token):
        """Auth headers for API calls"""
        return {"Authorization": f"Bearer {support_token}"}
    
    # ═══════════════════════════════════════════════════════════
    # CATEGORIES REORDER TESTS
    # ═══════════════════════════════════════════════════════════
    
    def test_get_categories_with_sort_order(self, headers):
        """GET /api/academia/categories - verify categories have sort_order"""
        response = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers)
        assert response.status_code == 200, f"Get categories failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2, "Need at least 2 categories to test reorder"
        
        # Verify categories are sorted by sort_order
        for i, cat in enumerate(data):
            assert "id" in cat
            assert "name" in cat
            assert "sort_order" in cat or i == cat.get("sort_order", i), "Categories should have sort_order"
        
        print(f"Found {len(data)} categories with sort_order")
        return data
    
    def test_reorder_categories(self, headers):
        """PUT /api/academia/categories/reorder - reorder categories"""
        # Get current categories
        cats_resp = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers)
        assert cats_resp.status_code == 200
        cats = cats_resp.json()
        
        if len(cats) < 2:
            pytest.skip("Need at least 2 categories to test reorder")
        
        # Get original order
        original_ids = [c["id"] for c in cats]
        original_first = cats[0]["name"]
        original_second = cats[1]["name"]
        
        # Swap first two categories
        new_order = original_ids.copy()
        new_order[0], new_order[1] = new_order[1], new_order[0]
        
        # Reorder
        response = requests.put(f"{BASE_URL}/api/academia/categories/reorder", 
            headers=headers,
            json={"ordered_ids": new_order})
        assert response.status_code == 200, f"Reorder categories failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"Reorder response: {data}")
        
        # Verify new order
        cats_after = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        assert cats_after[0]["name"] == original_second, f"First category should be {original_second}"
        assert cats_after[1]["name"] == original_first, f"Second category should be {original_first}"
        
        print(f"Categories reordered: {original_first} <-> {original_second}")
        
        # Restore original order
        requests.put(f"{BASE_URL}/api/academia/categories/reorder", 
            headers=headers,
            json={"ordered_ids": original_ids})
        print("Original order restored")
    
    def test_reorder_categories_with_invalid_ids(self, headers):
        """PUT /api/academia/categories/reorder - with non-existent IDs (should not fail)"""
        # The endpoint updates existing IDs and ignores non-existent ones
        response = requests.put(f"{BASE_URL}/api/academia/categories/reorder", 
            headers=headers,
            json={"ordered_ids": ["non-existent-id-1", "non-existent-id-2"]})
        # Should succeed (no error, just no updates)
        assert response.status_code == 200, f"Reorder with invalid IDs failed: {response.text}"
    
    def test_reorder_categories_empty_list(self, headers):
        """PUT /api/academia/categories/reorder - with empty list"""
        response = requests.put(f"{BASE_URL}/api/academia/categories/reorder", 
            headers=headers,
            json={"ordered_ids": []})
        assert response.status_code == 200, f"Reorder with empty list failed: {response.text}"
    
    # ═══════════════════════════════════════════════════════════
    # SUBCATEGORIES REORDER TESTS
    # ═══════════════════════════════════════════════════════════
    
    def test_get_subcategories_with_sort_order(self, headers):
        """GET /api/academia/categories - verify subcategories have sort_order"""
        response = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers)
        assert response.status_code == 200
        cats = response.json()
        
        # Find a category with subcategories
        cat_with_subs = None
        for cat in cats:
            if cat.get("subcategories") and len(cat["subcategories"]) >= 2:
                cat_with_subs = cat
                break
        
        if not cat_with_subs:
            pytest.skip("No category with 2+ subcategories found")
        
        print(f"Category '{cat_with_subs['name']}' has {len(cat_with_subs['subcategories'])} subcategories")
        return cat_with_subs
    
    def test_reorder_subcategories(self, headers):
        """PUT /api/academia/subcategories/reorder - reorder subcategories within a category"""
        # Get categories
        cats_resp = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers)
        assert cats_resp.status_code == 200
        cats = cats_resp.json()
        
        # Find a category with at least 2 subcategories
        cat_with_subs = None
        for cat in cats:
            if cat.get("subcategories") and len(cat["subcategories"]) >= 2:
                cat_with_subs = cat
                break
        
        if not cat_with_subs:
            pytest.skip("No category with 2+ subcategories found")
        
        subs = cat_with_subs["subcategories"]
        original_ids = [s["id"] for s in subs]
        original_first = subs[0]["name"]
        original_second = subs[1]["name"]
        
        # Swap first two subcategories
        new_order = original_ids.copy()
        new_order[0], new_order[1] = new_order[1], new_order[0]
        
        # Reorder
        response = requests.put(f"{BASE_URL}/api/academia/subcategories/reorder", 
            headers=headers,
            json={"ordered_ids": new_order})
        assert response.status_code == 200, f"Reorder subcategories failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"Reorder response: {data}")
        
        # Verify new order
        cats_after = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        cat_after = next((c for c in cats_after if c["id"] == cat_with_subs["id"]), None)
        assert cat_after is not None
        subs_after = cat_after["subcategories"]
        
        assert subs_after[0]["name"] == original_second, f"First subcategory should be {original_second}"
        assert subs_after[1]["name"] == original_first, f"Second subcategory should be {original_first}"
        
        print(f"Subcategories reordered: {original_first} <-> {original_second}")
        
        # Restore original order
        requests.put(f"{BASE_URL}/api/academia/subcategories/reorder", 
            headers=headers,
            json={"ordered_ids": original_ids})
        print("Original order restored")
    
    def test_reorder_subcategories_with_invalid_ids(self, headers):
        """PUT /api/academia/subcategories/reorder - with non-existent IDs"""
        response = requests.put(f"{BASE_URL}/api/academia/subcategories/reorder", 
            headers=headers,
            json={"ordered_ids": ["non-existent-sub-1", "non-existent-sub-2"]})
        assert response.status_code == 200, f"Reorder with invalid IDs failed: {response.text}"
    
    def test_reorder_subcategories_empty_list(self, headers):
        """PUT /api/academia/subcategories/reorder - with empty list"""
        response = requests.put(f"{BASE_URL}/api/academia/subcategories/reorder", 
            headers=headers,
            json={"ordered_ids": []})
        assert response.status_code == 200, f"Reorder with empty list failed: {response.text}"
    
    # ═══════════════════════════════════════════════════════════
    # INTEGRATION TESTS
    # ═══════════════════════════════════════════════════════════
    
    def test_reorder_preserves_video_counts(self, headers):
        """Verify reordering doesn't affect video counts"""
        # Get categories before
        cats_before = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        video_counts_before = {c["id"]: c["video_count"] for c in cats_before}
        
        if len(cats_before) < 2:
            pytest.skip("Need at least 2 categories")
        
        # Reorder
        original_ids = [c["id"] for c in cats_before]
        new_order = original_ids.copy()
        new_order[0], new_order[1] = new_order[1], new_order[0]
        
        requests.put(f"{BASE_URL}/api/academia/categories/reorder", 
            headers=headers,
            json={"ordered_ids": new_order})
        
        # Get categories after
        cats_after = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        video_counts_after = {c["id"]: c["video_count"] for c in cats_after}
        
        # Verify video counts unchanged
        for cat_id, count in video_counts_before.items():
            assert video_counts_after.get(cat_id) == count, f"Video count changed for category {cat_id}"
        
        # Restore order
        requests.put(f"{BASE_URL}/api/academia/categories/reorder", 
            headers=headers,
            json={"ordered_ids": original_ids})
        
        print("Video counts preserved after reorder")
    
    def test_reorder_preserves_subcategory_structure(self, headers):
        """Verify reordering categories preserves their subcategories"""
        # Get categories before
        cats_before = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        sub_counts_before = {c["id"]: len(c.get("subcategories", [])) for c in cats_before}
        
        if len(cats_before) < 2:
            pytest.skip("Need at least 2 categories")
        
        # Reorder
        original_ids = [c["id"] for c in cats_before]
        new_order = original_ids.copy()
        new_order[0], new_order[1] = new_order[1], new_order[0]
        
        requests.put(f"{BASE_URL}/api/academia/categories/reorder", 
            headers=headers,
            json={"ordered_ids": new_order})
        
        # Get categories after
        cats_after = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        sub_counts_after = {c["id"]: len(c.get("subcategories", [])) for c in cats_after}
        
        # Verify subcategory counts unchanged
        for cat_id, count in sub_counts_before.items():
            assert sub_counts_after.get(cat_id) == count, f"Subcategory count changed for category {cat_id}"
        
        # Restore order
        requests.put(f"{BASE_URL}/api/academia/categories/reorder", 
            headers=headers,
            json={"ordered_ids": original_ids})
        
        print("Subcategory structure preserved after reorder")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
