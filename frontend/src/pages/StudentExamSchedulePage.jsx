import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  Calendar,
  Clock,
  BookOpen,
  User,
  Loader2,
  AlertCircle,
  GraduationCap,
  MapPin,
  FileText,
  Timer,
  Archive,
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

// Student Exam Card - Read Only
function StudentExamCard({ exam }) {
  const typeConfig = EXAM_TYPES[exam.type] || EXAM_TYPES.parcial;
  
  return (
    <div 
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
      style={{ borderLeftWidth: '4px', borderLeftColor: exam.subject_color || typeConfig.color }}
      data-testid={`student-exam-card-${exam.id}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0"
          style={{ backgroundColor: exam.subject_color || typeConfig.color }}
        >
          {typeConfig.icon}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-bold text-slate-800">{exam.subject_name}</h4>
            <ExamStatusBadge status={exam.status} />
          </div>
          
          {/* Title */}
          <p className="text-sm text-slate-600 mb-2">{exam.title}</p>
          
          {/* Type Badge */}
          <span 
            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white mb-2"
            style={{ backgroundColor: typeConfig.color }}
          >
            {typeConfig.icon} {typeConfig.label}
          </span>
          
          {/* Details */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
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
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
              <span>{exam.teacher_name}</span>
            </div>
          )}
          
          {/* Description if exists */}
          {exam.description && (
            <p className="mt-2 text-sm text-slate-500 italic">
              {exam.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Group exams by date
function groupExamsByDate(exams) {
  const groups = {};
  exams.forEach(exam => {
    if (!groups[exam.date]) {
      groups[exam.date] = [];
    }
    groups[exam.date].push(exam);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(date);
  examDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
  
  let relativeText = '';
  if (diffDays === 0) relativeText = '(Hoy)';
  else if (diffDays === 1) relativeText = '(Mañana)';
  else if (diffDays === -1) relativeText = '(Ayer)';
  else if (diffDays > 0 && diffDays <= 7) relativeText = `(en ${diffDays} días)`;
  
  const formatted = date.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  return { formatted, relativeText, isPast: diffDays < 0, isToday: diffDays === 0 };
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

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [examsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/student/exam-schedule`, { headers }),
        axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null }))
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
  };

  const schoolName = schoolSettings?.system_name || user?.school_name || "Portal Alumno";
  const logoUrl = schoolSettings?.logo_url;

  // Group exams by date
  const groupedExams = groupExamsByDate(exams);

  // Stats
  const upcomingCount = exams.filter(e => e.status === 'upcoming').length;
  const ongoingCount = exams.filter(e => e.status === 'ongoing').length;

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
                onClick={loadData}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : exams.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="student-exam-empty">
              <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <Calendar className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                No hay exámenes programados
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Actualmente no tienes exámenes programados. Cuando tu profesor programe evaluaciones, aparecerán aquí.
              </p>
            </div>
          ) : (
            <>
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Total exámenes</p>
                  <p className="text-2xl font-bold text-slate-800">{exams.length}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-sm text-blue-600">Próximos</p>
                  <p className="text-2xl font-bold text-blue-700">{upcomingCount}</p>
                </div>
                {ongoingCount > 0 && (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <p className="text-sm text-amber-600">En curso</p>
                    <p className="text-2xl font-bold text-amber-700">{ongoingCount}</p>
                  </div>
                )}
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Materias</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {new Set(exams.map(e => e.subject_id)).size}
                  </p>
                </div>
              </div>

              {/* Grouped by Date */}
              <div className="space-y-6">
                {groupedExams.map(([date, dateExams]) => {
                  const { formatted, relativeText, isPast, isToday } = formatDate(date);
                  
                  return (
                    <div key={date} data-testid={`exam-date-group-${date}`}>
                      {/* Date Header */}
                      <div className={`flex items-center gap-3 mb-3 ${isPast ? 'opacity-60' : ''}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isToday ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800 capitalize">
                            {formatted}
                          </h3>
                          {relativeText && (
                            <span className={`text-sm ${isToday ? 'text-indigo-600 font-medium' : 'text-slate-500'}`}>
                              {relativeText}
                            </span>
                          )}
                        </div>
                        <span className="ml-auto text-sm text-slate-400">
                          {dateExams.length} {dateExams.length === 1 ? 'examen' : 'exámenes'}
                        </span>
                      </div>

                      {/* Exams for this date */}
                      <div className="space-y-3 ml-13">
                        {dateExams.map(exam => (
                          <StudentExamCard key={exam.id} exam={exam} />
                        ))}
                      </div>
                    </div>
                  );
                })}
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
