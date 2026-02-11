import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import {
  User, Mail, Phone, Camera, Save, Lock, Eye, EyeOff,
  Shield, Crown, CheckCircle, AlertCircle, Loader2, AtSign, Check, X,
  BookOpen, GraduationCap, Users, Calendar
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProfilePage({ user, token, subdomain, onLogout, onUserUpdate }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  
  const [profile, setProfile] = useState({
    name: "",
    last_name: "",
    username: "",
    phone: "",
    photo_url: ""
  });
  
  const [usernameStatus, setUsernameStatus] = useState(null); // null, 'checking', 'available', 'taken', 'invalid'
  const [usernameMessage, setUsernameMessage] = useState("");
  
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  const [uploading, setUploading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsRes, meRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/auth/me`, { headers })
      ]);
      
      if (settingsRes.data) setSettings(settingsRes.data);
      
      const userData = meRes.data;
      setProfile({
        name: userData.name || "",
        last_name: userData.last_name || "",
        username: userData.username || "",
        phone: userData.phone || "",
        photo_url: userData.photo_url || ""
      });
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) onLogout();
    } finally {
      setLoading(false);
    }
  };

  // Check username availability with debounce
  useEffect(() => {
    const checkUsername = async () => {
      const username = profile.username?.trim();
      if (!username || username.length < 3) {
        setUsernameStatus(null);
        setUsernameMessage("");
        return;
      }
      
      // Don't check if it's the current username
      if (username === user?.username) {
        setUsernameStatus("available");
        setUsernameMessage("Tu nombre de usuario actual");
        return;
      }
      
      setUsernameStatus("checking");
      try {
        const res = await axios.get(`${API}/auth/check-username/${username}`, { headers });
        setUsernameStatus(res.data.available ? "available" : "taken");
        setUsernameMessage(res.data.message);
      } catch (err) {
        setUsernameStatus("invalid");
        setUsernameMessage("Error al verificar");
      }
    };
    
    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [profile.username]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "La imagen no debe superar los 5MB" });
      return;
    }
    
    setUploading(true);
    setMessage(null);
    try {
      // Get Cloudinary signature (GET request with query params)
      const sigRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/users&resource_type=image`, { headers });
      
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", sigRes.data.api_key);
      formData.append("timestamp", sigRes.data.timestamp);
      formData.append("signature", sigRes.data.signature);
      formData.append("folder", sigRes.data.folder);
      
      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${sigRes.data.cloud_name}/image/upload`,
        formData
      );
      
      setProfile(prev => ({ ...prev, photo_url: uploadRes.data.secure_url }));
      setMessage({ type: "success", text: "Foto actualizada" });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al subir la imagen" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await axios.put(`${API}/auth/profile`, profile, { headers });
      setMessage({ type: "success", text: res.data.message });
      
      // Notify parent to update user state
      if (onUserUpdate && res.data.user) {
        onUserUpdate(res.data.user);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new_password !== passwords.confirm_password) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }
    
    if (passwords.new_password.length < 6) {
      setMessage({ type: "error", text: "La nueva contraseña debe tener al menos 6 caracteres" });
      return;
    }
    
    setSavingPassword(true);
    setMessage(null);
    try {
      const res = await axios.put(`${API}/auth/password`, {
        current_password: passwords.current_password,
        new_password: passwords.new_password
      }, { headers });
      
      setMessage({ type: "success", text: res.data.message });
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Error al cambiar contraseña" });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-zinc-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-zinc-100 flex">
      <Sidebar
        user={user}
        settings={settings}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-white/50 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="h-9 w-auto" />}
            <div>
              <h1 className="text-lg font-bold text-gray-800">{settings?.system_name || "Mi Perfil"}</h1>
              <p className="text-xs text-gray-400">Configuración de cuenta</p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-8 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
              
              <div className="relative flex items-center gap-6">
                {/* Photo */}
                <div className="relative">
                  {profile.photo_url ? (
                    <img
                      src={profile.photo_url}
                      alt="Foto de perfil"
                      className="w-28 h-28 rounded-2xl object-cover ring-4 ring-white/30 shadow-2xl"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl bg-white/20 flex items-center justify-center ring-4 ring-white/30 shadow-2xl">
                      <User className="w-14 h-14 text-white/80" />
                    </div>
                  )}
                  <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    {uploading ? (
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-indigo-600" />
                    )}
                  </label>
                </div>
                
                {/* Info */}
                <div className="text-white">
                  <h2 className="text-3xl font-bold">{user?.name} {user?.last_name}</h2>
                  <p className="text-white/80 mt-1">{user?.email}</p>
                  {user?.username && (
                    <p className="text-white/60 text-sm mt-0.5">@{user.username}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    {(user?.is_super_admin || user?.role === "super_admin" || user?.role === "owner") && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 text-amber-900 rounded-full text-xs font-bold">
                        <Crown className="w-3.5 h-3.5" />
                        Super Admin
                      </span>
                    )}
                    {(user?.is_owner || user?.role === "owner") && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold">
                        <Shield className="w-3.5 h-3.5" />
                        Propietario
                      </span>
                    )}
                    <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold capitalize">
                      {user?.role === "director" ? "Director" : user?.role === "owner" ? "Director" : user?.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                message.type === "success" 
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700" 
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>
                {message.type === "success" ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span className="font-medium">{message.text}</span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                  activeTab === "profile"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <User className="w-4 h-4 inline mr-2" />
                Información Personal
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                  activeTab === "security"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Lock className="w-4 h-4 inline mr-2" />
                Seguridad
              </button>
            </div>

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Información Personal</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Tu nombre"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Apellido</label>
                    <input
                      type="text"
                      value={profile.last_name}
                      onChange={(e) => setProfile(p => ({ ...p, last_name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Tu apellido"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <AtSign className="w-4 h-4 inline mr-1" />
                      Nombre de Usuario
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={profile.username}
                        onChange={(e) => setProfile(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                        className={`w-full px-4 py-3 pr-12 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent ${
                          usernameStatus === 'available' ? 'border-emerald-300 focus:ring-emerald-500' :
                          usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-red-300 focus:ring-red-500' :
                          'border-gray-200 focus:ring-indigo-500'
                        }`}
                        placeholder="mi_usuario"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {usernameStatus === 'checking' && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
                        {usernameStatus === 'available' && <Check className="w-5 h-5 text-emerald-500" />}
                        {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <X className="w-5 h-5 text-red-500" />}
                      </div>
                    </div>
                    <p className={`text-xs mt-1 ${
                      usernameStatus === 'available' ? 'text-emerald-600' :
                      usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'text-red-600' :
                      'text-gray-400'
                    }`}>
                      {usernameMessage || "Puedes usar este nombre para iniciar sesión"}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">El email no puede ser modificado</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Phone className="w-4 h-4 inline mr-1" />
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="+51 999 999 999"
                    />
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2"
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
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Cambiar Contraseña</h3>
                
                <div className="max-w-md space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña Actual</label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? "text" : "password"}
                        value={passwords.current_password}
                        onChange={(e) => setPasswords(p => ({ ...p, current_password: e.target.value }))}
                        className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nueva Contraseña</label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? "text" : "password"}
                        value={passwords.new_password}
                        onChange={(e) => setPasswords(p => ({ ...p, new_password: e.target.value }))}
                        className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Mínimo 6 caracteres</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirmar Nueva Contraseña</label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwords.confirm_password}
                        onChange={(e) => setPasswords(p => ({ ...p, confirm_password: e.target.value }))}
                        className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleChangePassword}
                    disabled={savingPassword || !passwords.current_password || !passwords.new_password || !passwords.confirm_password}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingPassword ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                    Cambiar Contraseña
                  </button>
                </div>
              </div>
            )}

            {/* Account Info */}
            {(user?.is_owner || user?.role === "owner") && (
              <div className="mt-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">Cuenta Protegida</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Eres el propietario y Super Admin de esta intranet. Tu cuenta no puede ser eliminada ni degradada. 
                      Tienes acceso total a todos los módulos y configuraciones.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
