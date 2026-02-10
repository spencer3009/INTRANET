import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Settings, Save, Upload, Image, Building2, Mail, Globe, 
  Phone, DollarSign, Loader2, Check, AlertCircle, ArrowLeft,
  GraduationCap
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SettingsPage({ user, token, onSettingsUpdate }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [settings, setSettings] = useState({
    logo_url: "",
    system_name: "",
    system_title: "",
    system_email: "",
    currency: "PEN",
    whatsapp: "",
    website_url: ""
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const headers = { Authorization: `Bearer ${token}` };

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API}/settings`, { headers });
        setSettings({
          logo_url: res.data.logo_url || "",
          system_name: res.data.system_name || "",
          system_title: res.data.system_title || "",
          system_email: res.data.system_email || "",
          currency: res.data.currency || "PEN",
          whatsapp: res.data.whatsapp || "",
          website_url: res.data.website_url || ""
        });
      } catch (err) {
        setError(err.response?.data?.detail || "Error al cargar ajustes");
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [token]);

  // Handle logo upload to Cloudinary
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Solo se permiten archivos de imagen");
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo no debe superar 5MB");
      return;
    }
    
    setUploading(true);
    setError("");
    
    try {
      // Get signature from backend
      const sigRes = await axios.get(
        `${API}/cloudinary/signature?resource_type=image&folder=edunet/logos`,
        { headers }
      );
      const sig = sigRes.data;
      
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", sig.api_key);
      formData.append("timestamp", sig.timestamp);
      formData.append("signature", sig.signature);
      formData.append("folder", sig.folder);
      
      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        { method: "POST", body: formData }
      );
      
      const uploadData = await uploadRes.json();
      
      if (uploadData.secure_url) {
        setSettings(prev => ({ ...prev, logo_url: uploadData.secure_url }));
        setSuccess("Logo subido correctamente");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        throw new Error("Error al subir imagen");
      }
    } catch (err) {
      setError(err.message || "Error al subir el logo");
    } finally {
      setUploading(false);
    }
  };

  // Save settings
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      const res = await axios.put(`${API}/settings`, settings, { headers });
      setSuccess("Ajustes guardados correctamente");
      
      // Notify parent component
      if (onSettingsUpdate) {
        onSettingsUpdate(res.data.settings);
      }
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar ajustes");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="settings-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="settings-back-btn"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#001f4b]" />
                  Ajustes del Sistema
                </h1>
                <p className="text-sm text-slate-500">Configura la información de tu intranet</p>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#001f4b] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#002d6b] transition-all disabled:opacity-50"
              data-testid="settings-save-btn"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2" data-testid="settings-error">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-2" data-testid="settings-success">
            <Check className="w-5 h-5" />
            {success}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          {/* Logo Section */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Image className="w-5 h-5 text-[#e1b82c]" />
              Logo del Sistema
            </h2>
            
            <div className="flex items-start gap-6">
              {/* Logo Preview */}
              <div className="flex-shrink-0">
                <div 
                  className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden"
                  data-testid="logo-preview"
                >
                  {settings.logo_url ? (
                    <img 
                      src={settings.logo_url} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                      <span className="text-xs text-slate-400">Sin logo</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Upload Controls */}
              <div className="flex-1">
                <p className="text-sm text-slate-600 mb-3">
                  Sube el logo de tu institución. Formatos: JPG, PNG, SVG. Máximo 5MB.
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  data-testid="logo-file-input"
                />
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50"
                  data-testid="logo-upload-btn"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? "Subiendo..." : "Subir Logo"}
                </button>
                
                {settings.logo_url && (
                  <button
                    type="button"
                    onClick={() => handleChange('logo_url', '')}
                    className="ml-3 text-sm text-red-600 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* System Info Section */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#e1b82c]" />
              Información del Sistema
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nombre del Sistema
                </label>
                <input
                  type="text"
                  value={settings.system_name}
                  onChange={(e) => handleChange('system_name', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                  placeholder="Ej: Colegio San Martín"
                  data-testid="settings-system-name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Título del Sistema
                </label>
                <input
                  type="text"
                  value={settings.system_title}
                  onChange={(e) => handleChange('system_title', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                  placeholder="Ej: Intranet Escolar"
                  data-testid="settings-system-title"
                />
                <p className="text-xs text-slate-400 mt-1">Se mostrará en la pestaña del navegador</p>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#e1b82c]" />
              Información de Contacto
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={settings.system_email}
                    onChange={(e) => handleChange('system_email', e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                    placeholder="contacto@micolegio.edu.pe"
                    data-testid="settings-email"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  WhatsApp
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    value={settings.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                    placeholder="+51 999 999 999"
                    data-testid="settings-whatsapp"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sitio Web
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="url"
                    value={settings.website_url}
                    onChange={(e) => handleChange('website_url', e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                    placeholder="https://www.micolegio.edu.pe"
                    data-testid="settings-website"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Moneda
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    value={settings.currency}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all appearance-none"
                    data-testid="settings-currency"
                  >
                    <option value="PEN">PEN - Sol Peruano</option>
                    <option value="USD">USD - Dólar Americano</option>
                    <option value="EUR">EUR - Euro</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Save Button (Mobile) */}
          <div className="md:hidden">
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-[#001f4b] text-white px-5 py-3.5 rounded-xl font-semibold hover:bg-[#002d6b] transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
