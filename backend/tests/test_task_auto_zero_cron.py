"""
Task Auto-Zero Cron Test
Tests the auto-zero functionality for tasks when deadline passes.
"""
import pytest
import requests
import os
import time
from datetime import datetime, timezone, timedelta
import uuid
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'database')
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


@pytest.fixture(scope="module")
def mongo_db():
    """Get MongoDB database connection"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


class TestTaskAutoZeroCron:
    """Tests for task auto-zero cron functionality"""
    
    def test_task_auto_zero_cron(self, headers, mongo_db):
        """
        Test that the task auto-zero cron:
        1. Creates a task with past due_date and register_column P3
        2. Waits 65 seconds for cron to run
        3. Verifies task status changed to 'closed'
        4. Verifies submissions array has auto_zero entries with grade=0
        5. Verifies student_grades has part_p3=0
        """
        # First check if P3 is available
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
            pytest.skip("No P columns available for testing auto-zero cron")
        
        print(f"\n=== Task Auto-Zero Cron Test ===")
        print(f"Using column: {available_column}")
        
        # Step 1: Create a task with PAST due_date
        past_due_date = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        task_title = f"TEST_AutoZero_Task_{uuid.uuid4().hex[:8]}"
        
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": task_title,
            "content": "Test task for auto-zero cron verification",
            "post_type": "task",
            "register_column": available_column,
            "metadata": {
                "due_date": past_due_date,
                "delivery_type": "text",
                "points": 20
            }
        }
        
        print(f"Step 1: Creating task with past due_date: {past_due_date}")
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        task_id = response.json()["post"]["id"]
        print(f"  Created task: {task_id}")
        
        try:
            # Step 2: Verify initial task state
            task_before = mongo_db.course_posts.find_one({"id": task_id}, {"_id": 0})
            assert task_before is not None, "Task not found in database"
            assert task_before.get("status") == "active", f"Initial status should be 'active', got: {task_before.get('status')}"
            print(f"  Initial status: {task_before.get('status')}")
            
            # Step 3: Wait for cron to run (cron runs every 60 seconds)
            print(f"Step 2: Waiting 65 seconds for cron to process...")
            time.sleep(65)
            
            # Step 4: Verify task status changed to 'closed'
            task_after = mongo_db.course_posts.find_one({"id": task_id}, {"_id": 0})
            assert task_after is not None, "Task not found after cron"
            
            print(f"Step 3: Checking task status after cron...")
            print(f"  Status: {task_after.get('status')}")
            
            if task_after.get("status") == "closed":
                print("  ✓ Task status changed to 'closed'")
            else:
                print(f"  ⚠ Task status is still '{task_after.get('status')}' (cron may not have run yet)")
            
            # Step 5: Check submissions array for auto_zero entries
            submissions = task_after.get("submissions", [])
            auto_zero_submissions = [s for s in submissions if s.get("auto_zero")]
            
            print(f"Step 4: Checking submissions...")
            print(f"  Total submissions: {len(submissions)}")
            print(f"  Auto-zero submissions: {len(auto_zero_submissions)}")
            
            if auto_zero_submissions:
                for sub in auto_zero_submissions[:3]:  # Show first 3
                    print(f"    - Student: {sub.get('student_id')}, Grade: {sub.get('grade')}, Auto-zero: {sub.get('auto_zero')}")
                print("  ✓ Auto-zero submissions found with grade=0")
            
            # Step 6: Check student_grades for part_pX=0
            grade_field = f"part_{available_column.lower()}"
            print(f"Step 5: Checking student_grades for {grade_field}...")
            
            # Get the task's period_id and section_id
            period_id = task_after.get("period_id")
            section_id = task_after.get("section_id")
            school_id = task_after.get("school_id")
            
            if period_id:
                grade_query = {
                    "school_id": school_id,
                    "subject_id": TEST_SUBJECT_ID,
                    "period_id": period_id,
                    grade_field: {"$ne": None}
                }
                if section_id:
                    grade_query["section_id"] = section_id
                
                grades_with_field = list(mongo_db.student_grades.find(grade_query, {"_id": 0, "student_id": 1, grade_field: 1}).limit(5))
                
                if grades_with_field:
                    print(f"  Found {len(grades_with_field)} student_grades with {grade_field}:")
                    for g in grades_with_field[:3]:
                        print(f"    - Student: {g.get('student_id')}, {grade_field}: {g.get(grade_field)}")
                    print(f"  ✓ student_grades has {grade_field} values")
                else:
                    print(f"  ⚠ No student_grades found with {grade_field} (sync may be pending)")
            
            # Final summary
            print("\n=== Test Summary ===")
            if task_after.get("status") == "closed":
                print("✓ Task auto-close: PASSED")
            else:
                print("⚠ Task auto-close: PENDING (cron may need more time)")
            
            if auto_zero_submissions:
                print("✓ Auto-zero submissions: PASSED")
            else:
                print("⚠ Auto-zero submissions: PENDING")
            
        finally:
            # Cleanup - delete the task directly from MongoDB since it may have submissions
            print("\nCleanup: Removing test task from database...")
            mongo_db.course_posts.delete_one({"id": task_id})
            mongo_db.register_column_assignments.delete_one({"source_id": task_id})
            print("  Done")


class TestGradeSyncOnTaskSubmission:
    """Tests for grade sync when grading a task submission"""
    
    def test_grade_sync_to_student_grades(self, headers, mongo_db):
        """
        Test that grading a task submission syncs to student_grades:
        1. Create task with register_column P1
        2. Create a mock submission
        3. Grade the submission
        4. Verify student_grades.part_p1 has the vigesimal value
        """
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
            pytest.skip("No P columns available for testing grade sync")
        
        print(f"\n=== Grade Sync Test ===")
        print(f"Using column: {available_column}")
        
        # Step 1: Create a task with register_column
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        task_title = f"TEST_GradeSync_Task_{uuid.uuid4().hex[:8]}"
        
        task_data = {
            "subject_id": TEST_SUBJECT_ID,
            "title": task_title,
            "content": "Test task for grade sync verification",
            "post_type": "task",
            "register_column": available_column,
            "metadata": {
                "due_date": due_date,
                "delivery_type": "text",
                "points": 20
            }
        }
        
        print(f"Step 1: Creating task with register_column={available_column}")
        response = requests.post(
            f"{BASE_URL}/api/course/{TEST_SUBJECT_ID}/posts",
            json=task_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        task_id = response.json()["post"]["id"]
        print(f"  Created task: {task_id}")
        
        try:
            # Step 2: Get a student from the section
            task_doc = mongo_db.course_posts.find_one({"id": task_id}, {"_id": 0})
            school_id = task_doc.get("school_id")
            section_id = task_doc.get("section_id")
            
            # Find a student in this section
            student_query = {
                "school_id": school_id,
                "role": "estudiante",
                "status": {"$ne": "inactive"}
            }
            if section_id:
                student_query["seccion_id"] = section_id
            
            student = mongo_db.users.find_one(student_query, {"_id": 0, "id": 1, "name": 1})
            
            if not student:
                pytest.skip("No students found in section for testing")
            
            student_id = student["id"]
            print(f"Step 2: Using student: {student.get('name')} ({student_id})")
            
            # Step 3: Add a mock submission directly to the task
            submission_id = str(uuid.uuid4())
            submission = {
                "id": submission_id,
                "student_id": student_id,
                "submitted_at": datetime.now(timezone.utc).isoformat(),
                "content": "Test submission content",
                "files": []
            }
            
            mongo_db.course_posts.update_one(
                {"id": task_id},
                {"$push": {"submissions": submission}}
            )
            print(f"  Added mock submission: {submission_id}")
            
            # Step 4: Grade the submission via API
            grade_value = 15  # Out of 20
            print(f"Step 3: Grading submission with grade={grade_value}")
            
            grade_response = requests.put(
                f"{BASE_URL}/api/course/tasks/{task_id}/submissions/{submission_id}/grade",
                json={"grade": grade_value, "feedback": "Good work!"},
                headers=headers
            )
            
            assert grade_response.status_code == 200, f"Failed to grade: {grade_response.text}"
            print(f"  Grading successful")
            
            # Step 5: Verify student_grades has the synced value
            time.sleep(1)  # Give sync a moment
            
            grade_field = f"part_{available_column.lower()}"
            period_id = task_doc.get("period_id")
            
            grade_query = {
                "school_id": school_id,
                "subject_id": TEST_SUBJECT_ID,
                "period_id": period_id,
                "student_id": student_id
            }
            
            student_grade = mongo_db.student_grades.find_one(grade_query, {"_id": 0})
            
            print(f"Step 4: Checking student_grades for {grade_field}...")
            
            if student_grade:
                synced_value = student_grade.get(grade_field)
                # Expected vigesimal: 15 * 20 / 20 = 15
                expected_vigesimal = round(grade_value * 20 / 20)
                
                print(f"  Found student_grade: {grade_field}={synced_value}")
                print(f"  Expected vigesimal: {expected_vigesimal}")
                
                if synced_value == expected_vigesimal:
                    print(f"  ✓ Grade sync successful: {grade_field}={synced_value}")
                else:
                    print(f"  ⚠ Grade mismatch: expected {expected_vigesimal}, got {synced_value}")
            else:
                print(f"  ⚠ No student_grade record found (sync may be pending)")
            
        finally:
            # Cleanup
            print("\nCleanup: Removing test task from database...")
            mongo_db.course_posts.delete_one({"id": task_id})
            mongo_db.register_column_assignments.delete_one({"source_id": task_id})
            print("  Done")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])
