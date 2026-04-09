# EduNet - School Management Platform

## Original Problem Statement
Plataforma de gestion escolar integral con modulos para administracion, coordinacion, psicologia, profesores, padres y estudiantes.

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
- Button "Descargar QR" added to UsersPage next to "Exportar Credenciales" for teacher tab
- Auto-generates qr_token for any teacher missing one

### Bug Fix: QR Bulk Download Memory Crash (P0 - Fixed 2026-04-09)
- **Problem**: Server crashed (Error 520) when generating QR PDF for 31+ teachers due to parallel photo downloads consuming all RAM
- **Fix**: Sequential downloads with httpx, Pillow resize to 200x200, explicit del of buffers, global try/except
- Applied to both teacher and student bulk QR endpoints

### New Role: Auxiliar de Asistencia (Added 2026-04-09)
- New role `auxiliar_asistencia` added to the platform
- Backend: ROLE_HIERARCHY, STAFF_ROLES, SECTION_PERMISSIONS
- Frontend: Card in UsersPage, DashboardHeader, ProfileCard, permissions.js, App.js routing
- Portal: AuxAsistenciaDashboard, AuxAsistenciaScanner, AuxAsistenciaMisEscaneos
- Endpoint: GET /attendance/my-scans-today

### Bug Fix: Z-index Modals vs Header (P0 - Fixed 2026-04-09)
- **Problem**: All modals/popups (z-50 = z-index:50) rendered BEHIND the header (zIndex:100), making them unusable when overlapping the header area
- **Fix**: Mass z-index upgrade from z-50 to z-[200] across:
  - 13 Shadcn UI components (dialog, sheet, drawer, alert-dialog, dropdown-menu, context-menu, menubar, select, hover-card, combobox, tooltip, popover, ConfirmModal)
  - 50+ custom modal overlays in pages/ and components/
  - z-40 and z-[60] modal overlays also upgraded to z-[200]
  - Intentionally preserved: MobileBottomNav, FloatingHelpAvatar, LandingPage nav (non-popup z-50), DashboardHeader/StudentHeader internal dropdowns
- **Result**: All modals now render above the header at z-200 vs header z-100

### Frontend: safeDownloadBlob Integration (P0 - Fixed 2026-04-09)
- Created `/app/frontend/src/lib/downloadHelper.js` with `safeDownloadBlob` helper
- Integrated in BulkQRModal.jsx for student QR bulk download (replaces direct Axios blob handling)
- Prevents InvalidStateError when server returns 5xx on blob downloads
- Teacher QR download NOT modified (per user directive, already working)

### CORS Fix
- Created `/app/frontend/.env.production` for production URL

## Prioritized Backlog

### P1 (High Priority)
- Dashboard Owner con metricas reales
- Modulo de Matriculas (Enrollments)
- Psicologia — Log de auditoria estricto (parametrizar log_audit())

### P2 (Medium Priority)
- Modulo de Encuestas
- Optimizacion rendimiento examenes masivos (3000 estudiantes)
- Refactorizacion CourseDetailPage.jsx (>11,000 lineas)

## Design Standards (Coordinator Module)
- **KPI Cards**: Gradient backgrounds, tabular-nums, glassmorphism icons, semi-circles
- **Badges**: Subtle gradient backgrounds with borders
- **Lists**: Left color border, hover states
- **Full-width**: NEVER use `max-w-*` constraints
- **Forms**: rounded-xl, bg-slate-50, focus states with indigo ring

## Z-Index Hierarchy
- z-[200]: All modals, popups, dialogs, sheets, drawers, alert-dialogs, shadcn portals
- z-[100]: Header (DashboardHeader, StudentHeader), DemoBlockedModal, SubscriptionBanner, toast, InstallGateway, SuspendedScreen
- z-50: Header internal dropdowns, MobileBottomNav, FloatingHelpAvatar, LandingPage nav
- z-40/z-30: Sidebars, sticky sub-headers

## Test Accounts
See /app/memory/test_credentials.md

## Key Files Modified in Latest Session
- `/app/frontend/src/components/ui/*.jsx` - z-index upgrade z-50 to z-[200]
- `/app/frontend/src/components/BulkQRModal.jsx` - safeDownloadBlob integration
- `/app/frontend/src/pages/*.jsx` - z-index upgrade on modal overlays
- `/app/frontend/src/components/*.jsx` - z-index upgrade on modal overlays
