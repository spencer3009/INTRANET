# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestion escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Sistema de Plantillas de Registro Auxiliar

### Fase 1 — Backend (COMPLETO, 8 endpoints smoke-tested)
- Archivo: `/app/backend/routes/registro_auxiliar_plantillas.py`
- Seed: plantilla del sistema ejecuta en startup
- Endpoints: GET list, GET by id, POST create, POST clone, PUT update, PATCH estado, PATCH predeterminada, DELETE

### Fase 2 — Frontend Gestor (COMPLETO)
- Archivo: `/app/frontend/src/components/RegistroAuxiliarPlantillasTab.jsx`
- Tab "Registro Auxiliar" en Ajustes, cards de plantillas, preview modal
- Permisos: admin/director/owner en `/app/frontend/src/lib/permissions.js`

### Fase 3 — Editor de Plantilla (COMPLETO)
- Archivo: `/app/frontend/src/pages/PlantillaEditorPage.jsx`
- Rutas: `/:subdomain/settings/registro-auxiliar/editor/:plantillaId` y `/nueva`
- Features: criterios editables, subcolumnas, reorden, color picker, preview tiempo real, desglose de ponderación, indicador de suma, autoguardado 30s, guardar borrador, activar

### Fase 4 — Consumo Dinámico (PENDIENTE - siguiente fork)
- Archivo a modificar: `/app/frontend/src/components/GradeBookTab.jsx` (647 líneas, hardcoded)
- Tareas: fetch plantilla, render dinámico de tabla, cálculo promedio bimestral dinámico, fallback legacy, selector de plantilla al crear registro

## Key Files
- `/app/backend/routes/registro_auxiliar_plantillas.py`
- `/app/frontend/src/components/RegistroAuxiliarPlantillasTab.jsx`
- `/app/frontend/src/pages/PlantillaEditorPage.jsx`
- `/app/frontend/src/pages/SettingsPage.jsx` (tabs General/RA)
- `/app/frontend/src/components/GradeBookTab.jsx` (Fase 4 target)

## Contabilidad (sesión anterior)
- Auto-eliminación cuotas pendientes al registrar ingreso
- Cálculo de mora sobre pension_mensual base (350)
- Pagos Yape en listado de Ingresos con modal validación
- Portal padre con mora visible

## Prioritized Backlog
### P0
- Fase 4: Consumo Dinámico de Plantillas en Registro Auxiliar

### P1
- Guard global alumnos pending/rejected
- Dashboard Owner métricas reales
- Psicología — Log de auditoría

### P2
- Módulo Encuestas, Optimización rendimiento, Refactorización, Plantilla Adventista
