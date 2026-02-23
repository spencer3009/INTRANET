# Routes package for EduNet API
# This module contains all API route handlers organized by domain

from .auth import router as auth_router

__all__ = [
    "auth_router"
]
