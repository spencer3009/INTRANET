import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MessageCenter from "../components/MessageCenter";
import HeroCarousel from "../components/HeroCarousel";
import MiniCalendar from "../components/MiniCalendar";
import StudentHeader from "../components/StudentHeader";
import {
  BookOpen,
  ClipboardList,
  Bell,
  Users,
  Clock,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  User,
  Menu,
  CalendarCheck,
  FileText,
  AlertCircle,
  Briefcase,
  GraduationCap
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Teacher Profile Card Component
function TeacherProfileCard({ user, dashboardData }) {
  const userPhoto = user?.photo_url;
  const userName = user?.name || "Profesor";
  const userLastName = user?.last_name || "";
  const fullName = userLastName ? `${userName} ${userLastName}` : userName;
  
  // Get stats from dashboard data
  const coursesCount = dashboardData?.courses?.length || 0;
  const studentsCount = dashboardData?.total_students || 0;
  const pendingReviews = dashboardData?.pending_reviews || 0;
  const attendancePending = dashboardData?.today_attendance_pending?.length || 0;

  // Get initials for default avatar
  const getInitials = (name) => {
    if (!name) return "P";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center" data-testid="teacher-profile-card">
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
        <div className={`w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-2xl border-3 border-white shadow-md ${userPhoto ? 'hidden' : ''}`}>
          {getInitials(fullName)}
        </div>
        <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" title="En línea" />
      </div>

      {/* Role Badge */}
      <div className="mb-2 flex justify-center">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-emerald-100 text-emerald-700 border-emerald-200">
          <Briefcase className="w-3 h-3" />
          DOCENTE
        </span>
      </div>
      
      {/* Name */}
      <h4 className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {fullName}
      </h4>
      
      {/* Email */}
      <p className="text-sm text-slate-500 mt-1">{user?.email}</p>

      {/* Stats Grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{coursesCount}</p>
          <p className="text-[11px] text-slate-500">Cursos</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{studentsCount}</p>
          <p className="text-[11px] text-slate-500">Alumnos</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{pendingReviews}</p>
          <p className="text-[11px] text-slate-500">Por Revisar</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CalendarCheck className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{attendancePending}</p>
          <p className="text-[11px] text-slate-500">Asist. Pend.</p>
        </div>
      </div>
    </div>
  );
}

export default function TeacherDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("inicio");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [banners, setBanners] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [settings, setSettings] = useState(null);
  
  // Pagination states
  const [coursesPage, setCoursesPage] = useState(1);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const ITEMS_PER_PAGE = 4;

  const headers = { Authorization: `Bearer ${token}` };

  // Heartbeat for presence
  const sendHeartbeat = useCallback(async () => {
    try {
      await axios.post(`${API}/api/presence/heartbeat`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.error("Heartbeat error:", err);
    }
  }, [token]);

  useEffect(() => {
    loadData();
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [token, sendHeartbeat]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, settingsRes, bannersRes, eventsRes] = await Promise.all([
        axios.get(`${API}/api/teacher/dashboard`, { headers }),
        axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/api/carousel/banners`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/calendar/events`, { headers }).catch(() => ({ data: [] }))
      ]);
      setDashboardData(dashRes.data);
      setSettings(settingsRes.data);
      setBanners(bannersRes.data || []);
      setCalendarEvents(eventsRes.data || []);
    } catch (err) {
      console.error("Error loading teacher dashboard:", err);
      setDashboardData({
        courses: [],
        pending_reviews: 0,
        total_students: 0,
        unread_messages: 0,
        today_attendance_pending: [],
        recent_submissions: []
      });
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  const schoolName = settings?.system_name || "Mi Colegio";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Cargando tu portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <TeacherSidebar
        active={activeSection}
        onNavigate={setActiveSection}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                className="lg:hidden p-2 hover:bg-slate-100 rounded-xl"
              >
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Panel del Docente</h1>
                <p className="text-sm text-slate-500">{schoolName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigateTo("/teacher/messages")}
                className="relative p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {dashboardData?.unread_messages > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {dashboardData.unread_messages}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl">
                <User className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-slate-700 hidden sm:inline">
                  {user?.name || "Profesor"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Quick Stats - Premium Glass Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Mis Cursos - Premium Emerald Gradient */}
            <div 
              onClick={() => navigateTo("/teacher/courses")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                boxShadow: '0 10px 40px -10px rgba(5, 150, 105, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
              data-testid="stat-card-courses"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-4 right-4 w-16 h-16 border-4 border-white/10 rounded-full" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-300 via-green-200 to-teal-300 opacity-60" />
              
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-emerald-100 tracking-wide">Mis Cursos</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.courses?.length || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-emerald-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Por Revisar - Premium Amber Gradient */}
            <div 
              onClick={() => navigateTo("/teacher/tasks")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
                boxShadow: '0 10px 40px -10px rgba(217, 119, 6, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
              data-testid="stat-card-reviews"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute top-4 right-4 w-3 h-3 bg-white/40 rounded-full animate-pulse" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-300 opacity-60" />
              
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-amber-100 tracking-wide">Por Revisar</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.pending_reviews || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-amber-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Mis Alumnos - Premium Blue Gradient */}
            <div 
              onClick={() => navigateTo("/teacher/students")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                boxShadow: '0 10px 40px -10px rgba(37, 99, 235, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
              data-testid="stat-card-students"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-[100px]" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-sky-300 via-blue-200 to-indigo-300 opacity-60" />
              
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-blue-100 tracking-wide">Mis Alumnos</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.total_students || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-blue-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Asistencia Hoy - Premium Indigo/Dark Gradient */}
            <div 
              onClick={() => navigateTo("/teacher/attendance")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)',
                boxShadow: '0 10px 40px -10px rgba(15, 23, 42, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              }}
              data-testid="stat-card-attendance"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-purple-600/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80" />
              
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-600/20 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-lg">
                    <CalendarCheck className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300 tracking-wide">Asistencia Hoy</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.today_attendance_pending?.length || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left column - Main content */}
            <div className="lg:col-span-8 space-y-6">
              {/* Hero Carousel */}
              <HeroCarousel 
                banners={banners} 
                user={user} 
                schoolName={schoolName} 
              />

              {/* Two Column Grid: My Courses & Submissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mis Cursos - With Pagination */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-500" />
                      Mis Cursos
                    </h2>
                    <button 
                      onClick={() => navigateTo("/teacher/courses")}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                      Ver todos <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="divide-y divide-slate-100 flex-1">
                    {dashboardData?.courses?.length > 0 ? (
                      dashboardData.courses
                        .slice((coursesPage - 1) * ITEMS_PER_PAGE, coursesPage * ITEMS_PER_PAGE)
                        .map((course) => (
                        <div 
                          key={course.id}
                          onClick={() => navigateTo(`/teacher/courses/${course.id}`)}
                          className="px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3"
                        >
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: course.color || "#10b981" }}
                          >
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 truncate text-sm">{course.name}</p>
                            <p className="text-xs text-slate-500">{course.section_name || "Sin sección"}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-medium text-slate-600">{course.students_count || 0}</p>
                            <p className="text-[10px] text-slate-400">alumnos</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                        <p className="font-medium text-slate-700">Sin cursos asignados</p>
                        <p className="text-xs text-slate-400 mt-1">Contacta al coordinador</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Pagination Footer */}
                  {(dashboardData?.courses?.length || 0) > ITEMS_PER_PAGE && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="text-xs text-slate-500">
                        {(coursesPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(coursesPage * ITEMS_PER_PAGE, dashboardData.courses.length)} de {dashboardData.courses.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCoursesPage(p => Math.max(1, p - 1))}
                          disabled={coursesPage === 1}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => setCoursesPage(p => Math.min(Math.ceil(dashboardData.courses.length / ITEMS_PER_PAGE), p + 1))}
                          disabled={coursesPage === Math.ceil(dashboardData.courses.length / ITEMS_PER_PAGE)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Entregas Recientes */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-500" />
                      Entregas Recientes
                    </h2>
                    <button 
                      onClick={() => navigateTo("/teacher/tasks")}
                      className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                    >
                      Ver todas <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="divide-y divide-slate-100 flex-1">
                    {dashboardData?.recent_submissions?.length > 0 ? (
                      dashboardData.recent_submissions
                        .slice((submissionsPage - 1) * ITEMS_PER_PAGE, submissionsPage * ITEMS_PER_PAGE)
                        .map((submission) => (
                        <div 
                          key={submission.id}
                          className="px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3"
                        >
                          {submission.student_photo ? (
                            <img src={submission.student_photo} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-slate-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 truncate text-sm">{submission.student_name}</p>
                            <p className="text-xs text-slate-500 truncate">{submission.task_title}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Clock className="w-4 h-4 text-amber-500 mx-auto mb-0.5" />
                            <p className="text-[10px] text-slate-400">Pendiente</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                        <p className="font-medium text-slate-700">¡Todo revisado!</p>
                        <p className="text-xs text-slate-400 mt-1">No hay entregas pendientes</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Pagination Footer */}
                  {(dashboardData?.recent_submissions?.length || 0) > ITEMS_PER_PAGE && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="text-xs text-slate-500">
                        {(submissionsPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(submissionsPage * ITEMS_PER_PAGE, dashboardData.recent_submissions.length)} de {dashboardData.recent_submissions.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSubmissionsPage(p => Math.max(1, p - 1))}
                          disabled={submissionsPage === 1}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => setSubmissionsPage(p => Math.min(Math.ceil(dashboardData.recent_submissions.length / ITEMS_PER_PAGE), p + 1))}
                          disabled={submissionsPage === Math.ceil(dashboardData.recent_submissions.length / ITEMS_PER_PAGE)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Today's Attendance Alert */}
              {dashboardData?.today_attendance_pending?.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Asistencia Pendiente Hoy
                      </h3>
                      <p className="text-white/80 text-sm mt-1">
                        Tienes {dashboardData.today_attendance_pending.length} sección(es) sin registrar asistencia
                      </p>
                    </div>
                    <button
                      onClick={() => navigateTo("/teacher/attendance")}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors"
                    >
                      Registrar ahora
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right column - Profile Card & Calendar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Teacher Profile Card */}
              <TeacherProfileCard 
                user={user}
                dashboardData={dashboardData}
              />

              {/* Mini Calendar */}
              <MiniCalendar events={calendarEvents} />
            </div>
          </div>
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
