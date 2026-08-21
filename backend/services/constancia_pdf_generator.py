"""
Constancia de Matrícula - PDF Generator (formato oficial MINEDU, tabular).
Generates on-demand enrollment certificates using ReportLab. Never saves to disk.
Supports single-student and batch (one page per student) output.
"""
import os
from io import BytesIO
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
)
import logging

logger = logging.getLogger(__name__)

PERU_TZ = timezone(timedelta(hours=-5))

_NAVY = colors.HexColor("#1e293b")
_TITLE_BLUE = colors.HexColor("#2f3aa3")
_LABEL_BG = colors.HexColor("#d4d4d4")
_BORDER = colors.HexColor("#666666")

_ESCUDO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "minedu_escudo.png")


def _escudo(max_w=3.4 * cm, max_h=3.0 * cm):
    try:
        if not os.path.exists(_ESCUDO_PATH):
            return None
        img = Image(_ESCUDO_PATH)
        iw, ih = img.drawWidth, img.drawHeight
        ratio = min(max_w / iw, max_h / ih)
        img.drawWidth = iw * ratio
        img.drawHeight = ih * ratio
        return img
    except Exception as e:
        logger.warning(f"Constancia: no se pudo cargar el escudo MINEDU: {e}")
        return None


def _styles():
    base = getSampleStyleSheet()["Normal"]
    return {
        "minedu": ParagraphStyle("minedu", parent=base, fontSize=10, alignment=TA_LEFT,
                                 leading=12, fontName="Helvetica-Bold", textColor=colors.black),
        "meta": ParagraphStyle("meta", parent=base, fontSize=8, alignment=TA_RIGHT,
                             leading=11, textColor=colors.black),
        "title": ParagraphStyle("title", parent=base, fontSize=17, alignment=TA_CENTER,
                              leading=22, fontName="Helvetica-Bold", textColor=_TITLE_BLUE),
        "lr": ParagraphStyle("lr", parent=base, fontSize=8.5, alignment=TA_RIGHT,
                           leading=11, fontName="Helvetica-Bold", textColor=colors.black),
        "lc": ParagraphStyle("lc", parent=base, fontSize=8.5, alignment=TA_CENTER,
                           leading=11, fontName="Helvetica-Bold", textColor=colors.black),
        "vc": ParagraphStyle("vc", parent=base, fontSize=9, alignment=TA_CENTER, leading=12),
        "vl": ParagraphStyle("vl", parent=base, fontSize=9, alignment=TA_LEFT, leading=12),
        "sign": ParagraphStyle("sign", parent=base, fontSize=9.5, alignment=TA_CENTER, leading=13),
    }


def _build_constancia_story(*, school, student, level_name, grade_name, section_name,
                            year, turno_name, apoderado_name, codigo_modular,
                            ruc, periodo_del, periodo_al, S):
    legal_name = (school.get("legal_name") or school.get("name") or "INSTITUCIÓN EDUCATIVA").upper()

    apellidos = (student.get("last_name") or "").strip()
    nombres = (student.get("name") or "").strip()
    estudiante = f"{apellidos}, {nombres}".strip(", ").upper() or "-"
    dni = str(student.get("dni") or student.get("document_number") or "-")
    codigo = str(student.get("student_code") or "-")
    nivel = (level_name or "").strip() or "-"
    grado = (grade_name or "").strip() or "-"
    seccion = (section_name or "").strip() or "-"
    turno = (turno_name or "").strip().upper() or "-"
    apoderado = (apoderado_name or "").strip().upper() or "-"
    codmod = (codigo_modular or "").strip() or "-"

    hoy = datetime.now(PERU_TZ)
    story = []

    # ── Header: escudo + Ministerio de Educación | Fecha/Pág ──────────────────
    escudo = _escudo()
    left_cell = [escudo] if escudo else [Paragraph("Ministerio de Educación", S["minedu"])]
    header = Table([[left_cell, Paragraph(f"Fecha: {hoy.strftime('%d/%m/%Y')}<br/>Pág.: 1 de 1", S["meta"])]],
                   colWidths=[8.5 * cm, 8.5 * cm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (0, 0), "TOP"),
        ("VALIGN", (1, 0), (1, 0), "TOP"),
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
    ]))
    story.append(header)
    story.append(Spacer(1, 1.0 * cm))
    story.append(Paragraph(f"CONSTANCIA DE MATRÍCULA {year}", S["title"]))
    story.append(Spacer(1, 1.0 * cm))

    def LR(t):
        return Paragraph(t, S["lr"])

    def LC(t):
        return Paragraph(t, S["lc"])

    def VC(t):
        return Paragraph(t, S["vc"])

    def VL(t):
        return Paragraph(t, S["vl"])

    rows = [
        [LR("ESTUDIANTE"), VL(estudiante), LC("DNI"), VC(dni), LC("CÓDIGO"), VC(codigo)],
        [LR("INSTITUCIÓN EDUCATIVA"), VC(codmod), VC(legal_name), "", "", ""],
        [LR("PERÍODO PROMOCIONAL"), LC("DEL"), VC(periodo_del), "", LC("AL"), VC(periodo_al)],
        [LR("CICLO / NIVEL"), VC(nivel), "", "", LC("GRADO<br/>EDUCATIVO"), VC(grado)],
        [LR("SECCIÓN"), VC(seccion), "", "", LC("TURNO"), VC(turno)],
        [LR("APODERADO"), VC(apoderado), "", "", "", ""],
    ]
    grid = Table(rows, colWidths=[3.8 * cm, 3.8 * cm, 1.2 * cm, 1.9 * cm, 2.2 * cm, 4.1 * cm])
    grid.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.7, _BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        # spans
        ("SPAN", (2, 1), (5, 1)),   # school name
        ("SPAN", (2, 2), (3, 2)),   # DEL date
        ("SPAN", (1, 3), (3, 3)),   # nivel
        ("SPAN", (1, 4), (3, 4)),   # seccion
        ("SPAN", (1, 5), (5, 5)),   # apoderado
        # gray label backgrounds
        ("BACKGROUND", (0, 0), (0, -1), _LABEL_BG),
        ("BACKGROUND", (2, 0), (2, 0), _LABEL_BG),   # DNI
        ("BACKGROUND", (4, 0), (4, 0), _LABEL_BG),   # CÓDIGO
        ("BACKGROUND", (1, 2), (1, 2), _LABEL_BG),   # DEL
        ("BACKGROUND", (4, 2), (4, 2), _LABEL_BG),   # AL
        ("BACKGROUND", (4, 3), (4, 3), _LABEL_BG),   # GRADO EDUCATIVO
        ("BACKGROUND", (4, 4), (4, 4), _LABEL_BG),   # TURNO
    ]))
    story.append(grid)

    story.append(Spacer(1, 3.2 * cm))
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
    return generate_constancias_batch_pdf(items=[{
        "student": student, "level_name": level_name, "grade_name": grade_name,
        "section_name": section_name, "turno_name": turno_name, "apoderado_name": apoderado_name,
    }], school=school, year=year, codigo_modular=codigo_modular, ruc=ruc,
        periodo_del=periodo_del, periodo_al=periodo_al)


def generate_constancias_batch_pdf(*, items, school, year, codigo_modular="", ruc="",
                                   periodo_del="", periodo_al="") -> bytes:
    S = _styles()
    if not periodo_del:
        periodo_del = f"01/03/{year}"
    if not periodo_al:
        periodo_al = f"31/12/{year}"

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.8 * cm, rightMargin=1.8 * cm, topMargin=1.5 * cm, bottomMargin=2 * cm,
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
