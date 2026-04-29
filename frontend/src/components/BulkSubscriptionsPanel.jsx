import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Users, CheckSquare, Square, Save, X, ChevronDown, ChevronRight, Tag } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BulkSubscriptionsPanel({ token, concepts, onClose, onSaved }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [allSubs, setAllSubs] = useState([]); // [{student_id, concept_id, is_active}, ...]
  const [loading, setLoading] = useState(true);

  const [selectedConceptId, setSelectedConceptId] = useState(
    concepts.find(c => (c.apply_mode || "none") === "subscription")?.id || ""
  );
  // pendingChanges: Map keyed by student_id -> boolean (desired is_active for selectedConceptId)
  const [pendingChanges, setPendingChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Subscription-mode concepts only (the ones manageable per student)
  const subscriptionConcepts = useMemo(
    () => concepts.filter(c => (c.apply_mode || "none") === "subscription"),
    [concepts]
  );

  // Initial load: students, grades, sections, and ALL subscriptions for the school
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [usersRes, gradesRes, sectionsRes, subsRes] = await Promise.all([
          axios.get(`${API}/users`, { headers }),
          axios.get(`${API}/academic/grades`, { headers }),
          axios.get(`${API}/academic/sections`, { headers }),
          axios.get(`${API}/accounting/concept-subscriptions/all`, { headers }).catch(() => ({ data: { subscriptions: [] } })),
        ]);
        if (!mounted) return;
        const usersList = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data.users || []);
        const studentList = usersList.filter(
          u => u.role === "student" && (u.status === "active" || u.status === "enrolled" || !u.status)
        );
        setStudents(studentList);
        setGrades((gradesRes.data || []).filter(g => g.activo));
        setSections((sectionsRes.data || []).filter(s => s.activo));
        setAllSubs(subsRes.data?.subscriptions || []);
      } catch (e) {
        toast.error(e.response?.data?.detail || "Error al cargar datos");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [headers]);

  // Reset pending when concept changes
  useEffect(() => {
    setPendingChanges({});
  }, [selectedConceptId]);

  // Fast lookup: subscriptions for selected concept => student_id -> is_active
  const currentSubsByStudent = useMemo(() => {
    const map = {};
    for (const s of allSubs) {
      if (s.concept_id === selectedConceptId) {
        map[s.student_id] = !!s.is_active;
      }
    }
    return map;
  }, [allSubs, selectedConceptId]);

  // Effective state: pending overrides current
  const isStudentActive = useCallback((studentId) => {
    if (Object.prototype.hasOwnProperty.call(pendingChanges, studentId)) {
      return pendingChanges[studentId];
    }
    return !!currentSubsByStudent[studentId];
  }, [pendingChanges, currentSubsByStudent]);

  // Group students by section. Build sortable groups.
  const grouped = useMemo(() => {
    const sectionMap = new Map(sections.map(s => [s.id, s]));
    const gradeMap = new Map(grades.map(g => [g.id, g]));
    const groups = {}; // key: seccion_id|"none" -> { label, students, sortKey }
    for (const st of students) {
      const sec = sectionMap.get(st.seccion_id);
      const gr = gradeMap.get(st.grado_id);
      const key = st.seccion_id || "none";
      if (!groups[key]) {
        const label = sec
          ? `${gr ? `${gr.nivel_nombre || ""} ${gr.nombre || ""}`.trim() : ""} ${sec.nombre || ""}`.trim()
          : "Sin sección asignada";
        groups[key] = {
          key,
          label: label || "Sin sección asignada",
          students: [],
          sortKey: `${gr?.nivel_nombre || "ZZZ"}_${gr?.nombre || "ZZZ"}_${sec?.nombre || "ZZZ"}`,
        };
      }
      groups[key].students.push(st);
    }
    Object.values(groups).forEach(g => {
      g.students.sort((a, b) =>
        (`${a.last_name || ""} ${a.name || ""}`).localeCompare(`${b.last_name || ""} ${b.name || ""}`)
      );
    });
    return Object.values(groups).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [students, sections, grades]);

  const toggleStudent = (studentId) => {
    const currentEffective = isStudentActive(studentId);
    const newValue = !currentEffective;
    const initialValue = !!currentSubsByStudent[studentId];
    setPendingChanges(prev => {
      const next = { ...prev };
      if (newValue === initialValue) {
        // Reverted to original; remove pending
        delete next[studentId];
      } else {
        next[studentId] = newValue;
      }
      return next;
    });
  };

  const markAll = (value) => {
    if (!selectedConceptId) {
      toast.error("Selecciona un concepto primero");
      return;
    }
    const next = {};
    for (const st of students) {
      const initialValue = !!currentSubsByStudent[st.id];
      if (value !== initialValue) {
        next[st.id] = value;
      }
    }
    setPendingChanges(next);
    toast.success(value ? "Todos marcados (pendiente de guardar)" : "Todos desmarcados (pendiente de guardar)");
  };

  const toggleCollapse = (key) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const pendingCount = Object.keys(pendingChanges).length;

  const handleSave = async () => {
    if (!selectedConceptId) {
      toast.error("Selecciona un concepto");
      return;
    }
    if (pendingCount === 0) {
      toast.info("No hay cambios para guardar");
      return;
    }
    setSaving(true);
    try {
      const changes = Object.entries(pendingChanges).map(([student_id, is_active]) => ({
        student_id,
        concept_id: selectedConceptId,
        is_active,
      }));
      const res = await axios.post(
        `${API}/accounting/concept-subscriptions/bulk`,
        { changes },
        { headers },
      );
      const r = res.data || {};
      toast.success(
        `Guardado: ${r.created || 0} creadas · ${r.updated || 0} actualizadas · ${r.deactivated || 0} desactivadas${r.errors ? ` · ${r.errors} errores` : ""}`
      );
      // Refresh all subs from server
      const subsRes = await axios.get(`${API}/accounting/concept-subscriptions/all`, { headers }).catch(() => ({ data: { subscriptions: [] } }));
      setAllSubs(subsRes.data?.subscriptions || []);
      setPendingChanges({});
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al guardar el lote");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden" data-testid="bulk-subscriptions-panel">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Modo masivo de suscripciones</h3>
            <p className="text-xs text-slate-600">Aplica un concepto a múltiples alumnos a la vez.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
          data-testid="bulk-close-btn"
        >
          <X className="w-4 h-4" />
          Salir del modo masivo
        </button>
      </div>

      {/* Concept selector + bulk actions */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <Tag className="w-4 h-4 text-indigo-500 shrink-0" />
            <select
              value={selectedConceptId}
              onChange={(e) => setSelectedConceptId(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              data-testid="bulk-concept-select"
            >
              <option value="">— Selecciona un concepto —</option>
              {subscriptionConcepts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} (S/ {Number(c.amount || 0).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => markAll(true)}
              disabled={!selectedConceptId}
              className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              data-testid="bulk-mark-all-btn"
            >
              <CheckSquare className="w-4 h-4" />
              Marcar todos
            </button>
            <button
              onClick={() => markAll(false)}
              disabled={!selectedConceptId}
              className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-300 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              data-testid="bulk-unmark-all-btn"
            >
              <Square className="w-4 h-4" />
              Desmarcar todos
            </button>
          </div>
        </div>
        {subscriptionConcepts.length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No hay conceptos en modo "Por suscripción". Crea uno desde la pestaña Configuración.
          </p>
        )}
      </div>

      {/* Students list */}
      <div className="max-h-[480px] overflow-y-auto" data-testid="bulk-students-list">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : !selectedConceptId ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Selecciona un concepto para ver y gestionar el listado de alumnos.
          </div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No hay alumnos activos en el colegio.
          </div>
        ) : (
          <div>
            {grouped.map(group => {
              const isCollapsed = !!collapsedSections[group.key];
              const activeInGroup = group.students.filter(st => isStudentActive(st.id)).length;
              return (
                <div key={group.key} className="border-b border-slate-100 last:border-b-0">
                  <button
                    onClick={() => toggleCollapse(group.key)}
                    className="w-full px-5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-left sticky top-0 z-10"
                    data-testid={`bulk-section-header-${group.key}`}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4 text-slate-500" />
                        : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      <span className="text-sm font-bold text-slate-700">{group.label}</span>
                      <span className="text-xs text-slate-500">({group.students.length} alumnos)</span>
                    </div>
                    <span className="text-xs font-semibold text-indigo-600">
                      {activeInGroup} activos
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {group.students.map(st => {
                        const active = isStudentActive(st.id);
                        const isPending = Object.prototype.hasOwnProperty.call(pendingChanges, st.id);
                        return (
                          <div
                            key={st.id}
                            className={`px-5 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${isPending ? "bg-amber-50/40" : ""}`}
                            data-testid={`bulk-student-row-${st.id}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <button
                                onClick={() => toggleStudent(st.id)}
                                className="shrink-0"
                                data-testid={`bulk-student-toggle-${st.id}`}
                              >
                                {active
                                  ? <CheckSquare className="w-5 h-5 text-emerald-600" />
                                  : <Square className="w-5 h-5 text-slate-400" />}
                              </button>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {st.last_name} {st.name}
                                </p>
                                <p className="text-xs text-slate-500 truncate">DNI: {st.dni || "—"}</p>
                              </div>
                            </div>
                            {isPending && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                                Pendiente
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer save */}
      <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-600">
          <span className="font-bold text-slate-800">{pendingCount}</span> cambio{pendingCount === 1 ? "" : "s"} pendiente{pendingCount === 1 ? "" : "s"} de guardar
        </p>
        <button
          onClick={handleSave}
          disabled={saving || pendingCount === 0 || !selectedConceptId}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          data-testid="bulk-save-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
