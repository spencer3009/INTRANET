"""
Test suite for Discipline Module (Reportes Disciplinarios)
Tests: GET/POST/PUT/DELETE /api/discipline, PUT /api/discipline/{id}/status, GET /api/discipline/stats/summary
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"

# ══════════════════════════════════════════════════════════════════════════════
# FIXTURES
# ══════════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for admin user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in login response"
    return data["token"]

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client

@pytest.fixture(scope="module")
def test_student(authenticated_client):
    """Get or create a test student for discipline reports"""
    # First, get existing students
    response = authenticated_client.get(f"{BASE_URL}/api/users")
    assert response.status_code == 200
    users = response.json()
    
    # Find a student
    students = [u for u in users if u.get("role") == "student"]
    if students:
        return students[0]
    
    # If no student exists, create one
    # First get grades and sections
    grades_res = authenticated_client.get(f"{BASE_URL}/api/academic/grades")
    sections_res = authenticated_client.get(f"{BASE_URL}/api/academic/sections")
    
    grades = grades_res.json() if grades_res.status_code == 200 else []
    sections = sections_res.json() if sections_res.status_code == 200 else []
    
    active_grades = [g for g in grades if g.get("activo")]
    active_sections = [s for s in sections if s.get("activo")]
    
    if not active_grades or not active_sections:
        pytest.skip("No active grades or sections available for creating test student")
    
    grade = active_grades[0]
    section = [s for s in active_sections if s.get("grado_id") == grade["id"]]
    if not section:
        section = active_sections[0]
    else:
        section = section[0]
    
    # Create test student
    student_data = {
        "username": f"test_student_{uuid.uuid4().hex[:8]}",
        "password": "test123",
        "name": "TEST_Estudiante",
        "last_name": "Disciplina",
        "role": "student",
        "grado_id": grade["id"],
        "seccion_id": section["id"]
    }
    
    response = authenticated_client.post(f"{BASE_URL}/api/users", json=student_data)
    if response.status_code == 200:
        return response.json().get("user", {})
    
    pytest.skip("Could not create test student")

@pytest.fixture(scope="module")
def test_grade_section(authenticated_client):
    """Get active grade and section for testing"""
    grades_res = authenticated_client.get(f"{BASE_URL}/api/academic/grades")
    sections_res = authenticated_client.get(f"{BASE_URL}/api/academic/sections")
    
    grades = grades_res.json() if grades_res.status_code == 200 else []
    sections = sections_res.json() if sections_res.status_code == 200 else []
    
    active_grades = [g for g in grades if g.get("activo")]
    active_sections = [s for s in sections if s.get("activo")]
    
    if not active_grades or not active_sections:
        pytest.skip("No active grades or sections available")
    
    grade = active_grades[0]
    # Try to find a section for this grade
    matching_sections = [s for s in active_sections if s.get("grado_id") == grade["id"]]
    section = matching_sections[0] if matching_sections else active_sections[0]
    
    return {"grade": grade, "section": section}

@pytest.fixture
def cleanup_test_reports(authenticated_client):
    """Cleanup test reports after tests"""
    created_ids = []
    yield created_ids
    
    # Cleanup
    for report_id in created_ids:
        try:
            authenticated_client.delete(f"{BASE_URL}/api/discipline/{report_id}")
        except:
            pass


# ══════════════════════════════════════════════════════════════════════════════
# AUTHENTICATION TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestDisciplineAuth:
    """Test authentication requirements for discipline endpoints"""
    
    def test_get_reports_requires_auth(self, api_client):
        """GET /api/discipline requires authentication"""
        # Remove auth header temporarily
        headers = {"Content-Type": "application/json"}
        response = requests.get(f"{BASE_URL}/api/discipline", headers=headers)
        assert response.status_code == 401, "Should require authentication"
    
    def test_create_report_requires_auth(self, api_client):
        """POST /api/discipline requires authentication"""
        headers = {"Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/discipline", headers=headers, json={
            "student_id": "test",
            "grade_id": "test",
            "section_id": "test",
            "title": "Test",
            "description": "Test",
            "incident_date": "2026-01-15"
        })
        assert response.status_code == 401, "Should require authentication"
    
    def test_stats_requires_auth(self, api_client):
        """GET /api/discipline/stats/summary requires authentication"""
        headers = {"Content-Type": "application/json"}
        response = requests.get(f"{BASE_URL}/api/discipline/stats/summary", headers=headers)
        assert response.status_code == 401, "Should require authentication"


# ══════════════════════════════════════════════════════════════════════════════
# GET REPORTS TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestGetDisciplineReports:
    """Test GET /api/discipline endpoint"""
    
    def test_get_reports_success(self, authenticated_client):
        """GET /api/discipline returns list of reports"""
        response = authenticated_client.get(f"{BASE_URL}/api/discipline")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list"
    
    def test_get_reports_with_grade_filter(self, authenticated_client, test_grade_section):
        """GET /api/discipline?grade_id=X filters by grade"""
        grade_id = test_grade_section["grade"]["id"]
        response = authenticated_client.get(f"{BASE_URL}/api/discipline?grade_id={grade_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned reports should have the specified grade_id
        for report in data:
            assert report.get("grade_id") == grade_id
    
    def test_get_reports_with_priority_filter(self, authenticated_client):
        """GET /api/discipline?priority=high filters by priority"""
        response = authenticated_client.get(f"{BASE_URL}/api/discipline?priority=high")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for report in data:
            assert report.get("priority") == "high"
    
    def test_get_reports_with_status_filter(self, authenticated_client):
        """GET /api/discipline?status=open filters by status"""
        response = authenticated_client.get(f"{BASE_URL}/api/discipline?status=open")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for report in data:
            assert report.get("status") == "open"


# ══════════════════════════════════════════════════════════════════════════════
# CREATE REPORT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestCreateDisciplineReport:
    """Test POST /api/discipline endpoint"""
    
    def test_create_report_success(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """POST /api/discipline creates a new report"""
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Incidente de prueba",
            "description": "Descripción del incidente de prueba para testing",
            "priority": "medium",
            "incident_date": "2026-01-15"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert response.status_code == 200, f"Failed to create report: {response.text}"
        
        data = response.json()
        assert "report" in data, "Response should contain 'report'"
        report = data["report"]
        
        # Track for cleanup
        cleanup_test_reports.append(report["id"])
        
        # Verify report data
        assert report["title"] == report_data["title"]
        assert report["description"] == report_data["description"]
        assert report["priority"] == "medium"
        assert report["status"] == "open", "New reports should have 'open' status"
        assert report["student_id"] == test_student["id"]
        assert "created_at" in report
        assert "id" in report
    
    def test_create_report_with_high_priority(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """POST /api/discipline with high priority"""
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Incidente alta prioridad",
            "description": "Incidente de alta prioridad",
            "priority": "high",
            "incident_date": "2026-01-16"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert response.status_code == 200
        
        report = response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        assert report["priority"] == "high"
        assert report["priority_label"] == "Alta"
    
    def test_create_report_with_critical_priority(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """POST /api/discipline with critical priority"""
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Incidente crítico",
            "description": "Incidente de prioridad crítica",
            "priority": "critical",
            "incident_date": "2026-01-17"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert response.status_code == 200
        
        report = response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        assert report["priority"] == "critical"
        assert report["priority_label"] == "Crítica"
    
    def test_create_report_invalid_student(self, authenticated_client, test_grade_section):
        """POST /api/discipline with invalid student_id returns error"""
        report_data = {
            "student_id": "invalid-student-id",
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Invalid student",
            "description": "Test",
            "incident_date": "2026-01-15"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert response.status_code == 400, "Should reject invalid student_id"
    
    def test_create_report_missing_title(self, authenticated_client, test_student, test_grade_section):
        """POST /api/discipline without title returns validation error"""
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "description": "Test description",
            "incident_date": "2026-01-15"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert response.status_code == 422, "Should require title"


# ══════════════════════════════════════════════════════════════════════════════
# GET SINGLE REPORT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestGetSingleReport:
    """Test GET /api/discipline/{id} endpoint"""
    
    def test_get_report_by_id(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """GET /api/discipline/{id} returns single report"""
        # First create a report
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Reporte para obtener",
            "description": "Test description",
            "priority": "low",
            "incident_date": "2026-01-18"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        created_report = create_response.json()["report"]
        cleanup_test_reports.append(created_report["id"])
        
        # Now get the report by ID
        response = authenticated_client.get(f"{BASE_URL}/api/discipline/{created_report['id']}")
        assert response.status_code == 200
        
        report = response.json()
        assert report["id"] == created_report["id"]
        assert report["title"] == report_data["title"]
        assert "student_name" in report
        assert "grade_name" in report
        assert "section_name" in report
        assert "created_by_name" in report
    
    def test_get_nonexistent_report(self, authenticated_client):
        """GET /api/discipline/{id} returns 404 for nonexistent report"""
        response = authenticated_client.get(f"{BASE_URL}/api/discipline/nonexistent-id-12345")
        assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# UPDATE REPORT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestUpdateDisciplineReport:
    """Test PUT /api/discipline/{id} endpoint"""
    
    def test_update_report_title(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """PUT /api/discipline/{id} updates report title"""
        # Create report
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Título original",
            "description": "Descripción original",
            "incident_date": "2026-01-19"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        # Update title
        update_response = authenticated_client.put(
            f"{BASE_URL}/api/discipline/{report['id']}",
            json={"title": "TEST_Título actualizado"}
        )
        assert update_response.status_code == 200
        
        updated = update_response.json()["report"]
        assert updated["title"] == "TEST_Título actualizado"
    
    def test_update_report_priority(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """PUT /api/discipline/{id} updates report priority"""
        # Create report with low priority
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Cambio de prioridad",
            "description": "Test",
            "priority": "low",
            "incident_date": "2026-01-20"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        # Update to high priority
        update_response = authenticated_client.put(
            f"{BASE_URL}/api/discipline/{report['id']}",
            json={"priority": "high"}
        )
        assert update_response.status_code == 200
        
        updated = update_response.json()["report"]
        assert updated["priority"] == "high"
    
    def test_update_nonexistent_report(self, authenticated_client):
        """PUT /api/discipline/{id} returns 404 for nonexistent report"""
        response = authenticated_client.put(
            f"{BASE_URL}/api/discipline/nonexistent-id-12345",
            json={"title": "Test"}
        )
        assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# STATUS CHANGE TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestDisciplineStatusChange:
    """Test PUT /api/discipline/{id}/status endpoint"""
    
    def test_change_status_to_in_review(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """PUT /api/discipline/{id}/status changes status to in_review"""
        # Create report
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Cambio a revisión",
            "description": "Test",
            "incident_date": "2026-01-21"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        # Change status
        status_response = authenticated_client.put(
            f"{BASE_URL}/api/discipline/{report['id']}/status",
            json={"status": "in_review"}
        )
        assert status_response.status_code == 200
        
        data = status_response.json()
        assert data["status"] == "in_review"
        assert data["status_label"] == "En revisión"
    
    def test_change_status_to_resolved(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """PUT /api/discipline/{id}/status changes status to resolved"""
        # Create report
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Resolver reporte",
            "description": "Test",
            "incident_date": "2026-01-22"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        # Change status to resolved
        status_response = authenticated_client.put(
            f"{BASE_URL}/api/discipline/{report['id']}/status",
            json={"status": "resolved"}
        )
        assert status_response.status_code == 200
        
        data = status_response.json()
        assert data["status"] == "resolved"
        assert data["status_label"] == "Resuelto"
    
    def test_change_status_to_archived(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """PUT /api/discipline/{id}/status changes status to archived"""
        # Create report
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Archivar reporte",
            "description": "Test",
            "incident_date": "2026-01-23"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        # Change status to archived
        status_response = authenticated_client.put(
            f"{BASE_URL}/api/discipline/{report['id']}/status",
            json={"status": "archived"}
        )
        assert status_response.status_code == 200
        
        data = status_response.json()
        assert data["status"] == "archived"
        assert data["status_label"] == "Archivado"
    
    def test_status_change_nonexistent_report(self, authenticated_client):
        """PUT /api/discipline/{id}/status returns 404 for nonexistent report"""
        response = authenticated_client.put(
            f"{BASE_URL}/api/discipline/nonexistent-id-12345/status",
            json={"status": "resolved"}
        )
        assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# DELETE REPORT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestDeleteDisciplineReport:
    """Test DELETE /api/discipline/{id} endpoint"""
    
    def test_delete_report_success(self, authenticated_client, test_student, test_grade_section):
        """DELETE /api/discipline/{id} deletes report"""
        # Create report
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Reporte a eliminar",
            "description": "Test",
            "incident_date": "2026-01-24"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        
        # Delete report
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/discipline/{report['id']}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = authenticated_client.get(f"{BASE_URL}/api/discipline/{report['id']}")
        assert get_response.status_code == 404, "Report should be deleted"
    
    def test_delete_nonexistent_report(self, authenticated_client):
        """DELETE /api/discipline/{id} returns 404 for nonexistent report"""
        response = authenticated_client.delete(f"{BASE_URL}/api/discipline/nonexistent-id-12345")
        assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# STATS TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestDisciplineStats:
    """Test GET /api/discipline/stats/summary endpoint"""
    
    def test_get_stats_success(self, authenticated_client):
        """GET /api/discipline/stats/summary returns statistics"""
        response = authenticated_client.get(f"{BASE_URL}/api/discipline/stats/summary")
        assert response.status_code == 200
        
        data = response.json()
        assert "total" in data
        assert "by_status" in data
        assert "by_priority" in data
        
        # Verify status breakdown
        by_status = data["by_status"]
        assert "open" in by_status
        assert "in_review" in by_status
        assert "resolved" in by_status
        assert "archived" in by_status
        
        # Verify priority breakdown
        by_priority = data["by_priority"]
        assert "low" in by_priority
        assert "medium" in by_priority
        assert "high" in by_priority
        assert "critical" in by_priority
    
    def test_stats_counts_are_integers(self, authenticated_client):
        """Stats counts should be integers"""
        response = authenticated_client.get(f"{BASE_URL}/api/discipline/stats/summary")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["total"], int)
        
        for status, count in data["by_status"].items():
            assert isinstance(count, int), f"Status count for {status} should be int"
        
        for priority, count in data["by_priority"].items():
            assert isinstance(count, int), f"Priority count for {priority} should be int"


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestDisciplineIntegration:
    """Integration tests for full discipline workflow"""
    
    def test_full_workflow_create_review_resolve(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """Full workflow: Create -> Review -> Resolve"""
        # 1. Create report
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Workflow completo",
            "description": "Incidente para probar workflow completo",
            "priority": "high",
            "incident_date": "2026-01-25"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        assert report["status"] == "open"
        
        # 2. Move to in_review
        review_response = authenticated_client.put(
            f"{BASE_URL}/api/discipline/{report['id']}/status",
            json={"status": "in_review"}
        )
        assert review_response.status_code == 200
        assert review_response.json()["status"] == "in_review"
        
        # 3. Verify report shows in_review status
        get_response = authenticated_client.get(f"{BASE_URL}/api/discipline/{report['id']}")
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "in_review"
        
        # 4. Resolve the report
        resolve_response = authenticated_client.put(
            f"{BASE_URL}/api/discipline/{report['id']}/status",
            json={"status": "resolved"}
        )
        assert resolve_response.status_code == 200
        assert resolve_response.json()["status"] == "resolved"
        
        # 5. Verify final state
        final_response = authenticated_client.get(f"{BASE_URL}/api/discipline/{report['id']}")
        assert final_response.status_code == 200
        final_report = final_response.json()
        assert final_report["status"] == "resolved"
        assert final_report["reviewed_by"] is not None, "Should have reviewer set"
    
    def test_filter_by_multiple_criteria(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """Test filtering by multiple criteria"""
        # Create a report with specific criteria
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Filtro múltiple",
            "description": "Test",
            "priority": "critical",
            "incident_date": "2026-01-26"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        # Filter by grade and priority
        filter_response = authenticated_client.get(
            f"{BASE_URL}/api/discipline?grade_id={test_grade_section['grade']['id']}&priority=critical"
        )
        assert filter_response.status_code == 200
        
        reports = filter_response.json()
        # Should find our report
        found = any(r["id"] == report["id"] for r in reports)
        assert found, "Created report should be found with filters"
    
    def test_stats_update_after_create(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """Stats should update after creating a report"""
        # Get initial stats
        initial_stats = authenticated_client.get(f"{BASE_URL}/api/discipline/stats/summary").json()
        initial_open = initial_stats["by_status"]["open"]
        
        # Create a report
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Stats update",
            "description": "Test",
            "incident_date": "2026-01-27"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        # Get updated stats
        updated_stats = authenticated_client.get(f"{BASE_URL}/api/discipline/stats/summary").json()
        updated_open = updated_stats["by_status"]["open"]
        
        assert updated_open == initial_open + 1, "Open count should increase by 1"


# ══════════════════════════════════════════════════════════════════════════════
# ENRICHMENT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestDisciplineEnrichment:
    """Test that reports are enriched with names and labels"""
    
    def test_report_has_student_name(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """Reports should include student_name"""
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Enrichment test",
            "description": "Test",
            "incident_date": "2026-01-28"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        assert "student_name" in report
        assert report["student_name"] != "Desconocido"
    
    def test_report_has_priority_label(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """Reports should include priority_label and priority_color"""
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Priority label",
            "description": "Test",
            "priority": "high",
            "incident_date": "2026-01-29"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        assert "priority_label" in report
        assert report["priority_label"] == "Alta"
        assert "priority_color" in report
        assert report["priority_color"] == "#F97316"
    
    def test_report_has_status_label(self, authenticated_client, test_student, test_grade_section, cleanup_test_reports):
        """Reports should include status_label and status_color"""
        report_data = {
            "student_id": test_student["id"],
            "grade_id": test_grade_section["grade"]["id"],
            "section_id": test_grade_section["section"]["id"],
            "title": "TEST_Status label",
            "description": "Test",
            "incident_date": "2026-01-30"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/discipline", json=report_data)
        assert create_response.status_code == 200
        report = create_response.json()["report"]
        cleanup_test_reports.append(report["id"])
        
        assert "status_label" in report
        assert report["status_label"] == "Abierto"
        assert "status_color" in report
        assert report["status_color"] == "#3B82F6"
