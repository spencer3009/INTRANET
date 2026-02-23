import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
  Filter,
  Calendar,
  BookOpen,
  Search,
  Star
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentTasksPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("tareas");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Parent-specific state
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [settings, setSettings] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadParentProfile();
  }, [token]);

  useEffect(() => {
    if (selectedChild) {
      loadTasks(selectedChild.id);
      localStorage.setItem('selected_child_id', selectedChild.id);
    }
  }, [selectedChild]);

  const loadParentProfile = async () => {
    try {
      const [profileRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/parent/me`, { headers }),
        axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null }))
      ]);
      
      setChildren(profileRes.data.children || []);
      if (settingsRes.data) setSettings(settingsRes.data);
      
      const savedChildId = localStorage.getItem('selected_child_id');
      const childrenList = profileRes.data.children || [];
      
      if (childrenList.length > 0) {
        const savedChild = childrenList.find(c => c.id === savedChildId);
        setSelectedChild(savedChild || childrenList[0]);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Error:", err);
      setLoading(false);
    }
  };

  const loadTasks = async (studentId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/parent/tasks?student_id=${studentId}`, { headers });
      setTasks(res.data.tasks || []);
      setStats(res.data.stats || {});
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesSearch = !searchQuery || 
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.subject_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Group by status
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
  const submittedTasks = filteredTasks.filter(t => t.status === 'submitted');
  const gradedTasks = filteredTasks.filter(t => t.status === 'graded');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ParentSidebar
        active={activeSection}
        onNavigate={setActiveSection}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain}
        user={user}
        children={children}
        selectedChild={selectedChild}
        onSelectChild={setSelectedChild}
      />

      <div className="flex-1 flex flex-col lg:ml-16">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
          token={token}
          roleLabel="Padre/Apoderado"
          profilePath="/parent/profile"
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <ClipboardList className="w-8 h-8 inline-block mr-2 -mt-1" />
                  Tareas de {selectedChild?.name}
                </h1>
                <p className="text-amber-100">
                  Seguimiento de tareas y entregas
                </p>
              </div>
              <div className="flex gap-3">
                <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                  <p className="text-2xl font-bold">{stats.pending || 0}</p>
                  <p className="text-xs text-amber-100">Pendientes</p>
                </div>
                <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                  <p className="text-2xl font-bold">{stats.submitted || 0}</p>
                  <p className="text-xs text-amber-100">Entregadas</p>
                </div>
                <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                  <p className="text-2xl font-bold">{stats.graded || 0}</p>
                  <p className="text-xs text-amber-100">Calificadas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar tarea..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'pending', 'submitted', 'graded'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === status
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {status === 'all' ? 'Todas' : 
                     status === 'pending' ? 'Pendientes' : 
                     status === 'submitted' ? 'Entregadas' : 'Calificadas'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <CheckCircle className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                {statusFilter === 'all' ? '¡Sin tareas!' : `Sin tareas ${statusFilter === 'pending' ? 'pendientes' : statusFilter === 'submitted' ? 'entregadas' : 'calificadas'}`}
              </h3>
              <p className="text-slate-500">
                {selectedChild?.name} no tiene tareas en esta categoría
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => {
                const dueDate = task.due_date ? new Date(task.due_date) : null;
                const isOverdue = dueDate && dueDate < new Date() && task.status === 'pending';
                
                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all"
                    data-testid={`task-${task.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{ backgroundColor: task.subject_color || '#3B82F6' }}
                      >
                        <BookOpen className="w-6 h-6" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-slate-800 mb-1">{task.title}</h4>
                            <p className="text-sm text-slate-500">{task.subject_name}</p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                            {/* Status Badge */}
                            {task.status === 'graded' ? (
                              <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                <Star className="w-3 h-3" /> {task.submission?.grade}
                              </span>
                            ) : task.status === 'submitted' ? (
                              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                                Entregada
                              </span>
                            ) : isOverdue ? (
                              <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                                Vencida
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                                Pendiente
                              </span>
                            )}
                            
                            {/* Due Date */}
                            {dueDate && (
                              <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                                <Calendar className="w-3 h-3" />
                                {dueDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{task.description}</p>
                        )}
                        
                        {task.submission?.feedback && (
                          <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
                            <p className="text-xs text-emerald-600 font-medium mb-1">Retroalimentación del profesor:</p>
                            <p className="text-sm text-emerald-800">{task.submission.feedback}</p>
                          </div>
                        )}
                      </div>
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
