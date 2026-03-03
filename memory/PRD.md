# EduNet - PRD

## Original Problem Statement
EduNet: Plataforma educativa para colegios peruanos. Full-stack: FastAPI + React + MongoDB.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) | Frontend: React | DB: MongoDB | Images: Cloudinary

## What's Been Implemented

### Session - March 3, 2026 (Latest)
- **CRITICAL BUG FIX: Student Course Visibility (P0)**: Fixed data leakage where students saw wrong courses. Root cause: endpoints used `academic_assignments` (stale pre-refactor data) instead of `subjects` collection (source of truth with `section_id`). Fixed 6 endpoints: `get_student_courses`, `get_student_tasks`, `get_student_dashboard`, `get_parent_student_courses`, `get_parent_student_tasks`, `get_parent_dashboard`.
- **DATA MIGRATION**: Migrated 12 old subjects (without `section_id`) to have correct `section_id` based on their `academic_assignments`. Deduplicated 1 empty duplicate "Matemáticas" subject. Owner and student views now consistent (8 subjects for Pepito's section).

### Previous Session - March 3, 2026
- **Photo Upload Modal with Preview**: Camera icon opens modal with drag-and-drop, preview, Save/Cancel
- **Grade Name Structural Validation**: Dropdown fijo para Inicial/Primaria/Secundaria, validación anti-sección
- **Auto-Grade Creation**: Checkbox al crear nivel genera grados estándar automáticamente
- **Smart Filtering**: Dropdowns filtran grados existentes y niveles completos, botón "Agregar" se oculta
- **Subjects to Section-Based Structure (P0 MAJOR)**: Asignaturas ahora pertenecen a Secciones.

### Older Sessions
- Default IGV, Navigation Bug Fix, Student Photos in Income, Demo User Cleanup
- Combined Payment, Read-Only Amounts, Demo User Switch Restriction
- Pending Student Academic Exclusion, Data Integrity on Deletion, UI Readability

## Prioritized Backlog

### P0
- Verify "Disappearing Student Selection" bug in PaymentFormModal
- Modularize `server.py` into FastAPI routers (CRITICAL tech debt - 22K+ lines)

### P1
- Apply Intelligent Filters to Parents View
- Parent Portal Feature Parity
- Matriculas module
- Automatic notifications for students
- Question Bank for Exams

### P2
- Cache Invalidation for `/api/student/tasks`
- Replace window.confirm/alert with custom modals
- Fix hardcoded Dashboard data (Asistencia del Mes, Noticias y Avisos)
- Message Center unread count discrepancy

## Key Technical Note
**Source of Truth for Student Courses**: The `subjects` collection filtered by `section_id` is the canonical source. The `academic_assignments` collection should ONLY be used for teacher assignment lookups, NOT for determining which subjects belong to a section.

## Key Files
- `/app/backend/server.py` - Main backend (22K+ lines)
- `/app/frontend/src/pages/Subjects/SubjectsPage.jsx` - Subjects management (section-based)
- `/app/frontend/src/pages/Settings/CourseStructure.jsx` - Academic settings

## Test Credentials
- **Support**: spencer3009@gmail.com / 1234abc8
- **Owner (elroble)**: admin@elroble.edu / 1234abc8 / subdomain=elroble
- **Owner (demosettings)**: proyectemos@gmail.com / 1234abc8 / subdomain=demosettings
- **Student (Pepito)**: pepito@gmail.com / 1234abc8 / subdomain=elroble
