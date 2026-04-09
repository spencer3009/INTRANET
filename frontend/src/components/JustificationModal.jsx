import { useState, useEffect } from "react";
import { X, Loader2, FileText, Info } from "lucide-react";

const JUSTIFICATION_REASONS = [
  { id: "salud", label: "Salud / Enfermedad" },
  { id: "permiso_familiar", label: "Permiso familiar" },
  { id: "tramite", label: "Trámite personal" },
  { id: "duelo", label: "Duelo familiar" },
  { id: "viaje", label: "Viaje" },
  { id: "otro", label: "Otro" },
];

export default function JustificationModal({ isOpen, onClose, onSave, studentName, existingData, saving }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason(existingData?.justification_reason || "");
      setNote(existingData?.justification_note || "");
    }
  }, [isOpen, existingData]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!reason) return;
    onSave({ justification_reason: reason, justification_note: note });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" data-testid="justification-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Justificar inasistencia</h3>
              <p className="text-blue-100 text-sm truncate max-w-[220px]">{studentName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white" data-testid="justification-modal-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Reason select */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Motivo <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              data-testid="justification-reason-select"
            >
              <option value="">Seleccionar motivo...</option>
              {JUSTIFICATION_REASONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Note textarea */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Descripcion <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Ej: Presenta certificado medico, los padres enviaron la solicitud por WhatsApp..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm resize-none"
              data-testid="justification-note-input"
            />
            <p className="text-xs text-slate-400 text-right mt-1">{note.length} / 500</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
            data-testid="justification-cancel-btn"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!reason || saving}
            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-testid="justification-save-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Guardando..." : "Guardar Justificacion"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function JustificationInfoPopover({ data, onClose }) {
  if (!data) return null;

  const reasonLabel = JUSTIFICATION_REASONS.find(r => r.id === data.justification_reason)?.label || data.justification_reason;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" data-testid="justification-info-popover">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" />
            Detalle de justificacion
          </h4>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-semibold text-slate-600">Motivo:</span>{" "}
            <span className="text-slate-800">{reasonLabel}</span>
          </div>
          {data.justification_note && (
            <div>
              <span className="font-semibold text-slate-600">Descripcion:</span>{" "}
              <span className="text-slate-800">{data.justification_note}</span>
            </div>
          )}
          {data.justified_by_name && (
            <div>
              <span className="font-semibold text-slate-600">Registrado por:</span>{" "}
              <span className="text-slate-800">{data.justified_by_name}</span>
            </div>
          )}
          {data.justified_at && (
            <div>
              <span className="font-semibold text-slate-600">Fecha:</span>{" "}
              <span className="text-slate-800">
                {new Date(data.justified_at).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
