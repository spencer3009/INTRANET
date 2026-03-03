# EduNet - PRD (Product Requirements Document)

## Original Problem Statement
EduNet es una plataforma educativa para colegios peruanos. Sistema full-stack con FastAPI + React + MongoDB.

## Core Requirements
- Gestión de usuarios por roles (Owner, Admin, Profesor, Estudiante, Padre)
- Gestión académica (Niveles, Grados, Secciones, Turnos)
- Sistema de contabilidad y pagos
- Mensajería interna, Asistencia, Exámenes, Tareas
- Dashboard multi-rol

## Architecture
- Backend: FastAPI (`/app/backend/server.py`)
- Frontend: React (`/app/frontend/src/`)
- Database: MongoDB
- Image Storage: Cloudinary
- UI: Shadcn/UI + Tailwind CSS

## What's Been Implemented

### Session - March 3, 2026
- **Photo Upload Modal with Preview**: Camera icon opens modal with drag-and-drop, preview, Save/Cancel. Tested 15/15.
- **Grade Name Structural Validation**: INICIAL=dropdown (3/4/5 AÑOS), others=text with section-pattern blocking. Backend 11/11 + Frontend all pass.
- **Dropdown Fix for INICIAL**: Always shows 3 preset options regardless of existing data.
- **Auto-Grade Creation on Level Create**: When creating Primaria/Secundaria/Inicial, checkbox auto-creates standard grades. Checkbox auto-activates by level name. Backend + Frontend implemented.

### Previous Sessions
- Default IGV, Navigation Bug Fix, Student Photos in Income, Demo User Cleanup
- Combined Payment, Read-Only Amounts, Demo User Switch Restriction
- Pending Student Academic Exclusion (~20 endpoints)
- Data Integrity on Deletion, UI Readability in Academic Settings

## Prioritized Backlog

### P0
- Test "Disappearing Student Selection" bug in payment modal

### P1
- Modularize `server.py` into FastAPI routers
- Apply Intelligent Filters to Parents View
- Parent Portal, Matrículas module, Notifications, Question Bank

### P2
- Cache Invalidation, Replace window.confirm/alert, Fix hardcoded Dashboard data, Message Center count

## Key Files
- `/app/backend/server.py` - Main backend (22K+ lines)
- `/app/frontend/src/pages/AcademicSettingsPage.jsx` - Academic settings (levels, grades, sections)
- `/app/frontend/src/pages/UsersPage.jsx` - Users management
- `/app/frontend/src/components/PhotoUploadModal.jsx` - Photo upload modal

## Test Credentials
- **Director**: admin.settings@test.pe / 1234abc8 / school=demosettings
- **Support**: spencer3009@gmail.com / 1234abc8
