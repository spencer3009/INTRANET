"""
Academia Module Tests - Tutorial Video Library
Tests for categories, subcategories, videos CRUD, YouTube extraction, and publishing.
Support panel feature accessible only by system_admin_global users.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Support credentials
SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"


class TestAcademiaBackend:
    """Academia module backend API tests"""
    
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
    # STATS TESTS
    # ═══════════════════════════════════════════════════════════
    
    def test_get_stats(self, headers):
        """GET /api/academia/stats - should return stats"""
        response = requests.get(f"{BASE_URL}/api/academia/stats", headers=headers)
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        assert "total_videos" in data
        assert "total_categories" in data
        assert "published_count" in data
        assert "draft_count" in data
        print(f"Stats: {data}")
    
    # ═══════════════════════════════════════════════════════════
    # CATEGORIES TESTS
    # ═══════════════════════════════════════════════════════════
    
    def test_get_categories(self, headers):
        """GET /api/academia/categories - should return seed categories"""
        response = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers)
        assert response.status_code == 200, f"Get categories failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Should have 6 seed categories
        assert len(data) >= 6, f"Expected at least 6 seed categories, got {len(data)}"
        # Check structure
        for cat in data:
            assert "id" in cat
            assert "name" in cat
            assert "video_count" in cat
            assert "subcategories" in cat
        print(f"Found {len(data)} categories")
        # Check seed category names
        names = [c["name"] for c in data]
        expected_names = ["Primeros pasos", "Gestion de alumnos", "Contabilidad y pagos", 
                         "Notas y asistencia", "Gestion de docentes", "Reportes y estadisticas"]
        for name in expected_names:
            assert name in names, f"Missing seed category: {name}"
    
    def test_create_category(self, headers):
        """POST /api/academia/categories - create new category"""
        response = requests.post(f"{BASE_URL}/api/academia/categories", 
            headers=headers,
            json={"name": "TEST_Categoria_Nueva", "description": "Test category"})
        assert response.status_code == 200, f"Create category failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Categoria_Nueva"
        assert "id" in data
        print(f"Created category: {data['id']}")
        return data["id"]
    
    def test_create_duplicate_category_fails(self, headers):
        """POST /api/academia/categories - duplicate name should fail"""
        # First create
        requests.post(f"{BASE_URL}/api/academia/categories", 
            headers=headers,
            json={"name": "TEST_Duplicate_Cat"})
        # Try duplicate
        response = requests.post(f"{BASE_URL}/api/academia/categories", 
            headers=headers,
            json={"name": "TEST_Duplicate_Cat"})
        assert response.status_code == 409, f"Expected 409 for duplicate, got {response.status_code}"
    
    def test_update_category(self, headers):
        """PUT /api/academia/categories/{id} - update category"""
        # Create a category first
        create_resp = requests.post(f"{BASE_URL}/api/academia/categories", 
            headers=headers,
            json={"name": "TEST_Update_Cat"})
        if create_resp.status_code == 409:
            # Already exists, get it
            cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
            cat_id = next((c["id"] for c in cats if c["name"] == "TEST_Update_Cat"), None)
        else:
            cat_id = create_resp.json()["id"]
        
        # Update
        response = requests.put(f"{BASE_URL}/api/academia/categories/{cat_id}", 
            headers=headers,
            json={"name": "TEST_Update_Cat_Modified"})
        assert response.status_code == 200, f"Update category failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Update_Cat_Modified"
    
    def test_delete_category_without_videos(self, headers):
        """DELETE /api/academia/categories/{id} - delete empty category"""
        # Create a category
        create_resp = requests.post(f"{BASE_URL}/api/academia/categories", 
            headers=headers,
            json={"name": "TEST_Delete_Cat"})
        if create_resp.status_code == 200:
            cat_id = create_resp.json()["id"]
            # Delete it
            response = requests.delete(f"{BASE_URL}/api/academia/categories/{cat_id}", headers=headers)
            assert response.status_code == 200, f"Delete category failed: {response.text}"
            print("Category deleted successfully")
    
    # ═══════════════════════════════════════════════════════════
    # SUBCATEGORIES TESTS
    # ═══════════════════════════════════════════════════════════
    
    def test_create_subcategory(self, headers):
        """POST /api/academia/categories/{id}/subcategories - create subcategory"""
        # Get first category
        cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        cat_id = cats[0]["id"]
        
        response = requests.post(f"{BASE_URL}/api/academia/categories/{cat_id}/subcategories", 
            headers=headers,
            json={"name": "TEST_Subcategoria"})
        assert response.status_code == 200, f"Create subcategory failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Subcategoria"
        assert data["category_id"] == cat_id
        print(f"Created subcategory: {data['id']}")
        return data["id"]
    
    def test_update_subcategory(self, headers):
        """PUT /api/academia/subcategories/{id} - update subcategory"""
        # Get categories with subcategories
        cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        sub_id = None
        for cat in cats:
            if cat.get("subcategories"):
                sub_id = cat["subcategories"][0]["id"]
                break
        
        if sub_id:
            response = requests.put(f"{BASE_URL}/api/academia/subcategories/{sub_id}", 
                headers=headers,
                json={"name": "TEST_Sub_Modified"})
            assert response.status_code == 200, f"Update subcategory failed: {response.text}"
    
    def test_delete_subcategory_without_videos(self, headers):
        """DELETE /api/academia/subcategories/{id} - delete empty subcategory"""
        # Create a subcategory first
        cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        cat_id = cats[0]["id"]
        
        create_resp = requests.post(f"{BASE_URL}/api/academia/categories/{cat_id}/subcategories", 
            headers=headers,
            json={"name": "TEST_Delete_Sub"})
        if create_resp.status_code == 200:
            sub_id = create_resp.json()["id"]
            response = requests.delete(f"{BASE_URL}/api/academia/subcategories/{sub_id}", headers=headers)
            assert response.status_code == 200, f"Delete subcategory failed: {response.text}"
    
    # ═══════════════════════════════════════════════════════════
    # YOUTUBE EXTRACT TESTS
    # ═══════════════════════════════════════════════════════════
    
    def test_youtube_extract_valid_url(self, headers):
        """POST /api/academia/youtube/extract - extract from valid YouTube URL"""
        response = requests.post(f"{BASE_URL}/api/academia/youtube/extract", 
            headers=headers,
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
        assert response.status_code == 200, f"YouTube extract failed: {response.text}"
        data = response.json()
        assert data["is_valid"] == True
        assert data["youtube_video_id"] == "dQw4w9WgXcQ"
        assert "thumbnail_url" in data
        assert "title" in data
        print(f"Extracted: {data}")
    
    def test_youtube_extract_short_url(self, headers):
        """POST /api/academia/youtube/extract - extract from youtu.be URL"""
        response = requests.post(f"{BASE_URL}/api/academia/youtube/extract", 
            headers=headers,
            json={"url": "https://youtu.be/dQw4w9WgXcQ"})
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] == True
        assert data["youtube_video_id"] == "dQw4w9WgXcQ"
    
    def test_youtube_extract_invalid_url(self, headers):
        """POST /api/academia/youtube/extract - invalid URL returns is_valid=false"""
        response = requests.post(f"{BASE_URL}/api/academia/youtube/extract", 
            headers=headers,
            json={"url": "https://example.com/not-youtube"})
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] == False
    
    # ═══════════════════════════════════════════════════════════
    # VIDEOS TESTS
    # ═══════════════════════════════════════════════════════════
    
    def test_create_video(self, headers):
        """POST /api/academia/videos - create video"""
        # Get first category
        cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        cat_id = cats[0]["id"]
        
        response = requests.post(f"{BASE_URL}/api/academia/videos", 
            headers=headers,
            json={
                "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "title": "TEST_Video_Tutorial",
                "description": "Test video description",
                "category_id": cat_id,
                "is_published": False
            })
        assert response.status_code == 200, f"Create video failed: {response.text}"
        data = response.json()
        assert data["title"] == "TEST_Video_Tutorial"
        assert data["youtube_video_id"] == "dQw4w9WgXcQ"
        assert "thumbnail_url" in data
        print(f"Created video: {data['id']}")
        return data["id"]
    
    def test_create_video_invalid_youtube_url(self, headers):
        """POST /api/academia/videos - invalid YouTube URL should fail"""
        cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        cat_id = cats[0]["id"]
        
        response = requests.post(f"{BASE_URL}/api/academia/videos", 
            headers=headers,
            json={
                "youtube_url": "https://example.com/not-youtube",
                "title": "Invalid Video",
                "category_id": cat_id
            })
        assert response.status_code == 400, f"Expected 400 for invalid URL, got {response.status_code}"
    
    def test_get_videos(self, headers):
        """GET /api/academia/videos - list videos"""
        response = requests.get(f"{BASE_URL}/api/academia/videos", headers=headers)
        assert response.status_code == 200, f"Get videos failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} videos")
    
    def test_get_videos_with_category_filter(self, headers):
        """GET /api/academia/videos?category_id=X - filter by category"""
        cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        cat_id = cats[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/academia/videos?category_id={cat_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # All videos should be from this category
        for video in data:
            assert video["category_id"] == cat_id
    
    def test_get_videos_with_search(self, headers):
        """GET /api/academia/videos?search=X - search by title"""
        response = requests.get(f"{BASE_URL}/api/academia/videos?search=TEST", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # All videos should contain TEST in title
        for video in data:
            assert "TEST" in video["title"].upper()
    
    def test_update_video(self, headers):
        """PUT /api/academia/videos/{id} - update video"""
        # Get a video
        videos = requests.get(f"{BASE_URL}/api/academia/videos", headers=headers).json()
        if videos:
            video_id = videos[0]["id"]
            response = requests.put(f"{BASE_URL}/api/academia/videos/{video_id}", 
                headers=headers,
                json={"title": "TEST_Video_Updated"})
            assert response.status_code == 200, f"Update video failed: {response.text}"
            data = response.json()
            assert data["title"] == "TEST_Video_Updated"
    
    def test_toggle_publish(self, headers):
        """PATCH /api/academia/videos/{id}/publish - toggle publish status"""
        # Get a video
        videos = requests.get(f"{BASE_URL}/api/academia/videos", headers=headers).json()
        if videos:
            video_id = videos[0]["id"]
            original_status = videos[0]["is_published"]
            
            response = requests.patch(f"{BASE_URL}/api/academia/videos/{video_id}/publish", headers=headers)
            assert response.status_code == 200, f"Toggle publish failed: {response.text}"
            data = response.json()
            assert data["is_published"] != original_status
            print(f"Toggled publish: {original_status} -> {data['is_published']}")
    
    def test_delete_video(self, headers):
        """DELETE /api/academia/videos/{id} - delete video"""
        # Create a video to delete
        cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        cat_id = cats[0]["id"]
        
        create_resp = requests.post(f"{BASE_URL}/api/academia/videos", 
            headers=headers,
            json={
                "youtube_url": "https://www.youtube.com/watch?v=9bZkp7q19f0",
                "title": "TEST_Delete_Video",
                "category_id": cat_id
            })
        if create_resp.status_code == 200:
            video_id = create_resp.json()["id"]
            response = requests.delete(f"{BASE_URL}/api/academia/videos/{video_id}", headers=headers)
            assert response.status_code == 200, f"Delete video failed: {response.text}"
            print("Video deleted successfully")
    
    def test_delete_category_with_videos_fails(self, headers):
        """DELETE /api/academia/categories/{id} - should fail if has videos"""
        # Get a category with videos
        cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        cat_with_videos = next((c for c in cats if c["video_count"] > 0), None)
        
        if cat_with_videos:
            response = requests.delete(f"{BASE_URL}/api/academia/categories/{cat_with_videos['id']}", headers=headers)
            assert response.status_code == 409, f"Expected 409 for category with videos, got {response.status_code}"
            print("Correctly prevented deletion of category with videos")
    
    # ═══════════════════════════════════════════════════════════
    # CLEANUP
    # ═══════════════════════════════════════════════════════════
    
    def test_cleanup_test_data(self, headers):
        """Cleanup TEST_ prefixed data"""
        # Delete test videos
        videos = requests.get(f"{BASE_URL}/api/academia/videos", headers=headers).json()
        for video in videos:
            if video["title"].startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/academia/videos/{video['id']}", headers=headers)
        
        # Delete test categories (will fail if has videos, which is fine)
        cats = requests.get(f"{BASE_URL}/api/academia/categories", headers=headers).json()
        for cat in cats:
            if cat["name"].startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/academia/categories/{cat['id']}", headers=headers)
        
        print("Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
