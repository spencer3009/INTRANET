# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestion escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Latest Session (2026-04-15)
### Bug Fix: Calculo incorrecto de renovacion de suscripcion
- **Problema**: Al renovar suscripcion, el sistema sumaba 30 dias a la fecha de pago (`hoy + 30 dias`) en lugar de 1 mes calendario a la fecha de vencimiento actual (`max(vencimiento, hoy) + 1 mes`).
- **Fix**: Reemplazo de `timedelta(days=30)` por `relativedelta(months=1)` en `support.py` (renovacion) y `auth.py` (creacion inicial de colegios).
- **Logica**: Si paga antes/el dia del vencimiento → extiende desde vencimiento actual. Si paga despues → extiende desde hoy.
- **Archivos modificados**: `backend/routes/support.py`, `backend/routes/auth.py`
- **Tests**: 7 unit tests en `backend/tests/test_renewal_calculation.py` + 2 e2e via cURL + verificacion visual en Panel de Soporte.

### Previous Session (2026-04-15)
#### Auto-Registro de Alumnos por Padres — Sistema Completo
- **Backend**: 7 endpoints en `enrollment.py` (self-register, pending, approve, reject, count, get-config, update-config)
- **Config**: 2 switches en `tenant_settings.parent_self_enrollment` (enabled + academic_info_editable)
- **Password**: username = DNI, password = DNI (hasheado bcrypt)
- **Validaciones**: Config del colegio, DNI duplicado, edad vs grado
- **Frontend**: EnrollmentConfigModal (2 switches), ParentEnrollmentForm (condicional), PendingEnrollmentsTab (aprobar/rechazar)
- **Condicional**: Boton "Registrar a mi hijo" solo aparece si config enabled=true
- **Notificaciones**: Internas a admins (nuevo pendiente) y padres (aprobado/rechazado)

## Prioritized Backlog
### P1 (Next)
- Guard global para bloquear servicios a alumnos pending/rejected
- Dashboard Owner con metricas reales (cards restantes: Estudiantes Activos, Ingresos del Mes, etc.)
- Psicologia — Log de auditoria estricto (parametrizar `log_audit()`)

### P2 (Future)
- Modulo de Encuestas
- Optimizacion rendimiento (3000 estudiantes)
- Refactorizacion CourseDetailPage.jsx (>11K lineas) y UsersPage.jsx (>5.8K lineas)
- Plantilla "Adventista" para carnets QR

## Key Files
- `/app/backend/routes/support.py` (renovacion de suscripciones)
- `/app/backend/routes/auth.py` (creacion de colegios)
- `/app/backend/routes/enrollment.py`
- `/app/backend/tests/test_renewal_calculation.py`
- `/app/frontend/src/components/EnrollmentConfigModal.jsx`
- `/app/frontend/src/pages/ParentEnrollmentForm.jsx`
- `/app/frontend/src/components/PendingEnrollmentsTab.jsx`
- `/app/frontend/src/pages/ParentDashboardPage.jsx`
- `/app/frontend/src/pages/UsersPage.jsx`

## Key DB Schema
- `users`: `role`, `dni`, `enrollment_status` (pending, active, rejected), `enrollment_submitted_by_parent_id`
- `tenant_settings`: `admin_subscription_visible` (boolean), `parent_self_enrollment_enabled`, `academic_info_editable`
- `evaluation_criteria_config`: `school_id`, array de `categories` (con `category_id`, `display_name` y `subcolumns`)
- `schools`: `expiration_date`, `fecha_vencimiento`, `subscription_status`, `plan_estado`, `last_renewal_date`
