import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import MobileBottomNav from "../components/MobileBottomNav";
import HeroCarousel from "../components/HeroCarousel";
import MiniCalendar from "../components/MiniCalendar";
import BirthdayMonthCarousel from "../components/BirthdayMonthCarousel";
import BroadcastPopup from "../components/BroadcastPopup";
import {
  BookOpen,
  ClipboardList,
  Bell,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  GraduationCap,
  User,
  Users,
  Menu,
  TrendingUp,
  CalendarCheck
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Priority badge colors
const PRIORITY_COLORS = {
  normal: "bg-blue-100 text-blue-700",
  important: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700"
};

// Student Profile Card Component
function StudentProfileCard({ profile, dashboardData, academic }) {
  const userPhoto = profile?.user?.photo_url;
  const userName = profile?.user?.name || "Alumno";
  const userLastName = profile?.user?.last_name || "";
  const fullName = userLastName ? `${userName} ${userLastName}` : userName;
  
  // Get academic info
  const gradeName = academic?.grado?.nombre || "";
  const sectionName = academic?.seccion?.nombre || "";
  const levelName = academic?.nivel?.nombre || "";
  const academicInfo = [gradeName, sectionName].filter(Boolean).join(" – ");
  
  // Get stats from dashboard data
  const coursesCount = dashboardData?.courses_count || 0;
  const classmates = dashboardData?.section_students_count || 0;
  const pendingTasks = dashboardData?.upcoming_tasks?.length || 0;
  
  // Calculate attendance percentage
  const attendance = dashboardData?.attendance_summary;
  let attendancePercent = "N/A";
  if (attendance) {
    const total = (attendance.present || 0) + (attendance.absent || 0) + (attendance.late || 0) + (attendance.justified || 0);
    if (total > 0) {
      const attended = (attendance.present || 0) + (attendance.justified || 0);
      attendancePercent = `${Math.round((attended / total) * 100)}%`;
    }
  }

  // Get initials for default avatar
  const getInitials = (name) => {
    if (!name) return "A";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center" data-testid="student-profile-card">
      {/* Avatar */}
      <div className="relative w-20 h-20 mx-auto mb-3">
        {userPhoto ? (
          <img
            src={userPhoto}
            alt={fullName}
            className="w-full h-full object-cover rounded-full border-3 border-white shadow-md"
            onError={(e) => { 
              e.target.style.display = 'none';
              e.target.nextSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`w-full h-full rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-bold text-2xl border-3 border-white shadow-md ${userPhoto ? 'hidden' : ''}`}>
          {getInitials(fullName)}
        </div>
        <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" title="En línea" />
      </div>

      {/* Role Badge */}
      <div className="mb-2 flex justify-center">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-cyan-100 text-cyan-700 border-cyan-200">
          <GraduationCap className="w-3 h-3" />
          ALUMNO
        </span>
      </div>
      
      {/* Name */}
      <h4 className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {fullName}
      </h4>
      
      {/* Academic Info */}
      {academicInfo && (
        <p className="text-sm text-slate-600 mt-1 font-medium">{academicInfo}</p>
      )}
      {levelName && (
        <p className="text-xs text-slate-400 mt-0.5">{levelName}</p>
      )}

      {/* Stats Grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{coursesCount}</p>
          <p className="text-[11px] text-slate-500">Cursos</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{classmates}</p>
          <p className="text-[11px] text-slate-500">Compañeros</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{pendingTasks}</p>
          <p className="text-[11px] text-slate-500">Tareas Pend.</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{attendancePercent}</p>
          <p className="text-[11px] text-slate-500">Asistencia</p>
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("inicio");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [banners, setBanners] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  
  // Pagination states
  const [coursesPage, setCoursesPage] = useState(1);
  const [tasksPage, setTasksPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const headers = { Authorization: `Bearer ${token}` };

  // Heartbeat for presence - mark user as online
  const sendHeartbeat = useCallback(async () => {
    try {
      await axios.post(`${API}/api/presence/heartbeat`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.error("Heartbeat error:", err);
    }
  }, [token]);

  // Setup heartbeat interval
  useEffect(() => {
    // Send initial heartbeat
    sendHeartbeat();
    
    // Setup interval (every 30 seconds)
    const interval = setInterval(sendHeartbeat, 30000);
    
    // Cleanup on unmount - mark offline
    return () => {
      clearInterval(interval);
      axios.post(`${API}/api/presence/offline`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    };
  }, [sendHeartbeat, token]);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get date range for calendar events (this month + next 2 months)
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0).toISOString().split('T')[0];

      const [profileRes, dashboardRes, coursesRes, settingsRes, bannersRes, calendarRes] = await Promise.all([
        axios.get(`${API}/api/student/profile`, { headers }),
        axios.get(`${API}/api/student/dashboard`, { headers }),
        axios.get(`${API}/api/student/courses`, { headers }),
        axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/api/dashboard/banners/active`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/calendar/events?start_date=${startDate}&end_date=${endDate}`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setStudentProfile(profileRes.data);
      setDashboardData(dashboardRes.data);
      setCourses(coursesRes.data.courses || []);
      setBanners(bannersRes.data || []);
      setCalendarEvents(calendarRes.data || []);
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }
    } catch (err) {
      console.error("Error loading student data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Get display values from settings
  const schoolName = settings?.system_name || user?.school_name || "Portal Alumno";
  const logoUrl = settings?.logo_url;

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando tu portal...</p>
        </div>
      </div>
    );
  }

  const academic = studentProfile?.academic || {};

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Student Sidebar */}
      <StudentSidebar
        active={activeSection}
        onNavigate={setActiveSection}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={studentProfile?.user}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Identical to Owner's Portal */}
        <StudentHeader
          user={studentProfile?.user || user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
        />

        {/* Dashboard Content */}
        <BroadcastPopup token={token} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {/* Quick Stats - Premium Glass Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Mis Cursos - Premium Dark Gradient */}
            <div 
              onClick={() => navigateTo("/student/courses")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)',
                boxShadow: '0 10px 40px -10px rgba(15, 23, 42, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              }}
              data-testid="stat-card-courses"
            >
              {/* Decorative gradient orb */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-600/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 opacity-80" />
              
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/20 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-lg">
                    <BookOpen className="w-5 h-5 text-cyan-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300 tracking-wide">Mis Cursos</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.courses_count || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Tareas Pendientes - Premium Blue Gradient */}
            <div 
              onClick={() => navigateTo("/student/tasks")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                boxShadow: '0 10px 40px -10px rgba(37, 99, 235, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
              data-testid="stat-card-tasks"
            >
              {/* Decorative elements */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-[100px]" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-sky-300 via-blue-200 to-indigo-300 opacity-60" />
              
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-blue-100 tracking-wide">Tareas Pendientes</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.upcoming_tasks?.length || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-blue-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Asistencias - Premium Emerald Gradient */}
            <div 
              onClick={() => navigateTo("/student/attendance")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                boxShadow: '0 10px 40px -10px rgba(5, 150, 105, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
              data-testid="stat-card-attendance"
            >
              {/* Decorative elements */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-4 right-4 w-16 h-16 border-4 border-white/10 rounded-full" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-300 via-green-200 to-teal-300 opacity-60" />
              
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <CalendarCheck className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-emerald-100 tracking-wide">Asistencias</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.attendance_summary?.present || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-emerald-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Mensajes - Premium Amber/Gold Gradient */}
            <div 
              onClick={() => navigateTo("/student/messages")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
                boxShadow: '0 10px 40px -10px rgba(217, 119, 6, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
              data-testid="stat-card-messages"
            >
              {/* Decorative elements */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute top-4 right-4 w-3 h-3 bg-white/40 rounded-full animate-pulse" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-300 opacity-60" />
              
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-amber-100 tracking-wide">Mensajes</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {studentProfile?.unread_messages || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-amber-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* Mi Libreta — Quick Access (Fase 3 - Turno F1) */}
          {settings?.show_libreta_student !== false && (
          <div
            onClick={() => navigateTo(`/libreta/${user?.id}`)}
            className="bg-white border border-slate-200 rounded-2xl px-5 py-4 mb-6 cursor-pointer group transition-all duration-200 hover:shadow-md hover:border-indigo-200"
            data-testid="student-mi-libreta-card"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                <GraduationCap className="w-7 h-7 text-indigo-600" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-slate-900 leading-tight">Mi Libreta del Estudiante</p>
                <p className="text-sm text-slate-500 mt-0.5">Calificaciones, conducta, asistencia y situación final por bimestre</p>
              </div>
              <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </div>
          </div>
          )}

          {/* Progress Bars - Progreso de Tareas y Asistencia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Progreso de Tareas */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200" data-testid="progress-tasks">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-slate-800">Progreso de Tareas</span>
                </div>
                <span className={`text-2xl font-bold ${
                  !dashboardData?.task_progress?.total_tasks ? "text-slate-400" :
                  dashboardData?.task_progress?.percentage >= 80 ? "text-emerald-600" :
                  dashboardData?.task_progress?.percentage >= 50 ? "text-amber-600" : "text-red-600"
                }`}>
                  {dashboardData?.task_progress?.total_tasks 
                    ? `${dashboardData.task_progress.percentage}%`
                    : "—"
                  }
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    !dashboardData?.task_progress?.total_tasks ? "bg-slate-200" :
                    dashboardData?.task_progress?.percentage >= 80 ? "bg-gradient-to-r from-emerald-500 to-emerald-600" :
                    dashboardData?.task_progress?.percentage >= 50 ? "bg-gradient-to-r from-amber-500 to-amber-600" : 
                    "bg-gradient-to-r from-red-500 to-red-600"
                  }`}
                  style={{ width: `${dashboardData?.task_progress?.percentage || 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {dashboardData?.task_progress?.total_tasks 
                  ? `${dashboardData.task_progress.tasks_submitted} de ${dashboardData.task_progress.total_tasks} tareas entregadas`
                  : "Sin tareas asignadas aún"
                }
              </p>
            </div>

            {/* Asistencia */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200" data-testid="progress-attendance">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-emerald-500" />
                  <span className="font-semibold text-slate-800">Asistencia</span>
                </div>
                <span className="text-2xl font-bold text-emerald-600">
                  {(() => {
                    const summary = dashboardData?.attendance_summary;
                    if (!summary) return "N/A";
                    const total = (summary.present || 0) + (summary.absent || 0) + (summary.late || 0) + (summary.justified || 0);
                    if (total === 0) return "N/A";
                    const attended = (summary.present || 0) + (summary.justified || 0);
                    return `${Math.round((attended / total) * 100)}%`;
                  })()}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(() => {
                      const summary = dashboardData?.attendance_summary;
                      if (!summary) return 0;
                      const total = (summary.present || 0) + (summary.absent || 0) + (summary.late || 0) + (summary.justified || 0);
                      if (total === 0) return 0;
                      const attended = (summary.present || 0) + (summary.justified || 0);
                      return (attended / total) * 100;
                    })()}%` 
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {(() => {
                  const summary = dashboardData?.attendance_summary;
                  if (!summary) return "Sin datos de asistencia";
                  const total = (summary.present || 0) + (summary.absent || 0) + (summary.late || 0) + (summary.justified || 0);
                  const attended = (summary.present || 0) + (summary.justified || 0);
                  return `${attended} de ${total} días registrados`;
                })()}
              </p>
            </div>
          </div>

          {/* Two Column Layout - Like Owner's Portal */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left column - Main content */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Hero Carousel */}
              <HeroCarousel 
                banners={banners} 
                user={studentProfile?.user || user} 
                schoolName={schoolName} 
              />

              {/* Two Column Grid: My Courses & Upcoming Tasks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mis Cursos - With Pagination */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-cyan-500" />
                      Mis Cursos
                      <span className="text-xs font-normal text-slate-400 ml-1">({courses.length})</span>
                    </h2>
                    <button 
                      onClick={() => navigateTo("/student/courses")}
                      className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
                    >
                      Ver todos <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="divide-y divide-slate-100 flex-1">
                    {courses.length > 0 ? (
                      courses
                        .slice((coursesPage - 1) * ITEMS_PER_PAGE, coursesPage * ITEMS_PER_PAGE)
                        .map((course) => (
                        <div 
                          key={course.id}
                          onClick={() => navigateTo(`/student/courses/${course.id}`)}
                          className="px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3"
                        >
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: course.color || "#6366f1" }}
                          >
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 truncate text-sm">{course.name}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {course.teacher_name || course.teacher?.name || "Sin profesor asignado"}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p className="text-sm">No tienes cursos asignados</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Pagination Footer for Courses */}
                  {courses.length > ITEMS_PER_PAGE && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="text-xs text-slate-500">
                        {(coursesPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(coursesPage * ITEMS_PER_PAGE, courses.length)} de {courses.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCoursesPage(p => Math.max(1, p - 1))}
                          disabled={coursesPage === 1}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        <div className="flex items-center gap-1 px-2">
                          {Array.from({ length: Math.ceil(courses.length / ITEMS_PER_PAGE) }, (_, i) => (
                            <button
                              key={i + 1}
                              onClick={() => setCoursesPage(i + 1)}
                              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                                coursesPage === i + 1
                                  ? "bg-cyan-500 text-white"
                                  : "text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setCoursesPage(p => Math.min(Math.ceil(courses.length / ITEMS_PER_PAGE), p + 1))}
                          disabled={coursesPage === Math.ceil(courses.length / ITEMS_PER_PAGE)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tareas Próximas - With Pagination */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-amber-500" />
                      Tareas Próximas
                      <span className="text-xs font-normal text-slate-400 ml-1">({dashboardData?.upcoming_tasks?.length || 0})</span>
                    </h2>
                    <button 
                      onClick={() => navigateTo("/student/tasks")}
                      className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
                    >
                      Ver todas <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="divide-y divide-slate-100 flex-1">
                    {dashboardData?.upcoming_tasks?.length > 0 ? (
                      dashboardData.upcoming_tasks
                        .slice((tasksPage - 1) * ITEMS_PER_PAGE, tasksPage * ITEMS_PER_PAGE)
                        .map((task) => {
                          const dueDate = task.due_date || task.metadata?.due_date;
                          return (
                          <div 
                            key={task.id}
                            onClick={() => navigateTo(`/student/courses/${task.subject_id}?task=${task.id}`)}
                            className="px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3"
                            data-testid={`upcoming-task-${task.id}`}
                          >
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: task.subject_color || "#f59e0b" }}
                            >
                              <ClipboardList className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 truncate text-sm">{task.title}</p>
                              <p className="text-xs text-slate-500 truncate">{task.subject_name}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-medium text-slate-600">
                                {dueDate && !isNaN(new Date(dueDate).getTime())
                                  ? new Date(dueDate).toLocaleDateString("es-PE", { day: "numeric", month: "short" })
                                  : "Sin fecha"}
                              </p>
                              <p className="text-[10px] text-slate-400">Fecha límite</p>
                            </div>
                          </div>
                          );
                        })
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                        <p className="font-medium text-slate-700">¡Estás al día!</p>
                        <p className="text-xs text-slate-400 mt-1">No tienes tareas pendientes</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Pagination Footer for Tasks */}
                  {(dashboardData?.upcoming_tasks?.length || 0) > ITEMS_PER_PAGE && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="text-xs text-slate-500">
                        {(tasksPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(tasksPage * ITEMS_PER_PAGE, dashboardData.upcoming_tasks.length)} de {dashboardData.upcoming_tasks.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setTasksPage(p => Math.max(1, p - 1))}
                          disabled={tasksPage === 1}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        <div className="flex items-center gap-1 px-2">
                          {Array.from({ length: Math.ceil(dashboardData.upcoming_tasks.length / ITEMS_PER_PAGE) }, (_, i) => (
                            <button
                              key={i + 1}
                              onClick={() => setTasksPage(i + 1)}
                              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                                tasksPage === i + 1
                                  ? "bg-amber-500 text-white"
                                  : "text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setTasksPage(p => Math.min(Math.ceil(dashboardData.upcoming_tasks.length / ITEMS_PER_PAGE), p + 1))}
                          disabled={tasksPage === Math.ceil(dashboardData.upcoming_tasks.length / ITEMS_PER_PAGE)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Announcements */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-indigo-500" />
                    Anuncios Recientes
                  </h2>
                </div>
                
                <div className="divide-y divide-slate-100 flex-1 flex flex-col">
                  {dashboardData?.recent_announcements?.length > 0 ? (
                    dashboardData.recent_announcements.map((ann) => (
                      <div 
                        key={ann.id}
                        className="px-5 py-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                            ann.priority === "urgent" ? "bg-red-500" :
                            ann.priority === "important" ? "bg-amber-500" : "bg-blue-500"
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-slate-800">{ann.title}</p>
                              {!ann.is_read && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-cyan-100 text-cyan-700 rounded">NUEVO</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {new Date(ann.created_at).toLocaleDateString("es-PE", { 
                                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" 
                              })}
                            </p>
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ann.priority] || PRIORITY_COLORS.normal}`}>
                            {ann.priority === "urgent" ? "Urgente" : ann.priority === "important" ? "Importante" : "Normal"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-8 text-center text-slate-500 flex-1 flex flex-col items-center justify-center">
                      <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p>No hay anuncios recientes</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column - Profile Card & Calendar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Student Profile Card */}
              <StudentProfileCard 
                profile={studentProfile}
                dashboardData={dashboardData}
                academic={academic}
              />

              {/* Birthdays of the month */}
              <BirthdayMonthCarousel token={token} standalone />

              {/* Calendar - Same data as Owner's Portal */}
              <MiniCalendar events={calendarEvents} />
            </div>
          </div>
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
      <MobileBottomNav role="student" />
    </div>
  );
}
