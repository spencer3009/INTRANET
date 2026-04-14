# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestión escolar full-stack (FastAPI + React + MongoDB) con módulos de asistencia QR, alimentación (PAE), movilidad, horarios unificados, psicología, contabilidad y suscripción.

## Core Requirements
- RBAC dinámico con roles múltiples (additional_roles en JWT)
- Carnets QR con plantillas personalizables (Classic, Moderna) y exportación PDF/ZIP
- Horarios unificados en 8 portales con CalendarGrid.jsx
- Portal Selector post-login para usuarios con múltiples roles
- Wizard anti-fraude para pagos Yape con operation_code único

## What's Been Implemented (Completed)
- Unificación de horarios en 8 portales (CalendarGrid.jsx pastel)
- Corrección bugs responsivos grilla horarios mobile
- Breaks independientes por grado/sección
- Drawer QR con preview HTML, plantillas classic/moderna, colores custom, PDF Grid/ZIP/Lista
- Optimización imágenes WebP (logos, marcas de agua)
- Rol Auxiliar de Movilidad (clon PAE con colores morados)
- Filtros cascada (Nivel->Grado->Sección) en Mis Cursos/Mis Alumnos
- Configuración recargos mora (Diario/Mensual, Fijo/Porcentaje)
- Configuración pronto pago (Fijo/Porcentaje)
- Roles auxiliares múltiples con PortalSelector
- Wizard suscripción 3 pasos con unique index operation_code
- **FIX (2026-04-14)**: Badge PDF de profesores muestra "Docente" correctamente (classic.py + moderna.py)

## Prioritized Backlog
### P0 (Done)
- All items above

### P1 (Next)
- Dashboard Owner con métricas reales
- Módulo de Matrículas (Enrollments)
- Psicología — Log de auditoría estricto

### P2 (Future)
- Módulo de Encuestas
- Optimización rendimiento carga masiva (3000 estudiantes)
- Refactorización CourseDetailPage.jsx (>11,000 líneas)
- Plantilla "Adventista" para carnets QR

## Architecture
- Backend: FastAPI (Python) on port 8001
- Frontend: React on port 3000
- Database: MongoDB Atlas
- PDF generation: ReportLab
- Image optimization: Pillow (WebP)
- QR: qrcode (backend) + qrcode.react (frontend preview)
- Storage: Cloudinary
- Auth: JWT with additional_roles array

## Key Files
- `/app/backend/services/qr_templates/moderna.py`
- `/app/backend/services/qr_templates/classic.py`
- `/app/backend/routes/qr_templates.py`
- `/app/frontend/src/components/students/QRTemplateDrawer.jsx`
- `/app/backend/routes/core.py`
- `/app/frontend/src/components/PaymentBlockModal.jsx`
