"""
Constancia de Matrícula - PDF Generator (formato oficial tipo SIAGIE, tabular).
Generates on-demand enrollment certificates using ReportLab. Never saves to disk.
Supports single-student and batch (one page per student) output.
"""
from io import BytesIO
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
)
import requests
import logging

logger = logging.getLogger(__name__)

PERU_TZ = timezone(timedelta(hours=-5))

_NAVY = colors.HexColor("#1e293b")
_LABEL_BG = colors.HexColor("#eef2f7")
_BORDER = colors.HexColor("#334155")

_logo_cache: dict = {}


def _download_logo(url: str, max_w=2.6 * cm, max_h=2.6 * cm):
    if not url:
        return None
    try:
        if url not in _logo_cache:
            resp = requests.get(url, timeout=8)
            resp.raise_for_status()
            _logo_cache[url] = resp.content
        img = Image(BytesIO(_logo_cache[url]))
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


def _styles():
    styles = getSampleStyleSheet()
    return {
        "school": ParagraphStyle("school", parent=styles["Normal"], fontSize=12,
                                 alignment=TA_CENTER, leading=15, fontName="Helvetica-Bold",
                                 textColor=_NAVY),
        "inst": ParagraphStyle("inst", parent=styles["Normal"], fontSize=8,
                              alignment=TA_CENTER, leading=11, textColor=colors.HexColor("#475569")),
        "meta": ParagraphStyle("meta", parent=styles["Normal"], fontSize=8,
                             alignment=2, leading=11, textColor=colors.HexColor("#475569")),
        "title": ParagraphStyle("title", parent=styles["Normal"], fontSize=16,
                              alignment=TA_CENTER, leading=20, fontName="Helvetica-Bold",
                              textColor=colors.HexColor("#0f172a")),
        "label": ParagraphStyle("label", parent=styles["Normal"], fontSize=8.5,
                             alignment=TA_LEFT, leading=11, fontName="Helvetica-Bold",
                             textColor=_NAVY),
        "value": ParagraphStyle("value", parent=styles["Normal"], fontSize=9.5,
                             alignment=TA_LEFT, leading=12),
        "sign": ParagraphStyle("sign", parent=styles["Normal"], fontSize=9.5,
                            alignment=TA_CENTER, leading=13),
    }


def _build_constancia_story(*, school, student, level_name, grade_name, section_name,
                            year, turno_name, apoderado_name, codigo_modular,
                            ruc, periodo_del, periodo_al, S):
    """Return a list of flowables for ONE constancia."""
    legal_name = (school.get("legal_name") or school.get("name") or "INSTITUCIÓN EDUCATIVA").upper()
    logo = _download_logo(school.get("logo_url"))

    apellidos = (student.get("last_name") or "").strip()
    nombres = (student.get("name") or "").strip()
    estudiante = f"{apellidos}, {nombres}".strip(", ").upper() or "-"
    dni = student.get("dni") or student.get("document_number") or "-"
    codigo = student.get("student_code") or "-"
    nivel = (level_name or "").strip() or "-"
    grado = (grade_name or "").strip() or "-"
    seccion = (section_name or "").strip() or "-"
    turno = (turno_name or "").strip().upper() or "-"
    apoderado = (apoderado_name or "").strip().upper() or "-"
    periodo = f"DEL {periodo_del}   AL {periodo_al}"

    hoy = datetime.now(PERU_TZ)
    story = []

    # ── Header ───────────────────────────────────────────────────────────────
    inst_bits = []
    if ruc:
        inst_bits.append(f"RUC: {ruc}")
    if codigo_modular:
        inst_bits.append(f"Código Modular: {codigo_modular}")
    school_block = [Paragraph(legal_name, S["school"])]
    if inst_bits:
        school_block.append(Paragraph(" · ".join(inst_bits), S["inst"]))
    header = Table([[
        logo if logo else Paragraph("", S["meta"]),
        school_block,
        Paragraph(f"Fecha: {hoy.strftime('%d/%m/%Y')}<br/>Pág.: 1 de 1", S["meta"]),
    ]], colWidths=[3 * cm, 10.5 * cm, 3.5 * cm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("ALIGN", (2, 0), (2, 0), "RIGHT"),
    ]))
    story.append(header)
    story.append(Spacer(1, 0.25 * cm))
    story.append(Table([[""]], colWidths=[17 * cm], rowHeights=[1],
                       style=TableStyle([("LINEBELOW", (0, 0), (-1, -1), 1.2, _NAVY)])))
    story.append(Spacer(1, 0.7 * cm))
    story.append(Paragraph(f"CONSTANCIA DE MATRÍCULA {year}", S["title"]))
    story.append(Spacer(1, 0.7 * cm))

    def L(t):
        return Paragraph(t, S["label"])

    def V(t):
        return Paragraph(t, S["value"])

    rows = [
        [L("ESTUDIANTE"), V(estudiante), L("DNI"), V(str(dni))],
        [L("INSTITUCIÓN EDUCATIVA"), V(legal_name), L("CÓDIGO"), V(str(codigo))],
        [L("PERÍODO PROMOCIONAL"), V(periodo), L("CICLO / NIVEL"), V(nivel)],
        [L("SECCIÓN"), V(seccion), L("GRADO"), V(grado)],
        [L("APODERADO"), V(apoderado), L("TURNO"), V(turno)],
    ]
    grid = Table(rows, colWidths=[3.7 * cm, 6.0 * cm, 3.3 * cm, 4.0 * cm])
    grid.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.6, _BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("BACKGROUND", (0, 0), (0, -1), _LABEL_BG),
        ("BACKGROUND", (2, 0), (2, -1), _LABEL_BG),
    ]))
    story.append(grid)

    story.append(Spacer(1, 4.0 * cm))
    director_name = (school.get("libreta_director_name") or "").strip()
    sign_lines = ["_______________________________________"]
    if director_name:
        sign_lines.append(f"<b>{director_name}</b>")
    sign_lines.append("Director(a) / Sub Director(a)")
    sign_lines.append('<font size="8" color="#64748b">Firma - Post Firma y Sello</font>')
    sign_para = Paragraph("<br/>".join(sign_lines), S["sign"])
    sign_tbl = Table([["", sign_para, ""]], colWidths=[4.5 * cm, 8 * cm, 4.5 * cm])
    sign_tbl.setStyle(TableStyle([("ALIGN", (1, 0), (1, 0), "CENTER")]))
    story.append(sign_tbl)
    return story


def generate_constancia_pdf(*, school, student, level_name, grade_name, section_name,
                            year, turno_name="", apoderado_name="", codigo_modular="",
                            ruc="", periodo_del="", periodo_al="") -> bytes:
    """Single-student constancia PDF."""
    return generate_constancias_batch_pdf(items=[{
        "student": student, "level_name": level_name, "grade_name": grade_name,
        "section_name": section_name, "turno_name": turno_name, "apoderado_name": apoderado_name,
    }], school=school, year=year, codigo_modular=codigo_modular, ruc=ruc,
        periodo_del=periodo_del, periodo_al=periodo_al)


def generate_constancias_batch_pdf(*, items, school, year, codigo_modular="", ruc="",
                                   periodo_del="", periodo_al="") -> bytes:
    """Batch constancia PDF: one page per student in `items`."""
    S = _styles()
    if not periodo_del:
        periodo_del = f"01/03/{year}"
    if not periodo_al:
        periodo_al = f"31/12/{year}"

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.6 * cm, bottomMargin=2 * cm,
    )
    story = []
    for i, it in enumerate(items):
        story.extend(_build_constancia_story(
            school=school, student=it["student"], level_name=it.get("level_name", ""),
            grade_name=it.get("grade_name", ""), section_name=it.get("section_name", ""),
            year=year, turno_name=it.get("turno_name", ""), apoderado_name=it.get("apoderado_name", ""),
            codigo_modular=codigo_modular, ruc=ruc, periodo_del=periodo_del, periodo_al=periodo_al, S=S))
        if i < len(items) - 1:
            story.append(PageBreak())
    doc.build(story)
    buf.seek(0)
    return buf.read()
