# EduNet - School Management Platform PRD

## Original Problem Statement
Sistema de gestion escolar integral (intranet) para colegios en Peru. Soporte multi-tenant con subdominios, roles diferenciados (owner, admin, director, coordinator, teacher, auxiliar, psicologo, parent, student), modulos academicos, financieros, de asistencia, disciplina, horarios, examenes OMR y comunicacion interna.

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
5. Schedules
6. Attendance
7. Discipline
8. Grades/Consolidado
9. OMR Exams
10. Subscriptions & Billing
11. Internal Messaging
12. Teacher Portal
13. Student Portal
14. Parent Portal
15. Psychology Module - Phase 1 (CRUD, Fichas, Sesiones)
16. Psychology Module - Phase 2 (Messaging)
17. Psychology Module - Phase 5 (Agenda + Workshops)

## Recent Work

### Layout Consistency Update (April 6, 2026)
- Created `PsicologiaLayout.jsx` shared component (sidebar + DashboardHeader)
- Created `PsicologiaSidebar.jsx` with 8 navigation items
- Updated ALL 8 psychology pages to use PsicologiaLayout:
  - Dashboard, Estudiantes, Sesiones, Mensajes, Perfil, Ficha Clinica, Agenda, Talleres
- Added 'psicologo' to ROLE_DISPLAY_MAP in DashboardHeader
- Each page shows: sidebar (collapsed/hover-expandable), school logo, user profile, page toolbar
- Testing: 15/15 features verified (iteration_110)

### Psychology Phase 5: Agenda & Workshops (April 6, 2026)
- Backend: Appointments CRUD + Workshops CRUD (psychology_agenda.py)
- Frontend: Calendar view (day/week/month), Workshop cards with filters
- Testing: 20/20 backend (iteration_108), 20/20 dashboard (iteration_109)

### Psychology Phase 2: Messaging (April 6, 2026)
- Psychologist-parent bidirectional messaging
- Testing: 24/24 (iteration_107)

### Psychology Phase 1 (April 6, 2026)
- Role psicologo, CRUD, records, sessions, audit log
- Testing: 100% (iteration_106)

## Key Files
- `/app/frontend/src/components/PsicologiaLayout.jsx` - Shared layout
- `/app/frontend/src/components/PsicologiaSidebar.jsx` - Sidebar
- `/app/frontend/src/pages/psicologia/` - All 8 psychology pages
- `/app/backend/routes/psychology.py` - Phase 1 backend
- `/app/backend/routes/psychology_messages.py` - Phase 2 backend
- `/app/backend/routes/psychology_agenda.py` - Phase 5 backend

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
