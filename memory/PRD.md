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

## Implementado

### Landing Page (/) — REDISEÑADA v2 (Diciembre 2025)
**Diseño Premium SaaS - Estilo Stripe/Linear/Notion**
- [x] Tema oscuro (#0a0f1a) como base - elimina el look "muy blanco"
- [x] Gradientes mesh (azul/púrpura/dorado) como fondo principal
- [x] Glassmorphism (backdrop-blur) en cards y navbar
- [x] Navbar fija con navegación (4 links + 2 CTAs con gradiente dorado)
- [x] Hero impactante:
  - Badge "Plataforma #1 en Perú" con ícono Sparkles
  - Título con gradiente dorado "transforma"
  - 2 CTAs con hover effects
  - Trust badges (Sin tarjeta, 5 min setup, Soporte español)
- [x] Preview de dashboard estilo app:
  - Frame con botones de navegador
  - 4 stats coloridas (azul, verde, violeta, ámbar)
  - Gráfico de barras mini
  - Tarjetas flotantes animadas (float animation)
- [x] Estadísticas: 4 cards con gradientes vibrantes (azul, violeta, verde, naranja)
- [x] Features: 6 cards con íconos en gradientes coloridos
- [x] "Cómo funciona": Fondo gradiente azul/púrpura, 4 pasos con iconos dorados
- [x] "Por qué EduNet": Visual abstracto CSS (formas geométricas), lista de beneficios
- [x] Testimonios: 3 cards con avatares de iniciales, estrellas doradas
- [x] Pricing: 3 planes con highlight dorado en "Profesional"
- [x] Seguridad: 4 badges (encriptación, LGPDP, uptime, soporte)
- [x] FAQ: 4 preguntas expandibles
- [x] CTA final: Gradiente púrpura/azul impactante
- [x] Footer oscuro con 4 columnas
- [x] 100% responsive (móvil y desktop)
- [x] Sin imágenes pesadas - solo CSS gradients y placeholders
- [x] Testing: 60/60 tests pasados

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
