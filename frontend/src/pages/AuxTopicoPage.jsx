import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Home, LogOut, Menu } from "lucide-react";
import TopicoPage from "./TopicoPage";
import DashboardHeader from "../components/DashboardHeader";

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Minimal sidebar for the Auxiliar de Tópico (nurse) role.
 * Only exposes a single "Inicio" item that navigates back to the Tópico dashboard.
 */
function AuxTopicoSidebar({ expanded, onToggle, onLogout, schoolName, subdomain }) {
  const navigate = useNavigate();
  const base = subdomain ? `/${subdomain}` : "";
  const goHome = () => navigate(`${base}/topico`);

  return (
    <aside
      className={`h-screen bg-gradient-to-b from-blue-600 to-blue-800 text-white transition-all duration-300 ${
        expanded ? "w-64" : "w-16"
      } flex flex-col shadow-xl shrink-0 sticky top-0`}
      data-testid="aux-topico-sidebar"
    >
      {/* Toggle / school header */}
      <button
        onClick={onToggle}
        className="px-4 py-5 flex items-center gap-3 border-b border-white/10 hover:bg-white/5 transition-colors text-left"
        data-testid="aux-topico-sidebar-toggle"
      >
        <Menu className="w-5 h-5 shrink-0" />
        {expanded && (
          <span className="text-sm font-bold truncate">{schoolName || "Portal Tópico"}</span>
        )}
      </button>

      {/* Single menu item: Inicio */}
      <nav className="flex-1 py-4">
        <button
          onClick={goHome}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white/15 hover:bg-white/20 transition-colors text-sm font-bold"
          data-testid="aux-topico-sidebar-home"
          title="Inicio"
        >
          <Home className="w-5 h-5 shrink-0" />
          {expanded && <span>Inicio</span>}
        </button>
      </nav>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="flex items-center gap-3 px-4 py-4 border-t border-white/10 hover:bg-white/10 transition-colors text-sm"
        data-testid="aux-topico-sidebar-logout"
        title="Cerrar sesión"
      >
        <LogOut className="w-5 h-5 shrink-0" />
        {expanded && <span>Cerrar sesión</span>}
      </button>
    </aside>
  );
}

export default function AuxTopicoPage({ user, token, onLogout }) {
  const { subdomain: routeSubdomain } = useParams();
  const subdomain = routeSubdomain || user?.subdomain;
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState(null);

  useEffect(() => {
    if (!subdomain) return;
    axios
      .get(`${API}/api/settings/public/${subdomain}`)
      .then((r) => setSchoolSettings(r.data))
      .catch(() => {});
  }, [subdomain]);

  const schoolName = schoolSettings?.system_name || user?.school_name || "Tópico";
  const logoUrl = schoolSettings?.logo_url;

  return (
    <TopicoPage
      user={user}
      token={token}
      onLogout={onLogout}
      canWrite={true}
      hideBack={true}
      backPath={subdomain ? `/${subdomain}/topico` : "/topico"}
      renderSidebar={() => (
        <AuxTopicoSidebar
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          schoolName={schoolName}
          subdomain={subdomain}
        />
      )}
      renderHeader={() => (
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
        />
      )}
    />
  );
}
