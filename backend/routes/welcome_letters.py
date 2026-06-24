"""
welcome_letters.py — Descarga masiva de cartas de bienvenida (PDF en ZIP).

Genera una carta de bienvenida por FAMILIA con las credenciales de acceso del
padre y de cada hijo (usuario + contraseña), más la ruta de login del colegio.

REGLA DE ORO (seguridad de credenciales):
  - 100% SOLO-LECTURA sobre contraseñas. Usa `plain_password`; si falta, cae al DNI
    (convención del colegio: DNI = clave del alumno/padre). NO usa `password_display`.
  - NUNCA genera, resetea, regenera ni modifica contraseñas/hashes.
  - NO invoca ni replica el flujo de export-credentials (que hace backfill/reset).

Rendimiento (1000+ alumnos):
  - ReportLab en backend (sin navegador/html2canvas).
  - ZIP escrito a disco (tempfile), un PDF a la vez en memoria.
  - Proyección de Mongo (solo campos necesarios), 2 queries + join en memoria.
  - <= 300 familias: síncrono (StreamingResponse). > 300: job en background + polling.
"""
import asyncio
import io
import os
import re
import tempfile
import unicodedata
import uuid
import zipfile
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

from .core import db, get_current_user, resolve_user_from_token, is_admin_user

router = APIRouter(prefix="/api/users/welcome-letters", tags=["welcome_letters"])

SYNC_THRESHOLD = 300

_MESES = {1: "enero", 2: "febrero", 3: "marzo", 4: "abril", 5: "mayo", 6: "junio",
          7: "julio", 8: "agosto", 9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre"}


def _sanitize_filename(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").upper()
    return s or "FAMILIA"


def _resolve_pwd(person) -> str:
    """Contraseña a mostrar (SOLO-LECTURA). Usa el texto plano si existe; si no,
    cae al DNI (convención del colegio: DNI = clave). No modifica nada en la BD."""
    pwd = person.get("plain_password")
    if pwd not in (None, ""):
        return str(pwd)
    dni = person.get("dni")
    if dni not in (None, ""):
        return str(dni)
    return ""


def _fecha_es(distrito: str) -> str:
    now = datetime.now(timezone.utc) - timedelta(hours=5)  # hora Lima
    fecha = f"{now.day} de {_MESES[now.month]} de {now.year}"
    return f"{distrito + ', ' if distrito else ''}{fecha}"


async def _gather_context(school_id: str):
    """Carga colegio, ajustes, padres e hijos (con proyección) y arma el join."""
    school = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "school_name": 1, "name": 1, "nombre": 1, "subdomain": 1,
         "logo_url": 1, "libreta_director_name": 1},
    ) or {}
    settings = await db.tenant_settings.find_one(
        {"school_id": school_id}, {"_id": 0, "distrito": 1, "logo_url": 1, "system_name": 1}
    ) or {}

    school_name = settings.get("system_name") or school.get("school_name") or school.get("name") or school.get("nombre") or "Colegio"
    slug = school.get("subdomain") or school_id
    distrito = (settings.get("distrito") or "").strip()
    director = (school.get("libreta_director_name") or "").strip()
    logo_url = settings.get("logo_url") or school.get("logo_url")

    parents = await db.users.find(
        {"role": "parent", "school_id": school_id, "student_status": {"$ne": "deleted"}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "username": 1,
         "plain_password": 1, "dni": 1, "student_ids": 1, "children_ids": 1},
    ).sort([("last_name", 1), ("name", 1)]).to_list(None)

    students = await db.users.find(
        {"role": "student", "school_id": school_id, "is_active": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "username": 1,
         "plain_password": 1, "dni": 1, "padre_id": 1, "parent_id": 1},
    ).to_list(None)

    student_by_id = {s["id"]: s for s in students}
    by_parent = {}
    for s in students:
        for pid in (s.get("padre_id"), s.get("parent_id")):
            if pid:
                by_parent.setdefault(pid, {})[s["id"]] = s

    def children_for(parent):
        pid = parent["id"]
        acc = dict(by_parent.get(pid, {}))
        for sid in (parent.get("student_ids") or parent.get("children_ids") or []):
            if sid in student_by_id and sid not in acc:
                acc[sid] = student_by_id[sid]
        return list(acc.values())

    return {
        "school_name": school_name, "slug": slug, "distrito": distrito,
        "director": director, "logo_url": logo_url,
        "parents": parents, "children_for": children_for,
    }


async def _fetch_logo_bytes(logo_url: str):
    if not logo_url:
        return None
    try:
        from PIL import Image as PILImage
        async with httpx.AsyncClient(timeout=httpx.Timeout(6.0)) as client:
            resp = await client.get(logo_url)
            if resp.status_code == 200:
                pil = PILImage.open(io.BytesIO(resp.content))
                if pil.mode in ("RGBA", "P", "LA"):
                    pil = pil.convert("RGB")
                pil.thumbnail((240, 240))
                buf = io.BytesIO()
                pil.save(buf, format="JPEG", quality=80)
                buf.seek(0)
                return buf.getvalue()
    except Exception:
        return None
    return None


def _build_family_pdf(family, children, ctx, logo_bytes):
    """Construye el PDF de una familia. Devuelve (pdf_bytes, hijos_sin_pass[])."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_JUSTIFY, TA_RIGHT, TA_LEFT

    styles = getSampleStyleSheet()
    normal = ParagraphStyle("n", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=14, alignment=TA_JUSTIFY)
    right = ParagraphStyle("r", parent=normal, alignment=TA_RIGHT)
    bold = ParagraphStyle("b", parent=normal, fontName="Helvetica-Bold")
    h_label = ParagraphStyle("hl", parent=bold, fontSize=10, spaceBefore=8, spaceAfter=4)
    cell = ParagraphStyle("c", parent=normal, fontSize=9, leading=12, alignment=TA_LEFT)
    cell_b = ParagraphStyle("cb", parent=cell, fontName="Helvetica-Bold")

    fam_apellidos = f"{family.get('last_name','')}".strip() or family.get("name", "")
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=22 * mm, rightMargin=22 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm)
    story = []

    # Encabezado: logo (izq) + distrito/fecha (der)
    fecha = _fecha_es(ctx["distrito"])
    if logo_bytes:
        try:
            logo = Image(io.BytesIO(logo_bytes), width=22 * mm, height=22 * mm, kind="proportional")
            header = Table([[logo, Paragraph(fecha, right)]], colWidths=[28 * mm, None])
        except Exception:
            header = Table([["", Paragraph(fecha, right)]], colWidths=[28 * mm, None])
    else:
        header = Table([["", Paragraph(fecha, right)]], colWidths=[28 * mm, None])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(header)
    story.append(Spacer(1, 10))

    story.append(Paragraph(f"<b>Familia:</b> {fam_apellidos}", normal))
    story.append(Paragraph("Presente. -", normal))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Estimados Padres de Familia:", normal))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"La Institución Educativa Privada <b>{ctx['school_name']}</b> les saluda cordialmente y les "
        "informa que, como parte de nuestro compromiso con la mejora continua de la calidad educativa y "
        "la integración de herramientas tecnológicas en el proceso de enseñanza, se encuentra habilitado "
        "el servicio de Intranet Edunet.", normal))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Acceso a la plataforma:</b>", normal))
    story.append(Paragraph(f"https://edunet.pe/{ctx['slug']}/login", bold))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "A través de Edunet, los padres de familia podrán mantenerse informados sobre el desarrollo "
        "académico de sus hijos, acceder a tareas, actividades, comunicados, cronogramas, horarios y "
        "otros recursos importantes. Asimismo, podrán utilizar la plataforma desde cualquier dispositivo "
        "móvil mediante la aplicación Edunet App.", normal))
    story.append(Spacer(1, 6))
    story.append(Paragraph("El acceso a la plataforma se encuentra disponible en dos modalidades:", normal))
    story.append(Paragraph("• <b>Acceso Familiar:</b> Permite a los padres de familia visualizar la información de todos sus hijos matriculados en la institución.", normal))
    story.append(Paragraph("• <b>Acceso del Estudiante:</b> Permite al alumno acceder únicamente a la información académica que le corresponde.", normal))
    story.append(Spacer(1, 8))

    # Bloque PADRES
    story.append(Paragraph("Datos de acceso familiar (PADRES):", h_label))
    fam_tbl = Table([
        [Paragraph("Familia", cell_b), Paragraph(fam_apellidos, cell)],
        [Paragraph("Usuario", cell_b), Paragraph(str(family.get("username", "")), cell)],
        [Paragraph("Contraseña", cell_b), Paragraph(_resolve_pwd(family), cell)],
    ], colWidths=[35 * mm, None])
    fam_tbl.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(fam_tbl)
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "Adicionalmente, su(s) menor(es) hijo(s) cuenta(n) con usuario y contraseña propios, mediante los "
        "cuales podrán revisar sus tareas, horarios, cronogramas, enlaces de interés, materiales educativos "
        "y mantener comunicación con sus docentes.", normal))
    story.append(Spacer(1, 6))

    # Bloque ESTUDIANTES
    excluded_children = []
    story.append(Paragraph("Datos de acceso del/los estudiante(s):", h_label))
    rows = [[Paragraph("Estudiante", cell_b), Paragraph("Usuario", cell_b), Paragraph("Contraseña", cell_b)]]
    for ch in children:
        nombre = f"{ch.get('name','')} {ch.get('last_name','')}".strip()
        pwd = _resolve_pwd(ch)
        if pwd:
            pwd_txt = pwd
        else:
            pwd_txt = "(no registrada)"
            excluded_children.append(ch)
        rows.append([Paragraph(nombre, cell), Paragraph(str(ch.get("username", "")), cell), Paragraph(pwd_txt, cell)])
    stu_tbl = Table(rows, colWidths=[None, 45 * mm, 40 * mm])
    stu_tbl.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(stu_tbl)
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        "Agradecemos su colaboración y los invitamos a hacer uso de esta herramienta, diseñada para "
        "fortalecer la comunicación entre la familia y la institución educativa.", normal))
    story.append(Spacer(1, 16))
    story.append(Paragraph("Atentamente,", normal))
    story.append(Spacer(1, 20))
    if ctx["director"]:
        story.append(Paragraph(f"<b>{ctx['director']}</b>", normal))
    story.append(Paragraph("Director(a)", normal))

    doc.build(story)
    buf.seek(0)
    return buf.getvalue(), excluded_children


def _write_zip(zip_path, ctx, logo_bytes, progress_cb=None):
    """Construye el ZIP en disco. progress_cb(processed, total). Devuelve resumen."""
    parents = ctx["parents"]
    total = len(parents)
    omitted_families = []   # (apellidos, username)
    excluded_kids = []      # (familia, nombre, username)
    used_names = {}
    processed = 0

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fam in parents:
            processed += 1
            apellidos = (fam.get("last_name") or fam.get("name") or "").strip()
            if not _resolve_pwd(fam):
                omitted_families.append((apellidos, fam.get("username") or fam.get("id")))
                if progress_cb:
                    progress_cb(processed, total)
                continue

            children = ctx["children_for"](fam)
            pdf_bytes, kids_sin = _build_family_pdf(fam, children, ctx, logo_bytes)
            for ch in kids_sin:
                excluded_kids.append((apellidos, f"{ch.get('name','')} {ch.get('last_name','')}".strip(), ch.get("username") or ch.get("id")))

            base = f"{_sanitize_filename(apellidos)}_{_sanitize_filename(fam.get('username') or fam.get('id'))}"
            n = used_names.get(base, 0)
            used_names[base] = n + 1
            fname = f"cartas/{base}{('_' + str(n + 1)) if n else ''}.pdf"
            zf.writestr(fname, pdf_bytes)
            if progress_cb:
                progress_cb(processed, total)

        # _EXCLUIDOS.txt
        lines = []
        lines.append("FAMILIAS OMITIDAS (sin contraseña de padre):")
        if omitted_families:
            for ap, un in omitted_families:
                lines.append(f"- {ap} | {un}")
        else:
            lines.append("- (ninguna)")
        lines.append("")
        lines.append("HIJOS SIN CONTRASEÑA (familia incluida, hijo marcado \"no registrada\"):")
        if excluded_kids:
            for fam_ap, nombre, un in excluded_kids:
                lines.append(f"- Familia {fam_ap} → {nombre} ({un})")
        else:
            lines.append("- (ninguno)")
        zf.writestr("_EXCLUIDOS.txt", "\n".join(lines))

    return {
        "total": total,
        "omitted_families": len(omitted_families),
        "excluded_children": len(excluded_kids),
        "generated": total - len(omitted_families),
    }


async def _require_admin(current_user):
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=400, detail="school_id es requerido")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden generar cartas de bienvenida")
    return user


@router.get("/info")
async def welcome_info(current_user=Depends(get_current_user)):
    user = await _require_admin(current_user)
    total = await db.users.count_documents({"role": "parent", "school_id": user["school_id"], "student_status": {"$ne": "deleted"}})
    return {"total_families": total, "mode": "sync" if total <= SYNC_THRESHOLD else "background", "threshold": SYNC_THRESHOLD}


@router.get("/download")
async def welcome_download_sync(current_user=Depends(get_current_user)):
    """Generación SÍNCRONA (<= 300 familias). Devuelve el ZIP directamente."""
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    ctx = await _gather_context(school_id)
    if not ctx["parents"]:
        raise HTTPException(status_code=404, detail="No hay familias para generar")
    logo_bytes = await _fetch_logo_bytes(ctx["logo_url"])

    tmp = tempfile.NamedTemporaryFile(prefix="welcome_", suffix=".zip", delete=False)
    tmp.close()
    await asyncio.to_thread(_write_zip, tmp.name, ctx, logo_bytes, None)

    fecha = (datetime.now(timezone.utc) - timedelta(hours=5)).strftime("%Y%m%d")
    download_name = f"cartas_bienvenida_{ctx['slug']}_{fecha}.zip"

    def _iter():
        try:
            with open(tmp.name, "rb") as f:
                while True:
                    chunk = f.read(64 * 1024)
                    if not chunk:
                        break
                    yield chunk
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass

    return StreamingResponse(_iter(), media_type="application/zip",
                             headers={"Content-Disposition": f'attachment; filename="{download_name}"'})


async def _run_job(job_id: str, school_id: str, slug_hint: str):
    try:
        ctx = await _gather_context(school_id)
        total = len(ctx["parents"])
        await db.welcome_letter_jobs.update_one({"job_id": job_id}, {"$set": {"total": total}})
        if total == 0:
            await db.welcome_letter_jobs.update_one({"job_id": job_id}, {"$set": {"status": "error", "error": "No hay familias para generar"}})
            return
        logo_bytes = await _fetch_logo_bytes(ctx["logo_url"])
        tmp_path = os.path.join(tempfile.gettempdir(), f"welcome_{job_id}.zip")

        progress = {"n": 0}

        def progress_cb(processed, tot):
            progress["n"] = processed  # solo muta un contador (thread-safe para int)

        # Construye el ZIP en un hilo (CPU) y refresca el progreso en Mongo desde el loop.
        fut = asyncio.ensure_future(asyncio.to_thread(_write_zip, tmp_path, ctx, logo_bytes, progress_cb))
        while not fut.done():
            await db.welcome_letter_jobs.update_one({"job_id": job_id}, {"$set": {"processed": progress["n"]}})
            await asyncio.sleep(1.0)
        summary = await fut
        await db.welcome_letter_jobs.update_one(
            {"job_id": job_id},
            {"$set": {"status": "done", "processed": summary["total"], "file_path": tmp_path,
                      "summary": summary, "finished_at": datetime.now(timezone.utc).isoformat()}},
        )
    except Exception as e:
        await db.welcome_letter_jobs.update_one({"job_id": job_id}, {"$set": {"status": "error", "error": str(e)[:300]}})


@router.get("/start")
async def welcome_start_job(current_user=Depends(get_current_user)):
    """Inicia un job en background (> 300 familias). Devuelve job_id para polling."""
    user = await _require_admin(current_user)
    school_id = user["school_id"]
    job_id = str(uuid.uuid4())
    await db.welcome_letter_jobs.insert_one({
        "job_id": job_id, "school_id": school_id, "status": "processing",
        "processed": 0, "total": 0, "file_path": None, "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    asyncio.create_task(_run_job(job_id, school_id, ""))
    return {"job_id": job_id, "status": "processing"}


@router.get("/jobs/{job_id}")
async def welcome_job_status(job_id: str, current_user=Depends(get_current_user)):
    user = await _require_admin(current_user)
    job = await db.welcome_letter_jobs.find_one({"job_id": job_id, "school_id": user["school_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return {
        "job_id": job_id, "status": job.get("status"), "processed": job.get("processed", 0),
        "total": job.get("total", 0), "error": job.get("error"),
        "summary": job.get("summary"), "ready": job.get("status") == "done",
    }


@router.get("/jobs/{job_id}/download")
async def welcome_job_download(job_id: str, current_user=Depends(get_current_user)):
    user = await _require_admin(current_user)
    job = await db.welcome_letter_jobs.find_one({"job_id": job_id, "school_id": user["school_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    if job.get("status") != "done" or not job.get("file_path") or not os.path.exists(job["file_path"]):
        raise HTTPException(status_code=409, detail="El archivo aún no está listo")

    ctx_slug = (await db.schools.find_one({"id": user["school_id"]}, {"_id": 0, "subdomain": 1}) or {}).get("subdomain") or user["school_id"]
    fecha = (datetime.now(timezone.utc) - timedelta(hours=5)).strftime("%Y%m%d")
    download_name = f"cartas_bienvenida_{ctx_slug}_{fecha}.zip"
    path = job["file_path"]

    def _iter():
        with open(path, "rb") as f:
            while True:
                chunk = f.read(64 * 1024)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(_iter(), media_type="application/zip",
                             headers={"Content-Disposition": f'attachment; filename="{download_name}"'})
