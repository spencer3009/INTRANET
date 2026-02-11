# EduNet - Intranet SaaS para Colegios en Perú

## Descripción General
EduNet es una plataforma SaaS multi-tenant diseñada para colegios en Perú. Cada institución accede a su intranet a través de una URL única (`edunet.pe/school/{identificador}`). La aplicación está construida con React (frontend) y FastAPI (backend), utilizando MongoDB como base de datos.

## Arquitectura
- **Frontend**: React.js con Tailwind CSS
- **Backend**: FastAPI (Python)
- **Base de datos**: MongoDB
- **Autenticación**: JWT
- **Almacenamiento de archivos**: Cloudinary
- **Arquitectura**: Multi-tenant híbrida (URL path-based)

## Módulos Implementados

### ✅ Core
- [x] Autenticación (registro, login, verificación de email)
- [x] **Login con Username** - Usuarios pueden loguearse con email O nombre de usuario
- [x] Onboarding (creación de identificador)
- [x] Dashboard principal con datos dinámicos
- [x] Gestión de usuarios (profesores, estudiantes, padres)
- [x] Ajustes de la institución (logo, nombre, configuración)
- [x] **Sistema de Demo Data** - Datos de ejemplo automáticos
- [x] **Sistema de Perfil Dinámico** - Fotos de perfil en toda la app (NUEVO - 11 Feb 2026)
- [x] **Super Admin/Owner** - Rol protegido para el primer usuario

### ✅ Académico
- [x] Niveles educativos (Inicial, Primaria, Secundaria)
- [x] Grados
- [x] Secciones
- [x] Turnos
- [x] Períodos académicos
- [x] **Asignaturas** - Módulo completo con UI premium
- [x] **Detalle de Curso** - Página premium tipo SaaS

### ✅ Comunicación
- [x] Mensajería interna
- [x] Noticias/Anuncios
- [x] Calendario de eventos

### ✅ Gestión
- [x] Asistencias
- [x] Encuestas
- [x] Disciplina
- [x] Contabilidad (concepto de pago, pagos, reportes)

## Lo Que Se Implementó (11 Feb 2026)

### Sistema de Perfiles Dinámicos - NUEVO
Se implementó un sistema completo de visualización de perfiles de usuario:

#### Características:
1. **Foto de Perfil Dinámica**:
   - Se muestra en el header (arriba derecha)
   - Se muestra en ProfileCard del dashboard
   - Se muestra en la página de perfil
   - Usa `photo_url` del usuario autenticado
   - Subida a Cloudinary

2. **Avatar por Defecto Elegante**:
   - Cuando el usuario no tiene foto, se muestra un avatar con iniciales
   - Gradiente azul oscuro (#001f4b → #003366)
   - Extrae iniciales del nombre (ej: "Colegio Demo" → "CD")
   - Manejo de errores de carga de imagen

3. **Visualización de Roles con Badges**:
   - OWNER: Badge ámbar con icono de corona
   - SUPER ADMIN: Badge púrpura con icono de escudo
   - DIRECTOR: Badge índigo
   - ADMINISTRADOR: Badge azul
   - PROFESOR: Badge esmeralda
   - ESTUDIANTE: Badge cyan
   - PADRE: Badge naranja

4. **ProfileCard Mejorado**:
   - Muestra foto o avatar con iniciales
   - Badge de rol con colores diferenciados
   - Nombre del usuario
   - Email
   - Username (@usuario)
   - Indicador de "en línea"

#### Archivos Modificados:
- `/app/frontend/src/components/DashboardHeader.jsx` - Avatar dinámico y rol
- `/app/frontend/src/components/ProfileCard.jsx` - Rediseño completo
- `/app/frontend/src/App.js` - Función handleUserUpdate para persistencia

### Terminología Actualizada
- Cambiado "subdominio" → "identificador" en OnboardingPage

## Backlog / Tareas Pendientes

### P0 - Alta Prioridad
- [ ] Implementar funcionalidad "Editar Usuario" (actualmente placeholder)
- [ ] Integrar datos reales en página de detalle del curso (tareas, materiales, exámenes)

### P1 - Media Prioridad
- [ ] Módulo de Inscripciones/Matrículas
- [ ] Módulo de Calificaciones
- [ ] Módulo de Reportes

### P2 - Baja Prioridad
- [ ] Refactorizar componentes grandes (UsersPage, AccountingPage, CourseDetailPage, ProfilePage)
- [ ] Integración con SUNAT para facturación electrónica
- [ ] Notificaciones push
- [ ] Implementar verificación de email real (actualmente código demo)

### P3 - Futuro
- [ ] Social logins (Google, Facebook)
- [ ] Exportación PDF/Excel en todos los módulos
- [ ] App móvil

## Credenciales de Prueba
- **Email**: `admin.settings@test.pe`
- **Username**: `admin_demo`
- **Password**: `test123`
- **Identificador**: `demosettings`
- **URL de Login**: `/school/demosettings/login`

## Integraciones
- **Cloudinary**: Carga de imágenes (logos, fotos de perfil)
- **Recharts**: Gráficos en encuestas y dashboard

## Notas Técnicas
- Los endpoints de backend deben usar el prefijo `/api`
- Las URLs de frontend utilizan rutas en español (asignaturas, horarios, etc.)
- El sidebar se expande al hover en desktop
- Los IDs de MongoDB deben excluirse de las respuestas JSON (`{"_id": 0}`)
- Todos los datos demo están marcados con `is_demo: true` para fácil identificación
- El usuario debe tener los campos: `photo_url`, `is_owner`, `is_super_admin`, `role`
