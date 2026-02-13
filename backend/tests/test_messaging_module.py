"""
Test suite for Message Center - Phase 1: Institutional Messages
Tests the messaging/institutional endpoints for creating, listing, reading, and deleting institutional messages.
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"
TEST_SUBDOMAIN = "demosettings"


class TestMessagingModule:
    """Test suite for Message Center - Institutional Messages (Phase 1)"""
    
    token = None
    user = None
    created_message_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        if TestMessagingModule.token is None:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestMessagingModule.token = data["token"]
            TestMessagingModule.user = data["user"]
            print(f"Logged in as: {data['user']['email']} with role: {data['user']['role']}")
    
    def get_headers(self):
        return {"Authorization": f"Bearer {TestMessagingModule.token}"}
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MESSAGING STATS ENDPOINT
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_get_messaging_stats(self):
        """Test GET /api/messaging/stats - Returns correct counters"""
        response = requests.get(
            f"{BASE_URL}/api/messaging/stats",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_unread" in data, "Missing total_unread field"
        assert "institutional" in data, "Missing institutional field"
        assert "support" in data, "Missing support field"
        assert "academic" in data, "Missing academic field"
        
        # Verify types
        assert isinstance(data["total_unread"], int), "total_unread should be int"
        assert isinstance(data["institutional"], int), "institutional should be int"
        assert isinstance(data["support"], int), "support should be int"
        assert isinstance(data["academic"], int), "academic should be int"
        
        print(f"Stats: total_unread={data['total_unread']}, institutional={data['institutional']}, support={data['support']}, academic={data['academic']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # INSTITUTIONAL MESSAGES - CREATE
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_02_create_institutional_message_normal_priority(self):
        """Test POST /api/messaging/institutional - Create message with normal priority"""
        payload = {
            "title": f"TEST_Comunicado Normal {uuid.uuid4().hex[:6]}",
            "content": "Este es un comunicado de prueba con prioridad normal.",
            "priority": "normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/institutional",
            json=payload,
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "data" in data, "Missing data field in response"
        message = data["data"]
        
        # Verify message structure
        assert "id" in message, "Missing id field"
        assert message["title"] == payload["title"], "Title mismatch"
        assert message["content"] == payload["content"], "Content mismatch"
        assert message["priority"] == "normal", "Priority should be normal"
        assert "author_name" in message, "Missing author_name"
        assert "created_at" in message, "Missing created_at"
        
        TestMessagingModule.created_message_id = message["id"]
        print(f"Created message with ID: {message['id']}")
    
    def test_03_create_institutional_message_important_priority(self):
        """Test POST /api/messaging/institutional - Create message with important priority"""
        payload = {
            "title": f"TEST_Comunicado Importante {uuid.uuid4().hex[:6]}",
            "content": "Este es un comunicado de prueba con prioridad importante.",
            "priority": "important"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/institutional",
            json=payload,
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        message = data["data"]
        assert message["priority"] == "important", "Priority should be important"
        print(f"Created important message with ID: {message['id']}")
    
    def test_04_create_institutional_message_urgent_priority(self):
        """Test POST /api/messaging/institutional - Create message with urgent priority"""
        payload = {
            "title": f"TEST_Comunicado Urgente {uuid.uuid4().hex[:6]}",
            "content": "Este es un comunicado de prueba con prioridad urgente.",
            "priority": "urgent"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/institutional",
            json=payload,
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        message = data["data"]
        assert message["priority"] == "urgent", "Priority should be urgent"
        print(f"Created urgent message with ID: {message['id']}")
    
    def test_05_create_institutional_message_missing_title(self):
        """Test POST /api/messaging/institutional - Missing title should fail"""
        payload = {
            "content": "Contenido sin título",
            "priority": "normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/institutional",
            json=payload,
            headers=self.get_headers()
        )
        # Should fail with 422 (validation error)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("Correctly rejected message without title")
    
    def test_06_create_institutional_message_missing_content(self):
        """Test POST /api/messaging/institutional - Missing content should fail"""
        payload = {
            "title": "Título sin contenido",
            "priority": "normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/institutional",
            json=payload,
            headers=self.get_headers()
        )
        # Should fail with 422 (validation error)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("Correctly rejected message without content")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # INSTITUTIONAL MESSAGES - LIST
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_07_get_institutional_messages(self):
        """Test GET /api/messaging/institutional - List all messages"""
        response = requests.get(
            f"{BASE_URL}/api/messaging/institutional",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "messages" in data, "Missing messages field"
        assert "unread_count" in data, "Missing unread_count field"
        assert "total_count" in data, "Missing total_count field"
        
        messages = data["messages"]
        assert isinstance(messages, list), "messages should be a list"
        
        # Verify we have at least the messages we created
        assert len(messages) >= 3, f"Expected at least 3 messages, got {len(messages)}"
        
        # Verify message structure
        if messages:
            msg = messages[0]
            assert "id" in msg, "Missing id in message"
            assert "title" in msg, "Missing title in message"
            assert "content" in msg, "Missing content in message"
            assert "priority" in msg, "Missing priority in message"
            assert "author_name" in msg, "Missing author_name in message"
            assert "created_at" in msg, "Missing created_at in message"
            assert "is_read" in msg, "Missing is_read in message"
        
        print(f"Found {len(messages)} messages, {data['unread_count']} unread")
    
    def test_08_get_institutional_messages_with_limit(self):
        """Test GET /api/messaging/institutional?limit=2 - Limit results"""
        response = requests.get(
            f"{BASE_URL}/api/messaging/institutional?limit=2",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        messages = data["messages"]
        assert len(messages) <= 2, f"Expected max 2 messages, got {len(messages)}"
        print(f"Limit=2 returned {len(messages)} messages")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # INSTITUTIONAL MESSAGES - MARK AS READ
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_09_mark_message_as_read(self):
        """Test POST /api/messaging/institutional/{message_id}/read - Mark as read"""
        # First get a message ID
        response = requests.get(
            f"{BASE_URL}/api/messaging/institutional",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        messages = response.json()["messages"]
        
        if not messages:
            pytest.skip("No messages to mark as read")
        
        message_id = messages[0]["id"]
        
        # Mark as read
        response = requests.post(
            f"{BASE_URL}/api/messaging/institutional/{message_id}/read",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify it's now marked as read
        response = requests.get(
            f"{BASE_URL}/api/messaging/institutional",
            headers=self.get_headers()
        )
        messages = response.json()["messages"]
        marked_msg = next((m for m in messages if m["id"] == message_id), None)
        
        assert marked_msg is not None, "Message not found after marking as read"
        assert marked_msg["is_read"] == True, "Message should be marked as read"
        print(f"Successfully marked message {message_id} as read")
    
    def test_10_mark_nonexistent_message_as_read(self):
        """Test POST /api/messaging/institutional/{message_id}/read - Non-existent message"""
        fake_id = str(uuid.uuid4())
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/institutional/{fake_id}/read",
            headers=self.get_headers()
        )
        # Should still return 200 (idempotent operation)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("Marking non-existent message as read handled gracefully")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # INSTITUTIONAL MESSAGES - DELETE
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_11_delete_institutional_message(self):
        """Test DELETE /api/messaging/institutional/{message_id} - Delete message"""
        # First create a message to delete
        payload = {
            "title": f"TEST_ToDelete {uuid.uuid4().hex[:6]}",
            "content": "Este mensaje será eliminado.",
            "priority": "normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/institutional",
            json=payload,
            headers=self.get_headers()
        )
        assert response.status_code == 200
        message_id = response.json()["data"]["id"]
        
        # Delete the message
        response = requests.delete(
            f"{BASE_URL}/api/messaging/institutional/{message_id}",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify it's no longer in the list (status should be 'deleted')
        response = requests.get(
            f"{BASE_URL}/api/messaging/institutional",
            headers=self.get_headers()
        )
        messages = response.json()["messages"]
        deleted_msg = next((m for m in messages if m["id"] == message_id), None)
        
        # Message should not appear in active messages
        assert deleted_msg is None, "Deleted message should not appear in list"
        print(f"Successfully deleted message {message_id}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STATS VERIFICATION AFTER OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_12_verify_stats_after_operations(self):
        """Test GET /api/messaging/stats - Verify stats update correctly"""
        response = requests.get(
            f"{BASE_URL}/api/messaging/stats",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Stats should reflect our operations
        assert data["total_unread"] >= 0, "total_unread should be >= 0"
        assert data["institutional"] >= 0, "institutional should be >= 0"
        
        print(f"Final stats: total_unread={data['total_unread']}, institutional={data['institutional']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CLEANUP - Delete test messages
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_99_cleanup_test_messages(self):
        """Cleanup - Delete all TEST_ prefixed messages"""
        response = requests.get(
            f"{BASE_URL}/api/messaging/institutional?limit=100",
            headers=self.get_headers()
        )
        if response.status_code != 200:
            print("Could not get messages for cleanup")
            return
        
        messages = response.json()["messages"]
        deleted_count = 0
        
        for msg in messages:
            if msg.get("title", "").startswith("TEST_"):
                del_response = requests.delete(
                    f"{BASE_URL}/api/messaging/institutional/{msg['id']}",
                    headers=self.get_headers()
                )
                if del_response.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleanup: Deleted {deleted_count} test messages")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
