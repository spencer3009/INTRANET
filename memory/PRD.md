# PRD - SaaS Escolar (INTRANET)

## Original Problem Statement
Replicar y expandir módulos del SaaS escolar. Optimizar el rendimiento del servidor en producción evitando OOM crashes mediante el escalonamiento de llamadas API, reducción de polling en el frontend y uso eficiente de WebSockets. Implementar monitoreo de salud y tracking de sesiones activas en tiempo real. Corregir vinculación de Exámenes y Tareas para que consuman dinámicamente la plantilla activa del colegio en lugar de valores hardcodeados.

## Stack
- Backend: FastAPI + MongoDB (Motor)
- Frontend: React
- Auth: JWT custom

## User's Preferred Language
Spanish (responder siempre al usuario en Español).

## Core Requirements
- P0: Optimización de carga en páginas pesadas (Dashboard, Accounting) con multi-phase load.
- P0: Conectar dinámicamente "Nueva Tarea" y "Nuevo Examen" con las plantillas del Registro Auxiliar activo.
- P1: Gestión de Sesiones Activas en Support Panel (WS tracking de página, asignatura, grado).
- P1: Health checks públicos (/api/health) + startup no bloqueante.
- P1: Guard global para bloquear servicios a alumnos pending/rejected.
- P1: Psicología — Log de auditoría estricto.

## Test Credentials
Ver `/app/memory/test_credentials.md`.

## Completed (latest session)
- [2026-02] `student_portal.py`: `/api/student/tasks` y `/api/student/dashboard` migrados al array embebido `course_posts.submissions`. Eliminadas queries a la colección obsoleta `db.task_submissions`.
- Validación E2E con curl: estados `pending`, `submitted`, `graded`, `late` funcionan correctamente.
- [2026-04] **P1 Guard Global de Acceso para Alumnos** (core.py + auth.py + student_portal.py):
  - Helper `enforce_student_active(user)` en `routes/core.py` bloquea alumnos con `enrollment_status in {"rejected"}` o `student_status in {"withdrawn","deleted","rejected"}`; los `pending` se bloquean salvo que el colegio active `permitir_acceso_estudiantes_pendientes`.
  - Hook integrado en `require_role()` y en todos los endpoints manuales de `student_portal.py`.
  - `/api/auth/login` ahora bloquea también `enrollment_status=rejected` y `student_status in ("rejected","deleted")`.
  - Test suite: `/app/backend/tests/test_student_guard.py` (4/4 pass).
- [2026-04] **P0 Edición/Eliminación de Hijos Pendientes y Rechazados en Portal de Padres** (`parent_portal.py` + `ParentEnrollmentForm.jsx` + `ParentDashboardPage.jsx` + `App.js`):
  - Nuevo endpoint `GET /api/parent/children/pending/{child_id}` para cargar detalle completo de un hijo pendiente.
  - `PATCH /api/parent/children/pending/{child_id}`: whitelist ampliado a todos los campos del auto-registro (DNI, nivel/grado/sección/turno, procedencia, condiciones médicas, doctor, persona autorizada, notas, photo_url).
  - `DELETE /api/parent/children/pending/{child_id}`: ahora acepta tanto `pending` como `rejected` (hijos rechazados se pueden borrar para volver a intentar).
  - `ParentEnrollmentForm.jsx` reutilizable: en modo `create` usa `POST /api/enrollment/self-register`; en modo `edit` (ruta `/parent/editar-hijo/:childId`) precarga datos y usa `PATCH`.
  - Dashboard: botón editar solo si `pending`; botón eliminar si `pending` **o** `rejected`. Modal de confirmación con copy dinámico.
- [2026-02] **Sub-rol obligatorio para Personal de Mantenimiento** (`users.py` + `UsersPage.jsx`):
  - Nuevos campos `maintenance_role` (enum: `limpieza`, `vigilancia`, `guardianía`, `porteria`, `otro`) y `maintenance_role_custom` (texto libre si `otro`).
  - Backend valida en POST y PUT `/api/users` con error 400 si faltan.
  - Frontend: dropdown como primer campo visible en modales de creación y edición; input libre condicional cuando selecciona "Otro"; limpia valor al cambiar a otra opción.
- [2026-02] **Módulo de Asistencia de Personal de Mantenimiento** (`attendance.py` + `AttendancePage.jsx`):
  - Backend: 3 endpoints nuevos siguiendo patrón de profesores (`type: "maintenance"` en `db.attendances`):
    - `GET /api/attendance/maintenance?date=YYYY-MM-DD` → lista personal con estado del día.
    - `POST /api/attendance/maintenance/save` → upsert batch por fecha (reemplaza registros).
    - `GET /api/attendance/reports/maintenance?start_date&end_date` → resumen por persona con % asistencia.
  - Helper `_maintenance_role_display()` devuelve label legible (maintenance_role mapeado o custom si es "otro").
  - Frontend: tarjeta "Personal de Mantenimiento" en home, `MaintenanceAttendanceTab` (marcado manual con chip del rol), `MaintenanceReportsTab` (tabla + PDF con jsPDF) y botón "Reportes Mantenimiento" en sección Reportes.
- [2026-04] **Inline Payment Generation al Activar Suscripción Opcional** (`accounting.py` `_ensure_current_month_payment` + `parent_payments.py` + `ParentDashboardPage.jsx`):
  - Cuando padre/admin activa una suscripción a un concepto opcional, se genera el cobro del mes en curso al instante (idempotente por student+concept+pension_month) sin esperar al cron mensual.
  - Frontend: dashboard del padre agrupa todos los pendientes del mismo `pension_month` y muestra desglose. Bug fix: `monthTotal` ahora se computa DESPUÉS de aplicar mora a `nextCuota.amount`, evitando inconsistencias entre headline y desglose.
  - Verificación E2E: Mensualidad S/350 + Mora S/12.83 + LIBROS S/60 = headline S/422.83 ✓ desglose suma 422.83 ✓.
- [2026-02] **Conceptos de Pago Opcionales con Cron Mensual** (`accounting.py` + `parent_payments.py` + `SubscriptionsTab.jsx` + `ParentOptionalServices.jsx`):
  - Campo `enrollment_mode` ("mandatory" | "open") en `payment_concepts`.
  - Nueva colección `student_concept_subscriptions` con índice único (school_id, student_id, concept_id) — granularidad por alumno.
  - Endpoints admin: GET/POST `/accounting/students/{id}/concept-subscriptions`, PATCH `/accounting/concept-subscriptions/{sub_id}`, POST `/accounting/concept-subscriptions/run-cron`.
  - Endpoints padre: GET `/parent-payments/available-concepts/{student_id}`, POST/DELETE `/parent-payments/concept-subscriptions/{student_id}/{concept_id}`.
  - Cron `monthly_concept_payments_cron` (loop daily, ejecuta solo día 1 a 06:00 Lima). Idempotente por `student_id + concept + pension_month`.
  - Frontend: tab "Suscripciones" en AccountingPage + sección "Servicios Opcionales" en ParentPaymentsPage con modal de aplicación masiva entre hijos.

## Roadmap
### P1
- Psicología — Log de auditoría estricto.

### P2
- Módulo de Encuestas.
- Optimización de carga de exámenes masivos (3000 alumnos).
- Refactor `CourseDetailPage.jsx` (>11k líneas).
- Plantilla "Adventista" para carnets QR.
- Fase 5 Registro Auxiliar: storage dinámico en `student_grades` (eliminar `COLUMN_FIELD_MAP` fijo).

### P3
- Fix `max_grade` en `courses.py` (actualmente requiere `metadata.points`).
- Revisar otros crons por bugs de timezone lexicográficos.

## Key Technical Concepts
- **Array embebido de entregas**: `course_posts.submissions` es la única fuente de verdad. NO usar `db.task_submissions`.
- **Timezone-aware Crons**: usar `datetime.fromisoformat()` para comparaciones; normalizar `due_date` a UTC Z.
- **Validación tolerante de columnas**: labels (R1, SEM1) y UUIDs aceptados en `register_sync.py`.

## Critical Warnings
- La colección `db.task_submissions` está **obsoleta**. Toda lógica de entregas debe leer/escribir en `course_posts.submissions`.
- Nunca comparaciones lexicográficas `{"$lte": now_iso}` sin garantizar UTC Z.
- El agente no tiene acceso a la BD de producción real (ej. "IEP MI BUEN PASTOR"), solo seeds locales.
