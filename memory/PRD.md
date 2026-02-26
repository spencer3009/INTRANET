# EduNet - Product Requirements Document

## Overview
EduNet es una aplicación SaaS multi-tenant premium para colegios en Perú. Cada colegio tiene su propia intranet con gestión de estudiantes, docentes, horarios, calificaciones, mensajería interna y más.

## Core Modules
### 1. Gestión de Usuarios
- Roles: Owner, Director, Admin, Coordinador, Auxiliar, Teacher, Student, Parent
- CRUD completo de usuarios por rol
- Perfil con foto (optimizada a WebP 200px)
- QR para estudiantes

### 2. Gestión Académica
- Cursos y secciones
- Calificaciones y promedios
- Tareas y entregas

### 3. Horarios
- Grilla de horario semanal
- Auto-fill de hora de fin

### 4. Exámenes
- Creación y programación
- Tipos de preguntas

### 5. Sistema de Mensajería Interna
- Mensajes entre usuarios del colegio
- **Contactos categorizados por carpetas** para todos los roles (IMPLEMENTADO - 25 Feb 2026):
  - Owner/Admin: Alumnos → Profesores → Padres/Apoderados → Personal Administrativo
  - Teacher: Mis Alumnos → Profesores → Padres/Apoderados → Personal Administrativo
  - Student: Mis Profesores → Compañeros de Clase → Personal Administrativo
  - Parent: Profesores de mis Hijos → Personal Administrativo → Otros Padres
- Filtro `is_demo: true` para excluir usuarios de prueba de contactos y conversaciones

### 6. Portal de Estudiantes
- Dashboard, cursos, tareas, calificaciones, horario, mensajes, perfil

### 7. Portal de Padres (En progreso)
- Dashboard, hijos, calificaciones, asistencia, mensajes
- Pendiente: ParentProfilePage, ParentCourseDetailPage, ParentMessagesPage completo

### 8. Panel Global de Soporte (IMPLEMENTADO - 24 Feb 2026)
#### Usuario Soporte Global
- Email: spencer3009@gmail.com / Password: Socios3009
- Rol: `system_admin_global`
- Se crea automáticamente al iniciar el backend
- No tiene `school_id` (accede a colegios via `user_school_roles`)

#### Endpoints de Soporte (`/api/support/*`)
- `GET /api/support/overview` - Métricas globales
- `GET /api/support/schools` - Colegios asignados
- `POST /api/support/switch-school` - Cambiar contexto (JWT con role=owner)

### 9. Modo Demo (Implementado)
- Usuarios con `is_demo_user: true` (solo creados por Owner)
- Backend middleware bloquea escritura
- Badge "MODO DEMO" en header

### 10. Admin Sistema por Colegio (Implementado)
- Usuarios con `is_system_user: true` por colegio
- Ineditable e ineliminable

### 11. Dashboard Propietario (IMPLEMENTADO - 24-25 Feb 2026)
- KPIs: Alumnos Activos, Docentes Activos, Ingresos del Mes, Mensajes Sin Leer
- Gráfico Ingresos Mensuales (Cobrado/Por Cobrar/Vencido)
- Acceso Ejecutivo (Alumnos, Docentes, Reportes, Colegio)
- Próximos Eventos con popup detalle al hacer clic
- Noticias y Avisos con popup premium
- Mini Calendario con popup de eventos posicionado arriba

### 12. Sistema de Notificaciones Navegables Premium (IMPLEMENTADO - 25 Feb 2026)
- Notificaciones clickeables que navegan al contenido relacionado
- Marcado automático como leída al hacer clic
- Contador de campana se actualiza en tiempo real sin recargar
- Diferenciación visual leída/no leída (fondo coloreado vs blanco, texto bold vs normal)
- Botón "Marcar todo leído"
- Tabs: Actividad (notificaciones generales) y Recordatorios
- Tipos: task, exam, material, forum, announcement, reminder
- Cada notificación tiene `link_destino` auto-generado según tipo
- **WebSocket Push en Tiempo Real (IMPLEMENTADO - 25 Feb 2026):**
  - Conexión WebSocket persistente `/api/ws/notifications?token=JWT`
  - Indicador verde pulsante cuando está conectado en tiempo real
  - Push instantáneo cuando se crea tarea, examen, material, foro, etc.
  - Push instantáneo cuando se recibe un mensaje académico
  - Toast notification (sonner) con título, descripción y botón "Ver"
  - Reconexión automática cada 5 segundos si se pierde la conexión
  - Keepalive ping/pong cada 30 segundos
  - Soporte multi-tab (múltiples conexiones por usuario)
- **Endpoints:**
  - `GET /api/notifications/all` - Lista con is_read y link_destino
  - `GET /api/notifications/unread-count` - Contador para badge
  - `POST /api/notifications/{id}/read` - Marca leída, retorna unread_count
  - `POST /api/notifications/read-all` - Marca todas leídas
  - `POST /api/notifications/test-push` - Endpoint de prueba para push
  - `WS /api/ws/notifications?token=JWT` - WebSocket para push en tiempo real

### 13. Pantalla de Reglas Pre-Examen (IMPLEMENTADO - 26 Feb 2026)
- Pantalla obligatoria antes de comenzar examen en línea
- 5 reglas claras con iconos de colores: no salir del examen, permanecer en pantalla, buena conexión, no recargar, leer bien cada pregunta
- Checkbox de aceptación obligatoria antes de habilitar botón "Comenzar Examen"
- Timer rediseñado: más grande (text-4xl), moderno, con etiqueta "Tiempo restante" y efectos visuales
- **Endpoints:** `GET /api/exams/{exam_id}/info` - Info básica del examen para pantalla de reglas

## Database Collections
- `schools`, `users`, `user_school_roles`, `tenant_settings`, `task_submissions`
- `notifications`: id, school_id, subject_id, title, message, notification_type, reference_id, link_destino, read_by[], created_at
- `academic_threads`: Conversaciones de mensajería
- `payments`: Pagos con payment_status, total_amount
- `calendar_events`: Eventos del calendario
- `attendances`: Registros de asistencia

## Architecture
```
/app
├── backend/
│   ├── server.py              # Servidor principal (~20k líneas)
│   ├── routes/
│   │   └── support.py         # Router de soporte global
│   └── tests/
│       └── test_notifications_messaging.py
└── frontend/
    └── src/
        ├── App.js
        ├── components/
        │   ├── NotificationBell.jsx     # Sistema notificaciones navegables
        │   ├── MessageCenter.jsx        # Mensajería con contactos categorizados
        │   ├── EventsList.jsx           # Widget eventos con popup detalle
        │   ├── AttendanceAndNews.jsx    # Widget noticias con popup premium
        │   ├── MiniCalendar.jsx         # Calendario con popup arriba
        │   └── dashboard/
        │       ├── OwnerMetricCards.jsx
        │       ├── OwnerQuickAccess.jsx
        │       ├── PaymentsChart.jsx
        │       └── ProfileCard.jsx
        └── pages/
            ├── DashboardPage.jsx
            └── support/
```

## Third-Party Integrations
- Cloudinary (imágenes)
- qrcode.react, @yudiel/react-qr-scanner (QR)
- jspdf & jspdf-autotable (PDFs)
- @tanstack/react-query (caching)

## Pending Tasks (Prioritized)
### P0
- Modularizar server.py en routers por dominio (CRÍTICO - >20k líneas)

### P1
- Discrepancia mensajes no leídos (recurrente)
- Parent Portal: Horario vacío
- Completar Parent Portal (Profile, CourseDetail, Messages)
- Filtros inteligentes para Padres en UsersPage
- Conectar "Asistencia del Mes" a datos reales (actualmente hardcodeado)
- Conectar "Noticias y Avisos" a colección real (actualmente hardcodeado)

### P2
- Módulo de Matrículas
- Sistema anti-trampas para exámenes (parcialmente implementado con reglas pre-examen)
- Banco de preguntas
- Reemplazar window.confirm/alert con modales custom
- Cache invalidation para /api/student/tasks

## Credentials
- Owner El Roble: admin@elroble.edu / 1234abc8
- Soporte Global: spencer3009@gmail.com / Socios3009
