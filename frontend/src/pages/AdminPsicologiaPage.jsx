import { useState } from "react";
import { useParams } from "react-router-dom";
import PsicologiaPage from "./PsicologiaPage";
import AdminSidebar from "../components/AdminSidebar";
import DashboardHeader from "../components/DashboardHeader";

export default function AdminPsicologiaPage({ user, token, onLogout }) {
  const { subdomain: routeSubdomain } = useParams();
  const subdomain = routeSubdomain || user?.subdomain;
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const base = subdomain ? `/${subdomain}` : "";

  return (
    <PsicologiaPage
      user={user}
      token={token}
      onLogout={onLogout}
      backPath={`${base}/admin/salud-bienestar`}
      renderSidebar={() => (
        <AdminSidebar
          active="salud-bienestar"
          onNavigate={() => {}}
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          schoolName={user?.school_name || "EduNet"}
          subdomain={subdomain}
          user={user}
        />
      )}
      renderHeader={() => (
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          schoolName={user?.school_name || "EduNet"}
          subdomain={subdomain}
        />
      )}
    />
  );
}
