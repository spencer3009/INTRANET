"""
Psychology Module Backend Tests
Tests for psychologist CRUD, psychological records, sessions, and dashboard stats
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fichas-clinical.preview.emergentagent.com')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"

PSYCHOLOGIST_EMAIL = "ana.garcia@elroble.edu"
PSYCHOLOGIST_PASSWORD = "Psico123!"


class TestPsychologyModule:
    """Psychology module endpoint tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def psychologist_token(self):
        """Get psychologist authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PSYCHOLOGIST_EMAIL,
            "password": PSYCHOLOGIST_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Psychologist authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def student_id(self, psychologist_token):
        """Get a student ID for testing records and sessions"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychology/students?limit=1", headers=headers)
        if response.status_code == 200:
            data = response.json()
            students = data.get("students", [])
            if students:
                return students[0]["id"]
        pytest.skip("No students available for testing")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PSYCHOLOGIST CRUD TESTS (Admin-facing)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_list_psychologists_admin(self, admin_token):
        """Test GET /api/v1/psychologists - List psychologists (admin only)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychologists", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # Verify structure if there are psychologists
        if data:
            psych = data[0]
            assert "id" in psych
            assert "name" in psych
            assert "email" in psych
            assert "role" in psych
            assert psych["role"] == "psicologo"
            assert "password" not in psych  # Password should be excluded
    
    def test_count_psychologists_admin(self, admin_token):
        """Test GET /api/v1/psychologists/count - Count psychologists"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychologists/count", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
    
    def test_create_psychologist_admin(self, admin_token):
        """Test POST /api/v1/psychologists - Create psychologist (admin only)"""
        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": "TEST_Psico",
            "last_name": f"Testing_{unique_id}",
            "email": f"test_psico_{unique_id}@elroble.edu",
            "phone": "999888777",
            "password": "TestPsico123!",
            "specialty": "Psicologia Educativa",
            "license_number": f"LIC-{unique_id}",
            "assigned_levels": ["primaria", "secundaria"],
            "office_location": "Oficina 101",
            "schedule_notes": "Lunes a Viernes 8am-4pm"
        }
        
        response = requests.post(f"{BASE_URL}/api/v1/psychologists", headers=headers, json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert "psychologist" in data
        psych = data["psychologist"]
        assert psych["name"] == payload["name"]
        assert psych["email"] == payload["email"]
        assert psych["role"] == "psicologo"
        assert "psychologist_profile" in psych
        assert psych["psychologist_profile"]["specialty"] == payload["specialty"]
        
        # Store for cleanup
        self.__class__.created_psychologist_id = psych["id"]
    
    def test_get_psychologist_by_id_admin(self, admin_token):
        """Test GET /api/v1/psychologists/{id} - Get specific psychologist"""
        if not hasattr(self.__class__, 'created_psychologist_id'):
            pytest.skip("No psychologist created to fetch")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        psych_id = self.__class__.created_psychologist_id
        response = requests.get(f"{BASE_URL}/api/v1/psychologists/{psych_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == psych_id
        assert data["role"] == "psicologo"
    
    def test_update_psychologist_admin(self, admin_token):
        """Test PUT /api/v1/psychologists/{id} - Update psychologist"""
        if not hasattr(self.__class__, 'created_psychologist_id'):
            pytest.skip("No psychologist created to update")
        
        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        psych_id = self.__class__.created_psychologist_id
        payload = {
            "phone": "999111222",
            "office_location": "Oficina 202 - Actualizada"
        }
        
        response = requests.put(f"{BASE_URL}/api/v1/psychologists/{psych_id}", headers=headers, json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
    
    def test_delete_psychologist_admin(self, admin_token):
        """Test DELETE /api/v1/psychologists/{id} - Deactivate psychologist"""
        if not hasattr(self.__class__, 'created_psychologist_id'):
            pytest.skip("No psychologist created to delete")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        psych_id = self.__class__.created_psychologist_id
        response = requests.delete(f"{BASE_URL}/api/v1/psychologists/{psych_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PSYCHOLOGIST SELF-PROFILE TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_my_profile_psychologist(self, psychologist_token):
        """Test GET /api/v1/psychologists/me/profile - Self-profile (psychologist only)"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychologists/me/profile", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "email" in data
        assert data["role"] == "psicologo"
        assert "password" not in data  # Password should be excluded
    
    def test_update_my_profile_psychologist(self, psychologist_token):
        """Test PUT /api/v1/psychologists/me/profile - Update self-profile"""
        headers = {"Authorization": f"Bearer {psychologist_token}", "Content-Type": "application/json"}
        payload = {
            "phone": "987654321",
            "office_location": "Oficina Psicologia - Bloque A",
            "schedule_notes": "Atencion: Lunes a Viernes 9am-5pm"
        }
        
        response = requests.put(f"{BASE_URL}/api/v1/psychologists/me/profile", headers=headers, json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PSYCHOLOGY STUDENTS LIST TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_list_psychology_students(self, psychologist_token):
        """Test GET /api/v1/psychology/students - Student list for psychologist"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychology/students", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "students" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert isinstance(data["students"], list)
        
        # Verify student structure if there are students
        if data["students"]:
            student = data["students"][0]
            assert "id" in student
            assert "name" in student
            assert "has_psychological_record" in student
            assert "total_sessions" in student
    
    def test_list_psychology_students_with_search(self, psychologist_token):
        """Test GET /api/v1/psychology/students with search parameter"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychology/students?search=a", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "students" in data
        assert "total" in data
    
    def test_list_psychology_students_pagination(self, psychologist_token):
        """Test GET /api/v1/psychology/students with pagination"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychology/students?page=1&limit=5", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 5
        assert len(data["students"]) <= 5
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PSYCHOLOGICAL RECORDS TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_psychological_record(self, psychologist_token, student_id):
        """Test POST /api/v1/psychology/records - Create psychological record"""
        headers = {"Authorization": f"Bearer {psychologist_token}", "Content-Type": "application/json"}
        payload = {
            "student_id": student_id,
            "family_structure": "Nuclear - Padres y 2 hermanos",
            "family_members": [
                {"name": "Juan Padre", "relationship": "Padre", "age": 45},
                {"name": "Maria Madre", "relationship": "Madre", "age": 42}
            ],
            "home_environment": "Ambiente familiar estable",
            "developmental_history": "Desarrollo normal sin complicaciones",
            "medical_history": "Sin antecedentes relevantes",
            "previous_interventions": "Ninguna",
            "general_observations": "Estudiante con buen rendimiento academico",
            "risk_level": "bajo",
            "status": "activo"
        }
        
        response = requests.post(f"{BASE_URL}/api/v1/psychology/records", headers=headers, json=payload)
        
        # Could be 200 (created) or 400 (already exists)
        if response.status_code == 400:
            # Record already exists - this is acceptable
            assert "Ya existe" in response.json().get("detail", "")
        else:
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            assert "message" in data
            assert "record" in data
            record = data["record"]
            assert record["student_id"] == student_id
            assert record["risk_level"] == "bajo"
    
    def test_get_psychological_record(self, psychologist_token, student_id):
        """Test GET /api/v1/psychology/records/{student_id} - Get student record"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychology/records/{student_id}", headers=headers)
        
        # Could be 200 (found) or 404 (not found)
        if response.status_code == 404:
            # No record exists - acceptable
            assert "No existe" in response.json().get("detail", "")
        else:
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            assert "student_id" in data
            assert data["student_id"] == student_id
    
    def test_update_psychological_record(self, psychologist_token, student_id):
        """Test PUT /api/v1/psychology/records/{student_id} - Update record"""
        headers = {"Authorization": f"Bearer {psychologist_token}", "Content-Type": "application/json"}
        payload = {
            "general_observations": "Observaciones actualizadas - Progreso positivo",
            "risk_level": "bajo"
        }
        
        response = requests.put(f"{BASE_URL}/api/v1/psychology/records/{student_id}", headers=headers, json=payload)
        
        # Could be 200 (updated) or 404 (not found)
        if response.status_code == 404:
            pytest.skip("No record exists to update")
        else:
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            assert "message" in data
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PSYCHOLOGICAL SESSIONS TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_session(self, psychologist_token, student_id):
        """Test POST /api/v1/psychology/sessions - Create session"""
        headers = {"Authorization": f"Bearer {psychologist_token}", "Content-Type": "application/json"}
        payload = {
            "student_id": student_id,
            "date": "2026-01-15",
            "session_type": "Individual",
            "reason_category": "Academico",
            "reason_detail": "Dificultades de concentracion",
            "observations": "Sesion inicial de evaluacion. Estudiante muestra buena disposicion.",
            "techniques_used": "Entrevista clinica, observacion",
            "agreements": "Seguimiento semanal",
            "recommendations": "Tecnicas de estudio y organizacion",
            "next_session_date": "2026-01-22",
            "next_session_notes": "Revisar avances",
            "mood_assessment": "Tranquilo",
            "is_confidential": False
        }
        
        response = requests.post(f"{BASE_URL}/api/v1/psychology/sessions", headers=headers, json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert "session" in data
        session = data["session"]
        assert session["student_id"] == student_id
        assert session["session_type"] == "Individual"
        assert session["reason_category"] == "Academico"
        
        # Store for later tests
        self.__class__.created_session_id = session["id"]
    
    def test_list_sessions(self, psychologist_token):
        """Test GET /api/v1/psychology/sessions - List sessions"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychology/sessions", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "sessions" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert isinstance(data["sessions"], list)
    
    def test_list_sessions_by_student(self, psychologist_token, student_id):
        """Test GET /api/v1/psychology/sessions with student_id filter"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychology/sessions?student_id={student_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "sessions" in data
        # All sessions should be for the specified student
        for session in data["sessions"]:
            assert session["student_id"] == student_id
    
    def test_get_session_by_id(self, psychologist_token):
        """Test GET /api/v1/psychology/sessions/{session_id} - Get specific session"""
        if not hasattr(self.__class__, 'created_session_id'):
            pytest.skip("No session created to fetch")
        
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        session_id = self.__class__.created_session_id
        response = requests.get(f"{BASE_URL}/api/v1/psychology/sessions/{session_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == session_id
    
    def test_update_session(self, psychologist_token):
        """Test PUT /api/v1/psychology/sessions/{session_id} - Update session"""
        if not hasattr(self.__class__, 'created_session_id'):
            pytest.skip("No session created to update")
        
        headers = {"Authorization": f"Bearer {psychologist_token}", "Content-Type": "application/json"}
        session_id = self.__class__.created_session_id
        payload = {
            "observations": "Sesion actualizada - Progreso notable",
            "agreements": "Continuar con seguimiento quincenal"
        }
        
        response = requests.put(f"{BASE_URL}/api/v1/psychology/sessions/{session_id}", headers=headers, json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
    
    def test_delete_session(self, psychologist_token):
        """Test DELETE /api/v1/psychology/sessions/{session_id} - Delete session"""
        if not hasattr(self.__class__, 'created_session_id'):
            pytest.skip("No session created to delete")
        
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        session_id = self.__class__.created_session_id
        response = requests.delete(f"{BASE_URL}/api/v1/psychology/sessions/{session_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DASHBOARD STATS TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_dashboard_stats(self, psychologist_token):
        """Test GET /api/v1/psychology/dashboard/stats - Dashboard stats"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        response = requests.get(f"{BASE_URL}/api/v1/psychology/dashboard/stats", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify all expected fields
        assert "total_in_seguimiento" in data
        assert "sessions_this_month" in data
        assert "sessions_today" in data
        assert "new_cases_this_month" in data
        assert "recent_sessions" in data
        
        # Verify types
        assert isinstance(data["total_in_seguimiento"], int)
        assert isinstance(data["sessions_this_month"], int)
        assert isinstance(data["sessions_today"], int)
        assert isinstance(data["new_cases_this_month"], int)
        assert isinstance(data["recent_sessions"], list)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # AUTHORIZATION TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_psychologist_cannot_access_admin_endpoints(self, psychologist_token):
        """Test that psychologist cannot access admin-only endpoints"""
        headers = {"Authorization": f"Bearer {psychologist_token}"}
        
        # Try to list all psychologists (admin only)
        response = requests.get(f"{BASE_URL}/api/v1/psychologists", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_admin_cannot_access_psychologist_self_profile(self, admin_token):
        """Test that admin cannot access psychologist self-profile endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Try to get self profile (psychologist only)
        response = requests.get(f"{BASE_URL}/api/v1/psychologists/me/profile", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated requests are denied"""
        response = requests.get(f"{BASE_URL}/api/v1/psychology/students")
        assert response.status_code == 401 or response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
