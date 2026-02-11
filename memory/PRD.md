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
- [x] **Sistema de Demo Data** - Datos de ejemplo automáticos (NUEVO - 11 Feb 2026)

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

### Sistema de Demo Data Automático - NUEVO
Se implementó un sistema completo de datos de demostración para nuevas intranets:

#### Características:
1. **Seeding Automático**: Al crear una nueva intranet, se genera automáticamente:
   - 3 niveles educativos (Inicial, Primaria, Secundaria)
   - 14 grados
   - 2 secciones (A, B)
   - 2 turnos (Mañana, Tarde)
   - 1 período académico
   - 4 profesores demo
   - 10 estudiantes demo
   - 8 asignaturas
   - 3 noticias
   - 5 eventos de calendario
   - 5 conceptos de pago
   - 13 pagos demo
   - Métricas del dashboard
   - Datos de inscripción para gráficos

2. **Identificación de Demo Data**:
   - Todos los datos demo marcados con `is_demo: true`
   - Fácil eliminación posterior
   - No interfiere con datos reales

3. **Banner de Bienvenida**:
   - Se muestra en el Dashboard cuando hay datos demo
   - Informa al usuario sobre la naturaleza de los datos
   - Muestra contadores de datos demo
   - Botón para eliminar datos demo

4. **Endpoints de Gestión**:
   - `GET /api/demo-data/status` - Estado de datos demo
   - `DELETE /api/demo-data` - Eliminar datos demo
   - `POST /api/demo-data/reseed` - Regenerar datos demo

#### Archivos Creados/Modificados:
- `/app/backend/demo_seeder.py` (nuevo - módulo de seeding)
- `/app/backend/server.py` (integración del seeder)
- `/app/frontend/src/components/DemoBanner.jsx` (nuevo - banner UI)
- `/app/frontend/src/pages/DashboardPage.jsx` (integración del banner)

### Dashboard con Datos Reales (anterior)
- Eventos del calendario mostrados en "Próximos Eventos"
- Noticias reales en sección "Noticias y Avisos"
- Mini calendario con indicadores de eventos

### Página de Detalle de Curso Premium (anterior)
- Hero Header con gradiente dinámico
- 6 Tabs Premium: Tablero, Tareas, Material, Exámenes, Foro, Calificaciones
- Layout de 3 columnas
- Estados vacíos elegantes

## Backlog / Tareas Pendientes

### P0 - Alta Prioridad
- [ ] Integrar datos reales en página de detalle del curso (tareas, materiales, exámenes)
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
- Todos los datos demo están marcados con `is_demo: true` para fácil identificación
