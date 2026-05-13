// AreaSubjectsManager — Acordeón colapsable dentro del modal "Editar Área".
//
// Las asignaturas se presentan **agrupadas por nombre normalizado** (slug):
// p. ej. todas las instancias de "Aritmética" en diferentes secciones se
// muestran como UNA fila con badge "N instancias". El backend resuelve los
// instance_ids al hacer link/unlink. Ver `_slug()` en curricular_areas.py.
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
  const [selected, setSelected] = useState(new Map()); // group_key -> group
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
      if (myId !== fetchReqIdRef.current) return;
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

  useEffect(() => {
    if (open) fetchSubjects();
    // eslint-disable-next-line
  }, [open, page]);

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
  const allOnPageSelected = data.subjects.length > 0 && data.subjects.every(g => selected.has(g.group_key));
  const toggleAllOnPage = () => {
    const next = new Map(selected);
    if (allOnPageSelected) data.subjects.forEach(g => next.delete(g.group_key));
    else data.subjects.forEach(g => next.set(g.group_key, g));
    setSelected(next);
  };
  const toggleOne = (g) => {
    const next = new Map(selected);
    if (next.has(g.group_key)) next.delete(g.group_key);
    else next.set(g.group_key, g);
    setSelected(next);
  };

  const doUnlinkGroups = async (groups) => {
    setUnlinking(true);
    try {
      const keys = groups.map(g => g.group_key);
      const r = await axios.post(`${API}/curricular-areas/${area.id}/subjects/unlink`,
        { group_keys: keys }, { headers });
      const d = r.data;
      const unlinkedGroups = d.unlinked_groups || [];
      const totalInstances = d.total_instances_affected || d.unlinked_count || 0;
      if (unlinkedGroups.length === 1) {
        const g = unlinkedGroups[0];
        toast.success(`Desvinculada: ${g.display_name} (${g.instances_count} instancia${g.instances_count === 1 ? "" : "s"})`);
      } else if (unlinkedGroups.length <= 3 && unlinkedGroups.length > 0) {
        const names = unlinkedGroups.map(g => g.display_name).join(", ");
        toast.success(`Desvinculadas: ${names} (${totalInstances} instancia${totalInstances === 1 ? "" : "s"} en total)`);
      } else if (unlinkedGroups.length > 0) {
        toast.success(`${unlinkedGroups.length} asignaturas desvinculadas (${totalInstances} instancia${totalInstances === 1 ? "" : "s"} en total)`);
      }
      if ((d.errors || []).length > 0) {
        toast.warning(`${d.errors.length} grupo${d.errors.length === 1 ? "" : "s"} no se pudo${d.errors.length === 1 ? "" : "n"} procesar`);
      }
      setSelected(new Map());
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
              onClick={() => setConfirm({ type: "many", payload: Array.from(selected.values()) })}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="bulk-unlink-btn"
            >
              <Trash2 className="w-3.5 h-3.5" /> Desvincular seleccionadas ({selected.size})
            </button>
          </div>

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
                    <th className="px-3 py-2 text-left">Asignatura</th>
                    <th className="px-3 py-2 text-center w-12">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjects.map(g => {
                    const checked = selected.has(g.group_key);
                    return (
                      <tr key={g.group_key} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`area-subject-row-${g.group_key}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={checked} onChange={() => toggleOne(g)} data-testid={`subject-checkbox-${g.group_key}`} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{g.display_name}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {g.instances_count} instancia{g.instances_count === 1 ? "" : "s"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setConfirm({ type: "one", payload: g })}
                            disabled={unlinking}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                            title="Desvincular del área"
                            data-testid={`unlink-row-btn-${g.group_key}`}
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

      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => !unlinking && setConfirm(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="unlink-confirm-modal">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">
                  {confirm.type === "one" ? (
                    <>Desvincular <span className="font-semibold">{confirm.payload.display_name}</span>{" "}
                      ({confirm.payload.instances_count} instancia{confirm.payload.instances_count === 1 ? "" : "s"})
                      del área <span className="font-semibold">{area.name}</span>?</>
                  ) : (
                    <>Desvincular <span className="font-semibold">{confirm.payload.length} asignatura{confirm.payload.length === 1 ? "" : "s"}</span>
                      {" "}({confirm.payload.reduce((sum, g) => sum + g.instances_count, 0)} instancias en total)
                      del área <span className="font-semibold">{area.name}</span>?</>
                  )}
                </h4>
                <p className="text-sm text-slate-600 mt-1">Las asignaturas no se eliminarán, solo quedarán sin área curricular asignada.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} disabled={unlinking} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
              <button
                type="button"
                onClick={() => doUnlinkGroups(confirm.type === "one" ? [confirm.payload] : confirm.payload)}
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
// Sub-modal: seleccionar GRUPOS de asignaturas para vincular
// ─────────────────────────────────────────────────────────────────────────────
function LinkSubjectsSubModal({ area, token, onClose, onLinked }) {
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ subjects: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Map()); // group_key -> group
  const [linking, setLinking] = useState(false);
  const debounceRef = useRef(null);
  const prevSearchRef = useRef("");
  const prevPageDepsRef = useRef(null);
  const reqIdRef = useRef(0);
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/curricular-areas/${area.id}/available-subjects`, {
        params: { page, page_size: PAGE_SIZE, search: search || undefined, unassigned_only: unassignedOnly },
        headers,
      });
      if (myId !== reqIdRef.current) return;
      setData({ subjects: r.data?.subjects || [], total: r.data?.total || 0 });
    } catch (err) {
      if (myId !== reqIdRef.current) return;
      toast.error(err.response?.data?.detail || "No se pudieron cargar las asignaturas disponibles.");
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line
  }, [area.id, page, unassignedOnly, search]);

  useEffect(() => {
    const key = `${page}|${unassignedOnly}`;
    if (prevPageDepsRef.current === key) return;
    prevPageDepsRef.current = key;
    load();
    // eslint-disable-next-line
  }, [page, unassignedOnly]);

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
  const toggle = (g) => {
    const next = new Map(selected);
    if (next.has(g.group_key)) next.delete(g.group_key);
    else next.set(g.group_key, g);
    setSelected(next);
  };

  // Reassignment list: groups con current_area_name (excluyendo "Mixto" como categoría especial)
  const reassignList = Array.from(selected.values()).filter(g => g.current_area_name);
  const newOnlyList = Array.from(selected.values()).filter(g => !g.current_area_name);
  const totalInstancesSelected = Array.from(selected.values()).reduce((s, g) => s + (g.instances_count || 0), 0);

  const handleConfirm = async () => {
    setLinking(true);
    try {
      const keys = Array.from(selected.keys());
      const r = await axios.post(`${API}/curricular-areas/${area.id}/subjects/link`,
        { group_keys: keys }, { headers });
      const d = r.data;
      const linkedGroups = d.linked_groups || [];
      const reassignedGroups = d.reassigned_groups || [];
      const errors = d.errors || [];
      const totalInstances = d.total_instances_affected || 0;

      // newOnly: groups con reassigned_instances == 0
      const newGroups = linkedGroups.filter(g => (g.reassigned_instances || 0) === 0);

      if (linkedGroups.length === 0 && errors.length === 0) {
        toast.info("Estas asignaturas ya pertenecían a esta área.");
      } else if (reassignedGroups.length === 0) {
        // Solo nuevas (sin reasignación)
        if (linkedGroups.length === 1) {
          const g = linkedGroups[0];
          toast.success(`Vinculada: ${g.display_name} (${g.instances_count} instancia${g.instances_count === 1 ? "" : "s"}) al área`);
        } else if (linkedGroups.length <= 3) {
          const names = linkedGroups.map(g => g.display_name).join(", ");
          toast.success(`Vinculadas: ${names} (${totalInstances} instancia${totalInstances === 1 ? "" : "s"})`);
        } else {
          toast.success(`${linkedGroups.length} asignaturas vinculadas (${totalInstances} instancia${totalInstances === 1 ? "" : "s"})`);
        }
      } else if (newGroups.length === 0) {
        // Solo reasignaciones
        if (reassignedGroups.length === 1) {
          const r0 = reassignedGroups[0];
          toast.success(`${r0.display_name} (${r0.instances_count} instancia${r0.instances_count === 1 ? "" : "s"}) reasignada desde ${r0.previous_area_name} a ${area.name}`);
        } else {
          toast.success(`${reassignedGroups.length} asignaturas reasignadas a esta área (${totalInstances} instancia${totalInstances === 1 ? "" : "s"})`);
        }
      } else {
        // Mezcla: nuevas + reasignaciones
        const fromAreas = Array.from(new Set(reassignedGroups.map(g => g.previous_area_name).filter(Boolean)));
        const reassignedInst = reassignedGroups.reduce((s, g) => s + g.instances_count, 0);
        toast.success(`${linkedGroups.length} asignaturas vinculadas (${totalInstances} instancias), ${reassignedGroups.length} reasignada${reassignedGroups.length === 1 ? "" : "s"} (${reassignedInst} instancia${reassignedInst === 1 ? "" : "s"}) desde ${fromAreas.join(", ")}`);
      }

      if (errors.length > 0) {
        const msgs = errors.slice(0, 3).map(e => e.error).join("; ");
        toast.warning(`${errors.length} grupo${errors.length === 1 ? "" : "s"} no se pudo${errors.length === 1 ? "" : "n"} procesar: ${msgs}`);
      }

      if (errors.length === 0) {
        setSelected(new Map());
        onLinked();
      } else {
        // Mantener selección de los que fallaron
        const errKeys = new Set(errors.map(e => e.group_key).filter(Boolean));
        const next = new Map();
        selected.forEach((v, k) => { if (errKeys.has(k)) next.set(k, v); });
        setSelected(next);
        await load();
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
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Vincular asignaturas a <span style={{ color: area.color || "#0F172A" }}>{area.name}</span></h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" data-testid="link-submodal-close"><X className="w-5 h-5" /></button>
        </header>

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
                  <th className="px-3 py-2 text-left">Asignatura</th>
                  <th className="px-3 py-2 text-left">Área actual</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map(g => {
                  const checked = selected.has(g.group_key);
                  return (
                    <tr key={g.group_key}
                        className={`border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer ${checked ? "bg-slate-50" : ""}`}
                        onClick={() => toggle(g)}
                        data-testid={`available-row-${g.group_key}`}>
                      <td className="px-3 py-2"><input type="checkbox" checked={checked} onChange={() => toggle(g)} onClick={e => e.stopPropagation()} /></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{g.display_name}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {g.instances_count} instancia{g.instances_count === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {g.is_mixed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-800 border border-orange-200" title="Las instancias están repartidas entre varias áreas y/o sin área">
                            <AlertTriangle className="w-3 h-3" /> Mixto (varias áreas)
                          </span>
                        ) : g.current_area_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> {g.current_area_name}
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

        {data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <span>{data.total} disponibles · Página {page} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 bg-white">‹</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 bg-white">›</button>
            </div>
          </div>
        )}

        {reassignList.length > 0 && (
          <div className="px-5 py-3 border-t border-amber-200 bg-amber-50" data-testid="reassign-warning">
            <p className="text-sm text-amber-900 font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4" /> {reassignList.length} asignatura{reassignList.length === 1 ? "" : "s"} será{reassignList.length === 1 ? "" : "n"} reasignada{reassignList.length === 1 ? "" : "s"} a {area.name}:
            </p>
            <ul className="text-xs text-amber-800 ml-5 list-disc">
              {reassignList.slice(0, 5).map(g => (
                <li key={g.group_key}>
                  {g.display_name} <span className="text-slate-600">({g.instances_count} instancia{g.instances_count === 1 ? "" : "s"})</span>{" "}
                  <span className="italic">(actualmente en {g.current_area_name})</span>
                </li>
              ))}
              {reassignList.length > 5 && <li>… y {reassignList.length - 5} más</li>}
            </ul>
            {newOnlyList.length > 0 && <p className="text-xs text-amber-700 italic mt-1">Las otras {newOnlyList.length} no tienen área actual.</p>}
          </div>
        )}

        <footer className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-white">
          <span className="text-xs text-slate-500">
            {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
            {selected.size > 0 && ` · ${totalInstancesSelected} instancia${totalInstancesSelected === 1 ? "" : "s"} en total`}
          </span>
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
