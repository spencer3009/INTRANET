import { useState, useEffect } from "react";
import axios from "axios";
import { X, Settings, ToggleLeft, ToggleRight, Loader2, GraduationCap, Users } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function EnrollmentConfigModal({ isOpen, onClose, token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [academicEditable, setAcademicEditable] = useState(false);
  const [original, setOriginal] = useState({ enabled: false, academicEditable: false });

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/school/enrollment-config`, { headers });
        const e = res.data.parent_self_enrollment_enabled || false;
        const a = res.data.academic_info_editable || false;
        setEnabled(e);
        setAcademicEditable(a);
        setOriginal({ enabled: e, academicEditable: a });
      } catch {} finally { setLoading(false); }
    })();
  }, [isOpen]);

  const isDirty = enabled !== original.enabled || academicEditable !== original.academicEditable;

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/api/school/settings/enrollment`, {
        enabled,
        academic_info_editable: academicEditable,
      }, { headers });
      toast.success("Configuracion guardada correctamente");
      setOriginal({ enabled, academicEditable });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally { setSaving(false); }
  };

  const handleClose = () => {
    if (isDirty && !window.confirm("Tienes cambios sin guardar. ¿Deseas salir?")) return;
    setEnabled(original.enabled);
    setAcademicEditable(original.academicEditable);
    onClose();
  };

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    if (!next) setAcademicEditable(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()} data-testid="enrollment-config-modal">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-bold text-base">Configuracion de Matriculas</h3>
          </div>
          <button onClick={handleClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Switch 1: Auto-registro */}
            <div className="flex items-start gap-4" data-testid="switch-self-enrollment">
              <button onClick={toggleEnabled} className="mt-1 shrink-0" data-testid="toggle-self-enrollment">
                {enabled ? (
                  <ToggleRight className="w-10 h-6 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-10 h-6 text-slate-300" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-slate-500" />
                  <p className="font-semibold text-slate-800 text-sm">Auto-registro de alumnos por padres</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Los padres pueden registrar a sus hijos directamente desde su portal. Cada solicitud queda pendiente hasta ser aprobada por el colegio.
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100"></div>

            {/* Switch 2: Selección académica */}
            <div className={`flex items-start gap-4 transition-opacity ${enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`} data-testid="switch-academic-info">
              <button
                onClick={() => enabled && setAcademicEditable(!academicEditable)}
                className="mt-1 shrink-0"
                disabled={!enabled}
                data-testid="toggle-academic-info"
              >
                {academicEditable && enabled ? (
                  <ToggleRight className="w-10 h-6 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-10 h-6 text-slate-300" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <GraduationCap className="w-4 h-4 text-slate-500" />
                  <p className="font-semibold text-slate-800 text-sm">Permitir seleccion de nivel, grado y seccion por el padre</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  El padre puede indicar el Nivel, Grado, Seccion y Turno de su preferencia. El colegio puede modificarlo al aprobar.
                </p>
                {!academicEditable && enabled && (
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-1.5 inline-block">
                    El colegio asignara el nivel, grado y seccion al momento de aprobar la matricula.
                  </p>
                )}
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={handleClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
                data-testid="save-enrollment-config"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
