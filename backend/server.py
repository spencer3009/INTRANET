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
    DEMO_USER_BLOCKED_MESSAGE
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
from routes.surveys import router as surveys_router
from routes.discipline import router as discipline_router
from routes.news import router as news_router
from routes.accounting import router as accounting_router
from routes.subjects import router as subjects_router
from routes.courses import router as courses_router
from routes.messaging import router as messaging_router
from routes.broadcast import router as broadcast_router
from routes.exams import router as exams_router
from routes.parent_portal import router as parent_portal_router
from routes.live_classes import router as live_classes_router
from routes.grades import router as grades_router

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
        "https://mensaje-unificado.preview.emergentagent.com",
    ],
    allow_origin_regex=r"https://.*\.edunet\.pe|https://.*\.preview\.emergentagent\.com",
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
# INCLUDE ALL ROUTERS
# ══════════════════════════════════════════════════════════════════════════════

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
app.include_router(surveys_router)
app.include_router(discipline_router)
app.include_router(news_router)
app.include_router(accounting_router)
app.include_router(subjects_router)
app.include_router(courses_router)
app.include_router(messaging_router)
app.include_router(broadcast_router)
app.include_router(exams_router)
app.include_router(parent_portal_router)
app.include_router(live_classes_router)
app.include_router(grades_router)
app.include_router(support_router)

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
    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception:
        ws_manager.disconnect(websocket, user_id)

# ══════════════════════════════════════════════════════════════════════════════
# STARTUP & SHUTDOWN
# ══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def create_indexes():
    try:
        await db.course_posts.create_index([("school_id", 1), ("subject_id", 1), ("type", 1)])
        await db.course_posts.create_index([("school_id", 1), ("subject_id", 1), ("post_type", 1)])
        await db.task_submissions.create_index([("school_id", 1), ("student_id", 1), ("task_id", 1)])
        await db.academic_assignments.create_index([("school_id", 1), ("section_id", 1), ("status", 1)])
        await db.attendances.create_index([("school_id", 1), ("user_id", 1), ("date", 1)])
        await db.student_attendance.create_index([("school_id", 1), ("student_id", 1), ("date", 1)])
        await db.academic_threads.create_index([("school_id", 1), ("participant_ids", 1)])
        await db.internal_messages.create_index([("school_id", 1), ("recipient_id", 1), ("is_deleted", 1)])
        await db.user_school_roles.create_index(
            [("user_id", 1), ("school_id", 1)],
            unique=True
        )
        await ensure_global_support_user()
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
        teachers_without_qr = await db.users.find({
            "role": "teacher",
            "qr_token": {"$exists": False}
        }).to_list(None)
        for teacher in teachers_without_qr:
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
        if teachers_without_qr:
            logging.info(f"Generated QR tokens for {len(teachers_without_qr)} teachers")
        logging.info("MongoDB indexes created successfully")
    except Exception as e:
        logging.error(f"Error creating indexes: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
