# EduNet - PRD

## Original Problem Statement
Plataforma de gestion escolar (React + FastAPI + MongoDB) para el Colegio El Roble. Incluye modulos de usuarios, asignaturas, horarios, asistencia, examenes, tareas, contabilidad, mensajeria y panel de padres.

## Architecture
- **Frontend**: React (CRA) + Shadcn/UI + Tailwind CSS
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Integrations**: Google Drive, Firebase FCM, Cloudinary, YouTube oEmbed API

## What's Been Implemented
- [x] Full auth system with roles (owner, admin, teacher, student, parent)
- [x] Academic structure (grades, sections, subjects, schedules)
- [x] Attendance with QR scanning
- [x] Exams module with gradebook linkage (EM/EB/P1/P2/P3)
- [x] Tasks module with gradebook linkage (P1/P2/P3 only)
- [x] Unified `register_column_assignments` for mutual exclusivity
- [x] Auto-zero crons for expired exams and tasks
- [x] Accounting: Payments, expenses, financial configuration
- [x] **Sistema de Descuentos y Pensiones Variables** (FULL)
- [x] **Academia Phase 1**: Support panel CRUD (categories, subcategories, YouTube videos)
- [x] **Academia Phase 2**: Portal read-only view for school users
- [x] **Academia Portal Corrections (Mar 22, 2026)**: Layout fix + Premium redesign (navy+gold branding)
- [x] **Academia Share**: Share button on portal video cards and support panel cards
- [x] **Dashboard**: "Centro de Ayuda (Videos Tutoriales)" with graduation cap icon
- [x] **Importacion Masiva de Padres v3.0 (Mar 22, 2026)**: FULL implementation
  - Backend: Template generation (2 sheets), import with auto-merge, credentials CSV, pending CRUD
  - Frontend: Import card, drag-drop modal, progress bar, result summary, pending management
  - Testing: 100% backend (15/15) + frontend verified (iteration_93)
- [x] **Vimeo Support in Academia (Mar 22, 2026)**: Platform toggle, auto-detection, oEmbed extraction
- [x] **Export Student Credentials (Mar 22, 2026)**: Excel export with 4-filter validation (Level, Grade, Section, Shift)
- [x] **Student Password View/Edit in Edit Modal (Mar 23, 2026)**: 
  - Frontend: Password field with Eye/EyeOff toggle, reconstructed from DNI or "123456", amber styling, only for students
  - Backend: PUT /api/users/{user_id} accepts password field, hashes and saves plain_password
  - Testing: 100% backend (4/4) + 100% frontend verified (iteration_94)
- [x] **Fix: Nombre colegio en tarjeta soporte (Mar 23, 2026)**: 
  - Backend: GET /support/schools ahora usa owner.school_display_name sobre school.name
  - Backend: PUT /support/school-owner sincroniza school_display_name a schools.name

## Key DB Collections (new)
- `import_pending`: Stores errored rows from bulk imports (type: "parent" or "student")
- `import_credentials`: Stores generated credentials per batch for download

## Key API Endpoints (new)
- `GET /api/parents/template` — Download Excel template
- `POST /api/parents/import` — Bulk import parents
- `GET /api/parents/import/{batchId}/credentials` — Download credentials CSV
- `GET /api/parents/pending` — List pending parents
- `POST /api/parents/pending/{id}/activate` — Activate pending parent
- `PUT /api/parents/pending/{id}` — Edit pending parent
- `DELETE /api/parents/pending/{id}` — Delete pending parent

## Pending Issues
- **P1**: Inconsistent Subject List between pages
- **P1**: Incomplete Payment Verification Flow
- **P2**: Hardcoded Owner Dashboard Data

## Upcoming Tasks
- P1: Refactor duplicate Message pages
- P2: Visual sync_status indicator in Exams/Tasks
- P2: Gradebook enhancements (Export PDF/Excel, Lock Period)
- P2: Double scrollbar fix in "Registro Auxiliar"

## Future Tasks
- Complete Parent Portal feature parity
- Build "Matriculas" module
- Question Bank for Exams
- Replace window.confirm/alert with custom modals
- Vinculacion Masiva Inteligente (Phase 2 of parent import)

## Test Credentials
- **Support**: spencer3009@gmail.com / Socios3009
- **Owner**: admin@elroble.edu / 1234abc8 (subdomain: elroble)

## Test Reports
- /app/test_reports/iteration_89.json (Discounts - 100%)
- /app/test_reports/iteration_90.json (Academia Phase 1 - 100%)
- /app/test_reports/iteration_91.json (Academia Phase 2 - 100%)
- /app/test_reports/iteration_92.json (Academia Portal Corrections - 100%)
- /app/test_reports/iteration_93.json (Parent Bulk Import - 100%)
- /app/test_reports/iteration_94.json (Student Password Edit - 100%)
