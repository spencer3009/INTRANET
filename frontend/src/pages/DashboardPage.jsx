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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DashboardPage({ user, token, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [enrollment, setEnrollment] = useState([]);
  const [activeSection, setActiveSection] = useState("inicio");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, eventsRes, enrollmentRes] = await Promise.all([
        axios.get(`${API}/dashboard/metrics`, { headers }),
        axios.get(`${API}/dashboard/events`, { headers }),
        axios.get(`${API}/dashboard/enrollment`, { headers }),
      ]);
      setMetrics(metricsRes.data);
      setEvents(eventsRes.data);
      setEnrollment(enrollmentRes.data);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      if (err.response?.status === 401) onLogout();
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="dashboard-container">
      <Sidebar
        active={activeSection}
        onNavigate={setActiveSection}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
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
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto custom-scroll" data-testid="dashboard-main">
          <MetricCards metrics={metrics} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            {/* Left column */}
            <div className="lg:col-span-8 space-y-6">
              <HeroBanner user={user} />
              <QuickAccess />
              <StudentChart data={enrollment} />
              <AttendanceAndNews />
            </div>

            {/* Right column */}
            <div className="lg:col-span-4 space-y-6">
              <ProfileCard user={user} />
              <EventsList events={events} />
              <MiniCalendar />
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-10 bg-[#001f4b] rounded-xl p-8 text-white" data-testid="dashboard-footer">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src="https://socioscreativos.com/wp-content/uploads/2026/02/roble.jpg"
                    alt="Logo"
                    className="h-10 w-auto object-contain brightness-0 invert"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/40?text=ER'; }}
                  />
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-white/60 uppercase">Colegio</p>
                    <p className="text-sm font-extrabold tracking-wide" style={{ fontFamily: 'Manrope, sans-serif' }}>EL ROBLE</p>
                  </div>
                </div>
                <p className="text-xs text-white/50 leading-relaxed max-w-xs">
                  Formando líderes con valores desde 1985. Educación integral para un futuro brillante.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#e1b82c] mb-3">Contacto</h4>
                <div className="space-y-2 text-xs text-white/60">
                  <p>Av. Los Robles 1234, Lima, Perú</p>
                  <p>Tel: (01) 555-0100</p>
                  <p>info@colegioelroble.edu.pe</p>
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
              <p className="text-[11px] text-white/40">Colegio El Roble &copy; 2026 — Todos los derechos reservados</p>
              <p className="text-[11px] text-white/40">Intranet v1.0</p>
            </div>
          </footer>

        </main>
      </div>
    </div>
  );
}
