import { useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { 
  LayoutDashboard, School, User, LogOut, Menu, X, 
  Headset, ChevronRight, Shield, DollarSign, BarChart3, Video
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/support", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/support/schools", icon: School, label: "Colegios" },
  { to: "/support/finances", icon: BarChart3, label: "Finanzas" },
  { to: "/support/pricing", icon: DollarSign, label: "Precios" },
  { type: "divider" },
  { to: "/support/academia", icon: Video, label: "Academia" },
  { type: "divider" },
  { to: "/support/profile", icon: User, label: "Mi Perfil" },
];

function DefaultAvatar({ name, size = "w-10 h-10" }) {
  const initials = name ? name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase() : "S";
  return (
    <div className={`${size} rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm`}>
      {initials}
    </div>
  );
}

export default function SupportLayout({ user, token, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    const sub = user?.subdomain;
    onLogout();
    navigate(sub ? `/${sub}/login` : "/login");
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex" data-testid="support-layout">
      {/* Mobile overlay - only covers content area, not sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 left-[260px] bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-[999] h-screen w-[260px] 
        bg-[#0a1628] text-white flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Headset className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight">EduNet</h1>
            <p className="text-[11px] text-emerald-400 font-medium">Panel de Soporte</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-1 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {user?.photo_url ? (
              <img src={user.photo_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <DefaultAvatar name={user?.name} />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name} {user?.last_name || ""}</p>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">Soporte Global</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item, idx) => {
            if (item.type === "divider") {
              return <div key={`div-${idx}`} className="my-2 border-t border-white/10" />;
            }
            return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200
                ${isActive 
                  ? "bg-emerald-500/15 text-emerald-400" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
                }
              `}
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span>{item.label}</span>
            </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            data-testid="support-logout-btn"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Cerrar Sesion</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 lg:px-6 h-16 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-xl"
            data-testid="support-menu-toggle"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold tracking-wide border border-emerald-200">
              SOPORTE GLOBAL
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:block">{user?.email}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
