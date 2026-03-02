# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is an educational platform for Peruvian schools, built as a full-stack React/FastAPI/MongoDB application. It includes a PWA for mobile users, a support panel for school management, a subscription/billing system, and a robust permissions system.

## Architecture
- **Frontend**: React (CRA) with Tailwind CSS + Shadcn/UI components
- **Backend**: FastAPI with MongoDB (Motor async driver)
- **Database**: MongoDB
- **Deployment**: Kubernetes container
- **3rd Party**: Cloudinary (image storage)

## What's Been Implemented

### Core Platform
- Multi-school architecture with subdomain-based routing
- Role-based access control (owner, admin, teacher, student, parent)
- PWA with custom install gateway for WebViews (WhatsApp)
- Support panel for global school management

### Accounting Module (Contabilidad)
- **Resumen tab**: Dashboard with KPIs, charts (pie, bar, area)
- **Ingresos tab**: CRUD for payments with status filters, date range filters, and summary cards
- **Egresos tab**: CRUD for expenses with category filters, date range filters, and summary cards
- **Morosos page**: Debtors tracking with search, status filters, KPI cards
- **Configuracion tab**: Financial settings (pension, discounts, interest) + Payment Concepts management
- **Payment Concepts**: Full CRUD for configurable payment concepts with auto-seeded defaults
- **Period Summary API**: `GET /api/accounting/period-summary` with date filtering

### Billing System
- 3-mode billing (Base+Student, Student-Only, Flat Rate)
- Per-school overrides via support panel
- Price calculations and projections

### Bug Fixes Applied
- Support session data visibility (mass refactor ~280 endpoints)
- Console 404 errors from Unsplash images (CSS gradient fallback)
- Invisible progress bar (CSS min-width fix)
- Infinite recursion bug in server.py

## Recent Changes

### March 2, 2026 - Payment Concepts System
- New MongoDB collection `payment_concepts` with CRUD API endpoints
- Auto-seeded default concepts (Matrícula, Mensualidad) from financial settings
- Concepts have: name, amount, concept_type (recurrente/unico), status (active/inactive), is_default
- Default concepts cannot be deleted, only deactivated
- Payment form now uses dynamic concepts from API with auto-fill amounts
- PaymentConceptsSection component in Configuracion tab
- Testing: 100% pass (22/22 backend + all frontend verified)

### March 1, 2026 - Date Range Filters & Summary Cards
- New `GET /api/accounting/period-summary` backend endpoint
- Reusable `AccountingDateFilter` and `AccountingSummaryCards` components
- Integrated into Ingresos and Egresos tabs (NOT Morosos per user request)
- Default dates: current month
- Testing: 100% pass

## Prioritized Backlog

### P0 (Critical)
- Delete demo students (blocked on user confirmation)
- Modularize server.py (critical tech debt - 21K+ lines)

### P1 (High)
- Remove hardcoded data from Owner Dashboard (Asistencia del Mes, Noticias y Avisos) - recurring x3
- Fix Message Center unread count discrepancy - recurring x3
- Apply intelligent filters to Parents view
- Complete Parent Portal feature parity
- Cache invalidation for /api/student/tasks
- Build "Matrículas" (Enrollments) module
- Anti-cheating system for exams
- Question Bank for exams
- Automatic student notifications

### P2 (Low)
- Replace window.confirm/alert with global custom modal

## Key DB Schema
- **payment_concepts**: `{ id, school_id, name, amount, concept_type, status, is_default, created_at, updated_at }`
- **school_financial_settings**: `{ pension_mensual, matricula, pronto_pago_activo, pronto_pago_monto, pronto_pago_fecha_limite, interes_activo, interes_tipo, interes_valor }`
- **schools**: `pricing_override` with `mode: str`
- **pricing_config**: `mode: str`

## Key Credentials
- School Owner: admin@elroble.edu / 1234abc8 (subdomain: elroble)
- Support: spencer3009@gmail.com / 1234abc8
