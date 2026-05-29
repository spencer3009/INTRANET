# EduNet - Changelog

## Feb 28, 2026 - Feature: Bloquear cambio de foto de perfil de alumnos (Config en Usuarios/Alumnos) ✅
- **Pedido**: en Usuarios → Alumnos, el botón "Config" (tuerca) debe abrir un modal con un switch grande para desactivar que los alumnos cambien su foto; al activarlo, el ícono de cámara desaparece del perfil del alumno.
- **Backend** (`enrollment.py`): `GET /api/school/enrollment-config` ahora devuelve `block_student_photo_change` (leíble por cualquier usuario autenticado, incl. alumnos); `PATCH /api/school/settings/enrollment` acepta y persiste el flag en `tenant_settings.block_student_photo_change` (independiente de la config de matrícula).
- **Frontend modal** (`EnrollmentConfigModal.jsx`): renombrado a "Configuración de Alumnos"; nuevo switch grande prominente "Bloquear cambio de foto de perfil" con estado visual (rosa=bloqueado / verde=permitido) y guardado junto al resto.
- **Frontend perfil** (`StudentProfilePage.jsx`): obtiene el flag vía `/api/school/enrollment-config` y oculta el botón de cámara (`student-profile-change-photo-btn`) cuando está bloqueado. (Solo afecta el auto-servicio del alumno; admin/docente siguen pudiendo editar.)
- **Verificado E2E**: PATCH/GET persisten; login como alumno (Magno) confirma cámara OCULTA con block=true y VISIBLE con block=false; screenshot del modal owner muestra el switch grande funcionando. Flag dejado en false (default) tras la prueba.

## Feb 28, 2026 - Feature: Mostrar/Ocultar acceso a "Mi Libreta" en Alumnos y Padres ✅
- **Pedido**: en la misma sección de Ajustes → Libretas, switches para mostrar/ocultar la tarjeta "Mi Libreta del Estudiante" (acceso a la libreta) — uno para alumnos y otro para padres.
- **Backend** (`report_cards_pdf.py`): `ReportCardSettingsUpdate` acepta `show_libreta_student` y `show_libreta_parent` (bool, default true); GET/PUT los persisten/devuelven.
- **Backend** (`settings.py`): `/api/settings/public/{subdomain}` devuelve ambos flags.
- **Frontend dashboards** (`StudentDashboardPage.jsx`, `ParentDashboardPage.jsx`): la tarjeta "Mi Libreta"/"Libreta de {hijo}" se renderiza solo si el flag respectivo (de `settings` público) no es false.
- **Frontend Ajustes** (`LibretasSettingsTab.jsx`): 2 toggles nuevos en la sección renombrada "Acceso a Calificaciones y Libreta en los portales"; handler `toggleShowGrades` generalizado para reusarse (Calificaciones/Libreta).
- **Verificado E2E**: curl PUT/GET + endpoint público reflejan los flags; screenshot del dashboard de Padres confirma que la tarjeta "Libreta" desaparece al desactivar (mismo mecanismo en Alumnos). Flags restaurados a true tras la prueba.

## Feb 28, 2026 - Feature: Mostrar/Ocultar "Calificaciones" en el menú de Alumnos y Padres ✅
- **Pedido**: dos interruptores en Ajustes → Libretas para mostrar/ocultar el botón "Calificaciones" del menú del portal de alumnos y del de padres (opción b: solo ocultar del menú, no bloquear URL).
- **Backend** (`report_cards_pdf.py`): `ReportCardSettingsUpdate` acepta `show_grades_student` y `show_grades_parent` (bool, default true). GET/PUT `/api/report-cards/settings` los persisten/devuelven (`schools.show_grades_student` / `show_grades_parent`).
- **Backend** (`settings.py`): `GET /api/settings/public/{subdomain}` ahora devuelve ambos flags (legible sin auth, lo usan los portales).
- **Frontend** (`StudentSidebar.jsx`, `ParentSidebar.jsx`): cada sidebar consulta `/api/settings/public/{subdomain}` y filtra el ítem `calificaciones` si el flag respectivo es false. Default true (no parpadeo perceptible).
- **Frontend Ajustes** (`LibretasSettingsTab.jsx`): nueva sección "Acceso a Calificaciones en los portales" con 2 toggles (alumnos/padres), carga + guardado optimista con rollback.
- **Verificado E2E**: curl PUT/GET + endpoint público reflejan los flags; screenshot del portal de Padres confirma que "Calificaciones" desaparece del menú cuando se desactiva (mismo mecanismo en el portal de Alumnos). Flags restaurados a true tras la prueba.

## Feb 28, 2026 - Feature: Negrita y tamaño de texto por celda + "Todo en negrita" (Fase Canva 3) ✅
- **Pedido del usuario**: poder poner negrita por celda (botón "B"), elegir tamaño de texto por celda (10–20px) y un switch global "Todo en negrita" en el editor visual tipo Canva de la libreta.
- **Backend** (`report_cards_pdf.py`):
  - `ReportCardSettingsUpdate` ahora acepta `cell_bold` (Dict[str,bool]), `cell_size` (Dict[str,Optional[int]]) y `all_bold` (bool).
  - Helpers `_merge_cell_bold` (guarda True y False explícito — el False permite des-negritar una celda cuando "Todo en negrita" está activo) y `_merge_cell_size` (valida 10–20px).
  - `GET`/`PUT /api/report-cards/settings` persisten/devuelven los 3 campos. `cell_size: {id: null}` borra la override; `cell_bold` guarda booleano explícito.
  - Persistidos en `schools.libreta_cell_bold`, `libreta_cell_size`, `libreta_all_bold`.
- **Backend** (`libreta.py`):
  - `cell_bold`, `cell_size`, `all_bold` propagados a `metadata` en las 3 rutas (compute live, snapshot read-through, snapshot create). Projection del school_doc y snap_school actualizada.
- **Frontend editor** (`LibretaPaletteEditor.jsx`):
  - Nuevo toggle global "Todo en negrita".
  - Popover de cada celda ahora tiene sección "TEXTO": botón "B" (tri-estado: auto/negrita/quitar-negrita respecto al estado efectivo) + selector de tamaño (Auto, 10–20px).
  - El preview de muestra refleja bold/size por celda y el bold global.
- **Frontend Ajustes** (`LibretasSettingsTab.jsx`): nuevos estados + handlers (`setCellBoldValue`, `setCellSizeValue`, `toggleAllBold`) con UI optimista y rollback; props pasadas al editor.
- **Frontend Libreta** (`LibretaCard.jsx`): `cellStyle()` extendido para aplicar `fontWeight`/`fontSize` por celda; `all_bold` aplicado al contenedor raíz (hereda a toda la libreta incl. impresión nativa del navegador). False explícito des-negrita una celda bajo el bold global.
- **Nota**: la libreta NO tiene generador de PDF en servidor (el botón "Descargar PDF" se quitó); la impresión usa el navegador con `LibretaCard.jsx`, así que el bold/size/all_bold ya se reflejan al imprimir.
- **Verificado E2E**: curl PUT/GET persiste (incl. false explícito y reset por null); `/api/libreta/{id}` expone los campos en metadata (live path); screenshots confirman toggle global, botón "B" y selector 10–20px funcionando en el popover.
- **Incidencia de entorno detectada**: `ENOSPC` en file watchers de webpack impedía el HMR — se reinició el frontend y se subió `fs.inotify.max_user_watches` para forzar recompilación.


## Feb 28, 2026 - Feature: Paleta de colores con auto-contraste (Fase 1) ✅
- **Backend** (`report_cards_pdf.py` + `libreta.py`):
  - Nuevo `ColorPaletteBody` con 10 zonas: `header_banner`, `header_logo`, `initials_box`, `table_headers`, `area_rows`, `subject_rows`, `promedio_rows`, `asistencia_table`, `conducta_table`, `tutor_comments`.
  - Validación con regex hex (`#XXX` o `#XXXXXX`); empty string = "usar default".
  - Mergea parcialmente con lo guardado en `schools.libreta_color_palette`.
  - Propagado a `metadata.color_palette` en `/api/libreta/{id}` (compute + snapshot read-through + snapshot create).
- **Frontend Ajustes** (`LibretasSettingsTab.jsx`):
  - Nueva sección "Paleta de colores" debajo de "Plantilla del encabezado".
  - Grid de 10 tarjetas (2 columnas), cada una con emoji + nombre + mini preview + 8 presets + custom color picker.
  - **8 presets premium**: Default, Blanco, Azul claro (#dbeafe), Verde menta (#d1fae5), Rosa pastel (#fce7f3), Amarillo suave (#fef3c7), Gris claro (#e5e7eb), Azul oscuro (#1e3a8a), Púrpura (#6d28d9).
  - Helper `autoContrast(hex)` calcula luminancia (0.299r + 0.587g + 0.114b) y devuelve `#000` o `#fff` según umbral 0.55.
  - Botón "default" por zona + "Restaurar todos los colores" global.
- **Frontend Libreta** (`LibretaCard.jsx`):
  - Helpers `hexToRgb`, `autoText`, `zoneStyle`, `rowBgStyle`, `rowTextStyle` desde `metadata.color_palette`.
  - Aplicado a: header banner, lr-logo, lr-photo-placeholder, thead de lr-grades, filas de área/asignatura/promedio, lr-attendance-table, conducta-table, comentarios-table.
  - El texto siempre auto-contrasta excepto donde hay reglas específicas (notas en azul/rojo) que prevalecen por CSS.
- **Verificado E2E**: curl PUT/GET retorna palette correcta. Screenshot del panel muestra 10 tarjetas funcionales con preview azul-oscuro + texto blanco en Encabezado (auto-contraste).


## Feb 28, 2026 - Feature: Plantilla del encabezado editable (Ajustes → Libreta) ✅
- **Pedido**: el cliente quería poder editar los textos fijos del encabezado de la libreta (INSTITUCIÓN EDUCATIVA PRIVADA, Informe de Progreso del Estudiante, etiqueta de bimestre, etc.) con visibilidad de la plantilla default vs la en uso.
- **Backend** (`report_cards_pdf.py` + `libreta.py`):
  - Nuevo `HeaderTemplateBody` Pydantic + helpers `_HEADER_TEMPLATE_DEFAULTS` / `_merge_header_template`.
  - Campos editables: `line1`, `line3`, `bimestre_label`, `show_initials_box`.
  - `GET /api/report-cards/settings` ahora devuelve `header_template` (mergeado) + `header_template_defaults` (read-only para el UI).
  - `PUT` acepta updates parciales y mergea con lo existente.
  - Propagado a `metadata.header_template` en `/api/libreta/{id}` (compute, snapshot read-through y snapshot create) — projection actualizada en línea 413.
- **Frontend Ajustes** (`LibretasSettingsTab.jsx`):
  - Nueva sección "Plantilla del encabezado" con layout 2 columnas: defaults gris (read-only) | en uso amarilla (editable).
  - Inputs con commit on blur / Enter para no spamear API.
  - Botón "restaurar default" por campo (aparece solo si está modificado) + "Restaurar todo al default" global.
  - Helpers `HeaderRow` (read-only) y `HeaderEditableField` (editable con restore).
- **Frontend Libreta** (`LibretaCard.jsx`):
  - Lee `metadata.header_template`, hace interpolación de variables `{year}`, `{roman}`, `{grado}`, `{seccion}`.
  - Reemplaza el JSX hardcoded por `headerLine1`, `headerLine3`, `headerBimestre`.
  - `show_initials_box` controla la visibilidad del recuadro lateral (foto/iniciales).
- **Verificado E2E**: curl confirma PUT/GET + propagación a metadata. Screenshot del panel muestra layout correcto, descripción de variables y previsualización dual.


## Feb 28, 2026 - Fix P0: Libreta en print ahora ocupa todo el ancho del papel ✅
- **Reportado**: la libreta al imprimirse / exportarse a PDF se veía pequeña al centro de la hoja con grandes franjas blancas laterales y firmas en una 2da hoja casi vacía.
- **Root cause**: `.libreta-card { width: 21cm }` + `@page { margin: 1.5cm }` → el contenido (21cm) era más ancho que el área útil (18cm) → el navegador aplicaba "fit-to-page" comprimiendo todo al ~85%. Además `padding: 1cm` interno se sumaba al margen del `@page` desperdiciando más espacio. Y `.lr-page2 { min-height: 22cm; page-break-before: always }` forzaba siempre una 2da hoja.
- **Fix** (`/app/frontend/src/components/libreta/LibretaCard.css` + `LibretaCard.jsx`):
  - `@page` ahora usa `margin: 0.8cm` (balanceado, no exagerado).
  - En `@media print` la `.libreta-card` y TODAS sus variantes (`lr-paper-a4/letter/legal`, `lr-orient-landscape`) hacen override a `width: 100% !important; padding: 0 !important; margin: 0 !important` — la tabla aprovecha el ancho real del papel.
  - `.lr-page2` en print: `min-height: 0`, `page-break-before: auto`, `margin: 12px 0 0 0` → si cabe junto a la página 1, se acomoda; ya no fuerza hoja vacía.
  - `.lr-page-header` y `.lr-signatures` en print: márgenes verticales reducidos de 180px → 16px / 48px → firmas justo debajo del contenido.
  - `LibretaCard.jsx` actualiza también su `@page` dinámico a `margin: 0.8cm`.
- **Verificado E2E**: screenshot con `emulate_media: print` confirma libreta a ancho completo, tabla ocupando todo el ancho útil, firmas inmediatamente debajo de Situación Final, todo en una sola hoja A4.


## Feb 28, 2026 - Feature PREMIUM: Panel "Formato de impresión" en Ajustes → Libreta ✅
- **Problema reportado**: las libretas se imprimían con letras minúsculas e ilegibles, y la tabla principal se cortaba lateralmente (caso real: Sr. de Gualamita, 1° Primaria con muchas asignaturas + formato mixto).
- **Solución**: nuevo panel premium con 5 controles de formato.

### Backend (`/app/backend/routes/report_cards_pdf.py` + `libreta.py`)
- Nuevo objeto `libreta_print_format` en schema de `schools`. Defaults sensatos + whitelist de valores.
- `PrintFormatBody` Pydantic + helpers `_PRINT_FORMAT_DEFAULTS` / `_PRINT_FORMAT_ALLOWED` / `_merge_print_format`.
- `GET/PUT /api/report-cards/settings` exponen `print_format`. Las actualizaciones son parciales (no destructivas).
- Propagado a `metadata.print_format` en `/api/libreta/{id}` (compute path, snapshot read-through y snapshot create).

### Frontend Ajustes (`LibretasSettingsTab.jsx`)
- Nueva sección con 5 selectores visuales tipo tarjeta (no dropdowns):
  - 🔤 **Tamaño de letra**: Pequeña (0.85x) / Normal (1.0x) / Grande (1.15x, ★ recomendado) / Extra grande (1.3x). Cada tarjeta muestra "ABc" en el tamaño real.
  - 🔄 **Orientación**: Vertical / Horizontal (★ recomendado).
  - 📐 **Tamaño de papel**: A4 / Carta / Oficio (con dimensiones en cm).
  - 📊 **Densidad de filas**: Compacto / Cómodo / Espacioso.
  - 🎨 **Estilo de tabla**: Líneas finas / marcadas / Cebra (alternadas).
- Botón "👁️ Vista previa" que abre la libreta del primer alumno disponible en otra pestaña.
- Persistencia optimistic-UI con rollback si falla el PUT.
- Tip final con la combinación recomendada (Horizontal + Grande).

### Frontend Libreta (`LibretaCard.jsx` + `LibretaCard.css`)
- CSS variables `--lr-font-scale`, `--lr-row-h`, `--lr-row-pad-y`, `--lr-border-w`, `--lr-zebra-bg` aplicadas en `.libreta-card` y `.lr-grades` / `.lr-info`.
- Modifier classes generadas dinámicamente: `lr-fs-{size}`, `lr-dens-{density}`, `lr-ts-{style}`, `lr-paper-{size}`, `lr-orient-{orient}`.
- `useEffect` inyecta una regla `@page { size: <paper> <orient>; margin: 1cm; }` en un `<style>` dinámico para que el diálogo de impresión / "Guardar como PDF" use el tamaño y orientación correctos.
- Página 2 también respeta `paper_size` / `orientation`.

### Verificación E2E
- curl: `PUT print_format={landscape, large}` → `GET /api/libreta` retorna `metadata.print_format` con esos valores propagados.
- Screenshot del panel: 5 secciones visuales correctas, badges ★ en las opciones recomendadas, tip al final.


## Feb 27, 2026 - Feature: Historial de cierres visible para reabrir bimestres ✅
- **Problema**: el usuario cerró un bimestre por error y no sabía cómo reabrirlo. El endpoint `DELETE /api/libreta/close-period` ya existía y la UI también — pero el "Historial de cierres" en `AdminCierreBimestrePage.jsx` estaba vacío (un TODO con loop que nunca llenaba `all = []`).
- **Backend**: nuevo endpoint `GET /api/libreta/admin/closed-periods` que agrupa snapshots por (period_id, section_id) y devuelve `[{period_id, period_name, section_name, students, closed_at, closed_by_name}]`. Solo accesible para owner/admin del colegio.
- **Frontend**:
  - `loadHistory` ahora consume el nuevo endpoint en lugar del placeholder vacío.
  - Se llama `loadHistory()` también después de cerrar y de reabrir → la tabla se mantiene fresca.
  - Mensaje vacío mejorado: "No hay bimestres cerrados…" en lugar de "Aún no hay cierres en esta sesión".
- Endpoint renombrado a `/libreta/admin/closed-periods` para evitar conflicto de routing con `/libreta/closed-periods/{student_id}` (FastAPI matcheaba la segunda con `student_id="closed-periods-admin"`).
- Verificación curl: el endpoint devuelve los 3 snapshots del colegio El Roble con metadata completa (bimestre, sección, alumnos, fecha, autor).


## Feb 26, 2026 - Feature: Preview inline de adjuntos en comunicados ✅
- Reescrito `/app/frontend/src/components/BroadcastAttachmentsList.jsx` (compartido por los 4 portales: admin, profesor, padre, alumno).
- Detección por `mime_type` + extensión:
  - **Imagen**: auto-load (instant) → `<img>` clicable que abre en pestaña.
  - **Video**: botón "Reproducir video" → `<video controls>` con blob.
  - **Audio**: botón "Reproducir audio" → `<audio controls>` con blob.
  - **PDF**: botón "Ver PDF" → `<iframe>` embebido (600px).
  - **Otros** (docx, xlsx, etc.): solo botón "Descargar".
- Cada tarjeta tiene siempre un botón "Descargar" (descarga con `<a download>` el blob obtenido).
- Blob URLs se revocan automáticamente al desmontar (no leaks).
- Endpoint backend ya devolvía `Content-Disposition: inline` y `media_type` correcto → no requiere cambios.
- Mantiene firma `<BroadcastAttachmentsList message token />` → ningún portal necesita ajuste.


## Feb 26, 2026 - Feature: Toggle "Ocultar asistencia" en la Libreta ✅
- Nuevo flag `hide_asistencia_in_libreta` en schema de `schools`, expuesto vía:
  - `GET/PUT /api/report-cards/settings` (`report_cards_pdf.py`).
  - Propagado a `metadata` en `/api/libreta/{id}` (compute path + snapshot read-through + snapshot create).
- Nuevo switch "Ocultar asistencia" en `LibretasSettingsTab.jsx` (debajo de "Ocultar comentarios del tutor"), con `data-testid="libreta-hide-asistencia-toggle"`.
- `LibretaCard.jsx` ahora condiciona el render de `libreta-attendance-table` a `!hideAsistencia`.
- Verificado E2E: PUT/GET funcionales, metadata propagada, UI renderizada correctamente.


## Feb 26, 2026 - Fix P0 (parte 2): Filtro de bimestre también en snapshot read-through ✅
- **Reportado en producción**: tras el primer fix, en `edunet.pe` el alumno Arohuanca Velarde (Precursores TJ) seguía mostrando notas del BIM II en la libreta filtrada por BIM I (ALGEBRA, VALORES, Promedio Matemáticas, Estadística).
- **Root cause**: cuando viene `period_id` y existe un snapshot para `(student, period_id)`, el endpoint hacía read-through del `payload_json` del snapshot **sin filtrar**. Como el snapshot se guardó en una fecha donde ya existían notas del BIM II, el payload congelado contenía esas notas y se devolvían al frontend.
- **Fix** (`/app/backend/routes/libreta.py`, líneas 313-371 nuevas): después de leer el snapshot, se aplica el mismo blanqueo a `areas[].subjects[].grades`, `promedio_area`, `promedio_final`, `subjects_without_area`, `ranking`, `asistencia`, `conducta`, `tutor_comments`, `conducta_extendida.by_period` y `final_status` para todos los `period_id != requested`.
- **Verificación curl**: `GET /api/libreta/{id}?period_id=BIM_I` con `is_snapshot=true` ahora retorna `CLEAN — solo BIM I tiene datos`.


## Feb 26, 2026 - Fix P0: Libreta filtrada por bimestre mostraba notas de otros bimestres ✅
- **Reportado en producción**: en el Consolidado seleccionando "1er bimestre" + abrir libreta de un alumno → la libreta mostraba el BIM I correctamente PERO también algunas notas dispersas del BIM II.
- **Root cause** (`/app/backend/routes/libreta.py`, líneas 613-655 antes del fix): el bloque que limpia las notas de bimestres "no visibles" estaba envuelto en `if not period_id and closed_period_ids:`. Por lo tanto cuando el frontend pasaba `?period_id=<X>` desde el Consolidado, el bloque se saltaba y se devolvían las notas de TODOS los bimestres (que se cargaban con `period_ids: {"$in": [todos]}` en línea 415).
- **Fix**: refactorizado para calcular `keep_ids` y aplicar el blanqueo en un solo flujo:
  - Si `period_id` en query → `keep_ids = {period_id}` (solo ese bimestre).
  - Si no, y hay snapshots cerrados → modo "bimestral" (último cerrado) o "acumulada" (todos los cerrados).
  - Si no, y no hay cerrados → mostrar todo.
- **Extra**: cuando se filtra por bimestre puntual, también se blanquean los `promedio_final` (subject), `promedio_area.final` y `final_status` (situación final del año) — no tiene sentido mostrar promedios anuales con datos de un solo bimestre.
- **Verificación curl**: `GET /api/libreta/{id}?period_id=BIM_I` ahora devuelve nota=16 solo en BIM I y `null` en BIM II/III/IV. `promedio_final=null` y `promedio_area.final=null`.


## Feb 26, 2026 - Fix P0: Libreta formato "Mixto" no se renderizaba ✅
- **Root cause**: Cuando una libreta se cargaba desde snapshot (bimestre cerrado), el endpoint `GET /api/libreta/{student_id}` en `/app/backend/routes/libreta.py` (líneas 287-297) reemplazaba `metadata` por completo SIN incluir `libreta_grade_format`. El frontend entonces recibía `undefined` y aplicaba el fallback `"letters"` → solo se veían letras.
- **Fix backend** (`libreta.py`):
  - Snapshot **load**: ahora re-lee el doc de `schools` para incluir `libreta_grade_format`, `show_padres_grade`, `hide_conducta_in_libreta`, `hide_tutor_comments_in_libreta`, `libreta_mode` y `conducta_template_mode` en la metadata. Las configs de "display" siempre reflejan la config actual del colegio, no la del momento del cierre.
  - Snapshot **create** (línea 901): preserva todos los campos relevantes desde `prev_meta` (no solo `libreta_grade_format`).
- **Fix frontend** (`LibretaCard.jsx`): default de `gradeFormat` cambiado de `"letters"` → `"numeric"` para alinear con el default del backend (`/api/report-cards/settings` retorna `"numeric"` cuando el colegio no ha configurado nada).
- **Verificación E2E**: con `libreta_grade_format=mixed` la tabla de libreta ahora renderiza correctamente 2 columnas por bimestre (Nota | Nivel de logro) — tanto para áreas/asignaturas como para Evaluación Conductual y Participación PP.FF.


## Feb 16, 2026 - Fork (Observaciones del Aula + Quick Wins) — COMPLETED ✅

### Feature: Módulo "Observaciones del Aula" (comunicación interna Profesor → Tutor)
- **Backend** `/app/backend/routes/teacher_observations.py` — 8 endpoints REST:
  - `POST /api/teacher/observations` — crea observación validando que el profesor enseñe la sección, que exista tutor distinto a sí mismo, y dispara push si severity='urgente'.
  - `GET /api/teacher/observations/sent` — bandeja de enviadas.
  - `GET /api/teacher/observations/{id}` — detalle; marca como leído cuando lo abre el tutor receptor.
  - `POST /api/teacher/observations/{id}/reply` — agrega mensaje al hilo (autor o tutor); 409 si está cerrada.
  - `GET /api/tutor/observations` — inbox del tutor con counts (total, abierta, en_seguimiento, cerrada, unread) y filtros por section_id/status/severity.
  - `PATCH /api/tutor/observations/{id}/status` — solo el tutor receptor cambia entre en_seguimiento/cerrada (y reabre).
  - `GET /api/teacher/students-with-tutor` — alumnos del profesor con info del tutor de cada sección.
  - `GET /api/students/{id}/observations` — historial por alumno (staff o tutor de la sección).
- **Frontend Profesor** `/app/frontend/src/pages/TeacherObservationsPage.jsx` — composer modal (buscar alumno → categoría → severidad → fecha → título → descripción), lista de enviadas, hilo con respuestas. Filtra alumnos donde el profesor es su propio tutor.
- **Frontend Tutor** — tab "Observaciones" agregado al portal `MisTutoriasPage.jsx` con `TutorObservationsInboxTab`: mini-stats (Total/Sin leer/Abiertas/En seguimiento/Cerradas), filtros, fila con badges de categoría+severidad+estado y dot rojo para no-leídos, modal de detalle con acciones de estado y reply.
- **Rutas/Sidebar**: `/:subdomain/teacher/observaciones` en `App.js`; entrada "Observaciones del Aula" en `TeacherSidebar`.
- **Schema**: nueva colección `teacher_observations` `{id, school_id, student_id, section_id, author_id, recipient_tutor_id, category, severity, title, description, fecha_incidente, status, thread[], read_by_tutor_at, closed_at, closed_by, created_at, updated_at}`.

### Quick Wins resueltos
- **Fix crash Google Translate**: añadido `<meta name="google" content="notranslate">` en `public/index.html` para que el traductor de Chrome no mute el DOM y rompa React (afectaba a la tabla de Asistencia para profesores).
- **Prevención de alumnos huérfanos**: `POST /api/enrollment/{id}/approve` ahora retorna HTTP 400 si `nivel_id` no está presente (ni en el body ni en el alumno), evitando que admins aprueben matrículas incompletas que desaparecen del sistema.

### Testing
- Backend: **17/17 pytest PASS** (`/app/backend/tests/test_teacher_observations.py`) — CRUD completo, permisos (autor/tutor/staff), 409 sin tutor, 400 self-tutor, 403 no-teaching, hilo en cerrada (409), inbox + counts, transiciones de estado, approve sin nivel (400) / con nivel (200).
- Frontend: E2E PASS — composer profesor → push al tutor → bandeja del tutor → reply → cierre.
- **Action items aplicados**: Password de `rafa@gmail.com` reseteada a `Tutor123!` (testing agent detectó hash desincronizado); composer ahora oculta alumnos donde el profesor es self-tutor.
- **NO Save to GitHub / NO Deploy** — listo en preview, pendiente redeploy a edunet.pe.



## Feb 13, 2026 - Fork (Tutorías Fases C & D — Portal del Tutor + Pulido Admin) — COMPLETED ✅

### Feature: Portal Profesor-Tutor multi-sección (Fase C)
- **Reescritura completa** de `/app/frontend/src/pages/MisTutoriasPage.jsx` (~620 líneas, bien seccionado por componentes).
- **Grid de tarjetas**: si el profe (o admin) tutorea ≥2 secciones, ve un grid de cards `[testid=tutoring-card-{id}]` con nivel + grado · sección + # alumnos. Si tutorea 1 sola, auto-selecciona y va directo al dashboard. Estado en URL via `useSearchParams` (`?section_id=…&tab=…`) para deep-linking + back/forward del navegador.
- **Section Dashboard** con header (botón "Mis salones" si >1, título del salón, selector de bimestre) + nav de **3 tabs**:
  1. **Conducta & Comentarios** (`BulkConductCommentsTab`): mini-stats (Alumnos, Comentarios x/N, Conducta x/N, Bimestre) + tabla bulk editable con autosave 700ms en comentarios y autosave inmediato en conducta. Respeta HTTP 423 → textarea readonly + select disabled + label "bloqueado".
  2. **Consolidado del salón** (`ConsolidatedTab`): fetch a `GET /api/mis-tutorias/sections/{id}/consolidated?period_id=…` — tabla read-only con todas las asignaturas (incluyendo cursos que el tutor NO dicta), promedio y orden de mérito.
  3. **Libretas individuales** (`LibretasTab`): grid de cards con avatar de iniciales + nombre + código + link `target=_blank` a `/libreta/{student_id}`.

### Feature: Pulido Admin (Fase D)
- **AdminDashboardPage** (`/admin`): fetch paralelo a `/api/admin/tutoring-overview` + nueva tarjeta `[testid=dashboard-tutoring-card]` debajo de los Stats. Muestra "X/Y secciones con tutor" + badge rojo "(N sin asignar)" + nº de profesores con rol tutor. Click → navega a `/admin/tutoring-overview`.
- **AdminTeachersPage**: en cada fila de profesor, badge `[testid=teacher-tutor-badge-{id}]` "Tutor · N" junto al @username cuando el profe tiene tutorías activas. La columna "Cursos" ahora excluye correctamente las asignaciones tutor-role (filtra por `a.subject_id`).

### Testing
- Backend: 9/9 pytest PASS (`/app/backend/tests/test_tutoring_admin_phase_c.py`) — listado de secciones, bulk de alumnos, consolidated scoping, lock 423 en bimestres cerrados.
- Frontend: 100% PASS en flujos Phase C (grid → dashboard → 3 tabs → back). Phase D validada por code review (owner no accede a `/admin/*`).
- Sin bugs ni acciones pendientes (iter 143).
- **NO Save to GitHub / NO Deploy** — listo en preview, esperando que el usuario redespliegue a edunet.pe.



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
