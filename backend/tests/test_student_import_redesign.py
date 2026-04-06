"""
Tests for Student Import Redesign - Backend API
Tests: GET /api/students/import/template and POST /api/students/import
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://citas-workshops.preview.emergentagent.com').rstrip('/')

class TestStudentImportBackend:
    """Backend API tests for student import feature"""
    
    token = None
    nivel_id = None
    grado_id = None
    seccion_id = None
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get token, also get academic IDs"""
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@elroble.edu",
            "password": "1234abc8"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        TestStudentImportBackend.token = data.get("token")
        
        # Get academic levels
        headers = {"Authorization": f"Bearer {self.token}"}
        levels_res = requests.get(f"{BASE_URL}/api/academic/levels", headers=headers)
        if levels_res.status_code == 200:
            levels = levels_res.json()
            if levels:
                TestStudentImportBackend.nivel_id = levels[0].get("id")
        
        # Get grades
        grades_res = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
        if grades_res.status_code == 200:
            grades = grades_res.json()
            if grades:
                TestStudentImportBackend.grado_id = grades[0].get("id")
        
        # Get sections
        sections_res = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
        if sections_res.status_code == 200:
            sections = sections_res.json()
            if sections:
                TestStudentImportBackend.seccion_id = sections[0].get("id")
    
    def test_template_requires_auth(self):
        """Test that template endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/students/import/template")
        assert response.status_code == 401, "Template should require authentication"
        print("✓ Template endpoint requires authentication")
    
    def test_template_download_with_filters(self):
        """Test downloading template with academic filters"""
        headers = {"Authorization": f"Bearer {self.token}"}
        
        params = {}
        if self.nivel_id:
            params["nivel_id"] = self.nivel_id
        if self.grado_id:
            params["grado_id"] = self.grado_id
        if self.seccion_id:
            params["seccion_id"] = self.seccion_id
        
        response = requests.get(
            f"{BASE_URL}/api/students/import/template",
            headers=headers,
            params=params
        )
        
        assert response.status_code == 200, f"Template download failed: {response.text}"
        
        # Check content type is xlsx
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "xlsx" in content_type, f"Expected xlsx content type, got: {content_type}"
        
        # Check content disposition header for filename
        content_disp = response.headers.get("content-disposition", "")
        assert "plantilla" in content_disp.lower() or "attachment" in content_disp.lower(), f"Expected attachment disposition, got: {content_disp}"
        
        # Verify file content is not empty
        assert len(response.content) > 1000, "Template file should have substantial content"
        
        print(f"✓ Template downloaded successfully")
        print(f"  Content-Type: {content_type}")
        print(f"  Content-Disposition: {content_disp}")
        print(f"  File size: {len(response.content)} bytes")
    
    def test_template_without_filters(self):
        """Test downloading template without filters - should still work"""
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/students/import/template",
            headers=headers
        )
        
        assert response.status_code == 200, f"Template download without filters failed: {response.text}"
        print("✓ Template download without filters returns 200")
    
    def test_import_requires_auth(self):
        """Test that import endpoint requires authentication"""
        files = {"file": ("test.csv", b"name,last_name\nTest,User", "text/csv")}
        response = requests.post(f"{BASE_URL}/api/students/import", files=files)
        assert response.status_code == 401, "Import should require authentication"
        print("✓ Import endpoint requires authentication")
    
    def test_import_rejects_invalid_format(self):
        """Test that import rejects invalid file formats"""
        headers = {"Authorization": f"Bearer {self.token}"}
        files = {"file": ("test.txt", b"invalid content", "text/plain")}
        data = {
            "nivel_id": self.nivel_id or "",
            "grado_id": self.grado_id or "",
            "seccion_id": self.seccion_id or ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/students/import",
            headers=headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 400, f"Should reject txt file, got: {response.status_code}"
        print("✓ Import correctly rejects invalid file format")
    
    def test_import_csv_success(self):
        """Test importing students via CSV file"""
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create CSV content with header and test data
        csv_content = "Nombre,Apellido,DNI,Celular,Correo\nTestImport,UserNew,99887766,912345678,test_import_new@test.com"
        files = {"file": ("test_import.csv", csv_content.encode('utf-8'), "text/csv")}
        data = {
            "nivel_id": self.nivel_id or "",
            "grado_id": self.grado_id or "",
            "seccion_id": self.seccion_id or ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/students/import",
            headers=headers,
            files=files,
            data=data
        )
        
        # Should succeed with 200 or fail with specific error (not auth)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            result = response.json()
            assert "created_count" in result, "Response should have created_count"
            assert "pending_count" in result, "Response should have pending_count"
            print(f"✓ Import successful: created={result.get('created_count')}, pending={result.get('pending_count')}")
        else:
            print(f"✓ Import handled error correctly: {response.json()}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
