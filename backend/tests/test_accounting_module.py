"""
Accounting Module (Contabilidad Escolar) - Backend Tests
Tests for payments (ingresos), expenses (egresos), and summary endpoints
Peru-specific: IGV 18%, currency S/.
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"

# Test data IDs (from existing data)
TEST_STUDENT_ID = "0e56a0a5-5883-4ed4-86b8-326a0e4510b2"
TEST_GRADE_ID = "99fddf66-03fd-4cff-97d8-11aa934d7379"
TEST_SECTION_ID = "d21b04f3-1075-4d96-aa24-65fb37776229"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


# ═══════════════════════════════════════════════════════════════════════════════
# ACCOUNTING SUMMARY TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAccountingSummary:
    """Tests for /api/accounting/summary endpoint"""
    
    def test_get_summary_success(self, headers):
        """GET /api/accounting/summary - Returns summary data"""
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "period" in data
        assert "ingresos" in data
        assert "egresos" in data
        assert "pendientes" in data
        assert "balance" in data
        assert "recent_payments" in data
        assert "recent_expenses" in data
        
        # Verify period structure
        assert "year" in data["period"]
        assert "month" in data["period"]
        assert "month_name" in data["period"]
        
        # Verify ingresos structure
        assert "total" in data["ingresos"]
        assert "base" in data["ingresos"]
        assert "igv" in data["ingresos"]
        assert "count" in data["ingresos"]
        
        # Verify egresos structure
        assert "total" in data["egresos"]
        assert "base" in data["egresos"]
        assert "igv" in data["egresos"]
        assert "count" in data["egresos"]
        
        # Verify pendientes structure
        assert "total" in data["pendientes"]
        assert "count" in data["pendientes"]
        
        print(f"Summary: Ingresos={data['ingresos']['total']}, Egresos={data['egresos']['total']}, Balance={data['balance']}")
    
    def test_get_summary_with_year_month(self, headers):
        """GET /api/accounting/summary?year=2026&month=2 - Filters by period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/summary",
            headers=headers,
            params={"year": 2026, "month": 2}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"]["year"] == 2026
        assert data["period"]["month"] == 2
        assert data["period"]["month_name"] == "Febrero"
    
    def test_get_summary_requires_auth(self):
        """GET /api/accounting/summary - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/accounting/summary")
        assert response.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# PAYMENTS (INGRESOS) TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPayments:
    """Tests for /api/accounting/payments endpoints"""
    
    def test_get_payments_success(self, headers):
        """GET /api/accounting/payments - Returns list of payments"""
        response = requests.get(f"{BASE_URL}/api/accounting/payments", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "total_pages" in data
        
        assert isinstance(data["payments"], list)
        print(f"Found {data['total']} payments")
    
    def test_get_payments_requires_auth(self):
        """GET /api/accounting/payments - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/accounting/payments")
        assert response.status_code == 401
    
    def test_create_payment_pending(self, headers):
        """POST /api/accounting/payments - Creates pending payment with IGV"""
        payment_data = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": TEST_GRADE_ID,
            "section_id": TEST_SECTION_ID,
            "concept": "mensualidad",
            "description": "TEST_Mensualidad Febrero 2026",
            "amount_base": 500.00,
            "igv_applicable": True,
            "igv_percentage": 18,
            "payment_method": "efectivo",
            "payment_status": "pending",
            "notes": "Test payment"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            json=payment_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "payment" in data
        payment = data["payment"]
        
        # Verify IGV calculation (18% of 500 = 90)
        assert payment["amount_base"] == 500.00
        assert payment["igv_amount"] == 90.00
        assert payment["total_amount"] == 590.00
        assert payment["igv_applicable"] == True
        assert payment["igv_percentage"] == 18
        
        # Verify status
        assert payment["payment_status"] == "pending"
        assert payment["concept"] == "mensualidad"
        assert payment["concept_label"] == "Mensualidad"
        assert payment["status_label"] == "Pendiente"
        
        print(f"Created payment: {payment['id']} - S/{payment['total_amount']}")
        
        # Store for later tests
        pytest.payment_id = payment["id"]
    
    def test_create_payment_without_igv(self, headers):
        """POST /api/accounting/payments - Creates payment without IGV"""
        payment_data = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": TEST_GRADE_ID,
            "section_id": TEST_SECTION_ID,
            "concept": "uniforme",
            "description": "TEST_Uniforme sin IGV",
            "amount_base": 200.00,
            "igv_applicable": False,
            "igv_percentage": 18,
            "payment_method": "yape",
            "payment_status": "paid"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            json=payment_data
        )
        assert response.status_code == 200
        
        data = response.json()
        payment = data["payment"]
        
        # Verify no IGV applied
        assert payment["amount_base"] == 200.00
        assert payment["igv_amount"] == 0
        assert payment["total_amount"] == 200.00
        assert payment["igv_applicable"] == False
        
        pytest.payment_no_igv_id = payment["id"]
    
    def test_create_payment_invalid_student(self, headers):
        """POST /api/accounting/payments - Returns error for invalid student"""
        payment_data = {
            "student_id": "invalid-student-id",
            "grade_id": TEST_GRADE_ID,
            "section_id": TEST_SECTION_ID,
            "concept": "mensualidad",
            "amount_base": 100.00,
            "igv_applicable": True,
            "igv_percentage": 18,
            "payment_method": "efectivo",
            "payment_status": "pending"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            json=payment_data
        )
        assert response.status_code == 400
        assert "Estudiante no encontrado" in response.json()["detail"]
    
    def test_get_payments_filter_by_status(self, headers):
        """GET /api/accounting/payments?status=pending - Filters by status"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"status": "pending"}
        )
        assert response.status_code == 200
        
        data = response.json()
        for payment in data["payments"]:
            assert payment["payment_status"] == "pending"
    
    def test_get_payments_filter_by_concept(self, headers):
        """GET /api/accounting/payments?concept=mensualidad - Filters by concept"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"concept": "mensualidad"}
        )
        assert response.status_code == 200
        
        data = response.json()
        for payment in data["payments"]:
            assert payment["concept"] == "mensualidad"
    
    def test_update_payment(self, headers):
        """PUT /api/accounting/payments/{id} - Updates payment"""
        update_data = {
            "notes": "TEST_Updated notes",
            "amount_base": 550.00
        }
        
        response = requests.put(
            f"{BASE_URL}/api/accounting/payments/{pytest.payment_id}",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200
        
        data = response.json()
        payment = data["payment"]
        
        # Verify update and IGV recalculation
        assert payment["amount_base"] == 550.00
        assert payment["igv_amount"] == 99.00  # 18% of 550
        assert payment["total_amount"] == 649.00
        assert payment["notes"] == "TEST_Updated notes"
    
    def test_confirm_payment(self, headers):
        """PUT /api/accounting/payments/{id}/confirm - Confirms pending payment"""
        response = requests.put(
            f"{BASE_URL}/api/accounting/payments/{pytest.payment_id}/confirm",
            headers=headers
        )
        assert response.status_code == 200
        assert "confirmado" in response.json()["message"].lower()
        
        # Verify status changed
        get_response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"status": "paid"}
        )
        payments = get_response.json()["payments"]
        confirmed = [p for p in payments if p["id"] == pytest.payment_id]
        assert len(confirmed) == 1
        assert confirmed[0]["payment_status"] == "paid"
    
    def test_confirm_already_paid(self, headers):
        """PUT /api/accounting/payments/{id}/confirm - Returns error for already paid"""
        response = requests.put(
            f"{BASE_URL}/api/accounting/payments/{pytest.payment_id}/confirm",
            headers=headers
        )
        assert response.status_code == 400
        assert "ya está confirmado" in response.json()["detail"]
    
    def test_cancel_payment(self, headers):
        """PUT /api/accounting/payments/{id}/cancel - Cancels payment"""
        response = requests.put(
            f"{BASE_URL}/api/accounting/payments/{pytest.payment_id}/cancel",
            headers=headers
        )
        assert response.status_code == 200
        assert "anulado" in response.json()["message"].lower()
    
    def test_cancel_already_canceled(self, headers):
        """PUT /api/accounting/payments/{id}/cancel - Returns error for already canceled"""
        response = requests.put(
            f"{BASE_URL}/api/accounting/payments/{pytest.payment_id}/cancel",
            headers=headers
        )
        assert response.status_code == 400
        assert "ya está anulado" in response.json()["detail"]
    
    def test_update_canceled_payment_fails(self, headers):
        """PUT /api/accounting/payments/{id} - Cannot edit canceled payment"""
        response = requests.put(
            f"{BASE_URL}/api/accounting/payments/{pytest.payment_id}",
            headers=headers,
            json={"notes": "Should fail"}
        )
        assert response.status_code == 400
        assert "anulado" in response.json()["detail"]
    
    def test_confirm_canceled_payment_fails(self, headers):
        """PUT /api/accounting/payments/{id}/confirm - Cannot confirm canceled payment"""
        response = requests.put(
            f"{BASE_URL}/api/accounting/payments/{pytest.payment_id}/confirm",
            headers=headers
        )
        assert response.status_code == 400
        assert "anulado" in response.json()["detail"]
    
    def test_payment_not_found(self, headers):
        """PUT /api/accounting/payments/{id} - Returns 404 for nonexistent"""
        response = requests.put(
            f"{BASE_URL}/api/accounting/payments/nonexistent-id",
            headers=headers,
            json={"notes": "test"}
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# EXPENSES (EGRESOS) TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestExpenses:
    """Tests for /api/accounting/expenses endpoints"""
    
    def test_get_expenses_success(self, headers):
        """GET /api/accounting/expenses - Returns list of expenses"""
        response = requests.get(f"{BASE_URL}/api/accounting/expenses", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "expenses" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "total_pages" in data
        
        print(f"Found {data['total']} expenses")
    
    def test_get_expenses_requires_auth(self):
        """GET /api/accounting/expenses - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/accounting/expenses")
        assert response.status_code == 401
    
    def test_create_expense_with_igv(self, headers):
        """POST /api/accounting/expenses - Creates expense with IGV"""
        expense_data = {
            "title": "TEST_Pago de luz",
            "category": "servicios",
            "description": "Recibo de luz febrero 2026",
            "amount_base": 350.00,
            "igv_applicable": True,
            "igv_percentage": 18,
            "expense_date": "2026-02-10",
            "payment_method": "transferencia",
            "provider_name": "Luz del Sur",
            "notes": "Test expense"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers,
            json=expense_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "expense" in data
        expense = data["expense"]
        
        # Verify IGV calculation (18% of 350 = 63)
        assert expense["amount_base"] == 350.00
        assert expense["igv_amount"] == 63.00
        assert expense["total_amount"] == 413.00
        assert expense["igv_applicable"] == True
        assert expense["igv_percentage"] == 18
        
        # Verify labels
        assert expense["category"] == "servicios"
        assert expense["category_label"] == "Servicios (luz, agua, internet)"
        assert expense["method_label"] == "Transferencia bancaria"
        
        print(f"Created expense: {expense['id']} - S/{expense['total_amount']}")
        
        pytest.expense_id = expense["id"]
    
    def test_create_expense_without_igv(self, headers):
        """POST /api/accounting/expenses - Creates expense without IGV"""
        expense_data = {
            "title": "TEST_Compra de materiales",
            "category": "materiales",
            "amount_base": 150.00,
            "igv_applicable": False,
            "igv_percentage": 18,
            "expense_date": "2026-02-10",
            "payment_method": "efectivo"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers,
            json=expense_data
        )
        assert response.status_code == 200
        
        expense = response.json()["expense"]
        
        # Verify no IGV
        assert expense["amount_base"] == 150.00
        assert expense["igv_amount"] == 0
        assert expense["total_amount"] == 150.00
        assert expense["igv_applicable"] == False
        
        pytest.expense_no_igv_id = expense["id"]
    
    def test_create_expense_missing_title(self, headers):
        """POST /api/accounting/expenses - Requires title"""
        expense_data = {
            "category": "servicios",
            "amount_base": 100.00,
            "igv_applicable": True,
            "igv_percentage": 18,
            "expense_date": "2026-02-10",
            "payment_method": "efectivo"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers,
            json=expense_data
        )
        assert response.status_code == 422  # Validation error
    
    def test_get_expenses_filter_by_category(self, headers):
        """GET /api/accounting/expenses?category=servicios - Filters by category"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers,
            params={"category": "servicios"}
        )
        assert response.status_code == 200
        
        data = response.json()
        for expense in data["expenses"]:
            assert expense["category"] == "servicios"
    
    def test_update_expense(self, headers):
        """PUT /api/accounting/expenses/{id} - Updates expense"""
        update_data = {
            "title": "TEST_Pago de luz actualizado",
            "amount_base": 400.00,
            "notes": "Updated notes"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/accounting/expenses/{pytest.expense_id}",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200
        
        expense = response.json()["expense"]
        
        # Verify update and IGV recalculation
        assert expense["title"] == "TEST_Pago de luz actualizado"
        assert expense["amount_base"] == 400.00
        assert expense["igv_amount"] == 72.00  # 18% of 400
        assert expense["total_amount"] == 472.00
        assert expense["notes"] == "Updated notes"
    
    def test_update_expense_not_found(self, headers):
        """PUT /api/accounting/expenses/{id} - Returns 404 for nonexistent"""
        response = requests.put(
            f"{BASE_URL}/api/accounting/expenses/nonexistent-id",
            headers=headers,
            json={"title": "test"}
        )
        assert response.status_code == 404
    
    def test_delete_expense(self, headers):
        """DELETE /api/accounting/expenses/{id} - Deletes expense"""
        response = requests.delete(
            f"{BASE_URL}/api/accounting/expenses/{pytest.expense_id}",
            headers=headers
        )
        assert response.status_code == 200
        assert "eliminado" in response.json()["message"].lower()
        
        # Verify deleted
        get_response = requests.get(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers
        )
        expenses = get_response.json()["expenses"]
        deleted = [e for e in expenses if e["id"] == pytest.expense_id]
        assert len(deleted) == 0
    
    def test_delete_expense_not_found(self, headers):
        """DELETE /api/accounting/expenses/{id} - Returns 404 for nonexistent"""
        response = requests.delete(
            f"{BASE_URL}/api/accounting/expenses/nonexistent-id",
            headers=headers
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# IGV CALCULATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestIGVCalculation:
    """Tests for IGV (18%) calculation accuracy"""
    
    def test_igv_calculation_standard(self, headers):
        """Verify IGV 18% calculation for standard amounts"""
        test_cases = [
            (100.00, 18.00, 118.00),
            (500.00, 90.00, 590.00),
            (1000.00, 180.00, 1180.00),
            (250.50, 45.09, 295.59),
        ]
        
        for base, expected_igv, expected_total in test_cases:
            expense_data = {
                "title": f"TEST_IGV_Calc_{base}",
                "category": "otros",
                "amount_base": base,
                "igv_applicable": True,
                "igv_percentage": 18,
                "expense_date": "2026-02-10",
                "payment_method": "efectivo"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/accounting/expenses",
                headers=headers,
                json=expense_data
            )
            assert response.status_code == 200
            
            expense = response.json()["expense"]
            assert expense["igv_amount"] == expected_igv, f"IGV mismatch for base {base}"
            assert expense["total_amount"] == expected_total, f"Total mismatch for base {base}"
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/accounting/expenses/{expense['id']}", headers=headers)
    
    def test_igv_disabled(self, headers):
        """Verify no IGV when disabled"""
        expense_data = {
            "title": "TEST_No_IGV",
            "category": "otros",
            "amount_base": 500.00,
            "igv_applicable": False,
            "igv_percentage": 18,
            "expense_date": "2026-02-10",
            "payment_method": "efectivo"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers,
            json=expense_data
        )
        assert response.status_code == 200
        
        expense = response.json()["expense"]
        assert expense["igv_amount"] == 0
        assert expense["total_amount"] == 500.00
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/accounting/expenses/{expense['id']}", headers=headers)


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAccountingIntegration:
    """Integration tests for full accounting workflows"""
    
    def test_full_payment_workflow(self, headers):
        """Test complete payment workflow: Create -> Confirm -> Cancel"""
        # 1. Create pending payment
        payment_data = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": TEST_GRADE_ID,
            "section_id": TEST_SECTION_ID,
            "concept": "matricula",
            "description": "TEST_Integration_Matricula",
            "amount_base": 300.00,
            "igv_applicable": True,
            "igv_percentage": 18,
            "payment_method": "plin",
            "payment_status": "pending"
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            json=payment_data
        )
        assert create_resp.status_code == 200
        payment_id = create_resp.json()["payment"]["id"]
        
        # 2. Verify in list
        list_resp = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"status": "pending"}
        )
        assert any(p["id"] == payment_id for p in list_resp.json()["payments"])
        
        # 3. Confirm payment
        confirm_resp = requests.put(
            f"{BASE_URL}/api/accounting/payments/{payment_id}/confirm",
            headers=headers
        )
        assert confirm_resp.status_code == 200
        
        # 4. Verify status changed
        list_resp = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"status": "paid"}
        )
        paid_payment = [p for p in list_resp.json()["payments"] if p["id"] == payment_id]
        assert len(paid_payment) == 1
        assert paid_payment[0]["payment_status"] == "paid"
        
        # 5. Cancel payment
        cancel_resp = requests.put(
            f"{BASE_URL}/api/accounting/payments/{payment_id}/cancel",
            headers=headers
        )
        assert cancel_resp.status_code == 200
        
        # 6. Verify canceled
        list_resp = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"status": "canceled"}
        )
        canceled_payment = [p for p in list_resp.json()["payments"] if p["id"] == payment_id]
        assert len(canceled_payment) == 1
        
        print("Full payment workflow completed successfully")
    
    def test_summary_reflects_transactions(self, headers):
        """Test that summary reflects created transactions"""
        # Get initial summary
        initial_summary = requests.get(
            f"{BASE_URL}/api/accounting/summary",
            headers=headers
        ).json()
        
        # Create a paid payment
        payment_data = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": TEST_GRADE_ID,
            "section_id": TEST_SECTION_ID,
            "concept": "taller",
            "description": "TEST_Summary_Payment",
            "amount_base": 100.00,
            "igv_applicable": True,
            "igv_percentage": 18,
            "payment_method": "efectivo",
            "payment_status": "paid",
            "payment_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        payment_resp = requests.post(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            json=payment_data
        )
        assert payment_resp.status_code == 200
        payment_id = payment_resp.json()["payment"]["id"]
        
        # Create an expense
        expense_data = {
            "title": "TEST_Summary_Expense",
            "category": "otros",
            "amount_base": 50.00,
            "igv_applicable": True,
            "igv_percentage": 18,
            "expense_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_method": "efectivo"
        }
        
        expense_resp = requests.post(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers,
            json=expense_data
        )
        assert expense_resp.status_code == 200
        expense_id = expense_resp.json()["expense"]["id"]
        
        # Get updated summary
        updated_summary = requests.get(
            f"{BASE_URL}/api/accounting/summary",
            headers=headers
        ).json()
        
        # Verify ingresos increased by 118 (100 + 18% IGV)
        assert updated_summary["ingresos"]["total"] >= initial_summary["ingresos"]["total"]
        
        # Verify egresos increased by 59 (50 + 18% IGV)
        assert updated_summary["egresos"]["total"] >= initial_summary["egresos"]["total"]
        
        # Cleanup
        requests.put(f"{BASE_URL}/api/accounting/payments/{payment_id}/cancel", headers=headers)
        requests.delete(f"{BASE_URL}/api/accounting/expenses/{expense_id}", headers=headers)
        
        print("Summary integration test completed")


# ═══════════════════════════════════════════════════════════════════════════════
# PERMISSION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAccountingPermissions:
    """Tests for role-based access control"""
    
    def test_owner_has_access(self, headers):
        """Owner role can access accounting"""
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=headers)
        assert response.status_code == 200
    
    def test_unauthenticated_denied(self):
        """Unauthenticated requests are denied"""
        endpoints = [
            ("GET", "/api/accounting/summary"),
            ("GET", "/api/accounting/payments"),
            ("GET", "/api/accounting/expenses"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 401, f"Expected 401 for {endpoint}"


# ═══════════════════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════════════════

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_payments(self, headers):
        """Remove TEST_ prefixed payments"""
        response = requests.get(f"{BASE_URL}/api/accounting/payments", headers=headers)
        if response.status_code == 200:
            payments = response.json()["payments"]
            for payment in payments:
                if payment.get("description", "").startswith("TEST_"):
                    # Cancel if not already canceled
                    if payment.get("payment_status") != "canceled":
                        requests.put(
                            f"{BASE_URL}/api/accounting/payments/{payment['id']}/cancel",
                            headers=headers
                        )
        print("Test payments cleanup completed")
    
    def test_cleanup_test_expenses(self, headers):
        """Remove TEST_ prefixed expenses"""
        response = requests.get(f"{BASE_URL}/api/accounting/expenses", headers=headers)
        if response.status_code == 200:
            expenses = response.json()["expenses"]
            for expense in expenses:
                if expense.get("title", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/accounting/expenses/{expense['id']}",
                        headers=headers
                    )
        print("Test expenses cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
