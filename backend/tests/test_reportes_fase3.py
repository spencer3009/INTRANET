"""
Fase 3 Coordinacion Module Tests - Reportes Avanzados, Export XLSX/PDF, Dashboard Alertas Widget
Tests for:
- GET /api/coordinacion/reportes/incidencias-por-grado
- GET /api/coordinacion/reportes/reincidentes
- GET /api/coordinacion/reportes/cobertura-charlas
- GET /api/coordinacion/reportes/efectividad-seguimientos
- GET /api/coordinacion/reportes/{type}/export?format=xlsx|pdf
- GET /api/coordinacion/dashboard (alertas/reincidentes widget)
- RBAC: Parent role should NOT access reportes endpoints (403)
"""
import pytest
import requests
import os
import zipfile
import io

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
COORDINATOR_EMAIL = "coordinador@elroble.edu"
COORDINATOR_PASSWORD = "Coord123!"
PARENT_EMAIL = "maria.peres@gmail.com"
PARENT_PASSWORD = "Parent123!"


@pytest.fixture(scope="module")
def coordinator_token():
    """Get coordinator auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COORDINATOR_EMAIL,
        "password": COORDINATOR_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Coordinator login failed: {response.status_code} - {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def parent_token():
    """Get parent auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARENT_EMAIL,
        "password": PARENT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Parent login failed: {response.status_code} - {response.text}")
    return response.json().get("token")


class TestReportesIncidenciasPorGrado:
    """Tests for GET /api/coordinacion/reportes/incidencias-por-grado"""

    def test_report_returns_200(self, coordinator_token):
        """Report endpoint returns 200 with valid structure"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/incidencias-por-grado",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert "total" in data, "Response should have 'total' key"
        print(f"✓ Incidencias por grado: {len(data['items'])} grades, {data['total']} total incidencias")

    def test_report_item_structure(self, coordinator_token):
        """Each item has required fields: label, count, by_severity"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/incidencias-por-grado",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        if data["items"]:
            item = data["items"][0]
            assert "label" in item, "Item should have 'label'"
            assert "count" in item, "Item should have 'count'"
            assert "by_severity" in item, "Item should have 'by_severity'"
            print(f"✓ First item: {item['label']} - {item['count']} incidencias, severity breakdown: {item['by_severity']}")

    def test_report_with_severidad_filter(self, coordinator_token):
        """Report can be filtered by severidad"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/incidencias-por-grado?severidad=alta",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Filtered by severidad=alta: {data['total']} incidencias")


class TestReportesReincidentes:
    """Tests for GET /api/coordinacion/reportes/reincidentes"""

    def test_report_returns_200(self, coordinator_token):
        """Report endpoint returns 200 with valid structure"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/reincidentes",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert "total" in data, "Response should have 'total' key"
        assert "periodo_dias" in data, "Response should have 'periodo_dias' key"
        assert "umbral" in data, "Response should have 'umbral' key"
        print(f"✓ Reincidentes: {data['total']} students with >={data['umbral']} incidencias in {data['periodo_dias']} days")

    def test_report_item_structure(self, coordinator_token):
        """Each item has required fields: student_id, full_name, grade, count"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/reincidentes",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        if data["items"]:
            item = data["items"][0]
            assert "student_id" in item, "Item should have 'student_id'"
            assert "full_name" in item, "Item should have 'full_name'"
            assert "grade" in item, "Item should have 'grade'"
            assert "count" in item, "Item should have 'count'"
            assert item["count"] >= 3, f"Reincident should have >=3 incidencias, got {item['count']}"
            print(f"✓ Reincident: {item['full_name']} ({item['grade']}) - {item['count']} incidencias")

    def test_report_with_custom_umbral(self, coordinator_token):
        """Report can use custom umbral parameter"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/reincidentes?umbral=5",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["umbral"] == 5, f"Expected umbral=5, got {data['umbral']}"
        print(f"✓ Custom umbral=5: {data['total']} students")


class TestReportesCoberturaCharlas:
    """Tests for GET /api/coordinacion/reportes/cobertura-charlas"""

    def test_report_returns_200(self, coordinator_token):
        """Report endpoint returns 200 with valid structure"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/cobertura-charlas",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert "total_charlas" in data, "Response should have 'total_charlas' key"
        assert "total_convocados" in data, "Response should have 'total_convocados' key"
        assert "total_asistentes" in data, "Response should have 'total_asistentes' key"
        assert "cobertura_pct" in data, "Response should have 'cobertura_pct' key"
        print(f"✓ Cobertura charlas: {data['total_charlas']} charlas, {data['cobertura_pct']}% coverage")

    def test_report_item_structure(self, coordinator_token):
        """Each item has required fields: charla_id, title, convocados, asistentes, cobertura_pct"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/cobertura-charlas",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        if data["items"]:
            item = data["items"][0]
            assert "charla_id" in item, "Item should have 'charla_id'"
            assert "title" in item, "Item should have 'title'"
            assert "convocados" in item, "Item should have 'convocados'"
            assert "asistentes" in item, "Item should have 'asistentes'"
            assert "cobertura_pct" in item, "Item should have 'cobertura_pct'"
            print(f"✓ Charla: {item['title']} - {item['asistentes']}/{item['convocados']} ({item['cobertura_pct']}%)")


class TestReportesEfectividadSeguimientos:
    """Tests for GET /api/coordinacion/reportes/efectividad-seguimientos"""

    def test_report_returns_200(self, coordinator_token):
        """Report endpoint returns 200 with valid structure"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/efectividad-seguimientos",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total" in data, "Response should have 'total' key"
        assert "cerradas" in data, "Response should have 'cerradas' key"
        assert "abiertas" in data, "Response should have 'abiertas' key"
        assert "efectividad_pct" in data, "Response should have 'efectividad_pct' key"
        assert "by_status" in data, "Response should have 'by_status' key"
        print(f"✓ Efectividad: {data['cerradas']}/{data['total']} cerradas ({data['efectividad_pct']}%)")

    def test_report_by_status_breakdown(self, coordinator_token):
        """Report includes status breakdown"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/efectividad-seguimientos",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        by_status = data.get("by_status", {})
        print(f"✓ Status breakdown: {by_status}")


class TestExportXLSX:
    """Tests for XLSX export functionality"""

    def test_export_incidencias_xlsx(self, coordinator_token):
        """Export incidencias-por-grado as XLSX returns valid ZIP archive"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/incidencias-por-grado/export?format=xlsx",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        # XLSX is a ZIP archive - verify it's valid
        try:
            with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
                assert len(zf.namelist()) > 0, "XLSX should contain files"
                print(f"✓ XLSX export valid: {len(zf.namelist())} files in archive")
        except zipfile.BadZipFile:
            pytest.fail("XLSX export is not a valid ZIP archive")

    def test_export_cobertura_xlsx(self, coordinator_token):
        """Export cobertura-charlas as XLSX returns valid ZIP archive"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/cobertura-charlas/export?format=xlsx",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        try:
            with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
                assert len(zf.namelist()) > 0
                print(f"✓ Cobertura XLSX export valid")
        except zipfile.BadZipFile:
            pytest.fail("XLSX export is not a valid ZIP archive")


class TestExportPDF:
    """Tests for PDF export functionality"""

    def test_export_reincidentes_pdf(self, coordinator_token):
        """Export reincidentes as PDF returns valid PDF"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/reincidentes/export?format=pdf",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application/pdf" in response.headers.get("content-type", "")
        # PDF files start with %PDF-
        assert response.content[:5] == b"%PDF-", "PDF should start with %PDF- header"
        print(f"✓ Reincidentes PDF export valid: {len(response.content)} bytes")

    def test_export_efectividad_pdf(self, coordinator_token):
        """Export efectividad-seguimientos as PDF returns valid PDF"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/efectividad-seguimientos/export?format=pdf",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.content[:5] == b"%PDF-", "PDF should start with %PDF- header"
        print(f"✓ Efectividad PDF export valid: {len(response.content)} bytes")


class TestDashboardAlertasWidget:
    """Tests for dashboard alertas widget (reincidentes)"""

    def test_dashboard_returns_reincidentes(self, coordinator_token):
        """Dashboard endpoint returns reincidentes array for alertas widget"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/dashboard",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "reincidentes" in data, "Dashboard should have 'reincidentes' key for alertas widget"
        reincidentes = data["reincidentes"]
        assert isinstance(reincidentes, list), "reincidentes should be a list"
        print(f"✓ Dashboard alertas widget: {len(reincidentes)} reincidentes")
        if reincidentes:
            r = reincidentes[0]
            assert "student_id" in r, "Reincident should have student_id"
            assert "full_name" in r, "Reincident should have full_name"
            assert "count" in r, "Reincident should have count"
            print(f"  First reincident: {r['full_name']} - {r['count']} incidencias")

    def test_dashboard_kpis_present(self, coordinator_token):
        """Dashboard has KPIs section"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/dashboard",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "kpis" in data, "Dashboard should have 'kpis' key"
        kpis = data["kpis"]
        assert "incidencias_activas" in kpis, "KPIs should have incidencias_activas"
        print(f"✓ Dashboard KPIs: {kpis}")


class TestRBACParentBlocked:
    """Tests that parent role cannot access reportes endpoints"""

    def test_parent_blocked_incidencias_por_grado(self, parent_token):
        """Parent gets 403 on incidencias-por-grado report"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/incidencias-por-grado",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Parent blocked from incidencias-por-grado report (403)")

    def test_parent_blocked_reincidentes(self, parent_token):
        """Parent gets 403 on reincidentes report"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/reincidentes",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Parent blocked from reincidentes report (403)")

    def test_parent_blocked_cobertura_charlas(self, parent_token):
        """Parent gets 403 on cobertura-charlas report"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/cobertura-charlas",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Parent blocked from cobertura-charlas report (403)")

    def test_parent_blocked_efectividad(self, parent_token):
        """Parent gets 403 on efectividad-seguimientos report"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/efectividad-seguimientos",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Parent blocked from efectividad-seguimientos report (403)")

    def test_parent_blocked_export(self, parent_token):
        """Parent gets 403 on export endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/incidencias-por-grado/export?format=xlsx",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Parent blocked from export endpoint (403)")


class TestInvalidReportType:
    """Tests for invalid report type handling"""

    def test_invalid_report_type_returns_400(self, coordinator_token):
        """Invalid report type returns 400"""
        response = requests.get(
            f"{BASE_URL}/api/coordinacion/reportes/invalid-report/export?format=xlsx",
            headers={"Authorization": f"Bearer {coordinator_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid report type returns 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
