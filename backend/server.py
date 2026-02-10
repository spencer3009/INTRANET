from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
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
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
import re
import time
import cloudinary
import cloudinary.utils
import cloudinary.uploader

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

class UserLogin(BaseModel):
    email: str
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
    """
    user = await db.users.find_one({"email": creds.email.lower()})
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
            "name": user["name"],
            "role": user["role"],
            "school_id": school_id,
            "subdomain": subdomain,
            "email_verified": user.get("email_verified", False)
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
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"School updated with subdomain: {subdomain}.{BASE_DOMAIN} for user {user['email']}")
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
        
        # Update user with school_id only if they didn't have one
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "school_id": school_id,
                "role": "owner",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"School created: {subdomain}.{BASE_DOMAIN} for user {user['email']}")

    # Create new token with school info
    new_token = create_token(
        user["id"], user["email"], user["name"], "owner",
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
            "role": "owner",
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

@api_router.get("/dashboard/metrics", response_model=MetricResponse)
async def get_metrics(current_user=Depends(require_school)):
    """Get metrics for current tenant - REQUIRES SCHOOL"""
    school_id = current_user.get("school_id")
    
    # Try to get school-specific metrics
    metrics = await db.metrics.find_one({"tenant_id": school_id}, {"_id": 0})
    if metrics:
        return metrics
    
    # Return default metrics
    return MetricResponse(
        exams_projected=86, 
        tasks_delivered=75, 
        avg_students=456, 
        unread_messages=12
    )

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
    resource_type: str = Query("image", enum=["image", "video"]),
    folder: str = Query("edunet/logos"),
    current_user = Depends(get_current_user)
):
    """
    Generate a signed upload signature for Cloudinary.
    Requires authentication.
    """
    ALLOWED_FOLDERS = ("edunet/logos", "edunet/uploads", "edunet/media", "edunet/users", "edunet/academic")
    if not any(folder.startswith(f) for f in ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Carpeta no permitida")

    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
    }

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
    if user.get("role") not in ["owner", "admin"]:
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
    Only admins/owners can view users.
    """
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check role - only owner or admin can view users
    if user.get("role") not in ["owner", "admin"]:
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
    
    # Check role
    if user.get("role") not in ["owner", "admin"]:
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
    if user.get("role") not in ["owner", "admin"]:
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

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user = Depends(get_current_user)):
    """Delete a user and their Cloudinary image"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar usuarios")
    
    # Cannot delete yourself
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    
    # Find target user
    target = await db.users.find_one({"id": user_id, "school_id": user["school_id"]})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Cannot delete owners
    if target.get("role") == "owner":
        raise HTTPException(status_code=400, detail="No puedes eliminar al propietario")
    
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    if user.get("role") not in ["owner", "admin"]:
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
# ACADEMIC SETTINGS - SECCIONES
# ══════════════════════════════════════════════════════════════════════════════

class SectionCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=50)
    grado_id: str
    capacidad_maxima: Optional[int] = None
    activo: bool = True

class SectionUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=50)
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
    
    query = {"school_id": user["school_id"]}
    if grado_id:
        query["grado_id"] = grado_id
    if activo is not None:
        query["activo"] = activo
    
    # If filtering by nivel_id, first get all grades of that level
    if nivel_id:
        grades_in_level = await db.grades.find(
            {"school_id": user["school_id"], "nivel_id": nivel_id},
            {"id": 1}
        ).to_list(100)
        grade_ids = [g["id"] for g in grades_in_level]
        query["grado_id"] = {"$in": grade_ids}
    
    sections = await db.sections.find(query, {"_id": 0}).sort("nombre", 1).to_list(500)
    
    # Add grade and level info for each section
    grades_cache = {}
    levels_cache = {}
    for section in sections:
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
    
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear secciones")
    
    # Verify grade exists
    grade = await db.grades.find_one({
        "id": data.grado_id,
        "school_id": user["school_id"]
    })
    if not grade:
        raise HTTPException(status_code=400, detail="El grado no existe")
    
    # Check for duplicate name within the same grade
    existing = await db.sections.find_one({
        "school_id": user["school_id"],
        "grado_id": data.grado_id,
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una sección con ese nombre en este grado")
    
    section = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "nombre": data.nombre,
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
    
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar secciones")
    
    # Find the section
    section = await db.sections.find_one({
        "id": section_id,
        "school_id": user["school_id"]
    })
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    
    # If changing grade, verify new grade exists
    new_grado_id = data.grado_id if data.grado_id else section["grado_id"]
    if data.grado_id and data.grado_id != section["grado_id"]:
        grade = await db.grades.find_one({
            "id": data.grado_id,
            "school_id": user["school_id"]
        })
        if not grade:
            raise HTTPException(status_code=400, detail="El grado no existe")
    
    # Check for duplicate name within the same grade
    if data.nombre and (data.nombre.lower() != section["nombre"].lower() or new_grado_id != section["grado_id"]):
        existing = await db.sections.find_one({
            "school_id": user["school_id"],
            "grado_id": new_grado_id,
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": section_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe una sección con ese nombre en este grado")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    if user.get("role") not in ["owner", "admin"]:
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

class AcademicPeriodCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    fecha_inicio: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    fecha_fin: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    activo: bool = False

class AcademicPeriodUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    fecha_inicio: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    fecha_fin: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    activo: Optional[bool] = None

@api_router.get("/academic/periods")
async def get_academic_periods(
    activo: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """Get all academic periods for the current tenant, sorted by start date (descending)"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    query = {"school_id": user["school_id"]}
    if activo is not None:
        query["activo"] = activo
    
    periods = await db.academic_periods.find(query, {"_id": 0}).sort("fecha_inicio", -1).to_list(100)
    
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
    """Create a new academic period"""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear períodos")
    
    # Validate date range
    if data.fecha_inicio >= data.fecha_fin:
        raise HTTPException(status_code=400, detail="La fecha de inicio debe ser anterior a la fecha de fin")
    
    # Check for duplicate name
    existing = await db.academic_periods.find_one({
        "school_id": user["school_id"],
        "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un período con ese nombre")
    
    # Check for overlapping dates
    overlapping = await db.academic_periods.find_one({
        "school_id": user["school_id"],
        "$or": [
            # New period starts during existing period
            {"fecha_inicio": {"$lte": data.fecha_inicio}, "fecha_fin": {"$gte": data.fecha_inicio}},
            # New period ends during existing period
            {"fecha_inicio": {"$lte": data.fecha_fin}, "fecha_fin": {"$gte": data.fecha_fin}},
            # New period encompasses existing period
            {"fecha_inicio": {"$gte": data.fecha_inicio}, "fecha_fin": {"$lte": data.fecha_fin}}
        ]
    })
    if overlapping:
        raise HTTPException(
            status_code=400, 
            detail=f"Las fechas se solapan con el período '{overlapping['nombre']}' ({overlapping['fecha_inicio']} - {overlapping['fecha_fin']})"
        )
    
    deactivated_period = None
    # If setting as active, deactivate any currently active period
    if data.activo:
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
    
    period = {
        "id": str(uuid.uuid4()),
        "school_id": user["school_id"],
        "nombre": data.nombre,
        "fecha_inicio": data.fecha_inicio,
        "fecha_fin": data.fecha_fin,
        "activo": data.activo,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.academic_periods.insert_one(period)
    period.pop("_id", None)
    
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    # Check for duplicate name if name is being changed
    if data.nombre and data.nombre.lower() != period["nombre"].lower():
        existing = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "nombre": {"$regex": f"^{re.escape(data.nombre)}$", "$options": "i"},
            "id": {"$ne": period_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un período con ese nombre")
    
    # Check for overlapping dates if dates are being changed
    if data.fecha_inicio or data.fecha_fin:
        overlapping = await db.academic_periods.find_one({
            "school_id": user["school_id"],
            "id": {"$ne": period_id},
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
    
    if user.get("role") not in ["owner", "admin"]:
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
    
    if user.get("role") not in ["owner", "admin"]:
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

# ══════════════════════════════════════════════════════════════════════════════
# APP SETUP
# ══════════════════════════════════════════════════════════════════════════════

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
