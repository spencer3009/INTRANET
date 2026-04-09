import { useState, useEffect } from "react";
import axios from "axios";
import { AlertCircle, Loader2, Check } from "lucide-react";
import { TimePicker } from "../ui/time-picker";
import { BREAK_TYPES } from "./constants";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function BreakModal({ isOpen, onClose, token, breakItem, onSuccess, preselectedTime, settings, gradeId, sectionId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "break",
    label: "",
    start_time: "10:00",
    end_time: "10:30"
  });

  const isEdit = !!breakItem;
  const headers = { Authorization: `Bearer ${token}` };

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (breakItem) {
        setForm({
          type: breakItem.type || "break",
          label: breakItem.label || "",
          start_time: breakItem.start_time || "10:00",
          end_time: breakItem.end_time || "10:30"
        });
      } else if (preselectedTime) {
        const [h] = preselectedTime.split(':').map(Number);
        setForm({
          type: "break",
          label: "",
          start_time: preselectedTime,
          end_time: `${(h + 1).toString().padStart(2, '0')}:00`
        });
      } else {
        setForm({
          type: "break",
          label: "",
          start_time: "10:00",
          end_time: "10:30"
        });
      }
      setError("");
    }
  }, [isOpen, breakItem, preselectedTime]);

  // Auto-set label based on type
  useEffect(() => {
    if (!form.label || BREAK_TYPES.some(t => t.label === form.label)) {
      const typeInfo = BREAK_TYPES.find(t => t.id === form.type);
      setForm(p => ({ ...p, label: typeInfo?.label || "" }));
    }
  }, [form.type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!form.start_time || !form.end_time) {
      setError("Selecciona el horario");
      return;
    }
    
    if (form.start_time >= form.end_time) {
      setError("La hora fin debe ser mayor a la hora inicio");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        color: BREAK_TYPES.find(t => t.id === form.type)?.color
      };
      
      if (isEdit) {
        await axios.put(`${API}/schedule/breaks/${breakItem.id}`, payload, { headers });
      } else {
        // Include grade_id and section_id for new breaks
        payload.grade_id = gradeId;
        payload.section_id = sectionId;
        await axios.post(`${API}/schedule/breaks`, payload, { headers });
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      setError(typeof errorDetail === 'object' ? errorDetail.message : (errorDetail || "Error al guardar"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedType = BREAK_TYPES.find(t => t.id === form.type) || BREAK_TYPES[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" data-testid="break-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 ${selectedType.bgClass}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-white/50 rounded-full flex items-center justify-center text-2xl`}>
              {selectedType.icon}
            </div>
            <div>
              <h3 className={`text-lg font-bold ${selectedType.textClass}`}>
                {isEdit ? "Editar Bloque" : "Agregar Bloque"}
              </h3>
              <p className={`${selectedType.textClass} opacity-70 text-sm`}>Recreo, Almuerzo o Evento</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Tipo de bloque</label>
            <div className="grid grid-cols-3 gap-2">
              {BREAK_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, type: type.id }))}
                  className={`px-3 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                    form.type === type.id
                      ? `${type.bgClass} ${type.borderClass} ${type.textClass}`
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <span className="text-xl">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Label */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Etiqueta personalizada
            </label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))}
              placeholder="Ej: Recreo, Almuerzo, Asamblea..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-3">
            <TimePicker
              label="Hora inicio"
              value={form.start_time}
              onChange={(val) => setForm(p => ({ ...p, start_time: val }))}
            />
            <TimePicker
              label="Hora fin"
              value={form.end_time}
              onChange={(val) => setForm(p => ({ ...p, end_time: val }))}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-6 py-3 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2`}
              style={{ backgroundColor: selectedType.color }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {isEdit ? "Guardar" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
