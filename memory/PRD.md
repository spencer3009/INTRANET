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

### Bug Fix: Subject level_id Inconsistency (P0)
- **Root Cause**: Subjects had `level_id` pointing to wrong level (e.g., INICIAL instead of PRIMARIA)
- **Migration Script**: `POST /api/academic/subjects/fix-level-ids` - corrects all mismatched level_ids by deriving from grade's nivel_id
- **Preventive Fix**: `create_subject`, `update_subject`, `replicate_subjects` now auto-derive `level_id` from grade
- **Debug console.log removed** from TeacherAssignmentsPage.jsx

### Previous Session Completed
- Data injection (accounting income/expenses)
- Morosos tab redesign (inline, collapsible months)
- Login logo resize, custom background (Cloudinary)
- WhatsApp support link on login
- Public registration blocked
- Flexible ID filter for attendance
- ON_CREATE student activation mode

## Pending Issues

### P1: Deploy to Production
- Attendance flexible_id_filter needs production deploy
- Subject level_id migration needs to run in production

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

## Test Credentials
- School: elroble
- Email: admin@elroble.edu
- Password: 1234abc8
