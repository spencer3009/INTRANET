# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestion escolar full-stack SaaS multi-tenant (FastAPI + React + MongoDB).

## Latest Session (2026-04-17)
### Feature: Cron Autonomo con Control de Ano Escolar

- Campos `fecha_inicio_ano_escolar` y `fecha_fin_ano_escolar` en `school_financial_settings`
- UI: Date pickers en seccion "Ano Escolar" arriba de Configuracion Financiera
- Badge de estado: verde "Cobranza automatica activa" / rojo "Cobranza automatica pausada"
- Cron `daily_billing_generation_cron()` verifica: 1) ano escolar configurado, 2) dentro del rango, 3) dia de vencimiento
- Colegios sin fechas configuradas → omitidos con log
- Reactivacion automatica al actualizar fechas para nuevo ano

### Feature: Generacion Automatica de Cobranza
- Boton "Generar cobranza del mes" movido a tab Configuracion (desde Morosos)
- 3 mecanismos: bulk manual, auto-matricula, cron diario
- Funcion compartida `generate_pending_payments_for_school()` con deduplicacion
- Coleccion `cron_logs` para tracking

### Feature: Sistema de Cobro a Padres via Yape (QR)
- Config QR owner, verificacion pagos, modal wizard 3 pasos
- Card Yape en dashboard padre con pronto pago e intereses
- 8 endpoints (4 padre + 4 owner)

### Previous Changes
- Bug fix: Renovacion suscripcion (relativedelta)
- Fix: Asignaciones sin level_id crasheaban GET /api/academic/assignments
- Fix: Filtro teacher-subjects por grade_id/section_id del subject
- Fix: Parentesco padre-hijo (padre_id, madre_id, apoderado_id)

## Key Files
- `/app/backend/routes/accounting.py` - Billing generation, cron, financial settings, yape verification
- `/app/frontend/src/components/FinancialSettingsTab.jsx` - Ano escolar, dia vencimiento, generar cobranza
- `/app/frontend/src/components/GenerateBillingModal.jsx`
- `/app/backend/routes/parent_payments.py` - Yape parent endpoints
- `/app/frontend/src/components/YapePaymentModal.jsx`
- `/app/frontend/src/pages/ParentDashboardPage.jsx` - Card Yape

## Key DB Schema
- `school_financial_settings`: pension_mensual, dia_vencimiento_mensualidad, fecha_inicio_ano_escolar, fecha_fin_ano_escolar, pronto_pago_*, interes_*
- `payments`: Pagos/cuotas (contabilidad)
- `cron_logs`: Logs del cron (school_id, tipo, fecha_ejecucion, cuotas_generadas, motivo_omision)
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
- Refactorizacion CourseDetailPage.jsx y UsersPage.jsx
- Plantilla Adventista carnets QR
