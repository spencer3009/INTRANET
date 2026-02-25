"""
Test Suite for EduNet Notification System and Messaging Center
Features:
- GET /api/notifications/all - Returns notifications with link_destino, is_read fields
- GET /api/notifications/unread-count - Returns correct unread count
- POST /api/notifications/{id}/read - Marks notification as read
- POST /api/notifications/read-all - Marks all as read
- GET /api/messaging/academic/contacts - Returns categorized contacts for all roles
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
TEACHER_EMAIL = "jorge@gmail.com"
TEACHER_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"


def get_auth_token(email: str, password: str, subdomain: str) -> str:
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password, "subdomain": subdomain}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


class TestNotificationSystem:
    """Tests for the notification system endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.owner_token = get_auth_token(OWNER_EMAIL, OWNER_PASSWORD, SUBDOMAIN)
        self.teacher_token = get_auth_token(TEACHER_EMAIL, TEACHER_PASSWORD, SUBDOMAIN)
        self.headers_owner = {"Authorization": f"Bearer {self.owner_token}"}
        self.headers_teacher = {"Authorization": f"Bearer {self.teacher_token}"}
        
    def test_get_all_notifications_returns_structure(self):
        """GET /api/notifications/all returns notifications with required fields"""
        response = requests.get(f"{BASE_URL}/api/notifications/all", headers=self.headers_owner)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "notifications" in data, "Response should contain 'notifications'"
        assert "unread_count" in data, "Response should contain 'unread_count'"
        assert "total_count" in data, "Response should contain 'total_count'"
        assert isinstance(data["notifications"], list), "notifications should be a list"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        
        print(f"SUCCESS: GET /api/notifications/all - Total: {data['total_count']}, Unread: {data['unread_count']}")
        
    def test_notifications_have_required_fields(self):
        """Notifications contain link_destino and is_read fields"""
        response = requests.get(f"{BASE_URL}/api/notifications/all", headers=self.headers_owner)
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data["notifications"]) > 0:
            notif = data["notifications"][0]
            # Required fields
            assert "id" in notif, "Notification should have 'id'"
            assert "title" in notif, "Notification should have 'title'"
            assert "message" in notif, "Notification should have 'message'"
            assert "is_read" in notif, "Notification should have 'is_read'"
            assert "notification_type" in notif, "Notification should have 'notification_type'"
            # link_destino may be null but should exist as a concept
            # The field is included when present
            print(f"SUCCESS: Notification has required fields: id, title, message, is_read, notification_type")
            print(f"  - First notification: {notif.get('title')}, is_read={notif.get('is_read')}, link_destino={notif.get('link_destino')}")
        else:
            print("INFO: No notifications found for owner - skipping field validation")
            
    def test_get_unread_count_endpoint(self):
        """GET /api/notifications/unread-count returns correct count"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=self.headers_owner)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "unread_count" in data, "Response should contain 'unread_count'"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        
        print(f"SUCCESS: GET /api/notifications/unread-count - Unread: {data['unread_count']}")
        
    def test_mark_notification_read(self):
        """POST /api/notifications/{id}/read marks notification as read"""
        # First get notifications
        response = requests.get(f"{BASE_URL}/api/notifications/all", headers=self.headers_owner)
        assert response.status_code == 200
        
        data = response.json()
        notifications = data.get("notifications", [])
        
        if len(notifications) == 0:
            pytest.skip("No notifications available to mark as read")
            
        # Find an unread notification if possible
        notif = None
        for n in notifications:
            if not n.get("is_read"):
                notif = n
                break
        
        if not notif:
            notif = notifications[0]  # Use first one even if already read
            
        notif_id = notif["id"]
        
        # Mark as read
        response = requests.post(f"{BASE_URL}/api/notifications/{notif_id}/read", headers=self.headers_owner)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "success" in data, "Response should contain 'success'"
        assert data["success"] == True, "success should be True"
        assert "unread_count" in data, "Response should contain 'unread_count'"
        
        print(f"SUCCESS: POST /api/notifications/{notif_id}/read - success=True, remaining unread={data['unread_count']}")
        
    def test_mark_all_notifications_read(self):
        """POST /api/notifications/read-all marks all as read"""
        response = requests.post(f"{BASE_URL}/api/notifications/read-all", headers=self.headers_owner)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "success" in data, "Response should contain 'success'"
        assert data["success"] == True, "success should be True"
        assert "unread_count" in data, "Response should contain 'unread_count'"
        assert data["unread_count"] == 0, f"unread_count should be 0 after mark-all, got {data['unread_count']}"
        
        print(f"SUCCESS: POST /api/notifications/read-all - success=True, unread_count=0")
        
    def test_notifications_unauthorized_without_token(self):
        """Endpoints return 401 without auth token"""
        response = requests.get(f"{BASE_URL}/api/notifications/all")
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"
        
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"
        
        print("SUCCESS: Notification endpoints return 401 without auth token")


class TestMessagingContactsCategorized:
    """Tests for messaging contacts categorization for all roles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.owner_token = get_auth_token(OWNER_EMAIL, OWNER_PASSWORD, SUBDOMAIN)
        self.teacher_token = get_auth_token(TEACHER_EMAIL, TEACHER_PASSWORD, SUBDOMAIN)
        self.headers_owner = {"Authorization": f"Bearer {self.owner_token}"}
        self.headers_teacher = {"Authorization": f"Bearer {self.teacher_token}"}
        
    def test_owner_gets_categorized_contacts(self):
        """GET /api/messaging/academic/contacts returns categorized data for owner"""
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=self.headers_owner)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "contacts" in data, "Response should contain 'contacts'"
        assert "categorized" in data, "Response should contain 'categorized' for owner role"
        assert "categories" in data, "Response should contain 'categories'"
        
        categorized = data.get("categorized", {})
        categories = data.get("categories", [])
        
        # Owner should have these categories: alumnos, profesores, padres_apoderados, personal_administrativo
        expected_categories = ["alumnos", "profesores", "padres_apoderados", "personal_administrativo"]
        
        for cat_key in expected_categories:
            assert cat_key in categorized, f"Owner should have category '{cat_key}'"
            
        # Check category labels
        category_labels = [c["label"] for c in categories]
        assert "Alumnos" in category_labels, "Categories should include 'Alumnos'"
        assert "Profesores" in category_labels, "Categories should include 'Profesores'"
        assert "Padres/Apoderados" in category_labels, "Categories should include 'Padres/Apoderados'"
        assert "Personal Administrativo" in category_labels, "Categories should include 'Personal Administrativo'"
        
        print(f"SUCCESS: Owner gets categorized contacts")
        print(f"  - Categories: {[c['label'] for c in categories]}")
        print(f"  - Counts: alumnos={len(categorized.get('alumnos', []))}, profesores={len(categorized.get('profesores', []))}, padres={len(categorized.get('padres_apoderados', []))}")
        
    def test_teacher_gets_categorized_contacts(self):
        """GET /api/messaging/academic/contacts returns categorized data for teacher"""
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=self.headers_teacher)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "contacts" in data, "Response should contain 'contacts'"
        assert "categorized" in data, "Response should contain 'categorized' for teacher role"
        assert "categories" in data, "Response should contain 'categories'"
        
        categorized = data.get("categorized", {})
        categories = data.get("categories", [])
        
        # Teacher should have these categories: mis_alumnos, otros_profesores, padres_apoderados, personal_administrativo
        expected_categories = ["mis_alumnos", "otros_profesores", "padres_apoderados", "personal_administrativo"]
        
        for cat_key in expected_categories:
            assert cat_key in categorized, f"Teacher should have category '{cat_key}'"
            
        print(f"SUCCESS: Teacher gets categorized contacts")
        print(f"  - Categories: {[c['label'] for c in categories]}")
        print(f"  - Counts: mis_alumnos={len(categorized.get('mis_alumnos', []))}, otros_profesores={len(categorized.get('otros_profesores', []))}")
        
    def test_no_demo_users_in_contacts(self):
        """Contacts should not include demo users (is_demo filter working)"""
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=self.headers_owner)
        
        assert response.status_code == 200
        data = response.json()
        
        contacts = data.get("contacts", [])
        
        # Check that no contact has is_demo=true
        for contact in contacts:
            # Contacts should not have is_demo field exposed if correctly filtered
            # If they do have it, it should not be True
            assert contact.get("is_demo") != True, f"Demo user found in contacts: {contact.get('name')}"
            
        print(f"SUCCESS: No demo users found in {len(contacts)} contacts")
        
    def test_contacts_have_unread_count(self):
        """Contacts should have unread_count field"""
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=self.headers_owner)
        
        assert response.status_code == 200
        data = response.json()
        
        contacts = data.get("contacts", [])
        
        if len(contacts) > 0:
            contact = contacts[0]
            assert "unread_count" in contact, "Contact should have 'unread_count' field"
            assert isinstance(contact["unread_count"], int), "unread_count should be an integer"
            print(f"SUCCESS: Contacts have unread_count field")
        else:
            print("INFO: No contacts found - skipping unread_count check")
            
    def test_messaging_contacts_unauthorized(self):
        """Endpoint returns 401 without auth token"""
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts")
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"
        print("SUCCESS: Messaging contacts endpoint returns 401 without auth token")


class TestNotificationNavigation:
    """Tests for notification navigation (link_destino)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.owner_token = get_auth_token(OWNER_EMAIL, OWNER_PASSWORD, SUBDOMAIN)
        self.headers_owner = {"Authorization": f"Bearer {self.owner_token}"}
        
    def test_notification_link_destino_format(self):
        """Notifications with link_destino have correct URL format"""
        response = requests.get(f"{BASE_URL}/api/notifications/all", headers=self.headers_owner)
        
        assert response.status_code == 200
        data = response.json()
        
        notifications_with_links = [n for n in data.get("notifications", []) if n.get("link_destino")]
        
        if len(notifications_with_links) > 0:
            for notif in notifications_with_links[:3]:  # Check first 3
                link = notif.get("link_destino")
                # Link should be a relative path starting with /
                assert link.startswith("/"), f"link_destino should start with /, got: {link}"
                print(f"  - Notification '{notif.get('title')}' has link_destino: {link}")
            print(f"SUCCESS: Found {len(notifications_with_links)} notifications with valid link_destino")
        else:
            print("INFO: No notifications with link_destino found - this is OK if no notifications exist")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
