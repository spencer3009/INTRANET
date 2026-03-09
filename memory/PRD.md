# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet es una plataforma de intranet escolar (SaaS) para colegios en Perú. Incluye gestión de usuarios, asistencia con QR, pagos, calificaciones, tareas, comunicación interna, y más.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) with MongoDB (Motor async)
- **Database**: MongoDB (`test_database`)
- **Timezone**: America/Lima (UTC-5)
- **3rd Party**: Cloudinary (images), pandas + openpyxl (reports)

## What's Been Implemented

### Core Modules (Pre-existing)
- Auth (JWT), User CRUD, School Config, Roles & Permissions
- Attendance with QR scanning
- Academic management (grades, sections, subjects, assignments)
- Payments module
- Tasks/assignments, Exams, Grades/report cards
- Internal messaging
- Parent portal
- Landing page (edunet.pe)

### Session: 2026-03-09 - Landing Page Sync + Live Classes Module

#### Landing Page Sync (Completed)
- Rebuilt landing page to match production (edunet.pe)
- 18 feature cards, footer, hero with phone mockup + registration form
- All CTAs point to WhatsApp, proper section order

#### Clases en Vivo Module (NEW - Completed)
**Backend Endpoints:**
- `POST /api/live-classes` - Create live class (teacher only)
- `GET /api/live-classes` - List with role-based filtering
- `GET /api/live-classes/{id}` - Detail
- `PUT /api/live-classes/{id}` - Update (teacher owner)
- `DELETE /api/live-classes/{id}` - Delete (teacher owner)
- `POST /api/live-classes/{id}/join` - Student joins + records attendance
- `GET /api/live-classes/{id}/attendance` - Attendance list

**Frontend:**
- `TeacherLiveClassesPage.jsx` - Full CRUD, attendance panel
- `StudentLiveClassesPage.jsx` - View + join classes
- Sidebar navigation added for both roles

**DB Collections:**
- `live_classes`: id, school_id, title, description, subject_id, section_id, teacher_id, date, start_time, end_time, meeting_link, platform, status
- `live_class_attendance`: id, school_id, class_id, student_id, status, join_time

**Testing:** 100% passed (22/22 backend, all frontend verified)

## Prioritized Backlog

### P1 - Bugs
- Fix disappearing student selection in PaymentFormModal
- Message Center unread count discrepancy

### P1 - Features
- Remove hardcoded data from Owner Dashboard (recurring 5+ times)
- Dashboard widgets Phase 2 (news, events, surveys CRUD)
- Attendance configuration (schedules)

### P2 - Tech Debt
- Modularize server.py into domain routers (CRITICAL)
- Refactor UsersPage.jsx (4000+ lines)
- Delete unused widget components

### P2 - Features
- Parent Portal parity
- Matrículas module
- Exam question bank
- Replace window.confirm/alert with custom modals

### P3 - Live Classes Enhancements (Future)
- Class recordings
- Class history reports
- Automatic reminders
- Calendar integration

## Test Credentials
- Owner: admin@elroble.edu / 1234abc8 (subdomain: elroble)
- Teacher Jorge: jorge@gmail.com / 1234abc8 (subdomain: demosettings)
- Teacher Julia: julia@gmail.com / 1234abc8 (subdomain: demosettings)
- Student Carlos: carlos234@gmail.com / 1234abc8 (subdomain: demosettings)
