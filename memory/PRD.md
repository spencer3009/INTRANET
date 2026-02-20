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
| - **Vista Horizontal/Vertical configurable** | Feb 2026 | ✅ |
| - **TimePicker circular personalizado** | Feb 2026 | ✅ |
| - **Combobox reutilizable (Profesor con foto, Sección)** | Feb 2026 | ✅ |
| - **Filtrado dependiente: Grado→Sección→Profesor→Materia** | Feb 2026 | ✅ |
| - **🆕 Bloques Especiales (Recreo/Almuerzo/Evento)** | Feb 2026 | ✅ Probado |
|   - Fila completa bloqueada para toda la semana | Feb 2026 | ✅ |
|   - Menú contextual (clic derecho) para agregar | Feb 2026 | ✅ |
|   - Modal de edición con TimePicker | Feb 2026 | ✅ |
|   - Validación de solapamiento entre breaks | Feb 2026 | ✅ |
|   - Previene programar clases en horarios bloqueados | Feb 2026 | ✅ |
|   - **🆕 Configurables por Grado + Sección** | Feb 2026 | ✅ Probado |
|     - Cada grado/sección tiene breaks independientes | Feb 2026 | ✅ |
|     - Backend: POST/GET/PUT usan grade_id + section_id | Feb 2026 | ✅ |
|     - Admin: Filtrado automático por selección actual | Feb 2026 | ✅ |
|| **🆕 Módulo Horario de Exámenes** | Feb 2026 | ✅ Probado |
||   - Sistema de programación por fechas específicas (NO semanal) | Feb 2026 | ✅ |
||   - Calendario mensual para admin con badges de cantidad | Feb 2026 | ✅ |
||   - Panel lateral para ver/agregar exámenes por día | Feb 2026 | ✅ |
||   - Validación de conflictos: sección + profesor | Feb 2026 | ✅ |
||   - Tipos: Parcial, Final, Práctica, Quiz con badges | Feb 2026 | ✅ |
||   - Estados dinámicos: Próximo, En curso, Finalizado | Feb 2026 | ✅ |
||   - Auto-filtrado por grado/sección del estudiante | Feb 2026 | ✅ |
||   - **🆕 Vista Calendario para Estudiantes** | Feb 2026 | ✅ Probado |
||     - Calendario mensual igual que admin (read-only) | Feb 2026 | ✅ |
||     - Panel lateral con detalles del examen | Feb 2026 | ✅ |
||     - Navegación entre meses con filtrado dinámico | Feb 2026 | ✅ |
||     - Backend con filtro `from_date` y `to_date` | Feb 2026 | ✅ |
| **🆕 Horario en Portal del Alumno (Read-Only)** | Feb 2026 | ✅ Probado |
|   - Auto-detección de grado y sección del estudiante | Feb 2026 | ✅ |
|   - Endpoint seguro GET /api/student/schedule (sin parámetros) | Feb 2026 | ✅ |
|   - Header dinámico con grado y sección desde backend | Feb 2026 | ✅ |
|   - Clases con foto y nombre del profesor | Feb 2026 | ✅ |
|   - Breaks (Recreo/Almuerzo) visibles como fila completa | Feb 2026 | ✅ |
|   - Tooltip informativo al pasar mouse | Feb 2026 | ✅ |
|   - Modo read-only: sin edición, sin menú contextual | Feb 2026 | ✅ |
|   - Responsive con scroll horizontal y columna sticky | Feb 2026 | ✅ |

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
| `schedule_breaks` | Bloques especiales (recreo, almuerzo, evento) |

## API Endpoints Horarios
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/schedule-settings` | GET | Obtener configuración de horarios |
| `/api/schedule-settings` | POST | Guardar configuración de horarios |
| `/api/schedules` | GET | Listar horarios (filtros: tipo, grado_id, seccion_id) |
| `/api/schedules` | POST | Crear horario con validación de conflictos |
| `/api/schedules/{id}` | PUT | Actualizar horario con validación |
| `/api/schedules/{id}` | DELETE | Eliminar horario |
| `/api/schedule/breaks` | GET | Listar bloques especiales (recreo, almuerzo, evento) |
| `/api/schedule/breaks` | POST | Crear bloque especial |
| `/api/schedule/breaks/{id}` | PUT | Actualizar bloque especial |
| `/api/schedule/breaks/{id}` | DELETE | Eliminar bloque especial |
| `/api/academic/teacher-subjects` | GET | Materias del profesor para grado/sección |

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
- **iteration_35.json:** Módulo Horario de Exámenes - 100% passed (Backend 19/19, Frontend OK)
- **iteration_34.json:** Breaks por Grado/Sección - 100% passed (Backend 14/14, Frontend OK)
- **iteration_33.json:** Horario Portal Alumno (Read-Only) - 100% passed (Backend 11/11, Frontend OK)
- **iteration_32.json:** Bloques Especiales (Recreo/Almuerzo/Evento) - 100% passed (Backend 9/9, Frontend OK)
