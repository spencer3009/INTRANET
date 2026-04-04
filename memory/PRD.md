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

### Attendance Module
- QR Continuous Scanner with anti-duplicate cache (30s cooldown)
- Production-ready with normalized IDs

### Accounting Module
- Income/Expenses tracking, Morosos inline tab

### Teacher Assignments
- Full CRUD, cascade filter modal

### YouTube Support for Study Materials & Tasks

### Health & Wellness Module
- Topico & Psicologia CRUD with parent alerts

### Attendance Notification System
- WebSocket real-time push notifications

### OMR Exam Integration — Phase 1 (COMPLETED)
- Backend: Extended `online_exams` with `type`, `num_questions`, `options_per_question`, `answer_key`, `points_per_question`
- Frontend: ExamsContent.jsx + CourseDetailPage.jsx with type selector, AnswerKeyEditor

### OMR Exam — Phase 2: PDF Generation (COMPLETED April 2026)
- **Service**: `/app/backend/services/omr_pdf_generator.py` — ReportLab PDF generator with:
  - 4 alignment markers (8mm black squares at exact positions for future OpenCV scanning)
  - QR code with exam metadata (exam_id, num_questions, options)
  - Header fields (Nombre, Fecha, Seccion)
  - Exam title centered
  - Dynamic bubble grid (2 or 3 columns depending on num_questions)
  - Footer with EduNet branding
  - Returns PDF bytes + bubble_map (coordinate dictionary for each bubble in mm)
- **Endpoints**:
  - `POST /api/exams/{exam_id}/generate-omr-pdf` — Generates PDF, uploads to Cloudinary, saves URL + bubble_map in exam document
  - `GET /api/exams/{exam_id}/omr-pdf` — Returns PDF URL and generation date
- **Frontend**: OmrSheetCard component in ExamDetailView with:
  - "Generar Hoja de Respuestas" button (if no PDF)
  - "Descargar PDF" + "Regenerar" buttons (if PDF exists)
  - "DESCARGAR HOJA" button in exam listing for OMR exams with PDF
- **Fix**: `total_points` in `/full` endpoint now uses stored value for OMR (not calculated from questions)
- **Storage**: Cloudinary `edunet/omr-sheets` folder, `resource_type: raw`
- Tested 100% (9/9 backend tests, all frontend features verified)

## Pending Issues

### P2: Double scrollbar in "Registro Auxiliar"

## Upcoming Tasks
- P1: Refactor Message Pages (consolidate duplicates)
- P2: Visual indicator of sync_status in Exams/Tasks
- P2: Gradebook: Export PDF/Excel, Lock/Close Period
- P2: Create "Encuestas" page/module

## Future/Backlog
- OMR Phase 3: OpenCV scanning + bubble reading + grade registration
- Vinculacion Masiva Inteligente (Phase 2 Parent Import)
- Dashboard Owner with real data
- Matriculas (Enrollments) module
- Refactoring: CourseDetailPage.jsx (>10K lines), UsersPage.jsx (>5K lines)

## Key Endpoints
- POST /api/course/{subject_id}/exams (supports type: "digital" and "omr")
- PUT /api/exams/{exam_id}
- POST /api/exams/{exam_id}/generate-omr-pdf
- GET /api/exams/{exam_id}/omr-pdf
- GET /api/exams/{exam_id}/full (fixed total_points for OMR)

## Key DB Schema
- `online_exams`: type, num_questions, options_per_question, answer_key, points_per_question, total_points, omr_pdf_url, bubble_map, omr_pdf_generated_at

## 3rd Party Integrations
- Cloudinary (image/file hosting, OMR PDF storage)
- Firebase, ChatterPal, Vimeo

## Test Credentials
- School: elroble
- Owner: admin@elroble.edu / 1234abc8
- Parent: maria.peres@gmail.com / Test1234!
- Support: spencer3009@gmail.com / Socios3009
- Teacher: sonia3009@gmail.com / teacher123
