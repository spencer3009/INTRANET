import { useState } from "react";
import { ShieldAlert, CreditCard, Loader2, CheckCircle2, X } from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";

const API = process.env.REACT_APP_BACKEND_URL;

export default function PaymentBlockModal({ token, onClose }) {
  const ctx = useSubscription();
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
        setTimeout(() => onClose?.(), 3000);
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
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" data-testid="payment-block-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Suscripcion Vencida
              </h2>
              <p className="text-red-200 text-sm mt-1">
                {sub.dias_vencido} dias vencido | S/ {sub.monto_plan?.toFixed(2)} pendiente
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!success ? (
            <>
              <p className="text-sm text-slate-600 text-center">
                Para continuar utilizando la plataforma EDU.NET debe registrar su pago mensual.
              </p>

              {sub.qr_pago_url && (
                <div className="bg-slate-50 rounded-xl p-4 flex justify-center border">
                  <img src={sub.qr_pago_url} alt="QR Yape" className="max-h-48 object-contain" />
                </div>
              )}
              {sub.yape_number && (
                <p className="text-center text-slate-500 text-sm">
                  Yape: <span className="font-bold text-slate-800">{sub.yape_number}</span>
                </p>
              )}

              <div className="bg-slate-50 rounded-xl p-3 text-center border">
                <p className="text-xs text-slate-400">Monto a pagar</p>
                <p className="text-2xl font-extrabold text-slate-800">S/ {sub.monto_plan?.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Numero de operacion (8 digitos)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={operationCode}
                  onChange={(e) => setOperationCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Ej: 12345678"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-center text-xl font-bold tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  data-testid="block-modal-operation-code"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={operationCode.length !== 8 || submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-50"
                data-testid="block-modal-submit"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Registrar pago
              </button>

              <a
                href="https://wa.me/51992021294?text=Hola,%20necesito%20ayuda%20con%20mi%20pago%20de%20EduNet"
                target="_blank"
                rel="noreferrer"
                className="block text-center text-sm text-slate-500 hover:text-violet-600 transition-colors"
              >
                Necesitas ayuda? Contactar soporte
              </a>
            </>
          ) : (
            <div className="text-center py-6">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
              <p className="text-lg font-bold text-slate-800">Pago registrado</p>
              <p className="text-sm text-slate-500 mt-2">
                Su pago esta en proceso de verificacion. Le notificaremos cuando sea confirmado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
