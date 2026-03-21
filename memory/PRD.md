# EduNet - PRD

## Architecture
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI + MongoDB (DB_NAME: database)
- 3rd Party: Cloudinary, Firebase Admin SDK (push), pandas, openpyxl, recharts

## Implemented Features

### Performance Optimization - Course Dashboard (Fase 1 + 2) - COMPLETED
- Fase 1: Fixed N+1 queries in `get_course_posts` with `asyncio.gather()` batch queries
- Fase 1: Added projection to exclude heavy fields, fixed deprecated asyncio.coroutine
- Fase 2: Parallelized `sidebar-summary` (11 queries → 1 asyncio.gather)
- Fase 2: Optimized `presence/users` with optional `subject_id` filter
- Frontend: Fixed presence map bug (array→map for O(1) lookup)

### Exam ↔ Registro Auxiliar Linkage (P0) - COMPLETED
- Backend: `register_column` (single field, mutually exclusive: EM|EB|P1|P2|P3|null)
- Backend: `GET /api/exams/register-availability` with slot availability per bimester
- Backend: Validation 409 conflict on duplicate register_column
- Backend: `sync_exam_to_register()` and `sync_single_student()` for auto-grading
- Backend: Single unique partial index `uq_exam_register_column`
- Frontend: ExamModal single radio group (EM, EB, P1, P2, P3 + Sin vinculacion)
- Frontend: Bimester select, dynamic availability badges, confirmation text

### Prior Features (from previous sessions)
- Attendance Config by Level, Push Notifications, QR Scanner
- Support Panel, Subscription management
- Production Hardening (503 fix, Subjects hardening, Google Drive OAuth, QR centralization)
- Registro Auxiliar Excel-Format Rebuild, Mass Student Import

## Pending Issues
| P | Issue | Status |
|---|-------|--------|
| P1 | Subject list inconsistency (Asignaturas vs Asignar Docente modal) | NOT STARTED |
| P1 | Incomplete Payment Flow (approve/reject in support panel) | NOT STARTED |
| P2 | Hardcoded Owner Dashboard Data | NOT STARTED |
| P2 | Double scrollbar in Registro Auxiliar | NOT STARTED |

## Upcoming Tasks
| P | Task | Status |
|---|------|--------|
| P1 | Exam Linkage P1: Tooltips, deletion warning, edit linkage, closed register warning | NOT STARTED |
| P1 | Refactor Message Pages (consolidate duplicated components) | NOT STARTED |
| P2 | Gradebook Enhancements (Export PDF/Excel, Lock/Close Period) | NOT STARTED |

## Future/Backlog Tasks
- Complete Parent Portal Feature Parity
- Build "Matriculas" (Enrollments) module
- Enhance Exams module with Question Bank
- Replace all window.confirm/alert with custom modals
- Move Google Drive OAuth from exams.py to dedicated integrations module

## Key Data Models
- `online_exams`: `{id, school_id, subject_id, section_id, title, period_id, register_column, sync_status, ...}`
- `student_grades`: `{school_id, subject_id, section_id, period_id, student_id, exam_mensual, exam_bimestral, part_p1-p3, ...}`
- `academic_periods`: `{id, school_id, nombre, orden, activo, fecha_inicio, fecha_fin}`

## Credentials
- Owner: elroble / admin@elroble.edu / 1234abc8
- Support: spencer3009@gmail.com / Socios3009
- Parent: micky@gmail.com / 1234abc8
