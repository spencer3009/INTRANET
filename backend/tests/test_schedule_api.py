"""
Test suite for EduNet Schedule Module - Complete API Testing
Tests: Schedule Settings, Schedules CRUD, Conflict Validation
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - admin user
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"

# Student credentials
STUDENT_EMAIL = "pepito@gmail.com"
STUDENT_PASSWORD = "1234abc8"


class TestScheduleSettings:
    """Test schedule settings API endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin authentication failed: {response.text}")
    
    def test_get_schedule_settings(self, admin_token):
        """Test GET /api/schedule-settings returns settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/schedule-settings", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "start_hour" in data, "start_hour missing"
        assert "end_hour" in data, "end_hour missing"
        assert "time_format" in data, "time_format missing"
        assert "block_duration" in data, "block_duration missing"
        
        print(f"✓ GET /api/schedule-settings returns: start={data['start_hour']}, end={data['end_hour']}, format={data['time_format']}")
    
    def test_save_schedule_settings(self, admin_token):
        """Test POST /api/schedule-settings saves settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Save new settings
        new_settings = {
            "start_hour": "08:00",
            "end_hour": "17:00",
            "time_format": "12h",
            "block_duration": 60
        }
        
        response = requests.post(f"{BASE_URL}/api/schedule-settings", json=new_settings, headers=headers)
        assert response.status_code == 200, f"Failed to save: {response.text}"
        
        data = response.json()
        assert "message" in data, "No message in response"
        assert "settings" in data, "No settings in response"
        
        # Verify settings were saved
        get_response = requests.get(f"{BASE_URL}/api/schedule-settings", headers=headers)
        assert get_response.status_code == 200
        
        saved = get_response.json()
        assert saved["start_hour"] == "08:00", f"start_hour not saved: {saved['start_hour']}"
        assert saved["end_hour"] == "17:00", f"end_hour not saved: {saved['end_hour']}"
        assert saved["time_format"] == "12h", f"time_format not saved: {saved['time_format']}"
        assert saved["block_duration"] == 60, f"block_duration not saved: {saved['block_duration']}"
        
        print("✓ POST /api/schedule-settings saves and persists settings correctly")
        
        # Restore default settings
        default_settings = {
            "start_hour": "07:00",
            "end_hour": "18:00",
            "time_format": "24h",
            "block_duration": 45
        }
        requests.post(f"{BASE_URL}/api/schedule-settings", json=default_settings, headers=headers)


class TestSchedulesCRUD:
    """Test schedules CRUD operations"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin authentication failed: {response.text}")
    
    @pytest.fixture
    def test_data(self, admin_token):
        """Get test data: grades, sections, teachers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get grades
        grades_res = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
        grades = grades_res.json() if grades_res.status_code == 200 else []
        
        # Get sections
        sections_res = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
        sections = sections_res.json() if sections_res.status_code == 200 else []
        
        # Get teachers
        teachers_res = requests.get(f"{BASE_URL}/api/users/teachers/active", headers=headers)
        teachers = teachers_res.json() if teachers_res.status_code == 200 else []
        
        return {
            "grades": grades,
            "sections": sections,
            "teachers": teachers
        }
    
    def test_get_schedules_empty(self, admin_token):
        """Test GET /api/schedules returns schedules list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/schedules?tipo=clases", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "schedules" in data, "schedules key missing"
        assert isinstance(data["schedules"], list), "schedules should be a list"
        
        print(f"✓ GET /api/schedules returns {len(data['schedules'])} schedules")
    
    def test_get_schedules_filtered(self, admin_token, test_data):
        """Test GET /api/schedules with grado_id and seccion_id filters"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        if not test_data["grades"] or not test_data["sections"]:
            pytest.skip("No grades or sections available")
        
        grade = test_data["grades"][0]
        # Find a section for this grade
        section = next((s for s in test_data["sections"] if s.get("grado_id") == grade["id"]), None)
        
        if not section:
            pytest.skip("No section found for grade")
        
        response = requests.get(
            f"{BASE_URL}/api/schedules?tipo=clases&grado_id={grade['id']}&seccion_id={section['id']}", 
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "schedules" in data, "schedules key missing"
        print(f"✓ GET /api/schedules with filters returns {len(data['schedules'])} schedules for {grade['nombre']} - {section['nombre']}")
    
    def test_create_schedule(self, admin_token, test_data):
        """Test POST /api/schedules creates a new schedule"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        if not test_data["grades"] or not test_data["sections"] or not test_data["teachers"]:
            pytest.skip("Missing test data")
        
        grade = test_data["grades"][0]
        section = next((s for s in test_data["sections"] if s.get("grado_id") == grade["id"]), None)
        teacher = test_data["teachers"][0]
        
        if not section:
            pytest.skip("No section found for grade")
        
        # Create unique schedule
        schedule_data = {
            "tipo": "clases",
            "grado_id": grade["id"],
            "seccion_id": section["id"],
            "profesor_id": teacher["id"],
            "materia": f"TEST_Matemáticas_{uuid.uuid4().hex[:6]}",
            "dia": "lunes",
            "hora_inicio": "07:00",
            "hora_fin": "07:45",
            "aula": "A-101",
            "color": "#3B82F6"
        }
        
        response = requests.post(f"{BASE_URL}/api/schedules", json=schedule_data, headers=headers)
        
        assert response.status_code == 200, f"Failed to create: {response.text}"
        data = response.json()
        
        assert "schedule" in data, "schedule key missing"
        assert "id" in data["schedule"], "schedule id missing"
        assert data["schedule"]["materia"] == schedule_data["materia"], "materia mismatch"
        
        schedule_id = data["schedule"]["id"]
        print(f"✓ POST /api/schedules created schedule with id: {schedule_id}")
        
        # Cleanup - delete the test schedule
        delete_res = requests.delete(f"{BASE_URL}/api/schedules/{schedule_id}", headers=headers)
        assert delete_res.status_code == 200, f"Failed to cleanup: {delete_res.text}"
        print(f"✓ Cleanup: deleted test schedule {schedule_id}")
    
    def test_update_schedule(self, admin_token, test_data):
        """Test PUT /api/schedules/{id} updates a schedule"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        if not test_data["grades"] or not test_data["sections"] or not test_data["teachers"]:
            pytest.skip("Missing test data")
        
        grade = test_data["grades"][0]
        section = next((s for s in test_data["sections"] if s.get("grado_id") == grade["id"]), None)
        teacher = test_data["teachers"][0]
        
        if not section:
            pytest.skip("No section found for grade")
        
        # First create a schedule
        schedule_data = {
            "tipo": "clases",
            "grado_id": grade["id"],
            "seccion_id": section["id"],
            "profesor_id": teacher["id"],
            "materia": f"TEST_Ciencias_{uuid.uuid4().hex[:6]}",
            "dia": "martes",
            "hora_inicio": "08:00",
            "hora_fin": "08:45",
            "aula": "B-202",
            "color": "#10B981"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/schedules", json=schedule_data, headers=headers)
        assert create_res.status_code == 200, f"Failed to create: {create_res.text}"
        
        schedule_id = create_res.json()["schedule"]["id"]
        
        # Update the schedule
        update_data = {
            "materia": "TEST_Ciencias_Actualizado",
            "aula": "C-303",
            "color": "#EF4444"
        }
        
        update_res = requests.put(f"{BASE_URL}/api/schedules/{schedule_id}", json=update_data, headers=headers)
        assert update_res.status_code == 200, f"Failed to update: {update_res.text}"
        
        updated = update_res.json()["schedule"]
        assert updated["materia"] == "TEST_Ciencias_Actualizado", "materia not updated"
        assert updated["aula"] == "C-303", "aula not updated"
        assert updated["color"] == "#EF4444", "color not updated"
        
        print(f"✓ PUT /api/schedules/{schedule_id} updated schedule correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/schedules/{schedule_id}", headers=headers)
    
    def test_delete_schedule(self, admin_token, test_data):
        """Test DELETE /api/schedules/{id} deletes a schedule"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        if not test_data["grades"] or not test_data["sections"] or not test_data["teachers"]:
            pytest.skip("Missing test data")
        
        grade = test_data["grades"][0]
        section = next((s for s in test_data["sections"] if s.get("grado_id") == grade["id"]), None)
        teacher = test_data["teachers"][0]
        
        if not section:
            pytest.skip("No section found for grade")
        
        # Create a schedule to delete
        schedule_data = {
            "tipo": "clases",
            "grado_id": grade["id"],
            "seccion_id": section["id"],
            "profesor_id": teacher["id"],
            "materia": f"TEST_ToDelete_{uuid.uuid4().hex[:6]}",
            "dia": "miercoles",
            "hora_inicio": "09:00",
            "hora_fin": "09:45",
            "aula": "D-404",
            "color": "#8B5CF6"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/schedules", json=schedule_data, headers=headers)
        assert create_res.status_code == 200
        
        schedule_id = create_res.json()["schedule"]["id"]
        
        # Delete the schedule
        delete_res = requests.delete(f"{BASE_URL}/api/schedules/{schedule_id}", headers=headers)
        assert delete_res.status_code == 200, f"Failed to delete: {delete_res.text}"
        
        # Verify deletion - try to get schedules and check it's not there
        get_res = requests.get(f"{BASE_URL}/api/schedules?tipo=clases", headers=headers)
        schedules = get_res.json().get("schedules", [])
        
        assert not any(s["id"] == schedule_id for s in schedules), "Schedule still exists after deletion"
        
        print(f"✓ DELETE /api/schedules/{schedule_id} deleted schedule successfully")


class TestScheduleConflicts:
    """Test schedule conflict validation"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin authentication failed: {response.text}")
    
    @pytest.fixture
    def test_data(self, admin_token):
        """Get test data: grades, sections, teachers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        grades_res = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
        grades = grades_res.json() if grades_res.status_code == 200 else []
        
        sections_res = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
        sections = sections_res.json() if sections_res.status_code == 200 else []
        
        teachers_res = requests.get(f"{BASE_URL}/api/users/teachers/active", headers=headers)
        teachers = teachers_res.json() if teachers_res.status_code == 200 else []
        
        return {
            "grades": grades,
            "sections": sections,
            "teachers": teachers
        }
    
    def test_teacher_conflict_detection(self, admin_token, test_data):
        """Test that creating schedule with same teacher at same time is rejected"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        if not test_data["grades"] or not test_data["sections"] or not test_data["teachers"]:
            pytest.skip("Missing test data")
        
        grade = test_data["grades"][0]
        sections = [s for s in test_data["sections"] if s.get("grado_id") == grade["id"]]
        teacher = test_data["teachers"][0]
        
        if len(sections) < 2:
            pytest.skip("Need at least 2 sections for conflict test")
        
        section1 = sections[0]
        section2 = sections[1] if len(sections) > 1 else sections[0]
        
        # Create first schedule
        schedule1 = {
            "tipo": "clases",
            "grado_id": grade["id"],
            "seccion_id": section1["id"],
            "profesor_id": teacher["id"],
            "materia": f"TEST_Conflict1_{uuid.uuid4().hex[:6]}",
            "dia": "jueves",
            "hora_inicio": "10:00",
            "hora_fin": "10:45",
            "aula": "E-501",
            "color": "#3B82F6"
        }
        
        create1_res = requests.post(f"{BASE_URL}/api/schedules", json=schedule1, headers=headers)
        assert create1_res.status_code == 200, f"Failed to create first schedule: {create1_res.text}"
        
        schedule1_id = create1_res.json()["schedule"]["id"]
        
        # Try to create second schedule with same teacher at same time (different section)
        schedule2 = {
            "tipo": "clases",
            "grado_id": grade["id"],
            "seccion_id": section2["id"],
            "profesor_id": teacher["id"],  # Same teacher
            "materia": f"TEST_Conflict2_{uuid.uuid4().hex[:6]}",
            "dia": "jueves",  # Same day
            "hora_inicio": "10:00",  # Same time
            "hora_fin": "10:45",
            "aula": "F-601",
            "color": "#10B981"
        }
        
        create2_res = requests.post(f"{BASE_URL}/api/schedules", json=schedule2, headers=headers)
        
        # Should be rejected with 400
        assert create2_res.status_code == 400, f"Expected 400 for teacher conflict, got {create2_res.status_code}"
        
        error_data = create2_res.json()
        assert "detail" in error_data, "No detail in error response"
        
        # Check if it's the new format with message and conflicts
        if isinstance(error_data["detail"], dict):
            assert "message" in error_data["detail"], "No message in conflict error"
            assert "conflicts" in error_data["detail"], "No conflicts array in error"
            print(f"✓ Teacher conflict detected: {error_data['detail']['message']}")
        else:
            print(f"✓ Teacher conflict detected: {error_data['detail']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/schedules/{schedule1_id}", headers=headers)
    
    def test_room_conflict_detection(self, admin_token, test_data):
        """Test that creating schedule with same room at same time is rejected"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        if not test_data["grades"] or not test_data["sections"] or len(test_data["teachers"]) < 2:
            pytest.skip("Need at least 2 teachers for room conflict test")
        
        grade = test_data["grades"][0]
        sections = [s for s in test_data["sections"] if s.get("grado_id") == grade["id"]]
        
        if len(sections) < 2:
            pytest.skip("Need at least 2 sections for room conflict test")
        
        section1 = sections[0]
        section2 = sections[1]
        teacher1 = test_data["teachers"][0]
        teacher2 = test_data["teachers"][1]
        
        # Create first schedule
        schedule1 = {
            "tipo": "clases",
            "grado_id": grade["id"],
            "seccion_id": section1["id"],
            "profesor_id": teacher1["id"],
            "materia": f"TEST_RoomConflict1_{uuid.uuid4().hex[:6]}",
            "dia": "viernes",
            "hora_inicio": "11:00",
            "hora_fin": "11:45",
            "aula": "LAB-001",  # Specific room
            "color": "#3B82F6"
        }
        
        create1_res = requests.post(f"{BASE_URL}/api/schedules", json=schedule1, headers=headers)
        assert create1_res.status_code == 200, f"Failed to create first schedule: {create1_res.text}"
        
        schedule1_id = create1_res.json()["schedule"]["id"]
        
        # Try to create second schedule with same room at same time
        schedule2 = {
            "tipo": "clases",
            "grado_id": grade["id"],
            "seccion_id": section2["id"],
            "profesor_id": teacher2["id"],  # Different teacher
            "materia": f"TEST_RoomConflict2_{uuid.uuid4().hex[:6]}",
            "dia": "viernes",  # Same day
            "hora_inicio": "11:00",  # Same time
            "hora_fin": "11:45",
            "aula": "LAB-001",  # Same room
            "color": "#10B981"
        }
        
        create2_res = requests.post(f"{BASE_URL}/api/schedules", json=schedule2, headers=headers)
        
        # Should be rejected with 400
        assert create2_res.status_code == 400, f"Expected 400 for room conflict, got {create2_res.status_code}"
        
        print(f"✓ Room conflict detected correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/schedules/{schedule1_id}", headers=headers)
    
    def test_section_conflict_detection(self, admin_token, test_data):
        """Test that creating schedule for same section at same time is rejected"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        if not test_data["grades"] or not test_data["sections"] or len(test_data["teachers"]) < 2:
            pytest.skip("Need at least 2 teachers for section conflict test")
        
        grade = test_data["grades"][0]
        section = next((s for s in test_data["sections"] if s.get("grado_id") == grade["id"]), None)
        
        if not section:
            pytest.skip("No section found for grade")
        
        teacher1 = test_data["teachers"][0]
        teacher2 = test_data["teachers"][1]
        
        # Create first schedule
        schedule1 = {
            "tipo": "clases",
            "grado_id": grade["id"],
            "seccion_id": section["id"],
            "profesor_id": teacher1["id"],
            "materia": f"TEST_SectionConflict1_{uuid.uuid4().hex[:6]}",
            "dia": "sabado",
            "hora_inicio": "08:00",
            "hora_fin": "08:45",
            "aula": "G-701",
            "color": "#3B82F6"
        }
        
        create1_res = requests.post(f"{BASE_URL}/api/schedules", json=schedule1, headers=headers)
        assert create1_res.status_code == 200, f"Failed to create first schedule: {create1_res.text}"
        
        schedule1_id = create1_res.json()["schedule"]["id"]
        
        # Try to create second schedule for same section at same time
        schedule2 = {
            "tipo": "clases",
            "grado_id": grade["id"],
            "seccion_id": section["id"],  # Same section
            "profesor_id": teacher2["id"],  # Different teacher
            "materia": f"TEST_SectionConflict2_{uuid.uuid4().hex[:6]}",
            "dia": "sabado",  # Same day
            "hora_inicio": "08:00",  # Same time
            "hora_fin": "08:45",
            "aula": "H-801",  # Different room
            "color": "#10B981"
        }
        
        create2_res = requests.post(f"{BASE_URL}/api/schedules", json=schedule2, headers=headers)
        
        # Should be rejected with 400
        assert create2_res.status_code == 400, f"Expected 400 for section conflict, got {create2_res.status_code}"
        
        print(f"✓ Section conflict detected correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/schedules/{schedule1_id}", headers=headers)


class TestSupportingAPIs:
    """Test supporting APIs used by schedule module"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin authentication failed: {response.text}")
    
    def test_grades_api(self, admin_token):
        """Test GET /api/academic/grades returns grades"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Expected at least 1 grade"
        
        # Check required fields
        for grade in data[:3]:
            assert "id" in grade, "id missing"
            assert "nombre" in grade, "nombre missing"
        
        print(f"✓ GET /api/academic/grades returns {len(data)} grades")
    
    def test_sections_api(self, admin_token):
        """Test GET /api/academic/sections returns sections"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Expected at least 1 section"
        
        # Check required fields
        for section in data[:3]:
            assert "id" in section, "id missing"
            assert "nombre" in section, "nombre missing"
            assert "grado_id" in section, "grado_id missing"
        
        print(f"✓ GET /api/academic/sections returns {len(data)} sections")
    
    def test_teachers_api(self, admin_token):
        """Test GET /api/users/teachers/active returns teachers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/teachers/active", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Expected at least 1 teacher"
        
        # Check required fields
        for teacher in data[:3]:
            assert "id" in teacher, "id missing"
            assert "name" in teacher, "name missing"
        
        print(f"✓ GET /api/users/teachers/active returns {len(data)} teachers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
