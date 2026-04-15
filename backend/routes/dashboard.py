"""
Dashboard metrics, stats, banners
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
    require_school,
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# PROTECTED DASHBOARD ROUTES (REQUIRE SCHOOL_ID)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/metrics")
async def get_metrics(current_user=Depends(require_school)):
    """Get metrics for current tenant - REQUIRES SCHOOL"""
    school_id = current_user.get("school_id")
    
    # Calculate real counts from database
    students_count = await db.users.count_documents({"school_id": school_id, "role": "student", **ACADEMIC_STUDENT_FILTER})
    teachers_count = await db.users.count_documents({"school_id": school_id, "role": "teacher"})
    subjects_count = await db.subjects.count_documents({"school_id": school_id})
    
    # Count unread messages for current user
    unread_messages = await db.messages.count_documents({
        "recipient_id": current_user.get("sub"),
        "read": False
    })
    
    # Try to get school-specific additional metrics
    metrics = await db.metrics.find_one({"tenant_id": school_id}, {"_id": 0})
    
    return {
        "students": students_count,
        "teachers": teachers_count,
        "subjects": subjects_count,
        "unread_messages": unread_messages,
        "exams_projected": metrics.get("exams_projected", 0) if metrics else 0,
        "tasks_delivered": metrics.get("tasks_delivered", 0) if metrics else 0,
        "avg_students": students_count,  # Use real count
    }


@router.get("/dashboard/owner-stats")
async def get_owner_stats(current_user=Depends(require_school)):
    """KPI stats for school owner/propietario dashboard only"""
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    role = user.get("role", "")
    is_owner = user.get("is_owner") or role == "owner"
    is_support = user.get("is_support_session") or current_user.get("scope") == "support_switch"
    
    if not is_owner and not is_support:
        raise HTTPException(status_code=403, detail="Solo el propietario puede acceder a estas estadisticas")
    
    school_id = user.get("school_id") or current_user.get("school_id")
    
    students = await db.users.count_documents({
        "school_id": school_id, "role": "student", **ACADEMIC_STUDENT_FILTER
    })
    teachers = await db.users.count_documents({
        "school_id": school_id, "role": "teacher"
    })
    
    # Mensajes sin leer - usa internal_mail (misma fuente que la campanita)
    user_id = current_user.get("sub")
    unread_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user_id,
                    "is_read": False,
                    "is_deleted": {"$ne": True},
                    "is_archived": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    unread_result = await db.internal_mail.aggregate(unread_pipeline).to_list(1)
    unread_messages = unread_result[0]["count"] if unread_result else 0
    
    # Ingresos del mes actual - datos reales del módulo de contabilidad
    now = datetime.now(timezone.utc)
    first_day = now.replace(day=1).strftime("%Y-%m-%d")
    # Sumar total_amount de pagos pagados este mes
    pipeline = [
        {"$match": {
            "school_id": school_id,
            "payment_status": "paid",
            "payment_date": {"$gte": first_day}
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$total_amount"}
        }}
    ]
    result = await db.payments.aggregate(pipeline).to_list(1)
    monthly_income = round(result[0]["total"], 2) if result and result[0].get("total") else 0
    
    return {
        "students": students,
        "teachers": teachers,
        "monthly_income": monthly_income,
        "unread_messages": unread_messages
    }

@router.get("/dashboard/monthly-income")
async def get_monthly_income(current_user=Depends(require_school)):
    """Ingresos del mes actual desde el módulo de contabilidad"""
    user = await resolve_user_from_token(current_user)
    school_id = (user or {}).get("school_id") or current_user.get("school_id")
    now = datetime.now(timezone.utc)
    first_day = now.replace(day=1).strftime("%Y-%m-%d")
    pipeline = [
        {"$match": {
            "school_id": school_id,
            "payment_status": "paid",
            "payment_date": {"$gte": first_day}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    result = await db.payments.aggregate(pipeline).to_list(1)
    amount = round(result[0]["total"], 2) if result and result[0].get("total") else 0
    return {"amount": amount}


@router.get("/dashboard/monthly-attendance")
async def get_monthly_attendance(current_user=Depends(require_school)):
    """Asistencia promedio mensual para la gráfica del dashboard propietario"""
    user = await resolve_user_from_token(current_user)
    school_id = (user or {}).get("school_id") or current_user.get("school_id")
    
    now = datetime.now(timezone.utc)
    year = now.year
    months_es = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
    
    # Periodo escolar: Marzo a Diciembre (Perú)
    # Incluimos meses pasados hasta el mes actual
    result = []
    
    total_students = await db.users.count_documents({"school_id": school_id, "role": "student", **ACADEMIC_STUDENT_FILTER})
    if total_students == 0:
        total_students = 1  # Evitar division por cero
    
    for month_idx in range(12):
        month_num = month_idx + 1
        # Solo incluir meses hasta el actual
        if year == now.year and month_num > now.month:
            break
        
        first_day = f"{year}-{month_num:02d}-01"
        if month_num == 12:
            last_day = f"{year + 1}-01-01"
        else:
            last_day = f"{year}-{month_num + 1:02d}-01"
        
        # Contar registros de asistencia del mes
        total_records = await db.attendances.count_documents({
            "school_id": school_id,
            "type": "student",
            "date": {"$gte": first_day, "$lt": last_day}
        })
        
        present_records = await db.attendances.count_documents({
            "school_id": school_id,
            "type": "student",
            "date": {"$gte": first_day, "$lt": last_day},
            "status": {"$in": ["present", "late", "justified"]}
        })
        
        if total_records > 0:
            attendance_pct = round((present_records / total_records) * 100, 1)
        else:
            attendance_pct = 0
        
        result.append({
            "month": months_es[month_idx],
            "attendance": attendance_pct,
            "total_records": total_records,
            "present_records": present_records
        })
    
    return result


@router.get("/dashboard/current-month-attendance")
async def get_current_month_attendance(current_user=Depends(require_school)):
    """Asistencia del mes actual desglosada: presentes, tardanzas, ausentes."""
    user = await resolve_user_from_token(current_user)
    school_id = (user or {}).get("school_id") or current_user.get("school_id")

    now = datetime.now(timezone.utc)
    first_day = f"{now.year}-{now.month:02d}-01"
    if now.month == 12:
        next_month = f"{now.year + 1}-01-01"
    else:
        next_month = f"{now.year}-{now.month + 1:02d}-01"

    months_es = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

    base_filter = {
        "school_id": school_id,
        "type": "student",
        "date": {"$gte": first_day, "$lt": next_month},
    }

    total = await db.attendances.count_documents(base_filter)
    present = await db.attendances.count_documents({**base_filter, "status": "present"})
    late = await db.attendances.count_documents({**base_filter, "status": "late"})
    absent = await db.attendances.count_documents({**base_filter, "status": "absent"})
    justified = await db.attendances.count_documents({**base_filter, "status": "justified"})

    if total > 0:
        present_pct = round(((present + justified) / total) * 100, 1)
        late_pct = round((late / total) * 100, 1)
        absent_pct = round((absent / total) * 100, 1)
    else:
        present_pct = 0
        late_pct = 0
        absent_pct = 0

    # Previous month for trend
    if now.month == 1:
        prev_first = f"{now.year - 1}-12-01"
        prev_next = f"{now.year}-01-01"
    else:
        prev_first = f"{now.year}-{now.month - 1:02d}-01"
        prev_next = first_day

    prev_total = await db.attendances.count_documents({
        "school_id": school_id, "type": "student",
        "date": {"$gte": prev_first, "$lt": prev_next},
    })
    prev_present = await db.attendances.count_documents({
        "school_id": school_id, "type": "student",
        "date": {"$gte": prev_first, "$lt": prev_next},
        "status": {"$in": ["present", "justified"]},
    })
    prev_pct = round((prev_present / prev_total) * 100, 1) if prev_total > 0 else 0
    trend = round(present_pct - prev_pct, 1) if prev_total > 0 else 0

    return {
        "month_name": months_es[now.month - 1],
        "year": now.year,
        "total_records": total,
        "present_pct": present_pct,
        "late_pct": late_pct,
        "absent_pct": absent_pct,
        "trend": trend,
    }



@router.get("/dashboard/monthly-payments")
async def get_monthly_payments(current_user=Depends(require_school)):
    """Ingresos mensuales: pagados, pendientes y vencidos por mes"""
    user = await resolve_user_from_token(current_user)
    school_id = (user or {}).get("school_id") or current_user.get("school_id")
    
    year = datetime.now(timezone.utc).year
    months_es = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
    current_month = datetime.now(timezone.utc).month
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    result = []
    for month_idx in range(12):
        month_num = month_idx + 1
        if month_num > current_month:
            break
        
        first_day = f"{year}-{month_num:02d}-01"
        if month_num == 12:
            last_day = f"{year + 1}-01-01"
        else:
            last_day = f"{year}-{month_num + 1:02d}-01"
        
        base_match = {"school_id": school_id, "payment_date": {"$gte": first_day, "$lt": last_day}}
        
        # Pagados
        paid_agg = await db.payments.aggregate([
            {"$match": {**base_match, "payment_status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]).to_list(1)
        paid = round(paid_agg[0]["total"], 2) if paid_agg and paid_agg[0].get("total") else 0
        
        # Pendientes (fecha aun no vencida) - solo meses actuales/futuros
        pending_match = {
            "school_id": school_id,
            "payment_date": {"$gte": first_day, "$lt": last_day},
            "payment_status": "pending"
        }
        if month_num == current_month:
            # Solo pendientes cuya fecha aun no paso
            pending_match["payment_date"] = {"$gte": today, "$lt": last_day}
        elif month_num < current_month:
            # Meses pasados: no hay pendientes, todo es vencido
            pending = 0
            pending_agg = None
        
        if pending_match.get("payment_status"):
            pending_agg = await db.payments.aggregate([
                {"$match": pending_match},
                {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
            ]).to_list(1)
            pending = round(pending_agg[0]["total"], 2) if pending_agg and pending_agg[0].get("total") else 0
        
        # Vencidos/morosos (pendiente con fecha ya pasada, dentro del rango del mes)
        overdue_match = {
            "school_id": school_id,
            "payment_date": {"$gte": first_day, "$lt": last_day},
            "payment_status": {"$in": ["pending", "overdue"]}
        }
        if month_num == current_month:
            overdue_match["payment_date"] = {"$gte": first_day, "$lt": today}
        
        overdue_agg = await db.payments.aggregate([
            {"$match": overdue_match},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]).to_list(1)
        overdue = round(overdue_agg[0]["total"], 2) if overdue_agg and overdue_agg[0].get("total") else 0
        
        result.append({
            "month": months_es[month_idx],
            "paid": paid,
            "pending": pending,
            "overdue": overdue
        })
    
    return result




# ══════════════════════════════════════════════════════════════════════════════

# DASHBOARD BANNERS (CAROUSEL)
# ══════════════════════════════════════════════════════════════════════════════

class BannerCreate(BaseModel):
    image_url: str
    title: Optional[str] = ""
    description: Optional[str] = ""
    order: Optional[int] = 0
    active: Optional[bool] = True

class BannerUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    active: Optional[bool] = None

class BannerReorder(BaseModel):
    banner_ids: List[str]

@router.get("/dashboard/banners")
async def get_dashboard_banners(current_user = Depends(get_current_user)):
    """Get all dashboard banners for the current tenant"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    banners = await db.dashboard_banners.find(
        {"school_id": user["school_id"]},
        {"_id": 0}
    ).sort("order", 1).to_list(50)
    
    return banners

@router.get("/dashboard/banners/active")
async def get_active_dashboard_banners(current_user = Depends(get_current_user)):
    """Get only active dashboard banners for display"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    banners = await db.dashboard_banners.find(
        {"school_id": user["school_id"], "active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(50)
    
    return banners

@router.post("/dashboard/banners")
async def create_dashboard_banner(data: BannerCreate, current_user = Depends(get_current_user)):
    """Create a new dashboard banner - only for owners/super admins"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check if user is owner or super_admin
    if not (user.get("is_owner") or user.get("is_super_admin") or user.get("role") in ["owner", "super_admin", "director"]):
        raise HTTPException(status_code=403, detail="Solo el propietario puede administrar el carrusel")
    
    school_id = user["school_id"]
    
    # Get current max order
    max_order_banner = await db.dashboard_banners.find_one(
        {"school_id": school_id},
        sort=[("order", -1)]
    )
    next_order = (max_order_banner.get("order", 0) + 1) if max_order_banner else 0
    
    banner_id = str(uuid.uuid4())
    banner_doc = {
        "id": banner_id,
        "school_id": school_id,
        "image_url": data.image_url,
        "title": data.title[:60] if data.title else "",  # Max 60 chars
        "description": data.description[:120] if data.description else "",  # Max 120 chars
        "order": data.order if data.order > 0 else next_order,
        "active": data.active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.dashboard_banners.insert_one(banner_doc)
    
    logger.info(f"Dashboard banner created: {banner_id} for school {school_id}")
    
    return {"message": "Banner creado correctamente", "banner": {k: v for k, v in banner_doc.items() if k != "_id"}}

@router.put("/dashboard/banners/{banner_id}")
async def update_dashboard_banner(banner_id: str, data: BannerUpdate, current_user = Depends(get_current_user)):
    """Update a dashboard banner"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not (user.get("is_owner") or user.get("is_super_admin") or user.get("role") in ["owner", "super_admin", "director"]):
        raise HTTPException(status_code=403, detail="Solo el propietario puede administrar el carrusel")
    
    banner = await db.dashboard_banners.find_one({"id": banner_id, "school_id": user["school_id"]})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    
    update_data = {}
    if data.title is not None:
        update_data["title"] = data.title[:60]  # Max 60 chars
    if data.description is not None:
        update_data["description"] = data.description[:120]  # Max 120 chars
    if data.order is not None:
        update_data["order"] = data.order
    if data.active is not None:
        update_data["active"] = data.active
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.dashboard_banners.update_one({"id": banner_id}, {"$set": update_data})
    
    return {"message": "Banner actualizado correctamente"}

@router.put("/dashboard/banners/reorder")
async def reorder_dashboard_banners(data: BannerReorder, current_user = Depends(get_current_user)):
    """Reorder dashboard banners"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not (user.get("is_owner") or user.get("is_super_admin") or user.get("role") in ["owner", "super_admin", "director"]):
        raise HTTPException(status_code=403, detail="Solo el propietario puede administrar el carrusel")
    
    # Update order for each banner
    for index, banner_id in enumerate(data.banner_ids):
        await db.dashboard_banners.update_one(
            {"id": banner_id, "school_id": user["school_id"]},
            {"$set": {"order": index, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Orden actualizado correctamente"}

@router.delete("/dashboard/banners/{banner_id}")
async def delete_dashboard_banner(banner_id: str, current_user = Depends(get_current_user)):
    """Delete a dashboard banner"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not (user.get("is_owner") or user.get("is_super_admin") or user.get("role") in ["owner", "super_admin", "director"]):
        raise HTTPException(status_code=403, detail="Solo el propietario puede administrar el carrusel")
    
    result = await db.dashboard_banners.delete_one({"id": banner_id, "school_id": user["school_id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    
    logger.info(f"Dashboard banner deleted: {banner_id}")
    
    return {"message": "Banner eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════

