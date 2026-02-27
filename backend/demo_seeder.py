"""
Demo Data Seeding Module
=========================
This module provides functions to seed demo data for new school intranets.
All demo data is marked with is_demo=True for easy identification and removal.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# DEMO DATA TEMPLATES
# ══════════════════════════════════════════════════════════════════════════════

def get_demo_levels():
    """Get demo educational levels"""
    return [
        {"nombre": "Inicial", "descripcion": "Educación inicial para niños de 3 a 5 años", "orden": 1},
        {"nombre": "Primaria", "descripcion": "Educación primaria de 1° a 6° grado", "orden": 2},
        {"nombre": "Secundaria", "descripcion": "Educación secundaria de 1° a 5° año", "orden": 3},
    ]

def get_demo_grades(level_ids: dict):
    """Get demo grades for each level"""
    grades = []
    # Inicial
    for i in range(1, 4):
        grades.append({
            "nombre": f"{i} años",
            "nivel_id": level_ids["Inicial"],
            "orden": i,
        })
    # Primaria
    for i in range(1, 7):
        grades.append({
            "nombre": f"{i}° Primaria",
            "nivel_id": level_ids["Primaria"],
            "orden": i,
        })
    # Secundaria
    for i in range(1, 6):
        grades.append({
            "nombre": f"{i}° Secundaria",
            "nivel_id": level_ids["Secundaria"],
            "orden": i,
        })
    return grades

def get_demo_sections():
    """Get demo sections"""
    return [
        {"nombre": "A", "descripcion": "Sección A", "capacidad_maxima": 30},
        {"nombre": "B", "descripcion": "Sección B", "capacidad_maxima": 30},
    ]

def get_demo_shifts():
    """Get demo shifts"""
    return [
        {"nombre": "Mañana", "hora_inicio": "07:30", "hora_fin": "13:00", "descripcion": "Turno matutino"},
        {"nombre": "Tarde", "hora_inicio": "13:30", "hora_fin": "18:30", "descripcion": "Turno vespertino"},
    ]

def get_demo_academic_period():
    """Get demo academic period"""
    current_year = datetime.now().year
    return {
        "nombre": f"Año Escolar {current_year}",
        "fecha_inicio": f"{current_year}-03-01",
        "fecha_fin": f"{current_year}-12-15",
        "estado": "activo",
        "descripcion": f"Período académico {current_year}"
    }

def get_demo_subjects():
    """Get demo subjects with colors"""
    return [
        {"name": "Matemáticas", "code": "MAT", "color": "#3B82F6", "weekly_hours": 6, "description": "Desarrollo del pensamiento lógico-matemático"},
        {"name": "Comunicación", "code": "COM", "color": "#10B981", "weekly_hours": 6, "description": "Competencias comunicativas en español"},
        {"name": "Ciencia y Tecnología", "code": "CYT", "color": "#8B5CF6", "weekly_hours": 4, "description": "Exploración del mundo natural y tecnológico"},
        {"name": "Personal Social", "code": "PS", "color": "#F59E0B", "weekly_hours": 3, "description": "Desarrollo personal y ciudadanía"},
        {"name": "Inglés", "code": "ING", "color": "#EF4444", "weekly_hours": 4, "description": "Competencias en lengua extranjera"},
        {"name": "Arte y Cultura", "code": "ART", "color": "#EC4899", "weekly_hours": 2, "description": "Expresión artística y apreciación cultural"},
        {"name": "Educación Física", "code": "EF", "color": "#06B6D4", "weekly_hours": 2, "description": "Desarrollo físico y motriz"},
        {"name": "Educación Religiosa", "code": "REL", "color": "#84CC16", "weekly_hours": 2, "description": "Formación en valores y espiritualidad"},
    ]

def get_demo_teachers():
    """Get demo teachers"""
    return [
        {
            "name": "María Elena",
            "last_name": "García López",
            "email": "maria.garcia@demo.edu.pe",
            "phone": "+51 999 111 001",
            "dni": "12345678",
            "specialty": "Matemáticas",
        },
        {
            "name": "Carlos Alberto",
            "last_name": "Rodríguez Pérez",
            "email": "carlos.rodriguez@demo.edu.pe",
            "phone": "+51 999 111 002",
            "dni": "12345679",
            "specialty": "Comunicación",
        },
        {
            "name": "Ana María",
            "last_name": "Fernández Torres",
            "email": "ana.fernandez@demo.edu.pe",
            "phone": "+51 999 111 003",
            "dni": "12345680",
            "specialty": "Ciencias",
        },
        {
            "name": "Luis Miguel",
            "last_name": "Vargas Sánchez",
            "email": "luis.vargas@demo.edu.pe",
            "phone": "+51 999 111 004",
            "dni": "12345681",
            "specialty": "Inglés",
        },
    ]

def get_demo_students():
    """Get demo students"""
    return [
        {"name": "Alejandro", "last_name": "Martínez Quispe", "dni": "70000001"},
        {"name": "Sofía", "last_name": "Huamán Castro", "dni": "70000002"},
        {"name": "Diego", "last_name": "Paredes Luna", "dni": "70000003"},
        {"name": "Valentina", "last_name": "Ríos Mendoza", "dni": "70000004"},
        {"name": "Mateo", "last_name": "Espinoza Vega", "dni": "70000005"},
        {"name": "Camila", "last_name": "Flores Ramos", "dni": "70000006"},
        {"name": "Sebastián", "last_name": "Chávez Gutiérrez", "dni": "70000007"},
        {"name": "Luciana", "last_name": "Torres Delgado", "dni": "70000008"},
        {"name": "Thiago", "last_name": "Rojas Medina", "dni": "70000009"},
        {"name": "Isabella", "last_name": "Vargas Campos", "dni": "70000010"},
    ]

def get_demo_news():
    """Get demo news articles"""
    now = datetime.now(timezone.utc)
    return [
        {
            "title": "¡Bienvenidos al nuevo año escolar!",
            "content": "Nos complace darles la bienvenida a un nuevo año escolar lleno de oportunidades de aprendizaje. Este año implementaremos nuevas metodologías pedagógicas y tecnologías educativas para mejorar la experiencia de nuestros estudiantes.",
            "category": "announcement",
            "status": "published",
            "pinned": True,
            "published_at": (now - timedelta(hours=6)).isoformat(),
        },
        {
            "title": "Inscripciones abiertas para talleres extracurriculares",
            "content": "Informamos a los padres de familia que las inscripciones para los talleres de música, arte y deportes están abiertas. Los talleres se desarrollarán los días sábados de 9:00 a.m. a 12:00 p.m.",
            "category": "academic",
            "status": "published",
            "pinned": False,
            "published_at": (now - timedelta(days=1)).isoformat(),
        },
        {
            "title": "Reunión de padres de familia",
            "content": "Se convoca a todos los padres de familia a la reunión general que se llevará a cabo el próximo viernes a las 6:00 p.m. en el auditorio principal. Se tratarán temas importantes sobre el plan de estudios.",
            "category": "event",
            "status": "published",
            "pinned": False,
            "published_at": (now - timedelta(days=2)).isoformat(),
        },
    ]

def get_demo_calendar_events():
    """Get demo calendar events"""
    today = datetime.now()
    return [
        {
            "title": "Capacitación Docente",
            "description": "Taller de actualización pedagógica para todo el personal docente",
            "type": "institutional",
            "start_date": (today + timedelta(days=1)).strftime("%Y-%m-%d") + "T09:00:00",
            "end_date": (today + timedelta(days=1)).strftime("%Y-%m-%d") + "T13:00:00",
            "location": "Sala de reuniones",
            "color": "#8B5CF6",
        },
        {
            "title": "Examen Parcial de Matemáticas",
            "description": "Evaluación parcial del primer bimestre para todos los grados",
            "type": "academic",
            "start_date": (today + timedelta(days=4)).strftime("%Y-%m-%d") + "T08:00:00",
            "end_date": (today + timedelta(days=4)).strftime("%Y-%m-%d") + "T10:00:00",
            "location": "Aulas",
            "color": "#3B82F6",
        },
        {
            "title": "Reunión de Padres",
            "description": "Reunión general con padres de familia para informes de avance",
            "type": "communication",
            "start_date": (today + timedelta(days=9)).strftime("%Y-%m-%d") + "T18:00:00",
            "end_date": (today + timedelta(days=9)).strftime("%Y-%m-%d") + "T20:00:00",
            "location": "Auditorio principal",
            "color": "#10B981",
        },
        {
            "title": "Feria de Ciencias",
            "description": "Exposición de proyectos científicos de los estudiantes",
            "type": "cultural",
            "start_date": (today + timedelta(days=15)).strftime("%Y-%m-%d") + "T09:00:00",
            "end_date": (today + timedelta(days=15)).strftime("%Y-%m-%d") + "T17:00:00",
            "location": "Patio central",
            "color": "#EC4899",
        },
        {
            "title": "Día del Deporte",
            "description": "Jornada deportiva con competencias interaulas",
            "type": "sports",
            "start_date": (today + timedelta(days=22)).strftime("%Y-%m-%d") + "T07:30:00",
            "end_date": (today + timedelta(days=22)).strftime("%Y-%m-%d") + "T14:00:00",
            "location": "Campo deportivo",
            "color": "#F59E0B",
        },
    ]

def get_demo_payment_concepts():
    """Get demo payment concepts"""
    return [
        {"name": "Matrícula", "amount": 350.00, "category": "matricula", "description": "Pago único de matrícula anual"},
        {"name": "Pensión Mensual", "amount": 450.00, "category": "pension", "description": "Pensión mensual de enseñanza"},
        {"name": "APAFA", "amount": 100.00, "category": "otros", "description": "Cuota anual de asociación de padres"},
        {"name": "Materiales", "amount": 150.00, "category": "otros", "description": "Kit de materiales educativos"},
        {"name": "Uniforme Completo", "amount": 280.00, "category": "otros", "description": "Uniforme escolar completo"},
    ]

def get_demo_payments(student_ids: list, concept_ids: dict):
    """Get demo payments"""
    now = datetime.now(timezone.utc)
    payments = []
    
    # Some students have paid, some pending
    for i, student_id in enumerate(student_ids[:5]):
        # Matrícula pagada
        payments.append({
            "student_id": student_id,
            "concept_id": concept_ids.get("Matrícula"),
            "amount": 350.00,
            "status": "paid",
            "payment_date": (now - timedelta(days=30 + i)).isoformat(),
            "payment_method": "transfer",
            "reference": f"MAT-2024-{1000 + i}",
        })
        
        # Pensión Marzo pagada
        payments.append({
            "student_id": student_id,
            "concept_id": concept_ids.get("Pensión Mensual"),
            "amount": 450.00,
            "status": "paid",
            "payment_date": (now - timedelta(days=15 + i)).isoformat(),
            "payment_method": "cash" if i % 2 == 0 else "transfer",
            "reference": f"PEN-MAR-{1000 + i}",
            "month": "Marzo",
        })
    
    # Pending payments
    for i, student_id in enumerate(student_ids[5:8]):
        payments.append({
            "student_id": student_id,
            "concept_id": concept_ids.get("Pensión Mensual"),
            "amount": 450.00,
            "status": "pending",
            "due_date": (now + timedelta(days=5)).isoformat(),
            "month": "Abril",
        })
    
    return payments

def get_demo_dashboard_metrics():
    """Get demo dashboard metrics"""
    return {
        "total_students": 245,
        "total_teachers": 18,
        "total_parents": 198,
        "attendance_rate": 94.5,
        "courses_active": 12,
        "pending_payments": 15,
    }

def get_demo_enrollment_data():
    """Get demo enrollment chart data"""
    return [
        {"month": "Ene", "count": 180},
        {"month": "Feb", "count": 220},
        {"month": "Mar", "count": 245},
        {"month": "Abr", "count": 248},
        {"month": "May", "count": 250},
        {"month": "Jun", "count": 252},
        {"month": "Jul", "count": 250},
        {"month": "Ago", "count": 255},
        {"month": "Sep", "count": 258},
        {"month": "Oct", "count": 260},
        {"month": "Nov", "count": 262},
        {"month": "Dic", "count": 265},
    ]


# ══════════════════════════════════════════════════════════════════════════════
# MAIN SEEDING FUNCTION
# ══════════════════════════════════════════════════════════════════════════════

async def seed_demo_data_for_school(db, school_id: str, owner_user_id: str):
    """
    Seed all demo data for a newly created school.
    All data is marked with is_demo=True for easy identification.
    
    Args:
        db: MongoDB database instance
        school_id: The ID of the school to seed data for
        owner_user_id: The ID of the owner user (to set as author for news, etc.)
    
    Returns:
        dict: Summary of seeded data
    """
    now = datetime.now(timezone.utc)
    summary = {"seeded": [], "errors": []}
    
    try:
        # ─────────────────────────────────────────────────────────────────────
        # 1. SEED EDUCATIONAL LEVELS
        # ─────────────────────────────────────────────────────────────────────
        level_ids = {}
        for level_data in get_demo_levels():
            level_id = str(uuid.uuid4())
            level_doc = {
                "id": level_id,
                "school_id": school_id,
                **level_data,
                "estado": "activo",
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.academic_levels.insert_one(level_doc)
            level_ids[level_data["nombre"]] = level_id
        summary["seeded"].append(f"3 niveles educativos")
        
        # ─────────────────────────────────────────────────────────────────────
        # 2. SEED GRADES
        # ─────────────────────────────────────────────────────────────────────
        grade_ids = {}
        grade_count = 0
        for grade_data in get_demo_grades(level_ids):
            grade_id = str(uuid.uuid4())
            grade_doc = {
                "id": grade_id,
                "school_id": school_id,
                **grade_data,
                "estado": "activo",
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.grades.insert_one(grade_doc)
            grade_ids[grade_data["nombre"]] = grade_id
            grade_count += 1
        summary["seeded"].append(f"{grade_count} grados")
        
        # ─────────────────────────────────────────────────────────────────────
        # 3. SEED SECTIONS
        # ─────────────────────────────────────────────────────────────────────
        section_ids = {}
        for section_data in get_demo_sections():
            section_id = str(uuid.uuid4())
            section_doc = {
                "id": section_id,
                "school_id": school_id,
                **section_data,
                "estado": "activo",
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.sections.insert_one(section_doc)
            section_ids[section_data["nombre"]] = section_id
        summary["seeded"].append(f"2 secciones")
        
        # ─────────────────────────────────────────────────────────────────────
        # 4. SEED SHIFTS
        # ─────────────────────────────────────────────────────────────────────
        shift_ids = {}
        for shift_data in get_demo_shifts():
            shift_id = str(uuid.uuid4())
            shift_doc = {
                "id": shift_id,
                "school_id": school_id,
                **shift_data,
                "estado": "activo",
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.shifts.insert_one(shift_doc)
            shift_ids[shift_data["nombre"]] = shift_id
        summary["seeded"].append(f"2 turnos")
        
        # ─────────────────────────────────────────────────────────────────────
        # 5. SEED ACADEMIC PERIOD
        # ─────────────────────────────────────────────────────────────────────
        period_data = get_demo_academic_period()
        period_id = str(uuid.uuid4())
        period_doc = {
            "id": period_id,
            "school_id": school_id,
            **period_data,
            "is_demo": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        await db.academic_periods.insert_one(period_doc)
        summary["seeded"].append(f"1 período académico")
        
        # ─────────────────────────────────────────────────────────────────────
        # 6. SEED TEACHERS
        # ─────────────────────────────────────────────────────────────────────
        teacher_ids = []
        for teacher_data in get_demo_teachers():
            teacher_id = str(uuid.uuid4())
            teacher_doc = {
                "id": teacher_id,
                "school_id": school_id,
                **teacher_data,
                "role": "teacher",
                "status": "active",
                "email_verified": True,
                "password": "demo_password_hash",  # Not real, demo users can't login
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.users.insert_one(teacher_doc)
            teacher_ids.append(teacher_id)
        summary["seeded"].append(f"{len(teacher_ids)} profesores demo")
        
        # ─────────────────────────────────────────────────────────────────────
        # 7. SEED STUDENTS
        # ─────────────────────────────────────────────────────────────────────
        student_ids = []
        primaria_1_id = grade_ids.get("1° Primaria")
        for i, student_data in enumerate(get_demo_students()):
            student_id = str(uuid.uuid4())
            student_doc = {
                "id": student_id,
                "school_id": school_id,
                **student_data,
                "role": "student",
                "email": f"estudiante{i+1}@demo.edu.pe",
                "status": "active",
                "grado_id": primaria_1_id,
                "seccion_id": section_ids.get("A") if i < 5 else section_ids.get("B"),
                "turno_id": shift_ids.get("Mañana"),
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.users.insert_one(student_doc)
            student_ids.append(student_id)
        summary["seeded"].append(f"{len(student_ids)} estudiantes demo")
        
        # ─────────────────────────────────────────────────────────────────────
        # 8. SEED SUBJECTS
        # ─────────────────────────────────────────────────────────────────────
        subject_ids = []
        for i, subject_data in enumerate(get_demo_subjects()):
            subject_id = str(uuid.uuid4())
            subject_doc = {
                "id": subject_id,
                "school_id": school_id,
                **subject_data,
                "level_id": level_ids.get("Primaria"),
                "grade_id": primaria_1_id,
                "status": "active",
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.subjects.insert_one(subject_doc)
            subject_ids.append(subject_id)
            
            # Assign teacher to subject
            if i < len(teacher_ids):
                assignment = {
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "subject_id": subject_id,
                    "teacher_id": teacher_ids[i % len(teacher_ids)],
                    "is_demo": True,
                    "created_at": now.isoformat(),
                }
                await db.subject_teachers.insert_one(assignment)
        summary["seeded"].append(f"{len(subject_ids)} asignaturas")
        
        # ─────────────────────────────────────────────────────────────────────
        # 9. SEED NEWS
        # ─────────────────────────────────────────────────────────────────────
        for news_data in get_demo_news():
            news_id = str(uuid.uuid4())
            news_doc = {
                "id": news_id,
                "school_id": school_id,
                **news_data,
                "author_id": owner_user_id,
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.news.insert_one(news_doc)
        summary["seeded"].append(f"3 noticias demo")
        
        # ─────────────────────────────────────────────────────────────────────
        # 10. SEED CALENDAR EVENTS
        # ─────────────────────────────────────────────────────────────────────
        for event_data in get_demo_calendar_events():
            event_id = str(uuid.uuid4())
            event_doc = {
                "id": event_id,
                "school_id": school_id,
                **event_data,
                "created_by": owner_user_id,
                "visibility": {},  # Public to all
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.calendar_events.insert_one(event_doc)
        summary["seeded"].append(f"5 eventos de calendario")
        
        # ─────────────────────────────────────────────────────────────────────
        # 11. SEED PAYMENT CONCEPTS
        # ─────────────────────────────────────────────────────────────────────
        concept_ids = {}
        for concept_data in get_demo_payment_concepts():
            concept_id = str(uuid.uuid4())
            concept_doc = {
                "id": concept_id,
                "school_id": school_id,
                **concept_data,
                "status": "active",
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.payment_concepts.insert_one(concept_doc)
            concept_ids[concept_data["name"]] = concept_id
        summary["seeded"].append(f"5 conceptos de pago")
        
        # ─────────────────────────────────────────────────────────────────────
        # 12. SEED PAYMENTS
        # ─────────────────────────────────────────────────────────────────────
        payments = get_demo_payments(student_ids, concept_ids)
        for payment_data in payments:
            payment_id = str(uuid.uuid4())
            payment_doc = {
                "id": payment_id,
                "school_id": school_id,
                **payment_data,
                "is_demo": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            await db.payments.insert_one(payment_doc)
        summary["seeded"].append(f"{len(payments)} pagos demo")
        
        # ─────────────────────────────────────────────────────────────────────
        # 13. SEED DASHBOARD METRICS
        # ─────────────────────────────────────────────────────────────────────
        metrics_doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": school_id,
            **get_demo_dashboard_metrics(),
            "is_demo": True,
            "created_at": now.isoformat(),
        }
        await db.metrics.insert_one(metrics_doc)
        summary["seeded"].append(f"métricas del dashboard")
        
        # ─────────────────────────────────────────────────────────────────────
        # 14. SEED ENROLLMENT DATA
        # ─────────────────────────────────────────────────────────────────────
        enrollment_docs = []
        for enrollment_data in get_demo_enrollment_data():
            enrollment_docs.append({
                "id": str(uuid.uuid4()),
                "tenant_id": school_id,
                **enrollment_data,
                "is_demo": True,
            })
        await db.enrollment.insert_many(enrollment_docs)
        summary["seeded"].append(f"datos de inscripción")
        
        # ─────────────────────────────────────────────────────────────────────
        # 15. SEED COURSE POSTS (Materials, Announcements, Tasks)
        # ─────────────────────────────────────────────────────────────────────
        course_posts_count = 0
        materials_templates = {
            "Matemáticas": [
                {"title": "Guía de Fracciones y Decimales", "content": "Material de estudio sobre fracciones, conversión de decimales y operaciones básicas. Incluye ejercicios resueltos paso a paso."},
                {"title": "Geometría Básica - Figuras y Áreas", "content": "Resumen de figuras geométricas: triángulos, cuadriláteros, círculos. Fórmulas de perímetro y área con ejemplos resueltos."},
            ],
            "Comunicación": [
                {"title": "Comprensión Lectora - Técnicas", "content": "Estrategias para mejorar la comprensión lectora: subrayado, resumen, mapas mentales y técnica SQ3R."},
                {"title": "Redacción de Textos Narrativos", "content": "Guía para escribir cuentos y narraciones: estructura narrativa, elementos, uso del diálogo y la descripción."},
            ],
            "Ciencia y Tecnología": [
                {"title": "El Sistema Solar", "content": "Presentación sobre los planetas del sistema solar, sus características principales, órbitas y datos curiosos."},
                {"title": "Ciclo del Agua", "content": "Explicación detallada del ciclo hidrológico: evaporación, condensación, precipitación e infiltración."},
            ],
            "Personal Social": [
                {"title": "La Constitución Política del Perú", "content": "Resumen de los artículos más importantes. Derechos fundamentales, deberes ciudadanos y organización del Estado."},
            ],
            "Inglés": [
                {"title": "Basic Grammar - Present Tense", "content": "Introduction to present simple and present continuous. Rules, examples and practice exercises."},
            ],
        }
        for i, sid in enumerate(subject_ids):
            subject_data = get_demo_subjects()[i] if i < len(get_demo_subjects()) else None
            subject_name = subject_data["name"] if subject_data else f"Subject {i}"
            teacher_id = teacher_ids[i % len(teacher_ids)] if teacher_ids else owner_user_id
            
            materials = materials_templates.get(subject_name, [
                {"title": f"Material de {subject_name} - Unidad 1", "content": f"Material de estudio para la primera unidad del curso de {subject_name}."},
            ])
            
            for j, mat in enumerate(materials):
                post_id = str(uuid.uuid4())
                await db.course_posts.insert_one({
                    "id": post_id,
                    "subject_id": sid,
                    "school_id": school_id,
                    "author_id": teacher_id,
                    "post_type": "material",
                    "title": mat["title"],
                    "content": mat["content"],
                    "status": "active",
                    "likes": [],
                    "likes_count": 0,
                    "comments_count": 0,
                    "is_demo": True,
                    "created_at": (now - timedelta(days=10-j*2)).isoformat(),
                    "updated_at": (now - timedelta(days=10-j*2)).isoformat(),
                })
                course_posts_count += 1
            
            # Add one announcement per subject
            await db.course_posts.insert_one({
                "id": str(uuid.uuid4()),
                "subject_id": sid,
                "school_id": school_id,
                "author_id": teacher_id,
                "post_type": "announcement",
                "content": f"Bienvenidos al curso de {subject_name}. Este bimestre trabajaremos temas muy interesantes.",
                "status": "active",
                "likes": [],
                "likes_count": 0,
                "comments_count": 0,
                "is_demo": True,
                "created_at": (now - timedelta(days=1)).isoformat(),
                "updated_at": (now - timedelta(days=1)).isoformat(),
            })
            course_posts_count += 1
        
        summary["seeded"].append(f"{course_posts_count} publicaciones de cursos")
        
        # ─────────────────────────────────────────────────────────────────────
        # 16. UPDATE SCHOOL WITH DEMO FLAG
        # ─────────────────────────────────────────────────────────────────────
        await db.schools.update_one(
            {"id": school_id},
            {"$set": {
                "has_demo_data": True,
                "demo_seeded_at": now.isoformat(),
            }}
        )
        
        logger.info(f"Demo data seeded for school {school_id}: {summary['seeded']}")
        return {"success": True, "summary": summary}
        
    except Exception as e:
        logger.error(f"Error seeding demo data for school {school_id}: {str(e)}")
        summary["errors"].append(str(e))
        return {"success": False, "summary": summary, "error": str(e)}


async def delete_demo_data_for_school(db, school_id: str):
    """
    Delete all demo data for a school.
    Only deletes records where is_demo=True.
    
    Args:
        db: MongoDB database instance
        school_id: The ID of the school to clean
    
    Returns:
        dict: Summary of deleted data
    """
    summary = {"deleted": []}
    
    # Collections that may have demo data
    collections = [
        "academic_levels",
        "grades", 
        "sections",
        "shifts",
        "academic_periods",
        "users",
        "subjects",
        "subject_teachers",
        "news",
        "calendar_events",
        "payment_concepts",
        "payments",
        "metrics",
        "enrollment",
    ]
    
    for collection_name in collections:
        result = await db[collection_name].delete_many({
            "school_id": school_id,
            "is_demo": True
        })
        if result.deleted_count > 0:
            summary["deleted"].append(f"{result.deleted_count} {collection_name}")
    
    # Also check tenant_id based collections
    for collection_name in ["metrics", "enrollment"]:
        result = await db[collection_name].delete_many({
            "tenant_id": school_id,
            "is_demo": True
        })
        if result.deleted_count > 0:
            summary["deleted"].append(f"{result.deleted_count} {collection_name} (tenant)")
    
    # Update school to remove demo flag
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {"has_demo_data": False}, "$unset": {"demo_seeded_at": ""}}
    )
    
    logger.info(f"Demo data deleted for school {school_id}: {summary['deleted']}")
    return summary
