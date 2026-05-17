import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Home,
  Users,
  GraduationCap,
  UserCog,
  UserCheck,
  Calendar,
  BookMarked,
  BookOpen,
  Clock,
  Layers,
  ClipboardList,
  BarChart3,
  CalendarCheck,
  FileEdit,
  MessageSquare,
  Megaphone,
  Settings,
  Palette,
  Shield,
  User,
  LogOut,
  Menu,
  ChevronDown,
  ChevronRight,
  Video,
  HeartPulse,
  Archive,
  Download,
} from "lucide-react";

// Admin Navigation Structure - Organized by logical sections
const NAV_SECTIONS = [
  {
    id: "operacion",
    label: "OPERACIÓN",
    items: [
      { id: "dashboard", label: "Dashboard", icon: Home, route: "/admin" },
      { id: "usuarios", label: "Usuarios", icon: Users, route: "/admin/users" },
      { id: "alumnos", label: "Alumnos", icon: GraduationCap, route: "/admin/students" },
      { id: "profesores", label: "Profesores", icon: UserCog, route: "/admin/teachers" },
      { id: "padres", label: "Padres", icon: UserCheck, route: "/admin/parents" },
    ]
  },
  {
    id: "estructura",
    label: "ESTRUCTURA ACADÉMICA",
    items: [
      { id: "estructura-académica", label: "Estructura Académica", icon: Layers, route: "/admin/academic-structure" },
      { id: "tutorias", label: "Tutorías", icon: UserCheck, route: "/admin/tutoring-overview" },
    ]
  },
  {
    id: "gestion",
    label: "GESTIÓN ACADÉMICA",
    items: [
      { id: "notas", label: "Notas", icon: BarChart3, route: "/admin/grades-management" },
      { id: "libretas-bulk", label: "Descarga de libretas", icon: Download, route: "/admin/libretas-bulk", ownerOrAdmin: true },
      { id: "asistencia", label: "Asistencia", icon: CalendarCheck, route: "/admin/attendance" },
      { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/admin/tasks" },
      { id: "examenes", label: "Exámenes Online", icon: FileEdit, route: "/admin/exams" },
      { id: "examenes-programados", label: "Exámenes Programados", icon: Calendar, route: "/admin/exam-schedule" },
      { id: "horarios", label: "Horarios", icon: Clock, route: "/admin/horarios" },
      { id: "clases-en-vivo", label: "Clases en Vivo", icon: Video, route: "/admin/live-classes" },
      { id: "salud-bienestar", label: "Salud y Bienestar", icon: HeartPulse, route: "/admin/salud-bienestar" },
    ]
  },
  {
    id: "comunicacion",
    label: "COMUNICACIÓN",
    items: [
      { id: "mensajes", label: "Centro de Mensajes", icon: MessageSquare, route: "/admin/messages" },
      { id: "comunicados", label: "Comunicados", icon: Megaphone, route: "/admin/announcements" },
    ]
  },
  {
    id: "configuracion",
    label: "CONFIGURACIÓN",
    items: [
      { id: "sistema", label: "Sistema", icon: Settings, route: "/admin/settings" },
      { id: "branding", label: "Branding", icon: Palette, route: "/admin/branding" },
      { id: "roles", label: "Roles y Permisos", icon: Shield, route: "/admin/roles" },
      { id: "cierre-anio", label: "Cierre de Año Académico", icon: Archive, route: "/admin/cierre-anio", ownerOnly: true },
    ]
  }
];

export default function AdminSidebar({ 
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
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [expandedSections, setExpandedSections] = useState(["operacion", "estructura"]);
  
  // Sidebar is expanded if hovered (desktop) or manually expanded (mobile)
  const isExpanded = isHovered || expanded;
  
  const handleNavClick = (item) => {
    if (item.route) {
      if (subdomain) {
        navigate(`/${subdomain}${item.route}`);
      } else {
        navigate(item.route);
      }
    }
    onNavigate?.(item.id);
  };
  
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };
  
  const isActiveRoute = (route) => {
    const currentPath = location.pathname;
    const fullRoute = subdomain ? `/${subdomain}${route}` : route;
    
    // Exact match for dashboard
    if (route === "/admin") {
      return currentPath === fullRoute || currentPath === `${fullRoute}/`;
    }
    
    // Prefix match for other routes
    return currentPath.startsWith(fullRoute);
  };
  
  const handleLogoutClick = () => {
    if (subdomain) {
      navigate(`/${subdomain}/login`);
    } else {
      navigate('/login');
    }
    onLogout?.();
  };
  
  return (
    <>
      {/* Mobile overlay - only covers content área, not sidebar */}
      {isExpanded && (
        <div className="fixed inset-0 left-64 bg-black/10 z-[35] lg:hidden" onClick={onToggle} />
      )}
      <aside
        className={`fixed lg:sticky top-0 h-screen z-40 flex flex-col transition-all duration-300 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 ${
          isExpanded ? "w-64 translate-x-0" : "w-16 -translate-x-full lg:translate-x-0"
        }`}
      data-testid="admin-sidebar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top: Logo + Toggle */}
      <div className="flex items-center justify-center h-16 border-b border-white/10 px-3">
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all lg:hidden"
          data-testid="admin-sidebar-toggle"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden lg:flex items-center justify-center w-10 h-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
        </div>
        {isExpanded && (
          <div className="ml-3 flex-1 min-w-0">
            <span className="text-white font-bold text-sm tracking-wide whitespace-nowrap block truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {schoolName || "EDUNET"}
            </span>
            <span className="text-purple-400 text-xs font-medium">Administrador</span>
          </div>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto custom-scroll">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="mb-4">
            {/* Section Header - Only show when expanded */}
            {isExpanded && (
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
              >
                <span>{section.label}</span>
                {expandedSections.includes(section.id) ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            
            {/* Section Items */}
            <div className={`space-y-1 ${isExpanded && !expandedSections.includes(section.id) ? 'hidden' : ''}`}>
              {section.items.filter(item => {
                if (item.ownerOnly && user?.role !== "owner") return false;
                if (item.ownerOrAdmin && user?.role !== "owner" && user?.role !== "admin") return false;
                return true;
              }).map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.route);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      isActive 
                        ? "bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-white border-l-2 border-purple-500" 
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                    data-testid={`admin-nav-${item.id}`}
                    title={item.label}
                  >
                    <span className={`flex-shrink-0 ${isActive ? "text-purple-400" : ""}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    {isExpanded && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: Profile & Logout */}
      <div className="border-t border-white/10 p-2 space-y-1">
        {/* Profile */}
        <button
          onClick={() => handleNavClick({ id: "profile", route: "/admin/profile" })}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            isActiveRoute("/admin/profile")
              ? "bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-white"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
          data-testid="admin-nav-profile"
          title="Mi Perfil"
        >
          {user?.photo_url ? (
            <img src={user.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <User className="w-5 h-5" />
          )}
          {isExpanded && (
            <div className="flex-1 text-left min-w-0">
              <span className="text-sm font-medium truncate block">{user?.name || "Mi Perfil"}</span>
            </div>
          )}
        </button>
        
        {/* Logout */}
        <button
          onClick={handleLogoutClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
          data-testid="admin-nav-logout"
          title="Cerrar Sesión"
        >
          <LogOut className="w-5 h-5" />
          {isExpanded && <span className="text-sm font-medium">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
