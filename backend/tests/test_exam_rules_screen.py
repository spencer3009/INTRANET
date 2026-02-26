"""
Tests for pre-exam rules screen feature:
- GET /api/exams/{exam_id}/info endpoint
- Returns exam title, subject name, duration, status, questions count
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExamInfoEndpoint:
    """Tests for the GET /api/exams/{exam_id}/info endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@elroble.edu",
            "password": "1234abc8"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def exam_id(self):
        """The exam ID provided for testing"""
        return "222e2266-3309-4d96-9a5f-0d3f66b5a18d"
    
    def test_exam_info_endpoint_returns_200(self, auth_token, exam_id):
        """Test that /api/exams/{exam_id}/info returns 200 with valid token"""
        response = requests.get(
            f"{BASE_URL}/api/exams/{exam_id}/info",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"SUCCESS: GET /api/exams/{exam_id}/info returned 200")
    
    def test_exam_info_returns_correct_fields(self, auth_token, exam_id):
        """Test that response contains all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/exams/{exam_id}/info",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        # Required fields for rules screen
        required_fields = ["title", "subject_name", "subject_color", "duration_minutes", "questions_count", "status"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            print(f"SUCCESS: Field '{field}' present in response")
        
        # Verify field types
        assert isinstance(data["title"], str), "title should be string"
        assert isinstance(data["subject_name"], str), "subject_name should be string"
        assert isinstance(data["subject_color"], str), "subject_color should be string"
        assert isinstance(data["duration_minutes"], (int, type(None))), "duration_minutes should be int or None"
        assert isinstance(data["questions_count"], int), "questions_count should be int"
        assert isinstance(data["status"], str), "status should be string"
        print("SUCCESS: All field types are correct")
    
    def test_exam_info_returns_exam_data(self, auth_token, exam_id):
        """Test that response contains expected exam data"""
        response = requests.get(
            f"{BASE_URL}/api/exams/{exam_id}/info",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        # Verify exam has data
        assert len(data["title"]) > 0, "Exam title should not be empty"
        print(f"SUCCESS: Exam title is '{data['title']}'")
        
        # Subject info should be present (from /api endpoint test)
        assert "Matemáticas" in data["subject_name"] or len(data["subject_name"]) > 0
        print(f"SUCCESS: Subject name is '{data['subject_name']}'")
        
        # Color should be hex format
        assert data["subject_color"].startswith("#"), "subject_color should be hex format"
        print(f"SUCCESS: Subject color is '{data['subject_color']}'")
    
    def test_exam_info_requires_auth(self, exam_id):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/exams/{exam_id}/info")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("SUCCESS: Endpoint correctly requires authentication")
    
    def test_exam_info_not_found(self, auth_token):
        """Test that endpoint returns 404 for non-existent exam"""
        fake_exam_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/exams/{fake_exam_id}/info",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404 for non-existent exam, got {response.status_code}"
        print("SUCCESS: Returns 404 for non-existent exam")


class TestExamStartEndpoint:
    """Tests for the POST /api/exams/{exam_id}/start endpoint - owner restriction"""
    
    @pytest.fixture(scope="class")
    def owner_token(self):
        """Get owner authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@elroble.edu",
            "password": "1234abc8"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def exam_id(self):
        return "222e2266-3309-4d96-9a5f-0d3f66b5a18d"
    
    def test_owner_cannot_start_exam(self, owner_token, exam_id):
        """Test that owner (non-student) cannot start an exam"""
        response = requests.post(
            f"{BASE_URL}/api/exams/{exam_id}/start",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={}
        )
        # Should return 403 with "Solo los estudiantes pueden rendir exámenes"
        assert response.status_code == 403, f"Expected 403 for owner, got {response.status_code}"
        data = response.json()
        assert "estudiantes" in data.get("detail", "").lower() or "student" in data.get("detail", "").lower()
        print("SUCCESS: Owner correctly blocked from starting exam - only students can take exams")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
