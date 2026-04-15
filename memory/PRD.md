# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestión escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Latest Session (2026-04-15)
### Auto-Registro de Alumnos por Padres — Sistema Completo
- **Backend**: 7 endpoints en `enrollment.py` (self-register, pending, approve, reject, count, get-config, update-config)
- **Config**: 2 switches en `tenant_settings.parent_self_enrollment` (enabled + academic_info_editable)
- **Password**: username = DNI, password = DNI (hasheado bcrypt)
- **Validaciones**: Config del colegio, DNI duplicado, edad vs grado
- **Frontend**: EnrollmentConfigModal (2 switches), ParentEnrollmentForm (condicional), PendingEnrollmentsTab (aprobar/rechazar)
- **Condicional**: Botón "Registrar a mi hijo" solo aparece si config enabled=true
- **Notificaciones**: Internas a admins (nuevo pendiente) y padres (aprobado/rechazado)

## Prioritized Backlog
### P1 (Next)
- Guard global para bloquear servicios a alumnos pending
- Dashboard Owner con métricas reales
- Psicología — Log de auditoría estricto

### P2 (Future)
- Módulo de Encuestas
- Optimización rendimiento (3000 estudiantes)
- Refactorización CourseDetailPage.jsx (>11K líneas)
- Plantilla "Adventista" para carnets QR

## Key Files
- `/app/backend/routes/enrollment.py`
- `/app/frontend/src/components/EnrollmentConfigModal.jsx`
- `/app/frontend/src/pages/ParentEnrollmentForm.jsx`
- `/app/frontend/src/components/PendingEnrollmentsTab.jsx`
- `/app/frontend/src/pages/ParentDashboardPage.jsx`
- `/app/frontend/src/pages/UsersPage.jsx`
