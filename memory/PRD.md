# EduNet - PRD (Product Requirements Document)

## Problema Original
Sistema educativo SaaS multi-tenant premium para escuelas en Perú. La plataforma permite gestionar cursos, tareas, exámenes, y comunicación interna entre profesores y estudiantes.

## Usuarios
- **Administradores/Profesores:** Gestionan cursos, crean exámenes, califican tareas, se comunican con estudiantes
- **Estudiantes:** Realizan exámenes, entregan tareas, se comunican con profesores

## Requerimientos Core
1. Sistema de autenticación multi-tenant por escuela
2. Gestión de cursos y asignaturas
3. Sistema de exámenes con calificación automática
4. Sistema de tareas con entregas
5. Sistema de mensajería interna (correo interno)
6. Presencia en tiempo real de estudiantes

---

## Estado Actual - Diciembre 2025

### ✅ Completado
| Feature | Fecha | Estado |
|---------|-------|--------|
| Sistema de correo interno premium (TipTap) | Dic 2025 | ✅ Funcional |
| Sistema de presencia online/offline | Dic 2025 | ✅ Funcional |
| Pop-up detalle de estudiante | Dic 2025 | ✅ Funcional |
| Botón "Enviar Mensaje" → Modal composición | Dic 2025 | ✅ Probado |
| Bug fix: Calificación de exámenes | Dic 2025 | ✅ Corregido |
| Bug fix: Duración de exámenes | Dic 2025 | ✅ Corregido |
| Bug fix: Timezone en fechas | Dic 2025 | ✅ Corregido |
| Escala de calificación 0-20 (Perú) | Dic 2025 | ✅ Implementado |

### 🔴 P0 - Crítico
- [ ] Refactorizar `CourseDetailPage.jsx` (>9,000 líneas)
- [ ] Refactorizar `server.py` (backend monolítico)

### 🟠 P1 - Alta Prioridad
- [ ] Sistema anti-trampa básico para exámenes
- [ ] Bug: Flickering en "Smart Sticky" columns

### 🟡 P2 - Media Prioridad
- [ ] Módulo de "Matrículas"
- [ ] Banco de preguntas para exámenes
- [ ] Reemplazar `window.confirm`/`alert` con modales

---

## Arquitectura

```
/app
├── backend/
│   └── server.py              # FastAPI monolítico (>15,000 líneas) - NECESITA REFACTOR
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── CourseDetailPage.jsx    # >9,000 líneas - NECESITA REFACTOR
│       │   ├── InternalMailPage.jsx    # Sistema de correo interno
│       │   └── ExamAttemptPage.jsx     # Página de exámenes
│       └── components/
│           └── MessageCenter.jsx       # Chat en tiempo real
```

## Base de Datos
- **MongoDB:** `test_database` (NO CAMBIAR)
- **Colecciones principales:** users, courses, exams, tasks, messages, message_recipients

## Credenciales de Prueba
- **Escuela:** elroble
- **URL:** `/school/elroble/login`
- **Usuario:** admin@elroble.edu
- **Password:** 1234abc8

## Integraciones
- TipTap/Prosemirror (editor de texto)
- Cloudinary (imágenes)
- Google Drive API (entregas de archivos)

---

## Últimas Pruebas
- **iteration_28.json:** Flujo "Enviar Mensaje" - 100% passed (10/10)
