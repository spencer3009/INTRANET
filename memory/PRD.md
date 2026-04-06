# EduNet - School Management Platform PRD

## Original Problem Statement
Sistema de gestion escolar integral (intranet) para colegios en Peru. Soporte multi-tenant con subdominios, roles diferenciados.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB driver)
- **Database**: MongoDB | **Auth**: JWT | **Files**: Cloudinary

## Modules Implemented

### Psychology Module (Phases 1, 2, 5) - Completed April 6, 2026
- Role psicologo, CRUD, records, sessions, audit log
- Psychologist-parent bidirectional messaging
- Calendar view + Workshop management
- PsicologiaLayout.jsx + PsicologiaSidebar.jsx shared layout
- Cascading filters (nivel_id, grado_id, seccion_id, turno_id)
- Premium student cards (grid 4 columns, photos with fallback)

### PAE Module (Programa de Alimentación Escolar) - In Progress
**Phase 1: Backend Base + Rol** - Completed April 6, 2026
- New role `auxiliar_alimentacion` added to ROLE_HIERARCHY, STAFF_ROLES, SECTION_PERMISSIONS
- Collection `pae_turnos` with indexes (school_id + orden)
- Collection `pae_registros` with unique compound index (school_id + student_id + turno_id + fecha)
- CRUD endpoints: GET/POST/PUT/PATCH `/api/pae/turnos` (admin/owner only)
- Validations: time format, hora_fin > hora_inicio, no overlapping turnos
- Subscription middleware includes auxiliar_alimentacion role
- Frontend: Role card + selector in UsersPage.jsx, route redirect in App.js

**Phase 2: Escaneo y Registro** - PENDING
- POST /api/pae/registro (scan QR, validate student, anti-duplicate)
- GET /api/pae/registro/turno/{turno_id} and /api/pae/registro/dashboard
- PaeDashboard.jsx (auxiliar main view)
- PaeScanner.jsx (camera + USB dual mode)

**Phase 3: Reportes y Exportación** - PENDING
- GET /api/pae/reportes/diario, /rango, /exportar (Excel)
- PaeReportes.jsx (filters, table, export)
- PaeConfig.jsx (admin turno management UI)

## Key Files
- `/app/backend/routes/pae.py` - PAE turno CRUD endpoints
- `/app/backend/routes/core.py` - Role hierarchy, section permissions
- `/app/frontend/src/pages/UsersPage.jsx` - Role cards with auxiliar_alimentacion
- `/app/frontend/src/App.js` - Route redirects for auxiliar_alimentacion
- `/app/frontend/src/components/PsicologiaLayout.jsx` - Psychology shared layout
- `/app/frontend/src/pages/psicologia/` - All 9 psychology pages
- `/app/backend/routes/psychology.py` - Psychology Phase 1
- `/app/backend/routes/psychology_messages.py` - Phase 2
- `/app/backend/routes/psychology_agenda.py` - Phase 5

## Prioritized Backlog
### P0 (Current)
- PAE Phase 2: Escaneo y Registro (scanner, dashboard, anti-duplicate)
- PAE Phase 3: Reportes y Exportación (daily/range reports, Excel export, admin config UI)

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
