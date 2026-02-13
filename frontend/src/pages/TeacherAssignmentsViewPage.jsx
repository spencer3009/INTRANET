import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MessageCenter from "../components/MessageCenter";
import {
  ClipboardList,
  Search,
  Filter,
  Plus,
  ChevronRight,
  Loader2,
  Menu,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  FileText,
  Eye,
  Edit,
  X,
  AlertCircle,
  BookOpen
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function TeacherAssignmentsViewPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [searchParams] = useSearchParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourse, setFilterCourse] = useState(searchParams.get("course") || "");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, coursesRes] = await Promise.all([
        axios.get(`${API}/api/teacher/tasks`, { headers }),
        axios.get(`${API}/api/teacher/courses`, { headers })
      ]);
      setTasks(tasksRes.data.tasks || []);
      setCourses(coursesRes.data.courses || []);
    } catch (err) {
      console.error("Error loading data:", err);
      setTasks([]);
      setCourses([]);
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

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = !filterCourse || task.subject_id === filterCourse;
    const matchesStatus = !filterStatus || 
      (filterStatus === "pending" && task.pending_reviews > 0) ||
      (filterStatus === "graded" && task.pending_reviews === 0);
    return matchesSearch && matchesCourse && matchesStatus;
  });

  // Sort by due date (closest first)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  const getStatusColor = (task) => {
    if (!task.due_date) return "slate";
    const dueDate = new Date(task.due_date);
    const now = new Date();
    const diff = dueDate - now;
    const hours = diff / (1000 * 60 * 60);
    
    if (diff < 0) return "red"; // Vencida
    if (hours <= 24) return "amber"; // Próxima a vencer
    return "emerald"; // A tiempo
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Sin fecha límite";
    return new Date(dateStr).toLocaleDateString("es-PE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando tareas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="teacher-assignments-page">
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
                <h1 className="text-xl font-bold text-slate-800">Tareas</h1>
                <p className="text-sm text-slate-500">
                  {tasks.length} tareas • {tasks.reduce((sum, t) => sum + (t.pending_reviews || 0), 0)} pendientes de revisar
                </p>
              </div>
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
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por título..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  data-testid="task-search-input"
                />
              </div>
              
              {courses.length > 0 && (
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  data-testid="task-filter-course"
                >
                  <option value="">Todos los cursos</option>
                  {courses.map(course => (
                    <option key={`${course.id}-${course.section_id}`} value={course.id}>
                      {course.name} - {course.section_name}
                    </option>
                  ))}
                </select>
              )}
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                data-testid="task-filter-status"
              >
                <option value="">Todos los estados</option>
                <option value="pending">Con pendientes</option>
                <option value="graded">Todas calificadas</option>
              </select>
            </div>
          </div>

          {/* Tasks List */}
          {sortedTasks.length > 0 ? (
            <div className="space-y-4">
              {sortedTasks.map((task) => {
                const statusColor = getStatusColor(task);
                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all"
                    data-testid={`task-card-${task.id}`}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Status indicator */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-${statusColor}-100`}>
                          <ClipboardList className={`w-6 h-6 text-${statusColor}-600`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold text-slate-800">{task.title}</h3>
                              <p className="text-sm text-slate-500 mt-0.5">
                                {task.subject_name} • {task.section_name}
                              </p>
                            </div>
                            
                            {/* Due date badge */}
                            <div className={`px-3 py-1 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-700 flex-shrink-0`}>
                              {statusColor === "red" ? "Vencida" : statusColor === "amber" ? "Próxima" : "Activa"}
                            </div>
                          </div>
                          
                          {/* Task meta */}
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDate(task.due_date)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Users className="w-4 h-4" />
                              <span>{task.submissions_count || 0} entregas</span>
                            </div>
                            {task.pending_reviews > 0 && (
                              <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                                <Clock className="w-4 h-4" />
                                <span>{task.pending_reviews} por revisar</span>
                              </div>
                            )}
                            {task.pending_reviews === 0 && task.submissions_count > 0 && (
                              <div className="flex items-center gap-1.5 text-emerald-600">
                                <CheckCircle className="w-4 h-4" />
                                <span>Todas calificadas</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-end gap-2 bg-slate-50">
                      <button
                        onClick={() => navigateTo(`/teacher/tasks/${task.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Ver entregas
                      </button>
                      <button
                        onClick={() => navigateTo(`/teacher/tasks/${task.id}/edit`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <ClipboardList className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                {searchTerm || filterCourse || filterStatus ? "Sin resultados" : "Sin tareas"}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchTerm || filterCourse || filterStatus 
                  ? "No se encontraron tareas con los filtros aplicados" 
                  : "Aún no has creado ninguna tarea. ¡Crea tu primera tarea!"
                }
              </p>
              {!searchTerm && !filterCourse && !filterStatus && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Crear Primera Tarea
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create Task Modal - Placeholder */}
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
