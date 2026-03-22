"""
Academia Portal API Tests - Phase 2
Tests for read-only portal endpoints accessible by school users (owner, admin, teacher)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SCHOOL_ADMIN_EMAIL = "admin@elroble.edu"
SCHOOL_ADMIN_PASSWORD = "1234abc8"
SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"


@pytest.fixture(scope="module")
def school_admin_token():
    """Get token for school admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SCHOOL_ADMIN_EMAIL,
        "password": SCHOOL_ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"School admin login failed: {response.status_code} - {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def support_token():
    """Get token for support user (to create test data)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPPORT_EMAIL,
        "password": SUPPORT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Support login failed: {response.status_code} - {response.text}")
    return response.json().get("token")


class TestPortalStats:
    """Tests for GET /api/academia/portal/stats"""
    
    def test_portal_stats_returns_published_counts(self, school_admin_token):
        """Portal stats should return only published video and active category counts"""
        response = requests.get(
            f"{BASE_URL}/api/academia/portal/stats",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_videos" in data, "Response should have total_videos"
        assert "total_categories" in data, "Response should have total_categories"
        assert isinstance(data["total_videos"], int), "total_videos should be integer"
        assert isinstance(data["total_categories"], int), "total_categories should be integer"
        print(f"Portal stats: {data['total_videos']} videos, {data['total_categories']} categories")


class TestPortalCategories:
    """Tests for GET /api/academia/portal/categories"""
    
    def test_portal_categories_returns_active_with_videos(self, school_admin_token):
        """Portal categories should return only active categories with published videos"""
        response = requests.get(
            f"{BASE_URL}/api/academia/portal/categories",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Each category should have required fields
        for cat in data:
            assert "id" in cat, "Category should have id"
            assert "name" in cat, "Category should have name"
            assert "video_count" in cat, "Category should have video_count"
            assert cat["video_count"] > 0, f"Category {cat['name']} should have at least 1 published video"
            print(f"Category: {cat['name']} - {cat['video_count']} videos")
    
    def test_portal_categories_excludes_empty_categories(self, school_admin_token, support_token):
        """Categories with no published videos should not appear in portal"""
        # First get all categories from support endpoint
        support_response = requests.get(
            f"{BASE_URL}/api/academia/categories",
            headers={"Authorization": f"Bearer {support_token}"}
        )
        all_categories = support_response.json() if support_response.status_code == 200 else []
        
        # Get portal categories
        portal_response = requests.get(
            f"{BASE_URL}/api/academia/portal/categories",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        portal_categories = portal_response.json()
        
        # Portal should have fewer or equal categories (only those with published videos)
        assert len(portal_categories) <= len(all_categories), \
            "Portal should not have more categories than total"
        print(f"All categories: {len(all_categories)}, Portal categories: {len(portal_categories)}")


class TestPortalVideos:
    """Tests for GET /api/academia/portal/videos"""
    
    def test_portal_videos_returns_published_only(self, school_admin_token):
        """Portal videos should return only published videos"""
        response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # All videos should be published
        for video in data:
            assert video.get("is_published") == True, f"Video {video.get('title')} should be published"
            print(f"Video: {video.get('title')} - Published: {video.get('is_published')}")
    
    def test_portal_videos_enriched_with_category_names(self, school_admin_token):
        """Portal videos should have category_name and subcategory_name enriched"""
        response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        for video in data:
            assert "category_name" in video, "Video should have category_name"
            if video.get("category_id"):
                assert video["category_name"], f"Video {video.get('title')} should have non-empty category_name"
            print(f"Video: {video.get('title')} - Category: {video.get('category_name')}")
    
    def test_portal_videos_search(self, school_admin_token):
        """Portal videos search should work across titles"""
        # First get all videos to find a search term
        all_response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        all_videos = all_response.json()
        
        if len(all_videos) == 0:
            pytest.skip("No published videos to test search")
        
        # Use first video's title for search
        search_term = all_videos[0]["title"][:5] if all_videos[0].get("title") else "test"
        
        search_response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos",
            params={"search": search_term},
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        assert search_response.status_code == 200
        print(f"Search for '{search_term}' returned {len(search_response.json())} videos")
    
    def test_portal_videos_filter_by_category(self, school_admin_token):
        """Portal videos should filter by category_id"""
        # Get categories first
        cats_response = requests.get(
            f"{BASE_URL}/api/academia/portal/categories",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        categories = cats_response.json()
        
        if len(categories) == 0:
            pytest.skip("No categories with published videos")
        
        cat_id = categories[0]["id"]
        
        # Filter videos by category
        response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos",
            params={"category_id": cat_id},
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        assert response.status_code == 200
        
        videos = response.json()
        for video in videos:
            assert video.get("category_id") == cat_id, \
                f"Video should belong to category {cat_id}"
        print(f"Category {categories[0]['name']} has {len(videos)} videos")


class TestPortalVideoDetail:
    """Tests for GET /api/academia/portal/videos/{id}"""
    
    def test_portal_video_detail_returns_published(self, school_admin_token):
        """Portal video detail should return published video with enriched data"""
        # Get a video first
        list_response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        videos = list_response.json()
        
        if len(videos) == 0:
            pytest.skip("No published videos to test detail")
        
        video_id = videos[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos/{video_id}",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        video = response.json()
        assert video["id"] == video_id
        assert video["is_published"] == True
        assert "category_name" in video
        print(f"Video detail: {video.get('title')} - {video.get('category_name')}")
    
    def test_portal_video_detail_404_for_unpublished(self, school_admin_token, support_token):
        """Portal video detail should return 404 for unpublished videos"""
        # Get all videos from support endpoint to find unpublished
        support_response = requests.get(
            f"{BASE_URL}/api/academia/videos",
            params={"is_published": False},
            headers={"Authorization": f"Bearer {support_token}"}
        )
        
        if support_response.status_code != 200:
            pytest.skip("Could not get unpublished videos")
        
        unpublished = support_response.json()
        if len(unpublished) == 0:
            pytest.skip("No unpublished videos to test")
        
        video_id = unpublished[0]["id"]
        
        # Try to access via portal - should fail
        response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos/{video_id}",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        assert response.status_code == 404, \
            f"Expected 404 for unpublished video, got {response.status_code}"
        print(f"Correctly returned 404 for unpublished video {video_id}")


class TestPortalAuthorization:
    """Tests for portal endpoint authorization"""
    
    def test_portal_requires_authentication(self):
        """Portal endpoints should require authentication"""
        endpoints = [
            "/api/academia/portal/stats",
            "/api/academia/portal/categories",
            "/api/academia/portal/videos",
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], \
                f"{endpoint} should require auth, got {response.status_code}"
        print("All portal endpoints require authentication")
    
    def test_portal_accessible_by_school_admin(self, school_admin_token):
        """Portal should be accessible by school admin"""
        response = requests.get(
            f"{BASE_URL}/api/academia/portal/stats",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        assert response.status_code == 200, \
            f"School admin should access portal, got {response.status_code}"
        print("School admin can access portal")
    
    def test_portal_returns_403_for_non_school_users(self, support_token):
        """Portal should return 403 for non-school users (support without school context)"""
        response = requests.get(
            f"{BASE_URL}/api/academia/portal/stats",
            headers={"Authorization": f"Bearer {support_token}"}
        )
        # Support users without school context should get 403
        # They need to switch to a school first to access portal
        assert response.status_code == 403, \
            f"Non-school user should get 403, got {response.status_code}"
        print("Non-school user correctly gets 403")


class TestNoCreateEditDeleteInPortal:
    """Verify portal endpoints are read-only - no CRUD operations"""
    
    def test_portal_has_no_post_endpoints(self, school_admin_token):
        """Portal should not have POST endpoints for creating videos/categories"""
        # Try to POST to portal endpoints - should fail
        endpoints = [
            "/api/academia/portal/categories",
            "/api/academia/portal/videos",
        ]
        
        for endpoint in endpoints:
            response = requests.post(
                f"{BASE_URL}{endpoint}",
                json={"name": "Test"},
                headers={"Authorization": f"Bearer {school_admin_token}"}
            )
            # Should return 405 Method Not Allowed or 404
            assert response.status_code in [404, 405, 422], \
                f"POST to {endpoint} should not be allowed, got {response.status_code}"
        print("Portal has no POST endpoints (read-only)")
    
    def test_portal_has_no_put_endpoints(self, school_admin_token):
        """Portal should not have PUT endpoints for updating"""
        # Get a video first
        list_response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        videos = list_response.json()
        
        if len(videos) == 0:
            pytest.skip("No videos to test PUT")
        
        video_id = videos[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/academia/portal/videos/{video_id}",
            json={"title": "Updated"},
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        # Should return 405 Method Not Allowed or 404
        assert response.status_code in [404, 405, 422], \
            f"PUT should not be allowed, got {response.status_code}"
        print("Portal has no PUT endpoints (read-only)")
    
    def test_portal_has_no_delete_endpoints(self, school_admin_token):
        """Portal should not have DELETE endpoints"""
        # Get a video first
        list_response = requests.get(
            f"{BASE_URL}/api/academia/portal/videos",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        videos = list_response.json()
        
        if len(videos) == 0:
            pytest.skip("No videos to test DELETE")
        
        video_id = videos[0]["id"]
        
        response = requests.delete(
            f"{BASE_URL}/api/academia/portal/videos/{video_id}",
            headers={"Authorization": f"Bearer {school_admin_token}"}
        )
        # Should return 405 Method Not Allowed or 404
        assert response.status_code in [404, 405, 422], \
            f"DELETE should not be allowed, got {response.status_code}"
        print("Portal has no DELETE endpoints (read-only)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
