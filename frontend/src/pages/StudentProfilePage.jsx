import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  User,
  Menu,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  BookOpen,
  Lock,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StudentProfilePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
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

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadProfile();
  }, [token]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/student/profile`, { headers });
      setProfile(res.data);
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  };

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
      await axios.post(`${API}/api/auth/change-password`, {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      }, { headers });
      
      setMessage({ type: "success", text: "Contraseña actualizada correctamente" });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswordForm(false);
      
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ 
        type: "error", 
        text: err.response?.data?.detail || "Error al cambiar contraseña" 
      });
    } finally {
      setSaving(false);
    }
  };

  const academic = profile?.academic || {};

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Student Sidebar */}
      <StudentSidebar
        active="perfil"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={user?.school_name}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Identical to Owner's Portal */}
        <StudentHeader
          user={profile?.user || user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={null}
          schoolName={user?.school_name}
          subdomain={subdomain || user?.subdomain}
          token={token}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Title */}
          <div className="flex items-center gap-2 mb-6">
            <User className="w-6 h-6 text-cyan-500" />
            <h2 className="text-xl font-bold text-slate-800">Mi Perfil</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Message Alert */}
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
                {/* Header with gradient */}
                <div className="h-24 bg-gradient-to-r from-cyan-500 to-blue-600" />
                
                {/* Profile Info */}
                <div className="px-6 pb-6">
                  {/* Avatar */}
                  <div className="-mt-12 mb-4">
                    {profile?.user?.photo_url ? (
                      <img 
                        src={profile.user.photo_url} 
                        alt="" 
                        className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 border-4 border-white shadow-lg flex items-center justify-center">
                        <User className="w-10 h-10 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Name & Role */}
                  <h2 className="text-2xl font-bold text-slate-800">
                    {profile?.user?.name} {profile?.user?.last_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-cyan-600">
                    <GraduationCap className="w-4 h-4" />
                    <span className="text-sm font-medium">Estudiante</span>
                  </div>
                </div>
              </div>

              {/* Academic Info */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-500" />
                  Información Académica
                </h3>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-500 mb-1">Nivel</p>
                    <p className="font-medium text-slate-800">
                      {academic.nivel?.nombre || "No asignado"}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-500 mb-1">Grado</p>
                    <p className="font-medium text-slate-800">
                      {academic.grado?.nombre || "No asignado"}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-500 mb-1">Sección</p>
                    <p className="font-medium text-slate-800">
                      {academic.seccion?.nombre || "No asignado"}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-500 mb-1">Turno</p>
                    <p className="font-medium text-slate-800">
                      {academic.turno?.nombre || "No asignado"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-cyan-500" />
                  Datos de Contacto
                </h3>
                
                <div className="space-y-4">
                  {profile?.user?.email && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Correo electrónico</p>
                        <p className="font-medium text-slate-800">{profile.user.email}</p>
                      </div>
                    </div>
                  )}
                  
                  {user?.phone && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Teléfono</p>
                        <p className="font-medium text-slate-800">{user.phone}</p>
                      </div>
                    </div>
                  )}
                  
                  {!profile?.user?.email && !user?.phone && (
                    <p className="text-sm text-slate-500 text-center py-4">
                      No hay datos de contacto registrados
                    </p>
                  )}
                </div>
              </div>

              {/* Change Password */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-cyan-500" />
                  Seguridad
                </h3>
                
                {!showPasswordForm ? (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Cambiar contraseña
                  </button>
                ) : (
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    {/* Current Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Contraseña actual
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:outline-none focus:border-cyan-400 transition-colors"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    
                    {/* New Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Nueva contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:outline-none focus:border-cyan-400 transition-colors"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    
                    {/* Confirm Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Confirmar nueva contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:outline-none focus:border-cyan-400 transition-colors"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    
                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                        }}
                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
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

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
