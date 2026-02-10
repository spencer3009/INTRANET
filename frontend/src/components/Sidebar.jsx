import { useNavigate } from "react-router-dom";
import {
  Home,
  Mail,
  Users,
  UserCog,
  GraduationCap,
  BookOpen,
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  BookMarked,
  Clock,
  MessageSquare,
  ClipboardCheck,
} from "lucide-react";

const navItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/dashboard" },
  { id: "usuarios", label: "Usuarios", icon: UserCog, route: "/users" },
  { id: "ajustes-academicos", label: "Ajustes Académicos", icon: BookMarked, route: "/academic-settings" },
  { id: "horarios", label: "Horarios", icon: Clock, route: "/horarios" },
  { id: "asistencias", label: "Asistencias", icon: ClipboardCheck, route: "/asistencias" },
  { id: "mensajeria", label: "Mensajería", icon: MessageSquare, route: "/mensajes" },
  { id: "comunidad", label: "Comunidad", icon: Users },
  { id: "academico", label: "Académico", icon: GraduationCap },
  { id: "biblioteca", label: "Biblioteca", icon: BookOpen },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
  { id: "estadisticas", label: "Estadísticas", icon: BarChart3 },
];

export default function Sidebar({ active, onNavigate, expanded, onToggle, onLogout, schoolName, subdomain }) {
  const navigate = useNavigate();
  
  const handleNavClick = (item) => {
    if (item.route) {
      // Navigate to specific route
      if (subdomain) {
        navigate(`/school/${subdomain}${item.route}`);
      } else {
        navigate(item.route);
      }
    } else {
      // Just update active section (for sections not yet implemented)
      onNavigate(item.id);
    }
  };
  
  const handleSettingsClick = () => {
    // Navigate to settings page using route-based approach
    if (subdomain) {
      navigate(`/school/${subdomain}/settings`);
    } else {
      navigate('/settings');
    }
  };
  
  return (
    <aside
      className={`sidebar fixed lg:sticky top-0 h-screen z-40 flex flex-col transition-all duration-300 ${
        expanded ? "expanded translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
      data-testid="sidebar"
    >
      {/* Top: Logo + Toggle */}
      <div className="flex items-center justify-center h-16 border-b border-white/10 px-3">
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
          data-testid="sidebar-toggle"
        >
          <Menu className="w-5 h-5" />
        </button>
        {expanded && (
          <span className="ml-3 text-white font-bold text-sm tracking-wide whitespace-nowrap" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {schoolName || "EDUNET"}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scroll">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`sidebar-link w-full ${active === item.id ? "active" : ""}`}
              data-testid={`sidebar-${item.id}`}
              title={item.label}
            >
              <span className="link-icon">
                <Icon className="w-5 h-5" />
              </span>
              {expanded && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom: Settings + Logout */}
      <div className="border-t border-white/10 p-2 space-y-1">
        <button
          onClick={handleSettingsClick}
          className="sidebar-link w-full"
          data-testid="sidebar-settings"
          title="Ajustes"
        >
          <span className="link-icon"><Settings className="w-5 h-5" /></span>
          {expanded && <span className="text-sm font-medium">Ajustes</span>}
        </button>
        <button
          onClick={onLogout}
          className="sidebar-link w-full hover:!text-red-400 hover:!bg-red-500/10"
          data-testid="sidebar-logout"
          title="Cerrar Sesión"
        >
          <span className="link-icon"><LogOut className="w-5 h-5" /></span>
          {expanded && <span className="text-sm font-medium">Salir</span>}
        </button>
      </div>
    </aside>
  );
}
