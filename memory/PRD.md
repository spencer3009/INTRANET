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

## Modelo de Datos

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

## Flujo de Usuario

### Paso 1: Registro Simple
- **Ruta**: `/register`
- **Campos**: nombre_colegio, email, contraseña
- **Resultado**: `email_verified: false`, `school_id: null`

### Paso 2: Verificación de Email
- **Ruta**: `/verify-email`
- **Resultado**: `email_verified: true`, `school_id: null`

### Paso 3: Creación de Subdominio (OBLIGATORIO)
- **Ruta**: `/onboarding`
- **Validaciones**: Regex `^[a-z0-9]{3,30}$`, unicidad en BD
- **Resultado**: Crea school, actualiza `user.school_id`

### Bloqueo Estricto
- Sin `school_id` → Usuario BLOQUEADO del dashboard
- Backend: 403 "Debes crear tu subdominio primero"
- Frontend: Redirige a `/onboarding`

## Regla Shopify
- Si usuario tiene `subdomain`:
  - Producción: Redirect automático a `https://{subdomain}.edunet.pe`
  - Preview: Redirect a `/school/{subdomain}/dashboard`

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Crear usuario
- `POST /api/auth/login` - Login con redirect_to_subdomain
- `POST /api/auth/verify-email` - Verificar código
- `GET /api/auth/me` - Usuario actual

### Subdomain
- `GET /api/subdomain/check?subdomain=xxx` - Verificar disponibilidad

### Schools
- `POST /api/schools/create` - Crear tenant

### Dashboard (Requieren school_id)
- `GET /api/dashboard/metrics`
- `GET /api/dashboard/events`
- `GET /api/dashboard/enrollment`
- `GET /api/dashboard/school`

## Rutas Frontend

### Rutas Públicas
- `/` - Landing Page
- `/register` - Registro (Paso 1)
- `/login` - Login
- `/verify-email` - Verificación (Paso 2)

### Rutas Protegidas
- `/onboarding` - Crear subdominio (Paso 3)
- `/dashboard/*` - Dashboard (subdomain mode)
- `/school/:subdomain/dashboard/*` - Dashboard (route mode)

## Variables de Entorno

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET=your-secret-key
BASE_DOMAIN=edunet.pe
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-domain.com
REACT_APP_BASE_DOMAIN=edunet.pe
```

## Testing Verificado
- ✅ Registro crea usuario con `school_id: null`
- ✅ Verificación actualiza `email_verified: true`
- ✅ Usuario sin school_id BLOQUEADO del dashboard
- ✅ Creación de school actualiza `user.school_id`
- ✅ Login indica `redirect_to_subdomain: true`
- ✅ Arquitectura híbrida funciona en ambos modos
- ✅ Usuarios legacy (school sin subdomain) redirigidos a onboarding

## Próximas Tareas (Backlog)

### P0 - Crítico
- [ ] Implementar envío real de emails (SendGrid/Resend)
- [ ] Social login (Google, GitHub)

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
- [ ] Facturación/pagos por colegio

## Notas de Plataforma
- **Emergent** actualmente NO soporta wildcard SSL automático
- El wildcard DNS (*.edunet.pe) está configurado pero SSL no se emite para subdominios
- La arquitectura híbrida permite desarrollo sin bloqueo
- Cuando Emergent soporte wildcard SSL, solo cambiar detección en `App.js`
