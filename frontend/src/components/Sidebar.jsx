import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Home,
  UserCog,
  CalendarDays,
  Calendar,
  Settings,
  Menu,
  BookMarked,
  BookOpen,
  Clock,
  MessageSquare,
  ClipboardCheck,
  ClipboardList,
  AlertTriangle,
  Newspaper,
  Landmark,
  UserCheck,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const navItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/dashboard" },
  { id: "usuarios", label: "Usuarios", icon: UserCog, route: "/users" },
  { id: "anos-academicos", label: "Años Académicos", icon: Calendar, route: "/anos-academicos" },
  { id: "ajustes-academicos", label: "Ajustes Académicos", icon: BookMarked, route: "/academic-settings" },
  { id: "asignaturas", label: "Asignaturas", icon: BookOpen, route: "/asignaturas" },
  { id: "asignacion-docente", label: "Asignación Docente", icon: UserCheck, route: "/asignacion-docente" },
  { id: "horarios", label: "Horarios", icon: Clock, route: "/horarios" },
  { id: "asistencias", label: "Asistencias", icon: ClipboardCheck, route: "/asistencias" },
  { id: "calendario", label: "Calendario", icon: CalendarDays, route: "/calendario" },
  { id: "encuestas", label: "Encuestas", icon: ClipboardList, route: "/encuestas" },
  { id: "disciplina", label: "Disciplina", icon: AlertTriangle, route: "/disciplina" },
  { id: "noticias", label: "Noticias", icon: Newspaper, route: "/noticias" },
  { id: "contabilidad", label: "Contabilidad", icon: Landmark, route: "/contabilidad" },
  { id: "mensajeria", label: "Mensajería", icon: MessageSquare, route: "/mensajes", hasBadge: true },
];

export default function Sidebar({ active, onNavigate, expanded, onToggle, onLogout, schoolName, subdomain, token }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // Sidebar is expanded if hovered (desktop) or manually expanded (mobile)
  const isExpanded = isHovered || expanded;
  
  // Load unread messages count
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!token) return;
      try {
        const res = await axios.get(`${API}/api/internal-mail/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnreadMessages(res.data.unread || 0);
      } catch (err) {
        console.error("Error loading unread messages:", err);
      }
    };
    
    loadUnreadCount();
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [token]);
  
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
        isExpanded ? "expanded translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
      data-testid="sidebar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top: Logo + Toggle */}
      <div className="flex items-center justify-center h-16 border-b border-white/10 px-3">
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all lg:hidden"
          data-testid="sidebar-toggle"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden lg:flex items-center justify-center w-10 h-10">
          <Menu className="w-5 h-5 text-white/60" />
        </div>
        {isExpanded && (
          <span className="ml-3 text-white font-bold text-sm tracking-wide whitespace-nowrap" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {schoolName || "EDUNET"}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scroll">
        {navItems.map((item) => {
          const Icon = item.icon;
          const showBadge = item.hasBadge && item.id === "mensajeria" && unreadMessages > 0;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`sidebar-link w-full ${active === item.id ? "active" : ""}`}
              data-testid={`sidebar-${item.id}`}
              title={item.label}
            >
              <span className="link-icon relative">
                <Icon className="w-5 h-5" />
                {showBadge && !isExpanded && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </span>
              {isExpanded && (
                <span className="text-sm font-medium flex-1 flex items-center justify-between">
                  {item.label}
                  {showBadge && (
                    <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom: Settings only (Profile and Logout moved to header dropdown) */}
      <div className="border-t border-white/10 p-2 space-y-1">
        <button
          onClick={handleSettingsClick}
          className="sidebar-link w-full"
          data-testid="sidebar-settings"
          title="Ajustes"
        >
          <span className="link-icon"><Settings className="w-5 h-5" /></span>
          {isExpanded && <span className="text-sm font-medium">Ajustes</span>}
        </button>
      </div>
    </aside>
  );
}
