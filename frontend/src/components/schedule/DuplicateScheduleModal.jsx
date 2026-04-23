import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  X, Copy, Users, Calendar, CalendarRange, ChevronRight,
  Check, Loader2, AlertCircle, AlertTriangle, Info, ArrowLeft
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const DAY_LABELS = { lunes: "Lun", martes: "Mar", miercoles: "Mie", jueves: "Jue", viernes: "Vie", sabado: "Sab", domingo: "Dom" };

const MODES = [
  { id: "section", label: "Copiar a otra sección", desc: "Duplica todos los bloques de una sección a otra(s)", icon: Users, color: "from-blue-500 to-indigo-600" },
  { id: "day", label: "Copiar un día a otros días", desc: "Replica los bloques de un día en otros días de la semana", icon: Calendar, color: "from-emerald-500 to-teal-600" },
  { id: "year", label: "Copiar a otro ano académico", desc: "Duplica el horario completo hacia un ano académico diferente", icon: CalendarRange, color: "from-orange-500 to-amber-600" },
];

export default function DuplicateScheduleModal({
  isOpen, onClose, token,
  selectedGrade, selectedSection, selectedLevel,
  grades, sections, levels, onSuccess,
}) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [multiHorario, setMultiHorario] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  // Form state
  const [targetGrades, setTargetGrades] = useState([]);
  const [targetSections, setTargetSections] = useState([]);
  const [sourceDay, setSourceDay] = useState("lunes");
  const [targetDays, setTargetDays] = useState([]);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear() + 1);
  const [keepTeacher, setKeepTeacher] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [skipConflicts, setSkipConflicts] = useState(true);

  // Preview state
  const [preview, setPreview] = useState(null);

  // Derived
  const levelGrades = grades.filter((g) => {
    const sourceGrade = grades.find((gr) => gr.id === selectedGrade);
    return sourceGrade && g.nivel_id === sourceGrade.nivel_id && g.id !== selectedGrade;
  });
  const levelGradesAll = grades.filter((g) => {
    const sourceGrade = grades.find((gr) => gr.id === selectedGrade);
    return sourceGrade && g.nivel_id === sourceGrade.nivel_id;
  });

  const targetFilteredSections = sections.filter((s) => targetGrades.includes(s.grado_id));

  const sourceGradeName = grades.find((g) => g.id === selectedGrade)?.nombre || "";
  const sourceSectionName = sections.find((s) => s.id === selectedSection)?.nombre || "";
  const sourceLevelName = levels.find((l) => {
    const sg = grades.find((g) => g.id === selectedGrade);
    return sg && l.id === sg.nivel_id;
  })?.nombre || "";

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setMode("");
      setError("");
      setPreview(null);
      setTargetGrades([]);
      setTargetSections([]);
      setSourceDay("lunes");
      setTargetDays([]);
      setTargetYear(new Date().getFullYear() + 1);
      setKeepTeacher(true);
      setOverwrite(false);
      setSkipConflicts(true);
      // Load multi-schedule setting
      axios.get(`${API}/schedule-settings`, { headers })
        .then((r) => setMultiHorario(!!r.data?.permitir_profesor_multiples_horarios))
        .catch(() => setMultiHorario(false));
    }
  }, [isOpen]);

  const toggleTargetGrade = (gid) => {
    setTargetGrades((prev) => prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid]);
    setTargetSections([]);
  };

  const toggleTargetSection = (sid) => {
    setTargetSections((prev) => prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]);
  };

  const toggleTargetDay = (d) => {
    setTargetDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  const canProceed = () => {
    if (mode === "section") return targetGrades.length > 0 && targetSections.length > 0;
    if (mode === "day") return sourceDay && targetDays.length > 0;
    if (mode === "year") return targetYear && targetYear !== new Date().getFullYear();
    return false;
  };

  const buildPayload = () => ({
    mode,
    source: {
      grado_id: selectedGrade,
      seccion_id: selectedSection,
      dia: mode === "day" ? sourceDay : undefined,
    },
    target: {
      grado_ids: mode === "section" ? targetGrades : undefined,
      seccion_ids: mode === "section" ? targetSections : undefined,
      dias: mode === "day" ? targetDays : undefined,
      anio_academico: mode === "year" ? targetYear : undefined,
    },
    options: { keep_teacher: keepTeacher, overwrite_existing: overwrite, skip_conflicts: skipConflicts },
  });

  const handlePreview = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/schedules/duplicate?dry_run=true`, buildPayload(), { headers });
      setPreview(res.data);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al generar preview");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/schedules/duplicate`, buildPayload(), { headers });
      const { created, skipped, conflicts } = res.data;
      const parts = [];
      if (created > 0) parts.push(`${created} bloque${created !== 1 ? "s" : ""} creado${created !== 1 ? "s" : ""}`);
      if (skipped > 0) parts.push(`${skipped} omitido${skipped !== 1 ? "s" : ""}`);
      if (conflicts?.length > 0) parts.push(`${conflicts.length} conflicto${conflicts.length !== 1 ? "s" : ""}`);
      alert(parts.join(", ") || "Duplicacion completada");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al duplicar horarios");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl" data-testid="duplicate-schedule-modal">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Copy className="w-7 h-7 text-white" />
              <div className="text-white">
                <h2 className="text-lg font-bold">Duplicar Horario</h2>
                <p className="text-sm text-white/80">
                  {step === 1 && "Selecciona el modo de duplicacion"}
                  {step === 2 && MODES.find((m) => m.id === mode)?.label}
                  {step === 3 && "Opciones de duplicacion"}
                  {step === 4 && "Vista previa"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white" data-testid="dup-modal-close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 max-h-[65vh] overflow-y-auto">
            {/* Source info */}
            <div className="mb-4 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Origen: <strong>{sourceLevelName}</strong> &gt; <strong>{sourceGradeName}</strong> &gt; <strong>{sourceSectionName}</strong>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            {/* Step 1: Mode selection */}
            {step === 1 && (
              <div className="grid gap-3">
                {MODES.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setMode(m.id); setStep(2); }}
                      className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all text-left group"
                      data-testid={`dup-mode-${m.id}`}
                    >
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800">{m.label}</p>
                        <p className="text-sm text-slate-500">{m.desc}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-violet-500" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2: Target selection */}
            {step === 2 && mode === "section" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Grados destino</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-3" data-testid="dup-target-grades">
                    {levelGradesAll.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-violet-50 rounded-lg px-2 py-1.5">
                        <input type="checkbox" checked={targetGrades.includes(g.id)} onChange={() => toggleTargetGrade(g.id)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                        <span className={`${g.id === selectedGrade ? "text-slate-400 line-through" : "text-slate-700"}`}>{g.nombre}{g.id === selectedGrade ? " (origen)" : ""}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {targetFilteredSections.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-slate-700">Secciones destino ({targetSections.length})</label>
                      <button type="button" onClick={() => setTargetSections(targetSections.length === targetFilteredSections.length ? [] : targetFilteredSections.map((s) => s.id))} className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                        {targetSections.length === targetFilteredSections.length ? "Deseleccionar" : "Seleccionar todas"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-3" data-testid="dup-target-sections">
                      {targetFilteredSections.map((s) => {
                        const gName = grades.find((g) => g.id === s.grado_id)?.nombre || "";
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-violet-50 rounded-lg px-2 py-1.5">
                            <input type="checkbox" checked={targetSections.includes(s.id)} onChange={() => toggleTargetSection(s.id)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                            <span className="text-slate-700">{gName} - {s.nombre}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && mode === "day" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Día origen</label>
                  <div className="flex flex-wrap gap-2" data-testid="dup-source-day">
                    {DAYS.map((d) => (
                      <button key={d} onClick={() => setSourceDay(d)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${sourceDay === d ? "bg-violet-600 text-white shadow-lg" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        {DAY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Días destino</label>
                  <div className="flex flex-wrap gap-2" data-testid="dup-target-days">
                    {DAYS.filter((d) => d !== sourceDay).map((d) => (
                      <button key={d} onClick={() => toggleTargetDay(d)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${targetDays.includes(d) ? "bg-emerald-600 text-white shadow-lg" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        {DAY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && mode === "year" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Ano académico destino</label>
                <select value={targetYear} onChange={(e) => setTargetYear(parseInt(e.target.value))} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500" data-testid="dup-target-year">
                  {[2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 3: Options */}
            {step === 3 && (
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700 text-sm">Mantener profesor asignado</p>
                    <p className="text-xs text-slate-500">Copia el profesor de cada bloque al destino</p>
                  </div>
                  <input type="checkbox" checked={keepTeacher} onChange={(e) => setKeepTeacher(e.target.checked)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-5 h-5" />
                </label>
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700 text-sm">Sobrescribir horarios existentes</p>
                    <p className="text-xs text-slate-500">Elimina bloques en el destino que choquen con los nuevos</p>
                  </div>
                  <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-5 h-5" />
                </label>
                {overwrite && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Los bloques existentes en el destino seran eliminados y reemplazados.
                  </div>
                )}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700 text-sm">Omitir bloques con conflictos</p>
                    <p className="text-xs text-slate-500">Si hay conflicto, salta ese bloque y continua con el resto</p>
                  </div>
                  <input type="checkbox" checked={skipConflicts} onChange={(e) => setSkipConflicts(e.target.checked)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-5 h-5" />
                </label>
              </div>
            )}

            {/* Step 4: Preview */}
            {step === 4 && preview && (
              <div className="space-y-4">
                {preview.setting_multi_horario_activo && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm flex items-center gap-2">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    El setting "Permitir profesor en multiples horarios" esta activo. No se validan solapamientos de profesor.
                  </div>
                )}
                <div className="p-4 rounded-xl bg-violet-50 border border-violet-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-violet-600 font-medium">Resumen</p>
                      <p className="text-2xl font-bold text-violet-900">{preview.created} bloque{preview.created !== 1 ? "s" : ""} por crear</p>
                    </div>
                    <div className="text-right text-sm">
                      {preview.skipped > 0 && <p className="text-amber-600">{preview.skipped} a omitir</p>}
                      {preview.deleted > 0 && <p className="text-red-600">{preview.deleted} a sobrescribir</p>}
                    </div>
                  </div>
                </div>

                {preview.conflicts?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Conflictos detectados ({preview.conflicts.length})</p>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100" data-testid="dup-conflicts-list">
                      {preview.conflicts.map((c, i) => (
                        <div key={i} className="px-3 py-2 text-sm flex items-start gap-2">
                          <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0 ${c.tipo === "profesor" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {c.tipo === "profesor" ? "PROFESOR" : "SLOT"}
                          </span>
                          <span className="text-slate-600">{c.razon}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {preview.aborted && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Operación abortada: {preview.abort_reason}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between rounded-b-2xl">
            {step > 1 ? (
              <button onClick={() => setStep(step - 1)} className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1" data-testid="dup-back-btn">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
            ) : <div />}

            {step === 1 && <div />}

            {step === 2 && (
              <button disabled={!canProceed()} onClick={() => setStep(3)} className="px-5 py-2.5 rounded-xl font-medium bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" data-testid="dup-next-btn">
                Opciones <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button onClick={handlePreview} disabled={loading} className="px-5 py-2.5 rounded-xl font-medium bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg disabled:opacity-50 flex items-center gap-2" data-testid="dup-preview-btn">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Ver Preview
              </button>
            )}

            {step === 4 && !preview?.aborted && preview?.created > 0 && (
              <button onClick={handleConfirm} disabled={loading} className="px-5 py-2.5 rounded-xl font-medium bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg disabled:opacity-50 flex items-center gap-2" data-testid="dup-confirm-btn">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmar {preview.created} bloque{preview.created !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
