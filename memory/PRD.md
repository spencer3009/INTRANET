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
- **Morosos page**: Debtors tracking with search, status filters, date range filters, and summary cards
- **Configuracion tab**: Financial settings (pension, discounts, interest)
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

## Date: March 1, 2026 - Implemented
- **Date Range Filters & Summary Cards in Accounting**
  - New `GET /api/accounting/period-summary` backend endpoint
  - Added `date_from`/`date_to` params to debtors endpoint
  - Reusable `AccountingDateFilter` component
  - Reusable `AccountingSummaryCards` component (3 cards: Ingresos del periodo, Total Adeudado, Total General)
  - Integrated into Ingresos, Egresos tabs and Morosos page
  - Default dates: current month
  - Dynamic updates without page reload
  - Responsive design (stacks on mobile)
  - Testing: 100% pass rate (17/17 backend tests, all frontend verified)

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

## Key Credentials (Testing)
- School Owner: admin@elroble.edu / 1234abc8 (subdomain: elroble)
- Support: spencer3009@gmail.com / 1234abc8 (subdomain: demosettings)
