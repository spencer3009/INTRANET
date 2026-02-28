import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DollarSign, Save, Settings2, Users, Calendar, Tag, ArrowLeft } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SupportPricingPage({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ base_monthly_fee: 50, per_student_fee: 0.7, per_student_from_month: 3 });

  useEffect(() => {
    axios.get(`${API}/support/pricing`, { headers })
      .then(r => {
        setConfig(r.data);
        setForm({
          base_monthly_fee: r.data.base_monthly_fee,
          per_student_fee: r.data.per_student_fee,
          per_student_from_month: r.data.per_student_from_month
        });
      })
      .catch(() => toast.error("Error al cargar configuracion"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/support/pricing`, form, { headers });
      toast.success("Configuracion guardada");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto" data-testid="pricing-config-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>Configuracion de Precios</h1>
          <p className="text-sm text-slate-500">Parametros globales de facturacion</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-700">Precio global (aplica a todos los colegios por defecto)</h2>
          <p className="text-xs text-slate-400 mt-0.5">Los colegios con precio personalizado usaran su propia configuracion</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Base monthly fee */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Precio base mensual
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">S/</span>
              <input
                type="number"
                step="0.01"
                value={form.base_monthly_fee}
                onChange={(e) => setForm({ ...form, base_monthly_fee: parseFloat(e.target.value) || 0 })}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                data-testid="base-fee-input"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Se cobra este monto fijo cada mes a cada colegio</p>
          </div>

          {/* Per student fee */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              Precio por alumno
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">S/</span>
              <input
                type="number"
                step="0.01"
                value={form.per_student_fee}
                onChange={(e) => setForm({ ...form, per_student_fee: parseFloat(e.target.value) || 0 })}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                data-testid="student-fee-input"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Se cobra este monto adicional por cada alumno registrado</p>
          </div>

          {/* From which month */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              Cobro por alumno desde el mes
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={form.per_student_from_month}
              onChange={(e) => setForm({ ...form, per_student_from_month: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
              data-testid="from-month-input"
            />
            <p className="text-xs text-slate-400 mt-1.5">Los primeros {Math.max(0, form.per_student_from_month - 1)} mes(es) solo se cobra el precio base, sin cobro por alumno</p>
          </div>

          {/* Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Vista previa de cobro</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Mes 1 al {Math.max(1, form.per_student_from_month - 1)}</span>
                <span className="font-bold text-slate-700">S/ {form.base_monthly_fee.toFixed(2)}</span>
              </div>
              <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between text-sm">
                <span className="text-slate-500">Desde mes {form.per_student_from_month} (ej: 20 alumnos)</span>
                <span className="font-bold text-slate-700">S/ {(form.base_monthly_fee + 20 * form.per_student_fee).toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                = S/ {form.base_monthly_fee.toFixed(2)} base + 20 x S/ {form.per_student_fee.toFixed(2)} por alumno
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#001f4b] text-white font-semibold text-sm rounded-xl hover:bg-[#0a3068] transition-all disabled:opacity-50 flex items-center gap-2"
            data-testid="save-pricing-btn"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar configuracion
          </button>
        </div>
      </div>
    </div>
  );
}
