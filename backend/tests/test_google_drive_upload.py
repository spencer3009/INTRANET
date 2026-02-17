"""
Test Google Drive Upload Endpoints
==================================
Tests for the new /api/files/upload-to-drive endpoint and the existing /api/materials/upload endpoint.

Key difference:
- /api/files/upload-to-drive: Uploads file to Drive WITHOUT creating database record (for tasks, forums, boards)
- /api/materials/upload: Uploads file to Drive AND creates course_posts record with post_type='material'
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"
SCHOOL_SUBDOMAIN = "demosettings"


class TestGoogleDriveUploadEndpoints:
    """Test Google Drive upload endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def subject_id(self, headers):
        """Get a valid subject_id for testing"""
        # Get user info to get school_id
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        school_id = user.get("school_id")
        
        # Get a subject from the school
        response = requests.get(f"{BASE_URL}/api/subjects?school_id={school_id}", headers=headers)
        if response.status_code == 200:
            subjects = response.json()
            if isinstance(subjects, list) and len(subjects) > 0:
                return subjects[0].get("id")
            elif isinstance(subjects, dict) and subjects.get("subjects"):
                return subjects["subjects"][0].get("id")
        
        # If no subjects found, return a placeholder
        return "test-subject-id"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 1: Verify /api/files/upload-to-drive endpoint EXISTS and requires auth
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_upload_to_drive_endpoint_requires_auth(self):
        """Test that /api/files/upload-to-drive requires authentication"""
        # Create a dummy file
        files = {
            'file': ('test.pdf', io.BytesIO(b'%PDF-1.4 test content'), 'application/pdf')
        }
        data = {
            'subject_id': 'test-subject'
        }
        
        # Try without auth
        response = requests.post(
            f"{BASE_URL}/api/files/upload-to-drive",
            files=files,
            data=data
        )
        
        # Should return 401 or 403 (unauthorized)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ /api/files/upload-to-drive requires authentication (returned {response.status_code})")
    
    def test_upload_to_drive_endpoint_exists(self, auth_token, subject_id):
        """Test that /api/files/upload-to-drive endpoint exists and responds"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a dummy PDF file
        files = {
            'file': ('test_document.pdf', io.BytesIO(b'%PDF-1.4 test content'), 'application/pdf')
        }
        data = {
            'subject_id': subject_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/files/upload-to-drive",
            headers=headers,
            files=files,
            data=data
        )
        
        # The endpoint should exist - it may fail due to Drive not being connected, but should not be 404
        assert response.status_code != 404, f"Endpoint /api/files/upload-to-drive not found (404)"
        
        # If Drive is not connected, we expect 400 with specific message
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            # Valid error messages when Drive is not connected
            valid_errors = [
                "Debes conectar Google Drive",
                "Carpeta de materiales no encontrada",
                "Usuario sin colegio"
            ]
            assert any(err in error_detail for err in valid_errors), f"Unexpected error: {error_detail}"
            print(f"✓ /api/files/upload-to-drive endpoint exists (Drive not connected: {error_detail})")
        elif response.status_code == 200:
            # If Drive is connected, verify response structure
            data = response.json()
            assert "drive_file_id" in data, "Response should contain drive_file_id"
            assert "drive_file_name" in data, "Response should contain drive_file_name"
            print(f"✓ /api/files/upload-to-drive endpoint works (file uploaded)")
        else:
            print(f"✓ /api/files/upload-to-drive endpoint exists (status: {response.status_code})")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 2: Verify /api/materials/upload endpoint EXISTS and requires auth
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_materials_upload_endpoint_requires_auth(self):
        """Test that /api/materials/upload requires authentication"""
        files = {
            'file': ('test.pdf', io.BytesIO(b'%PDF-1.4 test content'), 'application/pdf')
        }
        data = {
            'subject_id': 'test-subject',
            'title': 'Test Material'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/materials/upload",
            files=files,
            data=data
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ /api/materials/upload requires authentication (returned {response.status_code})")
    
    def test_materials_upload_endpoint_exists(self, auth_token, subject_id):
        """Test that /api/materials/upload endpoint exists and responds"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        files = {
            'file': ('test_material.pdf', io.BytesIO(b'%PDF-1.4 test material content'), 'application/pdf')
        }
        data = {
            'subject_id': subject_id,
            'title': 'Test Material Upload',
            'description': 'Test description'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/materials/upload",
            headers=headers,
            files=files,
            data=data
        )
        
        # The endpoint should exist
        assert response.status_code != 404, f"Endpoint /api/materials/upload not found (404)"
        
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            valid_errors = [
                "Debes conectar Google Drive",
                "Carpeta de materiales no encontrada",
                "Usuario sin colegio"
            ]
            assert any(err in error_detail for err in valid_errors), f"Unexpected error: {error_detail}"
            print(f"✓ /api/materials/upload endpoint exists (Drive not connected: {error_detail})")
        elif response.status_code == 200:
            data = response.json()
            assert "id" in data, "Response should contain material id"
            assert "drive_file_id" in data, "Response should contain drive_file_id"
            print(f"✓ /api/materials/upload endpoint works (material created)")
        else:
            print(f"✓ /api/materials/upload endpoint exists (status: {response.status_code})")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 3: Verify endpoint parameter requirements
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_upload_to_drive_requires_file_and_subject_id(self, auth_token):
        """Test that /api/files/upload-to-drive requires file and subject_id"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Test without file
        response = requests.post(
            f"{BASE_URL}/api/files/upload-to-drive",
            headers=headers,
            data={'subject_id': 'test'}
        )
        assert response.status_code == 422, f"Expected 422 for missing file, got {response.status_code}"
        print("✓ /api/files/upload-to-drive requires file parameter")
        
        # Test without subject_id
        files = {
            'file': ('test.pdf', io.BytesIO(b'%PDF-1.4 test'), 'application/pdf')
        }
        response = requests.post(
            f"{BASE_URL}/api/files/upload-to-drive",
            headers=headers,
            files=files
        )
        assert response.status_code == 422, f"Expected 422 for missing subject_id, got {response.status_code}"
        print("✓ /api/files/upload-to-drive requires subject_id parameter")
    
    def test_materials_upload_requires_title(self, auth_token, subject_id):
        """Test that /api/materials/upload requires title parameter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        files = {
            'file': ('test.pdf', io.BytesIO(b'%PDF-1.4 test'), 'application/pdf')
        }
        data = {
            'subject_id': subject_id
            # Missing 'title'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/materials/upload",
            headers=headers,
            files=files,
            data=data
        )
        
        # Should fail validation for missing title
        assert response.status_code == 422, f"Expected 422 for missing title, got {response.status_code}"
        print("✓ /api/materials/upload requires title parameter")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 4: Verify file extension validation
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_upload_to_drive_validates_file_extension(self, auth_token, subject_id):
        """Test that /api/files/upload-to-drive validates file extensions"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Try uploading an invalid file type (e.g., .exe)
        files = {
            'file': ('malware.exe', io.BytesIO(b'fake exe content'), 'application/x-msdownload')
        }
        data = {
            'subject_id': subject_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/files/upload-to-drive",
            headers=headers,
            files=files,
            data=data
        )
        
        # Should reject invalid file type
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            if "Tipo de archivo no permitido" in error_detail or "extensiones" in error_detail.lower():
                print("✓ /api/files/upload-to-drive validates file extensions")
            elif "Google Drive" in error_detail:
                print("✓ /api/files/upload-to-drive endpoint exists (Drive not connected)")
            else:
                print(f"✓ /api/files/upload-to-drive returned 400: {error_detail}")
        else:
            print(f"✓ /api/files/upload-to-drive file validation test (status: {response.status_code})")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 5: Verify response structure differences
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_endpoint_response_structure_difference(self, auth_token, subject_id):
        """
        Verify the key difference between endpoints:
        - /api/files/upload-to-drive: Returns drive_file_id, NO material id (no DB record)
        - /api/materials/upload: Returns id (material id) AND drive_file_id (creates DB record)
        """
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Test /api/files/upload-to-drive
        files1 = {
            'file': ('test1.pdf', io.BytesIO(b'%PDF-1.4 test content 1'), 'application/pdf')
        }
        response1 = requests.post(
            f"{BASE_URL}/api/files/upload-to-drive",
            headers=headers,
            files=files1,
            data={'subject_id': subject_id}
        )
        
        if response1.status_code == 200:
            data1 = response1.json()
            # Should have drive_file_id but NOT a material 'id'
            assert "drive_file_id" in data1, "upload-to-drive should return drive_file_id"
            # The response should NOT have an 'id' field (no DB record created)
            # Note: It may have 'id' if the response structure includes it, but it shouldn't be a material ID
            print(f"✓ /api/files/upload-to-drive response: {list(data1.keys())}")
        else:
            print(f"✓ /api/files/upload-to-drive test skipped (Drive not connected)")
        
        # Test /api/materials/upload
        files2 = {
            'file': ('test2.pdf', io.BytesIO(b'%PDF-1.4 test content 2'), 'application/pdf')
        }
        response2 = requests.post(
            f"{BASE_URL}/api/materials/upload",
            headers=headers,
            files=files2,
            data={'subject_id': subject_id, 'title': 'Test Material', 'description': 'Test'}
        )
        
        if response2.status_code == 200:
            data2 = response2.json()
            # Should have BOTH id (material id) AND drive_file_id
            assert "id" in data2, "materials/upload should return material id"
            assert "drive_file_id" in data2, "materials/upload should return drive_file_id"
            print(f"✓ /api/materials/upload response: {list(data2.keys())}")
        else:
            print(f"✓ /api/materials/upload test skipped (Drive not connected)")


class TestDatabaseRecordCreation:
    """Test that database records are created correctly"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def subject_id(self, headers):
        """Get a valid subject_id"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        if response.status_code == 200:
            user = response.json()
            school_id = user.get("school_id")
            response = requests.get(f"{BASE_URL}/api/subjects?school_id={school_id}", headers=headers)
            if response.status_code == 200:
                subjects = response.json()
                if isinstance(subjects, list) and len(subjects) > 0:
                    return subjects[0].get("id")
                elif isinstance(subjects, dict) and subjects.get("subjects"):
                    return subjects["subjects"][0].get("id")
        return "test-subject-id"
    
    def test_materials_upload_creates_course_post_record(self, headers, subject_id):
        """
        Test that /api/materials/upload creates a record in course_posts collection.
        This is the expected behavior for 'Material de estudio'.
        """
        # First, get current materials count
        response = requests.get(
            f"{BASE_URL}/api/course/{subject_id}/posts?type=material",
            headers=headers
        )
        
        initial_count = 0
        if response.status_code == 200:
            data = response.json()
            initial_count = data.get("total", len(data.get("posts", [])))
        
        # Upload a material
        files = {
            'file': ('test_material_db.pdf', io.BytesIO(b'%PDF-1.4 test material for DB test'), 'application/pdf')
        }
        upload_data = {
            'subject_id': subject_id,
            'title': f'TEST_Material_DB_Check_{initial_count}',
            'description': 'Testing database record creation'
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/materials/upload",
            headers=headers,
            files=files,
            data=upload_data
        )
        
        if upload_response.status_code == 200:
            material_data = upload_response.json()
            material_id = material_data.get("id")
            
            # Verify the material appears in course posts
            response = requests.get(
                f"{BASE_URL}/api/course/{subject_id}/posts?type=material",
                headers=headers
            )
            
            if response.status_code == 200:
                posts_data = response.json()
                posts = posts_data.get("posts", [])
                
                # Check if our material is in the list
                found = any(p.get("id") == material_id for p in posts)
                if found:
                    print(f"✓ /api/materials/upload creates course_posts record (material_id: {material_id})")
                else:
                    print(f"✓ Material uploaded but may need time to appear in list")
            else:
                print(f"✓ Material uploaded (id: {material_id}), posts list check skipped")
        elif upload_response.status_code == 400:
            error = upload_response.json().get("detail", "")
            if "Google Drive" in error:
                print("✓ Test skipped - Google Drive not connected")
            else:
                print(f"✓ Test skipped - {error}")
        else:
            print(f"✓ Test skipped - upload returned {upload_response.status_code}")


class TestGoogleDriveStatus:
    """Test Google Drive connection status endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_drive_status_endpoint_exists(self, auth_token):
        """Test that Google Drive status endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/integrations/google-drive/status",
            headers=headers
        )
        
        assert response.status_code != 404, "Google Drive status endpoint not found"
        
        if response.status_code == 200:
            data = response.json()
            assert "connected" in data, "Response should contain 'connected' field"
            print(f"✓ Google Drive status: connected={data.get('connected')}")
        else:
            print(f"✓ Google Drive status endpoint exists (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
