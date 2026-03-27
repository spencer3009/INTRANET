"""
Test Login Background Feature
- PUT /api/settings/login-background - upload image
- DELETE /api/settings/login-background - delete image
- GET /api/settings/login-background - get current background URL
- GET /api/schools/public/{subdomain} - should include login_background_url field
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"


class TestLoginBackgroundFeature:
    """Test login background upload, get, delete functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as owner and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as owner
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        self.token = login_response.json().get("token")
        self.user = login_response.json().get("user")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        # Cleanup - delete any uploaded background after tests
        try:
            self.session.delete(f"{BASE_URL}/api/settings/login-background")
        except:
            pass
    
    def test_01_public_school_info_includes_login_background_url_field(self):
        """GET /api/schools/public/{subdomain} should include login_background_url field"""
        response = requests.get(f"{BASE_URL}/api/schools/public/{SUBDOMAIN}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "login_background_url" in data, "Response should include login_background_url field"
        assert "subdomain" in data
        assert "school_name" in data
        assert "primary_color" in data
        assert "secondary_color" in data
        print(f"✓ Public school info includes login_background_url: {data.get('login_background_url')}")
    
    def test_02_get_login_background_initial_state(self):
        """GET /api/settings/login-background - should return current state"""
        response = self.session.get(f"{BASE_URL}/api/settings/login-background")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "login_background_url" in data, "Response should include login_background_url field"
        print(f"✓ Current login background URL: {data.get('login_background_url')}")
    
    def test_03_upload_login_background_image(self):
        """PUT /api/settings/login-background - upload image"""
        # Create a simple test image (1x1 pixel PNG)
        import base64
        # Minimal valid PNG (1x1 transparent pixel)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        # Remove Content-Type header for multipart upload
        headers = {"Authorization": f"Bearer {self.token}"}
        
        files = {
            "file": ("test_background.png", png_data, "image/png")
        }
        
        response = requests.put(
            f"{BASE_URL}/api/settings/login-background",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "login_background_url" in data, "Response should include login_background_url"
        assert data["login_background_url"] is not None, "login_background_url should not be None"
        assert "cloudinary" in data["login_background_url"].lower() or "res.cloudinary" in data["login_background_url"], \
            "URL should be from Cloudinary"
        
        self.uploaded_url = data["login_background_url"]
        print(f"✓ Uploaded login background: {self.uploaded_url}")
    
    def test_04_verify_upload_via_get(self):
        """Verify uploaded image is returned by GET endpoint"""
        # First upload an image
        import base64
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        headers = {"Authorization": f"Bearer {self.token}"}
        files = {"file": ("test_background.png", png_data, "image/png")}
        
        upload_response = requests.put(
            f"{BASE_URL}/api/settings/login-background",
            headers=headers,
            files=files
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        uploaded_url = upload_response.json().get("login_background_url")
        
        # Now verify via GET
        get_response = self.session.get(f"{BASE_URL}/api/settings/login-background")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data.get("login_background_url") == uploaded_url, \
            f"GET should return uploaded URL. Expected: {uploaded_url}, Got: {data.get('login_background_url')}"
        
        print(f"✓ GET returns uploaded URL correctly")
    
    def test_05_verify_upload_in_public_school_info(self):
        """Verify uploaded image appears in public school info"""
        # First upload an image
        import base64
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        headers = {"Authorization": f"Bearer {self.token}"}
        files = {"file": ("test_background.png", png_data, "image/png")}
        
        upload_response = requests.put(
            f"{BASE_URL}/api/settings/login-background",
            headers=headers,
            files=files
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        uploaded_url = upload_response.json().get("login_background_url")
        
        # Verify in public school info
        public_response = requests.get(f"{BASE_URL}/api/schools/public/{SUBDOMAIN}")
        assert public_response.status_code == 200
        
        data = public_response.json()
        assert data.get("login_background_url") == uploaded_url, \
            f"Public school info should include uploaded URL. Expected: {uploaded_url}, Got: {data.get('login_background_url')}"
        
        print(f"✓ Public school info includes uploaded background URL")
    
    def test_06_delete_login_background(self):
        """DELETE /api/settings/login-background - delete image"""
        # First upload an image
        import base64
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        headers = {"Authorization": f"Bearer {self.token}"}
        files = {"file": ("test_background.png", png_data, "image/png")}
        
        upload_response = requests.put(
            f"{BASE_URL}/api/settings/login-background",
            headers=headers,
            files=files
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        
        # Now delete
        delete_response = self.session.delete(f"{BASE_URL}/api/settings/login-background")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert "message" in data, "Response should include message"
        print(f"✓ Delete response: {data.get('message')}")
    
    def test_07_verify_delete_via_get(self):
        """Verify deleted image is no longer returned by GET endpoint"""
        # First upload an image
        import base64
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        headers = {"Authorization": f"Bearer {self.token}"}
        files = {"file": ("test_background.png", png_data, "image/png")}
        
        upload_response = requests.put(
            f"{BASE_URL}/api/settings/login-background",
            headers=headers,
            files=files
        )
        assert upload_response.status_code == 200
        
        # Delete
        delete_response = self.session.delete(f"{BASE_URL}/api/settings/login-background")
        assert delete_response.status_code == 200
        
        # Verify via GET
        get_response = self.session.get(f"{BASE_URL}/api/settings/login-background")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data.get("login_background_url") is None, \
            f"After delete, login_background_url should be None. Got: {data.get('login_background_url')}"
        
        print(f"✓ GET returns None after delete")
    
    def test_08_verify_delete_in_public_school_info(self):
        """Verify deleted image is no longer in public school info"""
        # First upload an image
        import base64
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        headers = {"Authorization": f"Bearer {self.token}"}
        files = {"file": ("test_background.png", png_data, "image/png")}
        
        upload_response = requests.put(
            f"{BASE_URL}/api/settings/login-background",
            headers=headers,
            files=files
        )
        assert upload_response.status_code == 200
        
        # Delete
        delete_response = self.session.delete(f"{BASE_URL}/api/settings/login-background")
        assert delete_response.status_code == 200
        
        # Verify in public school info
        public_response = requests.get(f"{BASE_URL}/api/schools/public/{SUBDOMAIN}")
        assert public_response.status_code == 200
        
        data = public_response.json()
        assert data.get("login_background_url") is None, \
            f"After delete, public school info should have None for login_background_url. Got: {data.get('login_background_url')}"
        
        print(f"✓ Public school info shows None after delete")
    
    def test_09_upload_invalid_file_type(self):
        """PUT /api/settings/login-background - should reject non-image files"""
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Try to upload a text file
        files = {
            "file": ("test.txt", b"This is not an image", "text/plain")
        }
        
        response = requests.put(
            f"{BASE_URL}/api/settings/login-background",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid file type, got {response.status_code}: {response.text}"
        print(f"✓ Invalid file type rejected correctly")
    
    def test_10_upload_requires_authentication(self):
        """PUT /api/settings/login-background - should require authentication"""
        import base64
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        # No auth header
        files = {"file": ("test_background.png", png_data, "image/png")}
        
        response = requests.put(
            f"{BASE_URL}/api/settings/login-background",
            files=files
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Upload requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
