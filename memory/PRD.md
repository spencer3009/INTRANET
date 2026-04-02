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

### YouTube Support for Study Materials (April 2026)
- Toggle "Archivo / YouTube" in material upload modal (`CourseDetailPage.jsx`)
- YouTube URL input with real-time preview iframe
- Backend stores `tipo_material`, `url`, `video_id` fields in `course_posts`
- Material list shows compact row with play button for YouTube items
- Popup modal for video playback (no external YouTube redirect)
- Students can view YouTube materials in their portal with popup player

### YouTube Support for Tasks (April 2026)
- Toggle "Archivo / YouTube" in task creation modal (`PremiumTaskModal`)
- Backend accepts YouTube fields for `post_type=task`
- Task detail view (professor) shows embedded YouTube iframe
- Student task detail view shows embedded YouTube iframe
- Student material list shows YouTube items with play button + popup

### Topico Module — Health & Wellness (April 2026)
- Backend: `/app/backend/routes/health.py` with full CRUD for `topico_records` collection
- Endpoints: GET/POST `/api/health/topico`, GET/PUT/DELETE `/api/health/topico/{id}`, GET `/api/health/topico/student/{student_id}`
- Frontend: `/app/frontend/src/pages/TopicoPage.jsx` with cascade filters (Grade → Section), student list, record modal (create/edit), detail modal, history tab
- Intermediate page: `/app/frontend/src/pages/HealthWellnessPage.jsx` with cards for Topico and Psicologia
- Routes: `/:subdomain/salud-bienestar`, `/:subdomain/salud-bienestar/topico`

### Psicologia Module — Health & Wellness (April 2026)
- Backend: Added to `/app/backend/routes/health.py` — full CRUD with soft delete for `psicologia_records`
- Endpoints: GET/POST `/api/health/psicologia`, GET/PUT/DELETE `/api/health/psicologia/{id}`, GET `/api/health/psicologia/student/{student_id}`
- Soft delete: `is_deleted` flag, excluded from all queries
- Frontend: `/app/frontend/src/pages/PsicologiaPage.jsx` — cascade filters, student list with alert/followup badges, record modal, detail modal, history tab with color-coded alert levels
- Routes: `/:subdomain/salud-bienestar/psicologia`

## Recently Completed (March-April 2026)

### Demo Access Photo/Logo Upload (March 31)
- 2 new endpoints: profile-photo and logo upload to Cloudinary
- Frontend AccessRow: clickable avatar/logo with hover overlay

### Demo User 403 Fix + Debug Logging (March 31)
- Added explicit bypass in `require_section_access` and `require_role` for demo users

### QR Continuous Scanner (March 31)
- Refactored QRScannerTab.jsx to eliminate pause, added anti-duplicate cache (30s)

### Mass Excel Import Fixes (March 31)
- Handle openpyxl datetime objects and gender normalization
- Duplicate emails allowed for students (siblings use parent email)

### Demo Management System (March 31)
- Backend: 7 endpoints for clone, delete, access management
- Frontend: SupportDemosPage.jsx with full UI

## Pending Issues

### P1: Production Verification
- Multiple fixes deployed awaiting user verification in edunet.pe

### P2: Orphan Collection Cleanup
- DELETE school leaves ~15 collections orphaned
- Awaiting user approval to implement

## Upcoming Tasks
- P1: Refactor Message Pages (consolidate duplicates)
- P2: Visual indicator of sync_status in Exams/Tasks
- P2: Gradebook: Export PDF/Excel, Lock/Close Period
- P2: Double scrollbar fix in "Registro Auxiliar"

## Future/Backlog
- Vinculacion Masiva Inteligente (Phase 2 Parent Import)
- Dashboard Owner with real data
- Matriculas (Enrollments) module
- Replace window.confirm/alert with custom modals

## Refactoring Needed
- CourseDetailPage.jsx (>10,000 lines) - split into sub-components
- UsersPage.jsx (>5000 lines) - split into sub-components

## Key Endpoints
- `POST /api/course/{subject_id}/posts` - Create post (task/material/forum) with YouTube support
- `GET /api/course/{subject_id}/posts?post_type=material` - List materials (includes tipo_material, url, video_id)
- `POST /api/support/demo/clone` - Clone school for demo
- `POST /api/auth/login` - Login with email+password

## Key DB Schema
- `course_posts`: {tipo_material (archivo/youtube), url, video_id, post_type (task/material/forum)}
- `attendances`: {method, grade_id, section_id}
- `users`: {birthday, gender (male/female), photo_url, profile_photo_url}

## 3rd Party Integrations
- Cloudinary (image hosting) - Emergent managed keys
- ChatterPal v8.5 (video avatar widget) - External script
- Vimeo (video hosting) - External URL embed
- @yudiel/react-qr-scanner (QR Reader)

## Test Credentials
- School: elroble
- Email: admin@elroble.edu
- Password: 1234abc8
- Support: spencer3009@gmail.com / Socios3009
