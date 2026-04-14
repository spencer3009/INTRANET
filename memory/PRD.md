# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestión escolar full-stack (FastAPI + React + MongoDB) con módulos de asistencia QR, alimentación (PAE), movilidad, horarios, psicología, contabilidad y suscripción.

## Core Requirements
- RBAC dinámico con roles múltiples (additional_roles en JWT)
- Carnets QR con plantillas personalizables (Classic, Moderna)
- Horarios unificados en 8 portales
- Portal Selector post-login multi-rol
- Wizard anti-fraude para pagos Yape
- Escáneres QR unificados visualmente (Asistencia/PAE/Movilidad)
- Contabilidad con multi-concepto por ingreso

## Completed Features
- Unificación horarios (CalendarGrid.jsx)
- Breaks independientes por grado/sección
- Drawer QR (preview HTML, plantillas, colores, PDF/ZIP/Lista)
- Optimización imágenes WebP
- Rol Auxiliar Movilidad
- Filtros cascada (Nivel->Grado->Sección)
- Recargos mora + Pronto pago (porcentaje)
- Roles auxiliares múltiples con PortalSelector
- Wizard suscripción 3 pasos con unique index
- FIX: Badge PDF profesores "Docente"
- FIX: Referencias cruzadas Movilidad↔PAE
- REDESIGN: Escáneres PAE/Movilidad estilo Asistencia
- Botón "Cambiar Portal" en DashboardHeader y Settings Modals
- **Multi-concepto en Registrar Ingreso** (backend conceptos array + frontend lista editable + tabla con desglose)

## Prioritized Backlog
### P1 (Next)
- Dashboard Owner con métricas reales
- Módulo de Matrículas (Enrollments)
- Psicología — Log de auditoría estricto

### P2 (Future)
- Módulo de Encuestas
- Optimización rendimiento (3000 estudiantes)
- Refactorización CourseDetailPage.jsx (>11K líneas)
- Plantilla "Adventista" para carnets QR

## Architecture
- Backend: FastAPI on port 8001
- Frontend: React on port 3000
- Database: MongoDB Atlas
- PDF: ReportLab | Images: Pillow (WebP)
- QR: qrcode + qrcode.react
- Storage: Cloudinary | Auth: JWT

## Key Files
- `/app/backend/routes/accounting.py` (multi-concepto endpoint)
- `/app/frontend/src/pages/AccountingPage.jsx` (PaymentFormModal multi-concepto)
- `/app/backend/services/qr_templates/moderna.py`, `classic.py`
- `/app/frontend/src/pages/movilidad/MovilidadScanner.jsx`
- `/app/frontend/src/pages/pae/PaeScanner.jsx`
- `/app/frontend/src/components/DashboardHeader.jsx` (Cambiar portal)
- `/app/frontend/src/components/MobileBottomNav.jsx`
