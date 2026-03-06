import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import MobileBottomNav from "../components/MobileBottomNav";
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
  FileText,
  Upload
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Task status badges
const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-700", icon: Clock },
  submitted: { label: "Entregada", color: "bg-blue-100 text-blue-700", icon: Upload },
  graded: { label: "Calificada", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  late: { label: "Atrasada", color: "bg-red-100 text-red-700", icon: AlertCircle }
};

// API fetch functions
const fetchStudentTasks = async (token) => {
  const response = await axios.get(`${API}/api/student/tasks`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const fetchSettings = async (token, subdomain) => {
  const response = await axios.get(`${API}/api/settings/public/${subdomain}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export default function StudentTasksPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // React Query for tasks - cached for 60s, stale after 60s
  const { 
    data: tasksData, 
    isLoading: tasksLoading,
    isFetching: tasksFetching 
  } = useQuery({
    queryKey: ['studentTasks', user?.id],
    queryFn: () => fetchStudentTasks(token),
    enabled: !!token,
    staleTime: 60000,     // 60 seconds - match backend cache
    cacheTime: 300000,    // 5 minutes
    refetchOnWindowFocus: false,
  });

  // React Query for settings
  const { data: settings } = useQuery({
    queryKey: ['settings', subdomain],
    queryFn: () => fetchSettings(token, subdomain),
    enabled: !!token && !!subdomain,
    staleTime: 300000,    // 5 minutes for settings
    cacheTime: 600000,    // 10 minutes
    refetchOnWindowFocus: false,
  });

  const tasks = tasksData?.tasks || [];
  const loading = tasksLoading;

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

  // Helper to get task due date
  const getTaskDueDate = (task) => task.due_date || null;

  // Get task status (now comes from backend)
  const getTaskStatus = (task) => task.status || "pending";

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.course_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (statusFilter === "all") return true;
    
    return task.status === statusFilter;
  });

  // Stats (calculate from filtered data for display)
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    submitted: tasks.filter(t => t.status === "submitted").length,
    graded: tasks.filter(t => t.status === "graded").length,
    late: tasks.filter(t => t.status === "late").length
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Student Sidebar */}
      <StudentSidebar
        active="tareas"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Identical to Owner's Portal */}
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
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {/* Page Title */}
          <div className="flex items-center gap-2 mb-6">
            <ClipboardList className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-slate-800">Mis Tareas</h2>
            <span className="text-sm text-slate-500">
              ({stats.pending} pendientes · {stats.submitted} entregadas · {stats.graded} calificadas)
            </span>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <button
              onClick={() => setStatusFilter("pending")}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === "pending" 
                  ? "bg-amber-50 border-amber-300" 
                  : "bg-white border-slate-200 hover:border-amber-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
                  <p className="text-xs text-slate-500">Pendientes</p>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setStatusFilter("submitted")}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === "submitted" 
                  ? "bg-blue-50 border-blue-300" 
                  : "bg-white border-slate-200 hover:border-blue-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-slate-800">{stats.submitted}</p>
                  <p className="text-xs text-slate-500">Entregadas</p>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setStatusFilter("graded")}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === "graded" 
                  ? "bg-emerald-50 border-emerald-300" 
                  : "bg-white border-slate-200 hover:border-emerald-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-slate-800">{stats.graded}</p>
                  <p className="text-xs text-slate-500">Calificadas</p>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setStatusFilter("all")}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === "all" 
                  ? "bg-slate-100 border-slate-400" 
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-slate-600" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                  <p className="text-xs text-slate-500">Todas</p>
                </div>
              </div>
            </button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tarea o curso..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                {searchQuery || statusFilter !== "all" ? "Sin resultados" : "¡Estás al día!"}
              </h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "No encontramos tareas que coincidan con tu búsqueda"
                  : "No tienes tareas asignadas por el momento"
                }
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const status = getTaskStatus(task);
                  const StatusIcon = STATUS_CONFIG[status].icon;
                  const dueDate = getTaskDueDate(task);
                  const isPastDue = dueDate && new Date(dueDate) < new Date();
                  
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigateTo(`/student/courses/${task.course_id}?task=${task.id}`)}
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4"
                      data-testid={`task-item-${task.id}`}
                    >
                      {/* Course color indicator */}
                      <div 
                        className="w-2 h-12 rounded-full flex-shrink-0"
                        style={{ backgroundColor: task.course_color || "#f59e0b" }}
                      />
                      
                      {/* Task info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800 truncate">
                            {task.title}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[status].color}`}>
                            {STATUS_CONFIG[status].label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            {task.course_name}
                          </span>
                          {dueDate && (
                            <span className={`flex items-center gap-1 ${isPastDue && status === "pending" ? "text-red-500" : ""}`}>
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(dueDate).toLocaleDateString("es-PE", { 
                                day: "numeric", 
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Status icon & arrow */}
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`w-5 h-5 ${
                          status === "graded" ? "text-emerald-500" :
                          status === "submitted" ? "text-blue-500" :
                          status === "late" ? "text-red-500" :
                          "text-amber-500"
                        }`} />
                        <ChevronRight className="w-5 h-5 text-slate-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
      <MobileBottomNav role="student" />
    </div>
  );
}
