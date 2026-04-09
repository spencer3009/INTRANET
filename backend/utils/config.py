"""
Database configuration and connection
"""
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'edunet-saas-secret-key-2026-dev-only')
JWT_ALGORITHM = "HS256"
BASE_DOMAIN = os.environ.get('BASE_DOMAIN', 'edunet.pe')
BASE_URL = os.environ.get("BASE_URL", "https://edunet.pe")

# Reserved subdomains
RESERVED_SUBDOMAINS = [
    "www", "admin", "api", "app", "mail", "support", "help", 
    "dashboard", "edunet", "test", "demo", "staging", "dev", 
    "ftp", "smtp", "imap", "pop", "cdn", "static", "assets",
    "billing", "payment", "account", "login", "register"
]

# Role hierarchy (higher = more permissions)
ROLE_HIERARCHY = {
    "owner": 100,
    "admin": 90,
    "director": 80,
    "coordinator": 70,
    "teacher": 50,
    "auxiliar": 40,
    "auxiliar_asistencia": 38,
    "auxiliar_alimentacion": 35,
    "parent": 20,
    "student": 10
}

# Admin roles that can access administrative functions
ADMIN_ROLES = ["owner", "admin", "director", "coordinator"]

# Staff roles (non-students)
STAFF_ROLES = ["owner", "admin", "director", "coordinator", "teacher", "auxiliar", "auxiliar_asistencia", "auxiliar_alimentacion"]
