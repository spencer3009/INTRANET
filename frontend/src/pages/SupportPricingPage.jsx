import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DollarSign, Save, Settings2, Users, Calendar, ToggleLeft, ToggleRight, Zap, QrCode, Phone, Upload, Loader2, Trash2, Image } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MODES = [
  { id: "base_plus_student", label: "Base + Por alumno", desc: "Precio base fijo + cobro por alumno desde cierto mes" },
  { id: "student_only", label: "Solo por alumno", desc: "Solo se cobra por cantidad de alumnos, sin monto fijo" },
  { id: "flat_fee", label: "Tarifa fija", desc: "Un monto fijo mensual, sin importar cantidad de alumnos" },
];

export default function SupportPricingPage({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [yapeNumber, setYapeNumber] = useState("");
  const [qrLoading, setQrLoading] = useState(true);
  const [qrSaving, setQrSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    billing_mode: "base_plus_student",
    base_monthly_fee: 50,
    per_student_fee: 0.7,
    per_student_from_month: 3,
    flat_fee: 0
  });

  useEffect(() => {
    axios.get(`${API}/support/pricing`, { headers })
      .then(r => {
        setForm({
          billing_mode: r.data.billing_mode || "base_plus_student",
          base_monthly_fee: r.data.base_monthly_fee ?? 50,
          per_student_fee: r.data.per_student_fee ?? 0.7,
          per_student_from_month: r.data.per_student_from_month ?? 3,
          flat_fee: r.data.flat_fee ?? 0
        });
      })
      .catch(() => toast.error("Error al cargar configuracion"))
      .finally(() => setLoading(false));

    // Load QR config
    axios.get(`${API}/subscription/qr-config`, { headers })
      .then(r => {
        setQrUrl(r.data.qr_pago_url || "");
        setYapeNumber(r.data.yape_number || "");
      })
      .catch(() => {})
      .finally(() => setQrLoading(false));
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

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Step 1: Get Cloudinary signature
      const sigRes = await axios.get(`${API}/cloudinary/signature`, { headers, params: { folder: "edunet/qr" } });
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;
      // Step 2: Upload to Cloudinary
      const fd = new FormData();
      fd.append("file", file);
      fd.append("signature", signature);
      fd.append("timestamp", String(timestamp));
      fd.append("api_key", api_key);
      fd.append("folder", folder);
      const uploadRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, fd);
      const url = uploadRes.data.secure_url;
      setQrUrl(url);
      // Step 3: Save config
      await axios.put(`${API}/subscription/qr-config`, { qr_pago_url: url, yape_number: yapeNumber }, { headers });
      toast.success("QR actualizado exitosamente");
    } catch (err) {
      const detail = err.response?.data?.error?.message || err.response?.data?.detail || err.message || "Error desconocido";
      toast.error(`Error al subir imagen: ${detail}`);
      console.error("QR upload error:", err.response?.data || err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSaveQrConfig = async () => {
    setQrSaving(true);
    try {
      await axios.put(`${API}/subscription/qr-config`, { qr_pago_url: qrUrl, yape_number: yapeNumber }, { headers });
      toast.success("Configuracion de pago guardada");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally {
      setQrSaving(false);
    }
  };

  const previewPrice = () => {
    const students = 20;
    if (form.billing_mode === "flat_fee") return form.flat_fee;
    if (form.billing_mode === "student_only") return students * form.per_student_fee;
    return form.base_monthly_fee + students * form.per_student_fee;
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
          {/* Billing Mode Selector */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <Zap className="w-4 h-4 text-violet-500" />
              Modo de facturacion
            </label>
            <div className="space-y-2">
              {MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setForm({ ...form, billing_mode: mode.id })}
                  data-testid={`mode-${mode.id}`}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                    form.billing_mode === mode.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-bold ${form.billing_mode === mode.id ? "text-blue-700" : "text-slate-700"}`}>{mode.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{mode.desc}</p>
                    </div>
                    {form.billing_mode === mode.id ? (
                      <ToggleRight className="w-6 h-6 text-blue-500 flex-shrink-0" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-300 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Flat Fee - only for flat_fee mode */}
          {form.billing_mode === "flat_fee" && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Tarifa fija mensual
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">S/</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.flat_fee}
                  onChange={(e) => setForm({ ...form, flat_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                  data-testid="flat-fee-input"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Se cobra este monto fijo cada mes, sin importar la cantidad de alumnos</p>
            </div>
          )}

          {/* Base monthly fee - for base_plus_student mode */}
          {form.billing_mode === "base_plus_student" && (
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
          )}

          {/* Per student fee - for base_plus_student and student_only */}
          {form.billing_mode !== "flat_fee" && (
            <>
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
                <p className="text-xs text-slate-400 mt-1.5">Los primeros {Math.max(0, form.per_student_from_month - 1)} mes(es) solo se cobra {form.billing_mode === "base_plus_student" ? "el precio base" : "nada"}, sin cobro por alumno</p>
              </div>
            </>
          )}

          {/* Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Vista previa de cobro</h3>
            <div className="space-y-2">
              {form.billing_mode === "flat_fee" ? (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Todos los meses</span>
                  <span className="font-bold text-slate-700">S/ {form.flat_fee.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Mes 1 al {Math.max(1, form.per_student_from_month - 1)}</span>
                    <span className="font-bold text-slate-700">S/ {form.billing_mode === "base_plus_student" ? form.base_monthly_fee.toFixed(2) : "0.00"}</span>
                  </div>
                  <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between text-sm">
                    <span className="text-slate-500">Desde mes {form.per_student_from_month} (ej: 20 alumnos)</span>
                    <span className="font-bold text-slate-700">S/ {previewPrice().toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1">
                    {form.billing_mode === "base_plus_student" 
                      ? `= S/ ${form.base_monthly_fee.toFixed(2)} base + 20 x S/ ${form.per_student_fee.toFixed(2)} por alumno`
                      : `= 20 x S/ ${form.per_student_fee.toFixed(2)} por alumno`
                    }
                  </p>
                </>
              )}
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

      {/* QR Payment Configuration */}
      <div className="mt-8 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm" data-testid="qr-config-section">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-violet-500" />
            Configuracion de QR de Pago
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Este QR se mostrara en el modal de pago cuando un colegio tenga suscripcion vencida</p>
        </div>

        <div className="p-6 space-y-5">
          {/* QR Preview + Upload */}
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="w-48 h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center overflow-hidden">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Yape" className="w-full h-full object-contain p-2" data-testid="qr-preview" />
                ) : (
                  <div className="text-center p-4">
                    <Image className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Sin QR configurado</p>
                  </div>
                )}
              </div>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
                uploading ? "bg-slate-100 text-slate-400" : "bg-violet-600 text-white hover:bg-violet-700"
              }`}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Subiendo..." : qrUrl ? "Cambiar QR" : "Subir QR"}
                <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} disabled={uploading} data-testid="qr-upload-input" />
              </label>
              {qrUrl && (
                <button
                  onClick={async () => {
                    setQrUrl("");
                    try {
                      await axios.put(`${API}/subscription/qr-config`, { qr_pago_url: "", yape_number: yapeNumber }, { headers });
                      toast.success("QR eliminado");
                    } catch { toast.error("Error al eliminar QR"); }
                  }}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                  data-testid="delete-qr-btn"
                >
                  <Trash2 className="w-3 h-3" />
                  Eliminar QR
                </button>
              )}
            </div>

            <div className="flex-1 space-y-4 w-full">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Phone className="w-4 h-4 text-emerald-500" />
                  Numero de Yape
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm text-slate-500">+51</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={9}
                    value={yapeNumber.replace("+51", "")}
                    onChange={(e) => setYapeNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    placeholder="999 999 999"
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-r-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                    data-testid="yape-number-input"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Este numero se mostrara junto al QR en el modal de pago</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <QrCode className="w-4 h-4 text-blue-500" />
                  URL del QR (opcional)
                </label>
                <input
                  type="url"
                  value={qrUrl}
                  onChange={(e) => setQrUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                  data-testid="qr-url-input"
                />
                <p className="text-xs text-slate-400 mt-1.5">Se llena automaticamente al subir imagen, o puedes pegar una URL directamente</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
          <button
            onClick={handleSaveQrConfig}
            disabled={qrSaving}
            className="px-6 py-2.5 bg-[#001f4b] text-white font-semibold text-sm rounded-xl hover:bg-[#0a3068] transition-all disabled:opacity-50 flex items-center gap-2"
            data-testid="save-qr-btn"
          >
            {qrSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar configuracion de pago
          </button>
        </div>
      </div>
    </div>
  );
}
