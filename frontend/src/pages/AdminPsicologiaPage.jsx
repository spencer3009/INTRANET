import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import PsicologiaPage from "./PsicologiaPage";
import AdminSidebar from "../components/AdminSidebar";
import DashboardHeader from "../components/DashboardHeader";

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminPsicologiaPage({ user, token, onLogout }) {
  const { subdomain: routeSubdomain } = useParams();
  const subdomain = routeSubdomain || user?.subdomain;
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [canWrite, setCanWrite] = useState(true);
  const [schoolSettings, setSchoolSettings] = useState(null);
  const base = subdomain ? `/${subdomain}` : "";

  useEffect(() => {
    axios.get(`${API}/api/settings/public/${subdomain || user?.subdomain}`).then(r => setSchoolSettings(r.data)).catch(() => {});
    const isOwner = user?.is_owner || user?.role === "owner";
    if (isOwner) { setCanWrite(true); return; }
    const check = async () => {
      try {
        const res = await axios.get(`${API}/api/settings/health-permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCanWrite(res.data.admin_can_manage === true);
      } catch { setCanWrite(false); }
    };
    check();
  }, [token, user]);

  const schoolName = schoolSettings?.system_name || user?.school_name || "EduNet";
  const logoUrl = schoolSettings?.logo_url;

  return (
    <PsicologiaPage
      user={user}
      token={token}
      onLogout={onLogout}
      canWrite={canWrite}
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
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
        />
      )}
    />
  );
}
