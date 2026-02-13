import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import {
  ClipboardList, Users, CheckCircle, Clock, AlertCircle, Filter, Search,
  Lock, Unlock, Loader2, ArrowLeft, FileText, Calendar, BookOpen,
  ChevronDown, Eye
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Summary Card Component
function SummaryCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    purple: "bg-purple-100 text-purple-600",
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    red: "bg-red-100 text-red-600",
    slate: "bg-slate-100 text-slate-600"
  };
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Status Badge
function TaskStatusBadge({ status }) {
  const styles = {
    active: "bg-emerald-100 text-emerald-700",
    expired: "bg-red-100 text-red-700",
    closed: "bg-slate-100 text-slate-600"
  };
  const labels = {
    active: "Activa",
    expired: "Vencida",
    closed: "Cerrada"
  };
  
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {labels[status] || status}
    </span>
  );
}

export default function AdminTasksPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  
  // Filters
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [taskToToggle, setTaskToToggle] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    loadInitialData();
  }, []);
  
  useEffect(() => {
    loadTasks();
  }, [filterSubject, filterTeacher, filterStatus]);

  const loadInitialData = async () => {
    try {
      const [settingsRes, subjectsRes, teachersRes, summaryRes, tasksRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/subjects`, { headers }),
        axios.get(`${API}/admin/teachers`, { headers }).catch(() => ({ data: { teachers: [] } })),
        axios.get(`${API}/admin/tasks/summary`, { headers }),
        axios.get(`${API}/admin/tasks`, { headers })
      ]);
      
      if (settingsRes.data) setSettings(settingsRes.data);
      setSubjects(subjectsRes.data || []);
      setTeachers(teachersRes.data?.teachers || []);
      setSummary(summaryRes.data || {});
      setTasks(tasksRes.data?.tasks || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const loadTasks = async () => {
    try {
      const params = new URLSearchParams();
      if (filterSubject) params.append("subject_id", filterSubject);
      if (filterTeacher) params.append("teacher_id", filterTeacher);
      if (filterStatus) params.append("status", filterStatus);
      
      const res = await axios.get(`${API}/admin/tasks?${params}`, { headers });
      setTasks(res.data?.tasks || []);
    } catch (err) {
      console.error("Error loading tasks:", err);
    }
  };
  
  const handleToggleStatus = async () => {
    if (!taskToToggle) return;
    setSaving(true);
    try {
      const newStatus = taskToToggle.status === "closed" ? "active" : "closed";
      await axios.put(`${API}/admin/tasks/${taskToToggle.id}/status`, { status: newStatus }, { headers });
      loadTasks();
      // Reload summary
      const summaryRes = await axios.get(`${API}/admin/tasks/summary`, { headers });
      setSummary(summaryRes.data || {});
      setShowConfirmModal(false);
      setTaskToToggle(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };
  
  // Filter tasks by search
  const filteredTasks = tasks.filter(t => 
    t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString('es-PE', { 
        day: '2-digit', 
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-tasks-page">
      <AdminSidebar
        active="tareas"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.school_name}
          subdomain={subdomain}
        />

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigateTo('/admin')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gestión de Tareas</h1>
              <p className="text-sm text-slate-500">Vista global y control de estado de tareas</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <SummaryCard icon={ClipboardList} label="Total" value={summary.total || 0} color="purple" />
            <SummaryCard icon={CheckCircle} label="Activas" value={summary.active || 0} color="emerald" />
            <SummaryCard icon={AlertCircle} label="Vencidas" value={summary.expired || 0} color="red" />
            <SummaryCard icon={Lock} label="Cerradas" value={summary.closed || 0} color="slate" />
            <SummaryCard icon={FileText} label="Entregas" value={summary.total_submissions || 0} color="blue" />
            <SummaryCard icon={Clock} label="Sin calificar" value={summary.pending_grading || 0} color="amber" />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-slate-400" />
              <span className="font-medium text-slate-700">Filtros</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Asignatura</label>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="">Todas las asignaturas</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Profesor</label>
                <select
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="">Todos los profesores</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Estado</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="">Todos los estados</option>
                  <option value="active">Activas</option>
                  <option value="expired">Vencidas</option>
                  <option value="closed">Cerradas</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar tarea..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Tareas ({filteredTasks.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Tarea</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Asignatura</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Profesor</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha límite</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Entregas</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Calificadas</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500">
                        No hay tareas para mostrar
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                              <ClipboardList className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800 line-clamp-1">{task.title}</p>
                              <p className="text-xs text-slate-400">Max: {task.max_grade || 20} pts</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{task.subject_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{task.teacher_name}</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                          {formatDate(task.due_date)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-medium text-blue-600">{task.submissions_count}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-medium text-emerald-600">{task.graded_count}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <TaskStatusBadge status={task.status} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setTaskToToggle(task); setShowConfirmModal(true); }}
                              className={`p-2 rounded-lg transition-colors ${
                                task.status === "closed" 
                                  ? "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50" 
                                  : "text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                              }`}
                              title={task.status === "closed" ? "Reabrir tarea" : "Cerrar tarea"}
                            >
                              {task.status === "closed" ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => { setShowConfirmModal(false); setTaskToToggle(null); }}
        onConfirm={handleToggleStatus}
        title={taskToToggle?.status === "closed" ? "Reabrir Tarea" : "Cerrar Tarea"}
        message={taskToToggle?.status === "closed" 
          ? `¿Reabrir la tarea "${taskToToggle?.title}"? Los estudiantes podrán volver a entregar.`
          : `¿Cerrar la tarea "${taskToToggle?.title}"? Los estudiantes no podrán entregar más.`
        }
        confirmText={taskToToggle?.status === "closed" ? "Reabrir" : "Cerrar"}
        confirmVariant={taskToToggle?.status === "closed" ? "primary" : "warning"}
        loading={saving}
      />
    </div>
  );
}
