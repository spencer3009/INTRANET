# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestión escolar full-stack (FastAPI + React + MongoDB).

## Completed Features (Latest Session — 2026-04-14)
- Fix Badge PDF profesores "Docente"
- Fix cruces Movilidad↔PAE + Rediseño escáneres
- Botón "Cambiar Portal" en portales auxiliares
- Multi-concepto en Registrar Ingreso + Desglose en Boleta PDF
- Switch activar/desactivar avatar flotante
- Personalización global de criterios de evaluación
- **Módulo de Matrícula por Padres** (auto-registro + aprobación/rechazo por admin)

## Key New Files
- `/app/backend/routes/enrollment.py` (5 endpoints)
- `/app/frontend/src/pages/ParentEnrollmentForm.jsx`
- `/app/frontend/src/components/PendingEnrollmentsTab.jsx`

## Prioritized Backlog
### P1 (Next)
- Dashboard Owner con métricas reales
- Psicología — Log de auditoría estricto
- Bloqueo de servicios para alumnos con enrollment_status pending

### P2 (Future)
- Módulo de Encuestas
- Optimización rendimiento (3000 estudiantes)
- Refactorización CourseDetailPage.jsx (>11K líneas)
- Plantilla "Adventista" para carnets QR
