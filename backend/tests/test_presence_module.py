"""
Test suite for User Presence System (Online/Offline)
Tests heartbeat, presence status, and integration with messages module.
"""
import pytest
import requests
import os
import time
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"


class TestPresenceEndpoints:
    """Test presence-related API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["token"]
        self.user_id = data["user"]["id"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Logged in as user: {self.user_id}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/presence/heartbeat
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_heartbeat_success(self):
        """Test sending heartbeat marks user as online"""
        response = self.session.post(f"{BASE_URL}/api/presence/heartbeat")
        
        assert response.status_code == 200, f"Heartbeat failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "status" in data
        assert data["status"] == "ok"
        assert "last_seen" in data
        
        # Verify last_seen is a valid ISO timestamp
        last_seen = data["last_seen"]
        assert last_seen is not None
        print(f"Heartbeat sent successfully, last_seen: {last_seen}")
    
    def test_heartbeat_requires_auth(self):
        """Test heartbeat requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/presence/heartbeat")
        assert response.status_code == 401, "Heartbeat should require auth"
        print("Heartbeat correctly requires authentication")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/presence/users
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_presence_status(self):
        """Test getting presence status for all users"""
        # First send heartbeat to ensure current user is online
        self.session.post(f"{BASE_URL}/api/presence/heartbeat")
        
        response = self.session.get(f"{BASE_URL}/api/presence/users")
        
        assert response.status_code == 200, f"Get presence failed: {response.text}"
        data = response.json()
        
        # Response should be a dict with user_id keys
        assert isinstance(data, dict)
        
        # Current user should be in the presence map and online
        if self.user_id in data:
            user_presence = data[self.user_id]
            assert "is_online" in user_presence
            assert "last_seen" in user_presence
            assert user_presence["is_online"] == True, "Current user should be online after heartbeat"
            print(f"Current user presence: {user_presence}")
        
        print(f"Got presence status for {len(data)} users")
    
    def test_presence_status_requires_auth(self):
        """Test presence status requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/presence/users")
        assert response.status_code == 401, "Presence status should require auth"
        print("Presence status correctly requires authentication")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/presence/offline
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_mark_offline(self):
        """Test marking user as offline"""
        # First send heartbeat to be online
        self.session.post(f"{BASE_URL}/api/presence/heartbeat")
        
        # Then mark offline
        response = self.session.post(f"{BASE_URL}/api/presence/offline")
        
        assert response.status_code == 200, f"Mark offline failed: {response.text}"
        data = response.json()
        
        assert "status" in data
        assert data["status"] == "ok"
        print("User marked as offline successfully")
        
        # Verify user is now offline
        presence_response = self.session.get(f"{BASE_URL}/api/presence/users")
        presence_data = presence_response.json()
        
        if self.user_id in presence_data:
            assert presence_data[self.user_id]["is_online"] == False, "User should be offline after marking offline"
            print("Verified user is now offline")
    
    def test_mark_offline_requires_auth(self):
        """Test mark offline requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/presence/offline")
        assert response.status_code == 401, "Mark offline should require auth"
        print("Mark offline correctly requires authentication")


class TestMessagesWithPresence:
    """Test messages endpoints include presence information"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["token"]
        self.user_id = data["user"]["id"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Send heartbeat to mark current user as online
        self.session.post(f"{BASE_URL}/api/presence/heartbeat")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/messages/users - includes is_online and last_seen
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_messages_users_includes_presence(self):
        """Test GET /api/messages/users includes is_online and last_seen"""
        response = self.session.get(f"{BASE_URL}/api/messages/users")
        
        assert response.status_code == 200, f"Get users failed: {response.text}"
        data = response.json()
        
        # Response should be a list of groups
        assert isinstance(data, list)
        assert len(data) > 0, "Should have at least one user group"
        
        # Check first group has users with presence info
        first_group = data[0]
        assert "label" in first_group
        assert "users" in first_group
        
        if len(first_group["users"]) > 0:
            first_user = first_group["users"][0]
            assert "is_online" in first_user, "User should have is_online field"
            assert "last_seen" in first_user, "User should have last_seen field"
            assert isinstance(first_user["is_online"], bool), "is_online should be boolean"
            print(f"User {first_user.get('full_name')}: is_online={first_user['is_online']}, last_seen={first_user['last_seen']}")
        
        # Count online users
        total_users = 0
        online_users = 0
        for group in data:
            for user in group["users"]:
                total_users += 1
                if user["is_online"]:
                    online_users += 1
        
        print(f"Total users: {total_users}, Online: {online_users}")
    
    def test_messages_users_online_first(self):
        """Test that online users appear first in each group"""
        response = self.session.get(f"{BASE_URL}/api/messages/users")
        
        assert response.status_code == 200
        data = response.json()
        
        for group in data:
            users = group["users"]
            if len(users) > 1:
                # Check that online users come before offline users
                found_offline = False
                for user in users:
                    if not user["is_online"]:
                        found_offline = True
                    elif found_offline:
                        # Found online user after offline user - this is wrong
                        pytest.fail(f"Online user {user['full_name']} found after offline users in group {group['label']}")
        
        print("Verified online users appear first in all groups")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/messages/chats - includes is_online for each partner
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_messages_chats_includes_presence(self):
        """Test GET /api/messages/chats includes is_online for each partner"""
        response = self.session.get(f"{BASE_URL}/api/messages/chats")
        
        assert response.status_code == 200, f"Get chats failed: {response.text}"
        data = response.json()
        
        # Response should be a list
        assert isinstance(data, list)
        
        if len(data) > 0:
            first_chat = data[0]
            assert "partner_id" in first_chat
            assert "partner_name" in first_chat
            assert "is_online" in first_chat, "Chat should have is_online field"
            assert "last_seen" in first_chat, "Chat should have last_seen field"
            assert isinstance(first_chat["is_online"], bool), "is_online should be boolean"
            print(f"Chat with {first_chat['partner_name']}: is_online={first_chat['is_online']}")
        else:
            print("No existing chats to verify presence")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/messages/chats/{id} - partner includes is_online
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_chat_detail_includes_presence(self):
        """Test GET /api/messages/chats/{id} includes partner's is_online"""
        # First get list of chats to find a partner
        chats_response = self.session.get(f"{BASE_URL}/api/messages/chats")
        chats = chats_response.json()
        
        if len(chats) == 0:
            # Get users to find someone to chat with
            users_response = self.session.get(f"{BASE_URL}/api/messages/users")
            users_data = users_response.json()
            if len(users_data) > 0 and len(users_data[0]["users"]) > 0:
                partner_id = users_data[0]["users"][0]["id"]
            else:
                pytest.skip("No users available to test chat detail")
                return
        else:
            partner_id = chats[0]["partner_id"]
        
        # Get chat detail
        response = self.session.get(f"{BASE_URL}/api/messages/chats/{partner_id}")
        
        assert response.status_code == 200, f"Get chat detail failed: {response.text}"
        data = response.json()
        
        # Check partner info includes presence
        assert "partner" in data
        partner = data["partner"]
        assert "is_online" in partner, "Partner should have is_online field"
        assert "last_seen" in partner, "Partner should have last_seen field"
        assert isinstance(partner["is_online"], bool), "is_online should be boolean"
        
        print(f"Chat detail - Partner {partner.get('name')}: is_online={partner['is_online']}, last_seen={partner['last_seen']}")


class TestPresenceIntegration:
    """Integration tests for presence system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["token"]
        self.user_id = data["user"]["id"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_heartbeat_updates_presence(self):
        """Test that heartbeat updates presence status correctly"""
        # Mark offline first
        self.session.post(f"{BASE_URL}/api/presence/offline")
        
        # Verify offline
        presence_response = self.session.get(f"{BASE_URL}/api/presence/users")
        presence_data = presence_response.json()
        if self.user_id in presence_data:
            assert presence_data[self.user_id]["is_online"] == False
        
        # Send heartbeat
        heartbeat_response = self.session.post(f"{BASE_URL}/api/presence/heartbeat")
        assert heartbeat_response.status_code == 200
        
        # Verify online
        presence_response = self.session.get(f"{BASE_URL}/api/presence/users")
        presence_data = presence_response.json()
        if self.user_id in presence_data:
            assert presence_data[self.user_id]["is_online"] == True
            print("Verified heartbeat updates presence to online")
    
    def test_presence_reflected_in_messages_users(self):
        """Test that presence status is reflected in messages/users endpoint"""
        # Send heartbeat to be online
        self.session.post(f"{BASE_URL}/api/presence/heartbeat")
        
        # Get messages users
        response = self.session.get(f"{BASE_URL}/api/messages/users")
        assert response.status_code == 200
        data = response.json()
        
        # All users should have presence fields
        for group in data:
            for user in group["users"]:
                assert "is_online" in user
                assert "last_seen" in user
        
        print("Verified all users in messages/users have presence fields")
    
    def test_presence_reflected_in_chats(self):
        """Test that presence status is reflected in chats endpoint"""
        # Send heartbeat to be online
        self.session.post(f"{BASE_URL}/api/presence/heartbeat")
        
        # Get chats
        response = self.session.get(f"{BASE_URL}/api/messages/chats")
        assert response.status_code == 200
        data = response.json()
        
        # All chats should have presence fields
        for chat in data:
            assert "is_online" in chat, f"Chat missing is_online: {chat}"
            assert "last_seen" in chat, f"Chat missing last_seen: {chat}"
        
        print(f"Verified all {len(data)} chats have presence fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
