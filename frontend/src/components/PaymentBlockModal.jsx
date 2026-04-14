import { useState } from "react";
import { ShieldAlert, CreditCard, Loader2, CheckCircle2, X, ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";

const API = process.env.REACT_APP_BACKEND_URL;

const INVALID_OPERATION_PATTERNS = [
  "12345678", "87654321", "00000000",
  "11111111", "22222222", "33333333", "44444444",
  "55555555", "66666666", "77777777", "88888888", "99999999"
];

export default function PaymentBlockModal({ token, onClose, forceLock, schoolData }) {
  const ctx = useSubscription();
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [operationCode, setOperationCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successTime, setSuccessTime] = useState("");

  const sub = schoolData || ctx?.sub;
  if (!sub) return null;

  const isObligatory = forceLock || sub.plan_estado === "PAGO_OBLIGATORIO";
  const headers = { Authorization: `Bearer ${token}` };

  const validateCode = (code) => {
    if (!/^\d{8}$/.test(code)) return "El numero de operacion debe tener exactamente 8 digitos numericos.";
    if (INVALID_OPERATION_PATTERNS.includes(code)) return "Este numero de operacion no es valido. Revisa tu comprobante de Yape.";
    return "";
  };

  const handleCodeChange = (val) => {
    const clean = val.replace(/\D/g, "").slice(0, 8);
    setOperationCode(clean);
    if (codeError && clean.length === 8) setCodeError(validateCode(clean));
    else if (clean.length < 8) setCodeError("");
  };

  const handleSubmit = async () => {
    const err = validateCode(operationCode);
    if (err) { setCodeError(err); return; }
    setSubmitting(true);
    setCodeError("");
    try {
      const res = await fetch(`${API}/api/membership/request-payment`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ operation_code: operationCode, payment_method: "yape" }),
      });
      if (res.ok) {
        setSuccess(true);
        setSuccessTime(new Date().toLocaleString("es-PE"));
        setStep(3);
        ctx?.refresh?.();
      } else {
        const data = await res.json();
        const detail = data.detail || "";
        if (detail === "OPERATION_CODE_DUPLICATE") {
          setCodeError("Este numero de operacion ya fue registrado previamente. Verifica tu comprobante de Yape e intentalo nuevamente.");
        } else if (detail === "INVALID_OPERATION_PATTERN" || detail === "INVALID_OPERATION_FORMAT") {
          setCodeError("Este numero de operacion no es valido. Revisa tu comprobante de Yape.");
        } else {
          setCodeError(detail || "Error al registrar el pago.");
        }
      }
    } catch {
      setCodeError("Error de conexion. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
      {[1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-1.5">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-400"}`}>{s}</div>
          {s < 3 && <div className={`w-6 h-0.5 ${step > s ? "bg-violet-600" : "bg-slate-200"}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4" data-testid="payment-block-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Suscripcion Vencida
              </h2>
              <p className="text-red-200 text-xs mt-0.5">
                {sub.dias_vencido} dia{sub.dias_vencido !== 1 ? "s" : ""} vencido | S/ {sub.monto_plan?.toFixed(2)} pendiente
              </p>
            </div>
            {!isObligatory && step !== 3 && (
              <button onClick={onClose} className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg" data-testid="block-modal-close">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <StepIndicator />

        <div className="px-4 py-4">
          {/* ═══ STEP 1: Scan & Pay ═══ */}
          {step === 1 && (
            <div className="space-y-3" data-testid="step-1">
              <p className="text-sm text-slate-600 text-center">
                {isObligatory
                  ? "Su acceso esta restringido. Realice el pago para continuar."
                  : "Escanea el QR con Yape y realiza el pago."}
              </p>

              {(sub.qr_pago_url || sub.yape_number) && (
                <div className="rounded-xl p-[2px] bg-gradient-to-br from-violet-400 via-purple-400 to-violet-500 shadow-lg mx-auto max-w-[180px]">
                  <div className="rounded-[10px] overflow-hidden bg-[#7B2D8E]">
                    <div className="flex justify-center pt-2 pb-0.5">
                      <span className="text-white font-extrabold text-xs italic tracking-tight" style={{ fontFamily: 'cursive' }}>yape</span>
                    </div>
                    {sub.qr_pago_url && (
                      <div className="px-2 pb-1">
                        <div className="bg-white rounded-md p-1 flex justify-center">
                          <img src={sub.qr_pago_url} alt="QR Yape" className="w-full max-h-28 object-contain" />
                        </div>
                      </div>
                    )}
                    {sub.yape_number && (
                      <div className="text-center pb-2 pt-0.5">
                        <p className="text-white/70 text-[8px]">Numero Yape</p>
                        <p className="text-white font-bold text-[11px] tracking-wide">+51 {sub.yape_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg px-3 py-2 text-center border">
                <p className="text-xs text-slate-400">Monto a pagar</p>
                <p className="text-2xl font-extrabold text-slate-800">S/ {sub.monto_plan?.toFixed(2)}</p>
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-violet-50 border border-violet-200 rounded-xl cursor-pointer" data-testid="confirm-checkbox">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-violet-600 focus:ring-violet-500" />
                <span className="text-xs text-violet-800 font-medium leading-tight">Confirmo que ya realice el pago por Yape</span>
              </label>

              <button
                onClick={() => setStep(2)}
                disabled={!confirmed}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="step1-next"
              >
                Ya realice el pago <ArrowRight className="w-4 h-4" />
              </button>

              {!isObligatory && (
                <button onClick={onClose} className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors py-1">
                  Cancelar
                </button>
              )}
              {isObligatory && (
                <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.href = "/"; }}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors py-1" data-testid="block-modal-logout">
                  Cerrar sesion
                </button>
              )}
            </div>
          )}

          {/* ═══ STEP 2: Enter operation code ═══ */}
          {step === 2 && (
            <div className="space-y-3" data-testid="step-2">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-xs text-amber-800 font-medium leading-tight">
                  El numero de operacion es obligatorio para verificar tu pago. Sin este dato, tu suscripcion no sera reactivada aunque hayas pagado.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Numero de operacion (8 digitos)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={operationCode}
                  onChange={e => handleCodeChange(e.target.value)}
                  placeholder="Ej: 45782193"
                  className={`w-full px-4 py-3 border-2 rounded-xl text-center text-lg font-bold tracking-[0.2em] focus:outline-none transition-colors ${codeError ? "border-red-400 bg-red-50 focus:ring-red-200" : "border-slate-200 bg-slate-50 focus:ring-violet-200 focus:border-violet-400"}`}
                  data-testid="block-modal-operation-code"
                  autoFocus
                />
                {codeError && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-start gap-1" data-testid="code-error">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {codeError}
                  </p>
                )}
              </div>

              <p className="text-[10px] text-slate-400 text-center">Encuentras este numero en el comprobante de Yape despues de realizar tu pago.</p>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={operationCode.length !== 8 || submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-40"
                  data-testid="block-modal-submit"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Registrar pago
                </button>
              </div>

              <a href="https://wa.me/51992021294?text=Hola,%20necesito%20ayuda%20con%20mi%20pago%20de%20EduNet" target="_blank" rel="noreferrer"
                className="block text-center text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
                Necesitas ayuda? Contactar soporte
              </a>
            </div>
          )}

          {/* ═══ STEP 3: Confirmation ═══ */}
          {step === 3 && (
            <div className="text-center py-4 space-y-3" data-testid="step-3">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <div>
                <h3 className="text-lg font-bold text-slate-800">Pago registrado correctamente</h3>
                <p className="text-sm text-slate-500 mt-1">Nuestro equipo de soporte validara tu numero de operacion y reactivara tu suscripcion en breve.</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">N. de operacion</span>
                  <span className="font-bold text-slate-700 tracking-wider">{operationCode}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Fecha/hora</span>
                  <span className="font-medium text-slate-600">{successTime}</span>
                </div>
              </div>
              <button onClick={() => { onClose?.(); }}
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors" data-testid="step3-close">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
