# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is a comprehensive academic management system (intranet escolar) for schools in Peru.

## Architecture
- **Frontend:** React + Tailwind + Shadcn/UI
- **Backend:** FastAPI + MongoDB
- **3rd Party:** Cloudinary (images), Firebase Admin SDK (push notifications), pandas, openpyxl, recharts

## What's Been Implemented

### Attendance Configuration (March 18, 2026) - NEW
- [x] UI section in Settings: "Configuracion de Asistencia"
- [x] Student/Teacher entry times (time inputs)
- [x] Tolerance minutes, absent-after-minutes (number inputs)
- [x] Toggle: auto late enabled, allow late entry
- [x] Backend: PUT /api/settings/attendance, GET /api/settings includes attendance_config
- [x] QR integration: auto-marks late/absent based on config
- [x] Push notification sends "tardanza" event type when late
- [x] Multi-tenant: per-school configuration

### Push Notifications System (March 18, 2026)
- [x] Firebase Admin SDK (project: edunet-b38ce)
- [x] FCM token registration, Service Worker for background push
- [x] send_attendance_notification() with formatted time (8:15 a. m.)
- [x] Integrated in QR entry AND exit flows
- [x] "Asistencia" tab in NotificationBell for parents
- [x] Duplicate prevention, audit logging, multi-parent support

### QR Scanner Improvements (March 18, 2026)
- [x] Camera opens once, stays open after scan
- [x] Scanner pauses on result (no re-scan)
- [x] "Escanear otro" button to resume scanning
- [x] Works for both student and teacher scanners

### Subscription System (March 2026)
- [x] Real-time state calculation, progressive restrictions
- [x] Owner/admin always can login (non-dismissible modal)
- [x] ProfileCard shows correct days overdue

### Support Panel (March 17-18, 2026)
- [x] Two-tab renewal: "Con codigo" / "Renovacion directa"
- [x] All schools visible, paginated dashboard
- [x] NotificationBell on school cards with payment notifications

## Pending Issues
| Priority | Issue | Status |
|----------|-------|--------|
| P0 | Subject list inconsistency | NOT STARTED (recurring 2+) |
| P1 | Double scrollbar Registro Auxiliar | NOT STARTED |
| P2 | Hardcoded Owner Dashboard data | NOT STARTED (recurring 9+) |

## Key API Endpoints
- PUT /api/settings/attendance - Save attendance config
- POST /api/push/register-token - Register FCM token
- GET /api/push/attendance-notifications - List attendance notifications
- GET /api/push/unread-count - Unread count
- POST /api/push/mark-read - Mark read
- POST /api/support/renew-membership - Renew with code or direct

## Credentials
- **Owner:** subdomain=elroble, email=admin@elroble.edu, pwd=1234abc8
- **Support:** email=spencer3009@gmail.com, pwd=Socios3009
- **Test Parent:** micky@gmail.com / 1234abc8

## Firebase
- Project: edunet-b38ce
- Service Account: /app/backend/secure/firebase-key.json
