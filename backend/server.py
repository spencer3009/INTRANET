from fastapi import FastAPI, APIRouter, HTTPException, Depends
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

JWT_SECRET = os.environ.get('JWT_SECRET', 'colegio-el-roble-secret-key-2026')
JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="No autorizado")
    return credentials

# ── Models ──

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "admin"

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

# ── School Registration Models ──

class SchoolRegister(BaseModel):
    school_name: str
    contact_name: str
    role: str
    email: str
    password: str
    phone: Optional[str] = None

class VerifyEmailRequest(BaseModel):
    email: str
    code: str

class OnboardingRequest(BaseModel):
    subdomain: str
    school_name: Optional[str] = None

# ── Auth helpers ──

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, name: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400
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

# ── Auth Routes ──

@api_router.post("/auth/register")
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": user.email,
        "password": hash_password(user.password),
        "name": user.name,
        "role": user.role,
        "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(doc)
    token = create_token(user_id, user.email, user.name, user.role)
    return {"token": token, "user": {"id": user_id, "email": user.email, "name": user.name, "role": user.role, "avatar": doc["avatar"]}}

@api_router.post("/auth/login")
async def login(creds: UserLogin):
    user = await db.users.find_one({"email": creds.email})
    if not user or not verify_password(creds.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    token = create_token(user["id"], user["email"], user["name"], user["role"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "avatar": user.get("avatar", "")}}

@api_router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user

# ── Dashboard Routes ──

@api_router.get("/dashboard/metrics", response_model=MetricResponse)
async def get_metrics(current_user=Depends(get_current_user)):
    metrics = await db.metrics.find_one({}, {"_id": 0})
    if not metrics:
        return MetricResponse(exams_projected=86, tasks_delivered=75, avg_students=456, unread_messages=12)
    return metrics

@api_router.get("/dashboard/events", response_model=List[EventResponse])
async def get_events(current_user=Depends(get_current_user)):
    events = await db.events.find({}, {"_id": 0}).sort("date", 1).to_list(20)
    return events

@api_router.get("/dashboard/enrollment", response_model=List[EnrollmentData])
async def get_enrollment(current_user=Depends(get_current_user)):
    data = await db.enrollment.find({}, {"_id": 0}).to_list(100)
    return data

# ── School Registration Routes ──

@api_router.post("/schools/register")
async def register_school(data: SchoolRegister):
    existing = await db.schools.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Este correo ya está registrado")

    school_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    verification_code = str(uuid.uuid4())[:6].upper()

    school_doc = {
        "id": school_id,
        "school_name": data.school_name,
        "contact_name": data.contact_name,
        "role": data.role,
        "email": data.email,
        "phone": data.phone,
        "password": hash_password(data.password),
        "email_verified": False,
        "verification_code": verification_code,
        "onboarding_complete": False,
        "subdomain": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.schools.insert_one(school_doc)

    # Also create user record for login
    user_doc = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.contact_name,
        "role": data.role,
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
    school = await db.schools.find_one({"email": data.email})
    if not school:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    if school.get("email_verified"):
        return {"message": "Email ya verificado", "verified": True}

    if school["verification_code"] != data.code.upper():
        raise HTTPException(status_code=400, detail="Código de verificación incorrecto")

    await db.schools.update_one({"email": data.email}, {"$set": {"email_verified": True}})
    await db.users.update_one({"email": data.email}, {"$set": {"email_verified": True}})

    user = await db.users.find_one({"email": data.email}, {"_id": 0, "password": 0})
    token = create_token(user["id"], user["email"], user["name"], user["role"])

    return {
        "message": "Email verificado correctamente",
        "verified": True,
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "avatar": user.get("avatar", "")}
    }

@api_router.get("/schools/check-subdomain/{subdomain}")
async def check_subdomain(subdomain: str):
    subdomain = subdomain.lower().strip()
    if len(subdomain) < 3:
        return {"available": False, "reason": "El subdominio debe tener al menos 3 caracteres"}
    if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', subdomain) and len(subdomain) >= 3:
        if not re.match(r'^[a-z0-9]+$', subdomain):
            return {"available": False, "reason": "Solo letras minúsculas, números y guiones"}

    reserved = ["admin", "www", "api", "app", "mail", "support", "help", "edunet"]
    if subdomain in reserved:
        return {"available": False, "reason": "Este subdominio está reservado"}

    existing = await db.schools.find_one({"subdomain": subdomain})
    if existing:
        return {"available": False, "reason": "Este subdominio ya está en uso"}

    return {"available": True, "subdomain": subdomain}

@api_router.post("/schools/onboarding")
async def complete_onboarding(data: OnboardingRequest, current_user=Depends(get_current_user)):
    subdomain = data.subdomain.lower().strip()

    existing = await db.schools.find_one({"subdomain": subdomain})
    if existing:
        raise HTTPException(status_code=400, detail="Subdominio no disponible")

    update_data = {"subdomain": subdomain, "onboarding_complete": True}
    if data.school_name:
        update_data["school_name"] = data.school_name

    await db.schools.update_one({"email": current_user["email"]}, {"$set": update_data})
    await db.users.update_one({"email": current_user["email"]}, {"$set": {"onboarding_complete": True}})

    return {
        "message": "Intranet creada exitosamente",
        "subdomain": subdomain,
        "url": f"{subdomain}.edunet.pe"
    }

# ── Seed Data ──

@api_router.post("/seed")
async def seed_data():
    # Seed admin user
    existing = await db.users.find_one({"email": "admin@elroble.edu"})
    if not existing:
        admin = {
            "id": str(uuid.uuid4()),
            "email": "admin@elroble.edu",
            "password": hash_password("admin123"),
            "name": "Ana García",
            "role": "Administradora",
            "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)

    # Seed metrics
    await db.metrics.delete_many({})
    await db.metrics.insert_one({
        "exams_projected": 86,
        "tasks_delivered": 75,
        "avg_students": 456,
        "unread_messages": 12
    })

    # Seed events
    await db.events.delete_many({})
    events = [
        {"id": str(uuid.uuid4()), "title": "Reunión de Padres - 1ero Primaria", "date": "2026-02-18", "time": "09:00 AM", "category": "reunion", "color": "#001f4b"},
        {"id": str(uuid.uuid4()), "title": "Examen Trimestral - Matemáticas", "date": "2026-02-22", "time": "10:00 AM", "category": "examen", "color": "#e1b82c"},
        {"id": str(uuid.uuid4()), "title": "Feria de Ciencias", "date": "2026-02-25", "time": "02:00 PM", "category": "evento", "color": "#5c85d6"},
        {"id": str(uuid.uuid4()), "title": "Entrega de Boletines", "date": "2026-03-01", "time": "08:00 AM", "category": "academico", "color": "#10b981"},
        {"id": str(uuid.uuid4()), "title": "Día del Deporte", "date": "2026-03-05", "time": "07:30 AM", "category": "evento", "color": "#f59e0b"},
    ]
    await db.events.insert_many(events)

    # Seed enrollment data
    await db.enrollment.delete_many({})
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
    return {"message": "Colegio El Roble API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
