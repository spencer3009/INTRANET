"""
Seed demo data for Contabilidad module - Colegio El Roble
Creates 30 demo students + realistic payment data (matricula + pensiones)
"""
import asyncio
import uuid
import random
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import hashlib

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"
GRADE_3ANIOS = "6ef8ab18-41b2-45e7-b482-06a84d95c34d"
SECTION_UNICA = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
GRADE_1RO = "4bcad3be-c38e-4b7c-8a80-eb3dd4bf8f6e"
SECTION_A = "18dd37fa-79d6-4b38-b5a2-46deeb1b00fe"

PENSION_BASE = 350.0  # S/ 350 mensualidad
MATRICULA_BASE = 500.0  # S/ 500 matrícula
IGV_PCT = 18.0

FIRST_NAMES = [
    "Mateo", "Valentina", "Santiago", "Isabella", "Sebastián",
    "Camila", "Alejandro", "Sofía", "Diego", "Luciana",
    "Andrés", "Mariana", "Gabriel", "Daniela", "Fernando",
    "Antonella", "Carlos", "Fernanda", "Luis", "Catalina",
    "Miguel", "Valeria", "Ricardo", "Gabriela", "Joaquín",
    "Andrea", "Eduardo", "Natalia", "Adrián", "Paula",
    "Rodrigo", "María José", "Fabián", "Jimena", "Emilio"
]

LAST_NAMES = [
    "García Torres", "Rodriguez Mendoza", "López Vargas", "Martínez Cruz", "Hernández Ríos",
    "González Paredes", "Pérez Sánchez", "Ramírez Flores", "Torres Gutiérrez", "Flores Castro",
    "Rivera Huamán", "Gómez Espinoza", "Díaz Morales", "Reyes Chávez", "Morales Rojas",
    "Ortiz Salazar", "Jiménez Delgado", "Ruiz Bustamante", "Navarro Córdova", "Mendoza Vega",
    "Castillo León", "Romero Aguirre", "Quispe Herrera", "Vargas Contreras", "Medina Palacios",
    "Salazar Campos", "Delgado Silva", "Chávez Miranda", "Soto Valverde", "Paredes Ramos",
    "Huamán Arias", "Espinoza Luna", "Cruz Becerra", "León Suárez", "Silva Montalvo"
]

METHODS = ["efectivo", "transferencia", "yape", "plin", "tarjeta"]

def calc_igv(base, applicable=True):
    if applicable:
        igv = round(base * IGV_PCT / 100, 2)
        return {"amount_base": base, "igv_amount": igv, "total_amount": round(base + igv, 2), "igv_applicable": True, "igv_percentage": IGV_PCT}
    return {"amount_base": base, "igv_amount": 0, "total_amount": base, "igv_applicable": False, "igv_percentage": 0}

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

async def seed():
    # Clean previous demo data
    await db.users.delete_many({"school_id": SCHOOL_ID, "is_demo": True, "role": "student"})
    await db.payments.delete_many({"school_id": SCHOOL_ID, "is_demo": True})
    print("Cleaned previous demo data")

    # Create 30 demo students (15 per grade)
    students = []
    now = datetime.now(timezone.utc).isoformat()
    
    for i in range(30):
        grade_id = GRADE_3ANIOS if i < 15 else GRADE_1RO
        section_id = SECTION_UNICA if i < 15 else SECTION_A
        
        student = {
            "id": str(uuid.uuid4()),
            "school_id": SCHOOL_ID,
            "email": f"demo.student{i+1}@elroble.edu",
            "password_hash": hash_password("demo1234"),
            "name": FIRST_NAMES[i],
            "last_name": LAST_NAMES[i],
            "role": "student",
            "grado_id": grade_id,
            "seccion_id": section_id,
            "is_demo": True,
            "activo": True,
            "created_at": now,
            "updated_at": now
        }
        students.append(student)
    
    await db.users.insert_many(students)
    print(f"Created {len(students)} demo students")

    # Create payment data
    # School year 2026: March to current month (Feb 2026 means we simulate 2025 year)
    # Simulate: School year started March 2025, pensiones Mar-Dec 2025 + Jan-Feb 2026
    pension_months = ["2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]
    
    payments = []
    
    # Distribution:
    # 10 students: AL DIA (all months paid)
    # 8 students: 1 month pending
    # 6 students: 2 months pending  
    # 4 students: 3 months pending
    # 2 students: 4+ months pending (heavy debtors)
    
    profiles = (
        [0] * 10 +   # 0 months pending (al dia)
        [1] * 8 +    # 1 month pending
        [2] * 6 +    # 2 months pending
        [3] * 4 +    # 3 months pending
        [5] * 2      # 5 months pending
    )
    random.shuffle(profiles)
    
    for idx, student in enumerate(students):
        pending_months_count = profiles[idx]
        
        # Matrícula - everyone paid matricula
        mat_date = f"2025-02-{random.randint(10, 28):02d}"
        mat_amounts = calc_igv(MATRICULA_BASE)
        payments.append({
            "id": str(uuid.uuid4()),
            "school_id": SCHOOL_ID,
            "student_id": student["id"],
            "grade_id": student["grado_id"],
            "section_id": student["seccion_id"],
            "concept": "matricula",
            "description": "Matrícula escolar 2025",
            "pension_month": "2025-03",
            **mat_amounts,
            "payment_method": random.choice(METHODS),
            "payment_status": "paid",
            "payment_date": mat_date,
            "receipt_number": f"MAT-{2025}-{idx+1:04d}",
            "notes": None,
            "is_demo": True,
            "created_by": "system",
            "created_at": now,
            "updated_at": now
        })
        
        # Mensualidades
        paid_months = pension_months[:len(pension_months) - pending_months_count] if pending_months_count > 0 else pension_months
        pending_months_list = pension_months[len(pension_months) - pending_months_count:] if pending_months_count > 0 else []
        
        for pm in paid_months:
            year, month = pm.split("-")
            pay_day = random.randint(1, 15)
            pay_date = f"{year}-{month}-{pay_day:02d}"
            amounts = calc_igv(PENSION_BASE)
            payments.append({
                "id": str(uuid.uuid4()),
                "school_id": SCHOOL_ID,
                "student_id": student["id"],
                "grade_id": student["grado_id"],
                "section_id": student["seccion_id"],
                "concept": "mensualidad",
                "description": None,
                "pension_month": pm,
                **amounts,
                "payment_method": random.choice(METHODS),
                "payment_status": "paid",
                "payment_date": pay_date,
                "receipt_number": f"PEN-{year}-{month}-{idx+1:04d}",
                "notes": None,
                "is_demo": True,
                "created_by": "system",
                "created_at": now,
                "updated_at": now
            })
        
        for pm in pending_months_list:
            amounts = calc_igv(PENSION_BASE)
            payments.append({
                "id": str(uuid.uuid4()),
                "school_id": SCHOOL_ID,
                "student_id": student["id"],
                "grade_id": student["grado_id"],
                "section_id": student["seccion_id"],
                "concept": "mensualidad",
                "description": None,
                "pension_month": pm,
                **amounts,
                "payment_method": "efectivo",
                "payment_status": "pending",
                "payment_date": f"{pm}-01",
                "receipt_number": None,
                "notes": None,
                "is_demo": True,
                "created_by": "system",
                "created_at": now,
                "updated_at": now
            })
    
    await db.payments.insert_many(payments)
    print(f"Created {len(payments)} demo payments")
    
    # Summary
    paid_count = len([p for p in payments if p["payment_status"] == "paid"])
    pending_count = len([p for p in payments if p["payment_status"] == "pending"])
    total_pending = sum(p["total_amount"] for p in payments if p["payment_status"] == "pending")
    morosos = len([p for p in profiles if p > 0])
    al_dia = len([p for p in profiles if p == 0])
    
    print(f"\n=== SUMMARY ===")
    print(f"Students: {len(students)}")
    print(f"Total payments: {len(payments)}")
    print(f"Paid: {paid_count} | Pending: {pending_count}")
    print(f"Al día: {al_dia} | Morosos: {morosos}")
    print(f"Total deuda: S/ {total_pending:,.2f}")

asyncio.run(seed())
