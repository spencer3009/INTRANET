"""Tests for welcome letters endpoints (iteration 217)."""
import os
import io
import time
import uuid
import zipfile

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://registro-auxiliar-1.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@elroble.edu", "password": "1234abc8", "subdomain": "elroble"},
        timeout=15,
    )
    if resp.status_code != 200:
        # try without subdomain
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@elroble.edu", "password": "1234abc8"},
            timeout=15,
        )
    assert resp.status_code == 200, f"login failed {resp.status_code}: {resp.text[:300]}"
    data = resp.json()
    token = data.get("token") or data.get("access_token") or (data.get("user") or {}).get("token")
    assert token, f"no token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_welcome_info(auth_headers):
    """GET /api/users/welcome-letters/info → 200 with total_families and mode."""
    r = requests.get(f"{BASE_URL}/api/users/welcome-letters/info", headers=auth_headers, timeout=20)
    assert r.status_code == 200, f"info failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert "total_families" in data
    assert "mode" in data
    assert data["mode"] in ("sync", "background")
    assert isinstance(data["total_families"], int)
    print(f"[INFO] total_families={data['total_families']} mode={data['mode']}")


def test_welcome_sync_download(auth_headers):
    """GET /api/users/welcome-letters/download → 200 ZIP (modo sync, 6 families)."""
    r = requests.get(f"{BASE_URL}/api/users/welcome-letters/download", headers=auth_headers, timeout=120)
    assert r.status_code == 200, f"sync download failed: {r.status_code} {r.text[:300]}"
    assert "application/zip" in r.headers.get("content-type", "").lower()
    assert len(r.content) > 100
    # validate ZIP integrity
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = z.namelist()
    assert any(n.endswith(".pdf") for n in names), f"no pdfs in zip: {names}"
    assert "_EXCLUIDOS.txt" in names
    print(f"[SYNC] zip size={len(r.content)} files={len(names)}")


def test_welcome_job_flow_and_download(auth_headers):
    """Full job flow: /start → poll /jobs/{id} until ready → /jobs/{id}/download → 200 ZIP."""
    r = requests.get(f"{BASE_URL}/api/users/welcome-letters/start", headers=auth_headers, timeout=20)
    assert r.status_code == 200, f"start failed: {r.status_code} {r.text[:300]}"
    job_id = r.json().get("job_id")
    assert job_id, f"no job_id in: {r.json()}"

    ready = False
    last_status = None
    for i in range(60):
        time.sleep(1.5)
        s = requests.get(f"{BASE_URL}/api/users/welcome-letters/jobs/{job_id}", headers=auth_headers, timeout=15)
        assert s.status_code == 200, f"job status failed: {s.status_code} {s.text[:300]}"
        body = s.json()
        last_status = body.get("status")
        if body.get("ready") and last_status == "done":
            ready = True
            break
        if last_status == "error":
            pytest.fail(f"job errored: {body}")
    assert ready, f"job did not become ready, last_status={last_status}"

    d = requests.get(
        f"{BASE_URL}/api/users/welcome-letters/jobs/{job_id}/download",
        headers=auth_headers, timeout=60,
    )
    assert d.status_code == 200, f"job download failed: {d.status_code} {d.text[:300]}"
    assert "application/zip" in d.headers.get("content-type", "").lower()
    assert len(d.content) > 100
    z = zipfile.ZipFile(io.BytesIO(d.content))
    assert any(n.endswith(".pdf") for n in z.namelist())
    print(f"[JOB] job_id={job_id} zip size={len(d.content)}")


def test_welcome_job_download_nonexistent_returns_404(auth_headers):
    """GET /jobs/<random uuid>/download → 404 con detail 'Job no encontrado'. NUNCA 500."""
    random_id = str(uuid.uuid4())
    r = requests.get(
        f"{BASE_URL}/api/users/welcome-letters/jobs/{random_id}/download",
        headers=auth_headers, timeout=15,
    )
    assert r.status_code == 404, f"expected 404 for non-existent job, got {r.status_code}: {r.text[:300]}"
    body = r.json()
    detail = body.get("detail") or body.get("message") or ""
    assert "Job no encontrado" in detail or "no encontrado" in detail.lower(), f"unexpected detail: {detail}"
    print(f"[404] detail='{detail}'")


def test_welcome_job_status_nonexistent_returns_404(auth_headers):
    """GET /jobs/<random uuid> → 404. Validar que no produce 500."""
    random_id = str(uuid.uuid4())
    r = requests.get(
        f"{BASE_URL}/api/users/welcome-letters/jobs/{random_id}",
        headers=auth_headers, timeout=15,
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:300]}"
    print(f"[STATUS-404] ok")


def test_welcome_unauthenticated_blocked():
    """Sin token → 401/403 (no 500)."""
    r = requests.get(f"{BASE_URL}/api/users/welcome-letters/info", timeout=15)
    assert r.status_code in (401, 403), f"expected auth error, got {r.status_code}"
