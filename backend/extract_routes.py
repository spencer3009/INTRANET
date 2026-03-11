#!/usr/bin/env python3
"""
Script to extract routes from monolithic server.py into domain-specific router files.
Reads server.py and generates router files in routes/ directory.
"""
import re
import os

# Read the entire server.py
with open('/app/backend/server.py', 'r') as f:
    all_lines = f.readlines()

def get_lines(start, end):
    """Get lines from server.py (1-indexed, inclusive)"""
    return ''.join(all_lines[start-1:end])

def replace_api_router(code):
    """Replace @api_router with @router"""
    return code.replace('@api_router.', '@router.')

# Define router file configurations
# Each entry: (filename, [(start, end), ...], import_extras, prefix_comment)
ROUTER_CONFIGS = [
    ("auth", [(798, 1595)], 
     ["RESERVED_SUBDOMAINS", "create_system_support_user", "seed_demo_data_for_school"],
     "Authentication, school creation, subdomain management"),
    
    ("dashboard", [(1596, 1871), (14058, 14212)],
     ["ACADEMIC_STUDENT_FILTER"],
     "Dashboard metrics, stats, banners"),
    
    ("student_portal", [(1872, 2655), (21173, 21700)],
     ["STUDENT_TASKS_CACHE", "STUDENT_DASHBOARD_CACHE", "ACADEMIC_STUDENT_FILTER", "PERU_TZ"],
     "Student portal endpoints"),
    
    ("teacher_portal", [(2656, 3497)],
     ["ACADEMIC_STUDENT_FILTER", "PERU_TZ"],
     "Teacher portal endpoints"),
    
    ("admin_portal", [(3498, 4464)],
     ["ACADEMIC_STUDENT_FILTER", "PERU_TZ"],
     "Admin portal - academic management"),
    
    ("system", [(4465, 4800)],
     ["create_system_support_user", "seed_demo_data_for_school", "delete_demo_data_for_school"],
     "System management, demo data, cloudinary, seeding"),
    
    ("settings", [(4801, 4977)],
     [],
     "Tenant settings management"),
    
    ("users", [(4978, 6113)],
     ["ACADEMIC_STUDENT_FILTER", "create_system_support_user"],
     "User CRUD, student import"),
    
    ("academic", [(6114, 8264), (14213, 14681)],
     ["ACADEMIC_STUDENT_FILTER"],
     "Academic structure: levels, grades, sections, shifts, years, periods, assignments"),
    
    ("schedule", [(8265, 8937)],
     [],
     "Schedule settings, breaks, entries, presence"),
    
    ("messages_legacy", [(8938, 9420)],
     ["ws_manager"],
     "Legacy messaging system"),
    
    ("attendance", [(9421, 10573)],
     ["ACADEMIC_STUDENT_FILTER", "PERU_TZ", "to_peru_hhmm"],
     "Attendance module: student, teacher, reports, entry/exit, QR"),
    
    ("calendar", [(10574, 10886)],
     [],
     "Calendar events module"),
    
    ("surveys", [(10887, 11291)],
     [],
     "Surveys module"),
    
    ("discipline", [(11292, 11699)],
     [],
     "Discipline reports module"),
    
    ("news", [(11700, 12146)],
     [],
     "News module"),
    
    ("accounting", [(12147, 13405)],
     [],
     "Accounting module: payments, expenses, debtors, concepts"),
    
    ("subjects", [(13406, 14057)],
     ["ACADEMIC_STUDENT_FILTER"],
     "Subjects (asignaturas) module"),
    
    ("courses", [(14682, 16470), (16471, 16773)],
     ["ws_manager", "invalidate_student_cache", "invalidate_course_caches", "ACADEMIC_STUDENT_FILTER"],
     "Course feed, posts, likes, comments, activity, reminders, notifications"),
    
    ("messaging", [(16774, 17751), (20285, 21172)],
     ["ws_manager"],
     "Message center, internal mail system"),
    
    ("broadcast", [(17752, 18014)],
     ["ws_manager"],
     "Broadcast (comunicado masivo) module"),
    
    ("exams", [(18015, 18932), (18933, 19599), (19600, 20284), (21701, 22247)],
     ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_DRIVE_SCOPES", 
      "GOOGLE_DRIVE_ALLOWED_EXTENSIONS", "MIME_TYPE_MAP", "encrypt_token", "decrypt_token",
      "ACADEMIC_STUDENT_FILTER", "PERU_TZ"],
     "Online exams, questions, attempts, Google Drive integration, exam schedules"),
    
    ("parent_portal", [(22248, 23525)],
     ["ACADEMIC_STUDENT_FILTER", "PERU_TZ", "to_peru_hhmm"],
     "Parent portal endpoints"),
    
    ("live_classes", [(23526, 23829)],
     ["ACADEMIC_STUDENT_FILTER"],
     "Live classes module"),
]

# Base imports that every router needs
BASE_IMPORTS = '''from fastapi import APIRouter, HTTPException, Depends, Query, Body, Form, UploadFile, File, BackgroundTasks, Request
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import re
import logging

from .core import (
    db, get_current_user, resolve_user_from_token, is_admin_user,
    require_role, require_admin, require_staff, require_section_access,
    is_demo_user, check_demo_user_block, require_not_demo, is_real_owner,
    is_system_user, check_system_user_block, is_protected_user,
    has_role, is_student, is_parent, is_staff,
    can_access_section, get_user_permissions,
    hash_password, verify_password, create_token,
    get_academic_filter,
    JWT_SECRET, JWT_ALGORITHM, now_iso, generate_id,
    ADMIN_ROLES, STAFF_ROLES, ROLE_HIERARCHY,
'''

# Extra imports mapping
EXTRA_IMPORT_MAP = {
    "RESERVED_SUBDOMAINS": "    RESERVED_SUBDOMAINS,",
    "create_system_support_user": "    create_system_support_user,",
    "seed_demo_data_for_school": "    seed_demo_data_for_school,",
    "delete_demo_data_for_school": "    delete_demo_data_for_school,",
    "ws_manager": "    ws_manager,",
    "invalidate_student_cache": "    invalidate_student_cache,",
    "invalidate_course_caches": "    invalidate_course_caches,",
    "STUDENT_TASKS_CACHE": "    STUDENT_TASKS_CACHE,",
    "STUDENT_DASHBOARD_CACHE": "    STUDENT_DASHBOARD_CACHE,",
    "ACADEMIC_STUDENT_FILTER": "    ACADEMIC_STUDENT_FILTER, ACADEMIC_STUDENT_FILTER_WITH_PENDING,",
    "PERU_TZ": "    PERU_TZ, to_peru_hhmm,",
    "to_peru_hhmm": "",  # Already included with PERU_TZ
    "GOOGLE_CLIENT_ID": "    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL,",
    "GOOGLE_CLIENT_SECRET": "",  # Already included
    "GOOGLE_DRIVE_SCOPES": "    GOOGLE_DRIVE_SCOPES, GOOGLE_DRIVE_ALLOWED_EXTENSIONS, MIME_TYPE_MAP,",
    "GOOGLE_DRIVE_ALLOWED_EXTENSIONS": "",
    "MIME_TYPE_MAP": "",
    "encrypt_token": "    encrypt_token, decrypt_token, fernet,",
    "decrypt_token": "",
}

os.makedirs('/app/backend/routes', exist_ok=True)

generated_files = []

for filename, line_ranges, extras, comment in ROUTER_CONFIGS:
    # Build imports
    imports = BASE_IMPORTS
    
    # Add extra imports (deduplicated)
    added = set()
    extra_lines = []
    for extra in extras:
        line = EXTRA_IMPORT_MAP.get(extra, "")
        if line and line not in added:
            added.add(line)
            extra_lines.append(line)
    
    if extra_lines:
        imports += '\n'.join(extra_lines) + '\n'
    
    imports += ')\n'
    
    # Collect code from all line ranges
    code_parts = []
    for start, end in line_ranges:
        code_parts.append(get_lines(start, end))
    
    code = '\n'.join(code_parts)
    
    # Replace @api_router with @router
    code = replace_api_router(code)
    
    # Build the file
    file_content = f'''"""
{comment}
Extracted from server.py during modularization.
"""
{imports}
import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

{code}
'''
    
    filepath = f'/app/backend/routes/{filename}.py'
    with open(filepath, 'w') as f:
        f.write(file_content)
    
    generated_files.append(filename)
    route_count = code.count('@router.')
    print(f"Created routes/{filename}.py ({route_count} routes)")

print(f"\nTotal: {len(generated_files)} router files created")
