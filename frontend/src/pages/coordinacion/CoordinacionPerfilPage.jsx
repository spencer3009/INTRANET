import { useState, useEffect } from "react";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { User, Mail, Phone, Save, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CoordinacionPerfilPage({ user, token, onLogout, onUserUpdate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", last_name: "", phone: "" });
  const [uploading, setUploading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get(`${API}/api/auth/me`, { headers })
      .then(r => {
        setProfile(r.data);
        setForm({ name: r.data.name || "", last_name: r.data.last_name || "", phone: r.data.phone || "" });
      })
      .catch(() => toast.error("Error al cargar perfil"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/api/users/${user.id}`, form, { headers });
      setProfile(p => ({ ...p, ...form }));
      if (onUserUpdate) onUserUpdate({ ...user, ...form });
      toast.success("Perfil actualizado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const sigRes = await axios.get(`${API}/api/cloudinary/signature?folder=edunet/users&resource_type=image`, { headers });
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("signature", signature);
      fd.append("timestamp", timestamp);
      fd.append("api_key", api_key);
      fd.append("folder", folder);
      const upRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, fd);
      const photo_url = upRes.data.secure_url;
      await axios.put(`${API}/api/users/${user.id}`, { photo_url }, { headers });
      setProfile(p => ({ ...p, photo_url }));
      if (onUserUpdate) onUserUpdate({ ...user, photo_url });
      toast.success("Foto actualizada");
    } catch {
      toast.error("Error al subir foto");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="">
      <div className="p-6 text-center text-slate-400">Cargando perfil...</div>
    </CoordinacionLayout>
  );

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="">
    <div className="p-4 md:p-6" data-testid="coordinacion-perfil-page">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <User className="w-6 h-6 text-indigo-600" /> Mi perfil
      </h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-slate-300" />
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors">
              {uploading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
            </label>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">{profile?.name} {profile?.last_name}</p>
            <p className="text-sm text-slate-500 capitalize">{profile?.role}</p>
          </div>
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> Correo electronico
          </label>
          <input type="email" value={profile?.email || ""} disabled
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
        </div>

        {/* Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input type="text" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              data-testid="input-name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
            <input type="text" value={form.last_name}
              onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              data-testid="input-lastname" />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" /> Telefono
          </label>
          <input type="tel" value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            placeholder="Ej: 999 888 777"
            data-testid="input-phone" />
        </div>

        {/* Save */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            data-testid="save-profile-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
    </CoordinacionLayout>
  );
}
