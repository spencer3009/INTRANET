import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { Lock, Loader2, AlertTriangle, CheckCircle2, Archive, History, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminCierreBimestrePage({ user, token, subdomain, onLogout, embedded = false, onClosePeriod }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
      const r = await axios.get(`${API}/libreta/admin/closed-periods`, { headers })
        .catch(() => ({ data: { history: [] } }));
      setHistory(Array.isArray(r.data?.history) ? r.data.history : []);
    } finally { setLoadingHistory(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPeriods();
    loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, []);

  const doClose = async (force = false) => {
    setRunning(true);
    setResult(null);
    try {
      const url = `${API}/libreta/close-period${force ? "?force=true" : ""}`;
      const res = await axios.post(url, { period_id: selectedPeriodId, section_id: sectionId || null }, { headers });
      setResult({ ok: true, data: res.data });
      if (onClosePeriod) {
        try { onClosePeriod({ period_id: selectedPeriodId, ...res.data }); } catch { /* noop */ }
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409) {
        setResult({ ok: false, status: 409, data: detail });
      } else {
        setResult({ ok: false, status: err.response?.status, message: typeof detail === "string" ? detail : "Ocurrió un problema al cerrar el bimestre. Intenta nuevamente." });
      }
    } finally {
      setRunning(false);
      setShowConfirm(false);
      loadHistory();
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
      loadHistory();
    } catch (err) {
      setResult({ ok: false, message: err.response?.data?.detail || "Ocurrió un problema al reabrir el bimestre. Intenta nuevamente." });
    } finally { setRunning(false); }
  };

  // ── Computed helpers (hooks deben llamarse antes de cualquier early return)
  const NIVEL_ORDER = { INICIAL: 1, PRIMARIA: 2, SECUNDARIA: 3 };
  const normalize = (s) => (s || "").toString().trim();
  const titleCase = (s) => {
    const t = normalize(s).toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const sectionLabel = useCallback((s) => {
    if (!s) return "";
    const grado = normalize(s.grado_nombre) || "—";
    const sec = normalize(s.nombre) || "—";
    const nivel = titleCase(s.nivel_nombre) || "—";
    return `${grado} ${sec} ${nivel}`.replace(/\s+/g, " ").trim();
  }, []);

  const sortedSections = useMemo(() => {
    const arr = [...(sections || [])];
    arr.sort((a, b) => {
      const na = NIVEL_ORDER[(a.nivel_nombre || "").toUpperCase()] ?? 99;
      const nb = NIVEL_ORDER[(b.nivel_nombre || "").toUpperCase()] ?? 99;
      if (na !== nb) return na - nb;
      const ga = (a.grado_nombre || "").localeCompare(b.grado_nombre || "", "es", { numeric: true });
      if (ga !== 0) return ga;
      return (a.nombre || "").localeCompare(b.nombre || "", "es");
    });
    const seen = new Map();
    arr.forEach(s => { const k = sectionLabel(s); seen.set(k, (seen.get(k) || 0) + 1); });
    return arr.map(s => ({
      ...s,
      _label: sectionLabel(s) + (seen.get(sectionLabel(s)) > 1 ? ` (id: ${(s.id || "").slice(0, 6)}…)` : ""),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, sectionLabel]);

  const selectedSection = useMemo(
    () => sortedSections.find(s => s.id === sectionId) || null,
    [sortedSections, sectionId]
  );

  if (user?.role !== "owner") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" data-testid="cierre-bim-no-owner">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
          <Lock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Acceso restringido</h2>
          <p className="text-sm text-slate-500">Solo el propietario puede cerrar bimestres.</p>
        </div>
      </div>
    );
  }

  const periodName = periods.find(p => p.id === selectedPeriodId)?.nombre || "—";

  const targetScopeLabel = selectedSection
    ? `LA SECCIÓN ${(selectedSection._label || "").toUpperCase()}`
    : "TODO EL COLEGIO";
  const buttonLabel = selectedSection
    ? `Cerrar ${periodName} para ${selectedSection._label}`
    : `Cerrar ${periodName} para todo el colegio`;

  return (
    <div className={embedded ? "bg-slate-50" : "min-h-screen bg-slate-50 flex"} data-testid="cierre-bim-page">
      {!embedded && (
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
      )}
      <main className={embedded ? "flex-1 flex flex-col min-w-0" : "flex-1 flex flex-col min-w-0"}>
        {!embedded && (
          <DashboardHeader user={user} onLogout={onLogout} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        )}
        <div className={embedded ? "flex-1 p-4" : "flex-1 p-6 lg:p-10"}>
          <div className={embedded ? "w-full" : "max-w-3xl mx-auto"}>
            {!embedded && (
              <div className="flex items-center gap-3 mb-6">
                <Archive className="w-7 h-7 text-purple-600" />
                <h1 className="text-2xl font-bold text-slate-800">Cierre de Bimestre</h1>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
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

              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={running || !selectedPeriodId}
                className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-semibold text-lg flex items-center justify-center gap-3"
                data-testid="cierre-bim-trigger-btn"
              >
                {running && <Loader2 className="w-5 h-5 animate-spin" />}
                {buttonLabel}
              </button>

              {/* Opciones avanzadas (colapsable) */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                  data-testid="cierre-bim-advanced-toggle"
                >
                  {advancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  Opciones avanzadas
                </button>
                {advancedOpen && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4" data-testid="cierre-bim-advanced-panel">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cerrar solo una sección específica</label>
                    <select
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                      data-testid="cierre-bim-section-select"
                    >
                      <option value="">— Selecciona una sección —</option>
                      {sortedSections.map(s => (
                        <option key={s.id} value={s.id}>{s._label}</option>
                      ))}
                    </select>
                    {sectionId && (
                      <button
                        type="button"
                        onClick={() => setSectionId("")}
                        className="mt-2 text-xs text-slate-500 hover:text-slate-800 underline"
                        data-testid="cierre-bim-clear-section"
                      >
                        Quitar selección (volver a "todo el colegio")
                      </button>
                    )}
                  </div>
                )}
              </div>

              {showConfirm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="cierre-bim-confirm-box">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-900 font-semibold mb-1">¿Estás seguro?</p>
                      <p className="text-sm text-amber-800">
                        Esta acción congelará las libretas del <strong>{periodName}</strong> para <strong>{targetScopeLabel}</strong>.
                      </p>
                      <p className="text-sm text-amber-800 mt-2">
                        Las notas, comentarios del tutor y conducta de este bimestre <strong>NO podrán modificarse</strong> después del cierre, salvo reapertura manual por el propietario.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button type="button" onClick={() => doClose(false)} disabled={running} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium" data-testid="cierre-bim-confirm-btn">Confirmar cierre de {periodName}</button>
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
                      <p className="text-sm text-emerald-900 font-semibold mb-1">Cierre exitoso del {result.data.period_name}</p>
                      <ul className="text-sm text-emerald-800 space-y-0.5">
                        <li>Libretas cerradas por primera vez: <strong>{result.data.snapshots_created}</strong></li>
                        <li>Libretas vueltas a generar: <strong>{result.data.snapshots_overwritten}</strong></li>
                        <li>Libretas que ya estaban cerradas: <strong>{result.data.snapshots_skipped_existing}</strong></li>
                        <li>Total de alumnos procesados: <strong>{result.data.total_students}</strong></li>
                        {result.data.errors?.length > 0 && (<li className="text-red-700">Alumnos con error: {result.data.errors.length}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {result && !result.ok && result.status === 409 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="cierre-bim-conflict">
                  <p className="text-sm text-amber-900 font-semibold mb-2">Las libretas de este bimestre ya están cerradas.</p>
                  <p className="text-sm text-amber-800 mb-3">
                    Ya cerrados: <strong>{result.data?.snapshots_skipped_existing ?? "—"} alumnos</strong>. Si necesitas actualizar las notas o conducta del bimestre, vuelve a generar las libretas (esto sobrescribirá las versiones existentes).
                  </p>
                  <button type="button" onClick={() => doClose(true)} disabled={running} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium" data-testid="cierre-bim-force-btn">Volver a generar las libretas</button>
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
                <div className="mb-4 space-y-2 text-sm">
                  <p className="text-slate-700">
                    Esta acción <b>quita el candado</b> del bimestre para que el tutor pueda volver a editar notas, conducta y comentarios. Queda registrada en el historial de auditoría.
                  </p>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-900">
                    <b>Tus datos están a salvo:</b> NO se borran las notas, asistencia ni conducta. Solo se elimina la "foto" del cierre — todas las notas registradas siguen ahí intactas y se podrán seguir editando hasta que vuelvas a cerrar el bimestre.
                  </div>
                </div>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Motivo obligatorio (ejemplo: corrección de notas del curso de Matemática)..."
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
                  No hay bimestres cerrados en este colegio. Cuando cierres un bimestre, aparecerá aquí con un botón "Reabrir" por si necesitas revertirlo.
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
