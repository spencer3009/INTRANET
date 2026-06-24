# CHANGELOG — Edunet (SaaS Escolar)

## 2026-06-24

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
