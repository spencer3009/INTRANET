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

## Technical Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Archivo principal (~17k líneas - DEUDA TÉCNICA CRÍTICA)
- MongoDB como base de datos
- JWT para autenticación

### Frontend (React)
- `/app/frontend/src/` - Código fuente
- Shadcn UI components
- React Router para navegación

## What's Been Implemented

### Session: 2026-02-21
- **BUG FIX: Sincronización de asistencia QR** ✅
  - Problema: El escáner QR guardaba en `student_attendance` pero la pestaña "Estudiantes" leía de `attendances`
  - Solución: Modificado `/app/backend/server.py` endpoint `/api/attendance/qr/scan` para:
    1. Guardar en AMBAS colecciones cuando se escanea un nuevo QR
    2. Sincronizar registros existentes de `student_attendance` a `attendances` cuando se detecta ya marcado
  - Archivos modificados: `/app/backend/server.py` (líneas 7886-7998)
  - Testing: Verificado con curl y screenshot que ambos estudiantes aparecen con "Presente" ✓

- **BUG FIX: Estado por defecto "Pendiente"** ✅
  - Problema: Estudiantes sin registro aparecían como "Presente" por defecto (no tenía sentido usar QR)
  - Solución: Cambiado el valor por defecto de "present" a "pending" en:
    1. `/api/attendance/students` (línea 7394)
    2. `/api/attendance/teachers` (línea 7558)
  - Ahora: Sin registro → "Pendiente" | Con registro (QR/manual) → Estado real

### Previous Sessions
- Cascade delete implementado para usuarios
- UI/UX mejorado en modales de eliminación y edición de usuarios
- Estado "Pendiente" por defecto en asistencia
- Manejo de errores en escáner QR (permisos, HTTPS, iframe)
- Botón "Ver QR" en tarjetas de estudiantes

## Pending Issues (P0)
- Ninguno crítico actualmente

## Upcoming Tasks

### P0 - Critical Technical Debt
- **Modularizar server.py**: El archivo tiene >17,000 líneas. Seguir plan en `/app/backend/MODULARIZATION.md`
  - Separar en routers por dominio: users, attendance, exams, grades, etc.

### P1 - Features
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
- **Admin**: admin@elroble.edu / 1234abc8
- **Student**: pepito@gmail.com / 1234abc8

## Key Endpoints
- `POST /api/attendance/qr/scan` - Escanear QR y registrar asistencia
- `GET /api/attendance/students` - Obtener estudiantes con estado de asistencia
- `POST /api/attendance/students/save` - Guardar asistencia en batch
- `GET /api/attendance/qr/history` - Historial de escaneos del día

## Database Collections
- `student_attendance` - Registros de escaneo QR (legacy)
- `attendances` - Registros de asistencia principal (usada por UI)
- `users` - Usuarios con campo `qr_token`

## Third-Party Integrations
- Cloudinary (imágenes)
- qrcode.react (generación QR)
- @yudiel/react-qr-scanner (escaneo QR)
- jspdf & jspdf-autotable (PDFs)
