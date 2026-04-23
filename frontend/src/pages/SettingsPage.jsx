import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import MobileBottomNav from "@/components/MobileBottomNav";
import CarouselManager from "@/components/CarouselManager";
import AccessDenied from "@/components/AccessDenied";
import AdditionalRolesManager from "@/components/AdditionalRolesManager";
import { canAccessSection } from "@/lib/permissions";
import { 
  Settings, Save, Upload, Image, Building2, Mail, Globe, 
  Phone, DollarSign, Loader2, Check, AlertCircle, ArrowLeft,
  GraduationCap, Palette, Camera, Images, HardDrive, Link2,
  Unlink, RefreshCw, CheckCircle2, XCircle, Clock, Users, Shield, UserCheck, Megaphone, ChevronDown, HeartPulse,
  UtensilsCrossed, Trash2, Plus, Pencil, ToggleLeft, ToggleRight, X, UserCog, ClipboardList
} from "lucide-react";
import { TimePicker } from "@/components/ui/time-picker";
import RegistroAuxiliarPlantillasTab from "@/components/RegistroAuxiliarPlantillasTab";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SettingsPage({ user, token, subdomain, onLogout, onSettingsUpdate }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Tab system: admin only sees "registro_auxiliar"
  const userRole = user?.role;
  const availableTabs = userRole === "admin"
    ? [{ id: "registro_auxiliar", label: "Registro Auxiliar", icon: ClipboardList }]
    : [
        { id: "general", label: "General", icon: Settings },
        { id: "registro_auxiliar", label: "Registro Auxiliar", icon: ClipboardList },
      ];
  const [activeSettingsTab, setActiveSettingsTab] = useState(availableTabs[0].id);
  
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
  
  // Health & Wellness permissions state
  const [healthAdminCanManage, setHealthAdminCanManage] = useState(true);
  const [healthTeacherCanManage, setHealthTeacherCanManage] = useState(false);
  const [savingHealthPerms, setSavingHealthPerms] = useState(false);
  const [adminSubVisible, setAdminSubVisible] = useState(true);
  const [savingSubVisibility, setSavingSubVisibility] = useState(false);
  
  // Login background state
  const [loginBgUrl, setLoginBgUrl] = useState(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const loginBgInputRef = useRef(null);
  
  // Attendance config state (levels-based)
  const [attendanceConfig, setAttendanceConfig] = useState({
    teachers: { entry_time: "07:15", exit_time: "13:00" },
    levels: [],
    tolerance_minutes: 5,
    mark_absent_after_minutes: 30,
    auto_late_enabled: false,
  });
  const [academicLevels, setAcademicLevels] = useState([]);
  const [openLevel, setOpenLevel] = useState(null);
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

  // PAE Turnos states
  const [paeTurnos, setPaeTurnos] = useState([]);
  const [paeLoading, setPaeLoading] = useState(false);
  const [paeModal, setPaeModal] = useState(null); // null | "new" | turno object
  const [paeForm, setPaeForm] = useState({ nombre: "", hora_inicio: "", hora_fin: "" });
  const [paeSaving, setPaeSaving] = useState(false);
  const [paeError, setPaeError] = useState("");
  const [paeDeleteConfirm, setPaeDeleteConfirm] = useState(null);
  
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
        // Load health permissions
        try {
          const hpRes = await axios.get(`${API}/settings/health-permissions`, { headers });
          setHealthAdminCanManage(hpRes.data.admin_can_manage ?? true);
          setHealthTeacherCanManage(hpRes.data.teacher_can_manage ?? false);
        } catch (_) {}
        // Load subscription visibility
        setAdminSubVisible(res.data.admin_subscription_visible !== false);
        if (res.data.attendance_config) {
          setAttendanceConfig(prev => ({
            ...prev,
            teachers: res.data.attendance_config.teachers || prev.teachers,
            levels: res.data.attendance_config.levels || [],
            tolerance_minutes: res.data.attendance_config.tolerance_minutes ?? prev.tolerance_minutes,
            mark_absent_after_minutes: res.data.attendance_config.mark_absent_after_minutes ?? prev.mark_absent_after_minutes,
            auto_late_enabled: res.data.attendance_config.auto_late_enabled ?? prev.auto_late_enabled,
          }));
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
  
  // Fetch academic levels for attendance config
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const res = await axios.get(`${API}/academic/levels`, { headers });
        setAcademicLevels(res.data || []);
      } catch {}
    };
    if (token) fetchLevels();
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

  // Fetch login background
  useEffect(() => {
    const fetchLoginBg = async () => {
      try {
        const res = await axios.get(`${API}/settings/login-background`, { headers });
        setLoginBgUrl(res.data.login_background_url);
      } catch {}
    };
    if (token) fetchLoginBg();
  }, [token]);

  // PAE Turnos
  const loadPaeTurnos = async () => {
    setPaeLoading(true);
    try {
      const res = await axios.get(`${API}/pae/turnos`, { headers });
      setPaeTurnos(res.data);
    } catch {}
    setPaeLoading(false);
  };
  useEffect(() => { if (token) loadPaeTurnos(); }, [token]);

  const handlePaeSave = async () => {
    setPaeSaving(true);
    setPaeError("");
    try {
      if (paeModal === "new") {
        await axios.post(`${API}/pae/turnos`, {
          nombre: paeForm.nombre,
          hora_inicio: paeForm.hora_inicio,
          hora_fin: paeForm.hora_fin,
          orden: paeTurnos.length + 1,
        }, { headers });
      } else {
        await axios.put(`${API}/pae/turnos/${paeModal.id}`, {
          nombre: paeForm.nombre,
          hora_inicio: paeForm.hora_inicio,
          hora_fin: paeForm.hora_fin,
        }, { headers });
      }
      setPaeModal(null);
      loadPaeTurnos();
    } catch (err) {
      setPaeError(err.response?.data?.detail || "Error al guardar turno");
    }
    setPaeSaving(false);
  };

  const handlePaeToggle = async (id) => {
    try {
      await axios.patch(`${API}/pae/turnos/${id}/toggle`, {}, { headers });
      loadPaeTurnos();
    } catch {}
  };

  const handlePaeDelete = async (id) => {
    try {
      await axios.delete(`${API}/pae/turnos/${id}`, { headers });
      setPaeDeleteConfirm(null);
      loadPaeTurnos();
    } catch (err) {
      setPaeError(err.response?.data?.detail || "Error al eliminar");
      setTimeout(() => setPaeError(""), 4000);
      setPaeDeleteConfirm(null);
    }
  };
  
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
      setSuccess("Configuración de asistencia guardada");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar configuración de asistencia");
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

  const handleToggleHealthPermission = async (field, currentValue, setter) => {
    setSavingHealthPerms(true);
    try {
      const newValue = !currentValue;
      await axios.put(`${API}/settings/health-permissions`, { [field]: newValue }, { headers });
      setter(newValue);
      const label = field === "admin_can_manage" ? "Administradores" : "Profesores";
      setSuccess(newValue ? `${label} ahora pueden gestionar Salud y Bienestar` : `Acceso de ${label} a Salud y Bienestar deshabilitado`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al actualizar permisos de salud");
    } finally {
      setSavingHealthPerms(false);
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

          {/* Tab Navigation */}
          {availableTabs.length > 1 && (
            <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1" data-testid="settings-tabs">
              {availableTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSettingsTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      activeSettingsTab === tab.id
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    data-testid={`settings-tab-${tab.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab Content: Registro Auxiliar */}
          {activeSettingsTab === "registro_auxiliar" && (
            <RegistroAuxiliarPlantillasTab user={user} token={token} schoolId={user?.school_id} subdomain={subdomain} />
          )}

          {/* Tab Content: General Settings */}
          {activeSettingsTab === "general" && (<>
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

              {/* Additional Roles Assignment Section */}
              <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mt-8" data-testid="additional-roles-section">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <UserCog className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Asignación de Roles Auxiliares al Personal</h2>
                    <p className="text-sm text-slate-500">Otorga roles adicionales (Alimentacion, Movilidad, Asistencia) a profesores y personal sin perder su rol principal</p>
                  </div>
                </div>
                <AdditionalRolesManager token={token} />
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

              {/* Health & Wellness Permissions Section */}
              <section className="mt-8" data-testid="health-permissions-section">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl flex items-center justify-center">
                      <HeartPulse className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Permisos de Salud y Bienestar</h2>
                      <p className="text-sm text-slate-500">Controla quién puede crear, editar y eliminar registros de Tópico y Psicología. Todos pueden ver los registros.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Admin Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                          <Shield className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">Permitir a Administradores gestionar Salud y Bienestar</h3>
                          <p className="text-sm text-slate-500">
                            Los administradores podrán crear, editar y eliminar registros. Sin este permiso, solo podrán ver los registros.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleHealthPermission("admin_can_manage", healthAdminCanManage, setHealthAdminCanManage)}
                        disabled={savingHealthPerms}
                        className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                          healthAdminCanManage ? 'bg-red-500' : 'bg-slate-300'
                        } ${savingHealthPerms ? 'opacity-50 cursor-not-allowed' : ''}`}
                        data-testid="toggle-health-admin"
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                            healthAdminCanManage ? 'translate-x-8' : 'translate-x-1'
                          }`}
                        />
                        {savingHealthPerms && (
                          <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" />
                        )}
                      </button>
                    </div>

                    {/* Teacher Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                          <Users className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">Permitir a Profesores gestionar Salud y Bienestar</h3>
                          <p className="text-sm text-slate-500">
                            Los profesores podrán crear, editar y eliminar registros. Sin este permiso, solo podrán ver los registros.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleHealthPermission("teacher_can_manage", healthTeacherCanManage, setHealthTeacherCanManage)}
                        disabled={savingHealthPerms}
                        className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                          healthTeacherCanManage ? 'bg-emerald-500' : 'bg-slate-300'
                        } ${savingHealthPerms ? 'opacity-50 cursor-not-allowed' : ''}`}
                        data-testid="toggle-health-teacher"
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                            healthTeacherCanManage ? 'translate-x-8' : 'translate-x-1'
                          }`}
                        />
                        {savingHealthPerms && (
                          <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" />
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 pl-2">
                      El propietario siempre tiene acceso completo. Administradores y profesores siempre pueden ver los registros. Los switches controlan si pueden crear, editar y eliminar. Los padres tienen acceso de solo lectura al historial de sus hijos.
                    </p>
                  </div>
                </div>
              </section>

              {/* Subscription Visibility */}
              {user?.role === 'owner' && (
              <section className="mt-8" data-testid="subscription-visibility-section">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Visibilidad de Suscripci&oacute;n</h2>
                      <p className="text-sm text-slate-500">Controla la informaci&oacute;n que el administrador puede ver sobre la suscripci&oacute;n.</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                        <Shield className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">Mostrar detalles de suscripci&oacute;n al Administrador</h3>
                        <p className="text-sm text-slate-500">
                          {adminSubVisible
                            ? "El administrador ve: monto, días restantes, fechas y botón de Yape."
                            : "El administrador solo ve: Suscripción Activo. Sin montos ni fechas."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setSavingSubVisibility(true);
                        const next = !adminSubVisible;
                        try {
                          await axios.put(`${API}/settings`, {
                            admin_subscription_visible: next,
                          }, { headers });
                          setAdminSubVisible(next);
                          toast.success(next ? "Detalles visibles para el administrador" : "Detalles ocultos para el administrador");
                        } catch { toast.error("Error al guardar"); }
                        finally { setSavingSubVisibility(false); }
                      }}
                      disabled={savingSubVisibility}
                      className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                        adminSubVisible ? 'bg-purple-500' : 'bg-slate-300'
                      } ${savingSubVisibility ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-testid="toggle-admin-sub-visibility"
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
                        adminSubVisible ? 'translate-x-8' : 'translate-x-1'
                      }`} />
                      {savingSubVisibility && (
                        <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" />
                      )}
                    </button>
                  </div>
                </div>
              </section>
              )}
              </>
            )}

            {/* Attendance Configuration Section */}
            <section className="mt-8" data-testid="attendance-config-section">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Configuración de Asistencia</h2>
                  <p className="text-sm text-slate-500">Define horarios de ingreso por nivel y reglas de puntualidad</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                {/* DOCENTES */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" /> Horario Docentes
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TimePicker
                      label="Hora ingreso"
                      value={attendanceConfig.teachers.entry_time}
                      onChange={(v) => setAttendanceConfig(p => ({ ...p, teachers: { ...p.teachers, entry_time: v } }))}
                      data-testid="teacher-entry-time"
                    />
                    <TimePicker
                      label="Hora salida"
                      value={attendanceConfig.teachers.exit_time}
                      onChange={(v) => setAttendanceConfig(p => ({ ...p, teachers: { ...p.teachers, exit_time: v } }))}
                      data-testid="teacher-exit-time"
                    />
                  </div>
                </div>

                {/* ESTUDIANTES POR NIVEL */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-500" /> Horario Estudiantes por Nivel
                  </h3>
                  {academicLevels.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No hay niveles académicos configurados</p>
                  ) : (
                    <div className="space-y-2">
                      {academicLevels.map(level => {
                        const levelConfig = attendanceConfig.levels.find(l => l.level_id === level.id) || { entry_time: "07:30", exit_time: "13:00" };
                        const isOpen = openLevel === level.id;
                        const updateLevel = (field, value) => {
                          setAttendanceConfig(p => {
                            const existing = p.levels.filter(l => l.level_id !== level.id);
                            const current = p.levels.find(l => l.level_id === level.id) || { level_id: level.id, entry_time: "07:30", exit_time: "13:00" };
                            return { ...p, levels: [...existing, { ...current, [field]: value }] };
                          });
                        };
                        return (
                          <div key={level.id} className="border border-slate-200 rounded-xl overflow-hidden">
                            <div
                              onClick={() => setOpenLevel(isOpen ? null : level.id)}
                              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                              data-testid={`level-accordion-${level.id}`}
                            >
                              <span className="text-sm font-bold text-slate-700">{level.nombre || level.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-400">{levelConfig.entry_time} - {levelConfig.exit_time}</span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                              </div>
                            </div>
                            {isOpen && (
                              <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50">
                                <div className="grid grid-cols-2 gap-3">
                                  <TimePicker
                                    label="Hora ingreso"
                                    value={levelConfig.entry_time}
                                    onChange={(v) => updateLevel("entry_time", v)}
                                  />
                                  <TimePicker
                                    label="Hora salida"
                                    value={levelConfig.exit_time}
                                    onChange={(v) => updateLevel("exit_time", v)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* REGLAS GENERALES */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-500" /> Reglas Generales
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Tolerancia (minutos)</label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={attendanceConfig.tolerance_minutes}
                        onChange={(e) => setAttendanceConfig(p => ({ ...p, tolerance_minutes: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all"
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
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all"
                        data-testid="absent-after-minutes"
                      />
                      <p className="text-xs text-slate-400 mt-1">Pasado este tiempo se marca como falta</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Activar tardanza automatica</p>
                        <p className="text-xs text-slate-500">El sistema marcara automaticamente tardanza o falta segun el horario por nivel</p>
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
                  Guardar Configuración de Asistencia
                </button>
              </div>
            </section>


            {/* Carousel Manager - Only for owners/super admins */}
            {(user?.is_owner || user?.is_super_admin || user?.role === "owner" || user?.role === "director") && (
              <section className="mt-8" data-testid="carousel-section">
                <CarouselManager token={token} />
              </section>
            )}

            {/* Login Background Image - Only for owners */}
            {(user?.is_owner || user?.is_super_admin || user?.role === "owner" || user?.role === "director") && (
              <section className="mt-8" data-testid="login-background-section">
                <div className="bg-slate-800 text-white rounded-2xl p-6 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                      <Image className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Fondo de Página de Login</h3>
                      <p className="text-sm text-white/70">Personaliza la imagen de fondo de la página de inicio de sesión de tu colegio</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  {loginBgUrl ? (
                    <div className="space-y-4">
                      <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-[16/6]">
                        <img
                          src={loginBgUrl}
                          alt="Fondo de login"
                          className="w-full h-full object-cover"
                          data-testid="login-bg-preview"
                        />
                        {uploadingBg && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => loginBgInputRef.current?.click()}
                          disabled={uploadingBg}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                          data-testid="login-bg-replace-btn"
                        >
                          <Upload className="w-4 h-4" />
                          Reemplazar imagen
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm("¿Eliminar la imagen de fondo del login?")) return;
                            setUploadingBg(true);
                            try {
                              await axios.delete(`${API}/settings/login-background`, { headers });
                              setLoginBgUrl(null);
                              setSuccess("Imagen de fondo eliminada");
                              setTimeout(() => setSuccess(""), 3000);
                            } catch (err) {
                              setError(err.response?.data?.detail || "Error al eliminar");
                              setTimeout(() => setError(""), 3000);
                            } finally {
                              setUploadingBg(false);
                            }
                          }}
                          disabled={uploadingBg}
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                          data-testid="login-bg-delete-btn"
                        >
                          <XCircle className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => !uploadingBg && loginBgInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files[0];
                        if (!file) return;
                        if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
                          setError("Formato no soportado. Usa JPG, PNG o WebP.");
                          setTimeout(() => setError(""), 3000);
                          return;
                        }
                        setUploadingBg(true);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const res = await axios.put(`${API}/settings/login-background`, formData, {
                            headers: { ...headers, "Content-Type": "multipart/form-data" },
                          });
                          setLoginBgUrl(res.data.login_background_url);
                          setSuccess("Imagen de fondo actualizada");
                          setTimeout(() => setSuccess(""), 3000);
                        } catch (err) {
                          setError(err.response?.data?.detail || "Error al subir imagen");
                          setTimeout(() => setError(""), 3000);
                        } finally {
                          setUploadingBg(false);
                        }
                      }}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all"
                      data-testid="login-bg-dropzone"
                    >
                      {uploadingBg ? (
                        <Loader2 className="w-10 h-10 text-slate-400 animate-spin mb-3" />
                      ) : (
                        <Upload className="w-10 h-10 text-slate-400 mb-3" />
                      )}
                      <p className="text-sm font-medium text-slate-600">
                        {uploadingBg ? "Subiendo imagen..." : "Arrastra una imagen o haz clic para seleccionar"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">JPG, PNG o WebP</p>
                    </div>
                  )}

                  <input
                    ref={loginBgInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setUploadingBg(true);
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await axios.put(`${API}/settings/login-background`, formData, {
                          headers: { ...headers, "Content-Type": "multipart/form-data" },
                        });
                        setLoginBgUrl(res.data.login_background_url);
                        setSuccess("Imagen de fondo actualizada");
                        setTimeout(() => setSuccess(""), 3000);
                      } catch (err) {
                        setError(err.response?.data?.detail || "Error al subir imagen");
                        setTimeout(() => setError(""), 3000);
                      } finally {
                        setUploadingBg(false);
                        e.target.value = "";
                      }
                    }}
                    data-testid="login-bg-file-input"
                  />
                </div>
              </section>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                PAE - TURNOS DE ALIMENTACIÓN
            ══════════════════════════════════════════════════════════════════ */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden" data-testid="pae-turnos-section">
              <div className="bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5" />
                  Programa de Alimentacion Escolar - Turnos
                </h2>
                <p className="text-emerald-100 text-sm mt-1">Configure los turnos de alimentacion del colegio</p>
              </div>

              <div className="p-6">
                {paeError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    {paeError}
                  </div>
                )}

                {/* Add button */}
                <div className="flex justify-end mb-4">
                  <button
                    type="button"
                    onClick={() => { setPaeModal("new"); setPaeForm({ nombre: "", hora_inicio: "", hora_fin: "" }); setPaeError(""); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium"
                    data-testid="pae-add-turno"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Turno
                  </button>
                </div>

                {/* Turnos list */}
                {paeLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
                ) : paeTurnos.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay turnos configurados</p>
                    <p className="text-xs mt-1">Cree el primer turno con el boton "Nuevo Turno"</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paeTurnos.map((t) => (
                      <div key={t.id} className={`flex items-center justify-between p-4 rounded-xl border ${t.activo ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50 opacity-60'}`} data-testid={`pae-turno-row-${t.id}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.activo ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                            <UtensilsCrossed className={`w-5 h-5 ${t.activo ? 'text-emerald-600' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{t.nombre}</p>
                            <p className="text-xs text-slate-500">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {t.hora_inicio} - {t.hora_fin}
                            </p>
                          </div>
                          {!t.activo && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-500 text-xs rounded-lg font-medium">Inactivo</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePaeToggle(t.id)}
                            className={`p-2 rounded-lg transition-colors ${t.activo ? 'text-emerald-600 hover:bg-emerald-100' : 'text-slate-400 hover:bg-slate-200'}`}
                            title={t.activo ? "Desactivar" : "Activar"}
                            data-testid={`pae-toggle-${t.id}`}
                          >
                            {t.activo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPaeModal(t); setPaeForm({ nombre: t.nombre, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin }); setPaeError(""); }}
                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar"
                            data-testid={`pae-edit-${t.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaeDeleteConfirm(t)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar"
                            data-testid={`pae-delete-${t.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PAE Modal */}
                {paeModal && (
                  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setPaeModal(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()} data-testid="pae-turno-modal">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-slate-800">
                          {paeModal === "new" ? "Nuevo Turno" : "Editar Turno"}
                        </h3>
                        <button type="button" onClick={() => setPaeModal(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {paeError && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">
                          {paeError}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del turno</label>
                          <input
                            type="text"
                            value={paeForm.nombre}
                            onChange={e => setPaeForm(f => ({ ...f, nombre: e.target.value }))}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            placeholder="Ej: Desayuno, Almuerzo, Media manana..."
                            data-testid="pae-form-nombre"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Hora inicio</label>
                            <input
                              type="time"
                              value={paeForm.hora_inicio}
                              onChange={e => setPaeForm(f => ({ ...f, hora_inicio: e.target.value }))}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                              data-testid="pae-form-hora-inicio"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Hora fin</label>
                            <input
                              type="time"
                              value={paeForm.hora_fin}
                              onChange={e => setPaeForm(f => ({ ...f, hora_fin: e.target.value }))}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                              data-testid="pae-form-hora-fin"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setPaeModal(null)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handlePaeSave}
                          disabled={paeSaving || !paeForm.nombre || !paeForm.hora_inicio || !paeForm.hora_fin}
                          className="px-6 py-2.5 text-sm font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                          data-testid="pae-form-save"
                        >
                          {paeSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                          {paeModal === "new" ? "Crear Turno" : "Guardar Cambios"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delete confirmation */}
                {paeDeleteConfirm && (
                  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setPaeDeleteConfirm(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()} data-testid="pae-delete-confirm">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Trash2 className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Eliminar turno</h3>
                        <p className="text-sm text-slate-500 mb-5">
                          Estas seguro de eliminar el turno "<strong>{paeDeleteConfirm.nombre}</strong>"? Esta accion no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setPaeDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                            Cancelar
                          </button>
                          <button type="button" onClick={() => handlePaeDelete(paeDeleteConfirm.id)} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors" data-testid="pae-confirm-delete">
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </form>
          </>)}
        </main>
      </div>
      <MobileBottomNav role={user?.role === "admin" ? "admin" : "owner"} />
    </div>
  );
}
