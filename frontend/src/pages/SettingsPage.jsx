import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Settings, Save, Upload, Image, Building2, Mail, Globe, 
  Phone, DollarSign, Loader2, Check, AlertCircle, ArrowLeft,
  GraduationCap, Palette, Camera
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" data-testid="settings-page">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate(-1)}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                data-testid="settings-back-btn"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <Settings className="w-8 h-8 text-white" />
              </div>
              
              <div className="text-white">
                <h1 className="text-3xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Ajustes del Sistema
                </h1>
                <p className="text-indigo-200">Configura la información de tu intranet</p>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              data-testid="settings-save-btn"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 -mt-4">
        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 shadow-sm" data-testid="settings-error">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-2 shadow-sm" data-testid="settings-success">
            <Check className="w-5 h-5 flex-shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Logo Section - Featured Card */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Logo del Sistema
              </h2>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-8">
                {/* Logo Preview */}
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div 
                    className="w-36 h-36 rounded-2xl border-3 border-dashed border-slate-200 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden transition-all group-hover:border-amber-400"
                    data-testid="logo-preview"
                  >
                    {settings.logo_url ? (
                      <img 
                        src={settings.logo_url} 
                        alt="Logo" 
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-2 bg-amber-100 rounded-full flex items-center justify-center">
                          <GraduationCap className="w-8 h-8 text-amber-500" />
                        </div>
                        <span className="text-xs text-slate-400">Sin logo</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                {/* Upload Controls */}
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 mb-2">Imagen de tu institución</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Este logo se mostrará en el header del dashboard y en la página de login.
                    Formatos: JPG, PNG, SVG. Máximo 5MB.
                  </p>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    data-testid="logo-file-input"
                  />
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
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
                        className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium transition-all"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* System Info Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Información del Sistema
              </h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nombre del Sistema
                  </label>
                  <input
                    type="text"
                    value={settings.system_name}
                    onChange={(e) => handleChange('system_name', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Ej: Colegio San Martín"
                    data-testid="settings-system-name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Título del Sistema
                  </label>
                  <input
                    type="text"
                    value={settings.system_title}
                    onChange={(e) => handleChange('system_title', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Ej: Intranet Escolar"
                    data-testid="settings-system-title"
                  />
                  <p className="text-xs text-slate-400 mt-1">Se mostrará en la pestaña del navegador</p>
                </div>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Información de Contacto
              </h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={settings.system_email}
                      onChange={(e) => handleChange('system_email', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="contacto@micolegio.edu.pe"
                      data-testid="settings-email"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      value={settings.whatsapp}
                      onChange={(e) => handleChange('whatsapp', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="+51 999 999 999"
                      data-testid="settings-whatsapp"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Sitio Web
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="url"
                      value={settings.website_url}
                      onChange={(e) => handleChange('website_url', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="https://www.micolegio.edu.pe"
                      data-testid="settings-website"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Moneda
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                      value={settings.currency}
                      onChange={(e) => handleChange('currency', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                      data-testid="settings-currency"
                    >
                      <option value="PEN">🇵🇪 PEN - Sol Peruano</option>
                      <option value="USD">🇺🇸 USD - Dólar Americano</option>
                      <option value="EUR">🇪🇺 EUR - Euro</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Save Button (Mobile) */}
          <div className="md:hidden">
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-4 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
