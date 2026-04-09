import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import DashboardHeader from "../../components/DashboardHeader";
import QRScannerTab from "../../components/QRScannerTab";
import { ArrowLeft } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuxAsistenciaScanner({ user, token }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  const subdomain = user?.subdomain;
  const basePath = subdomain ? `/${subdomain}` : "";

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await axios.get(`${API}/school/info`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSettings(res.data);
      } catch {}
    };
    loadSettings();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="aux-asistencia-scanner">
      <Sidebar
        active="aux-escanear"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={() => {}}
        schoolName={settings?.school_name}
        subdomain={subdomain}
        token={token}
        user={user}
      />

      <div className="flex-1 min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={() => {}}
          logoUrl={settings?.logo_url}
          schoolName={settings?.school_name}
          subdomain={subdomain}
          token={token}
        />

        <main className="p-4 sm:p-6 lg:p-8">
          <button
            onClick={() => navigate(`${basePath}/aux-asistencia`)}
            className="flex items-center gap-2 text-slate-500 hover:text-sky-600 transition-colors mb-4"
            data-testid="btn-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver al inicio</span>
          </button>

          <h1
            className="text-2xl font-bold text-slate-800 mb-6"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Escanear Asistencia
          </h1>

          <QRScannerTab token={token} user={user} />
        </main>
      </div>
    </div>
  );
}
