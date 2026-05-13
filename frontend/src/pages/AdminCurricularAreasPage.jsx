/* eslint-disable */
// AdminCurricularAreasPage — gestión de Áreas Curriculares (MINEDU)
// UTF-8 con tildes/ñ reales. Layout estándar del portal (Sidebar + topbar).
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Sparkles, Save, X, Loader2,
  BookMarked, LinkIcon, RefreshCcw, ChevronDown, ChevronRight as ChevRight,
  Archive, AlertTriangle,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import AreaSubjectsManager from "../components/curricular/AreaSubjectsManager";
import AreaWizardModal from "../components/curricular/AreaWizardModal";
import GradeScopePicker from "../components/curricular/GradeScopePicker";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminCurricularAreasPage({ user, token, subdomain, onLogout, embedded = false }) {
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [areas, setAreas] = useState([]);
  const areasRef = useRef([]);
  const [expandedAreaId, setExpandedAreaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [modal, setModal] = useState(null); // {mode: 'create'|'edit', area?}
  const [savingArea, setSavingArea] = useState(false);
  const [archiveModal, setArchiveModal] = useState(null); // {area, archiving: false}
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  // Subjects sin área (para el panel de "asignar")
  const [unassignedSubjects, setUnassignedSubjects] = useState([]);
  const [linking, setLinking] = useState({}); // subject_id → area_id seleccionada

  const isAdmin = ["owner", "admin", "director"].includes(user?.role);

  const loadAreas = useCallback(async () => {
    setLoading(true);
    try {
      const [areasRes, subjectsRes] = await Promise.all([
        axios.get(`${API}/curricular-areas?include_inactive=true`, { headers }),
        axios.get(`${API}/academic/subjects`, { headers }).catch(() => ({ data: { subjects: [] } })),
      ]);
      setAreas(areasRes.data || []);
      areasRef.current = areasRes.data || [];
      const all = subjectsRes.data?.subjects || subjectsRes.data || [];
      setUnassignedSubjects(all.filter(s => !s.area_id && s.status !== "deleted"));
    } catch (err) {
      console.error("[CurricularAreas] load error", err);
      toast.error("No se pudieron cargar las áreas curriculares. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadAreas(); /* eslint-disable-next-line */ }, []);

  const handleSeed = async () => {
    if (!window.confirm("¿Inicializar las 10 áreas estándar MINEDU? Esta acción es segura: no duplica áreas ya creadas y vincula asignaturas existentes por similitud de nombre.")) return;
    setSeeding(true);
    try {
      const res = await axios.post(`${API}/migration/seed-curricular-areas`, {}, { headers });
      const d = res.data;
      toast.success(
        `${d.areas_created} áreas creadas · ${d.subjects_assigned} asignaturas vinculadas` +
        (d.subjects_unassigned > 0 ? ` · ${d.subjects_unassigned} sin asignar (revísalas abajo)` : "")
      );
      await loadAreas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo inicializar las áreas. Intenta nuevamente.");
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveArea = async () => {
    if (!modal) return;
    const name = (modal.area?.name || "").trim();
    if (!name) { toast.error("El nombre del área es obligatorio"); return; }
    setSavingArea(true);
    try {
      if (modal.mode === "create") {
        await axios.post(`${API}/curricular-areas`, {
          name,
          order: parseInt(modal.area.order || 0, 10),
          color: modal.area.color || "#0F172A",
        }, { headers });
        toast.success("Área curricular creada correctamente");
      } else {
        await axios.put(`${API}/curricular-areas/${modal.area.id}`, {
          name,
          order: parseInt(modal.area.order || 0, 10),
          color: modal.area.color,
          is_active: modal.area.is_active,
          scope_grade_ids: modal.area.scope_grade_ids || [],
        }, { headers });
        toast.success("Área curricular actualizada");
      }
      setModal(null);
      await loadAreas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudieron guardar los cambios. Intenta nuevamente.");
    } finally {
      setSavingArea(false);
    }
  };

  const handleDeactivate = (area) => {
    // Abre el modal con copy contextual según las asignaturas vinculadas
    setArchiveModal({ area, archiving: false });
  };

  const confirmArchive = async () => {
    if (!archiveModal?.area) return;
    const area = archiveModal.area;
    setArchiveModal(m => ({ ...m, archiving: true }));
    try {
      const r = await axios.delete(`${API}/curricular-areas/${area.id}`, { headers });
      const d = r.data || {};
      const subjects = d.subjects_unlinked_count || 0;
      const groups = d.groups_unlinked_count || 0;
      if (subjects > 0) {
        toast.success(`Área "${area.name}" desactivada. ${groups} asignatura${groups === 1 ? "" : "s"} (${subjects} instancia${subjects === 1 ? "" : "s"}) quedaron sin área.`);
      } else {
        toast.success(`Área "${area.name}" desactivada.`);
      }
      setArchiveModal(null);
      await loadAreas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo desactivar el área. Intenta nuevamente.");
      setArchiveModal(m => ({ ...m, archiving: false }));
    }
  };

  const handleHardReset = async () => {
    if (resetConfirmText !== "RESETEAR") {
      toast.error('Debes escribir exactamente "RESETEAR" (en mayúsculas).');
      return;
    }
    setResetting(true);
    try {
      const r = await axios.post(`${API}/curricular-areas/hard-reset`, { confirm: "RESETEAR" }, { headers });
      const d = r.data || {};
      toast.success(
        `Reset completado: ${d.areas_deleted || 0} área${(d.areas_deleted || 0) === 1 ? "" : "s"} eliminada${(d.areas_deleted || 0) === 1 ? "" : "s"}, ` +
        `${d.subjects_unlinked || 0} asignatura${(d.subjects_unlinked || 0) === 1 ? "" : "s"} desvinculada${(d.subjects_unlinked || 0) === 1 ? "" : "s"}.`
      );
      setResetModal(false);
      setResetConfirmText("");
      await loadAreas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo resetear. Intenta nuevamente.");
    } finally {
      setResetting(false);
    }
  };

  const handleLinkSubject = async (subject) => {
    const areaId = linking[subject.id];
    if (!areaId) return;
    try {
      await axios.put(`${API}/subjects/${subject.id}/area`, { area_id: areaId }, { headers });
      toast.success(`"${subject.name}" vinculada al área correctamente`);
      setLinking(prev => { const n = { ...prev }; delete n[subject.id]; return n; });
      await loadAreas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo vincular la asignatura. Intenta nuevamente.");
    }
  };

  const activeAreas = areas.filter(a => a.is_active !== false);

  return (
    <div className={embedded ? "min-h-full bg-slate-50" : "min-h-screen bg-slate-50 flex"}>
      {!embedded && (
        <Sidebar
          active="areas-curriculares"
          onNavigate={(r) => navigate(`/${subdomain || ""}${r}`.replace(/\/+/g, "/"))}
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          schoolName={user?.school_name}
          subdomain={subdomain}
          token={token}
          user={user}
        />
      )}

      <main className={embedded ? "min-h-full" : "flex-1 ml-16 min-h-screen"}>
        {/* Topbar (oculto en modo embebido) */}
        {!embedded && (
          <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <BookMarked className="w-6 h-6 text-slate-800" />
              <div>
                <h1 className="text-xl font-bold text-slate-900" data-testid="page-title">Áreas Curriculares</h1>
                <p className="text-sm text-slate-500">Organiza las asignaturas según el currículo MINEDU</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-900 px-4 py-2 rounded-lg font-semibold text-sm transition border border-amber-300 disabled:opacity-50"
                  data-testid="seed-btn"
                  title="Crear las 10 áreas estándar y vincular asignaturas automáticamente"
                >
                  {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {areas.length === 0 ? "Inicializar áreas estándar" : "Re-aplicar fuzzy-match"}
                </button>
              )}
              {isAdmin && areas.length > 0 && (
                <button
                  onClick={() => { setResetModal(true); setResetConfirmText(""); }}
                  className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-800 px-3 py-2 rounded-lg font-semibold text-sm transition border border-red-200"
                  data-testid="hard-reset-btn"
                  title="Borrar TODAS las áreas y empezar de cero (irreversible)"
                >
                  <AlertTriangle className="w-4 h-4" /> Resetear áreas
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setWizardOpen(true)}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold text-sm transition"
                  data-testid="create-area-btn"
                >
                  <Plus className="w-4 h-4" /> Nueva área
                </button>
              )}
            </div>
          </header>
        )}

        <div className={embedded ? "p-6 space-y-6" : "p-8 space-y-8"}>
          {/* Barra de acciones embebidas (modo drawer) */}
          {embedded && isAdmin && (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-2 rounded-lg font-semibold text-sm transition border border-amber-300 disabled:opacity-50"
                data-testid="seed-btn"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {areas.length === 0 ? "Inicializar áreas estándar" : "Re-aplicar fuzzy-match"}
              </button>
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg font-semibold text-sm transition"
                data-testid="create-area-btn"
              >
                <Plus className="w-4 h-4" /> Nueva área
              </button>
            </div>
          )}
          {/* ── Tabla de áreas ── */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="px-6 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Áreas registradas ({areas.length})</h2>
              <button onClick={loadAreas} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
                <RefreshCcw className="w-3.5 h-3.5" /> Recargar
              </button>
            </header>

            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Cargando...
              </div>
            ) : areas.length === 0 ? (
              <div className="p-12 text-center">
                <BookMarked className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium mb-1">Aún no hay áreas curriculares</p>
                <p className="text-sm text-slate-500 mb-4">Usa el botón <span className="font-semibold text-amber-700">"Inicializar áreas estándar"</span> para crear las 10 áreas MINEDU y vincular automáticamente tus asignaturas.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600 text-xs uppercase tracking-wide">
                    <th className="px-4 py-2 w-16">Orden</th>
                    <th className="px-4 py-2">Nombre</th>
                    <th className="px-4 py-2 w-32 text-center">Asignaturas</th>
                    <th className="px-4 py-2 w-28 text-center">Estado</th>
                    {isAdmin && <th className="px-4 py-2 w-32 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {areas.map(a => {
                    const isExpanded = expandedAreaId === a.id;
                    const totalCols = isAdmin ? 5 : 4;
                    return (
                      <React.Fragment key={a.id}>
                    <tr className={`border-t border-slate-100 ${a.is_active === false ? "opacity-50" : ""}`} data-testid={`area-row-${a.id}`}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-slate-100 text-slate-700 font-semibold">{a.order}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedAreaId(prev => prev === a.id ? null : a.id)}
                          className="flex items-center gap-2 text-left hover:text-slate-700 transition-colors group"
                          data-testid={`expand-area-${a.id}`}
                          title={isExpanded ? "Ocultar asignaturas vinculadas" : "Ver asignaturas vinculadas"}
                        >
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-900" />
                            : <ChevRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />}
                          <span className="inline-block w-3 h-3 rounded" style={{ background: a.color || "#0F172A" }} />
                          <span className="font-medium text-slate-900 group-hover:underline">{a.name}</span>
                          {a.scope_label && (
                            <span
                              className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                (a.scope_grade_ids?.length || 0) === 0
                                  ? "bg-slate-50 text-slate-600 border-slate-200"
                                  : "bg-blue-50 text-blue-800 border-blue-200"
                              }`}
                              title={a.scope_label}
                              data-testid={`area-scope-badge-${a.id}`}
                            >
                              {a.scope_label}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                          {a.subjects_count ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.is_active === false ? (
                          <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Inactiva</span>
                        ) : (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Activa</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setModal({ mode: "edit", area: { ...a } })}
                            className="text-slate-500 hover:text-slate-900 p-1.5"
                            data-testid={`edit-area-${a.id}`}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {a.is_active !== false && (
                            <button
                              onClick={() => handleDeactivate(a)}
                              className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-1.5 ml-1 rounded transition-colors"
                              data-testid={`delete-area-${a.id}`}
                              title="Desactivar área"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/40" data-testid={`area-row-expanded-${a.id}`}>
                        <td colSpan={totalCols} className="px-4 pb-3 pt-1">
                          <AreaSubjectsManager
                            area={a}
                            token={token}
                            embedded={true}
                            onChange={async () => {
                              await loadAreas();
                            }}
                          />
                        </td>
                      </tr>
                    )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Asignaturas sin área ── */}
          {isAdmin && unassignedSubjects.length > 0 && (
            <section className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden" data-testid="unassigned-panel">
              <header className="px-6 py-3 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-amber-700" />
                <h2 className="font-semibold text-amber-900">Asignaturas sin área ({unassignedSubjects.length})</h2>
              </header>
              <table className="w-full text-sm">
                <thead className="bg-amber-50/40">
                  <tr className="text-left text-amber-900 text-xs uppercase tracking-wide">
                    <th className="px-4 py-2">Asignatura</th>
                    <th className="px-4 py-2 w-72">Asignar área</th>
                    <th className="px-4 py-2 w-24 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedSubjects.slice(0, 50).map(s => (
                    <tr key={s.id} className="border-t border-amber-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{s.name}</td>
                      <td className="px-4 py-2">
                        <select
                          value={linking[s.id] || ""}
                          onChange={e => setLinking(prev => ({ ...prev, [s.id]: e.target.value }))}
                          className="w-full border border-amber-200 rounded px-2 py-1 text-sm bg-white"
                          data-testid={`link-select-${s.id}`}
                        >
                          <option value="">— Selecciona —</option>
                          {activeAreas.map(a => (
                            <option key={a.id} value={a.id}>{a.order}. {a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleLinkSubject(s)}
                          disabled={!linking[s.id]}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-40"
                          data-testid={`link-btn-${s.id}`}
                        >
                          Vincular
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {unassignedSubjects.length > 50 && (
                <p className="px-4 py-2 text-xs text-amber-700">Mostrando 50 de {unassignedSubjects.length}. Vincula varias y recarga para ver el resto.</p>
              )}
            </section>
          )}
        </div>
      </main>

      {/* ── Wizard Crear Área (3 pasos: grados → nombre → asignaturas) ── */}
      {wizardOpen && (
        <AreaWizardModal
          token={token}
          defaultOrder={activeAreas.length + 1}
          onClose={() => setWizardOpen(false)}
          onCreated={async () => {
            await loadAreas();
          }}
        />
      )}

      {/* ── Modal crear / editar ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !savingArea && setModal(null)}>
          <div
            className={`bg-white rounded-xl ${modal.mode === "edit" ? "max-w-2xl" : "max-w-md"} w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto`}
            onClick={e => e.stopPropagation()}
            data-testid="area-modal"
          >
            <header className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {modal.mode === "create" ? "Nueva área curricular" : "Editar área"}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </header>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nombre *</span>
                <input
                  type="text"
                  value={modal.area.name}
                  onChange={e => setModal({ ...modal, area: { ...modal.area, name: e.target.value } })}
                  className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="ej. Comunicación"
                  data-testid="area-name-input"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Orden</span>
                <input
                  type="number"
                  value={modal.area.order ?? 0}
                  onChange={e => setModal({ ...modal, area: { ...modal.area, order: e.target.value } })}
                  className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  data-testid="area-order-input"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Color</span>
                <input
                  type="color"
                  value={modal.area.color || "#0F172A"}
                  onChange={e => setModal({ ...modal, area: { ...modal.area, color: e.target.value } })}
                  className="w-full mt-1 border border-slate-300 rounded-lg h-10"
                />
              </label>
              {modal.mode === "edit" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={modal.area.is_active !== false}
                    onChange={e => setModal({ ...modal, area: { ...modal.area, is_active: e.target.checked } })}
                  />
                  Área activa
                </label>
              )}
              {modal.mode === "edit" && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Grados del scope</p>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Define a qué grados aplica esta área. Vacío = área global (todos los grados).
                  </p>
                  <GradeScopePicker
                    token={token}
                    value={new Set(modal.area.scope_grade_ids || [])}
                    onChange={(newSet) => setModal({ ...modal, area: { ...modal.area, scope_grade_ids: Array.from(newSet) } })}
                  />
                </div>
              )}
            </div>

            {/* ── Acordeón: Asignaturas vinculadas (solo edición) ── */}
            {modal.mode === "edit" && modal.area?.id && (
              <AreaSubjectsManager
                area={modal.area}
                token={token}
                onChange={async () => {
                  // Refresca la tabla principal y propaga el nuevo conteo al área del modal
                  await loadAreas();
                  setModal(prev => {
                    if (!prev) return prev;
                    const fresh = (areasRef.current || []).find(a => a.id === prev.area.id);
                    return fresh ? { ...prev, area: { ...prev.area, subjects_count: fresh.subjects_count } } : prev;
                  });
                }}
              />
            )}
            <footer className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setModal(null)} disabled={savingArea} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
              <button
                onClick={handleSaveArea}
                disabled={savingArea}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                data-testid="save-area-btn"
              >
                {savingArea ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── Modal Archivar (desactivar área con auto-unlink) ── */}
      {archiveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => !archiveModal.archiving && setArchiveModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="archive-area-modal">
            {(() => {
              const a = archiveModal.area;
              const n = a.subjects_count ?? 0;
              const hasSubjects = n > 0;
              return (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Archive className="w-5 h-5 text-slate-700" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">
                        Desactivar el área "{a.name}"
                      </h4>
                      {hasSubjects ? (
                        <p className="text-sm text-slate-600 mt-1">
                          Esta área tiene <span className="font-semibold">{n} instancia{n === 1 ? "" : "s"}</span> vinculada{n === 1 ? "" : "s"}.
                        </p>
                      ) : (
                        <p className="text-sm text-slate-600 mt-1">Esta área no tiene asignaturas vinculadas.</p>
                      )}
                    </div>
                  </div>

                  {hasSubjects && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-sm text-slate-700">
                      <p className="font-semibold mb-2 text-slate-800">Al desactivar el área:</p>
                      <ul className="space-y-1.5 text-xs">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 mt-0.5">●</span>
                          <span>Las asignaturas <strong>seguirán existiendo</strong> con sus notas, horarios y profesores intactos.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 mt-0.5">●</span>
                          <span>Las asignaturas quedarán <strong>sin área curricular</strong> asignada.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-slate-500 mt-0.5">●</span>
                          <span>Podrás <strong>reasignarlas</strong> a otra área en cualquier momento.</span>
                        </li>
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setArchiveModal(null)}
                      disabled={archiveModal.archiving}
                      className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
                      data-testid="archive-cancel-btn"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmArchive}
                      disabled={archiveModal.archiving}
                      className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                      data-testid="archive-confirm-btn"
                    >
                      {archiveModal.archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                      Desactivar área
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Modal Hard Reset (borra TODAS las áreas + desvincula asignaturas) ── */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={() => !resetting && setResetModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="hard-reset-modal">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-700" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Resetear todas las áreas curriculares</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Esta acción es <strong>irreversible</strong>. Se eliminarán <strong>todas las {areas.length} áreas</strong>
                  {" "}(activas e inactivas) y todas las asignaturas vinculadas quedarán <strong>sin área asignada</strong>.
                </p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-slate-700 mb-1.5">¿Qué SÍ se elimina?</p>
              <ul className="text-xs text-slate-600 space-y-1 ml-4 list-disc">
                <li>Los <strong>{areas.length} documentos</strong> de áreas curriculares (físicamente, no se pueden recuperar).</li>
              </ul>
              <p className="text-xs font-semibold text-slate-700 mt-2.5 mb-1.5">¿Qué NO se toca?</p>
              <ul className="text-xs text-slate-600 space-y-1 ml-4 list-disc">
                <li>Las <strong>asignaturas</strong> (cursos) y todas sus notas, horarios, profesores, secciones, alumnos.</li>
                <li>Libreta, Consolidado, Registro Auxiliar y demás módulos.</li>
              </ul>
            </div>
            <label className="block mb-4">
              <span className="text-xs font-semibold text-slate-700">
                Para confirmar, escribe <code className="bg-slate-100 text-red-700 px-1.5 py-0.5 rounded font-mono">RESETEAR</code> en mayúsculas:
              </span>
              <input
                type="text"
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value)}
                className="w-full mt-1 border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 font-mono"
                placeholder="RESETEAR"
                disabled={resetting}
                autoFocus
                data-testid="hard-reset-confirm-input"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setResetModal(false); setResetConfirmText(""); }}
                disabled={resetting}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40"
                data-testid="hard-reset-cancel-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleHardReset}
                disabled={resetting || resetConfirmText !== "RESETEAR"}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="hard-reset-confirm-btn"
              >
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Sí, eliminar todas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
