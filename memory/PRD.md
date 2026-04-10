# EduNet - School Management System

## Original Problem Statement
Platform for school management with modules for coordination, accounting, attendance, psychology, and more. Premium redesign with Linear/Notion style UI.

## Core Architecture
- **Backend**: FastAPI + MongoDB (async motor)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **PDF Generation**: ReportLab (boletas, credentials, QR)
- **Charts**: Recharts
- **File Storage**: Cloudinary
- **Push Notifications**: Firebase Cloud Messaging (HTTP v1 API)
- **Auth**: JWT-based with role-based access control

## Implemented Features (Stable)

### Phase 1-3 (DONE)
- Premium redesign, QR mass download fix, Auxiliar de Asistencia portal

### Phase 4 - Boleta de Venta Interna (DONE)
- Backend + Frontend complete. Preview modal with iframe. Logo from school settings.

### Phase 5 - Seed Demo Accounting (DONE)
- POST /api/admin/seed-demo-accounting - realistic payments, expenses, boletas

### Phase 6 - FCM Push Notifications (DONE - 2026-04-10)
- **Backend**:
  - `services/fcm_service.py`: HTTP v1 API with google-auth OAuth2, token caching, auto-deactivation of invalid tokens
  - `POST /api/notifications/register-device`: Upserts in `device_tokens` collection, syncs with `push_tokens`
  - `POST /api/support/schools/{school_id}/test-push`: Sends push to school owner, creates notification in DB
  - Graceful degradation: if FIREBASE_PROJECT_ID is empty, logs warning and returns (0,0)
- **Frontend**:
  - `firebase.js` updated to use env vars with fallback to hardcoded values
  - `useParentNotifications.js` registers with both legacy and new device_tokens endpoints
  - Support panel: "Probar Push" button on each school card with detailed feedback
- **Collections**: `device_tokens` (user_id, school_id, fcm_token, platform, user_agent, active)
- **Status**: Code complete. Awaiting Firebase credentials in .env for end-to-end testing.

### Support Panel Additions
- Bulk "Matriculados a Activo" button (support-only)
- Individual "Cambiar a Activo" in student card menu (support-only)

## Firebase ENV Setup (pending user configuration)
Backend: FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON
Frontend: REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_AUTH_DOMAIN, REACT_APP_FIREBASE_PROJECT_ID, REACT_APP_FIREBASE_MESSAGING_SENDER_ID, REACT_APP_FIREBASE_APP_ID, REACT_APP_FIREBASE_VAPID_KEY

## Test Accounts
See /app/memory/test_credentials.md

## Prioritized Backlog
### P1
- Dashboard Owner con metricas reales
- Modulo de Matriculas (Enrollments)
- Psicologia: Log de auditoria estricto

### P2
- Modulo de Encuestas
- Optimizacion servidor examenes masivos (3000 students)
- Refactorizacion CourseDetailPage.jsx (>11,000 lineas)
