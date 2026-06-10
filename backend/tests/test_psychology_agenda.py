"""
Psychology Agenda & Workshops Module Tests (Phase 5)
Tests for appointments calendar and group workshops management
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://grades-passthrough.preview.emergentagent.com')

# Test credentials
PSYCHOLOGIST_EMAIL = "ana.garcia@elroble.edu"
PSYCHOLOGIST_PASSWORD = "Psico123!"
SUBDOMAIN = "elroble"


class TestPsychologyAgendaModule:
    """Tests for Psychology Agenda (Appointments) and Workshops endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as psychologist and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as psychologist
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": PSYCHOLOGIST_EMAIL,
                "password": PSYCHOLOGIST_PASSWORD,
                "subdomain": SUBDOMAIN
            }
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # APPOINTMENTS TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_list_appointments(self):
        """GET /api/v1/psychology/appointments - List appointments"""
        response = self.session.get(f"{BASE_URL}/api/v1/psychology/appointments")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "appointments" in data
        print(f"✓ List appointments: {len(data['appointments'])} appointments found")
    
    def test_02_today_appointments(self):
        """GET /api/v1/psychology/appointments/today - Get today's appointments"""
        response = self.session.get(f"{BASE_URL}/api/v1/psychology/appointments/today")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "appointments" in data
        assert "count" in data
        print(f"✓ Today's appointments: {data['count']} appointments")
    
    def test_03_week_summary(self):
        """GET /api/v1/psychology/appointments/week-summary - Get week summary"""
        response = self.session.get(f"{BASE_URL}/api/v1/psychology/appointments/week-summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "week_start" in data
        assert "days" in data
        print(f"✓ Week summary: {len(data['days'])} days")
    
    def test_04_create_appointment(self):
        """POST /api/v1/psychology/appointments - Create new appointment"""
        tomorrow = (datetime.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        
        payload = {
            "title": "TEST_Cita E2E Prueba",
            "description": "Cita de prueba creada por test automatizado",
            "appointment_type": "sesion_individual",
            "date": tomorrow.isoformat(),
            "duration_minutes": 45,
            "location": "Consultorio Principal"
        }
        
        response = self.session.post(f"{BASE_URL}/api/v1/psychology/appointments", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "appointments" in data
        assert len(data["appointments"]) > 0
        
        # Store appointment ID for later tests
        self.__class__.created_appointment_id = data["appointments"][0]["id"]
        print(f"✓ Created appointment: {self.__class__.created_appointment_id}")
    
    def test_05_get_appointment(self):
        """GET /api/v1/psychology/appointments/{id} - Get specific appointment"""
        if not hasattr(self.__class__, 'created_appointment_id'):
            pytest.skip("No appointment created in previous test")
        
        response = self.session.get(f"{BASE_URL}/api/v1/psychology/appointments/{self.__class__.created_appointment_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == self.__class__.created_appointment_id
        assert data["title"] == "TEST_Cita E2E Prueba"
        print(f"✓ Get appointment: {data['title']}")
    
    def test_06_update_appointment(self):
        """PUT /api/v1/psychology/appointments/{id} - Update appointment"""
        if not hasattr(self.__class__, 'created_appointment_id'):
            pytest.skip("No appointment created in previous test")
        
        payload = {
            "title": "TEST_Cita E2E Actualizada",
            "location": "Consultorio Secundario"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/v1/psychology/appointments/{self.__class__.created_appointment_id}",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/v1/psychology/appointments/{self.__class__.created_appointment_id}")
        data = get_response.json()
        assert data["title"] == "TEST_Cita E2E Actualizada"
        assert data["location"] == "Consultorio Secundario"
        print(f"✓ Updated appointment: {data['title']}")
    
    def test_07_check_conflict(self):
        """GET /api/v1/psychology/appointments/check-conflict - Check for conflicts"""
        tomorrow = (datetime.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/appointments/check-conflict",
            params={"date": tomorrow.isoformat(), "duration_minutes": 45}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "has_conflict" in data
        print(f"✓ Check conflict: has_conflict={data['has_conflict']}")
    
    def test_08_update_appointment_status(self):
        """PUT /api/v1/psychology/appointments/{id}/status - Update status"""
        if not hasattr(self.__class__, 'created_appointment_id'):
            pytest.skip("No appointment created in previous test")
        
        payload = {
            "status": "completada",
            "notes_post": "Sesion completada exitosamente"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/v1/psychology/appointments/{self.__class__.created_appointment_id}/status",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Updated status: {data['message']}")
    
    def test_09_delete_appointment(self):
        """DELETE /api/v1/psychology/appointments/{id} - Delete appointment"""
        if not hasattr(self.__class__, 'created_appointment_id'):
            pytest.skip("No appointment created in previous test")
        
        response = self.session.delete(
            f"{BASE_URL}/api/v1/psychology/appointments/{self.__class__.created_appointment_id}",
            params={"delete_scope": "single"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/v1/psychology/appointments/{self.__class__.created_appointment_id}")
        assert get_response.status_code == 404
        print(f"✓ Deleted appointment")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # WORKSHOPS TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_10_list_workshops(self):
        """GET /api/v1/psychology/workshops - List workshops"""
        response = self.session.get(f"{BASE_URL}/api/v1/psychology/workshops")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "workshops" in data
        assert "total" in data
        print(f"✓ List workshops: {data['total']} workshops found")
    
    def test_11_list_workshops_with_filters(self):
        """GET /api/v1/psychology/workshops - List with status filter"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/workshops",
            params={"status": "planificado", "limit": 5}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "workshops" in data
        print(f"✓ List workshops (planificado): {len(data['workshops'])} workshops")
    
    def test_12_upcoming_workshops(self):
        """GET /api/v1/psychology/workshops/upcoming - Get upcoming workshops"""
        response = self.session.get(f"{BASE_URL}/api/v1/psychology/workshops/upcoming")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "workshops" in data
        print(f"✓ Upcoming workshops: {len(data['workshops'])} workshops")
    
    def test_13_create_workshop(self):
        """POST /api/v1/psychology/workshops - Create new workshop"""
        next_week = (datetime.now() + timedelta(days=7)).replace(hour=14, minute=0, second=0, microsecond=0)
        
        payload = {
            "title": "TEST_Taller E2E Prueba",
            "description": "Taller de prueba creado por test automatizado",
            "topic_category": "manejo_emociones",
            "date": next_week.isoformat(),
            "duration_minutes": 90,
            "target_level": "secundaria",
            "location": "Auditorio Principal",
            "objectives": ["Objetivo 1: Identificar emociones", "Objetivo 2: Tecnicas de manejo"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/v1/psychology/workshops", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "workshop" in data
        assert data["workshop"]["title"] == "TEST_Taller E2E Prueba"
        
        # Store workshop ID for later tests
        self.__class__.created_workshop_id = data["workshop"]["id"]
        print(f"✓ Created workshop: {self.__class__.created_workshop_id}")
    
    def test_14_get_workshop(self):
        """GET /api/v1/psychology/workshops/{id} - Get specific workshop"""
        if not hasattr(self.__class__, 'created_workshop_id'):
            pytest.skip("No workshop created in previous test")
        
        response = self.session.get(f"{BASE_URL}/api/v1/psychology/workshops/{self.__class__.created_workshop_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == self.__class__.created_workshop_id
        assert data["title"] == "TEST_Taller E2E Prueba"
        print(f"✓ Get workshop: {data['title']}")
    
    def test_15_update_workshop(self):
        """PUT /api/v1/psychology/workshops/{id} - Update workshop"""
        if not hasattr(self.__class__, 'created_workshop_id'):
            pytest.skip("No workshop created in previous test")
        
        payload = {
            "title": "TEST_Taller E2E Actualizado",
            "location": "Sala de Usos Multiples"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/v1/psychology/workshops/{self.__class__.created_workshop_id}",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/v1/psychology/workshops/{self.__class__.created_workshop_id}")
        data = get_response.json()
        assert data["title"] == "TEST_Taller E2E Actualizado"
        assert data["location"] == "Sala de Usos Multiples"
        print(f"✓ Updated workshop: {data['title']}")
    
    def test_16_update_workshop_status_to_en_curso(self):
        """PUT /api/v1/psychology/workshops/{id} - Change status to en_curso"""
        if not hasattr(self.__class__, 'created_workshop_id'):
            pytest.skip("No workshop created in previous test")
        
        payload = {"status": "en_curso"}
        
        response = self.session.put(
            f"{BASE_URL}/api/v1/psychology/workshops/{self.__class__.created_workshop_id}",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify status change
        get_response = self.session.get(f"{BASE_URL}/api/v1/psychology/workshops/{self.__class__.created_workshop_id}")
        data = get_response.json()
        assert data["status"] == "en_curso"
        print(f"✓ Workshop status changed to en_curso")
    
    def test_17_complete_workshop(self):
        """PUT /api/v1/psychology/workshops/{id}/complete - Complete workshop"""
        if not hasattr(self.__class__, 'created_workshop_id'):
            pytest.skip("No workshop created in previous test")
        
        payload = {
            "observations": "Taller completado exitosamente",
            "outcomes": "Los estudiantes mostraron mejora en identificacion de emociones",
            "actual_attendees": 25
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/v1/psychology/workshops/{self.__class__.created_workshop_id}/complete",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify completion
        get_response = self.session.get(f"{BASE_URL}/api/v1/psychology/workshops/{self.__class__.created_workshop_id}")
        data = get_response.json()
        assert data["status"] == "completado"
        assert data["actual_attendees"] == 25
        print(f"✓ Workshop completed with {data['actual_attendees']} attendees")
    
    def test_18_delete_workshop_completed_fails(self):
        """DELETE /api/v1/psychology/workshops/{id} - Cannot delete completed workshop"""
        if not hasattr(self.__class__, 'created_workshop_id'):
            pytest.skip("No workshop created in previous test")
        
        response = self.session.delete(f"{BASE_URL}/api/v1/psychology/workshops/{self.__class__.created_workshop_id}")
        # Should fail because workshop is completed
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ Cannot delete completed workshop (expected behavior)")
    
    def test_19_create_and_delete_workshop(self):
        """Create and delete a planificado workshop"""
        next_month = (datetime.now() + timedelta(days=30)).replace(hour=14, minute=0, second=0, microsecond=0)
        
        # Create
        payload = {
            "title": "TEST_Taller Para Eliminar",
            "topic_category": "autoestima",
            "date": next_month.isoformat(),
            "duration_minutes": 60,
            "target_level": "primaria"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/v1/psychology/workshops", json=payload)
        assert create_response.status_code == 200
        workshop_id = create_response.json()["workshop"]["id"]
        
        # Delete
        delete_response = self.session.delete(f"{BASE_URL}/api/v1/psychology/workshops/{workshop_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/v1/psychology/workshops/{workshop_id}")
        assert get_response.status_code == 404
        print(f"✓ Created and deleted workshop successfully")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DASHBOARD INTEGRATION TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_20_dashboard_stats(self):
        """GET /api/v1/psychology/dashboard/stats - Dashboard stats"""
        response = self.session.get(f"{BASE_URL}/api/v1/psychology/dashboard/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Verify expected fields
        assert "total_in_seguimiento" in data or "sessions_this_month" in data
        print(f"✓ Dashboard stats loaded")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
