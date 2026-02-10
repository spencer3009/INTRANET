"""
Test suite for News Module (Noticias Institucionales)
Tests all CRUD operations, publish/archive/pin actions, and visibility features.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"
TEST_SUBDOMAIN = "demosettings"


class TestNewsModule:
    """News Module API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        self.token = login_response.json().get("token")
        self.user = login_response.json().get("user")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        # Cleanup: Delete test news articles
        try:
            news_response = self.session.get(f"{BASE_URL}/api/news")
            if news_response.status_code == 200:
                news_list = news_response.json().get("news", [])
                for news in news_list:
                    if news.get("title", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/news/{news['id']}")
        except Exception:
            pass

    # ══════════════════════════════════════════════════════════════════════════════
    # GET /api/news - List news
    # ══════════════════════════════════════════════════════════════════════════════
    
    def test_get_news_list(self):
        """GET /api/news - Returns list of news articles"""
        response = self.session.get(f"{BASE_URL}/api/news")
        
        assert response.status_code == 200
        data = response.json()
        assert "news" in data
        assert "total" in data
        assert "page" in data
        assert "total_pages" in data
        assert isinstance(data["news"], list)
        print(f"✓ GET /api/news returns {len(data['news'])} articles")
    
    def test_get_news_requires_auth(self):
        """GET /api/news - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/news")
        
        assert response.status_code == 401
        print("✓ GET /api/news requires authentication")
    
    def test_get_news_filter_by_status_draft(self):
        """GET /api/news?status=draft - Filters by draft status"""
        response = self.session.get(f"{BASE_URL}/api/news", params={"status": "draft"})
        
        assert response.status_code == 200
        data = response.json()
        for news in data.get("news", []):
            assert news.get("status") == "draft"
        print(f"✓ GET /api/news?status=draft returns {len(data['news'])} drafts")
    
    def test_get_news_filter_by_status_published(self):
        """GET /api/news?status=published - Filters by published status"""
        response = self.session.get(f"{BASE_URL}/api/news", params={"status": "published"})
        
        assert response.status_code == 200
        data = response.json()
        for news in data.get("news", []):
            assert news.get("status") == "published"
        print(f"✓ GET /api/news?status=published returns {len(data['news'])} published")
    
    def test_get_news_filter_by_status_archived(self):
        """GET /api/news?status=archived - Filters by archived status"""
        response = self.session.get(f"{BASE_URL}/api/news", params={"status": "archived"})
        
        assert response.status_code == 200
        data = response.json()
        for news in data.get("news", []):
            assert news.get("status") == "archived"
        print(f"✓ GET /api/news?status=archived returns {len(data['news'])} archived")
    
    def test_get_news_pagination(self):
        """GET /api/news - Supports pagination"""
        response = self.session.get(f"{BASE_URL}/api/news", params={"page": 1, "limit": 5})
        
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 5
        assert len(data["news"]) <= 5
        print(f"✓ GET /api/news pagination works (page={data['page']}, limit={data['limit']})")
    
    def test_get_news_pinned_first(self):
        """GET /api/news - Pinned news appear first"""
        response = self.session.get(f"{BASE_URL}/api/news")
        
        assert response.status_code == 200
        data = response.json()
        news_list = data.get("news", [])
        
        # Check that pinned articles come before non-pinned
        found_non_pinned = False
        for news in news_list:
            if not news.get("pinned"):
                found_non_pinned = True
            elif found_non_pinned:
                # Found pinned after non-pinned - this is wrong
                pytest.fail("Pinned news should appear before non-pinned")
        
        print("✓ GET /api/news returns pinned news first")

    # ══════════════════════════════════════════════════════════════════════════════
    # POST /api/news - Create news
    # ══════════════════════════════════════════════════════════════════════════════
    
    def test_create_news_draft(self):
        """POST /api/news - Creates news as draft"""
        payload = {
            "title": f"TEST_Noticia Borrador {uuid.uuid4().hex[:8]}",
            "content": "Este es el contenido de prueba para la noticia borrador.",
            "summary": "Resumen de prueba",
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/news", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "news" in data
        assert data["news"]["title"] == payload["title"]
        assert data["news"]["content"] == payload["content"]
        assert data["news"]["status"] == "draft"
        assert data["news"]["pinned"] == False
        assert "id" in data["news"]
        print(f"✓ POST /api/news creates draft: {data['news']['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{data['news']['id']}")
    
    def test_create_news_published(self):
        """POST /api/news - Creates news as published"""
        payload = {
            "title": f"TEST_Noticia Publicada {uuid.uuid4().hex[:8]}",
            "content": "Este es el contenido de prueba para la noticia publicada.",
            "summary": "Resumen de prueba",
            "status": "published"
        }
        
        response = self.session.post(f"{BASE_URL}/api/news", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["news"]["status"] == "published"
        assert data["news"]["published_at"] is not None
        print(f"✓ POST /api/news creates published news: {data['news']['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{data['news']['id']}")
    
    def test_create_news_with_cover_image(self):
        """POST /api/news - Creates news with cover image"""
        payload = {
            "title": f"TEST_Noticia con Imagen {uuid.uuid4().hex[:8]}",
            "content": "Contenido con imagen de portada.",
            "cover_image": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/news", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["news"]["cover_image"] == payload["cover_image"]
        print(f"✓ POST /api/news creates news with cover image")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{data['news']['id']}")
    
    def test_create_news_with_gallery(self):
        """POST /api/news - Creates news with gallery"""
        payload = {
            "title": f"TEST_Noticia con Galería {uuid.uuid4().hex[:8]}",
            "content": "Contenido con galería de imágenes.",
            "gallery": [
                {"url": "https://res.cloudinary.com/demo/image/upload/sample1.jpg", "type": "image"},
                {"url": "https://res.cloudinary.com/demo/image/upload/sample2.jpg", "type": "image"}
            ],
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/news", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["news"]["gallery"]) == 2
        print(f"✓ POST /api/news creates news with gallery ({len(data['news']['gallery'])} items)")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{data['news']['id']}")
    
    def test_create_news_with_visibility(self):
        """POST /api/news - Creates news with visibility settings"""
        payload = {
            "title": f"TEST_Noticia con Visibilidad {uuid.uuid4().hex[:8]}",
            "content": "Contenido con visibilidad restringida.",
            "visibility": {
                "roles": ["teacher", "parent"],
                "grades": [],
                "sections": []
            },
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/news", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["news"]["visibility"]["roles"] == ["teacher", "parent"]
        print(f"✓ POST /api/news creates news with visibility settings")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{data['news']['id']}")
    
    def test_create_news_requires_title(self):
        """POST /api/news - Requires title field"""
        payload = {
            "content": "Contenido sin título."
        }
        
        response = self.session.post(f"{BASE_URL}/api/news", json=payload)
        
        assert response.status_code == 422  # Validation error
        print("✓ POST /api/news requires title field")
    
    def test_create_news_requires_content(self):
        """POST /api/news - Requires content field"""
        payload = {
            "title": "Título sin contenido"
        }
        
        response = self.session.post(f"{BASE_URL}/api/news", json=payload)
        
        assert response.status_code == 422  # Validation error
        print("✓ POST /api/news requires content field")
    
    def test_create_news_pinned_published(self):
        """POST /api/news - Creates pinned published news"""
        payload = {
            "title": f"TEST_Noticia Destacada {uuid.uuid4().hex[:8]}",
            "content": "Contenido de noticia destacada.",
            "status": "published",
            "pinned": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/news", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["news"]["pinned"] == True
        assert data["news"]["status"] == "published"
        print(f"✓ POST /api/news creates pinned published news")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{data['news']['id']}")

    # ══════════════════════════════════════════════════════════════════════════════
    # GET /api/news/{id} - Get single news
    # ══════════════════════════════════════════════════════════════════════════════
    
    def test_get_single_news(self):
        """GET /api/news/{id} - Returns single news article"""
        # First create a news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia Individual {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "draft"
        })
        news_id = create_response.json()["news"]["id"]
        
        # Get single news
        response = self.session.get(f"{BASE_URL}/api/news/{news_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == news_id
        assert "author_name" in data
        assert "status_label" in data
        assert "status_color" in data
        print(f"✓ GET /api/news/{news_id} returns news with enriched data")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_get_single_news_not_found(self):
        """GET /api/news/{id} - Returns 404 for nonexistent news"""
        fake_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/news/{fake_id}")
        
        assert response.status_code == 404
        print("✓ GET /api/news/{id} returns 404 for nonexistent news")

    # ══════════════════════════════════════════════════════════════════════════════
    # PUT /api/news/{id} - Update news
    # ══════════════════════════════════════════════════════════════════════════════
    
    def test_update_news_title(self):
        """PUT /api/news/{id} - Updates news title"""
        # Create news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia Original {uuid.uuid4().hex[:8]}",
            "content": "Contenido original.",
            "status": "draft"
        })
        news_id = create_response.json()["news"]["id"]
        
        # Update title
        new_title = f"TEST_Noticia Actualizada {uuid.uuid4().hex[:8]}"
        response = self.session.put(f"{BASE_URL}/api/news/{news_id}", json={
            "title": new_title
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["news"]["title"] == new_title
        print(f"✓ PUT /api/news/{news_id} updates title")
        
        # Verify persistence
        get_response = self.session.get(f"{BASE_URL}/api/news/{news_id}")
        assert get_response.json()["title"] == new_title
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_update_news_content(self):
        """PUT /api/news/{id} - Updates news content"""
        # Create news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia {uuid.uuid4().hex[:8]}",
            "content": "Contenido original.",
            "status": "draft"
        })
        news_id = create_response.json()["news"]["id"]
        
        # Update content
        new_content = "Contenido actualizado con más información."
        response = self.session.put(f"{BASE_URL}/api/news/{news_id}", json={
            "content": new_content
        })
        
        assert response.status_code == 200
        assert response.json()["news"]["content"] == new_content
        print(f"✓ PUT /api/news/{news_id} updates content")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_update_news_not_found(self):
        """PUT /api/news/{id} - Returns 404 for nonexistent news"""
        fake_id = str(uuid.uuid4())
        response = self.session.put(f"{BASE_URL}/api/news/{fake_id}", json={
            "title": "New Title"
        })
        
        assert response.status_code == 404
        print("✓ PUT /api/news/{id} returns 404 for nonexistent news")

    # ══════════════════════════════════════════════════════════════════════════════
    # PUT /api/news/{id}/publish - Publish news
    # ══════════════════════════════════════════════════════════════════════════════
    
    def test_publish_news(self):
        """PUT /api/news/{id}/publish - Publishes draft news"""
        # Create draft news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia para Publicar {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "draft"
        })
        news_id = create_response.json()["news"]["id"]
        
        # Publish
        response = self.session.put(f"{BASE_URL}/api/news/{news_id}/publish")
        
        assert response.status_code == 200
        assert "publicada" in response.json()["message"].lower()
        print(f"✓ PUT /api/news/{news_id}/publish publishes draft")
        
        # Verify status changed
        get_response = self.session.get(f"{BASE_URL}/api/news/{news_id}")
        assert get_response.json()["status"] == "published"
        assert get_response.json()["published_at"] is not None
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_publish_already_published(self):
        """PUT /api/news/{id}/publish - Returns error for already published"""
        # Create published news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia Ya Publicada {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "published"
        })
        news_id = create_response.json()["news"]["id"]
        
        # Try to publish again
        response = self.session.put(f"{BASE_URL}/api/news/{news_id}/publish")
        
        assert response.status_code == 400
        print("✓ PUT /api/news/{id}/publish returns error for already published")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_publish_news_not_found(self):
        """PUT /api/news/{id}/publish - Returns 404 for nonexistent news"""
        fake_id = str(uuid.uuid4())
        response = self.session.put(f"{BASE_URL}/api/news/{fake_id}/publish")
        
        assert response.status_code == 404
        print("✓ PUT /api/news/{id}/publish returns 404 for nonexistent news")

    # ══════════════════════════════════════════════════════════════════════════════
    # PUT /api/news/{id}/archive - Archive news
    # ══════════════════════════════════════════════════════════════════════════════
    
    def test_archive_news(self):
        """PUT /api/news/{id}/archive - Archives news"""
        # Create published news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia para Archivar {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "published"
        })
        news_id = create_response.json()["news"]["id"]
        
        # Archive
        response = self.session.put(f"{BASE_URL}/api/news/{news_id}/archive")
        
        assert response.status_code == 200
        assert "archivada" in response.json()["message"].lower()
        print(f"✓ PUT /api/news/{news_id}/archive archives news")
        
        # Verify status changed
        get_response = self.session.get(f"{BASE_URL}/api/news/{news_id}")
        assert get_response.json()["status"] == "archived"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_archive_already_archived(self):
        """PUT /api/news/{id}/archive - Returns error for already archived"""
        # Create and archive news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia Ya Archivada {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "published"
        })
        news_id = create_response.json()["news"]["id"]
        self.session.put(f"{BASE_URL}/api/news/{news_id}/archive")
        
        # Try to archive again
        response = self.session.put(f"{BASE_URL}/api/news/{news_id}/archive")
        
        assert response.status_code == 400
        print("✓ PUT /api/news/{id}/archive returns error for already archived")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_archive_unpins_news(self):
        """PUT /api/news/{id}/archive - Unpins news when archiving"""
        # Create pinned published news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia Destacada para Archivar {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "published",
            "pinned": True
        })
        news_id = create_response.json()["news"]["id"]
        
        # Archive
        self.session.put(f"{BASE_URL}/api/news/{news_id}/archive")
        
        # Verify unpinned
        get_response = self.session.get(f"{BASE_URL}/api/news/{news_id}")
        assert get_response.json()["pinned"] == False
        print("✓ PUT /api/news/{id}/archive unpins news when archiving")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")

    # ══════════════════════════════════════════════════════════════════════════════
    # PUT /api/news/{id}/pin - Toggle pin
    # ══════════════════════════════════════════════════════════════════════════════
    
    def test_pin_news(self):
        """PUT /api/news/{id}/pin - Pins published news"""
        # Create published news (not pinned)
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia para Fijar {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "published",
            "pinned": False
        })
        news_id = create_response.json()["news"]["id"]
        
        # Pin
        response = self.session.put(f"{BASE_URL}/api/news/{news_id}/pin")
        
        assert response.status_code == 200
        assert response.json()["pinned"] == True
        print(f"✓ PUT /api/news/{news_id}/pin pins news")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_unpin_news(self):
        """PUT /api/news/{id}/pin - Unpins pinned news"""
        # Create pinned published news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia para Desfijar {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "published",
            "pinned": True
        })
        news_id = create_response.json()["news"]["id"]
        
        # Unpin
        response = self.session.put(f"{BASE_URL}/api/news/{news_id}/pin")
        
        assert response.status_code == 200
        assert response.json()["pinned"] == False
        print(f"✓ PUT /api/news/{news_id}/pin unpins news")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_pin_draft_fails(self):
        """PUT /api/news/{id}/pin - Cannot pin draft news"""
        # Create draft news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Borrador para Fijar {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "draft"
        })
        news_id = create_response.json()["news"]["id"]
        
        # Try to pin
        response = self.session.put(f"{BASE_URL}/api/news/{news_id}/pin")
        
        assert response.status_code == 400
        print("✓ PUT /api/news/{id}/pin cannot pin draft news")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_pin_not_found(self):
        """PUT /api/news/{id}/pin - Returns 404 for nonexistent news"""
        fake_id = str(uuid.uuid4())
        response = self.session.put(f"{BASE_URL}/api/news/{fake_id}/pin")
        
        assert response.status_code == 404
        print("✓ PUT /api/news/{id}/pin returns 404 for nonexistent news")

    # ══════════════════════════════════════════════════════════════════════════════
    # DELETE /api/news/{id} - Delete news
    # ══════════════════════════════════════════════════════════════════════════════
    
    def test_delete_news(self):
        """DELETE /api/news/{id} - Deletes news"""
        # Create news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Noticia para Eliminar {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "draft"
        })
        news_id = create_response.json()["news"]["id"]
        
        # Delete
        response = self.session.delete(f"{BASE_URL}/api/news/{news_id}")
        
        assert response.status_code == 200
        assert "eliminada" in response.json()["message"].lower()
        print(f"✓ DELETE /api/news/{news_id} deletes news")
        
        # Verify deleted
        get_response = self.session.get(f"{BASE_URL}/api/news/{news_id}")
        assert get_response.status_code == 404
    
    def test_delete_news_not_found(self):
        """DELETE /api/news/{id} - Returns 404 for nonexistent news"""
        fake_id = str(uuid.uuid4())
        response = self.session.delete(f"{BASE_URL}/api/news/{fake_id}")
        
        assert response.status_code == 404
        print("✓ DELETE /api/news/{id} returns 404 for nonexistent news")

    # ══════════════════════════════════════════════════════════════════════════════
    # Integration Tests
    # ══════════════════════════════════════════════════════════════════════════════
    
    def test_full_workflow_draft_to_published_to_archived(self):
        """Integration: Full workflow Draft -> Published -> Archived"""
        # Create draft
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Workflow Completo {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba para workflow completo.",
            "summary": "Resumen de prueba",
            "status": "draft"
        })
        assert create_response.status_code == 200
        news_id = create_response.json()["news"]["id"]
        print(f"  1. Created draft: {news_id}")
        
        # Verify draft status
        get_response = self.session.get(f"{BASE_URL}/api/news/{news_id}")
        assert get_response.json()["status"] == "draft"
        
        # Publish
        publish_response = self.session.put(f"{BASE_URL}/api/news/{news_id}/publish")
        assert publish_response.status_code == 200
        print(f"  2. Published news")
        
        # Verify published
        get_response = self.session.get(f"{BASE_URL}/api/news/{news_id}")
        assert get_response.json()["status"] == "published"
        assert get_response.json()["published_at"] is not None
        
        # Pin
        pin_response = self.session.put(f"{BASE_URL}/api/news/{news_id}/pin")
        assert pin_response.status_code == 200
        assert pin_response.json()["pinned"] == True
        print(f"  3. Pinned news")
        
        # Archive (should also unpin)
        archive_response = self.session.put(f"{BASE_URL}/api/news/{news_id}/archive")
        assert archive_response.status_code == 200
        print(f"  4. Archived news")
        
        # Verify archived and unpinned
        get_response = self.session.get(f"{BASE_URL}/api/news/{news_id}")
        assert get_response.json()["status"] == "archived"
        assert get_response.json()["pinned"] == False
        
        print("✓ Integration: Full workflow Draft -> Published -> Pinned -> Archived")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_max_pinned_limit(self):
        """Integration: Maximum 3 pinned news limit"""
        created_ids = []
        
        try:
            # Create 3 pinned news
            for i in range(3):
                response = self.session.post(f"{BASE_URL}/api/news", json={
                    "title": f"TEST_Pinned {i+1} {uuid.uuid4().hex[:8]}",
                    "content": f"Contenido pinned {i+1}",
                    "status": "published",
                    "pinned": True
                })
                if response.status_code == 200:
                    created_ids.append(response.json()["news"]["id"])
            
            # Try to create 4th pinned news
            response = self.session.post(f"{BASE_URL}/api/news", json={
                "title": f"TEST_Pinned 4 {uuid.uuid4().hex[:8]}",
                "content": "Contenido pinned 4",
                "status": "published",
                "pinned": True
            })
            
            # Should fail with 400
            assert response.status_code == 400
            assert "3" in response.json()["detail"]
            print("✓ Integration: Maximum 3 pinned news limit enforced")
            
        finally:
            # Cleanup
            for news_id in created_ids:
                self.session.delete(f"{BASE_URL}/api/news/{news_id}")
    
    def test_news_enrichment(self):
        """Integration: News includes enriched data (author, status labels)"""
        # Create news
        create_response = self.session.post(f"{BASE_URL}/api/news", json={
            "title": f"TEST_Enrichment {uuid.uuid4().hex[:8]}",
            "content": "Contenido de prueba.",
            "status": "published"
        })
        news_id = create_response.json()["news"]["id"]
        
        # Get news list
        list_response = self.session.get(f"{BASE_URL}/api/news")
        news_list = list_response.json()["news"]
        
        # Find our news
        our_news = next((n for n in news_list if n["id"] == news_id), None)
        assert our_news is not None
        
        # Check enrichment
        assert "author_name" in our_news
        assert "status_label" in our_news
        assert "status_color" in our_news
        assert our_news["status_label"] == "Publicado"
        assert our_news["status_color"] == "#22C55E"
        
        print("✓ Integration: News includes enriched data (author_name, status_label, status_color)")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/news/{news_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
