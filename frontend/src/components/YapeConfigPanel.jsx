import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  QrCode, Upload, Save, Loader2, User, FileText, AlertCircle, Check
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function YapeConfigPanel({ token }) {
  const [config, setConfig] = useState({
    enabled: false,
    qr_image_base64: "",
    account_holder_name: "",
    instructions_text: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newQrFile, setNewQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const fileInputRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/accounting/yape-config`, { headers });
      setConfig({
        enabled: res.data.enabled || false,
        qr_image_base64: res.data.qr_image_base64 || "",
        account_holder_name: res.data.account_holder_name || "",
        instructions_text: res.data.instructions_text || "",
      });
    } catch (err) {
      console.error("Error loading yape config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      toast.error("Solo se permiten imagenes PNG, JPG o WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no debe exceder 2MB");
      return;
    }

    setNewQrFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setQrPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleToggle = async () => {
    const newEnabled = !config.enabled;
    if (newEnabled && !config.qr_image_base64 && !newQrFile) {
      toast.error("Debe subir una imagen del codigo QR antes de activar");
      return;
    }
    setConfig(prev => ({ ...prev, enabled: newEnabled }));
  };

  const handleSave = async () => {
    if (config.enabled && !config.qr_image_base64 && !newQrFile) {
      toast.error("Debe subir una imagen del codigo QR antes de activar");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("enabled", config.enabled);
      formData.append("account_holder_name", config.account_holder_name);
      formData.append("instructions_text", config.instructions_text);
      if (newQrFile) {
        formData.append("qr_image", newQrFile);
      }

      await axios.put(`${API}/accounting/yape-config`, formData, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });

      toast.success("Configuracion de Yape guardada");
      setNewQrFile(null);
      setQrPreview(null);
      await loadConfig();
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al guardar la configuracion";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const displayQr = qrPreview || config.qr_image_base64;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="yape-config-loading">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 text-sm">Cargando configuracion...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm" data-testid="yape-config-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Cobro por Yape</h3>
            <p className="text-sm text-gray-500">Configura el codigo QR para que los padres paguen</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className="flex items-center gap-3 transition-colors"
          data-testid="yape-toggle-switch"
        >
          <span className={`text-base font-semibold ${config.enabled ? "text-emerald-600" : "text-gray-400"}`}>
            {config.enabled ? "Activado" : "Desactivado"}
          </span>
          <div className={`relative w-16 h-9 rounded-full transition-colors duration-200 ${config.enabled ? "bg-emerald-500" : "bg-gray-300"}`}>
            <div className={`absolute top-1 w-7 h-7 bg-white rounded-full shadow-md transition-transform duration-200 ${config.enabled ? "translate-x-8" : "translate-x-1"}`} />
          </div>
        </button>
      </div>

      {/* Body */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: QR Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Imagen del codigo QR de Yape</label>
            <div
              className="relative border-[3px] border-dashed border-emerald-300 rounded-2xl flex flex-col items-center justify-center aspect-square max-w-[360px] hover:border-emerald-400 transition-colors cursor-pointer bg-gray-50/30"
              onClick={() => fileInputRef.current?.click()}
              data-testid="yape-qr-upload-area"
            >
              {displayQr ? (
                <div className="relative p-4">
                  <img
                    src={displayQr}
                    alt="QR Yape"
                    className="max-w-full max-h-full rounded-lg shadow-sm object-contain"
                    data-testid="yape-qr-preview"
                  />
                  {qrPreview && (
                    <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                      Sin guardar
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center px-6">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-600 mb-1">Haz clic o arrastra una imagen</p>
                  <p className="text-sm text-gray-400">JPG, PNG o WebP. Max 2MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileChange}
                data-testid="yape-qr-file-input"
              />
            </div>
            {displayQr && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                <Upload className="w-4 h-4" />
                Cambiar imagen
              </button>
            )}
          </div>

          {/* Right: Form fields */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <User className="w-4 h-4 inline mr-1.5 text-gray-400" />
                Titular de la cuenta
              </label>
              <input
                type="text"
                value={config.account_holder_name}
                onChange={(e) => setConfig(prev => ({ ...prev, account_holder_name: e.target.value }))}
                placeholder="Ej: Colegio El Buen Pastor S.A.C."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all"
                data-testid="yape-holder-name-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <FileText className="w-4 h-4 inline mr-1.5 text-gray-400" />
                Instrucciones para los padres
              </label>
              <textarea
                value={config.instructions_text}
                onChange={(e) => setConfig(prev => ({ ...prev, instructions_text: e.target.value }))}
                placeholder="Ej: Escanee el QR con la app Yape y envie el monto exacto. En la glosa escriba el nombre del alumno."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all resize-none"
                data-testid="yape-instructions-input"
              />
            </div>

            {/* Status indicator */}
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
              config.enabled
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-gray-50 text-gray-500 border border-gray-100"
            }`}>
              {config.enabled ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Los padres pueden ver el codigo QR y reportar pagos</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>El cobro por Yape esta desactivado para los padres</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl text-sm font-semibold hover:from-slate-800 hover:to-slate-900 transition-all shadow-md disabled:opacity-50"
            data-testid="yape-save-config-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Guardando..." : "Guardar configuracion"}
          </button>
        </div>
      </div>
    </div>
  );
}
