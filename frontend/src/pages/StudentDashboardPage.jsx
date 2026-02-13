import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import MessageCenter from "../components/MessageCenter";
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

export default function StudentDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("inicio");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [courses, setCourses] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, dashboardRes, coursesRes] = await Promise.all([
        axios.get(`${API}/api/student/profile`, { headers }),
        axios.get(`${API}/api/student/dashboard`, { headers }),
        axios.get(`${API}/api/student/courses`, { headers })
      ]);
      
      setStudentProfile(profileRes.data);
      setDashboardData(dashboardRes.data);
      setCourses(coursesRes.data.courses || []);
    } catch (err) {
      console.error("Error loading student data:", err);
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
        schoolName={user?.school_name}
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
                  ¡Hola, {studentProfile?.user?.name || user?.name}!
                </h1>
                <p className="text-sm text-slate-500">
                  {academic.grado?.nombre && academic.seccion?.nombre 
                    ? `${academic.grado.nombre} - ${academic.seccion.nombre}`
                    : "Bienvenido a tu portal estudiantil"
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Notifications indicator */}
              <button className="relative w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
                <Bell className="w-5 h-5" />
                {studentProfile?.unread_messages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {studentProfile.unread_messages}
                  </span>
                )}
              </button>
              
              {/* Profile */}
              <div className="flex items-center gap-2">
                {studentProfile?.user?.photo_url ? (
                  <img src={studentProfile.user.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-cyan-600" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div 
              onClick={() => navigateTo("/student/courses")}
              className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-cyan-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                  <BookOpen className="w-6 h-6 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{dashboardData?.courses_count || 0}</p>
                  <p className="text-sm text-slate-500">Mis Cursos</p>
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigateTo("/student/tasks")}
              className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <ClipboardList className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{dashboardData?.upcoming_tasks?.length || 0}</p>
                  <p className="text-sm text-slate-500">Tareas Pendientes</p>
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigateTo("/student/attendance")}
              className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <CalendarCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">
                    {dashboardData?.attendance_summary?.present || 0}
                  </p>
                  <p className="text-sm text-slate-500">Asistencias</p>
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigateTo("/student/messages")}
              className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <Bell className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{studentProfile?.unread_messages || 0}</p>
                  <p className="text-sm text-slate-500">Mensajes</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Upcoming Tasks */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
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
              
              <div className="divide-y divide-slate-100">
                {dashboardData?.upcoming_tasks?.length > 0 ? (
                  dashboardData.upcoming_tasks.map((task) => (
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
                          {new Date(task.due_date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                        </p>
                        <p className="text-xs text-slate-400">Fecha límite</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-12 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">¡Estás al día!</p>
                    <p className="text-sm text-slate-400">No tienes tareas pendientes</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Announcements */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-500" />
                  Comunicados
                </h2>
                <button 
                  onClick={() => navigateTo("/student/messages")}
                  className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
                >
                  Ver todos <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              <div className="divide-y divide-slate-100">
                {dashboardData?.recent_announcements?.length > 0 ? (
                  dashboardData.recent_announcements.map((ann) => (
                    <div 
                      key={ann.id}
                      className={`px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors ${!ann.is_read ? "bg-indigo-50/50" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        {!ann.is_read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${!ann.is_read ? "text-slate-800" : "text-slate-600"}`}>
                            {ann.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ann.priority]}`}>
                              {ann.priority === "urgent" ? "Urgente" : ann.priority === "important" ? "Importante" : "Normal"}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(ann.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-12 text-center">
                    <Bell className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">Sin comunicados recientes</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* My Courses Grid */}
          {courses.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
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
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {courses.slice(0, 4).map((course) => (
                  <div
                    key={course.id}
                    onClick={() => navigateTo(`/student/courses/${course.id}`)}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-cyan-300 hover:shadow-md transition-all cursor-pointer group"
                  >
                    {course.image_url ? (
                      <div className="h-32 overflow-hidden">
                        <img 
                          src={course.image_url} 
                          alt={course.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div 
                        className="h-32 flex items-center justify-center"
                        style={{ backgroundColor: course.color || "#06b6d4" }}
                      >
                        <BookOpen className="w-12 h-12 text-white/80" />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-slate-800 truncate">{course.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        {course.teacher?.photo_url ? (
                          <img src={course.teacher.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="w-3 h-3 text-slate-500" />
                          </div>
                        )}
                        <span className="text-sm text-slate-500 truncate">{course.teacher?.name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attendance Summary */}
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <CalendarCheck className="w-5 h-5 text-emerald-500" />
              Resumen de Asistencia (últimos 30 días)
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-emerald-50 rounded-xl">
                <p className="text-3xl font-bold text-emerald-600">{dashboardData?.attendance_summary?.present || 0}</p>
                <p className="text-sm text-emerald-700">Asistencias</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-xl">
                <p className="text-3xl font-bold text-amber-600">{dashboardData?.attendance_summary?.late || 0}</p>
                <p className="text-sm text-amber-700">Tardanzas</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <p className="text-3xl font-bold text-red-600">{dashboardData?.attendance_summary?.absent || 0}</p>
                <p className="text-sm text-red-700">Faltas</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <p className="text-3xl font-bold text-blue-600">{dashboardData?.attendance_summary?.justified || 0}</p>
                <p className="text-sm text-blue-700">Justificadas</p>
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
