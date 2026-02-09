from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

def create_token(user_id: str, email: str, name: str, role: str, school_id: str = None, subdomain: str = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "role": role,
        "school_id": school_id,
        "subdomain": subdomain,
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
    """Extract subdomain from Host header"""
    if not host:
        return None
    
    # Remove port if present
    host = host.split(':')[0].lower()
    
    # Check if it's a subdomain of our base domain
    if host.endswith(f'.{BASE_DOMAIN}'):
        subdomain = host.replace(f'.{BASE_DOMAIN}', '')
        if subdomain and subdomain not in ['www', 'api', 'admin']:
            return subdomain
    
    # For development/preview environments
    # Handle patterns like: subdomain.school-portal-152.preview.emergentagent.com
    parts = host.split('.')
    if len(parts) > 1:
        # Check if first part looks like a school subdomain (not www, not the main app name)
        first_part = parts[0]
        if first_part not in ['www', 'api', 'admin', 'school-portal-152'] and len(first_part) >= 3:
            # Verify it's actually a registered subdomain in DB (will be done in the route)
            return first_part
    
    return None

async def get_school_by_subdomain(subdomain: str):
    """Get school document by subdomain"""
    if not subdomain:
        return None
    return await db.schools.find_one({"subdomain": subdomain, "status": "active"}, {"_id": 0})

async def get_tenant_context(request: Request):
    """Extract tenant context from request"""
    host = request.headers.get('host', '')
    subdomain = extract_subdomain(host)
    
    if subdomain:
        school = await get_school_by_subdomain(subdomain)
        if school:
            return {"subdomain": subdomain, "school": school}
    
    return {"subdomain": None, "school": None}

# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    avatar: Optional[str] = None
    school_id: Optional[str] = None
    subdomain: Optional[str] = None
    onboarding_complete: bool = False

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

# ── School Registration Models (Simplified) ──

class SchoolRegister(BaseModel):
    school_name: str
    email: str
    password: str

class VerifyEmailRequest(BaseModel):
    email: str
    code: str

class CreateSubdomainRequest(BaseModel):
    subdomain: str

class CheckSubdomainResponse(BaseModel):
    available: bool
    subdomain: str = ""
    reason: str = ""

# ══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/auth/login")
async def login(creds: UserLogin):
    user = await db.users.find_one({"email": creds.email})
    if not user or not verify_password(creds.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Get school info for subdomain
    school = await db.schools.find_one({"id": user.get("school_id")}, {"_id": 0})
    subdomain = school.get("subdomain") if school else None
    
    token = create_token(
        user["id"], 
        user["email"], 
        user["name"], 
        user["role"],
        user.get("school_id"),
        subdomain
    )
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "avatar": user.get("avatar", ""),
            "school_id": user.get("school_id"),
            "subdomain": subdomain,
            "onboarding_complete": user.get("onboarding_complete", False)
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Get school info
    school = await db.schools.find_one({"id": user.get("school_id")}, {"_id": 0})
    subdomain = school.get("subdomain") if school else None
    
    return {
        **user,
        "subdomain": subdomain,
        "onboarding_complete": user.get("onboarding_complete", False)
    }

# ══════════════════════════════════════════════════════════════════════════════
# SCHOOL REGISTRATION ROUTES (SIMPLIFIED)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/schools/register")
async def register_school(data: SchoolRegister):
    """
    Step 1: Simple registration with school_name, email, password
    """
    existing = await db.schools.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Este correo ya está registrado")

    school_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    verification_code = str(uuid.uuid4())[:6].upper()

    # Create school record
    school_doc = {
        "id": school_id,
        "school_name": data.school_name,
        "email": data.email,
        "password": hash_password(data.password),
        "email_verified": False,
        "verification_code": verification_code,
        "onboarding_complete": False,
        "subdomain": None,
        "full_domain": None,
        "status": "pending",  # pending -> active when subdomain is created
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.schools.insert_one(school_doc)

    # Create user record linked to school
    user_doc = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.school_name,  # Use school name as user name initially
        "role": "Administrador",
        "school_id": school_id,
        "avatar": "",
        "email_verified": False,
        "onboarding_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    logger.info(f"School registered: {data.school_name}, verification code: {verification_code}")

    return {
        "message": "Cuenta creada exitosamente",
        "school_id": school_id,
        "verification_code": verification_code,
        "email": data.email
    }

@api_router.post("/schools/verify-email")
async def verify_email(data: VerifyEmailRequest):
    """
    Step 2: Verify email with code
    Returns token but user MUST complete onboarding before accessing dashboard
    """
    school = await db.schools.find_one({"email": data.email})
    if not school:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    if school["verification_code"] != data.code.upper():
        raise HTTPException(status_code=400, detail="Código de verificación incorrecto")

    # Mark as verified
    await db.schools.update_one(
        {"email": data.email}, 
        {"$set": {"email_verified": True}}
    )
    await db.users.update_one(
        {"email": data.email}, 
        {"$set": {"email_verified": True}}
    )

    user = await db.users.find_one({"email": data.email}, {"_id": 0, "password": 0})
    token = create_token(
        user["id"], 
        user["email"], 
        user["name"], 
        user["role"],
        user.get("school_id"),
        None  # No subdomain yet
    )

    return {
        "message": "Email verificado correctamente",
        "verified": True,
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "avatar": user.get("avatar", ""),
            "school_id": user.get("school_id"),
            "subdomain": None,
            "onboarding_complete": False
        }
    }

@api_router.get("/schools/check-subdomain/{subdomain}")
async def check_subdomain(subdomain: str) -> CheckSubdomainResponse:
    """
    Check if subdomain is available (validates against DB, not DNS)
    """
    subdomain = subdomain.lower().strip()
    
    # Validate format: only lowercase letters and numbers
    if not re.match(r'^[a-z0-9]+$', subdomain):
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="Solo letras minúsculas y números, sin espacios ni caracteres especiales"
        )
    
    # Minimum length
    if len(subdomain) < 3:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="El subdominio debe tener al menos 3 caracteres"
        )
    
    # Maximum length
    if len(subdomain) > 30:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="El subdominio debe tener máximo 30 caracteres"
        )

    # Reserved subdomains
    reserved = ["admin", "www", "api", "app", "mail", "support", "help", "edunet", 
                "test", "demo", "staging", "dev", "ftp", "smtp", "imap", "pop"]
    if subdomain in reserved:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="Este subdominio está reservado"
        )

    # Check database for existing subdomain
    existing = await db.schools.find_one({"subdomain": subdomain})
    if existing:
        return CheckSubdomainResponse(
            available=False, 
            subdomain=subdomain,
            reason="Este subdominio ya está en uso"
        )

    return CheckSubdomainResponse(
        available=True, 
        subdomain=subdomain,
        reason="Disponible"
    )

@api_router.post("/schools/create-subdomain")
async def create_subdomain(data: CreateSubdomainRequest, current_user=Depends(get_current_user)):
    """
    Step 3: Create subdomain (REQUIRED before accessing dashboard)
    """
    subdomain = data.subdomain.lower().strip()
    
    # Validate format
    if not re.match(r'^[a-z0-9]+$', subdomain):
        raise HTTPException(status_code=400, detail="Formato de subdominio inválido")
    
    if len(subdomain) < 3:
        raise HTTPException(status_code=400, detail="El subdominio debe tener al menos 3 caracteres")

    # Check availability one more time
    existing = await db.schools.find_one({"subdomain": subdomain})
    if existing:
        raise HTTPException(status_code=400, detail="Este subdominio ya está en uso")

    full_domain = f"{subdomain}.{BASE_DOMAIN}"

    # Update school with subdomain
    await db.schools.update_one(
        {"email": current_user["email"]},
        {"$set": {
            "subdomain": subdomain,
            "full_domain": full_domain,
            "status": "active",
            "onboarding_complete": True,
            "activated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Update user
    await db.users.update_one(
        {"email": current_user["email"]},
        {"$set": {"onboarding_complete": True}}
    )

    # Create new token with subdomain
    user = await db.users.find_one({"email": current_user["email"]}, {"_id": 0, "password": 0})
    new_token = create_token(
        user["id"],
        user["email"],
        user["name"],
        user["role"],
        user.get("school_id"),
        subdomain
    )

    logger.info(f"Subdomain created: {subdomain}.{BASE_DOMAIN} for school {current_user['email']}")

    return {
        "message": "Subdominio creado exitosamente",
        "subdomain": subdomain,
        "full_domain": full_domain,
        "redirect_url": f"https://{full_domain}",
        "token": new_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "avatar": user.get("avatar", ""),
            "school_id": user.get("school_id"),
            "subdomain": subdomain,
            "onboarding_complete": True
        }
    }

# ══════════════════════════════════════════════════════════════════════════════
# TENANT INFO ROUTE
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/tenant/info")
async def get_tenant_info(request: Request):
    """
    Get current tenant info based on Host header
    Used by frontend to determine which school's intranet to display
    """
    host = request.headers.get('host', '')
    subdomain = extract_subdomain(host)
    
    if not subdomain:
        return {
            "is_main_domain": True,
            "subdomain": None,
            "school": None
        }
    
    school = await db.schools.find_one(
        {"subdomain": subdomain, "status": "active"},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    
    if not school:
        return {
            "is_main_domain": False,
            "subdomain": subdomain,
            "school": None,
            "error": "Colegio no encontrado"
        }
    
    return {
        "is_main_domain": False,
        "subdomain": subdomain,
        "school": {
            "id": school["id"],
            "school_name": school["school_name"],
            "subdomain": school["subdomain"],
            "full_domain": school["full_domain"],
            "status": school["status"]
        }
    }

# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD ROUTES (TENANT-AWARE)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/dashboard/metrics", response_model=MetricResponse)
async def get_metrics(request: Request, current_user=Depends(get_current_user)):
    """Get metrics for current tenant"""
    school_id = current_user.get("school_id")
    
    # Try to get school-specific metrics first
    if school_id:
        metrics = await db.metrics.find_one({"school_id": school_id}, {"_id": 0})
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
async def get_events(request: Request, current_user=Depends(get_current_user)):
    """Get events for current tenant"""
    school_id = current_user.get("school_id")
    
    query = {"school_id": school_id} if school_id else {}
    events = await db.events.find(query, {"_id": 0}).sort("date", 1).to_list(20)
    
    # If no school-specific events, return default events
    if not events:
        events = await db.events.find({}, {"_id": 0}).sort("date", 1).to_list(20)
    
    return events

@api_router.get("/dashboard/enrollment", response_model=List[EnrollmentData])
async def get_enrollment(request: Request, current_user=Depends(get_current_user)):
    """Get enrollment data for current tenant"""
    school_id = current_user.get("school_id")
    
    query = {"school_id": school_id} if school_id else {}
    data = await db.enrollment.find(query, {"_id": 0}).to_list(100)
    
    # If no school-specific data, return default
    if not data:
        data = await db.enrollment.find({}, {"_id": 0}).to_list(100)
    
    return data

@api_router.get("/dashboard/school")
async def get_school_info(current_user=Depends(get_current_user)):
    """Get current user's school info"""
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=404, detail="No school associated")
    
    school = await db.schools.find_one(
        {"id": school_id},
        {"_id": 0, "password": 0, "verification_code": 0}
    )
    
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    return school

# ══════════════════════════════════════════════════════════════════════════════
# SEED DATA
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/seed")
async def seed_data():
    """Seed initial data for demo"""
    
    # Seed default events (global)
    await db.events.delete_many({"school_id": {"$exists": False}})
    events = [
        {"id": str(uuid.uuid4()), "title": "Reunión de Padres - 1ero Primaria", "date": "2026-02-18", "time": "09:00 AM", "category": "reunion", "color": "#001f4b"},
        {"id": str(uuid.uuid4()), "title": "Examen Trimestral - Matemáticas", "date": "2026-02-22", "time": "10:00 AM", "category": "examen", "color": "#e1b82c"},
        {"id": str(uuid.uuid4()), "title": "Feria de Ciencias", "date": "2026-02-25", "time": "02:00 PM", "category": "evento", "color": "#5c85d6"},
        {"id": str(uuid.uuid4()), "title": "Entrega de Boletines", "date": "2026-03-01", "time": "08:00 AM", "category": "academico", "color": "#10b981"},
        {"id": str(uuid.uuid4()), "title": "Día del Deporte", "date": "2026-03-05", "time": "07:30 AM", "category": "evento", "color": "#f59e0b"},
    ]
    await db.events.insert_many(events)

    # Seed default enrollment data (global)
    await db.enrollment.delete_many({"school_id": {"$exists": False}})
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

    return {"message": "Datos iniciales creados correctamente"}

@api_router.get("/")
async def root():
    return {"message": "EduNet SaaS API", "version": "2.0", "base_domain": BASE_DOMAIN}

# ══════════════════════════════════════════════════════════════════════════════
# APP SETUP
# ══════════════════════════════════════════════════════════════════════════════

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],  # Allow all origins for subdomain support
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
