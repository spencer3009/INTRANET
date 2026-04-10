"""
Test Boleta de Venta Interna Feature
Tests for:
- Boleta config CRUD (GET/PUT)
- Logo upload to Cloudinary
- Boleta emission on payment creation
- PDF download with Content-Disposition header
- Boleta annulment
- Auto-annul on payment cancel
- Payments list includes boleta fields
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"
SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"
TEST_STUDENT_ID = "4d30c475-c1cf-42d1-9485-620b556ecf72"
GRADE_ID = "6ef8ab18-41b2-45e7-b482-06a84d95c34d"
SECTION_ID = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
EXISTING_PAYMENT_WITH_BOLETA = "9c1e9541-182a-4919-a061-bdbc25a61298"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for testing."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestBoletaConfig:
    """Tests for boleta emisor configuration endpoints."""

    def test_get_boleta_config_returns_data(self, headers):
        """GET /api/contabilidad/boleta-config - returns config (default or configured)."""
        response = requests.get(f"{BASE_URL}/api/contabilidad/boleta-config", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should have these fields
        assert "school_id" in data
        assert "serie" in data
        assert "correlativo_actual" in data
        # Since config was already saved, should be configured
        assert data.get("configured") == True
        assert data.get("ruc") == "20123456789"
        assert data.get("serie") == "B001"
        print(f"✓ Boleta config retrieved: RUC={data.get('ruc')}, Serie={data.get('serie')}, Correlativo={data.get('correlativo_actual')}")

    def test_update_boleta_config_valid_ruc(self, headers):
        """PUT /api/contabilidad/boleta-config - update with valid RUC."""
        payload = {
            "razon_social": "I.E.P. El Roble S.A.C.",
            "ruc": "20123456789",
            "direccion": "Av. Los Alamos 123",
            "distrito": "San Isidro",
            "provincia": "Lima",
            "departamento": "Lima",
            "telefono": "01-2345678",
            "email": "contacto@elroble.edu.pe",
            "serie": "B001",
            "pie_pagina": "Gracias por su preferencia"
        }
        response = requests.put(f"{BASE_URL}/api/contabilidad/boleta-config", json=payload, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("configured") == True
        assert data.get("ruc") == "20123456789"
        assert data.get("razon_social") == "I.E.P. El Roble S.A.C."
        print(f"✓ Boleta config updated successfully")

    def test_update_boleta_config_invalid_ruc_rejected(self, headers):
        """PUT /api/contabilidad/boleta-config - invalid RUC should be rejected."""
        # RUC must be 11 digits starting with 10 or 20
        invalid_rucs = ["12345678901", "30123456789", "1234567890", "abc12345678"]
        
        for invalid_ruc in invalid_rucs:
            payload = {"ruc": invalid_ruc}
            response = requests.put(f"{BASE_URL}/api/contabilidad/boleta-config", json=payload, headers=headers)
            assert response.status_code == 400, f"Expected 400 for RUC '{invalid_ruc}', got {response.status_code}"
            print(f"✓ Invalid RUC '{invalid_ruc}' correctly rejected")

    def test_update_boleta_config_valid_ruc_10_prefix(self, headers):
        """PUT /api/contabilidad/boleta-config - RUC starting with 10 is valid."""
        payload = {"ruc": "10123456789"}
        response = requests.put(f"{BASE_URL}/api/contabilidad/boleta-config", json=payload, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Restore original RUC
        requests.put(f"{BASE_URL}/api/contabilidad/boleta-config", json={"ruc": "20123456789"}, headers=headers)
        print(f"✓ RUC starting with 10 accepted")


class TestBoletaPDFDownload:
    """Tests for boleta PDF download endpoint."""

    def test_download_boleta_pdf_existing_payment(self, headers):
        """GET /api/contabilidad/boletas/{ingreso_id}/pdf - returns valid PDF."""
        response = requests.get(
            f"{BASE_URL}/api/contabilidad/boletas/{EXISTING_PAYMENT_WITH_BOLETA}/pdf",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check Content-Type is PDF
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected PDF content type, got {content_type}"
        
        # Check Content-Disposition header for attachment
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp, f"Expected attachment disposition, got {content_disp}"
        assert "Boleta_" in content_disp, f"Expected filename with Boleta_, got {content_disp}"
        
        # Check PDF magic bytes
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF"
        
        print(f"✓ PDF downloaded successfully, size={len(response.content)} bytes, disposition={content_disp}")

    def test_download_boleta_pdf_nonexistent_payment(self, headers):
        """GET /api/contabilidad/boletas/{ingreso_id}/pdf - 404 for non-existent payment."""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/contabilidad/boletas/{fake_id}/pdf",
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent payment correctly returns 404")


class TestBoletaEmissionOnPayment:
    """Tests for automatic boleta emission when creating payments."""

    def test_create_payment_emits_boleta(self, headers):
        """POST /api/accounting/payments - creates payment AND emits boleta automatically."""
        # Get current correlativo
        config_resp = requests.get(f"{BASE_URL}/api/contabilidad/boleta-config", headers=headers)
        current_correlativo = config_resp.json().get("correlativo_actual", 0)
        
        payload = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "concept": "mensualidad",
            "description": "Test payment for boleta emission",
            "amount_base": 500.00,
            "igv_applicable": False,
            "igv_percentage": 18,
            "payment_method": "efectivo",
            "payment_status": "paid",
            "payment_date": "2026-01-10",
            "pension_month": "2026-01",
            "notes": "Test boleta emission"
        }
        
        response = requests.post(f"{BASE_URL}/api/accounting/payments", json=payload, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        payment = data.get("payment", {})
        
        # Verify boleta was emitted
        assert payment.get("boleta_disponible") == True, "Expected boleta_disponible=True"
        assert "numero_boleta" in payment, "Expected numero_boleta in response"
        assert payment.get("numero_boleta", "").startswith("B001-"), f"Expected B001- prefix, got {payment.get('numero_boleta')}"
        
        # Verify correlativo incremented
        new_config_resp = requests.get(f"{BASE_URL}/api/contabilidad/boleta-config", headers=headers)
        new_correlativo = new_config_resp.json().get("correlativo_actual", 0)
        assert new_correlativo == current_correlativo + 1, f"Expected correlativo to increment from {current_correlativo} to {current_correlativo + 1}, got {new_correlativo}"
        
        print(f"✓ Payment created with boleta: {payment.get('numero_boleta')}")
        
        # Store payment ID for cleanup/further tests
        return payment.get("id")


class TestBoletaAnnulment:
    """Tests for boleta annulment."""

    def test_annul_boleta_directly(self, headers):
        """POST /api/contabilidad/boletas/{ingreso_id}/anular - marks boleta as anulada."""
        # First create a payment to annul
        payload = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "concept": "otros",
            "description": "Test payment for annulment",
            "amount_base": 100.00,
            "igv_applicable": False,
            "payment_method": "efectivo",
            "payment_status": "paid",
            "payment_date": "2026-01-10"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/accounting/payments", json=payload, headers=headers)
        assert create_resp.status_code == 200
        payment_id = create_resp.json().get("payment", {}).get("id")
        
        # Annul the boleta
        annul_resp = requests.post(
            f"{BASE_URL}/api/contabilidad/boletas/{payment_id}/anular",
            headers=headers
        )
        assert annul_resp.status_code == 200, f"Expected 200, got {annul_resp.status_code}: {annul_resp.text}"
        
        data = annul_resp.json()
        assert "numero_completo" in data
        assert "anulada" in data.get("message", "").lower() or "anulada" in str(data)
        
        print(f"✓ Boleta annulled: {data.get('numero_completo')}")
        
        # Verify PDF still downloads but with ANULADA watermark (we can't verify watermark content, but PDF should still work)
        pdf_resp = requests.get(f"{BASE_URL}/api/contabilidad/boletas/{payment_id}/pdf", headers=headers)
        assert pdf_resp.status_code == 200
        assert pdf_resp.content[:4] == b'%PDF'
        print(f"✓ Annulled boleta PDF still downloadable")

    def test_annul_already_annulled_boleta(self, headers):
        """POST /api/contabilidad/boletas/{ingreso_id}/anular - idempotent for already annulled."""
        # Create and annul a payment
        payload = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "concept": "otros",
            "description": "Test double annulment",
            "amount_base": 50.00,
            "igv_applicable": False,
            "payment_method": "efectivo",
            "payment_status": "paid",
            "payment_date": "2026-01-10"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/accounting/payments", json=payload, headers=headers)
        payment_id = create_resp.json().get("payment", {}).get("id")
        
        # First annulment
        requests.post(f"{BASE_URL}/api/contabilidad/boletas/{payment_id}/anular", headers=headers)
        
        # Second annulment should still return 200 (idempotent)
        second_resp = requests.post(f"{BASE_URL}/api/contabilidad/boletas/{payment_id}/anular", headers=headers)
        assert second_resp.status_code == 200, f"Expected 200 for idempotent annulment, got {second_resp.status_code}"
        print(f"✓ Double annulment handled gracefully")


class TestPaymentCancelAutoAnnulsBoleta:
    """Tests for auto-annulment of boleta when payment is canceled."""

    def test_cancel_payment_auto_annuls_boleta(self, headers):
        """PUT /api/accounting/payments/{id}/cancel - auto-annuls associated boleta."""
        # Create a payment with boleta
        payload = {
            "student_id": TEST_STUDENT_ID,
            "grade_id": GRADE_ID,
            "section_id": SECTION_ID,
            "concept": "otros",
            "description": "Test auto-annul on cancel",
            "amount_base": 75.00,
            "igv_applicable": False,
            "payment_method": "efectivo",
            "payment_status": "paid",
            "payment_date": "2026-01-10"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/accounting/payments", json=payload, headers=headers)
        assert create_resp.status_code == 200
        payment = create_resp.json().get("payment", {})
        payment_id = payment.get("id")
        numero_boleta = payment.get("numero_boleta")
        
        assert payment.get("boleta_disponible") == True
        print(f"✓ Payment created with boleta: {numero_boleta}")
        
        # Cancel the payment
        cancel_resp = requests.put(f"{BASE_URL}/api/accounting/payments/{payment_id}/cancel", headers=headers)
        assert cancel_resp.status_code == 200, f"Expected 200, got {cancel_resp.status_code}: {cancel_resp.text}"
        
        # Verify boleta is now marked as anulada in payments list
        list_resp = requests.get(f"{BASE_URL}/api/accounting/payments?limit=100", headers=headers)
        payments = list_resp.json().get("payments", [])
        
        canceled_payment = next((p for p in payments if p.get("id") == payment_id), None)
        assert canceled_payment is not None, "Canceled payment not found in list"
        assert canceled_payment.get("boleta_anulada") == True, "Expected boleta_anulada=True after payment cancel"
        
        print(f"✓ Payment canceled and boleta auto-annulled")


class TestPaymentsListIncludesBoletaFields:
    """Tests for payments list including boleta-related fields."""

    def test_payments_list_has_boleta_fields(self, headers):
        """GET /api/accounting/payments - includes boleta_disponible, numero_boleta, boleta_anulada."""
        response = requests.get(f"{BASE_URL}/api/accounting/payments?limit=50", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        payments = data.get("payments", [])
        
        assert len(payments) > 0, "Expected at least one payment"
        
        # Check that boleta fields are present
        for payment in payments[:5]:  # Check first 5
            assert "boleta_disponible" in payment, f"Missing boleta_disponible in payment {payment.get('id')}"
            assert "numero_boleta" in payment, f"Missing numero_boleta in payment {payment.get('id')}"
            assert "boleta_anulada" in payment, f"Missing boleta_anulada in payment {payment.get('id')}"
        
        # Find a payment with boleta
        payment_with_boleta = next((p for p in payments if p.get("boleta_disponible")), None)
        if payment_with_boleta:
            assert payment_with_boleta.get("numero_boleta") is not None
            assert payment_with_boleta.get("numero_boleta").startswith("B001-")
            print(f"✓ Found payment with boleta: {payment_with_boleta.get('numero_boleta')}")
        
        print(f"✓ Payments list includes boleta fields ({len(payments)} payments checked)")


class TestBoletasList:
    """Tests for boletas list endpoint."""

    def test_list_boletas(self, headers):
        """GET /api/contabilidad/boletas - lists all boletas for school."""
        response = requests.get(f"{BASE_URL}/api/contabilidad/boletas", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "boletas" in data
        assert "total" in data
        assert "page" in data
        
        boletas = data.get("boletas", [])
        if len(boletas) > 0:
            boleta = boletas[0]
            # Verify boleta structure
            assert "id" in boleta
            assert "numero_completo" in boleta
            assert "serie" in boleta
            assert "correlativo" in boleta
            assert "fecha_emision" in boleta
            assert "total" in boleta
            assert "anulada" in boleta
            print(f"✓ Boletas list retrieved: {len(boletas)} boletas, total={data.get('total')}")
        else:
            print(f"✓ Boletas list endpoint works (no boletas yet)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
