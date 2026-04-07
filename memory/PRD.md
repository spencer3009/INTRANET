# EduNet - School Management Platform PRD

## Original Problem Statement
Implementar el "Modulo Coordinador" (Fases 1, 2, 3) en la plataforma educativa EduNet. El modulo integra un rol de primer nivel (`coordinator`), reutiliza infraestructura del modulo de Psicologia sin duplicar logica, implementa dashboard de KPIs, CRUD de incidencias, seguimientos, derivaciones, reuniones con padres, charlas y reportes avanzados. Todo respeta RBAC (`SECTION_PERMISSIONS`), soporta aislamiento multi-tenant (`school_id`), soft-delete y auditoria.

## Architecture
- Backend: FastAPI + MongoDB (Motor)
- Frontend: React + Tailwind CSS + Shadcn/UI
- Auth: JWT-based, RBAC via `require_role()`
- Multi-tenant via `school_id` from JWT token

## What's Been Implemented

### Fase 1 (Nucleo) - COMPLETED
- Rol `coordinator` en `SECTION_PERMISSIONS` y frontend
- Modelos e indices MongoDB: `coordinacion_incidencias`, `coordinacion_seguimientos`
- Backend: CRUD incidencias, seguimientos, dashboard KPIs
- Frontend: CoordinacionLayout, CoordinacionSidebar, Dashboard, CRUD incidencias con formulario y detalle
- Tarjeta Coordinadores en gestion de usuarios + dropdown creacion
- 5 placeholders con copys/iconos: Seguimientos, Charlas, Reportes (Fase 3)
- Testing: 23/23 backend (iteration_116)

### Fase 2 (Operativa) - COMPLETED (Apr 2026)

**Derivaciones** - DONE
- Backend: CRUD completo, auto-asignacion, notificacion badge (unseen_count), staff por area
- Derivacion sin psicologo: queda pendiente, bandeja "sin asignar" para admin/director
- Frontend: DerivacionesListPage, DerivacionDetailPage, formulario derivar en IncidenciaDetailPage
- Testing: 18/18 (iteration_117)

**Reuniones con Padres** - DONE
- Backend: CRUD, auto-linkeo padres via campo `children`, tokens JWT stateless 7 dias
- Endpoint publico: POST /api/coordinacion/reuniones/confirm?token=<jwt>
- Frontend: ReunionesListPage, ReunionDetailPage con enlace copiable para WhatsApp
- Testing: 18/18 (iteration_117)

**Ficha Extendida del Estudiante** - DONE
- Backend: GET /api/coordinacion/estudiante/{id}/ficha → timeline unificada paginada
- 4 event_types mezclados: incidencia, seguimiento, derivacion, reunion
- Defense in depth: confidential filtrado incluso con guard de rol
- Summary con KPIs por estudiante (incidencias abiertas, reincidencia 30d)
- Frontend: EstudiantesFichaPage con selector grado/seccion/estudiante, tarjetas resumen, cronologia clickeable

**Agenda Integrada** - DONE
- Backend: GET /api/coordinacion/agenda con event_source (reunion, derivacion, review)
- Extensible para charlas en Fase 3 (event_source: "charla")
- Incluye next_review_at de seguimientos (revisiones pendientes)
- Check-conflict endpoint (adaptado de psychology_agenda.py)
- Frontend: AgendaPage con calendario mensual, puntos de color, panel lateral, resumen del mes

**Vistas Padre/Alumno (endpoints dedicados)** - DONE
- GET /api/coordinacion/parent/students → hijos vinculados
- GET /api/coordinacion/parent/incidencias → solo hijos, no confidencial, notify_parents=true
- GET /api/coordinacion/parent/reuniones → donde es parent_id
- POST /api/coordinacion/parent/reuniones/{id}/confirm → confirmacion intranet
- GET /api/coordinacion/student/compromisos → no confidencial con commitments
- Frontend: ParentCoordinacionView con tabs incidencias/reuniones, confirmacion

**Tests de Aislamiento (6 bloqueantes)** - ALL PASSED (iteration_118)
1. Padre solo ve incidencias de sus hijos
2. Padre no accede a incidencia de otro estudiante (403)
3. confidential=true invisible al padre
4. notify_parents=false invisible al padre
5. Aislamiento multi-school verificado
6. JWT invalido/expirado rechazado + parent_id incorrecto rechazado

### Fase 3 (Valor Agregado) - NOT STARTED
- Charlas grupales
- Reportes avanzados por grado/reincidencia
- Exportacion XLSX/PDF
- Alertas automaticas de dashboard

## Backlog
- P1: Psicologia - Log de auditoria estricto (extraer log_audit a utils)
- P1: Modulo de Matriculas (Enrollments)
- P1: Dashboard Owner con metricas reales
- P2: Refactorizacion CourseDetailPage.jsx (>11,000 lineas)
- P2: Modulo de Encuestas
- P2: Optimizacion rendimiento examenes masivos (3000 estudiantes)

## Test Accounts
See /app/memory/test_credentials.md
