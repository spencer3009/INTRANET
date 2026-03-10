"""
Broadcast (Comunicados Masivos) Module Tests
Tests the massive broadcast communication system for institutional announcements
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - Owner role for elroble school
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"


class TestBroadcastModule:
    """Tests for the broadcast/comunicados system"""
    
    @pytest.fixture(scope="class")
    def owner_token(self):
        """Login as owner to get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD, "subdomain": SUBDOMAIN}
        )
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in login response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def owner_headers(self, owner_token):
        """Auth headers for owner"""
        return {"Authorization": f"Bearer {owner_token}"}

    # ─── Permission API Tests ────────────────────────────────────────────
    
    def test_broadcast_permission_requires_auth(self):
        """GET /api/broadcast/permission requires authentication"""
        response = requests.get(f"{BASE_URL}/api/broadcast/permission")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Broadcast permission endpoint requires auth")
    
    def test_broadcast_permission_owner_can_send(self, owner_headers):
        """GET /api/broadcast/permission returns can_send_broadcast:true for owner"""
        response = requests.get(f"{BASE_URL}/api/broadcast/permission", headers=owner_headers)
        assert response.status_code == 200, f"Permission check failed: {response.text}"
        data = response.json()
        assert "can_send_broadcast" in data, "Missing can_send_broadcast field"
        assert data["can_send_broadcast"] is True, "Owner should have broadcast permission"
        print("✓ Owner has broadcast permission")

    # ─── Recipients Count API Tests ──────────────────────────────────────
    
    def test_recipients_count_requires_auth(self):
        """GET /api/broadcast/recipients-count requires authentication"""
        response = requests.get(f"{BASE_URL}/api/broadcast/recipients-count")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Recipients count endpoint requires auth")
    
    def test_recipients_count_returns_counts(self, owner_headers):
        """GET /api/broadcast/recipients-count returns counts per role"""
        response = requests.get(f"{BASE_URL}/api/broadcast/recipients-count", headers=owner_headers)
        assert response.status_code == 200, f"Recipients count failed: {response.text}"
        data = response.json()
        assert "counts" in data, "Missing counts field"
        counts = data["counts"]
        # Should have counts for all roles
        for role in ["teacher", "student", "parent", "admin"]:
            assert role in counts, f"Missing count for role: {role}"
            assert isinstance(counts[role], int), f"Count for {role} should be int"
        print(f"✓ Recipients counts: {counts}")
    
    def test_recipients_count_with_roles_filter(self, owner_headers):
        """GET /api/broadcast/recipients-count with roles param calculates total"""
        response = requests.get(
            f"{BASE_URL}/api/broadcast/recipients-count?roles=teacher,student",
            headers=owner_headers
        )
        assert response.status_code == 200, f"Recipients count failed: {response.text}"
        data = response.json()
        assert "counts" in data
        assert "total" in data
        assert "selected_roles" in data
        print(f"✓ Recipients count with filter: total={data['total']}, selected={data['selected_roles']}")

    # ─── Send Broadcast API Tests ────────────────────────────────────────
    
    def test_send_broadcast_requires_auth(self):
        """POST /api/broadcast/send requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/broadcast/send",
            json={"subject": "Test", "body": "Test", "target_roles": ["teacher"]}
        )
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Send broadcast endpoint requires auth")
    
    def test_send_broadcast_requires_subject(self, owner_headers):
        """POST /api/broadcast/send validates subject is required"""
        response = requests.post(
            f"{BASE_URL}/api/broadcast/send",
            json={"subject": "   ", "body": "Test body", "target_roles": ["teacher"]},
            headers=owner_headers
        )
        assert response.status_code == 400, "Should reject empty subject"
        print("✓ Broadcast requires non-empty subject")
    
    def test_send_broadcast_requires_body(self, owner_headers):
        """POST /api/broadcast/send validates body is required"""
        response = requests.post(
            f"{BASE_URL}/api/broadcast/send",
            json={"subject": "Test subject", "body": "   ", "target_roles": ["teacher"]},
            headers=owner_headers
        )
        assert response.status_code == 400, "Should reject empty body"
        print("✓ Broadcast requires non-empty body")
    
    def test_send_broadcast_requires_roles(self, owner_headers):
        """POST /api/broadcast/send validates target_roles is required"""
        response = requests.post(
            f"{BASE_URL}/api/broadcast/send",
            json={"subject": "Test subject", "body": "Test body", "target_roles": []},
            headers=owner_headers
        )
        assert response.status_code == 400, "Should reject empty target_roles"
        print("✓ Broadcast requires at least one target role")
    
    def test_send_broadcast_success(self, owner_headers):
        """POST /api/broadcast/send creates broadcast successfully"""
        unique_subject = f"TEST_BROADCAST_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/broadcast/send",
            json={
                "subject": unique_subject,
                "body": "<p>Este es un comunicado de prueba automatizado</p>",
                "target_roles": ["teacher", "admin"]
            },
            headers=owner_headers
        )
        assert response.status_code == 200, f"Send broadcast failed: {response.text}"
        data = response.json()
        assert "broadcast_id" in data, "Missing broadcast_id in response"
        assert "total_recipients" in data, "Missing total_recipients in response"
        assert "message" in data, "Missing success message"
        print(f"✓ Broadcast sent: id={data['broadcast_id']}, recipients={data['total_recipients']}")
        return data["broadcast_id"]

    # ─── Sent Broadcasts API Tests ───────────────────────────────────────
    
    def test_sent_broadcasts_requires_auth(self):
        """GET /api/broadcast/sent requires authentication"""
        response = requests.get(f"{BASE_URL}/api/broadcast/sent")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Sent broadcasts endpoint requires auth")
    
    def test_sent_broadcasts_returns_list(self, owner_headers):
        """GET /api/broadcast/sent returns list of sent broadcasts with stats"""
        response = requests.get(f"{BASE_URL}/api/broadcast/sent", headers=owner_headers)
        assert response.status_code == 200, f"Sent broadcasts failed: {response.text}"
        data = response.json()
        assert "broadcasts" in data, "Missing broadcasts field"
        assert isinstance(data["broadcasts"], list), "broadcasts should be a list"
        
        if data["broadcasts"]:
            broadcast = data["broadcasts"][0]
            # Verify broadcast structure
            assert "id" in broadcast, "Missing id"
            assert "subject" in broadcast, "Missing subject"
            assert "body" in broadcast, "Missing body"
            assert "target_roles" in broadcast, "Missing target_roles"
            assert "sender_name" in broadcast, "Missing sender_name"
            assert "total_recipients" in broadcast, "Missing total_recipients"
            assert "read_count" in broadcast, "Missing read_count"
            assert "created_at" in broadcast, "Missing created_at"
            print(f"✓ Sent broadcasts list: {len(data['broadcasts'])} items, first: {broadcast['subject']}")
        else:
            print("✓ Sent broadcasts list: empty (no broadcasts yet)")

    # ─── Broadcast Stats API Tests ───────────────────────────────────────
    
    def test_broadcast_stats_requires_auth(self):
        """GET /api/broadcast/{id}/stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/broadcast/test-id/stats")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Broadcast stats endpoint requires auth")
    
    def test_broadcast_stats_returns_counts(self, owner_headers):
        """GET /api/broadcast/{id}/stats returns read/pending counts"""
        # First get a broadcast ID from sent list
        sent_response = requests.get(f"{BASE_URL}/api/broadcast/sent", headers=owner_headers)
        assert sent_response.status_code == 200
        broadcasts = sent_response.json().get("broadcasts", [])
        
        if not broadcasts:
            pytest.skip("No broadcasts to get stats for")
        
        broadcast_id = broadcasts[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/broadcast/{broadcast_id}/stats",
            headers=owner_headers
        )
        assert response.status_code == 200, f"Broadcast stats failed: {response.text}"
        data = response.json()
        assert "broadcast" in data, "Missing broadcast field"
        assert "total" in data, "Missing total field"
        assert "read" in data, "Missing read field"
        assert "pending" in data, "Missing pending field"
        print(f"✓ Broadcast stats: total={data['total']}, read={data['read']}, pending={data['pending']}")
    
    def test_broadcast_stats_invalid_id(self, owner_headers):
        """GET /api/broadcast/{id}/stats returns 404 for invalid ID"""
        response = requests.get(
            f"{BASE_URL}/api/broadcast/non-existent-id/stats",
            headers=owner_headers
        )
        assert response.status_code == 404, "Should return 404 for invalid broadcast ID"
        print("✓ Broadcast stats returns 404 for invalid ID")

    # ─── Unread Broadcasts API Tests ─────────────────────────────────────
    
    def test_unread_broadcasts_requires_auth(self):
        """GET /api/broadcast/unread requires authentication"""
        response = requests.get(f"{BASE_URL}/api/broadcast/unread")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Unread broadcasts endpoint requires auth")
    
    def test_unread_broadcasts_returns_list(self, owner_headers):
        """GET /api/broadcast/unread returns unread broadcasts for user"""
        response = requests.get(f"{BASE_URL}/api/broadcast/unread", headers=owner_headers)
        assert response.status_code == 200, f"Unread broadcasts failed: {response.text}"
        data = response.json()
        assert "broadcasts" in data, "Missing broadcasts field"
        assert "count" in data, "Missing count field"
        assert isinstance(data["broadcasts"], list), "broadcasts should be a list"
        print(f"✓ Unread broadcasts: count={data['count']}")

    # ─── Mark Read API Tests ─────────────────────────────────────────────
    
    def test_mark_read_requires_auth(self):
        """POST /api/broadcast/{id}/read requires authentication"""
        response = requests.post(f"{BASE_URL}/api/broadcast/test-id/read")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Mark broadcast read endpoint requires auth")
    
    def test_mark_read_success(self, owner_headers):
        """POST /api/broadcast/{id}/read marks broadcast as read"""
        # This test uses a dummy ID since owner may not be a recipient
        response = requests.post(
            f"{BASE_URL}/api/broadcast/test-broadcast-id/read",
            json={},
            headers=owner_headers
        )
        # Should return 200 even if no matching receiver (no error)
        assert response.status_code == 200, f"Mark read failed: {response.text}"
        data = response.json()
        assert "message" in data
        print("✓ Mark broadcast read returns success message")

    # ─── Inbox API Tests ─────────────────────────────────────────────────
    
    def test_inbox_requires_auth(self):
        """GET /api/broadcast/inbox requires authentication"""
        response = requests.get(f"{BASE_URL}/api/broadcast/inbox")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Broadcast inbox endpoint requires auth")
    
    def test_inbox_returns_broadcasts(self, owner_headers):
        """GET /api/broadcast/inbox returns broadcasts received by user"""
        response = requests.get(f"{BASE_URL}/api/broadcast/inbox", headers=owner_headers)
        assert response.status_code == 200, f"Inbox failed: {response.text}"
        data = response.json()
        assert "broadcasts" in data, "Missing broadcasts field"
        assert isinstance(data["broadcasts"], list), "broadcasts should be a list"
        print(f"✓ Broadcast inbox: {len(data['broadcasts'])} items")


class TestSettingsBroadcastPermission:
    """Tests for the broadcast permission toggle in settings"""
    
    @pytest.fixture(scope="class")
    def owner_token(self):
        """Login as owner to get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD, "subdomain": SUBDOMAIN}
        )
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def owner_headers(self, owner_token):
        return {"Authorization": f"Bearer {owner_token}"}
    
    def test_settings_roles_update_broadcast_permission(self, owner_headers):
        """PUT /api/settings/roles with allow_admin_broadcast field updates correctly"""
        # First get current value
        settings_response = requests.get(f"{BASE_URL}/api/settings", headers=owner_headers)
        assert settings_response.status_code == 200
        
        # Toggle the setting
        response = requests.put(
            f"{BASE_URL}/api/settings/roles",
            json={"allow_admin_broadcast": True},
            headers=owner_headers
        )
        assert response.status_code == 200, f"Update broadcast permission failed: {response.text}"
        
        # Verify the change
        verify_response = requests.get(f"{BASE_URL}/api/settings", headers=owner_headers)
        assert verify_response.status_code == 200
        settings = verify_response.json()
        assert "allow_admin_broadcast" in settings
        print(f"✓ Broadcast permission toggle works: allow_admin_broadcast={settings.get('allow_admin_broadcast')}")
        
        # Reset to original (false for safety)
        requests.put(
            f"{BASE_URL}/api/settings/roles",
            json={"allow_admin_broadcast": False},
            headers=owner_headers
        )
        print("✓ Broadcast permission reset to false")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
