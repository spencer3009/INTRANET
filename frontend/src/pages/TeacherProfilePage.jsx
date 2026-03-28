import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import MessageCenter from "../components/MessageCenter";
import StudentHeader from "../components/StudentHeader";
import PhotoUploadModal from "@/components/PhotoUploadModal";
import {
  User,
  Mail,
  Phone,
  Camera,
  Loader2,
  Save,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Users,
  Calendar
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function TeacherProfilePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    last_name: "",
    phone: ""
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [settings, setSettings] = useState(null);
  
  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, [token]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const currentSubdomain = subdomain || user?.subdomain || 'elroble';
      const [profileRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/teacher/profile`, { headers }),
        axios.get(`${API}/api/settings/public/${currentSubdomain}`).catch(() => ({ data: null }))
      ]);
      setProfile(profileRes.data);
      setFormData({
        name: profileRes.data.user?.name || "",
        last_name: profileRes.data.user?.last_name || "",
        phone: profileRes.data.user?.phone || ""
      });
      setSettings(settingsRes.data);
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Mi Colegio";

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      await axios.put(`${API}/api/auth/profile`, formData, { headers });
      setSaveMessage({ type: "success", text: "Perfil actualizado correctamente" });
      setEditMode(false);
      loadProfile();
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setSaveMessage({ type: "error", text: "Error al guardar el perfil" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      setSaveMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }
    
    if (passwordData.new_password.length < 6) {
      setSaveMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    
    setChangingPassword(true);
    setSaveMessage(null);
    
    try {
      await axios.put(`${API}/api/auth/password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      }, { headers });
      
      setSaveMessage({ type: "success", text: "Contraseña actualizada correctamente" });
      setShowPasswordForm(false);
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: ""
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Error changing password:", err);
      setSaveMessage({ type: "error", text: err.response?.data?.detail || "Error al cambiar la contraseña" });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="teacher-profile-page">
      {/* Teacher Sidebar */}
      <TeacherSidebar
        active="profile"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={user?.school_name}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Mobile overlay */}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
          roleLabel="Docente"
          profilePath="/teacher/profile"
        />
          
        {/* Save message */}
        {saveMessage && (
          <div className={`mx-4 mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
            saveMessage.type === "success" 
              ? "bg-emerald-50 text-emerald-700" 
              : "bg-red-50 text-red-700"
          }`}>
            {saveMessage.type === "success" ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {saveMessage.text}
          </div>
        )}

        {/* Content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Header with gradient */}
              <div className="h-24 bg-gradient-to-r from-emerald-500 to-teal-600 relative">
                <div className="absolute -bottom-12 left-6">
                  <div className="relative">
                    {profile?.user?.photo_url ? (
                      <img 
                        src={profile.user.photo_url} 
                        alt="" 
                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
                        <User className="w-10 h-10 text-slate-400" />
                      </div>
                    )}
                    <button 
                      onClick={() => setShowPhotoModal(true)}
                      data-testid="teacher-profile-change-photo-btn"
                      className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-md hover:bg-emerald-600 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Profile Info */}
              <div className="pt-16 px-6 pb-6">
                {editMode ? (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          data-testid="profile-name-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
                        <input
                          type="text"
                          value={formData.last_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          data-testid="profile-lastname-input"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="+51 999 999 999"
                        data-testid="profile-phone-input"
                      />
                    </div>
                    
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        data-testid="save-profile-btn"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Guardar
                      </button>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setFormData({
                            name: profile?.user?.name || "",
                            last_name: profile?.user?.last_name || "",
                            phone: profile?.user?.phone || ""
                          });
                        }}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-bold text-slate-800">
                          {profile?.user?.name} {profile?.user?.last_name}
                        </h2>
                        <p className="text-emerald-600 font-medium">Profesor</p>
                      </div>
                      <button
                        onClick={() => setEditMode(true)}
                        className="px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-xl font-medium transition-colors"
                        data-testid="edit-profile-btn"
                      >
                        Editar
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {profile?.user?.email && (
                        <div className="flex items-center gap-3 text-slate-600">
                          <Mail className="w-5 h-5 text-slate-400" />
                          <span>{profile.user.email}</span>
                        </div>
                      )}
                      {profile?.user?.phone && (
                        <div className="flex items-center gap-3 text-slate-600">
                          <Phone className="w-5 h-5 text-slate-400" />
                          <span>{profile.user.phone}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">
                      {profile?.assigned_courses?.length || 0}
                    </p>
                    <p className="text-sm text-slate-500">Cursos</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">
                      {profile?.assigned_sections?.length || 0}
                    </p>
                    <p className="text-sm text-slate-500">Secciones</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">
                      {profile?.assignments_count || 0}
                    </p>
                    <p className="text-sm text-slate-500">Asignaciones</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Contraseña</h3>
                    <p className="text-sm text-slate-500">Actualiza tu contraseña de acceso</p>
                  </div>
                </div>
                
                {!showPasswordForm && (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-xl font-medium transition-colors"
                    data-testid="change-password-btn"
                  >
                    Cambiar
                  </button>
                )}
              </div>
              
              {showPasswordForm && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Contraseña actual
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? "text" : "password"}
                        value={passwordData.current_password}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                        className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        data-testid="current-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? "text" : "password"}
                        value={passwordData.new_password}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                        className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="Mínimo 6 caracteres"
                        data-testid="new-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Confirmar contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                        className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        data-testid="confirm-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword || !passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                      data-testid="save-password-btn"
                    >
                      {changingPassword ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      Actualizar contraseña
                    </button>
                    <button
                      onClick={() => {
                        setShowPasswordForm(false);
                        setPasswordData({
                          current_password: "",
                          new_password: "",
                          confirm_password: ""
                        });
                      }}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
      <MobileBottomNav role="teacher" />

      <PhotoUploadModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        user={user}
        token={token}
        onPhotoUpdated={(userId, photoUrl) => {
          setProfile(prev => ({ ...prev, user: { ...prev.user, photo_url: photoUrl } }));
        }}
      />
    </div>
  );
}
