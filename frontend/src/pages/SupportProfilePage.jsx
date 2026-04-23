import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  User, Mail, Lock, Camera, Save, Eye, EyeOff, 
  Loader2, CheckCircle, Shield, Phone
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SupportProfilePage({ token, user, onUserUpdate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", last_name: "", email: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API}/support/me`, { headers });
        setProfile(res.data);
        setForm({
          name: res.data.name || "",
          last_name: res.data.last_name || "",
          email: res.data.email || "",
          whatsapp: res.data.whatsapp || ""
        });
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [token]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put(`${API}/support/me`, form, { headers });
      setProfile(res.data);
      if (onUserUpdate) {
        onUserUpdate({ ...user, name: form.name, last_name: form.last_name, email: form.email });
      }
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm) {
      toast.error("Las contrasenas no coinciden");
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error("La contrasena debe tener al menos 6 caracteres");
      return;
    }
    setChangingPassword(true);
    try {
      await axios.put(`${API}/support/me/password`, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      }, { headers });
      toast.success("Contrasena actualizada correctamente");
      setPasswordForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al cambiar contrasena");
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "ml_default");
      
      const cloudRes = await axios.post(
        `https://api.cloudinary.com/v1_1/dhn5pzinf/image/upload`,
        formData
      );
      
      const photoUrl = cloudRes.data.secure_url;
      await axios.put(`${API}/support/me`, { photo_url: photoUrl }, { headers });
      setProfile(prev => ({ ...prev, photo_url: photoUrl }));
      if (onUserUpdate) {
        onUserUpdate({ ...user, photo_url: photoUrl });
      }
      toast.success("Foto actualizada");
    } catch (err) {
      toast.error("Error al subir foto");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const initials = profile?.name 
    ? profile.name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase() 
    : "S";

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="support-profile-page">
      <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Mi Perfil</h1>

      {/* Avatar section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="w-20 h-20 rounded-2xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{profile?.name} {profile?.last_name}</h2>
            <p className="text-sm text-slate-500">{profile?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-semibold">Soporte Global</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile form */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-500" />
          Información Personal
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              data-testid="profile-name-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Apellido</label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              data-testid="profile-lastname-input"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Correo Electronico</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              data-testid="profile-email-input"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">WhatsApp de Contacto</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={form.whatsapp}
              onChange={(e) => setForm(f => ({ ...f, whatsapp: e.target.value.replace(/[^0-9]/g, '') }))}
              placeholder="Ej: 51987654321"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              data-testid="profile-whatsapp-input"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Este número se mostrara en la página de login de los colegios. Ingresa el número con código de pais, sin + ni espacios.</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          data-testid="save-profile-btn"
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Cambios
        </button>
      </form>

      {/* Change password */}
      <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-500" />
          Cambiar Contrasena
        </h3>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Contrasena Actual</label>
          <div className="relative">
            <input
              type={showCurrentPass ? "text" : "password"}
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm(f => ({ ...f, current_password: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 pr-10"
              data-testid="current-password-input"
            />
            <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-1/2 -translate-y-1/2">
              {showCurrentPass ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Nueva Contrasena</label>
            <div className="relative">
              <input
                type={showNewPass ? "text" : "password"}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 pr-10"
                data-testid="new-password-input"
              />
              <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showNewPass ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Confirmar Contrasena</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              data-testid="confirm-password-input"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={changingPassword || !passwordForm.current_password || !passwordForm.new_password}
          data-testid="change-password-btn"
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition-colors disabled:opacity-60"
        >
          {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          Cambiar Contrasena
        </button>
      </form>
    </div>
  );
}
