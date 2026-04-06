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

### Psychology Phase 5: Agenda & Workshops (April 6, 2026)
- **Backend** (`/app/backend/routes/psychology_agenda.py`):
  - Collection `psychological_appointments` with full CRUD + recurrence support
  - Collection `psychological_workshops` with CRUD, attendance tracking, completion flow
  - Endpoints: appointments (list, today, week-summary, check-conflict, get, create, update, status, delete)
  - Endpoints: workshops (list, upcoming, get, create, update, attendance, complete, delete)
  - MongoDB indexes for psychologist_id, date, institution_id
- **Frontend**:
  - `PsicologiaAgendaPage.jsx` - Google Calendar-style weekly view with Day/Week/Month switcher
    - Appointment blocks with color-coded types, click-to-view detail
    - Create/Edit modal with conflict detection, student search, recurrence options
    - Detail popup with Edit, Complete, Cancel, No-show, Delete actions
    - Auto-navigate to student clinical record after completing appointment
  - `PsicologiaTalleresPage.jsx` - Workshop management with card grid
    - Filter tabs: Todos, Planificados, Completados, Cancelados + category filter
    - Create/Edit modal with objectives list, methodology, target level/grades
    - Detail view with attendance tracking (checkbox per student) and completion form
  - `PsicologiaDashboardPage.jsx` updated with:
    - "Agenda" nav card with today's appointment count badge
    - "Talleres Grupales" nav card
    - "Citas de Hoy" section with real-time appointment data
    - "Proximos Talleres" section with upcoming workshops
  - Routes registered in `App.js` for both direct and /:subdomain/ patterns
- **Testing**: 20/20 backend tests passed, frontend 100% verified (iteration_108)

### Psychology Phase 2: Messaging (April 6, 2026)
- Backend: 10 endpoints for psychologist + 4 for parent messaging
- Frontend: Email inbox-style layout, templates, read receipts
- Testing: 24/24 tests passed (iteration_107)

### Psychology Phase 1 (April 6, 2026)
- Role `psicologo` with CRUD, dashboard, student list, records, sessions, audit log
- Testing: 100% passed (iteration_106)

## DB Schema
- `psychological_appointments`: id, psychologist_id, institution_id, title, appointment_type, date, duration_minutes, student_id, parent_id, location, description, status, recurrence_type, recurrence_group_id, notes_post
- `psychological_workshops`: id, psychologist_id, institution_id, title, topic_category, description, date, duration_minutes, target_level, target_grades, target_sections, location, objectives, methodology, expected_attendees, actual_attendees, attendee_list, status, observations, outcomes
- `psychological_messages`: conversation_id, from/to roles, body, read, attachments
- `message_templates`: name, subject, body with placeholders, category, is_shared

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
