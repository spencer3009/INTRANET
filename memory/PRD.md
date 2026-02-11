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

---

## Colecciones MongoDB

### academic_assignments (NUEVA)
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "teacher_id": "uuid",
  "level_id": "uuid",
  "grade_id": "uuid",
  "section_id": "uuid",
  "subject_id": "uuid",
  "school_year": 2026,
  "role": "titular|auxiliar",
  "status": "activo|inactivo",
  "created_at": "ISO datetime",
  "created_by": "uuid"
}
```

---

## Backlog / Próximas Tareas

### P0 - Prioridad Alta
- [x] ✅ Catálogo de Tipos de Sección (section_types) - COMPLETADO 2025-02-11

### P1 - Prioridad Media
- [ ] Refactorizar `UsersPage.jsx` (>2000 líneas)
- [ ] Refactorizar `CarouselManager.jsx` (~760 líneas)
- [ ] Sección "Asignaciones Académicas" en detalle de usuario/profesor

### P2 - Módulos Futuros
- [ ] Matrículas
- [ ] Calificaciones y notas
- [ ] Reportes académicos
- [ ] Asistencia docente
- [ ] Asistencia de alumnos
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
- `/app/frontend/src/pages/DashboardPage.jsx` - Dashboard

### Frontend - Componentes
- `/app/frontend/src/components/Sidebar.jsx` - Navegación
- `/app/frontend/src/components/HeroCarousel.jsx` - Carousel dashboard
- `/app/frontend/src/components/CarouselManager.jsx` - Admin carousel

---

## Última Actualización
**Fecha**: 2025-02-11
**Cambios recientes**:

### Sesión actual (2025-02-11):
1. ✅ **Catálogo de Tipos de Sección (section_types)** - COMPLETADO
   - Nueva colección `section_types` con catálogo centralizado (A, B, C, D, E, F, ÚNICA)
   - Endpoint `GET /api/academic/section-types` con auto-seeding de catálogo por defecto
   - Endpoint `POST /api/academic/section-types` para crear nuevos tipos (admin only)
   - Modificado `POST /api/academic/sections` para usar `section_type_id` en lugar de texto libre
   - Validación de duplicados: no permite mismo tipo de sección en mismo grado
   - Compatibilidad hacia atrás: auto-asigna `section_type_id` a secciones existentes
   - Frontend: `SectionModal` ahora usa dropdown del catálogo en lugar de input de texto

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
