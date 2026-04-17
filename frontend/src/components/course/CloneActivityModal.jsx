import { useState, useEffect } from "react";
import axios from "axios";
import { X, Copy, Loader2, Check, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CloneActivityModal({ isOpen, onClose, activity, activityType, token, user, subjectId, onSuccess }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [cloneHere, setCloneHere] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [expandedGrades, setExpandedGrades] = useState(new Set());

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!isOpen) return;
    setCloneHere(false);
    setSelected(new Set());
    (async () => {
      setLoading(true);
      try {
        const [secRes, gradeRes, subRes] = await Promise.all([
          axios.get(`${API}/academic/sections`, { headers }),
          axios.get(`${API}/academic/grades`, { headers }),
          axios.get(`${API}/subjects`, { headers }).catch(() => ({ data: [] })),
        ]);

        const allSections = secRes.data || [];
        const allGrades = gradeRes.data || [];
        const allSubjects = subRes.data || [];

        const currentSubject = allSubjects.find(s => s.id === subjectId);
        const currentSectionId = currentSubject?.section_id;
        const subjectName = currentSubject?.name;

        const gradeMap = {};
        allGrades.forEach(g => { gradeMap[g.id] = g.nombre || g.name; });

        const teacherSectionIds = user?.role === "teacher"
          ? new Set(allSubjects.filter(s => s.teacher_id === user.id).map(s => s.section_id))
          : null;

        const items = allSections
          .filter(sec => {
            if (sec.id === currentSectionId) return false;
            if (teacherSectionIds && !teacherSectionIds.has(sec.id)) return false;
            const hasSubject = allSubjects.some(s => s.section_id === sec.id && s.name === subjectName);
            return hasSubject;
          })
          .map(sec => ({
            seccion_id: sec.id,
            seccion_nombre: sec.nombre || sec.name,
            grado_id: sec.grado_id,
            grado_nombre: gradeMap[sec.grado_id] || "Sin grado",
            label: `${gradeMap[sec.grado_id] || "?"} - Seccion ${sec.nombre || sec.name}`,
          }));

        setSections(items);
        setExpandedGrades(new Set(items.map(i => i.grado_id)));
      } catch (err) {
        console.error("Error loading sections:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen]);

  const toggleSection = (secId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(secId) ? next.delete(secId) : next.add(secId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(sections.map(s => s.seccion_id)));
  const deselectAll = () => setSelected(new Set());

  const grouped = sections.reduce((acc, s) => {
    if (!acc[s.grado_id]) acc[s.grado_id] = { nombre: s.grado_nombre, items: [] };
    acc[s.grado_id].items.push(s);
    return acc;
  }, {});

  const handleClone = async () => {
    if (!cloneHere && selected.size === 0) return;
    setCloning(true);
    try {
      const destinos = Array.from(selected).map(secId => {
        const sec = sections.find(s => s.seccion_id === secId);
        return { seccion_id: secId, grado_id: sec?.grado_id };
      });

      const url = activityType === "exam"
        ? `${API}/exams/${activity.id}/clonar`
        : `${API}/course/posts/${activity.id}/clonar`;

      const res = await axios.post(url, { destinos, clonar_en_misma_seccion: cloneHere }, { headers });
      const { clonados, errores } = res.data;

      if (errores?.length > 0) {
        toast.warning(`Clonado en ${clonados} seccion(es). Errores: ${errores.join(", ")}`);
      } else {
        toast.success(`Actividad clonada en ${clonados} seccion(es) exitosamente`);
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" data-testid="clone-activity-modal">
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
          {/* Section A - Clone here */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <label className="flex items-center gap-3 cursor-pointer" data-testid="clone-here-toggle">
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${cloneHere ? "bg-indigo-500" : "bg-slate-300"}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${cloneHere ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Crear una copia aqui mismo</p>
                <p className="text-xs text-slate-500">Se creara una copia en la misma seccion actual</p>
              </div>
            </label>
          </div>

          {/* Section B - Other sections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700">Clonar en otros grados/secciones</h3>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 transition-colors">Seleccionar todos</button>
                <button onClick={deselectAll} className="text-[10px] px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors">Deseleccionar</button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
            ) : sections.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No hay otras secciones disponibles con esta asignatura</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {Object.entries(grouped).map(([gradeId, group]) => (
                  <div key={gradeId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <button onClick={() => setExpandedGrades(prev => {
                      const next = new Set(prev);
                      next.has(gradeId) ? next.delete(gradeId) : next.add(gradeId);
                      return next;
                    })} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                      {expandedGrades.has(gradeId) ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                      <span className="text-xs font-bold text-slate-700">{group.nombre}</span>
                      <span className="text-[10px] text-slate-400">({group.items.length} seccion{group.items.length > 1 ? "es" : ""})</span>
                    </button>
                    {expandedGrades.has(gradeId) && (
                      <div className="border-t border-slate-100">
                        {group.items.map(sec => (
                          <label key={sec.seccion_id} className="flex items-center gap-3 px-4 py-2 hover:bg-indigo-50/50 cursor-pointer transition-colors" data-testid={`clone-dest-${sec.seccion_id}`}>
                            <input type="checkbox" checked={selected.has(sec.seccion_id)}
                              onChange={() => toggleSection(sec.seccion_id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm text-slate-700">Seccion {sec.seccion_nombre}</span>
                          </label>
                        ))}
                      </div>
                    )}
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
            {cloning ? "Clonando..." : totalToClone === 0 ? "Selecciona destino" : `Clonar en ${totalToClone} seccion(es)`}
          </button>
        </div>
      </div>
    </div>
  );
}
