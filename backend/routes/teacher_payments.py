"""
Teacher payments (planilla docente) module.
- Maintains a `teacher_payments` collection tracking monthly salary/bonus/CTS per teacher.
- When confirmed, a mirror document is created in `expenses` with category `planilla_docente`
  for dashboard/report aggregation, linked back via `teacher_payment_id`.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum
import uuid
import logging

from .core import db, require_section_access

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


class PaymentType(str, Enum):
    sueldo = "sueldo"
    bono = "bono"
    gratificacion = "gratificacion"
    cts = "cts"
    otro = "otro"


PAYMENT_TYPE_LABELS = {
    "sueldo": "Sueldo",
    "bono": "Bono",
    "gratificacion": "Gratificación",
    "cts": "CTS",
    "otro": "Otro",
}

MONTH_NAMES_ES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


# ─── Models ───────────────────────────────────────────────────────────────────
class TeacherPaymentCreate(BaseModel):
    teacher_id: str
    period_year: int = Field(..., ge=2020, le=2100)
    period_month: int = Field(..., ge=1, le=12)
    payment_type: PaymentType = PaymentType.sueldo
    amount: float = Field(..., ge=0)
    notes: Optional[str] = None


class BulkItem(BaseModel):
    teacher_id: str
    amount: float = Field(..., ge=0)


class BulkCreateRequest(BaseModel):
    period_year: int = Field(..., ge=2020, le=2100)
    period_month: int = Field(..., ge=1, le=12)
    payment_type: PaymentType = PaymentType.sueldo
    items: List[BulkItem]


class SalaryUpdate(BaseModel):
    salary_base: Optional[float] = Field(None, ge=0)
    payment_notes: Optional[str] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────
_indexes_ensured = False


async def _ensure_indexes():
    global _indexes_ensured
    if _indexes_ensured:
        return
    try:
        await db.teacher_payments.create_index(
            [("school_id", 1), ("teacher_id", 1), ("period_year", 1),
             ("period_month", 1), ("payment_type", 1)],
            unique=True, name="tp_unique_per_period",
        )
        await db.teacher_payments.create_index(
            [("school_id", 1), ("period_year", 1), ("period_month", 1)],
            name="tp_by_period",
        )
        await db.teacher_payments.create_index(
            [("school_id", 1), ("status", 1)],
            name="tp_by_status",
        )
        _indexes_ensured = True
    except Exception as e:
        logger.warning(f"[TEACHER-PAY] index ensure failed: {e}")


# ─── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/contabilidad/teacher-payments/planilla")
async def get_planilla(
    year: int,
    month: int,
    payment_type: PaymentType = PaymentType.sueldo,
    current_user=Depends(require_section_access("accounting")),
):
    """Return all active teachers of the school with their payment status for the
    given period and payment type. Teachers without a recorded payment are
    returned as pendiente with amount = salary_base (or 0)."""
    await _ensure_indexes()
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mes inválido")

    school_id = current_user["school_id"]

    teachers = await db.users.find(
        {"school_id": school_id, "role": "teacher", "status": {"$ne": "inactive"}},
        {
            "_id": 0, "id": 1, "name": 1, "last_name": 1, "full_name": 1,
            "avatar_url": 1, "salary_base": 1, "payment_notes": 1,
        },
    ).to_list(2000)

    payments_list = await db.teacher_payments.find(
        {
            "school_id": school_id,
            "period_year": year,
            "period_month": month,
            "payment_type": payment_type.value,
        },
        {"_id": 0},
    ).to_list(2000)
    payments_map = {p["teacher_id"]: p for p in payments_list}

    result_teachers = []
    summary = {
        "total_pendiente": 0.0,
        "total_pagado": 0.0,
        "count_pendiente": 0,
        "count_pagado": 0,
    }

    for t in teachers:
        full_name = t.get("full_name") or f"{t.get('name') or ''} {t.get('last_name') or ''}".strip()
        salary_base = t.get("salary_base")
        existing = payments_map.get(t["id"])
        if existing:
            payment_obj = {
                "id": existing.get("id"),
                "amount": round(float(existing.get("amount", 0) or 0), 2),
                "payment_type": existing.get("payment_type"),
                "status": existing.get("status"),
                "paid_at": existing.get("paid_at"),
                "notes": existing.get("notes"),
                "egreso_id": existing.get("egreso_id"),
            }
            if existing.get("status") == "pagado":
                summary["total_pagado"] += float(existing.get("amount", 0) or 0)
                summary["count_pagado"] += 1
            else:
                summary["total_pendiente"] += float(existing.get("amount", 0) or 0)
                summary["count_pendiente"] += 1
        else:
            default_amount = float(salary_base or 0) if payment_type == PaymentType.sueldo else 0.0
            payment_obj = {
                "id": None,
                "amount": round(default_amount, 2),
                "payment_type": payment_type.value,
                "status": "pendiente",
                "paid_at": None,
                "notes": None,
                "egreso_id": None,
            }
            summary["total_pendiente"] += default_amount
            summary["count_pendiente"] += 1

        result_teachers.append({
            "teacher_id": t["id"],
            "teacher_name": full_name,
            "avatar_url": t.get("avatar_url"),
            "salary_base": round(float(salary_base), 2) if salary_base is not None else None,
            "payment_notes": t.get("payment_notes"),
            "payment": payment_obj,
        })

    # Stable sort by name
    result_teachers.sort(key=lambda x: (x["teacher_name"] or "").lower())

    summary["total_pendiente"] = round(summary["total_pendiente"], 2)
    summary["total_pagado"] = round(summary["total_pagado"], 2)

    return {
        "year": year,
        "month": month,
        "payment_type": payment_type.value,
        "teachers": result_teachers,
        "summary": summary,
        "payment_types": PAYMENT_TYPE_LABELS,
    }


@router.post("/contabilidad/teacher-payments")
async def create_or_update_payment(
    data: TeacherPaymentCreate,
    current_user=Depends(require_section_access("accounting")),
):
    """Upsert a pending teacher payment for (teacher, period, type).
    If a paid record already exists → 409."""
    await _ensure_indexes()
    school_id = current_user["school_id"]

    # Validate that the target user is actually a teacher of this school
    teacher = await db.users.find_one(
        {"id": data.teacher_id, "school_id": school_id, "role": "teacher"},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "full_name": 1},
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Profesor no encontrado en este colegio")

    now_iso = datetime.now(timezone.utc).isoformat()
    query_key = {
        "school_id": school_id,
        "teacher_id": data.teacher_id,
        "period_year": data.period_year,
        "period_month": data.period_month,
        "payment_type": data.payment_type.value,
    }
    existing = await db.teacher_payments.find_one(query_key, {"_id": 0})
    if existing and existing.get("status") == "pagado":
        raise HTTPException(
            status_code=409,
            detail="Este pago ya fue confirmado. No se puede modificar un pago pagado.",
        )

    teacher_name = teacher.get("full_name") or f"{teacher.get('name') or ''} {teacher.get('last_name') or ''}".strip()

    if existing:
        await db.teacher_payments.update_one(
            {"id": existing["id"]},
            {"$set": {
                "amount": round(float(data.amount), 2),
                "notes": data.notes,
                "teacher_name": teacher_name,
                "updated_at": now_iso,
            }},
        )
        existing.update({
            "amount": round(float(data.amount), 2),
            "notes": data.notes,
            "teacher_name": teacher_name,
            "updated_at": now_iso,
        })
        return {"message": "Pago actualizado", "payment": existing}

    doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "teacher_id": data.teacher_id,
        "teacher_name": teacher_name,
        "period_year": data.period_year,
        "period_month": data.period_month,
        "payment_type": data.payment_type.value,
        "amount": round(float(data.amount), 2),
        "status": "pendiente",
        "paid_at": None,
        "paid_by": None,
        "egreso_id": None,
        "notes": data.notes,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.teacher_payments.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Pago registrado", "payment": doc}


@router.post("/contabilidad/teacher-payments/bulk-create")
async def bulk_create_payments(
    data: BulkCreateRequest,
    current_user=Depends(require_section_access("accounting")),
):
    """Bulk upsert pending payments for a period. Never generates expenses."""
    await _ensure_indexes()
    school_id = current_user["school_id"]
    if not data.items:
        return {"message": "Sin cambios", "created": 0, "updated": 0, "skipped": 0}

    teacher_ids = list({it.teacher_id for it in data.items})
    teachers_cur = db.users.find(
        {"id": {"$in": teacher_ids}, "school_id": school_id, "role": "teacher"},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "full_name": 1},
    )
    teachers = {t["id"]: t for t in await teachers_cur.to_list(5000)}

    now_iso = datetime.now(timezone.utc).isoformat()
    created, updated, skipped = 0, 0, 0
    ids = []

    for item in data.items:
        t = teachers.get(item.teacher_id)
        if not t:
            skipped += 1
            continue
        teacher_name = t.get("full_name") or f"{t.get('name') or ''} {t.get('last_name') or ''}".strip()
        key = {
            "school_id": school_id,
            "teacher_id": item.teacher_id,
            "period_year": data.period_year,
            "period_month": data.period_month,
            "payment_type": data.payment_type.value,
        }
        existing = await db.teacher_payments.find_one(key, {"_id": 0})
        if existing and existing.get("status") == "pagado":
            skipped += 1
            continue
        if existing:
            await db.teacher_payments.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "amount": round(float(item.amount), 2),
                    "teacher_name": teacher_name,
                    "updated_at": now_iso,
                }},
            )
            ids.append(existing["id"])
            updated += 1
        else:
            doc = {
                "id": str(uuid.uuid4()),
                **key,
                "teacher_name": teacher_name,
                "amount": round(float(item.amount), 2),
                "status": "pendiente",
                "paid_at": None,
                "paid_by": None,
                "egreso_id": None,
                "notes": None,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            await db.teacher_payments.insert_one(doc)
            ids.append(doc["id"])
            created += 1

    return {"message": "Pagos procesados", "created": created, "updated": updated, "skipped": skipped, "ids": ids}


@router.post("/contabilidad/teacher-payments/{payment_id}/confirm")
async def confirm_payment(
    payment_id: str,
    current_user=Depends(require_section_access("accounting")),
):
    """Confirm a pending teacher payment: generate mirror expense and mark as paid.
    Uses a best-effort transactional flow: if mirror expense creation fails, the
    payment stays pending (nothing persisted)."""
    school_id = current_user["school_id"]
    payment = await db.teacher_payments.find_one(
        {"id": payment_id, "school_id": school_id}, {"_id": 0}
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if payment.get("status") == "pagado":
        raise HTTPException(status_code=409, detail="Este pago ya fue confirmado")
    if float(payment.get("amount", 0) or 0) <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero para confirmar el pago")

    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    expense_date = now_dt.strftime("%Y-%m-%d")

    # Build expense document matching the existing schema
    year = payment["period_year"]
    month = payment["period_month"]
    pay_type = payment["payment_type"]
    pay_type_label = PAYMENT_TYPE_LABELS.get(pay_type, pay_type.title())
    month_name = MONTH_NAMES_ES[month] if 1 <= month <= 12 else str(month)
    teacher_name = payment.get("teacher_name") or payment.get("teacher_id")
    amount = round(float(payment["amount"]), 2)

    expense_id = str(uuid.uuid4())
    expense_doc = {
        "id": expense_id,
        "school_id": school_id,
        "title": f"Pago a {teacher_name} - {pay_type_label} {month_name} {year}",
        "category": "planilla_docente",
        "description": payment.get("notes"),
        "amount_base": amount,
        "igv_amount": 0,
        "total_amount": amount,
        "igv_applicable": False,
        "igv_percentage": 0,
        "expense_date": expense_date,
        "payment_method": "transferencia",
        "provider_name": teacher_name,
        "notes": payment.get("notes"),
        # Traceability link
        "teacher_payment_id": payment_id,
        "teacher_id": payment.get("teacher_id"),
        "created_by": current_user["id"],
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    # Insert expense first; only then mark payment as paid. If any step fails,
    # we do a best-effort compensating delete.
    try:
        await db.expenses.insert_one(expense_doc)
    except Exception as e:
        logger.error(f"[TEACHER-PAY] expense creation failed: {e}")
        raise HTTPException(status_code=500, detail="No se pudo generar el egreso")

    try:
        upd = await db.teacher_payments.update_one(
            {"id": payment_id, "school_id": school_id, "status": "pendiente"},
            {"$set": {
                "status": "pagado",
                "paid_at": now_iso,
                "paid_by": current_user["id"],
                "egreso_id": expense_id,
                "amount": amount,
                "updated_at": now_iso,
            }},
        )
        if upd.matched_count == 0:
            # Concurrent update — rollback the expense
            await db.expenses.delete_one({"id": expense_id})
            raise HTTPException(status_code=409, detail="El pago ya fue modificado por otro usuario")
    except HTTPException:
        raise
    except Exception as e:
        await db.expenses.delete_one({"id": expense_id})
        logger.error(f"[TEACHER-PAY] payment update failed, rolled back expense: {e}")
        raise HTTPException(status_code=500, detail="No se pudo confirmar el pago")

    expense_doc.pop("_id", None)
    return {
        "message": "Pago confirmado y egreso registrado",
        "payment_id": payment_id,
        "expense_id": expense_id,
        "expense": expense_doc,
    }


@router.delete("/contabilidad/teacher-payments/{payment_id}")
async def delete_payment(
    payment_id: str,
    current_user=Depends(require_section_access("accounting")),
):
    """Delete a pending teacher payment. Paid payments cannot be deleted here."""
    school_id = current_user["school_id"]
    payment = await db.teacher_payments.find_one(
        {"id": payment_id, "school_id": school_id}, {"_id": 0}
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if payment.get("status") == "pagado":
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar un pago ya confirmado. Anula el egreso primero.",
        )
    await db.teacher_payments.delete_one({"id": payment_id, "school_id": school_id})
    return {"message": "Pago eliminado"}


@router.patch("/users/teachers/{teacher_id}/salary")
async def update_teacher_salary(
    teacher_id: str,
    data: SalaryUpdate,
    current_user=Depends(require_section_access("accounting")),
):
    """Set salary_base / payment_notes for a teacher."""
    school_id = current_user["school_id"]
    teacher = await db.users.find_one(
        {"id": teacher_id, "school_id": school_id, "role": "teacher"},
        {"_id": 0, "id": 1},
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    updates = {}
    if data.salary_base is not None:
        updates["salary_base"] = round(float(data.salary_base), 2)
    if data.payment_notes is not None:
        updates["payment_notes"] = data.payment_notes.strip() or None
    if not updates:
        return {"message": "Sin cambios"}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": teacher_id, "school_id": school_id}, {"$set": updates})
    return {"message": "Datos de sueldo actualizados", "updates": updates}
