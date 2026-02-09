# PRD - EduNet: Intranet SaaS Multi-Tenant para Colegios

## Problema Original
Crear un servicio SaaS de intranet para colegios en Perú (EduNet), con landing page, flujo de registro completo, verificación de email, onboarding con configuración de subdominio personalizado, y dashboard de administración. Arquitectura multi-tenant basada en subdominios.

## Arquitectura
- **Frontend**: React 19, Tailwind CSS, shadcn/ui, Recharts, Lucide React
- **Backend**: FastAPI, Motor (async MongoDB), JWT auth, bcrypt
- **Base de datos**: MongoDB
- **Dominio Base**: edunet.pe (con wildcard DNS *.edunet.pe)
- **Multi-Tenancy**: Basado en subdominios, routing por Host header
- **Marca**: EduNet (navy #001f4b, gold #e1b82c)

## Usuarios
- Directores/Administradores de colegios (registro inicial)
- Personal administrativo escolar
- Profesores (futuro)
- Padres de familia (futuro)

## Flujo SaaS Multi-Tenant (Implementado - Diciembre 2025)

### Paso 1: Registro Simple
- **Campos**: nombre_colegio, email, contraseña (solo 3 campos)
- **Endpoint**: `POST /api/schools/register`
- **Estado**: `onboarding_complete: false`

### Paso 2: Verificación de Email
- **Código**: 6 caracteres alfanuméricos
- **Endpoint**: `POST /api/schools/verify-email`
- **Demo**: Código visible en pantalla para testing
- **Retorna**: Token JWT pero `onboarding_complete: false`

### Paso 3: Creación de Subdominio (OBLIGATORIO)
- **Pantalla**: "Crea el nombre de tu intranet"
- **Input visual**: `[tucolegio] .edunet.pe` (sufijo fijo)
- **Validaciones**:
  - Solo letras minúsculas y números
  - Sin espacios ni caracteres especiales
  - Mínimo 3 caracteres, máximo 30
  - Verificación de disponibilidad en BD (no DNS)
  - Subdomnios reservados bloqueados (admin, www, api, etc.)
- **Endpoint disponibilidad**: `GET /api/schools/check-subdomain/{subdomain}`
- **Endpoint creación**: `POST /api/schools/create-subdomain`
- **Al completar**: `onboarding_complete: true`, redirige a dashboard

### Protección de Rutas
- Dashboard BLOQUEADO hasta completar onboarding
- Si `onboarding_complete: false` → redirige a `/welcome`
- Solo después de crear subdominio se permite acceso

### Multi-Tenancy por Host Header
- **Endpoint**: `GET /api/tenant/info`
- Backend lee header `Host` de cada request
- Extrae subdominio dinámicamente
- Busca colegio en BD por subdomain
- Si existe → carga intranet de ese colegio
- Si no existe → muestra landing o error

## Modelo de Datos

### schools
```json
{
  "id": "uuid",
  "school_name": "Colegio El Roble",
  "email": "admin@colegio.edu.pe",
  "password": "bcrypt_hash",
  "email_verified": true,
  "verification_code": "ABC123",
  "onboarding_complete": true,
  "subdomain": "elroble",
  "full_domain": "elroble.edunet.pe",
  "status": "active",
  "created_at": "2025-12-10T...",
  "activated_at": "2025-12-10T..."
}
```

### users
```json
{
  "id": "uuid",
  "email": "admin@colegio.edu.pe",
  "password": "bcrypt_hash",
  "name": "Colegio El Roble",
  "role": "Administrador",
  "school_id": "uuid",
  "avatar": "",
  "email_verified": true,
  "onboarding_complete": true,
  "created_at": "2025-12-10T..."
}
```

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Login con email/password
- `GET /api/auth/me` - Obtener usuario actual

### Registro SaaS
- `POST /api/schools/register` - Paso 1: Crear cuenta
- `POST /api/schools/verify-email` - Paso 2: Verificar código
- `GET /api/schools/check-subdomain/{subdomain}` - Verificar disponibilidad
- `POST /api/schools/create-subdomain` - Paso 3: Crear subdominio

### Multi-Tenant
- `GET /api/tenant/info` - Obtener info del tenant actual

### Dashboard
- `GET /api/dashboard/metrics` - Métricas del colegio
- `GET /api/dashboard/events` - Eventos del calendario
- `GET /api/dashboard/enrollment` - Datos de matrícula
- `GET /api/dashboard/school` - Info del colegio

## Páginas Frontend

### Públicas
- `/` - Landing Page (premium, estilo Stripe/Linear)
- `/register` - Registro simplificado (3 campos)
- `/login` - Inicio de sesión
- `/verify-email` - Verificación de código

### Protegidas (requieren auth)
- `/welcome` - Bienvenida post-verificación
- `/onboarding` - Creación de subdominio (OBLIGATORIA)
- `/dashboard` - Dashboard principal (solo si onboarding completo)

## Implementado - Diciembre 2025

### Landing Page ✅
- Diseño premium estilo SaaS (Stripe/Linear/Notion)
- Tema oscuro con gradientes mesh
- Hero impactante con preview de dashboard
- 6 secciones: Features, How it Works, Why EduNet, Testimonials, Pricing, FAQ
- 100% responsive

### Registro SaaS Simplificado ✅
- Solo 3 campos: nombre_colegio, email, contraseña
- Panel izquierdo informativo (55% ancho)
- Indicador "Paso 1 de 3"

### Verificación de Email ✅
- Código demo visible para testing
- Indicador "Paso 2 de 3"

### Onboarding de Subdominio ✅
- Input visual: `[subdomain] .edunet.pe`
- Validación en tiempo real con debounce
- Preview del dominio final
- Reglas visibles
- Indicador "Paso 3 de 3"

### Multi-Tenancy Backend ✅
- Extracción de subdominio del Host header
- Validación contra BD (no DNS)
- Subdominios reservados bloqueados
- Endpoints tenant-aware

## Próximas Tareas (Backlog)

### P0 - Crítico
- [ ] Implementar envío real de emails (SendGrid/Resend)
- [ ] Manejo de errores de red en frontend

### P1 - Importante
- [ ] CRUD de eventos en dashboard
- [ ] CRUD de estudiantes
- [ ] CRUD de docentes
- [ ] Gestión de roles y permisos

### P2 - Mejoras
- [ ] Recuperación de contraseña
- [ ] Cambio de contraseña
- [ ] Personalización de logo por colegio
- [ ] Notificaciones en tiempo real

### P3 - Futuro
- [ ] App móvil
- [ ] Integración con calificaciones
- [ ] Módulo de comunicación padres
- [ ] Integración de pagos (Stripe)

## URLs de Ejemplo
- Landing: https://edunet.pe
- Registro: https://edunet.pe/register
- Intranet Colegio El Roble: https://elroble.edunet.pe
- Intranet Colegio San Pablo: https://sanpablo.edunet.pe

## Testing
- API endpoints testeados con curl
- Frontend verificado con screenshots
- Flujo completo de registro → verificación → onboarding → dashboard funcional
