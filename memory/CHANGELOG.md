# EduNet - Changelog

## April 27, 2026 - Fork (Subscription Inline Payment Fix)

### Fix: Padre solo lectura en Servicios Opcionales - COMPLETED
- **Frontend** (`ParentOptionalServices.jsx`): Eliminado el switch que permitía al padre activar/desactivar suscripciones. Componente convertido a solo lectura. Ahora solo lista las suscripciones ACTIVAS (informativo, para que el padre sepa qué cobros adicionales se le aplican). Si no hay activas, muestra mensaje guía para contactar a la administración. Removida toda la lógica de modal "aplicar a otros hijos".
- **Backend** (`parent_payments.py`): Endpoints `POST` y `DELETE` `/api/parent-payments/concept-subscriptions/{student}/{concept}` ahora devuelven **HTTP 403** con mensaje claro. El control queda exclusivamente en el lado administrativo (`accounting.py`).
- Verificado: Frontend sin toggles, backend retorna 403 en POST/DELETE para padres, GET de listado sigue funcionando.

### Fix: Parent Dashboard Yape Total Now Correctly Sums Optional Subscriptions - COMPLETED
- **Backend** (`accounting.py` `_ensure_current_month_payment` + `parent_payments.py` POST `/concept-subscriptions/{student}/{concept}` + admin equivalents): When a parent (or admin) activates a subscription concept, the current-month payment is generated inline so it appears immediately without waiting for the monthly cron.
- **Frontend** (`ParentDashboardPage.jsx` Yape card): Reordered logic so interest enrichment runs BEFORE grouping. Now `monthTotal` correctly sums `nextCuota.amount` (with mora) + extras of the same `pension_month`. Previously total = 290 but desglose summed 422.83 (mismatch).
- Verified: After activating LIBROS (S/60), parent dashboard shows headline S/422.83 = Mensualidad (S/350 + Mora S/12.83) + LIBROS (S/60). Desglose now matches the headline.
- Testing: Manual end-to-end via curl + screenshot (login parent → activate concept → schedule reflects new charge → dashboard sums correctly).


## April 2, 2026 - Fork 10

### Fix: School Logo Visible in All Health & Wellness Portals - COMPLETED
- **HealthWellnessPage.jsx**: Added missing imports (useState, useEffect, axios, API) that prevented settings load
- **AdminHealthPage.jsx**: Added `logoUrl` prop to DashboardHeader
- **AdminTopicoPage.jsx / AdminPsicologiaPage.jsx**: Moved settings API call BEFORE early return for owners, added `logoUrl` and `schoolName` from settings to DashboardHeader
- All 10 Health & Wellness pages now display the school logo correctly (Owner, Admin, Teacher, Parent portals)
- Testing: Manual screenshots verified for Owner HealthWellnessPage, AdminHealthPage, AdminTopicoPage

## April 2, 2026 - Fork 9

### Fix: Health & Wellness Permission Logic v2 (April 2, 2026) - COMPLETED
- **NUEVA REGLA**: Admin/Teacher SIEMPRE pueden VER registros (lectura). Solo pueden crear/editar/eliminar si su switch está activado
- Backend: `_require_health_access(write=True)` bloquea POST/PUT/DELETE cuando switch OFF; `write=False` (GET) siempre permite
- Frontend: `canWrite` prop en TopicoPage/PsicologiaPage oculta botones de crear/editar/eliminar y muestra banner "Modo lectura"
- Sidebars: "Salud y Bienestar" siempre visible (removida lógica condicional)
- Settings: Textos actualizados para reflejar nueva lógica
- Testing: 100% (Backend 13/13, Frontend 100%) - iteration_99.json

### Feature: Health & Wellness — Conditional Access for Teachers & Admins - COMPLETED
- **TeacherSidebar**: Dynamic "Salud y Bienestar" nav item based on `teacher_can_manage` permission
- **AdminSidebar**: Dynamic item in GESTIÓN ACADÉMICA section based on `admin_can_manage`
- **New pages**: TeacherHealthPage, AdminHealthPage, TeacherTopicoPage, TeacherPsicologiaPage, AdminTopicoPage, AdminPsicologiaPage
- **TopicoPage/PsicologiaPage refactored**: Accept `renderSidebar`, `renderHeader`, `backPath` props for reusability
- **GET /api/settings/health-permissions**: Now accessible to any authenticated user (PUT remains owner-only)
- Testing: 100% (Backend 12/12, Frontend 100%) - iteration_98.json

### Feature: Health & Wellness — Permissions, Parent Alerts & Parent View (P0) - COMPLETED
- **PARTE A — Permisos**: GET/PUT `/api/settings/health-permissions` para controlar acceso de admin/teacher al módulo. Owner siempre tiene acceso. Toggles en SettingsPage.jsx
- **PARTE B — Alertas**: campo `parent_notified` en topico_records y psicologia_records. `HealthAlertPopup.jsx` modal fullscreen en ParentDashboardPage. Endpoints GET/POST para alerts/acknowledge
- **PARTE C — Vista Padres**: `ParentHealthPage.jsx` con tabs Tópico/Psicología (solo lectura). Endpoints GET `/api/health/parent/topico` y `/api/health/parent/psicologia`. Sidebar actualizado con HeartPulse icon
- **Backend**: `health.py` reescrito con `_require_health_access()` dinámico basado en permisos del colegio
- Testing: 100% (Backend 13/13, Frontend 100%) - iteration_97.json

## March 21, 2026 - Fork 7

### Feature: Unified Register Linkage System (Exams + Tasks) - P0 COMPLETED
- **Backend**: New unified endpoint `GET /api/register/availability` with TRIPLE verification (exams + tasks + manual grades)
- **Backend**: New collection `register_column_assignments` with unique index for cross-collection exclusivity
- **Backend**: Tasks can link to P1/P2/P3 only (400 error for EM/EB). Exams can link to EM/EB/P1/P2/P3
- **Backend**: Task creation (`POST /api/course/{subject_id}/posts`) now supports `register_column` field
- **Backend**: New service `register_sync.py` — centralized sync for both exams and tasks
- **Backend**: `sync_single_student_task()` triggers when teacher grades a submission (nota_vigesimal = round(score * 20 / max_points))
- **Backend**: Delete task cleans register_column_assignments + grades, clears register_column on soft delete
- **Backend**: `period_id` fully auto-resolved from active academic period (no frontend param needed)
- **Frontend**: Bimester field is now a read-only badge (`BIMESTRE I ● ACTIVO`) in both ExamModal and PremiumTaskModal
- **Frontend**: PremiumTaskModal now includes full "Vinculacion al Registro Auxiliar" block (P1/P2/P3 + Sin vinculacion)
- **Frontend**: ExamModal updated to use unified endpoint with new response format (assigned_to.type/id/title)
- **Frontend**: Cross-collection availability — if task occupies P1, exam shows P1 as "Ya asignado"
- Testing: 100% (Backend 11/11, Frontend all verified) - iteration_87.json

## March 21, 2026 - Fork 6b

### Feature: Exam ↔ Registro Auxiliar Linkage (P0) - COMPLETED
- **Backend**: New endpoint `GET /api/exams/register-availability` returns slot availability (EM, EB, P1, P2, P3) per subject + period
- **Backend**: Validation on create/update — 409 Conflict when slot already assigned, 400 for invalid values
- **Backend**: New fields on `online_exams`: `period_id`, `register_type`, `register_participation`, `sync_status`, `section_id`
- **Backend**: `sync_exam_to_register()` in `services/exam_register_sync.py` — syncs scores from exam attempts to `student_grades` collection
- **Backend**: `sync_single_student()` hook in `submit_exam_attempt` — instant vigesimal grade sync (Math.round(percentage * 20 / 100))
- **Backend**: Unique partial indexes on `online_exams` for concurrency protection
- **Backend**: Delete exam cleans register columns via sync("delete")
- **Frontend**: ExamModal completely rewritten with "Vinculacion al Registro Auxiliar" block as first section
- **Frontend**: Bimester select (loads from /api/academic/periods, pre-selects based on current month)
- **Frontend**: EM/EB radio buttons with "Disponible"/"Ya asignado" status badges
- **Frontend**: P1/P2/P3 toggle buttons with disabled states for occupied slots
- **Frontend**: Dynamic confirmation text showing linkage summary
- **Data**: Created 4 academic periods (BIMESTRE I-IV) for elroble school
- Testing: 100% (Backend 18/18, Frontend all verified) - iteration_85.json

### Performance Optimization: Course Dashboard (Fase 1 + 2) - COMPLETED
- Fase 1: Fixed N+1 queries, deprecated asyncio.coroutine, added file_url/file_name/metadata to projection
- Fase 2: Parallelized sidebar-summary (11→1 gather), removed slow regex, presence/users subject filter
- Frontend: Fixed presence map bug
- Testing: 100% (Backend 22/22, Frontend verified) - iteration_84.json

## April 3, 2026 - Fork (Parents Search + Trash System)

### Feature: Buscador en pestaña Padres (UsersPage) - COMPLETED
- Added `parentsTabSearch` state and search input UI in Parents tab
- Filters parents by name, last_name, DNI or email in real-time
- Includes clear button (X), result count indicator, and improved empty-state message when search yields no results
- File modified: `/app/frontend/src/pages/UsersPage.jsx`

### Feature: Sistema de Papelera para Colegios (Soft Delete + Restore + Permanent Delete) - COMPLETED
- Backend: 4 new endpoints in `/api/support/` (archive, restore, permanent, trash)
- `PATCH /api/support/schools/{id}/archive` - Soft delete with status/previous_status/deleted_at
- `PATCH /api/support/schools/{id}/restore` - Restore from trash to previous status
- `DELETE /api/support/schools/{id}/permanent` - Cascade delete with MongoDB transaction + audit log in deletion_logs
- `GET /api/support/schools/trash` - List trashed schools sorted by deleted_at desc
- Global filter `NOT_IN_TRASH` applied to overview, schools-paginated, schools, all-schools endpoints
- Frontend: Archive modal, Trash view overlay, Restore modal, Permanent delete modal (requires typing school name)
- Papelera button with badge count in header. Archive icon replaces old delete button on cards
- Testing: 100% (Backend 11/11, Frontend all UI verified) - iteration_100.json

## March 11, 2026 - Fork 5

### Major Feature: Registro Auxiliar Excel-Format Rebuild - COMPLETED
### Bug Fix: Datos academicos no visibles - COMPLETED
### UI Fix: Gradebook Sidebar & Tab Cleanup - COMPLETED

## March 6, 2026 - Fork 4

### Enhancement: Excel Template & Metadata Verification System - COMPLETED
### Feature: Mass Student Import from Excel/CSV (P0) - COMPLETED

## March 6, 2026 - Fork 3

### Feature: Mobile Bottom Nav for ALL Portals - COMPLETED
### Feature: Complete UI Unification - COMPLETED
### Feature: Replicate Subjects Between Sections - COMPLETED
### Feature: Mass Student Import Backend - COMPLETED
