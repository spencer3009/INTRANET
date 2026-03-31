# EduNet - School Management Platform PRD

## Original Problem Statement
Full-stack React + FastAPI + MongoDB school management platform for Peruvian schools. Features include academic structure management, attendance, grading, teacher assignments, accounting, messaging, and more.

## Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Hosting**: Emergent Platform (preview) / Production at edunet.pe

## What's Been Implemented

### Core Academic Structure
- Levels (INICIAL, PRIMARIA, SECUNDARIA), Grades, Sections, Section Types
- Academic Years with status management
- Subjects CRUD with section-level granularity
- Teacher Assignments to subjects/sections

### Authentication & Users
- JWT-based auth with school subdomains
- Roles: owner, admin, director, teacher, parent, student
- Custom login page with backgrounds (Cloudinary), WhatsApp support link
- Public registration blocked

### Attendance Module
- Flexible ID filtering (handles String + ObjectId mismatches)
- Production-ready with normalized IDs

### Accounting Module
- Income/Expenses tracking
- Morosos (debtors) inline tab with redesigned UI
- Financial settings with ON_CREATE student activation

### Teacher Assignments
- Full CRUD for teacher-subject-section assignments
- Cascade filter modal (Level > Grade > Section > Subject)
- Teachers summary sidebar

## Recently Completed (March 2026)

### Demo Management System (March 31)
- **Backend** (`routes/demo.py`): 7 endpoints — clone, delete, reclone, status, create access, list accesses, revoke access
- Clones 40 colecciones en orden de dependencia con remapeo de IDs (old_id → new_id)
- Anonimización de alumnos y padres (nombres ficticios, emails demo)
- Accesos temporales con credenciales + link WhatsApp
- Validación de expiración en login (`auth.py`)
- Cron job cada 24h para limpieza de demos expirados
- **Frontend** (`SupportDemosPage.jsx`): Sección Demos en Panel de Soporte con UI completa
- **Testing**: 100% (13/13 backend, todos los flujos frontend)

### Student Card Level Name Fix (March 30)
- Corregido bug donde tarjetas de estudiantes en vista agrupada mostraban nivel incorrecto
- `renderStudentCard` ahora recibe `levelName` como parámetro directo
- `getLevelColor` soporta match parcial ("NIVEL INICIAL" → "INICIAL")

### ChatterPal Mobile Fix (March 30)
- Fix para avatar no visible en móvil al navegar vía SPA
- Unhide inmediato al montar + reintentos para mobile (10x cada 500ms)

### Previous Sessions Completed
- Subject level_id migration script + auto-derivation fix
- Password change endpoint fix (`PUT /api/auth/password`)
- Unified profile photo uploads across all portals
- Parent Profile page created (`ParentProfilePage.jsx`)
- ChatterPal integration (Landing + Academia Portal)
- Landing Page SEO/UI improvements (Vimeo video, meta tags)
- FloatingHelpAvatar remapped to 9 specific views
- Data injection, Morosos redesign, login customization
- Flexible ID filter for attendance, ON_CREATE student activation

## Pending Issues

### P1: Deploy to Production
- Attendance flexible_id_filter needs production deploy
- Subject level_id migration needs to run in production
- Student card level name bug fix (was showing "SECUNDARIA" for all levels due to color-based inference)

### P2: Orphan Collection Cleanup
- DELETE school leaves ~15 collections orphaned
- Awaiting user approval to implement

## Upcoming Tasks
- P1: Refactor Message Pages (consolidate duplicates)
- P2: Visual indicator of sync_status in Exams/Tasks
- P2: Gradebook: Export PDF/Excel, Lock/Close Period
- P2: Double scrollbar fix in "Registro Auxiliar"

## Future/Backlog
- Vinculacion Masiva Inteligente (Phase 2 Parent Import)
- Dashboard Owner with real data
- Matriculas (Enrollments) module
- Replace window.confirm/alert with custom modals

## Refactoring Needed
- UsersPage.jsx (>5000 lines) - split into sub-components
- TeacherAssignmentsPage.jsx - move filtering to backend

## Key Endpoints
- `POST /api/academic/subjects/fix-level-ids` - Migration script
- `PUT /api/settings/login-background` - Custom login bg
- `DELETE /api/settings/login-background` - Remove login bg
- `PUT /api/support/me` - Update support profile (whatsapp)

## 3rd Party Integrations
- Cloudinary (image hosting) - Emergent managed keys
- ChatterPal v8.5 (video avatar widget) - External script, requires domain whitelisting (edunet.pe)
- Vimeo (video hosting) - External URL embed

## Test Credentials
- School: elroble
- Email: admin@elroble.edu
- Password: 1234abc8
