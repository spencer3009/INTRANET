# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet is a comprehensive academic management system (intranet escolar) for schools in Peru.

## Architecture
- **Frontend:** React + Tailwind + Shadcn/UI
- **Backend:** FastAPI + MongoDB
- **3rd Party:** Cloudinary (images), Firebase Admin SDK (push notifications), pandas, openpyxl, recharts

## What's Been Implemented

### Push Notifications System (March 18, 2026) - P0
- [x] Firebase Admin SDK initialized (project: edunet-b38ce)
- [x] FCM token registration for parent portal
- [x] Service Worker for background push notifications
- [x] `send_attendance_notification()` function for attendance events
- [x] Multi-parent support (notifies ALL parents linked to student)
- [x] Duplicate prevention (same student/event/day)
- [x] "Asistencia" tab in NotificationBell for parents only
- [x] Unread count included in global badge
- [x] Click notification → navigate to correct child
- [x] Foreground FCM listener with toast notifications
- [x] Audit logging in `notification_audit` collection
- [x] Security: filtered by parent→child, same school validated

### Subscription System (March 2026)
- [x] Real-time state calculation from fecha_vencimiento
- [x] Owner/admin ALWAYS can login (see non-dismissible modal)
- [x] Students/teachers/parents blocked on PAGO_OBLIGATORIO/SUSPENDIDO
- [x] ProfileCard shows correct days overdue using fecha_vencimiento

### Support Panel (March 17-18, 2026)
- [x] Two-tab renewal modal: "Con codigo" / "Renovacion directa"
- [x] All schools visible (not just assigned)
- [x] Paginated dashboard: 5 per page
- [x] NotificationBell on school cards with payment notifications
- [x] Bell sound (Web Audio API) on pending payments

## Pending Issues
| Priority | Issue | Status |
|----------|-------|--------|
| P0 | Subject list inconsistency | NOT STARTED (recurring 2+) |
| P0 | Connect push to actual QR attendance flow | NEXT |
| P1 | Double scrollbar Registro Auxiliar | NOT STARTED |
| P2 | Hardcoded Owner Dashboard data | NOT STARTED (recurring 9+) |
| P2 | Message Center unread count | NOT STARTED (recurring 9+) |

## Key API Endpoints (Push Notifications)
- POST /api/push/register-token - Register FCM token
- DELETE /api/push/remove-token - Remove FCM token
- GET /api/push/attendance-notifications - List attendance notifications
- GET /api/push/unread-count - Unread count
- POST /api/push/mark-read - Mark read (single or all)

## Key API Endpoints (Subscription/Support)
- POST /api/support/renew-membership - Renew with code or direct
- GET /api/support/schools - All schools (global admin)
- GET /api/support/schools-paginated - Paginated schools

## Upcoming Tasks
- Connect `send_attendance_notification()` to QR attendance scanning flow
- Subject list inconsistency fix
- Gradebook Enhancements (PDF/Excel, Lock Period)

## Backlog
- Parent Portal feature parity
- Matriculas module, Exams Question Bank
- Replace window.confirm/alert with custom modals
- Dashboard widgets with real data

## Credentials
- **Owner:** subdomain=elroble, email=admin@elroble.edu, pwd=1234abc8
- **Support:** email=spencer3009@gmail.com, pwd=Socios3009
- **Test Parent:** micky@gmail.com / 1234abc8
- **Test Student:** miguelon@gmail.com / 1234abc8
- **Test Teacher:** elprofe@gmail.com / 1234abc8

## Firebase Config
- Project: edunet-b38ce
- Service Account: /app/backend/secure/firebase-key.json
- Frontend config in: /app/frontend/src/lib/firebase.js
