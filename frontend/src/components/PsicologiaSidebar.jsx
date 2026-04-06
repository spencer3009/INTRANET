import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Home, Users, ClipboardList, Calendar, Menu,
  MessageSquare, CalendarClock, GraduationCap, User
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const navItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/psicologia" },
  { id: "estudiantes", label: "Estudiantes", icon: Users, route: "/psicologia/estudiantes" },
  { id: "fichas", label: "Fichas Clinicas", icon: ClipboardList, route: "/psicologia/fichas" },
  { id: "sesiones", label: "Sesiones", icon: Calendar, route: "/psicologia/sesiones" },
  { id: "mensajes", label: "Mensajes Padres", icon: MessageSquare, route: "/psicologia/mensajes", hasBadge: true },
  { id: "agenda", label: "Agenda", icon: CalendarClock, route: "/psicologia/agenda" },
  { id: "talleres", label: "Talleres", icon: GraduationCap, route: "/psicologia/talleres" },
  { id: "perfil", label: "Mi Perfil", icon: User, route: "/psicologia/perfil" },
];

export default function PsicologiaSidebar({ active, onNavigate, expanded, onToggle, schoolName, subdomain, token }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const isExpanded = isHovered || expanded;

  useEffect(() => {
    const loadUnread = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API}/api/v1/psychology/messages/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) { const d = await res.json(); setUnreadMessages(d.unread_count || 0); }
      } catch (e) {}
    };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleNavClick = (item) => {
    if (onNavigate) onNavigate(item.id);
    const path = subdomain ? `/${subdomain}${item.route}` : item.route;
    navigate(path);
  };

  return (
    <>
      {expanded && (
        <div className="fixed inset-0 left-[280px] bg-black/30 z-[200] lg:hidden" onClick={onToggle} />
      )}
      <aside
        className={`sidebar fixed lg:sticky top-0 h-screen z-[201] flex flex-col transition-all duration-300 ${
          isExpanded ? "expanded translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        data-testid="psicologia-sidebar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-center h-16 border-b border-white/10 px-3">
          <button
            onClick={onToggle}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all lg:hidden"
            data-testid="psicologia-sidebar-toggle"
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

        <nav className="flex-1 py-4 px-2.5 space-y-1 overflow-y-auto sidebar-scroll">
          {navItems.map((item) => {
            const Icon = item.icon;
            const showBadge = item.hasBadge && item.id === "mensajes" && unreadMessages > 0;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`sidebar-link w-full ${active === item.id ? "active" : ""}`}
                data-testid={`psicologia-sidebar-${item.id}`}
                title={item.label}
              >
                <span className="link-icon relative">
                  <Icon className="w-[22px] h-[22px]" />
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
      </aside>
    </>
  );
}
