# EduNet - School Management Platform PRD

## Original Problem Statement
Full-stack React + FastAPI + MongoDB school management platform for Peruvian schools. Features include academic structure management, attendance, grading, teacher assignments, accounting, messaging, and more.

## Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Hosting**: Emergent Platform (preview) / Production at edunet.pe

## What's Been Implemented

### Core Academic Structure
- Levels (INICIAL, PRIMARIA, SECUNDARIA), Grades, Sections, Section Types
- Academic Years with status management
- Subjects CRUD with section-level granularity
- Teacher Assignments to subjects/sections

### Authentication & Users
- JWT-based auth with school subdomains
- Roles: owner, admin, director, teacher, parent, student
- Custom login page with backgrounds (Cloudinary), WhatsApp support link
- Public registration blocked

### Attendance Module
- Flexible ID filtering (handles String + ObjectId mismatches)
- Production-ready with normalized IDs

### Accounting Module
- Income/Expenses tracking
- Morosos (debtors) inline tab with redesigned UI
- Financial settings with ON_CREATE student activation

### Teacher Assignments
- Full CRUD for teacher-subject-section assignments
- Cascade filter modal (Level > Grade > Section > Subject)
- Teachers summary sidebar

## Recently Completed (March 2026)

### Demo Access Photo/Logo Upload (March 31)
- 2 new endpoints: profile-photo and logo upload to Cloudinary (WebP, validated)
- Frontend AccessRow: clickable avatar/logo with hover overlay, loading state, immediate UI update
- GET accesses response includes profile_photo_url and logo_url

### Demo User 403 Fix + Debug Logging (March 31)
- Added explicit bypass in `require_section_access` and `require_role` for demo users with role=owner
- Added DEMO_DEBUG logging for production diagnostics
- Full frontend investigation: URLs correct, SW doesn't cache API, token flow OK
- DemoModeContext.jsx intercepts all 403s for demo users (masks real errors)

### Categories Menu Scroll Fix (March 31)
- Removed `max-h-[60vh] overflow-y-auto` from categories panel in AcademiaPortalPage.jsx
- Menu now grows dynamically based on category count without scrollbar

### Demo Management System (March 31)
- **Backend** (`routes/demo.py`): 7 endpoints - clone, delete, reclone, status, create access, list accesses, revoke access
- Clones 40 collections in dependency order with ID remapping (old_id -> new_id)
- Anonymization of students and parents (fictional names, demo emails)
- Temporary access with credentials + WhatsApp link
- Expiration validation in login (`auth.py`)
- Cron job every 24h for expired demo cleanup
- **Frontend** (`SupportDemosPage.jsx`): Demos section in Support Panel with full UI

### Student Card Level Name Fix (March 30)
- Fixed bug where student cards in grouped view showed wrong level name
- `renderStudentCard` now receives `levelName` as direct parameter

### ChatterPal Mobile Fix (March 30)
- Fix for avatar not visible on mobile when navigating via SPA
- Immediate unhide on mount + retries for mobile (10x every 500ms)

### Previous Sessions
- Subject level_id migration script + auto-derivation fix
- Password change endpoint fix
- Unified profile photo uploads across all portals
- Parent Profile page, ChatterPal integration, Landing Page SEO/UI
- FloatingHelpAvatar, Data injection, Morosos redesign, login customization

## Pending Issues

### P0: Demo User 403 in Production
- Backend returns 200 via curl, 403 only in browser
- Bypass added in core.py, debug logging added
- Needs production deploy + log verification
- Possible causes: old token in localStorage, manually created demo users missing is_owner

### P1: ChatterPal Mobile Verification
- Awaiting user confirmation in production environment

### P2: Orphan Collection Cleanup
- DELETE school leaves ~15 collections orphaned
- Awaiting user approval to implement

## Upcoming Tasks
- P1: Refactor Message Pages (consolidate duplicates)
- P2: Visual indicator of sync_status in Exams/Tasks
- P2: Gradebook: Export PDF/Excel, Lock/Close Period
- P2: Double scrollbar fix in "Registro Auxiliar"

## Future/Backlog
- Vinculacion Masiva Inteligente (Phase 2 Parent Import)
- Dashboard Owner with real data
- Matriculas (Enrollments) module
- Replace window.confirm/alert with custom modals

## Refactoring Needed
- UsersPage.jsx (>5000 lines) - split into sub-components
- core.py monolith - separate auth, RBAC, websockets

## Key Endpoints
- `POST /api/support/demo/clone` - Clone school for demo
- `POST /api/support/demo/access` - Create 5-day demo credentials
- `GET /api/settings` - Tenant settings (RBAC: owner)
- `POST /api/auth/login` - Login with email+password

## 3rd Party Integrations
- Cloudinary (image hosting) - Emergent managed keys
- ChatterPal v8.5 (video avatar widget) - External script, requires domain whitelisting (edunet.pe)
- Vimeo (video hosting) - External URL embed

## Test Credentials
- School: elroble
- Email: admin@elroble.edu
- Password: 1234abc8
- Support: spencer3009@gmail.com / Socios3009
