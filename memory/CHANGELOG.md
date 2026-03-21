# EduNet - Changelog

## March 21, 2026 - Fork 7

### Feature: Unified Register Linkage System (Exams + Tasks) - P0 COMPLETED
- **Backend**: New unified endpoint `GET /api/register/availability` with TRIPLE verification (exams + tasks + manual grades)
- **Backend**: New collection `register_column_assignments` with unique index for cross-collection exclusivity
- **Backend**: Tasks can link to P1/P2/P3 only (400 error for EM/EB). Exams can link to EM/EB/P1/P2/P3
- **Backend**: Task creation (`POST /api/course/{subject_id}/posts`) now supports `register_column` field
- **Backend**: New service `register_sync.py` — centralized sync for both exams and tasks
- **Backend**: `sync_single_student_task()` triggers when teacher grades a submission (nota_vigesimal = round(score * 20 / max_points))
- **Backend**: Delete task cleans register_column_assignments + grades, clears register_column on soft delete
- **Backend**: `period_id` fully auto-resolved from active academic period (no frontend param needed)
- **Frontend**: Bimester field is now a read-only badge (`BIMESTRE I ● ACTIVO`) in both ExamModal and PremiumTaskModal
- **Frontend**: PremiumTaskModal now includes full "Vinculacion al Registro Auxiliar" block (P1/P2/P3 + Sin vinculacion)
- **Frontend**: ExamModal updated to use unified endpoint with new response format (assigned_to.type/id/title)
- **Frontend**: Cross-collection availability — if task occupies P1, exam shows P1 as "Ya asignado"
- Testing: 100% (Backend 11/11, Frontend all verified) - iteration_87.json

## March 21, 2026 - Fork 6b

### Feature: Exam ↔ Registro Auxiliar Linkage (P0) - COMPLETED
- **Backend**: New endpoint `GET /api/exams/register-availability` returns slot availability (EM, EB, P1, P2, P3) per subject + period
- **Backend**: Validation on create/update — 409 Conflict when slot already assigned, 400 for invalid values
- **Backend**: New fields on `online_exams`: `period_id`, `register_type`, `register_participation`, `sync_status`, `section_id`
- **Backend**: `sync_exam_to_register()` in `services/exam_register_sync.py` — syncs scores from exam attempts to `student_grades` collection
- **Backend**: `sync_single_student()` hook in `submit_exam_attempt` — instant vigesimal grade sync (Math.round(percentage * 20 / 100))
- **Backend**: Unique partial indexes on `online_exams` for concurrency protection
- **Backend**: Delete exam cleans register columns via sync("delete")
- **Frontend**: ExamModal completely rewritten with "Vinculacion al Registro Auxiliar" block as first section
- **Frontend**: Bimester select (loads from /api/academic/periods, pre-selects based on current month)
- **Frontend**: EM/EB radio buttons with "Disponible"/"Ya asignado" status badges
- **Frontend**: P1/P2/P3 toggle buttons with disabled states for occupied slots
- **Frontend**: Dynamic confirmation text showing linkage summary
- **Data**: Created 4 academic periods (BIMESTRE I-IV) for elroble school
- Testing: 100% (Backend 18/18, Frontend all verified) - iteration_85.json

### Performance Optimization: Course Dashboard (Fase 1 + 2) - COMPLETED
- Fase 1: Fixed N+1 queries, deprecated asyncio.coroutine, added file_url/file_name/metadata to projection
- Fase 2: Parallelized sidebar-summary (11→1 gather), removed slow regex, presence/users subject filter
- Frontend: Fixed presence map bug
- Testing: 100% (Backend 22/22, Frontend verified) - iteration_84.json

## March 11, 2026 - Fork 5

### Major Feature: Registro Auxiliar Excel-Format Rebuild - COMPLETED
### Bug Fix: Datos academicos no visibles - COMPLETED
### UI Fix: Gradebook Sidebar & Tab Cleanup - COMPLETED

## March 6, 2026 - Fork 4

### Enhancement: Excel Template & Metadata Verification System - COMPLETED
### Feature: Mass Student Import from Excel/CSV (P0) - COMPLETED

## March 6, 2026 - Fork 3

### Feature: Mobile Bottom Nav for ALL Portals - COMPLETED
### Feature: Complete UI Unification - COMPLETED
### Feature: Replicate Subjects Between Sections - COMPLETED
### Feature: Mass Student Import Backend - COMPLETED
