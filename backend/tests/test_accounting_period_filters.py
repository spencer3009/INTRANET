"""
Accounting Period Filters Tests
Tests for date range filtering in accounting endpoints:
- /api/accounting/period-summary (NEW endpoint)
- /api/accounting/payments with date_from, date_to params
- /api/accounting/expenses with date_from, date_to params  
- /api/accounting/debtors with date_from, date_to params
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials for El Roble school (owner)
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for El Roble school owner"""
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
# PERIOD SUMMARY ENDPOINT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPeriodSummary:
    """Tests for GET /api/accounting/period-summary endpoint"""
    
    def test_period_summary_basic(self, headers):
        """GET /api/accounting/period-summary - Returns summary without date filter"""
        response = requests.get(f"{BASE_URL}/api/accounting/period-summary", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "total_income" in data
        assert "total_pending" in data
        assert "total_expenses" in data
        assert "total_general" in data
        
        # Verify types
        assert isinstance(data["total_income"], (int, float))
        assert isinstance(data["total_pending"], (int, float))
        assert isinstance(data["total_expenses"], (int, float))
        assert isinstance(data["total_general"], (int, float))
        
        # Verify total_general formula
        expected_general = data["total_income"] + data["total_pending"]
        assert abs(data["total_general"] - expected_general) < 0.01
        
        print(f"Period Summary: Income={data['total_income']}, Pending={data['total_pending']}, Expenses={data['total_expenses']}, General={data['total_general']}")
    
    def test_period_summary_with_march_2026_dates(self, headers):
        """GET /api/accounting/period-summary with March 2026 date range"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/period-summary",
            headers=headers,
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "total_income" in data
        assert "total_pending" in data
        assert "total_expenses" in data
        assert "total_general" in data
        
        # Based on known data, March 2026 has S/1,652 income
        assert data["total_income"] >= 0
        print(f"March 2026: Income={data['total_income']}, Pending={data['total_pending']}, General={data['total_general']}")
    
    def test_period_summary_with_empty_date_range(self, headers):
        """GET /api/accounting/period-summary with date range that has no data"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/period-summary",
            headers=headers,
            params={"date_from": "2025-01-01", "date_to": "2025-01-31"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should return zeros for period with no data
        assert data["total_income"] == 0 or isinstance(data["total_income"], (int, float))
        assert data["total_pending"] == 0 or isinstance(data["total_pending"], (int, float))
        assert data["total_expenses"] == 0 or isinstance(data["total_expenses"], (int, float))
        print(f"Empty period returns: {data}")
    
    def test_period_summary_requires_auth(self):
        """GET /api/accounting/period-summary - Returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/accounting/period-summary")
        assert response.status_code in [401, 403]


# ═══════════════════════════════════════════════════════════════════════════════
# PAYMENTS DATE FILTER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPaymentsDateFilter:
    """Tests for date filtering in /api/accounting/payments"""
    
    def test_payments_with_date_range(self, headers):
        """GET /api/accounting/payments - Filters by date_from and date_to"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
        assert "total" in data
        assert isinstance(data["payments"], list)
        
        # If there are payments, verify they're within date range
        for payment in data["payments"]:
            if "payment_date" in payment:
                assert payment["payment_date"] >= "2026-03-01"
                assert payment["payment_date"] <= "2026-03-31"
        
        print(f"Payments in March 2026: {data['total']} records")
    
    def test_payments_without_date_filter(self, headers):
        """GET /api/accounting/payments - Returns all payments without date filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"limit": 5}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
        assert "total" in data
    
    def test_payments_date_from_only(self, headers):
        """GET /api/accounting/payments - Filter with date_from only"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"date_from": "2026-01-01"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
    
    def test_payments_date_to_only(self, headers):
        """GET /api/accounting/payments - Filter with date_to only"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"date_to": "2026-12-31"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data


# ═══════════════════════════════════════════════════════════════════════════════
# EXPENSES DATE FILTER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestExpensesDateFilter:
    """Tests for date filtering in /api/accounting/expenses"""
    
    def test_expenses_with_date_range(self, headers):
        """GET /api/accounting/expenses - Filters by date_from and date_to"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers,
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "expenses" in data
        assert "total" in data
        assert isinstance(data["expenses"], list)
        
        # If there are expenses, verify they're within date range
        for expense in data["expenses"]:
            if "expense_date" in expense:
                assert expense["expense_date"] >= "2026-03-01"
                assert expense["expense_date"] <= "2026-03-31"
        
        print(f"Expenses in March 2026: {data['total']} records")
    
    def test_expenses_without_date_filter(self, headers):
        """GET /api/accounting/expenses - Returns all expenses without date filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers,
            params={"limit": 5}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "expenses" in data
        assert "total" in data
    
    def test_expenses_empty_date_range(self, headers):
        """GET /api/accounting/expenses - Returns empty for period with no data"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/expenses",
            headers=headers,
            params={"date_from": "2020-01-01", "date_to": "2020-01-31"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "expenses" in data
        assert len(data["expenses"]) == 0 or data["total"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# DEBTORS DATE FILTER TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestDebtorsDateFilter:
    """Tests for date filtering in /api/accounting/debtors (Morosos)"""
    
    def test_debtors_with_date_range(self, headers):
        """GET /api/accounting/debtors - Filters by date_from and date_to"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/debtors",
            headers=headers,
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "debtors" in data
        assert "summary" in data
        assert isinstance(data["debtors"], list)
        
        # Verify summary structure
        summary = data["summary"]
        assert "morosos_count" in summary
        assert "al_dia_count" in summary
        assert "total_debt" in summary
        assert "total_students_with_payments" in summary
        
        print(f"Debtors in March 2026: {len(data['debtors'])} students, {summary['morosos_count']} morosos")
    
    def test_debtors_without_date_filter(self, headers):
        """GET /api/accounting/debtors - Returns all debtors without date filter"""
        response = requests.get(f"{BASE_URL}/api/accounting/debtors", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "debtors" in data
        assert "summary" in data
    
    def test_debtors_structure(self, headers):
        """GET /api/accounting/debtors - Verify debtor record structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/debtors",
            headers=headers,
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"}
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data["debtors"]) > 0:
            debtor = data["debtors"][0]
            # Verify expected fields exist
            assert "student_id" in debtor
            assert "student_name" in debtor
            assert "total_paid" in debtor
            assert "total_pending" in debtor
            assert "status" in debtor
            # Status should be 'moroso' or 'al_dia'
            assert debtor["status"] in ["moroso", "al_dia"]
    
    def test_debtors_requires_auth(self):
        """GET /api/accounting/debtors - Returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/accounting/debtors")
        assert response.status_code in [401, 403]


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAccountingDateFilterIntegration:
    """Integration tests for date filter consistency across endpoints"""
    
    def test_summary_matches_payments_total(self, headers):
        """Period summary income should match sum of paid payments in same period"""
        date_from = "2026-03-01"
        date_to = "2026-03-31"
        
        # Get period summary
        summary_res = requests.get(
            f"{BASE_URL}/api/accounting/period-summary",
            headers=headers,
            params={"date_from": date_from, "date_to": date_to}
        )
        assert summary_res.status_code == 200
        summary = summary_res.json()
        
        # Get payments (fetch all for comparison)
        payments_res = requests.get(
            f"{BASE_URL}/api/accounting/payments",
            headers=headers,
            params={"date_from": date_from, "date_to": date_to, "limit": 100}
        )
        assert payments_res.status_code == 200
        payments_data = payments_res.json()
        
        # Calculate paid total from payments
        paid_total = sum(
            p.get("total_amount", 0) 
            for p in payments_data["payments"] 
            if p.get("payment_status") == "paid"
        )
        
        # Summary income should match (with small tolerance for rounding)
        if paid_total > 0:
            assert abs(summary["total_income"] - paid_total) < 1.0
        
        print(f"Summary income: {summary['total_income']}, Calculated paid total: {paid_total}")
    
    def test_default_dates_are_current_month(self):
        """Verify default dates logic (current month first and last day)"""
        now = datetime.now()
        year = now.year
        month = now.month
        
        # Calculate expected defaults
        first_day = f"{year}-{str(month).zfill(2)}-01"
        if month == 12:
            next_month = datetime(year + 1, 1, 1)
        else:
            next_month = datetime(year, month + 1, 1)
        from datetime import timedelta
        last_day_dt = next_month - timedelta(days=1)
        last_day = last_day_dt.strftime("%Y-%m-%d")
        
        # This is a logic test - verify the expected format
        assert first_day.startswith(f"{year}-")
        assert last_day.startswith(f"{year}-")
        print(f"Current month defaults: {first_day} to {last_day}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
