# EduNet - Changelog

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
