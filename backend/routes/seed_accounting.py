"""
Seed Demo Accounting Data
POST /api/admin/seed-demo-accounting
Populates a school with realistic payments, expenses, and boletas for demo purposes.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import random
import logging

from .core import db, get_current_user, now_iso
from services.boleta_pdf_generator import monto_en_letras

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-seed"])

CONFIRM_TOKEN = "SEED_DEMO_ACCOUNTING_CONFIRMED"


# ── Auth: same pattern as support.py ────────────────────────────────────────
async def require_support_admin(current_user=Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user or user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Solo system_admin_global puede ejecutar este endpoint.")
    return user


class SeedRequest(BaseModel):
    school_id: str
    reset: bool = False
    confirm_token: str


# ── Constants ───────────────────────────────────────────────────────────────

MONTH_NAMES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

PAYMENT_METHODS_WEIGHTED = [
    ("transferencia", 40), ("yape", 25), ("efectivo", 20), ("plin", 15)
]

PENSION_RANGES = {
    "INICIAL": (250, 300),
    "PRIMARIA": (300, 380),
    "SECUNDARIA": (350, 450),
}

EXTRA_CONCEPTS = [
    ("uniforme", "Uniforme Escolar", 170, 190),
    ("evento", "Excursion Educativa", 60, 120),
    ("material", "Pack de Libros", 230, 270),
    ("taller", "Taller Extracurricular", 80, 150),
]

RECURRING_SERVICES = [
    ("Servicio de Energia Electrica", "servicios", "Enel Distribucion Peru SAC", 400, 500),
    ("Servicio de Agua Potable", "servicios", "Sedapal", 160, 200),
    ("Servicio de Internet Fibra Optica", "servicios", "Movistar Empresas", 200, 240),
]

OPERATIONAL_EXPENSES = [
    ("Materiales de oficina", "materiales", "Libreria El Estudiante"),
    ("Productos de limpieza", "materiales", "Limpieza Total SAC"),
    ("Mantenimiento de aulas", "mantenimiento", "Servicios Generales Lima EIRL"),
    ("Reparaciones menores", "mantenimiento", "Servicios Electricos Lima EIRL"),
    ("Materiales didacticos", "materiales", "Distribuidora San Martin SAC"),
    ("Reparacion de mobiliario", "mantenimiento", "Carpinteria Rojas"),
    ("Fumigacion mensual", "servicios", "Sanitex Peru SAC"),
    ("Suministros de computo", "materiales", "Compumarket EIRL"),
]

EXPENSE_METHODS_WEIGHTED = [
    ("transferencia", 60), ("efectivo", 25), ("yape", 15)
]


def pick_weighted(choices):
    population = [c[0] for c in choices]
    weights = [c[1] for c in choices]
    return random.choices(population, weights=weights, k=1)[0]


def random_date_in_month(year, month):
    if month == 12:
        max_day = 28
    else:
        next_m = datetime(year, month + 1, 1)
        max_day = (next_m - timedelta(days=1)).day
    day = random.randint(1, min(max_day, 28))
    return f"{year}-{month:02d}-{day:02d}"


@router.post("/seed-demo-accounting")
async def seed_demo_accounting(data: SeedRequest, admin=Depends(require_support_admin)):
    # ── Validate confirm token ──────────────────────────────────────────────
    if data.confirm_token != CONFIRM_TOKEN:
        raise HTTPException(status_code=400, detail=f"Token de confirmacion invalido. Esperado: {CONFIRM_TOKEN}")

    school_id = data.school_id

    # ── Verify school exists ────────────────────────────────────────────────
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "name": 1, "id": 1})
    if not school:
        raise HTTPException(status_code=404, detail=f"Colegio con id {school_id} no encontrado.")

    school_name = school.get("name", "Desconocido")
    admin_id = admin["id"]
    admin_name = f"{admin.get('name', '')} {admin.get('last_name', '')}".strip()

    now = datetime.now(timezone.utc)
    current_year = now.year
    current_month = now.month
    # Months from January to previous month
    months_to_seed = list(range(1, current_month))
    if not months_to_seed:
        months_to_seed = [1]  # At least January if we're in January

    borrados = {"ingresos": 0, "egresos": 0, "boletas": 0}

    # ── RESET if requested ──────────────────────────────────────────────────
    if data.reset:
        count_p = await db.payments.count_documents({"school_id": school_id})
        count_e = await db.expenses.count_documents({"school_id": school_id})
        count_b = await db.boletas_internas.count_documents({"school_id": school_id})

        logger.warning(
            f"[SEED-DEMO] RESET requested for school '{school_name}' ({school_id}). "
            f"Will delete: {count_p} payments, {count_e} expenses, {count_b} boletas."
        )

        await db.payments.delete_many({"school_id": school_id})
        await db.expenses.delete_many({"school_id": school_id})
        await db.boletas_internas.delete_many({"school_id": school_id})

        borrados = {"ingresos": count_p, "egresos": count_e, "boletas": count_b}

    # ── Gather students and teachers ────────────────────────────────────────
    students = await db.users.find(
        {"school_id": school_id, "role": "student", "status": {"$in": ["active", None]}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "dni": 1,
         "grado_id": 1, "seccion_id": 1, "parent_id": 1, "padre_id": 1}
    ).to_list(500)

    teachers = await db.users.find(
        {"school_id": school_id, "role": "teacher", "status": {"$in": ["active", None]}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1}
    ).to_list(200)

    # ── Build grade level map ───────────────────────────────────────────────
    grades = await db.grades.find(
        {"school_id": school_id},
        {"_id": 0, "id": 1, "nombre": 1, "nivel": 1, "nivel_nombre": 1}
    ).to_list(100)
    grade_map = {g["id"]: g for g in grades}

    sections = await db.sections.find(
        {"school_id": school_id},
        {"_id": 0, "id": 1, "nombre": 1}
    ).to_list(100)
    section_map = {s["id"]: s for s in sections}

    # ── Get boleta config ───────────────────────────────────────────────────
    boleta_config = await db.boleta_emisor_config.find_one(
        {"school_id": school_id}, {"_id": 0}
    )
    has_boleta_config = bool(
        boleta_config and boleta_config.get("ruc") and boleta_config.get("razon_social")
    )
    # Get school logo for boleta
    school_settings = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "logo_url": 1})
    school_doc_full = await db.schools.find_one({"id": school_id}, {"_id": 0, "logo_url": 1})
    logo_url = (school_settings or {}).get("logo_url") or (school_doc_full or {}).get("logo_url")

    logger.info(
        f"[SEED-DEMO] Starting seed for '{school_name}' ({school_id}). "
        f"Students: {len(students)}, Teachers: {len(teachers)}, "
        f"Months: {months_to_seed}, Boleta config: {has_boleta_config}"
    )

    # ── Determine pension per student based on grade level ──────────────────
    def get_pension_amount(student):
        gid = student.get("grado_id")
        grade = grade_map.get(gid, {})
        nivel = (grade.get("nivel_nombre") or grade.get("nivel") or "PRIMARIA").upper()
        for key, (lo, hi) in PENSION_RANGES.items():
            if key in nivel:
                return round(random.uniform(lo, hi), 2)
        return round(random.uniform(300, 380), 2)

    # Assign consistent pension per student
    student_pensions = {}
    for s in students:
        student_pensions[s["id"]] = get_pension_amount(s)

    # ── Decide morosos: ~20% of students ────────────────────────────────────
    moroso_count = max(1, int(len(students) * 0.20))
    moroso_students = set(s["id"] for s in random.sample(students, min(moroso_count, len(students))))

    # For each moroso, decide how many months unpaid (1-3)
    moroso_unpaid = {}
    for sid in moroso_students:
        n_unpaid = random.choice([1, 1, 2, 2, 3])  # weighted toward 1-2
        if len(months_to_seed) > 0:
            unpaid_months = random.sample(months_to_seed, min(n_unpaid, len(months_to_seed)))
            moroso_unpaid[sid] = set(unpaid_months)

    # ── Decide extra concept students: ~30% ─────────────────────────────────
    extra_count = max(1, int(len(students) * 0.30))
    extra_students = set(s["id"] for s in random.sample(students, min(extra_count, len(students))))

    # ── Generate all payments ───────────────────────────────────────────────
    all_payments = []
    ts_base = now.isoformat()

    for student in students:
        sid = student["id"]
        gid = student.get("grado_id", "")
        secid = student.get("seccion_id", "")
        pension = student_pensions[sid]

        # Matricula in March (paid for everyone)
        if 3 in months_to_seed or current_month > 3:
            mat_month = 3 if 3 in months_to_seed else months_to_seed[0]
            mat_date = random_date_in_month(current_year, mat_month)
            all_payments.append({
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "student_id": sid,
                "grade_id": gid,
                "section_id": secid,
                "concept": "matricula",
                "description": f"Matricula {current_year}",
                "amount_base": 350.00,
                "igv_amount": 0,
                "total_amount": 350.00,
                "igv_applicable": False,
                "igv_percentage": 0,
                "payment_method": pick_weighted(PAYMENT_METHODS_WEIGHTED),
                "payment_status": "paid",
                "payment_date": mat_date,
                "pension_month": None,
                "receipt_number": None,
                "notes": None,
                "created_by": admin_id,
                "created_at": ts_base,
                "updated_at": ts_base,
            })

        # Monthly pensions
        for month in months_to_seed:
            is_moroso = sid in moroso_unpaid and month in moroso_unpaid.get(sid, set())

            if is_moroso:
                # Pending payment for moroso
                pay_date = random_date_in_month(current_year, month)
                all_payments.append({
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "student_id": sid,
                    "grade_id": gid,
                    "section_id": secid,
                    "concept": "mensualidad",
                    "description": f"Pension {MONTH_NAMES[month]} {current_year}",
                    "amount_base": pension,
                    "igv_amount": 0,
                    "total_amount": pension,
                    "igv_applicable": False,
                    "igv_percentage": 0,
                    "payment_method": pick_weighted(PAYMENT_METHODS_WEIGHTED),
                    "payment_status": "pending",
                    "payment_date": pay_date,
                    "pension_month": f"{current_year}-{month:02d}",
                    "receipt_number": None,
                    "notes": None,
                    "created_by": admin_id,
                    "created_at": ts_base,
                    "updated_at": ts_base,
                })
            else:
                # Paid pension
                pay_date = random_date_in_month(current_year, month)
                all_payments.append({
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "student_id": sid,
                    "grade_id": gid,
                    "section_id": secid,
                    "concept": "mensualidad",
                    "description": f"Pension {MONTH_NAMES[month]} {current_year}",
                    "amount_base": pension,
                    "igv_amount": 0,
                    "total_amount": pension,
                    "igv_applicable": False,
                    "igv_percentage": 0,
                    "payment_method": pick_weighted(PAYMENT_METHODS_WEIGHTED),
                    "payment_status": "paid",
                    "payment_date": pay_date,
                    "pension_month": f"{current_year}-{month:02d}",
                    "receipt_number": None,
                    "notes": None,
                    "created_by": admin_id,
                    "created_at": ts_base,
                    "updated_at": ts_base,
                })

        # Extra concepts for ~30% of students
        if sid in extra_students and months_to_seed:
            n_extras = random.randint(2, 3)
            chosen_extras = random.sample(EXTRA_CONCEPTS, min(n_extras, len(EXTRA_CONCEPTS)))
            for concept_key, desc, lo, hi in chosen_extras:
                ex_month = random.choice(months_to_seed)
                ex_date = random_date_in_month(current_year, ex_month)
                amount = round(random.uniform(lo, hi), 2)
                all_payments.append({
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "student_id": sid,
                    "grade_id": gid,
                    "section_id": secid,
                    "concept": concept_key,
                    "description": desc,
                    "amount_base": amount,
                    "igv_amount": 0,
                    "total_amount": amount,
                    "igv_applicable": False,
                    "igv_percentage": 0,
                    "payment_method": pick_weighted(PAYMENT_METHODS_WEIGHTED),
                    "payment_status": "paid",
                    "payment_date": ex_date,
                    "pension_month": None,
                    "receipt_number": None,
                    "notes": None,
                    "created_by": admin_id,
                    "created_at": ts_base,
                    "updated_at": ts_base,
                })

    # ── Generate expenses ───────────────────────────────────────────────────
    all_expenses = []

    # Assign consistent salary per teacher
    teacher_salaries = {}
    for t in teachers:
        teacher_salaries[t["id"]] = round(random.uniform(1800, 2800), 2)

    for month in months_to_seed:
        # Teacher salaries
        for t in teachers:
            salary = teacher_salaries[t["id"]]
            t_name = f"{t.get('name', '')} {t.get('last_name', '')}".strip()
            sal_date = random_date_in_month(current_year, month)
            # Salary typically paid between 25th-30th
            day = random.randint(25, 28)
            sal_date = f"{current_year}-{month:02d}-{day:02d}"
            all_expenses.append({
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "title": f"Sueldo - {t_name} - {MONTH_NAMES[month]}",
                "category": "personal",
                "description": f"Remuneracion mensual {MONTH_NAMES[month]} {current_year}",
                "amount_base": salary,
                "igv_amount": 0,
                "total_amount": salary,
                "igv_applicable": False,
                "igv_percentage": 0,
                "expense_date": sal_date,
                "payment_method": "transferencia",
                "provider_name": None,
                "notes": None,
                "created_by": admin_id,
                "created_at": ts_base,
                "updated_at": ts_base,
            })

        # Recurring services (luz, agua, internet)
        for title, cat, provider, lo, hi in RECURRING_SERVICES:
            base = round(random.uniform(lo, hi), 2)
            # Small variation month to month (±10%)
            variation = round(base * random.uniform(-0.10, 0.10), 2)
            amount = round(base + variation, 2)
            svc_date = random_date_in_month(current_year, month)
            all_expenses.append({
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "title": f"{title} - {MONTH_NAMES[month]}",
                "category": cat,
                "description": f"Pago mensual {MONTH_NAMES[month]} {current_year}",
                "amount_base": amount,
                "igv_amount": 0,
                "total_amount": amount,
                "igv_applicable": False,
                "igv_percentage": 0,
                "expense_date": svc_date,
                "payment_method": "transferencia",
                "provider_name": provider,
                "notes": None,
                "created_by": admin_id,
                "created_at": ts_base,
                "updated_at": ts_base,
            })

        # Operational expenses: 2-4 per month
        n_ops = random.randint(2, 4)
        chosen_ops = random.sample(OPERATIONAL_EXPENSES, min(n_ops, len(OPERATIONAL_EXPENSES)))
        for title, cat, provider in chosen_ops:
            amount = round(random.uniform(100, 800), 2)
            op_date = random_date_in_month(current_year, month)
            all_expenses.append({
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "title": f"{title} - {MONTH_NAMES[month]}",
                "category": cat,
                "description": None,
                "amount_base": amount,
                "igv_amount": 0,
                "total_amount": amount,
                "igv_applicable": False,
                "igv_percentage": 0,
                "expense_date": op_date,
                "payment_method": pick_weighted(EXPENSE_METHODS_WEIGHTED),
                "provider_name": provider,
                "notes": None,
                "created_by": admin_id,
                "created_at": ts_base,
                "updated_at": ts_base,
            })

    # ── Generate boletas (only for paid payments, sorted by date) ───────────
    all_boletas = []

    if has_boleta_config:
        serie = boleta_config.get("serie", "B001")

        # Get parent info for boletas (batch)
        parent_ids = set()
        for s in students:
            pid = s.get("parent_id") or s.get("padre_id")
            if pid:
                parent_ids.add(pid)
        parents_raw = await db.users.find(
            {"id": {"$in": list(parent_ids)}},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "dni": 1}
        ).to_list(500)
        parent_map = {p["id"]: p for p in parents_raw}

        # Student lookup
        student_map = {s["id"]: s for s in students}

        # Filter only paid payments and sort by date ascending for correlativo order
        paid_payments = [p for p in all_payments if p["payment_status"] == "paid"]
        paid_payments.sort(key=lambda p: p["payment_date"])

        for idx, payment in enumerate(paid_payments, start=1):
            correlativo = idx
            numero_completo = f"{serie}-{correlativo:08d}"

            student = student_map.get(payment["student_id"], {})
            estudiante_nombre = f"{student.get('name', '')} {student.get('last_name', '')}".strip()

            # Client: parent if available, otherwise student
            cliente_nombre = estudiante_nombre
            cliente_dni = student.get("dni", "") or ""
            pid = student.get("parent_id") or student.get("padre_id")
            if pid and pid in parent_map:
                p = parent_map[pid]
                cliente_nombre = f"{p.get('name', '')} {p.get('last_name', '')}".strip()
                cliente_dni = p.get("dni", "") or ""

            # Grade/section label
            grade = grade_map.get(student.get("grado_id"), {})
            section = section_map.get(student.get("seccion_id"), {})
            grado_seccion = f"{grade.get('nivel_nombre', '')} - {grade.get('nombre', '')}"
            if section:
                grado_seccion += f" {section.get('nombre', '')}"

            # Concept labels
            CONCEPT_LABELS = {
                "matricula": "Matricula", "mensualidad": "Pension Escolar",
                "taller": "Taller", "uniforme": "Uniforme Escolar",
                "material": "Material Escolar", "evento": "Excursion Educativa",
                "otros": "Otros"
            }
            concepto_label = CONCEPT_LABELS.get(payment.get("concept", ""), payment.get("description", "Pago"))

            # Month label
            mes_label = ""
            pm = payment.get("pension_month", "")
            if pm and len(pm) >= 7:
                m_num = int(pm[5:7])
                mes_label = f"{MONTH_NAMES.get(m_num, '')} {pm[:4]}"

            total = payment["total_amount"]
            total_letras = monto_en_letras(total)

            # Emisor snapshot
            emisor_snapshot = {
                "razon_social": boleta_config.get("razon_social", ""),
                "ruc": boleta_config.get("ruc", ""),
                "direccion": boleta_config.get("direccion", ""),
                "distrito": boleta_config.get("distrito", ""),
                "provincia": boleta_config.get("provincia", ""),
                "departamento": boleta_config.get("departamento", ""),
                "telefono": boleta_config.get("telefono"),
                "email": boleta_config.get("email"),
                "logo_url": logo_url,
                "pie_pagina": boleta_config.get("pie_pagina"),
            }

            boleta_doc = {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "ingreso_id": payment["id"],
                "numero_completo": numero_completo,
                "serie": serie,
                "correlativo": correlativo,
                "fecha_emision": payment["payment_date"] + "T12:00:00+00:00",
                "emisor": emisor_snapshot,
                "cliente": {
                    "nombre_completo": cliente_nombre,
                    "dni": cliente_dni,
                    "estudiante_nombre": estudiante_nombre,
                    "grado_seccion": grado_seccion,
                },
                "concepto": concepto_label,
                "mes": mes_label,
                "metodo_pago": payment.get("payment_method", "efectivo"),
                "monto_base": payment["amount_base"],
                "incluye_igv": False,
                "igv": 0,
                "subtotal": payment["amount_base"],
                "total": total,
                "total_en_letras": total_letras,
                "usuario_emisor": f"{admin_name} - Seed Demo",
                "anulada": False,
                "fecha_anulacion": None,
                "created_at": payment["payment_date"] + "T12:00:00+00:00",
            }
            all_boletas.append(boleta_doc)

        # Update boleta_emisor_config correlativo to match last boleta
        if all_boletas:
            last_corr = len(all_boletas)
            await db.boleta_emisor_config.update_one(
                {"school_id": school_id},
                {"$set": {
                    "correlativo_actual": last_corr,
                    "updated_at": now.isoformat()
                }}
            )

    # ── Bulk insert ─────────────────────────────────────────────────────────
    if all_payments:
        await db.payments.insert_many(all_payments)
    if all_expenses:
        await db.expenses.insert_many(all_expenses)
    if all_boletas:
        await db.boletas_internas.insert_many(all_boletas)

    # Count morosos
    morosos_real = len([sid for sid, months in moroso_unpaid.items() if months])

    date_start = f"{current_year}-01-01"
    date_end = f"{current_year}-{months_to_seed[-1]:02d}-28" if months_to_seed else date_start

    logger.info(
        f"[SEED-DEMO] Completed for '{school_name}' ({school_id}). "
        f"Created: {len(all_payments)} payments, {len(all_expenses)} expenses, {len(all_boletas)} boletas. "
        f"Morosos: {morosos_real}"
    )

    return {
        "success": True,
        "school_id": school_id,
        "school_name": school_name,
        "reset_aplicado": data.reset,
        "registros_borrados": borrados,
        "registros_creados": {
            "ingresos": len(all_payments),
            "egresos": len(all_expenses),
            "boletas": len(all_boletas),
        },
        "alumnos_con_morosidad": morosos_real,
        "rango_fechas": f"{date_start} a {date_end}",
        "timestamp": now.isoformat(),
    }
