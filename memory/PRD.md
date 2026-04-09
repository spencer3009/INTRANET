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

## Prioritized Backlog

### P1 (High Priority)
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
