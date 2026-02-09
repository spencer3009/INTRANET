from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'edunet-saas-secret-key-2026')
JWT_ALGORITHM = "HS256"
BASE_DOMAIN = os.environ.get('BASE_DOMAIN', 'edunet.pe')

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
    
    # Get school info
    subdomain = None
    if user.get("school_id"):
        school = await db.schools.find_one({"id": user["school_id"]}, {"_id": 0})
        if school:
            subdomain = school.get("subdomain")
    
    return {
        **user,
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
      2. Create school record
      3. Update user.school_id
      4. Return redirect URL
    """
    # Check if user already has a school
    user = await db.users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("school_id"):
        # User already has a school, get its subdomain
        school = await db.schools.find_one({"id": user["school_id"]}, {"_id": 0})
        if school:
            return {
                "message": "Ya tienes un colegio creado",
                "subdomain": school["subdomain"],
                "full_domain": school["full_domain"],
                "redirect_url": f"https://{school['subdomain']}.{BASE_DOMAIN}"
            }
    
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

    school_id = str(uuid.uuid4())
    full_domain = f"{subdomain}.{BASE_DOMAIN}"

    # Create school record
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

    # Update user with school_id
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "school_id": school_id,
            "role": "owner",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Create new token with school info
    new_token = create_token(
        user["id"], user["email"], user["name"], "owner",
        school_id, subdomain, True
    )

    logger.info(f"School created: {subdomain}.{BASE_DOMAIN} for user {user['email']}")

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
