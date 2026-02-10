# PRD - EduNet: Intranet SaaS Multi-Tenant para Colegios

## Problema Original
Crear un servicio SaaS de intranet para colegios en Perú (EduNet), con arquitectura multi-tenant real basada en subdominios similar a Shopify/Notion.

## Arquitectura Multi-Tenant

### Diseño Original (Producción con Wildcard SSL)
- **Dominio Base**: edunet.pe (con wildcard DNS *.edunet.pe)
- **Multi-Tenancy**: Por subdominios (colegioroble.edunet.pe)
- **Routing**: Por Host header

### Arquitectura Híbrida (Implementada)
Debido a limitaciones de la plataforma Emergent (no soporta wildcard SSL automático), se implementó una arquitectura híbrida que funciona en ambos escenarios:

| Entorno | Patrón URL | Ejemplo |
|---------|-----------|---------|
| **Producción** (con wildcard) | `{subdomain}.edunet.pe/dashboard` | `elroble.edunet.pe/dashboard` |
| **Preview/Dev** (sin wildcard) | `edunet.pe/school/{subdomain}/dashboard` | `edunet.pe/school/elroble/dashboard` |

- El código detecta automáticamente el entorno y usa la estrategia correcta
- La lógica de negocio permanece idéntica
- Cuando Emergent soporte wildcard SSL, la producción funcionará automáticamente

## Stack Técnico
- **Frontend**: React 19, Tailwind CSS, Lucide React
- **Backend**: FastAPI, Motor (async MongoDB), JWT auth, bcrypt
- **Base de datos**: MongoDB con índices únicos
- **Marca**: EduNet (navy #001f4b, gold #e1b82c)
- **Uploads**: Cloudinary (client-side con firma del backend)

## Modelo de Datos

### Collection: schools
```json
{
  "id": "uuid",
  "school_name": "Colegio El Roble",
  "subdomain": "colegioroble",
  "full_domain": "colegioroble.edunet.pe",
  "status": "active",
  "owner_user_id": "uuid",
  "logo_url": "string | null",
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

### Collection: users
```json
{
  "id": "uuid",
  "email": "admin@colegio.edu.pe",
  "password": "bcrypt_hash",
  "name": "Nombre",
  "last_name": "Apellido",
  "role": "owner | admin | teacher | director",
  "school_id": "uuid | null",
  "email_verified": true,
  "photo_url": "string | null",
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

### Collection: academic_levels
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "nombre": "Primaria",
  "descripcion": "string | null",
  "imagen_url": "string | null",
  "activo": true,
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

### Collection: grades
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "nombre": "1°",
  "nivel_id": "uuid",
  "orden": 1,
  "activo": true,
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

### Collection: sections
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "nombre": "A",
  "grado_id": "uuid",
  "capacidad_maxima": 30,
  "activo": true,
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

### Collection: shifts
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "nombre": "Mañana",
  "hora_inicio": "07:00",
  "hora_fin": "12:00",
  "color": "#3B82F6",
  "activo": true,
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

### Collection: academic_periods
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "nombre": "Bimestre I - 2025",
  "fecha_inicio": "2025-03-03",
  "fecha_fin": "2025-05-09",
  "activo": true,
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

## Módulo de Ajustes Académicos (COMPLETADO)

### Fase 1: Niveles y Grados ✅
- CRUD de niveles educativos (Inicial, Primaria, Secundaria)
- CRUD de grados por nivel
- Validaciones de duplicados y relaciones

### Fase 2: Secciones y Turnos ✅
- CRUD de secciones por grado (A, B, C)
- CRUD de turnos con horarios y colores
- Filtros por nivel/grado

### Fase 3: Períodos Académicos ✅
- CRUD de períodos (bimestres, trimestres, semestres)
- **Solo un período activo por tenant**
- Desactivación automática del período anterior
- Validación de fechas no superpuestas
- Endpoint GET /api/academic/periods/active
- Endpoint POST /api/academic/periods/{id}/activate
- No permite eliminar período activo
- UI con banner destacado para período activo
- Color índigo-violeta (no rojo) para evitar connotaciones negativas

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Crear usuario
- `POST /api/auth/login` - Login con redirect_to_subdomain
- `POST /api/auth/verify-email` - Verificar código
- `GET /api/auth/me` - Usuario actual

### Usuarios
- `GET /api/users` - Listar usuarios del tenant
- `POST /api/users` - Crear usuario
- `GET /api/users/{id}` - Obtener usuario
- `DELETE /api/users/{id}` - Eliminar usuario

### Ajustes Académicos
- `GET/POST /api/academic/levels` - Niveles educativos
- `PUT/DELETE /api/academic/levels/{id}`
- `GET/POST /api/academic/grades` - Grados
- `PUT/DELETE /api/academic/grades/{id}`
- `GET/POST /api/academic/sections` - Secciones
- `PUT/DELETE /api/academic/sections/{id}`
- `GET/POST /api/academic/shifts` - Turnos
- `PUT/DELETE /api/academic/shifts/{id}`
- `GET/POST /api/academic/periods` - Períodos
- `PUT/DELETE /api/academic/periods/{id}`
- `GET /api/academic/periods/active` - Período activo
- `POST /api/academic/periods/{id}/activate` - Activar período

### Mensajería Interna
- `GET /api/messages/users` - Usuarios agrupados por rol
- `GET /api/messages/chats` - Lista de conversaciones
- `GET /api/messages/chats/{user_id}` - Historial de chat
- `POST /api/messages/chats/send` - Enviar mensaje de chat
- `GET /api/messages/inbox` - Bandeja de entrada (mail)
- `POST /api/messages/send` - Enviar mensaje tipo correo
- `PUT /api/messages/{id}/read` - Marcar como leído
- `GET /api/messages/unread-count` - Contador de no leídos
- `DELETE /api/messages/{id}` - Eliminar mensaje

## Próximas Tareas (Backlog)

### P0 - Crítico
- [ ] Implementar funcionalidad "Editar Usuario" (UI existe, funcionalidad pendiente)
- [ ] Verificación de usuario completa del módulo Ajustes Académicos

### P1 - Importante
- [ ] Implementar envío real de emails (SendGrid/Resend)
- [ ] Social login (Google, GitHub)
- [ ] Módulo de Matrículas
- [ ] Completar módulo de Grupos (mensajería grupal por grado/sección/rol)

### P2 - Mejoras
- [ ] Cambiar texto "subdominio" por "identificador" en OnboardingPage.jsx
- [ ] Recuperación de contraseña
- [ ] Refactorizar AcademicSettingsPage.jsx (>1000 líneas)
- [ ] Refactorizar UsersPage.jsx (>1000 líneas)

### P3 - Futuro
- [x] Módulo de Horarios (UI básica implementada - 10 Feb 2026)
- [x] Módulo de Mensajería (Implementado completo - 10 Feb 2026)
- [ ] Módulo de Asistencia
- [ ] Módulo de Calificaciones
- [ ] Módulo de Reportes

## Últimos Cambios (10 Feb 2026)
- **NEW: Módulo de Mensajería** - Implementado completo con:
  - Tab CHATS: Conversaciones directas tipo WhatsApp con burbujas, historial, adjuntos
  - Tab ESCRIBIR: Mensajes tipo correo interno con selector de usuarios por rol
  - Tab GRUPOS: Estructura base (placeholder "Próximamente")
  - Selector de destinatarios agrupados por rol (Directores, Profesores, Padres)
  - Soporte para adjuntos via Cloudinary
  - Bandeja de entrada con filtros (Todos, Recibidos, Enviados)
- **Fix: Módulo de Horarios** - Corregido endpoint `/api/tenant/settings` → `/api/settings`
- **Fix: Dropdowns de grados y profesores** - Ahora cargan correctamente los datos
- **Fix: Logo del colegio** - Ahora se muestra en el header de la página de Horarios
- **Fix: Ordenamiento de grados** - Ordenados por nivel (Inicial → Primaria → Secundaria)
- **Fix: Ruta de Horarios** - Cambiada de `/schedule` a `/horarios` para consistencia en español

## Credenciales de Prueba
- **Email**: admin.settings@test.pe
- **Password**: test123
- **Identifier**: demosettings
- **Login URL**: /school/demosettings/login
- **Messages URL**: /school/demosettings/mensajes

## Notas de Plataforma
- **Emergent** actualmente NO soporta wildcard SSL automático
- El wildcard DNS (*.edunet.pe) está configurado pero SSL no se emite para subdominios
- La arquitectura híbrida permite desarrollo sin bloqueo
- Cuando Emergent soporte wildcard SSL, solo cambiar detección en `App.js`
