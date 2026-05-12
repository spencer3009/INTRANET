import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { Lock, Loader2, AlertTriangle, CheckCircle2, Archive, History, RotateCcw } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminCierreBimestrePage({ user, token, subdomain, onLogout }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // Reopen flow
  const [reopenTarget, setReopenTarget] = useState(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenConfirmed, setReopenConfirmed] = useState(false);

  const loadPeriods = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/academic/periods`, { headers });
      const items = Array.isArray(r.data) ? r.data : (r.data?.periods || []);
      const sorted = [...items].sort((a, b) => (a.orden || 0) - (b.orden || 0));
      setPeriods(sorted);
      const active = sorted.find(p => p.activo);
      if (active && !selectedPeriodId) setSelectedPeriodId(active.id);
    } catch { setPeriods([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSections = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/academic/sections`, { headers });
      setSections(r.data || []);
    } catch { setSections([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      // No hay endpoint dedicado: agrupamos desde snapshots
      const r = await axios.get(`${API}/libreta/closed-periods/${user?.id || ""}`, { headers })
        .catch(() => ({ data: { closed_periods: [] } }));
      // Histórico simple por consulta global (owner): pedir cada bimestre de cada sección
      const all = [];
      for (const sec of (sections || [])) {
        for (const p of (periods || [])) {
          try {
            // Para histórico global, usar mongo directo no es posible desde UI; pedir count vía libreta closed-periods
            // Mejor: dejar registro de "última fecha de cierre por sección+periodo" cuando el owner ejecuta cierres
            // Por ahora, dejamos solo el resultado del último cierre realizado en esta sesión
          } catch { /* ignore */ }
        }
      }
      setHistory(all);
    } finally { setLoadingHistory(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, periods]);

  useEffect(() => {
    loadPeriods();
    loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (periods.length && sections.length) loadHistory(); /* eslint-disable-next-line */ }, [periods, sections]);

  const doClose = async (force = false) => {
    setRunning(true);
    setResult(null);
    try {
      const url = `${API}/libreta/close-period${force ? "?force=true" : ""}`;
      const res = await axios.post(url, { period_id: selectedPeriodId, section_id: sectionId || null }, { headers });
      setResult({ ok: true, data: res.data });
    } catch (err) {
      const detail = err.response?.data?.detail;
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

  const doReopen = async () => {
    if (!reopenTarget || !reopenReason.trim() || !reopenConfirmed) return;
    setRunning(true);
    try {
      await axios.delete(`${API}/libreta/close-period`, {
        headers,
        data: {
          period_id: reopenTarget.period_id,
          section_id: reopenTarget.section_id || null,
          reason: reopenReason.trim(),
        },
      });
      setResult({ ok: true, data: { reopened: true, period_name: reopenTarget.period_name } });
      setReopenTarget(null);
      setReopenReason("");
      setReopenConfirmed(false);
    } catch (err) {
      setResult({ ok: false, message: err.response?.data?.detail || "Error al reabrir" });
    } finally { setRunning(false); }
  };

  if (user?.role !== "owner") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" data-testid="cierre-bim-no-owner">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
          <Lock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Acceso restringido</h2>
          <p className="text-sm text-slate-500">Solo el owner puede cerrar bimestres.</p>
        </div>
      </div>
    );
  }

  const periodName = periods.find(p => p.id === selectedPeriodId)?.nombre || "—";
  const sectionLabel = sectionId ? (sections.find(s => s.id === sectionId)?.nombre || sectionId) : "todas las secciones";

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="cierre-bim-page">
      <Sidebar
        active="cierre-bimestre"
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
              <h1 className="text-2xl font-bold text-slate-800">Cierre de Bimestre</h1>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bimestre</label>
                  <select
                    value={selectedPeriodId}
                    onChange={(e) => setSelectedPeriodId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    data-testid="cierre-bim-period-select"
                  >
                    {periods.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} {p.activo ? "· activo" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sección (opcional)</label>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    data-testid="cierre-bim-section-select"
                  >
                    <option value="">Todas las secciones</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={running || !selectedPeriodId}
                className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-semibold text-lg flex items-center justify-center gap-3"
                data-testid="cierre-bim-trigger-btn"
              >
                {running && <Loader2 className="w-5 h-5 animate-spin" />}
                Cerrar Bimestre
              </button>

              {showConfirm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="cierre-bim-confirm-box">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-900 font-semibold mb-1">¿Estás seguro?</p>
                      <p className="text-sm text-amber-800">
                        Esta acción congelará las libretas del <strong>{periodName}</strong> para <strong>{sectionLabel}</strong>. Las notas, comentarios y conducta de este bimestre NO podrán modificarse después del cierre.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button type="button" onClick={() => doClose(false)} disabled={running} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium" data-testid="cierre-bim-confirm-btn">Confirmar cierre</button>
                        <button type="button" onClick={() => setShowConfirm(false)} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium" data-testid="cierre-bim-cancel-btn">Cancelar</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {result?.ok && result.data?.snapshots_created !== undefined && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4" data-testid="cierre-bim-success">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-emerald-900 font-semibold mb-1">Cierre exitoso de {result.data.period_name}</p>
                      <ul className="text-sm text-emerald-800 space-y-0.5">
                        <li>Creados: <strong>{result.data.snapshots_created}</strong></li>
                        <li>Sobrescritos: <strong>{result.data.snapshots_overwritten}</strong></li>
                        <li>Saltados: <strong>{result.data.snapshots_skipped_existing}</strong></li>
                        <li>Total alumnos: <strong>{result.data.total_students}</strong></li>
                        {result.data.errors?.length > 0 && (<li className="text-red-700">Errores: {result.data.errors.length}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {result && !result.ok && result.status === 409 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="cierre-bim-conflict">
                  <p className="text-sm text-amber-900 font-semibold mb-2">Ya existen snapshots para los alumnos del bimestre.</p>
                  <p className="text-sm text-amber-800 mb-3">Skipped: {result.data?.snapshots_skipped_existing ?? "?"}</p>
                  <button type="button" onClick={() => doClose(true)} disabled={running} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium" data-testid="cierre-bim-force-btn">Sobrescribir (force=true)</button>
                </div>
              )}

              {result && !result.ok && result.status !== 409 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700" data-testid="cierre-bim-error">{result.message}</div>
              )}
            </div>

            {/* Reopen flow */}
            {reopenTarget && (
              <div className="mt-6 bg-white rounded-2xl border border-red-200 p-6" data-testid="cierre-bim-reopen-box">
                <div className="flex items-center gap-2 mb-3">
                  <RotateCcw className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-slate-800">Reabrir {reopenTarget.period_name}</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Esta acción borra el snapshot y permite que el tutor edite nuevamente notas, conducta y comentarios. Queda registrado en el audit log.
                </p>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Razón obligatoria (ej: error en notas del curso de Matemática)..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none"
                  rows={3}
                  data-testid="cierre-bim-reopen-reason"
                />
                <label className="flex items-center gap-2 mt-3 text-sm">
                  <input type="checkbox" checked={reopenConfirmed} onChange={(e) => setReopenConfirmed(e.target.checked)} data-testid="cierre-bim-reopen-confirm" />
                  Confirmo que entiendo el impacto de reabrir este bimestre.
                </label>
                <div className="flex gap-2 mt-4">
                  <button type="button" disabled={running || !reopenReason.trim() || !reopenConfirmed} onClick={doReopen} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-sm font-medium" data-testid="cierre-bim-reopen-btn">Reabrir bimestre</button>
                  <button type="button" onClick={() => { setReopenTarget(null); setReopenReason(""); setReopenConfirmed(false); }} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium">Cancelar</button>
                </div>
              </div>
            )}

            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-semibold text-slate-800">Historial de cierres recientes</h3>
              </div>
              {loadingHistory ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  El historial detallado por sección requerirá un endpoint adicional (Fase 3). Por ahora puedes ver el estado actual de cada alumno en su libreta o vía <code className="bg-slate-100 px-1 rounded">GET /api/libreta/closed-periods/&lt;student_id&gt;</code>.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr><th>Bimestre</th><th>Sección</th><th>Fecha</th><th>Cerrado por</th><th>Alumnos</th><th></th></tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2">{h.period_name}</td>
                        <td>{h.section_name || "Todas"}</td>
                        <td>{new Date(h.closed_at).toLocaleString()}</td>
                        <td>{h.closed_by_name || h.closed_by}</td>
                        <td>{h.students}</td>
                        <td><button onClick={() => setReopenTarget(h)} className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-600">Reabrir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
