import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import DashboardHeader from "../../components/DashboardHeader";
import { QrCode, ClipboardList, Loader2, RefreshCw } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuxAsistenciaDashboard({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [scanCount, setScanCount] = useState(0);

  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;
  const basePath = subdomain ? `/${subdomain}` : "";

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await axios.get(`${API}/school/info`, { headers });
        setSettings(res.data);
      } catch {}
    };
    loadSettings();
  }, []);

  const loadScans = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/attendance/my-scans-today`, { headers });
      setScanCount(res.data.total || 0);
    } catch {
      setScanCount(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadScans(); }, [loadScans]);

  const today = new Date().toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const cards = [
    {
      title: "Escanear Asistencia",
      description: "Registra la asistencia de alumnos y profesores",
      icon: QrCode,
      color: "from-sky-500 to-blue-600",
      borderColor: "border-sky-200",
      iconBg: "bg-sky-100",
      iconColor: "text-sky-600",
      onClick: () => navigate(`${basePath}/aux-asistencia/escanear`),
      testId: "card-escanear",
    },
    {
      title: "Mis Asistencias de Hoy",
      description: "Ver las asistencias que registraste hoy",
      icon: ClipboardList,
      color: "from-emerald-500 to-teal-600",
      borderColor: "border-emerald-200",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      onClick: () => navigate(`${basePath}/aux-asistencia/mis-escaneos`),
      badge: scanCount > 0 ? `${scanCount} registradas hoy` : null,
      testId: "card-mis-escaneos",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="aux-asistencia-dashboard">
      <Sidebar
        active="aux-inicio"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name}
        subdomain={subdomain}
        token={token}
        user={user}
      />

      <div className="flex-1 min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.school_name}
          subdomain={subdomain}
          token={token}
        />

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
          </div>
        ) : (
          <main className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Welcome header */}
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-6 sm:p-8 text-white" data-testid="aux-welcome">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
                Bienvenido, {user?.name}
              </h1>
              <p className="text-sky-100 capitalize">{today}</p>
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {cards.map((card) => (
                <button
                  key={card.testId}
                  onClick={card.onClick}
                  data-testid={card.testId}
                  className={`group relative bg-white rounded-2xl border ${card.borderColor} p-6 sm:p-8 text-left hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
                >
                  <div className={`w-14 h-14 rounded-xl ${card.iconBg} flex items-center justify-center mb-5`}>
                    <card.icon className={`w-7 h-7 ${card.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                    {card.title}
                  </h3>
                  <p className="text-slate-500 text-sm">{card.description}</p>
                  {card.badge && (
                    <span className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {card.badge}
                    </span>
                  )}
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} opacity-5 rounded-bl-[80px] rounded-tr-2xl`}></div>
                </button>
              ))}
            </div>

            {/* Quick refresh */}
            <div className="flex justify-center">
              <button
                onClick={loadScans}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-sky-600 transition-colors"
                data-testid="btn-refresh-dashboard"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar datos
              </button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
