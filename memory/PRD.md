# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestion escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Latest Session (2026-04-17)

### Fix: Auto-eliminacion de cuotas pendientes al registrar ingreso consolidado
- Cambio de `update_many(status=canceled)` a `find() + delete_many()` (eliminacion fisica)
- Logs de trazabilidad en coleccion `payments_log` con `accion: "auto_eliminado"`
- Anulacion manual (boton "Anular") NO fue afectada — sigue cambiando status a "canceled"
- Toast actualizado: "X cuotas pendientes anteriores fueron eliminadas automaticamente"
- Response field cambiado de `cancelled_pending` a `deleted_pending`

### Fix: Calculo de interes moratorio en multi-concepto
- Antes: interes se aplicaba al monto TOTAL (Matricula + Mensualidad = 650)
- Ahora: interes solo se aplica a la porcion de Mensualidad (350)
- Descuento Pronto Pago tambien aplica solo sobre Mensualidad
- Desglose visible: Subtotal, Pronto Pago, Mora (con dias), IGV, Total

### Previous Session Changes
- Feature: Sistema completo de Pagos Yape (Config QR, modal wizard, verificacion)
- Feature: Automatizacion de Cobranzas (Bulk, Cron, Auto-matricula)
- Feature: Cron Autonomo con Control de Ano Escolar
- Bug fix: Renovacion suscripcion (relativedelta)
- Bug fix: Asignaciones sin level_id, filtro teacher-subjects
- Bug fix: Parentesco padre-hijo (padre_id, madre_id, apoderado_id)

## Key Files
- `/app/backend/routes/accounting.py` - Billing, cron, payments, auto-delete logic
- `/app/frontend/src/pages/AccountingPage.jsx` - Ingresos UI, payment modal, calculo
- `/app/backend/routes/parent_payments.py` - Yape parent endpoints
- `/app/frontend/src/pages/ParentDashboardPage.jsx` - Card Yape
- `/app/frontend/src/components/YapePaymentModal.jsx`
- `/app/backend/routes/parent_portal.py`

## Key DB Schema
- `payments`: Pagos/cuotas (contabilidad). Soporta multi-concepto en array `conceptos`
- `payments_log`: Trazabilidad de eliminaciones automaticas (accion: "auto_eliminado")
- `school_financial_settings`: pension_mensual, dia_vencimiento, pronto_pago, interes, ano_escolar
- `cron_logs`: Logs del cron de facturacion
- `yape_config`: Config QR por colegio
- `parent_payments`: Pagos reportados via Yape

## Prioritized Backlog
### P1
- Guard global alumnos pending/rejected
- Dashboard Owner metricas reales (cards restantes)
- Psicologia — Log de auditoria

### P2
- Modulo Encuestas
- Optimizacion rendimiento (3000 estudiantes)
- Refactorizacion CourseDetailPage.jsx (11K lineas), UsersPage.jsx (5.8K), AccountingPage.jsx (2.9K)
- Plantilla Adventista carnets QR
