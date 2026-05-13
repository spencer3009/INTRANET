// AreaSubjectsManager — Acordeón de Asignaturas del área.
//
// Sprint A: agrupación por nombre normalizado (slug). Cada fila = 1 grupo
// conceptual (ej. "Aritmética") que consolida sus N instancias por sección.
//
// Sprint B: doble agrupación. Las instancias del área se reagrupan PRIMERO
// por (nivel, grado) y dentro de cada nivel-grado se muestran los grupos
// conceptuales. Esto refleja una libreta MINEDU real: la composición del
// área cambia según el grado del alumno.
//
// Para operaciones masivas de desvinculación, se usan los `instance_ids`
// específicos del breakdown (legacy `subject_ids`), no el filtro group/grade
// del backend — porque la selección puede ser arbitraria por (grupo, grado).
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight as ChevRight, Search, Plus, Trash2,
  Loader2, Link2, X, AlertTriangle, Inbox, Layers,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PAGE_SIZE = 20;
const NO_GRADE = "__no_grade__"; // bucket especial para subjects sin grade_id

export default function AreaSubjectsManager({ area, token, onChange, embedded = false }) {
  const [open, setOpen] = useState(embedded);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ subjects: [], total: 0 });
  // selected: Map<"groupkey|gradeKey", {group_key, display_name, grade_id, grade_name, level_name, instance_ids, instances_count}>
  const [selected, setSelected] = useState(new Map());
  const [collapsedGrades, setCollapsedGrades] = useState(new Set()); // grade keys colapsados
  const [unlinking, setUnlinking] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [subModal, setSubModal] = useState(false);
  const debounceRef = useRef(null);
  const fetchReqIdRef = useRef(0);
  const prevSearchRef = useRef("");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchSubjects = useCallback(async () => {
    if (!area?.id) return;
    const myId = ++fetchReqIdRef.current;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/curricular-areas/${area.id}/subjects`, {
        params: { page: 1, page_size: 500, search: search || undefined },
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
      else toast.error(err.response?.data?.detail || "No se pudieron cargar las asignaturas.");
      setData({ subjects: [], total: 0 });
    } finally {
      if (myId === fetchReqIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line
  }, [area?.id, search]);

  useEffect(() => {
    if (open) fetchSubjects();
    // eslint-disable-next-line
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (prevSearchRef.current === search) return;
    prevSearchRef.current = search;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSubjects(), 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [search]);

  // Aplanar data.subjects → filas (group, grade). Reagrupar por (grade_id).
  const gradeBuckets = (() => {
    const buckets = new Map(); // grade_key -> {grade_id, grade_name, level_name, level_order, grade_order, items: []}
    for (const g of data.subjects) {
      for (const b of (g.grade_breakdown || [])) {
        const gradeKey = b.grade_id || NO_GRADE;
        if (!buckets.has(gradeKey)) {
          buckets.set(gradeKey, {
            grade_key: gradeKey,
            grade_id: b.grade_id,
            grade_name: b.grade_name,
            level_id: b.level_id,
            level_name: b.level_name,
            level_order: b.level_order,
            grade_order: b.grade_order,
            items: [],
          });
        }
        buckets.get(gradeKey).items.push({
          group_key: g.group_key,
          display_name: g.display_name,
          instance_ids: b.instance_ids,
          instances_count: b.instances_count,
          grade_id: b.grade_id,
          grade_name: b.grade_name,
          level_name: b.level_name,
        });
      }
    }
    // Ordenar items por display_name dentro de cada bucket
    for (const v of buckets.values()) {
      v.items.sort((a, b) => a.display_name.localeCompare(b.display_name, "es"));
    }
    // Ordenar buckets por (level_order, grade_order)
    return Array.from(buckets.values()).sort((a, b) =>
      a.level_order - b.level_order || a.grade_order - b.grade_order
    );
  })();

  const keyOf = (item) => `${item.group_key}|${item.grade_id || NO_GRADE}`;
  const toggleItem = (item) => {
    const next = new Map(selected);
    const k = keyOf(item);
    if (next.has(k)) next.delete(k);
    else next.set(k, item);
    setSelected(next);
  };
  const toggleBucket = (bucket) => {
    const next = new Map(selected);
    const allChecked = bucket.items.every(it => next.has(keyOf(it)));
    if (allChecked) bucket.items.forEach(it => next.delete(keyOf(it)));
    else bucket.items.forEach(it => next.set(keyOf(it), it));
    setSelected(next);
  };
  const toggleCollapse = (gradeKey) => {
    const next = new Set(collapsedGrades);
    if (next.has(gradeKey)) next.delete(gradeKey);
    else next.add(gradeKey);
    setCollapsedGrades(next);
  };

  const totalInstancesSelected = Array.from(selected.values())
    .reduce((s, it) => s + it.instances_count, 0);

  const doUnlinkItems = async (items) => {
    setUnlinking(true);
    try {
      const subjectIds = items.flatMap(it => it.instance_ids);
      const r = await axios.post(`${API}/curricular-areas/${area.id}/subjects/unlink`,
        { subject_ids: subjectIds }, { headers });
      const d = r.data || {};
      const totalInst = d.unlinked_count || 0;
      // Toast contextual
      if (items.length === 1) {
        const it = items[0];
        const ctx = it.grade_name ? ` en ${it.level_name} ${it.grade_name}` : "";
        toast.success(`Desvinculada: ${it.display_name}${ctx} (${it.instances_count} instancia${it.instances_count === 1 ? "" : "s"})`);
      } else if (items.length <= 3) {
        const names = items.map(it => it.display_name).join(", ");
        toast.success(`Desvinculadas: ${names} (${totalInst} instancia${totalInst === 1 ? "" : "s"})`);
      } else {
        toast.success(`${items.length} asignaturas desvinculadas (${totalInst} instancia${totalInst === 1 ? "" : "s"})`);
      }
      if ((d.errors || []).length > 0) {
        toast.warning(`${d.errors.length} no se pudo${d.errors.length === 1 ? "" : "n"} desvincular`);
      }
      setSelected(new Map());
      await fetchSubjects();
      onChange && onChange();
    } catch (err) {
      const code = err.response?.status;
      if (code === 403) toast.error("No tienes permisos.");
      else toast.error(err.response?.data?.detail || "Error de conexión.");
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

  const count = loadedOnce ? data.subjects.reduce((s, g) => s + g.instances_count, 0) : (area?.subjects_count ?? 0);

  return (
    <div className={embedded ? "" : "mt-4 border border-slate-200 rounded-xl overflow-hidden"} data-testid="area-subjects-manager">
      {!embedded && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-900"
          data-testid="area-subjects-accordion-toggle"
        >
          <span className="flex items-center gap-2">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevRight className="w-4 h-4" />}
            Asignaturas vinculadas ({count})
          </span>
          {open && <span className="text-[11px] font-normal text-slate-500 italic">Los cambios se guardan automáticamente</span>}
        </button>
      )}

      {open && (
        <div className="bg-white" data-testid="area-subjects-panel">
          <div className="px-3 py-2.5 border-b border-slate-200 flex flex-wrap items-center gap-2 bg-slate-50/50 sticky top-0 z-10">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar asignatura..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
                data-testid="area-subjects-search" />
            </div>
            <button type="button" onClick={() => setSubModal(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
              data-testid="open-link-submodal-btn">
              <Plus className="w-3.5 h-3.5" /> Vincular asignaturas
            </button>
            <button type="button" disabled={selected.size === 0 || unlinking}
              onClick={() => setConfirm({ type: "many", items: Array.from(selected.values()) })}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="bulk-unlink-btn">
              <Trash2 className="w-3.5 h-3.5" /> Desvincular seleccionadas ({selected.size})
              {totalInstancesSelected > 0 && ` · ${totalInstancesSelected} inst.`}
            </button>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {loading && !loadedOnce ? (
              <div className="p-6">{[0,1,2,3].map(i => <div key={i} className="h-9 mb-2 bg-slate-100 rounded animate-pulse" />)}</div>
            ) : gradeBuckets.length === 0 ? (
              <div className="px-6 py-10 text-center" data-testid="area-subjects-empty">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-700 font-medium">No hay asignaturas vinculadas a esta área.</p>
                <p className="text-xs text-slate-500 mt-1">Haz clic en "Vincular asignaturas" para empezar.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {gradeBuckets.map(bucket => {
                  const isCollapsed = collapsedGrades.has(bucket.grade_key);
                  const allChecked = bucket.items.length > 0 && bucket.items.every(it => selected.has(keyOf(it)));
                  const someChecked = bucket.items.some(it => selected.has(keyOf(it)));
                  const headerLabel = bucket.grade_id
                    ? `${bucket.level_name || ""} · ${bucket.grade_name || ""}`
                    : "Sin grado asignado";
                  const totalInBucket = bucket.items.reduce((s, it) => s + it.instances_count, 0);
                  return (
                    <div key={bucket.grade_key} data-testid={`grade-bucket-${bucket.grade_key}`}>
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/70 hover:bg-slate-100 border-b border-slate-100">
                        <input type="checkbox" checked={allChecked}
                          ref={el => { if (el) el.indeterminate = !allChecked && someChecked; }}
                          onChange={() => toggleBucket(bucket)}
                          data-testid={`bucket-checkbox-${bucket.grade_key}`} />
                        <button type="button" onClick={() => toggleCollapse(bucket.grade_key)}
                          className="flex items-center gap-1.5 flex-1 text-left">
                          {isCollapsed ? <ChevRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-700" />}
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">{headerLabel}</span>
                          <span className="text-[10px] font-medium text-slate-500">
                            ({bucket.items.length} asignatura{bucket.items.length === 1 ? "" : "s"} · {totalInBucket} instancia{totalInBucket === 1 ? "" : "s"})
                          </span>
                        </button>
                      </div>
                      {!isCollapsed && (
                        <table className="w-full text-sm">
                          <tbody>
                            {bucket.items.map(it => {
                              const checked = selected.has(keyOf(it));
                              return (
                                <tr key={keyOf(it)} className="hover:bg-slate-50/60" data-testid={`area-subject-row-${it.group_key}-${bucket.grade_key}`}>
                                  <td className="pl-9 pr-3 py-1.5 w-8">
                                    <input type="checkbox" checked={checked} onChange={() => toggleItem(it)}
                                      data-testid={`subject-checkbox-${it.group_key}-${bucket.grade_key}`} />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-slate-900">{it.display_name}</span>
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                        {it.instances_count} instancia{it.instances_count === 1 ? "" : "s"}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-1.5 text-right w-12">
                                    <button type="button" onClick={() => setConfirm({ type: "one", items: [it] })}
                                      disabled={unlinking}
                                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                                      title="Desvincular del área"
                                      data-testid={`unlink-row-btn-${it.group_key}-${bucket.grade_key}`}>
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
                  );
                })}
              </div>
            )}
          </div>
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
                  {confirm.items.length === 1 ? (
                    <>Desvincular <span className="font-semibold">{confirm.items[0].display_name}</span>{" "}
                      {confirm.items[0].grade_name && <span className="text-slate-600 text-xs">({confirm.items[0].level_name} {confirm.items[0].grade_name})</span>}{" "}
                      ({confirm.items[0].instances_count} instancia{confirm.items[0].instances_count === 1 ? "" : "s"})
                      del área <span className="font-semibold">{area.name}</span>?</>
                  ) : (
                    <>Desvincular <span className="font-semibold">{confirm.items.length} asignaturas</span>
                      {" "}({confirm.items.reduce((s, it) => s + it.instances_count, 0)} instancias en total)
                      del área <span className="font-semibold">{area.name}</span>?</>
                  )}
                </h4>
                <p className="text-sm text-slate-600 mt-1">Las asignaturas no se eliminarán, solo quedarán sin área curricular asignada.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} disabled={unlinking} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
              <button type="button" onClick={() => doUnlinkItems(confirm.items)} disabled={unlinking}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                data-testid="confirm-unlink-btn">
                {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Sí, desvincular
              </button>
            </div>
          </div>
        </div>
      )}

      {subModal && (
        <LinkSubjectsSubModal area={area} token={token} onClose={() => setSubModal(false)} onLinked={handleSubModalLinked} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-modal: 1° elige GRADOS destino → 2° elige GRUPOS de asignaturas
// ─────────────────────────────────────────────────────────────────────────────
function LinkSubjectsSubModal({ area, token, onClose, onLinked }) {
  const [shortcuts, setShortcuts] = useState([]);
  const [grades, setGrades] = useState([]);
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);
  const [selectedGradeIds, setSelectedGradeIds] = useState(new Set());
  const [activeShortcut, setActiveShortcut] = useState(null);
  const [showIndividual, setShowIndividual] = useState(false);

  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ subjects: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Map());
  const [linking, setLinking] = useState(false);
  const debounceRef = useRef(null);
  const prevDepsRef = useRef(null);
  const reqIdRef = useRef(0);
  const headers = { Authorization: `Bearer ${token}` };

  // 1) Cargar atajos de grados
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/curricular-areas/grade-shortcuts`, { headers });
        setShortcuts(r.data?.shortcuts || []);
        setGrades(r.data?.grades || []);
        // Atajo por defecto: "Todos los grados"
        const allShortcut = (r.data?.shortcuts || []).find(s => s.key === "all");
        if (allShortcut) {
          setSelectedGradeIds(new Set(allShortcut.grade_ids));
          setActiveShortcut("all");
        }
        setShortcutsLoaded(true);
      } catch {
        toast.error("No se pudieron cargar los grados.");
        setShortcutsLoaded(true);
      }
    })();
    // eslint-disable-next-line
  }, []);

  // 2) Cargar asignaturas disponibles según grados seleccionados
  const load = useCallback(async () => {
    if (!shortcutsLoaded) return;
    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const gradeCsv = Array.from(selectedGradeIds).join(",");
      const r = await axios.get(`${API}/curricular-areas/${area.id}/available-subjects`, {
        params: {
          page: 1, page_size: 200,
          search: search || undefined,
          unassigned_only: unassignedOnly,
          grade_ids: gradeCsv || undefined,
        },
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
  }, [area.id, unassignedOnly, search, selectedGradeIds, shortcutsLoaded]);

  useEffect(() => {
    if (!shortcutsLoaded) return;
    const key = `${unassignedOnly}|${Array.from(selectedGradeIds).sort().join(",")}`;
    if (prevDepsRef.current === key) return;
    prevDepsRef.current = key;
    load();
    // eslint-disable-next-line
  }, [unassignedOnly, selectedGradeIds, shortcutsLoaded]);

  useEffect(() => {
    if (!shortcutsLoaded) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(), 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [search]);

  const applyShortcut = (sc) => {
    setSelectedGradeIds(new Set(sc.grade_ids));
    setActiveShortcut(sc.key);
    setSelected(new Map()); // reset selección al cambiar scope
  };
  const toggleGradeIndividual = (gid) => {
    const next = new Set(selectedGradeIds);
    if (next.has(gid)) next.delete(gid);
    else next.add(gid);
    setSelectedGradeIds(next);
    setActiveShortcut(null); // ya no es un atajo "puro"
    setSelected(new Map());
  };

  const toggle = (g) => {
    const next = new Map(selected);
    if (next.has(g.group_key)) next.delete(g.group_key);
    else next.set(g.group_key, g);
    setSelected(next);
  };

  const reassignList = Array.from(selected.values()).filter(g => g.current_area_name);
  const newOnlyList = Array.from(selected.values()).filter(g => !g.current_area_name);
  const totalInstSelected = Array.from(selected.values()).reduce((s, g) => s + g.instances_count, 0);

  const handleConfirm = async () => {
    if (selectedGradeIds.size === 0) {
      toast.warning("Selecciona al menos un grado destino.");
      return;
    }
    setLinking(true);
    try {
      const keys = Array.from(selected.keys());
      const r = await axios.post(`${API}/curricular-areas/${area.id}/subjects/link`,
        { group_keys: keys, grade_ids: Array.from(selectedGradeIds) },
        { headers });
      const d = r.data;
      const linkedGroups = d.linked_groups || [];
      const reassignedGroups = d.reassigned_groups || [];
      const errors = d.errors || [];
      const totalInstances = d.total_instances_affected || 0;
      const newGroups = linkedGroups.filter(g => (g.reassigned_instances || 0) === 0);

      if (linkedGroups.length === 0 && errors.length === 0) {
        toast.info("Estas asignaturas ya pertenecían a esta área.");
      } else if (reassignedGroups.length === 0) {
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
        if (reassignedGroups.length === 1) {
          const r0 = reassignedGroups[0];
          toast.success(`${r0.display_name} (${r0.instances_count} instancia${r0.instances_count === 1 ? "" : "s"}) reasignada desde ${r0.previous_area_name} a ${area.name}`);
        } else {
          toast.success(`${reassignedGroups.length} asignaturas reasignadas a esta área (${totalInstances} instancia${totalInstances === 1 ? "" : "s"})`);
        }
      } else {
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
        await load();
      }
    } catch (err) {
      const code = err.response?.status;
      if (code === 403) toast.error("No tienes permisos.");
      else toast.error(err.response?.data?.detail || "Error de conexión.");
    } finally {
      setLinking(false);
    }
  };

  const gradesByLevel = (() => {
    const out = new Map();
    for (const g of grades) {
      const k = g.level_id;
      if (!out.has(k)) out.set(k, { level_name: g.level_name, level_order: g.level_order, items: [] });
      out.get(k).items.push(g);
    }
    return Array.from(out.values()).sort((a, b) => a.level_order - b.level_order);
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !linking && onClose()}>
      <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()} data-testid="link-submodal">
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Vincular asignaturas a <span style={{ color: area.color || "#0F172A" }}>{area.name}</span></h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" data-testid="link-submodal-close"><X className="w-5 h-5" /></button>
        </header>

        {/* Paso 1 — Grados destino */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/40">
          <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">① Grados destino ({selectedGradeIds.size} de {grades.length})</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {shortcuts.map(sc => (
              <button key={sc.key} type="button" onClick={() => applyShortcut(sc)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${activeShortcut === sc.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"}`}
                data-testid={`grade-shortcut-${sc.key}`}>
                {sc.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowIndividual(s => !s)} className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1" data-testid="toggle-individual-grades">
            {showIndividual ? <ChevronDown className="w-3 h-3" /> : <ChevRight className="w-3 h-3" />}
            Selección individual
          </button>
          {showIndividual && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1 pl-4 border-l-2 border-slate-200">
              {gradesByLevel.map(lvl => (
                <div key={lvl.level_name} className="text-xs">
                  <p className="font-semibold text-slate-700 mt-1 mb-0.5 uppercase tracking-wide text-[10px]">{lvl.level_name}</p>
                  {lvl.items.map(g => (
                    <label key={g.id} className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-slate-100 rounded px-1">
                      <input type="checkbox" checked={selectedGradeIds.has(g.id)} onChange={() => toggleGradeIndividual(g.id)} data-testid={`grade-checkbox-${g.id}`} />
                      <span>{g.name}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paso 2 — Búsqueda + Toggle + Tabla */}
        <div className="px-5 py-2 border-b border-slate-200 flex flex-wrap items-center gap-3 bg-white">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">② Asignaturas:</p>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar asignatura..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
              data-testid="link-submodal-search" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input type="checkbox" checked={unassignedOnly} onChange={e => setUnassignedOnly(e.target.checked)} data-testid="unassigned-only-toggle" />
            Solo asignaturas sin área
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6">{[0,1,2,3].map(i => <div key={i} className="h-9 mb-2 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : selectedGradeIds.size === 0 ? (
            <div className="px-6 py-12 text-center">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-700 font-medium">Selecciona al menos un grado destino arriba</p>
            </div>
          ) : data.subjects.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-700 font-medium">{unassignedOnly ? "No hay asignaturas sin área en los grados seleccionados." : "No hay asignaturas disponibles."}</p>
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-800 border border-orange-200">
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

        {reassignList.length > 0 && (
          <div className="px-5 py-3 border-t border-amber-200 bg-amber-50" data-testid="reassign-warning">
            <p className="text-sm text-amber-900 font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4" /> {reassignList.length} asignatura{reassignList.length === 1 ? "" : "s"} será{reassignList.length === 1 ? "" : "n"} reasignada{reassignList.length === 1 ? "" : "s"} a {area.name}:
            </p>
            <ul className="text-xs text-amber-800 ml-5 list-disc">
              {reassignList.slice(0, 5).map(g => (
                <li key={g.group_key}>{g.display_name} <span className="text-slate-600">({g.instances_count} instancia{g.instances_count === 1 ? "" : "s"})</span>{" "}<span className="italic">(actualmente en {g.current_area_name})</span></li>
              ))}
              {reassignList.length > 5 && <li>… y {reassignList.length - 5} más</li>}
            </ul>
            {newOnlyList.length > 0 && <p className="text-xs text-amber-700 italic mt-1">Las otras {newOnlyList.length} no tienen área actual.</p>}
          </div>
        )}

        <footer className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-white">
          <span className="text-xs text-slate-500">
            {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
            {selected.size > 0 && ` · ${totalInstSelected} instancia${totalInstSelected === 1 ? "" : "s"} en ${selectedGradeIds.size} grado${selectedGradeIds.size === 1 ? "" : "s"}`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={linking} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
            <button type="button" onClick={handleConfirm} disabled={selected.size === 0 || selectedGradeIds.size === 0 || linking}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
              data-testid="confirm-link-btn">
              {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Vincular {selected.size} a {selectedGradeIds.size} grado{selectedGradeIds.size === 1 ? "" : "s"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
