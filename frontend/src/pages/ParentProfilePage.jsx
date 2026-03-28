import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import MobileBottomNav from "../components/MobileBottomNav";
import PhotoUploadModal from "@/components/PhotoUploadModal";
import {
  User,
  Loader2,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Save,
  CheckCircle,
  AlertCircle,
  Users
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentProfilePage({ user, token, onLogout, onUserUpdate }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState(user?.photo_url);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadProfile();
  }, [token]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [profileRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/parent/me`, { headers }),
        axios.get(`${API}/api/settings/public/${subdomain || user?.subdomain}`, { headers }).catch(() => ({ data: null }))
      ]);
      setProfile(profileRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);
    } catch (err) {
      console.error("Error loading parent profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padre";
  const logoUrl = settings?.logo_url;

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/api/auth/password`, {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      }, { headers });
      setMessage({ type: "success", text: "Contraseña actualizada correctamente" });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswordForm(false);
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Error al cambiar contraseña" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ParentSidebar
        active="perfil"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={user}
        selectedChild={null}
        onSelectChild={() => {}}
        children={profile?.children || []}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
        />

        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-6 h-6 text-violet-500" />
            <h2 className="text-xl font-bold text-slate-800">Mi Perfil</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${
                  message.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {message.type === "success" ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Profile Card */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-violet-500 to-purple-600" />
                <div className="px-6 pb-6">
                  <div className="-mt-12 mb-4">
                    <div className="relative inline-block">
                      {localPhotoUrl ? (
                        <img src={localPhotoUrl} alt="" className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg" />
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 border-4 border-white shadow-lg flex items-center justify-center">
                          <User className="w-10 h-10 text-white" />
                        </div>
                      )}
                      <button
                        onClick={() => setShowPhotoModal(true)}
                        data-testid="parent-profile-change-photo-btn"
                        className="absolute bottom-0 right-0 w-8 h-8 bg-violet-500 rounded-full flex items-center justify-center text-white shadow-md hover:bg-violet-600 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {user?.name} {user?.last_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-violet-600">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Padre/Apoderado</span>
                  </div>
                </div>
              </div>

              {/* Children Info */}
              {profile?.children?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-violet-500" />
                    Hijos Vinculados ({profile.children.length})
                  </h3>
                  <div className="space-y-3">
                    {profile.children.map(child => (
                      <div key={child.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        {child.photo_url ? (
                          <img src={child.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-violet-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-800">{child.name} {child.last_name}</p>
                          <p className="text-sm text-slate-500">
                            {child.grado_nombre || "Sin grado"} {child.seccion_nombre ? `- ${child.seccion_nombre}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-violet-500" />
                  Datos de Contacto
                </h3>
                <div className="space-y-4">
                  {user?.email && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Correo electrónico</p>
                        <p className="font-medium text-slate-800">{user.email}</p>
                      </div>
                    </div>
                  )}
                  {user?.phone && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Teléfono</p>
                        <p className="font-medium text-slate-800">{user.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Change Password */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-violet-500" />
                  Seguridad
                </h3>
                {!showPasswordForm ? (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    data-testid="parent-change-password-btn"
                  >
                    <Lock className="w-4 h-4" />
                    Cambiar contraseña
                  </button>
                ) : (
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña actual</label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 transition-colors"
                          required
                        />
                        <button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Nueva contraseña</label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 transition-colors"
                          required
                          minLength={6}
                        />
                        <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Confirmar nueva contraseña</label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 transition-colors"
                          required
                        />
                        <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => { setShowPasswordForm(false); setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" }); }}
                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-3 bg-violet-500 hover:bg-violet-600 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <MessageCenter token={token} user={user} />
      <MobileBottomNav role="parent" />

      <PhotoUploadModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        user={user}
        token={token}
        selfUpdate={true}
        onPhotoUpdated={(userId, photoUrl) => {
          setLocalPhotoUrl(photoUrl);
          setProfile(prev => prev ? { ...prev, photo_url: photoUrl } : prev);
          if (onUserUpdate) onUserUpdate({ ...user, photo_url: photoUrl });
        }}
      />
    </div>
  );
}
