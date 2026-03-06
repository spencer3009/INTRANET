# EduNet - PRD

## Original Problem Statement
EduNet: Plataforma educativa para colegios peruanos. Full-stack: FastAPI + React + MongoDB.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) | Frontend: React | DB: MongoDB | Images: Cloudinary

## What's Been Implemented

### Session - March 6, 2026 (Fork 3 - Latest)
- **FEATURE: Mobile Bottom Nav for ALL Portals (P0)**: Implemented role-based mobile bottom navigation across all 5 portals:
  - **Parent & Student**: Inicio | Tareas | Cursos | Mensajes
  - **Owner, Admin & Teacher**: Inicio | Tareas | Cursos | Escanear QR
  - Added MobileBottomNav to 28+ pages (Student: 10 pages, Owner/Admin: 18+ pages)
  - Updated padding (`pb-20 lg:pb-6`) on all affected pages to prevent content overlap
  - Added `useSearchParams` support to AttendancePage for QR scanner tab deep linking
  - Nav is hidden on desktop (lg:hidden), visible on mobile only
  - **Testing: 95% passed (21/22) - 1 skipped due to stale teacher credentials**

### Session - March 3, 2026 (Fork 2)
- **BUG FIX: Parent Portal Attendance Times (P0)**: Fixed date filtering
- **UI: Calendar Split Design**: Entry/exit time display
- **FEATURE: Owner Reports Detail Modal**: Student attendance detail drawer
- **FEATURE: PWA WebView Detection**: Guides users to open in Chrome
- **FEATURE: Responsive Mobile-First (P0)**: Initial bottom nav for Parent/Teacher portals

### Session - March 3, 2026 (Fork 1)
- **ATTENDANCE ENTRY/EXIT MODULE (P0)**: Full entry/exit system with QR
- **BUG FIX: Course Visibility (P0)**: Fixed 8+ endpoints
- **BUG FIX: Edit Subject Modal**: Pre-selected values

### Previous Sessions
- Photo Upload Modal, Grade Validation, Auto-Grade Creation, Smart Filtering, Subjects-to-Section Refactor
- Autocomplete with images in Assign Teacher modal
- Payments module overhaul (sync, fallbacks, case-insensitive queries)
- Interest/discount calculations, Parent dashboard attendance card

## Prioritized Backlog

### P0
- Modularize `server.py` into FastAPI routers (CRITICAL tech debt - 22K+ lines)

### P1
- Verify "Disappearing Student Selection" bug in PaymentFormModal
- Attendance: Settings for schedule/lateness configuration
- Apply Intelligent Filters to Parents View
- Parent Portal Feature Parity, Matriculas module

### P2
- Remove hardcoded data from Owner Dashboard ("Asistencia del Mes", "Noticias y Avisos")
- Fix Message Center unread count discrepancy
- Attendance: Parent notifications on entry/exit
- Replace window.confirm/alert with custom modals
- Refactor NewPaymentModal.jsx (1400+ lines)

## Key Technical Notes
- **Source of Truth for Student Courses**: `subjects.section_id` is canonical
- **Attendance Entry/Exit**: Uses upsert in `attendances` collection
- **MobileBottomNav**: Role-based items in `/app/frontend/src/components/MobileBottomNav.jsx`
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
