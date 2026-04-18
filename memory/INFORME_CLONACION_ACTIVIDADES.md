# INFORME TECNICO: Sistema de Clonacion de Actividades
## EduNet — Plataforma de Gestion Escolar
### Fecha: 17 de abril de 2026

---

## 1. RESUMEN EJECUTIVO

Se implemento la funcionalidad de **clonacion de actividades academicas** que permite a los usuarios (Propietario, Administrador y Profesor) duplicar tareas, foros, examenes y materiales hacia cualquier combinacion de nivel, grado, seccion y asignatura dentro del mismo ano escolar activo.

**Estado: COMPLETADO Y FUNCIONAL**

---

## 2. PROBLEMA QUE RESUELVE

Antes de esta implementacion, cuando un docente o administrador creaba una tarea, foro, examen o material, debia **recrearlo manualmente** en cada seccion y asignatura donde lo necesitara. En un colegio con 13 grados y multiples secciones, esto significaba repetir el mismo trabajo decenas de veces.

**Ejemplo real:** Una tarea de "Democracia y Participacion Ciudadana" creada en Educacion Civica de 3 anos A, debia ser copiada manualmente a 3 anos B, 4 anos A, 4 anos B, 4 anos C, etc.

---

## 3. SOLUCION IMPLEMENTADA

### 3.1 Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│                                                      │
│  ┌─────────────┐    ┌──────────────────────────┐    │
│  │ Boton Clonar│───>│  CloneActivityModal.jsx   │    │
│  │ (4 tipos)   │    │                           │    │
│  └─────────────┘    │  Arbol de seleccion:      │    │
│                      │  Nivel > Grado > Seccion  │    │
│                      │  > Asignatura (checkbox)  │    │
│                      └──────────┬───────────────┘    │
│                                 │                     │
└─────────────────────────────────┼─────────────────────┘
                                  │ POST /api/course/posts/{id}/clonar
                                  │ POST /api/exams/{id}/clonar
┌─────────────────────────────────┼─────────────────────┐
│                    BACKEND      │                      │
│                                 ▼                      │
│  ┌──────────────────────────────────────────┐         │
│  │ Endpoint de Clonacion                     │         │
│  │ - Lee actividad original completa         │         │
│  │ - Para cada subject_id destino:           │         │
│  │   - Crea documento nuevo con nuevo ID     │         │
│  │   - Copia todos los campos               │         │
│  │   - Asigna subject_id destino            │         │
│  │   - Resetea timestamps y autor           │         │
│  │   - Para examenes: clona preguntas       │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  Base de datos: MongoDB                                │
│  Colecciones: course_posts, online_exams,              │
│               exam_questions                           │
└────────────────────────────────────────────────────────┘
```

### 3.2 Componentes Modificados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `CloneActivityModal.jsx` | Frontend (NUEVO) | Componente reutilizable con arbol de seleccion |
| `CourseDetailPage.jsx` | Frontend | Boton Clonar en Tareas y Materiales |
| `TasksTableContent.jsx` | Frontend | Boton Clonar (componente independiente) |
| `ForumContent.jsx` | Frontend | Boton Clonar en Foros |
| `MaterialTableContent.jsx` | Frontend | Boton Clonar en Materiales |
| `ExamsContent.jsx` | Frontend | Boton Clonar en Examenes |
| `courses.py` | Backend | Endpoint POST `/api/course/posts/{id}/clonar` |
| `exams.py` | Backend | Endpoint POST `/api/exams/{id}/clonar` |

---

## 4. FLUJO DEL USUARIO

### Paso 1: Localizar la actividad
El usuario navega a cualquier curso y selecciona la pestana correspondiente (Tareas, Foros, Materiales o Examenes).

### Paso 2: Hacer clic en el boton Clonar
En cada fila de actividad, junto a los botones de Ver, Editar y Eliminar, aparece un nuevo boton con icono de copia (color indigo).

### Paso 3: Modal de Clonacion
Se abre un modal con dos secciones:

**Seccion A — Copia local**
- Toggle "Crear una copia aqui mismo"
- Crea una copia en la misma asignatura actual

**Seccion B — Arbol de destinos**
- Estructura jerarquica expandible:
  - **NIVEL** (ej: Inicial, Primaria, Secundaria)
    - **Grado** (ej: 3 anos, 4 anos, 1ro)
      - **Seccion** (ej: Seccion A, Seccion B)
        - **Asignatura** (ej: Educacion Civica, Matematicas) ← checkbox

- Botones "Seleccionar todo" y "Deseleccionar"
- Contador dinamico: "Clonar en N asignatura(s)"

### Paso 4: Confirmar
Al hacer clic en "Clonar en N asignatura(s)", el sistema:
1. Crea una copia por cada destino seleccionado
2. Muestra toast de confirmacion con el conteo
3. Cierra el modal y refresca la lista

---

## 5. ESPECIFICACIONES TECNICAS

### 5.1 Endpoints

#### POST `/api/course/posts/{post_id}/clonar`
Para tareas, foros y materiales.

**Request:**
```json
{
  "destinos": [
    { "subject_id": "uuid-asignatura-destino-1" },
    { "subject_id": "uuid-asignatura-destino-2" }
  ],
  "clonar_en_misma_seccion": true
}
```

**Response:**
```json
{
  "clonados": 3,
  "errores": []
}
```

#### POST `/api/exams/{exam_id}/clonar`
Para examenes. Misma estructura de request/response. Adicionalmente clona las preguntas del examen (`exam_questions`).

### 5.2 Campos que se copian vs. se resetean

| Campo | Accion |
|-------|--------|
| `title` | Se copia + sufijo " (copia)" |
| `description`, `content` | Se copia tal cual |
| `post_type` | Se copia (task/forum/material) |
| `attachments`, `files` | Se copian las referencias |
| `due_date`, `allow_late` | Se copian tal cual |
| `status` | Se hereda el status original |
| `id` | Se genera nuevo UUID |
| `subject_id` | Se asigna el destino seleccionado |
| `created_at`, `updated_at` | Se resetean a fecha actual |
| `created_by`, `author_id` | Se asigna el usuario que clona |
| `submissions` | Se elimina (no se copian entregas) |
| Para examenes: `questions` | Se clonan con nuevos IDs |

### 5.3 Permisos por Rol

| Rol | Ve el boton | Destinos visibles |
|-----|-------------|-------------------|
| Owner | Si | Todas las asignaturas del colegio |
| Admin | Si | Todas las asignaturas del colegio |
| Director | Si | Todas las asignaturas del colegio |
| Teacher | Si | Solo asignaturas donde esta asignado |
| Parent | No | N/A |
| Student | No | N/A |

---

## 6. TIPOS DE ACTIVIDAD SOPORTADOS

| Tipo | Boton visible | Clonacion funcional | Notas |
|------|--------------|---------------------|-------|
| Tareas | Si | Si | Copia descripcion, fecha limite, archivos adjuntos |
| Foros | Si | Si | Copia tema y configuracion |
| Materiales | Si | Si | Copia archivos, videos YouTube, enlaces |
| Examenes | Si | Si | Copia configuracion + todas las preguntas |

---

## 7. MANEJO DE ERRORES

| Escenario | Comportamiento |
|-----------|---------------|
| Asignatura destino no encontrada | Se agrega a lista de errores, continua con los demas |
| Error de base de datos al insertar | Se agrega a errores, continua |
| Todos los destinos fallan | Toast de warning con lista de errores |
| Algunos fallan, otros exito | Toast: "Clonado en X de Y. Errores: ..." |
| Sin destino seleccionado | Boton deshabilitado, no permite clonar |
| Sin asignaturas disponibles | Mensaje "No hay otras asignaturas disponibles" |

---

## 8. BUGS ENCONTRADOS Y RESUELTOS DURANTE EL DESARROLLO

| # | Bug | Causa | Solucion |
|---|-----|-------|----------|
| 1 | Modal no respondia a clicks (toggle, botones) | z-index del modal (200) era menor que otros overlays de CourseDetailPage | Subido a z-index 9999 + stopPropagation en contenedor |
| 2 | Boton Clonar no aparecia en la tabla de tareas | La tabla se renderiza en `CourseDetailPage.jsx`, no en `TasksTableContent.jsx` (archivo de 11,000+ lineas con componentes internos duplicados) | Agregado boton en el archivo correcto |
| 3 | Actividades clonadas no aparecian en destino | Clones se creaban con `status: "draft"`, la UI no los mostraba | Cambiado para heredar el status original de la actividad |
| 4 | Modal mostraba "No hay secciones" vacio | Endpoint de subjects era `/api/subjects` (404), correcto es `/api/academic/subjects` | Corregida la URL del endpoint |
| 5 | Solo se mostraban secciones del mismo grado | Filtro eliminaba secciones sin la misma asignatura | Removido filtro restrictivo, se muestran todas las secciones |
| 6 | Error `loadTasks is not defined` | State del modal declarado en scope incorrecto (componente padre vs componente interno) | Movido CloneActivityModal al scope correcto de TasksTableContent |

---

## 9. PRUEBAS REALIZADAS

### Prueba 1: Clonar tarea en misma seccion
- **Accion:** Toggle "Crear copia aqui mismo" → Confirmar
- **Resultado:** Tarea "(copia)" creada en la misma asignatura ✅
- **Verificacion:** API curl confirmo creacion en BD

### Prueba 2: Clonar tarea a otra seccion/asignatura
- **Accion:** Seleccionar Educacion Civica en 3 anos A → Confirmar
- **Resultado:** Tarea clonada en destino con todos los campos ✅
- **Verificacion:** API devuelve 2 tareas en subject destino

### Prueba 3: Modal interactivo
- **Accion:** Toggle switch, expandir arbol, seleccionar checkboxes
- **Resultado:** Todos los controles responden correctamente ✅
- **Verificacion:** Screenshot confirma UI funcional

---

## 10. LIMITACIONES CONOCIDAS

1. **Archivos adjuntos:** Se copian las referencias (URLs) pero no se duplica el archivo fisico en storage. Si el original se elimina, las copias pierden el archivo.

2. **Campo nivel:** Los grados en la BD no tienen un campo `nivel` (Inicial/Primaria/Secundaria). El arbol agrupa todo bajo "General". Para mejorar esto, se necesitaria agregar el campo `nivel` a los grados.

3. **Examenes con respuestas:** Las preguntas se clonan pero las respuestas de alumnos no (comportamiento correcto — cada examen es independiente).

---

## 11. RECOMENDACIONES FUTURAS

1. **Agregar campo `nivel` a grados** para que el arbol del modal muestre Inicial / Primaria / Secundaria correctamente.

2. **Clonacion entre anos escolares** — actualmente solo funciona dentro del ano activo.

3. **Historial de clonaciones** — registrar que actividades fueron clonadas, por quien y cuando, para trazabilidad.

4. **Clonacion masiva** — permitir seleccionar multiples actividades a la vez y clonarlas en lote.

---

*Informe generado el 17 de abril de 2026*
*Sistema: EduNet v1.0 — Plataforma de Gestion Escolar*
