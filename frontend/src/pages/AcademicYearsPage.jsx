import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Calendar, Plus, Check, X, ChevronRight, Loader2, 
  AlertCircle, Copy, Lock, Clock, Unlock, CalendarDays,
  ChevronDown, Edit2, Trash2, ArrowLeft, Settings,
  PlayCircle, PauseCircle, CalendarRange, Archive, ShieldAlert, Power
} from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import Sidebar from "../components/Sidebar";
import { ConfirmModal } from "../components/ui/ConfirmModal";

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
// PERIOD MODAL - For creating/editing periods within a year
// ══════════════════════════════════════════════════════════════════════════════
function PeriodModal({ isOpen, onClose, token, period, academicYear, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", fecha_inicio: "", fecha_fin: "", activo: false });
  const isEdit = !!period;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      if (period) {
        setForm({
          nombre: period.nombre || "",
          fecha_inicio: period.fecha_inicio || "",
          fecha_fin: period.fecha_fin || "",
          activo: period.activo || false
        });
      } else {
        // Set default dates based on academic year
        const year = academicYear?.year || new Date().getFullYear();
        setForm({
          nombre: "",
          fecha_inicio: `${year}-03-01`,
          fecha_fin: `${year}-07-31`,
          activo: false
        });
      }
      setError("");
    }
  }, [isOpen, period, academicYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.fecha_inicio) { setError("La fecha de inicio es obligatoria"); return; }
    if (!form.fecha_fin) { setError("La fecha de fin es obligatoria"); return; }
    if (form.fecha_inicio >= form.fecha_fin) { 
      setError("La fecha de inicio debe ser anterior a la fecha de fin"); 
      return; 
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        academic_year_id: academicYear.id
      };
      const res = isEdit 
        ? await axios.put(`${API}/academic/periods/${period.id}`, payload, { headers }) 
        : await axios.post(`${API}/academic/periods`, payload, { headers });
      onSuccess(res.data.period, isEdit ? "update" : "create", res.data.deactivated_period);
      onClose();
    } catch (err) { 
      setError(err.response?.data?.detail || "Error al guardar"); 
    }
    finally { setLoading(false); }
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarRange className="w-8 h-8 text-white" />
              <div className="text-white">
                <h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nuevo"} Período</h2>
                <p className="text-white/70 text-sm">Año Académico {academicYear?.year}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nombre del Período <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={form.nombre} 
                onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Ej: Bimestre I" 
                required 
              />
              <p className="text-xs text-slate-500 mt-1">No incluyas el año, se asociará automáticamente al año {academicYear?.year}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Fecha inicio <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={form.fecha_inicio} 
                  onChange={(e) => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  required 
                />
                {form.fecha_inicio && (
                  <p className="text-xs text-slate-500 mt-1">{formatDateLabel(form.fecha_inicio)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Fecha fin <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={form.fecha_fin} 
                  onChange={(e) => setForm(p => ({ ...p, fecha_fin: e.target.value }))} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  required 
                />
                {form.fecha_fin && (
                  <p className="text-xs text-slate-500 mt-1">{formatDateLabel(form.fecha_fin)}</p>
                )}
              </div>
            </div>

            {!isEdit && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Nota sobre activación</p>
                    <p>Solo puede haber un período activo a la vez. Si activas este período al crearlo, el período actual será desactivado automáticamente.</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-semibold text-slate-700">Activar período</p>
                <p className="text-sm text-slate-500">
                  {form.activo ? "Este será el período activo" : "Crear como inactivo"}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} 
                className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-indigo-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} />
              </button>
            </div>
            
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {isEdit ? "Guardar" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// YEAR DETAIL VIEW - Shows year info and its periods
// ══════════════════════════════════════════════════════════════════════════════
function YearDetailView({ year, periods, onBack, onActivateYear, onActivatePeriod, onEditPeriod, onDeletePeriod, onAddPeriod, loadingPeriods }) {
  const StatusIcon = STATUS_ICONS[year.status];
  const activePeriod = periods.find(p => p.activo);
  
  const formatDate = (dateStr) => {
    if (!dateStr) return "No definida";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("es-PE", { 
      day: "numeric", 
      month: "short", 
      year: "numeric" 
    });
  };

  const getDurationDays = (start, end) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Back button and Year Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className="p-3 bg-white hover:bg-slate-50 rounded-xl shadow-sm border border-slate-200 transition-all hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-emerald-500" />
            Año Académico {year.year}
          </h1>
          <p className="text-slate-600 mt-1">
            Gestiona la información y períodos de este año escolar
          </p>
        </div>
      </div>

      {/* Year Info Card */}
      <div className={`bg-white rounded-2xl border-2 shadow-lg overflow-hidden ${
        year.status === "activo" ? "border-emerald-300" : "border-slate-200"
      }`}>
        <div className={`px-6 py-4 ${
          year.status === "activo" 
            ? "bg-gradient-to-r from-emerald-500 to-teal-600" 
            : year.status === "futuro"
              ? "bg-gradient-to-r from-blue-500 to-indigo-600"
              : "bg-gradient-to-r from-slate-400 to-slate-500"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <span className="text-3xl font-black text-white">{year.year}</span>
              </div>
              <div className="text-white">
                <h2 className="text-2xl font-bold">Información del Año</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StatusIcon className="w-4 h-4" />
                  <span className="font-medium">{STATUS_LABELS[year.status]}</span>
                </div>
              </div>
            </div>
            {year.status !== "activo" && (
              <button
                onClick={() => onActivateYear(year)}
                className="px-5 py-2.5 bg-white text-emerald-600 hover:bg-emerald-50 rounded-xl font-semibold transition-colors flex items-center gap-2"
              >
                <PlayCircle className="w-5 h-5" />
                Activar Año
              </button>
            )}
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <p className="text-3xl font-bold text-slate-800">{periods.length}</p>
              <p className="text-sm text-slate-500 mt-1">Períodos configurados</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <p className="text-3xl font-bold text-emerald-600">{activePeriod ? "1" : "0"}</p>
              <p className="text-sm text-slate-500 mt-1">Período activo</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <p className="text-3xl font-bold text-slate-800">{year.status === "activo" ? "Sí" : "No"}</p>
              <p className="text-sm text-slate-500 mt-1">Año en operación</p>
            </div>
          </div>
          {activePeriod && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800">Período Activo: {activePeriod.nombre}</p>
                  <p className="text-sm text-emerald-600">
                    {formatDate(activePeriod.fecha_inicio)} — {formatDate(activePeriod.fecha_fin)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Periods Section */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-violet-600 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <CalendarRange className="w-7 h-7" />
            <div>
              <h2 className="text-xl font-bold">Períodos Académicos</h2>
              <p className="text-white/70 text-sm">Bimestres, trimestres o períodos del año {year.year}</p>
            </div>
          </div>
          <button
            onClick={onAddPeriod}
            className="px-5 py-2.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Período
          </button>
        </div>
        
        <div className="p-6">
          {loadingPeriods ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : periods.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <CalendarRange className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-600 mb-2">Sin períodos configurados</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Este año no tiene períodos académicos. Crea los bimestres o trimestres para organizar el calendario escolar.
              </p>
              <button
                onClick={onAddPeriod}
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Crear Primer Período
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {periods.map((period, index) => {
                const duration = getDurationDays(period.fecha_inicio, period.fecha_fin);
                return (
                  <div 
                    key={period.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      period.activo 
                        ? "bg-emerald-50 border-emerald-300" 
                        : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                          period.activo 
                            ? "bg-emerald-500 text-white" 
                            : "bg-slate-200 text-slate-600"
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-lg">{period.nombre}</h3>
                            {period.activo && (
                              <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
                                ACTIVO
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(period.fecha_inicio)} — {formatDate(period.fecha_fin)}
                            </span>
                            {duration && (
                              <span className="text-indigo-600 font-medium">
                                {duration} días
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!period.activo && (
                          <button
                            onClick={() => onActivatePeriod(period)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                          >
                            <PlayCircle className="w-4 h-4" />
                            Activar
                          </button>
                        )}
                        <button
                          onClick={() => onEditPeriod(period)}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => onDeletePeriod(period)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// YEAR CARD - Premium Design
// ══════════════════════════════════════════════════════════════════════════════
function YearCard({ year, onViewDetails, onActivate, onEdit, onDelete, onArchive, isActivating, isDeleting }) {
  const StatusIcon = STATUS_ICONS[year.status];
  
  const getGradient = () => {
    switch (year.status) {
      case "activo":
        return "from-emerald-500 via-emerald-600 to-teal-600";
      case "futuro":
        return "from-blue-500 via-indigo-500 to-violet-600";
      default:
        return "from-slate-400 via-slate-500 to-slate-600";
    }
  };
  
  return (
    <div 
      onClick={() => onViewDetails(year)}
      className={`group relative bg-white rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-2xl hover:-translate-y-1 ${
        year.status === "activo" 
          ? "ring-2 ring-emerald-400 shadow-lg shadow-emerald-100" 
          : "shadow-lg hover:ring-2 hover:ring-slate-200"
      }`}
    >
      {/* Decorative gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${getGradient()}`} />
      
      {/* Active indicator glow */}
      {year.status === "activo" && (
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-400/20 rounded-full blur-3xl" />
      )}
      
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Year Badge */}
            <div className={`relative w-20 h-20 rounded-2xl bg-gradient-to-br ${getGradient()} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300`}>
              <span className="text-3xl font-black text-white tracking-tight">{year.year}</span>
              {year.status === "activo" && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center ring-2 ring-white">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-2xl font-bold text-slate-800 group-hover:text-slate-900 transition-colors">
                Año {year.year}
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${STATUS_COLORS[year.status]}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {STATUS_LABELS[year.status]}
              </span>
            </div>
          </div>
          
          {/* Quick Activate Button */}
          {year.status !== "activo" && (
            <button
              onClick={(e) => { e.stopPropagation(); onActivate(year); }}
              disabled={isActivating}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {isActivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              Activar
            </button>
          )}
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 rounded-2xl p-4 text-center group-hover:bg-slate-100 transition-colors">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CalendarDays className="w-5 h-5 text-indigo-500" />
              <span className="text-2xl font-bold text-slate-800">{year.period_count || 0}</span>
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Períodos</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center group-hover:bg-slate-100 transition-colors">
            <div className="flex items-center justify-center gap-2 mb-1">
              <PlayCircle className={`w-5 h-5 ${year.active_period_name ? 'text-emerald-500' : 'text-slate-300'}`} />
              <span className="text-2xl font-bold text-slate-800">{year.active_period_name ? "1" : "0"}</span>
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Activo</p>
          </div>
        </div>
        
        {/* Active Period Info */}
        {year.active_period_name && (
          <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-md">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Período Activo</p>
                <p className="font-bold text-emerald-800">{year.active_period_name}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(year); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all group-hover:bg-indigo-100 group-hover:text-indigo-700"
          >
            <Settings className="w-4 h-4" />
            {year.status === "cerrado" ? "Ver detalles" : "Gestionar"}
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          
          {/* Action buttons based on status */}
          <div className="flex items-center gap-2">
            {/* FUTURO: Can edit and potentially delete */}
            {year.status === "futuro" && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(year); }}
                  className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                  title="Editar año"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(year); }}
                  disabled={isDeleting}
                  className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                  title="Verificar eliminación"
                >
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                </button>
              </>
            )}
            
            {/* CERRADO: Can archive (read-only otherwise) */}
            {year.status === "cerrado" && (
              <button
                onClick={(e) => { e.stopPropagation(); onArchive && onArchive(year); }}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2 text-sm font-medium"
                title="Archivar año"
              >
                <Archive className="w-4 h-4" />
                Archivar
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
                Los períodos clonados se crearán como inactivos con fechas ajustadas al nuevo año.
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
// EDIT YEAR MODAL
// ══════════════════════════════════════════════════════════════════════════════
function EditYearModal({ isOpen, onClose, token, year, existingYears, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ year: "", status: "futuro" });
  
  const headers = { Authorization: `Bearer ${token}` };
  
  useEffect(() => {
    if (isOpen && year) {
      setForm({
        year: year.year,
        status: year.status
      });
      setError("");
    }
  }, [isOpen, year]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // Check if year already exists (except current)
    const yearExists = existingYears.some(y => y.year === parseInt(form.year) && y.id !== year.id);
    if (yearExists) {
      setError(`El año ${form.year} ya existe`);
      setLoading(false);
      return;
    }
    
    try {
      await axios.put(`${API}/academic/years/${year.id}`, {
        year: parseInt(form.year),
        status: form.status
      }, { headers });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al actualizar año académico");
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen || !year) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Edit2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Editar Año Académico</h2>
              <p className="text-white/70 text-sm">Modificar información del año {year.year}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Año</label>
            <input
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-2xl text-center"
              min="2020"
              max="2100"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Estado</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, status: "futuro" })}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  form.status === "futuro"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <Clock className="w-6 h-6" />
                <span className="font-semibold">Futuro</span>
                <span className="text-xs opacity-70">Solo configuración</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, status: "cerrado" })}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  form.status === "cerrado"
                    ? "border-slate-500 bg-slate-50 text-slate-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <Lock className="w-6 h-6" />
                <span className="font-semibold">Cerrado</span>
                <span className="text-xs opacity-70">Solo lectura</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Para activar un año, usa el botón "Activar" en la tarjeta del año.
            </p>
          </div>
          
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION MODAL - With dependency check
// ══════════════════════════════════════════════════════════════════════════════
function DeleteYearModal({ isOpen, onClose, year, token, onConfirm, onCloseYear, loading }) {
  const [checkingDeps, setCheckingDeps] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [dependencies, setDependencies] = useState(null);
  const [reasons, setReasons] = useState([]);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  useEffect(() => {
    if (isOpen && year) {
      checkDependencies();
    }
  }, [isOpen, year]);
  
  const checkDependencies = async () => {
    setCheckingDeps(true);
    try {
      const res = await axios.get(`${API}/academic/years/${year.id}/can-delete`, { headers });
      setCanDelete(res.data.can_delete);
      setDependencies(res.data.dependencies);
      setReasons(res.data.reasons || []);
    } catch (err) {
      setCanDelete(false);
      setReasons(["Error al verificar dependencias"]);
    } finally {
      setCheckingDeps(false);
    }
  };
  
  if (!isOpen || !year) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        {checkingDeps ? (
          <div className="p-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Verificando información del año...</p>
          </div>
        ) : canDelete ? (
          // CAN DELETE - Year is futuro with no dependencies
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Eliminar Año {year.year}</h3>
                <p className="text-slate-500 mt-1">
                  Este año puede eliminarse de forma segura.
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-800">Verificación completada</p>
                  <p className="text-sm text-emerald-700">
                    El año <strong>{year.year}</strong> no tiene períodos, asignaciones ni datos asociados.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-xl mb-6">
              <p className="text-sm text-slate-600">
                Esta acción <strong>no se puede deshacer</strong>. El año académico será eliminado permanentemente.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => onConfirm(year)}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          // CANNOT DELETE - Has dependencies or wrong status
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">No se puede eliminar</h3>
                <p className="text-slate-500 mt-1">
                  El año {year.year} tiene datos que deben preservarse.
                </p>
              </div>
            </div>
            
            {/* Reasons list */}
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Motivos:
              </p>
              <ul className="space-y-2">
                {reasons.map((reason, idx) => (
                  <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Dependencies summary */}
            {dependencies && (dependencies.periods > 0 || dependencies.assignments > 0 || dependencies.course_posts > 0) && (
              <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                <p className="font-semibold text-slate-700 mb-3">Datos asociados:</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-2xl font-bold text-slate-800">{dependencies.periods}</p>
                    <p className="text-xs text-slate-500">Períodos</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-2xl font-bold text-slate-800">{dependencies.assignments}</p>
                    <p className="text-xs text-slate-500">Asignaciones</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-2xl font-bold text-slate-800">{dependencies.course_posts}</p>
                    <p className="text-xs text-slate-500">Publicaciones</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Recommended action */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
              <p className="font-semibold text-blue-800 mb-2">Acción recomendada</p>
              <p className="text-sm text-blue-700">
                {year.status === "activo" 
                  ? "Active otro año académico primero, luego podrá cerrar este año."
                  : year.status === "cerrado"
                    ? "Los años cerrados contienen datos históricos. Puede archivarlos para ocultarlos del flujo operativo."
                    : "Elimine primero los períodos y asignaciones asociados, o cierre el año para preservar los datos."
                }
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
              >
                Entendido
              </button>
              {year.status === "futuro" && dependencies?.periods > 0 && (
                <button
                  onClick={() => { onClose(); /* Navigate to periods */ }}
                  className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Settings className="w-5 h-5" />
                  Gestionar
                </button>
              )}
            </div>
          </div>
        )}
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [deletingYear, setDeletingYear] = useState(null);
  const [activating, setActivating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Detail view states
  const [selectedYear, setSelectedYear] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  
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
  
  const loadPeriods = async (yearId) => {
    setLoadingPeriods(true);
    try {
      const res = await axios.get(`${API}/academic/periods?academic_year_id=${yearId}`, { headers });
      setPeriods(res.data || []);
    } catch (err) {
      console.error("Error loading periods:", err);
    } finally {
      setLoadingPeriods(false);
    }
  };
  
  useEffect(() => {
    if (token) loadYears();
  }, [token]);
  
  useEffect(() => {
    if (selectedYear) {
      loadPeriods(selectedYear.id);
    }
  }, [selectedYear]);
  
  const handleActivateYear = async (year) => {
    if (!window.confirm(`¿Activar el año ${year.year}? El año activo actual será cerrado.`)) return;
    
    setActivating(year.id);
    try {
      await axios.put(`${API}/academic/years/${year.id}`, { status: "activo" }, { headers });
      loadYears();
      if (selectedYear?.id === year.id) {
        setSelectedYear({ ...year, status: "activo" });
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Error al activar año");
    } finally {
      setActivating(null);
    }
  };
  
  const handleArchiveYear = async (year) => {
    // For now, archiving means setting a flag. We can implement a full archive feature later.
    alert(`Función de archivar disponible próximamente. El año ${year.year} permanecerá en la sección "Cerrados".`);
  };
  
  const handleEditYear = (year) => {
    setEditingYear(year);
    setShowEditModal(true);
  };
  
  const handleDeleteYearClick = (year) => {
    setDeletingYear(year);
    setShowDeleteModal(true);
  };
  
  const handleDeleteYearConfirm = async (year) => {
    setDeleting(year.id);
    try {
      await axios.delete(`${API}/academic/years/${year.id}`, { headers });
      setShowDeleteModal(false);
      setDeletingYear(null);
      loadYears();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar año");
    } finally {
      setDeleting(null);
    }
  };
  
  const handleViewDetails = (year) => {
    setSelectedYear(year);
  };
  
  const handleBackToList = () => {
    setSelectedYear(null);
    setPeriods([]);
    loadYears(); // Refresh the list
  };
  
  // Period handlers
  const handleAddPeriod = () => {
    setEditingPeriod(null);
    setShowPeriodModal(true);
  };
  
  const handleEditPeriod = (period) => {
    setEditingPeriod(period);
    setShowPeriodModal(true);
  };
  
  const handleDeletePeriod = async (period) => {
    if (!window.confirm(`¿Eliminar el período "${period.nombre}"? Esta acción no se puede deshacer.`)) return;
    
    try {
      await axios.delete(`${API}/academic/periods/${period.id}`, { headers });
      loadPeriods(selectedYear.id);
      loadYears(); // Update period count
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar período");
    }
  };
  
  const handleActivatePeriod = async (period) => {
    if (!window.confirm(`¿Activar el período "${period.nombre}"? El período activo actual será desactivado.`)) return;
    
    try {
      await axios.post(`${API}/academic/periods/${period.id}/activate`, {}, { headers });
      loadPeriods(selectedYear.id);
      loadYears(); // Update active period name
    } catch (err) {
      alert(err.response?.data?.detail || "Error al activar período");
    }
  };
  
  const handlePeriodSuccess = () => {
    loadPeriods(selectedYear.id);
    loadYears(); // Update period count
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
            {selectedYear ? (
              // Detail View
              <YearDetailView
                year={selectedYear}
                periods={periods}
                onBack={handleBackToList}
                onActivateYear={handleActivateYear}
                onActivatePeriod={handleActivatePeriod}
                onEditPeriod={handleEditPeriod}
                onDeletePeriod={handleDeletePeriod}
                onAddPeriod={handleAddPeriod}
                loadingPeriods={loadingPeriods}
              />
            ) : (
              // List View - Premium Design
              <>
                {/* Premium Header */}
                <div className="relative mb-10">
                  {/* Decorative background */}
                  <div className="absolute -top-4 -left-4 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl" />
                  <div className="absolute -top-2 right-10 w-24 h-24 bg-teal-400/10 rounded-full blur-2xl" />
                  
                  <div className="relative flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                          <Calendar className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                            Años Académicos
                          </h1>
                          <p className="text-slate-500 font-medium">
                            Gestión de ciclos escolares y períodos
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="group px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-0.5 flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                      Nuevo Año
                    </button>
                  </div>
                  
                  {/* Stats Bar */}
                  <div className="mt-6 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-around divide-x divide-slate-200">
                      <div className="flex items-center gap-3 px-6">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                          <Unlock className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-800">{activeYear ? 1 : 0}</p>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Activo</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-6">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                          <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-800">{futureYears.length}</p>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Futuros</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-6">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <Lock className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-800">{closedYears.length}</p>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cerrados</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-6">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                          <CalendarDays className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-800">{years.reduce((sum, y) => sum + (y.period_count || 0), 0)}</p>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Períodos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-emerald-200 rounded-full animate-pulse" />
                      <Loader2 className="w-10 h-10 animate-spin text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-4 text-slate-500 font-medium">Cargando años académicos...</p>
                  </div>
                ) : years.length === 0 ? (
                  <div className="relative bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative">
                      <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl mx-auto mb-6 flex items-center justify-center">
                        <Calendar className="w-10 h-10 text-emerald-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-700 mb-3">No hay años académicos</h3>
                      <p className="text-slate-500 mb-8 max-w-md mx-auto">
                        Comienza creando tu primer año académico para configurar períodos y gestionar el ciclo escolar.
                      </p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Crear Primer Año
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {/* Active Year Section */}
                    {activeYear && (
                      <section>
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Unlock className="w-4 h-4 text-emerald-600" />
                          </div>
                          <h2 className="text-lg font-bold text-slate-700">Año en Operación</h2>
                          <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
                        </div>
                        <YearCard
                          year={activeYear}
                          onViewDetails={handleViewDetails}
                          onActivate={handleActivateYear}
                          onEdit={handleEditYear}
                          onDelete={handleDeleteYearClick}
                          onArchive={handleArchiveYear}
                          isActivating={activating === activeYear.id}
                          isDeleting={deleting === activeYear.id}
                        />
                      </section>
                    )}
                    
                    {/* Future Years Section */}
                    {futureYears.length > 0 && (
                      <section>
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-blue-600" />
                          </div>
                          <h2 className="text-lg font-bold text-slate-700">Años Futuros</h2>
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-full">Solo configuración</span>
                          <div className="flex-1 h-px bg-gradient-to-r from-blue-200 to-transparent" />
                        </div>
                        <div className="grid gap-5">
                          {futureYears.map(year => (
                            <YearCard
                              key={year.id}
                              year={year}
                              onViewDetails={handleViewDetails}
                              onActivate={handleActivateYear}
                              onEdit={handleEditYear}
                              onDelete={handleDeleteYearClick}
                              onArchive={handleArchiveYear}
                              isActivating={activating === year.id}
                              isDeleting={deleting === year.id}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                    
                    {/* Closed Years Section */}
                    {closedYears.length > 0 && (
                      <section>
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <Lock className="w-4 h-4 text-slate-500" />
                          </div>
                          <h2 className="text-lg font-bold text-slate-700">Años Cerrados</h2>
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">Solo lectura</span>
                          <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                        </div>
                        <div className="grid gap-5">
                          {closedYears.map(year => (
                            <YearCard
                              key={year.id}
                              year={year}
                              onViewDetails={handleViewDetails}
                              onActivate={handleActivateYear}
                              onEdit={handleEditYear}
                              onDelete={handleDeleteYearClick}
                              onArchive={handleArchiveYear}
                              isActivating={activating === year.id}
                              isDeleting={deleting === year.id}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </>
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
      
      <EditYearModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingYear(null); }}
        token={token}
        year={editingYear}
        existingYears={years}
        onSuccess={loadYears}
      />
      
      <DeleteYearModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeletingYear(null); }}
        year={deletingYear}
        token={token}
        onConfirm={handleDeleteYearConfirm}
        loading={deleting === deletingYear?.id}
      />
      
      <PeriodModal
        isOpen={showPeriodModal}
        onClose={() => { setShowPeriodModal(false); setEditingPeriod(null); }}
        token={token}
        period={editingPeriod}
        academicYear={selectedYear}
        onSuccess={handlePeriodSuccess}
      />
    </div>
  );
}
