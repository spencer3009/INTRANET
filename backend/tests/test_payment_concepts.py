"""
Payment Concepts (Conceptos de Pago) API Tests
Tests CRUD operations for payment concepts feature in Configuracion > Contabilidad
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"

@pytest.fixture(scope="module")
def auth_token():
    """Login and get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    """Auth headers for requests"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestPaymentConceptsGet:
    """Tests for GET /api/accounting/payment-concepts"""

    def test_get_concepts_returns_list(self, headers):
        """GET should return list with concepts array"""
        response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "concepts" in data
        assert isinstance(data["concepts"], list)

    def test_get_concepts_has_default_matricula(self, headers):
        """Should have auto-seeded Matricula concept"""
        response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts?include_inactive=true", headers=headers)
        assert response.status_code == 200
        concepts = response.json()["concepts"]
        matricula = next((c for c in concepts if c["name"] == "Matricula"), None)
        assert matricula is not None, "Matricula concept should be auto-seeded"
        assert matricula["is_default"] == True
        assert matricula["concept_type"] == "unico"

    def test_get_concepts_has_default_mensualidad(self, headers):
        """Should have auto-seeded Mensualidad concept"""
        response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts?include_inactive=true", headers=headers)
        assert response.status_code == 200
        concepts = response.json()["concepts"]
        mensualidad = next((c for c in concepts if c["name"] == "Mensualidad"), None)
        assert mensualidad is not None, "Mensualidad concept should be auto-seeded"
        assert mensualidad["is_default"] == True
        assert mensualidad["concept_type"] == "recurrente"

    def test_get_concepts_default_filters_inactive(self, headers):
        """Without include_inactive, should only return active concepts"""
        response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts", headers=headers)
        assert response.status_code == 200
        concepts = response.json()["concepts"]
        # All returned should be active
        for c in concepts:
            assert c.get("status", "active") == "active"

    def test_get_concepts_include_inactive(self, headers):
        """With include_inactive=true, should return all concepts"""
        response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts?include_inactive=true", headers=headers)
        assert response.status_code == 200
        concepts = response.json()["concepts"]
        # Should include both active and inactive
        assert len(concepts) >= 2  # At least defaults

    def test_get_concepts_has_required_fields(self, headers):
        """Each concept should have id, name, amount, concept_type, status"""
        response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts", headers=headers)
        assert response.status_code == 200
        concepts = response.json()["concepts"]
        assert len(concepts) > 0, "Should have at least default concepts"
        for c in concepts:
            assert "id" in c, "Missing id field"
            assert "name" in c, "Missing name field"
            assert "amount" in c, "Missing amount field"
            assert "concept_type" in c, "Missing concept_type field"
            assert "status" in c, "Missing status field"


class TestPaymentConceptsCreate:
    """Tests for POST /api/accounting/payment-concepts"""

    def test_create_concept_success(self, headers):
        """POST should create a new concept"""
        payload = {
            "name": "TEST_TallerRobotica",
            "amount": 150.00,
            "concept_type": "unico",
            "status": "active"
        }
        response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "concept" in data
        assert data["concept"]["name"] == "TEST_TallerRobotica"
        assert data["concept"]["amount"] == 150.00
        assert data["concept"]["concept_type"] == "unico"
        assert data["concept"]["is_default"] == False

    def test_create_concept_recurrente(self, headers):
        """Should create recurrente type concept"""
        payload = {
            "name": "TEST_CuotaMensual",
            "amount": 50.00,
            "concept_type": "recurrente",
            "status": "active"
        }
        response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["concept"]["concept_type"] == "recurrente"

    def test_create_concept_inactive(self, headers):
        """Should create concept with inactive status"""
        payload = {
            "name": "TEST_ConceptoInactivo",
            "amount": 25.00,
            "concept_type": "unico",
            "status": "inactive"
        }
        response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["concept"]["status"] == "inactive"

    def test_created_concept_appears_in_list(self, headers):
        """Created concept should appear when fetching all concepts"""
        # Create a concept
        payload = {
            "name": "TEST_VerificarLista",
            "amount": 100.00,
            "concept_type": "unico",
            "status": "active"
        }
        create_response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=payload, headers=headers)
        assert create_response.status_code == 200
        created_id = create_response.json()["concept"]["id"]

        # Fetch all and verify
        list_response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts?include_inactive=true", headers=headers)
        assert list_response.status_code == 200
        concepts = list_response.json()["concepts"]
        found = any(c["id"] == created_id for c in concepts)
        assert found, "Created concept should appear in list"


class TestPaymentConceptsUpdate:
    """Tests for PUT /api/accounting/payment-concepts/{id}"""

    def test_update_concept_name(self, headers):
        """Should update concept name"""
        # Create a concept first
        create_payload = {"name": "TEST_UpdateName", "amount": 100.00, "concept_type": "unico", "status": "active"}
        create_response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=create_payload, headers=headers)
        assert create_response.status_code == 200
        concept_id = create_response.json()["concept"]["id"]

        # Update the name
        update_payload = {"name": "TEST_UpdatedName"}
        update_response = requests.put(f"{BASE_URL}/api/accounting/payment-concepts/{concept_id}", json=update_payload, headers=headers)
        assert update_response.status_code == 200
        assert update_response.json()["concept"]["name"] == "TEST_UpdatedName"

    def test_update_concept_amount(self, headers):
        """Should update concept amount"""
        # Create a concept first
        create_payload = {"name": "TEST_UpdateAmount", "amount": 100.00, "concept_type": "unico", "status": "active"}
        create_response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=create_payload, headers=headers)
        assert create_response.status_code == 200
        concept_id = create_response.json()["concept"]["id"]

        # Update the amount
        update_payload = {"amount": 200.00}
        update_response = requests.put(f"{BASE_URL}/api/accounting/payment-concepts/{concept_id}", json=update_payload, headers=headers)
        assert update_response.status_code == 200
        assert update_response.json()["concept"]["amount"] == 200.00

    def test_update_concept_type(self, headers):
        """Should update concept type"""
        # Create a concept first
        create_payload = {"name": "TEST_UpdateType", "amount": 100.00, "concept_type": "unico", "status": "active"}
        create_response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=create_payload, headers=headers)
        assert create_response.status_code == 200
        concept_id = create_response.json()["concept"]["id"]

        # Update the type
        update_payload = {"concept_type": "recurrente"}
        update_response = requests.put(f"{BASE_URL}/api/accounting/payment-concepts/{concept_id}", json=update_payload, headers=headers)
        assert update_response.status_code == 200
        assert update_response.json()["concept"]["concept_type"] == "recurrente"

    def test_update_concept_status(self, headers):
        """Should update concept status (toggle active/inactive)"""
        # Create a concept first
        create_payload = {"name": "TEST_UpdateStatus", "amount": 100.00, "concept_type": "unico", "status": "active"}
        create_response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=create_payload, headers=headers)
        assert create_response.status_code == 200
        concept_id = create_response.json()["concept"]["id"]

        # Update to inactive
        update_payload = {"status": "inactive"}
        update_response = requests.put(f"{BASE_URL}/api/accounting/payment-concepts/{concept_id}", json=update_payload, headers=headers)
        assert update_response.status_code == 200
        assert update_response.json()["concept"]["status"] == "inactive"

        # Update back to active
        update_payload = {"status": "active"}
        update_response = requests.put(f"{BASE_URL}/api/accounting/payment-concepts/{concept_id}", json=update_payload, headers=headers)
        assert update_response.status_code == 200
        assert update_response.json()["concept"]["status"] == "active"

    def test_update_nonexistent_concept_returns_404(self, headers):
        """Should return 404 for non-existent concept"""
        update_payload = {"name": "SomeName"}
        response = requests.put(f"{BASE_URL}/api/accounting/payment-concepts/nonexistent-id-12345", json=update_payload, headers=headers)
        assert response.status_code == 404


class TestPaymentConceptsDelete:
    """Tests for DELETE /api/accounting/payment-concepts/{id}"""

    def test_delete_non_default_concept(self, headers):
        """Should delete a non-default concept"""
        # Create a concept first
        create_payload = {"name": "TEST_ToDelete", "amount": 100.00, "concept_type": "unico", "status": "active"}
        create_response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=create_payload, headers=headers)
        assert create_response.status_code == 200
        concept_id = create_response.json()["concept"]["id"]

        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/accounting/payment-concepts/{concept_id}", headers=headers)
        assert delete_response.status_code == 200

        # Verify it's gone
        list_response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts?include_inactive=true", headers=headers)
        concepts = list_response.json()["concepts"]
        found = any(c["id"] == concept_id for c in concepts)
        assert not found, "Deleted concept should not appear in list"

    def test_delete_default_concept_returns_400(self, headers):
        """Should return 400 when trying to delete a default concept"""
        # Get default concepts
        list_response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts?include_inactive=true", headers=headers)
        concepts = list_response.json()["concepts"]
        
        # Find a default concept
        default_concept = next((c for c in concepts if c.get("is_default") == True), None)
        assert default_concept is not None, "Should have a default concept"
        
        # Try to delete it
        delete_response = requests.delete(f"{BASE_URL}/api/accounting/payment-concepts/{default_concept['id']}", headers=headers)
        assert delete_response.status_code == 400
        assert "predeterminado" in delete_response.json().get("detail", "").lower() or "default" in delete_response.json().get("detail", "").lower()

    def test_delete_nonexistent_concept_returns_404(self, headers):
        """Should return 404 for non-existent concept"""
        response = requests.delete(f"{BASE_URL}/api/accounting/payment-concepts/nonexistent-id-99999", headers=headers)
        assert response.status_code == 404


class TestPaymentConceptsAuth:
    """Tests for authentication requirements"""

    def test_get_concepts_requires_auth(self):
        """GET should require authentication"""
        response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts")
        assert response.status_code in [401, 403]

    def test_create_concept_requires_auth(self):
        """POST should require authentication"""
        payload = {"name": "NoAuth", "amount": 100.00, "concept_type": "unico", "status": "active"}
        response = requests.post(f"{BASE_URL}/api/accounting/payment-concepts", json=payload)
        assert response.status_code in [401, 403]

    def test_update_concept_requires_auth(self):
        """PUT should require authentication"""
        response = requests.put(f"{BASE_URL}/api/accounting/payment-concepts/some-id", json={"name": "test"})
        assert response.status_code in [401, 403]

    def test_delete_concept_requires_auth(self):
        """DELETE should require authentication"""
        response = requests.delete(f"{BASE_URL}/api/accounting/payment-concepts/some-id")
        assert response.status_code in [401, 403]


# Cleanup test data after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_concepts(headers):
    """Cleanup TEST_ prefixed concepts after tests"""
    yield
    # Cleanup
    try:
        response = requests.get(f"{BASE_URL}/api/accounting/payment-concepts?include_inactive=true", headers=headers)
        if response.status_code == 200:
            concepts = response.json().get("concepts", [])
            for c in concepts:
                if c["name"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/accounting/payment-concepts/{c['id']}", headers=headers)
    except:
        pass
