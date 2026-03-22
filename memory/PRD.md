# EduNet - PRD

## Original Problem Statement
Plataforma de gestión escolar (React + FastAPI + MongoDB) para el Colegio El Roble. Incluye módulos de usuarios, asignaturas, horarios, asistencia, exámenes, tareas, contabilidad, mensajería y panel de padres.

## Architecture
- **Frontend**: React (CRA) + Shadcn/UI + Tailwind CSS
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Integrations**: Google Drive (file storage), Firebase FCM (push notifications), Cloudinary (image storage)

## Core Modules
1. **Usuarios**: CRUD de estudiantes, profesores, padres, administradores
2. **Académico**: Grados, secciones, asignaturas, horarios
3. **Asistencia**: Registro por QR, reportes
4. **Exámenes**: CRUD, vinculación al registro auxiliar, auto-zero cron
5. **Tareas**: CRUD, vinculación al registro auxiliar (P1/P2/P3), auto-zero cron
6. **Registro Auxiliar**: Vista consolidada por asignatura/sección/periodo
7. **Contabilidad**: Pagos, gastos, morosos, configuración financiera, descuentos
8. **Mensajería**: Comunicados, mensajes directos
9. **Panel de Padres**: Vista limitada para apoderados
10. **Academia**: Centro de videos tutoriales de YouTube (Panel de Soporte)

## What's Been Implemented

### Completed Features (March 2026)
- [x] Full auth system with roles (owner, admin, teacher, student, parent)
- [x] Academic structure (grades, sections, subjects, schedules)
- [x] Attendance with QR scanning
- [x] Exams module with gradebook linkage (EM/EB/P1/P2/P3)
- [x] Tasks module with gradebook linkage (P1/P2/P3 only)
- [x] Unified `register_column_assignments` for mutual exclusivity
- [x] Auto-zero crons for expired exams and tasks
- [x] Read-only "Bimestre" badge (auto-resolved from active period)
- [x] Accounting: Payments, expenses, financial configuration
- [x] **Sistema de Descuentos y Pensiones Variables** (FULL)
- [x] **Academia - Centro de Videos Tutoriales** (FULL - Phase 1)
  - YouTube video CRUD with oEmbed title extraction
  - Categories and subcategories CRUD with reorder
  - 2-column layout (categories sidebar + video grid)
  - Video player modal with YouTube embed
  - Publish/Draft status management
  - Stats dashboard (total, categories, published, drafts)
  - Sidebar integration with Video icon between dividers
  - 6 seed categories with subcategories

## Pending Issues (Prioritized)
- **P1**: Inconsistent Subject List between "Asignaturas" page and "Asignar Docente" modal
- **P1**: Incomplete Payment Verification Flow (admin approve/reject pending payments)
- **P2**: Hardcoded Owner Dashboard Data (needs real-time statistics)

## Upcoming Tasks
- **P1**: Refactor duplicate Message pages into single component
- **P2**: Visual sync_status indicator in Exams/Tasks list
- **P2**: Gradebook enhancements (Export PDF/Excel, Lock Period)
- **P2**: Double scrollbar fix in "Registro Auxiliar"

## Future Tasks
- Academia Phase 2: Expose published videos to school admins
- Complete Parent Portal feature parity
- Build "Matrículas" (Enrollments) module
- Question Bank for Exams
- Replace all window.confirm/alert with custom modals

## Test Credentials
- **Support**: spencer3009@gmail.com / Socios3009
- **Owner**: admin@elroble.edu / 1234abc8 (subdomain: elroble)
- **Teacher**: luis.martinez@elroble.edu / 1234abc8
- **Parent**: micky@gmail.com / 1234abc8

## Test Reports
- /app/test_reports/iteration_87.json
- /app/test_reports/iteration_88.json
- /app/test_reports/iteration_89.json (Discount System - 100%)
- /app/test_reports/iteration_90.json (Academia - 100%)
