import { useState } from "react";
import { useParams } from "react-router-dom";
import PsicologiaPage from "./PsicologiaPage";
import TeacherSidebar from "../components/TeacherSidebar";
import StudentHeader from "../components/StudentHeader";

export default function TeacherPsicologiaPage({ user, token, onLogout }) {
  const { subdomain: routeSubdomain } = useParams();
  const subdomain = routeSubdomain || user?.subdomain;
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const base = subdomain ? `/${subdomain}` : "";

  return (
    <PsicologiaPage
      user={user}
      token={token}
      onLogout={onLogout}
      backPath={`${base}/teacher/salud-bienestar`}
      renderSidebar={() => (
        <TeacherSidebar
          active="salud-bienestar"
          onNavigate={() => {}}
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          schoolName={user?.school_name || "Portal Docente"}
          subdomain={subdomain}
          user={user}
        />
      )}
      renderHeader={() => (
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          schoolName={user?.school_name || "Portal Docente"}
          subdomain={subdomain}
          token={token}
          roleLabel="Docente"
          profilePath="/teacher/profile"
        />
      )}
    />
  );
}
