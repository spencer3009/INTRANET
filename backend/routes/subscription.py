"""
Subscription Router - Plan management, expiration control, and payment processing
States: ACTIVO, AVISO_VENCIMIENTO, RESTRICCION_PARCIAL, PAGO_OBLIGATORIO, SUSPENDIDO, PAGO_EN_VERIFICACION
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

from .core import db, get_current_user, now_iso

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/subscription", tags=["subscription"])


PLAN_STATES = [
    "ACTIVO",
    "AVISO_VENCIMIENTO",
    "RESTRICCION_PARCIAL",
    "PAGO_OBLIGATORIO",
    "SUSPENDIDO",
    "PAGO_EN_VERIFICACION",
]

RESTRICTED_ACTIONS = [
    "create_student", "create_teacher", "create_subject",
    "register_grades", "create_schedule", "register_payment",
]


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

async def get_grace_days():
    """Get global grace days config"""
    cfg = await db.system_config.find_one({"id": "subscription_config"}, {"_id": 0})
    if cfg:
        return cfg.get("dias_gracia", 7)
    return 7


async def calculate_plan_state(school):
    """Calculate the current plan state based on expiration date"""
    exp_str = school.get("fecha_vencimiento") or school.get("expiration_date")
    if not exp_str:
        return "ACTIVO", 0

    # Check if there's a pending payment verification
    pending = await db.payment_requests.find_one(
        {"school_id": school["id"], "status": "processing"}, {"_id": 0, "id": 1}
    )
    if pending:
        return "PAGO_EN_VERIFICACION", 0

    try:
        exp = datetime.fromisoformat(str(exp_str).replace("Z", "+00:00"))
    except Exception:
        return "ACTIVO", 0

    now = datetime.now(timezone.utc)
    diff = (now - exp).total_seconds() / 86400  # days since expiration

    if diff <= 0:
        return "ACTIVO", 0

    dias_vencido = int(diff)
    dias_gracia = await get_grace_days()

    # Progressive states based on days overdue
    if dias_vencido == 0:
        return "AVISO_VENCIMIENTO", dias_vencido
    elif dias_vencido <= 3:
        return "RESTRICCION_PARCIAL", dias_vencido
    elif dias_vencido <= dias_gracia:
        return "PAGO_OBLIGATORIO", dias_vencido
    else:
        return "SUSPENDIDO", dias_vencido


async def get_school_pricing(school):
    """Calculate school's current pricing"""
    school_id = school["id"]
    pricing = school.get("pricing_override", {})
    global_pricing = await db.pricing_config.find_one({"id": "global"}, {"_id": 0})
    if not global_pricing:
        global_pricing = {
            "billing_mode": "base_plus_student",
            "base_monthly_fee": 50.0,
            "per_student_fee": 0.70,
            "per_student_from_month": 3,
            "flat_fee": 0.0,
        }

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

    return {
        "cantidad_alumnos": student_count,
        "precio_por_alumno": eff_student_fee,
        "base_mensual": eff_base,
        "monto_actual": amount,
        "billing_mode": eff_mode,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def get_subscription_status(current_user=Depends(get_current_user)):
    """Get current subscription status for the user's school"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    # Only owner and admin roles see financial/subscription info
    ADMIN_ROLES = ("owner", "admin", "system_admin_global")
    user_role = user.get("role", "")
    if user_role not in ADMIN_ROLES:
        return {"plan_estado": "ACTIVO", "dias_vencido": 0, "restricted_actions": []}

    school_id = user.get("school_id")
    if not school_id:
        return {"plan_estado": "ACTIVO", "dias_vencido": 0}

    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        return {"plan_estado": "ACTIVO", "dias_vencido": 0}

    plan_estado, dias_vencido = await calculate_plan_state(school)
    pricing = await get_school_pricing(school)

    # Get QR config
    qr_config = await db.system_config.find_one({"id": "payment_qr"}, {"_id": 0})
    qr_url = qr_config.get("qr_pago_url", "") if qr_config else ""
    yape_number = qr_config.get("yape_number", "") if qr_config else ""

    exp_str = school.get("fecha_vencimiento") or school.get("expiration_date")

    return {
        "plan_estado": plan_estado,
        "dias_vencido": dias_vencido,
        "fecha_vencimiento": exp_str,
        "fecha_activacion": school.get("fecha_activacion") or school.get("created_at"),
        "monto_plan": pricing["monto_actual"],
        "pricing": pricing,
        "school_name": school.get("name", school.get("subdomain", "")),
        "qr_pago_url": qr_url,
        "yape_number": yape_number,
        "restricted_actions": RESTRICTED_ACTIONS if plan_estado == "RESTRICCION_PARCIAL" else [],
    }


@router.post("/register-payment")
async def register_owner_payment(current_user=Depends(get_current_user)):
    """Owner registers a payment - goes to PAGO_EN_VERIFICACION"""
    import json
    from fastapi import Request

    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="No pertenece a ningun colegio")

    # Check for existing pending
    existing = await db.payment_requests.find_one(
        {"school_id": school_id, "status": "processing"}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un pago en verificacion")

    return {"message": "Use /api/membership/request-payment"}


@router.post("/check-action")
async def check_action_allowed(current_user=Depends(get_current_user)):
    """Check if a specific action is allowed based on subscription status"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")

    # Support users bypass all restrictions
    if user.get("role") == "system_admin_global":
        return {"allowed": True, "plan_estado": "ACTIVO"}

    school_id = user.get("school_id")
    if not school_id:
        return {"allowed": True, "plan_estado": "ACTIVO"}

    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        return {"allowed": True, "plan_estado": "ACTIVO"}

    plan_estado, dias_vencido = await calculate_plan_state(school)

    blocked = plan_estado in ["PAGO_OBLIGATORIO", "SUSPENDIDO"]
    restricted = plan_estado == "RESTRICCION_PARCIAL"

    return {
        "allowed": not blocked,
        "restricted": restricted,
        "plan_estado": plan_estado,
        "dias_vencido": dias_vencido,
    }


# ══════════════════════════════════════════════════════════════════════════════
# QR MANAGEMENT (Support only)
# ══════════════════════════════════════════════════════════════════════════════

async def require_support(current_user=Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo soporte puede acceder")
    return user


@router.get("/qr-config")
async def get_qr_config(user=Depends(require_support)):
    """Get current QR payment config"""
    cfg = await db.system_config.find_one({"id": "payment_qr"}, {"_id": 0})
    return cfg or {"id": "payment_qr", "qr_pago_url": "", "yape_number": ""}


class UpdateQRConfig(BaseModel):
    qr_pago_url: Optional[str] = None
    yape_number: Optional[str] = None


@router.put("/qr-config")
async def update_qr_config(data: UpdateQRConfig, user=Depends(require_support)):
    """Update QR payment config"""
    update = {"updated_at": now_iso()}
    if data.qr_pago_url is not None:
        update["qr_pago_url"] = data.qr_pago_url
    if data.yape_number is not None:
        update["yape_number"] = data.yape_number

    await db.system_config.update_one(
        {"id": "payment_qr"},
        {"$set": update, "$setOnInsert": {"id": "payment_qr"}},
        upsert=True,
    )
    cfg = await db.system_config.find_one({"id": "payment_qr"}, {"_id": 0})
    return cfg


# ══════════════════════════════════════════════════════════════════════════════
# SUBSCRIPTION CONFIG (Support only)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/config")
async def get_subscription_config(user=Depends(require_support)):
    """Get global subscription config"""
    cfg = await db.system_config.find_one({"id": "subscription_config"}, {"_id": 0})
    return cfg or {"id": "subscription_config", "dias_gracia": 7}


class UpdateSubscriptionConfig(BaseModel):
    dias_gracia: Optional[int] = None


@router.put("/config")
async def update_subscription_config(data: UpdateSubscriptionConfig, user=Depends(require_support)):
    """Update global subscription config"""
    update = {"updated_at": now_iso()}
    if data.dias_gracia is not None:
        update["dias_gracia"] = max(1, data.dias_gracia)

    await db.system_config.update_one(
        {"id": "subscription_config"},
        {"$set": update, "$setOnInsert": {"id": "subscription_config", "dias_gracia": 7}},
        upsert=True,
    )
    cfg = await db.system_config.find_one({"id": "subscription_config"}, {"_id": 0})
    return cfg


# ══════════════════════════════════════════════════════════════════════════════
# DAILY CRON - Updates all school statuses
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/run-daily-check")
async def run_daily_check(user=Depends(require_support)):
    """Manually trigger the daily subscription check (also runs on startup)"""
    updated = 0
    schools = await db.schools.find({}, {"_id": 0, "id": 1, "expiration_date": 1, "fecha_vencimiento": 1}).to_list(None)

    for school in schools:
        plan_estado, dias_vencido = await calculate_plan_state(school)
        await db.schools.update_one(
            {"id": school["id"]},
            {"$set": {
                "plan_estado": plan_estado,
                "dias_vencido": dias_vencido,
                "subscription_checked_at": now_iso(),
            }}
        )
        updated += 1

    return {"message": f"Verificacion completada: {updated} colegios actualizados"}
