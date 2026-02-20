"""
Backend utilities package
"""
from .config import (
    db, client, 
    JWT_SECRET, JWT_ALGORITHM, BASE_DOMAIN, BASE_URL,
    RESERVED_SUBDOMAINS, ROLE_HIERARCHY, ADMIN_ROLES, STAFF_ROLES
)

from .auth import (
    require_auth, hash_password, verify_password, create_token,
    get_current_user, is_admin_user, has_role, is_student, is_parent,
    is_staff, is_admin, is_admin_only, is_teacher, can_access_school,
    require_admin, require_staff, security
)

__all__ = [
    # Config
    'db', 'client', 'JWT_SECRET', 'JWT_ALGORITHM', 'BASE_DOMAIN', 'BASE_URL',
    'RESERVED_SUBDOMAINS', 'ROLE_HIERARCHY', 'ADMIN_ROLES', 'STAFF_ROLES',
    # Auth
    'require_auth', 'hash_password', 'verify_password', 'create_token',
    'get_current_user', 'is_admin_user', 'has_role', 'is_student', 'is_parent',
    'is_staff', 'is_admin', 'is_admin_only', 'is_teacher', 'can_access_school',
    'require_admin', 'require_staff', 'security'
]
