"""
Health & Wellness Module Tests
Tests for:
- PARTE A: Health permissions settings (owner controls admin/teacher access)
- PARTE B: Parent health alerts (unacknowledged records popup)
- PARTE C: Parent health read-only view (topico/psicologia history)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
OWNER_SUBDOMAIN = "elroble"

PARENT_EMAIL = "maria.peres@gmail.com"
PARENT_PASSWORD = "Test1234!"
PARENT_SUBDOMAIN = "elroble"
STUDENT_ID = "e303b1de-f1df-4aad-b480-e17319891bba"


class TestHealthPermissions:
    """PARTE A: Health permissions settings tests"""
    
    @pytest.fixture(scope="class")
    def owner_token(self):
        """Login as school owner"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD,
            "subdomain": OWNER_SUBDOMAIN
        })
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        return response.json().get("token")
    
    def test_get_health_permissions_defaults(self, owner_token):
        """GET /api/settings/health-permissions returns correct defaults"""
        response = requests.get(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Default: admin_can_manage=True, teacher_can_manage=False
        assert "admin_can_manage" in data
        assert "teacher_can_manage" in data
        print(f"Health permissions: admin={data.get('admin_can_manage')}, teacher={data.get('teacher_can_manage')}")
    
    def test_update_health_permissions_admin(self, owner_token):
        """PUT /api/settings/health-permissions updates admin permission"""
        # First get current state
        get_response = requests.get(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        current = get_response.json()
        
        # Toggle admin permission
        new_value = not current.get("admin_can_manage", True)
        response = requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            json={"admin_can_manage": new_value},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("permissions", {}).get("admin_can_manage") == new_value
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            json={"admin_can_manage": current.get("admin_can_manage", True)},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print(f"Admin permission toggled to {new_value} and restored")
    
    def test_update_health_permissions_teacher(self, owner_token):
        """PUT /api/settings/health-permissions updates teacher permission"""
        # First get current state
        get_response = requests.get(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        current = get_response.json()
        
        # Toggle teacher permission
        new_value = not current.get("teacher_can_manage", False)
        response = requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            json={"teacher_can_manage": new_value},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("permissions", {}).get("teacher_can_manage") == new_value
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/settings/health-permissions",
            json={"teacher_can_manage": current.get("teacher_can_manage", False)},
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print(f"Teacher permission toggled to {new_value} and restored")


class TestHealthCRUD:
    """Tests for health CRUD endpoints (topico and psicologia)"""
    
    @pytest.fixture(scope="class")
    def owner_token(self):
        """Login as school owner"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD,
            "subdomain": OWNER_SUBDOMAIN
        })
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def test_topico_record_id(self, owner_token):
        """Create a test topico record and return its ID"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/health/topico",
            json={
                "student_id": STUDENT_ID,
                "student_name": "Test Student",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": today,
                "time": "10:00",
                "incident_type": "dolor",
                "description": "TEST_Dolor de cabeza para prueba automatizada",
                "action_taken": "Se administró paracetamol",
                "status": "atendido",
                "responsible": "Enfermera Test"
            },
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Failed to create topico: {response.text}"
        record_id = response.json().get("record", {}).get("id")
        assert record_id, "No record ID returned"
        print(f"Created test topico record: {record_id}")
        yield record_id
        
        # Cleanup: delete the test record
        requests.delete(
            f"{BASE_URL}/api/health/topico/{record_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print(f"Cleaned up test topico record: {record_id}")
    
    def test_create_topico_with_parent_notified_false(self, owner_token):
        """POST /api/health/topico creates records with parent_notified=false"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/health/topico",
            json={
                "student_id": STUDENT_ID,
                "student_name": "Test Student",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": today,
                "time": "11:00",
                "incident_type": "fiebre",
                "description": "TEST_Fiebre para verificar parent_notified",
                "action_taken": "Se tomó temperatura",
                "status": "en_observacion",
                "responsible": "Enfermera Test"
            },
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        record = response.json().get("record", {})
        assert record.get("parent_notified") == False, "parent_notified should be False on creation"
        
        # Cleanup
        record_id = record.get("id")
        if record_id:
            requests.delete(
                f"{BASE_URL}/api/health/topico/{record_id}",
                headers={"Authorization": f"Bearer {owner_token}"}
            )
        print("Verified topico creates with parent_notified=false")
    
    def test_create_psicologia_with_parent_notified_false(self, owner_token):
        """POST /api/health/psicologia creates records with parent_notified=false"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/health/psicologia",
            json={
                "student_id": STUDENT_ID,
                "student_name": "Test Student",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": today,
                "time": "12:00",
                "record_type": "conductual",
                "reason": "TEST_Comportamiento disruptivo para prueba",
                "professional_observation": "Observación de prueba",
                "alert_level": "bajo",
                "requires_followup": False,
                "status": "en_seguimiento",
                "responsible": "Psicólogo Test"
            },
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        record = response.json().get("record", {})
        assert record.get("parent_notified") == False, "parent_notified should be False on creation"
        
        # Cleanup
        record_id = record.get("id")
        if record_id:
            requests.delete(
                f"{BASE_URL}/api/health/psicologia/{record_id}",
                headers={"Authorization": f"Bearer {owner_token}"}
            )
        print("Verified psicologia creates with parent_notified=false")
    
    def test_list_topico_records(self, owner_token, test_topico_record_id):
        """GET /api/health/topico lists records"""
        response = requests.get(
            f"{BASE_URL}/api/health/topico",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "records" in data
        assert "total" in data
        print(f"Listed {data.get('total')} topico records")
    
    def test_get_topico_record(self, owner_token, test_topico_record_id):
        """GET /api/health/topico/{id} returns specific record"""
        response = requests.get(
            f"{BASE_URL}/api/health/topico/{test_topico_record_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("id") == test_topico_record_id
        print(f"Retrieved topico record: {test_topico_record_id}")


class TestParentHealthAlerts:
    """PARTE B: Parent health alerts tests"""
    
    @pytest.fixture(scope="class")
    def parent_token(self):
        """Login as parent"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD,
            "subdomain": PARENT_SUBDOMAIN
        })
        assert response.status_code == 200, f"Parent login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def owner_token(self):
        """Login as school owner"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD,
            "subdomain": OWNER_SUBDOMAIN
        })
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def unacknowledged_topico_id(self, owner_token):
        """Create an unacknowledged topico record for testing alerts"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/health/topico",
            json={
                "student_id": STUDENT_ID,
                "student_name": "Test Student",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": today,
                "time": "14:00",
                "incident_type": "golpe",
                "description": "TEST_Golpe para prueba de alertas",
                "action_taken": "Se aplicó hielo",
                "status": "atendido",
                "responsible": "Enfermera Test"
            },
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Failed to create topico: {response.text}"
        record_id = response.json().get("record", {}).get("id")
        print(f"Created unacknowledged topico for alerts: {record_id}")
        yield record_id
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/health/topico/{record_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print(f"Cleaned up alert test topico: {record_id}")
    
    def test_get_parent_alerts(self, parent_token, unacknowledged_topico_id):
        """GET /api/health/parent/alerts returns unacknowledged records"""
        response = requests.get(
            f"{BASE_URL}/api/health/parent/alerts?student_id={STUDENT_ID}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "alerts" in data
        assert "total" in data
        
        # Should have at least the one we created
        alerts = data.get("alerts", [])
        alert_ids = [a.get("id") for a in alerts]
        assert unacknowledged_topico_id in alert_ids, f"Created alert not found in alerts list"
        print(f"Found {data.get('total')} unacknowledged alerts including test record")
    
    def test_acknowledge_alert(self, parent_token, owner_token):
        """POST /api/health/parent/alerts/{id}/acknowledge marks record as notified"""
        # Create a fresh record to acknowledge
        today = datetime.now().strftime("%Y-%m-%d")
        create_response = requests.post(
            f"{BASE_URL}/api/health/topico",
            json={
                "student_id": STUDENT_ID,
                "student_name": "Test Student",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": today,
                "time": "15:00",
                "incident_type": "malestar_general",
                "description": "TEST_Malestar para prueba de acknowledge",
                "action_taken": "Reposo",
                "status": "atendido",
                "responsible": "Enfermera Test"
            },
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        record_id = create_response.json().get("record", {}).get("id")
        
        # Acknowledge it
        ack_response = requests.post(
            f"{BASE_URL}/api/health/parent/alerts/{record_id}/acknowledge",
            json={"type": "topico"},
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert ack_response.status_code == 200, f"Failed to acknowledge: {ack_response.text}"
        
        # Verify it's no longer in alerts
        alerts_response = requests.get(
            f"{BASE_URL}/api/health/parent/alerts?student_id={STUDENT_ID}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        alerts = alerts_response.json().get("alerts", [])
        alert_ids = [a.get("id") for a in alerts]
        assert record_id not in alert_ids, "Acknowledged alert should not appear in alerts"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/health/topico/{record_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        print(f"Verified acknowledge removes alert from list")


class TestParentHealthHistory:
    """PARTE C: Parent health read-only view tests"""
    
    @pytest.fixture(scope="class")
    def parent_token(self):
        """Login as parent"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD,
            "subdomain": PARENT_SUBDOMAIN
        })
        assert response.status_code == 200, f"Parent login failed: {response.text}"
        return response.json().get("token")
    
    def test_get_parent_topico_history(self, parent_token):
        """GET /api/health/parent/topico returns topico history for child"""
        response = requests.get(
            f"{BASE_URL}/api/health/parent/topico?student_id={STUDENT_ID}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "records" in data
        assert "total" in data
        print(f"Parent can view {data.get('total')} topico records for child")
    
    def test_get_parent_psicologia_history(self, parent_token):
        """GET /api/health/parent/psicologia returns psicologia history for child"""
        response = requests.get(
            f"{BASE_URL}/api/health/parent/psicologia?student_id={STUDENT_ID}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "records" in data
        assert "total" in data
        print(f"Parent can view {data.get('total')} psicologia records for child")
    
    def test_parent_cannot_create_topico(self, parent_token):
        """Parent should not be able to create topico records (403)"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/health/topico",
            json={
                "student_id": STUDENT_ID,
                "student_name": "Test Student",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": today,
                "time": "16:00",
                "incident_type": "otro",
                "description": "Parent should not create this",
                "action_taken": "N/A",
                "status": "atendido",
                "responsible": "N/A"
            },
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Parent should get 403, got {response.status_code}"
        print("Verified parent cannot create topico records (read-only)")
    
    def test_parent_cannot_access_other_student(self, parent_token):
        """Parent should not access records of unrelated student"""
        fake_student_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/health/parent/topico?student_id={fake_student_id}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        # Should get 403 or 404
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print("Verified parent cannot access unrelated student's records")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
