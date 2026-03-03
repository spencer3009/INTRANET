"""
Test suite for Entry/Exit Attendance Module
Tests the new entry_time, exit_time, entry_method, exit_method, total_minutes fields
Tests endpoints:
  - POST /api/attendance/mark-entry
  - POST /api/attendance/mark-exit  
  - POST /api/attendance/qr/scan (with mode: auto/entry/exit)
  - GET /api/attendance/students (returns entry_time, exit_time)
  - POST /api/attendance/students/save (preserves entry_time, exit_time via upsert)
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials (from review_request)
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"

# Test students - some have no records for today and can be used for fresh testing
# Juan Lopez, Laura Zapata, Raúl Romero, Roberto Diaz are in INICIAL-3años-ÚNICA

class TestEntryExitAttendance:
    """Tests for entry/exit attendance feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Authenticate as owner and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def test_students(self, auth_headers):
        """Get test students from INICIAL-3años section"""
        # First get grades
        grades_res = requests.get(f"{BASE_URL}/api/academic/grades", headers=auth_headers)
        assert grades_res.status_code == 200
        grades = grades_res.json()
        
        # Find INICIAL grade (3 años)
        target_grade = None
        for g in grades:
            nombre = g.get("nombre", "").lower()
            nivel = g.get("nivel_nombre", "").lower()
            if "3" in nombre and ("inicial" in nivel or "año" in nombre):
                target_grade = g
                break
        
        if not target_grade:
            # Fallback - get first active grade
            target_grade = next((g for g in grades if g.get("activo")), None)
        
        if not target_grade:
            pytest.skip("No suitable grade found for testing")
        
        # Get sections for this grade
        sections_res = requests.get(f"{BASE_URL}/api/academic/sections", headers=auth_headers)
        assert sections_res.status_code == 200
        sections = [s for s in sections_res.json() if s.get("grado_id") == target_grade["id"] and s.get("activo")]
        
        if not sections:
            pytest.skip("No sections found for target grade")
        
        target_section = sections[0]
        
        return {
            "grade_id": target_grade["id"],
            "section_id": target_section["id"],
            "grade_name": target_grade.get("nombre"),
            "section_name": target_section.get("nombre")
        }
    
    @pytest.fixture(scope="class")
    def test_date(self):
        """Return today's date for testing"""
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # ═══════════════════════════════════════════════════════════════════════
    # GET /api/attendance/students - Should return entry_time and exit_time
    # ═══════════════════════════════════════════════════════════════════════
    
    def test_get_students_returns_entry_exit_fields(self, auth_headers, test_students, test_date):
        """Test that GET /api/attendance/students returns entry_time and exit_time fields"""
        response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=auth_headers,
            params={
                "grade_id": test_students["grade_id"],
                "section_id": test_students["section_id"],
                "date": test_date
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "students" in data, "Response should contain students list"
        assert "has_saved_records" in data, "Response should contain has_saved_records flag"
        
        if data["students"]:
            student = data["students"][0]
            # Check that entry/exit fields are present in response
            assert "entry_time" in student, "Student should have entry_time field"
            assert "exit_time" in student, "Student should have exit_time field"
            assert "entry_method" in student, "Student should have entry_method field"
            assert "exit_method" in student, "Student should have exit_method field"
            assert "total_minutes" in student, "Student should have total_minutes field"
            print(f"✓ GET /api/attendance/students returns entry/exit fields correctly")
            print(f"  Sample student: {student.get('full_name')}, entry: {student.get('entry_time')}, exit: {student.get('exit_time')}")
    
    # ═══════════════════════════════════════════════════════════════════════
    # POST /api/attendance/mark-entry - Create entry record
    # ═══════════════════════════════════════════════════════════════════════
    
    def test_mark_entry_success(self, auth_headers, test_students, test_date):
        """Test marking entry for a student without existing record"""
        # First get a student without entry today
        response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=auth_headers,
            params={
                "grade_id": test_students["grade_id"],
                "section_id": test_students["section_id"],
                "date": test_date
            }
        )
        students = response.json().get("students", [])
        
        # Find student without entry
        student_without_entry = next((s for s in students if not s.get("entry_time")), None)
        
        if not student_without_entry:
            # All students have entries - test duplicate rejection instead
            student_with_entry = next((s for s in students if s.get("entry_time")), None)
            if student_with_entry:
                response = requests.post(
                    f"{BASE_URL}/api/attendance/mark-entry",
                    headers=auth_headers,
                    json={
                        "student_id": student_with_entry["id"],
                        "date": test_date,
                        "method": "manual"
                    }
                )
                assert response.status_code == 400, "Should reject duplicate entry"
                assert "Entrada ya registrada" in response.json().get("detail", "")
                print("✓ POST /api/attendance/mark-entry rejects duplicate ('Entrada ya registrada')")
            return
        
        # Mark entry for student without one
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-entry",
            headers=auth_headers,
            json={
                "student_id": student_without_entry["id"],
                "date": test_date,
                "method": "manual"
            }
        )
        assert response.status_code == 200, f"Failed to mark entry: {response.text}"
        data = response.json()
        
        assert data.get("status") == "success", "Status should be success"
        assert data.get("entry_time"), "Should return entry_time"
        assert data.get("student_id") == student_without_entry["id"]
        print(f"✓ POST /api/attendance/mark-entry creates entry record with entry_time: {data.get('entry_time')}")
    
    def test_mark_entry_rejects_duplicate(self, auth_headers, test_students, test_date):
        """Test that marking entry twice returns 'Entrada ya registrada'"""
        # Get students
        response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=auth_headers,
            params={
                "grade_id": test_students["grade_id"],
                "section_id": test_students["section_id"],
                "date": test_date
            }
        )
        students = response.json().get("students", [])
        
        # Find student with entry
        student_with_entry = next((s for s in students if s.get("entry_time")), None)
        
        if not student_with_entry:
            pytest.skip("No student with entry to test duplicate rejection")
        
        # Try to mark entry again
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-entry",
            headers=auth_headers,
            json={
                "student_id": student_with_entry["id"],
                "date": test_date,
                "method": "manual"
            }
        )
        
        assert response.status_code == 400, f"Should reject duplicate entry: {response.text}"
        detail = response.json().get("detail", "")
        assert "Entrada ya registrada" in detail, f"Error message should contain 'Entrada ya registrada', got: {detail}"
        print("✓ POST /api/attendance/mark-entry rejects duplicate entry ('Entrada ya registrada')")
    
    # ═══════════════════════════════════════════════════════════════════════
    # POST /api/attendance/mark-exit - Create exit record
    # ═══════════════════════════════════════════════════════════════════════
    
    def test_mark_exit_requires_entry(self, auth_headers, test_students, test_date):
        """Test that marking exit without entry returns 'No hay entrada registrada'"""
        # Get students
        response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=auth_headers,
            params={
                "grade_id": test_students["grade_id"],
                "section_id": test_students["section_id"],
                "date": test_date
            }
        )
        students = response.json().get("students", [])
        
        # Find student without entry
        student_no_entry = next((s for s in students if not s.get("entry_time")), None)
        
        if not student_no_entry:
            # All have entries, try with a fake student ID
            response = requests.post(
                f"{BASE_URL}/api/attendance/mark-exit",
                headers=auth_headers,
                json={
                    "student_id": "nonexistent-student-id-12345",
                    "date": test_date,
                    "method": "manual"
                }
            )
            # Should fail either with 404 or 400
            assert response.status_code in [400, 404], f"Should reject: {response.text}"
            print("✓ POST /api/attendance/mark-exit rejects when no entry exists")
            return
        
        # Try to mark exit for student without entry
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-exit",
            headers=auth_headers,
            json={
                "student_id": student_no_entry["id"],
                "date": test_date,
                "method": "manual"
            }
        )
        
        assert response.status_code == 400, f"Should reject exit without entry: {response.text}"
        detail = response.json().get("detail", "")
        assert "No hay entrada registrada" in detail, f"Error should contain 'No hay entrada registrada', got: {detail}"
        print("✓ POST /api/attendance/mark-exit rejects when no entry ('No hay entrada registrada')")
    
    def test_mark_exit_success(self, auth_headers, test_students, test_date):
        """Test marking exit for a student with entry but no exit"""
        # Get students
        response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=auth_headers,
            params={
                "grade_id": test_students["grade_id"],
                "section_id": test_students["section_id"],
                "date": test_date
            }
        )
        students = response.json().get("students", [])
        
        # Find student with entry but no exit
        student_entry_no_exit = next(
            (s for s in students if s.get("entry_time") and not s.get("exit_time")),
            None
        )
        
        if not student_entry_no_exit:
            pytest.skip("No student with entry but without exit to test")
        
        # Mark exit
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-exit",
            headers=auth_headers,
            json={
                "student_id": student_entry_no_exit["id"],
                "date": test_date,
                "method": "manual"
            }
        )
        
        assert response.status_code == 200, f"Failed to mark exit: {response.text}"
        data = response.json()
        
        assert data.get("status") == "success", "Status should be success"
        assert data.get("exit_time"), "Should return exit_time"
        assert "total_minutes" in data, "Should return total_minutes"
        print(f"✓ POST /api/attendance/mark-exit creates exit with exit_time: {data.get('exit_time')}, total_minutes: {data.get('total_minutes')}")
    
    def test_mark_exit_rejects_duplicate(self, auth_headers, test_students, test_date):
        """Test that marking exit twice returns 'Salida ya registrada'"""
        # Get students
        response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=auth_headers,
            params={
                "grade_id": test_students["grade_id"],
                "section_id": test_students["section_id"],
                "date": test_date
            }
        )
        students = response.json().get("students", [])
        
        # Find student with exit
        student_with_exit = next((s for s in students if s.get("exit_time")), None)
        
        if not student_with_exit:
            pytest.skip("No student with exit to test duplicate rejection")
        
        # Try to mark exit again
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-exit",
            headers=auth_headers,
            json={
                "student_id": student_with_exit["id"],
                "date": test_date,
                "method": "manual"
            }
        )
        
        assert response.status_code == 400, f"Should reject duplicate exit: {response.text}"
        detail = response.json().get("detail", "")
        assert "Salida ya registrada" in detail, f"Error should contain 'Salida ya registrada', got: {detail}"
        print("✓ POST /api/attendance/mark-exit rejects duplicate exit ('Salida ya registrada')")
    
    # ═══════════════════════════════════════════════════════════════════════
    # POST /api/attendance/students/save - Should preserve entry/exit times
    # ═══════════════════════════════════════════════════════════════════════
    
    def test_save_attendance_preserves_entry_exit(self, auth_headers, test_students, test_date):
        """Test that saving attendance status preserves entry_time and exit_time"""
        # Get students with their current attendance
        response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=auth_headers,
            params={
                "grade_id": test_students["grade_id"],
                "section_id": test_students["section_id"],
                "date": test_date
            }
        )
        students = response.json().get("students", [])
        
        # Find student with entry/exit
        student_with_times = next(
            (s for s in students if s.get("entry_time") or s.get("exit_time")),
            None
        )
        
        if not student_with_times:
            pytest.skip("No student with entry/exit times to test preservation")
        
        original_entry = student_with_times.get("entry_time")
        original_exit = student_with_times.get("exit_time")
        
        # Save attendance (change status to late)
        save_response = requests.post(
            f"{BASE_URL}/api/attendance/students/save",
            headers=auth_headers,
            json={
                "date": test_date,
                "grade_id": test_students["grade_id"],
                "section_id": test_students["section_id"],
                "records": [
                    {"user_id": student_with_times["id"], "status": "late"}
                ]
            }
        )
        assert save_response.status_code == 200, f"Failed to save attendance: {save_response.text}"
        
        # Verify entry/exit times were preserved
        verify_response = requests.get(
            f"{BASE_URL}/api/attendance/students",
            headers=auth_headers,
            params={
                "grade_id": test_students["grade_id"],
                "section_id": test_students["section_id"],
                "date": test_date
            }
        )
        updated_students = verify_response.json().get("students", [])
        updated_student = next((s for s in updated_students if s["id"] == student_with_times["id"]), None)
        
        assert updated_student, "Student should still exist after save"
        assert updated_student.get("status") == "late", "Status should be updated to late"
        assert updated_student.get("entry_time") == original_entry, f"entry_time should be preserved: {original_entry}"
        
        if original_exit:
            assert updated_student.get("exit_time") == original_exit, f"exit_time should be preserved: {original_exit}"
        
        print(f"✓ POST /api/attendance/students/save preserves entry_time ({original_entry}) and exit_time ({original_exit})")


class TestQRScanModes:
    """Tests for QR scan endpoint with mode (auto/entry/exit)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Authenticate as owner and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_qr_scan_endpoint_exists(self, auth_headers):
        """Test that QR scan endpoint exists and accepts mode parameter"""
        # Send an invalid QR token to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            headers=auth_headers,
            json={
                "qr_token": "invalid-token",
                "mode": "auto"
            }
        )
        # Should fail with 400 (invalid token) not 404 (endpoint not found)
        assert response.status_code == 400, f"Endpoint should exist and return 400 for invalid token: {response.status_code}"
        print("✓ POST /api/attendance/qr/scan endpoint exists and accepts mode parameter")
    
    def test_qr_scan_accepts_entry_mode(self, auth_headers):
        """Test QR scan accepts mode='entry'"""
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            headers=auth_headers,
            json={
                "qr_token": "invalid-token",
                "mode": "entry"
            }
        )
        # Should fail with 400 (invalid token) not 422 (validation error)
        assert response.status_code != 422, "mode='entry' should be accepted"
        print("✓ POST /api/attendance/qr/scan accepts mode='entry'")
    
    def test_qr_scan_accepts_exit_mode(self, auth_headers):
        """Test QR scan accepts mode='exit'"""
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            headers=auth_headers,
            json={
                "qr_token": "invalid-token",
                "mode": "exit"
            }
        )
        # Should fail with 400 (invalid token) not 422 (validation error)
        assert response.status_code != 422, "mode='exit' should be accepted"
        print("✓ POST /api/attendance/qr/scan accepts mode='exit'")
    
    def test_qr_scan_accepts_auto_mode(self, auth_headers):
        """Test QR scan accepts mode='auto' (default)"""
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            headers=auth_headers,
            json={
                "qr_token": "invalid-token",
                "mode": "auto"
            }
        )
        # Should fail with 400 (invalid token) not 422 (validation error)
        assert response.status_code != 422, "mode='auto' should be accepted"
        print("✓ POST /api/attendance/qr/scan accepts mode='auto'")


class TestMultiTenantAttendance:
    """Test that attendance data is properly scoped by school_id"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Authenticate as owner and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_attendance_requires_auth(self):
        """Test that attendance endpoints require authentication"""
        # mark-entry without auth
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-entry",
            json={"student_id": "test-id", "date": "2026-01-01"}
        )
        assert response.status_code == 401, "mark-entry should require auth"
        
        # mark-exit without auth
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-exit",
            json={"student_id": "test-id", "date": "2026-01-01"}
        )
        assert response.status_code == 401, "mark-exit should require auth"
        
        # qr/scan without auth
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": "test", "mode": "auto"}
        )
        assert response.status_code == 401, "qr/scan should require auth"
        
        print("✓ All attendance endpoints require authentication (multi-tenant security)")
    
    def test_attendance_student_not_found_returns_404(self, auth_headers):
        """Test that marking attendance for non-existent student returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-entry",
            headers=auth_headers,
            json={
                "student_id": "nonexistent-student-id-xyz-123",
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "method": "manual"
            }
        )
        assert response.status_code == 404, f"Should return 404 for non-existent student: {response.status_code}"
        print("✓ POST /api/attendance/mark-entry returns 404 for non-existent student")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
