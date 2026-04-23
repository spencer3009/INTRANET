import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, User, ChevronDown, LogOut, GraduationCap, Headset, ArrowLeft, ArrowLeftRight } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { useOwnerNotifications } from "../hooks/useOwnerNotifications";

function DefaultAvatar({ name, size = "w-10 h-10", textSize = "text-sm" }) {
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
  };
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-[#001f4b] to-[#003366] flex items-center justify-center text-white font-semibold ${textSize}`}>
      {getInitials(name)}
    </div>
  );
}

const ROLE_DISPLAY_MAP = {
  owner: "Propietario",
  super_admin: "Super Admin",
  director: "Director",
  admin: "Administrador",
  teacher: "Profesor",
  student: "Alumno",
  parent: "Padre de Familia",
  psicologo: "Psicologo/a",
  coordinator: "Coordinador/a",
  auxiliar_alimentacion: "Aux. Alimentacion",
  auxiliar_asistencia: "Aux. Asistencia",
};

function getRoleDisplay(role, isOwner, isSuperAdmin) {
  if (isOwner || role === "owner") return ROLE_DISPLAY_MAP.owner;
  if (isSuperAdmin || role === "super_admin") return ROLE_DISPLAY_MAP.super_admin;
  return ROLE_DISPLAY_MAP[role] || role || "Usuario";
}

export default function DashboardHeader({ user, onMenuClick, onLogout, logoUrl, schoolName, subdomain, token, extraActions, onSwitchPortal }) {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const capitalizedToday = today.charAt(0).toUpperCase() + today.slice(1);

  const displayName = schoolName || user?.name || "Admin";
  const userPhoto = user?.photo_url;
  const userName = user?.name || "Usuario";
  const userRole = getRoleDisplay(user?.role, user?.is_owner, user?.is_super_admin);
  const userEmail = user?.email || "";
  const isSupportSession = user?.is_support_session || user?.original_role === "system_admin_global";

  // Register FCM device token for owner/admin/director roles
  useOwnerNotifications(token, user?.role);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") setProfileMenuOpen(false); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setProfileMenuOpen(false);
    };
    if (profileMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);

  const handleProfileClick = () => {
    setProfileMenuOpen(false);
    const basePath = subdomain ? `/${subdomain}` : "";
    if (user?.role === "coordinator") {
      navigate(`${basePath}/coordinacion/perfil`);
    } else {
      navigate(`${basePath}/perfil`);
    }
  };

  const handleLogoutClick = () => { setProfileMenuOpen(false); onLogout(); };

  const handleBackToSupport = () => {
    const supportToken = localStorage.getItem("support_token");
    const supportUser = localStorage.getItem("support_user");
    if (supportToken && supportUser) {
      localStorage.setItem("token", supportToken);
      localStorage.setItem("user", supportUser);
      window.location.href = "/support/schools";
    } else {
      onLogout();
    }
  };

  return (
    <header className="glass-header sticky top-0" style={{ zIndex: 40 }} data-testid="dashboard-header">
      {/* Support session banner */}
      {isSupportSession && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 md:px-6 lg:px-8 py-2 flex items-center justify-between" data-testid="support-session-banner">
          <div className="flex items-center gap-2">
            <Headset className="w-4 h-4 text-white" />
            <span className="text-xs font-semibold text-white">SESIÓN DE SOPORTE</span>
            <span className="text-xs text-emerald-100 hidden sm:inline">Estas navegando como soporte técnico</span>
          </div>
          <button onClick={handleBackToSupport} className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold text-white transition-colors" data-testid="back-to-support-btn">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Volver al Panel de Soporte</span>
            <span className="sm:hidden">Volver</span>
          </button>
        </div>
      )}

      {/* Demo Mode Indicator */}
      {user?.is_demo_user && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-1.5 flex items-center justify-center gap-2" data-testid="demo-mode-indicator">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-semibold text-blue-700">MODO DEMO</span>
        </div>
      )}

      {/* Row 1: Controls — hamburger, logo, notifications, avatar */}
      <div className="flex items-center justify-between h-16 sm:h-20 px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={onMenuClick} className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors" data-testid="header-menu-button">
            <Menu className="w-5 h-5" />
          </button>
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} className="h-10 sm:h-14 w-auto object-contain" data-testid="header-logo" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-[#001f4b] rounded-xl flex items-center justify-center" data-testid="header-logo-placeholder">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-[#e1b82c]" />
            </div>
          )}
          {/* Desktop: show full welcome text inline */}
          <div className="hidden lg:block">
            <h2 className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="header-welcome">
              Bienvenido, {displayName}
            </h2>
            <p className="text-xs text-slate-500">{capitalizedToday}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {extraActions}
          <NotificationBell token={token} userRole={user?.role} />
          <div className="relative" ref={profileMenuRef}>
            <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200 cursor-pointer hover:opacity-90 transition-opacity" data-testid="header-profile-button">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-slate-800">{userName}</p>
                <p className="text-[11px] text-slate-500">{userRole}</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-[#e1b82c]/30" data-testid="header-avatar">
                {userPhoto ? (
                  <img src={userPhoto} alt={userName} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList.remove('hidden'); }} />
                ) : null}
                <div className={`w-full h-full ${userPhoto ? 'hidden' : ''}`}>
                  <DefaultAvatar name={userName} size="w-full h-full" />
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in-up" data-testid="header-profile-dropdown">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-slate-800 truncate">{userName}</p>
                  <p className="text-xs text-slate-500">{userEmail}</p>
                </div>
                <div className="py-1">
                  <button onClick={handleProfileClick} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors" data-testid="header-dropdown-profile">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><User className="w-4 h-4 text-blue-600" /></div>
                    <span className="font-medium">Mi Perfil</span>
                  </button>
                  {onSwitchPortal && (
                    <button onClick={() => { setProfileMenuOpen(false); onSwitchPortal(); }} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-600 flex items-center gap-3 transition-colors" data-testid="header-dropdown-switch-portal">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center"><ArrowLeftRight className="w-4 h-4 text-violet-500" /></div>
                      <span className="font-medium">Cambiar portal</span>
                    </button>
                  )}
                  <button onClick={handleLogoutClick} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-3 transition-colors" data-testid="header-dropdown-logout">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><LogOut className="w-4 h-4 text-red-500" /></div>
                    <span className="font-medium">Cerrar sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Info — Welcome text + school name + date (mobile only) */}
      <div className="lg:hidden px-4 pb-3 -mt-1">
        <p className="text-sm text-slate-500">Bienvenido</p>
        <h2 className="text-base font-semibold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="header-welcome-mobile">{displayName}</h2>
        <p className="text-xs text-slate-400">{capitalizedToday}</p>
      </div>
    </header>
  );
}
