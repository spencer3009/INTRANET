# Core dependencies and utilities shared across all routes
# This module provides authentication, authorization, and database access

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
from pathlib import Path
from dotenv import load_dotenv

# ══════════════════════════════════════════════════════════════════════════════
# ENVIRONMENT & DATABASE
# ══════════════════════════════════════════════════════════════════════════════

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'edunet-saas-secret-key-2026-dev-only')
JWT_ALGORITHM = "HS256"
BASE_DOMAIN = os.environ.get('BASE_DOMAIN', 'edunet.pe')

security = HTTPBearer(auto_error=False)

# ══════════════════════════════════════════════════════════════════════════════
# CACHE CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

STUDENT_TASKS_CACHE = TTLCache(maxsize=5000, ttl=60)
STUDENT_DASHBOARD_CACHE = TTLCache(maxsize=5000, ttl=60)

def invalidate_student_cache(student_id: str):
    """Invalidate all caches for a specific student"""
    STUDENT_TASKS_CACHE.pop(student_id, None)
    STUDENT_DASHBOARD_CACHE.pop(student_id, None)

def invalidate_course_caches(course_id: str, school_id: str):
    """Invalidate caches for all students in a course"""
    STUDENT_TASKS_CACHE.clear()
    STUDENT_DASHBOARD_CACHE.clear()

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
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
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

def is_admin_user(user: dict) -> bool:
    """Check if user has admin privileges."""
    if user.get("is_owner") or user.get("is_super_admin"):
        return True
    return user.get("role") in ["owner", "admin", "director"]

# ══════════════════════════════════════════════════════════════════════════════
# ROLE-BASED ACCESS CONTROL (RBAC)
# ══════════════════════════════════════════════════════════════════════════════

ROLE_HIERARCHY = {
    "owner": 100,
    "admin": 90,
    "director": 80,
    "coordinator": 70,
    "teacher": 50,
    "auxiliar": 40,
    "parent": 20,
    "student": 10
}

ADMIN_ROLES = ["owner", "admin", "director", "coordinator"]
STAFF_ROLES = ["owner", "admin", "director", "coordinator", "teacher", "auxiliar"]

def has_role(user: dict, allowed_roles: list) -> bool:
    """Check if user has one of the allowed roles"""
    return user.get("role") in allowed_roles

def is_student(user: dict) -> bool:
    return user.get("role") == "student"

def is_parent(user: dict) -> bool:
    return user.get("role") == "parent"

def is_staff(user: dict) -> bool:
    return user.get("role") in STAFF_ROLES

def require_role(allowed_roles: list):
    """Dependency that checks if user has one of the allowed roles."""
    async def check_role(current_user = Depends(get_current_user)):
        user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=403, detail="Usuario no encontrado")
        if user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="No tienes permisos para acceder a esta función")
        return user
    return check_role

def require_admin():
    """Dependency that requires admin-level access"""
    return require_role(ADMIN_ROLES)

def require_staff():
    """Dependency that requires staff access"""
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
    """Check if user can access a specific section based on RBAC rules."""
    if not user or not section:
        return False
    
    role = user.get("role")
    section_config = SECTION_PERMISSIONS.get(section)
    
    if not section_config:
        return False
    
    allowed_roles = section_config.get("allowed_roles", [])
    feature_flag = section_config.get("feature_flag")
    
    if role == "owner":
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
    """Get all permissions for a user in a structured format."""
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
        
        if role == "owner":
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
        "is_owner": role == "owner",
        "is_admin": role == "admin",
        "sections": sections
    }

def require_section_access(section: str):
    """Dependency that checks if user can access a specific section."""
    async def check_access(current_user = Depends(get_current_user)):
        user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=403, detail="Usuario no encontrado")
        
        has_access = await can_access_section(user, section, user.get("school_id"))
        if not has_access:
            raise HTTPException(
                status_code=403, 
                detail=f"No tienes permisos para acceder a esta sección. Contacta al propietario del colegio."
            )
        return user
    return check_access

# ══════════════════════════════════════════════════════════════════════════════
# MULTI-TENANT HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def extract_subdomain(host: str) -> Optional[str]:
    """Extract subdomain from host header"""
    if not host:
        return None
    
    host = host.lower().split(':')[0]
    
    if host in ['localhost', '127.0.0.1', 'preview.emergentagent.com']:
        return None
    
    if '.preview.emergentagent.com' in host:
        return None
    
    parts = host.split('.')
    
    if len(parts) >= 3:
        potential_subdomain = parts[0]
        if potential_subdomain not in ['www', 'app', 'api']:
            return potential_subdomain
    
    return None

async def get_school_by_subdomain(subdomain: str):
    """Get school by subdomain"""
    if not subdomain:
        return None
    return await db.schools.find_one(
        {"subdomain": subdomain, "is_active": {"$ne": False}},
        {"_id": 0}
    )

async def get_tenant_from_request(request: Request):
    """Get tenant (school) from request based on subdomain"""
    subdomain = extract_subdomain(request.headers.get("host", ""))
    
    if subdomain:
        school = await get_school_by_subdomain(subdomain)
        if school:
            return school
    
    return None

async def require_school(current_user=Depends(get_current_user)):
    """Dependency that requires user to belong to a school"""
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No perteneces a ningún colegio")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    return current_user

# ══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def generate_id() -> str:
    """Generate a unique ID"""
    return str(uuid.uuid4())

def now() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)

def now_iso() -> str:
    """Get current UTC datetime as ISO string"""
    return datetime.now(timezone.utc).isoformat()
