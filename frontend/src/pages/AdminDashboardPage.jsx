import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import BroadcastPopup from "@/components/BroadcastPopup";
import { 
  Users, GraduationCap, UserCog, UserCheck, BookOpen, HelpCircle,
  Calendar, TrendingUp, AlertCircle, Loader2, ArrowRight,
  Clock, CheckCircle, XCircle, BarChart3, Newspaper, CalendarDays, ClipboardList, Video, HeartPulse,
  UserPlus
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Stat Card Component
function StatCard({ title, value, icon: Icon, color, trend, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-${color}-200 transition-all text-left w-full group`}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">{trend}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-${color}-100 flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
      <div className={`mt-4 flex items-center gap-1 text-${color}-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity`}>
        Ver detalles <ArrowRight className="w-4 h-4" />
      </div>
    </button>
  );
}

// Quick Action Card
function QuickActionCard({ title, description, icon: Icon, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left w-full flex items-center gap-4"
    >
      <div className={`w-10 h-10 rounded-lg bg-${color}-100 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 text-${color}-600`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm">{title}</p>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400" />
    </button>
  );
}

// Recent Activity Item
function ActivityItem({ type, title, time, user: activityUser }) {
  const typeConfig = {
    user_created: { icon: Users, color: "blue", label: "Nuevo usuario" },
    student_enrolled: { icon: GraduationCap, color: "amber", label: "Alumno matriculado" },
    teacher_assigned: { icon: UserCog, color: "emerald", label: "Profesor asignado" },
    attendance_marked: { icon: CheckCircle, color: "green", label: "Asistencia registrada" },
  };
  
  const config = typeConfig[type] || typeConfig.user_created;
  const Icon = config.icon;
  
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-b-0">
      <div className={`w-8 h-8 rounded-lg bg-${config.color}-100 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 text-${config.color}-600`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
        <p className="text-xs text-slate-500">{config.label} • {time}</p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalParents: 0,
    activeSubjects: 0,
    pendingUsers: 0
  });
  const [tutoringSummary, setTutoringSummary] = useState(null);
  const [settings, setSettings] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, settingsRes, tutoringRes] = await Promise.all([
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/tutoring-overview`, { headers }).catch(() => ({ data: null })),
      ]);
      
      const users = usersRes.data || [];
      
      // Calculate stats
      setStats({
        totalUsers: users.length,
        totalStudents: users.filter(u => u.role === 'student' && u.student_status !== 'pending').length,
        totalTeachers: users.filter(u => u.role === 'teacher').length,
        totalParents: users.filter(u => u.role === 'parent').length,
        activeSubjects: 0,
        pendingUsers: users.filter(u => u.role === 'student' && u.student_status === 'pending').length
      });
      
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }
      if (tutoringRes?.data?.summary) {
        setTutoringSummary(tutoringRes.data.summary);
      }
      
      // Mock recent activity for now
      setRecentActivity([
        { type: 'user_created', title: 'Juan Pérez registrado', time: 'Hace 2 horas', user: 'Admin' },
        { type: 'student_enrolled', title: 'María García matriculada', time: 'Hace 3 horas', user: 'Admin' },
        { type: 'teacher_assigned', title: 'Carlos López asignado a Matemáticas', time: 'Hace 5 horas', user: 'Admin' },
      ]);
      
    } catch (err) {
      console.error("Error fetching admin stats:", err);
      setError(err.response?.data?.detail || "Error al cargar datos");
      if (err.response?.status === 401) onLogout();
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleNavigate = (section) => {
    setActiveSection(section);
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-dashboard">
      {/* Sidebar */}
      <AdminSidebar
        active={activeSection}
        onNavigate={handleNavigate}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.school_name}
          subdomain={subdomain}
        />

        <BroadcastPopup token={token} />

        {/* Content */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  ¡Bienvenido al Portal de Administración!
                </h1>
                <p className="text-purple-200">
                  Gestiona usuarios, estudiantes, profesores y toda la operación de tu institución.
                </p>
              </div>
              <div className="hidden md:block">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  title="Total Usuarios"
                  value={stats.totalUsers}
                  icon={Users}
                  color="blue"
                  onClick={() => navigateTo('/admin/users')}
                />
                <StatCard
                  title="Estudiantes"
                  value={stats.totalStudents}
                  icon={GraduationCap}
                  color="amber"
                  onClick={() => navigateTo('/admin/students')}
                />
                <StatCard
                  title="Profesores"
                  value={stats.totalTeachers}
                  icon={UserCog}
                  color="emerald"
                  onClick={() => navigateTo('/admin/teachers')}
                />
                <StatCard
                  title="Padres"
                  value={stats.totalParents}
                  icon={UserCheck}
                  color="rose"
                  onClick={() => navigateTo('/admin/parents')}
                />
              </div>

              {/* Tutorías insight */}
              {tutoringSummary && (
                <button
                  onClick={() => navigateTo('/admin/tutoring-overview')}
                  className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-200 transition-all text-left group mb-6 flex items-center gap-5"
                  data-testid="dashboard-tutoring-card"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <UserPlus className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-500">Tutorías por sección</p>
                    <p className="text-xl font-bold text-slate-800 mt-0.5">
                      {tutoringSummary.with_tutor}/{tutoringSummary.total_sections} secciones con tutor
                      {tutoringSummary.without_tutor > 0 && (
                        <span className="ml-2 text-sm font-semibold text-red-600">
                          ({tutoringSummary.without_tutor} sin asignar)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tutoringSummary.unique_tutors} profesor{tutoringSummary.unique_tutors === 1 ? "" : "es"} con rol de tutor
                    </p>
                  </div>
                  <div className="text-indigo-600 text-sm font-medium opacity-60 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                    Gestionar <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              )}

              {/* Gestión Rápida: Noticias, Eventos, Encuestas, Academia */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6" data-testid="dashboard-quick-actions">
                <button
                  onClick={() => navigateTo('/noticias')}
                  className="group relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-blue-300 hover:shadow-md transition-all text-left overflow-hidden"
                  data-testid="quick-action-noticias"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500 transition-colors">
                      <Newspaper className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base">Noticias</p>
                      <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Gestionar avisos</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  </div>
                </button>

                <button
                  onClick={() => navigateTo('/calendario')}
                  className="group relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-violet-300 hover:shadow-md transition-all text-left overflow-hidden"
                  data-testid="quick-action-calendario"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-violet-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500 transition-colors">
                      <CalendarDays className="w-5 h-5 text-violet-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base">Eventos</p>
                      <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Calendario escolar</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
                  </div>
                </button>

                <button
                  onClick={() => navigateTo('/salud-bienestar')}
                  className="group relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-emerald-300 hover:shadow-md transition-all text-left overflow-hidden"
                  data-testid="quick-action-salud-bienestar"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500 transition-colors">
                      <HeartPulse className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base">Salud y Bienestar</p>
                      <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Seguimiento integral</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
                  </div>
                </button>

                <button
                  onClick={() => navigateTo('/academia')}
                  className="group relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-amber-300 hover:shadow-md transition-all text-left overflow-hidden"
                  data-testid="quick-action-academia"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500 transition-colors">
                      <HelpCircle className="w-5 h-5 text-amber-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base">Centro de Ayuda</p>
                      <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">(Videos Tutoriales)</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                  </div>
                </button>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Acciones Rápidas</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <QuickActionCard
                        title="Nuevo Estudiante"
                        description="Registrar un nuevo alumno"
                        icon={GraduationCap}
                        color="amber"
                        onClick={() => navigateTo('/admin/students?action=new')}
                      />
                      <QuickActionCard
                        title="Nuevo Profesor"
                        description="Registrar un nuevo docente"
                        icon={UserCog}
                        color="emerald"
                        onClick={() => navigateTo('/admin/teachers?action=new')}
                      />
                      <QuickActionCard
                        title="Gestionar Usuarios"
                        description="Ver y editar todos los usuarios"
                        icon={Users}
                        color="blue"
                        onClick={() => navigateTo('/admin/users')}
                      />
                      <QuickActionCard
                        title="Años Académicos"
                        description="Configurar periodos escolares"
                        icon={Calendar}
                        color="purple"
                        onClick={() => navigateTo('/admin/academic-years')}
                      />
                    </div>
                  </div>

                  {/* Pending Users Alert */}
                  {stats.pendingUsers > 0 && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-amber-800">
                          {stats.pendingUsers} usuario(s) pendiente(s) de verificación
                        </p>
                        <p className="text-sm text-amber-700">
                          Revisa y aprueba los usuarios que esperan activación.
                        </p>
                      </div>
                      <button
                        onClick={() => navigateTo('/admin/users?filter=pending')}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                      >
                        Ver
                      </button>
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800 mb-4">Actividad Reciente</h2>
                  {recentActivity.length > 0 ? (
                    <div>
                      {recentActivity.map((activity, index) => (
                        <ActivityItem key={index} {...activity} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">No hay actividad reciente</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
