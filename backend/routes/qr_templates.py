"""QR Template endpoints — isolated from existing QR download logic."""
import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from routes.core import db, get_current_user, resolve_user_from_token, is_admin_user
from services.qr_templates.registry import list_templates, get_template

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["qr-templates"])

# Staff roles (non-students) that can have a personal QR carnet. Used by the
# generic preview/count/download endpoints so the "QR con plantilla" feature
# works for any admin staff, not just teachers.
STAFF_ROLES_WITH_QR = {
    "teacher",
    "personal_mantenimiento",
    "auxiliar",
    "auxiliar_asistencia",
    "auxiliar_alimentacion",
    "auxiliar_movilidad",
    "auxiliar_topico",
}

STAFF_ROLE_LABELS = {
    "teacher": "Docente",
    "personal_mantenimiento": "Personal de Mantenimiento",
    "auxiliar": "Auxiliar",
    "auxiliar_asistencia": "Auxiliar de Asistencia",
    "auxiliar_alimentacion": "Auxiliar de Alimentación",
    "auxiliar_movilidad": "Auxiliar de Movilidad",
    "auxiliar_topico": "Auxiliar de Tópico",
}


@router.get("/qr-templates/list")
async def get_available_templates(current_user=Depends(get_current_user)):
    """Return available QR carnet templates."""
    return {"templates": list_templates()}


@router.get("/qr-templates/count")
async def count_students_with_qr(
    nivel_id: str = Query(...),
    grado_id: str = Query(...),
    seccion_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    """Count students with QR token for the given filters."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="No autorizado")
    school_id = user.get("school_id")
    count = await db.users.count_documents({
        "school_id": school_id, "role": "student",
        "nivel_id": nivel_id, "grado_id": grado_id, "seccion_id": seccion_id,
        "qr_token": {"$exists": True, "$ne": None},
    })
    return {"count": count}



class TemplateDownloadRequest(BaseModel):
    formato: str = "pdf_grid"  # pdf_grid | zip | pdf_lista
    template: str = "classic"
    role: str = "student"  # "student" | "teacher"
    nivel_id: Optional[str] = None
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    turno_id: Optional[str] = None
    incluir_codigo_alumno: bool = False
    incluir_foto: bool = True
    ordenar_alfabetico: bool = True
    color_principal: Optional[str] = None
    color_acento: Optional[str] = None


@router.get("/qr-templates/preview")
async def preview_template(
    nivel_id: str = Query(...),
    grado_id: str = Query(...),
    seccion_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    """Return first student data + school info for HTML preview in the drawer."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No autorizado")

    student = await db.users.find_one(
        {"school_id": school_id, "role": "student", "nivel_id": nivel_id, "grado_id": grado_id, "seccion_id": seccion_id, "qr_token": {"$exists": True, "$ne": None}},
        {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1, "qr_token": 1, "codigo_alumno": 1}
    )
    if not student:
        raise HTTPException(status_code=404, detail="No hay estudiantes con QR")

    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "name": 1, "school_name": 1, "logo_url": 1})
    school_name = (school or {}).get("name") or (school or {}).get("school_name") or "Colegio"

    nivel = await db.academic_levels.find_one({"id": nivel_id}, {"_id": 0, "nombre": 1, "name": 1})
    grado = await db.grados.find_one({"id": grado_id}, {"_id": 0, "nombre": 1, "name": 1})
    if not grado:
        grado = await db.grades.find_one({"id": grado_id}, {"_id": 0, "nombre": 1, "name": 1})
    seccion = await db.secciones.find_one({"id": seccion_id}, {"_id": 0, "nombre": 1, "name": 1})
    if not seccion:
        seccion = await db.sections.find_one({"id": seccion_id}, {"_id": 0, "nombre": 1, "name": 1})

    display_name = school_name if school_name.lower().startswith("colegio") else f"Colegio {school_name}"

    return {
        "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
        "student_photo": student.get("photo_url"),
        "student_initial": (student.get("name", "?")[:1]).upper(),
        "qr_token": student.get("qr_token"),
        "codigo_alumno": student.get("codigo_alumno"),
        "school_name": display_name,
        "school_logo": (school or {}).get("logo_url"),
        "nivel": (nivel or {}).get("nombre") or (nivel or {}).get("name") or "",
        "grado": (grado or {}).get("nombre") or (grado or {}).get("name") or "",
        "seccion": (seccion or {}).get("nombre") or (seccion or {}).get("name") or "",
    }


@router.get("/qr-templates/preview-teacher")
async def preview_teacher_template(current_user=Depends(get_current_user)):
    """Return a random teacher's data for HTML preview in the drawer."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    school_id = user.get("school_id")

    teacher = await db.users.find_one(
        {"school_id": school_id, "role": "teacher", "qr_token": {"$exists": True, "$ne": None}},
        {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1, "qr_token": 1}
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="No hay profesores con QR")

    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "name": 1, "school_name": 1, "logo_url": 1})
    school_name = (school or {}).get("name") or (school or {}).get("school_name") or "Colegio"
    tenant = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "logo_carnet_url": 1, "logo_url": 1})
    display_name = school_name if school_name.lower().startswith("colegio") else f"Colegio {school_name}"

    return {
        "student_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
        "student_photo": teacher.get("photo_url"),
        "student_initial": (teacher.get("name", "?")[:1]).upper(),
        "qr_token": teacher.get("qr_token"),
        "codigo_alumno": None,
        "school_name": display_name,
        "school_logo": (tenant or {}).get("logo_carnet_url") or (tenant or {}).get("logo_url") or (school or {}).get("logo_url"),
        "nivel": "Docente",
        "grado": "",
        "seccion": "",
    }


@router.get("/qr-templates/count-teachers")
async def count_teachers_with_qr(current_user=Depends(get_current_user)):
    """Count teachers with QR token."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    school_id = user.get("school_id")
    count = await db.users.count_documents({
        "school_id": school_id, "role": "teacher",
        "qr_token": {"$exists": True, "$ne": None},
    })
    return {"count": count}


@router.get("/qr-templates/count-staff")
async def count_staff_with_qr(
    role: str = Query(...),
    current_user=Depends(get_current_user),
):
    """Count any staff role (auxiliar_*, personal_mantenimiento, teacher) with QR."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    if role not in STAFF_ROLES_WITH_QR:
        raise HTTPException(status_code=400, detail=f"Rol no soportado: {role}")
    school_id = user.get("school_id")
    count = await db.users.count_documents({
        "school_id": school_id, "role": role,
        "qr_token": {"$exists": True, "$ne": None},
    })
    return {"count": count}


@router.get("/qr-templates/preview-staff")
async def preview_staff_template(
    role: str = Query(...),
    current_user=Depends(get_current_user),
):
    """Return one staff user data for HTML preview in the drawer."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    if role not in STAFF_ROLES_WITH_QR:
        raise HTTPException(status_code=400, detail=f"Rol no soportado: {role}")
    school_id = user.get("school_id")

    target = await db.users.find_one(
        {"school_id": school_id, "role": role, "qr_token": {"$exists": True, "$ne": None}},
        {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1, "qr_token": 1},
    )
    if not target:
        raise HTTPException(status_code=404, detail=f"No hay {STAFF_ROLE_LABELS.get(role, role)} con QR")

    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "name": 1, "school_name": 1, "logo_url": 1})
    school_name = (school or {}).get("name") or (school or {}).get("school_name") or "Colegio"
    tenant = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "logo_carnet_url": 1, "logo_url": 1})
    display_name = school_name if school_name.lower().startswith("colegio") else f"Colegio {school_name}"

    # Per-school role label override (e.g., "Aux. Asistencia" → "Aux. Disciplina").
    from .role_labels import resolve_role_label
    role_label = await resolve_role_label(
        school_id, role, STAFF_ROLE_LABELS.get(role, role)
    )

    return {
        "student_name": f"{target.get('name', '')} {target.get('last_name', '')}".strip(),
        "student_photo": target.get("photo_url"),
        "student_initial": (target.get("name", "?")[:1]).upper(),
        "qr_token": target.get("qr_token"),
        "codigo_alumno": None,
        "school_name": display_name,
        "school_logo": (tenant or {}).get("logo_carnet_url") or (tenant or {}).get("logo_url") or (school or {}).get("logo_url"),
        "nivel": role_label,
        "grado": "",
        "seccion": "",
    }



@router.post("/qr-templates/download")
async def download_with_template(
    data: TemplateDownloadRequest,
    current_user=Depends(get_current_user)
):
    """Generate PDF/ZIP using the selected format and template."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No autorizado")

    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")

    try:
        if data.formato == "zip":
            from services.qr_exports.zip_exporter import generate_zip
            buf = await generate_zip(db, school_id, data, incluir_codigo=data.incluir_codigo_alumno, ordenar=data.ordenar_alfabetico)
            if buf is None:
                raise HTTPException(status_code=404, detail="No se encontraron estudiantes")
            filename = f"qr_images_{now_str}.zip"
            return StreamingResponse(buf, media_type="application/zip",
                headers={"Content-Disposition": f"attachment; filename={filename}"})

        elif data.formato == "pdf_lista":
            from services.qr_exports.list_pdf_exporter import generate_list_pdf
            buf = await generate_list_pdf(db, school_id, data, incluir_codigo=data.incluir_codigo_alumno, ordenar=data.ordenar_alfabetico)
            if buf is None:
                raise HTTPException(status_code=404, detail="No se encontraron estudiantes")
            filename = f"qr_lista_{now_str}.pdf"
            return StreamingResponse(buf, media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"})

        else:  # pdf_grid (default)
            tpl = get_template(data.template)
            buf = await tpl.generate_pdf(db, school_id, data, user,
                                         color_principal=data.color_principal,
                                         color_acento=data.color_acento)
            if buf is None:
                raise HTTPException(status_code=404, detail="No se encontraron estudiantes")
            filename = f"qr_carnets_{data.template}_{now_str}.pdf"
            return StreamingResponse(buf, media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"})

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[QR Templates] Download error: {e}")
        return JSONResponse(status_code=500, content={"detail": str(e)})


# Endpoint colocado aqui por conveniencia del flujo del drawer.
# Semanticamente el dato pertenece a tenant_settings.
@router.post("/qr-templates/upload-logo-carnet")
async def upload_logo_carnet(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    """Upload an alternative logo for QR carnets. Optimized to WebP."""
    import cloudinary
    import cloudinary.uploader
    from services.image_optimizer import ImageOptimizer

    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No autorizado")

    try:
        content = await file.read()
        try:
            optimized_bytes, new_filename = ImageOptimizer.validate_and_optimize(content, file.filename or "logo.png")
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        # Delete previous from Cloudinary
        existing = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "logo_carnet_public_id": 1})
        old_pid = (existing or {}).get("logo_carnet_public_id")
        if old_pid:
            try:
                cloudinary.uploader.destroy(old_pid)
            except Exception:
                pass

        result = cloudinary.uploader.upload(optimized_bytes, folder=f"edunet/logos-carnet/{school_id}", resource_type="image", format="webp")
        url = result.get("secure_url")
        public_id = result.get("public_id")

        await db.tenant_settings.update_one(
            {"school_id": school_id},
            {"$set": {"logo_carnet_url": url, "logo_carnet_public_id": public_id}},
            upsert=True
        )
        return {"logo_carnet_url": url}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[Logo Carnet] Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Error subiendo logo: {str(e)}")


@router.get("/qr-templates/logo-carnet")
async def get_logo_carnet(current_user=Depends(get_current_user)):
    """Get current carnet logo URL."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="No autorizado")
    school_id = user.get("school_id")
    settings = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "logo_carnet_url": 1})
    return {"logo_carnet_url": (settings or {}).get("logo_carnet_url")}


class SaveColorsRequest(BaseModel):
    template_id: str
    color_principal: str
    color_acento: str


@router.post("/qr-templates/save-colors")
async def save_template_colors(data: SaveColorsRequest, current_user=Depends(get_current_user)):
    """Save custom colors for a template (per school)."""
    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    school_id = user.get("school_id")
    await db.tenant_settings.update_one(
        {"school_id": school_id},
        {"$set": {f"qr_template_colors.{data.template_id}": {"color_principal": data.color_principal, "color_acento": data.color_acento}}},
        upsert=True
    )
    return {"message": "Colores guardados"}


@router.get("/qr-templates/saved-colors")
async def get_saved_colors(current_user=Depends(get_current_user)):
    """Get saved custom colors for all templates."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="No autorizado")
    school_id = user.get("school_id")
    settings = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "qr_template_colors": 1})
    return {"colors": (settings or {}).get("qr_template_colors", {})}


@router.post("/qr-templates/upload-watermark")
async def upload_watermark(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    """Upload watermark image for Moderna template. Optimized to WebP."""
    import cloudinary
    import cloudinary.uploader
    from services.image_optimizer import ImageOptimizer

    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No autorizado")

    try:
        content = await file.read()
        try:
            optimized_bytes, new_filename = ImageOptimizer.validate_and_optimize(content, file.filename or "watermark.png")
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        existing = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "watermark_moderna_public_id": 1})
        old_pid = (existing or {}).get("watermark_moderna_public_id")
        if old_pid:
            try:
                cloudinary.uploader.destroy(old_pid)
            except Exception:
                pass

        result = cloudinary.uploader.upload(optimized_bytes, folder=f"edunet/watermarks/{school_id}", resource_type="image", format="webp")
        url = result.get("secure_url")
        public_id = result.get("public_id")

        await db.tenant_settings.update_one(
            {"school_id": school_id},
            {"$set": {"watermark_moderna_url": url, "watermark_moderna_public_id": public_id}},
            upsert=True
        )
        return {"watermark_url": url}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[Watermark] Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Error subiendo marca de agua: {str(e)}")


@router.delete("/qr-templates/watermark")
async def delete_watermark(current_user=Depends(get_current_user)):
    """Delete watermark from Cloudinary and tenant_settings."""
    import cloudinary
    import cloudinary.uploader

    user = await resolve_user_from_token(current_user)
    if not user or not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    school_id = user.get("school_id")

    existing = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "watermark_moderna_public_id": 1})
    old_pid = (existing or {}).get("watermark_moderna_public_id")
    if old_pid:
        try:
            cloudinary.uploader.destroy(old_pid)
        except Exception:
            pass

    await db.tenant_settings.update_one(
        {"school_id": school_id},
        {"$set": {"watermark_moderna_url": None, "watermark_moderna_public_id": None}}
    )
    return {"message": "Marca de agua eliminada"}


@router.get("/qr-templates/watermark")
async def get_watermark(current_user=Depends(get_current_user)):
    """Get current watermark URL."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="No autorizado")
    school_id = user.get("school_id")
    settings = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "watermark_moderna_url": 1})
    return {"watermark_url": (settings or {}).get("watermark_moderna_url")}
