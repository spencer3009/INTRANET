# PRD - Intranet Colegio El Roble

## Problema Original
Transformar un dashboard HTML estático de intranet escolar en una aplicación full-stack profesional y amigable con React + FastAPI + MongoDB.

## Arquitectura
- **Frontend**: React 19, Tailwind CSS, shadcn/ui, Recharts, Lucide React
- **Backend**: FastAPI, Motor (async MongoDB), JWT auth, bcrypt
- **Base de datos**: MongoDB

## Usuarios
- Administradores escolares
- Profesores
- Padres de familia (futuros)

## Requisitos Core
- [x] Login con JWT (email/password)
- [x] Dashboard con métricas (exámenes, tareas, alumnos, mensajes)
- [x] Banner hero de bienvenida
- [x] Tarjeta de perfil del usuario
- [x] Lista de próximos eventos
- [x] Calendario mini interactivo
- [x] Gráfico de alumnos inscritos (Recharts)
- [x] Botones de acceso rápido (Calificaciones, Horario, Biblioteca, Contactar)
- [x] Sidebar con navegación por iconos
- [x] Header con búsqueda y notificaciones
- [x] Colores extraídos del logo: Navy #001f4b, Gold #e1b82c
- [x] Datos reales desde MongoDB con seed data
- [x] Responsive design

## Implementado - 8 Feb 2026
- Backend completo con auth JWT, endpoints de dashboard, seed data
- Frontend con 9 componentes: LoginPage, DashboardPage, Sidebar, DashboardHeader, MetricCards, HeroBanner, QuickAccess, EventsList, MiniCalendar, ProfileCard, StudentChart
- Credenciales de prueba: admin@elroble.edu / admin123

## Backlog
- P1: CRUD de eventos y métricas
- P1: Gestión de alumnos y cursos
- P2: Roles de usuario (admin, profesor, padre)
- P2: Módulo de calificaciones funcional
- P2: Módulo de horarios
- P3: Notificaciones en tiempo real
- P3: Chat/mensajería interna
- P3: Módulo de biblioteca
