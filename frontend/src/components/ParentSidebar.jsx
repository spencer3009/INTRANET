import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Home, BookOpen, ClipboardList, BarChart3, CalendarCheck,
  MessageSquare, User, Menu, LogOut, Users, Clock, Trophy,
  Calendar, ChevronDown, Check, Wallet, X
} from "lucide-react";

const parentNavItems = [
  { id: "inicio", label: "Dashboard", icon: Home, route: "/parent" },
  { id: "pagos", label: "Pagos", icon: Wallet, route: "/parent/payments" },
  { id: "cursos", label: "Cursos", icon: BookOpen, route: "/parent/courses" },
  { id: "horarios", label: "Horario", icon: CalendarCheck, route: "/parent/schedule" },
  { id: "examenes", label: "Exámenes", icon: Calendar, route: "/parent/exams" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/parent/tasks" },
  { id: "calificaciones", label: "Calificaciones", icon: Trophy, route: "/parent/grades" },
  { id: "asistencia", label: "Asistencia", icon: Clock, route: "/parent/attendance" },
  { id: "mensajes", label: "Mensajes", icon: MessageSquare, route: "/parent/messages" },
];

export default function ParentSidebar({ 
  active, onNavigate, expanded, onToggle, onLogout, 
  schoolName, subdomain, user, children, selectedChild, onSelectChild
}) {
  const navigate = useNavigate();
  const [showChildSelector, setShowChildSelector] = useState(false);
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
    navigate(subdomain ? `/${subdomain}/parent/profile` : '/parent/profile');
    if (expanded) onToggle();
  };
  
  const handleChildSelect = (child) => {
    onSelectChild(child);
    setShowChildSelector(false);
    localStorage.setItem('selected_child_id', child.id);
  };
  
  return (
    <>
      {/* Mobile overlay - only covers content area, not sidebar */}
      {expanded && (
        <div className="fixed inset-0 left-[280px] bg-black/10 z-[105] lg:hidden" onClick={onToggle} />
      )}

      <aside
        className={`fixed top-0 h-full lg:h-screen z-[110] flex flex-col transition-all duration-300 shadow-2xl
          ${expanded ? "translate-x-0 w-[280px]" : "-translate-x-full w-[280px]"}
          lg:sticky lg:translate-x-0 lg:z-30 ${isExpanded ? "lg:w-[240px]" : "lg:w-16"}
        `}
        data-testid="parent-sidebar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center h-16 border-b border-sky-400/15 px-4">
          <div className="hidden lg:flex items-center justify-center w-8 h-8">
            <Users className="w-6 h-6 text-sky-400" />
          </div>
          {(expanded || isExpanded) && (
            <span className="ml-3 text-white font-bold text-sm tracking-wide whitespace-nowrap flex-1">
              {schoolName || "Portal Padres"}
            </span>
          )}
          <button onClick={onToggle} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 lg:hidden ml-auto" data-testid="parent-sidebar-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info (mobile drawer + expanded desktop) */}
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
                <p className="text-sky-400 text-xs font-medium">Padre/Apoderado</p>
              </div>
            </div>
          </div>
        )}

        {/* Child selector */}
        {(expanded || isExpanded) && children && children.length > 0 && (
          <div className="px-4 py-3 border-b border-sky-400/15">
            <p className="text-sky-300/60 text-xs uppercase tracking-wider mb-2 font-semibold">Estudiante</p>
            <div className="relative">
              <button onClick={() => setShowChildSelector(!showChildSelector)} className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/10" data-testid="child-selector-button">
                {selectedChild?.photo_url ? (
                  <img src={selectedChild.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-sky-400" />
                  </div>
                )}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-sm font-medium truncate">{selectedChild?.name} {selectedChild?.last_name}</p>
                  <p className="text-sky-300/60 text-xs truncate">{selectedChild?.grado_name} - {selectedChild?.seccion_name}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${showChildSelector ? 'rotate-180' : ''}`} />
              </button>
              {showChildSelector && children.length > 1 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg shadow-xl border border-white/10 overflow-hidden z-50">
                  {children.map((child) => (
                    <button key={child.id} onClick={() => handleChildSelect(child)}
                      className={`w-full flex items-center gap-2 p-2.5 hover:bg-white/10 transition-colors ${selectedChild?.id === child.id ? 'bg-sky-500/20' : ''}`}
                      data-testid={`child-option-${child.id}`}>
                      {child.photo_url ? (
                        <img src={child.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center"><User className="w-4 h-4 text-sky-400" /></div>
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-white text-sm">{child.name} {child.last_name}</p>
                        <p className="text-white/50 text-xs">{child.grado_name}</p>
                      </div>
                      {selectedChild?.id === child.id && <Check className="w-4 h-4 text-sky-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto custom-scroll">
          {parentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button key={item.id} onClick={() => handleNavClick(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive ? "bg-sky-500/15 text-sky-400" : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
                data-testid={`parent-nav-${item.id}`} title={item.label}>
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${isActive ? "bg-sky-500/20" : ""}`}>
                  <Icon className="w-5 h-5" />
                </span>
                {(expanded || isExpanded) && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-sky-400/15 p-2 space-y-1">
          <button onClick={handleProfileClick} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-all" data-testid="parent-nav-profile" title="Mi Perfil">
            <span className="flex items-center justify-center w-8 h-8"><User className="w-5 h-5" /></span>
            {(expanded || isExpanded) && <span className="text-sm font-medium">Mi Perfil</span>}
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all" data-testid="parent-logout" title="Cerrar Sesión">
            <span className="flex items-center justify-center w-8 h-8"><LogOut className="w-5 h-5" /></span>
            {(expanded || isExpanded) && <span className="text-sm font-medium">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
