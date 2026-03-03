# EduNet - PRD

## Original Problem Statement
EduNet: Plataforma educativa para colegios peruanos. Full-stack: FastAPI + React + MongoDB.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) | Frontend: React | DB: MongoDB | Images: Cloudinary

## What's Been Implemented

### Session - March 3, 2026
- **Photo Upload Modal with Preview**: Camera icon opens modal with drag-and-drop, preview, Save/Cancel
- **Grade Name Structural Validation**: Dropdown fijo para Inicial/Primaria/Secundaria, validación anti-sección
- **Auto-Grade Creation**: Checkbox al crear nivel genera grados estándar automáticamente
- **Smart Filtering**: Dropdowns filtran grados existentes y niveles completos, botón "Agregar" se oculta
- **Subjects → Section-Based Structure (P0 MAJOR)**: Asignaturas ahora pertenecen a Secciones. Flujo: Nivel → Grado → Sección → Asignaturas. Backend con `section_id`, migración de datos existentes, frontend con vista intermedia de secciones.

### Previous Sessions
- Default IGV, Navigation Bug Fix, Student Photos in Income, Demo User Cleanup
- Combined Payment, Read-Only Amounts, Demo User Switch Restriction
- Pending Student Academic Exclusion (~20 endpoints), Data Integrity on Deletion, UI Readability

## Prioritized Backlog

### P0
- Test "Disappearing Student Selection" bug in payment modal

### P1
- Modularize `server.py` into FastAPI routers
- Apply Intelligent Filters to Parents View
- Parent Portal, Matrículas module, Notifications, Question Bank

### P2
- Cache Invalidation, Replace window.confirm/alert, Fix hardcoded Dashboard, Message Center count

## Key Files
- `/app/backend/server.py` - Main backend (22K+ lines)
- `/app/frontend/src/pages/SubjectsPage.jsx` - Subjects management (now section-based)
- `/app/frontend/src/pages/AcademicSettingsPage.jsx` - Academic settings
- `/app/frontend/src/components/PhotoUploadModal.jsx` - Photo upload modal

## Test Credentials
- **Director**: admin.settings@test.pe / 1234abc8 / school=demosettings
- **Support**: spencer3009@gmail.com / 1234abc8
