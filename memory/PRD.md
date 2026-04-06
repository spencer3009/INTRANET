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

## Key Modules
1. Authentication & Authorization (complete)
2. Dashboard (per-role, complete)
3. Users Management (complete)
4. Academic Years & Courses (complete)
5. Schedules (complete - proportional grid + horizontal)
6. Attendance (complete)
7. Discipline (complete)
8. Grades/Consolidado (complete)
9. OMR Exams (complete)
10. Subscriptions & Billing (complete)
11. Internal Messaging (complete)
12. Teacher Portal (complete)
13. Student Portal (complete)
14. Parent Portal (complete)
15. **Psychology Module - Phase 1** (COMPLETE - April 6, 2026)

## What's Been Implemented

### Psychology Module - Phase 1 (April 6, 2026)
- **New Role**: `psicologo` added to ROLE_HIERARCHY, STAFF_ROLES, SECTION_PERMISSIONS
- **Backend CRUD**: Full API at `/api/v1/psychologists/*` and `/api/v1/psychology/*`
  - Psychologist management (create, list, update, deactivate)
  - Self-profile management
  - Student listing (read-only, no financial data)
  - Psychological records (create, view, update per student)
  - Clinical sessions (full CRUD with audit logging)
  - Dashboard statistics
- **Frontend Portal**: 5 dedicated pages
  - `PsicologiaDashboardPage` - Stats + navigation cards
  - `PsicologiaEstudiantesPage` - Student list with search/filters
  - `PsicologiaFichaPage` - Individual student record + sessions with create/edit modals
  - `PsicologiaSesionesPage` - All sessions history
  - `PsicologiaPerfilPage` - Self-profile editing
- **Routing**: Login redirects psicologo to `/psicologia`, routes for both subdomain and direct modes
- **UsersPage**: "Psicologos" card added (violet theme) with role count
- **Audit Log**: Automatic logging of record views, creates, and edits

### Previous Implementations
- Subscription blocking fix (day 3 enforcement + director role support)
- OMR Exam UI improvements (edit button, date ordering, 1h default window)
- Schedule multi-teacher toggle (allows professor overlap)
- Calendar grid refactor (proportional Google Calendar style)
- TimePicker bug fix (type="button" for form buttons)

## Prioritized Backlog

### P0 (Next)
- None currently blocking

### P1
- Psychology audit log UI (view who accessed which clinical record)
- Dashboard Owner with real metrics
- Enrollment module ("Matriculas")

### P2
- Refactor CourseDetailPage.jsx (>11,000 lines)
- Survey module ("Encuestas") at /{subdomain}/encuestas
- Performance optimization for mass exam loading (3000 students, DB indexes)

## DB Schema (Psychology)
- `users` collection: `role: "psicologo"` with `psychologist_profile` subdocument
- `psychological_records`: One per student, contains reason, observations, diagnosis, status
- `psychological_sessions`: Multiple per student, contains session_type, notes, agreements, etc.
- `psychology_audit_log`: Tracks psychologist access to clinical records

## Test Accounts
See /app/memory/test_credentials.md
