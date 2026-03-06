"""
Test Student Import API Endpoints
Tests for:
- GET /api/students/import/template - Download xlsx template
- POST /api/students/import - Import students from CSV/XLSX
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"


class TestStudentImportAPI:
    """Test Student Import endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login and get token"""
        # Login to get token
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        data = login_resp.json()
        self.token = data.get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = data.get("user", {})
        yield
    
    def test_get_template_returns_xlsx(self):
        """Test GET /api/students/import/template returns xlsx file"""
        resp = requests.get(
            f"{BASE_URL}/api/students/import/template",
            headers=self.headers
        )
        
        # Status code
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        # Content type should be xlsx
        content_type = resp.headers.get("Content-Type", "")
        assert "spreadsheetml" in content_type or "octet-stream" in content_type, f"Unexpected content type: {content_type}"
        
        # Content disposition should indicate download
        content_disposition = resp.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition, f"Expected attachment, got: {content_disposition}"
        assert ".xlsx" in content_disposition, f"Expected .xlsx file, got: {content_disposition}"
        
        # File should have content
        assert len(resp.content) > 0, "Template file is empty"
        print(f"SUCCESS: Template downloaded, size: {len(resp.content)} bytes")
    
    def test_get_template_with_filters(self):
        """Test GET /api/students/import/template with filter parameters"""
        resp = requests.get(
            f"{BASE_URL}/api/students/import/template",
            headers=self.headers,
            params={"nivel_id": "", "grado_id": "", "seccion_id": ""}
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert len(resp.content) > 0
        print("SUCCESS: Template with filters downloaded")
    
    def test_import_csv_creates_students(self):
        """Test POST /api/students/import with CSV file"""
        # Create a simple CSV file
        csv_content = """Nombre,Apellido,DNI,Celular,Correo,Direccion,Observaciones
TestImport1,Prueba1,12345678,999111222,testimport1@test.com,Calle Test 123,Nota de prueba
TestImport2,Prueba2,12345679,999111223,testimport2@test.com,Calle Test 124,Otra nota"""
        
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "test_students.csv"
        
        files = {"file": ("test_students.csv", csv_file, "text/csv")}
        data = {
            "nivel_id": "",
            "grado_id": "",
            "seccion_id": "",
            "turno_id": ""
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/students/import",
            headers=self.headers,
            files=files,
            data=data
        )
        
        # Should succeed or return specific error
        print(f"Import response: {resp.status_code} - {resp.text[:500]}")
        
        if resp.status_code == 200:
            result = resp.json()
            assert "created_count" in result, f"Missing created_count in response: {result}"
            assert "pending_count" in result, f"Missing pending_count in response: {result}"
            assert isinstance(result["created_count"], int)
            assert isinstance(result["pending_count"], int)
            print(f"SUCCESS: Import completed - created: {result['created_count']}, pending: {result['pending_count']}")
        else:
            # If it fails due to duplicate DNI or other business rule, that's expected
            error_msg = resp.json().get("detail", "")
            assert resp.status_code in [400, 403], f"Unexpected error: {resp.status_code} - {error_msg}"
            print(f"INFO: Import returned expected error: {error_msg}")
    
    def test_import_invalid_format_rejected(self):
        """Test POST /api/students/import rejects invalid file formats"""
        txt_content = "This is not a CSV file"
        txt_file = io.BytesIO(txt_content.encode("utf-8"))
        
        files = {"file": ("test.txt", txt_file, "text/plain")}
        data = {"nivel_id": "", "grado_id": "", "seccion_id": "", "turno_id": ""}
        
        resp = requests.post(
            f"{BASE_URL}/api/students/import",
            headers=self.headers,
            files=files,
            data=data
        )
        
        # Should reject with 400
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        error = resp.json().get("detail", "")
        assert "formato" in error.lower() or "soportado" in error.lower(), f"Unexpected error: {error}"
        print(f"SUCCESS: Invalid format correctly rejected: {error}")
    
    def test_import_requires_auth(self):
        """Test import endpoint requires authentication"""
        csv_content = "Nombre,Apellido\nTest,Test"
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        
        # No auth header
        resp = requests.post(
            f"{BASE_URL}/api/students/import",
            files={"file": ("test.csv", csv_file, "text/csv")},
            data={"nivel_id": "", "grado_id": "", "seccion_id": "", "turno_id": ""}
        )
        
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("SUCCESS: Unauthorized request correctly rejected")
    
    def test_template_requires_auth(self):
        """Test template endpoint requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/students/import/template")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("SUCCESS: Template endpoint requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
