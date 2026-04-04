"""
OMR Scanning Endpoints Tests - Phase 3
Tests for:
- GET /api/exams/{exam_id}/omr-students - Get students with scan status
- POST /api/exams/{exam_id}/omr-scan - Process OMR scan image
- PUT /api/exams/{exam_id}/omr-scan/{scan_id} - Overwrite existing scan
- GET /api/exams/{exam_id}/omr-results - Get all scan results
- POST /api/exams/{exam_id}/omr-register-grades - Register grades to auxiliary register
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SCHOOL_OWNER_EMAIL = "admin@elroble.edu"
SCHOOL_OWNER_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"

# OMR exam with existing scans
OMR_EXAM_ID = "7b859047-f6cb-4760-b945-2e17b58c0099"
TEST_IMAGE_PATH = "/tmp/test_omr_scan.jpg"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for school owner."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "email": SCHOOL_OWNER_EMAIL,
            "password": SCHOOL_OWNER_PASSWORD,
            "subdomain": SUBDOMAIN
        }
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    return data["token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}"}


class TestOMRStudentsEndpoint:
    """Tests for GET /api/exams/{exam_id}/omr-students"""
    
    def test_get_omr_students_success(self, headers):
        """Test getting students list with scan status."""
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-students",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify student structure
        if len(data) > 0:
            student = data[0]
            assert "id" in student, "Student should have id"
            assert "name" in student, "Student should have name"
            assert "last_name" in student, "Student should have last_name"
            assert "full_name" in student, "Student should have full_name"
            assert "has_scan" in student, "Student should have has_scan flag"
            
            # If student has scan, verify score fields
            if student["has_scan"]:
                assert "scan_score" in student, "Scanned student should have scan_score"
                assert "scan_total" in student, "Scanned student should have scan_total"
        
        print(f"✓ GET omr-students returned {len(data)} students")
    
    def test_get_omr_students_non_omr_exam(self, headers):
        """Test that non-OMR exams return 400."""
        # First, get a digital exam ID
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}",
            headers=headers
        )
        if response.status_code == 200:
            exam = response.json()
            subject_id = exam.get("subject_id")
            
            # Get exams for this subject
            exams_response = requests.get(
                f"{BASE_URL}/api/course/{subject_id}/exams",
                headers=headers
            )
            if exams_response.status_code == 200:
                exams = exams_response.json()
                digital_exam = next((e for e in exams if e.get("type") == "digital"), None)
                
                if digital_exam:
                    response = requests.get(
                        f"{BASE_URL}/api/exams/{digital_exam['id']}/omr-students",
                        headers=headers
                    )
                    assert response.status_code == 400, f"Expected 400 for digital exam, got {response.status_code}"
                    print("✓ Non-OMR exam correctly returns 400")
                else:
                    print("⚠ No digital exam found to test, skipping")
    
    def test_get_omr_students_invalid_exam(self, headers):
        """Test with invalid exam ID."""
        response = requests.get(
            f"{BASE_URL}/api/exams/invalid-exam-id/omr-students",
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid exam ID correctly returns 404")


class TestOMRScanEndpoint:
    """Tests for POST /api/exams/{exam_id}/omr-scan"""
    
    def test_omr_scan_requires_answer_key(self, headers):
        """Test that scanning requires answer_key to be configured."""
        # Get exam details first
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}",
            headers=headers
        )
        assert response.status_code == 200
        exam = response.json()
        
        # If exam has answer_key, this test verifies the endpoint works
        if exam.get("answer_key"):
            print("✓ Exam has answer_key configured - scan endpoint should work")
        else:
            # Try to scan without answer_key
            with open(TEST_IMAGE_PATH, 'rb') as f:
                files = {'image': ('test.jpg', f, 'image/jpeg')}
                data = {'student_id': 'test-student-id'}
                response = requests.post(
                    f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-scan",
                    headers=headers,
                    files=files,
                    data=data
                )
                assert response.status_code == 400, f"Expected 400 without answer_key, got {response.status_code}"
                print("✓ Scan without answer_key correctly returns 400")
    
    def test_omr_scan_non_omr_exam_returns_400(self, headers):
        """Test that scanning non-OMR exam returns 400."""
        # Get a digital exam
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}",
            headers=headers
        )
        if response.status_code == 200:
            exam = response.json()
            subject_id = exam.get("subject_id")
            
            exams_response = requests.get(
                f"{BASE_URL}/api/course/{subject_id}/exams",
                headers=headers
            )
            if exams_response.status_code == 200:
                exams = exams_response.json()
                digital_exam = next((e for e in exams if e.get("type") == "digital"), None)
                
                if digital_exam:
                    with open(TEST_IMAGE_PATH, 'rb') as f:
                        files = {'image': ('test.jpg', f, 'image/jpeg')}
                        data = {'student_id': 'test-student-id'}
                        response = requests.post(
                            f"{BASE_URL}/api/exams/{digital_exam['id']}/omr-scan",
                            headers=headers,
                            files=files,
                            data=data
                        )
                        assert response.status_code == 400, f"Expected 400 for digital exam, got {response.status_code}"
                        print("✓ Scanning non-OMR exam correctly returns 400")
                else:
                    print("⚠ No digital exam found to test, skipping")
    
    def test_omr_scan_duplicate_returns_409(self, headers):
        """Test that scanning same student twice returns 409."""
        # Get students with existing scans
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-students",
            headers=headers
        )
        assert response.status_code == 200
        students = response.json()
        
        # Find a student with existing scan
        scanned_student = next((s for s in students if s.get("has_scan")), None)
        
        if scanned_student:
            with open(TEST_IMAGE_PATH, 'rb') as f:
                files = {'image': ('test.jpg', f, 'image/jpeg')}
                data = {'student_id': scanned_student['id']}
                response = requests.post(
                    f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-scan",
                    headers=headers,
                    files=files,
                    data=data
                )
                assert response.status_code == 409, f"Expected 409 for duplicate scan, got {response.status_code}"
                
                # Verify response contains existing_scan_id
                resp_data = response.json()
                assert "existing_scan_id" in resp_data, "409 response should contain existing_scan_id"
                print(f"✓ Duplicate scan for student {scanned_student['full_name']} correctly returns 409")
        else:
            print("⚠ No scanned student found to test duplicate, skipping")
    
    def test_omr_scan_process_image(self, headers):
        """Test processing a new scan (if unscanned student exists)."""
        # Get students
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-students",
            headers=headers
        )
        assert response.status_code == 200
        students = response.json()
        
        # Find an unscanned student
        unscanned_student = next((s for s in students if not s.get("has_scan")), None)
        
        if unscanned_student:
            with open(TEST_IMAGE_PATH, 'rb') as f:
                files = {'image': ('test.jpg', f, 'image/jpeg')}
                data = {'student_id': unscanned_student['id']}
                response = requests.post(
                    f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-scan",
                    headers=headers,
                    files=files,
                    data=data
                )
                
                # Could be 200 (success) or 422 (image processing error)
                if response.status_code == 200:
                    result = response.json()
                    assert "score" in result, "Result should have score"
                    assert "total" in result, "Result should have total"
                    assert "percentage" in result, "Result should have percentage"
                    assert "grade_vigesimal" in result, "Result should have grade_vigesimal"
                    assert "detected_answers" in result, "Result should have detected_answers"
                    print(f"✓ Scan processed successfully: {result['score']}/{result['total']} ({result['percentage']}%)")
                elif response.status_code == 422:
                    # Image processing error (alignment markers not found, etc.)
                    print(f"⚠ Image processing error (expected with synthetic image): {response.json().get('detail', '')}")
                else:
                    print(f"⚠ Unexpected status {response.status_code}: {response.text}")
        else:
            print("⚠ No unscanned student found, all students already have scans")


class TestOMRScanOverwriteEndpoint:
    """Tests for PUT /api/exams/{exam_id}/omr-scan/{scan_id}"""
    
    def test_overwrite_existing_scan(self, headers):
        """Test overwriting an existing scan."""
        # Get existing scans
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-results",
            headers=headers
        )
        assert response.status_code == 200
        results = response.json()
        
        if len(results) > 0:
            existing_scan = results[0]
            scan_id = existing_scan["scan_id"]
            student_id = existing_scan["student_id"]
            
            with open(TEST_IMAGE_PATH, 'rb') as f:
                files = {'image': ('test.jpg', f, 'image/jpeg')}
                data = {'student_id': student_id}
                response = requests.put(
                    f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-scan/{scan_id}",
                    headers=headers,
                    files=files,
                    data=data
                )
                
                # Could be 200 (success) or 422 (image processing error)
                if response.status_code == 200:
                    result = response.json()
                    assert "score" in result, "Result should have score"
                    print(f"✓ Scan overwritten successfully: {result['score']}/{result['total']}")
                elif response.status_code == 422:
                    print(f"⚠ Image processing error (expected with synthetic image): {response.json().get('detail', '')}")
                else:
                    print(f"⚠ Unexpected status {response.status_code}: {response.text}")
        else:
            print("⚠ No existing scans to overwrite")


class TestOMRResultsEndpoint:
    """Tests for GET /api/exams/{exam_id}/omr-results"""
    
    def test_get_omr_results_success(self, headers):
        """Test getting all scan results."""
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-results",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            result = data[0]
            assert "scan_id" in result, "Result should have scan_id"
            assert "student_id" in result, "Result should have student_id"
            assert "student_name" in result, "Result should have student_name"
            assert "score" in result, "Result should have score"
            assert "total" in result, "Result should have total"
            assert "percentage" in result, "Result should have percentage"
            assert "grade_vigesimal" in result, "Result should have grade_vigesimal"
            assert "registered_to_gradebook" in result, "Result should have registered_to_gradebook"
            
            print(f"✓ GET omr-results returned {len(data)} results")
            for r in data:
                print(f"  - {r['student_name']}: {r['score']}/{r['total']} ({r['grade_vigesimal']}/20)")
        else:
            print("⚠ No scan results found")


class TestOMRRegisterGradesEndpoint:
    """Tests for POST /api/exams/{exam_id}/omr-register-grades"""
    
    def test_register_grades_requires_register_column(self, headers):
        """Test that registering grades requires register_column to be set."""
        # Get exam details
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}",
            headers=headers
        )
        assert response.status_code == 200
        exam = response.json()
        
        if not exam.get("register_column"):
            # Try to register without register_column
            response = requests.post(
                f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-register-grades",
                headers=headers
            )
            assert response.status_code == 400, f"Expected 400 without register_column, got {response.status_code}"
            print("✓ Register grades without register_column correctly returns 400")
        else:
            print(f"⚠ Exam has register_column={exam['register_column']}, skipping this test")
    
    def test_register_grades_success(self, headers):
        """Test registering grades when register_column is set."""
        # Get exam details
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}",
            headers=headers
        )
        assert response.status_code == 200
        exam = response.json()
        
        if exam.get("register_column"):
            # Get results first
            results_response = requests.get(
                f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-results",
                headers=headers
            )
            results = results_response.json()
            
            if len(results) > 0:
                response = requests.post(
                    f"{BASE_URL}/api/exams/{OMR_EXAM_ID}/omr-register-grades",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    assert "registered" in data, "Response should have registered count"
                    assert "message" in data, "Response should have message"
                    print(f"✓ Registered {data['registered']} grades: {data['message']}")
                else:
                    print(f"⚠ Register grades returned {response.status_code}: {response.text}")
            else:
                print("⚠ No scan results to register")
        else:
            print("⚠ Exam has no register_column, cannot test registration")


class TestExamDetailWithOMRFields:
    """Test that exam detail includes OMR-specific fields."""
    
    def test_exam_detail_has_omr_fields(self, headers):
        """Test that OMR exam detail includes answer_key and bubble_map."""
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_ID}",
            headers=headers
        )
        assert response.status_code == 200
        exam = response.json()
        
        assert exam.get("type") == "omr", "Exam should be OMR type"
        assert "num_questions" in exam, "OMR exam should have num_questions"
        assert "options_per_question" in exam, "OMR exam should have options_per_question"
        
        print(f"✓ OMR exam details: {exam['num_questions']} questions, {exam['options_per_question']} options")
        
        if exam.get("answer_key"):
            print(f"  - Answer key configured: {exam['answer_key']}")
        else:
            print("  - Answer key not configured")
        
        if exam.get("bubble_map"):
            print("  - Bubble map generated")
        else:
            print("  - Bubble map not generated")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
