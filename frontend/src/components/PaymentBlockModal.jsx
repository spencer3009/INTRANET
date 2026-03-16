import { useState } from "react";
import { ShieldAlert, CreditCard, Loader2, CheckCircle2, X, Upload, Image as ImageIcon } from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function PaymentBlockModal({ token, onClose, forceLock }) {
  const ctx = useSubscription();
  const [operationCode, setOperationCode] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const sub = ctx?.sub;
  if (!sub) return null;

  const isObligatory = forceLock || sub.plan_estado === "PAGO_OBLIGATORIO";
  const headers = { Authorization: `Bearer ${token}` };

  const handleScreenshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const sigRes = await axios.get(`${API}/api/cloudinary/signature`, { headers, params: { folder: "edunet/uploads" } });
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("signature", signature);
      fd.append("timestamp", String(timestamp));
      fd.append("api_key", api_key);
      fd.append("folder", folder);
      const uploadRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, fd);
      setScreenshotUrl(uploadRes.data.secure_url);
      setScreenshot(file.name);
    } catch {
      alert("Error al subir captura");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!operationCode.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/membership/request-payment`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_code: operationCode,
          payment_method: "yape",
          screenshot_url: screenshotUrl || undefined,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        ctx.refresh();
        if (!isObligatory) setTimeout(() => onClose?.(), 3000);
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
                {sub.dias_vencido} dia{sub.dias_vencido !== 1 ? "s" : ""} vencido | S/ {sub.monto_plan?.toFixed(2)} pendiente
              </p>
            </div>
            {!isObligatory && (
              <button
                onClick={onClose}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                data-testid="block-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!success ? (
            <>
              <p className="text-sm text-slate-600 text-center">
                {isObligatory
                  ? "Su acceso a los modulos esta restringido. Registre su pago para continuar."
                  : "Para continuar utilizando la plataforma EDU.NET debe registrar su pago mensual."}
              </p>

              {(sub.qr_pago_url || sub.yape_number) && (
                <div className="rounded-2xl p-[3px] bg-gradient-to-br from-violet-400 via-purple-400 to-violet-500 shadow-lg mx-auto max-w-[240px]" data-testid="yape-qr-frame">
                  <div className="rounded-[13px] overflow-hidden bg-[#7B2D8E]">
                    <div className="flex justify-center pt-2.5 pb-1">
                      <span className="text-white font-extrabold text-sm italic tracking-tight" style={{ fontFamily: 'cursive' }}>yape</span>
                    </div>
                    {sub.qr_pago_url && (
                      <div className="px-3 pb-1">
                        <div className="bg-white rounded-lg p-1 flex justify-center">
                          <img src={sub.qr_pago_url} alt="QR Yape" className="w-full max-h-40 object-contain" />
                        </div>
                      </div>
                    )}
                    {sub.yape_number && (
                      <div className="text-center pb-2.5 pt-0.5">
                        <p className="text-white/70 text-[9px]">Numero Yape</p>
                        <p className="text-white font-bold text-xs tracking-wide">+51 {sub.yape_number}</p>
                      </div>
                    )}
                  </div>
                </div>
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
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-center text-base font-bold tracking-[0.15em] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  data-testid="block-modal-operation-code"
                />
              </div>

              {/* Screenshot upload (optional) */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Captura de pago (opcional)</label>
                {!screenshot ? (
                  <label className="flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-violet-300 hover:text-violet-500 cursor-pointer transition-colors">
                    {uploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Subir captura</>
                    )}
                    <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" disabled={uploading} />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                    <ImageIcon className="w-4 h-4" />
                    <span className="flex-1 truncate">{screenshot}</span>
                    <button onClick={() => { setScreenshot(null); setScreenshotUrl(""); }} className="text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
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
                className="block text-center text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors"
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
