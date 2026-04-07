import { useState } from "react";
import CoordinacionSidebar from "@/components/coordinacion/CoordinacionSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import MobileBottomNav from "@/components/MobileBottomNav";

export default function CoordinacionLayout({ children, user, token, onLogout, activeSection }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        />
        <main className="flex-1 p-4 md:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomNav role="coordinator" />
    </div>
  );
}
