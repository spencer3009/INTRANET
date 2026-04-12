# EduNet - School Management System

## Original Problem Statement
Platform for school management with modules for coordination, accounting, attendance, psychology, and more. Premium redesign with Linear/Notion style UI.

## Core Architecture
- **Backend**: FastAPI + MongoDB (async motor)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **PDF Generation**: ReportLab (boletas, credentials, QR)
- **Charts**: Recharts
- **File Storage**: Cloudinary
- **Push Notifications**: Firebase Cloud Messaging (HTTP v1 API)
- **Auth**: JWT-based with role-based access control

## Implemented Features (Stable)

### Phase 1-3 (DONE)
- Premium redesign, QR mass download fix, Auxiliar de Asistencia portal

### Phase 4 - Boleta de Venta Interna (DONE)
- Backend + Frontend complete. Preview modal with iframe. Logo from school settings.

### Phase 5 - Seed Demo Accounting (DONE)
- POST /api/admin/seed-demo-accounting - realistic payments, expenses, boletas

### Phase 6 - FCM Push Notifications (DONE - 2026-04-10)
- **Backend**:
  - `services/fcm_service.py`: HTTP v1 API with google-auth OAuth2, token caching, auto-deactivation of invalid tokens
  - `POST /api/notifications/register-device`: Upserts in `device_tokens` collection, syncs with `push_tokens`
  - `POST /api/support/schools/{school_id}/test-push`: Sends push to school owner, creates notification in `notifications` collection (corrected from parent_notifications)
  - Graceful degradation: if FIREBASE_PROJECT_ID is empty, logs warning and returns (0,0)
- **Frontend**:
  - `firebase.js` updated to use env vars with fallback to hardcoded values
  - `useParentNotifications.js` registers with both legacy and new device_tokens endpoints
  - `useOwnerNotifications.js` (NEW - 2026-04-11): Requests browser notification permissions and registers FCM device token for Owner/Admin/Director roles
  - `DashboardHeader.jsx`: Integrates `useOwnerNotifications` hook and passes `userRole` prop to `NotificationBell`
  - `NotificationBell.jsx`: Added FCM foreground listener for non-parent roles that refreshes general notifications
  - Support panel: "Probar Push" button on each school card with detailed feedback
- **Collections**: `device_tokens` (user_id, school_id, fcm_token, platform, user_agent, active)
- **Bug Fix (2026-04-11)**: Owner/Admin FCM permission request now works. Root cause: `DashboardHeader` was not passing `userRole` to `NotificationBell`, and test-push was writing to wrong collection.
- **PWA Fix (2026-04-11)**: Restored PWA installability after FCM integration broke it. Root cause: `firebase.js` registered a second SW (`firebase-messaging-sw.js`) at same scope `/`, replacing the main PWA SW that had the fetch handler. Fix: merged Firebase Messaging into `service-worker.js` via `importScripts`, switched `firebase.js` to use `navigator.serviceWorker.ready`, and converted `firebase-messaging-sw.js` to a self-unregister script for legacy clients.
- **Status**: Code complete. Awaiting Firebase credentials in .env for end-to-end testing.

### Support Panel Additions
- Bulk "Matriculados a Activo" button (support-only)
- Individual "Cambiar a Activo" in student card menu (support-only)

## Firebase ENV Setup (pending user configuration)
Backend: FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON
Frontend: REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_AUTH_DOMAIN, REACT_APP_FIREBASE_PROJECT_ID, REACT_APP_FIREBASE_MESSAGING_SENDER_ID, REACT_APP_FIREBASE_APP_ID, REACT_APP_FIREBASE_VAPID_KEY

## Test Accounts
See /app/memory/test_credentials.md


### Phase 7 - Bulk Teacher Assignment (DONE - 2026-04-11)
- **Backend**: `POST /api/academic/assignments/bulk` endpoint in `academic.py`
  - Accepts teacher_id + level_id + arrays of grade_ids/section_ids/subject_ids
  - Generates cartesian product, validates each entity, checks duplicates (skip if exists)
  - Returns `{created, skipped, failed, details}` with per-combination status
  - Same RBAC as individual assignment (admin-only), multi-tenant via school_id
- **Frontend**: `BulkAssignmentModal` component in `TeacherAssignmentsPage.jsx`
  - Violet gradient button "Asignacion Masiva" alongside existing blue "Nueva Asignacion"
  - Multi-step: form (teacher/level/grades/sections/subjects/role/year) → preview table → confirm
  - Cascade filtering: level → grades → sections → subjects
  - "Seleccionar todas" toggles for sections and subjects
  - Preview shows exact count and table of combinations before submitting
- **Testing**: 100% (9/9 backend, 100% frontend - iteration_131)


### Phase 8 - Mobile Responsiveness Fix: Subjects & CourseDetail (DONE - 2026-04-11)
- **SubjectsPage.jsx**: Level tabs scrollable on mobile with `overflow-x-auto hide-scrollbar`, responsive padding/sizing for header, grade/section cards with `sm:` breakpoints, section header stack layout on mobile
- **CourseDetailPage.jsx**: 
  - TeacherColorfulTabs (9 tabs): Fixed from rigid `flex justify-between` to `overflow-x-auto hide-scrollbar` with `flex-shrink-0` per tab and a fade indicator on mobile. **Eliminated page-level horizontal scroll.**
  - CourseHeroHeader & TeacherCourseHeroHeader: Responsive padding (`p-4 sm:p-8`), scaled icons/title, `min-w-0` + `break-words`
  - PremiumTabs: Smaller padding/icons on mobile, fade indicator, `flex-shrink-0`
  - Sticky tabs wrapper: Adjusted margins for mobile
- **Verified**: 360px, 375px, 414px, 1920px — zero horizontal overflow at all widths
- **Testing**: Screenshots confirmed `scrollWidth === clientWidth` at 360px for both pages

## Prioritized Backlog
### P1
- Dashboard Owner con metricas reales

### Phase 9 - Schedule Duplication (DONE - 2026-04-11)
- **Backend**: `POST /api/schedules/duplicate` with `?dry_run=true` support
  - 3 modes: `section` (copy to other grades/sections), `day` (copy one day to others), `year` (copy to another academic year)
  - Cartesian product of source blocks × destinations, conflict detection (slot + professor)
  - Respects `permitir_profesor_multiples_horarios` setting from `schedule_settings` collection
  - Options: keep_teacher, overwrite_existing (soft-delete), skip_conflicts
  - Returns `{created, skipped, deleted, conflicts[], setting_multi_horario_activo}`
- **Frontend**: `DuplicateScheduleModal` component at `/components/schedule/DuplicateScheduleModal.jsx`
  - Violet gradient "Duplicar" button next to blue "Agregar horario" (disabled until grade/section selected)
  - 4-step wizard: Mode selection (3 visual cards) → Target selection → Options (3 toggles) → Preview (dry_run) → Confirm
  - Preview shows block count, conflict list with SLOT/PROFESOR tags, multi_horario info badge
- **Testing**: 100% (7/7 backend + 100% frontend - iteration_132)

### Phase 10 - Unified Schedule View Across All Portals (DONE - 2026-04-12)
- **Goal**: Replicate Owner's pastel CalendarGrid across all 8 portals without duplicating code
- **CalendarGrid.jsx**: Extended with `readOnly`, `showTeacherPhoto`, `showAulaBadge`, `highlightProfesorId` props
  - readOnly: hides edit/delete hover actions, context menu, cell click handlers
  - showTeacherPhoto: renders profesor_foto as circular 20x20 image inside blocks
  - showAulaBadge: renders aula as pill badge (bg-black/10) in blocks
  - highlightProfesorId: applies ring-2 ring-violet-300 to blocks matching that profesor_id
  - Fallback teacher info: checks schedule.profesor_nombre/profesor_foto when teachers[] lookup fails
- **SchedulePage.jsx**: Extended with `readOnly`, `showFilters`, `lockedSeccionId`, `apiEndpoint`, `headerTitle`, `childSelector` props
  - Role-aware sidebar/header rendering based on user.role
  - apiEndpoint mode: loads data from dedicated endpoint (student/parent), skips filters
  - Public settings endpoint for non-owner roles to avoid 403 errors
- **Wrapper pages**:
  - `StudentSchedulePage.jsx`: 14-line thin wrapper → readOnly, no filters, apiEndpoint=/api/student/schedule
  - `ParentSchedulePage.jsx`: ~100 lines with child selector + localStorage persistence
- **New routes**: admin/horarios, teacher/horarios, coordinacion/horarios, pae/horarios, aux-asistencia/horarios
- **Sidebar entries added**: AdminSidebar, TeacherSidebar, CoordinacionSidebar, Sidebar(aux-asistencia)
- **Backend**: Enhanced `GET /api/parent/schedule` to return breaks, grade_name, section_name
- **Backups**: StudentSchedulePage.jsx.backup, ParentSchedulePage.jsx.backup
- **Portal access matrix**:
  | Portal | Route | readOnly | showFilters | Edit |
  |--------|-------|----------|-------------|------|
  | Owner | /:subdomain/horarios | false | true | Yes |
  | Admin | /:subdomain/admin/horarios | false | true | Yes |
  | Director | /:subdomain/horarios (shared) | false | true | Yes |
  | Coordinator | /:subdomain/coordinacion/horarios | true | true | No |
  | Teacher | /:subdomain/teacher/horarios | true | true | No |
  | Student | /:subdomain/student/schedule | true | false | No |
  | Parent | /:subdomain/parent/schedule | true | false | No |
  | Aux PAE | /:subdomain/pae/horarios | true | true | No |
  | Aux Asist | /:subdomain/aux-asistencia/horarios | true | true | No |
- **Testing**: Iteration 133 - 95% → 100% after data fix (parent child link)

### Phase 10b - Teacher Schedule Enhancement (DONE - 2026-04-12)
- **Goal**: In teacher portal, visually highlight sections where teacher has schedule blocks
- **Backend**: `GET /api/teacher/my-sections` → returns `{seccion_ids: [...]}` by querying schedules.distinct("seccion_id") for logged-in teacher
  - Endpoint in `routes/teacher_portal.py`, role-restricted to teacher
- **Frontend**:
  - Section dropdown: ★ prefix on sections where teacher has blocks (mySectionIds)
  - Badge "★ Sección donde enseñas" above grid when viewing own section
  - `highlightProfesorId` prop on CalendarGrid: ring-2 ring-violet-300 on teacher's own blocks
  - All logic gated on `user.role === "teacher"` — zero impact on other roles
- **Smoke test**: Teacher sees ★ in dropdown, badge, and ring. Owner sees none of these.

- Modulo de Matriculas (Enrollments)
- Psicologia: Log de auditoria estricto

### P2
- Modulo de Encuestas
- Optimizacion servidor examenes masivos (3000 students)
- Refactorizacion CourseDetailPage.jsx (>11,000 lineas)
