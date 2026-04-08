import { useState, useEffect } from "react";
import axios from "axios";
import CoordinacionSidebar from "@/components/coordinacion/CoordinacionSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import MobileBottomNav from "@/components/MobileBottomNav";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CoordinacionLayout({ children, user, token, onLogout, activeSection }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/api/school/info`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setLogoUrl(r.data?.logo_url || null))
      .catch(() => {});
  }, [token]);

  return (
    <div className="flex min-h-screen bg-slate-50" data-testid="coordinacion-layout">
      <CoordinacionSidebar
        active={activeSection}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        schoolName={user?.school_name}
        subdomain={user?.subdomain}
        token={token}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onLogout={onLogout}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          logoUrl={logoUrl}
          schoolName={user?.school_name}
          subdomain={user?.subdomain}
          token={token}
        />
        <main className="flex-1 p-4 md:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomNav role="coordinator" />
    </div>
  );
}
