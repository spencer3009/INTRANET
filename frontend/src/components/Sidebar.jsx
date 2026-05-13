import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Home,
  UserCog,
  Calendar,
  Settings,
  Menu,
  BookMarked,
  BookOpen,
  Clock,
  MessageSquare,
  ClipboardCheck,
  AlertTriangle,
  Landmark,
  UserCheck,
  Trophy,
  Video,
  UtensilsCrossed,
  Bus,
  BusFront,
  QrCode,
  ListChecks,
  GraduationCap,
  FileText,
  ClipboardList,
  Users,
  Archive,
} from "lucide-react";
import { canAccessSection, isOwner } from "../lib/permissions";

const API = process.env.REACT_APP_BACKEND_URL;

// Navigation items with optional section for RBAC (only affects non-owner roles)
const allNavItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/dashboard", section: "dashboard" },
  { id: "usuarios", label: "Usuarios", icon: UserCog, route: "/users", section: "users" },
  { id: "anos-academicos", label: "Años Académicos", icon: Calendar, route: "/anos-academicos", section: "grades" },
  { id: "ajustes-académicos", label: "Ajustes Académicos", icon: BookMarked, route: "/academic-settings", section: "grades" },
  { id: "asignaturas", label: "Asignaturas", icon: BookOpen, route: "/asignaturas", section: "courses" },
  { id: "asignacion-docente", label: "Asignación Docente", icon: UserCheck, route: "/asignacion-docente", section: "courses" },
  { id: "gestion-tutorias", label: "Gestión de Tutorías", icon: GraduationCap, route: "/admin/tutoring-overview", roles: ["owner", "admin", "director", "coordinator"] },
  { id: "consolidado-notas", label: "Consolidado Notas", icon: Trophy, route: "/consolidado-notas", section: "grades" },
  { id: "horarios", label: "Horarios", icon: Clock, route: "/horarios", section: "schedule" },
  { id: "asistencias", label: "Asistencias", icon: ClipboardCheck, route: "/asistencias", section: "attendance" },
  { id: "disciplina", label: "Disciplina", icon: AlertTriangle, route: "/disciplina", section: "discipline" },
  { id: "pae", label: "Alimentación", icon: UtensilsCrossed, route: "/pae", section: "pae", roles: ["auxiliar_alimentacion"] },
  { id: "movilidad", label: "Movilidad", icon: BusFront, route: "/movilidad", section: "movilidad", roles: ["auxiliar_movilidad"] },
  { id: "contabilidad", label: "Contabilidad", icon: Landmark, route: "/contabilidad", section: "accounting" },
  { id: "mensajeria", label: "Mensajería", icon: MessageSquare, route: "/mensajes", section: "internal_mail", hasBadge: true },
];

// Dedicated nav items for auxiliar_asistencia role
const auxAsistenciaNavItems = [
  { id: "aux-inicio", label: "Inicio", icon: Home, route: "/aux-asistencia" },
  { id: "aux-escanear", label: "Escanear Asistencia", icon: QrCode, route: "/aux-asistencia/escanear" },
  { id: "aux-manual-alumnos", label: "Manual Alumnos", icon: GraduationCap, route: "/aux-asistencia/asistencias?tab=students" },
  { id: "aux-manual-profes", label: "Manual Profesores", icon: Users, route: "/aux-asistencia/asistencias?tab=teachers" },
  { id: "aux-reportes-alumnos", label: "Reportes Estudiantes", icon: FileText, route: "/aux-asistencia/asistencias?tab=reports" },
  { id: "aux-reportes-profes", label: "Reportes Profesores", icon: ClipboardList, route: "/aux-asistencia/asistencias?tab=reports-teachers" },
  { id: "horarios", label: "Horarios", icon: Clock, route: "/aux-asistencia/horarios" },
];

export default function Sidebar({ active, onNavigate, expanded, onToggle, onLogout, schoolName, subdomain, token: propToken, user }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // Get token from props or localStorage
  const token = propToken || localStorage.getItem("token");
  
  // Sidebar is expanded if hovered (desktop) or manually expanded (mobile)
  const isExpanded = isHovered || expanded;
  
  // Auxiliar de asistencia has its own dedicated nav items
  const navItems = user?.role === 'auxiliar_asistencia'
    ? auxAsistenciaNavItems
    : isOwner(user) 
      ? allNavItems.filter(item => !item.roles || item.roles.includes(user?.role))
      : allNavItems.filter(item => {
          if (item.roles && !item.roles.includes(user?.role)) {
            // Also check active_portal from localStorage
            const activePortal = typeof window !== 'undefined' ? localStorage.getItem('active_portal') : null;
            if (!activePortal || !item.roles.includes(activePortal)) return false;
          }
          if (!item.section) return true;
          return canAccessSection(user, item.section);
        });
  
  // Settings: Owner always sees it, Admin never sees it
  const showSettings = isOwner(user);
  
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
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [token]);
  
  const handleNavClick = (item) => {
    if (item.route) {
      // Navigate to specific route
      if (subdomain) {
        navigate(`/${subdomain}${item.route}`);
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
      navigate(`/${subdomain}/settings`);
    } else {
      navigate('/settings');
    }
  };
  
  return (
    <>
      {/* Mobile overlay - only covers content área, not sidebar */}
      {expanded && (
        <div className="fixed inset-0 left-[280px] bg-black/30 z-[200] lg:hidden" onClick={onToggle} />
      )}
      <aside
        className={`sidebar fixed lg:sticky top-0 h-screen z-[201] flex flex-col transition-all duration-300 ${
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
          <span className="ml-3 text-white font-bold text-base tracking-wide whitespace-nowrap" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {schoolName || "EDUNET"}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2.5 space-y-1 overflow-y-auto sidebar-scroll">
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
                {item.iconImage ? (
                  <img src={item.iconImage} alt="" className="w-[22px] h-[22px] object-contain" />
                ) : (
                  <Icon className={`w-[22px] h-[22px] ${item.iconColor || ""}`} />
                )}
                {showBadge && !isExpanded && (
                  <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </span>
              {isExpanded && (
                <span className="font-medium flex-1 flex items-center justify-between">
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

      {/* Bottom: Settings - Only visible to Owner */}
      {showSettings && (
        <div className="border-t border-white/10 p-2 space-y-1">
          <button
            onClick={handleSettingsClick}
            className="sidebar-link w-full"
            data-testid="sidebar-settings"
            title="Ajustes"
          >
            <span className="link-icon"><Settings className="w-[22px] h-[22px]" /></span>
            {isExpanded && <span className="font-medium">Ajustes</span>}
          </button>
        </div>
      )}
    </aside>
    </>
  );
}
