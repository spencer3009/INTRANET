# EduNet - Changelog

## March 11, 2026 - Fork 5

### Major Feature: Registro Auxiliar Excel-Format Rebuild - COMPLETED
- Completely rebuilt GradeBookTab.jsx to match exact Excel format provided by client
- Backend updated with 17 sub-grade fields (act_co, act_re, rf_r1-r5, comp_c1-c2, part_p1-p6, exam_mensual, exam_bimestral)
- 4-row grouped header: CRITERIOS DE EVALUACIÓN → Percentages (10%,25%,5%,25%,15%,20%) → Category names → Sub-columns
- Auto-calculated PROMEDIO for each criterion group
- Weighted PROM. BIMESTRAL = Actitudinal×10% + RevFichas×25% + Competencia×5% + Participaciones×25% + ExamenMensual×15% + ExamenBimestral×20%
- Sticky N° and Name columns during horizontal scroll
- Period lock/unlock, auto-save, Save/Close buttons
- Testing: 100% (Backend 16/16, Frontend all features verified)

### Bug Fix: Datos académicos no visibles - COMPLETED
- 42 registros de student_grades estaban insertados en colección grades (grados académicos) por error
- Limpieza de DB y protección defensiva con .get("nivel_id") en academic.py
- Limpieza de campos obsoletos del schema antiguo en student_grades

### UI Fix: Gradebook Sidebar & Tab Cleanup - COMPLETED
- Hid left/right sidebars when "REGISTRO AUXILIAR" tab is active
- Removed old "CALIFICACIONES" tab from course navigation

## March 6, 2026 - Fork 4 (Enhancement)

### Enhancement: Excel Template & Metadata Verification System - COMPLETED
- **Fixed bug**: Template Row 2 now shows Nivel + Turno names (was empty due to wrong collection names: `grades`→`academic_grades`, `sections`→`academic_sections`)
- **Corrected collections**: Uses `academic_levels`/`grades`/`sections`/`shifts` with `nombre` field
- **Template improvements**:
  - Row 4: "El usuario y contraseña serán generados automáticamente"
  - Freeze panes at A7 (headers always visible)
  - Example row (Juan Perez) auto-skipped during import
- **Metadata verification system**:
  - Hidden `edunet_metadata` sheet stores school_id, filter IDs/names, anio_escolar, timestamp
  - Import endpoint reads metadata, compares with current filters
  - Returns `metadata_mismatch` with side-by-side comparison
  - User can "Usar configuracion del archivo" or "Cancelar importacion"
  - Year mismatch detection with specific warning
- **Frontend**: Replaced FileSpreadsheet icon with Excel image from user
- **Frontend**: Added mismatch step in modal with comparison view and action buttons
- Testing: Backend 100% (9/9), Frontend 100% - iteration_68.json

## March 6, 2026 - Fork 4

### Feature: Mass Student Import from Excel/CSV (P0) - COMPLETED
- Fixed critical double `/api/api` URL bug in import template download and import endpoint
- Changed template endpoint from POST to GET for correct browser download
- Built complete import modal with:
  - Drag-and-drop file zone with visual feedback
  - Shift (turno) selector dropdown
  - File preview with name/size and remove option
  - Two-step flow: select file → confirm import with "Importar Estudiantes" button
  - Import result summary: created count, pending count, error details per row
- Backend endpoints:
  - `GET /api/students/import/template` - Excel template download
  - `POST /api/students/import` - Process CSV/XLSX/XLS file
  - `GET /api/students/pending` - List students with import errors
  - `PUT /api/students/pending/{id}/activate` - Activate fixed students
- Testing: Backend 100% (6/6), Frontend 95% (16/17) - iteration_66.json

## March 6, 2026 - Fork 3

### Feature: Mobile Bottom Nav for ALL Portals - COMPLETED
### Feature: Complete UI Unification - COMPLETED
### Feature: Mobile QR Direct Access - COMPLETED
### Feature: Replicate Subjects Between Sections - COMPLETED
### Feature: Mass Student Import Backend - COMPLETED
