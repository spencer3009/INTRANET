"""
QR Service — Central service for generating unique QR IDs.
All QR generation must go through this module.
"""
import uuid


async def generate_unique_qr_id(db) -> str:
    """Generate a unique 8-char QR ID, verified against the users collection."""
    while True:
        qr_id = uuid.uuid4().hex[:8]
        exists = await db.users.find_one({"qr_id": qr_id}, {"_id": 0, "id": 1})
        if not exists:
            return qr_id


async def generate_user_qr(db) -> tuple:
    """Generate a (qr_id, qr_token) tuple for a user.
    qr_token is the scannable URL: https://app.edunet.pe/qr/{qr_id}
    """
    qr_id = await generate_unique_qr_id(db)
    qr_token = f"https://app.edunet.pe/qr/{qr_id}"
    return qr_id, qr_token
