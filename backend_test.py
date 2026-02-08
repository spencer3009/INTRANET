import requests
import sys
from datetime import datetime
import uuid

class SchoolAPITester:
    def __init__(self, base_url="https://school-hub-dash.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        self.verification_code = None
        self.test_subdomain = f"test-school-{uuid.uuid4().hex[:6]}"

    def run_test(self, name, method, endpoint, expected_status, data=None, require_token=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if require_token and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            result = {
                "test_name": name,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_data": None
            }

            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result["response_data"] = response.json()
                except:
                    result["response_data"] = response.text[:200]
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                    result["error"] = error_data
                except:
                    result["error"] = response.text[:200]

            self.test_results.append(result)
            return success, response.json() if response.status_code < 500 else {}

        except Exception as e:
            print(f"❌ Failed - Exception: {str(e)}")
            result = {
                "test_name": name,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "error": str(e)
            }
            self.test_results.append(result)
            return False, {}

    def test_seed_data(self):
        """Test seeding initial data"""
        success, response = self.run_test("Seed Data", "POST", "seed", 200)
        return success

    def test_login_success(self):
        """Test login with correct credentials"""
        success, response = self.run_test(
            "Login Success", "POST", "auth/login", 200,
            data={"email": "admin@elroble.edu", "password": "admin123"}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token obtained: {self.token[:50]}...")
            return True
        return False

    def test_login_failure(self):
        """Test login with wrong credentials"""
        success, _ = self.run_test(
            "Login Failure", "POST", "auth/login", 401,
            data={"email": "wrong@email.com", "password": "wrongpass"}
        )
        return success

    def test_protected_without_token(self):
        """Test protected endpoints without token"""
        endpoints = ["dashboard/metrics", "dashboard/events", "dashboard/enrollment"]
        all_passed = True
        
        for endpoint in endpoints:
            success, _ = self.run_test(
                f"Unauthorized Access - {endpoint}", "GET", endpoint, 401
            )
            if not success:
                all_passed = False
        
        return all_passed

    def test_dashboard_metrics(self):
        """Test dashboard metrics endpoint"""
        success, response = self.run_test(
            "Dashboard Metrics", "GET", "dashboard/metrics", 200, require_token=True
        )
        if success:
            expected_fields = ["exams_projected", "tasks_delivered", "avg_students", "unread_messages"]
            for field in expected_fields:
                if field not in response:
                    print(f"   Warning: Missing field '{field}' in metrics response")
                    return False
            
            # Check specific values from requirements
            expected_values = {
                "exams_projected": 86,
                "tasks_delivered": 75, 
                "avg_students": 456,
                "unread_messages": 12
            }
            for field, expected in expected_values.items():
                if response.get(field) != expected:
                    print(f"   Warning: Expected {field}={expected}, got {response.get(field)}")
        return success

    def test_dashboard_events(self):
        """Test dashboard events endpoint"""
        success, response = self.run_test(
            "Dashboard Events", "GET", "dashboard/events", 200, require_token=True
        )
        if success and isinstance(response, list):
            if len(response) >= 3:
                print(f"   Found {len(response)} events")
                # Check first event structure
                if response:
                    event = response[0]
                    required_fields = ["id", "title", "date", "time", "category", "color"]
                    for field in required_fields:
                        if field not in event:
                            print(f"   Warning: Missing field '{field}' in event")
            else:
                print(f"   Warning: Expected at least 3 events, got {len(response)}")
        return success

    def test_dashboard_enrollment(self):
        """Test dashboard enrollment endpoint"""
        success, response = self.run_test(
            "Dashboard Enrollment", "GET", "dashboard/enrollment", 200, require_token=True
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} enrollment records")
            if response:
                record = response[0]
                if "month" not in record or "students" not in record:
                    print("   Warning: Missing required fields in enrollment data")
        return success

    # ── School Registration Tests ──
    
    def test_school_register_success(self):
        """Test new school registration"""
        form_data = {
            "school_name": "Test School EduNet",
            "contact_name": "Test Director",
            "role": "Director(a)",
            "email": self.test_email,
            "password": "password123",
            "phone": "+51987654321"
        }
        
        success, response = self.run_test(
            "School Registration", "POST", "schools/register", 200, data=form_data
        )
        
        if success:
            # Store verification code for next test
            self.verification_code = response.get('verification_code')
            required_fields = ["message", "school_id", "verification_code", "email"]
            for field in required_fields:
                if field not in response:
                    print(f"   Warning: Missing field '{field}' in registration response")
                    return False
            print(f"   School ID: {response.get('school_id')}")
            print(f"   Verification code: {response.get('verification_code')}")
            
        return success
    
    def test_school_register_duplicate_email(self):
        """Test registration with duplicate email"""
        form_data = {
            "school_name": "Another School",
            "contact_name": "Another Director",
            "role": "Director(a)",
            "email": self.test_email,  # Same email as previous test
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Duplicate Email Registration", "POST", "schools/register", 400, data=form_data
        )
        return success
    
    def test_email_verification_success(self):
        """Test email verification with correct code"""
        if not self.verification_code:
            print("   ❌ Skipping: No verification code from previous test")
            return False
            
        verification_data = {
            "email": self.test_email,
            "code": self.verification_code
        }
        
        success, response = self.run_test(
            "Email Verification Success", "POST", "schools/verify-email", 200, data=verification_data
        )
        
        if success:
            required_fields = ["message", "verified", "token", "user"]
            for field in required_fields:
                if field not in response:
                    print(f"   Warning: Missing field '{field}' in verification response")
                    return False
            
            if response.get('verified') == True and response.get('token'):
                self.token = response['token']  # Update token for onboarding test
                print(f"   Email verified successfully")
                print(f"   Token obtained: {self.token[:50]}...")
            else:
                print("   Warning: Email verification did not return proper verified status or token")
                
        return success
    
    def test_email_verification_wrong_code(self):
        """Test email verification with wrong code"""
        verification_data = {
            "email": self.test_email,
            "code": "WRONG1"
        }
        
        success, response = self.run_test(
            "Email Verification Wrong Code", "POST", "schools/verify-email", 400, data=verification_data
        )
        return success
    
    def test_subdomain_check_available(self):
        """Test subdomain availability check"""
        success, response = self.run_test(
            "Subdomain Check Available", "GET", f"schools/check-subdomain/{self.test_subdomain}", 200
        )
        
        if success:
            if response.get('available') != True:
                print(f"   Warning: Expected subdomain '{self.test_subdomain}' to be available")
                return False
            print(f"   Subdomain '{self.test_subdomain}' is available")
        
        return success
    
    def test_subdomain_check_reserved(self):
        """Test subdomain check with reserved name"""
        success, response = self.run_test(
            "Subdomain Check Reserved", "GET", "schools/check-subdomain/admin", 200
        )
        
        if success:
            if response.get('available') != False:
                print(f"   Warning: Expected 'admin' subdomain to be unavailable")
                return False
            print(f"   Reserved subdomain correctly rejected: {response.get('reason')}")
        
        return success
    
    def test_onboarding_completion(self):
        """Test onboarding completion"""
        if not self.token:
            print("   ❌ Skipping: No token from email verification")
            return False
        
        onboarding_data = {
            "subdomain": self.test_subdomain,
            "school_name": "Test School EduNet Updated"
        }
        
        success, response = self.run_test(
            "Onboarding Completion", "POST", "schools/onboarding", 200, 
            data=onboarding_data, require_token=True
        )
        
        if success:
            required_fields = ["message", "subdomain", "url"]
            for field in required_fields:
                if field not in response:
                    print(f"   Warning: Missing field '{field}' in onboarding response")
                    return False
            
            expected_url = f"{self.test_subdomain}.edunet.pe"
            if response.get('url') != expected_url:
                print(f"   Warning: Expected URL '{expected_url}', got '{response.get('url')}'")
            
            print(f"   Intranet created at: {response.get('url')}")
        
        return success

def main():
    """Run all backend API tests"""
    print("🚀 Starting Colegio El Roble Backend API Tests")
    print("=" * 50)
    
    tester = SchoolAPITester()
    
    # Test sequence
    tests = [
        ("Seed Data", tester.test_seed_data),
        ("Login Success", tester.test_login_success), 
        ("Login Failure", tester.test_login_failure),
        ("Protected Without Token", tester.test_protected_without_token),
        ("Dashboard Metrics", tester.test_dashboard_metrics),
        ("Dashboard Events", tester.test_dashboard_events),
        ("Dashboard Enrollment", tester.test_dashboard_enrollment),
    ]
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test '{test_name}' crashed: {str(e)}")

    # Print final results
    print(f"\n{'='*50}")
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print("⚠️  Some backend tests failed. Check details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())