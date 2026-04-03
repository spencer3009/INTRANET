# EduNet - School Management Platform PRD

## Original Problem Statement
Full-stack React + FastAPI + MongoDB school management platform for Peruvian schools. Features include academic structure management, attendance, grading, teacher assignments, accounting, messaging, and more.

## Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Hosting**: Emergent Platform (preview) / Production at edunet.pe

## What's Been Implemented

### Core Academic Structure
- Levels (INICIAL, PRIMARIA, SECUNDARIA), Grades, Sections, Section Types
- Academic Years with status management
- Subjects CRUD with section-level granularity
- Teacher Assignments to subjects/sections

### Authentication & Users
- JWT-based auth with school subdomains
- Roles: owner, admin, director, teacher, parent, student
- Custom login page with backgrounds (Cloudinary), WhatsApp support link
- Public registration blocked

### Attendance Module
- Flexible ID filtering (handles String + ObjectId mismatches)
- QR Continuous Scanner (turnstile-mode) with anti-duplicate cache (30s cooldown)
- Production-ready with normalized IDs

### Accounting Module
- Income/Expenses tracking
- Morosos (debtors) inline tab with redesigned UI
- Financial settings with ON_CREATE student activation

### Teacher Assignments
- Full CRUD for teacher-subject-section assignments
- Cascade filter modal (Level > Grade > Section > Subject)
- Teachers summary sidebar

### YouTube Support for Study Materials & Tasks (April 2026)
- Toggle "Archivo / YouTube" in material/task upload modals
- YouTube URL input with real-time preview iframe
- Backend stores tipo_material, url, video_id fields
- Popup modal for video playback (no external YouTube redirect)

### Health & Wellness — Conditional Access for Teachers & Admins (April 2026)
- Dynamic sidebar items in TeacherSidebar and AdminSidebar (appear only when permission enabled)
- Wrapper pages: TeacherTopicoPage, TeacherPsicologiaPage, AdminTopicoPage, AdminPsicologiaPage
- Intermediate pages: TeacherHealthPage, AdminHealthPage with access verification
- TopicoPage/PsicologiaPage refactored to accept renderSidebar, renderHeader, backPath props
- GET /api/settings/health-permissions now accessible to any authenticated user

### Health & Wellness Module — Tópico & Psicología (April 2026)
- Backend: `/app/backend/routes/health.py` with full CRUD for both collections
- Endpoints: GET/POST/PUT/DELETE for topico_records and psicologia_records
- Soft delete for psicologia_records (is_deleted flag)
- Intermediate page: HealthWellnessPage with cards for Tópico and Psicología
- Frontend pages: TopicoPage.jsx, PsicologiaPage.jsx with cascade filters

### Health & Wellness — Permissions System (April 2026)
- Dynamic permissions stored in schools collection: health_wellness_permissions
- Owner always has full access
- Admin/Director access controlled by admin_can_manage toggle
- Teacher access controlled by teacher_can_manage toggle
- Settings UI: 2 toggles in SettingsPage.jsx under "Permisos de Salud y Bienestar"
- Endpoints: GET/PUT /api/settings/health-permissions

### Health & Wellness — Parent Alerts (April 2026)
- parent_notified field (Boolean) added to topico_records and psicologia_records
- New records created with parent_notified=false
- HealthAlertPopup component on ParentDashboardPage
- Shows fullscreen modal for unacknowledged health records
- Two actions: "Enterado" (acknowledge) and "Ver información completa" (navigate)
- Alerts shown BEFORE BroadcastPopup (health is more urgent)
- Endpoints: GET /api/health/parent/alerts, POST /api/health/parent/alerts/{id}/acknowledge

### Health & Wellness — Parent Read-Only View (April 2026)
- ParentHealthPage at /parent/salud-bienestar
- Two tabs: Tópico and Psicología
- Read-only record list with detail modal
- ParentSidebar updated with HeartPulse icon menu item
- Endpoints: GET /api/health/parent/topico, GET /api/health/parent/psicologia
- Parent can only see their own children's records

### Health & Wellness — School Logo in All Portals (April 2026)
- All Health & Wellness pages now load school settings via `/api/settings/public/{subdomain}`
- Logo displayed in DashboardHeader/StudentHeader across all portals: Owner, Admin, Teacher, Parent
- Fixed pages: HealthWellnessPage (missing imports), AdminHealthPage (missing logoUrl prop), AdminTopicoPage & AdminPsicologiaPage (early return blocking settings load)

### Attendance Notification System (April 2026) - COMPLETED
- WebSocket real-time push from `send_attendance_notification()` via `ws_manager.send_to_user()`
- `NotificationBell` attendance tab fixed (roleLabel matching for "Padre/Apoderado")
- `AttendanceToast` component created for prominent in-app notifications (auto-managed via window events)
- MongoDB indices added for `parent_notifications` (parent_id+read, TTL 30 days)
- Parent-student linking verified (parent_id, parent_email, linked_students)
- Full e2e flow tested: QR scan → notification created → WebSocket push → parent sees in bell

### Health & Wellness — Modal: Full Name + Student Photo (April 2026)
- RecordModal in Tópico and Psicología now shows student's full name (first + last name) and photo
- Photo shown as circular avatar in modal header; falls back to initial letter if no photo

## Pending Issues

### P2: Double scrollbar in "Registro Auxiliar"
### P2: Orphan Collection Cleanup (DELETE school leaves ~15 collections orphaned)

## Recently Completed (April 2026)
- Buscador en pestaña Padres (UsersPage): filtrado por nombre, apellidos, DNI y email con indicador de resultados y estado vacío mejorado

## Upcoming Tasks
- P1: Refactor Message Pages (consolidate duplicates)
- P2: Visual indicator of sync_status in Exams/Tasks
- P2: Gradebook: Export PDF/Excel, Lock/Close Period
- P2: Create "Encuestas" page/module

## Future/Backlog
- Vinculacion Masiva Inteligente (Phase 2 Parent Import)
- Dashboard Owner with real data
- Matriculas (Enrollments) module
- Replace window.confirm/alert with custom modals

## Refactoring Needed
- CourseDetailPage.jsx (>10,000 lines) - split into sub-components
- UsersPage.jsx (>5000 lines) - split into sub-components

## Key Endpoints
- GET/PUT /api/settings/health-permissions - Health module permissions
- GET /api/health/parent/alerts?student_id={id} - Unacknowledged health alerts
- POST /api/health/parent/alerts/{id}/acknowledge - Mark alert as notified
- GET /api/health/parent/topico?student_id={id} - Parent topico history
- GET /api/health/parent/psicologia?student_id={id} - Parent psicologia history
- GET/POST/PUT/DELETE /api/health/topico - Topico CRUD
- GET/POST/PUT/DELETE /api/health/psicologia - Psicologia CRUD

## Key DB Schema
- `topico_records`: {institution_id, student_id, student_name, grade_id, section_id, date, time, incident_type, description, action_taken, status, responsible, parent_notified}
- `psicologia_records`: {institution_id, student_id, student_name, grade_id, section_id, date, time, record_type, reason, professional_observation, alert_level, requires_followup, status, responsible, is_deleted, parent_notified}
- `schools.health_wellness_permissions`: {admin_can_manage: Boolean, teacher_can_manage: Boolean}

## 3rd Party Integrations
- Cloudinary (image hosting) - Emergent managed keys
- ChatterPal v8.5 (video avatar widget) - External script
- Vimeo (video hosting) - External URL embed
- @yudiel/react-qr-scanner (QR Reader)

## Test Credentials
- School: elroble
- Owner: admin@elroble.edu / 1234abc8
- Parent: maria.peres@gmail.com / Test1234!
- Support: spencer3009@gmail.com / Socios3009
