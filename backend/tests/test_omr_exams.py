"""
OMR Exam Feature Tests - Phase 1
Tests for OMR (Optical Mark Recognition) exam support:
- Create OMR exam with num_questions, options_per_question, points_per_question
- Create digital exam still works (requires start_datetime, end_datetime)
- OMR exam does NOT require start_datetime or end_datetime
- Update answer_key for OMR exams
- Validate answer_key length matches num_questions
- Validate answer_key letters match options_per_question
- GET exam returns all OMR fields
- List exams shows both digital and OMR types
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SUBJECT_ID = "97ef0442-551b-413f-8bf8-b5c2e31aee41"  # Ciencias Naturales
EXISTING_OMR_EXAM_ID = "7b859047-f6cb-4760-b945-2e17b58c0099"

@pytest.fixture(scope="module")
def auth_token():
    """Login and get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@elroble.edu",
        "password": "1234abc8"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    return data["token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    """Auth headers for requests"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

@pytest.fixture
def cleanup_exam_ids():
    """Track exam IDs for cleanup"""
    ids = []
    yield ids
    # Cleanup is handled in individual tests

class TestOMRExamCreation:
    """Tests for creating OMR exams"""
    
    def test_create_omr_exam_success(self, headers, cleanup_exam_ids):
        """POST /api/course/{subject_id}/exams with type='omr' creates exam correctly"""
        payload = {
            "title": f"TEST_OMR_Exam_{uuid.uuid4().hex[:8]}",
            "description": "Test OMR exam",
            "type": "omr",
            "num_questions": 15,
            "options_per_question": 4,
            "points_per_question": 2.0
        }
        response = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Failed to create OMR exam: {response.text}"
        data = response.json()
        
        # Verify OMR fields
        assert data["type"] == "omr"
        assert data["num_questions"] == 15
        assert data["options_per_question"] == 4
        assert data["points_per_question"] == 2.0
        assert data["total_points"] == 30.0  # 15 * 2.0
        assert data["status"] == "draft"
        
        # OMR exams should NOT have start_datetime/end_datetime
        assert "start_datetime" not in data or data.get("start_datetime") is None
        assert "end_datetime" not in data or data.get("end_datetime") is None
        
        cleanup_exam_ids.append(data["id"])
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{data['id']}", headers=headers)
        print(f"PASS: Created OMR exam with id={data['id']}")
    
    def test_create_omr_exam_without_dates(self, headers):
        """OMR exam does NOT require start_datetime or end_datetime"""
        payload = {
            "title": f"TEST_OMR_NoDates_{uuid.uuid4().hex[:8]}",
            "type": "omr",
            "num_questions": 10,
            "options_per_question": 5
        }
        response = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=payload, headers=headers)
        
        assert response.status_code == 200, f"OMR exam should not require dates: {response.text}"
        data = response.json()
        assert data["type"] == "omr"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{data['id']}", headers=headers)
        print("PASS: OMR exam created without dates")
    
    def test_create_omr_exam_validates_num_questions_range(self, headers):
        """num_questions must be between 5 and 100"""
        # Too few questions
        payload = {
            "title": "TEST_OMR_TooFew",
            "type": "omr",
            "num_questions": 3,
            "options_per_question": 4
        }
        response = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=payload, headers=headers)
        assert response.status_code == 400, "Should reject num_questions < 5"
        
        # Too many questions
        payload["num_questions"] = 150
        response = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=payload, headers=headers)
        assert response.status_code == 400, "Should reject num_questions > 100"
        print("PASS: num_questions validation works (5-100)")
    
    def test_create_omr_exam_validates_options_range(self, headers):
        """options_per_question must be between 2 and 5"""
        payload = {
            "title": "TEST_OMR_BadOptions",
            "type": "omr",
            "num_questions": 10,
            "options_per_question": 1
        }
        response = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=payload, headers=headers)
        assert response.status_code == 400, "Should reject options_per_question < 2"
        
        payload["options_per_question"] = 7
        response = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=payload, headers=headers)
        assert response.status_code == 400, "Should reject options_per_question > 5"
        print("PASS: options_per_question validation works (2-5)")


class TestDigitalExamStillWorks:
    """Ensure digital exams still work as before"""
    
    def test_create_digital_exam_requires_dates(self, headers):
        """Digital exam requires start_datetime and end_datetime"""
        payload = {
            "title": "TEST_Digital_NoDates",
            "type": "digital"
        }
        response = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=payload, headers=headers)
        assert response.status_code == 400, "Digital exam should require dates"
        assert "fechas" in response.text.lower() or "requeridas" in response.text.lower()
        print("PASS: Digital exam requires dates")
    
    def test_create_digital_exam_success(self, headers):
        """Digital exam with dates works correctly"""
        payload = {
            "title": f"TEST_Digital_{uuid.uuid4().hex[:8]}",
            "type": "digital",
            "start_datetime": "2026-02-01T09:00:00",
            "end_datetime": "2026-02-01T10:00:00",
            "duration_minutes": 60,
            "min_score_percentage": 60
        }
        response = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Failed to create digital exam: {response.text}"
        data = response.json()
        
        assert data["type"] == "digital"
        assert data["start_datetime"] is not None
        assert data["end_datetime"] is not None
        assert data["duration_minutes"] == 60
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{data['id']}", headers=headers)
        print("PASS: Digital exam created with dates")


class TestAnswerKeyValidation:
    """Tests for answer_key validation on OMR exams"""
    
    def test_update_answer_key_success(self, headers):
        """PUT /api/exams/{exam_id} with answer_key saves correctly"""
        # First create an OMR exam
        create_payload = {
            "title": f"TEST_OMR_AnswerKey_{uuid.uuid4().hex[:8]}",
            "type": "omr",
            "num_questions": 5,
            "options_per_question": 4
        }
        create_resp = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=create_payload, headers=headers)
        assert create_resp.status_code == 200
        exam_id = create_resp.json()["id"]
        
        # Update with answer_key
        answer_key = ["A", "B", "C", "D", "A"]
        update_resp = requests.put(f"{BASE_URL}/api/exams/{exam_id}", json={"answer_key": answer_key}, headers=headers)
        
        assert update_resp.status_code == 200, f"Failed to update answer_key: {update_resp.text}"
        data = update_resp.json()
        assert data["answer_key"] == answer_key
        
        # Verify with GET
        get_resp = requests.get(f"{BASE_URL}/api/exams/{exam_id}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["answer_key"] == answer_key
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{exam_id}", headers=headers)
        print("PASS: answer_key saved and retrieved correctly")
    
    def test_answer_key_length_validation(self, headers):
        """answer_key length must match num_questions"""
        # Create OMR exam with 5 questions
        create_payload = {
            "title": f"TEST_OMR_KeyLen_{uuid.uuid4().hex[:8]}",
            "type": "omr",
            "num_questions": 5,
            "options_per_question": 4
        }
        create_resp = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=create_payload, headers=headers)
        assert create_resp.status_code == 200
        exam_id = create_resp.json()["id"]
        
        # Try to set answer_key with wrong length (3 instead of 5)
        wrong_key = ["A", "B", "C"]
        update_resp = requests.put(f"{BASE_URL}/api/exams/{exam_id}", json={"answer_key": wrong_key}, headers=headers)
        
        assert update_resp.status_code == 400, "Should reject answer_key with wrong length"
        assert "5" in update_resp.text  # Should mention expected length
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{exam_id}", headers=headers)
        print("PASS: answer_key length validation works")
    
    def test_answer_key_letter_validation(self, headers):
        """answer_key letters must match options_per_question (e.g., 4 options = only A-D)"""
        # Create OMR exam with 4 options (A-D only) - minimum 5 questions
        create_payload = {
            "title": f"TEST_OMR_KeyLetters_{uuid.uuid4().hex[:8]}",
            "type": "omr",
            "num_questions": 5,
            "options_per_question": 4  # Only A, B, C, D valid
        }
        create_resp = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=create_payload, headers=headers)
        assert create_resp.status_code == 200, f"Failed to create exam: {create_resp.text}"
        exam_id = create_resp.json()["id"]
        
        # Try to set answer_key with invalid letter 'E' (only A-D allowed)
        invalid_key = ["A", "E", "C", "D", "A"]  # 'E' is invalid for 4 options
        update_resp = requests.put(f"{BASE_URL}/api/exams/{exam_id}", json={"answer_key": invalid_key}, headers=headers)
        
        assert update_resp.status_code == 400, "Should reject answer_key with invalid letter"
        assert "E" in update_resp.text or "invalida" in update_resp.text.lower()
        
        # Valid key should work
        valid_key = ["A", "D", "C", "B", "A"]
        update_resp = requests.put(f"{BASE_URL}/api/exams/{exam_id}", json={"answer_key": valid_key}, headers=headers)
        assert update_resp.status_code == 200, f"Valid key should work: {update_resp.text}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{exam_id}", headers=headers)
        print("PASS: answer_key letter validation works (A-D for 4 options)")


class TestGetExamOMRFields:
    """Tests for GET exam returning OMR fields"""
    
    def test_get_exam_returns_omr_fields(self, headers):
        """GET /api/exams/{exam_id} returns all OMR fields"""
        # Use existing OMR exam or create one
        create_payload = {
            "title": f"TEST_OMR_GetFields_{uuid.uuid4().hex[:8]}",
            "type": "omr",
            "num_questions": 10,
            "options_per_question": 5,
            "points_per_question": 1.5
        }
        create_resp = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=create_payload, headers=headers)
        assert create_resp.status_code == 200
        exam_id = create_resp.json()["id"]
        
        # Set answer_key
        answer_key = ["A", "B", "C", "D", "E", "A", "B", "C", "D", "E"]
        requests.put(f"{BASE_URL}/api/exams/{exam_id}", json={"answer_key": answer_key}, headers=headers)
        
        # GET and verify all fields
        get_resp = requests.get(f"{BASE_URL}/api/exams/{exam_id}", headers=headers)
        assert get_resp.status_code == 200
        data = get_resp.json()
        
        assert data["type"] == "omr"
        assert data["num_questions"] == 10
        assert data["options_per_question"] == 5
        assert data["answer_key"] == answer_key
        assert data["points_per_question"] == 1.5
        assert data["total_points"] == 15.0  # 10 * 1.5
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{exam_id}", headers=headers)
        print("PASS: GET exam returns all OMR fields")
    
    def test_get_existing_omr_exam(self, headers):
        """GET existing OMR exam returns correct data"""
        get_resp = requests.get(f"{BASE_URL}/api/exams/{EXISTING_OMR_EXAM_ID}", headers=headers)
        
        if get_resp.status_code == 404:
            pytest.skip("Existing OMR exam not found - may have been deleted")
        
        assert get_resp.status_code == 200
        data = get_resp.json()
        
        assert data["type"] == "omr"
        assert "num_questions" in data
        assert "options_per_question" in data
        print(f"PASS: Existing OMR exam retrieved - {data.get('num_questions')} questions, {data.get('options_per_question')} options")


class TestListExamsBothTypes:
    """Tests for listing both digital and OMR exams"""
    
    def test_list_exams_shows_both_types(self, headers):
        """GET /api/course/{subject_id}/exams lists both digital and OMR exams"""
        # Create one of each type
        omr_payload = {
            "title": f"TEST_OMR_List_{uuid.uuid4().hex[:8]}",
            "type": "omr",
            "num_questions": 10,
            "options_per_question": 4
        }
        digital_payload = {
            "title": f"TEST_Digital_List_{uuid.uuid4().hex[:8]}",
            "type": "digital",
            "start_datetime": "2026-03-01T09:00:00",
            "end_datetime": "2026-03-01T10:00:00",
            "duration_minutes": 60
        }
        
        omr_resp = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=omr_payload, headers=headers)
        digital_resp = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=digital_payload, headers=headers)
        
        assert omr_resp.status_code == 200
        assert digital_resp.status_code == 200
        
        omr_id = omr_resp.json()["id"]
        digital_id = digital_resp.json()["id"]
        
        # List exams
        list_resp = requests.get(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", headers=headers)
        assert list_resp.status_code == 200
        exams = list_resp.json()
        
        # Find our test exams
        omr_found = any(e["id"] == omr_id and e["type"] == "omr" for e in exams)
        digital_found = any(e["id"] == digital_id and e["type"] == "digital" for e in exams)
        
        assert omr_found, "OMR exam not found in list"
        assert digital_found, "Digital exam not found in list"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{omr_id}", headers=headers)
        requests.delete(f"{BASE_URL}/api/exams/{digital_id}", headers=headers)
        print("PASS: List exams shows both OMR and digital types")


class TestAnswerKeyWithNulls:
    """Tests for answer_key with null values (unanswered questions)"""
    
    def test_answer_key_allows_nulls(self, headers):
        """answer_key can have null values for unanswered questions"""
        create_payload = {
            "title": f"TEST_OMR_NullKey_{uuid.uuid4().hex[:8]}",
            "type": "omr",
            "num_questions": 5,
            "options_per_question": 4
        }
        create_resp = requests.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=create_payload, headers=headers)
        assert create_resp.status_code == 200
        exam_id = create_resp.json()["id"]
        
        # Set answer_key with some nulls
        answer_key = ["A", None, "C", None, "D"]
        update_resp = requests.put(f"{BASE_URL}/api/exams/{exam_id}", json={"answer_key": answer_key}, headers=headers)
        
        assert update_resp.status_code == 200, f"Should allow nulls in answer_key: {update_resp.text}"
        assert update_resp.json()["answer_key"] == answer_key
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/exams/{exam_id}", headers=headers)
        print("PASS: answer_key allows null values")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
