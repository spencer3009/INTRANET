import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Settings, DollarSign, Clock, Percent, Save, ToggleLeft, ToggleRight, CalendarDays, AlertTriangle, Loader2, Zap } from "lucide-react";
import PaymentConceptsSection from "./PaymentConceptsSection";
import DiscountTypesSection from "./DiscountTypesSection";
import StudentDiscountsSection from "./StudentDiscountsSection";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FinancialSettingsTab({ token, user, onGenerateBilling }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingTab, setBillingTab] = useState("auto");
  const [form, setForm] = useState({
    pension_mensual: 0,
    matricula: 0,
    pronto_pago_activo: false,
    pronto_pago_monto: 0,
    pronto_pago_fecha_limite: 5,
    pronto_pago_modalidad: "monto_fijo",
    interes_activo: false,
    interes_tipo: "porcentaje",
    interes_valor: 0,
    interes_frecuencia: "mensual",
    interes_modalidad: "porcentaje",
    interes_tope_maximo: 0,
    activacion_modo: "on_create",
    dia_vencimiento_mensualidad: 5,
    fecha_inicio_ano_escolar: "",
    fecha_fin_ano_escolar: ""
  });

  const isOwnerOrAdmin = user?.is_owner || user?.role === "owner" || user?.role === "director" || user?.role === "admin";

  useEffect(() => {
    axios.get(`${API}/accounting/financial-settings`, { headers })
      .then(r => {
        const d = r.data;
        setForm({
          pension_mensual: d.pension_mensual ?? 0,
          matricula: d.matricula ?? 0,
          pronto_pago_activo: d.pronto_pago_activo ?? false,
          pronto_pago_monto: d.pronto_pago_monto ?? 0,
          pronto_pago_fecha_limite: d.pronto_pago_fecha_limite ?? 5,
          pronto_pago_modalidad: d.pronto_pago_modalidad ?? "monto_fijo",
          interes_activo: d.interes_activo ?? false,
          interes_tipo: d.interes_tipo ?? "porcentaje",
          interes_valor: d.interes_valor ?? 0,
          interes_frecuencia: d.interes_frecuencia ?? "mensual",
          interes_modalidad: d.interes_modalidad ?? d.interes_tipo ?? "porcentaje",
          interes_tope_maximo: d.interes_tope_maximo ?? 0,
          activacion_modo: d.activacion_modo ?? "on_create",
          dia_vencimiento_mensualidad: d.dia_vencimiento_mensualidad ?? 5,
          fecha_inicio_ano_escolar: d.fecha_inicio_ano_escolar ?? "",
          fecha_fin_ano_escolar: d.fecha_fin_ano_escolar ?? ""
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/accounting/financial-settings`, form, { headers });
      const activated = res.data.activated_students || 0;
      setForm(prev => ({ ...prev, ...res.data }));
      if (activated > 0) {
        toast.success(`Configuración guardada. Se activaron ${activated} alumno${activated !== 1 ? "s" : ""} pendiente${activated !== 1 ? "s" : ""}.`);
      } else {
        toast.success("Configuración financiera guardada");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="financial-settings-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>
              Configuración Financiera
            </h2>
            <p className="text-xs text-slate-500">Parámetros base de pensiones, descuentos e intereses</p>
          </div>
        </div>
        {isOwnerOrAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-[#001f4b] text-white font-semibold text-sm rounded-xl hover:bg-[#0a3068] transition-all disabled:opacity-50 flex items-center gap-2 shadow-md"
            data-testid="save-financial-settings-btn"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        )}
      </div>

      {/* Cobros: Automáticos / Manuales tabs */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-md">
        {/* Tab header with icon and title */}
        <div className="bg-gradient-to-r from-slate-200 to-slate-300 px-6 py-4 flex items-center gap-3">
          <Zap className="w-5 h-5 text-slate-600" />
          <h3 className="text-sm font-bold text-slate-700 tracking-wide">Generación de Cobranza</h3>
        </div>
        {/* Tab buttons */}
        <div className="bg-white px-5 py-3 flex items-center gap-3 border-b border-slate-200">
          <button
            onClick={() => setBillingTab("auto")}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              billingTab === "auto"
                ? "bg-slate-800 text-white shadow-lg"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            }`}
            data-testid="billing-subtab-auto"
          >
            <CalendarDays className="w-4 h-4" />
            Cobros Automaticos
          </button>
          <button
            onClick={() => setBillingTab("manual")}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              billingTab === "manual"
                ? "bg-slate-800 text-white shadow-lg"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            }`}
            data-testid="billing-subtab-manual"
          >
            <Zap className="w-4 h-4" />
            Cobros Manuales
          </button>
        </div>

        {billingTab === "auto" && (
          <div className="p-6 space-y-5">
            {/* Año Escolar */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3">Periodo del ano escolar</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Inicio del ano escolar</label>
                  <input
                    type="date"
                    value={form.fecha_inicio_ano_escolar}
                    onChange={(e) => set("fecha_inicio_ano_escolar", e.target.value)}
                    disabled={!isOwnerOrAdmin}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                    data-testid="fecha-inicio-ano-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Fin del ano escolar</label>
                  <input
                    type="date"
                    value={form.fecha_fin_ano_escolar}
                    onChange={(e) => set("fecha_fin_ano_escolar", e.target.value)}
                    disabled={!isOwnerOrAdmin}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                    data-testid="fecha-fin-ano-input"
                  />
                </div>
              </div>
              {(() => {
                const today = new Date().toISOString().split("T")[0];
                const inicio = form.fecha_inicio_ano_escolar;
                const fin = form.fecha_fin_ano_escolar;
                if (!inicio || !fin) {
                  return (
                    <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                      <span>Configure las fechas del ano escolar para activar la cobranza automatica</span>
                    </div>
                  );
                }
                const isActive = today >= inicio && today <= fin;
                return (
                  <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2.5 border ${
                    isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                  }`} data-testid="billing-status-badge">
                    <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="font-medium">{isActive ? "Cobranza automatica activa" : "Cobranza automatica pausada"}</span>
                    <span className="text-xs opacity-70 ml-1">({inicio} a {fin})</span>
                  </div>
                );
              })()}
            </div>

            <hr className="border-slate-100" />

            {/* Día de vencimiento */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3">Día de generación</h4>
              <div className="max-w-xs">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  <CalendarDays className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                  Día de vencimiento mensual
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.dia_vencimiento_mensualidad}
                  onChange={(e) => set("dia_vencimiento_mensualidad", Math.min(31, Math.max(1, parseInt(e.target.value) || 5)))}
                  disabled={!isOwnerOrAdmin}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                  data-testid="dia-vencimiento-input"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">El sistema generará automáticamente las cuotas de todos los alumnos activos cada mes en el día de vencimiento configurado. Si el mes no tiene ese día (ej. febrero), se usará el último día disponible del mes.</p>
            </div>
          </div>
        )}

        {billingTab === "manual" && (
          <div className="p-6 space-y-5">
            {/* Warning banner */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">El sistema ya genera cobros automaticamente</p>
                <p className="text-xs text-amber-600 mt-0.5">Esta acción es solo para casos excepcionales donde necesite forzar la generación de cuotas manualmente.</p>
              </div>
            </div>

            {/* Generate button */}
            {isOwnerOrAdmin && onGenerateBilling && (
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-5 py-4 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200">
                    <Zap className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Generar cobranza del mes</p>
                    <p className="text-xs text-slate-400 mt-0.5">Genera manualmente las cuotas pendientes del mes para todos los alumnos activos.</p>
                  </div>
                </div>
                <button
                  onClick={onGenerateBilling}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl text-sm font-semibold hover:from-slate-800 hover:to-slate-900 transition-all shadow-md flex-shrink-0"
                  data-testid="generate-billing-btn"
                >
                  <Zap className="w-4 h-4" />
                  Generar cobranza
                </button>
              </div>
            )}

            <p className="text-xs text-slate-400">Use esta opción solo si necesita forzar la generación de cuotas manualmente. En condiciones normales el sistema lo hace automaticamente en la fecha de vencimiento configurada.</p>
          </div>
        )}
      </div>

      {/* Row 1: Pensiones y Matrícula */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2.5">
          <DollarSign className="w-5 h-5 text-emerald-500" />
          <h3 className="text-sm font-bold text-slate-700">Configuración de Pensiones y Matrícula</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Monto de Pension Mensual</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">S/</span>
              <input
                type="number"
                step="0.01"
                value={form.pension_mensual}
                onChange={(e) => set("pension_mensual", parseFloat(e.target.value) || 0)}
                disabled={!isOwnerOrAdmin}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                placeholder="350.00"
                data-testid="pension-input"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Monto base mensual cobrado a cada alumno</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Monto de Matrícula</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">S/</span>
              <input
                type="number"
                step="0.01"
                value={form.matricula}
                onChange={(e) => set("matricula", parseFloat(e.target.value) || 0)}
                disabled={!isOwnerOrAdmin}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                placeholder="300.00"
                data-testid="matricula-input"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Monto único de matrícula anual por alumno</p>
          </div>
        </div>
      </div>

      {/* Row 2: Pronto Pago + Intereses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pronto Pago */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-700">Pronto Pago</h3>
            </div>
            {isOwnerOrAdmin && (
              <button
                onClick={() => set("pronto_pago_activo", !form.pronto_pago_activo)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${form.pronto_pago_activo ? "bg-blue-500" : "bg-slate-300"}`}
                data-testid="toggle-pronto-pago"
              >
                <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${form.pronto_pago_activo ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            )}
          </div>
          <div className="p-6">
            <p className="text-xs text-slate-500 mb-4">
              {form.pronto_pago_activo 
                ? "Descuento activo para padres que pagan antes de la fecha límite." 
                : "Activar descuento por pronto pago."
              }
            </p>
            {form.pronto_pago_activo && (
              <div className="space-y-4 animate-in fade-in">
                {/* Modalidad toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Modalidad de descuento</label>
                  <div className="flex bg-slate-100 rounded-xl p-1" data-testid="pronto-pago-modalidad-toggle">
                    {[{id: "monto_fijo", label: "Monto fijo"}, {id: "porcentaje", label: "Porcentaje"}].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => set("pronto_pago_modalidad", opt.id)}
                        disabled={!isOwnerOrAdmin}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${form.pronto_pago_modalidad === opt.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        data-testid={`pp-mod-${opt.id}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Valor input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {form.pronto_pago_modalidad === "porcentaje" ? "Porcentaje de descuento" : "Monto con pronto pago"}
                  </label>
                  <div className="relative">
                    {form.pronto_pago_modalidad === "monto_fijo" && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">S/</span>
                    )}
                    <input
                      type="number"
                      step={form.pronto_pago_modalidad === "porcentaje" ? "0.1" : "0.01"}
                      value={form.pronto_pago_monto}
                      onChange={(e) => set("pronto_pago_monto", parseFloat(e.target.value) || 0)}
                      disabled={!isOwnerOrAdmin}
                      className={`w-full ${form.pronto_pago_modalidad === "monto_fijo" ? "pl-8" : "pl-4"} pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-400 transition-all`}
                      placeholder={form.pronto_pago_modalidad === "porcentaje" ? "10" : "320.00"}
                      data-testid="pronto-pago-monto-input"
                    />
                    {form.pronto_pago_modalidad === "porcentaje" && (
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
                {/* Fecha límite */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    Fecha límite de pronto pago
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.pronto_pago_fecha_limite}
                      onChange={(e) => set("pronto_pago_fecha_limite", Math.min(31, Math.max(1, parseInt(e.target.value) || 5)))}
                      disabled={!isOwnerOrAdmin}
                      className="w-20 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 text-center focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                      data-testid="pronto-pago-fecha-input"
                    />
                    <span className="text-sm text-slate-500">de cada mes</span>
                  </div>
                </div>
                {/* Preview */}
                {form.pronto_pago_monto > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700" data-testid="pronto-pago-preview">
                    {form.pronto_pago_modalidad === "porcentaje"
                      ? <>Ahorro: <strong>{form.pronto_pago_monto}%</strong> de descuento
                          {form.pension_mensual > 0 && <> (S/ {(form.pension_mensual * form.pronto_pago_monto / 100).toFixed(2)})</>}
                          {" "}si paga antes del día {form.pronto_pago_fecha_limite}</>
                      : <>Ahorro: <strong>S/ {form.pension_mensual > 0 ? (form.pension_mensual - form.pronto_pago_monto).toFixed(2) : "—"}</strong> si paga antes del día {form.pronto_pago_fecha_limite}</>
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Intereses por Morosidad */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-700">Intereses por Morosidad</h3>
            </div>
            {isOwnerOrAdmin && (
              <button
                onClick={() => set("interes_activo", !form.interes_activo)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${form.interes_activo ? "bg-amber-500" : "bg-slate-300"}`}
                data-testid="toggle-interes"
              >
                <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${form.interes_activo ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            )}
          </div>
          <div className="p-6">
            <p className="text-xs text-slate-500 mb-4">
              {form.interes_activo 
                ? "Interes activo para pagos vencidos." 
                : "Activar interes a pagos vencidos."
              }
            </p>
            {form.interes_activo && (
              <div className="space-y-4 animate-in fade-in">
                {/* Frecuencia toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Frecuencia del recargo</label>
                  <div className="flex bg-slate-100 rounded-xl p-1" data-testid="interes-frecuencia-toggle">
                    {[{id: "mensual", label: "Mensual"}, {id: "diario", label: "Diario"}].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => set("interes_frecuencia", opt.id)}
                        disabled={!isOwnerOrAdmin}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${form.interes_frecuencia === opt.id ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        data-testid={`freq-${opt.id}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Modalidad toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Modalidad de cálculo</label>
                  <div className="flex bg-slate-100 rounded-xl p-1" data-testid="interes-modalidad-toggle">
                    {[{id: "monto_fijo", label: "Monto fijo"}, {id: "porcentaje", label: "Porcentaje"}].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { set("interes_modalidad", opt.id); set("interes_tipo", opt.id); }}
                        disabled={!isOwnerOrAdmin}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${form.interes_modalidad === opt.id ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        data-testid={`mod-${opt.id}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Valor input with dynamic label */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {form.interes_modalidad === "porcentaje"
                      ? (form.interes_frecuencia === "diario" ? "Porcentaje diario" : "Porcentaje mensual")
                      : (form.interes_frecuencia === "diario" ? "Monto diario" : "Monto mensual")}
                  </label>
                  <div className="relative">
                    {form.interes_modalidad === "monto_fijo" && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">S/</span>
                    )}
                    <input
                      type="number"
                      step={form.interes_modalidad === "porcentaje" ? "0.1" : "0.01"}
                      value={form.interes_valor}
                      onChange={(e) => set("interes_valor", parseFloat(e.target.value) || 0)}
                      disabled={!isOwnerOrAdmin}
                      className={`w-full ${form.interes_modalidad === "monto_fijo" ? "pl-8" : "pl-4"} pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100 disabled:text-slate-400 transition-all`}
                      placeholder={form.interes_modalidad === "porcentaje" ? "2.5" : "0.50"}
                      data-testid="interes-valor-input"
                    />
                    {form.interes_modalidad === "porcentaje" && (
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
                {/* Tope maximo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Tope maximo de recargo (S/)
                    <span className="text-slate-400 font-normal ml-1" title="Opcional. Si se define, el recargo acumulado nunca superara este monto.">opcional</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">S/</span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.interes_tope_maximo || ""}
                      onChange={(e) => set("interes_tope_maximo", parseFloat(e.target.value) || 0)}
                      disabled={!isOwnerOrAdmin}
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                      placeholder="0 = sin tope"
                      data-testid="interes-tope-input"
                    />
                  </div>
                </div>
                {/* Preview */}
                {form.interes_valor > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700" data-testid="interes-preview">
                    {form.interes_modalidad === "porcentaje"
                      ? <>Recargo: <strong>{form.interes_valor}%</strong> del monto de la cuota por cada {form.interes_frecuencia === "diario" ? "dia" : "mes"} de atraso
                          {form.pension_mensual > 0 && <> (ej: <strong>S/ {(form.pension_mensual * form.interes_valor / 100).toFixed(2)}</strong> por {form.interes_frecuencia === "diario" ? "dia" : "mes"})</>}
                        </>
                      : <>Recargo: <strong>S/ {form.interes_valor.toFixed(2)}</strong> fijo por cada {form.interes_frecuencia === "diario" ? "dia" : "mes"} de atraso</>
                    }
                    {form.interes_tope_maximo > 0 && (
                      <> <span className="text-amber-600">(tope maximo: S/ {form.interes_tope_maximo.toFixed(2)})</span></>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Student Activation Config */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Activacion automatica del alumno</h4>
              <p className="text-xs text-slate-400">Define cuando un alumno pasa a estado Activo</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="space-y-3">
            {[
              { value: "matrícula", label: "Activar con matrícula", desc: "El alumno se activa al registrar pago de matrícula" },
              { value: "matricula_pension", label: "Activar con matrícula + primera pension", desc: "El alumno se activa al registrar matrícula y primera mensualidad" },
              { value: "on_create", label: "Activar al registrar alumno", desc: "El alumno se activa automaticamente al ser registrado, sin requerir ningun pago" }
            ].map(opt => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  (form.activacion_modo || "on_create") === opt.value
                    ? "border-violet-300 bg-violet-50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
                data-testid={`activacion-${opt.value}`}
              >
                <input
                  type="radio"
                  name="activacion_modo"
                  value={opt.value}
                  checked={(form.activacion_modo || "matricula_pension") === opt.value}
                  onChange={() => set("activacion_modo", opt.value)}
                  disabled={!isOwnerOrAdmin}
                  className="mt-0.5 w-4 h-4 text-violet-600 focus:ring-violet-500"
                />
                <div>
                  <p className="text-sm font-bold text-slate-700">{opt.label}</p>
                  <p className="text-xs text-slate-400">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          {isOwnerOrAdmin && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                data-testid="save-activation-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar configuración
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Discount Types Section */}
      <DiscountTypesSection token={token} />

      {/* Student Discounts Section */}
      <StudentDiscountsSection token={token} />

      {/* Payment Concepts Section */}
      <PaymentConceptsSection token={token} user={user} />
    </div>
  );
}
