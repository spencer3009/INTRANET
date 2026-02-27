import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import {
  Settings, Building2, Mail, Phone, Globe, DollarSign,
  Save, Loader2, ArrowLeft, Check, AlertCircle, BookOpen,
  GraduationCap, Calculator
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Section Card Component
function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// Input Field Component
function InputField({ label, type = "text", value, onChange, placeholder, icon: Icon, helpText }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        )}
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-10' : 'px-4'} pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors`}
        />
      </div>
      {helpText && <p className="text-xs text-slate-500 mt-1">{helpText}</p>}
    </div>
  );
}

export default function AdminSettingsPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  
  // Settings data
  const [settings, setSettings] = useState({
    system_name: "",
    system_title: "",
    system_email: "",
    whatsapp: "",
    website_url: "",
    currency: "PEN",
    // Academic settings
    grade_scale_min: 0,
    grade_scale_max: 20,
    passing_grade: 11,
    attendance_threshold: 70
  });
  
  // School data
  const [school, setSchool] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsRes, schoolRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/dashboard/school`, { headers }).catch(() => ({ data: null }))
      ]);
      
      if (settingsRes.data) {
        setSettings(prev => ({ ...prev, ...settingsRes.data }));
      }
      if (schoolRes.data) {
        setSchool(schoolRes.data);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      setError("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    
    try {
      await axios.put(`${API}/settings`, {
        system_name: settings.system_name,
        system_title: settings.system_title,
        system_email: settings.system_email,
        whatsapp: settings.whatsapp,
        website_url: settings.website_url,
        currency: settings.currency
      }, { headers });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-settings-page">
      <AdminSidebar
        active="sistema"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.system_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
        />

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateTo('/admin')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Configuración del Sistema</h1>
                <p className="text-sm text-slate-500">Ajustes generales de la institución</p>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
                saved 
                  ? "bg-emerald-600 text-white" 
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : saved ? (
                <Check className="w-5 h-5" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saved ? "Guardado" : "Guardar cambios"}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información del Colegio */}
            <SectionCard
              icon={Building2}
              title="Información del Colegio"
              description="Datos básicos de la institución"
            >
              <div className="space-y-4">
                <InputField
                  label="Nombre del Colegio"
                  value={settings.system_name}
                  onChange={(v) => updateSetting("system_name", v)}
                  placeholder="Ej: Colegio San Martín"
                  icon={Building2}
                />
                <InputField
                  label="Título del Sistema"
                  value={settings.system_title}
                  onChange={(v) => updateSetting("system_title", v)}
                  placeholder="Ej: Colegio San Martín - Intranet"
                  helpText="Se muestra en el título del navegador"
                />
                {school && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Subdominio</p>
                    <p className="font-mono text-sm text-slate-700">{school.subdomain}.edunet.pe</p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Información de Contacto */}
            <SectionCard
              icon={Mail}
              title="Información de Contacto"
              description="Datos de contacto institucional"
            >
              <div className="space-y-4">
                <InputField
                  label="Correo Institucional"
                  type="email"
                  value={settings.system_email}
                  onChange={(v) => updateSetting("system_email", v)}
                  placeholder="contacto@colegio.edu.pe"
                  icon={Mail}
                />
                <InputField
                  label="WhatsApp"
                  value={settings.whatsapp}
                  onChange={(v) => updateSetting("whatsapp", v)}
                  placeholder="+51 999 999 999"
                  icon={Phone}
                  helpText="Número con código de país"
                />
                <InputField
                  label="Sitio Web"
                  type="url"
                  value={settings.website_url}
                  onChange={(v) => updateSetting("website_url", v)}
                  placeholder="https://www.colegio.edu.pe"
                  icon={Globe}
                />
              </div>
            </SectionCard>

            {/* Configuración Regional */}
            <SectionCard
              icon={DollarSign}
              title="Configuración Regional"
              description="Moneda y formato de datos"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => updateSetting("currency", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    <option value="PEN">🇵🇪 Soles (PEN)</option>
                    <option value="USD">🇺🇸 Dólares (USD)</option>
                    <option value="EUR">🇪🇺 Euros (EUR)</option>
                  </select>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Zona Horaria</p>
                  <p className="font-medium text-slate-700">América/Lima (UTC-5)</p>
                  <p className="text-xs text-slate-400 mt-1">La zona horaria se configura automáticamente</p>
                </div>
              </div>
            </SectionCard>

            {/* Configuración Académica */}
            <SectionCard
              icon={GraduationCap}
              title="Configuración Académica"
              description="Parámetros de evaluación"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nota Mínima</label>
                    <input
                      type="number"
                      value={settings.grade_scale_min}
                      onChange={(e) => updateSetting("grade_scale_min", parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nota Máxima</label>
                    <input
                      type="number"
                      value={settings.grade_scale_max}
                      onChange={(e) => updateSetting("grade_scale_max", parseInt(e.target.value) || 20)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nota Aprobatoria</label>
                  <input
                    type="number"
                    value={settings.passing_grade}
                    onChange={(e) => updateSetting("passing_grade", parseInt(e.target.value) || 11)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    min={0}
                    max={settings.grade_scale_max}
                  />
                  <p className="text-xs text-slate-500 mt-1">Nota mínima para aprobar una asignatura</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">% Asistencia Mínima</label>
                  <input
                    type="number"
                    value={settings.attendance_threshold}
                    onChange={(e) => updateSetting("attendance_threshold", parseInt(e.target.value) || 70)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    min={0}
                    max={100}
                  />
                  <p className="text-xs text-slate-500 mt-1">Porcentaje mínimo de asistencia requerido</p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </main>
    </div>
  );
}
