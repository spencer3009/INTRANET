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
- [x] Onboarding (creación de subdomain/identificador)
- [x] Dashboard principal
- [x] Gestión de usuarios (profesores, estudiantes, padres)
- [x] Ajustes de la institución (logo, nombre, configuración)

### ✅ Académico
- [x] Niveles educativos (Inicial, Primaria, Secundaria)
- [x] Grados
- [x] Secciones
- [x] Turnos
- [x] Períodos académicos
- [x] **Asignaturas** - Módulo completo con UI premium
- [x] **Detalle de Curso** - Página premium tipo SaaS (NUEVO - 11 Feb 2026)

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

### Página de Detalle de Curso/Asignatura - PREMIUM
Se creó una nueva página `CourseDetailPage.jsx` con diseño premium tipo SaaS educativo (Google Classroom/Canvas/Notion):

#### Características:
1. **Hero Header**
   - Gradiente elegante basado en el color de la asignatura
   - Icono del curso + nombre grande
   - Badges de nivel, grado y período académico
   - Código del curso y horas semanales
   - Botones de acciones rápidas (Editar, Estudiantes, Calificaciones)

2. **Tabs Premium**
   - Tablero (feed de publicaciones)
   - Tareas
   - Material de estudio
   - Exámenes
   - Foro
   - En vivo
   - Calificaciones
   - Animaciones suaves al cambiar de tab
   - Indicador activo con gradiente

3. **Layout de 3 Columnas**
   - **Izquierda**: Card del curso, Actividad reciente, Noticias, Accesos rápidos
   - **Centro**: Contenido principal según tab activo
   - **Derecha**: Profesor del curso, Lista de estudiantes (scroll), Recordatorios

4. **Experiencia Premium**
   - Skeleton loaders durante la carga
   - Estados vacíos elegantes con call-to-action
   - Microinteracciones y transiciones suaves
   - Diseño responsivo (desktop/tablet)

#### Archivos Creados/Modificados:
- `/app/frontend/src/pages/CourseDetailPage.jsx` (nuevo)
- `/app/frontend/src/pages/SubjectsPage.jsx` (actualizado para navegación)
- `/app/frontend/src/App.js` (nuevas rutas)
- `/app/frontend/src/App.css` (estilos adicionales)

#### Rutas:
- `/curso/:subjectId` (subdomain mode)
- `/school/:subdomain/curso/:subjectId` (route mode)

## Backlog / Tareas Pendientes

### P0 - Alta Prioridad
- [ ] Integrar datos reales en la página de detalle del curso (tareas, materiales, exámenes)
- [ ] Implementar funcionalidad "Editar Usuario" (actualmente placeholder)

### P1 - Media Prioridad
- [ ] Cambiar terminología "subdomain" → "identificador" en UI
- [ ] Módulo de Inscripciones/Matrículas
- [ ] Módulo de Calificaciones
- [ ] Módulo de Reportes

### P2 - Baja Prioridad
- [ ] Refactorizar componentes grandes (UsersPage, AccountingPage, SubjectsPage)
- [ ] Integración con SUNAT para facturación electrónica
- [ ] Notificaciones push
- [ ] Implementar verificación de email real (actualmente código demo)

### P3 - Futuro
- [ ] Social logins (Google, Facebook)
- [ ] Exportación PDF/Excel en todos los módulos
- [ ] App móvil

## Credenciales de Prueba
- **Email**: `admin.settings@test.pe`
- **Password**: `test123`
- **Identificador**: `demosettings`
- **URL de Login**: `/school/demosettings/login`

## Integraciones
- **Cloudinary**: Carga de imágenes
- **Recharts**: Gráficos en encuestas y dashboard

## Notas Técnicas
- Los endpoints de backend deben usar el prefijo `/api`
- Las URLs de frontend utilizan rutas en español (asignaturas, horarios, etc.)
- El sidebar se expande al hover en desktop
- Los IDs de MongoDB deben excluirse de las respuestas JSON (`{"_id": 0}`)
