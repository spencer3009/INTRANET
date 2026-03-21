# EduNet - Changelog

## March 21, 2026 - Fork 6

### Performance Optimization: Course Dashboard (Fase 1 + 2) - COMPLETED
- **Fase 1 - get_course_posts**: Fixed N+1 queries with `asyncio.gather()` batch queries (200 queries → 4-5). Added projection excluding `submissions[]`. Fixed deprecated `asyncio.coroutine`. Added missing `file_url`, `file_name`, `metadata` to projection.
- **Fase 2 - sidebar-summary**: Parallelized 11 sequential `count_documents` queries into 1 `asyncio.gather()`. Removed slow `$regex` on `content` field for video counting (now indexed `file_type` prefix match only).
- **Fase 2 - presence/users**: Added optional `subject_id` query param to scope presence to course participants (~7 users vs 1000+). Backward compatible without filter.
- **Frontend fix**: Fixed presence map bug — converted API array response to O(1) lookup map in `CourseRightSidebar`.
- **Indexes**: Confirmed `post_likes`, `post_comments`, `course_activities`, `course_reminders`, `presence` indexes exist in `server.py`.
- Testing: 100% (Backend 22/22, Frontend all UI elements verified) - iteration_84.json

## March 11, 2026 - Fork 5

### Major Feature: Registro Auxiliar Excel-Format Rebuild - COMPLETED
- Completely rebuilt GradeBookTab.jsx to match exact Excel format provided by client
- Backend updated with 17 sub-grade fields (act_co, act_re, rf_r1-r5, comp_c1-c2, part_p1-p6, exam_mensual, exam_bimestral)
- 4-row grouped header: CRITERIOS DE EVALUACIÓN → Percentages → Category names → Sub-columns
- Auto-calculated PROMEDIO for each criterion group
- Weighted PROM. BIMESTRAL
- Sticky N° and Name columns during horizontal scroll
- Period lock/unlock, auto-save, Save/Close buttons
- Testing: 100% (Backend 16/16, Frontend all features verified)

### Bug Fix: Datos académicos no visibles - COMPLETED
- 42 registros de student_grades insertados en colección grades por error
- Limpieza de DB y protección defensiva

### UI Fix: Gradebook Sidebar & Tab Cleanup - COMPLETED
- Hid left/right sidebars when "REGISTRO AUXILIAR" tab is active
- Removed old "CALIFICACIONES" tab from course navigation

## March 6, 2026 - Fork 4 (Enhancement)

### Enhancement: Excel Template & Metadata Verification System - COMPLETED
- Fixed bug: Template Row 2 shows Nivel + Turno names
- Corrected collections: Uses academic_levels/grades/sections/shifts
- Template improvements: Row 4 info, freeze panes, example row skip
- Metadata verification system with hidden sheet
- Testing: Backend 100% (9/9), Frontend 100% - iteration_68.json

## March 6, 2026 - Fork 4

### Feature: Mass Student Import from Excel/CSV (P0) - COMPLETED
- Complete import modal with drag-and-drop, shift selector, preview, results
- Backend endpoints: template download, import process, pending list, activate
- Testing: Backend 100% (6/6), Frontend 95% (16/17) - iteration_66.json

## March 6, 2026 - Fork 3

### Feature: Mobile Bottom Nav for ALL Portals - COMPLETED
### Feature: Complete UI Unification - COMPLETED
### Feature: Mobile QR Direct Access - COMPLETED
### Feature: Replicate Subjects Between Sections - COMPLETED
### Feature: Mass Student Import Backend - COMPLETED
