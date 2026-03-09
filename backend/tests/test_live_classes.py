"""
Live Classes Module Tests
Tests for live class creation, management, and student attendance tracking.
Endpoints tested:
- POST /api/live-classes (create live class - teacher only)
- GET /api/live-classes (list classes by role)
- PUT /api/live-classes/{id} (update class - teacher owner)
- DELETE /api/live-classes/{id} (delete class - teacher owner)
- POST /api/live-classes/{id}/join (student joins class)
- GET /api/live-classes/{id}/attendance (attendance list)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEACHER_JORGE = {"email": "jorge@gmail.com", "password": "1234abc8"}  # section 953644f5
TEACHER_JULIA = {"email": "julia@gmail.com", "password": "1234abc8"}  # sections 0c2bcf8d, 953644f5
STUDENT_CARLOS = {"email": "carlos234@gmail.com", "password": "1234abc8"}  # section 0c2bcf8d


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def teacher_jorge_token(api_client):
    """Get authentication token for teacher Jorge"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_JORGE["email"],
        "password": TEACHER_JORGE["password"],
        "subdomain": "demosettings"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip(f"Jorge login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def teacher_julia_token(api_client):
    """Get authentication token for teacher Julia"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_JULIA["email"],
        "password": TEACHER_JULIA["password"],
        "subdomain": "demosettings"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip(f"Julia login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def student_carlos_token(api_client):
    """Get authentication token for student Carlos"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_CARLOS["email"],
        "password": STUDENT_CARLOS["password"],
        "subdomain": "demosettings"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip(f"Carlos login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def teacher_jorge_info(api_client, teacher_jorge_token):
    """Get teacher Jorge's info including courses"""
    response = api_client.get(f"{BASE_URL}/api/teacher/courses", 
                              headers={"Authorization": f"Bearer {teacher_jorge_token}"})
    if response.status_code == 200:
        data = response.json()
        courses = data.get("courses", [])
        return {"courses": courses, "token": teacher_jorge_token}
    return {"courses": [], "token": teacher_jorge_token}


@pytest.fixture(scope="module")
def teacher_julia_info(api_client, teacher_julia_token):
    """Get teacher Julia's info including courses"""
    response = api_client.get(f"{BASE_URL}/api/teacher/courses", 
                              headers={"Authorization": f"Bearer {teacher_julia_token}"})
    if response.status_code == 200:
        data = response.json()
        courses = data.get("courses", [])
        return {"courses": courses, "token": teacher_julia_token}
    return {"courses": [], "token": teacher_julia_token}


class TestAuthRequired:
    """Test that endpoints require authentication"""
    
    def test_list_classes_requires_auth(self, api_client):
        """GET /api/live-classes requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/live-classes")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/live-classes requires authentication")
    
    def test_create_class_requires_auth(self, api_client):
        """POST /api/live-classes requires authentication"""
        response = api_client.post(f"{BASE_URL}/api/live-classes", json={
            "title": "Test Class",
            "subject_id": "test",
            "section_id": "test",
            "date": "2026-01-15",
            "start_time": "10:00",
            "end_time": "11:00",
            "meeting_link": "https://meet.google.com/abc"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: POST /api/live-classes requires authentication")


class TestTeacherListClasses:
    """Test teacher viewing their live classes"""
    
    def test_teacher_jorge_can_list_classes(self, api_client, teacher_jorge_token):
        """Teacher Jorge can list their live classes"""
        response = api_client.get(f"{BASE_URL}/api/live-classes", 
                                  headers={"Authorization": f"Bearer {teacher_jorge_token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "classes" in data, "Response should contain 'classes' key"
        print(f"PASS: Teacher Jorge can list classes - found {len(data['classes'])} classes")
    
    def test_teacher_julia_can_list_classes(self, api_client, teacher_julia_token):
        """Teacher Julia can list their live classes"""
        response = api_client.get(f"{BASE_URL}/api/live-classes", 
                                  headers={"Authorization": f"Bearer {teacher_julia_token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "classes" in data, "Response should contain 'classes' key"
        print(f"PASS: Teacher Julia can list classes - found {len(data['classes'])} classes")


class TestStudentListClasses:
    """Test student viewing live classes for their section"""
    
    def test_student_carlos_can_list_classes(self, api_client, student_carlos_token):
        """Student Carlos can list live classes for their section"""
        response = api_client.get(f"{BASE_URL}/api/live-classes", 
                                  headers={"Authorization": f"Bearer {student_carlos_token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "classes" in data, "Response should contain 'classes' key"
        print(f"PASS: Student Carlos can list classes - found {len(data['classes'])} classes")


class TestCreateLiveClass:
    """Test creating live classes - teacher only"""
    
    def test_student_cannot_create_class(self, api_client, student_carlos_token):
        """Student cannot create a live class"""
        response = api_client.post(f"{BASE_URL}/api/live-classes", 
                                   headers={"Authorization": f"Bearer {student_carlos_token}"},
                                   json={
                                       "title": "Test Class",
                                       "subject_id": "test",
                                       "section_id": "test",
                                       "date": "2026-01-20",
                                       "start_time": "10:00",
                                       "end_time": "11:00",
                                       "meeting_link": "https://meet.google.com/abc"
                                   })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Student cannot create live class (403 forbidden)")
    
    def test_teacher_create_class_invalid_times(self, api_client, teacher_julia_info):
        """Teacher cannot create class with invalid times (start >= end)"""
        token = teacher_julia_info["token"]
        courses = teacher_julia_info["courses"]
        if not courses:
            pytest.skip("No courses available for Julia")
        
        course = courses[0]
        response = api_client.post(f"{BASE_URL}/api/live-classes", 
                                   headers={"Authorization": f"Bearer {token}"},
                                   json={
                                       "title": "Invalid Times Class",
                                       "subject_id": course.get("id"),
                                       "section_id": course.get("section_id"),
                                       "date": "2026-01-20",
                                       "start_time": "11:00",
                                       "end_time": "10:00",  # end before start
                                       "meeting_link": "https://meet.google.com/abc"
                                   })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Teacher cannot create class with invalid times")
    
    def test_teacher_create_class_success(self, api_client, teacher_julia_info):
        """Teacher can create a live class with valid data"""
        token = teacher_julia_info["token"]
        courses = teacher_julia_info["courses"]
        if not courses:
            pytest.skip("No courses available for Julia")
        
        course = courses[0]
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = api_client.post(f"{BASE_URL}/api/live-classes", 
                                   headers={"Authorization": f"Bearer {token}"},
                                   json={
                                       "title": "TEST_Live Class - Math Review",
                                       "description": "Test class created by pytest",
                                       "subject_id": course.get("id"),
                                       "section_id": course.get("section_id"),
                                       "date": tomorrow,
                                       "start_time": "14:00",
                                       "end_time": "15:00",
                                       "meeting_link": "meet.google.com/test-class",  # without https://
                                       "platform": "meet"
                                   })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Response should contain class id"
        assert data.get("title") == "TEST_Live Class - Math Review"
        assert data.get("meeting_link", "").startswith("https://"), "Meeting link should be sanitized to https"
        assert data.get("status") in ["scheduled", "active", "finished"]
        print(f"PASS: Teacher created live class successfully - ID: {data.get('id')}")
        # Store class ID for cleanup
        teacher_julia_info["test_class_id"] = data.get("id")
    
    def test_teacher_create_class_wrong_section(self, api_client, teacher_jorge_info):
        """Teacher cannot create class for a section they don't have assignment for"""
        token = teacher_jorge_info["token"]
        # Jorge doesn't have assignment for section 0c2bcf8d
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = api_client.post(f"{BASE_URL}/api/live-classes", 
                                   headers={"Authorization": f"Bearer {token}"},
                                   json={
                                       "title": "Unauthorized Class",
                                       "subject_id": "fake-subject",
                                       "section_id": "0c2bcf8d",  # Julia's section
                                       "date": tomorrow,
                                       "start_time": "10:00",
                                       "end_time": "11:00",
                                       "meeting_link": "https://zoom.us/test"
                                   })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Teacher cannot create class for unauthorized section")


class TestUpdateLiveClass:
    """Test updating live classes - teacher owner only"""
    
    def test_teacher_update_own_class(self, api_client, teacher_julia_info):
        """Teacher can update their own live class"""
        token = teacher_julia_info["token"]
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.put(f"{BASE_URL}/api/live-classes/{class_id}", 
                                  headers={"Authorization": f"Bearer {token}"},
                                  json={
                                      "title": "TEST_Updated Class Title",
                                      "description": "Updated description",
                                      "start_time": "14:30",
                                      "end_time": "15:30"
                                  })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("title") == "TEST_Updated Class Title"
        assert data.get("start_time") == "14:30"
        print("PASS: Teacher updated their own class successfully")
    
    def test_other_teacher_cannot_update(self, api_client, teacher_jorge_token, teacher_julia_info):
        """Another teacher cannot update someone else's class"""
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.put(f"{BASE_URL}/api/live-classes/{class_id}", 
                                  headers={"Authorization": f"Bearer {teacher_jorge_token}"},
                                  json={
                                      "title": "Hijacked Title"
                                  })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Another teacher cannot update someone else's class")
    
    def test_student_cannot_update_class(self, api_client, student_carlos_token, teacher_julia_info):
        """Student cannot update a live class"""
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.put(f"{BASE_URL}/api/live-classes/{class_id}", 
                                  headers={"Authorization": f"Bearer {student_carlos_token}"},
                                  json={
                                      "title": "Student Hijack"
                                  })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Student cannot update live class")


class TestJoinLiveClass:
    """Test student joining live classes and attendance tracking"""
    
    def test_teacher_cannot_join_class(self, api_client, teacher_julia_info):
        """Teacher cannot join a class (only students)"""
        token = teacher_julia_info["token"]
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.post(f"{BASE_URL}/api/live-classes/{class_id}/join", 
                                   headers={"Authorization": f"Bearer {token}"},
                                   json={})
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Teacher cannot join live class (403)")
    
    def test_student_join_class_not_available(self, api_client, student_carlos_token, teacher_julia_info):
        """Student cannot join a scheduled class more than 10 min before start"""
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.post(f"{BASE_URL}/api/live-classes/{class_id}/join", 
                                   headers={"Authorization": f"Bearer {student_carlos_token}"},
                                   json={})
        # Class is scheduled for tomorrow, so should not be available yet
        # Could be 400 (not available) or 403 (wrong section)
        assert response.status_code in [400, 403], f"Expected 400/403, got {response.status_code}: {response.text}"
        print(f"PASS: Student cannot join class yet (status: {response.status_code})")


class TestGetAttendance:
    """Test getting attendance list for a live class"""
    
    def test_get_attendance_list(self, api_client, teacher_julia_info):
        """Teacher can get attendance list for their class"""
        token = teacher_julia_info["token"]
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.get(f"{BASE_URL}/api/live-classes/{class_id}/attendance", 
                                  headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "attendance" in data, "Response should contain 'attendance' key"
        assert "class_info" in data, "Response should contain 'class_info' key"
        print(f"PASS: Teacher can view attendance - {len(data['attendance'])} students")


class TestDeleteLiveClass:
    """Test deleting live classes - teacher owner only"""
    
    def test_student_cannot_delete_class(self, api_client, student_carlos_token, teacher_julia_info):
        """Student cannot delete a live class"""
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.delete(f"{BASE_URL}/api/live-classes/{class_id}", 
                                     headers={"Authorization": f"Bearer {student_carlos_token}"})
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Student cannot delete live class")
    
    def test_other_teacher_cannot_delete(self, api_client, teacher_jorge_token, teacher_julia_info):
        """Another teacher cannot delete someone else's class"""
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.delete(f"{BASE_URL}/api/live-classes/{class_id}", 
                                     headers={"Authorization": f"Bearer {teacher_jorge_token}"})
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Another teacher cannot delete someone else's class")
    
    def test_teacher_delete_own_class(self, api_client, teacher_julia_info):
        """Teacher can delete their own live class"""
        token = teacher_julia_info["token"]
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.delete(f"{BASE_URL}/api/live-classes/{class_id}", 
                                     headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        print("PASS: Teacher deleted their own class successfully")
    
    def test_verify_class_deleted(self, api_client, teacher_julia_info):
        """Verify the class was actually deleted"""
        token = teacher_julia_info["token"]
        class_id = teacher_julia_info.get("test_class_id")
        if not class_id:
            pytest.skip("No test class created")
        
        response = api_client.get(f"{BASE_URL}/api/live-classes/{class_id}", 
                                  headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Class verified as deleted")


class TestClassStatusComputation:
    """Test that class status is computed correctly"""
    
    def test_classes_have_computed_status(self, api_client, teacher_julia_token):
        """Classes returned have computed status field"""
        response = api_client.get(f"{BASE_URL}/api/live-classes", 
                                  headers={"Authorization": f"Bearer {teacher_julia_token}"})
        assert response.status_code == 200
        data = response.json()
        classes = data.get("classes", [])
        for c in classes:
            assert "status" in c, "Each class should have 'status' field"
            assert c["status"] in ["scheduled", "active", "finished"], f"Invalid status: {c['status']}"
        print(f"PASS: All {len(classes)} classes have valid computed status")
    
    def test_classes_have_enriched_fields(self, api_client, teacher_julia_token):
        """Classes returned have enriched fields (teacher_name, subject_name)"""
        response = api_client.get(f"{BASE_URL}/api/live-classes", 
                                  headers={"Authorization": f"Bearer {teacher_julia_token}"})
        assert response.status_code == 200
        data = response.json()
        classes = data.get("classes", [])
        for c in classes:
            assert "teacher_name" in c, "Each class should have 'teacher_name' field"
            assert "subject_name" in c, "Each class should have 'subject_name' field"
            assert "attendance_count" in c, "Each class should have 'attendance_count' field"
        print(f"PASS: All classes have enriched fields (teacher_name, subject_name, attendance_count)")


class TestMeetingLinkSanitization:
    """Test that meeting links are properly sanitized"""
    
    def test_link_without_protocol_gets_https(self, api_client, teacher_julia_info):
        """Meeting link without protocol gets https:// prefix"""
        token = teacher_julia_info["token"]
        courses = teacher_julia_info["courses"]
        if not courses:
            pytest.skip("No courses available for Julia")
        
        course = courses[0]
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        
        response = api_client.post(f"{BASE_URL}/api/live-classes", 
                                   headers={"Authorization": f"Bearer {token}"},
                                   json={
                                       "title": "TEST_Link Sanitization Test",
                                       "subject_id": course.get("id"),
                                       "section_id": course.get("section_id"),
                                       "date": tomorrow,
                                       "start_time": "09:00",
                                       "end_time": "10:00",
                                       "meeting_link": "zoom.us/j/12345",  # without protocol
                                       "platform": "zoom"
                                   })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("meeting_link", "").startswith("https://"), "Link should be sanitized with https://"
        print("PASS: Meeting link without protocol gets https:// prefix")
        
        # Cleanup
        class_id = data.get("id")
        if class_id:
            api_client.delete(f"{BASE_URL}/api/live-classes/{class_id}", 
                             headers={"Authorization": f"Bearer {token}"})
