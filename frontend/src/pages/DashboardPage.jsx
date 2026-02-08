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
            </div>

            {/* Right column */}
            <div className="lg:col-span-4 space-y-6">
              <ProfileCard user={user} />
              <EventsList events={events} />
              <MiniCalendar />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
