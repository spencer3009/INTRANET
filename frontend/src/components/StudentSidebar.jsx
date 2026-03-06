import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Home,
  BookOpen,
  ClipboardList,
  BarChart3,
  CalendarCheck,
  MessageSquare,
  User,
  Menu,
  LogOut,
  GraduationCap,
  Clock,
  Trophy,
  Calendar
} from "lucide-react";

// Student navigation items - simplified menu
const studentNavItems = [
  { id: "inicio", label: "Dashboard", icon: Home, route: "/student" },
  { id: "cursos", label: "Mis Cursos", icon: BookOpen, route: "/student/courses" },
  { id: "horarios", label: "Mi Horario", icon: CalendarCheck, route: "/student/schedule" },
  { id: "examenes", label: "Mis Exámenes", icon: Calendar, route: "/student/exams" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/student/tasks" },
  { id: "calificaciones", label: "Calificaciones", icon: Trophy, route: "/student/grades" },
  { id: "asistencia", label: "Asistencia", icon: Clock, route: "/student/attendance" },
  { id: "mensajes", label: "Mensajes", icon: MessageSquare, route: "/student/messages" },
];

export default function StudentSidebar({ 
  active, 
  onNavigate, 
  expanded, 
  onToggle, 
  onLogout, 
  schoolName, 
  subdomain,
  user 
}) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  
  // Sidebar is expanded if hovered (desktop) or manually expanded (mobile)
  const isExpanded = isHovered || expanded;
  
  const handleNavClick = (item) => {
    if (item.route) {
      // Navigate to specific route
      if (subdomain) {
        navigate(`/${subdomain}${item.route}`);
      } else {
        navigate(item.route);
      }
    } else {
      // Just update active section
      onNavigate(item.id);
    }
  };
  
  const handleProfileClick = () => {
    if (subdomain) {
      navigate(`/${subdomain}/student/profile`);
    } else {
      navigate('/student/profile');
    }
  };
  
  return (
    <>
      {/* Mobile overlay - only covers content area, not sidebar */}
      {expanded && (
        <div className="fixed inset-0 left-[280px] bg-black/30 z-[200] lg:hidden" onClick={onToggle} />
      )}
      <aside
      className={`student-sidebar fixed lg:sticky top-0 h-screen z-[201] flex flex-col transition-all duration-300 ${
        isExpanded ? "expanded translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
      data-testid="student-sidebar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'linear-gradient(180deg, #1e3a5f 0%, #0f2744 100%)',
        width: isExpanded ? '240px' : '64px'
      }}
    >
      {/* Top: Logo + Toggle */}
      <div className="flex items-center justify-center h-16 border-b border-white/10 px-3">
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all lg:hidden"
          data-testid="student-sidebar-toggle"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden lg:flex items-center justify-center w-10 h-10">
          <GraduationCap className="w-6 h-6 text-cyan-400" />
        </div>
        {isExpanded && (
          <span className="ml-3 text-white font-bold text-sm tracking-wide whitespace-nowrap" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {schoolName || "Portal Alumno"}
          </span>
        )}
      </div>

      {/* Student Info Card (when expanded) */}
      {isExpanded && user && (
        <div className="px-3 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {user.photo_url ? (
              <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-cyan-400/50" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center ring-2 ring-cyan-400/50">
                <User className="w-5 h-5 text-cyan-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user.name} {user.last_name}
              </p>
              <p className="text-cyan-400/70 text-xs">Estudiante</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2.5 space-y-1 overflow-y-auto custom-scroll">
        {studentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive 
                  ? "bg-cyan-500/20 text-cyan-400" 
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
              data-testid={`student-nav-${item.id}`}
              title={item.label}
            >
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${isActive ? "bg-cyan-500/20" : ""}`}>
                <Icon className="w-[22px] h-[22px]" />
              </span>
              {isExpanded && <span className="font-medium" style={{ fontSize: '0.95rem' }}>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom: Profile & Logout */}
      <div className="border-t border-white/10 p-2 space-y-1">
        <button
          onClick={handleProfileClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
          data-testid="student-nav-profile"
          title="Mi Perfil"
        >
          <span className="flex items-center justify-center w-8 h-8">
            <User className="w-[22px] h-[22px]" />
          </span>
          {isExpanded && <span className="font-medium" style={{ fontSize: '0.95rem' }}>Mi Perfil</span>}
        </button>
        
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
          data-testid="student-logout"
          title="Cerrar Sesion"
        >
          <span className="flex items-center justify-center w-8 h-8">
            <LogOut className="w-[22px] h-[22px]" />
          </span>
          {isExpanded && <span className="font-medium" style={{ fontSize: '0.95rem' }}>Cerrar Sesion</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
