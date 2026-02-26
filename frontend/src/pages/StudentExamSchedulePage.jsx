import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  Calendar, Clock, User, Loader2, AlertCircle, GraduationCap,
  FileText, Timer, Archive, ChevronLeft, ChevronRight, Play,
  CheckCircle, BookOpen, TrendingUp, Target, Sparkles, ArrowRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const EXAM_TYPES = {
  parcial: { label: "Parcial", color: "#6366F1", bg: "bg-indigo-500", light: "bg-indigo-50 text-indigo-700" },
  final: { label: "Final", color: "#DC2626", bg: "bg-rose-500", light: "bg-rose-50 text-rose-700" },
  "práctica": { label: "Practica", color: "#059669", bg: "bg-emerald-500", light: "bg-emerald-50 text-emerald-700" },
  quiz: { label: "Quiz", color: "#F59E0B", bg: "bg-amber-500", light: "bg-amber-50 text-amber-700" }
};

function ExamStatusBadge({ status }) {
  const config = {
    upcoming: { label: "Proximo", cls: "bg-blue-100 text-blue-700 border-blue-200", icon: Timer },
    in_progress: { label: "En curso", cls: "bg-amber-100 text-amber-700 border-amber-200 animate-pulse", icon: Clock },
    ongoing: { label: "En curso", cls: "bg-amber-100 text-amber-700 border-amber-200 animate-pulse", icon: Clock },
    completed: { label: "Finalizado", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: Archive },
    finished: { label: "Finalizado", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: Archive }
  }[status] || { label: status, cls: "bg-slate-100 text-slate-500 border-slate-200", icon: Clock };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${config.cls}`}>
      <Icon className="w-3 h-3" /> {config.label}
    </span>
  );
}

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(date);
  examDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Manana";
  if (diffDays === -1) return "Ayer";
  if (diffDays > 0 && diffDays <= 7) return `En ${diffDays} dias`;
  if (diffDays < 0) return "Pasado";
  return "";
}

// ═══════════════════════════════════════════════════════════════════
// EXAM CARD - Premium
// ═══════════════════════════════════════════════════════════════════
function StudentExamCard({ exam }) {
  const typeConfig = EXAM_TYPES[exam.type] || EXAM_TYPES.parcial;
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const isAvailable = exam.is_available && !exam.has_attempted;
  const hasAttempted = exam.has_attempted;
  const handleTakeExam = () => {
    const prefix = subdomain ? `/school/${subdomain}` : "";
    navigate(`${prefix}/student/exam/${exam.id}`);
  };

  return (
    <div className="group relative" data-testid={`student-exam-card-${exam.id}`}>
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all duration-300">
        {/* Color bar */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${typeConfig.color}, ${typeConfig.color}88)` }} />
        
        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg" style={{ backgroundColor: typeConfig.color }}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-800">{exam.subject_name}</h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeConfig.light}`}>{typeConfig.label}</span>
                <ExamStatusBadge status={exam.status} />
              </div>
              <p className="text-slate-600 text-sm font-medium mt-0.5">{exam.title}</p>
            </div>
          </div>

          {/* Info chips */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium">{exam.start_time} - {exam.end_time}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg text-xs text-slate-600">
              <Timer className="w-3.5 h-3.5 text-slate-400" />
              <span>{exam.duration_minutes} min</span>
            </div>
            {exam.teacher_name && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg text-xs text-slate-600">
                {exam.teacher_photo ? (
                  <img src={exam.teacher_photo} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <User className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{exam.teacher_name}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {exam.description && (
            <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">{exam.description}</p>
          )}

          {/* Action */}
          {isAvailable ? (
            <button
              onClick={handleTakeExam}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
              data-testid={`take-exam-btn-${exam.id}`}
            >
              <Play className="w-4 h-4" /> Rendir Examen
            </button>
          ) : hasAttempted ? (
            <div className="w-full py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2" data-testid={`exam-completed-${exam.id}`}>
              <CheckCircle className="w-4 h-4" /> Examen rendido
              {exam.attempt_score != null && <span className="px-2 py-0.5 bg-emerald-100 rounded-full text-xs font-bold">{exam.attempt_score}%</span>}
            </div>
          ) : exam.status === "upcoming" ? (
            <div className="w-full py-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
              <Timer className="w-4 h-4" /> Disponible pronto
            </div>
          ) : exam.status === "completed" ? (
            <div className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
              <Archive className="w-4 h-4" /> Examen finalizado
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════════════
function StudentExamCalendar({ currentMonth, exams, onDayClick, selectedDate }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const examsByDay = {};
  exams.forEach(exam => {
    const day = parseInt(exam.date.split("-")[2]);
    examsByDay[day] = (examsByDay[day] || 0) + 1;
  });

  const days = [];
  for (let i = 0; i < adjustedStartDay; i++) days.push(null);
  for (let day = 1; day <= totalDays; day++) days.push(day);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();
  const selectedDay = selectedDate ? parseInt(selectedDate.split("-")[2]) : null;
  const selectedMonth = selectedDate ? parseInt(selectedDate.split("-")[1]) - 1 : null;
  const selectedYear = selectedDate ? parseInt(selectedDate.split("-")[0]) : null;
  const isSelectedMonth = selectedYear === year && selectedMonth === month;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm" data-testid="student-exam-calendar">
      <div className="grid grid-cols-7">
        {weekDays.map(day => (
          <div key={day} className="py-2.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="h-[72px] bg-slate-50/30 border-b border-r border-slate-50" />;
          const examCount = examsByDay[day] || 0;
          const isToday = isCurrentMonth && day === todayDate;
          const isSelected = isSelectedMonth && day === selectedDay;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasExams = examCount > 0;
          return (
            <button
              key={day}
              onClick={() => onDayClick(dateStr)}
              className={`h-[72px] p-1.5 border-b border-r border-slate-100/80 transition-all text-left flex flex-col relative group/day ${
                isSelected ? "bg-indigo-50 ring-2 ring-inset ring-indigo-400" : hasExams ? "hover:bg-indigo-50/50" : "hover:bg-slate-50"
              }`}
              data-testid={`student-calendar-day-${day}`}
            >
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm transition-colors ${
                isToday ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/30" : isSelected ? "bg-indigo-100 text-indigo-700 font-bold" : hasExams ? "text-indigo-700 font-semibold" : "text-slate-500 group-hover/day:text-slate-700"
              }`}>{day}</span>
              {hasExams && (
                <div className="mt-auto flex items-center gap-0.5">
                  {Array.from({ length: Math.min(examCount, 3) }).map((_, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  ))}
                  {examCount > 3 && <span className="text-[9px] text-indigo-500 font-bold ml-0.5">+{examCount - 3}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// UPCOMING EXAM ROW (for the list below calendar)
// ═══════════════════════════════════════════════════════════════════
function UpcomingExamRow({ exam, onNavigate }) {
  const typeConfig = EXAM_TYPES[exam.type] || EXAM_TYPES.parcial;
  const relDate = formatRelativeDate(exam.date);
  const isAvailable = exam.is_available && !exam.has_attempted;
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors rounded-xl cursor-pointer group" onClick={onNavigate}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: typeConfig.color }}>
        <BookOpen className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{exam.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
          <span>{exam.subject_name}</span>
          <span className="text-slate-300">|</span>
          <span>{exam.date.split("-").reverse().join("/")}</span>
          <span className="text-slate-300">|</span>
          <span>{exam.start_time}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {relDate && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${relDate === "Hoy" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{relDate}</span>}
        {isAvailable ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Disponible</span>
        ) : (
          <ExamStatusBadge status={exam.status} />
        )}
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export default function StudentExamSchedulePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exams, setExams] = useState([]);
  const [gradeName, setGradeName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [schoolSettings, setSchoolSettings] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const fromDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const toDate = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;
      const [examsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/student/exam-schedule?from_date=${fromDate}&to_date=${toDate}`, { headers }),
        axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
      ]);
      setExams(examsRes.data.exams || []);
      setGradeName(examsRes.data.grade_name || "");
      setSectionName(examsRes.data.section_name || "");
      if (settingsRes.data) setSchoolSettings(settingsRes.data);
    } catch (err) {
      setError("No se pudo cargar el calendario de examenes.");
    } finally {
      setLoading(false);
    }
  }, [currentMonth, token]);

  useEffect(() => { loadExams(); }, [loadExams]);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToday = () => {
    setCurrentMonth(new Date());
    const today = new Date();
    setSelectedDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
  };

  const examsForSelectedDate = selectedDate ? exams.filter(e => e.date === selectedDate) : [];
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const currentMonthName = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  const schoolName = schoolSettings?.system_name || user?.school_name || "Portal Alumno";
  const logoUrl = schoolSettings?.logo_url;

  const upcomingExams = exams.filter(e => e.status === "upcoming" || e.status === "in_progress").sort((a, b) => a.date.localeCompare(b.date));
  const completedCount = exams.filter(e => e.status === "completed" || e.has_attempted).length;
  const inProgressCount = exams.filter(e => e.status === "in_progress").length;

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex" data-testid="student-exam-schedule-page">
      <StudentSidebar active="examenes" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain || user?.subdomain} user={user} />
      {sidebarExpanded && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#1e293b] flex items-center gap-3" style={{ fontFamily: "Manrope, sans-serif" }} data-testid="student-exam-title">
                Mis Examenes
              </h1>
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                {gradeName && <span className="font-medium text-slate-600">{gradeName}</span>}
                {sectionName && <><span className="text-slate-300">-</span><span>Seccion {sectionName}</span></>}
              </p>
            </div>
            <button onClick={goToday} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm">
              <Calendar className="w-4 h-4 inline mr-1.5" />Hoy
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20" data-testid="student-exam-loading">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center" data-testid="student-exam-error">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-700 font-medium">{error}</p>
              <button onClick={loadExams} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Reintentar</button>
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/20">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
                  <div className="relative">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-3xl font-extrabold text-white">{exams.length}</p>
                    <p className="text-xs text-indigo-200 mt-1 font-medium">Examenes este mes</p>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
                  <div className="relative">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-3xl font-extrabold text-white">{upcomingExams.length}</p>
                    <p className="text-xs text-amber-100 mt-1 font-medium">Proximos / En curso</p>
                    {inProgressCount > 0 && <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-white rounded-full animate-pulse" />}
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
                  <div className="relative">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-3xl font-extrabold text-white">{completedCount}</p>
                    <p className="text-xs text-emerald-100 mt-1 font-medium">Completados</p>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
                  <div className="relative">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-3xl font-extrabold text-white">{new Set(exams.map(e => e.subject_name).filter(Boolean)).size}</p>
                    <p className="text-xs text-violet-200 mt-1 font-medium">Materias</p>
                  </div>
                </div>
              </div>

              {/* Main Grid: Calendar + Detail */}
              <div className="grid lg:grid-cols-5 gap-6 mb-6">
                {/* Calendar */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Month nav */}
                  <div className="flex items-center justify-between">
                    <button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-slate-200">
                      <ChevronLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>{currentMonthName}</h2>
                    <button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-slate-200">
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    </button>
                  </div>

                  <StudentExamCalendar currentMonth={currentMonth} exams={exams} onDayClick={(dateStr) => setSelectedDate(dateStr)} selectedDate={selectedDate} />
                </div>

                {/* Day Detail Panel */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl border border-slate-200/80 h-full overflow-hidden shadow-sm">
                    <div className="px-5 py-4 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600">
                      <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">Detalle del dia</p>
                      <h3 className="font-bold text-white flex items-center gap-2 text-lg" style={{ fontFamily: "Manrope, sans-serif" }}>
                        {selectedDate ? (
                          <>
                            {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
                            {formatRelativeDate(selectedDate) && (
                              <span className="text-xs px-2 py-0.5 bg-white/15 rounded-full font-medium">{formatRelativeDate(selectedDate)}</span>
                            )}
                          </>
                        ) : "Selecciona un dia"}
                      </h3>
                      {selectedDate && (
                        <p className="text-white/60 text-xs mt-1">{examsForSelectedDate.length} examen{examsForSelectedDate.length !== 1 ? "es" : ""} programado{examsForSelectedDate.length !== 1 ? "s" : ""}</p>
                      )}
                    </div>

                    <div className="p-4 max-h-[440px] overflow-y-auto">
                      {!selectedDate ? (
                        <div className="text-center py-10">
                          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-7 h-7 text-slate-300" />
                          </div>
                          <p className="text-sm text-slate-500 font-medium">Selecciona un dia en el calendario</p>
                          <p className="text-xs text-slate-400 mt-1">Veras los examenes programados aqui</p>
                        </div>
                      ) : examsForSelectedDate.length === 0 ? (
                        <div className="text-center py-10">
                          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-7 h-7 text-emerald-400" />
                          </div>
                          <h4 className="font-bold text-slate-700 mb-1">Dia libre</h4>
                          <p className="text-slate-400 text-sm">No hay examenes este dia</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {examsForSelectedDate.map(exam => (
                            <StudentExamCard key={exam.id} exam={exam} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upcoming Exams List */}
              {upcomingExams.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                      <Target className="w-5 h-5 text-indigo-500" />
                      Proximos Examenes
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full">{upcomingExams.length}</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {upcomingExams.map(exam => (
                      <UpcomingExamRow key={exam.id} exam={exam} onNavigate={() => setSelectedDate(exam.date)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <MessageCenter token={token} user={user} />
    </div>
  );
}
