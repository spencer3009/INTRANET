import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  ClipboardList, Clock, CheckCircle, AlertCircle, Loader2, BookOpen,
  Calendar, ChevronDown, Filter, FileText, User, AlertTriangle, Timer
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock, dot: "bg-amber-500" },
  submitted: { label: "Entregado", color: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle, dot: "bg-blue-500" },
  graded: { label: "Calificado", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle, dot: "bg-emerald-500" },
  late: { label: "Atrasado", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle, dot: "bg-red-500" },
  overdue: { label: "Vencido", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle, dot: "bg-red-500" },
};

function getTaskStatus(task) {
  if (task.submission?.grade != null || task.status === "graded") return "graded";
  if (task.submission || task.status === "submitted") return "submitted";
  if (task.due_date) {
    const now = new Date();
    const due = new Date(task.due_date + "T23:59:59");
    if (now > due) return "overdue";
  }
  return "pending";
}

function formatDueDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(date); due.setHours(0,0,0,0);
  const diff = Math.ceil((due - today) / (1000*60*60*24));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Manana";
  if (diff === -1) return "Ayer";
  if (diff > 0 && diff <= 7) return `En ${diff} dias`;
  if (diff < 0) return `Hace ${Math.abs(diff)} dias`;
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

export default function ParentTasksPage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const loadTasksForChild = async (childId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/parent/tasks?student_id=${childId}`, { headers });
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error("Error loading tasks:", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
        ]);
        if (settingsRes.data) setSettings(settingsRes.data);
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (childrenList.length > 0) {
          const savedId = localStorage.getItem('selected_child_id');
          const child = childrenList.find(c => c.id === savedId) || childrenList[0];
          setSelectedChild(child);
          localStorage.setItem('selected_child_id', child.id);
          await loadTasksForChild(child.id);
        } else { setLoading(false); }
      } catch (err) { console.error("Error:", err); setLoading(false); }
    };
    init();
  }, [token]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    localStorage.setItem('selected_child_id', newChild.id);
    await loadTasksForChild(newChild.id);
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  const enrichedTasks = useMemo(() => tasks.map(t => ({ ...t, computedStatus: getTaskStatus(t) })), [tasks]);

  const courses = useMemo(() => {
    const unique = [...new Set(tasks.map(t => t.subject_name || t.course_name).filter(Boolean))];
    return unique.sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter(t => {
      if (filterStatus !== "all" && t.computedStatus !== filterStatus) return false;
      if (filterCourse !== "all" && (t.subject_name || t.course_name) !== filterCourse) return false;
      return true;
    });
  }, [enrichedTasks, filterStatus, filterCourse]);

  const stats = useMemo(() => ({
    total: enrichedTasks.length,
    pending: enrichedTasks.filter(t => t.computedStatus === "pending").length,
    submitted: enrichedTasks.filter(t => t.computedStatus === "submitted").length,
    graded: enrichedTasks.filter(t => t.computedStatus === "graded").length,
    overdue: enrichedTasks.filter(t => t.computedStatus === "overdue").length,
  }), [enrichedTasks]);

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="parent-tasks-page">
      <ParentSidebar active="tareas" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange} />
      {sidebarExpanded && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} roleLabel="Padre/Apoderado" profilePath="/parent/profile" />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>
                  Tareas de {selectedChild?.name || ""}
                </h1>
                <p className="text-sm text-slate-500">{filteredTasks.length} tareas</p>
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${showFilters ? "bg-cyan-50 border-cyan-200 text-cyan-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filtros</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1"><Clock className="w-4 h-4" /><span className="text-sm font-medium">Pendientes</span></div>
              <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1"><CheckCircle className="w-4 h-4" /><span className="text-sm font-medium">Entregados</span></div>
              <p className="text-2xl font-bold text-slate-800">{stats.submitted}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1"><CheckCircle className="w-4 h-4" /><span className="text-sm font-medium">Calificados</span></div>
              <p className="text-2xl font-bold text-slate-800">{stats.graded}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-red-600 mb-1"><AlertCircle className="w-4 h-4" /><span className="text-sm font-medium">Vencidos</span></div>
              <p className="text-2xl font-bold text-slate-800">{stats.overdue}</p>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Estado</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="submitted">Entregados</option>
                  <option value="graded">Calificados</option>
                  <option value="overdue">Vencidos</option>
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Curso</label>
                <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
                  <option value="all">Todos los cursos</option>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Task List */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin" /></div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-cyan-50 rounded-full flex items-center justify-center">
                <ClipboardList className="w-10 h-10 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin tareas</h3>
              <p className="text-slate-500 max-w-md mx-auto">No se encontraron tareas con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const statusConf = STATUS_CONFIG[task.computedStatus] || STATUS_CONFIG.pending;
                const StatusIcon = statusConf.icon;
                return (
                  <div key={task.id} className="bg-white rounded-xl border border-slate-200 hover:shadow-md hover:border-cyan-200 transition-all p-4" data-testid={`parent-task-${task.id}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${statusConf.color}`}>
                        <StatusIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-slate-800 truncate">{task.title}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConf.color}`}>{statusConf.label}</span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-slate-500 line-clamp-1 mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                          {(task.subject_name || task.course_name) && (
                            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{task.subject_name || task.course_name}</span>
                          )}
                          {task.due_date && (
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDueDate(task.due_date)}</span>
                          )}
                          {task.teacher_name && (
                            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{task.teacher_name}</span>
                          )}
                        </div>
                      </div>
                      {task.submission?.grade != null && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-2xl font-bold text-emerald-600">{task.submission.grade}</p>
                          <p className="text-xs text-slate-500">/{task.max_score || 20}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
      <MessageCenter token={token} user={user} />
    </div>
  );
}
