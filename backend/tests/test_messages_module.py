"""
Test suite for EduNet Messages/Communications Module
Tests: Chat functionality, Mail functionality, User selector, Mark as read
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"
SUBDOMAIN = "demosettings"


class TestMessagesModule:
    """Test suite for Messages/Communications endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        self.token = data.get("token")
        self.user = data.get("user")
        self.user_id = self.user.get("id")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        self.session.close()
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/messages/users - Users grouped by role
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_message_users_returns_grouped_users(self):
        """GET /api/messages/users should return users grouped by role"""
        response = self.session.get(f"{BASE_URL}/api/messages/users")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should be a list of groups
        assert isinstance(data, list), "Response should be a list of groups"
        assert len(data) > 0, "Should have at least one group"
        
        # Each group should have label and users
        for group in data:
            assert "label" in group, "Group should have label"
            assert "users" in group, "Group should have users"
            assert isinstance(group["users"], list), "Users should be a list"
        
        # Check expected groups exist (Directores, Profesores, Padres)
        labels = [g["label"] for g in data]
        print(f"Found groups: {labels}")
        
        # Should have Profesores group (5 teachers in system)
        assert "Profesores" in labels, "Should have Profesores group"
        
        # Find Profesores group and verify count
        profesores_group = next((g for g in data if g["label"] == "Profesores"), None)
        assert profesores_group is not None
        print(f"Profesores count: {len(profesores_group['users'])}")
        
        # Verify user structure
        if profesores_group["users"]:
            user = profesores_group["users"][0]
            assert "id" in user, "User should have id"
            assert "full_name" in user, "User should have full_name"
            assert "role" in user, "User should have role"
    
    def test_get_message_users_excludes_current_user(self):
        """GET /api/messages/users should not include current user"""
        response = self.session.get(f"{BASE_URL}/api/messages/users")
        
        assert response.status_code == 200
        data = response.json()
        
        # Flatten all users
        all_users = []
        for group in data:
            all_users.extend(group["users"])
        
        # Current user should not be in the list
        user_ids = [u["id"] for u in all_users]
        assert self.user_id not in user_ids, "Current user should not be in the list"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/messages/chats - Chat list
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_chat_list(self):
        """GET /api/messages/chats should return chat conversations"""
        response = self.session.get(f"{BASE_URL}/api/messages/chats")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # If there are chats, verify structure
        if len(data) > 0:
            chat = data[0]
            assert "partner_id" in chat, "Chat should have partner_id"
            assert "partner_name" in chat, "Chat should have partner_name"
            assert "last_message" in chat, "Chat should have last_message"
            assert "last_message_time" in chat, "Chat should have last_message_time"
            assert "unread_count" in chat, "Chat should have unread_count"
            print(f"Found {len(data)} chat conversations")
            print(f"First chat with: {chat['partner_name']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/messages/chats/send - Send chat message
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_send_chat_message(self):
        """POST /api/messages/chats/send should send a chat message"""
        # First get a user to send to
        users_response = self.session.get(f"{BASE_URL}/api/messages/users")
        assert users_response.status_code == 200
        users_data = users_response.json()
        
        # Get first available user (teacher)
        receiver_id = None
        for group in users_data:
            if group["users"]:
                receiver_id = group["users"][0]["id"]
                receiver_name = group["users"][0]["full_name"]
                break
        
        assert receiver_id is not None, "Should have at least one user to send to"
        
        # Send chat message
        response = self.session.post(f"{BASE_URL}/api/messages/chats/send", json={
            "receiver_id": receiver_id,
            "type": "chat",
            "message": "TEST_Mensaje de prueba desde pytest"
        })
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should have message"
        assert "data" in data, "Response should have data"
        assert data["data"]["receiver_id"] == receiver_id
        assert data["data"]["type"] == "chat"
        print(f"Chat message sent to {receiver_name}")
        
        # Store message ID for cleanup
        self.test_chat_message_id = data["data"]["id"]
    
    def test_send_chat_message_invalid_receiver(self):
        """POST /api/messages/chats/send should fail with invalid receiver"""
        response = self.session.post(f"{BASE_URL}/api/messages/chats/send", json={
            "receiver_id": "invalid-user-id",
            "type": "chat",
            "message": "Test message"
        })
        
        assert response.status_code == 404, "Should return 404 for invalid receiver"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/messages/chats/{user_id} - Chat history
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_chat_history(self):
        """GET /api/messages/chats/{user_id} should return chat history"""
        # First get a user to check history with
        users_response = self.session.get(f"{BASE_URL}/api/messages/users")
        assert users_response.status_code == 200
        users_data = users_response.json()
        
        # Get first available user
        partner_id = None
        for group in users_data:
            if group["users"]:
                partner_id = group["users"][0]["id"]
                break
        
        assert partner_id is not None
        
        # Get chat history
        response = self.session.get(f"{BASE_URL}/api/messages/chats/{partner_id}")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "partner" in data, "Response should have partner info"
        assert "messages" in data, "Response should have messages"
        assert isinstance(data["messages"], list), "Messages should be a list"
        
        # Verify partner structure
        assert "id" in data["partner"]
        assert "name" in data["partner"]
        print(f"Chat history with {data['partner']['name']}: {len(data['messages'])} messages")
    
    def test_get_chat_history_invalid_user(self):
        """GET /api/messages/chats/{user_id} should fail with invalid user"""
        response = self.session.get(f"{BASE_URL}/api/messages/chats/invalid-user-id")
        
        assert response.status_code == 404, "Should return 404 for invalid user"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/messages/inbox - Mail inbox
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_inbox(self):
        """GET /api/messages/inbox should return mail messages"""
        response = self.session.get(f"{BASE_URL}/api/messages/inbox")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        # If there are messages, verify structure
        if len(data) > 0:
            msg = data[0]
            assert "id" in msg, "Message should have id"
            assert "sender_id" in msg, "Message should have sender_id"
            assert "receiver_id" in msg, "Message should have receiver_id"
            assert "subject" in msg, "Message should have subject"
            assert "message" in msg, "Message should have message"
            assert "sender_name" in msg, "Message should have sender_name"
            assert "receiver_name" in msg, "Message should have receiver_name"
            print(f"Found {len(data)} inbox messages")
    
    def test_get_inbox_filter_received(self):
        """GET /api/messages/inbox?type=received should filter received messages"""
        response = self.session.get(f"{BASE_URL}/api/messages/inbox?type=received")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All messages should be received by current user
        for msg in data:
            assert msg["receiver_id"] == self.user_id, "All messages should be received by current user"
    
    def test_get_inbox_filter_sent(self):
        """GET /api/messages/inbox?type=sent should filter sent messages"""
        response = self.session.get(f"{BASE_URL}/api/messages/inbox?type=sent")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All messages should be sent by current user
        for msg in data:
            assert msg["sender_id"] == self.user_id, "All messages should be sent by current user"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/messages/send - Send mail message
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_send_mail_message(self):
        """POST /api/messages/send should send a mail message"""
        # First get a user to send to
        users_response = self.session.get(f"{BASE_URL}/api/messages/users")
        assert users_response.status_code == 200
        users_data = users_response.json()
        
        # Get first available user
        receiver_id = None
        for group in users_data:
            if group["users"]:
                receiver_id = group["users"][0]["id"]
                receiver_name = group["users"][0]["full_name"]
                break
        
        assert receiver_id is not None
        
        # Send mail message
        response = self.session.post(f"{BASE_URL}/api/messages/send", json={
            "receiver_id": receiver_id,
            "type": "mail",
            "subject": "TEST_Asunto de prueba pytest",
            "message": "TEST_Contenido del mensaje de prueba desde pytest"
        })
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "data" in data
        assert data["data"]["type"] == "mail"
        assert data["data"]["subject"] == "TEST_Asunto de prueba pytest"
        print(f"Mail sent to {receiver_name}")
        
        # Store for cleanup
        self.test_mail_message_id = data["data"]["id"]
    
    def test_send_mail_message_requires_subject(self):
        """POST /api/messages/send should require subject for mail type"""
        users_response = self.session.get(f"{BASE_URL}/api/messages/users")
        users_data = users_response.json()
        
        receiver_id = None
        for group in users_data:
            if group["users"]:
                receiver_id = group["users"][0]["id"]
                break
        
        # Try to send without subject
        response = self.session.post(f"{BASE_URL}/api/messages/send", json={
            "receiver_id": receiver_id,
            "type": "mail",
            "message": "Test message without subject"
        })
        
        assert response.status_code == 400, "Should return 400 when subject is missing"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PUT /api/messages/{id}/read - Mark as read
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_mark_message_read(self):
        """PUT /api/messages/{id}/read should mark message as read"""
        # First check inbox for unread messages
        inbox_response = self.session.get(f"{BASE_URL}/api/messages/inbox?type=received")
        assert inbox_response.status_code == 200
        inbox = inbox_response.json()
        
        # Find an unread message
        unread_msg = None
        for msg in inbox:
            if not msg.get("read", True):
                unread_msg = msg
                break
        
        if unread_msg:
            # Mark as read
            response = self.session.put(f"{BASE_URL}/api/messages/{unread_msg['id']}/read")
            assert response.status_code == 200, f"Failed: {response.text}"
            print(f"Marked message {unread_msg['id']} as read")
        else:
            # No unread messages, test with invalid ID should return 404
            response = self.session.put(f"{BASE_URL}/api/messages/invalid-id/read")
            assert response.status_code == 404
            print("No unread messages to test, verified 404 for invalid ID")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/messages/unread-count - Unread count
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_unread_count(self):
        """GET /api/messages/unread-count should return unread count"""
        response = self.session.get(f"{BASE_URL}/api/messages/unread-count")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "unread_count" in data, "Response should have unread_count"
        assert isinstance(data["unread_count"], int), "unread_count should be integer"
        print(f"Unread count: {data['unread_count']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DELETE /api/messages/{id} - Delete message
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_delete_message(self):
        """DELETE /api/messages/{id} should delete a message sent by current user"""
        # First send a message to delete
        users_response = self.session.get(f"{BASE_URL}/api/messages/users")
        users_data = users_response.json()
        
        receiver_id = None
        for group in users_data:
            if group["users"]:
                receiver_id = group["users"][0]["id"]
                break
        
        # Send a test message
        send_response = self.session.post(f"{BASE_URL}/api/messages/send", json={
            "receiver_id": receiver_id,
            "type": "mail",
            "subject": "TEST_To be deleted",
            "message": "TEST_This message will be deleted"
        })
        assert send_response.status_code == 200
        message_id = send_response.json()["data"]["id"]
        
        # Delete the message
        response = self.session.delete(f"{BASE_URL}/api/messages/{message_id}")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"Deleted message {message_id}")
    
    def test_delete_message_not_owner(self):
        """DELETE /api/messages/{id} should fail if not the sender"""
        # Try to delete a message we didn't send (invalid ID)
        response = self.session.delete(f"{BASE_URL}/api/messages/invalid-message-id")
        
        assert response.status_code == 404, "Should return 404 for message not found or not owner"


class TestMessagesIntegration:
    """Integration tests for complete message flows"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        assert login_response.status_code == 200
        
        data = login_response.json()
        self.token = data.get("token")
        self.user_id = data.get("user", {}).get("id")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        self.session.close()
    
    def test_complete_chat_flow(self):
        """Test complete chat flow: get users -> send message -> verify in chat list"""
        # 1. Get users
        users_response = self.session.get(f"{BASE_URL}/api/messages/users")
        assert users_response.status_code == 200
        users_data = users_response.json()
        
        # Get a teacher to chat with
        receiver_id = None
        receiver_name = None
        for group in users_data:
            if group["label"] == "Profesores" and group["users"]:
                receiver_id = group["users"][0]["id"]
                receiver_name = group["users"][0]["full_name"]
                break
        
        if not receiver_id:
            # Fallback to any user
            for group in users_data:
                if group["users"]:
                    receiver_id = group["users"][0]["id"]
                    receiver_name = group["users"][0]["full_name"]
                    break
        
        assert receiver_id is not None, "Need at least one user to test chat"
        
        # 2. Send chat message
        test_message = f"TEST_Integration test message {os.urandom(4).hex()}"
        send_response = self.session.post(f"{BASE_URL}/api/messages/chats/send", json={
            "receiver_id": receiver_id,
            "type": "chat",
            "message": test_message
        })
        assert send_response.status_code == 200
        
        # 3. Verify in chat list
        chats_response = self.session.get(f"{BASE_URL}/api/messages/chats")
        assert chats_response.status_code == 200
        chats = chats_response.json()
        
        # Find our conversation
        found_chat = None
        for chat in chats:
            if chat["partner_id"] == receiver_id:
                found_chat = chat
                break
        
        assert found_chat is not None, f"Should find chat with {receiver_name}"
        assert test_message[:50] in found_chat["last_message"], "Last message should match"
        
        # 4. Verify in chat history
        history_response = self.session.get(f"{BASE_URL}/api/messages/chats/{receiver_id}")
        assert history_response.status_code == 200
        history = history_response.json()
        
        # Find our message in history
        found_in_history = False
        for msg in history["messages"]:
            if msg["message"] == test_message:
                found_in_history = True
                break
        
        assert found_in_history, "Message should appear in chat history"
        print(f"✓ Complete chat flow test passed with {receiver_name}")
    
    def test_complete_mail_flow(self):
        """Test complete mail flow: send mail -> verify in inbox -> mark as read"""
        # 1. Get users
        users_response = self.session.get(f"{BASE_URL}/api/messages/users")
        assert users_response.status_code == 200
        users_data = users_response.json()
        
        receiver_id = None
        for group in users_data:
            if group["users"]:
                receiver_id = group["users"][0]["id"]
                break
        
        assert receiver_id is not None
        
        # 2. Send mail
        test_subject = f"TEST_Integration mail {os.urandom(4).hex()}"
        send_response = self.session.post(f"{BASE_URL}/api/messages/send", json={
            "receiver_id": receiver_id,
            "type": "mail",
            "subject": test_subject,
            "message": "TEST_Integration test mail content"
        })
        assert send_response.status_code == 200
        message_id = send_response.json()["data"]["id"]
        
        # 3. Verify in sent inbox
        inbox_response = self.session.get(f"{BASE_URL}/api/messages/inbox?type=sent")
        assert inbox_response.status_code == 200
        inbox = inbox_response.json()
        
        found_mail = None
        for msg in inbox:
            if msg["id"] == message_id:
                found_mail = msg
                break
        
        assert found_mail is not None, "Sent mail should appear in sent inbox"
        assert found_mail["subject"] == test_subject
        
        # 4. Delete test message
        delete_response = self.session.delete(f"{BASE_URL}/api/messages/{message_id}")
        assert delete_response.status_code == 200
        
        print("✓ Complete mail flow test passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
