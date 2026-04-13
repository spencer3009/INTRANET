"""Image optimization utility for QR carnet uploads (logo + watermark).

Validates size, resizes to max width, converts to WebP.
Only used by qr_templates endpoints — NOT applied to other upload flows.
"""
from PIL import Image
from io import BytesIO

MAX_FILE_SIZE_MB = 5
MAX_WIDTH_PX = 800
WEBP_QUALITY = 80


class ImageOptimizer:
    @staticmethod
    def validate_and_optimize(file_bytes: bytes, filename: str) -> tuple:
        """
        Validate size, resize if needed, convert to WebP.
        Returns: (webp_bytes, new_filename)
        Raises: ValueError if file exceeds limit.
        """
        size_mb = len(file_bytes) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            raise ValueError(f"El archivo excede el limite de {MAX_FILE_SIZE_MB}MB (actual: {size_mb:.1f}MB)")

        img = Image.open(BytesIO(file_bytes))

        if img.mode in ('RGBA', 'LA', 'PA'):
            img = img.convert('RGBA')
        elif img.mode == 'P':
            if 'transparency' in img.info:
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        if img.width > MAX_WIDTH_PX:
            ratio = MAX_WIDTH_PX / img.width
            new_height = int(img.height * ratio)
            img = img.resize((MAX_WIDTH_PX, new_height), Image.LANCZOS)

        output = BytesIO()
        img.save(output, format='WEBP', quality=WEBP_QUALITY, method=6)

        base = filename.rsplit('.', 1)[0] if '.' in filename else filename
        new_filename = base + '.webp'

        return output.getvalue(), new_filename
