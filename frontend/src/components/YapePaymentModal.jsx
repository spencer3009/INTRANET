import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { X, Loader2, QrCode, User, FileText, AlertCircle, Check, ChevronRight } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function YapePaymentModal({ isOpen, onClose, payment, yapeConfig, token, onSuccess }) {
  const [step, setStep] = useState(1);
  const [operationCode, setOperationCode] = useState("");
  const [amount, setAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (payment) {
      setAmount(payment.amount || payment.total_amount || 0);
      setOperationCode("");
      setStep(1);
    }
  }, [payment]);

  if (!isOpen || !payment) return null;

  const headers = { Authorization: `Bearer ${token}` };

  const handleSubmit = async () => {
    if (!operationCode.trim() || operationCode.trim().length !== 8) {
      toast.error("El codigo de operacion debe tener exactamente 8 digitos");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/api/parent-payments/report`, {
        student_id: payment.student_id,
        month: payment.month,
        year: payment.year,
        amount: parseFloat(amount),
        yape_operation_code: operationCode.trim(),
        concept: payment.concept || payment.description || payment.month_name,
        is_pronto_pago: !!payment._isProntoPago,
      }, { headers });

      toast.success("Pago reportado exitosamente. Sera verificado por el colegio.");
      setOperationCode("");
      setStep(1);
      onSuccess?.();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail || "Error al reportar el pago";
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 8);
    setOperationCode(val);
  };

  const handleClose = () => {
    setStep(1);
    setOperationCode("");
    onClose();
  };

  const steps = [
    { num: 1, label: "Escanear QR" },
    { num: 2, label: "Codigo" },
    { num: 3, label: "Confirmar" },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" data-testid="yape-payment-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-purple-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            <h3 className="text-lg font-bold">Pagar con Yape</h3>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors" data-testid="yape-modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Payment info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Alumno:</span>
              <span className="font-medium text-gray-800">{payment.student_name || "-"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Concepto:</span>
              <span className="font-medium text-gray-800">{payment.month_name || payment.concept || payment.description || "-"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Monto a pagar:</span>
              <span className="font-bold text-lg text-purple-700">S/ {(payment.amount || payment.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > s.num
                    ? "bg-emerald-500 text-white"
                    : step === s.num
                      ? "bg-purple-600 text-white ring-4 ring-purple-100"
                      : "bg-gray-200 text-gray-500"
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${step === s.num ? "text-purple-700" : "text-gray-400"}`}>{s.label}</span>
                {i < steps.length - 1 && <div className={`w-8 h-0.5 ${step > s.num ? "bg-emerald-400" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>

          {/* STEP 1: QR */}
          {step === 1 && (
            <div data-testid="yape-step-1">
              <p className="text-base font-bold text-gray-800 mb-3 text-center">Escanea el codigo QR con Yape</p>

              {yapeConfig?.qr_image_base64 ? (
                <div className="border border-gray-200 rounded-xl p-2 flex justify-center bg-white mb-3">
                  <img
                    src={yapeConfig.qr_image_base64}
                    alt="QR Yape"
                    className="max-w-[190px] w-full rounded-lg"
                    data-testid="yape-modal-qr-image"
                  />
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl p-6 text-center bg-gray-50 mb-3">
                  <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">QR no disponible</p>
                </div>
              )}

              {yapeConfig?.account_holder_name && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>Titular: <strong>{yapeConfig.account_holder_name}</strong></span>
                </div>
              )}

              <style>{`
                @keyframes bounce-x {
                  0%, 100% { transform: translateX(0); }
                  50% { transform: translateX(8px); }
                }
                .animate-bounce-x { animation: bounce-x 0.5s ease-in-out infinite; }
              `}</style>

              <button
                onClick={() => setStep(2)}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2 shadow-lg relative overflow-hidden group"
                data-testid="yape-step1-next-btn"
              >
                <span className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                <span className="relative flex items-center gap-2">
                  Siguiente
                  <span className="animate-bounce-x inline-flex"><ChevronRight className="w-7 h-7" /></span>
                </span>
              </button>
            </div>
          )}

          {/* STEP 2: Operation Code */}
          {step === 2 && (
            <div data-testid="yape-step-2">
              <p className="text-base font-bold text-gray-800 mb-2 text-center">Ingresa el codigo de operacion</p>
              <p className="text-sm text-gray-500 mb-6 text-center">Lo encuentras en el comprobante de Yape (8 digitos)</p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Codigo de operacion Yape *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={operationCode}
                  onChange={handleCodeChange}
                  placeholder="12345678"
                  maxLength={8}
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl text-2xl font-bold text-center tracking-[0.3em] focus:ring-4 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all placeholder:text-gray-300 placeholder:tracking-[0.3em]"
                  data-testid="yape-operation-code-input"
                  autoFocus
                />
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-gray-400">Solo numeros</p>
                  <p className={`text-xs font-semibold ${operationCode.length === 8 ? "text-emerald-600" : "text-gray-400"}`}>
                    {operationCode.length}/8
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-bold text-base transition-colors hover:bg-gray-50"
                >
                  Atras
                </button>
                <button
                  onClick={() => {
                    if (operationCode.length !== 8) {
                      toast.error("El codigo debe tener exactamente 8 digitos");
                      return;
                    }
                    setStep(3);
                  }}
                  disabled={operationCode.length !== 8}
                  className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="yape-step2-next-btn"
                >
                  Siguiente
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 3 && (
            <div data-testid="yape-step-3">
              <p className="text-base font-bold text-gray-800 mb-5 text-center">Confirma tu pago</p>

              <div className="bg-gray-50 rounded-xl p-5 space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Alumno:</span>
                  <span className="font-semibold text-gray-800">{payment.student_name || "-"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Concepto:</span>
                  <span className="font-semibold text-gray-800">{payment.month_name || payment.concept || "-"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Codigo Yape:</span>
                  <code className="font-bold text-lg tracking-wider text-purple-700">{operationCode}</code>
                </div>
                <hr className="border-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Monto:</span>
                  <span className="font-black text-2xl text-purple-700">S/ {parseFloat(amount).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 mb-5">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Su pago sera verificado por el colegio. Recibira confirmacion una vez validado.</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-bold text-base transition-colors hover:bg-gray-50"
                >
                  Atras
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  data-testid="yape-submit-payment-btn"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  {submitting ? "Enviando..." : "Confirmar Pago"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
