# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is a comprehensive academic management system (intranet escolar) for schools in Peru.

## Architecture
- **Frontend:** React + Tailwind + Shadcn/UI
- **Backend:** FastAPI + MongoDB
- **3rd Party:** Cloudinary (images), pandas, openpyxl, recharts

## What's Been Implemented

### Subscription System (March 15, 2026) - Fase 1+2
- [x] Backend module: `/api/subscription/` with status calculation
- [x] States: ACTIVO, AVISO_VENCIMIENTO, RESTRICCION_PARCIAL, PAGO_OBLIGATORIO, SUSPENDIDO, PAGO_EN_VERIFICACION
- [x] Progressive blocking: warning → partial restriction → mandatory payment → suspended
- [x] Subscription banner on owner dashboard (color-coded by severity)
- [x] SuspendedScreen (full block with payment form + contact support)
- [x] PaymentBlockModal (mandatory for PAGO_OBLIGATORIO state)
- [x] SubscriptionCard with status/amount/students/days overdue
- [x] Support panel: subscription status on school cards
- [x] Global grace days config (default: 7)
- [x] QR config endpoints (ready for Cloudinary upload)
- [x] Daily check endpoint for batch status updates

### Landing Page (March 2026)
- [x] Video section: Google Drive iframe
- [x] Lead form → WhatsApp +51992021294 ("Hola, deseo mas informacion" + datos)
- [x] "Solicitar demo" → "Informes"

### Owner Modal (March 2026)
- [x] Owner/titular button on school cards (view/edit)
- [x] Fields: nombre, nombre colegio, email, RUC, WhatsApp (+51 prefix), contrasena
- [x] Password visible to support (plain_password stored)
- [x] Password strength indicator + generator

### School Registration (March 2026)
- [x] Fields: nombre colegio, subdominio, RUC*, WhatsApp* (+51), nombre, email, contrasena
- [x] All fields mandatory with asterisk indicators
- [x] WhatsApp stored as +51XXXXXXXXX in DB

### Login
- [x] Removed "Crea una gratis" text

### Support Panel (Previous)
- [x] Finance page with advanced filters
- [x] Create/delete schools
- [x] Membership renewal with 8-digit code
- [x] Conditional "Pagar" button

## Pending Issues
| Priority | Issue | Status |
|----------|-------|--------|
| P0 | Subject list inconsistency | IN PROGRESS |
| P0 | Production database missing | BLOCKED |
| P1 | Double scrollbar Registro Auxiliar | NOT STARTED |
| P2 | Hardcoded Owner Dashboard data | NOT STARTED |
| P2 | Message Center unread count | NOT STARTED |

## Subscription System - Remaining Work
### Fase 3 - Support Management
- [ ] Suspend/reactivate buttons on school cards
- [ ] Manual payment registration from support
- [ ] Send reminder button

### Fase 4 - QR & Reminders
- [x] QR Yape upload from support panel (Cloudinary) - COMPLETED March 16
- [x] Yape-styled QR frame in PaymentBlockModal - COMPLETED March 16
- [x] Global persistent subscription banner (all sections) - COMPLETED March 16
- [x] Role-based banner restriction (owner/admin only) - COMPLETED March 16
- [ ] Automatic reminders (3 days before, day of, 2/5 days after)
- [ ] WhatsApp integration prep

### Frontend Restrictions
- [ ] Block create actions during RESTRICCION_PARCIAL
- [ ] URL-level route protection for PAGO_OBLIGATORIO/SUSPENDIDO

## Upcoming Tasks
- Refactor Message Pages
- Gradebook Enhancements (PDF/Excel, Lock Period)
- Dashboard Widgets Phase 2

## Backlog
- Parent Portal, Matriculas module, Exams Question Bank
- Replace window.confirm with custom modals
- Replicar Ano Academico

## Credentials
- **Owner:** subdomain=elroble, email=admin@elroble.edu, pwd=1234abc8
- **Support:** email=spencer3009@gmail.com, pwd=Socios3009

## Key API Endpoints
- GET /api/subscription/status - Current subscription status
- POST /api/subscription/check-action - Check if action allowed
- GET/PUT /api/subscription/qr-config - QR payment config
- GET/PUT /api/subscription/config - Grace days config
- POST /api/subscription/run-daily-check - Manual batch update
- GET/PUT /api/support/school-owner/{id} - Owner data
