# EduNet - PRD

## Original Problem Statement
EduNet: Plataforma educativa para colegios peruanos. Full-stack: FastAPI + React + MongoDB.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) | Frontend: React | DB: MongoDB | Images: Cloudinary

## What's Been Implemented

### Session - March 3, 2026 (Latest - Fork 2)
- **BUG FIX: Parent Portal Attendance Times (P0)**: Fixed date filtering in `GET /api/parent/attendance` - added `start_date`/`end_date` query params. Previously mixed records from all months.
- **UI: Calendar Split Design**: Calendar cells now show horizontal split: top half green (entry time), bottom half blue (exit time). Each half displays the corresponding time.
- **FEATURE: Owner Reports Detail Modal**: Added eye icon button per student in the reports table. Clicking opens a side drawer with monthly calendar (split green/blue) showing entry/exit times. New endpoint: `GET /api/attendance/reports/student-detail`.
- **FEATURE: PWA WebView Detection**: Detects WhatsApp/Facebook/Instagram WebView and shows a special screen guiding users to open in Chrome via `intent://` URL. Does not affect normal browser flow.

### Session - March 3, 2026 (Fork 1)
- **ATTENDANCE ENTRY/EXIT MODULE (P0)**: Extended existing attendance system with entry_time, exit_time, entry_method, exit_method, total_minutes. New endpoints: `POST /api/attendance/mark-entry`, `POST /api/attendance/mark-exit`. Modified QR scan to support `mode` (auto/entry/exit). Frontend: Entry/Exit columns with buttons, mode selector in QR scanner, updated counters. Save endpoint changed from delete+insert to upsert to preserve entry/exit data. **100% tests passed.**
- **BUG FIX: Course Visibility (P0)**: Fixed 8+ endpoints to use `subjects.section_id` instead of `academic_assignments`. Migrated 12 old subjects.
- **BUG FIX: Edit Subject Modal**: Nivel/Grado/Sección pre-selected and locked when editing.
- **UI: Grade/Section on course cards**: Added small text showing grade and section.

### Previous Sessions
- Photo Upload Modal, Grade Validation, Auto-Grade Creation, Smart Filtering, Subjects-to-Section Refactor

## Prioritized Backlog

### P0
- Verify "Disappearing Student Selection" bug in PaymentFormModal
- Modularize `server.py` into FastAPI routers (CRITICAL tech debt - 22K+ lines)

### P1
- Attendance: Settings for schedule/lateness configuration (P1 from spec)
- Apply Intelligent Filters to Parents View
- Parent Portal Feature Parity, Matriculas, Notifications, Question Bank

### P2
- Attendance: Parent notifications on entry/exit (P2 from spec)
- Cache Invalidation, Replace window.confirm/alert, Hardcoded Dashboard, Message Center count

## Key Technical Notes
- **Source of Truth for Student Courses**: `subjects.section_id` is canonical. `academic_assignments` = teacher linkage only.
- **Attendance Entry/Exit**: Uses upsert in `attendances` collection. QR scan supports mode (auto/entry/exit). Save preserves entry/exit data.

## Test Credentials
- **Owner (elroble)**: admin@elroble.edu / 1234abc8 / subdomain=elroble
- **Student (Pepito)**: pepito@gmail.com / 1234abc8 / subdomain=elroble
- **Parent (Miguel)**: miguel@gmail.com / 1234abc8 / subdomain=elroble
