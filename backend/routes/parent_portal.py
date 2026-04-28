"""
Parent portal endpoints
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
    ACADEMIC_STUDENT_FILTER, ACADEMIC_STUDENT_FILTER_WITH_PENDING,
    PERU_TZ, to_peru_hhmm,
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# PARENT PORTAL ENDPOINTS
# Portal de Padres - Réplica del Portal del Alumno para apoderados
# ══════════════════════════════════════════════════════════════════════════════

async def verify_parent_student_access(parent_user: dict, student_id: str) -> dict:
    """
    Verify that a parent has access to a specific student.
    Returns the student if access is granted, raises HTTPException otherwise.
    """
    if not parent_user or parent_user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para padres/apoderados")
    
    # Find the student
    student = await db.users.find_one({
        "id": student_id,
        "role": "student",
        "school_id": parent_user.get("school_id"),
        "is_active": {"$ne": False}
    }, {"_id": 0})
    
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    
    # Check if student is linked to this parent
    # Method 1: student.padre_id == parent.id
    # Method 2: student.parent_id == parent.id  
    # Method 3: parent.student_ids includes student.id
    # Method 4: parent.children_ids includes student.id
    parent_id = parent_user.get("id")
    
    is_linked = (
        student.get("padre_id") == parent_id or
        student.get("parent_id") == parent_id or
        parent_id in (parent_user.get("student_ids") or []) or
        parent_id in (parent_user.get("children_ids") or []) or
        student_id in (parent_user.get("student_ids") or []) or
        student_id in (parent_user.get("children_ids") or [])
    )
    
    if not is_linked:
        raise HTTPException(status_code=403, detail="No tienes acceso a este estudiante")
    
    return student

@router.get("/parent/me")
async def get_parent_profile(current_user = Depends(get_current_user)):
    """Get parent profile with linked children."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para padres/apoderados")
    
    school_id = user.get("school_id")
    
    # Get linked children
    children = []
    
    # Method 1: Find students where padre_id/parent_id = parent's id
    linked_by_padre = await db.users.find({
        "school_id": school_id,
        "role": "student",
        "is_active": {"$ne": False},
        "$or": [
            {"padre_id": user["id"]},
            {"parent_id": user["id"]}
        ]
    }, {"_id": 0}).to_list(20)
    
    for student in linked_by_padre:
        # Get academic info
        grado = None
        seccion = None
        if student.get("grado_id"):
            grado = await db.grades.find_one({"id": student["grado_id"]}, {"_id": 0, "name": 1})
        if student.get("seccion_id"):
            seccion = await db.sections.find_one({"id": student["seccion_id"]}, {"_id": 0, "name": 1})
        
        children.append({
            "id": student["id"],
            "name": student.get("name", ""),
            "last_name": student.get("last_name", ""),
            "photo_url": student.get("photo_url"),
            "grado_id": student.get("grado_id"),
            "seccion_id": student.get("seccion_id"),
            "grado_name": grado.get("name") if grado else None,
            "seccion_name": seccion.get("name") if seccion else None,
            "enrollment_status": student.get("enrollment_status"),
            "enrollment_rejection_reason": student.get("enrollment_rejection_reason"),
        })
    
    # Method 2: Check parent's student_ids/children_ids arrays
    student_ids = user.get("student_ids") or user.get("children_ids") or []
    if student_ids:
        for sid in student_ids:
            if not any(c["id"] == sid for c in children):
                student = await db.users.find_one({
                    "id": sid,
                    "role": "student",
                    "school_id": school_id,
                    "is_active": {"$ne": False}
                }, {"_id": 0})
                if student:
                    grado = None
                    seccion = None
                    if student.get("grado_id"):
                        grado = await db.grades.find_one({"id": student["grado_id"]}, {"_id": 0, "name": 1})
                    if student.get("seccion_id"):
                        seccion = await db.sections.find_one({"id": student["seccion_id"]}, {"_id": 0, "name": 1})
                    children.append({
                        "id": student["id"],
                        "name": student.get("name", ""),
                        "last_name": student.get("last_name", ""),
                        "photo_url": student.get("photo_url"),
                        "grado_id": student.get("grado_id"),
                        "seccion_id": student.get("seccion_id"),
                        "grado_name": grado.get("name") if grado else None,
                        "seccion_name": seccion.get("name") if seccion else None,
                        "enrollment_status": student.get("enrollment_status"),
                        "enrollment_rejection_reason": student.get("enrollment_rejection_reason"),
                    })
    
    return {
        "user": {
            "id": user["id"],
            "name": user.get("name", ""),
            "last_name": user.get("last_name", ""),
            "email": user.get("email"),
            "photo_url": user.get("photo_url"),
            "phone": user.get("phone"),
            "dni": user.get("dni"),
            "birth_date": user.get("birthday") or user.get("birth_date"),
            "gender": user.get("gender"),
            "occupation": user.get("ocupacion") or user.get("occupation"),
            "address": user.get("address"),
            "role": "parent"
        },
        "children": children,
        "children_count": len(children),
        "school_id": school_id
    }


@router.get("/parent/payments")
async def get_parent_payments(
    student_id: str = Query(..., description="ID del estudiante"),
    current_user = Depends(get_current_user)
):
    """Get payment summary for a specific child - used in parent dashboard."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    
    # Get financial settings for the school (pension amount, school year months)
    fin_settings = await db.school_financial_settings.find_one({"school_id": school_id}, {"_id": 0}) or {}
    pension_mensual = fin_settings.get("pension_mensual", 0)
    matricula_amount_config = fin_settings.get("matricula", 0)
    school_year_months = fin_settings.get("meses_ano_escolar", 10)
    
    # Interest and early payment settings
    interes_activo = fin_settings.get("interes_activo", False)
    interes_tipo = fin_settings.get("interes_tipo", "porcentaje")
    interes_valor = fin_settings.get("interes_valor", 0)
    pronto_pago_activo = fin_settings.get("pronto_pago_activo", False)
    pronto_pago_monto = fin_settings.get("pronto_pago_monto", 0)
    pronto_pago_fecha_limite = fin_settings.get("pronto_pago_fecha_limite", 5)
    
    # Get all mensualidad payments for this student
    # Include: concept="mensualidad" OR conceptos array contains "Mensualidad"
    payments = await db.payments.find({
        "school_id": school_id,
        "student_id": student_id,
        "$or": [
            {"concept": {"$regex": "mensualidad", "$options": "i"}},
            {"conceptos.concepto": {"$regex": "mensualidad", "$options": "i"}},
        ]
    }, {"_id": 0}).sort("payment_date", 1).to_list(100)
    
    # For combined payments, extract only the mensualidad portion amount
    for p in payments:
        conceptos = p.get("conceptos", [])
        if len(conceptos) > 1:
            # Combined payment - find the mensualidad amount
            for c in conceptos:
                if "mensualidad" in (c.get("concepto", "")).lower():
                    p["_mensualidad_amount"] = c.get("monto", p.get("total_amount", 0))
                    break
            else:
                p["_mensualidad_amount"] = p.get("total_amount", 0)
        else:
            p["_mensualidad_amount"] = p.get("total_amount", 0)
    
    paid_count = sum(1 for p in payments if p.get("payment_status") == "paid")
    pending_count = sum(1 for p in payments if p.get("payment_status") == "pending")
    overdue_count = sum(1 for p in payments if p.get("payment_status") == "overdue")
    registered_months = len(payments)
    
    paid_amount = sum(p.get("_mensualidad_amount", 0) for p in payments if p.get("payment_status") == "paid")
    pending_amount = sum(pension_mensual for p in payments if p.get("payment_status") == "pending")
    overdue_amount = sum(pension_mensual for p in payments if p.get("payment_status") == "overdue")
    
    # Calculate daily interest (mora) on pending payments that are past the deadline
    total_mora_pending = 0
    mora_per_payment = {}  # payment_id -> {mora, days_late}
    if interes_activo and float(interes_valor) > 0:
        today = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
        for p in payments:
            if p.get("payment_status") in ("pending", "overdue") and p.get("pension_month"):
                pm = p.get("pension_month", "")
                try:
                    year, month = int(pm[:4]), int(pm[5:7])
                    deadline = datetime(year, month, int(pronto_pago_fecha_limite), 12, 0, 0, tzinfo=timezone.utc)
                    days_late = max((today - deadline).days, 0)
                    if days_late > 0:
                        # ALWAYS use pension_mensual as base (avoids double-counting if amount already includes mora)
                        mens_base = pension_mensual
                        if interes_tipo == "porcentaje":
                            daily_rate = float(interes_valor) / 30 / 100
                            mora = round(mens_base * daily_rate * days_late, 2)
                        else:
                            daily_fixed = float(interes_valor) / 30
                            mora = round(daily_fixed * days_late, 2)
                        if mora > 0:
                            mora_per_payment[p.get("id")] = {"mora": mora, "days_late": days_late, "total_con_mora": round(mens_base + mora, 2)}
                            total_mora_pending += mora
                except Exception:
                    pass
    
    # Calculate pronto pago savings (for paid payments that qualified)
    total_pronto_pago_savings = 0
    pronto_pago_count = 0
    if pronto_pago_activo and pronto_pago_monto > 0:
        for p in payments:
            if p.get("payment_status") == "paid" and p.get("total_amount", 0) <= pronto_pago_monto:
                pronto_pago_count += 1
                total_pronto_pago_savings += pension_mensual - pronto_pago_monto
    
    # Base Total Anual (only mensualidades, matrícula shown separately)
    # Deduct pension_mensual for each paid month (not the actual paid amount which may include interest)
    total_annual_base = pension_mensual * school_year_months if pension_mensual > 0 else sum(p.get("_mensualidad_amount", 0) for p in payments)
    total_annual_remaining = total_annual_base - (pension_mensual * paid_count)
    
    # Adjusted amounts considering interest and pending overdue
    debt_mensualidades = 0
    for p in payments:
        if p.get("payment_status") in ("pending", "overdue"):
            debt_mensualidades += p.get("total_amount", pension_mensual)
            if interes_activo and p.get("payment_status") == "overdue":
                base = p.get("total_amount", pension_mensual)
                if interes_tipo == "porcentaje":
                    debt_mensualidades += base * (interes_valor / 100)
                else:
                    debt_mensualidades += interes_valor
    
    # Add unregistered future months
    unregistered_months = max(0, school_year_months - registered_months)
    debt_mensualidades += pension_mensual * unregistered_months
    
    # Add unpaid matrícula
    # Check if matrícula is paid - search exact concept OR inside conceptos array
    matricula = await db.payments.find_one({
        "school_id": school_id,
        "student_id": student_id,
        "$or": [
            {"concept": {"$regex": "^matricula$|^matrícula$", "$options": "i"}},
            {"conceptos.concepto": {"$regex": "^matricula$|^matrícula$", "$options": "i"}},
        ],
        "payment_status": "paid"
    }, {"_id": 0, "total_amount": 1, "payment_date": 1, "payment_status": 1, "conceptos": 1})
    
    # Extract matricula amount from conceptos if combined payment
    if matricula:
        conceptos = matricula.get("conceptos", [])
        mat_amount = matricula.get("total_amount", 0)
        for c in conceptos:
            if "matricula" in (c.get("concepto", "")).lower() or "matrícula" in (c.get("concepto", "")).lower():
                mat_amount = c.get("monto", mat_amount)
                break
        matricula_paid_amount = mat_amount
    else:
        matricula_paid_amount = 0
    debt_matricula = matricula_amount_config - matricula_paid_amount if not matricula else 0
    
    total_debt = debt_mensualidades + debt_matricula
    
    paid_percentage = round((paid_count / school_year_months * 100) if school_year_months > 0 else 0)
    
    if overdue_count > 0:
        overall_status = "moroso"
    elif pending_count > 0:
        overall_status = "pendiente"
    else:
        overall_status = "al_dia"
    
    monthly_detail = []
    month_names_es = {1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
                      7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"}
    for p in payments:
        pid = p.get("id")
        mora_info = mora_per_payment.get(pid, {})
        interest_charge = mora_info.get("mora", 0)
        days_late = mora_info.get("days_late", 0)
        
        is_pronto_pago = (pronto_pago_activo and p.get("payment_status") == "paid" 
                          and p.get("total_amount", 0) <= pronto_pago_monto and pronto_pago_monto > 0)
        
        # Build display label: prefer description > month_name > generated from date
        label = p.get("description") or p.get("month_name") or ""
        if not label:
            pdate = p.get("payment_date", "")
            if pdate:
                try:
                    if isinstance(pdate, str):
                        month_num = int(pdate.split("-")[1]) if "-" in pdate else 0
                        year = pdate.split("-")[0] if "-" in pdate else ""
                    else:
                        month_num = pdate.month
                        year = str(pdate.year)
                    label = f"Mensualidad {month_names_es.get(month_num, '')} {year}".strip()
                except Exception:
                    label = "Mensualidad"
            else:
                label = "Mensualidad"
        
        # For pending mensualidad: use pension_mensual as base (stored amount may already include mora)
        display_amount = pension_mensual if p.get("payment_status") in ("pending", "overdue") else p.get("_mensualidad_amount", p.get("total_amount", 0))
        
        monthly_detail.append({
            "id": p.get("id"),
            "month_name": label,
            "payment_date": p.get("payment_date"),
            "total_amount": display_amount,
            "payment_status": p.get("payment_status"),
            "payment_method": p.get("payment_method"),
            "receipt_number": p.get("receipt_number"),
            "interest_charge": round(interest_charge, 2),
            "days_late": days_late,
            "is_pronto_pago": is_pronto_pago,
        })
    
    return {
        "student_id": student_id,
        "summary": {
            "total_months": school_year_months,
            "paid_count": paid_count,
            "pending_count": pending_count,
            "overdue_count": overdue_count,
            "paid_percentage": paid_percentage,
            "total_annual": round(total_annual_remaining, 2),
            "total_amount": round(pension_mensual * school_year_months, 2),
            "paid_amount": round(paid_amount, 2),
            "pending_amount": round(pending_amount, 2),
            "overdue_amount": round(overdue_amount, 2),
            "debt_amount": round(total_debt, 2),
            "total_interest": round(total_mora_pending, 2),
            "total_mora_pending": round(total_mora_pending, 2),
            "total_pronto_pago_savings": round(total_pronto_pago_savings, 2),
            "pronto_pago_count": pronto_pago_count,
            "overall_status": overall_status,
        },
        "matricula": {
            "paid": bool(matricula),
            "amount": matricula_paid_amount or matricula_amount_config,
            "date": matricula.get("payment_date") if matricula else None,
        },
        "financial_config": {
            "pension_mensual": pension_mensual,
            "interes_activo": interes_activo,
            "interes_valor": interes_valor,
            "interes_tipo": interes_tipo,
            "pronto_pago_activo": pronto_pago_activo,
            "pronto_pago_monto": pronto_pago_monto,
            "pronto_pago_fecha_limite": pronto_pago_fecha_limite,
        },
        "monthly_detail": monthly_detail,
    }


@router.get("/parent/students")
async def get_parent_students(current_user = Depends(get_current_user)):
    """Get list of children linked to this parent."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para padres/apoderados")
    
    school_id = user.get("school_id")
    children = []
    
    # Find students linked to this parent
    linked_students = await db.users.find({
        "school_id": school_id,
        "role": "student",
        "is_active": {"$ne": False},
        "$or": [
            {"padre_id": user["id"]},
            {"parent_id": user["id"]}
        ]
    }, {"_id": 0}).to_list(20)
    
    for student in linked_students:
        grado = None
        seccion = None
        nivel = None
        
        if student.get("grado_id"):
            grado = await db.grades.find_one({"id": student["grado_id"]}, {"_id": 0, "name": 1})
        if student.get("seccion_id"):
            seccion = await db.sections.find_one({"id": student["seccion_id"]}, {"_id": 0, "name": 1})
        if student.get("nivel_id"):
            nivel = await db.academic_levels.find_one({"id": student["nivel_id"]}, {"_id": 0, "name": 1})
        
        # Get pending tasks count (source of truth: subjects.section_id)
        pending_tasks = 0
        if student.get("seccion_id"):
            section_subjects = await db.subjects.find({
                "school_id": school_id,
                "section_id": student["seccion_id"],
                "status": "active"
            }, {"_id": 0, "id": 1}).to_list(100)
            subject_ids = [s["id"] for s in section_subjects]
            
            if subject_ids:
                pending_tasks = await db.course_posts.count_documents({
                    "school_id": school_id,
                    "subject_id": {"$in": subject_ids},
                    "$or": [{"post_type": "task"}, {"type": "task"}],
                    "due_date": {"$gte": datetime.now(timezone.utc).isoformat()}
                })
        
        children.append({
            "id": student["id"],
            "name": student.get("name", ""),
            "last_name": student.get("last_name", ""),
            "full_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
            "photo_url": student.get("photo_url"),
            "email": student.get("email"),
            "nivel_id": student.get("nivel_id"),
            "grado_id": student.get("grado_id"),
            "seccion_id": student.get("seccion_id"),
            "nivel_name": nivel.get("name") if nivel else None,
            "grado_name": grado.get("name") if grado else None,
            "seccion_name": seccion.get("name") if seccion else None,
            "pending_tasks": pending_tasks
        })
    
    # Also check parent's student_ids/children_ids
    extra_ids = (user.get("student_ids") or []) + (user.get("children_ids") or [])
    existing_ids = [c["id"] for c in children]
    
    for sid in extra_ids:
        if sid not in existing_ids:
            student = await db.users.find_one({
                "id": sid,
                "role": "student",
                "school_id": school_id,
                "is_active": {"$ne": False}
            }, {"_id": 0})
            if student:
                grado = None
                seccion = None
                nivel = None
                if student.get("grado_id"):
                    grado = await db.grades.find_one({"id": student["grado_id"]}, {"_id": 0, "name": 1})
                if student.get("seccion_id"):
                    seccion = await db.sections.find_one({"id": student["seccion_id"]}, {"_id": 0, "name": 1})
                if student.get("nivel_id"):
                    nivel = await db.academic_levels.find_one({"id": student["nivel_id"]}, {"_id": 0, "name": 1})
                
                children.append({
                    "id": student["id"],
                    "name": student.get("name", ""),
                    "last_name": student.get("last_name", ""),
                    "full_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
                    "photo_url": student.get("photo_url"),
                    "email": student.get("email"),
                    "nivel_id": student.get("nivel_id"),
                    "grado_id": student.get("grado_id"),
                    "seccion_id": student.get("seccion_id"),
                    "nivel_name": nivel.get("name") if nivel else None,
                    "grado_name": grado.get("name") if grado else None,
                    "seccion_name": seccion.get("name") if seccion else None,
                    "pending_tasks": 0
                })
    
    return {"students": children}

@router.get("/parent/dashboard")
async def get_parent_dashboard(
    student_id: str = Query(..., description="ID del estudiante"),
    current_user = Depends(get_current_user)
):
    """Get full dashboard data for a specific child - mirrors student dashboard format."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    
    # Get academic context
    nivel = None
    grado = None
    seccion = None
    
    if student.get("nivel_id"):
        nivel = await db.academic_levels.find_one({"id": student["nivel_id"], "school_id": school_id}, {"_id": 0})
    if student.get("grado_id"):
        grado = await db.grades.find_one({"id": student["grado_id"], "school_id": school_id}, {"_id": 0})
    if student.get("seccion_id"):
        seccion = await db.sections.find_one({"id": student["seccion_id"], "school_id": school_id}, {"_id": 0})
    
    # Get courses via subjects collection (source of truth: section_id)
    courses = []
    subject_ids = []
    if student.get("seccion_id"):
        courses = await db.subjects.find({
            "school_id": school_id,
            "section_id": student["seccion_id"],
            "status": "active"
        }, {"_id": 0}).to_list(100)
        subject_ids = [s["id"] for s in courses]
    
    # Get section students count
    section_students_count = 0
    if student.get("seccion_id"):
        section_students_count = await db.users.count_documents({
            "school_id": school_id,
            "role": "student",
            "seccion_id": student["seccion_id"]
        })
    
    # Get ALL tasks for this student's subjects (for task progress calculation)
    all_tasks = []
    upcoming_tasks = []
    if subject_ids:
        now = datetime.now(timezone.utc)
        all_tasks = await db.course_posts.find({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "$or": [{"post_type": "task"}, {"type": "task"}],
            "status": "active",
            "deleted_at": {"$exists": False}
        }, {"_id": 0}).to_list(200)
        
        # Get all submissions for this student
        task_ids = [t.get("id") for t in all_tasks if t.get("id")]
        submitted_task_ids = set()
        if task_ids:
            submitted = await db.task_submissions.find({
                "school_id": school_id,
                "student_id": student_id,
                "task_id": {"$in": task_ids}
            }, {"_id": 0, "task_id": 1}).to_list(200)
            submitted_task_ids = set(s["task_id"] for s in submitted)
        
        # Build upcoming tasks (not submitted, with future due date)
        for task in all_tasks:
            task_id = task.get("id")
            due_date = task.get("due_date") or task.get("metadata", {}).get("due_date")
            if task_id in submitted_task_ids:
                continue
            # Also check embedded submissions
            submissions = task.get("submissions", [])
            if any(s.get("student_id") == student_id for s in submissions):
                continue
            subject = next((c for c in courses if c["id"] == task.get("subject_id")), None)
            upcoming_tasks.append({
                "id": task_id,
                "title": task.get("title"),
                "subject_name": subject.get("name") if subject else "Sin asignatura",
                "subject_color": subject.get("color") if subject else "#6366f1",
                "due_date": due_date,
                "subject_id": task.get("subject_id")
            })
        upcoming_tasks = upcoming_tasks[:10]
    
    # Task progress
    total_tasks = len(all_tasks)
    tasks_submitted = len([t for t in all_tasks if t.get("id") in submitted_task_ids]) if subject_ids else 0
    task_percentage = round((tasks_submitted / total_tasks * 100) if total_tasks > 0 else 0)
    
    # Attendance summary (last 30 days)
    thirty_days_ago = (datetime.now(PERU_TZ) - timedelta(days=30)).strftime("%Y-%m-%d")
    today_str = datetime.now(PERU_TZ).strftime("%Y-%m-%d")
    attendance_summary = {"present": 0, "absent": 0, "late": 0, "justified": 0}
    today_attendance = {"status": None, "entry_time": None, "exit_time": None}
    
    attendance_records = await db.attendances.find({
        "school_id": school_id,
        "user_id": student_id,
        "type": "student",
        "date": {"$gte": thirty_days_ago}
    }, {"_id": 0, "status": 1, "date": 1, "time": 1, "exit_time": 1}).to_list(100)
    
    qr_attendance = await db.student_attendance.find({
        "school_id": school_id,
        "student_id": student_id,
        "date": {"$gte": thirty_days_ago}
    }, {"_id": 0, "status": 1, "date": 1, "entry_time": 1, "exit_time": 1}).to_list(100)
    
    seen_dates = set()
    for record in attendance_records:
        date_key = record.get("date", "")
        seen_dates.add(date_key)
        status = record.get("status", "").lower()
        if status in ["presente", "present", "p"]:
            attendance_summary["present"] += 1
        elif status in ["ausente", "absent", "a"]:
            attendance_summary["absent"] += 1
        elif status in ["tardanza", "late", "t"]:
            attendance_summary["late"] += 1
        elif status in ["justificado", "justified", "j"]:
            attendance_summary["justified"] += 1
        # Check if this is today's record
        if date_key == today_str:
            today_attendance["status"] = record.get("status", "")
            today_attendance["entry_time"] = to_peru_hhmm(record.get("entry_time")) or record.get("time") or record.get("entry_time")
            today_attendance["exit_time"] = to_peru_hhmm(record.get("exit_time"))
    
    for record in qr_attendance:
        date_key = record.get("date", "")
        if date_key not in seen_dates:
            seen_dates.add(date_key)
            status = record.get("status", "").lower()
            if status in ["presente", "present", "p"]:
                attendance_summary["present"] += 1
            elif status in ["ausente", "absent", "a"]:
                attendance_summary["absent"] += 1
            elif status in ["tardanza", "late", "t"]:
                attendance_summary["late"] += 1
        # Check if this is today's record (even if seen in other collection)
        if date_key == today_str and not today_attendance["status"]:
            today_attendance["status"] = record.get("status", "")
            today_attendance["entry_time"] = to_peru_hhmm(record.get("entry_time")) or record.get("entry_time")
            today_attendance["exit_time"] = to_peru_hhmm(record.get("exit_time"))
    
    # Recent announcements
    announcements = await db.institutional_messages.find({
        "school_id": school_id,
        "status": "active"
    }, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    recent_announcements = []
    for ann in announcements:
        recent_announcements.append({
            "id": ann["id"],
            "title": ann.get("title"),
            "priority": ann.get("priority", "normal"),
            "created_at": ann.get("created_at"),
            "is_read": student_id in ann.get("read_by", [])
        })
    
    # Recent grades
    recent_grades = []
    if subject_ids:
        grades = await db.grades_records.find({
            "school_id": school_id,
            "student_id": student_id,
            "subject_id": {"$in": subject_ids}
        }, {"_id": 0}).sort("created_at", -1).to_list(5)
        
        for grade in grades:
            subject = next((c for c in courses if c["id"] == grade.get("subject_id")), None)
            recent_grades.append({
                "id": grade.get("id"),
                "subject_name": subject.get("name") if subject else "",
                "grade": grade.get("grade"),
                "evaluation_name": grade.get("evaluation_name", ""),
                "date": grade.get("created_at")
            })
    
    # Unread messages count
    unread_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": student_id,
                    "is_read": False,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    unread_result = await db.internal_mail.aggregate(unread_pipeline).to_list(1)
    unread_messages = unread_result[0]["count"] if unread_result else 0
    
    return {
        "student": {
            "id": student["id"],
            "name": student.get("name", ""),
            "last_name": student.get("last_name", ""),
            "photo_url": student.get("photo_url"),
            "email": student.get("email")
        },
        "academic": {
            "nivel": nivel,
            "grado": grado,
            "seccion": seccion,
            "nivel_id": student.get("nivel_id"),
            "grado_id": student.get("grado_id"),
            "seccion_id": student.get("seccion_id")
        },
        "stats": {
            "courses_count": len(courses),
            "pending_tasks": len(upcoming_tasks),
            "unread_messages": unread_messages,
            "attendance_rate": round((attendance_summary["present"] / (attendance_summary["present"] + attendance_summary["absent"] + attendance_summary["late"] + attendance_summary["justified"]) * 100) if (attendance_summary["present"] + attendance_summary["absent"] + attendance_summary["late"] + attendance_summary["justified"]) > 0 else 0, 1),
            "section_students_count": section_students_count
        },
        "courses_count": len(courses),
        "upcoming_tasks": upcoming_tasks,
        "task_progress": {
            "total_tasks": total_tasks,
            "tasks_submitted": tasks_submitted,
            "percentage": task_percentage
        },
        "attendance_summary": attendance_summary,
        "today_attendance": today_attendance,
        "recent_announcements": recent_announcements,
        "recent_grades": recent_grades,
        "unread_messages": unread_messages
    }

@router.get("/parent/courses")
async def get_parent_student_courses(
    student_id: str = Query(..., description="ID del estudiante"),
    current_user = Depends(get_current_user)
):
    """Get courses for a specific child."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    
    courses = []
    if student.get("seccion_id"):
        seccion_id = student["seccion_id"]
        
        # Source of truth: subjects assigned to this section via section_id
        section_subjects = await db.subjects.find({
            "school_id": school_id,
            "section_id": seccion_id,
            "status": "active"
        }, {"_id": 0}).to_list(100)
        
        # Build teacher lookup from academic_assignments
        assignments = await db.academic_assignments.find({
            "school_id": school_id,
            "section_id": seccion_id,
            "status": "activo"
        }, {"_id": 0}).to_list(100)
        teacher_by_subject = {}
        for a in assignments:
            sid = a.get("subject_id")
            if sid and sid not in teacher_by_subject:
                teacher_by_subject[sid] = a.get("teacher_id")
        
        for subject in section_subjects:
            teacher_id = teacher_by_subject.get(subject["id"])
            teacher = None
            if teacher_id:
                teacher = await db.users.find_one({"id": teacher_id}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1})
            
            pending = await db.course_posts.count_documents({
                "school_id": school_id,
                "subject_id": subject["id"],
                "$or": [{"post_type": "task"}, {"type": "task"}],
                "due_date": {"$gte": datetime.now(timezone.utc).isoformat()}
            })
            
            courses.append({
                "id": subject["id"],
                "name": subject.get("name"),
                "description": subject.get("description"),
                "color": subject.get("color", "#3B82F6"),
                "icon": subject.get("icon"),
                "image_url": subject.get("image_url"),
                "teacher": {
                    "id": teacher["id"],
                    "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
                    "photo_url": teacher.get("photo_url")
                } if teacher else None,
                "pending_tasks": pending
            })
    
    return {"courses": courses}

@router.get("/parent/tasks")
async def get_parent_student_tasks(
    student_id: str = Query(..., description="ID del estudiante"),
    status: Optional[str] = Query(None, description="Filter by status: pending, submitted, graded"),
    current_user = Depends(get_current_user)
):
    """Get tasks for a specific child."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    
    # Get student's subjects from subjects collection (source of truth: section_id)
    subject_ids = []
    if student.get("seccion_id"):
        section_subjects = await db.subjects.find({
            "school_id": school_id,
            "section_id": student["seccion_id"],
            "status": "active"
        }, {"_id": 0, "id": 1}).to_list(100)
        subject_ids = [s["id"] for s in section_subjects]
    
    if not subject_ids:
        return {"tasks": [], "stats": {"total": 0, "pending": 0, "submitted": 0, "graded": 0}}
    
    # Get subjects map
    subjects = await db.subjects.find({"id": {"$in": subject_ids}}, {"_id": 0}).to_list(50)
    subjects_map = {s["id"]: s for s in subjects}
    
    # Get all tasks
    tasks_cursor = db.course_posts.find({
        "school_id": school_id,
        "subject_id": {"$in": subject_ids},
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0}).sort("due_date", -1)
    
    tasks = await tasks_cursor.to_list(200)
    
    # Get submissions for this student
    task_ids = [t["id"] for t in tasks]
    submissions = await db.task_submissions.find({
        "task_id": {"$in": task_ids},
        "student_id": student_id
    }, {"_id": 0}).to_list(200)
    submissions_map = {s["task_id"]: s for s in submissions}
    
    # Build response
    result = []
    stats = {"total": 0, "pending": 0, "submitted": 0, "graded": 0}
    
    for task in tasks:
        submission = submissions_map.get(task["id"])
        subject = subjects_map.get(task.get("subject_id"), {})
        
        # Determine task status
        task_status = "pending"
        if submission:
            if submission.get("grade") is not None:
                task_status = "graded"
            else:
                task_status = "submitted"
        
        stats["total"] += 1
        stats[task_status] += 1
        
        # Filter by status if provided
        if status and task_status != status:
            continue
        
        result.append({
            "id": task["id"],
            "title": task.get("title"),
            "description": task.get("content", "")[:200],
            "due_date": task.get("due_date"),
            "created_at": task.get("created_at"),
            "subject_id": task.get("subject_id"),
            "subject_name": subject.get("name", ""),
            "subject_color": subject.get("color", "#3B82F6"),
            "status": task_status,
            "submission": {
                "id": submission.get("id"),
                "submitted_at": submission.get("submitted_at"),
                "grade": submission.get("grade"),
                "feedback": submission.get("feedback")
            } if submission else None
        })
    
    return {"tasks": result, "stats": stats}

@router.get("/parent/grades")
async def get_parent_student_grades(
    student_id: str = Query(..., description="ID del estudiante"),
    subject_id: Optional[str] = Query(None, description="Filter by subject"),
    current_user = Depends(get_current_user)
):
    """Get grades for a specific child."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    
    # Get student's subjects from subjects collection (source of truth: section_id)
    subject_ids = []
    if student.get("seccion_id"):
        section_subjects = await db.subjects.find({
            "school_id": school_id,
            "section_id": student["seccion_id"],
            "status": "active"
        }, {"_id": 0, "id": 1}).to_list(100)
        subject_ids = [s["id"] for s in section_subjects]
    
    if subject_id and subject_id in subject_ids:
        subject_ids = [subject_id]
    
    if not subject_ids:
        return {"grades": [], "subjects": [], "average": None}
    
    # Get subjects
    subjects = await db.subjects.find({"id": {"$in": subject_ids}}, {"_id": 0}).to_list(50)
    subjects_map = {s["id"]: s for s in subjects}
    
    # Get grades
    grades_query = {
        "school_id": school_id,
        "student_id": student_id
    }
    if subject_ids:
        grades_query["subject_id"] = {"$in": subject_ids}
    
    grades = await db.grades_records.find(grades_query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Calculate averages by subject
    subject_grades = {}
    for grade in grades:
        sid = grade.get("subject_id")
        if sid not in subject_grades:
            subject_grades[sid] = []
        if grade.get("grade") is not None:
            try:
                subject_grades[sid].append(float(grade["grade"]))
            except:
                pass
    
    subjects_with_avg = []
    for s in subjects:
        grades_list = subject_grades.get(s["id"], [])
        avg = round(sum(grades_list) / len(grades_list), 2) if grades_list else None
        subjects_with_avg.append({
            "id": s["id"],
            "name": s.get("name"),
            "color": s.get("color", "#3B82F6"),
            "average": avg,
            "grades_count": len(grades_list)
        })
    
    # Overall average
    all_grades = [g for grades_list in subject_grades.values() for g in grades_list]
    overall_avg = round(sum(all_grades) / len(all_grades), 2) if all_grades else None
    
    # Build grades response
    grades_response = []
    for grade in grades:
        subject = subjects_map.get(grade.get("subject_id"), {})
        grades_response.append({
            "id": grade.get("id"),
            "subject_id": grade.get("subject_id"),
            "subject_name": subject.get("name", ""),
            "subject_color": subject.get("color", "#3B82F6"),
            "grade": grade.get("grade"),
            "evaluation_name": grade.get("evaluation_name", ""),
            "evaluation_type": grade.get("evaluation_type", ""),
            "feedback": grade.get("feedback"),
            "date": grade.get("created_at")
        })
    
    return {
        "grades": grades_response,
        "subjects": subjects_with_avg,
        "average": overall_avg
    }

@router.get("/parent/attendance")
async def get_parent_student_attendance(
    student_id: str = Query(..., description="ID del estudiante"),
    month: Optional[str] = Query(None, description="Filter by month (YYYY-MM)"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user = Depends(get_current_user)
):
    """Get attendance for a specific child."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    
    # Build query
    query = {
        "school_id": school_id,
        "user_id": student_id,
        "type": "student"
    }
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif month:
        query["date"] = {"$regex": f"^{month}"}
    
    records = await db.attendances.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Calculate stats
    stats = {"present": 0, "absent": 0, "late": 0, "justified": 0, "total": 0}
    
    for record in records:
        stats["total"] += 1
        status = record.get("status", "").lower()
        if status in ["presente", "present", "p"]:
            stats["present"] += 1
        elif status in ["ausente", "absent", "a"]:
            stats["absent"] += 1
        elif status in ["tardanza", "late", "t"]:
            stats["late"] += 1
        elif status in ["justificado", "justified", "j"]:
            stats["justified"] += 1
    
    attendance_rate = round((stats["present"] / stats["total"] * 100) if stats["total"] > 0 else 0, 1)
    
    return {
        "records": records,
        "stats": stats,
        "attendance_rate": attendance_rate
    }

@router.get("/parent/schedule")
async def get_parent_student_schedule(
    student_id: str = Query(..., description="ID del estudiante"),
    current_user = Depends(get_current_user)
):
    """Get class schedule for a specific child."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    seccion_id = student.get("seccion_id")
    grado_id = student.get("grado_id")
    
    # Get grade and section names
    grade_name = None
    section_name = None
    if grado_id:
        grado = await db.grades.find_one({"id": grado_id, "school_id": school_id}, {"_id": 0, "nombre": 1})
        if grado:
            grade_name = grado.get("nombre")
    if seccion_id:
        seccion = await db.sections.find_one({"id": seccion_id, "school_id": school_id}, {"_id": 0, "nombre": 1})
        if seccion:
            section_name = seccion.get("nombre")
    
    if not seccion_id:
        return {"schedules": [], "breaks": [], "settings": None, "grade_name": grade_name, "section_name": section_name}
    
    # Get schedule settings
    settings = await db.schedule_settings.find_one({"school_id": school_id}, {"_id": 0})
    
    # Get breaks for this grade/section
    breaks_query = {"school_id": school_id}
    if grado_id:
        breaks_query["grade_id"] = grado_id
    if seccion_id:
        breaks_query["section_id"] = seccion_id
    breaks = await db.schedule_breaks.find(breaks_query, {"_id": 0}).to_list(50)
    
    # Get schedule entries for this section
    schedules = await db.schedules.find({
        "school_id": school_id,
        "seccion_id": seccion_id
    }, {"_id": 0}).to_list(100)
    
    # Enrich with subject and teacher info
    for entry in schedules:
        if entry.get("subject_id"):
            subject = await db.subjects.find_one({"id": entry["subject_id"]}, {"_id": 0, "name": 1, "color": 1})
            if subject:
                entry["subject_name"] = subject.get("name")
                entry["subject_color"] = subject.get("color", "#3B82F6")
        
        if entry.get("teacher_id"):
            teacher = await db.users.find_one({"id": entry["teacher_id"]}, {"_id": 0, "name": 1, "last_name": 1})
            if teacher:
                entry["teacher_name"] = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
    
    return {"schedules": schedules, "breaks": breaks, "settings": settings, "grade_name": grade_name, "section_name": section_name}

@router.get("/parent/exam-schedule")
async def get_parent_student_exam_schedule(
    student_id: str = Query(..., description="ID del estudiante"),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get exam schedule for a specific child - mirrors student endpoint logic."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    grade_id = student.get("grado_id")
    section_id = student.get("seccion_id")
    
    # Get grade and section names
    grade_name = None
    section_name = None
    if grade_id:
        grade = await db.grades.find_one({"id": grade_id, "school_id": school_id}, {"_id": 0, "nombre": 1})
        if grade:
            grade_name = grade.get("nombre")
    if section_id:
        section = await db.sections.find_one({"id": section_id, "school_id": school_id}, {"_id": 0, "nombre": 1})
        if section:
            section_name = section.get("nombre")
    
    if not grade_id:
        return {"exams": [], "grade_name": grade_name, "section_name": section_name}
    
    # Get all subjects for the student's grade
    subjects = await db.subjects.find(
        {"grade_id": grade_id, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "teacher_id": 1}
    ).to_list(100)
    subject_ids = [s["id"] for s in subjects]
    subject_map = {s["id"]: s for s in subjects}
    
    if not subject_ids:
        return {"exams": [], "grade_name": grade_name, "section_name": section_name}
    
    # Query online_exams for published exams in these subjects
    query = {
        "school_id": school_id,
        "subject_id": {"$in": subject_ids},
        "status": "published"
    }
    
    if from_date or to_date:
        date_filter = {}
        if from_date:
            date_filter["$gte"] = from_date + "T00:00:00Z"
        if to_date:
            date_filter["$lte"] = to_date + "T23:59:59Z"
        if date_filter:
            query["start_datetime"] = date_filter
    
    exams = await db.online_exams.find(query, {"_id": 0}).sort("start_datetime", 1).to_list(100)
    
    # Enrich exams
    enriched_exams = []
    now = datetime.now(timezone.utc)
    
    for exam in exams:
        subject_info = subject_map.get(exam.get("subject_id"), {})
        teacher_name = None
        teacher_photo = None
        teacher_id = subject_info.get("teacher_id") or exam.get("created_by")
        
        if teacher_id:
            teacher = await db.users.find_one(
                {"id": teacher_id},
                {"_id": 0, "name": 1, "last_name": 1, "profile_image": 1, "photo_url": 1}
            )
            if teacher:
                teacher_name = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
                teacher_photo = teacher.get("profile_image") or teacher.get("photo_url")
        
        start_dt_str = exam.get("start_datetime", "")
        end_dt_str = exam.get("end_datetime", "")
        
        try:
            start_dt = datetime.fromisoformat(start_dt_str.replace("Z", "+00:00"))
        except Exception:
            start_dt = now
        try:
            end_dt = datetime.fromisoformat(end_dt_str.replace("Z", "+00:00"))
        except Exception:
            end_dt = now
        
        exam_date = start_dt.strftime("%Y-%m-%d")
        start_time = start_dt.strftime("%H:%M")
        end_time = end_dt.strftime("%H:%M")
        
        if now < start_dt:
            status = "upcoming"
        elif start_dt <= now <= end_dt:
            status = "in_progress"
        else:
            status = "completed"
        
        # Check if student already attempted
        attempt = await db.exam_attempts.find_one(
            {"exam_id": exam["id"], "student_id": student_id},
            {"_id": 0, "id": 1, "status": 1, "score": 1}
        )
        
        enriched_exams.append({
            "id": exam["id"],
            "title": exam.get("title", ""),
            "description": exam.get("description", ""),
            "subject_id": exam.get("subject_id"),
            "subject_name": subject_info.get("name", ""),
            "date": exam_date,
            "start_time": start_time,
            "end_time": end_time,
            "start_datetime": start_dt_str,
            "end_datetime": end_dt_str,
            "duration_minutes": exam.get("duration_minutes", 60),
            "teacher_name": teacher_name,
            "teacher_photo": teacher_photo,
            "status": status,
            "has_attempted": attempt is not None,
            "attempt_status": attempt.get("status") if attempt else None,
            "attempt_score": attempt.get("score") if attempt else None,
            "type": exam.get("type", "regular"),
        })
    
    return {
        "exams": enriched_exams,
        "grade_name": grade_name,
        "section_name": section_name
    }


@router.get("/parent/classmates")
async def get_parent_student_classmates(
    student_id: str = Query(..., description="ID del estudiante"),
    current_user = Depends(get_current_user)
):
    """Get classmates of a specific child."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    seccion_id = student.get("seccion_id")
    
    if not seccion_id:
        return {"students": []}
    
    students = await db.users.find(
        {"school_id": school_id, "seccion_id": seccion_id, "role": "student", **ACADEMIC_STUDENT_FILTER},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1}
    ).to_list(100)
    
    return {"students": students}


@router.get("/parent/messages/inbox")
async def get_parent_student_inbox(
    student_id: str = Query(..., description="ID del estudiante"),
    current_user = Depends(get_current_user)
):
    """Get inbox messages for parent viewing child's messages."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    student = await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    
    # Get messages where student is recipient
    pipeline = [
        {"$match": {
            "school_id": school_id,
            "recipients": {
                "$elemMatch": {
                    "user_id": student_id,
                    "is_deleted": {"$ne": True},
                    "is_archived": {"$ne": True}
                }
            }
        }},
        {"$sort": {"created_at": -1}},
        {"$limit": 50}
    ]
    
    messages = await db.internal_mail.aggregate(pipeline).to_list(50)
    
    # Enrich with sender info
    result = []
    for msg in messages:
        sender = await db.users.find_one({"id": msg.get("sender_id")}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1})
        
        # Find recipient status for this student
        recipient_status = next((r for r in msg.get("recipients", []) if r.get("user_id") == student_id), {})
        
        result.append({
            "id": msg.get("id"),
            "subject": msg.get("subject"),
            "content": msg.get("content", "")[:100],
            "created_at": msg.get("created_at"),
            "is_read": recipient_status.get("is_read", False),
            "sender": {
                "id": sender["id"],
                "name": f"{sender.get('name', '')} {sender.get('last_name', '')}".strip(),
                "photo_url": sender.get("photo_url"),
                "role": sender.get("role")
            } if sender else None
        })
    
    return {"messages": result}

@router.get("/parent/messages/stats")
async def get_parent_student_message_stats(
    student_id: str = Query(..., description="ID del estudiante"),
    current_user = Depends(get_current_user)
):
    """Get message stats for parent viewing child's messages."""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    await verify_parent_student_access(user, student_id)
    school_id = user.get("school_id")
    
    # Count unread messages
    unread_pipeline = [
        {"$match": {
            "school_id": school_id,
            "recipients": {
                "$elemMatch": {
                    "user_id": student_id,
                    "is_read": False,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    unread_result = await db.internal_mail.aggregate(unread_pipeline).to_list(1)
    unread_count = unread_result[0]["count"] if unread_result else 0
    
    # Count total inbox
    inbox_count = await db.internal_mail.count_documents({
        "school_id": school_id,
        "recipients": {
            "$elemMatch": {
                "user_id": student_id,
                "is_deleted": {"$ne": True},
                "is_archived": {"$ne": True}
            }
        }
    })
    
    return {
        "unread": unread_count,
        "inbox": inbox_count
    }


# ══════════════════════════════════════════════════════════════════════════════
# SELF-SERVICE: manage a PENDING child I registered (edit / delete before approval)
# ══════════════════════════════════════════════════════════════════════════════

def _is_parent_of_pending(parent_user: dict, child: dict) -> bool:
    """Verify that the given child (pending) is linked to this parent."""
    if not parent_user or not child:
        return False
    if parent_user.get("role") != "parent":
        return False
    if parent_user.get("school_id") != child.get("school_id"):
        return False
    pid = parent_user.get("id")
    cid = child.get("id")
    return (
        child.get("padre_id") == pid
        or child.get("parent_id") == pid
        or cid in (parent_user.get("student_ids") or [])
        or cid in (parent_user.get("children_ids") or [])
    )


@router.get("/parent/children/pending/{child_id}")
async def parent_get_pending_child(child_id: str, current_user = Depends(get_current_user)):
    """Fetch full details of a PENDING child so the parent can edit it."""
    parent = await resolve_user_from_token(current_user)
    if not parent or parent.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para padres/apoderados")

    child = await db.users.find_one(
        {"id": child_id, "role": "student"},
        {"_id": 0, "password": 0, "plain_password": 0}
    )
    if not child:
        raise HTTPException(status_code=404, detail="Hijo no encontrado")

    if not _is_parent_of_pending(parent, child):
        raise HTTPException(status_code=403, detail="No tienes permiso sobre este estudiante")

    enrollment_status = (child.get("enrollment_status") or "").lower()
    student_status = (child.get("student_status") or "").lower()
    if enrollment_status != "pending" and student_status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Solo puedes consultar hijos que aún están pendientes de aprobación."
        )

    return {"child": child}


@router.delete("/parent/children/pending/{child_id}")
async def parent_delete_pending_child(child_id: str, current_user = Depends(get_current_user)):
    """Delete a PENDING or REJECTED child that the authenticated parent created themselves.

    Rules:
      - The caller must be a `parent` linked to that child.
      - The child must be `enrollment_status == "pending"` or `"rejected"`.
      - The child is removed from `db.users` and unlinked from the parent.
    """
    parent = await resolve_user_from_token(current_user)
    if not parent or parent.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para padres/apoderados")

    child = await db.users.find_one(
        {"id": child_id, "role": "student"},
        {"_id": 0}
    )
    if not child:
        raise HTTPException(status_code=404, detail="Hijo no encontrado")

    if not _is_parent_of_pending(parent, child):
        raise HTTPException(status_code=403, detail="No tienes permiso sobre este estudiante")

    # Only pending or rejected children may be self-deleted by the parent.
    enrollment_status = (child.get("enrollment_status") or "").lower()
    student_status = (child.get("student_status") or "").lower()
    is_pending = enrollment_status == "pending" or student_status == "pending"
    is_rejected = enrollment_status == "rejected"
    if not (is_pending or is_rejected):
        raise HTTPException(
            status_code=400,
            detail="Solo puedes eliminar hijos pendientes o no aprobados."
        )

    # Hard-delete the student doc
    await db.users.delete_one({"id": child_id, "role": "student"})

    # Unlink from the parent user doc (remove from list fields)
    await db.users.update_one(
        {"id": parent["id"]},
        {"$pull": {"student_ids": child_id, "children_ids": child_id}}
    )

    # Audit log (best-effort)
    try:
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "school_id": parent.get("school_id"),
            "user_id": parent["id"],
            "action": "parent_deleted_pending_child",
            "resource_type": "student",
            "resource_id": child_id,
            "metadata": {"child_name": f"{child.get('name','')} {child.get('last_name','')}".strip()},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    return {"message": "Hijo eliminado correctamente"}


@router.patch("/parent/children/pending/{child_id}")
async def parent_edit_pending_child(child_id: str, request: Request, current_user = Depends(get_current_user)):
    """Edit a PENDING child that the authenticated parent created themselves.

    Allowed fields (whitelisted):
      name, last_name, dni, birthday, gender, phone, email, address, notes,
      grado_id, seccion_id, nivel_educativo_id.

    Any other field is silently ignored.
    """
    parent = await resolve_user_from_token(current_user)
    if not parent or parent.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para padres/apoderados")

    child = await db.users.find_one({"id": child_id, "role": "student"}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Hijo no encontrado")

    if not _is_parent_of_pending(parent, child):
        raise HTTPException(status_code=403, detail="No tienes permiso sobre este estudiante")

    enrollment_status = (child.get("enrollment_status") or "").lower()
    student_status = (child.get("student_status") or "").lower()
    if enrollment_status != "pending" and student_status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Solo puedes editar hijos que aún están pendientes de aprobación."
        )

    body = await request.json()
    allowed = {
        "name", "last_name", "dni", "birthday", "gender",
        "phone", "email", "address", "notes", "photo_url",
        "nivel_id", "grado_id", "seccion_id", "turno_id",
        "colegio_anterior", "codigo_modular", "ultimo_grado_cursado", "ano_lectivo_anterior",
        "condiciones_medicas", "alergias",
        "doctor_nombre", "doctor_telefono",
        "persona_autorizada", "persona_autorizada_telefono",
    }
    updates = {k: v for k, v in (body or {}).items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="Sin campos válidos para actualizar")

    # Basic uniqueness check on DNI / email within the same school
    school_id = parent.get("school_id")
    if updates.get("dni"):
        exists = await db.users.find_one(
            {"school_id": school_id, "dni": updates["dni"], "id": {"$ne": child_id}},
            {"_id": 0, "id": 1}
        )
        if exists:
            raise HTTPException(status_code=400, detail=f"El DNI {updates['dni']} ya está en uso")
    if updates.get("email"):
        exists = await db.users.find_one(
            {"school_id": school_id, "email": updates["email"], "id": {"$ne": child_id}},
            {"_id": 0, "id": 1}
        )
        if exists:
            raise HTTPException(status_code=400, detail=f"El correo {updates['email']} ya está en uso")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"id": child_id, "role": "student"},
        {"$set": updates}
    )

    updated = await db.users.find_one(
        {"id": child_id},
        {"_id": 0, "password": 0}
    )
    return {"message": "Datos del hijo actualizados correctamente", "child": updated}


# ══════════════════════════════════════════════════════════════════════════════

