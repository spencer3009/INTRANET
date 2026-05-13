# EduNet - Changelog

## Feb 13, 2026 - Fork (Tutorías Fase B: Matriz de Gobernanza Admin) — COMPLETED ✅

### Feature: AdminTutoringOverviewPage — gestión centralizada de tutores por sección
- **Página nueva** `/app/frontend/src/pages/AdminTutoringOverviewPage.jsx` (~520 líneas) accesible en `/:subdomain/admin/tutoring-overview` para roles owner/admin/director/coordinator (gating `isAdmin(user)`).
- **Sidebar**: nuevo item "Tutorías" en `AdminSidebar.jsx` bajo sección **ESTRUCTURA ACADÉMICA** (icono `UserCheck`).
- **UI**: integra `AdminSidebar` + `DashboardHeader`. Summary cards (Secciones totales, Con tutor, Sin tutor, Tutores activos). Filtros: búsqueda libre, estado (todas/asignadas/sin asignar), nivel, tutor, bimestre. Tabla con Nivel/Grado/Sección/Tutor actual/# Alumnos/% Coment/% Conducta/Acciones.
- **Acciones por fila**: "Asignar" (sin tutor) / "Cambiar" (con tutor) abre modal con selector de profesor → `PUT /api/sections/{id}/tutor` con `{teacher_id}`. "Quitar" envía `{teacher_id: null}` (borrado lógico → `status: inactivo`).
- **Reasignación masiva**: checkboxes multi-select → barra inferior con contador → modal de transferencia → `POST /api/admin/tutorings/transfer` con `{section_ids[], new_teacher_id}`. Botón secundario "Quitar a todos" para retirar tutorías en bulk.
- **Indicadores de avance**: badges de % Comentarios y % Conducta (verde ≥90, ámbar ≥50, rojo <50) calculados por el backend cuando se pasa `period_id`.
- **Mejoras de UX** (post-testing): celdas Nivel/Grado de secciones huérfanas muestran badge `sin nivel`/`sin grado` en cursiva ámbar en lugar de `—`; toasts de bulk transfer separados (asignar vs quitar) en lugar de mensaje concatenado.
- **Testing**: backend 9/9 pytest (`/app/backend/tests/test_tutoring_admin_phase_b.py`) — overview/single PUT/bulk transfer/auth guards. Frontend smoke + flujos completos (load, filtros, modal asignar, modal bulk transfer, sidebar highlight). 13 secciones detectadas en colegio elroble, 1 asignada (Robles Miro Raphael — INICIAL 3 años A) preservada tras tests.
- **NO Save to GitHub / NO Deploy** — listo en preview, esperando que el usuario redespliegue a edunet.pe.



## May 13, 2026 - Fork (Libreta: rediseño fiel al modelo HTML del Colegio El Roble) — COMPLETED ✅

### Feature: LibretaCard reescrita para coincidir con el `libreta.html` de referencia
- **Solicitud del usuario**: usar el HTML provisto como single source of truth para la estructura visual de la libreta. El layout anterior no coincidía (usaba tablas con bordes slate, header en grid 12-col, asistencias con 4 filas en vez de 5, sin página 2 de firmas).
- **Rewrite completo** de `/app/frontend/src/components/libreta/LibretaCard.jsx` y `LibretaCard.css`:
  - Header con flexbox: logo (80x80, izq), bloque central (INSTITUCIÓN EDUCATIVA PRIVADA / nombre colegio en Times New Roman 22px bold / Informe de Progreso en azul `#2a4f6f` 18px / NIVEL / BIMESTRE), foto del alumno (80x90 borde gris, der).
  - Datos del alumno: grid de 4 columnas con `value-box` redondeados (border-radius 8px, border negro): Código / Apellidos y Nombres / Salón / N°Ord.
  - Tabla de calificaciones: bordes negros 1px, fondos blancos, notas en rojo `#c00`, Promedio Final en bold. Soporta 3 casos de área:
    - 1 subject con nombre = área → colspan=2 (caso INGLES, EDUCACIÓN FISICA).
    - 1 subject con nombre ≠ área → 2 celdas separadas, sin fila promedio.
    - N>1 subjects → rowspan en área + fila "Promedio Área:" en bold.
  - 2 columnas de tablas info: izq CONDUCTA + ASISTENCIAS Y TARDANZAS (5 filas: Presente, Tardanza Injustificada, Tardanza Justificada, Falta Injustificada, Falta Justificada); der ESTADÍSTICA (Puntaje, Promedio, Cursos Desaprobados, Orden de Mérito, Tercio por Salón).
  - Comentarios de la tutora: 4 filas (I/II/III/IV) con textareas editables.
  - Situación final: 3 filas (PROMOVIDO / REQ. RECUPERACIÓN / REPITE) con columna X y rowspan=3 para cursos a recuperar.
  - **Página 2 nueva**: separada con `page-break-before: always`, header de nombre + "Página 2", y firmas (TUTORA con nombre del tutor + DIRECTORA).
- **Lógica preservada**: edición de conducta con dropdown, comentarios con debounce 600ms, lockdown por bimestre cerrado (HTTP 423), situación final habilitada solo tras cerrar el bim IV, multi-select de cursos a recuperar.
- **Print-ready**: `@page A4 margin 1.5cm`, `print-color-adjust: exact` para conservar el rojo de notas, page-break en filas largas.
- **NO Save to GitHub / NO Deploy** — listo en preview, esperando que el usuario redespliegue a edunet.pe.


## May 13, 2026 - Fork (Sprint C: Áreas Curriculares con scope_grade_ids desde la creación) — COMPLETED ✅

### Feature: Wizard de 3 pasos + scope por grado a nivel de ÁREA
- **Decisión de arquitectura**: las áreas conviven en dos modos. `scope_grade_ids=[]` → área **global** (como MINEDU). Lista no vacía → área **acotada** al rango de grados. Esto permite "Aritmética Avanzada 4°-5° Sec" sin destruir las 10 áreas MINEDU originales.
- **Backend** (`/app/backend/routes/curricular_areas.py`):
  - `CurricularAreaIn` / `CurricularAreaUpdate` aceptan `scope_grade_ids: Optional[List[str]]`.
  - Nuevo helper `_compute_scope_label(scope_grade_ids, grades_by_id)` produce labels legibles: "Global (todos los grados)" / "Primaria · 1° a 6°" / "Primaria · 4° a 6° + Secundaria · 1° a 5°".
  - `GET /curricular-areas` enriquece la response con `scope_grade_ids` y `scope_label` (usa `_load_school_grade_index` ya existente).
  - POST/PUT/seed persisten `scope_grade_ids`.
- **Frontend nuevo**:
  - `AreaWizardModal.jsx` — Modal de 3 pasos (① Grados con atajos rápidos + checkboxes individuales por nivel, ② Nombre + color + orden con presets, ③ Asignaturas opcionales filtradas por scope). Stepper visual con estados pending/active/done. Crea el área Y vincula asignaturas en un solo flujo.
  - `GradeScopePicker.jsx` — Componente reutilizable de selector de grados con atajos + checkboxes; usado en el wizard step 1 y en el modal de edición existente.
- **Frontend actualizado** (`AdminCurricularAreasPage.jsx`):
  - Botón "Nueva área" abre el wizard en lugar del modal simple.
  - Cada fila de la tabla muestra un badge con `scope_label`. Badge slate para global, badge azul para áreas acotadas.
  - Modal de Edición existente incluye `GradeScopePicker` para modificar el scope de un área activa.
- **Bug fix asociado**: La página llamaba `/api/subjects` (no existe → 404 toast "Not Found"). Cambiado a `/api/academic/subjects` que es el endpoint real.
- **Testing**: `testing_agent_v3_fork` iter 141 — Backend 8/8 pytest PASS (`/app/backend/tests/test_curricular_areas_sprint_c.py`), Frontend ~90% green, sin regresiones en Sprint B ni en Libreta/Consolidado.
- **NO Save to GitHub / NO Deploy** — listo en preview.


## May 13, 2026 - Fork (Sprint B: Scope por grado en vinculaciones área↔asignatura) — COMPLETED ✅

### Feature: Acordeón doble nivel (Grado → Asignatura) + Sub-modal con selector de grados
- **Backend** (`/app/backend/routes/curricular_areas.py`):
  - `GET /curricular-areas/grade-shortcuts` (NUEVO) retorna atajos dinámicos `all`, `level:<uuid>` por cada nivel existente, y `sec_first_<uuid>` / `sec_last_<uuid>` para sub-rangos de secundaria.
  - `GET /curricular-areas/{area_id}/subjects` ahora incluye `grade_breakdown` por asignatura conceptual con `instance_ids`, `instances_count`, `grade_id/name`, `level_id/name`, orden.
  - `POST /subjects/link` y `/unlink` aceptan `grade_ids` opcional para limitar el scope al subconjunto de grados elegido.
  - `GET /available-subjects` soporta `grade_ids` (csv) para filtrar por grado.
- **Frontend** (`/app/frontend/src/components/curricular/AreaSubjectsManager.jsx`):
  - Reescrito para reagrupar `data.subjects[].grade_breakdown` en buckets de doble nivel (Grado → Asignatura conceptual) con headers tipo "INICIAL · 3 AÑOS (2 asignaturas · 4 instancias)".
  - `LinkSubjectsSubModal`: paso 1 selector de grados con atajos rápidos (chips) + "Selección individual" expandible agrupada por nivel; paso 2 tabla de asignaturas disponibles filtrada por scope.
  - `data-testid` completos: `expand-area-<id>`, `grade-bucket-<key>`, `open-link-submodal-btn`, `link-submodal`, `grade-shortcut-<key>`, `toggle-individual-grades`, `grade-checkbox-<id>`, `confirm-link-btn`.
- **Bug fixes durante este sprint**:
  1. Frontend enviaba `page_size=500` pero backend caps a `le=200` → 422 validation. Cambiado a 200.
  2. Errores 422 de FastAPI devuelven `detail` como array de objetos → React crasheaba al renderizar la respuesta como child. Agregado helper `errMsg(err, fallback)` que coerce a string seguro.
- **Testing**: `testing_agent_v3_fork` iter 140 — Backend 12/12 pytest PASS (`/app/backend/tests/test_curricular_areas_sprint_b.py`), Frontend E2E 100% PASS, sin regresiones en Libreta/Consolidado. Round-trip link+unlink restauró data original.
- **NO Save to GitHub / NO Deploy** — listo en preview para validación del usuario.


## May 12, 2026 - Fork (Feature: Gestión Manual de Asignaturas — Fase 2 Frontend) — REVISADO

### Feature: Modal de Áreas Curriculares expandido con acordeón de asignaturas — COMPLETED + correctivos
- **Acordeón colapsable** "Asignaturas vinculadas (N)" montado **dentro** del modal existente de edición en `AdminCurricularAreasPage.jsx` (NO se creó página standalone). Lazy-load: el endpoint `GET /curricular-areas/{id}/subjects` sólo se llama al expandir.
- **Componente `AreaSubjectsManager.jsx`**: toolbar con buscador (debounce 300ms) + botones "Vincular asignaturas" / "Desvincular seleccionadas (N)", tabla paginada (20/página) con selección individual y masiva, scroll vertical interno (max-h 420px), confirmación previa a desvincular individual/masivo y toasts pluralizados (1 / 2-3 / 4+ / mezcla).
- **Sub-modal `LinkSubjectsSubModal`**: toggle "Solo asignaturas sin área" ON por default, llama `/available-subjects?unassigned_only=true|false`. Filas con badge ámbar mostrando el área actual cuando aplica. Banner de warning de reasignación dinámico listando hasta 5 asignaturas + recuento. Toast distingue casos: vinculación nueva, reasignación pura, mezcla, no-op, errores parciales.
- **Refresco automático del contador** en la columna "ASIGNATURAS" de la tabla principal vía `onChange={loadAreas}` + `areasRef` para evitar closures stale.
- **CORRECTIVO 1 — Fix fetch redundante (de 3 calls → 1 call en mount)**: agregado guard contra React Strict Mode double-invoke con `prevSearchRef` y `prevPageDepsRef` (comparación de "valor anterior"). Verificado E2E: sub-modal abre con 1 sola llamada a `/available-subjects`. Adicionalmente añadido `reqIdRef` (request id counter) en `load()` y `fetchSubjects()` para descartar respuestas obsoletas (anti race-condition para tipeo rápido o cambios rápidos de toggle).
- **CORRECTIVO 2 — 8 screenshots E2E capturados con `admin@elroble.edu`** mostrando: modal cerrado, modal abierto poblado, empty state (Inglés 0 subjects), sub-modal toggle ON default, sub-modal toggle OFF con banner de reasignación, confirmación de desvinculación masiva, toast "Vinculada: Algebra al área", toast "2 asignaturas reasignadas a esta área" + banner detallando origen de cada una.
- **Testing**: `testing_agent_v3_fork` iter 139 → 100% frontend PASS, 13/13 comportamientos verificados.
- **NO Save to GitHub / NO Deploy** — listo en preview, pendiente Fase 3 E2E con cuenta real.


## May 12, 2026 - Fork (Fase 3 Turno F2 — Cierre del módulo Libreta)

### Feature: Consolidado como hub + Drawers + PDF + Portal padre — COMPLETED
- **Sidebar limpio**: removidas las entradas "Áreas Curriculares" y "Cierre de Bimestre". Las rutas `/areas-curriculares` y `/cierre-bimestre` siguen activas (bookmarks no se rompen).
- **Action bar en Consolidado**: cabecera `Consolidado de Notas — {año}` con 3 botones (Áreas Curriculares, Cerrar Bimestre, Descargar Excel) con permisos por rol.
- **Drawers laterales**: nuevo `RightDrawer.jsx` (backdrop + slide-in + ESC + X). `AdminCurricularAreasPage` y `AdminCierreBimestrePage` aceptan prop `embedded` para renderizarse sin Sidebar/topbar dentro del drawer.
- **Columna "Libreta"** en la tabla del consolidado: botón "Ver" por alumno → `/libreta/{id}?period_id=`. Bimestre cerrado: badge ámbar con candado.
- **PDF export**: `react-to-print@3.3.0`. Botón "Descargar PDF" en LibretaPage. `@media print` con `.libreta-printable` aislado, color-adjust:exact y saltos inteligentes. Archivo: `Libreta_{codigo}_{bimestre}_{año}.pdf` (157 KB generado en prueba).
- **Callback `onClosePeriod`**: al cerrar bimestre desde drawer, Consolidado marca el período como cerrado sin refresh.
- **Testing**: testing_agent_v3_fork (iter 138) — **10/10 tests PASS**. Parent readonly verificado. Sin bugs.
- **NO Save to GitHub / NO Deploy**. El módulo libreta queda LISTO en preview para mostrar a clientes.

## May 12, 2026 - Fork (Fase 3 Turno F1 — Libreta Visual del Estudiante)

### Feature: Vista visual de la libreta + edición inline + navegación cruzada - COMPLETED
- **Frontend nuevo**:
  - `pages/LibretaPage.jsx`: contenedor con barra de controles (volver, selector de bimestre, placeholder PDF), banner de snapshot congelado, estados loading/error/403.
  - `components/libreta/LibretaCard.jsx`: layout idéntico al Colegio El Roble — cabecera (logo + legal_name + foto/iniciales del alumno + año/nivel/bimestre), tabla de identificación, tabla principal con rowspan de áreas (I/II/III/IV/Promedio), conducta editable (select AD/A/B/C con autosave + N.F. computada), estadística (puntaje/promedio/desaprobados/orden mérito/tercio), asistencias con totales, comentarios por bimestre (textarea con debounce 600ms), situación final (PROMOVIDO/REQ_RECUPERACION/REPITE + multi-select de cursos a recuperar, habilitada sólo si bimestre IV cerrado).
  - `components/libreta/LibretaCard.css`: estilos del documento con `@media print` listos para Turno F2.
- **Rutas registradas en `App.js`**: `/libreta/:student_id` y `/:subdomain/libreta/:student_id` (ProtectedRoute + 'libreta' agregado a `knownNonSchool` para no confundir el segmento con un subdominio).
- **Navegación cruzada**:
  - `ConsolidatedGradesPage.jsx`: el nombre del alumno ahora es `<Link>` a `/libreta/{student_id}?period_id=...`.
  - `StudentDashboardPage.jsx`: card destacada "Mi Libreta del Estudiante" (`data-testid=student-mi-libreta-card`).
  - `ParentDashboardPage.jsx`: card "Libreta de {selectedChild.name}" (`data-testid=parent-mi-libreta-card`).
- **Bloqueo de bimestre cerrado**: las celdas de conducta de bimestres con snapshot ya no son select; los textareas de comentarios pasan a `readOnly` con placeholder "(Bimestre cerrado)". Manejo de HTTP 423 con toast + recarga.
- **Testing**: testing_agent_v3_fork — 12/12 tests ejecutables PASS (frontend). Tests 4 (alumno logueado) y 13 (teacher sin asignación) saltados por falta de credenciales. Backend Fase 1 + Fase 2 ya validado por pytest previo.
- **Visual fidelity**: 9/10 vs Colegio El Roble (cabecera + tabla principal + bloques inferiores).
- **NO Save to GitHub / NO Deploy**: respetando la estrategia de deploy por olas del usuario.


## April 27, 2026 - Fork (Subscription Inline Payment Fix)

### Fix: Sincronización Estado Financiero ↔ Yape (eliminada contradicción AL DÍA / PENDIENTE) - COMPLETED
- **Frontend** (`ParentDashboardPage.jsx` + `ParentPaymentsPage.jsx`): "Estado Financiero" en el dashboard Y en la página `Ver detalle de pagos` ahora computan la deuda del mes con la misma lógica que la tarjeta Yape: 
  1. Suma cuotas pendientes en `monthly_detail` para el mes en curso (mensualidades).
  2. Suma cargos extra del mismo `pension_month` desde el `yapeSchedule` (libros, talleres) que no estén verificados.
  3. Si NO hay registro en BD pero `pension_mensual > 0` y la mensualidad del mes no está pagada vía Yape, **deriva** la cuota del `financial_config` (con pronto pago e interés diario aplicados igual que la tarjeta Yape).
- **Badge Status**: Ahora calcula `effectiveStatus` que degrada `al_dia` → `pendiente` cuando existe deuda derivada del mes en curso. Se agregó nuevo badge "PENDIENTE" (ámbar).
- Verificación: con alumno fresh (sin payments registrados, pension_mensual=350, mora 22d), Estado Financiero ahora muestra **PENDIENTE / S/362.83 (+S/12.83 mora)** coincidiendo con la tarjeta Yape.

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
