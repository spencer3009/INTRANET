"""
Psychology Messages Module - Phase 2 Backend Tests
Tests for messaging between psychologists and parents, plus message templates
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PSYCHOLOGIST_EMAIL = "ana.garcia@elroble.edu"
PSYCHOLOGIST_PASSWORD = "Psico123!"
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"

# Known IDs from context
STUDENT_ID = "4d30c475-c1cf-42d1-9485-620b556ecf72"  # Magno Eduardo Calle Marquez
PARENT_ID = "a12969b9-711b-4cfb-8e12-9bbb0c20f390"   # Maria Peres Garcia
PSYCHOLOGIST_ID = "78f74873-43d9-4d43-a95f-4b80be2d6a90"


class TestPsychologyMessagesModule:
    """Test suite for Psychology Messages endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.psych_token = None
        self.admin_token = None
        self.created_template_id = None
        self.created_message_id = None
    
    def login_psychologist(self):
        """Login as psychologist and get token"""
        if self.psych_token:
            return self.psych_token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PSYCHOLOGIST_EMAIL,
            "password": PSYCHOLOGIST_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        assert response.status_code == 200, f"Psychologist login failed: {response.text}"
        data = response.json()
        self.psych_token = data.get("token")
        return self.psych_token
    
    def login_admin(self):
        """Login as admin and get token"""
        if self.admin_token:
            return self.admin_token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.admin_token = data.get("token")
        return self.admin_token
    
    def psych_headers(self):
        """Get headers with psychologist auth"""
        token = self.login_psychologist()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def admin_headers(self):
        """Get headers with admin auth"""
        token = self.login_admin()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # ═══════════════════════════════════════════════════════════════════════════
    # PSYCHOLOGIST MESSAGE ENDPOINTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_psychologist_login(self):
        """Test psychologist can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PSYCHOLOGIST_EMAIL,
            "password": PSYCHOLOGIST_PASSWORD,
            "subdomain": SUBDOMAIN
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") == "psicologo"
        print("PASS: Psychologist login successful")
    
    def test_02_get_unread_count(self):
        """Test GET /api/v1/psychology/messages/unread-count"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/messages/unread-count",
            headers=self.psych_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        print(f"PASS: Unread count = {data['unread_count']}")
    
    def test_03_list_conversations(self):
        """Test GET /api/v1/psychology/messages/conversations"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/messages/conversations",
            headers=self.psych_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        assert isinstance(data["conversations"], list)
        print(f"PASS: Found {len(data['conversations'])} conversations")
        
        # If there are conversations, verify structure
        if data["conversations"]:
            convo = data["conversations"][0]
            assert "conversation_id" in convo
            assert "parent_name" in convo
            assert "student_name" in convo
            assert "last_message_preview" in convo
            print(f"  - First conversation: {convo.get('parent_name')} re: {convo.get('student_name')}")
    
    def test_04_list_conversations_with_search(self):
        """Test GET /api/v1/psychology/messages/conversations with search"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/messages/conversations?search=Maria",
            headers=self.psych_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        print(f"PASS: Search returned {len(data['conversations'])} conversations")
    
    def test_05_get_student_parents(self):
        """Test GET /api/v1/psychology/students/{id}/parents"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/students/{STUDENT_ID}/parents",
            headers=self.psych_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "student" in data
        assert "parents" in data
        assert isinstance(data["parents"], list)
        print(f"PASS: Student has {len(data['parents'])} parent(s)")
        
        if data["parents"]:
            parent = data["parents"][0]
            assert "id" in parent
            assert "name" in parent
            print(f"  - Parent: {parent.get('name')} {parent.get('last_name')}")
    
    def test_06_get_student_parents_not_found(self):
        """Test GET /api/v1/psychology/students/{id}/parents with invalid student"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/students/invalid-student-id/parents",
            headers=self.psych_headers()
        )
        assert response.status_code == 404
        print("PASS: Returns 404 for invalid student")
    
    def test_07_send_message_to_parent(self):
        """Test POST /api/v1/psychology/messages - Send message from psychologist"""
        test_body = f"TEST_Mensaje de prueba {uuid.uuid4().hex[:8]}"
        response = self.session.post(
            f"{BASE_URL}/api/v1/psychology/messages",
            headers=self.psych_headers(),
            json={
                "student_id": STUDENT_ID,
                "to_user_id": PARENT_ID,
                "subject": "Prueba de comunicacion",
                "body": test_body,
                "requires_response": True,
                "is_urgent": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "data" in data
        msg = data["data"]
        assert msg["body"] == test_body
        assert msg["from_role"] == "psicologo"
        assert msg["to_role"] == "padre"
        assert msg["requires_response"] == True
        self.__class__.created_message_id = msg["id"]
        self.__class__.created_conversation_id = msg["conversation_id"]
        print(f"PASS: Message sent, ID: {msg['id']}")
    
    def test_08_send_message_invalid_parent(self):
        """Test POST /api/v1/psychology/messages with invalid parent"""
        response = self.session.post(
            f"{BASE_URL}/api/v1/psychology/messages",
            headers=self.psych_headers(),
            json={
                "student_id": STUDENT_ID,
                "to_user_id": "invalid-parent-id",
                "body": "Test message"
            }
        )
        assert response.status_code == 404
        print("PASS: Returns 404 for invalid parent")
    
    def test_09_get_conversation_messages(self):
        """Test GET /api/v1/psychology/messages/conversations/{id}"""
        # First get conversations to find a valid conversation_id
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/messages/conversations",
            headers=self.psych_headers()
        )
        assert response.status_code == 200
        convos = response.json().get("conversations", [])
        
        if convos:
            conv_id = convos[0]["conversation_id"]
            response = self.session.get(
                f"{BASE_URL}/api/v1/psychology/messages/conversations/{conv_id}",
                headers=self.psych_headers()
            )
            assert response.status_code == 200
            data = response.json()
            assert "messages" in data
            assert "total" in data
            assert "page" in data
            print(f"PASS: Conversation has {data['total']} messages")
            
            if data["messages"]:
                msg = data["messages"][0]
                assert "id" in msg
                assert "body" in msg
                assert "from_role" in msg
        else:
            print("SKIP: No conversations to test")
    
    def test_10_mark_message_as_read(self):
        """Test PUT /api/v1/psychology/messages/{id}/read"""
        # This endpoint marks messages TO the psychologist as read
        # We need a message sent TO the psychologist (from parent)
        # For now, test with a non-existent message to verify endpoint works
        response = self.session.put(
            f"{BASE_URL}/api/v1/psychology/messages/non-existent-id/read",
            headers=self.psych_headers()
        )
        # Should return 404 for non-existent message
        assert response.status_code == 404
        print("PASS: Mark read returns 404 for non-existent message")

    # ═══════════════════════════════════════════════════════════════════════════
    # MESSAGE TEMPLATES
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_11_list_templates(self):
        """Test GET /api/v1/psychology/templates"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/templates",
            headers=self.psych_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        assert isinstance(data["templates"], list)
        print(f"PASS: Found {len(data['templates'])} templates")
    
    def test_12_list_templates_by_category(self):
        """Test GET /api/v1/psychology/templates with category filter"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/templates?category=citacion",
            headers=self.psych_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        print(f"PASS: Category filter returned {len(data['templates'])} templates")
    
    def test_13_create_template(self):
        """Test POST /api/v1/psychology/templates"""
        test_name = f"TEST_Template_{uuid.uuid4().hex[:8]}"
        response = self.session.post(
            f"{BASE_URL}/api/v1/psychology/templates",
            headers=self.psych_headers(),
            json={
                "name": test_name,
                "subject": "Asunto de prueba",
                "body": "Estimado/a {{nombre_padre}}, le informamos sobre {{nombre_estudiante}}...",
                "category": "informe",
                "is_shared": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "template" in data
        tpl = data["template"]
        assert tpl["name"] == test_name
        assert tpl["category"] == "informe"
        assert "id" in tpl
        self.__class__.created_template_id = tpl["id"]
        print(f"PASS: Template created, ID: {tpl['id']}")
    
    def test_14_update_template(self):
        """Test PUT /api/v1/psychology/templates/{id}"""
        if not hasattr(self.__class__, 'created_template_id') or not self.__class__.created_template_id:
            pytest.skip("No template created to update")
        
        response = self.session.put(
            f"{BASE_URL}/api/v1/psychology/templates/{self.__class__.created_template_id}",
            headers=self.psych_headers(),
            json={
                "name": "TEST_Updated_Template",
                "body": "Contenido actualizado"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("PASS: Template updated")
    
    def test_15_update_template_not_owner(self):
        """Test PUT /api/v1/psychology/templates/{id} - non-owner cannot update"""
        # Admin is not the owner of the template
        if not hasattr(self.__class__, 'created_template_id') or not self.__class__.created_template_id:
            pytest.skip("No template created to test")
        
        # This should fail because admin is not the psychologist who created it
        # But admin doesn't have psicologo role, so it will return 403 for role check
        response = self.session.put(
            f"{BASE_URL}/api/v1/psychology/templates/{self.__class__.created_template_id}",
            headers=self.admin_headers(),
            json={"name": "Hacked"}
        )
        assert response.status_code == 403
        print("PASS: Non-psychologist cannot update template")
    
    def test_16_delete_template(self):
        """Test DELETE /api/v1/psychology/templates/{id}"""
        if not hasattr(self.__class__, 'created_template_id') or not self.__class__.created_template_id:
            pytest.skip("No template created to delete")
        
        response = self.session.delete(
            f"{BASE_URL}/api/v1/psychology/templates/{self.__class__.created_template_id}",
            headers=self.psych_headers()
        )
        assert response.status_code == 200
        print("PASS: Template deleted")
    
    def test_17_delete_template_not_found(self):
        """Test DELETE /api/v1/psychology/templates/{id} - not found"""
        response = self.session.delete(
            f"{BASE_URL}/api/v1/psychology/templates/non-existent-id",
            headers=self.psych_headers()
        )
        assert response.status_code == 404
        print("PASS: Delete returns 404 for non-existent template")

    # ═══════════════════════════════════════════════════════════════════════════
    # PARENT MESSAGE ENDPOINTS (using admin to check if parent exists)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_18_parent_endpoints_require_parent_role(self):
        """Test parent endpoints require parent role"""
        # Psychologist cannot access parent endpoints
        response = self.session.get(
            f"{BASE_URL}/api/v1/parents/psychology-messages",
            headers=self.psych_headers()
        )
        assert response.status_code == 403
        print("PASS: Parent endpoints require parent role")
    
    def test_19_parent_unread_count_requires_parent_role(self):
        """Test GET /api/v1/parents/psychology-messages/unread-count requires parent role"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/parents/psychology-messages/unread-count",
            headers=self.psych_headers()
        )
        assert response.status_code == 403
        print("PASS: Parent unread count requires parent role")
    
    def test_20_parent_reply_requires_parent_role(self):
        """Test POST /api/v1/parents/psychology-messages requires parent role"""
        response = self.session.post(
            f"{BASE_URL}/api/v1/parents/psychology-messages",
            headers=self.psych_headers(),
            json={
                "conversation_id": "test-conv-id",
                "body": "Test reply"
            }
        )
        assert response.status_code == 403
        print("PASS: Parent reply requires parent role")

    # ═══════════════════════════════════════════════════════════════════════════
    # AUTHORIZATION TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_21_unauthenticated_access_denied(self):
        """Test unauthenticated access is denied"""
        response = self.session.get(f"{BASE_URL}/api/v1/psychology/messages/conversations")
        assert response.status_code in [401, 403]
        print("PASS: Unauthenticated access denied")
    
    def test_22_admin_cannot_access_psych_messages(self):
        """Test admin cannot access psychologist message endpoints"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/messages/conversations",
            headers=self.admin_headers()
        )
        assert response.status_code == 403
        print("PASS: Admin cannot access psychologist messages")
    
    def test_23_admin_cannot_send_psych_message(self):
        """Test admin cannot send message as psychologist"""
        response = self.session.post(
            f"{BASE_URL}/api/v1/psychology/messages",
            headers=self.admin_headers(),
            json={
                "student_id": STUDENT_ID,
                "to_user_id": PARENT_ID,
                "body": "Test"
            }
        )
        assert response.status_code == 403
        print("PASS: Admin cannot send psychologist message")
    
    def test_24_admin_cannot_access_templates(self):
        """Test admin cannot access psychologist templates"""
        response = self.session.get(
            f"{BASE_URL}/api/v1/psychology/templates",
            headers=self.admin_headers()
        )
        assert response.status_code == 403
        print("PASS: Admin cannot access templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
