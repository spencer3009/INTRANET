# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
Build a comprehensive Educational Intranet Platform (EduNet) for schools in Peru. Multi-tenant SaaS with role-based access for owners, admins, teachers, students, and parents.

## Core Requirements
- Multi-tenant architecture with subdomains per school
- Role-based access control (RBAC) with 8 roles
- Messaging system with broadcasts, read receipts, pagination
- Academic management (levels, grades, sections, subjects, schedules)
- Attendance tracking with QR codes
- Online exams with question banks
- Accounting/payments module
- Parent portal
- Student portal
- Course feed with posts, tasks, submissions

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Database**: MongoDB
- **File Storage**: Cloudinary
- **Auth**: JWT tokens

## What's Been Implemented

### Completed (March 2026)
- [x] Full multi-tenant system with subdomains
- [x] Authentication (register, login, email verification)
- [x] RBAC with 8 roles + section permissions
- [x] Owner/Admin dashboard with metrics
- [x] User management + bulk student import (Excel)
- [x] Academic structure (levels, grades, sections, shifts, years, periods)
- [x] Schedule management (settings, breaks, entries)
- [x] Attendance module (student, teacher, QR)
- [x] Course feed (posts, tasks, submissions, comments, likes)
- [x] Messaging system (internal mail, legacy messages)
- [x] Broadcast communication system (mass announcements)
- [x] Read receipts for all messages
- [x] Pagination (6 per page) across all message pages
- [x] Online exams with questions and attempts
- [x] Google Drive integration for exams
- [x] Accounting module (payments, expenses, debtors)
- [x] Calendar, surveys, discipline, news modules
- [x] Parent portal
- [x] Student portal
- [x] Live classes module
- [x] Notification system (WebSocket)
- [x] Demo mode with restricted access
- [x] **server.py modularized** into 24 domain-specific router files
- [x] **Membership Renewal System**: Manual payment via Yape/Plin with QR codes. Owner submits payment request from dashboard, support confirms renewal (+30 days) from support panel. Includes audit logging, duplicate prevention, and role-based access control.
- [x] **Consolidado de Notas**: Faithful replica of Excel format with institutional header, academic context, subject columns (with area grouping support), frozen columns, summary calculations (PROMEDIO, PUNTAJE, ORDEN DE MÉRITO, TERCIO), footer statistics, Excel export, vertical subject headers for compact layout, and integrated into main intranet layout with Sidebar and DashboardHeader.

- [x] **Registro Auxiliar (GradeBookPage)**: Excel-like grade entry with grouped headers, sub-columns, weighted averages, auto-save
### Backend Modularization (March 11, 2026)
server.py (24K lines) split into:
- `routes/core.py` - Shared dependencies, auth, RBAC, helpers
- `routes/auth.py` - Authentication + school creation
- `routes/dashboard.py` - Dashboard metrics
- `routes/student_portal.py` - Student portal endpoints
- `routes/teacher_portal.py` - Teacher portal
- `routes/admin_portal.py` - Admin management
- `routes/system.py` - System/seed/demo
- `routes/settings.py` - Tenant settings
- `routes/users.py` - User CRUD + import
- `routes/academic.py` - Academic structure + assignments
- `routes/schedule.py` - Schedule management
- `routes/messages_legacy.py` - Legacy messaging
- `routes/attendance.py` - Attendance module
- `routes/calendar.py` - Calendar events
- `routes/surveys.py` - Surveys
- `routes/discipline.py` - Discipline reports
- `routes/news.py` - News module
- `routes/accounting.py` - Accounting/payments
- `routes/subjects.py` - Subjects
- `routes/courses.py` - Course feed + notifications
- `routes/messaging.py` - Internal mail system
- `routes/broadcast.py` - Broadcast communications
- `routes/exams.py` - Online exams + Google Drive
- `routes/parent_portal.py` - Parent portal
- `routes/live_classes.py` - Live classes

## Pending Issues (Prioritized)

### P0 - Critical
- [ ] Configure area groupings for subjects (area_name field) to enable full area-grouped headers in Consolidado
  
### P1 - High Priority
- [ ] Fix disappearing student selection in PaymentFormModal
- [ ] Refactor 4 duplicated message pages into single component
- [ ] Message center unread count discrepancy (dashboard vs message center)
- [ ] Gradebook Enhancements: export PDF/Excel, Lock/Close Period, admin override

### P2 - Medium Priority
- [ ] Remove hardcoded data from Owner Dashboard (recurring 5+ times)
- [ ] Dashboard Widgets Phase 2: CRUD for news, events, surveys
- [ ] Gradebook Enhancements: export PDF/Excel, Lock/Close Period, admin override

### P3 - Backlog
- [ ] Matrículas (Enrollments) module
- [ ] Exam Question Bank enhancements
- [ ] Replace window.confirm/alert with custom modals
- [ ] Refactor UsersPage.jsx (4000+ lines)
- [ ] Complete Parent Portal feature parity

## Key Database Collections
- `schools`, `users`, `user_school_roles`
- `academic_levels`, `academic_grades`, `academic_sections`
- `academic_years`, `academic_periods`, `academic_shifts`
- `academic_assignments`, `subjects` (now supports `area_name`, `area_order` for area grouping)
- `student_grades` (nested sub-grade structure + final_grade)
- `course_posts`, `task_submissions`
- `internal_mail`, `internal_messages`
- `broadcast_messages`, `broadcast_message_status`
- `attendances`, `student_attendance`
- `online_exams`, `exam_questions`, `exam_attempts`
- `payments`, `expenses`, `payment_concepts`
- `calendar_events`, `surveys`, `discipline_reports`, `news`
- `notifications`, `live_classes`

## Key API Endpoints (Grading Module)
- `GET /api/grades/register/{course_id}/{subject_id}/{period}` - Registro Auxiliar data
- `POST /api/grades/save` - Save detailed sub-grades
- `GET /api/grades/consolidated-report/{section_id}/{period_id}` - Consolidated report data
- `GET /api/grades/consolidated-report/{section_id}/{period_id}/export/excel` - Excel export

## Test Credentials
- **Subdomain**: elroble
- **Email**: admin@elroble.edu
- **Password**: 1234abc8
- **Role**: owner

## 3rd Party Integrations
- Cloudinary (image/file storage)
- Google Drive (exam file management)
- pandas + openpyxl (data analysis, Excel handling)
