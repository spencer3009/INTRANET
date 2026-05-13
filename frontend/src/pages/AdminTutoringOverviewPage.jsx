// AdminTutoringOverviewPage — Matriz de gobernanza de tutorías del colegio.
//
// Para owner/admin/director. Muestra todas las secciones del año con:
//   - Nivel / Grado / Sección
//   - Tutor actual (o "sin asignar")
//   - # alumnos, % comentarios y % conducta del bimestre activo
//   - Acciones: Asignar / Cambiar / Quitar
//   - Reasignación masiva: seleccionar varias secciones y transferir a otro tutor
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import {
  GraduationCap, RefreshCw, Search, Filter, X, Users, AlertTriangle,
  CheckCircle2, ArrowRightLeft, UserPlus, UserMinus, Loader2,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminTutoringOverviewPage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  // Cargar settings (para nombre de colegio en sidebar/header)
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/settings`, { headers });
        setSettings(r.data || null);
      } catch { /* ignore */ }
    })();
  }, [headers]);

  const navigateTo = (path) => navigate(`/${subdomain || ""}${path}`.replace(/\/+/g, "/"));

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ rows: [], summary: {}, tutors: [] });
  const [teachers, setTeachers] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [activePeriodId, setActivePeriodId] = useState(null);

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | assigned | unassigned
  const [filterTutorId, setFilterTutorId] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  // Selección multi-row para reasignación masiva
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [transferModal, setTransferModal] = useState(null); // {sectionIds: [], mode: 'transfer'|'remove'}
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Modal asignación 1-a-1
  const [assignModal, setAssignModal] = useState(null); // {row, mode: 'assign'|'change'}
  const [assignTarget, setAssignTarget] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Cargar periodos + activo
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/academic/periods`, { headers });
        const arr = r.data || [];
        setPeriods(arr);
        const active = arr.find(p => p.is_active || p.activo) || arr[0];
        if (active) setActivePeriodId(active.id);
      } catch { /* ignore */ }
    })();
  }, [headers]);

  // Cargar profesores (para selectors)
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/users?limit=300`, { headers });
        setTeachers((r.data || []).filter(u => u.role === "teacher"));
      } catch { /* ignore */ }
    })();
  }, [headers]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const params = activePeriodId ? { period_id: activePeriodId } : {};
      const r = await axios.get(`${API}/admin/tutoring-overview`, { headers, params });
      setOverview(r.data || { rows: [], summary: {}, tutors: [] });
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cargar la matriz de tutorías.");
    } finally {
      setLoading(false);
    }
  }, [headers, activePeriodId]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  // Filas filtradas
  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return overview.rows.filter(r => {
      if (filterStatus === "assigned" && !r.tutor_id) return false;
      if (filterStatus === "unassigned" && r.tutor_id) return false;
      if (filterTutorId && r.tutor_id !== filterTutorId) return false;
      if (filterLevel && r.level_name !== filterLevel) return false;
      if (q) {
        const hay = `${r.level_name || ""} ${r.grade_name || ""} ${r.section_name || ""} ${r.tutor_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [overview.rows, searchText, filterStatus, filterTutorId, filterLevel]);

  const uniqueLevels = useMemo(() =>
    [...new Set(overview.rows.map(r => r.level_name).filter(Boolean))], [overview.rows]);

  // Seleccionar fila
  const toggleRow = (sectionId) => {
    const next = new Set(selectedRows);
    if (next.has(sectionId)) next.delete(sectionId);
    else next.add(sectionId);
    setSelectedRows(next);
  };
  const toggleAllVisible = () => {
    if (filteredRows.every(r => selectedRows.has(r.section_id))) {
      const next = new Set(selectedRows);
      filteredRows.forEach(r => next.delete(r.section_id));
      setSelectedRows(next);
    } else {
      const next = new Set(selectedRows);
      filteredRows.forEach(r => next.add(r.section_id));
      setSelectedRows(next);
    }
  };

  // Asignación 1-a-1
  const openAssign = (row) => {
    setAssignModal({ row, mode: row.tutor_id ? "change" : "assign" });
    setAssignTarget(row.tutor_id || "");
  };
  const handleAssign = async () => {
    if (!assignModal) return;
    setAssigning(true);
    try {
      await axios.put(`${API}/sections/${assignModal.row.section_id}/tutor`,
        { teacher_id: assignTarget || null }, { headers });
      toast.success(assignTarget ? "Tutor asignado" : "Tutor quitado");
      setAssignModal(null);
      setAssignTarget("");
      await loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo asignar el tutor.");
    } finally {
      setAssigning(false);
    }
  };
  const handleRemoveTutor = async (row) => {
    if (!window.confirm(`¿Quitar a ${row.tutor_name} como tutor de ${row.grade_name} ${row.section_name}?`)) return;
    try {
      await axios.put(`${API}/sections/${row.section_id}/tutor`, { teacher_id: null }, { headers });
      toast.success("Tutor quitado");
      await loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo quitar el tutor.");
    }
  };

  // Reasignación masiva
  const openTransfer = () => {
    if (selectedRows.size === 0) {
      toast.warning("Selecciona al menos una sección.");
      return;
    }
    setTransferModal({ sectionIds: Array.from(selectedRows) });
    setTransferTarget("");
  };
  const handleTransfer = async (removeMode = false) => {
    if (!transferModal) return;
    setTransferring(true);
    try {
      const body = { section_ids: transferModal.sectionIds };
      if (!removeMode) body.new_teacher_id = transferTarget || null;
      const r = await axios.post(`${API}/admin/tutorings/transfer`, body, { headers });
      const d = r.data || {};
      if (removeMode) {
        toast.success(`${d.deactivated || 0} tutoría${(d.deactivated || 0) === 1 ? "" : "s"} quitada${(d.deactivated || 0) === 1 ? "" : "s"}`);
      } else {
        toast.success(`${d.assigned || 0} sección${(d.assigned || 0) === 1 ? "" : "es"} reasignada${(d.assigned || 0) === 1 ? "" : "s"} correctamente`);
      }
      setTransferModal(null);
      setTransferTarget("");
      setSelectedRows(new Set());
      await loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo reasignar.");
    } finally {
      setTransferring(false);
    }
  };

  const s = overview.summary || {};
  const completionBadge = (pct) => {
    if (pct === null || pct === undefined) return <span className="text-slate-400">—</span>;
    const cls = pct >= 90 ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : pct >= 50 ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-red-100 text-red-800 border-red-200";
    return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>{pct}%</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-tutoring-overview-page">
      <Sidebar
        active="gestion-tutorias"
        onNavigate={(r) => navigateTo(r)}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name || user?.school_name}
        subdomain={subdomain}
        user={user}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={user} settings={settings} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-4">
          {/* Header */}
          <header className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Gestión de Tutorías</h1>
                <p className="text-sm text-slate-500 mt-0.5">Asigna, cambia o quita el tutor de cada sección. Visualiza el avance de comentarios y conducta por salón.</p>
              </div>
            </div>
            <button
              onClick={loadOverview}
              disabled={loading}
              className="flex items-center gap-2 text-sm px-3 py-2 border border-slate-200 rounded-lg hover:bg-white"
              data-testid="reload-overview-btn"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Recargar
            </button>
          </header>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Secciones totales" value={s.total_sections ?? "—"} icon={<Users className="w-4 h-4" />} />
            <SummaryCard label="Con tutor asignado" value={s.with_tutor ?? "—"} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} accent="emerald" />
            <SummaryCard label="Sin tutor" value={s.without_tutor ?? "—"} icon={<AlertTriangle className="w-4 h-4 text-red-600" />} accent="red" />
            <SummaryCard label="Tutores activos" value={s.unique_tutors ?? "—"} icon={<GraduationCap className="w-4 h-4 text-indigo-600" />} accent="indigo" />
          </div>

          {/* Filtros */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Buscar por nivel, grado, sección o tutor..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                data-testid="search-input"
              />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2" data-testid="filter-status">
              <option value="all">Todas las secciones</option>
              <option value="assigned">Solo con tutor</option>
              <option value="unassigned">Solo sin tutor</option>
            </select>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2" data-testid="filter-level">
              <option value="">Todos los niveles</option>
              {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={filterTutorId} onChange={e => setFilterTutorId(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2" data-testid="filter-tutor">
              <option value="">Todos los tutores</option>
              {overview.tutors.map(t => <option key={t.id} value={t.id}>{t.name} ({t.section_count})</option>)}
            </select>
            {periods.length > 0 && (
              <select value={activePeriodId || ""} onChange={e => setActivePeriodId(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2" data-testid="filter-period">
                {periods.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
            {(searchText || filterStatus !== "all" || filterTutorId || filterLevel) && (
              <button onClick={() => { setSearchText(""); setFilterStatus("all"); setFilterTutorId(""); setFilterLevel(""); }} className="text-xs text-slate-500 hover:text-slate-800 px-2">
                <X className="w-3 h-3 inline" /> Limpiar
              </button>
            )}
          </div>

          {/* Acciones masivas (cuando hay selección) */}
          {selectedRows.size > 0 && (
            <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between gap-3" data-testid="bulk-actions-bar">
              <div className="text-sm">
                <strong>{selectedRows.size}</strong> sección{selectedRows.size === 1 ? "" : "es"} seleccionada{selectedRows.size === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openTransfer} className="bg-white text-slate-900 px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5" data-testid="bulk-transfer-btn">
                  <ArrowRightLeft className="w-4 h-4" /> Reasignar
                </button>
                <button onClick={() => setSelectedRows(new Set())} className="text-white/70 hover:text-white text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></div>
            ) : filteredRows.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Filter className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                No hay secciones que coincidan con los filtros.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="tutoring-overview-table">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left w-8">
                        <input
                          type="checkbox"
                          checked={filteredRows.length > 0 && filteredRows.every(r => selectedRows.has(r.section_id))}
                          onChange={toggleAllVisible}
                          data-testid="select-all-rows"
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Nivel</th>
                      <th className="px-3 py-2 text-left">Grado</th>
                      <th className="px-3 py-2 text-left">Sección</th>
                      <th className="px-3 py-2 text-left">Tutor actual</th>
                      <th className="px-3 py-2 text-center"># Alumnos</th>
                      <th className="px-3 py-2 text-center">% Coment.</th>
                      <th className="px-3 py-2 text-center">% Conducta</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(r => (
                      <tr key={r.section_id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`row-${r.section_id}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(r.section_id)}
                            onChange={() => toggleRow(r.section_id)}
                            data-testid={`row-checkbox-${r.section_id}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-700">{r.level_name || <span className="text-xs text-amber-700 italic">sin nivel</span>}</td>
                        <td className="px-3 py-2 text-slate-700">{r.grade_name || <span className="text-xs text-amber-700 italic">sin grado</span>}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{r.section_name}</td>
                        <td className="px-3 py-2">
                          {r.tutor_name ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-800">
                              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" /> {r.tutor_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" /> Sin asignar
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600">{r.student_count}</td>
                        <td className="px-3 py-2 text-center">{completionBadge(r.comments_pct)}</td>
                        <td className="px-3 py-2 text-center">{completionBadge(r.conduct_pct)}</td>
                        <td className="px-3 py-2 text-right space-x-1">
                          <button
                            onClick={() => openAssign(r)}
                            className="text-xs px-2 py-1 rounded bg-slate-900 text-white hover:bg-slate-800"
                            data-testid={`assign-btn-${r.section_id}`}
                          >
                            {r.tutor_id ? "Cambiar" : "Asignar"}
                          </button>
                          {r.tutor_id && (
                            <button
                              onClick={() => handleRemoveTutor(r)}
                              className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                              data-testid={`remove-btn-${r.section_id}`}
                            >
                              Quitar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        </div>
      </main>

      {/* Modal asignación 1-a-1 */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => !assigning && setAssignModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()} data-testid="assign-modal">
            <header className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {assignModal.mode === "assign" ? "Asignar tutor" : "Cambiar tutor"}
              </h3>
              <button onClick={() => setAssignModal(null)} disabled={assigning}><X className="w-5 h-5 text-slate-400 hover:text-slate-700" /></button>
            </header>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                Sección: <strong>{assignModal.row.level_name} - {assignModal.row.grade_name} {assignModal.row.section_name}</strong>
              </p>
              {assignModal.row.tutor_name && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  Tutor actual: <strong>{assignModal.row.tutor_name}</strong> (se reemplazará)
                </p>
              )}
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nuevo tutor *</span>
                <select
                  value={assignTarget}
                  onChange={e => setAssignTarget(e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  data-testid="assign-target-select"
                >
                  <option value="">— Selecciona un profesor —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{`${t.last_name || ""} ${t.first_name || t.name || ""}`.trim()}</option>
                  ))}
                </select>
              </label>
            </div>
            <footer className="px-5 py-3 border-t flex justify-end gap-2">
              <button onClick={() => setAssignModal(null)} disabled={assigning} className="text-sm text-slate-500 px-3 py-1.5">Cancelar</button>
              <button
                onClick={handleAssign}
                disabled={assigning || !assignTarget}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center gap-2"
                data-testid="assign-confirm-btn"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Confirmar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal reasignación masiva */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => !transferring && setTransferModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()} data-testid="transfer-modal">
            <header className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Reasignación masiva</h3>
              <button onClick={() => setTransferModal(null)} disabled={transferring}><X className="w-5 h-5 text-slate-400 hover:text-slate-700" /></button>
            </header>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                Vas a modificar la tutoría de <strong>{transferModal.sectionIds.length}</strong> sección{transferModal.sectionIds.length === 1 ? "" : "es"}.
              </p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Asignar todas a:</span>
                <select
                  value={transferTarget}
                  onChange={e => setTransferTarget(e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  data-testid="transfer-target-select"
                >
                  <option value="">— Selecciona un profesor —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{`${t.last_name || ""} ${t.first_name || t.name || ""}`.trim()}</option>
                  ))}
                </select>
              </label>
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
                💡 Si dejas el selector vacío y haces clic en <strong>"Quitar a todos"</strong>, esas secciones quedarán sin tutor.
              </div>
            </div>
            <footer className="px-5 py-3 border-t flex justify-between gap-2">
              <button
                onClick={() => handleTransfer(true)}
                disabled={transferring}
                className="text-xs text-red-700 hover:text-red-900 px-2 py-1.5 inline-flex items-center gap-1"
                data-testid="transfer-remove-all-btn"
              >
                <UserMinus className="w-3.5 h-3.5" /> Quitar a todos
              </button>
              <div className="flex gap-2">
                <button onClick={() => setTransferModal(null)} disabled={transferring} className="text-sm text-slate-500 px-3 py-1.5">Cancelar</button>
                <button
                  onClick={() => handleTransfer(false)}
                  disabled={transferring || !transferTarget}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center gap-2"
                  data-testid="transfer-confirm-btn"
                >
                  {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  Reasignar a {teachers.find(t => t.id === transferTarget)?.last_name || "..."}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, accent }) {
  const ring = accent === "emerald" ? "ring-emerald-100"
    : accent === "red" ? "ring-red-100"
    : accent === "indigo" ? "ring-indigo-100"
    : "ring-slate-100";
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-3 ring-2 ${ring}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
