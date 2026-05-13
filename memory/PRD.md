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

## Last Implemented (May 2026)
- [Feature] **Sprint C — Áreas Curriculares con scope_grade_ids a nivel de ÁREA + Wizard de creación**. Las áreas ahora pueden crearse acotadas a un rango de grados desde el inicio. Conviven dos modos: `scope_grade_ids=[]` → área global (MINEDU), lista no vacía → área acotada (ej. "Aritmética Avanzada 4°-5° Sec"). Backend: campos `scope_grade_ids` + `scope_label` en `GET/POST/PUT /curricular-areas`; helper `_compute_scope_label` genera labels legibles tipo "Primaria · 4° a 6° + Secundaria · 1° a 5°". Frontend nuevo: `AreaWizardModal.jsx` (wizard 3 pasos con stepper visual — grados → nombre/color → asignaturas opcionales); `GradeScopePicker.jsx` (selector reutilizable usado también en modal edición). Tabla principal muestra badge de scope por área. Bug fix: corregida llamada `/api/subjects` → `/api/academic/subjects` (404 silencioso). Testing iter 141: Backend 8/8 PASS, Frontend ~90% green, sin regresiones.

- [Feature] **Sprint B — Áreas Curriculares con Scope por Grado** (en las VINCULACIONES). Las áreas MINEDU siguen siendo globales, pero la composición de asignaturas dentro de un área puede variar por grado/nivel. Backend: nuevo `GET /curricular-areas/grade-shortcuts` con atajos dinámicos (`all`, `level:<uuid>`, `sec_first_<uuid>`/`sec_last_<uuid>`); `GET /{area_id}/subjects` retorna `grade_breakdown` por asignatura conceptual; `POST /link` y `/unlink` aceptan `grade_ids` opcional; `/available-subjects?grade_ids=g1,g2`. Frontend (`AreaSubjectsManager.jsx`): acordeón doble nivel (Grado → Asignatura) con headers tipo "INICIAL · 3 AÑOS · (2 asignaturas · 4 instancias)" + `LinkSubjectsSubModal` con paso 1 (atajos rápidos chip-style + Selección individual expandible por nivel) y paso 2 (asignaturas disponibles filtradas por scope). Bug fixes asociados: page_size cap 200 (era 500 → 422); helper `errMsg()` que coerce arrays de validación a string para no romper React. Testing iter 140: Backend 12/12 pytest + Frontend E2E 100% PASS, sin regresiones en Libreta/Consolidado.

- [Feature] **Gestión Manual de Asignaturas por Área — Fase 2 Frontend**. Modal de Áreas Curriculares expandido con acordeón colapsable "Asignaturas vinculadas (N)" montado dentro del modal de edición existente (NO standalone). Componente `AreaSubjectsManager.jsx` (lazy-load, search 300ms debounce, paginación 20/pp, selección masiva con checkbox de página) + sub-modal `LinkSubjectsSubModal` con toggle "Solo asignaturas sin área" (default ON), badges ámbar de área actual, warning banner dinámico de reasignación. Toasts pluralizados (1/2-3/4+/mezcla/no-op/errors[]). Contador en columna ASIGNATURAS de tabla principal refresca automáticamente sin reload. Operaciones transaccionales: cerrar modal sin Guardar metadata NO revierte vinculaciones. Testing iter 139 → **100% frontend PASS, 13/13 comportamientos**, sin bugs. Lista para validación del director en preview.

- [Feature] **Fase 3 Turno F2 — Cierre módulo Libreta**. Consolidado de Notas se convierte en hub: action bar arriba con 3 botones (Áreas Curriculares, Cerrar Bimestre, Descargar Excel) por permisos, nueva columna "Libreta" con botón Ver/candado por alumno, sidebar limpio sin Áreas ni Cierre (rutas standalone preservadas). RightDrawer.jsx + AdminCurricularAreasPage/AdminCierreBimestrePage en modo `embedded`. PDF con `react-to-print@3.3.0` y `@media print` que aísla `.libreta-printable`. Callback `onClosePeriod` marca períodos cerrados en tiempo real en la columna Libreta. 10/10 tests frontend PASS (iter 138). Módulo Libreta cerrado, **listo para mostrar a clientes en preview**.

- [Feature] **Fase 3 Turno F1 — Libreta Visual del Estudiante**. Página `/libreta/:student_id` con render idéntico al Colegio El Roble: cabecera (logo + legal_name + foto/iniciales + bimestre), tabla principal con áreas (rowspan) + asignaturas + I/II/III/IV/Promedio, conducta editable (AD/A/B/C, autosave + N.F.), estadística, asistencias con totales, comentarios del tutor (debounce 600ms), situación final (PROMOVIDO/REQ_RECUPERACION/REPITE + multi-select cursos a recuperar, sólo si bim IV cerrado). Banner amarillo para libretas snapshot. Cross-nav desde Consolidado (nombre → libreta), Dashboard alumno y Dashboard padre. Permisos: owner/admin/director cualquier alumno, teacher con asignación, parent su hijo, student su libreta. Bloqueo de bimestre cerrado (HTTP 423 → toast + reload). 12/12 tests frontend PASS (iter 137). Pendiente Turno F2: exportación PDF con react-to-print.

## Previously Implemented (Feb 2026)
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
- **Fase 3 Turno F2 — Libreta**: ✅ COMPLETADO
- **Limpieza de alumnos fantasma**: 35 cuentas `*.stress@elroble.edu` sin sección real ni notas. Decidir si eliminar/desactivar/dejar.
- Psicología: log de auditoría estricto.
- Deploy manual Ola 2 y Ola 3 (esperando confirmación; backups en `/app/memory/wave_deploy/`).

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
