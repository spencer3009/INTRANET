# PRD - EduNet: Intranet para Colegios

## Problema Original
Crear un servicio SaaS de intranet para colegios en Perú (EduNet), con landing page, flujo de registro completo, verificación de email, onboarding con configuración de subdominio, y dashboard de administración.

## Arquitectura
- **Frontend**: React 19, Tailwind CSS, shadcn/ui, Recharts, Lucide React
- **Backend**: FastAPI, Motor (async MongoDB), JWT auth, bcrypt
- **Base de datos**: MongoDB
- **Marca**: EduNet (navy #001f4b, gold #e1b82c)

## Usuarios
- Directores/Administradores de colegios (registro inicial)
- Personal administrativo escolar
- Profesores (futuro)
- Padres de familia (futuro)

## Flujo de Usuario
1. Landing → Registro → Verificación email → Bienvenida → Onboarding (subdominio) → Dashboard
2. Login directo → Dashboard (usuarios existentes)

## Implementado - 8 Feb 2026

### Landing Page (/)
- [x] Navbar con marca EduNet + CTAs (Ingresar / Crear cuenta)
- [x] Hero section con título, descripción, dos botones principales
- [x] Preview de dashboard mini como visual
- [x] Sección de funcionalidades (6 cards)
- [x] Sección de testimonios (3 cards)
- [x] CTA final con fondo navy
- [x] Footer

### Registro (/register)
- [x] Split layout: panel izquierdo marketing + panel derecho formulario
- [x] Campos: nombre colegio, nombre contacto, cargo (select), email, contraseña, teléfono (opcional)
- [x] Validación frontend y backend
- [x] Rechazo de emails duplicados

### Verificación de Email (/verify-email)
- [x] Pantalla de ingreso de código
- [x] Modo demo: código visible en pantalla
- [x] Verificación contra backend
- [x] Generación de JWT al verificar

### Bienvenida (/welcome)
- [x] Saludo personalizado
- [x] CTA "Empezar configuración"

### Onboarding (/onboarding)
- [x] Campo nombre del colegio
- [x] Auto-generación de subdominio (slugify)
- [x] Verificación de disponibilidad en tiempo real
- [x] Preview de URL final (subdominio.edunet.pe)
- [x] Pantalla de creación con loader
- [x] Pantalla de éxito

### Dashboard (/dashboard)
- [x] Sidebar con navegación por iconos
- [x] Header con logo, búsqueda expandible, notificaciones, avatar
- [x] 4 tarjetas de métricas
- [x] Banner hero de bienvenida
- [x] Acceso rápido (Calificaciones, Horario, Biblioteca, Contactar)
- [x] Gráfico de alumnos inscritos (Recharts)
- [x] Asistencia del mes (donut chart)
- [x] Noticias y avisos
- [x] Lista de eventos
- [x] Calendario mini interactivo
- [x] Tarjeta de perfil
- [x] Footer institucional

### Login (/login)
- [x] Marca EduNet
- [x] Link a registro
- [x] Credenciales de prueba: admin@elroble.edu / admin123

## Backlog
- P0: Envío real de emails de verificación
- P1: CRUD de eventos, métricas, noticias
- P1: Gestión de alumnos y cursos
- P1: Roles de usuario (admin, profesor, padre)
- P2: Módulo de calificaciones funcional
- P2: Módulo de horarios
- P2: Planes de pago (free/pro)
- P3: Notificaciones en tiempo real
- P3: Chat/mensajería interna
