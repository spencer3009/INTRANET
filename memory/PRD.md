# EduNet - Product Requirements Document

## Overview
EduNet es una plataforma SaaS multi-tenant para colegios en Perú. Incluye módulos de gestión escolar como horarios, asistencia, exámenes, y comunicación.

## Core Modules

### 1. Asistencia (Attendance)
- **Pestaña Estudiantes**: Control manual de asistencia con estados (Presente, Tardanza, Ausente, Pendiente)
- **Pestaña Profesores**: Control de asistencia para docentes
- **Escanear QR**: Asistencia automática mediante escaneo de códigos QR únicos por estudiante
- **Reportes**: Informes de asistencia por período

### 2. Sistema QR
- Cada estudiante tiene un QR único (JWT con student_id y school_id)
- El QR se genera automáticamente al crear un estudiante
- Los admins pueden ver/descargar el QR de cada estudiante
- El escáner usa la cámara para detectar y registrar asistencia

### 3. Gestión de Usuarios
- Roles: owner, admin, teacher, student
- Vista de tarjetas con información del estudiante
- Edición de información académica (nivel, grado, sección, turno)
- Eliminación con cascade delete para evitar datos huérfanos

### 4. Horarios
- Horario de clases por sección
- Horario de exámenes

### 5. Sistema de Mensajería Interna
- Correo interno para estudiantes, profesores y administradores
- Bandeja de entrada, Enviados, Archivados, Papelera
- Indicadores de mensajes no leídos
- Chat widget con contactos categorizados para profesores

### 6. Portal de Padres (Parent Portal) ✅ NEW
- Réplica 1:1 del Portal del Alumno para padres/apoderados
- Dashboard con información del hijo seleccionado
- Página de Tareas con filtros (Todas, Pendientes, Entregadas, Calificadas)
- Página de Calificaciones con promedios por materia
- Página de Asistencia con navegación por mes
- Selector de hijos (multi-hijo) en sidebar
- Control de acceso RBAC - padres solo ven datos de hijos vinculados
- Vinculación padre-hijo mediante campo `padre_id` en el estudiante

## Technical Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Archivo principal (~18k líneas - DEUDA TÉCNICA)
- MongoDB como base de datos
- JWT para autenticación
- RBAC (Role-Based Access Control) implementado

### Frontend (React)
- `/app/frontend/src/` - Código fuente
- Shadcn UI components
- React Router para navegación
- React Query para caching de datos

## What's Been Implemented

### Session: 2026-02-23 (Company Logo in Headers) ✅
- **FEATURE: Logo de empresa en todos los headers**
  - Modificadas 18 páginas para usar `/api/settings/public/{subdomain}` en lugar de `/api/settings` (protegido)
  - Portales afectados: Estudiante, Padre, Profesor (Admin ya funcionaba)
  - El logo del colegio ahora se muestra correctamente en el header de todas las páginas
  - Páginas actualizadas:
    - `StudentDashboardPage.jsx`, `StudentCoursesPage.jsx`, `StudentExamSchedulePage.jsx`
    - `StudentSchedulePage.jsx`, `StudentMessagesPage.jsx`, `StudentProfilePage.jsx`
    - `StudentGradesPage.jsx`, `StudentAttendancePage.jsx`, `StudentCourseDetailPage.jsx`
    - `StudentTasksPage.jsx`
    - `ParentDashboardPage.jsx`, `ParentTasksPage.jsx`, `ParentGradesPage.jsx`
    - `ParentCoursesPage.jsx`, `ParentSchedulePage.jsx`, `ParentMessagesPage.jsx`
    - `ParentExamsPage.jsx`, `ParentAttendancePage.jsx`

### Session: 2026-02-23 (Parent Portal) ✅
- **FEATURE: Portal de Padres Completo (Réplica 1:1 del Portal del Alumno)**
  - Backend endpoints: `/api/parent/me`, `/api/parent/students`, `/api/parent/dashboard`, `/api/parent/tasks`, `/api/parent/grades`, `/api/parent/attendance`, `/api/parent/schedule`, `/api/parent/exam-schedule`, `/api/parent/messages/*`
  - Frontend pages: `ParentDashboardPage`, `ParentTasksPage`, `ParentGradesPage`, `ParentAttendancePage`
  - Frontend components: `ParentSidebar` (verde/emerald para diferenciarse del alumno)
  - Selector de hijos con soporte multi-hijo
  - Control de acceso RBAC: `verify_parent_student_access()`
  - **Resultados de pruebas**: 100% backend (18/18 tests), 100% frontend

### Session: 2026-02-23 (Teacher Chat Contacts Categorization) ✅
- **FEATURE: Lista de Contactos Inteligente para Profesores**
  - Endpoint `/api/messaging/academic/contacts` ahora devuelve contactos categorizados para profesores
  - 4 categorías:
    1. **Mis Alumnos**: Estudiantes de las materias que enseña el profesor
    2. **Padres/Apoderados**: Padres de los alumnos (con nombres de hijos vinculados)
    3. **Personal Administrativo**: Admins, Directors, Coordinadores, Propietario (con rol traducido)
    4. **Otros Profesores**: Otros docentes de la escuela
  - Frontend `MessageCenter.jsx` actualizado con:
    - Vista categorizada expandible/colapsable para profesores
    - Vista plana para estudiantes y admins (sin cambios)
    - Búsqueda que filtra a través de todas las categorías
    - Conteo de contactos por categoría
    - Indicadores de mensajes no leídos por categoría
  - **Resultados de pruebas**: 100% backend (18/18 tests), 100% frontend

### Session: 2026-02-22 (Teacher Tasks Page) ✅
- **FEATURE: Página de Tareas del Profesor con diseño del portal del estudiante**
  - Reescritura completa de `TeacherAssignmentsViewPage.jsx`
  - 4 cards de estadísticas: Por revisar, Calificadas, Activas, Todas
  - Los cards funcionan como filtros al hacer clic
  - Buscador de tareas por título o curso
  - Estado vacío con mensaje "Sin tareas" y botón "Crear Primera Tarea"
  - Modal de nueva tarea redirige a la página de cursos
  - Al hacer clic en una tarea, navega a `/teacher/courses/{subject_id}?tab=tareas&task={task_id}`
  - **Resultados de pruebas**: 100% frontend (24/24 tests pasados)

### Session: 2026-02-22 (Teacher Messages Page) ✅
- **FEATURE: Sistema de Mensajes del Profesor tipo Correo**
  - Reescritura completa de `TeacherMessagesPage.jsx` para usar sistema de correo interno
  - 4 carpetas: Bandeja de entrada, Enviados, Archivados, Papelera
  - Modal de composición con editor de texto enriquecido (TipTap)
  - Búsqueda de destinatarios con autocompletado
  - Vista de detalle del mensaje con info del remitente
  - Acciones: Responder, Archivar, Eliminar, Marcar leído/no leído
  - Acciones de papelera: Restaurar, Eliminar permanentemente, Vaciar papelera
  - Colores verde/teal consistentes con el portal del profesor
  - **Resultados de pruebas**: 100% frontend (18/18 features verificadas)

### Session: 2026-02-22 (Teacher Attendance Page) ✅
- **FEATURE: Página de Asistencia del Profesor (TeacherAttendancePage)**
  - Adaptado `TeacherAttendancePage.jsx` para usar endpoints del profesor
  - 3 pestañas: Estudiantes, Escanear QR, Reportes (sin pestaña "Profesores")
  - Endpoints actualizados:
    - `GET /api/teacher/attendance` - Lee de colección `attendances` para consistencia
    - `POST /api/teacher/attendance` - Guarda en colección `attendances` con `type: "student"`
  - Integración con reportes: los registros guardados aparecen en `/api/attendance/reports/students`
  - **Resultados de pruebas**: 100% backend (12/12), 100% frontend (11/11)
  - **Bug fix**: Añadido `level_name` al endpoint `/api/teacher/courses` para mostrar "INICIAL - 3 años - ÚNICA"

### Session: 2026-02-21 (RBAC Implementation) ✅
- **ARQUITECTURA: Sistema RBAC Completo**
  - Admin role ahora usa el mismo portal del Owner (no portal separado)
  - Restricciones implementadas:
    1. Admin NO tiene acceso a Settings (403 en API, oculto en sidebar)
    2. Admin acceso a Contabilidad controlado por flag `allow_admin_accounting`
  - Componentes modificados:
    - Backend: `require_section_access()` protege endpoints
    - Frontend: `permissions.js` helpers, `Sidebar.jsx` filtrado, `SettingsPage.jsx`, `AccountingPage.jsx`
  - Owner puede habilitar/deshabilitar acceso de Admin desde Settings > Configuración de Roles
  - **Resultados de pruebas**: 100% backend (15/15), 100% frontend (11/11)

### Session: 2026-02-21 (Performance Optimization) ✅
- **ARQUITECTURA: Optimización de Rendimiento - Portal Alumno (Tareas)**
  - Endpoint unificado `/api/student/tasks`
  - Cache en backend con TTLCache (60s)
  - Cache en frontend con React Query
  - Índices MongoDB optimizados

### Session: 2026-02-21 (Messaging System) ✅
- **FEATURE: Sistema de Mensajería Interno para Estudiantes**
  - Página `StudentMessagesPage.jsx` con interfaz tipo correo
  - Funciones: Responder, Archivar, Eliminar, Marcar como leído/no leído
  - Papelera completa con restauración y eliminación permanente

## RBAC System Architecture

### Backend
```python
# Secciones y permisos
SECTION_PERMISSIONS = {
    "settings": {"allowed_roles": ["owner"], "feature_flag": None},
    "accounting": {"allowed_roles": ["owner", "admin"], "feature_flag": "allow_admin_accounting"},
    "users": {"allowed_roles": ["owner", "admin", "director"]},
    # ... más secciones
}

# Protección de endpoints
@api_router.get("/settings")
async def get_settings(current_user = Depends(require_section_access("settings"))):
    # Solo owner puede acceder
```

### Frontend
```javascript
// lib/permissions.js
export function canAccessSection(user, section) {
  if (user.permissions?.sections) {
    return user.permissions.sections[section] === true;
  }
  // Fallback logic
}

// Sidebar.jsx
const navItems = isOwner(user) 
  ? allNavItems 
  : allNavItems.filter(item => canAccessSection(user, item.section));
```

## Pending Issues (P0)
- Ninguno crítico

## Upcoming Tasks

### P0 - Critical Technical Debt
- **Modularizar server.py**: El archivo tiene >18,000 líneas
  - Separar en routers por dominio: users, attendance, exams, grades, etc.

### P1 - Features
- **Cache Invalidation**: Implementar invalidación de cache cuando se crean/editan tareas
- Módulo de Matrículas (Enrollments)
- Sistema anti-trampas para exámenes
- Banco de preguntas para exámenes
- Notificaciones automáticas

### P2 - Improvements
- Reemplazar `window.confirm` y `alert` con modales custom
- Refactorizar `UsersPage.jsx` (~3,300 líneas)
- Refactorizar `StudentCourseDetailPage.jsx` (~4,800 líneas)

## Test Credentials
- **School**: elroble
- **Owner**: admin@elroble.edu / 1234abc8
- **Admin**: admin.prueba@elroble.edu / 1234abc8
- **Teacher**: sonia3009@gmail.com / 1234abc8
- **Student**: pepito@gmail.com / 1234abc8

## Key Endpoints
- `POST /api/auth/login` - Login con permisos RBAC incluidos
- `GET /api/auth/me` - Usuario actual con permisos
- `GET /api/settings` - Settings (solo owner)
- `PUT /api/settings/roles` - Toggle de flags de roles (solo owner)
- `GET /api/accounting/payments` - Pagos (owner + admin si flag habilitado)
- `GET /api/student/tasks` - Tareas del estudiante (cached)
- `GET /api/teacher/courses` - Cursos asignados al profesor (con level_name)
- `GET /api/teacher/students` - Estudiantes de secciones del profesor
- `GET /api/teacher/attendance` - Asistencia por sección/fecha (profesor)
- `POST /api/teacher/attendance` - Guardar asistencia (profesor)
- `GET /api/messaging/academic/contacts` - Contactos para chat (categorizados para profesores)
- `GET /api/parent/me` - Perfil del padre con hijos vinculados ✅ NEW
- `GET /api/parent/students` - Lista de hijos del padre ✅ NEW
- `GET /api/parent/dashboard?student_id=X` - Dashboard del hijo ✅ NEW
- `GET /api/parent/tasks?student_id=X` - Tareas del hijo ✅ NEW
- `GET /api/parent/grades?student_id=X` - Calificaciones del hijo ✅ NEW
- `GET /api/parent/attendance?student_id=X&month=YYYY-MM` - Asistencia del hijo ✅ NEW

## Database Collections
- `schools`: Incluye campo `allow_admin_accounting` (boolean)
- `users`: Usuarios con campo `qr_token`
- `tenant_settings`: Configuraciones por colegio
- `task_submissions`: Entregas de tareas

## Third-Party Integrations
- Cloudinary (imágenes)
- qrcode.react (generación QR)
- @yudiel/react-qr-scanner (escaneo QR)
- jspdf & jspdf-autotable (PDFs)
- @tanstack/react-query (caching)
- cachetools (backend caching)
- TipTap / Prosemirror (editor de texto)
