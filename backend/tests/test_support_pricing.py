"""
Test Suite: Support Panel - Pricing Calculation
Tests for: GET /api/support/schools pricing fields, GET /api/support/school-pricing/{school_id}, Global pricing config

Feature being tested: 
- School cards must show calculated monthly fee (base + students * per-student fee)
- Student count display
- Per-student fee timing (offer months vs monthly base price)

Credentials:
  - Support Global: spencer3009@gmail.com / Socios3009
  - School 'Colegio El Roble' should have 35 students
  - Base price: 50.0, per_student_fee: 0.70, per_student_from_month: 3
  - Expected at Month 1: S/50.00 (per-student fees don't apply yet)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gradebook-link.preview.emergentagent.com')

# Test credentials
SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"


@pytest.fixture(scope="module")
def support_token():
    """Get token for global support user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPPORT_EMAIL,
        "password": SUPPORT_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip(f"Support login failed: {response.status_code} - {response.text}")


@pytest.fixture
def support_headers(support_token):
    """Headers for support user"""
    return {"Authorization": f"Bearer {support_token}"}


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL PRICING CONFIGURATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestGlobalPricingConfig:
    """Test GET/PUT /api/support/pricing (Global pricing configuration)"""

    def test_get_global_pricing(self, support_headers):
        """GET /api/support/pricing should return global pricing config"""
        response = requests.get(f"{BASE_URL}/api/support/pricing", headers=support_headers)
        assert response.status_code == 200, f"Get pricing failed: {response.text}"
        
        data = response.json()
        assert "base_monthly_fee" in data, "Should have base_monthly_fee"
        assert "per_student_fee" in data, "Should have per_student_fee"
        assert "per_student_from_month" in data, "Should have per_student_from_month"
        
        # Validate types
        assert isinstance(data["base_monthly_fee"], (int, float)), "base_monthly_fee should be numeric"
        assert isinstance(data["per_student_fee"], (int, float)), "per_student_fee should be numeric"
        assert isinstance(data["per_student_from_month"], int), "per_student_from_month should be integer"
        
        print(f"Global pricing: base=S/{data['base_monthly_fee']}, per_student=S/{data['per_student_fee']}, from_month={data['per_student_from_month']}")

    def test_update_global_pricing(self, support_headers):
        """PUT /api/support/pricing should update global pricing config"""
        # Get current config
        current = requests.get(f"{BASE_URL}/api/support/pricing", headers=support_headers).json()
        original_base = current.get("base_monthly_fee", 50.0)
        original_per_student = current.get("per_student_fee", 0.70)
        original_from_month = current.get("per_student_from_month", 3)
        
        # Update with test values
        test_config = {
            "base_monthly_fee": 60.0,
            "per_student_fee": 0.80,
            "per_student_from_month": 4
        }
        response = requests.put(f"{BASE_URL}/api/support/pricing", 
            headers=support_headers, json=test_config)
        assert response.status_code == 200, f"Update pricing failed: {response.text}"
        
        # Verify update
        verify = requests.get(f"{BASE_URL}/api/support/pricing", headers=support_headers).json()
        assert verify["base_monthly_fee"] == 60.0, f"base_monthly_fee should be 60.0"
        assert verify["per_student_fee"] == 0.80, f"per_student_fee should be 0.80"
        assert verify["per_student_from_month"] == 4, f"per_student_from_month should be 4"
        
        # Restore original values
        restore = {
            "base_monthly_fee": original_base,
            "per_student_fee": original_per_student,
            "per_student_from_month": original_from_month
        }
        requests.put(f"{BASE_URL}/api/support/pricing", headers=support_headers, json=restore)
        print("Global pricing update test passed, restored original values")

    def test_pricing_requires_auth(self):
        """GET /api/support/pricing should require authentication"""
        response = requests.get(f"{BASE_URL}/api/support/pricing")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"


# ═══════════════════════════════════════════════════════════════════════════════
# SCHOOLS LIST WITH PRICING FIELDS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSchoolsPricingFields:
    """Test GET /api/support/schools returns pricing calculation fields"""

    def test_schools_list_has_pricing_fields(self, support_headers):
        """GET /api/support/schools should return calculated_price, base_charge, student_charge, etc."""
        response = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        assert response.status_code == 200, f"Get schools failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) == 0:
            pytest.skip("No assigned schools to test pricing fields")
        
        # Check first school has all required pricing fields
        school = data[0]
        required_fields = [
            "calculated_price",
            "base_charge",
            "student_charge",
            "months_active",
            "per_student_applies",
            "per_student_fee",
            "per_student_from_month",
            "student_count"
        ]
        
        for field in required_fields:
            assert field in school, f"School should have {field} field"
        
        # Validate types
        assert isinstance(school["calculated_price"], (int, float)), "calculated_price should be numeric"
        assert isinstance(school["base_charge"], (int, float)), "base_charge should be numeric"
        assert isinstance(school["student_charge"], (int, float)), "student_charge should be numeric"
        assert isinstance(school["months_active"], int), "months_active should be integer"
        assert isinstance(school["per_student_applies"], bool), "per_student_applies should be boolean"
        assert isinstance(school["per_student_fee"], (int, float)), "per_student_fee should be numeric"
        assert isinstance(school["per_student_from_month"], int), "per_student_from_month should be integer"
        assert isinstance(school["student_count"], int), "student_count should be integer"
        
        print(f"School: {school.get('name', school.get('subdomain'))}")
        print(f"  - calculated_price: S/{school['calculated_price']}")
        print(f"  - base_charge: S/{school['base_charge']}")
        print(f"  - student_charge: S/{school['student_charge']}")
        print(f"  - months_active: {school['months_active']}")
        print(f"  - per_student_applies: {school['per_student_applies']}")
        print(f"  - per_student_fee: S/{school['per_student_fee']}")
        print(f"  - per_student_from_month: {school['per_student_from_month']}")
        print(f"  - student_count: {school['student_count']}")

    def test_colegio_el_roble_pricing(self, support_headers):
        """Verify 'Colegio El Roble' has correct pricing calculation"""
        response = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        assert response.status_code == 200, f"Get schools failed: {response.text}"
        
        data = response.json()
        
        # Find El Roble
        el_roble = None
        for school in data:
            if "roble" in (school.get("name", "") or "").lower() or \
               school.get("subdomain", "").lower() == "elroble":
                el_roble = school
                break
        
        if not el_roble:
            pytest.skip("Colegio El Roble not found in assigned schools")
        
        print(f"Found El Roble: {el_roble.get('name')}")
        print(f"  - Student count: {el_roble['student_count']}")
        print(f"  - Months active: {el_roble['months_active']}")
        print(f"  - Per-student applies: {el_roble['per_student_applies']}")
        print(f"  - Base charge: S/{el_roble['base_charge']}")
        print(f"  - Student charge: S/{el_roble['student_charge']}")
        print(f"  - Calculated price: S/{el_roble['calculated_price']}")
        print(f"  - Per-student from month: {el_roble['per_student_from_month']}")
        
        # Validate calculation logic
        base = el_roble["base_charge"]
        student_charge = el_roble["student_charge"]
        calculated = el_roble["calculated_price"]
        
        # Verify: calculated = base + student_charge
        expected_total = round(base + student_charge, 2)
        assert calculated == expected_total, f"calculated_price ({calculated}) should equal base ({base}) + student_charge ({student_charge}) = {expected_total}"
        
        # If per_student_applies is False, student_charge should be 0
        if not el_roble["per_student_applies"]:
            assert student_charge == 0.0, f"student_charge should be 0 when per_student_applies is False"
            print("Verified: per_student_applies=False, student_charge=0.0")


# ═══════════════════════════════════════════════════════════════════════════════
# SCHOOL-SPECIFIC PRICING ENDPOINT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSchoolPricingEndpoint:
    """Test GET /api/support/school-pricing/{school_id}"""

    def test_get_school_pricing_returns_full_details(self, support_headers):
        """GET /api/support/school-pricing/{school_id} should return global, override, effective pricing"""
        # First get an assigned school
        schools_res = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        if schools_res.status_code != 200 or len(schools_res.json()) == 0:
            pytest.skip("No assigned schools to test")
        
        school_id = schools_res.json()[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/support/school-pricing/{school_id}", headers=support_headers)
        assert response.status_code == 200, f"Get school pricing failed: {response.text}"
        
        data = response.json()
        
        # Check required fields
        assert "global" in data, "Should have global pricing config"
        assert "override" in data or data["override"] is None, "Should have override field (can be null)"
        assert "effective" in data, "Should have effective pricing"
        assert "months_active" in data, "Should have months_active"
        assert "student_count" in data, "Should have student_count"
        assert "calculated_price" in data, "Should have calculated_price"
        assert "base_charge" in data, "Should have base_charge"
        assert "student_charge" in data, "Should have student_charge"
        
        # Validate global structure
        global_config = data["global"]
        assert "base_monthly_fee" in global_config, "Global should have base_monthly_fee"
        assert "per_student_fee" in global_config, "Global should have per_student_fee"
        assert "per_student_from_month" in global_config, "Global should have per_student_from_month"
        
        # Validate effective structure
        effective = data["effective"]
        assert "base_monthly_fee" in effective, "Effective should have base_monthly_fee"
        assert "per_student_fee" in effective, "Effective should have per_student_fee"
        assert "per_student_from_month" in effective, "Effective should have per_student_from_month"
        
        print(f"School pricing details:")
        print(f"  - Global: base=S/{global_config['base_monthly_fee']}, per_student=S/{global_config['per_student_fee']}, from_month={global_config['per_student_from_month']}")
        print(f"  - Override: {data['override']}")
        print(f"  - Effective: base=S/{effective['base_monthly_fee']}, per_student=S/{effective['per_student_fee']}, from_month={effective['per_student_from_month']}")
        print(f"  - Months active: {data['months_active']}")
        print(f"  - Student count: {data['student_count']}")
        print(f"  - Calculated price: S/{data['calculated_price']}")

    def test_school_pricing_calculation_logic(self, support_headers):
        """Verify pricing calculation: base + (student_count * per_student_fee if months_active >= per_student_from_month)"""
        # Get a school
        schools_res = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        if schools_res.status_code != 200 or len(schools_res.json()) == 0:
            pytest.skip("No assigned schools to test")
        
        school_id = schools_res.json()[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/support/school-pricing/{school_id}", headers=support_headers)
        assert response.status_code == 200
        
        data = response.json()
        effective = data["effective"]
        months_active = data["months_active"]
        student_count = data["student_count"]
        per_student_from_month = effective["per_student_from_month"]
        
        # Calculate expected price
        expected_base = effective["base_monthly_fee"]
        expected_student_charge = 0
        if months_active >= per_student_from_month:
            expected_student_charge = student_count * effective["per_student_fee"]
        
        expected_total = round(expected_base + expected_student_charge, 2)
        
        # Verify
        assert data["base_charge"] == expected_base, f"base_charge ({data['base_charge']}) should match effective base ({expected_base})"
        assert round(data["student_charge"], 2) == round(expected_student_charge, 2), \
            f"student_charge ({data['student_charge']}) should match expected ({expected_student_charge})"
        assert data["calculated_price"] == expected_total, \
            f"calculated_price ({data['calculated_price']}) should equal {expected_total}"
        
        print(f"Calculation verified:")
        print(f"  - months_active ({months_active}) >= per_student_from_month ({per_student_from_month}): {months_active >= per_student_from_month}")
        print(f"  - student_count: {student_count}")
        print(f"  - base: S/{expected_base}")
        print(f"  - student_charge: S/{round(expected_student_charge, 2)}")
        print(f"  - total: S/{expected_total}")


# ═══════════════════════════════════════════════════════════════════════════════
# SCHOOL PRICING OVERRIDE TESTS  
# ═══════════════════════════════════════════════════════════════════════════════

class TestSchoolPricingOverride:
    """Test PUT /api/support/school-pricing for custom school pricing"""

    def test_set_school_pricing_override(self, support_headers):
        """PUT /api/support/school-pricing should set custom pricing for a school"""
        # Get a school
        schools_res = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        if schools_res.status_code != 200 or len(schools_res.json()) == 0:
            pytest.skip("No assigned schools to test")
        
        school = schools_res.json()[0]
        school_id = school["id"]
        had_override = school.get("pricing_override") is not None
        
        # Set custom pricing
        custom_pricing = {
            "school_id": school_id,
            "base_monthly_fee": 40.0,
            "per_student_fee": 0.50,
            "per_student_from_month": 2,
            "discount_notes": "TEST_DISCOUNT - Temporary test override"
        }
        
        response = requests.put(f"{BASE_URL}/api/support/school-pricing", 
            headers=support_headers, json=custom_pricing)
        assert response.status_code == 200, f"Set override failed: {response.text}"
        
        # Verify override is applied
        verify = requests.get(f"{BASE_URL}/api/support/school-pricing/{school_id}", headers=support_headers).json()
        assert verify["override"] is not None, "Override should be set"
        assert verify["override"]["base_monthly_fee"] == 40.0
        assert verify["override"]["per_student_fee"] == 0.50
        assert verify["override"]["per_student_from_month"] == 2
        assert verify["override"]["discount_notes"] == "TEST_DISCOUNT - Temporary test override"
        
        # Effective should use override
        assert verify["effective"]["base_monthly_fee"] == 40.0
        assert verify["effective"]["per_student_fee"] == 0.50
        assert verify["effective"]["per_student_from_month"] == 2
        
        print("Custom pricing override applied and verified")
        
        # Cleanup - remove override
        delete_res = requests.delete(f"{BASE_URL}/api/support/school-pricing/{school_id}", headers=support_headers)
        assert delete_res.status_code == 200, f"Delete override failed: {delete_res.text}"
        
        # Verify override removed
        verify_after = requests.get(f"{BASE_URL}/api/support/school-pricing/{school_id}", headers=support_headers).json()
        assert verify_after["override"] is None, "Override should be removed"
        print("Cleanup: Override removed successfully")

    def test_delete_school_pricing_override(self, support_headers):
        """DELETE /api/support/school-pricing/{school_id} should remove custom pricing"""
        # Get a school
        schools_res = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        if schools_res.status_code != 200 or len(schools_res.json()) == 0:
            pytest.skip("No assigned schools to test")
        
        school_id = schools_res.json()[0]["id"]
        
        # First set an override
        requests.put(f"{BASE_URL}/api/support/school-pricing", 
            headers=support_headers, 
            json={"school_id": school_id, "base_monthly_fee": 99.0}
        )
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/support/school-pricing/{school_id}", headers=support_headers)
        assert response.status_code == 200, f"Delete failed: {response.text}"
        
        # Verify deleted
        verify = requests.get(f"{BASE_URL}/api/support/school-pricing/{school_id}", headers=support_headers).json()
        assert verify["override"] is None, "Override should be deleted"
        print("Delete pricing override test passed")


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TEST - PRICING CALCULATION FLOW
# ═══════════════════════════════════════════════════════════════════════════════

class TestPricingCalculationFlow:
    """Integration test: Full pricing calculation flow"""

    def test_full_pricing_flow(self, support_headers):
        """Test complete pricing flow: global config -> school list -> school detail"""
        
        # 1. Get global pricing config
        global_res = requests.get(f"{BASE_URL}/api/support/pricing", headers=support_headers)
        assert global_res.status_code == 200
        global_config = global_res.json()
        print(f"1. Global config: base=S/{global_config['base_monthly_fee']}, per_student=S/{global_config['per_student_fee']}, from_month={global_config['per_student_from_month']}")
        
        # 2. Get schools list with pricing
        schools_res = requests.get(f"{BASE_URL}/api/support/schools", headers=support_headers)
        assert schools_res.status_code == 200
        schools = schools_res.json()
        print(f"2. Found {len(schools)} assigned schools with pricing data")
        
        if len(schools) == 0:
            print("No schools to verify pricing")
            return
        
        # 3. Verify each school has pricing calculated correctly
        for school in schools:
            school_name = school.get("name", school.get("subdomain", "Unknown"))
            
            # Get detailed pricing
            detail_res = requests.get(f"{BASE_URL}/api/support/school-pricing/{school['id']}", headers=support_headers)
            assert detail_res.status_code == 200
            detail = detail_res.json()
            
            # Verify list endpoint matches detail endpoint
            assert school["calculated_price"] == detail["calculated_price"], \
                f"School {school_name}: list price ({school['calculated_price']}) != detail price ({detail['calculated_price']})"
            assert school["student_count"] == detail["student_count"], \
                f"School {school_name}: list student_count ({school['student_count']}) != detail ({detail['student_count']})"
            
            print(f"3. {school_name}: S/{school['calculated_price']} ({school['student_count']} students, month {school['months_active']})")
        
        print("Full pricing flow verification completed!")
