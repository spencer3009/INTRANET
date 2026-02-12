import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Calendar, Plus, Check, X, ChevronRight, Loader2, 
  AlertCircle, Copy, Lock, Clock, Unlock, CalendarDays,
  ChevronDown, Edit2, Trash2
} from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import Sidebar from "../components/Sidebar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status badge colors
const STATUS_COLORS = {
  activo: "bg-emerald-100 text-emerald-700 border-emerald-200",
  futuro: "bg-blue-100 text-blue-700 border-blue-200",
  cerrado: "bg-slate-100 text-slate-500 border-slate-200"
};

const STATUS_LABELS = {
  activo: "Activo",
  futuro: "Futuro",
  cerrado: "Cerrado"
};

const STATUS_ICONS = {
  activo: Unlock,
  futuro: Clock,
  cerrado: Lock
};

// ══════════════════════════════════════════════════════════════════════════════
// YEAR CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function YearCard({ year, onActivate, onViewPeriods, onDelete, isDeleting }) {
  const StatusIcon = STATUS_ICONS[year.status];
  
  return (
    <div className={`bg-white rounded-2xl border-2 transition-all hover:shadow-lg ${
      year.status === "activo" 
        ? "border-emerald-300 shadow-emerald-100" 
        : "border-slate-200"
    }`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              year.status === "activo"
                ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                : year.status === "futuro"
                  ? "bg-gradient-to-br from-blue-400 to-indigo-500"
                  : "bg-slate-300"
            }`}>
              <span className="text-2xl font-black text-white">{year.year}</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{year.year}</h3>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[year.status]}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {STATUS_LABELS[year.status]}
              </span>
            </div>
          </div>
          
          {year.status !== "activo" && (
            <button
              onClick={() => onActivate(year)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Activar
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-600">
            <CalendarDays className="w-5 h-5 text-purple-500" />
            <span className="font-medium">{year.period_count || 0} períodos</span>
            {year.active_period_name && (
              <span className="text-emerald-600 text-sm ml-2">
                (Activo: {year.active_period_name})
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewPeriods(year)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              Ver períodos
              <ChevronRight className="w-4 h-4" />
            </button>
            
            {year.status !== "activo" && year.period_count === 0 && (
              <button
                onClick={() => onDelete(year)}
                disabled={isDeleting}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar año"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE YEAR MODAL
// ══════════════════════════════════════════════════════════════════════════════
function CreateYearModal({ isOpen, onClose, token, existingYears, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    year: new Date().getFullYear() + 1,
    status: "futuro",
    clone_from_year: ""
  });
  
  const headers = { Authorization: `Bearer ${token}` };
  
  useEffect(() => {
    if (isOpen) {
      // Suggest next year that doesn't exist
      const existingYearNumbers = existingYears.map(y => y.year);
      let suggestedYear = new Date().getFullYear();
      while (existingYearNumbers.includes(suggestedYear)) {
        suggestedYear++;
      }
      setForm({
        year: suggestedYear,
        status: "futuro",
        clone_from_year: existingYears.length > 0 ? String(existingYears[0].year) : ""
      });
      setError("");
    }
  }, [isOpen, existingYears]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const submitData = {
        year: parseInt(form.year),
        status: form.status
      };
      if (form.clone_from_year) {
        submitData.clone_from_year = parseInt(form.clone_from_year);
      }
      
      await axios.post(`${API}/academic/years`, submitData, { headers });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al crear año académico");
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-white" />
            <h2 className="text-xl font-bold text-white">Nuevo Año Académico</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Año *</label>
            <input
              type="number"
              value={form.year}
              onChange={(e) => setForm({...form, year: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-2xl font-bold text-center"
              min={2020}
              max={2100}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Estado inicial</label>
            <select
              value={form.status}
              onChange={(e) => setForm({...form, status: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="futuro">Futuro (solo configuración)</option>
              <option value="activo">Activo (operación normal)</option>
            </select>
          </div>
          
          {existingYears.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Copy className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-800">Clonar estructura</span>
              </div>
              <select
                value={form.clone_from_year}
                onChange={(e) => setForm({...form, clone_from_year: e.target.value})}
                className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No clonar (crear vacío)</option>
                {existingYears.map(y => (
                  <option key={y.id} value={y.year}>
                    Clonar de {y.year} ({y.period_count} períodos)
                  </option>
                ))}
              </select>
              <p className="text-xs text-blue-600 mt-2">
                Los períodos clonados se crearán como inactivos con fechas vacías.
              </p>
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              Crear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AcademicYearsPage({ token, user, subdomain, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activating, setActivating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  const loadYears = async () => {
    setLoading(true);
    try {
      const [yearsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/academic/years`, { headers }),
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: {} }))
      ]);
      setYears(yearsRes.data);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error("Error loading years:", err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (token) loadYears();
  }, [token]);
  
  const handleActivate = async (year) => {
    if (!window.confirm(`¿Activar el año ${year.year}? El año activo actual será cerrado.`)) return;
    
    setActivating(year.id);
    try {
      await axios.put(`${API}/academic/years/${year.id}`, { status: "activo" }, { headers });
      loadYears();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al activar año");
    } finally {
      setActivating(null);
    }
  };
  
  const handleDelete = async (year) => {
    if (!window.confirm(`¿Eliminar el año ${year.year}? Esta acción no se puede deshacer.`)) return;
    
    setDeleting(year.id);
    try {
      await axios.delete(`${API}/academic/years/${year.id}`, { headers });
      loadYears();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar año");
    } finally {
      setDeleting(null);
    }
  };
  
  const handleViewPeriods = (year) => {
    // Navigate to periods page with year filter
    const basePath = subdomain ? `/school/${subdomain}` : "";
    window.location.href = `${basePath}/academic-settings?year=${year.id}&tab=periodos`;
  };
  
  // Separate years by status
  const activeYear = years.find(y => y.status === "activo");
  const futureYears = years.filter(y => y.status === "futuro");
  const closedYears = years.filter(y => y.status === "cerrado");
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20 flex">
      <Sidebar user={user} settings={settings} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} subdomain={subdomain} onLogout={onLogout} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
        />
        
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
          {/* Header with Create Button */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                <Calendar className="w-8 h-8 text-emerald-500" />
                Años Académicos
              </h1>
              <p className="text-slate-600 mt-1">
                Administra los años escolares y sus períodos académicos
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nuevo Año
            </button>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            </div>
          ) : years.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-600 mb-2">No hay años académicos</h3>
              <p className="text-slate-500 mb-6">
                Crea tu primer año académico para comenzar a configurar períodos.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Crear Primer Año
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Active Year */}
              {activeYear && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Unlock className="w-5 h-5 text-emerald-500" />
                    Año Activo
                  </h2>
                  <YearCard
                    year={activeYear}
                    onActivate={handleActivate}
                    onViewPeriods={handleViewPeriods}
                    onDelete={handleDelete}
                    isDeleting={deleting === activeYear.id}
                  />
                </div>
              )}
              
              {/* Future Years */}
              {futureYears.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    Años Futuros (Solo configuración)
                  </h2>
                  <div className="space-y-4">
                    {futureYears.map(year => (
                      <YearCard
                        key={year.id}
                        year={year}
                        onActivate={handleActivate}
                        onViewPeriods={handleViewPeriods}
                        onDelete={handleDelete}
                        isDeleting={deleting === year.id}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Closed Years */}
              {closedYears.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-slate-400" />
                    Años Cerrados (Solo lectura)
                  </h2>
                  <div className="space-y-4">
                    {closedYears.map(year => (
                      <YearCard
                        key={year.id}
                        year={year}
                        onActivate={handleActivate}
                        onViewPeriods={handleViewPeriods}
                        onDelete={handleDelete}
                        isDeleting={deleting === year.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </main>
      </div>
      
      <CreateYearModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        token={token}
        existingYears={years}
        onSuccess={loadYears}
      />
    </div>
  );
}
