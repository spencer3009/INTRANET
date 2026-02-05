# Sistema de Intranet Escolar - PRD

## Problema Original
Crear un sistema de intranet para colegios en HTML con un menú izquierdo con opciones de intranet moderna y a lado derecho mostrar la boleta de notas escolar. En vez del escudo debe mostrar un espacio para foto del estudiante.

## Requisitos del Usuario
- Todo estático en HTML
- Diseño profesional y moderno
- Foto del estudiante: https://socioscreativos.com/wp-content/uploads/2026/02/nino.png

## User Personas
1. **Estudiante**: Consulta sus notas, horarios, asistencia y comunicados
2. **Padre de Familia**: Revisa el rendimiento académico de su hijo
3. **Personal Administrativo**: Gestiona información escolar

## Requisitos Core
- Menú lateral con navegación
- Dashboard con estadísticas
- Boleta de notas con foto del estudiante
- Horarios escolares
- Registro de asistencia
- Comunicados
- Calendario de eventos
- Perfil del estudiante

## Arquitectura
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Datos**: Estáticos en /app/frontend/src/data/studentData.js
- **Routing**: React Router DOM
- **Icons**: Lucide React
- **Fonts**: Outfit (headings), Inter (body), JetBrains Mono (números)

## Lo Implementado (Feb 2026)
- ✅ Dashboard con perfil del estudiante y estadísticas
- ✅ Boleta de Notas con foto, datos y tabla de calificaciones
- ✅ Horario semanal
- ✅ Registro de asistencia mensual
- ✅ Sistema de comunicados con diálogos
- ✅ Calendario con eventos próximos
- ✅ Perfil completo del estudiante
- ✅ Navegación lateral moderna
- ✅ Notificaciones y menú de usuario
- ✅ Diseño responsive
- ✅ Funcionalidad de impresión

## Backlog Priorizado
### P0 (Crítico)
- Sistema completo implementado ✅

### P1 (Importante)
- Login/autenticación real
- Conexión a base de datos MongoDB
- CRUD de estudiantes
- Panel de administración

### P2 (Deseable)
- Generación de PDF real
- Notificaciones push
- Chat con profesores
- Galería de fotos del colegio

## Próximos Pasos
1. Implementar autenticación si se requiere
2. Conectar con backend para datos dinámicos
3. Agregar más funcionalidades según necesidad
