"""
Authentication utilities and helpers
"""
import bcrypt
import jwt
from datetime import datetime, timezone
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import JWT_SECRET, JWT_ALGORITHM, ADMIN_ROLES, STAFF_ROLES

security = HTTPBearer(auto_error=False)

async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require authentication token"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="No autorizado")
    return credentials

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, name: str, role: str, school_id: str = None, subdomain: str = None, email_verified: bool = False) -> str:
    """Create a JWT token for a user"""
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
    """Get current user from JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def is_admin_user(user: dict) -> bool:
    """
    Check if user has admin privileges.
    Returns True if user is owner, super_admin, or has admin/director role.
    """
    if user.get("is_owner") or user.get("is_super_admin"):
        return True
    return user.get("role") in ["owner", "admin", "director"]

def has_role(user: dict, allowed_roles: list) -> bool:
    """Check if user has one of the allowed roles"""
    return user.get("role") in allowed_roles

def is_student(user: dict) -> bool:
    """Check if user is a student"""
    return user.get("role") == "student"

def is_parent(user: dict) -> bool:
    """Check if user is a parent"""
    return user.get("role") == "parent"

def is_staff(user: dict) -> bool:
    """Check if user is a staff member (not student or parent)"""
    return user.get("role") in STAFF_ROLES

def is_admin(user: dict) -> bool:
    """Check if user has admin role"""
    return user.get("role") in ADMIN_ROLES

def is_admin_only(user: dict) -> bool:
    """Check if user is owner, admin, or director (highest admin roles)"""
    return user.get("role") in ["owner", "admin", "director"]

def is_teacher(user: dict) -> bool:
    """Check if user is a teacher"""
    return user.get("role") == "teacher"

def can_access_school(user: dict, school_id: str) -> bool:
    """Check if user can access a specific school"""
    return user.get("school_id") == school_id

def require_admin(user: dict):
    """Raise exception if user is not admin"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Se requieren permisos de administrador")

def require_staff(user: dict):
    """Raise exception if user is not staff"""
    if not is_staff(user):
        raise HTTPException(status_code=403, detail="Se requieren permisos de personal")
