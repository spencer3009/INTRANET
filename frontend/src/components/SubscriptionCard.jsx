import { useState, useEffect } from "react";
import { Shield, ShieldAlert, ShieldOff, Clock, CalendarDays, CalendarClock, DollarSign, CreditCard, X, Loader2, CheckCircle2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

function getState(expDate) {
  if (!expDate) return null;
  const now = new Date();
  const exp = new Date(expDate);
  const diffMs = exp - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const mins = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
  if (days <= 0) return { id: "suspended", days: 0, hours: 0, mins: 0 };
  if (days <= 5) return { id: "critical", days, hours, mins };
  if (days <= 10) return { id: "warning", days, hours, mins };
  return { id: "active", days, hours, mins };
}

function calcProgress(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end), n = new Date();
  const total = e - s;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((n - s) / total) * 100)));
}

const T = {
  active:    { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", label: "Activo", Icon: Shield, iconCls: "text-emerald-500", countdown: "text-slate-600" },
  warning:   { bar: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",     label: "Proximo a vencer", Icon: ShieldAlert, iconCls: "text-amber-500", countdown: "text-amber-600" },
  critical:  { bar: "bg-red-500",     badge: "bg-red-50 text-red-700 ring-1 ring-red-200",           label: "Vence pronto",     Icon: ShieldAlert, iconCls: "text-red-500", countdown: "text-red-600" },
  suspended: { bar: "bg-slate-400",   badge: "bg-slate-700 text-white",                               label: "Suspendido",       Icon: ShieldOff, iconCls: "text-slate-400", countdown: "text-slate-500" },
};

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";

export default function SubscriptionCard({ token }) {
  const [school, setSchool] = useState(null);
  const [state, setState] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("yape");
  const [operationCode, setOperationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch(`${API}/api/dashboard/school`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setSchool(d); setState(getState(d.expiration_date)); setProgress(calcProgress(d.created_at, d.expiration_date)); })
      .catch(() => {});

    fetch(`${API}/api/membership/payment-status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.pending_request) setPendingRequest(d.pending_request); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!school?.expiration_date) return;
    const i = setInterval(() => { setState(getState(school.expiration_date)); }, 60000);
    return () => clearInterval(i);
  }, [school]);

  const handleSubmitPayment = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/membership/request-payment`, {
        method: "POST",
        headers,
        body: JSON.stringify({ payment_method: paymentMethod, operation_code: operationCode }),
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRequest(data);
        setShowPayModal(false);
        setOperationCode("");
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

  if (!school || !state) return null;

  const t = T[state.id];
  const Icon = t.Icon;
  const p = school.pricing;

  return (
    <>
      <div className="bg-white border border-slate-200/80 rounded-xl px-6 py-4 shadow-sm" data-testid="subscription-card">
        <div className="flex items-center gap-5 flex-wrap">
          {/* Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon className={`w-5 h-5 ${t.iconCls} flex-shrink-0`} />
            <span className="text-sm font-bold text-slate-700 whitespace-nowrap">Suscripcion</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${t.badge} whitespace-nowrap`}>{t.label}</span>
            {pendingRequest && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200 whitespace-nowrap" data-testid="payment-verification-badge">
                Pago en verificacion
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-slate-200" />

          {/* Dates */}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Inicio:</span>
              <span className="font-semibold text-slate-600">{fmtDate(school.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Pago:</span>
              <span className="font-semibold text-slate-600">{fmtDate(school.expiration_date)}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-slate-200" />

          {/* Amount */}
          {p && (
            <>
              <div className="flex items-center gap-1.5 whitespace-nowrap" data-testid="subscription-pricing">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-slate-800" data-testid="subscription-price">S/ {p.calculated_price?.toFixed(2)}</span>
              </div>
              <div className="hidden md:block w-px h-6 bg-slate-200" />
            </>
          )}

          {/* Progress */}
          <div className="flex items-center gap-2.5 flex-1 min-w-[140px]">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${t.bar} rounded-full transition-all duration-700`} style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-400 w-7 text-right">{progress}%</span>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-slate-200" />

          {/* Countdown */}
          {state.id !== "suspended" ? (
            <div className={`flex items-center gap-1.5 ${t.countdown} whitespace-nowrap`}>
              <Clock className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">{state.days}d {state.hours}h {state.mins}m</span>
            </div>
          ) : (
            <span className="text-sm text-slate-500 font-medium">Contacte soporte</span>
          )}

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-slate-200" />

          {/* Pay button */}
          {!pendingRequest ? (
            <button
              onClick={() => setShowPayModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors whitespace-nowrap"
              data-testid="pay-renewal-btn"
            >
              <CreditCard className="w-4 h-4" />
              Pagar renovacion
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 font-semibold whitespace-nowrap" data-testid="payment-pending-indicator">
              <Loader2 className="w-4 h-4 animate-spin" />
              En verificacion
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="payment-modal">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Renovar plan EduNet</h2>
                  <p className="text-violet-200 text-sm mt-1">Pago manual con Yape o Plin</p>
                </div>
                <button onClick={() => setShowPayModal(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Amount */}
              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                <p className="text-sm text-slate-500 mb-1">Monto a pagar</p>
                <p className="text-3xl font-extrabold text-slate-800" data-testid="payment-amount">S/ {p?.calculated_price?.toFixed(2) || "0.00"}</p>
                <p className="text-xs text-slate-400 mt-1">Plan mensual</p>
              </div>

              {/* Instructions */}
              <p className="text-sm text-slate-600 text-center">
                Escanea el codigo QR con <strong>Yape</strong> o <strong>Plin</strong> para realizar tu pago.
              </p>

              {/* QR Selection */}
              <div className="flex gap-3">
                <button
                  onClick={() => setPaymentMethod("yape")}
                  className={`flex-1 rounded-xl border-2 p-3 text-center transition-all ${paymentMethod === "yape" ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-slate-300"}`}
                  data-testid="select-yape"
                >
                  <p className="text-sm font-bold text-violet-700 mb-2">Yape</p>
                  <div className="bg-white rounded-lg p-2 border">
                    <img src="/yape_qr.jpeg" alt="QR Yape" className="w-full h-auto max-h-48 object-contain mx-auto" />
                  </div>
                </button>
                <button
                  onClick={() => setPaymentMethod("plin")}
                  className={`flex-1 rounded-xl border-2 p-3 text-center transition-all ${paymentMethod === "plin" ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-slate-300"}`}
                  data-testid="select-plin"
                >
                  <p className="text-sm font-bold text-green-700 mb-2">Plin</p>
                  <div className="bg-white rounded-lg p-2 border flex items-center justify-center h-48">
                    <p className="text-xs text-slate-400">QR Plin pendiente</p>
                  </div>
                </button>
              </div>

              {/* Operation code */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Codigo de operacion (opcional)</label>
                <input
                  type="text"
                  value={operationCode}
                  onChange={(e) => setOperationCode(e.target.value)}
                  placeholder="Ingresa el codigo de tu transferencia"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                  data-testid="operation-code-input"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmitPayment}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-60"
                data-testid="confirm-payment-btn"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Ya realice el pago
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
