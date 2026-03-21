"""
Test Unified Register Linkage System
Tests for:
- GET /api/register/availability - unified availability endpoint
- POST /api/course/{subject_id}/posts with register_column for tasks
- Cross-collection conflict detection (exams vs tasks)
- Delete task releases column
- Legacy endpoint backward compatibility
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"
TEST_SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "subdomain": TEST_SUBDOMAIN}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("token") or data.get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestUnifiedRegisterAvailability:
    """Tests for GET /api/register/availability endpoint"""

    def test_availability_returns_200(self, api_client):
        """GET /api/register/availability returns 200 OK"""
        response = api_client.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/register/availability returns 200 OK")

    def test_availability_response_structure(self, api_client):
        """Availability returns period_name, period_active, availability with assigned_to"""
        response = api_client.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "period_id" in data, "Missing period_id"
        assert "period_name" in data, "Missing period_name"
        assert "period_active" in data, "Missing period_active"
        assert "availability" in data, "Missing availability"
        assert "register_status" in data, "Missing register_status"
        
        print(f"✓ Response has period_name: {data.get('period_name')}")
        print(f"✓ Response has period_active: {data.get('period_active')}")
        print(f"✓ Response has register_status: {data.get('register_status')}")

    def test_availability_has_all_columns(self, api_client):
        """Availability returns all 5 slots: EM, EB, P1, P2, P3"""
        response = api_client.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert response.status_code == 200
        data = response.json()
        availability = data.get("availability", {})
        
        expected_columns = ["EM", "EB", "P1", "P2", "P3"]
        for col in expected_columns:
            assert col in availability, f"Missing column {col} in availability"
            slot = availability[col]
            assert "available" in slot, f"Missing 'available' in slot {col}"
            assert "reason" in slot, f"Missing 'reason' in slot {col}"
            assert "assigned_to" in slot, f"Missing 'assigned_to' in slot {col}"
        
        print(f"✓ All 5 columns present: {list(availability.keys())}")

    def test_availability_assigned_to_structure(self, api_client):
        """assigned_to includes type/id/title for occupied columns"""
        response = api_client.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert response.status_code == 200
        data = response.json()
        availability = data.get("availability", {})
        
        # Find an occupied slot
        occupied_slots = [k for k, v in availability.items() if not v.get("available")]
        available_slots = [k for k, v in availability.items() if v.get("available")]
        
        print(f"✓ Occupied slots: {occupied_slots}")
        print(f"✓ Available slots: {available_slots}")
        
        # Check structure of occupied slots
        for col in occupied_slots:
            slot = availability[col]
            assert slot.get("reason") in ["exam", "task", "manual"], f"Invalid reason for {col}"
            assigned_to = slot.get("assigned_to")
            if assigned_to:
                assert "type" in assigned_to, f"Missing type in assigned_to for {col}"
                assert "id" in assigned_to, f"Missing id in assigned_to for {col}"
                assert "title" in assigned_to, f"Missing title in assigned_to for {col}"
                print(f"  - {col}: {assigned_to.get('type')} - {assigned_to.get('title')}")


class TestLegacyEndpoint:
    """Tests for legacy GET /api/exams/register-availability endpoint"""

    def test_legacy_endpoint_works(self, api_client):
        """Legacy endpoint GET /api/exams/register-availability still works"""
        response = api_client.get(
            f"{BASE_URL}/api/exams/register-availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have same structure as unified endpoint
        assert "availability" in data
        assert "period_id" in data
        print("✓ Legacy endpoint /api/exams/register-availability returns 200 OK")


class TestTaskRegisterLinkage:
    """Tests for task creation with register_column"""

    def test_create_task_with_p1_linkage(self, api_client):
        """POST /api/course/{subject_id}/posts with post_type=task and register_column=P1"""
        # First check if P1 is available
        avail_response = api_client.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert avail_response.status_code == 200
        availability = avail_response.json().get("availability", {})
        
        # Find an available P column
        available_p_col = None
        for col in ["P1", "P2", "P3"]:
            if availability.get(col, {}).get("available"):
                available_p_col = col
                break
        
        if not available_p_col:
            pytest.skip("No P columns available for testing")
        
        # Create task with register linkage
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Task_Linkage_{uuid.uuid4().hex[:8]}",
            "content": "Test task for register linkage",
            "post_type": "task",
            "register_column": available_p_col,
            "metadata": {
                "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "delivery_type": "digital",
                "points": 20
            }
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Response has task inside 'post' key
        post = data.get("post", data)
        
        # Verify task was created with register_column
        assert post.get("register_column") == available_p_col, f"Expected register_column={available_p_col}"
        print(f"✓ Task created with register_column={available_p_col}")
        
        # Store task ID for cleanup
        return post.get("id")

    def test_task_cannot_link_to_em(self, api_client):
        """POST /api/course/{subject_id}/posts with register_column=EM should return 400 for tasks"""
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Task_EM_{uuid.uuid4().hex[:8]}",
            "content": "Test task trying to link to EM",
            "post_type": "task",
            "register_column": "EM",
            "metadata": {
                "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "delivery_type": "digital",
                "points": 20
            }
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Task with register_column=EM correctly returns 400")

    def test_task_cannot_link_to_eb(self, api_client):
        """POST /api/course/{subject_id}/posts with register_column=EB should return 400 for tasks"""
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Task_EB_{uuid.uuid4().hex[:8]}",
            "content": "Test task trying to link to EB",
            "post_type": "task",
            "register_column": "EB",
            "metadata": {
                "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "delivery_type": "digital",
                "points": 20
            }
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Task with register_column=EB correctly returns 400")


class TestCrossCollectionConflict:
    """Tests for cross-collection conflict detection"""

    def test_cross_collection_conflict_task_then_exam(self, api_client):
        """Create task with P column, then try creating exam with same column should return 409"""
        # First check availability
        avail_response = api_client.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert avail_response.status_code == 200
        availability = avail_response.json().get("availability", {})
        
        # Find an available P column
        available_p_col = None
        for col in ["P1", "P2", "P3"]:
            if availability.get(col, {}).get("available"):
                available_p_col = col
                break
        
        if not available_p_col:
            pytest.skip("No P columns available for cross-collection conflict test")
        
        # Create task with the P column
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Conflict_Task_{uuid.uuid4().hex[:8]}",
            "content": "Test task for conflict detection",
            "post_type": "task",
            "register_column": available_p_col,
            "metadata": {
                "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "delivery_type": "digital",
                "points": 20
            }
        }
        
        task_response = api_client.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data
        )
        
        if task_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create task: {task_response.text}")
        
        task_id = task_response.json().get("post", {}).get("id") or task_response.json().get("id")
        print(f"✓ Created task with {available_p_col}: {task_id}")
        
        # Now try to create exam with same column - should fail with 409
        exam_data = {
            "title": f"TEST_Conflict_Exam_{uuid.uuid4().hex[:8]}",
            "description": "Test exam for conflict detection",
            "start_datetime": (datetime.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (datetime.now() + timedelta(days=1, hours=2)).isoformat(),
            "duration_minutes": 60,
            "register_column": available_p_col
        }
        
        exam_response = api_client.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json=exam_data
        )
        
        # Should return 409 Conflict
        assert exam_response.status_code == 409, f"Expected 409, got {exam_response.status_code}: {exam_response.text}"
        print(f"✓ Exam creation with same column ({available_p_col}) correctly returns 409 Conflict")
        
        # Cleanup: Delete the task
        delete_response = api_client.delete(f"{BASE_URL}/api/course/posts/{task_id}")
        print(f"  Cleanup: Deleted task {task_id}")


class TestDeleteReleasesColumn:
    """Tests for column release on delete"""

    def test_delete_task_releases_column(self, api_client):
        """Delete task releases the column (P column becomes available again)"""
        # First check availability
        avail_response = api_client.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert avail_response.status_code == 200
        availability = avail_response.json().get("availability", {})
        
        # Find an available P column
        available_p_col = None
        for col in ["P1", "P2", "P3"]:
            if availability.get(col, {}).get("available"):
                available_p_col = col
                break
        
        if not available_p_col:
            pytest.skip("No P columns available for delete test")
        
        # Create task with the P column
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Delete_Task_{uuid.uuid4().hex[:8]}",
            "content": "Test task for delete release",
            "post_type": "task",
            "register_column": available_p_col,
            "metadata": {
                "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "delivery_type": "digital",
                "points": 20
            }
        }
        
        task_response = api_client.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data
        )
        
        if task_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create task: {task_response.text}")
        
        task_id = task_response.json().get("post", {}).get("id") or task_response.json().get("id")
        print(f"✓ Created task with {available_p_col}: {task_id}")
        
        # Verify column is now taken
        avail_response2 = api_client.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert avail_response2.status_code == 200
        availability2 = avail_response2.json().get("availability", {})
        assert not availability2.get(available_p_col, {}).get("available"), f"{available_p_col} should be taken"
        print(f"✓ Column {available_p_col} is now taken")
        
        # Delete the task
        delete_response = api_client.delete(f"{BASE_URL}/api/course/posts/{task_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✓ Deleted task {task_id}")
        
        # Verify column is available again
        avail_response3 = api_client.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID}
        )
        assert avail_response3.status_code == 200
        availability3 = avail_response3.json().get("availability", {})
        assert availability3.get(available_p_col, {}).get("available"), f"{available_p_col} should be available again"
        print(f"✓ Column {available_p_col} is available again after delete")


class TestCleanup:
    """Cleanup test data"""

    def test_cleanup_test_tasks(self, api_client):
        """Clean up any TEST_ prefixed tasks"""
        # Get all tasks
        response = api_client.get(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            params={"post_type": "task", "limit": 100}
        )
        
        if response.status_code == 200:
            posts = response.json().get("posts", [])
            test_posts = [p for p in posts if p.get("title", "").startswith("TEST_")]
            
            for post in test_posts:
                try:
                    api_client.delete(f"{BASE_URL}/api/course/posts/{post['id']}")
                    print(f"  Cleaned up: {post.get('title')}")
                except Exception as e:
                    print(f"  Failed to clean up {post.get('id')}: {e}")
        
        print("✓ Cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
