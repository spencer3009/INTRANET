# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestion escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Latest Session (2026-04-15)
### Feature: Sistema de Cobro a Padres via Yape (QR)
Implementacion completa del sistema de pagos Yape para padres de familia:

#### Fase 1 - Backend (DONE)
- Coleccion `yape_config`: Config QR por colegio (imagen base64, titular, instrucciones, switch)
- Coleccion `parent_payments`: Pagos reportados por padres (separada de `payments`)
- 4 endpoints padre: GET yape-config, GET schedule/{student_id}, POST report, GET history
- 4 endpoints owner: GET/PUT yape-config, GET yape-payments, PUT verify/reject

#### Fase 2 - Frontend Propietario (DONE)
- Tab "Cobro Yape" en AccountingPage.jsx (6to tab, estilo purple)
- `YapeConfigPanel.jsx`: Toggle grande (pill), upload QR cuadrado (borde dashed gris), titular, instrucciones
- `YapePaymentVerification.jsx`: Tabla con filtros, modal verificar/rechazar

#### Fase 3 - Frontend Padre - Pagos (DONE)
- Boton "Pagar con Yape" en cada cuota pendiente de ParentPaymentsPage.jsx
- `YapePaymentModal.jsx`: Modal paso a paso (QR + codigo operacion)
- Estados: Pendiente/En Verificacion/Pagado/Rechazado

#### Card Yape en Dashboard Padre (DONE)
- Card "Pagar con Yape" al lado de "Estado Financiero" en ParentDashboardPage.jsx
- Solo visible si yape_config.enabled === true
- Muestra: proxima cuota, barra de progreso purple, monto destacado, boton Yape
- Se refresca al cambiar de hijo
- Abre YapePaymentModal directamente desde el dashboard

### Previous Changes
- Bug fix: Calculo de renovacion de suscripcion (relativedelta months=1)
- Auto-Registro de Alumnos por Padres
- Contabilidad: Multiples conceptos de pago
- Dashboard Owner: Metricas reales de asistencia

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
### Yape Payment System
- `/app/backend/routes/parent_payments.py`
- `/app/backend/routes/accounting.py` (lineas 1996+)
- `/app/frontend/src/components/YapeConfigPanel.jsx`
- `/app/frontend/src/components/YapePaymentVerification.jsx`
- `/app/frontend/src/components/YapePaymentModal.jsx`
- `/app/frontend/src/pages/ParentPaymentsPage.jsx`
- `/app/frontend/src/pages/ParentDashboardPage.jsx` (card Yape)
- `/app/frontend/src/pages/AccountingPage.jsx`

## Key DB Schema
- `yape_config`: `school_id` (unique), `enabled`, `qr_image_base64`, `account_holder_name`, `instructions_text`
- `parent_payments`: `school_id`, `student_id`, `parent_id`, `amount`, `month`, `year`, `yape_operation_code`, `status`
- `payments`: Pagos confirmados del colegio (contabilidad)
- `users`: `role`, `dni`, `enrollment_status`
- `schools`: `expiration_date`, `fecha_vencimiento`
