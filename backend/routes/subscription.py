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
    "register_grades", "register_attendance", "create_schedule",
    "register_payment", "send_mass_messages",
]


async def check_subscription_restriction(user):
    """Check if the school's subscription allows write operations.
    Raises 403 if the school is in RESTRICCION_PARCIAL or worse.
    Only applies to owner/admin roles.
    """
    role = user.get("role", "")
    if role not in ("owner", "admin"):
        return  # Non-admin roles are not restricted
    school_id = user.get("school_id")
    if not school_id:
        return
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "plan_estado": 1})
    if not school:
        return
    estado = school.get("plan_estado", "ACTIVO")
    if estado in ("RESTRICCION_PARCIAL",):
        raise HTTPException(
            status_code=403,
            detail="Accion restringida: su suscripcion esta vencida. Registre su pago para continuar."
        )
    if estado in ("PAGO_OBLIGATORIO", "SUSPENDIDO"):
        raise HTTPException(
            status_code=403,
            detail="Acceso bloqueado: su suscripcion esta suspendida. Registre su pago para reactivar su cuenta."
        )


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
    """Calculate the current plan state based on expiration date.
    Priority: date-based state always wins when dias_vencido >= 3.
    PAGO_EN_VERIFICACION only applies for schools with < 3 days overdue.
    """
    school_id = school.get("id", "unknown")
    try:
        exp_str = school.get("fecha_vencimiento") or school.get("expiration_date")
        if not exp_str:
            logger.warning(f"[PLAN_STATE] school={school_id} sin fecha_vencimiento ni expiration_date -> ACTIVO")
            return "ACTIVO", 0

        try:
            exp = datetime.fromisoformat(str(exp_str).replace("Z", "+00:00"))
        except Exception as parse_err:
            logger.error(f"[PLAN_STATE] school={school_id} fecha invalida '{exp_str}': {parse_err} -> PAGO_OBLIGATORIO por seguridad")
            return "PAGO_OBLIGATORIO", 0

        now = datetime.now(timezone.utc)
        dias_vencido = (now.date() - exp.date()).days

        # Determine base state from days overdue
        if dias_vencido < 0:
            base_state = "ACTIVO"
        elif dias_vencido == 0:
            base_state = "AVISO_VENCIMIENTO"
        elif dias_vencido <= 2:
            base_state = "RESTRICCION_PARCIAL"
        elif dias_vencido <= 6:
            base_state = "PAGO_OBLIGATORIO"
        else:
            base_state = "SUSPENDIDO"

        # PAGO_EN_VERIFICACION only overrides if school is NOT yet in hard-block territory (< 3 days)
        if base_state in ("ACTIVO", "AVISO_VENCIMIENTO", "RESTRICCION_PARCIAL"):
            try:
                pending = await db.payment_requests.find_one(
                    {"school_id": school_id, "status": "processing"}, {"_id": 0, "id": 1}
                )
                if pending:
                    logger.info(f"[PLAN_STATE] school={school_id} dias_vencido={dias_vencido} tiene pago pendiente -> PAGO_EN_VERIFICACION")
                    return "PAGO_EN_VERIFICACION", dias_vencido
            except Exception as pmt_err:
                logger.error(f"[PLAN_STATE] school={school_id} error checking payment_requests: {pmt_err}")

        if dias_vencido >= 3:
            logger.info(f"[PLAN_STATE] school={school_id} dias_vencido={dias_vencido} -> {base_state}")

        return base_state, dias_vencido
    except Exception as e:
        logger.error(f"[PLAN_STATE] school={school_id} error inesperado: {e} -> PAGO_OBLIGATORIO por seguridad")
        return "PAGO_OBLIGATORIO", 0


async def get_school_pricing(school):
    """Calculate school's current pricing"""
    try:
        school_id = school.get("id", "")
        pricing = school.get("pricing_override") or {}
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
    except Exception as e:
        logger.error(f"get_school_pricing error: {e}")
        return {"cantidad_alumnos": 0, "precio_por_alumno": 0, "base_mensual": 0, "monto_actual": 0, "billing_mode": "base_plus_student"}


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def get_subscription_status(current_user=Depends(get_current_user)):
    """Get current subscription status for the user's school"""
    try:
        user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
        if not user:
            return {"plan_estado": "ACTIVO", "dias_vencido": 0}

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

        try:
            pricing = await get_school_pricing(school)
        except Exception:
            pricing = {"monto_actual": 0, "cantidad_alumnos": 0, "precio_por_alumno": 0, "base_mensual": 0, "billing_mode": "base_plus_student"}

        qr_config = await db.system_config.find_one({"id": "payment_qr"}, {"_id": 0})
        qr_url = qr_config.get("qr_pago_url", "") if qr_config else ""
        yape_number = qr_config.get("yape_number", "") if qr_config else ""

        exp_str = school.get("fecha_vencimiento") or school.get("expiration_date")

        return {
            "plan_estado": plan_estado,
            "dias_vencido": dias_vencido,
            "fecha_vencimiento": exp_str,
            "fecha_activacion": school.get("fecha_activacion") or school.get("created_at"),
            "monto_plan": pricing.get("monto_actual", 0),
            "pricing": pricing,
            "school_name": school.get("name") or school.get("school_name") or school.get("subdomain", ""),
            "qr_pago_url": qr_url,
            "yape_number": yape_number,
            "restricted_actions": RESTRICTED_ACTIONS if plan_estado == "RESTRICCION_PARCIAL" else [],
        }
    except Exception as e:
        logger.error(f"Subscription status error: {e}")
        return {"plan_estado": "ACTIVO", "dias_vencido": 0, "restricted_actions": []}


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

import asyncio

async def daily_subscription_cron():
    """Background task: runs daily to update all school subscription states."""
    while True:
        try:
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
            logger.info(f"[CRON] Verificacion diaria completada: {updated} colegios actualizados")
        except Exception as e:
            logger.error(f"[CRON] Error en verificacion diaria: {e}")
        # Wait 24 hours
        await asyncio.sleep(86400)


@router.post("/run-daily-check")
async def run_daily_check(user=Depends(require_support)):
    """Manually trigger the daily subscription check"""
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
