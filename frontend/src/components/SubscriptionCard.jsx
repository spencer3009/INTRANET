import { useState } from "react";
import { Shield, ShieldAlert, ShieldOff, Clock, CalendarDays, DollarSign, CreditCard, Users, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";

const STATE_CONFIG = {
  ACTIVO:               { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", label: "Activo", Icon: Shield, iconCls: "text-emerald-500" },
  AVISO_VENCIMIENTO:    { bar: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",     label: "Vencido", Icon: ShieldAlert, iconCls: "text-amber-500" },
  RESTRICCION_PARCIAL:  { bar: "bg-orange-500",   badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",   label: "Restringido", Icon: AlertTriangle, iconCls: "text-orange-500" },
  PAGO_OBLIGATORIO:     { bar: "bg-red-500",     badge: "bg-red-50 text-red-700 ring-1 ring-red-200",           label: "Pago obligatorio", Icon: ShieldOff, iconCls: "text-red-500" },
  SUSPENDIDO:           { bar: "bg-slate-400",   badge: "bg-slate-700 text-white",                               label: "Suspendido", Icon: ShieldOff, iconCls: "text-slate-400" },
  PAGO_EN_VERIFICACION: { bar: "bg-blue-500",     badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",       label: "Pago en verificacion", Icon: CheckCircle2, iconCls: "text-blue-500" },
};

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "--";

export default function SubscriptionCard({ token }) {
  const ctx = useSubscription();
  const [showPayModal, setShowPayModal] = useState(false);
  const [operationCode, setOperationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!ctx || ctx.loading || !ctx.sub) return null;

  const { plan_estado, dias_vencido, fecha_vencimiento, fecha_activacion, monto_plan, pricing, school_name, qr_pago_url, yape_number } = ctx.sub;
  const cfg = STATE_CONFIG[plan_estado] || STATE_CONFIG.ACTIVO;
  const Icon = cfg.Icon;

  const API = process.env.REACT_APP_BACKEND_URL;

  const handleSubmitPayment = async () => {
    if (!operationCode.trim() || operationCode.length !== 8) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/membership/request-payment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ operation_code: operationCode, payment_method: "yape" }),
      });
      if (res.ok) {
        setSuccess(true);
        ctx.refresh();
      } else {
        const err = await res.json();
        alert(err.detail || "Error");
      }
    } catch { alert("Error de conexion"); }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-testid="subscription-card">
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan_estado === "ACTIVO" ? "bg-emerald-50" : "bg-red-50"}`}>
                <Icon className={`w-5 h-5 ${cfg.iconCls}`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Suscripción EDU.NET</h3>
                <p className="text-xs text-slate-400">{school_name}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${cfg.badge}`} data-testid="subscription-status-badge">
              {cfg.label}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div className={`h-full ${cfg.bar} rounded-full transition-all duration-500`}
              style={{ width: plan_estado === "ACTIVO" ? "100%" : `${Math.max(5, 100 - (dias_vencido * 10))}%` }} />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase">Monto</span>
              </div>
              <p className="text-lg font-extrabold text-slate-800" data-testid="sub-amount">S/ {monto_plan?.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase">Alumnos</span>
              </div>
              <p className="text-lg font-extrabold text-slate-800">{pricing?.cantidad_alumnos || 0}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase">Vence</span>
              </div>
              <p className="text-sm font-bold text-slate-800">{fmtDate(fecha_vencimiento)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase">Días vencido</span>
              </div>
              <p className={`text-lg font-extrabold ${dias_vencido > 0 ? "text-red-600" : "text-emerald-600"}`} data-testid="sub-days-overdue">
                {dias_vencido > 0 ? dias_vencido : "0"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {plan_estado !== "ACTIVO" && plan_estado !== "PAGO_EN_VERIFICACION" && (
          <div className="px-5 pb-5 pt-2">
            <button
              onClick={() => setShowPayModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors"
              data-testid="sub-card-pay-btn"
            >
              <CreditCard className="w-4 h-4" />
              Registrar pago
            </button>
          </div>
        )}

        {plan_estado === "PAGO_EN_VERIFICACION" && (
          <div className="px-5 pb-5 pt-2">
            <div className="flex items-center gap-2 justify-center px-4 py-3 bg-blue-50 text-blue-700 rounded-xl text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Pago en verificacion
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-5 text-white">
              <h2 className="text-lg font-bold">Registrar Pago</h2>
              <p className="text-violet-200 text-sm mt-1">Monto: S/ {monto_plan?.toFixed(2)}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {!success ? (
                <>
                  {qr_pago_url && (
                    <div className="bg-slate-50 rounded-xl p-4 flex justify-center border">
                      <img src={qr_pago_url} alt="QR Yape" className="max-h-48 object-contain" />
                    </div>
                  )}
                  {yape_number && (
                    <p className="text-center text-slate-500 text-sm">
                      Yape: <span className="font-bold text-slate-800">{yape_number}</span>
                    </p>
                  )}
                  <div className="bg-slate-50 rounded-xl p-3 text-center border">
                    <p className="text-xs text-slate-400">Monto a pagar</p>
                    <p className="text-2xl font-extrabold text-slate-800">S/ {monto_plan?.toFixed(2)}</p>
                    {pricing?.cantidad_alumnos > 0 && (
                      <p className="text-xs text-slate-400 mt-1">{pricing.cantidad_alumnos} alumnos x S/ {pricing.precio_por_alumno}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Número de operacion (8 digitos)</label>
                    <input
                      type="text" inputMode="numeric" maxLength={8}
                      value={operationCode}
                      onChange={(e) => setOperationCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="Ej: 12345678"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-center text-xl font-bold tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                      data-testid="sub-modal-operation-code"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowPayModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmitPayment}
                      disabled={operationCode.length !== 8 || submitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50"
                      data-testid="sub-modal-submit"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      Enviar pago
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                  <p className="text-lg font-bold text-slate-800">Pago registrado</p>
                  <p className="text-sm text-slate-500 mt-2">Su pago esta en proceso de verificacion.</p>
                  <button onClick={() => { setShowPayModal(false); setSuccess(false); setOperationCode(""); }} className="mt-4 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm">
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
