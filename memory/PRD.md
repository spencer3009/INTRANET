# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is a comprehensive academic management system (intranet escolar) for schools in Peru.

## Architecture
- **Frontend:** React + Tailwind + Shadcn/UI
- **Backend:** FastAPI + MongoDB
- **3rd Party:** Cloudinary (images), pandas, openpyxl, recharts

## What's Been Implemented

### Subscription System (March 2026)
- [x] Backend module: `/api/subscription/` with real-time state calculation
- [x] States: ACTIVO, AVISO_VENCIMIENTO, RESTRICCION_PARCIAL, PAGO_OBLIGATORIO, SUSPENDIDO, PAGO_EN_VERIFICACION
- [x] Progressive blocking: warning → partial restriction → mandatory payment → suspended
- [x] Login restriction: only blocks non-owner/non-admin roles. Owner/admin ALWAYS can login
- [x] Owner/admin sees non-dismissible PaymentBlockModal (not SuspendedScreen) for SUSPENDIDO/PAGO_OBLIGATORIO
- [x] Global middleware blocks write operations for RESTRICCION_PARCIAL
- [x] ProfileCard shows correct days overdue using `fecha_vencimiento` field
- [x] SubscriptionBanner persistent across all intranet pages
- [x] QR Yape upload from support panel (Cloudinary)
- [x] Daily cron job for batch status updates (secondary to real-time calculation)

### Support Panel - Renewal System (March 17, 2026)
- [x] Two-tab renewal modal: "Con codigo" and "Renovacion directa"
- [x] "Con codigo": Verify 8-digit operation code from client
- [x] "Renovacion directa": Renew without operation code (WhatsApp payment proof)
- [x] Both options renew for 30 days, log renewal, create finance entry
- [x] Support sees ALL schools (not just assigned) on Colegios page

### Support Panel - Notification Bell (March 18, 2026)
- [x] NotificationBell component on each school card header
- [x] Bell between school name and user icon: [Logo] Name [Bell] [User]
- [x] States: gray outline (no notifications) / violet filled + red badge (pending payments)
- [x] Dropdown shows payment details: operation code, amount, date, requester name
- [x] Backend returns `pending_payments` array per school
- [x] No notification without operation code, no duplicates, lazy load safe

### Support Dashboard - Pagination (March 17, 2026)
- [x] "Ultimos Colegios Registrados" shows total count
- [x] Paginated endpoint: `/api/support/schools-paginated?page=1&per_page=5`
- [x] Pagination controls (prev/next) when total > 5

### Landing Page (March 2026)
- [x] Video section, lead form → WhatsApp, "Informes" button

### School Registration & Owner Modal (March 2026)
- [x] Complete registration with RUC, WhatsApp (+51), password generator

### Login
- [x] Role-based restrictions: students/teachers/parents blocked on PAGO_OBLIGATORIO/SUSPENDIDO
- [x] Owner/admin always allowed to login

## Pending Issues
| Priority | Issue | Status |
|----------|-------|--------|
| P0 | Subject list inconsistency | NOT STARTED (recurring 2+) |
| P1 | Double scrollbar Registro Auxiliar | NOT STARTED |
| P2 | Hardcoded Owner Dashboard data | NOT STARTED (recurring 9+) |
| P2 | Message Center unread count | NOT STARTED (recurring 9+) |

## Upcoming Tasks
- Refactor Message Pages (consolidation)
- Gradebook Enhancements (PDF/Excel, Lock Period)
- Dashboard Widgets Phase 2 (real data)

## Backlog
- Parent Portal feature parity
- Matriculas module
- Exams Question Bank
- Replace window.confirm/alert with custom modals
- Replicar Ano Academico

## Credentials
- **Owner:** subdomain=elroble, email=admin@elroble.edu, pwd=1234abc8
- **Support:** email=spencer3009@gmail.com, pwd=Socios3009
- **Test Student:** miguelon@gmail.com / 1234abc8
- **Test Teacher:** elprofe@gmail.com / 1234abc8

## Key API Endpoints
- GET /api/subscription/status - Real-time subscription status
- POST /api/support/renew-membership - Renew with code or direct
- GET /api/support/schools - All schools (for global admin)
- GET /api/support/schools-paginated - Paginated schools list
- GET /api/support/payment-requests - All payment requests
