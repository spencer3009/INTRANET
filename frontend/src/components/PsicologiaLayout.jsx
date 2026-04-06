import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import PsicologiaSidebar from "@/components/PsicologiaSidebar";

export default function PsicologiaLayout({ children, user, token, onLogout, activeSection }) {
  const { subdomain: routeSubdomain } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const subdomain = routeSubdomain || user?.subdomain;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const sub = subdomain || "";
        if (!sub) return;
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/public/${sub}`);
        if (res.ok) setSettings(await res.json());
      } catch(e) {}
    };
    fetchSettings();
  }, [subdomain]);

  const schoolName = settings?.system_name || "EduNet";
  const logoUrl = settings?.logo_url;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <PsicologiaSidebar
        active={activeSection}
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        schoolName={schoolName}
        subdomain={subdomain}
        token={token}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
          token={token}
        />
        <main className="flex-1 overflow-y-auto custom-scroll">
          {children}
        </main>
      </div>
    </div>
  );
}
