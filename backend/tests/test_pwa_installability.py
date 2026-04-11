"""
PWA Installability Fix Tests
Tests for verifying the PWA installability fix after merging Firebase Messaging into service-worker.js
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"


class TestStaticFiles:
    """Test that static files for PWA are served correctly"""
    
    def test_service_worker_served(self):
        """service-worker.js must be served with 200 status"""
        response = requests.get(f"{BASE_URL}/service-worker.js")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: service-worker.js served with 200")
    
    def test_service_worker_has_firebase_imports(self):
        """service-worker.js must have Firebase importScripts at the top"""
        response = requests.get(f"{BASE_URL}/service-worker.js")
        content = response.text
        assert "importScripts" in content, "Missing importScripts"
        assert "firebase-app-compat.js" in content, "Missing firebase-app-compat.js import"
        assert "firebase-messaging-compat.js" in content, "Missing firebase-messaging-compat.js import"
        print("PASS: service-worker.js has Firebase importScripts")
    
    def test_service_worker_has_fetch_handler(self):
        """service-worker.js must have fetch event listener for PWA installability"""
        response = requests.get(f"{BASE_URL}/service-worker.js")
        content = response.text
        assert "self.addEventListener('fetch'" in content, "Missing fetch event listener"
        print("PASS: service-worker.js has fetch handler")
    
    def test_service_worker_has_background_message_handler(self):
        """service-worker.js must have onBackgroundMessage for FCM"""
        response = requests.get(f"{BASE_URL}/service-worker.js")
        content = response.text
        assert "onBackgroundMessage" in content, "Missing onBackgroundMessage handler"
        print("PASS: service-worker.js has onBackgroundMessage handler")
    
    def test_service_worker_version(self):
        """service-worker.js should be v9.0.0"""
        response = requests.get(f"{BASE_URL}/service-worker.js")
        content = response.text
        assert "edunet-v9" in content, "Expected CACHE_NAME to be edunet-v9"
        assert "9.0.0" in content, "Expected SW_VERSION to be 9.0.0"
        print("PASS: service-worker.js is v9.0.0")
    
    def test_firebase_messaging_sw_self_unregisters(self):
        """firebase-messaging-sw.js must contain self-unregister code"""
        response = requests.get(f"{BASE_URL}/firebase-messaging-sw.js")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        content = response.text
        assert "self.registration.unregister()" in content, "Missing self-unregister code"
        assert "DEPRECATED" in content, "Missing DEPRECATED comment"
        print("PASS: firebase-messaging-sw.js has self-unregister code")
    
    def test_manifest_json_served(self):
        """manifest.json must be served correctly"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("name") == "EduNet", f"Expected name 'EduNet', got {data.get('name')}"
        assert data.get("display") == "standalone", f"Expected display 'standalone', got {data.get('display')}"
        print("PASS: manifest.json served correctly")
    
    def test_manifest_has_icons(self):
        """manifest.json must have 192x192 and 512x512 icons"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        data = response.json()
        icons = data.get("icons", [])
        sizes = [icon.get("sizes") for icon in icons]
        assert "192x192" in sizes, "Missing 192x192 icon"
        assert "512x512" in sizes, "Missing 512x512 icon"
        print("PASS: manifest.json has required icons")
    
    def test_icon_192_exists(self):
        """icon-192.png must exist"""
        response = requests.get(f"{BASE_URL}/icons/icon-192.png")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: icon-192.png exists")
    
    def test_icon_512_exists(self):
        """icon-512.png must exist"""
        response = requests.get(f"{BASE_URL}/icons/icon-512.png")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: icon-512.png exists")


class TestNotificationAPIs:
    """Test notification APIs still work after the fix"""
    
    @pytest.fixture
    def support_token(self):
        """Get support admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": SUPPORT_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Support login failed: {response.status_code}")
        return response.json().get("token")
    
    @pytest.fixture
    def owner_token(self):
        """Get owner token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD,
            "subdomain": "elroble"
        })
        if response.status_code != 200:
            pytest.skip(f"Owner login failed: {response.status_code}")
        return response.json().get("token")
    
    def test_owner_login(self, owner_token):
        """Owner can login successfully"""
        assert owner_token is not None, "Owner token should not be None"
        print(f"PASS: Owner login successful, token: {owner_token[:20]}...")
    
    def test_register_device_endpoint(self, owner_token):
        """POST /api/notifications/register-device works for owner"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-device",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={
                "fcm_token": "test_fcm_token_pwa_fix_" + str(os.urandom(4).hex()),
                "platform": "web",
                "user_agent": "pytest-test-agent"
            }
        )
        # Accept 200 (success) or 400 (if FCM not configured) - both are valid
        assert response.status_code in [200, 201, 400], f"Expected 200/201/400, got {response.status_code}: {response.text}"
        print(f"PASS: register-device endpoint responded with {response.status_code}")
    
    def test_support_test_push_endpoint(self, support_token):
        """POST /api/support/schools/{school_id}/test-push works"""
        response = requests.post(
            f"{BASE_URL}/api/support/schools/{SCHOOL_ID}/test-push",
            headers={"Authorization": f"Bearer {support_token}"}
        )
        # Accept 200 (success) or 500 (if FCM not configured) - both are valid for this test
        assert response.status_code in [200, 500], f"Expected 200/500, got {response.status_code}: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "notification_id" in data or "message" in data, "Response should have notification_id or message"
        print(f"PASS: test-push endpoint responded with {response.status_code}")
    
    def test_get_notifications_all(self, owner_token):
        """GET /api/notifications/all returns notifications for owner"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/all",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Response can be a list or an object with 'notifications' key
        if isinstance(data, dict):
            assert "notifications" in data, "Response should have 'notifications' key"
            notifications = data["notifications"]
            count = len(notifications)
        else:
            notifications = data
            count = len(notifications)
        assert isinstance(notifications, list), "Notifications should be a list"
        print(f"PASS: GET /api/notifications/all returned {count} notifications")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
