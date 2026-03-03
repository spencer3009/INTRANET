"""
Test Grade Name Validation - EduNet
Tests the structural validation to prevent mixing grade and section names.
Backend validates and blocks section-like patterns in grade names.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Level IDs for demosettings school
LEVEL_IDS = {
    "inicial": "035e4a2b-1d7e-48e1-ab85-dfeef62312cf",
    "primaria": "65478f43-bbc8-4099-9936-5e4d455220a4",
    "secundaria": "057794a9-c9ee-4cdf-9c2a-e25f85219347"
}

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "1234abc8"


class TestGradeValidation:
    """Tests for grade name validation to prevent section patterns"""

    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")

    @pytest.fixture
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    # ═══════════════════════════════════════════════════════════════════════
    # INVALID PATTERNS - Should be blocked
    # ═══════════════════════════════════════════════════════════════════════
    
    def test_block_grade_with_single_letter_suffix(self, headers):
        """Block: '4 AÑOS A' - single letter at end (section pattern)"""
        response = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "4 AÑOS A",
                "nivel_id": LEVEL_IDS["inicial"],
                "orden": 0,
                "activo": True
            }
        )
        assert response.status_code == 400, f"Should block '4 AÑOS A': {response.text}"
        assert "sección" in response.json().get("detail", "").lower()
        print("✓ Blocked '4 AÑOS A' (section pattern)")

    def test_block_grade_ordinal_with_letter(self, headers):
        """Block: '1°B' - ordinal with letter (section pattern)"""
        response = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "1°B",
                "nivel_id": LEVEL_IDS["primaria"],
                "orden": 0,
                "activo": True
            }
        )
        assert response.status_code == 400, f"Should block '1°B': {response.text}"
        assert "sección" in response.json().get("detail", "").lower()
        print("✓ Blocked '1°B' (section pattern)")

    def test_block_grade_with_space_letter(self, headers):
        """Block: '2° B' - ordinal with space and letter (section pattern)"""
        response = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "2° B",
                "nivel_id": LEVEL_IDS["primaria"],
                "orden": 0,
                "activo": True
            }
        )
        assert response.status_code == 400, f"Should block '2° B': {response.text}"
        assert "sección" in response.json().get("detail", "").lower()
        print("✓ Blocked '2° B' (section pattern)")

    def test_block_grade_with_alamo(self, headers):
        """Block: '3 AÑOS ALAMO' - section word (Álamo is a section name)"""
        response = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "3 AÑOS ALAMO",
                "nivel_id": LEVEL_IDS["inicial"],
                "orden": 0,
                "activo": True
            }
        )
        assert response.status_code == 400, f"Should block '3 AÑOS ALAMO': {response.text}"
        assert "sección" in response.json().get("detail", "").lower()
        print("✓ Blocked '3 AÑOS ALAMO' (section word)")

    def test_block_grade_with_seccion(self, headers):
        """Block: 'SECCION A' - explicit section word"""
        response = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "SECCION A",
                "nivel_id": LEVEL_IDS["primaria"],
                "orden": 0,
                "activo": True
            }
        )
        assert response.status_code == 400, f"Should block 'SECCION A': {response.text}"
        assert "sección" in response.json().get("detail", "").lower()
        print("✓ Blocked 'SECCION A' (section word)")

    def test_block_grade_with_aula(self, headers):
        """Block: '1° AULA' - section word"""
        response = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "1° AULA",
                "nivel_id": LEVEL_IDS["primaria"],
                "orden": 0,
                "activo": True
            }
        )
        assert response.status_code == 400, f"Should block '1° AULA': {response.text}"
        assert "sección" in response.json().get("detail", "").lower()
        print("✓ Blocked '1° AULA' (section word)")

    def test_block_grade_with_roble(self, headers):
        """Block: '5 AÑOS ROBLE' - tree name (section pattern)"""
        response = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "5 AÑOS ROBLE",
                "nivel_id": LEVEL_IDS["inicial"],
                "orden": 0,
                "activo": True
            }
        )
        assert response.status_code == 400, f"Should block '5 AÑOS ROBLE': {response.text}"
        assert "sección" in response.json().get("detail", "").lower()
        print("✓ Blocked '5 AÑOS ROBLE' (section word)")

    # ═══════════════════════════════════════════════════════════════════════
    # VALID PATTERNS - Should be allowed
    # ═══════════════════════════════════════════════════════════════════════

    def test_allow_valid_grade_ordinal(self, headers):
        """Allow: '1°' - simple ordinal grade name"""
        # First, try to create, might already exist
        response = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "TEST_1°",
                "nivel_id": LEVEL_IDS["primaria"],
                "orden": 99,
                "activo": True
            }
        )
        # Either 200/201 (created) or 400 (duplicate) is acceptable for this test
        if response.status_code in [200, 201]:
            print("✓ Created 'TEST_1°' (valid grade name)")
            # Clean up
            grade_id = response.json().get("grade", {}).get("id")
            if grade_id:
                requests.delete(f"{BASE_URL}/api/academic/grades/{grade_id}", headers=headers)
        elif response.status_code == 400 and "existe" in response.json().get("detail", "").lower():
            print("✓ 'TEST_1°' pattern is valid (duplicate check blocked it)")
        else:
            # Check it's not blocking because of section pattern
            detail = response.json().get("detail", "")
            assert "sección" not in detail.lower(), f"Should not block '1°': {response.text}"
            print(f"Note: {response.text}")

    def test_allow_valid_anos_grade(self, headers):
        """Allow: 'TEST_5 AÑOS' - valid INICIAL grade name"""
        response = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "TEST_5_ANOS",
                "nivel_id": LEVEL_IDS["inicial"],
                "orden": 99,
                "activo": True
            }
        )
        if response.status_code in [200, 201]:
            print("✓ Created 'TEST_5_ANOS' (valid grade name)")
            grade_id = response.json().get("grade", {}).get("id")
            if grade_id:
                requests.delete(f"{BASE_URL}/api/academic/grades/{grade_id}", headers=headers)
        elif response.status_code == 400:
            detail = response.json().get("detail", "")
            assert "sección" not in detail.lower(), f"Should not block valid name: {response.text}"
            print(f"✓ Valid pattern (other validation: {detail})")

    # ═══════════════════════════════════════════════════════════════════════
    # UPDATE ENDPOINT TESTS
    # ═══════════════════════════════════════════════════════════════════════

    def test_update_blocks_section_pattern(self, headers):
        """Test PUT endpoint also blocks section patterns"""
        # First create a valid grade
        create_resp = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "TEST_UPDATE_GRADE",
                "nivel_id": LEVEL_IDS["primaria"],
                "orden": 99,
                "activo": True
            }
        )
        
        if create_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create test grade: {create_resp.text}")
        
        grade_id = create_resp.json().get("grade", {}).get("id")
        assert grade_id, "Grade ID not returned"
        
        try:
            # Try to update with invalid pattern
            update_resp = requests.put(
                f"{BASE_URL}/api/academic/grades/{grade_id}",
                headers=headers,
                json={
                    "nombre": "1°A",  # Invalid pattern
                    "activo": True
                }
            )
            assert update_resp.status_code == 400, f"Should block update with '1°A': {update_resp.text}"
            assert "sección" in update_resp.json().get("detail", "").lower()
            print("✓ PUT endpoint blocks section patterns")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/academic/grades/{grade_id}", headers=headers)

    # ═══════════════════════════════════════════════════════════════════════
    # DUPLICATE DETECTION TESTS
    # ═══════════════════════════════════════════════════════════════════════

    def test_duplicate_grade_blocked(self, headers):
        """Test duplicate grade names within same level are blocked"""
        # Create first grade
        create_resp = requests.post(
            f"{BASE_URL}/api/academic/grades",
            headers=headers,
            json={
                "nombre": "TEST_DUPLICATE_CHECK",
                "nivel_id": LEVEL_IDS["secundaria"],
                "orden": 99,
                "activo": True
            }
        )
        
        if create_resp.status_code not in [200, 201]:
            # If already exists, just try creating duplicate
            pass
        
        grade_id = create_resp.json().get("grade", {}).get("id") if create_resp.status_code in [200, 201] else None
        
        try:
            # Try to create duplicate
            dup_resp = requests.post(
                f"{BASE_URL}/api/academic/grades",
                headers=headers,
                json={
                    "nombre": "TEST_DUPLICATE_CHECK",
                    "nivel_id": LEVEL_IDS["secundaria"],
                    "orden": 99,
                    "activo": True
                }
            )
            assert dup_resp.status_code == 400, f"Should block duplicate: {dup_resp.text}"
            assert "existe" in dup_resp.json().get("detail", "").lower()
            print("✓ Duplicate grade blocked within same level")
        finally:
            if grade_id:
                requests.delete(f"{BASE_URL}/api/academic/grades/{grade_id}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
