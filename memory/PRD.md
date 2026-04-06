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

## What's Been Implemented

### Psychology Phase 2: Messaging (April 6, 2026)
- **Backend**: New file `/app/backend/routes/psychology_messages.py`
  - Collection `psychological_messages` with conversation grouping
  - Collection `message_templates` with category-based filtering
  - 10 endpoints for psychologist messaging (conversations, messages, templates CRUD)
  - 4 endpoints for parent messaging (list, view, reply, unread count)
  - Helper endpoint: GET student parents for "New Message" modal
  - Validation: parent-student linkage, school scope, role-based access
  - MongoDB indexes for conversation_id, to_user_id, institution_id
- **Frontend Psychologist**:
  - `PsicologiaMensajesPage.jsx` - Email inbox-style layout with left panel (conversations) and right panel (chat)
  - "Nuevo Mensaje" modal with student autocomplete search + parent selector
  - Templates modal with category filters, create inline, select/delete
  - Reply box with "Requiere respuesta", "Urgente", and "Plantilla" options
  - Read receipts (check/double-check icons)
  - Dashboard card "Comunicacion con Padres" with unread badge (polling every 60s)
- **Frontend Parent**:
  - `ParentPsychologyMessages.jsx` - Component for parent messaging view
  - `ParentPsychMessagesPage.jsx` - Page wrapper with parent layout
  - New "Psicologia" item in `ParentSidebar.jsx` with Brain icon
  - Routes: `/parent/psicologia-mensajes` and `/:subdomain/parent/psicologia-mensajes`
- **Testing**: 24/24 backend tests passed, frontend 100% verified

### Psychology Phase 1 (April 6, 2026)
- Role `psicologo` with CRUD, dashboard, student list, records, sessions, audit log
- 5 dedicated pages + routing

## DB Schema (Messaging)
- `psychological_messages`: conversation_id (psych+parent+student), from/to roles, body, read, attachments
- `message_templates`: name, subject, body with placeholders, category, is_shared

## Prioritized Backlog

### P0 (In Progress)
- Phase 5: Agenda/Calendario de sesiones (appointments collection + calendar UI)
- Phase 5: Talleres grupales (workshops collection + attendance + CRUD)

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
