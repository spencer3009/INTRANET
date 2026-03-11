"""
Membership Router - Payment requests and renewal management
Handles: Owner payment requests, Support renewal confirmation
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid

from .core import db, get_current_user

router = APIRouter(prefix="/api/membership", tags=["membership"])


# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════

class PaymentRequest(BaseModel):
    operation_code: Optional[str] = None
    payment_method: str = "yape"


# ══════════════════════════════════════════════════════════════════════════════
# OWNER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/request-payment")
async def request_payment(req: PaymentRequest, current_user=Depends(get_current_user)):
    """Owner submits a payment request after paying via Yape/Plin"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="No pertenece a ningun colegio")

    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")

    # Check for existing pending request
    existing = await db.payment_requests.find_one(
        {"school_id": school_id, "status": "processing"},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una solicitud de pago en verificacion")

    # Calculate amount from pricing
    pricing = school.get("pricing_override", {})
    global_pricing = await db.pricing_config.find_one({"id": "global"}, {"_id": 0})
    if not global_pricing:
        global_pricing = {"billing_mode": "base_plus_student", "base_monthly_fee": 50.0, "per_student_fee": 0.70, "per_student_from_month": 3, "flat_fee": 0.0}

    def _ev(key, default):
        if pricing and key in pricing:
            return pricing[key]
        return global_pricing.get(key, default)

    eff_mode = _ev("billing_mode", "base_plus_student")
    eff_base = _ev("base_monthly_fee", 50.0)
    eff_student_fee = _ev("per_student_fee", 0.70)
    eff_from_month = _ev("per_student_from_month", 3)
    eff_flat = _ev("flat_fee", 0.0)

    student_count = await db.users.count_documents({"school_id": school_id, "role": "student"})

    months_active = 1
    if school.get("created_at"):
        try:
            created = datetime.fromisoformat(str(school["created_at"]).replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            months_active = max(1, (now.year - created.year) * 12 + now.month - created.month + 1)
        except Exception:
            pass

    if eff_mode == "flat_fee":
        amount = round(eff_flat, 2)
    elif eff_mode == "student_only":
        amount = round(student_count * eff_student_fee, 2) if months_active >= eff_from_month else 0.0
    else:
        student_charge = round(student_count * eff_student_fee, 2) if months_active >= eff_from_month else 0.0
        amount = round(eff_base + student_charge, 2)

    now_str = datetime.now(timezone.utc).isoformat()
    payment_req = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "school_name": school.get("name", school.get("subdomain", "")),
        "amount": amount,
        "payment_method": req.payment_method,
        "operation_code": req.operation_code or "",
        "status": "processing",
        "requested_by": user["id"],
        "requested_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "created_at": now_str,
        "updated_at": now_str,
        "resolved_at": None,
        "resolved_by": None,
    }

    await db.payment_requests.insert_one(payment_req)
    del payment_req["_id"]
    return payment_req


@router.get("/payment-status")
async def get_payment_status(current_user=Depends(get_current_user)):
    """Get current payment request status for the owner's school"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    school_id = user.get("school_id")
    if not school_id:
        return {"status": None}

    request = await db.payment_requests.find_one(
        {"school_id": school_id, "status": "processing"},
        {"_id": 0}
    )
    return {"pending_request": request}
