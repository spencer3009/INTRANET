import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Home,
  BookOpen,
  Users,
  ClipboardList,
  BarChart3,
  CalendarCheck,
  MessageSquare,
  User,
  Menu,
  LogOut,
  GraduationCap,
  PenTool
} from "lucide-react";

// Teacher navigation items - focused on teaching workflow
const teacherNavItems = [
  { id: "inicio", label: "Dashboard", icon: Home, route: "/teacher" },
  { id: "cursos", label: "Mis Cursos", icon: BookOpen, route: "/teacher/courses" },
  { id: "alumnos", label: "Mis Alumnos", icon: Users, route: "/teacher/students" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/teacher/tasks" },
  { id: "notas", label: "Notas", icon: BarChart3, route: "/teacher/grades" },
  { id: "asistencia", label: "Asistencia", icon: CalendarCheck, route: "/teacher/attendance" },
  { id: "mensajes", label: "Mensajes", icon: MessageSquare, route: "/teacher/messages" },
];

export default function TeacherSidebar({ 
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
      if (subdomain) {
        navigate(`/school/${subdomain}${item.route}`);
      } else {
        navigate(item.route);
      }
    } else {
      onNavigate(item.id);
    }
  };
  
  const handleProfileClick = () => {
    if (subdomain) {
      navigate(`/school/${subdomain}/teacher/profile`);
    } else {
      navigate('/teacher/profile');
    }
  };
  
  return (
    <aside
      className={`teacher-sidebar fixed lg:sticky top-0 h-screen z-40 flex flex-col transition-all duration-300 ${
        isExpanded ? "expanded translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
      data-testid="teacher-sidebar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        width: isExpanded ? '240px' : '64px'
      }}
    >
      {/* Top: Logo + Toggle */}
      <div className="flex items-center justify-center h-16 border-b border-white/10 px-3">
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all lg:hidden"
          data-testid="teacher-sidebar-toggle"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden lg:flex items-center justify-center w-10 h-10">
          <PenTool className="w-6 h-6 text-emerald-400" />
        </div>
        {isExpanded && (
          <span className="ml-3 text-white font-bold text-sm tracking-wide whitespace-nowrap" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {schoolName || "Portal Docente"}
          </span>
        )}
      </div>

      {/* Teacher Info Card (when expanded) */}
      {isExpanded && user && (
        <div className="px-3 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {user.photo_url ? (
              <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-400/50" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center ring-2 ring-emerald-400/50">
                <User className="w-5 h-5 text-emerald-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user.name} {user.last_name}
              </p>
              <p className="text-emerald-400/70 text-xs">Profesor</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scroll">
        {teacherNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive 
                  ? "bg-emerald-500/20 text-emerald-400" 
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
              data-testid={`teacher-nav-${item.id}`}
              title={item.label}
            >
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${isActive ? "bg-emerald-500/20" : ""}`}>
                <Icon className="w-5 h-5" />
              </span>
              {isExpanded && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom: Profile & Logout */}
      <div className="border-t border-white/10 p-2 space-y-1">
        <button
          onClick={handleProfileClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
          data-testid="teacher-nav-profile"
          title="Mi Perfil"
        >
          <span className="flex items-center justify-center w-8 h-8">
            <User className="w-5 h-5" />
          </span>
          {isExpanded && <span className="text-sm font-medium">Mi Perfil</span>}
        </button>
        
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
          data-testid="teacher-logout"
          title="Cerrar Sesión"
        >
          <span className="flex items-center justify-center w-8 h-8">
            <LogOut className="w-5 h-5" />
          </span>
          {isExpanded && <span className="text-sm font-medium">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}
