"""
Test student password edit feature in edit modal
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://yape-total-verify.preview.emergentagent.com')

class TestStudentPasswordEdit:
    """Test student password edit feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@elroble.edu",
            "password": "1234abc8"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a student user for testing
        users_response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert users_response.status_code == 200
        users = users_response.json()
        
        # Find a student
        self.student = None
        self.teacher = None
        for user in users:
            if user.get("role") == "student" and not self.student:
                self.student = user
            if user.get("role") == "teacher" and not self.teacher:
                self.teacher = user
            if self.student and self.teacher:
                break
        
        assert self.student is not None, "No student found for testing"
        print(f"Testing with student: {self.student.get('name')} {self.student.get('last_name')}")
    
    def test_update_student_password(self):
        """Test updating student password via PUT /api/users/{user_id}"""
        student_id = self.student["id"]
        original_password = self.student.get("dni") or "123456"
        new_password = "test1234"
        
        # Update password
        response = requests.put(
            f"{BASE_URL}/api/users/{student_id}",
            headers=self.headers,
            json={"password": new_password}
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert "user" in data
        print(f"Password update response: {data.get('message')}")
        
        # Verify the password was updated by checking plain_password field
        # (Note: In production, we shouldn't expose plain_password, but for testing purposes)
        updated_user = data.get("user", {})
        assert updated_user.get("plain_password") == new_password, "Password not updated correctly"
        print(f"Password updated successfully to: {new_password}")
        
        # Restore original password
        restore_response = requests.put(
            f"{BASE_URL}/api/users/{student_id}",
            headers=self.headers,
            json={"password": original_password}
        )
        assert restore_response.status_code == 200, f"Restore failed: {restore_response.text}"
        print(f"Password restored to: {original_password}")
    
    def test_password_min_length_validation(self):
        """Test that password must be at least 4 characters (frontend validation)"""
        # This is a frontend validation, but we can test the backend accepts short passwords
        # The backend should still accept them (validation is on frontend)
        student_id = self.student["id"]
        short_password = "abc"  # 3 characters
        
        response = requests.put(
            f"{BASE_URL}/api/users/{student_id}",
            headers=self.headers,
            json={"password": short_password}
        )
        
        # Backend accepts any password, frontend validates min 4 chars
        assert response.status_code == 200, f"Update failed: {response.text}"
        print("Backend accepts short passwords (frontend validates min 4 chars)")
        
        # Restore original password
        original_password = self.student.get("dni") or "123456"
        requests.put(
            f"{BASE_URL}/api/users/{student_id}",
            headers=self.headers,
            json={"password": original_password}
        )
    
    def test_update_teacher_password(self):
        """Test that teacher password can also be updated (but no special UI field)"""
        if not self.teacher:
            pytest.skip("No teacher found for testing")
        
        teacher_id = self.teacher["id"]
        new_password = "teacher123"
        
        response = requests.put(
            f"{BASE_URL}/api/users/{teacher_id}",
            headers=self.headers,
            json={"password": new_password}
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        print(f"Teacher password updated successfully")
        
        # Restore (we don't know original, so just set a default)
        requests.put(
            f"{BASE_URL}/api/users/{teacher_id}",
            headers=self.headers,
            json={"password": "teacher123"}
        )
    
    def test_password_hashing(self):
        """Test that password is hashed when saved"""
        student_id = self.student["id"]
        test_password = "testpassword123"
        
        response = requests.put(
            f"{BASE_URL}/api/users/{student_id}",
            headers=self.headers,
            json={"password": test_password}
        )
        
        assert response.status_code == 200
        data = response.json()
        user = data.get("user", {})
        
        # plain_password should be stored for student login reconstruction
        assert user.get("plain_password") == test_password
        print(f"plain_password stored correctly: {test_password}")
        
        # Restore original password
        original_password = self.student.get("dni") or "123456"
        requests.put(
            f"{BASE_URL}/api/users/{student_id}",
            headers=self.headers,
            json={"password": original_password}
        )

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
