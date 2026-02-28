# EduNet - Product Requirements Document

## Original Problem Statement
Build "EduNet", a school management platform (intranet) for Peruvian schools with multi-tenant architecture, PWA support, and comprehensive admin tools.

## Core Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)  
- **Database**: MongoDB
- **Hosting**: Emergent Platform with preview URL
- **Production Domain**: edunet.pe

## What's Been Implemented

### PWA (Progressive Web App) - COMPLETED
- Full PWA with manifest.json, service-worker.js (v6), custom icons
- WebView detection (WhatsApp, Facebook, Instagram) → shows "Open in Chrome" card
- Mobile-first install experience on /login
- Standalone mode detection (hides install UI when already installed)
- Global beforeinstallprompt capture in index.html before React mounts
- Auto claim() via service worker for immediate page control

### URL Refactor - COMPLETED
- Routes simplified from /school/:subdomain/... to /:subdomain/...
- Backward compatibility redirects in place
- School login at /:subdomain directly

### Owner Role Fix - COMPLETED (Feb 28, 2026)
- Fixed: onboarding was setting role="director" instead of role="owner"
- Fixed: isOwner() now checks both role==="owner" AND is_owner===true
- Fixed: canAccessSection() in permissions.js  
- Fixed: SettingsPage access check
- Fixed: ProfilePage super admin badge
- Full audit of backend server.py: all role checks now include is_owner fallback

### Subscription System - COMPLETED (Feb 28, 2026)
- Schools have created_at and expiration_date fields
- Subscription card on owner/admin dashboard with:
  - Progress bar (color-coded: green/amber/red/grey)
  - Countdown timer (days, hours, minutes)
  - Status: Active / Próximo a vencer / Vence pronto / Suspendido
- Support panel: edit expiration date per school
- Timezone fix: dates sent as T12:00:00Z to avoid shifting
- Auto-set expiration_date (30 days) for schools without it on startup

### Pricing Configuration - COMPLETED (Feb 28, 2026)
- Global pricing config (base fee + per-student fee + from which month)
- Per-school pricing overrides (custom discounts)
- New page: /support/pricing for global config
- Per-school pricing editor in school cards
- Calculated price based on student count and months active
- Backend endpoints: GET/PUT /support/pricing, GET/PUT/DELETE /support/school-pricing

### Parent Portal UI - COMPLETED (Previous sessions)
- Circular progress graphs
- Two-column responsive layout
- Child selector dropdown in welcome banner

## Pending Issues
- **P0**: Demo students (17 vs 5) - awaiting user confirmation to delete
- **P1**: Hardcoded data in Owner dashboard (Asistencia del Mes, Noticias)
- **P2**: Message Center unread count discrepancy
- **P2**: Replace window.confirm/alert with custom modals

## Upcoming Tasks
- **P1**: Modularize server.py into FastAPI routers
- **P1**: Complete Parent Portal feature parity
- **P1**: Build Matrículas (Enrollments) module
- **P1**: Anti-cheating system for exams
- **P2**: Intelligent filters on Parents view
- **P2**: Question Bank for exams
- **P2**: Automatic student notifications

## Credentials
- **Owner**: admin@elroble.edu / 1234abc8 (subdomain: elroble)
- **Parent**: miguel@gmail.com / 1234abc8
- **Student**: pepito@elroble.edu / 1234abc8
- **Teacher**: profesor.historia@elroble.edu / 1234abc8
- **Support**: spencer3009@gmail.com / 1234abc8

## Key Files
- `/app/frontend/src/components/PwaInstallPrompt.jsx` - PWA install logic
- `/app/frontend/src/components/SubscriptionCard.jsx` - Subscription status
- `/app/frontend/src/pages/SupportPricingPage.jsx` - Global pricing config
- `/app/frontend/src/pages/SupportSchoolsPage.jsx` - School management
- `/app/frontend/src/pages/LoginPage.jsx` - Login with mobile-first install
- `/app/frontend/src/lib/permissions.js` - Role/permission checks
- `/app/backend/routes/support.py` - Support panel APIs
- `/app/backend/server.py` - Main backend (monolithic, needs refactoring)
