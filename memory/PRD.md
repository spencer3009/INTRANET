# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestion escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Latest Session (2026-04-17)

### Feature: Sistema de Plantillas de Registro Auxiliar
#### Fase 1 — Backend (COMPLETO)
- Coleccion `registro_auxiliar_plantillas` con 8 endpoints CRUD
- Seed de plantilla del sistema (4 criterios, 2 columnas finales, suma=100%)
- Validacion de porcentajes (100% para activas, libre para borradores)
- Proteccion plantilla sistema (403 en edit/delete/estado)
- Clonacion con nuevos IDs (evita colision de notas)
- Multi-tenant estricto (school_id isolation)
- Archivo: `/app/backend/routes/registro_auxiliar_plantillas.py`

#### Fase 2 — Frontend Gestor + Permisos (COMPLETO)
- Pestaña "Registro Auxiliar" en Ajustes con tabs (General | Registro Auxiliar)
- Card de Plantilla del Sistema (solo lectura, candado, pills de criterios)
- Grid "Mis Plantillas" con cards (estado, predeterminada, menu contextual)
- Card "+ Nueva plantilla"
- Modal de Preview con tabla de ejemplo (3 alumnos ficticios)
- Permisos: admin/director/owner acceden a Ajustes. Admin solo ve tab "Registro Auxiliar"
- Archivo: `/app/frontend/src/components/RegistroAuxiliarPlantillasTab.jsx`

#### Fase 3 — Editor de Plantilla (PENDIENTE para siguiente fork)
- Pantalla dedicada con criterios editables, subcolumnas, colores
- Preview en tiempo real, autoguardado de borradores

#### Fase 4 — Consumo Dinámico (PENDIENTE para siguiente fork)
- Seleccion de plantilla al crear registro auxiliar
- Render dinamico de tabla desde plantilla
- Calculo de promedio bimestral dinamico
- Fallback para registros legacy

### Rutas registradas:
- GET    /api/schools/{id}/registro-auxiliar/plantillas
- GET    /api/schools/{id}/registro-auxiliar/plantillas/{pid}
- POST   /api/schools/{id}/registro-auxiliar/plantillas
- POST   /api/schools/{id}/registro-auxiliar/plantillas/{pid}/clonar
- PUT    /api/schools/{id}/registro-auxiliar/plantillas/{pid}
- PATCH  /api/schools/{id}/registro-auxiliar/plantillas/{pid}/estado
- PATCH  /api/schools/{id}/registro-auxiliar/plantillas/{pid}/predeterminada
- DELETE /api/schools/{id}/registro-auxiliar/plantillas/{pid}

## Key Files
- `/app/backend/routes/registro_auxiliar_plantillas.py` - Backend plantillas
- `/app/frontend/src/components/RegistroAuxiliarPlantillasTab.jsx` - Gestor UI
- `/app/frontend/src/pages/SettingsPage.jsx` - Tabs General/RA
- `/app/frontend/src/lib/permissions.js` - admin/director access to settings

## Prioritized Backlog
### P0 (Continuacion plantillas)
- Editor de Plantilla (Fase 3)
- Consumo dinamico en Registro Auxiliar (Fase 4)

### P1
- Guard global alumnos pending/rejected
- Dashboard Owner metricas reales
- Psicologia — Log de auditoria

### P2
- Modulo Encuestas
- Optimizacion rendimiento
- Refactorizacion archivos masivos
- Plantilla Adventista carnets QR
