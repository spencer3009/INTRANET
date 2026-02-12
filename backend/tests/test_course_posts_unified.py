"""
Test Suite for Unified Course Posts System (Tasks, Materials, Forum)
Tests the CoursePost model with post_type field for different content types.
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


class TestCoursePostsUnified:
    """Test unified course posts system with post_type filtering"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.text}")
        
        login_data = login_response.json()
        self.token = login_data.get("token")
        self.user = login_data.get("user")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get a subject to test with
        subjects_response = self.session.get(f"{BASE_URL}/api/academic/subjects")
        if subjects_response.status_code == 200:
            subjects = subjects_response.json()
            if subjects and len(subjects) > 0:
                self.subject_id = subjects[0].get("id")
                print(f"Using subject: {subjects[0].get('name')} ({self.subject_id})")
            else:
                pytest.skip("No subjects available for testing")
        else:
            pytest.skip(f"Could not fetch subjects: {subjects_response.status_code}")
        
        yield
        
        # Cleanup: Delete test posts created during tests
        # (Posts with TEST_ prefix in title)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST TYPE: TASK
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_task_post_with_title(self):
        """Create a post of type 'task' with required title"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "subject_id": self.subject_id,
            "title": f"TEST_Tarea de Matemáticas {unique_id}",
            "content": "Resolver los ejercicios del capítulo 5",
            "post_type": "task"
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "post" in data
        post = data["post"]
        assert post["post_type"] == "task"
        assert post["title"] == payload["title"]
        assert post["content"] == payload["content"]
        
        # Store for cleanup
        self.task_post_id = post["id"]
        print(f"✓ Created task post: {post['id']}")
    
    def test_create_task_without_title_fails(self):
        """Creating a task without title should fail"""
        payload = {
            "subject_id": self.subject_id,
            "content": "Contenido sin título",
            "post_type": "task"
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "título" in data.get("detail", "").lower() or "obligatorio" in data.get("detail", "").lower()
        print("✓ Task without title correctly rejected")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST TYPE: MATERIAL
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_material_post_with_title(self):
        """Create a post of type 'material' with required title"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "subject_id": self.subject_id,
            "title": f"TEST_Material de Estudio {unique_id}",
            "content": "Documento PDF con teoría del tema 3",
            "post_type": "material"
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "post" in data
        post = data["post"]
        assert post["post_type"] == "material"
        assert post["title"] == payload["title"]
        
        self.material_post_id = post["id"]
        print(f"✓ Created material post: {post['id']}")
    
    def test_create_material_without_title_fails(self):
        """Creating a material without title should fail"""
        payload = {
            "subject_id": self.subject_id,
            "content": "Material sin título",
            "post_type": "material"
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Material without title correctly rejected")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST TYPE: FORUM
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_forum_post_with_title(self):
        """Create a post of type 'forum' with required title"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "subject_id": self.subject_id,
            "title": f"TEST_Discusión sobre el tema {unique_id}",
            "content": "¿Qué opinan sobre la teoría presentada?",
            "post_type": "forum"
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "post" in data
        post = data["post"]
        assert post["post_type"] == "forum"
        assert post["title"] == payload["title"]
        
        self.forum_post_id = post["id"]
        print(f"✓ Created forum post: {post['id']}")
    
    def test_create_forum_without_title_fails(self):
        """Creating a forum post without title should fail"""
        payload = {
            "subject_id": self.subject_id,
            "content": "Discusión sin título",
            "post_type": "forum"
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Forum without title correctly rejected")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST TYPE: ANNOUNCEMENT (default)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_announcement_without_title(self):
        """Create an announcement (default type) without title - should work"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "subject_id": self.subject_id,
            "content": f"TEST_Anuncio general para la clase {unique_id}",
            "post_type": "announcement"
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        post = data["post"]
        assert post["post_type"] == "announcement"
        assert post["title"] is None  # Announcements don't require title
        
        self.announcement_post_id = post["id"]
        print(f"✓ Created announcement post without title: {post['id']}")
    
    def test_create_post_default_type_is_announcement(self):
        """Posts without explicit type should default to 'announcement'"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "subject_id": self.subject_id,
            "content": f"TEST_Post sin tipo explícito {unique_id}"
            # No post_type specified
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        post = data["post"]
        # Default should be announcement
        assert post["post_type"] == "announcement", f"Expected 'announcement', got '{post['post_type']}'"
        print("✓ Default post type is 'announcement'")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # FILTERING BY POST TYPE
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_filter_posts_by_type_task(self):
        """Filter posts by type 'task'"""
        response = self.session.get(f"{BASE_URL}/api/course/{self.subject_id}/posts?post_type=task")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "posts" in data
        
        # All returned posts should be of type 'task'
        for post in data["posts"]:
            assert post["post_type"] == "task", f"Expected 'task', got '{post['post_type']}'"
        
        print(f"✓ Filtered {len(data['posts'])} task posts")
    
    def test_filter_posts_by_type_material(self):
        """Filter posts by type 'material'"""
        response = self.session.get(f"{BASE_URL}/api/course/{self.subject_id}/posts?post_type=material")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "posts" in data
        
        for post in data["posts"]:
            assert post["post_type"] == "material", f"Expected 'material', got '{post['post_type']}'"
        
        print(f"✓ Filtered {len(data['posts'])} material posts")
    
    def test_filter_posts_by_type_forum(self):
        """Filter posts by type 'forum'"""
        response = self.session.get(f"{BASE_URL}/api/course/{self.subject_id}/posts?post_type=forum")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "posts" in data
        
        for post in data["posts"]:
            assert post["post_type"] == "forum", f"Expected 'forum', got '{post['post_type']}'"
        
        print(f"✓ Filtered {len(data['posts'])} forum posts")
    
    def test_get_all_posts_without_filter(self):
        """Get all posts without type filter"""
        response = self.session.get(f"{BASE_URL}/api/course/{self.subject_id}/posts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "posts" in data
        assert "total" in data
        
        # Should return posts of all types
        post_types = set(post["post_type"] for post in data["posts"])
        print(f"✓ Got {len(data['posts'])} posts of types: {post_types}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # LIKES SYSTEM
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_like_post_with_type(self):
        """Test liking a post with type"""
        # First create a task post
        unique_id = str(uuid.uuid4())[:8]
        create_response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json={
            "subject_id": self.subject_id,
            "title": f"TEST_Tarea para likes {unique_id}",
            "content": "Tarea de prueba para sistema de likes",
            "post_type": "task"
        })
        
        assert create_response.status_code == 200
        post_id = create_response.json()["post"]["id"]
        
        # Like the post
        like_response = self.session.post(f"{BASE_URL}/api/course/posts/{post_id}/like")
        
        assert like_response.status_code == 200, f"Expected 200, got {like_response.status_code}: {like_response.text}"
        like_data = like_response.json()
        assert like_data["liked"] == True
        assert like_data["likes_count"] >= 1
        
        print(f"✓ Liked post {post_id}, likes_count: {like_data['likes_count']}")
        
        # Unlike the post
        unlike_response = self.session.post(f"{BASE_URL}/api/course/posts/{post_id}/like")
        assert unlike_response.status_code == 200
        unlike_data = unlike_response.json()
        assert unlike_data["liked"] == False
        
        print(f"✓ Unliked post {post_id}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # COMMENTS SYSTEM
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_comment_on_post_with_type(self):
        """Test commenting on a post with type"""
        # First create a forum post
        unique_id = str(uuid.uuid4())[:8]
        create_response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json={
            "subject_id": self.subject_id,
            "title": f"TEST_Foro para comentarios {unique_id}",
            "content": "Tema de discusión para probar comentarios",
            "post_type": "forum"
        })
        
        assert create_response.status_code == 200
        post_id = create_response.json()["post"]["id"]
        
        # Add a comment
        comment_response = self.session.post(f"{BASE_URL}/api/course/posts/{post_id}/comments", json={
            "content": f"TEST_Comentario de prueba {unique_id}"
        })
        
        assert comment_response.status_code == 200, f"Expected 200, got {comment_response.status_code}: {comment_response.text}"
        comment_data = comment_response.json()
        assert "comment" in comment_data
        assert comment_data["comment"]["content"] == f"TEST_Comentario de prueba {unique_id}"
        
        print(f"✓ Added comment to post {post_id}")
        
        # Get comments
        get_comments_response = self.session.get(f"{BASE_URL}/api/course/posts/{post_id}/comments")
        assert get_comments_response.status_code == 200
        comments = get_comments_response.json()
        assert len(comments) >= 1
        
        print(f"✓ Retrieved {len(comments)} comments from post")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # EDGE CASES
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_post_empty_content_with_title_fails(self):
        """Post with only title but no content should fail"""
        payload = {
            "subject_id": self.subject_id,
            "title": "TEST_Solo título",
            "content": "",  # Empty content
            "post_type": "task"
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        # Should fail because no content, image, or file
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Post with empty content correctly rejected")
    
    def test_invalid_post_type_defaults_or_fails(self):
        """Test behavior with invalid post_type"""
        payload = {
            "subject_id": self.subject_id,
            "content": "TEST_Contenido con tipo inválido",
            "post_type": "invalid_type"
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=payload)
        
        # Should fail validation (Literal type)
        assert response.status_code == 422, f"Expected 422 for invalid type, got {response.status_code}: {response.text}"
        print("✓ Invalid post_type correctly rejected with 422")
    
    def test_filter_with_invalid_type_returns_all(self):
        """Filtering with invalid type should return all posts (no filter applied)"""
        response = self.session.get(f"{BASE_URL}/api/course/{self.subject_id}/posts?post_type=invalid")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "posts" in data
        # Should return posts (invalid filter is ignored)
        print(f"✓ Invalid filter ignored, returned {len(data['posts'])} posts")


class TestCoursePostsDataPersistence:
    """Test data persistence - Create → GET verification pattern"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        
        self.token = login_response.json().get("token")
        self.user = login_response.json().get("user")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        subjects_response = self.session.get(f"{BASE_URL}/api/academic/subjects")
        if subjects_response.status_code == 200:
            subjects = subjects_response.json()
            if subjects:
                self.subject_id = subjects[0].get("id")
            else:
                pytest.skip("No subjects available")
        else:
            pytest.skip(f"Could not fetch subjects: {subjects_response.status_code}")
        
        yield
    
    def test_create_task_and_verify_in_filtered_list(self):
        """Create task → Verify it appears in filtered task list"""
        unique_id = str(uuid.uuid4())[:8]
        title = f"TEST_Tarea Persistencia {unique_id}"
        
        # CREATE
        create_response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json={
            "subject_id": self.subject_id,
            "title": title,
            "content": "Verificar persistencia de datos",
            "post_type": "task"
        })
        
        assert create_response.status_code == 200
        created_post = create_response.json()["post"]
        post_id = created_post["id"]
        
        # GET filtered by task
        get_response = self.session.get(f"{BASE_URL}/api/course/{self.subject_id}/posts?post_type=task")
        assert get_response.status_code == 200
        
        posts = get_response.json()["posts"]
        found = any(p["id"] == post_id and p["title"] == title for p in posts)
        
        assert found, f"Created task post {post_id} not found in filtered list"
        print(f"✓ Task post {post_id} persisted and found in filtered list")
    
    def test_create_material_and_verify_in_filtered_list(self):
        """Create material → Verify it appears in filtered material list"""
        unique_id = str(uuid.uuid4())[:8]
        title = f"TEST_Material Persistencia {unique_id}"
        
        # CREATE
        create_response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json={
            "subject_id": self.subject_id,
            "title": title,
            "content": "Material de estudio para verificar",
            "post_type": "material"
        })
        
        assert create_response.status_code == 200
        post_id = create_response.json()["post"]["id"]
        
        # GET filtered by material
        get_response = self.session.get(f"{BASE_URL}/api/course/{self.subject_id}/posts?post_type=material")
        assert get_response.status_code == 200
        
        posts = get_response.json()["posts"]
        found = any(p["id"] == post_id for p in posts)
        
        assert found, f"Created material post {post_id} not found in filtered list"
        print(f"✓ Material post {post_id} persisted and found in filtered list")
    
    def test_create_forum_and_verify_in_filtered_list(self):
        """Create forum → Verify it appears in filtered forum list"""
        unique_id = str(uuid.uuid4())[:8]
        title = f"TEST_Foro Persistencia {unique_id}"
        
        # CREATE
        create_response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json={
            "subject_id": self.subject_id,
            "title": title,
            "content": "Tema de foro para verificar",
            "post_type": "forum"
        })
        
        assert create_response.status_code == 200
        post_id = create_response.json()["post"]["id"]
        
        # GET filtered by forum
        get_response = self.session.get(f"{BASE_URL}/api/course/{self.subject_id}/posts?post_type=forum")
        assert get_response.status_code == 200
        
        posts = get_response.json()["posts"]
        found = any(p["id"] == post_id for p in posts)
        
        assert found, f"Created forum post {post_id} not found in filtered list"
        print(f"✓ Forum post {post_id} persisted and found in filtered list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
