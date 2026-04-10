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
- owner, director, admin, coordinator, teacher, student, parent, auxiliar_asistencia, psicologo, support, system_admin_global

## Implemented Features (Stable)

### Phase 1-3 (DONE)
- Premium redesign, QR mass download fix, Auxiliar de Asistencia portal

### Phase 4 - Boleta de Venta Interna (DONE)
- Backend + Frontend complete. Preview modal with iframe. Logo from school settings.

### Phase 5 - Seed Demo Accounting (DONE - 2026-04-10)
- `POST /api/admin/seed-demo-accounting` endpoint
- Requires `system_admin_global` role + confirm token
- Generates realistic payments (pensiones by grade level, matrícula, extras), expenses (salaries, services, operational), and boletas
- ~20% morosos with 1-3 months pending, ~80% al día
- Boletas in correlativo order by payment_date ascending
- Reset mode deletes all existing data before inserting

## Key DB Collections
- `payments`, `expenses`, `boleta_emisor_config`, `boletas_internas`
- `users`, `schools`, `grades`, `sections`

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
