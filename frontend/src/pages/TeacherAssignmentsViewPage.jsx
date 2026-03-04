import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  ClipboardList,
  Loader2,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  BookOpen,
  ChevronRight,
  Upload,
  Users,
  TrendingUp,
  FileText,
  Star,
  BarChart3,
  Filter
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Task status badges - IDENTICAL to StudentTasksPage
const STATUS_CONFIG = {
  pending: { 
    label: "Pendiente", 
    color: "bg-amber-50 text-amber-700 border border-amber-200", 
    dotColor: "bg-amber-500",
    icon: Clock 
  },
  submitted: { 
    label: "Entregada", 
    color: "bg-blue-50 text-blue-700 border border-blue-200", 
    dotColor: "bg-blue-500",
    icon: Upload 
  },
  graded: { 
    label: "Calificada", 
    color: "bg-emerald-50 text-emerald-700 border border-emerald-200", 
    dotColor: "bg-emerald-500",
    icon: CheckCircle 
  },
  late: { 
    label: "Atrasada", 
    color: "bg-red-50 text-red-700 border border-red-200", 
    dotColor: "bg-red-500",
    icon: AlertCircle 
  }
};

// API fetch functions
const fetchTeacherTasks = async (token) => {
  const response = await axios.get(`${API}/api/teacher/tasks`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const fetchSettings = async (token, subdomain) => {
  const response = await axios.get(`${API}/api/settings/public/${subdomain}`);
  return response.data;
};

export default function TeacherAssignmentsViewPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const currentSubdomain = subdomain || user?.subdomain || 'elroble';

  // React Query for tasks
  const { 
    data: tasksData, 
    isLoading: tasksLoading
  } = useQuery({
    queryKey: ['teacherTasks', user?.id],
    queryFn: () => fetchTeacherTasks(token),
    enabled: !!token,
    staleTime: 60000,
    cacheTime: 300000,
    refetchOnWindowFocus: false,
  });

  // React Query for settings
  const { data: settings } = useQuery({
    queryKey: ['settings', currentSubdomain],
    queryFn: () => fetchSettings(token, currentSubdomain),
    enabled: !!token,
    staleTime: 300000,
    cacheTime: 600000,
    refetchOnWindowFocus: false,
  });

  const tasks = tasksData?.tasks || [];
  const loading = tasksLoading;

  // Get display values from settings
  const schoolName = settings?.system_name || user?.school_name || "Portal Docente";
  const logoUrl = settings?.logo_url;

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  // Helper to get task due date
  const getTaskDueDate = (task) => task.due_date || null;

  // Get task status - same logic as student
  const getTaskStatus = (task) => {
    if (task.pending_reviews > 0) return "submitted";
    if (task.submissions_count > 0 && task.pending_reviews === 0) return "graded";
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      const now = new Date();
      if (dueDate < now) return "late";
    }
    return "pending";
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.subject_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    return getTaskStatus(task) === statusFilter;
  });

  // Stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => getTaskStatus(t) === "pending").length,
    submitted: tasks.filter(t => getTaskStatus(t) === "submitted").length,
    graded: tasks.filter(t => getTaskStatus(t) === "graded").length,
    late: tasks.filter(t => getTaskStatus(t) === "late").length
  };

  // Calculate completion rate
  const completionRate = stats.total > 0 
    ? Math.round((stats.graded / stats.total) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex" data-testid="teacher-tasks-page">
      {/* Teacher Sidebar */}
      <TeacherSidebar
        active="tareas"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={currentSubdomain}
        user={user}
      />

      {/* Mobile overlay */}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={currentSubdomain}
          token={token}
          roleLabel="Docente"
          profilePath="/teacher/profile"
        />

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-20 lg:pb-8 overflow-y-auto">
          {/* Hero Section */}
          <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-8 text-white shadow-2xl">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold">Gestión de Tareas</h1>
                    <p className="text-white/80 text-sm">Panel de control docente</p>
                  </div>
                </div>
                <p className="text-white/90 max-w-xl">
                  Administra, revisa y califica las tareas de tus estudiantes de forma eficiente.
                </p>
              </div>
              
              {/* Quick Stats in Hero */}
              <div className="flex gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 text-center border border-white/20">
                  <p className="text-3xl font-bold">{stats.total}</p>
                  <p className="text-white/80 text-sm">Total Tareas</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 text-center border border-white/20">
                  <p className="text-3xl font-bold">{completionRate}%</p>
                  <p className="text-white/80 text-sm">Completadas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            {/* Pending Card */}
            <button
              onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
              className={`group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                statusFilter === "pending" 
                  ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30" 
                  : "bg-white border border-slate-200/80 hover:border-amber-300"
              }`}
              data-testid="filter-pending"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl transition-opacity ${
                statusFilter === "pending" ? "bg-white/20 opacity-100" : "bg-amber-500/10 opacity-0 group-hover:opacity-100"
              }`} />
              <div className="relative z-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  statusFilter === "pending" 
                    ? "bg-white/20" 
                    : "bg-gradient-to-br from-amber-100 to-orange-100"
                }`}>
                  <Clock className={`w-7 h-7 ${statusFilter === "pending" ? "text-white" : "text-amber-600"}`} />
                </div>
                <p className={`text-4xl font-bold mb-1 ${statusFilter === "pending" ? "" : "text-slate-800"}`}>
                  {stats.pending}
                </p>
                <p className={`text-sm font-medium ${statusFilter === "pending" ? "text-white/90" : "text-slate-500"}`}>
                  Pendientes
                </p>
              </div>
            </button>
            
            {/* Submitted Card */}
            <button
              onClick={() => setStatusFilter(statusFilter === "submitted" ? "all" : "submitted")}
              className={`group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                statusFilter === "submitted" 
                  ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30" 
                  : "bg-white border border-slate-200/80 hover:border-blue-300"
              }`}
              data-testid="filter-submitted"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl transition-opacity ${
                statusFilter === "submitted" ? "bg-white/20 opacity-100" : "bg-blue-500/10 opacity-0 group-hover:opacity-100"
              }`} />
              <div className="relative z-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  statusFilter === "submitted" 
                    ? "bg-white/20" 
                    : "bg-gradient-to-br from-blue-100 to-indigo-100"
                }`}>
                  <Upload className={`w-7 h-7 ${statusFilter === "submitted" ? "text-white" : "text-blue-600"}`} />
                </div>
                <p className={`text-4xl font-bold mb-1 ${statusFilter === "submitted" ? "" : "text-slate-800"}`}>
                  {stats.submitted}
                </p>
                <p className={`text-sm font-medium ${statusFilter === "submitted" ? "text-white/90" : "text-slate-500"}`}>
                  Entregadas
                </p>
              </div>
            </button>
            
            {/* Graded Card */}
            <button
              onClick={() => setStatusFilter(statusFilter === "graded" ? "all" : "graded")}
              className={`group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                statusFilter === "graded" 
                  ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30" 
                  : "bg-white border border-slate-200/80 hover:border-emerald-300"
              }`}
              data-testid="filter-graded"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl transition-opacity ${
                statusFilter === "graded" ? "bg-white/20 opacity-100" : "bg-emerald-500/10 opacity-0 group-hover:opacity-100"
              }`} />
              <div className="relative z-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  statusFilter === "graded" 
                    ? "bg-white/20" 
                    : "bg-gradient-to-br from-emerald-100 to-teal-100"
                }`}>
                  <CheckCircle className={`w-7 h-7 ${statusFilter === "graded" ? "text-white" : "text-emerald-600"}`} />
                </div>
                <p className={`text-4xl font-bold mb-1 ${statusFilter === "graded" ? "" : "text-slate-800"}`}>
                  {stats.graded}
                </p>
                <p className={`text-sm font-medium ${statusFilter === "graded" ? "text-white/90" : "text-slate-500"}`}>
                  Calificadas
                </p>
              </div>
            </button>
            
            {/* All Tasks Card */}
            <button
              onClick={() => setStatusFilter("all")}
              className={`group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                statusFilter === "all" 
                  ? "bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-lg shadow-slate-500/30" 
                  : "bg-white border border-slate-200/80 hover:border-slate-400"
              }`}
              data-testid="filter-all"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl transition-opacity ${
                statusFilter === "all" ? "bg-white/10 opacity-100" : "bg-slate-500/10 opacity-0 group-hover:opacity-100"
              }`} />
              <div className="relative z-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  statusFilter === "all" 
                    ? "bg-white/20" 
                    : "bg-gradient-to-br from-slate-100 to-slate-200"
                }`}>
                  <BarChart3 className={`w-7 h-7 ${statusFilter === "all" ? "text-white" : "text-slate-600"}`} />
                </div>
                <p className={`text-4xl font-bold mb-1 ${statusFilter === "all" ? "" : "text-slate-800"}`}>
                  {stats.total}
                </p>
                <p className={`text-sm font-medium ${statusFilter === "all" ? "text-white/90" : "text-slate-500"}`}>
                  Todas
                </p>
              </div>
            </button>
          </div>

          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tarea o curso..."
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                data-testid="task-search-input"
              />
            </div>
            {statusFilter !== "all" && (
              <button
                onClick={() => setStatusFilter("all")}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-colors"
              >
                <Filter className="w-4 h-4" />
                Limpiar filtro
              </button>
            )}
          </div>

          {/* Tasks List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              </div>
              <p className="text-slate-500">Cargando tareas...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
                <CheckCircle className="w-12 h-12 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {searchQuery || statusFilter !== "all" ? "Sin resultados" : "¡Estás al día!"}
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "No encontramos tareas que coincidan con tu búsqueda"
                  : "No tienes tareas asignadas por el momento"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task, index) => {
                const status = getTaskStatus(task);
                const StatusIcon = STATUS_CONFIG[status].icon;
                const dueDate = getTaskDueDate(task);
                const isPastDue = dueDate && new Date(dueDate) < new Date();
                
                return (
                  <div
                    key={task.id}
                    onClick={() => navigateTo(`/curso/${task.subject_id}?task=${task.id}`)}
                    className="group bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-xl hover:border-emerald-200 cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                    style={{ animationDelay: `${index * 50}ms` }}
                    data-testid={`task-item-${task.id}`}
                  >
                    <div className="flex items-center gap-5">
                      {/* Course Color Indicator */}
                      <div 
                        className="w-1.5 h-16 rounded-full flex-shrink-0 transition-all group-hover:h-20"
                        style={{ backgroundColor: task.course_color || "#10B981" }}
                      />
                      
                      {/* Task Icon */}
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center flex-shrink-0 group-hover:from-emerald-50 group-hover:to-teal-50 transition-colors">
                        <FileText className="w-7 h-7 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      
                      {/* Task Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-slate-800 truncate text-lg group-hover:text-emerald-700 transition-colors">
                            {task.title}
                          </h3>
                          <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_CONFIG[status].color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[status].dotColor}`} />
                            {STATUS_CONFIG[status].label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-700">{task.subject_name}</span>
                          </span>
                          {dueDate && (
                            <span className={`flex items-center gap-1.5 ${isPastDue && status === "pending" ? "text-red-500" : ""}`}>
                              <Calendar className="w-4 h-4" />
                              {new Date(dueDate).toLocaleDateString("es-PE", { 
                                day: "numeric", 
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          )}
                          {task.submissions_count > 0 && (
                            <span className="flex items-center gap-1.5">
                              <Users className="w-4 h-4" />
                              {task.submissions_count} entrega{task.submissions_count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Icon & Arrow */}
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          status === "graded" ? "bg-emerald-100" :
                          status === "submitted" ? "bg-blue-100" :
                          status === "late" ? "bg-red-100" :
                          "bg-amber-100"
                        }`}>
                          <StatusIcon className={`w-6 h-6 ${
                            status === "graded" ? "text-emerald-600" :
                            status === "submitted" ? "text-blue-600" :
                            status === "late" ? "text-red-600" :
                            "text-amber-600"
                          }`} />
                        </div>
                        <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
      <MobileBottomNav role="teacher" />
    </div>
  );
}
