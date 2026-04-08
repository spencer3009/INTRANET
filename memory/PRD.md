# EduNet - School Management Platform PRD

## Original Problem Statement
Implementar el "Modulo Coordinador" (Fases 1, 2, 3) en la plataforma educativa EduNet. El modulo integra un rol de primer nivel (`coordinator`), reutiliza infraestructura del modulo de Psicologia sin duplicar logica, implementa dashboard de KPIs, CRUD de incidencias, seguimientos, derivaciones, reuniones con padres, charlas y reportes avanzados. Todo respeta RBAC (`SECTION_PERMISSIONS`), soporta aislamiento multi-tenant (`school_id`), soft-delete y auditoria.

## Architecture
- Backend: FastAPI + MongoDB (Motor)
- Frontend: React + Tailwind CSS + Shadcn/UI
- Auth: JWT-based, RBAC via `require_role()`
- Multi-tenant via `school_id` from JWT token
- Cloudinary for file uploads (signature-based, direct client upload)

## What's Been Implemented

### Fase 1 (Nucleo) - COMPLETED
- Rol `coordinator` en `SECTION_PERMISSIONS` y frontend
- Modelos e indices MongoDB: `coordinacion_incidencias`, `coordinacion_seguimientos`
- Backend: CRUD incidencias, seguimientos, dashboard KPIs
- Frontend: CoordinacionLayout, CoordinacionSidebar, Dashboard, CRUD incidencias con formulario y detalle
- Tarjeta Coordinadores en gestion de usuarios + dropdown creacion
- Testing: 23/23 backend (iteration_116)

### Fase 2 (Operativa) - COMPLETED (Apr 2026)
- Derivaciones: CRUD, auto-asignacion, badge notificaciones
- Reuniones con Padres: CRUD, JWT stateless 7 dias, confirmacion publica
- Ficha Extendida del Estudiante: timeline unificada paginada
- Agenda Integrada: event_source (reunion, derivacion, review, charla)
- Vistas Padre/Alumno: endpoints /parent/*, filtros de confidencialidad
- Tests de Aislamiento: 6 bloqueantes pasados (iteration_118)

### Fase 3 (Valor Agregado) - IN PROGRESS

**Charlas Grupales** - DONE (Apr 2026)
- CRUD backend (6 endpoints), materiales (imagen/PDF/video/link con Cloudinary)
- Asistencia: Modelo A (manual al cierre)
- Carpeta Cloudinary: edunet/coordinacion/charlas
- Frontend: CharlasListPage, CharlaDetailPage, CharlaMaterialUploader.jsx
- Integracion con Agenda: event_source="charla"
- Testing: 24/24 (iteration_119)

**Seguimientos — Vista Global** - DONE (Apr 2026)
- Backend: GET /api/coordinacion/seguimientos con filtros, summary KPIs, enrichment
- Frontend: SeguimientosListPage con 4 KPI cards, filtros por estado, busqueda, tabla cronologica
- Click → navega a incidencia padre (solo lectura, edicion vive en IncidenciaDetailPage)
- Visual: fila vencida con highlight rojo, badges de estado

**Reportes Avanzados** - NOT STARTED
**Exportacion XLSX/PDF** - NOT STARTED
**Alertas Automaticas Widget** - NOT STARTED

## Auditoría de Rutas (13 paths verificados visualmente - Apr 8 2026)
| Ruta | Estado |
|------|--------|
| /coordinacion | REAL (Dashboard) |
| /coordinacion/estudiantes | REAL (EstudiantesFichaPage) |
| /coordinacion/incidencias | REAL (IncidenciasListPage) |
| /coordinacion/incidencias/:id | REAL (IncidenciaDetailPage) |
| /coordinacion/seguimientos | REAL (SeguimientosListPage) |
| /coordinacion/charlas | REAL (CharlasListPage) |
| /coordinacion/charlas/:id | REAL (CharlaDetailPage) |
| /coordinacion/reuniones | REAL (ReunionesListPage) |
| /coordinacion/reuniones/:id | REAL (ReunionDetailPage) |
| /coordinacion/derivaciones | REAL (DerivacionesListPage) |
| /coordinacion/derivaciones/:id | REAL (DerivacionDetailPage) |
| /coordinacion/agenda | REAL (AgendaPage) |
| /coordinacion/reportes | PLACEHOLDER (legitimo, pendiente Fase 3) |

## Decisions Log
- Alertas de reincidencia: Opcion A (on-demand, pipeline de Mongo). Sin cron.
- Asistencia de charlas: Modelo A (manual al cierre). QR queda para Fase 4.
- Uploader de charlas: Componente local CharlaMaterialUploader.jsx.
- Carpeta Cloudinary: edunet/coordinacion (subcarpetas /charlas, extensible).
- Seguimientos globales: Vista solo-lectura. Edicion permanece en IncidenciaDetailPage.

## Backlog
- P0: Reportes avanzados (por grado, reincidencia, cobertura charlas)
- P0: Exportacion XLSX/PDF
- P0: Widget "Alertas activas" en dashboard (reincidentes >= 3 incidencias 30d)
- P1: Psicologia - Log de auditoria estricto
- P1: Modulo de Matriculas (Enrollments)
- P1: Dashboard Owner con metricas reales
- P2: Refactorizacion CourseDetailPage.jsx (>11,000 lineas)
- P2: Modulo de Encuestas
- P2: Optimizacion rendimiento examenes masivos (3000 estudiantes)

## Test Accounts
See /app/memory/test_credentials.md
