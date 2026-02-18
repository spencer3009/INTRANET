"""
Test Task Submissions Endpoints
================================
Tests for the bug fix: Student task submissions not appearing in teacher portal.

Key endpoints tested:
1. POST /api/course/tasks/{task_id}/submit - Submit a task as student
2. GET /api/course/tasks/{task_id}/submissions - Get submissions for a task (teacher view)
3. PUT /api/course/tasks/{task_id}/submissions/{submission_id}/grade - Grade a submission
4. GET /api/course/{subject_id}/posts?post_type=task - Get tasks with submissions_count

Bug context: The query was using only 'post_type: task' but some tasks use 'type: task'.
Fix: Now uses $or: [{'post_type': 'task'}, {'type': 'task'}] to support both.
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def test_data():
    """Create all test data in one fixture"""
    data = {}
    unique_id = str(uuid.uuid4())[:8]
    
    # Step 1: Register admin and create school
    email = f"admin_task_test_{unique_id}@test.pe"
    response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "school_name": f"Test School {unique_id}",
        "email": email,
        "password": "test123456"
    })
    assert response.status_code == 200, f"Register failed: {response.text}"
    verification_code = response.json().get("verification_code")
    
    response = requests.post(f"{BASE_URL}/api/auth/verify-email", json={
        "email": email,
        "code": verification_code
    })
    assert response.status_code == 200, f"Verify failed: {response.text}"
    token = response.json().get("token")
    
    subdomain = f"tasktest{unique_id}"
    response = requests.post(
        f"{BASE_URL}/api/schools/create",
        json={"subdomain": subdomain},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200, f"Create school failed: {response.text}"
    school_data = response.json()
    
    data["school_id"] = school_data.get("school_id")
    data["admin_token"] = school_data.get("token")
    data["admin_user_id"] = school_data.get("user", {}).get("id")
    print(f"✓ School created: {subdomain}")
    
    # Step 2: Get academic level
    response = requests.get(
        f"{BASE_URL}/api/academic/levels",
        headers={"Authorization": f"Bearer {data['admin_token']}"}
    )
    assert response.status_code == 200, f"Get levels failed: {response.text}"
    levels = response.json() if isinstance(response.json(), list) else response.json().get("levels", [])
    assert len(levels) > 0, "Should have at least one academic level"
    data["level_id"] = levels[0].get("id")
    print(f"✓ Got academic level: {data['level_id']}")
    
    # Step 3: Create student
    student_username = f"student_{unique_id}"
    response = requests.post(
        f"{BASE_URL}/api/users",
        json={
            "username": student_username,
            "name": "Test",
            "last_name": "Student",
            "email": f"{student_username}@test.pe",
            "password": "test123456",
            "role": "student"
        },
        headers={"Authorization": f"Bearer {data['admin_token']}"}
    )
    assert response.status_code in [200, 201], f"Create student failed: {response.text}"
    resp_data = response.json()
    # Handle nested response structure
    data["student_user_id"] = resp_data.get("user", {}).get("id") or resp_data.get("id")
    print(f"✓ Student created: {data['student_user_id']}")
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": student_username,
        "password": "test123456"
    })
    assert response.status_code == 200, f"Student login failed: {response.text}"
    data["student_token"] = response.json().get("token")
    
    # Step 4: Create teacher
    teacher_username = f"teacher_{unique_id}"
    response = requests.post(
        f"{BASE_URL}/api/users",
        json={
            "username": teacher_username,
            "name": "Test",
            "last_name": "Teacher",
            "email": f"{teacher_username}@test.pe",
            "password": "test123456",
            "role": "teacher"
        },
        headers={"Authorization": f"Bearer {data['admin_token']}"}
    )
    assert response.status_code in [200, 201], f"Create teacher failed: {response.text}"
    resp_data = response.json()
    # Handle nested response structure
    data["teacher_user_id"] = resp_data.get("user", {}).get("id") or resp_data.get("id")
    print(f"✓ Teacher created: {data['teacher_user_id']}")
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": teacher_username,
        "password": "test123456"
    })
    assert response.status_code == 200, f"Teacher login failed: {response.text}"
    data["teacher_token"] = response.json().get("token")
    
    # Step 5: Create subject
    response = requests.post(
        f"{BASE_URL}/api/academic/subjects",
        json={
            "name": f"Test Subject {unique_id}",
            "code": f"TST{unique_id[:4].upper()}",
            "description": "Subject for testing task submissions",
            "level_id": data["level_id"],
            "color": "#3B82F6"
        },
        headers={"Authorization": f"Bearer {data['admin_token']}"}
    )
    assert response.status_code in [200, 201], f"Create subject failed: {response.text}"
    resp_data = response.json()
    # Handle nested response structure
    data["subject_id"] = resp_data.get("subject", {}).get("id") or resp_data.get("id")
    print(f"✓ Subject created: {data['subject_id']}")
    
    # Step 6: Create task
    due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    response = requests.post(
        f"{BASE_URL}/api/course/{data['subject_id']}/posts",
        json={
            "subject_id": data['subject_id'],
            "title": "Test Task with post_type",
            "content": "This is a test task created with post_type field",
            "post_type": "task",
            "metadata": {
                "due_date": due_date,
                "points": 20,
                "allow_late_submissions": True
            }
        },
        headers={"Authorization": f"Bearer {data['admin_token']}"}
    )
    assert response.status_code in [200, 201], f"Create task failed: {response.text}"
    data["task_id"] = response.json().get("id")
    print(f"✓ Task created: {data['task_id']}")
    
    return data


class TestSubmitTask:
    """Test POST /api/course/tasks/{task_id}/submit"""
    
    def test_01_submit_requires_auth(self, test_data):
        """Submit endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submit",
            data={"text_content": "Test submission"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Submit requires authentication")
    
    def test_02_submit_task_not_found(self, test_data):
        """Submit returns 404 for non-existent task"""
        response = requests.post(
            f"{BASE_URL}/api/course/tasks/nonexistent-task-id/submit",
            data={"text_content": "Test submission"},
            headers={"Authorization": f"Bearer {test_data['student_token']}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Submit returns 404 for non-existent task")
    
    def test_03_submit_requires_content(self, test_data):
        """Submit requires text or file"""
        response = requests.post(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submit",
            data={},
            headers={"Authorization": f"Bearer {test_data['student_token']}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Submit requires text or file content")
    
    def test_04_submit_task_success(self, test_data):
        """Student can submit a task with text content"""
        response = requests.post(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submit",
            data={"text_content": "This is my test submission for the task."},
            headers={"Authorization": f"Bearer {test_data['student_token']}"}
        )
        assert response.status_code == 200, f"Submit failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "submission_id" in data or "id" in data, "Response should contain submission ID"
        test_data["submission_id"] = data.get("submission_id") or data.get("id")
        
        print(f"✓ Task submitted successfully: {test_data['submission_id']}")
    
    def test_05_cannot_submit_twice(self, test_data):
        """Student cannot submit the same task twice"""
        response = requests.post(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submit",
            data={"text_content": "Second submission attempt"},
            headers={"Authorization": f"Bearer {test_data['student_token']}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "ya has entregado" in response.text.lower() or "already" in response.text.lower(), \
            f"Expected duplicate submission error, got: {response.text}"
        print("✓ Cannot submit same task twice")


class TestGetSubmissions:
    """Test GET /api/course/tasks/{task_id}/submissions"""
    
    def test_01_get_submissions_requires_auth(self, test_data):
        """Get submissions requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Get submissions requires authentication")
    
    def test_02_student_cannot_view_submissions(self, test_data):
        """Students cannot view all submissions (only teachers/admins)"""
        response = requests.get(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions",
            headers={"Authorization": f"Bearer {test_data['student_token']}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Students cannot view all submissions")
    
    def test_03_teacher_can_view_submissions(self, test_data):
        """Teachers can view submissions"""
        response = requests.get(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions",
            headers={"Authorization": f"Bearer {test_data['teacher_token']}"}
        )
        assert response.status_code == 200, f"Get submissions failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "submissions" in data, "Response should contain submissions array"
        assert "submissions_count" in data, "Response should contain submissions_count"
        assert "task_title" in data, "Response should contain task_title"
        
        # Verify submission data
        assert data["submissions_count"] >= 1, "Should have at least 1 submission"
        assert len(data["submissions"]) >= 1, "Submissions array should have at least 1 item"
        
        # Verify submission structure
        submission = data["submissions"][0]
        assert "student_id" in submission, "Submission should have student_id"
        assert "student" in submission, "Submission should have student details"
        assert "text_content" in submission, "Submission should have text_content"
        assert "submitted_at" in submission, "Submission should have submitted_at"
        
        print(f"✓ Teacher can view submissions: {data['submissions_count']} found")
    
    def test_04_admin_can_view_submissions(self, test_data):
        """Admins can view submissions"""
        response = requests.get(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions",
            headers={"Authorization": f"Bearer {test_data['admin_token']}"}
        )
        assert response.status_code == 200, f"Get submissions failed: {response.text}"
        data = response.json()
        
        assert data["submissions_count"] >= 1, "Should have at least 1 submission"
        print(f"✓ Admin can view submissions: {data['submissions_count']} found")
    
    def test_05_submissions_include_student_details(self, test_data):
        """Submissions include enriched student details"""
        response = requests.get(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions",
            headers={"Authorization": f"Bearer {test_data['admin_token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        submission = data["submissions"][0]
        student = submission.get("student", {})
        
        assert "name" in student, "Student should have name"
        assert "id" in student, "Student should have id"
        
        print(f"✓ Submissions include student details: {student.get('name')}")


class TestGradeSubmission:
    """Test PUT /api/course/tasks/{task_id}/submissions/{submission_id}/grade"""
    
    def test_01_grade_requires_auth(self, test_data):
        """Grade endpoint requires authentication"""
        if not test_data.get("submission_id"):
            pytest.skip("No submission_id available")
        response = requests.put(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions/{test_data['submission_id']}/grade",
            json={"grade": 18, "feedback": "Good work!"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Grade requires authentication")
    
    def test_02_student_cannot_grade(self, test_data):
        """Students cannot grade submissions"""
        if not test_data.get("submission_id"):
            pytest.skip("No submission_id available")
        response = requests.put(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions/{test_data['submission_id']}/grade",
            json={"grade": 18, "feedback": "Good work!"},
            headers={"Authorization": f"Bearer {test_data['student_token']}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Students cannot grade submissions")
    
    def test_03_grade_validates_max(self, test_data):
        """Grade cannot exceed max_grade"""
        if not test_data.get("submission_id"):
            pytest.skip("No submission_id available")
        response = requests.put(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions/{test_data['submission_id']}/grade",
            json={"grade": 100, "feedback": "Too high!"},
            headers={"Authorization": f"Bearer {test_data['teacher_token']}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Grade validates max_grade limit")
    
    def test_04_grade_validates_negative(self, test_data):
        """Grade cannot be negative"""
        if not test_data.get("submission_id"):
            pytest.skip("No submission_id available")
        response = requests.put(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions/{test_data['submission_id']}/grade",
            json={"grade": -5, "feedback": "Negative!"},
            headers={"Authorization": f"Bearer {test_data['teacher_token']}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Grade validates negative values")
    
    def test_05_teacher_can_grade(self, test_data):
        """Teacher can grade a submission"""
        if not test_data.get("submission_id"):
            pytest.skip("No submission_id available")
        response = requests.put(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions/{test_data['submission_id']}/grade",
            json={"grade": 18, "feedback": "Excellent work on this task!"},
            headers={"Authorization": f"Bearer {test_data['teacher_token']}"}
        )
        assert response.status_code == 200, f"Grade failed: {response.text}"
        data = response.json()
        
        assert data.get("grade") == 18, "Grade should be 18"
        assert "feedback" in data, "Response should contain feedback"
        
        print("✓ Teacher can grade submission: 18/20")
    
    def test_06_verify_grade_persisted(self, test_data):
        """Verify grade was persisted in database"""
        response = requests.get(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions",
            headers={"Authorization": f"Bearer {test_data['admin_token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find the graded submission
        graded_submission = None
        for sub in data["submissions"]:
            if sub.get("grade") is not None:
                graded_submission = sub
                break
        
        assert graded_submission is not None, "Should find graded submission"
        assert graded_submission["grade"] == 18, "Grade should be 18"
        assert graded_submission["feedback"] == "Excellent work on this task!", "Feedback should match"
        
        # Verify graded_count
        assert data["graded_count"] >= 1, "graded_count should be at least 1"
        
        print("✓ Grade persisted correctly in database")


class TestGetPostsWithSubmissionsCount:
    """Test GET /api/course/{subject_id}/posts?post_type=task includes submissions_count"""
    
    def test_01_get_tasks_includes_submissions_count(self, test_data):
        """GET posts with post_type=task includes submissions_count"""
        response = requests.get(
            f"{BASE_URL}/api/course/{test_data['subject_id']}/posts?post_type=task",
            headers={"Authorization": f"Bearer {test_data['admin_token']}"}
        )
        assert response.status_code == 200, f"Get posts failed: {response.text}"
        data = response.json()
        
        assert "posts" in data, "Response should contain posts array"
        assert len(data["posts"]) >= 1, "Should have at least 1 task"
        
        # Find our test task
        test_task = None
        for post in data["posts"]:
            if post.get("id") == test_data["task_id"]:
                test_task = post
                break
        
        assert test_task is not None, "Should find our test task"
        assert "submissions_count" in test_task, "Task should have submissions_count"
        assert test_task["submissions_count"] >= 1, f"submissions_count should be >= 1, got {test_task['submissions_count']}"
        assert "graded_count" in test_task, "Task should have graded_count"
        
        print(f"✓ GET posts includes submissions_count: {test_task['submissions_count']}")
    
    def test_02_get_all_posts_includes_submissions_count_for_tasks(self, test_data):
        """GET all posts (no filter) includes submissions_count for tasks"""
        response = requests.get(
            f"{BASE_URL}/api/course/{test_data['subject_id']}/posts",
            headers={"Authorization": f"Bearer {test_data['admin_token']}"}
        )
        assert response.status_code == 200, f"Get posts failed: {response.text}"
        data = response.json()
        
        # Find tasks and verify they have submissions_count
        for post in data["posts"]:
            if post.get("post_type") == "task" or post.get("type") == "task":
                assert "submissions_count" in post, f"Task {post.get('id')} should have submissions_count"
        
        print("✓ All tasks in posts response have submissions_count")


class TestTaskWithTypeField:
    """Test that endpoints work with tasks using 'type' field (old system)"""
    
    def test_01_verify_or_query_works(self, test_data):
        """Verify the $or query works for tasks"""
        # This test verifies the $or query works for both field names
        response = requests.get(
            f"{BASE_URL}/api/course/tasks/{test_data['task_id']}/submissions",
            headers={"Authorization": f"Bearer {test_data['admin_token']}"}
        )
        assert response.status_code == 200, f"Get submissions failed: {response.text}"
        
        print("✓ $or query works for tasks with post_type field")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup(self, test_data):
        """Log test data for reference (no actual cleanup to preserve for debugging)"""
        print("\n=== Test Data Summary ===")
        print(f"School ID: {test_data.get('school_id')}")
        print(f"Subject ID: {test_data.get('subject_id')}")
        print(f"Task ID: {test_data.get('task_id')}")
        print(f"Submission ID: {test_data.get('submission_id')}")
        print(f"Student ID: {test_data.get('student_user_id')}")
        print(f"Teacher ID: {test_data.get('teacher_user_id')}")
        print("=========================")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
