// AreaSubjectsManager — Acordeón colapsable dentro del modal "Editar Área".
// Gestiona vinculación manual de asignaturas (link / unlink / search / paginación).
// Las acciones son transaccionales — no requieren botón "Guardar" del modal padre.
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight as ChevRight, Search, Plus, Trash2,
  Loader2, Link2, X, AlertTriangle, Inbox,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PAGE_SIZE = 20;

export default function AreaSubjectsManager({ area, token, onChange }) {
  const [open, setOpen] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ subjects: [], total: 0 });
  const [selected, setSelected] = useState(new Set());
  const [unlinking, setUnlinking] = useState(false);
  const [confirm, setConfirm] = useState(null); // {type:'one'|'many', payload}
  const [subModal, setSubModal] = useState(false);
  const debounceRef = useRef(null);
  const fetchReqIdRef = useRef(0); // guarda anti-race
  const headers = { Authorization: `Bearer ${token}` };

  const fetchSubjects = useCallback(async () => {
    if (!area?.id) return;
    const myId = ++fetchReqIdRef.current;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/curricular-areas/${area.id}/subjects`, {
        params: { page, page_size: PAGE_SIZE, search: search || undefined },
        headers,
      });
      if (myId !== fetchReqIdRef.current) return; // respuesta obsoleta
      setData({ subjects: r.data?.subjects || [], total: r.data?.total || 0 });
      setLoadedOnce(true);
    } catch (err) {
      if (myId !== fetchReqIdRef.current) return;
      const code = err.response?.status;
      if (code === 403) toast.error("No tienes permisos para gestionar asignaturas de esta área.");
      else if (code === 404) toast.error("Área no encontrada.");
      else toast.error(err.response?.data?.detail || "No se pudieron cargar las asignaturas. Intenta nuevamente.");
      setData({ subjects: [], total: 0 });
    } finally {
      if (myId === fetchReqIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line
  }, [area?.id, page, search]);

  // Lazy-load: solo si el acordeón se abre
  useEffect(() => {
    if (open) fetchSubjects();
    // eslint-disable-next-line
  }, [open, page]);

  // Search con debounce 300ms
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchSubjects();
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const allOnPageSelected = data.subjects.length > 0 && data.subjects.every(s => selected.has(s.id));
  const toggleAllOnPage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) data.subjects.forEach(s => next.delete(s.id));
    else data.subjects.forEach(s => next.add(s.id));
    setSelected(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const doUnlink = async (ids, names = []) => {
    setUnlinking(true);
    try {
      const r = await axios.post(`${API}/curricular-areas/${area.id}/subjects/unlink`, { subject_ids: ids }, { headers });
      const d = r.data;
      const unlinked = d.unlinked || [];
      if (unlinked.length === 1) toast.success(`Desvinculada: ${unlinked[0].subject_name}`);
      else if (unlinked.length <= 3) toast.success(`Desvinculadas: ${unlinked.map(u => u.subject_name).join(", ")}`);
      else toast.success(`${unlinked.length} asignaturas desvinculadas del área`);
      if ((d.errors || []).length > 0) {
        toast.warning(`${d.errors.length} no se pudieron desvincular: ${d.errors.map(e => e.error).join("; ")}`);
      }
      setSelected(new Set());
      await fetchSubjects();
      onChange && onChange();
    } catch (err) {
      const code = err.response?.status;
      if (code === 403) toast.error("No tienes permisos.");
      else toast.error(err.response?.data?.detail || "Error de conexión. Intenta nuevamente.");
    } finally {
      setUnlinking(false);
      setConfirm(null);
    }
  };

  const handleSubModalLinked = async () => {
    setSubModal(false);
    await fetchSubjects();
    onChange && onChange();
  };

  const count = loadedOnce ? data.total : (area?.subjects_count ?? 0);

  return (
    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden" data-testid="area-subjects-manager">
      {/* Header del acordeón */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-900 transition-colors"
        data-testid="area-subjects-accordion-toggle"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevRight className="w-4 h-4" />}
          Asignaturas vinculadas ({count})
        </span>
        {open && <span className="text-[11px] font-normal text-slate-500 italic">Los cambios se guardan automáticamente</span>}
      </button>

      {open && (
        <div className="bg-white" data-testid="area-subjects-panel">
          {/* Toolbar */}
          <div className="px-3 py-2.5 border-b border-slate-200 flex flex-wrap items-center gap-2 bg-slate-50/50 sticky top-0 z-10">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar asignatura..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
                data-testid="area-subjects-search"
              />
            </div>
            <button
              type="button"
              onClick={() => setSubModal(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
              data-testid="open-link-submodal-btn"
            >
              <Plus className="w-3.5 h-3.5" /> Vincular asignaturas
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || unlinking}
              onClick={() => setConfirm({ type: "many", payload: Array.from(selected) })}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="bulk-unlink-btn"
            >
              <Trash2 className="w-3.5 h-3.5" /> Desvincular seleccionadas ({selected.size})
            </button>
          </div>

          {/* Tabla */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && !loadedOnce ? (
              <div className="p-6">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="h-9 mb-2 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : data.subjects.length === 0 ? (
              <div className="px-6 py-10 text-center" data-testid="area-subjects-empty">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-700 font-medium">No hay asignaturas vinculadas a esta área.</p>
                <p className="text-xs text-slate-500 mt-1">Haz clic en "Vincular asignaturas" para empezar.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left w-9">
                      <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} data-testid="select-all-checkbox" />
                    </th>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Grado / Sección</th>
                    <th className="px-3 py-2 text-left">Profesor</th>
                    <th className="px-3 py-2 text-center w-12">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjects.map(s => {
                    const checked = selected.has(s.id);
                    const gradeSection = [s.grade_name, s.section_name].filter(Boolean).join(" / ") || "—";
                    return (
                      <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`area-subject-row-${s.id}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={checked} onChange={() => toggleOne(s.id)} data-testid={`subject-checkbox-${s.id}`} />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">{s.name}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs font-mono">{s.code || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{gradeSection}</td>
                        <td className="px-3 py-2 text-slate-600">{s.teacher_name || <span className="text-slate-400 italic">(sin asignar)</span>}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setConfirm({ type: "one", payload: s })}
                            disabled={unlinking}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                            title="Desvincular del área"
                            data-testid={`unlink-row-btn-${s.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginación */}
          {data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
              <span>{data.total} asignaturas · Página {page} de {totalPages}</span>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 bg-white hover:bg-slate-100">‹</button>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 bg-white hover:bg-slate-100">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmación de desvinculación */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => !unlinking && setConfirm(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="unlink-confirm-modal">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">
                  {confirm.type === "one"
                    ? <>Desvincular <span className="font-semibold">{confirm.payload.name}</span> del área <span className="font-semibold">{area.name}</span>?</>
                    : <>Desvincular <span className="font-semibold">{confirm.payload.length} asignatura{confirm.payload.length === 1 ? "" : "s"}</span> del área <span className="font-semibold">{area.name}</span>?</>
                  }
                </h4>
                <p className="text-sm text-slate-600 mt-1">Las asignaturas no se eliminarán, solo quedarán sin área curricular asignada.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} disabled={unlinking} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
              <button
                type="button"
                onClick={() => doUnlink(confirm.type === "one" ? [confirm.payload.id] : confirm.payload)}
                disabled={unlinking}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                data-testid="confirm-unlink-btn"
              >
                {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {confirm.type === "one" ? "Sí, desvincular" : `Sí, desvincular ${confirm.payload.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal de vinculación */}
      {subModal && (
        <LinkSubjectsSubModal
          area={area}
          token={token}
          onClose={() => setSubModal(false)}
          onLinked={handleSubModalLinked}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-modal: seleccionar asignaturas para vincular
// ─────────────────────────────────────────────────────────────────────────────
function LinkSubjectsSubModal({ area, token, onClose, onLinked }) {
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ subjects: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Map()); // id -> subject
  const [linking, setLinking] = useState(false);
  const debounceRef = useRef(null);
  const prevSearchRef = useRef(""); // estable bajo React Strict Mode (double-invoke)
  const prevPageDepsRef = useRef(null);
  const reqIdRef = useRef(0); // protege contra race conditions (response order)
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/curricular-areas/${area.id}/available-subjects`, {
        params: { page, page_size: PAGE_SIZE, search: search || undefined, unassigned_only: unassignedOnly },
        headers,
      });
      if (myId !== reqIdRef.current) return; // respuesta obsoleta, descartar
      setData({ subjects: r.data?.subjects || [], total: r.data?.total || 0 });
    } catch (err) {
      if (myId !== reqIdRef.current) return;
      toast.error(err.response?.data?.detail || "No se pudieron cargar las asignaturas disponibles.");
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line
  }, [area.id, page, unassignedOnly, search]);

  // Fetch único en mount + reactivo a page/unassignedOnly.
  // Resistente a React Strict Mode (double-invoke en dev): el ref guarda la
  // última combinación servida y se ignora si no cambió.
  useEffect(() => {
    const key = `${page}|${unassignedOnly}`;
    if (prevPageDepsRef.current === key) return;
    prevPageDepsRef.current = key;
    load();
    // eslint-disable-next-line
  }, [page, unassignedOnly]);

  // Search debounced: dispara SÓLO cuando el valor cambia respecto al anterior.
  useEffect(() => {
    if (prevSearchRef.current === search) return;
    prevSearchRef.current = search;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (page !== 1) setPage(1);
      else load();
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const toggle = (s) => {
    const next = new Map(selected);
    if (next.has(s.id)) next.delete(s.id); else next.set(s.id, s);
    setSelected(next);
  };

  const reassignList = Array.from(selected.values()).filter(s => s.current_area_id && s.current_area_id !== area.id);
  const newLinkCount = selected.size - reassignList.length;

  const handleConfirm = async () => {
    setLinking(true);
    try {
      const ids = Array.from(selected.keys());
      const r = await axios.post(`${API}/curricular-areas/${area.id}/subjects/link`, { subject_ids: ids }, { headers });
      const d = r.data;
      const linked = d.linked_count || 0;
      const reassigned = d.reassigned || [];
      const errors = d.errors || [];
      const newOnly = linked - reassigned.length;

      // Toast principal según mezcla
      if (linked === 0 && errors.length === 0) {
        toast.info("Estas asignaturas ya pertenecían a esta área.");
      } else if (reassigned.length === 0) {
        // Solo nuevas vinculaciones
        const names = Array.from(selected.values()).filter(s => !s.current_area_id).map(s => s.name);
        if (linked === 1) toast.success(`Vinculada: ${names[0] || ""} al área`);
        else if (linked <= 3) toast.success(`Vinculadas: ${names.slice(0, 3).join(", ")}`);
        else toast.success(`${linked} asignaturas vinculadas al área`);
      } else if (newOnly === 0) {
        // Solo reasignaciones
        if (reassigned.length === 1) {
          const r0 = reassigned[0];
          toast.success(`${r0.subject_name} reasignada desde ${r0.previous_area_name} a ${area.name}`);
        } else {
          toast.success(`${reassigned.length} asignaturas reasignadas a esta área`);
        }
      } else {
        // Mezcla
        const fromAreas = Array.from(new Set(reassigned.map(r2 => r2.previous_area_name).filter(Boolean)));
        toast.success(`${linked} asignaturas vinculadas, ${reassigned.length} reasignada${reassigned.length === 1 ? "" : "s"} desde ${fromAreas.join(", ")}`);
      }

      // Nota sutil si hubo no-ops
      if (linked < selected.size && reassigned.length + newOnly === linked && linked < selected.size) {
        const noops = selected.size - linked;
        if (noops > 0) toast.info(`${noops} asignatura${noops === 1 ? "" : "s"} ya pertenecía${noops === 1 ? "" : "n"} a esta área`);
      }

      if (errors.length > 0) {
        toast.warning(`${errors.length} no se pudieron vincular: ${errors.map(e => e.error).join("; ")}`);
      }

      // Si NO hubo errores, cerrar. Si hubo errores, mantener abierto para que el usuario vea cuáles.
      if (errors.length === 0) {
        setSelected(new Map());
        onLinked();
      } else {
        // Limpia solo las que SÍ fueron vinculadas
        const errIds = new Set(errors.map(e => e.subject_id));
        const next = new Map();
        selected.forEach((v, k) => { if (errIds.has(k)) next.set(k, v); });
        setSelected(next);
        await load();
        // Notificar al padre para refrescar contador main
        onLinked();
      }
    } catch (err) {
      const code = err.response?.status;
      if (code === 403) toast.error("No tienes permisos.");
      else toast.error(err.response?.data?.detail || "Error de conexión. Intenta nuevamente.");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !linking && onClose()}>
      <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()} data-testid="link-submodal">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Vincular asignaturas a <span style={{ color: area.color || "#0F172A" }}>{area.name}</span></h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" data-testid="link-submodal-close"><X className="w-5 h-5" /></button>
        </header>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3 bg-slate-50/50">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar asignatura..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
              data-testid="link-submodal-search"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={e => { setUnassignedOnly(e.target.checked); setPage(1); }}
              data-testid="unassigned-only-toggle"
            />
            Solo asignaturas sin área
          </label>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6">
              {[0,1,2,3,4].map(i => <div key={i} className="h-9 mb-2 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : data.subjects.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-700 font-medium">{unassignedOnly ? "No hay asignaturas sin área disponibles." : "No hay asignaturas disponibles."}</p>
              {unassignedOnly && <p className="text-xs text-slate-500 mt-1">Desactiva el filtro "Solo sin área" para ver todas y reasignar.</p>}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left w-9"></th>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Código</th>
                  <th className="px-3 py-2 text-left">Grado / Sección</th>
                  <th className="px-3 py-2 text-left">Área actual</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map(s => {
                  const checked = selected.has(s.id);
                  const gradeSection = [s.grade_name, s.section_name].filter(Boolean).join(" / ") || "—";
                  return (
                    <tr key={s.id} className={`border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer ${checked ? "bg-slate-50" : ""}`} onClick={() => toggle(s)} data-testid={`available-row-${s.id}`}>
                      <td className="px-3 py-2"><input type="checkbox" checked={checked} onChange={() => toggle(s)} onClick={e => e.stopPropagation()} /></td>
                      <td className="px-3 py-2 font-medium text-slate-900">{s.name}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs font-mono">{s.code || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{gradeSection}</td>
                      <td className="px-3 py-2">
                        {s.current_area_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> {s.current_area_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">(sin área)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <span>{data.total} disponibles · Página {page} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 bg-white">‹</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 bg-white">›</button>
            </div>
          </div>
        )}

        {/* Warning de reasignación */}
        {reassignList.length > 0 && (
          <div className="px-5 py-3 border-t border-amber-200 bg-amber-50" data-testid="reassign-warning">
            <p className="text-sm text-amber-900 font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4" /> {reassignList.length} asignatura{reassignList.length === 1 ? "" : "s"} será{reassignList.length === 1 ? "" : "n"} reasignada{reassignList.length === 1 ? "" : "s"} a {area.name}:
            </p>
            <ul className="text-xs text-amber-800 ml-5 list-disc">
              {reassignList.slice(0, 5).map(r => <li key={r.id}>{r.name} <span className="italic">(actualmente en {r.current_area_name})</span></li>)}
              {reassignList.length > 5 && <li>… y {reassignList.length - 5} más</li>}
            </ul>
            {newLinkCount > 0 && <p className="text-xs text-amber-700 italic mt-1">Las otras {newLinkCount} no tienen área actual.</p>}
          </div>
        )}

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-white">
          <span className="text-xs text-slate-500">{selected.size} seleccionada{selected.size === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={linking} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0 || linking}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
              data-testid="confirm-link-btn"
            >
              {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Vincular {selected.size} asignatura{selected.size === 1 ? "" : "s"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
