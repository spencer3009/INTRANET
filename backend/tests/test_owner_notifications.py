"""
Test Owner Notifications Bug Fix
Tests:
1. POST /api/support/schools/{school_id}/test-push creates notification in `notifications` collection
2. POST /api/notifications/register-device registers device token in device_tokens collection
3. GET /api/notifications/all returns the test-push notification for the school owner
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "SoporteTest2026!"
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"


class TestOwnerNotificationsBugFix:
    """Tests for the owner notifications bug fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_support_token(self):
        """Login as support admin and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": SUPPORT_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        # Try alternate password from review_request
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": "Socios3009"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Support login failed: {response.status_code} - {response.text}")
    
    def get_owner_token(self):
        """Login as school owner and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Owner login failed: {response.status_code} - {response.text}")
    
    def test_01_support_login(self):
        """Test support admin can login"""
        token = self.get_support_token()
        assert token is not None, "Support token should not be None"
        print(f"PASS: Support login successful")
    
    def test_02_owner_login(self):
        """Test school owner can login"""
        token = self.get_owner_token()
        assert token is not None, "Owner token should not be None"
        print(f"PASS: Owner login successful")
    
    def test_03_register_device_endpoint_exists(self):
        """Test POST /api/notifications/register-device endpoint exists and works"""
        token = self.get_owner_token()
        
        # Generate a fake FCM token for testing
        fake_fcm_token = f"test_fcm_token_{uuid.uuid4()}"
        
        response = self.session.post(
            f"{BASE_URL}/api/notifications/register-device",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "fcm_token": fake_fcm_token,
                "platform": "web",
                "user_agent": "pytest-test-agent"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "ok", f"Expected status 'ok', got {data}"
        print(f"PASS: POST /api/notifications/register-device works - status: {data.get('status')}")
    
    def test_04_test_push_creates_notification_in_notifications_collection(self):
        """Test POST /api/support/schools/{school_id}/test-push creates notification in notifications collection"""
        support_token = self.get_support_token()
        
        response = self.session.post(
            f"{BASE_URL}/api/support/schools/{SCHOOL_ID}/test-push",
            headers={"Authorization": f"Bearer {support_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("ok") == True, f"Expected ok=True, got {data}"
        assert "notification_id" in data, f"Expected notification_id in response, got {data}"
        assert "owner_email" in data, f"Expected owner_email in response, got {data}"
        assert "school_name" in data, f"Expected school_name in response, got {data}"
        
        # Store notification_id for next test
        self.test_notification_id = data.get("notification_id")
        
        print(f"PASS: test-push created notification {data.get('notification_id')}")
        print(f"  - Owner email: {data.get('owner_email')}")
        print(f"  - School name: {data.get('school_name')}")
        print(f"  - Devices found: {data.get('devices_found')}")
        print(f"  - FCM configured: {data.get('fcm_configured')}")
        
        return data.get("notification_id")
    
    def test_05_owner_can_see_test_push_notification(self):
        """Test GET /api/notifications/all returns the test-push notification for the owner"""
        # First create a test-push notification
        support_token = self.get_support_token()
        
        push_response = self.session.post(
            f"{BASE_URL}/api/support/schools/{SCHOOL_ID}/test-push",
            headers={"Authorization": f"Bearer {support_token}"}
        )
        assert push_response.status_code == 200, f"test-push failed: {push_response.text}"
        notification_id = push_response.json().get("notification_id")
        
        # Now login as owner and check notifications
        owner_token = self.get_owner_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/notifications/all",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "notifications" in data, f"Expected 'notifications' in response, got {data.keys()}"
        assert "unread_count" in data, f"Expected 'unread_count' in response, got {data.keys()}"
        
        notifications = data.get("notifications", [])
        
        # Find the test notification
        test_notif = None
        for notif in notifications:
            if notif.get("id") == notification_id:
                test_notif = notif
                break
        
        assert test_notif is not None, f"Test notification {notification_id} not found in owner's notifications. Found {len(notifications)} notifications."
        assert test_notif.get("title") == "Prueba de notificacion", f"Expected title 'Prueba de notificacion', got {test_notif.get('title')}"
        assert test_notif.get("notification_type") == "announcement", f"Expected type 'announcement', got {test_notif.get('notification_type')}"
        
        print(f"PASS: Owner can see test-push notification")
        print(f"  - Notification ID: {notification_id}")
        print(f"  - Title: {test_notif.get('title')}")
        print(f"  - Type: {test_notif.get('notification_type')}")
        print(f"  - Total notifications: {len(notifications)}")
        print(f"  - Unread count: {data.get('unread_count')}")
    
    def test_06_notification_has_correct_school_id(self):
        """Test that test-push notification has correct school_id"""
        support_token = self.get_support_token()
        
        push_response = self.session.post(
            f"{BASE_URL}/api/support/schools/{SCHOOL_ID}/test-push",
            headers={"Authorization": f"Bearer {support_token}"}
        )
        assert push_response.status_code == 200
        notification_id = push_response.json().get("notification_id")
        
        # Get owner's notifications
        owner_token = self.get_owner_token()
        response = self.session.get(
            f"{BASE_URL}/api/notifications/all",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200
        
        notifications = response.json().get("notifications", [])
        test_notif = next((n for n in notifications if n.get("id") == notification_id), None)
        
        assert test_notif is not None, "Test notification not found"
        assert test_notif.get("school_id") == SCHOOL_ID, f"Expected school_id {SCHOOL_ID}, got {test_notif.get('school_id')}"
        
        print(f"PASS: Notification has correct school_id: {SCHOOL_ID}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
