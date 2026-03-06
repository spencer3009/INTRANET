# EduNet - PRD

## Original Problem Statement
EduNet: Plataforma educativa para colegios peruanos. Full-stack: FastAPI + React + MongoDB.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) | Frontend: React | DB: MongoDB | Images: Cloudinary

## What's Been Implemented

### Session - March 6, 2026 (Fork 4 - Latest)

#### Feature: Attendance Entry/Exit Architecture Preparation (P0) - COMPLETED
- **Backend verificado:** Campos `entry_time`, `exit_time`, `total_minutes`, `method` ya existían y funcionan correctamente
- **QR Scanner UX mejorada:** Muestra "Entrada registrada" / "Salida registrada" con badge de rol (Profesor/Estudiante), y "Total trabajado: Xh Ym" cuando hay salida
- **Historial filtrado:** QR history se filtra por contexto (estudiantes/profesores) según sección de origen
- **Reportes Profesores:** Nueva vista con filtros de fecha, tabla detallada por profesor, tarjetas resumen, y exportar PDF
- **Compatibilidad:** Sin cambios en flujos existentes ni reportes actuales
- Testing: 100% passed (10/10 backend, all UI verified - iteration_73.json)

#### Feature: Attendance Module Redesign (P0) - COMPLETED
- **New UI Layout:** 3 clear sections (Estudiantes, Profesores, Reportes) with sub-actions
  - Each section: "Escanear QR" + "Marcar Manual" buttons
  - Shared smart QR scanner detects student vs teacher automatically
  - Status legend with consistent colors: Presente (green), Tardanza (amber), Ausente (red), Justificado (blue), Pendiente (gray)
- **QR Scanner:** Shows role badge ("Profesor" / "Estudiante") in scan results + history
- **Backend:** QR history endpoint now returns both student AND teacher scan records with `role` field
- **"Justificado" status** added to student attendance (was only for teachers before)
- Back button returns to landing from any sub-view
- Testing: 100% passed (7/7 backend, 14/14 frontend - iteration_72.json)

#### Feature: Teacher QR Code System (P0) - COMPLETED
- **Backend:** Auto-generates `qr_token` (type: `teacher_qr`) when creating a teacher via `POST /api/users`
- **Startup Migration:** Generates QR tokens for all existing teachers without one (51 teachers migrated)
- **QR Scanner:** `POST /api/attendance/qr/scan` now accepts both `student_qr` and `teacher_qr` types for attendance
- **QR Generate Endpoint:** `POST /api/attendance/qr/generate` now generates tokens for both students AND teachers
- **Frontend:** TeacherQRCard component with school name, photo, "PROFESOR" label, QR code, Download/Print buttons
- **Frontend:** "Ver QR" option in teacher 3-dot menu in UsersPage.jsx, opens dedicated modal
- Testing: 100% passed (8/8 backend, 7/7 frontend - iteration_71.json)

#### Feature: Dashboard Quick Action Buttons (P0) - COMPLETED
- Added 3 prominent navigation buttons to Owner and Admin dashboards: **Noticias**, **Eventos**, **Encuestas**
- Buttons placed prominently right below KPI cards (Owner) / stats grid (Admin)
- Navigate to existing pages: `/noticias`, `/calendario`, `/encuestas`
- Removed "Noticias", "Calendario", "Encuestas" links from Owner sidebar (`Sidebar.jsx`)
- Each button has hover animation (colored top border slide-in) and icon color transition
- Student, Teacher, Parent dashboards remain unchanged
- Testing: 100% passed (18/18 tests - iteration_70.json)

### Session - March 6, 2026 (Fork 3)

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
- **Sidebar z-index fix**: All sidebars use z-[201] to appear above header
- **Sidebar readability**: Font size 0.95rem, icons 22px, padding 12px 14px

#### Feature 3: Mobile QR Direct Access (P0) - COMPLETED
- When accessing Attendance page with `?tab=qr-scanner` on mobile:
  - Green "Asistencias" banner is hidden (hidden lg:block)
  - Tab bar is hidden (hidden lg:flex)
  - QR scanner shows directly below header
- Applied to both AttendancePage and TeacherAttendancePage

#### Feature 6: Pendientes de Importacion (P0) - COMPLETED
- **Backend**:
  - `GET /api/students/pending` - Lists students with import_status=pending
  - `PUT /api/students/pending/{id}/edit` - Edit pending student data, auto-validates DNI/email uniqueness, auto-activates if no errors remain
  - `DELETE /api/students/pending/{id}` - Remove pending student
- **Frontend**: 
  - "Pendientes" button (amber) in Excel import block opens modal
  - Modal shows all pending records with error badges (red), edit/delete buttons
  - Inline edit form: Nombre, Apellido, DNI, Correo, Celular, Genero (select), Cumpleanos (date), Direccion
  - "Guardar y Activar" auto-activates if errors fixed
  - Empty state: "No hay registros pendientes"
- **Testing**: Backend 100% (10/10), Frontend 100% (iteration_69.json)

#### Feature 5: Mass Student Import from Excel/CSV (P0) - COMPLETED + ENHANCED
- **Backend**: Professional Excel template with protected cells, hidden metadata, data normalization
- **Frontend**: Multi-step modal for file management with mismatch detection
- **Testing**: Backend 100% (9/9), Frontend 100% (iteration_68.json)

#### Feature 4: Replicate Subjects Between Sections (P0) - COMPLETED

### Previous Sessions (Summary)
- Attendance Entry/Exit Module with QR
- Course Visibility fixes (8+ endpoints)
- Autocomplete with images in Assign Teacher modal
- Payments module overhaul (sync, fallbacks, case-insensitive queries)
- Interest/discount calculations, Parent dashboard attendance card
- Photo Upload Modal, Grade Validation, Smart Filtering

## Prioritized Backlog

### P0
- Dashboard Widgets Phase 2: Backend CRUD for news, events, surveys collections
- Modularize `server.py` into FastAPI routers (CRITICAL tech debt - 10K+ lines)

### P1
- Verify "Disappearing Student Selection" bug in PaymentFormModal
- Attendance: Settings for schedule/lateness configuration
- Parent Portal Feature Parity, Matriculas module
- Exams module - Question Bank

### P2
- Remove hardcoded data from Owner Dashboard ("Asistencia del Mes", "Noticias y Avisos")
- Fix Message Center unread count discrepancy
- Replace window.confirm/alert with custom modals
- Refactor NewPaymentModal.jsx (1400+ lines)
- Attendance Notifications to parents

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
