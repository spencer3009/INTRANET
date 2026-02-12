import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Calendar, Plus, Check, X, ChevronRight, Loader2, 
  AlertCircle, Copy, Lock, Clock, Unlock, CalendarDays,
  ChevronDown, Edit2, Trash2, ArrowLeft, Settings,
  PlayCircle, PauseCircle, CalendarRange
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
// YEAR CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function YearCard({ year, onActivate, onViewDetails, onDelete, isDeleting }) {
  const StatusIcon = STATUS_ICONS[year.status];
  
  return (
    <div 
      onClick={() => onViewDetails(year)}
      className={`bg-white rounded-2xl border-2 transition-all hover:shadow-lg cursor-pointer ${
        year.status === "activo" 
          ? "border-emerald-300 shadow-emerald-100" 
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
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
              onClick={(e) => { e.stopPropagation(); onActivate(year); }}
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
              onClick={(e) => { e.stopPropagation(); onViewDetails(year); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              Gestionar
              <ChevronRight className="w-4 h-4" />
            </button>
            
            {year.status !== "activo" && year.period_count === 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(year); }}
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
  
  const handleDeleteYear = async (year) => {
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
              // List View
              <>
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
                          onActivate={handleActivateYear}
                          onViewDetails={handleViewDetails}
                          onDelete={handleDeleteYear}
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
                              onActivate={handleActivateYear}
                              onViewDetails={handleViewDetails}
                              onDelete={handleDeleteYear}
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
                              onActivate={handleActivateYear}
                              onViewDetails={handleViewDetails}
                              onDelete={handleDeleteYear}
                              isDeleting={deleting === year.id}
                            />
                          ))}
                        </div>
                      </div>
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
