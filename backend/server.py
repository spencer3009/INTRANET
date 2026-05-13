"""
EduNet - Educational Intranet Platform
Main application entry point. All route handlers are in routes/ directory.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import jwt
from datetime import datetime, timezone, timedelta

# Core dependencies
from routes.core import (
    db, client, ws_manager, JWT_SECRET, JWT_ALGORITHM,
    DEMO_USER_BLOCKED_MESSAGE, safe_create_index
)

# Import ensure_global_support_user from support router
from routes.support import router as support_router, ensure_global_support_user

# Import all domain routers
from routes.auth import router as auth_router
from routes.dashboard import router as dashboard_router
from routes.student_portal import router as student_portal_router
from routes.teacher_portal import router as teacher_portal_router
from routes.admin_portal import router as admin_portal_router
from routes.system import router as system_router
from routes.settings import router as settings_router
from routes.users import router as users_router
from routes.academic import router as academic_router
from routes.schedule import router as schedule_router
from routes.messages_legacy import router as messages_legacy_router
from routes.attendance import router as attendance_router
from routes.calendar import router as calendar_router
from routes.birthdays import router as birthdays_router
from routes.surveys import router as surveys_router
from routes.discipline import router as discipline_router
from routes.news import router as news_router
from routes.accounting import router as accounting_router, daily_billing_generation_cron, monthly_concept_payments_cron, ensure_subscription_index
from routes.subjects import router as subjects_router
from routes.curricular_areas import router as curricular_areas_router, ensure_curricular_subject_indexes
from routes.libreta import router as libreta_router, ensure_libreta_indexes
from routes.conduct import router as conduct_router, ensure_conduct_indexes
from routes.tutor_comments import router as tutor_comments_router, ensure_tutor_comments_indexes
from routes.tutoring_admin import router as tutoring_admin_router
from routes.final_status import router as final_status_router, ensure_final_status_indexes
from routes.health import router as health_router
from routes.monitoring import router as monitoring_router
from routes.support_monitor import router as support_monitor_router
from routes.courses import router as courses_router
from routes.messaging import router as messaging_router
from routes.broadcast import router as broadcast_router
from routes.exams import router as exams_router
from routes.parent_portal import router as parent_portal_router
from routes.live_classes import router as live_classes_router
from routes.grades import router as grades_router
from routes.membership import router as membership_router
from routes.subscription import router as subscription_router, daily_subscription_cron
from routes.exams import close_expired_exams_cron, close_expired_tasks_cron
from routes.demo import router as demo_router, cleanup_expired_demo_accesses
from routes.academia import router as academia_router, seed_academia_categories
from routes.parents import router as parents_router
from routes.teachers_import import router as teachers_import_router
from routes.teacher_payments import router as teacher_payments_router
from routes.psychology import router as psychology_router
from routes.psychology_messages import router as psychology_messages_router
from routes.psychology_agenda import router as psychology_agenda_router
from routes.pae import router as pae_router, ensure_pae_indexes, seed_pae_default_turnos
from routes.movilidad import router as movilidad_router, ensure_movilidad_indexes, seed_movilidad_default_turnos
from routes.coordinacion import router as coordinacion_router, ensure_coordinacion_indexes
from routes.boletas import router as boletas_router
from routes.seed_accounting import router as seed_accounting_router
from routes.qr_templates import router as qr_templates_router
from routes.role_assignment import router as role_assignment_router
from routes.evaluation_criteria import router as evaluation_criteria_router
from routes.enrollment import router as enrollment_router
from routes.parent_payments import router as parent_payments_router
from routes.registro_auxiliar_plantillas import router as plantillas_ra_router, seed_system_template
try:
    from routes.notifications import router as notifications_router
except Exception as _notif_err:
    logging.basicConfig(level=logging.INFO)
    logging.warning(f"Notifications module failed to load: {_notif_err}. Push notifications disabled.")
    from fastapi import APIRouter
    notifications_router = APIRouter()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

# ══════════════════════════════════════════════════════════════════════════════
# CORS MIDDLEWARE
# ══════════════════════════════════════════════════════════════════════════════

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://edunet.pe",
        "http://localhost:3000",
        "http://localhost:8001",
        "https://tutor-asignaciones.preview.emergentagent.com",
    ],
    allow_origin_regex=r"https://.*\.edunet\.pe|https://.*\.preview\.emergentagent\.com|https://.*\.emergent\.host",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ══════════════════════════════════════════════════════════════════════════════
# DEMO USER MIDDLEWARE
# ══════════════════════════════════════════════════════════════════════════════

@app.middleware("http")
async def demo_user_middleware(request: Request, call_next):
    if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
        path = request.url.path
        if path.startswith("/api/"):
            safe_endpoints = [
                "/api/auth/login",
                "/api/auth/logout", 
                "/api/auth/verify-token",
                "/api/auth/refresh",
            ]
            if not any(path.startswith(safe) for safe in safe_endpoints):
                auth_header = request.headers.get("authorization", "")
                if auth_header.startswith("Bearer "):
                    token = auth_header[7:]
                    try:
                        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                        user_id = payload.get("sub")
                        if user_id:
                            user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_demo_user": 1})
                            if user and user.get("is_demo_user"):
                                return JSONResponse(
                                    status_code=403,
                                    content={"detail": DEMO_USER_BLOCKED_MESSAGE}
                                )
                    except:
                        pass
    response = await call_next(request)
    return response

# ══════════════════════════════════════════════════════════════════════════════
# SUBSCRIPTION RESTRICTION MIDDLEWARE
# ══════════════════════════════════════════════════════════════════════════════

# Routes that are blocked during RESTRICCION_PARCIAL (write operations only)
SUBSCRIPTION_SAFE_PATHS = [
    "/api/auth/", "/api/subscription/", "/api/membership/",
    "/api/support/", "/api/cloudinary/", "/api/dashboard/",
    "/api/notifications/", "/api/push/",
]

@app.middleware("http")
async def subscription_restriction_middleware(request: Request, call_next):
    if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
        path = request.url.path
        if path.startswith("/api/") and not any(path.startswith(safe) for safe in SUBSCRIPTION_SAFE_PATHS):
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
                try:
                    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                    role = payload.get("role", "")
                    school_id = payload.get("school_id")
                    if role in ("owner", "admin", "auxiliar_alimentacion") and school_id:
                        school = await db.schools.find_one(
                            {"id": school_id},
                            {"_id": 0, "id": 1, "fecha_vencimiento": 1, "expiration_date": 1}
                        )
                        if school:
                            from routes.subscription import calculate_plan_state
                            estado, _ = await calculate_plan_state(school)
                            if estado == "RESTRICCION_PARCIAL":
                                return JSONResponse(
                                    status_code=403,
                                    content={"detail": "Accion restringida: su suscripcion esta vencida. Registre su pago para continuar utilizando esta funcion."}
                                )
                            elif estado in ("PAGO_OBLIGATORIO", "SUSPENDIDO"):
                                return JSONResponse(
                                    status_code=403,
                                    content={"detail": "Acceso bloqueado: su suscripcion esta suspendida. Registre su pago para reactivar su cuenta."}
                                )
                except Exception:
                    pass
    response = await call_next(request)
    return response

# ══════════════════════════════════════════════════════════════════════════════
# INCLUDE ALL ROUTERS
# ══════════════════════════════════════════════════════════════════════════════

app.include_router(monitoring_router)   # /api/health and /api/health/db FIRST — readiness probe for Emergent
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(student_portal_router)
app.include_router(teacher_portal_router)
app.include_router(admin_portal_router)
app.include_router(system_router)
app.include_router(settings_router)
app.include_router(users_router)
app.include_router(academic_router)
app.include_router(schedule_router)
app.include_router(messages_legacy_router)
app.include_router(attendance_router)
app.include_router(calendar_router)
app.include_router(birthdays_router)
app.include_router(surveys_router)
app.include_router(discipline_router)
app.include_router(news_router)
app.include_router(accounting_router)
app.include_router(subjects_router)
app.include_router(curricular_areas_router)
app.include_router(libreta_router)
app.include_router(conduct_router)
app.include_router(tutor_comments_router)
app.include_router(tutoring_admin_router)
app.include_router(final_status_router)
app.include_router(health_router)
app.include_router(support_monitor_router)
app.include_router(courses_router)
app.include_router(messaging_router)
app.include_router(broadcast_router)
app.include_router(exams_router)
app.include_router(parent_portal_router)
app.include_router(live_classes_router)
app.include_router(grades_router)
app.include_router(membership_router)
app.include_router(subscription_router)
app.include_router(notifications_router)
app.include_router(demo_router)
app.include_router(support_router)
app.include_router(academia_router)
app.include_router(parents_router)
app.include_router(teachers_import_router)
app.include_router(teacher_payments_router)
app.include_router(psychology_router)
app.include_router(psychology_messages_router)
app.include_router(psychology_agenda_router)
app.include_router(pae_router)
app.include_router(movilidad_router)
app.include_router(coordinacion_router)
app.include_router(boletas_router)
app.include_router(seed_accounting_router)
app.include_router(qr_templates_router)
app.include_router(role_assignment_router)
app.include_router(evaluation_criteria_router)
app.include_router(enrollment_router)
app.include_router(parent_payments_router)
app.include_router(plantillas_ra_router)

# ══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET ENDPOINT
# ══════════════════════════════════════════════════════════════════════════════

@app.websocket("/api/ws/notifications")
async def websocket_notifications(websocket: WebSocket, token: str = Query(None)):
    if not token:
        await websocket.close(code=4001, reason="Token required")
        return
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    user_meta = {
        "name": payload.get("name", ""),
        "last_name": payload.get("last_name", ""),
        "email": payload.get("email", ""),
        "role": payload.get("role", ""),
        "school_id": payload.get("school_id"),
    }
    await ws_manager.connect(websocket, user_id, user_meta)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
                continue
            # Parse JSON control messages from the client (page_view, etc.)
            try:
                import json as _json
                msg = _json.loads(data)
            except Exception:
                continue
            if isinstance(msg, dict) and msg.get("type") == "page_view":
                await ws_manager.record_page_view(
                    user_id,
                    msg.get("page", ""),
                    msg.get("request_count", 0),
                    metadata=msg,
                )
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception:
        ws_manager.disconnect(websocket, user_id)

# ══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health_check():
    """Diagnostic endpoint - shows all available databases and their contents"""
    from routes.core import db_name as resolved_db_name, _raw_db_name, client as mongo_client
    
    checks = {"api": "ok", "db_name_configured": _raw_db_name, "db_name_used": db.name}
    
    try:
        user_count = await db.users.count_documents({})
        school_count = await db.schools.count_documents({})
        checks["database"] = "ok"
        checks["users_count"] = user_count
        checks["schools_count"] = school_count
    except Exception as e:
        checks["database"] = f"error: {str(e)[:150]}"
    
    # Show ALL available databases with details
    try:
        all_dbs = await mongo_client.list_database_names()
        db_details = []
        for d in all_dbs:
            if d in ('admin', 'local', 'config'):
                continue
            info = {"name": d}
            try:
                tmp = mongo_client[d]
                info["collections"] = await tmp.list_collection_names()
                if "users" in info["collections"]:
                    info["users"] = await tmp.users.count_documents({})
                if "schools" in info["collections"]:
                    info["schools"] = await tmp.schools.count_documents({})
                    # Show school names to identify the right DB
                    schools = await tmp.schools.find({}, {"_id": 0, "name": 1, "subdomain": 1}).to_list(10)
                    info["school_names"] = [s.get("name", "?") for s in schools]
            except Exception as e:
                info["error"] = str(e)[:100]
            db_details.append(info)
        checks["all_databases"] = db_details
    except Exception:
        pass
    
    return checks

# ══════════════════════════════════════════════════════════════════════════════
# STARTUP & SHUTDOWN
# ══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def announce_ready():
    """
    This handler MUST stay fast (<1s). Heavy initialization is scheduled
    as a background task below so uvicorn starts serving /api/health
    immediately and Emergent's readiness probe passes within 180s.
    """
    import asyncio
    logger.info("[STARTUP] FastAPI ready — /api/health available. Scheduling background init.")
    asyncio.create_task(_run_startup_tasks())


async def _run_startup_tasks():
    """
    Heavy startup work (indexes, seeds, migrations, Firebase, cron jobs).
    Runs in background so failures here don't block readiness.
    We also sleep briefly up-front so uvicorn has room to answer the
    Kubernetes readiness probe without memory contention.
    """
    import asyncio as _asyncio
    await _asyncio.sleep(3)
    try:
        await safe_create_index(db.course_posts, [("school_id", 1), ("subject_id", 1), ("type", 1)])
        await safe_create_index(db.course_posts, [("school_id", 1), ("subject_id", 1), ("post_type", 1)])
        await safe_create_index(db.task_submissions, [("school_id", 1), ("student_id", 1), ("task_id", 1)])
        await safe_create_index(db.academic_assignments, [("school_id", 1), ("section_id", 1), ("status", 1)])
        await safe_create_index(db.attendances, [("school_id", 1), ("user_id", 1), ("date", 1)])
        await safe_create_index(db.student_attendance, [("school_id", 1), ("student_id", 1), ("date", 1)])
        await safe_create_index(db.academic_threads, [("school_id", 1), ("participant_ids", 1)])
        await safe_create_index(db.internal_messages, [("school_id", 1), ("recipient_id", 1), ("is_deleted", 1)])
        await safe_create_index(db.parent_notifications, [("parent_id", 1), ("read_at", 1), ("created_at", -1)])
        await safe_create_index(db.parent_notifications, [("parent_id", 1), ("student_id", 1), ("type", 1), ("created_at", -1)])
        await safe_create_index(db.parent_notifications, [("created_at", 1)], expireAfterSeconds=2592000)
        # Device tokens index (unique per user+token)
        await safe_create_index(db.device_tokens, [("user_id", 1), ("fcm_token", 1)], unique=True)
        await safe_create_index(db.device_tokens, [("user_id", 1), ("active", 1)])
        # Psychology messaging indexes
        await safe_create_index(db.psychological_messages, [("conversation_id", 1), ("created_at", 1)])
        await safe_create_index(db.psychological_messages, [("to_user_id", 1), ("read", 1)])
        await safe_create_index(db.psychological_messages, [("institution_id", 1), ("student_id", 1)])
        await safe_create_index(db.psychological_messages, [("from_user_id", 1), ("created_at", -1)])
        # Psychology agenda indexes
        await safe_create_index(db.psychological_appointments, [("psychologist_id", 1), ("date", 1)])
        await safe_create_index(db.psychological_appointments, [("institution_id", 1), ("date", 1)])
        await safe_create_index(db.psychological_appointments, [("student_id", 1), ("date", 1)])
        await safe_create_index(db.psychological_workshops, [("psychologist_id", 1), ("date", -1)])
        await safe_create_index(db.psychological_workshops, [("institution_id", 1), ("status", 1)])
        await safe_create_index(db.user_school_roles, 
            [("user_id", 1), ("school_id", 1)],
            unique=True
        )
        await ensure_global_support_user()
        await seed_academia_categories()
        await seed_system_template()
        await ensure_pae_indexes()
        await ensure_movilidad_indexes()
        await ensure_coordinacion_indexes()
        await ensure_libreta_indexes()
        await ensure_conduct_indexes()
        await ensure_tutor_comments_indexes()
        await ensure_final_status_indexes()
        await ensure_curricular_subject_indexes()
        schools_without_exp = db.schools.find({"expiration_date": {"$exists": False}}, {"_id": 0, "id": 1, "created_at": 1})
        async for school in schools_without_exp:
            created = school.get("created_at")
            if created:
                try:
                    created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    exp_date = (created_dt + timedelta(days=30)).isoformat()
                except:
                    exp_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            else:
                exp_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            await db.schools.update_one({"id": school["id"]}, {"$set": {"expiration_date": exp_date}})
        # Stream teachers without QR token (avoid loading all into memory)
        teachers_cursor = db.users.find(
            {"role": "teacher", "qr_token": {"$exists": False}},
            {"_id": 0, "id": 1, "school_id": 1},
        )
        qr_generated = 0
        async for teacher in teachers_cursor:
            qr_payload = {
                "teacher_id": teacher["id"],
                "school_id": teacher.get("school_id", ""),
                "issued_at": datetime.now(timezone.utc).isoformat(),
                "type": "teacher_qr"
            }
            qr_token = jwt.encode(qr_payload, JWT_SECRET, algorithm="HS256")
            await db.users.update_one(
                {"id": teacher["id"]},
                {"$set": {"qr_token": qr_token}}
            )
            qr_generated += 1
        if qr_generated:
            logger.info(f"Generated QR tokens for {qr_generated} teachers")
        # Push notification indexes
        await safe_create_index(db.users, [("qr_id", 1)], sparse=True)
        await safe_create_index(db.push_tokens, [("user_id", 1)])
        await safe_create_index(db.push_tokens, [("token", 1)], unique=True)
        await safe_create_index(db.parent_notifications, [("parent_id", 1), ("created_at", -1)])
        await safe_create_index(db.parent_notifications, [("parent_id", 1), ("read_at", 1)])
        await safe_create_index(db.parent_notifications, [("parent_id", 1), ("student_id", 1), ("type", 1), ("created_at", -1)])
        # Performance indexes for course detail page
        await safe_create_index(db.post_likes, [("post_id", 1), ("user_id", 1)])
        await safe_create_index(db.post_comments, [("post_id", 1), ("status", 1)])
        await safe_create_index(db.course_activities, [("subject_id", 1), ("created_at", -1)])
        await safe_create_index(db.course_reminders, [("subject_id", 1), ("status", 1), ("date", 1)])
        await safe_create_index(db.presence, [("school_id", 1)])
        await safe_create_index(db.course_posts, [("subject_id", 1), ("status", 1), ("created_at", -1)])

        # Exam ↔ Register linkage: ONE column per subject+period (unique)
        await safe_create_index(db.online_exams, 
            [("school_id", 1), ("subject_id", 1), ("period_id", 1), ("register_column", 1)],
            unique=True,
            partialFilterExpression={"register_column": {"$in": ["EM", "EB", "P1", "P2", "P3"]}},
            name="uq_exam_register_column"
        )
        await safe_create_index(db.online_exams, [("sync_status", 1), ("subject_id", 1), ("period_id", 1)])
        await safe_create_index(db.online_exams, [("school_id", 1), ("subject_id", 1), ("period_id", 1)])

        # register_column_assignments: cross-collection uniqueness for exam+task linkage
        await safe_create_index(db.register_column_assignments, 
            [("school_id", 1), ("subject_id", 1), ("section_id", 1), ("period_id", 1), ("register_column", 1)],
            unique=True,
            name="uq_register_column_assignment"
        )
        await safe_create_index(db.register_column_assignments, 
            [("source_id", 1)],
            name="idx_rca_source_id"
        )
        # Task linkage indexes
        await safe_create_index(db.course_posts, [("school_id", 1), ("subject_id", 1), ("period_id", 1), ("register_column", 1)])
        await safe_create_index(db.course_posts, [("sync_status", 1), ("subject_id", 1), ("period_id", 1)])

        logging.info("MongoDB indexes created successfully")

        # ── PAE Migration: seed default turnos for all schools ──
        try:
            logger.info("[PAE Migration] Verificando turnos por defecto...")
            updated = 0
            already_ok = 0
            async for s in db.schools.find({}, {"_id": 0, "id": 1}):
                seeded = await seed_pae_default_turnos(s["id"])
                await seed_movilidad_default_turnos(s["id"])
                if seeded:
                    updated += 1
                else:
                    already_ok += 1
            if updated > 0:
                logger.info(f"[PAE Migration] {updated} colegios actualizados, {already_ok} colegios ya tenían turnos")
            else:
                logger.info("[PAE Migration] Todos los colegios ya tienen turnos configurados. Skip.")
        except Exception as pae_err:
            logger.error(f"[PAE Migration] Error durante migración de turnos: {pae_err}")

        # Initialize Firebase Admin SDK (deferred — non-critical for readiness)
        try:
            from utils.firebase_admin_sdk import get_firebase_app
            fb_app = get_firebase_app()
            if fb_app:
                logger.info(f"Firebase Admin SDK ready: {fb_app.project_id}")
            else:
                logger.warning("Firebase Admin SDK not initialized - push notifications disabled")
        except Exception as fb_err:
            logger.error(f"Firebase init failed (non-fatal): {fb_err}")

        # Delay cron jobs another 30s so we don't pile memory pressure on top
        # of the readiness window. These run forever — no rush to start.
        await _asyncio.sleep(30)
        _asyncio.create_task(daily_subscription_cron())
        logger.info("Daily subscription cron job started")
        _asyncio.create_task(close_expired_exams_cron())
        _asyncio.create_task(close_expired_tasks_cron())
        logger.info("Exam auto-close cron job started")
        _asyncio.create_task(cleanup_expired_demo_accesses())
        logger.info("Demo cleanup cron job started")
        _asyncio.create_task(daily_billing_generation_cron())
        logger.info("Daily billing generation cron job started")
        _asyncio.create_task(monthly_concept_payments_cron())
        logger.info("Monthly concept payments cron job started")
        await ensure_subscription_index()

        # Sync profile_photo_url -> photo_url for demo users (streaming, no .to_list)
        synced = 0
        async for du in db.users.find(
            {"is_demo_user": True, "profile_photo_url": {"$exists": True}},
            {"_id": 0, "id": 1, "profile_photo_url": 1, "photo_url": 1}
        ):
            if du.get("profile_photo_url") and du.get("photo_url") != du.get("profile_photo_url"):
                await db.users.update_one({"id": du["id"]}, {"$set": {"photo_url": du["profile_photo_url"]}})
                synced += 1
        if synced:
            logger.info(f"Synced photo_url for {synced} demo users")
        logger.info("[STARTUP] Background init complete — all services ready.")
    except Exception as e:
        logger.error(f"[STARTUP] Error in background init: {type(e).__name__}: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
