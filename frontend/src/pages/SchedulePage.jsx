import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import ConfirmModal from "../components/ConfirmModal";
import { TimePicker } from "../components/ui/time-picker";
import { Combobox } from "../components/ui/combobox";
import { 
  Calendar, Clock, BookOpen, GraduationCap, Users, 
  Plus, Pencil, Trash2, Loader2, X, Check, AlertCircle,
  ChevronRight, ArrowLeft, FileText, CalendarDays, Settings,
  ChevronDown, AlertTriangle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tab configurations
const SCHEDULE_TABS = [
  { id: "clases", label: "Horario de Clases", icon: Calendar, description: "Horarios por grado y sección" },
  { id: "profesores", label: "Horario de Profesores", icon: GraduationCap, description: "Horarios por profesor" },
  { id: "examenes", label: "Horario de Exámenes", icon: FileText, description: "Calendario de evaluaciones" }
];

// All days of the week (full list)
const ALL_DAYS = [
  { id: "lunes", label: "Lunes", short: "Lun" },
  { id: "martes", label: "Martes", short: "Mar" },
  { id: "miercoles", label: "Miércoles", short: "Mié" },
  { id: "jueves", label: "Jueves", short: "Jue" },
  { id: "viernes", label: "Viernes", short: "Vie" },
  { id: "sabado", label: "Sábado", short: "Sáb" },
  { id: "domingo", label: "Domingo", short: "Dom" }
];

// Function to get visible days based on settings
const getVisibleDays = (settings) => {
  let days = ALL_DAYS.slice(0, 5); // Lunes a Viernes por defecto
  if (settings?.include_saturday) {
    days = [...days, ALL_DAYS[5]];
  }
  if (settings?.include_sunday) {
    days = [...days, ALL_DAYS[6]];
  }
  return days;
};

// Color palette for subjects
const SUBJECT_COLORS = [
  { name: "Azul", value: "#3B82F6", bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  { name: "Verde", value: "#10B981", bg: "bg-emerald-500", light: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  { name: "Naranja", value: "#F59E0B", bg: "bg-amber-500", light: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  { name: "Rojo", value: "#EF4444", bg: "bg-red-500", light: "bg-red-100", text: "text-red-700", border: "border-red-300" },
  { name: "Morado", value: "#8B5CF6", bg: "bg-violet-500", light: "bg-violet-100", text: "text-violet-700", border: "border-violet-300" },
  { name: "Rosa", value: "#EC4899", bg: "bg-pink-500", light: "bg-pink-100", text: "text-pink-700", border: "border-pink-300" },
  { name: "Cyan", value: "#06B6D4", bg: "bg-cyan-500", light: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-300" },
  { name: "Índigo", value: "#6366F1", bg: "bg-indigo-500", light: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300" },
  { name: "Teal", value: "#14B8A6", bg: "bg-teal-500", light: "bg-teal-100", text: "text-teal-700", border: "border-teal-300" },
  { name: "Slate", value: "#64748B", bg: "bg-slate-500", light: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" }
];

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS MODAL - Configuration for schedule hours
// ══════════════════════════════════════════════════════════════════════════════
function ScheduleSettingsModal({ isOpen, onClose, settings, onSave, loading }) {
  const [form, setForm] = useState({
    start_hour: "07:00",
    end_hour: "18:00",
    time_format: "24h",
    block_duration: 45,
    view_mode: "horizontal",
    include_saturday: false,
    include_sunday: false
  });

  useEffect(() => {
    if (isOpen && settings) {
      setForm({
        start_hour: settings.start_hour || "07:00",
        end_hour: settings.end_hour || "18:00",
        time_format: settings.time_format || "24h",
        block_duration: settings.block_duration || 45,
        view_mode: settings.view_mode || "horizontal",
        include_saturday: settings.include_saturday || false,
        include_sunday: settings.include_sunday || false
      });
    }
  }, [isOpen, settings]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  // Generate hour options
  const hourOptions = [];
  for (let h = 0; h < 24; h++) {
    const hour = h.toString().padStart(2, '0') + ':00';
    hourOptions.push(hour);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="schedule-settings-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-700 to-slate-800 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Configuración de Horarios</h3>
              <p className="text-white/70 text-sm">Ajusta las horas del calendario</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Time Range */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Rango de horas visibles
            </label>
            <div className="grid grid-cols-2 gap-4">
              <TimePicker
                label="Desde"
                value={form.start_hour}
                onChange={(val) => setForm(p => ({ ...p, start_hour: val }))}
                data-testid="settings-start-hour"
              />
              <TimePicker
                label="Hasta"
                value={form.end_hour}
                onChange={(val) => setForm(p => ({ ...p, end_hour: val }))}
                data-testid="settings-end-hour"
              />
            </div>
          </div>

          {/* Time Format */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Formato de hora
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, time_format: "12h" }))}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  form.time_format === "12h" 
                    ? "border-blue-500 bg-blue-50 text-blue-700" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-semibold">12 horas</p>
                <p className="text-sm opacity-70">2:00 PM</p>
              </button>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, time_format: "24h" }))}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  form.time_format === "24h" 
                    ? "border-blue-500 bg-blue-50 text-blue-700" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-semibold">24 horas</p>
                <p className="text-sm opacity-70">14:00</p>
              </button>
            </div>
          </div>

          {/* Block Duration */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Duración de bloque (minutos)
            </label>
            <div className="flex gap-2">
              {[30, 45, 60, 90].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, block_duration: mins }))}
                  className={`flex-1 px-3 py-2.5 rounded-xl border-2 font-medium transition-all ${
                    form.block_duration === mins 
                      ? "border-blue-500 bg-blue-50 text-blue-700" 
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* View Mode */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Modo de vista
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="settings-view-horizontal"
                onClick={() => setForm(p => ({ ...p, view_mode: "horizontal" }))}
                className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                  form.view_mode === "horizontal"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <div className="text-center">
                  <span className="block text-sm">Horizontal</span>
                  <span className="block text-xs text-slate-500 mt-1">7:00 AM - 8:00 AM</span>
                </div>
              </button>
              <button
                type="button"
                data-testid="settings-view-vertical"
                onClick={() => setForm(p => ({ ...p, view_mode: "vertical" }))}
                className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                  form.view_mode === "vertical"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <div className="text-center">
                  <span className="block text-sm">Vertical</span>
                  <span className="block text-xs text-slate-500 mt-1">07:00, 08:00...</span>
                </div>
              </button>
            </div>
          </div>

          {/* Days Configuration */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Días visibles
            </label>
            <p className="text-xs text-slate-500 mb-3">Lunes a Viernes siempre están visibles</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="settings-saturday"
                  checked={form.include_saturday}
                  onChange={(e) => setForm(p => ({ ...p, include_saturday: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Sábado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="settings-sunday"
                  checked={form.include_sunday}
                  onChange={(e) => setForm(p => ({ ...p, include_sunday: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Domingo</span>
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              data-testid="settings-cancel-btn"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="settings-save-btn"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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
// SCHEDULE ENTRY MODAL - Add/Edit class
// ══════════════════════════════════════════════════════════════════════════════
function ScheduleEntryModal({ isOpen, onClose, token, entry, onSuccess, grades, sections, teachers, type, preselectedData, existingSchedules, settings }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  
  const [form, setForm] = useState({
    grado_id: "",
    seccion_id: "",
    profesor_id: "",
    materia: "",
    subject_id: "",
    dia: "",
    hora_inicio: "",
    hora_fin: "",
    aula: "",
    color: SUBJECT_COLORS[0].value
  });

  const isEdit = !!entry;
  const headers = { Authorization: `Bearer ${token}` };

  // Generate time options based on settings
  const generateTimeOptions = useCallback(() => {
    const options = [];
    const startHour = parseInt(settings?.start_hour?.split(':')[0] || '7');
    const endHour = parseInt(settings?.end_hour?.split(':')[0] || '18');
    const blockDuration = settings?.block_duration || 45;
    
    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += blockDuration) {
        if (h === endHour && m > 0) break;
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  }, [settings]);

  const timeOptions = generateTimeOptions();

  // Load subjects when PROFESOR + GRADO + SECCION change
  useEffect(() => {
    const loadTeacherSubjects = async () => {
      // Need all three: profesor, grado, seccion
      if (!form.profesor_id || !form.grado_id || !form.seccion_id) {
        setSubjects([]);
        return;
      }
      
      setLoadingSubjects(true);
      try {
        const res = await axios.get(
          `${API}/academic/teacher-subjects?teacher_id=${form.profesor_id}&grade_id=${form.grado_id}&section_id=${form.seccion_id}`, 
          { headers }
        );
        setSubjects(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error loading teacher subjects:", err);
        setSubjects([]);
      } finally {
        setLoadingSubjects(false);
      }
    };
    
    loadTeacherSubjects();
  }, [form.profesor_id, form.grado_id, form.seccion_id, token]);

  // Filter subjects by search
  const filteredSubjects = subjects.filter(s => 
    s.name?.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  // Handle subject selection
  const handleSelectSubject = (subject) => {
    setForm(p => ({ 
      ...p, 
      materia: subject.name,
      subject_id: subject.id,
      color: subject.color || p.color
    }));
    setSubjectSearch("");
    setShowSubjectDropdown(false);
  };

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setForm({
          grado_id: entry.grado_id || "",
          seccion_id: entry.seccion_id || "",
          profesor_id: entry.profesor_id || "",
          materia: entry.materia || "",
          subject_id: entry.subject_id || "",
          dia: entry.dia || "",
          hora_inicio: entry.hora_inicio || "",
          hora_fin: entry.hora_fin || "",
          aula: entry.aula || "",
          color: entry.color || SUBJECT_COLORS[0].value
        });
      } else {
        setForm({
          grado_id: preselectedData?.grado_id || "",
          seccion_id: preselectedData?.seccion_id || "",
          profesor_id: preselectedData?.profesor_id || "",
          materia: "",
          subject_id: "",
          dia: preselectedData?.dia || "",
          hora_inicio: preselectedData?.hora_inicio || "",
          hora_fin: "",
          aula: "",
          color: SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)].value
        });
      }
      setError("");
      setConflicts([]);
      setSubjectSearch("");
      setShowSubjectDropdown(false);
    }
  }, [isOpen, entry, preselectedData]);

  // Check for conflicts
  const checkConflicts = useCallback(() => {
    if (!form.dia || !form.hora_inicio || !form.hora_fin) return [];
    
    const newStart = form.hora_inicio;
    const newEnd = form.hora_fin;
    const foundConflicts = [];
    
    existingSchedules?.forEach(schedule => {
      // Skip self when editing
      if (isEdit && schedule.id === entry?.id) return;
      
      // Check same day
      if (schedule.dia !== form.dia) return;
      
      const existStart = schedule.hora_inicio;
      const existEnd = schedule.hora_fin;
      
      // Check time overlap
      const hasOverlap = (newStart < existEnd && newEnd > existStart);
      
      if (hasOverlap) {
        // Check specific conflict types
        if (form.profesor_id && schedule.profesor_id === form.profesor_id) {
          foundConflicts.push({
            type: "teacher",
            message: `El profesor ya tiene clase de ${schedule.materia} a esta hora`,
            schedule
          });
        }
        if (form.aula && schedule.aula && schedule.aula === form.aula) {
          foundConflicts.push({
            type: "room",
            message: `El aula ${form.aula} ya está ocupada con ${schedule.materia}`,
            schedule
          });
        }
        if (form.grado_id === schedule.grado_id && form.seccion_id === schedule.seccion_id) {
          foundConflicts.push({
            type: "section",
            message: `Esta sección ya tiene ${schedule.materia} a esta hora`,
            schedule
          });
        }
      }
    });
    
    return foundConflicts;
  }, [form, existingSchedules, isEdit, entry]);

  // Update conflicts when form changes
  useEffect(() => {
    const c = checkConflicts();
    setConflicts(c);
  }, [checkConflicts]);

  // Filter sections by grade
  const filteredSections = sections.filter(s => s.grado_id === form.grado_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validations
    if (!form.materia.trim()) {
      setError("Selecciona una materia");
      return;
    }
    if (!form.dia) {
      setError("Selecciona el día");
      return;
    }
    if (!form.hora_inicio || !form.hora_fin) {
      setError("Selecciona hora de inicio y fin");
      return;
    }
    if (form.hora_inicio >= form.hora_fin) {
      setError("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    if (type === "clases" && !form.profesor_id) {
      setError("Selecciona el profesor");
      return;
    }
    
    // Block if there are conflicts
    if (conflicts.length > 0) {
      setError("Resuelve los conflictos antes de guardar");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form, tipo: type };
      
      if (isEdit) {
        await axios.put(`${API}/schedules/${entry.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/schedules`, payload, { headers });
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      // Handle new error format with conflicts array
      const errorDetail = err.response?.data?.detail;
      if (typeof errorDetail === 'object' && errorDetail.message) {
        setError(errorDetail.message);
      } else {
        setError(errorDetail || "Error al guardar el horario");
      }
    } finally {
      setLoading(false);
    }
  };

  // Format time for display
  const formatTime = (time) => {
    if (!time || settings?.time_format === "24h") return time;
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="schedule-entry-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 sticky top-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {isEdit ? "Editar Horario" : "Agregar Horario"}
                </h3>
                <p className="text-white/70 text-sm">
                  {type === "clases" ? "Horario de clase" : type === "profesores" ? "Horario de profesor" : "Horario de examen"}
                </p>
              </div>
            </div>
            <button data-testid="entry-modal-close" onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Conflicts Warning */}
          {conflicts.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
                <AlertTriangle className="w-5 h-5" />
                Conflictos detectados
              </div>
              <ul className="space-y-1">
                {conflicts.map((c, i) => (
                  <li key={i} className="text-sm text-amber-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grade & Section (for classes) */}
          {type === "clases" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Grado</label>
                <select
                  value={form.grado_id}
                  onChange={(e) => setForm(p => ({ ...p, grado_id: e.target.value, seccion_id: "" }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              </div>
              <Combobox
                label="Sección"
                value={form.seccion_id}
                onChange={(val) => setForm(p => ({ ...p, seccion_id: val }))}
                placeholder="Seleccionar sección..."
                searchPlaceholder="Buscar sección..."
                disabled={!form.grado_id}
                required
                emptyMessage="No hay secciones para este grado"
                options={filteredSections.map(s => ({
                  id: s.id,
                  label: s.nombre,
                  sublabel: s.turno || s.nivel || "",
                  color: s.color || "#6366F1"
                }))}
              />
            </div>
          )}

          {/* Teacher - MUST be selected before Subject */}
          {type === "clases" && (
            <Combobox
              label="Profesor"
              value={form.profesor_id}
              onChange={(val) => setForm(p => ({ ...p, profesor_id: val, materia: "", subject_id: "" }))}
              placeholder="Seleccionar profesor..."
              searchPlaceholder="Buscar profesor..."
              required
              disabled={!form.grado_id || !form.seccion_id}
              emptyMessage="No hay profesores disponibles"
              options={teachers.map(t => ({
                id: t.id,
                label: `${t.name} ${t.last_name || ""}`.trim(),
                sublabel: t.email || t.specialty || "",
                image: t.profile_image || t.photo_url || null
              }))}
            />
          )}

          {/* Subject with Smart Select - Filtered by Profesor + Grado + Seccion */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Materia / Asignatura <span className="text-red-500">*</span>
            </label>
            
            {(!form.grado_id || !form.seccion_id || !form.profesor_id) && type === "clases" ? (
              <div className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {!form.grado_id ? "Primero selecciona un grado" : 
                 !form.seccion_id ? "Selecciona una sección" :
                 "Selecciona un profesor"}
              </div>
            ) : (
              <div className="relative">
                <div 
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                    showSubjectDropdown ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => !form.materia && setShowSubjectDropdown(true)}
                >
                  {form.materia ? (
                    <>
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: form.color }} />
                      <span className="flex-1 text-slate-800 font-medium">{form.materia}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm(p => ({ ...p, materia: "", subject_id: "" }));
                        }}
                        className="p-1 hover:bg-slate-200 rounded-full"
                      >
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={subjectSearch}
                        onChange={(e) => {
                          setSubjectSearch(e.target.value);
                          setShowSubjectDropdown(true);
                        }}
                        onFocus={() => setShowSubjectDropdown(true)}
                        className="flex-1 bg-transparent border-0 focus:outline-none text-sm"
                        placeholder="Buscar asignatura..."
                      />
                      {loadingSubjects && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                    </>
                  )}
                </div>
                
                {/* Dropdown */}
                {showSubjectDropdown && !form.materia && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {loadingSubjects ? (
                      <div className="p-4 text-center text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Cargando...
                      </div>
                    ) : filteredSubjects.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        {subjects.length === 0 ? "Este profesor no tiene asignaturas en esta sección" : "Sin resultados"}
                      </div>
                    ) : (
                      filteredSubjects.map(subject => {
                        return (
                          <button
                            key={subject.id}
                            type="button"
                            onClick={() => handleSelectSubject(subject)}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors"
                          >
                            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color || '#6366F1' }} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800">{subject.name}</p>
                              {subject.role && <p className="text-xs text-slate-500">{subject.role === 'titular' ? 'Titular' : 'Auxiliar'}</p>}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
            
            {showSubjectDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowSubjectDropdown(false)} />}
          </div>

          {/* Day */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Día <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
              {getVisibleDays(settings).map(day => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, dia: day.id }))}
                  className={`px-2 py-3 rounded-xl border-2 text-center transition-all ${
                    form.dia === day.id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <p className="font-semibold text-sm">{day.short}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <TimePicker
              label="Hora inicio *"
              value={form.hora_inicio}
              onChange={(val) => setForm(p => ({ ...p, hora_inicio: val }))}
            />
            <TimePicker
              label="Hora fin *"
              value={form.hora_fin}
              onChange={(val) => setForm(p => ({ ...p, hora_fin: val }))}
            />
          </div>

          {/* Room */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Aula (opcional)</label>
            <input
              type="text"
              value={form.aula}
              onChange={(e) => setForm(p => ({ ...p, aula: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: A-101, Laboratorio, etc."
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, color: c.value }))}
                  className={`w-8 h-8 rounded-full transition-all ${
                    form.color === c.value ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              data-testid="entry-cancel-btn"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="entry-submit-btn"
              disabled={loading || conflicts.length > 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {isEdit ? "Guardar" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR GRID - Professional weekly view (supports horizontal & vertical modes)
// ══════════════════════════════════════════════════════════════════════════════
function CalendarGrid({ schedules, settings, onEdit, onDelete, onCellClick, teachers, sections }) {
  // Get visible days based on settings
  const visibleDays = getVisibleDays(settings);
  const viewMode = settings?.view_mode || "horizontal";
  
  // Generate time slots based on settings
  const generateTimeSlots = useCallback(() => {
    const slots = [];
    const startHour = parseInt(settings?.start_hour?.split(':')[0] || '7');
    const endHour = parseInt(settings?.end_hour?.split(':')[0] || '18');
    
    for (let h = startHour; h < endHour; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, [settings]);

  const timeSlots = generateTimeSlots();

  // Format time for display based on mode
  const formatTime = (time) => {
    if (!time) return time;
    if (settings?.time_format === "12h") {
      const [h, m] = time.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${m} ${ampm}`;
    }
    return time;
  };

  // Format time range for horizontal mode (e.g., "7:00 AM - 8:00 AM")
  const formatTimeRange = (time) => {
    const [h] = time.split(':');
    const hour = parseInt(h);
    const nextHour = hour + 1;
    
    if (settings?.time_format === "12h") {
      const ampm1 = hour >= 12 ? 'PM' : 'AM';
      const ampm2 = nextHour >= 12 ? 'PM' : 'AM';
      const hour12_1 = hour % 12 || 12;
      const hour12_2 = nextHour % 12 || 12;
      return `${hour12_1}:00 ${ampm1} - ${hour12_2}:00 ${ampm2}`;
    }
    return `${time} - ${nextHour.toString().padStart(2, '0')}:00`;
  };

  // Get color style
  const getColorStyle = (color) => {
    return {
      backgroundColor: color || '#6366F1',
      borderColor: color || '#6366F1'
    };
  };

  // Calculate block position and height (for vertical mode)
  const getBlockStyle = (schedule) => {
    const startHour = parseInt(settings?.start_hour?.split(':')[0] || '7');
    const [startH, startM] = schedule.hora_inicio.split(':').map(Number);
    const [endH, endM] = schedule.hora_fin.split(':').map(Number);
    
    const startMinutes = (startH - startHour) * 60 + startM;
    const duration = (endH * 60 + endM) - (startH * 60 + startM);
    
    const top = (startMinutes / 60) * 64; // 64px per hour
    const height = Math.max((duration / 60) * 64, 32); // Min 32px height
    
    return {
      top: `${top}px`,
      height: `${height}px`,
      minHeight: '32px'
    };
  };

  // Group schedules by day
  const schedulesByDay = {};
  ALL_DAYS.forEach(d => { schedulesByDay[d.id] = []; });
  schedules.forEach(s => {
    if (schedulesByDay[s.dia]) {
      schedulesByDay[s.dia].push(s);
    }
  });

  // Get schedules for a specific time slot and day (for horizontal mode)
  const getSchedulesForSlot = (day, timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return schedulesByDay[day].filter(s => {
      const [startH] = s.hora_inicio.split(':').map(Number);
      const [endH] = s.hora_fin.split(':').map(Number);
      return slotHour >= startH && slotHour < endH;
    });
  };

  // Check if schedule starts at this slot (for horizontal mode)
  const scheduleStartsAtSlot = (schedule, timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    const [startH] = schedule.hora_inicio.split(':').map(Number);
    return slotHour === startH;
  };

  // HORIZONTAL MODE - Time ranges as rows, days as columns
  if (viewMode === "horizontal") {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="schedule-calendar-grid">
        {/* Header - Days */}
        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
          {/* Time column header */}
          <div className="w-36 flex-shrink-0 p-3 border-r border-slate-200 flex items-center justify-center">
            <Clock className="w-5 h-5 text-slate-400" />
          </div>
          
          {/* Day headers */}
          {visibleDays.map(day => (
            <div key={day.id} data-testid={`schedule-day-header-${day.id}`} className="flex-1 p-3 text-center border-r last:border-r-0 border-slate-200 min-w-[140px]">
              <p className="font-bold text-slate-800">{day.label}</p>
              <p className="text-xs text-slate-500">{schedulesByDay[day.id].length} clases</p>
            </div>
          ))}
        </div>

        {/* Grid Body - Time ranges as rows */}
        <div className="overflow-x-auto">
          {timeSlots.map((time, idx) => (
            <div key={time} className="flex border-b border-slate-100 min-h-[64px]">
              {/* Time range cell */}
              <div 
                className="w-36 flex-shrink-0 px-2 py-2 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 flex items-center justify-center"
                data-testid={`schedule-time-slot-${time.replace(':', '')}`}
              >
                <span className="text-xs font-medium text-slate-600 text-center leading-tight">
                  {formatTimeRange(time)}
                </span>
              </div>
              
              {/* Day cells */}
              {visibleDays.map(day => {
                const slotSchedules = getSchedulesForSlot(day.id, time);
                
                return (
                  <div 
                    key={`${day.id}-${time}`}
                    data-testid={`schedule-cell-${day.id}-${time.replace(':', '')}`}
                    className="flex-1 min-w-[180px] border-r last:border-r-0 border-slate-100 hover:bg-blue-50/30 cursor-pointer transition-colors p-1"
                    onClick={() => onCellClick(day.id, time)}
                  >
                    {slotSchedules.map(schedule => {
                      // Only render if this is the start slot
                      if (!scheduleStartsAtSlot(schedule, time)) return null;
                      
                      const teacher = teachers?.find(t => t.id === schedule.profesor_id);
                      const section = sections?.find(s => s.id === schedule.seccion_id);
                      const studentCount = section?.student_count || section?.students_count || 0;
                      const [startH] = schedule.hora_inicio.split(':').map(Number);
                      const [endH] = schedule.hora_fin.split(':').map(Number);
                      const spanRows = endH - startH;
                      const teacherFullName = teacher ? `${teacher.name} ${teacher.last_name || ''}`.trim() : '';
                      const teacherPhoto = teacher?.profile_image || teacher?.photo_url;
                      
                      return (
                        <div
                          key={schedule.id}
                          data-testid={`schedule-block-${schedule.id}`}
                          className="rounded-xl shadow-sm overflow-hidden cursor-pointer group transition-all hover:shadow-lg relative"
                          style={{
                            ...getColorStyle(schedule.color),
                            minHeight: spanRows > 1 ? `${spanRows * 64 - 8}px` : '70px'
                          }}
                          onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}
                        >
                          <div className="h-full p-2.5 flex flex-col text-white">
                            {/* Subject name */}
                            <p className="font-bold text-sm truncate mb-1">{schedule.materia}</p>
                            
                            {/* Teacher with photo */}
                            {teacher && (
                              <div className="flex items-center gap-2 mb-1">
                                {teacherPhoto ? (
                                  <img 
                                    src={teacherPhoto} 
                                    alt={teacherFullName}
                                    className="w-6 h-6 rounded-full object-cover border border-white/30 flex-shrink-0"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-3 h-3 text-white/80" />
                                  </div>
                                )}
                                <span className="text-xs opacity-95 truncate">{teacherFullName}</span>
                              </div>
                            )}
                            
                            {/* Students count & room */}
                            <div className="flex items-center gap-2 text-[10px] opacity-80 mt-auto">
                              {studentCount > 0 && (
                                <span className="flex items-center gap-1 bg-white/15 px-1.5 py-0.5 rounded">
                                  <GraduationCap className="w-3 h-3" />
                                  {studentCount} alumnos
                                </span>
                              )}
                              {schedule.aula && (
                                <span className="truncate">{schedule.aula}</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Hover actions */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button
                              data-testid={`schedule-edit-btn-${schedule.id}`}
                              onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}
                              className="p-1 bg-white/90 rounded shadow hover:bg-white"
                            >
                              <Pencil className="w-3 h-3 text-slate-700" />
                            </button>
                            <button
                              data-testid={`schedule-delete-btn-${schedule.id}`}
                              onClick={(e) => { e.stopPropagation(); onDelete(schedule); }}
                              className="p-1 bg-white/90 rounded shadow hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // VERTICAL MODE - Original view (time column on left, days as columns with positioned blocks)
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="schedule-calendar-grid">
      {/* Header - Days */}
      <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        {/* Time column header */}
        <div className="w-20 flex-shrink-0 p-3 border-r border-slate-200 flex items-center justify-center">
          <Clock className="w-5 h-5 text-slate-400" />
        </div>
        
        {/* Day headers */}
        {visibleDays.map(day => (
          <div key={day.id} data-testid={`schedule-day-header-${day.id}`} className="flex-1 p-3 text-center border-r last:border-r-0 border-slate-200 min-w-[120px]">
            <p className="font-bold text-slate-800">{day.label}</p>
            <p className="text-xs text-slate-500">{schedulesByDay[day.id].length} clases</p>
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="flex overflow-x-auto">
        {/* Time column - Sticky */}
        <div className="w-20 flex-shrink-0 border-r border-slate-200 bg-slate-50 sticky left-0 z-10" data-testid="schedule-time-column">
          {timeSlots.map((time) => (
            <div 
              key={time} 
              className="h-16 px-2 flex items-start justify-center pt-1 border-b border-slate-100 text-xs font-medium text-slate-500"
              data-testid={`schedule-time-slot-${time.replace(':', '')}`}
            >
              {formatTime(time)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {visibleDays.map(day => (
          <div 
            key={day.id} 
            data-testid={`schedule-day-column-${day.id}`}
            className="flex-1 min-w-[160px] border-r last:border-r-0 border-slate-200 relative"
            style={{ height: `${timeSlots.length * 64}px` }}
          >
            {/* Hour lines */}
            {timeSlots.map((time, idx) => (
              <div 
                key={time}
                data-testid={`schedule-cell-${day.id}-${time.replace(':', '')}`}
                className="absolute w-full h-16 border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer transition-colors"
                style={{ top: `${idx * 64}px` }}
                onClick={() => onCellClick(day.id, time)}
              />
            ))}

            {/* Schedule blocks */}
            {schedulesByDay[day.id].map(schedule => {
              const teacher = teachers?.find(t => t.id === schedule.profesor_id);
              const section = sections?.find(s => s.id === schedule.seccion_id);
              const studentCount = section?.student_count || section?.students_count || 0;
              const blockStyle = getBlockStyle(schedule);
              const teacherFullName = teacher ? `${teacher.name} ${teacher.last_name || ''}`.trim() : '';
              const teacherPhoto = teacher?.profile_image || teacher?.photo_url;
              
              return (
                <div
                  key={schedule.id}
                  data-testid={`schedule-block-${schedule.id}`}
                  className="absolute left-1 right-1 rounded-xl shadow-md overflow-hidden cursor-pointer group transition-all hover:shadow-lg hover:scale-[1.02] z-20"
                  style={{
                    ...blockStyle,
                    ...getColorStyle(schedule.color)
                  }}
                  onClick={() => onEdit(schedule)}
                >
                  <div className="h-full p-2 flex flex-col text-white">
                    {/* Subject name */}
                    <p className="font-bold text-sm truncate leading-tight mb-0.5">{schedule.materia}</p>
                    
                    {/* Teacher with photo */}
                    {teacher && (
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {teacherPhoto ? (
                          <img 
                            src={teacherPhoto} 
                            alt={teacherFullName}
                            className="w-5 h-5 rounded-full object-cover border border-white/30 flex-shrink-0"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                            <Users className="w-2.5 h-2.5 text-white/80" />
                          </div>
                        )}
                        <span className="text-[11px] opacity-95 truncate">{teacherFullName}</span>
                      </div>
                    )}
                    
                    {/* Students count */}
                    {studentCount > 0 && (
                      <div className="flex items-center gap-1 text-[10px] opacity-80">
                        <GraduationCap className="w-3 h-3" />
                        <span>{studentCount} alumnos</span>
                      </div>
                    )}
                    
                    {/* Room & Time badge */}
                    <div className="absolute bottom-1 right-1 flex items-center gap-1">
                      {schedule.aula && (
                        <span className="bg-black/20 rounded px-1 py-0.5 text-[9px]">{schedule.aula}</span>
                      )}
                      <span className="bg-black/20 rounded px-1.5 py-0.5 text-[10px] font-medium">
                        {schedule.hora_inicio} - {schedule.hora_fin}
                      </span>
                    </div>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      data-testid={`schedule-edit-btn-${schedule.id}`}
                      onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}
                      className="p-1.5 bg-white/90 rounded-lg shadow hover:bg-white"
                    >
                      <Pencil className="w-3 h-3 text-slate-700" />
                    </button>
                    <button
                      data-testid={`schedule-delete-btn-${schedule.id}`}
                      onClick={(e) => { e.stopPropagation(); onDelete(schedule); }}
                      className="p-1.5 bg-white/90 rounded-lg shadow hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SchedulePage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("clases");
  const [loading, setLoading] = useState(true);

  // Data
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]); // For conflict checking

  // School settings (for logo)
  const [schoolSettings, setSchoolSettings] = useState(null);

  // Filters
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // Settings
  const [settings, setSettings] = useState({
    start_hour: "07:00",
    end_hour: "18:00",
    time_format: "24h",
    block_duration: 45,
    view_mode: "horizontal",
    include_saturday: false,
    include_sunday: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Modals
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [preselectedData, setPreselectedData] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Load school settings for logo
  useEffect(() => {
    const loadSchoolSettings = async () => {
      try {
        const res = await axios.get(`${API}/settings`, { headers });
        setSchoolSettings(res.data);
      } catch (err) {
        console.error("Error loading school settings:", err);
      }
    };
    loadSchoolSettings();
  }, [token]);

  // State for breaks (recreo, almuerzo, eventos)
  const [breaks, setBreaks] = useState([]);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [editBreak, setEditBreak] = useState(null);
  const [breakPreselectedTime, setBreakPreselectedTime] = useState(null);

  // Load breaks
  const loadBreaks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/schedule/breaks`, { headers });
      setBreaks(res.data.breaks || []);
    } catch (err) {
      console.error("Error loading breaks:", err);
    }
  }, [token]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [gradesRes, sectionsRes, teachersRes, settingsRes, breaksRes] = await Promise.all([
          axios.get(`${API}/academic/grades`, { headers }),
          axios.get(`${API}/academic/sections`, { headers }),
          axios.get(`${API}/users/teachers/active`, { headers }),
          axios.get(`${API}/schedule-settings`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API}/schedule/breaks`, { headers }).catch(() => ({ data: { breaks: [] } }))
        ]);

        setGrades(gradesRes.data || []);
        setSections(sectionsRes.data || []);
        setTeachers(teachersRes.data || []);
        setBreaks(breaksRes.data?.breaks || []);
        
        if (settingsRes.data) {
          setSettings(settingsRes.data);
        }
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  // Load schedules when filters change
  useEffect(() => {
    const loadSchedules = async () => {
      if (activeTab === "clases" && (!selectedGrade || !selectedSection)) {
        setSchedules([]);
        return;
      }
      if (activeTab === "profesores" && !selectedTeacher) {
        setSchedules([]);
        return;
      }

      try {
        let url = `${API}/schedules?tipo=${activeTab}`;
        if (activeTab === "clases") {
          url += `&grado_id=${selectedGrade}&seccion_id=${selectedSection}`;
        } else if (activeTab === "profesores") {
          url += `&profesor_id=${selectedTeacher}`;
        }

        const res = await axios.get(url, { headers });
        setSchedules(res.data.schedules || []);
      } catch (err) {
        console.error("Error loading schedules:", err);
      }
    };

    loadSchedules();
  }, [activeTab, selectedGrade, selectedSection, selectedTeacher, token]);

  // Load all schedules for conflict checking
  useEffect(() => {
    const loadAllSchedules = async () => {
      try {
        const res = await axios.get(`${API}/schedules?tipo=clases`, { headers });
        setAllSchedules(res.data.schedules || []);
      } catch (err) {
        console.error("Error loading all schedules:", err);
      }
    };

    loadAllSchedules();
  }, [token]);

  // Filter sections by selected grade
  const filteredSections = sections.filter(s => s.grado_id === selectedGrade);

  // Handle grade change
  const handleGradeChange = (gradeId) => {
    setSelectedGrade(gradeId);
    setSelectedSection("");
  };

  // Handle add click (from calendar cell)
  const handleCellClick = (day, time) => {
    setPreselectedData({
      grado_id: selectedGrade,
      seccion_id: selectedSection,
      profesor_id: selectedTeacher,
      dia: day,
      hora_inicio: time
    });
    setEditEntry(null);
    setShowEntryModal(true);
  };

  // Handle edit
  const handleEdit = (schedule) => {
    setEditEntry(schedule);
    setPreselectedData(null);
    setShowEntryModal(true);
  };

  // Handle delete
  const handleDelete = (schedule) => {
    setEntryToDelete(schedule);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    
    try {
      await axios.delete(`${API}/schedules/${entryToDelete.id}`, { headers });
      setSchedules(prev => prev.filter(s => s.id !== entryToDelete.id));
      setAllSchedules(prev => prev.filter(s => s.id !== entryToDelete.id));
    } catch (err) {
      console.error("Error deleting schedule:", err);
    } finally {
      setShowDeleteConfirm(false);
      setEntryToDelete(null);
    }
  };

  // Handle save settings
  const handleSaveSettings = async (newSettings) => {
    setSavingSettings(true);
    try {
      await axios.post(`${API}/schedule-settings`, newSettings, { headers });
      setSettings(newSettings);
      setShowSettings(false);
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Refresh schedules
  const refreshSchedules = async () => {
    let url = `${API}/schedules?tipo=${activeTab}`;
    if (activeTab === "clases") {
      url += `&grado_id=${selectedGrade}&seccion_id=${selectedSection}`;
    } else if (activeTab === "profesores") {
      url += `&profesor_id=${selectedTeacher}`;
    }

    try {
      const res = await axios.get(url, { headers });
      setSchedules(res.data.schedules || []);
      
      // Also refresh all schedules for conflict checking
      const allRes = await axios.get(`${API}/schedules?tipo=clases`, { headers });
      setAllSchedules(allRes.data.schedules || []);
    } catch (err) {
      console.error("Error refreshing schedules:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" data-testid="schedule-page">
      <Sidebar
        active="horarios"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        subdomain={user?.subdomain}
        token={token}
      />
      
      {sidebarExpanded && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader 
          user={user} 
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={schoolSettings?.logo_url}
          schoolName={schoolSettings?.system_name || user?.name}
          subdomain={user?.subdomain}
          token={token}
        />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-white rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
                    Horario de Clases
                  </h1>
                  <p className="text-slate-500">Gestión de horarios académicos</p>
                </div>
              </div>
              
              {/* Settings button */}
              <button
                data-testid="schedule-settings-btn"
                onClick={() => setShowSettings(true)}
                className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 flex items-center gap-2 text-slate-600 hover:text-slate-800"
              >
                <Settings className="w-5 h-5" />
                <span className="hidden md:inline font-medium">Configuración</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="schedule-tabs">
            {SCHEDULE_TABS.map(tab => (
              <button
                key={tab.id}
                data-testid={`schedule-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6" data-testid="schedule-filters">
            <div className="flex flex-wrap items-center gap-4">
              {activeTab === "clases" && (
                <>
                  {/* Grade filter */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Grado</label>
                    <select
                      data-testid="schedule-grade-select"
                      value={selectedGrade}
                      onChange={(e) => handleGradeChange(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar grado...</option>
                      {grades.map(g => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Section filter */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Sección</label>
                    <select
                      data-testid="schedule-section-select"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      disabled={!selectedGrade}
                    >
                      <option value="">Seleccionar sección...</option>
                      {filteredSections.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeTab === "profesores" && (
                <div className="flex-1 min-w-[300px]">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Profesor</label>
                  <select
                    data-testid="schedule-teacher-select"
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar profesor...</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} {t.last_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Add button */}
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-transparent mb-1">.</label>
                <button
                  data-testid="schedule-add-btn"
                  onClick={() => {
                    setPreselectedData({
                      grado_id: selectedGrade,
                      seccion_id: selectedSection,
                      profesor_id: selectedTeacher
                    });
                    setEditEntry(null);
                    setShowEntryModal(true);
                  }}
                  disabled={(activeTab === "clases" && (!selectedGrade || !selectedSection)) || (activeTab === "profesores" && !selectedTeacher)}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                  Agregar horario
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20" data-testid="schedule-loading">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (activeTab === "clases" && (!selectedGrade || !selectedSection)) || (activeTab === "profesores" && !selectedTeacher) ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center" data-testid="schedule-empty-state">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Selecciona los filtros</h3>
              <p className="text-slate-500">
                {activeTab === "clases" 
                  ? "Elige un grado y sección para ver el horario"
                  : activeTab === "profesores"
                  ? "Elige un profesor para ver su horario"
                  : "Selecciona los filtros necesarios"}
              </p>
            </div>
          ) : (
            <CalendarGrid
              schedules={schedules}
              settings={settings}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCellClick={handleCellClick}
              teachers={teachers}
              sections={sections}
            />
          )}

          {/* Stats Summary */}
          {schedules.length > 0 && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Total clases</p>
                <p className="text-2xl font-bold text-slate-800">{schedules.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Horas semanales</p>
                <p className="text-2xl font-bold text-blue-600">
                  {schedules.reduce((acc, s) => {
                    const [startH, startM] = s.hora_inicio.split(':').map(Number);
                    const [endH, endM] = s.hora_fin.split(':').map(Number);
                    return acc + ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
                  }, 0).toFixed(1)}h
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Días con clases</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {new Set(schedules.map(s => s.dia)).size}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Profesores</p>
                <p className="text-2xl font-bold text-violet-600">
                  {new Set(schedules.map(s => s.profesor_id).filter(Boolean)).size}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <ScheduleSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={handleSaveSettings}
        loading={savingSettings}
      />

      <ScheduleEntryModal
        isOpen={showEntryModal}
        onClose={() => {
          setShowEntryModal(false);
          setEditEntry(null);
          setPreselectedData(null);
        }}
        token={token}
        entry={editEntry}
        onSuccess={refreshSchedules}
        grades={grades}
        sections={sections}
        teachers={teachers}
        type={activeTab}
        preselectedData={preselectedData}
        existingSchedules={allSchedules}
        settings={settings}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setEntryToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar horario"
        message={`¿Estás seguro de eliminar ${entryToDelete?.materia}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        type="danger"
      />
    </div>
  );
}
