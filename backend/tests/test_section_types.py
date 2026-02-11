"""
Test module for Section Types Catalog Refactoring
Tests:
1. GET /api/academic/section-types - returns catalog (A, B, C, D, E, F, ÚNICA)
2. POST /api/academic/sections - creates section using section_type_id
3. Duplicate validation - cannot create same section type in same grade
4. Backward compatibility - existing sections get section_type_id auto-assigned
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"
TEST_IDENTIFIER = "demosettings"


class TestSectionTypesModule:
    """Test section types catalog and sections creation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.section_types = []
        self.grades = []
        self.created_sections = []  # Track created sections for cleanup
        
    def _login(self):
        """Login and get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        return data
    
    def _cleanup_created_sections(self):
        """Cleanup sections created during tests"""
        for section_id in self.created_sections:
            try:
                self.session.delete(f"{BASE_URL}/api/academic/sections/{section_id}")
            except:
                pass
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: Authentication
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_login_success(self):
        """Test login with provided credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: GET /api/academic/section-types
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_02_get_section_types_returns_catalog(self):
        """Test GET /api/academic/section-types returns the catalog"""
        self._login()
        
        response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        assert response.status_code == 200, f"Failed to get section types: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 7, f"Expected at least 7 section types, got {len(data)}"
        
        # Verify expected section types exist
        expected_keys = ["A", "B", "C", "D", "E", "F", "UNICA"]
        actual_keys = [st["key"] for st in data]
        
        for key in expected_keys:
            assert key in actual_keys, f"Expected section type '{key}' not found"
        
        # Verify structure of each section type
        for st in data:
            assert "id" in st, "Section type missing 'id'"
            assert "key" in st, "Section type missing 'key'"
            assert "label" in st, "Section type missing 'label'"
            assert "orden" in st, "Section type missing 'orden'"
            assert "activo" in st, "Section type missing 'activo'"
        
        self.section_types = data
        print(f"✓ GET /api/academic/section-types returned {len(data)} types: {actual_keys}")
    
    def test_03_section_types_have_correct_labels(self):
        """Test section types have correct labels (ÚNICA not UNICA)"""
        self._login()
        
        response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find UNICA type and verify label
        unica_type = next((st for st in data if st["key"] == "UNICA"), None)
        assert unica_type is not None, "UNICA section type not found"
        assert unica_type["label"] == "ÚNICA", f"Expected label 'ÚNICA', got '{unica_type['label']}'"
        
        # Verify A-F have matching key/label
        for letter in ["A", "B", "C", "D", "E", "F"]:
            st = next((s for s in data if s["key"] == letter), None)
            assert st is not None, f"Section type '{letter}' not found"
            assert st["label"] == letter, f"Expected label '{letter}', got '{st['label']}'"
        
        print("✓ Section types have correct labels (A, B, C, D, E, F, ÚNICA)")
    
    def test_04_section_types_are_ordered(self):
        """Test section types are returned in correct order"""
        self._login()
        
        response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify orden values are sequential
        orders = [st["orden"] for st in data]
        assert orders == sorted(orders), "Section types not sorted by orden"
        
        # Verify A comes before B, B before C, etc.
        expected_order = ["A", "B", "C", "D", "E", "F", "UNICA"]
        actual_order = [st["key"] for st in data if st["key"] in expected_order]
        
        for i, key in enumerate(expected_order):
            if key in actual_order:
                idx = actual_order.index(key)
                assert idx == i, f"Section type '{key}' at wrong position: expected {i}, got {idx}"
        
        print(f"✓ Section types are correctly ordered: {actual_order}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: GET /api/academic/grades (needed for section creation)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_05_get_grades_for_section_creation(self):
        """Get available grades for section creation tests"""
        self._login()
        
        response = self.session.get(f"{BASE_URL}/api/academic/grades")
        assert response.status_code == 200, f"Failed to get grades: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "No grades found - cannot test section creation"
        
        self.grades = data
        print(f"✓ Found {len(data)} grades for section creation tests")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: POST /api/academic/sections with section_type_id
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_06_create_section_with_section_type_id(self):
        """Test creating a section using section_type_id instead of nombre"""
        self._login()
        
        # Get section types
        types_response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        assert types_response.status_code == 200
        section_types = types_response.json()
        
        # Get grades
        grades_response = self.session.get(f"{BASE_URL}/api/academic/grades")
        assert grades_response.status_code == 200
        grades = grades_response.json()
        
        if not grades:
            pytest.skip("No grades available for testing")
        
        # Find a grade and section type to use
        test_grade = grades[0]
        
        # Get existing sections for this grade to find an unused section type
        sections_response = self.session.get(f"{BASE_URL}/api/academic/sections?grado_id={test_grade['id']}")
        existing_sections = sections_response.json() if sections_response.status_code == 200 else []
        existing_type_ids = [s.get("section_type_id") for s in existing_sections]
        
        # Find an unused section type
        unused_type = None
        for st in section_types:
            if st["id"] not in existing_type_ids and st["activo"]:
                unused_type = st
                break
        
        if not unused_type:
            pytest.skip("All section types already used in test grade")
        
        # Create section with section_type_id
        payload = {
            "section_type_id": unused_type["id"],
            "grado_id": test_grade["id"],
            "capacidad_maxima": 30,
            "activo": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/sections", json=payload)
        assert response.status_code == 200, f"Failed to create section: {response.text}"
        
        data = response.json()
        assert "section" in data, "Response missing 'section'"
        
        section = data["section"]
        assert section["section_type_id"] == unused_type["id"], "section_type_id mismatch"
        assert section["nombre"] == unused_type["label"], f"nombre should be '{unused_type['label']}', got '{section['nombre']}'"
        assert section["grado_id"] == test_grade["id"], "grado_id mismatch"
        
        # Track for cleanup
        self.created_sections.append(section["id"])
        
        print(f"✓ Created section '{section['nombre']}' using section_type_id")
        
        # Cleanup
        self._cleanup_created_sections()
    
    def test_07_create_section_requires_section_type_id(self):
        """Test that creating section without section_type_id fails"""
        self._login()
        
        # Get a grade
        grades_response = self.session.get(f"{BASE_URL}/api/academic/grades")
        grades = grades_response.json()
        
        if not grades:
            pytest.skip("No grades available for testing")
        
        # Try to create section without section_type_id (old way with nombre)
        payload = {
            "nombre": "X",  # Old field, should not work
            "grado_id": grades[0]["id"],
            "activo": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/sections", json=payload)
        # Should fail with 422 (validation error) because section_type_id is required
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
        
        print("✓ Creating section without section_type_id correctly fails with 422")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: Duplicate validation
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_08_duplicate_section_type_in_grade_rejected(self):
        """Test that duplicate section type in same grade is rejected"""
        self._login()
        
        # Get section types and grades
        types_response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        section_types = types_response.json()
        
        grades_response = self.session.get(f"{BASE_URL}/api/academic/grades")
        grades = grades_response.json()
        
        if not grades:
            pytest.skip("No grades available for testing")
        
        test_grade = grades[0]
        
        # Get existing sections for this grade
        sections_response = self.session.get(f"{BASE_URL}/api/academic/sections?grado_id={test_grade['id']}")
        existing_sections = sections_response.json() if sections_response.status_code == 200 else []
        existing_type_ids = [s.get("section_type_id") for s in existing_sections]
        
        # Find an unused section type
        unused_type = None
        for st in section_types:
            if st["id"] not in existing_type_ids and st["activo"]:
                unused_type = st
                break
        
        if not unused_type:
            pytest.skip("All section types already used in test grade")
        
        # Create first section
        payload = {
            "section_type_id": unused_type["id"],
            "grado_id": test_grade["id"],
            "activo": True
        }
        
        response1 = self.session.post(f"{BASE_URL}/api/academic/sections", json=payload)
        assert response1.status_code == 200, f"First section creation failed: {response1.text}"
        
        section1 = response1.json()["section"]
        self.created_sections.append(section1["id"])
        
        # Try to create duplicate
        response2 = self.session.post(f"{BASE_URL}/api/academic/sections", json=payload)
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
        
        error_data = response2.json()
        assert "detail" in error_data, "Error response missing 'detail'"
        assert "ya existe" in error_data["detail"].lower() or "already" in error_data["detail"].lower(), \
            f"Error message should indicate duplicate: {error_data['detail']}"
        
        print(f"✓ Duplicate section type '{unused_type['label']}' in same grade correctly rejected")
        
        # Cleanup
        self._cleanup_created_sections()
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: Backward compatibility
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_09_existing_sections_have_section_type_id(self):
        """Test that existing sections get section_type_id auto-assigned"""
        self._login()
        
        # Get all sections
        response = self.session.get(f"{BASE_URL}/api/academic/sections")
        assert response.status_code == 200, f"Failed to get sections: {response.text}"
        
        sections = response.json()
        
        if not sections:
            pytest.skip("No existing sections to test backward compatibility")
        
        # Check that sections have section_type_id
        sections_with_type_id = [s for s in sections if s.get("section_type_id")]
        sections_without_type_id = [s for s in sections if not s.get("section_type_id")]
        
        print(f"  Sections with section_type_id: {len(sections_with_type_id)}")
        print(f"  Sections without section_type_id: {len(sections_without_type_id)}")
        
        # All sections should have section_type_id after the GET (auto-migration)
        # Note: The GET endpoint auto-assigns section_type_id based on nombre
        for section in sections:
            if section.get("nombre"):
                # After GET, section_type_id should be assigned
                assert section.get("section_type_id") or section.get("nombre") not in ["A", "B", "C", "D", "E", "F", "ÚNICA"], \
                    f"Section '{section['nombre']}' should have section_type_id assigned"
        
        print(f"✓ Backward compatibility: {len(sections)} sections checked")
    
    def test_10_sections_response_includes_required_fields(self):
        """Test that sections response includes all required fields"""
        self._login()
        
        response = self.session.get(f"{BASE_URL}/api/academic/sections")
        assert response.status_code == 200
        
        sections = response.json()
        
        if not sections:
            pytest.skip("No sections to verify")
        
        required_fields = ["id", "nombre", "grado_id", "grado_nombre", "nivel_id", "nivel_nombre", "activo"]
        
        for section in sections[:5]:  # Check first 5
            for field in required_fields:
                assert field in section, f"Section missing required field '{field}'"
        
        print(f"✓ Sections response includes all required fields")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST: Section type validation
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_11_create_section_with_invalid_type_id_fails(self):
        """Test that creating section with invalid section_type_id fails"""
        self._login()
        
        grades_response = self.session.get(f"{BASE_URL}/api/academic/grades")
        grades = grades_response.json()
        
        if not grades:
            pytest.skip("No grades available for testing")
        
        payload = {
            "section_type_id": "invalid-uuid-12345",
            "grado_id": grades[0]["id"],
            "activo": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/sections", json=payload)
        assert response.status_code == 400, f"Expected 400 for invalid type_id, got {response.status_code}"
        
        error_data = response.json()
        assert "detail" in error_data
        assert "no existe" in error_data["detail"].lower() or "not exist" in error_data["detail"].lower()
        
        print("✓ Creating section with invalid section_type_id correctly fails")
    
    def test_12_create_section_with_invalid_grade_id_fails(self):
        """Test that creating section with invalid grado_id fails"""
        self._login()
        
        types_response = self.session.get(f"{BASE_URL}/api/academic/section-types")
        section_types = types_response.json()
        
        if not section_types:
            pytest.skip("No section types available")
        
        payload = {
            "section_type_id": section_types[0]["id"],
            "grado_id": "invalid-grade-uuid",
            "activo": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/academic/sections", json=payload)
        assert response.status_code == 400, f"Expected 400 for invalid grade_id, got {response.status_code}"
        
        print("✓ Creating section with invalid grado_id correctly fails")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
