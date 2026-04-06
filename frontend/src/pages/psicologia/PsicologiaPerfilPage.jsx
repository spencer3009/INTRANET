import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import PsicologiaLayout from "@/components/PsicologiaLayout";
import {
  User, Mail, Phone, MapPin, Calendar, Save, Brain, 
  Award, BookOpen, Clock
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PsicologiaPerfilPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    office_location: "",
    schedule_notes: "",
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API}/v1/psychologists/me/profile`, { headers });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setForm({
          phone: data.phone || "",
          office_location: data.psychologist_profile?.office_location || "",
          schedule_notes: data.psychologist_profile?.schedule_notes || "",
        });
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/v1/psychologists/me/profile`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        fetchProfile();
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setSaving(false);
    }
  };

  const psychProfile = profile?.psychologist_profile || {};

  if (loading) {
    return (
      <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="perfil">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full"></div>
        </div>
      </PsicologiaLayout>
    );
  }

  return (
    <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="perfil">
      <div data-testid="psicologia-perfil">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <h1 className="text-lg font-bold text-slate-800">Mi Perfil</h1>
      </div>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-10 h-10 text-white/60" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile?.name} {profile?.last_name}</h2>
              <p className="text-violet-200 text-sm">{psychProfile.specialty || "Psicologo/a Escolar"}</p>
              {psychProfile.license_number && (
                <p className="text-violet-300 text-xs mt-1 flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  Licencia: {psychProfile.license_number}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-500">Email</span>
            </div>
            <p className="text-sm text-slate-800">{profile?.email}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-500">Niveles asignados</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(psychProfile.assigned_levels || []).map(level => (
                <span key={level} className="px-2 py-0.5 text-xs bg-violet-100 text-violet-700 rounded-full capitalize">
                  {level}
                </span>
              ))}
              {(!psychProfile.assigned_levels || psychProfile.assigned_levels.length === 0) && (
                <span className="text-sm text-slate-400">Sin asignar</span>
              )}
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-600" />
            Informacion Editable
          </h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Phone className="w-3 h-3 inline mr-1" />
              Telefono
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Numero de contacto"
              data-testid="profile-phone"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <MapPin className="w-3 h-3 inline mr-1" />
              Ubicacion de oficina
            </label>
            <input
              type="text"
              value={form.office_location}
              onChange={(e) => setForm(f => ({ ...f, office_location: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Ej: Oficina 201, Bloque B"
              data-testid="profile-office"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Clock className="w-3 h-3 inline mr-1" />
              Notas de horario
            </label>
            <textarea
              value={form.schedule_notes}
              onChange={(e) => setForm(f => ({ ...f, schedule_notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              rows={3}
              placeholder="Horarios de atencion, disponibilidad..."
              data-testid="profile-schedule"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            data-testid="save-profile-btn"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>
      </div>
    </PsicologiaLayout>
  );
}
