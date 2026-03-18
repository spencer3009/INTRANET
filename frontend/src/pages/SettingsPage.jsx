import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import MobileBottomNav from "@/components/MobileBottomNav";
import CarouselManager from "@/components/CarouselManager";
import AccessDenied from "@/components/AccessDenied";
import { canAccessSection } from "@/lib/permissions";
import { 
  Settings, Save, Upload, Image, Building2, Mail, Globe, 
  Phone, DollarSign, Loader2, Check, AlertCircle, ArrowLeft,
  GraduationCap, Palette, Camera, Images, HardDrive, Link2,
  Unlink, RefreshCw, CheckCircle2, XCircle, Clock, Users, Shield, UserCheck, Megaphone
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SettingsPage({ user, token, subdomain, onLogout, onSettingsUpdate }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // RBAC: Check if user can access settings
  const hasAccess = canAccessSection(user, 'settings');
  
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
  
  // Role settings state
  const [allowAdminAccounting, setAllowAdminAccounting] = useState(false);
  const [allowPendingStudents, setAllowPendingStudents] = useState(false);
  const [allowAdminBroadcast, setAllowAdminBroadcast] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  
  // Attendance config state
  const [attendanceConfig, setAttendanceConfig] = useState({
    student_entry_time: "07:30",
    teacher_entry_time: "07:15",
    tolerance_minutes: 5,
    mark_absent_after_minutes: 30,
    allow_late_entry: true,
    auto_late_enabled: false,
  });
  const [savingAttendance, setSavingAttendance] = useState(false);
  
  // Google Drive states
  const [driveStatus, setDriveStatus] = useState({
    server_configured: false,
    connected: false,
    email: null,
    connected_at: null
  });
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [driveSuccess, setDriveSuccess] = useState("");
  
  const headers = { Authorization: `Bearer ${token}` };

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API}/settings`, { headers });
        // Load role settings from response
        setAllowAdminAccounting(res.data.allow_admin_accounting || false);
        setAllowPendingStudents(res.data.permitir_acceso_estudiantes_pendientes || false);
        setAllowAdminBroadcast(res.data.allow_admin_broadcast || false);
        if (res.data.attendance_config) {
          setAttendanceConfig(prev => ({ ...prev, ...res.data.attendance_config }));
        }
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
  
  // Fetch Google Drive status
  useEffect(() => {
    const fetchDriveStatus = async () => {
      try {
        const res = await axios.get(`${API}/integrations/google-drive/status`, { headers });
        setDriveStatus(res.data);
      } catch (err) {
        console.error("Error fetching Drive status:", err);
      }
    };
    
    fetchDriveStatus();
  }, [token]);
  
  // Handle OAuth callback results from URL params
  useEffect(() => {
    const successParam = searchParams.get("success");
    const errorParam = searchParams.get("error");
    
    if (successParam === "google_drive_connected") {
      setDriveSuccess("¡Google Drive conectado correctamente!");
      // Refresh status
      axios.get(`${API}/integrations/google-drive/status`, { headers })
        .then(res => setDriveStatus(res.data))
        .catch(console.error);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setDriveSuccess(""), 5000);
    }
    
    if (errorParam) {
      const errorMessages = {
        oauth_denied: "Acceso denegado. Por favor autoriza la aplicación.",
        invalid_callback: "Callback inválido. Por favor intenta de nuevo.",
        invalid_state: "Estado inválido. Por favor intenta de nuevo.",
        no_refresh_token: "No se recibió token de actualización. Por favor intenta de nuevo.",
        connection_failed: "Error al conectar con Google Drive. Por favor intenta de nuevo."
      };
      setDriveError(errorMessages[errorParam] || "Error desconocido");
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setDriveError(""), 5000);
    }
  }, [searchParams]);
  
  // Connect to Google Drive
  const handleConnectGoogleDrive = async () => {
    setDriveLoading(true);
    setDriveError("");
    
    try {
      const res = await axios.get(
        `${API}/integrations/google-drive/auth?school_id=${user?.school_id}`,
        { headers }
      );
      
      if (res.data.authorization_url) {
        // Redirect to Google OAuth
        window.location.href = res.data.authorization_url;
      }
    } catch (err) {
      setDriveError(err.response?.data?.detail || "Error al iniciar conexión con Google Drive");
      setDriveLoading(false);
    }
  };
  
  // Disconnect Google Drive
  const handleDisconnectGoogleDrive = async () => {
    if (!window.confirm("¿Estás seguro de desconectar Google Drive? Los materiales existentes seguirán en Drive pero no podrás subir nuevos.")) {
      return;
    }
    
    setDriveLoading(true);
    setDriveError("");
    
    try {
      await axios.post(`${API}/integrations/google-drive/disconnect`, {}, { headers });
      setDriveStatus(prev => ({ ...prev, connected: false, email: null, connected_at: null }));
      setDriveSuccess("Google Drive desconectado correctamente");
      setTimeout(() => setDriveSuccess(""), 3000);
    } catch (err) {
      setDriveError(err.response?.data?.detail || "Error al desconectar Google Drive");
    } finally {
      setDriveLoading(false);
    }
  };
  
  // Check if current user is owner/propietario
  const isOwner = user?.is_owner || user?.role === "owner" || user?.role === "director";

  // Handle logo upload to Cloudinary
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError("Solo se permiten archivos de imagen");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo no debe superar 5MB");
      return;
    }
    
    setUploading(true);
    setError("");
    
    try {
      const sigRes = await axios.get(
        `${API}/cloudinary/signature?resource_type=image&folder=edunet/logos`,
        { headers }
      );
      const sig = sigRes.data;
      
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

  // Handle role settings toggle
  const handleToggleAdminAccounting = async () => {
    setSavingRoles(true);
    try {
      const newValue = !allowAdminAccounting;
      await axios.put(`${API}/settings/roles`, { allow_admin_accounting: newValue }, { headers });
      setAllowAdminAccounting(newValue);
      setSuccess(newValue ? "Administradores ahora pueden acceder a Contabilidad" : "Acceso de administradores a Contabilidad deshabilitado");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al actualizar configuración de roles");
    } finally {
      setSavingRoles(false);
    }
  };

  const handleTogglePendingStudents = async () => {
    setSavingRoles(true);
    try {
      const newValue = !allowPendingStudents;
      await axios.put(`${API}/settings/roles`, { permitir_acceso_estudiantes_pendientes: newValue }, { headers });
      setAllowPendingStudents(newValue);
      setSuccess(newValue ? "Estudiantes pendientes ahora pueden acceder al sistema" : "Acceso de estudiantes pendientes deshabilitado");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al actualizar configuración");
    } finally {
      setSavingRoles(false);
    }
  };

  // Save attendance config
  const handleSaveAttendanceConfig = async () => {
    setSavingAttendance(true);
    try {
      await axios.put(`${API}/settings/attendance`, attendanceConfig, { headers });
      setSuccess("Configuracion de asistencia guardada");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar configuracion de asistencia");
    } finally {
      setSavingAttendance(false);
    }
  };


  const handleToggleAdminBroadcast = async () => {
    setSavingRoles(true);
    try {
      const newValue = !allowAdminBroadcast;
      await axios.put(`${API}/settings/roles`, { allow_admin_broadcast: newValue }, { headers });
      setAllowAdminBroadcast(newValue);
      setSuccess(newValue ? "Administradores ahora pueden enviar comunicados institucionales" : "Solo el propietario puede enviar comunicados");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al actualizar configuración");
    } finally {
      setSavingRoles(false);
    }
  };

  const schoolName = settings.system_name || user?.name || "Mi Colegio";
  const logoUrl = settings.logo_url;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  // RBAC: Show access denied if user doesn't have permission
  if (!hasAccess) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar
          active="ajustes"
          onNavigate={() => {}}
          expanded={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          schoolName={schoolName}
          subdomain={subdomain}
          user={user}
        />
        <div className="flex-1 flex flex-col">
          <DashboardHeader
            user={user}
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            onLogout={onLogout}
            subdomain={subdomain}
          />
          <AccessDenied 
            title="Acceso Restringido"
            message="Solo el propietario puede acceder a los ajustes del sistema."
            suggestion="Contacta al propietario si necesitas realizar cambios en la configuración."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="settings-page">
      <Sidebar
        active="ajustes"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain}
        user={user}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
        />

        <main className="flex-1 overflow-y-auto custom-scroll p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          {/* Page Header */}
          <div className="relative overflow-hidden rounded-2xl mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative px-8 py-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
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
            {/* Logo Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Logo del Sistema
                </h2>
              </div>
              
              <div className="p-6">
                <div className="flex items-center gap-8">
                  <div 
                    className="relative group cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div 
                      className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden transition-all group-hover:border-amber-400"
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
                          <div className="w-14 h-14 mx-auto mb-2 bg-amber-100 rounded-full flex items-center justify-center">
                            <GraduationCap className="w-7 h-7 text-amber-500" />
                          </div>
                          <span className="text-xs text-slate-400">Sin logo</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800 mb-2">Imagen de tu institución</h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Este logo se mostrará en el header y en la página de login.
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

            {/* Google Drive Integration - Only for owners */}
            {isOwner && (
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden" data-testid="google-drive-section">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-5 h-5" />
                    Integración Google Drive
                  </h2>
                </div>
                
                <div className="p-6">
                  {/* Status Messages */}
                  {driveError && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                      <XCircle className="w-5 h-5 flex-shrink-0" />
                      {driveError}
                    </div>
                  )}
                  
                  {driveSuccess && (
                    <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      {driveSuccess}
                    </div>
                  )}
                  
                  {/* Server Configuration Warning */}
                  {!driveStatus.server_configured && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span>Google Drive no está configurado en el servidor. Contacta al administrador.</span>
                    </div>
                  )}
                  
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Status Card */}
                    <div className="flex-1">
                      <div className={`p-5 rounded-xl border-2 ${
                        driveStatus.connected 
                          ? 'bg-emerald-50 border-emerald-200' 
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            driveStatus.connected 
                              ? 'bg-emerald-500' 
                              : 'bg-slate-400'
                          }`}>
                            <HardDrive className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800">Estado de Conexión</h3>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                                driveStatus.connected ? 'text-emerald-600' : 'text-slate-500'
                              }`}>
                                <span className={`w-2 h-2 rounded-full ${
                                  driveStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}></span>
                                {driveStatus.connected ? 'Conectado' : 'No conectado'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {driveStatus.connected && (
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Mail className="w-4 h-4" />
                              <span>{driveStatus.email}</span>
                            </div>
                            {driveStatus.connected_at && (
                              <div className="flex items-center gap-2 text-slate-500">
                                <Clock className="w-4 h-4" />
                                <span>
                                  Conectado el {new Date(driveStatus.connected_at).toLocaleDateString('es-PE', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {!driveStatus.connected && (
                          <p className="text-sm text-slate-500">
                            Es <strong>obligatorio</strong> conectar Google Drive para subir materiales de estudio.
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                      {!driveStatus.connected ? (
                        <button
                          type="button"
                          onClick={handleConnectGoogleDrive}
                          disabled={driveLoading || !driveStatus.server_configured}
                          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                          data-testid="connect-google-drive-btn"
                        >
                          {driveLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Link2 className="w-5 h-5" />
                          )}
                          Conectar con Google Drive
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleConnectGoogleDrive}
                            disabled={driveLoading}
                            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50"
                            data-testid="reconnect-google-drive-btn"
                          >
                            {driveLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            Reconectar
                          </button>
                          
                          <button
                            type="button"
                            onClick={handleDisconnectGoogleDrive}
                            disabled={driveLoading}
                            className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50"
                            data-testid="disconnect-google-drive-btn"
                          >
                            {driveLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Unlink className="w-4 h-4" />
                            )}
                            Desconectar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Info Box */}
                  <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Información importante
                    </h4>
                    <ul className="text-sm text-blue-700 space-y-1.5">
                      <li>• Los archivos PDF, Word, Excel, PowerPoint y ZIP se guardarán en Google Drive.</li>
                      <li>• Las imágenes seguirán usando Cloudinary.</li>
                      <li>• Se creará automáticamente la carpeta <strong>EduNet/Materiales</strong> en tu Drive.</li>
                      <li>• Los estudiantes podrán descargar los materiales sin ver los enlaces de Drive.</li>
                      <li>• Solo el propietario puede conectar o desconectar Google Drive.</li>
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* Role Settings Section - Only for owner */}
            {(user?.role === "owner" || user?.is_owner) && (
              <>
              <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mt-8" data-testid="role-settings-section">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Configuración de Roles</h2>
                    <p className="text-sm text-slate-500">Controla los permisos de acceso por rol</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Admin Accounting Access Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                        <Users className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">Acceso de Administradores a Contabilidad</h3>
                        <p className="text-sm text-slate-500">
                          Permite que usuarios con rol "Administrador" vean el módulo de Contabilidad
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAdminAccounting}
                      disabled={savingRoles}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        allowAdminAccounting ? 'bg-indigo-600' : 'bg-slate-300'
                      } ${savingRoles ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-testid="toggle-admin-accounting"
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          allowAdminAccounting ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                      {savingRoles && (
                        <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" />
                      )}
                    </button>
                  </div>

                  {/* Pending Students Access Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                        <UserCheck className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">Permitir acceso a estudiantes pendientes de pago</h3>
                        <p className="text-sm text-slate-500">
                          Si se activa, los estudiantes podrán acceder al sistema aunque no hayan pagado matrícula o primera pensión
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleTogglePendingStudents}
                      disabled={savingRoles}
                      className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                        allowPendingStudents ? 'bg-emerald-600' : 'bg-slate-300'
                      } ${savingRoles ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-testid="toggle-pending-students"
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          allowPendingStudents ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                      {savingRoles && (
                        <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" />
                      )}
                    </button>
                  </div>

                  {/* Info text */}
                  <p className="text-xs text-slate-400 pl-2">
                    Los administradores tienen acceso a gestión de usuarios, cursos, horarios y asistencia por defecto. 
                    Solo el propietario puede acceder a Ajustes del sistema.
                  </p>
                </div>
              </section>

              {/* Broadcast Settings Section */}
              <section className="mt-8" data-testid="broadcast-settings-section">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-slate-800 mb-1">Comunicados Institucionales</h2>
                  <p className="text-sm text-slate-500 mb-6">Configura quién puede enviar comunicados masivos a toda la comunidad educativa</p>
                  
                  <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-amber-200">
                        <Megaphone className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">Permitir que los administradores envien comunicados institucionales</h3>
                        <p className="text-sm text-slate-500">
                          Si se desactiva, solo el propietario podra enviar comunicados masivos
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAdminBroadcast}
                      disabled={savingRoles}
                      className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                        allowAdminBroadcast ? 'bg-amber-500' : 'bg-slate-300'
                      } ${savingRoles ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-testid="toggle-admin-broadcast"
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          allowAdminBroadcast ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                      {savingRoles && (
                        <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" />
                      )}
                    </button>
                  </div>
                </div>
              </section>
              </>
            )}

            {/* Attendance Configuration Section */}
            <section className="mt-8" data-testid="attendance-config-section">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Configuracion de Asistencia</h2>
                  <p className="text-sm text-slate-500">Define horarios de ingreso y reglas de puntualidad</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                {/* Horarios */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Horarios de Ingreso</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Hora ingreso estudiantes</label>
                      <input
                        type="time"
                        value={attendanceConfig.student_entry_time}
                        onChange={(e) => setAttendanceConfig(p => ({ ...p, student_entry_time: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                        data-testid="student-entry-time"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Hora ingreso docentes</label>
                      <input
                        type="time"
                        value={attendanceConfig.teacher_entry_time}
                        onChange={(e) => setAttendanceConfig(p => ({ ...p, teacher_entry_time: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                        data-testid="teacher-entry-time"
                      />
                    </div>
                  </div>
                </div>

                {/* Reglas */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Reglas de Puntualidad</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Tolerancia (minutos)</label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={attendanceConfig.tolerance_minutes}
                        onChange={(e) => setAttendanceConfig(p => ({ ...p, tolerance_minutes: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                        data-testid="tolerance-minutes"
                      />
                      <p className="text-xs text-slate-400 mt-1">Minutos despues de la hora limite para considerar tardanza</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Marcar falta despues de (minutos)</label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={attendanceConfig.mark_absent_after_minutes}
                        onChange={(e) => setAttendanceConfig(p => ({ ...p, mark_absent_after_minutes: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                        data-testid="absent-after-minutes"
                      />
                      <p className="text-xs text-slate-400 mt-1">Pasado este tiempo se marca como falta automaticamente</p>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">Activar tardanza automatica</p>
                          <p className="text-xs text-slate-500">El sistema marcara automaticamente como tardanza o falta segun el horario configurado</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttendanceConfig(p => ({ ...p, auto_late_enabled: !p.auto_late_enabled }))}
                        className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                          attendanceConfig.auto_late_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        data-testid="toggle-auto-late"
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          attendanceConfig.auto_late_enabled ? 'translate-x-8' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <UserCheck className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">Permitir ingreso con tardanza</p>
                          <p className="text-xs text-slate-500">Permite que alumnos y docentes ingresen aunque sea tarde</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttendanceConfig(p => ({ ...p, allow_late_entry: !p.allow_late_entry }))}
                        className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          attendanceConfig.allow_late_entry ? 'bg-blue-500' : 'bg-slate-300'
                        }`}
                        data-testid="toggle-allow-late"
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          attendanceConfig.allow_late_entry ? 'translate-x-8' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={handleSaveAttendanceConfig}
                  disabled={savingAttendance}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  data-testid="save-attendance-config"
                >
                  {savingAttendance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Configuracion de Asistencia
                </button>
              </div>
            </section>


            {/* Carousel Manager - Only for owners/super admins */}
            {(user?.is_owner || user?.is_super_admin || user?.role === "owner" || user?.role === "director") && (
              <section className="mt-8" data-testid="carousel-section">
                <CarouselManager token={token} />
              </section>
            )}
          </form>
        </main>
      </div>
      <MobileBottomNav role={user?.role === "admin" ? "admin" : "owner"} />
    </div>
  );
}
