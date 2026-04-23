import { useState, useEffect } from "react";
import { X, Trash2, Shield, Loader2, AlertTriangle, Check, Search, Users } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BulkDeleteModal({ open, onClose, token, onDone }) {
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [nivelId, setNivelId] = useState("");
  const [gradoId, setGradoId] = useState("");
  const [seccionId, setSeccionId] = useState("");
  const [turnoId, setTurnoId] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState("filters"); // filters | analysis | confirm
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!open) return;
    setStep("filters");
    setAnalysis(null);
    setConfirmText("");
    setReason("");
    axios.get(`${API}/academic/levels`, { headers }).then(r => setLevels(r.data || [])).catch(() => {});
    axios.get(`${API}/academic/shifts`, { headers }).then(r => setShifts(r.data || [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!nivelId) { setGrades([]); setGradoId(""); return; }
    axios.get(`${API}/academic/grades?nivel_id=${nivelId}`, { headers }).then(r => setGrades(r.data || [])).catch(() => {});
    setGradoId(""); setSeccionId("");
  }, [nivelId]);

  useEffect(() => {
    if (!gradoId) { setSections([]); setSeccionId(""); return; }
    axios.get(`${API}/academic/sections?grado_id=${gradoId}`, { headers }).then(r => setSections(r.data || [])).catch(() => {});
    setSeccionId("");
  }, [gradoId]);

  const handleAnalyze = async () => {
    if (!nivelId || !gradoId || !seccionId) { toast.error("Selecciona nivel, grado y sección"); return; }
    if (reason.trim().length < 3) { toast.error("Escribe un motivo"); return; }
    setAnalyzing(true);
    try {
      const res = await axios.post(`${API}/students/bulk-safe-delete`, {
        nivel_id: nivelId, grado_id: gradoId, seccion_id: seccionId,
        turno_id: turnoId || undefined, delete_reason: reason, confirm: false,
      }, { headers });
      setAnalysis(res.data);
      setStep("analysis");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al analizar");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText !== "ELIMINAR") return;
    setDeleting(true);
    try {
      const res = await axios.post(`${API}/students/bulk-safe-delete`, {
        nivel_id: nivelId, grado_id: gradoId, seccion_id: seccionId,
        turno_id: turnoId || undefined, delete_reason: reason, confirm: true,
      }, { headers });
      toast.success(`${res.data.deleted} alumnos eliminados correctamente`);
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" data-testid="bulk-delete-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-white" />
            <div>
              <h3 className="text-white font-bold text-base">Eliminacion inteligente</h3>
              <p className="text-white/70 text-xs">Solo elimina alumnos sin actividad académica</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {step === "filters" && (
            <>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nivel *</label>
                  <select value={nivelId} onChange={e => setNivelId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    <option value="">Seleccionar...</option>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.nombre || l.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Grado *</label>
                    <select value={gradoId} onChange={e => setGradoId(e.target.value)} disabled={!nivelId} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50">
                      <option value="">Seleccionar...</option>
                      {grades.map(g => <option key={g.id} value={g.id}>{g.nombre || g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Sección *</label>
                    <select value={seccionId} onChange={e => setSeccionId(e.target.value)} disabled={!gradoId} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50">
                      <option value="">Seleccionar...</option>
                      {sections.map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
                    </select>
                  </div>
                </div>
                {shifts.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Turno (opcional)</label>
                    <select value={turnoId} onChange={e => setTurnoId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                      <option value="">Todos</option>
                      {shifts.map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo de eliminacion *</label>
                  <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: Limpieza de fin de año, alumnos retirados..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              <button onClick={handleAnalyze} disabled={analyzing || !nivelId || !gradoId || !seccionId || reason.length < 3} className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-50">
                {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Analizar alumnos
              </button>
            </>
          )}

          {step === "analysis" && analysis && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-slate-700">{analysis.total_found}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-emerald-600">{analysis.deletable_count}</p>
                  <p className="text-xs text-emerald-600">Eliminables</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-red-600">{analysis.blocked_count}</p>
                  <p className="text-xs text-red-600">Protegidos</p>
                </div>
              </div>

              {/* Blocked list */}
              {analysis.blocked.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-1"><Shield className="w-3 h-3" /> Alumnos protegidos (no se eliminaran)</p>
                  <div className="max-h-40 overflow-y-auto border border-red-100 rounded-lg divide-y divide-red-50">
                    {analysis.blocked.map(s => (
                      <div key={s.id} className="px-3 py-2 text-sm flex justify-between">
                        <span className="font-medium text-slate-700">{s.name}</span>
                        <span className="text-xs text-red-500">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.deletable_count > 0 ? (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-sm text-amber-800 font-medium">
                      Solo se eliminaran <strong>{analysis.deletable_count}</strong> alumnos SIN actividad académica.
                      Los alumnos con historial NO seran afectados.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Escribe ELIMINAR para confirmar</label>
                    <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="ELIMINAR" className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm text-center font-bold tracking-widest focus:ring-2 focus:ring-red-500/30" />
                  </div>
                  <button onClick={handleDelete} disabled={deleting || confirmText !== "ELIMINAR"} className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50">
                    {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    Eliminar {analysis.deletable_count} alumnos
                  </button>
                </>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-700">Todos los alumnos tienen actividad académica</p>
                  <p className="text-xs text-emerald-600">No hay alumnos eliminables</p>
                </div>
              )}

              <button onClick={() => setStep("filters")} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">
                Volver a filtros
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
