# EduNet - School Management Platform PRD

## Original Problem Statement
Sistema de gestion escolar integral (intranet) para colegios en Peru. Soporte multi-tenant con subdominios, roles diferenciados.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB driver)
- **Database**: MongoDB | **Auth**: JWT | **Files**: Cloudinary

## Modules Implemented

### Psychology Module (Phases 1, 2, 5) - Completed
- Role psicologo, CRUD, records, sessions, audit log
- Psychologist-parent bidirectional messaging
- Calendar view + Workshop management
- PsicologiaLayout.jsx + PsicologiaSidebar.jsx shared layout
- Cascading filters (nivel_id, grado_id, seccion_id, turno_id)
- Premium student cards (grid 4 columns, photos with fallback)

### PAE Module (Programa de Alimentacion Escolar)
**Phase 1: Backend Base + Rol** - Completed April 6, 2026
- Role `auxiliar_alimentacion` in ROLE_HIERARCHY, STAFF_ROLES, SECTION_PERMISSIONS
- Collection `pae_turnos` with indexes (school_id + orden)
- Collection `pae_registros` with unique compound index
- CRUD endpoints: GET/POST/PUT/PATCH `/api/pae/turnos` (admin/owner only)
- Validations: time format, hora_fin > hora_inicio, no overlapping turnos

**Phase 2: Escaneo y Registro** - Completed April 6, 2026
- POST /api/pae/registro: QR scan, anti-duplicate via DuplicateKeyError, metadata snapshot
- GET /api/pae/registro/turno/{turno_id}: Records by turno and date
- GET /api/pae/registro/dashboard: Counts per turno, last records
- GET /api/pae/registros-dia: Admin read-only view with turno/date filters
- PaeDashboard.jsx: Auxiliar portal with reduced sidebar, turno selector, scan button
- PaeScanner.jsx: Dual mode (camera + USB), local cache, debounce, audio feedback
- PaeRegistrosDia.jsx: Admin read-only registros with filters (date, turno, search)
- 4th "Alimentacion" card in AttendancePage.jsx (owner/admin only)
- Routes: /pae, /pae/scanner, /asistencias/alimentacion (static + tenant)

**Phase 3: Reportes y Exportacion** - PENDING
- Daily/range reports, Excel export
- PaeReportes.jsx, PaeConfig.jsx (admin turno management UI)

## Key Files
- `/app/backend/routes/pae.py` - PAE complete backend (turnos + registros)
- `/app/backend/routes/core.py` - Role hierarchy with auxiliar_alimentacion
- `/app/frontend/src/pages/pae/PaeDashboard.jsx` - Auxiliar main dashboard
- `/app/frontend/src/pages/pae/PaeScanner.jsx` - QR scanner (camera + USB)
- `/app/frontend/src/pages/pae/PaeRegistrosDia.jsx` - Admin read-only registros
- `/app/frontend/src/pages/AttendancePage.jsx` - 4th Alimentacion card
- `/app/frontend/src/App.js` - All PAE routes
- `/app/frontend/src/lib/permissions.js` - PAE section permissions

## Prioritized Backlog
### P0 (Current)
- PAE Phase 3: Reportes y Exportacion (daily/range reports, Excel export, admin config UI)

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
