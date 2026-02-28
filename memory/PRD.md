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
- Seeded course_posts (materials, announcements, tasks, forum posts) for all subjects in elroble school
- Seeded course_reminders for multiple subjects with future dates
- Updated demo_seeder.py to include course_posts for future schools
- Materials, Forum, and Reminders tabs now display correctly in both Student and Parent portals
- Added RemindersContent component with proper tab rendering (was missing case "recordatorios")

### Parent Student Dashboard (COMPLETE - Feb 27, 2026)
- Replaced ParentDashboardPage with student dashboard replica as the MAIN parent view
- Dashboard auto-updates when selecting different children from the sidebar dropdown
- Read-only mode: same visual design as student dashboard (stat cards, circular progress charts, hero carousel, courses, tasks, profile card, calendar)
- No separate menu item — the parent's Dashboard IS the student dashboard
- Removed ParentStudentDashboardPage.jsx (was separate page, now integrated)
- Tested: child switching updates all data correctly (Pepito vs Juan show different stats)

### Circular Progress Charts (COMPLETE - Feb 27, 2026)
- Converted linear progress bars for "Progreso de Tareas" and "Asistencia" into SVG circular graphs
- Color-coded: green (>=80%), amber (>=50%), red (<50%)
- Tasks chart shows: percentage, submitted/total count, status label
- Attendance chart shows: percentage, days count, breakdown (presentes, tardanzas, faltas)
- Smooth animation on load with stroke-dashoffset transition

### PWA Installation (COMPLETE - Feb 27, 2026)
- Created manifest.json with EduNet branding, custom user icon (192x192, 512x512 PNG)
- Created service-worker.js for PWA capability
- Updated index.html with manifest link, apple-mobile-web-app meta tags, service worker registration
- Created PwaInstallPrompt component: automatic install via beforeinstallprompt (no manual steps)
- Flow: Button → 2.5s animated progress bar → native prompt → one-click install
- Hidden on desktop and when app is already installed

### URL Simplification (COMPLETE - Feb 27, 2026)
- Refactored ALL routes from /school/:subdomain/* to /:subdomain/*
- /elroble now opens login directly (short URL for WhatsApp sharing)
- /elroble/login also works
- Old /school/elroble/* URLs auto-redirect to /elroble/* via SchoolRedirect component
- 71 route definitions + 48 navigation calls updated
- Tested: 9/9 tests passed (login, redirect, sidebar, courses, payments, child switcher)
- Reorganized dashboard into two-column layout (70/30) for Financial Status + Student Profile
- Left column (lg:col-span-8): Estado Financiero with progress bar, summary cards, morosidad alerts
- Right column (lg:col-span-4): "Alumno seleccionado" header + StudentProfileCard
- Responsive: stacks vertically on mobile (Financial first, then Profile)
- StudentProfileCard removed from lower right sidebar, now only MiniCalendar there
- No logic changes, only layout restructure

### Payment Module in Parent Portal (COMPLETE - Feb 27, 2026)
- Created /api/parent/payments endpoint returning payment summary per child
- Dashboard shows financial summary: progress bar (green/yellow/red), 4 summary cards, morosidad alert
- New ParentPaymentsPage.jsx with full monthly detail table accessible via sidebar "Pagos" or "Ver detalle" button
- Seeded realistic payment data for 3 children (Pepito: 71%, Juan: 57%, Jorge: 20%) with different morosidad levels
- Added "Pagos" (Wallet icon) to ParentSidebar
- Child selector auto-updates all financial data

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
- **App URL**: https://parent-portal-v2.preview.emergentagent.com

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
