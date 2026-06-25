# Core dependencies and utilities shared across all routes
# This module provides authentication, authorization, database access,
# and all shared helpers used by domain-specific routers.

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from cachetools import TTLCache
import os
import jwt
import bcrypt
import uuid
import logging
from pathlib import Path
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import base64
import hashlib

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# ENVIRONMENT & DATABASE
# ══════════════════════════════════════════════════════════════════════════════

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']

# ──────────────────────────────────────────────────────────────────────────────
# DB name detection — SYNCHRONOUS on every startup (no cache).
#
# A previous iteration persisted the resolved db_name to a file cache, but
# that caused production outages when the cache stored a stale/incorrect
# name ("database") and the backend could never reconnect after a redeploy.
# Detecting on every boot is slower (~1-2s on a cold connection) but SAFE —
# preferred over an unreliable cache.
# ──────────────────────────────────────────────────────────────────────────────
import pymongo as _pymongo

_raw_db_name = os.environ.get('DB_NAME', 'database')
db_name = _raw_db_name

try:
    _sync_client = _pymongo.MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    # Test if configured DB works
    _test_ok = False
    try:
        _sync_client[db_name].command("ping")
        _sync_client[db_name].users.count_documents({})
        _test_ok = True
    except Exception:
        pass

    if not _test_ok:
        # List available databases and find the correct one.
        # Prefer DB matching the original DB_NAME suffix (e.g., "test_database")
        try:
            _available = _sync_client.list_database_names()
            _candidates = [d for d in _available if d not in ('admin', 'local', 'config')]

            # Extract original suffix from DB_NAME
            _original_suffix = _raw_db_name
            for _prefix in ['school-portal-152-', 'school-portal-152_']:
                if _raw_db_name.startswith(_prefix):
                    _original_suffix = _raw_db_name[len(_prefix):]
                    break

            # Priority 1: DB whose name ends with the original suffix
            _picked = None
            for _candidate in _candidates:
                if _candidate.endswith(_original_suffix):
                    try:
                        _cols = _sync_client[_candidate].list_collection_names()
                        if 'users' in _cols:
                            _picked = _candidate
                            break
                    except Exception:
                        continue
            if not _picked:
                # Priority 2: DB with most users
                _best_db = None
                _best_count = 0
                for _candidate in _candidates:
                    try:
                        _cols = _sync_client[_candidate].list_collection_names()
                        if 'users' in _cols:
                            _count = _sync_client[_candidate].users.count_documents({})
                            if _count > _best_count:
                                _best_count = _count
                                _best_db = _candidate
                    except Exception:
                        continue
                if _best_db:
                    _picked = _best_db
            if _picked:
                db_name = _picked
        except Exception:
            pass

    _sync_client.close()
except Exception:
    pass

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


async def safe_create_index(collection, keys, **kwargs):
    """
    Create a MongoDB index, swallowing any exception (e.g. Unauthorized,
    IndexOptionsConflict) so it NEVER crashes startup.
    Missing indexes only mean slightly slower queries.
    """
    try:
        return await collection.create_index(keys, **kwargs)
    except Exception as e:
        coll_name = getattr(collection, "name", "<unknown>")
        logger.warning(f"Index creation skipped on '{coll_name}' ({keys}): {type(e).__name__}: {e}")
        return None

JWT_SECRET = os.environ.get('JWT_SECRET', 'edunet-saas-secret-key-2026-dev-only')
JWT_ALGORITHM = "HS256"
BASE_DOMAIN = os.environ.get('BASE_DOMAIN', 'edunet.pe')

security = HTTPBearer(auto_error=False)

# ══════════════════════════════════════════════════════════════════════════════
# PERU TIMEZONE
# ══════════════════════════════════════════════════════════════════════════════

PERU_TZ = timezone(timedelta(hours=-5))

def to_peru_hhmm(iso_or_time_str):
    """Convert any stored time value (ISO UTC string or HH:MM) to Peru HH:MM string."""
    if not iso_or_time_str:
        return None
    try:
        dt = datetime.fromisoformat(str(iso_or_time_str))
        return dt.astimezone(PERU_TZ).strftime("%H:%M")
    except (ValueError, TypeError):
        return str(iso_or_time_str)

# ══════════════════════════════════════════════════════════════════════════════
# CACHE CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

STUDENT_TASKS_CACHE = TTLCache(maxsize=5000, ttl=60)
STUDENT_DASHBOARD_CACHE = TTLCache(maxsize=5000, ttl=60)

def invalidate_student_cache(student_id: str):
    STUDENT_TASKS_CACHE.pop(student_id, None)
    STUDENT_DASHBOARD_CACHE.pop(student_id, None)

def invalidate_course_caches(course_id: str, school_id: str):
    STUDENT_TASKS_CACHE.clear()
    STUDENT_DASHBOARD_CACHE.clear()

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC STUDENT FILTERS
# ══════════════════════════════════════════════════════════════════════════════

ACADEMIC_STUDENT_FILTER = {"student_status": {"$in": ["enrolled", "active"]}, "is_disabled": {"$ne": True}}
ACADEMIC_STUDENT_FILTER_WITH_PENDING = {"student_status": {"$in": ["enrolled", "active", "pending"]}, "is_disabled": {"$ne": True}}

# Filtro de visibilidad de alumnos: excluye a los desactivados (retirados).
# Se aplica a TODOS los listados operativos (registros auxiliares, consolidados,
# libretas, asistencia, PAE, movilidad, coordinación, etc.). NO se aplica en
# Usuarios>Estudiantes ni en Ajustes (allí se ven/gestionan los desactivados).
STUDENT_VISIBLE_FILTER = {"is_disabled": {"$ne": True}}

async def get_academic_filter(school_id: str) -> dict:
    if school_id:
        school = await db.schools.find_one({"id": school_id}, {"_id": 0, "permitir_acceso_estudiantes_pendientes": 1})
        if school and school.get("permitir_acceso_estudiantes_pendientes", False):
            return ACADEMIC_STUDENT_FILTER_WITH_PENDING
    return ACADEMIC_STUDENT_FILTER

# ══════════════════════════════════════════════════════════════════════════════
# STUDENT ACCESS GUARD (P1)
# Bloquea a alumnos pending/rejected/withdrawn/deleted en endpoints de servicios
# (asistencia, notas, tareas, dashboard, etc.). El colegio puede permitir
# a los estudiantes "pending" si activa el flag `permitir_acceso_estudiantes_pendientes`.
# ══════════════════════════════════════════════════════════════════════════════

_BLOCKED_STUDENT_STATUS = {"withdrawn", "deleted", "rejected"}
_BLOCKED_ENROLLMENT_STATUS = {"rejected"}

async def enforce_student_active(user: dict, school: dict | None = None) -> None:
    """Bloquea acceso a servicios si el estudiante no está activo.

    - `student_status` in {withdrawn, deleted, rejected}  -> 403
    - `enrollment_status` == "rejected"                    -> 403
    - `student_status` == "pending" o `enrollment_status` == "pending":
          -> 403 salvo que el colegio active `permitir_acceso_estudiantes_pendientes`.

    No-op para roles distintos a "student".
    """
    if not user or user.get("role") != "student":
        return

    sstatus = (user.get("student_status") or "active").lower()
    estatus = (user.get("enrollment_status") or "active").lower()

    if sstatus in _BLOCKED_STUDENT_STATUS:
        raise HTTPException(
            status_code=403,
            detail="Tu cuenta de estudiante está inactiva. Comunícate con la administración del colegio."
        )
    if estatus in _BLOCKED_ENROLLMENT_STATUS:
        raise HTTPException(
            status_code=403,
            detail="Tu matrícula fue rechazada. Comunícate con la administración del colegio."
        )
    if sstatus == "pending" or estatus == "pending":
        school_id = user.get("school_id")
        if school is None and school_id:
            school = await db.schools.find_one(
                {"id": school_id},
                {"_id": 0, "permitir_acceso_estudiantes_pendientes": 1}
            )
        allow_pending = bool(school.get("permitir_acceso_estudiantes_pendientes", False)) if school else False
        if not allow_pending:
            raise HTTPException(
                status_code=403,
                detail="Tu matrícula está pendiente de aprobación. Comunícate con la administración del colegio."
            )

# ══════════════════════════════════════════════════════════════════════════════
# CLOUDINARY CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

import cloudinary
import cloudinary.utils
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

# ══════════════════════════════════════════════════════════════════════════════
# GOOGLE DRIVE CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
BASE_URL = os.environ.get("BASE_URL", "https://edunet.pe")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "https://edunet.pe/api/integrations/google-drive/callback")

def get_encryption_key():
    key_bytes = hashlib.sha256(JWT_SECRET.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)

FERNET_KEY = get_encryption_key()
fernet = Fernet(FERNET_KEY)

def encrypt_token(token: str) -> str:
    return fernet.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    return fernet.decrypt(encrypted_token.encode()).decode()

GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]

GOOGLE_DRIVE_ALLOWED_EXTENSIONS = [
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "txt"
]

MIME_TYPE_MAP = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "zip": "application/zip",
    "txt": "text/plain"
}

# ══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET CONNECTION MANAGER
# ══════════════════════════════════════════════════════════════════════════════

from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
        # Real-time session tracking (extended for Support Panel monitoring)
        self.active_sessions: dict[str, dict] = {}
        self._school_name_cache: dict[str, str] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str, user_meta: dict | None = None):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

        # Register/refresh session metadata for Support Panel
        if user_meta is not None:
            if user_id not in self.active_sessions:
                school_id = user_meta.get("school_id")
                school_name = ""
                if school_id:
                    school_name = self._school_name_cache.get(school_id, "")
                    if not school_name:
                        try:
                            school = await db.schools.find_one(
                                {"id": school_id}, {"_id": 0, "name": 1}
                            )
                            if school:
                                school_name = school.get("name", "") or ""
                                self._school_name_cache[school_id] = school_name
                        except Exception:
                            pass
                full_name = (user_meta.get("name", "") or "").strip()
                last_name = (user_meta.get("last_name", "") or "").strip()
                if last_name:
                    full_name = f"{full_name} {last_name}".strip()
                self.active_sessions[user_id] = {
                    "user_id": user_id,
                    "name": full_name or user_meta.get("email", ""),
                    "role": user_meta.get("role", ""),
                    "school_id": school_id,
                    "school_name": school_name,
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                    "connection_count": 0,
                    "current_page": None,
                    "page_requests": 0,
                    "last_activity": datetime.now(timezone.utc).isoformat(),
                }
            self.active_sessions[user_id]["connection_count"] = len(self.active_connections[user_id])

        # Warn on suspected duplicate connections (frontend should reuse the socket)
        n_open = len(self.active_connections.get(user_id, []))
        if n_open > 1:
            logger.warning(f"[WS] User {user_id} has {n_open} concurrent WebSocket connections — possible frontend duplicate")
    
    async def record_page_view(self, user_id: str, page: str, request_count: int = 0, metadata: dict | None = None):
        """
        Update the current page, simultaneous-request count, and
        last_activity timestamp for a connected user. Called on every
        `{type:"page_view", page, request_count, ...meta}` message from
        the client. Metadata may include a `subject_id` when the user is
        inside a course page — in that case we resolve subject/grade/
        section/level names from Mongo so the Support Panel can show
        exactly which class the user is viewing.
        """
        if user_id not in self.active_sessions:
            return
        session = self.active_sessions[user_id]
        session["current_page"] = (page or "")[:120]
        session["page_requests"] = int(request_count or 0)
        session["last_activity"] = datetime.now(timezone.utc).isoformat()

        # Resolve subject detail only when provided (course pages only).
        # We wipe it on any other page so stale data doesn't stick.
        subject_id = (metadata or {}).get("subject_id")
        if not subject_id:
            session.pop("subject_detail", None)
            return
        try:
            subject = await db.subjects.find_one(
                {"id": subject_id},
                {"_id": 0, "name": 1, "grade_id": 1, "section_id": 1, "level_id": 1},
            )
            if not subject:
                session.pop("subject_detail", None)
                return
            grade = None
            if subject.get("grade_id"):
                grade = await db.grades.find_one(
                    {"id": subject["grade_id"]},
                    {"_id": 0, "nombre": 1, "nivel_id": 1},
                )
            section = None
            if subject.get("section_id"):
                section = await db.sections.find_one(
                    {"id": subject["section_id"]},
                    {"_id": 0, "nombre": 1},
                )
            # Level: prefer subject.level_id, fallback to grade.nivel_id.
            # Levels live in either `academic_levels` (primary) or `niveles`
            # depending on how the school was seeded — check both.
            level_id = subject.get("level_id") or (grade.get("nivel_id") if grade else None)
            level = None
            if level_id:
                level = await db.academic_levels.find_one(
                    {"id": level_id}, {"_id": 0, "nombre": 1}
                )
                if not level:
                    level = await db.niveles.find_one(
                        {"id": level_id}, {"_id": 0, "nombre": 1}
                    )
            session["subject_detail"] = {
                "subject_name": subject.get("name"),
                "grade": grade.get("nombre") if grade else None,
                "section": section.get("nombre") if section else None,
                "level": level.get("nombre") if level else None,
            }
        except Exception as e:
            logger.warning(f"[page_view] subject lookup failed for {subject_id}: {e}")
            session.pop("subject_detail", None)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id] = [
                ws for ws in self.active_connections[user_id] if ws != websocket
            ]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                self.active_sessions.pop(user_id, None)
            elif user_id in self.active_sessions:
                self.active_sessions[user_id]["connection_count"] = len(self.active_connections[user_id])
    
    async def send_to_user(self, user_id: str, data: dict):
        if user_id in self.active_connections:
            dead = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.active_connections[user_id].remove(ws)
            if not self.active_connections.get(user_id):
                self.active_connections.pop(user_id, None)
    
    async def broadcast_to_users(self, user_ids: list[str], data: dict):
        for uid in user_ids:
            await self.send_to_user(uid, data)
    
    def get_online_count(self) -> int:
        return len(self.active_connections)

ws_manager = ConnectionManager()

# ══════════════════════════════════════════════════════════════════════════════
# RESERVED SUBDOMAINS
# ══════════════════════════════════════════════════════════════════════════════

RESERVED_SUBDOMAINS = [
    "www", "admin", "api", "app", "mail", "support", "help", 
    "dashboard", "edunet", "test", "demo", "staging", "dev", 
    "ftp", "smtp", "imap", "pop", "cdn", "static", "assets",
    "billing", "payment", "account", "login", "register"
]

# ══════════════════════════════════════════════════════════════════════════════
# AUTH HELPERS
# ══════════════════════════════════════════════════════════════════════════════

async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="No autorizado")
    return credentials

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, name: str, role: str, school_id: str = None, subdomain: str = None, email_verified: bool = False, additional_roles: list = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "role": role,
        "school_id": school_id,
        "subdomain": subdomain,
        "email_verified": email_verified,
        "additional_roles": additional_roles or [],
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(require_auth)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def resolve_user_from_token(current_user: dict):
    if current_user.get("scope") == "support_switch":
        school_id = current_user.get("active_school_id") or current_user.get("school_id")
        return {
            "id": current_user["sub"],
            "email": current_user.get("email"),
            "name": current_user.get("name"),
            "last_name": "",
            "role": "owner",
            "school_id": school_id,
            "is_owner": True,
            "is_protected": True,
            "is_support_session": True,
            "original_role": current_user.get("original_role", "system_admin_global"),
            "email_verified": True
        }
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    return user

def is_admin_user(user: dict) -> bool:
    if user.get("is_owner") or user.get("is_super_admin"):
        return True
    return user.get("role") in ["owner", "admin", "director"]

# ══════════════════════════════════════════════════════════════════════════════
# ROLE-BASED ACCESS CONTROL (RBAC)
# ══════════════════════════════════════════════════════════════════════════════

ROLE_HIERARCHY = {
    "owner": 100, "admin": 90, "director": 80, "coordinator": 70,
    "teacher": 50, "psicologo": 45, "auxiliar": 40,
    "auxiliar_asistencia": 38, "auxiliar_alimentacion": 35, "auxiliar_movilidad": 34,
    "auxiliar_topico": 33, "personal_mantenimiento": 30,
    "parent": 20, "student": 10
}

ADMIN_ROLES = ["owner", "admin", "director", "coordinator"]
STAFF_ROLES = ["owner", "admin", "director", "coordinator", "teacher", "psicologo", "auxiliar", "auxiliar_asistencia", "auxiliar_alimentacion", "auxiliar_movilidad", "auxiliar_topico", "personal_mantenimiento"]

def has_role(user: dict, allowed_roles: list) -> bool:
    if user.get("role") in allowed_roles:
        return True
    for ar in user.get("additional_roles", []):
        if ar in allowed_roles:
            return True
    return False

def is_student(user: dict) -> bool:
    return user.get("role") == "student"

def is_parent(user: dict) -> bool:
    return user.get("role") == "parent"

def is_staff(user: dict) -> bool:
    if user.get("role") in STAFF_ROLES:
        return True
    for ar in user.get("additional_roles", []):
        if ar in STAFF_ROLES:
            return True
    return False

def require_role(allowed_roles: list):
    async def check_role(current_user = Depends(get_current_user)):
        if current_user.get("scope") == "support_switch":
            if "owner" in allowed_roles:
                return await resolve_user_from_token(current_user)
            raise HTTPException(status_code=403, detail="No tienes permisos para acceder a esta funcion")
        user = await resolve_user_from_token(current_user)
        if not user:
            logger.error(f"DEMO_DEBUG require_role: user NOT FOUND sub={current_user.get('sub')}")
            raise HTTPException(status_code=403, detail="Usuario no encontrado")
        is_demo = user.get("is_demo_user", False)
        role = user.get("role")
        # Demo users with owner role get access to any owner-allowed endpoint
        if is_demo and role == "owner" and "owner" in allowed_roles:
            logger.info(f"DEMO_DEBUG require_role: GRANTED (demo owner bypass) roles={allowed_roles}")
            return user
        if role not in allowed_roles:
            # Check additional_roles
            additional = user.get("additional_roles", [])
            if not any(ar in allowed_roles for ar in additional):
                logger.error(f"DEMO_DEBUG require_role: DENIED role={role}, additional={additional}, is_demo={is_demo}, allowed={allowed_roles}")
                raise HTTPException(status_code=403, detail="No tienes permisos para acceder a esta funcion")
        # Guard global: bloquear alumnos pending/rejected/withdrawn en todos los servicios protegidos
        if role == "student":
            await enforce_student_active(user)
        return user
    return check_role

def require_admin():
    return require_role(ADMIN_ROLES)

def require_staff():
    return require_role(STAFF_ROLES)

# ══════════════════════════════════════════════════════════════════════════════
# SECTION PERMISSIONS
# ══════════════════════════════════════════════════════════════════════════════

SECTION_PERMISSIONS = {
    "settings": {"allowed_roles": ["owner"], "feature_flag": None},
    "accounting": {"allowed_roles": ["owner", "admin"], "feature_flag": "allow_admin_accounting"},
    "users": {"allowed_roles": ["owner", "admin", "director"], "feature_flag": None},
    "grades": {"allowed_roles": ["owner", "admin", "director", "coordinator"], "feature_flag": None},
    "settings": {"allowed_roles": ["owner", "admin", "director"], "feature_flag": None},
    "courses": {"allowed_roles": ["owner", "admin", "director", "coordinator", "teacher"], "feature_flag": None},
    "attendance": {"allowed_roles": ["owner", "admin", "director", "coordinator", "teacher", "auxiliar", "auxiliar_asistencia"], "feature_flag": None},
    "reports": {"allowed_roles": ["owner", "admin", "director", "coordinator"], "feature_flag": None},
    "schedule": {"allowed_roles": ["owner", "admin", "director", "coordinator"], "feature_flag": None},
    "exams": {"allowed_roles": ["owner", "admin", "director", "coordinator", "teacher"], "feature_flag": None},
    "internal_mail": {"allowed_roles": ["owner", "admin", "director", "coordinator", "teacher", "auxiliar", "auxiliar_asistencia", "psicologo", "student", "parent"], "feature_flag": None},
    "psychology": {"allowed_roles": ["owner", "admin", "director", "coordinator", "psicologo"], "feature_flag": None},
    "pae": {"allowed_roles": ["owner", "admin", "auxiliar_alimentacion"], "feature_flag": None},
    "movilidad": {"allowed_roles": ["owner", "admin", "auxiliar_movilidad"], "feature_flag": None},
    "coordinacion": {"allowed_roles": ["owner", "admin", "director", "coordinator", "psicologo"], "feature_flag": None},
}

async def can_access_section(user: dict, section: str, school_id: str = None) -> bool:
    if not user or not section:
        return False
    role = user.get("role")
    section_config = SECTION_PERMISSIONS.get(section)
    if not section_config:
        return False
    allowed_roles = section_config.get("allowed_roles", [])
    if role in allowed_roles:
        return True
    for ar in user.get("additional_roles", []):
        if ar in allowed_roles:
            return True
    feature_flag = section_config.get("feature_flag")
    if role == "owner" or user.get("is_owner"):
        return True
    if role not in allowed_roles:
        return False
    if feature_flag and role == "admin":
        if not school_id:
            school_id = user.get("school_id")
        if school_id:
            school = await db.schools.find_one({"id": school_id}, {"_id": 0, feature_flag: 1})
            if school and not school.get(feature_flag, False):
                return False
    return True

async def get_user_permissions(user: dict, school_id: str = None) -> dict:
    if not user:
        return {"role": None, "sections": {}}
    role = user.get("role")
    if not school_id:
        school_id = user.get("school_id")
    school = None
    if school_id:
        school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    sections = {}
    for section_name, config in SECTION_PERMISSIONS.items():
        allowed_roles = config.get("allowed_roles", [])
        feature_flag = config.get("feature_flag")
        if role == "owner" or user.get("is_owner"):
            sections[section_name] = True
            continue
        if role not in allowed_roles:
            sections[section_name] = False
            continue
        if feature_flag and role == "admin":
            if school:
                sections[section_name] = school.get(feature_flag, False)
            else:
                sections[section_name] = False
        else:
            sections[section_name] = True
    return {
        "role": role,
        "is_owner": role == "owner" or user.get("is_owner", False),
        "is_admin": role == "admin",
        "sections": sections
    }

def require_section_access(section: str):
    async def check_access(current_user = Depends(get_current_user)):
        if current_user.get("scope") == "support_switch":
            school_id = current_user.get("active_school_id") or current_user.get("school_id")
            logger.info(f"DEMO_DEBUG: support_switch access granted for section={section}, school_id={school_id}")
            return {
                "id": current_user["sub"],
                "email": current_user.get("email"),
                "name": current_user.get("name"),
                "role": "owner",
                "school_id": school_id,
                "is_owner": True,
                "is_support_session": True,
                "original_role": current_user.get("original_role", "system_admin_global")
            }
        user = await resolve_user_from_token(current_user)
        if not user:
            logger.error(f"DEMO_DEBUG: user NOT FOUND for sub={current_user.get('sub')}, section={section}")
            raise HTTPException(status_code=403, detail="Usuario no encontrado")
        role = user.get("role")
        is_demo = user.get("is_demo_user", False)
        is_owner_flag = user.get("is_owner", False)
        logger.info(f"DEMO_DEBUG: section={section}, role={role}, is_demo={is_demo}, is_owner={is_owner_flag}, email={user.get('email')}, school_id={user.get('school_id')}")
        # Demo users with owner role get immediate access
        if is_demo and role == "owner":
            logger.info(f"DEMO_DEBUG: GRANTED (demo owner bypass) section={section}")
            return user
        has_access = await can_access_section(user, section, user.get("school_id"))
        if not has_access:
            logger.error(f"DEMO_DEBUG: DENIED section={section}, role={role}, is_demo={is_demo}, is_owner={is_owner_flag}")
            raise HTTPException(
                status_code=403, 
                detail=f"No tienes permisos para acceder a esta seccion. Contacta al propietario del colegio."
            )
        logger.info(f"DEMO_DEBUG: GRANTED (normal) section={section}, role={role}")
        return user
    return check_access

# ══════════════════════════════════════════════════════════════════════════════
# DEMO USER SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

DEMO_USER_BLOCKED_MESSAGE = "Modo visitante: Esta accion esta deshabilitada en la demo. Al contratar el servicio tendra acceso completo."

def is_demo_user(user: dict) -> bool:
    return user.get("is_demo_user", False) == True

def check_demo_user_block(user: dict):
    if is_demo_user(user):
        raise HTTPException(status_code=403, detail=DEMO_USER_BLOCKED_MESSAGE)

def require_not_demo():
    async def check_not_demo(current_user = Depends(get_current_user)):
        user = await resolve_user_from_token(current_user)
        if not user:
            raise HTTPException(status_code=403, detail="Usuario no encontrado")
        check_demo_user_block(user)
        return user
    return check_not_demo

def is_real_owner(user: dict) -> bool:
    if is_demo_user(user):
        return False
    return user.get("is_owner") == True or user.get("role") == "owner"

# ══════════════════════════════════════════════════════════════════════════════
# SYSTEM USER PROTECTION
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_USER_BLOCKED_MESSAGE = "Este usuario pertenece al sistema y no puede modificarse."

def is_system_user(user: dict) -> bool:
    return user.get("is_system_user", False) == True

def check_system_user_block(user: dict):
    if is_system_user(user):
        raise HTTPException(status_code=403, detail=SYSTEM_USER_BLOCKED_MESSAGE)

def is_protected_user(user: dict) -> bool:
    return user.get("is_protected", False) == True or is_system_user(user)

async def create_system_support_user(school_id: str) -> dict:
    support_email = "spencer3009@gmail.com"
    support_username = f"soporte_{school_id[:8]}"
    support_password = "Socios3009"
    system_user = {
        "id": str(uuid.uuid4()),
        "username": support_username,
        "password": hash_password(support_password),
        "name": "Soporte EduNet",
        "last_name": "Sistema",
        "email": support_email,
        "role": "system_admin",
        "school_id": school_id,
        "is_system_user": True,
        "is_protected": True,
        "email_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(system_user)
    logger.info(f"System support user created for school {school_id}: {support_email}")
    result = {k: v for k, v in system_user.items() if k != "password"}
    result["_temp_password"] = support_password
    return result

# ══════════════════════════════════════════════════════════════════════════════
# MULTI-TENANT HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def extract_subdomain(host: str) -> Optional[str]:
    if not host:
        return None
    host = host.split(':')[0].lower().strip()
    if host == BASE_DOMAIN or host == f'www.{BASE_DOMAIN}':
        return None
    if host.endswith(f'.{BASE_DOMAIN}'):
        subdomain = host.replace(f'.{BASE_DOMAIN}', '')
        if '.' in subdomain:
            return None
        if subdomain in RESERVED_SUBDOMAINS:
            return None
        return subdomain
    parts = host.split('.')
    if len(parts) >= 4 and 'preview.emergentagent.com' in host:
        potential_subdomain = parts[0]
        if potential_subdomain != 'school-portal-152' and len(potential_subdomain) >= 3:
            return potential_subdomain
    return None

async def get_school_by_subdomain(subdomain: str):
    if not subdomain:
        return None
    return await db.schools.find_one(
        {"subdomain": subdomain, "status": {"$in": ["active", "demo"]}}, 
        {"_id": 0, "password": 0}
    )

async def get_tenant_from_request(request: Request):
    host = request.headers.get('host', '')
    subdomain = extract_subdomain(host)
    if not subdomain:
        return {"is_main_domain": True, "subdomain": None, "school": None}
    school = await get_school_by_subdomain(subdomain)
    return {"is_main_domain": False, "subdomain": subdomain, "school": school}

# ══════════════════════════════════════════════════════════════════════════════
# DEMO SEEDER IMPORT
# ══════════════════════════════════════════════════════════════════════════════

from demo_seeder import seed_demo_data_for_school, delete_demo_data_for_school

# ══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

async def require_school(current_user=Depends(get_current_user)):
    """Dependency that requires user to have a school_id."""
    if not current_user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Debes verificar tu email primero")
    if not current_user.get("school_id"):
        raise HTTPException(
            status_code=403, 
            detail="Debes crear tu subdominio primero",
            headers={"X-Redirect": "/onboarding"}
        )
    return current_user

def generate_id() -> str:
    return str(uuid.uuid4())

def now() -> datetime:
    return datetime.now(timezone.utc)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
