# EduNet - School Management Platform PRD

## Original Problem Statement
Implementar el "Modulo Coordinador" (Fases 1, 2, 3) en la plataforma educativa EduNet. El modulo integra un rol de primer nivel (`coordinator`), reutiliza infraestructura del modulo de Psicologia sin duplicar logica, implementa dashboard de KPIs, CRUD de incidencias, seguimientos, derivaciones, reuniones con padres, charlas y reportes avanzados. Todo respeta RBAC (`SECTION_PERMISSIONS`), soporta aislamiento multi-tenant (`school_id`), soft-delete y auditoria.

## Core Requirements
- Rol `coordinator` con permisos RBAC estrictos
- Dashboard con KPIs en tiempo real
- CRUD de incidencias con severidad, tipos y flujo de estados
- Seguimientos con timeline por incidencia
- Derivaciones a areas (psicologia, direccion, tutoria, etc.)
- Reuniones con padres con tokens JWT de confirmacion stateless
- Charlas grupales (Fase 3)
- Reportes avanzados y exportacion (Fase 3)
- Vistas restringidas para padres y alumnos

## Architecture
- Backend: FastAPI + MongoDB (Motor)
- Frontend: React + Tailwind CSS + Shadcn/UI
- Auth: JWT-based, RBAC via `require_role()`
- Multi-tenant via `school_id` from JWT token

## What's Been Implemented

### Fase 1 (Nucleo) - COMPLETED (Apr 2026)
- Rol `coordinator` en `SECTION_PERMISSIONS` y frontend
- Modelos e indices MongoDB: `coordinacion_incidencias`, `coordinacion_seguimientos`
- Backend: CRUD incidencias, seguimientos, dashboard KPIs, grades/sections/students helpers
- Frontend: CoordinacionLayout, CoordinacionSidebar, Dashboard, CRUD incidencias con formulario y detalle
- Testing: 23/23 backend tests passed (iteration_116)

### Fase 2 (Operativa) - IN PROGRESS (Apr 2026)
**Derivaciones** - COMPLETED
- Backend: CRUD completo, auto-asignacion si 1 candidato en area, notificacion badge (unseen_count), staff por area
- Regla: si no hay psicologo asignado, derivacion queda en `pendiente` sin `to_user_id`, visible en bandeja "sin asignar" para admin/director
- Incidencia cambia a status `derivada` al crear derivacion
- Frontend: DerivacionesListPage, DerivacionDetailPage, formulario de derivacion en IncidenciaDetailPage
- Sidebar badge con conteo de derivaciones no vistas

**Reuniones con Padres** - COMPLETED
- Backend: CRUD completo, auto-linkeo de padres via campo `children`, tokens JWT stateless 7 dias
- Endpoint publico de confirmacion: POST /api/coordinacion/reuniones/confirm?token=<jwt>
- Incidencia cambia a status `citacion_programada` cuando se crea reunion con incidencia_id
- Frontend: ReunionesListPage, ReunionDetailPage con enlace de confirmacion copiable
- Testing: 18/18 backend tests passed (iteration_117)

**Bug Fix: Tarjeta Coordinadores** - COMPLETED
- Tarjeta "Coordinadores" visible en grilla de gestion de usuarios
- Rol `coordinator` disponible en dropdown de creacion de usuarios

### Pending - Fase 2 remaining
- Ficha del Estudiante extendida (tab Coordinacion)
- Agenda integrada del coordinador
- Vistas restringidas para Padre y Alumno (confidential=true invisible, vinculo padre-hijo reutilizado)

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
