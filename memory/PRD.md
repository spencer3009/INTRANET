# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestion escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Latest Session (2026-04-17)

### Feature: Seccion "Procedencia Academica" en formulario de registro
- Backend: 4 campos nuevos en SelfRegisterRequest (colegio_anterior, codigo_modular, ultimo_grado_cursado, ano_lectivo_anterior)
- Frontend: Seccion collapsible entre Info Academica e Info Complementaria
- Validaciones: codigo modular (7 digitos numerico), ano lectivo (4 digitos)

### Fixes de Contabilidad (misma sesion):
- Auto-eliminacion fisica de cuotas pendientes al registrar ingreso consolidado
- Calculo de interes moratorio corregido (siempre sobre pension_mensual base 350)
- Columnas separadas BASE | MORA | TOTAL en tabla de Ingresos
- Pagos Yape visibles en listado de Ingresos con modal de validacion
- Portal padre: mora visible en cards y detalle mensual
- Total Anual descuenta pension_base por mes pagado

## Key Files
- `/app/backend/routes/enrollment.py` - Auto-registro, approve/reject, config
- `/app/frontend/src/pages/ParentEnrollmentForm.jsx` - Formulario completo
- `/app/frontend/src/components/EnrollmentConfigModal.jsx` - Config switches
- `/app/frontend/src/components/PendingEnrollmentsTab.jsx` - Admin approval tab
- `/app/backend/routes/accounting.py` - Billing, payments, auto-delete
- `/app/frontend/src/pages/AccountingPage.jsx` - Ingresos UI

## System: Auto-registro Completo
- Parent self-register form → enrollment_status: pending
- Admin PendingEnrollmentsTab → approve/reject with notifications
- EnrollmentConfigModal → switches ON/OFF
- Badge counter in sidebar
- Global guard for pending/rejected students
- Procedencia Academica section (collapsible, optional)

## Prioritized Backlog
### P1
- Guard global alumnos pending/rejected (servicios)
- Dashboard Owner metricas reales
- Psicologia — Log de auditoria

### P2
- Modulo Encuestas
- Optimizacion rendimiento
- Refactorizacion archivos masivos
- Plantilla Adventista carnets QR
