"""Classic QR carnet template — monolithic copy of _do_student_qr_bulk from attendance.py.

This is an intentional full copy of the PDF generation logic. Do NOT refactor
to share code with attendance.py until a second template exists.
"""
import logging
from io import BytesIO
from datetime import datetime, timezone

from .base import BaseQRTemplate

logger = logging.getLogger(__name__)


class ClassicTemplate(BaseQRTemplate):
    template_id = "classic"
    display_name = "Clásica"
    description = "Carnet estándar con logo, foto, nombre, grado/sección y QR."

    async def generate_pdf(self, db, school_id, data, user, limit=None,
                           color_principal: str = None, color_acento: str = None) -> BytesIO:
        """Generate PDF with QR cards for students (3x3 grid per page).

        ``data`` must have: nivel_id, grado_id, seccion_id and optionally
        turno_id, formato, incluir_codigo_alumno, incluir_foto, ordenar_alfabetico.
        ``limit``: if set, only render that many students (used for preview).
        Returns a BytesIO buffer with the finished PDF.
        """
        import qrcode
        import httpx
        from PIL import Image as PILImage
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas as pdf_canvas
        from reportlab.lib.utils import ImageReader
        from reportlab.lib.colors import HexColor

        logger.info(f"[QR Template Classic] === Starting for school {school_id} ===")

        # ── Phase 1: Fetch users ───────────────────────────────────
        # Support both dict and Pydantic model
        def _get(key, default=None):
            if isinstance(data, dict):
                return data.get(key, default)
            return getattr(data, key, default)

        target_role = _get("role", "student")
        # Any non-student role is treated as "staff" → no academic filters,
        # just the role itself. Supports teacher / personal_mantenimiento /
        # auxiliar_* roles uniformly.
        is_staff = target_role != "student"
        if is_staff:
            student_filter = {
                "school_id": school_id,
                "role": target_role,
                "qr_token": {"$exists": True, "$ne": None},
            }
        else:
            student_filter = {
                "school_id": school_id,
                "role": "student",
                "nivel_id": _get("nivel_id"),
                "grado_id": _get("grado_id"),
                "seccion_id": _get("seccion_id"),
            }
            turno_id = _get("turno_id")
            if turno_id:
                student_filter["turno_id"] = turno_id

        students = await db.users.find(
            student_filter,
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "qr_token": 1,
             "codigo_alumno": 1, "username": 1, "photo_url": 1}
        ).to_list(1000)

        logger.info(f"[QR Template Classic] Found {len(students)} students")

        if not students:
            return None  # caller handles 404

        ordenar = _get("ordenar_alfabetico", True)
        if ordenar:
            students.sort(key=lambda s: f"{s.get('last_name', '')} {s.get('name', '')}".strip().lower())

        if limit:
            students = students[:limit]

        # ── Lookup grade/section names ───────────────────────────────
        nivel_id = _get("nivel_id")
        grado_id = _get("grado_id")
        seccion_id = _get("seccion_id")

        nivel = await db.academic_levels.find_one({"id": nivel_id}, {"_id": 0, "nombre": 1, "name": 1})
        grado = await db.grados.find_one({"id": grado_id}, {"_id": 0, "nombre": 1, "name": 1})
        if not grado:
            grado = await db.grades.find_one({"id": grado_id}, {"_id": 0, "nombre": 1, "name": 1})
        seccion = await db.secciones.find_one({"id": seccion_id}, {"_id": 0, "nombre": 1, "name": 1})
        if not seccion:
            seccion = await db.sections.find_one({"id": seccion_id}, {"_id": 0, "nombre": 1, "name": 1})

        nivel_name = (nivel or {}).get("nombre") or (nivel or {}).get("name") or "nivel"
        grado_name = (grado or {}).get("nombre") or (grado or {}).get("name") or "grado"
        seccion_name = (seccion or {}).get("nombre") or (seccion or {}).get("name") or "seccion"

        incluir_codigo = _get("incluir_codigo_alumno", False)
        incluir_foto = _get("incluir_foto", True)

        def student_label(s):
            full = f"{s.get('last_name', '')} {s.get('name', '')}".strip()
            if incluir_codigo and s.get("codigo_alumno"):
                full += f" ({s['codigo_alumno']})"
            return full or s.get("username", "Alumno")

        def make_qr_image(token_data: str, size: int = 200):
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=2)
            qr.add_data(token_data)
            qr.make(fit=True)
            return qr.make_image(fill_color="black", back_color="white").resize((size, size))

        # ── School info ──────────────────────────────────────────────
        school = await db.schools.find_one(
            {"id": school_id},
            {"_id": 0, "name": 1, "school_name": 1, "nombre": 1, "logo_url": 1, "subdomain": 1}
        )
        school_name = (school or {}).get("name") or (school or {}).get("school_name") or (school or {}).get("nombre") or "Colegio"
        school_logo_url = (school or {}).get("logo_url")
        curso_label = f"{grado_name} - {seccion_name}"

        # ── Pre-fetch school logo ────────────────────────────────────
        logo_img = None
        if school_logo_url:
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                    resp = await client.get(school_logo_url)
                    if resp.status_code == 200:
                        pil_logo = PILImage.open(BytesIO(resp.content))
                        if pil_logo.mode in ('RGBA', 'P', 'LA'):
                            pil_logo = pil_logo.convert('RGB')
                        pil_logo.thumbnail((200, 200))
                        logo_img = BytesIO()
                        pil_logo.save(logo_img, format='JPEG', quality=75)
                        logo_img.seek(0)
                        del pil_logo
            except Exception as e:
                logger.warning(f"[QR Template Classic] Logo download failed: {e}")

        # ── PDF generation ────────────────────────────────────────
        buf = BytesIO()
        c = pdf_canvas.Canvas(buf, pagesize=A4)
        w, h = A4

        # When rendering a single card (preview), scale it up and center
        is_preview = limit == 1
        if is_preview:
            cols, rows = 1, 1
            card_w = 80 * mm
            card_h = 117 * mm
            margin_x = (w - card_w) / 2
            margin_y = (h - card_h) / 2
        else:
            cols, rows = 3, 3
            card_w = 60 * mm
            card_h = 88 * mm
            margin_x = (w - cols * card_w) / (cols + 1)
            margin_y = (h - rows * card_h) / (rows + 1)

        navy = HexColor("#001f4b")
        teal = HexColor("#94a3b8")
        gray = HexColor("#64748b")
        light_bg = HexColor("#f1f5f9")
        border_color = HexColor("#d1d5db")

        total_students = len([s for s in students if s.get("qr_token")])
        card_idx = 0

        for s in students:
            if not s.get("qr_token"):
                continue
            if card_idx > 0 and card_idx % (cols * rows) == 0:
                c.showPage()

            pos = card_idx % (cols * rows)
            col_pos = pos % cols
            row_pos = pos // cols
            if is_preview:
                x = margin_x
                y = margin_y
            else:
                x = margin_x + col_pos * (card_w + margin_x)
                y = h - margin_y - (row_pos + 1) * card_h - row_pos * margin_y

            # Scale factor for preview (larger card)
            sf = card_w / (60 * mm)

            # Card border
            c.setFillColor(HexColor("#ffffff"))
            c.setStrokeColor(border_color)
            c.setLineWidth(0.5)
            c.roundRect(x, y, card_w, card_h, 2 * mm, fill=1, stroke=1)

            # Top bar
            c.setFillColor(teal)
            c.rect(x + 0.5, y + card_h - 4 * sf * mm, card_w - 1, 4 * sf * mm, fill=1, stroke=0)

            # Logo + School name header
            logo_y = y + card_h - 19 * sf * mm
            if logo_img:
                try:
                    logo_img.seek(0)
                    logo_s = 10 * sf * mm
                    c.drawImage(ImageReader(logo_img), x + (card_w - logo_s) / 2, logo_y + 2 * sf * mm, logo_s, logo_s, preserveAspectRatio=True, mask='auto')
                except Exception:
                    pass

            c.setFillColor(navy)
            c.setFont("Helvetica-Bold", 6 * sf)
            display_name = school_name if school_name.lower().startswith("colegio") else f"Colegio {school_name}"
            name_trunc = display_name[:30]
            tw = c.stringWidth(name_trunc, "Helvetica-Bold", 6 * sf)
            c.drawString(x + (card_w - tw) / 2, logo_y - 2 * sf * mm, name_trunc)

            # Divider
            c.setStrokeColor(HexColor("#e2e8f0"))
            c.setLineWidth(0.4)
            c.line(x + 4 * sf * mm, logo_y - 4 * sf * mm, x + card_w - 4 * sf * mm, logo_y - 4 * sf * mm)

            # Student photo
            if incluir_foto:
                photo_size = 20 * sf * mm
                photo_x = x + (card_w - photo_size) / 2
                photo_y = logo_y - 5 * sf * mm - photo_size
                student_photo_buf = None
                photo_url = s.get("photo_url")
                if photo_url:
                    try:
                        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as photo_client:
                            resp = await photo_client.get(photo_url)
                            if resp.status_code == 200:
                                pil_img = PILImage.open(BytesIO(resp.content))
                                if pil_img.mode in ('RGBA', 'P', 'LA'):
                                    pil_img = pil_img.convert('RGB')
                                pil_img.thumbnail((200, 200))
                                student_photo_buf = BytesIO()
                                pil_img.save(student_photo_buf, format='JPEG', quality=75)
                                student_photo_buf.seek(0)
                                del pil_img
                    except Exception as photo_err:
                        logger.warning(f"[QR Template Classic] Photo failed for {s.get('id')}: {photo_err}")
                        student_photo_buf = None

                if student_photo_buf:
                    try:
                        c.saveState()
                        path = c.beginPath()
                        cx_p = photo_x + photo_size / 2
                        cy_p = photo_y + photo_size / 2
                        path.circle(cx_p, cy_p, photo_size / 2)
                        path.close()
                        c.clipPath(path, stroke=0)
                        c.drawImage(ImageReader(student_photo_buf), photo_x, photo_y, photo_size, photo_size, preserveAspectRatio=True, mask='auto')
                        c.restoreState()
                        c.setStrokeColor(HexColor("#cbd5e1"))
                        c.setLineWidth(0.8)
                        c.circle(cx_p, cy_p, photo_size / 2, fill=0, stroke=1)
                    except Exception:
                        try:
                            c.restoreState()
                        except Exception:
                            pass
                        c.setFillColor(light_bg)
                        c.circle(photo_x + photo_size / 2, photo_y + photo_size / 2, photo_size / 2, fill=1, stroke=0)
                        c.setFillColor(navy)
                        c.setFont("Helvetica-Bold", 16 * sf)
                        c.drawCentredString(photo_x + photo_size / 2, photo_y + photo_size / 2 - 3 * sf, (s.get("name", "?")[:1]).upper())
                else:
                    c.setFillColor(light_bg)
                    c.circle(photo_x + photo_size / 2, photo_y + photo_size / 2, photo_size / 2, fill=1, stroke=0)
                    c.setFillColor(navy)
                    c.setFont("Helvetica-Bold", 16 * sf)
                    c.drawCentredString(photo_x + photo_size / 2, photo_y + photo_size / 2 - 3 * sf, (s.get("name", "?")[:1]).upper())
                content_top = photo_y - 4 * sf * mm

                if student_photo_buf:
                    try:
                        student_photo_buf.close()
                    except Exception:
                        pass
                    del student_photo_buf
            else:
                content_top = logo_y - 8 * sf * mm

            # Student name
            info_y = content_top
            c.setFillColor(navy)
            c.setFont("Helvetica-Bold", 7 * sf)
            full_name = f"{s.get('name', '')} {s.get('last_name', '')}".strip()
            if not is_preview and len(full_name) > 22:
                full_name = full_name[:21] + "."
            tw = c.stringWidth(full_name, "Helvetica-Bold", 7 * sf)
            c.drawString(x + (card_w - tw) / 2, info_y, full_name)

            # Student code (optional)
            code_offset = 0
            if incluir_codigo and s.get("codigo_alumno"):
                c.setFillColor(gray)
                c.setFont("Helvetica", 5 * sf)
                code_str = f"Cod: {s['codigo_alumno']}"
                tw_code = c.stringWidth(code_str, "Helvetica", 5 * sf)
                c.drawString(x + (card_w - tw_code) / 2, info_y - 3.5 * sf * mm, code_str)
                code_offset = 3.5 * sf * mm

            # Level - Grade - Section
            c.setFillColor(gray)
            c.setFont("Helvetica", 5.5 * sf)
            if is_staff:
                # Map role → human label. Fallback to "Personal" so we never
                # show "Docente" for an auxiliar.
                _STAFF_LABELS = {
                    "teacher": "Docente",
                    "personal_mantenimiento": "Personal de Mantenimiento",
                    "auxiliar": "Auxiliar",
                    "auxiliar_asistencia": "Auxiliar de Asistencia",
                    "auxiliar_alimentacion": "Auxiliar de Alimentación",
                    "auxiliar_movilidad": "Auxiliar de Movilidad",
                    "auxiliar_topico": "Auxiliar de Tópico",
                }
                info_line = _STAFF_LABELS.get(target_role, "Personal")
            else:
                info_line = f"{nivel_name} - {curso_label}"
            tw2 = c.stringWidth(info_line, "Helvetica", 5.5 * sf)
            c.drawString(x + (card_w - tw2) / 2, info_y - 4 * sf * mm - code_offset, info_line)

            # QR
            footer_y = y + 2 * sf * mm
            qr_top = info_y - 7 * sf * mm - code_offset
            qr_bottom = footer_y + 4 * sf * mm
            available = qr_top - qr_bottom
            qr_size_px = min(available, 32 * sf * mm)
            qr_size_px = max(qr_size_px, 18 * sf * mm)

            qr_img = make_qr_image(s["qr_token"], 250)
            qr_buf = BytesIO()
            qr_img.save(qr_buf, format="PNG")
            qr_buf.seek(0)
            qr_x = x + (card_w - qr_size_px) / 2
            qr_y = qr_bottom + (available - qr_size_px) / 2
            c.drawImage(ImageReader(qr_buf), qr_x, qr_y, qr_size_px, qr_size_px)
            del qr_buf

            # Footer
            c.setFillColor(HexColor("#94a3b8"))
            c.setFont("Helvetica", 4 * sf)
            c.drawCentredString(x + card_w / 2, footer_y, "Personal e intransferible")

            card_idx += 1

        c.save()
        buf.seek(0)

        # Free logo
        if logo_img:
            try:
                logo_img.close()
            except Exception:
                pass
            del logo_img

        logger.info(f"[QR Template Classic] === SUCCESS: {card_idx} cards generated ===")
        return buf
