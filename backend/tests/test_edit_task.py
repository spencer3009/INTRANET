"""
Test Edit Task Functionality - PUT /api/course/posts/{post_id}
Tests the ability to edit tasks in the Owner's portal CourseDetailPage
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEditTaskEndpoint:
    """Tests for PUT /api/course/posts/{post_id} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.school_id = None
        self.subject_id = None
        self.created_task_id = None
        
    def get_auth_token(self):
        """Get authentication token using test credentials"""
        # Try to login with known test credentials
        test_credentials = [
            {"email": "admin@test.pe", "password": "test123"},
            {"email": "director@demo.pe", "password": "test123"},
        ]
        
        for creds in test_credentials:
            try:
                response = self.session.post(f"{BASE_URL}/api/auth/login", json=creds)
                if response.status_code == 200:
                    data = response.json()
                    self.token = data.get("token")
                    self.school_id = data.get("user", {}).get("school_id")
                    self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                    return True
            except Exception:
                continue
        return False
    
    def get_subject_id(self):
        """Get a subject ID for testing"""
        if not self.token:
            return None
        
        # Get subjects list
        response = self.session.get(f"{BASE_URL}/api/subjects")
        if response.status_code == 200:
            subjects = response.json()
            if subjects and len(subjects) > 0:
                self.subject_id = subjects[0].get("id")
                return self.subject_id
        return None
    
    def create_test_task(self):
        """Create a test task for editing"""
        if not self.subject_id:
            return None
        
        due_date = (datetime.now() + timedelta(days=7)).isoformat()
        
        task_data = {
            "subject_id": self.subject_id,
            "title": "TEST_EDIT_TASK_Original Title",
            "content": "Tipo de entrega: Texto en línea | Puntos: 10\n\nFecha de entrega: " + due_date,
            "post_type": "task",
            "metadata": {
                "delivery_type": "text",
                "due_date": due_date,
                "show_to_students": True,
                "points": 10
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/course/{self.subject_id}/posts", json=task_data)
        if response.status_code == 200:
            data = response.json()
            self.created_task_id = data.get("post", {}).get("id")
            return self.created_task_id
        return None
    
    def cleanup_test_task(self):
        """Delete the test task after testing"""
        if self.created_task_id:
            try:
                self.session.delete(f"{BASE_URL}/api/course/posts/{self.created_task_id}")
            except Exception:
                pass
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ENDPOINT STRUCTURE TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_put_endpoint_exists(self):
        """Test that PUT /api/course/posts/{post_id} endpoint exists"""
        # Without auth, should return 401/403, not 404
        response = self.session.put(f"{BASE_URL}/api/course/posts/fake-id", json={})
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✓ PUT /api/course/posts/{post_id} endpoint exists")
    
    def test_put_endpoint_requires_auth(self):
        """Test that PUT endpoint requires authentication"""
        response = self.session.put(f"{BASE_URL}/api/course/posts/fake-id", json={"title": "Test"})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ PUT endpoint requires authentication")
    
    def test_put_endpoint_returns_404_for_nonexistent(self):
        """Test that PUT returns 404 for non-existent post"""
        if not self.get_auth_token():
            pytest.skip("Could not authenticate - database may be empty")
        
        response = self.session.put(
            f"{BASE_URL}/api/course/posts/nonexistent-post-id-12345",
            json={"title": "Test"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT returns 404 for non-existent post")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # FULL EDIT FLOW TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_edit_task_title(self):
        """Test editing task title"""
        if not self.get_auth_token():
            pytest.skip("Could not authenticate - database may be empty")
        
        if not self.get_subject_id():
            pytest.skip("No subjects found - database may be empty")
        
        if not self.create_test_task():
            pytest.skip("Could not create test task")
        
        try:
            # Edit the task title
            update_data = {"title": "TEST_EDIT_TASK_Updated Title"}
            response = self.session.put(
                f"{BASE_URL}/api/course/posts/{self.created_task_id}",
                json=update_data
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            
            # Verify response structure
            assert "message" in data, "Response should contain 'message'"
            assert "post" in data, "Response should contain 'post'"
            assert data["post"]["title"] == "TEST_EDIT_TASK_Updated Title", "Title should be updated"
            
            print("✓ Task title can be edited successfully")
        finally:
            self.cleanup_test_task()
    
    def test_edit_task_content(self):
        """Test editing task content"""
        if not self.get_auth_token():
            pytest.skip("Could not authenticate - database may be empty")
        
        if not self.get_subject_id():
            pytest.skip("No subjects found - database may be empty")
        
        if not self.create_test_task():
            pytest.skip("Could not create test task")
        
        try:
            # Edit the task content
            update_data = {"content": "Updated content for the task"}
            response = self.session.put(
                f"{BASE_URL}/api/course/posts/{self.created_task_id}",
                json=update_data
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            assert data["post"]["content"] == "Updated content for the task"
            
            print("✓ Task content can be edited successfully")
        finally:
            self.cleanup_test_task()
    
    def test_edit_task_metadata(self):
        """Test editing task metadata (due_date, delivery_type, show_to_students, points)"""
        if not self.get_auth_token():
            pytest.skip("Could not authenticate - database may be empty")
        
        if not self.get_subject_id():
            pytest.skip("No subjects found - database may be empty")
        
        if not self.create_test_task():
            pytest.skip("Could not create test task")
        
        try:
            # Edit the task metadata
            new_due_date = (datetime.now() + timedelta(days=14)).isoformat()
            update_data = {
                "metadata": {
                    "delivery_type": "files",
                    "due_date": new_due_date,
                    "show_to_students": False,
                    "points": 20
                }
            }
            response = self.session.put(
                f"{BASE_URL}/api/course/posts/{self.created_task_id}",
                json=update_data
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            
            # Verify metadata was updated
            assert "metadata" in data["post"], "Response should contain metadata"
            metadata = data["post"]["metadata"]
            assert metadata["delivery_type"] == "files", "delivery_type should be updated"
            assert metadata["show_to_students"] == False, "show_to_students should be updated"
            assert metadata["points"] == 20, "points should be updated"
            
            print("✓ Task metadata can be edited successfully")
        finally:
            self.cleanup_test_task()
    
    def test_edit_task_full_update(self):
        """Test editing all task fields at once"""
        if not self.get_auth_token():
            pytest.skip("Could not authenticate - database may be empty")
        
        if not self.get_subject_id():
            pytest.skip("No subjects found - database may be empty")
        
        if not self.create_test_task():
            pytest.skip("Could not create test task")
        
        try:
            new_due_date = (datetime.now() + timedelta(days=21)).isoformat()
            update_data = {
                "title": "TEST_EDIT_TASK_Fully Updated Title",
                "content": "Tipo de entrega: Texto y archivos | Puntos: 30\n\nFecha de entrega: " + new_due_date,
                "metadata": {
                    "delivery_type": "both",
                    "due_date": new_due_date,
                    "show_to_students": True,
                    "points": 30
                }
            }
            response = self.session.put(
                f"{BASE_URL}/api/course/posts/{self.created_task_id}",
                json=update_data
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            
            # Verify all fields were updated
            post = data["post"]
            assert post["title"] == "TEST_EDIT_TASK_Fully Updated Title"
            assert "Texto y archivos" in post["content"]
            assert post["metadata"]["delivery_type"] == "both"
            assert post["metadata"]["points"] == 30
            
            print("✓ Full task update works correctly")
        finally:
            self.cleanup_test_task()
    
    def test_edit_task_verify_persistence(self):
        """Test that edits are persisted by fetching the task again"""
        if not self.get_auth_token():
            pytest.skip("Could not authenticate - database may be empty")
        
        if not self.get_subject_id():
            pytest.skip("No subjects found - database may be empty")
        
        if not self.create_test_task():
            pytest.skip("Could not create test task")
        
        try:
            # Edit the task
            update_data = {"title": "TEST_EDIT_TASK_Persisted Title"}
            response = self.session.put(
                f"{BASE_URL}/api/course/posts/{self.created_task_id}",
                json=update_data
            )
            assert response.status_code == 200
            
            # Fetch tasks and verify the edit persisted
            response = self.session.get(f"{BASE_URL}/api/course/{self.subject_id}/posts?post_type=task&limit=100")
            assert response.status_code == 200
            
            data = response.json()
            posts = data.get("posts", [])
            
            # Find our edited task
            edited_task = next((p for p in posts if p["id"] == self.created_task_id), None)
            assert edited_task is not None, "Edited task should be found in posts list"
            assert edited_task["title"] == "TEST_EDIT_TASK_Persisted Title", "Title should be persisted"
            
            print("✓ Task edits are persisted correctly")
        finally:
            self.cleanup_test_task()


class TestCoursePostUpdateModel:
    """Tests for CoursePostUpdate Pydantic model structure"""
    
    def test_model_accepts_metadata_field(self):
        """Verify that the CoursePostUpdate model accepts metadata field"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try to login
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.pe",
            "password": "test123"
        })
        
        if response.status_code != 200:
            pytest.skip("Could not authenticate - database may be empty")
        
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a subject
        response = session.get(f"{BASE_URL}/api/subjects")
        if response.status_code != 200 or not response.json():
            pytest.skip("No subjects found")
        
        subject_id = response.json()[0]["id"]
        
        # Create a test task
        task_data = {
            "subject_id": subject_id,
            "title": "TEST_MODEL_Task",
            "content": "Test content",
            "post_type": "task",
            "metadata": {"delivery_type": "text", "points": 10}
        }
        response = session.post(f"{BASE_URL}/api/course/{subject_id}/posts", json=task_data)
        
        if response.status_code != 200:
            pytest.skip("Could not create test task")
        
        task_id = response.json().get("post", {}).get("id")
        
        try:
            # Try to update with metadata - this should NOT return 422 (validation error)
            update_data = {
                "metadata": {
                    "delivery_type": "files",
                    "due_date": "2026-02-15T23:59:00",
                    "show_to_students": True,
                    "points": 25
                }
            }
            response = session.put(f"{BASE_URL}/api/course/posts/{task_id}", json=update_data)
            
            # Should not be 422 (validation error) - metadata field should be accepted
            assert response.status_code != 422, f"CoursePostUpdate model should accept metadata field, got 422: {response.text}"
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            print("✓ CoursePostUpdate model accepts metadata field")
        finally:
            session.delete(f"{BASE_URL}/api/course/posts/{task_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
