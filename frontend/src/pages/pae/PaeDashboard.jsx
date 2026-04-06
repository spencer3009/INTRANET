import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  UtensilsCrossed, QrCode, Clock, Users, RefreshCw, Loader2,
  ChevronRight, AlertCircle, CheckCircle2, LogOut
} from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PaeDashboard({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [selectedTurno, setSelectedTurno] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  const loadDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/pae/registro/dashboard`, { headers });
      setDashboard(res.data);
      // Auto-select first turno if none selected
      if (!selectedTurno && res.data.conteo_por_turno?.length > 0) {
        setSelectedTurno(res.data.conteo_por_turno[0].turno_id);
      }
    } catch (err) {
      console.error("Error loading PAE dashboard:", err);
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
    const basePath = subdomain ? `/${subdomain}/pae/scanner` : '/pae/scanner';
    navigate(`${basePath}?turno=${selectedTurno}`);
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return ""; }
  };

  const today = new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  const turnos = dashboard?.conteo_por_turno || [];
  const ultimos = dashboard?.ultimos_registros || [];
  const totalHoy = turnos.reduce((s, t) => s + t.total, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="pae-dashboard">
      {/* Sidebar reducido */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-16 flex-col bg-[#0f1b2d] z-50">
        <div className="flex items-center justify-center h-16 border-b border-white/10">
          <UtensilsCrossed className="w-6 h-6 text-orange-400" />
        </div>
        <nav className="flex-1 py-4 px-2 space-y-2">
          <button
            className="w-full flex items-center justify-center h-11 rounded-xl bg-orange-500/20 text-orange-400"
            title="Alimentación"
            data-testid="sidebar-pae"
          >
            <UtensilsCrossed className="w-5 h-5" />
          </button>
        </nav>
        <div className="border-t border-white/10 p-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center h-11 rounded-xl text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
            title="Cerrar sesión"
            data-testid="pae-logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-16">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center lg:hidden">
                <UtensilsCrossed className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800" data-testid="pae-title">Programa de Alimentacion Escolar</h1>
                <p className="text-sm text-slate-500 capitalize">{today}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadDashboard}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                title="Actualizar"
                data-testid="pae-refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-slate-600 font-medium">{user?.name}</span>
              </div>
              <button onClick={onLogout} className="lg:hidden p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
          {/* Turno selector + scan button */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" data-testid="pae-turno-selector">
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
                          ? "border-orange-500 bg-orange-50 shadow-sm"
                          : "border-slate-200 hover:border-orange-300 bg-white"
                      }`}
                      data-testid={`turno-${t.turno_id}`}
                    >
                      {selectedTurno === t.turno_id && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-5 h-5 text-orange-500" />
                        </div>
                      )}
                      <p className="font-bold text-slate-800">{t.turno_nombre}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {t.hora_inicio} - {t.hora_fin}
                      </p>
                      <p className="text-2xl font-bold text-orange-600 mt-2">{t.total}</p>
                      <p className="text-xs text-slate-400">registros hoy</p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleStartScan}
                  disabled={!selectedTurno}
                  className="w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  data-testid="pae-start-scan"
                >
                  <QrCode className="w-6 h-6" />
                  Iniciar Escaneo
                </button>
              </>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-5 text-white shadow-lg">
              <Users className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-3xl font-bold">{totalHoy}</p>
              <p className="text-sm text-orange-100">Total Hoy</p>
            </div>
            {turnos.map((t) => (
              <div key={t.turno_id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <UtensilsCrossed className="w-6 h-6 text-orange-500 mb-2" />
                <p className="text-2xl font-bold text-slate-800">{t.total}</p>
                <p className="text-xs text-slate-500">{t.turno_nombre}</p>
              </div>
            ))}
          </div>

          {/* Last records */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" data-testid="pae-recent-records">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Ultimos Registros</h2>
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
                        {r.metadata?.grado} {r.metadata?.seccion && `- ${r.metadata.seccion}`}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{formatTime(r.hora_registro)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
