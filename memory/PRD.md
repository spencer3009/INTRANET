# EduNet - School Management Platform

## Original Problem Statement
Plataforma de gestion escolar integral con modulos para administracion, coordinacion, psicologia, profesores, padres y estudiantes.

## Architecture
- Frontend: React + Tailwind CSS + Shadcn/UI + lucide-react + recharts
- Backend: FastAPI + MongoDB
- Auth: JWT-based

## What's Been Implemented

### Premium UI Redesign (Complete for Coordinator Module)
All coordinator pages redesigned with Linear/Notion style.

### Bug Fix: Teacher Credentials Export
- Fixed `/api/teachers/export-credentials`

### New Feature: Teacher QR Bulk Download
- Endpoint: `GET /api/teachers/qr/bulk-download`

### Bug Fix: QR Bulk Download Memory Crash (Fixed)
- Sequential downloads with httpx, Pillow resize, explicit del of buffers
- Applied to both teacher and student bulk QR endpoints

### New Role: Auxiliar de Asistencia (Complete)
- Role `auxiliar_asistencia` with full portal
- Backend: ROLE_HIERARCHY, STAFF_ROLES, SECTION_PERMISSIONS
- Frontend: Card in UsersPage, DashboardHeader, ProfileCard, permissions.js, App.js routing

### Auxiliar Dashboard with Charts (2026-04-09)
- New endpoint: `GET /api/attendance/aux-dashboard-stats` - 14-day attendance stats
- KPI Summary cards (students present/late, teachers present/late)
- Pie charts: distribution of student and teacher attendance today
- Bar charts: 14-day student and teacher attendance trends (stacked: present, late, absent, justified)
- Using recharts library

### Auxiliar Portal Features (2026-04-09)
- Manual attendance marking for students and teachers (reuses AttendancePage)
- Attendance reports with day/month/year filters (reuses AttendancePage)
- Routes: `/aux-asistencia/asistencias` renders full AttendancePage
- Mobile bottom nav with 4 buttons: Inicio, Escanear, Asistencias, Mis Registros

### Z-index Fix (Partial - 2026-04-09)
- Changed z-50 to z-[200] in 13 shadcn components + 50+ custom modals
- Header inline zIndex lowered from 100 to 40
- Note: Stacking context issue persists in some layouts. React Portal approach pending.

### Frontend: safeDownloadBlob Integration (2026-04-09)
- Created `/app/frontend/src/lib/downloadHelper.js`
- Integrated in BulkQRModal.jsx for student QR bulk download

### Descargar QR Button Moved (2026-04-09)
- Moved from action bar to next to "Agregar Estudiante" button with QR icon

### CORS Fix
- Created `/app/frontend/.env.production`

## Prioritized Backlog

### P0 (Critical)
- Z-index header vs modals: React Portal solution pending (stacking context issue)

### P1 (High Priority)
- Dashboard Owner con metricas reales
- Modulo de Matriculas (Enrollments)
- Psicologia — Log de auditoria estricto (parametrizar log_audit())

### P2 (Medium Priority)
- Modulo de Encuestas
- Optimizacion rendimiento examenes masivos (3000 estudiantes)
- Refactorizacion CourseDetailPage.jsx (>11,000 lineas)

## Z-Index Hierarchy
- z-[200]: All modals, popups, dialogs, sheets, drawers, shadcn portals
- z-40: Header (DashboardHeader, StudentHeader)
- z-50: Header internal dropdowns, MobileBottomNav, FloatingHelpAvatar, LandingPage nav
- z-[201]: Sidebar

## Key Endpoints
- `POST /api/students/qr/bulk-download`
- `GET /api/attendance/my-scans-today`
- `GET /api/attendance/aux-dashboard-stats`

## Test Accounts
See /app/memory/test_credentials.md
