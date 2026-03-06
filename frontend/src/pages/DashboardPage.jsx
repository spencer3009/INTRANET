import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import MetricCards from "@/components/MetricCards";
import OwnerMetricCards from "@/components/OwnerMetricCards";
import OwnerQuickAccess from "@/components/OwnerQuickAccess";
import PaymentsChart from "@/components/PaymentsChart";
import HeroCarousel from "@/components/HeroCarousel";
import QuickAccess from "@/components/QuickAccess";
import EventsList from "@/components/EventsList";
import MiniCalendar from "@/components/MiniCalendar";
import ProfileCard from "@/components/ProfileCard";
import StudentChart from "@/components/StudentChart";
import AttendanceAndNews from "@/components/AttendanceAndNews";
import DemoBanner from "@/components/DemoBanner";
import ReminderPopup from "@/components/ReminderPopup";
import MessageCenter from "@/components/MessageCenter";
import MobileBottomNav from "@/components/MobileBottomNav";
import SubscriptionCard from "@/components/SubscriptionCard";
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Newspaper, CalendarDays, ClipboardList, ArrowRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Component to fix permissions
function PermissionsFixer({ token, onFixed }) {
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleFix = async () => {
    setFixing(true);
    setResult(null);
    try {
      const res = await axios.post(`${API}/auth/fix-owner-permissions`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult({ success: true, message: res.data.message, data: res.data });
      // Update token and user in localStorage
      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
      }
      if (res.data.user) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
      }
      // Reload after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.detail || "Error al reparar permisos" });
    } finally {
      setFixing(false);
    }
  };
  
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-amber-800 mb-1">Permisos de administrador requeridos</h3>
          <p className="text-sm text-amber-700 mb-4">
            Tu cuenta parece no tener los permisos correctos configurados. Si eres el propietario de esta intranet, 
            haz clic en el botón para restaurar tus permisos y cargar los datos de ejemplo.
          </p>
          
          {result && (
            <div className={`flex items-center gap-2 mb-4 p-3 rounded-xl ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {result.success ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              <span className="text-sm font-medium">{result.message}</span>
              {result.success && result.data?.demo_data_seeded && (
                <span className="text-xs bg-green-200 px-2 py-0.5 rounded-full ml-2">+ Datos demo cargados</span>
              )}
            </div>
          )}
          
          <button
            onClick={handleFix}
            disabled={fixing || result?.success}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl font-semibold transition-colors"
          >
            {fixing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Reparando...
              </>
            ) : result?.success ? (
              <>
                <CheckCircle className="w-4 h-4" />
                ¡Listo! Recargando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Restaurar permisos de propietario
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage({ user, token, onLogout, routeSubdomain }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [ownerStats, setOwnerStats] = useState(null);
  const [monthlyPayments, setMonthlyPayments] = useState([]);
  const [events, setEvents] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [news, setNews] = useState([]);
  const [enrollment, setEnrollment] = useState([]);
  const [settings, setSettings] = useState(null);
  const [banners, setBanners] = useState([]);
  const [activeSection, setActiveSection] = useState("inicio");
  const [hasPermissionError, setHasPermissionError] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = routeSubdomain || user?.subdomain;

  const fetchData = useCallback(async () => {
    try {
      // Get date range for calendar events (this month + next month)
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date(today.setMonth(today.getMonth() + 2)).toISOString().split('T')[0];

      const [metricsRes, eventsRes, enrollmentRes, settingsRes, calendarRes, newsRes, bannersRes] = await Promise.all([
        axios.get(`${API}/dashboard/metrics`, { headers }),
        axios.get(`${API}/dashboard/events`, { headers }),
        axios.get(`${API}/dashboard/enrollment`, { headers }),
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/calendar/events?start_date=${startDate}&end_date=${endDate}`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/news?status=published&limit=5`, { headers }).catch(() => ({ data: { news: [] } })),
        axios.get(`${API}/dashboard/banners/active`, { headers }).catch(() => ({ data: [] })),
      ]);
      setMetrics(metricsRes.data);
      setEvents(eventsRes.data);
      setEnrollment(enrollmentRes.data);
      setCalendarEvents(calendarRes.data || []);
      setNews(newsRes.data?.news || []);
      setBanners(bannersRes.data || []);
      setHasPermissionError(false);
      
      // Cargar estadísticas de propietario si aplica
      const isOwnerRole = user?.is_owner || user?.role === "owner" || user?.is_support_session;
      if (isOwnerRole) {
        try {
          const [ownerRes, paymentsRes] = await Promise.all([
            axios.get(`${API}/dashboard/owner-stats`, { headers }),
            axios.get(`${API}/dashboard/monthly-payments`, { headers })
          ]);
          setOwnerStats(ownerRes.data);
          setMonthlyPayments(paymentsRes.data);
        } catch (e) {
          console.error("Error fetching owner stats:", e);
        }
      }
      setHasPermissionError(false);
      if (settingsRes.data) {
        setSettings(settingsRes.data);
        // Update browser title
        if (settingsRes.data.system_title) {
          document.title = settingsRes.data.system_title;
        }
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      if (err.response?.status === 401) onLogout();
      if (err.response?.status === 403) {
        setHasPermissionError(true);
      }
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get display values from settings or user
  const schoolName = settings?.system_name || user?.name || "EduNet";
  const logoUrl = settings?.logo_url;
  const systemEmail = settings?.system_email || "";
  const whatsapp = settings?.whatsapp || "";
  const websiteUrl = settings?.website_url || "";

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="dashboard-container">
      <Sidebar
        active={activeSection}
        onNavigate={setActiveSection}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain}
        token={token}
        user={user}
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

        {/* Intelligent Reminder Popup - shows important/urgent reminders */}
        <ReminderPopup token={token} />

        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-20 lg:pb-8 overflow-y-auto custom-scroll" data-testid="dashboard-main">
          {/* Permission error fixer */}
          {hasPermissionError && <PermissionsFixer token={token} onFixed={fetchData} />}
          
          <DemoBanner token={token} onDemoDeleted={fetchData} />
          
          {/* Tarjetas KPI: Propietario vs Otros roles */}
          {(user?.is_owner || user?.role === "owner" || user?.is_support_session) && ownerStats ? (
            <OwnerMetricCards stats={ownerStats} />
          ) : (
            <MetricCards metrics={metrics} />
          )}

          {/* Subscription Card removed - now integrated into ProfileCard */}

          {/* Gestión Rápida: Noticias, Eventos, Encuestas */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6" data-testid="dashboard-quick-actions">
            <button
              onClick={() => navigate(subdomain ? `/${subdomain}/noticias` : '/noticias')}
              className="group relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-blue-300 hover:shadow-md transition-all text-left overflow-hidden"
              data-testid="quick-action-noticias"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500 transition-colors">
                  <Newspaper className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm sm:text-base">Noticias</p>
                  <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Gestionar avisos</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
              </div>
            </button>

            <button
              onClick={() => navigate(subdomain ? `/${subdomain}/calendario` : '/calendario')}
              className="group relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-violet-300 hover:shadow-md transition-all text-left overflow-hidden"
              data-testid="quick-action-calendario"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-violet-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500 transition-colors">
                  <CalendarDays className="w-5 h-5 text-violet-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm sm:text-base">Eventos</p>
                  <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Calendario escolar</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
              </div>
            </button>

            <button
              onClick={() => navigate(subdomain ? `/${subdomain}/encuestas` : '/encuestas')}
              className="group relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-emerald-300 hover:shadow-md transition-all text-left overflow-hidden"
              data-testid="quick-action-encuestas"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500 transition-colors">
                  <ClipboardList className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm sm:text-base">Encuestas</p>
                  <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Crear y gestionar</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            {/* Left column */}
            <div className="lg:col-span-8 space-y-6">
              <HeroCarousel banners={banners} user={user} schoolName={schoolName} />
              {(user?.is_owner || user?.role === "owner" || user?.is_support_session) ? (
                <>
                  <OwnerQuickAccess subdomain={subdomain} />
                  <PaymentsChart data={monthlyPayments} />
                </>
              ) : (
                <>
                  <QuickAccess />
                  <StudentChart data={enrollment} />
                </>
              )}
              <AttendanceAndNews news={news} />
            </div>

            {/* Right column */}
            <div className="lg:col-span-4 space-y-6">
              <ProfileCard user={user} stats={{ subjects: metrics?.subjects || 0, students: metrics?.students || 0 }} ownerStats={ownerStats} schoolName={schoolName} token={token} />
              <EventsList events={calendarEvents.length > 0 ? calendarEvents : events} />
              <MiniCalendar events={calendarEvents} />
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-10 bg-[#001f4b] rounded-xl p-8 text-white" data-testid="dashboard-footer">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-10 w-auto object-contain"
                    />
                  ) : (
                    <div className="h-10 w-10 bg-[#e1b82c] rounded-lg flex items-center justify-center">
                      <span className="text-[#001f4b] font-bold text-lg">
                        {schoolName?.charAt(0) || "E"}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-white/60 uppercase">Intranet</p>
                    <p className="text-sm font-extrabold tracking-wide" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {schoolName}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-white/50 leading-relaxed max-w-xs">
                  Sistema de gestión educativa integral. Potenciado por EduNet.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#e1b82c] mb-3">Contacto</h4>
                <div className="space-y-2 text-xs text-white/60">
                  {systemEmail && <p>{systemEmail}</p>}
                  {whatsapp && <p>WhatsApp: {whatsapp}</p>}
                  {websiteUrl && (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      {websiteUrl}
                    </a>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#e1b82c] mb-3">Enlaces</h4>
                <div className="space-y-2 text-xs text-white/60">
                  <p className="hover:text-white cursor-pointer transition-colors">Portal de Padres</p>
                  <p className="hover:text-white cursor-pointer transition-colors">Reglamento Interno</p>
                  <p className="hover:text-white cursor-pointer transition-colors">Política de Privacidad</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-[11px] text-white/40">{schoolName} &copy; {new Date().getFullYear()} — Todos los derechos reservados</p>
              <p className="text-[11px] text-white/40">Powered by EduNet</p>
            </div>
          </footer>

        </main>
      </div>

      {/* Global Message Center - Floating Button + Drawer */}
      <MessageCenter token={token} user={user} />
      <MobileBottomNav role={user?.role === "admin" ? "admin" : "owner"} />
    </div>
  );
}
