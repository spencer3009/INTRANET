"""Moderna QR carnet template — blue header with yellow decorative curve."""
import logging
import math
from io import BytesIO
from datetime import datetime, timezone

from .base import BaseQRTemplate

logger = logging.getLogger(__name__)


class ModernaTemplate(BaseQRTemplate):
    template_id = "moderna"
    display_name = "Moderna"
    description = "Header azul con curva amarilla, foto con borde y badge de grado."
    supports_custom_colors = True
    default_color_principal = "#1e3a5f"
    default_color_acento = "#F5B800"

    async def generate_pdf(self, db, school_id, data, user, limit=None,
                           color_principal: str = None, color_acento: str = None) -> BytesIO:
        import qrcode
        import httpx
        from PIL import Image as PILImage
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas as pdf_canvas
        from reportlab.lib.utils import ImageReader
        from reportlab.lib.colors import HexColor, white

        def _get(key, default=None):
            return data.get(key, default) if isinstance(data, dict) else getattr(data, key, default)

        # ── Fetch students ───────────────────────────────────────────
        student_filter = {
            "school_id": school_id, "role": "student",
            "nivel_id": _get("nivel_id"), "grado_id": _get("grado_id"),
            "seccion_id": _get("seccion_id"),
            "qr_token": {"$exists": True, "$ne": None},
        }
        if _get("turno_id"):
            student_filter["turno_id"] = _get("turno_id")

        students = await db.users.find(
            student_filter,
            {"_id": 0, "name": 1, "last_name": 1, "qr_token": 1, "codigo_alumno": 1, "username": 1, "photo_url": 1}
        ).to_list(1000)

        if not students:
            return None

        if _get("ordenar_alfabetico", True):
            students.sort(key=lambda s: f"{s.get('last_name', '')} {s.get('name', '')}".strip().lower())

        if limit:
            students = students[:limit]

        incluir_codigo = _get("incluir_codigo_alumno", False)

        # ── Lookup names ─────────────────────────────────────────────
        nivel = await db.academic_levels.find_one({"id": _get("nivel_id")}, {"_id": 0, "nombre": 1, "name": 1})
        grado = await db.grados.find_one({"id": _get("grado_id")}, {"_id": 0, "nombre": 1, "name": 1})
        if not grado:
            grado = await db.grades.find_one({"id": _get("grado_id")}, {"_id": 0, "nombre": 1, "name": 1})
        seccion = await db.secciones.find_one({"id": _get("seccion_id")}, {"_id": 0, "nombre": 1, "name": 1})
        if not seccion:
            seccion = await db.sections.find_one({"id": _get("seccion_id")}, {"_id": 0, "nombre": 1, "name": 1})

        nivel_name = (nivel or {}).get("nombre") or (nivel or {}).get("name") or ""
        grado_name = (grado or {}).get("nombre") or (grado or {}).get("name") or ""
        seccion_name = (seccion or {}).get("nombre") or (seccion or {}).get("name") or ""

        # ── School info + logos ──────────────────────────────────────
        school = await db.schools.find_one({"id": school_id}, {"_id": 0, "name": 1, "school_name": 1, "logo_url": 1})
        school_name = (school or {}).get("name") or (school or {}).get("school_name") or "Colegio"

        # Prefer logo_carnet_url, fallback to school logo
        tenant = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "logo_carnet_url": 1, "logo_url": 1})
        logo_url = (tenant or {}).get("logo_carnet_url") or (tenant or {}).get("logo_url") or (school or {}).get("logo_url")

        logo_img = None
        if logo_url:
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                    resp = await client.get(logo_url)
                    if resp.status_code == 200:
                        pil = PILImage.open(BytesIO(resp.content))
                        if pil.mode in ('RGBA', 'P', 'LA'):
                            pil = pil.convert('RGB')
                        pil.thumbnail((200, 200))
                        logo_img = BytesIO()
                        pil.save(logo_img, format='JPEG', quality=75)
                        logo_img.seek(0)
            except Exception as e:
                logger.warning(f"[Moderna] Logo download failed: {e}")

        # ── Colors (use params or defaults) ────────────────────────
        NAVY = HexColor(color_principal or self.default_color_principal)
        YELLOW = HexColor(color_acento or self.default_color_acento)
        DARK = HexColor("#1a1a2e")
        GRAY = HexColor("#64748b")
        LIGHT_BG = HexColor("#f1f5f9")

        def make_qr(token_data, size=200):
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=2)
            qr.add_data(token_data)
            qr.make(fit=True)
            return qr.make_image(fill_color="black", back_color="white").resize((size, size))

        # ── PDF setup ────────────────────────────────────────────────
        buf = BytesIO()
        c = pdf_canvas.Canvas(buf, pagesize=A4)
        w, h = A4

        cols, rows = 3, 3
        card_w = 60 * mm
        card_h = 88 * mm
        margin_x = (w - cols * card_w) / (cols + 1)
        margin_y = (h - rows * card_h) / (rows + 1)

        card_idx = 0
        for s in students:
            if not s.get("qr_token"):
                continue
            if card_idx > 0 and card_idx % (cols * rows) == 0:
                c.showPage()

            pos = card_idx % (cols * rows)
            col_pos = pos % cols
            row_pos = pos // cols
            x = margin_x + col_pos * (card_w + margin_x)
            y = h - margin_y - (row_pos + 1) * card_h - row_pos * margin_y

            # ── Card background ──────────────────────────────────────
            c.setFillColor(white)
            c.setStrokeColor(HexColor("#d1d5db"))
            c.setLineWidth(0.5)
            c.roundRect(x, y, card_w, card_h, 2 * mm, fill=1, stroke=1)

            # ── Blue header (top ~38%) ───────────────────────────────
            header_h = card_h * 0.38
            header_top = y + card_h
            header_bottom = header_top - header_h

            c.saveState()
            path = c.beginPath()
            path.moveTo(x, header_top)
            path.lineTo(x + card_w, header_top)
            path.lineTo(x + card_w, header_bottom)
            path.lineTo(x, header_bottom)
            path.close()
            c.clipPath(path, stroke=0)
            c.setFillColor(NAVY)
            c.rect(x, header_bottom, card_w, header_h, fill=1, stroke=0)
            c.restoreState()

            # ── Yellow decorative wave (inverted smile shape) ────────
            # Wide wave: high at edges, dips down in center (panza abajo)
            wave_top = header_bottom + 4 * mm      # top of wave at edges
            wave_bottom = header_bottom - 6 * mm    # bottom of wave dip at center
            wave_fill_top = header_bottom + 5 * mm  # fill extends above wave top

            p = c.beginPath()
            p.moveTo(x, wave_fill_top)                          # start top-left
            p.lineTo(x, wave_top)                               # left edge high point
            p.curveTo(                                          # curve down to center
                x + card_w * 0.3, wave_bottom,                  # cp1: left third, dips low
                x + card_w * 0.7, wave_bottom,                  # cp2: right third, dips low
                x + card_w, wave_top                            # end: right edge high
            )
            p.lineTo(x + card_w, wave_fill_top)                 # up to fill area
            p.close()
            c.setFillColor(YELLOW)
            c.drawPath(p, fill=1, stroke=0)

            # ── Logo in header ───────────────────────────────────────
            logo_size = 9 * mm
            if logo_img:
                try:
                    logo_img.seek(0)
                    c.drawImage(ImageReader(logo_img), x + (card_w - logo_size) / 2, header_top - 2 * mm - logo_size, logo_size, logo_size, preserveAspectRatio=True, mask='auto')
                except Exception:
                    pass

            # ── School name in header ────────────────────────────────
            c.setFillColor(white)
            c.setFont("Helvetica-Bold", 5.5)
            display_name = school_name if school_name.lower().startswith("colegio") else f"Colegio {school_name}"
            name_trunc = display_name[:32]
            tw = c.stringWidth(name_trunc, "Helvetica-Bold", 5.5)
            c.drawString(x + (card_w - tw) / 2, header_top - 2 * mm - logo_size - 4 * mm, name_trunc)

            # ── Student photo (vertical rectangle, overlapping wave) ─
            # 3:4 ratio, ~40% of card width, positioned 40% in blue / 60% in white
            photo_w = card_w * 0.40
            photo_h = photo_w * 1.3
            photo_x = x + (card_w - photo_w) / 2
            photo_y = header_bottom - photo_h * 0.55  # 45% in header, 55% below

            student_photo_buf = None
            photo_url_val = s.get("photo_url")
            if photo_url_val:
                try:
                    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as pc:
                        resp = await pc.get(photo_url_val)
                        if resp.status_code == 200:
                            pil_img = PILImage.open(BytesIO(resp.content))
                            if pil_img.mode in ('RGBA', 'P', 'LA'):
                                pil_img = pil_img.convert('RGB')
                            pil_img.thumbnail((200, 300))
                            student_photo_buf = BytesIO()
                            pil_img.save(student_photo_buf, format='JPEG', quality=75)
                            student_photo_buf.seek(0)
                except Exception:
                    student_photo_buf = None

            # Photo background + image or initial
            if student_photo_buf:
                try:
                    c.drawImage(ImageReader(student_photo_buf), photo_x, photo_y, photo_w, photo_h, preserveAspectRatio=True, mask='auto')
                except Exception:
                    c.setFillColor(LIGHT_BG)
                    c.rect(photo_x, photo_y, photo_w, photo_h, fill=1, stroke=0)
                    c.setFillColor(NAVY)
                    c.setFont("Helvetica-Bold", 16)
                    c.drawCentredString(photo_x + photo_w / 2, photo_y + photo_h / 2 - 4, (s.get("name", "?")[:1]).upper())
            else:
                c.setFillColor(LIGHT_BG)
                c.rect(photo_x, photo_y, photo_w, photo_h, fill=1, stroke=0)
                c.setFillColor(NAVY)
                c.setFont("Helvetica-Bold", 16)
                c.drawCentredString(photo_x + photo_w / 2, photo_y + photo_h / 2 - 4, (s.get("name", "?")[:1]).upper())

            # Yellow thick border around photo (drawn OVER the photo)
            c.setStrokeColor(YELLOW)
            c.setLineWidth(3)
            c.rect(photo_x, photo_y, photo_w, photo_h, fill=0, stroke=1)

            if student_photo_buf:
                try:
                    student_photo_buf.close()
                except Exception:
                    pass

            # ── Student name ─────────────────────────────────────────
            name_y = photo_y - 4 * mm
            c.setFillColor(DARK)
            c.setFont("Helvetica-Bold", 7)
            full_name = f"{s.get('name', '')} {s.get('last_name', '')}".strip()
            if len(full_name) > 24:
                # Split into 2 lines
                mid = len(full_name) // 2
                split = full_name.rfind(' ', 0, mid + 5)
                if split == -1:
                    split = mid
                line1 = full_name[:split].strip()
                line2 = full_name[split:].strip()
                tw1 = c.stringWidth(line1, "Helvetica-Bold", 7)
                tw2 = c.stringWidth(line2, "Helvetica-Bold", 7)
                c.drawString(x + (card_w - tw1) / 2, name_y, line1)
                c.drawString(x + (card_w - tw2) / 2, name_y - 3.5 * mm, line2)
                name_y -= 3.5 * mm
            else:
                tw = c.stringWidth(full_name, "Helvetica-Bold", 7)
                c.drawString(x + (card_w - tw) / 2, name_y, full_name)

            # ── Student code (optional) ──────────────────────────────
            if incluir_codigo and s.get("codigo_alumno"):
                c.setFillColor(GRAY)
                c.setFont("Helvetica", 5)
                code_str = f"Cod: {s['codigo_alumno']}"
                twc = c.stringWidth(code_str, "Helvetica", 5)
                c.drawString(x + (card_w - twc) / 2, name_y - 3.5 * mm, code_str)
                name_y -= 3.5 * mm

            # ── Badge: grado/sección ─────────────────────────────────
            badge_y = name_y - 5 * mm
            badge_text = f"{nivel_name} - {grado_name} - {seccion_name}"
            c.setFont("Helvetica-Bold", 5)
            btw = c.stringWidth(badge_text, "Helvetica-Bold", 5)
            badge_w = btw + 6 * mm
            badge_h = 4 * mm
            badge_x = x + (card_w - badge_w) / 2

            c.setFillColor(YELLOW)
            c.roundRect(badge_x, badge_y, badge_w, badge_h, 2 * mm, fill=1, stroke=0)
            c.setFillColor(NAVY)
            c.drawString(badge_x + 3 * mm, badge_y + 1.2 * mm, badge_text)

            # ── QR ───────────────────────────────────────────────────
            footer_y = y + 2 * mm
            qr_top = badge_y - 2 * mm
            qr_bottom = footer_y + 3 * mm
            available = qr_top - qr_bottom
            qr_size = min(available, 24 * mm)
            qr_size = max(qr_size, 14 * mm)

            qr_img = make_qr(s["qr_token"], 250)
            qr_buf = BytesIO()
            qr_img.save(qr_buf, format="PNG")
            qr_buf.seek(0)
            c.drawImage(ImageReader(qr_buf), x + (card_w - qr_size) / 2, qr_bottom + (available - qr_size) / 2, qr_size, qr_size)
            del qr_buf

            # ── Footer ───────────────────────────────────────────────
            c.setFillColor(GRAY)
            c.setFont("Helvetica", 3.5)
            c.drawCentredString(x + card_w / 2, footer_y, "Personal e intransferible")

            card_idx += 1

        c.save()
        buf.seek(0)
        if logo_img:
            try:
                logo_img.close()
            except Exception:
                pass
        logger.info(f"[Moderna] Generated {card_idx} cards")
        return buf
