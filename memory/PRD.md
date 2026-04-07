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
- Bidirectional messaging, calendar, workshops
- PsicologiaLayout + PsicologiaSidebar shared layout, cascading filters, premium cards

### PAE Module (Programa de Alimentacion Escolar)
**Phase 1: Backend Base + Rol** - Completed April 6, 2026
- Role `auxiliar_alimentacion` in ROLE_HIERARCHY, STAFF_ROLES, SECTION_PERMISSIONS
- Collections `pae_turnos` + `pae_registros` with indexes
- CRUD: GET/POST/PUT/PATCH/DELETE `/api/pae/turnos`

**Phase 2: Escaneo y Registro** - Completed April 6, 2026
- POST /api/pae/registro (QR scan, anti-duplicate via DuplicateKeyError, metadata snapshot)
- GET /registro/turno/{id}, /registro/dashboard, /registros-dia (admin read-only)
- PaeDashboard.jsx (standard Sidebar+Header, turno selector, scan button)
- PaeScanner.jsx (camera/USB, local cache, debounce, audio, vibration, manual mode)
- PaeRegistrosDia.jsx (admin read-only, filters: Grado/Seccion/Turno/Fecha + Cargar button)
- 4th "Alimentacion" card in AttendancePage.jsx (green, owner/admin only)
- Routes: /pae, /pae/scanner, /asistencias/alimentacion

**Ajustes Post-Fase 2** - Completed April 6, 2026
- Settings page: PAE Turnos section with full CRUD (create/edit/toggle/delete)
- PaeDashboard: Gear icon -> PaeSettingsModal (scan prefs in localStorage, read-only turnos, logout)
- PaeScanner: Respects localStorage preferences (mode, reading mode, sounds, vibration)
- DELETE /api/pae/turnos/{id} with registros protection
- GET /api/school/info: Public endpoint for logo+name (all authenticated users)
- DashboardHeader: extraActions prop for custom header buttons
- Auto-seed migration: `seed_pae_default_turnos` runs at server startup (idempotent, non-blocking, with [PAE Migration] logging)

### Teacher Credentials Export - Completed April 7, 2026
- GET /api/teachers/export-credentials: Excel export with metadata (colegio, fecha, total), sorted alphabetically
- Frontend: "Exportar Credenciales" blue button in Profesores view (UsersPage.jsx)
- Uses plain_password field from DB, same pattern as student export

**Phase 3: Reportes y Exportacion** - PENDING

## Key Files
- `/app/backend/routes/pae.py` - PAE complete backend
- `/app/backend/routes/settings.py` - GET /api/school/info
- `/app/frontend/src/pages/pae/PaeDashboard.jsx` - Auxiliar portal
- `/app/frontend/src/pages/pae/PaeScanner.jsx` - QR scanner
- `/app/frontend/src/pages/pae/PaeRegistrosDia.jsx` - Admin registros view
- `/app/frontend/src/components/PaeSettingsModal.jsx` - Auxiliar preferences
- `/app/frontend/src/pages/SettingsPage.jsx` - PAE Turnos config section
- `/app/frontend/src/pages/AttendancePage.jsx` - 4th Alimentacion card

## Prioritized Backlog
### P0
- PAE Phase 3: Reportes y Exportacion

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
