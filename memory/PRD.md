# SaaS Escolar - Product Requirements Document

## Original Problem Statement
Replicar y expandir módulos del SaaS escolar. Optimizar el rendimiento del servidor en producción evitando OOM crashes. Implementar monitoreo de salud y tracking de sesiones activas en tiempo real. Adicionalmente, corregir errores críticos en PWA, ajustar la visibilidad de componentes por roles y corregir masivamente la ortografía (tildes) en los textos del frontend.

## Architecture
- **Backend**: FastAPI (Python) en `/app/backend`, rutas en `/app/backend/routes/`
- **Frontend**: React en `/app/frontend`
- **DB**: MongoDB
- **Almacenamiento**: Cloudinary (himno MP3 / imágenes)

## Roles soportados
- Owner / Admin
- Profesor
- Padre (Apoderado)
- Alumno
- Tópico (rol médico/enfermería)
- Mantenimiento / Personal Administrativo
- Psicología

## Recently Implemented (2026-Q1 → 2026-Q2)
- Dashboard del Padre con suscripciones opcionales y cálculo correcto de mensualidad.
- Padres en modo lectura para servicios opcionales.
- Sincronización completa de "Deuda del Mes" entre Yape y Estado Financiero.
- Cancelación automática de pagos pendientes al desactivar suscripciones.
- Renombrado superficial "Mantenimiento" → "Administrativos".
- Perfil del Padre 100% editable (`ParentProfilePage.jsx` + `auth.py`).
- Subida y reproducción de Himno del Colegio (MP3, autoplay, progreso).
- Validación de archivos `.mpeg` para MP3.
- Conteo de "Tareas Atrasadas" sincronizado entre portal padre/alumno.
- Panel de deduplicación de pagos (`DedupePensionsPanel.jsx`) para Owner.
- **2026-04-29: Fix bug visual** — Etiquetas de mes en `/api/parent/payments` ahora se derivan de `pension_month` (fuente de verdad) y no de `payment_date`, eliminando la confusión donde un pago de Enero realizado en Abril aparecía como "Abril".

## Backlog / Roadmap

### P1
- Psicología — Log de auditoría estricto.

### P2
- Módulo de "Encuestas".
- Optimización de rendimiento del servidor en carga de exámenes masivos (3000 estudiantes).
- Refactor de `CourseDetailPage.jsx` (>11k líneas) y `UsersPage.jsx` (>6k líneas).
- Plantilla "Adventista" para carnets QR.

### P3
- Gráfica de evolución de IMC en historial del alumno (Tópico).
- Botón "Bloquear plantilla" a nivel colegio (solo admin).
- Papelera de reciclaje para profesor (soft-delete 30 días).
- Banner amarillo de tareas atrasadas en dashboard del alumno.

## Known Issues
- Error `insertBefore en Node` al escanear QR desde Android con traductor de Google.

## Test Credentials
Ver `/app/memory/test_credentials.md`
