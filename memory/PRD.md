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
- Responsive sidebar, dashboard header, modern cards

### Phase 2 - QR Mass Download Fix (DONE)
- Async sequential download with `safeDownloadBlob`
- No more OOM/520 errors on production

### Phase 3 - Auxiliar de Asistencia (DONE)
- Role `auxiliar_asistencia` with exclusive portal
- QR scanning, dashboard with Recharts stats (pie + bar)
- Manual attendance marking integration

### Phase 4 - Boleta de Venta Interna (DONE - 2026-04-10)
- **Backend**: 
  - Collections: `boleta_emisor_config`, `boletas_internas`
  - Endpoints: `/api/contabilidad/boleta-config` (GET/PUT), `/api/contabilidad/boleta-config/logo` (POST), `/api/contabilidad/boletas/{ingreso_id}/pdf` (GET), `/api/contabilidad/boletas/{ingreso_id}/anular` (POST), `/api/contabilidad/boletas` (GET)
  - Boleta auto-emitted on payment creation (hooked into POST /api/accounting/payments)
  - Auto-annul boleta when payment is canceled
  - PDF generated on-demand in memory (BytesIO), never saved to disk
  - num2words for total-to-text conversion in Spanish
  - Watermark "ANULADA" on annulled boletas
  - Atomic correlativo increment (no race conditions)
- **Frontend**:
  - Config sub-tab "Datos para Boletas" in Contabilidad > Configuracion
  - Emisor form: RUC validation, serie, logo upload (Cloudinary), pie de pagina
  - Download icon in Ingresos table actions column
  - Auto-download PDF on payment creation
  - Disabled icon for payments without boleta
  - Toast notifications for boleta status

### Bug Fixes (All DONE)
- z-index global de Modales (z-[200])
- z-index dropdown asignaturas en ScheduleEntryModal (z-[199])
- Pricing calculation fix (Base + Per student mode)
- Logo visibility fix in AttendancePage
- College billing logic fix in Support Dashboard

## Key DB Collections
- `users`, `schools`, `grades`, `sections`, `subjects`
- `attendances`, `payments`, `expenses`, `payment_concepts`
- `boleta_emisor_config` (one per school - emisor data for receipts)
- `boletas_internas` (receipt records with snapshots)

## API Prefixes
- `/api/accounting/` - payments, expenses, concepts, summaries
- `/api/contabilidad/` - boletas (config, PDF, annul, list)
- `/api/attendance/` - attendance, QR, aux dashboard
- `/api/auth/` - login, register, password
- `/api/users/`, `/api/grades/`, `/api/sections/`, etc.

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
