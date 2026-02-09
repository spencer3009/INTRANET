# PRD - EduNet: Intranet SaaS Multi-Tenant para Colegios

## Problema Original
Crear un servicio SaaS de intranet para colegios en Perú (EduNet), con arquitectura multi-tenant real basada en subdominios similar a Shopify/Notion.

## Arquitectura Multi-Tenant
- **Dominio Base**: edunet.pe (con wildcard DNS *.edunet.pe)
- **Multi-Tenancy**: Por subdominios (colegioroble.edunet.pe)
- **Routing**: Por Host header (NO DNS dinámico, NO CNAME)
- **Control**: 100% por base de datos

## Stack Técnico
- **Frontend**: React 19, Tailwind CSS, Lucide React
- **Backend**: FastAPI, Motor (async MongoDB), JWT auth, bcrypt
- **Base de datos**: MongoDB con índices únicos
- **Marca**: EduNet (navy #001f4b, gold #e1b82c)

## Modelo de Datos (Implementado)

### Collection: schools
```json
{
  "id": "uuid",
  "school_name": "Colegio El Roble",
  "subdomain": "colegioroble",        // UNIQUE, lowercase
  "full_domain": "colegioroble.edunet.pe",
  "status": "active",                 // active | pending | suspended
  "owner_user_id": "uuid",
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
  "name": "Colegio El Roble",
  "role": "owner",                    // owner | admin | teacher
  "school_id": "uuid | null",         // NULL hasta crear subdominio
  "email_verified": true,
  "verification_code": "ABC123",
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

## Flujo Obligatorio (Implementado)

### Paso 1: Registro Simple
- **Ruta**: `/register`
- **Campos**: nombre_colegio, email, contraseña
- **Endpoint**: `POST /api/auth/register`
- **Resultado**: 
  - `email_verified: false`
  - `school_id: null` (NO se crea school aún)

### Paso 2: Verificación de Email
- **Ruta**: `/verify-email`
- **Endpoint**: `POST /api/auth/verify-email`
- **Resultado**:
  - `email_verified: true`
  - `school_id: null` (todavía)

### Paso 3: Creación de Subdominio (OBLIGATORIO)
- **Ruta**: `/onboarding`
- **UI**: `[subdomain] .edunet.pe` (sufijo fijo)
- **Endpoint disponibilidad**: `GET /api/subdomain/check?subdomain=xxx`
- **Endpoint creación**: `POST /api/schools/create`
- **Validaciones**:
  - Regex: `^[a-z0-9]{3,30}$`
  - Sin caracteres especiales
  - Mínimo 3 caracteres
  - Subdominios reservados bloqueados
  - Unicidad en BD (no DNS)
- **Resultado**:
  - Crea documento en `schools`
  - Actualiza `user.school_id`
  - `redirect_url: "https://subdomain.edunet.pe"`

### Bloqueo Estricto
- Si `school_id === null` → Usuario BLOQUEADO del dashboard
- Backend retorna 403: "Debes crear tu subdominio primero"
- Frontend redirige a `/onboarding`

## Regla Shopify (Implementado)
- Si usuario tiene `subdomain` → Login retorna `redirect_to_subdomain: true`
- En producción: redirigir automáticamente a `https://{subdomain}.edunet.pe`
- Usuario NUNCA debe ver dashboard desde edunet.pe si tiene subdominio

## Multi-Tenancy por Host Header (Implementado)

### Función extract_subdomain(host)
```python
# edunet.pe, www.edunet.pe → null (main domain)
# colegioroble.edunet.pe → "colegioroble" (tenant)
# admin.edunet.pe → null (reserved)
```

### Endpoint: `GET /api/tenant/info`
```json
{
  "is_main_domain": false,
  "subdomain": "colegioroble",
  "school": { "id", "school_name", "status" }
}
```

## API Endpoints (Implementado)

### Autenticación
- `POST /api/auth/register` - Crear usuario (school_id: null)
- `POST /api/auth/login` - Login con redirect_to_subdomain
- `POST /api/auth/verify-email` - Verificar código
- `GET /api/auth/me` - Usuario actual

### Subdomain
- `GET /api/subdomain/check?subdomain=xxx` - Verificar disponibilidad

### Schools
- `POST /api/schools/create` - Crear tenant (school + actualizar user)

### Dashboard (Requieren school_id)
- `GET /api/dashboard/metrics` - Métricas del colegio
- `GET /api/dashboard/events` - Eventos
- `GET /api/dashboard/enrollment` - Matrícula
- `GET /api/dashboard/school` - Info del colegio

## Subdominios Reservados
```
www, admin, api, app, mail, support, help, dashboard, edunet,
test, demo, staging, dev, ftp, smtp, imap, pop, cdn, static,
assets, billing, payment, account, login, register
```

## Testing Verificado
- ✅ Registro crea usuario con `school_id: null`
- ✅ Verificación de email actualiza `email_verified: true`
- ✅ Usuario sin school_id BLOQUEADO del dashboard (403)
- ✅ Check subdomain valida disponibilidad en BD
- ✅ Creación de school actualiza `user.school_id`
- ✅ Login indica `redirect_to_subdomain: true` si tiene subdomain
- ✅ Dashboard accesible solo con school_id

## Páginas Frontend
- `/` - Landing Page premium
- `/register` - Registro (Paso 1 de 3)
- `/verify-email` - Verificación (Paso 2 de 3)
- `/welcome` - Bienvenida post-verificación
- `/onboarding` - Crear subdominio (Paso 3 de 3, OBLIGATORIO)
- `/dashboard` - Dashboard (solo si school_id existe)
- `/*` - 404 / Colegio no encontrado

## Resultado Final
✅ SaaS multi-colegio real (tipo Shopify/Notion)
✅ Subdominio obligatorio antes del dashboard
✅ Aislamiento por tenant (school_id)
✅ Routing por Host header
✅ Arquitectura escalable

## Próximas Tareas (Backlog)

### P0 - Crítico
- [ ] Implementar envío real de emails (SendGrid/Resend)
- [ ] Página de error para subdominios inexistentes

### P1 - Importante
- [ ] CRUD de eventos en dashboard
- [ ] CRUD de estudiantes
- [ ] CRUD de docentes
- [ ] Tenant-isolation en todas las queries

### P2 - Mejoras
- [ ] Recuperación de contraseña
- [ ] Personalización de logo por colegio
- [ ] Invitación de usuarios al colegio

### P3 - Futuro
- [ ] Roles adicionales (admin, teacher)
- [ ] Suspensión de colegios
- [ ] Facturación por colegio
