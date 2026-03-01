# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is an educational platform (intranet escolar) for Peruvian schools. Built as a full-stack FastAPI + React + MongoDB application with PWA support.

## Core Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React on port 3000
- **Database**: MongoDB
- **Storage**: Cloudinary
- **Auth**: JWT-based
- **PWA**: InstallGateway component with WebView detection

## Completed Features (Feb-Mar 2026)
- [x] PWA InstallGateway system (WebView detection, Chrome redirect, copy link)
- [x] Full-stack permission audit (owner role fixes)
- [x] Support panel with school management
- [x] School expiration dates (editable)
- [x] Subscription status in ProfileCard (owner/admin dashboard)
- [x] 3 billing modes (base_plus_student, student_only, flat_fee)
- [x] Per-school pricing overrides with mode selector
- [x] Support session fix (~280 endpoints fixed for school context)
- [x] HeroCarousel without external images (gradient CSS fallback)

## Key Components
- `InstallGateway.jsx` - Professional PWA install flow (WebView/Chrome/standalone)
- `ProfileCard.jsx` - Subscription status integrated
- `SupportPricingPage.jsx` - 3 billing modes
- `SupportSchoolsPage.jsx` - School cards with pricing
- `HeroCarousel.jsx` - CSS gradient, no Unsplash

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
