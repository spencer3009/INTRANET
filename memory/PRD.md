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
- [Feature] **Modal Nuevo Examen — Vinculación dinámica al Registro Auxiliar**. Antes solo aceptaba EM/EB/P1/P2/P3 hardcodeados; ahora replica la lógica del modal Nueva Tarea y muestra TODAS las subcolumnas tipo input de la plantilla activa del colegio (criterios + columnas_finales) agrupadas por criterio con badges de disponibilidad (Disponible / Ya asignado / Notas manuales). 
  - Backend (`services/register_sync.py`): nuevas helpers `get_active_template_for_school` y `get_valid_exam_columns_for_school`.
  - Backend (`routes/exams.py`): `_validate_register_linkage` ahora valida exámenes contra el set dinámico (no más limitación EM/EB/P1/P2/P3); check de notas manuales soporta tanto static (`student_grades.<field>`) como dinámico (`grades_dynamic.<column_id>`); `GET /api/register/availability` reescrito devuelve `columns: [...]` con la lista completa Y mantiene `availability: {...}` legacy para compat con el modal Tareas.
  - Frontend (`CourseDetailPage.jsx ExamModal`): state `examColumnGroups` reemplaza a `columnasVinculables`; render replica el patrón Nueva Tarea (radios agrupados por criterio, título amarillo `#FBBF24`, scroll interno 360px, contador "X disponibles · Y ya asignadas"). Auto-selección en edición preservada vía `slot.assigned_to?.id === exam.id`.
  - Validado: 8 tests backend con curl (crear/editar/eliminar examen con columnas dinámicas, conflicto 409, notas manuales, plantilla custom PLANTILLA 1) y test frontend agent (iter 136 — 5/9 tests críticos UI PASS, 0 issues bloqueantes).
- [Bugfix CRÍTICO] `POST /api/attendance/justify` retornaba 500 en producción cuando el registro existía sin `grade_id`/`section_id`. FIX: `$setOnInsert` excluye campos ya presentes en `$set` para evitar `WriteError 40`.
- [Bugfix] Justificación de asistencia manual no persistía en producción. FIX: `JustifyAttendanceRequest` acepta `grade_id`/`section_id` explícitos desde el frontend.
- [Bugfix] Modal de Yape — monto incorrecto en pasos 2/3 cuando había suscripciones extras. FIX: `ParentDashboardPage.jsx` pasa `monthTotal` correcto.
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
