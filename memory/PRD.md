# EduNet - Academic Management System PRD

## Original Problem Statement
Build a comprehensive academic management system named "EduNet" with core academic features, administrative and billing functionalities for schools in Peru.

## User Language
Spanish (all communication must be in Spanish)

## Core Features Implemented
1. **Registro Auxiliar (Gradebook)** - Excel-like grade entry sheet
2. **Consolidado de Notas** - Pixel-perfect replica of school's official consolidated report
3. **Manual Membership Renewal** - Yape QR payment flow with support verification
4. **Multi-tenant Architecture** - Subdomain-based school isolation
5. **Role-Based Access** - Owner, Admin, Teacher, Student, Parent, Support roles
6. **Support Panel** - Global admin can manage all schools

## Architecture
- **Frontend:** React + Shadcn/UI + TailwindCSS
- **Backend:** FastAPI (Python)
- **Database:** MongoDB (Motor async driver)
- **Auth:** JWT-based
- **Domain:** edunet.pe with subdomain routing

## Key Technical Decisions
- **DB Auto-Discovery:** Production MongoDB uses different DB names than configured. Code auto-discovers the correct database at startup using pymongo sync client.
- **CORS:** Supports `*.edunet.pe`, `*.emergentagent.com`, `*.emergent.host`
- **Payment Modal:** Uses `createPortal(document.body)` to render above all z-indexes
- **Support Global Access:** `system_admin_global` users see ALL schools without manual assignment

## Production Credentials
- **Support:** spencer3009@gmail.com / Socios3009 (system_admin_global)
- **Owner (preview):** admin@elroble.edu / 1234abc8

## Current Production Status
- **CRITICAL:** Production database with real school data (iepexploradores, elroble, laspalmeras) is MISSING from available MongoDB databases
- **Action Required:** Contact Emergent support to recover old database from `edunet-gradebook` deployment
- MongoDB cluster: `customer-apps.mmyrwf.mongodb.net`
- Available DBs: `edunet-gradebook-edunet` (test), `edunet-gradebook-test_database` (preview data)

## Pending Issues
1. ~~Payment Modal Too Tall (P0)~~ ✅ FIXED
2. ~~Mobile Sidebar Overlay in Support Panel (P0)~~ ✅ FIXED (12 Mar 2026)
3. ~~"X" Button to De-assign School Does Not Work (P0)~~ ✅ FIXED (12 Mar 2026)
4. Double Scrollbar in Registro Auxiliar (P1) - NOT STARTED
5. Disappearing Student Selection in PaymentFormModal (P2)
6. Hardcoded Data on Owner Dashboard (P2)
7. Message Center Unread Count Discrepancy (P2)

## Upcoming Tasks
- P0: Recover production database (Emergent support)
- P1: Refactor Message Pages (4 duplicated → 1 component)
- P1: Gradebook export to PDF/Excel
- P1: Lock/Close Period feature
- P1: Dashboard Widgets Phase 2 (news, events, surveys)

## Key Files
- `/app/backend/routes/core.py` - DB connection with auto-discovery
- `/app/backend/routes/auth.py` - Login with error handling
- `/app/backend/routes/support.py` - Support panel routes
- `/app/backend/routes/membership.py` - Payment renewal
- `/app/frontend/src/components/ProfileCard.jsx` - Payment modal
- `/app/backend/server.py` - Health check endpoint
