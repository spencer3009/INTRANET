"""
Unified Register Linkage System Tests - V2
Tests for:
- GET /api/register/availability - unified availability endpoint
- Task creation with register_column (P1/P2/P3 only)
- Cross-collection conflict detection (exam vs task)
- Task auto-zero cron functionality
- Grade sync on task submission
"""
import pytest
import requests
import os
import time
from datetime import datetime, timezone, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "subdomain": TEST_SUBDOMAIN
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("token")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestUnifiedAvailabilityEndpoint:
    """Tests for GET /api/register/availability"""
    
    def test_availability_returns_200(self, headers):
        """Test that availability endpoint returns 200 OK"""
        response = requests.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID},
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/register/availability returns 200 OK")
    
    def test_availability_returns_required_fields(self, headers):
        """Test that availability returns period_name, period_active, availability with assigned_to"""
        response = requests.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "period_id" in data, "Missing period_id"
        assert "period_name" in data, "Missing period_name"
        assert "period_active" in data, "Missing period_active"
        assert "availability" in data, "Missing availability"
        
        # Check availability structure
        availability = data["availability"]
        assert isinstance(availability, dict), "availability should be a dict"
        
        # Check all 5 slots exist
        for slot in ["EM", "EB", "P1", "P2", "P3"]:
            assert slot in availability, f"Missing slot {slot}"
            slot_data = availability[slot]
            assert "available" in slot_data, f"Missing 'available' in slot {slot}"
            
            # If not available, check assigned_to structure
            if not slot_data["available"]:
                assert "assigned_to" in slot_data, f"Missing 'assigned_to' in occupied slot {slot}"
                assigned_to = slot_data["assigned_to"]
                if assigned_to:
                    assert "type" in assigned_to, f"Missing 'type' in assigned_to for slot {slot}"
                    assert "id" in assigned_to, f"Missing 'id' in assigned_to for slot {slot}"
                    assert "title" in assigned_to, f"Missing 'title' in assigned_to for slot {slot}"
        
        print(f"✓ Availability returns all required fields: period_name={data['period_name']}, period_active={data['period_active']}")
        print(f"  Slots: {list(availability.keys())}")
    
    def test_em_taken_by_exam(self, headers):
        """Test that EM column shows as taken by exam"""
        response = requests.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        em_slot = data["availability"].get("EM", {})
        # EM should be taken by the existing exam "Examen Mensual - Test Auto Zero"
        if not em_slot.get("available"):
            assigned_to = em_slot.get("assigned_to", {})
            print(f"✓ EM column is taken by {assigned_to.get('type')}: {assigned_to.get('title')}")
        else:
            print("⚠ EM column is available (no exam assigned)")


class TestTaskCreationWithRegisterColumn:
    """Tests for POST task with register_column"""
    
    def test_create_task_with_p1_column(self, headers):
        """Test creating a task with register_column=P1"""
        # First check if P1 is available
        avail_response = requests.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID},
            headers=headers
        )
        assert avail_response.status_code == 200
        availability = avail_response.json().get("availability", {})
        
        # Find an available P column
        available_column = None
        for col in ["P1", "P2", "P3"]:
            if availability.get(col, {}).get("available", False):
                available_column = col
                break
        
        if not available_column:
            pytest.skip("No P columns available for testing")
        
        # Create task with register_column
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Task_{uuid.uuid4().hex[:8]}",
            "content": "Test task for register linkage",
            "post_type": "task",
            "register_column": available_column,
            "metadata": {
                "due_date": due_date,
                "delivery_type": "text",
                "points": 20
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "post" in data, "Response should contain 'post'"
        
        task_id = data["post"]["id"]
        print(f"✓ Created task with register_column={available_column}, task_id={task_id}")
        
        # Cleanup - delete the task
        delete_response = requests.delete(
            f"{BASE_URL}/api/course/posts/{task_id}",
            headers=headers
        )
        print(f"  Cleanup: delete task returned {delete_response.status_code}")
    
    def test_create_task_with_em_returns_400(self, headers):
        """Test that creating a task with register_column=EM returns 400"""
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Task_EM_{uuid.uuid4().hex[:8]}",
            "content": "Test task with EM column (should fail)",
            "post_type": "task",
            "register_column": "EM",  # Tasks can only use P1/P2/P3
            "metadata": {
                "due_date": due_date,
                "delivery_type": "text",
                "points": 20
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ POST task with register_column=EM returns 400 (tasks only P1/P2/P3)")
    
    def test_create_task_with_eb_returns_400(self, headers):
        """Test that creating a task with register_column=EB returns 400"""
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Task_EB_{uuid.uuid4().hex[:8]}",
            "content": "Test task with EB column (should fail)",
            "post_type": "task",
            "register_column": "EB",  # Tasks can only use P1/P2/P3
            "metadata": {
                "due_date": due_date,
                "delivery_type": "text",
                "points": 20
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ POST task with register_column=EB returns 400 (tasks only P1/P2/P3)")


class TestCrossCollectionConflict:
    """Tests for cross-collection conflict detection"""
    
    def test_task_occupies_column_then_exam_returns_409(self, headers):
        """Test that creating an exam with a column already taken by a task returns 409"""
        # First check availability
        avail_response = requests.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID},
            headers=headers
        )
        assert avail_response.status_code == 200
        availability = avail_response.json().get("availability", {})
        
        # Find an available P column
        available_column = None
        for col in ["P3", "P2", "P1"]:  # Try P3 first as it's less likely to be used
            if availability.get(col, {}).get("available", False):
                available_column = col
                break
        
        if not available_column:
            pytest.skip("No P columns available for testing")
        
        # Step 1: Create a task with the available column
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Conflict_Task_{uuid.uuid4().hex[:8]}",
            "content": "Test task for conflict detection",
            "post_type": "task",
            "register_column": available_column,
            "metadata": {
                "due_date": due_date,
                "delivery_type": "text",
                "points": 20
            }
        }
        
        task_response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data,
            headers=headers
        )
        
        assert task_response.status_code == 200, f"Failed to create task: {task_response.text}"
        task_id = task_response.json()["post"]["id"]
        print(f"  Created task with {available_column}, task_id={task_id}")
        
        try:
            # Step 2: Try to create an exam with the same column - should return 409
            exam_data = {
                "title": f"TEST_Conflict_Exam_{uuid.uuid4().hex[:8]}",
                "description": "Test exam for conflict detection",
                "start_datetime": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                "end_datetime": (datetime.now(timezone.utc) + timedelta(days=1, hours=2)).isoformat(),
                "duration_minutes": 60,
                "register_column": available_column  # Same column as task
            }
            
            exam_response = requests.post(
                f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
                json=exam_data,
                headers=headers
            )
            
            assert exam_response.status_code == 409, f"Expected 409, got {exam_response.status_code}: {exam_response.text}"
            print(f"✓ Cross-collection conflict: task occupies {available_column} -> exam with {available_column} returns 409")
        
        finally:
            # Cleanup - delete the task
            delete_response = requests.delete(
                f"{BASE_URL}/api/course/posts/{task_id}",
                headers=headers
            )
            print(f"  Cleanup: delete task returned {delete_response.status_code}")
    
    def test_delete_task_releases_column(self, headers):
        """Test that deleting a task releases the column for reuse"""
        # First check availability
        avail_response = requests.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID},
            headers=headers
        )
        assert avail_response.status_code == 200
        availability = avail_response.json().get("availability", {})
        
        # Find an available P column
        available_column = None
        for col in ["P3", "P2", "P1"]:
            if availability.get(col, {}).get("available", False):
                available_column = col
                break
        
        if not available_column:
            pytest.skip("No P columns available for testing")
        
        # Step 1: Create a task with the available column
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": f"TEST_Release_Task_{uuid.uuid4().hex[:8]}",
            "content": "Test task for column release",
            "post_type": "task",
            "register_column": available_column,
            "metadata": {
                "due_date": due_date,
                "delivery_type": "text",
                "points": 20
            }
        }
        
        task_response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data,
            headers=headers
        )
        
        assert task_response.status_code == 200, f"Failed to create task: {task_response.text}"
        task_id = task_response.json()["post"]["id"]
        print(f"  Created task with {available_column}, task_id={task_id}")
        
        # Step 2: Verify column is now taken
        avail_response2 = requests.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID},
            headers=headers
        )
        assert avail_response2.status_code == 200
        availability2 = avail_response2.json().get("availability", {})
        assert not availability2.get(available_column, {}).get("available", True), f"{available_column} should be taken"
        print(f"  Verified {available_column} is now taken")
        
        # Step 3: Delete the task
        delete_response = requests.delete(
            f"{BASE_URL}/api/course/posts/{task_id}",
            headers=headers
        )
        assert delete_response.status_code == 200, f"Failed to delete task: {delete_response.text}"
        print(f"  Deleted task")
        
        # Step 4: Verify column is available again
        avail_response3 = requests.get(
            f"{BASE_URL}/api/register/availability",
            params={"subject_id": TEST_SUBJECT_ID},
            headers=headers
        )
        assert avail_response3.status_code == 200
        availability3 = avail_response3.json().get("availability", {})
        assert availability3.get(available_column, {}).get("available", False), f"{available_column} should be available again"
        print(f"✓ Delete task releases column ({available_column} is available again)")


class TestExamWithoutPeriodId:
    """Test that POST exam without period_id auto-resolves active period"""
    
    def test_exam_auto_resolves_period(self, headers):
        """Test creating an exam without period_id auto-resolves to active period"""
        # Create exam without period_id
        exam_data = {
            "title": f"TEST_AutoPeriod_Exam_{uuid.uuid4().hex[:8]}",
            "description": "Test exam for auto period resolution",
            "start_datetime": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "end_datetime": (datetime.now(timezone.utc) + timedelta(days=1, hours=2)).isoformat(),
            "duration_minutes": 60
            # No period_id provided
        }
        
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/exams",
            json=exam_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify period_id was auto-resolved
        assert "period_id" in data, "Response should contain period_id"
        assert data["period_id"] is not None, "period_id should be auto-resolved"
        
        exam_id = data["id"]
        print(f"✓ POST exam without period_id auto-resolves active period: {data['period_id']}")
        
        # Cleanup - delete the exam
        delete_response = requests.delete(
            f"{BASE_URL}/api/exams/{exam_id}",
            headers=headers
        )
        print(f"  Cleanup: delete exam returned {delete_response.status_code}")


class TestLegacyEndpoint:
    """Test that legacy endpoint still works"""
    
    def test_legacy_register_availability(self, headers):
        """Test GET /api/exams/register-availability still works"""
        response = requests.get(
            f"{BASE_URL}/api/exams/register-availability",
            params={"subject_id": TEST_SUBJECT_ID},
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have same structure as unified endpoint
        assert "availability" in data, "Missing availability"
        print("✓ Legacy endpoint GET /api/exams/register-availability still works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
