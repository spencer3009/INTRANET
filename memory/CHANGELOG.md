# CHANGELOG — Edunet (SaaS Escolar)

## 2026-08-21 — Constancia de Matrícula: formato EXACTO al modelo oficial + escudo MINEDU
- Rediseñada la tabla para replicar 1:1 el modelo SIAGIE del usuario: grilla de 6 columnas con celdas combinadas, **etiquetas grises alineadas a la derecha en negrita**, valores centrados. Filas: ESTUDIANTE | nombre | DNI | valor | CÓDIGO | valor; INSTITUCIÓN EDUCATIVA | código modular | nombre I.E. (span); PERÍODO PROMOCIONAL | DEL | fecha | AL | fecha; CICLO / NIVEL | nivel | GRADO EDUCATIVO | grado; SECCIÓN | A | TURNO | turno; APODERADO | nombre (span). Título centrado en azul.
- **Escudo del MINEDU** (asset del usuario `escudo.webp` → `assets/minedu_escudo.png`) reemplaza el logo del colegio en el encabezado (arriba-izquierda), con "Fecha/Pág." arriba-derecha.
- Verificado visualmente: render idéntico al modelo. `services/constancia_pdf_generator.py` reescrito (single + batch usan la misma story). Requiere Deploy.

## 2026-08-21 — Constancia de Matrícula: período real, RUC/Código Modular y descarga en lote
- **Período Promocional** ahora se toma de **Períodos Académicos** (`academic_periods`): DEL = fecha_inicio más temprana, AL = fecha_fin más tardía del año escolar activo (fallback 01/03–31/12).
- **Código Modular + RUC en el encabezado**: nuevo campo "Código Modular" en Ajustes → Libretas (`school.codigo_modular`, GET/PUT `/api/report-cards/settings`); el RUC se reutiliza del Sello (`libreta_stamp_config.ruc`). Se muestran bajo el nombre del colegio.
- **Nombre del director**: ya configurable en Ajustes → Libretas ("Nombre del director(a)", `libreta_director_name`); se imprime sobre la línea de firma. (Sin cambios, confirmado).
- **Constancia en Lote**: nuevo `GET /api/sections/{section_id}/constancias-matricula` genera **un solo PDF** con una constancia por página para todos los alumnos activos de la sección (ordenados por apellido). Botón "Constancias (lote)" en el header de cada sección en `/users` (admin/director/owner).
- Backend: `services/constancia_pdf_generator.py` refactorizado (story compartida + modo batch con PageBreak, caché de logo). `routes/users.py` (helpers `_constancia_period`, `_constancia_student_detail` + 2 endpoints). Frontend: `LibretasSettingsTab.jsx` (input código modular), `UsersPage.jsx` (botón lote).
- Verificado visualmente (render con RUC/código/director + período real; batch 5 páginas OK); frontend compila. Requiere Deploy.

## 2026-08-21 — Constancia de Matrícula: reformateada al formato oficial (tipo SIAGIE)
- A pedido del usuario (subió PDF modelo), la Constancia se rehízo al **formato tabular oficial**: encabezado (logo + nombre legal del colegio + "Fecha/Pág." a la derecha), regla horizontal, título centrado "CONSTANCIA DE MATRÍCULA {año}", tabla bordeada con etiquetas sombreadas (ESTUDIANTE [APELLIDOS, NOMBRES], DNI, INSTITUCIÓN EDUCATIVA, CÓDIGO [student_code], PERÍODO PROMOCIONAL [DEL 01/03 AL 31/12], CICLO/NIVEL, SECCIÓN, GRADO, APODERADO, TURNO) y pie "Director(a) / Sub Director(a) — Firma - Post Firma y Sello".
- Endpoint `GET /api/students/{id}/constancia-matricula` ahora resuelve además TURNO (`shifts`) y APODERADO (padre vía `padre_id`). `services/constancia_pdf_generator.py` reescrito.
- Verificado visualmente (render coincide con el modelo). Requiere Deploy.

## 2026-08-21 — Feature: Botón "Constancia" (Constancia de Matrícula PDF) en tarjeta de alumno
- Nuevo botón con ícono de documento etiquetado "Constancia" al lado del QR en la tarjeta del alumno (`/users`, vista agrupada). Al hacer clic descarga un PDF de Constancia de Matrícula.
- Solo visible/permitido para **owner/admin/director** (front `canIssueConstancia` + backend gate).
- Backend: `GET /api/students/{student_id}/constancia-matricula` (`routes/users.py`) + nuevo generador `services/constancia_pdf_generator.py` (ReportLab). El PDF incluye logo + nombre legal del colegio, título "CONSTANCIA DE MATRÍCULA", nombre completo + DNI del alumno, nivel/grado/sección, año escolar (de `academic_years`), fecha de emisión y bloque de firma DIRECTOR(A) (con nombre si `schools.libreta_director_name`).
- Datos resueltos de: `academic_levels`, `grades`, `sections`, `academic_years`, `schools`.
- Verificado: PDF genera OK (34KB, contenido correcto validado); frontend compila; endpoint protegido (401 sin token). Requiere Deploy a producción.


## 2026-07-15 — Fix P0: no se podía guardar "Clase en vivo" (NameError PERU_TZ)
- Causa raíz: `routes/live_classes.py` usaba `PERU_TZ` en `compute_class_status` (L67) y `join_live_class` (L266) pero NUNCA lo importaba desde `.core` → `NameError` → HTTP 500 al crear clase (el doc se insertaba pero la respuesta reventaba) y también rompía el "unirse a clase" del alumno.
- Fix backend: agregado `PERU_TZ` al import desde `.core`. Verificado E2E local (create + get detail sin error; el bloqueo de suscripción del preview impide curl E2E).
- Fix frontend (robustez): `LiveClassInlineForm` ahora usa el `section_id` del propio curso como respaldo si no se deriva de las asignaciones (evita 403/404 en cursos a nivel de grado). `CourseDetailPage.jsx`.
- Requiere Deploy a producción.


## 2026-07-15 — CAUSA REAL libreta acumulada: filtro "solo último bimestre cerrado"
- Raíz definitiva (routes/libreta.py ~L821): en el camino EN VIVO, sin period_id y en modo bimestral, se aplicaba `keep_ids = {último bimestre CERRADO}` y se blanqueaban los demás. Con BIM I cerrado y BIM II activo, mostraba SOLO BIM I y borraba BIM II (bimestre en curso). Esto explica el patrón sistemático.
- Fix: cuando `all_periods=true`, NO se aplica ese filtro → se muestran TODOS los bimestres calificados (en vivo, coincidiendo con el Consolidado/Registro Auxiliar).
- Se revirtió la complejidad previa de snapshots/merge para all_periods (innecesaria): all_periods ahora va directo al cálculo en vivo. La libreta oficial de un solo bimestre (period_id sin all_periods) y la vista de cerrados quedan intactas.
- Validado: GET /api/libreta/{id}?all_periods=true → is_snapshot=False y devuelve los 4 bimestres sin recortar.
- Requiere Deploy.


## 2026-07-15 — Libreta acumulada: FUSIÓN de snapshots (la "combinación perfecta")
- Dato clave del usuario: con `?period_id=BIM_II` se veía BIM II (vía snapshot) y en vivo solo BIM I → el BIM II vive en el snapshot por período; la consulta en vivo no lo hallaba (mismatch sección/subject).
- Fix (routes/libreta.py, all_periods=true):
  1. Se elige el snapshot MÁS COMPLETO del alumno (más notas reales, no el de mayor orden — un bimestre cerrado posterior puede estar vacío).
  2. Se FUSIONAN las notas de TODOS los snapshots del alumno sobre ese payload base → aparecen todos los bimestres aunque cada uno esté congelado en un snapshot distinto.
  3. Se devuelve el payload SIN blanquear (early-return antes del blanking cuando all_periods).
  4. Si el alumno no tiene snapshots, cae al cálculo en vivo (que ya trae todos los periodos).
- La libreta oficial de UN bimestre (period_id sin all_periods) queda intacta.
- Requiere Deploy.


## 2026-07-15 — Libreta: columnas de bimestre vacías por FILAS DUPLICADAS (fix de raíz)
- Síntoma: en la libreta (Precursores TJ) a un alumno le faltaba el BIM I y a otro el BIM II, de forma inconsistente por alumno, aunque las notas existían.
- Causa raíz: existen filas duplicadas de student_grades para el mismo (subject_id, period_id) — una con nota real y otra vacía. El notes_lookup de la libreta usaba "la última gana", así que según el orden de Mongo, una fila vacía tapaba la buena.
- Fix (routes/libreta.py): se elige la MEJOR fila por (subject, period): prioridad final_grade_manual(3) > valor real(2) > vacía(0-1); a igualdad se prefiere la fila de la sección ACTUAL del alumno.
- Además: el botón "Ver libreta" del Consolidado ahora abre `?all_periods=true` SIN period_id → siempre muestra todos los bimestres calificados, independiente del filtro de período.
- Diagnóstico ampliado (/diag/final-grade): ahora devuelve academic_periods, period_orden/period_is_orphan por nota y duplicate_subject_period_rows + student_current_section.
- Requiere Deploy.


## 2026-07-15 — Libreta desde Consolidado ahora muestra TODOS los bimestres calificados
- Síntoma: al hacer clic en "ver libreta" desde el Consolidado, solo se veía el bimestre actual (ej. II); los bimestres anteriores calificados (I) salían vacíos.
- Causa: el "ver libreta" abría con `?period_id=<actual>` y el backend, al recibir un period_id con snapshot, BORRABA a propósito los demás bimestres (diseño de libreta oficial por bimestre, routes/libreta.py L337-387).
- Fix: nuevo parámetro `all_periods=true` en GET /api/libreta/{id}. Cuando viene, se OMITE el snapshot por bimestre y se usa el cálculo en vivo (que ya arma los 4 periodos). Los enlaces "ver libreta" del ConsolidatedGradesPage ahora usan `?all_periods=true&period_id=<actual>`. LibretaPage reenvía el flag. Comportamiento de libreta oficial de un solo bimestre se mantiene intacto sin el flag.
- Verificado (curl, colegio El Roble): all_periods=true → is_snapshot=False y devuelve BIMESTRE I/II/III/IV.
- Requiere Deploy para producción.


## 2026-07-15 — Doble turno (cont.): el flag `doble_turno` no estaba guardado en BD + herramienta de diagnóstico
- Diagnóstico en producción (San Juan Bosco, alumno QUIROZ OBREGON FABRIZIO) reveló: nivel coincide (SECUNDARIA), turnos válidos (2 sesiones), pero `doble_turno_flag=false` en `attendance_config.levels` pese a verse ON en la UI → por eso el escaneo caía al flujo normal.
- Backend verificado OK (AttendanceConfigUpdate persiste doble_turno=true). El problema era que el switch no quedaba persistido de forma fiable con el botón "Guardar".
- Fix: el switch "Doble turno" ahora AUTO-GUARDA al instante (`persistDobleTurno` → PUT /settings/attendance) con confirmación "Doble turno ACTIVADO y guardado", preservando los turnos del nivel. Elimina el caso "se ve ON pero en BD está OFF".
- Nueva herramienta de diagnóstico read-only: GET /api/attendance/diag/double-turno?q=&school_name= + sección "0. Diagnóstico Doble Turno" en /diag/registro-auxiliar (owner/soporte). Muestra nivel resuelto, ids/nombres de niveles del config, flag, turnos y si activaría doble turno.
- Requiere Deploy. Tras desplegar: en Ajustes→Asistencia, alternar el switch OFF→ON (ver confirmación) y revalidar con el diagnóstico.


## 2026-07-15 — FIX: Doble turno no registraba la entrada de la tarde (nivel del alumno sin resolver)
- Síntoma (producción): alumno de doble turno (SECUNDARIA), al escanear a las 3pm marcaba salida de la mañana en vez de la ENTRADA de la tarde.
- Causa raíz: la detección de doble turno en el escaneo (`routes/attendance.py`) usaba `scanned_user.nivel_id || level_id`. Muchos alumnos (34 de 91 en la BD local; el alumno afectado incluido) NO guardan `nivel_id` directo — su nivel se deriva del grado. Sin `nivel_id`, no había match con `attendance_config.levels` → nunca entraba al path de doble turno → caía al flujo normal (marcaba salida).
- Fix: si el alumno no tiene `nivel_id`/`level_id`, se resuelve el nivel A TRAVÉS del grado (`grades`/`grados` → `nivel_id`).
- Verificado (simulación local): escaneo 08:00 → "Entrada Mañana"; escaneo 15:00 → "Entrada Tarde registrada" (no salida); ambas sesiones (mañana+tarde) guardadas en el doc del día.
- Requiere Deploy para producción.


## 2026-07-15 — FIX RAÍZ: sincronización tareas/exámenes ahora refresca final_grade almacenado
- Causa raíz del desfase Consolidado/Registro Auxiliar: `services/register_sync.py` escribía la nota de tarea/examen en `grades_dynamic` (o campo estático) pero NUNCA recalculaba `final_grade`, dejando el valor almacenado perpetuamente desactualizado (2438 filas en El Roble).
- Fix: nuevo helper `_refresh_final_grade()` que recalcula con `calculate_final_grade` + plantilla activa y PERSISTE `final_grade` tras cada escritura, respetando `final_grade_manual`. Llamado en `_sync_exam_grades`, `_sync_task_grades`, `sync_single_student_exam`, `clear_single_student_exam`, `sync_single_student_task`.
- Verificado (python -c): caso EMMY 2do bim → stored pasa de 16 (stale) a 16.8 (=17) automáticamente.
- CONTEXTO: TODAS las vistas de usuario (Consolidado, Consolidado-report/Excel, Ranking, Libretas, Portal Profesor/Alumno) YA recalculaban en vivo → en pantalla ya coincidían. Este fix garantiza que el valor CRUDO en BD también quede consistente (exports/futuros consumidores), eliminando la necesidad del recálculo manual a futuro.
- Diagnóstico: buscador por alumno/curso en herramienta de recálculo + columnas renombradas ("Guardado en BD (antes)" vs "Recalculado / Registro Auxiliar") para no dar a entender que la pantalla del Consolidado esté mal.
- NO probado E2E (writes bloqueados por suscripción vencida del tenant en preview). Requiere Deploy para producción.


## 2026-07-15

### Bugfix (3) — Consolidado: columna de ÁREA promediaba asignaturas duplicadas/vacías
- Diagnóstico real (Precursores): la asignatura "Comunicaciones" recalcula 18, pero la
  columna de ÁREA "COMUNICACIÓN" mostraba 17 porque promediaba la asignatura real (18)
  con otra asignatura **duplicada/vacía** que solo tenía un `final_grade` viejo guardado
  (~16) → (18+16)/2 ≈ 17. Esto explica "se arregló para 1 alumno, otros no".
- Fix: en `consolidated-report`, el promedio de ÁREA (y la columna de asignatura) ahora
  IGNORA asignaturas sin datos reales del alumno (custom sin `grades_dynamic` ni campos
  legacy) — solo cuentan las que tienen notas de verdad. Se rastrea `real_lookup`.
- Nuevo endpoint `POST /grades/_maintenance/recompute-finals` (owner/soporte, con dry_run)
  para recalcular y PERSISTIR `final_grade` de todo el colegio → exportaciones/PDF que
  leen el valor guardado también quedan correctas. Botón en `/diag/registro-auxiliar`.


- Nuevo endpoint `GET /api/diag/final-grade` (owner/support, read-only): dado alumno
  (+curso/periodo/colegio) devuelve nota guardada, recalculada, manual y el desglose
  completo (criterios con sus subcolumnas y promedios, columnas finales, grupos, pesos)
  y la plantilla activa. Sirve para ver POR QUÉ el Consolidado difiere del Registro Aux.
- UI: sección "3. Diagnóstico de nota final" en `/diag/registro-auxiliar`.
- Motivo: tras redeploy el Consolidado seguía en 17; Precursores solo existe en producción
  (no accesible desde preview), así que se necesita inspeccionar los datos reales.

### Bugfix (2) — backend ignoraba columnas finales en modo criterio
- Causa REAL: en modo `criterio`, `calculate_final_grade_from_template` sumaba SOLO los
  criterios e IGNORABA las `columnas_finales` (EXAMEN MENSUAL/BIMESTRAL, PARC, ORAL...),
  mientras el frontend (`calcularPromedioBimestral`) SÍ las incluye. Por eso el Registro
  Auxiliar daba 18 (con exámenes) y el Consolidado 17 (sin exámenes).
- Fix: el backend ahora pondera también las columnas finales en modo criterio → coincide
  100% con el frontend. Verificado con la función real: caso tipo-Samuel = 18.1 → 18.

### Bugfix (1) — Redondeo de criterios + recálculo en vivo
- Causa: el cliente redondeaba el promedio de cada criterio a 1 decimal antes de combinar
  (→18); el backend (`_criterio_avg`) usaba el promedio CRUDO (→17).
- Backend: `_criterio_avg` ahora redondea a 1 decimal. Las lecturas de nota (consolidado
  x2, registro auxiliar, ranking, libreta, portal del alumno, notas del profesor) ahora
  RECALCULAN en vivo para plantillas custom y usan ese valor (fallback al almacenado
  para filas legacy) → corrige lo guardado SIN migración y respeta el override manual.
- Frontend: `calcularPromedioCriterioBackend` replica exactamente el backend.
- Validado: 200,000 casos → cliente y backend 100% consistentes.

## 2026-07-14

### Feature — Filtros Nivel/Grado/Sección/Turno + buscador en Contabilidad
- Nuevo bloque "Filtrar por" con 4 selects en cascada (Nivel → Grado → Sección → Turno
  + botón "Limpiar") en las pestañas **Ingresos** y **Morosos**.
- Backend: params `nivel_id`, `section_id`, `turno_id` (además de `grade_id`) en
  `GET /accounting/payments` y `GET /accounting/debtors`. Como los pagos no guardan
  nivel/turno, `nivel_id` resuelve los grados del nivel (`grade_id $in`) y `turno_id`
  resuelve los alumnos del turno (`student_id $in`).
- Frontend `AccountingPage.jsx`: estados separados por pestaña (Ingresos vs Morosos),
  fetch de `/academic/levels` y `/academic/shifts`; selects con data-testid
  `ingresos-filter-*` y `morosos-filter-*`.
- Verificado por curl (payments: 482→442→200→154; debtors: 77→57→36→20) y screenshots.

## 2026-07-13

### Feature — Doble turno por nivel (asistencia mañana + tarde)
- Nuevo switch **"Doble turno (mañana y tarde)"** por nivel en Ajustes → General →
  Asistencia (acordeón del nivel, sobre "Horario por turno"). Sirve para cualquier
  nivel (PRIMARIA, SECUNDARIA, etc.), no hay que editar alumno por alumno.
- Cuando el nivel tiene `doble_turno: true`, cada escaneo QR se rutea a una SESIÓN
  (turno) según la hora: el límite entre turnos es el punto medio entre la salida de
  un turno y la entrada del siguiente (ej. Mañana 07:45–13:30 / Tarde 15:00–16:30 →
  boundary 14:15). Soporta 4 marcas/día (entrada+salida por turno).
- El registro del día guarda `sessions[turno_id] = {entry_time, entry_status, exit_time,
  total_minutes, ...}` con **tardanza/falta independiente por turno**. Los campos
  top-level (`status`/`entry_time`/`exit_time`) se reflejan desde las sesiones para no
  romper reportes/PDF/portal padre (retrocompatible; niveles de un solo turno intactos).
- Backend: `settings.py` (campo `doble_turno` en `AttendanceLevelConfig`), `attendance.py`
  (`_double_turno_sessions`, `_pick_double_turno_session`, `_double_turno_top_level`,
  `_handle_double_turno_scan`; rama en `scan_qr_attendance`).
- Frontend: toggle en `SettingsPage.jsx` (`data-testid level-{id}-doble-turno-toggle`);
  el escáner muestra la sesión ("Entrada Mañana", "Salida Tarde") en `QRScannerTab.jsx`.
- Verificado: routing de sesión por hora (unit) + flujo E2E de 4 marcas contra BD real
  (`tests/test_doble_turno_scan.py`): mañana=late, tarde=present, 5ta marca=already_both,
  top-level status=late. NOTA: no se probó vía HTTP POST porque el tenant El Roble tiene
  la suscripción vencida (middleware bloquea writes); se validó llamando al handler.

## 2026-07-09

### Bugfix — Portal profesor mostraba curso de otra sección + duplicados
- `GET /api/teacher/courses` tomaba sección/grado de la ASIGNACIÓN (`academic_assignments`),
  que a veces tenía la sección equivocada → un curso de la sección B aparecía bajo A.
- Fix: la sección/grado/nivel ahora se derivan de la ASIGNATURA (fuente de verdad); fallback a la asignación.
- Fix: deduplicado por `subject_id` (filas de asignación duplicadas ya no repiten tarjetas).
- Añadido `GET /api/teacher/courses/diagnose` (admin) para inspeccionar asignatura→sección→asignaciones.

### Feature — Diagnóstico de asignaturas duplicadas (SOLO SOPORTE)
- Nueva página `/support/diagnostico` (SupportDiagnosticsPage), visible solo para rol `system_admin_global`.
- Backend en `diag_registro.py`:
  - `GET /api/diag/duplicate-subjects?school_id=` → agrupa asignaturas duplicadas por (sección + nombre),
    marca ORIGINAL (mayor actividad; empate → más antigua) vs DUPLICADO, con impacto por asignatura.
  - `DELETE /api/diag/duplicate-subjects/{id}?school_id=` → elimina el duplicado y limpia referencias
    (asignaciones, notas, evaluación, posts, exámenes). Guard support-only.
- Verificado por API: detección con etiquetas original/duplicado + borrado con limpieza (test con duplicado temporal).


## 2026-07-07

### Bugfix — Crear examen digital daba error 500
- `ExamCreate` no tenía el campo `shuffle_questions` (solo estaba en `ExamUpdate`),
  y la creación de exámenes digitales accedía a `data.shuffle_questions` → AttributeError → 500.
- Fix: agregado `shuffle_questions: Optional[bool] = False` a `ExamCreate` (exams.py).

### Bugfix — Alumno no podía "Ver" archivos de entregas (401)
- El botón "Ver" abría la URL del backend con `<a target=_blank>` sin token → 401.
- Fix: nuevo `SafeExamImage`/`SubmissionViewButton` con fetch autenticado (axios blob + Authorization),
  apertura en pestaña, fallback a link, y parseo del error real del backend (StudentCourseDetailPage.jsx).

### Bugfix — Lista "Habilitar/Bloquear" de examen mostraba alumnos de más
- `_section_students` no aplicaba `ACADEMIC_STUDENT_FILTER` (incluía retirados) y el examen a veces
  no tenía `section_id` guardado.
- Fix: `_section_students` ahora usa `seccion_id + ACADEMIC_STUDENT_FILTER` (igual que el roster del curso);
  el endpoint `eligible-students` resuelve `section_id` desde la asignatura si el examen no lo tiene (exams.py).
- Badge "No rindió" ahora en ROJO (CourseDetailPage.jsx).

### Bugfix — Imágenes de preguntas rotas (404 Cloudinary) al duplicar/clonar
- Duplicar/clonar exámenes copiaba `{**q}` → todas las copias compartían la MISMA imagen de Cloudinary;
  borrar/editar una destruía el asset compartido → 404 en todas.
- Fix: helper `_clone_questions_with_own_images` re-sube cada imagen (pregunta + opciones) a Cloudinary
  al duplicar/clonar → copias independientes (exams.py). Frontend muestra "Ver imagen" de respaldo.
- Nota: imágenes ya borradas no se recuperan; hay que re-subirlas.

### Feature — Horario de asistencia por Nivel × Turno
- "Horario Estudiantes por Nivel" (Ajustes → General → Asistencia) ahora soporta horario por turno
  (Mañana/Tarde/Noche) además del horario general del nivel.
- Usa los turnos existentes de la estructura académica (`GET /academic/shifts`) y el `turno_id` del alumno.
- Modelo: `attendance_config.levels[].turnos = [{turno_id, entry_time, exit_time}]` (settings.py).
- Tardanza automática (`_student_schedule` y escaneo QR en attendance.py) resuelve por nivel + turno,
  con fallback al horario general del nivel si el alumno no tiene turno o no hay config del turno.
- Tolerancia y "marcar falta" siguen siendo globales. Verificado backend end-to-end; UI reutiliza TimePicker+acordeón.


## 2026-06-24

### Portal Profesor — Toggle columna "LIBRETA" en Mis Tutorías
- Nuevo switch en Propietario → Ajustes → Libreta ("Secciones visibles"):
  "Mostrar columna LIBRETA en el portal del profesor". Default ACTIVADO.
- Controla la visibilidad de la columna LIBRETA (botón "Ver") en Portal Profesor →
  Mis Tutorías → Conducta & Comentarios.
- Backend: flag `show_libreta_column_in_tutoria` (default True) en
  GET/PUT /api/report-cards/settings; expuesto como `show_libreta_column` en
  GET /api/mis-tutorias/bulk (tutor_comments.py).
- Frontend: MisTutoriasPage.jsx (render condicional th/td) + LibretasSettingsTab.jsx
  (toggle data-testid='tutoria-show-libreta-column-toggle'). Mirror del patrón
  show_padres_grade existente.
- Tests: tests/test_libreta_column_toggle.py 6/6 PASS.

### Logo transparente con fondo negro en PDFs (fix)
- Causa: convert("RGB") sobre PNG transparente rellena con negro al guardar JPEG.
- Fix: componer sobre fondo BLANCO antes de RGB/JPEG en welcome_letters.py
  (_fetch_logo_bytes), users.py (~L2192) y attendance.py (~L3334). Verificado:
  área transparente → blanca; PDFs siguen generándose 200 OK.

## 2026-06-24 (anterior en el día)

### Cartas de Bienvenida — Object Storage (resuelve 409 de disco efímero)
- Migrado el almacenamiento del ZIP del job en background desde `/tmp` (disco
  efímero) al **Object Storage integrado de Emergent** (`integrations.emergentagent.com/objstore`,
  usa `EMERGENT_LLM_KEY`). Path: `edunet/welcome-letters/{job_id}.zip`.
- `_run_job` sube el ZIP al bucket, guarda `storage_path` en el job y borra el `/tmp`.
- `welcome_job_download` sirve los bytes **desde el bucket** → funciona en cualquier
  réplica o tras reinicio del contenedor. Validado: descarga OK del mismo job tras
  reiniciar backend.
- 409 ahora valida existencia del objeto en bucket (404→409 descriptivo) + 502 si
  falla el storage. Soft-expiry de 48h (`ZIP_TTL_HOURS`) — Emergent objstore NO tiene
  API de borrado físico ni lifecycle.
- Modo síncrono (≤300 familias) sin cambios. No se tocó credenciales/anti-backfill/
  generación secuencial.
- Añadido `EMERGENT_LLM_KEY` a `backend/.env`. Nueva dep: `requests` (ya presente).
- Tests: `tests/test_welcome_letters.py` 6/6 PASS.

### Cartas de Bienvenida — Fallback de contraseña al DNI
- `_resolve_pwd`: usa `plain_password`; si está vacía, cae al **DNI** (convención
  colegio: DNI = clave). Aplica a padres e hijos y a la lógica de omisión/excluidos.
  100% solo-lectura. Reduce drásticamente "(no registrada)" en `_EXCLUIDOS.txt`.

### Cartas de Bienvenida — Logging + manejo de errores
- Backend: logs `[WELCOME-LETTERS]` (job_id, status, storage_path, exists, role,
  school) y 409/404 con `detail` descriptivo en español.
- Frontend (`UsersPage.jsx` `handleWelcomeLetters`): el catch lee el Blob de error
  como texto/JSON (evita `InvalidStateError` con `responseType: blob`) y loguea
  `[WELCOME-LETTERS]`.

### UI — Toolbar de Usuarios
- Compactados TODOS los botones del toolbar (todos los roles: estudiantes,
  profesores, padres, staff): `px-4 py-2.5`, círculo icono `w-8 h-8`, icono
  `w-4 h-4`, `text-sm`, `gap-2`. Caben en una sola línea.

## 2026-06-25 — NotificationBell responsive + reset de badge
- Dropdown responsive: en movil ocupa ancho de pantalla (fixed, centrado, `w-[calc(100vw-1.5rem)]`), en desktop `sm:w-96` anclado a la derecha.
- El badge de la campana vuelve a 0 al abrir el dropdown (estado `badgeSeen`), pero la lista de notificaciones se mantiene visible hasta hacer clic en cada item.
- El badge reaparece automaticamente cuando llega contenido nuevo (totalCount sube).
- Verificado en preview: badge 9 -> 0 al abrir, lista intacta.

## 2026-06-25 — Badge del icono de la app (PWA) baja al leer notificaciones
- Causa: el badge OS-level (navigator.setAppBadge) solo se actualizaba/reducia para el rol apoderado; para owner/admin/profesor/alumno el push lo ponia pero nada lo reducia al leer.
- Fix: fuente unica de verdad. Un useEffect sincroniza el badge del icono con el `totalCount` real de no leidas para TODOS los roles; baja por cada notificacion leida/accedida y se limpia en 0.
- Se eliminaron los setAppBadge/clearAppBadge dispersos (subconjunto de asistencia) que causaban inconsistencias.
- Verificado en preview: 9 -> 8 al leer una notificacion.

## 2026-06-25 — Los contadores ahora bajan al revisar notificaciones (persistente)
- Causa raiz: abrir la campana solo ocultaba el badge visualmente (badgeSeen) pero NO marcaba nada leido en el servidor; las notificaciones seguian is_read=false en Mongo, asi el numero real y el icono de la PWA se mantenian. Caso real: apoderada maria.peres con 19 notificaciones generales sin leer.
- Fix: al ABRIR la campana se ejecuta markSeenOnOpen -> POST /notifications/read-all (+ /push/mark-read para padres). Persiste la lectura, baja unread_count/pestanas/icono PWA a 0 y los mantiene; la lista permanece visible en estilo leido.
- Los Recordatorios (tareas/examenes proximos) son por fecha, no por lectura; el padre no tiene (0).
- Verificado en preview (admin): campana 8 -> setAppBadge(2 = solo recordatorios); al reabrir Actividad sin numero (persistido).

## 2026-06-25 — Cartas de bienvenida en vista Alumnos (sujeto al filtro)
- Nuevo boton "Cartas de bienvenida" en usuario/Estudiantes (data-testid welcome-letters-students-btn).
- Pasa los filtros activos nivel_id/grado_id/seccion_id a /users/welcome-letters/{info,download,start}.
- Backend: _gather_context acepta filtros y conserva solo FAMILIAS con >=1 hijo que cumple TODOS los filtros; la carta lista todos los hijos de la familia. Job en background guarda/propaga los filtros.
- Verificado: sin filtro 6 familias; filtro nivel+grado+seccion -> 2 familias (ZIP con 2 PDFs).

## 2026-06-25 — Modal de filtro obligatorio para Cartas de bienvenida (Alumnos)
- El boton en vista Alumnos ahora abre un modal (welcome-letters-modal) con Nivel/Grado/Seccion OBLIGATORIOS y en cascada.
- "Descargar" deshabilitado hasta seleccionar los 3 campos. Evita descargas accidentales de todo el colegio.
- Verificado: download disabled True hasta seleccionar nivel+grado+seccion -> habilitado. Backend filtra solo esas familias.

## 2026-06-25 — Fixes modal Cartas de bienvenida + compactacion toolbar
- Modal heredaba texto blanco del header naranja: los <select> y opciones salian invisibles. Fix: text-slate-800 bg-white explicito en los 3 selects + contenedor.
- Botones del toolbar de Estudiantes compactados (px-3 py-2 text-xs) para que los 5 entren en una sola linea.
- Verificado: valor del select visible (color slate-800); 5 botones en una linea.

## 2026-06-25 — Desactivación temporal de alumnos (retiro / oculto en todo el sistema)
### Backend
- Nuevos campos: is_disabled, disabled_at. Filtro central STUDENT_VISIBLE_FILTER + is_disabled agregado a ACADEMIC_STUDENT_FILTER(_WITH_PENDING) -> cubre ~25 modulos automaticamente.
- Filtro is_disabled aplicado a listados de modulos sin filtro central: coordinacion, libreta, report_cards_pdf, pae, movilidad, teacher_observations, tutoring_admin, conducta_extendida, qr_templates, psychology_agenda, tutor_comments.
- enforce_student_active bloquea is_disabled.
- PATCH /api/students/{id}/toggle-disable (solo admin/owner/director): al desactivar resetea username(8)+password(12 bcrypt), borra plain_password/password_display, devuelve credenciales 1 sola vez; al reactivar solo limpia disabled_at.
- GET /api/students/disabled/search (autocompletador Ajustes).
- GET /users sigue mostrando todos (con is_disabled) para Usuarios>Estudiantes.
### Frontend
- Card de alumno: Switch "Desactivar alumno"/"Alumno desactivado" (default OFF), badge RETIRADO rojo + opacidad. Modal confirmacion + modal credenciales (copiar). 
- Ajustes: nuevo tab "Alumnos retirados" (RetiredStudentsTab) con buscador y reactivacion.
### Verificado
- Backend (DB simulation): disabled excluido de coordinacion (38->37), presente en disabled/search y en /users. GETs OK.
- Frontend: switch en 57 cards, modal confirmacion con texto correcto, tab Ajustes operativo.
- NOTA: el PATCH (escritura) no se pudo ejecutar E2E en preview porque el tenant El Roble tiene suscripcion vencida (middleware bloquea writes). La logica quedo validada via DB.

## 2026-06-26 — Toggle LIBRETA tambien oculta la pestaña "Libretas individuales"
- El toggle show_libreta_column_in_tutoria ahora controla tambien la pestaña "Libretas individuales" en Mis Tutorias (no solo la columna LIBRETA).
- Backend: /mis-tutorias/sections devuelve show_libreta_column.
- Frontend MisTutoriasPage: oculta el TabButton y su contenido cuando OFF; si el tutor estaba en esa pestaña, lo regresa a Conducta & Comentarios.
- Verificado UI: ON -> tab+columna visibles; OFF -> ambos ocultos.

## 2026-06-26 — Aleatorizar orden de preguntas por estudiante (examenes digitales)
- Campo shuffle_questions en online_exams (ExamCreate/ExamUpdate). Default false.
- /exams/{id}/questions-for-student: si shuffle_questions=true, mezcla el orden con semilla deterministica sha256(exam_id:student_id) -> orden distinto por alumno, ESTABLE entre recargas. No afecta calificacion (respuestas por question_id).
- Frontend CourseDetailPage: toggle "Aleatorizar orden de preguntas" en el form de examen digital (data-testid exam-shuffle-questions-toggle). Solo orden de preguntas (no alternativas).
- Verificado: algoritmo deterministico (mismo alumno=mismo orden; alumnos distintos=ordenes distintos); backend recarga limpia; frontend compila; GET /exams/{id} devuelve el campo (default false si ausente).
- NO verificado E2E en preview: modal de creacion (admin sin cursos) y vista del alumno (writes bloqueados por suscripcion vencida del tenant El Roble).

## 2026-06-26 — Switch "Aleatorizar orden de preguntas" en pantalla de gestion de preguntas
- Movido/duplicado: ademas del modal de config, ahora hay un SWITCH grande y explicito en ExamDetailView (vista de gestion de preguntas), justo debajo de "Detalles del Examen" (data-testid shuffle-questions-card / shuffle-questions-switch). Solo digital + canEdit.
- Guarda al instante: PUT /exams/{id} {shuffle_questions} con update optimista.
- Compila OK. No verificado en UI (admin sin cursos / tenant suscripcion vencida).
