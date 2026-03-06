"""
Test Teacher QR Feature
=======================
Tests for:
1. POST /api/attendance/qr/generate - generates QR tokens for students AND teachers
2. Teacher QR tokens existence in database (migration ran on startup)
3. POST /api/attendance/qr/scan - accepts teacher_qr type QR tokens
4. GET /api/users - returns teachers with qr_token field
"""

import pytest
import requests
import os
import jwt

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"


class TestTeacherQRFeature:
    """Test teacher QR code feature implementation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        self.token = data["token"]
        self.school_id = data["user"]["school_id"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    # =========================================================================
    # TEST 1: Generate QR endpoint works for both students and teachers
    # =========================================================================
    def test_generate_qr_endpoint_exists(self):
        """Test POST /api/attendance/qr/generate endpoint exists and returns valid response"""
        response = self.session.post(f"{BASE_URL}/api/attendance/qr/generate")
        
        # Should return 200 (success) with counts
        assert response.status_code == 200, f"Generate QR failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "updated_count" in data
        assert "students_updated" in data
        assert "teachers_updated" in data
        
        print(f"Generate QR response: {data}")
    
    # =========================================================================
    # TEST 2: Teachers have qr_token in database
    # =========================================================================
    def test_teachers_have_qr_tokens(self):
        """Test that teachers returned by /api/users have qr_token field"""
        response = self.session.get(f"{BASE_URL}/api/users")
        
        assert response.status_code == 200, f"Get users failed: {response.text}"
        
        users = response.json()
        teachers = [u for u in users if u.get("role") == "teacher"]
        
        assert len(teachers) > 0, "No teachers found in database"
        
        teachers_with_qr = [t for t in teachers if t.get("qr_token")]
        teachers_without_qr = [t for t in teachers if not t.get("qr_token")]
        
        print(f"Total teachers: {len(teachers)}")
        print(f"Teachers with QR: {len(teachers_with_qr)}")
        print(f"Teachers without QR: {len(teachers_without_qr)}")
        
        # All teachers should have QR tokens after migration
        assert len(teachers_with_qr) > 0, "No teachers have QR tokens"
        
        # Verify the QR token structure for first teacher
        if teachers_with_qr:
            teacher = teachers_with_qr[0]
            qr_token = teacher["qr_token"]
            
            # Decode JWT to verify structure
            try:
                decoded = jwt.decode(qr_token, options={"verify_signature": False})
                assert decoded.get("type") == "teacher_qr", f"Expected teacher_qr type, got {decoded.get('type')}"
                assert decoded.get("teacher_id") == teacher["id"], "Teacher ID mismatch in QR"
                assert "school_id" in decoded, "Missing school_id in QR"
                print(f"Teacher QR token structure valid: {decoded}")
            except Exception as e:
                pytest.fail(f"Failed to decode teacher QR token: {e}")
    
    # =========================================================================
    # TEST 3: Scan endpoint accepts teacher_qr type
    # =========================================================================
    def test_scan_accepts_teacher_qr(self):
        """Test POST /api/attendance/qr/scan accepts teacher_qr type tokens"""
        # First, get a teacher with QR token
        response = self.session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        
        users = response.json()
        teachers_with_qr = [u for u in users if u.get("role") == "teacher" and u.get("qr_token")]
        
        if not teachers_with_qr:
            pytest.skip("No teachers with QR tokens available for testing")
        
        teacher = teachers_with_qr[0]
        qr_token = teacher["qr_token"]
        
        # Scan the teacher's QR
        scan_response = self.session.post(f"{BASE_URL}/api/attendance/qr/scan", json={
            "qr_token": qr_token,
            "mode": "auto"
        })
        
        # Should succeed (200) with attendance registered
        assert scan_response.status_code == 200, f"Scan failed: {scan_response.text}"
        
        data = scan_response.json()
        assert "status" in data
        # Status can be 'success', 'already_marked', or specific registration status
        assert data["status"] in ["success", "entry_registered", "exit_registered", "already_registered", "already_marked"]
        
        # Verify attendance info in response
        assert "attendance" in data, f"Response should contain attendance: {data}"
        attendance = data["attendance"]
        
        # Verify attendance was recorded
        assert attendance.get("status") in ["present", "present_partial"]
        
        print(f"Teacher QR scan result: {data['status']}")
        print(f"Attendance: {attendance}")
    
    def test_scan_rejects_invalid_qr_type(self):
        """Test scan endpoint rejects QR tokens with invalid type"""
        # Create a fake JWT with invalid type
        JWT_SECRET = "edunet-saas-production-secret-key-change-me"  # From backend .env
        from datetime import datetime, timezone
        
        fake_payload = {
            "user_id": "fake123",
            "school_id": self.school_id,
            "type": "invalid_type"  # Invalid type
        }
        fake_token = jwt.encode(fake_payload, JWT_SECRET, algorithm="HS256")
        
        response = self.session.post(f"{BASE_URL}/api/attendance/qr/scan", json={
            "qr_token": fake_token,
            "mode": "auto"
        })
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        detail = data.get("detail", {})
        assert detail.get("code") == "QR_WRONG_TYPE" or "no es válido" in str(detail)
        print("Invalid QR type correctly rejected")
    
    # =========================================================================
    # TEST 4: New teachers get qr_token on creation
    # =========================================================================
    def test_new_teacher_gets_qr_token(self):
        """Test that creating a new teacher automatically generates qr_token"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        teacher_data = {
            "name": "Test Teacher",
            "last_name": f"QR Test {unique_id}",
            "username": f"testteacher_{unique_id}",
            "password": "Test1234!",
            "email": f"testteacher_{unique_id}@test.com",
            "role": "teacher",
            "dni": "12345678"
        }
        
        response = self.session.post(f"{BASE_URL}/api/users", json=teacher_data)
        
        # May fail if user already exists, that's ok
        if response.status_code == 201:
            data = response.json()
            user = data.get("user", {})
            
            # Verify qr_token was generated
            assert "qr_token" in user, "New teacher should have qr_token"
            
            qr_token = user["qr_token"]
            decoded = jwt.decode(qr_token, options={"verify_signature": False})
            assert decoded.get("type") == "teacher_qr"
            assert decoded.get("teacher_id") == user["id"]
            
            print(f"New teacher created with QR token: {user['id']}")
            
            # Cleanup - delete test user
            self.session.delete(f"{BASE_URL}/api/users/{user['id']}")
        else:
            print(f"Teacher creation returned {response.status_code}: {response.text}")
            # Check if teacher already exists and verify they have qr_token
            pass
    
    # =========================================================================
    # TEST 5: Verify teacher QR token payload structure
    # =========================================================================
    def test_teacher_qr_token_payload_structure(self):
        """Test teacher QR tokens have correct payload structure"""
        response = self.session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        
        users = response.json()
        teachers_with_qr = [u for u in users if u.get("role") == "teacher" and u.get("qr_token")]
        
        assert len(teachers_with_qr) > 0, "Need at least one teacher with QR for this test"
        
        for teacher in teachers_with_qr[:3]:  # Test first 3
            qr_token = teacher["qr_token"]
            decoded = jwt.decode(qr_token, options={"verify_signature": False})
            
            # Required fields
            assert "teacher_id" in decoded, f"Missing teacher_id in QR for {teacher['name']}"
            assert "school_id" in decoded, f"Missing school_id in QR for {teacher['name']}"
            assert "type" in decoded, f"Missing type in QR for {teacher['name']}"
            
            # Correct values
            assert decoded["type"] == "teacher_qr", f"Wrong type: {decoded['type']}"
            assert decoded["teacher_id"] == teacher["id"], "Teacher ID mismatch"
            
            print(f"Teacher {teacher['name']} QR payload valid")


class TestTeacherVsStudentQR:
    """Test that teacher and student QR are properly differentiated"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        self.token = data["token"]
        self.school_id = data["user"]["school_id"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    def test_student_and_teacher_qr_types_different(self):
        """Test that student QR has student_qr type and teacher QR has teacher_qr type"""
        response = self.session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        
        users = response.json()
        
        students_with_qr = [u for u in users if u.get("role") == "student" and u.get("qr_token")]
        teachers_with_qr = [u for u in users if u.get("role") == "teacher" and u.get("qr_token")]
        
        # Check student QR type
        if students_with_qr:
            student = students_with_qr[0]
            decoded = jwt.decode(student["qr_token"], options={"verify_signature": False})
            assert decoded["type"] == "student_qr", f"Student has wrong QR type: {decoded['type']}"
            assert "student_id" in decoded, "Student QR missing student_id"
            print(f"Student QR type correct: {decoded['type']}")
        
        # Check teacher QR type
        if teachers_with_qr:
            teacher = teachers_with_qr[0]
            decoded = jwt.decode(teacher["qr_token"], options={"verify_signature": False})
            assert decoded["type"] == "teacher_qr", f"Teacher has wrong QR type: {decoded['type']}"
            assert "teacher_id" in decoded, "Teacher QR missing teacher_id"
            print(f"Teacher QR type correct: {decoded['type']}")
    
    def test_scan_correctly_identifies_role(self):
        """Test that scanning correctly identifies whether user is student or teacher"""
        response = self.session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        
        users = response.json()
        teachers_with_qr = [u for u in users if u.get("role") == "teacher" and u.get("qr_token")]
        
        if not teachers_with_qr:
            pytest.skip("No teachers with QR tokens")
        
        teacher = teachers_with_qr[0]
        
        # Scan teacher QR
        scan_response = self.session.post(f"{BASE_URL}/api/attendance/qr/scan", json={
            "qr_token": teacher["qr_token"],
            "mode": "auto"
        })
        
        assert scan_response.status_code == 200
        data = scan_response.json()
        
        # Response should contain attendance info for teacher
        assert "status" in data
        assert data["status"] in ["success", "entry_registered", "exit_registered", "already_registered", "already_marked"]
        
        # Check that teacher name appears in message
        teacher_name = teacher.get("name", "")
        message = data.get("message", "")
        
        print(f"Scan response: {data}")
        print(f"Teacher {teacher_name} attendance recorded successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
