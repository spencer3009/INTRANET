# EduNet - School Management Platform PRD

## Original Problem Statement
Full-stack React + FastAPI + MongoDB school management platform for Peruvian schools. Features include academic structure management, attendance, grading, teacher assignments, accounting, messaging, and more.

## Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Hosting**: Emergent Platform (preview) / Production at edunet.pe

## What's Been Implemented

### Core Academic Structure
- Levels (INICIAL, PRIMARIA, SECUNDARIA), Grades, Sections, Section Types
- Academic Years with status management
- Subjects CRUD with section-level granularity
- Teacher Assignments to subjects/sections

### Authentication & Users
- JWT-based auth with school subdomains
- Roles: owner, admin, director, teacher, parent, student
- Custom login page with backgrounds (Cloudinary), WhatsApp support link
- Public registration blocked

### Attendance Module
- Flexible ID filtering (handles String + ObjectId mismatches)
- QR Continuous Scanner (turnstile-mode) with anti-duplicate cache (30s cooldown)
- Production-ready with normalized IDs

### Accounting Module
- Income/Expenses tracking
- Morosos (debtors) inline tab with redesigned UI
- Financial settings with ON_CREATE student activation

### Teacher Assignments
- Full CRUD for teacher-subject-section assignments
- Cascade filter modal (Level > Grade > Section > Subject)
- Teachers summary sidebar

### YouTube Support for Study Materials & Tasks (April 2026)
- Toggle "Archivo / YouTube" in material/task upload modals
- YouTube URL input with real-time preview iframe
- Backend stores tipo_material, url, video_id fields
- Popup modal for video playback (no external YouTube redirect)

### Health & Wellness Module (April 2026)
- Topico & Psicologia CRUD with soft delete
- Dynamic permissions (owner/admin/teacher toggles)
- Parent alerts with fullscreen modal (HealthAlertPopup)
- Parent read-only view at /parent/salud-bienestar
- School logo in all portals
- Student photo + full name in modals

### Attendance Notification System (April 2026)
- WebSocket real-time push notifications
- NotificationBell attendance tab
- AttendanceToast component
- MongoDB indices with TTL 30 days

### OMR Exam Integration — Phase 1 (April 2026) - COMPLETED
- **Backend**: Extended `online_exams` collection with `type` field (`digital`/`omr`), `num_questions`, `options_per_question`, `answer_key`, `points_per_question` fields
- **Backend**: Validation logic for OMR (skip date validation, require answer_key format)
- **Frontend (Teacher portal)**: ExamsContent.jsx updated with type selector, OMR fields, AnswerKeyEditor component
- **Frontend (Owner portal)**: CourseDetailPage.jsx ExamModal updated with type selector (Digital/OMR), OMR-specific fields, conditional buttons (CONFIGURAR CLAVE vs GESTIONAR PREGUNTAS), AnswerKeyEditor integration in ExamDetailView
- **AnswerKeyEditor.jsx**: Interactive bubble grid for configuring answer keys with progress bar, save/clear functionality
- Tested 100% on both backend (pytest) and frontend (automated browser testing)

## Pending Issues

### P2: Double scrollbar in "Registro Auxiliar"
### P2: Orphan Collection Cleanup (DELETE school leaves ~15 collections orphaned)

## Recently Completed (April 2026)
- OMR Exam UI integration in Owner portal (CourseDetailPage.jsx)
- OMR Exam backend support in exams.py
- AnswerKeyEditor bubble grid component
- Buscador en pestaña Padres (UsersPage)
- Sistema de Papelera para Colegios
- Fix Importacion Excel - Turno, Metadata, Validation
- Fix Bulk Delete
- Fix Dashboard Orphan count

## Upcoming Tasks
- P1: Refactor Message Pages (consolidate duplicates)
- P2: Visual indicator of sync_status in Exams/Tasks
- P2: Gradebook: Export PDF/Excel, Lock/Close Period
- P2: Create "Encuestas" page/module

## Future/Backlog
- Vinculacion Masiva Inteligente (Phase 2 Parent Import)
- Dashboard Owner with real data
- Matriculas (Enrollments) module
- Replace window.confirm/alert with custom modals

## Refactoring Needed
- CourseDetailPage.jsx (>10,000 lines) - split into sub-components
- UsersPage.jsx (>5000 lines) - split into sub-components

## Key Endpoints
- POST /api/course/{subject_id}/exams (supports type: "digital" and "omr")
- PUT /api/exams/{exam_id} (supports answer_key update for OMR)
- POST /api/students/bulk-safe-delete
- PATCH /api/support/schools/{id}/archive
- GET/PUT /api/settings/health-permissions
- GET/POST/PUT/DELETE /api/health/topico
- GET/POST/PUT/DELETE /api/health/psicologia

## Key DB Schema
- `online_exams`: Extended with optional `type`, `num_questions`, `options_per_question`, `answer_key`, `points_per_question`
- `topico_records`: health records with parent_notified
- `psicologia_records`: health records with soft delete

## 3rd Party Integrations
- Cloudinary (image hosting)
- ChatterPal v8.5 (video avatar widget)
- Vimeo (video hosting)
- @yudiel/react-qr-scanner (QR Reader)

## Test Credentials
- School: elroble
- Owner: admin@elroble.edu / 1234abc8
- Parent: maria.peres@gmail.com / Test1234!
- Support: spencer3009@gmail.com / Socios3009
- Teacher: sonia3009@gmail.com / teacher123
