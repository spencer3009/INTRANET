# EduNet - School Management Platform PRD

## Original Problem Statement
Implementar el "Modulo Coordinador" (Fases 1, 2, 3) en la plataforma educativa EduNet. El modulo integra un rol de primer nivel (`coordinator`), reutiliza infraestructura del modulo de Psicologia sin duplicar logica, implementa dashboard de KPIs, CRUD de incidencias, seguimientos, derivaciones, reuniones con padres, charlas, reportes avanzados, exportaciones y alertas automaticas. Todo respeta RBAC, aislamiento multi-tenant (`school_id`), soft-delete y auditoria.

## Architecture
- Backend: FastAPI + MongoDB (Motor)
- Frontend: React + Tailwind CSS + Shadcn/UI
- Auth: JWT-based, RBAC via `require_role()`
- Multi-tenant via `school_id` from JWT token
- Cloudinary for file uploads (signature-based, direct client upload)
- Export: openpyxl 3.1.5 (XLSX), reportlab 4.4.10 (PDF)

## What's Been Implemented

### Fase 1 (Nucleo) - COMPLETED
- Rol `coordinator` en RBAC y frontend
- CRUD incidencias, seguimientos, dashboard KPIs
- CoordinacionLayout, CoordinacionSidebar, Dashboard

### Fase 2 (Operativa) - COMPLETED (Apr 2026)
- Derivaciones: CRUD, auto-asignacion, badge notificaciones
- Reuniones con Padres: CRUD, JWT stateless 7 dias
- Ficha Extendida del Estudiante: timeline unificada paginada
- Agenda Integrada: event_source (reunion, derivacion, review, charla)
- Vistas Padre/Alumno: endpoints /parent/*, filtros de confidencialidad
- Tests de Aislamiento: 6 bloqueantes pasados (iteration_118)

### Fase 3 (Valor Agregado) - COMPLETED (Apr 2026)

**Charlas Grupales** - DONE
- CRUD backend (6 endpoints), materiales (imagen/PDF/video/link con Cloudinary)
- Asistencia: Modelo A (manual al cierre)
- Frontend: CharlasListPage, CharlaDetailPage, CharlaMaterialUploader.jsx
- Testing: 24/24 (iteration_119)

**Seguimientos - Vista Global** - DONE
- GET /api/coordinacion/seguimientos con filtros, summary KPIs, enrichment
- SeguimientosListPage: 4 KPI cards, filtros de estado, tabla cronologica

**Reportes Avanzados (4 reportes)** - DONE
- GET /api/coordinacion/reportes/incidencias-por-grado (agrupacion por grado con desglose severidad)
- GET /api/coordinacion/reportes/reincidentes (>=3 inc en 30d, shared pipeline con dashboard)
- GET /api/coordinacion/reportes/cobertura-charlas (% asistentes/convocados)
- GET /api/coordinacion/reportes/efectividad-seguimientos (% cerradas/abiertas, desglose por estado)
- Frontend: ReportesPage.jsx con 4 tabs, filtros, exportacion

**Exportacion XLSX/PDF** - DONE
- GET /api/coordinacion/reportes/{type}/export?format=xlsx|pdf
- XLSX: openpyxl con metadata, styled headers, StreamingResponse
- PDF: reportlab.platypus con tabla estilizada, header/footer
- Ambos formatos validados (ZIP archive y %PDF- header)

**Widget Alertas Activas en Dashboard** - DONE
- Reutiliza _get_reincidentes() compartida (sin duplicacion pipeline)
- Top 5 reincidentes con link directo a ficha
- Boton "Ver todos" → /coordinacion/reportes?tab=reincidentes
- data-testid: alertas-widget

**Testing Final** - DONE
- iteration_120: 22/22 backend + frontend pasados
- Auditoria visual: 13/13 rutas REALES, 0 placeholders

## Auditoria de Rutas (13 paths - Apr 8 2026)
| Ruta | Estado |
|------|--------|
| /coordinacion | REAL (Dashboard + Alertas widget) |
| /coordinacion/estudiantes | REAL (EstudiantesFichaPage) |
| /coordinacion/estudiantes/:id | REAL (Ficha detalle) |
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
| /coordinacion/reportes | REAL (ReportesPage - 4 tabs) |

## Decisions Log
- Alertas: Opcion A (on-demand, pipeline Mongo). Sin cron.
- Asistencia charlas: Modelo A (manual). QR en Fase 4.
- Uploader charlas: Componente local CharlaMaterialUploader.jsx.
- Carpeta Cloudinary: edunet/coordinacion/charlas.
- Seguimientos globales: Solo-lectura. Edicion en IncidenciaDetailPage.
- Reincidencia: >= 3 incidencias en 30d, misma escuela, no soft-deleted, severidad no influye.
- Export: openpyxl (XLSX) + reportlab (PDF), ambos ya instalados.

## Backlog
- P1: Psicologia - Log de auditoria estricto (parametrizar log_audit)
- P1: Modulo de Matriculas (Enrollments)
- P1: Dashboard Owner con metricas reales
- P2: Refactorizacion CourseDetailPage.jsx (>11,000 lineas)
- P2: Modulo de Encuestas
- P2: Optimizacion rendimiento examenes masivos (3000 estudiantes)
- P3: QR asistencia charlas (Fase 4)
- P3: Mas tipos de alerta (Opcion B si necesario)

## Test Accounts
See /app/memory/test_credentials.md
