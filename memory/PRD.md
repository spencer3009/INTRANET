# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is an educational platform for Peruvian schools. Full PWA with support panel, billing, and permissions.

## Core Architecture
- **Backend:** FastAPI (Python) - `/app/backend/server.py`
- **Frontend:** React - `/app/frontend/src/`
- **Database:** MongoDB
- **Image Storage:** Cloudinary

## What's Been Implemented

### Accounting Module
- Date filters with Month/Range/Year presets for Ingresos and Egresos
- Summary cards with real-time updates
- Full CRUD for Payment Concepts (Conceptos de Pago)
- Intelligent payment form with:
  - Filterable photo-based student autocomplete
  - Auto-fill amounts based on selected concept
  - Dynamic concept hiding (e.g., Matricula if already paid)
  - Early payment discount and late payment interest calculations
- IGV (18%) checkbox **disabled by default** (changed 2026-03-02)

### Student Status System
- Flow: pending -> matriculado -> active -> withdrawn
- Automatic status transitions based on payments
- Login restricted to active students only
- Migration script for existing students

### UI/UX Enhancements
- iOS-style switches in financial settings
- Enlarged student photos and text on cards
- Redesigned date filters with presets

## Login Credentials
- **Owner:** admin@elroble.edu / 1234abc8
- **School:** elroble

## Pending Issues
1. **P0:** Disappearing student selection in PaymentFormModal (fix applied, needs verification)
2. **P1:** Extra demo students in course views (30 seeder students)
3. **P2:** Hardcoded data on Owner Dashboard (Asistencia, Noticias)
4. **P2:** Message Center unread count discrepancy

## Upcoming Tasks
- P0: Mutually exclusive discounts/interest logic
- P1: Delete demo students
- P2: Modularize server.py into routers
- P2: Apply intelligent filters to Parents view

## Future/Backlog
- P1: Parent Portal feature parity
- P1: Matriculas module
- P1: Automatic notifications
- P1: Exams module enhancements
- P2: Cache invalidation for /api/student/tasks
- P2: Replace window.confirm/alert with custom modals
- P2: Auto status change active->enrolled on debt threshold

## Key Files
- `/app/backend/server.py` (monolithic - needs refactoring)
- `/app/frontend/src/pages/Accounting/AccountingPage.jsx`
- `/app/frontend/src/pages/Accounting/FinancialConfigTab.jsx`
- `/app/frontend/src/components/Modals/PaymentFormModal.jsx`
- `/app/frontend/src/pages/Users/UsersPage.jsx`
