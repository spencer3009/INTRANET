import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Home, Users, AlertTriangle, ClipboardList, Calendar,
  Menu, MessageSquare, ArrowRightLeft, BarChart3, BookOpen
} from "lucide-react";
import { coordinacionApi } from "../../api/coordinacion";

const navItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/coordinacion" },
  { id: "estudiantes", label: "Estudiantes", icon: Users, route: "/coordinacion/estudiantes" },
  { id: "incidencias", label: "Incidencias", icon: AlertTriangle, route: "/coordinacion/incidencias" },
  { id: "seguimientos", label: "Seguimientos", icon: ClipboardList, route: "/coordinacion/seguimientos" },
  { id: "charlas", label: "Charlas", icon: BookOpen, route: "/coordinacion/charlas" },
  { id: "reuniones", label: "Reuniones", icon: MessageSquare, route: "/coordinacion/reuniones" },
  { id: "derivaciones", label: "Derivaciones", icon: ArrowRightLeft, route: "/coordinacion/derivaciones" },
  { id: "agenda", label: "Agenda", icon: Calendar, route: "/coordinacion/agenda" },
  { id: "reportes", label: "Reportes", icon: BarChart3, route: "/coordinacion/reportes" },
];

export default function CoordinacionSidebar({ active, onNavigate, expanded, onToggle, schoolName, subdomain, token }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [derivBadge, setDerivBadge] = useState(0);
  const isExpanded = isHovered || expanded;

  useEffect(() => {
    if (!token) return;
    const fetchBadge = async () => {
      try {
        const res = await coordinacionApi.getDerivacionNotifications(token);
        setDerivBadge(res.unseen_count || 0);
      } catch {}
    };
    fetchBadge();
    const interval = setInterval(fetchBadge, 30000);
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
        data-testid="coordinacion-sidebar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-center h-16 border-b border-white/10 px-3">
          <button
            onClick={onToggle}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all lg:hidden"
            data-testid="coordinacion-sidebar-toggle"
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
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`sidebar-link w-full ${active === item.id ? "active" : ""}`}
                data-testid={`coordinacion-sidebar-${item.id}`}
                title={item.label}
              >
                <span className="link-icon relative">
                  <Icon className="w-[22px] h-[22px]" />
                  {item.id === "derivaciones" && derivBadge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="deriv-badge">
                      {derivBadge > 9 ? "9+" : derivBadge}
                    </span>
                  )}
                </span>
                {isExpanded && (
                  <span className="font-medium flex items-center gap-2">
                    {item.label}
                    {item.id === "derivaciones" && derivBadge > 0 && (
                      <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                        {derivBadge}
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
