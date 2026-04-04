"""
Test OMR PDF Generation Endpoints - Phase 2
Tests for:
- POST /api/exams/{exam_id}/generate-omr-pdf
- GET /api/exams/{exam_id}/omr-pdf
- GET /api/exams/{exam_id}/full (total_points fix for OMR)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"

# Test exam IDs from the review request
OMR_EXAM_WITH_PDF = "7b859047-f6cb-4760-b945-2e17b58c0099"  # 10 questions, 4 options, already has PDF
OMR_EXAM_WITHOUT_PDF = "45f78690-e507-4071-a99a-8d8f3a9a6db8"  # OMR exam without PDF


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for owner"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD,
            "subdomain": SUBDOMAIN
        }
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("token") or data.get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestOMRPdfGeneration:
    """Tests for OMR PDF generation endpoints"""

    def test_get_omr_pdf_existing(self, headers):
        """Test GET /api/exams/{exam_id}/omr-pdf for exam with existing PDF"""
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_WITH_PDF}/omr-pdf",
            headers=headers
        )
        
        print(f"GET omr-pdf response: {response.status_code}")
        print(f"Response body: {response.text[:500] if response.text else 'empty'}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pdf_url" in data, "Response should contain pdf_url"
        assert data["pdf_url"] is not None, "pdf_url should not be None"
        assert "cloudinary.com" in data["pdf_url"], "PDF URL should be from Cloudinary"
        assert "generated_at" in data, "Response should contain generated_at"
        print(f"✓ PDF URL: {data['pdf_url']}")
        print(f"✓ Generated at: {data.get('generated_at')}")

    def test_get_omr_pdf_not_generated(self, headers):
        """Test GET /api/exams/{exam_id}/omr-pdf for exam without PDF returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_WITHOUT_PDF}/omr-pdf",
            headers=headers
        )
        
        print(f"GET omr-pdf (no PDF) response: {response.status_code}")
        
        # Should return 404 if PDF not generated yet
        if response.status_code == 404:
            print("✓ Correctly returns 404 for exam without PDF")
            data = response.json()
            assert "detail" in data, "Should have error detail"
        elif response.status_code == 200:
            # PDF might have been generated in a previous test run
            print("⚠ PDF already exists for this exam (may have been generated previously)")
            data = response.json()
            assert "pdf_url" in data

    def test_generate_omr_pdf(self, headers):
        """Test POST /api/exams/{exam_id}/generate-omr-pdf"""
        response = requests.post(
            f"{BASE_URL}/api/exams/{OMR_EXAM_WITHOUT_PDF}/generate-omr-pdf",
            headers=headers
        )
        
        print(f"POST generate-omr-pdf response: {response.status_code}")
        print(f"Response body: {response.text[:500] if response.text else 'empty'}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pdf_url" in data, "Response should contain pdf_url"
        assert data["pdf_url"] is not None, "pdf_url should not be None"
        assert "cloudinary.com" in data["pdf_url"], "PDF URL should be from Cloudinary"
        assert "message" in data, "Response should contain success message"
        print(f"✓ Generated PDF URL: {data['pdf_url']}")
        print(f"✓ Message: {data.get('message')}")

    def test_generate_omr_pdf_digital_exam_error(self, headers):
        """Test POST generate-omr-pdf with digital exam returns 400"""
        # First, we need to find a digital exam
        # Let's get the exam list and find one
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_WITH_PDF}/full",
            headers=headers
        )
        
        if response.status_code == 200:
            exam_data = response.json()
            subject_id = exam_data.get("subject_id")
            
            # Get exams for this subject
            exams_response = requests.get(
                f"{BASE_URL}/api/course/{subject_id}/exams",
                headers=headers
            )
            
            if exams_response.status_code == 200:
                exams = exams_response.json()
                digital_exam = next((e for e in exams if e.get("type") == "digital"), None)
                
                if digital_exam:
                    # Try to generate OMR PDF for digital exam
                    gen_response = requests.post(
                        f"{BASE_URL}/api/exams/{digital_exam['id']}/generate-omr-pdf",
                        headers=headers
                    )
                    
                    print(f"POST generate-omr-pdf (digital exam) response: {gen_response.status_code}")
                    
                    assert gen_response.status_code == 400, f"Expected 400 for digital exam, got {gen_response.status_code}"
                    data = gen_response.json()
                    assert "detail" in data, "Should have error detail"
                    print(f"✓ Correctly returns 400 for digital exam: {data.get('detail')}")
                else:
                    print("⚠ No digital exam found to test error case")
        else:
            print(f"⚠ Could not get exam data: {response.status_code}")


class TestOMRExamFullEndpoint:
    """Tests for GET /api/exams/{exam_id}/full - total_points fix"""

    def test_full_endpoint_omr_total_points(self, headers):
        """Test that /full endpoint returns correct total_points for OMR exam"""
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_WITH_PDF}/full",
            headers=headers
        )
        
        print(f"GET /full response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify exam type is OMR
        assert data.get("type") == "omr", f"Expected type 'omr', got {data.get('type')}"
        
        # Verify total_points is not 0
        total_points = data.get("total_points", 0)
        num_questions = data.get("num_questions", 0)
        points_per_question = data.get("points_per_question", 1)
        
        print(f"Exam details:")
        print(f"  - Type: {data.get('type')}")
        print(f"  - Num questions: {num_questions}")
        print(f"  - Points per question: {points_per_question}")
        print(f"  - Total points: {total_points}")
        
        # total_points should be num_questions * points_per_question
        expected_total = num_questions * points_per_question
        
        assert total_points > 0, f"total_points should be > 0, got {total_points}"
        assert total_points == expected_total, f"total_points should be {expected_total}, got {total_points}"
        print(f"✓ total_points correctly calculated: {total_points} = {num_questions} x {points_per_question}")

    def test_full_endpoint_omr_exam_without_pdf(self, headers):
        """Test /full endpoint for OMR exam without PDF"""
        response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_WITHOUT_PDF}/full",
            headers=headers
        )
        
        print(f"GET /full (no PDF) response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify exam type is OMR
        assert data.get("type") == "omr", f"Expected type 'omr', got {data.get('type')}"
        
        # Verify total_points is calculated correctly
        total_points = data.get("total_points", 0)
        num_questions = data.get("num_questions", 0)
        points_per_question = data.get("points_per_question", 1)
        
        print(f"Exam details (no PDF):")
        print(f"  - Type: {data.get('type')}")
        print(f"  - Num questions: {num_questions}")
        print(f"  - Points per question: {points_per_question}")
        print(f"  - Total points: {total_points}")
        
        expected_total = num_questions * points_per_question
        assert total_points > 0, f"total_points should be > 0, got {total_points}"
        assert total_points == expected_total, f"total_points should be {expected_total}, got {total_points}"
        print(f"✓ total_points correctly calculated: {total_points}")


class TestOMRPdfRegeneration:
    """Tests for OMR PDF regeneration"""

    def test_regenerate_omr_pdf(self, headers):
        """Test regenerating PDF for exam that already has one"""
        # First verify the exam has a PDF
        get_response = requests.get(
            f"{BASE_URL}/api/exams/{OMR_EXAM_WITH_PDF}/omr-pdf",
            headers=headers
        )
        
        if get_response.status_code != 200:
            pytest.skip("Exam doesn't have PDF to regenerate")
        
        old_url = get_response.json().get("pdf_url")
        print(f"Old PDF URL: {old_url}")
        
        # Regenerate
        response = requests.post(
            f"{BASE_URL}/api/exams/{OMR_EXAM_WITH_PDF}/generate-omr-pdf",
            headers=headers
        )
        
        print(f"POST regenerate response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        new_url = data.get("pdf_url")
        
        assert new_url is not None, "New PDF URL should not be None"
        assert "cloudinary.com" in new_url, "New PDF URL should be from Cloudinary"
        print(f"✓ New PDF URL: {new_url}")
        print(f"✓ Regeneration successful")


class TestOMRExamNotFound:
    """Tests for error handling"""

    def test_get_omr_pdf_nonexistent_exam(self, headers):
        """Test GET omr-pdf for non-existent exam returns 404"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/exams/{fake_id}/omr-pdf",
            headers=headers
        )
        
        print(f"GET omr-pdf (fake ID) response: {response.status_code}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Correctly returns 404 for non-existent exam")

    def test_generate_omr_pdf_nonexistent_exam(self, headers):
        """Test POST generate-omr-pdf for non-existent exam returns 404"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.post(
            f"{BASE_URL}/api/exams/{fake_id}/generate-omr-pdf",
            headers=headers
        )
        
        print(f"POST generate-omr-pdf (fake ID) response: {response.status_code}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Correctly returns 404 for non-existent exam")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
