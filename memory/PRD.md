# EduNet - PRD

## Original Problem Statement
EduNet: Plataforma educativa para colegios peruanos. Full-stack: FastAPI + React + MongoDB.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) | Frontend: React | DB: MongoDB | Images: Cloudinary

## What's Been Implemented

### Session - March 6, 2026 (Fork 3 - Latest)

#### Feature 1: Mobile Bottom Nav for ALL Portals (P0) - COMPLETED
- Role-based mobile bottom navigation across all 5 portals:
  - Parent & Student: Inicio | Tareas | Cursos | Mensajes
  - Owner, Admin & Teacher: Inicio | Tareas | Cursos | Escanear QR
- Added MobileBottomNav to 28+ pages (Student: 10 pages, Owner/Admin: 18+ pages)
- Updated padding (pb-20 lg:pb-6) to prevent content overlap
- Added useSearchParams to AttendancePage for QR scanner deep linking
- Testing: 95% passed (21/22)

#### Feature 2: Complete UI Unification (P0) - COMPLETED
- **Header Unificado**: DashboardHeader rewritten to match StudentHeader visual style
  - 2-row layout on mobile (controls + welcome text)
  - Inline welcome text on desktop
  - Support session banner and demo mode indicator preserved
  - z-index: 100 (consistent across all portals)
- **Tarjetas 2x2**: OwnerMetricCards and MetricCards now use grid-cols-2 on mobile
- **Sidebar z-index fix**: All sidebars (Owner, Teacher, Parent, Student) use z-[201] to appear above header
  - Overlay darkened to bg-black/30 for better visual separation
  - Sidebar width increased to 280px for better readability
- **Sidebar readability**: 
  - Font size increased to 0.95rem (15.2px)
  - Icons increased to 22px (from 20px)
  - Padding increased to 12px 14px (from 10px 12px)
  - Active state: font-weight 600
- Testing: 100% passed (19/19)

### Previous Sessions (Summary)
- Attendance Entry/Exit Module with QR
- Course Visibility fixes (8+ endpoints)
- Autocomplete with images in Assign Teacher modal
- Payments module overhaul (sync, fallbacks, case-insensitive queries)
- Interest/discount calculations, Parent dashboard attendance card
- Photo Upload Modal, Grade Validation, Smart Filtering

## Prioritized Backlog

### P0
- Modularize `server.py` into FastAPI routers (CRITICAL tech debt - 22K+ lines)

### P1
- Verify "Disappearing Student Selection" bug in PaymentFormModal
- Attendance: Settings for schedule/lateness configuration
- Parent Portal Feature Parity, Matriculas module

### P2
- Remove hardcoded data from Owner Dashboard ("Asistencia del Mes", "Noticias y Avisos")
- Fix Message Center unread count discrepancy
- Replace window.confirm/alert with custom modals
- Refactor NewPaymentModal.jsx (1400+ lines)

## Key Technical Notes
- **Header z-index**: 100 (via inline style)
- **Sidebar z-index**: 201 (above header when open on mobile)
- **Sidebar width**: 280px expanded, 72px collapsed
- **MobileBottomNav**: Role-based items, lg:hidden
- **Bottom Nav Routes**:
  - Owner: /dashboard, /asignacion-docente, /asignaturas, /asistencias?tab=qr-scanner
  - Student: /student, /student/tasks, /student/courses, /student/messages
  - Parent: /parent, /parent/tasks, /parent/courses, /parent/messages
  - Teacher: /teacher, /teacher/tasks, /teacher/courses, /teacher/attendance?tab=qr-scanner

## Test Credentials
- **Owner (elroble)**: admin@elroble.edu / 1234abc8 / subdomain=elroble
- **Student (Pepito)**: pepito@gmail.com / 1234abc8 / subdomain=elroble
- **Parent (Miguel)**: miguel@gmail.com / 1234abc8 / subdomain=elroble
- **Teacher (Jorge)**: jorge@gmail.com / 1234abc8 / subdomain=elroble
