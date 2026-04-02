import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import TopicoPage from "./TopicoPage";
import TeacherSidebar from "../components/TeacherSidebar";
import StudentHeader from "../components/StudentHeader";

const API = process.env.REACT_APP_BACKEND_URL;

export default function TeacherTopicoPage({ user, token, onLogout }) {
  const { subdomain: routeSubdomain } = useParams();
  const subdomain = routeSubdomain || user?.subdomain;
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const base = subdomain ? `/${subdomain}` : "";

  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${API}/api/settings/health-permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCanWrite(res.data.teacher_can_manage === true);
      } catch { setCanWrite(false); }
    };
    check();
  }, [token]);

  return (
    <TopicoPage
      user={user}
      token={token}
      onLogout={onLogout}
      canWrite={canWrite}
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
