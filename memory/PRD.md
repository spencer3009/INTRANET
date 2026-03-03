# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet es una plataforma educativa para colegios peruanos. Sistema full-stack con FastAPI + React + MongoDB.

## Core Requirements
- Gestión de usuarios por roles (Owner, Admin, Profesor, Estudiante, Padre)
- Gestión académica (Niveles, Grados, Secciones, Turnos)
- Sistema de contabilidad y pagos
- Mensajería interna
- Asistencia
- Exámenes
- Tareas
- Dashboard multi-rol

## Architecture
- Backend: FastAPI (`/app/backend/server.py`)
- Frontend: React (`/app/frontend/src/`)
- Database: MongoDB
- Image Storage: Cloudinary
- UI: Shadcn/UI + Tailwind CSS

## What's Been Implemented

### Session - March 3, 2026
- **Photo Upload Modal with Preview (DONE)**: Created `PhotoUploadModal.jsx`. Camera icon on user cards opens modal with drag-and-drop, image preview, Save/Cancel. Tested 15/15 pass.
- **Grade Name Structural Validation (DONE)**: 
  - INICIAL level: dropdown with preset grades (3, 4, 5 AÑOS) instead of free text
  - Other levels: text input with real-time validation blocking section-like patterns
  - Backend validation in both create and update grade endpoints
  - Helper text and warnings guide users to create sections separately
  - Tested: Backend 11/11 + Frontend all pass

### Previous Sessions
- Default IGV Setting (checkbox unchecked by default)
- Navigation Bug Fix (infinite render loop in Accounting page)
- Student Photos in Income Table
- Demo User & UI Cleanup (117 demo users removed)
- Combined Payment ("Matrícula + Mensualidad")
- Read-Only Payment Amounts
- Demo User Switch Restriction (support-only)
- 'Pending' Student Academic Exclusion (~20 endpoints)
- Data Integrity on Deletion (academic structures)
- UI Readability in Academic Settings

## Prioritized Backlog

### P0 (Critical)
- Test "Disappearing Student Selection" bug in payment modal

### P1 (High)
- Modularize `server.py` into FastAPI routers (CRITICAL tech debt)
- Apply Intelligent Filters to Parents View
- Complete Parent Portal Feature Parity
- Build "Matrículas" (Enrollments) module
- Implement automatic notifications for students
- Enhance Exams module with Question Bank

### P2 (Medium)
- Implement Cache Invalidation for `/api/student/tasks`
- Replace all `window.confirm` and `alert` with custom modals
- Fix hardcoded Owner Dashboard data (Asistencia, Noticias)
- Message Center unread count discrepancy

## Key Files
- `/app/backend/server.py` - Main backend (21K+ lines, needs modularization)
- `/app/frontend/src/pages/UsersPage.jsx` - Users management page
- `/app/frontend/src/components/PhotoUploadModal.jsx` - Photo upload modal with preview
- `/app/frontend/src/pages/AcademicSettingsPage.jsx` - Academic settings (levels, grades, sections)
- `/app/frontend/src/components/settings/CourseStructure.jsx` - Academic structure management
- `/app/frontend/src/components/Modals/PaymentFormModal.jsx` - Payment form

## Test Credentials
- **School Director**: email=admin.settings@test.pe, password=1234abc8, school=demosettings
- **Support**: email=spencer3009@gmail.com, password=1234abc8

## Known Issues
- `server.py` is 21K+ lines - critical tech debt
- Hardcoded data on Owner Dashboard (recurring 4+ times)
- Message Center unread count mismatch (recurring 4+ times)
