import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import HeroCarousel from "../components/HeroCarousel";
import MiniCalendar from "../components/MiniCalendar";
import {
  BookOpen,
  ClipboardList,
  Bell,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
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
        axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null })),
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
      navigate(`/school/${subdomain}${path}`);
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

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

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
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Quick Stats - Solid Color Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Mis Cursos - Azul Oscuro */}
            <div 
              onClick={() => navigateTo("/student/courses")}
              className="bg-[#0f172a] rounded-2xl p-5 hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group"
              data-testid="stat-card-courses"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-white/80" />
                  </div>
                  <span className="text-sm font-medium text-white/80">Mis Cursos</span>
                </div>
                <p className="text-3xl font-bold text-white">{dashboardData?.courses_count || 0}</p>
              </div>
            </div>

            {/* Tareas Pendientes - Azul Claro */}
            <div 
              onClick={() => navigateTo("/student/tasks")}
              className="bg-[#5b8dee] rounded-2xl p-5 hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group"
              data-testid="stat-card-tasks"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-white/80" />
                  </div>
                  <span className="text-sm font-medium text-white/80">Tareas Pendientes</span>
                </div>
                <p className="text-3xl font-bold text-white">{dashboardData?.upcoming_tasks?.length || 0}</p>
              </div>
            </div>

            {/* Asistencias - Verde */}
            <div 
              onClick={() => navigateTo("/student/attendance")}
              className="bg-[#22c55e] rounded-2xl p-5 hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group"
              data-testid="stat-card-attendance"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <CalendarCheck className="w-4 h-4 text-white/80" />
                  </div>
                  <span className="text-sm font-medium text-white/80">Asistencias</span>
                </div>
                <p className="text-3xl font-bold text-white">{dashboardData?.attendance_summary?.present || 0}</p>
              </div>
            </div>

            {/* Mensajes - Amarillo */}
            <div 
              onClick={() => navigateTo("/student/messages")}
              className="bg-[#d4a912] rounded-2xl p-5 hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group"
              data-testid="stat-card-messages"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-white/80" />
                  </div>
                  <span className="text-sm font-medium text-white/80">Mensajes</span>
                </div>
                <p className="text-3xl font-bold text-white">{studentProfile?.unread_messages || 0}</p>
              </div>
            </div>
          </div>

          {/* Progress Bars - Promedio y Asistencia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Promedio General */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200" data-testid="progress-average">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  <span className="font-semibold text-slate-800">Promedio General</span>
                </div>
                <span className="text-2xl font-bold text-indigo-600">
                  {dashboardData?.average_grade?.toFixed(1) || "N/A"}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((dashboardData?.average_grade || 0) / 20 * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Escala de 0 a 20
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left column - Main content */}
            <div className="lg:col-span-8 space-y-6">
              {/* Hero Carousel */}
              <HeroCarousel 
                banners={banners} 
                user={studentProfile?.user || user} 
                schoolName={schoolName} 
              />

              {/* Upcoming Tasks - With min height to align with right column */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden min-h-[420px] flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-amber-500" />
                    Tareas Próximas
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
                    dashboardData.upcoming_tasks.slice(0, 6).map((task) => {
                      const dueDate = task.due_date || task.metadata?.due_date;
                      return (
                      <div 
                        key={task.id}
                        onClick={() => navigateTo(`/student/courses/${task.subject_id}`)}
                        className="px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4"
                      >
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: task.subject_color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{task.title}</p>
                          <p className="text-sm text-slate-500">{task.subject_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-700">
                            {dueDate && !isNaN(new Date(dueDate).getTime())
                              ? new Date(dueDate).toLocaleDateString("es-PE", { day: "numeric", month: "short" })
                              : "Sin fecha"}
                          </p>
                          <p className="text-xs text-slate-400">Fecha límite</p>
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                      <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-300" />
                      <p className="text-lg font-medium text-slate-700">¡Estás al día!</p>
                      <p className="text-sm text-slate-400 mt-1">No tienes tareas pendientes</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Announcements */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-indigo-500" />
                    Anuncios Recientes
                  </h2>
                </div>
                
                <div className="divide-y divide-slate-100">
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
                    <div className="px-5 py-8 text-center text-slate-500">
                      <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p>No hay anuncios recientes</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column - Profile Card, Calendar & Quick Links */}
            <div className="lg:col-span-4 space-y-6">
              {/* Student Profile Card */}
              <StudentProfileCard 
                profile={studentProfile}
                dashboardData={dashboardData}
                academic={academic}
              />

              {/* Calendar - Same data as Owner's Portal */}
              <MiniCalendar events={calendarEvents} />

              {/* My Courses Quick Access */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-cyan-500" />
                    Mis Cursos
                  </h2>
                  <button 
                    onClick={() => navigateTo("/student/courses")}
                    className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
                  >
                    Ver todos <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-[250px] overflow-y-auto">
                  {courses.length > 0 ? (
                    courses.slice(0, 5).map((course) => (
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
                            {course.teacher?.name || "Sin profesor"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-6 text-center text-slate-500">
                      <p className="text-sm">No tienes cursos asignados</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
