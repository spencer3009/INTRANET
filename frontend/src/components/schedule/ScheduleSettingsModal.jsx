import { useState, useEffect } from "react";
import { Settings, Loader2, Check } from "lucide-react";
import { TimePicker } from "../ui/time-picker";

export function ScheduleSettingsModal({ isOpen, onClose, settings, onSave, loading }) {
  const [form, setForm] = useState({
    start_hour: "07:00",
    end_hour: "18:00",
    time_format: "24h",
    block_duration: 45,
    view_mode: "horizontal",
    include_saturday: false,
    include_sunday: false,
    permitir_profesor_multiples_horarios: false
  });

  useEffect(() => {
    if (isOpen && settings) {
      setForm({
        start_hour: settings.start_hour || "07:00",
        end_hour: settings.end_hour || "18:00",
        time_format: settings.time_format || "24h",
        block_duration: settings.block_duration || 45,
        view_mode: settings.view_mode || "horizontal",
        include_saturday: settings.include_saturday || false,
        include_sunday: settings.include_sunday || false,
        permitir_profesor_multiples_horarios: settings.permitir_profesor_multiples_horarios || false
      });
    }
  }, [isOpen, settings]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4" data-testid="schedule-settings-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Fixed */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-700 to-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Configuración de Horarios</h3>
              <p className="text-white/70 text-sm">Ajusta las horas del calendario</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable content */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Time Range */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Rango de horas visibles
            </label>
            <div className="grid grid-cols-2 gap-4">
              <TimePicker
                label="Desde"
                value={form.start_hour}
                onChange={(val) => setForm(p => ({ ...p, start_hour: val }))}
                data-testid="settings-start-hour"
              />
              <TimePicker
                label="Hasta"
                value={form.end_hour}
                onChange={(val) => setForm(p => ({ ...p, end_hour: val }))}
                data-testid="settings-end-hour"
              />
            </div>
          </div>

          {/* Time Format */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Formato de hora
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, time_format: "12h" }))}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  form.time_format === "12h" 
                    ? "border-blue-500 bg-blue-50 text-blue-700" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-semibold">12 horas</p>
                <p className="text-sm opacity-70">2:00 PM</p>
              </button>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, time_format: "24h" }))}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  form.time_format === "24h" 
                    ? "border-blue-500 bg-blue-50 text-blue-700" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-semibold">24 horas</p>
                <p className="text-sm opacity-70">14:00</p>
              </button>
            </div>
          </div>

          {/* Block Duration */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              {form.view_mode === "vertical" ? "Intervalo de líneas guía (minutos)" : "Duración de bloque (minutos)"}
            </label>
            <p className="text-xs text-slate-500 mb-3">
              {form.view_mode === "vertical"
                ? "Define cada cuántos minutos se dibujan las líneas de referencia en la grilla"
                : "Define la duración de cada fila de la grilla"}
            </p>
            <div className="flex gap-2">
              {[30, 45, 60, 90].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, block_duration: mins }))}
                  className={`flex-1 px-3 py-2.5 rounded-xl border-2 font-medium transition-all ${
                    form.block_duration === mins 
                      ? "border-blue-500 bg-blue-50 text-blue-700" 
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* View Mode */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Modo de vista
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="settings-view-horizontal"
                onClick={() => setForm(p => ({ ...p, view_mode: "horizontal" }))}
                className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                  form.view_mode === "horizontal"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <div className="text-center">
                  <span className="block text-sm">Horizontal</span>
                  <span className="block text-xs text-slate-500 mt-1">7:00 AM - 8:00 AM</span>
                </div>
              </button>
              <button
                type="button"
                data-testid="settings-view-vertical"
                onClick={() => setForm(p => ({ ...p, view_mode: "vertical" }))}
                className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                  form.view_mode === "vertical"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <div className="text-center">
                  <span className="block text-sm">Vertical</span>
                  <span className="block text-xs text-slate-500 mt-1">07:00, 08:00...</span>
                </div>
              </button>
            </div>
          </div>

          {/* Days Configuration */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Días visibles
            </label>
            <p className="text-xs text-slate-500 mb-3">Lunes a Viernes siempre están visibles</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="settings-saturday"
                  checked={form.include_saturday}
                  onChange={(e) => setForm(p => ({ ...p, include_saturday: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Sábado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="settings-sunday"
                  checked={form.include_sunday}
                  onChange={(e) => setForm(p => ({ ...p, include_sunday: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Domingo</span>
              </label>
            </div>
          </div>

          {/* Teacher Multiple Schedules */}
          <div className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50/50">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  data-testid="settings-permitir-multiples-horarios"
                  checked={form.permitir_profesor_multiples_horarios}
                  onChange={(e) => setForm(p => ({ ...p, permitir_profesor_multiples_horarios: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-300 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform"></div>
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-700 block">
                  Permitir profesor en múltiples horarios simultáneos
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  Permite que un mismo profesor sea asignado a clases en diferentes grados o secciones en el mismo día y horario. Útil para colegios que agrupan grados.
                </span>
              </div>
            </label>
          </div>

          </div>

          {/* Buttons - Fixed at bottom */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
            <button
              type="button"
              data-testid="settings-cancel-btn"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="settings-save-btn"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
