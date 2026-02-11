import { useState, useRef, useEffect } from "react";
import { Search, Bell, Menu, X, GraduationCap, User } from "lucide-react";

// Default avatar component with initials
function DefaultAvatar({ name, size = "w-10 h-10", textSize = "text-sm" }) {
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };
  
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-[#001f4b] to-[#003366] flex items-center justify-center text-white font-semibold ${textSize}`}>
      {getInitials(name)}
    </div>
  );
}

// CENTRALIZED ROLE MAP - Same as ProfileCard
const ROLE_DISPLAY_MAP = {
  owner: "Propietario",
  super_admin: "Super Admin",
  director: "Director",
  admin: "Administrador",
  teacher: "Profesor",
  student: "Alumno",
  parent: "Padre de Familia",
  profesor: "Profesor",
  alumno: "Alumno",
};

// Get display role in Spanish
function getRoleDisplay(role, isOwner, isSuperAdmin) {
  // Priority: is_owner flag > is_super_admin flag > role string
  if (isOwner || role === "owner") return ROLE_DISPLAY_MAP.owner;
  if (isSuperAdmin || role === "super_admin") return ROLE_DISPLAY_MAP.super_admin;
  return ROLE_DISPLAY_MAP[role] || role || "Usuario";
}

export default function DashboardHeader({ user, onMenuClick, onLogout, logoUrl, schoolName }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef(null);

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const displayName = schoolName || user?.name || "Admin";
  const userPhoto = user?.photo_url;
  const userName = user?.name || "Usuario";
  const userRole = getRoleDisplay(user?.role, user?.is_owner, user?.is_super_admin);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <header className="glass-header sticky top-0 z-30 px-4 md:px-6 lg:px-8" data-testid="dashboard-header">
      <div className="flex items-center justify-between h-24">
        {/* Left: Hamburger + Logo + Welcome */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            data-testid="header-menu-button"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Logo - from settings or fallback */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={displayName}
              className="h-16 w-auto object-contain"
              data-testid="header-logo"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="h-14 w-14 bg-[#001f4b] rounded-xl flex items-center justify-center" data-testid="header-logo-placeholder">
              <GraduationCap className="w-7 h-7 text-[#e1b82c]" />
            </div>
          )}
          
          <div>
            <h2 className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="header-welcome">
              Bienvenido, {displayName}
            </h2>
            <p className="text-xs text-slate-500 capitalize">{today}</p>
          </div>
        </div>

        {/* Right: Search + Notifications + Avatar */}
        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative flex items-center" data-testid="header-search-container">
            {searchOpen ? (
              <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden animate-fade-in-up">
                <Search className="w-4 h-4 text-slate-400 ml-3 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar alumnos, cursos, eventos..."
                  className="w-56 md:w-72 px-3 py-2.5 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
                  data-testid="header-search-input"
                />
                <button
                  onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 mr-1"
                  data-testid="header-search-close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#001f4b] hover:bg-slate-100 transition-colors"
                data-testid="header-search-button"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>

          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#001f4b] hover:bg-slate-100 transition-colors relative"
            data-testid="header-notifications-button"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#e1b82c] rounded-full" />
          </button>

          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">{userName}</p>
              <p className="text-[11px] text-slate-500">{userRole}</p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#e1b82c]/30" data-testid="header-avatar">
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={userName}
                  className="w-full h-full object-cover"
                  onError={(e) => { 
                    e.target.style.display = 'none';
                    e.target.nextSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`w-full h-full ${userPhoto ? 'hidden' : ''}`}>
                <DefaultAvatar name={userName} size="w-full h-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
