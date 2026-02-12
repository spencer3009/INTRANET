from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
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
    ALLOWED_FOLDERS = ("edunet/logos", "edunet/uploads", "edunet/media", "edunet/users", "edunet/academic", "edunet/banners", "edunet/news", "edunet/messages", "edunet/discipline", "edunet/subjects", "edunet/posts")
    if not any(folder.startswith(f) for f in ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Carpeta no permitida")

    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
    }
    
    # For raw files (PDF, DOC, etc.), add access_control to make them public
    if resource_type == "raw":
        params["access_mode"] = "public"

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
        "resource_type": resource_type,
        "access_mode": "public" if resource_type == "raw" else None
    }

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
    # Academic fields for students
    nivel_id: Optional[str] = None
    grado_id: Optional[str] = None
    seccion_id: Optional[str] = None
    turno_id: Optional[str] = None
    padre_id: Optional[str] = None
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
    
    return result

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

class CoursePostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None

class PostCommentCreate(BaseModel):
    content: str

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
    
    # Build query filter
    query_filter = {"subject_id": subject_id, "school_id": school_id, "status": "active"}
    
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
    
    # Validate: must have content or attachment
    if not data.content.strip() and not data.image_url and not data.file_url:
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
        "status": "active",
        "created_at": now,
        "updated_at": now
    }
    
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
        reference_id=post_id,
        reference_type="post"
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
    
    await db.course_posts.update_one({"id": post_id}, {"$set": update_data})
    
    return {"message": "Publicación actualizada"}

@api_router.delete("/course/posts/{post_id}")
async def delete_course_post(
    post_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a post (soft delete) and remove associated media from Cloudinary"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Usuario no encontrado")
    
    post = await db.course_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    # Only author or admin can delete
    if post["author_id"] != user["id"] and user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta publicación")
    
    # Delete image from Cloudinary if exists
    if post.get("image_url") and "cloudinary.com" in post["image_url"]:
        try:
            # Extract public_id from URL
            # URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{folder}/{filename}.{ext}
            url_parts = post["image_url"].split("/upload/")
            if len(url_parts) > 1:
                path_with_version = url_parts[1]
                # Remove version prefix (v1234567890/)
                if path_with_version.startswith("v"):
                    path_parts = path_with_version.split("/", 1)
                    if len(path_parts) > 1:
                        public_id = path_parts[1].rsplit(".", 1)[0]  # Remove extension
                    else:
                        public_id = path_with_version.rsplit(".", 1)[0]
                else:
                    public_id = path_with_version.rsplit(".", 1)[0]
                
                cloudinary.uploader.destroy(public_id)
                print(f"Deleted image from Cloudinary: {public_id}")
        except Exception as e:
            print(f"Error deleting image from Cloudinary: {e}")
    
    # Delete file from Cloudinary if exists
    if post.get("file_url") and "cloudinary.com" in post["file_url"]:
        try:
            url_parts = post["file_url"].split("/upload/")
            if len(url_parts) > 1:
                path_with_version = url_parts[1]
                if path_with_version.startswith("v"):
                    path_parts = path_with_version.split("/", 1)
                    if len(path_parts) > 1:
                        public_id = path_parts[1].rsplit(".", 1)[0]
                    else:
                        public_id = path_with_version.rsplit(".", 1)[0]
                else:
                    public_id = path_with_version.rsplit(".", 1)[0]
                
                # For raw files (PDF, DOC, etc.) use resource_type="raw"
                resource_type = "raw" if post.get("file_type") and not post["file_type"].startswith("image/") else "image"
                cloudinary.uploader.destroy(public_id, resource_type=resource_type)
                print(f"Deleted file from Cloudinary: {public_id}")
        except Exception as e:
            print(f"Error deleting file from Cloudinary: {e}")
    
    await db.course_posts.update_one(
        {"id": post_id},
        {"$set": {"status": "deleted", "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Publicación eliminada"}

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
    """Get all comments for a post"""
    # Check if post exists
    post = await db.course_posts.find_one({"id": post_id, "status": "active"})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    comments = await db.post_comments.find(
        {"post_id": post_id, "status": "active"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Enrich with author info
    for comment in comments:
        author = await db.users.find_one(
            {"id": comment.get("author_id")},
            {"_id": 0, "id": 1, "name": 1, "last_name": 1, "photo_url": 1, "role": 1}
        )
        comment["author"] = author
    
    return comments

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
    ],
    allow_origin_regex=r"https://.*\.edunet\.pe",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
