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
import { Switch } from "@/components/ui/switch";
import { canAccessSection } from "@/lib/permissions";
import { 
  Settings, Save, Upload, Image, Building2, Mail, Globe, 
  Phone, DollarSign, Loader2, Check, AlertCircle, ArrowLeft,
  GraduationCap, Palette, Camera, Images, HardDrive, Link2,
  Unlink, RefreshCw, CheckCircle2, XCircle, Clock, Users, Shield, UserCheck, Megaphone, ChevronDown, HeartPulse,
  UtensilsCrossed, Trash2, Plus, Pencil, ToggleLeft, ToggleRight, X, UserCog, ClipboardList, Cake, Music, Volume2
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
        { id: "himno", label: "Himno del Colegio", icon: Music },
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
    website_url: "",
    legal_name: "",
    libreta_mode: "acumulada"
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
  const [birthdayModuleEnabled, setBirthdayModuleEnabled] = useState(true);
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

  // School anthem state
  const [anthem, setAnthem] = useState({ url: null, enabled: false, autoplay: false, filename: null });
  const [uploadingAnthem, setUploadingAnthem] = useState(false);
  const [anthemUploadProgress, setAnthemUploadProgress] = useState(0);
  const anthemInputRef = useRef(null);
  
  // Attendance config state (levels-based)
  const [attendanceConfig, setAttendanceConfig] = useState({
    teachers: {
      entry_time: "07:15",
      exit_time: "13:00",
      horario_por_nivel_activo: false,
      horario_por_nivel: {},
      reglas_propias_activo: false,
      tolerance_minutes: null,
      mark_absent_after_minutes: null,
    },
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
        // Birthday module flag defaults to TRUE for new/legacy schools.
        setBirthdayModuleEnabled(res.data.birthday_module_enabled !== false);
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
            teachers: {
              entry_time: (res.data.attendance_config.teachers || {}).entry_time || prev.teachers.entry_time,
              exit_time: (res.data.attendance_config.teachers || {}).exit_time || prev.teachers.exit_time,
              horario_por_nivel_activo: !!(res.data.attendance_config.teachers || {}).horario_por_nivel_activo,
              horario_por_nivel: (res.data.attendance_config.teachers || {}).horario_por_nivel || {},
              reglas_propias_activo: !!(res.data.attendance_config.teachers || {}).reglas_propias_activo,
              tolerance_minutes: (res.data.attendance_config.teachers || {}).tolerance_minutes ?? null,
              mark_absent_after_minutes: (res.data.attendance_config.teachers || {}).mark_absent_after_minutes ?? null,
            },
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
          website_url: res.data.website_url || "",
          legal_name: res.data.legal_name || "",
          libreta_mode: "acumulada"
        });
        // legal_name + libreta_mode viven en `schools`
        try {
          const schoolRes = await axios.get(`${API}/dashboard/school`, { headers });
          setSettings(prev => ({
            ...prev,
            legal_name: schoolRes.data?.legal_name || prev.legal_name,
            libreta_mode: schoolRes.data?.libreta_mode || "acumulada",
          }));
        } catch (_) { /* opcional */ }
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

  // Fetch anthem settings
  useEffect(() => {
    const fetchAnthem = async () => {
      try {
        const res = await axios.get(`${API}/settings/anthem`, { headers });
        setAnthem({
          url: res.data.anthem_url,
          enabled: !!res.data.anthem_enabled,
          autoplay: !!res.data.anthem_autoplay,
          filename: res.data.anthem_filename,
        });
      } catch {}
    };
    if (token) fetchAnthem();
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
      const { legal_name, ...settingsForTenant } = settings;
      const res = await axios.put(`${API}/settings`, settingsForTenant, { headers });
      // legal_name vive en `schools` (solo owner)
      try {
        await axios.put(`${API}/school/legal-info`, { legal_name: legal_name || null }, { headers });
      } catch (e) {
        if (e.response?.status !== 403) throw e; // admin/director recibirán 403 silencioso
      }
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

  const handleToggleBirthdayModule = async () => {
    setSavingRoles(true);
    try {
      const newValue = !birthdayModuleEnabled;
      await axios.put(`${API}/settings/roles`, { birthday_module_enabled: newValue }, { headers });
      setBirthdayModuleEnabled(newValue);
      setSuccess(newValue ? "Módulo de Cumpleaños activado" : "Módulo de Cumpleaños desactivado");
      setTimeout(() => setSuccess(""), 3000);
      // Refresh cached /auth/me so the global guard picks up the change on next navigation.
      try {
        const me = await axios.get(`${API}/auth/me`, { headers });
        if (me?.data) {
          localStorage.setItem('user', JSON.stringify(me.data));
        }
      } catch (_) { /* non-fatal */ }
    } catch (err) {
      setError(err.response?.data?.detail || "Error al actualizar el módulo de cumpleaños");
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

          {/* Tab Content: Himno del Colegio */}

            {/* ══════════════════════════════════════════════════════════════════
                HIMNO DEL COLEGIO - Owner only
            ══════════════════════════════════════════════════════════════════ */}
            {activeSettingsTab === "himno" && (user?.is_owner || user?.is_super_admin || user?.role === "owner" || user?.role === "director") && (
              <section className="mt-8" data-testid="anthem-section">
                <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-2xl p-6 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
                      <Music className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Himno del Colegio</h3>
                      <p className="text-sm text-white/80">Sube un archivo MP3 y elige cómo se reproduce en el dashboard</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                  {anthem.url ? (
                    <div className="flex flex-wrap items-center gap-4 bg-violet-50/60 border border-violet-100 rounded-xl p-4">
                      <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                        <Volume2 className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {anthem.filename || "Himno cargado"}
                        </p>
                        <p className="text-xs text-slate-500">Listo para reproducirse</p>
                      </div>
                      <audio
                        controls
                        src={anthem.url}
                        className="w-full sm:w-72"
                        data-testid="anthem-preview"
                      />
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => anthemInputRef.current?.click()}
                          disabled={uploadingAnthem}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
                          data-testid="anthem-replace-btn"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Reemplazar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm("¿Eliminar el himno del colegio?")) return;
                            setUploadingAnthem(true);
                            try {
                              await axios.delete(`${API}/settings/anthem`, { headers });
                              setAnthem({ url: null, enabled: false, autoplay: false, filename: null });
                              setSuccess("Himno eliminado");
                              setTimeout(() => setSuccess(""), 3000);
                            } catch (err) {
                              setError(err.response?.data?.detail || "Error al eliminar");
                              setTimeout(() => setError(""), 3000);
                            } finally {
                              setUploadingAnthem(false);
                            }
                          }}
                          disabled={uploadingAnthem}
                          className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
                          data-testid="anthem-delete-btn"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => !uploadingAnthem && anthemInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all ${
                        uploadingAnthem
                          ? "border-violet-300 bg-violet-50/40 cursor-default"
                          : "border-violet-200 hover:border-violet-400 hover:bg-violet-50/40 cursor-pointer"
                      }`}
                      data-testid="anthem-dropzone"
                    >
                      {uploadingAnthem ? (
                        <>
                          <div className="flex items-center gap-3 mb-4">
                            <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
                            <span className="text-base font-semibold text-slate-700">
                              Subiendo audio...
                            </span>
                          </div>
                          <div className="w-full max-w-md">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-slate-500">Progreso</span>
                              <span
                                className="text-sm font-bold text-violet-700 tabular-nums"
                                data-testid="anthem-upload-progress-pct"
                              >
                                {anthemUploadProgress}%
                              </span>
                            </div>
                            <div className="w-full h-3 bg-violet-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-200 ease-out"
                                style={{ width: `${anthemUploadProgress}%` }}
                                data-testid="anthem-upload-progress-bar"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2 text-center">
                              {anthemUploadProgress < 100
                                ? "No cierres esta pestaña hasta que la carga termine"
                                : "Procesando archivo..."}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Music className="w-10 h-10 text-violet-400 mb-3" />
                          <p className="text-sm font-medium text-slate-600">
                            Haz clic para seleccionar el himno (MP3)
                          </p>
                          <p className="text-xs text-slate-400 mt-1">Solo se permite MP3 · máx. 15 MB</p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Switches */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-colors ${
                      anthem.enabled ? "border-violet-200 bg-violet-50/50" : "border-slate-200 bg-slate-50"
                    } ${!anthem.url ? "opacity-50" : ""}`}>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">Mostrar reproductor en el Dashboard</p>
                        <p className="text-xs text-slate-500 mt-0.5">Aparece un botón de play y ecualizador en la parte superior</p>
                      </div>
                      <Switch
                        checked={anthem.enabled}
                        disabled={!anthem.url || uploadingAnthem}
                        onCheckedChange={async (v) => {
                          try {
                            const res = await axios.put(`${API}/settings/anthem`, { enabled: v }, { headers });
                            setAnthem(prev => ({ ...prev, enabled: !!res.data.anthem_enabled }));
                          } catch (err) {
                            setError("No se pudo actualizar la configuración");
                            setTimeout(() => setError(""), 3000);
                          }
                        }}
                        className="data-[state=checked]:bg-violet-600"
                        data-testid="anthem-enabled-switch"
                      />
                    </div>

                    <div className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-colors ${
                      anthem.autoplay ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50"
                    } ${(!anthem.url || !anthem.enabled) ? "opacity-50" : ""}`}>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">Reproducción automática</p>
                        <p className="text-xs text-slate-500 mt-0.5">Suena solo al abrir el dashboard (algunos navegadores requieren un primer click)</p>
                      </div>
                      <Switch
                        checked={anthem.autoplay}
                        disabled={!anthem.url || !anthem.enabled || uploadingAnthem}
                        onCheckedChange={async (v) => {
                          try {
                            const res = await axios.put(`${API}/settings/anthem`, { autoplay: v }, { headers });
                            setAnthem(prev => ({ ...prev, autoplay: !!res.data.anthem_autoplay }));
                          } catch (err) {
                            setError("No se pudo actualizar la configuración");
                            setTimeout(() => setError(""), 3000);
                          }
                        }}
                        className="data-[state=checked]:bg-emerald-600"
                        data-testid="anthem-autoplay-switch"
                      />
                    </div>
                  </div>

                  <input
                    ref={anthemInputRef}
                    type="file"
                    accept="audio/mpeg,audio/mp3,.mp3,.mpeg,.mpg"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const fname = (file.name || "").toLowerCase();
                      const isMp3 = (
                        file.type === "audio/mpeg"
                        || file.type === "audio/mp3"
                        || fname.endsWith(".mp3")
                        || fname.endsWith(".mpeg")
                        || fname.endsWith(".mpg")
                      );
                      if (!isMp3) {
                        setError("Solo se permiten archivos MP3 (.mp3 o .mpeg)");
                        setTimeout(() => setError(""), 3000);
                        e.target.value = "";
                        return;
                      }
                      if (file.size > 15 * 1024 * 1024) {
                        setError("El archivo excede 15 MB");
                        setTimeout(() => setError(""), 3000);
                        e.target.value = "";
                        return;
                      }
                      setUploadingAnthem(true);
                      setAnthemUploadProgress(0);
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        await axios.put(`${API}/settings/anthem/upload`, formData, {
                          headers: { ...headers, "Content-Type": "multipart/form-data" },
                          onUploadProgress: (progressEvent) => {
                            if (progressEvent.total) {
                              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                              setAnthemUploadProgress(percent);
                            }
                          },
                        });
                        // Refetch full state
                        const fresh = await axios.get(`${API}/settings/anthem`, { headers });
                        setAnthem({
                          url: fresh.data.anthem_url,
                          enabled: !!fresh.data.anthem_enabled,
                          autoplay: !!fresh.data.anthem_autoplay,
                          filename: fresh.data.anthem_filename,
                        });
                        setSuccess("Himno cargado correctamente");
                        setTimeout(() => setSuccess(""), 3000);
                      } catch (err) {
                        setError(err.response?.data?.detail || "Error al subir el audio");
                        setTimeout(() => setError(""), 4000);
                      } finally {
                        setUploadingAnthem(false);
                        e.target.value = "";
                      }
                    }}
                    data-testid="anthem-file-input"
                  />
                </div>
              </section>
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

                <div className="mt-5">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Razón Social / Nombre Legal
                  </label>
                  <input
                    type="text"
                    value={settings.legal_name}
                    onChange={(e) => handleChange('legal_name', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Ej: INSTITUCIÓN EDUCATIVA PRIVADA COLEGIO EL ROBLE"
                    data-testid="settings-legal-name"
                  />
                  <p className="text-xs text-slate-400 mt-1">Aparecerá en la cabecera de las libretas y documentos oficiales. Solo el owner puede editarlo.</p>
                </div>

                <div className="mt-6 border-t pt-5">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Modo de Libreta
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 cursor-pointer">
                      <input
                        type="radio"
                        name="libreta_mode"
                        value="acumulada"
                        checked={(settings.libreta_mode || "acumulada") === "acumulada"}
                        onChange={(e) => handleChange('libreta_mode', e.target.value)}
                        className="mt-1"
                        data-testid="settings-libreta-mode-acumulada"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-800">Modo acumulado <span className="text-xs text-indigo-600 ml-2">recomendado</span></div>
                        <div className="text-xs text-slate-500">Cada libreta muestra todos los bimestres cerrados hasta la fecha (I → último cerrado).</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 cursor-pointer">
                      <input
                        type="radio"
                        name="libreta_mode"
                        value="bimestral"
                        checked={settings.libreta_mode === "bimestral"}
                        onChange={(e) => handleChange('libreta_mode', e.target.value)}
                        className="mt-1"
                        data-testid="settings-libreta-mode-bimestral"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-800">Modo bimestral</div>
                        <div className="text-xs text-slate-500">Cada libreta muestra solo el bimestre cerrado más reciente.</div>
                      </div>
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Esta configuración afecta cómo se muestran las libretas a los padres. Puedes cambiarla en cualquier momento.</p>
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

              {/* Birthday Module Section (Owner-only) */}
              <section className="mt-8" data-testid="birthday-module-section">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-slate-800 mb-1">Módulo de Cumpleaños</h2>
                  <p className="text-sm text-slate-500 mb-6">Activa o desactiva los popups, sliders y eventos de cumpleaños en todos los portales del colegio</p>

                  <div className="flex items-center justify-between p-4 bg-pink-50 border border-pink-200 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-pink-200">
                        <Cake className="w-5 h-5 text-pink-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">Módulo de Cumpleaños</h3>
                        <p className="text-sm text-slate-500">
                          Muestra popups y sliders de cumpleaños de alumnos y profesores en todos los portales del colegio.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleBirthdayModule}
                      disabled={savingRoles}
                      className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 ${
                        birthdayModuleEnabled ? 'bg-pink-500' : 'bg-slate-300'
                      } ${savingRoles ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-testid="toggle-birthday-module"
                      aria-label="Activar o desactivar el módulo de cumpleaños"
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          birthdayModuleEnabled ? 'translate-x-8' : 'translate-x-1'
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

                  {/* Switch: horarios por nivel */}
                  <div className="flex items-start justify-between gap-4 p-4 mb-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Horarios diferentes por nivel</p>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                        Aplica horarios de ingreso/salida específicos por nivel educativo. Si está desactivado, se usara el horario general para todos los docentes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttendanceConfig(p => ({
                        ...p,
                        teachers: { ...p.teachers, horario_por_nivel_activo: !p.teachers.horario_por_nivel_activo }
                      }))}
                      className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 mt-0.5 ${
                        attendanceConfig.teachers.horario_por_nivel_activo ? 'bg-indigo-500' : 'bg-slate-300'
                      }`}
                      data-testid="teacher-per-level-switch"
                      aria-pressed={attendanceConfig.teachers.horario_por_nivel_activo}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        attendanceConfig.teachers.horario_por_nivel_activo ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {/* Horario general (siempre visible, fallback) */}
                  {attendanceConfig.teachers.horario_por_nivel_activo && (
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Horario general</p>
                  )}
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity duration-200 ${
                      attendanceConfig.teachers.horario_por_nivel_activo ? "opacity-50 pointer-events-none" : ""
                    }`}
                    aria-disabled={attendanceConfig.teachers.horario_por_nivel_activo || undefined}
                    data-testid="teacher-global-block"
                  >
                    <TimePicker
                      label={attendanceConfig.teachers.horario_por_nivel_activo ? "Hora ingreso (general)" : "Hora ingreso"}
                      value={attendanceConfig.teachers.entry_time}
                      onChange={(v) => setAttendanceConfig(p => ({ ...p, teachers: { ...p.teachers, entry_time: v } }))}
                      data-testid="teacher-entry-time"
                    />
                    <TimePicker
                      label={attendanceConfig.teachers.horario_por_nivel_activo ? "Hora salida (general)" : "Hora salida"}
                      value={attendanceConfig.teachers.exit_time}
                      onChange={(v) => setAttendanceConfig(p => ({ ...p, teachers: { ...p.teachers, exit_time: v } }))}
                      data-testid="teacher-exit-time"
                    />
                  </div>
                  {attendanceConfig.teachers.horario_por_nivel_activo && (
                    <p className="text-xs text-slate-400 mt-2 italic">Desactivado — se aplica solo como valor predeterminado para niveles sin horario definido.</p>
                  )}

                  {/* Bloques por nivel (fade-in cuando switch ON) */}
                  {attendanceConfig.teachers.horario_por_nivel_activo && (
                    <div className="mt-5 space-y-3 animate-in fade-in duration-300" data-testid="teacher-per-level-blocks">
                      {academicLevels.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">No hay niveles academicos configurados para este colegio.</p>
                      ) : (
                        academicLevels.map(level => {
                          const override = attendanceConfig.teachers.horario_por_nivel?.[level.id] || {};
                          const updateOverride = (field, value) => {
                            setAttendanceConfig(p => {
                              const next = { ...(p.teachers.horario_por_nivel || {}) };
                              const cur = { ...(next[level.id] || {}) };
                              cur[field] = value && value.length > 0 ? value : null;
                              next[level.id] = cur;
                              return { ...p, teachers: { ...p.teachers, horario_por_nivel: next } };
                            });
                          };
                          return (
                            <div key={level.id} className="border border-slate-200 rounded-xl p-4 bg-white" data-testid={`teacher-level-block-${level.id}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <Users className="w-4 h-4 text-indigo-500" />
                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Nivel {level.nombre || level.name}</h4>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <TimePicker
                                  label="Hora ingreso"
                                  value={override.entry_time || ""}
                                  onChange={(v) => updateOverride("entry_time", v)}
                                  placeholder="Hereda del general"
                                  data-testid={`teacher-level-entry-${level.id}`}
                                />
                                <TimePicker
                                  label="Hora salida"
                                  value={override.exit_time || ""}
                                  onChange={(v) => updateOverride("exit_time", v)}
                                  placeholder="Hereda del general"
                                  data-testid={`teacher-level-exit-${level.id}`}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Reglas específicas para docentes */}
                  <div className="mt-5 flex items-start justify-between gap-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Reglas distintas para docentes</p>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                        Define tolerancia y tiempo para marcar falta distintos para docentes. Si está desactivado, se aplican las reglas generales (mas abajo).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttendanceConfig(p => ({
                        ...p,
                        teachers: { ...p.teachers, reglas_propias_activo: !p.teachers.reglas_propias_activo }
                      }))}
                      className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 mt-0.5 ${
                        attendanceConfig.teachers.reglas_propias_activo ? 'bg-indigo-500' : 'bg-slate-300'
                      }`}
                      data-testid="teacher-rules-switch"
                      aria-pressed={attendanceConfig.teachers.reglas_propias_activo}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        attendanceConfig.teachers.reglas_propias_activo ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {attendanceConfig.teachers.reglas_propias_activo && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300" data-testid="teacher-rules-block">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Tolerancia docentes (minutos)</label>
                        <input
                          type="number"
                          min="0"
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={attendanceConfig.teachers.tolerance_minutes ?? ""}
                          placeholder="Hereda de las reglas generales"
                          onChange={(e) => setAttendanceConfig(p => ({
                            ...p,
                            teachers: {
                              ...p.teachers,
                              tolerance_minutes: e.target.value === "" ? null : parseInt(e.target.value, 10)
                            }
                          }))}
                          data-testid="teacher-tolerance-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Marcar falta docentes después de (minutos)</label>
                        <input
                          type="number"
                          min="0"
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={attendanceConfig.teachers.mark_absent_after_minutes ?? ""}
                          placeholder="Hereda de las reglas generales"
                          onChange={(e) => setAttendanceConfig(p => ({
                            ...p,
                            teachers: {
                              ...p.teachers,
                              mark_absent_after_minutes: e.target.value === "" ? null : parseInt(e.target.value, 10)
                            }
                          }))}
                          data-testid="teacher-absent-input"
                        />
                      </div>
                    </div>
                  )}
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
                      <p className="text-xs text-slate-400 mt-1">Minutos después de la hora límite para considerar tardanza</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Marcar falta después de (minutos)</label>
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
                        <p className="text-xs text-slate-500">El sistema marcara automaticamente tardanza o falta según el horario por nivel</p>
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
                          Estas seguro de eliminar el turno "<strong>{paeDeleteConfirm.nombre}</strong>"? Esta acción no se puede deshacer.
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
