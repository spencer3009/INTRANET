# EduNet - PRD

## Architecture
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI + MongoDB
- 3rd Party: Cloudinary, Firebase Admin SDK (push), pandas, openpyxl, recharts

## Implemented (March 21, 2026)

### Performance Optimization - Course Dashboard (Fase 1 + 2) - COMPLETED
- [x] Fase 1: Fixed N+1 queries in `get_course_posts` with `asyncio.gather()` batch queries
- [x] Fase 1: Added projection to exclude heavy fields (`submissions[]`) from list view
- [x] Fase 1: Fixed deprecated `asyncio.coroutine` code, added missing `file_url`/`file_name`/`metadata` to projection
- [x] Fase 1: MongoDB indexes for `post_likes`, `post_comments`, `course_activities`, `course_reminders`, `presence`
- [x] Fase 2: Parallelized `sidebar-summary` (11 sequential queries → 1 `asyncio.gather`)
- [x] Fase 2: Removed slow regex on `content` field for video counting (now uses indexed `file_type` prefix match)
- [x] Fase 2: Optimized `presence/users` with optional `subject_id` filter (scopes to ~7 course users vs 1000+ school)
- [x] Frontend: Fixed presence map bug (array→map conversion for O(1) lookup)

### Attendance Config by Level
- [x] UI: Docentes (entry/exit global) + Estudiantes por Nivel
- [x] DB: attendance_config.teachers + attendance_config.levels[] + tolerance + auto_late
- [x] Backend: PUT /api/settings/attendance, GET includes config
- [x] QR: auto-marks present/late/absent by student level_id or teacher config

### Push Notifications
- [x] Firebase Admin SDK, FCM tokens, Service Worker
- [x] Attendance push: entry + exit + tardanza notifications
- [x] "Asistencia" tab in NotificationBell for parents

### QR Scanner
- [x] Pauses on scan, "Escanear otro" button, no re-scan

### Support Panel
- [x] Two-tab renewal, all schools visible, paginated, notification bell

### Subscription
- [x] Real-time state, owner/admin always login, ProfileCard days overdue

### Production Hardening (March 2026)
- [x] Fixed 503 errors from stale Service Worker
- [x] Hardened POST/GET /api/academic/subjects with scoped validation, multi-collection caching
- [x] Fixed Google Drive OAuth token refresh + redirect_uri
- [x] Centralized QR Code Generation (services/qr_service.py)

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
| P1 | Refactor Message Pages (consolidate duplicated components) | NOT STARTED |
| P2 | Gradebook Enhancements (Export PDF/Excel, Lock/Close Period) | NOT STARTED |

## Future/Backlog Tasks
- Complete Parent Portal Feature Parity
- Build "Matrículas" (Enrollments) module
- Enhance Exams module with Question Bank
- Replace all window.confirm/alert with custom modals

## Refactoring Needed
- Move Google Drive OAuth from exams.py to dedicated integrations.py/drive_service.py

## Credentials
- Owner: elroble / admin@elroble.edu / 1234abc8
- Support: spencer3009@gmail.com / Socios3009
- Parent: micky@gmail.com / 1234abc8
