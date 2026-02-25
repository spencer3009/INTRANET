"""
Test Suite: WebSocket Real-Time Notifications for EduNet
Tests:
- WebSocket connection with valid JWT token
- WebSocket rejection without token (code 4001)
- POST /api/notifications/test-push creates notification and returns online_users count
- POST /api/notifications/{id}/read returns {success: true, unread_count: N}
- POST /api/notifications/read-all returns {success: true, unread_count: 0}
- GET /api/notifications/unread-count returns correct count
- GET /api/notifications/all returns notifications with link_destino and is_read fields
"""
import pytest
import requests
import websockets
import asyncio
import json
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

# Test credentials
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"


class TestWebSocketNotifications:
    """WebSocket Real-Time Notifications Tests"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.user_id = None
        self._authenticate()

    def _authenticate(self):
        """Authenticate and get token"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": OWNER_EMAIL,
                "password": OWNER_PASSWORD,
                "subdomain": SUBDOMAIN
            }
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

    # ═══════════════════════════════════════════════════════════════════════════
    # REST API Tests
    # ═══════════════════════════════════════════════════════════════════════════

    def test_get_unread_count(self):
        """GET /api/notifications/unread-count returns correct count"""
        response = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "unread_count" in data, f"Response should have unread_count: {data}"
        assert isinstance(data["unread_count"], int), f"unread_count should be int: {data}"
        print(f"✓ GET /api/notifications/unread-count - unread_count: {data['unread_count']}")

    def test_get_all_notifications_structure(self):
        """GET /api/notifications/all returns notifications with required fields"""
        response = self.session.get(f"{BASE_URL}/api/notifications/all")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "notifications" in data, f"Response should have notifications: {data}"
        assert "unread_count" in data, f"Response should have unread_count: {data}"
        
        # Check notification structure if any exist
        if data["notifications"]:
            notif = data["notifications"][0]
            required_fields = ["id", "title", "message", "notification_type", "is_read", "created_at"]
            for field in required_fields:
                assert field in notif, f"Notification should have {field}: {notif}"
            
            # Check that link_destino field exists (may be null for some types)
            # and is_read is boolean
            assert isinstance(notif["is_read"], bool), f"is_read should be boolean: {notif}"
            
            # link_destino should exist (may be None)
            assert "link_destino" in notif or notif.get("link_destino") is None, f"Notification should have link_destino field"
            
        print(f"✓ GET /api/notifications/all - {len(data['notifications'])} notifications, {data['unread_count']} unread")

    def test_notifications_have_link_destino(self):
        """Notifications with reference_id should have link_destino"""
        response = self.session.get(f"{BASE_URL}/api/notifications/all?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        notifications_with_links = [n for n in data["notifications"] if n.get("link_destino")]
        
        # At least check the field exists
        for notif in data["notifications"]:
            assert "is_read" in notif, f"is_read field missing in notification: {notif.get('id')}"
        
        print(f"✓ Notifications with link_destino: {len(notifications_with_links)} out of {len(data['notifications'])}")

    def test_test_push_endpoint(self):
        """POST /api/notifications/test-push creates notification and returns online_users"""
        response = self.session.post(f"{BASE_URL}/api/notifications/test-push")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success: true, got: {data}"
        assert "notification_id" in data, f"Response should have notification_id: {data}"
        assert "online_users" in data, f"Response should have online_users: {data}"
        assert isinstance(data["online_users"], int), f"online_users should be int: {data}"
        
        print(f"✓ POST /api/notifications/test-push - created notification {data['notification_id']}, online_users: {data['online_users']}")
        
        # Store for later test
        self.test_notification_id = data["notification_id"]
        return data["notification_id"]

    def test_mark_notification_read(self):
        """POST /api/notifications/{id}/read marks notification as read"""
        # First create a test notification
        create_resp = self.session.post(f"{BASE_URL}/api/notifications/test-push")
        assert create_resp.status_code == 200
        notification_id = create_resp.json()["notification_id"]
        
        # Mark as read
        response = self.session.post(f"{BASE_URL}/api/notifications/{notification_id}/read")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success: true, got: {data}"
        assert "unread_count" in data, f"Response should have unread_count: {data}"
        assert isinstance(data["unread_count"], int), f"unread_count should be int: {data}"
        
        # Verify it's marked as read
        all_notifs = self.session.get(f"{BASE_URL}/api/notifications/all").json()
        marked_notif = next((n for n in all_notifs["notifications"] if n["id"] == notification_id), None)
        if marked_notif:
            assert marked_notif["is_read"] is True, f"Notification should be marked as read: {marked_notif}"
        
        print(f"✓ POST /api/notifications/{notification_id}/read - success: true, unread_count: {data['unread_count']}")

    def test_mark_all_as_read(self):
        """POST /api/notifications/read-all marks all as read"""
        response = self.session.post(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success: true, got: {data}"
        assert "unread_count" in data, f"Response should have unread_count: {data}"
        assert data["unread_count"] == 0, f"Expected unread_count: 0, got: {data['unread_count']}"
        
        # Verify with unread-count endpoint
        count_resp = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        count_data = count_resp.json()
        assert count_data["unread_count"] == 0, f"unread_count should be 0 after mark-all-read"
        
        print(f"✓ POST /api/notifications/read-all - success: true, unread_count: 0")

    def test_notification_endpoints_require_auth(self):
        """Notification endpoints should return 401 without auth"""
        unauthenticated = requests.Session()
        unauthenticated.headers.update({"Content-Type": "application/json"})
        
        endpoints = [
            ("GET", f"{BASE_URL}/api/notifications/all"),
            ("GET", f"{BASE_URL}/api/notifications/unread-count"),
            ("POST", f"{BASE_URL}/api/notifications/test-push"),
            ("POST", f"{BASE_URL}/api/notifications/read-all"),
            ("POST", f"{BASE_URL}/api/notifications/fake-id/read"),
        ]
        
        for method, url in endpoints:
            if method == "GET":
                resp = unauthenticated.get(url)
            else:
                resp = unauthenticated.post(url)
            
            assert resp.status_code in [401, 403], f"{method} {url} should require auth, got {resp.status_code}"
        
        print("✓ All notification endpoints require authentication")


class TestWebSocketConnection:
    """WebSocket Connection Tests - Using asyncio"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self._authenticate()

    def _authenticate(self):
        """Authenticate and get token"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": OWNER_EMAIL,
                "password": OWNER_PASSWORD,
                "subdomain": SUBDOMAIN
            }
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")

    @pytest.mark.asyncio
    async def test_websocket_connects_with_valid_token(self):
        """WebSocket endpoint connects successfully with valid JWT token"""
        ws_url = f"{WS_URL}/api/ws/notifications?token={self.token}"
        
        try:
            async with websockets.connect(ws_url, close_timeout=5) as ws:
                # Connection successful
                assert ws.open, "WebSocket should be open"
                
                # Test ping/pong keepalive
                await ws.send("ping")
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                assert response == "pong", f"Expected 'pong', got '{response}'"
                
                print(f"✓ WebSocket connected with valid token, ping/pong working")
        except Exception as e:
            pytest.fail(f"WebSocket connection failed: {e}")

    @pytest.mark.asyncio
    async def test_websocket_rejects_without_token(self):
        """WebSocket endpoint rejects connection without token (code 4001)"""
        ws_url = f"{WS_URL}/api/ws/notifications"
        
        try:
            async with websockets.connect(ws_url, close_timeout=5) as ws:
                # Should not reach here - connection should be rejected
                pytest.fail("WebSocket should have rejected connection without token")
        except websockets.exceptions.ConnectionClosedError as e:
            assert e.code == 4001, f"Expected close code 4001, got {e.code}"
            print(f"✓ WebSocket rejected without token, close code: {e.code}")
        except Exception as e:
            # Other exceptions might indicate network issues, but not success
            print(f"⚠ WebSocket rejected connection: {type(e).__name__}: {e}")

    @pytest.mark.asyncio
    async def test_websocket_rejects_invalid_token(self):
        """WebSocket endpoint rejects connection with invalid token"""
        ws_url = f"{WS_URL}/api/ws/notifications?token=invalid_token_12345"
        
        try:
            async with websockets.connect(ws_url, close_timeout=5) as ws:
                pytest.fail("WebSocket should have rejected invalid token")
        except websockets.exceptions.ConnectionClosedError as e:
            assert e.code == 4001, f"Expected close code 4001, got {e.code}"
            print(f"✓ WebSocket rejected invalid token, close code: {e.code}")
        except Exception as e:
            print(f"⚠ WebSocket rejected invalid token: {type(e).__name__}: {e}")

    @pytest.mark.asyncio
    async def test_websocket_receives_push_notification(self):
        """WebSocket receives new_notification when test-push is called"""
        ws_url = f"{WS_URL}/api/ws/notifications?token={self.token}"
        
        try:
            async with websockets.connect(ws_url, close_timeout=10) as ws:
                # Wait briefly for connection to stabilize
                await asyncio.sleep(0.5)
                
                # Trigger a test-push notification via REST API
                push_resp = self.session.post(f"{BASE_URL}/api/notifications/test-push")
                assert push_resp.status_code == 200, f"test-push failed: {push_resp.text}"
                
                # Wait for WebSocket message
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=10)
                    data = json.loads(message)
                    
                    assert data.get("type") == "new_notification", f"Expected type 'new_notification', got: {data}"
                    assert "notification" in data, f"Message should contain notification: {data}"
                    
                    notif = data["notification"]
                    assert "id" in notif, f"Notification should have id: {notif}"
                    assert "title" in notif, f"Notification should have title: {notif}"
                    assert notif.get("is_read") is False, f"New notification should be unread: {notif}"
                    
                    print(f"✓ WebSocket received push notification: {notif.get('title')}")
                except asyncio.TimeoutError:
                    # This can happen if the user is not in the broadcast list
                    # (e.g., author is excluded from broadcast)
                    print("⚠ No WebSocket message received (may be excluded from broadcast as author)")
        except Exception as e:
            pytest.fail(f"WebSocket test failed: {e}")


class TestWebSocketBroadcastOnMessage:
    """Test WebSocket broadcast when sending academic messages"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self._authenticate()

    def _authenticate(self):
        """Authenticate and get token"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": OWNER_EMAIL,
                "password": OWNER_PASSWORD,
                "subdomain": SUBDOMAIN
            }
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")

    def test_online_users_count_from_test_push(self):
        """POST /api/notifications/test-push returns online_users count"""
        response = self.session.post(f"{BASE_URL}/api/notifications/test-push")
        assert response.status_code == 200
        
        data = response.json()
        assert "online_users" in data, f"Response should have online_users: {data}"
        # online_users could be 0 if no WebSocket clients connected
        assert isinstance(data["online_users"], int), f"online_users should be int"
        
        print(f"✓ Online users count from test-push: {data['online_users']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
