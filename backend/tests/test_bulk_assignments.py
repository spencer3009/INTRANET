"""
Test Bulk Assignment Feature - POST /api/academic/assignments/bulk
Tests the cartesian product assignment creation, duplicate skipping, and validation.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"


class TestBulkAssignments:
    """Test suite for bulk assignment endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as owner
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        data = login_resp.json()
        self.token = data.get("token")
        self.user = data.get("user", {})
        self.school_id = self.user.get("school_id")
        assert self.token, "No token received"
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Fetch academic data for tests
        self._fetch_academic_data()
        
    def _fetch_academic_data(self):
        """Fetch levels, grades, sections, subjects, teachers, years"""
        # Levels
        resp = self.session.get(f"{BASE_URL}/api/academic/levels")
        assert resp.status_code == 200
        self.levels = resp.json()
        
        # Grades
        resp = self.session.get(f"{BASE_URL}/api/academic/grades")
        assert resp.status_code == 200
        self.grades = resp.json()
        
        # Sections
        resp = self.session.get(f"{BASE_URL}/api/academic/sections")
        assert resp.status_code == 200
        self.sections = resp.json()
        
        # Subjects
        resp = self.session.get(f"{BASE_URL}/api/academic/subjects")
        assert resp.status_code == 200
        self.subjects = resp.json()
        
        # Teachers
        resp = self.session.get(f"{BASE_URL}/api/users/teachers/active")
        assert resp.status_code == 200
        self.teachers = resp.json()
        
        # Academic years
        resp = self.session.get(f"{BASE_URL}/api/academic/years")
        assert resp.status_code == 200
        self.academic_years = resp.json()
        
    def test_01_login_and_fetch_data(self):
        """Test that login works and we can fetch academic data"""
        print(f"Logged in as: {self.user.get('email')}")
        print(f"School ID: {self.school_id}")
        print(f"Levels: {len(self.levels)}")
        print(f"Grades: {len(self.grades)}")
        print(f"Sections: {len(self.sections)}")
        print(f"Subjects: {len(self.subjects)}")
        print(f"Teachers: {len(self.teachers)}")
        print(f"Academic Years: {len(self.academic_years)}")
        
        assert len(self.levels) > 0, "No levels found"
        assert len(self.grades) > 0, "No grades found"
        assert len(self.sections) > 0, "No sections found"
        assert len(self.subjects) > 0, "No subjects found"
        assert len(self.teachers) > 0, "No teachers found"
        assert len(self.academic_years) > 0, "No academic years found"
        
    def test_02_bulk_endpoint_exists(self):
        """Test that the bulk endpoint exists and responds"""
        # Send minimal payload to check endpoint exists
        resp = self.session.post(f"{BASE_URL}/api/academic/assignments/bulk", json={
            "teacher_id": "invalid",
            "level_id": "invalid",
            "grade_ids": [],
            "section_ids": [],
            "subject_ids": []
        })
        # Should return 404 for invalid teacher, not 404 for endpoint
        assert resp.status_code in [404, 422], f"Unexpected status: {resp.status_code}"
        print(f"Bulk endpoint exists, returned: {resp.status_code}")
        
    def test_03_bulk_validates_teacher_exists(self):
        """Test that bulk endpoint validates teacher exists"""
        # Get a valid level
        level = self.levels[0] if self.levels else None
        assert level, "No level available for test"
        
        resp = self.session.post(f"{BASE_URL}/api/academic/assignments/bulk", json={
            "teacher_id": "nonexistent-teacher-id",
            "level_id": level["id"],
            "grade_ids": [],
            "section_ids": [],
            "subject_ids": []
        })
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        data = resp.json()
        assert "Profesor" in data.get("detail", "") or "no encontrado" in data.get("detail", "").lower()
        print(f"Teacher validation works: {data.get('detail')}")
        
    def test_04_bulk_validates_level_exists(self):
        """Test that bulk endpoint validates level exists"""
        teacher = self.teachers[0] if self.teachers else None
        assert teacher, "No teacher available for test"
        
        resp = self.session.post(f"{BASE_URL}/api/academic/assignments/bulk", json={
            "teacher_id": teacher["id"],
            "level_id": "nonexistent-level-id",
            "grade_ids": [],
            "section_ids": [],
            "subject_ids": []
        })
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        data = resp.json()
        assert "Nivel" in data.get("detail", "") or "no encontrado" in data.get("detail", "").lower()
        print(f"Level validation works: {data.get('detail')}")
        
    def test_05_bulk_creates_assignments_cartesian_product(self):
        """Test that bulk creates assignments from cartesian product of grades x sections x subjects"""
        # Find a level with grades
        level = None
        for l in self.levels:
            grades_in_level = [g for g in self.grades if g.get("nivel_id") == l["id"]]
            if grades_in_level:
                level = l
                break
        assert level, "No level with grades found"
        
        # Get grades for this level
        grades_in_level = [g for g in self.grades if g.get("nivel_id") == level["id"]]
        assert len(grades_in_level) > 0, "No grades in level"
        
        # Get one grade
        grade = grades_in_level[0]
        
        # Get sections for this grade
        sections_in_grade = [s for s in self.sections if s.get("grado_id") == grade["id"]]
        if not sections_in_grade:
            print(f"No sections for grade {grade['nombre']}, skipping test")
            pytest.skip("No sections available for this grade")
            
        # Get subjects for this level
        subjects_in_level = [s for s in self.subjects if s.get("level_id") == level["id"]]
        if not subjects_in_level:
            print(f"No subjects for level {level['nombre']}, skipping test")
            pytest.skip("No subjects available for this level")
            
        # Get a teacher
        teacher = self.teachers[0]
        
        # Get active academic year
        active_year = next((y for y in self.academic_years if y.get("status") == "activo"), None)
        if not active_year and self.academic_years:
            active_year = self.academic_years[0]
        assert active_year, "No academic year available"
        
        # Prepare bulk payload - use 1 grade, 1 section, 2 subjects (if available)
        section = sections_in_grade[0]
        subjects_to_use = subjects_in_level[:2] if len(subjects_in_level) >= 2 else subjects_in_level[:1]
        
        payload = {
            "teacher_id": teacher["id"],
            "level_id": level["id"],
            "grade_ids": [grade["id"]],
            "section_ids": [section["id"]],
            "subject_ids": [s["id"] for s in subjects_to_use],
            "academic_year_id": active_year["id"],
            "school_year": active_year.get("year", 2026),
            "role": "titular"
        }
        
        print(f"Bulk payload: teacher={teacher.get('name')}, level={level['nombre']}, grade={grade['nombre']}, section={section['nombre']}, subjects={len(subjects_to_use)}")
        
        resp = self.session.post(f"{BASE_URL}/api/academic/assignments/bulk", json=payload)
        print(f"Response status: {resp.status_code}")
        print(f"Response body: {resp.text[:500]}")
        
        assert resp.status_code == 200, f"Bulk create failed: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "created" in data, "Response missing 'created' field"
        assert "skipped" in data, "Response missing 'skipped' field"
        
        created = data.get("created", 0)
        skipped = data.get("skipped", 0)
        
        print(f"Created: {created}, Skipped: {skipped}")
        
        # Either created or skipped (if already existed)
        assert created + skipped > 0, "No assignments created or skipped"
        
    def test_06_bulk_skips_duplicates(self):
        """Test that calling bulk twice with same data skips duplicates"""
        # Find valid data
        level = None
        for l in self.levels:
            grades_in_level = [g for g in self.grades if g.get("nivel_id") == l["id"]]
            if grades_in_level:
                level = l
                break
        assert level, "No level with grades found"
        
        grades_in_level = [g for g in self.grades if g.get("nivel_id") == level["id"]]
        grade = grades_in_level[0]
        
        sections_in_grade = [s for s in self.sections if s.get("grado_id") == grade["id"]]
        if not sections_in_grade:
            pytest.skip("No sections available")
            
        subjects_in_level = [s for s in self.subjects if s.get("level_id") == level["id"]]
        if not subjects_in_level:
            pytest.skip("No subjects available")
            
        teacher = self.teachers[0]
        active_year = next((y for y in self.academic_years if y.get("status") == "activo"), self.academic_years[0] if self.academic_years else None)
        assert active_year, "No academic year"
        
        section = sections_in_grade[0]
        subject = subjects_in_level[0]
        
        payload = {
            "teacher_id": teacher["id"],
            "level_id": level["id"],
            "grade_ids": [grade["id"]],
            "section_ids": [section["id"]],
            "subject_ids": [subject["id"]],
            "academic_year_id": active_year["id"],
            "school_year": active_year.get("year", 2026),
            "role": "titular"
        }
        
        # First call
        resp1 = self.session.post(f"{BASE_URL}/api/academic/assignments/bulk", json=payload)
        assert resp1.status_code == 200
        data1 = resp1.json()
        
        # Second call with same data
        resp2 = self.session.post(f"{BASE_URL}/api/academic/assignments/bulk", json=payload)
        assert resp2.status_code == 200
        data2 = resp2.json()
        
        print(f"First call: created={data1.get('created')}, skipped={data1.get('skipped')}")
        print(f"Second call: created={data2.get('created')}, skipped={data2.get('skipped')}")
        
        # Second call should skip all (duplicates)
        assert data2.get("created", 0) == 0, "Second call should not create new assignments"
        assert data2.get("skipped", 0) > 0, "Second call should skip duplicates"
        
    def test_07_bulk_filters_invalid_section_grade_combinations(self):
        """Test that bulk silently skips section-grade combinations that don't match"""
        # Find two different grades with sections
        level = None
        for l in self.levels:
            grades_in_level = [g for g in self.grades if g.get("nivel_id") == l["id"]]
            if len(grades_in_level) >= 2:
                level = l
                break
                
        if not level:
            pytest.skip("Need at least 2 grades in a level for this test")
            
        grades_in_level = [g for g in self.grades if g.get("nivel_id") == level["id"]]
        grade1 = grades_in_level[0]
        grade2 = grades_in_level[1]
        
        sections_grade1 = [s for s in self.sections if s.get("grado_id") == grade1["id"]]
        sections_grade2 = [s for s in self.sections if s.get("grado_id") == grade2["id"]]
        
        if not sections_grade1 or not sections_grade2:
            pytest.skip("Need sections in both grades")
            
        subjects_in_level = [s for s in self.subjects if s.get("level_id") == level["id"]]
        if not subjects_in_level:
            pytest.skip("No subjects available")
            
        teacher = self.teachers[0]
        active_year = next((y for y in self.academic_years if y.get("status") == "activo"), self.academic_years[0] if self.academic_years else None)
        
        # Send grade1 with section from grade2 - should be silently skipped
        payload = {
            "teacher_id": teacher["id"],
            "level_id": level["id"],
            "grade_ids": [grade1["id"]],
            "section_ids": [sections_grade2[0]["id"]],  # Section from different grade
            "subject_ids": [subjects_in_level[0]["id"]],
            "academic_year_id": active_year["id"],
            "school_year": active_year.get("year", 2026),
            "role": "titular"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/academic/assignments/bulk", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        
        print(f"Mismatched grade-section: created={data.get('created')}, skipped={data.get('skipped')}")
        
        # Should create 0 because section doesn't belong to grade
        assert data.get("created", 0) == 0, "Should not create assignments for mismatched grade-section"
        
    def test_08_bulk_validates_academic_year(self):
        """Test that bulk validates academic year exists"""
        teacher = self.teachers[0] if self.teachers else None
        level = self.levels[0] if self.levels else None
        assert teacher and level, "Need teacher and level"
        
        resp = self.session.post(f"{BASE_URL}/api/academic/assignments/bulk", json={
            "teacher_id": teacher["id"],
            "level_id": level["id"],
            "grade_ids": [],
            "section_ids": [],
            "subject_ids": [],
            "academic_year_id": "nonexistent-year-id"
        })
        
        # Should return 404 for invalid academic year
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        data = resp.json()
        print(f"Academic year validation: {data.get('detail')}")


class TestExistingAssignmentFlow:
    """Test that existing 'Nueva Asignacion' flow still works"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.token = data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Fetch data
        self._fetch_data()
        
    def _fetch_data(self):
        """Fetch required data"""
        self.levels = self.session.get(f"{BASE_URL}/api/academic/levels").json()
        self.grades = self.session.get(f"{BASE_URL}/api/academic/grades").json()
        self.sections = self.session.get(f"{BASE_URL}/api/academic/sections").json()
        self.subjects = self.session.get(f"{BASE_URL}/api/academic/subjects").json()
        self.teachers = self.session.get(f"{BASE_URL}/api/users/teachers/active").json()
        self.academic_years = self.session.get(f"{BASE_URL}/api/academic/years").json()
        
    def test_single_assignment_endpoint_works(self):
        """Test that POST /api/academic/assignments (single) still works"""
        # Find valid data
        level = None
        for l in self.levels:
            grades_in_level = [g for g in self.grades if g.get("nivel_id") == l["id"]]
            if grades_in_level:
                level = l
                break
        
        if not level:
            pytest.skip("No level with grades")
            
        grades_in_level = [g for g in self.grades if g.get("nivel_id") == level["id"]]
        grade = grades_in_level[0]
        
        sections_in_grade = [s for s in self.sections if s.get("grado_id") == grade["id"]]
        if not sections_in_grade:
            pytest.skip("No sections")
            
        subjects_in_level = [s for s in self.subjects if s.get("level_id") == level["id"]]
        if not subjects_in_level:
            pytest.skip("No subjects")
            
        teacher = self.teachers[0] if self.teachers else None
        if not teacher:
            pytest.skip("No teachers")
            
        active_year = next((y for y in self.academic_years if y.get("status") == "activo"), self.academic_years[0] if self.academic_years else None)
        if not active_year:
            pytest.skip("No academic year")
            
        # Create single assignment
        payload = {
            "teacher_id": teacher["id"],
            "level_id": level["id"],
            "grade_id": grade["id"],
            "section_id": sections_in_grade[0]["id"],
            "subject_id": subjects_in_level[0]["id"],
            "academic_year_id": active_year["id"],
            "school_year": active_year.get("year", 2026),
            "role": "titular",
            "status": "activo"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/academic/assignments", json=payload)
        print(f"Single assignment response: {resp.status_code}")
        
        # Should succeed or return 400 if duplicate
        assert resp.status_code in [200, 400], f"Unexpected status: {resp.status_code}, body: {resp.text}"
        
        if resp.status_code == 200:
            data = resp.json()
            assert "assignment" in data, "Response missing assignment"
            print(f"Created assignment: {data['assignment'].get('id')}")
        else:
            print(f"Assignment already exists (expected): {resp.json().get('detail')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
