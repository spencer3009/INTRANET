# EduNet - School Management Platform PRD

## Original Problem Statement
Sistema de gestion escolar integral (intranet) para colegios en Peru. Soporte multi-tenant con subdominios, roles diferenciados.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB driver)
- **Database**: MongoDB | **Auth**: JWT | **Files**: Cloudinary

## Recent Work

### Fix: Estudiantes vs Fichas Clinicas (April 6, 2026)
- Created `PsicologiaFichasListPage.jsx` - dedicated page for clinical records
- Added backend endpoint `GET /api/v1/psychology/records` (list all records with student info, filters)
- Updated App.js routes: `/psicologia/fichas` now points to FichasListPage (was pointing to EstudiantesPage)
- Fichas page shows: student name, record status, reason category, session count, last session date
- Estudiantes page shows: all students with contact info, grades, sections

### Layout Consistency (April 6, 2026)
- PsicologiaLayout.jsx + PsicologiaSidebar.jsx
- All 9 psychology pages use shared layout (sidebar + header)

### Psychology Phase 5: Agenda & Workshops (April 6, 2026)
- Calendar view + Workshop management

### Psychology Phase 2: Messaging (April 6, 2026)
- Psychologist-parent bidirectional messaging

### Psychology Phase 1 (April 6, 2026)
- Role psicologo, CRUD, records, sessions, audit log

## Key Files
- `/app/frontend/src/components/PsicologiaLayout.jsx`
- `/app/frontend/src/components/PsicologiaSidebar.jsx`
- `/app/frontend/src/pages/psicologia/PsicologiaFichasListPage.jsx` (NEW)
- `/app/frontend/src/pages/psicologia/` - All 9 psychology pages
- `/app/backend/routes/psychology.py` - Phase 1 + records listing
- `/app/backend/routes/psychology_messages.py` - Phase 2
- `/app/backend/routes/psychology_agenda.py` - Phase 5

## Prioritized Backlog
### P1
- Psychology audit log UI
- Dashboard Owner with real metrics
- Enrollment module ("Matriculas")
### P2
- Refactor CourseDetailPage.jsx (>11,000 lines)
- Survey module ("Encuestas")
- Performance optimization for mass exam loading

## Test Accounts
See /app/memory/test_credentials.md
