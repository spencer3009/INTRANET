# EduNet - Changelog

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
