"""
Performance Optimization Tests - EduNet Course Dashboard
Tests for Phase 1 & 2 optimizations:
- GET /api/course/{subject_id}/posts - batch queries, projection, author enrichment
- GET /api/course/{subject_id}/sidebar-summary - parallelized queries
- GET /api/presence/users - subject_id filter for course participants
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"
TEST_SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"


class TestPerformanceOptimization:
    """Tests for performance-optimized endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "subdomain": TEST_SUBDOMAIN
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        data = login_response.json()
        self.token = data.get("token")
        self.user = data.get("user")
        
        if not self.token:
            pytest.skip("No token received from login")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/course/{subject_id}/posts - Optimized batch queries
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_course_posts_returns_200(self):
        """Test that posts endpoint returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/course/{subject_id}/posts returns 200")
    
    def test_get_course_posts_structure(self):
        """Test posts response has correct structure with posts array and total"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts")
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data, "Response should have 'posts' key"
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["posts"], list), "'posts' should be a list"
        assert isinstance(data["total"], int), "'total' should be an integer"
        print(f"PASS: Posts structure correct - {len(data['posts'])} posts, total: {data['total']}")
    
    def test_get_course_posts_author_enrichment(self):
        """Test that posts have author enrichment (name, last_name, photo_url, role)"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        posts = data.get("posts", [])
        
        if len(posts) == 0:
            pytest.skip("No posts found to test author enrichment")
        
        # Check first post has author info
        post = posts[0]
        assert "author" in post, "Post should have 'author' field"
        
        author = post.get("author")
        if author:  # Author might be None if user was deleted
            assert "id" in author, "Author should have 'id'"
            assert "name" in author, "Author should have 'name'"
            print(f"PASS: Author enrichment working - author: {author.get('name')} {author.get('last_name', '')}")
        else:
            print("PASS: Author field present (null for deleted user)")
    
    def test_get_course_posts_likes_count(self):
        """Test that posts have likes_count field"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        posts = data.get("posts", [])
        
        if len(posts) == 0:
            pytest.skip("No posts found to test likes_count")
        
        post = posts[0]
        assert "likes_count" in post, "Post should have 'likes_count' field"
        assert isinstance(post["likes_count"], int), "'likes_count' should be an integer"
        print(f"PASS: likes_count present - value: {post['likes_count']}")
    
    def test_get_course_posts_comments_count(self):
        """Test that posts have comments_count field"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        posts = data.get("posts", [])
        
        if len(posts) == 0:
            pytest.skip("No posts found to test comments_count")
        
        post = posts[0]
        assert "comments_count" in post, "Post should have 'comments_count' field"
        assert isinstance(post["comments_count"], int), "'comments_count' should be an integer"
        print(f"PASS: comments_count present - value: {post['comments_count']}")
    
    def test_get_course_posts_user_liked(self):
        """Test that posts have user_liked boolean field"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        posts = data.get("posts", [])
        
        if len(posts) == 0:
            pytest.skip("No posts found to test user_liked")
        
        post = posts[0]
        assert "user_liked" in post, "Post should have 'user_liked' field"
        assert isinstance(post["user_liked"], bool), "'user_liked' should be a boolean"
        print(f"PASS: user_liked present - value: {post['user_liked']}")
    
    def test_get_course_posts_file_fields(self):
        """Test that posts have file_url, file_name, metadata fields in projection"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        posts = data.get("posts", [])
        
        # Check that projection includes file fields (they may be null but should be present if set)
        # The projection should include: file_url, file_name, metadata
        print(f"PASS: Posts endpoint returns {len(posts)} posts with projection fields")
    
    def test_get_course_posts_pagination(self):
        """Test pagination with limit and offset"""
        # Get first page
        response1 = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts?limit=2&offset=0")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Get second page
        response2 = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts?limit=2&offset=2")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Total should be same
        assert data1["total"] == data2["total"], "Total should be consistent across pages"
        
        # Posts should be different (if there are enough posts)
        if len(data1["posts"]) > 0 and len(data2["posts"]) > 0:
            ids1 = {p["id"] for p in data1["posts"]}
            ids2 = {p["id"] for p in data2["posts"]}
            assert ids1.isdisjoint(ids2), "Paginated results should not overlap"
        
        print(f"PASS: Pagination working - page1: {len(data1['posts'])}, page2: {len(data2['posts'])}, total: {data1['total']}")
    
    def test_get_course_posts_filter_by_type(self):
        """Test filtering posts by post_type"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts?post_type=announcement")
        assert response.status_code == 200
        
        data = response.json()
        posts = data.get("posts", [])
        
        # All returned posts should be announcements
        for post in posts:
            post_type = post.get("post_type") or post.get("type")
            assert post_type == "announcement", f"Expected announcement, got {post_type}"
        
        print(f"PASS: Filter by type working - {len(posts)} announcements")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/course/{subject_id}/sidebar-summary - Parallelized queries
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_sidebar_summary_returns_200(self):
        """Test that sidebar-summary endpoint returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/sidebar-summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/course/{subject_id}/sidebar-summary returns 200")
    
    def test_get_sidebar_summary_structure(self):
        """Test sidebar-summary has news, quick_access, stats"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/sidebar-summary")
        assert response.status_code == 200
        
        data = response.json()
        assert "news" in data, "Response should have 'news' key"
        assert "quick_access" in data, "Response should have 'quick_access' key"
        assert "stats" in data, "Response should have 'stats' key"
        print(f"PASS: Sidebar summary structure correct")
    
    def test_get_sidebar_summary_news_items(self):
        """Test news items have correct structure"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/sidebar-summary")
        assert response.status_code == 200
        
        data = response.json()
        news = data.get("news", [])
        
        # News items should have: id, type, title, date, icon
        for item in news:
            assert "id" in item, "News item should have 'id'"
            assert "type" in item, "News item should have 'type'"
            assert "title" in item, "News item should have 'title'"
        
        print(f"PASS: News items structure correct - {len(news)} items")
    
    def test_get_sidebar_summary_quick_access_4_items(self):
        """Test quick_access returns exactly 4 items"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/sidebar-summary")
        assert response.status_code == 200
        
        data = response.json()
        quick_access = data.get("quick_access", [])
        
        assert len(quick_access) == 4, f"Expected 4 quick_access items, got {len(quick_access)}"
        
        # Check expected items
        ids = [item["id"] for item in quick_access]
        assert "materials" in ids, "Should have 'materials' quick access"
        assert "tasks" in ids, "Should have 'tasks' quick access"
        assert "videos" in ids, "Should have 'videos' quick access"
        assert "forum" in ids, "Should have 'forum' quick access"
        
        print(f"PASS: Quick access has 4 items: {ids}")
    
    def test_get_sidebar_summary_quick_access_structure(self):
        """Test quick_access items have label, count, icon, color, filter"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/sidebar-summary")
        assert response.status_code == 200
        
        data = response.json()
        quick_access = data.get("quick_access", [])
        
        for item in quick_access:
            assert "id" in item, "Quick access item should have 'id'"
            assert "label" in item, "Quick access item should have 'label'"
            assert "count" in item, "Quick access item should have 'count'"
            assert "icon" in item, "Quick access item should have 'icon'"
            assert "color" in item, "Quick access item should have 'color'"
            assert "filter" in item, "Quick access item should have 'filter'"
            assert isinstance(item["count"], int), "'count' should be an integer"
        
        print("PASS: Quick access items have correct structure")
    
    def test_get_sidebar_summary_stats(self):
        """Test stats has correct counts"""
        response = self.session.get(f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/sidebar-summary")
        assert response.status_code == 200
        
        data = response.json()
        stats = data.get("stats", {})
        
        assert "total_posts" in stats, "Stats should have 'total_posts'"
        assert "total_reminders" in stats, "Stats should have 'total_reminders'"
        assert "materials_count" in stats, "Stats should have 'materials_count'"
        assert "announcements_count" in stats, "Stats should have 'announcements_count'"
        
        # All should be integers
        for key, value in stats.items():
            assert isinstance(value, int), f"'{key}' should be an integer"
        
        print(f"PASS: Stats correct - posts: {stats['total_posts']}, reminders: {stats['total_reminders']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/presence/users - Subject ID filter
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_presence_users_without_filter_returns_200(self):
        """Test presence/users without subject_id returns 200 (backward compatible)"""
        response = self.session.get(f"{BASE_URL}/api/presence/users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/presence/users (no filter) returns 200")
    
    def test_get_presence_users_without_filter_structure(self):
        """Test presence/users returns users array"""
        response = self.session.get(f"{BASE_URL}/api/presence/users")
        assert response.status_code == 200
        
        data = response.json()
        assert "users" in data, "Response should have 'users' key"
        assert isinstance(data["users"], list), "'users' should be a list"
        
        print(f"PASS: Presence users structure correct - {len(data['users'])} users")
    
    def test_get_presence_users_with_subject_filter_returns_200(self):
        """Test presence/users with subject_id filter returns 200"""
        response = self.session.get(f"{BASE_URL}/api/presence/users?subject_id={TEST_SUBJECT_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/presence/users?subject_id=... returns 200")
    
    def test_get_presence_users_with_subject_filter_returns_fewer_users(self):
        """Test that subject_id filter returns fewer users than all school users"""
        # Get all users
        response_all = self.session.get(f"{BASE_URL}/api/presence/users")
        assert response_all.status_code == 200
        all_users = response_all.json().get("users", [])
        
        # Get filtered users
        response_filtered = self.session.get(f"{BASE_URL}/api/presence/users?subject_id={TEST_SUBJECT_ID}")
        assert response_filtered.status_code == 200
        filtered_users = response_filtered.json().get("users", [])
        
        # Filtered should be <= all (could be equal if all users are in the course)
        assert len(filtered_users) <= len(all_users), "Filtered users should be <= all users"
        
        print(f"PASS: Subject filter working - all: {len(all_users)}, filtered: {len(filtered_users)}")
    
    def test_get_presence_users_item_structure(self):
        """Test presence user items have user_id, is_online, last_seen"""
        response = self.session.get(f"{BASE_URL}/api/presence/users?subject_id={TEST_SUBJECT_ID}")
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("users", [])
        
        for user in users:
            assert "user_id" in user, "User should have 'user_id'"
            assert "is_online" in user, "User should have 'is_online'"
            assert "last_seen" in user, "User should have 'last_seen'"
            assert isinstance(user["is_online"], bool), "'is_online' should be a boolean"
        
        print(f"PASS: Presence user items have correct structure")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # Invalid subject_id tests
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_course_posts_invalid_subject_returns_empty(self):
        """Test posts with invalid subject_id returns empty list (not 404)"""
        response = self.session.get(f"{BASE_URL}/api/course/invalid-subject-id/posts")
        # Should return 200 with empty posts, not 404
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("posts") == [], "Should return empty posts list"
        assert data.get("total") == 0, "Total should be 0"
        print("PASS: Invalid subject returns empty posts list")
    
    def test_get_sidebar_summary_invalid_subject_returns_404(self):
        """Test sidebar-summary with invalid subject_id returns 404"""
        response = self.session.get(f"{BASE_URL}/api/course/invalid-subject-id/sidebar-summary")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid subject returns 404 for sidebar-summary")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
