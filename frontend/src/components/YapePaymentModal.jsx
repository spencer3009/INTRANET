import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { X, Loader2, QrCode, Hash, DollarSign, User, FileText, AlertCircle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function YapePaymentModal({ isOpen, onClose, payment, yapeConfig, token, onSuccess }) {
  const [operationCode, setOperationCode] = useState("");
  const [amount, setAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (payment) {
      setAmount(payment.total_amount || payment.amount || 0);
      setOperationCode("");
    }
  }, [payment]);

  if (!isOpen || !payment) return null;

  const headers = { Authorization: `Bearer ${token}` };

  const handleSubmit = async () => {
    if (!operationCode.trim() || operationCode.trim().length < 4) {
      toast.error("El codigo de operacion debe tener al menos 4 caracteres");
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
      }, { headers });

      toast.success("Pago reportado exitosamente. Sera verificado por el colegio.");
      setOperationCode("");
      onSuccess?.();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail || "Error al reportar el pago";
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" data-testid="yape-payment-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-purple-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            <h3 className="text-lg font-bold">Pagar con Yape</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors" data-testid="yape-modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Payment info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
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
              <span className="font-bold text-lg text-purple-700">S/ {(payment.total_amount || payment.amount || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Step 1: QR */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Escanea el codigo QR con Yape
            </p>
            {yapeConfig?.qr_image_base64 ? (
              <div className="border border-gray-200 rounded-xl p-4 flex justify-center bg-white">
                <img
                  src={yapeConfig.qr_image_base64}
                  alt="QR Yape"
                  className="max-w-[250px] w-full rounded-lg"
                  data-testid="yape-modal-qr-image"
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-8 text-center bg-gray-50">
                <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">QR no disponible</p>
              </div>
            )}
            {yapeConfig?.account_holder_name && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4 text-gray-400" />
                <span>Titular: <strong>{yapeConfig.account_holder_name}</strong></span>
              </div>
            )}
            {yapeConfig?.instructions_text && (
              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700 flex gap-2">
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{yapeConfig.instructions_text}</span>
              </div>
            )}
          </div>

          {/* Step 2: Operation code */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Ingresa el codigo de operacion
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Codigo de operacion Yape *</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={operationCode}
                    onChange={(e) => setOperationCode(e.target.value)}
                    placeholder="Ej: Y1234567890"
                    maxLength={30}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
                    data-testid="yape-operation-code-input"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Lo encuentras en el comprobante de Yape</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monto pagado (S/)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
                    data-testid="yape-amount-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Su pago sera verificado por el colegio. Recibira confirmacion una vez validado.</span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="yape-submit-payment-btn"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            {submitting ? "Reportando pago..." : "Reportar Pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
