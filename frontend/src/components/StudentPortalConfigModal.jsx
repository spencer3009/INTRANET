import { useState, useEffect } from "react";
import axios from "axios";
import { X, Settings, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Configuración del portal del alumno.
 * Modal independiente (separado de Matrículas) donde el colegio controla
 * la experiencia del alumno. Por ahora: bloquear cambio de foto de perfil.
 */
export default function StudentPortalConfigModal({ isOpen, onClose, token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockPhoto, setBlockPhoto] = useState(false);
  const [original, setOriginal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/school/student-portal-config`, { headers });
        const b = res.data?.block_student_photo_change || false;
        setBlockPhoto(b);
        setOriginal(b);
      } catch {} finally { setLoading(false); }
    })();
  }, [isOpen]);

  const isDirty = blockPhoto !== original;

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/api/school/student-portal-config`, {
        block_student_photo_change: blockPhoto,
      }, { headers });
      toast.success("Configuración guardada correctamente");
      setOriginal(blockPhoto);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally { setSaving(false); }
  };

  const handleClose = () => {
    if (isDirty && !window.confirm("Tienes cambios sin guardar. ¿Deseas salir?")) return;
    setBlockPhoto(original);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()} data-testid="student-portal-config-modal">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-violet-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-amber-300" />
            <h3 className="text-white font-bold text-base">Configuración del Portal del Alumno</h3>
          </div>
          <button onClick={handleClose} className="text-white/60 hover:text-white transition-colors" data-testid="close-student-portal-config">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Switch grande: Bloquear cambio de foto de perfil */}
            <div className={`rounded-2xl border-2 p-5 transition-colors ${blockPhoto ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"}`} data-testid="switch-block-student-photo">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${blockPhoto ? "bg-rose-100" : "bg-white border border-slate-200"}`}>
                    <Camera className={`w-5 h-5 ${blockPhoto ? "text-rose-600" : "text-slate-500"}`} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Bloquear cambio de foto de perfil</p>
                    <p className="text-xs text-slate-500 mt-0.5">Al activarlo, los alumnos no podrán cambiar su foto: el ícono de cámara desaparece de su perfil.</p>
                  </div>
                </div>
                <button onClick={() => setBlockPhoto(!blockPhoto)} className="shrink-0" data-testid="toggle-block-student-photo">
                  <div className={`relative w-16 h-9 rounded-full transition-colors ${blockPhoto ? "bg-rose-500" : "bg-slate-300"}`}>
                    <div className={`absolute top-1 w-7 h-7 bg-white rounded-full shadow-md transition-transform ${blockPhoto ? "translate-x-[30px]" : "translate-x-1"}`} />
                  </div>
                </button>
              </div>
              <p className={`text-xs font-semibold mt-3 ${blockPhoto ? "text-rose-600" : "text-emerald-600"}`}>
                {blockPhoto ? "Bloqueado: los alumnos NO pueden cambiar su foto." : "Permitido: los alumnos pueden cambiar su foto."}
              </p>
            </div>

            {/* Save button */}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={handleClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
                data-testid="save-student-portal-config"
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
