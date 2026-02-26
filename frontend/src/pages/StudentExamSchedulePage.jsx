import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  Calendar,
  Clock,
  User,
  Loader2,
  AlertCircle,
  GraduationCap,
  FileText,
  Timer,
  Archive,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Exam type colors
const EXAM_TYPES = {
  parcial: { label: "Parcial", color: "#6366F1", icon: "📝" },
  final: { label: "Final", color: "#DC2626", icon: "📋" },
  práctica: { label: "Práctica", color: "#059669", icon: "✍️" },
  quiz: { label: "Quiz", color: "#F59E0B", icon: "⚡" }
};

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

// Student Exam Card - Read Only (no edit/delete buttons)
function StudentExamCard({ exam }) {
  const typeConfig = EXAM_TYPES[exam.type] || EXAM_TYPES.parcial;
  
  return (
    <div 
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
      style={{ borderLeftWidth: '4px', borderLeftColor: exam.subject_color || typeConfig.color }}
      data-testid={`student-exam-card-${exam.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0"
          style={{ backgroundColor: exam.subject_color || typeConfig.color }}
        >
          {typeConfig.icon}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-bold text-slate-800">{exam.subject_name}</h4>
            <span 
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: typeConfig.color }}
            >
              {typeConfig.label}
            </span>
            <ExamStatusBadge status={exam.status} />
          </div>
          
          {/* Title */}
          <p className="text-sm text-slate-600 mb-2">{exam.title}</p>
          
          {/* Time */}
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {exam.start_time} - {exam.end_time}
            </span>
            <span className="text-slate-400">({exam.duration_minutes} min)</span>
          </div>
          
          {/* Teacher */}
          {exam.teacher_name && (
            <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
              {exam.teacher_photo ? (
                <img 
                  src={exam.teacher_photo} 
                  alt={exam.teacher_name}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
              <span>{exam.teacher_name}</span>
            </div>
          )}
          
          {/* Description */}
          {exam.description && (
            <p className="mt-2 text-sm text-slate-500 italic bg-slate-50 p-2 rounded">
              {exam.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Calendar component for students (read-only)
function StudentExamCalendar({ currentMonth, exams, onDayClick, selectedDate }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  // Count exams per day
  const examsByDay = {};
  exams.forEach(exam => {
    const day = parseInt(exam.date.split('-')[2]);
    examsByDay[day] = (examsByDay[day] || 0) + 1;
  });

  // Generate calendar days
  const days = [];
  for (let i = 0; i < adjustedStartDay; i++) days.push(null);
  for (let day = 1; day <= totalDays; day++) days.push(day);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();
  const selectedDay = selectedDate ? parseInt(selectedDate.split('-')[2]) : null;
  const selectedMonth = selectedDate ? parseInt(selectedDate.split('-')[1]) - 1 : null;
  const selectedYear = selectedDate ? parseInt(selectedDate.split('-')[0]) : null;
  const isSelectedMonth = selectedYear === year && selectedMonth === month;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="student-exam-calendar">
      {/* Week days header */}
      <div className="grid grid-cols-7 bg-gradient-to-r from-indigo-500 to-purple-500">
        {weekDays.map(day => (
          <div key={day} className="py-2 text-center text-xs font-medium text-white/90">{day}</div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="h-16 bg-slate-50/50" />;
          
          const examCount = examsByDay[day] || 0;
          const isToday = isCurrentMonth && day === todayDate;
          const isSelected = isSelectedMonth && day === selectedDay;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasExams = examCount > 0;
          
          return (
            <button
              key={day}
              onClick={() => onDayClick(dateStr)}
              className={`h-16 p-1 border-b border-r border-slate-100 transition-colors text-left flex flex-col ${
                isSelected 
                  ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500' 
                  : hasExams 
                    ? 'hover:bg-indigo-50 bg-indigo-50/30' 
                    : 'hover:bg-slate-50'
              }`}
              data-testid={`student-calendar-day-${day}`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm ${
                isToday 
                  ? 'bg-indigo-600 text-white font-bold' 
                  : hasExams 
                    ? 'text-indigo-700 font-semibold'
                    : 'text-slate-600'
              }`}>
                {day}
              </span>
              {examCount > 0 && (
                <div className="mt-auto">
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
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

// Format relative date
function formatRelativeDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(date);
  examDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return '¡Hoy!';
  if (diffDays === 1) return 'Mañana';
  if (diffDays === -1) return 'Ayer';
  if (diffDays > 0 && diffDays <= 7) return `En ${diffDays} días`;
  if (diffDays < 0) return 'Pasado';
  return '';
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function StudentExamSchedulePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data
  const [exams, setExams] = useState([]);
  const [gradeName, setGradeName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [schoolSettings, setSchoolSettings] = useState(null);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Load exams for current month
  const loadExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get date range for current month view (include a bit before and after)
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
      
      const [examsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/student/exam-schedule?from_date=${fromDate}&to_date=${toDate}`, { headers }),
        axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
      ]);
      
      setExams(examsRes.data.exams || []);
      setGradeName(examsRes.data.grade_name || "");
      setSectionName(examsRes.data.section_name || "");
      
      if (settingsRes.data) {
        setSchoolSettings(settingsRes.data);
      }
    } catch (err) {
      console.error("Error loading exams:", err);
      setError("No se pudo cargar el calendario de exámenes.");
    } finally {
      setLoading(false);
    }
  }, [currentMonth, token]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  // Month navigation
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  // Get exams for selected date
  const examsForSelectedDate = selectedDate 
    ? exams.filter(e => e.date === selectedDate)
    : [];

  // Month name
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const currentMonthName = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  const schoolName = schoolSettings?.system_name || user?.school_name || "Portal Alumno";
  const logoUrl = schoolSettings?.logo_url;

  // Stats
  const upcomingCount = exams.filter(e => e.status === 'upcoming').length;

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="student-exam-schedule-page">
      {/* Student Sidebar */}
      <StudentSidebar
        active="examenes"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
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
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-3" data-testid="student-exam-title">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              Mis Exámenes
            </h1>
            {(gradeName || sectionName) && (
              <p className="text-slate-500 mt-2 ml-13 flex items-center gap-2" data-testid="student-exam-context">
                <GraduationCap className="w-4 h-4" />
                <span className="font-medium text-slate-700">{gradeName}</span>
                {sectionName && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>Sección {sectionName}</span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20" data-testid="student-exam-loading">
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
                <p className="text-slate-500">Cargando exámenes...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center" data-testid="student-exam-error">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-700 font-medium">{error}</p>
              <button 
                onClick={loadExams}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <>
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Este mes</p>
                  <p className="text-2xl font-bold text-slate-800">{exams.length}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-sm text-blue-600">Próximos</p>
                  <p className="text-2xl font-bold text-blue-700">{upcomingCount}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Materias</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {new Set(exams.map(e => e.subject_id)).size}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Profesores</p>
                  <p className="text-2xl font-bold text-violet-600">
                    {new Set(exams.map(e => e.teacher_id).filter(Boolean)).size}
                  </p>
                </div>
              </div>

              {/* Calendar View */}
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
                  <StudentExamCalendar
                    currentMonth={currentMonth}
                    exams={exams}
                    onDayClick={(dateStr) => setSelectedDate(dateStr)}
                    selectedDate={selectedDate}
                  />
                  
                  {/* Info banner */}
                  <div className="mt-4 p-3 bg-indigo-50 rounded-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-medium text-indigo-700">
                      {gradeName} - Sección {sectionName}
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
                    <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-xl">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {selectedDate ? (
                          <>
                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-PE', { 
                              weekday: 'long', 
                              day: 'numeric', 
                              month: 'long' 
                            })}
                            {formatRelativeDate(selectedDate) && (
                              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                                {formatRelativeDate(selectedDate)}
                              </span>
                            )}
                          </>
                        ) : (
                          "Selecciona un día"
                        )}
                      </h3>
                    </div>

                    {/* Panel Content */}
                    <div className="p-4 max-h-[500px] overflow-y-auto">
                      {!selectedDate ? (
                        <div className="text-center py-8 text-slate-500">
                          <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <p>Haz clic en un día del calendario para ver tus exámenes</p>
                        </div>
                      ) : examsForSelectedDate.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-3xl">🎉</span>
                          </div>
                          <h4 className="font-semibold text-slate-700 mb-1">¡Sin exámenes!</h4>
                          <p className="text-slate-500 text-sm">No tienes exámenes programados este día</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {examsForSelectedDate.map(exam => (
                            <StudentExamCard key={exam.id} exam={exam} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
