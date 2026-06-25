# CHANGELOG — Edunet (SaaS Escolar)

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
