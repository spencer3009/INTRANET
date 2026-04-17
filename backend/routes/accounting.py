"""
Accounting module: payments, expenses, debtors, concepts
Extracted from server.py during modularization.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Form, UploadFile, File, BackgroundTasks, Request
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import re
import logging

from .core import (
    db, get_current_user, resolve_user_from_token, is_admin_user,
    require_role, require_admin, require_staff, require_section_access,
    is_demo_user, check_demo_user_block, require_not_demo, is_real_owner,
    is_system_user, check_system_user_block, is_protected_user,
    has_role, is_student, is_parent, is_staff,
    can_access_section, get_user_permissions,
    hash_password, verify_password, create_token,
    get_academic_filter,
    JWT_SECRET, JWT_ALGORITHM, now_iso, generate_id,
    ADMIN_ROLES, STAFF_ROLES, ROLE_HIERARCHY,
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# ACCOUNTING MODULE - CONTABILIDAD ESCOLAR (PERÚ)
# ══════════════════════════════════════════════════════════════════════════════

# Peru IGV rate
DEFAULT_IGV_PERCENTAGE = 18

PAYMENT_CONCEPTS = {
    "matricula": "Matrícula",
    "mensualidad": "Mensualidad",
    "taller": "Taller",
    "uniforme": "Uniforme",
    "material": "Material escolar",
    "evento": "Evento",
    "otros": "Otros"
}

PAYMENT_METHODS = {
    "efectivo": "Efectivo",
    "transferencia": "Transferencia bancaria",
    "yape": "Yape",
    "plin": "Plin",
    "tarjeta": "Tarjeta"
}

PAYMENT_STATUSES = {
    "pending": {"label": "Pendiente", "color": "#F59E0B"},
    "paid": {"label": "Pagado", "color": "#22C55E"},
    "canceled": {"label": "Anulado", "color": "#EF4444"}
}

EXPENSE_CATEGORIES = {
    "servicios": "Servicios (luz, agua, internet)",
    "personal": "Personal y planilla",
    "mantenimiento": "Mantenimiento",
    "materiales": "Materiales y suministros",
    "otros": "Otros gastos"
}

class ConceptItem(BaseModel):
    concepto: str
    monto: float = Field(..., gt=0)

class PaymentCreate(BaseModel):
    student_id: str
    grade_id: str
    section_id: str
    concept: Optional[str] = None
    conceptos: Optional[List[ConceptItem]] = None
    description: Optional[str] = None
    amount_base: Optional[float] = Field(None, gt=0)
    igv_applicable: bool = False
    igv_percentage: float = DEFAULT_IGV_PERCENTAGE
    payment_method: str
    payment_status: Literal["pending", "paid"] = "pending"
    payment_date: Optional[str] = None
    pension_month: Optional[str] = None  # YYYY-MM format
    receipt_number: Optional[str] = None
    notes: Optional[str] = None
    interest_amount: Optional[float] = 0
    discount_amount: Optional[float] = 0

class PaymentUpdate(BaseModel):
    concept: Optional[str] = None
    description: Optional[str] = None
    amount_base: Optional[float] = Field(None, gt=0)
    igv_applicable: Optional[bool] = None
    igv_percentage: Optional[float] = None
    payment_method: Optional[str] = None
    payment_date: Optional[str] = None
    pension_month: Optional[str] = None  # YYYY-MM format
    receipt_number: Optional[str] = None
    notes: Optional[str] = None

class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: str
    description: Optional[str] = None
    amount_base: float = Field(..., gt=0)
    igv_applicable: bool = False
    igv_percentage: float = DEFAULT_IGV_PERCENTAGE
    expense_date: str
    payment_method: str
    provider_name: Optional[str] = None
    notes: Optional[str] = None

class ExpenseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = None
    description: Optional[str] = None
    amount_base: Optional[float] = Field(None, gt=0)
    igv_applicable: Optional[bool] = None
    igv_percentage: Optional[float] = None
    expense_date: Optional[str] = None
    payment_method: Optional[str] = None
    provider_name: Optional[str] = None
    notes: Optional[str] = None

def calculate_igv(amount_base: float, igv_applicable: bool, igv_percentage: float) -> dict:
    """Calculate IGV amounts for Peru"""
    if not igv_applicable:
        return {
            "amount_base": round(amount_base, 2),
            "igv_amount": 0,
            "total_amount": round(amount_base, 2)
        }
    
    igv_amount = round(amount_base * (igv_percentage / 100), 2)
    total_amount = round(amount_base + igv_amount, 2)
    
    return {
        "amount_base": round(amount_base, 2),
        "igv_amount": igv_amount,
        "total_amount": total_amount
    }

# ─────────────────────────────────────────────────────────────────────────────
# PAYMENTS (INGRESOS)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/accounting/payments")
async def get_payments(
    status: Optional[str] = None,
    concept: Optional[str] = None,
    grade_id: Optional[str] = None,
    student_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user = Depends(require_section_access("accounting"))
):
    """Get all payments (ingresos) for the school. RBAC protected."""
    user = current_user  # Already validated by require_section_access
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if status:
        query["payment_status"] = status
    if concept:
        query["concept"] = concept
    if grade_id:
        query["grade_id"] = grade_id
    if student_id:
        query["student_id"] = student_id
    if date_from:
        query["payment_date"] = {"$gte": date_from}
    if date_to:
        if "payment_date" in query:
            query["payment_date"]["$lte"] = date_to
        else:
            query["payment_date"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    total = await db.payments.count_documents(query)
    
    payments_cursor = db.payments.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    payments = await payments_cursor.to_list(limit)
    
    # Enrich with student, grade, section names
    students_cache = {}
    grades_cache = {}
    sections_cache = {}
    
    for payment in payments:
        # Student info
        if payment["student_id"] not in students_cache:
            student = await db.users.find_one({"id": payment["student_id"]}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
            students_cache[payment["student_id"]] = student
        student_info = students_cache[payment["student_id"]]
        payment["student_name"] = f"{student_info.get('name', '')} {student_info.get('last_name', '')}".strip() if student_info else "Desconocido"
        payment["student_photo"] = student_info.get("photo_url", "") if student_info else ""
        
        # Grade info
        if payment["grade_id"] not in grades_cache:
            grade = await db.grades.find_one({"id": payment["grade_id"]}, {"_id": 0, "nombre": 1, "nivel_nombre": 1})
            grades_cache[payment["grade_id"]] = grade
        grade_info = grades_cache[payment["grade_id"]]
        payment["grade_name"] = f"{grade_info.get('nivel_nombre', '')} - {grade_info.get('nombre', '')}" if grade_info else "Sin grado"
        
        # Section info
        if payment["section_id"] not in sections_cache:
            section = await db.sections.find_one({"id": payment["section_id"]}, {"_id": 0, "nombre": 1})
            sections_cache[payment["section_id"]] = section
        section_info = sections_cache[payment["section_id"]]
        payment["section_name"] = section_info.get("nombre") if section_info else "Sin sección"
        
        # Labels
        conceptos_arr = payment.get("conceptos", [])
        if conceptos_arr and len(conceptos_arr) > 1:
            first_label = conceptos_arr[0]["concepto"]
            extra = len(conceptos_arr) - 1
            payment["concept_label"] = f"{first_label} +{extra} más"
            payment["concept_label_full"] = " + ".join(c["concepto"] for c in conceptos_arr)
        else:
            payment["concept_label"] = PAYMENT_CONCEPTS.get(payment.get("concept", ""), payment.get("concept", ""))
            payment["concept_label_full"] = payment["concept_label"]
        payment["method_label"] = PAYMENT_METHODS.get(payment.get("payment_method", ""), payment.get("payment_method", ""))
        payment["status_label"] = PAYMENT_STATUSES.get(payment.get("payment_status", ""), {}).get("label", "")
        payment["status_color"] = PAYMENT_STATUSES.get(payment.get("payment_status", ""), {}).get("color", "#64748B")
        # Add pension_month label
        pm = payment.get("pension_month")
        if pm and len(pm) >= 7:
            month_num = pm[5:7]
            month_labels = {"01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May", "06": "Jun", "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic"}
            payment["pension_month_label"] = f"{month_labels.get(month_num, month_num)} {pm[:4]}"
        else:
            payment["pension_month_label"] = ""
    
    # Enrich with boleta info (batch lookup)
    payment_ids = [p["id"] for p in payments]
    boletas_cursor = db.boletas_internas.find(
        {"ingreso_id": {"$in": payment_ids}, "school_id": school_id},
        {"_id": 0, "ingreso_id": 1, "numero_completo": 1, "anulada": 1, "id": 1}
    )
    boletas_map = {}
    async for b in boletas_cursor:
        boletas_map[b["ingreso_id"]] = b
    
    for payment in payments:
        b = boletas_map.get(payment["id"])
        if b:
            payment["boleta_disponible"] = True
            payment["numero_boleta"] = b["numero_completo"]
            payment["boleta_anulada"] = b.get("anulada", False)
        else:
            payment["boleta_disponible"] = False
            payment["numero_boleta"] = None
            payment["boleta_anulada"] = False
    
    return {
        "payments": payments,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@router.post("/accounting/payments")
async def create_payment(data: PaymentCreate, current_user = Depends(require_section_access("accounting"))):
    """Create a new payment (ingreso). Supports single concept or multiple concepts array. RBAC protected."""
    user = current_user
    school_id = user["school_id"]
    
    # Verify student exists
    student = await db.users.find_one({"id": data.student_id, "school_id": school_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=400, detail="Estudiante no encontrado")
    
    # Determine if multi-concept or single-concept mode
    if data.conceptos and len(data.conceptos) > 0:
        # Multi-concept mode
        conceptos_list = [{"concepto": c.concepto, "monto": round(c.monto, 2)} for c in data.conceptos]
        total_base = round(sum(c["monto"] for c in conceptos_list), 2)
        concept_label = " + ".join(c["concepto"] for c in conceptos_list)
        concept_key = conceptos_list[0]["concepto"] if len(conceptos_list) == 1 else concept_label
    else:
        # Single concept mode (backward compatible)
        if not data.concept:
            raise HTTPException(status_code=400, detail="Debe especificar al menos un concepto")
        if not data.amount_base or data.amount_base <= 0:
            raise HTTPException(status_code=400, detail="Monto base debe ser mayor a 0")
        conceptos_list = [{"concepto": data.concept, "monto": round(data.amount_base, 2)}]
        total_base = round(data.amount_base, 2)
        concept_key = data.concept
    
    # Apply interest and discount to the base amount
    interest_amt = round(data.interest_amount or 0, 2)
    discount_amt = round(data.discount_amount or 0, 2)
    adjusted_base = round(total_base - discount_amt + interest_amt, 2)
    
    # Calculate IGV on adjusted base
    amounts = calculate_igv(adjusted_base, data.igv_applicable, data.igv_percentage)
    
    now = datetime.now(timezone.utc).isoformat()
    
    payment = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "student_id": data.student_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "concept": concept_key,
        "conceptos": conceptos_list,
        "description": data.description,
        "amount_base": amounts["amount_base"],
        "igv_amount": amounts["igv_amount"],
        "total_amount": amounts["total_amount"],
        "igv_applicable": data.igv_applicable,
        "igv_percentage": data.igv_percentage if data.igv_applicable else 0,
        "interest_amount": interest_amt,
        "discount_amount": discount_amt,
        "subtotal_conceptos": total_base,
        "payment_method": data.payment_method,
        "payment_status": data.payment_status,
        "payment_date": data.payment_date or now[:10],
        "pension_month": data.pension_month,
        "receipt_number": data.receipt_number,
        "notes": data.notes,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.payments.insert_one(payment)
    payment.pop("_id", None)
    
    # Auto-delete existing pending payments for the same student/concept/month
    # (physically remove + log to payments_log for traceability)
    deleted_count = 0
    for c_item in conceptos_list:
        c_name = c_item["concepto"].lower()
        is_matricula = "matricula" in c_name or "matrícula" in c_name
        
        cancel_query = {
            "school_id": school_id,
            "student_id": data.student_id,
            "payment_status": "pending",
            "id": {"$ne": payment["id"]},
        }
        
        if is_matricula:
            cancel_query["$or"] = [
                {"concept": {"$regex": "matricula", "$options": "i"}},
                {"conceptos.concepto": {"$regex": "matricula", "$options": "i"}},
            ]
        else:
            cancel_query["$or"] = [
                {"concept": {"$regex": c_name, "$options": "i"}},
                {"conceptos.concepto": {"$regex": c_name, "$options": "i"}},
            ]
            if data.pension_month:
                cancel_query["pension_month"] = data.pension_month
        
        # Find pending payments to delete, log them, then delete
        pending_to_delete = await db.payments.find(cancel_query, {"_id": 0}).to_list(100)
        if pending_to_delete:
            logs = [{
                "school_id": p.get("school_id"),
                "student_id": p.get("student_id"),
                "concepto": p.get("concept"),
                "mes": p.get("pension_month", ""),
                "monto": p.get("total_amount"),
                "payment_id_original": p.get("id"),
                "accion": "auto_eliminado",
                "razon": f"Reemplazado por pago consolidado {payment['id']}",
                "eliminado_at": datetime.now(timezone.utc).isoformat(),
            } for p in pending_to_delete]
            await db.payments_log.insert_many(logs)
            
            ids_to_delete = [p["id"] for p in pending_to_delete]
            result = await db.payments.delete_many({"id": {"$in": ids_to_delete}})
            deleted_count += result.deleted_count
    
    if deleted_count > 0:
        logger.info(f"[AUTO-DELETE] {deleted_count} pending payments deleted for student {data.student_id} (replaced by {payment['id']})")
    
    # Auto-update student status based on payment concept
    if data.payment_status == "paid":
        for c_item in conceptos_list:
            await auto_update_student_status_on_payment(data.student_id, school_id, c_item["concepto"])
    
    # Enrich response
    payment["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
    payment["concept_label"] = concept_key
    payment["method_label"] = PAYMENT_METHODS.get(data.payment_method, data.payment_method)
    payment["status_label"] = PAYMENT_STATUSES.get(data.payment_status, {}).get("label", "")
    payment["status_color"] = PAYMENT_STATUSES.get(data.payment_status, {}).get("color", "#64748B")
    
    logger.info(f"Payment created: {payment['id']} - S/{payment['total_amount']} ({len(conceptos_list)} concepts) by {user['id']}")
    
    # Emit boleta if config exists
    boleta_info = None
    try:
        from routes.boletas import emitir_boleta_para_ingreso
        boleta_info = await emitir_boleta_para_ingreso(payment, school_id, user)
    except Exception as e:
        logger.warning(f"Error emitting boleta for payment {payment['id']}: {e}")
    
    if boleta_info:
        payment["boleta_disponible"] = True
        payment["boleta_id"] = boleta_info["boleta_id"]
        payment["numero_boleta"] = boleta_info["numero_boleta"]
    else:
        payment["boleta_disponible"] = False
    
    return {"message": "Pago registrado correctamente", "payment": payment, "deleted_pending": deleted_count}

@router.put("/accounting/payments/{payment_id}")
async def update_payment(payment_id: str, data: PaymentUpdate, current_user = Depends(require_section_access("accounting"))):
    """Update a payment. RBAC protected."""
    user = current_user  # Already validated by require_section_access
    school_id = user["school_id"]
    
    payment = await db.payments.find_one({"id": payment_id, "school_id": school_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    # Cannot edit canceled payments
    if payment.get("payment_status") == "canceled":
        raise HTTPException(status_code=400, detail="No se puede editar un pago anulado")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Copy existing values for recalculation
    amount_base = payment["amount_base"]
    igv_applicable = payment["igv_applicable"]
    igv_percentage = payment.get("igv_percentage", DEFAULT_IGV_PERCENTAGE)
    
    if data.amount_base is not None:
        amount_base = data.amount_base
    if data.igv_applicable is not None:
        igv_applicable = data.igv_applicable
    if data.igv_percentage is not None:
        igv_percentage = data.igv_percentage
    
    # Recalculate amounts
    amounts = calculate_igv(amount_base, igv_applicable, igv_percentage)
    update_data.update(amounts)
    update_data["igv_applicable"] = igv_applicable
    update_data["igv_percentage"] = igv_percentage if igv_applicable else 0
    
    # Other fields
    if data.concept is not None:
        update_data["concept"] = data.concept
    if data.description is not None:
        update_data["description"] = data.description
    if data.payment_method is not None:
        update_data["payment_method"] = data.payment_method
    if data.payment_date is not None:
        update_data["payment_date"] = data.payment_date
    if data.receipt_number is not None:
        update_data["receipt_number"] = data.receipt_number
    if data.notes is not None:
        update_data["notes"] = data.notes
    if data.pension_month is not None:
        update_data["pension_month"] = data.pension_month
    
    await db.payments.update_one({"id": payment_id}, {"$set": update_data})
    
    updated_payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    
    logger.info(f"Payment updated: {payment_id} by {user['id']}")
    
    return {"message": "Pago actualizado correctamente", "payment": updated_payment}

@router.put("/accounting/payments/{payment_id}/confirm")
async def confirm_payment(payment_id: str, current_user = Depends(require_section_access("accounting"))):
    """Confirm a pending payment. Auto-calculates interest (mora) if applicable. RBAC protected."""
    user = current_user
    school_id = user["school_id"]
    
    payment = await db.payments.find_one({"id": payment_id, "school_id": school_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    if payment.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="El pago ya está confirmado")
    if payment.get("payment_status") == "canceled":
        raise HTTPException(status_code=400, detail="No se puede confirmar un pago anulado")
    
    today_str = datetime.now(timezone.utc).isoformat()[:10]
    update_fields = {
        "payment_status": "paid",
        "payment_date": today_str,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Auto-calculate interest (mora) for mensualidad payments
    interest_amount = 0
    concept = (payment.get("concept") or "").lower()
    is_mensualidad = "mensualidad" in concept
    # Also check conceptos array
    conceptos = payment.get("conceptos") or []
    if not is_mensualidad:
        for c in conceptos:
            if "mensualidad" in (c.get("concepto") or "").lower():
                is_mensualidad = True
                break
    
    if is_mensualidad and payment.get("pension_month"):
        fs = await db.school_financial_settings.find_one({"school_id": school_id}, {"_id": 0})
        if fs and fs.get("interes_activo"):
            dia_vencimiento = int(fs.get("pronto_pago_fecha_limite") or fs.get("dia_vencimiento_mensualidad") or 5)
            interes_tipo = fs.get("interes_tipo", "porcentaje")
            interes_valor = float(fs.get("interes_valor") or 0)
            
            if interes_valor > 0:
                pm = payment["pension_month"]
                try:
                    year, month = int(pm[:4]), int(pm[5:7])
                    deadline = datetime(year, month, dia_vencimiento, tzinfo=timezone.utc)
                    today = datetime.now(timezone.utc)
                    days_late = max((today - deadline).days, 0)
                    
                    if days_late > 0:
                        # Calculate interest only on mensualidad portion
                        mensualidad_base = 0
                        for c in conceptos:
                            if "mensualidad" in (c.get("concepto") or "").lower():
                                mensualidad_base += c.get("monto", 0)
                        if mensualidad_base == 0:
                            mensualidad_base = payment.get("amount_base", 0)
                        
                        if interes_tipo == "porcentaje":
                            daily_rate = interes_valor / 30 / 100
                            interest_amount = round(mensualidad_base * daily_rate * days_late, 2)
                        else:
                            daily_fixed = interes_valor / 30
                            interest_amount = round(daily_fixed * days_late, 2)
                        
                        if interest_amount > 0:
                            new_base = round(payment.get("amount_base", 0) + interest_amount, 2)
                            igv_applicable = payment.get("igv_applicable", False)
                            igv_pct = payment.get("igv_percentage", 0)
                            new_amounts = calculate_igv(new_base, igv_applicable, igv_pct)
                            
                            update_fields["amount_base"] = new_amounts["amount_base"]
                            update_fields["igv_amount"] = new_amounts["igv_amount"]
                            update_fields["total_amount"] = new_amounts["total_amount"]
                            update_fields["interest_amount"] = interest_amount
                            update_fields["interest_days_late"] = days_late
                            
                            logger.info(f"[INTEREST] Payment {payment_id}: +S/{interest_amount} mora ({days_late} days late)")
                except Exception as e:
                    logger.warning(f"Error calculating interest for payment {payment_id}: {e}")
    
    await db.payments.update_one({"id": payment_id}, {"$set": update_fields})
    
    logger.info(f"Payment confirmed: {payment_id} by {user['id']}")
    
    # Emit boleta
    updated_payment = await db.payments.find_one({"id": payment_id, "school_id": school_id}, {"_id": 0})
    boleta_info = None
    try:
        from routes.boletas import emitir_boleta_para_ingreso
        boleta_info = await emitir_boleta_para_ingreso(updated_payment, school_id, user)
    except Exception as e:
        logger.warning(f"Error emitting boleta on confirm for payment {payment_id}: {e}")
    
    result = {"message": "Pago confirmado correctamente", "interest_applied": interest_amount}
    if boleta_info:
        result["boleta_disponible"] = True
        result["boleta_id"] = boleta_info["boleta_id"]
        result["numero_boleta"] = boleta_info["numero_boleta"]
    else:
        result["boleta_disponible"] = False
    
    return result

@router.put("/accounting/payments/{payment_id}/cancel")
async def cancel_payment(payment_id: str, current_user = Depends(require_section_access("accounting"))):
    """Cancel a payment. RBAC protected."""
    user = current_user  # Already validated by require_section_access
    school_id = user["school_id"]
    
    payment = await db.payments.find_one({"id": payment_id, "school_id": school_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    if payment.get("payment_status") == "canceled":
        raise HTTPException(status_code=400, detail="El pago ya está anulado")
    
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "payment_status": "canceled",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Payment canceled: {payment_id} by {user['id']}")
    
    # Auto-annul boleta if exists
    try:
        await db.boletas_internas.update_one(
            {"ingreso_id": payment_id, "school_id": school_id, "anulada": False},
            {"$set": {"anulada": True, "fecha_anulacion": datetime.now(timezone.utc).isoformat()}}
        )
    except Exception as e:
        logger.warning(f"Error annulling boleta for payment {payment_id}: {e}")
    
    return {"message": "Pago anulado correctamente"}



@router.put("/accounting/payments/{payment_id}/reactivate")
async def reactivate_payment(payment_id: str, current_user=Depends(require_section_access("accounting"))):
    """Reactivate a canceled payment back to pending."""
    user = current_user
    school_id = user["school_id"]

    payment = await db.payments.find_one({"id": payment_id, "school_id": school_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    if payment.get("payment_status") != "canceled":
        raise HTTPException(status_code=400, detail="Solo se pueden reactivar pagos anulados")

    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "payment_status": "pending",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    logger.info(f"Payment reactivated: {payment_id} by {user['id']}")
    return {"message": "Pago reactivado como pendiente"}



@router.delete("/accounting/payments/{payment_id}")
async def delete_payment(payment_id: str, current_user=Depends(require_section_access("accounting"))):
    """Permanently delete a payment record."""
    user = current_user
    school_id = user["school_id"]

    payment = await db.payments.find_one({"id": payment_id, "school_id": school_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    await db.payments.delete_one({"id": payment_id, "school_id": school_id})
    logger.info(f"Payment deleted: {payment_id} by {user['id']}")
    return {"message": "Pago eliminado correctamente"}




# ─────────────────────────────────────────────────────────────────────────────
# DEBTORS (MOROSOS) & STUDENT PAYMENT HISTORY
# ─────────────────────────────────────────────────────────────────────────────

PENSION_MONTHS_LABELS = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
}

@router.get("/accounting/period-summary")
async def get_period_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user = Depends(require_section_access("accounting"))
):
    """Get period summary for accounting cards filtered by date range."""
    user = current_user
    school_id = user["school_id"]

    # Payment query
    pay_query = {"school_id": school_id, "payment_status": {"$ne": "canceled"}}
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        pay_query["payment_date"] = date_filter

    pay_pipeline = [
        {"$match": pay_query},
        {"$group": {
            "_id": None,
            "total_income": {"$sum": {"$cond": [{"$eq": ["$payment_status", "paid"]}, "$total_amount", 0]}},
            "total_pending": {"$sum": {"$cond": [{"$eq": ["$payment_status", "pending"]}, "$total_amount", 0]}},
        }}
    ]
    pay_result = await db.payments.aggregate(pay_pipeline).to_list(1)
    total_income = round(pay_result[0]["total_income"], 2) if pay_result else 0
    total_pending = round(pay_result[0]["total_pending"], 2) if pay_result else 0

    # Expense query
    exp_query = {"school_id": school_id}
    if date_from or date_to:
        exp_date_filter = {}
        if date_from:
            exp_date_filter["$gte"] = date_from
        if date_to:
            exp_date_filter["$lte"] = date_to
        exp_query["expense_date"] = exp_date_filter

    exp_pipeline = [
        {"$match": exp_query},
        {"$group": {"_id": None, "total_expenses": {"$sum": "$total_amount"}}}
    ]
    exp_result = await db.expenses.aggregate(exp_pipeline).to_list(1)
    total_expenses = round(exp_result[0]["total_expenses"], 2) if exp_result else 0

    return {
        "total_income": total_income,
        "total_pending": total_pending,
        "total_expenses": total_expenses,
        "total_general": round(total_income + total_pending, 2)
    }

@router.get("/accounting/debtors")
async def get_debtors(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user = Depends(require_section_access("accounting"))
):
    """Get list of students with pending payments (morosos). Shows debt per student."""
    user = current_user
    school_id = user["school_id"]
    
    # Get all non-canceled payments grouped by student
    match_query = {"school_id": school_id, "payment_status": {"$ne": "canceled"}}
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        match_query["payment_date"] = date_filter

    pipeline = [
        {"$match": match_query},
        {"$group": {
            "_id": "$student_id",
            "total_paid": {"$sum": {"$cond": [{"$eq": ["$payment_status", "paid"]}, "$total_amount", 0]}},
            "total_pending": {"$sum": {"$cond": [{"$eq": ["$payment_status", "pending"]}, "$total_amount", 0]}},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$payment_status", "paid"]}, 1, 0]}},
            "pending_count": {"$sum": {"$cond": [{"$eq": ["$payment_status", "pending"]}, 1, 0]}},
            "paid_months": {"$addToSet": {"$cond": [
                {"$and": [{"$eq": ["$payment_status", "paid"]}, {"$eq": ["$concept", "mensualidad"]}]},
                "$pension_month", "$$REMOVE"
            ]}},
            "pending_months": {"$addToSet": {"$cond": [
                {"$and": [{"$eq": ["$payment_status", "pending"]}, {"$eq": ["$concept", "mensualidad"]}]},
                "$pension_month", "$$REMOVE"
            ]}},
            "last_payment_date": {"$max": {"$cond": [{"$eq": ["$payment_status", "paid"]}, "$payment_date", None]}},
            "grade_id": {"$first": "$grade_id"},
            "section_id": {"$first": "$section_id"}
        }},
        {"$sort": {"total_pending": -1}}
    ]
    
    results = await db.payments.aggregate(pipeline).to_list(500)
    
    # Enrich with student/grade/section names
    debtors = []
    all_students_with_payments = set()
    students_al_dia = 0
    total_debt = 0
    
    for r in results:
        all_students_with_payments.add(r["_id"])
        student = await db.users.find_one({"id": r["_id"]}, {"_id": 0, "name": 1, "last_name": 1})
        grade = await db.grades.find_one({"id": r.get("grade_id")}, {"_id": 0, "nombre": 1, "nivel_nombre": 1})
        section = await db.sections.find_one({"id": r.get("section_id")}, {"_id": 0, "nombre": 1})
        
        pending_months_clean = [m for m in r.get("pending_months", []) if m]
        pending_months_labels = []
        for pm in sorted(pending_months_clean):
            if pm and len(pm) >= 7:
                month_num = pm[5:7]
                pending_months_labels.append(f"{PENSION_MONTHS_LABELS.get(month_num, month_num)} {pm[:4]}")
        
        is_moroso = r["pending_count"] > 0
        if is_moroso:
            total_debt += r["total_pending"]
        else:
            students_al_dia += 1
        
        debtors.append({
            "student_id": r["_id"],
            "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Desconocido",
            "grade_name": f"{grade.get('nivel_nombre', '')} - {grade.get('nombre', '')}" if grade else "Sin grado",
            "section_name": section.get("nombre") if section else "Sin sección",
            "total_paid": round(r["total_paid"], 2),
            "total_pending": round(r["total_pending"], 2),
            "paid_count": r["paid_count"],
            "pending_count": r["pending_count"],
            "pending_months": pending_months_labels,
            "last_payment_date": r.get("last_payment_date"),
            "status": "moroso" if is_moroso else "al_dia"
        })
    
    morosos_count = len([d for d in debtors if d["status"] == "moroso"])
    
    return {
        "debtors": debtors,
        "summary": {
            "morosos_count": morosos_count,
            "al_dia_count": students_al_dia,
            "total_debt": round(total_debt, 2),
            "total_students_with_payments": len(all_students_with_payments)
        }
    }

@router.get("/accounting/student-history/{student_id}")
async def get_student_payment_history(
    student_id: str,
    current_user = Depends(require_section_access("accounting"))
):
    """Get full payment history for a specific student."""
    user = current_user
    school_id = user["school_id"]
    
    student = await db.users.find_one({"id": student_id, "school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "last_name": 1})
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    
    payments = await db.payments.find(
        {"student_id": student_id, "school_id": school_id, "payment_status": {"$ne": "canceled"}},
        {"_id": 0}
    ).sort("pension_month", 1).to_list(200)
    
    # Group by concept type
    matriculas = []
    mensualidades = []
    otros = []
    total_paid = 0
    total_pending = 0
    
    for p in payments:
        entry = {
            "id": p["id"],
            "concept": p["concept"],
            "concept_label": PAYMENT_CONCEPTS.get(p.get("concept", ""), p.get("concept", "")),
            "pension_month": p.get("pension_month"),
            "pension_month_label": "",
            "amount": p.get("total_amount", p.get("amount_base", 0)),
            "status": p.get("payment_status", "pending"),
            "payment_date": p.get("payment_date"),
            "payment_method": PAYMENT_METHODS.get(p.get("payment_method", ""), p.get("payment_method", "")),
        }
        
        if p.get("pension_month") and len(p["pension_month"]) >= 7:
            month_num = p["pension_month"][5:7]
            entry["pension_month_label"] = f"{PENSION_MONTHS_LABELS.get(month_num, month_num)} {p['pension_month'][:4]}"
        
        if p["payment_status"] == "paid":
            total_paid += entry["amount"]
        else:
            total_pending += entry["amount"]
        
        if p["concept"] == "matricula":
            matriculas.append(entry)
        elif p["concept"] == "mensualidad":
            mensualidades.append(entry)
        else:
            otros.append(entry)
    
    return {
        "student": {"id": student["id"], "name": f"{student.get('name', '')} {student.get('last_name', '')}".strip()},
        "matriculas": matriculas,
        "mensualidades": mensualidades,
        "otros": otros,
        "totals": {
            "total_paid": round(total_paid, 2),
            "total_pending": round(total_pending, 2),
            "total": round(total_paid + total_pending, 2)
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSES (EGRESOS)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/accounting/expenses")
async def get_expenses(
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user = Depends(require_section_access("accounting"))
):
    """Get all expenses (egresos) for the school. RBAC protected."""
    user = current_user  # Already validated by require_section_access
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if category:
        query["category"] = category
    if date_from:
        query["expense_date"] = {"$gte": date_from}
    if date_to:
        if "expense_date" in query:
            query["expense_date"]["$lte"] = date_to
        else:
            query["expense_date"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    total = await db.expenses.count_documents(query)
    
    expenses_cursor = db.expenses.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    expenses = await expenses_cursor.to_list(limit)
    
    for expense in expenses:
        expense["category_label"] = EXPENSE_CATEGORIES.get(expense.get("category", ""), expense.get("category", ""))
        expense["method_label"] = PAYMENT_METHODS.get(expense.get("payment_method", ""), expense.get("payment_method", ""))
    
    return {
        "expenses": expenses,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@router.post("/accounting/expenses")
async def create_expense(data: ExpenseCreate, current_user = Depends(require_section_access("accounting"))):
    """Create a new expense (egreso). RBAC protected."""
    user = current_user  # Already validated by require_section_access
    school_id = user["school_id"]
    
    # Calculate IGV
    amounts = calculate_igv(data.amount_base, data.igv_applicable, data.igv_percentage)
    
    now = datetime.now(timezone.utc).isoformat()
    
    expense = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "title": data.title.strip(),
        "category": data.category,
        "description": data.description,
        "amount_base": amounts["amount_base"],
        "igv_amount": amounts["igv_amount"],
        "total_amount": amounts["total_amount"],
        "igv_applicable": data.igv_applicable,
        "igv_percentage": data.igv_percentage if data.igv_applicable else 0,
        "expense_date": data.expense_date,
        "payment_method": data.payment_method,
        "provider_name": data.provider_name,
        "notes": data.notes,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.expenses.insert_one(expense)
    expense.pop("_id", None)
    
    expense["category_label"] = EXPENSE_CATEGORIES.get(data.category, data.category)
    expense["method_label"] = PAYMENT_METHODS.get(data.payment_method, data.payment_method)
    
    logger.info(f"Expense created: {expense['id']} - S/{expense['total_amount']} by {user['id']}")
    
    return {"message": "Egreso registrado correctamente", "expense": expense}

@router.put("/accounting/expenses/{expense_id}")
async def update_expense(expense_id: str, data: ExpenseUpdate, current_user = Depends(require_section_access("accounting"))):
    """Update an expense. RBAC protected."""
    user = current_user  # Already validated by require_section_access
    school_id = user["school_id"]
    
    expense = await db.expenses.find_one({"id": expense_id, "school_id": school_id})
    if not expense:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Handle amount recalculation
    amount_base = expense["amount_base"]
    igv_applicable = expense["igv_applicable"]
    igv_percentage = expense.get("igv_percentage", DEFAULT_IGV_PERCENTAGE)
    
    if data.amount_base is not None:
        amount_base = data.amount_base
    if data.igv_applicable is not None:
        igv_applicable = data.igv_applicable
    if data.igv_percentage is not None:
        igv_percentage = data.igv_percentage
    
    amounts = calculate_igv(amount_base, igv_applicable, igv_percentage)
    update_data.update(amounts)
    update_data["igv_applicable"] = igv_applicable
    update_data["igv_percentage"] = igv_percentage if igv_applicable else 0
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.category is not None:
        update_data["category"] = data.category
    if data.description is not None:
        update_data["description"] = data.description
    if data.expense_date is not None:
        update_data["expense_date"] = data.expense_date
    if data.payment_method is not None:
        update_data["payment_method"] = data.payment_method
    if data.provider_name is not None:
        update_data["provider_name"] = data.provider_name
    if data.notes is not None:
        update_data["notes"] = data.notes
    
    await db.expenses.update_one({"id": expense_id}, {"$set": update_data})
    
    updated_expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    
    logger.info(f"Expense updated: {expense_id} by {user['id']}")
    
    return {"message": "Egreso actualizado correctamente", "expense": updated_expense}

@router.delete("/accounting/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user = Depends(require_section_access("accounting"))):
    """Delete an expense. RBAC protected."""
    user = current_user  # Already validated by require_section_access
    school_id = user["school_id"]
    
    result = await db.expenses.delete_one({"id": expense_id, "school_id": school_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    
    logger.info(f"Expense deleted: {expense_id} by {user['id']}")
    
    return {"message": "Egreso eliminado correctamente"}

# ─────────────────────────────────────────────────────────────────────────────
# ACCOUNTING SUMMARY (DASHBOARD)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/accounting/summary")
async def get_accounting_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user = Depends(require_section_access("accounting"))
):
    """Get accounting summary for dashboard. RBAC protected."""
    user = current_user  # Already validated by require_section_access
    school_id = user["school_id"]
    
    # Default to current year/month
    now = datetime.now(timezone.utc)
    if not year:
        year = now.year
    if not month:
        month = now.month
    
    # Build date range for the month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    # Payments aggregation
    payments_pipeline = [
        {"$match": {
            "school_id": school_id,
            "payment_date": {"$gte": start_date, "$lt": end_date}
        }},
        {"$group": {
            "_id": "$payment_status",
            "total": {"$sum": "$total_amount"},
            "base": {"$sum": "$amount_base"},
            "igv": {"$sum": "$igv_amount"},
            "count": {"$sum": 1}
        }}
    ]
    
    payments_agg = await db.payments.aggregate(payments_pipeline).to_list(10)
    
    # Process payments results
    ingresos_confirmados = 0
    ingresos_base = 0
    ingresos_igv = 0
    pagos_pendientes = 0
    pagos_pendientes_count = 0
    pagos_confirmados_count = 0
    pagos_anulados_count = 0
    
    for item in payments_agg:
        if item["_id"] == "paid":
            ingresos_confirmados = item["total"]
            ingresos_base = item["base"]
            ingresos_igv = item["igv"]
            pagos_confirmados_count = item["count"]
        elif item["_id"] == "pending":
            pagos_pendientes = item["total"]
            pagos_pendientes_count = item["count"]
        elif item["_id"] == "canceled":
            pagos_anulados_count = item["count"]
    
    # Expenses aggregation
    expenses_pipeline = [
        {"$match": {
            "school_id": school_id,
            "expense_date": {"$gte": start_date, "$lt": end_date}
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$total_amount"},
            "base": {"$sum": "$amount_base"},
            "igv": {"$sum": "$igv_amount"},
            "count": {"$sum": 1}
        }}
    ]
    
    expenses_agg = await db.expenses.aggregate(expenses_pipeline).to_list(1)
    
    egresos_totales = 0
    egresos_base = 0
    egresos_igv = 0
    egresos_count = 0
    
    if expenses_agg:
        egresos_totales = expenses_agg[0]["total"]
        egresos_base = expenses_agg[0]["base"]
        egresos_igv = expenses_agg[0]["igv"]
        egresos_count = expenses_agg[0]["count"]
    
    # Calculate balance
    balance = round(ingresos_confirmados - egresos_totales, 2)
    
    # Get recent transactions
    recent_payments = await db.payments.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Enrich recent payments
    for p in recent_payments:
        student = await db.users.find_one({"id": p["student_id"]}, {"_id": 0, "name": 1, "last_name": 1})
        p["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Desconocido"
        p["concept_label"] = PAYMENT_CONCEPTS.get(p.get("concept", ""), p.get("concept", ""))
        p["status_label"] = PAYMENT_STATUSES.get(p.get("payment_status", ""), {}).get("label", "")
        p["status_color"] = PAYMENT_STATUSES.get(p.get("payment_status", ""), {}).get("color", "#64748B")
    
    recent_expenses = await db.expenses.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    for e in recent_expenses:
        e["category_label"] = EXPENSE_CATEGORIES.get(e.get("category", ""), e.get("category", ""))
    
    # Monthly evolution data (last 6 months of income)
    month_labels = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    evolution_data = []
    for i in range(5, -1, -1):
        evo_month = month - i
        evo_year = year
        while evo_month <= 0:
            evo_month += 12
            evo_year -= 1
        evo_start = f"{evo_year}-{evo_month:02d}-01"
        if evo_month == 12:
            evo_end = f"{evo_year + 1}-01-01"
        else:
            evo_end = f"{evo_year}-{evo_month + 1:02d}-01"
        
        evo_pipeline = [
            {"$match": {"school_id": school_id, "payment_date": {"$gte": evo_start, "$lt": evo_end}, "payment_status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}, "count": {"$sum": 1}}}
        ]
        evo_agg = await db.payments.aggregate(evo_pipeline).to_list(1)
        
        exp_pipeline = [
            {"$match": {"school_id": school_id, "expense_date": {"$gte": evo_start, "$lt": evo_end}}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]
        exp_agg = await db.expenses.aggregate(exp_pipeline).to_list(1)
        
        evolution_data.append({
            "month": f"{month_labels[evo_month]} {evo_year}",
            "ingresos": round(evo_agg[0]["total"], 2) if evo_agg else 0,
            "egresos": round(exp_agg[0]["total"], 2) if exp_agg else 0,
        })
    
    return {
        "period": {
            "year": year,
            "month": month,
            "month_name": ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][month]
        },
        "ingresos": {
            "total": round(ingresos_confirmados, 2),
            "base": round(ingresos_base, 2),
            "igv": round(ingresos_igv, 2),
            "count": pagos_confirmados_count
        },
        "egresos": {
            "total": round(egresos_totales, 2),
            "base": round(egresos_base, 2),
            "igv": round(egresos_igv, 2),
            "count": egresos_count
        },
        "pendientes": {
            "total": round(pagos_pendientes, 2),
            "count": pagos_pendientes_count
        },
        "anulados": {
            "count": pagos_anulados_count
        },
        "balance": balance,
        "evolution": evolution_data,
        "recent_payments": recent_payments,
        "recent_expenses": recent_expenses
    }

# ══════════════════════════════════════════════════════════════════════════════
# FINANCIAL SETTINGS (CONFIGURACIÓN FINANCIERA)
# ══════════════════════════════════════════════════════════════════════════════

class FinancialSettingsUpdate(BaseModel):
    pension_mensual: Optional[float] = None
    matricula: Optional[float] = None
    pronto_pago_activo: Optional[bool] = None
    pronto_pago_monto: Optional[float] = None
    pronto_pago_fecha_limite: Optional[int] = None
    pronto_pago_modalidad: Optional[str] = None  # "monto_fijo" | "porcentaje"
    interes_activo: Optional[bool] = None
    interes_tipo: Optional[str] = None
    interes_valor: Optional[float] = None
    interes_frecuencia: Optional[str] = None  # "mensual" | "diario"
    interes_modalidad: Optional[str] = None   # "monto_fijo" | "porcentaje"
    interes_tope_maximo: Optional[float] = None
    activacion_modo: Optional[str] = None
    dia_vencimiento_mensualidad: Optional[int] = None  # 1-28
    fecha_inicio_ano_escolar: Optional[str] = None  # YYYY-MM-DD
    fecha_fin_ano_escolar: Optional[str] = None  # YYYY-MM-DD

@router.get("/accounting/financial-settings")
async def get_financial_settings(current_user = Depends(require_section_access("accounting"))):
    user = current_user
    school_id = user["school_id"]
    settings = await db.school_financial_settings.find_one({"school_id": school_id}, {"_id": 0})
    if not settings:
        settings = {
            "school_id": school_id,
            "pension_mensual": 0,
            "matricula": 0,
            "pronto_pago_activo": False,
            "pronto_pago_monto": 0,
            "pronto_pago_fecha_limite": 5,
            "pronto_pago_modalidad": "monto_fijo",
            "interes_activo": False,
            "interes_tipo": "porcentaje",
            "interes_valor": 0,
            "interes_frecuencia": "mensual",
            "interes_modalidad": "porcentaje",
            "interes_tope_maximo": 0
        }
    # Retrocompatibility: migrate legacy interes_tipo → frecuencia + modalidad
    if "interes_frecuencia" not in settings:
        tipo = settings.get("interes_tipo", "porcentaje")
        settings["interes_frecuencia"] = "mensual"
        settings["interes_modalidad"] = tipo if tipo in ("monto_fijo", "porcentaje") else "porcentaje"
        settings["interes_tope_maximo"] = settings.get("interes_tope_maximo", 0)
    # Retrocompatibility: add pronto_pago_modalidad if missing
    if "pronto_pago_modalidad" not in settings:
        settings["pronto_pago_modalidad"] = "monto_fijo"
    if "dia_vencimiento_mensualidad" not in settings:
        settings["dia_vencimiento_mensualidad"] = 5
    if "fecha_inicio_ano_escolar" not in settings:
        settings["fecha_inicio_ano_escolar"] = ""
    if "fecha_fin_ano_escolar" not in settings:
        settings["fecha_fin_ano_escolar"] = ""
    return settings

@router.put("/accounting/financial-settings")
async def update_financial_settings(req: FinancialSettingsUpdate, current_user = Depends(require_section_access("accounting"))):
    user = current_user
    school_id = user["school_id"]
    role = user.get("role", "")
    is_owner = user.get("is_owner", False)
    if role not in ("owner", "director", "admin") and not is_owner:
        raise HTTPException(status_code=403, detail="Solo propietarios y administradores pueden editar la configuracion financiera")
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.school_financial_settings.update_one(
        {"school_id": school_id},
        {"$set": {**update_data, "school_id": school_id}},
        upsert=True
    )
    
    # Sync payment concept amounts when financial settings change
    if "matricula" in update_data:
        await db.payment_concepts.update_many(
            {"school_id": school_id, "name": {"$in": ["Matricula", "Matrícula", "matricula"]}},
            {"$set": {"amount": update_data["matricula"], "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    if "pension_mensual" in update_data:
        await db.payment_concepts.update_many(
            {"school_id": school_id, "name": {"$in": ["Mensualidad", "mensualidad"]}},
            {"$set": {"amount": update_data["pension_mensual"], "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # If activation mode changed to ON_CREATE, activate all pending students
    activated_count = 0
    if update_data.get("activacion_modo") == "on_create":
        result = await db.users.update_many(
            {"school_id": school_id, "role": "student", "student_status": "pending"},
            {"$set": {"student_status": "active", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        activated_count = result.modified_count
    
    settings = await db.school_financial_settings.find_one({"school_id": school_id}, {"_id": 0})
    settings["activated_students"] = activated_count
    return settings

# ─────────────────────────────────────────────────────────────────────────────
# PAYMENT CONCEPTS (CONCEPTOS DE PAGO)
# ─────────────────────────────────────────────────────────────────────────────

class PaymentConceptCreate(BaseModel):
    name: str
    amount: float = 0
    concept_type: str = "unico"  # recurrente / unico
    status: str = "active"  # active / inactive

class PaymentConceptUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    concept_type: Optional[str] = None
    status: Optional[str] = None

async def ensure_default_concepts(school_id: str):
    """Seed default concepts (Matrícula, Mensualidad) if none exist."""
    count = await db.payment_concepts.count_documents({"school_id": school_id})
    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        # Try to read amounts from financial settings
        fin = await db.school_financial_settings.find_one({"school_id": school_id}, {"_id": 0})
        mat_amount = fin.get("matricula", 0) if fin else 0
        pen_amount = fin.get("pension_mensual", 0) if fin else 0
        defaults = [
            {"id": str(uuid.uuid4()), "school_id": school_id, "name": "Matricula", "amount": mat_amount, "concept_type": "unico", "status": "active", "is_default": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "school_id": school_id, "name": "Mensualidad", "amount": pen_amount, "concept_type": "recurrente", "status": "active", "is_default": True, "created_at": now, "updated_at": now},
        ]
        await db.payment_concepts.insert_many(defaults)

@router.get("/accounting/payment-concepts")
async def get_payment_concepts(
    include_inactive: bool = False,
    current_user=Depends(require_section_access("accounting"))
):
    """Get all payment concepts for the school."""
    school_id = current_user["school_id"]
    await ensure_default_concepts(school_id)
    query = {"school_id": school_id}
    if not include_inactive:
        query["status"] = "active"
    concepts = await db.payment_concepts.find(query, {"_id": 0}).sort([("is_default", -1), ("name", 1)]).to_list(200)
    return {"concepts": concepts}

@router.post("/accounting/payment-concepts")
async def create_payment_concept(data: PaymentConceptCreate, current_user=Depends(require_section_access("accounting"))):
    """Create a new payment concept."""
    user = current_user
    school_id = user["school_id"]
    if user.get("role") not in ("owner", "director", "admin") and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Sin permisos para crear conceptos")
    now = datetime.now(timezone.utc).isoformat()
    concept = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "name": data.name.strip(),
        "amount": round(data.amount, 2),
        "concept_type": data.concept_type,
        "status": data.status,
        "is_default": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.payment_concepts.insert_one(concept)
    concept.pop("_id", None)
    return {"message": "Concepto creado", "concept": concept}

@router.put("/accounting/payment-concepts/{concept_id}")
async def update_payment_concept(concept_id: str, data: PaymentConceptUpdate, current_user=Depends(require_section_access("accounting"))):
    """Update a payment concept."""
    user = current_user
    school_id = user["school_id"]
    if user.get("role") not in ("owner", "director", "admin") and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Sin permisos para editar conceptos")
    existing = await db.payment_concepts.find_one({"id": concept_id, "school_id": school_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Concepto no encontrado")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if existing.get("is_default") and "name" in update_data:
        del update_data["name"]
    if "name" in update_data:
        update_data["name"] = update_data["name"].strip()
    if "amount" in update_data:
        update_data["amount"] = round(update_data["amount"], 2)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.payment_concepts.update_one({"id": concept_id}, {"$set": update_data})
    updated = await db.payment_concepts.find_one({"id": concept_id}, {"_id": 0})
    
    # Sync financial settings when default concepts are updated
    if updated and "amount" in update_data:
        concept_name = (updated.get("name") or "").lower()
        if concept_name in ("matricula", "matrícula"):
            await db.school_financial_settings.update_one(
                {"school_id": school_id},
                {"$set": {"matricula": update_data["amount"], "updated_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True
            )
        elif concept_name == "mensualidad":
            await db.school_financial_settings.update_one(
                {"school_id": school_id},
                {"$set": {"pension_mensual": update_data["amount"], "updated_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True
            )
    
    return {"message": "Concepto actualizado", "concept": updated}

@router.delete("/accounting/payment-concepts/{concept_id}")
async def delete_payment_concept(concept_id: str, current_user=Depends(require_section_access("accounting"))):
    """Delete a payment concept (not allowed for defaults)."""
    user = current_user
    school_id = user["school_id"]
    if user.get("role") not in ("owner", "director", "admin") and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Sin permisos para eliminar conceptos")
    existing = await db.payment_concepts.find_one({"id": concept_id, "school_id": school_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Concepto no encontrado")
    if existing.get("is_default"):
        raise HTTPException(status_code=400, detail="No se puede eliminar un concepto predeterminado. Puedes desactivarlo.")
    await db.payment_concepts.delete_one({"id": concept_id, "school_id": school_id})
    return {"message": "Concepto eliminado"}

# ─────────────────────────────────────────────────────────────────────────────
# STUDENT STATUS MANAGEMENT (ESTADOS DE ESTUDIANTE)
# ─────────────────────────────────────────────────────────────────────────────

STUDENT_STATUSES = {
    "pending": {"label": "Pendiente", "color": "#EAB308"},
    "enrolled": {"label": "Matriculado", "color": "#3B82F6"},
    "active": {"label": "Activo", "color": "#22C55E"},
    "withdrawn": {"label": "Retirado", "color": "#EF4444"},
}

class EnrollStudentRequest(BaseModel):
    grado_id: str
    seccion_id: str
    nivel_id: Optional[str] = None
    turno_id: Optional[str] = None

@router.put("/students/{student_id}/enroll")
async def enroll_student(student_id: str, data: EnrollStudentRequest, current_user=Depends(get_current_user)):
    """Manually enroll a student: assign grade/section and set status to enrolled."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden matricular")
    school_id = user["school_id"]
    student = await db.users.find_one({"id": student_id, "school_id": school_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    
    update = {
        "grado_id": data.grado_id,
        "seccion_id": data.seccion_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if data.nivel_id:
        update["nivel_id"] = data.nivel_id
    if data.turno_id:
        update["turno_id"] = data.turno_id
    
    # Only change to enrolled if currently pending
    current_status = student.get("student_status", "pending")
    if current_status == "pending":
        update["student_status"] = "enrolled"
    
    await db.users.update_one({"id": student_id}, {"$set": update})
    
    # MECANISMO 2: Auto-generate pending payment for current month if financial config exists
    try:
        fin_settings = await db.school_financial_settings.find_one({"school_id": school_id}, {"_id": 0})
        pension = fin_settings.get("pension_mensual", 0) if fin_settings else 0
        if pension and pension > 0:
            current_month = datetime.now(timezone.utc).strftime("%Y-%m")
            await generate_pending_payments_for_school(
                school_id=school_id,
                mes=current_month,
                concepto="mensualidad",
                monto=pension,
                solo_sin_pago=True,
                created_by=user["id"],
            )
    except Exception as e:
        logger.warning(f"[ENROLL] Auto-generate payment failed for student {student_id}: {e}")
    
    return {"message": "Alumno matriculado correctamente", "student_status": update.get("student_status", current_status)}

@router.put("/students/{student_id}/status")
async def update_student_status(student_id: str, current_user=Depends(get_current_user), status: str = ""):
    """Manually change a student's status (e.g., withdraw)."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden cambiar estados")
    if status not in STUDENT_STATUSES:
        raise HTTPException(status_code=400, detail="Estado no válido")
    school_id = user["school_id"]
    student = await db.users.find_one({"id": student_id, "school_id": school_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    await db.users.update_one({"id": student_id}, {"$set": {"student_status": status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": f"Estado cambiado a {STUDENT_STATUSES[status]['label']}", "student_status": status}


@router.put("/students/bulk-set-active")
async def bulk_set_enrolled_to_active(current_user=Depends(get_current_user)):
    """Change all 'enrolled' students to 'active' for the school. Support-only."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="No autorizado")
    is_support = user.get("role") == "system_admin_global" or user.get("is_support_session")
    if not is_support and not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo soporte tecnico puede ejecutar esta accion")
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    result = await db.users.update_many(
        {"school_id": school_id, "role": "student", "student_status": "enrolled"},
        {"$set": {"student_status": "active", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"{result.modified_count} alumnos cambiados de Matriculado a Activo", "count": result.modified_count}


@router.post("/students/migrate-statuses")
async def migrate_student_statuses(current_user=Depends(get_current_user)):
    """One-time migration: set student_status for existing students."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    school_id = user["school_id"]
    
    students = await db.users.find({"school_id": school_id, "role": "student", "student_status": {"$exists": False}}).to_list(5000)
    counts = {"pending": 0, "enrolled": 0, "active": 0}
    
    for s in students:
        # Check if student has matrícula payment
        has_matricula = await db.payments.count_documents({"student_id": s["id"], "school_id": school_id, "payment_status": "paid", "concept": {"$regex": "^matricula$", "$options": "i"}})
        has_pension = await db.payments.count_documents({"student_id": s["id"], "school_id": school_id, "payment_status": "paid", "concept": {"$regex": "^mensualidad$", "$options": "i"}})
        if has_matricula and has_pension:
            new_status = "active"
        elif has_matricula:
            new_status = "enrolled"
        else:
            new_status = "pending"
        await db.users.update_one({"id": s["id"]}, {"$set": {"student_status": new_status}})
        counts[new_status] += 1
    
    return {"message": "Migración completada", "counts": counts}

@router.get("/accounting/student-paid-concepts/{student_id}")
async def get_student_paid_concepts(student_id: str, year: Optional[int] = None, current_user=Depends(require_section_access("accounting"))):
    """Return concept names already paid by a student in the given academic year."""
    school_id = current_user["school_id"]
    if not year:
        year = datetime.now(timezone.utc).year
    date_from = f"{year}-01-01"
    date_to = f"{year}-12-31"
    pipeline = [
        {"$match": {"student_id": student_id, "school_id": school_id, "payment_status": "paid", "payment_date": {"$gte": date_from, "$lte": date_to}}},
        {"$group": {"_id": "$concept"}}
    ]
    results = await db.payments.aggregate(pipeline).to_list(100)
    return {"paid_concepts": [r["_id"] for r in results], "year": year}


async def auto_update_student_status_on_payment(student_id: str, school_id: str, concept: str):
    """Automatically update student status when a payment is registered."""
    student = await db.users.find_one({"id": student_id, "school_id": school_id, "role": "student"})
    if not student:
        return
    current_status = student.get("student_status", "pending")
    if current_status in ("active", "withdrawn"):
        return  # No changes needed
    
    # Get activation config
    fin_settings = await db.school_financial_settings.find_one({"school_id": school_id}, {"_id": 0})
    activacion_modo = (fin_settings or {}).get("activacion_modo", "on_create")
    
    concept_lower = concept.lower().strip()
    
    if activacion_modo == "matricula":
        # Activate with just matrícula payment
        if concept_lower == "matricula" and current_status in ("pending", "enrolled"):
            await db.users.update_one({"id": student_id}, {"$set": {"student_status": "active"}})
    else:
        # matricula_pension mode
        if concept_lower == "matricula" and current_status == "pending":
            await db.users.update_one({"id": student_id}, {"$set": {"student_status": "enrolled"}})
        elif concept_lower == "mensualidad" and current_status == "enrolled":
            await db.users.update_one({"id": student_id}, {"$set": {"student_status": "active"}})

# ══════════════════════════════════════════════════════════════════════════════


# ══════════════════════════════════════════════════════════════════════════════
# DISCOUNT TYPES CRUD
# ══════════════════════════════════════════════════════════════════════════════

class DiscountTypeCreate(BaseModel):
    name: str
    description: str = ""
    discount_type: Literal["percentage", "fixed_amount"]
    value: float
    application_mode: Literal["automatic", "manual"] = "manual"
    automatic_rule: Optional[str] = None
    is_active: bool = True

class DiscountTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[Literal["percentage", "fixed_amount"]] = None
    value: Optional[float] = None
    application_mode: Optional[Literal["automatic", "manual"]] = None
    automatic_rule: Optional[str] = None
    is_active: Optional[bool] = None

VALID_AUTO_RULES = {"has_active_siblings"}

@router.get("/accounting/discount-types")
async def get_discount_types(current_user=Depends(require_section_access("accounting"))):
    school_id = current_user["school_id"]
    await seed_default_discount_types(school_id)
    types = await db.discount_types.find(
        {"school_id": school_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    # Count assigned students per type
    for dt in types:
        dt["assigned_count"] = await db.student_discounts.count_documents(
            {"discount_type_id": dt["id"]}
        )
    return types

@router.post("/accounting/discount-types")
async def create_discount_type(data: DiscountTypeCreate, current_user=Depends(require_section_access("accounting"))):
    school_id = current_user["school_id"]

    if data.discount_type == "percentage" and (data.value < 0 or data.value > 100):
        raise HTTPException(status_code=400, detail="El porcentaje debe estar entre 0 y 100")
    if data.value < 0:
        raise HTTPException(status_code=400, detail="El valor no puede ser negativo")

    # Unique name per school
    existing = await db.discount_types.find_one(
        {"school_id": school_id, "name": data.name}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe un tipo de descuento con el nombre '{data.name}'")

    # Only one auto rule per type
    if data.application_mode == "automatic":
        if not data.automatic_rule or data.automatic_rule not in VALID_AUTO_RULES:
            raise HTTPException(status_code=400, detail=f"Regla automatica invalida. Valores validos: {', '.join(VALID_AUTO_RULES)}")
        dup_rule = await db.discount_types.find_one(
            {"school_id": school_id, "automatic_rule": data.automatic_rule}, {"_id": 0}
        )
        if dup_rule:
            raise HTTPException(status_code=409, detail=f"Ya existe un descuento automatico con la regla '{data.automatic_rule}'")
    else:
        data.automatic_rule = None

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "name": data.name,
        "description": data.description,
        "discount_type": data.discount_type,
        "value": data.value,
        "application_mode": data.application_mode,
        "automatic_rule": data.automatic_rule,
        "is_active": data.is_active,
        "created_at": now,
        "updated_at": now,
    }
    await db.discount_types.insert_one(doc)
    doc.pop("_id", None)
    doc["assigned_count"] = 0
    return doc

@router.put("/accounting/discount-types/{type_id}")
async def update_discount_type(type_id: str, data: DiscountTypeUpdate, current_user=Depends(require_section_access("accounting"))):
    school_id = current_user["school_id"]
    dt = await db.discount_types.find_one({"id": type_id, "school_id": school_id}, {"_id": 0})
    if not dt:
        raise HTTPException(status_code=404, detail="Tipo de descuento no encontrado")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")

    if "name" in update_data:
        dup = await db.discount_types.find_one(
            {"school_id": school_id, "name": update_data["name"], "id": {"$ne": type_id}}, {"_id": 0}
        )
        if dup:
            raise HTTPException(status_code=409, detail=f"Ya existe un descuento con el nombre '{update_data['name']}'")

    if "discount_type" in update_data and update_data["discount_type"] == "percentage":
        val = update_data.get("value", dt.get("value", 0))
        if val < 0 or val > 100:
            raise HTTPException(status_code=400, detail="El porcentaje debe estar entre 0 y 100")

    if update_data.get("application_mode") == "automatic":
        rule = update_data.get("automatic_rule", dt.get("automatic_rule"))
        if not rule or rule not in VALID_AUTO_RULES:
            raise HTTPException(status_code=400, detail="Regla automatica invalida")
        dup_rule = await db.discount_types.find_one(
            {"school_id": school_id, "automatic_rule": rule, "id": {"$ne": type_id}}, {"_id": 0}
        )
        if dup_rule:
            raise HTTPException(status_code=409, detail=f"Ya existe un descuento automatico con la regla '{rule}'")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.discount_types.update_one({"id": type_id}, {"$set": update_data})
    updated = await db.discount_types.find_one({"id": type_id}, {"_id": 0})
    updated["assigned_count"] = await db.student_discounts.count_documents({"discount_type_id": type_id})
    return updated

@router.delete("/accounting/discount-types/{type_id}")
async def delete_discount_type(type_id: str, current_user=Depends(require_section_access("accounting"))):
    school_id = current_user["school_id"]
    dt = await db.discount_types.find_one({"id": type_id, "school_id": school_id}, {"_id": 0})
    if not dt:
        raise HTTPException(status_code=404, detail="Tipo de descuento no encontrado")

    assigned = await db.student_discounts.count_documents({"discount_type_id": type_id})
    if assigned > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Este descuento esta asignado a {assigned} alumno(s). Desactivalo en lugar de eliminarlo."
        )

    await db.discount_types.delete_one({"id": type_id})
    return {"message": "Tipo de descuento eliminado"}


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT DISCOUNTS (assignment / removal)
# ══════════════════════════════════════════════════════════════════════════════

class StudentDiscountAssign(BaseModel):
    discount_type_id: str
    custom_value: Optional[float] = None

@router.get("/accounting/students/{student_id}/discounts")
async def get_student_discounts(student_id: str, current_user=Depends(require_section_access("accounting"))):
    school_id = current_user["school_id"]
    student = await db.users.find_one(
        {"id": student_id, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "monthly_pension_override": 1}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    assignments = await db.student_discounts.find(
        {"student_id": student_id}, {"_id": 0}
    ).to_list(50)

    # Enrich with discount type info
    type_ids = [a["discount_type_id"] for a in assignments]
    types = {}
    if type_ids:
        type_docs = await db.discount_types.find(
            {"id": {"$in": type_ids}}, {"_id": 0}
        ).to_list(50)
        types = {t["id"]: t for t in type_docs}

    enriched = []
    for a in assignments:
        dt = types.get(a["discount_type_id"], {})
        enriched.append({
            **a,
            "type_name": dt.get("name", ""),
            "type_description": dt.get("description", ""),
            "discount_type": dt.get("discount_type", ""),
            "default_value": dt.get("value", 0),
            "application_mode": dt.get("application_mode", "manual"),
            "automatic_rule": dt.get("automatic_rule"),
            "is_type_active": dt.get("is_active", True),
        })

    return {
        "student_id": student_id,
        "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
        "monthly_pension_override": student.get("monthly_pension_override"),
        "discounts": enriched,
    }

@router.post("/accounting/students/{student_id}/discounts")
async def assign_student_discount(student_id: str, data: StudentDiscountAssign, current_user=Depends(require_section_access("accounting"))):
    school_id = current_user["school_id"]

    student = await db.users.find_one({"id": student_id, "school_id": school_id}, {"_id": 0, "id": 1})
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    dt = await db.discount_types.find_one({"id": data.discount_type_id, "school_id": school_id}, {"_id": 0})
    if not dt:
        raise HTTPException(status_code=404, detail="Tipo de descuento no encontrado")

    if not dt.get("is_active"):
        raise HTTPException(status_code=400, detail="Este tipo de descuento esta inactivo")

    if dt.get("application_mode") == "automatic":
        raise HTTPException(status_code=400, detail="Los descuentos automaticos no se pueden asignar manualmente")

    # Check duplicate
    existing = await db.student_discounts.find_one(
        {"student_id": student_id, "discount_type_id": data.discount_type_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=409, detail="Este descuento ya esta asignado a este alumno")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "discount_type_id": data.discount_type_id,
        "custom_value": data.custom_value,
        "origin": "manual",
        "assigned_at": now,
        "assigned_by": current_user["id"],
    }
    await db.student_discounts.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Descuento asignado", "discount": doc}

@router.delete("/accounting/students/{student_id}/discounts/{discount_id}")
async def remove_student_discount(student_id: str, discount_id: str, current_user=Depends(require_section_access("accounting"))):
    sd = await db.student_discounts.find_one(
        {"id": discount_id, "student_id": student_id}, {"_id": 0}
    )
    if not sd:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")

    if sd.get("origin") == "automatic":
        raise HTTPException(status_code=400, detail="Los descuentos automaticos no se pueden quitar manualmente. Desactiva el tipo de descuento.")

    await db.student_discounts.delete_one({"id": discount_id})
    return {"message": "Descuento removido"}


# ══════════════════════════════════════════════════════════════════════════════
# PENSION CALCULATION
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/accounting/students/{student_id}/pension")
async def get_student_pension(student_id: str, current_user=Depends(require_section_access("accounting"))):
    school_id = current_user["school_id"]

    student = await db.users.find_one(
        {"id": student_id, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "monthly_pension_override": 1}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    settings = await db.school_financial_settings.find_one({"school_id": school_id}, {"_id": 0})
    base_pension = settings.get("pension_mensual", 0) if settings else 0
    pronto_pago_activo = settings.get("pronto_pago_activo", False) if settings else False
    pronto_pago_monto = settings.get("pronto_pago_monto", 0) if settings else 0
    pronto_pago_modalidad = settings.get("pronto_pago_modalidad", "monto_fijo") if settings else "monto_fijo"
    if pronto_pago_activo and pronto_pago_monto > 0:
        if pronto_pago_modalidad == "porcentaje":
            pronto_pago_descuento = base_pension * pronto_pago_monto / 100
        else:
            pronto_pago_descuento = base_pension - pronto_pago_monto
    else:
        pronto_pago_descuento = 30

    override = student.get("monthly_pension_override")
    if override is not None:
        return {
            "student_id": student_id,
            "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
            "base_pension": base_pension,
            "discounts": [],
            "total_discount": 0,
            "final_pension": override,
            "early_payment_discount": pronto_pago_descuento,
            "final_with_early_payment": max(0, override - pronto_pago_descuento),
            "is_override": True,
        }

    # Get active discounts
    assignments = await db.student_discounts.find(
        {"student_id": student_id}, {"_id": 0}
    ).to_list(50)

    type_ids = [a["discount_type_id"] for a in assignments]
    types = {}
    if type_ids:
        type_docs = await db.discount_types.find(
            {"id": {"$in": type_ids}, "is_active": True}, {"_id": 0}
        ).to_list(50)
        types = {t["id"]: t for t in type_docs}

    discounts_detail = []
    total_discount = 0

    for a in assignments:
        dt = types.get(a["discount_type_id"])
        if not dt:
            continue
        effective_value = a.get("custom_value") if a.get("custom_value") is not None else dt["value"]
        if dt["discount_type"] == "percentage":
            amount = round(base_pension * effective_value / 100, 2)
        else:
            amount = effective_value
        total_discount += amount

        # Get sibling info for automatic discounts
        reason = None
        if dt.get("automatic_rule") == "has_active_siblings":
            siblings = await _get_active_siblings(student_id, school_id)
            if siblings:
                names = [f"{s.get('name','')} {s.get('last_name','')}".strip() for s in siblings]
                reason = f"Tiene {len(siblings)} hermano(s) activo(s): {', '.join(names)}"

        discounts_detail.append({
            "name": dt["name"],
            "type": dt["discount_type"],
            "value": effective_value,
            "amount": amount,
            "origin": a.get("origin", "manual"),
            "reason": reason,
        })

    final_pension = max(0, round(base_pension - total_discount, 2))

    return {
        "student_id": student_id,
        "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
        "base_pension": base_pension,
        "discounts": discounts_detail,
        "total_discount": round(total_discount, 2),
        "final_pension": final_pension,
        "early_payment_discount": pronto_pago_descuento,
        "final_with_early_payment": max(0, round(final_pension - pronto_pago_descuento, 2)),
        "is_override": False,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SIBLINGS DETECTION & AUTO-SYNC
# ══════════════════════════════════════════════════════════════════════════════

async def _get_parent_ids(student_id: str, school_id: str) -> list:
    """Get parent/apoderado IDs linked to a student."""
    student = await db.users.find_one(
        {"id": student_id, "school_id": school_id},
        {"_id": 0, "parent_id": 1, "padre_id": 1}
    )
    if not student:
        return []
    parent_ids = set()
    if student.get("parent_id"):
        parent_ids.add(student["parent_id"])
    if student.get("padre_id"):
        parent_ids.add(student["padre_id"])
    return list(parent_ids)

async def _get_active_siblings(student_id: str, school_id: str) -> list:
    """Get active siblings of a student (other students linked to same parent)."""
    parent_ids = await _get_parent_ids(student_id, school_id)
    if not parent_ids:
        return []

    siblings = await db.users.find(
        {
            "school_id": school_id,
            "role": {"$in": ["student", "estudiante"]},
            "id": {"$ne": student_id},
            "$or": [
                {"parent_id": {"$in": parent_ids}},
                {"padre_id": {"$in": parent_ids}},
            ],
            "student_status": {"$in": ["active", "activo", "matriculado", "enrolled"]},
        },
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "seccion_id": 1}
    ).to_list(50)
    return siblings

@router.get("/accounting/students/{student_id}/siblings")
async def get_student_siblings(student_id: str, current_user=Depends(require_section_access("accounting"))):
    school_id = current_user["school_id"]
    student = await db.users.find_one({"id": student_id, "school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "last_name": 1})
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    parent_ids = await _get_parent_ids(student_id, school_id)
    siblings = await _get_active_siblings(student_id, school_id)

    # Get parent info
    parent_name = ""
    if parent_ids:
        parent = await db.users.find_one({"id": parent_ids[0]}, {"_id": 0, "name": 1, "last_name": 1})
        if parent:
            parent_name = f"{parent.get('name', '')} {parent.get('last_name', '')}".strip()

    return {
        "student_id": student_id,
        "parent_id": parent_ids[0] if parent_ids else None,
        "parent_name": parent_name,
        "siblings": siblings,
        "active_siblings_count": len(siblings),
        "qualifies_for_sibling_discount": len(siblings) > 0,
        "has_parent_linked": len(parent_ids) > 0,
    }

@router.post("/accounting/discounts/sync")
async def sync_automatic_discounts(current_user=Depends(require_section_access("accounting"))):
    """Sync all automatic discounts for the school (siblings detection)."""
    school_id = current_user["school_id"]
    result = await _sync_all_sibling_discounts(school_id)
    return result

@router.post("/accounting/students/{student_id}/discounts/sync")
async def sync_student_automatic_discounts(student_id: str, current_user=Depends(require_section_access("accounting"))):
    """Sync automatic discounts for a specific student."""
    school_id = current_user["school_id"]
    parent_ids = await _get_parent_ids(student_id, school_id)
    if not parent_ids:
        return {"message": "Alumno sin apoderado vinculado", "assigned": 0, "removed": 0}

    result = await _sync_sibling_discount_for_parent(school_id, parent_ids[0])
    return result

async def _sync_all_sibling_discounts(school_id: str):
    """Sync sibling discounts for all students in the school."""
    sibling_dt = await db.discount_types.find_one(
        {"school_id": school_id, "automatic_rule": "has_active_siblings", "is_active": True},
        {"_id": 0}
    )
    if not sibling_dt:
        return {"message": "No hay descuento automatico de hermanos activo", "assigned": 0, "removed": 0}

    # Get all active students with parent_id
    students = await db.users.find(
        {
            "school_id": school_id,
            "role": {"$in": ["student", "estudiante"]},
            "student_status": {"$in": ["active", "activo", "matriculado", "enrolled"]},
            "$or": [
                {"parent_id": {"$ne": None}},
                {"padre_id": {"$ne": None}},
            ],
        },
        {"_id": 0, "id": 1, "parent_id": 1, "padre_id": 1}
    ).to_list(1000)

    # Group by parent
    parent_groups = {}
    for s in students:
        pid = s.get("parent_id") or s.get("padre_id")
        if pid:
            parent_groups.setdefault(pid, []).append(s["id"])

    total_assigned = 0
    total_removed = 0

    for parent_id, student_ids in parent_groups.items():
        has_siblings = len(student_ids) > 1
        for sid in student_ids:
            existing = await db.student_discounts.find_one(
                {"student_id": sid, "discount_type_id": sibling_dt["id"]}, {"_id": 0}
            )
            if has_siblings and not existing:
                await db.student_discounts.insert_one({
                    "id": str(uuid.uuid4()),
                    "student_id": sid,
                    "discount_type_id": sibling_dt["id"],
                    "custom_value": None,
                    "origin": "automatic",
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                    "assigned_by": None,
                })
                total_assigned += 1
            elif not has_siblings and existing and existing.get("origin") == "automatic":
                await db.student_discounts.delete_one({"id": existing["id"]})
                total_removed += 1

    # Also remove for students without parent
    orphan_autos = await db.student_discounts.find(
        {"discount_type_id": sibling_dt["id"], "origin": "automatic"},
        {"_id": 0, "id": 1, "student_id": 1}
    ).to_list(1000)
    all_student_ids_with_parent = set()
    for ids in parent_groups.values():
        all_student_ids_with_parent.update(ids)
    for oa in orphan_autos:
        if oa["student_id"] not in all_student_ids_with_parent:
            await db.student_discounts.delete_one({"id": oa["id"]})
            total_removed += 1

    return {
        "message": f"Sincronizacion completada",
        "assigned": total_assigned,
        "removed": total_removed,
        "families_processed": len(parent_groups),
    }

async def _sync_sibling_discount_for_parent(school_id: str, parent_id: str):
    """Sync sibling discount for all children of a specific parent."""
    sibling_dt = await db.discount_types.find_one(
        {"school_id": school_id, "automatic_rule": "has_active_siblings", "is_active": True},
        {"_id": 0}
    )
    if not sibling_dt:
        return {"message": "No hay descuento automatico de hermanos activo", "assigned": 0, "removed": 0}

    children = await db.users.find(
        {
            "school_id": school_id,
            "role": {"$in": ["student", "estudiante"]},
            "$or": [
                {"parent_id": parent_id},
                {"padre_id": parent_id},
            ],
            "student_status": {"$in": ["active", "activo", "matriculado", "enrolled"]},
        },
        {"_id": 0, "id": 1}
    ).to_list(50)

    child_ids = [c["id"] for c in children]
    has_siblings = len(child_ids) > 1
    assigned = 0
    removed = 0

    for sid in child_ids:
        existing = await db.student_discounts.find_one(
            {"student_id": sid, "discount_type_id": sibling_dt["id"]}, {"_id": 0}
        )
        if has_siblings and not existing:
            await db.student_discounts.insert_one({
                "id": str(uuid.uuid4()),
                "student_id": sid,
                "discount_type_id": sibling_dt["id"],
                "custom_value": None,
                "origin": "automatic",
                "assigned_at": datetime.now(timezone.utc).isoformat(),
                "assigned_by": None,
            })
            assigned += 1
        elif not has_siblings and existing and existing.get("origin") == "automatic":
            await db.student_discounts.delete_one({"id": existing["id"]})
            removed += 1

    return {"message": "Sincronizacion completada", "assigned": assigned, "removed": removed}


# ══════════════════════════════════════════════════════════════════════════════
# SEED DEFAULT DISCOUNT TYPES
# ══════════════════════════════════════════════════════════════════════════════

async def seed_default_discount_types(school_id: str):
    """Create default discount types for a school if none exist."""
    count = await db.discount_types.count_documents({"school_id": school_id})
    if count > 0:
        return
    now = datetime.now(timezone.utc).isoformat()
    defaults = [
        {"id": str(uuid.uuid4()), "school_id": school_id, "name": "Descuento por hermanos", "description": "Aplica cuando hay mas de un hermano matriculado", "discount_type": "percentage", "value": 10, "application_mode": "automatic", "automatic_rule": "has_active_siblings", "is_active": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "school_id": school_id, "name": "Primeros puestos", "description": "Descuento por rendimiento academico destacado", "discount_type": "percentage", "value": 15, "application_mode": "manual", "automatic_rule": None, "is_active": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "school_id": school_id, "name": "Bajos recursos", "description": "Descuento por evaluacion socioeconomica", "discount_type": "fixed_amount", "value": 100, "application_mode": "manual", "automatic_rule": None, "is_active": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "school_id": school_id, "name": "Beca completa", "description": "Exoneracion total de pension", "discount_type": "percentage", "value": 100, "application_mode": "manual", "automatic_rule": None, "is_active": True, "created_at": now, "updated_at": now},
    ]
    await db.discount_types.insert_many(defaults)
    logger.info(f"[SEED] Created {len(defaults)} default discount types for school {school_id}")



# ══════════════════════════════════════════════════════════════════════════════
# YAPE CONFIG & PAYMENT VERIFICATION (Owner/Admin from Contabilidad)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/accounting/yape-config")
async def get_yape_config(current_user=Depends(require_section_access("accounting"))):
    """Get Yape QR configuration for the school."""
    school_id = current_user["school_id"]
    config = await db.yape_config.find_one({"school_id": school_id}, {"_id": 0})
    if not config:
        return {
            "enabled": False,
            "qr_image_base64": "",
            "account_holder_name": "",
            "instructions_text": "",
        }
    return config


@router.put("/accounting/yape-config")
async def update_yape_config(
    current_user=Depends(require_section_access("accounting")),
    enabled: Optional[bool] = Form(None),
    account_holder_name: Optional[str] = Form(None),
    instructions_text: Optional[str] = Form(None),
    qr_image: Optional[UploadFile] = File(None),
):
    """Create or update Yape QR configuration. Owner/admin only."""
    user = current_user
    if user.get("role") not in ("owner", "director", "admin") and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Solo el propietario o admin puede configurar Yape")

    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()

    update_fields = {"updated_at": now}

    if enabled is not None:
        # If enabling, verify QR image exists
        if enabled:
            existing = await db.yape_config.find_one({"school_id": school_id}, {"_id": 0})
            has_qr = (existing and existing.get("qr_image_base64")) or qr_image
            if not has_qr:
                raise HTTPException(status_code=400, detail="Debe subir una imagen del codigo QR antes de activar")
        update_fields["enabled"] = enabled

    if account_holder_name is not None:
        update_fields["account_holder_name"] = account_holder_name.strip()

    if instructions_text is not None:
        update_fields["instructions_text"] = instructions_text.strip()

    if qr_image:
        # Validate file type
        content_type = qr_image.content_type or ""
        if content_type not in ("image/png", "image/jpeg", "image/jpg", "image/webp"):
            raise HTTPException(status_code=400, detail="Solo se permiten imagenes PNG, JPG o WebP")

        content = await qr_image.read()
        # Validate size (max 2MB)
        if len(content) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="La imagen no debe exceder 2MB")

        import base64
        b64 = base64.b64encode(content).decode("utf-8")
        update_fields["qr_image_base64"] = f"data:{content_type};base64,{b64}"
        update_fields["qr_image_filename"] = qr_image.filename
        update_fields["qr_image_mimetype"] = content_type

    result = await db.yape_config.update_one(
        {"school_id": school_id},
        {"$set": update_fields, "$setOnInsert": {"school_id": school_id, "created_at": now}},
        upsert=True
    )

    logger.info(f"[YAPE-CONFIG] school={school_id} updated: enabled={update_fields.get('enabled')}")

    return {"message": "Configuracion de Yape guardada", "ok": True}


# ──────────────────────────────────────────────────────────────────────────────
# YAPE PAYMENT VERIFICATION - List & Verify/Reject
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/accounting/yape-payments")
async def list_yape_payments(
    status: Optional[str] = None,
    student_name: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(require_section_access("accounting")),
):
    """List parent Yape payments for verification."""
    school_id = current_user["school_id"]

    query = {"school_id": school_id}
    if status:
        query["status"] = status
    if student_name:
        query["student_name"] = {"$regex": student_name, "$options": "i"}

    total = await db.parent_payments.count_documents(query)
    skip = (page - 1) * limit

    payments = await db.parent_payments.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "payments": payments,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, -(-total // limit)),
    }


class VerifyYapePayment(BaseModel):
    action: str  # "verificar" | "rechazar"
    rejection_reason: Optional[str] = None


@router.put("/accounting/yape-payments/{payment_id}/verify")
async def verify_or_reject_yape_payment(
    payment_id: str,
    data: VerifyYapePayment,
    current_user=Depends(require_section_access("accounting")),
):
    """Verify or reject a parent Yape payment."""
    user = current_user
    if user.get("role") not in ("owner", "director", "admin") and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Solo el propietario o admin puede verificar pagos")

    school_id = user["school_id"]

    payment = await db.parent_payments.find_one(
        {"id": payment_id, "school_id": school_id},
        {"_id": 0}
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    if payment["status"] not in ("pendiente_verificacion",):
        raise HTTPException(status_code=400, detail=f"El pago ya fue procesado (estado: {payment['status']})")

    now = datetime.now(timezone.utc).isoformat()
    verifier_name = f"{user.get('name', '')} {user.get('last_name', '')}".strip()

    if data.action == "verificar":
        # Update parent_payment status
        await db.parent_payments.update_one(
            {"id": payment_id},
            {"$set": {
                "status": "verificado",
                "verified_by": user["id"],
                "verified_by_name": verifier_name,
                "verified_at": now,
                "updated_at": now,
            }}
        )

        # Register as income in the existing payments collection (same structure as accounting)
        month_names = {1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
                       7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"}
        month_label = month_names.get(payment.get("month"), "")

        accounting_payment = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "student_id": payment["student_id"],
            "concept": "mensualidad",
            "description": payment.get("concept") or f"Pension {month_label} {payment.get('year', '')}",
            "amount_base": payment["amount"],
            "igv_applicable": False,
            "igv_amount": 0,
            "total_amount": payment["amount"],
            "payment_method": "yape",
            "payment_status": "paid",
            "payment_date": now,
            "pension_month": f"{payment.get('year', '')}-{str(payment.get('month', '')).zfill(2)}",
            "receipt_number": payment.get("yape_operation_code", ""),
            "notes": f"Pago Yape verificado. Cod: {payment.get('yape_operation_code', '')}. Reportado por: {payment.get('parent_name', '')}",
            "registered_by": user["id"],
            "registered_by_name": verifier_name,
            "yape_parent_payment_id": payment_id,
            "created_at": now,
            "updated_at": now,
        }

        # Get student grade/section for the accounting record
        student = await db.users.find_one(
            {"id": payment["student_id"], "school_id": school_id},
            {"_id": 0, "grado_id": 1, "seccion_id": 1}
        )
        if student:
            accounting_payment["grade_id"] = student.get("grado_id", "")
            accounting_payment["section_id"] = student.get("seccion_id", "")

        await db.payments.insert_one(accounting_payment)

        logger.info(f"[YAPE-VERIFY] Pago verificado: id={payment_id}, amount={payment['amount']}, "
                     f"student={payment['student_id']}, code={payment.get('yape_operation_code')}")

        return {
            "message": "Pago verificado y registrado en contabilidad",
            "status": "verificado",
            "accounting_payment_id": accounting_payment["id"],
        }

    elif data.action == "rechazar":
        if not data.rejection_reason or not data.rejection_reason.strip():
            raise HTTPException(status_code=400, detail="Debe indicar la razon del rechazo")

        await db.parent_payments.update_one(
            {"id": payment_id},
            {"$set": {
                "status": "rechazado",
                "rejection_reason": data.rejection_reason.strip(),
                "verified_by": user["id"],
                "verified_by_name": verifier_name,
                "verified_at": now,
                "updated_at": now,
            }}
        )

        logger.info(f"[YAPE-REJECT] Pago rechazado: id={payment_id}, reason={data.rejection_reason}")

        return {
            "message": "Pago rechazado. El padre sera notificado.",
            "status": "rechazado",
        }

    else:
        raise HTTPException(status_code=400, detail="Accion invalida. Use 'verificar' o 'rechazar'")



# ══════════════════════════════════════════════════════════════════════════════
# BULK PAYMENT GENERATION (GENERACION AUTOMATICA DE COBRANZA)
# ══════════════════════════════════════════════════════════════════════════════

async def generate_pending_payments_for_school(
    school_id: str,
    mes: str,
    concepto: str,
    monto: float,
    solo_sin_pago: bool = True,
    created_by: str = "system",
) -> dict:
    """
    Shared function: generate pending payments for all active students.
    Used by: bulk endpoint, enrollment hook, and cron job.
    Returns: { generados: int, omitidos: int, errores: [] }
    """
    now = datetime.now(timezone.utc).isoformat()
    result = {"generados": 0, "omitidos": 0, "errores": []}

    # Get financial settings for due date
    fin_settings = await db.school_financial_settings.find_one({"school_id": school_id}, {"_id": 0})
    dia_venc = 5
    if fin_settings:
        dia_venc = fin_settings.get("dia_vencimiento_mensualidad", 5) or 5

    # Calculate due date from mes (YYYY-MM) and dia_vencimiento
    try:
        year_num = int(mes.split("-")[0])
        month_num = int(mes.split("-")[1])
        dia_safe = min(dia_venc, 28)
        from datetime import date
        due_date = date(year_num, month_num, dia_safe).isoformat()
    except Exception:
        due_date = f"{mes}-{str(dia_venc).zfill(2)}"

    # Get all active students
    students = await db.users.find(
        {"school_id": school_id, "role": "student", "student_status": {"$in": ["active", "enrolled"]}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "grado_id": 1, "seccion_id": 1}
    ).to_list(5000)

    if not students:
        return result

    # Get existing payments for this school+month+concept to deduplicate
    existing_payments = await db.payments.find(
        {
            "school_id": school_id,
            "pension_month": mes,
            "concept": concepto,
            "payment_status": {"$ne": "canceled"},
        },
        {"_id": 0, "student_id": 1}
    ).to_list(10000)
    existing_student_ids = set(p["student_id"] for p in existing_payments)

    docs_to_insert = []
    for student in students:
        sid = student["id"]

        if solo_sin_pago and sid in existing_student_ids:
            result["omitidos"] += 1
            continue

        docs_to_insert.append({
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "student_id": sid,
            "grade_id": student.get("grado_id", ""),
            "section_id": student.get("seccion_id", ""),
            "concept": concepto,
            "conceptos": [{"concepto": concepto, "monto": round(monto, 2)}],
            "description": f"{concepto} - {mes}",
            "amount_base": round(monto, 2),
            "igv_applicable": False,
            "igv_amount": 0,
            "total_amount": round(monto, 2),
            "igv_percentage": 0,
            "payment_method": "",
            "payment_status": "pending",
            "payment_date": due_date,
            "pension_month": mes,
            "receipt_number": "",
            "notes": "Generado automaticamente",
            "created_by": created_by,
            "created_at": now,
            "updated_at": now,
        })

    if docs_to_insert:
        await db.payments.insert_many(docs_to_insert)
        result["generados"] = len(docs_to_insert)

    # Also generate matrícula pending for students who don't have one yet
    if concepto.lower() == "mensualidad" and fin_settings:
        matricula_amount = fin_settings.get("matricula", 0) or 0
        if matricula_amount > 0:
            existing_matriculas = await db.payments.find(
                {
                    "school_id": school_id,
                    "$or": [
                        {"concept": {"$regex": "matricula", "$options": "i"}},
                        {"conceptos.concepto": {"$regex": "matricula", "$options": "i"}},
                    ],
                    "payment_status": {"$ne": "canceled"},
                },
                {"_id": 0, "student_id": 1}
            ).to_list(10000)
            existing_mat_ids = set(p["student_id"] for p in existing_matriculas)

            mat_docs = []
            for student in students:
                sid = student["id"]
                if sid in existing_mat_ids:
                    continue
                mat_docs.append({
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "student_id": sid,
                    "grade_id": student.get("grado_id", ""),
                    "section_id": student.get("seccion_id", ""),
                    "concept": "matricula",
                    "conceptos": [{"concepto": "Matricula", "monto": round(matricula_amount, 2)}],
                    "description": f"Matricula {mes[:4]}",
                    "amount_base": round(matricula_amount, 2),
                    "igv_applicable": False,
                    "igv_amount": 0,
                    "total_amount": round(matricula_amount, 2),
                    "igv_percentage": 0,
                    "payment_method": "",
                    "payment_status": "pending",
                    "payment_date": due_date,
                    "pension_month": "",
                    "receipt_number": "",
                    "notes": "Matricula generada automaticamente",
                    "created_by": created_by,
                    "created_at": now,
                    "updated_at": now,
                })

            if mat_docs:
                await db.payments.insert_many(mat_docs)
                result["generados"] += len(mat_docs)
                result["matriculas_generadas"] = len(mat_docs)

    return result


class BulkGenerateRequest(BaseModel):
    mes: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    concepto: str = "mensualidad"
    monto: float = Field(..., gt=0)
    solo_sin_pago: bool = True


@router.post("/accounting/payments/generate-bulk")
async def generate_bulk_payments(
    data: BulkGenerateRequest,
    current_user=Depends(require_section_access("accounting")),
):
    """Bulk generate pending payments for all active students for a given month."""
    user = current_user
    if user.get("role") not in ("owner", "director", "admin") and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Solo propietarios y administradores pueden generar cobranza")

    school_id = user["school_id"]
    result = await generate_pending_payments_for_school(
        school_id=school_id,
        mes=data.mes,
        concepto=data.concepto,
        monto=data.monto,
        solo_sin_pago=data.solo_sin_pago,
        created_by=user["id"],
    )

    logger.info(f"[BULK-GENERATE] school={school_id} mes={data.mes} concepto={data.concepto} "
                f"generados={result['generados']} omitidos={result['omitidos']}")

    return {
        "message": f"Se generaron {result['generados']} cuotas pendientes" +
                   (f" ({result['omitidos']} omitidos por ya tener pago)" if result["omitidos"] else ""),
        **result,
    }


@router.get("/accounting/payments/generate-bulk/preview")
async def preview_bulk_generation(
    mes: str,
    concepto: str = "mensualidad",
    current_user=Depends(require_section_access("accounting")),
):
    """Preview: count how many students would get a payment generated."""
    school_id = current_user["school_id"]

    total_active = await db.users.count_documents(
        {"school_id": school_id, "role": "student", "student_status": {"$in": ["active", "enrolled"]}}
    )

    existing = await db.payments.count_documents({
        "school_id": school_id,
        "pension_month": mes,
        "concept": concepto,
        "payment_status": {"$ne": "canceled"},
    })

    return {
        "total_alumnos_activos": total_active,
        "ya_tienen_pago": existing,
        "se_generarian": max(0, total_active - existing),
    }



# ══════════════════════════════════════════════════════════════════════════════
# CRON: DAILY BILLING GENERATION
# ══════════════════════════════════════════════════════════════════════════════

async def daily_billing_generation_cron():
    """Background task: runs daily. For each school within its active school year
    and on the configured due day, generate pending payments for all active students."""
    import asyncio
    while True:
        try:
            from datetime import date as date_cls
            today = date_cls.today()
            current_month = today.strftime("%Y-%m")
            day_of_month = today.day

            schools = await db.schools.find(
                {"plan_estado": {"$ne": "SUSPENDIDO"}},
                {"_id": 0, "id": 1}
            ).to_list(None)

            for school in schools:
                school_id = school["id"]
                fin_settings = await db.school_financial_settings.find_one(
                    {"school_id": school_id}, {"_id": 0}
                )
                if not fin_settings:
                    continue

                # CHECK 1: School year dates configured?
                fecha_inicio_str = fin_settings.get("fecha_inicio_ano_escolar", "")
                fecha_fin_str = fin_settings.get("fecha_fin_ano_escolar", "")

                if not fecha_inicio_str or not fecha_fin_str:
                    # No school year configured - skip with warning log
                    await db.cron_logs.insert_one({
                        "school_id": school_id,
                        "tipo": "generacion_mensualidad",
                        "fecha_ejecucion": datetime.now(timezone.utc).isoformat(),
                        "mes_generado": current_month,
                        "cuotas_generadas": 0,
                        "cuotas_omitidas": 0,
                        "motivo_omision": "Ano escolar no configurado",
                        "errores": [],
                    })
                    continue

                # CHECK 2: Are we within the school year?
                try:
                    fecha_inicio = date_cls.fromisoformat(fecha_inicio_str)
                    fecha_fin = date_cls.fromisoformat(fecha_fin_str)
                except (ValueError, TypeError):
                    continue

                if not (fecha_inicio <= today <= fecha_fin):
                    # Outside school year - log and skip
                    await db.cron_logs.insert_one({
                        "school_id": school_id,
                        "tipo": "generacion_mensualidad",
                        "fecha_ejecucion": datetime.now(timezone.utc).isoformat(),
                        "mes_generado": current_month,
                        "cuotas_generadas": 0,
                        "cuotas_omitidas": 0,
                        "motivo_omision": f"Fuera de ano escolar ({fecha_inicio_str} a {fecha_fin_str})",
                        "errores": [],
                    })
                    continue

                # CHECK 3: Is today the due day?
                dia_venc = fin_settings.get("dia_vencimiento_mensualidad", 5) or 5
                pension = fin_settings.get("pension_mensual", 0) or 0

                if day_of_month != dia_venc or pension <= 0:
                    continue

                # Generate payments
                result = await generate_pending_payments_for_school(
                    school_id=school_id,
                    mes=current_month,
                    concepto="mensualidad",
                    monto=pension,
                    solo_sin_pago=True,
                    created_by="cron_system",
                )

                await db.cron_logs.insert_one({
                    "school_id": school_id,
                    "tipo": "generacion_mensualidad",
                    "fecha_ejecucion": datetime.now(timezone.utc).isoformat(),
                    "mes_generado": current_month,
                    "cuotas_generadas": result["generados"],
                    "cuotas_omitidas": result["omitidos"],
                    "motivo_omision": None,
                    "errores": result["errores"],
                })

                if result["generados"] > 0:
                    logger.info(f"[BILLING-CRON] school={school_id} mes={current_month} "
                                f"generados={result['generados']} omitidos={result['omitidos']}")

        except Exception as e:
            logger.error(f"[BILLING-CRON] Error: {e}")

        await asyncio.sleep(86400)
