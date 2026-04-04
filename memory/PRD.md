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
- `/app/backend/services/omr_scanner.py` -- OpenCV pipeline
- **New Endpoints**: omr-scan, omr-students, omr-results, omr-register-grades
- **New Collection**: `omr_scans`
- **Frontend**: OMRScanFlow, OMRResultsCard, OMRScanCard wrapper

### OMR UI Redesign with Tabs (COMPLETED - Feb 4, 2026)
- Migrated to horizontal tabs, OmrDetailTabs component, 4 tabs with badges

### Image Storage Optimization (COMPLETED - Feb 4, 2026)
- Removed Cloudinary upload for OMR scans (in-memory processing)
- Visual bubble grid with color coding

## Subscription System

### Subscription Degradation Logic (FIXED - Apr 4, 2026)
- **Bug Fix P0**: `calculate_plan_state` was allowing schools with pending payments (`PAGO_EN_VERIFICACION`) to bypass blocking even after 3+ days overdue
- **Root cause**: The pending payment check ran BEFORE the date calculation and short-circuited to `PAGO_EN_VERIFICACION` regardless of days overdue
- **Fix applied**: Date-based state is now calculated FIRST. `PAGO_EN_VERIFICACION` only overrides when `dias_vencido < 3`. For 3+ days, always returns `PAGO_OBLIGATORIO` or `SUSPENDIDO`
- **Additional fix**: Date parsing failure now returns `PAGO_OBLIGATORIO` (safe default) instead of `ACTIVO`
- **Logging**: Added diagnostic logging at every decision point in `calculate_plan_state`
- States: ACTIVO -> AVISO_VENCIMIENTO (day 0) -> RESTRICCION_PARCIAL (days 1-2) -> PAGO_OBLIGATORIO (days 3-6) -> SUSPENDIDO (7+)
- Files: `/app/backend/routes/subscription.py`, `/app/frontend/src/App.js`, `/app/frontend/src/contexts/SubscriptionContext.jsx`

## Other Features Implemented
- Academic structure, Attendance (QR), Accounting, Teacher Assignments
- YouTube materials, Health & Wellness, Attendance notifications
- Excel import/export with validation, Orphan student management

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
- Cloudinary (files, OMR PDFs)
- Firebase, ChatterPal, Vimeo
- OpenCV (opencv-python-headless 4.13.0)

## Test Credentials
- Owner: admin@elroble.edu / 1234abc8 (subdomain: elroble)
- Parent: maria.peres@gmail.com / Test1234!
- Support: spencer3009@gmail.com / Socios3009
- Teacher: sonia3009@gmail.com / teacher123
