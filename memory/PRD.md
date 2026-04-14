# PRD — EduNet (Colegio El Roble)

## Original Problem Statement
Sistema de gestión escolar full-stack (FastAPI + React + MongoDB) con módulos de asistencia QR, alimentación (PAE), movilidad, horarios, psicología, contabilidad, registro auxiliar y suscripción.

## Core Requirements
- RBAC dinámico con roles múltiples (additional_roles en JWT)
- Carnets QR con plantillas personalizables
- Horarios unificados en 8 portales
- Portal Selector post-login multi-rol
- Escáneres QR unificados visualmente
- Contabilidad con multi-concepto por ingreso
- Personalización global de criterios de evaluación por colegio

## Completed Features
- Unificación horarios (CalendarGrid.jsx)
- Breaks independientes por grado/sección
- Drawer QR (preview HTML, plantillas, colores, PDF/ZIP/Lista)
- Optimización imágenes WebP
- Rol Auxiliar Movilidad
- Filtros cascada (Nivel->Grado->Sección)
- Recargos mora + Pronto pago
- Roles auxiliares múltiples con PortalSelector
- Wizard suscripción 3 pasos
- FIX: Badge PDF profesores "Docente"
- FIX: Referencias cruzadas Movilidad↔PAE
- REDESIGN: Escáneres PAE/Movilidad estilo Asistencia
- Botón "Cambiar Portal" en portales auxiliares
- Multi-concepto en Registrar Ingreso (contabilidad)
- Desglose por concepto en Boleta PDF
- Switch activar/desactivar avatar flotante (Centro de Ayuda)
- **Personalización global de criterios de evaluación** (edición inline de categorías y subcolumnas del Registro Auxiliar, scope por colegio, solo admin/director)

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
- Key collections: evaluation_criteria_config, payments, boletas, movilidad_registros, pae_registros

## Key Files
- `/app/backend/routes/evaluation_criteria.py` (NEW — GET/PUT criterios)
- `/app/frontend/src/components/GradeBookTab.jsx` (edición inline criterios)
- `/app/backend/routes/accounting.py` (multi-concepto)
- `/app/frontend/src/pages/AccountingPage.jsx`
- `/app/backend/services/boleta_pdf_generator.py` (desglose multi-concepto)
- `/app/frontend/src/pages/movilidad/MovilidadScanner.jsx`
- `/app/frontend/src/pages/pae/PaeScanner.jsx`
- `/app/frontend/src/components/DashboardHeader.jsx`
- `/app/frontend/src/components/FloatingHelpAvatar.jsx`
- `/app/frontend/src/pages/AcademiaPortalPage.jsx`
