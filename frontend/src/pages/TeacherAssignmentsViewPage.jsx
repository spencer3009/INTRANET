import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MessageCenter from "../components/MessageCenter";
import StudentHeader from "../components/StudentHeader";
import {
  ClipboardList,
  Search,
  Plus,
  ChevronRight,
  Loader2,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  BookOpen,
  Upload,
  AlertCircle,
  X
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Task status badges - from teacher perspective
const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-700", icon: Clock },
  submitted: { label: "Por revisar", color: "bg-blue-100 text-blue-700", icon: Upload },
  graded: { label: "Calificada", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  late: { label: "Vencida", color: "bg-red-100 text-red-700", icon: AlertCircle }
};

export default function TeacherAssignmentsViewPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [searchParams] = useSearchParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [settings, setSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentSubdomain = subdomain || user?.subdomain || 'elroble';
      const [tasksRes, coursesRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/teacher/tasks`, { headers }),
        axios.get(`${API}/api/teacher/courses`, { headers }),
        axios.get(`${API}/api/settings/public/${currentSubdomain}`).catch(() => ({ data: null }))
      ]);
      setTasks(tasksRes.data.tasks || []);
      setCourses(coursesRes.data.courses || []);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error("Error loading data:", err);
      setTasks([]);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Docente";

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  // Get task status for teacher view
  const getTaskStatus = (task) => {
    if (!task.due_date) return "pending";
    const dueDate = new Date(task.due_date);
    const now = new Date();
    
    if (task.pending_reviews > 0) return "submitted"; // Has submissions to review
    if (task.submissions_count > 0 && task.pending_reviews === 0) return "graded"; // All graded
    if (dueDate < now) return "late"; // Past due date with no submissions
    return "pending"; // Active task
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

  // Sort by due date (closest first)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  // Stats (calculate from data)
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => getTaskStatus(t) === "pending").length,
    submitted: tasks.filter(t => getTaskStatus(t) === "submitted").length,
    graded: tasks.filter(t => getTaskStatus(t) === "graded").length,
    late: tasks.filter(t => getTaskStatus(t) === "late").length,
    totalPendingReviews: tasks.reduce((sum, t) => sum + (t.pending_reviews || 0), 0)
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Sin fecha límite";
    return new Date(dateStr).toLocaleDateString("es-PE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="teacher-tasks-page">
      {/* Teacher Sidebar */}
      <TeacherSidebar
        active="tareas"
        onNavigate={() => {}}
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
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
          roleLabel="Docente"
          profilePath="/teacher/profile"
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Title */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-emerald-500" />
              <h2 className="text-xl font-bold text-slate-800">Mis Tareas</h2>
              <span className="text-sm text-slate-500">
                ({stats.submitted} por revisar · {stats.graded} calificadas · {stats.pending} activas)
              </span>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
              data-testid="create-task-btn"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nueva Tarea</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <button
              onClick={() => setStatusFilter("submitted")}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === "submitted" 
                  ? "bg-blue-50 border-blue-300" 
                  : "bg-white border-slate-200 hover:border-blue-200"
              }`}
              data-testid="filter-submitted"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-slate-800">{stats.totalPendingReviews}</p>
                  <p className="text-xs text-slate-500">Por revisar</p>
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
              data-testid="filter-graded"
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
              onClick={() => setStatusFilter("pending")}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === "pending" 
                  ? "bg-amber-50 border-amber-300" 
                  : "bg-white border-slate-200 hover:border-amber-200"
              }`}
              data-testid="filter-pending"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
                  <p className="text-xs text-slate-500">Activas</p>
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
              data-testid="filter-all"
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
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition-colors"
                data-testid="task-search-input"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                {searchQuery || statusFilter !== "all" ? "Sin resultados" : "Sin tareas"}
              </h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "No encontramos tareas que coincidan con tu búsqueda"
                  : "Aún no has creado ninguna tarea"
                }
              </p>
              {!searchQuery && statusFilter === "all" && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Crear Primera Tarea
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {sortedTasks.map((task) => {
                  const status = getTaskStatus(task);
                  const StatusIcon = STATUS_CONFIG[status].icon;
                  const dueDate = task.due_date;
                  const isPastDue = dueDate && new Date(dueDate) < new Date();
                  
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigateTo(`/teacher/courses/${task.subject_id}?tab=tareas&task=${task.id}`)}
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4"
                      data-testid={`task-item-${task.id}`}
                    >
                      {/* Course color indicator */}
                      <div 
                        className="w-2 h-12 rounded-full flex-shrink-0 bg-emerald-500"
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
                          {task.pending_reviews > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                              {task.pending_reviews} pendiente{task.pending_reviews > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            {task.subject_name} • {task.section_name}
                          </span>
                          {dueDate && (
                            <span className={`flex items-center gap-1 ${isPastDue && status !== "graded" ? "text-red-500" : ""}`}>
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(dueDate)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {task.submissions_count || 0} entrega{task.submissions_count !== 1 ? 's' : ''}
                          </span>
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

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Nueva Tarea</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h4 className="font-semibold text-slate-800 mb-2">Crear desde el curso</h4>
                <p className="text-slate-500 text-sm mb-4">
                  Para crear una tarea, ve al curso correspondiente y usa la pestaña de tareas.
                </p>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    navigateTo("/teacher/courses");
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  Ir a Mis Cursos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
