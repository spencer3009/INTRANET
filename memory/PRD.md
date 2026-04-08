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
- 5 placeholders con copys/iconos (Charlas reemplazado en Fase 3)
- Testing: 23/23 backend (iteration_116)

### Fase 2 (Operativa) - COMPLETED (Apr 2026)

**Derivaciones** - DONE
- Backend: CRUD completo, auto-asignacion, notificacion badge (unseen_count), staff por area
- Frontend: DerivacionesListPage, DerivacionDetailPage, formulario derivar en IncidenciaDetailPage
- Testing: 18/18 (iteration_117)

**Reuniones con Padres** - DONE
- Backend: CRUD, auto-linkeo padres via campo `children`, tokens JWT stateless 7 dias
- Endpoint publico: POST /api/coordinacion/reuniones/confirm?token=<jwt>
- Frontend: ReunionesListPage, ReunionDetailPage con enlace copiable para WhatsApp
- Testing: 18/18 (iteration_117)

**Ficha Extendida del Estudiante** - DONE
- Backend: GET /api/coordinacion/estudiante/{id}/ficha -> timeline unificada paginada
- 4 event_types mezclados: incidencia, seguimiento, derivacion, reunion
- Summary con KPIs por estudiante (incidencias abiertas, reincidencia 30d)
- Frontend: EstudiantesFichaPage

**Agenda Integrada** - DONE
- Backend: GET /api/coordinacion/agenda con event_source (reunion, derivacion, review, charla)
- Frontend: AgendaPage con calendario mensual

**Vistas Padre/Alumno** - DONE
- Endpoints dedicados en /parent/* y /student/*
- Filtros estrictos de confidencialidad

**Tests de Aislamiento (6 bloqueantes)** - ALL PASSED (iteration_118)

### Fase 3 (Valor Agregado) - IN PROGRESS

**Charlas Grupales** - DONE (Apr 2026)
- Backend: CRUD completo (POST/GET/PATCH/DELETE /api/coordinacion/charlas)
- Materiales: Tipos soportados - imagen (JPG/PNG/WebP, 5MB), PDF (15MB), video (MP4, 50MB), link externo
- Endpoint: POST/DELETE /api/coordinacion/charlas/{id}/materiales
- Cloudinary destroy on material deletion (resource_type-aware)
- Carpeta Cloudinary: edunet/coordinacion/charlas (agregada a ALLOWED_FOLDERS en system.py)
- Asistencia: Modelo A (manual al cierre) - POST /api/coordinacion/charlas/{id}/asistencia
- Estudiantes objetivo: GET /api/coordinacion/charlas/{id}/estudiantes (por grados/secciones)
- Integracion Agenda: event_source="charla" en GET /api/coordinacion/agenda
- Frontend: CharlasListPage, CharlaDetailPage, CharlaMaterialUploader.jsx (componente encapsulado)
- RBAC verificado: padre bloqueado (403), coordinador no puede eliminar (solo admin/owner)
- Testing: 24/24 backend + frontend (iteration_119)

**Reportes Avanzados** - NOT STARTED
- Por grado, reincidencia y cobertura de charlas

**Exportacion XLSX/PDF** - NOT STARTED
- Reutilizar patrones existentes (XLSX de estudiantes, ReportLab PDF de OMR)

**Alertas Automaticas** - PARTIALLY DONE
- Pipeline de reincidencia ya implementado en dashboard (Opcion A: on-demand)
- Umbral: >= 3 incidencias en 30 dias, misma escuela, no soft-deleted
- Falta: Widget dedicado "Alertas activas" con link a ficha del estudiante

**Integracion Charlas -> Agenda** - DONE
- event_source: "charla" ya integrado en endpoint de agenda

## Decisions Log
- Alertas de reincidencia: Opcion A (on-demand, pipeline de Mongo). Sin coleccion nueva, sin cron.
- Asistencia de charlas: Modelo A (manual al cierre). QR queda para Fase 4.
- Uploader de charlas: Componente local CharlaMaterialUploader.jsx, no generico.
- Carpeta Cloudinary: edunet/coordinacion (con subcarpetas /charlas, extensible a /evidencias).

## Backlog
- P0: Reportes avanzados (por grado, reincidencia, cobertura charlas)
- P0: Exportacion XLSX/PDF
- P0: Widget "Alertas activas" en dashboard
- P1: Psicologia - Log de auditoria estricto (extraer log_audit a utils)
- P1: Modulo de Matriculas (Enrollments)
- P1: Dashboard Owner con metricas reales
- P2: Refactorizacion CourseDetailPage.jsx (>11,000 lineas)
- P2: Modulo de Encuestas
- P2: Optimizacion rendimiento examenes masivos (3000 estudiantes)

## Test Accounts
See /app/memory/test_credentials.md
