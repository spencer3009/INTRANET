import { useState } from "react";
import { ShieldOff, CreditCard, MessageCircle, Loader2, CheckCircle2, Upload, X } from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";

const API = process.env.REACT_APP_BACKEND_URL;

export default function SuspendedScreen({ token }) {
  const ctx = useSubscription();
  const [showPayForm, setShowPayForm] = useState(false);
  const [operationCode, setOperationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const sub = ctx?.sub;
  if (!sub) return null;

  const handleSubmit = async () => {
    if (!operationCode.trim()) return;
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
        alert(err.detail || "Error al enviar solicitud");
      }
    } catch {
      alert("Error de conexion");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-4" data-testid="suspended-screen">
      <div className="max-w-lg w-full text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Suscripcion Suspendida</h1>
        <p className="text-slate-400 mb-2">
          Su suscripcion ha sido suspendida por falta de pago.
        </p>
        {sub.dias_vencido > 0 && (
          <p className="text-red-400 text-sm font-semibold mb-6">
            {sub.dias_vencido} dias vencido | Monto pendiente: S/ {sub.monto_plan?.toFixed(2)}
          </p>
        )}

        {!showPayForm && !success && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowPayForm(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-colors"
              data-testid="suspended-pay-btn"
            >
              <CreditCard className="w-5 h-5" />
              Registrar pago
            </button>
            <a
              href="https://wa.me/51992021294?text=Hola,%20necesito%20reactivar%20mi%20cuenta%20de%20EduNet"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors"
              data-testid="suspended-contact-btn"
            >
              <MessageCircle className="w-5 h-5" />
              Contactar soporte
            </a>
          </div>
        )}

        {showPayForm && !success && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-4 text-left space-y-4">
            {sub.qr_pago_url && (
              <div className="bg-white rounded-xl p-4 max-w-[200px] mx-auto">
                <img src={sub.qr_pago_url} alt="QR Yape" className="w-full" />
              </div>
            )}
            {sub.yape_number && (
              <p className="text-center text-white/60 text-sm">Yape: <span className="text-white font-bold">{sub.yape_number}</span></p>
            )}
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-white/40 text-xs">Monto a pagar</p>
              <p className="text-2xl font-bold text-white">S/ {sub.monto_plan?.toFixed(2)}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Numero de operacion (8 digitos)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={operationCode}
                onChange={(e) => setOperationCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Ej: 12345678"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center text-xl font-bold tracking-[0.2em] placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                data-testid="suspended-operation-code"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPayForm(false)} className="flex-1 px-4 py-2.5 border border-white/20 text-white/60 rounded-xl text-sm hover:bg-white/5">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={operationCode.length !== 8 || submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50"
                data-testid="suspended-submit-payment"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Enviar pago
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 mt-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-emerald-300 font-bold text-lg">Pago registrado</p>
            <p className="text-white/60 text-sm mt-2">
              Su pago esta en proceso de verificacion. Le notificaremos cuando sea confirmado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
