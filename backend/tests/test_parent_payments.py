"""
Test Parent Payments Module - Premium Payment Integration
Tests the /api/parent/payments endpoint for financial status in parent dashboard.

Payment data expected:
- Pepito: 7 months (5 paid, 1 pending, 1 overdue) = 71% progress
- Juan: 7 months (4 paid, 2 pending, 1 overdue) 
- Jorge: 5 months (1 paid, 2 pending, 2 overdue) = 20% progress
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARENT_EMAIL = "miguel@gmail.com"
PARENT_PASSWORD = "1234abc8"
SUBDOMAIN = "elroble"

# Expected child IDs from the test data
CHILD_IDS = {
    "pepito": "b41a1387-5520-47b9-bd13-bf5dada51813",
    "juan": "a5afef05-95f4-4a18-864e-7afa893fbf57",
    "jorge": "bb5797a7-8734-4e81-968f-c6d772843c67"
}


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for parent user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARENT_EMAIL,
        "password": PARENT_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def api_headers(auth_token):
    """Return headers with auth token."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestParentLogin:
    """Test parent login returns valid token"""
    
    def test_parent_login_success(self):
        """Parent should be able to login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "parent"
        print(f"✓ Parent login successful, role: {data['user']['role']}")


class TestParentPaymentsAPI:
    """Test /api/parent/payments endpoint"""
    
    def test_payments_endpoint_requires_auth(self):
        """Payments endpoint should require authentication"""
        response = requests.get(
            f"{BASE_URL}/api/parent/payments",
            params={"student_id": CHILD_IDS["pepito"]}
        )
        assert response.status_code in [401, 403]
        print("✓ Payments endpoint requires authentication")
    
    def test_payments_endpoint_requires_student_id(self, api_headers):
        """Payments endpoint should require student_id parameter"""
        response = requests.get(
            f"{BASE_URL}/api/parent/payments",
            headers=api_headers
        )
        assert response.status_code == 422  # Validation error
        print("✓ Payments endpoint requires student_id parameter")
    
    def test_get_pepito_payments(self, api_headers):
        """
        Pepito should have:
        - 7 months total
        - 5 paid, 1 pending, 1 overdue
        - 71% progress (5/7)
        - overall_status: moroso (has overdue)
        """
        response = requests.get(
            f"{BASE_URL}/api/parent/payments",
            params={"student_id": CHILD_IDS["pepito"]},
            headers=api_headers
        )
        assert response.status_code == 200, f"Failed to get payments: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "student_id" in data
        assert "summary" in data
        assert "matricula" in data
        assert "monthly_detail" in data
        
        summary = data["summary"]
        print(f"Pepito Summary: {summary}")
        
        # Validate expected values
        assert summary["total_months"] == 7, f"Expected 7 months, got {summary['total_months']}"
        assert summary["paid_count"] == 5, f"Expected 5 paid, got {summary['paid_count']}"
        assert summary["pending_count"] == 1, f"Expected 1 pending, got {summary['pending_count']}"
        assert summary["overdue_count"] == 1, f"Expected 1 overdue, got {summary['overdue_count']}"
        assert summary["paid_percentage"] == 71, f"Expected 71%, got {summary['paid_percentage']}%"
        assert summary["overall_status"] == "moroso", f"Expected moroso, got {summary['overall_status']}"
        
        print(f"✓ Pepito payments correct: {summary['paid_count']}/{summary['total_months']} paid ({summary['paid_percentage']}%), status: {summary['overall_status']}")
    
    def test_get_jorge_payments(self, api_headers):
        """
        Jorge should have:
        - 5 months total
        - 1 paid, 2 pending, 2 overdue
        - 20% progress (1/5)
        - overall_status: moroso
        """
        response = requests.get(
            f"{BASE_URL}/api/parent/payments",
            params={"student_id": CHILD_IDS["jorge"]},
            headers=api_headers
        )
        assert response.status_code == 200, f"Failed to get payments: {response.text}"
        data = response.json()
        
        summary = data["summary"]
        print(f"Jorge Summary: {summary}")
        
        assert summary["total_months"] == 5, f"Expected 5 months, got {summary['total_months']}"
        assert summary["paid_count"] == 1, f"Expected 1 paid, got {summary['paid_count']}"
        assert summary["pending_count"] == 2, f"Expected 2 pending, got {summary['pending_count']}"
        assert summary["overdue_count"] == 2, f"Expected 2 overdue, got {summary['overdue_count']}"
        assert summary["paid_percentage"] == 20, f"Expected 20%, got {summary['paid_percentage']}%"
        assert summary["overall_status"] == "moroso"
        
        print(f"✓ Jorge payments correct: {summary['paid_count']}/{summary['total_months']} paid ({summary['paid_percentage']}%), status: {summary['overall_status']}")
    
    def test_get_juan_payments(self, api_headers):
        """
        Juan should have:
        - 7 months total
        - 4 paid, 2 pending, 1 overdue
        - overall_status: moroso
        """
        response = requests.get(
            f"{BASE_URL}/api/parent/payments",
            params={"student_id": CHILD_IDS["juan"]},
            headers=api_headers
        )
        assert response.status_code == 200, f"Failed to get payments: {response.text}"
        data = response.json()
        
        summary = data["summary"]
        print(f"Juan Summary: {summary}")
        
        assert summary["total_months"] == 7, f"Expected 7 months, got {summary['total_months']}"
        assert summary["paid_count"] == 4, f"Expected 4 paid, got {summary['paid_count']}"
        assert summary["pending_count"] == 2, f"Expected 2 pending, got {summary['pending_count']}"
        assert summary["overdue_count"] == 1, f"Expected 1 overdue, got {summary['overdue_count']}"
        assert summary["overall_status"] == "moroso"
        
        print(f"✓ Juan payments correct: {summary['paid_count']}/{summary['total_months']} paid, status: {summary['overall_status']}")
    
    def test_payments_summary_has_amounts(self, api_headers):
        """Payment summary should include monetary amounts"""
        response = requests.get(
            f"{BASE_URL}/api/parent/payments",
            params={"student_id": CHILD_IDS["pepito"]},
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        summary = data["summary"]
        
        # Check amount fields exist and are valid numbers
        assert "total_amount" in summary
        assert "paid_amount" in summary
        assert "pending_amount" in summary
        assert "overdue_amount" in summary
        assert "debt_amount" in summary
        
        assert isinstance(summary["total_amount"], (int, float))
        assert isinstance(summary["paid_amount"], (int, float))
        assert summary["paid_amount"] <= summary["total_amount"]
        
        # Debt should be pending + overdue
        expected_debt = summary["pending_amount"] + summary["overdue_amount"]
        assert abs(summary["debt_amount"] - expected_debt) < 0.01
        
        print(f"✓ Amounts: Total S/{summary['total_amount']}, Paid S/{summary['paid_amount']}, Debt S/{summary['debt_amount']}")
    
    def test_payments_monthly_detail(self, api_headers):
        """Monthly detail should show each month with status"""
        response = requests.get(
            f"{BASE_URL}/api/parent/payments",
            params={"student_id": CHILD_IDS["pepito"]},
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        monthly = data["monthly_detail"]
        assert len(monthly) == 7, f"Expected 7 months detail, got {len(monthly)}"
        
        # Each month should have required fields
        for month in monthly:
            assert "month_name" in month
            assert "total_amount" in month
            assert "payment_status" in month
            assert month["payment_status"] in ["paid", "pending", "overdue"]
        
        # Count statuses
        paid_months = [m for m in monthly if m["payment_status"] == "paid"]
        pending_months = [m for m in monthly if m["payment_status"] == "pending"]
        overdue_months = [m for m in monthly if m["payment_status"] == "overdue"]
        
        print(f"✓ Monthly detail: {len(paid_months)} paid, {len(pending_months)} pending, {len(overdue_months)} overdue")
    
    def test_matricula_status(self, api_headers):
        """Should show matricula payment status"""
        response = requests.get(
            f"{BASE_URL}/api/parent/payments",
            params={"student_id": CHILD_IDS["pepito"]},
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        matricula = data["matricula"]
        assert "paid" in matricula
        assert isinstance(matricula["paid"], bool)
        
        print(f"✓ Matricula paid: {matricula['paid']}")


class TestPaymentDataSwitching:
    """Test that payment data changes when switching children"""
    
    def test_payments_differ_between_children(self, api_headers):
        """Different children should have different payment data"""
        # Get Pepito payments
        resp1 = requests.get(
            f"{BASE_URL}/api/parent/payments",
            params={"student_id": CHILD_IDS["pepito"]},
            headers=api_headers
        )
        pepito_data = resp1.json()
        
        # Get Jorge payments
        resp2 = requests.get(
            f"{BASE_URL}/api/parent/payments",
            params={"student_id": CHILD_IDS["jorge"]},
            headers=api_headers
        )
        jorge_data = resp2.json()
        
        # They should be different
        assert pepito_data["summary"]["total_months"] != jorge_data["summary"]["total_months"]
        assert pepito_data["summary"]["paid_count"] != jorge_data["summary"]["paid_count"]
        
        print(f"✓ Pepito: {pepito_data['summary']['paid_count']}/{pepito_data['summary']['total_months']} months")
        print(f"✓ Jorge: {jorge_data['summary']['paid_count']}/{jorge_data['summary']['total_months']} months")
        print("✓ Payment data differs correctly between children")


class TestParentDashboardEndpoint:
    """Test that parent dashboard still works (regression test)"""
    
    def test_parent_dashboard_loads(self, api_headers):
        """Parent dashboard should load with student data"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard",
            params={"student_id": CHILD_IDS["pepito"]},
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "student" in data or "stats" in data
        print("✓ Parent dashboard endpoint working")
    
    def test_parent_me_returns_children(self, api_headers):
        """Parent profile should return linked children"""
        response = requests.get(
            f"{BASE_URL}/api/parent/me",
            headers=api_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "children" in data
        assert len(data["children"]) >= 3  # Pepito, Juan, Jorge
        
        child_names = [c.get("name", "") for c in data["children"]]
        print(f"✓ Parent has {len(data['children'])} children: {child_names}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
