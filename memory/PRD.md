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

### Fase 3.5 — Botón Clonar Subcolumna en Editor (COMPLETO)
- Archivo: `/app/frontend/src/pages/PlantillaEditorPage.jsx`
- Botón clonar (icono Copy) en cada fila de subcolumna, entre tipo y eliminar
- Inserción posicional (debajo de la original), normalización de orden, auto-focus en label

### Fase 3.6 — Simplificación Columnas Finales + Modal Preview (COMPLETO)
- Eliminado campo label_corto editable del editor (auto-generado desde label)
- Modal de vista previa expandida (90vw x 85vh) con tabla completa + footer con suma

### Fase 4 — Consumo Dinámico (COMPLETO)
- Archivo creado: `/app/frontend/src/utils/registroAuxiliarUtils.js`
  - PLANTILLA_SISTEMA_FALLBACK, assignFieldKeys, calcularPromedioBimestral, calcularPromedioCriterio
- Archivo refactorizado: `/app/frontend/src/components/GradeBookTab.jsx`
  - Fetch de plantilla activa/predeterminada del colegio al montar
  - Render dinámico de criterios, subcolumnas, columnas finales desde plantilla
  - Cálculo de promedios usando pesos de la plantilla
  - Fallback a PLANTILLA_SISTEMA_FALLBACK si no hay plantilla activa
  - Indicador "Plantilla: {nombre}" en el header
  - Guardado de notas compatible con GRADE_SUB_FIELDS del backend (positional mapping)

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

## Clonación de Actividades (COMPLETO - Feb 2026, validado por testing agent)
- Backend: `POST /api/course/posts/{post_id}/clonar` (Foros, Materiales, Tareas) en `/app/backend/routes/courses.py`
- Backend: `POST /api/exams/{exam_id}/clonar` en `/app/backend/routes/exams.py`
- Frontend: `/app/frontend/src/components/course/CloneActivityModal.jsx` (modal árbol Nivel→Grado→Sección→Asignatura)
- Integrado en `/app/frontend/src/pages/CourseDetailPage.jsx` (pestañas Tareas, Foros, Materiales, Exámenes)
- Respuesta: `{clonados: int, errores: []}`. Clones heredan status original (active/published, NO draft).
- Testing: 13/13 backend tests PASSED, frontend OK en todas las pestañas (iteración 134)
- Test file: `/app/backend/tests/test_clone_activities.py`

## Gestión de Contraseñas de Padres (COMPLETO)
- Asignación masiva DNI como clave (`/api/admin/padres/asignar-clave-dni`)
- Import Excel usa DNI por defecto si no hay contraseña
- Soporte Carnet de Extranjería (CE) en pendientes
- `password_display` / `plain_password` para visualización admin

## Prioritized Backlog
### P0
- (COMPLETADO) Fase 4: Consumo Dinámico de Plantillas en Registro Auxiliar
- (COMPLETADO) Clonación de Actividades (Tareas, Foros, Materiales, Exámenes)

### P1
- Guard global alumnos pending/rejected
- Dashboard Owner métricas reales
- Psicología — Log de auditoría

### P2
- Módulo Encuestas, Optimización rendimiento, Refactorización CourseDetailPage.jsx (>11000 líneas), Plantilla Adventista, Fase 5 Registro Auxiliar (almacenamiento dinámico backend)
