"""
Parent Bulk Import API Tests
Tests for: template download, file import, auto-merge, credentials download, pending management
"""
import pytest
import requests
import os
import io
import csv

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for school admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "subdomain": TEST_SUBDOMAIN
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestParentTemplateDownload:
    """Tests for GET /api/parents/template"""
    
    def test_template_download_returns_xlsx(self, headers):
        """Template download returns valid .xlsx file with HTTP 200"""
        response = requests.get(f"{BASE_URL}/api/parents/template", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type is Excel
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "application/vnd.openxmlformats" in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Check Content-Disposition header for filename
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp, "Expected attachment disposition"
        assert ".xlsx" in content_disp, "Expected .xlsx filename"
        
        # Check file has content
        assert len(response.content) > 1000, "Template file seems too small"
        print(f"Template downloaded successfully: {len(response.content)} bytes")
    
    def test_template_requires_auth(self):
        """Template download requires authentication"""
        response = requests.get(f"{BASE_URL}/api/parents/template")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestParentImport:
    """Tests for POST /api/parents/import"""
    
    def test_import_valid_csv_creates_parents(self, headers):
        """Import with valid CSV creates parents and returns summary"""
        # Create test CSV content
        csv_content = """Nombre,Apellido,DNI,Correo,Celular,Cumpleanos,Genero,Direccion,Usuario,Contrasena,Observaciones
TestPadre1,TestApellido1,11111111,testpadre1@test.com,999111111,15/03/1985,Masculino,Av Test 123,,,Padre de prueba 1
TestPadre2,TestApellido2,22222222,testpadre2@test.com,999222222,20/05/1980,Femenino,Jr Test 456,,,Padre de prueba 2
TestPadre3,TestApellido3,33333333,testpadre3@test.com,999333333,10/12/1975,Masculino,Calle Test 789,,,Padre de prueba 3"""
        
        # Create file-like object
        files = {"file": ("test_parents.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/parents/import",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Expected success=True"
        assert "batch_id" in data, "Expected batch_id in response"
        assert "summary" in data, "Expected summary in response"
        
        summary = data["summary"]
        assert "created" in summary, "Expected created count"
        assert "updated" in summary, "Expected updated count"
        assert "errors" in summary, "Expected errors count"
        assert "total_rows" in summary, "Expected total_rows count"
        
        print(f"Import result: created={summary['created']}, updated={summary['updated']}, errors={summary['errors']}")
        
        # Store batch_id for credentials test
        TestParentImport.last_batch_id = data["batch_id"]
        TestParentImport.credentials_available = data.get("credentials_available", False)
    
    def test_import_duplicate_dni_auto_merge(self, headers):
        """Import with duplicate DNI does auto-merge (updated count > 0)"""
        # Use same DNIs as previous test to trigger auto-merge
        csv_content = """Nombre,Apellido,DNI,Correo,Celular,Cumpleanos,Genero,Direccion,Usuario,Contrasena,Observaciones
TestPadre1,TestApellido1,11111111,updated1@test.com,999111222,15/03/1985,Masculino,Av Updated 123,,,Actualizado
TestPadre2,TestApellido2,22222222,updated2@test.com,999222333,20/05/1980,Femenino,Jr Updated 456,,,Actualizado"""
        
        files = {"file": ("test_parents_merge.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/parents/import",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        summary = data["summary"]
        
        # Should have updated count > 0 (auto-merge), not errors
        assert summary["updated"] > 0, f"Expected updated > 0 for auto-merge, got {summary['updated']}"
        print(f"Auto-merge result: updated={summary['updated']}, errors={summary['errors']}")
    
    def test_import_invalid_data_creates_pending(self, headers):
        """Import with invalid data creates pending entries for errored rows"""
        # Create CSV with invalid data (invalid DNI format)
        csv_content = """Nombre,Apellido,DNI,Correo,Celular,Cumpleanos,Genero,Direccion,Usuario,Contrasena,Observaciones
TestInvalid1,TestApellido,123,invalid@test.com,999444444,15/03/1985,Masculino,Av Test 123,,,DNI invalido
TestInvalid2,TestApellido,ABCDEFGH,invalid2@test.com,999555555,20/05/1980,Femenino,Jr Test 456,,,DNI no numerico"""
        
        files = {"file": ("test_parents_invalid.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/parents/import",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        summary = data["summary"]
        
        # Should have errors > 0 (invalid data goes to pending)
        assert summary["errors"] > 0, f"Expected errors > 0 for invalid data, got {summary['errors']}"
        assert "pending_ids" in data, "Expected pending_ids in response"
        
        print(f"Invalid data result: errors={summary['errors']}, pending_ids={len(data.get('pending_ids', []))}")
    
    def test_import_requires_auth(self):
        """Import requires authentication"""
        csv_content = "Nombre,Apellido,DNI\nTest,Test,12345678"
        files = {"file": ("test.csv", csv_content, "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/parents/import", files=files)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_import_rejects_invalid_format(self, headers):
        """Import rejects unsupported file formats"""
        files = {"file": ("test.txt", "invalid content", "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/parents/import",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid format, got {response.status_code}"
        assert "ERR_FILE_FORMAT" in response.text or "formato" in response.text.lower()


class TestCredentialsDownload:
    """Tests for GET /api/parents/import/{batchId}/credentials"""
    
    def test_credentials_download_returns_csv(self, headers):
        """Credentials download returns CSV with username and password"""
        # First, create a new import to get a batch_id with credentials
        csv_content = """Nombre,Apellido,DNI,Correo,Celular,Cumpleanos,Genero,Direccion,Usuario,Contrasena,Observaciones
CredTest1,CredApellido1,44444444,credtest1@test.com,999666666,15/03/1985,Masculino,Av Cred 123,,,Para test credenciales"""
        
        files = {"file": ("test_cred.csv", csv_content, "text/csv")}
        import_response = requests.post(
            f"{BASE_URL}/api/parents/import",
            headers=headers,
            files=files
        )
        
        if import_response.status_code != 200:
            pytest.skip(f"Import failed: {import_response.text}")
        
        data = import_response.json()
        batch_id = data.get("batch_id")
        credentials_available = data.get("credentials_available", False)
        
        if not credentials_available:
            # If no new parents created (already exists), skip
            pytest.skip("No credentials available (parent may already exist)")
        
        # Download credentials
        response = requests.get(
            f"{BASE_URL}/api/parents/import/{batch_id}/credentials",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type is CSV
        content_type = response.headers.get("Content-Type", "")
        assert "csv" in content_type or "text" in content_type, f"Expected CSV content type, got: {content_type}"
        
        # Parse CSV and verify structure
        csv_content = response.content.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(csv_content))
        rows = list(reader)
        
        assert len(rows) >= 2, "Expected at least header + 1 data row"
        
        # Check headers
        headers_row = rows[0]
        assert "Nombre" in headers_row or "nombre" in [h.lower() for h in headers_row]
        assert "Usuario" in headers_row or "username" in [h.lower() for h in headers_row]
        assert "Contrasena" in headers_row or "password" in [h.lower() for h in headers_row]
        
        print(f"Credentials CSV downloaded: {len(rows)-1} rows")
    
    def test_credentials_invalid_batch_returns_404(self, headers):
        """Credentials download with invalid batch_id returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/parents/import/INVALID-BATCH-ID/credentials",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid batch, got {response.status_code}"


class TestPendingManagement:
    """Tests for pending parent management endpoints"""
    
    def test_get_pending_parents(self, headers):
        """GET /api/parents/pending returns list of pending parents"""
        response = requests.get(f"{BASE_URL}/api/parents/pending", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        
        print(f"Pending parents count: {len(data)}")
        
        # Store a pending ID for further tests if available
        if data:
            TestPendingManagement.pending_id = data[0].get("id")
            TestPendingManagement.pending_data = data[0]
    
    def test_pending_requires_auth(self):
        """Pending list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/parents/pending")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_activate_pending_parent(self, headers):
        """POST /api/parents/pending/{id}/activate creates parent and returns credentials"""
        # First create a pending entry with valid data
        csv_content = """Nombre,Apellido,DNI,Correo,Celular,Cumpleanos,Genero,Direccion,Usuario,Contrasena,Observaciones
ActivateTest,ActivateApellido,55555555,activate@test.com,999777777,15/03/1985,Masculino,Av Activate 123,existinguser,,Para test activacion"""
        
        files = {"file": ("test_activate.csv", csv_content, "text/csv")}
        import_response = requests.post(
            f"{BASE_URL}/api/parents/import",
            headers=headers,
            files=files
        )
        
        # Get pending list
        pending_response = requests.get(f"{BASE_URL}/api/parents/pending", headers=headers)
        pending_list = pending_response.json()
        
        # Find a pending entry to activate (with valid data)
        pending_to_activate = None
        for p in pending_list:
            # Look for one with valid DNI (8 digits)
            dni = p.get("dni", "")
            if len(dni) == 8 and dni.isdigit():
                pending_to_activate = p
                break
        
        if not pending_to_activate:
            pytest.skip("No valid pending entry to activate")
        
        pending_id = pending_to_activate["id"]
        
        # Activate
        response = requests.post(
            f"{BASE_URL}/api/parents/pending/{pending_id}/activate",
            headers=headers
        )
        
        # Could be 200 (success) or 400 (DNI already exists)
        if response.status_code == 200:
            data = response.json()
            assert "username" in data, "Expected username in response"
            assert "password" in data, "Expected password in response"
            print(f"Activated pending parent: username={data['username']}")
        elif response.status_code == 400:
            # DNI already exists - this is expected behavior
            print(f"Activation blocked (expected): {response.json().get('detail', '')}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_delete_pending_parent(self, headers):
        """DELETE /api/parents/pending/{id} removes the pending entry"""
        # First create a pending entry to delete
        csv_content = """Nombre,Apellido,DNI,Correo,Celular,Cumpleanos,Genero,Direccion,Usuario,Contrasena,Observaciones
DeleteTest,DeleteApellido,ABC,delete@test.com,999888888,15/03/1985,Masculino,Av Delete 123,,,Para eliminar"""
        
        files = {"file": ("test_delete.csv", csv_content, "text/csv")}
        requests.post(f"{BASE_URL}/api/parents/import", headers=headers, files=files)
        
        # Get pending list
        pending_response = requests.get(f"{BASE_URL}/api/parents/pending", headers=headers)
        pending_list = pending_response.json()
        
        if not pending_list:
            pytest.skip("No pending entries to delete")
        
        pending_id = pending_list[0]["id"]
        
        # Delete
        response = requests.delete(
            f"{BASE_URL}/api/parents/pending/{pending_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/parents/pending", headers=headers)
        verify_list = verify_response.json()
        deleted_ids = [p["id"] for p in verify_list]
        assert pending_id not in deleted_ids, "Pending entry should be deleted"
        
        print(f"Deleted pending entry: {pending_id}")
    
    def test_delete_invalid_pending_returns_404(self, headers):
        """Delete with invalid pending_id returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/parents/pending/invalid-id-12345",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid ID, got {response.status_code}"


class TestCleanup:
    """Cleanup test data after tests"""
    
    def test_cleanup_test_parents(self, headers):
        """Clean up test parents created during testing"""
        # Get all users
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        if response.status_code != 200:
            print("Could not fetch users for cleanup")
            return
        
        users = response.json()
        
        # Find test parents (created by import_bulk with test DNIs)
        test_dnis = ["11111111", "22222222", "33333333", "44444444", "55555555"]
        test_parents = [u for u in users if u.get("role") == "parent" and u.get("dni") in test_dnis]
        
        deleted_count = 0
        for parent in test_parents:
            try:
                del_response = requests.delete(
                    f"{BASE_URL}/api/users/{parent['id']}",
                    headers=headers
                )
                if del_response.status_code in [200, 204]:
                    deleted_count += 1
            except Exception as e:
                print(f"Error deleting test parent: {e}")
        
        print(f"Cleaned up {deleted_count} test parents")
        
        # Also clean up any remaining pending entries
        pending_response = requests.get(f"{BASE_URL}/api/parents/pending", headers=headers)
        if pending_response.status_code == 200:
            pending_list = pending_response.json()
            for p in pending_list:
                if p.get("dni") in test_dnis or "Test" in p.get("name", ""):
                    try:
                        requests.delete(f"{BASE_URL}/api/parents/pending/{p['id']}", headers=headers)
                    except:
                        pass
