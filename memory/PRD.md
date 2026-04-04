# EduNet - School Management Platform PRD

## Original Problem Statement
Full-stack React + FastAPI + MongoDB school management platform for Peruvian schools.

## Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB (DB_NAME: database)
- **Hosting**: Emergent Platform / edunet.pe

## OMR Exam System (Complete -- Phases 1-3 + Redesign)

### Phase 1: Data Model & UI (COMPLETED)
- Extended `online_exams` collection with `type` (digital/omr), `num_questions`, `options_per_question`, `answer_key`, `points_per_question`
- Type selector in exam creation modal (Owner + Teacher portals)
- AnswerKeyEditor.jsx bubble grid component

### Phase 2: PDF Generation (COMPLETED)
- `/app/backend/services/omr_pdf_generator.py` -- ReportLab PDF with alignment markers, QR, bubble grid
- `POST /api/exams/{exam_id}/generate-omr-pdf` -- generates + uploads to Cloudinary
- `GET /api/exams/{exam_id}/omr-pdf` -- returns PDF URL
- OmrSheetCard component with generate/download/regenerate

### Phase 3: OpenCV Scanning (COMPLETED)
- `/app/backend/services/omr_scanner.py` -- OpenCV pipeline:
  - Marker detection (4 corner squares)
  - Perspective correction via warp transform
  - Bubble fill-ratio analysis (threshold 0.35)
  - Multi-mark detection, blank detection
  - Confidence scoring
- **New Endpoints**:
  - `POST /api/exams/{exam_id}/omr-scan` -- processes image, creates scan record
  - `PUT /api/exams/{exam_id}/omr-scan/{scan_id}` -- overwrites existing scan
  - `GET /api/exams/{exam_id}/omr-students` -- student list with scan status
  - `GET /api/exams/{exam_id}/omr-results` -- all scan results with student data
  - `POST /api/exams/{exam_id}/omr-register-grades` -- syncs grades to Registro Auxiliar
- **New Collection**: `omr_scans` (scan results per student per exam)
- **Frontend**: OMRScanFlow (3-step: select student -> capture photo -> view result), OMRResultsCard (table + register button), OMRScanCard wrapper

### OMR UI Redesign with Tabs (COMPLETED - Feb 4, 2026)
- Migrated from vertical stacking to horizontal tabs using `@radix-ui/react-tabs`
- `OmrDetailTabs` component in CourseDetailPage.jsx (line 6464)
- 4 tabs: Clave, Hoja OMR, Escanear, Resultados
- Tab badges: green check for completed steps, count badges for scans/results
- Prerequisites messaging: "Configure clave y genere hoja" when scanning not ready
- Empty state for Results tab when no scans exist

### Student Detail View (COMPLETED - Feb 4, 2026)
- `StudentScanDetail` component in OMRScanComponents.jsx (line 329)
- Backend endpoint: `GET /api/exams/{exam_id}/omr-scan/{student_id}`
- Inline panel replaces results table when student row is clicked
- Shows: score header, answer grid with color coding (green=correct, red=incorrect, gray=blank, amber=multiple), scanned sheet image
- "Volver a resultados" button to return to table
- Image clickeable to view full size in new tab
- Tested: Backend 100%, Frontend 100% (iteration_105)

## Other Features Implemented
- Academic structure, Attendance (QR), Accounting, Teacher Assignments
- YouTube materials, Health & Wellness, Attendance notifications
- Excel import/export with validation, Orphan student management

## Key Endpoints
- POST /api/course/{subject_id}/exams (digital + omr)
- POST /api/exams/{exam_id}/generate-omr-pdf
- POST /api/exams/{exam_id}/omr-scan
- PUT /api/exams/{exam_id}/omr-scan/{scan_id}
- GET /api/exams/{exam_id}/omr-students
- GET /api/exams/{exam_id}/omr-results
- POST /api/exams/{exam_id}/omr-register-grades
- GET /api/exams/{exam_id}/omr-scan/{student_id}

## Key DB Collections
- `online_exams`: type, num_questions, options_per_question, answer_key, points_per_question, total_points, omr_pdf_url, bubble_map, omr_pdf_generated_at
- `omr_scans`: exam_id, student_id, detected_answers, score, total, percentage, grade_vigesimal, details, confidence, registered_to_gradebook

## Pending Issues
- P2: Double scrollbar in "Registro Auxiliar"

## Upcoming Tasks
- P1: Refactor Message Pages (consolidate duplicates)
- P2: Visual indicator of sync_status in Exams/Tasks
- P2: Gradebook: Export PDF/Excel, Lock/Close Period
- P2: Create "Encuestas" page/module

## Future/Backlog
- Vinculacion Masiva (Phase 2 Parent Import)
- Dashboard Owner with real data
- Matriculas module
- Refactoring: CourseDetailPage.jsx (>10K lines), UsersPage.jsx (>5K lines)

## 3rd Party Integrations
- Cloudinary (files, OMR PDFs, OMR scans)
- Firebase, ChatterPal, Vimeo
- OpenCV (opencv-python-headless 4.13.0)

## Test Credentials
- Owner: admin@elroble.edu / 1234abc8 (subdomain: elroble)
- Parent: maria.peres@gmail.com / Test1234!
- Support: spencer3009@gmail.com / Socios3009
- Teacher: sonia3009@gmail.com / teacher123
