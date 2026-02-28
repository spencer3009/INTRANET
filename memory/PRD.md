# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is an educational platform (intranet escolar) for Peruvian schools. Built as a full-stack FastAPI + React + MongoDB application with PWA support.

## Core Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React on port 3000
- **Database**: MongoDB
- **Storage**: Cloudinary
- **Auth**: JWT-based
- **PWA**: Custom service worker with WebView detection

## Key File Structure
```
/app
├── backend/
│   ├── server.py (monolith - needs refactoring)
│   └── routes/
│       ├── core.py
│       └── support.py (pricing, school management)
└── frontend/
    └── src/
        ├── pages/
        │   ├── SupportSchoolsPage.jsx (school cards with pricing)
        │   ├── SupportPricingPage.jsx (global pricing config)
        │   ├── SupportDashboardPage.jsx
        │   ├── DashboardPage.jsx
        │   ├── LoginPage.jsx (PWA install-first)
        │   └── SettingsPage.jsx
        └── components/
            ├── PwaInstallPrompt.jsx
            └── SupportLayout.jsx
```

## Completed Features (Feb 2026)
- [x] PWA with WebView detection and install-first experience
- [x] Custom PWA icon
- [x] Full-stack permission audit (owner role fixes)
- [x] Support panel with school management
- [x] School expiration dates (editable)
- [x] Subscription status card on owner dashboard
- [x] Global & per-school pricing configuration system
- [x] **Pricing calculation & display on school cards** (Feb 28, 2026)
  - Backend calculates: base_price + (students * per_student_fee) when months >= threshold
  - School cards show: total price, breakdown, student count, month active, per-student timing

## Pending Issues
- P0: Extra demo students in course view (blocked on user confirmation)
- P1: Hardcoded data on Owner Dashboard (Asistencia del Mes, Noticias y Avisos)
- P2: Message Center unread count discrepancy

## Upcoming Tasks
- P0: Delete demo students (pending user confirmation)
- P1: Modularize server.py into routers
- P2: Apply intelligent filters to Parents view

## Future/Backlog
- P1: Parent Portal feature parity
- P1: Cache invalidation for /api/student/tasks
- P1: Matriculas module
- P1: Anti-cheating system for exams
- P1: Question bank for exams
- P1: Automatic student notifications
- P2: Replace window.confirm/alert with custom modals

## Key Credentials
- Support: spencer3009@gmail.com / Socios3009
- School Owner: Iep.exploradores@gmail.com / 1234abc8 (subdomain: elroble)

## Pricing Model
- Global defaults stored in `pricing_config` collection
- Per-school overrides stored in `schools.pricing_override`
- Calculation: base_monthly_fee + (student_count * per_student_fee) when months_active >= per_student_from_month
- Default: S/50.00 base + S/0.70/student from month 3
