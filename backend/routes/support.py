"""
Support Panel Router - Global Support Admin endpoints
Handles: Dashboard overview, school listing, school switching, profile management
Only accessible by users with role 'system_admin_global'
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt

from .core import (
    db, client, get_current_user, hash_password, verify_password,
    JWT_SECRET, JWT_ALGORITHM, now_iso
)
import jwt

router = APIRouter(prefix="/api/support", tags=["support"])

# ══════════════════════════════════════════════════════════════════════════════
# FILTER - Exclude trashed schools from normal queries
# ══════════════════════════════════════════════════════════════════════════════

NOT_IN_TRASH = {"$or": [{"status": {"$ne": "papelera"}}, {"status": {"$exists": False}}]}

# ══════════════════════════════════════════════════════════════════════════════
# AUTH HELPER - Require system_admin_global role
# ══════════════════════════════════════════════════════════════════════════════

async def require_support_admin(current_user=Depends(get_current_user)):
    """Only system_admin_global users can access support endpoints"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user or user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo administradores de soporte global.")
    return user


# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════

class SwitchSchoolRequest(BaseModel):
    school_id: str

class SupportProfileUpdate(BaseModel):
    name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None
    whatsapp: Optional[str] = None

class SupportPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/overview")
async def support_overview(user=Depends(require_support_admin)):
    """Dashboard overview: global metrics for support admin"""
    total_schools = await db.schools.count_documents(NOT_IN_TRASH)
    
    # Global admin sees all schools (minus unassigned)
    if user.get("role") == "system_admin_global":
        unassigned_count = await db.user_school_roles.count_documents(
            {"user_id": user["id"], "unassigned": True}
        )
        assignments = total_schools - unassigned_count
    else:
        assignments = await db.user_school_roles.count_documents({"user_id": user["id"]})
    
    # Total users globally
    total_users = await db.users.count_documents({})
    
    # Last 5 schools created (page 1 default)
    last_schools_cursor = db.schools.find(
        NOT_IN_TRASH, {"_id": 0, "id": 1, "name": 1, "subdomain": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5)
    last_schools = await last_schools_cursor.to_list(length=5)
    
    return {
        "total_schools": total_schools,
        "my_assigned_schools": assignments,
        "total_users_global": total_users,
        "last_schools_created": last_schools
    }


@router.get("/schools-paginated")
async def support_schools_paginated(page: int = 1, per_page: int = 5, user=Depends(require_support_admin)):
    """Paginated list of all schools for dashboard"""
    skip = (page - 1) * per_page
    total = await db.schools.count_documents(NOT_IN_TRASH)
    schools_cursor = db.schools.find(
        NOT_IN_TRASH, {"_id": 0, "id": 1, "name": 1, "subdomain": 1, "created_at": 1}
    ).sort("created_at", -1).skip(skip).limit(per_page)
    schools = await schools_cursor.to_list(length=per_page)
    total_pages = max(1, (total + per_page - 1) // per_page)
    return {
        "schools": schools,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


@router.get("/schools")
async def support_schools(user=Depends(require_support_admin)):
    """List ALL schools for support user. Global admins see everything."""
    
    is_global = user.get("role") == "system_admin_global"
    
    if is_global:
        # Global admin sees ALL schools (excluding trash)
        schools_cursor = db.schools.find(
            NOT_IN_TRASH,
            {"_id": 0, "id": 1, "name": 1, "school_name": 1, "subdomain": 1, "created_at": 1, "expiration_date": 1, "fecha_vencimiento": 1, "plan_estado": 1, "dias_vencido": 1, "logo_url": 1, "pricing_override": 1, "is_demo": 1}
        )
        schools = await schools_cursor.to_list(length=500)
        assignment_map = {}
    else:
        # Non-global support: only assigned schools
        assignments_cursor = db.user_school_roles.find(
            {"user_id": user["id"], "unassigned": {"$ne": True}}, {"_id": 0}
        )
        assignments = await assignments_cursor.to_list(length=500)
        
        if not assignments:
            return []
        
        school_ids = [a["school_id"] for a in assignments]
        assignment_map = {a["school_id"]: a for a in assignments}
        
        schools_cursor = db.schools.find(
            {"id": {"$in": school_ids}},
            {"_id": 0, "id": 1, "name": 1, "school_name": 1, "subdomain": 1, "created_at": 1, "expiration_date": 1, "fecha_vencimiento": 1, "plan_estado": 1, "dias_vencido": 1, "logo_url": 1, "pricing_override": 1, "is_demo": 1}
        )
        schools = await schools_cursor.to_list(length=500)
    
    # Get global pricing config
    global_pricing = await db.pricing_config.find_one({"id": "global"}, {"_id": 0})
    if not global_pricing:
        global_pricing = {"billing_mode": "base_plus_student", "base_monthly_fee": 50.0, "per_student_fee": 0.70, "per_student_from_month": 3, "flat_fee": 0.0}
    
    now = datetime.now(timezone.utc)
    
    # Enrich with user counts, role info, and calculated pricing
    result = []
    for school in schools:
        sid = school["id"]
        student_count = await db.users.count_documents({"school_id": sid, "role": "student"})
        teacher_count = await db.users.count_documents({"school_id": sid, "role": "teacher"})
        total_count = await db.users.count_documents({"school_id": sid})
        
        # Calculate months active
        months_active = 1
        if school.get("created_at"):
            try:
                created = datetime.fromisoformat(str(school["created_at"]).replace("Z", "+00:00"))
                months_active = max(1, (now.year - created.year) * 12 + now.month - created.month + 1)
            except Exception:
                pass
        
        # Effective pricing (override > global)
        override = school.get("pricing_override")
        def eff_v(key, default):
            if override and key in override:
                return override[key]
            return global_pricing.get(key, default)
        
        eff_mode = eff_v("billing_mode", "base_plus_student")
        eff_base = eff_v("base_monthly_fee", 50.0)
        eff_student_fee = eff_v("per_student_fee", 0.70)
        eff_from_month = eff_v("per_student_from_month", 3)
        eff_flat = eff_v("flat_fee", 0.0)
        
        calculated_price, student_charge, base_charge = calc_price(
            eff_mode, eff_base, eff_student_fee, eff_from_month, eff_flat, student_count, months_active
        )
        per_student_applies = eff_mode != "flat_fee" and months_active >= eff_from_month
        
        # Check if payment exists for this school (any payment ever)
        payment_count = await db.finance_entries.count_documents(
            {"school_id": sid, "type": "income"}
        )
        
        # A school needs payment if it has NO finance entries at all
        missing_payment = payment_count == 0
        
        # Calculate plan state
        from .subscription import calculate_plan_state
        plan_estado, dias_vencido = await calculate_plan_state(school)
        
        # Check for pending payment requests (with details for notifications)
        pending_payments_cursor = db.payment_requests.find(
            {"school_id": sid, "status": "processing"},
            {"_id": 0, "id": 1, "operation_code": 1, "amount": 1, "payment_method": 1, "requested_by_name": 1, "created_at": 1}
        ).sort("created_at", -1)
        pending_payments = await pending_payments_cursor.to_list(length=20)
        
        assignment = assignment_map.get(sid, {})
        result.append({
            **school,
            "plan_estado": plan_estado,
            "dias_vencido": dias_vencido,
            "has_pending_payment": len(pending_payments) > 0,
            "pending_payments_count": len(pending_payments),
            "pending_payments": pending_payments,
            "role_in_school": assignment.get("role_in_school", "system_admin"),
            "is_system_assignment": assignment.get("is_system_assignment", True),
            "student_count": student_count,
            "teacher_count": teacher_count,
            "total_users": total_count,
            "months_active": months_active,
            "billing_mode": eff_mode,
            "calculated_price": calculated_price,
            "base_charge": base_charge,
            "student_charge": student_charge,
            "per_student_fee": eff_student_fee,
            "per_student_from_month": eff_from_month,
            "flat_fee": eff_flat,
            "per_student_applies": per_student_applies,
            "missing_payment": missing_payment,
        })
    
    # Enrich with owner's school_display_name (prefer it over school.name)
    school_ids_list = [s["id"] for s in result]
    if school_ids_list:
        owners_cursor = db.users.find(
            {"school_id": {"$in": school_ids_list}, "role": "owner"},
            {"_id": 0, "school_id": 1, "school_display_name": 1}
        )
        owners = await owners_cursor.to_list(length=500)
        owner_display_map = {o["school_id"]: o.get("school_display_name", "") for o in owners if o.get("school_display_name")}
        for s in result:
            display_name = owner_display_map.get(s["id"])
            if display_name:
                s["name"] = display_name

    # Sort by name
    result.sort(key=lambda x: x.get("name", ""))
    return result


@router.get("/all-schools")
async def support_all_schools(user=Depends(require_support_admin)):
    """List ALL schools in the system (for assignment management)"""
    schools_cursor = db.schools.find(
        NOT_IN_TRASH, {"_id": 0, "id": 1, "name": 1, "subdomain": 1, "created_at": 1, "expiration_date": 1, "pricing_override": 1}
    )
    schools = await schools_cursor.to_list(length=1000)
    
    # Get current assignments (only active ones, not unassigned)
    assignments_cursor = db.user_school_roles.find(
        {"user_id": user["id"], "unassigned": {"$ne": True}}, {"_id": 0, "school_id": 1}
    )
    assignments = await assignments_cursor.to_list(length=1000)
    assigned_ids = {a["school_id"] for a in assignments}
    
    for school in schools:
        school["is_assigned"] = school["id"] in assigned_ids
    
    return schools


@router.post("/assign-school")
async def assign_school(req: SwitchSchoolRequest, user=Depends(require_support_admin)):
    """Assign a school to the support user"""
    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    existing = await db.user_school_roles.find_one(
        {"user_id": user["id"], "school_id": req.school_id}
    )
    if existing:
        if existing.get("unassigned"):
            # Re-assign a previously unassigned school
            await db.user_school_roles.update_one(
                {"user_id": user["id"], "school_id": req.school_id},
                {"$unset": {"unassigned": "", "unassigned_at": ""}}
            )
            return {"message": f"Acceso reasignado a {school.get('name', school.get('subdomain'))}"}
        raise HTTPException(status_code=400, detail="Ya tienes acceso a este colegio")
    
    await db.user_school_roles.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "school_id": req.school_id,
        "role_in_school": "system_admin",
        "is_system_assignment": True,
        "created_at": now_iso(),
        "updated_at": now_iso()
    })
    
    return {"message": f"Acceso asignado a {school.get('name', school.get('subdomain'))}"}


@router.delete("/unassign-school/{school_id}")
async def unassign_school(school_id: str, user=Depends(require_support_admin)):
    """Remove school assignment from support user"""
    if user.get("role") == "system_admin_global":
        # For global admins, mark as explicitly unassigned instead of deleting
        # This prevents the auto-assign logic from re-creating the entry
        result = await db.user_school_roles.update_one(
            {"user_id": user["id"], "school_id": school_id},
            {"$set": {"unassigned": True, "unassigned_at": now_iso()}}
        )
        if result.matched_count == 0:
            # Entry doesn't exist yet, create it as unassigned
            await db.user_school_roles.insert_one({
                "user_id": user["id"],
                "school_id": school_id,
                "role": "support",
                "auto_assigned": True,
                "unassigned": True,
                "unassigned_at": now_iso()
            })
        return {"message": "Acceso removido"}
    else:
        result = await db.user_school_roles.delete_one(
            {"user_id": user["id"], "school_id": school_id}
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Asignacion no encontrada")
        return {"message": "Acceso removido"}


# ══════════════════════════════════════════════════════════════════════════════
# TRASH SYSTEM - Archive, Restore, Permanent Delete, List Trash
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/schools/trash")
async def list_trash_schools(user=Depends(require_support_admin)):
    """List all schools currently in trash"""
    if user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo administradores globales pueden ver la papelera")
    
    schools_cursor = db.schools.find(
        {"status": "papelera"},
        {"_id": 0, "id": 1, "name": 1, "subdomain": 1, "logo_url": 1, "deleted_at": 1, "previous_status": 1, "created_at": 1}
    ).sort("deleted_at", -1)
    schools = await schools_cursor.to_list(length=500)

    # Enrich with owner display name
    school_ids = [s["id"] for s in schools]
    if school_ids:
        owners_cursor = db.users.find(
            {"school_id": {"$in": school_ids}, "role": "owner"},
            {"_id": 0, "school_id": 1, "school_display_name": 1}
        )
        owners = await owners_cursor.to_list(length=500)
        display_map = {o["school_id"]: o.get("school_display_name", "") for o in owners if o.get("school_display_name")}
        for s in schools:
            dn = display_map.get(s["id"])
            if dn:
                s["name"] = dn

    return schools


@router.patch("/schools/{school_id}/archive")
async def archive_school(school_id: str, user=Depends(require_support_admin)):
    """Soft delete — move school to trash"""
    if user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo administradores globales pueden archivar colegios")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "id": 1, "name": 1, "status": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    current_status = school.get("status", "activo")
    if current_status == "papelera":
        raise HTTPException(status_code=409, detail="El colegio ya está en la papelera.")
    
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {
            "previous_status": current_status,
            "status": "papelera",
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Colegio '{school.get('name', school_id)}' movido a la papelera."}


@router.patch("/schools/{school_id}/restore")
async def restore_school(school_id: str, user=Depends(require_support_admin)):
    """Restore school from trash"""
    if user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo administradores globales pueden restaurar colegios")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "id": 1, "name": 1, "status": 1, "previous_status": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    if school.get("status") != "papelera":
        raise HTTPException(status_code=409, detail="El colegio no está en la papelera.")
    
    restore_status = school.get("previous_status") or "activo"
    
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {"status": restore_status}, "$unset": {"previous_status": "", "deleted_at": ""}}
    )
    
    return {"message": f"Colegio '{school.get('name', school_id)}' restaurado correctamente.", "restored_status": restore_status}


@router.delete("/schools/{school_id}/permanent")
async def permanent_delete_school(school_id: str, user=Depends(require_support_admin)):
    """Permanently delete a school and ALL related data using a MongoDB transaction"""
    if user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo administradores globales pueden eliminar colegios")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "id": 1, "name": 1, "status": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    if school.get("status") != "papelera":
        raise HTTPException(status_code=409, detail="El colegio no está en papelera. Solo se pueden eliminar definitivamente colegios que estén en la papelera.")
    
    # Collections to cascade-delete (using institution_id as FK)
    collections_with_institution_id = [
        "students", "teachers", "users", "courses", "subjects",
        "attendance", "attendance_logs", "grades", "exams",
        "notifications", "payments", "subscriptions", "psychology_records"
    ]
    
    # Also delete from collections that use school_id as FK
    collections_with_school_id = [
        "sections", "course_posts", "course_activities", "internal_mail",
        "user_school_roles", "academic_years", "payment_requests",
        "finance_entries", "renewal_logs", "news", "events", "surveys",
        "topico_records", "psicologia_records", "push_tokens",
        "levels", "shifts", "schedules", "calendar_events",
        "discipline_records", "broadcast_messages"
    ]
    
    deleted_counts = {}
    
    try:
        async with await client.start_session() as session:
            async with session.start_transaction():
                # Delete from institution_id-based collections
                for col_name in collections_with_institution_id:
                    try:
                        result = await db[col_name].delete_many({"institution_id": school_id}, session=session)
                        deleted_counts[col_name] = result.deleted_count
                    except Exception:
                        deleted_counts[col_name] = 0
                
                # Delete from school_id-based collections
                for col_name in collections_with_school_id:
                    try:
                        result = await db[col_name].delete_many({"school_id": school_id}, session=session)
                        prev = deleted_counts.get(col_name, 0)
                        deleted_counts[col_name] = prev + result.deleted_count
                    except Exception:
                        if col_name not in deleted_counts:
                            deleted_counts[col_name] = 0
                
                # Also delete users by school_id (covers both FK patterns)
                try:
                    result = await db.users.delete_many({"school_id": school_id}, session=session)
                    deleted_counts["users"] = deleted_counts.get("users", 0) + result.deleted_count
                except Exception:
                    pass
                
                # Delete the school document itself
                await db.schools.delete_one({"id": school_id}, session=session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en la transacción de eliminación: {str(e)}")
    
    # Audit log — OUTSIDE transaction, after successful commit
    try:
        await db.deletion_logs.insert_one({
            "school_id": school_id,
            "school_name": school.get("name", school_id),
            "deleted_by": user.get("id"),
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "collections_affected": {k: v for k, v in deleted_counts.items() if v > 0}
        })
    except Exception:
        pass  # Non-critical: don't fail if audit log insert fails
    
    return {
        "success": True,
        "school_name": school.get("name", school_id),
        "deleted": deleted_counts
    }


# Legacy endpoint kept for backwards compatibility — now redirects to archive
@router.delete("/delete-school/{school_id}")
async def delete_school(school_id: str, user=Depends(require_support_admin)):
    """Legacy endpoint - now performs soft delete (archive) instead of permanent deletion"""
    if user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo administradores globales pueden eliminar colegios")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "id": 1, "name": 1, "status": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    current_status = school.get("status", "activo")
    if current_status == "papelera":
        raise HTTPException(status_code=409, detail="El colegio ya está en la papelera.")
    
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {
            "previous_status": current_status,
            "status": "papelera",
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Colegio '{school.get('name', school_id)}' movido a la papelera."}


# ══════════════════════════════════════════════════════════════════════════════
# SUPPORT: Orphan/Pending Students Management
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/schools/{school_id}/orphan-students")
async def get_orphan_students(school_id: str, user=Depends(require_support_admin)):
    """Get all orphan students for a school (support only).
    Orphans include: pending imports, students without nivel, AND students whose nivel_id doesn't resolve."""
    if user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo soporte puede ver huérfanos")

    # Get all valid level IDs for this school (from academic_levels collection)
    valid_levels = await db.academic_levels.find(
        {"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}
    ).to_list(100)
    valid_level_ids = {l["id"] for l in valid_levels}
    level_names = {l["id"]: l.get("nombre", "") for l in valid_levels}

    # Load grades, sections, turnos for name resolution
    all_grades = await db.grades.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(500)
    grade_names = {g["id"]: g.get("nombre", "") for g in all_grades}

    all_sections = await db.sections.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(500)
    section_names = {s["id"]: s.get("nombre", "") for s in all_sections}

    all_turnos = await db.shifts.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(50)
    turno_names = {t["id"]: t.get("nombre", "") for t in all_turnos}

    # Get ALL students for this school
    all_students = await db.users.find(
        {"school_id": school_id, "role": "student"},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "dni": 1, "email": 1,
         "import_errors": 1, "import_status": 1, "student_status": 1, "created_at": 1,
         "nivel_id": 1, "grado_id": 1, "seccion_id": 1, "turno_id": 1}
    ).to_list(5000)

    orphans = []
    for s in all_students:
        is_pending = s.get("import_status") == "pending"
        is_deleted = s.get("student_status") == "deleted"
        nivel_id = s.get("nivel_id")
        has_no_nivel = not nivel_id
        has_invalid_nivel = bool(nivel_id) and nivel_id not in valid_level_ids

        if not (is_pending or is_deleted or has_no_nivel or has_invalid_nivel):
            continue

        # Check if a non-pending copy with the same DNI exists
        has_original = False
        if is_pending and s.get("dni"):
            orig = await db.users.find_one(
                {"school_id": school_id, "role": "student", "dni": s["dni"],
                 "id": {"$ne": s["id"]}, "import_status": {"$ne": "pending"}},
                {"_id": 0, "id": 1}
            )
            if orig:
                has_original = True
        s["has_original"] = has_original

        # Determine orphan type
        if is_pending and has_original:
            s["orphan_type"] = "duplicado"
        elif is_pending:
            s["orphan_type"] = "pendiente"
        elif is_deleted:
            s["orphan_type"] = "eliminado"
        elif has_no_nivel or has_invalid_nivel:
            s["orphan_type"] = "sin_asignar"

        orphans.append(s)

    # Enrich with resolved names and visibility flag
    for s in orphans:
        s["nivel_name"] = level_names.get(s.get("nivel_id", ""), "")
        s["grado_name"] = grade_names.get(s.get("grado_id", ""), "")
        s["seccion_name"] = section_names.get(s.get("seccion_id", ""), "")
        s["turno_name"] = turno_names.get(s.get("turno_id", ""), "")
        # Visible = active student that would show in the normal list
        s["visible_in_system"] = s.get("student_status") not in ("deleted", "pending", None) and s.get("import_status") != "pending"

    return {"count": len(orphans), "students": orphans}


@router.delete("/schools/{school_id}/orphan-students")
async def delete_orphan_students(school_id: str, user=Depends(require_support_admin)):
    """Force-delete ALL orphan students for a school (support only)."""
    if user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo soporte puede eliminar huérfanos")

    # Get valid level IDs
    valid_levels = await db.academic_levels.find({"school_id": school_id}, {"_id": 0, "id": 1}).to_list(100)
    valid_level_ids = {l["id"] for l in valid_levels}

    # Get all students and filter orphans
    all_students = await db.users.find(
        {"school_id": school_id, "role": "student"},
        {"_id": 0, "id": 1, "import_status": 1, "nivel_id": 1}
    ).to_list(5000)

    orphan_ids = []
    for s in all_students:
        is_pending = s.get("import_status") == "pending"
        is_deleted = s.get("student_status") == "deleted"
        nivel_id = s.get("nivel_id")
        has_no_nivel = not nivel_id
        has_invalid_nivel = bool(nivel_id) and nivel_id not in valid_level_ids
        if is_pending or is_deleted or has_no_nivel or has_invalid_nivel:
            orphan_ids.append(s["id"])

    if not orphan_ids:
        return {"message": "No hay huérfanos para eliminar", "deleted_count": 0}

    result = await db.users.delete_many({"id": {"$in": orphan_ids}, "school_id": school_id})
    return {"message": f"{result.deleted_count} registros huérfanos eliminados", "deleted_count": result.deleted_count}


@router.delete("/schools/{school_id}/orphan-students/{student_id}")
async def delete_single_orphan(school_id: str, student_id: str, user=Depends(require_support_admin)):
    """Delete a single orphan student (support only)"""
    if user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo soporte puede eliminar huérfanos")

    result = await db.users.delete_one(
        {"id": student_id, "school_id": school_id, "role": "student"}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"message": "Registro huérfano eliminado"}



class UpdateExpirationRequest(BaseModel):
    school_id: str
    expiration_date: str

@router.put("/school-expiration")
async def update_school_expiration(req: UpdateExpirationRequest, user=Depends(require_support_admin)):
    """Update a school's expiration date"""
    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0, "id": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    await db.schools.update_one(
        {"id": req.school_id},
        {"$set": {
            "expiration_date": req.expiration_date,
            "updated_at": now_iso()
        }}
    )
    return {"message": "Fecha de vencimiento actualizada"}


# ══════════════════════════════════════════════════════════════════════════════
# MEMBERSHIP RENEWAL (Support confirms payment and renews)
# ══════════════════════════════════════════════════════════════════════════════

class RenewMembershipRequest(BaseModel):
    school_id: str
    operation_code: Optional[str] = None
    direct_renewal: bool = False

@router.post("/renew-membership")
async def renew_membership(req: RenewMembershipRequest, user=Depends(require_support_admin)):
    """Support confirms payment - with operation code or direct renewal"""
    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")

    now = datetime.now(timezone.utc)
    new_expiration = (now + timedelta(days=30)).isoformat()
    code = ""
    amount = 0
    payment_method = "yape"
    pending = None

    if req.direct_renewal:
        # Direct renewal - no operation code needed
        # Calculate amount from pricing
        from routes.subscription import get_school_pricing
        pricing = await get_school_pricing(school)
        amount = pricing.get("monto_actual", 0)
    else:
        # With operation code - validate and match
        code = (req.operation_code or "").strip()
        if not code.isdigit() or len(code) != 8:
            raise HTTPException(status_code=400, detail="El codigo de operacion debe tener exactamente 8 digitos")

        pending = await db.payment_requests.find_one(
            {"school_id": req.school_id, "status": "processing"},
            {"_id": 0}
        )
        if pending and pending.get("operation_code", "").strip() != code:
            raise HTTPException(status_code=400, detail="El codigo de operacion no coincide con el enviado por el cliente")

        amount = pending.get("amount", 0) if pending else 0
        if not amount:
            from routes.subscription import get_school_pricing
            pricing = await get_school_pricing(school)
            amount = pricing.get("calculated_price", 0)
        payment_method = pending.get("payment_method", "yape") if pending else "yape"

    # Renew the school membership
    await db.schools.update_one(
        {"id": req.school_id},
        {"$set": {
            "expiration_date": new_expiration,
            "fecha_vencimiento": new_expiration,
            "subscription_status": "active",
            "plan_estado": "ACTIVO",
            "dias_vencido": 0,
            "last_renewal_date": now.isoformat(),
            "updated_at": now.isoformat(),
        }}
    )

    # Confirm pending payment request if exists
    if pending:
        await db.payment_requests.update_one(
            {"id": pending["id"]},
            {"$set": {
                "status": "confirmed",
                "resolved_at": now.isoformat(),
                "resolved_by": user["id"],
                "resolved_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
                "updated_at": now.isoformat(),
            }}
        )

    # Log the renewal
    renewal_log = {
        "id": str(uuid.uuid4()),
        "school_id": req.school_id,
        "school_name": school.get("name", ""),
        "action": "membership_renewal",
        "renewal_type": "direct" if req.direct_renewal else "with_code",
        "support_user_id": user["id"],
        "support_user_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "operation_code": code or "N/A",
        "amount": amount,
        "payment_method": payment_method,
        "new_expiration": new_expiration,
        "created_at": now.isoformat(),
    }
    await db.renewal_logs.insert_one(renewal_log)

    # Register finance entry (income)
    finance_entry = {
        "id": str(uuid.uuid4()),
        "type": "income",
        "school_id": req.school_id,
        "school_name": school.get("name", school.get("subdomain", "")),
        "amount": amount,
        "description": f"Renovacion mensual{' (directa)' if req.direct_renewal else ''} - {school.get('name', school.get('subdomain', ''))}",
        "payment_method": payment_method,
        "operation_code": code or "N/A",
        "payment_request_id": pending["id"] if pending else None,
        "confirmed_by": user["id"],
        "confirmed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "confirmed_at": now.isoformat(),
        "created_at": now.isoformat(),
    }
    await db.finance_entries.insert_one(finance_entry)

    return {
        "message": "Membresia renovada exitosamente",
        "new_expiration": new_expiration,
        "amount": amount,
    }


@router.get("/payment-requests")
async def get_payment_requests(user=Depends(require_support_admin)):
    """Get all pending payment requests for support review"""
    requests = await db.payment_requests.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return requests


# ══════════════════════════════════════════════════════════════════════════════
# PRICING CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

class GlobalPricingRequest(BaseModel):
    billing_mode: str = Field(..., description="base_plus_student | student_only | flat_fee")
    base_monthly_fee: float = Field(0, description="Base mensual en soles")
    per_student_fee: float = Field(0, description="Precio por alumno")
    per_student_from_month: int = Field(1, description="Mes desde el que aplica cobro por alumno")
    flat_fee: float = Field(0, description="Tarifa fija mensual")

class SchoolPricingRequest(BaseModel):
    school_id: str
    billing_mode: Optional[str] = None
    base_monthly_fee: Optional[float] = None
    per_student_fee: Optional[float] = None
    per_student_from_month: Optional[int] = None
    flat_fee: Optional[float] = None
    discount_notes: Optional[str] = None

def calc_price(billing_mode, base_fee, student_fee, from_month, flat_fee, student_count, months_active):
    """Calculate monthly price based on billing mode"""
    if billing_mode == "flat_fee":
        return round(flat_fee, 2), 0.0, round(flat_fee, 2)
    if billing_mode == "student_only":
        sc = student_count * student_fee if months_active >= from_month else 0.0
        return round(sc, 2), round(sc, 2), 0.0
    # base_plus_student (default)
    sc = student_count * student_fee if months_active >= from_month else 0.0
    return round(base_fee + sc, 2), round(sc, 2), round(base_fee, 2)

@router.get("/pricing")
async def get_global_pricing(user=Depends(require_support_admin)):
    """Get global pricing configuration"""
    config = await db.pricing_config.find_one({"id": "global"}, {"_id": 0})
    if not config:
        config = {
            "id": "global",
            "billing_mode": "base_plus_student",
            "base_monthly_fee": 50.0,
            "per_student_fee": 0.70,
            "per_student_from_month": 3,
            "flat_fee": 0.0,
            "currency": "PEN"
        }
        await db.pricing_config.insert_one(config)
    # Ensure billing_mode exists for legacy configs
    if "billing_mode" not in config:
        config["billing_mode"] = "base_plus_student"
    if "flat_fee" not in config:
        config["flat_fee"] = 0.0
    return config

@router.put("/pricing")
async def update_global_pricing(req: GlobalPricingRequest, user=Depends(require_support_admin)):
    """Update global pricing configuration"""
    await db.pricing_config.update_one(
        {"id": "global"},
        {"$set": {
            "id": "global",
            "billing_mode": req.billing_mode,
            "base_monthly_fee": req.base_monthly_fee,
            "per_student_fee": req.per_student_fee,
            "per_student_from_month": req.per_student_from_month,
            "flat_fee": req.flat_fee,
            "currency": "PEN",
            "updated_at": now_iso()
        }},
        upsert=True
    )
    return {"message": "Configuracion de precios actualizada"}

@router.put("/school-pricing")
async def update_school_pricing(req: SchoolPricingRequest, user=Depends(require_support_admin)):
    """Set custom pricing override for a specific school"""
    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0, "id": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    override = {}
    if req.billing_mode is not None:
        override["billing_mode"] = req.billing_mode
    if req.base_monthly_fee is not None:
        override["base_monthly_fee"] = req.base_monthly_fee
    if req.per_student_fee is not None:
        override["per_student_fee"] = req.per_student_fee
    if req.per_student_from_month is not None:
        override["per_student_from_month"] = req.per_student_from_month
    if req.flat_fee is not None:
        override["flat_fee"] = req.flat_fee
    if req.discount_notes is not None:
        override["discount_notes"] = req.discount_notes
    
    if not override:
        await db.schools.update_one({"id": req.school_id}, {"$unset": {"pricing_override": ""}})
        return {"message": "Precio personalizado eliminado, se usara el global"}
    
    override["updated_at"] = now_iso()
    await db.schools.update_one(
        {"id": req.school_id},
        {"$set": {"pricing_override": override, "updated_at": now_iso()}}
    )
    return {"message": "Precio personalizado actualizado"}

@router.delete("/school-pricing/{school_id}")
async def delete_school_pricing(school_id: str, user=Depends(require_support_admin)):
    """Remove custom pricing override for a school"""
    await db.schools.update_one({"id": school_id}, {"$unset": {"pricing_override": ""}})
    return {"message": "Precio personalizado eliminado"}

@router.get("/school-pricing/{school_id}")
async def get_school_pricing(school_id: str, user=Depends(require_support_admin)):
    """Get pricing for a specific school (global + override)"""
    global_config = await db.pricing_config.find_one({"id": "global"}, {"_id": 0})
    if not global_config:
        global_config = {"billing_mode": "base_plus_student", "base_monthly_fee": 50.0, "per_student_fee": 0.70, "per_student_from_month": 3, "flat_fee": 0.0}
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "pricing_override": 1, "created_at": 1})
    override = school.get("pricing_override") if school else None
    
    months_active = 1
    if school and school.get("created_at"):
        try:
            created = datetime.fromisoformat(school["created_at"].replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            months_active = max(1, (now.year - created.year) * 12 + now.month - created.month + 1)
        except:
            pass
    
    # Effective pricing
    def eff_val(key, default):
        if override and key in override:
            return override[key]
        return global_config.get(key, default)
    
    eff_mode = eff_val("billing_mode", "base_plus_student")
    eff_base = eff_val("base_monthly_fee", 50.0)
    eff_student_fee = eff_val("per_student_fee", 0.70)
    eff_from_month = eff_val("per_student_from_month", 3)
    eff_flat = eff_val("flat_fee", 0.0)
    
    student_count = await db.users.count_documents({"school_id": school_id, "role": "student"})
    
    calculated_price, student_charge, base_charge = calc_price(
        eff_mode, eff_base, eff_student_fee, eff_from_month, eff_flat, student_count, months_active
    )
    
    return {
        "global": global_config,
        "override": override,
        "effective": {
            "billing_mode": eff_mode,
            "base_monthly_fee": eff_base,
            "per_student_fee": eff_student_fee,
            "per_student_from_month": eff_from_month,
            "flat_fee": eff_flat
        },
        "months_active": months_active,
        "student_count": student_count,
        "calculated_price": calculated_price,
        "base_charge": base_charge,
        "student_charge": student_charge
    }




@router.post("/switch-school")
async def switch_school(req: SwitchSchoolRequest, user=Depends(require_support_admin)):
    """
    Switch context to a specific school.
    Returns a new JWT with active_school_id and scope: support_switch.
    Only works if user has assignment to that school.
    """
    # Global admin can enter any school without assignment
    if user.get("role") != "system_admin_global":
        assignment = await db.user_school_roles.find_one(
            {"user_id": user["id"], "school_id": req.school_id}
        )
        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="No tienes acceso a este colegio. Asignalo primero."
            )
    
    # Get school details
    school = await db.schools.find_one({"id": req.school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    subdomain = school.get("subdomain")
    
    # Create a special JWT with school context
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": "owner",  # In school context, support acts as owner
        "original_role": "system_admin_global",
        "school_id": req.school_id,
        "subdomain": subdomain,
        "email_verified": True,
        "scope": "support_switch",
        "active_school_id": req.school_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return {
        "token": token,
        "school": {
            "id": req.school_id,
            "name": school.get("name", ""),
            "subdomain": subdomain,
            "logo_url": school.get("logo_url")
        },
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "last_name": user.get("last_name", ""),
            "role": "owner",
            "original_role": "system_admin_global",
            "school_id": req.school_id,
            "subdomain": subdomain,
            "email_verified": True,
            "is_owner": True,
            "is_super_admin": False,
            "is_protected": True,
            "is_demo_user": False,
            "is_support_session": True,
            "photo_url": user.get("photo_url"),
            "permissions": {
                "role": "owner",
                "is_owner": True,
                "is_admin": False,
                "sections": {
                    "settings": True,
                    "accounting": True,
                    "users": True,
                    "grades": True,
                    "courses": True,
                    "attendance": True,
                    "reports": True,
                    "schedule": True,
                    "exams": True,
                    "internal_mail": True
                }
            }
        }
    }


@router.get("/me")
async def get_support_profile(user=Depends(require_support_admin)):
    """Get support user profile"""
    return {
        "id": user["id"],
        "name": user.get("name", ""),
        "last_name": user.get("last_name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "photo_url": user.get("photo_url"),
        "role": user.get("role"),
        "created_at": user.get("created_at")
    }


@router.put("/me")
async def update_support_profile(data: SupportProfileUpdate, user=Depends(require_support_admin)):
    """Update support user profile (name, email, photo)"""
    update_fields = {}
    
    if data.name is not None:
        update_fields["name"] = data.name.strip()
    if data.last_name is not None:
        update_fields["last_name"] = data.last_name.strip()
    if data.email is not None:
        # Only validate if email actually changed
        if data.email.lower().strip() != user.get("email", "").lower().strip():
            existing = await db.users.find_one(
                {"email": data.email.lower().strip(), "id": {"$ne": user["id"]}},
                {"_id": 0, "id": 1}
            )
            if existing:
                raise HTTPException(status_code=400, detail="Este correo ya esta en uso")
            update_fields["email"] = data.email.lower().strip()
    if data.photo_url is not None:
        update_fields["photo_url"] = data.photo_url
    if data.whatsapp is not None:
        update_fields["whatsapp"] = data.whatsapp.strip()
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    
    update_fields["updated_at"] = now_iso()
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
    
    # Return updated user
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return {
        "id": updated["id"],
        "name": updated.get("name", ""),
        "last_name": updated.get("last_name", ""),
        "email": updated.get("email", ""),
        "phone": updated.get("phone", ""),
        "whatsapp": updated.get("whatsapp", ""),
        "photo_url": updated.get("photo_url"),
        "role": updated.get("role"),
        "created_at": updated.get("created_at")
    }


@router.put("/me/password")
async def change_support_password(data: SupportPasswordChange, user=Depends(require_support_admin)):
    """Change support user password"""
    # Get full user with password hash
    full_user = await db.users.find_one({"id": user["id"]})
    if not full_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if not verify_password(data.current_password, full_user["password"]):
        raise HTTPException(status_code=400, detail="Contrasena actual incorrecta")
    
    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password": new_hash, "plain_password": data.new_password, "updated_at": now_iso()}}
    )
    
    return {"message": "Contrasena actualizada correctamente"}


# ══════════════════════════════════════════════════════════════════════════════
# STARTUP: Ensure global support user exists
# ══════════════════════════════════════════════════════════════════════════════

SUPPORT_EMAIL = "spencer3009@gmail.com"
SUPPORT_PASSWORD = "Socios3009"

async def ensure_global_support_user():
    """
    Ensure the global support user exists.
    Called on app startup.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    existing = await db.users.find_one(
        {"role": "system_admin_global"},
        {"_id": 0}
    )
    
    if existing:
        # Make sure email/password are correct
        if existing.get("email") != SUPPORT_EMAIL:
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {"email": SUPPORT_EMAIL, "updated_at": now_iso()}}
            )
            logger.info("Updated global support user email")
        
        # Verify password works, if not update it
        full = await db.users.find_one({"id": existing["id"]})
        if full and not verify_password(SUPPORT_PASSWORD, full.get("password", "")):
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {"password": hash_password(SUPPORT_PASSWORD), "updated_at": now_iso()}}
            )
            logger.info("Updated global support user password")
        
        logger.info(f"Global support user exists: {existing['id']}")
        return existing["id"]
    
    # Create new global support user
    user_id = str(uuid.uuid4())
    support_user = {
        "id": user_id,
        "username": "soporte_global",
        "password": hash_password(SUPPORT_PASSWORD),
        "name": "Soporte",
        "last_name": "EduNet",
        "email": SUPPORT_EMAIL,
        "role": "system_admin_global",
        "is_system_user": True,
        "is_protected": True,
        "email_verified": True,
        "created_at": now_iso(),
        "updated_at": now_iso()
    }
    
    await db.users.insert_one(support_user)
    logger.info(f"Global support user created: {user_id}")
    
    # Create index for user_school_roles
    await db.user_school_roles.create_index(
        [("user_id", 1), ("school_id", 1)],
        unique=True
    )
    
    return user_id



# ══════════════════════════════════════════════════════════════════════════════
# FINANZAS - Financial overview
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/finances/{entry_id}")
async def delete_finance_entry(entry_id: str, user=Depends(require_support_admin)):
    """Delete a single finance entry"""
    result = await db.finance_entries.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"message": "Pago eliminado"}


class RegisterPaymentRequest(BaseModel):
    school_id: str
    amount: float
    payment_date: str  # ISO date string e.g. "2026-03-13"

@router.post("/register-payment")
async def register_manual_payment(data: RegisterPaymentRequest, user=Depends(require_support_admin)):
    """Register a restoration payment for a school (when payment was accidentally deleted)"""
    school = await db.schools.find_one({"id": data.school_id}, {"_id": 0, "id": 1, "name": 1, "subdomain": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")

    now = datetime.now(timezone.utc)
    school_name = school.get("name", school.get("subdomain", ""))

    finance_entry = {
        "id": str(uuid.uuid4()),
        "type": "income",
        "school_id": data.school_id,
        "school_name": school_name,
        "amount": data.amount,
        "description": f"Restauracion de pago - {school_name}",
        "payment_method": "restauracion",
        "operation_code": "",
        "payment_origin": "soporte",
        "payment_type": "restauracion",
        "confirmed_by": user["id"],
        "confirmed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "confirmed_at": data.payment_date + "T12:00:00",
        "created_at": now.isoformat(),
    }
    await db.finance_entries.insert_one(finance_entry)

    return {"message": f"Pago registrado para {school_name}", "amount": data.amount}




@router.get("/finances")
async def support_finances(user=Depends(require_support_admin)):
    """Get financial overview: monthly earnings from confirmed renewals"""
    now = datetime.now(timezone.utc)
    
    # Get all schools
    schools = await db.schools.find(
        {}, {"_id": 0, "id": 1, "name": 1, "subdomain": 1, "expiration_date": 1}
    ).to_list(500)
    
    # Get all finance entries (confirmed payments)
    finance_entries = await db.finance_entries.find(
        {"type": "income"}, {"_id": 0}
    ).sort("confirmed_at", -1).to_list(1000)
    
    # Also include legacy confirmed payment_requests for backwards compatibility
    confirmed_payments = await db.payment_requests.find(
        {"status": "confirmed"}, {"_id": 0}
    ).to_list(1000)
    
    # Build monthly earnings for last 12 months
    monthly_data = []
    for i in range(11, -1, -1):
        month_date = now - timedelta(days=30 * i)
        month_key = month_date.strftime("%Y-%m")
        month_label = month_date.strftime("%b %Y")
        
        month_total = 0
        month_count = 0
        
        # Count from finance_entries
        for e in finance_entries:
            e_date = e.get("confirmed_at", e.get("created_at", ""))
            if isinstance(e_date, str) and e_date.startswith(month_key):
                month_total += e.get("amount", 0)
                month_count += 1
            elif isinstance(e_date, datetime) and e_date.strftime("%Y-%m") == month_key:
                month_total += e.get("amount", 0)
                month_count += 1
        
        monthly_data.append({
            "month": month_key,
            "label": month_label,
            "total": round(month_total, 2),
            "payments": month_count
        })
    
    # Current month summary
    current_month = now.strftime("%Y-%m")
    current_earnings = sum(m["total"] for m in monthly_data if m["month"] == current_month)
    current_payments = sum(m["payments"] for m in monthly_data if m["month"] == current_month)
    
    # Total all time from finance_entries
    total_all_time = sum(e.get("amount", 0) for e in finance_entries)
    
    # Active schools (with valid expiration)
    active_count = 0
    for s in schools:
        exp = s.get("expiration_date")
        if exp:
            try:
                if isinstance(exp, str):
                    exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
                else:
                    exp_dt = exp
                if exp_dt > now:
                    active_count += 1
            except Exception:
                pass
    
    # Recent transactions for the table
    recent_transactions = []
    for e in finance_entries[:20]:
        recent_transactions.append({
            "id": e.get("id"),
            "school_name": e.get("school_name", ""),
            "amount": e.get("amount", 0),
            "payment_method": e.get("payment_method", ""),
            "operation_code": e.get("operation_code", ""),
            "confirmed_by_name": e.get("confirmed_by_name", ""),
            "confirmed_at": e.get("confirmed_at", e.get("created_at", "")),
        })
    
    return {
        "monthly_data": monthly_data,
        "current_month": {
            "label": now.strftime("%B %Y"),
            "earnings": round(current_earnings, 2),
            "payments": current_payments
        },
        "total_all_time": round(total_all_time, 2),
        "total_confirmed_payments": len(finance_entries),
        "active_schools": active_count,
        "total_schools": len(schools),
        "recent_transactions": recent_transactions
    }



@router.get("/finances/transactions")
async def support_finance_transactions(
    filter_type: str = "month",
    month: str = None,
    date: str = None,
    date_from: str = None,
    date_to: str = None,
    user=Depends(require_support_admin)
):
    """Get filtered finance transactions. filter_type: month | day | range | year"""
    now = datetime.now(timezone.utc)

    # Build date filter
    if filter_type == "day" and date:
        # Single day: date = "2026-03-13"
        start = date
        end = date + "T23:59:59"
        label = date
    elif filter_type == "range" and date_from and date_to:
        start = date_from
        end = date_to + "T23:59:59"
        label = f"{date_from} - {date_to}"
    elif filter_type == "year":
        year = str(now.year)
        start = f"{year}-01-01"
        end = f"{year}-12-31T23:59:59"
        label = f"Año {year}"
    else:
        # Default: month
        target = month or now.strftime("%Y-%m")
        start = f"{target}-01"
        # End of month
        y, m = int(target[:4]), int(target[5:7])
        if m == 12:
            end = f"{y+1}-01-01"
        else:
            end = f"{y}-{m+1:02d}-01"
        label = target

    # Query finance_entries
    query = {
        "type": "income",
        "confirmed_at": {"$gte": start, "$lt": end}
    }
    entries = await db.finance_entries.find(query, {"_id": 0}).sort("confirmed_at", -1).to_list(500)

    transactions = []
    total = 0
    for e in entries:
        total += e.get("amount", 0)
        transactions.append({
            "id": e.get("id"),
            "school_name": e.get("school_name", ""),
            "amount": e.get("amount", 0),
            "description": e.get("description", ""),
            "payment_method": e.get("payment_method", ""),
            "operation_code": e.get("operation_code", ""),
            "confirmed_by_name": e.get("confirmed_by_name", ""),
            "confirmed_at": e.get("confirmed_at", e.get("created_at", "")),
        })

    return {
        "filter_type": filter_type,
        "label": label,
        "total": round(total, 2),
        "count": len(transactions),
        "transactions": transactions,
    }


# ══════════════════════════════════════════════════════════════════════════════
# CREATE SCHOOL FROM SUPPORT
# ══════════════════════════════════════════════════════════════════════════════

class CreateSchoolFromSupport(BaseModel):
    school_name: str = Field(..., min_length=3)
    subdomain: str = Field(..., min_length=3)
    owner_name: str = Field(..., min_length=2)
    owner_email: str = Field(..., min_length=5)
    owner_password: str = Field(..., min_length=6)
    owner_ruc: str = Field(..., min_length=1)
    owner_whatsapp: str = Field(..., min_length=1)


class UpdateOwnerRequest(BaseModel):
    name: Optional[str] = None
    school_display_name: Optional[str] = None
    email: Optional[str] = None
    ruc: Optional[str] = None
    whatsapp: Optional[str] = None
    password: Optional[str] = None


@router.get("/school-owner/{school_id}")
async def get_school_owner(school_id: str, user=Depends(require_support_admin)):
    """Get the owner/titular data for a school"""
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "owner_user_id": 1, "name": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")

    owner_id = school.get("owner_user_id")
    if not owner_id:
        # Fallback: find the owner user by school_id + role
        owner = await db.users.find_one(
            {"school_id": school_id, "role": "owner"},
            {"_id": 0, "password": 0}
        )
    else:
        owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "password": 0})

    if not owner:
        raise HTTPException(status_code=404, detail="No se encontro el titular de este colegio")

    return {
        "id": owner.get("id"),
        "name": owner.get("name", ""),
        "school_display_name": owner.get("school_display_name", "") or school.get("name", ""),
        "email": owner.get("email", ""),
        "ruc": owner.get("ruc", ""),
        "whatsapp": owner.get("whatsapp", ""),
        "plain_password": owner.get("plain_password", ""),
        "created_at": owner.get("created_at", ""),
    }


@router.put("/school-owner/{school_id}")
async def update_school_owner(school_id: str, data: UpdateOwnerRequest, user=Depends(require_support_admin)):
    """Update the owner/titular data for a school"""
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "owner_user_id": 1})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")

    owner_id = school.get("owner_user_id")
    if not owner_id:
        owner = await db.users.find_one({"school_id": school_id, "role": "owner"}, {"_id": 0, "id": 1})
        if not owner:
            raise HTTPException(status_code=404, detail="No se encontro el titular de este colegio")
        owner_id = owner["id"]

    update_fields = {}
    if data.name is not None:
        update_fields["name"] = data.name.strip()
    if data.school_display_name is not None:
        update_fields["school_display_name"] = data.school_display_name.strip()
        # Also sync to school document name
        await db.schools.update_one(
            {"id": school_id},
            {"$set": {"name": data.school_display_name.strip(), "updated_at": now_iso()}}
        )
    if data.email is not None:
        existing = await db.users.find_one(
            {"email": data.email.lower().strip(), "id": {"$ne": owner_id}},
            {"_id": 0, "id": 1}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Este correo ya esta en uso por otro usuario")
        update_fields["email"] = data.email.lower().strip()
    if data.ruc is not None:
        update_fields["ruc"] = data.ruc.strip()
    if data.whatsapp is not None:
        digits = data.whatsapp.strip().replace("+51", "")
        update_fields["whatsapp"] = "+51" + digits
    if data.password is not None and data.password.strip():
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="La contrasena debe tener al menos 6 caracteres")
        update_fields["password"] = hash_password(data.password)
        update_fields["plain_password"] = data.password

    if not update_fields:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    update_fields["updated_at"] = now_iso()
    await db.users.update_one({"id": owner_id}, {"$set": update_fields})

    updated = await db.users.find_one({"id": owner_id}, {"_id": 0, "password": 0})
    return {
        "message": "Datos del titular actualizados",
        "owner": {
            "id": updated.get("id"),
            "name": updated.get("name", ""),
            "school_display_name": updated.get("school_display_name", ""),
            "email": updated.get("email", ""),
            "ruc": updated.get("ruc", ""),
            "whatsapp": updated.get("whatsapp", ""),
            "plain_password": updated.get("plain_password", ""),
            "created_at": updated.get("created_at", ""),
        }
    }

@router.post("/create-school")
async def support_create_school(data: CreateSchoolFromSupport, user=Depends(require_support_admin)):
    """Create a new school + owner account from the support panel"""
    import re
    from .core import RESERVED_SUBDOMAINS, BASE_DOMAIN

    subdomain = data.subdomain.lower().strip()

    # Validate subdomain format
    if not re.match(r'^[a-z0-9]{3,}$', subdomain):
        raise HTTPException(status_code=400, detail="El subdominio solo puede contener letras minusculas y numeros (min 3 caracteres)")

    if subdomain in RESERVED_SUBDOMAINS:
        raise HTTPException(status_code=400, detail="Este subdominio esta reservado")

    # Check subdomain availability
    existing = await db.schools.find_one({"subdomain": subdomain})
    if existing:
        raise HTTPException(status_code=400, detail="Este subdominio ya esta en uso")

    # Check if owner email already exists
    existing_user = await db.users.find_one({"email": data.owner_email.lower().strip()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con este email")

    now = datetime.now(timezone.utc)
    school_id = str(uuid.uuid4())
    owner_id = str(uuid.uuid4())
    full_domain = f"{subdomain}.{BASE_DOMAIN}"

    # Create the owner user
    owner_doc = {
        "id": owner_id,
        "name": data.owner_name.strip(),
        "email": data.owner_email.lower().strip(),
        "password": hash_password(data.owner_password),
        "plain_password": data.owner_password,
        "ruc": (data.owner_ruc or "").strip(),
        "whatsapp": "+51" + (data.owner_whatsapp or "").strip().replace("+51", ""),
        "role": "owner",
        "school_id": school_id,
        "subdomain": subdomain,
        "is_owner": True,
        "is_super_admin": True,
        "is_protected": True,
        "email_verified": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.users.insert_one(owner_doc)

    # Create the school
    school_doc = {
        "id": school_id,
        "name": data.school_name.strip(),
        "school_name": data.school_name.strip(),
        "subdomain": subdomain,
        "full_domain": full_domain,
        "status": "active",
        "owner_user_id": owner_id,
        "subscription_status": "active",
        "expiration_date": (now + timedelta(days=30)).isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.schools.insert_one(school_doc)

    # Get global pricing to register the first payment
    global_pricing = await db.pricing_config.find_one({"id": "global"}, {"_id": 0})
    if not global_pricing:
        global_pricing = {"base_monthly_fee": 50.0}
    amount = global_pricing.get("base_monthly_fee", 0)

    # Register finance entry (first payment)
    if amount > 0:
        finance_entry = {
            "id": str(uuid.uuid4()),
            "type": "income",
            "school_id": school_id,
            "school_name": data.school_name.strip(),
            "amount": amount,
            "description": f"Pago inicial - {data.school_name.strip()}",
            "payment_method": "efectivo",
            "operation_code": "",
            "confirmed_by": user["id"],
            "confirmed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
            "confirmed_at": now.isoformat(),
            "created_at": now.isoformat(),
        }
        await db.finance_entries.insert_one(finance_entry)

    return {
        "message": f"Colegio '{data.school_name}' creado exitosamente",
        "school_id": school_id,
        "subdomain": subdomain,
        "full_domain": full_domain,
        "owner_email": data.owner_email.lower().strip(),
    }
