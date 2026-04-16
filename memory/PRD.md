# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestion escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Latest Session (2026-04-16)
### Feature: Generacion Automatica de Cobranza (3 mecanismos)

#### Mecanismo 1 - Bulk Manual (DONE)
- Boton "Generar cobranza del mes" en tab Morosos de AccountingPage.jsx
- Modal con: selector mes, concepto, monto, checkbox anti-duplicado, preview
- Endpoint `POST /api/accounting/payments/generate-bulk`
- Endpoint `GET /api/accounting/payments/generate-bulk/preview`
- Funcion compartida `generate_pending_payments_for_school()` con deduplicacion

#### Mecanismo 2 - Auto-matricula (DONE)
- Hook en `enroll_student()` que genera cuota pendiente del mes actual
- Solo si `pension_mensual > 0` en financial settings
- Silencioso (no rompe matricula si falla)

#### Mecanismo 3 - Cron Diario (DONE)
- `daily_billing_generation_cron()` corre cada 24h
- Por cada colegio activo, si `hoy.dia == dia_vencimiento_mensualidad`: genera cuotas
- Logs en coleccion `cron_logs`
- Configuracion: `dia_vencimiento_mensualidad` (1-28) en financial settings

#### Config UI (DONE)
- Campo "Dia de vencimiento mensual" en FinancialSettingsTab.jsx (junto a pension y matricula)
- `GenerateBillingModal.jsx` nuevo componente

### Previous Features
- Sistema de Cobro a Padres via Yape (QR) - 3 fases
- Bug fix: Calculo de renovacion de suscripcion
- Auto-Registro de Alumnos por Padres
- Dashboard Owner: Metricas reales

## Prioritized Backlog
### P1 (Next)
- Guard global para bloquear servicios a alumnos pending/rejected
- Dashboard Owner con metricas reales (cards restantes)
- Psicologia — Log de auditoria estricto

### P2 (Future)
- Modulo de Encuestas
- Optimizacion rendimiento (3000 estudiantes)
- Refactorizacion CourseDetailPage.jsx (>11K lineas) y UsersPage.jsx (>5.8K lineas)
- Plantilla "Adventista" para carnets QR

## Key Files
### Billing Generation
- `/app/backend/routes/accounting.py` - generate_pending_payments_for_school(), bulk endpoint, cron
- `/app/frontend/src/components/GenerateBillingModal.jsx`
- `/app/frontend/src/components/FinancialSettingsTab.jsx` - dia_vencimiento_mensualidad

### Yape Payment System
- `/app/backend/routes/parent_payments.py`
- `/app/frontend/src/components/YapeConfigPanel.jsx`
- `/app/frontend/src/components/YapePaymentVerification.jsx`
- `/app/frontend/src/components/YapePaymentModal.jsx`
- `/app/frontend/src/pages/ParentPaymentsPage.jsx`
- `/app/frontend/src/pages/ParentDashboardPage.jsx`

## Key DB Schema
- `payments`: Pagos/cuotas (collection principal de contabilidad)
- `school_financial_settings`: pension_mensual, dia_vencimiento_mensualidad, pronto_pago, interes
- `cron_logs`: Logs del cron de generacion automatica
- `yape_config`: Config QR por colegio
- `parent_payments`: Pagos reportados por padres via Yape
