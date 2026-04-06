import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import {
  Brain, Users, ClipboardList, Calendar, LogOut, User,
  TrendingUp, FileText, Search, ChevronRight, Clock,
  AlertTriangle, CheckCircle2, Activity, MessageSquare, BookOpen
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PsicologiaDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchStats();
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnread = async () => {
    try {
      const res = await fetch(`${API}/v1/psychology/messages/unread-count`, { headers });
      if (res.ok) { const d = await res.json(); setUnreadCount(d.unread_count || 0); }
    } catch(e) {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/v1/psychology/dashboard/stats`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const psychProfile = user?.psychologist_profile || {};

  const menuItems = [
    {
      icon: Users,
      label: "Estudiantes",
      description: "Ver listado de estudiantes",
      path: getSchoolPath("/psicologia/estudiantes"),
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    {
      icon: ClipboardList,
      label: "Fichas Psicologicas",
      description: "Registros clinicos de estudiantes",
      path: getSchoolPath("/psicologia/fichas"),
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600"
    },
    {
      icon: Calendar,
      label: "Sesiones",
      description: "Historial de sesiones clinicas",
      path: getSchoolPath("/psicologia/sesiones"),
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600"
    },
    {
      icon: MessageSquare,
      label: "Comunicacion con Padres",
      description: "Mensajes y plantillas",
      path: getSchoolPath("/psicologia/mensajes"),
      iconBg: "bg-sky-100",
      iconColor: "text-sky-600",
      badge: unreadCount
    },
    {
      icon: User,
      label: "Mi Perfil",
      description: "Datos personales y profesionales",
      path: getSchoolPath("/psicologia/perfil"),
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50" data-testid="psicologia-dashboard">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Portal de Psicologia</h1>
              <p className="text-xs text-slate-500">
                {user?.name} {user?.last_name}
                {psychProfile?.specialty && ` - ${psychProfile.specialty}`}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            data-testid="psicologia-logout-btn"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl shadow-violet-600/20">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                Bienvenido/a, {user?.name}
              </h2>
              <p className="text-violet-200 mt-1 text-sm">
                Departamento de Psicologia Escolar
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white/80" />
            </div>
          </div>

          {/* Stats Cards */}
          {!loading && stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-violet-200" />
                  <span className="text-xs text-violet-200">En seguimiento</span>
                </div>
                <p className="text-2xl font-bold" data-testid="stat-seguimiento">{stats.total_in_seguimiento}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-violet-200" />
                  <span className="text-xs text-violet-200">Sesiones mes</span>
                </div>
                <p className="text-2xl font-bold" data-testid="stat-sesiones-mes">{stats.sessions_this_month}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-violet-200" />
                  <span className="text-xs text-violet-200">Nuevos casos</span>
                </div>
                <p className="text-2xl font-bold" data-testid="stat-nuevos">{stats.new_cases_this_month}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-violet-200" />
                  <span className="text-xs text-violet-200">Hoy</span>
                </div>
                <p className="text-2xl font-bold" data-testid="stat-hoy">{stats.sessions_today}</p>
              </div>
            </div>
          )}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 animate-pulse">
                  <div className="h-3 w-20 bg-white/20 rounded mb-2"></div>
                  <div className="h-8 w-10 bg-white/20 rounded"></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="bg-white rounded-2xl p-5 border border-slate-200/60 hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300/60 transition-all text-left group relative"
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {item.badge > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">{item.badge}</span>
              )}
              <div className={`w-12 h-12 rounded-xl ${item.iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <item.icon className={`w-6 h-6 ${item.iconColor}`} />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">{item.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
              <div className="flex items-center gap-1 mt-3 text-xs text-slate-400 group-hover:text-violet-600 transition-colors">
                <span>Ir</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>

        {/* Recent Sessions */}
        {!loading && stats?.recent_sessions?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-violet-600" />
                <h3 className="font-semibold text-slate-800">Sesiones Recientes</h3>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {stats.recent_sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    {session.student_photo ? (
                      <img src={session.student_photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-violet-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {session.student_name || "Estudiante"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {session.session_type} - {session.reason_category}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">{session.date?.slice(0, 10)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
