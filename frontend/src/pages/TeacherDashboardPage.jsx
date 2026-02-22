import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MessageCenter from "../components/MessageCenter";
import {
  BookOpen,
  ClipboardList,
  Bell,
  Users,
  Clock,
  CheckCircle,
  ChevronRight,
  Loader2,
  User,
  Menu,
  CalendarCheck,
  FileText,
  AlertCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function TeacherDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("inicio");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/teacher/dashboard`, { headers });
      setDashboardData(res.data);
    } catch (err) {
      console.error("Error loading teacher dashboard:", err);
      // Set default data if endpoint fails
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando tu portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Teacher Sidebar */}
      <TeacherSidebar
        active={activeSection}
        onNavigate={setActiveSection}
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
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">
                  ¡Buen día, {user?.name}!
                </h1>
                <p className="text-sm text-slate-500">
                  Panel de control docente
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="relative w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
                <Bell className="w-5 h-5" />
                {dashboardData?.unread_messages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {dashboardData.unread_messages}
                  </span>
                )}
              </button>
              
              <div className="flex items-center gap-2">
                {user?.photo_url ? (
                  <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-emerald-600" />
                  </div>
                )}
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
              {/* Decorative elements */}
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
              {/* Decorative elements */}
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
              {/* Decorative elements */}
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
              {/* Decorative gradient orb */}
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

          <div className="grid lg:grid-cols-3 gap-6">
            {/* My Courses */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
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
              
              <div className="divide-y divide-slate-100">
                {dashboardData?.courses?.length > 0 ? (
                  dashboardData.courses.slice(0, 4).map((course) => (
                    <div 
                      key={course.id}
                      onClick={() => navigateTo(`/teacher/courses/${course.id}`)}
                      className="px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4"
                    >
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: course.color || "#10b981" }}
                      >
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{course.name}</p>
                        <p className="text-sm text-slate-500">
                          {course.section_name || "Sin sección"} • {course.students_count || 0} alumnos
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-12 text-center">
                    <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">Sin cursos asignados</p>
                    <p className="text-sm text-slate-400">Contacta al coordinador para asignaciones</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Submissions to Review */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  Entregas Recientes
                </h2>
                <button 
                  onClick={() => navigateTo("/teacher/tasks")}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                >
                  Ver todas <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              <div className="divide-y divide-slate-100">
                {dashboardData?.recent_submissions?.length > 0 ? (
                  dashboardData.recent_submissions.map((submission) => (
                    <div 
                      key={submission.id}
                      className="px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {submission.student_photo ? (
                          <img src={submission.student_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">
                            {submission.student_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{submission.task_title}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(submission.submitted_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                        {!submission.graded && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                            Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-12 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">¡Todo al día!</p>
                    <p className="text-sm text-slate-400">No hay entregas pendientes</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Today's Attendance */}
          {dashboardData?.today_attendance_pending?.length > 0 && (
            <div className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
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
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
