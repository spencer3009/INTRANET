# EduNet - PRD

## Original Problem Statement
Plataforma de gestion escolar (React + FastAPI + MongoDB) para el Colegio El Roble. Incluye modulos de usuarios, asignaturas, horarios, asistencia, examenes, tareas, contabilidad, mensajeria y panel de padres.

## Architecture
- **Frontend**: React (CRA) + Shadcn/UI + Tailwind CSS
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Integrations**: Google Drive, Firebase FCM, Cloudinary, YouTube oEmbed API

## What's Been Implemented
- [x] Full auth system with roles (owner, admin, teacher, student, parent)
- [x] Academic structure (grades, sections, subjects, schedules)
- [x] Attendance with QR scanning
- [x] Exams module with gradebook linkage (EM/EB/P1/P2/P3)
- [x] Tasks module with gradebook linkage (P1/P2/P3 only)
- [x] Unified `register_column_assignments` for mutual exclusivity
- [x] Auto-zero crons for expired exams and tasks
- [x] Accounting: Payments, expenses, financial configuration
- [x] **Sistema de Descuentos y Pensiones Variables** (FULL)
- [x] **Academia Phase 1**: Support panel CRUD (categories, subcategories, YouTube videos)
- [x] **Academia Phase 2**: Portal read-only view for school users (owner/admin/teacher)
- [x] **Academia Portal Corrections (Mar 22, 2026)**:
  - Fixed: Page now renders INSIDE portal layout (Sidebar + DashboardHeader)
  - Fixed: Premium UI redesign with hero banner, styled search, premium cards, professional modal

## Pending Issues
- **P1**: Inconsistent Subject List between pages
- **P1**: Incomplete Payment Verification Flow
- **P2**: Hardcoded Owner Dashboard Data

## Upcoming Tasks
- P1: Refactor duplicate Message pages
- P2: Visual sync_status indicator in Exams/Tasks
- P2: Gradebook enhancements (Export PDF/Excel, Lock Period)
- P2: Double scrollbar fix in "Registro Auxiliar"

## Future Tasks
- Complete Parent Portal feature parity
- Build "Matriculas" module
- Question Bank for Exams
- Replace window.confirm/alert with custom modals

## Test Credentials
- **Support**: spencer3009@gmail.com / Socios3009
- **Owner**: admin@elroble.edu / 1234abc8 (subdomain: elroble)

## Test Reports
- /app/test_reports/iteration_89.json (Discounts - 100%)
- /app/test_reports/iteration_90.json (Academia Phase 1 - 100%)
- /app/test_reports/iteration_91.json (Academia Phase 2 - 100%)
- /app/test_reports/iteration_92.json (Academia Portal Corrections - 100%)
