# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestion escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Latest Session (2026-04-17)

### Fix: Interes moratorio visible en Portal del Padre
- Backend parent_portal.py: calcula mora por dias de atraso para pagos pending (no solo overdue)
- Devuelve `interest_charge`, `days_late`, `total_mora_pending` en la respuesta
- Dashboard padre: card "Deuda del Mes" ahora muestra S/ 357 con "+S/ 7.00 mora"
- Pagina "Estado de Pagos": detalle mensual muestra S/ 357.00 con "+S/ 7.00 mora (12d)"

### Fix: Auto-eliminacion de cuotas pendientes al registrar ingreso consolidado
- Eliminacion fisica de cuotas pending + log en `payments_log` con `accion: "auto_eliminado"`
- Anulacion manual (boton "Anular") no afectada

### Fix: Calculo de interes moratorio corregido
- Interes solo se aplica sobre porcion de Mensualidad (no sobre Matricula)
- Desglose visible: Subtotal, Mora, Total en modal de nuevo ingreso
- "Confirmar pago" auto-calcula mora en backend
- Columnas separadas BASE | MORA | TOTAL en tabla de Ingresos
- Calculo unificado usando fecha UTC en todos los puntos

## Key Files
- `/app/backend/routes/accounting.py` - Billing, payments, auto-delete, interest
- `/app/backend/routes/parent_portal.py` - Parent financial data with mora calculation
- `/app/frontend/src/pages/AccountingPage.jsx` - Ingresos UI, payment modal
- `/app/frontend/src/pages/ParentDashboardPage.jsx` - Parent dashboard with mora
- `/app/frontend/src/pages/ParentPaymentsPage.jsx` - Parent payments detail with mora

## Key DB Schema
- `payments`: Pagos/cuotas. Campos adicionales: interest_amount, interest_days_late, subtotal_conceptos
- `payments_log`: Trazabilidad de eliminaciones automaticas
- `school_financial_settings`: pension_mensual, interes_activo, interes_valor, interes_tipo, pronto_pago_*

## Prioritized Backlog
### P1
- Guard global alumnos pending/rejected
- Dashboard Owner metricas reales (cards restantes)
- Psicologia — Log de auditoria

### P2
- Modulo Encuestas
- Optimizacion rendimiento (3000 estudiantes)
- Refactorizacion CourseDetailPage.jsx (11K lineas), UsersPage.jsx (5.8K), AccountingPage.jsx (3K)
- Plantilla Adventista carnets QR
