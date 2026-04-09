import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import DashboardHeader from "../../components/DashboardHeader";
import {
  ArrowLeft, RefreshCw, Loader2, ClipboardList,
  User, GraduationCap, Clock
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuxAsistenciaMisEscaneos({ user, token }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);

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

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/attendance/my-scans-today`, { headers });
      setRecords(res.data.records || []);
      setTotal(res.data.total || 0);
    } catch {
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const today = new Date().toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="aux-asistencia-mis-escaneos">
      <Sidebar
        active="aux-mis-escaneos"
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

        <main className="p-4 sm:p-6 lg:p-8 space-y-6">
          <button
            onClick={() => navigate(`${basePath}/aux-asistencia`)}
            className="flex items-center gap-2 text-slate-500 hover:text-sky-600 transition-colors"
            data-testid="btn-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver al inicio</span>
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>
              Mis Asistencias de Hoy
            </h1>
            <p className="text-slate-500 text-sm capitalize mt-1">{today}</p>
          </div>

          {/* Counter + Refresh */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-50 text-sky-700 text-sm font-semibold border border-sky-200" data-testid="scan-counter">
                <ClipboardList className="w-4 h-4" />
                Total de asistencias registradas hoy: {total}
              </span>
            </div>
            <button
              onClick={loadRecords}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              data-testid="btn-refresh-scans"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="empty-state">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay registros aun</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Aun no has registrado asistencias hoy. Comienza escaneando desde el panel principal.
              </p>
              <button
                onClick={() => navigate(`${basePath}/aux-asistencia/escanear`)}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors"
                data-testid="btn-go-scan"
              >
                Ir a escanear
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="scans-table">
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hora</th>
                      <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                      <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                      <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Grado / Seccion</th>
                      <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {r.entry_time || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                          {r.name} {r.last_name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            r.type === "teacher"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                          }`}>
                            {r.type === "teacher" ? (
                              <><User className="w-3 h-3" /> Profesor</>
                            ) : (
                              <><GraduationCap className="w-3 h-3" /> Alumno</>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {r.grade && r.section ? `${r.grade} - ${r.section}` : r.grade || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                            Presente
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-slate-100">
                {records.map((r, idx) => (
                  <div key={r.id || idx} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800 text-sm">{r.name} {r.last_name}</span>
                      <span className="text-xs text-slate-500">{r.entry_time || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.type === "teacher"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-cyan-50 text-cyan-700"
                      }`}>
                        {r.type === "teacher" ? "Profesor" : "Alumno"}
                      </span>
                      {r.grade && <span className="text-xs text-slate-400">{r.grade} {r.section ? `- ${r.section}` : ""}</span>}
                      <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                        Presente
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
