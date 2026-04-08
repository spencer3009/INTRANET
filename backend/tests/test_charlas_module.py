"""
Test suite for Coordinacion Charlas Module (Phase 3)
Tests: CRUD operations, materials (link type), attendance, agenda integration, RBAC
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
COORDINATOR_EMAIL = "coordinador@elroble.edu"
COORDINATOR_PASSWORD = "Coord123!"
PARENT_EMAIL = "maria.peres@gmail.com"
PARENT_PASSWORD = "Parent123!"
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"

# Existing charla from context
EXISTING_CHARLA_ID = "f097ed67-8e21-4f27-b04d-b42d5e00e468"


@pytest.fixture(scope="module")
def coordinator_token():
    """Get coordinator auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COORDINATOR_EMAIL,
        "password": COORDINATOR_PASSWORD
    })
    assert response.status_code == 200, f"Coordinator login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def parent_token():
    """Get parent auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARENT_EMAIL,
        "password": PARENT_PASSWORD
    })
    assert response.status_code == 200, f"Parent login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def owner_token():
    """Get owner auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": OWNER_EMAIL,
        "password": OWNER_PASSWORD
    })
    assert response.status_code == 200, f"Owner login failed: {response.text}"
    return response.json()["token"]


class TestCharlasCRUD:
    """Test Charlas CRUD operations"""
    
    created_charla_id = None
    
    def test_list_charlas(self, coordinator_token):
        """GET /api/coordinacion/charlas - List charlas with pagination"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        print(f"PASS: List charlas - {data['total']} charlas found")
    
    def test_list_charlas_with_status_filter(self, coordinator_token):
        """GET /api/coordinacion/charlas?status=realizada - Filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas?status=realizada",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # All returned items should have status=realizada
        for item in data.get("items", []):
            assert item["status"] == "realizada", f"Expected status 'realizada', got '{item['status']}'"
        print(f"PASS: List charlas with status filter - {len(data['items'])} realizada charlas")
    
    def test_create_charla(self, coordinator_token):
        """POST /api/coordinacion/charlas - Create a new charla"""
        scheduled_at = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%dT10:00:00")
        payload = {
            "title": "TEST_Charla de prueba automatizada",
            "description": "Esta es una charla creada por pruebas automatizadas",
            "scheduled_at": scheduled_at,
            "duration_minutes": 90,
            "location": "Sala de conferencias",
            "target_grades": [],
            "target_sections": [],
            "topics": ["Pruebas", "Automatizacion"],
            "notes": "Notas de prueba"
        }
        response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas",
            json=payload,
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Create charla failed: {response.text}"
        data = response.json()
        assert data["id"] is not None
        assert data["title"] == payload["title"]
        assert data["status"] == "programada"
        assert data["duration_minutes"] == 90
        assert data["topics"] == ["Pruebas", "Automatizacion"]
        TestCharlasCRUD.created_charla_id = data["id"]
        print(f"PASS: Create charla - ID: {data['id']}")
    
    def test_get_charla_detail(self, coordinator_token):
        """GET /api/coordinacion/charlas/{id} - Get charla detail with enriched names"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas/{EXISTING_CHARLA_ID}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Get charla failed: {response.text}"
        data = response.json()
        assert data["id"] == EXISTING_CHARLA_ID
        assert "title" in data
        assert "description" in data
        assert "created_by_name" in data
        assert "materials" in data
        print(f"PASS: Get charla detail - Title: {data['title']}, Status: {data['status']}")
    
    def test_update_charla_status(self, coordinator_token):
        """PATCH /api/coordinacion/charlas/{id} - Update charla status"""
        if not TestCharlasCRUD.created_charla_id:
            pytest.skip("No charla created to update")
        
        response = requests.patch(
            f"{BASE_URL}/api/coordinacion/charlas/{TestCharlasCRUD.created_charla_id}",
            json={"status": "en_curso"},
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Update charla failed: {response.text}"
        data = response.json()
        assert data["status"] == "en_curso"
        print(f"PASS: Update charla status to 'en_curso'")
    
    def test_update_charla_fields(self, coordinator_token):
        """PATCH /api/coordinacion/charlas/{id} - Update charla fields"""
        if not TestCharlasCRUD.created_charla_id:
            pytest.skip("No charla created to update")
        
        response = requests.patch(
            f"{BASE_URL}/api/coordinacion/charlas/{TestCharlasCRUD.created_charla_id}",
            json={
                "title": "TEST_Charla actualizada",
                "location": "Auditorio principal"
            },
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "TEST_Charla actualizada"
        assert data["location"] == "Auditorio principal"
        print(f"PASS: Update charla fields")


class TestCharlaMaterials:
    """Test Charla materials (link type)"""
    
    added_material_id = None
    
    def test_add_link_material(self, coordinator_token):
        """POST /api/coordinacion/charlas/{id}/materiales - Add link material"""
        payload = {
            "type": "link",
            "url": "https://example.com/test-presentation",
            "public_id": None,
            "name": "TEST_Presentacion de prueba",
            "size_bytes": None
        }
        response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas/{EXISTING_CHARLA_ID}/materiales",
            json=payload,
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Add material failed: {response.text}"
        data = response.json()
        assert data["id"] is not None
        assert data["type"] == "link"
        assert data["url"] == payload["url"]
        assert data["name"] == payload["name"]
        TestCharlaMaterials.added_material_id = data["id"]
        print(f"PASS: Add link material - ID: {data['id']}")
    
    def test_verify_material_added(self, coordinator_token):
        """Verify material was added to charla"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas/{EXISTING_CHARLA_ID}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        materials = data.get("materials", [])
        test_material = next((m for m in materials if m.get("name") == "TEST_Presentacion de prueba"), None)
        assert test_material is not None, "Added material not found in charla"
        print(f"PASS: Material verified in charla - {len(materials)} total materials")
    
    def test_delete_material(self, coordinator_token):
        """DELETE /api/coordinacion/charlas/{id}/materiales/{material_id} - Remove material"""
        if not TestCharlaMaterials.added_material_id:
            pytest.skip("No material added to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/coordinacion/charlas/{EXISTING_CHARLA_ID}/materiales/{TestCharlaMaterials.added_material_id}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Delete material failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        print(f"PASS: Delete material")
    
    def test_invalid_material_type(self, coordinator_token):
        """POST /api/coordinacion/charlas/{id}/materiales - Invalid type should fail"""
        payload = {
            "type": "invalid_type",
            "url": "https://example.com/test",
            "name": "Invalid material"
        }
        response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas/{EXISTING_CHARLA_ID}/materiales",
            json=payload,
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid type, got {response.status_code}"
        print(f"PASS: Invalid material type rejected")


class TestCharlaStudentsAndAttendance:
    """Test charla students endpoint and attendance"""
    
    def test_get_charla_students_no_targets(self, coordinator_token):
        """GET /api/coordinacion/charlas/{id}/estudiantes - Returns empty if no targets"""
        # First create a charla without targets
        scheduled_at = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%dT10:00:00")
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas",
            json={
                "title": "TEST_Charla sin grados",
                "description": "Charla sin grados ni secciones asignados",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "location": "Aula 101",
                "target_grades": [],
                "target_sections": [],
                "topics": []
            },
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert create_response.status_code == 200
        charla_id = create_response.json()["id"]
        
        # Get students - should be empty
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}/estudiantes",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("students") == [], "Expected empty students list for charla without targets"
        print(f"PASS: Get students for charla without targets - empty list returned")
        
        # Cleanup - delete the test charla
        requests.delete(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
    
    def test_get_charla_students_with_targets(self, coordinator_token):
        """GET /api/coordinacion/charlas/{id}/estudiantes - Returns students for targets"""
        # First get available grades
        grades_response = requests.get(
            f"{BASE_URL}/api/coordinacion/grades",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert grades_response.status_code == 200
        grades = grades_response.json()
        
        if not grades:
            pytest.skip("No grades available in school")
        
        # Create charla with first grade as target
        first_grade_id = grades[0]["id"]
        scheduled_at = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%dT10:00:00")
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas",
            json={
                "title": "TEST_Charla con grado",
                "description": "Charla con grado asignado",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "location": "Aula 102",
                "target_grades": [first_grade_id],
                "target_sections": [],
                "topics": []
            },
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert create_response.status_code == 200
        charla_id = create_response.json()["id"]
        
        # Get students
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}/estudiantes",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "students" in data
        print(f"PASS: Get students for charla with grade target - {len(data['students'])} students found")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
    
    def test_save_attendance(self, coordinator_token):
        """POST /api/coordinacion/charlas/{id}/asistencia - Save attendance (Model A)"""
        # Create a test charla
        scheduled_at = (datetime.now() + timedelta(days=16)).strftime("%Y-%m-%dT10:00:00")
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas",
            json={
                "title": "TEST_Charla para asistencia",
                "description": "Charla para probar asistencia",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "location": "Aula 103",
                "target_grades": [],
                "target_sections": [],
                "topics": []
            },
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert create_response.status_code == 200
        charla_id = create_response.json()["id"]
        
        # Save attendance with mock student IDs
        attendance_payload = {
            "attendance": [
                {"student_id": "test-student-1", "present": True},
                {"student_id": "test-student-2", "present": False},
                {"student_id": "test-student-3", "present": True}
            ]
        }
        response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}/asistencia",
            json=attendance_payload,
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Save attendance failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        assert data.get("attendance_count") == 2  # 2 present
        print(f"PASS: Save attendance - {data['attendance_count']} present")
        
        # Verify attendance was saved
        get_response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert get_response.status_code == 200
        charla_data = get_response.json()
        assert len(charla_data.get("attendance", [])) == 3
        print(f"PASS: Attendance verified in charla detail")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )


class TestAgendaIntegration:
    """Test charla events appear in agenda"""
    
    def test_charla_in_agenda(self, coordinator_token):
        """GET /api/coordinacion/agenda - Verify charla events with event_source=charla"""
        # Create a charla for current month
        now = datetime.now()
        scheduled_at = now.strftime("%Y-%m-%dT14:00:00")
        
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas",
            json={
                "title": "TEST_Charla para agenda",
                "description": "Charla para verificar integracion con agenda",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "location": "Auditorio",
                "target_grades": [],
                "target_sections": [],
                "topics": ["Agenda test"]
            },
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert create_response.status_code == 200
        charla_id = create_response.json()["id"]
        
        # Get agenda for current month
        start_date = now.replace(day=1).strftime("%Y-%m-%d")
        end_date = (now.replace(day=28) + timedelta(days=4)).replace(day=1).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/agenda?start_date={start_date}&end_date={end_date}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Get agenda failed: {response.text}"
        data = response.json()
        
        # Find charla event
        charla_events = [e for e in data.get("events", []) if e.get("event_source") == "charla"]
        test_charla_event = next((e for e in charla_events if e.get("id") == charla_id), None)
        
        assert test_charla_event is not None, "Created charla not found in agenda"
        assert test_charla_event["event_source"] == "charla"
        assert "Charla:" in test_charla_event["title"]
        print(f"PASS: Charla appears in agenda with event_source='charla' - {len(charla_events)} charla events total")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )


class TestCharlaRBAC:
    """Test RBAC for charlas endpoints"""
    
    def test_parent_cannot_list_charlas(self, parent_token):
        """Parent role should NOT access charlas endpoints (403)"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for parent, got {response.status_code}"
        print(f"PASS: Parent cannot list charlas (403)")
    
    def test_parent_cannot_get_charla_detail(self, parent_token):
        """Parent role should NOT access charla detail (403)"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas/{EXISTING_CHARLA_ID}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for parent, got {response.status_code}"
        print(f"PASS: Parent cannot get charla detail (403)")
    
    def test_parent_cannot_create_charla(self, parent_token):
        """Parent role should NOT create charlas (403)"""
        payload = {
            "title": "TEST_Charla no autorizada",
            "description": "Esta charla no deberia crearse",
            "scheduled_at": "2026-02-01T10:00:00",
            "duration_minutes": 60,
            "location": "N/A",
            "target_grades": [],
            "target_sections": [],
            "topics": []
        }
        response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas",
            json=payload,
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for parent, got {response.status_code}"
        print(f"PASS: Parent cannot create charla (403)")
    
    def test_owner_can_delete_charla(self, owner_token, coordinator_token):
        """Owner role can delete charlas"""
        # First create a charla as coordinator
        scheduled_at = (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%dT10:00:00")
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas",
            json={
                "title": "TEST_Charla para eliminar",
                "description": "Esta charla sera eliminada por owner",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "location": "Aula test",
                "target_grades": [],
                "target_sections": [],
                "topics": []
            },
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert create_response.status_code == 200
        charla_id = create_response.json()["id"]
        
        # Delete as owner
        response = requests.delete(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Owner delete failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        print(f"PASS: Owner can delete charla")
    
    def test_coordinator_cannot_delete_charla(self, coordinator_token):
        """Coordinator role should NOT delete charlas (only admin/owner)"""
        # First create a charla
        scheduled_at = (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%dT10:00:00")
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas",
            json={
                "title": "TEST_Charla no eliminable por coord",
                "description": "Esta charla no puede ser eliminada por coordinator",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "location": "Aula test",
                "target_grades": [],
                "target_sections": [],
                "topics": []
            },
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert create_response.status_code == 200
        charla_id = create_response.json()["id"]
        
        # Try to delete as coordinator
        response = requests.delete(
            f"{BASE_URL}/api/coordinacion/charlas/{charla_id}",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for coordinator delete, got {response.status_code}"
        print(f"PASS: Coordinator cannot delete charla (403)")


class TestCharlaEdgeCases:
    """Test edge cases and validation"""
    
    def test_get_nonexistent_charla(self, coordinator_token):
        """GET /api/coordinacion/charlas/{id} - 404 for non-existent charla"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas/nonexistent-id-12345",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 404
        print(f"PASS: Non-existent charla returns 404")
    
    def test_update_nonexistent_charla(self, coordinator_token):
        """PATCH /api/coordinacion/charlas/{id} - 404 for non-existent charla"""
        response = requests.patch(
            f"{BASE_URL}/api/coordinacion/charlas/nonexistent-id-12345",
            json={"status": "realizada"},
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 404
        print(f"PASS: Update non-existent charla returns 404")
    
    def test_invalid_status_update(self, coordinator_token):
        """PATCH /api/coordinacion/charlas/{id} - 400 for invalid status"""
        response = requests.patch(
            f"{BASE_URL}/api/coordinacion/charlas/{EXISTING_CHARLA_ID}",
            json={"status": "invalid_status"},
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
        print(f"PASS: Invalid status update returns 400")
    
    def test_add_material_to_nonexistent_charla(self, coordinator_token):
        """POST /api/coordinacion/charlas/{id}/materiales - 404 for non-existent charla"""
        payload = {
            "type": "link",
            "url": "https://example.com/test",
            "name": "Test link"
        }
        response = requests.post(
            f"{BASE_URL}/api/coordinacion/charlas/nonexistent-id-12345/materiales",
            json=payload,
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 404
        print(f"PASS: Add material to non-existent charla returns 404")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_charlas(self, owner_token):
        """Delete all TEST_ prefixed charlas"""
        # List all charlas
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/charlas?page_size=100",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        if response.status_code == 200:
            charlas = response.json().get("items", [])
            deleted_count = 0
            for charla in charlas:
                if charla.get("title", "").startswith("TEST_"):
                    del_response = requests.delete(
                        f"{BASE_URL}/api/coordinacion/charlas/{charla['id']}",
                        headers={"Authorization": f"Bearer {owner_token}"}
                    )
                    if del_response.status_code == 200:
                        deleted_count += 1
            print(f"PASS: Cleanup - deleted {deleted_count} test charlas")
        else:
            print(f"PASS: Cleanup - no charlas to delete")
