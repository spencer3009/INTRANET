# PRD — SaaS Escolar (EduNet)

## Original Problem Statement
Replicar y expandir módulos del SaaS escolar. Optimizar rendimiento del servidor en producción evitando OOM crashes. Implementar monitoreo de salud y tracking de sesiones activas en tiempo real.

Lenguaje del usuario: **Español** (responder siempre en Español).

## Personas
- **Admin / Owner**: gestiona toda la operación del colegio, contabilidad, pagos, planilla docente.
- **Padre (Apoderado)**: revisa pensiones, paga con Yape, ve estado de hijos.
- **Profesor**: registra asistencia, cursos, calificaciones.
- **Alumno**: consulta tareas, calificaciones.
- **Auxiliar / Tópico / Psicología**: módulos administrativos especializados.

## Stack
- Backend: FastAPI + MongoDB
- Frontend: React + Tailwind + shadcn/ui
- Librerías clave: jsPDF, xlsx (SheetJS)

## Last Implemented (Feb 2026)
- [Bugfix CRÍTICO] `POST /api/attendance/justify` retornaba **500** en producción cuando el registro de asistencia ya existía sin `grade_id`/`section_id`. Causa: `$set` y `$setOnInsert` apuntaban al mismo campo (`grade_id`/`section_id`), MongoDB rechaza con `WriteError 40 "Updating the path 'X' would create a conflict at 'X'"`. FIX: construir `$setOnInsert` excluyendo los campos que ya están en `$set`. Validado con 3 escenarios (registro sin grade_id, re-justificar, fecha nueva) — todos retornan 200.
- [Bugfix] Justificación de asistencia manual no persistía en producción cuando los registros nuevos quedaban con `grade_id: null`. FIX: `JustifyAttendanceRequest` acepta `grade_id`/`section_id` explícitos desde el frontend; `AttendancePage.jsx` y `TeacherAttendancePage.jsx` los envían. Endpoint nuevo `POST /api/attendance/backfill-grade-section` (admin) para reparar registros antiguos huérfanos.
- [Bugfix] Modal de Yape — el monto se mantenía fijo en pensión (S/200) en pasos 2 y 3 cuando había suscripciones extras (libros). FIX: `ParentDashboardPage.jsx` ahora pasa `amount = monthTotal` y `total_amount = monthTotal` cuando hay extras del mes, además del `breakdown`. Validado por testing agent (frontend, 100%) — iteración 135.
- [Bugfix] Pronto Pago no se respetaba en detalle de "Pago Pensión".
- [Bugfix] Dashboard del Padre tampoco respetaba el pronto pago.
- [Feature] Modo masivo de asignación de Suscripciones en Contabilidad.
- [UI/UX] Asistencia manual ordenada por apellido con formato "Apellido Nombre".
- [Feature] Exportar Reporte de Asistencia a Excel y PDF individual.
- [Feature] Importación masiva de Profesores vía Excel.
- [Feature] Módulo de Pago a Profesores / Planilla Docente con egresos automáticos.
- [Feature] Switch para bloquear login de padres morosos.

## Backlog (priorizado)

### P1
- Psicología: log de auditoría estricto.

### P2
- Crear módulo de "Encuestas".
- Optimización servidor en exámenes masivos (3000 estudiantes).
- Refactorizar `CourseDetailPage.jsx` (>11.000 líneas) y `UsersPage.jsx` (>6.000 líneas).
- Plantilla "Adventista" para carnets QR.

### P3
- Gráfica de evolución (IMC) en historial Tópico.
- Botón "Bloquear plantilla" a nivel colegio (admin).
- Papelera de reciclaje para profesor (soft-delete 30 días).
- Banner amarillo de tareas atrasadas en dashboard del alumno.

## Recurring Issues
- Usuario olvida hacer "Save to Github" — recordar al final de cada cambio.
- `insertBefore en Node` al escanear QR desde Android con traductor de Google (pendiente).

## Key APIs
- `POST /api/auth/login`
- `GET /api/parent/dashboard`
- `GET /api/parent/payments`
- `POST /api/parent-payments/report`

## Key DB Schema
- `teacher_payments`: {school_id, teacher_id, period_year, period_month, payment_type, amount, status, egreso_id}
- `schools`: {..., restrict_parent_login_if_debt}
- `payments`: {school_id, student_id, pension_month, concept, payment_status, total_amount, ...}

## Test Credentials
Ver `/app/memory/test_credentials.md`.
