import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import {
  MessageSquare, Users, TrendingUp, Clock, Search, Filter,
  Loader2, ArrowLeft, Eye, MessageCircle, AlertCircle, CheckCircle,
  XCircle, BarChart3
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Summary Card
function SummaryCard({ icon: Icon, label, value, color, trend }) {
  const colorClasses = {
    purple: "bg-purple-100 text-purple-600",
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600"
  };
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {trend > 0 ? `+${trend}%` : `${trend}%`}
          </span>
        )}
      </div>
    </div>
  );
}

// Thread Type Badge
function ThreadTypeBadge({ type }) {
  const styles = {
    support: "bg-red-100 text-red-700",
    academic: "bg-blue-100 text-blue-700",
    general: "bg-slate-100 text-slate-600"
  };
  const labels = {
    support: "Soporte",
    academic: "Académico",
    general: "General"
  };
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[type] || styles.general}`}>
      {labels[type] || type}
    </span>
  );
}

// Status Badge
function StatusBadge({ isResolved }) {
  return isResolved ? (
    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 flex items-center gap-1">
      <CheckCircle className="w-3 h-3" /> Resuelto
    </span>
  ) : (
    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
      <Clock className="w-3 h-3" /> Pendiente
    </span>
  );
}

export default function AdminMessagesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [threads, setThreads] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    today: 0
  });
  
  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsRes, threadsRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/messaging/threads`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      if (settingsRes.data) setSettings(settingsRes.data);
      
      const allThreads = threadsRes.data || [];
      setThreads(allThreads);
      
      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      setStats({
        total: allThreads.length,
        active: allThreads.filter(t => !t.is_resolved).length,
        resolved: allThreads.filter(t => t.is_resolved).length,
        today: allThreads.filter(t => t.created_at?.startsWith(today)).length
      });
      
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  // Filter threads
  const filteredThreads = threads.filter(t => {
    if (filterType && t.type !== filterType) return false;
    if (filterStatus === "active" && t.is_resolved) return false;
    if (filterStatus === "resolved" && !t.is_resolved) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!t.subject?.toLowerCase().includes(search) && 
          !t.participant_names?.some(n => n.toLowerCase().includes(search))) {
        return false;
      }
    }
    return true;
  });

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      
      if (hours < 1) return "Hace un momento";
      if (hours < 24) return `Hace ${hours}h`;
      if (hours < 48) return "Ayer";
      return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
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
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-messages-page">
      <AdminSidebar
        active="mensajes"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.system_name || "EduNet"}
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
          schoolName={settings?.system_name}
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
              <h1 className="text-2xl font-bold text-slate-800">Centro de Mensajes</h1>
              <p className="text-sm text-slate-500">Monitoreo de mensajes institucionales</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard icon={MessageSquare} label="Total conversaciones" value={stats.total} color="purple" />
            <SummaryCard icon={Clock} label="Activas" value={stats.active} color="amber" />
            <SummaryCard icon={CheckCircle} label="Resueltas" value={stats.resolved} color="emerald" />
            <SummaryCard icon={TrendingUp} label="Hoy" value={stats.today} color="blue" />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por asunto o participante..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="">Todos los tipos</option>
                <option value="support">Soporte</option>
                <option value="academic">Académico</option>
                <option value="general">General</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="resolved">Resueltos</option>
              </select>
            </div>
          </div>

          {/* Threads List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">
                Conversaciones ({filteredThreads.length})
              </h2>
            </div>
            
            {filteredThreads.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No hay conversaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredThreads.slice(0, 50).map((thread) => (
                  <div key={thread.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-slate-800 truncate">
                            {thread.subject || "Sin asunto"}
                          </h3>
                          <ThreadTypeBadge type={thread.type} />
                          <StatusBadge isResolved={thread.is_resolved} />
                        </div>
                        <p className="text-sm text-slate-500 mb-2">
                          Participantes: {thread.participant_names?.join(", ") || "N/A"}
                        </p>
                        {thread.last_message && (
                          <p className="text-sm text-slate-400 truncate">
                            {thread.last_message}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs text-slate-400">{formatDate(thread.updated_at || thread.created_at)}</p>
                        {thread.unread_count > 0 && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {filteredThreads.length > 50 && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                Mostrando 50 de {filteredThreads.length} conversaciones
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
