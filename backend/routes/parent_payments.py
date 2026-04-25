"""
Parent Payments via Yape - Parent-facing endpoints
Handles: Yape config retrieval, payment reporting, payment history
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging
import re

from .core import (
    db, get_current_user, resolve_user_from_token,
    now_iso,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/parent-payments")


async def _verify_parent(current_user) -> dict:
    """Resolve and verify the user is a parent."""
    user = await resolve_user_from_token(current_user)
    if not user or user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para padres/apoderados")
    return user


async def _verify_parent_child(parent: dict, student_id: str) -> dict:
    """Verify that student_id belongs to this parent."""
    children_ids = parent.get("children_ids") or parent.get("hijos") or []
    student = await db.users.find_one(
        {"id": student_id, "school_id": parent["school_id"], "role": "student"},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "grado_id": 1, "seccion_id": 1,
         "parent_id": 1, "padre_id": 1, "madre_id": 1, "apoderado_id": 1, "linked_parent_ids": 1}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    is_linked = (
        student_id in children_ids
        or student.get("parent_id") == parent["id"]
        or student.get("padre_id") == parent["id"]
        or student.get("madre_id") == parent["id"]
        or student.get("apoderado_id") == parent["id"]
        or parent["id"] in (student.get("linked_parent_ids") or [])
    )
    if not is_linked:
        raise HTTPException(status_code=403, detail="No tienes acceso a este estudiante")
    return student


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINT 1: Get Yape config for parent portal
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/yape-config")
async def get_yape_config_for_parent(current_user=Depends(get_current_user)):
    """Return Yape QR config if enabled for the school."""
    user = await _verify_parent(current_user)
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Sin colegio asociado")

    config = await db.yape_config.find_one({"school_id": school_id}, {"_id": 0})
    if not config or not config.get("enabled"):
        return {"enabled": False}

    return {
        "enabled": True,
        "qr_image_base64": config.get("qr_image_base64", ""),
        "account_holder_name": config.get("account_holder_name", ""),
        "instructions_text": config.get("instructions_text", ""),
    }


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINT 2: Get payment schedule per child
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/schedule/{student_id}")
async def get_payment_schedule(student_id: str, current_user=Depends(get_current_user)):
    """Return payment schedule for a child, crossing with parent_payments."""
    user = await _verify_parent(current_user)
    student = await _verify_parent_child(user, student_id)
    school_id = user["school_id"]

    # Get all mensualidad payments from the accounting module
    payments = await db.payments.find(
        {"school_id": school_id, "student_id": student_id},
        {"_id": 0}
    ).sort("payment_date", 1).to_list(200)

    # Get parent_payments for this student to cross-reference
    parent_pays = await db.parent_payments.find(
        {"school_id": school_id, "student_id": student_id},
        {"_id": 0}
    ).to_list(200)

    # Index parent payments by month+year for quick lookup
    pp_index = {}
    for pp in parent_pays:
        key = f"{pp.get('month')}-{pp.get('year')}"
        existing = pp_index.get(key)
        if not existing or pp.get("status") in ("pendiente_verificacion", "verificado"):
            pp_index[key] = pp

    schedule = []
    for p in payments:
        # Try to extract month/year from pension_month or payment_date
        month_num = None
        year_num = None
        pm = p.get("pension_month", "")
        if pm and "-" in pm:
            parts = pm.split("-")
            year_num = int(parts[0])
            month_num = int(parts[1])
        elif p.get("payment_date"):
            try:
                pd = p["payment_date"]
                if isinstance(pd, str) and "-" in pd:
                    parts = pd.split("-")
                    year_num = int(parts[0])
                    month_num = int(parts[1])
            except Exception:
                pass

        # Check if there's a parent_payment for this month
        yape_status = None
        yape_payment_id = None
        if month_num and year_num:
            key = f"{month_num}-{year_num}"
            pp = pp_index.get(key)
            if pp:
                yape_status = pp.get("status")
                yape_payment_id = pp.get("id")

        schedule.append({
            "id": p.get("id"),
            "concept": p.get("concept", ""),
            "description": p.get("description", ""),
            "amount": p.get("total_amount", p.get("amount_base", 0)),
            "payment_date": p.get("payment_date", ""),
            "pension_month": pm,
            "month": month_num,
            "year": year_num,
            "status": p.get("payment_status", "pending"),
            "payment_method": p.get("payment_method"),
            "yape_status": yape_status,
            "yape_payment_id": yape_payment_id,
        })

    student_name = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
    return {
        "student_id": student_id,
        "student_name": student_name,
        "schedule": schedule,
    }


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINT 3: Report a Yape payment (parent submits)
# ──────────────────────────────────────────────────────────────────────────────

class ReportYapePayment(BaseModel):
    student_id: str
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2020, le=2100)
    amount: float = Field(..., gt=0)
    yape_operation_code: str = Field(..., min_length=4, max_length=30)
    concept: Optional[str] = None
    is_pronto_pago: bool = False


@router.post("/report", status_code=201)
async def report_yape_payment(data: ReportYapePayment, current_user=Depends(get_current_user)):
    """Parent reports a Yape payment for verification."""
    user = await _verify_parent(current_user)
    student = await _verify_parent_child(user, data.student_id)
    school_id = user["school_id"]

    # 1. Verify Yape is enabled
    yape_config = await db.yape_config.find_one({"school_id": school_id}, {"_id": 0})
    if not yape_config or not yape_config.get("enabled"):
        raise HTTPException(status_code=400, detail="El cobro por Yape no esta habilitado para este colegio")

    # 2. Sanitize operation code
    code = re.sub(r"[^a-zA-Z0-9]", "", data.yape_operation_code.strip())
    if len(code) < 4:
        raise HTTPException(status_code=400, detail="El codigo de operacion debe tener al menos 4 caracteres alfanumericos")

    # 3. Check duplicate: same student+month+year with active status
    # Block if there's one pending verification
    existing_pending = await db.parent_payments.find_one({
        "school_id": school_id,
        "student_id": data.student_id,
        "month": data.month,
        "year": data.year,
        "status": "pendiente_verificacion"
    })
    if existing_pending:
        raise HTTPException(status_code=409, detail="Ya existe un pago pendiente de verificacion para este mes")
    
    # Block if the month is actually paid in accounting
    pension_month_str = f"{data.year}-{str(data.month).zfill(2)}"
    paid_in_accounting = await db.payments.find_one({
        "school_id": school_id,
        "student_id": data.student_id,
        "pension_month": pension_month_str,
        "payment_status": "paid",
        "$or": [
            {"concept": {"$regex": "mensualidad", "$options": "i"}},
            {"conceptos.concepto": {"$regex": "mensualidad", "$options": "i"}},
        ]
    })
    if paid_in_accounting:
        raise HTTPException(status_code=409, detail="Este mes ya fue pagado")

    # 4. Check duplicate operation code in the same school
    code_exists = await db.parent_payments.find_one({
        "school_id": school_id,
        "yape_operation_code": code,
        "status": {"$ne": "rechazado"}
    })
    if code_exists:
        raise HTTPException(status_code=409, detail="Este codigo de operacion ya fue registrado")

    # 5. Insert
    now = datetime.now(timezone.utc).isoformat()
    student_name = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
    parent_name = f"{user.get('name', '')} {user.get('last_name', '')}".strip()

    month_names = {1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
                   7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"}
    concept = data.concept or f"Pension {month_names.get(data.month, '')} {data.year}"

    payment_doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "student_id": data.student_id,
        "student_name": student_name,
        "parent_id": user["id"],
        "parent_name": parent_name,
        "concept": concept,
        "amount": data.amount,
        "month": data.month,
        "year": data.year,
        "payment_date": now,
        "yape_operation_code": code,
        "status": "pendiente_verificacion",
        "is_pronto_pago": data.is_pronto_pago,
        "verified_by": None,
        "verified_at": None,
        "rejection_reason": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.parent_payments.insert_one(payment_doc)

    logger.info(f"[YAPE] Pago reportado: school={school_id}, student={data.student_id}, "
                f"month={data.month}/{data.year}, amount={data.amount}, code={code}")

    return {
        "message": "Pago reportado exitosamente. Sera verificado por el colegio.",
        "payment_id": payment_doc["id"],
        "status": "pendiente_verificacion",
    }


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINT 4: Parent payment history
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_parent_payment_history(
    student_id: Optional[str] = None,
    year: Optional[int] = None,
    current_user=Depends(get_current_user)
):
    """Get Yape payment history for the authenticated parent."""
    user = await _verify_parent(current_user)
    school_id = user["school_id"]

    query = {"school_id": school_id, "parent_id": user["id"]}
    if student_id:
        await _verify_parent_child(user, student_id)
        query["student_id"] = student_id
    if year:
        query["year"] = year

    payments = await db.parent_payments.find(
        query, {"_id": 0}
    ).sort("payment_date", -1).to_list(200)

    return {"payments": payments, "total": len(payments)}



# ──────────────────────────────────────────────────────────────────────────────
# CONCEPT SUBSCRIPTIONS (Servicios opcionales open) — Parent endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/available-concepts/{student_id}")
async def get_parent_available_concepts(student_id: str, current_user=Depends(get_current_user)):
    """List recurrente + open concepts available for the child, with current
    subscription state."""
    parent = await _verify_parent(current_user)
    await _verify_parent_child(parent, student_id)
    school_id = parent["school_id"]

    concepts = await db.payment_concepts.find(
        {
            "school_id": school_id,
            "concept_type": "recurrente",
            "status": "active",
            "apply_mode": "subscription",
        },
        {"_id": 0},
    ).sort("name", 1).to_list(100)

    if not concepts:
        return {"concepts": []}

    concept_ids = [c["id"] for c in concepts]
    subs = await db.student_concept_subscriptions.find(
        {"school_id": school_id, "student_id": student_id, "concept_id": {"$in": concept_ids}},
        {"_id": 0},
    ).to_list(100)
    subs_map = {s["concept_id"]: s for s in subs}

    out = []
    for c in concepts:
        s = subs_map.get(c["id"])
        out.append({
            "concept_id": c["id"],
            "name": c.get("name"),
            "amount": c.get("amount", 0),
            "concept_type": c.get("concept_type"),
            "apply_mode": c.get("apply_mode", "subscription"),
            "is_subscribed": bool(s and s.get("is_active")),
            "activated_by": s.get("activated_by") if s else None,
            "subscription_id": s.get("id") if s else None,
        })

    return {"concepts": out}


@router.post("/concept-subscriptions/{student_id}/{concept_id}")
async def parent_subscribe_to_concept(
    student_id: str,
    concept_id: str,
    current_user=Depends(get_current_user),
):
    """Parent activates a subscription to an open concept for their child."""
    parent = await _verify_parent(current_user)
    await _verify_parent_child(parent, student_id)
    school_id = parent["school_id"]

    concept = await db.payment_concepts.find_one(
        {"id": concept_id, "school_id": school_id},
        {"_id": 0},
    )
    if not concept:
        raise HTTPException(status_code=404, detail="Concepto no encontrado")
    if concept.get("status") != "active":
        raise HTTPException(status_code=400, detail="El concepto está inactivo")
    if concept.get("apply_mode") != "subscription":
        raise HTTPException(status_code=403, detail="Este concepto no se puede activar desde el portal del padre")

    now = datetime.now(timezone.utc).isoformat()

    existing = await db.student_concept_subscriptions.find_one(
        {"school_id": school_id, "student_id": student_id, "concept_id": concept_id},
        {"_id": 0},
    )
    if existing:
        await db.student_concept_subscriptions.update_one(
            {"id": existing["id"]},
            {"$set": {
                "is_active": True,
                "amount": round(concept.get("amount", 0), 2),
                "concept_name": concept.get("name"),
                "apply_mode": "subscription",
                "activated_by": "parent",
                "updated_at": now,
            }},
        )
        sub = await db.student_concept_subscriptions.find_one({"id": existing["id"]}, {"_id": 0})
        return {"message": "Servicio activado", "subscription": sub}

    sub = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "student_id": student_id,
        "concept_id": concept_id,
        "concept_name": concept.get("name"),
        "amount": round(concept.get("amount", 0), 2),
        "apply_mode": "subscription",
        "activated_by": "parent",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.student_concept_subscriptions.insert_one(sub)
    sub.pop("_id", None)
    logger.info(f"[SUBS] parent activated student={student_id} concept={concept_id}")
    return {"message": "Servicio activado", "subscription": sub}


@router.delete("/concept-subscriptions/{student_id}/{concept_id}")
async def parent_unsubscribe_from_concept(
    student_id: str,
    concept_id: str,
    current_user=Depends(get_current_user),
):
    """Parent deactivates a subscription to an open concept."""
    parent = await _verify_parent(current_user)
    await _verify_parent_child(parent, student_id)
    school_id = parent["school_id"]

    concept = await db.payment_concepts.find_one(
        {"id": concept_id, "school_id": school_id},
        {"_id": 0},
    )
    if not concept:
        raise HTTPException(status_code=404, detail="Concepto no encontrado")
    if concept.get("apply_mode") != "subscription":
        raise HTTPException(status_code=403, detail="Este concepto no se puede desactivar desde el portal del padre")

    sub = await db.student_concept_subscriptions.find_one(
        {"school_id": school_id, "student_id": student_id, "concept_id": concept_id},
        {"_id": 0},
    )
    if not sub:
        return {"message": "No había suscripción activa"}

    now = datetime.now(timezone.utc).isoformat()
    await db.student_concept_subscriptions.update_one(
        {"id": sub["id"]},
        {"$set": {"is_active": False, "activated_by": "parent", "updated_at": now}},
    )
    logger.info(f"[SUBS] parent deactivated student={student_id} concept={concept_id}")
    return {"message": "Servicio desactivado"}
