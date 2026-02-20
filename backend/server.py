from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, Body, Form, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse, StreamingResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
from enum import Enum
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import re
import time
import cloudinary
import cloudinary.utils
import cloudinary.uploader
import io

# Google Drive imports
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from cryptography.fernet import Fernet
import base64
import hashlib

# Import demo seeder
from demo_seeder import seed_demo_data_for_school, delete_demo_data_for_school

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'edunet-saas-secret-key-2026-dev-only')
JWT_ALGORITHM = "HS256"
BASE_DOMAIN = os.environ.get('BASE_DOMAIN', 'edunet.pe')

# Cloudinary configuration
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

# Generate encryption key from JWT_SECRET for token encryption
def get_encryption_key():
    """Generate a Fernet-compatible key from JWT_SECRET"""
    key_bytes = hashlib.sha256(JWT_SECRET.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)

FERNET_KEY = get_encryption_key()
fernet = Fernet(FERNET_KEY)

def encrypt_token(token: str) -> str:
    """Encrypt a token using Fernet"""
    return fernet.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a token using Fernet"""
    return fernet.decrypt(encrypted_token.encode()).decode()

# Google Drive OAuth scopes
GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]

# Allowed file extensions for Google Drive upload
GOOGLE_DRIVE_ALLOWED_EXTENSIONS = [
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "txt"
]

# MIME types mapping
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

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    """
    Check if user has admin privileges.
    Returns True if user is owner, super_admin, or has admin/director role.
    """
    if user.get("is_owner") or user.get("is_super_admin"):
        return True
    return user.get("role") in ["owner", "admin", "director"]

# ══════════════════════════════════════════════════════════════════════════════
# ROLE-BASED ACCESS CONTROL (RBAC)
# ══════════════════════════════════════════════════════════════════════════════

# Role hierarchy (higher = more permissions)
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

# Admin roles that can access administrative functions
ADMIN_ROLES = ["owner", "admin", "director", "coordinator"]

# Staff roles (non-students)
STAFF_ROLES = ["owner", "admin", "director", "coordinator", "teacher", "auxiliar"]

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

def require_role(allowed_roles: list):
    """
    Dependency that checks if user has one of the allowed roles.
    Usage: current_user = Depends(require_role(["admin", "director"]))
    """
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
    """Dependency that requires staff access (not students or parents)"""
    return require_role(STAFF_ROLES)

# ══════════════════════════════════════════════════════════════════════════════
# MULTI-TENANT HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def extract_subdomain(host: str) -> Optional[str]:
    """
    Extract subdomain from Host header.
    Returns None for main domain (edunet.pe, www.edunet.pe)
    Returns subdomain string for tenant domains (colegioroble.edunet.pe)
    """
    if not host:
        return None
    
    # Remove port if present
    host = host.split(':')[0].lower().strip()
    
    # Main domain - no tenant
    if host == BASE_DOMAIN or host == f'www.{BASE_DOMAIN}':
        return None
    
    # Subdomain detection
    if host.endswith(f'.{BASE_DOMAIN}'):
        subdomain = host.replace(f'.{BASE_DOMAIN}', '')
        # Validate: no dots (prevent nested subdomains)
        if '.' in subdomain:
            return None
        # Validate: not reserved
        if subdomain in RESERVED_SUBDOMAINS:
            return None
        return subdomain
    
    # For development/preview environments
    # Handle patterns like: colegioroble.school-portal-152.preview.emergentagent.com
    parts = host.split('.')
    if len(parts) >= 4 and 'preview.emergentagent.com' in host:
        potential_subdomain = parts[0]
        # Only if it's not the main app identifier
        if potential_subdomain != 'school-portal-152' and len(potential_subdomain) >= 3:
            return potential_subdomain
    
    return None

async def get_school_by_subdomain(subdomain: str):
    """Get school document by subdomain"""
    if not subdomain:
        return None
    return await db.schools.find_one(
        {"subdomain": subdomain, "status": "active"}, 
        {"_id": 0, "password": 0}
    )

async def get_tenant_from_request(request: Request):
    """
    Get tenant context from request.
    Returns: { is_main_domain, subdomain, school }
    """
    host = request.headers.get('host', '')
    subdomain = extract_subdomain(host)
    
    if not subdomain:
        return {
            "is_main_domain": True,
            "subdomain": None,
            "school": None
        }
    
    school = await get_school_by_subdomain(subdomain)
    return {
        "is_main_domain": False,
        "subdomain": subdomain,
        "school": school
    }

# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class UserRegister(BaseModel):
    school_name: str
    email: str
    password: str
    username: Optional[str] = None

class UserLogin(BaseModel):
    email: str  # Can be email OR username
    password: str

class VerifyEmailRequest(BaseModel):
    email: str
    code: str

class CheckSubdomainRequest(BaseModel):
    subdomain: str

class CreateSchoolRequest(BaseModel):
    subdomain: str

class CheckSubdomainResponse(BaseModel):
    available: bool
    subdomain: str = ""
    reason: str = ""

class MetricResponse(BaseModel):
    exams_projected: int
    tasks_delivered: int
    avg_students: int
    unread_messages: int

class EventResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    date: str
    time: str
    category: str
    color: str

class EnrollmentData(BaseModel):
    month: str
    students: int

class TenantSettings(BaseModel):
    """Settings for a tenant (school)"""
    logo_url: Optional[str] = None
    system_name: Optional[str] = None
    system_title: Optional[str] = None
    system_email: Optional[str] = None
    currency: Optional[Literal["PEN", "USD", "EUR"]] = "PEN"
    whatsapp: Optional[str] = None
    website_url: Optional[str] = None

class TenantSettingsUpdate(BaseModel):
    """Update settings for a tenant"""
    logo_url: Optional[str] = None
    system_name: Optional[str] = None
    system_title: Optional[str] = None
    system_email: Optional[str] = None
    currency: Optional[Literal["PEN", "USD", "EUR"]] = None
    whatsapp: Optional[str] = None
    website_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None

# ══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/auth/register")
async def register(data: UserRegister):
    """
    Step 1: Register user ONLY (school is NOT created yet)
    User starts with:
      - email_verified = false
      - school_id = null
    """
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Este correo ya está registrado")

    user_id = str(uuid.uuid4())
    verification_code = str(uuid.uuid4())[:6].upper()

    # Create user with school_id = null
    user_doc = {
        "id": user_id,
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "name": data.school_name,  # Store school name in user for now
        "role": "owner",
        "school_id": None,  # NO SCHOOL YET
        "email_verified": False,
        "verification_code": verification_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    logger.info(f"User registered: {data.email}, verification code: {verification_code}")

    return {
        "message": "Cuenta creada exitosamente",
        "user_id": user_id,
        "verification_code": verification_code,  # For demo/testing
        "email": data.email.lower()
    }

@api_router.post("/auth/verify-email")
async def verify_email(data: VerifyEmailRequest):
    """
    Step 2: Verify email
    After this:
      - email_verified = true
      - school_id still null (must complete onboarding)
    """
    user = await db.users.find_one({"email": data.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.get("email_verified"):
        # Already verified, just return token
        token = create_token(
            user["id"], user["email"], user["name"], user["role"],
            user.get("school_id"), None, True
        )
        return {
            "message": "Email ya verificado",
            "verified": True,
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "school_id": user.get("school_id"),
                "subdomain": None,
                "email_verified": True
            }
        }

    if user.get("verification_code") != data.code.upper():
        raise HTTPException(status_code=400, detail="Código de verificación incorrecto")

    # Mark email as verified
    await db.users.update_one(
        {"email": data.email.lower()},
        {"$set": {
            "email_verified": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    token = create_token(
        user["id"], user["email"], user["name"], user["role"],
        None, None, True  # school_id still null
    )

    logger.info(f"Email verified: {data.email}")

    return {
        "message": "Email verificado correctamente",
        "verified": True,
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "school_id": None,  # Still null!
            "subdomain": None,
            "email_verified": True
        }
    }

@api_router.post("/auth/login")
async def login(creds: UserLogin):
    """
    Login user and return:
      - If has school_id AND school has subdomain: include subdomain for redirect
      - If no school_id OR school has no subdomain: indicate onboarding needed
    Accepts email OR username for login.
    """
    identifier = creds.email.lower().strip()
    
    # Try to find user by email or username
    user = await db.users.find_one({
        "$or": [
            {"email": identifier},
            {"username": identifier}
        ]
    })
    
    if not user or not verify_password(creds.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Get school info if user has one
    subdomain = None
    school_id = user.get("school_id")
    
    if school_id:
        school = await db.schools.find_one({"id": school_id}, {"_id": 0})
        if school and school.get("subdomain"):
            # Only set subdomain if school has one (completed onboarding)
            subdomain = school.get("subdomain")
        else:
            # Legacy user with school but no subdomain - treat as not onboarded
            # Clear school_id from response so frontend knows to redirect to onboarding
            school_id = None

    token = create_token(
        user["id"], user["email"], user["name"], user["role"],
        school_id, subdomain, user.get("email_verified", False)
    )

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user.get("username"),
            "name": user["name"],
            "last_name": user.get("last_name", ""),
            "role": user["role"],
            "school_id": school_id,
            "subdomain": subdomain,
            "email_verified": user.get("email_verified", False),
            "is_owner": user.get("is_owner", False),
            "is_super_admin": user.get("is_super_admin", False),
            "is_protected": user.get("is_protected", False),
            "photo_url": user.get("photo_url"),
            "phone": user.get("phone")
        },
        # SHOPIFY RULE: If user has subdomain, tell frontend to redirect
        "redirect_to_subdomain": subdomain is not None,
        "redirect_url": f"https://{subdomain}.{BASE_DOMAIN}" if subdomain else None
    }

@api_router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    """Get current user with school info"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0, "verification_code": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Get school info - only if school has a subdomain (completed onboarding)
    subdomain = None
    school_id = user.get("school_id")
    
    if school_id:
        school = await db.schools.find_one({"id": school_id}, {"_id": 0})
        if school and school.get("subdomain"):
            subdomain = school.get("subdomain")
        else:
            # Legacy user - treat as not onboarded
            school_id = None
    
    return {
        **user,
        "school_id": school_id,
        "subdomain": subdomain
    }

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    
class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)

@api_router.put("/auth/profile")
async def update_profile(data: ProfileUpdate, current_user=Depends(get_current_user)):
    """Update current user's profile"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name.strip()
    if data.last_name is not None:
        update_data["last_name"] = data.last_name.strip()
    if data.username is not None:
        username = data.username.strip().lower()
        # Validate username format
        if username:
            if len(username) < 3:
                raise HTTPException(status_code=400, detail="El nombre de usuario debe tener al menos 3 caracteres")
            if len(username) > 30:
                raise HTTPException(status_code=400, detail="El nombre de usuario no puede tener más de 30 caracteres")
            if not re.match(r'^[a-z0-9_]+$', username):
                raise HTTPException(status_code=400, detail="El nombre de usuario solo puede contener letras, números y guiones bajos")
            # Check if username is already taken by another user
            existing = await db.users.find_one({
                "username": username,
                "id": {"$ne": user["id"]}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Este nombre de usuario ya está en uso")
            update_data["username"] = username
        else:
            update_data["username"] = None
    if data.phone is not None:
        update_data["phone"] = data.phone.strip()
    if data.photo_url is not None:
        # Delete old photo from Cloudinary if changing to new one
        if user.get("photo_url") and user["photo_url"] != data.photo_url:
            try:
                if "cloudinary.com" in user["photo_url"]:
                    parts = user["photo_url"].split("/upload/")
                    if len(parts) > 1:
                        path_with_ext = parts[1]
                        if path_with_ext.startswith("v"):
                            path_with_ext = "/".join(path_with_ext.split("/")[1:])
                        public_id = path_with_ext.rsplit(".", 1)[0]
                        cloudinary.uploader.destroy(public_id)
                        logger.info(f"Deleted old profile photo: {public_id}")
            except Exception as e:
                logger.error(f"Error deleting old photo: {e}")
        update_data["photo_url"] = data.photo_url
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0, "verification_code": 0})
    return {"message": "Perfil actualizado correctamente", "user": updated_user}

@api_router.put("/auth/password")
async def change_password(data: PasswordChange, current_user=Depends(get_current_user)):
    """Change current user's password"""
    user = await db.users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Verify current password
    if not bcrypt.checkpw(data.current_password.encode(), user["password"].encode()):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    
    # Hash new password
    new_hashed = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password": new_hashed,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Contraseña actualizada correctamente"}

@api_router.get("/auth/check-username/{username}")
async def check_username_availability(username: str, current_user=Depends(get_current_user)):
    """Check if a username is available"""
    username = username.strip().lower()
    
    if len(username) < 3:
        return {"available": False, "message": "Mínimo 3 caracteres"}
    if len(username) > 30:
        return {"available": False, "message": "Máximo 30 caracteres"}
    if not re.match(r'^[a-z0-9_]+$', username):
        return {"available": False, "message": "Solo letras, números y guiones bajos"}
    
    # Check if username is taken by another user
    existing = await db.users.find_one({
        "username": username,
        "id": {"$ne": current_user["sub"]}
    })
    
    if existing:
        return {"available": False, "message": "Este nombre de usuario ya está en uso"}
    
    return {"available": True, "message": "Nombre de usuario disponible"}

# ══════════════════════════════════════════════════════════════════════════════
# SUBDOMAIN ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/subdomain/check")
async def check_subdomain(subdomain: str) -> CheckSubdomainResponse:
    """
    Check if subdomain is available.
    Validates ONLY against database, NOT DNS.
    """
    subdomain = subdomain.lower().strip()
    
    # Validate format: ^[a-z0-9]{3,}$
    if not re.match(r'^[a-z0-9]+$', subdomain):
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="Solo letras minúsculas y números, sin espacios ni caracteres especiales"
        )
    
    # Minimum length: 3
    if len(subdomain) < 3:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="El subdominio debe tener al menos 3 caracteres"
        )
    
    # Maximum length: 30
    if len(subdomain) > 30:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="El subdominio debe tener máximo 30 caracteres"
        )

    # Check reserved subdomains
    if subdomain in RESERVED_SUBDOMAINS:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="Este subdominio está reservado"
        )

    # Check database for existing subdomain (case-insensitive)
    existing = await db.schools.find_one({"subdomain": subdomain})
    if existing:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="Este subdominio ya está en uso. Prueba otro nombre."
        )

    return CheckSubdomainResponse(
        available=True, 
        subdomain=subdomain,
        reason="¡Disponible!"
    )

# ══════════════════════════════════════════════════════════════════════════════
# SCHOOL (TENANT) CREATION
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/schools/create")
async def create_school(data: CreateSchoolRequest, current_user=Depends(get_current_user)):
    """
    Step 3: Create school (tenant) with subdomain.
    This is REQUIRED before accessing dashboard.
    
    Actions:
      1. Validate subdomain
      2. Create or update school record
      3. Update user.school_id
      4. Return redirect URL
    """
    # Check if user already has a school
    user = await db.users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    existing_school = None
    if user.get("school_id"):
        # User has a school_id, check if that school has a subdomain
        existing_school = await db.schools.find_one({"id": user["school_id"]}, {"_id": 0})
        if existing_school and existing_school.get("subdomain"):
            # School already has subdomain - user already completed onboarding
            return {
                "message": "Ya tienes un colegio creado",
                "subdomain": existing_school["subdomain"],
                "full_domain": existing_school["full_domain"],
                "redirect_url": f"https://{existing_school['subdomain']}.{BASE_DOMAIN}"
            }
        # If school exists but has no subdomain, we'll update it below
    
    # Check email verification
    if not user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Debes verificar tu email primero")

    subdomain = data.subdomain.lower().strip()
    
    # Validate format
    if not re.match(r'^[a-z0-9]{3,}$', subdomain):
        raise HTTPException(status_code=400, detail="Formato de subdominio inválido")

    # Check reserved
    if subdomain in RESERVED_SUBDOMAINS:
        raise HTTPException(status_code=400, detail="Este subdominio está reservado")

    # Check availability one more time
    existing = await db.schools.find_one({"subdomain": subdomain})
    if existing:
        raise HTTPException(status_code=400, detail="Este subdominio ya está en uso. Prueba otro nombre.")

    full_domain = f"{subdomain}.{BASE_DOMAIN}"

    if existing_school:
        # UPDATE existing school record (legacy user completing onboarding)
        school_id = existing_school["id"]
        await db.schools.update_one(
            {"id": school_id},
            {"$set": {
                "subdomain": subdomain,
                "full_domain": full_domain,
                "status": "active",
                "owner_user_id": user["id"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update owner user with super admin privileges
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "role": "director",
                "is_owner": True,
                "is_super_admin": True,
                "is_protected": True,  # Cannot be deleted or demoted
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"School updated with subdomain: {subdomain}.{BASE_DOMAIN} for user {user['email']} (Super Admin)")
        
        # Seed demo data for the school
        await seed_demo_data_for_school(db, school_id, user["id"])
    else:
        # CREATE new school record
        school_id = str(uuid.uuid4())
        school_doc = {
            "id": school_id,
            "school_name": user["name"],
            "subdomain": subdomain,
            "full_domain": full_domain,
            "status": "active",
            "owner_user_id": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.schools.insert_one(school_doc)
        
        # Update user with school_id and super admin privileges
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "school_id": school_id,
                "role": "director",
                "is_owner": True,
                "is_super_admin": True,
                "is_protected": True,  # Cannot be deleted or demoted
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"School created: {subdomain}.{BASE_DOMAIN} for user {user['email']} (Super Admin)")
        
        # Seed demo data for the new school
        await seed_demo_data_for_school(db, school_id, user["id"])

    # Create new token with school info
    new_token = create_token(
        user["id"], user["email"], user["name"], "director",
        school_id, subdomain, True
    )

    return {
        "message": "¡Tu intranet ha sido creada!",
        "school_id": school_id,
        "subdomain": subdomain,
        "full_domain": full_domain,
        "redirect_url": f"https://{full_domain}",
        "token": new_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": "director",
            "is_owner": True,
            "is_super_admin": True,
            "school_id": school_id,
            "subdomain": subdomain,
            "email_verified": True
        }
    }

# ══════════════════════════════════════════════════════════════════════════════
# TENANT INFO ROUTE
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/tenant/info")
async def get_tenant_info(request: Request):
    """
    Get current tenant info based on Host header.
    Used by frontend to determine routing behavior.
    """
    tenant = await get_tenant_from_request(request)
    
    if tenant["is_main_domain"]:
        return {
            "is_main_domain": True,
            "subdomain": None,
            "school": None,
            "message": "Dominio principal"
        }
    
    if not tenant["school"]:
        return {
            "is_main_domain": False,
            "subdomain": tenant["subdomain"],
            "school": None,
            "error": "Este colegio no existe o fue desactivado"
        }
    
    return {
        "is_main_domain": False,
        "subdomain": tenant["subdomain"],
        "school": {
            "id": tenant["school"]["id"],
            "school_name": tenant["school"]["school_name"],
            "subdomain": tenant["school"]["subdomain"],
            "full_domain": tenant["school"]["full_domain"],
            "status": tenant["school"]["status"]
        }
    }

# ══════════════════════════════════════════════════════════════════════════════
# FIX/REPAIR OWNER PERMISSIONS
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/auth/fix-owner-permissions")
async def fix_owner_permissions(current_user=Depends(get_current_user)):
    """
    Fix owner permissions for the current user.
    If the user is the owner of the school (owner_user_id matches), 
    this will grant them proper owner/super_admin flags.
    Also seeds demo data if the school is empty.
    """
    user = await db.users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if not user.get("school_id"):
        raise HTTPException(status_code=400, detail="No tienes un colegio asociado")
    
    # Get the school
    school = await db.schools.find_one({"id": user["school_id"]})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    # Check if user is the owner of this school
    is_school_owner = school.get("owner_user_id") == user["id"]
    
    # Also check if user was the first user in the school
    first_user = await db.users.find_one(
        {"school_id": user["school_id"]},
        sort=[("created_at", 1)]
    )
    is_first_user = first_user and first_user["id"] == user["id"]
    
    if is_school_owner or is_first_user:
        # Grant owner/super_admin permissions
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "role": "director",
                "is_owner": True,
                "is_super_admin": True,
                "is_protected": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update school owner_user_id if not set
        if not school.get("owner_user_id"):
            await db.schools.update_one(
                {"id": school["id"]},
                {"$set": {"owner_user_id": user["id"]}}
            )
        
        # Check if demo data needs to be seeded
        levels_count = await db.academic_levels.count_documents({"school_id": user["school_id"]})
        if levels_count == 0:
            # Seed demo data
            await seed_demo_data_for_school(db, user["school_id"], user["id"])
            seeded = True
        else:
            seeded = False
        
        # Generate new token with correct permissions
        new_token = create_token(
            user["id"], user["email"], user["name"], "director",
            user["school_id"], school.get("subdomain"), True
        )
        
        return {
            "success": True,
            "message": "Permisos de propietario restaurados correctamente",
            "token": new_token,
            "demo_data_seeded": seeded,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": "director",
                "is_owner": True,
                "is_super_admin": True,
                "school_id": user["school_id"],
                "subdomain": school.get("subdomain")
            }
        }
    else:
        raise HTTPException(
            status_code=403, 
            detail="No eres el propietario de esta intranet"
        )

# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC SCHOOL INFO (For branded login pages)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/schools/public/{subdomain}")
async def get_school_public_info(subdomain: str):
    """
    Get public info for a school by subdomain.
    Used to display branded login pages.
    Returns: school_name, logo_url, colors, etc.
    """
    subdomain = subdomain.lower().strip()
    
    school = await db.schools.find_one(
        {"subdomain": subdomain, "status": "active"},
        {"_id": 0, "password": 0, "owner_user_id": 0}
    )
    
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    return {
        "subdomain": school.get("subdomain"),
        "school_name": school.get("school_name"),
        "full_domain": school.get("full_domain"),
        "logo_url": school.get("logo_url"),  # Can be null
        "primary_color": school.get("primary_color", "#001f4b"),
        "secondary_color": school.get("secondary_color", "#e1b82c"),
    }

# ══════════════════════════════════════════════════════════════════════════════
# PROTECTED DASHBOARD ROUTES (REQUIRE SCHOOL_ID)
# ══════════════════════════════════════════════════════════════════════════════

async def require_school(current_user=Depends(get_current_user)):
    """
    Dependency that requires user to have a school_id.
    If school_id is null, user cannot access dashboard.
    """
    if not current_user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Debes verificar tu email primero")
    
    if not current_user.get("school_id"):
        raise HTTPException(
            status_code=403, 
            detail="Debes crear tu subdominio primero",
            headers={"X-Redirect": "/onboarding"}
        )
    
    return current_user

@api_router.get("/dashboard/metrics")
async def get_metrics(current_user=Depends(require_school)):
    """Get metrics for current tenant - REQUIRES SCHOOL"""
    school_id = current_user.get("school_id")
    
    # Calculate real counts from database
    students_count = await db.users.count_documents({"school_id": school_id, "role": "student"})
    teachers_count = await db.users.count_documents({"school_id": school_id, "role": "teacher"})
    subjects_count = await db.subjects.count_documents({"school_id": school_id})
    
    # Count unread messages for current user
    unread_messages = await db.messages.count_documents({
        "recipient_id": current_user.get("sub"),
        "read": False
    })
    
    # Try to get school-specific additional metrics
    metrics = await db.metrics.find_one({"tenant_id": school_id}, {"_id": 0})
    
    return {
        "students": students_count,
        "teachers": teachers_count,
        "subjects": subjects_count,
        "unread_messages": unread_messages,
        "exams_projected": metrics.get("exams_projected", 0) if metrics else 0,
        "tasks_delivered": metrics.get("tasks_delivered", 0) if metrics else 0,
        "avg_students": students_count,  # Use real count
    }

# ══════════════════════════════════════════════════════════════════════════════
# STUDENT PORTAL ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/student/profile")
async def get_student_profile(current_user = Depends(get_current_user)):
    """
    Get complete student profile with academic context.
    Returns all necessary info for student portal navigation.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    
    # Get academic context
    nivel = None
    grado = None
    seccion = None
    turno = None
    
    if user.get("nivel_id"):
        nivel = await db.academic_levels.find_one({"id": user["nivel_id"], "school_id": school_id}, {"_id": 0})
    
    if user.get("grado_id"):
        grado = await db.grades.find_one({"id": user["grado_id"], "school_id": school_id}, {"_id": 0})
    
    if user.get("seccion_id"):
        seccion = await db.sections.find_one({"id": user["seccion_id"], "school_id": school_id}, {"_id": 0})
    
    if user.get("turno_id"):
        turno = await db.shifts.find_one({"id": user["turno_id"], "school_id": school_id}, {"_id": 0})
    
    # Get enrolled courses (subjects assigned to student's section)
    courses = []
    if user.get("seccion_id"):
        # Get subjects assigned to this section via teacher assignments
        assignments = await db.teacher_assignments.find({
            "school_id": school_id,
            "seccion_id": user["seccion_id"]
        }, {"_id": 0}).to_list(100)
        
        subject_ids = list(set([a["subject_id"] for a in assignments]))
        if subject_ids:
            courses = await db.subjects.find({
                "id": {"$in": subject_ids},
                "school_id": school_id
            }, {"_id": 0}).to_list(100)
    
    # Get pending tasks count
    pending_tasks = 0
    if courses:
        subject_ids = [c["id"] for c in courses]
        pending_tasks = await db.course_posts.count_documents({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "type": "task",
            "due_date": {"$gte": datetime.now(timezone.utc).isoformat()}
        })
    
    # Get unread messages count from internal_mail
    unread_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user["id"],
                    "is_read": False,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    unread_result = await db.internal_mail.aggregate(unread_pipeline).to_list(1)
    unread_messages = unread_result[0]["count"] if unread_result else 0
    
    return {
        "user": {
            "id": user["id"],
            "name": user.get("name", ""),
            "last_name": user.get("last_name", ""),
            "email": user.get("email"),
            "photo_url": user.get("photo_url"),
            "role": user.get("role")
        },
        "academic": {
            "nivel": nivel,
            "grado": grado,
            "seccion": seccion,
            "turno": turno,
            "nivel_id": user.get("nivel_id"),
            "grado_id": user.get("grado_id"),
            "seccion_id": user.get("seccion_id"),
            "turno_id": user.get("turno_id")
        },
        "courses_count": len(courses),
        "pending_tasks": pending_tasks,
        "unread_messages": unread_messages,
        "school_id": school_id
    }

@api_router.get("/student/courses")
async def get_student_courses(current_user = Depends(get_current_user)):
    """
    Get courses/subjects assigned to student's section.
    Includes teacher info for each course.
    Uses academic_assignments collection.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    
    if not seccion_id:
        return {"courses": [], "message": "No tienes una sección asignada"}
    
    # Get section info with grade and level names
    section = await db.sections.find_one({"id": seccion_id, "school_id": school_id}, {"_id": 0})
    section_name = section.get("nombre", "-") if section else "-"
    
    grade = None
    grade_name = "-"
    level_name = "-"
    if section and section.get("grado_id"):
        grade = await db.grades.find_one({"id": section["grado_id"], "school_id": school_id}, {"_id": 0})
        grade_name = grade.get("nombre", "-") if grade else "-"
        if grade and grade.get("nivel_id"):
            level = await db.academic_levels.find_one({"id": grade["nivel_id"], "school_id": school_id}, {"_id": 0})
            level_name = level.get("nombre", "-") if level else "-"
    
    # Get academic assignments for this section (from academic_assignments collection)
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0}).to_list(100)
    
    # Build courses with teacher info
    courses = []
    seen_subjects = set()  # Avoid duplicates
    
    for assignment in assignments:
        subject_id = assignment.get("subject_id")
        if subject_id in seen_subjects:
            continue
        seen_subjects.add(subject_id)
        
        subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id}, {"_id": 0})
        if subject:
            teacher = await db.users.find_one({"id": assignment.get("teacher_id")}, {"_id": 0, "password": 0})
            
            # Count materials, tasks, etc. for this subject
            materials_count = await db.course_posts.count_documents({
                "school_id": school_id,
                "subject_id": subject["id"],
                "type": "material"
            })
            tasks_count = await db.course_posts.count_documents({
                "school_id": school_id,
                "subject_id": subject["id"],
                "type": "task"
            })
            
            courses.append({
                "id": subject["id"],
                "name": subject.get("name"),
                "description": subject.get("description"),
                "image_url": subject.get("image_url"),
                "color": subject.get("color"),
                "teacher": {
                    "id": teacher["id"] if teacher else None,
                    "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() if teacher else "Sin asignar",
                    "photo_url": teacher.get("photo_url") if teacher else None
                },
                "materials_count": materials_count,
                "tasks_count": tasks_count,
                "section_id": seccion_id,
                "section_name": section_name,
                "grade_id": assignment.get("grade_id"),
                "grade_name": grade_name,
                "level_name": level_name
            })
    
    return {"courses": courses}

@api_router.get("/student/classmates")
async def get_student_classmates(current_user = Depends(get_current_user)):
    """
    Get all students in the same section (including current user).
    Used for displaying student list in tasks and other views.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    
    if not seccion_id:
        return {"students": [], "message": "No tienes una sección asignada"}
    
    # Get ALL students in the same section (including current user)
    students_cursor = db.users.find(
        {
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student"
        },
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    students = await students_cursor.to_list(length=100)
    
    # Return student info with contact details for messaging
    return {
        "students": [
            {
                "id": s.get("id"),
                "name": s.get("name"),
                "last_name": s.get("last_name"),
                "photo_url": s.get("photo_url"),
                "username": s.get("username"),
                "email": s.get("email"),
                "phone": s.get("phone")
            }
            for s in students
        ]
    }

@api_router.get("/student/schedule")
async def get_student_schedule(current_user = Depends(get_current_user)):
    """
    Get schedule for student based on their section/grade.
    Returns the weekly class schedule configured by admin.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    grado_id = user.get("grado_id")
    
    if not seccion_id and not grado_id:
        return []
    
    # Build query - get schedules for student's section or grade
    query = {
        "school_id": school_id,
        "tipo": "clases"
    }
    
    # Try section first, then grade
    if seccion_id:
        query["seccion_id"] = seccion_id
    elif grado_id:
        query["grado_id"] = grado_id
    
    schedules = await db.schedules.find(query, {"_id": 0}).sort([("dia", 1), ("hora_inicio", 1)]).to_list(100)
    
    # Enrich with teacher and subject info
    enriched_schedules = []
    for schedule in schedules:
        # Get teacher name if profesor_id exists
        profesor_nombre = None
        if schedule.get("profesor_id"):
            teacher = await db.users.find_one({"id": schedule["profesor_id"]}, {"_id": 0, "name": 1, "last_name": 1})
            if teacher:
                profesor_nombre = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
        
        enriched_schedules.append({
            **schedule,
            "profesor_nombre": profesor_nombre or schedule.get("profesor_nombre")
        })
    
    return enriched_schedules

@api_router.get("/student/dashboard")
async def get_student_dashboard(current_user = Depends(get_current_user)):
    """
    Get dashboard data for student portal.
    Includes upcoming tasks, recent announcements, schedule preview.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    
    # Get student's courses from academic_assignments
    subject_ids = []
    if seccion_id:
        assignments = await db.academic_assignments.find({
            "school_id": school_id,
            "section_id": seccion_id,
            "status": "activo"
        }, {"_id": 0}).to_list(100)
        subject_ids = list(set([a.get("subject_id") for a in assignments if a.get("subject_id")]))
    
    # Upcoming tasks (next 7 days)
    upcoming_tasks = []
    if subject_ids:
        now = datetime.now(timezone.utc)
        week_later = now + timedelta(days=7)
        tasks = await db.course_posts.find({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "type": "task",
            "due_date": {"$gte": now.isoformat(), "$lte": week_later.isoformat()}
        }, {"_id": 0}).sort("due_date", 1).to_list(10)
        
        for task in tasks:
            subject = await db.subjects.find_one({"id": task["subject_id"]}, {"_id": 0})
            upcoming_tasks.append({
                "id": task["id"],
                "title": task.get("title"),
                "subject_name": subject.get("name") if subject else "Sin asignatura",
                "subject_color": subject.get("color") if subject else "#6366f1",
                "due_date": task.get("due_date"),
                "subject_id": task["subject_id"]
            })
    
    # Recent announcements (institutional messages)
    announcements = await db.institutional_messages.find({
        "school_id": school_id,
        "status": "active"
    }, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    # Format announcements
    recent_announcements = []
    for ann in announcements:
        recent_announcements.append({
            "id": ann["id"],
            "title": ann.get("title"),
            "priority": ann.get("priority", "normal"),
            "created_at": ann.get("created_at"),
            "is_read": user["id"] in ann.get("read_by", [])
        })
    
    # Get attendance summary (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    attendance_records = await db.attendance.find({
        "school_id": school_id,
        "student_id": user["id"],
        "date": {"$gte": thirty_days_ago}
    }, {"_id": 0}).to_list(100)
    
    attendance_summary = {
        "present": sum(1 for a in attendance_records if a.get("status") == "present"),
        "absent": sum(1 for a in attendance_records if a.get("status") == "absent"),
        "late": sum(1 for a in attendance_records if a.get("status") == "late"),
        "justified": sum(1 for a in attendance_records if a.get("status") == "justified")
    }
    
    # Calculate average grade from graded submissions
    average_grade = None
    if subject_ids:
        all_grades = []
        # Get all tasks with submissions for this student
        tasks_with_grades = await db.course_posts.find({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "type": "task",
            "submissions.student_id": user["id"],
            "submissions.grade": {"$exists": True, "$ne": None}
        }, {"_id": 0, "submissions": 1, "max_grade": 1}).to_list(500)
        
        for task in tasks_with_grades:
            max_grade = task.get("max_grade", 20)
            for sub in task.get("submissions", []):
                if sub.get("student_id") == user["id"] and sub.get("grade") is not None:
                    # Normalize to 20-point scale
                    normalized_grade = (sub["grade"] / max_grade) * 20 if max_grade > 0 else sub["grade"]
                    all_grades.append(normalized_grade)
        
        if all_grades:
            average_grade = sum(all_grades) / len(all_grades)
    
    # Get number of classmates in the same section
    section_students_count = 0
    if seccion_id:
        section_students_count = await db.users.count_documents({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "id": {"$ne": user["id"]}  # Exclude current student
        })
    
    return {
        "upcoming_tasks": upcoming_tasks,
        "recent_announcements": recent_announcements,
        "attendance_summary": attendance_summary,
        "courses_count": len(subject_ids),
        "average_grade": average_grade,
        "section_students_count": section_students_count
    }

@api_router.get("/attendance/student")
async def get_student_attendance(
    start_date: str = None,
    end_date: str = None,
    current_user = Depends(get_current_user)
):
    """
    Get attendance records for the current student.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para estudiantes")
    
    school_id = user.get("school_id")
    
    # Build query
    query = {
        "school_id": school_id,
        "student_id": user["id"]
    }
    
    # Date filters
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    
    return {"records": records}

# ══════════════════════════════════════════════════════════════════════════════
# TEACHER PORTAL ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/teacher/profile")
async def get_teacher_profile(current_user = Depends(get_current_user)):
    """Get teacher profile with assigned courses and sections."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher assignments
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    # Get unique sections and courses
    section_ids = list(set([a.get("section_id") for a in assignments if a.get("section_id")]))
    subject_ids = list(set([a.get("subject_id") for a in assignments if a.get("subject_id")]))
    
    sections = []
    if section_ids:
        sections = await db.sections.find({"id": {"$in": section_ids}, "school_id": school_id}, {"_id": 0}).to_list(100)
    
    courses = []
    if subject_ids:
        courses = await db.subjects.find({"id": {"$in": subject_ids}, "school_id": school_id}, {"_id": 0}).to_list(100)
    
    return {
        "user": {
            "id": user["id"],
            "name": user.get("name", ""),
            "last_name": user.get("last_name", ""),
            "email": user.get("email"),
            "photo_url": user.get("photo_url"),
            "role": user.get("role")
        },
        "assigned_courses": courses,
        "assigned_sections": sections,
        "assignments_count": len(assignments),
        "school_id": school_id
    }

@api_router.get("/teacher/dashboard")
async def get_teacher_dashboard(current_user = Depends(get_current_user)):
    """Get dashboard data for teacher portal."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher assignments
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    subject_ids = list(set([a.get("subject_id") for a in assignments if a.get("subject_id")]))
    section_ids = list(set([a.get("section_id") for a in assignments if a.get("section_id")]))
    
    # Get courses with section info
    courses = []
    for assignment in assignments:
        subject = await db.subjects.find_one({"id": assignment.get("subject_id"), "school_id": school_id}, {"_id": 0})
        section = await db.sections.find_one({"id": assignment.get("section_id"), "school_id": school_id}, {"_id": 0})
        grade = await db.grades.find_one({"id": assignment.get("grade_id"), "school_id": school_id}, {"_id": 0})
        
        if subject:
            # Count students in this section
            students_count = await db.users.count_documents({
                "school_id": school_id,
                "role": "student",
                "seccion_id": assignment.get("section_id")
            })
            
            courses.append({
                "id": subject["id"],
                "name": subject.get("name"),
                "color": subject.get("color"),
                "image_url": subject.get("image_url"),
                "section_id": assignment.get("section_id"),
                "section_name": section.get("nombre") if section else None,
                "grade_name": grade.get("nombre") if grade else None,
                "students_count": students_count
            })
    
    # Count total unique students across all sections
    total_students = 0
    if section_ids:
        total_students = await db.users.count_documents({
            "school_id": school_id,
            "role": "student",
            "seccion_id": {"$in": section_ids}
        })
    
    # Count pending reviews (submissions without grades)
    pending_reviews = 0
    recent_submissions = []
    if subject_ids:
        tasks = await db.course_posts.find({
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "type": "task"
        }, {"_id": 0}).to_list(200)
        
        for task in tasks:
            for submission in task.get("submissions", []):
                if submission.get("grade") is None:
                    pending_reviews += 1
                    # Get student info for recent submissions
                    student = await db.users.find_one({"id": submission.get("student_id")}, {"_id": 0})
                    recent_submissions.append({
                        "id": f"{task['id']}-{submission.get('student_id')}",
                        "task_id": task["id"],
                        "task_title": task.get("title"),
                        "student_id": submission.get("student_id"),
                        "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Alumno",
                        "student_photo": student.get("photo_url") if student else None,
                        "submitted_at": submission.get("submitted_at"),
                        "graded": False
                    })
        
        # Sort and limit recent submissions
        recent_submissions.sort(key=lambda x: x.get("submitted_at", ""), reverse=True)
        recent_submissions = recent_submissions[:5]
    
    # Check today's attendance
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_attendance_pending = []
    for section_id in section_ids:
        # Check if attendance was already taken for this section today
        existing = await db.attendance.find_one({
            "school_id": school_id,
            "section_id": section_id,
            "date": today
        })
        if not existing:
            section = await db.sections.find_one({"id": section_id, "school_id": school_id}, {"_id": 0})
            if section:
                today_attendance_pending.append({
                    "section_id": section_id,
                    "section_name": section.get("nombre")
                })
    
    # Unread messages
    unread_messages = await db.institutional_messages.count_documents({
        "school_id": school_id,
        "read_by": {"$ne": user["id"]}
    })
    
    return {
        "courses": courses,
        "total_students": total_students,
        "pending_reviews": pending_reviews,
        "recent_submissions": recent_submissions,
        "today_attendance_pending": today_attendance_pending,
        "unread_messages": unread_messages
    }

@api_router.get("/teacher/courses")
async def get_teacher_courses(current_user = Depends(get_current_user)):
    """Get all courses assigned to teacher."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher assignments
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    courses = []
    for assignment in assignments:
        subject = await db.subjects.find_one({"id": assignment.get("subject_id"), "school_id": school_id}, {"_id": 0})
        section = await db.sections.find_one({"id": assignment.get("section_id"), "school_id": school_id}, {"_id": 0})
        grade = await db.grades.find_one({"id": assignment.get("grade_id"), "school_id": school_id}, {"_id": 0})
        
        if subject:
            # Count students
            students_count = await db.users.count_documents({
                "school_id": school_id,
                "role": "student",
                "seccion_id": assignment.get("section_id")
            })
            
            # Count materials and tasks
            materials_count = await db.course_posts.count_documents({
                "school_id": school_id,
                "subject_id": subject["id"],
                "type": "material"
            })
            tasks_count = await db.course_posts.count_documents({
                "school_id": school_id,
                "subject_id": subject["id"],
                "type": "task"
            })
            
            courses.append({
                "id": subject["id"],
                "name": subject.get("name"),
                "description": subject.get("description"),
                "color": subject.get("color"),
                "image_url": subject.get("image_url"),
                "section_id": assignment.get("section_id"),
                "section_name": section.get("nombre") if section else None,
                "grade_id": assignment.get("grade_id"),
                "grade_name": grade.get("nombre") if grade else None,
                "students_count": students_count,
                "materials_count": materials_count,
                "tasks_count": tasks_count
            })
    
    return {"courses": courses}

@api_router.get("/teacher/students")
async def get_teacher_students(
    section_id: str = None,
    current_user = Depends(get_current_user)
):
    """Get students from teacher's assigned sections."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher's assigned sections
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    allowed_section_ids = list(set([a.get("section_id") for a in assignments if a.get("section_id")]))
    
    if not allowed_section_ids:
        return {"students": [], "sections": []}
    
    # Filter by specific section if provided
    if section_id and section_id in allowed_section_ids:
        query_sections = [section_id]
    else:
        query_sections = allowed_section_ids
    
    # Get students
    students = await db.users.find({
        "school_id": school_id,
        "role": "student",
        "seccion_id": {"$in": query_sections}
    }, {"_id": 0, "password": 0}).to_list(500)
    
    # Get section info for each student
    sections_map = {}
    for sid in allowed_section_ids:
        section = await db.sections.find_one({"id": sid, "school_id": school_id}, {"_id": 0})
        if section:
            sections_map[sid] = section
    
    # Enrich student data
    enriched_students = []
    for student in students:
        section = sections_map.get(student.get("seccion_id"), {})
        enriched_students.append({
            "id": student["id"],
            "name": student.get("name", ""),
            "last_name": student.get("last_name", ""),
            "photo_url": student.get("photo_url"),
            "email": student.get("email"),
            "section_id": student.get("seccion_id"),
            "section_name": section.get("nombre"),
            "grade_id": student.get("grado_id")
        })
    
    # Get sections for filter dropdown
    sections = [{"id": s["id"], "nombre": s.get("nombre")} for s in sections_map.values()]
    
    return {"students": enriched_students, "sections": sections}

@api_router.get("/teacher/students/{student_id}")
async def get_teacher_student_detail(
    student_id: str,
    current_user = Depends(get_current_user)
):
    """Get detailed academic info for a specific student (read-only view for teachers)."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher's assigned sections
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    allowed_section_ids = list(set([a.get("section_id") for a in assignments if a.get("section_id")]))
    
    # Get student - verify teacher has access
    student = await db.users.find_one({
        "id": student_id,
        "school_id": school_id,
        "role": "student",
        "seccion_id": {"$in": allowed_section_ids}
    }, {"_id": 0, "password": 0})
    
    if not student:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado o sin acceso")
    
    # Get attendance summary (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    attendance_records = await db.attendance.find({
        "school_id": school_id,
        "student_id": student_id,
        "date": {"$gte": thirty_days_ago}
    }, {"_id": 0}).to_list(100)
    
    attendance_summary = {
        "present": sum(1 for a in attendance_records if a.get("status") == "present"),
        "absent": sum(1 for a in attendance_records if a.get("status") == "absent"),
        "late": sum(1 for a in attendance_records if a.get("status") == "late"),
        "justified": sum(1 for a in attendance_records if a.get("status") == "justified")
    }
    
    # Get grades summary
    grades_records = await db.grades.find({
        "school_id": school_id,
        "student_id": student_id
    }, {"_id": 0}).to_list(100)
    
    grades_values = [g.get("grade") for g in grades_records if g.get("grade") is not None]
    grades_summary = {
        "average": sum(grades_values) / len(grades_values) if grades_values else None,
        "subjects_count": len(set([g.get("subject_id") for g in grades_records]))
    }
    
    # Get pending tasks count
    subject_ids = [a.get("subject_id") for a in assignments]
    pending_tasks = await db.course_posts.count_documents({
        "school_id": school_id,
        "subject_id": {"$in": subject_ids},
        "type": "task",
        "submissions.student_id": {"$ne": student_id},
        "due_date": {"$gte": datetime.now(timezone.utc).isoformat()}
    })
    
    return {
        "user": student,
        "attendance_summary": attendance_summary,
        "grades_summary": grades_summary,
        "pending_tasks": pending_tasks
    }

@api_router.get("/teacher/tasks")
async def get_teacher_tasks(current_user = Depends(get_current_user)):
    """Get all tasks created by or assigned to teacher's courses."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Get teacher assignments
    assignments = await db.academic_assignments.find({
        "school_id": school_id,
        "teacher_id": user["id"]
    }, {"_id": 0}).to_list(100)
    
    subject_ids = list(set([a.get("subject_id") for a in assignments if a.get("subject_id")]))
    
    if not subject_ids:
        return {"tasks": []}
    
    # Get tasks from teacher's courses
    tasks = await db.course_posts.find({
        "school_id": school_id,
        "subject_id": {"$in": subject_ids},
        "type": "task"
    }, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with subject/section info
    enriched_tasks = []
    for task in tasks:
        subject = await db.subjects.find_one({"id": task.get("subject_id"), "school_id": school_id}, {"_id": 0})
        
        # Get assignment for section info
        assignment = next((a for a in assignments if a.get("subject_id") == task.get("subject_id")), None)
        section = None
        if assignment and assignment.get("section_id"):
            section = await db.sections.find_one({"id": assignment.get("section_id"), "school_id": school_id}, {"_id": 0})
        
        # Count submissions and pending reviews
        submissions = task.get("submissions", [])
        pending_reviews = sum(1 for s in submissions if s.get("grade") is None)
        
        enriched_tasks.append({
            "id": task["id"],
            "title": task.get("title"),
            "content": task.get("content"),
            "due_date": task.get("due_date"),
            "subject_id": task.get("subject_id"),
            "subject_name": subject.get("name") if subject else "Sin asignatura",
            "section_name": section.get("nombre") if section else None,
            "submissions_count": len(submissions),
            "pending_reviews": pending_reviews,
            "created_at": task.get("created_at")
        })
    
    return {"tasks": enriched_tasks}

@api_router.get("/teacher/grades")
async def get_teacher_grades(
    subject_id: str,
    section_id: str,
    current_user = Depends(get_current_user)
):
    """Get grades for a specific subject/section."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Verify teacher has access to this subject/section
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "teacher_id": user["id"],
        "subject_id": subject_id,
        "section_id": section_id
    })
    
    if not assignment:
        raise HTTPException(status_code=403, detail="No tienes acceso a este curso/sección")
    
    # Get grades
    grades = await db.grades.find({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": section_id
    }, {"_id": 0}).to_list(500)
    
    return {"grades": grades}

class GradeEntry(BaseModel):
    student_id: str
    grade: Optional[float] = None

class SaveGradesRequest(BaseModel):
    subject_id: str
    section_id: str
    grades: List[GradeEntry]

@api_router.post("/teacher/grades")
async def save_teacher_grades(data: SaveGradesRequest, current_user = Depends(get_current_user)):
    """Save grades for students in a subject/section."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Verify teacher has access
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "teacher_id": user["id"],
        "subject_id": data.subject_id,
        "section_id": data.section_id
    })
    
    if not assignment:
        raise HTTPException(status_code=403, detail="No tienes acceso a este curso/sección")
    
    # Save each grade
    for entry in data.grades:
        if entry.grade is None:
            # Delete grade if null
            await db.grades.delete_one({
                "school_id": school_id,
                "subject_id": data.subject_id,
                "section_id": data.section_id,
                "student_id": entry.student_id
            })
        else:
            # Upsert grade
            await db.grades.update_one(
                {
                    "school_id": school_id,
                    "subject_id": data.subject_id,
                    "section_id": data.section_id,
                    "student_id": entry.student_id
                },
                {
                    "$set": {
                        "grade": entry.grade,
                        "teacher_id": user["id"],
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "school_id": school_id,
                        "subject_id": data.subject_id,
                        "section_id": data.section_id,
                        "student_id": entry.student_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                upsert=True
            )
    
    return {"message": "Notas guardadas correctamente", "count": len(data.grades)}

@api_router.get("/teacher/attendance")
async def get_teacher_attendance(
    section_id: str,
    date: str,
    current_user = Depends(get_current_user)
):
    """Get attendance records for a section on a specific date."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Verify teacher has access to this section
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "teacher_id": user["id"],
        "section_id": section_id
    })
    
    if not assignment:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta sección")
    
    # Get attendance records
    records = await db.attendance.find({
        "school_id": school_id,
        "section_id": section_id,
        "date": date
    }, {"_id": 0}).to_list(500)
    
    return {"records": records}

class AttendanceRecord(BaseModel):
    student_id: str
    status: str  # present, absent, late, justified

class SaveAttendanceRequest(BaseModel):
    section_id: str
    date: str
    records: List[AttendanceRecord]

@api_router.post("/teacher/attendance")
async def save_teacher_student_attendance(data: SaveAttendanceRequest, current_user = Depends(get_current_user)):
    """Save attendance records for a section (teacher recording student attendance)."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Este endpoint es solo para profesores")
    
    school_id = user.get("school_id")
    
    # Verify teacher has access
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "teacher_id": user["id"],
        "section_id": data.section_id
    })
    
    if not assignment:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta sección")
    
    # Validate date format
    try:
        datetime.strptime(data.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (YYYY-MM-DD)")
    
    # Save each attendance record
    for record in data.records:
        await db.attendance.update_one(
            {
                "school_id": school_id,
                "section_id": data.section_id,
                "date": data.date,
                "student_id": record.student_id
            },
            {
                "$set": {
                    "status": record.status,
                    "recorded_by": user["id"],
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "section_id": data.section_id,
                    "date": data.date,
                    "student_id": record.student_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
    
    return {"message": "Asistencia guardada correctamente", "count": len(data.records)}

@api_router.get("/dashboard/events", response_model=List[EventResponse])
async def get_events(current_user=Depends(require_school)):
    """Get events for current tenant - REQUIRES SCHOOL"""
    school_id = current_user.get("school_id")
    
    # Get tenant-specific events
    events = await db.events.find(
        {"tenant_id": school_id}, 
        {"_id": 0}
    ).sort("date", 1).to_list(20)
    
    # If no tenant events, return defaults
    if not events:
        events = await db.events.find(
            {"tenant_id": {"$exists": False}}, 
            {"_id": 0}
        ).sort("date", 1).to_list(20)
    
    return events

@api_router.get("/dashboard/enrollment", response_model=List[EnrollmentData])
async def get_enrollment(current_user=Depends(require_school)):
    """Get enrollment data for current tenant - REQUIRES SCHOOL"""
    school_id = current_user.get("school_id")
    
    data = await db.enrollment.find(
        {"tenant_id": school_id}, 
        {"_id": 0}
    ).to_list(100)
    
    if not data:
        data = await db.enrollment.find(
            {"tenant_id": {"$exists": False}}, 
            {"_id": 0}
        ).to_list(100)
    
    return data

@api_router.get("/dashboard/school")
async def get_school_info(current_user=Depends(require_school)):
    """Get current user's school info - REQUIRES SCHOOL"""
    school_id = current_user.get("school_id")
    
    school = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "password": 0}
    )
    
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    return school

# ══════════════════════════════════════════════════════════════════════════════
# ADMIN PORTAL - GESTIÓN ACADÉMICA ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class AdminGradeUpdate(BaseModel):
    grade: float
    motivo: str = Field(..., min_length=5, description="Motivo de la corrección administrativa")

@api_router.get("/admin/grades")
async def get_admin_grades(
    level_id: Optional[str] = None,
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    period_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all grades for admin view with filters."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id}
    if section_id:
        query["section_id"] = section_id
    if subject_id:
        query["subject_id"] = subject_id
    if period_id:
        query["period_id"] = period_id
    
    # Get grades
    grades = await db.student_grades.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with student, subject, section info
    enriched_grades = []
    for g in grades:
        student = await db.users.find_one({"id": g.get("student_id")}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
        subject = await db.subjects.find_one({"id": g.get("subject_id")}, {"_id": 0, "name": 1})
        section = await db.sections.find_one({"id": g.get("section_id")}, {"_id": 0, "nombre": 1})
        teacher = await db.users.find_one({"id": g.get("teacher_id")}, {"_id": 0, "name": 1, "last_name": 1}) if g.get("teacher_id") else None
        
        enriched_grades.append({
            **g,
            "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Desconocido",
            "student_photo": student.get("photo_url") if student else None,
            "subject_name": subject.get("name") if subject else "Sin asignatura",
            "section_name": section.get("nombre") if section else "Sin sección",
            "teacher_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() if teacher else None
        })
    
    return {"grades": enriched_grades, "total": len(enriched_grades)}

@api_router.get("/admin/grades/summary")
async def get_admin_grades_summary(
    level_id: Optional[str] = None,
    grade_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get grades summary by section for admin dashboard."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Get sections with optional filter
    section_query = {"school_id": school_id, "activo": True}
    if grade_id:
        section_query["grado_id"] = grade_id
    
    sections = await db.sections.find(section_query, {"_id": 0}).to_list(100)
    
    summary = []
    for section in sections:
        # Count students in section
        students_count = await db.users.count_documents({
            "school_id": school_id,
            "role": "student",
            "seccion_id": section["id"]
        })
        
        # Get grades for this section
        grades = await db.student_grades.find({
            "school_id": school_id,
            "section_id": section["id"]
        }, {"_id": 0, "grade": 1}).to_list(1000)
        
        grade_values = [g["grade"] for g in grades if g.get("grade") is not None]
        avg_grade = sum(grade_values) / len(grade_values) if grade_values else None
        
        # Get grade info
        grade = await db.grades.find_one({"id": section.get("grado_id")}, {"_id": 0, "nombre": 1, "nivel_id": 1})
        level = await db.academic_levels.find_one({"id": grade.get("nivel_id")}, {"_id": 0, "nombre": 1}) if grade else None
        
        summary.append({
            "section_id": section["id"],
            "section_name": section.get("nombre"),
            "grade_name": grade.get("nombre") if grade else None,
            "level_name": level.get("nombre") if level else None,
            "students_count": students_count,
            "grades_count": len(grade_values),
            "average_grade": round(avg_grade, 2) if avg_grade else None
        })
    
    return {"summary": summary}

@api_router.put("/admin/grades/{grade_id}")
async def update_admin_grade(
    grade_id: str,
    data: AdminGradeUpdate,
    current_user = Depends(get_current_user)
):
    """Update a grade with administrative reason (audit trail)."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar notas")
    
    school_id = user["school_id"]
    
    # Find the grade
    grade_doc = await db.student_grades.find_one({"id": grade_id, "school_id": school_id})
    if not grade_doc:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    
    old_grade = grade_doc.get("grade")
    
    # Create audit log entry
    audit_entry = {
        "old_grade": old_grade,
        "new_grade": data.grade,
        "motivo": data.motivo,
        "admin_id": user["id"],
        "admin_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Update grade with audit trail
    await db.student_grades.update_one(
        {"id": grade_id},
        {
            "$set": {
                "grade": data.grade,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_admin_edit": audit_entry
            },
            "$push": {
                "admin_edits": audit_entry
            }
        }
    )
    
    return {"message": "Nota actualizada correctamente", "old_grade": old_grade, "new_grade": data.grade}

# Admin Attendance Endpoints
@api_router.get("/admin/attendance")
async def get_admin_attendance(
    section_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get attendance records for admin view with filters."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id}
    if section_id:
        query["section_id"] = section_id
    if status:
        query["status"] = status
    if date_from and date_to:
        query["date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["date"] = {"$gte": date_from}
    elif date_to:
        query["date"] = {"$lte": date_to}
    
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    
    # Enrich with student info
    enriched = []
    for r in records:
        student = await db.users.find_one({"id": r.get("student_id")}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
        section = await db.sections.find_one({"id": r.get("section_id")}, {"_id": 0, "nombre": 1})
        
        enriched.append({
            **r,
            "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Desconocido",
            "student_photo": student.get("photo_url") if student else None,
            "section_name": section.get("nombre") if section else None
        })
    
    return {"records": enriched, "total": len(enriched)}

@api_router.get("/admin/attendance/summary")
async def get_admin_attendance_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get attendance summary by section."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Default to last 30 days
    if not date_from:
        date_from = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    sections = await db.sections.find({"school_id": school_id, "activo": True}, {"_id": 0}).to_list(100)
    
    summary = []
    for section in sections:
        # Get attendance records for this section
        records = await db.attendance.find({
            "school_id": school_id,
            "section_id": section["id"],
            "date": {"$gte": date_from, "$lte": date_to}
        }, {"_id": 0, "status": 1}).to_list(5000)
        
        present = sum(1 for r in records if r.get("status") == "present")
        absent = sum(1 for r in records if r.get("status") == "absent")
        late = sum(1 for r in records if r.get("status") == "late")
        justified = sum(1 for r in records if r.get("status") == "justified")
        total = len(records)
        
        # Get grade info
        grade = await db.grades.find_one({"id": section.get("grado_id")}, {"_id": 0, "nombre": 1, "nivel_id": 1})
        level = await db.academic_levels.find_one({"id": grade.get("nivel_id")}, {"_id": 0, "nombre": 1}) if grade else None
        
        summary.append({
            "section_id": section["id"],
            "section_name": section.get("nombre"),
            "grade_name": grade.get("nombre") if grade else None,
            "level_name": level.get("nombre") if level else None,
            "present": present,
            "absent": absent,
            "late": late,
            "justified": justified,
            "total": total,
            "attendance_rate": round((present / total) * 100, 1) if total > 0 else 0
        })
    
    return {"summary": summary, "date_range": {"from": date_from, "to": date_to}}

class AdminAttendanceUpdate(BaseModel):
    status: Literal["present", "absent", "late", "justified"]
    motivo: str = Field(..., min_length=5, description="Motivo de la corrección")

@api_router.put("/admin/attendance/{record_id}")
async def update_admin_attendance(
    record_id: str,
    data: AdminAttendanceUpdate,
    current_user = Depends(get_current_user)
):
    """Update attendance record with administrative reason."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden corregir asistencia")
    
    school_id = user["school_id"]
    
    record = await db.attendance.find_one({"id": record_id, "school_id": school_id})
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    old_status = record.get("status")
    
    # Create audit entry
    audit_entry = {
        "old_status": old_status,
        "new_status": data.status,
        "motivo": data.motivo,
        "admin_id": user["id"],
        "admin_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.attendance.update_one(
        {"id": record_id},
        {
            "$set": {
                "status": data.status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_admin_edit": audit_entry
            },
            "$push": {
                "admin_edits": audit_entry
            }
        }
    )
    
    return {"message": "Asistencia actualizada correctamente", "old_status": old_status, "new_status": data.status}

# Admin Tasks Endpoints
@api_router.get("/admin/tasks")
async def get_admin_tasks(
    subject_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all tasks for admin view."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id, "type": "task"}
    if subject_id:
        query["subject_id"] = subject_id
    if teacher_id:
        query["created_by"] = teacher_id
    
    tasks = await db.course_posts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Determine status and enrich
    now = datetime.now(timezone.utc).isoformat()
    enriched = []
    for t in tasks:
        subject = await db.subjects.find_one({"id": t.get("subject_id")}, {"_id": 0, "name": 1})
        teacher = await db.users.find_one({"id": t.get("created_by")}, {"_id": 0, "name": 1, "last_name": 1})
        
        submissions = t.get("submissions", [])
        submissions_count = len(submissions)
        graded_count = sum(1 for s in submissions if s.get("grade") is not None)
        
        # Calculate task status
        due_date = t.get("due_date")
        task_status = "active"
        if due_date and due_date < now:
            task_status = "expired"
        if t.get("status") == "closed":
            task_status = "closed"
        
        # Filter by status if provided
        if status and task_status != status:
            continue
        
        enriched.append({
            "id": t["id"],
            "title": t.get("title"),
            "due_date": due_date,
            "created_at": t.get("created_at"),
            "subject_id": t.get("subject_id"),
            "subject_name": subject.get("name") if subject else "Sin asignatura",
            "teacher_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() if teacher else "Desconocido",
            "submissions_count": submissions_count,
            "graded_count": graded_count,
            "status": task_status,
            "max_grade": t.get("max_grade", 20)
        })
    
    return {"tasks": enriched, "total": len(enriched)}

@api_router.get("/admin/tasks/summary")
async def get_admin_tasks_summary(current_user = Depends(get_current_user)):
    """Get tasks summary for admin dashboard."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Count tasks by status
    all_tasks = await db.course_posts.find({"school_id": school_id, "type": "task"}, {"_id": 0, "due_date": 1, "status": 1, "submissions": 1}).to_list(1000)
    
    active = 0
    expired = 0
    closed = 0
    total_submissions = 0
    total_graded = 0
    
    for t in all_tasks:
        due_date = t.get("due_date")
        if t.get("status") == "closed":
            closed += 1
        elif due_date and due_date < now:
            expired += 1
        else:
            active += 1
        
        submissions = t.get("submissions", [])
        total_submissions += len(submissions)
        total_graded += sum(1 for s in submissions if s.get("grade") is not None)
    
    return {
        "total": len(all_tasks),
        "active": active,
        "expired": expired,
        "closed": closed,
        "total_submissions": total_submissions,
        "total_graded": total_graded,
        "pending_grading": total_submissions - total_graded
    }

class AdminTaskStatusUpdate(BaseModel):
    status: Literal["active", "closed"]

@api_router.put("/admin/tasks/{task_id}/status")
async def update_admin_task_status(
    task_id: str,
    data: AdminTaskStatusUpdate,
    current_user = Depends(get_current_user)
):
    """Update task status (close/reopen)."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden cambiar estado")
    
    school_id = user["school_id"]
    
    task = await db.course_posts.find_one({"id": task_id, "school_id": school_id, "type": "task"})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    new_status = "closed" if data.status == "closed" else None
    
    await db.course_posts.update_one(
        {"id": task_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Estado de tarea actualizado a {data.status}"}

# Student Task Submission Endpoint
@api_router.post("/course/tasks/{task_id}/submit")
async def submit_task(
    task_id: str,
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user = Depends(get_current_user)
):
    """Submit a task as a student."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    student_id = user["id"]
    
    # Find the task - support both "type" (old system) and "post_type" (new system)
    task = await db.course_posts.find_one({
        "id": task_id, 
        "school_id": school_id, 
        "$or": [{"post_type": "task"}, {"type": "task"}]
    })
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Check if task deadline has passed
    due_date = task.get("due_date") or task.get("metadata", {}).get("due_date")
    if due_date:
        try:
            # Parse due date and compare with current time
            if isinstance(due_date, str):
                deadline = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            else:
                deadline = due_date
            
            now = datetime.now(timezone.utc)
            
            # Check if task allows late submissions
            allow_late = task.get("metadata", {}).get("allow_late_submissions", False)
            
            if deadline < now and not allow_late:
                raise HTTPException(
                    status_code=400, 
                    detail="El plazo para entregar esta tarea ha vencido. No se permiten entregas tardías."
                )
        except (ValueError, TypeError):
            pass  # If date parsing fails, allow submission
    
    # Check if already submitted
    existing = task.get("submissions", [])
    for sub in existing:
        if sub.get("student_id") == student_id:
            raise HTTPException(status_code=400, detail="Ya has entregado esta tarea")
    
    # Validate that at least one of text or file is provided
    if not text_content and not file:
        raise HTTPException(status_code=400, detail="Debes proporcionar texto o archivo")
    
    # Handle file upload if provided
    file_url = None
    file_name = None
    file_type = None
    drive_file_id = None
    storage_type = None
    
    if file:
        # Read file content
        content = await file.read()
        file_name = file.filename
        file_type = file.content_type
        
        # Check if school has Google Drive connected
        school = await db.schools.find_one({"id": school_id}, {"_id": 0})
        use_google_drive = school and school.get("google_drive_connected")
        
        if use_google_drive:
            # Upload to Google Drive
            try:
                service = await get_drive_service(school_id)
                
                # Get or create submissions folder
                materials_folder_id = school.get("google_drive_materials_folder_id")
                if materials_folder_id:
                    # Create a subfolder for submissions if it doesn't exist
                    submissions_folder_query = f"name='Entregas' and '{materials_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
                    results = service.files().list(q=submissions_folder_query, fields="files(id)").execute()
                    submissions_folders = results.get('files', [])
                    
                    if submissions_folders:
                        submissions_folder_id = submissions_folders[0]['id']
                    else:
                        # Create submissions folder
                        folder_metadata = {
                            'name': 'Entregas',
                            'mimeType': 'application/vnd.google-apps.folder',
                            'parents': [materials_folder_id]
                        }
                        folder = service.files().create(body=folder_metadata, fields='id').execute()
                        submissions_folder_id = folder.get('id')
                    
                    # Upload file to Drive
                    file_ext = file_name.split(".")[-1].lower() if "." in file_name else ""
                    mime_type = MIME_TYPE_MAP.get(file_ext, file_type or "application/octet-stream")
                    
                    file_metadata = {
                        'name': f"{student_id}_{file_name}",
                        'parents': [submissions_folder_id]
                    }
                    
                    media = MediaIoBaseUpload(
                        io.BytesIO(content),
                        mimetype=mime_type,
                        resumable=True
                    )
                    
                    drive_file = service.files().create(
                        body=file_metadata,
                        media_body=media,
                        fields='id, name'
                    ).execute()
                    
                    drive_file_id = drive_file.get('id')
                    storage_type = 'google_drive'
                    logger.info(f"Student submission uploaded to Drive: {file_name} for task {task_id}")
                else:
                    raise Exception("No materials folder configured")
                    
            except Exception as e:
                logger.warning(f"Failed to upload to Drive, falling back to Cloudinary: {e}")
                use_google_drive = False
        
        # Fallback to Cloudinary if Drive is not available or failed
        if not use_google_drive or not drive_file_id:
            try:
                import cloudinary.uploader
                result = cloudinary.uploader.upload(
                    content,
                    folder=f"edunet/submissions/{task_id}",
                    resource_type="auto",
                    public_id=f"{student_id}_{file_name}"
                )
                file_url = result.get("secure_url")
                storage_type = 'cloudinary'
            except Exception as e:
                logger.error(f"Cloudinary upload failed: {e}")
                raise HTTPException(status_code=500, detail="Error al subir el archivo")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create submission object
    submission = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "student_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "text_content": text_content,
        "file_url": file_url,
        "file_name": file_name,
        "file_type": file_type,
        "drive_file_id": drive_file_id,
        "storage_type": storage_type,
        "submitted_at": now,
        "grade": None,
        "feedback": None
    }
    
    # Add submission to task
    await db.course_posts.update_one(
        {"id": task_id},
        {"$push": {"submissions": submission}}
    )
    
    return {
        "message": "Tarea entregada exitosamente",
        "submission_id": submission["id"],
        "storage_type": storage_type
    }


@api_router.get("/course/tasks/{task_id}/submissions/{submission_id}/download")
async def download_submission_file(
    task_id: str,
    submission_id: str,
    current_user = Depends(get_current_user)
):
    """Download a student's submission file (works with both Google Drive and Cloudinary)."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Find the task - support both "type" (old system) and "post_type" (new system)
    task = await db.course_posts.find_one({
        "id": task_id,
        "school_id": school_id,
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Find the submission
    submission = None
    for sub in task.get("submissions", []):
        if sub.get("id") == submission_id:
            submission = sub
            break
    
    if not submission:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    
    # Check if user has permission (admin/teacher or the student who submitted)
    is_admin = is_admin_user(user)
    is_owner = submission.get("student_id") == user.get("id")
    
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="No tienes permiso para descargar este archivo")
    
    # Check storage type
    storage_type = submission.get("storage_type")
    drive_file_id = submission.get("drive_file_id")
    file_url = submission.get("file_url")
    file_name = submission.get("file_name", "archivo")
    
    if storage_type == "google_drive" and drive_file_id:
        # Download from Google Drive
        try:
            service = await get_drive_service(school_id)
            
            # Get file metadata
            file_metadata = service.files().get(fileId=drive_file_id, fields='mimeType, size').execute()
            mime_type = file_metadata.get('mimeType', 'application/octet-stream')
            
            # Stream the file
            request = service.files().get_media(fileId=drive_file_id)
            
            def generate():
                downloader = MediaIoBaseDownload(io.BytesIO(), request, chunksize=1024*1024)
                fh = io.BytesIO()
                downloader = MediaIoBaseDownload(fh, request)
                done = False
                while not done:
                    status, done = downloader.next_chunk()
                    if status:
                        fh.seek(0)
                        yield fh.read()
                        fh.seek(0)
                        fh.truncate()
                fh.seek(0)
                yield fh.read()
            
            return StreamingResponse(
                generate(),
                media_type=mime_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{file_name}"'
                }
            )
        except Exception as e:
            logger.error(f"Error downloading from Drive: {e}")
            raise HTTPException(status_code=500, detail="Error al descargar desde Google Drive")
    
    elif file_url:
        # Redirect to Cloudinary URL or return the URL
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=file_url)
    
    else:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")


# Admin Exams Endpoints
@api_router.get("/admin/exams")
async def get_admin_exams(
    subject_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all exams for admin view."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if subject_id:
        query["subject_id"] = subject_id
    if status:
        query["status"] = status
    
    exams = await db.exams.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    enriched = []
    for e in exams:
        subject = await db.subjects.find_one({"id": e.get("subject_id")}, {"_id": 0, "name": 1})
        teacher = await db.users.find_one({"id": e.get("created_by")}, {"_id": 0, "name": 1, "last_name": 1})
        
        enriched.append({
            **e,
            "subject_name": subject.get("name") if subject else "Sin asignatura",
            "teacher_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() if teacher else "Desconocido"
        })
    
    return {"exams": enriched, "total": len(enriched)}

@api_router.get("/admin/exams/summary")
async def get_admin_exams_summary(current_user = Depends(get_current_user)):
    """Get exams summary for admin dashboard."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    # Count by status
    draft = await db.exams.count_documents({"school_id": school_id, "status": "draft"})
    published = await db.exams.count_documents({"school_id": school_id, "status": "published"})
    scheduled = await db.exams.count_documents({"school_id": school_id, "status": "scheduled"})
    closed = await db.exams.count_documents({"school_id": school_id, "status": "closed"})
    archived = await db.exams.count_documents({"school_id": school_id, "status": "archived"})
    
    return {
        "total": draft + published + scheduled + closed + archived,
        "draft": draft,
        "published": published,
        "scheduled": scheduled,
        "closed": closed,
        "archived": archived
    }

class AdminExamUpdate(BaseModel):
    status: Optional[Literal["draft", "published", "scheduled", "closed", "archived"]] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None

@api_router.put("/admin/exams/{exam_id}")
async def update_admin_exam(
    exam_id: str,
    data: AdminExamUpdate,
    current_user = Depends(get_current_user)
):
    """Update exam status/schedule from admin."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar exámenes")
    
    school_id = user["school_id"]
    
    exam = await db.exams.find_one({"id": exam_id, "school_id": school_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.status:
        update_data["status"] = data.status
    if data.scheduled_date:
        update_data["scheduled_date"] = data.scheduled_date
    if data.scheduled_time:
        update_data["scheduled_time"] = data.scheduled_time
    
    await db.exams.update_one({"id": exam_id}, {"$set": update_data})
    
    return {"message": "Examen actualizado correctamente"}

# Admin Announcements Endpoints
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    audience: Literal["all", "teachers", "students", "parents"] = "all"
    status: Literal["draft", "published", "scheduled", "archived"] = "draft"
    publish_date: Optional[str] = None
    attachments: Optional[List[dict]] = []

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    audience: Optional[Literal["all", "teachers", "students", "parents"]] = None
    status: Optional[Literal["draft", "published", "scheduled", "archived"]] = None
    publish_date: Optional[str] = None
    attachments: Optional[List[dict]] = None

@api_router.get("/admin/announcements")
async def get_admin_announcements(
    status: Optional[str] = None,
    audience: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all announcements for admin view."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder")
    
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if status:
        query["status"] = status
    if audience:
        query["audience"] = audience
    
    announcements = await db.announcements.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"announcements": announcements, "total": len(announcements)}

@api_router.post("/admin/announcements")
async def create_announcement(
    data: AnnouncementCreate,
    current_user = Depends(get_current_user)
):
    """Create a new announcement."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear comunicados")
    
    school_id = user["school_id"]
    
    announcement = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "title": data.title,
        "content": data.content,
        "audience": data.audience,
        "status": data.status,
        "publish_date": data.publish_date,
        "attachments": data.attachments or [],
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.announcements.insert_one(announcement)
    del announcement["_id"]
    
    return {"message": "Comunicado creado correctamente", "announcement": announcement}

@api_router.put("/admin/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: str,
    data: AnnouncementUpdate,
    current_user = Depends(get_current_user)
):
    """Update an announcement."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar comunicados")
    
    school_id = user["school_id"]
    
    announcement = await db.announcements.find_one({"id": announcement_id, "school_id": school_id})
    if not announcement:
        raise HTTPException(status_code=404, detail="Comunicado no encontrado")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.announcements.update_one({"id": announcement_id}, {"$set": update_data})
    
    return {"message": "Comunicado actualizado correctamente"}

@api_router.delete("/admin/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an announcement."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar comunicados")
    
    school_id = user["school_id"]
    
    result = await db.announcements.delete_one({"id": announcement_id, "school_id": school_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comunicado no encontrado")
    
    return {"message": "Comunicado eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# DEMO DATA MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/demo-data/status")
async def get_demo_data_status(current_user = Depends(require_school)):
    """
    Check if the current school has demo data.
    Returns info about demo data presence.
    """
    user = current_user
    school_id = current_user.get("school_id")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Escuela no encontrada")
    
    has_demo = school.get("has_demo_data", False)
    demo_seeded_at = school.get("demo_seeded_at")
    
    # Count demo items
    demo_counts = {}
    if has_demo:
        demo_counts = {
            "users": await db.users.count_documents({"school_id": school_id, "is_demo": True}),
            "subjects": await db.subjects.count_documents({"school_id": school_id, "is_demo": True}),
            "news": await db.news.count_documents({"school_id": school_id, "is_demo": True}),
            "events": await db.calendar_events.count_documents({"school_id": school_id, "is_demo": True}),
            "payments": await db.payments.count_documents({"school_id": school_id, "is_demo": True}),
        }
    
    return {
        "has_demo_data": has_demo,
        "demo_seeded_at": demo_seeded_at,
        "demo_counts": demo_counts,
        "message": "Esta intranet contiene información de ejemplo para ayudarte a empezar." if has_demo else "No hay datos de demostración"
    }

@api_router.delete("/demo-data")
async def delete_demo_data(current_user = Depends(require_school)):
    """
    Delete all demo data from the current school.
    Only admin/owner can delete demo data.
    """
    user = current_user
    school_id = current_user.get("school_id")
    
    # Only owner/admin can delete demo data
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar datos demo")
    
    # Check if school has demo data
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school or not school.get("has_demo_data"):
        return {"message": "No hay datos de demostración para eliminar", "deleted": []}
    
    # Delete demo data
    result = await delete_demo_data_for_school(db, school_id)
    
    return {
        "message": "Datos de demostración eliminados correctamente",
        "deleted": result.get("deleted", [])
    }

@api_router.post("/demo-data/reseed")
async def reseed_demo_data(current_user = Depends(require_school)):
    """
    Re-seed demo data for the current school.
    This will first delete existing demo data, then create fresh demo data.
    Only admin/owner can reseed.
    """
    user = current_user
    school_id = current_user.get("school_id")
    
    # Only owner/admin can reseed
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden regenerar datos demo")
    
    # First delete existing demo data
    await delete_demo_data_for_school(db, school_id)
    
    # Then seed fresh demo data
    result = await seed_demo_data_for_school(db, school_id, user.get("sub", user.get("id")))
    
    return {
        "message": "Datos de demostración regenerados correctamente",
        "seeded": result.get("summary", {}).get("seeded", [])
    }

# ══════════════════════════════════════════════════════════════════════════════
# SEED DATA
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/seed")
async def seed_data():
    """Seed initial data for demo"""
    
    # Create unique indexes (if they don't exist)
    try:
        # Drop existing index if it exists to recreate properly
        existing_indexes = await db.schools.index_information()
        if 'subdomain_1' in existing_indexes:
            await db.schools.drop_index('subdomain_1')
        await db.schools.create_index("subdomain", unique=True, sparse=True)
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    
    try:
        existing_indexes = await db.users.index_information()
        if 'email_1' in existing_indexes:
            pass  # Index already exists
        else:
            await db.users.create_index("email", unique=True)
    except Exception as e:
        logger.warning(f"User index warning: {e}")
    
    # Seed default events (global - no tenant_id)
    await db.events.delete_many({"tenant_id": {"$exists": False}})
    events = [
        {"id": str(uuid.uuid4()), "title": "Reunión de Padres - 1ero Primaria", "date": "2026-02-18", "time": "09:00 AM", "category": "reunion", "color": "#001f4b"},
        {"id": str(uuid.uuid4()), "title": "Examen Trimestral - Matemáticas", "date": "2026-02-22", "time": "10:00 AM", "category": "examen", "color": "#e1b82c"},
        {"id": str(uuid.uuid4()), "title": "Feria de Ciencias", "date": "2026-02-25", "time": "02:00 PM", "category": "evento", "color": "#5c85d6"},
        {"id": str(uuid.uuid4()), "title": "Entrega de Boletines", "date": "2026-03-01", "time": "08:00 AM", "category": "academico", "color": "#10b981"},
        {"id": str(uuid.uuid4()), "title": "Día del Deporte", "date": "2026-03-05", "time": "07:30 AM", "category": "evento", "color": "#f59e0b"},
    ]
    await db.events.insert_many(events)

    # Seed default enrollment data (global)
    await db.enrollment.delete_many({"tenant_id": {"$exists": False}})
    enrollment = [
        {"month": "Ene", "students": 380},
        {"month": "Feb", "students": 412},
        {"month": "Mar", "students": 425},
        {"month": "Abr", "students": 438},
        {"month": "May", "students": 445},
        {"month": "Jun", "students": 430},
        {"month": "Jul", "students": 420},
        {"month": "Ago", "students": 448},
        {"month": "Sep", "students": 456},
        {"month": "Oct", "students": 460},
        {"month": "Nov", "students": 455},
        {"month": "Dic", "students": 450},
    ]
    await db.enrollment.insert_many(enrollment)

    return {"message": "Datos iniciales creados e índices configurados"}

@api_router.get("/")
async def root():
    return {
        "message": "EduNet SaaS API",
        "version": "2.1",
        "base_domain": BASE_DOMAIN,
        "architecture": "Multi-tenant by subdomain"
    }

# ══════════════════════════════════════════════════════════════════════════════
# CLOUDINARY SIGNATURE (For secure uploads)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/cloudinary/signature")
async def generate_cloudinary_signature(
    resource_type: str = Query("image", enum=["image", "video", "raw", "auto"]),
    folder: str = Query("edunet/logos"),
    current_user = Depends(get_current_user)
):
    """
    Generate a signed upload signature for Cloudinary.
    Requires authentication.
    resource_type: image, video, raw (for PDF/DOC), or auto
    """
    ALLOWED_FOLDERS = ("edunet/logos", "edunet/uploads", "edunet/media", "edunet/users", "edunet/academic", "edunet/banners", "edunet/news", "edunet/messages", "edunet/discipline", "edunet/subjects", "edunet/posts", "edunet/exam-questions", "edunet/materials")
    if not any(folder.startswith(f) for f in ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Carpeta no permitida")

    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
    }
    
    # For raw files (PDF, DOC, etc.), we need to ensure public access
    # Note: type=upload makes files publicly accessible by default
    # The access_mode parameter in signature is for authenticated assets
    
    signature = cloudinary.utils.api_sign_request(
        params,
        os.environ.get("CLOUDINARY_API_SECRET")
    )

    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.environ.get("CLOUDINARY_API_KEY"),
        "folder": folder,
        "resource_type": resource_type
    }

@api_router.get("/cloudinary/signed-url")
async def get_signed_download_url(
    url: str = Query(..., description="Original Cloudinary URL"),
    public_id: Optional[str] = Query(None, description="Cloudinary public_id if known"),
    resource_type: Optional[str] = Query(None, description="Cloudinary resource_type if known"),
    current_user = Depends(get_current_user)
):
    """
    Generate a signed URL for downloading a Cloudinary asset.
    Uses stored cloudinary_data for accurate URL generation.
    """
    if "cloudinary.com" not in url:
        raise HTTPException(status_code=400, detail="URL no válida")
    
    try:
        # If we have the public_id and resource_type from stored data, use them directly
        if public_id and resource_type:
            signed_url = cloudinary.utils.private_download_url(
                public_id,
                format="",
                resource_type=resource_type,
                expires_at=int(time.time()) + 3600,
                attachment=True
            )
            return {"signed_url": signed_url, "expires_in": 3600}
        
        # Otherwise, try to extract from URL
        parts = url.split("/upload/")
        if len(parts) != 2:
            return {"signed_url": url, "expires_in": 3600}
        
        path_with_version = parts[1]
        
        # Extract public_id (remove version prefix if present)
        if path_with_version.startswith("v") and "/" in path_with_version:
            version_and_path = path_with_version.split("/", 1)
            extracted_public_id = version_and_path[1]
        else:
            extracted_public_id = path_with_version
        
        # Determine resource type from URL
        extracted_resource_type = "raw" if "/raw/" in url else "image"
        
        # Generate signed URL
        signed_url = cloudinary.utils.private_download_url(
            extracted_public_id,
            format="",
            resource_type=extracted_resource_type,
            expires_at=int(time.time()) + 3600,
            attachment=True
        )
        
        return {"signed_url": signed_url, "expires_in": 3600}
        
    except Exception as e:
        print(f"Error generating signed URL: {e}")
        import traceback
        traceback.print_exc()
        return {"signed_url": url, "expires_in": 3600}

# ══════════════════════════════════════════════════════════════════════════════
# TENANT SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/settings")
async def get_tenant_settings(current_user = Depends(get_current_user)):
    """
    Get settings for the current user's tenant.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Get school info
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    # Get or create settings
    settings = await db.tenant_settings.find_one(
        {"school_id": school_id},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults based on school
        settings = {
            "school_id": school_id,
            "logo_url": None,
            "system_name": school.get("school_name", ""),
            "system_title": f"{school.get('school_name', '')} - Intranet",
            "system_email": user.get("email", ""),
            "currency": "PEN",
            "whatsapp": None,
            "website_url": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    
    return settings

@api_router.put("/settings")
async def update_tenant_settings(
    data: TenantSettingsUpdate,
    current_user = Depends(get_current_user)
):
    """
    Update settings for the current user's tenant.
    Only admins/owners can update settings.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check role - only owner or admin can update settings
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar ajustes")
    
    school_id = user["school_id"]
    
    # Build update document (only include non-None values)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Upsert settings
    result = await db.tenant_settings.update_one(
        {"school_id": school_id},
        {
            "$set": update_data,
            "$setOnInsert": {
                "school_id": school_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Also update logo_url in schools collection for public access
    if data.logo_url is not None:
        await db.schools.update_one(
            {"id": school_id},
            {"$set": {"logo_url": data.logo_url}}
        )
    
    # Return updated settings
    settings = await db.tenant_settings.find_one(
        {"school_id": school_id},
        {"_id": 0}
    )
    
    logger.info(f"Settings updated for school {school_id}")
    
    return {
        "message": "Ajustes guardados correctamente",
        "settings": settings
    }

@api_router.get("/settings/public/{subdomain}")
async def get_public_settings(subdomain: str):
    """
    Get public settings for a school by subdomain.
    Used to customize login pages, etc.
    """
    subdomain = subdomain.lower().strip()
    
    school = await db.schools.find_one(
        {"subdomain": subdomain, "status": "active"},
        {"_id": 0}
    )
    
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    settings = await db.tenant_settings.find_one(
        {"school_id": school["id"]},
        {"_id": 0}
    )
    
    # Merge school info with settings
    return {
        "subdomain": school.get("subdomain"),
        "school_name": school.get("school_name"),
        "full_domain": school.get("full_domain"),
        "logo_url": settings.get("logo_url") if settings else school.get("logo_url"),
        "system_name": settings.get("system_name") if settings else school.get("school_name"),
        "system_title": settings.get("system_title") if settings else f"{school.get('school_name')} - Intranet",
        "primary_color": school.get("primary_color", "#001f4b"),
        "secondary_color": school.get("secondary_color", "#e1b82c"),
    }

# ══════════════════════════════════════════════════════════════════════════════
# USERS MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/users")
async def get_tenant_users(current_user = Depends(get_current_user)):
    """
    Get all users for the current tenant.
    Only admins/directors/owners/super_admins can view users.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check role - owners, super_admins, directors and admins can view users
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver usuarios")
    
    school_id = user["school_id"]
    
    # Get all users for this school
    users_cursor = db.users.find(
        {"school_id": school_id},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    users = await users_cursor.to_list(length=1000)
    
    return users

@api_router.get("/users/{user_id}")
async def get_user_by_id(user_id: str, current_user = Depends(get_current_user)):
    """Get a specific user by ID"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check role - owners, super_admins, directors and admins can view users
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver usuarios")
    
    target_user = await db.users.find_one(
        {"id": user_id, "school_id": user["school_id"]},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return target_user

class CreateUserRequest(BaseModel):
    """Request to create a new user"""
    username: str
    password: str
    name: str
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    birthday: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    role: str = "teacher"
    photo_url: Optional[str] = None
    # Academic fields for students
    nivel_id: Optional[str] = None
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    turno_id: Optional[str] = None
    padre_id: Optional[str] = None  # Link student to parent
    # Student complementary info
    condiciones_medicas: Optional[str] = None
    alergias: Optional[str] = None
    doctor_nombre: Optional[str] = None
    doctor_telefono: Optional[str] = None
    persona_autorizada: Optional[str] = None
    persona_autorizada_telefono: Optional[str] = None
    notas: Optional[str] = None
    # Parent-specific fields
    dni: Optional[str] = None
    ocupacion: Optional[str] = None
    lugar_trabajo: Optional[str] = None
    telefono_trabajo: Optional[str] = None

@api_router.get("/users/check-username/{username}")
async def check_username(username: str, current_user = Depends(get_current_user)):
    """Check if username is available"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    existing = await db.users.find_one({
        "username": username.lower(),
        "school_id": user["school_id"]
    })
    
    return {
        "available": existing is None,
        "username": username
    }

@api_router.post("/users")
async def create_user(data: CreateUserRequest, current_user = Depends(get_current_user)):
    """
    Create a new user for the current tenant.
    Only admins/owners can create users.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check role - only owner or admin can create users
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear usuarios")
    
    school_id = user["school_id"]
    
    # Check if username already exists in this school
    existing = await db.users.find_one({
        "username": data.username.lower(),
        "school_id": school_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    # Check if email already exists (if provided)
    if data.email:
        existing_email = await db.users.find_one({
            "email": data.email.lower(),
            "school_id": school_id
        })
        if existing_email:
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    # Create user
    new_user = {
        "id": str(uuid.uuid4()),
        "username": data.username.lower(),
        "password": hash_password(data.password),
        "name": data.name,
        "last_name": data.last_name,
        "email": data.email.lower() if data.email else None,
        "phone": data.phone,
        "birthday": data.birthday,
        "gender": data.gender,
        "address": data.address,
        "role": data.role,
        "photo_url": data.photo_url,
        "school_id": school_id,
        "email_verified": True,  # Created by admin, no verification needed
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add academic fields for students
    if data.role == "student":
        new_user["nivel_id"] = data.nivel_id
        new_user["grado_id"] = data.grado_id
        new_user["seccion_id"] = data.seccion_id
        new_user["turno_id"] = data.turno_id
        if data.padre_id:
            new_user["padre_id"] = data.padre_id
        # Complementary info
        if data.condiciones_medicas:
            new_user["condiciones_medicas"] = data.condiciones_medicas
        if data.alergias:
            new_user["alergias"] = data.alergias
        if data.doctor_nombre:
            new_user["doctor_nombre"] = data.doctor_nombre
        if data.doctor_telefono:
            new_user["doctor_telefono"] = f"+51{data.doctor_telefono}" if data.doctor_telefono and not data.doctor_telefono.startswith("+") else data.doctor_telefono
        if data.persona_autorizada:
            new_user["persona_autorizada"] = data.persona_autorizada
        if data.persona_autorizada_telefono:
            new_user["persona_autorizada_telefono"] = f"+51{data.persona_autorizada_telefono}" if data.persona_autorizada_telefono and not data.persona_autorizada_telefono.startswith("+") else data.persona_autorizada_telefono
        if data.notas:
            new_user["notas"] = data.notas
    
    # Add parent-specific fields
    if data.role == "parent":
        new_user["dni"] = data.dni
        new_user["ocupacion"] = data.ocupacion
        new_user["lugar_trabajo"] = data.lugar_trabajo
        new_user["telefono_trabajo"] = data.telefono_trabajo
    
    await db.users.insert_one(new_user)
    
    # Remove sensitive fields before returning
    del new_user["password"]
    if "_id" in new_user:
        del new_user["_id"]
    
    logger.info(f"User created: {data.username} with role {data.role} in school {school_id}")
    
    return {
        "message": "Usuario creado correctamente",
        "user": new_user
    }

class UpdateUserRequest(BaseModel):
    """Request to update an existing user"""
    name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    birthday: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    role: Optional[str] = None
    photo_url: Optional[str] = None
    password: Optional[str] = None  # For password changes
    # Academic fields for students
    nivel_id: Optional[str] = None
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    turno_id: Optional[str] = None
    padre_id: Optional[str] = None
    parent_id: Optional[str] = None  # Alias for padre_id (frontend compatibility)
    # Student complementary info
    condiciones_medicas: Optional[str] = None
    alergias: Optional[str] = None
    doctor_nombre: Optional[str] = None
    doctor_telefono: Optional[str] = None
    persona_autorizada: Optional[str] = None
    persona_autorizada_telefono: Optional[str] = None
    notas: Optional[str] = None
    # Parent-specific fields
    dni: Optional[str] = None
    ocupacion: Optional[str] = None
    lugar_trabajo: Optional[str] = None
    telefono_trabajo: Optional[str] = None

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: UpdateUserRequest, current_user = Depends(get_current_user)):
    """Update an existing user"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar usuarios")
    
    # Find target user
    target = await db.users.find_one({"id": user_id, "school_id": user["school_id"]})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Cannot change role of protected users
    if (target.get("is_protected") or target.get("is_owner")) and data.role and data.role != target.get("role"):
        raise HTTPException(status_code=400, detail="No se puede cambiar el rol del propietario de la intranet")
    
    # Build update data
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.last_name is not None:
        update_data["last_name"] = data.last_name
    if data.email is not None:
        # Check if email is already used by another user
        existing = await db.users.find_one({
            "email": data.email.lower(),
            "school_id": user["school_id"],
            "id": {"$ne": user_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Este correo ya está registrado")
        update_data["email"] = data.email.lower()
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.birthday is not None:
        update_data["birthday"] = data.birthday
    if data.gender is not None:
        update_data["gender"] = data.gender
    if data.address is not None:
        update_data["address"] = data.address
    if data.role is not None:
        update_data["role"] = data.role
    if data.photo_url is not None:
        update_data["photo_url"] = data.photo_url
    # Academic fields
    if data.nivel_id is not None:
        update_data["nivel_id"] = data.nivel_id
    if data.grado_id is not None:
        update_data["grado_id"] = data.grado_id
    if data.seccion_id is not None:
        update_data["seccion_id"] = data.seccion_id
    if data.turno_id is not None:
        update_data["turno_id"] = data.turno_id
    if data.padre_id is not None:
        update_data["padre_id"] = data.padre_id
    # Student medical/contact info
    if data.condiciones_medicas is not None:
        update_data["condiciones_medicas"] = data.condiciones_medicas
    if data.alergias is not None:
        update_data["alergias"] = data.alergias
    if data.doctor_nombre is not None:
        update_data["doctor_nombre"] = data.doctor_nombre
    if data.doctor_telefono is not None:
        update_data["doctor_telefono"] = data.doctor_telefono
    if data.persona_autorizada is not None:
        update_data["persona_autorizada"] = data.persona_autorizada
    if data.persona_autorizada_telefono is not None:
        update_data["persona_autorizada_telefono"] = data.persona_autorizada_telefono
    if data.notas is not None:
        update_data["notas"] = data.notas
    # Parent fields
    if data.dni is not None:
        update_data["dni"] = data.dni
    if data.ocupacion is not None:
        update_data["ocupacion"] = data.ocupacion
    if data.lugar_trabajo is not None:
        update_data["lugar_trabajo"] = data.lugar_trabajo
    if data.telefono_trabajo is not None:
        update_data["telefono_trabajo"] = data.telefono_trabajo
    
    # Handle password change
    if data.password is not None and data.password.strip():
        update_data["password"] = hash_password(data.password)
        logger.info(f"Password changed for user {user_id}")
    
    # Handle parent_id (frontend sends parent_id, backend uses padre_id)
    if data.parent_id is not None:
        update_data["padre_id"] = data.parent_id if data.parent_id else None
        update_data["parent_id"] = data.parent_id if data.parent_id else None
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Return updated user
    updated_user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    
    logger.info(f"User {user_id} updated by {user['id']}")
    
    return {"message": "Usuario actualizado correctamente", "user": updated_user}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user = Depends(get_current_user)):
    """Delete a user and their Cloudinary image"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar usuarios")
    
    # Cannot delete yourself
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    
    # Find target user
    target = await db.users.find_one({"id": user_id, "school_id": user["school_id"]})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # PROTECTED USERS CANNOT BE DELETED
    if target.get("is_protected") or target.get("is_owner") or target.get("is_super_admin"):
        raise HTTPException(status_code=400, detail="Este usuario es el propietario de la intranet y no puede ser eliminado")
    
    # Delete photo from Cloudinary if exists
    if target.get("photo_url"):
        try:
            # Extract public_id from Cloudinary URL
            # URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{filename}.{ext}
            photo_url = target["photo_url"]
            if "cloudinary.com" in photo_url:
                # Extract the part after /upload/
                parts = photo_url.split("/upload/")
                if len(parts) > 1:
                    # Remove version prefix (v123456789/) and file extension
                    path_with_ext = parts[1]
                    # Remove version prefix if present
                    if path_with_ext.startswith("v"):
                        path_with_ext = "/".join(path_with_ext.split("/")[1:])
                    # Remove file extension
                    public_id = path_with_ext.rsplit(".", 1)[0]
                    # Delete from Cloudinary
                    cloudinary.uploader.destroy(public_id)
                    logger.info(f"Deleted Cloudinary image: {public_id}")
        except Exception as e:
            logger.error(f"Error deleting Cloudinary image: {e}")
            # Continue with user deletion even if image deletion fails
    
    await db.users.delete_one({"id": user_id})
    
    return {"message": "Usuario eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - NIVELES EDUCATIVOS
# ══════════════════════════════════════════════════════════════════════════════

class AcademicLevelCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    activo: bool = True
    orden: int = 0

class AcademicLevelUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    activo: Optional[bool] = None
    orden: Optional[int] = None

@api_router.get("/academic/levels")
async def get_academic_levels(
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all academic levels for the current tenant"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    if activo is not None:
        query["activo"] = activo
    
    levels = await db.academic_levels.find(query, {"_id": 0}).sort("orden", 1).to_list(100)
    
    # Add grade count for each level
    for level in levels:
        grade_count = await db.grades.count_documents({
            "school_id": user["school_id"],
            "nivel_id": level["id"]
        })
        level["grade_count"] = grade_count
    
    return levels

@api_router.post("/academic/levels")
async def create_academic_level(
    data: AcademicLevelCreate,
    current_user = Depends(get_current_user)
):
    """Create a new academic level"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear niveles")
    
    # Check for duplicate name
    existing = await db.academic_levels.find_one({
        "school_id": user["school_id"],
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un nivel con ese nombre")
    
    # Get next order number if not provided
    if data.orden == 0:
        max_order = await db.academic_levels.find_one(
            {"school_id": user["school_id"]},
            sort=[("orden", -1)]
        )
        next_order = (max_order.get("orden", 0) + 1) if max_order else 1
    else:
        next_order = data.orden

    level = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "nombre": data.nombre,
        "descripcion": data.descripcion,
        "imagen_url": data.imagen_url,
        "activo": data.activo,
        "orden": next_order,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.academic_levels.insert_one(level)
    level.pop("_id", None)
    level["grade_count"] = 0
    
    return {"message": "Nivel creado correctamente", "level": level}

@api_router.put("/academic/levels/{level_id}")
async def update_academic_level(
    level_id: str,
    data: AcademicLevelUpdate,
    current_user = Depends(get_current_user)
):
    """Update an academic level"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar niveles")
    
    # Find the level
    level = await db.academic_levels.find_one({
        "id": level_id,
        "school_id": user["school_id"]
    })
    if not level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    
    # Check for duplicate name if name is being changed
    if data.nombre and data.nombre.lower() != level["nombre"].lower():
        existing = await db.academic_levels.find_one({
            "school_id": user["school_id"],
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": level_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un nivel con ese nombre")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.descripcion is not None:
        update_data["descripcion"] = data.descripcion
    if data.imagen_url is not None:
        update_data["imagen_url"] = data.imagen_url
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.academic_levels.update_one({"id": level_id}, {"$set": update_data})
    
    # Get updated level
    updated_level = await db.academic_levels.find_one({"id": level_id}, {"_id": 0})
    grade_count = await db.grades.count_documents({
        "school_id": user["school_id"],
        "nivel_id": level_id
    })
    updated_level["grade_count"] = grade_count
    
    return {"message": "Nivel actualizado correctamente", "level": updated_level}

@api_router.delete("/academic/levels/{level_id}")
async def delete_academic_level(
    level_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an academic level (only if no grades are associated)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar niveles")
    
    # Find the level
    level = await db.academic_levels.find_one({
        "id": level_id,
        "school_id": user["school_id"]
    })
    if not level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    
    # Check if level has grades
    grade_count = await db.grades.count_documents({
        "school_id": user["school_id"],
        "nivel_id": level_id
    })
    if grade_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar el nivel porque tiene {grade_count} grado(s) asociado(s). Elimina primero los grados."
        )
    
    # Delete image from Cloudinary if exists
    if level.get("imagen_url") and "cloudinary.com" in level["imagen_url"]:
        try:
            parts = level["imagen_url"].split("/upload/")
            if len(parts) > 1:
                path_with_ext = parts[1]
                if path_with_ext.startswith("v"):
                    path_with_ext = "/".join(path_with_ext.split("/")[1:])
                public_id = path_with_ext.rsplit(".", 1)[0]
                cloudinary.uploader.destroy(public_id)
        except Exception as e:
            logger.error(f"Error deleting Cloudinary image: {e}")
    
    await db.academic_levels.delete_one({"id": level_id})
    
    return {"message": "Nivel eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - GRADOS
# ══════════════════════════════════════════════════════════════════════════════

class GradeCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    nivel_id: str
    orden: Optional[int] = 0
    activo: bool = True

class GradeUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    nivel_id: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None

@api_router.get("/academic/grades")
async def get_grades(
    nivel_id: Optional[str] = None,
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all grades for the current tenant"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    if nivel_id:
        query["nivel_id"] = nivel_id
    if activo is not None:
        query["activo"] = activo
    
    grades = await db.grades.find(query, {"_id": 0}).sort([("nivel_id", 1), ("orden", 1)]).to_list(200)
    
    # Add level info and section count for each grade
    levels_cache = {}
    for grade in grades:
        # Get level info
        if grade["nivel_id"] not in levels_cache:
            level = await db.academic_levels.find_one({"id": grade["nivel_id"]}, {"_id": 0, "nombre": 1})
            levels_cache[grade["nivel_id"]] = level["nombre"] if level else "Sin nivel"
        grade["nivel_nombre"] = levels_cache[grade["nivel_id"]]
        
        # Get section count
        section_count = await db.sections.count_documents({
            "school_id": user["school_id"],
            "grado_id": grade["id"]
        })
        grade["section_count"] = section_count
    
    return grades

@api_router.post("/academic/grades")
async def create_grade(
    data: GradeCreate,
    current_user = Depends(get_current_user)
):
    """Create a new grade"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear grados")
    
    # Verify level exists
    level = await db.academic_levels.find_one({
        "id": data.nivel_id,
        "school_id": user["school_id"]
    })
    if not level:
        raise HTTPException(status_code=400, detail="El nivel educativo no existe")
    
    # Check for duplicate name within the same level
    existing = await db.grades.find_one({
        "school_id": user["school_id"],
        "nivel_id": data.nivel_id,
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un grado con ese nombre en este nivel")
    
    # Auto-calculate order if not provided
    orden = data.orden
    if orden == 0:
        last_grade = await db.grades.find_one(
            {"school_id": user["school_id"], "nivel_id": data.nivel_id},
            sort=[("orden", -1)]
        )
        orden = (last_grade["orden"] + 1) if last_grade else 1
    
    grade = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "nombre": data.nombre,
        "nivel_id": data.nivel_id,
        "orden": orden,
        "activo": data.activo,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.grades.insert_one(grade)
    grade.pop("_id", None)
    grade["nivel_nombre"] = level["nombre"]
    grade["section_count"] = 0
    
    return {"message": "Grado creado correctamente", "grade": grade}

@api_router.put("/academic/grades/{grade_id}")
async def update_grade(
    grade_id: str,
    data: GradeUpdate,
    current_user = Depends(get_current_user)
):
    """Update a grade"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar grados")
    
    # Find the grade
    grade = await db.grades.find_one({
        "id": grade_id,
        "school_id": user["school_id"]
    })
    if not grade:
        raise HTTPException(status_code=404, detail="Grado no encontrado")
    
    # If changing level, verify new level exists
    new_nivel_id = data.nivel_id if data.nivel_id else grade["nivel_id"]
    if data.nivel_id and data.nivel_id != grade["nivel_id"]:
        level = await db.academic_levels.find_one({
            "id": data.nivel_id,
            "school_id": user["school_id"]
        })
        if not level:
            raise HTTPException(status_code=400, detail="El nivel educativo no existe")
    
    # Check for duplicate name within the same level
    if data.nombre and (data.nombre.lower() != grade["nombre"].lower() or new_nivel_id != grade["nivel_id"]):
        existing = await db.grades.find_one({
            "school_id": user["school_id"],
            "nivel_id": new_nivel_id,
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": grade_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un grado con ese nombre en este nivel")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.nivel_id is not None:
        update_data["nivel_id"] = data.nivel_id
    if data.orden is not None:
        update_data["orden"] = data.orden
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.grades.update_one({"id": grade_id}, {"$set": update_data})
    
    # Get updated grade with level info
    updated_grade = await db.grades.find_one({"id": grade_id}, {"_id": 0})
    level = await db.academic_levels.find_one({"id": updated_grade["nivel_id"]}, {"_id": 0, "nombre": 1})
    updated_grade["nivel_nombre"] = level["nombre"] if level else "Sin nivel"
    section_count = await db.sections.count_documents({
        "school_id": user["school_id"],
        "grado_id": grade_id
    })
    updated_grade["section_count"] = section_count
    
    return {"message": "Grado actualizado correctamente", "grade": updated_grade}

@api_router.delete("/academic/grades/{grade_id}")
async def delete_grade(
    grade_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a grade (only if no sections are associated)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar grados")
    
    # Find the grade
    grade = await db.grades.find_one({
        "id": grade_id,
        "school_id": user["school_id"]
    })
    if not grade:
        raise HTTPException(status_code=404, detail="Grado no encontrado")
    
    # Check if grade has sections
    section_count = await db.sections.count_documents({
        "school_id": user["school_id"],
        "grado_id": grade_id
    })
    if section_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar el grado porque tiene {section_count} sección(es) asociada(s). Elimina primero las secciones."
        )
    
    # TODO: Check for enrolled students when that module is implemented
    
    await db.grades.delete_one({"id": grade_id})
    
    return {"message": "Grado eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - SECTION TYPES (CATALOG)
# ══════════════════════════════════════════════════════════════════════════════

# Predefined section types catalog
DEFAULT_SECTION_TYPES = [
    {"key": "A", "label": "A", "orden": 1},
    {"key": "B", "label": "B", "orden": 2},
    {"key": "C", "label": "C", "orden": 3},
    {"key": "D", "label": "D", "orden": 4},
    {"key": "E", "label": "E", "orden": 5},
    {"key": "F", "label": "F", "orden": 6},
    {"key": "UNICA", "label": "ÚNICA", "orden": 7},
]

@api_router.get("/academic/section-types")
async def get_section_types(
    current_user = Depends(get_current_user)
):
    """Get all section types for the current tenant (creates default catalog if empty)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Check if section types exist for this school
    types = await db.section_types.find({"school_id": school_id}, {"_id": 0}).sort("orden", 1).to_list(50)
    
    # If no types exist, create the default catalog
    if not types:
        for st in DEFAULT_SECTION_TYPES:
            section_type = {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "key": st["key"],
                "label": st["label"],
                "orden": st["orden"],
                "activo": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.section_types.insert_one(section_type)
        
        types = await db.section_types.find({"school_id": school_id}, {"_id": 0}).sort("orden", 1).to_list(50)
    
    return types

@api_router.post("/academic/section-types")
async def create_section_type(
    key: str = Body(...),
    label: str = Body(...),
    current_user = Depends(get_current_user)
):
    """Create a new section type (admin only)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear tipos de sección")
    
    school_id = user["school_id"]
    
    # Check for duplicate key
    existing = await db.section_types.find_one({
        "school_id": school_id,
        "key": key.upper()
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un tipo de sección con esa clave")
    
    # Get next order
    last_type = await db.section_types.find_one(
        {"school_id": school_id},
        sort=[("orden", -1)]
    )
    orden = (last_type["orden"] + 1) if last_type else 1
    
    section_type = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "key": key.upper(),
        "label": label,
        "orden": orden,
        "activo": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.section_types.insert_one(section_type)
    del section_type["_id"]
    
    return {"message": "Tipo de sección creado", "section_type": section_type}

# NOTE: /reorder must be defined BEFORE /{type_id} to avoid route matching issues
@api_router.put("/academic/section-types/reorder")
async def reorder_section_types(
    order: List[str] = Body(..., embed=True, description="List of section type IDs in desired order"),
    current_user = Depends(get_current_user)
):
    """Reorder section types (admin only)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden reordenar tipos de sección")
    
    school_id = user["school_id"]
    
    # Update order for each type
    for idx, type_id in enumerate(order, start=1):
        await db.section_types.update_one(
            {"id": type_id, "school_id": school_id},
            {"$set": {"orden": idx}}
        )
    
    # Return updated list
    types = await db.section_types.find({"school_id": school_id}, {"_id": 0}).sort("orden", 1).to_list(50)
    return {"message": "Orden actualizado", "section_types": types}

@api_router.put("/academic/section-types/{type_id}")
async def update_section_type(
    type_id: str,
    label: str = Body(None),
    activo: bool = Body(None),
    current_user = Depends(get_current_user)
):
    """Update a section type (admin only)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar tipos de sección")
    
    school_id = user["school_id"]
    
    # Find the section type
    section_type = await db.section_types.find_one({
        "id": type_id,
        "school_id": school_id
    })
    if not section_type:
        raise HTTPException(status_code=404, detail="Tipo de sección no encontrado")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if label is not None:
        update_data["label"] = label
    if activo is not None:
        # Check if deactivating - verify no sections are using this type
        if not activo:
            sections_using = await db.sections.count_documents({
                "school_id": school_id,
                "section_type_id": type_id
            })
            if sections_using > 0:
                raise HTTPException(
                    status_code=400, 
                    detail=f"No se puede desactivar: {sections_using} secciones usan este tipo"
                )
        update_data["activo"] = activo
    
    await db.section_types.update_one(
        {"id": type_id},
        {"$set": update_data}
    )
    
    # Get updated record
    updated = await db.section_types.find_one({"id": type_id}, {"_id": 0})
    return {"message": "Tipo de sección actualizado", "section_type": updated}

@api_router.delete("/academic/section-types/{type_id}")
async def delete_section_type(
    type_id: str,
    current_user = Depends(get_current_user)
):
    """Soft delete a section type (admin only) - sets activo=false"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar tipos de sección")
    
    school_id = user["school_id"]
    
    # Find the section type
    section_type = await db.section_types.find_one({
        "id": type_id,
        "school_id": school_id
    })
    if not section_type:
        raise HTTPException(status_code=404, detail="Tipo de sección no encontrado")
    
    # Check if any sections are using this type
    sections_using = await db.sections.count_documents({
        "school_id": school_id,
        "section_type_id": type_id
    })
    if sections_using > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar: {sections_using} secciones usan este tipo. Desactívelo en su lugar."
        )
    
    # Soft delete - just set activo to false
    await db.section_types.update_one(
        {"id": type_id},
        {"$set": {"activo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Tipo de sección desactivado"}


# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - SECCIONES
# ══════════════════════════════════════════════════════════════════════════════

class SectionCreate(BaseModel):
    section_type_id: str  # Changed from nombre to section_type_id
    grado_id: str
    capacidad_maxima: Optional[int] = None
    activo: bool = True

class SectionUpdate(BaseModel):
    section_type_id: Optional[str] = None  # Changed from nombre to section_type_id
    grado_id: Optional[str] = None
    capacidad_maxima: Optional[int] = None
    activo: Optional[bool] = None

@api_router.get("/academic/sections")
async def get_sections(
    grado_id: Optional[str] = None,
    nivel_id: Optional[str] = None,
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all sections for the current tenant"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    query = {"school_id": school_id}
    if grado_id:
        query["grado_id"] = grado_id
    if activo is not None:
        query["activo"] = activo
    
    # If filtering by nivel_id, first get all grades of that level
    if nivel_id:
        grades_in_level = await db.grades.find(
            {"school_id": school_id, "nivel_id": nivel_id},
            {"id": 1}
        ).to_list(100)
        grade_ids = [g["id"] for g in grades_in_level]
        query["grado_id"] = {"$in": grade_ids}
    
    sections = await db.sections.find(query, {"_id": 0}).sort("nombre", 1).to_list(500)
    
    # Load section types for mapping (for backward compatibility)
    section_types = await db.section_types.find({"school_id": school_id}, {"_id": 0}).to_list(50)
    section_types_by_key = {st["key"]: st for st in section_types}
    section_types_by_label = {st["label"]: st for st in section_types}
    
    # Add grade and level info for each section
    grades_cache = {}
    levels_cache = {}
    for section in sections:
        # Backward compatibility: assign section_type_id if not present
        if not section.get("section_type_id") and section.get("nombre"):
            # Try to match by key (uppercase) first, then by label
            nombre_upper = section["nombre"].upper().replace("ÚNICA", "UNICA")
            matched_type = section_types_by_key.get(nombre_upper) or section_types_by_label.get(section["nombre"])
            if matched_type:
                section["section_type_id"] = matched_type["id"]
                # Update the record in DB for future requests
                await db.sections.update_one(
                    {"id": section["id"]},
                    {"$set": {"section_type_id": matched_type["id"]}}
                )
        
        # Get grade info
        if section["grado_id"] not in grades_cache:
            grade = await db.grades.find_one({"id": section["grado_id"]}, {"_id": 0, "nombre": 1, "nivel_id": 1})
            grades_cache[section["grado_id"]] = grade
        grade_info = grades_cache[section["grado_id"]]
        section["grado_nombre"] = grade_info["nombre"] if grade_info else "Sin grado"
        
        # Get level info
        if grade_info and grade_info.get("nivel_id"):
            nivel_id = grade_info["nivel_id"]
            if nivel_id not in levels_cache:
                level = await db.academic_levels.find_one({"id": nivel_id}, {"_id": 0, "nombre": 1})
                levels_cache[nivel_id] = level
            level_info = levels_cache[nivel_id]
            section["nivel_id"] = nivel_id
            section["nivel_nombre"] = level_info["nombre"] if level_info else "Sin nivel"
        else:
            section["nivel_id"] = None
            section["nivel_nombre"] = "Sin nivel"
        
        # TODO: Add student count when that module is implemented
        section["student_count"] = 0
    
    return sections

@api_router.post("/academic/sections")
async def create_section(
    data: SectionCreate,
    current_user = Depends(get_current_user)
):
    """Create a new section"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear secciones")
    
    school_id = user["school_id"]
    
    # Verify grade exists
    grade = await db.grades.find_one({
        "id": data.grado_id,
        "school_id": school_id
    })
    if not grade:
        raise HTTPException(status_code=400, detail="El grado no existe")
    
    # Verify section type exists
    section_type = await db.section_types.find_one({
        "id": data.section_type_id,
        "school_id": school_id
    })
    if not section_type:
        raise HTTPException(status_code=400, detail="El tipo de sección no existe")
    
    # Check for duplicate: same section type in the same grade
    existing = await db.sections.find_one({
        "school_id": school_id,
        "grado_id": data.grado_id,
        "section_type_id": data.section_type_id
    })
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Ya existe la sección '{section_type['label']}' en este grado"
        )
    
    section = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "section_type_id": data.section_type_id,
        "nombre": section_type["label"],  # Store label for display
        "grado_id": data.grado_id,
        "capacidad_maxima": data.capacidad_maxima,
        "activo": data.activo,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sections.insert_one(section)
    section.pop("_id", None)
    
    # Add grade and level info
    section["grado_nombre"] = grade["nombre"]
    level = await db.academic_levels.find_one({"id": grade["nivel_id"]}, {"_id": 0, "nombre": 1})
    section["nivel_id"] = grade["nivel_id"]
    section["nivel_nombre"] = level["nombre"] if level else "Sin nivel"
    section["student_count"] = 0
    
    return {"message": "Sección creada correctamente", "section": section}

@api_router.put("/academic/sections/{section_id}")
async def update_section(
    section_id: str,
    data: SectionUpdate,
    current_user = Depends(get_current_user)
):
    """Update a section"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar secciones")
    
    school_id = user["school_id"]
    
    # Find the section
    section = await db.sections.find_one({
        "id": section_id,
        "school_id": school_id
    })
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    
    # If changing grade, verify new grade exists
    new_grado_id = data.grado_id if data.grado_id else section["grado_id"]
    if data.grado_id and data.grado_id != section["grado_id"]:
        grade = await db.grades.find_one({
            "id": data.grado_id,
            "school_id": school_id
        })
        if not grade:
            raise HTTPException(status_code=400, detail="El grado no existe")
    
    # If changing section type, verify and check duplicates
    new_section_type_id = data.section_type_id if data.section_type_id else section.get("section_type_id")
    if data.section_type_id:
        section_type = await db.section_types.find_one({
            "id": data.section_type_id,
            "school_id": school_id
        })
        if not section_type:
            raise HTTPException(status_code=400, detail="El tipo de sección no existe")
        
        # Check for duplicate: same section type in the same grade
        if new_section_type_id != section.get("section_type_id") or new_grado_id != section["grado_id"]:
            existing = await db.sections.find_one({
                "school_id": school_id,
                "grado_id": new_grado_id,
                "section_type_id": new_section_type_id,
                "id": {"$ne": section_id}
            })
            if existing:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Ya existe la sección '{section_type['label']}' en este grado"
                )
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.section_type_id is not None:
        section_type = await db.section_types.find_one({"id": data.section_type_id, "school_id": school_id})
        if section_type:
            update_data["section_type_id"] = data.section_type_id
            update_data["nombre"] = section_type["label"]
    if data.grado_id is not None:
        update_data["grado_id"] = data.grado_id
    if data.capacidad_maxima is not None:
        update_data["capacidad_maxima"] = data.capacidad_maxima
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.sections.update_one({"id": section_id}, {"$set": update_data})
    
    # Get updated section with grade and level info
    updated_section = await db.sections.find_one({"id": section_id}, {"_id": 0})
    grade = await db.grades.find_one({"id": updated_section["grado_id"]}, {"_id": 0})
    updated_section["grado_nombre"] = grade["nombre"] if grade else "Sin grado"
    if grade:
        level = await db.academic_levels.find_one({"id": grade["nivel_id"]}, {"_id": 0, "nombre": 1})
        updated_section["nivel_id"] = grade["nivel_id"]
        updated_section["nivel_nombre"] = level["nombre"] if level else "Sin nivel"
    updated_section["student_count"] = 0
    
    return {"message": "Sección actualizada correctamente", "section": updated_section}

@api_router.delete("/academic/sections/{section_id}")
async def delete_section(
    section_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a section (only if no students are enrolled)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar secciones")
    
    # Find the section
    section = await db.sections.find_one({
        "id": section_id,
        "school_id": user["school_id"]
    })
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    
    # TODO: Check for enrolled students when that module is implemented
    # student_count = await db.enrollments.count_documents({"section_id": section_id})
    # if student_count > 0:
    #     raise HTTPException(status_code=400, detail=f"No se puede eliminar la sección porque tiene {student_count} estudiante(s) matriculado(s)")
    
    await db.sections.delete_one({"id": section_id})
    
    return {"message": "Sección eliminada correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - TURNOS
# ══════════════════════════════════════════════════════════════════════════════

class ShiftCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    hora_inicio: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    hora_fin: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    color: Optional[str] = "#3B82F6"
    activo: bool = True

class ShiftUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    hora_inicio: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    hora_fin: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    color: Optional[str] = None
    activo: Optional[bool] = None

@api_router.get("/academic/shifts")
async def get_shifts(
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all shifts for the current tenant"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    if activo is not None:
        query["activo"] = activo
    
    shifts = await db.shifts.find(query, {"_id": 0}).sort("hora_inicio", 1).to_list(50)
    
    return shifts

@api_router.post("/academic/shifts")
async def create_shift(
    data: ShiftCreate,
    current_user = Depends(get_current_user)
):
    """Create a new shift"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear turnos")
    
    # Check for duplicate name
    existing = await db.shifts.find_one({
        "school_id": user["school_id"],
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un turno con ese nombre")
    
    # Validate time range
    if data.hora_inicio >= data.hora_fin:
        raise HTTPException(status_code=400, detail="La hora de inicio debe ser menor que la hora de fin")
    
    shift = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "nombre": data.nombre,
        "hora_inicio": data.hora_inicio,
        "hora_fin": data.hora_fin,
        "color": data.color or "#3B82F6",
        "activo": data.activo,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.shifts.insert_one(shift)
    shift.pop("_id", None)
    
    return {"message": "Turno creado correctamente", "shift": shift}

@api_router.put("/academic/shifts/{shift_id}")
async def update_shift(
    shift_id: str,
    data: ShiftUpdate,
    current_user = Depends(get_current_user)
):
    """Update a shift"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar turnos")
    
    # Find the shift
    shift = await db.shifts.find_one({
        "id": shift_id,
        "school_id": user["school_id"]
    })
    if not shift:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    
    # Check for duplicate name if name is being changed
    if data.nombre and data.nombre.lower() != shift["nombre"].lower():
        existing = await db.shifts.find_one({
            "school_id": user["school_id"],
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": shift_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un turno con ese nombre")
    
    # Validate time range if times are being changed
    new_hora_inicio = data.hora_inicio if data.hora_inicio else shift["hora_inicio"]
    new_hora_fin = data.hora_fin if data.hora_fin else shift["hora_fin"]
    if new_hora_inicio >= new_hora_fin:
        raise HTTPException(status_code=400, detail="La hora de inicio debe ser menor que la hora de fin")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.hora_inicio is not None:
        update_data["hora_inicio"] = data.hora_inicio
    if data.hora_fin is not None:
        update_data["hora_fin"] = data.hora_fin
    if data.color is not None:
        update_data["color"] = data.color
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.shifts.update_one({"id": shift_id}, {"$set": update_data})
    
    updated_shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    
    return {"message": "Turno actualizado correctamente", "shift": updated_shift}

@api_router.delete("/academic/shifts/{shift_id}")
async def delete_shift(
    shift_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a shift"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar turnos")
    
    # Find the shift
    shift = await db.shifts.find_one({
        "id": shift_id,
        "school_id": user["school_id"]
    })
    if not shift:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    
    # TODO: Check if shift is in use (schedules, etc.) when that module is implemented
    
    await db.shifts.delete_one({"id": shift_id})
    
    return {"message": "Turno eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC SETTINGS - PERÍODOS ACADÉMICOS
# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC YEARS & PERIODS MODELS (Premium SaaS Architecture)
# ══════════════════════════════════════════════════════════════════════════════

class AcademicYearCreate(BaseModel):
    year: int = Field(..., ge=2020, le=2100)
    status: Literal["activo", "futuro", "cerrado"] = "futuro"
    clone_from_year: Optional[int] = None  # Optional: clone periods from this year

class AcademicYearUpdate(BaseModel):
    year: Optional[int] = None
    status: Optional[Literal["activo", "futuro", "cerrado"]] = None

class AcademicPeriodCreate(BaseModel):
    academic_year_id: str = Field(...)  # Required: FK to academic year
    nombre: str = Field(..., min_length=1, max_length=100)
    fecha_inicio: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    fecha_fin: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    activo: bool = False

class AcademicPeriodUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    fecha_inicio: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    fecha_fin: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    activo: Optional[bool] = None

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC YEARS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/academic/years")
async def get_academic_years(
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all academic years for the current tenant"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    if status:
        query["status"] = status
    
    years = await db.academic_years.find(query, {"_id": 0}).sort("year", -1).to_list(50)
    
    # Count periods for each year
    for year in years:
        period_count = await db.academic_periods.count_documents({
            "school_id": user["school_id"],
            "academic_year_id": year["id"]
        })
        year["period_count"] = period_count
        
        # Get active period name if exists
        active_period = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "academic_year_id": year["id"],
            "activo": True
        }, {"_id": 0, "nombre": 1})
        year["active_period_name"] = active_period["nombre"] if active_period else None
    
    return years

@api_router.get("/academic/years/active")
async def get_active_academic_year(current_user = Depends(get_current_user)):
    """Get the currently active academic year"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    year = await db.academic_years.find_one(
        {"school_id": user["school_id"], "status": "activo"},
        {"_id": 0}
    )
    
    if not year:
        return {"active_year": None, "message": "No hay año académico activo"}
    
    return {"active_year": year}

@api_router.post("/academic/years")
async def create_academic_year(
    data: AcademicYearCreate,
    current_user = Depends(get_current_user)
):
    """Create a new academic year with optional period cloning"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear años académicos")
    
    school_id = user["school_id"]
    
    # Check for duplicate year
    existing = await db.academic_years.find_one({
        "school_id": school_id,
        "year": data.year
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"El año académico {data.year} ya existe")
    
    deactivated_year = None
    # If setting as active, deactivate current active year (set to cerrado)
    if data.status == "activo":
        current_active = await db.academic_years.find_one({
            "school_id": school_id,
            "status": "activo"
        })
        if current_active:
            await db.academic_years.update_one(
                {"id": current_active["id"]},
                {"$set": {"status": "cerrado", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            deactivated_year = current_active["year"]
    
    academic_year = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "year": data.year,
        "status": data.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.academic_years.insert_one(academic_year)
    del academic_year["_id"]
    
    # Clone periods from another year if requested
    cloned_periods = []
    if data.clone_from_year:
        source_year = await db.academic_years.find_one({
            "school_id": school_id,
            "year": data.clone_from_year
        })
        if source_year:
            source_periods = await db.academic_periods.find({
                "school_id": school_id,
                "academic_year_id": source_year["id"]
            }, {"_id": 0}).sort("orden", 1).to_list(20)
            
            for idx, sp in enumerate(source_periods, start=1):
                new_period = {
                    "id": str(uuid.uuid4()),
                    "school_id": school_id,
                    "academic_year_id": academic_year["id"],
                    "nombre": sp["nombre"],  # Just the name without year (e.g., "Bimestre I")
                    "fecha_inicio": None,  # Empty for editing
                    "fecha_fin": None,
                    "orden": sp.get("orden", idx),
                    "activo": False,  # Always inactive when cloned
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await db.academic_periods.insert_one(new_period)
                del new_period["_id"]
                cloned_periods.append(new_period)
    
    response = {
        "message": f"Año académico {data.year} creado correctamente",
        "academic_year": academic_year
    }
    
    if cloned_periods:
        response["cloned_periods"] = cloned_periods
        response["message"] += f". Se clonaron {len(cloned_periods)} períodos del año {data.clone_from_year}."
    
    if deactivated_year:
        response["deactivated_year"] = deactivated_year
        response["message"] = f"Año {data.year} activado. El año {deactivated_year} ha sido cerrado."
    
    return response

@api_router.put("/academic/years/{year_id}")
async def update_academic_year(
    year_id: str,
    data: AcademicYearUpdate,
    current_user = Depends(get_current_user)
):
    """Update an academic year status or year number"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar años académicos")
    
    school_id = user["school_id"]
    
    year = await db.academic_years.find_one({
        "id": year_id,
        "school_id": school_id
    })
    if not year:
        raise HTTPException(status_code=404, detail="Año académico no encontrado")
    
    # If changing year number, check it doesn't already exist
    if data.year is not None and data.year != year["year"]:
        existing = await db.academic_years.find_one({
            "school_id": school_id,
            "year": data.year,
            "id": {"$ne": year_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"El año {data.year} ya existe")
    
    deactivated_year = None
    # If setting to active, close current active year
    if data.status == "activo" and year["status"] != "activo":
        current_active = await db.academic_years.find_one({
            "school_id": school_id,
            "status": "activo",
            "id": {"$ne": year_id}
        })
        if current_active:
            await db.academic_years.update_one(
                {"id": current_active["id"]},
                {"$set": {"status": "cerrado", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            deactivated_year = current_active["year"]
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.year is not None:
        update_data["year"] = data.year
    if data.status is not None:
        update_data["status"] = data.status
    
    await db.academic_years.update_one(
        {"id": year_id},
        {"$set": update_data}
    )
    
    updated_year = await db.academic_years.find_one({"id": year_id}, {"_id": 0})
    
    response = {"message": "Año académico actualizado", "academic_year": updated_year}
    if deactivated_year:
        response["deactivated_year"] = deactivated_year
        response["message"] = f"Año {year['year']} activado. El año {deactivated_year} ha sido cerrado."
    
    return response

@api_router.get("/academic/years/{year_id}/can-delete")
async def check_year_can_delete(
    year_id: str,
    current_user = Depends(get_current_user)
):
    """Check if an academic year can be safely deleted and return dependency info"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    year = await db.academic_years.find_one({
        "id": year_id,
        "school_id": school_id
    }, {"_id": 0})
    
    if not year:
        raise HTTPException(status_code=404, detail="Año académico no encontrado")
    
    # Count all dependencies
    dependencies = {
        "periods": await db.academic_periods.count_documents({"school_id": school_id, "academic_year_id": year_id}),
        "assignments": await db.academic_assignments.count_documents({"school_id": school_id, "academic_year_id": year_id}),
        "course_posts": await db.course_posts.count_documents({"school_id": school_id, "academic_year_id": year_id}),
    }
    
    # Check if there are any dependencies
    has_dependencies = any(count > 0 for count in dependencies.values())
    
    # Determine if can be deleted
    can_delete = (
        year["status"] == "futuro" and 
        not has_dependencies
    )
    
    # Build reason message
    reasons = []
    if year["status"] == "activo":
        reasons.append("El año está activo. Debe activar otro año primero.")
    elif year["status"] == "cerrado":
        reasons.append("El año está cerrado y contiene datos históricos.")
    
    if dependencies["periods"] > 0:
        reasons.append(f"Tiene {dependencies['periods']} período(s) académico(s) configurado(s).")
    if dependencies["assignments"] > 0:
        reasons.append(f"Tiene {dependencies['assignments']} asignación(es) docente(s).")
    if dependencies["course_posts"] > 0:
        reasons.append(f"Tiene {dependencies['course_posts']} publicación(es) en cursos.")
    
    return {
        "can_delete": can_delete,
        "year": year,
        "dependencies": dependencies,
        "has_dependencies": has_dependencies,
        "reasons": reasons,
        "recommended_action": "delete" if can_delete else ("close" if year["status"] == "activo" else "archive")
    }


@api_router.delete("/academic/years/{year_id}")
async def delete_academic_year(
    year_id: str,
    current_user = Depends(get_current_user)
):
    """
    Delete an academic year - ONLY if it's in 'futuro' status with NO dependencies.
    This is a safe delete for years created by mistake and never used.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar años académicos")
    
    school_id = user["school_id"]
    
    year = await db.academic_years.find_one({
        "id": year_id,
        "school_id": school_id
    })
    if not year:
        raise HTTPException(status_code=404, detail="Año académico no encontrado")
    
    # RULE 1: Cannot delete active years
    if year["status"] == "activo":
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar un año académico activo. Los años activos deben cerrarse primero."
        )
    
    # RULE 2: Cannot delete closed years (historical data)
    if year["status"] == "cerrado":
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar un año académico cerrado. Los datos históricos deben preservarse. Puede archivar el año en su lugar."
        )
    
    # RULE 3: Check for ANY dependencies
    dependencies = {
        "periods": await db.academic_periods.count_documents({"school_id": school_id, "academic_year_id": year_id}),
        "assignments": await db.academic_assignments.count_documents({"school_id": school_id, "academic_year_id": year_id}),
        "course_posts": await db.course_posts.count_documents({"school_id": school_id, "academic_year_id": year_id}),
    }
    
    has_dependencies = any(count > 0 for count in dependencies.values())
    
    if has_dependencies:
        detail_parts = ["Este año académico no puede eliminarse porque tiene información asociada:"]
        if dependencies["periods"] > 0:
            detail_parts.append(f"• {dependencies['periods']} período(s) académico(s)")
        if dependencies["assignments"] > 0:
            detail_parts.append(f"• {dependencies['assignments']} asignación(es) docente(s)")
        if dependencies["course_posts"] > 0:
            detail_parts.append(f"• {dependencies['course_posts']} publicación(es) en cursos")
        detail_parts.append("Elimine primero los datos asociados o cierre el año en su lugar.")
        
        raise HTTPException(status_code=400, detail=" ".join(detail_parts))
    
    # SAFE TO DELETE: Status is 'futuro' and no dependencies
    await db.academic_years.delete_one({"id": year_id})
    
    return {
        "message": f"Año académico {year['year']} eliminado correctamente",
        "deleted_year": year["year"]
    }

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC PERIODS ENDPOINTS (Modified for Year dependency)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/academic/periods")
async def get_academic_periods(
    academic_year_id: Optional[str] = None,
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all academic periods for the current tenant, optionally filtered by year"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    query = {"school_id": school_id}
    
    if academic_year_id:
        query["academic_year_id"] = academic_year_id
    if activo is not None:
        query["activo"] = activo
    
    periods = await db.academic_periods.find(query, {"_id": 0}).sort([("orden", 1), ("fecha_inicio", -1)]).to_list(100)
    
    # Enrich with year info
    year_ids = list(set([p.get("academic_year_id") for p in periods if p.get("academic_year_id")]))
    years_map = {}
    if year_ids:
        years = await db.academic_years.find({"id": {"$in": year_ids}}, {"_id": 0, "id": 1, "year": 1, "status": 1}).to_list(50)
        years_map = {y["id"]: y for y in years}
    
    for period in periods:
        year_data = years_map.get(period.get("academic_year_id"))
        if year_data:
            period["year"] = year_data["year"]
            period["year_status"] = year_data["status"]
        else:
            # Legacy period without year - try to extract from name
            period["year"] = None
            period["year_status"] = None
    
    return periods

@api_router.get("/academic/periods/active")
async def get_active_academic_period(current_user = Depends(get_current_user)):
    """Get the currently active academic period for the tenant"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    period = await db.academic_periods.find_one(
        {"school_id": user["school_id"], "activo": True},
        {"_id": 0}
    )
    
    if not period:
        return {"active_period": None, "message": "No hay período académico activo"}
    
    return {"active_period": period}

@api_router.post("/academic/periods")
async def create_academic_period(
    data: AcademicPeriodCreate,
    current_user = Depends(get_current_user)
):
    """Create a new academic period within an academic year"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear períodos")
    
    school_id = user["school_id"]
    
    # Validate academic year exists
    academic_year = await db.academic_years.find_one({
        "id": data.academic_year_id,
        "school_id": school_id
    })
    if not academic_year:
        raise HTTPException(status_code=404, detail="Año académico no encontrado")
    
    # Validate date range if both dates provided
    if data.fecha_inicio and data.fecha_fin:
        if data.fecha_inicio >= data.fecha_fin:
            raise HTTPException(status_code=400, detail="La fecha de inicio debe ser anterior a la fecha de fin")
    
    # Check for duplicate name within the same year
    existing = await db.academic_periods.find_one({
        "school_id": school_id,
        "academic_year_id": data.academic_year_id,
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe un período '{data.nombre}' en el año {academic_year['year']}")
    
    # Check for overlapping dates within the same year (only if dates provided)
    if data.fecha_inicio and data.fecha_fin:
        overlapping = await db.academic_periods.find_one({
            "school_id": school_id,
            "academic_year_id": data.academic_year_id,
            "fecha_inicio": {"$ne": None},
            "fecha_fin": {"$ne": None},
            "$or": [
                {"fecha_inicio": {"$lte": data.fecha_inicio}, "fecha_fin": {"$gte": data.fecha_inicio}},
                {"fecha_inicio": {"$lte": data.fecha_fin}, "fecha_fin": {"$gte": data.fecha_fin}},
                {"fecha_inicio": {"$gte": data.fecha_inicio}, "fecha_fin": {"$lte": data.fecha_fin}}
            ]
        })
        if overlapping:
            raise HTTPException(
                status_code=400, 
                detail=f"Las fechas se solapan con el período '{overlapping['nombre']}'"
            )
    
    deactivated_period = None
    # If setting as active, deactivate any currently active period in ANY year
    if data.activo:
        current_active = await db.academic_periods.find_one({
            "school_id": school_id,
            "activo": True
        })
        if current_active:
            await db.academic_periods.update_one(
                {"id": current_active["id"]},
                {"$set": {"activo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            deactivated_period = current_active["nombre"]
    
    # Get next order number
    max_order = await db.academic_periods.find_one(
        {"school_id": school_id, "academic_year_id": data.academic_year_id},
        sort=[("orden", -1)]
    )
    next_order = (max_order.get("orden", 0) + 1) if max_order else 1
    
    period = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "academic_year_id": data.academic_year_id,
        "nombre": data.nombre,
        "fecha_inicio": data.fecha_inicio,
        "fecha_fin": data.fecha_fin,
        "orden": next_order,
        "activo": data.activo,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.academic_periods.insert_one(period)
    period.pop("_id", None)
    
    # Add year info to response
    period["year"] = academic_year["year"]
    
    response = {"message": "Período creado correctamente", "period": period}
    if deactivated_period:
        response["deactivated_period"] = deactivated_period
        response["message"] = f"Período creado y activado. El período '{deactivated_period}' ha sido desactivado."
    
    return response

@api_router.put("/academic/periods/{period_id}")
async def update_academic_period(
    period_id: str,
    data: AcademicPeriodUpdate,
    current_user = Depends(get_current_user)
):
    """Update an academic period"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar períodos")
    
    # Find the period
    period = await db.academic_periods.find_one({
        "id": period_id,
        "school_id": user["school_id"]
    })
    if not period:
        raise HTTPException(status_code=404, detail="Período no encontrado")
    
    # Calculate new values
    new_fecha_inicio = data.fecha_inicio if data.fecha_inicio else period["fecha_inicio"]
    new_fecha_fin = data.fecha_fin if data.fecha_fin else period["fecha_fin"]
    
    # Validate date range
    if new_fecha_inicio >= new_fecha_fin:
        raise HTTPException(status_code=400, detail="La fecha de inicio debe ser anterior a la fecha de fin")
    
    # Check for duplicate name if name is being changed (only within the same academic year)
    if data.nombre and data.nombre.lower() != period["nombre"].lower():
        existing = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "academic_year_id": period["academic_year_id"],  # Only check within the same academic year
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": period_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un período con ese nombre en este año académico")
    
    # Check for overlapping dates if dates are being changed (only within the same academic year)
    if data.fecha_inicio or data.fecha_fin:
        overlapping = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "academic_year_id": period["academic_year_id"],  # Only check within the same academic year
            "id": {"$ne": period_id},
            "fecha_inicio": {"$ne": None},
            "fecha_fin": {"$ne": None},
            "$or": [
                {"fecha_inicio": {"$lte": new_fecha_inicio}, "fecha_fin": {"$gte": new_fecha_inicio}},
                {"fecha_inicio": {"$lte": new_fecha_fin}, "fecha_fin": {"$gte": new_fecha_fin}},
                {"fecha_inicio": {"$gte": new_fecha_inicio}, "fecha_fin": {"$lte": new_fecha_fin}}
            ]
        })
        if overlapping:
            raise HTTPException(
                status_code=400, 
                detail=f"Las fechas se solapan con el período '{overlapping['nombre']}' ({overlapping['fecha_inicio']} - {overlapping['fecha_fin']})"
            )
    
    deactivated_period = None
    # If activating this period, deactivate any other active period
    if data.activo is True and not period["activo"]:
        current_active = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "activo": True,
            "id": {"$ne": period_id}
        })
        if current_active:
            await db.academic_periods.update_one(
                {"id": current_active["id"]},
                {"$set": {"activo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            deactivated_period = current_active["nombre"]
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.fecha_inicio is not None:
        update_data["fecha_inicio"] = data.fecha_inicio
    if data.fecha_fin is not None:
        update_data["fecha_fin"] = data.fecha_fin
    if data.activo is not None:
        update_data["activo"] = data.activo
    
    await db.academic_periods.update_one({"id": period_id}, {"$set": update_data})
    
    updated_period = await db.academic_periods.find_one({"id": period_id}, {"_id": 0})
    
    response = {"message": "Período actualizado correctamente", "period": updated_period}
    if deactivated_period:
        response["deactivated_period"] = deactivated_period
        response["message"] = f"Período activado. El período '{deactivated_period}' ha sido desactivado."
    
    return response

@api_router.post("/academic/periods/{period_id}/activate")
async def activate_academic_period(
    period_id: str,
    current_user = Depends(get_current_user)
):
    """Activate an academic period (deactivates any other active period)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden activar períodos")
    
    # Find the period
    period = await db.academic_periods.find_one({
        "id": period_id,
        "school_id": user["school_id"]
    })
    if not period:
        raise HTTPException(status_code=404, detail="Período no encontrado")
    
    if period["activo"]:
        return {"message": "El período ya está activo", "period": period}
    
    # Deactivate any currently active period
    deactivated_period = None
    current_active = await db.academic_periods.find_one({
        "school_id": user["school_id"],
        "activo": True
    })
    if current_active:
        await db.academic_periods.update_one(
            {"id": current_active["id"]},
            {"$set": {"activo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        deactivated_period = current_active["nombre"]
    
    # Activate this period
    await db.academic_periods.update_one(
        {"id": period_id},
        {"$set": {"activo": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_period = await db.academic_periods.find_one({"id": period_id}, {"_id": 0})
    
    response = {
        "message": f"Período '{period['nombre']}' activado correctamente",
        "period": updated_period
    }
    if deactivated_period:
        response["deactivated_period"] = deactivated_period
        response["message"] = f"Período '{period['nombre']}' activado. El período '{deactivated_period}' ha sido desactivado."
    
    return response

@api_router.delete("/academic/periods/{period_id}")
async def delete_academic_period(
    period_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an academic period (only if not active and not in use)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar períodos")
    
    # Find the period
    period = await db.academic_periods.find_one({
        "id": period_id,
        "school_id": user["school_id"]
    })
    if not period:
        raise HTTPException(status_code=404, detail="Período no encontrado")
    
    # Cannot delete active period
    if period["activo"]:
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar un período activo. Activa otro período primero."
        )
    
    # TODO: Check if period is in use (enrollments, attendance, grades) when those modules are implemented
    # enrollment_count = await db.enrollments.count_documents({"period_id": period_id})
    # if enrollment_count > 0:
    #     raise HTTPException(
    #         status_code=400,
    #         detail=f"No se puede eliminar el período porque tiene {enrollment_count} matrícula(s) asociada(s)"
    #     )
    
    await db.academic_periods.delete_one({"id": period_id})
    
    return {"message": "Período eliminado correctamente"}

class ClonePeriodsRequest(BaseModel):
    source_year_id: str
    target_year_id: str

@api_router.post("/academic/periods/clone")
async def clone_periods_to_year(
    data: ClonePeriodsRequest,
    current_user = Depends(get_current_user)
):
    """Clone periods from one academic year to another."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden clonar períodos")
    
    school_id = user["school_id"]
    
    # Verify source year exists and has periods
    source_year = await db.academic_years.find_one({
        "id": data.source_year_id,
        "school_id": school_id
    })
    if not source_year:
        raise HTTPException(status_code=404, detail="Año origen no encontrado")
    
    # Verify target year exists
    target_year = await db.academic_years.find_one({
        "id": data.target_year_id,
        "school_id": school_id
    })
    if not target_year:
        raise HTTPException(status_code=404, detail="Año destino no encontrado")
    
    # Check if target year already has periods
    existing_periods = await db.academic_periods.count_documents({
        "school_id": school_id,
        "academic_year_id": data.target_year_id
    })
    if existing_periods > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"El año {target_year['year']} ya tiene {existing_periods} período(s). Elimínalos primero si deseas clonar."
        )
    
    # Get source periods
    source_periods = await db.academic_periods.find({
        "school_id": school_id,
        "academic_year_id": data.source_year_id
    }, {"_id": 0}).sort("orden", 1).to_list(20)
    
    if not source_periods:
        raise HTTPException(status_code=400, detail="El año origen no tiene períodos para clonar")
    
    # Calculate year difference for date adjustment
    year_diff = target_year["year"] - source_year["year"]
    
    # Clone periods
    cloned = []
    for sp in source_periods:
        # Adjust dates if present
        new_fecha_inicio = None
        new_fecha_fin = None
        
        if sp.get("fecha_inicio"):
            try:
                fecha = datetime.strptime(sp["fecha_inicio"], "%Y-%m-%d")
                new_fecha_inicio = fecha.replace(year=fecha.year + year_diff).strftime("%Y-%m-%d")
            except:
                new_fecha_inicio = sp["fecha_inicio"]
        
        if sp.get("fecha_fin"):
            try:
                fecha = datetime.strptime(sp["fecha_fin"], "%Y-%m-%d")
                new_fecha_fin = fecha.replace(year=fecha.year + year_diff).strftime("%Y-%m-%d")
            except:
                new_fecha_fin = sp["fecha_fin"]
        
        new_period = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "academic_year_id": data.target_year_id,
            "nombre": sp["nombre"],
            "fecha_inicio": new_fecha_inicio,
            "fecha_fin": new_fecha_fin,
            "orden": sp["orden"],
            "activo": False,  # New periods start inactive
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.academic_periods.insert_one(new_period)
        del new_period["_id"]
        cloned.append(new_period)
    
    return {
        "message": f"Se clonaron {len(cloned)} período(s) del año {source_year['year']} al año {target_year['year']}",
        "cloned_periods": cloned
    }

@api_router.post("/academic/migrate-to-years")
async def migrate_periods_to_years(
    current_user = Depends(get_current_user)
):
    """
    Migration endpoint: Convert legacy periods to the new AcademicYear + AcademicPeriod structure.
    - Creates academic years based on period names (extracts year from "Bimestre I - 2025")
    - Assigns periods to their respective years
    - Cleans period names (removes year suffix)
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar migraciones")
    
    school_id = user["school_id"]
    
    # Get all periods without academic_year_id
    legacy_periods = await db.academic_periods.find({
        "school_id": school_id,
        "$or": [
            {"academic_year_id": {"$exists": False}},
            {"academic_year_id": None}
        ]
    }, {"_id": 0}).to_list(100)
    
    if not legacy_periods:
        return {
            "message": "No hay períodos para migrar",
            "migrated_count": 0,
            "years_created": []
        }
    
    years_created = []
    periods_migrated = []
    warnings = []
    
    # Get existing academic years
    existing_years = await db.academic_years.find({"school_id": school_id}, {"_id": 0}).to_list(50)
    years_map = {y["year"]: y for y in existing_years}
    
    # Get active year for fallback
    active_year = await db.academic_years.find_one({"school_id": school_id, "status": "activo"})
    
    for period in legacy_periods:
        nombre = period.get("nombre", "")
        
        # Try to extract year from name (e.g., "Bimestre I - 2025" -> 2025)
        year_match = re.search(r'\b(20\d{2})\b', nombre)
        
        if year_match:
            year = int(year_match.group(1))
            # Clean the period name (remove year and separators)
            clean_name = re.sub(r'\s*[-–]\s*(20\d{2})', '', nombre).strip()
        elif active_year:
            # Fallback to active year
            year = active_year["year"]
            clean_name = nombre
            warnings.append(f"Período '{nombre}' asignado al año activo {year} (no se pudo extraer año del nombre)")
        else:
            # Last fallback: current year
            year = datetime.now().year
            clean_name = nombre
            warnings.append(f"Período '{nombre}' asignado al año actual {year} (no hay año activo)")
        
        # Create academic year if doesn't exist
        if year not in years_map:
            new_year = {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "year": year,
                "status": "cerrado" if year < datetime.now().year else "futuro",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.academic_years.insert_one(new_year)
            del new_year["_id"]
            years_map[year] = new_year
            years_created.append(year)
        
        # Update period with academic_year_id and clean name
        await db.academic_periods.update_one(
            {"id": period["id"]},
            {"$set": {
                "academic_year_id": years_map[year]["id"],
                "nombre": clean_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        periods_migrated.append({
            "original_name": nombre,
            "new_name": clean_name,
            "assigned_year": year
        })
    
    return {
        "message": f"Migración completada: {len(periods_migrated)} períodos migrados",
        "migrated_count": len(periods_migrated),
        "years_created": years_created,
        "periods_migrated": periods_migrated,
        "warnings": warnings if warnings else None
    }

# ══════════════════════════════════════════════════════════════════════════════
# SCHEDULES API
# ══════════════════════════════════════════════════════════════════════════════

class ScheduleCreate(BaseModel):
    tipo: str  # "clases", "profesores", "examenes"
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    profesor_id: Optional[str] = None
    materia: str
    dia: str
    hora_inicio: str
    hora_fin: str
    aula: Optional[str] = None
    color: Optional[str] = "#3B82F6"

class ScheduleUpdate(BaseModel):
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    profesor_id: Optional[str] = None
    materia: Optional[str] = None
    dia: Optional[str] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    aula: Optional[str] = None
    color: Optional[str] = None

@api_router.get("/schedules")
async def get_schedules(
    tipo: str = "clases",
    grado_id: Optional[str] = None,
    seccion_id: Optional[str] = None,
    profesor_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get schedules filtered by type and criteria"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"], "tipo": tipo}
    
    if grado_id:
        query["grado_id"] = grado_id
    if seccion_id:
        query["seccion_id"] = seccion_id
    if profesor_id:
        query["profesor_id"] = profesor_id
    
    schedules = await db.schedules.find(query, {"_id": 0}).sort("hora_inicio", 1).to_list(500)
    return schedules

@api_router.post("/schedules")
async def create_schedule(
    data: ScheduleCreate,
    current_user = Depends(get_current_user)
):
    """Create a new schedule entry"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar horarios")
    
    # Check for time conflicts
    conflict_query = {
        "school_id": user["school_id"],
        "dia": data.dia,
        "hora_inicio": {"$lt": data.hora_fin},
        "hora_fin": {"$gt": data.hora_inicio}
    }
    
    if data.tipo == "clases" and data.grado_id and data.seccion_id:
        conflict_query["grado_id"] = data.grado_id
        conflict_query["seccion_id"] = data.seccion_id
    elif data.tipo == "profesores" and data.profesor_id:
        conflict_query["profesor_id"] = data.profesor_id
    
    existing = await db.schedules.find_one(conflict_query)
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Conflicto de horario: ya existe una clase en ese horario ({existing['materia']} de {existing['hora_inicio']} a {existing['hora_fin']})"
        )
    
    schedule = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "tipo": data.tipo,
        "grado_id": data.grado_id,
        "seccion_id": data.seccion_id,
        "profesor_id": data.profesor_id,
        "materia": data.materia,
        "dia": data.dia,
        "hora_inicio": data.hora_inicio,
        "hora_fin": data.hora_fin,
        "aula": data.aula,
        "color": data.color,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.schedules.insert_one(schedule)
    if "_id" in schedule:
        del schedule["_id"]
    
    return {"message": "Horario creado correctamente", "schedule": schedule}

@api_router.put("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    current_user = Depends(get_current_user)
):
    """Update a schedule entry"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar horarios")
    
    schedule = await db.schedules.find_one({
        "id": schedule_id,
        "school_id": user["school_id"]
    })
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.schedules.update_one({"id": schedule_id}, {"$set": update_data})
    
    updated = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    return {"message": "Horario actualizado correctamente", "schedule": updated}

@api_router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a schedule entry"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar horarios")
    
    result = await db.schedules.delete_one({
        "id": schedule_id,
        "school_id": user["school_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    
    return {"message": "Horario eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# USER PRESENCE (ONLINE / OFFLINE)
# ══════════════════════════════════════════════════════════════════════════════

# Presence timeout in minutes - user is offline if no heartbeat in this time
PRESENCE_TIMEOUT_MINUTES = 5

@api_router.post("/presence/heartbeat")
async def send_heartbeat(current_user = Depends(get_current_user)):
    """
    Send heartbeat to mark user as online.
    Should be called periodically (every 30-60 seconds) by the frontend.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    now = datetime.now(timezone.utc)
    
    # Upsert presence record
    await db.presence.update_one(
        {"user_id": current_user["sub"]},
        {
            "$set": {
                "user_id": current_user["sub"],
                "school_id": user["school_id"],
                "is_online": True,
                "last_seen": now.isoformat()
            }
        },
        upsert=True
    )
    
    return {"status": "ok", "last_seen": now.isoformat()}

@api_router.get("/presence/users")
async def get_presence_status(current_user = Depends(get_current_user)):
    """
    Get online/offline status for all users in the same school.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    timeout_threshold = now - timedelta(minutes=PRESENCE_TIMEOUT_MINUTES)
    
    # Get all presence records for school
    presence_cursor = db.presence.find(
        {"school_id": school_id},
        {"_id": 0}
    )
    presence_records = await presence_cursor.to_list(length=1000)
    
    # Build presence map with online status based on last_seen
    result = {}
    for p in presence_records:
        last_seen = datetime.fromisoformat(p["last_seen"].replace("Z", "+00:00")) if p.get("last_seen") else None
        is_online = last_seen and last_seen > timeout_threshold if last_seen else False
        result[p["user_id"]] = {
            "is_online": is_online,
            "last_seen": p.get("last_seen")
        }
    
    return {"users": [{"user_id": k, "is_online": v["is_online"], "last_seen": v.get("last_seen")} for k, v in result.items()]}

@api_router.post("/presence/offline")
async def mark_offline(current_user = Depends(get_current_user)):
    """
    Explicitly mark user as offline (called on logout or window close).
    """
    await db.presence.update_one(
        {"user_id": current_user["sub"]},
        {
            "$set": {
                "is_online": False,
                "last_seen": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    return {"status": "ok"}

# ══════════════════════════════════════════════════════════════════════════════
# MESSAGES / INTERNAL COMMUNICATIONS
# ══════════════════════════════════════════════════════════════════════════════

class MessageCreate(BaseModel):
    """Create a new message (chat or mail type)"""
    receiver_id: str
    type: Literal["chat", "mail"] = "chat"
    subject: Optional[str] = None
    message: str
    attachments: Optional[List[dict]] = None  # [{url, name, type, size}]

class MessageUpdate(BaseModel):
    """Update message (mark as read)"""
    read: bool

@api_router.get("/messages/users")
async def get_message_users(current_user = Depends(get_current_user)):
    """
    Get all users in the same school, grouped by role.
    Includes online/offline status and sorts online users first.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    timeout_threshold = now - timedelta(minutes=PRESENCE_TIMEOUT_MINUTES)
    
    # Get all users except current user
    users_cursor = db.users.find(
        {"school_id": school_id, "id": {"$ne": current_user["sub"]}},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    users = await users_cursor.to_list(length=1000)
    
    # Get presence data for all users
    presence_cursor = db.presence.find(
        {"school_id": school_id},
        {"_id": 0}
    )
    presence_records = await presence_cursor.to_list(length=1000)
    
    # Build presence map
    presence_map = {}
    for p in presence_records:
        last_seen = None
        if p.get("last_seen"):
            try:
                last_seen = datetime.fromisoformat(p["last_seen"].replace("Z", "+00:00"))
            except:
                pass
        is_online = last_seen and last_seen > timeout_threshold if last_seen else False
        presence_map[p["user_id"]] = {
            "is_online": is_online,
            "last_seen": p.get("last_seen")
        }
    
    # Group by role
    role_order = ["owner", "admin", "director", "teacher", "parent", "student"]
    role_labels = {
        "owner": "Directores",
        "admin": "Administradores", 
        "director": "Directores",
        "teacher": "Profesores",
        "parent": "Padres",
        "student": "Estudiantes"
    }
    
    grouped = {}
    for u in users:
        role = u.get("role", "other")
        label = role_labels.get(role, "Otros")
        if label not in grouped:
            grouped[label] = []
        
        # Get presence info
        presence = presence_map.get(u["id"], {"is_online": False, "last_seen": None})
        
        grouped[label].append({
            "id": u["id"],
            "name": u.get("name", ""),
            "last_name": u.get("last_name", ""),
            "full_name": f"{u.get('name', '')} {u.get('last_name', '')}".strip(),
            "email": u.get("email"),
            "role": role,
            "photo_url": u.get("photo_url"),
            "is_online": presence["is_online"],
            "last_seen": presence["last_seen"]
        })
    
    # Sort users within each group: online first, then by name
    for label in grouped:
        grouped[label].sort(key=lambda x: (not x["is_online"], x["full_name"].lower()))
    
    # Return in order
    result = []
    for role in role_order:
        label = role_labels.get(role)
        if label and label in grouped:
            result.append({
                "label": label,
                "users": grouped[label]
            })
            del grouped[label]
    
    # Add any remaining groups
    for label, users_list in grouped.items():
        result.append({"label": label, "users": users_list})
    
    return result

@api_router.get("/messages/chats")
async def get_chat_list(current_user = Depends(get_current_user)):
    """
    Get list of all chat conversations for current user.
    Returns unique conversations with last message preview and presence status.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    user_id = current_user["sub"]
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    timeout_threshold = now - timedelta(minutes=PRESENCE_TIMEOUT_MINUTES)
    
    # Get all chat messages involving current user
    messages = await db.messages.find({
        "school_id": school_id,
        "type": "chat",
        "$or": [
            {"sender_id": user_id},
            {"receiver_id": user_id}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(5000)
    
    # Group by conversation partner
    conversations = {}
    for msg in messages:
        partner_id = msg["receiver_id"] if msg["sender_id"] == user_id else msg["sender_id"]
        
        if partner_id not in conversations:
            conversations[partner_id] = {
                "partner_id": partner_id,
                "last_message": msg["message"][:100] + ("..." if len(msg["message"]) > 100 else ""),
                "last_message_time": msg["created_at"],
                "unread_count": 0,
                "is_sender": msg["sender_id"] == user_id
            }
        
        # Count unread messages sent TO current user
        if msg["receiver_id"] == user_id and not msg.get("read", False):
            conversations[partner_id]["unread_count"] += 1
    
    # Get partner user info
    partner_ids = list(conversations.keys())
    partners = await db.users.find(
        {"id": {"$in": partner_ids}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
    ).to_list(1000)
    
    partners_map = {p["id"]: p for p in partners}
    
    # Get presence data for partners
    presence_cursor = db.presence.find(
        {"user_id": {"$in": partner_ids}},
        {"_id": 0}
    )
    presence_records = await presence_cursor.to_list(length=1000)
    
    presence_map = {}
    for p in presence_records:
        last_seen = None
        if p.get("last_seen"):
            try:
                last_seen = datetime.fromisoformat(p["last_seen"].replace("Z", "+00:00"))
            except:
                pass
        is_online = last_seen and last_seen > timeout_threshold if last_seen else False
        presence_map[p["user_id"]] = {
            "is_online": is_online,
            "last_seen": p.get("last_seen")
        }
    
    # Build result
    result = []
    for partner_id, conv in conversations.items():
        partner = partners_map.get(partner_id, {})
        presence = presence_map.get(partner_id, {"is_online": False, "last_seen": None})
        result.append({
            "partner_id": partner_id,
            "partner_name": f"{partner.get('name', '')} {partner.get('last_name', '')}".strip(),
            "partner_photo": partner.get("photo_url"),
            "partner_role": partner.get("role"),
            "last_message": conv["last_message"],
            "last_message_time": conv["last_message_time"],
            "unread_count": conv["unread_count"],
            "is_sender": conv["is_sender"],
            "is_online": presence["is_online"],
            "last_seen": presence["last_seen"]
        })
    
    # Sort by last message time
    result.sort(key=lambda x: x["last_message_time"], reverse=True)
    
    return result

@api_router.get("/messages/chats/{partner_id}")
async def get_chat_history(partner_id: str, current_user = Depends(get_current_user)):
    """
    Get chat history with a specific user.
    Also marks messages as read. Includes partner's presence status.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    user_id = current_user["sub"]
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    timeout_threshold = now - timedelta(minutes=PRESENCE_TIMEOUT_MINUTES)
    
    # Verify partner exists and is in same school
    partner = await db.users.find_one(
        {"id": partner_id, "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
    )
    if not partner:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Get partner's presence status
    presence_record = await db.presence.find_one(
        {"user_id": partner_id},
        {"_id": 0}
    )
    
    is_online = False
    last_seen = None
    if presence_record and presence_record.get("last_seen"):
        try:
            last_seen_dt = datetime.fromisoformat(presence_record["last_seen"].replace("Z", "+00:00"))
            is_online = last_seen_dt > timeout_threshold
            last_seen = presence_record["last_seen"]
        except:
            pass
    
    # Get all messages between users
    messages = await db.messages.find({
        "school_id": school_id,
        "type": "chat",
        "$or": [
            {"sender_id": user_id, "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": user_id}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    # Mark received messages as read
    await db.messages.update_many(
        {
            "school_id": school_id,
            "type": "chat",
            "sender_id": partner_id,
            "receiver_id": user_id,
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    return {
        "partner": {
            "id": partner["id"],
            "name": f"{partner.get('name', '')} {partner.get('last_name', '')}".strip(),
            "photo_url": partner.get("photo_url"),
            "role": partner.get("role"),
            "is_online": is_online,
            "last_seen": last_seen
        },
        "messages": messages
    }

@api_router.post("/messages/chats/send")
async def send_chat_message(data: MessageCreate, current_user = Depends(get_current_user)):
    """Send a chat message to another user"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Verify receiver exists and is in same school
    receiver = await db.users.find_one(
        {"id": data.receiver_id, "school_id": school_id},
        {"_id": 0, "id": 1}
    )
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")
    
    message = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "sender_id": current_user["sub"],
        "receiver_id": data.receiver_id,
        "type": "chat",
        "subject": None,
        "message": data.message,
        "attachments": data.attachments or [],
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    if "_id" in message:
        del message["_id"]
    
    return {"message": "Mensaje enviado", "data": message}

@api_router.get("/messages/inbox")
async def get_inbox(
    type: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get inbox messages (mail type) for current user.
    Can filter by type: 'received', 'sent', or all.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    user_id = current_user["sub"]
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id, "type": "mail"}
    
    if type == "received":
        query["receiver_id"] = user_id
    elif type == "sent":
        query["sender_id"] = user_id
    else:
        # All messages involving user
        query["$or"] = [
            {"sender_id": user_id},
            {"receiver_id": user_id}
        ]
    
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get user info for senders/receivers
    user_ids = set()
    for msg in messages:
        user_ids.add(msg["sender_id"])
        user_ids.add(msg["receiver_id"])
    
    users_data = await db.users.find(
        {"id": {"$in": list(user_ids)}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
    ).to_list(1000)
    
    users_map = {u["id"]: u for u in users_data}
    
    # Enrich messages with user info
    result = []
    for msg in messages:
        sender = users_map.get(msg["sender_id"], {})
        receiver = users_map.get(msg["receiver_id"], {})
        
        result.append({
            **msg,
            "sender_name": f"{sender.get('name', '')} {sender.get('last_name', '')}".strip(),
            "sender_photo": sender.get("photo_url"),
            "sender_role": sender.get("role"),
            "receiver_name": f"{receiver.get('name', '')} {receiver.get('last_name', '')}".strip(),
            "receiver_photo": receiver.get("photo_url"),
            "receiver_role": receiver.get("role"),
            "is_sent_by_me": msg["sender_id"] == user_id
        })
    
    return result

@api_router.post("/messages/send")
async def send_mail_message(data: MessageCreate, current_user = Depends(get_current_user)):
    """Send a mail-type message (formal internal communication)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Verify receiver exists and is in same school
    receiver = await db.users.find_one(
        {"id": data.receiver_id, "school_id": school_id},
        {"_id": 0, "id": 1}
    )
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")
    
    if not data.subject:
        raise HTTPException(status_code=400, detail="El asunto es requerido para mensajes tipo correo")
    
    message = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "sender_id": current_user["sub"],
        "receiver_id": data.receiver_id,
        "type": "mail",
        "subject": data.subject,
        "message": data.message,
        "attachments": data.attachments or [],
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    if "_id" in message:
        del message["_id"]
    
    logger.info(f"Mail sent from {current_user['sub']} to {data.receiver_id}: {data.subject}")
    
    return {"message": "Mensaje enviado correctamente", "data": message}

@api_router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str, current_user = Depends(get_current_user)):
    """Mark a message as read"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Find message and verify it's for current user
    message = await db.messages.find_one({
        "id": message_id,
        "school_id": user["school_id"],
        "receiver_id": current_user["sub"]
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"read": True}}
    )
    
    return {"message": "Mensaje marcado como leído"}

@api_router.get("/messages/unread-count")
async def get_unread_count(current_user = Depends(get_current_user)):
    """Get total unread message count for current user"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    count = await db.messages.count_documents({
        "school_id": user["school_id"],
        "receiver_id": current_user["sub"],
        "read": False
    })
    
    return {"unread_count": count}

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, current_user = Depends(get_current_user)):
    """Delete a message (only sender can delete)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Find message and verify ownership
    message = await db.messages.find_one({
        "id": message_id,
        "school_id": user["school_id"],
        "sender_id": current_user["sub"]
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado o no tienes permiso")
    
    await db.messages.delete_one({"id": message_id})
    
    return {"message": "Mensaje eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE MODULE
# ══════════════════════════════════════════════════════════════════════════════

class AttendanceRecord(BaseModel):
    """Single attendance record for batch save"""
    user_id: str
    status: Literal["present", "late", "absent", "justified"]

class AttendanceBatchSave(BaseModel):
    """Batch save attendance records"""
    date: str  # ISO date string (YYYY-MM-DD)
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    records: List[AttendanceRecord]

class TeacherAttendanceSave(BaseModel):
    """Save teacher attendance"""
    date: str
    records: List[AttendanceRecord]

# ─────────────────────────────────────────────────────────────────────────────
# STUDENT ATTENDANCE
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/attendance/students")
async def get_students_for_attendance(
    grade_id: str,
    section_id: str,
    date: str,
    current_user = Depends(get_current_user)
):
    """
    Get students for a specific grade/section with their attendance status for the given date.
    If no attendance exists for that date, returns students with default status 'present'.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Get students for this grade/section
    students_cursor = db.users.find(
        {
            "school_id": school_id,
            "role": "student",
            "grado_id": grade_id,
            "seccion_id": section_id
        },
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    students = await students_cursor.to_list(length=500)
    
    # Get existing attendance records for this date
    attendance_cursor = db.attendances.find(
        {
            "school_id": school_id,
            "type": "student",
            "grade_id": grade_id,
            "section_id": section_id,
            "date": date
        },
        {"_id": 0}
    )
    attendance_records = await attendance_cursor.to_list(length=500)
    
    # Build attendance map
    attendance_map = {a["user_id"]: a for a in attendance_records}
    
    # Build result with attendance status
    result = []
    for s in students:
        attendance = attendance_map.get(s["id"])
        result.append({
            "id": s["id"],
            "name": s.get("name", ""),
            "last_name": s.get("last_name", ""),
            "full_name": f"{s.get('name', '')} {s.get('last_name', '')}".strip(),
            "photo_url": s.get("photo_url"),
            "email": s.get("email"),
            "status": attendance["status"] if attendance else "present",  # Default to present
            "has_record": attendance is not None  # Whether a record exists for this date
        })
    
    # Sort by name
    result.sort(key=lambda x: x["full_name"].lower())
    
    return {
        "date": date,
        "grade_id": grade_id,
        "section_id": section_id,
        "students": result,
        "total": len(result),
        "has_saved_records": len(attendance_records) > 0
    }

@api_router.post("/attendance/students/save")
async def save_student_attendance(data: AttendanceBatchSave, current_user = Depends(get_current_user)):
    """
    Save attendance records for students in batch.
    Creates or updates records for the specified date.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Delete existing records for this date/grade/section
    await db.attendances.delete_many({
        "school_id": school_id,
        "type": "student",
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "date": data.date
    })
    
    # Insert new records
    records_to_insert = []
    for record in data.records:
        records_to_insert.append({
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "type": "student",
            "user_id": record.user_id,
            "grade_id": data.grade_id,
            "section_id": data.section_id,
            "date": data.date,
            "status": record.status,
            "recorded_by": current_user["sub"],
            "created_at": now
        })
    
    if records_to_insert:
        await db.attendances.insert_many(records_to_insert)
    
    # Calculate summary
    summary = {"present": 0, "late": 0, "absent": 0}
    for r in data.records:
        if r.status in summary:
            summary[r.status] += 1
    
    logger.info(f"Student attendance saved for {data.date} by {current_user['sub']}: {len(data.records)} records")
    
    return {
        "message": "Asistencia guardada correctamente",
        "date": data.date,
        "total_records": len(data.records),
        "summary": summary
    }

@api_router.get("/attendance/students/history")
async def get_student_attendance_history(
    student_id: str,
    start_date: str,
    end_date: str,
    current_user = Depends(get_current_user)
):
    """Get attendance history for a specific student within a date range."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Get attendance records
    records_cursor = db.attendances.find(
        {
            "school_id": school_id,
            "type": "student",
            "user_id": student_id,
            "date": {"$gte": start_date, "$lte": end_date}
        },
        {"_id": 0}
    ).sort("date", -1)
    
    records = await records_cursor.to_list(length=365)
    
    # Calculate summary
    summary = {"present": 0, "late": 0, "absent": 0, "total_days": len(records)}
    for r in records:
        if r["status"] in summary:
            summary[r["status"]] += 1
    
    return {
        "student_id": student_id,
        "start_date": start_date,
        "end_date": end_date,
        "records": records,
        "summary": summary
    }

# ─────────────────────────────────────────────────────────────────────────────
# TEACHER ATTENDANCE
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/attendance/teachers")
async def get_teachers_for_attendance(
    date: str,
    current_user = Depends(get_current_user)
):
    """
    Get all teachers with their attendance status for the given date.
    If no attendance exists, returns teachers with default status 'present'.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Get all teachers
    teachers_cursor = db.users.find(
        {"school_id": school_id, "role": "teacher"},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    teachers = await teachers_cursor.to_list(length=500)
    
    # Get existing attendance records for this date
    attendance_cursor = db.attendances.find(
        {
            "school_id": school_id,
            "type": "teacher",
            "date": date
        },
        {"_id": 0}
    )
    attendance_records = await attendance_cursor.to_list(length=500)
    
    # Build attendance map
    attendance_map = {a["user_id"]: a for a in attendance_records}
    
    # Build result
    result = []
    for t in teachers:
        attendance = attendance_map.get(t["id"])
        result.append({
            "id": t["id"],
            "name": t.get("name", ""),
            "last_name": t.get("last_name", ""),
            "full_name": f"{t.get('name', '')} {t.get('last_name', '')}".strip(),
            "photo_url": t.get("photo_url"),
            "email": t.get("email"),
            "status": attendance["status"] if attendance else "present",
            "has_record": attendance is not None
        })
    
    # Sort by name
    result.sort(key=lambda x: x["full_name"].lower())
    
    return {
        "date": date,
        "teachers": result,
        "total": len(result),
        "has_saved_records": len(attendance_records) > 0
    }

@api_router.post("/attendance/teachers/save")
async def save_teacher_attendance(data: TeacherAttendanceSave, current_user = Depends(get_current_user)):
    """
    Save attendance records for teachers in batch.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Delete existing records for this date
    await db.attendances.delete_many({
        "school_id": school_id,
        "type": "teacher",
        "date": data.date
    })
    
    # Insert new records
    records_to_insert = []
    for record in data.records:
        records_to_insert.append({
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "type": "teacher",
            "user_id": record.user_id,
            "grade_id": None,
            "section_id": None,
            "date": data.date,
            "status": record.status,
            "recorded_by": current_user["sub"],
            "created_at": now
        })
    
    if records_to_insert:
        await db.attendances.insert_many(records_to_insert)
    
    # Calculate summary
    summary = {"present": 0, "late": 0, "absent": 0, "justified": 0}
    for r in data.records:
        if r.status in summary:
            summary[r.status] += 1
    
    logger.info(f"Teacher attendance saved for {data.date} by {current_user['sub']}: {len(data.records)} records")
    
    return {
        "message": "Asistencia de profesores guardada correctamente",
        "date": data.date,
        "total_records": len(data.records),
        "summary": summary
    }

# ─────────────────────────────────────────────────────────────────────────────
# ATTENDANCE REPORTS
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/attendance/reports/teachers")
async def get_teacher_attendance_report(
    teacher_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get teacher attendance report with summary statistics.
    Can filter by specific teacher and/or date range.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id, "type": "teacher"}
    
    if teacher_id:
        query["user_id"] = teacher_id
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    # Get attendance records
    records_cursor = db.attendances.find(query, {"_id": 0}).sort("date", -1)
    records = await records_cursor.to_list(length=1000)
    
    # Get teacher info
    teacher_ids = list(set(r["user_id"] for r in records))
    teachers_cursor = db.users.find(
        {"id": {"$in": teacher_ids}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}
    )
    teachers = await teachers_cursor.to_list(length=500)
    teachers_map = {t["id"]: t for t in teachers}
    
    # Build report by teacher
    report_by_teacher = {}
    for r in records:
        tid = r["user_id"]
        if tid not in report_by_teacher:
            teacher = teachers_map.get(tid, {})
            report_by_teacher[tid] = {
                "teacher_id": tid,
                "teacher_name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
                "teacher_photo": teacher.get("photo_url"),
                "present": 0,
                "late": 0,
                "absent": 0,
                "justified": 0,
                "total_days": 0,
                "attendance_rate": 0
            }
        
        report_by_teacher[tid]["total_days"] += 1
        if r["status"] in report_by_teacher[tid]:
            report_by_teacher[tid][r["status"]] += 1
    
    # Calculate attendance rate
    for tid, data in report_by_teacher.items():
        if data["total_days"] > 0:
            attended = data["present"] + data["late"] + data["justified"]
            data["attendance_rate"] = round((attended / data["total_days"]) * 100, 1)
    
    # Convert to list and sort by name
    report_list = list(report_by_teacher.values())
    report_list.sort(key=lambda x: x["teacher_name"].lower())
    
    # Overall summary
    overall_summary = {
        "total_records": len(records),
        "present": sum(1 for r in records if r["status"] == "present"),
        "late": sum(1 for r in records if r["status"] == "late"),
        "absent": sum(1 for r in records if r["status"] == "absent"),
        "justified": sum(1 for r in records if r["status"] == "justified")
    }
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "teacher_id": teacher_id,
        "report": report_list,
        "summary": overall_summary,
        "records": records[:100]  # Return last 100 records for detail view
    }

@api_router.get("/attendance/reports/students")
async def get_student_attendance_report(
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get student attendance report with summary statistics.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Build query
    query = {"school_id": school_id, "type": "student"}
    
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    # Get attendance records
    records_cursor = db.attendances.find(query, {"_id": 0}).sort("date", -1)
    records = await records_cursor.to_list(length=5000)
    
    # Get student info
    student_ids = list(set(r["user_id"] for r in records))
    students_cursor = db.users.find(
        {"id": {"$in": student_ids}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}
    )
    students = await students_cursor.to_list(length=1000)
    students_map = {s["id"]: s for s in students}
    
    # Build report by student
    report_by_student = {}
    for r in records:
        sid = r["user_id"]
        if sid not in report_by_student:
            student = students_map.get(sid, {})
            report_by_student[sid] = {
                "student_id": sid,
                "student_name": f"{student.get('name', '')} {student.get('last_name', '')}".strip(),
                "student_photo": student.get("photo_url"),
                "present": 0,
                "late": 0,
                "absent": 0,
                "total_days": 0,
                "attendance_rate": 0
            }
        
        report_by_student[sid]["total_days"] += 1
        if r["status"] in report_by_student[sid]:
            report_by_student[sid][r["status"]] += 1
    
    # Calculate attendance rate
    for sid, data in report_by_student.items():
        if data["total_days"] > 0:
            attended = data["present"] + data["late"]
            data["attendance_rate"] = round((attended / data["total_days"]) * 100, 1)
    
    # Convert to list and sort
    report_list = list(report_by_student.values())
    report_list.sort(key=lambda x: x["student_name"].lower())
    
    # Overall summary
    overall_summary = {
        "total_records": len(records),
        "present": sum(1 for r in records if r["status"] == "present"),
        "late": sum(1 for r in records if r["status"] == "late"),
        "absent": sum(1 for r in records if r["status"] == "absent")
    }
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "grade_id": grade_id,
        "section_id": section_id,
        "report": report_list,
        "summary": overall_summary
    }

# ══════════════════════════════════════════════════════════════════════════════
# CALENDAR MODULE
# ══════════════════════════════════════════════════════════════════════════════

# Event types with default colors
EVENT_TYPES = {
    "academic": {"label": "Académico", "color": "#3B82F6"},      # Blue
    "institutional": {"label": "Institucional", "color": "#8B5CF6"},  # Purple
    "administrative": {"label": "Administrativo", "color": "#64748B"},  # Gray
    "holiday": {"label": "Feriado", "color": "#EF4444"},         # Red
    "special": {"label": "Evento especial", "color": "#F59E0B"},  # Amber
    "communication": {"label": "Comunicación", "color": "#10B981"}  # Green
}

class CalendarEventVisibility(BaseModel):
    """Visibility settings for calendar events"""
    roles: Optional[List[str]] = None  # ["teacher", "student", "parent"]
    grades: Optional[List[str]] = None  # Grade IDs
    sections: Optional[List[str]] = None  # Section IDs

class CalendarEventCreate(BaseModel):
    """Create a calendar event"""
    title: str
    description: Optional[str] = None
    type: Literal["academic", "institutional", "administrative", "holiday", "special", "communication"]
    color: Optional[str] = None
    start_date: str  # ISO date or datetime
    end_date: str
    start_time: Optional[str] = None  # HH:MM format
    end_time: Optional[str] = None
    all_day: bool = True
    visibility: Optional[CalendarEventVisibility] = None

class CalendarEventUpdate(BaseModel):
    """Update a calendar event"""
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    all_day: Optional[bool] = None
    visibility: Optional[CalendarEventVisibility] = None

@api_router.get("/calendar/event-types")
async def get_event_types():
    """Get available event types with their default colors"""
    return EVENT_TYPES

@api_router.get("/calendar/events")
async def get_calendar_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    event_type: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get calendar events filtered by date range and type.
    Events are filtered based on user's role and visibility settings.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    user_grade = user.get("grado_id")
    user_section = user.get("seccion_id")
    
    # Build query
    query = {"school_id": school_id}
    
    # Date range filter
    if start_date and end_date:
        query["$or"] = [
            # Event starts within range
            {"start_date": {"$gte": start_date, "$lte": end_date}},
            # Event ends within range
            {"end_date": {"$gte": start_date, "$lte": end_date}},
            # Event spans the entire range
            {"start_date": {"$lte": start_date}, "end_date": {"$gte": end_date}}
        ]
    elif start_date:
        query["end_date"] = {"$gte": start_date}
    elif end_date:
        query["start_date"] = {"$lte": end_date}
    
    # Type filter
    if event_type:
        query["type"] = event_type
    
    # Get events
    events_cursor = db.calendar_events.find(query, {"_id": 0}).sort("start_date", 1)
    events = await events_cursor.to_list(length=500)
    
    # Filter by visibility (only for non-admin users)
    is_admin = user_role in ["owner", "admin", "director"]
    
    if not is_admin:
        filtered_events = []
        for event in events:
            visibility = event.get("visibility", {})
            
            # If no visibility set, event is public (visible to all)
            if not visibility or (not visibility.get("roles") and not visibility.get("grades") and not visibility.get("sections")):
                filtered_events.append(event)
                continue
            
            # Check role visibility
            visible_roles = visibility.get("roles", [])
            if visible_roles and user_role not in visible_roles:
                continue
            
            # Check grade visibility
            visible_grades = visibility.get("grades", [])
            if visible_grades and user_grade and user_grade not in visible_grades:
                continue
            
            # Check section visibility
            visible_sections = visibility.get("sections", [])
            if visible_sections and user_section and user_section not in visible_sections:
                continue
            
            filtered_events.append(event)
        
        events = filtered_events
    
    # Add type label to each event
    for event in events:
        event_type_info = EVENT_TYPES.get(event.get("type", ""), {})
        event["type_label"] = event_type_info.get("label", event.get("type", ""))
        if not event.get("color"):
            event["color"] = event_type_info.get("color", "#64748B")
    
    return events

@api_router.post("/calendar/events")
async def create_calendar_event(data: CalendarEventCreate, current_user = Depends(get_current_user)):
    """
    Create a new calendar event.
    Only admin/director roles can create events.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check permissions
    user_role = user.get("role", "")
    if user_role not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear eventos")
    
    # Validate dates
    if data.start_date > data.end_date:
        raise HTTPException(status_code=400, detail="La fecha de inicio no puede ser posterior a la fecha de fin")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Get default color if not provided
    color = data.color
    if not color:
        color = EVENT_TYPES.get(data.type, {}).get("color", "#64748B")
    
    # Build visibility object
    visibility = {}
    if data.visibility:
        if data.visibility.roles:
            visibility["roles"] = data.visibility.roles
        if data.visibility.grades:
            visibility["grades"] = data.visibility.grades
        if data.visibility.sections:
            visibility["sections"] = data.visibility.sections
    
    event = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "title": data.title,
        "description": data.description,
        "type": data.type,
        "color": color,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "all_day": data.all_day,
        "visibility": visibility,
        "created_by": current_user["sub"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.calendar_events.insert_one(event)
    if "_id" in event:
        del event["_id"]
    
    # Add type label
    event["type_label"] = EVENT_TYPES.get(data.type, {}).get("label", data.type)
    
    logger.info(f"Calendar event created: {data.title} by {current_user['sub']}")
    
    return {"message": "Evento creado correctamente", "event": event}

@api_router.put("/calendar/events/{event_id}")
async def update_calendar_event(event_id: str, data: CalendarEventUpdate, current_user = Depends(get_current_user)):
    """
    Update a calendar event.
    Only admin/director roles can update events.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check permissions
    user_role = user.get("role", "")
    if user_role not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar eventos")
    
    school_id = user["school_id"]
    
    # Find event
    event = await db.calendar_events.find_one({"id": event_id, "school_id": school_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title
    if data.description is not None:
        update_data["description"] = data.description
    if data.type is not None:
        update_data["type"] = data.type
        # Update color if type changed and no custom color
        if not data.color and data.type in EVENT_TYPES:
            update_data["color"] = EVENT_TYPES[data.type]["color"]
    if data.color is not None:
        update_data["color"] = data.color
    if data.start_date is not None:
        update_data["start_date"] = data.start_date
    if data.end_date is not None:
        update_data["end_date"] = data.end_date
    if data.start_time is not None:
        update_data["start_time"] = data.start_time
    if data.end_time is not None:
        update_data["end_time"] = data.end_time
    if data.all_day is not None:
        update_data["all_day"] = data.all_day
    if data.visibility is not None:
        visibility = {}
        if data.visibility.roles:
            visibility["roles"] = data.visibility.roles
        if data.visibility.grades:
            visibility["grades"] = data.visibility.grades
        if data.visibility.sections:
            visibility["sections"] = data.visibility.sections
        update_data["visibility"] = visibility
    
    # Validate dates
    start = update_data.get("start_date", event["start_date"])
    end = update_data.get("end_date", event["end_date"])
    if start > end:
        raise HTTPException(status_code=400, detail="La fecha de inicio no puede ser posterior a la fecha de fin")
    
    await db.calendar_events.update_one({"id": event_id}, {"$set": update_data})
    
    # Get updated event
    updated_event = await db.calendar_events.find_one({"id": event_id}, {"_id": 0})
    updated_event["type_label"] = EVENT_TYPES.get(updated_event.get("type", ""), {}).get("label", updated_event.get("type", ""))
    
    logger.info(f"Calendar event updated: {event_id} by {current_user['sub']}")
    
    return {"message": "Evento actualizado correctamente", "event": updated_event}

@api_router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(event_id: str, current_user = Depends(get_current_user)):
    """
    Delete a calendar event.
    Only admin/director roles can delete events.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check permissions
    user_role = user.get("role", "")
    if user_role not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar eventos")
    
    school_id = user["school_id"]
    
    # Find and delete event
    result = await db.calendar_events.delete_one({"id": event_id, "school_id": school_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    logger.info(f"Calendar event deleted: {event_id} by {current_user['sub']}")
    
    return {"message": "Evento eliminado correctamente"}

@api_router.get("/calendar/events/{event_id}")
async def get_calendar_event(event_id: str, current_user = Depends(get_current_user)):
    """Get a single calendar event by ID"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    event = await db.calendar_events.find_one({"id": event_id, "school_id": school_id}, {"_id": 0})
    
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    event["type_label"] = EVENT_TYPES.get(event.get("type", ""), {}).get("label", event.get("type", ""))
    
    return event

# ══════════════════════════════════════════════════════════════════════════════
# SURVEYS MODULE - ENCUESTAS INSTITUCIONALES
# ══════════════════════════════════════════════════════════════════════════════

class SurveyCreate(BaseModel):
    """Request to create a new survey"""
    question: str = Field(..., min_length=1, max_length=500)
    options: List[str] = Field(..., min_length=2)
    target_roles: List[str] = []  # Empty means all roles can see
    status: Literal["draft", "active"] = "draft"

class SurveyUpdate(BaseModel):
    """Request to update a survey"""
    question: Optional[str] = Field(None, min_length=1, max_length=500)
    options: Optional[List[str]] = None
    target_roles: Optional[List[str]] = None
    status: Optional[Literal["draft", "active", "closed"]] = None

class SurveyAnswer(BaseModel):
    """Request to answer a survey"""
    option_selected: int  # Index of the option selected

@api_router.get("/surveys")
async def get_surveys(
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get all surveys for the current tenant.
    Admin/directors see all, other users see only active surveys targeting their role.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    # Build query
    query = {"school_id": school_id}
    
    if is_admin:
        # Admins can filter by status
        if status:
            query["status"] = status
    else:
        # Non-admin users can only see active surveys targeting their role
        query["status"] = "active"
        query["$or"] = [
            {"target_roles": {"$size": 0}},  # Empty means all roles
            {"target_roles": user_role}
        ]
    
    surveys_cursor = db.surveys.find(query, {"_id": 0}).sort("created_at", -1)
    surveys = await surveys_cursor.to_list(200)
    
    # Calculate response statistics for each survey
    for survey in surveys:
        # Count total responses
        response_count = await db.survey_answers.count_documents({"survey_id": survey["id"]})
        survey["response_count"] = response_count
        
        # Check if current user has responded
        user_response = await db.survey_answers.find_one({
            "survey_id": survey["id"],
            "user_id": user["id"]
        }, {"_id": 0})
        survey["user_has_responded"] = user_response is not None
        if user_response:
            survey["user_response"] = user_response.get("option_selected")
        
        # Calculate target user count for participation indicator
        if is_admin:
            target_roles = survey.get("target_roles", [])
            if target_roles:
                target_count = await db.users.count_documents({
                    "school_id": school_id,
                    "role": {"$in": target_roles}
                })
            else:
                target_count = await db.users.count_documents({"school_id": school_id})
            survey["target_count"] = target_count
            survey["participation_rate"] = round((response_count / target_count * 100), 1) if target_count > 0 else 0
    
    return surveys

@api_router.get("/surveys/{survey_id}")
async def get_survey(survey_id: str, current_user = Depends(get_current_user)):
    """Get a single survey by ID"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Calculate response count
    response_count = await db.survey_answers.count_documents({"survey_id": survey_id})
    survey["response_count"] = response_count
    
    # Check if current user has responded
    user_response = await db.survey_answers.find_one({
        "survey_id": survey_id,
        "user_id": user["id"]
    }, {"_id": 0})
    survey["user_has_responded"] = user_response is not None
    if user_response:
        survey["user_response"] = user_response.get("option_selected")
    
    return survey

@api_router.post("/surveys")
async def create_survey(data: SurveyCreate, current_user = Depends(get_current_user)):
    """
    Create a new survey.
    Only admin/owner/director can create surveys.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear encuestas")
    
    # Validate options
    if len(data.options) < 2:
        raise HTTPException(status_code=400, detail="La encuesta debe tener al menos 2 opciones")
    
    # Clean empty options
    options = [opt.strip() for opt in data.options if opt.strip()]
    if len(options) < 2:
        raise HTTPException(status_code=400, detail="La encuesta debe tener al menos 2 opciones válidas")
    
    school_id = user["school_id"]
    
    survey = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "question": data.question.strip(),
        "options": options,
        "target_roles": data.target_roles,
        "status": data.status,
        "created_by": user["id"],
        "created_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.surveys.insert_one(survey)
    survey.pop("_id", None)
    survey["response_count"] = 0
    survey["user_has_responded"] = False
    
    logger.info(f"Survey created: {survey['id']} by {user['id']}")
    
    return {"message": "Encuesta creada correctamente", "survey": survey}

@api_router.put("/surveys/{survey_id}")
async def update_survey(survey_id: str, data: SurveyUpdate, current_user = Depends(get_current_user)):
    """
    Update a survey.
    Only admin/owner/director can update surveys.
    Cannot edit surveys that are closed or have responses (if changing options).
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar encuestas")
    
    school_id = user["school_id"]
    
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Cannot edit closed surveys
    if survey.get("status") == "closed":
        raise HTTPException(status_code=400, detail="No se puede editar una encuesta cerrada")
    
    # Check if survey has responses
    response_count = await db.survey_answers.count_documents({"survey_id": survey_id})
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.question is not None:
        update_data["question"] = data.question.strip()
    
    if data.options is not None:
        if response_count > 0:
            raise HTTPException(status_code=400, detail="No se pueden modificar las opciones de una encuesta con respuestas")
        options = [opt.strip() for opt in data.options if opt.strip()]
        if len(options) < 2:
            raise HTTPException(status_code=400, detail="La encuesta debe tener al menos 2 opciones válidas")
        update_data["options"] = options
    
    if data.target_roles is not None:
        update_data["target_roles"] = data.target_roles
    
    if data.status is not None:
        update_data["status"] = data.status
    
    await db.surveys.update_one({"id": survey_id}, {"$set": update_data})
    
    # Get updated survey
    updated_survey = await db.surveys.find_one({"id": survey_id}, {"_id": 0})
    updated_survey["response_count"] = response_count
    
    logger.info(f"Survey updated: {survey_id} by {user['id']}")
    
    return {"message": "Encuesta actualizada correctamente", "survey": updated_survey}

@api_router.put("/surveys/{survey_id}/close")
async def close_survey(survey_id: str, current_user = Depends(get_current_user)):
    """
    Close a survey.
    Only admin/owner/director can close surveys.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden cerrar encuestas")
    
    school_id = user["school_id"]
    
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    if survey.get("status") == "closed":
        raise HTTPException(status_code=400, detail="La encuesta ya está cerrada")
    
    await db.surveys.update_one(
        {"id": survey_id},
        {"$set": {
            "status": "closed",
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Survey closed: {survey_id} by {user['id']}")
    
    return {"message": "Encuesta cerrada correctamente"}

@api_router.delete("/surveys/{survey_id}")
async def delete_survey(survey_id: str, current_user = Depends(get_current_user)):
    """
    Delete a survey and all its responses.
    Only admin/owner/director can delete surveys.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar encuestas")
    
    school_id = user["school_id"]
    
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Delete all responses first
    await db.survey_answers.delete_many({"survey_id": survey_id})
    
    # Delete survey
    await db.surveys.delete_one({"id": survey_id})
    
    logger.info(f"Survey deleted: {survey_id} by {user['id']}")
    
    return {"message": "Encuesta eliminada correctamente"}

@api_router.post("/surveys/{survey_id}/answer")
async def answer_survey(survey_id: str, data: SurveyAnswer, current_user = Depends(get_current_user)):
    """
    Submit an answer to a survey.
    Each user can only answer once per survey.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    
    # Get the survey
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Check if survey is active
    if survey.get("status") != "active":
        raise HTTPException(status_code=400, detail="Esta encuesta no está activa")
    
    # Check if user's role is in target roles
    target_roles = survey.get("target_roles", [])
    if target_roles and user_role not in target_roles:
        raise HTTPException(status_code=403, detail="No tienes permiso para responder esta encuesta")
    
    # Check if user has already answered
    existing = await db.survey_answers.find_one({
        "survey_id": survey_id,
        "user_id": user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya has respondido a esta encuesta")
    
    # Validate option index
    options = survey.get("options", [])
    if data.option_selected < 0 or data.option_selected >= len(options):
        raise HTTPException(status_code=400, detail="Opción de respuesta inválida")
    
    # Save answer
    answer = {
        "id": str(uuid.uuid4()),
        "survey_id": survey_id,
        "user_id": user["id"],
        "option_selected": data.option_selected,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.survey_answers.insert_one(answer)
    
    logger.info(f"Survey answered: {survey_id} by {user['id']}")
    
    return {"message": "¡Gracias por tu participación!", "answer": {"option_selected": data.option_selected}}

@api_router.get("/surveys/{survey_id}/results")
async def get_survey_results(survey_id: str, current_user = Depends(get_current_user)):
    """
    Get detailed results and statistics for a survey.
    Only admin/owner/director can see results, or anyone if survey is closed.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    # Get the survey
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Non-admin users can only see results of closed surveys
    if not is_admin and survey.get("status") != "closed":
        raise HTTPException(status_code=403, detail="Los resultados aún no están disponibles")
    
    # Get all answers
    answers = await db.survey_answers.find({"survey_id": survey_id}, {"_id": 0}).to_list(10000)
    
    # Calculate statistics
    total_responses = len(answers)
    options = survey.get("options", [])
    
    # Count votes per option
    option_counts = [0] * len(options)
    for answer in answers:
        idx = answer.get("option_selected", -1)
        if 0 <= idx < len(options):
            option_counts[idx] += 1
    
    # Build results with percentages
    results = []
    for i, option in enumerate(options):
        count = option_counts[i]
        percentage = round((count / total_responses * 100), 1) if total_responses > 0 else 0
        results.append({
            "option": option,
            "count": count,
            "percentage": percentage
        })
    
    # Calculate target user count for participation indicator
    target_roles = survey.get("target_roles", [])
    if target_roles:
        target_count = await db.users.count_documents({
            "school_id": school_id,
            "role": {"$in": target_roles}
        })
    else:
        target_count = await db.users.count_documents({"school_id": school_id})
    
    participation_rate = round((total_responses / target_count * 100), 1) if target_count > 0 else 0
    
    return {
        "survey": survey,
        "total_responses": total_responses,
        "target_count": target_count,
        "participation_rate": participation_rate,
        "results": results
    }

# ══════════════════════════════════════════════════════════════════════════════
# DISCIPLINE MODULE - REPORTES DISCIPLINARIOS
# ══════════════════════════════════════════════════════════════════════════════

DISCIPLINE_PRIORITIES = {
    "low": {"label": "Baja", "color": "#22C55E"},
    "medium": {"label": "Media", "color": "#EAB308"},
    "high": {"label": "Alta", "color": "#F97316"},
    "critical": {"label": "Crítica", "color": "#EF4444"}
}

DISCIPLINE_STATUSES = {
    "open": {"label": "Abierto", "color": "#3B82F6"},
    "in_review": {"label": "En revisión", "color": "#8B5CF6"},
    "resolved": {"label": "Resuelto", "color": "#22C55E"},
    "archived": {"label": "Archivado", "color": "#64748B"}
}

class DisciplineAttachment(BaseModel):
    url: str
    type: Literal["image", "pdf", "doc", "other"] = "other"
    filename: Optional[str] = None

class DisciplineReportCreate(BaseModel):
    student_id: str
    grade_id: str
    section_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    incident_date: str  # ISO date string
    attachments: Optional[List[DisciplineAttachment]] = []

class DisciplineReportUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    priority: Optional[Literal["low", "medium", "high", "critical"]] = None
    incident_date: Optional[str] = None
    attachments: Optional[List[DisciplineAttachment]] = None

class DisciplineStatusUpdate(BaseModel):
    status: Literal["open", "in_review", "resolved", "archived"]

@api_router.get("/discipline")
async def get_discipline_reports(
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    student_id: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get discipline reports with filters.
    - Professors can only see reports they created
    - Directors/Admins can see all reports
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    # Build query
    query = {"school_id": school_id}
    
    # Professors can only see their own reports
    if not is_admin:
        query["created_by"] = user["id"]
    
    # Apply filters
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    if student_id:
        query["student_id"] = student_id
    if priority:
        query["priority"] = priority
    if status:
        query["status"] = status
    if date_from:
        query["incident_date"] = {"$gte": date_from}
    if date_to:
        if "incident_date" in query:
            query["incident_date"]["$lte"] = date_to
        else:
            query["incident_date"] = {"$lte": date_to}
    
    reports_cursor = db.discipline_reports.find(query, {"_id": 0}).sort("created_at", -1)
    reports = await reports_cursor.to_list(500)
    
    # Enrich reports with student, grade, section names
    students_cache = {}
    grades_cache = {}
    sections_cache = {}
    creators_cache = {}
    
    for report in reports:
        # Get student info
        if report["student_id"] not in students_cache:
            student = await db.users.find_one({"id": report["student_id"]}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
            students_cache[report["student_id"]] = student
        student_info = students_cache[report["student_id"]]
        report["student_name"] = f"{student_info.get('name', '')} {student_info.get('last_name', '')}".strip() if student_info else "Desconocido"
        report["student_photo"] = student_info.get("photo_url") if student_info else None
        
        # Get grade info
        if report["grade_id"] not in grades_cache:
            grade = await db.grades.find_one({"id": report["grade_id"]}, {"_id": 0, "nombre": 1})
            grades_cache[report["grade_id"]] = grade
        grade_info = grades_cache[report["grade_id"]]
        report["grade_name"] = grade_info.get("nombre") if grade_info else "Sin grado"
        
        # Get section info
        if report["section_id"] not in sections_cache:
            section = await db.sections.find_one({"id": report["section_id"]}, {"_id": 0, "nombre": 1})
            sections_cache[report["section_id"]] = section
        section_info = sections_cache[report["section_id"]]
        report["section_name"] = section_info.get("nombre") if section_info else "Sin sección"
        
        # Get creator info
        if report["created_by"] not in creators_cache:
            creator = await db.users.find_one({"id": report["created_by"]}, {"_id": 0, "name": 1, "last_name": 1})
            creators_cache[report["created_by"]] = creator
        creator_info = creators_cache[report["created_by"]]
        report["created_by_name"] = f"{creator_info.get('name', '')} {creator_info.get('last_name', '')}".strip() if creator_info else "Desconocido"
        
        # Add labels
        report["priority_label"] = DISCIPLINE_PRIORITIES.get(report.get("priority", ""), {}).get("label", report.get("priority", ""))
        report["priority_color"] = DISCIPLINE_PRIORITIES.get(report.get("priority", ""), {}).get("color", "#64748B")
        report["status_label"] = DISCIPLINE_STATUSES.get(report.get("status", ""), {}).get("label", report.get("status", ""))
        report["status_color"] = DISCIPLINE_STATUSES.get(report.get("status", ""), {}).get("color", "#64748B")
    
    return reports

@api_router.get("/discipline/{report_id}")
async def get_discipline_report(report_id: str, current_user = Depends(get_current_user)):
    """Get a single discipline report by ID"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    report = await db.discipline_reports.find_one({"id": report_id, "school_id": school_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    # Check permissions
    if not is_admin and report["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este reporte")
    
    # Enrich with names
    student = await db.users.find_one({"id": report["student_id"]}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
    report["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Desconocido"
    report["student_photo"] = student.get("photo_url") if student else None
    
    grade = await db.grades.find_one({"id": report["grade_id"]}, {"_id": 0, "nombre": 1})
    report["grade_name"] = grade.get("nombre") if grade else "Sin grado"
    
    section = await db.sections.find_one({"id": report["section_id"]}, {"_id": 0, "nombre": 1})
    report["section_name"] = section.get("nombre") if section else "Sin sección"
    
    creator = await db.users.find_one({"id": report["created_by"]}, {"_id": 0, "name": 1, "last_name": 1})
    report["created_by_name"] = f"{creator.get('name', '')} {creator.get('last_name', '')}".strip() if creator else "Desconocido"
    
    if report.get("reviewed_by"):
        reviewer = await db.users.find_one({"id": report["reviewed_by"]}, {"_id": 0, "name": 1, "last_name": 1})
        report["reviewed_by_name"] = f"{reviewer.get('name', '')} {reviewer.get('last_name', '')}".strip() if reviewer else None
    
    # Add labels
    report["priority_label"] = DISCIPLINE_PRIORITIES.get(report.get("priority", ""), {}).get("label", "")
    report["priority_color"] = DISCIPLINE_PRIORITIES.get(report.get("priority", ""), {}).get("color", "#64748B")
    report["status_label"] = DISCIPLINE_STATUSES.get(report.get("status", ""), {}).get("label", "")
    report["status_color"] = DISCIPLINE_STATUSES.get(report.get("status", ""), {}).get("color", "#64748B")
    
    return report

@api_router.post("/discipline")
async def create_discipline_report(data: DisciplineReportCreate, current_user = Depends(get_current_user)):
    """
    Create a new discipline report.
    Teachers, Directors, and Admins can create reports.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Only teachers, directors, admins can create
    if user.get("role") not in ["owner", "admin", "director", "teacher"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear reportes disciplinarios")
    
    school_id = user["school_id"]
    
    # Verify student exists and belongs to same school
    student = await db.users.find_one({"id": data.student_id, "school_id": school_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=400, detail="Estudiante no encontrado")
    
    # Verify grade exists
    grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
    if not grade:
        raise HTTPException(status_code=400, detail="Grado no encontrado")
    
    # Verify section exists
    section = await db.sections.find_one({"id": data.section_id, "school_id": school_id})
    if not section:
        raise HTTPException(status_code=400, detail="Sección no encontrada")
    
    # Create report
    report = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "student_id": data.student_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "title": data.title.strip(),
        "description": data.description.strip(),
        "priority": data.priority,
        "status": "open",
        "incident_date": data.incident_date,
        "created_by": user["id"],
        "reviewed_by": None,
        "attachments": [att.model_dump() for att in data.attachments] if data.attachments else [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.discipline_reports.insert_one(report)
    report.pop("_id", None)
    
    # Enrich response
    report["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
    report["grade_name"] = grade.get("nombre")
    report["section_name"] = section.get("nombre")
    report["created_by_name"] = f"{user.get('name', '')} {user.get('last_name', '')}".strip()
    report["priority_label"] = DISCIPLINE_PRIORITIES.get(data.priority, {}).get("label", "")
    report["priority_color"] = DISCIPLINE_PRIORITIES.get(data.priority, {}).get("color", "#64748B")
    report["status_label"] = DISCIPLINE_STATUSES.get("open", {}).get("label", "")
    report["status_color"] = DISCIPLINE_STATUSES.get("open", {}).get("color", "#64748B")
    
    logger.info(f"Discipline report created: {report['id']} by {user['id']}")
    
    return {"message": "Reporte disciplinario creado correctamente", "report": report}

@api_router.put("/discipline/{report_id}")
async def update_discipline_report(report_id: str, data: DisciplineReportUpdate, current_user = Depends(get_current_user)):
    """
    Update a discipline report.
    - Professors can only edit their own open reports
    - Directors/Admins can edit any non-resolved report
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    report = await db.discipline_reports.find_one({"id": report_id, "school_id": school_id})
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    # Check permissions
    if not is_admin:
        if report["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Solo puedes editar tus propios reportes")
        if report["status"] != "open":
            raise HTTPException(status_code=400, detail="Solo puedes editar reportes abiertos")
    else:
        if report["status"] == "resolved":
            raise HTTPException(status_code=400, detail="No se puede editar un reporte resuelto")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.description is not None:
        update_data["description"] = data.description.strip()
    if data.priority is not None:
        update_data["priority"] = data.priority
    if data.incident_date is not None:
        update_data["incident_date"] = data.incident_date
    if data.attachments is not None:
        update_data["attachments"] = [att.model_dump() for att in data.attachments]
    
    await db.discipline_reports.update_one({"id": report_id}, {"$set": update_data})
    
    # Get updated report
    updated_report = await db.discipline_reports.find_one({"id": report_id}, {"_id": 0})
    
    logger.info(f"Discipline report updated: {report_id} by {user['id']}")
    
    return {"message": "Reporte actualizado correctamente", "report": updated_report}

@api_router.put("/discipline/{report_id}/status")
async def update_discipline_status(report_id: str, data: DisciplineStatusUpdate, current_user = Depends(get_current_user)):
    """
    Change the status of a discipline report.
    Only Directors and Admins can change status.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Only admin/director can change status
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo directores y administradores pueden cambiar el estado")
    
    school_id = user["school_id"]
    
    report = await db.discipline_reports.find_one({"id": report_id, "school_id": school_id})
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    # Update status and reviewer
    update_data = {
        "status": data.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Set reviewer if moving to in_review or resolved
    if data.status in ["in_review", "resolved"] and not report.get("reviewed_by"):
        update_data["reviewed_by"] = user["id"]
    
    await db.discipline_reports.update_one({"id": report_id}, {"$set": update_data})
    
    logger.info(f"Discipline report status changed: {report_id} -> {data.status} by {user['id']}")
    
    return {
        "message": f"Estado actualizado a '{DISCIPLINE_STATUSES.get(data.status, {}).get('label', data.status)}'",
        "status": data.status,
        "status_label": DISCIPLINE_STATUSES.get(data.status, {}).get("label", ""),
        "status_color": DISCIPLINE_STATUSES.get(data.status, {}).get("color", "#64748B")
    }

@api_router.delete("/discipline/{report_id}")
async def delete_discipline_report(report_id: str, current_user = Depends(get_current_user)):
    """
    Delete a discipline report.
    Only Admins can delete reports.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Only admin can delete
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar reportes")
    
    school_id = user["school_id"]
    
    result = await db.discipline_reports.delete_one({"id": report_id, "school_id": school_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    logger.info(f"Discipline report deleted: {report_id} by {user['id']}")
    
    return {"message": "Reporte eliminado correctamente"}

@api_router.get("/discipline/stats/summary")
async def get_discipline_stats(current_user = Depends(get_current_user)):
    """Get summary statistics for discipline reports"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Count by status
    total = await db.discipline_reports.count_documents({"school_id": school_id})
    open_count = await db.discipline_reports.count_documents({"school_id": school_id, "status": "open"})
    in_review = await db.discipline_reports.count_documents({"school_id": school_id, "status": "in_review"})
    resolved = await db.discipline_reports.count_documents({"school_id": school_id, "status": "resolved"})
    archived = await db.discipline_reports.count_documents({"school_id": school_id, "status": "archived"})
    
    # Count by priority
    critical = await db.discipline_reports.count_documents({"school_id": school_id, "priority": "critical"})
    high = await db.discipline_reports.count_documents({"school_id": school_id, "priority": "high"})
    medium = await db.discipline_reports.count_documents({"school_id": school_id, "priority": "medium"})
    low = await db.discipline_reports.count_documents({"school_id": school_id, "priority": "low"})
    
    return {
        "total": total,
        "by_status": {
            "open": open_count,
            "in_review": in_review,
            "resolved": resolved,
            "archived": archived
        },
        "by_priority": {
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low
        }
    }

# ══════════════════════════════════════════════════════════════════════════════
# NEWS MODULE - NOTICIAS INSTITUCIONALES
# ══════════════════════════════════════════════════════════════════════════════

NEWS_STATUSES = {
    "draft": {"label": "Borrador", "color": "#64748B"},
    "published": {"label": "Publicado", "color": "#22C55E"},
    "archived": {"label": "Archivado", "color": "#94A3B8"}
}

class NewsGalleryItem(BaseModel):
    url: str
    type: Literal["image", "video"] = "image"

class NewsVisibility(BaseModel):
    roles: List[str] = []  # Empty means all roles
    grades: List[str] = []
    sections: List[str] = []

class NewsCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    gallery: Optional[List[NewsGalleryItem]] = []
    visibility: Optional[NewsVisibility] = None
    status: Literal["draft", "published"] = "draft"
    pinned: bool = False
    reactions_enabled: bool = False
    comments_enabled: bool = False

class NewsUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = None
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    gallery: Optional[List[NewsGalleryItem]] = None
    visibility: Optional[NewsVisibility] = None
    status: Optional[Literal["draft", "published", "archived"]] = None
    pinned: Optional[bool] = None
    reactions_enabled: Optional[bool] = None
    comments_enabled: Optional[bool] = None

def check_news_visibility(news: dict, user: dict) -> bool:
    """Check if a user can see a specific news article based on visibility settings"""
    visibility = news.get("visibility", {})
    
    # If no visibility restrictions, everyone can see
    roles = visibility.get("roles", [])
    grades = visibility.get("grades", [])
    sections = visibility.get("sections", [])
    
    if not roles and not grades and not sections:
        return True
    
    user_role = user.get("role", "")
    user_grade = user.get("grado_id", "")
    user_section = user.get("seccion_id", "")
    
    # Check role restriction
    if roles and user_role not in roles:
        return False
    
    # Check grade restriction (if applicable)
    if grades and user_grade and user_grade not in grades:
        return False
    
    # Check section restriction (if applicable)
    if sections and user_section and user_section not in sections:
        return False
    
    return True

@api_router.get("/news")
async def get_news(
    status: Optional[str] = None,
    pinned_only: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
    current_user = Depends(get_current_user)
):
    """
    Get news articles.
    - Admin/Director see all (including drafts)
    - Others see only published articles that match their visibility
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    # Build query
    query = {"school_id": school_id}
    
    if is_admin:
        # Admins can filter by status
        if status:
            query["status"] = status
        # Exclude archived unless specifically requested
        elif status != "archived":
            query["status"] = {"$ne": "archived"}
    else:
        # Non-admin users only see published articles
        query["status"] = "published"
    
    if pinned_only:
        query["pinned"] = True
    
    # Calculate pagination
    skip = (page - 1) * limit
    
    # Get total count
    total = await db.news.count_documents(query)
    
    # Get news with sorting: pinned first, then by published_at desc
    news_cursor = db.news.find(query, {"_id": 0}).sort([
        ("pinned", -1),
        ("published_at", -1),
        ("created_at", -1)
    ]).skip(skip).limit(limit)
    
    news_list = await news_cursor.to_list(limit)
    
    # Filter by visibility for non-admin users
    if not is_admin:
        news_list = [n for n in news_list if check_news_visibility(n, user)]
    
    # Enrich with author info
    authors_cache = {}
    for news in news_list:
        author_id = news.get("author_id")
        if author_id and author_id not in authors_cache:
            author = await db.users.find_one({"id": author_id}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
            authors_cache[author_id] = author
        
        author_info = authors_cache.get(author_id)
        if author_info:
            news["author_name"] = f"{author_info.get('name', '')} {author_info.get('last_name', '')}".strip()
            news["author_photo"] = author_info.get("photo_url")
        else:
            news["author_name"] = news.get("author_name", "Desconocido")
            news["author_photo"] = None
        
        # Add status label
        news["status_label"] = NEWS_STATUSES.get(news.get("status", ""), {}).get("label", "")
        news["status_color"] = NEWS_STATUSES.get(news.get("status", ""), {}).get("color", "#64748B")
    
    return {
        "news": news_list,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@api_router.get("/news/{news_id}")
async def get_news_article(news_id: str, current_user = Depends(get_current_user)):
    """Get a single news article by ID"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id}, {"_id": 0})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    # Check permissions
    if not is_admin:
        if news.get("status") != "published":
            raise HTTPException(status_code=403, detail="No tienes permiso para ver esta noticia")
        if not check_news_visibility(news, user):
            raise HTTPException(status_code=403, detail="No tienes permiso para ver esta noticia")
    
    # Enrich with author info
    author = await db.users.find_one({"id": news.get("author_id")}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
    if author:
        news["author_name"] = f"{author.get('name', '')} {author.get('last_name', '')}".strip()
        news["author_photo"] = author.get("photo_url")
    
    news["status_label"] = NEWS_STATUSES.get(news.get("status", ""), {}).get("label", "")
    news["status_color"] = NEWS_STATUSES.get(news.get("status", ""), {}).get("color", "#64748B")
    
    return news

@api_router.post("/news")
async def create_news(data: NewsCreate, current_user = Depends(get_current_user)):
    """
    Create a new news article.
    Only Admin/Director can create news.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden crear noticias")
    
    school_id = user["school_id"]
    
    # Check max pinned (3)
    if data.pinned:
        pinned_count = await db.news.count_documents({"school_id": school_id, "pinned": True, "status": "published"})
        if pinned_count >= 3:
            raise HTTPException(status_code=400, detail="Solo se pueden tener 3 noticias destacadas simultáneamente")
    
    now = datetime.now(timezone.utc).isoformat()
    
    news = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "title": data.title.strip(),
        "content": data.content,
        "summary": data.summary.strip() if data.summary else None,
        "cover_image": data.cover_image,
        "gallery": [g.model_dump() for g in data.gallery] if data.gallery else [],
        "author_id": user["id"],
        "author_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "visibility": data.visibility.model_dump() if data.visibility else {"roles": [], "grades": [], "sections": []},
        "status": data.status,
        "pinned": data.pinned if data.status == "published" else False,
        "reactions_enabled": data.reactions_enabled,
        "comments_enabled": data.comments_enabled,
        "created_at": now,
        "updated_at": now,
        "published_at": now if data.status == "published" else None
    }
    
    await db.news.insert_one(news)
    news.pop("_id", None)
    
    news["author_photo"] = user.get("photo_url")
    news["status_label"] = NEWS_STATUSES.get(data.status, {}).get("label", "")
    news["status_color"] = NEWS_STATUSES.get(data.status, {}).get("color", "#64748B")
    
    logger.info(f"News created: {news['id']} by {user['id']}")
    
    return {"message": "Noticia creada correctamente", "news": news}

@api_router.put("/news/{news_id}")
async def update_news(news_id: str, data: NewsUpdate, current_user = Depends(get_current_user)):
    """
    Update a news article.
    Only Admin/Director can edit news.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden editar noticias")
    
    school_id = user["school_id"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.content is not None:
        update_data["content"] = data.content
    if data.summary is not None:
        update_data["summary"] = data.summary.strip() if data.summary else None
    if data.cover_image is not None:
        update_data["cover_image"] = data.cover_image
    if data.gallery is not None:
        update_data["gallery"] = [g.model_dump() for g in data.gallery]
    if data.visibility is not None:
        update_data["visibility"] = data.visibility.model_dump()
    if data.reactions_enabled is not None:
        update_data["reactions_enabled"] = data.reactions_enabled
    if data.comments_enabled is not None:
        update_data["comments_enabled"] = data.comments_enabled
    
    # Handle status change
    if data.status is not None:
        update_data["status"] = data.status
        if data.status == "published" and news.get("status") != "published":
            update_data["published_at"] = datetime.now(timezone.utc).isoformat()
    
    # Handle pinned
    if data.pinned is not None:
        new_status = data.status if data.status else news.get("status")
        if data.pinned and new_status == "published":
            pinned_count = await db.news.count_documents({
                "school_id": school_id, 
                "pinned": True, 
                "status": "published",
                "id": {"$ne": news_id}
            })
            if pinned_count >= 3:
                raise HTTPException(status_code=400, detail="Solo se pueden tener 3 noticias destacadas simultáneamente")
        update_data["pinned"] = data.pinned
    
    await db.news.update_one({"id": news_id}, {"$set": update_data})
    
    updated_news = await db.news.find_one({"id": news_id}, {"_id": 0})
    
    logger.info(f"News updated: {news_id} by {user['id']}")
    
    return {"message": "Noticia actualizada correctamente", "news": updated_news}

@api_router.put("/news/{news_id}/publish")
async def publish_news(news_id: str, current_user = Depends(get_current_user)):
    """Publish a draft news article"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden publicar noticias")
    
    school_id = user["school_id"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    if news.get("status") == "published":
        raise HTTPException(status_code=400, detail="La noticia ya está publicada")
    
    await db.news.update_one(
        {"id": news_id},
        {"$set": {
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"News published: {news_id} by {user['id']}")
    
    return {"message": "Noticia publicada correctamente"}

@api_router.put("/news/{news_id}/archive")
async def archive_news(news_id: str, current_user = Depends(get_current_user)):
    """Archive a news article"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden archivar noticias")
    
    school_id = user["school_id"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    if news.get("status") == "archived":
        raise HTTPException(status_code=400, detail="La noticia ya está archivada")
    
    await db.news.update_one(
        {"id": news_id},
        {"$set": {
            "status": "archived",
            "pinned": False,  # Unpin when archiving
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"News archived: {news_id} by {user['id']}")
    
    return {"message": "Noticia archivada correctamente"}

@api_router.put("/news/{news_id}/pin")
async def pin_news(news_id: str, current_user = Depends(get_current_user)):
    """Toggle pin status of a news article"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden fijar noticias")
    
    school_id = user["school_id"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    if news.get("status") != "published":
        raise HTTPException(status_code=400, detail="Solo se pueden fijar noticias publicadas")
    
    new_pinned = not news.get("pinned", False)
    
    # Check max pinned
    if new_pinned:
        pinned_count = await db.news.count_documents({
            "school_id": school_id, 
            "pinned": True, 
            "status": "published",
            "id": {"$ne": news_id}
        })
        if pinned_count >= 3:
            raise HTTPException(status_code=400, detail="Solo se pueden tener 3 noticias destacadas simultáneamente")
    
    await db.news.update_one(
        {"id": news_id},
        {"$set": {
            "pinned": new_pinned,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"News pin toggled: {news_id} -> {new_pinned} by {user['id']}")
    
    return {
        "message": f"Noticia {'destacada' if new_pinned else 'quitada de destacados'} correctamente",
        "pinned": new_pinned
    }

@api_router.delete("/news/{news_id}")
async def delete_news(news_id: str, current_user = Depends(get_current_user)):
    """
    Delete a news article.
    Only Admin can delete news.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar noticias")
    
    school_id = user["school_id"]
    
    result = await db.news.delete_one({"id": news_id, "school_id": school_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    logger.info(f"News deleted: {news_id} by {user['id']}")
    
    return {"message": "Noticia eliminada correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACCOUNTING MODULE - CONTABILIDAD ESCOLAR (PERÚ)
# ══════════════════════════════════════════════════════════════════════════════

# Peru IGV rate
DEFAULT_IGV_PERCENTAGE = 18

PAYMENT_CONCEPTS = {
    "matricula": "Matrícula",
    "mensualidad": "Mensualidad",
    "taller": "Taller",
    "uniforme": "Uniforme",
    "material": "Material escolar",
    "evento": "Evento",
    "otros": "Otros"
}

PAYMENT_METHODS = {
    "efectivo": "Efectivo",
    "transferencia": "Transferencia bancaria",
    "yape": "Yape",
    "plin": "Plin",
    "tarjeta": "Tarjeta"
}

PAYMENT_STATUSES = {
    "pending": {"label": "Pendiente", "color": "#F59E0B"},
    "paid": {"label": "Pagado", "color": "#22C55E"},
    "canceled": {"label": "Anulado", "color": "#EF4444"}
}

EXPENSE_CATEGORIES = {
    "servicios": "Servicios (luz, agua, internet)",
    "personal": "Personal y planilla",
    "mantenimiento": "Mantenimiento",
    "materiales": "Materiales y suministros",
    "otros": "Otros gastos"
}

class PaymentCreate(BaseModel):
    student_id: str
    grade_id: str
    section_id: str
    concept: str
    description: Optional[str] = None
    amount_base: float = Field(..., gt=0)
    igv_applicable: bool = True
    igv_percentage: float = DEFAULT_IGV_PERCENTAGE
    payment_method: str
    payment_status: Literal["pending", "paid"] = "pending"
    payment_date: Optional[str] = None
    receipt_number: Optional[str] = None
    notes: Optional[str] = None

class PaymentUpdate(BaseModel):
    concept: Optional[str] = None
    description: Optional[str] = None
    amount_base: Optional[float] = Field(None, gt=0)
    igv_applicable: Optional[bool] = None
    igv_percentage: Optional[float] = None
    payment_method: Optional[str] = None
    payment_date: Optional[str] = None
    receipt_number: Optional[str] = None
    notes: Optional[str] = None

class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: str
    description: Optional[str] = None
    amount_base: float = Field(..., gt=0)
    igv_applicable: bool = True
    igv_percentage: float = DEFAULT_IGV_PERCENTAGE
    expense_date: str
    payment_method: str
    provider_name: Optional[str] = None
    notes: Optional[str] = None

class ExpenseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = None
    description: Optional[str] = None
    amount_base: Optional[float] = Field(None, gt=0)
    igv_applicable: Optional[bool] = None
    igv_percentage: Optional[float] = None
    expense_date: Optional[str] = None
    payment_method: Optional[str] = None
    provider_name: Optional[str] = None
    notes: Optional[str] = None

def calculate_igv(amount_base: float, igv_applicable: bool, igv_percentage: float) -> dict:
    """Calculate IGV amounts for Peru"""
    if not igv_applicable:
        return {
            "amount_base": round(amount_base, 2),
            "igv_amount": 0,
            "total_amount": round(amount_base, 2)
        }
    
    igv_amount = round(amount_base * (igv_percentage / 100), 2)
    total_amount = round(amount_base + igv_amount, 2)
    
    return {
        "amount_base": round(amount_base, 2),
        "igv_amount": igv_amount,
        "total_amount": total_amount
    }

# ─────────────────────────────────────────────────────────────────────────────
# PAYMENTS (INGRESOS)
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/accounting/payments")
async def get_payments(
    status: Optional[str] = None,
    concept: Optional[str] = None,
    grade_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get all payments (ingresos) for the school"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver la contabilidad")
    
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if status:
        query["payment_status"] = status
    if concept:
        query["concept"] = concept
    if grade_id:
        query["grade_id"] = grade_id
    if date_from:
        query["payment_date"] = {"$gte": date_from}
    if date_to:
        if "payment_date" in query:
            query["payment_date"]["$lte"] = date_to
        else:
            query["payment_date"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    total = await db.payments.count_documents(query)
    
    payments_cursor = db.payments.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    payments = await payments_cursor.to_list(limit)
    
    # Enrich with student, grade, section names
    students_cache = {}
    grades_cache = {}
    sections_cache = {}
    
    for payment in payments:
        # Student info
        if payment["student_id"] not in students_cache:
            student = await db.users.find_one({"id": payment["student_id"]}, {"_id": 0, "name": 1, "last_name": 1})
            students_cache[payment["student_id"]] = student
        student_info = students_cache[payment["student_id"]]
        payment["student_name"] = f"{student_info.get('name', '')} {student_info.get('last_name', '')}".strip() if student_info else "Desconocido"
        
        # Grade info
        if payment["grade_id"] not in grades_cache:
            grade = await db.grades.find_one({"id": payment["grade_id"]}, {"_id": 0, "nombre": 1, "nivel_nombre": 1})
            grades_cache[payment["grade_id"]] = grade
        grade_info = grades_cache[payment["grade_id"]]
        payment["grade_name"] = f"{grade_info.get('nivel_nombre', '')} - {grade_info.get('nombre', '')}" if grade_info else "Sin grado"
        
        # Section info
        if payment["section_id"] not in sections_cache:
            section = await db.sections.find_one({"id": payment["section_id"]}, {"_id": 0, "nombre": 1})
            sections_cache[payment["section_id"]] = section
        section_info = sections_cache[payment["section_id"]]
        payment["section_name"] = section_info.get("nombre") if section_info else "Sin sección"
        
        # Labels
        payment["concept_label"] = PAYMENT_CONCEPTS.get(payment.get("concept", ""), payment.get("concept", ""))
        payment["method_label"] = PAYMENT_METHODS.get(payment.get("payment_method", ""), payment.get("payment_method", ""))
        payment["status_label"] = PAYMENT_STATUSES.get(payment.get("payment_status", ""), {}).get("label", "")
        payment["status_color"] = PAYMENT_STATUSES.get(payment.get("payment_status", ""), {}).get("color", "#64748B")
    
    return {
        "payments": payments,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@api_router.post("/accounting/payments")
async def create_payment(data: PaymentCreate, current_user = Depends(get_current_user)):
    """Create a new payment (ingreso)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para registrar pagos")
    
    school_id = user["school_id"]
    
    # Verify student exists
    student = await db.users.find_one({"id": data.student_id, "school_id": school_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=400, detail="Estudiante no encontrado")
    
    # Calculate IGV
    amounts = calculate_igv(data.amount_base, data.igv_applicable, data.igv_percentage)
    
    now = datetime.now(timezone.utc).isoformat()
    
    payment = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "student_id": data.student_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "concept": data.concept,
        "description": data.description,
        "amount_base": amounts["amount_base"],
        "igv_amount": amounts["igv_amount"],
        "total_amount": amounts["total_amount"],
        "igv_applicable": data.igv_applicable,
        "igv_percentage": data.igv_percentage if data.igv_applicable else 0,
        "payment_method": data.payment_method,
        "payment_status": data.payment_status,
        "payment_date": data.payment_date or now[:10],
        "receipt_number": data.receipt_number,
        "notes": data.notes,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.payments.insert_one(payment)
    payment.pop("_id", None)
    
    # Enrich response
    payment["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip()
    payment["concept_label"] = PAYMENT_CONCEPTS.get(data.concept, data.concept)
    payment["method_label"] = PAYMENT_METHODS.get(data.payment_method, data.payment_method)
    payment["status_label"] = PAYMENT_STATUSES.get(data.payment_status, {}).get("label", "")
    payment["status_color"] = PAYMENT_STATUSES.get(data.payment_status, {}).get("color", "#64748B")
    
    logger.info(f"Payment created: {payment['id']} - S/{payment['total_amount']} by {user['id']}")
    
    return {"message": "Pago registrado correctamente", "payment": payment}

@api_router.put("/accounting/payments/{payment_id}")
async def update_payment(payment_id: str, data: PaymentUpdate, current_user = Depends(get_current_user)):
    """Update a payment"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar pagos")
    
    school_id = user["school_id"]
    
    payment = await db.payments.find_one({"id": payment_id, "school_id": school_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    # Cannot edit canceled payments
    if payment.get("payment_status") == "canceled":
        raise HTTPException(status_code=400, detail="No se puede editar un pago anulado")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Copy existing values for recalculation
    amount_base = payment["amount_base"]
    igv_applicable = payment["igv_applicable"]
    igv_percentage = payment.get("igv_percentage", DEFAULT_IGV_PERCENTAGE)
    
    if data.amount_base is not None:
        amount_base = data.amount_base
    if data.igv_applicable is not None:
        igv_applicable = data.igv_applicable
    if data.igv_percentage is not None:
        igv_percentage = data.igv_percentage
    
    # Recalculate amounts
    amounts = calculate_igv(amount_base, igv_applicable, igv_percentage)
    update_data.update(amounts)
    update_data["igv_applicable"] = igv_applicable
    update_data["igv_percentage"] = igv_percentage if igv_applicable else 0
    
    # Other fields
    if data.concept is not None:
        update_data["concept"] = data.concept
    if data.description is not None:
        update_data["description"] = data.description
    if data.payment_method is not None:
        update_data["payment_method"] = data.payment_method
    if data.payment_date is not None:
        update_data["payment_date"] = data.payment_date
    if data.receipt_number is not None:
        update_data["receipt_number"] = data.receipt_number
    if data.notes is not None:
        update_data["notes"] = data.notes
    
    await db.payments.update_one({"id": payment_id}, {"$set": update_data})
    
    updated_payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    
    logger.info(f"Payment updated: {payment_id} by {user['id']}")
    
    return {"message": "Pago actualizado correctamente", "payment": updated_payment}

@api_router.put("/accounting/payments/{payment_id}/confirm")
async def confirm_payment(payment_id: str, current_user = Depends(get_current_user)):
    """Confirm a pending payment"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para confirmar pagos")
    
    school_id = user["school_id"]
    
    payment = await db.payments.find_one({"id": payment_id, "school_id": school_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    if payment.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="El pago ya está confirmado")
    if payment.get("payment_status") == "canceled":
        raise HTTPException(status_code=400, detail="No se puede confirmar un pago anulado")
    
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "payment_status": "paid",
            "payment_date": datetime.now(timezone.utc).isoformat()[:10],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Payment confirmed: {payment_id} by {user['id']}")
    
    return {"message": "Pago confirmado correctamente"}

@api_router.put("/accounting/payments/{payment_id}/cancel")
async def cancel_payment(payment_id: str, current_user = Depends(get_current_user)):
    """Cancel a payment"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para anular pagos")
    
    school_id = user["school_id"]
    
    payment = await db.payments.find_one({"id": payment_id, "school_id": school_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    if payment.get("payment_status") == "canceled":
        raise HTTPException(status_code=400, detail="El pago ya está anulado")
    
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "payment_status": "canceled",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Payment canceled: {payment_id} by {user['id']}")
    
    return {"message": "Pago anulado correctamente"}

# ─────────────────────────────────────────────────────────────────────────────
# EXPENSES (EGRESOS)
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/accounting/expenses")
async def get_expenses(
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get all expenses (egresos) for the school"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver la contabilidad")
    
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if category:
        query["category"] = category
    if date_from:
        query["expense_date"] = {"$gte": date_from}
    if date_to:
        if "expense_date" in query:
            query["expense_date"]["$lte"] = date_to
        else:
            query["expense_date"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    total = await db.expenses.count_documents(query)
    
    expenses_cursor = db.expenses.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    expenses = await expenses_cursor.to_list(limit)
    
    for expense in expenses:
        expense["category_label"] = EXPENSE_CATEGORIES.get(expense.get("category", ""), expense.get("category", ""))
        expense["method_label"] = PAYMENT_METHODS.get(expense.get("payment_method", ""), expense.get("payment_method", ""))
    
    return {
        "expenses": expenses,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@api_router.post("/accounting/expenses")
async def create_expense(data: ExpenseCreate, current_user = Depends(get_current_user)):
    """Create a new expense (egreso)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para registrar egresos")
    
    school_id = user["school_id"]
    
    # Calculate IGV
    amounts = calculate_igv(data.amount_base, data.igv_applicable, data.igv_percentage)
    
    now = datetime.now(timezone.utc).isoformat()
    
    expense = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "title": data.title.strip(),
        "category": data.category,
        "description": data.description,
        "amount_base": amounts["amount_base"],
        "igv_amount": amounts["igv_amount"],
        "total_amount": amounts["total_amount"],
        "igv_applicable": data.igv_applicable,
        "igv_percentage": data.igv_percentage if data.igv_applicable else 0,
        "expense_date": data.expense_date,
        "payment_method": data.payment_method,
        "provider_name": data.provider_name,
        "notes": data.notes,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.expenses.insert_one(expense)
    expense.pop("_id", None)
    
    expense["category_label"] = EXPENSE_CATEGORIES.get(data.category, data.category)
    expense["method_label"] = PAYMENT_METHODS.get(data.payment_method, data.payment_method)
    
    logger.info(f"Expense created: {expense['id']} - S/{expense['total_amount']} by {user['id']}")
    
    return {"message": "Egreso registrado correctamente", "expense": expense}

@api_router.put("/accounting/expenses/{expense_id}")
async def update_expense(expense_id: str, data: ExpenseUpdate, current_user = Depends(get_current_user)):
    """Update an expense"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar egresos")
    
    school_id = user["school_id"]
    
    expense = await db.expenses.find_one({"id": expense_id, "school_id": school_id})
    if not expense:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Handle amount recalculation
    amount_base = expense["amount_base"]
    igv_applicable = expense["igv_applicable"]
    igv_percentage = expense.get("igv_percentage", DEFAULT_IGV_PERCENTAGE)
    
    if data.amount_base is not None:
        amount_base = data.amount_base
    if data.igv_applicable is not None:
        igv_applicable = data.igv_applicable
    if data.igv_percentage is not None:
        igv_percentage = data.igv_percentage
    
    amounts = calculate_igv(amount_base, igv_applicable, igv_percentage)
    update_data.update(amounts)
    update_data["igv_applicable"] = igv_applicable
    update_data["igv_percentage"] = igv_percentage if igv_applicable else 0
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.category is not None:
        update_data["category"] = data.category
    if data.description is not None:
        update_data["description"] = data.description
    if data.expense_date is not None:
        update_data["expense_date"] = data.expense_date
    if data.payment_method is not None:
        update_data["payment_method"] = data.payment_method
    if data.provider_name is not None:
        update_data["provider_name"] = data.provider_name
    if data.notes is not None:
        update_data["notes"] = data.notes
    
    await db.expenses.update_one({"id": expense_id}, {"$set": update_data})
    
    updated_expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    
    logger.info(f"Expense updated: {expense_id} by {user['id']}")
    
    return {"message": "Egreso actualizado correctamente", "expense": updated_expense}

@api_router.delete("/accounting/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user = Depends(get_current_user)):
    """Delete an expense"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar egresos")
    
    school_id = user["school_id"]
    
    result = await db.expenses.delete_one({"id": expense_id, "school_id": school_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    
    logger.info(f"Expense deleted: {expense_id} by {user['id']}")
    
    return {"message": "Egreso eliminado correctamente"}

# ─────────────────────────────────────────────────────────────────────────────
# ACCOUNTING SUMMARY (DASHBOARD)
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/accounting/summary")
async def get_accounting_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    """Get accounting summary for dashboard"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver la contabilidad")
    
    school_id = user["school_id"]
    
    # Default to current year/month
    now = datetime.now(timezone.utc)
    if not year:
        year = now.year
    if not month:
        month = now.month
    
    # Build date range for the month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    # Payments aggregation
    payments_pipeline = [
        {"$match": {
            "school_id": school_id,
            "payment_date": {"$gte": start_date, "$lt": end_date}
        }},
        {"$group": {
            "_id": "$payment_status",
            "total": {"$sum": "$total_amount"},
            "base": {"$sum": "$amount_base"},
            "igv": {"$sum": "$igv_amount"},
            "count": {"$sum": 1}
        }}
    ]
    
    payments_agg = await db.payments.aggregate(payments_pipeline).to_list(10)
    
    # Process payments results
    ingresos_confirmados = 0
    ingresos_base = 0
    ingresos_igv = 0
    pagos_pendientes = 0
    pagos_pendientes_count = 0
    pagos_confirmados_count = 0
    pagos_anulados_count = 0
    
    for item in payments_agg:
        if item["_id"] == "paid":
            ingresos_confirmados = item["total"]
            ingresos_base = item["base"]
            ingresos_igv = item["igv"]
            pagos_confirmados_count = item["count"]
        elif item["_id"] == "pending":
            pagos_pendientes = item["total"]
            pagos_pendientes_count = item["count"]
        elif item["_id"] == "canceled":
            pagos_anulados_count = item["count"]
    
    # Expenses aggregation
    expenses_pipeline = [
        {"$match": {
            "school_id": school_id,
            "expense_date": {"$gte": start_date, "$lt": end_date}
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$total_amount"},
            "base": {"$sum": "$amount_base"},
            "igv": {"$sum": "$igv_amount"},
            "count": {"$sum": 1}
        }}
    ]
    
    expenses_agg = await db.expenses.aggregate(expenses_pipeline).to_list(1)
    
    egresos_totales = 0
    egresos_base = 0
    egresos_igv = 0
    egresos_count = 0
    
    if expenses_agg:
        egresos_totales = expenses_agg[0]["total"]
        egresos_base = expenses_agg[0]["base"]
        egresos_igv = expenses_agg[0]["igv"]
        egresos_count = expenses_agg[0]["count"]
    
    # Calculate balance
    balance = round(ingresos_confirmados - egresos_totales, 2)
    
    # Get recent transactions
    recent_payments = await db.payments.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Enrich recent payments
    for p in recent_payments:
        student = await db.users.find_one({"id": p["student_id"]}, {"_id": 0, "name": 1, "last_name": 1})
        p["student_name"] = f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else "Desconocido"
        p["concept_label"] = PAYMENT_CONCEPTS.get(p.get("concept", ""), p.get("concept", ""))
        p["status_label"] = PAYMENT_STATUSES.get(p.get("payment_status", ""), {}).get("label", "")
        p["status_color"] = PAYMENT_STATUSES.get(p.get("payment_status", ""), {}).get("color", "#64748B")
    
    recent_expenses = await db.expenses.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    for e in recent_expenses:
        e["category_label"] = EXPENSE_CATEGORIES.get(e.get("category", ""), e.get("category", ""))
    
    return {
        "period": {
            "year": year,
            "month": month,
            "month_name": ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][month]
        },
        "ingresos": {
            "total": round(ingresos_confirmados, 2),
            "base": round(ingresos_base, 2),
            "igv": round(ingresos_igv, 2),
            "count": pagos_confirmados_count
        },
        "egresos": {
            "total": round(egresos_totales, 2),
            "base": round(egresos_base, 2),
            "igv": round(egresos_igv, 2),
            "count": egresos_count
        },
        "pendientes": {
            "total": round(pagos_pendientes, 2),
            "count": pagos_pendientes_count
        },
        "anulados": {
            "count": pagos_anulados_count
        },
        "balance": balance,
        "recent_payments": recent_payments,
        "recent_expenses": recent_expenses
    }

# ══════════════════════════════════════════════════════════════════════════════
# SUBJECTS MODULE (ASIGNATURAS)
# ══════════════════════════════════════════════════════════════════════════════

# Subject colors for UI
SUBJECT_COLORS = [
    "#3B82F6",  # Blue
    "#10B981",  # Emerald
    "#F59E0B",  # Amber
    "#EF4444",  # Red
    "#8B5CF6",  # Violet
    "#EC4899",  # Pink
    "#06B6D4",  # Cyan
    "#6366F1",  # Indigo
    "#14B8A6",  # Teal
    "#F97316",  # Orange
    "#84CC16",  # Lime
    "#A855F7",  # Purple
]

class SubjectCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = ""
    level_id: str
    grade_id: Optional[str] = None
    weekly_hours: int = 1
    color: str = "#3B82F6"
    status: str = "active"
    image_url: Optional[str] = None  # Subject cover image

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    level_id: Optional[str] = None
    grade_id: Optional[str] = None
    weekly_hours: Optional[int] = None
    color: Optional[str] = None
    status: Optional[str] = None
    image_url: Optional[str] = None  # Subject cover image

class SubjectTeacherAssign(BaseModel):
    teacher_ids: List[str]

# ─────────────────────────────────────────────────────────────────────────────
# SUBJECTS CRUD
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/academic/subjects")
async def get_subjects(
    level_id: Optional[str] = None,
    grade_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all subjects for a school"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    query = {"school_id": school_id}
    if level_id:
        query["level_id"] = level_id
    if grade_id:
        query["grade_id"] = grade_id
    if status:
        query["status"] = status
    
    subjects_cursor = db.subjects.find(query, {"_id": 0}).sort("name", 1)
    subjects = await subjects_cursor.to_list(500)
    
    # Enrich subjects with level and grade names
    levels = {l["id"]: l["nombre"] for l in await db.academic_levels.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)}
    grades = {g["id"]: g for g in await db.grades.find({"school_id": school_id}, {"_id": 0, "id": 1, "nombre": 1, "nivel_id": 1}).to_list(200)}
    
    # Get all users (teachers) for assignment lookup - include both profile_image and photo_url
    users_cache = {u["id"]: u for u in await db.users.find({"school_id": school_id}, {"_id": 0, "id": 1, "name": 1, "profile_image": 1, "photo_url": 1}).to_list(500)}
    
    for subject in subjects:
        subject["level_name"] = levels.get(subject.get("level_id"), "")
        grade = grades.get(subject.get("grade_id"))
        subject["grade_name"] = grade.get("nombre", "") if grade else "Todos"
        
        # Get assigned teachers from academic_assignments (the new architecture)
        assignments = await db.academic_assignments.find({
            "school_id": school_id,
            "subject_id": subject["id"],
            "status": "activo"
        }, {"_id": 0, "teacher_id": 1, "role": 1}).to_list(10)
        
        subject["teacher_count"] = len(assignments)
        subject["assigned_teachers"] = []
        
        for assignment in assignments:
            teacher = users_cache.get(assignment.get("teacher_id"))
            if teacher:
                # Use profile_image or photo_url (whichever is available)
                teacher_photo = teacher.get("profile_image") or teacher.get("photo_url")
                subject["assigned_teachers"].append({
                    "id": teacher["id"],
                    "name": teacher["name"],
                    "profile_image": teacher_photo,
                    "role": assignment.get("role", "titular")
                })
        
        # Set primary teacher (first titular, or first if no titular)
        if subject["assigned_teachers"]:
            titular = next((t for t in subject["assigned_teachers"] if t.get("role") == "titular"), None)
            subject["primary_teacher"] = titular or subject["assigned_teachers"][0]
        else:
            subject["primary_teacher"] = None
    
    return subjects

@api_router.post("/academic/subjects")
async def create_subject(data: SubjectCreate, current_user = Depends(get_current_user)):
    """Create a new subject"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para crear asignaturas")
    
    school_id = user["school_id"]
    
    # Verify level exists
    level = await db.academic_levels.find_one({"id": data.level_id, "school_id": school_id})
    if not level:
        raise HTTPException(status_code=400, detail="El nivel seleccionado no existe")
    
    # Verify grade exists if provided
    if data.grade_id:
        grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
        if not grade:
            raise HTTPException(status_code=400, detail="El grado seleccionado no existe")
    
    # Check for duplicates (name + level + grade)
    duplicate_query = {
        "school_id": school_id,
        "name": {"$regex": f"^{data.name}$", "$options": "i"},
        "level_id": data.level_id
    }
    if data.grade_id:
        duplicate_query["grade_id"] = data.grade_id
    else:
        duplicate_query["$or"] = [{"grade_id": None}, {"grade_id": {"$exists": False}}]
    
    existing = await db.subjects.find_one(duplicate_query)
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una asignatura con ese nombre para el mismo nivel/grado")
    
    # Check code uniqueness
    code_exists = await db.subjects.find_one({
        "school_id": school_id,
        "code": {"$regex": f"^{data.code}$", "$options": "i"}
    })
    if code_exists:
        raise HTTPException(status_code=400, detail="El código de asignatura ya está en uso")
    
    now = datetime.now(timezone.utc).isoformat()
    
    subject = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "name": data.name.strip(),
        "code": data.code.strip().upper(),
        "description": data.description.strip() if data.description else "",
        "level_id": data.level_id,
        "grade_id": data.grade_id,
        "weekly_hours": max(1, data.weekly_hours),
        "color": data.color,
        "status": data.status,
        "image_url": data.image_url,
        "created_at": now,
        "updated_at": now
    }
    
    await db.subjects.insert_one(subject)
    
    # Remove _id before returning
    subject.pop("_id", None)
    
    logger.info(f"Subject created: {subject['name']} ({subject['code']}) by {user['id']}")
    
    return {"message": "Asignatura creada correctamente", "subject": subject}

@api_router.put("/academic/subjects/{subject_id}")
async def update_subject(subject_id: str, data: SubjectUpdate, current_user = Depends(get_current_user)):
    """Update a subject"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar asignaturas")
    
    school_id = user["school_id"]
    
    # Check subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        # Check for duplicates if name is changing
        duplicate_query = {
            "school_id": school_id,
            "name": {"$regex": f"^{data.name}$", "$options": "i"},
            "level_id": data.level_id if data.level_id else subject["level_id"],
            "id": {"$ne": subject_id}
        }
        grade_id = data.grade_id if data.grade_id is not None else subject.get("grade_id")
        if grade_id:
            duplicate_query["grade_id"] = grade_id
        
        existing = await db.subjects.find_one(duplicate_query)
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe una asignatura con ese nombre para el mismo nivel/grado")
        
        update_data["name"] = data.name.strip()
    
    if data.code is not None:
        # Check code uniqueness
        code_exists = await db.subjects.find_one({
            "school_id": school_id,
            "code": {"$regex": f"^{data.code}$", "$options": "i"},
            "id": {"$ne": subject_id}
        })
        if code_exists:
            raise HTTPException(status_code=400, detail="El código de asignatura ya está en uso")
        update_data["code"] = data.code.strip().upper()
    
    if data.description is not None:
        update_data["description"] = data.description.strip()
    
    if data.level_id is not None:
        level = await db.academic_levels.find_one({"id": data.level_id, "school_id": school_id})
        if not level:
            raise HTTPException(status_code=400, detail="El nivel seleccionado no existe")
        update_data["level_id"] = data.level_id
    
    if data.grade_id is not None:
        if data.grade_id == "":
            update_data["grade_id"] = None
        else:
            grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
            if not grade:
                raise HTTPException(status_code=400, detail="El grado seleccionado no existe")
            update_data["grade_id"] = data.grade_id
    
    if data.weekly_hours is not None:
        update_data["weekly_hours"] = max(1, data.weekly_hours)
    
    if data.color is not None:
        update_data["color"] = data.color
    
    if data.status is not None:
        update_data["status"] = data.status
    
    if data.image_url is not None:
        # Delete old image from Cloudinary if exists and is being replaced
        old_image = subject.get("image_url")
        if old_image and "cloudinary.com" in old_image and data.image_url != old_image:
            try:
                parts = old_image.split("/upload/")
                if len(parts) > 1:
                    path_part = parts[1]
                    public_id = path_part.rsplit(".", 1)[0]
                    if "/" in public_id:
                        public_id = public_id.split("/", 1)[1] if public_id.startswith("v") else public_id
                    cloudinary.uploader.destroy(public_id)
            except Exception as e:
                logger.warning(f"Failed to delete old subject image: {e}")
        update_data["image_url"] = data.image_url
    
    await db.subjects.update_one({"id": subject_id}, {"$set": update_data})
    
    updated_subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    
    logger.info(f"Subject updated: {subject_id} by {user['id']}")
    
    return {"message": "Asignatura actualizada correctamente", "subject": updated_subject}

@api_router.delete("/academic/subjects/{subject_id}")
async def delete_subject(subject_id: str, current_user = Depends(get_current_user)):
    """Delete a subject"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar asignaturas")
    
    school_id = user["school_id"]
    
    # Check subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Check if subject is linked to schedules
    schedule_link = await db.schedules.find_one({"subject_id": subject_id, "school_id": school_id})
    if schedule_link:
        raise HTTPException(status_code=400, detail="No se puede eliminar: la asignatura está vinculada a horarios")
    
    # Delete subject and related teacher assignments
    await db.subject_teachers.delete_many({"subject_id": subject_id, "school_id": school_id})
    await db.subjects.delete_one({"id": subject_id})
    
    logger.info(f"Subject deleted: {subject_id} by {user['id']}")
    
    return {"message": "Asignatura eliminada correctamente"}

# ─────────────────────────────────────────────────────────────────────────────
# SUBJECT TEACHERS ASSIGNMENT
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/academic/subjects/{subject_id}/teachers")
async def get_subject_teachers(subject_id: str, current_user = Depends(get_current_user)):
    """Get teachers assigned to a subject"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Check subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Get teacher assignments
    assignments = await db.subject_teachers.find(
        {"subject_id": subject_id, "school_id": school_id},
        {"_id": 0}
    ).to_list(100)
    
    teacher_ids = [a["teacher_id"] for a in assignments]
    
    # Get teacher details
    teachers = []
    if teacher_ids:
        teachers_cursor = db.users.find(
            {"id": {"$in": teacher_ids}, "school_id": school_id},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "email": 1, "photo_url": 1, "activo": 1}
        )
        teachers = await teachers_cursor.to_list(100)
    
    return {"subject_id": subject_id, "teachers": teachers}

@api_router.post("/academic/subjects/{subject_id}/teachers")
async def assign_subject_teachers(subject_id: str, data: SubjectTeacherAssign, current_user = Depends(get_current_user)):
    """Assign teachers to a subject"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para asignar profesores")
    
    school_id = user["school_id"]
    
    # Check subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    if subject.get("status") != "active":
        raise HTTPException(status_code=400, detail="No se pueden asignar profesores a una asignatura inactiva")
    
    # Remove all current assignments
    await db.subject_teachers.delete_many({"subject_id": subject_id, "school_id": school_id})
    
    # Add new assignments
    now = datetime.now(timezone.utc).isoformat()
    
    for teacher_id in data.teacher_ids:
        # Verify teacher exists and is a teacher
        teacher = await db.users.find_one({
            "id": teacher_id,
            "school_id": school_id,
            "role": "teacher"
        })
        
        if teacher:
            assignment = {
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "subject_id": subject_id,
                "teacher_id": teacher_id,
                "created_at": now
            }
            await db.subject_teachers.insert_one(assignment)
    
    logger.info(f"Teachers assigned to subject {subject_id}: {data.teacher_ids} by {user['id']}")
    
    return {"message": "Profesores asignados correctamente", "count": len(data.teacher_ids)}

@api_router.delete("/academic/subjects/{subject_id}/teachers/{teacher_id}")
async def remove_subject_teacher(subject_id: str, teacher_id: str, current_user = Depends(get_current_user)):
    """Remove a teacher from a subject"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para desasignar profesores")
    
    school_id = user["school_id"]
    
    result = await db.subject_teachers.delete_one({
        "subject_id": subject_id,
        "teacher_id": teacher_id,
        "school_id": school_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    logger.info(f"Teacher {teacher_id} removed from subject {subject_id} by {user['id']}")
    
    return {"message": "Profesor desasignado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD BANNERS (CAROUSEL)
# ══════════════════════════════════════════════════════════════════════════════

class BannerCreate(BaseModel):
    image_url: str
    title: Optional[str] = ""
    description: Optional[str] = ""
    order: Optional[int] = 0
    active: Optional[bool] = True

class BannerUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    active: Optional[bool] = None

class BannerReorder(BaseModel):
    banner_ids: List[str]

@api_router.get("/dashboard/banners")
async def get_dashboard_banners(current_user = Depends(get_current_user)):
    """Get all dashboard banners for the current tenant"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    banners = await db.dashboard_banners.find(
        {"school_id": user["school_id"]},
        {"_id": 0}
    ).sort("order", 1).to_list(50)
    
    return banners

@api_router.get("/dashboard/banners/active")
async def get_active_dashboard_banners(current_user = Depends(get_current_user)):
    """Get only active dashboard banners for display"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    banners = await db.dashboard_banners.find(
        {"school_id": user["school_id"], "active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(50)
    
    return banners

@api_router.post("/dashboard/banners")
async def create_dashboard_banner(data: BannerCreate, current_user = Depends(get_current_user)):
    """Create a new dashboard banner - only for owners/super admins"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check if user is owner or super_admin
    if not (user.get("is_owner") or user.get("is_super_admin") or user.get("role") in ["owner", "super_admin", "director"]):
        raise HTTPException(status_code=403, detail="Solo el propietario puede administrar el carrusel")
    
    school_id = user["school_id"]
    
    # Get current max order
    max_order_banner = await db.dashboard_banners.find_one(
        {"school_id": school_id},
        sort=[("order", -1)]
    )
    next_order = (max_order_banner.get("order", 0) + 1) if max_order_banner else 0
    
    banner_id = str(uuid.uuid4())
    banner_doc = {
        "id": banner_id,
        "school_id": school_id,
        "image_url": data.image_url,
        "title": data.title[:60] if data.title else "",  # Max 60 chars
        "description": data.description[:120] if data.description else "",  # Max 120 chars
        "order": data.order if data.order > 0 else next_order,
        "active": data.active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.dashboard_banners.insert_one(banner_doc)
    
    logger.info(f"Dashboard banner created: {banner_id} for school {school_id}")
    
    return {"message": "Banner creado correctamente", "banner": {k: v for k, v in banner_doc.items() if k != "_id"}}

@api_router.put("/dashboard/banners/{banner_id}")
async def update_dashboard_banner(banner_id: str, data: BannerUpdate, current_user = Depends(get_current_user)):
    """Update a dashboard banner"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not (user.get("is_owner") or user.get("is_super_admin") or user.get("role") in ["owner", "super_admin", "director"]):
        raise HTTPException(status_code=403, detail="Solo el propietario puede administrar el carrusel")
    
    banner = await db.dashboard_banners.find_one({"id": banner_id, "school_id": user["school_id"]})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    
    update_data = {}
    if data.title is not None:
        update_data["title"] = data.title[:60]  # Max 60 chars
    if data.description is not None:
        update_data["description"] = data.description[:120]  # Max 120 chars
    if data.order is not None:
        update_data["order"] = data.order
    if data.active is not None:
        update_data["active"] = data.active
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.dashboard_banners.update_one({"id": banner_id}, {"$set": update_data})
    
    return {"message": "Banner actualizado correctamente"}

@api_router.put("/dashboard/banners/reorder")
async def reorder_dashboard_banners(data: BannerReorder, current_user = Depends(get_current_user)):
    """Reorder dashboard banners"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not (user.get("is_owner") or user.get("is_super_admin") or user.get("role") in ["owner", "super_admin", "director"]):
        raise HTTPException(status_code=403, detail="Solo el propietario puede administrar el carrusel")
    
    # Update order for each banner
    for index, banner_id in enumerate(data.banner_ids):
        await db.dashboard_banners.update_one(
            {"id": banner_id, "school_id": user["school_id"]},
            {"$set": {"order": index, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Orden actualizado correctamente"}

@api_router.delete("/dashboard/banners/{banner_id}")
async def delete_dashboard_banner(banner_id: str, current_user = Depends(get_current_user)):
    """Delete a dashboard banner"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not (user.get("is_owner") or user.get("is_super_admin") or user.get("role") in ["owner", "super_admin", "director"]):
        raise HTTPException(status_code=403, detail="Solo el propietario puede administrar el carrusel")
    
    result = await db.dashboard_banners.delete_one({"id": banner_id, "school_id": user["school_id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    
    logger.info(f"Dashboard banner deleted: {banner_id}")
    
    return {"message": "Banner eliminado correctamente"}

# ══════════════════════════════════════════════════════════════════════════════
# ACADEMIC ASSIGNMENTS API (Teacher-Subject Pivot Table)
# ══════════════════════════════════════════════════════════════════════════════

class AcademicAssignmentCreate(BaseModel):
    teacher_id: str
    level_id: str
    grade_id: str
    section_id: str
    subject_id: str
    academic_year_id: Optional[str] = None  # Changed from period_id - assignments are ANNUAL
    school_year: int = 2026  # Keep for backward compatibility
    role: Literal["titular", "auxiliar"] = "titular"
    status: Literal["activo", "inactivo"] = "activo"

class AcademicAssignmentUpdate(BaseModel):
    teacher_id: Optional[str] = None
    level_id: Optional[str] = None
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    subject_id: Optional[str] = None
    academic_year_id: Optional[str] = None  # Changed from period_id
    school_year: Optional[int] = None
    role: Optional[Literal["titular", "auxiliar"]] = None
    status: Optional[Literal["activo", "inactivo"]] = None

@api_router.get("/academic/assignments")
async def get_academic_assignments(
    level_id: Optional[str] = None,
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    school_year: Optional[int] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all academic assignments with optional filters"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    query = {"school_id": school_id}
    
    # Apply filters
    if level_id:
        query["level_id"] = level_id
    if grade_id:
        query["grade_id"] = grade_id
    if section_id:
        query["section_id"] = section_id
    if subject_id:
        query["subject_id"] = subject_id
    if teacher_id:
        query["teacher_id"] = teacher_id
    if school_year:
        query["school_year"] = school_year
    if status:
        query["status"] = status
    
    assignments = await db.academic_assignments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with related data
    if assignments:
        # Get all unique IDs
        teacher_ids = list(set(a["teacher_id"] for a in assignments))
        level_ids = list(set(a["level_id"] for a in assignments))
        grade_ids = list(set(a["grade_id"] for a in assignments))
        section_ids = list(set(a["section_id"] for a in assignments))
        subject_ids = list(set(a["subject_id"] for a in assignments))
        
        # Fetch related data
        teachers = await db.users.find({"id": {"$in": teacher_ids}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}).to_list(500)
        levels = await db.academic_levels.find({"id": {"$in": level_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
        grades = await db.grades.find({"id": {"$in": grade_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
        sections = await db.sections.find({"id": {"$in": section_ids}}, {"_id": 0, "id": 1, "nombre": 1}).to_list(100)
        subjects = await db.subjects.find({"id": {"$in": subject_ids}}, {"_id": 0, "id": 1, "name": 1, "code": 1, "color": 1}).to_list(500)
        
        # Get academic years for assignments that have academic_year_id
        year_ids = list(set([a.get("academic_year_id") for a in assignments if a.get("academic_year_id")]))
        years = await db.academic_years.find({"id": {"$in": year_ids}}, {"_id": 0, "id": 1, "year": 1, "status": 1}).to_list(50) if year_ids else []
        
        # Create lookup maps
        teachers_map = {t["id"]: t for t in teachers}
        levels_map = {l["id"]: l for l in levels}
        grades_map = {g["id"]: g for g in grades}
        sections_map = {s["id"]: s for s in sections}
        subjects_map = {s["id"]: s for s in subjects}
        years_map = {y["id"]: y for y in years}
        
        # Enrich assignments
        for a in assignments:
            teacher = teachers_map.get(a["teacher_id"], {})
            a["teacher_name"] = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
            a["teacher_photo"] = teacher.get("photo_url")
            
            level = levels_map.get(a["level_id"], {})
            a["level_name"] = level.get("nombre", "")
            
            grade = grades_map.get(a["grade_id"], {})
            a["grade_name"] = grade.get("nombre", "")
            
            section = sections_map.get(a["section_id"], {})
            a["section_name"] = section.get("nombre", "")
            
            subject = subjects_map.get(a["subject_id"], {})
            a["subject_name"] = subject.get("name", "")
            a["subject_code"] = subject.get("code", "")
            a["subject_color"] = subject.get("color", "#3B82F6")
            
            # Add academic year info
            if a.get("academic_year_id"):
                year_data = years_map.get(a["academic_year_id"], {})
                a["academic_year"] = year_data.get("year", a.get("school_year"))
                a["academic_year_status"] = year_data.get("status", "")
    
    return assignments

@api_router.get("/academic/assignments/by-teacher/{teacher_id}")
async def get_assignments_by_teacher(
    teacher_id: str,
    school_year: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    """Get all assignments for a specific teacher (for profile view)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    query = {"school_id": school_id, "teacher_id": teacher_id, "status": "activo"}
    
    if school_year:
        query["school_year"] = school_year
    
    assignments = await db.academic_assignments.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with related data
    for a in assignments:
        level = await db.academic_levels.find_one({"id": a["level_id"]}, {"_id": 0, "nombre": 1})
        grade = await db.grades.find_one({"id": a["grade_id"]}, {"_id": 0, "nombre": 1})
        section = await db.sections.find_one({"id": a["section_id"]}, {"_id": 0, "nombre": 1})
        subject = await db.subjects.find_one({"id": a["subject_id"]}, {"_id": 0, "name": 1, "code": 1, "color": 1})
        
        a["level_name"] = level.get("nombre", "") if level else ""
        a["grade_name"] = grade.get("nombre", "") if grade else ""
        a["section_name"] = section.get("nombre", "") if section else ""
        a["subject_name"] = subject.get("name", "") if subject else ""
        a["subject_code"] = subject.get("code", "") if subject else ""
        a["subject_color"] = subject.get("color", "#3B82F6") if subject else "#3B82F6"
    
    return assignments

@api_router.get("/academic/assignments/teachers-summary")
async def get_teachers_assignments_summary(
    school_year: Optional[int] = 2026,
    current_user = Depends(get_current_user)
):
    """Get summary of assignments per teacher (for load visualization)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Get all active teachers
    teachers = await db.users.find(
        {"school_id": school_id, "role": "teacher", "status": {"$ne": "inactive"}},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}
    ).to_list(500)
    
    # Get assignment counts per teacher
    result = []
    for teacher in teachers:
        count = await db.academic_assignments.count_documents({
            "school_id": school_id,
            "teacher_id": teacher["id"],
            "school_year": school_year,
            "status": "activo"
        })
        result.append({
            "id": teacher["id"],
            "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(),
            "photo_url": teacher.get("photo_url"),
            "assignments_count": count
        })
    
    # Sort by assignment count descending
    result.sort(key=lambda x: x["assignments_count"], reverse=True)
    
    return result

@api_router.post("/academic/assignments")
async def create_academic_assignment(
    data: AcademicAssignmentCreate,
    current_user = Depends(get_current_user)
):
    """Create a new academic assignment"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear asignaciones")
    
    school_id = user["school_id"]
    
    # Validate teacher exists and is a teacher
    teacher = await db.users.find_one({
        "id": data.teacher_id,
        "school_id": school_id,
        "role": "teacher"
    })
    if not teacher:
        raise HTTPException(status_code=404, detail="Profesor no encontrado")
    
    # Validate level exists
    level = await db.academic_levels.find_one({"id": data.level_id, "school_id": school_id})
    if not level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    
    # Validate grade exists and belongs to level
    grade = await db.grades.find_one({
        "id": data.grade_id,
        "school_id": school_id,
        "nivel_id": data.level_id
    })
    if not grade:
        raise HTTPException(status_code=404, detail="Grado no encontrado o no pertenece al nivel")
    
    # Validate section exists
    section = await db.sections.find_one({
        "id": data.section_id,
        "school_id": school_id
    })
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    
    # Validate subject exists
    subject = await db.subjects.find_one({
        "id": data.subject_id,
        "school_id": school_id
    })
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Validate academic year if provided
    academic_year = None
    if data.academic_year_id:
        academic_year = await db.academic_years.find_one({
            "id": data.academic_year_id,
            "school_id": school_id
        })
        if not academic_year:
            raise HTTPException(status_code=404, detail="Año académico no encontrado")
        # Update school_year from the academic year
        data.school_year = academic_year.get("year", data.school_year)
    
    # Check for exact duplicate - now using academic_year_id
    duplicate_query = {
        "school_id": school_id,
        "teacher_id": data.teacher_id,
        "level_id": data.level_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "subject_id": data.subject_id,
    }
    # Add year criterion
    if data.academic_year_id:
        duplicate_query["academic_year_id"] = data.academic_year_id
    else:
        duplicate_query["school_year"] = data.school_year
    
    duplicate = await db.academic_assignments.find_one(duplicate_query)
    if duplicate:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una asignación exacta para este profesor, asignatura, nivel, grado, sección y año escolar"
        )
    
    assignment = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "teacher_id": data.teacher_id,
        "level_id": data.level_id,
        "grade_id": data.grade_id,
        "section_id": data.section_id,
        "subject_id": data.subject_id,
        "academic_year_id": data.academic_year_id,
        "school_year": data.school_year,
        "role": data.role,
        "status": data.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.academic_assignments.insert_one(assignment)
    
    # Remove _id for response
    if "_id" in assignment:
        del assignment["_id"]
    
    # Enrich response
    assignment["teacher_name"] = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip()
    assignment["level_name"] = level.get("nombre", "")
    assignment["grade_name"] = grade.get("nombre", "")
    assignment["section_name"] = section.get("nombre", "")
    assignment["subject_name"] = subject.get("name", "")
    
    logger.info(f"Academic assignment created: {assignment['id']} for school {school_id}")
    
    return {"message": "Asignación creada correctamente", "assignment": assignment}

@api_router.put("/academic/assignments/{assignment_id}")
async def update_academic_assignment(
    assignment_id: str,
    data: AcademicAssignmentUpdate,
    current_user = Depends(get_current_user)
):
    """Update an academic assignment"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar asignaciones")
    
    school_id = user["school_id"]
    
    assignment = await db.academic_assignments.find_one({
        "id": assignment_id,
        "school_id": school_id
    })
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    update_data = {}
    
    # Validate and update each field
    if data.teacher_id is not None:
        teacher = await db.users.find_one({"id": data.teacher_id, "school_id": school_id, "role": "teacher"})
        if not teacher:
            raise HTTPException(status_code=404, detail="Profesor no encontrado")
        update_data["teacher_id"] = data.teacher_id
    
    if data.level_id is not None:
        level = await db.academic_levels.find_one({"id": data.level_id, "school_id": school_id})
        if not level:
            raise HTTPException(status_code=404, detail="Nivel no encontrado")
        update_data["level_id"] = data.level_id
    
    if data.grade_id is not None:
        grade = await db.grades.find_one({"id": data.grade_id, "school_id": school_id})
        if not grade:
            raise HTTPException(status_code=404, detail="Grado no encontrado")
        update_data["grade_id"] = data.grade_id
    
    if data.section_id is not None:
        section = await db.sections.find_one({"id": data.section_id, "school_id": school_id})
        if not section:
            raise HTTPException(status_code=404, detail="Sección no encontrada")
        update_data["section_id"] = data.section_id
    
    if data.subject_id is not None:
        subject = await db.subjects.find_one({"id": data.subject_id, "school_id": school_id})
        if not subject:
            raise HTTPException(status_code=404, detail="Asignatura no encontrada")
        update_data["subject_id"] = data.subject_id
    
    if data.academic_year_id is not None:
        academic_year = await db.academic_years.find_one({"id": data.academic_year_id, "school_id": school_id})
        if not academic_year:
            raise HTTPException(status_code=404, detail="Año académico no encontrado")
        update_data["academic_year_id"] = data.academic_year_id
        update_data["school_year"] = academic_year.get("year", data.school_year if data.school_year else assignment.get("school_year"))
    
    if data.school_year is not None and data.academic_year_id is None:
        update_data["school_year"] = data.school_year
    
    if data.role is not None:
        update_data["role"] = data.role
    
    if data.status is not None:
        update_data["status"] = data.status
    
    if update_data:
        # Check for duplicate after update
        check_data = {**assignment, **update_data}
        duplicate_query = {
            "school_id": school_id,
            "teacher_id": check_data["teacher_id"],
            "level_id": check_data["level_id"],
            "grade_id": check_data["grade_id"],
            "section_id": check_data["section_id"],
            "subject_id": check_data["subject_id"],
            "id": {"$ne": assignment_id}  # Exclude current assignment
        }
        # Add year criterion
        if check_data.get("academic_year_id"):
            duplicate_query["academic_year_id"] = check_data["academic_year_id"]
        else:
            duplicate_query["school_year"] = check_data.get("school_year")
        
        duplicate = await db.academic_assignments.find_one(duplicate_query)
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Ya existe una asignación con esta combinación"
            )
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.academic_assignments.update_one({"id": assignment_id}, {"$set": update_data})
    
    updated = await db.academic_assignments.find_one({"id": assignment_id}, {"_id": 0})
    
    return {"message": "Asignación actualizada correctamente", "assignment": updated}

@api_router.delete("/academic/assignments/{assignment_id}")
async def delete_academic_assignment(
    assignment_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an academic assignment"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar asignaciones")
    
    school_id = user["school_id"]
    
    result = await db.academic_assignments.delete_one({
        "id": assignment_id,
        "school_id": school_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    logger.info(f"Academic assignment deleted: {assignment_id}")
    
    return {"message": "Asignación eliminada correctamente"}

@api_router.get("/users/teachers/active")
async def get_active_teachers(
    current_user = Depends(get_current_user)
):
    """Get all active teachers for the school"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    teachers = await db.users.find(
        {
            "school_id": school_id,
            "role": "teacher",
            "status": {"$ne": "inactive"}
        },
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1}
    ).sort("name", 1).to_list(500)
    
    return teachers



# ══════════════════════════════════════════════════════════════════════════════
# COURSE FEED API - Posts, Likes, Comments
# ══════════════════════════════════════════════════════════════════════════════

class CoursePostCreate(BaseModel):
    subject_id: str
    title: Optional[str] = None  # Required for task, material, forum
    content: str = ""
    post_type: Literal["announcement", "task", "material", "forum"] = "announcement"
    image_url: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    # Google Drive fields
    drive_file_id: Optional[str] = None
    storage_type: Optional[str] = None  # "google_drive" or "cloudinary"
    # Metadata for tasks: due_date, delivery_type, show_to_students, points
    metadata: Optional[dict] = None
    # Cloudinary data for proper file handling
    cloudinary_data: Optional[dict] = None

class CoursePostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    # Metadata for tasks: due_date, delivery_type, show_to_students, points
    metadata: Optional[dict] = None

class PostCommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None  # For reply to another comment

@api_router.get("/course/{subject_id}/posts")
async def get_course_posts(
    subject_id: str,
    post_type: Optional[str] = Query(None, description="Filter by type: announcement, task, material, forum"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user)
):
    """Get all posts for a course/subject, optionally filtered by type"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_id = user["id"]
    
    # Verify subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Build query filter - only show active posts (not archived or deleted)
    query_filter = {
        "subject_id": subject_id, 
        "school_id": school_id, 
        "status": "active",
        "deleted_at": {"$exists": False}
    }
    
    # Filter by type if specified
    if post_type and post_type in ["announcement", "task", "material", "forum"]:
        query_filter["post_type"] = post_type
    
    # Get posts
    posts = await db.course_posts.find(
        query_filter,
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Get total count
    total = await db.course_posts.count_documents(query_filter)
    
    # Enrich posts with author info, likes count, user's like status, and comments count
    for post in posts:
        # Get author info
        author = await db.users.find_one(
            {"id": post.get("author_id")},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
        )
        post["author"] = author
        
        # Get likes count
        likes_count = await db.post_likes.count_documents({"post_id": post["id"]})
        post["likes_count"] = likes_count
        
        # Check if current user liked this post
        user_like = await db.post_likes.find_one({"post_id": post["id"], "user_id": user_id})
        post["user_liked"] = user_like is not None
        
        # Get comments count
        comments_count = await db.post_comments.count_documents({"post_id": post["id"], "status": "active"})
        post["comments_count"] = comments_count
        
        # For tasks, add submissions count
        if post.get("post_type") == "task" or post.get("type") == "task":
            submissions = post.get("submissions", [])
            post["submissions_count"] = len(submissions)
            post["graded_count"] = sum(1 for s in submissions if s.get("grade") is not None)
    
    return {"posts": posts, "total": total}

@api_router.post("/course/{subject_id}/posts")
async def create_course_post(
    subject_id: str,
    data: CoursePostCreate,
    current_user = Depends(get_current_user)
):
    """Create a new post in a course"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Validate: must have content or attachment (file_url or drive_file_id)
    if not data.content.strip() and not data.image_url and not data.file_url and not data.drive_file_id:
        raise HTTPException(status_code=400, detail="La publicación debe tener texto, imagen o archivo")
    
    # For task, material, forum - title is required
    if data.post_type in ["task", "material", "forum"]:
        if not data.title or not data.title.strip():
            raise HTTPException(status_code=400, detail="El título es obligatorio para este tipo de publicación")
    
    # Verify subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Get active academic year
    active_year = await db.academic_years.find_one({"school_id": school_id, "status": "activo"})
    academic_year_id = active_year["id"] if active_year else None
    
    now = datetime.now(timezone.utc).isoformat()
    
    post = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "subject_id": subject_id,
        "academic_year_id": academic_year_id,
        "author_id": user["id"],
        "title": data.title.strip() if data.title else None,
        "content": data.content.strip(),
        "post_type": data.post_type,
        "image_url": data.image_url,
        "file_url": data.file_url,
        "file_name": data.file_name,
        "file_type": data.file_type,
        "file_size": data.file_size,
        "drive_file_id": data.drive_file_id,
        "storage_type": data.storage_type,
        "status": "active",
        "created_at": now,
        "updated_at": now
    }
    
    # Store Cloudinary metadata for proper file handling (download, etc.)
    if data.cloudinary_data:
        post["cloudinary_data"] = data.cloudinary_data
    
    # Store metadata for tasks (due_date, delivery_type, points, etc.)
    if data.metadata:
        post["metadata"] = data.metadata
        # Also store due_date at root level for easier querying
        if data.post_type == "task" and data.metadata.get("due_date"):
            post["due_date"] = data.metadata["due_date"]
        if data.post_type == "task" and data.metadata.get("points"):
            post["max_grade"] = data.metadata["points"]
    
    await db.course_posts.insert_one(post)
    
    # Register activity in the course stream
    activity_type_map = {
        "announcement": "announcement",
        "material": "material_uploaded",
        "task": "task_assigned",
        "forum": "post_created"
    }
    activity_type = activity_type_map.get(data.post_type, "post_created")
    
    activity_title_map = {
        "announcement": "publicó un aviso",
        "material": "subió nuevo material",
        "task": "asignó una tarea",
        "forum": "publicó en el foro"
    }
    activity_desc = activity_title_map.get(data.post_type, "publicó algo")
    
    await register_course_activity(
        school_id=user["school_id"],
        subject_id=data.subject_id,
        activity_type=activity_type,
        user_id=user["id"],
        user_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        user_photo=user.get("photo_url"),
        title=activity_desc,
        description=data.title or (data.content[:100] + "..." if len(data.content) > 100 else data.content),
        reference_id=post["id"],
        reference_type="post"
    )
    
    # Create notification for task, material, forum posts
    if data.post_type in ["task", "material", "forum"]:
        notification_titles = {
            "task": "Nueva tarea publicada",
            "material": "Nuevo material de estudio",
            "forum": "Nuevo tema en el foro"
        }
        notification_messages = {
            "task": f"Se ha asignado una nueva tarea: {data.title}",
            "material": f"Se ha subido nuevo material: {data.title}",
            "forum": f"Nuevo tema de discusión: {data.title}"
        }
        
        await create_notification_for_subject(
            school_id=school_id,
            subject_id=subject_id,
            title=notification_titles.get(data.post_type, "Nueva publicación"),
            message=notification_messages.get(data.post_type, data.title or ""),
            notification_type=data.post_type,
            reference_id=post["id"],
            author_id=user["id"],
            author_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip()
        )
    
    # Return post with author info
    post_copy = {k: v for k, v in post.items() if k != "_id"}
    post_copy["author"] = {
        "id": user["id"],
        "name": user.get("name", ""),
        "last_name": user.get("last_name", ""),
        "photo_url": user.get("photo_url"),
        "role": user.get("role", "")
    }
    post_copy["likes_count"] = 0
    post_copy["user_liked"] = False
    post_copy["comments_count"] = 0
    
    return {"message": "Publicación creada", "post": post_copy}

@api_router.put("/course/posts/{post_id}")
async def update_course_post(
    post_id: str,
    data: CoursePostUpdate,
    current_user = Depends(get_current_user)
):
    """Update a post (only author can update)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    post = await db.course_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    # Only author or admin can update
    if post["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta publicación")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    
    if data.content is not None:
        if not data.content.strip() and not post.get("image_url") and not post.get("file_url"):
            raise HTTPException(status_code=400, detail="La publicación debe tener contenido")
        update_data["content"] = data.content.strip()
    
    if data.image_url is not None:
        update_data["image_url"] = data.image_url
    
    if data.file_url is not None:
        update_data["file_url"] = data.file_url
        update_data["file_name"] = data.file_name
        update_data["file_type"] = data.file_type
    
    # Handle metadata for tasks
    if data.metadata is not None:
        update_data["metadata"] = data.metadata
        # Also update root-level due_date for backwards compatibility
        if data.metadata.get("due_date"):
            update_data["due_date"] = data.metadata.get("due_date")
    
    await db.course_posts.update_one({"id": post_id}, {"$set": update_data})
    
    # Fetch the updated post to return it
    updated_post = await db.course_posts.find_one({"id": post_id}, {"_id": 0})
    
    return {"message": "Publicación actualizada", "post": updated_post}

@api_router.delete("/course/posts/{post_id}")
async def delete_course_post(
    post_id: str,
    current_user = Depends(get_current_user)
):
    """
    Delete a post (soft delete). 
    For tasks: Only allows deletion if there are NO submissions.
    If task has submissions, returns error - user must archive instead.
    For materials stored in Google Drive: Also deletes the file from Drive.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    post = await db.course_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    # Only author or admin can delete
    if post["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta publicación")
    
    # For tasks: Check if there are submissions
    if post.get("post_type") == "task":
        submissions = post.get("submissions", [])
        submissions_count = len(submissions)
        
        if submissions_count > 0:
            # Cannot delete - has submissions
            graded_count = sum(1 for s in submissions if s.get("grade") is not None)
            raise HTTPException(
                status_code=400, 
                detail={
                    "code": "TASK_HAS_SUBMISSIONS",
                    "message": "Esta tarea tiene entregas y no puede ser eliminada. Usa la opción de archivar.",
                    "submissions_count": submissions_count,
                    "graded_count": graded_count
                }
            )
    
    # For materials stored in Google Drive: Delete from Drive
    if post.get("storage_type") == "google_drive" and post.get("drive_file_id"):
        try:
            school_id = user.get("school_id")
            if school_id:
                service = await get_drive_service(school_id)
                service.files().delete(fileId=post["drive_file_id"]).execute()
                logger.info(f"Deleted file from Google Drive: {post.get('drive_file_id')}")
        except Exception as e:
            # Log error but continue with soft delete
            logger.error(f"Error deleting file from Google Drive: {e}")
    
    # Soft delete - do NOT delete files from Cloudinary
    # Files are preserved for potential restoration
    await db.course_posts.update_one(
        {"id": post_id},
        {"$set": {
            "status": "deleted", 
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": user["id"]
        }}
    )
    
    # Create audit log
    audit_log = {
        "id": str(uuid.uuid4()),
        "task_id": post_id,
        "action": "delete",
        "performed_by": user["id"],
        "performed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "school_id": user.get("school_id"),
        "details": {
            "task_title": post.get("title"),
            "had_submissions": False
        }
    }
    await db.task_audit_logs.insert_one(audit_log)
    
    return {"message": "Publicación eliminada"}

@api_router.get("/course/tasks/{task_id}/submission-stats")
async def get_task_submission_stats(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """Get submission statistics for a task before deletion/archiving"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Support both type fields
    task = await db.course_posts.find_one({
        "id": task_id, 
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    submissions = task.get("submissions", [])
    submissions_count = len(submissions)
    graded_count = sum(1 for s in submissions if s.get("grade") is not None)
    
    return {
        "task_id": task_id,
        "title": task.get("title"),
        "submissions_count": submissions_count,
        "graded_count": graded_count,
        "has_submissions": submissions_count > 0,
        "can_delete": submissions_count == 0
    }

@api_router.get("/course/tasks/{task_id}/submissions")
async def get_task_submissions(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get all submissions for a task with student details.
    Used by teachers/owners to view and grade student work.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    # Only admin/teacher can view submissions
    if not is_admin_user(user) and user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Solo profesores o administradores pueden ver las entregas")
    
    # Support both type fields
    task = await db.course_posts.find_one({
        "id": task_id,
        "school_id": school_id,
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    submissions = task.get("submissions", [])
    
    # Enrich submissions with student details
    enriched_submissions = []
    for sub in submissions:
        student_id = sub.get("student_id")
        student = await db.users.find_one(
            {"id": student_id},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "profile_pic": 1, "roll_number": 1}
        )
        
        # Determine submission status (on time or late)
        due_date = task.get("due_date") or task.get("metadata", {}).get("due_date")
        submitted_at = sub.get("submitted_at")
        status = "a_tiempo"  # Default to on time
        
        if due_date and submitted_at:
            try:
                if isinstance(due_date, str):
                    deadline = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                else:
                    deadline = due_date
                    
                if isinstance(submitted_at, str):
                    submit_time = datetime.fromisoformat(submitted_at.replace('Z', '+00:00'))
                else:
                    submit_time = submitted_at
                    
                if submit_time > deadline:
                    status = "tarde"
            except (ValueError, TypeError):
                pass
        
        enriched_submissions.append({
            "id": sub.get("id") or f"{student_id}_{sub.get('submitted_at', '')}",  # Generate fallback ID for old submissions
            "student_id": student_id,
            "student": {
                "id": student.get("id") if student else student_id,
                "name": f"{student.get('name', '')} {student.get('last_name', '')}".strip() if student else sub.get("student_name", "Estudiante desconocido"),
                "photo_url": student.get("photo_url") or student.get("profile_pic") if student else None,
                "roll_number": student.get("roll_number") if student else None
            },
            "text_content": sub.get("text_content"),
            "file_url": sub.get("file_url"),
            "file_name": sub.get("file_name"),
            "file_type": sub.get("file_type"),
            "drive_file_id": sub.get("drive_file_id"),
            "storage_type": sub.get("storage_type"),
            "submitted_at": submitted_at,
            "status": status,
            "grade": sub.get("grade"),
            "feedback": sub.get("feedback")
        })
    
    # Sort by submitted_at (most recent first)
    enriched_submissions.sort(key=lambda x: x.get("submitted_at", ""), reverse=True)
    
    return {
        "task_id": task_id,
        "task_title": task.get("title"),
        "max_grade": task.get("max_grade") or task.get("metadata", {}).get("points", 20),
        "due_date": task.get("due_date") or task.get("metadata", {}).get("due_date"),
        "submissions_count": len(submissions),
        "graded_count": sum(1 for s in submissions if s.get("grade") is not None),
        "submissions": enriched_submissions
    }

class GradeSubmissionRequest(BaseModel):
    grade: Optional[float] = None
    feedback: Optional[str] = None

@api_router.put("/course/tasks/{task_id}/submissions/{submission_id}/grade")
async def grade_task_submission(
    task_id: str,
    submission_id: str,
    data: GradeSubmissionRequest,
    current_user = Depends(get_current_user)
):
    """
    Grade a student's submission.
    Teachers/owners can set a grade and feedback for each submission.
    """
    logger.info(f"Grading submission: task_id={task_id}, submission_id={submission_id}, data={data}")
    
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    logger.info(f"User school_id: {school_id}, user_role: {user.get('role')}")
    
    # Only admin/teacher can grade
    if not is_admin_user(user) and user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Solo profesores o administradores pueden calificar")
    
    # Support both type fields
    task = await db.course_posts.find_one({
        "id": task_id,
        "school_id": school_id,
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    
    logger.info(f"Task found: {task is not None}")
    
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Find the submission
    submissions = task.get("submissions", [])
    logger.info(f"Number of submissions: {len(submissions)}")
    
    submission_idx = None
    for idx, sub in enumerate(submissions):
        logger.info(f"Checking submission {idx}: id={sub.get('id')}")
        if sub.get("id") == submission_id:
            submission_idx = idx
            break
    
    if submission_idx is None:
        # Try to find by fallback ID pattern (student_id_submitted_at) or by student_id
        for idx, sub in enumerate(submissions):
            fallback_id = f"{sub.get('student_id', '')}_{sub.get('submitted_at', '')}"
            if fallback_id == submission_id or sub.get("student_id") == submission_id:
                submission_idx = idx
                logger.info(f"Found submission by fallback ID at index {idx}")
                break
    
    if submission_idx is None:
        logger.error(f"Submission not found: {submission_id}")
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    
    # Validate grade against max_grade
    max_grade = task.get("max_grade") or task.get("metadata", {}).get("points") or 20
    if max_grade <= 0:
        max_grade = 20  # Default if no valid max_grade
    
    logger.info(f"Max grade: {max_grade}, Data grade: {data.grade}")
    
    if data.grade is not None:
        if data.grade < 0:
            raise HTTPException(status_code=400, detail="La nota no puede ser negativa")
        if data.grade > max_grade:
            raise HTTPException(status_code=400, detail=f"La nota no puede ser mayor a {max_grade}")
    
    # Build update
    update_fields = {
        f"submissions.{submission_idx}.graded_at": datetime.now(timezone.utc).isoformat(),
        f"submissions.{submission_idx}.graded_by": user["id"]
    }
    
    if data.grade is not None:
        update_fields[f"submissions.{submission_idx}.grade"] = data.grade
    
    if data.feedback is not None:
        update_fields[f"submissions.{submission_idx}.feedback"] = data.feedback.strip()
    
    logger.info(f"Updating task {task_id} with fields: {update_fields}")
    
    # Update the submission
    try:
        result = await db.course_posts.update_one(
            {"id": task_id},
            {"$set": update_fields}
        )
        logger.info(f"Update result: matched={result.matched_count}, modified={result.modified_count}")
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")
    
    return {
        "message": "Calificación guardada exitosamente",
        "grade": data.grade,
        "feedback": data.feedback
    }

@api_router.post("/course/tasks/{task_id}/archive")
async def archive_task(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """
    Archive a task. Used when task has submissions and cannot be deleted.
    Preserves all data: submissions, grades, files.
    Task becomes invisible in main view but data remains for reports.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Support both type fields
    task = await db.course_posts.find_one({
        "id": task_id, 
        "$or": [{"post_type": "task"}, {"type": "task"}]
    }, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Only author or admin can archive
    if task["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para archivar esta tarea")
    
    if task.get("status") == "archived":
        raise HTTPException(status_code=400, detail="Esta tarea ya está archivada")
    
    submissions = task.get("submissions", [])
    submissions_count = len(submissions)
    graded_count = sum(1 for s in submissions if s.get("grade") is not None)
    
    # Archive the task
    await db.course_posts.update_one(
        {"id": task_id},
        {"$set": {
            "status": "archived",
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "archived_by": user["id"]
        }}
    )
    
    # Create audit log
    audit_log = {
        "id": str(uuid.uuid4()),
        "task_id": task_id,
        "action": "archive",
        "performed_by": user["id"],
        "performed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "school_id": user.get("school_id"),
        "details": {
            "task_title": task.get("title"),
            "submissions_count": submissions_count,
            "graded_count": graded_count
        }
    }
    await db.task_audit_logs.insert_one(audit_log)
    
    return {
        "message": "Tarea archivada correctamente",
        "task_id": task_id,
        "archived_at": audit_log["timestamp"]
    }

@api_router.post("/course/tasks/{task_id}/restore")
async def restore_task(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """Restore an archived task back to active status"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    task = await db.course_posts.find_one({"id": task_id, "post_type": "task"}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Only author or admin can restore
    if task["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para restaurar esta tarea")
    
    if task.get("status") == "active":
        raise HTTPException(status_code=400, detail="Esta tarea ya está activa")
    
    # Restore the task
    await db.course_posts.update_one(
        {"id": task_id},
        {
            "$set": {
                "status": "active",
                "restored_at": datetime.now(timezone.utc).isoformat(),
                "restored_by": user["id"]
            },
            "$unset": {
                "archived_at": "",
                "archived_by": "",
                "deleted_at": "",
                "deleted_by": ""
            }
        }
    )
    
    # Create audit log
    audit_log = {
        "id": str(uuid.uuid4()),
        "task_id": task_id,
        "action": "restore",
        "performed_by": user["id"],
        "performed_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "school_id": user.get("school_id"),
        "details": {
            "task_title": task.get("title"),
            "previous_status": task.get("status")
        }
    }
    await db.task_audit_logs.insert_one(audit_log)
    
    return {
        "message": "Tarea restaurada correctamente",
        "task_id": task_id
    }

@api_router.get("/course/{subject_id}/tasks/archived")
async def get_archived_tasks(
    subject_id: str,
    current_user = Depends(get_current_user)
):
    """Get all archived tasks for a subject"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get archived tasks
    tasks = await db.course_posts.find(
        {
            "subject_id": subject_id,
            "post_type": "task",
            "status": "archived"
        },
        {"_id": 0}
    ).sort("archived_at", -1).to_list(100)
    
    # Enrich with submission counts
    for task in tasks:
        submissions = task.get("submissions", [])
        task["submissions_count"] = len(submissions)
        task["graded_count"] = sum(1 for s in submissions if s.get("grade") is not None)
        
        # Get archiver info
        if task.get("archived_by"):
            archiver = await db.users.find_one(
                {"id": task["archived_by"]},
                {"_id": 0, "name": 1, "last_name": 1}
            )
            if archiver:
                task["archived_by_name"] = f"{archiver.get('name', '')} {archiver.get('last_name', '')}".strip()
    
    return {"tasks": tasks, "total": len(tasks)}

# ═══════════════════════════════════════════════════════════════════
# LIKES
# ═══════════════════════════════════════════════════════════════════

@api_router.post("/course/posts/{post_id}/like")
async def toggle_post_like(
    post_id: str,
    current_user = Depends(get_current_user)
):
    """Toggle like on a post (like/unlike)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    
    # Check if post exists
    post = await db.course_posts.find_one({"id": post_id, "status": "active"})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    # Check if user already liked
    existing_like = await db.post_likes.find_one({"post_id": post_id, "user_id": user_id})
    
    if existing_like:
        # Unlike
        await db.post_likes.delete_one({"post_id": post_id, "user_id": user_id})
        liked = False
    else:
        # Like
        like = {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.post_likes.insert_one(like)
        liked = True
    
    # Get new likes count
    likes_count = await db.post_likes.count_documents({"post_id": post_id})
    
    return {"liked": liked, "likes_count": likes_count}

# ═══════════════════════════════════════════════════════════════════
# COMMENTS
# ═══════════════════════════════════════════════════════════════════

@api_router.get("/course/posts/{post_id}/comments")
async def get_post_comments(
    post_id: str,
    current_user = Depends(get_current_user)
):
    """Get all comments for a post, organized with replies"""
    # Check if post exists
    post = await db.course_posts.find_one({"id": post_id, "status": "active"})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    comments = await db.post_comments.find(
        {"post_id": post_id, "status": "active"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    
    # Enrich with author info
    for comment in comments:
        author = await db.users.find_one(
            {"id": comment.get("author_id")},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
        )
        comment["author"] = author
    
    # Organize comments: top-level and their replies
    top_level_comments = []
    replies_map = {}
    
    for comment in comments:
        parent_id = comment.get("parent_id")
        if parent_id:
            if parent_id not in replies_map:
                replies_map[parent_id] = []
            replies_map[parent_id].append(comment)
        else:
            top_level_comments.append(comment)
    
    # Attach replies to their parent comments
    for comment in top_level_comments:
        comment["replies"] = replies_map.get(comment["id"], [])
    
    return top_level_comments

@api_router.post("/course/posts/{post_id}/comments")
async def create_post_comment(
    post_id: str,
    data: PostCommentCreate,
    current_user = Depends(get_current_user)
):
    """Add a comment to a post"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío")
    
    # Check if post exists
    post = await db.course_posts.find_one({"id": post_id, "status": "active"})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    now = datetime.now(timezone.utc).isoformat()
    
    comment = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "author_id": user["id"],
        "parent_id": data.parent_id,  # None for top-level comments, ID for replies
        "content": data.content.strip(),
        "status": "active",
        "created_at": now
    }
    
    await db.post_comments.insert_one(comment)
    
    # Register activity in the course stream
    await register_course_activity(
        school_id=user["school_id"],
        subject_id=post.get("subject_id"),
        activity_type="comment_added",
        user_id=user["id"],
        user_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        user_photo=user.get("photo_url"),
        title="comentó en una publicación",
        description=data.content[:80] + "..." if len(data.content) > 80 else data.content,
        reference_id=post_id,
        reference_type="post"
    )
    
    # Return comment with author info
    comment_copy = {k: v for k, v in comment.items() if k != "_id"}
    comment_copy["author"] = {
        "id": user["id"],
        "name": user.get("name", ""),
        "last_name": user.get("last_name", ""),
        "photo_url": user.get("photo_url"),
        "role": user.get("role", "")
    }
    
    return {"message": "Comentario agregado", "comment": comment_copy}

@api_router.delete("/course/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a comment"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    comment = await db.post_comments.find_one({"id": comment_id}, {"_id": 0})
    if not comment:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    
    # Only author or admin can delete
    if comment["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar este comentario")
    
    await db.post_comments.update_one(
        {"id": comment_id},
        {"$set": {"status": "deleted", "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Comentario eliminado"}


# ══════════════════════════════════════════════════════════════════════════════
# COURSE ACTIVITY STREAM - Real-time activity feed (Google Classroom Style)
# ══════════════════════════════════════════════════════════════════════════════

class CourseActivityType(str, Enum):
    post_created = "post_created"           # Profesor publica algo
    material_uploaded = "material_uploaded" # Se sube material
    task_assigned = "task_assigned"         # Se asigna tarea
    task_submitted = "task_submitted"       # Alumno entrega tarea
    comment_added = "comment_added"         # Alguien comenta
    reminder_created = "reminder_created"   # Se crea recordatorio
    announcement = "announcement"           # Aviso publicado
    exam_scheduled = "exam_scheduled"       # Examen programado

# Helper function to register course activity
async def register_course_activity(
    school_id: str,
    subject_id: str,
    activity_type: str,
    user_id: str,
    user_name: str,
    user_photo: str = None,
    title: str = None,
    description: str = None,
    reference_id: str = None,
    reference_type: str = None
):
    """Register a new activity in the course activity stream"""
    activity_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    activity = {
        "id": activity_id,
        "school_id": school_id,
        "subject_id": subject_id,
        "activity_type": activity_type,
        "user_id": user_id,
        "user_name": user_name,
        "user_photo": user_photo,
        "title": title,
        "description": description,
        "reference_id": reference_id,
        "reference_type": reference_type,
        "created_at": now
    }
    
    await db.course_activities.insert_one(activity)
    return activity_id


@api_router.get("/course/{subject_id}/activities")
async def get_course_activities(
    subject_id: str,
    limit: int = 20,
    offset: int = 0,
    current_user = Depends(get_current_user)
):
    """Get activity stream for a course"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Verify subject exists
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Get activities for this course, ordered by most recent
    activities = await db.course_activities.find(
        {"subject_id": subject_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Get total count
    total = await db.course_activities.count_documents({"subject_id": subject_id})
    
    return {
        "activities": activities,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@api_router.get("/course/{subject_id}/sidebar-summary")
async def get_course_sidebar_summary(
    subject_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get sidebar summary for a course - dynamic panel with:
    - Latest news (upcoming exams, tasks, announcements, reminders)
    - Quick access counters (materials, pending tasks, recorded classes)
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Verify subject exists
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    # Calculate date ranges
    week_ago = (now - timedelta(days=7)).isoformat()
    week_ahead = (now + timedelta(days=14)).isoformat()
    
    # ══════════════════════════════════════════════════════════════════════════
    # 1. LATEST NEWS - Dynamic news from course data
    # ══════════════════════════════════════════════════════════════════════════
    news_items = []
    
    # 1a. Get upcoming reminders (exams, tasks, notices) - next 14 days
    upcoming_reminders = await db.course_reminders.find(
        {
            "subject_id": subject_id,
            "status": "active",
            "date": {"$gte": now_iso[:10], "$lte": week_ahead[:10]}
        },
        {"_id": 0, "id": 1, "title": 1, "date": 1, "reminder_type": 1, "is_important": 1}
    ).sort("date", 1).limit(5).to_list(5)
    
    for reminder in upcoming_reminders:
        reminder_type_labels = {
            "exam": "📝 Examen programado",
            "task": "📋 Tarea pendiente",
            "notice": "📢 Aviso"
        }
        news_items.append({
            "id": reminder["id"],
            "type": "reminder",
            "subtype": reminder["reminder_type"],
            "title": reminder["title"],
            "date": reminder["date"],
            "icon": reminder["reminder_type"],
            "is_important": reminder.get("is_important", False),
            "label": reminder_type_labels.get(reminder["reminder_type"], "Recordatorio")
        })
    
    # 1b. Get recent announcements (last 7 days)
    recent_announcements = await db.course_posts.find(
        {
            "subject_id": subject_id,
            "post_type": "announcement",
            "status": "active",
            "created_at": {"$gte": week_ago}
        },
        {"_id": 0, "id": 1, "title": 1, "content": 1, "created_at": 1}
    ).sort("created_at", -1).limit(3).to_list(3)
    
    for post in recent_announcements:
        news_items.append({
            "id": post["id"],
            "type": "announcement",
            "subtype": "announcement",
            "title": post.get("title") or (post["content"][:60] + "..." if len(post["content"]) > 60 else post["content"]),
            "date": post["created_at"][:10],
            "icon": "announcement",
            "is_important": False,
            "label": "📢 Aviso publicado"
        })
    
    # 1c. Get upcoming tasks from posts (next 14 days)
    upcoming_tasks = await db.course_posts.find(
        {
            "subject_id": subject_id,
            "post_type": "task",
            "status": "active",
            "created_at": {"$gte": week_ago}
        },
        {"_id": 0, "id": 1, "title": 1, "content": 1, "created_at": 1}
    ).sort("created_at", -1).limit(3).to_list(3)
    
    for task in upcoming_tasks:
        # Check if not already in news from reminders
        news_items.append({
            "id": task["id"],
            "type": "task",
            "subtype": "task",
            "title": task.get("title") or (task["content"][:60] + "..." if len(task["content"]) > 60 else task["content"]),
            "date": task["created_at"][:10],
            "icon": "task",
            "is_important": False,
            "label": "📋 Nueva tarea"
        })
    
    # Sort news by date (most recent/upcoming first) and limit to 5
    # First important items, then by date
    news_items.sort(key=lambda x: (not x.get("is_important", False), x.get("date", "")))
    news_items = news_items[:5]
    
    # ══════════════════════════════════════════════════════════════════════════
    # 2. QUICK ACCESS COUNTERS - Dynamic counts from course data
    # ══════════════════════════════════════════════════════════════════════════
    
    # Count materials
    materials_count = await db.course_posts.count_documents({
        "subject_id": subject_id,
        "post_type": "material",
        "status": "active"
    })
    
    # Count pending tasks (tasks created in last 30 days)
    month_ago = (now - timedelta(days=30)).isoformat()
    pending_tasks_count = await db.course_posts.count_documents({
        "subject_id": subject_id,
        "post_type": "task",
        "status": "active",
        "created_at": {"$gte": month_ago}
    })
    
    # Also count task reminders
    pending_task_reminders = await db.course_reminders.count_documents({
        "subject_id": subject_id,
        "reminder_type": "task",
        "status": "active",
        "date": {"$gte": now_iso[:10]}
    })
    pending_tasks_count += pending_task_reminders
    
    # Count videos/recorded classes (posts with video files or type)
    videos_count = await db.course_posts.count_documents({
        "subject_id": subject_id,
        "status": "active",
        "$or": [
            {"file_type": {"$regex": "video", "$options": "i"}},
            {"content": {"$regex": "youtube|vimeo|video", "$options": "i"}}
        ]
    })
    
    # Count forum posts
    forum_count = await db.course_posts.count_documents({
        "subject_id": subject_id,
        "post_type": "forum",
        "status": "active"
    })
    
    # Count total announcements
    announcements_count = await db.course_posts.count_documents({
        "subject_id": subject_id,
        "post_type": "announcement",
        "status": "active"
    })
    
    quick_access = [
        {
            "id": "materials",
            "label": "Materiales",
            "count": materials_count,
            "icon": "folder",
            "color": "blue",
            "filter": "material"
        },
        {
            "id": "tasks",
            "label": "Tareas pendientes",
            "count": pending_tasks_count,
            "icon": "task",
            "color": "amber",
            "filter": "task"
        },
        {
            "id": "videos",
            "label": "Clases grabadas",
            "count": videos_count,
            "icon": "video",
            "color": "rose",
            "filter": "video"
        },
        {
            "id": "forum",
            "label": "Foro del curso",
            "count": forum_count,
            "icon": "forum",
            "color": "violet",
            "filter": "forum"
        }
    ]
    
    # ══════════════════════════════════════════════════════════════════════════
    # 3. COURSE STATS - Quick overview
    # ══════════════════════════════════════════════════════════════════════════
    total_posts = await db.course_posts.count_documents({
        "subject_id": subject_id,
        "status": "active"
    })
    
    total_reminders = await db.course_reminders.count_documents({
        "subject_id": subject_id,
        "status": "active"
    })
    
    return {
        "news": news_items,
        "quick_access": quick_access,
        "stats": {
            "total_posts": total_posts,
            "total_reminders": total_reminders,
            "materials_count": materials_count,
            "announcements_count": announcements_count
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# COURSE REMINDERS - Premium Feature (Google Classroom Style)
# ══════════════════════════════════════════════════════════════════════════════

class CourseReminderCreate(BaseModel):
    subject_id: str
    title: str
    description: Optional[str] = None
    date: str  # ISO date string
    reminder_type: Literal["task", "exam", "notice"] = "notice"
    is_important: bool = False  # Mark as important for notifications
    notify_all: bool = False  # Notify all students

class CourseReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    reminder_type: Optional[Literal["task", "exam", "notice"]] = None
    status: Optional[Literal["active", "completed", "cancelled"]] = None
    is_important: Optional[bool] = None
    notify_all: Optional[bool] = None


@api_router.get("/course/{subject_id}/reminders")
async def get_course_reminders(
    subject_id: str,
    status: Optional[str] = Query(None, description="Filter by status: active, completed, cancelled"),
    current_user = Depends(get_current_user)
):
    """Get all reminders for a course/subject"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Build query filter
    query_filter = {
        "school_id": user["school_id"],
        "subject_id": subject_id
    }
    
    if status:
        query_filter["status"] = status
    else:
        # By default, exclude cancelled
        query_filter["status"] = {"$ne": "cancelled"}
    
    # Get reminders sorted by date
    reminders = await db.course_reminders.find(
        query_filter,
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Add creator info
    for reminder in reminders:
        if reminder.get("created_by"):
            creator = await db.users.find_one(
                {"id": reminder["created_by"]},
                {"_id": 0, "id": 1, "name": 1, "profile_image": 1}
            )
            reminder["creator"] = creator
    
    return reminders


@api_router.post("/course/{subject_id}/reminders")
async def create_course_reminder(
    subject_id: str,
    data: CourseReminderCreate,
    current_user = Depends(get_current_user)
):
    """Create a new reminder for a course (teachers/admins only)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Only teachers, admins, directors and owners can create reminders
    if user.get("role") not in ["teacher", "admin", "owner", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para crear recordatorios")
    
    # Verify subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": user["school_id"]}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Get current academic year
    current_year = await db.academic_years.find_one({
        "school_id": user["school_id"],
        "estado": "activo"
    }, {"_id": 0})
    
    reminder_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    reminder = {
        "id": reminder_id,
        "school_id": user["school_id"],
        "subject_id": subject_id,
        "academic_year_id": current_year["id"] if current_year else None,
        "title": data.title.strip(),
        "description": data.description.strip() if data.description else None,
        "date": data.date,
        "reminder_type": data.reminder_type,
        "is_important": data.is_important,
        "notify_all": data.notify_all,
        "viewed_by": [],  # Track which users have seen this reminder
        "status": "active",
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.course_reminders.insert_one(reminder)
    
    # Register activity in the course stream
    reminder_type_labels = {
        "task": "programó una tarea",
        "exam": "programó un examen",
        "notice": "creó un recordatorio"
    }
    activity_title = reminder_type_labels.get(data.reminder_type, "creó un recordatorio")
    
    await register_course_activity(
        school_id=user["school_id"],
        subject_id=subject_id,
        activity_type="reminder_created" if data.reminder_type == "notice" else ("exam_scheduled" if data.reminder_type == "exam" else "task_assigned"),
        user_id=user["id"],
        user_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        user_photo=user.get("photo_url"),
        title=activity_title,
        description=data.title,
        reference_id=reminder_id,
        reference_type="reminder"
    )
    
    # Add creator info for response
    reminder["creator"] = {
        "id": user["id"],
        "name": user.get("name"),
        "profile_image": user.get("profile_image")
    }
    
    # Remove MongoDB _id
    reminder.pop("_id", None)
    
    return reminder


@api_router.put("/course/reminders/{reminder_id}")
async def update_course_reminder(
    reminder_id: str,
    data: CourseReminderUpdate,
    current_user = Depends(get_current_user)
):
    """Update a course reminder"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    reminder = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    # Only creator, admins, or owners can update
    if reminder["created_by"] != user["id"] and user.get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar este recordatorio")
    
    # Build update data
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.description is not None:
        update_data["description"] = data.description.strip() if data.description else None
    if data.date is not None:
        update_data["date"] = data.date
    if data.reminder_type is not None:
        update_data["reminder_type"] = data.reminder_type
    if data.status is not None:
        update_data["status"] = data.status
    if data.is_important is not None:
        update_data["is_important"] = data.is_important
    if data.notify_all is not None:
        update_data["notify_all"] = data.notify_all
    
    await db.course_reminders.update_one({"id": reminder_id}, {"$set": update_data})
    
    # Return updated reminder
    updated = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    return updated


@api_router.delete("/course/reminders/{reminder_id}")
async def delete_course_reminder(
    reminder_id: str,
    current_user = Depends(get_current_user)
):
    """Delete (cancel) a course reminder"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    reminder = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    # Only creator, admins, or owners can delete
    if reminder["created_by"] != user["id"] and user.get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar este recordatorio")
    
    # Soft delete by setting status to cancelled
    await db.course_reminders.update_one(
        {"id": reminder_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": user["id"]
        }}
    )
    
    return {"message": "Recordatorio eliminado"}


@api_router.post("/course/reminders/{reminder_id}/complete")
async def complete_course_reminder(
    reminder_id: str,
    current_user = Depends(get_current_user)
):
    """Mark a reminder as completed"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    reminder = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    # Only creator, admins, or owners can complete
    if reminder["created_by"] != user["id"] and user.get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para completar este recordatorio")
    
    await db.course_reminders.update_one(
        {"id": reminder_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "completed_by": user["id"]
        }}
    )
    
    return {"message": "Recordatorio marcado como completado"}


@api_router.post("/course/reminders/{reminder_id}/mark-viewed")
async def mark_reminder_viewed(
    reminder_id: str,
    current_user = Depends(get_current_user)
):
    """Mark a reminder as viewed by the current user"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    reminder = await db.course_reminders.find_one({"id": reminder_id}, {"_id": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    # Add user to viewed_by array if not already there
    await db.course_reminders.update_one(
        {"id": reminder_id},
        {"$addToSet": {"viewed_by": user["id"]}}
    )
    
    return {"message": "Recordatorio marcado como visto"}


@api_router.get("/notifications/reminders")
async def get_notification_reminders(
    current_user = Depends(get_current_user)
):
    """
    Get reminders for notification bell across ALL courses the user has access to.
    Returns:
    - Important reminders
    - Upcoming reminders (within 48 hours)
    - New (unviewed) reminders
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    
    # Calculate 48 hours from now
    upcoming_threshold = (now + timedelta(hours=48)).isoformat()
    now_iso = now.isoformat()
    
    # Get all subjects the user has access to
    if user.get("role") in ["admin", "owner", "director", "coordinator"]:
        # Admin roles see all subjects in their school
        subjects = await db.subjects.find(
            {"school_id": school_id},
            {"_id": 0, "id": 1, "name": 1, "color": 1}
        ).to_list(500)
    elif user.get("role") == "teacher":
        # Teachers see their assigned subjects
        subjects = await db.subjects.find(
            {"school_id": school_id, "teacher_id": user_id},
            {"_id": 0, "id": 1, "name": 1, "color": 1}
        ).to_list(100)
    else:
        # Students/Parents - get subjects from their enrollments
        enrollments = await db.enrollments.find(
            {"school_id": school_id, "user_id": user_id, "status": "active"},
            {"_id": 0, "subject_ids": 1}
        ).to_list(100)
        
        subject_ids = []
        for enrollment in enrollments:
            subject_ids.extend(enrollment.get("subject_ids", []))
        
        # Also get from grade enrollment if exists
        if user.get("grade_id"):
            grade = await db.grades.find_one({"id": user["grade_id"]}, {"_id": 0})
            if grade and grade.get("subjects"):
                subject_ids.extend([s.get("subject_id") for s in grade["subjects"] if s.get("subject_id")])
        
        subject_ids = list(set(subject_ids))
        
        subjects = await db.subjects.find(
            {"school_id": school_id, "id": {"$in": subject_ids}},
            {"_id": 0, "id": 1, "name": 1, "color": 1}
        ).to_list(100)
    
    subject_ids = [s["id"] for s in subjects]
    subject_map = {s["id"]: s for s in subjects}
    
    if not subject_ids:
        return {
            "important": [],
            "upcoming": [],
            "new": [],
            "total_count": 0
        }
    
    # Get all active reminders for these subjects
    all_reminders = await db.course_reminders.find(
        {
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "status": "active"
        },
        {"_id": 0}
    ).sort("date", 1).to_list(500)
    
    important_reminders = []
    upcoming_reminders = []
    new_reminders = []
    
    for reminder in all_reminders:
        reminder_date = reminder.get("date", "")
        is_important = reminder.get("is_important", False)
        viewed_by = reminder.get("viewed_by", [])
        is_viewed = user_id in viewed_by
        
        # Add subject info
        subject_info = subject_map.get(reminder["subject_id"], {})
        reminder["subject_name"] = subject_info.get("name", "")
        reminder["subject_color"] = subject_info.get("color", "#6366f1")
        reminder["is_viewed"] = is_viewed
        
        # Categorize reminders
        # Important reminders (not viewed)
        if is_important and not is_viewed:
            important_reminders.append(reminder)
        # Upcoming within 48h (not viewed or important)
        elif reminder_date and reminder_date <= upcoming_threshold and reminder_date >= now_iso[:10]:
            if not is_viewed:
                upcoming_reminders.append(reminder)
        # New (not viewed, not in other categories)
        elif not is_viewed:
            new_reminders.append(reminder)
    
    # Limit results
    important_reminders = important_reminders[:10]
    upcoming_reminders = upcoming_reminders[:10]
    new_reminders = new_reminders[:10]
    
    total_count = len(important_reminders) + len(upcoming_reminders) + len(new_reminders)
    
    return {
        "important": important_reminders,
        "upcoming": upcoming_reminders,
        "new": new_reminders,
        "total_count": total_count
    }


@api_router.get("/notifications/reminders/popup")
async def get_popup_reminders(
    current_user = Depends(get_current_user)
):
    """
    Get reminders that should trigger a popup notification.
    Rules:
    - Important reminders not viewed today
    - Reminders due within 24 hours not viewed
    - Overdue reminders not viewed
    Returns max 1 reminder to show as popup
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    school_id = user["school_id"]
    now = datetime.now(timezone.utc)
    now_date = now.date().isoformat()
    
    # Calculate 24 hours from now
    upcoming_24h = (now + timedelta(hours=24)).isoformat()
    now_iso = now.isoformat()
    
    # Get user's popup history from user document or separate collection
    popup_history = user.get("reminder_popup_history", {})
    
    # Get all subjects the user has access to (same logic as above)
    if user.get("role") in ["admin", "owner", "director", "coordinator"]:
        subjects = await db.subjects.find(
            {"school_id": school_id},
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(500)
    elif user.get("role") == "teacher":
        subjects = await db.subjects.find(
            {"school_id": school_id, "teacher_id": user_id},
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(100)
    else:
        enrollments = await db.enrollments.find(
            {"school_id": school_id, "user_id": user_id, "status": "active"},
            {"_id": 0, "subject_ids": 1}
        ).to_list(100)
        
        subject_ids = []
        for enrollment in enrollments:
            subject_ids.extend(enrollment.get("subject_ids", []))
        
        if user.get("grade_id"):
            grade = await db.grades.find_one({"id": user["grade_id"]}, {"_id": 0})
            if grade and grade.get("subjects"):
                subject_ids.extend([s.get("subject_id") for s in grade["subjects"] if s.get("subject_id")])
        
        subject_ids = list(set(subject_ids))
        subjects = await db.subjects.find(
            {"school_id": school_id, "id": {"$in": subject_ids}},
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(100)
    
    subject_ids = [s["id"] for s in subjects]
    subject_map = {s["id"]: s for s in subjects}
    
    if not subject_ids:
        return {"reminder": None}
    
    # Get active reminders that qualify for popup
    reminders = await db.course_reminders.find(
        {
            "school_id": school_id,
            "subject_id": {"$in": subject_ids},
            "status": "active",
            "$or": [
                {"is_important": True},
                {"date": {"$lte": upcoming_24h}}  # Due within 24h or overdue
            ]
        },
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Find the first reminder that:
    # 1. User hasn't viewed
    # 2. Wasn't shown as popup today
    for reminder in reminders:
        reminder_id = reminder["id"]
        viewed_by = reminder.get("viewed_by", [])
        
        # Skip if already viewed
        if user_id in viewed_by:
            continue
        
        # Skip if popup was shown today
        last_popup_date = popup_history.get(reminder_id)
        if last_popup_date == now_date:
            continue
        
        # This reminder should be shown as popup
        subject_info = subject_map.get(reminder["subject_id"], {})
        reminder["subject_name"] = subject_info.get("name", "")
        
        return {"reminder": reminder}
    
    return {"reminder": None}


@api_router.post("/notifications/reminders/{reminder_id}/dismiss-popup")
async def dismiss_popup_reminder(
    reminder_id: str,
    current_user = Depends(get_current_user)
):
    """Record that user dismissed a popup for a reminder (once per day limit)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    now_date = datetime.now(timezone.utc).date().isoformat()
    
    # Update user's popup history
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {f"reminder_popup_history.{reminder_id}": now_date}}
    )
    
    return {"message": "Popup dismissal recorded"}


# ══════════════════════════════════════════════════════════════════════════════
# GENERAL NOTIFICATIONS SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

class NotificationType(str, Enum):
    task = "task"
    exam = "exam"
    material = "material"
    forum = "forum"
    reminder = "reminder"
    announcement = "announcement"

class NotificationCreate(BaseModel):
    title: str
    message: str
    notification_type: NotificationType
    subject_id: Optional[str] = None
    reference_id: Optional[str] = None  # ID of the task/exam/material/forum post
    reference_url: Optional[str] = None

async def create_notification_for_subject(
    school_id: str,
    subject_id: str,
    title: str,
    message: str,
    notification_type: str,
    reference_id: str = None,
    author_id: str = None,
    author_name: str = None
):
    """Helper function to create a notification for a subject"""
    # Get subject info
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0, "name": 1, "grade_id": 1})
    
    notification = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "subject_id": subject_id,
        "subject_name": subject.get("name") if subject else None,
        "title": title,
        "message": message,
        "notification_type": notification_type,
        "reference_id": reference_id,
        "author_id": author_id,
        "author_name": author_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read_by": []  # List of user IDs who have read this notification
    }
    
    await db.notifications.insert_one(notification)
    return notification

@api_router.get("/notifications/all")
async def get_all_notifications(
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get all notifications for the current user (from their subjects)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    school_id = user["school_id"]
    
    # Get all subjects the user has access to
    if user.get("role") in ["admin", "owner", "director", "coordinator"]:
        subjects = await db.subjects.find(
            {"school_id": school_id},
            {"_id": 0, "id": 1}
        ).to_list(500)
    elif user.get("role") == "teacher":
        subjects = await db.subjects.find(
            {"school_id": school_id, "teacher_id": user_id},
            {"_id": 0, "id": 1}
        ).to_list(100)
    else:
        # Students get notifications from enrolled subjects
        enrollments = await db.enrollments.find(
            {"school_id": school_id, "user_id": user_id, "status": "active"},
            {"_id": 0, "subject_ids": 1}
        ).to_list(100)
        
        subject_ids = []
        for enrollment in enrollments:
            subject_ids.extend(enrollment.get("subject_ids", []))
        
        if user.get("grade_id"):
            grade = await db.grades.find_one({"id": user["grade_id"]}, {"_id": 0})
            if grade and grade.get("subjects"):
                subject_ids.extend([s.get("subject_id") for s in grade["subjects"] if s.get("subject_id")])
        
        subjects = [{"id": sid} for sid in list(set(subject_ids))]
    
    subject_ids = [s["id"] for s in subjects]
    
    # Get notifications from these subjects OR school-wide notifications
    notifications = await db.notifications.find(
        {
            "school_id": school_id,
            "$or": [
                {"subject_id": {"$in": subject_ids}},
                {"subject_id": None}  # School-wide notifications
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark which ones are read
    for notif in notifications:
        notif["is_read"] = user_id in notif.get("read_by", [])
    
    # Count unread
    unread_count = sum(1 for n in notifications if not n["is_read"])
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total_count": len(notifications)
    }

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user = Depends(get_current_user)
):
    """Mark a notification as read"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    await db.notifications.update_one(
        {"id": notification_id},
        {"$addToSet": {"read_by": user["id"]}}
    )
    
    return {"message": "Notificación marcada como leída"}

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user = Depends(get_current_user)
):
    """Mark all notifications as read for the current user"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get user's subjects
    school_id = user["school_id"]
    user_id = user["id"]
    
    if user.get("role") in ["admin", "owner", "director", "coordinator"]:
        subjects = await db.subjects.find({"school_id": school_id}, {"_id": 0, "id": 1}).to_list(500)
    elif user.get("role") == "teacher":
        subjects = await db.subjects.find({"school_id": school_id, "teacher_id": user_id}, {"_id": 0, "id": 1}).to_list(100)
    else:
        subjects = []
    
    subject_ids = [s["id"] for s in subjects]
    
    await db.notifications.update_many(
        {
            "school_id": school_id,
            "$or": [
                {"subject_id": {"$in": subject_ids}},
                {"subject_id": None}
            ]
        },
        {"$addToSet": {"read_by": user_id}}
    )
    
    return {"message": "Todas las notificaciones marcadas como leídas"}


# ══════════════════════════════════════════════════════════════════════════════
# MESSAGE CENTER MODULE - Premium Communication System
# ══════════════════════════════════════════════════════════════════════════════

class MessageType(str, Enum):
    institutional = "institutional"
    support = "support"
    academic = "academic"

class MessagePriority(str, Enum):
    normal = "normal"
    important = "important"
    urgent = "urgent"

class SupportTicketStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    responded = "responded"
    closed = "closed"

class InstitutionalMessageCreate(BaseModel):
    title: str
    content: str
    priority: MessagePriority = MessagePriority.normal
    target_roles: List[str] = []
    target_levels: List[str] = []
    target_grades: List[str] = []
    expires_at: Optional[str] = None
    
class SupportTicketCreate(BaseModel):
    subject: str
    category: str
    description: str
    
class SupportTicketReply(BaseModel):
    content: str

class AcademicMessageCreate(BaseModel):
    receiver_id: str
    subject_id: Optional[str] = None
    content: str

@api_router.get("/messaging/office-hours")
async def get_office_hours(current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school = await db.schools.find_one({"id": user["school_id"]}, {"_id": 0})
    office_hours = school.get("office_hours", {
        "enabled": True,
        "timezone": "America/Lima",
        "schedule": {
            "monday": {"start": "08:00", "end": "17:00", "enabled": True},
            "tuesday": {"start": "08:00", "end": "17:00", "enabled": True},
            "wednesday": {"start": "08:00", "end": "17:00", "enabled": True},
            "thursday": {"start": "08:00", "end": "17:00", "enabled": True},
            "friday": {"start": "08:00", "end": "17:00", "enabled": True},
            "saturday": {"start": "08:00", "end": "12:00", "enabled": False},
            "sunday": {"start": "00:00", "end": "00:00", "enabled": False}
        },
        "out_of_hours_message": "Gracias por tu mensaje. Será atendido en horario escolar."
    }) if school else {}
    
    office_hours["is_currently_open"] = True
    return office_hours

@api_router.post("/messaging/institutional")
async def create_institutional_message(
    data: InstitutionalMessageCreate,
    current_user = Depends(get_current_user)
):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if user.get("role") not in ["admin", "owner", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    message = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "type": MessageType.institutional.value,
        "title": data.title,
        "content": data.content,
        "priority": data.priority.value,
        "target_roles": data.target_roles,
        "target_levels": data.target_levels,
        "target_grades": data.target_grades,
        "expires_at": data.expires_at,
        "author_id": user["id"],
        "author_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "author_role": user.get("role"),
        "author_photo": user.get("photo_url"),
        "read_by": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.institutional_messages.insert_one(message)
    # Remove _id added by MongoDB before returning
    message.pop("_id", None)
    return {"message": "Comunicado enviado", "data": message}

@api_router.get("/messaging/institutional")
async def get_institutional_messages(
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    messages = await db.institutional_messages.find(
        {"school_id": user["school_id"], "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for msg in messages:
        msg["is_read"] = user["id"] in msg.get("read_by", [])
    
    unread_count = sum(1 for m in messages if not m["is_read"])
    return {"messages": messages, "unread_count": unread_count, "total_count": len(messages)}

@api_router.post("/messaging/institutional/{message_id}/read")
async def mark_institutional_read(message_id: str, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    await db.institutional_messages.update_one({"id": message_id}, {"$addToSet": {"read_by": user["id"]}})
    return {"message": "Marcado como leído"}

@api_router.delete("/messaging/institutional/{message_id}")
async def delete_institutional_message(message_id: str, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or user.get("role") not in ["admin", "owner", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    await db.institutional_messages.update_one(
        {"id": message_id, "school_id": user["school_id"]},
        {"$set": {"status": "deleted"}}
    )
    return {"message": "Comunicado eliminado"}

@api_router.post("/messaging/support")
async def create_support_ticket(data: SupportTicketCreate, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    ticket = {
        "id": str(uuid.uuid4()),
        "ticket_number": f"TKT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
        "school_id": user["school_id"],
        "subject": data.subject,
        "category": data.category,
        "status": SupportTicketStatus.open.value,
        "creator_id": user["id"],
        "creator_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "creator_role": user.get("role"),
        "creator_photo": user.get("photo_url"),
        "messages": [{
            "id": str(uuid.uuid4()),
            "sender_id": user["id"],
            "sender_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
            "sender_photo": user.get("photo_url"),
            "content": data.description,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_staff": False
        }],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.insert_one(ticket)
    # Remove _id added by MongoDB before returning
    ticket.pop("_id", None)
    return {"message": "Ticket creado", "data": ticket}

@api_router.get("/messaging/support")
async def get_support_tickets(status: Optional[str] = None, limit: int = 50, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    query = {"school_id": user["school_id"]}
    if user.get("role") not in ["admin", "owner", "director", "coordinator"]:
        query["creator_id"] = user["id"]
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("updated_at", -1).limit(limit).to_list(limit)
    return {"tickets": tickets, "total_count": len(tickets)}

@api_router.get("/messaging/support/{ticket_id}")
async def get_support_ticket(ticket_id: str, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    ticket = await db.support_tickets.find_one({"id": ticket_id, "school_id": user["school_id"]}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    return ticket

@api_router.post("/messaging/support/{ticket_id}/reply")
async def reply_support_ticket(ticket_id: str, data: SupportTicketReply, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    is_staff = user.get("role") in ["admin", "owner", "director", "coordinator"]
    reply = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "sender_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "sender_photo": user.get("photo_url"),
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_staff": is_staff
    }
    
    new_status = "responded" if is_staff else "open"
    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$push": {"messages": reply}, "$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Respuesta enviada", "reply": reply}

@api_router.put("/messaging/support/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, status: str = Body(..., embed=True), current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or user.get("role") not in ["admin", "owner", "director", "coordinator"]:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    await db.support_tickets.update_one({"id": ticket_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Estado actualizado"}

@api_router.get("/messaging/academic/contacts")
async def get_academic_contacts(current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    contacts = []
    user_role = user.get("role", "student")
    
    if user_role == "teacher":
        subjects = await db.subjects.find({"school_id": user["school_id"], "teacher_id": user["id"]}, {"_id": 0}).to_list(100)
        for subject in subjects:
            students = await db.users.find({"school_id": user["school_id"], "grade_id": subject.get("grade_id"), "role": "student"}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1}).to_list(100)
            for s in students:
                contacts.append({"id": s["id"], "name": f"{s.get('name', '')} {s.get('last_name', '')}".strip(), "photo_url": s.get("photo_url"), "role": "student", "subject_name": subject.get("name", "")})
    elif user_role == "student":
        # Get grade_id and seccion_id from user
        grade_id = user.get("grade_id") or user.get("grado_id")
        seccion_id = user.get("seccion_id")
        school_id = user.get("school_id")
        added_teacher_ids = set()  # Track added teachers to avoid duplicates
        
        if grade_id:
            # 1. Add all teachers who teach subjects in this grade
            subjects = await db.subjects.find({"grade_id": grade_id, "teacher_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(100)
            for subject in subjects:
                teacher_id = subject.get("teacher_id")
                if teacher_id and teacher_id not in added_teacher_ids:
                    teacher = await db.users.find_one({"id": teacher_id, "is_active": {"$ne": False}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1})
                    if teacher:
                        contacts.append({
                            "id": teacher["id"], 
                            "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(), 
                            "last_name": teacher.get("last_name", ""),
                            "email": teacher.get("email"),
                            "photo_url": teacher.get("photo_url"), 
                            "role": "teacher", 
                            "subject_name": subject.get("name", "")
                        })
                        added_teacher_ids.add(teacher_id)
            
            # 2. Also check academic_assignments for teachers in this grade
            assignments = await db.academic_assignments.find({
                "school_id": school_id,
                "grade_id": grade_id,
                "teacher_id": {"$exists": True, "$ne": None},
                "status": "activo"
            }, {"_id": 0, "teacher_id": 1, "subject_id": 1}).to_list(100)
            
            for assignment in assignments:
                teacher_id = assignment.get("teacher_id")
                if teacher_id and teacher_id not in added_teacher_ids:
                    teacher = await db.users.find_one({"id": teacher_id, "is_active": {"$ne": False}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1})
                    if teacher:
                        # Get subject name
                        subject = await db.subjects.find_one({"id": assignment.get("subject_id")}, {"_id": 0, "name": 1})
                        subject_name = subject.get("name", "") if subject else ""
                        contacts.append({
                            "id": teacher["id"], 
                            "name": f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip(), 
                            "last_name": teacher.get("last_name", ""),
                            "email": teacher.get("email"),
                            "photo_url": teacher.get("photo_url"), 
                            "role": "teacher", 
                            "subject_name": subject_name
                        })
                        added_teacher_ids.add(teacher_id)
        
        # 3. Add classmates (students in the same section/grade)
        if seccion_id:
            classmates = await db.users.find({
                "school_id": school_id,
                "seccion_id": seccion_id,
                "role": "student",
                "id": {"$ne": user["id"]},
                "is_active": {"$ne": False}
            }, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1}).to_list(100)
            
            for classmate in classmates:
                contacts.append({
                    "id": classmate["id"],
                    "name": f"{classmate.get('name', '')} {classmate.get('last_name', '')}".strip(),
                    "last_name": classmate.get("last_name", ""),
                    "email": classmate.get("email"),
                    "photo_url": classmate.get("photo_url"),
                    "role": "student"
                })
        elif grade_id:
            # If no section, get all students in the same grade
            classmates = await db.users.find({
                "school_id": school_id,
                "$or": [{"grade_id": grade_id}, {"grado_id": grade_id}],
                "role": "student",
                "id": {"$ne": user["id"]},
                "is_active": {"$ne": False}
            }, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "email": 1}).to_list(100)
            
            for classmate in classmates:
                contacts.append({
                    "id": classmate["id"],
                    "name": f"{classmate.get('name', '')} {classmate.get('last_name', '')}".strip(),
                    "last_name": classmate.get("last_name", ""),
                    "email": classmate.get("email"),
                    "photo_url": classmate.get("photo_url"),
                    "role": "student"
                })
    elif user_role in ["admin", "owner", "director", "coordinator"]:
        all_users = await db.users.find({"school_id": user["school_id"], "id": {"$ne": user["id"]}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}).to_list(500)
        for u in all_users:
            contacts.append({"id": u["id"], "name": f"{u.get('name', '')} {u.get('last_name', '')}".strip(), "photo_url": u.get("photo_url"), "role": u.get("role", "student")})
    
    return {"contacts": contacts}

@api_router.post("/messaging/academic")
async def send_academic_message(data: AcademicMessageCreate, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    receiver = await db.users.find_one({"id": data.receiver_id}, {"_id": 0})
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")
    
    if user.get("role") == "student" and receiver.get("role") == "student":
        # Allow students to message classmates in the same section/grade
        user_seccion = user.get("seccion_id")
        receiver_seccion = receiver.get("seccion_id")
        user_grade = user.get("grade_id") or user.get("grado_id")
        receiver_grade = receiver.get("grade_id") or receiver.get("grado_id")
        
        # Must be in the same section or at least same grade
        if user_seccion and receiver_seccion and user_seccion != receiver_seccion:
            raise HTTPException(status_code=403, detail="Solo puedes enviar mensajes a compañeros de tu misma sección")
        if not user_seccion and user_grade != receiver_grade:
            raise HTTPException(status_code=403, detail="Solo puedes enviar mensajes a compañeros de tu mismo grado")
    
    thread = await db.academic_threads.find_one({
        "school_id": user["school_id"],
        "$or": [{"participant_ids": [user["id"], data.receiver_id]}, {"participant_ids": [data.receiver_id, user["id"]]}]
    }, {"_id": 0})
    
    if not thread:
        thread = {
            "id": str(uuid.uuid4()),
            "school_id": user["school_id"],
            "participant_ids": [user["id"], data.receiver_id],
            "participants": [
                {"id": user["id"], "name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(), "role": user.get("role"), "photo_url": user.get("photo_url")},
                {"id": receiver["id"], "name": f"{receiver.get('name', '')} {receiver.get('last_name', '')}".strip(), "role": receiver.get("role"), "photo_url": receiver.get("photo_url")}
            ],
            "subject_id": data.subject_id,
            "messages": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "unread_by": []
        }
        await db.academic_threads.insert_one(thread)
        # Remove _id added by MongoDB
        thread.pop("_id", None)
    
    message = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "sender_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "sender_photo": user.get("photo_url"),
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.academic_threads.update_one(
        {"id": thread["id"]},
        {"$push": {"messages": message}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}, "$addToSet": {"unread_by": data.receiver_id}}
    )
    return {"message": "Mensaje enviado", "data": message, "thread_id": thread["id"]}

# Edit academic message
@api_router.put("/messaging/academic/{thread_id}/messages/{message_id}")
async def edit_academic_message(thread_id: str, message_id: str, data: dict, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # First find the thread
    thread = await db.academic_threads.find_one({
        "id": thread_id, 
        "school_id": user["school_id"],
        "participant_ids": user["id"]
    }, {"_id": 0})
    
    if not thread:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    
    # Find the message and verify ownership
    message = next((m for m in thread.get("messages", []) if m["id"] == message_id and m["sender_id"] == user["id"]), None)
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado o no tienes permisos")
    
    if message.get("deleted"):
        raise HTTPException(status_code=400, detail="No se puede editar un mensaje eliminado")
    
    new_content = data.get("content", "").strip()
    if not new_content:
        raise HTTPException(status_code=400, detail="El contenido no puede estar vacío")
    
    # Update using arrayFilters for precise update
    await db.academic_threads.update_one(
        {"id": thread_id},
        {"$set": {
            "messages.$[msg].content": new_content,
            "messages.$[msg].edited": True,
            "messages.$[msg].edited_at": datetime.now(timezone.utc).isoformat()
        }},
        array_filters=[{"msg.id": message_id}]
    )
    return {"message": "Mensaje editado"}

# Delete academic message
@api_router.delete("/messaging/academic/{thread_id}/messages/{message_id}")
async def delete_academic_message(thread_id: str, message_id: str, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # First find the thread
    thread = await db.academic_threads.find_one({
        "id": thread_id, 
        "school_id": user["school_id"],
        "participant_ids": user["id"]
    }, {"_id": 0})
    
    if not thread:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    
    # Find the message and verify ownership
    message = next((m for m in thread.get("messages", []) if m["id"] == message_id and m["sender_id"] == user["id"]), None)
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado o no tienes permisos")
    
    # Update using arrayFilters for precise update
    await db.academic_threads.update_one(
        {"id": thread_id},
        {"$set": {
            "messages.$[msg].content": "Este mensaje fue eliminado",
            "messages.$[msg].deleted": True,
            "messages.$[msg].deleted_at": datetime.now(timezone.utc).isoformat()
        }},
        array_filters=[{"msg.id": message_id}]
    )
    return {"message": "Mensaje eliminado"}

@api_router.get("/messaging/academic")
async def get_academic_threads(limit: int = 50, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    threads = await db.academic_threads.find({"school_id": user["school_id"], "participant_ids": user["id"]}, {"_id": 0}).sort("updated_at", -1).limit(limit).to_list(limit)
    
    for thread in threads:
        thread["has_unread"] = user["id"] in thread.get("unread_by", [])
        thread["other_participant"] = next((p for p in thread.get("participants", []) if p["id"] != user["id"]), None)
    
    unread_count = sum(1 for t in threads if t["has_unread"])
    return {"threads": threads, "unread_count": unread_count, "total_count": len(threads)}

@api_router.get("/messaging/academic/{thread_id}")
async def get_academic_thread(thread_id: str, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    thread = await db.academic_threads.find_one({"id": thread_id, "school_id": user["school_id"], "participant_ids": user["id"]}, {"_id": 0})
    if not thread:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    
    # Calculate other_participant for the current user
    other_participant = None
    for p in thread.get("participants", []):
        if p.get("id") != user["id"]:
            other_participant = p
            break
    thread["other_participant"] = other_participant
    
    await db.academic_threads.update_one({"id": thread_id}, {"$pull": {"unread_by": user["id"]}})
    return thread

@api_router.get("/messaging/stats")
async def get_messaging_stats(current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    unread_inst = await db.institutional_messages.count_documents({"school_id": user["school_id"], "status": "active", "read_by": {"$ne": user["id"]}})
    
    support_query = {"school_id": user["school_id"]}
    if user.get("role") in ["admin", "owner", "director", "coordinator"]:
        support_query["status"] = {"$in": ["open", "in_progress"]}
    else:
        support_query.update({"creator_id": user["id"], "status": "responded"})
    unread_support = await db.support_tickets.count_documents(support_query)
    
    unread_academic = await db.academic_threads.count_documents({"school_id": user["school_id"], "participant_ids": user["id"], "unread_by": user["id"]})
    
    return {"total_unread": unread_inst + unread_support + unread_academic, "institutional": unread_inst, "support": unread_support, "academic": unread_academic}


# ══════════════════════════════════════════════════════════════════════════════
# ONLINE EXAMS MODULE - Premium Implementation
# ══════════════════════════════════════════════════════════════════════════════

class ExamStatus(str, Enum):
    draft = "draft"           # Created, only visible to teacher
    scheduled = "scheduled"   # Scheduled but not visible to students
    published = "published"   # Visible and accessible to students (within date/time)
    closed = "closed"         # Finished, read-only


class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_datetime: str  # ISO format datetime
    end_datetime: str    # ISO format datetime
    duration_minutes: int = 60  # Default 60 minutes, required
    min_score_percentage: Optional[float] = 60.0


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    duration_minutes: Optional[int] = None
    min_score_percentage: Optional[float] = None
    status: Optional[ExamStatus] = None


@api_router.get("/course/{subject_id}/exams")
async def get_course_exams(
    subject_id: str,
    current_user = Depends(get_current_user)
):
    """Get all exams for a course/subject"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Build query based on user role
    query = {"subject_id": subject_id, "school_id": user["school_id"]}
    
    # Students only see published exams
    is_student = user.get("role") == "student"
    if is_student:
        now = datetime.now(timezone.utc)
        query["status"] = ExamStatus.published.value
    
    exams = await db.online_exams.find(query, {"_id": 0}).sort("start_datetime", 1).to_list(100)
    
    # For students, add availability info
    if is_student:
        now = datetime.now(timezone.utc)
        for exam in exams:
            start = datetime.fromisoformat(exam["start_datetime"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(exam["end_datetime"].replace("Z", "+00:00"))
            exam["is_available"] = start <= now <= end
            exam["availability_message"] = None
            if now < start:
                exam["availability_message"] = "El examen aún no está disponible"
            elif now > end:
                exam["availability_message"] = "El tiempo para este examen ha finalizado"
    
    # Get creator info for each exam
    creator_ids = list(set(e.get("created_by") for e in exams if e.get("created_by")))
    creators = {}
    if creator_ids:
        creator_docs = await db.users.find({"id": {"$in": creator_ids}}, {"_id": 0, "id": 1, "name": 1, "last_name": 1}).to_list(100)
        creators = {c["id"]: f"{c.get('name', '')} {c.get('last_name', '')}".strip() for c in creator_docs}
    
    for exam in exams:
        exam["creator_name"] = creators.get(exam.get("created_by"), "")
        # Check if any student has taken this exam (for deletion rules)
        attempts_count = await db.exam_attempts.count_documents({"exam_id": exam["id"]})
        exam["has_attempts"] = attempts_count > 0
        exam["attempts_count"] = attempts_count
    
    return exams


@api_router.post("/course/{subject_id}/exams")
async def create_exam(
    subject_id: str,
    data: ExamCreate,
    current_user = Depends(get_current_user)
):
    """Create a new exam for a course"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Only teachers and admins can create exams
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear exámenes")
    
    # Validate subject exists
    subject = await db.subjects.find_one({"id": subject_id, "school_id": user["school_id"]}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Asignatura no encontrada")
    
    # Validate dates
    try:
        start_dt = datetime.fromisoformat(data.start_datetime.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(data.end_datetime.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="La fecha/hora de fin debe ser posterior a la de inicio")
    
    # Validate duration
    if not data.duration_minutes or data.duration_minutes < 1:
        raise HTTPException(status_code=400, detail="La duración del examen debe ser al menos 1 minuto")
    
    # Create exam
    exam_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    exam = {
        "id": exam_id,
        "school_id": user["school_id"],
        "subject_id": subject_id,
        "title": data.title,
        "description": data.description or "",
        "start_datetime": data.start_datetime,
        "end_datetime": data.end_datetime,
        "duration_minutes": data.duration_minutes,
        "min_score_percentage": data.min_score_percentage or 60.0,
        "status": ExamStatus.draft.value,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.online_exams.insert_one(exam)
    
    # Remove _id for response
    exam.pop("_id", None)
    return exam


@api_router.get("/exams/{exam_id}")
async def get_exam_detail(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Get exam details"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Students can only see published exams
    is_student = user.get("role") == "student"
    if is_student and exam["status"] != ExamStatus.published.value:
        raise HTTPException(status_code=403, detail="Este examen no está disponible")
    
    # Get subject info
    subject = await db.subjects.find_one({"id": exam["subject_id"]}, {"_id": 0, "name": 1, "color": 1})
    exam["subject_name"] = subject.get("name", "") if subject else ""
    exam["subject_color"] = subject.get("color", "#6366F1") if subject else "#6366F1"
    
    # Get creator info
    if exam.get("created_by"):
        creator = await db.users.find_one({"id": exam["created_by"]}, {"_id": 0, "name": 1, "last_name": 1})
        exam["creator_name"] = f"{creator.get('name', '')} {creator.get('last_name', '')}".strip() if creator else ""
    
    # Get attempts count
    attempts_count = await db.exam_attempts.count_documents({"exam_id": exam_id})
    exam["has_attempts"] = attempts_count > 0
    exam["attempts_count"] = attempts_count
    
    # For students, check availability
    if is_student:
        now = datetime.now(timezone.utc)
        start = datetime.fromisoformat(exam["start_datetime"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(exam["end_datetime"].replace("Z", "+00:00"))
        exam["is_available"] = start <= now <= end
    
    return exam


@api_router.put("/exams/{exam_id}")
async def update_exam(
    exam_id: str,
    data: ExamUpdate,
    current_user = Depends(get_current_user)
):
    """Update an exam"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Only teachers and admins can update exams
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar exámenes")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Cannot edit closed exams
    if exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se puede editar un examen cerrado")
    
    # Build update data
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title
    if data.description is not None:
        update_data["description"] = data.description
    if data.duration_minutes is not None:
        update_data["duration_minutes"] = data.duration_minutes
    if data.min_score_percentage is not None:
        update_data["min_score_percentage"] = data.min_score_percentage
    if data.status is not None:
        # Validate status transitions
        current_status = exam["status"]
        new_status = data.status.value
        
        # Check if exam has attempts before allowing certain transitions
        attempts_count = await db.exam_attempts.count_documents({"exam_id": exam_id})
        
        if new_status == ExamStatus.draft.value and attempts_count > 0:
            raise HTTPException(status_code=400, detail="No se puede volver a borrador un examen que ya tiene intentos")
        
        update_data["status"] = new_status
    
    # Validate dates if being updated
    start_dt = data.start_datetime or exam["start_datetime"]
    end_dt = data.end_datetime or exam["end_datetime"]
    
    if data.start_datetime is not None or data.end_datetime is not None:
        try:
            start = datetime.fromisoformat(start_dt.replace("Z", "+00:00"))
            end = datetime.fromisoformat(end_dt.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")
        
        if end <= start:
            raise HTTPException(status_code=400, detail="La fecha/hora de fin debe ser posterior a la de inicio")
        
        if data.start_datetime is not None:
            update_data["start_datetime"] = data.start_datetime
        if data.end_datetime is not None:
            update_data["end_datetime"] = data.end_datetime
    
    await db.online_exams.update_one({"id": exam_id}, {"$set": update_data})
    
    # Return updated exam
    updated_exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0})
    return updated_exam


@api_router.post("/exams/{exam_id}/publish")
async def publish_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Publish an exam (make it visible to students)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para publicar exámenes")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    if exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se puede publicar un examen cerrado")
    
    if exam["status"] == ExamStatus.published.value:
        raise HTTPException(status_code=400, detail="El examen ya está publicado")
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"status": ExamStatus.published.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log activity
    try:
        activity = {
            "id": str(uuid.uuid4()),
            "school_id": user["school_id"],
            "subject_id": exam["subject_id"],
            "user_id": user["id"],
            "user_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
            "user_photo_url": user.get("profile_image"),
            "activity_type": "exam_scheduled",
            "content": {
                "exam_id": exam_id,
                "exam_title": exam["title"]
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.course_activities.insert_one(activity)
    except Exception as e:
        print(f"Error logging activity: {e}")
    
    # Create notification for exam publication
    try:
        await create_notification_for_subject(
            school_id=user["school_id"],
            subject_id=exam["subject_id"],
            title="Nuevo examen publicado",
            message=f"Se ha publicado un nuevo examen: {exam['title']}",
            notification_type="exam",
            reference_id=exam_id,
            author_id=user["id"],
            author_name=f"{user.get('name', '')} {user.get('last_name', '')}".strip()
        )
    except Exception as e:
        print(f"Error creating notification: {e}")
    
    return {"message": "Examen publicado exitosamente", "status": ExamStatus.published.value}


@api_router.post("/exams/{exam_id}/close")
async def close_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Close an exam (no more attempts allowed)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para cerrar exámenes")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    if exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="El examen ya está cerrado")
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"status": ExamStatus.closed.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Examen cerrado exitosamente", "status": ExamStatus.closed.value}


@api_router.post("/exams/{exam_id}/schedule")
async def schedule_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Schedule an exam (intermediate state before publishing)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    if exam["status"] not in [ExamStatus.draft.value]:
        raise HTTPException(status_code=400, detail="Solo se pueden programar exámenes en estado borrador")
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"status": ExamStatus.scheduled.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Examen programado exitosamente", "status": ExamStatus.scheduled.value}


@api_router.delete("/exams/{exam_id}")
async def delete_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an exam (with restrictions)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar exámenes")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Check if exam has any attempts
    attempts_count = await db.exam_attempts.count_documents({"exam_id": exam_id})
    if attempts_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar este examen porque {attempts_count} estudiante(s) ya lo han rendido. Solo puedes cerrarlo o archivarlo."
        )
    
    # Cannot delete closed exams
    if exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se puede eliminar un examen cerrado. Solo puedes archivarlo.")
    
    await db.online_exams.delete_one({"id": exam_id})
    
    return {"message": "Examen eliminado exitosamente"}


@api_router.post("/exams/{exam_id}/archive")
async def archive_exam(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Archive an exam (soft delete for closed exams or exams with attempts)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"is_archived": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Examen archivado exitosamente"}


# ══════════════════════════════════════════════════════════════════════════════
# EXAM QUESTIONS MODULE - Premium Implementation
# ══════════════════════════════════════════════════════════════════════════════

class QuestionType(str, Enum):
    multiple_choice = "multiple_choice"  # Opción múltiple
    true_false = "true_false"            # Verdadero/Falso
    fill_blanks = "fill_blanks"          # Espacios en blanco


class QuestionOption(BaseModel):
    id: str
    text: str
    is_correct: bool = False


class QuestionCreate(BaseModel):
    question_type: QuestionType
    question_text: str
    points: float = 1.0
    options: Optional[List[dict]] = None  # For multiple choice
    correct_answer: Optional[str] = None  # For true/false: "true"/"false", for fill_blanks: comma-separated words
    image_url: Optional[str] = None  # Cloudinary URL for question image


class QuestionUpdate(BaseModel):
    question_type: Optional[QuestionType] = None
    question_text: Optional[str] = None
    points: Optional[float] = None
    options: Optional[List[dict]] = None
    correct_answer: Optional[str] = None
    order: Optional[int] = None
    image_url: Optional[str] = None  # Cloudinary URL for question image


@api_router.get("/exams/{exam_id}/questions")
async def get_exam_questions(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Get all questions for an exam"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Verify exam exists and user has access
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Get questions ordered
    questions = await db.exam_questions.find(
        {"exam_id": exam_id},
        {"_id": 0}
    ).sort("order", 1).to_list(200)
    
    # For students taking the exam, hide correct answers
    is_student = user.get("role") == "student"
    if is_student:
        for q in questions:
            # Hide correct answer
            q.pop("correct_answer", None)
            # For multiple choice, hide which option is correct
            if q.get("options"):
                for opt in q["options"]:
                    opt.pop("is_correct", None)
    
    return questions


@api_router.post("/exams/{exam_id}/questions")
async def create_exam_question(
    exam_id: str,
    data: QuestionCreate,
    current_user = Depends(get_current_user)
):
    """Create a new question for an exam"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear preguntas")
    
    # Verify exam exists
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Cannot add questions to closed exams
    if exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se pueden agregar preguntas a un examen cerrado")
    
    # Validate based on question type
    if data.question_type == QuestionType.multiple_choice:
        if not data.options or len(data.options) < 2:
            raise HTTPException(status_code=400, detail="Las preguntas de opción múltiple requieren al menos 2 opciones")
        # Check at least one correct answer
        has_correct = any(opt.get("is_correct") for opt in data.options)
        if not has_correct:
            raise HTTPException(status_code=400, detail="Debe marcar al menos una respuesta correcta")
    
    elif data.question_type == QuestionType.true_false:
        if not data.correct_answer or data.correct_answer not in ["true", "false"]:
            raise HTTPException(status_code=400, detail="Debe indicar si la respuesta es verdadero o falso")
    
    elif data.question_type == QuestionType.fill_blanks:
        if "_" not in data.question_text:
            raise HTTPException(status_code=400, detail="La pregunta debe contener al menos un espacio en blanco marcado con '_'")
        if not data.correct_answer:
            raise HTTPException(status_code=400, detail="Debe proporcionar las palabras correctas separadas por coma")
    
    # Get next order number
    last_question = await db.exam_questions.find_one(
        {"exam_id": exam_id},
        sort=[("order", -1)]
    )
    next_order = (last_question.get("order", 0) + 1) if last_question else 1
    
    # Create question
    question_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Process options for multiple choice
    options = None
    if data.question_type == QuestionType.multiple_choice and data.options:
        options = []
        for i, opt in enumerate(data.options):
            options.append({
                "id": str(uuid.uuid4()),
                "text": opt.get("text", ""),
                "is_correct": opt.get("is_correct", False)
            })
    
    question = {
        "id": question_id,
        "exam_id": exam_id,
        "school_id": user["school_id"],
        "question_type": data.question_type.value,
        "question_text": data.question_text,
        "points": data.points,
        "options": options,
        "correct_answer": data.correct_answer,
        "image_url": data.image_url,
        "order": next_order,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.exam_questions.insert_one(question)
    
    # Update exam total points
    await update_exam_total_points(exam_id)
    
    question.pop("_id", None)
    return question


async def update_exam_total_points(exam_id: str):
    """Recalculate and update exam total points"""
    pipeline = [
        {"$match": {"exam_id": exam_id}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ]
    result = await db.exam_questions.aggregate(pipeline).to_list(1)
    total_points = result[0]["total"] if result else 0
    
    await db.online_exams.update_one(
        {"id": exam_id},
        {"$set": {"total_points": total_points, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )


@api_router.put("/exams/questions/{question_id}")
async def update_exam_question(
    question_id: str,
    data: QuestionUpdate,
    current_user = Depends(get_current_user)
):
    """Update an exam question"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar preguntas")
    
    question = await db.exam_questions.find_one({"id": question_id, "school_id": user["school_id"]}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    
    # Check exam is not closed
    exam = await db.online_exams.find_one({"id": question["exam_id"]}, {"_id": 0})
    if exam and exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se pueden editar preguntas de un examen cerrado")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.question_type is not None:
        update_data["question_type"] = data.question_type.value
    if data.question_text is not None:
        update_data["question_text"] = data.question_text
    if data.points is not None:
        update_data["points"] = data.points
    if data.correct_answer is not None:
        update_data["correct_answer"] = data.correct_answer
    if data.order is not None:
        update_data["order"] = data.order
    if data.options is not None:
        # Process options
        options = []
        for opt in data.options:
            options.append({
                "id": opt.get("id") or str(uuid.uuid4()),
                "text": opt.get("text", ""),
                "is_correct": opt.get("is_correct", False)
            })
        update_data["options"] = options
    
    # Handle image update - delete old image from Cloudinary if replacing
    if data.image_url is not None:
        old_image_url = question.get("image_url")
        if old_image_url and "cloudinary.com" in old_image_url and old_image_url != data.image_url:
            try:
                # Extract public_id from Cloudinary URL
                parts = old_image_url.split("/upload/")
                if len(parts) > 1:
                    public_id_with_ext = parts[1].split("/", 1)[-1] if "/" in parts[1] else parts[1]
                    public_id = public_id_with_ext.rsplit(".", 1)[0]
                    cloudinary.uploader.destroy(public_id)
            except Exception as e:
                print(f"Error deleting old question image from Cloudinary: {e}")
        update_data["image_url"] = data.image_url
    
    await db.exam_questions.update_one({"id": question_id}, {"$set": update_data})
    
    # Update exam total points
    await update_exam_total_points(question["exam_id"])
    
    updated = await db.exam_questions.find_one({"id": question_id}, {"_id": 0})
    return updated


@api_router.delete("/exams/questions/{question_id}")
async def delete_exam_question(
    question_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an exam question"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar preguntas")
    
    question = await db.exam_questions.find_one({"id": question_id, "school_id": user["school_id"]}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    
    # Check exam is not closed
    exam = await db.online_exams.find_one({"id": question["exam_id"]}, {"_id": 0})
    if exam and exam["status"] == ExamStatus.closed.value:
        raise HTTPException(status_code=400, detail="No se pueden eliminar preguntas de un examen cerrado")
    
    # Delete image from Cloudinary if exists
    if question.get("image_url") and "cloudinary.com" in question["image_url"]:
        try:
            parts = question["image_url"].split("/upload/")
            if len(parts) > 1:
                public_id_with_ext = parts[1].split("/", 1)[-1] if "/" in parts[1] else parts[1]
                public_id = public_id_with_ext.rsplit(".", 1)[0]
                cloudinary.uploader.destroy(public_id)
        except Exception as e:
            print(f"Error deleting question image from Cloudinary: {e}")
    
    exam_id = question["exam_id"]
    await db.exam_questions.delete_one({"id": question_id})
    
    # Update exam total points
    await update_exam_total_points(exam_id)
    
    # Reorder remaining questions
    remaining = await db.exam_questions.find({"exam_id": exam_id}).sort("order", 1).to_list(200)
    for i, q in enumerate(remaining):
        await db.exam_questions.update_one({"id": q["id"]}, {"$set": {"order": i + 1}})
    
    return {"message": "Pregunta eliminada exitosamente"}



@api_router.delete("/exams/questions/{question_id}/image")
async def delete_question_image(
    question_id: str,
    current_user = Depends(get_current_user)
):
    """Delete only the image from a question"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    allowed_roles = ["teacher", "admin", "owner", "director", "coordinator"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    question = await db.exam_questions.find_one({"id": question_id, "school_id": user["school_id"]}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    
    # Delete from Cloudinary
    if question.get("image_url") and "cloudinary.com" in question["image_url"]:
        try:
            parts = question["image_url"].split("/upload/")
            if len(parts) > 1:
                public_id_with_ext = parts[1].split("/", 1)[-1] if "/" in parts[1] else parts[1]
                public_id = public_id_with_ext.rsplit(".", 1)[0]
                cloudinary.uploader.destroy(public_id)
        except Exception as e:
            print(f"Error deleting question image: {e}")
    
    # Remove image_url from question
    await db.exam_questions.update_one(
        {"id": question_id},
        {"$set": {"image_url": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Imagen eliminada exitosamente"}


@api_router.post("/exams/questions/{question_id}/reorder")
async def reorder_exam_question(
    question_id: str,
    new_order: int,
    current_user = Depends(get_current_user)
):
    """Reorder a question within an exam"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    question = await db.exam_questions.find_one({"id": question_id, "school_id": user["school_id"]}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    
    exam_id = question["exam_id"]
    old_order = question["order"]
    
    if new_order == old_order:
        return {"message": "Sin cambios"}
    
    # Get all questions for this exam
    questions = await db.exam_questions.find({"exam_id": exam_id}).sort("order", 1).to_list(200)
    
    # Reorder
    if new_order < old_order:
        # Moving up
        for q in questions:
            if q["order"] >= new_order and q["order"] < old_order:
                await db.exam_questions.update_one({"id": q["id"]}, {"$set": {"order": q["order"] + 1}})
    else:
        # Moving down
        for q in questions:
            if q["order"] > old_order and q["order"] <= new_order:
                await db.exam_questions.update_one({"id": q["id"]}, {"$set": {"order": q["order"] - 1}})
    
    # Set new order for moved question
    await db.exam_questions.update_one({"id": question_id}, {"$set": {"order": new_order}})
    
    return {"message": "Orden actualizado"}


@api_router.get("/exams/{exam_id}/full")
async def get_exam_full_detail(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """Get full exam details including subject info and questions count"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Get subject info
    subject = await db.subjects.find_one({"id": exam["subject_id"]}, {"_id": 0})
    if subject:
        exam["subject_name"] = subject.get("name", "")
        exam["subject_color"] = subject.get("color", "#6366F1")
        
        # Get grade info
        if subject.get("grade_id"):
            grade = await db.grades.find_one({"id": subject["grade_id"]}, {"_id": 0})
            exam["grade_name"] = grade.get("nombre", "") if grade else ""
        
        # Get level info
        if subject.get("level_id"):
            level = await db.academic_levels.find_one({"id": subject["level_id"]}, {"_id": 0})
            exam["level_name"] = level.get("nombre", "") if level else ""
    
    # Get questions count and total points
    questions = await db.exam_questions.find({"exam_id": exam_id}, {"_id": 0}).to_list(200)
    exam["questions_count"] = len(questions)
    exam["total_points"] = sum(q.get("points", 0) for q in questions)
    
    # Get creator info
    if exam.get("created_by"):
        creator = await db.users.find_one({"id": exam["created_by"]}, {"_id": 0, "name": 1, "last_name": 1})
        exam["creator_name"] = f"{creator.get('name', '')} {creator.get('last_name', '')}".strip() if creator else ""
    
    return exam


# ══════════════════════════════════════════════════════════════════════════════
# GOOGLE DRIVE INTEGRATION
# ══════════════════════════════════════════════════════════════════════════════

def create_google_drive_flow(redirect_uri: str, state: str = None):
    """Create Google OAuth flow for Drive API"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google Drive no está configurado en el servidor")
    
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_DRIVE_SCOPES,
        redirect_uri=redirect_uri
    )
    
    if state:
        flow.state = state
    
    return flow

async def get_drive_service(school_id: str):
    """Get authenticated Google Drive service for a school"""
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    if not school.get("google_drive_connected"):
        raise HTTPException(status_code=400, detail="Google Drive no está conectado para este colegio")
    
    encrypted_refresh_token = school.get("google_drive_refresh_token")
    if not encrypted_refresh_token:
        raise HTTPException(status_code=400, detail="No se encontró el token de Google Drive")
    
    try:
        refresh_token = decrypt_token(encrypted_refresh_token)
    except Exception as e:
        logger.error(f"Error decrypting Drive token for school {school_id}: {e}")
        raise HTTPException(status_code=400, detail="Token de Google Drive inválido. Por favor reconecte su cuenta.")
    
    credentials = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=GOOGLE_DRIVE_SCOPES
    )
    
    try:
        service = build('drive', 'v3', credentials=credentials)
        return service
    except Exception as e:
        logger.error(f"Error creating Drive service for school {school_id}: {e}")
        raise HTTPException(status_code=400, detail="Error al conectar con Google Drive. Por favor reconecte su cuenta.")

async def create_drive_folder(service, name: str, parent_id: str = None):
    """Create a folder in Google Drive"""
    file_metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]
    
    folder = service.files().create(body=file_metadata, fields='id').execute()
    return folder.get('id')

async def find_or_create_folder(service, name: str, parent_id: str = None):
    """Find existing folder or create new one"""
    query = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
    
    results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    files = results.get('files', [])
    
    if files:
        return files[0]['id']
    
    return await create_drive_folder(service, name, parent_id)

@api_router.get("/integrations/google-drive/status")
async def get_google_drive_status(current_user=Depends(get_current_user)):
    """Get Google Drive connection status for the school"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    # Check if Drive is properly configured on server
    server_configured = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    
    return {
        "server_configured": server_configured,
        "connected": school.get("google_drive_connected", False),
        "email": school.get("google_drive_email"),
        "connected_at": school.get("google_drive_connected_at"),
        "folder_id": school.get("google_drive_folder_id"),
        "materials_folder_id": school.get("google_drive_materials_folder_id")
    }

@api_router.get("/integrations/google-drive/auth")
async def initiate_google_drive_auth(
    request: Request,
    school_id: str = Query(...),
    current_user=Depends(get_current_user)
):
    """
    Initiate Google Drive OAuth flow.
    Only accessible by school owners (propietarios).
    """
    # Verify user is owner
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Check if user is owner/propietario
    if user.get("role") not in ["owner", "director"] and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Solo el propietario puede configurar Google Drive")
    
    # Verify school belongs to user
    if user.get("school_id") != school_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para este colegio")
    
    # Get school subdomain for redirect after callback
    school = await db.schools.find_one({"id": school_id}, {"_id": 0, "subdomain": 1})
    subdomain = school.get("subdomain", "") if school else ""
    
    # Build redirect_uri dynamically from the request
    origin = request.headers.get("origin")
    if not origin:
        origin = f"{request.url.scheme}://{request.url.netloc}"
    
    origin = origin.rstrip("/")
    redirect_uri = f"{origin}/api/integrations/google-drive/callback"
    
    logger.info(f"Google Drive OAuth - Origin: {origin}, Redirect URI: {redirect_uri}")
    
    # Create the flow first to get Google's generated state
    flow = create_google_drive_flow(redirect_uri, None)
    
    authorization_url, generated_state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    # Now store the data using Google's generated state as the key
    await db.oauth_states.delete_many({"school_id": school_id})  # Clean old states for this school
    await db.oauth_states.insert_one({
        "state_id": generated_state,
        "school_id": school_id,
        "user_id": user['id'],
        "origin": origin,
        "subdomain": subdomain,
        "redirect_uri": redirect_uri,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    })
    
    logger.info(f"Initiating Google Drive auth for school {school_id}, subdomain: {subdomain}, state: {generated_state[:20]}...")
    
    return {"authorization_url": authorization_url}

@api_router.get("/integrations/google-drive/callback")
async def google_drive_callback(
    request: Request,
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None)
):
    """
    Handle Google Drive OAuth callback.
    Creates folder structure and saves tokens.
    """
    # Default fallback URL
    fallback_url = f"{request.url.scheme}://{request.url.netloc}"
    
    # Retrieve state data from database
    state_data = None
    if state:
        state_data = await db.oauth_states.find_one({"state_id": state})
        if state_data:
            # Delete the used state
            await db.oauth_states.delete_one({"state_id": state})
    
    # Extract data from state
    if state_data:
        origin = state_data.get("origin", fallback_url)
        school_id = state_data.get("school_id")
        user_id = state_data.get("user_id")
        subdomain = state_data.get("subdomain", "")
        redirect_uri = state_data.get("redirect_uri")
        logger.info(f"OAuth callback - Retrieved state for school: {school_id}, subdomain: {subdomain}")
    else:
        origin = fallback_url
        school_id = None
        user_id = None
        subdomain = ""
        redirect_uri = f"{origin}/api/integrations/google-drive/callback"
        logger.error(f"OAuth callback - State not found in database: {state}")
    
    # Build the correct settings URL with subdomain
    if subdomain:
        settings_url = f"{origin}/school/{subdomain}/settings"
    else:
        settings_url = f"{origin}/settings"
    
    if error:
        logger.error(f"Google Drive OAuth error: {error}")
        return RedirectResponse(url=f"{settings_url}?error=oauth_denied")
    
    if not code or not state:
        return RedirectResponse(url=f"{settings_url}?error=invalid_callback")
    
    if not school_id or not user_id:
        logger.error(f"Invalid state in Google Drive callback - state not found or expired")
        return RedirectResponse(url=f"{settings_url}?error=invalid_state")
    
    try:
        # Exchange code for tokens
        flow = create_google_drive_flow(redirect_uri, state)
        flow.fetch_token(code=code)
        
        credentials = flow.credentials
        
        if not credentials.refresh_token:
            logger.error("No refresh token received from Google")
            return RedirectResponse(url=f"{settings_url}?error=no_refresh_token")
        
        # Build service to get user info
        service = build('drive', 'v3', credentials=credentials)
        
        # Get user info from the about endpoint
        about = service.about().get(fields="user").execute()
        user_email = about.get("user", {}).get("emailAddress", "")
        
        # Create folder structure: EduNet/Materiales
        logger.info(f"Creating folder structure for school {school_id}")
        
        # Find or create EduNet folder
        edunet_folder_id = await find_or_create_folder(service, "EduNet")
        
        # Find or create Materiales folder inside EduNet
        materials_folder_id = await find_or_create_folder(service, "Materiales", edunet_folder_id)
        
        # Encrypt refresh token before storing
        encrypted_refresh_token = encrypt_token(credentials.refresh_token)
        
        # Update school with Drive connection info
        await db.schools.update_one(
            {"id": school_id},
            {"$set": {
                "google_drive_connected": True,
                "google_drive_email": user_email,
                "google_drive_refresh_token": encrypted_refresh_token,
                "google_drive_folder_id": edunet_folder_id,
                "google_drive_materials_folder_id": materials_folder_id,
                "google_drive_connected_at": datetime.now(timezone.utc).isoformat(),
                "google_drive_connected_by": user_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Google Drive connected successfully for school {school_id}, email: {user_email}")
        
        # Redirect to settings with success
        return RedirectResponse(url=f"{settings_url}?success=google_drive_connected")
        
    except Exception as e:
        logger.error(f"Error in Google Drive callback: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return RedirectResponse(url=f"{settings_url}?error=connection_failed")

@api_router.post("/integrations/google-drive/disconnect")
async def disconnect_google_drive(current_user=Depends(get_current_user)):
    """
    Disconnect Google Drive from the school.
    Only accessible by school owners (propietarios).
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Check if user is owner/propietario
    if user.get("role") not in ["owner", "director"] and not user.get("is_owner"):
        raise HTTPException(status_code=403, detail="Solo el propietario puede desconectar Google Drive")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    # Clear Drive connection (but don't delete files in Drive)
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {
            "google_drive_connected": False,
            "google_drive_email": None,
            "google_drive_refresh_token": None,
            "google_drive_folder_id": None,
            "google_drive_materials_folder_id": None,
            "google_drive_disconnected_at": datetime.now(timezone.utc).isoformat(),
            "google_drive_disconnected_by": user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Google Drive disconnected for school {school_id}")
    
    return {"message": "Google Drive desconectado correctamente"}

@api_router.post("/materials/upload")
async def upload_material_to_drive(
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    current_user=Depends(get_current_user)
):
    """
    Upload a material file to Google Drive.
    Only for non-image files (PDF, DOC, etc.)
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    # Check if Drive is connected
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school or not school.get("google_drive_connected"):
        raise HTTPException(
            status_code=400, 
            detail="Debes conectar Google Drive desde Ajustes antes de subir materiales."
        )
    
    # Validate file extension
    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if file_ext not in GOOGLE_DRIVE_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Extensiones válidas: {', '.join(GOOGLE_DRIVE_ALLOWED_EXTENSIONS)}"
        )
    
    try:
        # Get Drive service
        service = await get_drive_service(school_id)
        
        # Get materials folder ID
        materials_folder_id = school.get("google_drive_materials_folder_id")
        if not materials_folder_id:
            raise HTTPException(status_code=400, detail="Carpeta de materiales no encontrada en Drive")
        
        # Read file content
        file_content = await file.read()
        
        # Get MIME type
        mime_type = MIME_TYPE_MAP.get(file_ext, "application/octet-stream")
        
        # Upload to Drive
        file_metadata = {
            'name': file.filename,
            'parents': [materials_folder_id]
        }
        
        media = MediaIoBaseUpload(
            io.BytesIO(file_content),
            mimetype=mime_type,
            resumable=True
        )
        
        drive_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, mimeType, size, webContentLink'
        ).execute()
        
        # Create material record in database
        material_id = str(uuid.uuid4())
        material_doc = {
            "id": material_id,
            "school_id": school_id,
            "subject_id": subject_id,
            "title": title,
            "description": description,
            "type": "material",
            "post_type": "material",
            "drive_file_id": drive_file.get('id'),
            "drive_file_name": drive_file.get('name'),
            "mime_type": mime_type,
            "file_extension": file_ext,
            "file_size": len(file_content),
            "storage_type": "google_drive",
            "author_id": user["id"],
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.course_posts.insert_one(material_doc)
        
        logger.info(f"Material uploaded to Drive: {file.filename} for school {school_id}")
        
        # Return without _id
        return {
            "id": material_id,
            "title": title,
            "drive_file_id": drive_file.get('id'),
            "drive_file_name": drive_file.get('name'),
            "file_size": len(file_content),
            "message": "Material subido correctamente a Google Drive"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading to Drive: {e}")
        raise HTTPException(status_code=500, detail=f"Error al subir archivo a Google Drive: {str(e)}")


@api_router.post("/files/upload-to-drive")
async def upload_file_to_drive_only(
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    current_user=Depends(get_current_user)
):
    """
    Upload a file to Google Drive WITHOUT creating any database record.
    Used for attaching files to tasks, forums, and board posts.
    The actual post record is created separately via /course/{subject_id}/posts.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    # Check if Drive is connected
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school or not school.get("google_drive_connected"):
        raise HTTPException(
            status_code=400, 
            detail="Debes conectar Google Drive desde Ajustes antes de subir archivos."
        )
    
    # Validate file extension
    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if file_ext not in GOOGLE_DRIVE_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Extensiones válidas: {', '.join(GOOGLE_DRIVE_ALLOWED_EXTENSIONS)}"
        )
    
    try:
        # Get Drive service
        service = await get_drive_service(school_id)
        
        # Get materials folder ID (we use the same folder for all files)
        materials_folder_id = school.get("google_drive_materials_folder_id")
        if not materials_folder_id:
            raise HTTPException(status_code=400, detail="Carpeta de materiales no encontrada en Drive")
        
        # Read file content
        file_content = await file.read()
        
        # Get MIME type
        mime_type = MIME_TYPE_MAP.get(file_ext, "application/octet-stream")
        
        # Upload to Drive
        file_metadata = {
            'name': file.filename,
            'parents': [materials_folder_id]
        }
        
        media = MediaIoBaseUpload(
            io.BytesIO(file_content),
            mimetype=mime_type,
            resumable=True
        )
        
        drive_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, mimeType, size'
        ).execute()
        
        logger.info(f"File uploaded to Drive (no post created): {file.filename} for school {school_id}")
        
        # Return file info - NO database record created
        return {
            "drive_file_id": drive_file.get('id'),
            "drive_file_name": drive_file.get('name'),
            "mime_type": mime_type,
            "file_size": len(file_content),
            "file_extension": file_ext,
            "message": "Archivo subido correctamente a Google Drive"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file to Drive: {e}")
        raise HTTPException(status_code=500, detail=f"Error al subir archivo a Google Drive: {str(e)}")


@api_router.get("/materials/download/{material_id}")
async def download_material_from_drive(
    material_id: str,
    current_user=Depends(get_current_user)
):
    """
    Download a file from Google Drive.
    Works for any post type (material, task, forum, board) that has a drive_file_id.
    Streams the file through the backend - student never sees Drive link.
    Uses true streaming for immediate response.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    # Get post from database - look for any post with drive_file_id
    # This works for materials, tasks, forum posts, and board posts
    post = await db.course_posts.find_one({
        "id": material_id,
        "school_id": school_id,
        "drive_file_id": {"$exists": True, "$ne": None}
    }, {"_id": 0})
    
    if not post:
        # Also try to find by storage_type for backwards compatibility
        post = await db.course_posts.find_one({
            "id": material_id,
            "school_id": school_id,
            "storage_type": "google_drive"
        }, {"_id": 0})
    
    if not post:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    drive_file_id = post.get("drive_file_id")
    if not drive_file_id:
        raise HTTPException(status_code=400, detail="Archivo no encontrado en Drive")
    
    # Validate student access - check if they belong to the course
    if user.get("role") == "student":
        # Get student's assigned subjects via academic_assignments
        assignments = await db.academic_assignments.find({
            "school_id": school_id,
            "section_id": user.get("seccion_id"),
            "status": "activo"
        }, {"_id": 0}).to_list(100)
        
        subject_ids = [a.get("subject_id") for a in assignments]
        if post.get("subject_id") not in subject_ids:
            raise HTTPException(status_code=403, detail="No tienes acceso a este archivo")
    
    # Get file metadata
    file_name = post.get("drive_file_name", post.get("file_name", "archivo"))
    mime_type = post.get("mime_type", post.get("file_type", "application/octet-stream"))
    file_size = post.get("file_size")
    
    try:
        # Get Drive service
        service = await get_drive_service(school_id)
        
        logger.info(f"Starting download stream for: {file_name} by user {user['id']}")
        
        # Create a generator that streams directly from Google Drive
        def stream_from_drive():
            """Generator that streams file chunks from Google Drive"""
            request = service.files().get_media(fileId=drive_file_id)
            
            # Use chunked download for streaming
            file_buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(file_buffer, request, chunksize=1024*1024)  # 1MB chunks
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
                # Yield the chunk that was just downloaded
                chunk = file_buffer.getvalue()
                if chunk:
                    yield chunk
                    file_buffer.seek(0)
                    file_buffer.truncate(0)
        
        # Build headers
        headers_dict = {
            "Content-Disposition": f"attachment; filename=\"{file_name}\"",
            "Cache-Control": "no-cache",
        }
        
        # Add content-length if known (helps browser show progress)
        if file_size:
            headers_dict["Content-Length"] = str(file_size)
        
        # Return streaming response immediately
        return StreamingResponse(
            stream_from_drive(),
            media_type=mime_type,
            headers=headers_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading from Drive: {e}")
        raise HTTPException(status_code=500, detail="Error al descargar archivo de Google Drive")

@api_router.get("/materials/drive-check")
async def check_drive_for_materials(
    subject_id: str = Query(...),
    current_user=Depends(get_current_user)
):
    """
    Check if Google Drive is connected and can be used for materials.
    Returns status and message for UI display.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="Usuario sin colegio asignado")
    
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    
    is_connected = school.get("google_drive_connected", False)
    
    return {
        "connected": is_connected,
        "email": school.get("google_drive_email") if is_connected else None,
        "can_upload": is_connected,
        "message": "Google Drive conectado" if is_connected else "Debes conectar Google Drive desde Ajustes para subir materiales"
    }


# ══════════════════════════════════════════════════════════════════════════════
# EXAM ATTEMPTS - STUDENT EXAM TAKING SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

class ExamAttemptStatus(str, Enum):
    in_progress = "in_progress"
    completed = "completed"
    expired = "expired"
    abandoned = "abandoned"

class StartExamResponse(BaseModel):
    attempt_id: str
    exam_id: str
    remaining_seconds: int
    total_questions: int

class SaveAnswerRequest(BaseModel):
    question_id: str
    selected_option_id: Optional[str] = None
    text_answer: Optional[str] = None

class SubmitExamRequest(BaseModel):
    answers: Optional[List[dict]] = None  # Optional - for bulk submission


@api_router.get("/exams/{exam_id}/debug")
async def debug_exam_data(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """
    DEBUG ENDPOINT - Temporary endpoint to check exam data.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get exam with all fields
    exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0})
    
    if not exam:
        return {"error": "Examen no encontrado", "exam_id": exam_id}
    
    # Get questions count
    questions_count = await db.exam_questions.count_documents({"exam_id": exam_id})
    
    duration_raw = exam.get("duration_minutes")
    
    return {
        "exam_id": exam_id,
        "title": exam.get("title"),
        "school_id": exam.get("school_id"),
        "user_school_id": user.get("school_id"),
        "school_match": exam.get("school_id") == user.get("school_id"),
        "status": exam.get("status"),
        "duration_minutes": {
            "raw_value": duration_raw,
            "type": type(duration_raw).__name__,
            "is_none": duration_raw is None,
            "is_empty_string": duration_raw == "",
            "bool_value": bool(duration_raw)
        },
        "start_datetime": exam.get("start_datetime"),
        "end_datetime": exam.get("end_datetime"),
        "questions_count": questions_count,
        "all_keys": list(exam.keys())
    }


@api_router.post("/exams/{exam_id}/start")
async def start_exam_attempt(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """
    Start an exam attempt. Creates a new attempt record.
    Returns attempt_id and remaining time.
    """
    try:
        user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=403, detail="Usuario no encontrado")
        
        # Only students can take exams
        if user.get("role") != "student":
            raise HTTPException(status_code=403, detail="Solo los estudiantes pueden rendir exámenes")
        
        # Get exam
        exam = await db.online_exams.find_one({"id": exam_id, "school_id": user["school_id"]}, {"_id": 0})
        if not exam:
            raise HTTPException(status_code=404, detail="Examen no encontrado")
        
        # DEBUG: Log exam data
        duration_raw = exam.get("duration_minutes")
        logger.info(f"EXAM DEBUG - ID: {exam_id}")
        logger.info(f"EXAM DEBUG - duration_minutes raw value: {duration_raw}")
        logger.info(f"EXAM DEBUG - duration_minutes type: {type(duration_raw)}")
        logger.info(f"EXAM DEBUG - exam keys: {list(exam.keys())}")
        
        # Robust conversion to int - handle string, None, empty string, etc.
        duration_minutes = 0
        try:
            if duration_raw is not None and duration_raw != "" and duration_raw != "null":
                duration_minutes = int(float(str(duration_raw)))
        except (TypeError, ValueError) as e:
            logger.warning(f"EXAM DEBUG - Could not convert duration: {e}")
            duration_minutes = 0
        
        logger.info(f"EXAM DEBUG - duration_minutes after conversion: {duration_minutes}")
        
        if duration_minutes <= 0:
            raise HTTPException(
                status_code=400, 
                detail=f"El examen no tiene duración configurada (valor recibido: {duration_raw}, tipo: {type(duration_raw).__name__})"
            )
        
        # Validate exam is published
        if exam.get("status") != "published":
            raise HTTPException(status_code=400, detail="Este examen no está disponible")
        
        # Validate date range
        now = datetime.now(timezone.utc)
        
        start_datetime_str = exam.get("start_datetime")
        end_datetime_str = exam.get("end_datetime")
        
        if not start_datetime_str or not end_datetime_str:
            raise HTTPException(status_code=400, detail="El examen no tiene fechas configuradas")
        
        start_dt = datetime.fromisoformat(start_datetime_str.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_datetime_str.replace("Z", "+00:00"))
        
        if now < start_dt:
            raise HTTPException(status_code=400, detail="El examen aún no está disponible")
        if now > end_dt:
            raise HTTPException(status_code=400, detail="El tiempo para este examen ha finalizado")
        
        # Check for existing attempt
        existing_attempt = await db.exam_attempts.find_one({
            "exam_id": exam_id,
            "student_id": user["id"]
        }, {"_id": 0})
        
        if existing_attempt:
            # Check status
            if existing_attempt["status"] == ExamAttemptStatus.completed.value:
                raise HTTPException(status_code=400, detail="Ya has completado este examen")
            if existing_attempt["status"] == ExamAttemptStatus.expired.value:
                raise HTTPException(status_code=400, detail="Tu tiempo para este examen ha expirado")
            
            # If in_progress, return existing attempt
            if existing_attempt["status"] == ExamAttemptStatus.in_progress.value:
                # Calculate remaining time
                start_time = datetime.fromisoformat(existing_attempt["start_time"].replace("Z", "+00:00"))
                elapsed = (now - start_time).total_seconds()
                duration_seconds = duration_minutes * 60
                
                # Calculate time until exam window closes
                time_until_end = (end_dt - now).total_seconds()
                
                # Remaining time is the minimum of: (duration - elapsed) OR time until window closes
                remaining_by_duration = duration_seconds - elapsed
                remaining = max(0, min(remaining_by_duration, time_until_end))
                
                # Check if time has run out
                if remaining <= 0:
                    # Auto-expire the attempt
                    await db.exam_attempts.update_one(
                        {"id": existing_attempt["id"]},
                        {"$set": {"status": ExamAttemptStatus.expired.value, "end_time": now.isoformat()}}
                    )
                    raise HTTPException(status_code=400, detail="Tu tiempo para este examen ha expirado")
                
                # Get questions count
                questions_count = await db.exam_questions.count_documents({"exam_id": exam_id})
                
                return {
                    "attempt_id": existing_attempt["id"],
                    "exam_id": exam_id,
                    "remaining_seconds": int(remaining),
                    "total_questions": questions_count,
                    "resumed": True
                }
        
        # Create new attempt
        attempt_id = str(uuid.uuid4())
        questions_count = await db.exam_questions.count_documents({"exam_id": exam_id})
        
        if questions_count == 0:
            raise HTTPException(status_code=400, detail="Este examen no tiene preguntas")
        
        attempt = {
            "id": attempt_id,
            "exam_id": exam_id,
            "student_id": user["id"],
            "student_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
            "school_id": user["school_id"],
            "start_time": now.isoformat(),
            "end_time": None,
            "status": ExamAttemptStatus.in_progress.value,
            "score": None,
            "max_score": None,
            "percentage": None,
            "passed": None,
            "answers": {},  # Dict of question_id -> answer
            "tab_changes": 0,
            "created_at": now.isoformat()
        }
        
        await db.exam_attempts.insert_one(attempt)
        
        # Calculate remaining time as minimum of: duration OR time until window closes
        duration_seconds = duration_minutes * 60
        time_until_end = (end_dt - now).total_seconds()
        remaining_seconds = int(min(duration_seconds, time_until_end))
        
        return {
            "attempt_id": attempt_id,
            "exam_id": exam_id,
            "remaining_seconds": remaining_seconds,
            "total_questions": questions_count,
            "resumed": False
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting exam attempt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al iniciar el examen: {str(e)}")


@api_router.get("/exams/{exam_id}/questions-for-student")
async def get_exam_questions_for_student(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get exam questions for a student taking the exam.
    Does NOT include correct answers.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Verify student has an active attempt
    attempt = await db.exam_attempts.find_one({
        "exam_id": exam_id,
        "student_id": user["id"],
        "status": ExamAttemptStatus.in_progress.value
    }, {"_id": 0})
    
    if not attempt:
        raise HTTPException(status_code=400, detail="No tienes un intento activo para este examen")
    
    # Get questions without correct_answer field
    questions = await db.exam_questions.find(
        {"exam_id": exam_id},
        {"_id": 0, "correct_answer": 0, "correct_option_id": 0}  # Exclude answers
    ).sort("order", 1).to_list(200)
    
    # Get exam for subject info
    exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0, "title": 1, "subject_id": 1, "duration_minutes": 1})
    subject = await db.subjects.find_one({"id": exam.get("subject_id")}, {"_id": 0, "name": 1, "color": 1}) if exam else None
    
    # Get previously saved answers
    saved_answers = attempt.get("answers", {})
    
    return {
        "exam_id": exam_id,
        "exam_title": exam.get("title", "") if exam else "",
        "subject_name": subject.get("name", "") if subject else "",
        "subject_color": subject.get("color", "#6366F1") if subject else "#6366F1",
        "questions": questions,
        "saved_answers": saved_answers,
        "total_questions": len(questions)
    }


@api_router.post("/exam-attempts/{attempt_id}/save-answer")
async def save_exam_answer(
    attempt_id: str,
    data: SaveAnswerRequest,
    current_user = Depends(get_current_user)
):
    """
    Save a single answer during exam. Auto-save functionality.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get attempt
    attempt = await db.exam_attempts.find_one({
        "id": attempt_id,
        "student_id": user["id"]
    }, {"_id": 0})
    
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    
    if attempt["status"] != ExamAttemptStatus.in_progress.value:
        raise HTTPException(status_code=400, detail="Este intento ya no está activo")
    
    # Check if time has expired
    exam = await db.online_exams.find_one({"id": attempt["exam_id"]}, {"_id": 0})
    if exam:
        start_time = datetime.fromisoformat(attempt["start_time"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        elapsed = (now - start_time).total_seconds()
        
        # Safely get duration_minutes
        duration_minutes = exam.get("duration_minutes")
        try:
            if duration_minutes:
                duration_seconds = int(float(str(duration_minutes))) * 60
            else:
                duration_seconds = 60 * 60  # Default 60 minutes if not set
        except (TypeError, ValueError):
            duration_seconds = 60 * 60
        
        if elapsed > duration_seconds:
            # Auto-expire
            await db.exam_attempts.update_one(
                {"id": attempt_id},
                {"$set": {"status": ExamAttemptStatus.expired.value, "end_time": now.isoformat()}}
            )
            raise HTTPException(status_code=400, detail="El tiempo ha expirado")
    
    # Save answer
    answer_data = {
        "selected_option_id": data.selected_option_id,
        "text_answer": data.text_answer,
        "saved_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.exam_attempts.update_one(
        {"id": attempt_id},
        {"$set": {f"answers.{data.question_id}": answer_data}}
    )
    
    return {"message": "Respuesta guardada", "question_id": data.question_id}


@api_router.post("/exam-attempts/{attempt_id}/report-tab-change")
async def report_tab_change(
    attempt_id: str,
    current_user = Depends(get_current_user)
):
    """
    Report when student changes browser tab. Anti-cheat measure.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    attempt = await db.exam_attempts.find_one({
        "id": attempt_id,
        "student_id": user["id"],
        "status": ExamAttemptStatus.in_progress.value
    }, {"_id": 0})
    
    if not attempt:
        return {"message": "Intento no encontrado o ya finalizado", "force_submit": False}
    
    new_count = attempt.get("tab_changes", 0) + 1
    
    await db.exam_attempts.update_one(
        {"id": attempt_id},
        {"$set": {"tab_changes": new_count}}
    )
    
    # If 3 or more tab changes, force submit
    force_submit = new_count >= 3
    
    return {
        "tab_changes": new_count,
        "force_submit": force_submit,
        "warning": f"Advertencia: Has cambiado de pestaña {new_count} vez(es). Al llegar a 3, el examen se enviará automáticamente." if new_count < 3 else "Se ha excedido el límite de cambios de pestaña."
    }


@api_router.post("/exam-attempts/{attempt_id}/submit")
async def submit_exam_attempt(
    attempt_id: str,
    data: Optional[SubmitExamRequest] = None,
    current_user = Depends(get_current_user)
):
    """
    Submit exam and auto-grade.
    Can be called manually by student or automatically when time runs out.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get attempt
    attempt = await db.exam_attempts.find_one({
        "id": attempt_id,
        "student_id": user["id"]
    }, {"_id": 0})
    
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    
    # Allow submission even if expired (for auto-submit on timeout)
    if attempt["status"] == ExamAttemptStatus.completed.value:
        raise HTTPException(status_code=400, detail="Este examen ya fue enviado")
    
    # Get exam
    exam = await db.online_exams.find_one({"id": attempt["exam_id"]}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    
    # Get all questions with answers
    questions = await db.exam_questions.find(
        {"exam_id": attempt["exam_id"]},
        {"_id": 0}
    ).to_list(200)
    
    # Calculate score
    total_points = 0
    earned_points = 0
    correct_count = 0
    incorrect_count = 0
    unanswered_count = 0
    
    answers = attempt.get("answers", {})
    graded_answers = {}
    
    for question in questions:
        q_id = question["id"]
        q_points = question.get("points", 1)
        total_points += q_points
        
        student_answer = answers.get(q_id, {})
        selected_option = student_answer.get("selected_option_id")
        text_answer = student_answer.get("text_answer")
        
        is_correct = False
        
        if question["question_type"] == "multiple_choice":
            # Find the correct option from the options array
            correct_option_id = None
            options = question.get("options", [])
            for opt in options:
                if opt.get("is_correct"):
                    correct_option_id = opt.get("id")
                    break
            
            if selected_option and correct_option_id and selected_option == correct_option_id:
                is_correct = True
                earned_points += q_points
                correct_count += 1
            elif selected_option:
                incorrect_count += 1
            else:
                unanswered_count += 1
        
        elif question["question_type"] == "true_false":
            correct_answer = question.get("correct_answer")
            if selected_option:
                # selected_option will be "true" or "false"
                if selected_option.lower() == str(correct_answer).lower():
                    is_correct = True
                    earned_points += q_points
                    correct_count += 1
                else:
                    incorrect_count += 1
            else:
                unanswered_count += 1
        
        elif question["question_type"] == "fill_blanks":
            correct_answer = question.get("correct_answer", "").lower().strip()
            if text_answer and text_answer.lower().strip() == correct_answer:
                is_correct = True
                earned_points += q_points
                correct_count += 1
            elif text_answer:
                incorrect_count += 1
            else:
                unanswered_count += 1
        
        graded_answers[q_id] = {
            "selected_option_id": selected_option,
            "text_answer": text_answer,
            "is_correct": is_correct,
            "points_earned": q_points if is_correct else 0,
            "points_possible": q_points
        }
    
    # Calculate percentage and pass/fail
    percentage = (earned_points / total_points * 100) if total_points > 0 else 0
    min_percentage = exam.get("min_score_percentage", 60)
    passed = percentage >= min_percentage
    
    now = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(attempt["start_time"].replace("Z", "+00:00"))
    time_used_seconds = int((now - start_time).total_seconds())
    
    # Update attempt
    await db.exam_attempts.update_one(
        {"id": attempt_id},
        {"$set": {
            "status": ExamAttemptStatus.completed.value,
            "end_time": now.isoformat(),
            "score": earned_points,
            "max_score": total_points,
            "percentage": round(percentage, 2),
            "passed": passed,
            "correct_count": correct_count,
            "incorrect_count": incorrect_count,
            "unanswered_count": unanswered_count,
            "graded_answers": graded_answers,
            "time_used_seconds": time_used_seconds
        }}
    )
    
    return {
        "message": "Examen enviado exitosamente",
        "attempt_id": attempt_id,
        "score": earned_points,
        "max_score": total_points,
        "percentage": round(percentage, 2),
        "passed": passed,
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "unanswered_count": unanswered_count,
        "time_used_seconds": time_used_seconds,
        "min_percentage": min_percentage
    }


@api_router.get("/exam-attempts/{attempt_id}/result")
async def get_exam_result(
    attempt_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get exam result after completion.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get attempt
    attempt = await db.exam_attempts.find_one({
        "id": attempt_id,
        "student_id": user["id"]
    }, {"_id": 0})
    
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    
    if attempt["status"] not in [ExamAttemptStatus.completed.value, ExamAttemptStatus.expired.value]:
        raise HTTPException(status_code=400, detail="El examen aún no ha sido completado")
    
    # Get exam info
    exam = await db.online_exams.find_one({"id": attempt["exam_id"]}, {"_id": 0})
    
    # Get subject info
    subject = None
    if exam:
        subject = await db.subjects.find_one({"id": exam.get("subject_id")}, {"_id": 0, "name": 1, "color": 1})
    
    # Get questions for review (with correct answers)
    questions = await db.exam_questions.find(
        {"exam_id": attempt["exam_id"]},
        {"_id": 0}
    ).sort("order", 1).to_list(200)
    
    # Build detailed result
    graded_answers = attempt.get("graded_answers", {})
    questions_review = []
    
    for q in questions:
        q_id = q["id"]
        graded = graded_answers.get(q_id, {})
        
        # Extract correct_option_id from options array for multiple choice
        correct_option_id = None
        if q.get("question_type") == "multiple_choice":
            for opt in q.get("options", []):
                if opt.get("is_correct"):
                    correct_option_id = opt.get("id")
                    break
        
        questions_review.append({
            "id": q_id,
            "question_text": q.get("question_text"),
            "question_type": q.get("question_type"),
            "image_url": q.get("image_url"),
            "options": q.get("options", []),
            "correct_option_id": correct_option_id,
            "correct_answer": q.get("correct_answer"),
            "student_answer": graded.get("selected_option_id") or graded.get("text_answer"),
            "is_correct": graded.get("is_correct", False),
            "points_earned": graded.get("points_earned", 0),
            "points_possible": graded.get("points_possible", q.get("points", 1))
        })
    
    return {
        "attempt_id": attempt_id,
        "exam_id": attempt["exam_id"],
        "exam_title": exam.get("title", "") if exam else "",
        "subject_name": subject.get("name", "") if subject else "",
        "subject_color": subject.get("color", "#6366F1") if subject else "#6366F1",
        "student_name": attempt.get("student_name", ""),
        "start_time": attempt.get("start_time"),
        "end_time": attempt.get("end_time"),
        "time_used_seconds": attempt.get("time_used_seconds", 0),
        "score": attempt.get("score", 0),
        "max_score": attempt.get("max_score", 0),
        "percentage": attempt.get("percentage", 0),
        "passed": attempt.get("passed", False),
        "min_percentage": exam.get("min_score_percentage", 60) if exam else 60,
        "correct_count": attempt.get("correct_count", 0),
        "incorrect_count": attempt.get("incorrect_count", 0),
        "unanswered_count": attempt.get("unanswered_count", 0),
        "questions": questions_review,
        "tab_changes": attempt.get("tab_changes", 0)
    }


@api_router.get("/exams/{exam_id}/my-attempt")
async def get_my_exam_attempt(
    exam_id: str,
    current_user = Depends(get_current_user)
):
    """
    Check if student has an attempt for this exam.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    attempt = await db.exam_attempts.find_one({
        "exam_id": exam_id,
        "student_id": user["id"]
    }, {"_id": 0})
    
    if not attempt:
        return {"has_attempt": False, "attempt": None}
    
    return {
        "has_attempt": True,
        "attempt": {
            "id": attempt["id"],
            "status": attempt["status"],
            "score": attempt.get("score"),
            "max_score": attempt.get("max_score"),
            "percentage": attempt.get("percentage"),
            "passed": attempt.get("passed"),
            "start_time": attempt.get("start_time"),
            "end_time": attempt.get("end_time")
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# INTERNAL MAIL SYSTEM - Premium Email-like Messaging
# ══════════════════════════════════════════════════════════════════════════════

class InternalMailCreate(BaseModel):
    subject: str
    body: str
    recipient_ids: List[str]  # List of user IDs
    recipient_type: Optional[str] = "individual"  # individual, role, section
    attachments: Optional[List[dict]] = []

class InternalMailReply(BaseModel):
    body: str
    attachments: Optional[List[dict]] = []

# Get inbox messages
@api_router.get("/internal-mail/inbox")
async def get_inbox(
    page: int = 1,
    limit: int = 20,
    current_user = Depends(get_current_user)
):
    """Get inbox messages for current user"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    skip = (page - 1) * limit
    
    # Find messages where user is recipient and not deleted
    pipeline = [
        {"$match": {
            "recipients.user_id": user["id"],
            "recipients.is_deleted": {"$ne": True}
        }},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    messages = await db.internal_mail.aggregate(pipeline).to_list(limit)
    
    # Get total count
    total = await db.internal_mail.count_documents({
        "recipients.user_id": user["id"],
        "recipients.is_deleted": {"$ne": True}
    })
    
    # Enrich with sender info and recipient status
    enriched = []
    for msg in messages:
        sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "password": 0})
        
        # Find this user's recipient entry
        recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), {})
        
        enriched.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body_preview": msg["body"][:150] + "..." if len(msg["body"]) > 150 else msg["body"],
            "body": msg["body"],
            "sender": {
                "id": sender["id"] if sender else None,
                "name": sender.get("name", "Usuario") if sender else "Usuario eliminado",
                "email": sender.get("email", "") if sender else "",
                "photo_url": sender.get("photo_url") if sender else None,
                "role": sender.get("role", "") if sender else ""
            },
            "created_at": msg["created_at"],
            "is_read": recipient_entry.get("is_read", False),
            "is_starred": recipient_entry.get("is_starred", False),
            "is_archived": recipient_entry.get("is_archived", False),
            "has_attachments": len(msg.get("attachments", [])) > 0,
            "attachments": msg.get("attachments", []),
            "recipient_count": len(msg.get("recipients", []))
        })
    
    return {
        "messages": enriched,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# Get sent messages
@api_router.get("/internal-mail/sent")
async def get_sent(
    page: int = 1,
    limit: int = 20,
    current_user = Depends(get_current_user)
):
    """Get sent messages for current user"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    skip = (page - 1) * limit
    
    messages = await db.internal_mail.find(
        {"sender_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.internal_mail.count_documents({"sender_id": user["id"]})
    
    enriched = []
    for msg in messages:
        # Get recipient names
        recipient_ids = [r["user_id"] for r in msg.get("recipients", [])]
        recipients = await db.users.find(
            {"id": {"$in": recipient_ids}},
            {"_id": 0, "id": 1, "name": 1, "photo_url": 1}
        ).to_list(100)
        
        enriched.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body_preview": msg["body"][:150] + "..." if len(msg["body"]) > 150 else msg["body"],
            "body": msg["body"],
            "recipients": recipients,
            "created_at": msg["created_at"],
            "has_attachments": len(msg.get("attachments", [])) > 0,
            "attachments": msg.get("attachments", []),
            "recipient_count": len(recipients)
        })
    
    return {
        "messages": enriched,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# Get unread messages
@api_router.get("/internal-mail/unread")
async def get_unread(current_user = Depends(get_current_user)):
    """Get unread messages count and list"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Count unread
    pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user["id"],
                    "is_read": False,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    
    result = await db.internal_mail.aggregate(pipeline).to_list(1)
    count = result[0]["count"] if result else 0
    
    return {"unread_count": count}

# Get archived messages
@api_router.get("/internal-mail/archived")
async def get_archived(
    page: int = 1,
    limit: int = 20,
    current_user = Depends(get_current_user)
):
    """Get archived messages"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    skip = (page - 1) * limit
    
    pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user["id"],
                    "is_archived": True,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    messages = await db.internal_mail.aggregate(pipeline).to_list(limit)
    
    enriched = []
    for msg in messages:
        sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "password": 0})
        recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), {})
        
        enriched.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body_preview": msg["body"][:150] + "..." if len(msg["body"]) > 150 else msg["body"],
            "sender": {
                "id": sender["id"] if sender else None,
                "name": sender.get("name", "Usuario") if sender else "Usuario eliminado",
                "photo_url": sender.get("photo_url") if sender else None,
            },
            "created_at": msg["created_at"],
            "is_read": recipient_entry.get("is_read", False),
            "has_attachments": len(msg.get("attachments", [])) > 0
        })
    
    return {"messages": enriched}

# Get trash messages
@api_router.get("/internal-mail/trash")
async def get_trash(
    page: int = 1,
    limit: int = 20,
    current_user = Depends(get_current_user)
):
    """Get deleted/trash messages"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    skip = (page - 1) * limit
    
    pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user["id"],
                    "is_deleted": True
                }
            }
        }},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    messages = await db.internal_mail.aggregate(pipeline).to_list(limit)
    
    enriched = []
    for msg in messages:
        sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "password": 0})
        
        enriched.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body_preview": msg["body"][:150] + "..." if len(msg["body"]) > 150 else msg["body"],
            "sender": {
                "id": sender["id"] if sender else None,
                "name": sender.get("name", "Usuario") if sender else "Usuario eliminado",
                "photo_url": sender.get("photo_url") if sender else None,
            },
            "created_at": msg["created_at"],
            "has_attachments": len(msg.get("attachments", [])) > 0
        })
    
    return {"messages": enriched}


# Get mail stats - MUST be before {message_id} route
@api_router.get("/internal-mail/stats")
async def get_mail_stats(current_user = Depends(get_current_user)):
    """Get mail statistics for badges"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    user_id = user["id"]
    
    # Unread count
    unread_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user_id,
                    "is_read": False,
                    "is_deleted": {"$ne": True},
                    "is_archived": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    unread_result = await db.internal_mail.aggregate(unread_pipeline).to_list(1)
    unread = unread_result[0]["count"] if unread_result else 0
    
    # Inbox count (not archived, not deleted)
    inbox_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user_id,
                    "is_deleted": {"$ne": True},
                    "is_archived": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    inbox_result = await db.internal_mail.aggregate(inbox_pipeline).to_list(1)
    inbox = inbox_result[0]["count"] if inbox_result else 0
    
    # Sent count
    sent = await db.internal_mail.count_documents({"sender_id": user_id})
    
    # Archived count
    archived_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user_id,
                    "is_archived": True,
                    "is_deleted": {"$ne": True}
                }
            }
        }},
        {"$count": "count"}
    ]
    archived_result = await db.internal_mail.aggregate(archived_pipeline).to_list(1)
    archived = archived_result[0]["count"] if archived_result else 0
    
    # Trash count
    trash_pipeline = [
        {"$match": {
            "recipients": {
                "$elemMatch": {
                    "user_id": user_id,
                    "is_deleted": True
                }
            }
        }},
        {"$count": "count"}
    ]
    trash_result = await db.internal_mail.aggregate(trash_pipeline).to_list(1)
    trash = trash_result[0]["count"] if trash_result else 0
    
    return {
        "unread": unread,
        "inbox": inbox,
        "sent": sent,
        "archived": archived,
        "trash": trash
    }


# Get single message
@api_router.get("/internal-mail/{message_id}")
async def get_message(message_id: str, current_user = Depends(get_current_user)):
    """Get a single message and mark as read"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    msg = await db.internal_mail.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    # Check if user is sender or recipient
    is_sender = msg["sender_id"] == user["id"]
    recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), None)
    
    if not is_sender and not recipient_entry:
        raise HTTPException(status_code=403, detail="No tienes acceso a este mensaje")
    
    # Mark as read if recipient
    if recipient_entry and not recipient_entry.get("is_read"):
        await db.internal_mail.update_one(
            {"id": message_id, "recipients.user_id": user["id"]},
            {"$set": {"recipients.$.is_read": True, "recipients.$.read_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Get sender info
    sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "password": 0})
    
    # Get all recipients info
    recipient_ids = [r["user_id"] for r in msg.get("recipients", [])]
    recipients_data = await db.users.find(
        {"id": {"$in": recipient_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "photo_url": 1, "role": 1}
    ).to_list(100)
    
    return {
        "id": msg["id"],
        "subject": msg["subject"],
        "body": msg["body"],
        "sender": {
            "id": sender["id"] if sender else None,
            "name": sender.get("name", "Usuario") if sender else "Usuario eliminado",
            "email": sender.get("email", "") if sender else "",
            "photo_url": sender.get("photo_url") if sender else None,
            "role": sender.get("role", "") if sender else ""
        },
        "recipients": recipients_data,
        "created_at": msg["created_at"],
        "attachments": msg.get("attachments", []),
        "is_read": recipient_entry.get("is_read", True) if recipient_entry else True,
        "is_starred": recipient_entry.get("is_starred", False) if recipient_entry else False,
        "is_archived": recipient_entry.get("is_archived", False) if recipient_entry else False,
        "thread_id": msg.get("thread_id"),
        "reply_to_id": msg.get("reply_to_id")
    }

# Send new message
@api_router.post("/internal-mail/send")
async def send_internal_mail(data: InternalMailCreate, current_user = Depends(get_current_user)):
    """Send a new internal mail message"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if not data.subject.strip():
        raise HTTPException(status_code=400, detail="El asunto es requerido")
    
    if not data.body.strip():
        raise HTTPException(status_code=400, detail="El cuerpo del mensaje es requerido")
    
    if not data.recipient_ids:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos un destinatario")
    
    # RBAC: Students cannot send mass messages
    if user.get("role") == "student" and len(data.recipient_ids) > 5:
        raise HTTPException(status_code=403, detail="Los estudiantes no pueden enviar mensajes masivos")
    
    # Create recipient entries
    recipients = []
    for rid in data.recipient_ids:
        recipients.append({
            "user_id": rid,
            "is_read": False,
            "is_starred": False,
            "is_archived": False,
            "is_deleted": False
        })
    
    message_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())  # New thread
    
    message = {
        "id": message_id,
        "thread_id": thread_id,
        "sender_id": user["id"],
        "subject": data.subject.strip(),
        "body": data.body,
        "recipients": recipients,
        "attachments": data.attachments or [],
        "school_id": user.get("school_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_mail.insert_one(message)
    
    return {"id": message_id, "thread_id": thread_id, "message": "Mensaje enviado correctamente"}

# Reply to message
@api_router.post("/internal-mail/{message_id}/reply")
async def reply_to_mail(message_id: str, data: InternalMailReply, current_user = Depends(get_current_user)):
    """Reply to a message"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    original = await db.internal_mail.find_one({"id": message_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Mensaje original no encontrado")
    
    # Reply goes to original sender
    reply_to_id = original["sender_id"]
    
    # Create recipient entry for original sender
    recipients = [{
        "user_id": reply_to_id,
        "is_read": False,
        "is_starred": False,
        "is_archived": False,
        "is_deleted": False
    }]
    
    new_id = str(uuid.uuid4())
    
    reply = {
        "id": new_id,
        "thread_id": original.get("thread_id", message_id),
        "reply_to_id": message_id,
        "sender_id": user["id"],
        "subject": f"Re: {original['subject']}" if not original['subject'].startswith("Re:") else original['subject'],
        "body": data.body,
        "recipients": recipients,
        "attachments": data.attachments or [],
        "school_id": user.get("school_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_mail.insert_one(reply)
    
    return {"id": new_id, "message": "Respuesta enviada correctamente"}

# Mark message as read/unread
@api_router.put("/internal-mail/{message_id}/read")
async def toggle_read(message_id: str, is_read: bool = True, current_user = Depends(get_current_user)):
    """Mark message as read or unread"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    result = await db.internal_mail.update_one(
        {"id": message_id, "recipients.user_id": user["id"]},
        {"$set": {"recipients.$.is_read": is_read}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    return {"success": True}

# Star/unstar message
@api_router.put("/internal-mail/{message_id}/star")
async def toggle_star(message_id: str, is_starred: bool = True, current_user = Depends(get_current_user)):
    """Star or unstar a message"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    await db.internal_mail.update_one(
        {"id": message_id, "recipients.user_id": user["id"]},
        {"$set": {"recipients.$.is_starred": is_starred}}
    )
    
    return {"success": True}

# Archive message
@api_router.put("/internal-mail/{message_id}/archive")
async def archive_message(message_id: str, is_archived: bool = True, current_user = Depends(get_current_user)):
    """Archive or unarchive a message"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Check if user is sender or recipient
    message = await db.internal_mail.find_one({"id": message_id}, {"_id": 0, "sender_id": 1, "recipients": 1})
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    if message.get("sender_id") == user["id"]:
        # User is sender - update sender_archived flag
        await db.internal_mail.update_one(
            {"id": message_id},
            {"$set": {"sender_archived": is_archived}}
        )
    else:
        # User is recipient - update recipient's is_archived
        await db.internal_mail.update_one(
            {"id": message_id, "recipients.user_id": user["id"]},
            {"$set": {"recipients.$.is_archived": is_archived}}
        )
    
    return {"success": True}

# Delete message (soft delete)
@api_router.delete("/internal-mail/{message_id}")
async def delete_internal_mail(message_id: str, current_user = Depends(get_current_user)):
    """Soft delete a message (move to trash)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Check if user is sender or recipient
    message = await db.internal_mail.find_one({"id": message_id}, {"_id": 0, "sender_id": 1, "recipients": 1})
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    if message.get("sender_id") == user["id"]:
        # User is sender - update sender_deleted flag
        await db.internal_mail.update_one(
            {"id": message_id},
            {"$set": {"sender_deleted": True, "sender_deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # User is recipient - update recipient's is_deleted
        await db.internal_mail.update_one(
            {"id": message_id, "recipients.user_id": user["id"]},
            {"$set": {"recipients.$.is_deleted": True, "recipients.$.deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"success": True}

# Restore from trash
@api_router.put("/internal-mail/{message_id}/restore")
async def restore_message(message_id: str, current_user = Depends(get_current_user)):
    """Restore a message from trash"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    await db.internal_mail.update_one(
        {"id": message_id, "recipients.user_id": user["id"]},
        {"$set": {"recipients.$.is_deleted": False}, "$unset": {"recipients.$.deleted_at": ""}}
    )
    
    return {"success": True}

# Get contacts for composing
@api_router.get("/internal-mail/contacts/search")
async def search_contacts(q: str = "", current_user = Depends(get_current_user)):
    """Search contacts for message composition"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    
    query = {
        "school_id": school_id,
        "id": {"$ne": user["id"]},  # Exclude self
        "is_active": {"$ne": False}  # Include users with is_active=True or missing field
    }
    
    if q:
        # Search in name, first_name, last_name and email
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"first_name": {"$regex": q, "$options": "i"}},
            {"last_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}}
        ]
    
    # RBAC: Parents can only see teachers of their children
    if user.get("role") == "parent":
        # Get children's teacher IDs
        children = await db.users.find({"parent_ids": user["id"]}, {"_id": 0, "id": 1}).to_list(100)
        child_ids = [c["id"] for c in children]
        
        enrollments = await db.enrollments.find({"student_id": {"$in": child_ids}}, {"_id": 0, "course_id": 1}).to_list(100)
        course_ids = list(set([e["course_id"] for e in enrollments]))
        
        courses = await db.courses.find({"id": {"$in": course_ids}}, {"_id": 0, "teacher_id": 1}).to_list(100)
        teacher_ids = list(set([c["teacher_id"] for c in courses if c.get("teacher_id")]))
        
        query["id"] = {"$in": teacher_ids}
    
    contacts = await db.users.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "role": 1, "photo_url": 1}
    ).limit(50).to_list(50)
    
    return {"contacts": contacts}


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT PORTAL - MESSAGES (Course Context)
# Uses subject_id as course identifier, academic_assignments for teacher info,
# and seccion_id for classmates
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/student-portal/messages/allowed-recipients")
async def get_student_allowed_recipients(course_id: str, current_user = Depends(get_current_user)):
    """Get allowed recipients for a student within a subject/course context
    course_id is actually subject_id from the frontend
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Solo estudiantes pueden acceder a este endpoint")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    subject_id = course_id  # course_id is actually subject_id
    
    # Get subject name
    subject = await db.subjects.find_one({"id": subject_id, "school_id": school_id}, {"_id": 0, "name": 1})
    subject_name = subject.get("name") if subject else "Asignatura"
    
    allowed_recipients = []
    
    # 1. Add school owner/admin first (priority)
    owners = await db.users.find({
        "school_id": school_id,
        "role": {"$in": ["owner", "admin"]},
        "is_active": {"$ne": False}
    }, {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "photo_url": 1, "role": 1}).to_list(10)
    
    for owner in owners:
        full_name = f"{owner.get('name', '')} {owner.get('last_name', '')}".strip() or owner.get('first_name', '')
        allowed_recipients.append({
            "id": owner["id"],
            "name": full_name,
            "email": owner.get("email"),
            "photo_url": owner.get("photo_url"),
            "role": "owner" if owner.get("role") == "owner" else "admin",
            "role_label": "Propietario" if owner.get("role") == "owner" else "Administrador"
        })
    
    # 2. Find teacher from academic_assignments for this subject and section
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0, "teacher_id": 1})
    
    if assignment and assignment.get("teacher_id"):
        teacher = await db.users.find_one(
            {"id": assignment["teacher_id"]},
            {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "photo_url": 1, "role": 1}
        )
        if teacher:
            full_name = f"{teacher.get('name', '')} {teacher.get('last_name', '')}".strip() or teacher.get('first_name', '')
            allowed_recipients.append({
                "id": teacher["id"],
                "name": full_name,
                "email": teacher.get("email"),
                "photo_url": teacher.get("photo_url"),
                "role": "teacher",
                "course_name": subject_name
            })
    
    # 3. Add classmates (students in same section)
    if seccion_id:
        classmates = await db.users.find({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "id": {"$ne": user["id"]},
            "is_active": {"$ne": False}
        }, {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "photo_url": 1, "role": 1}).to_list(100)
        
        for student in classmates:
            full_name = f"{student.get('name', '')} {student.get('last_name', '')}".strip() or student.get('first_name', '')
            allowed_recipients.append({
                "id": student["id"],
                "name": full_name,
                "email": student.get("email"),
                "photo_url": student.get("photo_url"),
                "role": "student"
            })
    
    return {"recipients": allowed_recipients, "course_name": subject_name}


@api_router.get("/student-portal/messages/inbox")
async def get_student_messages_inbox(
    course_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get inbox messages for a student within a course context"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    subject_id = course_id
    
    # Build list of allowed sender IDs (teacher + classmates)
    allowed_ids = [user["id"]]  # Include self for sent messages in same context
    
    # Get teacher
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0, "teacher_id": 1})
    
    if assignment and assignment.get("teacher_id"):
        allowed_ids.append(assignment["teacher_id"])
    
    # Get classmates
    if seccion_id:
        classmates = await db.users.find({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "is_active": {"$ne": False}
        }, {"_id": 0, "id": 1}).to_list(100)
        allowed_ids.extend([c["id"] for c in classmates])
    
    # Also include school owner/admin messages
    owners = await db.users.find({
        "school_id": school_id,
        "role": {"$in": ["owner", "admin"]}
    }, {"_id": 0, "id": 1}).to_list(20)
    allowed_ids.extend([o["id"] for o in owners])
    
    # Remove duplicates
    allowed_ids = list(set(allowed_ids))
    
    # Get messages where user is recipient and sender is in allowed list
    pipeline = [
        {
            "$match": {
                "recipients": {
                    "$elemMatch": {
                        "user_id": user["id"],
                        "is_deleted": {"$ne": True},
                        "is_archived": {"$ne": True}
                    }
                },
                "sender_id": {"$in": allowed_ids}
            }
        },
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    messages = await db.internal_mail.aggregate(pipeline).to_list(limit)
    
    # Enrich with sender info
    result = []
    for msg in messages:
        sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1})
        
        recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), None)
        
        result.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body": msg["body"][:200] + "..." if len(msg.get("body", "")) > 200 else msg.get("body", ""),
            "sender": {
                "id": sender["id"] if sender else msg["sender_id"],
                "name": f"{sender.get('name', '')} {sender.get('last_name', '')}".strip() if sender else "Usuario",
                "photo_url": sender.get("photo_url") if sender else None,
                "role": sender.get("role") if sender else None
            },
            "is_read": recipient_entry.get("is_read", False) if recipient_entry else False,
            "is_starred": recipient_entry.get("is_starred", False) if recipient_entry else False,
            "created_at": msg["created_at"],
            "thread_id": msg.get("thread_id")
        })
    
    # Total count
    total_pipeline = [
        {
            "$match": {
                "recipients": {
                    "$elemMatch": {
                        "user_id": user["id"],
                        "is_deleted": {"$ne": True},
                        "is_archived": {"$ne": True}
                    }
                },
                "sender_id": {"$in": allowed_ids}
            }
        },
        {"$count": "total"}
    ]
    total_result = await db.internal_mail.aggregate(total_pipeline).to_list(1)
    total = total_result[0]["total"] if total_result else 0
    
    return {"messages": result, "total": total}


@api_router.get("/student-portal/messages/sent")
async def get_student_messages_sent(
    course_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get sent messages for a student"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    # Get sent messages
    messages = await db.internal_mail.find(
        {"sender_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for msg in messages:
        # Get first recipient info
        first_recipient_id = msg["recipients"][0]["user_id"] if msg.get("recipients") else None
        recipient = await db.users.find_one({"id": first_recipient_id}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}) if first_recipient_id else None
        
        result.append({
            "id": msg["id"],
            "subject": msg["subject"],
            "body": msg["body"][:200] + "..." if len(msg.get("body", "")) > 200 else msg.get("body", ""),
            "recipient": {
                "id": recipient["id"] if recipient else first_recipient_id,
                "name": f"{recipient.get('name', '')} {recipient.get('last_name', '')}".strip() if recipient else "Usuario",
                "photo_url": recipient.get("photo_url") if recipient else None,
                "role": recipient.get("role") if recipient else None
            },
            "recipients_count": len(msg.get("recipients", [])),
            "created_at": msg["created_at"],
            "thread_id": msg.get("thread_id")
        })
    
    total = await db.internal_mail.count_documents({"sender_id": user["id"]})
    
    return {"messages": result, "total": total}


@api_router.get("/student-portal/messages/stats")
async def get_student_messages_stats(course_id: str, current_user = Depends(get_current_user)):
    """Get message stats for a student"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    subject_id = course_id
    
    # Build allowed IDs
    allowed_ids = [user["id"]]
    
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0, "teacher_id": 1})
    
    if assignment and assignment.get("teacher_id"):
        allowed_ids.append(assignment["teacher_id"])
    
    if seccion_id:
        classmates = await db.users.find({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "is_active": {"$ne": False}
        }, {"_id": 0, "id": 1}).to_list(100)
        allowed_ids.extend([c["id"] for c in classmates])
    
    owners = await db.users.find({
        "school_id": school_id,
        "role": {"$in": ["owner", "admin"]}
    }, {"_id": 0, "id": 1}).to_list(20)
    allowed_ids.extend([o["id"] for o in owners])
    
    allowed_ids = list(set(allowed_ids))
    
    # Unread count
    unread_pipeline = [
        {
            "$match": {
                "recipients": {
                    "$elemMatch": {
                        "user_id": user["id"],
                        "is_read": False,
                        "is_deleted": {"$ne": True},
                        "is_archived": {"$ne": True}
                    }
                },
                "sender_id": {"$in": allowed_ids}
            }
        },
        {"$count": "count"}
    ]
    unread_result = await db.internal_mail.aggregate(unread_pipeline).to_list(1)
    unread = unread_result[0]["count"] if unread_result else 0
    
    # Inbox count
    inbox_pipeline = [
        {
            "$match": {
                "recipients": {
                    "$elemMatch": {
                        "user_id": user["id"],
                        "is_deleted": {"$ne": True},
                        "is_archived": {"$ne": True}
                    }
                },
                "sender_id": {"$in": allowed_ids}
            }
        },
        {"$count": "count"}
    ]
    inbox_result = await db.internal_mail.aggregate(inbox_pipeline).to_list(1)
    inbox = inbox_result[0]["count"] if inbox_result else 0
    
    # Sent count
    sent = await db.internal_mail.count_documents({"sender_id": user["id"]})
    
    return {"unread": unread, "inbox": inbox, "sent": sent}


@api_router.post("/student-portal/messages/send")
async def send_student_message(data: InternalMailCreate, course_id: str, current_user = Depends(get_current_user)):
    """Send a message from student within course context"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Solo estudiantes pueden usar este endpoint")
    
    school_id = user.get("school_id")
    seccion_id = user.get("seccion_id")
    subject_id = course_id
    
    # Build allowed recipient IDs
    allowed_ids = set()
    
    # Teacher
    assignment = await db.academic_assignments.find_one({
        "school_id": school_id,
        "subject_id": subject_id,
        "section_id": seccion_id,
        "status": "activo"
    }, {"_id": 0, "teacher_id": 1})
    
    if assignment and assignment.get("teacher_id"):
        allowed_ids.add(assignment["teacher_id"])
    
    # Classmates
    if seccion_id:
        classmates = await db.users.find({
            "school_id": school_id,
            "seccion_id": seccion_id,
            "role": "student",
            "is_active": {"$ne": False}
        }, {"_id": 0, "id": 1}).to_list(100)
        for c in classmates:
            allowed_ids.add(c["id"])
    
    # Owners/Admins
    owners = await db.users.find({
        "school_id": school_id,
        "role": {"$in": ["owner", "admin"]}
    }, {"_id": 0, "id": 1}).to_list(20)
    for o in owners:
        allowed_ids.add(o["id"])
    
    # CRITICAL VALIDATION: Check all recipients are allowed
    for rid in data.recipient_ids:
        if rid not in allowed_ids:
            raise HTTPException(status_code=403, detail="No puedes enviar mensajes a usuarios fuera de tu asignatura")
    
    # Create recipient entries
    recipients = []
    for rid in data.recipient_ids:
        recipients.append({
            "user_id": rid,
            "is_read": False,
            "is_starred": False,
            "is_archived": False,
            "is_deleted": False
        })
    
    message_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())
    
    message = {
        "id": message_id,
        "thread_id": thread_id,
        "sender_id": user["id"],
        "subject": data.subject.strip(),
        "body": data.body,
        "recipients": recipients,
        "attachments": data.attachments or [],
        "school_id": school_id,
        "course_id": subject_id,  # Track course context
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_mail.insert_one(message)
    
    return {"id": message_id, "thread_id": thread_id, "message": "Mensaje enviado correctamente"}


@api_router.get("/student-portal/messages/{message_id}")
async def get_student_message_detail(message_id: str, current_user = Depends(get_current_user)):
    """Get message detail for student"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    msg = await db.internal_mail.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    # Check if user is sender or recipient
    is_sender = msg["sender_id"] == user["id"]
    recipient_entry = next((r for r in msg.get("recipients", []) if r["user_id"] == user["id"]), None)
    
    if not is_sender and not recipient_entry:
        raise HTTPException(status_code=403, detail="No tienes acceso a este mensaje")
    
    # Mark as read if recipient
    if recipient_entry and not recipient_entry.get("is_read"):
        await db.internal_mail.update_one(
            {"id": message_id, "recipients.user_id": user["id"]},
            {"$set": {"recipients.$.is_read": True}}
        )
    
    # Get sender info
    sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1})
    
    return {
        "id": msg["id"],
        "subject": msg["subject"],
        "body": msg["body"],
        "sender": {
            "id": sender["id"] if sender else msg["sender_id"],
            "name": f"{sender.get('name', '')} {sender.get('last_name', '')}".strip() if sender else "Usuario",
            "photo_url": sender.get("photo_url") if sender else None,
            "role": sender.get("role") if sender else None
        },
        "created_at": msg["created_at"],
        "thread_id": msg.get("thread_id"),
        "attachments": msg.get("attachments", [])
    }


@api_router.put("/student-portal/messages/{message_id}/read")
async def mark_student_message_read(message_id: str, current_user = Depends(get_current_user)):
    """Mark message as read"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    result = await db.internal_mail.update_one(
        {"id": message_id, "recipients.user_id": user["id"]},
        {"$set": {"recipients.$.is_read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    return {"message": "Marcado como leído"}

# ══════════════════════════════════════════════════════════════════════════════
# APP SETUP
# ══════════════════════════════════════════════════════════════════════════════


# CORS middleware - MUST be added before routers for proper handling
# Using allow_origin_regex to support all subdomains of edunet.pe
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://edunet.pe",
        "http://localhost:3000",
        "http://localhost:8001",
        "https://edunet-mensajeria.preview.emergentagent.com",
    ],
    allow_origin_regex=r"https://.*\.edunet\.pe|https://.*\.preview\.emergentagent\.com",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
