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

## Roadmap
### P1
- Guard global para alumnos pending/rejected (bloquear asistencia, notas).
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
