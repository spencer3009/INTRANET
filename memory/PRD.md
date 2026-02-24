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

### 6. Portal de Estudiantes
- Dashboard, cursos, tareas, calificaciones, horario, mensajes, perfil

### 7. Portal de Padres (En progreso)
- Dashboard, hijos, calificaciones, asistencia, mensajes
- Pendiente: ParentProfilePage, ParentCourseDetailPage, ParentMessagesPage completo

### 8. Panel Global de Soporte (IMPLEMENTADO - 24 Feb 2026)
#### Usuario Soporte Global
- Email: spencer3009@gmail.com / Password: Socios3009
- Rol: `system_admin_global`
- Se crea automáticamente al iniciar el backend (`ensure_global_support_user`)
- No tiene `school_id` (es global, accede a colegios via `user_school_roles`)

#### Endpoints de Soporte (`/api/support/*`)
- `GET /api/support/overview` - Métricas globales
- `GET /api/support/schools` - Colegios asignados con conteos
- `GET /api/support/all-schools` - Todos los colegios con flag is_assigned
- `POST /api/support/assign-school` - Asignar colegio
- `DELETE /api/support/unassign-school/{school_id}` - Remover acceso
- `POST /api/support/switch-school` - Cambiar contexto (JWT con role=owner)
- `GET /api/support/me` - Perfil del soporte
- `PUT /api/support/me` - Actualizar perfil
- `PUT /api/support/me/password` - Cambiar contraseña

#### Frontend Panel Soporte (`/support/*`)
- `/support` - Dashboard con métricas y últimos colegios
- `/support/schools` - Tarjetas de colegios con botón "Entrar"
- `/support/profile` - Edición de perfil y cambio de contraseña

#### Switch de Contexto
- Al entrar a un colegio, se genera JWT especial con `scope: support_switch`
- El soporte actúa como `owner` dentro del colegio
- Banner verde "SESION DE SOPORTE" con botón "Volver al Panel de Soporte"
- Las credenciales de soporte se guardan en localStorage para restaurar

#### RBAC
- Solo `system_admin_global` accede a `/api/support/*` y `/support/*`
- `require_section_access` y `require_role` reconocen `support_switch` tokens

### 9. Modo Demo (Implementado)
- Usuarios con `is_demo_user: true` (solo creados por Owner)
- Backend middleware bloquea operaciones de escritura (POST, PUT, DELETE)
- Badge "MODO DEMO" en el header
- Popup amigable cuando intentan escribir

### 10. Admin Sistema por Colegio (Implementado)
- Usuarios con `is_system_user: true` por colegio
- Ineditable e ineliminable por otros roles
- Tarjeta especial con candado y tooltip

## Database Collections
- `schools`: Colegios registrados
- `users`: Usuarios con campos `qr_token`, `is_demo_user`, `is_system_user`, `role`
- `user_school_roles`: Tabla pivote soporte-colegios (user_id, school_id, role_in_school). Index único (user_id, school_id)
- `tenant_settings`: Configuraciones por colegio
- `task_submissions`: Entregas de tareas

## Architecture
```
/app
├── backend/
│   ├── server.py              # Servidor principal (~20k líneas)
│   └── routes/
│       ├── core.py            # Dependencias compartidas
│       └── support.py         # Router de soporte global
└── frontend/
    ├── src/
    │   ├── App.js             # Rutas principales incluyendo /support/*
    │   ├── components/
    │   │   ├── SupportLayout.jsx      # Layout del panel de soporte
    │   │   ├── DashboardHeader.jsx    # Header con banner de soporte
    │   │   ├── DemoBlockedModal.jsx   # Modal modo demo
    │   │   └── schedule/
    │   ├── contexts/
    │   │   └── DemoModeContext.jsx
    │   ├── pages/
    │   │   ├── SupportDashboardPage.jsx
    │   │   ├── SupportSchoolsPage.jsx
    │   │   ├── SupportProfilePage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── UsersPage.jsx
    │   │   └── ...
    │   └── utils/
    │       └── imageUtils.js
    └── ...
```

## Third-Party Integrations
- Cloudinary (imágenes)
- qrcode.react (generación QR)
- @yudiel/react-qr-scanner (escaneo QR)
- jspdf & jspdf-autotable (PDFs)
- @tanstack/react-query (caching)
- TipTap / Prosemirror (editor de texto)

## Pending Tasks (Prioritized)
### P0
- Propagar popup "MODO DEMO" a todos los formularios
- Modularizar server.py en routers por dominio

### P1
- Discrepancia mensajes no leídos
- Parent Portal: Horario vacío
- Completar Parent Portal (Profile, CourseDetail, Messages)
- Filtros inteligentes para Padres en UsersPage

### P2
- Módulo de Matrículas
- Sistema anti-trampas para exámenes
- Banco de preguntas
- Notificaciones automáticas
- Reemplazar window.confirm/alert con modales
- Refactorizar StudentCourseDetailPage.jsx
- Cache invalidation para /api/student/tasks

## Credentials
- Owner El Roble: admin@elroble.edu / 1234abc8
- Soporte Global: spencer3009@gmail.com / Socios3009
