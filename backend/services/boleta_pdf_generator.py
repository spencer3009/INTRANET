"""
Boleta de Venta Interna - PDF Generator
Generates on-demand PDF receipts using ReportLab. Never saves to disk.
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
)
from reportlab.pdfgen import canvas
from num2words import num2words
import requests
import logging

logger = logging.getLogger(__name__)

WIDTH, HEIGHT = A4  # 595.27, 841.89 points


def monto_en_letras(total: float) -> str:
    entero = int(total)
    decimales = int(round((total - entero) * 100))
    texto = num2words(entero, lang='es').upper()
    return f"SON {texto} Y {decimales:02d}/100 SOLES"


def _download_logo(url: str, max_w=3 * cm, max_h=2.5 * cm):
    """Download logo from URL and return a ReportLab Image, or None on failure."""
    if not url:
        return None
    try:
        resp = requests.get(url, timeout=8)
        resp.raise_for_status()
        img_buf = BytesIO(resp.content)
        img = Image(img_buf)
        # Scale to fit
        iw, ih = img.drawWidth, img.drawHeight
        if iw <= 0 or ih <= 0:
            return None
        ratio = min(max_w / iw, max_h / ih)
        img.drawWidth = iw * ratio
        img.drawHeight = ih * ratio
        return img
    except Exception as e:
        logger.warning(f"Failed to download logo from {url}: {e}")
        return None


class _WatermarkCanvas(canvas.Canvas):
    """Canvas that adds ANULADA watermark if flagged."""

    def __init__(self, *args, watermark_text=None, **kwargs):
        self._watermark_text = watermark_text
        super().__init__(*args, **kwargs)

    def showPage(self):
        if self._watermark_text:
            self.saveState()
            self.setFont("Helvetica-Bold", 72)
            self.setFillColor(colors.Color(0.9, 0.1, 0.1, alpha=0.25))
            self.translate(WIDTH / 2, HEIGHT / 2)
            self.rotate(45)
            self.drawCentredString(0, 0, self._watermark_text)
            self.restoreState()
        super().showPage()


def generar_boleta_pdf(boleta: dict) -> bytes:
    """
    Generate a Boleta de Venta Interna PDF in memory.
    Returns raw PDF bytes ready for HTTP Response.
    """
    buffer = BytesIO()

    watermark = "ANULADA" if boleta.get("anulada") else None

    def canvas_maker(*args, **kwargs):
        return _WatermarkCanvas(*args, watermark_text=watermark, **kwargs)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=1.2 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
    )

    styles = getSampleStyleSheet()
    sNormal = styles["Normal"]

    # Custom styles
    sTitle = ParagraphStyle("sTitle", parent=sNormal, fontSize=14, leading=17, fontName="Helvetica-Bold", alignment=TA_LEFT)
    sSubtitle = ParagraphStyle("sSubtitle", parent=sNormal, fontSize=8, leading=10, textColor=colors.HexColor("#666666"))
    sLabel = ParagraphStyle("sLabel", parent=sNormal, fontSize=8, leading=10, fontName="Helvetica-Bold", textColor=colors.HexColor("#555555"))
    sValue = ParagraphStyle("sValue", parent=sNormal, fontSize=9, leading=12)
    sSmall = ParagraphStyle("sSmall", parent=sNormal, fontSize=7, leading=9, textColor=colors.HexColor("#999999"))
    sRight = ParagraphStyle("sRight", parent=sNormal, fontSize=9, leading=12, alignment=TA_RIGHT)
    sRightBold = ParagraphStyle("sRightBold", parent=sNormal, fontSize=11, leading=14, fontName="Helvetica-Bold", alignment=TA_RIGHT)
    sCenterBold = ParagraphStyle("sCenterBold", parent=sNormal, fontSize=9, leading=12, fontName="Helvetica-Bold", alignment=TA_CENTER)
    sLetras = ParagraphStyle("sLetras", parent=sNormal, fontSize=8, leading=10, fontName="Helvetica-Bold")
    sDisclaimer = ParagraphStyle("sDisclaimer", parent=sNormal, fontSize=7, leading=9, textColor=colors.HexColor("#999999"), alignment=TA_CENTER)
    sFooterLabel = ParagraphStyle("sFooterLabel", parent=sNormal, fontSize=7, leading=9, fontName="Helvetica-Bold", textColor=colors.HexColor("#888888"))
    sFooterValue = ParagraphStyle("sFooterValue", parent=sNormal, fontSize=8, leading=10)

    emisor = boleta.get("emisor", {})
    cliente = boleta.get("cliente", {})
    story = []

    # ── HEADER ──────────────────────────────────────────────────────
    logo_img = _download_logo(emisor.get("logo_url"))
    logo_cell = logo_img if logo_img else Paragraph("", sNormal)

    # Emisor info block
    emisor_lines = f"""<b>{emisor.get('razon_social', '')}</b><br/>
<font size="8" color="#666666">{emisor.get('direccion', '')}</font><br/>
<font size="7" color="#999999">{emisor.get('distrito', '')} - {emisor.get('provincia', '')} - {emisor.get('departamento', '')}</font>"""
    if emisor.get("telefono"):
        emisor_lines += f'<br/><font size="7" color="#999999">Tel: {emisor["telefono"]}</font>'

    emisor_para = Paragraph(emisor_lines, ParagraphStyle("emisorP", parent=sNormal, fontSize=10, leading=13))

    # RUC / Document box
    ruc_box_content = f"""<b>RUC {emisor.get('ruc', '')}</b><br/>
<font size="9"><b>BOLETA DE VENTA</b></font><br/>
<font size="10" color="#1a1a1a"><b>{boleta.get('numero_completo', '')}</b></font>"""
    ruc_para = Paragraph(ruc_box_content, ParagraphStyle("rucP", parent=sNormal, fontSize=9, leading=13, alignment=TA_CENTER))

    # Build header table: [logo | emisor_info | ruc_box]
    avail_w = doc.width
    col_logo = 2.8 * cm
    col_ruc = 5.5 * cm
    col_emisor = avail_w - col_logo - col_ruc

    header_data = [[logo_cell, emisor_para, ruc_para]]
    header_table = Table(header_data, colWidths=[col_logo, col_emisor, col_ruc])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 0),
        ("BOX", (2, 0), (2, 0), 0.5, colors.HexColor("#CCCCCC")),
        ("TOPPADDING", (2, 0), (2, 0), 6),
        ("BOTTOMPADDING", (2, 0), (2, 0), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.5 * cm))

    # ── CLIENT / DATE BLOCK ─────────────────────────────────────────
    fecha_emision = boleta.get("fecha_emision", "")
    if hasattr(fecha_emision, "strftime"):
        fecha_emision = fecha_emision.strftime("%d/%m/%Y")
    elif isinstance(fecha_emision, str) and "T" in fecha_emision:
        fecha_emision = fecha_emision[:10].split("-")
        if len(fecha_emision) == 3:
            fecha_emision = f"{fecha_emision[2]}/{fecha_emision[1]}/{fecha_emision[0]}"
        else:
            fecha_emision = str(boleta.get("fecha_emision", ""))

    left_data = [
        [Paragraph("CLIENTE", sLabel), Paragraph(cliente.get("nombre_completo", "---"), sValue)],
        [Paragraph("DNI", sLabel), Paragraph(cliente.get("dni", "---"), sValue)],
        [Paragraph("ESTUDIANTE", sLabel), Paragraph(cliente.get("estudiante_nombre", "---"), sValue)],
        [Paragraph("GRADO/SECC.", sLabel), Paragraph(cliente.get("grado_seccion", "---"), sValue)],
    ]

    metodo_map = {
        "efectivo": "Efectivo", "transferencia": "Transferencia", "yape": "Yape",
        "plin": "Plin", "tarjeta": "Tarjeta"
    }
    metodo_label = metodo_map.get(boleta.get("metodo_pago", ""), boleta.get("metodo_pago", ""))

    right_data = [
        [Paragraph("FECHA EMISION", sLabel), Paragraph(str(fecha_emision), sValue)],
        [Paragraph("MONEDA", sLabel), Paragraph("SOLES", sValue)],
        [Paragraph("METODO PAGO", sLabel), Paragraph(metodo_label, sValue)],
    ]

    left_table = Table(left_data, colWidths=[2.5 * cm, 6 * cm])
    left_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))

    right_table = Table(right_data, colWidths=[3 * cm, 4 * cm])
    right_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))

    info_row = Table([[left_table, right_table]], colWidths=[avail_w * 0.55, avail_w * 0.45])
    info_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 0),
    ]))
    story.append(info_row)
    story.append(Spacer(1, 0.5 * cm))

    # ── DETAIL TABLE ────────────────────────────────────────────────
    concepto = boleta.get("concepto", "---")
    mes = boleta.get("mes", "")
    total = boleta.get("total", 0)
    monto_base = boleta.get("monto_base", 0)

    header_style = ParagraphStyle("thP", parent=sNormal, fontSize=8, leading=10, fontName="Helvetica-Bold", textColor=colors.HexColor("#333333"))
    cell_style = ParagraphStyle("tdP", parent=sNormal, fontSize=9, leading=12)
    cell_right = ParagraphStyle("tdR", parent=sNormal, fontSize=9, leading=12, alignment=TA_RIGHT)

    detail_header = [
        Paragraph("N.", header_style),
        Paragraph("DESCRIPCION", header_style),
        Paragraph("MES", header_style),
        Paragraph("CANT.", header_style),
        Paragraph("P. UNIT.", header_style),
        Paragraph("TOTAL", header_style),
    ]

    detail_row = [
        Paragraph("1", cell_style),
        Paragraph(concepto, cell_style),
        Paragraph(mes or "-", cell_style),
        Paragraph("1.00", cell_right),
        Paragraph(f"S/ {monto_base:.2f}", cell_right),
        Paragraph(f"S/ {monto_base:.2f}", cell_right),
    ]

    col_widths = [1 * cm, avail_w - 11 * cm, 3 * cm, 2 * cm, 2.5 * cm, 2.5 * cm]

    detail_table = Table([detail_header, detail_row], colWidths=col_widths, repeatRows=1)
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEEEEE")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#333333")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
    ]))
    story.append(detail_table)
    story.append(Spacer(1, 0.4 * cm))

    # ── TOTAL EN LETRAS ─────────────────────────────────────────────
    total_en_letras = boleta.get("total_en_letras", monto_en_letras(total))
    story.append(Paragraph(total_en_letras, sLetras))
    story.append(Spacer(1, 0.3 * cm))

    # ── TOTALS BLOCK ────────────────────────────────────────────────
    subtotal = boleta.get("subtotal", monto_base)
    igv = boleta.get("igv", 0)
    incluye_igv = boleta.get("incluye_igv", False)

    totals_data = []
    if incluye_igv:
        totals_data.append([Paragraph("GRAVADO", sLabel), Paragraph(f"S/ {subtotal:.2f}", sRight)])
        totals_data.append([Paragraph("I.G.V. 18%", sLabel), Paragraph(f"S/ {igv:.2f}", sRight)])

    totals_data.append([
        Paragraph("TOTAL", ParagraphStyle("totL", parent=sNormal, fontSize=10, fontName="Helvetica-Bold")),
        Paragraph(f"S/ {total:.2f}", sRightBold)
    ])

    totals_table = Table(totals_data, colWidths=[3 * cm, 4 * cm])
    totals_table.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#333333")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 0),
    ]))

    # Right-align the totals block — full avail_w
    outer = Table([[Paragraph("", sNormal), totals_table]], colWidths=[avail_w - 7 * cm, 7 * cm])
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(outer)
    story.append(Spacer(1, 0.6 * cm))

    # ── FOOTER ──────────────────────────────────────────────────────
    footer_data = []
    if boleta.get("usuario_emisor"):
        footer_data.append([Paragraph("USUARIO", sFooterLabel), Paragraph(boleta["usuario_emisor"], sFooterValue)])
    footer_data.append([Paragraph("CONDICION DE PAGO", sFooterLabel), Paragraph("CONTADO", sFooterValue)])
    if emisor.get("pie_pagina"):
        footer_data.append([Paragraph("", sFooterLabel), Paragraph(emisor["pie_pagina"], sSmall)])

    if footer_data:
        footer_table = Table(footer_data, colWidths=[3.5 * cm, avail_w - 3.5 * cm])
        footer_table.setStyle(TableStyle([
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(footer_table)
        story.append(Spacer(1, 0.4 * cm))

    # Disclaimer
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "COMPROBANTE INTERNO - NO VALIDO PARA EFECTOS TRIBUTARIOS",
        sDisclaimer
    ))

    doc.build(story, canvasmaker=canvas_maker)
    buffer.seek(0)
    return buffer.getvalue()
