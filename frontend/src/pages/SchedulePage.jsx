import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import ConfirmModal from "../components/ConfirmModal";
import { 
  Calendar, Clock, BookOpen, GraduationCap, Users, 
  Plus, Pencil, Trash2, Loader2, X, Check, AlertCircle,
  ChevronRight, ArrowLeft, FileText, CalendarDays
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tab configurations
const SCHEDULE_TABS = [
  { id: "clases", label: "Horario de Clases", icon: Calendar, description: "Horarios por grado y sección" },
  { id: "profesores", label: "Horario de Profesores", icon: GraduationCap, description: "Horarios por profesor" },
  { id: "examenes", label: "Horario de Exámenes", icon: FileText, description: "Calendario de evaluaciones" }
];

// Days of the week
const DAYS = [
  { id: "lunes", label: "Lunes", short: "Lun" },
  { id: "martes", label: "Martes", short: "Mar" },
  { id: "miercoles", label: "Miércoles", short: "Mié" },
  { id: "jueves", label: "Jueves", short: "Jue" },
  { id: "viernes", label: "Viernes", short: "Vie" },
  { id: "sabado", label: "Sábado", short: "Sáb" }
];

// Time slots
const TIME_SLOTS = [
  "07:00", "07:45", "08:30", "09:15", "10:00", "10:45", 
  "11:30", "12:15", "13:00", "13:45", "14:30", "15:15",
  "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"
];

// Color palette for subjects
const SUBJECT_COLORS = [
  { name: "Azul", value: "#3B82F6", bg: "bg-blue-100", text: "text-blue-700" },
  { name: "Verde", value: "#10B981", bg: "bg-emerald-100", text: "text-emerald-700" },
  { name: "Naranja", value: "#F59E0B", bg: "bg-amber-100", text: "text-amber-700" },
  { name: "Rojo", value: "#EF4444", bg: "bg-red-100", text: "text-red-700" },
  { name: "Morado", value: "#8B5CF6", bg: "bg-violet-100", text: "text-violet-700" },
  { name: "Rosa", value: "#EC4899", bg: "bg-pink-100", text: "text-pink-700" },
  { name: "Cyan", value: "#06B6D4", bg: "bg-cyan-100", text: "text-cyan-700" },
  { name: "Índigo", value: "#6366F1", bg: "bg-indigo-100", text: "text-indigo-700" }
];

// ══════════════════════════════════════════════════════════════════════════════
// SCHEDULE ENTRY MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ScheduleEntryModal({ isOpen, onClose, token, entry, onSuccess, grades, sections, teachers, type, preselectedData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const subjectInputRef = useRef(null);
  
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

  // Load subjects when grade changes
  useEffect(() => {
    const loadSubjects = async () => {
      if (!form.grado_id) {
        setSubjects([]);
        return;
      }
      
      setLoadingSubjects(true);
      try {
        const res = await axios.get(`${API}/subjects?grade_id=${form.grado_id}`, { headers });
        setSubjects(res.data.subjects || []);
      } catch (err) {
        console.error("Error loading subjects:", err);
        setSubjects([]);
      } finally {
        setLoadingSubjects(false);
      }
    };
    
    loadSubjects();
  }, [form.grado_id, token]);

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
      color: subject.color || p.color,
      // Auto-assign teacher if subject has one
      profesor_id: subject.teacher_id || p.profesor_id
    }));
    setSubjectSearch("");
    setShowSubjectDropdown(false);
  };

  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setForm({
          grado_id: entry.grado_id || "",
          seccion_id: entry.seccion_id || "",
          profesor_id: entry.profesor_id || "",
          materia: entry.materia || "",
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
          dia: preselectedData?.dia || "",
          hora_inicio: preselectedData?.hora_inicio || "",
          hora_fin: "",
          aula: "",
          color: SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)].value
        });
      }
      setError("");
    }
  }, [isOpen, entry, preselectedData]);

  // Filter sections by selected grade
  const filteredSections = form.grado_id 
    ? sections.filter(s => s.grado_id === form.grado_id) 
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (type === "clases") {
      if (!form.grado_id || !form.seccion_id) {
        setError("Selecciona el grado y la sección");
        return;
      }
    } else if (type === "profesores") {
      if (!form.profesor_id) {
        setError("Selecciona el profesor");
        return;
      }
    }
    
    if (!form.materia || !form.dia || !form.hora_inicio || !form.hora_fin) {
      setError("Completa todos los campos obligatorios");
      return;
    }

    if (form.hora_inicio >= form.hora_fin) {
      setError("La hora de inicio debe ser anterior a la hora de fin");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form, tipo: type };
      const res = isEdit 
        ? await axios.put(`${API}/schedules/${entry.id}`, payload, { headers }) 
        : await axios.post(`${API}/schedules`, payload, { headers });
      onSuccess(res.data.schedule, isEdit ? "update" : "create");
      onClose();
    } catch (err) { 
      setError(err.response?.data?.detail || "Error al guardar"); 
    } finally { 
      setLoading(false); 
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-white" />
              <div className="text-white">
                <h2 className="text-xl font-bold">{isEdit ? "Editar" : "Agregar"} Horario</h2>
                <p className="text-blue-100 text-sm">{type === "clases" ? "Clase" : type === "profesores" ? "Profesor" : "Examen"}</p>
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

            {/* Grade/Section selects for class schedule */}
            {type === "clases" && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Grado <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.grado_id}
                    onChange={(e) => setForm(p => ({ ...p, grado_id: e.target.value, seccion_id: "" }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.nombre} - {g.nivel_nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Sección <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.seccion_id}
                    onChange={(e) => setForm(p => ({ ...p, seccion_id: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                    required
                    disabled={!form.grado_id}
                  >
                    <option value="">{form.grado_id ? "Seleccionar..." : "Primero elige grado"}</option>
                    {filteredSections.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Teacher select for teacher schedule */}
            {type === "profesores" && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Profesor <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.profesor_id}
                  onChange={(e) => setForm(p => ({ ...p, profesor_id: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar profesor...</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.last_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Subject/Materia */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Materia / Asignatura <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.materia}
                onChange={(e) => setForm(p => ({ ...p, materia: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Matemáticas, Comunicación, Ciencias..."
                required
              />
            </div>

            {/* Day and Time */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Día <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.dia}
                  onChange={(e) => setForm(p => ({ ...p, dia: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Día...</option>
                  {DAYS.map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Hora inicio <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.hora_inicio}
                  onChange={(e) => setForm(p => ({ ...p, hora_inicio: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Inicio...</option>
                  {TIME_SLOTS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Hora fin <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.hora_fin}
                  onChange={(e) => setForm(p => ({ ...p, hora_fin: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Fin...</option>
                  {TIME_SLOTS.filter(t => t > form.hora_inicio).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Classroom and Color */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Aula / Salón
                </label>
                <input
                  type="text"
                  value={form.aula}
                  onChange={(e) => setForm(p => ({ ...p, aula: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Aula 101, Lab. Ciencias"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {SUBJECT_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, color: c.value }))}
                      className={`w-8 h-8 rounded-lg transition-all ${form.color === c.value ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Also assign to class (for teacher schedule) */}
            {type === "profesores" && (
              <div className="mb-4 p-4 bg-slate-50 rounded-xl">
                <p className="text-sm font-semibold text-slate-700 mb-3">Asignar a grado/sección (opcional)</p>
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={form.grado_id}
                    onChange={(e) => setForm(p => ({ ...p, grado_id: e.target.value, seccion_id: "" }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Sin asignar</option>
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.nombre}</option>
                    ))}
                  </select>
                  <select
                    value={form.seccion_id}
                    onChange={(e) => setForm(p => ({ ...p, seccion_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm disabled:bg-slate-100"
                    disabled={!form.grado_id}
                  >
                    <option value="">Sección...</option>
                    {filteredSections.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {isEdit ? "Guardar" : "Agregar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCHEDULE GRID COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function ScheduleGrid({ schedules, onEdit, onDelete, onAddClick }) {
  // Group schedules by day and time
  const schedulesByDay = {};
  DAYS.forEach(d => { schedulesByDay[d.id] = []; });
  schedules.forEach(s => {
    if (schedulesByDay[s.dia]) {
      schedulesByDay[s.dia].push(s);
    }
  });

  // Sort each day's schedules by start time
  Object.keys(schedulesByDay).forEach(day => {
    schedulesByDay[day].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  });

  const getColorClasses = (color) => {
    const colorObj = SUBJECT_COLORS.find(c => c.value === color);
    return colorObj ? `${colorObj.bg} ${colorObj.text}` : "bg-slate-100 text-slate-700";
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="grid grid-cols-6 border-b">
        {DAYS.map(day => (
          <div key={day.id} className="p-4 text-center border-r last:border-r-0 bg-slate-50">
            <p className="font-bold text-slate-800">{day.label}</p>
            <p className="text-xs text-slate-500">{schedulesByDay[day.id].length} clases</p>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-6 min-h-[400px]">
        {DAYS.map(day => (
          <div key={day.id} className="border-r last:border-r-0 p-2 space-y-2">
            {schedulesByDay[day.id].length === 0 ? (
              <button
                onClick={() => onAddClick(day.id)}
                className="w-full h-20 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Agregar</span>
              </button>
            ) : (
              schedulesByDay[day.id].map(schedule => (
                <div
                  key={schedule.id}
                  className={`p-3 rounded-xl ${getColorClasses(schedule.color)} group relative cursor-pointer hover:shadow-md transition-all`}
                  onClick={() => onEdit(schedule)}
                >
                  <p className="font-semibold text-sm truncate">{schedule.materia}</p>
                  <p className="text-xs opacity-75">{schedule.hora_inicio} - {schedule.hora_fin}</p>
                  {schedule.aula && <p className="text-xs opacity-60 mt-1">{schedule.aula}</p>}
                  
                  {/* Hover actions */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}
                      className="p-1 bg-white rounded-lg shadow hover:bg-blue-50"
                    >
                      <Pencil className="w-3 h-3 text-blue-600" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(schedule); }}
                      className="p-1 bg-white rounded-lg shadow hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                </div>
              ))
            )}
            {schedulesByDay[day.id].length > 0 && (
              <button
                onClick={() => onAddClick(day.id)}
                className="w-full py-2 border border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-blue-400 hover:text-blue-500 text-xs flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function SchedulePage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("clases");
  
  // Data
  const [schedules, setSchedules] = useState([]);
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  
  // Filters
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  
  // Modal states
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [preselectedData, setPreselectedData] = useState(null);
  
  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === "clases" && selectedGrade && selectedSection) {
      loadSchedules();
    } else if (activeTab === "profesores" && selectedTeacher) {
      loadSchedules();
    }
  }, [activeTab, selectedGrade, selectedSection, selectedTeacher]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, levelsRes, gradesRes, sectionsRes, usersRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/users`, { headers })
      ]);
      setSettings(settingsRes.data);
      
      // Sort levels by standard order: Inicial, Primaria, Secundaria
      const levelOrder = { 'inicial': 1, 'primaria': 2, 'secundaria': 3 };
      const sortedLevels = levelsRes.data.filter(l => l.activo).sort((a, b) => {
        const orderA = levelOrder[a.nombre.toLowerCase()] || 99;
        const orderB = levelOrder[b.nombre.toLowerCase()] || 99;
        return orderA - orderB;
      });
      setLevels(sortedLevels);
      
      // Sort grades by level order first, then by grade order
      const gradesData = gradesRes.data.filter(g => g.activo);
      const sortedGrades = gradesData.sort((a, b) => {
        const levelA = levelOrder[a.nivel_nombre?.toLowerCase()] || 99;
        const levelB = levelOrder[b.nivel_nombre?.toLowerCase()] || 99;
        if (levelA !== levelB) return levelA - levelB;
        return (a.orden || 0) - (b.orden || 0);
      });
      setGrades(sortedGrades);
      
      setSections(sectionsRes.data.filter(s => s.activo));
      setTeachers(usersRes.data.filter(u => u.role === 'teacher'));
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      let url = `${API}/schedules?tipo=${activeTab}`;
      if (activeTab === "clases" && selectedGrade && selectedSection) {
        url += `&grado_id=${selectedGrade}&seccion_id=${selectedSection}`;
      } else if (activeTab === "profesores" && selectedTeacher) {
        url += `&profesor_id=${selectedTeacher}`;
      }
      const res = await axios.get(url, { headers });
      setSchedules(res.data);
    } catch (err) {
      console.error("Error loading schedules:", err);
    }
  };

  const handleEntrySuccess = (entry, action) => {
    if (action === "create") {
      setSchedules(prev => [...prev, entry]);
    } else {
      setSchedules(prev => prev.map(s => s.id === entry.id ? entry : s));
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/schedules/${deleteTarget.id}`, { headers });
      setSchedules(prev => prev.filter(s => s.id !== deleteTarget.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAddClick = (dia) => {
    setEditingEntry(null);
    setPreselectedData({
      grado_id: selectedGrade,
      seccion_id: selectedSection,
      profesor_id: selectedTeacher,
      dia
    });
    setShowEntryModal(true);
  };

  // Filtered sections based on selected grade
  const filteredSections = selectedGrade 
    ? sections.filter(s => s.grado_id === selectedGrade) 
    : [];

  // Get selected grade info
  const selectedGradeInfo = grades.find(g => g.id === selectedGrade);
  const selectedSectionInfo = sections.find(s => s.id === selectedSection);
  const selectedTeacherInfo = teachers.find(t => t.id === selectedTeacher);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="schedule-page">
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
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
            <div className="relative px-8 py-10 flex items-center gap-6">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                <Calendar className="w-10 h-10 text-blue-600" />
              </div>
              <div className="text-white">
                <h1 className="text-4xl font-bold tracking-tight mb-2">Horarios</h1>
                <p className="text-blue-200 text-lg">Gestiona los horarios de clases, profesores y exámenes</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
            {SCHEDULE_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSchedules([]);
                  }}
                  className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold transition-all whitespace-nowrap ${
                    isActive 
                      ? "bg-white shadow-lg text-blue-600 border-2 border-blue-200" 
                      : "bg-white/50 text-slate-600 hover:bg-white hover:shadow border-2 border-transparent"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? "bg-blue-100" : "bg-slate-100"}`}>
                    <Icon className={`w-6 h-6 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{tab.label}</p>
                    <p className="text-xs opacity-60">{tab.description}</p>
                  </div>
                  {isActive && <ChevronRight className="w-5 h-5 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Filters based on active tab */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            {activeTab === "clases" && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Filtrar por grado</label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => {
                      setSelectedGrade(e.target.value);
                      setSelectedSection("");
                      setSchedules([]);
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar grado...</option>
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.nombre} - {g.nivel_nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Sección</label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                    disabled={!selectedGrade}
                  >
                    <option value="">{selectedGrade ? "Seleccionar sección..." : "Primero elige grado"}</option>
                    {filteredSections.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                {selectedGrade && selectedSection && (
                  <button
                    onClick={() => handleAddClick("")}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Agregar horario
                  </button>
                )}
              </div>
            )}

            {activeTab === "profesores" && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[300px]">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Profesor</label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar profesor...</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} {t.last_name}</option>
                    ))}
                  </select>
                </div>
                {selectedTeacher && (
                  <button
                    onClick={() => handleAddClick("")}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Agregar horario
                  </button>
                )}
              </div>
            )}

            {activeTab === "examenes" && (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-semibold">Horario de Exámenes</p>
                <p className="text-sm">Próximamente - Calendario de evaluaciones</p>
              </div>
            )}
          </div>

          {/* Schedule Display */}
          {activeTab === "clases" && selectedGrade && selectedSection && (
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Horario de clases</h2>
                  <p className="text-slate-500">{selectedGradeInfo?.nombre} - Sección {selectedSectionInfo?.nombre}</p>
                </div>
              </div>
              
              <ScheduleGrid
                schedules={schedules}
                onEdit={(s) => { setEditingEntry(s); setShowEntryModal(true); }}
                onDelete={(s) => { setDeleteTarget(s); setShowDeleteModal(true); }}
                onAddClick={handleAddClick}
              />
            </div>
          )}

          {activeTab === "profesores" && selectedTeacher && (
            <div>
              <div className="flex items-center gap-4 mb-6">
                {selectedTeacherInfo?.photo_url ? (
                  <img src={selectedTeacherInfo.photo_url} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-8 h-8 text-white" />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Horario de profesores</h2>
                  <p className="text-slate-500">{selectedTeacherInfo?.name} {selectedTeacherInfo?.last_name}</p>
                </div>
              </div>
              
              <ScheduleGrid
                schedules={schedules}
                onEdit={(s) => { setEditingEntry(s); setShowEntryModal(true); }}
                onDelete={(s) => { setDeleteTarget(s); setShowDeleteModal(true); }}
                onAddClick={handleAddClick}
              />
            </div>
          )}

          {/* Empty state when no filter selected */}
          {activeTab === "clases" && (!selectedGrade || !selectedSection) && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Selecciona un grado y sección</h3>
              <p className="text-slate-500">Elige el grado y la sección para ver y gestionar su horario de clases</p>
            </div>
          )}

          {activeTab === "profesores" && !selectedTeacher && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <GraduationCap className="w-12 h-12 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Selecciona un profesor</h3>
              <p className="text-slate-500">Elige un profesor para ver y gestionar su horario de clases</p>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <ScheduleEntryModal
        isOpen={showEntryModal}
        onClose={() => { setShowEntryModal(false); setEditingEntry(null); setPreselectedData(null); }}
        token={token}
        entry={editingEntry}
        onSuccess={handleEntrySuccess}
        grades={grades}
        sections={sections}
        teachers={teachers}
        type={activeTab}
        preselectedData={preselectedData}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteEntry}
        title="Eliminar horario"
        message={`¿Eliminar "${deleteTarget?.materia}" del horario? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        type="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
