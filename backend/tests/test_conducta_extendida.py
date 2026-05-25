# -*- coding: utf-8 -*-
"""Backend tests for Conducta Extendida feature (template + scores + libreta integration)."""
import os
import pytest
import requests

_url = os.environ.get("REACT_APP_BACKEND_URL")
if not _url:
    # Load from frontend/.env if not set in current env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    _url = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
BASE_URL = (_url or "").rstrip("/")
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"

STUDENT_ID = "63cd034b-1b68-446f-b8f7-6d3589a709f1"
PERIOD_ID = "093a0bee-92c4-449c-b82c-942f16847759"  # BIMESTRE I


# -----------------------------
# fixtures: auth
# -----------------------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    })
    return s


@pytest.fixture(scope="session")
def admin_user(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def section_id(admin_client, admin_user):
    """Resolve the section of the test student."""
    r = admin_client.get(f"{BASE_URL}/api/libreta/{STUDENT_ID}", timeout=20)
    if r.status_code == 200:
        sid = (r.json().get("section") or {}).get("id")
        if sid:
            return sid
    pytest.skip("Could not resolve section_id of test student")


# -----------------------------
# Template endpoints
# -----------------------------
class TestTemplate:
    def test_get_template_returns_mode_template_default_template(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/conducta-extendida/template", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "mode" in d and d["mode"] in ("default", "extended")
        assert "template" in d and isinstance(d["template"], dict)
        assert "default_template" in d
        # default_template should always have 2 secciones with 4+3 criterios
        dft = d["default_template"]
        assert isinstance(dft.get("secciones"), list) and len(dft["secciones"]) == 2
        criterios_counts = [len(s["criterios"]) for s in dft["secciones"]]
        assert sorted(criterios_counts) == [3, 4]

    def test_put_mode_extended(self, admin_client):
        r = admin_client.put(
            f"{BASE_URL}/api/conducta-extendida/template",
            json={"mode": "extended"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["mode"] == "extended"

    def test_put_invalid_mode_400(self, admin_client):
        r = admin_client.put(
            f"{BASE_URL}/api/conducta-extendida/template",
            json={"mode": "bogus"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_put_secciones_validation_empty(self, admin_client):
        r = admin_client.put(
            f"{BASE_URL}/api/conducta-extendida/template",
            json={"secciones": []},
            timeout=15,
        )
        assert r.status_code == 400

    def test_put_secciones_validation_no_criterios(self, admin_client):
        r = admin_client.put(
            f"{BASE_URL}/api/conducta-extendida/template",
            json={"secciones": [{"nombre": "Solo", "orden": 0, "criterios": []}]},
            timeout=15,
        )
        assert r.status_code == 400

    def test_put_secciones_validation_no_name(self, admin_client):
        r = admin_client.put(
            f"{BASE_URL}/api/conducta-extendida/template",
            json={"secciones": [{"nombre": "", "orden": 0,
                                  "criterios": [{"nombre": "x", "orden": 0}]}]},
            timeout=15,
        )
        assert r.status_code == 400

    def test_put_secciones_update_persist_and_normalize(self, admin_client):
        custom = {
            "secciones": [
                {
                    "id": "eval_conductual",
                    "nombre": "EVALUACIÓN CONDUCTUAL",
                    "orden": 0,
                    "criterios": [
                        {"id": "asist_punt", "nombre": "Asistencia y puntualidad", "orden": 0},
                        {"id": "pres_personal", "nombre": "Presentación personal", "orden": 1},
                        {"id": "cumpl_normas", "nombre": "Cumplimiento de normas", "orden": 2},
                        {"id": "resp_tareas", "nombre": "Responsabilidad en cumplimiento de tareas", "orden": 3},
                    ],
                },
                {
                    "id": "part_ppff",
                    "nombre": "PARTICIPACIÓN DE PP.FF.",
                    "orden": 1,
                    "criterios": [
                        {"id": "ppff_asist_escuela", "nombre": "Asistencia a Escuela para Padres", "orden": 0},
                        {"id": "ppff_monitoreo", "nombre": "Monitoreo y seguimiento", "orden": 1},
                        {"id": "ppff_reuniones", "nombre": "Participación en reuniones", "orden": 2},
                    ],
                },
            ]
        }
        r = admin_client.put(
            f"{BASE_URL}/api/conducta-extendida/template",
            json={"mode": "extended", **custom},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mode"] == "extended"
        secs = d["template"]["secciones"]
        assert len(secs) == 2
        # GET back to verify
        r2 = admin_client.get(f"{BASE_URL}/api/conducta-extendida/template", timeout=15)
        secs2 = r2.json()["template"]["secciones"]
        assert len(secs2) == 2
        ids = {c["id"] for s in secs2 for c in s["criterios"]}
        assert "asist_punt" in ids and "ppff_reuniones" in ids


# -----------------------------
# Scores endpoints
# -----------------------------
class TestScores:
    def test_list_scores_returns_students_and_template(self, admin_client, section_id):
        r = admin_client.get(
            f"{BASE_URL}/api/conducta-extendida",
            params={"section_id": section_id, "period_id": PERIOD_ID},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["section_id"] == section_id
        assert d["period_id"] == PERIOD_ID
        assert "mode" in d
        assert "template" in d and "secciones" in d["template"]
        assert isinstance(d["students"], list)
        # The seeded test student should appear if it belongs to the section
        # (don't hard-fail if section_id mismatch — but log)
        student_ids = [s["student_id"] for s in d["students"]]
        if STUDENT_ID in student_ids:
            row = next(s for s in d["students"] if s["student_id"] == STUDENT_ID)
            assert "scores" in row

    def test_list_scores_invalid_section_404(self, admin_client):
        r = admin_client.get(
            f"{BASE_URL}/api/conducta-extendida",
            params={"section_id": "non-existent", "period_id": PERIOD_ID},
            timeout=15,
        )
        assert r.status_code in (403, 404)

    def test_list_scores_unauthorized_no_token(self):
        r = requests.get(
            f"{BASE_URL}/api/conducta-extendida",
            params={"section_id": "x", "period_id": "y"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_save_scores_persists(self, admin_client, section_id):
        payload = {
            "section_id": section_id,
            "period_id": PERIOD_ID,
            "entries": [
                {
                    "student_id": STUDENT_ID,
                    "scores": {
                        "asist_punt": 17.5,
                        "pres_personal": 18.0,
                        "cumpl_normas": 16.0,
                        "resp_tareas": 19.0,
                        "ppff_asist_escuela": 15.0,
                        "ppff_monitoreo": 14.0,
                        "ppff_reuniones": 16.0,
                    },
                }
            ],
        }
        r = admin_client.post(f"{BASE_URL}/api/conducta-extendida", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("saved") == 1

        # GET back
        g = admin_client.get(
            f"{BASE_URL}/api/conducta-extendida",
            params={"section_id": section_id, "period_id": PERIOD_ID},
            timeout=20,
        )
        d = g.json()
        row = next((s for s in d["students"] if s["student_id"] == STUDENT_ID), None)
        assert row, "test student not in returned list"
        assert row["scores"].get("asist_punt") == 17.5
        assert row["scores"].get("ppff_reuniones") == 16.0

    def test_save_scores_out_of_range_400(self, admin_client, section_id):
        payload = {
            "section_id": section_id,
            "period_id": PERIOD_ID,
            "entries": [{"student_id": STUDENT_ID, "scores": {"asist_punt": 25}}],
        }
        r = admin_client.post(f"{BASE_URL}/api/conducta-extendida", json=payload, timeout=20)
        assert r.status_code == 400

    def test_save_scores_unknown_criterio_ignored(self, admin_client, section_id):
        payload = {
            "section_id": section_id,
            "period_id": PERIOD_ID,
            "entries": [{"student_id": STUDENT_ID,
                         "scores": {"unknown_xyz": 15.0, "asist_punt": 18.0}}],
        }
        r = admin_client.post(f"{BASE_URL}/api/conducta-extendida", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        # verify unknown not persisted
        g = admin_client.get(
            f"{BASE_URL}/api/conducta-extendida",
            params={"section_id": section_id, "period_id": PERIOD_ID},
            timeout=20,
        )
        row = next((s for s in g.json()["students"] if s["student_id"] == STUDENT_ID), None)
        assert row is not None
        assert "unknown_xyz" not in (row.get("scores") or {})
        assert row["scores"].get("asist_punt") == 18.0


# -----------------------------
# Libreta integration
# -----------------------------
class TestLibretaIntegration:
    def test_libreta_includes_conducta_extendida(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/libreta/{STUDENT_ID}", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        # metadata.conducta_template_mode
        assert "metadata" in d
        assert "conducta_template_mode" in d["metadata"]
        # conducta_extendida block
        assert "conducta_extendida" in d
        ce = d["conducta_extendida"]
        assert "mode" in ce
        assert "template" in ce and isinstance(ce["template"], dict)
        assert "by_period" in ce and isinstance(ce["by_period"], dict)

    def test_libreta_by_period_has_scores_for_bimestre_i(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/libreta/{STUDENT_ID}", timeout=30)
        d = r.json()
        by_period = d["conducta_extendida"]["by_period"]
        # BIMESTRE I should have scores (seeded by previous tests)
        bp = by_period.get(PERIOD_ID)
        assert bp is not None, f"No scores returned for BIMESTRE I in by_period (keys={list(by_period.keys())})"
        # at least one of the criterios persisted
        assert any(v is not None for v in bp.values())
