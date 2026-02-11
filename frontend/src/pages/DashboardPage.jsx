import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import MetricCards from "@/components/MetricCards";
import HeroBanner from "@/components/HeroBanner";
import QuickAccess from "@/components/QuickAccess";
import EventsList from "@/components/EventsList";
import MiniCalendar from "@/components/MiniCalendar";
import ProfileCard from "@/components/ProfileCard";
import StudentChart from "@/components/StudentChart";
import AttendanceAndNews from "@/components/AttendanceAndNews";
import DemoBanner from "@/components/DemoBanner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DashboardPage({ user, token, onLogout, routeSubdomain }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [news, setNews] = useState([]);
  const [enrollment, setEnrollment] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeSection, setActiveSection] = useState("inicio");

  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = routeSubdomain || user?.subdomain;

  const fetchData = useCallback(async () => {
    try {
      // Get date range for calendar events (this month + next month)
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date(today.setMonth(today.getMonth() + 2)).toISOString().split('T')[0];

      const [metricsRes, eventsRes, enrollmentRes, settingsRes, calendarRes, newsRes] = await Promise.all([
        axios.get(`${API}/dashboard/metrics`, { headers }),
        axios.get(`${API}/dashboard/events`, { headers }),
        axios.get(`${API}/dashboard/enrollment`, { headers }),
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/calendar/events?start_date=${startDate}&end_date=${endDate}`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/news?status=published&limit=5`, { headers }).catch(() => ({ data: { news: [] } })),
      ]);
      setMetrics(metricsRes.data);
      setEvents(eventsRes.data);
      setEnrollment(enrollmentRes.data);
      setCalendarEvents(calendarRes.data || []);
      setNews(newsRes.data?.news || []);
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
      />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto custom-scroll" data-testid="dashboard-main">
          <DemoBanner token={token} onDemoDeleted={fetchData} />
          <MetricCards metrics={metrics} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            {/* Left column */}
            <div className="lg:col-span-8 space-y-6">
              <HeroBanner user={user} schoolName={schoolName} />
              <QuickAccess />
              <StudentChart data={enrollment} />
              <AttendanceAndNews news={news} />
            </div>

            {/* Right column */}
            <div className="lg:col-span-4 space-y-6">
              <ProfileCard user={user} />
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
    </div>
  );
}
