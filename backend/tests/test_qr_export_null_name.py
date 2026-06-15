"""
Pytest: descarga de carnets QR no debe romperse si un alumno tiene `name=None`.

Bug (producción Jun 2026): al exportar carnets con plantilla "moderna" (o
"classic") el backend devolvía HTTP 500 ("'NoneType' object is not
subscriptable"). Causa: `(s.get("name", "?")[:1]).upper()` — si `name` existe
pero es None en la BD, `None[:1]` lanza TypeError y rompe TODO el PDF.

Fix: `((s.get("name") or "?")[:1]).upper()` + armado de nombre None-safe.

E2E contra preview. Crea un alumno temporal con name=None y verifica 200.
"""
from __future__ import annotations
import asyncio
import uuid
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


def _env(path, key):
    for line in open(path):
        line = line.strip()
        if line.startswith(key + "="):
            return line.split("=", 1)[1]
    return None


BASE = _env("/app/frontend/.env", "REACT_APP_BACKEND_URL").rstrip("/")
MONGO = _env("/app/backend/.env", "MONGO_URL")
DBN = _env("/app/backend/.env", "DB_NAME")

NIVEL = "023ca042-cb46-43aa-97e3-a5c9cd7a20ee"
GRADO = "6ef8ab18-41b2-45e7-b482-06a84d95c34d"
SECCION = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
TURNO = "8e1f4e98-37fa-40e3-a49d-a4ac08179262"
SCHOOL = "b9f27249-6568-49ae-94d3-e1f16750d7d9"


def _admin_token():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": "admin@elroble.edu", "password": "1234abc8"}, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


@pytest.mark.parametrize("template", ["moderna", "classic"])
def test_qr_download_handles_null_name_student(template):
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    async def setup():
        c = AsyncIOMotorClient(MONGO)
        db = c[DBN]
        sid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": sid, "school_id": SCHOOL, "role": "student",
            "name": None, "last_name": "ApellidoPrueba",        # name None on purpose
            "nivel_id": NIVEL, "grado_id": GRADO, "seccion_id": SECCION, "turno_id": TURNO,
            "qr_token": f"PYTEST-{sid}", "photo_url": None,
        })
        return db, sid

    async def teardown(db, sid):
        await db.users.delete_one({"id": sid})

    loop = asyncio.get_event_loop()
    db, sid = loop.run_until_complete(setup())
    try:
        r = requests.post(
            f"{BASE}/api/qr-templates/download",
            json={
                "formato": "pdf_grid", "template": template, "role": "student",
                "nivel_id": NIVEL, "grado_id": GRADO, "seccion_id": SECCION, "turno_id": TURNO,
                "incluir_codigo_alumno": True, "ordenar_alfabetico": True,
                "incluir_foto": True, "band_text_mode": "default",
            },
            headers=headers, timeout=60,
        )
        assert r.status_code == 200, f"{template}: {r.status_code} {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("application/pdf"), r.headers.get("content-type")
        assert len(r.content) > 1000
    finally:
        loop.run_until_complete(teardown(db, sid))
