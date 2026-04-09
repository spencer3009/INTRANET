# EduNet - School Management Platform

## Original Problem Statement
Plataforma de gestión escolar integral con módulos para administración, coordinación, psicología, profesores, padres y estudiantes.

## Architecture
- Frontend: React + Tailwind CSS + Shadcn/UI + lucide-react
- Backend: FastAPI + MongoDB
- Auth: JWT-based

## What's Been Implemented

### Premium UI Redesign (Complete for Coordinator Module)
All coordinator pages redesigned with Linear/Notion style:
- CoordinacionDashboardPage, EstudiantesFichaPage, IncidenciasListPage, IncidenciaFormPage, IncidenciaDetailPage, SeguimientosListPage
- CharlasListPage, CharlaDetailPage, ReunionesListPage, ReunionDetailPage, DerivacionesListPage, DerivacionDetailPage, AgendaPage, ReportesPage

### Bug Fix: Teacher Credentials Export
- Fixed `/api/teachers/export-credentials` - auto-generates plain_password for teachers missing it during export

### New Feature: Teacher QR Bulk Download
- New endpoint: `GET /api/teachers/qr/bulk-download` - Generates PDF with 3x3 grid of QR cards for all teachers
- Mirrors exact same format as student QR cards (logo, photo/initial, name, QR code, "Personal e intransferible")
- Button "Descargar QR" added to UsersPage next to "Exportar Credenciales" for teacher tab
- Auto-generates qr_token for any teacher missing one

### Bug Fix: QR Bulk Download Memory Crash (P0 - Fixed 2026-04-09)
- **Problem**: Server crashed (Error 520) when generating QR PDF for 31+ teachers due to parallel photo downloads consuming all RAM
- **Fix applied**:
  - Changed photo downloads from parallel (`asyncio.gather`) to **sequential** with `httpx.Timeout(5.0)`
  - Each photo resized with **Pillow** to max 200x200px, JPEG quality=75 before passing to ReportLab
  - Per-photo `try/except` with **initials fallback** if download fails/times out
  - Explicit `del` of image buffers after each card drawn
  - Global `try/except` returns `JSONResponse(500)` instead of crashing the worker
  - Full **phase logging** with `[QR Bulk]` prefix for debugging
- **Result**: 12 teachers PDF generated in 1.28s, 138KB. Estimated 31 teachers: ~365KB, well within limits

### New Role: Auxiliar de Asistencia (Added 2026-04-09)
- New role `auxiliar_asistencia` added to the platform
- **Backend**: Added to ROLE_HIERARCHY (level 38), STAFF_ROLES, SECTION_PERMISSIONS (attendance, internal_mail) in `core.py` and `config.py`
- **Frontend**: New card in UsersPage with custom icon (sky blue theme), role labels in DashboardHeader, ProfileCard, permissions.js, App.js routing
- **CRUD**: Full create/edit/delete via existing UsersPage infrastructure
- **Login redirect**: Goes to `/asistencias` on login
- **Access**: Can access attendance and internal mail modules
- **Internal module**: Pending (user will provide prompt later)

## Prioritized Backlog

### P1 (High Priority)
- Auxiliar de Asistencia — Módulo interno (pendiente prompt del usuario)
- Dashboard Owner con métricas reales
- Módulo de Matrículas (Enrollments)
- Psicología — Log de auditoría estricto (parametrizar log_audit())

### P2 (Medium Priority)
- Módulo de Encuestas
- Optimización rendimiento exámenes masivos (3000 estudiantes)
- Refactorización CourseDetailPage.jsx (>11,000 líneas)

## Design Standards (Coordinator Module)
- **KPI Cards**: Gradient backgrounds, tabular-nums, glassmorphism icons, semi-circles
- **Badges**: Subtle gradient backgrounds with borders
- **Lists**: Left color border, hover states
- **Full-width**: NEVER use `max-w-*` constraints
- **Forms**: rounded-xl, bg-slate-50, focus states with indigo ring

## Test Accounts
See /app/memory/test_credentials.md

## Files Modified for Auxiliar de Asistencia
- `/app/backend/routes/core.py` - ROLE_HIERARCHY, STAFF_ROLES, SECTION_PERMISSIONS
- `/app/backend/utils/config.py` - ROLE_HIERARCHY, STAFF_ROLES
- `/app/frontend/src/pages/UsersPage.jsx` - ROLE_CARDS, AddUserModal labels
- `/app/frontend/src/App.js` - STAFF_ROLES, isAuxiliarAsistencia helper, login redirect, dashboard routing
- `/app/frontend/src/components/DashboardHeader.jsx` - ROLE_DISPLAY_MAP
- `/app/frontend/src/components/ProfileCard.jsx` - ROLE_DISPLAY_MAP
- `/app/frontend/src/lib/permissions.js` - attendance/internal_mail permissions, staffRoles, getRoleDisplayName
