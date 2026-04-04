"""
OMR Sheet PDF Generator using ReportLab.
Generates a printable bubble-sheet for OMR exams with alignment markers,
QR code, bubble grid, and returns a coordinate map for future scanning.
"""
import io
import json
import math
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import black, white, Color

# Page constants
PAGE_W, PAGE_H = A4  # 210mm x 297mm in points
MARGIN = 15 * mm

# Alignment marker constants
MARKER_SIZE = 8 * mm
MARKER_OFFSET = 10 * mm  # from page edge

# Bubble constants
BUBBLE_DIAMETER = 5 * mm
BUBBLE_RADIUS = BUBBLE_DIAMETER / 2
BUBBLE_H_SPACING = 9 * mm  # center-to-center horizontal
BUBBLE_V_SPACING = 9 * mm  # center-to-center vertical
Q_NUM_WIDTH = 10 * mm      # width for question number label
COL_GAP = 20 * mm          # gap between columns

GRAY = Color(0.5, 0.5, 0.5)
LIGHT_GRAY = Color(0.75, 0.75, 0.75)


def _draw_alignment_markers(c):
    """Draw 4 solid black squares at fixed positions from page edges."""
    positions = [
        (MARKER_OFFSET, PAGE_H - MARKER_OFFSET - MARKER_SIZE),           # top-left
        (PAGE_W - MARKER_OFFSET - MARKER_SIZE, PAGE_H - MARKER_OFFSET - MARKER_SIZE),  # top-right
        (MARKER_OFFSET, MARKER_OFFSET),                                    # bottom-left
        (PAGE_W - MARKER_OFFSET - MARKER_SIZE, MARKER_OFFSET),            # bottom-right
    ]
    c.setFillColor(black)
    c.setStrokeColor(black)
    for x, y in positions:
        c.rect(x, y, MARKER_SIZE, MARKER_SIZE, fill=1, stroke=0)


def _draw_qr(c, exam_data):
    """Draw QR code centred horizontally at y=18mm from top."""
    qr_size = 25 * mm
    qr_y_from_top = 18 * mm

    qr_content = json.dumps({
        "exam_id": exam_data["id"],
        "num_questions": exam_data["num_questions"],
        "options": exam_data["options_per_question"],
    })

    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=1)
    qr.add_data(qr_content)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    buf = io.BytesIO()
    qr_img.save(buf, format="PNG")
    buf.seek(0)

    from reportlab.lib.utils import ImageReader
    img_reader = ImageReader(buf)
    x = (PAGE_W - qr_size) / 2
    y = PAGE_H - qr_y_from_top - qr_size
    c.drawImage(img_reader, x, y, width=qr_size, height=qr_size)

    # Small ID text below QR
    c.setFont("Helvetica", 6)
    c.setFillColor(GRAY)
    short_id = exam_data["id"][:8]
    c.drawCentredString(PAGE_W / 2, y - 3 * mm, f"ID: {short_id}")
    c.setFillColor(black)


def _draw_header(c):
    """Draw name/date/section fields at y=47mm from top."""
    y_from_top = 47 * mm
    y = PAGE_H - y_from_top
    left = MARGIN

    c.setFont("Helvetica", 11)
    c.setStrokeColor(black)
    c.setLineWidth(0.5)

    # Nombre line
    c.drawString(left, y, "Nombre:")
    line_start = left + c.stringWidth("Nombre:  ", "Helvetica", 11)
    c.line(line_start, y - 1, left + 140 * mm, y - 1)

    # Fecha + Seccion
    y2 = y - 14 * mm
    c.drawString(left, y2, "Fecha:")
    line_start_f = left + c.stringWidth("Fecha:  ", "Helvetica", 11)
    c.line(line_start_f, y2 - 1, left + 60 * mm, y2 - 1)

    c.drawString(left + 70 * mm, y2, "Seccion:")
    line_start_s = left + 70 * mm + c.stringWidth("Seccion:  ", "Helvetica", 11)
    c.line(line_start_s, y2 - 1, left + 140 * mm, y2 - 1)


def _draw_title(c, title):
    """Draw exam title centered at y=62mm from top."""
    y_from_top = 62 * mm
    y = PAGE_H - y_from_top
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(PAGE_W / 2, y, title)


def _draw_footer(c):
    """Draw footer at y=285mm from top."""
    y_from_top = 285 * mm
    y = PAGE_H - y_from_top
    c.setFont("Helvetica", 7)
    c.setFillColor(GRAY)
    c.drawCentredString(PAGE_W / 2, y, "EduNet - Sistema de Evaluacion OMR")
    c.setFillColor(black)


def _compute_layout(num_questions, options_per_question):
    """
    Determine column layout and compute the width of a single column.
    Returns (num_cols, questions_per_col, col_width_pt).
    col_width = Q_NUM_WIDTH + options_per_question * BUBBLE_H_SPACING
    """
    if num_questions <= 30:
        num_cols = 2
    elif num_questions <= 60:
        num_cols = 2
    else:
        num_cols = 3

    questions_per_col = math.ceil(num_questions / num_cols)
    col_content_width = Q_NUM_WIDTH + options_per_question * BUBBLE_H_SPACING
    return num_cols, questions_per_col, col_content_width


def _draw_bubble_grid(c, num_questions, options_per_question):
    """
    Draw the bubble grid and return the bubble_map dict (coords in mm).
    Grid starts at y=72mm from top.
    """
    grid_y_from_top = 72 * mm
    grid_top_y = PAGE_H - grid_y_from_top  # ReportLab y (bottom-up)

    num_cols, q_per_col, col_content_w = _compute_layout(num_questions, options_per_question)

    # Total width of all columns + gaps
    total_width = num_cols * col_content_w + (num_cols - 1) * COL_GAP
    usable_w = PAGE_W - 2 * MARGIN
    start_x = MARGIN + (usable_w - total_width) / 2

    letters = [chr(65 + i) for i in range(options_per_question)]

    bubble_map = {}
    header_height = 10 * mm  # space for column option headers

    for col_idx in range(num_cols):
        col_x = start_x + col_idx * (col_content_w + COL_GAP)

        # Draw column option headers (A B C D E)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(GRAY)
        for li, letter in enumerate(letters):
            bx = col_x + Q_NUM_WIDTH + li * BUBBLE_H_SPACING + BUBBLE_H_SPACING / 2
            by = grid_top_y - header_height / 2
            c.drawCentredString(bx, by + 1, letter)
        c.setFillColor(black)

        # Draw questions in this column
        first_q = col_idx * q_per_col  # 0-indexed
        last_q = min(first_q + q_per_col, num_questions)

        for i, q_idx in enumerate(range(first_q, last_q)):
            q_num = q_idx + 1
            row_center_y = grid_top_y - header_height - i * BUBBLE_V_SPACING - BUBBLE_V_SPACING / 2

            # Question number
            c.setFont("Helvetica-Bold", 9)
            c.drawRightString(col_x + Q_NUM_WIDTH - 2 * mm, row_center_y - 3, f"{q_num}.")

            # Bubbles
            c.setLineWidth(0.6)
            c.setFont("Helvetica", 7)
            q_bubbles = {}
            for li, letter in enumerate(letters):
                bx = col_x + Q_NUM_WIDTH + li * BUBBLE_H_SPACING + BUBBLE_H_SPACING / 2
                by = row_center_y

                # Draw circle
                c.setStrokeColor(black)
                c.setFillColor(white)
                c.circle(bx, by, BUBBLE_RADIUS, fill=1, stroke=1)

                # Draw letter inside
                c.setFillColor(LIGHT_GRAY)
                c.drawCentredString(bx, by - 2.5, letter)
                c.setFillColor(black)

                # Store position in mm from top-left of page
                x_mm = round(bx / mm, 2)
                y_mm = round((PAGE_H - by) / mm, 2)
                q_bubbles[letter] = {"x": x_mm, "y": y_mm}

            bubble_map[str(q_num)] = q_bubbles

    return bubble_map


def generate_omr_sheet(exam_data: dict) -> tuple:
    """
    Generate the OMR answer sheet PDF.

    Args:
        exam_data: dict with keys id, title, num_questions, options_per_question

    Returns:
        (pdf_bytes, bubble_map)
    """
    num_questions = exam_data.get("num_questions", 20)
    options_per_question = exam_data.get("options_per_question", 5)
    title = exam_data.get("title", "Examen OMR")

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"OMR - {title}")

    # 1. Alignment markers
    _draw_alignment_markers(c)

    # 2. QR code
    _draw_qr(c, exam_data)

    # 3. Header fields
    _draw_header(c)

    # 4. Title
    _draw_title(c, title)

    # 5. Bubble grid
    bubble_map_bubbles = _draw_bubble_grid(c, num_questions, options_per_question)

    # 6. Footer
    _draw_footer(c)

    c.showPage()
    c.save()

    pdf_bytes = buf.getvalue()

    bubble_map = {
        "page_width_mm": 210,
        "page_height_mm": 297,
        "markers": {
            "top_left": {"x": 10, "y": 10, "size": 8},
            "top_right": {"x": 192, "y": 10, "size": 8},
            "bottom_left": {"x": 10, "y": 279, "size": 8},
            "bottom_right": {"x": 192, "y": 279, "size": 8},
        },
        "bubbles": bubble_map_bubbles,
    }

    return pdf_bytes, bubble_map
