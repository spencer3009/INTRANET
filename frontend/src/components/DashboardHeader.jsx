import { useState, useRef, useEffect } from "react";
import { Search, Bell, Menu, X, GraduationCap } from "lucide-react";

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
              <p className="text-sm font-semibold text-slate-800">{user?.name || "Admin"}</p>
              <p className="text-[11px] text-slate-500">{user?.role || "Administrador"}</p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#e1b82c]/30" data-testid="header-avatar">
              <img
                src={user?.avatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200"}
                alt={user?.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/40?text=U'; }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
