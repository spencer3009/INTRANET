import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "../components/AdminSidebar";
import DashboardHeader from "../components/DashboardHeader";
import {
  Calendar,
  Clock,
  BookOpen,
  User,
  Users,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Pencil,
  Trash2,
  GraduationCap,
  MapPin,
  FileText,
  CheckCircle,
  Timer,
  Archive
} from "lucide-react";
import TimePicker from "../components/ui/time-picker";
import { Combobox } from "../components/ui/combobox";
import ConfirmModal from "../components/ConfirmModal";

const API = process.env.REACT_APP_BACKEND_URL;

// Exam types configuration
const EXAM_TYPES = [
  { id: "parcial", label: "Parcial", color: "#6366F1", icon: "📝" },
  { id: "final", label: "Final", color: "#DC2626", icon: "📋" },
  { id: "práctica", label: "Práctica", color: "#059669", icon: "✍️" },
  { id: "quiz", label: "Quiz", color: "#F59E0B", icon: "⚡" }
];

// Status badge component
function ExamStatusBadge({ status }) {
  const config = {
    upcoming: { label: "Próximo", bg: "bg-blue-100", text: "text-blue-700", icon: Timer },
    ongoing: { label: "En curso", bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
    finished: { label: "Finalizado", bg: "bg-slate-100", text: "text-slate-600", icon: Archive }
  }[status] || { label: status, bg: "bg-slate-100", text: "text-slate-600", icon: Clock };
  
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// Type badge component
function ExamTypeBadge({ type }) {
  const typeConfig = EXAM_TYPES.find(t => t.id === type) || EXAM_TYPES[0];
  return (
    <span 
      className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: typeConfig.color }}
    >
      {typeConfig.icon} {typeConfig.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAM CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function ExamCard({ exam, onEdit, onDelete }) {
  return (
    <div 
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
      style={{ borderLeftWidth: '4px', borderLeftColor: exam.subject_color || '#6366F1' }}
      data-testid={`exam-card-${exam.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header - Subject & Type */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h4 className="font-bold text-slate-800 truncate">{exam.subject_name}</h4>
            <ExamTypeBadge type={exam.type} />
            <ExamStatusBadge status={exam.status} />
          </div>
          
          {/* Title */}
          <p className="text-sm text-slate-600 mb-2">{exam.title}</p>
          
          {/* Time */}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {exam.start_time} - {exam.end_time}
            </span>
            <span className="text-slate-400">({exam.duration_minutes} min)</span>
          </div>
          
          {/* Teacher & Classroom */}
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
            {exam.teacher_name && (
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {exam.teacher_name}
              </span>
            )}
            {exam.classroom_name && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {exam.classroom_name}
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(exam)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid={`exam-edit-${exam.id}`}
          >
            <Pencil className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={() => onDelete(exam)}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
            data-testid={`exam-delete-${exam.id}`}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAM FORM PANEL (Side Panel, not Modal)
// ══════════════════════════════════════════════════════════════════════════════
function ExamFormPanel({ 
  isOpen, 
  onClose, 
  token, 
  exam, 
  onSuccess, 
  gradeId, 
  sectionId,
  subjects,
  teachers,
  selectedDate
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    subject_id: "",
    teacher_id: "",
    classroom_id: "",
    date: "",
    start_time: "09:00",
    end_time: "10:30",
    type: "parcial",
    title: "",
    description: ""
  });

  const isEdit = !!exam;
  const headers = { Authorization: `Bearer ${token}` };

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (exam) {
        setForm({
          subject_id: exam.subject_id || "",
          teacher_id: exam.teacher_id || "",
          classroom_id: exam.classroom_id || "",
          date: exam.date || "",
          start_time: exam.start_time || "09:00",
          end_time: exam.end_time || "10:30",
          type: exam.type || "parcial",
          title: exam.title || "",
          description: exam.description || ""
        });
      } else {
        setForm({
          subject_id: "",
          teacher_id: "",
          classroom_id: "",
          date: selectedDate || new Date().toISOString().split('T')[0],
          start_time: "09:00",
          end_time: "10:30",
          type: "parcial",
          title: "",
          description: ""
        });
      }
      setError("");
    }
  }, [isOpen, exam, selectedDate]);

  // Calculate duration display
  const calculateDuration = () => {
    if (!form.start_time || !form.end_time) return 0;
    const [startH, startM] = form.start_time.split(':').map(Number);
    const [endH, endM] = form.end_time.split(':').map(Number);
    return Math.max(0, (endH * 60 + endM) - (startH * 60 + startM));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!form.subject_id) {
      setError("Selecciona una materia");
      return;
    }
    if (!form.teacher_id) {
      setError("Selecciona un profesor");
      return;
    }
    if (!form.date) {
      setError("Selecciona una fecha");
      return;
    }
    if (!form.title.trim()) {
      setError("Ingresa un título para el examen");
      return;
    }
    if (form.end_time <= form.start_time) {
      setError("La hora fin debe ser mayor a la hora inicio");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        grade_id: gradeId,
        section_id: sectionId
      };
      
      if (isEdit) {
        await axios.put(`${API}/api/exam-schedules/${exam.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/api/exam-schedules`, payload, { headers });
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      setError(typeof errorDetail === 'object' ? errorDetail.message : (errorDetail || "Error al guardar"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Prepare teacher options for combobox
  const teacherOptions = teachers.map(t => ({
    value: t.id,
    label: `${t.name} ${t.last_name || ''}`.trim(),
    photo: t.profile_image || t.photo_url
  }));

  const selectedType = EXAM_TYPES.find(t => t.id === form.type) || EXAM_TYPES[0];

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col" data-testid="exam-form-panel">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {isEdit ? "Editar Examen" : "Programar Examen"}
              </h3>
              <p className="text-white/70 text-sm">{form.date}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Fecha del examen
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            data-testid="exam-date-input"
          />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Materia
          </label>
          <select
            value={form.subject_id}
            onChange={(e) => setForm(p => ({ ...p, subject_id: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            data-testid="exam-subject-select"
          >
            <option value="">Seleccionar materia...</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name || s.nombre}</option>
            ))}
          </select>
        </div>

        {/* Teacher with Combobox */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Profesor
          </label>
          <Combobox
            options={teacherOptions}
            value={form.teacher_id}
            onChange={(val) => setForm(p => ({ ...p, teacher_id: val }))}
            placeholder="Buscar profesor..."
            showPhoto={true}
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Título del examen
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Ej: Examen Parcial, Evaluación Unidad 3..."
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            data-testid="exam-title-input"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Tipo de evaluación
          </label>
          <div className="grid grid-cols-2 gap-2">
            {EXAM_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setForm(p => ({ ...p, type: type.id }))}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  form.type === type.id 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                data-testid={`exam-type-${type.id}`}
              >
                <span className="text-lg mr-2">{type.icon}</span>
                <span className="font-medium text-slate-700">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Hora inicio
            </label>
            <TimePicker
              value={form.start_time}
              onChange={(val) => setForm(p => ({ ...p, start_time: val }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Hora fin
            </label>
            <TimePicker
              value={form.end_time}
              onChange={(val) => setForm(p => ({ ...p, end_time: val }))}
            />
          </div>
        </div>

        {/* Duration Display */}
        <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-slate-600">Duración:</span>
          <span className="font-bold text-indigo-600">{calculateDuration()} minutos</span>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Descripción (opcional)
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Temas a evaluar, indicaciones, etc."
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            data-testid="exam-description-input"
          />
        </div>
      </form>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="exam-submit-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              {isEdit ? "Actualizar" : "Programar"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function ExamCalendar({ currentMonth, exams, onDayClick, selectedDate }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  // Get first day of month and total days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
  const totalDays = lastDay.getDate();
  
  // Days of week header (starting Monday)
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  
  // Adjust start day for Monday start
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  
  // Count exams per day
  const examsByDay = {};
  exams.forEach(exam => {
    const day = parseInt(exam.date.split('-')[2]);
    examsByDay[day] = (examsByDay[day] || 0) + 1;
  });
  
  // Generate calendar days
  const days = [];
  
  // Empty cells before first day
  for (let i = 0; i < adjustedStartDay; i++) {
    days.push(null);
  }
  
  // Actual days
  for (let day = 1; day <= totalDays; day++) {
    days.push(day);
  }
  
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();
  
  // Check if a day is selected
  const selectedDay = selectedDate ? parseInt(selectedDate.split('-')[2]) : null;
  const selectedMonth = selectedDate ? parseInt(selectedDate.split('-')[1]) - 1 : null;
  const selectedYear = selectedDate ? parseInt(selectedDate.split('-')[0]) : null;
  const isSelectedMonth = selectedYear === year && selectedMonth === month;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="exam-calendar">
      {/* Week days header */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {weekDays.map(day => (
          <div key={day} className="py-2 text-center text-xs font-medium text-slate-500">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-20 bg-slate-50/50" />;
          }
          
          const examCount = examsByDay[day] || 0;
          const isToday = isCurrentMonth && day === todayDate;
          const isSelected = isSelectedMonth && day === selectedDay;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          return (
            <button
              key={day}
              onClick={() => onDayClick(dateStr)}
              className={`h-20 p-1 border-b border-r border-slate-100 hover:bg-indigo-50 transition-colors text-left flex flex-col ${
                isSelected ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500' : ''
              }`}
              data-testid={`calendar-day-${day}`}
            >
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${
                isToday 
                  ? 'bg-indigo-600 text-white font-bold' 
                  : 'text-slate-700'
              }`}>
                {day}
              </span>
              {examCount > 0 && (
                <div className="mt-auto">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                    <FileText className="w-3 h-3" />
                    {examCount}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ExamSchedulePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [exams, setExams] = useState([]);
  const [schoolSettings, setSchoolSettings] = useState(null);
  
  // Filters
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Panel state
  const [showPanel, setShowPanel] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [gradesRes, sectionsRes, subjectsRes, teachersRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/academic/grades`, { headers }),
          axios.get(`${API}/api/academic/sections`, { headers }),
          axios.get(`${API}/api/academic/subjects`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/users/teachers/active`, { headers }),
          axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null }))
        ]);
        
        setGrades(gradesRes.data || []);
        setSections(sectionsRes.data || []);
        setSubjects(subjectsRes.data || []);
        setTeachers(teachersRes.data || []);
        if (settingsRes.data) setSchoolSettings(settingsRes.data);
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [token]);

  // Load exams when filters change
  const loadExams = useCallback(async () => {
    if (!selectedGrade || !selectedSection) {
      setExams([]);
      return;
    }
    
    try {
      // Get date range for current month
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
      
      const res = await axios.get(
        `${API}/api/exam-schedules?grade_id=${selectedGrade}&section_id=${selectedSection}&from_date=${fromDate}&to_date=${toDate}`,
        { headers }
      );
      setExams(res.data.exams || []);
    } catch (err) {
      console.error("Error loading exams:", err);
    }
  }, [selectedGrade, selectedSection, currentMonth, token]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  // Filter sections by selected grade
  const filteredSections = sections.filter(s => s.grado_id === selectedGrade);

  // Get exams for selected date
  const examsForSelectedDate = selectedDate 
    ? exams.filter(e => e.date === selectedDate)
    : [];

  // Month navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Get selected grade/section names
  const selectedGradeName = grades.find(g => g.id === selectedGrade)?.nombre || "";
  const selectedSectionName = filteredSections.find(s => s.id === selectedSection)?.nombre || "";

  // Handlers
  const handleDayClick = (dateStr) => {
    setSelectedDate(dateStr);
  };

  const handleAddExam = () => {
    if (!selectedGrade || !selectedSection) {
      alert("Primero selecciona un grado y sección");
      return;
    }
    setEditingExam(null);
    setShowPanel(true);
  };

  const handleEditExam = (exam) => {
    setEditingExam(exam);
    setShowPanel(true);
  };

  const handleDeleteExam = (exam) => {
    setExamToDelete(exam);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;
    try {
      await axios.delete(`${API}/api/exam-schedules/${examToDelete.id}`, { headers });
      loadExams();
    } catch (err) {
      console.error("Error deleting exam:", err);
    } finally {
      setShowDeleteConfirm(false);
      setExamToDelete(null);
    }
  };

  // Format month name
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const currentMonthName = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  const logoUrl = schoolSettings?.logo_url;

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="exam-schedule-page">
      {/* Sidebar */}
      <AdminSidebar
        active="examenes-programados"
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={user?.school_name}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-3" data-testid="exam-schedule-title">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              Horario de Exámenes
            </h1>
            <p className="text-slate-500 mt-1 ml-13">
              Programa y gestiona las fechas de evaluaciones
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="flex flex-wrap items-end gap-4">
              {/* Grade */}
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Grado
                </label>
                <select
                  value={selectedGrade}
                  onChange={(e) => {
                    setSelectedGrade(e.target.value);
                    setSelectedSection("");
                    setSelectedDate(null);
                  }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  data-testid="exam-grade-select"
                >
                  <option value="">Seleccionar grado...</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Sección
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => {
                    setSelectedSection(e.target.value);
                    setSelectedDate(null);
                  }}
                  disabled={!selectedGrade}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  data-testid="exam-section-select"
                >
                  <option value="">Seleccionar sección...</option>
                  {filteredSections.map(s => (
                    <option key={s.id} value={s.id}>{s.name || s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Add Button */}
              <button
                onClick={handleAddExam}
                disabled={!selectedGrade || !selectedSection}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                data-testid="add-exam-btn"
              >
                <Plus className="w-5 h-5" />
                Programar Examen
              </button>
            </div>
          </div>

          {/* Content Area */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : !selectedGrade || !selectedSection ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Selecciona un grado y sección
              </h3>
              <p className="text-slate-500">
                Para ver y programar exámenes, primero selecciona el grado y sección correspondiente.
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Calendar - 3 columns */}
              <div className="lg:col-span-3">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={prevMonth}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <h2 className="text-lg font-bold text-slate-800">{currentMonthName}</h2>
                  <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                
                {/* Calendar Grid */}
                <ExamCalendar
                  currentMonth={currentMonth}
                  exams={exams}
                  onDayClick={handleDayClick}
                  selectedDate={selectedDate}
                />
                
                {/* Context info */}
                <div className="mt-4 p-3 bg-indigo-50 rounded-lg flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-700">
                    {selectedGradeName} - Sección {selectedSectionName}
                  </span>
                  <span className="ml-auto text-sm text-indigo-600">
                    {exams.length} exámenes este mes
                  </span>
                </div>
              </div>

              {/* Day Detail Panel - 2 columns */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-slate-200 h-full">
                  {/* Panel Header */}
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {selectedDate ? (
                        new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-PE', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long' 
                        })
                      ) : (
                        "Selecciona un día"
                      )}
                    </h3>
                  </div>

                  {/* Panel Content */}
                  <div className="p-4">
                    {!selectedDate ? (
                      <div className="text-center py-8 text-slate-500">
                        <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p>Haz clic en un día del calendario para ver los exámenes</p>
                      </div>
                    ) : examsForSelectedDate.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                          <FileText className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-slate-500 mb-4">No hay exámenes programados</p>
                        <button
                          onClick={handleAddExam}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Programar examen
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {examsForSelectedDate.map(exam => (
                          <ExamCard
                            key={exam.id}
                            exam={exam}
                            onEdit={handleEditExam}
                            onDelete={handleDeleteExam}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Side Panel for Add/Edit */}
      <ExamFormPanel
        isOpen={showPanel}
        onClose={() => {
          setShowPanel(false);
          setEditingExam(null);
        }}
        token={token}
        exam={editingExam}
        onSuccess={loadExams}
        gradeId={selectedGrade}
        sectionId={selectedSection}
        subjects={subjects}
        teachers={teachers}
        selectedDate={selectedDate}
      />

      {/* Backdrop for panel */}
      {showPanel && (
        <div 
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setShowPanel(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setExamToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar examen"
        message={`¿Estás seguro de eliminar "${examToDelete?.title}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        type="danger"
      />
    </div>
  );
}
