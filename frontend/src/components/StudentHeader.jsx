import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Menu, User, ChevronDown, LogOut, GraduationCap } from "lucide-react";
import NotificationBell from "./NotificationBell";

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

export default function StudentHeader({ user, onMenuClick, onLogout, logoUrl, schoolName, subdomain, token, roleLabel = "Alumno", profilePath = "/student/profile" }) {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const capitalizedToday = today.charAt(0).toUpperCase() + today.slice(1);

  const displayName = schoolName || "Portal";
  const userPhoto = user?.photo_url;
  const userName = user?.name || "Usuario";
  const userLastName = user?.last_name || "";
  const fullName = userLastName ? `${userName} ${userLastName}` : userName;
  const userEmail = user?.email || "";

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
    navigate(`${subdomain ? `/${subdomain}` : ""}${profilePath}`);
  };

  const handleLogoutClick = () => { setProfileMenuOpen(false); onLogout(); };

  return (
    <header className="glass-header sticky top-0" style={{ zIndex: 100 }} data-testid="student-header">
      {/* Row 1: Controls — hamburger, logo, notifications, avatar */}
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors" data-testid="student-header-menu-button">
            <Menu className="w-5 h-5" />
          </button>
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} className="h-10 w-auto object-contain" data-testid="student-header-logo" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="h-10 w-10 bg-[#001f4b] rounded-xl flex items-center justify-center" data-testid="student-header-logo-placeholder">
              <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
            </div>
          )}
          {/* Desktop: show full welcome text inline */}
          <div className="hidden lg:block">
            <h2 className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>Bienvenido, {displayName}</h2>
            <p className="text-xs text-slate-500">{capitalizedToday}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell token={token} />
          <div className="relative" ref={profileMenuRef}>
            <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity" data-testid="student-header-profile-button">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#e1b82c]/30" data-testid="student-header-avatar">
                {userPhoto ? (
                  <img src={userPhoto} alt={userName} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList.remove('hidden'); }} />
                ) : null}
                <div className={`w-full h-full ${userPhoto ? 'hidden' : ''}`}><DefaultAvatar name={fullName} size="w-full h-full" textSize="text-xs" /></div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden sm:block ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in-up" data-testid="student-header-profile-dropdown">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-slate-800 truncate">{fullName}</p>
                  <p className="text-xs text-slate-500">{userEmail}</p>
                </div>
                <div className="py-1">
                  <button onClick={handleProfileClick} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors" data-testid="student-header-dropdown-profile">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><User className="w-4 h-4 text-blue-600" /></div>
                    <span className="font-medium">Mi Perfil</span>
                  </button>
                  <button onClick={handleLogoutClick} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-3 transition-colors" data-testid="student-header-dropdown-logout">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><LogOut className="w-4 h-4 text-red-500" /></div>
                    <span className="font-medium">Cerrar sesi&oacute;n</span>
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
        <h2 className="text-lg font-semibold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="student-header-welcome">{displayName}</h2>
        <p className="text-sm text-slate-400">{capitalizedToday}</p>
      </div>
    </header>
  );
}
