import { useState, useEffect } from "react";
import axios from "axios";
import { X, Copy, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CloneActivityModal({ isOpen, onClose, activity, activityType, token, user, subjectId, onSuccess }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [cloneHere, setCloneHere] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!isOpen) return;
    setCloneHere(false);
    setSelected(new Set());
    setExpanded(new Set());
    (async () => {
      setLoading(true);
      try {
        const [gradeRes, secRes, subRes] = await Promise.all([
          axios.get(`${API}/academic/grades`, { headers }),
          axios.get(`${API}/academic/sections`, { headers }),
          axios.get(`${API}/academic/subjects`, { headers }).catch(() => ({ data: [] })),
        ]);

        const grades = gradeRes.data || [];
        const sections = secRes.data || [];
        const subjects = (Array.isArray(subRes.data) ? subRes.data : subRes.data?.subjects || []);

        const currentSubject = subjects.find(s => s.id === subjectId);
        const currentSectionId = currentSubject?.section_id;

        const teacherSubjectIds = user?.role === "teacher"
          ? new Set(subjects.filter(s => s.teacher_id === user.id).map(s => s.id))
          : null;

        // Build tree: group by nivel > grado > seccion > asignaturas
        const nivelMap = {};
        grades.forEach(g => {
          const nivel = g.nivel || g.level || "General";
          if (!nivelMap[nivel]) nivelMap[nivel] = [];
          nivelMap[nivel].push(g);
        });

        const treeData = Object.entries(nivelMap).map(([nivel, gradosInNivel]) => ({
          key: `nivel_${nivel}`,
          label: nivel,
          type: "nivel",
          children: gradosInNivel.map(grado => {
            const gradoSections = sections.filter(s => s.grado_id === grado.id);
            return {
              key: `grado_${grado.id}`,
              label: grado.nombre || grado.name,
              type: "grado",
              children: gradoSections.map(sec => {
                const secSubjects = subjects
                  .filter(sub => {
                    if (sub.section_id !== sec.id) return false;
                    if (sub.id === subjectId) return false;
                    if (teacherSubjectIds && !teacherSubjectIds.has(sub.id)) return false;
                    return true;
                  })
                  .map(sub => ({
                    key: `sub_${sub.id}`,
                    label: sub.name,
                    type: "subject",
                    subjectId: sub.id,
                    isSameSection: sec.id === currentSectionId,
                  }));
                return {
                  key: `sec_${sec.id}`,
                  label: `Sección ${sec.nombre || sec.name}`,
                  type: "seccion",
                  children: secSubjects,
                };
              }).filter(sec => sec.children.length > 0),
            };
          }).filter(g => g.children.length > 0),
        })).filter(n => n.children.length > 0);

        setTree(treeData);
      } catch (err) {
        console.error("Error loading tree:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen]);

  const toggleExpand = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleSelect = (subjectId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(subjectId) ? next.delete(subjectId) : next.add(subjectId);
      return next;
    });
  };

  const allSubjectIds = [];
  tree.forEach(n => n.children.forEach(g => g.children.forEach(s => s.children.forEach(sub => allSubjectIds.push(sub.subjectId)))));
  const selectAll = () => setSelected(new Set(allSubjectIds));
  const deselectAll = () => setSelected(new Set());

  const handleClone = async () => {
    if (!cloneHere && selected.size === 0) return;
    setCloning(true);
    try {
      const destinos = Array.from(selected).map(sid => ({ subject_id: sid }));
      const url = activityType === "exam"
        ? `${API}/exams/${activity.id}/clonar`
        : `${API}/course/posts/${activity.id}/clonar`;

      const res = await axios.post(url, { destinos, clonar_en_misma_seccion: cloneHere }, { headers });
      const { clonados, errores } = res.data;

      if (errores?.length > 0) {
        toast.warning(`Clonado en ${clonados} asignatura(s). Errores: ${errores.slice(0, 3).join(", ")}`);
      } else {
        toast.success(`Actividad clonada en ${clonados} asignatura(s) exitosamente`);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al clonar");
    } finally {
      setCloning(false);
    }
  };

  if (!isOpen) return null;
  const totalToClone = (cloneHere ? 1 : 0) + selected.size;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()} data-testid="clone-activity-modal">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Copy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">Clonar actividad</h2>
              <p className="text-indigo-200 text-xs truncate max-w-[280px]">{activity?.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/20"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section A */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCloneHere(!cloneHere)} data-testid="clone-here-toggle">
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${cloneHere ? "bg-indigo-500" : "bg-slate-300"}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${cloneHere ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Crear una copia aqui mismo</p>
                <p className="text-xs text-slate-500">Se creara una copia en la misma asignatura</p>
              </div>
            </div>
          </div>

          {/* Section B - Tree */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700">Clonar en otra asignatura</h3>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 transition-colors">Todo</button>
                <button onClick={deselectAll} className="text-[10px] px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors">Ninguno</button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
            ) : tree.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No hay otras asignaturas disponibles</p>
            ) : (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {tree.map(nivel => (
                  <div key={nivel.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {/* Nivel */}
                    <button onClick={() => toggleExpand(nivel.key)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors bg-gradient-to-r from-indigo-50 to-white">
                      {expanded.has(nivel.key) ? <ChevronDown className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />}
                      <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">{nivel.label}</span>
                    </button>
                    {expanded.has(nivel.key) && nivel.children.map(grado => (
                      <div key={grado.key} className="border-t border-slate-100">
                        {/* Grado */}
                        <button onClick={() => toggleExpand(grado.key)}
                          className="w-full flex items-center gap-2 pl-6 pr-3 py-2 hover:bg-slate-50 transition-colors">
                          {expanded.has(grado.key) ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                          <span className="text-xs font-bold text-slate-700">{grado.label}</span>
                          <span className="text-[10px] text-slate-400">({grado.children.length} secc.)</span>
                        </button>
                        {expanded.has(grado.key) && grado.children.map(seccion => (
                          <div key={seccion.key} className="border-t border-slate-50">
                            {/* Sección */}
                            <button onClick={() => toggleExpand(seccion.key)}
                              className="w-full flex items-center gap-2 pl-10 pr-3 py-1.5 hover:bg-slate-50 transition-colors">
                              {expanded.has(seccion.key) ? <ChevronDown className="w-3 h-3 text-slate-300" /> : <ChevronRight className="w-3 h-3 text-slate-300" />}
                              <span className="text-xs font-semibold text-slate-600">{seccion.label}</span>
                              <span className="text-[10px] text-slate-400">({seccion.children.length} asig.)</span>
                            </button>
                            {expanded.has(seccion.key) && seccion.children.map(sub => (
                              <label key={sub.key}
                                className="flex items-center gap-3 pl-14 pr-3 py-1.5 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                                data-testid={`clone-dest-${sub.subjectId}`}>
                                <input type="checkbox" checked={selected.has(sub.subjectId)}
                                  onChange={() => toggleSelect(sub.subjectId)}
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-xs text-slate-700">{sub.label}</span>
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleClone} disabled={cloning || totalToClone === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
            data-testid="clone-confirm-btn">
            {cloning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            {cloning ? "Clonando..." : totalToClone === 0 ? "Selecciona destino" : `Clonar en ${totalToClone} asignatura(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
