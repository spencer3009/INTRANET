# PRD - EduNet School Management Platform

## Original Problem Statement
Build a comprehensive school management platform (React + FastAPI + MongoDB) for Peruvian schools. Features include multi-tenant subdomain routing, role-based access control, academic management, accounting/financial module, messaging, schedules, and more.

## User Personas
- **School Owner/Director**: Full admin access, financial oversight
- **Teachers**: Academic management, grades, attendance
- **Students**: View grades, schedules, messages
- **Parents**: Monitor child's progress, payments

## Core Requirements
- Multi-tenant architecture with subdomain routing
- Role-based access control (owner, director, admin, teacher, student, parent)
- Academic module (subjects, assignments, grades)
- Accounting module (payments, expenses, debtors, financial settings)
- Messaging system
- Schedule management
- Support/Academia portal with video tutorials

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI + Recharts
- Backend: FastAPI + Motor (async MongoDB)
- Database: MongoDB
- 3rd Party: ChatterPal (video avatar), Cloudinary (images), YouTube/Vimeo oEmbed

## Architecture
```
/app
├── backend/
│   ├── routes/
│   │   ├── academia.py
│   │   ├── subjects.py
│   │   ├── support.py
│   │   ├── users.py
│   │   ├── accounting.py
│   │   └── core.py
│   └── server.py
└── frontend/
    └── src/
        ├── App.js
        ├── components/
        │   ├── CourseLoadingScreen.jsx
        │   ├── FloatingHelpAvatar.jsx
        │   ├── FinancialSettingsTab.jsx
        │   ├── AccountingDateFilter.jsx
        │   ├── AccountingSummaryCards.jsx
        │   └── schedule/
        └── pages/
            ├── AccountingPage.jsx
            ├── CourseDetailPage.jsx
            ├── TeacherAssignmentsPage.jsx
            ├── AcademiaPortalPage.jsx
            └── SupportAcademiaPage.jsx
```

## Key DB Collections
- `users`: All user accounts with roles
- `payments`: Income records (student payments)
- `expenses`: Expense records (school outflows)
- `academic_assignments`: Teacher-subject assignments (source of truth)
- `payment_concepts`: Configurable payment types
- `school_financial_settings`: Financial configuration per school
- `discount_types`, `student_discounts`: Discount management

## Credentials
- School Owner: `admin@elroble.edu` / `1234abc8` (subdomain: `elroble`)

---

## What's Been Implemented

### Session History (Latest)
- Student Password Visibility (view/edit in modal)
- Support Panel School Names fix
- Academia Category Management (move videos between categories)
- Academia Reordering (native Drag & Drop)
- ChatPal Integration (isolated to AcademiaPortalPage)
- Floating Help Avatar (8 core pages)
- Teacher Assignment Architecture refactor
- Load Time Optimization (Promise.all)
- Premium Loading Screens
- Modal Scroll Fixes (ScheduleSettingsModal, ScheduleEntryModal)
- Synthetic pending payments: S/4,000 (5 records)
- Synthetic expenses: S/8,000 (8 records, March 2026)

---

## Prioritized Backlog

### P1
- Refactor Message Pages (consolidate duplicated components)

### P2
- Visual indicator of `sync_status` in Exams/Tasks List
- Gradebook Enhancements (Export PDF/Excel, Lock/Close Period)
- Double Scrollbar fix in "Registro Auxiliar"

### P3 (Future)
- Vinculacion Masiva Inteligente (Phase 2 parent import)
- Dashboard Owner con datos reales
- Build "Matriculas" (Enrollments) module
- Replace all window.confirm/alert with custom modals
- UsersPage.jsx refactoring (>5000 lines, needs sub-components)

## Known Issues
- Production deployment timeouts/520 errors (external constraint)
