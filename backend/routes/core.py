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
client = AsyncIOMotorClient(mongo_url)

# Resolve database: prefer the default database from MONGO_URL connection string
# Motor's get_default_database() extracts the DB from the URL path
from urllib.parse import urlparse
_parsed_mongo = urlparse(mongo_url)
_db_from_url = _parsed_mongo.path.lstrip('/').split('?')[0] if _parsed_mongo.path and _parsed_mongo.path != '/' else None
_raw_db_name = _db_from_url or os.environ.get('DB_NAME', 'database')

# Use get_default_database if URL has a DB path, otherwise use DB_NAME
try:
    db = client.get_default_database()
    db_name = db.name
except Exception:
    # Fallback: try multiple names
    db_name = os.environ.get('DB_NAME', 'database')
    if db_name == 'test_database':
        db_name = 'database'
    db = client[db_name]

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

ACADEMIC_STUDENT_FILTER = {"student_status": {"$in": ["enrolled", "active"]}}
ACADEMIC_STUDENT_FILTER_WITH_PENDING = {"student_status": {"$in": ["enrolled", "active", "pending"]}}

async def get_academic_filter(school_id: str) -> dict:
    if school_id:
        school = await db.schools.find_one({"id": school_id}, {"_id": 0, "permitir_acceso_estudiantes_pendientes": 1})
        if school and school.get("permitir_acceso_estudiantes_pendientes", False):
            return ACADEMIC_STUDENT_FILTER_WITH_PENDING
    return ACADEMIC_STUDENT_FILTER

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
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id] = [
                ws for ws in self.active_connections[user_id] if ws != websocket
            ]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
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

def create_token(user_id: str, email: str, name: str, role: str, school_id: str = None, subdomain: str = None, email_verified: bool = False) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "role": role,
        "school_id": school_id,
        "subdomain": subdomain,
        "email_verified": email_verified,
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
    "teacher": 50, "auxiliar": 40, "parent": 20, "student": 10
}

ADMIN_ROLES = ["owner", "admin", "director", "coordinator"]
STAFF_ROLES = ["owner", "admin", "director", "coordinator", "teacher", "auxiliar"]

def has_role(user: dict, allowed_roles: list) -> bool:
    return user.get("role") in allowed_roles

def is_student(user: dict) -> bool:
    return user.get("role") == "student"

def is_parent(user: dict) -> bool:
    return user.get("role") == "parent"

def is_staff(user: dict) -> bool:
    return user.get("role") in STAFF_ROLES

def require_role(allowed_roles: list):
    async def check_role(current_user = Depends(get_current_user)):
        if current_user.get("scope") == "support_switch":
            if "owner" in allowed_roles:
                return await resolve_user_from_token(current_user)
            raise HTTPException(status_code=403, detail="No tienes permisos para acceder a esta funcion")
        user = await resolve_user_from_token(current_user)
        if not user:
            raise HTTPException(status_code=403, detail="Usuario no encontrado")
        if user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="No tienes permisos para acceder a esta funcion")
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
    "courses": {"allowed_roles": ["owner", "admin", "director", "coordinator", "teacher"], "feature_flag": None},
    "attendance": {"allowed_roles": ["owner", "admin", "director", "coordinator", "teacher", "auxiliar"], "feature_flag": None},
    "reports": {"allowed_roles": ["owner", "admin", "director", "coordinator"], "feature_flag": None},
    "schedule": {"allowed_roles": ["owner", "admin", "director", "coordinator"], "feature_flag": None},
    "exams": {"allowed_roles": ["owner", "admin", "director", "coordinator", "teacher"], "feature_flag": None},
    "internal_mail": {"allowed_roles": ["owner", "admin", "director", "coordinator", "teacher", "auxiliar", "student", "parent"], "feature_flag": None},
}

async def can_access_section(user: dict, section: str, school_id: str = None) -> bool:
    if not user or not section:
        return False
    role = user.get("role")
    section_config = SECTION_PERMISSIONS.get(section)
    if not section_config:
        return False
    allowed_roles = section_config.get("allowed_roles", [])
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
            raise HTTPException(status_code=403, detail="Usuario no encontrado")
        has_access = await can_access_section(user, section, user.get("school_id"))
        if not has_access:
            raise HTTPException(
                status_code=403, 
                detail=f"No tienes permisos para acceder a esta seccion. Contacta al propietario del colegio."
            )
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
        {"subdomain": subdomain, "status": "active"}, 
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
