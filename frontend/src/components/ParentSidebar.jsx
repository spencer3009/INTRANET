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
  Users,
  Clock,
  Trophy,
  Calendar,
  ChevronDown,
  Check
} from "lucide-react";

// Parent navigation items - same as student but for viewing child's info
const parentNavItems = [
  { id: "inicio", label: "Dashboard", icon: Home, route: "/parent" },
  { id: "dashboard-alumno", label: "Dashboard Alumno", icon: GraduationCap, route: "/parent/student-dashboard" },
  { id: "cursos", label: "Cursos", icon: BookOpen, route: "/parent/courses" },
  { id: "horarios", label: "Horario", icon: CalendarCheck, route: "/parent/schedule" },
  { id: "examenes", label: "Exámenes", icon: Calendar, route: "/parent/exams" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/parent/tasks" },
  { id: "calificaciones", label: "Calificaciones", icon: Trophy, route: "/parent/grades" },
  { id: "asistencia", label: "Asistencia", icon: Clock, route: "/parent/attendance" },
  { id: "mensajes", label: "Mensajes", icon: MessageSquare, route: "/parent/messages" },
];

export default function ParentSidebar({ 
  active, 
  onNavigate, 
  expanded, 
  onToggle, 
  onLogout, 
  schoolName, 
  subdomain,
  user,
  children,
  selectedChild,
  onSelectChild
}) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [showChildSelector, setShowChildSelector] = useState(false);
  
  // Sidebar is expanded if hovered (desktop) or manually expanded (mobile)
  const isExpanded = isHovered || expanded;
  
  const handleNavClick = (item) => {
    if (item.route) {
      // Navigate to specific route
      if (subdomain) {
        navigate(`/school/${subdomain}${item.route}`);
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
      navigate(`/school/${subdomain}/parent/profile`);
    } else {
      navigate('/parent/profile');
    }
  };
  
  const handleChildSelect = (child) => {
    onSelectChild(child);
    setShowChildSelector(false);
    // Store in localStorage
    localStorage.setItem('selected_child_id', child.id);
  };
  
  return (
    <aside
      className={`parent-sidebar fixed lg:sticky top-0 h-screen z-40 flex flex-col transition-all duration-300 ${
        isExpanded ? "expanded translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
      data-testid="parent-sidebar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'linear-gradient(180deg, #2d5a3d 0%, #1a3324 100%)',
        width: isExpanded ? '240px' : '64px'
      }}
    >
      {/* Top: Logo + Toggle */}
      <div className="flex items-center justify-center h-16 border-b border-white/10 px-3">
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all lg:hidden"
          data-testid="parent-sidebar-toggle"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden lg:flex items-center justify-center w-10 h-10">
          <Users className="w-6 h-6 text-emerald-400" />
        </div>
        {isExpanded && (
          <span className="ml-3 text-white font-bold text-sm tracking-wide whitespace-nowrap" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {schoolName || "Portal Padres"}
          </span>
        )}
      </div>

      {/* Parent Info Card (when expanded) */}
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
              <p className="text-emerald-400/70 text-xs">Padre/Apoderado</p>
            </div>
          </div>
        </div>
      )}

      {/* Child Selector (when expanded and has children) */}
      {isExpanded && children && children.length > 0 && (
        <div className="px-3 py-3 border-b border-white/10">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Estudiante</p>
          <div className="relative">
            <button
              onClick={() => setShowChildSelector(!showChildSelector)}
              className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
              data-testid="child-selector-button"
            >
              {selectedChild?.photo_url ? (
                <img src={selectedChild.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              <div className="flex-1 text-left min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {selectedChild?.name} {selectedChild?.last_name}
                </p>
                <p className="text-emerald-400/60 text-xs truncate">
                  {selectedChild?.grado_name} - {selectedChild?.seccion_name}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${showChildSelector ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Dropdown */}
            {showChildSelector && children.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg shadow-xl border border-white/10 overflow-hidden z-50">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => handleChildSelect(child)}
                    className={`w-full flex items-center gap-2 p-2 hover:bg-white/10 transition-colors ${
                      selectedChild?.id === child.id ? 'bg-emerald-500/20' : ''
                    }`}
                    data-testid={`child-option-${child.id}`}
                  >
                    {child.photo_url ? (
                      <img src={child.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-emerald-400" />
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white text-sm">{child.name} {child.last_name}</p>
                      <p className="text-white/50 text-xs">{child.grado_name}</p>
                    </div>
                    {selectedChild?.id === child.id && (
                      <Check className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scroll">
        {parentNavItems.map((item) => {
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
              data-testid={`parent-nav-${item.id}`}
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
          data-testid="parent-nav-profile"
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
          data-testid="parent-logout"
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
