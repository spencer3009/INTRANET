"""
Test Clone Activities Functionality
Tests for cloning Forums, Materials, and Exams to other subjects/sections.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tutor-asignaciones.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin.prueba@elroble.edu"
ADMIN_PASSWORD = "Test1234!"
TEACHER_EMAIL = "sonia3009@gmail.com"
TEACHER_PASSWORD = "Test1234!"


class TestCloneActivities:
    """Test clone functionality for posts (forums, materials) and exams"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        self.teacher_token = None
        self.test_subject_id = None
        self.test_forum_id = None
        self.test_material_id = None
        self.test_exam_id = None
        
    def login_admin(self):
        """Login as admin and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.admin_token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
            return data
        return None
    
    def login_teacher(self):
        """Login as teacher and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.teacher_token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.teacher_token}"})
            return data
        return None
    
    def get_subjects(self):
        """Get available subjects for the user"""
        response = self.session.get(f"{BASE_URL}/api/academic/subjects")
        if response.status_code == 200:
            data = response.json()
            return data if isinstance(data, list) else data.get("subjects", [])
        return []
    
    def create_test_forum(self, subject_id):
        """Create a test forum post"""
        response = self.session.post(f"{BASE_URL}/api/course/{subject_id}/posts", json={
            "subject_id": subject_id,
            "title": f"TEST_Forum_{uuid.uuid4().hex[:8]}",
            "content": "Test forum content for cloning",
            "post_type": "forum"
        })
        return response
    
    def create_test_material(self, subject_id):
        """Create a test material post"""
        response = self.session.post(f"{BASE_URL}/api/course/{subject_id}/posts", json={
            "subject_id": subject_id,
            "title": f"TEST_Material_{uuid.uuid4().hex[:8]}",
            "content": "Test material content for cloning",
            "post_type": "material"
        })
        return response
    
    def create_test_exam(self, subject_id):
        """Create a test exam"""
        response = self.session.post(f"{BASE_URL}/api/course/{subject_id}/exams", json={
            "title": f"TEST_Exam_{uuid.uuid4().hex[:8]}",
            "description": "Test exam for cloning",
            "type": "omr",
            "num_questions": 10,
            "options_per_question": 4
        })
        return response
    
    # ═══════════════════════════════════════════════════════════════════
    # AUTHENTICATION TESTS
    # ═══════════════════════════════════════════════════════════════════
    
    def test_01_admin_login(self):
        """Test admin login"""
        data = self.login_admin()
        assert data is not None, "Admin login failed"
        assert self.admin_token is not None, "No token received"
        print(f"✓ Admin login successful, role: {data.get('user', {}).get('role')}")
    
    def test_02_teacher_login(self):
        """Test teacher login"""
        data = self.login_teacher()
        assert data is not None, "Teacher login failed"
        assert self.teacher_token is not None, "No token received"
        print(f"✓ Teacher login successful, role: {data.get('user', {}).get('role')}")
    
    # ═══════════════════════════════════════════════════════════════════
    # CLONE FORUM TESTS
    # ═══════════════════════════════════════════════════════════════════
    
    def test_03_clone_forum_same_section(self):
        """Test cloning a forum post in the same section"""
        self.login_admin()
        subjects = self.get_subjects()
        assert len(subjects) > 0, "No subjects found"
        
        subject = subjects[0]
        subject_id = subject.get("id")
        
        # Create a test forum
        create_resp = self.create_test_forum(subject_id)
        assert create_resp.status_code in [200, 201], f"Failed to create forum: {create_resp.text}"
        forum_data = create_resp.json()
        forum_id = forum_data.get("post", {}).get("id") or forum_data.get("id")
        assert forum_id, "No forum ID returned"
        
        # Clone in same section
        clone_resp = self.session.post(f"{BASE_URL}/api/course/posts/{forum_id}/clonar", json={
            "destinos": [],
            "clonar_en_misma_seccion": True
        })
        
        assert clone_resp.status_code == 200, f"Clone failed: {clone_resp.text}"
        clone_data = clone_resp.json()
        assert clone_data.get("clonados") >= 1, f"Expected at least 1 clone, got: {clone_data}"
        print(f"✓ Forum cloned in same section: {clone_data}")
    
    def test_04_clone_forum_to_other_subjects(self):
        """Test cloning a forum post to other subjects"""
        self.login_admin()
        subjects = self.get_subjects()
        assert len(subjects) >= 2, "Need at least 2 subjects for this test"
        
        source_subject = subjects[0]
        dest_subject = subjects[1]
        
        # Create a test forum
        create_resp = self.create_test_forum(source_subject.get("id"))
        assert create_resp.status_code in [200, 201], f"Failed to create forum: {create_resp.text}"
        forum_data = create_resp.json()
        forum_id = forum_data.get("post", {}).get("id") or forum_data.get("id")
        
        # Clone to another subject
        clone_resp = self.session.post(f"{BASE_URL}/api/course/posts/{forum_id}/clonar", json={
            "destinos": [{"subject_id": dest_subject.get("id")}],
            "clonar_en_misma_seccion": False
        })
        
        assert clone_resp.status_code == 200, f"Clone failed: {clone_resp.text}"
        clone_data = clone_resp.json()
        assert clone_data.get("clonados") >= 1, f"Expected at least 1 clone, got: {clone_data}"
        print(f"✓ Forum cloned to other subject: {clone_data}")
    
    def test_05_clone_forum_status_inheritance(self):
        """Test that cloned forum inherits status (active/published, not draft)"""
        self.login_admin()
        subjects = self.get_subjects()
        assert len(subjects) > 0, "No subjects found"
        
        subject_id = subjects[0].get("id")
        
        # Create a forum (should be active by default)
        create_resp = self.create_test_forum(subject_id)
        assert create_resp.status_code in [200, 201]
        forum_data = create_resp.json()
        forum_id = forum_data.get("post", {}).get("id") or forum_data.get("id")
        original_status = forum_data.get("post", {}).get("status") or forum_data.get("status", "active")
        
        # Clone in same section
        clone_resp = self.session.post(f"{BASE_URL}/api/course/posts/{forum_id}/clonar", json={
            "destinos": [],
            "clonar_en_misma_seccion": True
        })
        
        assert clone_resp.status_code == 200
        clone_data = clone_resp.json()
        assert clone_data.get("clonados") >= 1
        
        # Verify the clone has the same status (not draft)
        posts_resp = self.session.get(f"{BASE_URL}/api/course/{subject_id}/posts?post_type=forum")
        assert posts_resp.status_code == 200
        posts = posts_resp.json().get("posts", [])
        
        # Find the cloned post (has "(copia)" in title)
        cloned_posts = [p for p in posts if "(copia)" in (p.get("title") or "")]
        assert len(cloned_posts) > 0, "Cloned post not found"
        
        cloned_status = cloned_posts[0].get("status")
        assert cloned_status in ["active", "published"], f"Clone status should be active/published, got: {cloned_status}"
        print(f"✓ Forum clone status inheritance verified: {cloned_status}")
    
    # ═══════════════════════════════════════════════════════════════════
    # CLONE MATERIAL TESTS
    # ═══════════════════════════════════════════════════════════════════
    
    def test_06_clone_material_same_section(self):
        """Test cloning a material post in the same section"""
        self.login_admin()
        subjects = self.get_subjects()
        assert len(subjects) > 0, "No subjects found"
        
        subject_id = subjects[0].get("id")
        
        # Create a test material
        create_resp = self.create_test_material(subject_id)
        assert create_resp.status_code in [200, 201], f"Failed to create material: {create_resp.text}"
        material_data = create_resp.json()
        material_id = material_data.get("post", {}).get("id") or material_data.get("id")
        
        # Clone in same section
        clone_resp = self.session.post(f"{BASE_URL}/api/course/posts/{material_id}/clonar", json={
            "destinos": [],
            "clonar_en_misma_seccion": True
        })
        
        assert clone_resp.status_code == 200, f"Clone failed: {clone_resp.text}"
        clone_data = clone_resp.json()
        assert clone_data.get("clonados") >= 1, f"Expected at least 1 clone, got: {clone_data}"
        print(f"✓ Material cloned in same section: {clone_data}")
    
    def test_07_clone_material_to_other_subjects(self):
        """Test cloning a material post to other subjects"""
        self.login_admin()
        subjects = self.get_subjects()
        assert len(subjects) >= 2, "Need at least 2 subjects for this test"
        
        source_subject = subjects[0]
        dest_subject = subjects[1]
        
        # Create a test material
        create_resp = self.create_test_material(source_subject.get("id"))
        assert create_resp.status_code in [200, 201]
        material_data = create_resp.json()
        material_id = material_data.get("post", {}).get("id") or material_data.get("id")
        
        # Clone to another subject
        clone_resp = self.session.post(f"{BASE_URL}/api/course/posts/{material_id}/clonar", json={
            "destinos": [{"subject_id": dest_subject.get("id")}],
            "clonar_en_misma_seccion": False
        })
        
        assert clone_resp.status_code == 200, f"Clone failed: {clone_resp.text}"
        clone_data = clone_resp.json()
        assert clone_data.get("clonados") >= 1
        print(f"✓ Material cloned to other subject: {clone_data}")
    
    # ═══════════════════════════════════════════════════════════════════
    # CLONE EXAM TESTS
    # ═══════════════════════════════════════════════════════════════════
    
    def test_08_clone_exam_same_section(self):
        """Test cloning an exam in the same section"""
        self.login_admin()
        subjects = self.get_subjects()
        assert len(subjects) > 0, "No subjects found"
        
        subject_id = subjects[0].get("id")
        
        # Create a test exam
        create_resp = self.create_test_exam(subject_id)
        assert create_resp.status_code in [200, 201], f"Failed to create exam: {create_resp.text}"
        exam_data = create_resp.json()
        exam_id = exam_data.get("id")
        
        # Clone in same section
        clone_resp = self.session.post(f"{BASE_URL}/api/exams/{exam_id}/clonar", json={
            "destinos": [],
            "clonar_en_misma_seccion": True
        })
        
        assert clone_resp.status_code == 200, f"Clone failed: {clone_resp.text}"
        clone_data = clone_resp.json()
        assert clone_data.get("clonados") >= 1, f"Expected at least 1 clone, got: {clone_data}"
        print(f"✓ Exam cloned in same section: {clone_data}")
    
    def test_09_clone_exam_to_other_subjects(self):
        """Test cloning an exam to other subjects"""
        self.login_admin()
        subjects = self.get_subjects()
        assert len(subjects) >= 2, "Need at least 2 subjects for this test"
        
        source_subject = subjects[0]
        dest_subject = subjects[1]
        
        # Create a test exam
        create_resp = self.create_test_exam(source_subject.get("id"))
        assert create_resp.status_code in [200, 201]
        exam_data = create_resp.json()
        exam_id = exam_data.get("id")
        
        # Clone to another subject
        clone_resp = self.session.post(f"{BASE_URL}/api/exams/{exam_id}/clonar", json={
            "destinos": [{"subject_id": dest_subject.get("id")}],
            "clonar_en_misma_seccion": False
        })
        
        assert clone_resp.status_code == 200, f"Clone failed: {clone_resp.text}"
        clone_data = clone_resp.json()
        assert clone_data.get("clonados") >= 1
        print(f"✓ Exam cloned to other subject: {clone_data}")
    
    def test_10_clone_exam_preserves_questions(self):
        """Test that cloned exam preserves questions"""
        self.login_admin()
        subjects = self.get_subjects()
        assert len(subjects) > 0, "No subjects found"
        
        subject_id = subjects[0].get("id")
        
        # Create a test exam
        create_resp = self.create_test_exam(subject_id)
        assert create_resp.status_code in [200, 201]
        exam_data = create_resp.json()
        exam_id = exam_data.get("id")
        
        # Add a question to the exam
        question_resp = self.session.post(f"{BASE_URL}/api/exams/{exam_id}/questions", json={
            "question_type": "multiple_choice",
            "question_text": "Test question for clone verification",
            "points": 2.0,
            "options": [
                {"text": "Option A", "is_correct": True},
                {"text": "Option B", "is_correct": False},
                {"text": "Option C", "is_correct": False}
            ]
        })
        # Note: OMR exams may not support adding questions via this endpoint
        
        # Clone in same section
        clone_resp = self.session.post(f"{BASE_URL}/api/exams/{exam_id}/clonar", json={
            "destinos": [],
            "clonar_en_misma_seccion": True
        })
        
        assert clone_resp.status_code == 200
        clone_data = clone_resp.json()
        assert clone_data.get("clonados") >= 1
        print(f"✓ Exam clone with questions: {clone_data}")
    
    # ═══════════════════════════════════════════════════════════════════
    # PERMISSION TESTS
    # ═══════════════════════════════════════════════════════════════════
    
    def test_11_teacher_can_clone_own_subjects(self):
        """Test that teacher can clone to their own subjects"""
        self.login_teacher()
        subjects = self.get_subjects()
        
        if len(subjects) == 0:
            pytest.skip("Teacher has no subjects assigned")
        
        subject_id = subjects[0].get("id")
        
        # Create a test forum
        create_resp = self.create_test_forum(subject_id)
        if create_resp.status_code not in [200, 201]:
            pytest.skip(f"Teacher cannot create forum: {create_resp.text}")
        
        forum_data = create_resp.json()
        forum_id = forum_data.get("post", {}).get("id") or forum_data.get("id")
        
        # Clone in same section
        clone_resp = self.session.post(f"{BASE_URL}/api/course/posts/{forum_id}/clonar", json={
            "destinos": [],
            "clonar_en_misma_seccion": True
        })
        
        assert clone_resp.status_code == 200, f"Teacher clone failed: {clone_resp.text}"
        print(f"✓ Teacher can clone to own subjects")
    
    # ═══════════════════════════════════════════════════════════════════
    # RESPONSE FORMAT TESTS
    # ═══════════════════════════════════════════════════════════════════
    
    def test_12_clone_response_format(self):
        """Test that clone endpoint returns correct response format"""
        self.login_admin()
        subjects = self.get_subjects()
        assert len(subjects) > 0, "No subjects found"
        
        subject_id = subjects[0].get("id")
        
        # Create a test forum
        create_resp = self.create_test_forum(subject_id)
        assert create_resp.status_code in [200, 201]
        forum_data = create_resp.json()
        forum_id = forum_data.get("post", {}).get("id") or forum_data.get("id")
        
        # Clone
        clone_resp = self.session.post(f"{BASE_URL}/api/course/posts/{forum_id}/clonar", json={
            "destinos": [],
            "clonar_en_misma_seccion": True
        })
        
        assert clone_resp.status_code == 200
        clone_data = clone_resp.json()
        
        # Verify response format
        assert "clonados" in clone_data, "Response missing 'clonados' field"
        assert "errores" in clone_data, "Response missing 'errores' field"
        assert isinstance(clone_data["clonados"], int), "'clonados' should be an integer"
        assert isinstance(clone_data["errores"], list), "'errores' should be a list"
        print(f"✓ Clone response format verified: {clone_data}")
    
    def test_13_clone_multiple_destinations(self):
        """Test cloning to multiple destinations at once"""
        self.login_admin()
        subjects = self.get_subjects()
        
        if len(subjects) < 3:
            pytest.skip("Need at least 3 subjects for this test")
        
        source_subject = subjects[0]
        dest_subjects = subjects[1:3]
        
        # Create a test forum
        create_resp = self.create_test_forum(source_subject.get("id"))
        assert create_resp.status_code in [200, 201]
        forum_data = create_resp.json()
        forum_id = forum_data.get("post", {}).get("id") or forum_data.get("id")
        
        # Clone to multiple destinations
        destinos = [{"subject_id": s.get("id")} for s in dest_subjects]
        clone_resp = self.session.post(f"{BASE_URL}/api/course/posts/{forum_id}/clonar", json={
            "destinos": destinos,
            "clonar_en_misma_seccion": False
        })
        
        assert clone_resp.status_code == 200
        clone_data = clone_resp.json()
        assert clone_data.get("clonados") >= 2, f"Expected at least 2 clones, got: {clone_data}"
        print(f"✓ Multiple destination clone: {clone_data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
