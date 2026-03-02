# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is an educational platform for Peruvian schools, built as a full-stack React/FastAPI/MongoDB application. It includes a PWA for mobile users, a support panel for school management, a subscription/billing system, and a robust permissions system.

## Architecture
- **Frontend**: React (CRA) with Tailwind CSS + Shadcn/UI components
- **Backend**: FastAPI with MongoDB (Motor async driver)
- **Database**: MongoDB
- **3rd Party**: Cloudinary (image storage)

## What's Been Implemented

### Core Platform
- Multi-school architecture with subdomain-based routing
- Role-based access control (owner, admin, teacher, student, parent)
- PWA with custom install gateway for WebViews (WhatsApp)
- Support panel for global school management

### Student Status System (NEW - March 2, 2026)
- **States**: pending → enrolled → active (+ withdrawn)
- **Manual enrollment**: PUT /api/students/{id}/enroll (assigns grade/section, changes to enrolled)
- **Auto-activation**: On payment creation, auto-updates status based on config
- **Configurable activation mode**: "matricula" or "matricula_pension"
- **Login restriction**: Only active/enrolled students can login; pending/withdrawn blocked
- **Status badges**: Yellow (Pendiente), Blue (Matriculado), Green (Activo), Red (Retirado)
- **Status filters**: Filter students by status in Users page
- **Action buttons**: Matricular, Retirar, Reactivar in student card menu
- **Migration endpoint**: POST /api/students/migrate-statuses

### Accounting Module (Contabilidad)
- **Resumen tab**: Dashboard with KPIs, charts
- **Ingresos tab**: CRUD with status filters, date range filters (Mes/Rango/Año), summary cards
- **Egresos tab**: CRUD with category filters, date range filters, summary cards
- **Morosos page**: Debtors tracking with KPI cards
- **Configuracion tab**: Financial settings + Payment Concepts CRUD + Activation Config
- **Payment Concepts**: Full CRUD, auto-seeded defaults (Matrícula, Mensualidad), dynamic in payment form
- **Pronto Pago**: Auto-discount in payment form based on financial settings
- **Interest/Mora**: Auto-calculated daily interest for late payments
- **Period Summary API**: GET /api/accounting/period-summary

### Billing System
- 3-mode billing (Base+Student, Student-Only, Flat Rate)
- Per-school overrides via support panel

## Key DB Schema
- **users.student_status**: "pending" | "enrolled" | "active" | "withdrawn" (direct field)
- **payment_concepts**: { id, school_id, name, amount, concept_type, status, is_default }
- **school_financial_settings**: { pension_mensual, matricula, pronto_pago_*, interes_*, activacion_modo }

## Prioritized Backlog

### P0 (Critical)
- Delete demo students (blocked on user confirmation)
- Modularize server.py (critical tech debt - 21K+ lines)

### P1 (High)
- Remove hardcoded data from Owner Dashboard (Asistencia del Mes, Noticias y Avisos) - recurring x3
- Fix Message Center unread count discrepancy - recurring x3
- Apply intelligent filters to Parents view
- Complete Parent Portal feature parity
- Build "Matrículas" (Enrollments) module
- Anti-cheating system for exams
- Question Bank for exams
- Automatic student notifications

### P2 (Low)
- Replace window.confirm/alert with global custom modal
- Auto-downgrade: active → enrolled if debt > X months (Phase 2)

## Key Credentials
- School Owner: admin@elroble.edu / 1234abc8 (subdomain: elroble)
- Support: spencer3009@gmail.com / 1234abc8
