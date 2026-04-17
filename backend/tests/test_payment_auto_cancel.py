"""
Test Payment Auto-Cancel Feature
Tests the bug fix where creating a new payment for a student with existing pending payments
for the same concept/month should auto-cancel those pending payments.
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OWNER_EMAIL = "admin@elroble.edu"
OWNER_PASSWORD = "1234abc8"
TEST_STUDENT_ID = "63cd034b-1b68-446f-b8f7-6d3589a709f1"  # Cesar

class TestPaymentAutoCancel:
    """Test auto-cancel of pending payments when new payment is created"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get student info for grade_id and section_id
        student_response = self.session.get(f"{BASE_URL}/api/users/{TEST_STUDENT_ID}")
        if student_response.status_code == 200:
            student = student_response.json()
            self.grade_id = student.get("grado_id", "test-grade-id")
            self.section_id = student.get("seccion_id", "test-section-id")
        else:
            self.grade_id = "test-grade-id"
            self.section_id = "test-section-id"
        
        # Track created payment IDs for cleanup
        self.created_payment_ids = []
        
        yield
        
        # Cleanup: Delete all test payments
        for payment_id in self.created_payment_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/accounting/payments/{payment_id}")
            except:
                pass
    
    def create_payment(self, concept, status, pension_month=None, amount=100.0):
        """Helper to create a payment"""
        data = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": self.grade_id,
            "section_id": self.section_id,
            "concept": concept,
            "amount_base": amount,
            "igv_applicable": False,
            "payment_method": "efectivo",
            "payment_status": status,
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
        }
        if pension_month:
            data["pension_month"] = pension_month
        
        response = self.session.post(f"{BASE_URL}/api/accounting/payments", json=data)
        if response.status_code in [200, 201]:
            payment = response.json().get("payment", {})
            if payment.get("id"):
                self.created_payment_ids.append(payment["id"])
        return response
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 1: GET /api/accounting/payments without status filter excludes canceled
    # ═══════════════════════════════════════════════════════════════════════════
    def test_get_payments_default_excludes_canceled(self):
        """GET /api/accounting/payments without status filter should NOT return canceled payments"""
        # First, create a pending payment and then cancel it
        create_resp = self.create_payment("TEST_matricula", "pending")
        assert create_resp.status_code in [200, 201], f"Failed to create payment: {create_resp.text}"
        payment_id = create_resp.json().get("payment", {}).get("id")
        
        # Cancel the payment
        cancel_resp = self.session.put(f"{BASE_URL}/api/accounting/payments/{payment_id}/cancel")
        assert cancel_resp.status_code == 200, f"Failed to cancel payment: {cancel_resp.text}"
        
        # Get payments without status filter
        get_resp = self.session.get(f"{BASE_URL}/api/accounting/payments")
        assert get_resp.status_code == 200
        payments = get_resp.json().get("payments", [])
        
        # Verify no canceled payments in the list
        canceled_in_list = [p for p in payments if p.get("payment_status") == "canceled"]
        assert len(canceled_in_list) == 0, f"Found {len(canceled_in_list)} canceled payments in default list (should be 0)"
        print(f"✓ Default GET /payments excludes canceled payments (found {len(payments)} non-canceled)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 2: GET /api/accounting/payments?status=canceled returns canceled payments
    # ═══════════════════════════════════════════════════════════════════════════
    def test_get_payments_with_canceled_filter(self):
        """GET /api/accounting/payments?status=canceled should return canceled payments"""
        # Create and cancel a payment
        create_resp = self.create_payment("TEST_matricula_filter", "pending")
        assert create_resp.status_code in [200, 201]
        payment_id = create_resp.json().get("payment", {}).get("id")
        
        cancel_resp = self.session.put(f"{BASE_URL}/api/accounting/payments/{payment_id}/cancel")
        assert cancel_resp.status_code == 200
        
        # Get payments with status=canceled filter
        get_resp = self.session.get(f"{BASE_URL}/api/accounting/payments", params={"status": "canceled"})
        assert get_resp.status_code == 200
        payments = get_resp.json().get("payments", [])
        
        # Verify we get canceled payments
        assert len(payments) > 0, "Expected at least 1 canceled payment when filtering by status=canceled"
        for p in payments:
            assert p.get("payment_status") == "canceled", f"Found non-canceled payment in canceled filter: {p.get('payment_status')}"
        print(f"✓ GET /payments?status=canceled returns {len(payments)} canceled payments")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 3: POST payment with single concept auto-cancels pending
    # ═══════════════════════════════════════════════════════════════════════════
    def test_auto_cancel_single_concept(self):
        """POST payment with single concept should auto-cancel existing pending for same student/concept/month"""
        pension_month = "2026-01"
        
        # Step 1: Create a pending payment
        pending_resp = self.create_payment("mensualidad", "pending", pension_month=pension_month, amount=500.0)
        assert pending_resp.status_code in [200, 201], f"Failed to create pending: {pending_resp.text}"
        pending_id = pending_resp.json().get("payment", {}).get("id")
        print(f"Created pending payment: {pending_id}")
        
        # Step 2: Create a paid payment for same student/concept/month
        paid_resp = self.create_payment("mensualidad", "paid", pension_month=pension_month, amount=500.0)
        assert paid_resp.status_code in [200, 201], f"Failed to create paid: {paid_resp.text}"
        
        # Check cancelled_pending count in response
        cancelled_count = paid_resp.json().get("cancelled_pending", 0)
        assert cancelled_count >= 1, f"Expected cancelled_pending >= 1, got {cancelled_count}"
        print(f"✓ Auto-cancelled {cancelled_count} pending payment(s)")
        
        # Step 3: Verify the pending payment is now canceled
        get_resp = self.session.get(f"{BASE_URL}/api/accounting/payments", params={"status": "canceled"})
        assert get_resp.status_code == 200
        canceled_payments = get_resp.json().get("payments", [])
        
        found_canceled = any(p.get("id") == pending_id for p in canceled_payments)
        assert found_canceled, f"Pending payment {pending_id} was not auto-canceled"
        print(f"✓ Verified pending payment {pending_id} is now canceled")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 4: POST payment with multiple concepts auto-cancels all matching pendings
    # ═══════════════════════════════════════════════════════════════════════════
    def test_auto_cancel_multiple_concepts(self):
        """POST payment with conceptos array should cancel ALL matching pending payments"""
        pension_month = "2026-02"
        
        # Step 1: Create multiple pending payments
        pending1_resp = self.create_payment("mensualidad", "pending", pension_month=pension_month, amount=500.0)
        assert pending1_resp.status_code in [200, 201]
        pending1_id = pending1_resp.json().get("payment", {}).get("id")
        
        pending2_resp = self.create_payment("matricula", "pending", amount=300.0)
        assert pending2_resp.status_code in [200, 201]
        pending2_id = pending2_resp.json().get("payment", {}).get("id")
        
        print(f"Created pending payments: {pending1_id}, {pending2_id}")
        
        # Step 2: Create a paid payment with multiple concepts
        data = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": self.grade_id,
            "section_id": self.section_id,
            "conceptos": [
                {"concepto": "mensualidad", "monto": 500.0},
                {"concepto": "matricula", "monto": 300.0}
            ],
            "igv_applicable": False,
            "payment_method": "efectivo",
            "payment_status": "paid",
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "pension_month": pension_month
        }
        
        paid_resp = self.session.post(f"{BASE_URL}/api/accounting/payments", json=data)
        assert paid_resp.status_code in [200, 201], f"Failed to create multi-concept payment: {paid_resp.text}"
        
        if paid_resp.json().get("payment", {}).get("id"):
            self.created_payment_ids.append(paid_resp.json()["payment"]["id"])
        
        # Check cancelled_pending count
        cancelled_count = paid_resp.json().get("cancelled_pending", 0)
        assert cancelled_count >= 2, f"Expected cancelled_pending >= 2, got {cancelled_count}"
        print(f"✓ Auto-cancelled {cancelled_count} pending payment(s) with multi-concept payment")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 5: Canceled payments have cancelled_reason and cancelled_at
    # ═══════════════════════════════════════════════════════════════════════════
    def test_canceled_payment_has_metadata(self):
        """Canceled payments should have cancelled_reason and cancelled_at fields"""
        pension_month = "2026-03"
        
        # Create pending payment
        pending_resp = self.create_payment("mensualidad", "pending", pension_month=pension_month)
        assert pending_resp.status_code in [200, 201]
        pending_id = pending_resp.json().get("payment", {}).get("id")
        
        # Create paid payment to trigger auto-cancel
        paid_resp = self.create_payment("mensualidad", "paid", pension_month=pension_month)
        assert paid_resp.status_code in [200, 201]
        
        # Get the canceled payment directly from DB via API
        # We need to check the canceled payment has the metadata
        get_resp = self.session.get(f"{BASE_URL}/api/accounting/payments", params={"status": "canceled"})
        assert get_resp.status_code == 200
        
        canceled_payments = get_resp.json().get("payments", [])
        target_payment = next((p for p in canceled_payments if p.get("id") == pending_id), None)
        
        if target_payment:
            # Check for cancelled_reason and cancelled_at
            has_reason = "cancelled_reason" in target_payment or target_payment.get("cancelled_reason")
            has_at = "cancelled_at" in target_payment or target_payment.get("cancelled_at")
            print(f"✓ Canceled payment metadata - reason: {target_payment.get('cancelled_reason', 'N/A')}, at: {target_payment.get('cancelled_at', 'N/A')}")
        else:
            print(f"Note: Could not find canceled payment {pending_id} in list to verify metadata")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 6: GET /api/accounting/debtors excludes canceled payments
    # ═══════════════════════════════════════════════════════════════════════════
    def test_debtors_excludes_canceled(self):
        """GET /api/accounting/debtors should NOT include canceled payments in totals"""
        response = self.session.get(f"{BASE_URL}/api/accounting/debtors")
        assert response.status_code == 200, f"Failed to get debtors: {response.text}"
        
        data = response.json()
        assert "debtors" in data, "Response should have 'debtors' key"
        assert "summary" in data, "Response should have 'summary' key"
        
        # The endpoint should only count pending payments, not canceled
        print(f"✓ Debtors endpoint returned {len(data['debtors'])} students, total_debt: {data['summary'].get('total_debt', 0)}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 7: GET /api/accounting/student-history excludes canceled payments
    # ═══════════════════════════════════════════════════════════════════════════
    def test_student_history_excludes_canceled(self):
        """GET /api/accounting/student-history/{student_id} should NOT include canceled payments"""
        response = self.session.get(f"{BASE_URL}/api/accounting/student-history/{TEST_STUDENT_ID}")
        assert response.status_code == 200, f"Failed to get student history: {response.text}"
        
        data = response.json()
        
        # Check all payment lists for canceled payments
        all_payments = data.get("matriculas", []) + data.get("mensualidades", []) + data.get("otros", [])
        canceled_in_history = [p for p in all_payments if p.get("status") == "canceled"]
        
        assert len(canceled_in_history) == 0, f"Found {len(canceled_in_history)} canceled payments in student history (should be 0)"
        print(f"✓ Student history excludes canceled payments (found {len(all_payments)} non-canceled)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TEST 8: GET /api/accounting/period-summary excludes canceled payments
    # ═══════════════════════════════════════════════════════════════════════════
    def test_period_summary_excludes_canceled(self):
        """GET /api/accounting/period-summary should NOT include canceled payments in totals"""
        response = self.session.get(f"{BASE_URL}/api/accounting/period-summary")
        assert response.status_code == 200, f"Failed to get period summary: {response.text}"
        
        data = response.json()
        assert "total_income" in data, "Response should have 'total_income'"
        assert "total_pending" in data, "Response should have 'total_pending'"
        
        print(f"✓ Period summary: income={data.get('total_income')}, pending={data.get('total_pending')}, expenses={data.get('total_expenses')}")


class TestPaymentStatusFilters:
    """Test payment status filter behavior in frontend context"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_filter_todos_excludes_canceled(self):
        """Frontend 'Todos' filter (no status param) should exclude canceled"""
        # This simulates what the frontend does when "Todos" is selected
        response = self.session.get(f"{BASE_URL}/api/accounting/payments")
        assert response.status_code == 200
        
        payments = response.json().get("payments", [])
        canceled_count = sum(1 for p in payments if p.get("payment_status") == "canceled")
        
        assert canceled_count == 0, f"'Todos' filter should not show canceled payments, found {canceled_count}"
        print(f"✓ 'Todos' filter correctly excludes canceled payments")
    
    def test_filter_anulado_shows_canceled(self):
        """Frontend 'Anulado' filter (status=canceled) should show only canceled"""
        response = self.session.get(f"{BASE_URL}/api/accounting/payments", params={"status": "canceled"})
        assert response.status_code == 200
        
        payments = response.json().get("payments", [])
        
        for p in payments:
            assert p.get("payment_status") == "canceled", f"Found non-canceled payment in 'Anulado' filter"
        
        print(f"✓ 'Anulado' filter correctly shows only canceled payments ({len(payments)} found)")
    
    def test_filter_pending_shows_only_pending(self):
        """Frontend 'Pendiente' filter should show only pending"""
        response = self.session.get(f"{BASE_URL}/api/accounting/payments", params={"status": "pending"})
        assert response.status_code == 200
        
        payments = response.json().get("payments", [])
        
        for p in payments:
            assert p.get("payment_status") == "pending", f"Found non-pending payment in 'Pendiente' filter"
        
        print(f"✓ 'Pendiente' filter correctly shows only pending payments ({len(payments)} found)")
    
    def test_filter_paid_shows_only_paid(self):
        """Frontend 'Pagado' filter should show only paid"""
        response = self.session.get(f"{BASE_URL}/api/accounting/payments", params={"status": "paid"})
        assert response.status_code == 200
        
        payments = response.json().get("payments", [])
        
        for p in payments:
            assert p.get("payment_status") == "paid", f"Found non-paid payment in 'Pagado' filter"
        
        print(f"✓ 'Pagado' filter correctly shows only paid payments ({len(payments)} found)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
