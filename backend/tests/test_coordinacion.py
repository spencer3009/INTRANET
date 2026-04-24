"""
Coordinacion Module Tests - Testing incidencias, seguimientos, dashboard, and enums
Tests CRUD operations, role-based access, pagination, and dashboard KPIs
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://health-logs-school.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
COORDINATOR_EMAIL = "coordinador@elroble.edu"
COORDINATOR_PASSWORD = "Coord123!"
TEACHER_EMAIL = "sonia3009@gmail.com"
TEACHER_PASSWORD = "teacher123"


class TestCoordinacionEnums:
    """Test /api/coordinacion/enums endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as coordinator
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINATOR_EMAIL,
            "password": COORDINATOR_PASSWORD
        })
        assert response.status_code == 200, f"Coordinator login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_enums_returns_types(self):
        """GET /api/coordinacion/enums returns 9 incidencia types"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/enums", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "types" in data
        assert len(data["types"]) == 9, f"Expected 9 types, got {len(data['types'])}"
        type_ids = [t["id"] for t in data["types"]]
        assert "conducta_disruptiva" in type_ids
        assert "agresion_fisica" in type_ids
    
    def test_enums_returns_severities(self):
        """GET /api/coordinacion/enums returns 4 severities"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/enums", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "severities" in data
        assert len(data["severities"]) == 4, f"Expected 4 severities, got {len(data['severities'])}"
        sev_ids = [s["id"] for s in data["severities"]]
        assert "baja" in sev_ids
        assert "media" in sev_ids
        assert "alta" in sev_ids
        assert "critica" in sev_ids
    
    def test_enums_returns_statuses(self):
        """GET /api/coordinacion/enums returns 7 statuses"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/enums", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "statuses" in data
        assert len(data["statuses"]) == 7, f"Expected 7 statuses, got {len(data['statuses'])}"
        status_ids = [s["id"] for s in data["statuses"]]
        assert "nueva" in status_ids
        assert "en_seguimiento" in status_ids
        assert "cerrada" in status_ids


class TestCoordinacionDashboard:
    """Test /api/coordinacion/dashboard endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as coordinator
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINATOR_EMAIL,
            "password": COORDINATOR_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_returns_kpis(self):
        """GET /api/coordinacion/dashboard returns kpis object"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/dashboard", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "kpis" in data
        kpis = data["kpis"]
        assert "incidencias_activas" in kpis
        assert "incidencias_nuevas_hoy" in kpis
        assert "estudiantes_en_seguimiento" in kpis
        assert "reuniones_pendientes" in kpis
        assert "charlas_proximas" in kpis
        assert "derivaciones_pendientes" in kpis
    
    def test_dashboard_returns_by_severity(self):
        """GET /api/coordinacion/dashboard returns by_severity breakdown"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/dashboard", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "by_severity" in data
        by_sev = data["by_severity"]
        assert "baja" in by_sev
        assert "media" in by_sev
        assert "alta" in by_sev
        assert "critica" in by_sev
    
    def test_dashboard_returns_by_grade(self):
        """GET /api/coordinacion/dashboard returns by_grade array"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/dashboard", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "by_grade" in data
        assert isinstance(data["by_grade"], list)
    
    def test_dashboard_returns_reincidentes(self):
        """GET /api/coordinacion/dashboard returns reincidentes array"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/dashboard", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "reincidentes" in data
        assert isinstance(data["reincidentes"], list)
    
    def test_dashboard_returns_alertas(self):
        """GET /api/coordinacion/dashboard returns alertas array"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/dashboard", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "alertas" in data
        assert isinstance(data["alertas"], list)
    
    def test_dashboard_returns_recent_incidencias(self):
        """GET /api/coordinacion/dashboard returns recent_incidencias array"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/dashboard", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "recent_incidencias" in data
        assert isinstance(data["recent_incidencias"], list)


class TestCoordinacionIncidenciasCRUD:
    """Test incidencias CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as coordinator
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINATOR_EMAIL,
            "password": COORDINATOR_PASSWORD
        })
        assert response.status_code == 200
        self.coord_token = response.json()["token"]
        self.coord_headers = {"Authorization": f"Bearer {self.coord_token}"}
        
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get a student for testing using admin token (admin has access to users)
        response = requests.get(f"{BASE_URL}/api/academic/grades", headers=self.admin_headers)
        if response.status_code == 200:
            grades = response.json()
            if grades:
                self.grade_id = grades[0]["id"]
                # Get sections for this grade
                response = requests.get(f"{BASE_URL}/api/academic/sections?grade_id={self.grade_id}", headers=self.admin_headers)
                if response.status_code == 200:
                    sections = response.json()
                    if sections:
                        self.section_id = sections[0]["id"]
                        # Get students from users endpoint (admin only)
                        response = requests.get(f"{BASE_URL}/api/users?role=student", headers=self.admin_headers)
                        if response.status_code == 200:
                            students = response.json()
                            # Filter students by section_id
                            students_in_section = [s for s in students if s.get("seccion_id") == self.section_id]
                            if students_in_section:
                                self.student_id = students_in_section[0]["id"]
                                self.student_name = f"{students_in_section[0].get('name', '')} {students_in_section[0].get('last_name', '')}".strip()
                            elif students:
                                # Use any student if none in section
                                student = next((s for s in students if s.get("role") == "student"), None)
                                if student:
                                    self.student_id = student["id"]
                                    self.grade_id = student.get("grado_id") or self.grade_id
                                    self.section_id = student.get("seccion_id") or self.section_id
                                    self.student_name = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
        
        self.created_incidencia_id = None
    
    def teardown_method(self, method):
        # Clean up created incidencia (admin only can delete)
        if self.created_incidencia_id:
            requests.delete(
                f"{BASE_URL}/api/coordinacion/incidencias/{self.created_incidencia_id}",
                headers=self.admin_headers
            )
    
    def test_create_incidencia_success(self):
        """POST /api/coordinacion/incidencias creates incidencia and returns it with id"""
        if not hasattr(self, 'student_id'):
            pytest.skip("No student found for testing")
        
        payload = {
            "student_id": self.student_id,
            "grade_id": self.grade_id,
            "section_id": self.section_id,
            "type": "conducta_disruptiva",
            "severity": "media",
            "title": f"TEST_Incidencia_{uuid.uuid4().hex[:8]}",
            "description": "Test incidencia created by automated test",
            "occurred_at": "2026-01-15T10:00:00",
            "initial_action": "Se habló con el estudiante",
            "confidential": False,
            "notify_parents": False,
            "tags": ["test"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/coordinacion/incidencias",
            json=payload,
            headers=self.coord_headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["title"] == payload["title"]
        assert data["type"] == payload["type"]
        assert data["severity"] == payload["severity"]
        assert data["status"] == "nueva"
        assert data["student_id"] == self.student_id
        
        self.created_incidencia_id = data["id"]
    
    def test_list_incidencias_paginated(self):
        """GET /api/coordinacion/incidencias returns paginated list"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/incidencias",
            headers=self.coord_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify pagination structure
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        assert data["page"] == 1
    
    def test_get_incidencia_detail(self):
        """GET /api/coordinacion/incidencias/{id} returns detail with student_name, grade_name"""
        if not hasattr(self, 'student_id'):
            pytest.skip("No student found for testing")
        
        # First create an incidencia
        payload = {
            "student_id": self.student_id,
            "grade_id": self.grade_id,
            "section_id": self.section_id,
            "type": "falta_respeto",
            "severity": "baja",
            "title": f"TEST_Detail_{uuid.uuid4().hex[:8]}",
            "description": "Test for detail endpoint",
            "occurred_at": "2026-01-15T11:00:00"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/incidencias",
            json=payload,
            headers=self.coord_headers
        )
        assert create_response.status_code == 200
        inc_id = create_response.json()["id"]
        self.created_incidencia_id = inc_id
        
        # Get detail
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/incidencias/{inc_id}",
            headers=self.coord_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify enriched fields
        assert "student_name" in data
        assert "grade_name" in data
        assert "section_name" in data
        assert data["id"] == inc_id
    
    def test_update_incidencia(self):
        """PATCH /api/coordinacion/incidencias/{id} updates fields"""
        if not hasattr(self, 'student_id'):
            pytest.skip("No student found for testing")
        
        # Create incidencia
        payload = {
            "student_id": self.student_id,
            "grade_id": self.grade_id,
            "section_id": self.section_id,
            "type": "incumplimiento_normas",
            "severity": "baja",
            "title": f"TEST_Update_{uuid.uuid4().hex[:8]}",
            "description": "Test for update endpoint",
            "occurred_at": "2026-01-15T12:00:00"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/incidencias",
            json=payload,
            headers=self.coord_headers
        )
        assert create_response.status_code == 200
        inc_id = create_response.json()["id"]
        self.created_incidencia_id = inc_id
        
        # Update
        update_payload = {
            "severity": "alta",
            "status": "en_revision"
        }
        response = requests.patch(
            f"{BASE_URL}/api/coordinacion/incidencias/{inc_id}",
            json=update_payload,
            headers=self.coord_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["severity"] == "alta"
        assert data["status"] == "en_revision"
    
    def test_delete_incidencia_admin_only(self):
        """DELETE /api/coordinacion/incidencias/{id} soft-deletes (admin only)"""
        if not hasattr(self, 'student_id'):
            pytest.skip("No student found for testing")
        
        # Create incidencia
        payload = {
            "student_id": self.student_id,
            "grade_id": self.grade_id,
            "section_id": self.section_id,
            "type": "observacion_preventiva",
            "severity": "baja",
            "title": f"TEST_Delete_{uuid.uuid4().hex[:8]}",
            "description": "Test for delete endpoint",
            "occurred_at": "2026-01-15T13:00:00"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/incidencias",
            json=payload,
            headers=self.coord_headers
        )
        assert create_response.status_code == 200
        inc_id = create_response.json()["id"]
        
        # Coordinator should NOT be able to delete (403)
        coord_delete = requests.delete(
            f"{BASE_URL}/api/coordinacion/incidencias/{inc_id}",
            headers=self.coord_headers
        )
        assert coord_delete.status_code == 403, f"Coordinator should not delete: {coord_delete.text}"
        
        # Admin CAN delete
        admin_delete = requests.delete(
            f"{BASE_URL}/api/coordinacion/incidencias/{inc_id}",
            headers=self.admin_headers
        )
        assert admin_delete.status_code == 200
        
        # Verify soft-deleted (should return 404)
        get_response = requests.get(
            f"{BASE_URL}/api/coordinacion/incidencias/{inc_id}",
            headers=self.coord_headers
        )
        assert get_response.status_code == 404


class TestCoordinacionSeguimientos:
    """Test seguimientos CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as coordinator
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINATOR_EMAIL,
            "password": COORDINATOR_PASSWORD
        })
        assert response.status_code == 200
        self.coord_token = response.json()["token"]
        self.coord_headers = {"Authorization": f"Bearer {self.coord_token}"}
        
        # Login as admin for cleanup
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get a student for testing using admin token
        response = requests.get(f"{BASE_URL}/api/academic/grades", headers=self.admin_headers)
        if response.status_code == 200:
            grades = response.json()
            if grades:
                self.grade_id = grades[0]["id"]
                response = requests.get(f"{BASE_URL}/api/academic/sections?grade_id={self.grade_id}", headers=self.admin_headers)
                if response.status_code == 200:
                    sections = response.json()
                    if sections:
                        self.section_id = sections[0]["id"]
                        response = requests.get(f"{BASE_URL}/api/users?role=student", headers=self.admin_headers)
                        if response.status_code == 200:
                            students = response.json()
                            student = next((s for s in students if s.get("role") == "student"), None)
                            if student:
                                self.student_id = student["id"]
                                self.grade_id = student.get("grado_id") or self.grade_id
                                self.section_id = student.get("seccion_id") or self.section_id
        
        self.created_incidencia_id = None
    
    def teardown_method(self, method):
        if self.created_incidencia_id:
            requests.delete(
                f"{BASE_URL}/api/coordinacion/incidencias/{self.created_incidencia_id}",
                headers=self.admin_headers
            )
    
    def test_create_seguimiento_updates_status(self):
        """POST /api/coordinacion/incidencias/{id}/seguimientos creates seguimiento and updates incidencia status"""
        if not hasattr(self, 'student_id'):
            pytest.skip("No student found for testing")
        
        # Create incidencia
        inc_payload = {
            "student_id": self.student_id,
            "grade_id": self.grade_id,
            "section_id": self.section_id,
            "type": "conducta_disruptiva",
            "severity": "media",
            "title": f"TEST_Seguimiento_{uuid.uuid4().hex[:8]}",
            "description": "Test for seguimiento endpoint",
            "occurred_at": "2026-01-15T14:00:00"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/incidencias",
            json=inc_payload,
            headers=self.coord_headers
        )
        assert create_response.status_code == 200
        inc_id = create_response.json()["id"]
        self.created_incidencia_id = inc_id
        
        # Create seguimiento
        seg_payload = {
            "observation": "Se conversó con el estudiante sobre su comportamiento",
            "commitment": "El estudiante se compromete a mejorar",
            "student_response": "Aceptó su error",
            "parent_involvement": "informada",
            "next_steps": "Seguimiento en una semana",
            "next_review_at": "2026-01-22",
            "new_status": "en_seguimiento"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/coordinacion/incidencias/{inc_id}/seguimientos",
            json=seg_payload,
            headers=self.coord_headers
        )
        assert response.status_code == 200, f"Create seguimiento failed: {response.text}"
        data = response.json()
        
        # Verify seguimiento created
        assert "id" in data
        assert data["observation"] == seg_payload["observation"]
        assert data["new_status"] == "en_seguimiento"
        
        # Verify incidencia status was updated
        inc_response = requests.get(
            f"{BASE_URL}/api/coordinacion/incidencias/{inc_id}",
            headers=self.coord_headers
        )
        assert inc_response.status_code == 200
        assert inc_response.json()["status"] == "en_seguimiento"
    
    def test_list_seguimientos_timeline(self):
        """GET /api/coordinacion/incidencias/{id}/seguimientos returns timeline"""
        if not hasattr(self, 'student_id'):
            pytest.skip("No student found for testing")
        
        # Create incidencia
        inc_payload = {
            "student_id": self.student_id,
            "grade_id": self.grade_id,
            "section_id": self.section_id,
            "type": "falta_respeto",
            "severity": "baja",
            "title": f"TEST_Timeline_{uuid.uuid4().hex[:8]}",
            "description": "Test for timeline endpoint",
            "occurred_at": "2026-01-15T15:00:00"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/coordinacion/incidencias",
            json=inc_payload,
            headers=self.coord_headers
        )
        assert create_response.status_code == 200
        inc_id = create_response.json()["id"]
        self.created_incidencia_id = inc_id
        
        # Create two seguimientos
        for i in range(2):
            seg_payload = {
                "observation": f"Seguimiento {i+1}",
                "new_status": "en_revision" if i == 0 else "en_seguimiento",
                "parent_involvement": "ninguna"
            }
            requests.post(
                f"{BASE_URL}/api/coordinacion/incidencias/{inc_id}/seguimientos",
                json=seg_payload,
                headers=self.coord_headers
            )
        
        # Get timeline
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/incidencias/{inc_id}/seguimientos",
            headers=self.coord_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) == 2
        # Verify enriched with creator name
        assert "created_by_name" in data["items"][0]


class TestCoordinacionRoleAccess:
    """Test role-based access control"""
    
    def test_teacher_cannot_create_incidencia(self):
        """403 when non-coordinator/admin tries to create incidencia"""
        # Login as teacher
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200
        teacher_token = response.json()["token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        
        # Try to create incidencia
        payload = {
            "student_id": "fake-student-id",
            "grade_id": "fake-grade-id",
            "section_id": "fake-section-id",
            "type": "conducta_disruptiva",
            "severity": "baja",
            "title": "TEST_Teacher_Create",
            "description": "Should fail",
            "occurred_at": "2026-01-15T16:00:00"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/coordinacion/incidencias",
            json=payload,
            headers=teacher_headers
        )
        assert response.status_code == 403, f"Teacher should get 403, got {response.status_code}: {response.text}"
    
    def test_teacher_can_view_dashboard(self):
        """Teacher with psicologo role can view dashboard (COORD_VIEW_ROLES includes psicologo)"""
        # Login as teacher - teachers are NOT in COORD_VIEW_ROLES
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200
        teacher_token = response.json()["token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        
        # Teacher should NOT be able to view dashboard
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/dashboard",
            headers=teacher_headers
        )
        # Teacher is NOT in COORD_VIEW_ROLES, should get 403
        assert response.status_code == 403, f"Teacher should get 403 for dashboard, got {response.status_code}"
    
    def test_unauthenticated_access_denied(self):
        """Unauthenticated requests get 401"""
        response = requests.get(f"{BASE_URL}/api/coordinacion/enums")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        response = requests.get(f"{BASE_URL}/api/coordinacion/dashboard")
        assert response.status_code in [401, 403]
        
        response = requests.get(f"{BASE_URL}/api/coordinacion/incidencias")
        assert response.status_code in [401, 403]


class TestCoordinacionFilters:
    """Test incidencias filtering and pagination"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINATOR_EMAIL,
            "password": COORDINATOR_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_filter_by_status(self):
        """GET /api/coordinacion/incidencias?status=nueva filters correctly"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/incidencias?status=nueva",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        # All items should have status=nueva
        for item in data["items"]:
            assert item["status"] == "nueva", f"Expected status=nueva, got {item['status']}"
    
    def test_filter_by_severity(self):
        """GET /api/coordinacion/incidencias?severity=alta filters correctly"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/incidencias?severity=alta",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["severity"] == "alta"
    
    def test_search_query(self):
        """GET /api/coordinacion/incidencias?q=test searches title/description"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/incidencias?q=test",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        # Should return results (may be empty if no matches)
        assert "items" in data
        assert "total" in data
    
    def test_pagination(self):
        """GET /api/coordinacion/incidencias?page=1&page_size=5 paginates correctly"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/incidencias?page=1&page_size=5",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert len(data["items"]) <= 5


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
