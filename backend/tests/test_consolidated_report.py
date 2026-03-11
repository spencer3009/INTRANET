"""
Test Consolidated Grade Report (Consolidado de Notas) Module
Tests the consolidated view that replicates the Excel format with:
- Institutional header, academic context
- Subject columns, student rows with grades
- Summary columns (CONDUCTA, PROMEDIO, PUNTAJE, N° DESAPROBADOS, etc.)
- Footer summary stats
- Excel export functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

# Test section and period IDs for INICIAL > 3 años > A > BIMESTRE I
TEST_SECTION_ID = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
TEST_PERIOD_ID = "093a0bee-92c4-449c-b82c-942f16847759"

class TestConsolidatedReportEndpoints:
    """Tests for Consolidated Grade Report API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test client and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Authenticate
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@elroble.edu",
            "password": "1234abc8",
            "subdomain": "elroble"
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # --- Authentication Tests ---
    def test_consolidated_report_requires_authentication(self):
        """Test that consolidated report endpoint requires auth"""
        # Make request without auth header
        no_auth_session = requests.Session()
        response = no_auth_session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Consolidated report requires authentication")
    
    # --- GET Consolidated Report Tests ---
    def test_get_consolidated_report_returns_200(self):
        """Test that consolidated report endpoint returns 200 for valid section/period"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET consolidated report returns 200")
    
    def test_consolidated_report_has_institutional_header(self):
        """Test that response includes school name, system name, title"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        # Check school name
        assert "school_name" in data, "Missing school_name"
        assert data["school_name"] == "Colegio El Roble", f"Unexpected school name: {data['school_name']}"
        
        # Check system name
        assert "system_name" in data, "Missing system_name"
        assert data["system_name"] == "CUBICOL Intranet", f"Unexpected system name: {data['system_name']}"
        
        # Check title includes year
        assert "title" in data, "Missing title"
        assert "CONSOLIDADO DE NOTAS" in data["title"], f"Title should contain 'CONSOLIDADO DE NOTAS': {data['title']}"
        assert "2026" in data["title"], f"Title should contain year 2026: {data['title']}"
        
        print("PASS: Institutional header (school_name, system_name, title) present")
    
    def test_consolidated_report_has_academic_context(self):
        """Test that response includes section_display, period_name, tutor_name"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        # Check section display (Salon)
        assert "section_display" in data, "Missing section_display"
        assert "3 años" in data["section_display"], f"section_display should contain '3 años': {data['section_display']}"
        assert "INICIAL" in data["section_display"], f"section_display should contain 'INICIAL': {data['section_display']}"
        
        # Check period name
        assert "period_name" in data, "Missing period_name"
        assert data["period_name"] == "BIMESTRE I", f"Unexpected period name: {data['period_name']}"
        
        # Check tutor_name exists (may be empty)
        assert "tutor_name" in data, "Missing tutor_name field"
        
        print("PASS: Academic context (section_display, period_name, tutor_name) present")
    
    def test_consolidated_report_has_subject_columns(self):
        """Test that response includes columns array with subject info"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        assert "columns" in data, "Missing columns array"
        assert isinstance(data["columns"], list), "columns should be a list"
        assert len(data["columns"]) > 0, "Should have at least one column"
        
        # Check column structure
        for col in data["columns"]:
            assert "id" in col, "Column missing id"
            assert "name" in col, "Column missing name"
            assert "type" in col, "Column missing type"
        
        # Check for expected subjects
        subject_names = [col["name"] for col in data["columns"]]
        assert "Ciencias Naturales" in subject_names, f"Missing Ciencias Naturales in columns: {subject_names}"
        assert "Historia" in subject_names, f"Missing Historia in columns: {subject_names}"
        
        print(f"PASS: Subject columns present ({len(data['columns'])} columns)")
    
    def test_consolidated_report_has_student_rows(self):
        """Test that response includes students array with proper structure"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        assert "students" in data, "Missing students array"
        assert isinstance(data["students"], list), "students should be a list"
        assert len(data["students"]) > 0, "Should have at least one student"
        
        # Check student structure
        student = data["students"][0]
        assert "number" in student, "Student missing number"
        assert "student_id" in student, "Student missing student_id"
        assert "student_name" in student, "Student missing student_name"
        assert "grades" in student, "Student missing grades dict"
        
        print(f"PASS: Student rows present ({len(data['students'])} students)")
    
    def test_consolidated_report_has_summary_columns(self):
        """Test that students have summary fields (promedio, puntaje, orden_merito, etc.)"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        student = data["students"][0]
        
        # Check all summary columns exist
        summary_fields = [
            "conducta", "promedio", "puntaje", "n_desaprobados",
            "orden_merito", "tercio", "tardanza_injustificada",
            "tardanza_justificada", "falta_injustificada", "falta_justificada"
        ]
        
        for field in summary_fields:
            assert field in student, f"Student missing summary field: {field}"
        
        print("PASS: All summary columns present in student records")
    
    def test_student_grade_data_correct(self):
        """Test that Diaz Flores Roberto has correct grades (Ciencias Naturales=14, Historia=16)"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        # Find Diaz Flores Roberto
        diaz = None
        for student in data["students"]:
            if "Diaz Flores Roberto" in student["student_name"]:
                diaz = student
                break
        
        assert diaz is not None, "Diaz Flores Roberto not found in students"
        
        # Find Ciencias Naturales and Historia column IDs
        ciencias_id = None
        historia_id = None
        for col in data["columns"]:
            if col["name"] == "Ciencias Naturales":
                ciencias_id = col["id"]
            if col["name"] == "Historia":
                historia_id = col["id"]
        
        # Check grades
        assert ciencias_id is not None, "Ciencias Naturales column not found"
        assert historia_id is not None, "Historia column not found"
        assert diaz["grades"].get(ciencias_id) == 14, f"Expected Ciencias Naturales=14, got {diaz['grades'].get(ciencias_id)}"
        assert diaz["grades"].get(historia_id) == 16, f"Expected Historia=16, got {diaz['grades'].get(historia_id)}"
        
        print("PASS: Diaz Flores Roberto has correct grades (Ciencias=14, Historia=16)")
    
    def test_calculations_correct_for_student_with_grades(self):
        """Test that PROMEDIO, PUNTAJE, ORDEN DE MÉRITO calculated correctly"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        # Find Diaz Flores Roberto (has grades)
        diaz = None
        for student in data["students"]:
            if "Diaz Flores Roberto" in student["student_name"]:
                diaz = student
                break
        
        assert diaz is not None, "Diaz Flores Roberto not found"
        
        # Check promedio calculation (14 + 16) / 2 = 15
        assert diaz["promedio"] == 15, f"Expected promedio=15, got {diaz['promedio']}"
        
        # Check puntaje (sum = 30)
        assert diaz["puntaje"] == 30, f"Expected puntaje=30, got {diaz['puntaje']}"
        
        # Check n_desaprobados (both grades >= 11)
        assert diaz["n_desaprobados"] == 0, f"Expected n_desaprobados=0, got {diaz['n_desaprobados']}"
        
        # Check orden_merito (should be ranked)
        assert diaz["orden_merito"] is not None, "orden_merito should be set for students with grades"
        
        print("PASS: Calculations correct (promedio=15, puntaje=30, n_desaprobados=0)")
    
    def test_consolidated_report_has_summary_stats(self):
        """Test that response includes summary_stats for footer rows"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        assert "summary_stats" in data, "Missing summary_stats"
        assert isinstance(data["summary_stats"], dict), "summary_stats should be a dict"
        
        # Check that we have stats for at least one column
        stats_keys = list(data["summary_stats"].keys())
        assert len(stats_keys) > 0, "summary_stats should have at least one column"
        
        # Check structure of stats
        first_stat = data["summary_stats"][stats_keys[0]]
        expected_keys = ["promedio", "aprobados", "desaprobados", "pct_aprobados", "pct_desaprobados", "nota_maxima", "nota_minima"]
        for key in expected_keys:
            assert key in first_stat, f"Summary stats missing {key}"
        
        print("PASS: Summary stats present with proper structure")
    
    def test_summary_stats_values_correct(self):
        """Test that footer summary stats are calculated correctly for Ciencias Naturales"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        # Find Ciencias Naturales column
        ciencias_id = None
        for col in data["columns"]:
            if col["name"] == "Ciencias Naturales":
                ciencias_id = col["id"]
                break
        
        assert ciencias_id is not None, "Ciencias Naturales not found"
        stats = data["summary_stats"].get(ciencias_id, {})
        
        # Based on known data: 2 students with grades (14, 11)
        # promedio = 12.5, aprobados = 2, desaprobados = 0
        assert stats["promedio"] == 12.5, f"Expected promedio=12.5, got {stats['promedio']}"
        assert stats["aprobados"] == 2, f"Expected aprobados=2, got {stats['aprobados']}"
        assert stats["desaprobados"] == 0, f"Expected desaprobados=0, got {stats['desaprobados']}"
        assert stats["nota_maxima"] == 14, f"Expected nota_maxima=14, got {stats['nota_maxima']}"
        assert stats["nota_minima"] == 11, f"Expected nota_minima=11, got {stats['nota_minima']}"
        
        print("PASS: Summary stats values correct for Ciencias Naturales")
    
    # --- Excel Export Tests ---
    def test_excel_export_returns_xlsx_file(self):
        """Test that Excel export returns valid xlsx content-type"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}/export/excel"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get("content-type", "")
        assert "spreadsheetml" in content_type or "vnd.openxmlformats" in content_type, \
            f"Expected xlsx content type, got {content_type}"
        
        # Check content-disposition header
        content_disposition = response.headers.get("content-disposition", "")
        assert "attachment" in content_disposition.lower(), "Should have attachment disposition"
        assert ".xlsx" in content_disposition, "Filename should be .xlsx"
        
        # Check response has content
        assert len(response.content) > 0, "Excel file should have content"
        
        print(f"PASS: Excel export returns xlsx file ({len(response.content)} bytes)")
    
    def test_excel_export_requires_authentication(self):
        """Test that Excel export requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}/export/excel"
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Excel export requires authentication")
    
    # --- Error Handling Tests ---
    def test_invalid_section_returns_404(self):
        """Test that invalid section ID returns 404"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/invalid-section-id/{TEST_PERIOD_ID}"
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid section returns 404")
    
    def test_total_students_field(self):
        """Test that total_students field is present and correct"""
        response = self.session.get(
            f"{BASE_URL}/api/grades/consolidated-report/{TEST_SECTION_ID}/{TEST_PERIOD_ID}"
        )
        data = response.json()
        
        assert "total_students" in data, "Missing total_students field"
        assert data["total_students"] == len(data["students"]), \
            f"total_students ({data['total_students']}) should match students array length ({len(data['students'])})"
        
        print(f"PASS: total_students field correct ({data['total_students']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
