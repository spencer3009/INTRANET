"""Generate a ZIP file with one QR PNG per student."""
import logging
from io import BytesIO
import zipfile
import qrcode

logger = logging.getLogger(__name__)


async def generate_zip(db, school_id, data, incluir_codigo=False, ordenar=True) -> BytesIO:
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

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, s in enumerate(students, 1):
            name_part = f"{s.get('last_name', '')}_{s.get('name', '')}".strip().replace(" ", "_")
            if incluir_codigo and s.get("codigo_alumno"):
                filename = f"{s['codigo_alumno']}_{name_part}.png"
            else:
                filename = f"{idx:03d}_{name_part}.png"

            # Generate QR PNG
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=2)
            qr.add_data(s["qr_token"])
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            img_buf = BytesIO()
            img.save(img_buf, format="PNG")
            zf.writestr(filename, img_buf.getvalue())

    buf.seek(0)
    logger.info(f"[ZIP Export] Generated ZIP with {len(students)} QR images")
    return buf
