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

## Landing Page (/) — REDISEÑADA
- [x] Navbar fija con navegación por secciones (5 links + 2 CTAs)
- [x] Hero centrado con badge "#1 en Perú", título destacado, descripción, 2 CTAs, trust badges
- [x] Preview de dashboard en frame de navegador (con sidebar, métricas, gráfico)
- [x] Barra de social proof (8 nombres de colegios)
- [x] Estadísticas: 120+ colegios, 45K+ usuarios, 99.9% uptime, 4.9/5 satisfacción
- [x] 6 Feature cards con highlights y hover effects
- [x] "Cómo funciona" en 4 pasos con líneas conectoras
- [x] Testimonios (3) con fotos, estrellas, nombre/cargo/colegio (fondo navy)
- [x] Pricing (3 planes): Básico gratis, Profesional S/.149/mes, Enterprise
- [x] Sección de seguridad/confianza (encriptación, LGPDP, uptime, soporte)
- [x] FAQ interactivo (5 preguntas con acordeón)
- [x] CTA final con gradiente navy
- [x] Footer con 4 columnas (marca, producto, soporte, legal)

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
