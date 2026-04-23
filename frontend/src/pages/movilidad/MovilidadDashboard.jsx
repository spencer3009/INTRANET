import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import DashboardHeader from "../../components/DashboardHeader";
import MobileBottomNav from "../../components/MobileBottomNav";
import { 
  Bus, QrCode, Clock, Users, RefreshCw, Loader2,
  CheckCircle2, AlertCircle, Settings
} from "lucide-react";
import { toast } from "sonner";
import MovilidadSettingsModal from "../../components/MovilidadSettingsModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MovilidadDashboard({ user, token, onLogout, onSwitchPortal }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [selectedTurno, setSelectedTurno] = useState(null);
  const [settings, setSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  // Load school settings for logo
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/school/info`, { headers });
        setSettings(res.data);
      } catch {}
    };
    loadSettings();
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/movilidad/registro/dashboard`, { headers });
      setDashboard(res.data);
      if (!selectedTurno && res.data.conteo_por_turno?.length > 0) {
        setSelectedTurno(res.data.conteo_por_turno[0].turno_id);
      }
    } catch (err) {
      console.error("Error loading Movilidad dashboard:", err);
      toast.error("Error al cargar datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleStartScan = () => {
    if (!selectedTurno) {
      toast.error("Selecciona un turno primero");
      return;
    }
    const basePath = subdomain ? `/${subdomain}/movilidad/scanner` : '/movilidad/scanner';
    navigate(`${basePath}?turno=${selectedTurno}`);
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    try {
      return new Date(isoStr).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return ""; }
  };

  const turnos = dashboard?.conteo_por_turno || [];
  const ultimos = dashboard?.ultimos_registros || [];
  const totalHoy = turnos.reduce((s, t) => s + t.total, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="movilidad-dashboard">
      <Sidebar
        active="movilidad"
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
          onSwitchPortal={onSwitchPortal}
          extraActions={
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              title="Configuración"
              data-testid="movilidad-gear-btn"
            >
              <Settings className="w-5 h-5" />
            </button>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
          </div>
        ) : (
          <main className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Turno selector + scan button */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" data-testid="movilidad-turno-selector">
              <h2 className="text-base font-bold text-slate-800 mb-4">Seleccionar Turno</h2>
              {turnos.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2" />
                  <p>No hay turnos configurados. Contacta al administrador.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                    {turnos.map((t) => (
                      <button
                        key={t.turno_id}
                        onClick={() => setSelectedTurno(t.turno_id)}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                          selectedTurno === t.turno_id
                            ? "border-purple-500 bg-purple-50 shadow-sm"
                            : "border-slate-200 hover:border-purple-300 bg-white"
                        }`}
                        data-testid={`turno-${t.turno_id}`}
                      >
                        {selectedTurno === t.turno_id && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle2 className="w-5 h-5 text-purple-500" />
                          </div>
                        )}
                        <p className="font-bold text-slate-800">{t.turno_nombre}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {t.hora_inicio} - {t.hora_fin}
                        </p>
                        <p className="text-2xl font-bold text-purple-600 mt-2">{t.total}</p>
                        <p className="text-xs text-slate-400">registros hoy</p>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleStartScan}
                    disabled={!selectedTurno}
                    className="w-full py-4 px-6 bg-gradient-to-r from-purple-500 to-violet-500 text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl hover:from-purple-600 hover:to-violet-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    data-testid="movilidad-start-scan"
                  >
                    <QrCode className="w-6 h-6" />
                    Iniciar Escaneo
                  </button>
                </>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-purple-500 to-violet-500 rounded-2xl p-5 text-white shadow-lg">
                <Users className="w-8 h-8 mb-2 opacity-80" />
                <p className="text-3xl font-bold">{totalHoy}</p>
                <p className="text-sm text-purple-100">Total Hoy</p>
              </div>
              {turnos.map((t) => (
                <div key={t.turno_id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <Bus className="w-6 h-6 text-purple-500 mb-2" />
                  <p className="text-2xl font-bold text-slate-800">{t.total}</p>
                  <p className="text-xs text-slate-500">{t.turno_nombre}</p>
                </div>
              ))}
            </div>

            {/* Last records */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" data-testid="movilidad-recent-records">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-800">Últimos Registros</h2>
              </div>
              {ultimos.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No hay registros hoy</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {ultimos.slice(0, 20).map((r, i) => (
                    <div key={r.id || i} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{r.metadata?.nombre_estudiante}</p>
                        <p className="text-xs text-slate-400">
                          {r.metadata?.grado} {r.metadata?.seccion && `- ${r.metadata.sección}`}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">{formatTime(r.hora_registro)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        )}
      </div>
      <MobileBottomNav role="auxiliar_movilidad" />
      <MovilidadSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        token={token}
        onLogout={onLogout}
        onSwitchPortal={onSwitchPortal}
      />
    </div>
  );
}
