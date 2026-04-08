# EduNet - School Management Platform

## Original Problem Statement
Plataforma de gestión escolar integral con módulos para administración, coordinación, psicología, profesores, padres y estudiantes.

## Current Session Focus
1. Rediseño visual premium (estilo Linear/Notion) de TODAS las páginas del módulo Coordinador
2. Fix bug: Exportación de credenciales de profesores mostraba contraseñas vacías

## Architecture
- Frontend: React + Tailwind CSS + Shadcn/UI + lucide-react
- Backend: FastAPI + MongoDB
- Auth: JWT-based

## What's Been Implemented

### Premium UI Redesign (Complete for Coordinator Module)
All coordinator pages now use:
- KPI Cards with diagonal gradients, semi-circle decorations, glassmorphism icons
- Tab-based filters with gradient active states
- List items with colored left borders and premium badges
- Detail pages with gradient status banners and icon grid layouts
- Full-width layouts (no max-w constraints)
- tabular-nums for numeric displays

Pages redesigned:
- CoordinacionDashboardPage.jsx ✅
- EstudiantesFichaPage.jsx ✅
- IncidenciasListPage.jsx ✅
- IncidenciaFormPage.jsx ✅
- IncidenciaDetailPage.jsx ✅
- SeguimientosListPage.jsx ✅
- CharlasListPage.jsx ✅ (this session)
- CharlaDetailPage.jsx ✅ (this session)
- ReunionesListPage.jsx ✅ (this session)
- ReunionDetailPage.jsx ✅ (this session)
- DerivacionesListPage.jsx ✅ (this session)
- DerivacionDetailPage.jsx ✅ (this session)
- AgendaPage.jsx ✅ (this session)
- ReportesPage.jsx ✅ (this session)

### Bug Fix: Teacher Credentials Export
- Fixed `/api/teachers/export-credentials` - teachers missing `plain_password` now get auto-generated passwords during export
- New passwords are saved to DB (hashed + plain) so subsequent exports are consistent
- Logged backfill operations for audit trail

## Prioritized Backlog

### P0 (Critical)
- None

### P1 (High Priority)
- Dashboard Owner con métricas reales
- Módulo de Matrículas (Enrollments)
- Psicología — Log de auditoría estricto (parametrizar log_audit())

### P2 (Medium Priority)
- Módulo de Encuestas
- Optimización rendimiento exámenes masivos (3000 estudiantes)
- Refactorización CourseDetailPage.jsx (>11,000 líneas)

## Design Standards (Coordinator Module)
- **KPI Cards**: `bg-gradient-to-br` with inline linear-gradient, tabular-nums, glassmorphism icons (`bg-white/20 backdrop-blur`), 2 semi-circles via `radial-gradient`
- **Badges**: Subtle gradient backgrounds (e.g., `bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70`)
- **Lists**: Left color border (`borderLeftWidth: 3px`), hover states with `duration-200`
- **Full-width**: NEVER use `max-w-4xl/6xl/etc`. Content must flow `w-full`
- **Forms**: `rounded-xl`, `bg-slate-50`, focus states with `focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100`

## Test Accounts
See /app/memory/test_credentials.md
