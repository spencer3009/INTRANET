import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Home, BookOpen, Users, ClipboardList, BarChart3,
  CalendarCheck, MessageSquare, User, LogOut, PenTool,
  X, Video, HeartPulse, Clock
} from "lucide-react";

const teacherNavItems = [
  { id: "inicio", label: "Dashboard", icon: Home, route: "/teacher" },
  { id: "cursos", label: "Mis Cursos", icon: BookOpen, route: "/teacher/courses" },
  { id: "alumnos", label: "Mis Alumnos", icon: Users, route: "/teacher/students" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/teacher/tasks" },
  { id: "notas", label: "Notas", icon: BarChart3, route: "/teacher/grades" },
  { id: "asistencia", label: "Asistencia", icon: CalendarCheck, route: "/teacher/attendance" },
  { id: "horarios", label: "Horarios", icon: Clock, route: "/teacher/horarios" },
  { id: "salud-bienestar", label: "Salud y Bienestar", icon: HeartPulse, route: "/teacher/salud-bienestar" },
  { id: "clases-en-vivo", label: "Clases en Vivo", icon: Video, route: "/teacher/live-classes" },
  { id: "mensajes", label: "Mensajes", icon: MessageSquare, route: "/teacher/messages" },
];

export default function TeacherSidebar({ 
  active, onNavigate, expanded, onToggle, onLogout, 
  schoolName, subdomain, user 
}) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = isHovered || expanded;
  
  const handleNavClick = (item) => {
    if (item.route) {
      navigate(subdomain ? `/${subdomain}${item.route}` : item.route);
    } else {
      onNavigate(item.id);
    }
    if (expanded) onToggle();
  };
  
  const handleProfileClick = () => {
    navigate(subdomain ? `/${subdomain}/teacher/profile` : '/teacher/profile');
    if (expanded) onToggle();
  };
  
  return (
    <>
      {/* Mobile overlay - only covers content área, not sidebar */}
      {expanded && (
        <div className="fixed inset-0 left-[280px] bg-black/30 z-[200] lg:hidden" onClick={onToggle} />
      )}

      <aside
        className={`fixed top-0 h-full lg:h-screen z-[201] flex flex-col transition-all duration-300 shadow-2xl
          ${expanded ? "translate-x-0 w-[280px]" : "-translate-x-full w-[280px]"}
          lg:sticky lg:translate-x-0 lg:z-30 ${isExpanded ? "lg:w-[240px]" : "lg:w-16"}
        `}
        data-testid="teacher-sidebar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' }}
      >
        <div className="flex items-center h-16 border-b border-sky-400/15 px-4">
          <div className="hidden lg:flex items-center justify-center w-8 h-8">
            <PenTool className="w-6 h-6 text-sky-400" />
          </div>
          {(expanded || isExpanded) && (
            <span className="ml-3 text-white font-bold text-sm tracking-wide whitespace-nowrap flex-1">
              {schoolName || "Portal Docente"}
            </span>
          )}
          <button onClick={onToggle} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 lg:hidden ml-auto" data-testid="teacher-sidebar-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {(expanded || isExpanded) && user && (
          <div className="px-4 py-3 border-b border-sky-400/15">
            <div className="flex items-center gap-3">
              {user.photo_url ? (
                <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-sky-400/50" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center ring-2 ring-sky-400/50">
                  <User className="w-5 h-5 text-sky-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.name} {user.last_name}</p>
                <p className="text-sky-400 text-xs font-medium">Profesor</p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto custom-scroll">
          {teacherNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button key={item.id} onClick={() => handleNavClick(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive ? "bg-sky-500/15 text-sky-400" : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
                data-testid={`teacher-nav-${item.id}`} title={item.label}>
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${isActive ? "bg-sky-500/20" : ""}`}>
                  <Icon className="w-[22px] h-[22px]" />
                </span>
                {(expanded || isExpanded) && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sky-400/15 p-2 space-y-1">
          <button onClick={handleProfileClick} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-all" data-testid="teacher-nav-profile" title="Mi Perfil">
            <span className="flex items-center justify-center w-8 h-8"><User className="w-[22px] h-[22px]" /></span>
            {(expanded || isExpanded) && <span className="font-medium">Mi Perfil</span>}
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all" data-testid="teacher-logout" title="Cerrar Sesión">
            <span className="flex items-center justify-center w-8 h-8"><LogOut className="w-[22px] h-[22px]" /></span>
            {(expanded || isExpanded) && <span className="font-medium">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
