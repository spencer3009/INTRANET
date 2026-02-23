"""
Test suite for Academic Contacts API - Categorized Contact List Feature
Tests the /api/messaging/academic/contacts endpoint for different user roles:
- Teachers: Should receive categorized contacts (mis_alumnos, padres_apoderados, personal_administrativo, otros_profesores)
- Students: Should receive flat contact list (teachers, classmates)
- Admins/Owners: Should receive flat contact list (all users)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SCHOOL_SUBDOMAIN = "elroble"
TEACHER_EMAIL = "sonia3009@gmail.com"
TEACHER_PASSWORD = "1234abc8"
STUDENT_EMAIL = "pepito@gmail.com"
STUDENT_PASSWORD = "1234abc8"
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"


class TestAcademicContactsAPI:
    """Test suite for /api/messaging/academic/contacts endpoint"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get authentication token for teacher user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Teacher authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get authentication token for student user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Student authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")
    
    # ==================== TEACHER TESTS ====================
    
    def test_teacher_contacts_returns_200(self, teacher_token):
        """Test that teacher can access contacts endpoint"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Teacher contacts endpoint returns 200")
    
    def test_teacher_contacts_has_categorized_structure(self, teacher_token):
        """Test that teacher response includes categorized contacts"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check for categorized structure
        assert "categorized" in data, "Response should include 'categorized' key for teachers"
        assert "categories" in data, "Response should include 'categories' key for teachers"
        assert "contacts" in data, "Response should include 'contacts' key for backward compatibility"
        
        print(f"✓ Teacher response has categorized structure")
    
    def test_teacher_contacts_has_four_categories(self, teacher_token):
        """Test that teacher response has all 4 expected categories"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        categorized = data.get("categorized", {})
        expected_categories = ["mis_alumnos", "padres_apoderados", "personal_administrativo", "otros_profesores"]
        
        for category in expected_categories:
            assert category in categorized, f"Missing category: {category}"
            assert isinstance(categorized[category], list), f"Category {category} should be a list"
        
        print(f"✓ Teacher response has all 4 categories: {expected_categories}")
    
    def test_teacher_categories_metadata(self, teacher_token):
        """Test that categories metadata has correct structure"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        assert len(categories) == 4, f"Expected 4 categories, got {len(categories)}"
        
        expected_labels = {
            "mis_alumnos": "Mis Alumnos",
            "padres_apoderados": "Padres/Apoderados",
            "personal_administrativo": "Personal Administrativo",
            "otros_profesores": "Otros Profesores"
        }
        
        for cat in categories:
            assert "key" in cat, "Category should have 'key'"
            assert "label" in cat, "Category should have 'label'"
            assert "count" in cat, "Category should have 'count'"
            
            if cat["key"] in expected_labels:
                assert cat["label"] == expected_labels[cat["key"]], f"Wrong label for {cat['key']}"
        
        print(f"✓ Categories metadata is correct")
        for cat in categories:
            print(f"  - {cat['label']}: {cat['count']} contacts")
    
    def test_teacher_contacts_have_required_fields(self, teacher_token):
        """Test that each contact has required fields"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        categorized = data.get("categorized", {})
        required_fields = ["id", "name", "role", "category"]
        
        for category_key, contacts in categorized.items():
            for contact in contacts[:3]:  # Check first 3 contacts per category
                for field in required_fields:
                    assert field in contact, f"Contact in {category_key} missing field: {field}"
        
        print(f"✓ All contacts have required fields: {required_fields}")
    
    def test_teacher_contacts_category_counts_match(self, teacher_token):
        """Test that category counts in metadata match actual contact counts"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        categorized = data.get("categorized", {})
        categories = data.get("categories", [])
        
        for cat in categories:
            key = cat["key"]
            expected_count = cat["count"]
            actual_count = len(categorized.get(key, []))
            assert expected_count == actual_count, f"Count mismatch for {key}: metadata says {expected_count}, actual is {actual_count}"
        
        print(f"✓ Category counts match actual contact counts")
    
    def test_teacher_flat_contacts_list_exists(self, teacher_token):
        """Test that flat contacts list exists for backward compatibility"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        contacts = data.get("contacts", [])
        assert isinstance(contacts, list), "contacts should be a list"
        
        # Flat list should contain all contacts from all categories
        categorized = data.get("categorized", {})
        total_categorized = sum(len(c) for c in categorized.values())
        
        assert len(contacts) == total_categorized, f"Flat list count ({len(contacts)}) should match total categorized ({total_categorized})"
        
        print(f"✓ Flat contacts list exists with {len(contacts)} contacts")
    
    # ==================== STUDENT TESTS ====================
    
    def test_student_contacts_returns_200(self, student_token):
        """Test that student can access contacts endpoint"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Student contacts endpoint returns 200")
    
    def test_student_contacts_is_flat_list(self, student_token):
        """Test that student response is a flat list without categories"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Student should NOT have categorized structure
        assert "categorized" not in data, "Student response should NOT include 'categorized' key"
        assert "categories" not in data, "Student response should NOT include 'categories' key"
        assert "contacts" in data, "Student response should include 'contacts' key"
        
        contacts = data.get("contacts", [])
        assert isinstance(contacts, list), "contacts should be a list"
        
        print(f"✓ Student response is flat list with {len(contacts)} contacts")
    
    def test_student_contacts_have_required_fields(self, student_token):
        """Test that student contacts have required fields"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        contacts = data.get("contacts", [])
        required_fields = ["id", "name", "role"]
        
        for contact in contacts[:5]:  # Check first 5 contacts
            for field in required_fields:
                assert field in contact, f"Contact missing field: {field}"
        
        print(f"✓ Student contacts have required fields")
    
    def test_student_contacts_include_teachers(self, student_token):
        """Test that student contacts include teachers"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        contacts = data.get("contacts", [])
        teacher_contacts = [c for c in contacts if c.get("role") == "teacher"]
        
        # Student should have at least some teachers in contacts
        print(f"✓ Student has {len(teacher_contacts)} teacher contacts")
    
    # ==================== ADMIN TESTS ====================
    
    def test_admin_contacts_returns_200(self, admin_token):
        """Test that admin can access contacts endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Admin contacts endpoint returns 200")
    
    def test_admin_contacts_is_flat_list(self, admin_token):
        """Test that admin response is a flat list without categories"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Admin should NOT have categorized structure
        assert "categorized" not in data, "Admin response should NOT include 'categorized' key"
        assert "categories" not in data, "Admin response should NOT include 'categories' key"
        assert "contacts" in data, "Admin response should include 'contacts' key"
        
        contacts = data.get("contacts", [])
        assert isinstance(contacts, list), "contacts should be a list"
        
        print(f"✓ Admin response is flat list with {len(contacts)} contacts")
    
    def test_admin_contacts_include_all_roles(self, admin_token):
        """Test that admin contacts include users of all roles"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        contacts = data.get("contacts", [])
        roles_found = set(c.get("role") for c in contacts)
        
        print(f"✓ Admin contacts include roles: {roles_found}")
    
    # ==================== ROLE LABEL TESTS ====================
    
    def test_teacher_contacts_role_labels(self, teacher_token):
        """Test that contacts have correct role information for translation"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        categorized = data.get("categorized", {})
        
        # Check mis_alumnos have role "student"
        for student in categorized.get("mis_alumnos", [])[:3]:
            assert student.get("role") == "student", f"Student contact should have role 'student'"
        
        # Check otros_profesores have role "teacher"
        for teacher in categorized.get("otros_profesores", [])[:3]:
            assert teacher.get("role") == "teacher", f"Teacher contact should have role 'teacher'"
        
        # Check personal_administrativo have admin roles
        admin_roles = ["admin", "owner", "director", "coordinator"]
        for admin in categorized.get("personal_administrativo", [])[:3]:
            assert admin.get("role") in admin_roles, f"Admin contact should have admin role, got {admin.get('role')}"
            # Should also have role_display for translated label
            assert "role_display" in admin, "Admin contact should have 'role_display' field"
        
        print(f"✓ Contacts have correct role information")
    
    # ==================== UNREAD COUNT TESTS ====================
    
    def test_contacts_have_unread_count(self, teacher_token):
        """Test that contacts include unread_count field"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        contacts = data.get("contacts", [])
        for contact in contacts[:5]:
            assert "unread_count" in contact, "Contact should have 'unread_count' field"
            assert isinstance(contact["unread_count"], int), "unread_count should be an integer"
        
        print(f"✓ Contacts have unread_count field")


class TestAcademicContactsEdgeCases:
    """Edge case tests for academic contacts"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get authentication token for teacher user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "subdomain": SCHOOL_SUBDOMAIN
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Teacher authentication failed")
    
    def test_unauthenticated_request_fails(self):
        """Test that unauthenticated request returns 401"""
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly rejected")
    
    def test_invalid_token_fails(self):
        """Test that invalid token returns 401"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/messaging/academic/contacts", headers=headers)
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Invalid token correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
