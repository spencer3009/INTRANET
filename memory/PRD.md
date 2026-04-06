# EduNet - School Management Platform PRD

## Original Problem Statement
Sistema de gestion escolar integral (intranet) para colegios en Peru. Soporte multi-tenant con subdominios, roles diferenciados (owner, admin, director, coordinator, teacher, auxiliar, psicologo, parent, student), modulos academicos, financieros, de asistencia, disciplina, horarios, examenes OMR y comunicacion interna.

## Core Requirements
- Multi-tenant architecture with subdomain routing
- Role-based access control (RBAC) with 9 roles
- Academic management (courses, grades, schedules)
- Financial management (billing, payments, subscriptions)
- Communication (internal messaging, notifications)
- Health & Wellness module (psychology)

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB driver)
- **Database**: MongoDB
- **Auth**: JWT-based with role hierarchy
- **File Storage**: Cloudinary

## Key Modules Completed
1. Authentication & Authorization
2. Dashboard (per-role)
3. Users Management
4. Academic Years & Courses
5. Schedules (proportional grid + horizontal)
6. Attendance
7. Discipline
8. Grades/Consolidado
9. OMR Exams
10. Subscriptions & Billing
11. Internal Messaging
12. Teacher Portal
13. Student Portal
14. Parent Portal
15. **Psychology Module - Phase 1** (April 6, 2026)
16. **Psychology Module - Phase 2: Messaging** (April 6, 2026)
17. **Psychology Module - Phase 5: Agenda & Workshops** (April 6, 2026)

## What's Been Implemented

### Psychology Dashboard Redesign (April 6, 2026)
- **PsicologiaSidebar.jsx**: New sidebar component matching intranet style
  - 8 navigation items: Inicio, Estudiantes, Fichas Clinicas, Sesiones, Mensajes Padres, Agenda, Talleres, Mi Perfil
  - Hover expansion with full labels, unread messages badge
  - Same CSS classes as main Sidebar.jsx (sidebar, sidebar-link, etc.)
- **DashboardHeader integration**: Reused shared header component
  - School logo from /api/settings/public/{subdomain}
  - "Bienvenido, Colegio El Roble" with current date
  - User profile with "Psicologo/a" role display + avatar
  - Notification bell
  - Added 'psicologo' to ROLE_DISPLAY_MAP
- **4 Colored Metric Cards**: 
  - Blue: En Seguimiento (active students)
  - Green: Sesiones del Mes
  - Purple: Nuevos Casos
  - Orange: Citas de Hoy
- **Quick Action Cards**: Estudiantes, Fichas Clinicas, Agenda, Talleres
- **Two-column layout**: Citas de Hoy + Proximos Talleres
- **Sesiones Recientes**: Recent sessions list
- **Testing**: 20/20 features verified (iteration_109)

### Psychology Phase 5: Agenda & Workshops (April 6, 2026)
- Backend: Appointments CRUD + Workshops CRUD (psychology_agenda.py)
- Frontend: Calendar view (day/week/month), Workshop cards with filters
- Routes in App.js for both direct and /:subdomain/ patterns
- Testing: 20/20 backend tests (iteration_108)

### Psychology Phase 2: Messaging (April 6, 2026)
- Backend + Frontend for psychologist-parent messaging
- Testing: 24/24 tests (iteration_107)

### Psychology Phase 1 (April 6, 2026)
- Role psicologo with CRUD, dashboard, student list, records, sessions
- Testing: 100% (iteration_106)

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
