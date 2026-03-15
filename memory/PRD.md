# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is a comprehensive academic management system (intranet escolar) for schools in Peru. It includes:
- Registro Auxiliar (Gradebook)
- Consolidado de Notas (Grade Report)
- Membership renewal system
- Support Panel for managing schools and finances
- Landing page for lead generation
- Role-based dashboards (Owner, Teacher, Parent, Support)

## Architecture
- **Frontend:** React + Tailwind + Shadcn/UI
- **Backend:** FastAPI + MongoDB
- **3rd Party:** Cloudinary (images), pandas, openpyxl, recharts

## Key Files
- `/app/frontend/src/pages/LandingPage.jsx` - Landing page with lead form
- `/app/frontend/src/pages/SupportSchoolsPage.jsx` - Support school management
- `/app/backend/routes/academic.py` - Academic endpoints
- `/app/backend/routes/support.py` - Support panel endpoints
- `/app/backend/routes/core.py` - DB auto-discovery
- `/app/backend/routes/system.py` - System/Cloudinary endpoints

## What's Been Implemented

### Landing Page (March 2026)
- [x] Video section replaced with Google Drive iframe
- [x] Lead form sends data to WhatsApp +51992021294 (Nombre, Telefono, Email)
- [x] Message format: "Hola, deseo mas informacion" + form data
- [x] All "Solicitar demo" buttons renamed to "Informes"

### Support Panel - Titular de Cuenta (March 2026)
- [x] Owner/titular button on each school card (UserCircle icon, top-right)
- [x] Modal showing owner data: name, last_name, email, phone, created_at
- [x] Edit mode for modifying owner data with save/cancel
- [x] Backend endpoints: GET/PUT /api/support/school-owner/{school_id}

### Support Panel (Previous sessions)
- [x] Finance page with advanced filters (year, month, day, date range)
- [x] Delete individual payments
- [x] Create school from support panel (auto-registers creation fee)
- [x] School deletion purges financial records
- [x] Membership renewal with 8-digit transaction code
- [x] Conditional "Pagar" button for missing payments

### Academic
- [x] Placeholder rows for empty sections (Consolidado, Gradebook)
- [x] Replicar Asignaturas feature (conditional visibility)

### Bug Fixes
- [x] Mobile sidebar z-index fix
- [x] Cloudinary signature fix (missing import os)

## Pending Issues
| Priority | Issue | Status |
|----------|-------|--------|
| P0 | Subject list inconsistency (Asignaturas page vs Asignar Docente modal) | IN PROGRESS |
| P0 | Production database missing (BLOCKED on Emergent support) | BLOCKED |
| P1 | Double scrollbar in Registro Auxiliar | NOT STARTED |
| P2 | Disappearing student selection in PaymentFormModal | NOT STARTED |
| P2 | Hardcoded data on Owner Dashboard (recurring 7+) | NOT STARTED |
| P2 | Message Center unread count discrepancy (recurring 7+) | NOT STARTED |

## Upcoming Tasks
- P0: Refactor Message Pages (consolidate 4 duplicated pages)
- P1: Gradebook Enhancements (PDF/Excel export, Lock/Close Period)
- P1: Dashboard Widgets Phase 2 (news, events, surveys APIs)

## Future/Backlog
- Complete Parent Portal Feature Parity
- Build "Matriculas" (Enrollments) module
- Enhance Exams module with Question Bank
- Replace window.confirm/alert with custom modals
- "Replicar Ano Academico" feature
- Break down UsersPage.jsx into smaller components

## Credentials
- **Owner:** subdomain=elroble, email=Iep.exploradores@gmail.com, pwd=1234abc8
- **Support:** email=spencer3009@gmail.com, pwd=Socios3009

## Key API Endpoints
- GET /api/support/school-owner/{school_id} - Get owner data
- PUT /api/support/school-owner/{school_id} - Update owner data
- GET /api/support/schools - List schools with enriched data
- POST /api/support/create-school - Create school + owner
- POST /api/support/renew-membership - Renew with operation code
- GET/PUT /api/support/pricing - Global pricing config
- GET /api/support/finances/transactions - Filtered transactions
