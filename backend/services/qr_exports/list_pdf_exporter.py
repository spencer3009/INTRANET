"""Generate a PDF with a table listing students and their QR codes."""
import logging
from io import BytesIO
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader

logger = logging.getLogger(__name__)


async def generate_list_pdf(db, school_id, data, incluir_codigo=False, ordenar=True) -> BytesIO:
    student_filter = {
        "school_id": school_id,
        "role": "student",
        "nivel_id": data.nivel_id,
        "grado_id": data.grado_id,
        "seccion_id": data.seccion_id,
        "qr_token": {"$exists": True, "$ne": None},
    }
    if getattr(data, "turno_id", None):
        student_filter["turno_id"] = data.turno_id

    students = await db.users.find(
        student_filter,
        {"_id": 0, "name": 1, "last_name": 1, "qr_token": 1, "codigo_alumno": 1, "username": 1}
    ).to_list(1000)

    if not students:
        return None

    if ordenar:
        students.sort(key=lambda s: f"{s.get('last_name', '')} {s.get('name', '')}".strip().lower())

    # Lookup names
    nivel = await db.academic_levels.find_one({"id": data.nivel_id}, {"_id": 0, "nombre": 1, "name": 1})
    grado = await db.grados.find_one({"id": data.grado_id}, {"_id": 0, "nombre": 1, "name": 1})
    if not grado:
        grado = await db.grades.find_one({"id": data.grado_id}, {"_id": 0, "nombre": 1, "name": 1})
    seccion = await db.secciones.find_one({"id": data.seccion_id}, {"_id": 0, "nombre": 1, "name": 1})
    if not seccion:
        seccion = await db.sections.find_one({"id": data.seccion_id}, {"_id": 0, "nombre": 1, "name": 1})

    nivel_name = (nivel or {}).get("nombre") or (nivel or {}).get("name") or ""
    grado_name = (grado or {}).get("nombre") or (grado or {}).get("name") or ""
    seccion_name = (seccion or {}).get("nombre") or (seccion or {}).get("name") or ""

    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "name": 1, "school_name": 1})
    school_name = (school or {}).get("name") or (school or {}).get("school_name") or "Colegio"

    # PDF setup
    buf = BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    navy = HexColor("#001f4b")
    gray = HexColor("#64748b")
    light = HexColor("#f8fafc")
    border = HexColor("#e2e8f0")

    margin_x = 25 * mm
    usable_w = w - 2 * margin_x
    row_h = 18 * mm
    qr_size = 14 * mm
    header_h = 20 * mm
    top_y = h - 20 * mm

    def draw_header(page_num):
        # Title bar
        c.setFillColor(navy)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin_x, top_y, school_name)
        c.setFillColor(gray)
        c.setFont("Helvetica", 8)
        c.drawString(margin_x, top_y - 5 * mm, f"{nivel_name} - {grado_name} - Sección {seccion_name}  |  {len(students)} estudiantes")

        # Table header
        th_y = top_y - header_h
        c.setFillColor(light)
        c.rect(margin_x, th_y - 1, usable_w, 7 * mm, fill=1, stroke=0)
        c.setStrokeColor(border)
        c.setLineWidth(0.5)
        c.line(margin_x, th_y - 1, margin_x + usable_w, th_y - 1)

        c.setFillColor(navy)
        c.setFont("Helvetica-Bold", 7)
        col_x = margin_x + 3 * mm
        c.drawString(col_x, th_y + 2 * mm, "#")
        c.drawString(col_x + 10 * mm, th_y + 2 * mm, "Nombre completo")
        if incluir_codigo:
            c.drawString(col_x + 80 * mm, th_y + 2 * mm, "Código")
            c.drawString(col_x + 115 * mm, th_y + 2 * mm, "Grado / Sección")
        else:
            c.drawString(col_x + 90 * mm, th_y + 2 * mm, "Grado / Sección")
        c.drawCentredString(margin_x + usable_w - 10 * mm, th_y + 2 * mm, "QR")
        return th_y - 1

    cursor_y = draw_header(1)
    page = 1

    for idx, s in enumerate(students, 1):
        if cursor_y - row_h < 15 * mm:
            c.showPage()
            page += 1
            cursor_y = draw_header(page)

        row_top = cursor_y
        row_bottom = row_top - row_h

        # Alternate row bg
        if idx % 2 == 0:
            c.setFillColor(HexColor("#f8fafc"))
            c.rect(margin_x, row_bottom, usable_w, row_h, fill=1, stroke=0)

        # Row border
        c.setStrokeColor(border)
        c.setLineWidth(0.3)
        c.line(margin_x, row_bottom, margin_x + usable_w, row_bottom)

        col_x = margin_x + 3 * mm
        text_y = row_bottom + (row_h - 4 * mm) / 2

        # Number
        c.setFillColor(gray)
        c.setFont("Helvetica", 7)
        c.drawString(col_x, text_y, str(idx))

        # Name
        full_name = f"{s.get('last_name', '')} {s.get('name', '')}".strip()
        c.setFillColor(navy)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(col_x + 10 * mm, text_y, full_name[:40])

        # Code + Grade
        curso = f"{grado_name} - {seccion_name}"
        c.setFillColor(gray)
        c.setFont("Helvetica", 7)
        if incluir_codigo:
            c.drawString(col_x + 80 * mm, text_y, s.get("codigo_alumno", "-"))
            c.drawString(col_x + 115 * mm, text_y, curso)
        else:
            c.drawString(col_x + 90 * mm, text_y, curso)

        # QR
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=8, border=1)
        qr.add_data(s["qr_token"])
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_buf = BytesIO()
        qr_img.save(qr_buf, format="PNG")
        qr_buf.seek(0)
        qr_x = margin_x + usable_w - 10 * mm - qr_size / 2
        qr_y = row_bottom + (row_h - qr_size) / 2
        c.drawImage(ImageReader(qr_buf), qr_x, qr_y, qr_size, qr_size)

        cursor_y = row_bottom

    c.save()
    buf.seek(0)
    logger.info(f"[List PDF] Generated {page} pages for {len(students)} students")
    return buf
