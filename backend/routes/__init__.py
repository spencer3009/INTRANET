# Routes package for EduNet API
# This module contains all API route handlers organized by domain

from .support import router as support_router

__all__ = [
    "support_router"
]
