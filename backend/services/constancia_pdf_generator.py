"""
Constancia de Matrícula - PDF Generator
Generates on-demand enrollment certificates using ReportLab. Never saves to disk.
"""
from io import BytesIO
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
)
import requests
import logging

logger = logging.getLogger(__name__)

PERU_TZ = timezone(timedelta(hours=-5))

_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _fecha_larga(dt: datetime) -> str:
    return f"{dt.day} de {_MESES[dt.month - 1]} de {dt.year}"


def _download_logo(url: str, max_w=3 * cm, max_h=2.8 * cm):
    if not url:
        return None
    try:
        resp = requests.get(url, timeout=8)
        resp.raise_for_status()
        img = Image(BytesIO(resp.content))
        iw, ih = img.drawWidth, img.drawHeight
        if iw <= 0 or ih <= 0:
            return None
        ratio = min(max_w / iw, max_h / ih)
        img.drawWidth = iw * ratio
        img.drawHeight = ih * ratio
        return img
    except Exception as e:
        logger.warning(f"Constancia: no se pudo cargar el logo {url}: {e}")
        return None


def generate_constancia_pdf(*, school: dict, student: dict, level_name: str,
                            grade_name: str, section_name: str, year: str) -> bytes:
    """Return the constancia de matrícula as PDF bytes."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    st_school = ParagraphStyle("school", parent=styles["Normal"], fontSize=13,
                               alignment=TA_CENTER, leading=16, spaceAfter=2,
                               fontName="Helvetica-Bold", textColor=colors.HexColor("#1e293b"))
    st_title = ParagraphStyle("title", parent=styles["Normal"], fontSize=17,
                              alignment=TA_CENTER, leading=22, spaceBefore=6,
                              fontName="Helvetica-Bold", textColor=colors.HexColor("#0f172a"))
    st_body = ParagraphStyle("body", parent=styles["Normal"], fontSize=12,
                             alignment=TA_JUSTIFY, leading=22, spaceBefore=6)
    st_sign = ParagraphStyle("sign", parent=styles["Normal"], fontSize=11,
                            alignment=TA_CENTER, leading=14)

    legal_name = (school.get("legal_name") or school.get("name") or "INSTITUCIÓN EDUCATIVA").upper()
    logo = _download_logo(school.get("logo_url"))

    full_name = f"{student.get('name', '') or ''} {student.get('last_name', '') or ''}".strip().upper()
    dni = student.get("dni") or student.get("document_number") or ""
    ubic = " ".join([p for p in [level_name, grade_name] if p]).strip()
    seccion_txt = f' sección "{section_name}"' if section_name else ""

    story = []

    # Header: logo + school name
    if logo:
        header = Table([[logo, Paragraph(legal_name, st_school)]],
                       colWidths=[3.2 * cm, None])
        header.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (0, 0), "CENTER"),
        ]))
        story.append(header)
    else:
        story.append(Paragraph(legal_name, st_school))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Table([[""]], colWidths=[None], rowHeights=[1],
                       style=TableStyle([("LINEBELOW", (0, 0), (-1, -1), 1, colors.HexColor("#94a3b8"))])))
    story.append(Spacer(1, 0.9 * cm))

    story.append(Paragraph("CONSTANCIA DE MATRÍCULA", st_title))
    story.append(Spacer(1, 1.0 * cm))

    dni_txt = f", identificado(a) con DNI N° <b>{dni}</b>" if dni else ""
    cuerpo = (
        f"El(La) Director(a) de la {legal_name}, deja constancia que el(la) estudiante "
        f"<b>{full_name}</b>{dni_txt}, se encuentra matriculado(a) en el nivel <b>{ubic}</b>"
        f"{seccion_txt} durante el año escolar <b>{year}</b>."
    )
    story.append(Paragraph(cuerpo, st_body))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        "Se expide la presente constancia a solicitud de la parte interesada, para los fines "
        "que estime convenientes.", st_body))

    story.append(Spacer(1, 1.5 * cm))
    hoy = datetime.now(PERU_TZ)
    story.append(Paragraph(f"{_fecha_larga(hoy)}.", ParagraphStyle(
        "date", parent=st_body, alignment=2)))

    story.append(Spacer(1, 3.2 * cm))

    director_name = (school.get("libreta_director_name") or "").strip()
    sign_lines = ["_______________________________"]
    if director_name:
        sign_lines.append(f"<b>{director_name}</b>")
    sign_lines.append("DIRECTOR(A)")
    sign_para = Paragraph("<br/>".join(sign_lines), st_sign)
    sign_tbl = Table([[sign_para]], colWidths=[8 * cm])
    sign_tbl.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    story.append(Table([["", sign_tbl]], colWidths=[None, 8 * cm],
                       style=TableStyle([("ALIGN", (1, 0), (1, 0), "CENTER")])))

    doc.build(story)
    buf.seek(0)
    return buf.read()
