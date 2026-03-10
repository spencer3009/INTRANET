# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is a full-stack educational intranet platform (React + FastAPI + MongoDB) for schools in Peru. It provides modules for managing users, courses, grades, attendance, payments, messaging, live classes, and more. The platform supports multiple roles: Owner, Admin, Teacher, Student, and Parent.

## Core Architecture
- **Frontend:** React 18 + Tailwind CSS + Shadcn/UI + TipTap Editor
- **Backend:** FastAPI (Python) + MongoDB
- **Auth:** JWT-based authentication with role-based access
- **3rd Party:** Cloudinary (images), Google Drive integration, pandas/openpyxl for reports

## Credentials
- Owner: admin@elroble.edu / 1234abc8 (subdomain: elroble)

## What's Been Implemented

### Completed Features
1. **Landing Page** - Full production-matching landing page with hero, 18-feature grid, footer
2. **Live Classes Module** - Full CRUD for virtual classes with Meet/Zoom links, attendance tracking, role-based views (Teacher/Student/Admin pages), sidebar integration, course detail integration
3. **Massive Broadcast Communication System** (March 2026)
   - Permission system: Owner always has broadcast permission, Admin configurable via settings
   - Settings toggle: "Comunicados Institucionales" section in Settings page for owner
   - Compose modal enhancement: Broadcast toggle with role checkboxes (Profesores, Alumnos, Padres, Administradores)
   - Recipient count preview before sending
   - Background job for creating receiver records
   - Comunicados folder in Messages page with special COMUNICADO tag styling
   - Broadcast detail view with read statistics (Enviados/Leidos/Pendientes)
   - Mandatory popup (BroadcastPopup) on all dashboards for unread broadcasts
   - Dashboard banner (BroadcastBanner) for unread broadcasts
   - NotificationBell integration showing broadcast count
   - Broadcast inbox for receivers with read/unread status

### API Endpoints - Broadcast Module
- `GET /api/broadcast/permission` - Check broadcast permission
- `GET /api/broadcast/recipients-count` - Get recipient counts by role
- `POST /api/broadcast/send` - Send broadcast (background task)
- `GET /api/broadcast/sent` - Get sent broadcasts with stats
- `GET /api/broadcast/unread` - Get unread broadcasts for user
- `POST /api/broadcast/{id}/read` - Mark broadcast as read
- `GET /api/broadcast/{id}/stats` - Get read statistics
- `GET /api/broadcast/inbox` - Get broadcast inbox for receivers

### DB Collections - Broadcast Module
- `broadcast_messages`: id, school_id, subject, body, target_roles, sender_id, sender_name, sender_role, sender_photo, total_recipients, read_count, message_type, priority, status, created_at
- `broadcast_receivers`: id, message_id, user_id, school_id, read_at, created_at

## Prioritized Backlog

### P0 (Critical)
- Modularize server.py into domain-specific routers (tech debt)

### P1 (High)
- Fix disappearing student selection in PaymentFormModal
- Remove hardcoded data from Owner Dashboard (recurring issue)
- Fix Message Center unread count discrepancy (recurring issue)
- Dashboard Widgets Phase 2 (news, events, surveys CRUD)
- Attendance Configuration Phase 2

### P2 (Medium)
- Complete Parent Portal feature parity
- Build "Matriculas" (Enrollments) module
- Enhance Exams module with Question Bank
- Replace window.confirm/alert with custom modals
- Refactor UsersPage.jsx (4000+ lines)
- Delete unused widget components (NewsWidget, CalendarWidget, SurveyWidget)

## Known Issues
- Owner Dashboard has hardcoded "Asistencia del Mes" and "Noticias y Avisos" data
- Message Center unread count may not match dashboard widget count
- PaymentFormModal student selection reportedly disappears after selection
