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

### Unified Register Linkage System (P0) - COMPLETED
- **Exams**: Can link to EM, EB, P1, P2, P3 or Sin vinculacion
- **Tasks**: Can link to P1, P2, P3 or Sin vinculacion (NEVER EM/EB)
- **New collection**: `register_column_assignments` with unique index for cross-collection exclusivity
- **Unified endpoint**: `GET /api/register/availability` with TRIPLE verification (exams + tasks + manual grades)
- **Response format**: `assigned_to: {type: "exam"|"task"|"manual", id, title}` for each column
- **Bimester**: Auto-resolved from active academic period (read-only badge, NOT dropdown)
- **Backend**: `register_sync.py` centralizes all sync for both exams and tasks
- **Sync on grade**: `sync_single_student_task()` triggers when teacher grades a submission
- **Deletion**: Clears register_column_assignments + register grades on delete
- **Validation**: Tasks with EM/EB → 400 error. Cross-collection conflict → 409 error
- **Cron auto-zero exámenes**: Background job cada 60s para exámenes expirados (not tasks)
- **Cron auto-zero tareas**: Background job cada 60s para tareas vencidas (due_date pasada) → asigna grade=0 a alumnos sin entrega → sync al registro auxiliar

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

## Upcoming Tasks (P1 from PRD)
| P | Task | Status |
|---|------|--------|
| P1 | Tooltips with exam/task name on occupied columns | NOT STARTED |
| P1 | Deletion warning modal for linked exams/tasks | NOT STARTED |
| P1 | Edit linkage (move notes between columns) | NOT STARTED |
| P1 | Closed register warning + sync_status "pending" + auto-retry on reopen | NOT STARTED |
| P1 | Refactor Message Pages (consolidate duplicated components) | NOT STARTED |
| P2 | Visual indicator of sync_status in Exams/Tasks list (synced/pending/not_linked) | NOT STARTED |
| P2 | Gradebook Enhancements (Export PDF/Excel, Lock/Close Period) | NOT STARTED |

## Future/Backlog Tasks
- Complete Parent Portal Feature Parity
- Build "Matriculas" (Enrollments) module
- Enhance Exams module with Question Bank
- Replace all window.confirm/alert with custom modals
- Move Google Drive OAuth from exams.py to dedicated integrations module
- Audit log for register sync operations

## Key Data Models
- `online_exams`: `{id, school_id, subject_id, section_id, title, period_id, register_column, sync_status, ...}`
- `course_posts` (tasks): `{id, school_id, subject_id, section_id, title, post_type:"task", period_id, register_column, sync_status, max_grade, ...}`
- `register_column_assignments`: `{school_id, subject_id, section_id, period_id, register_column, source_type, source_id, source_title, created_at}`
- `student_grades`: `{school_id, subject_id, section_id, period_id, student_id, exam_mensual, exam_bimestral, part_p1-p3, ...}`
- `academic_periods`: `{id, school_id, nombre, orden, activo, fecha_inicio, fecha_fin}`

## Key API Endpoints
- `GET /api/register/availability?subject_id={id}` — Unified availability (triple check)
- `GET /api/exams/register-availability?subject_id={id}` — Legacy (delegates to unified)
- `POST /api/course/{subject_id}/exams` — Create exam (auto-resolves period_id)
- `POST /api/course/{subject_id}/posts` — Create task with register_column
- `GET /api/academic/periods/active` — Get active period

## Credentials
- Owner: elroble / admin@elroble.edu / 1234abc8
- Support: spencer3009@gmail.com / Socios3009
- Parent: micky@gmail.com / 1234abc8
