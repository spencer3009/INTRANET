import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { Lock, Loader2, AlertTriangle, CheckCircle2, Archive } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminCierreAnoPage({ user, token, subdomain, onLogout }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [sectionId, setSectionId] = useState("");
  const [sections, setSections] = useState([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/academic/sections`, { headers });
        setSections(r.data || []);
      } catch {
        setSections([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doClose = async (force = false) => {
    setRunning(true);
    setResult(null);
    try {
      const url = `${API}/libreta/close-year${force ? "?force=true" : ""}`;
      const res = await axios.post(
        url,
        { year, section_id: sectionId || null },
        { headers }
      );
      setResult({ ok: true, data: res.data });
    } catch (err) {
      const detail = err.response?.data?.detail;
      // 409 => alumnos ya cerrados
      if (err.response?.status === 409) {
        setResult({ ok: false, status: 409, data: detail });
      } else {
        setResult({ ok: false, status: err.response?.status, message: typeof detail === "string" ? detail : "Error inesperado" });
      }
    } finally {
      setRunning(false);
      setShowConfirm(false);
    }
  };

  if (user?.role !== "owner") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" data-testid="cierre-ano-no-owner">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
          <Lock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Acceso restringido</h2>
          <p className="text-sm text-slate-500">Solo el owner puede cerrar el año académico.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="cierre-ano-page">
      <Sidebar
        active="cierre-anio"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName="EduNet"
        subdomain={subdomain}
        user={user}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={user} onLogout={onLogout} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 p-6 lg:p-10">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Archive className="w-7 h-7 text-purple-600" />
              <h1 className="text-2xl font-bold text-slate-800">Cierre de Año Académico</h1>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value || "0", 10))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    data-testid="cierre-ano-year-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sección (opcional)</label>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    data-testid="cierre-ano-section-select"
                  >
                    <option value="">Todas las secciones</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre} ({s.id.slice(0, 6)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={running || !year}
                className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-semibold text-lg flex items-center justify-center gap-3"
                data-testid="cierre-ano-trigger-btn"
              >
                {running && <Loader2 className="w-5 h-5 animate-spin" />}
                Cerrar Año Académico {year}
              </button>

              {showConfirm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="cierre-ano-confirm-box">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-900 font-semibold mb-1">¿Estás seguro?</p>
                      <p className="text-sm text-amber-800">
                        Esta acción congelará las libretas de {sectionId ? "los alumnos de la sección seleccionada" : "TODOS los alumnos del colegio"} del año <strong>{year}</strong>. Después del cierre, las notas, conducta, comentarios y situación final NO podrán modificarse sin abrir el snapshot manualmente.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => doClose(false)}
                          disabled={running}
                          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
                          data-testid="cierre-ano-confirm-btn"
                        >
                          Sí, cerrar año
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowConfirm(false)}
                          className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium"
                          data-testid="cierre-ano-cancel-btn"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {result?.ok && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4" data-testid="cierre-ano-success">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-emerald-900 font-semibold mb-1">Cierre exitoso</p>
                      <ul className="text-sm text-emerald-800 space-y-0.5">
                        <li>Creados: <strong>{result.data.snapshots_created}</strong></li>
                        <li>Sobrescritos: <strong>{result.data.snapshots_overwritten}</strong></li>
                        <li>Saltados: <strong>{result.data.snapshots_skipped_existing}</strong></li>
                        <li>Total alumnos: <strong>{result.data.total_students}</strong></li>
                        {result.data.errors?.length > 0 && (
                          <li className="text-red-700">Errores: {result.data.errors.length}</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {result && !result.ok && result.status === 409 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="cierre-ano-conflict">
                  <p className="text-sm text-amber-900 font-semibold mb-2">
                    Ya existen snapshots para todos los alumnos.
                  </p>
                  <p className="text-sm text-amber-800 mb-3">
                    Skipped: {result.data?.snapshots_skipped_existing ?? "?"}
                  </p>
                  <button
                    type="button"
                    onClick={() => doClose(true)}
                    disabled={running}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
                    data-testid="cierre-ano-force-btn"
                  >
                    Sobrescribir (force=true)
                  </button>
                </div>
              )}

              {result && !result.ok && result.status !== 409 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700" data-testid="cierre-ano-error">
                  {result.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
