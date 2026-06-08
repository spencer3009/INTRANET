"""API-level regression for Registro Auxiliar plantilla modo='grupo'.

Covers:
 - POST create with modo='grupo' (happy path, grupos sum 100% -> 200)
 - POST create with grupos NOT summing 100% (estado=activa) -> 400
 - POST create with empty grupo.miembro_ids (estado=activa) -> 400
 - POST clone of a grupo-mode template: copies modo_ponderacion and grupos
   AND remaps miembro_ids to the NEW criterio / columna ids.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"no token in login response: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    school_id = (data.get("user") or {}).get("school_id") or data.get("school_id")
    assert school_id, f"no school_id in login response: {data}"
    s.school_id = school_id
    yield s


def _payload_grupo(estado="activa", grupos_pct=(60, 40), empty_member_idx=None):
    crit = [
        {"nombre": "TEST_A", "porcentaje": 0, "orden": 0,
         "subcolumnas": [
             {"label": "S1", "tipo": "input", "orden": 0},
             {"label": "S2", "tipo": "input", "orden": 1},
         ]},
        {"nombre": "TEST_B", "porcentaje": 0, "orden": 1,
         "subcolumnas": [{"label": "S3", "tipo": "input", "orden": 0}]},
    ]
    cols = [{"label": "TEST_EX", "label_corto": "EX", "porcentaje": 0, "orden": 0}]
    # We need ids client-side to point grupos.miembro_ids at them
    crit[0]["id"] = "tA"
    crit[1]["id"] = "tB"
    cols[0]["id"] = "tF"
    grupos = [
        {"nombre": "G1", "porcentaje": grupos_pct[0],
         "miembro_ids": [] if empty_member_idx == 0 else ["tA", "tB"]},
        {"nombre": "G2", "porcentaje": grupos_pct[1],
         "miembro_ids": [] if empty_member_idx == 1 else ["tF"]},
    ]
    return {
        "nombre": "TEST_PLANTILLA_GRUPO",
        "descripcion": "automated test",
        "estado": estado,
        "criterios": crit,
        "columnas_finales": cols,
        "modo_ponderacion": "grupo",
        "grupos": grupos,
        "label_promedio_final": "PROM",
        "escala_minima": 0,
        "escala_maxima": 20,
    }


_created_ids = []


def test_create_grupo_mode_happy_path(session):
    payload = _payload_grupo(estado="activa", grupos_pct=(60, 40))
    r = session.post(
        f"{BASE_URL}/api/schools/{session.school_id}/registro-auxiliar/plantillas",
        json=payload,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    doc = r.json()
    _created_ids.append(doc["id"])
    assert doc["modo_ponderacion"] == "grupo"
    assert len(doc["grupos"]) == 2
    # Each grupo should still carry its members + porcentaje
    pcts = sorted(g["porcentaje"] for g in doc["grupos"])
    assert pcts == [40, 60]
    for g in doc["grupos"]:
        assert len(g["miembro_ids"]) >= 1
        assert g.get("id", "").startswith("grupo_")

    # GET verifies persistence
    r2 = session.get(
        f"{BASE_URL}/api/schools/{session.school_id}/registro-auxiliar/plantillas/{doc['id']}"
    )
    assert r2.status_code == 200
    fetched = r2.json()
    assert fetched["modo_ponderacion"] == "grupo"
    assert len(fetched["grupos"]) == 2


def test_create_grupo_mode_bad_sum_rejected(session):
    payload = _payload_grupo(estado="activa", grupos_pct=(50, 40))  # = 90
    r = session.post(
        f"{BASE_URL}/api/schools/{session.school_id}/registro-auxiliar/plantillas",
        json=payload,
    )
    assert r.status_code == 400, f"{r.status_code} {r.text}"
    msg = (r.json().get("detail") or "").lower()
    assert "100" in msg and ("grupo" in msg or "grupos" in msg), msg


def test_create_grupo_mode_empty_member_rejected(session):
    payload = _payload_grupo(estado="activa", grupos_pct=(60, 40),
                             empty_member_idx=1)
    r = session.post(
        f"{BASE_URL}/api/schools/{session.school_id}/registro-auxiliar/plantillas",
        json=payload,
    )
    assert r.status_code == 400, f"{r.status_code} {r.text}"
    msg = (r.json().get("detail") or "").lower()
    assert "grupo" in msg


def test_create_grupo_mode_borrador_skips_validation(session):
    # estado=borrador must bypass the 100% rule
    payload = _payload_grupo(estado="borrador", grupos_pct=(10, 10))
    r = session.post(
        f"{BASE_URL}/api/schools/{session.school_id}/registro-auxiliar/plantillas",
        json=payload,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    _created_ids.append(r.json()["id"])


def test_clone_grupo_template_remaps_member_ids(session):
    # Create a source grupo template
    src = _payload_grupo(estado="activa", grupos_pct=(70, 30))
    r = session.post(
        f"{BASE_URL}/api/schools/{session.school_id}/registro-auxiliar/plantillas",
        json=src,
    )
    assert r.status_code == 200, r.text
    src_doc = r.json()
    _created_ids.append(src_doc["id"])
    src_member_ids = {m for g in src_doc["grupos"] for m in g["miembro_ids"]}

    # Clone it
    r2 = session.post(
        f"{BASE_URL}/api/schools/{session.school_id}/registro-auxiliar/plantillas/{src_doc['id']}/clonar",
        json={"nombre": "TEST_CLONE_GRUPO"},
    )
    assert r2.status_code == 200, r2.text
    clone = r2.json()
    _created_ids.append(clone["id"])

    # Mode + grupos copied
    assert clone["modo_ponderacion"] == "grupo"
    assert len(clone["grupos"]) == 2

    # Criterio + columna ids must be NEW (not equal to source ids)
    src_crit_ids = {c["id"] for c in src_doc["criterios"]}
    src_col_ids = {c["id"] for c in src_doc["columnas_finales"]}
    clone_crit_ids = {c["id"] for c in clone["criterios"]}
    clone_col_ids = {c["id"] for c in clone["columnas_finales"]}
    assert src_crit_ids.isdisjoint(clone_crit_ids), "criterio ids not regenerated"
    assert src_col_ids.isdisjoint(clone_col_ids), "columna_final ids not regenerated"

    # miembro_ids in clone must point to NEW ids (subset of clone's crit+col ids),
    # NOT to any old source ids.
    valid_targets = clone_crit_ids | clone_col_ids
    clone_member_ids = {m for g in clone["grupos"] for m in g["miembro_ids"]}
    assert clone_member_ids, "clone grupos have no members"
    assert clone_member_ids.issubset(valid_targets), (
        f"miembro_ids not remapped: {clone_member_ids} not subset of {valid_targets}"
    )
    assert clone_member_ids.isdisjoint(src_member_ids), (
        f"clone still references source ids: {clone_member_ids & src_member_ids}"
    )


def test_cleanup_test_plantillas(session):
    # Best-effort delete of templates created in this run
    for pid in _created_ids:
        try:
            session.delete(
                f"{BASE_URL}/api/schools/{session.school_id}/registro-auxiliar/plantillas/{pid}"
            )
        except Exception:
            pass
