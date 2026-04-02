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
  const base = subdomain ? `/${subdomain}` : "";

  useEffect(() => {
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
          schoolName={user?.school_name || "EduNet"}
          subdomain={subdomain}
        />
      )}
    />
  );
}
