"""QR Template endpoints — isolated from existing QR download logic."""
import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from routes.core import db, get_current_user, resolve_user_from_token, is_admin_user
from services.qr_templates.registry import list_templates, get_template

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["qr-templates"])


@router.get("/qr-templates/list")
async def get_available_templates(current_user=Depends(get_current_user)):
    """Return available QR carnet templates."""
    return {"templates": list_templates()}


class TemplateDownloadRequest(BaseModel):
    template: str = "classic"
    nivel_id: str
    grado_id: str
    seccion_id: str
    turno_id: Optional[str] = None
    incluir_codigo_alumno: bool = False
    incluir_foto: bool = True
    ordenar_alfabetico: bool = True


@router.get("/qr-templates/preview")
async def preview_template(
    template: str = Query("classic"),
    nivel_id: str = Query(...),
    grado_id: str = Query(...),
    seccion_id: str = Query(...),
    token: str = Query(None),
):
    """Generate a single-page PDF preview. Accepts token as query param for iframe usage."""
    import jwt, os
    if not token:
        raise HTTPException(status_code=401, detail="Token requerido")
    try:
        secret = os.environ.get("JWT_SECRET", "edunet-saas-secret-key-2026-dev-only")
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No autorizado")

    tpl = get_template(template)
    data = {
        "nivel_id": nivel_id,
        "grado_id": grado_id,
        "seccion_id": seccion_id,
        "turno_id": None,
        "incluir_codigo_alumno": False,
        "incluir_foto": True,
        "ordenar_alfabetico": True,
    }

    try:
        buf = await tpl.generate_pdf(db, school_id, data, user)
        if buf is None:
            raise HTTPException(status_code=404, detail="No se encontraron estudiantes")
        return StreamingResponse(buf, media_type="application/pdf",
            headers={"Content-Disposition": "inline; filename=preview.pdf"})
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[QR Templates] Preview error: {e}")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.post("/qr-templates/download")
async def download_with_template(
    data: TemplateDownloadRequest,
    current_user=Depends(get_current_user)
):
    """Generate full PDF using the selected template."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No autorizado")

    tpl = get_template(data.template)
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")

    try:
        buf = await tpl.generate_pdf(db, school_id, data, user)
        if buf is None:
            raise HTTPException(status_code=404, detail="No se encontraron estudiantes con esos filtros")
        filename = f"qr_carnets_{data.template}_{now_str}.pdf"
        return StreamingResponse(buf, media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"})
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[QR Templates] Download error: {e}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
