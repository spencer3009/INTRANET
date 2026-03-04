import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import {
  Palette, Image, Upload, Save, Loader2, ArrowLeft, Check,
  AlertCircle, Eye, Trash2, X
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Color Picker Component
function ColorPicker({ label, value, onChange, presets }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={value || "#7c3aed"}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-xl border-2 border-slate-200 cursor-pointer"
          />
        </div>
        <input
          type="text"
          value={value || "#7c3aed"}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-mono text-sm"
          placeholder="#7c3aed"
        />
      </div>
      {presets && (
        <div className="flex gap-2 mt-2">
          {presets.map((color) => (
            <button
              key={color}
              onClick={() => onChange(color)}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                value === color ? 'border-slate-900 scale-110' : 'border-transparent hover:border-slate-300'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Preview Card Component
function PreviewCard({ logoUrl, primaryColor, schoolName }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div 
        className="p-4 flex items-center gap-3"
        style={{ backgroundColor: primaryColor || '#7c3aed' }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-contain bg-white p-1" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Image className="w-6 h-6 text-white" />
          </div>
        )}
        <div>
          <p className="font-bold text-white">{schoolName || "Mi Colegio"}</p>
          <p className="text-white/70 text-sm">Intranet Escolar</p>
        </div>
      </div>
      <div className="p-4">
        <div className="flex gap-2 mb-3">
          <button 
            className="px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: primaryColor || '#7c3aed' }}
          >
            Botón primario
          </button>
          <button 
            className="px-4 py-2 rounded-lg text-sm font-medium border-2"
            style={{ borderColor: primaryColor || '#7c3aed', color: primaryColor || '#7c3aed' }}
          >
            Secundario
          </button>
        </div>
        <div 
          className="h-2 rounded-full"
          style={{ backgroundColor: `${primaryColor || '#7c3aed'}20` }}
        >
          <div 
            className="h-2 rounded-full w-2/3"
            style={{ backgroundColor: primaryColor || '#7c3aed' }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminBrandingPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  
  // Branding data
  const [branding, setBranding] = useState({
    logo_url: null,
    primary_color: "#7c3aed",
    secondary_color: "#f59e0b",
    accent_color: "#10b981",
    system_name: ""
  });
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  const colorPresets = [
    "#7c3aed", "#3b82f6", "#10b981", "#f59e0b", 
    "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4"
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get(`${API}/settings`, { headers });
      if (res.data) {
        setBranding(prev => ({
          ...prev,
          logo_url: res.data.logo_url,
          primary_color: res.data.primary_color || "#7c3aed",
          secondary_color: res.data.secondary_color || "#f59e0b",
          accent_color: res.data.accent_color || "#10b981",
          system_name: res.data.system_name || ""
        }));
      }
    } catch (err) {
      console.error("Error loading branding:", err);
      setError("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    
    if (!allowedTypes.includes(file.type)) {
      setError("Tipo de archivo no válido. Use JPG, PNG, WebP o SVG.");
      return;
    }
    
    if (file.size > maxSize) {
      setError("El archivo es muy grande. Máximo 5MB.");
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      // Get upload signature from backend
      const signRes = await axios.post(`${API}/upload/signature`, {
        folder: "logos",
        resource_type: "image"
      }, { headers });
      
      const { signature, timestamp, cloud_name, api_key, folder } = signRes.data;
      
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp);
      formData.append('api_key', api_key);
      formData.append('folder', folder);
      
      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        formData
      );
      
      const logoUrl = uploadRes.data.secure_url;
      setBranding(prev => ({ ...prev, logo_url: logoUrl }));
      
      // Auto-save logo
      await axios.put(`${API}/settings`, { logo_url: logoUrl }, { headers });
      
    } catch (err) {
      console.error("Upload error:", err);
      setError("Error al subir el logo. Intente de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await axios.put(`${API}/settings`, { logo_url: null }, { headers });
      setBranding(prev => ({ ...prev, logo_url: null }));
    } catch (err) {
      setError("Error al eliminar el logo");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    
    try {
      await axios.put(`${API}/settings`, {
        logo_url: branding.logo_url,
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        accent_color: branding.accent_color
      }, { headers });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-branding-page">
      <AdminSidebar
        active="branding"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={branding?.system_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={branding?.logo_url}
          schoolName={branding?.system_name}
          subdomain={subdomain}
        />

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateTo('/admin')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Branding del Colegio</h1>
                <p className="text-sm text-slate-500">Logo y colores institucionales</p>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
                saved 
                  ? "bg-emerald-600 text-white" 
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : saved ? (
                <Check className="w-5 h-5" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saved ? "Guardado" : "Guardar cambios"}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
                <X className="w-4 h-4 text-red-600" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Logo Upload */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Image className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Logo del Colegio</h3>
                    <p className="text-sm text-slate-500">PNG, JPG, WebP o SVG (máx. 5MB)</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-start gap-6">
                    {/* Logo Preview */}
                    <div className="relative">
                      {branding.logo_url ? (
                        <div className="relative group">
                          <img 
                            src={branding.logo_url} 
                            alt="Logo" 
                            className="w-32 h-32 rounded-2xl object-contain bg-slate-100 border-2 border-slate-200"
                          />
                          <button
                            onClick={handleRemoveLogo}
                            className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                          <Image className="w-12 h-12 text-slate-300" />
                        </div>
                      )}
                    </div>
                    
                    {/* Upload Button */}
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {uploading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                        ) : (
                          <Upload className="w-5 h-5 text-slate-400" />
                        )}
                        <span className="text-slate-600">
                          {uploading ? "Subiendo..." : "Subir nuevo logo"}
                        </span>
                      </button>
                      <p className="text-xs text-slate-500 mt-2">
                        Recomendado: 512x512px, fondo transparente
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Palette className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Colores Institucionales</h3>
                    <p className="text-sm text-slate-500">Personaliza la apariencia del sistema</p>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <ColorPicker
                    label="Color Principal"
                    value={branding.primary_color}
                    onChange={(v) => setBranding(prev => ({ ...prev, primary_color: v }))}
                    presets={colorPresets}
                  />
                  <ColorPicker
                    label="Color Secundario"
                    value={branding.secondary_color}
                    onChange={(v) => setBranding(prev => ({ ...prev, secondary_color: v }))}
                    presets={colorPresets}
                  />
                  <ColorPicker
                    label="Color de Acento"
                    value={branding.accent_color}
                    onChange={(v) => setBranding(prev => ({ ...prev, accent_color: v }))}
                    presets={colorPresets}
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <Eye className="w-5 h-5 text-slate-400" />
                  <h3 className="font-semibold text-slate-800">Vista Previa</h3>
                </div>
                <div className="p-6">
                  <PreviewCard 
                    logoUrl={branding.logo_url}
                    primaryColor={branding.primary_color}
                    schoolName={branding.system_name}
                  />
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>Nota:</strong> Los colores personalizados se aplicarán gradualmente a toda la interfaz en futuras actualizaciones.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
