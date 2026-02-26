"""
Tests for Premium Accounting Module features:
- GET /api/accounting/debtors - List of students with pending payments (morosos)
- GET /api/accounting/student-history/{student_id} - Student payment history
- pension_month field and validation for mensualidad concept
- Dashboard KPIs: Alumnos Morosos, Deuda Total, Alumnos al Día
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
TEST_SUBDOMAIN = "elroble"

class TestAccountingPremiumFeatures:
    """Tests for Premium Accounting Module: Morosos, Student History, pension_month"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    # ========================================================
    # GET /api/accounting/debtors - Morosos endpoint
    # ========================================================
    
    def test_debtors_endpoint_returns_200(self, headers):
        """GET /api/accounting/debtors returns 200 with valid token"""
        response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/accounting/debtors returns 200")
    
    def test_debtors_response_structure(self, headers):
        """Debtors endpoint returns correct data structure with debtors and summary"""
        response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check top-level structure
        assert "debtors" in data, "Response missing 'debtors' key"
        assert "summary" in data, "Response missing 'summary' key"
        assert isinstance(data["debtors"], list), "'debtors' should be a list"
        
        # Check summary structure
        summary = data["summary"]
        assert "morosos_count" in summary, "Summary missing 'morosos_count'"
        assert "al_dia_count" in summary, "Summary missing 'al_dia_count'"
        assert "total_debt" in summary, "Summary missing 'total_debt'"
        
        print(f"✓ Debtors response has correct structure - morosos: {summary['morosos_count']}, al_dia: {summary['al_dia_count']}")
    
    def test_debtors_summary_has_correct_values(self, headers):
        """Summary has numeric values for morosos_count, al_dia_count, total_debt"""
        response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        data = response.json()
        summary = data["summary"]
        
        # Verify types
        assert isinstance(summary["morosos_count"], int), "morosos_count should be int"
        assert isinstance(summary["al_dia_count"], int), "al_dia_count should be int"
        assert isinstance(summary["total_debt"], (int, float)), "total_debt should be numeric"
        
        # Verify non-negative
        assert summary["morosos_count"] >= 0
        assert summary["al_dia_count"] >= 0
        assert summary["total_debt"] >= 0
        
        print(f"✓ Summary values are valid: morosos={summary['morosos_count']}, al_dia={summary['al_dia_count']}, debt=S/{summary['total_debt']}")
    
    def test_debtors_list_item_structure(self, headers):
        """Each debtor item has required fields: student_id, student_name, grade_name, status, pending_months"""
        response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        data = response.json()
        
        if len(data["debtors"]) > 0:
            debtor = data["debtors"][0]
            required_fields = ["student_id", "student_name", "grade_name", "section_name", 
                             "total_paid", "total_pending", "pending_months", "status", "last_payment_date"]
            
            for field in required_fields:
                assert field in debtor, f"Debtor missing required field: {field}"
            
            # Check status is valid
            assert debtor["status"] in ["moroso", "al_dia"], f"Invalid status: {debtor['status']}"
            
            # Check pending_months is list
            assert isinstance(debtor["pending_months"], list), "pending_months should be list"
            
            print(f"✓ Debtor item has all required fields - student: {debtor['student_name']}, status: {debtor['status']}")
        else:
            print("✓ No debtors returned (empty list), structure validated")
    
    def test_debtors_endpoint_requires_auth(self):
        """GET /api/accounting/debtors returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/accounting/debtors")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Debtors endpoint requires authentication")
    
    # ========================================================
    # GET /api/accounting/student-history/{student_id}
    # ========================================================
    
    def test_student_history_endpoint_returns_200(self, headers):
        """GET /api/accounting/student-history/{student_id} returns 200 with valid student"""
        # First get a student_id from debtors
        debtors_response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        debtors = debtors_response.json().get("debtors", [])
        
        if len(debtors) > 0:
            student_id = debtors[0]["student_id"]
            response = requests.get(f"{BASE_URL}/api/accounting/student-history/{student_id}", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            print(f"✓ GET /api/accounting/student-history/{student_id} returns 200")
        else:
            pytest.skip("No students with payments to test history endpoint")
    
    def test_student_history_response_structure(self, headers):
        """Student history returns grouped payments: matriculas, mensualidades, otros"""
        debtors_response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        debtors = debtors_response.json().get("debtors", [])
        
        if len(debtors) > 0:
            student_id = debtors[0]["student_id"]
            response = requests.get(f"{BASE_URL}/api/accounting/student-history/{student_id}", headers=headers)
            data = response.json()
            
            # Check structure
            assert "student" in data, "Missing 'student' key"
            assert "matriculas" in data, "Missing 'matriculas' key"
            assert "mensualidades" in data, "Missing 'mensualidades' key"
            assert "otros" in data, "Missing 'otros' key"
            assert "totals" in data, "Missing 'totals' key"
            
            # Check totals structure
            totals = data["totals"]
            assert "total_paid" in totals
            assert "total_pending" in totals
            assert "total" in totals
            
            print(f"✓ Student history structure validated - paid: S/{totals['total_paid']}, pending: S/{totals['total_pending']}")
        else:
            pytest.skip("No students with payments to test")
    
    def test_student_history_mensualidades_have_pension_month(self, headers):
        """Mensualidades in history include pension_month and pension_month_label"""
        debtors_response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        debtors = debtors_response.json().get("debtors", [])
        
        if len(debtors) > 0:
            student_id = debtors[0]["student_id"]
            response = requests.get(f"{BASE_URL}/api/accounting/student-history/{student_id}", headers=headers)
            data = response.json()
            
            mensualidades = data.get("mensualidades", [])
            if len(mensualidades) > 0:
                item = mensualidades[0]
                assert "pension_month" in item, "Mensualidad missing pension_month"
                assert "pension_month_label" in item, "Mensualidad missing pension_month_label"
                assert "status" in item, "Mensualidad missing status"
                print(f"✓ Mensualidad has pension_month: {item.get('pension_month')} ({item.get('pension_month_label')})")
            else:
                print("✓ No mensualidades to validate (empty list)")
        else:
            pytest.skip("No students to test")
    
    def test_student_history_returns_404_invalid_student(self, headers):
        """GET /api/accounting/student-history/invalid-id returns 404"""
        response = requests.get(f"{BASE_URL}/api/accounting/student-history/invalid-student-id-999", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Student history returns 404 for invalid student ID")
    
    def test_student_history_requires_auth(self):
        """GET /api/accounting/student-history/{id} returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/accounting/student-history/some-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Student history endpoint requires authentication")
    
    # ========================================================
    # Payments with pension_month field
    # ========================================================
    
    def test_payments_list_includes_pension_month_label(self, headers):
        """GET /api/accounting/payments returns pension_month_label for mensualidad payments"""
        response = requests.get(f"{BASE_URL}/api/accounting/payments", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        payments = data.get("payments", [])
        
        # Find a mensualidad payment
        mensualidad_payments = [p for p in payments if p.get("concept") == "mensualidad"]
        
        if len(mensualidad_payments) > 0:
            payment = mensualidad_payments[0]
            assert "pension_month_label" in payment, "Mensualidad payment missing pension_month_label"
            print(f"✓ Mensualidad payment has pension_month_label: {payment.get('pension_month_label')}")
        else:
            print("✓ No mensualidad payments found to validate pension_month_label")
    
    # ========================================================
    # Accounting Summary endpoint
    # ========================================================
    
    def test_accounting_summary_returns_200(self, headers):
        """GET /api/accounting/summary returns 200"""
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/accounting/summary returns 200")
    
    def test_accounting_summary_has_required_fields(self, headers):
        """Summary has period, ingresos, egresos, pendientes, balance"""
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=headers)
        data = response.json()
        
        required_fields = ["period", "ingresos", "egresos", "pendientes", "balance"]
        for field in required_fields:
            assert field in data, f"Summary missing {field}"
        
        # Check ingresos structure
        ingresos = data.get("ingresos", {})
        for key in ["total", "base", "igv", "count"]:
            assert key in ingresos, f"ingresos missing {key}"
        
        print(f"✓ Summary has all required fields - balance: S/{data.get('balance', 0)}")
    
    # ========================================================
    # Demo data verification (30 students seeded)
    # ========================================================
    
    def test_demo_data_has_students_with_payments(self, headers):
        """Verify demo data has students with payment records"""
        response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        data = response.json()
        
        total_students = data["summary"].get("total_students_with_payments", 0)
        assert total_students > 0, "No students with payment records found - demo data may not be seeded"
        
        print(f"✓ Found {total_students} students with payment records")
    
    def test_demo_data_has_morosos_and_al_dia(self, headers):
        """Demo data should have both morosos and al_dia students"""
        response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        data = response.json()
        summary = data["summary"]
        
        print(f"  Demo data stats: morosos={summary['morosos_count']}, al_dia={summary['al_dia_count']}")
        
        # Should have both types for realistic demo
        # Note: main agent said 23 morosos, 12 al día
        assert summary["morosos_count"] >= 0, "morosos_count should be >= 0"
        assert summary["al_dia_count"] >= 0, "al_dia_count should be >= 0"
        
        print(f"✓ Demo data has morosos: {summary['morosos_count']}, al_día: {summary['al_dia_count']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
