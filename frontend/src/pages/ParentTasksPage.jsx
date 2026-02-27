import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  ClipboardList, Loader2, Search, CheckCircle, Clock, AlertCircle, Calendar, BookOpen, ChevronRight, Upload
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-700", icon: Clock },
  submitted: { label: "Entregada", color: "bg-blue-100 text-blue-700", icon: Upload },
  graded: { label: "Calificada", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  late: { label: "Atrasada", color: "bg-red-100 text-red-700", icon: AlertCircle }
};

export default function ParentTasksPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [settings, setSettings] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

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
          const res = await axios.get(`${API}/api/parent/tasks?student_id=${child.id}`, { headers });
          setTasks(res.data.tasks || []);
          localStorage.setItem('selected_child_id', child.id);
        }
      } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
    };
    init();
  }, [token]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/parent/tasks?student_id=${newChild.id}`, { headers });
      setTasks(res.data.tasks || []);
      localStorage.setItem('selected_child_id', newChild.id);
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;
  const navigateTo = (path) => navigate(subdomain ? `/school/${subdomain}${path}` : path);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) || task.course_name?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    return task.status === statusFilter;
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    submitted: tasks.filter(t => t.status === "submitted").length,
    graded: tasks.filter(t => t.status === "graded").length,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="parent-tasks-page">
      <ParentSidebar active="tareas" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange} />
      {sidebarExpanded && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} roleLabel="Padre/Apoderado" profilePath="/parent/profile" />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6">
            <ClipboardList className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-slate-800">Tareas de {selectedChild?.name || ""}</h2>
            <span className="text-sm text-slate-500">({stats.pending} pendientes · {stats.submitted} entregadas · {stats.graded} calificadas)</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { key: "pending", label: "Pendientes", count: stats.pending, icon: Clock, active: "bg-amber-50 border-amber-300", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
              { key: "submitted", label: "Entregadas", count: stats.submitted, icon: Upload, active: "bg-blue-50 border-blue-300", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
              { key: "graded", label: "Calificadas", count: stats.graded, icon: CheckCircle, active: "bg-emerald-50 border-emerald-300", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
              { key: "all", label: "Todas", count: stats.total, icon: ClipboardList, active: "bg-slate-100 border-slate-400", iconBg: "bg-slate-200", iconColor: "text-slate-600" }
            ].map(s => (
              <button key={s.key} onClick={() => setStatusFilter(s.key)} className={`p-4 rounded-xl border transition-all ${statusFilter === s.key ? s.active : "bg-white border-slate-200 hover:border-slate-300"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${s.iconBg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.iconColor}`} /></div>
                  <div className="text-left"><p className="text-2xl font-bold text-slate-800">{s.count}</p><p className="text-xs text-slate-500">{s.label}</p></div>
                </div>
              </button>
            ))}
          </div>

          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar tarea o curso..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 transition-colors" data-testid="search-tasks" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /></div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-10 h-10 text-amber-400" /></div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">{searchQuery || statusFilter !== "all" ? "Sin resultados" : "Sin tareas"}</h3>
              <p className="text-slate-500 max-w-sm mx-auto">{searchQuery || statusFilter !== "all" ? "No encontramos tareas que coincidan" : "No hay tareas asignadas por el momento"}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const status = task.status || "pending";
                  const StatusIcon = STATUS_CONFIG[status]?.icon || Clock;
                  const dueDate = task.due_date || null;
                  const isPastDue = dueDate && new Date(dueDate) < new Date();
                  return (
                    <div key={task.id} onClick={() => navigateTo(`/parent/courses/${task.course_id}?task=${task.id}`)} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4" data-testid={`task-item-${task.id}`}>
                      <div className="w-2 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: task.course_color || "#f59e0b" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800 truncate">{task.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[status]?.color || "bg-slate-100"}`}>{STATUS_CONFIG[status]?.label || status}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{task.course_name}</span>
                          {dueDate && (
                            <span className={`flex items-center gap-1 ${isPastDue && status === "pending" ? "text-red-500" : ""}`}>
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(dueDate).toLocaleDateString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`w-5 h-5 ${status === "graded" ? "text-emerald-500" : status === "submitted" ? "text-blue-500" : status === "late" ? "text-red-500" : "text-amber-500"}`} />
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
      <MessageCenter token={token} user={user} />
    </div>
  );
}
