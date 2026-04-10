# EduNet - School Management System

## Original Problem Statement
Platform for school management with modules for coordination, accounting, attendance, psychology, and more. Premium redesign with Linear/Notion style UI.

## Core Architecture
- **Backend**: FastAPI + MongoDB (async motor)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **PDF Generation**: ReportLab (boletas, credentials, QR)
- **Charts**: Recharts
- **File Storage**: Cloudinary
- **Auth**: JWT-based with role-based access control

## Roles
- owner, director, admin, coordinator, teacher, student, parent, auxiliar_asistencia, psicologo, support

## Implemented Features (Stable)

### Phase 1 - Premium Redesign (DONE)
- Linear/Notion-style UI across all coordinator views

### Phase 2 - QR Mass Download Fix (DONE)
- Async sequential download with `safeDownloadBlob`

### Phase 3 - Auxiliar de Asistencia (DONE)
- Role `auxiliar_asistencia` with exclusive portal, QR scanning, dashboard with Recharts

### Phase 4 - Boleta de Venta Interna (DONE - 2026-04-10)
- **Backend**: Collections `boleta_emisor_config`, `boletas_internas`. Endpoints for config, PDF download, annulment. Auto-emission on payment creation, auto-annul on cancel. PDF on-demand via ReportLab + BytesIO. Logo from school settings (not boleta config).
- **Frontend**: Config sub-tab "Datos para Boletas". Preview modal with iframe after registration. Direct download from table actions. num2words for total-to-text.
- **Preview Modal** (2026-04-10): Replaced auto-download with `BoletaPreviewModal` showing PDF in iframe with Imprimir/Descargar buttons. Table download remains direct.

### Bug Fixes (All DONE)
- z-index global de Modales (z-[200])
- z-index dropdown asignaturas en ScheduleEntryModal (z-[199])
- Pricing calculation fix, Logo visibility fix, College billing logic fix

## Key DB Collections
- `users`, `schools`, `grades`, `sections`, `subjects`
- `attendances`, `payments`, `expenses`, `payment_concepts`
- `boleta_emisor_config` (one per school - emisor data for receipts)
- `boletas_internas` (receipt records with snapshots)

## API Prefixes
- `/api/accounting/` - payments, expenses, concepts, summaries
- `/api/contabilidad/` - boletas (config, PDF, annul, list)
- `/api/attendance/`, `/api/auth/`, `/api/users/`, `/api/grades/`, etc.

## Test Accounts
See /app/memory/test_credentials.md

## Prioritized Backlog
### P1
- Dashboard Owner con metricas reales
- Modulo de Matriculas (Enrollments)
- Psicologia: Log de auditoria estricto

### P2
- Modulo de Encuestas
- Optimizacion servidor examenes masivos (3000 students)
- Refactorizacion CourseDetailPage.jsx (>11,000 lineas)
- React Portal para modales globales
