import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X,
  Loader2, AlertCircle, Check, Clock, Edit2, Trash2, Eye,
  Filter, GraduationCap, Users, Building, Star, Megaphone, BookOpen
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Event types configuration
const EVENT_TYPES = {
  academic: { label: "Académico", color: "#3B82F6", icon: BookOpen, bgClass: "bg-blue-100", textClass: "text-blue-700" },
  institutional: { label: "Institucional", color: "#8B5CF6", icon: Building, bgClass: "bg-purple-100", textClass: "text-purple-700" },
  administrative: { label: "Administrativo", color: "#64748B", icon: Users, bgClass: "bg-slate-100", textClass: "text-slate-700" },
  holiday: { label: "Feriado", color: "#EF4444", icon: Star, bgClass: "bg-red-100", textClass: "text-red-700" },
  special: { label: "Evento especial", color: "#F59E0B", icon: Star, bgClass: "bg-amber-100", textClass: "text-amber-700" },
  communication: { label: "Comunicación", color: "#10B981", icon: Megaphone, bgClass: "bg-emerald-100", textClass: "text-emerald-700" }
};

// View modes
const VIEW_MODES = [
  { id: "month", label: "Mes" },
  { id: "week", label: "Semana" },
  { id: "day", label: "Día" }
];

// Days of week
const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// ══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════
const formatDate = (date) => date.toISOString().split("T")[0];

const getMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  
  // Previous month days
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }
  
  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  
  // Next month days
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }
  
  return days;
};

const getWeekDays = (date) => {
  const days = [];
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({ date: d, isCurrentMonth: true });
  }
  
  return days;
};

// ══════════════════════════════════════════════════════════════════════════════
// EVENT MODAL COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function EventModal({ isOpen, onClose, event, onSave, onDelete, grades, sections, isAdmin }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "academic",
    color: EVENT_TYPES.academic.color,
    start_date: formatDate(new Date()),
    end_date: formatDate(new Date()),
    start_time: "09:00",
    end_time: "10:00",
    all_day: true,
    visibility: { roles: [], grades: [], sections: [] }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || "",
        description: event.description || "",
        type: event.type || "academic",
        color: event.color || EVENT_TYPES[event.type]?.color || "#3B82F6",
        start_date: event.start_date || formatDate(new Date()),
        end_date: event.end_date || formatDate(new Date()),
        start_time: event.start_time || "09:00",
        end_time: event.end_time || "10:00",
        all_day: event.all_day !== false,
        visibility: event.visibility || { roles: [], grades: [], sections: [] }
      });
    } else {
      // Reset for new event
      setFormData(prev => ({
        ...prev,
        title: "",
        description: "",
        type: "academic",
        color: EVENT_TYPES.academic.color,
        all_day: true,
        visibility: { roles: [], grades: [], sections: [] }
      }));
    }
  }, [event, isOpen]);

  const handleTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      type,
      color: EVENT_TYPES[type]?.color || "#3B82F6"
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.title.trim()) {
      setError("El título es requerido");
      return;
    }

    if (formData.start_date > formData.end_date) {
      setError("La fecha de inicio no puede ser posterior a la fecha de fin");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        start_time: formData.all_day ? null : formData.start_time,
        end_time: formData.all_day ? null : formData.end_time
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar evento");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Estás seguro de eliminar este evento?")) return;
    
    setSaving(true);
    try {
      await onDelete(event.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al eliminar evento");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {event?.id ? "Editar Evento" : "Nuevo Evento"}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Nombre del evento"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={!isAdmin}
            />
          </div>

          {/* Type */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Tipo de evento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(EVENT_TYPES).map(([key, type]) => {
                const Icon = type.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTypeChange(key)}
                    disabled={!isAdmin}
                    className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${
                      formData.type === key
                        ? `border-[${type.color}] ${type.bgClass}`
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    style={formData.type === key ? { borderColor: type.color } : {}}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className={`text-sm font-medium ${formData.type === key ? type.textClass : "text-slate-600"}`}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* All day toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.all_day}
                onChange={(e) => setFormData(prev => ({ ...prev, all_day: e.target.checked }))}
                className="w-5 h-5 rounded text-indigo-600"
                disabled={!isAdmin}
              />
              <span className="font-medium text-slate-700">Todo el día</span>
            </label>
          </div>

          {/* Dates */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Fecha inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!isAdmin}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Fecha fin <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!isAdmin}
              />
            </div>
          </div>

          {/* Times (only if not all day) */}
          {!formData.all_day && (
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Hora inicio
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Hora fin
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={!isAdmin}
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción del evento (opcional)"
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              disabled={!isAdmin}
            />
          </div>

          {/* Visibility (admin only) */}
          {isAdmin && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Visibilidad (dejar vacío para todos)
              </label>
              
              {/* Roles */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-2">Por rol:</p>
                <div className="flex flex-wrap gap-2">
                  {["teacher", "student", "parent"].map(role => (
                    <label key={role} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg cursor-pointer border border-slate-200">
                      <input
                        type="checkbox"
                        checked={formData.visibility.roles?.includes(role) || false}
                        onChange={(e) => {
                          const roles = formData.visibility.roles || [];
                          setFormData(prev => ({
                            ...prev,
                            visibility: {
                              ...prev.visibility,
                              roles: e.target.checked
                                ? [...roles, role]
                                : roles.filter(r => r !== role)
                            }
                          }));
                        }}
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      <span className="text-sm text-slate-700 capitalize">
                        {role === "teacher" ? "Profesores" : role === "student" ? "Estudiantes" : "Padres"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Grades */}
              {grades.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-2">Por grado:</p>
                  <select
                    multiple
                    value={formData.visibility.grades || []}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                      setFormData(prev => ({
                        ...prev,
                        visibility: { ...prev.visibility, grades: selected }
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                    size={3}
                  >
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.nivel_nombre} - {g.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            {event?.id && isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Eliminar
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            {isAdmin && (
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {event?.id ? "Actualizar" : "Crear"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DAY EVENTS MODAL
// ══════════════════════════════════════════════════════════════════════════════
function DayEventsModal({ isOpen, onClose, date, events, onEventClick }) {
  if (!isOpen || !date) return null;

  const dateStr = date.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white capitalize">{dateStr}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {events.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No hay eventos este día</p>
          ) : (
            <div className="space-y-3">
              {events.map(event => {
                const typeInfo = EVENT_TYPES[event.type] || {};
                return (
                  <button
                    key={event.id}
                    onClick={() => {
                      onEventClick(event);
                      onClose();
                    }}
                    className="w-full p-4 rounded-xl border-2 text-left hover:shadow-md transition-all"
                    style={{ borderColor: event.color || typeInfo.color }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: event.color || typeInfo.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800">{event.title}</p>
                        <p className="text-sm text-slate-500">
                          {typeInfo.label || event.type}
                          {!event.all_day && event.start_time && ` • ${event.start_time}`}
                        </p>
                        {event.description && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{event.description}</p>
                        )}
                      </div>
                    </div>
                  </button>
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
// CALENDAR GRID COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function CalendarGrid({ days, events, viewMode, onDayClick, onEventClick }) {
  const today = formatDate(new Date());
  
  const getEventsForDate = (date) => {
    const dateStr = formatDate(date);
    return events.filter(e => {
      return dateStr >= e.start_date && dateStr <= e.end_date;
    });
  };

  const maxVisibleEvents = viewMode === "month" ? 3 : 10;

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {(viewMode === "month" ? DAYS_SHORT : DAYS_FULL).map((day, i) => (
          <div key={i} className="px-2 py-3 text-center text-sm font-semibold text-slate-600">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className={`grid grid-cols-7 ${viewMode === "month" ? "" : "min-h-[400px]"}`}>
        {days.map(({ date, isCurrentMonth }, idx) => {
          const dateStr = formatDate(date);
          const isToday = dateStr === today;
          const dayEvents = getEventsForDate(date);
          const visibleEvents = dayEvents.slice(0, maxVisibleEvents);
          const hiddenCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={idx}
              onClick={() => onDayClick(date, dayEvents)}
              className={`min-h-[100px] p-2 border-b border-r border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${
                !isCurrentMonth ? "bg-slate-50/50" : ""
              } ${isToday ? "bg-indigo-50/50" : ""}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                  isToday
                    ? "bg-indigo-600 text-white"
                    : isCurrentMonth
                    ? "text-slate-700"
                    : "text-slate-400"
                }`}>
                  {date.getDate()}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {visibleEvents.map(event => {
                  const typeInfo = EVENT_TYPES[event.type] || {};
                  return (
                    <button
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className="w-full px-2 py-1 rounded text-xs font-medium text-white truncate text-left hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: event.color || typeInfo.color || "#64748B" }}
                      title={`${event.title} - ${typeInfo.label || event.type}`}
                    >
                      {event.title}
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayClick(date, dayEvents);
                    }}
                    className="w-full px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                  >
                    +{hiddenCount} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function CalendarPage({ user, token, subdomain, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  
  // Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayModalEvents, setDayModalEvents] = useState([]);
  
  // Academic data for visibility
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  const isAdmin = ["owner", "admin", "director"].includes(user?.role);

  // Calculate days based on view mode
  const calendarDays = useMemo(() => {
    if (viewMode === "week") {
      return getWeekDays(currentDate);
    }
    return getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate, viewMode]);

  // Calculate date range for API
  const dateRange = useMemo(() => {
    if (viewMode === "day") {
      const d = formatDate(currentDate);
      return { start: d, end: d };
    }
    
    const firstDay = calendarDays[0]?.date;
    const lastDay = calendarDays[calendarDays.length - 1]?.date;
    
    return {
      start: firstDay ? formatDate(firstDay) : formatDate(currentDate),
      end: lastDay ? formatDate(lastDay) : formatDate(currentDate)
    };
  }, [calendarDays, currentDate, viewMode]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [dateRange, typeFilter]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, gradesRes, sectionsRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers })
      ]);
      setSettings(settingsRes.data);
      setGrades(gradesRes.data.filter(g => g.activo));
      setSections(sectionsRes.data.filter(s => s.activo));
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const params = {
        start_date: dateRange.start,
        end_date: dateRange.end
      };
      if (typeFilter) {
        params.event_type = typeFilter;
      }
      
      const res = await axios.get(`${API}/calendar/events`, { headers, params });
      setEvents(res.data);
    } catch (err) {
      console.error("Error loading events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date, dayEvents) => {
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setDayModalEvents(dayEvents);
      setShowDayModal(true);
    } else if (isAdmin) {
      // Open create modal with date pre-filled
      setSelectedEvent({
        start_date: formatDate(date),
        end_date: formatDate(date)
      });
      setShowEventModal(true);
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleSaveEvent = async (eventData) => {
    if (selectedEvent?.id) {
      // Update
      await axios.put(`${API}/calendar/events/${selectedEvent.id}`, eventData, { headers });
    } else {
      // Create
      await axios.post(`${API}/calendar/events`, eventData, { headers });
    }
    loadEvents();
  };

  const handleDeleteEvent = async (eventId) => {
    await axios.delete(`${API}/calendar/events/${eventId}`, { headers });
    loadEvents();
  };

  const handleCreateNew = () => {
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  // Title based on view mode
  const calendarTitle = useMemo(() => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
    if (viewMode === "week") {
      const start = calendarDays[0]?.date;
      const end = calendarDays[6]?.date;
      if (start && end) {
        return `${start.getDate()} - ${end.getDate()} de ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      }
    }
    return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate, viewMode, calendarDays]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="calendar-page">
      <Sidebar 
        user={user} 
        settings={settings} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
        />

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {/* Page Title */}
          <div className="relative overflow-hidden rounded-3xl mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
            <div className="relative px-8 py-10 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                  <CalendarIcon className="w-10 h-10 text-indigo-600" />
                </div>
                <div className="text-white">
                  <h1 className="text-4xl font-bold tracking-tight mb-2">Calendario</h1>
                  <p className="text-indigo-200 text-lg">Actividades y eventos del colegio</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={handleCreateNew}
                  className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2 shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Evento
                </button>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-slate-600" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-medium hover:bg-indigo-200 transition-colors"
                >
                  Hoy
                </button>
                <button
                  onClick={handleNext}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <ChevronRight className="w-6 h-6 text-slate-600" />
                </button>
                <h2 className="text-xl font-bold text-slate-800 ml-4 capitalize">
                  {calendarTitle}
                </h2>
                {loadingEvents && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin ml-2" />}
              </div>

              {/* View mode & Filter */}
              <div className="flex items-center gap-4">
                {/* Type filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-slate-400" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todos los tipos</option>
                    {Object.entries(EVENT_TYPES).map(([key, type]) => (
                      <option key={key} value={key}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* View mode */}
                <div className="flex bg-slate-100 rounded-xl p-1">
                  {VIEW_MODES.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setViewMode(mode.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        viewMode === mode.id
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Event type legend */}
          <div className="flex flex-wrap gap-3 mb-6">
            {Object.entries(EVENT_TYPES).map(([key, type]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(typeFilter === key ? "" : key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                  typeFilter === key
                    ? `${type.bgClass} ${type.textClass} font-medium`
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: type.color }}
                />
                {type.label}
              </button>
            ))}
          </div>

          {/* Calendar Grid */}
          {viewMode === "day" ? (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">
                Eventos del {currentDate.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              {events.filter(e => {
                const d = formatDate(currentDate);
                return d >= e.start_date && d <= e.end_date;
              }).length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-500">No hay eventos este día</p>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setSelectedEvent({
                          start_date: formatDate(currentDate),
                          end_date: formatDate(currentDate)
                        });
                        setShowEventModal(true);
                      }}
                      className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600"
                    >
                      Crear evento
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {events.filter(e => {
                    const d = formatDate(currentDate);
                    return d >= e.start_date && d <= e.end_date;
                  }).map(event => {
                    const typeInfo = EVENT_TYPES[event.type] || {};
                    return (
                      <button
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className="w-full p-4 rounded-xl border-l-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                        style={{ borderLeftColor: event.color || typeInfo.color }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-slate-800">{event.title}</p>
                            <p className="text-sm text-slate-500">
                              {typeInfo.label || event.type}
                              {!event.all_day && event.start_time && ` • ${event.start_time} - ${event.end_time}`}
                            </p>
                            {event.description && (
                              <p className="text-sm text-slate-600 mt-2">{event.description}</p>
                            )}
                          </div>
                          {isAdmin && (
                            <Edit2 className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <CalendarGrid
              days={calendarDays}
              events={events}
              viewMode={viewMode}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          )}
        </main>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        grades={grades}
        sections={sections}
        isAdmin={isAdmin}
      />

      {/* Day Events Modal */}
      <DayEventsModal
        isOpen={showDayModal}
        onClose={() => {
          setShowDayModal(false);
          setSelectedDate(null);
          setDayModalEvents([]);
        }}
        date={selectedDate}
        events={dayModalEvents}
        onEventClick={handleEventClick}
      />
    </div>
  );
}
