import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTenant } from "@/App";
import DashboardHeader from "@/components/DashboardHeader";
import PsicologiaSidebar from "@/components/PsicologiaSidebar";
import {
  Users, ClipboardList, Calendar, ChevronRight, Clock,
  Activity, User, MessageSquare, BookOpen,
  CalendarClock, GraduationCap, FileText, TrendingUp,
  ArrowRight, MapPin, Newspaper
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const currentMonth = MONTHS_ES[new Date().getMonth()];

const psyMetricCards = [
  {
    id: "seguimiento",
    label: "En Seguimiento",
    key: "total_in_seguimiento",
    subtitle: "Estudiantes activos",
    icon: Users,
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)",
    shadow: "0 10px 40px -10px rgba(37, 99, 235, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
    orbColor: "from-white/20 to-white/5",
    lineGradient: "from-sky-300 via-blue-200 to-indigo-300",
    iconBg: "from-white/30 to-white/10",
    textColor: "text-blue-100",
    arrowColor: "text-blue-200 group-hover:text-white",
    hasCorner: true,
    nav: "/psicologia/estudiantes",
  },
  {
    id: "sesiones_mes",
    label: `Sesiones de ${currentMonth}`,
    key: "sessions_this_month",
    subtitle: "Sesiones realizadas",
    icon: Calendar,
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    shadow: "0 10px 40px -10px rgba(5, 150, 105, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
    orbColor: "from-white/20 to-white/5",
    lineGradient: "from-emerald-300 via-green-200 to-teal-300",
    iconBg: "from-white/30 to-white/10",
    textColor: "text-emerald-100",
    arrowColor: "text-emerald-200 group-hover:text-white",
    hasCircle: true,
    nav: "/psicologia/sesiones",
  },
  {
    id: "nuevos_casos",
    label: "Nuevos Casos",
    key: "new_cases_this_month",
    subtitle: `Registrados en ${currentMonth}`,
    icon: TrendingUp,
    gradient: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)",
    shadow: "0 10px 40px -10px rgba(109, 40, 217, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
    orbColor: "from-white/15 to-white/5",
    lineGradient: "from-violet-300 via-purple-200 to-fuchsia-300",
    iconBg: "from-white/30 to-white/10",
    textColor: "text-violet-100",
    arrowColor: "text-violet-200 group-hover:text-white",
    nav: "/psicologia/fichas",
  },
  {
    id: "citas_hoy",
    label: "Citas de Hoy",
    key: "appointments_today",
    subtitle: "Programadas para hoy",
    icon: CalendarClock,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
    shadow: "0 10px 40px -10px rgba(217, 119, 6, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
    orbColor: "from-white/20 to-white/5",
    lineGradient: "from-amber-300 via-yellow-200 to-orange-300",
    iconBg: "from-white/30 to-white/10",
    textColor: "text-amber-100",
    arrowColor: "text-amber-200 group-hover:text-white",
    hasPulse: true,
    nav: "/psicologia/agenda",
  },
];

export default function PsicologiaDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain: routeSubdomain } = useParams();
  const { getSchoolPath } = useTenant();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [todayAppts, setTodayAppts] = useState([]);
  const [upcomingWorkshops, setUpcomingWorkshops] = useState([]);
  const [settings, setSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = routeSubdomain || user?.subdomain;

  useEffect(() => {
    fetchStats();
    fetchTodayAppointments();
    fetchUpcomingWorkshops();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const sub = subdomain || user?.subdomain || "";
      if (!sub) return;
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/public/${sub}`);
      if (res.ok) setSettings(await res.json());
    } catch(e) {}
  };

  const fetchTodayAppointments = async () => {
    try {
      const res = await fetch(`${API}/v1/psychology/appointments/today`, { headers });
      if (res.ok) { const d = await res.json(); setTodayAppts(d.appointments || []); }
    } catch(e) {}
  };

  const fetchUpcomingWorkshops = async () => {
    try {
      const res = await fetch(`${API}/v1/psychology/workshops?status=planificado&limit=5`, { headers });
      if (res.ok) { const d = await res.json(); setUpcomingWorkshops(d.workshops || []); }
    } catch(e) {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/v1/psychology/dashboard/stats`, { headers });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "EduNet";
  const logoUrl = settings?.logo_url;

  const enrichedStats = stats ? {
    ...stats,
    appointments_today: todayAppts.length
  } : null;

  const quickActions = [
    { label: "Estudiantes", desc: "Listado completo", icon: Users, path: "/psicologia/estudiantes", color: "blue" },
    { label: "Fichas Clinicas", desc: "Registros de estudiantes", icon: ClipboardList, path: "/psicologia/fichas", color: "violet" },
    { label: "Agenda", desc: "Calendario de citas", icon: CalendarClock, path: "/psicologia/agenda", color: "rose" },
    { label: "Talleres", desc: "Talleres grupales", icon: GraduationCap, path: "/psicologia/talleres", color: "teal" },
  ];

  const colorMap = {
    blue: { bg: "bg-blue-100", hover: "bg-blue-500", icon: "text-blue-600", bar: "bg-blue-500", arrow: "text-blue-500" },
    violet: { bg: "bg-violet-100", hover: "bg-violet-500", icon: "text-violet-600", bar: "bg-violet-500", arrow: "text-violet-500" },
    rose: { bg: "bg-rose-100", hover: "bg-rose-500", icon: "text-rose-600", bar: "bg-rose-500", arrow: "text-rose-500" },
    teal: { bg: "bg-teal-100", hover: "bg-teal-500", icon: "text-teal-600", bar: "bg-teal-500", arrow: "text-teal-500" },
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="psicologia-dashboard">
      <PsicologiaSidebar
        active="inicio"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        schoolName={schoolName}
        subdomain={subdomain}
        token={token}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
          token={token}
        />

        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-20 lg:pb-8 overflow-y-auto custom-scroll" data-testid="psicologia-main">
          {/* Colored Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="psicologia-metric-cards">
            {psyMetricCards.map((card, i) => {
              const Icon = card.icon;
              const rawValue = enrichedStats ? enrichedStats[card.key] : null;
              const isCardLoading = rawValue === null || rawValue === undefined;
              const displayValue = isCardLoading ? "..." : String(rawValue);

              return (
                <div
                  key={card.id}
                  onClick={() => navigate(getSchoolPath(card.nav))}
                  className={`relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1`}
                  style={{ background: card.gradient, boxShadow: card.shadow }}
                  data-testid={`psicologia-metric-${card.id}`}
                >
                  <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${card.orbColor} rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`} />
                  {card.hasCorner && <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-[100px]" />}
                  {card.hasCircle && <div className="absolute bottom-4 right-4 w-16 h-16 border-4 border-white/10 rounded-full" />}
                  {card.hasPulse && <div className="absolute top-4 right-4 w-3 h-3 bg-white/40 rounded-full animate-pulse" />}
                  <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r ${card.lineGradient} opacity-70`} />
                  <div className="relative flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.iconBg} backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-lg`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className={`text-sm font-semibold ${card.textColor} tracking-wide`}>{card.label}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {displayValue}
                        </span>
                        <p className={`text-xs mt-1 ${card.textColor} opacity-80`}>{card.subtitle}</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${card.arrowColor} group-hover:translate-x-1 transition-all`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6" data-testid="psicologia-quick-actions">
            {quickActions.map((item) => {
              const Icon = item.icon;
              const c = colorMap[item.color];
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(getSchoolPath(item.path))}
                  className="group relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all text-left overflow-hidden"
                  data-testid={`quick-action-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className={`absolute top-0 left-0 w-full h-1 ${c.bar} scale-x-0 group-hover:scale-x-100 transition-transform origin-left`} />
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0 group-hover:${c.hover} transition-colors`}>
                      <Icon className={`w-5 h-5 ${c.icon} group-hover:text-white transition-colors`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base">{item.label}</p>
                      <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">{item.desc}</p>
                    </div>
                    <ArrowRight className={`w-4 h-4 text-slate-300 group-hover:${c.arrow} transition-colors flex-shrink-0`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Two Column Layout: Citas de Hoy + Proximos Talleres */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            {/* Today's Appointments */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="today-appointments-card">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                    <CalendarClock className="w-4 h-4 text-rose-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm">Citas de Hoy</h3>
                  {todayAppts.length > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700">{todayAppts.length}</span>
                  )}
                </div>
                <button onClick={() => navigate(getSchoolPath("/psicologia/agenda"))}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1" data-testid="go-to-agenda">
                  Ver agenda <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {todayAppts.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <CalendarClock className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin citas programadas hoy</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {todayAppts.slice(0, 5).map(appt => {
                    const dt = new Date(appt.date);
                    return (
                      <div key={appt.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => navigate(getSchoolPath("/psicologia/agenda"))}>
                        <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-4 h-4 text-rose-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{appt.title}</p>
                          <p className="text-xs text-slate-500">{appt.student_name || "Sin estudiante"}{appt.location ? ` - ${appt.location}` : ""}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-slate-700">{dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</p>
                          <p className="text-[10px] text-slate-400">{appt.duration_minutes} min</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Workshops */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="upcoming-workshops-card">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-teal-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm">Proximos Talleres</h3>
                  {upcomingWorkshops.length > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-100 text-teal-700">{upcomingWorkshops.length}</span>
                  )}
                </div>
                <button onClick={() => navigate(getSchoolPath("/psicologia/talleres"))}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1" data-testid="go-to-talleres">
                  Ver talleres <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {upcomingWorkshops.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <GraduationCap className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin talleres planificados</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcomingWorkshops.slice(0, 5).map(ws => {
                    const dt = new Date(ws.date);
                    return (
                      <div key={ws.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => navigate(getSchoolPath("/psicologia/talleres"))}>
                        <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-4 h-4 text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{ws.title}</p>
                          <p className="text-xs text-slate-500">{ws.target_level || "Todos"}{ws.location ? ` - ${ws.location}` : ""}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-slate-700">{dt.toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</p>
                          <p className="text-[10px] text-slate-400">{dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Sessions */}
          {!loading && stats?.recent_sessions?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-6" data-testid="recent-sessions-card">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm">Sesiones Recientes</h3>
                </div>
                <button onClick={() => navigate(getSchoolPath("/psicologia/sesiones"))}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  Ver todas <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {stats.recent_sessions.slice(0, 5).map((session) => (
                  <div key={session.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      {session.student_photo ? (
                        <img src={session.student_photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{session.student_name || "Estudiante"}</p>
                      <p className="text-xs text-slate-500">{session.session_type} - {session.reason_category}</p>
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
    </div>
  );
}
