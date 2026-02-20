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
7. Sistema de mensajes para Portal del Alumno
8. **Sistema profesional de horarios académicos**

---

## Estado Actual - Febrero 2026

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
| Bug fix: Búsqueda de contactos (nombre completo) | Feb 2026 | ✅ Corregido |
| **Sistema de Mensajes Portal Alumno** | Feb 2026 | ✅ Probado |
| - Tab "Mensajes" con badge | Feb 2026 | ✅ |
| - UI Gmail 3 columnas | Feb 2026 | ✅ |
| - Botón "Enviar mensaje" en tarjeta profesor | Feb 2026 | ✅ |
| - Restricción por asignatura/sección | Feb 2026 | ✅ |
| **Botón "Chat en línea" en tarjeta profesor** | Feb 2026 | ✅ Probado |
| - Abre MessageCenter con profesor preseleccionado | Feb 2026 | ✅ |
| - Navegación directa desde curso → chat con profesor | Feb 2026 | ✅ |
| **Contactos expandidos para estudiantes** | Feb 2026 | ✅ |
| - Profesores del grado/nivel | Feb 2026 | ✅ |
| - Compañeros de clase (misma sección) | Feb 2026 | ✅ |
| - Mensajes entre estudiantes del mismo grado | Feb 2026 | ✅ |
| **Tarjetas de estudiantes con estado de conexión** | Feb 2026 | ✅ |
| - Indicador verde (conectado) / rojo con menos (desconectado) | Feb 2026 | ✅ |
| - Popup al hacer clic con info completa (foto, nombre, email, teléfono) | Feb 2026 | ✅ |
| - Botones "Chat en línea" y "Enviar Mensaje" funcionales | Feb 2026 | ✅ |
| - Usuario actual no genera popup (solo visualiza su tarjeta) | Feb 2026 | ✅ |
| **Menú circular de iconos en Portal Alumno** | Feb 2026 | ✅ |
| - 8 botones circulares (Tablero, Tareas, etc.) | Feb 2026 | ✅ |
| **Badges de mensajes no leídos** | Feb 2026 | ✅ |
| - Sidebar, campana de notificaciones, dashboard | Feb 2026 | ✅ |
| **🆕 Módulo Profesional de Horarios (Horario de Clases)** | Feb 2026 | ✅ Probado |
| - Grilla semanal estilo Google Calendar | Feb 2026 | ✅ |
| - Configuración persistente por school_id (horas, formato 12h/24h) | Feb 2026 | ✅ |
| - Validación de conflictos (profesor/aula/sección) | Feb 2026 | ✅ |
| - CRUD completo de horarios | Feb 2026 | ✅ |
| - Colores por materia | Feb 2026 | ✅ |
| - Filtros por grado/sección | Feb 2026 | ✅ |
| - Modal de agregar/editar con combobox de materias | Feb 2026 | ✅ |
| - Responsive con scroll horizontal y columna sticky | Feb 2026 | ✅ |

### 🔴 P0 - Crítico (Refactoring Técnico)
- [ ] Refactorizar `CourseDetailPage.jsx` (>9,000 líneas)
- [ ] Refactorizar `StudentCourseDetailPage.jsx` (>4,000 líneas)
- [ ] Refactorizar `server.py` (backend monolítico >16,000 líneas)

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
│   └── server.py              # FastAPI monolítico (>16,000 líneas) - NECESITA REFACTOR
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── CourseDetailPage.jsx    # >9,000 líneas - NECESITA REFACTOR
│       │   ├── SchedulePage.jsx        # 🆕 Módulo de horarios profesional
│       │   ├── InternalMailPage.jsx    # Sistema de correo interno
│       │   └── ExamAttemptPage.jsx     # Página de exámenes
│       └── components/
│           └── MessageCenter.jsx       # Chat en tiempo real
```

## Base de Datos
- **MongoDB:** `test_database` (NO CAMBIAR)
- **Colecciones principales:** users, courses, exams, tasks, messages, message_recipients, schedules, schedule_settings

## Nuevas Colecciones (Feb 2026)
| Colección | Descripción |
|-----------|-------------|
| `schedules` | Entradas de horarios con validación de conflictos |
| `schedule_settings` | Configuración persistente por school_id |

## API Endpoints Horarios
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/schedule-settings` | GET | Obtener configuración de horarios |
| `/api/schedule-settings` | POST | Guardar configuración de horarios |
| `/api/schedules` | GET | Listar horarios (filtros: tipo, grado_id, seccion_id) |
| `/api/schedules` | POST | Crear horario con validación de conflictos |
| `/api/schedules/{id}` | PUT | Actualizar horario con validación |
| `/api/schedules/{id}` | DELETE | Eliminar horario |

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
- **iteration_31.json:** Módulo de Horarios - 100% passed (Backend 11/11, Frontend OK)
- **iteration_30.json:** Botón "Chat en línea" - 100% passed (13/13)
- **iteration_29.json:** Sistema mensajes alumno - Validado
- **iteration_28.json:** Flujo "Enviar Mensaje" - 100% passed (10/10)
