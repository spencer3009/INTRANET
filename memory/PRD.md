# PRD - EduNet School Management Platform

## Original Problem Statement
Build a comprehensive school management platform (React + FastAPI + MongoDB) for Peruvian schools with multi-tenant subdomain routing, role-based access control, academic management, accounting, messaging, schedules, and more.

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI + Motor (async MongoDB)
- Database: MongoDB
- 3rd Party: Cloudinary (images), ChatterPal (video avatar), YouTube/Vimeo oEmbed

## Credentials
- School Owner: `admin@elroble.edu` / `1234abc8` (subdomain: `elroble`)
- Support: `spencer3009@gmail.com` (system_admin_global)

---

## What's Been Implemented

### Latest Session (March 27, 2026)
- **Login Background Image**: Upload/delete custom background for each school's login page via Settings. Cloudinary WebP conversion, max 1500px. Dark overlay on login page.
- **WhatsApp Contact on Login**: Support profile WhatsApp field. Public endpoint includes `support_whatsapp`. Login page "Contacta al administrador" opens wa.me link. Hidden if no WhatsApp set.
- **Morosos Tab Redesign**: Collapsible pending months, merged Alumno+Grado columns, avatar initials, 6 columns
- **Morosos Tab Fix**: Changed from separate page navigation to inline tab
- **Synthetic Data**: S/8,000 expenses + S/34,000 income for March 2026
- **Logo Size**: Increased login logo from w-24 to w-32

### Previous Sessions
- Student Password Visibility, Support Panel School Names fix
- Academia Category Management, Reordering (Drag & Drop)
- ChatPal Integration (isolated to AcademiaPortalPage)
- Floating Help Avatar (8 core pages)
- Teacher Assignment Architecture refactor
- Load Time Optimization (Promise.all), Premium Loading Screens
- Modal Scroll Fixes

---

## Key Endpoints Added
- `PUT /api/settings/login-background` - Upload login background image
- `DELETE /api/settings/login-background` - Delete login background image
- `GET /api/settings/login-background` - Get current background URL
- `GET /api/schools/public/{subdomain}` - Includes login_background_url + support_whatsapp
- `PUT /api/support/me` - Now accepts whatsapp field

## Key DB Fields Added
- `schools.login_background_url` (String, optional)
- `schools.login_background_public_id` (String, optional)
- `users.whatsapp` (String, optional - on support user)

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
- UsersPage.jsx refactoring (>5000 lines)

## Known Issues
- Production deployment timeouts/520 errors (external constraint)
- MorososPage.jsx still exists as separate page (deprecated, can be removed)
