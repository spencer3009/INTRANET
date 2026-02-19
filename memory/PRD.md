# EduNet - Intranet SaaS para Colegios en Perú

## Descripción General
Sistema de intranet premium multi-tenant para instituciones educativas en Perú. Cada colegio accede mediante URL path (`edunet.pe/school/{identifier}`) con módulos académicos, administrativos y comunicación.

## Arquitectura Técnica
- **Backend**: FastAPI (Python)
- **Frontend**: React.js con Tailwind CSS
- **Base de Datos**: MongoDB
- **Almacenamiento de Imágenes**: Cloudinary
- **Componentes UI**: Shadcn/UI

---

## Refactorización de Código (En Progreso)

### CourseDetailPage.jsx (7,242 líneas → Extracción parcial completada)
**Componentes extraídos a `/app/frontend/src/components/course/`:**
- ✅ `TasksTableContent.jsx` (~630 líneas) - Tabla de tareas con vista detallada y entregas
- ✅ `PremiumTaskModal.jsx` (~500 líneas) - Modal premium para crear tareas + TaskTimePicker
- ✅ `MaterialTableContent.jsx` (~400 líneas) - Gestión de materiales de estudio
- ✅ `ForumContent.jsx` (~380 líneas) - Contenido del foro de discusión
- ✅ `PremiumForumModal.jsx` (~380 líneas) - Modal para crear temas del foro
- ✅ `ExamsContent.jsx` (~500 líneas) - Gestión de exámenes + ExamDetailView + modales

**Pendientes de extraer (para sesión futura):**
- `DashboardContent` (~210 líneas) - Dashboard del curso
- `PostCard` (~300 líneas) - Tarjeta de publicación
- `GradesContent` (~100 líneas) - Contenido de calificaciones
- `AttendanceContent` (~300 líneas) - Contenido de asistencia
- `RemindersTabContent` (~150 líneas) - Recordatorios

**Archivo índice:** `/app/frontend/src/components/course/index.js`

**NOTA**: Los componentes extraídos AÚN NO están integrados al archivo principal. 
La integración se realizará en una sesión dedicada con checklist de pruebas.

---

## Módulos Implementados

### ✅ Autenticación y Usuarios
- Login/Registro por subdomain
- Roles: Owner, Director, Admin, Teacher, Auxiliar, Student, Parent
- Permisos basados en `is_owner`, `is_super_admin`, `role`
- Verificación de email (mockup)
- Gestión de usuarios (CRUD completo)
- Foto de perfil con Cloudinary

### ✅ Configuración Académica (Ajustes Académicos)
- Niveles educativos (Inicial, Primaria, Secundaria)
- Grados por nivel
- Secciones
- Años académicos y periodos

### ✅ Asignaturas (Catálogo Académico)
- CRUD de asignaturas por nivel/grado
- Campos: nombre, código, descripción, horas semanales, color
- **IMPORTANTE**: NO almacena relación con profesores
- Muestra "Sin asignar" → redirige a Asignación Docente

### ✅ Asignación Docente (NUEVO - 2025-02-11)
**Tabla pivote `academic_assignments`**
- Estructura: `teacher_id`, `level_id`, `grade_id`, `section_id`, `subject_id`, `school_year`, `role`, `status`
- Un profesor puede dictar múltiples asignaturas en diferentes contextos
- Validación de duplicados exactos
- Panel de "Carga Docente" con contador de asignaciones por profesor
- Filtros avanzados por nivel, grado, sección, asignatura, profesor, año

### ✅ Dashboard Principal
- Carousel de banners administrable
- Noticias con modal de detalle
- Estadísticas dinámicas (cursos, estudiantes)
- Perfil del usuario con badge de rol

### ✅ Horarios
- Vista por profesor
- Vista por sección
- Gestión de bloques horarios

### ✅ Comunicación
- Mensajería interna
- Noticias y comunicados
- Encuestas

### ✅ Contabilidad
- Conceptos de pago
- Registro de pagos
- Integración futura con SUNAT

### ✅ Portal de Estudiantes (NUEVO - 2025-02-13, ACTUALIZADO - 2025-02-14)
- Dashboard con resumen de clases, tareas y anuncios
- Vista de cursos asignados y materiales
- Vista de tareas pendientes y entregas
- Visualización de notas
- Registro de asistencia personal
- Mensajería con profesores/coordinadores
- Perfil personal
- Seguridad: Solo puede ver datos de su `school_id` y `section_id`
- **NUEVO Header Unificado (StudentHeader.jsx)**: 
  - Idéntico al header del Portal del Propietario
  - Incluye: logo, mensaje de bienvenida, fecha, búsqueda, notificaciones
  - Menú dropdown del perfil con "Mi Perfil" y "Cerrar sesión"
  - Aplicado a todas las páginas del Portal del Alumno
- **CORREGIDO - Branding Dinámico (2025-02-14)**:
  - Todas las páginas del Portal del Alumno ahora cargan los settings del colegio
  - Logo, nombre del sistema y branding se obtienen dinámicamente vía `/api/settings`
  - Patrón unificado igual que en los demás portales (Owner, Teacher, Admin)
- **NUEVO - Página de Detalle del Curso del Estudiante (StudentCourseDetailPage.jsx) - COMPLETADO**:
  - Layout de 3 columnas idéntico al portal del propietario pero en modo solo lectura
  - **Columna Izquierda**: Imagen del curso con título, "Actividad del curso" con estadísticas
  - **Columna Central**: Feed de publicaciones con:
    - Foto y nombre del autor
    - Tiempo relativo ("Hace X horas")
    - Badges por tipo (Tarea, Material, Foro, Anuncio)
    - Contenido HTML renderizado correctamente
    - Archivos adjuntos descargables
    - Botones de like (corazón) y comentario
  - **Columna Derecha**: Tarjeta del profesor (naranja), Estudiantes del curso (verde), Recordatorios (morado)
  - Pestañas: Tablero, Tareas, Material, Exámenes, Foro
  - Todos los datos dinámicos vinculados al curso específico
  - Modo solo lectura para estudiantes
  - **Backend**: Nuevo endpoint `/api/student/classmates` para obtener compañeros de sección

### ✅ Portal de Profesores (NUEVO - 2025-02-13)
**Layout y Sidebar (TeacherSidebar.jsx)**
- Dashboard: `/teacher` - Resumen de cursos, tareas por revisar, asistencia pendiente
- Mis Cursos: `/teacher/courses` - Cursos asignados con acceso a materiales/tareas
- Mis Alumnos: `/teacher/students` - Lista de estudiantes por sección (solo lectura)
- Tareas: `/teacher/tasks` - Crear, revisar y calificar asignaciones
- Notas: `/teacher/grades` - Registrar/editar calificaciones por curso
- Asistencia: `/teacher/attendance` - Pasar lista diaria por sección
- Mensajes: `/teacher/messages` - Comunicación con alumnos/coordinadores
- Mi Perfil: `/teacher/profile` - Datos personales y cambio de contraseña

**Seguridad Multi-tenant**
- Backend valida `user.role === 'teacher'` y `school_id`
- Datos filtrados por `assigned_courses` y `assigned_sections`
- Profesores NO pueden ver cursos que no dictan ni secciones no asignadas
- Profesores redirigidos automáticamente si intentan acceder a rutas de admin/student

**Credenciales de prueba**
- Email: `profesor.demo@test.pe`
- Password: `test123`
- Subdominio: `demosettings`

### ✅ Portal de Administradores - FASE 1 (NUEVO - 2025-02-13)
**Layout y Sidebar (AdminSidebar.jsx)**
- Dashboard: `/admin` - Bienvenida, estadísticas generales, acciones rápidas, actividad reciente
- Usuarios: `/admin/users` - Lista completa de usuarios con filtros por rol/estado, cambio de rol
- Estudiantes: `/admin/students` - CRUD de alumnos con info académica (nivel, grado, sección, turno)
- Profesores: `/admin/teachers` - CRUD de docentes con info profesional y enlace a asignación docente

**Estructura del Sidebar Admin**
- OPERACIÓN: Dashboard, Usuarios, Alumnos, Profesores, Padres
- ESTRUCTURA ACADÉMICA: Años Académicos, Niveles, Grados, Secciones, Turnos, Cursos, Horarios
- GESTIÓN ACADÉMICA: Tareas, Notas, Asistencia, Exámenes
- COMUNICACIÓN: Centro de Mensajes, Comunicados
- CONFIGURACIÓN: Sistema, Branding, Roles y Permisos

**Seguridad Multi-tenant**
- Backend valida `user.role in ['admin', 'owner', 'director']` y `school_id`
- Admins pueden gestionar TODOS los usuarios de su escuela
- Admins NO pueden ver ni modificar datos de otras escuelas
- Admins redirigidos automáticamente si intentan acceder a rutas de student/teacher

**Credenciales de prueba**
- Email: `admin.settings@test.pe` (rol: director/owner - accede a dashboard original)
- Password: `test123`
- Subdominio: `demosettings`

### ✅ Portal de Administradores - FASE 2 (NUEVO - 2025-02-13)
**Estructura Académica (AdminAcademicStructurePage.jsx)**
- Ruta: `/admin/academic-structure`
- Tab Años Académicos: CRUD de años con estados (activo, cerrado, futuro)
- Tab Niveles: CRUD de niveles educativos con toggle activo/inactivo
- Tab Grados: CRUD de grados por nivel con toggle activo/inactivo
- Tab Secciones: CRUD de secciones por grado con capacidad
- Tab Turnos: CRUD de turnos con horarios de inicio/fin

**✅ Funcionalidad de Clonar Períodos (NUEVO - 2025-02-13)**
- Modal de períodos: Ver/gestionar períodos de cada año académico
- CRUD completo de períodos: nombre, fechas, orden, estado activo
- Clonar períodos al crear año: Opción de copiar estructura de otro año
- Clonar períodos entre años: Endpoint `/api/academic/periods/clone`
- Ajuste automático de fechas: Las fechas se ajustan al nuevo año
- Validaciones: Origen debe tener períodos, destino debe estar vacío

**Seguridad CRÍTICA**
- El Admin Portal es EXCLUSIVO para usuarios con `role='admin'`
- Usuarios con `role='owner'` o `role='director'` ven el dashboard original
- Función `isAdminOnly(user)` en `App.js` controla el acceso
- Backend usa `is_admin_user()` que permite owner/admin/director para operaciones CRUD

**Credenciales de prueba Admin Portal**
- Email: `admin@test.pe` (rol: admin - accede al Admin Portal)
- Password: `test123`
- Subdominio: `demosettings`

### ✅ Portal de Administradores - FASE 3 (NUEVO - 2025-02-13)
**Gestión Académica - 4 módulos implementados:**

1. **Gestión de Notas** (`/admin/grades-management`)
   - Vista resumen por sección con promedios
   - Vista detalle con filtros (Nivel, Grado, Sección, Asignatura)
   - Edición administrativa con motivo obligatorio (audit trail)
   - API: `/api/admin/grades`, `/api/admin/grades/summary`

2. **Gestión de Asistencia** (`/admin/attendance`)
   - Resumen por sección: presentes, ausentes, tardanzas, justificados
   - Vista de registros individuales con filtros
   - Corrección administrativa con motivo (audit trail)
   - Filtro por rango de fechas
   - API: `/api/admin/attendance`, `/api/admin/attendance/summary`

3. **Gestión de Tareas** (`/admin/tasks`)
   - Cards resumen: Total, Activas, Vencidas, Cerradas, Entregas, Sin calificar
   - Control de estado: cerrar/reabrir tareas
   - Filtros: Asignatura, Profesor, Estado
   - API: `/api/admin/tasks`, `/api/admin/tasks/summary`, `/api/admin/tasks/{id}/status`

4. **Gestión de Exámenes** (`/admin/exams`)
   - Cards resumen: Total, Borradores, Publicados, Programados, Cerrados, Archivados
   - Edición de estado y fecha programada
   - Filtros: Asignatura, Estado
   - API: `/api/admin/exams`, `/api/admin/exams/summary`, `/api/admin/exams/{id}`

### ✅ Portal de Administradores - FASE 4 (NUEVO - 2025-02-13)
**Comunicación y Configuración - 5 módulos implementados:**

1. **Configuración del Sistema** (`/admin/settings`)
   - Información del colegio: nombre, título, subdominio
   - Información de contacto: email, WhatsApp, web
   - Configuración regional: moneda (PEN/USD/EUR)
   - Configuración académica: escala notas (0-20), nota aprobatoria, % asistencia

2. **Branding del Colegio** (`/admin/branding`)
   - Subir/cambiar logo (Cloudinary, máx 5MB)
   - Colores institucionales: primario, secundario, acento
   - Vista previa en tiempo real
   - Paleta de 8 colores predefinidos

3. **Comunicados** (`/admin/announcements`)
   - CRUD completo de comunicados oficiales
   - Audiencias: todos, profesores, estudiantes, padres
   - Estados: borrador, publicado, programado, archivado
   - **Adjuntos**: PDF e imágenes, máx 10MB, hasta 3 archivos
   - Filtros por estado y audiencia

4. **Centro de Mensajes** (`/admin/messages`)
   - Dashboard estadísticas: total, activas, resueltas, hoy
   - Lista de conversaciones con filtros
   - Búsqueda por asunto/participante
   - Badges de tipo y estado

5. **Roles y Permisos** (`/admin/roles`) - Versión Básica
   - 6 roles del sistema: Owner, Admin, Director, Coordinador, Profesor, Estudiante
   - Vista de permisos por rol
   - Conteo de usuarios por rol
   - Referencia de 13 módulos de permisos

---

## Decisiones Arquitectónicas Clave

### Asignación Profesor-Asignatura
**Decisión**: La relación profesor↔asignatura se gestiona EXCLUSIVAMENTE desde el módulo "Asignación Docente" mediante la tabla pivote `academic_assignments`.

**Razón**:
- Soporta profesores multi-nivel y multi-grado
- Base para horarios, asistencia, carga horaria
- Evita duplicación de relaciones
- Arquitectura profesional y escalable

**Consecuencias**:
- El formulario de asignaturas NO tiene campo "Profesor"
- En la tarjeta de asignatura se muestra "Sin asignar"
- La gestión real se hace desde "Asignación Docente"

---

## Endpoints Principales

### Asignación Docente
- `GET /api/academic/assignments` - Lista con filtros
- `POST /api/academic/assignments` - Crear asignación
- `PUT /api/academic/assignments/{id}` - Editar
- `DELETE /api/academic/assignments/{id}` - Eliminar
- `GET /api/academic/assignments/by-teacher/{id}` - Por profesor
- `GET /api/academic/assignments/teachers-summary` - Resumen carga

### Usuarios
- `GET /api/users/teachers/active` - Profesores activos

### Portal de Profesores (NUEVO - 2025-02-13)
- `GET /api/teacher/profile` - Perfil del profesor con assigned_courses, assigned_sections
- `GET /api/teacher/dashboard` - Dashboard con estadísticas y alertas
- `GET /api/teacher/courses` - Cursos asignados con info de sección
- `GET /api/teacher/students` - Estudiantes de secciones asignadas
- `GET /api/teacher/students/{id}` - Detalle académico de un estudiante
- `GET /api/teacher/tasks` - Tareas de cursos asignados
- `GET /api/teacher/grades?subject_id&section_id` - Notas por curso/sección
- `POST /api/teacher/grades` - Guardar/editar notas
- `GET /api/teacher/attendance?section_id&date` - Asistencia por sección/fecha
- `POST /api/teacher/attendance` - Guardar asistencia

### Portal de Administradores (NUEVO - 2025-02-13)
- `GET /api/users` - Lista todos los usuarios del school_id
- `POST /api/users` - Crear nuevo usuario (estudiante, profesor, padre, etc.)
- `PUT /api/users/{id}` - Editar usuario (incluye cambio de rol)
- `DELETE /api/users/{id}` - Eliminar usuario
- `GET /api/users/check-username/{username}` - Verificar disponibilidad de username
- `GET /api/academic/levels` - Niveles activos
- `GET /api/academic/grades` - Grados activos
- `GET /api/academic/sections` - Secciones activas
- `GET /api/academic/shifts` - Turnos activos
- `GET /api/academic/assignments` - Asignaciones docentes

---

## Colecciones MongoDB

### academic_years (NUEVA - 2025-02-11)
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "year": 2026,
  "status": "activo|futuro|cerrado",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

### academic_periods (MODIFICADA - 2025-02-11)
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "academic_year_id": "uuid",   // FK a academic_years
  "nombre": "Bimestre I",       // Sin año (ej: NO "Bimestre I - 2026")
  "fecha_inicio": "2026-03-01",
  "fecha_fin": "2026-05-15",
  "orden": 1,
  "activo": true,
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

### academic_assignments
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "teacher_id": "uuid",
  "level_id": "uuid",
  "grade_id": "uuid",
  "section_id": "uuid",
  "subject_id": "uuid",
  "period_id": "uuid",          // NUEVO - FK a academic_periods
  "period_name": "Bimestre I",  // NUEVO - nombre del período
  "school_year": 2026,          // Mantenido para retrocompatibilidad
  "role": "titular|auxiliar",
  "status": "activo|inactivo",
  "created_at": "ISO datetime",
  "created_by": "uuid"
}
```

### section_types (NUEVA - 2025-02-11)
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "key": "A",           // valor normalizado (UNICA, A, B, etc.)
  "label": "A",         // valor visible (ÚNICA, A, B, etc.)
  "orden": 1,           // orden de aparición en dropdowns
  "activo": true,
  "created_at": "ISO datetime"
}
```

### course_reminders (ACTUALIZADA - 2025-02-12)
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "subject_id": "uuid",
  "academic_year_id": "uuid",
  "title": "Entrega de proyecto final",
  "description": "Descripción detallada...",
  "date": "2025-02-15",
  "reminder_type": "task|exam|notice",
  "is_important": false,           // NUEVO - Destacar en notificaciones
  "notify_all": false,             // NUEVO - Mostrar popup a alumnos
  "viewed_by": ["user_id"],        // NUEVO - Tracking de visualización
  "status": "active|completed|cancelled",
  "created_by": "uuid",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

### course_posts (ACTUALIZADA - 2025-02-12)
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "subject_id": "uuid",
  "academic_year_id": "uuid",
  "author_id": "uuid",
  "title": "Título de la publicación",     // Obligatorio para task/material/forum
  "content": "Texto de la publicación",
  "post_type": "announcement|task|material|forum",  // NUEVO - tipo de publicación
  "image_url": "url",                       // Opcional
  "file_url": "url",                        // Opcional
  "file_name": "nombre.pdf",
  "file_type": "application/pdf",
  "status": "active|deleted",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

### sections (MODIFICADA)
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "section_type_id": "uuid",  // NUEVO - referencia a section_types
  "nombre": "A",              // derivado del section_type.label
  "grado_id": "uuid",
  "capacidad_maxima": 30,
  "activo": true,
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

---

## Backlog / Próximas Tareas

### ✅ P0 - Completados
- [x] ✅ Catálogo de Tipos de Sección (section_types) - COMPLETADO 2025-02-11
- [x] ✅ Sistema de Alertas Educativas Premium (Recordatorios) - COMPLETADO 2025-02-12
- [x] ✅ Centro de Mensajes - Fase 1 (Mensajes Institucionales) - COMPLETADO 2025-02-13
- [x] ✅ Portal de Estudiantes (Student Portal) - COMPLETADO 2025-02-13
- [x] ✅ Portal de Profesores (Teacher Portal) - COMPLETADO 2025-02-13
- [x] ✅ **Integración Google Drive - Fase 1 (Configuración OAuth)** - COMPLETADO 2025-02-15

### 🔴 P0 - En Progreso
- [ ] **Integración Google Drive - Fase 2 (Subida de Materiales)**
- [ ] **Integración Google Drive - Fase 3 (Descarga Segura)**

### P0 - Prioridad Alta (Pendiente)
- [ ] 🔴 **CRÍTICO**: Refactorizar `CourseDetailPage.jsx` (>7000 líneas) - Extraer componentes

### P0.5 - Próximos Inmediatos
- [ ] Centro de Mensajes - Fase 2 (Sistema de Soporte/Tickets)
- [ ] Centro de Mensajes - Fase 3 (Mensajes Académicos Profesor↔Estudiante/Padre)

### P1 - Prioridad Media
- [ ] Refactorizar `UsersPage.jsx` (>2000 líneas)
- [ ] Refactorizar `CarouselManager.jsx` (~760 líneas)
- [ ] Sección "Asignaciones Académicas" en detalle de usuario/profesor
- [ ] Completar reemplazo de `window.confirm` por ConfirmModal (en progreso)
- [ ] Vista de estudiante para exámenes (Fase 4)

### P2 - Módulos Futuros
- [ ] Matrículas
- [ ] Calificaciones y notas
- [ ] Reportes académicos
- [ ] Asistencia docente
- [ ] Asistencia de alumnos
- [ ] Módulo de Horarios mejorado
- [ ] Integración SUNAT
- [ ] Email verification real
- [ ] Social login

---

## Credenciales de Prueba
- **Email**: admin.settings@test.pe
- **Username**: admin_demo
- **Password**: test123
- **Subdomain**: demosettings

---

## Archivos Clave

### Backend
- `/app/backend/server.py` - API principal (~7300 líneas)

### Frontend - Páginas
- `/app/frontend/src/pages/TeacherAssignmentsPage.jsx` - Asignación Docente
- `/app/frontend/src/pages/SubjectsPage.jsx` - Asignaturas
- `/app/frontend/src/pages/UsersPage.jsx` - Gestión usuarios
- `/app/frontend/src/pages/AcademicSettingsPage.jsx` - Config académica
- `/app/frontend/src/pages/AcademicYearsPage.jsx` - Años Académicos (NUEVO)
- `/app/frontend/src/pages/DashboardPage.jsx` - Dashboard
- `/app/frontend/src/pages/CourseDetailPage.jsx` - Detalle de curso

### Frontend - Componentes
- `/app/frontend/src/components/Sidebar.jsx` - Navegación
- `/app/frontend/src/components/HeroCarousel.jsx` - Carousel dashboard
- `/app/frontend/src/components/CarouselManager.jsx` - Admin carousel

---

## Última Actualización
**Fecha**: 2025-02-14
**Cambios recientes**:

### Sesión actual (2025-02-14) - Editor Rich Text para entrega de tareas

1. ✅ **Editor de texto enriquecido Tiptap** - COMPLETADO
   - **Componente `RichTextEditor`** con barra de herramientas completa:
     - H1, H2, H3 (encabezados)
     - Negrita, Cursiva, Subrayado, Tachado
     - Resaltador de texto
     - Listas (viñetas y numeradas)
     - Alineación (izquierda, centro, derecha, justificado)
     - Cita en bloque y código
     - Enlaces
   
   - **Integración con TaskSubmissionForm**:
     - Reemplaza textarea simple con editor WYSIWYG
     - Guarda contenido como HTML
     - Validación mejorada para contenido HTML
   
   - **Extensiones Tiptap utilizadas**:
     - StarterKit, Underline, Link, TextAlign, Highlight, Placeholder

### Sesión anterior (2025-02-14) - Vista de detalle de tarea y formulario de entrega

1. ✅ **Botón de ojo para ver tarea + Vista de detalle** - COMPLETADO
   - **Problema**: No había forma de acceder al detalle de la tarea ni entregarla
   
   - **Nuevo componente `TaskSubmissionForm`**:
     - Editor de texto para entregas tipo "Texto en línea"
     - Zona de carga de archivos para entregas tipo "Archivos" 
     - Ambos campos para entregas tipo "Texto y archivos" (mixto)
     - Validaciones según tipo de entrega
     - Muestra progreso de carga y mensajes de error
   
   - **Vista de detalle de tarea**:
     - Header con gradiente violeta y estado "Publicado"
     - Contenido de la tarea renderizado con HTML
     - Sección de archivos adjuntos descargables
     - Sidebar con información del curso y estadísticas
     - Botón "Volver a tareas" para regresar a la lista
   
   - **Backend: Nuevo endpoint POST `/api/course/tasks/{task_id}/submit`**:
     - Recibe texto y/o archivo via FormData
     - Sube archivos a Cloudinary
     - Guarda entrega en array `submissions` de la tarea
     - Valida que el estudiante no haya entregado previamente
   
   - **Archivos modificados**:
     - `/app/backend/server.py` - Nuevo endpoint, imports Form/UploadFile/File
     - `/app/frontend/src/pages/StudentCourseDetailPage.jsx` - TaskSubmissionForm, vista detalle

### Sesión anterior (2025-02-14) - Fix Tareas: Fecha de entrega y metadata

1. ✅ **Corrección de visualización de tareas en Portal del Estudiante** - COMPLETADO
   - **Problema**: Las tareas mostraban "Invalid Date" y estado incorrecto
   - **Causa raíz**: El campo `due_date` se guardaba en `metadata.due_date` pero el frontend solo buscaba `task.due_date`
   
   - **Cambios en Backend** (`/app/backend/server.py`):
     - Modelo `CoursePostCreate` ahora acepta campo `metadata` (dict opcional)
     - Al crear tareas, se extrae `due_date` y `points` del metadata al nivel raíz para consultas
     - Nueva estructura: `post["due_date"]` + `post["max_grade"]` + `post["metadata"]`
   
   - **Cambios en Frontend**:
     - `StudentCourseDetailPage.jsx`: Helper `getTaskDueDate()` busca en ambos lugares
     - `StudentTasksPage.jsx`: Misma corrección para listado de tareas
     - `StudentDashboardPage.jsx`: Corrección en "Próximas tareas"
     - Manejo de fechas inválidas: Muestra "Sin fecha" en lugar de "Invalid Date"
     - Tipo de entrega: Muestra "Texto en línea", "Archivos", etc. desde metadata
   
   - **Archivos modificados**:
     - `/app/backend/server.py` - Líneas 10146-10155, 10261-10290
     - `/app/frontend/src/pages/StudentCourseDetailPage.jsx`
     - `/app/frontend/src/pages/StudentTasksPage.jsx`
     - `/app/frontend/src/pages/StudentDashboardPage.jsx`

### Sesión anterior (2025-02-14) - Layout de 3 columnas en Detalle de Curso del Estudiante:

1. ✅ **Layout de 3 columnas en StudentCourseDetailPage.jsx** - COMPLETADO
   - **Objetivo**: Pestaña "Tablero" con diseño idéntico al portal del propietario pero en modo solo lectura
   
   - **Columna Izquierda (lg:col-span-3)**:
     - Tarjeta de imagen del curso con título y descripción
     - "Actividad del curso" con estadísticas (Tareas, Materiales, Publicaciones)
     - Diseño con gradiente verde/esmeralda
   
   - **Columna Central (lg:col-span-6)**:
     - Sección "Publicaciones del curso" (sin botón de crear - solo lectura)
     - Feed de actividad reciente combinando posts, tareas y materiales
     - Estado vacío elegante cuando no hay publicaciones
   
   - **Columna Derecha (lg:col-span-3)**:
     - "Profesor del curso" con gradiente naranja/ámbar y foto
     - "Estudiantes" con gradiente verde/turquesa y contador
     - "Recordatorios" con gradiente violeta/índigo
     - "Próximas Entregas" (condicional) con gradiente ámbar
   
   - **Datos Dinámicos**:
     - Estudiantes cargados desde `/api/sections/{section_id}/students`
     - Recordatorios cargados desde `/api/courses/{courseId}/reminders`
     - Posts filtrados por tipo desde `/api/courses/{courseId}/posts`
   
   - **Archivos modificados**:
     - `/app/frontend/src/pages/StudentCourseDetailPage.jsx` - Layout completo

### Sesión anterior (2025-02-13) - Centro de Mensajes Fase 1:

1. ✅ **Centro de Mensajes - Fase 1 (Mensajes Institucionales)** - COMPLETADO
   - **Objetivo**: Módulo de comunicación institucional premium para admins/directores
   
   - **Botón Flotante Global**:
     - Posición fija: esquina inferior derecha (fixed bottom-6 right-6)
     - Badge con contador de mensajes no leídos
     - data-testid="message-center-btn" para testing
     - Visible en DashboardPage y CourseDetailPage
   
   - **Drawer (Panel Lateral)**:
     - Animación slide-in-right desde la derecha
     - Header con gradiente indigo→purple
     - 3 pestañas: Comunicados, Soporte, Mensajes
     - Usa createPortal para z-index correcto
   
   - **Mensajes Institucionales (Fase 1)**:
     - Crear comunicado: título, contenido, prioridad (Normal/Importante/Urgente)
     - Lista de comunicados con preview, fecha, badge de prioridad
     - Indicador de no leído (punto azul)
     - Vista de detalle con autor, foto, fecha completa, contenido
     - Marcar como leído al hacer clic
   
   - **Permisos**:
     - Solo admin/owner/director/coordinator pueden crear comunicados
     - Todos los usuarios pueden ver los comunicados de su colegio
   
   - **Backend Endpoints**:
     - `POST /api/messaging/institutional` - Crear comunicado
     - `GET /api/messaging/institutional` - Listar comunicados
     - `POST /api/messaging/institutional/{id}/read` - Marcar como leído
     - `DELETE /api/messaging/institutional/{id}` - Eliminar (soft delete)
     - `GET /api/messaging/stats` - Contadores de no leídos
   
   - **Bug Fix**: Corregido error de serialización ObjectId en endpoints POST
   
   - **Archivos modificados**:
     - `/app/frontend/src/pages/DashboardPage.jsx` - Import + render MessageCenter
     - `/app/frontend/src/pages/CourseDetailPage.jsx` - Import + render MessageCenter
     - `/app/backend/server.py` - Fix ObjectId serialization
   
   - **Testing**: 100% tests pasados (13/13 backend + UI verification)

### Sesión anterior (2025-02-12) - Sistema de Alertas Educativas:

1. ✅ **Sistema de Alertas Educativas Premium** - COMPLETADO
   - **Objetivo**: "Un alumno no puede decir: no lo vi"
   
   - **Campana de Notificaciones Global** (`NotificationBell.jsx`):
     - Badge con contador de recordatorios pendientes de TODOS los cursos del usuario
     - Dropdown con secciones: Importantes, Próximos a vencer (≤48h), Nuevos
     - Modal de detalle completo para recordatorios largos
     - Auto-actualización cada minuto
   
   - **Popup Inteligente** (`ReminderPopup.jsx`):
     - Aparece automáticamente al cargar el dashboard
     - Reglas: Solo para recordatorios importantes, ≤24h, o vencidos no vistos
     - Control: Máximo 1 popup por recordatorio por día
     - Botones: "Ver recordatorio" | "Recordármelo luego"
     - Usa `createPortal` para z-index correcto
   
   - **Panel de Recordatorios Mejorado** (`CourseRemindersPanel.jsx`):
     - Jerarquía visual: 🔴 Vencidos, 🟠 Próximos (48h), 🔵 Normales
     - Animación sutil para recordatorios urgentes
     - Badge "IMPORTANTE" para recordatorios marcados
     - Textos largos (>120 chars) con botón "Ver completo"
     - Modal de lectura completa (`ReminderDetailModal`)
     - **TODOS los modales usan `createPortal` (z-index fix definitivo)**
   
   - **Control del Profesor** (Checkboxes en modal de crear/editar):
     - ☑️ "Marcar como IMPORTANTE" - Destaca en campana y panel
     - ☑️ "Notificar a todos los alumnos" - Muestra popup al ingresar
   
   - **Backend** (nuevos campos y endpoints):
     - `CourseReminder`: `is_important`, `notify_all`, `viewed_by[]`
     - `GET /api/notifications/reminders` - Para campana global
     - `GET /api/notifications/reminders/popup` - Para popup inteligente
     - `POST /api/course/reminders/{id}/mark-viewed` - Marcar como visto
     - `POST /api/notifications/reminders/{id}/dismiss-popup` - Descartar popup
   
   - **Archivos creados/modificados**:
     - `/app/frontend/src/components/NotificationBell.jsx` - NUEVO
     - `/app/frontend/src/components/ReminderPopup.jsx` - NUEVO
     - `/app/frontend/src/components/CourseRemindersPanel.jsx` - ACTUALIZADO
     - `/app/frontend/src/components/DashboardHeader.jsx` - ACTUALIZADO
     - `/app/frontend/src/pages/DashboardPage.jsx` - ACTUALIZADO
     - `/app/backend/server.py` - ACTUALIZADO (modelo + endpoints)

### Sesión anterior (2025-02-12):
   - **Modelo unificado**: El modelo `CoursePost` ahora tiene un campo `post_type` con valores:
     - `announcement` (por defecto) - Publicaciones generales del tablero
     - `task` - Tareas del curso
     - `material` - Material de estudio
     - `forum` - Discusiones del foro
   - **Título obligatorio**: Las publicaciones de tipo `task`, `material` y `forum` REQUIEREN título
   - **Backend**:
     - `CoursePostCreate` actualizado con `title` y `post_type`
     - GET `/api/course/{subject_id}/posts` soporta filtro `?post_type=task|material|forum`
     - Validación de título para tipos específicos
   - **Frontend**:
     - Nuevo componente `UnifiedContentFeed` reutilizable para las 3 pestañas
     - `CreatePostModal` actualizado con campo de título y estilo según tipo
     - `PostCard` muestra etiqueta de tipo con color distintivo
     - `POST_TYPE_CONFIG` define íconos, colores y placeholders por tipo
   - **Testing**: 20/20 tests pasaron (100% éxito)
   - Archivos modificados:
     - `/app/backend/server.py` - Modelo CoursePost actualizado, filtro por tipo
     - `/app/frontend/src/pages/CourseDetailPage.jsx` - UnifiedContentFeed, CreatePostModal, PostCard

### Sesión anterior (2025-02-12):
1. ✅ **Header estándar en página Años Académicos** - COMPLETADO
   - Agregado `DashboardHeader` completo a `/app/frontend/src/pages/AcademicYearsPage.jsx`
   - Props correctas: `user`, `onMenuClick`, `onLogout`, `logoUrl`, `schoolName`, `subdomain`
   - Layout refactorizado: ahora usa `flex-1 flex flex-col` para header full-width
   - Header sticky en parte superior, ancho completo de pantalla
   - UI consistente con todas las demás páginas de la aplicación

2. ✅ **Reorganización UX: Años y Períodos Académicos** - COMPLETADO
   - **Cambio principal**: Los períodos ahora se gestionan EXCLUSIVAMENTE desde el módulo "Años Académicos"
   - **Vista de detalle de año**: Al hacer clic en un año, se muestra su información y todos sus períodos
   - **CRUD de períodos**: Crear, editar, eliminar y activar períodos desde la vista de detalle del año
   - **Ajustes Académicos**: Eliminada la categoría "Períodos Académicos", reemplazada por tarjeta "Años y Períodos" que redirige al módulo
   - **UX mejorada**: Jerarquía clara Año → Períodos, más intuitivo para usuarios no técnicos
   - Archivos modificados:
     - `/app/frontend/src/pages/AcademicYearsPage.jsx` - Vista de detalle con gestión de períodos
     - `/app/frontend/src/pages/AcademicSettingsPage.jsx` - Eliminada categoría períodos, agregada tarjeta de redirección

3. ✅ **Ajuste de Arquitectura: Asignación Docente ANUAL** - COMPLETADO
   - **Cambio principal**: La asignación docente ahora es ANUAL (vinculada a Año Académico), no por período
   - **Frontend**: Reemplazado selector de "Período Académico" por "Año Académico"
   - **Backend**: Modelo cambiado de `period_id` a `academic_year_id`
   - **Beneficios**:
     - Reduce drásticamente el trabajo operativo (no hay que reasignar por bimestre)
     - Evita errores humanos
     - Alinea el sistema a la realidad de colegios
   - Archivos modificados:
     - `/app/frontend/src/pages/TeacherAssignmentsPage.jsx` - Selector de año en lugar de período
     - `/app/backend/server.py` - Modelos y endpoints actualizados

4. ✅ **Subida de Imagen para Asignaturas con Compresión WebP** - COMPLETADO
   - **Nueva funcionalidad**: Ahora las asignaturas pueden tener una imagen de portada
   - **Compresión automática**: Las imágenes se comprimen y convierten a formato WebP (reducción ~70% del peso)
   - **Límite**: Máximo 10MB antes de compresión, se redimensiona a 800px de ancho máximo
   - **UX**: Zona de arrastre/clic, preview de imagen, botón para eliminar/cambiar
   - **Backend**: Campo `image_url` agregado a modelos `SubjectCreate` y `SubjectUpdate`
   - Archivos modificados:
     - `/app/frontend/src/pages/SubjectsPage.jsx` - Componente de subida con compresión
     - `/app/backend/server.py` - Modelos actualizados, carpeta "edunet/subjects" habilitada en Cloudinary

5. ✅ **Mejora UX Premium: Recorte de Imagen 1:1 para Asignaturas** - COMPLETADO
   - **Reubicación**: Campo de imagen ahora es el PRIMER elemento del formulario
   - **Recorte obligatorio 1:1**: Modal dedicado con herramienta de recorte cuadrado
   - **Controles de zoom**: Botones de acercar/alejar/restablecer (50% - 300%)
   - **Interfaz tipo Canva/Facebook Ads**: Fondo oscuro, controles intuitivos
   - **Experiencia fluida**: 
     - Seleccionar imagen → Modal de recorte → Ajustar área → Aplicar
     - Resultado cuadrado 800x800px en WebP
   - **Consistencia visual garantizada**: Imagen cuadrada en todas las vistas (Cards, Horarios, Dashboard)
   - Librería utilizada: `react-image-crop` (ya instalada)
   - Archivos modificados:
     - `/app/frontend/src/pages/SubjectsPage.jsx` - Modal de recorte premium integrado

6. ✅ **Feed de Comunicación del Curso (Nivel Premium)** - COMPLETADO
   - **Sistema completo de publicaciones** tipo Google Classroom / Teams:
     - Crear publicaciones con texto, imágenes y archivos
     - Imágenes comprimidas automáticamente a WebP (máx. 500px, calidad 80%)
     - Archivos adjuntos con card descargable
   - **Sistema de reacciones (Me gusta ❤️)**:
     - Toggle por usuario (dar/quitar)
     - Contador visible actualizado en tiempo real
     - Un like máximo por usuario por publicación
   - **Sistema de comentarios**:
     - Comentarios cronológicos por publicación
     - Agregar comentarios sin recargar página
     - Contador visible
   - **Menú contextual**: Eliminar (solo autor/admin)
   - **Actualización optimista** sin recargar página
   - **Backend**: Nuevas colecciones `course_posts`, `post_likes`, `post_comments`
   - Archivos modificados:
     - `/app/frontend/src/pages/CourseDetailPage.jsx` - Componentes DashboardContent, PostCard, CreatePostModal
     - `/app/backend/server.py` - Endpoints CRUD para posts, likes y comentarios

### Sesión anterior (2025-02-11):
1. ✅ **Catálogo de Tipos de Sección (section_types)** - COMPLETADO
   - Nueva colección `section_types` con catálogo centralizado (A, B, C, D, E, F, ÚNICA)
   - Endpoint `GET /api/academic/section-types` con auto-seeding de catálogo por defecto
   - Endpoint `POST /api/academic/section-types` para crear nuevos tipos (admin only)
   - Modificado `POST /api/academic/sections` para usar `section_type_id` en lugar de texto libre
   - Validación de duplicados: no permite mismo tipo de sección en mismo grado
   - Compatibilidad hacia atrás: auto-asigna `section_type_id` a secciones existentes
   - Frontend: `SectionModal` ahora usa dropdown del catálogo en lugar de input de texto

2. ✅ **Pantalla de Administración del Catálogo** - COMPLETADO
   - Modal "Administrar Tipos de Sección" accesible desde Ajustes Académicos → Secciones
   - Funcionalidades: ver tipos, agregar nuevos, editar etiqueta, desactivar, reordenar
   - Endpoints: PUT /api/academic/section-types/{id}, PUT /api/academic/section-types/reorder, DELETE (soft-delete)
   - Validación: no permite desactivar tipos en uso por secciones existentes

3. ✅ **Bug Fix: Profesores asignados no visibles en Asignaturas** - COMPLETADO
   - Problema: La página de Asignaturas siempre mostraba "Sin asignar" aunque hubiera asignaciones en academic_assignments
   - Solución: Modificado GET /api/academic/subjects para consultar academic_assignments y devolver primary_teacher
   - Frontend: SubjectsPage.jsx ahora muestra el profesor asignado con avatar y rol (Titular/Auxiliar)

### Sesión anterior:
1. Implementado módulo completo "Asignación Docente"
2. Eliminado campo "Profesor" del formulario de asignaturas
3. Agregado mensaje "Sin asignar → Ir a Asignación Docente"
4. Backend: nueva colección `academic_assignments` con CRUD
5. Frontend: nueva página con filtros y panel de carga docente

---

## Decisiones Arquitectónicas Adicionales

### Catálogo de Tipos de Sección (NUEVO - 2025-02-11)
**Decisión**: El nombre de la sección se selecciona EXCLUSIVAMENTE desde un catálogo centralizado (`section_types`), NO mediante texto libre.

**Razón**:
- Garantiza integridad de datos (evita inconsistencias como mayúsculas, tildes, duplicados lógicos)
- Evita errores humanos
- Facilita filtros y reportes precisos
- Eleva el sistema a nivel intranet premium

**Estructura `section_types`**:
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "key": "A",           // valor normalizado
  "label": "A",         // valor visible
  "orden": 1,           // orden de aparición
  "activo": true,
  "created_at": "ISO datetime"
}
```

**Consecuencias**:
- El formulario "Nueva Sección" usa un `<select>` en lugar de `<input type="text">`
- Las secciones almacenan `section_type_id` (referencia al catálogo)
- El campo `nombre` se deriva automáticamente del `label` del tipo seleccionado

---

## Funcionalidad de Editar Tareas (NUEVO - 2025-02-15)

### Descripción
Implementada la funcionalidad para editar tareas existentes desde el portal del propietario (CourseDetailPage.jsx).

### Componentes Implementados:

1. **Backend - PUT /api/course/posts/{post_id}**
   - Actualizado modelo `CoursePostUpdate` para incluir campo `metadata`
   - El endpoint ahora guarda y devuelve los metadatos de la tarea (due_date, delivery_type, show_to_students, points)
   - Retorna el post actualizado completo

2. **Frontend - EditTaskModal**
   - Ubicación: `/app/frontend/src/pages/CourseDetailPage.jsx` (líneas ~2190-2660)
   - Modal similar a `PremiumTaskModal` pero para edición
   - Campos editables:
     - Título de la tarea
     - Fecha de entrega (date picker)
     - Hora límite (TaskTimePicker)
     - Tipo de entrega (Texto en línea, Archivos, Ambos)
     - Puntos (opcional)
     - Visibilidad (mostrar/ocultar a estudiantes)
     - Archivo adjunto (mantener, reemplazar o eliminar)
   - data-testid: `edit-task-title-input`, `edit-task-date-input`, `submit-edit-task-btn`

3. **Frontend - Botón de Edición**
   - Ícono de lápiz (Edit2) agregado en la columna "Opciones" de la tabla de tareas
   - Ubicado entre el botón de "Ver" (ojo) y "Eliminar" (basura)
   - data-testid: `edit-task-{task.id}`
   - Hover: fondo amarillo, ícono amarillo

4. **Flujo de Actualización**
   - Al guardar cambios, se actualiza inmediatamente el estado local
   - Se hace refetch del servidor para garantizar consistencia de datos
   - El campo `metadata.due_date` siempre se envía al servidor
   - La columna "Permitir entregas hasta" muestra la fecha correctamente

### Archivos Modificados:
- `/app/backend/server.py` - Modelo CoursePostUpdate + endpoint PUT
- `/app/frontend/src/pages/CourseDetailPage.jsx` - EditTaskModal + botón de edición

---

## Sistema Profesional de Eliminación/Archivo de Tareas (2025-02-15)

### Descripción
Implementado un sistema Enterprise-grade para la gestión de eliminación de tareas que protege la integridad de los datos académicos.

### Reglas de Negocio Implementadas

1. **Tareas SIN entregas**: 
   - Pueden ser eliminadas (soft delete)
   - Se preserva el registro con `deleted_at`
   - No se eliminan archivos de Cloudinary

2. **Tareas CON entregas**:
   - NO pueden ser eliminadas
   - Solo pueden ser ARCHIVADAS
   - Se preservan todas las entregas, calificaciones y archivos
   - Las calificaciones siguen contando para promedios

### Nuevos Endpoints Backend

1. **GET `/api/course/tasks/{task_id}/submission-stats`**
   - Retorna conteo de entregas y calificaciones
   - Indica si la tarea puede ser eliminada

2. **POST `/api/course/tasks/{task_id}/archive`**
   - Archiva una tarea (status = "archived")
   - Preserva todos los datos
   - Crea registro de auditoría

3. **POST `/api/course/tasks/{task_id}/restore`**
   - Restaura una tarea archivada
   - Vuelve a estado activo

4. **GET `/api/course/{subject_id}/tasks/archived`**
   - Lista todas las tareas archivadas de una asignatura

### Colección de Auditoría: `task_audit_logs`

Campos:
- `task_id`: ID de la tarea
- `action`: "delete" | "archive" | "restore"
- `performed_by`: ID del usuario
- `performed_by_name`: Nombre completo
- `timestamp`: Fecha/hora ISO
- `school_id`: ID del colegio
- `details`: Objeto con información adicional

### Cambios en Frontend (CourseDetailPage.jsx)

1. **Modal Dinámico de Eliminación**:
   - Si NO tiene entregas: Muestra opción de eliminar
   - Si SÍ tiene entregas: Muestra estadísticas y opción de archivar

2. **Botón "Archivadas"**:
   - Agregado en el header de la sección de tareas
   - Abre modal con lista de tareas archivadas
   - Permite restaurar tareas

3. **Nuevos Estados**:
   - `submissionStats`: Estadísticas de entregas
   - `showArchivedTasks`: Modal de archivadas
   - `archivedTasks`: Lista de tareas archivadas

### Filtrado de Tareas

El endpoint GET de posts ahora filtra:
- `status: "active"`
- `deleted_at: { $exists: false }`

### Archivos Modificados
- `/app/backend/server.py` - Nuevos endpoints y lógica de eliminación
- `/app/frontend/src/pages/CourseDetailPage.jsx` - UI de eliminación/archivo


---

## Integración Google Drive (NUEVO - 2025-02-15)

### Descripción General
Implementación de Google Drive como sistema de almacenamiento obligatorio para materiales de estudio (PDF, DOC, XLS, PPT, ZIP). Las imágenes siguen usando Cloudinary.

### Arquitectura Multi-Tenant
- Cada colegio conecta SU propio Google Drive
- Tokens de refresh encriptados con Fernet (basado en JWT_SECRET)
- Solo el rol "propietario" puede conectar/desconectar

### Fase 1 - Configuración OAuth (COMPLETADO)

**Backend Endpoints:**
- `GET /api/integrations/google-drive/status` - Estado de conexión
- `GET /api/integrations/google-drive/auth?school_id=xxx` - Inicia flujo OAuth
- `GET /api/integrations/google-drive/callback` - Callback de Google OAuth
- `POST /api/integrations/google-drive/disconnect` - Desconectar Drive

**Frontend:**
- Nueva sección en `/settings` → "Integración Google Drive"
- Solo visible para usuarios con rol owner/director
- Estados: No conectado (rojo), Conectado (verde)
- Botones: Conectar, Reconectar, Desconectar

**Flujo OAuth:**
1. Propietario hace clic en "Conectar con Google Drive"
2. Redirige a Google OAuth con scope `drive.file`
3. Usuario autoriza
4. Backend recibe tokens y crea carpetas `EduNet/Materiales`
5. Guarda refresh_token encriptado + folder_ids en DB
6. Redirige a settings con mensaje de éxito

**Variables de Entorno Requeridas:**
```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
BASE_URL=https://edunet.pe
```

**Redirect URIs (registrar en Google Cloud Console):**
- `https://edunet-fix.preview.emergentagent.com/api/integrations/google-drive/callback`
- `https://edunet.pe/api/integrations/google-drive/callback`

### Fase 2 - Subida de Materiales (PENDIENTE)

**Endpoint:**
- `POST /api/materials/upload` - Sube archivo a Drive

**Lógica:**
1. Validar que Drive está conectado
2. Validar extensión de archivo (pdf, doc, docx, xls, xlsx, ppt, pptx, zip, txt)
3. Subir a carpeta `EduNet/Materiales` del colegio
4. Guardar metadata en MongoDB (drive_file_id, mime_type, etc.)

### Fase 3 - Descarga Segura (PENDIENTE)

**Endpoint:**
- `GET /api/materials/download/{material_id}` - Descarga vía streaming

**Lógica:**
1. Validar que usuario pertenece al school_id
2. Si es estudiante, validar acceso al curso
3. Descargar archivo de Drive usando refresh_token
4. Hacer streaming al cliente (estudiante nunca ve URL de Drive)

### Campos Nuevos en Colección `schools`
```json
{
  "google_drive_connected": boolean,
  "google_drive_email": string,
  "google_drive_refresh_token": string (encriptado),
  "google_drive_folder_id": string,
  "google_drive_materials_folder_id": string,
  "google_drive_connected_at": datetime,
  "google_drive_connected_by": string (user_id)
}
```

### Campos Nuevos en `course_posts` (para materiales)
```json
{
  "storage_type": "google_drive",
  "drive_file_id": string,
  "drive_file_name": string,
  "mime_type": string,
  "file_extension": string,
  "file_size": number
}
```

### Archivos Modificados
- `/app/backend/server.py` - Nuevos endpoints y funciones de Google Drive
- `/app/backend/.env` - Variables GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL
- `/app/frontend/src/pages/SettingsPage.jsx` - Sección de integración Google Drive

---

## Bug Fixes y Actualizaciones (2025-02-XX)

### ✅ Fix: Archivos de Tareas aparecían en "Material de estudio" (RESUELTO)

**Problema:**
Cuando se creaba una Tarea, Foro o post en Tablero con archivo adjunto, el archivo aparecía erróneamente en la sección "Material de estudio" además del post correspondiente.

**Causa raíz:**
El frontend usaba el endpoint `/api/materials/upload` para todos los uploads a Google Drive. Este endpoint crea automáticamente un registro en `course_posts` con `post_type: "material"`, lo cual es correcto para materiales pero incorrecto para otros tipos de posts.

**Solución implementada:**
1. **Nuevo endpoint backend:** `POST /api/files/upload-to-drive`
   - Solo sube el archivo a Google Drive
   - NO crea ningún registro en la base de datos
   - Retorna: `drive_file_id`, `drive_file_name`, `mime_type`, `file_size`, `file_extension`

2. **Frontend actualizado:**
   - Modales de Tarea, Foro y Tablero ahora usan `/api/files/upload-to-drive`
   - Modal de Materiales sigue usando `/api/materials/upload` (comportamiento correcto)

**Archivos modificados:**
- `/app/backend/server.py` - Nuevo endpoint líneas 13877-13961
- `/app/frontend/src/pages/CourseDetailPage.jsx` - Funciones `uploadToGoogleDrive` actualizadas

**Estado:** COMPLETADO - Pendiente de verificación en producción por el usuario


---

## Bug Fix: Entregas de Tareas de Estudiantes (2025-02-18)

### Problema Reportado
Las entregas de tareas de los estudiantes NO aparecían en el portal del profesor. El panel mostraba "Entregada: 0" y la lista de entregas estaba vacía, aunque el estudiante recibió confirmación de éxito al entregar.

### Causa Raíz Identificada
1. **Inconsistencia en campo de tipo**: Las tareas se creaban con `post_type: "task"` pero algunas queries buscaban con `type: "task"` (sistema antiguo).
2. **Frontend usaba datos mock**: La función `loadSubmissions` usaba datos ficticios en vez de llamar al API.

### Correcciones Realizadas

#### Backend (`/app/backend/server.py`)

1. **Corregidas queries de búsqueda de tareas** - Ahora usan `$or` para soportar ambos campos:
   - `submit_task` (línea ~2714)
   - `download_submission_file` (línea ~2892)
   - `get_task_submission_stats` (línea ~10947)
   - `archive_task` (línea ~11156)

2. **Nuevo endpoint `GET /api/course/tasks/{task_id}/submissions`**:
   - Obtiene todas las entregas de una tarea con detalles del estudiante
   - Incluye: id, nombre, foto, comentario, archivo, estado (a tiempo/tarde), nota, feedback

3. **Nuevo endpoint `PUT /api/course/tasks/{task_id}/submissions/{submission_id}/grade`**:
   - Permite a profesores/admins calificar entregas
   - Acepta: `grade` (número) y `feedback` (texto)

4. **Agregado `submissions_count` al listado de posts**:
   - El endpoint `GET /api/course/{subject_id}/posts?post_type=task` ahora incluye conteo de entregas

#### Frontend (`/app/frontend/src/pages/CourseDetailPage.jsx`)

1. **Reemplazados datos mock con API real**:
   - `loadSubmissions` ahora llama a `/api/course/tasks/{task_id}/submissions`

2. **UI funcional para calificar entregas**:
   - Campos editables para nota y comentario
   - Botón de guardar por entrega individual
   - Botón "Aplicar todas las calificaciones"

3. **Descarga de archivos**:
   - Botón "VER ARCHIVOS" que descarga desde Google Drive o Cloudinary

4. **Conteo real de entregas**:
   - El panel lateral muestra `submissions_count` de la API

### Tests Pasados
- 20/20 tests backend pasaron (100%)
- Verificado: submit, list submissions, grade, download

**Estado:** COMPLETADO Y VERIFICADO



---

## Sistema de Exámenes para Estudiantes (2025-02-18)

### Funcionalidad Implementada

Se implementó el sistema completo de toma de exámenes para estudiantes, incluyendo:

#### Backend (`/app/backend/server.py`)

**Nuevos Endpoints:**
1. `POST /api/exams/{exam_id}/start` - Inicia un intento de examen
2. `GET /api/exams/{exam_id}/questions-for-student` - Obtiene preguntas sin respuestas correctas
3. `POST /api/exam-attempts/{attempt_id}/save-answer` - Guarda respuesta (auto-save)
4. `POST /api/exam-attempts/{attempt_id}/report-tab-change` - Anti-trampa por cambio de pestaña
5. `POST /api/exam-attempts/{attempt_id}/submit` - Envía examen y auto-califica
6. `GET /api/exam-attempts/{attempt_id}/result` - Obtiene resultados detallados
7. `GET /api/exams/{exam_id}/my-attempt` - Verifica si el estudiante tiene un intento

**Colección `exam_attempts`:**
- `id`, `exam_id`, `student_id`, `student_name`, `school_id`
- `start_time`, `end_time`, `status` (in_progress, completed, expired)
- `score`, `max_score`, `percentage`, `passed`
- `answers`, `graded_answers`, `tab_changes`

**Características del Backend:**
- Validación de disponibilidad (fechas inicio/fin)
- Validación de examen no repetido (si ya completó)
- Cálculo automático de tiempo restante al reconectar
- Auto-corrección de respuestas (multiple_choice, true_false, fill_blanks)
- Detección de cambios de pestaña (anti-trampa)
- Auto-expiración cuando se agota el tiempo

#### Frontend

**Nuevas Páginas:**
1. `/app/frontend/src/pages/ExamAttemptPage.jsx` - Página de toma de examen
2. `/app/frontend/src/pages/ExamResultPage.jsx` - Página de resultados

**Características de la UI:**
- Diseño premium tipo LMS
- Contador regresivo en tiempo real (rojo cuando < 5 minutos)
- Navegador de preguntas con indicadores de estado
- Soporte para imágenes en preguntas y opciones
- Auto-guardado de respuestas
- Modal de confirmación antes de enviar
- Advertencia por cambio de pestaña (anti-trampa)
- Vista de resultados con revisión de respuestas

**Rutas agregadas en App.js:**
- `/school/:subdomain/exam/:examId/attempt`
- `/school/:subdomain/exam/:examId/result/:attemptId`

**Componente ExamsContent actualizado:**
- Verificación de estado de intento por API
- Botón "Iniciar Examen" funcional
- Botón "Continuar Examen" para intentos en progreso
- Botón "Ver resultados" para intentos completados

### Estados del Examen

| Estado | Descripción | Acción disponible |
|--------|-------------|-------------------|
| `available` | Dentro del rango de fechas, sin intento | Iniciar Examen |
| `in_progress` | Intento iniciado, tiempo restante | Continuar Examen |
| `completed` | Intento completado | Ver resultados |
| `expired` | Tiempo agotado | Ver resultados |
| `upcoming` | Antes de fecha inicio | No disponible |
| `closed` | Después de fecha fin | Examen cerrado |

### Anti-Trampa

- Detección de cambios de pestaña
- Advertencia en primer y segundo cambio
- Auto-envío al tercer cambio de pestaña
- Auto-envío cuando el contador llega a 0

**Estado:** COMPLETADO - Pendiente de verificación completa en producción
