"""Moderna QR carnet template — blue header + yellow band + square photo."""
import logging
from io import BytesIO
from datetime import datetime, timezone

from .base import BaseQRTemplate

logger = logging.getLogger(__name__)


class ModernaTemplate(BaseQRTemplate):
    template_id = "moderna"
    display_name = "Moderna"
    description = "Header azul con banda amarilla, foto con borde y badge de grado."
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

        school = await db.schools.find_one({"id": school_id}, {"_id": 0, "name": 1, "school_name": 1, "logo_url": 1})
        school_name = (school or {}).get("name") or (school or {}).get("school_name") or "Colegio"

        tenant = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "logo_carnet_url": 1, "logo_url": 1, "watermark_moderna_url": 1})
        logo_url = (tenant or {}).get("logo_carnet_url") or (tenant or {}).get("logo_url") or (school or {}).get("logo_url")

        logo_img = None
        logo_has_alpha = False
        if logo_url:
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                    resp = await client.get(logo_url)
                    if resp.status_code == 200:
                        pil = PILImage.open(BytesIO(resp.content))
                        pil.thumbnail((200, 200))
                        if pil.mode in ('RGBA', 'LA', 'PA'):
                            logo_has_alpha = True
                            logo_img = BytesIO()
                            pil.save(logo_img, format='PNG')
                        else:
                            if pil.mode == 'P':
                                pil = pil.convert('RGB')
                            logo_img = BytesIO()
                            pil.save(logo_img, format='JPEG', quality=75)
                        logo_img.seek(0)
            except Exception as e:
                logger.warning(f"[Moderna] Logo download failed: {e}")

        NAVY = HexColor(color_principal or self.default_color_principal)
        YELLOW = HexColor(color_acento or self.default_color_acento)
        DARK = HexColor("#1a1a2e")
        GRAY = HexColor("#64748b")
        LIGHT_BG = HexColor("#f1f5f9")

        # Pre-fetch watermark (cached for all cards)
        watermark_img = None
        wm_url = (tenant or {}).get("watermark_moderna_url")
        if wm_url:
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                    resp = await client.get(wm_url)
                    if resp.status_code == 200:
                        wm_pil = PILImage.open(BytesIO(resp.content)).convert("RGBA")
                        # Apply 22% opacity
                        alpha = wm_pil.split()[3]
                        alpha = alpha.point(lambda p: int(p * 0.22))
                        wm_pil.putalpha(alpha)
                        watermark_img = BytesIO()
                        wm_pil.save(watermark_img, format="PNG")
                        watermark_img.seek(0)
            except Exception as e:
                logger.warning(f"[Moderna] Watermark download failed: {e}")

        def make_qr(token_data, size=200):
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=2)
            qr.add_data(token_data)
            qr.make(fit=True)
            return qr.make_image(fill_color="black", back_color="white").resize((size, size))

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
            cx = x + card_w / 2

            # Card background
            c.setFillColor(white)
            c.setStrokeColor(HexColor("#d1d5db"))
            c.setLineWidth(0.5)
            c.roundRect(x, y, card_w, card_h, 2 * mm, fill=1, stroke=1)

            # LAYER 1: Blue header rectangle (top 35%)
            header_h = card_h * 0.35
            header_top = y + card_h
            header_bottom = header_top - header_h
            c.setFillColor(NAVY)
            c.rect(x + 0.3, header_bottom, card_w - 0.6, header_h - 0.3, fill=1, stroke=0)

            # LAYER 2: Yellow band (6% height, flush under header)
            band_h = card_h * 0.06
            band_bottom = header_bottom - band_h
            band_center_y = header_bottom - band_h / 2
            c.setFillColor(YELLOW)
            c.rect(x + 0.3, band_bottom, card_w - 0.6, band_h, fill=1, stroke=0)

            # LAYER 2b: Watermark (22% opacity, fills entire white area)
            if watermark_img:
                try:
                    watermark_img.seek(0)
                    wm_reader = ImageReader(watermark_img)
                    wm_x = x + 0.5 * mm
                    wm_y = y + 1 * mm
                    wm_w = card_w - 1 * mm
                    wm_h = band_bottom - y - 1 * mm
                    c.drawImage(wm_reader, wm_x, wm_y, wm_w, wm_h, preserveAspectRatio=False, mask='auto')
                except Exception as wm_err:
                    logger.warning(f"[Moderna] Watermark render failed: {wm_err}")

            # Logo in header (3mm lower)
            logo_s = 9 * mm
            logo_y = header_top - 4.5 * mm - logo_s
            if logo_img:
                try:
                    logo_img.seek(0)
                    mask_mode = 'auto' if logo_has_alpha else None
                    c.drawImage(ImageReader(logo_img), cx - logo_s / 2, logo_y, logo_s, logo_s, preserveAspectRatio=True, mask=mask_mode)
                except Exception:
                    pass

            # School name closer to logo (1.5mm gap instead of 3.5mm)
            c.setFillColor(white)
            c.setFont("Helvetica-Bold", 5.5)
            display_name = school_name if school_name.lower().startswith("colegio") else f"Colegio {school_name}"
            c.drawCentredString(cx, logo_y - 2.9 * mm, display_name[:32])

            # LAYER 3: Photo square (centered ON the yellow band)
            photo_size = card_w * 0.40
            photo_x = cx - photo_size / 2
            photo_y = band_center_y - photo_size / 2

            student_photo_buf = None
            if s.get("photo_url"):
                try:
                    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as pc:
                        resp = await pc.get(s["photo_url"])
                        if resp.status_code == 200:
                            pil_img = PILImage.open(BytesIO(resp.content))
                            if pil_img.mode in ('RGBA', 'P', 'LA'):
                                pil_img = pil_img.convert('RGB')
                            iw, ih = pil_img.size
                            side = min(iw, ih)
                            left = (iw - side) // 2
                            top_ = (ih - side) // 2
                            pil_img = pil_img.crop((left, top_, left + side, top_ + side))
                            pil_img = pil_img.resize((200, 200))
                            student_photo_buf = BytesIO()
                            pil_img.save(student_photo_buf, format='JPEG', quality=75)
                            student_photo_buf.seek(0)
                except Exception:
                    student_photo_buf = None

            if student_photo_buf:
                try:
                    c.drawImage(ImageReader(student_photo_buf), photo_x, photo_y, photo_size, photo_size, preserveAspectRatio=True, mask='auto')
                except Exception:
                    c.setFillColor(LIGHT_BG)
                    c.rect(photo_x, photo_y, photo_size, photo_size, fill=1, stroke=0)
                    c.setFillColor(NAVY)
                    c.setFont("Helvetica-Bold", 16)
                    c.drawCentredString(cx, photo_y + photo_size / 2 - 4, (s.get("name", "?")[:1]).upper())
                finally:
                    try: student_photo_buf.close()
                    except: pass
            else:
                c.setFillColor(LIGHT_BG)
                c.rect(photo_x, photo_y, photo_size, photo_size, fill=1, stroke=0)
                c.setFillColor(NAVY)
                c.setFont("Helvetica-Bold", 16)
                c.drawCentredString(cx, photo_y + photo_size / 2 - 4, (s.get("name", "?")[:1]).upper())

            # Yellow border 3pt
            c.setStrokeColor(YELLOW)
            c.setLineWidth(3)
            c.rect(photo_x, photo_y, photo_size, photo_size, fill=0, stroke=1)

            # Name
            name_y = photo_y - 4 * mm
            c.setFillColor(DARK)
            c.setFont("Helvetica-Bold", 7)
            full_name = f"{s.get('name', '')} {s.get('last_name', '')}".strip()
            if len(full_name) > 24:
                mid = len(full_name) // 2
                split = full_name.rfind(' ', 0, mid + 5)
                if split == -1: split = mid
                c.drawCentredString(cx, name_y, full_name[:split].strip())
                c.drawCentredString(cx, name_y - 3.5 * mm, full_name[split:].strip())
                name_y -= 3.5 * mm
            else:
                c.drawCentredString(cx, name_y, full_name)

            if incluir_codigo and s.get("codigo_alumno"):
                c.setFillColor(GRAY)
                c.setFont("Helvetica", 5)
                c.drawCentredString(cx, name_y - 3.5 * mm, f"Cod: {s['codigo_alumno']}")
                name_y -= 3.5 * mm

            # Badge
            badge_y = name_y - 5 * mm
            badge_text = f"{nivel_name} - {grado_name} - {seccion_name}"
            c.setFont("Helvetica-Bold", 5)
            btw = c.stringWidth(badge_text, "Helvetica-Bold", 5)
            badge_w = btw + 6 * mm
            badge_h = 4 * mm
            c.setFillColor(YELLOW)
            c.roundRect(cx - badge_w / 2, badge_y, badge_w, badge_h, 2 * mm, fill=1, stroke=0)
            c.setFillColor(NAVY)
            c.drawCentredString(cx, badge_y + 1.2 * mm, badge_text)

            # QR
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
            qr_draw_x = cx - qr_size / 2
            qr_draw_y = qr_bottom + (available - qr_size) / 2
            # White background behind QR (covers watermark)
            c.setFillColor(white)
            c.rect(qr_draw_x - 1, qr_draw_y - 1, qr_size + 2, qr_size + 2, fill=1, stroke=0)
            c.drawImage(ImageReader(qr_buf), qr_draw_x, qr_draw_y, qr_size, qr_size)
            del qr_buf

            # Footer
            c.setFillColor(GRAY)
            c.setFont("Helvetica", 3.5)
            c.drawCentredString(cx, footer_y, "Personal e intransferible")

            card_idx += 1

        c.save()
        buf.seek(0)
        if logo_img:
            try: logo_img.close()
            except: pass
        logger.info(f"[Moderna] Generated {card_idx} cards")
        return buf
