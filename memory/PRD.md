# EduNet - Product Requirements Document

## Problem Statement
EduNet is a premium, multi-tenant SaaS application for schools in Peru. It provides dashboards and portals for school owners, administrators, teachers, students, and parents.

## User Personas
- **School Owner**: Manages the school, views financial data, monitors attendance, sends messages
- **Admin**: Assists owner with administrative tasks
- **Teacher**: Manages courses, assigns tasks/exams, records grades/attendance
- **Student**: Views courses, tasks, grades, attendance, exams, schedule, messages
- **Parent**: Views child's academic information (same views as student portal, adapted for parent role)

## Core Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB (motor)
- **Database**: MongoDB (DB_NAME from .env, currently `test_database`)
- **Multi-tenant**: Subdomain-based routing (e.g., `elroble.edunet.pe`)

## Implemented Features

### Parent Portal (COMPLETE - Feb 27, 2026)
- 8 pages replicated from Student Portal:
  - `ParentDashboardPage` - Custom parent dashboard with child selector, KPIs, quick actions
  - `ParentCoursesPage` - Exact replica of StudentCoursesPage with parent API
  - `ParentTasksPage` - Exact replica with filtering, stats cards
  - `ParentGradesPage` - Grades grouped by subject with averages
  - `ParentAttendancePage` - Calendar view with month navigation, stats
  - `ParentSchedulePage` - Full schedule grid with tooltips, breaks
  - `ParentExamsPage` - Exam calendar with stats, day detail panel
  - `ParentMessagesPage` - Full email-style inbox (compose, reply, folders, search)
- `ParentSidebar` with child selector
- Parent-specific API endpoints (`/api/parent/*`)
- Backend: 19+ parent API endpoints tested and working

### Other Completed Features
- Premium Accounting Module (Ingresos, Egresos, Deuda)
- Debtors page (MorososPage) with pagination and debt-blocking toggle
- Owner's Message Center (email-style UI)
- Student Portal (full suite: courses, tasks, grades, attendance, schedule, exams, messages)
- Exam system with scheduling and attempt tracking
- Internal mail system (compose, reply, folders, search, archive, trash)
- Multi-tenant authentication with subdomain routing
- Academic structure (levels, grades, sections, shifts, subjects, assignments)
- Attendance tracking with QR
- Schedule management with breaks

### Course Posts Seeding (COMPLETE - Feb 27, 2026)
- Seeded course_posts (materials, announcements, tasks) for all subjects in elroble school
- Updated demo_seeder.py to include course_posts for future schools
- Materials tab now displays correctly in both Student and Parent portals

## Known Issues / Tech Debt
- **P0**: `server.py` is monolithic (21,000+ lines) - needs modularization
- **P0**: Owner Dashboard has hardcoded data for "Asistencia del Mes" and "Noticias y Avisos"
- **P1**: Message Center unread count discrepancy
- **P2**: Replace `window.confirm/alert` with custom modals project-wide

## Upcoming Tasks
- Modularize `server.py` into FastAPI routers (auth, parent, accounting, exams, etc.)
- Remove hardcoded data from Owner Dashboard
- Apply intelligent filters to Parents view in UsersPage
- Cache invalidation for `/api/student/tasks`
- Matriculas (Enrollments) module
- Anti-cheating system for exams
- Question bank for exams
- Automatic notifications for students

## Test Credentials
- **Owner**: admin@elroble.edu / 1234abc8 (subdomain: elroble)
- **Parent**: miguel@gmail.com / 1234abc8 (child: Pepito Peres Rios)
- **App URL**: https://parent-portal-debug.preview.emergentagent.com

## File Structure
```
/app/frontend/src/pages/
  ParentDashboardPage.jsx  (custom parent dashboard - NOT replicated)
  ParentCoursesPage.jsx    (replica of StudentCoursesPage)
  ParentTasksPage.jsx      (replica of StudentTasksPage)
  ParentGradesPage.jsx     (replica of StudentGradesPage)
  ParentAttendancePage.jsx (replica of StudentAttendancePage)
  ParentSchedulePage.jsx   (replica of StudentSchedulePage)
  ParentExamsPage.jsx      (replica of StudentExamSchedulePage)
  ParentMessagesPage.jsx   (replica of StudentMessagesPage)
/app/frontend/src/components/
  ParentSidebar.jsx        (sidebar with child selector)
/app/backend/
  server.py                (parent endpoints at lines 20153-20987)
```
