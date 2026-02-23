import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  CalendarCheck,
  Menu,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Attendance status config
const STATUS_CONFIG = {
  present: { label: "Asistió", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  absent: { label: "Faltó", color: "bg-red-100 text-red-700", icon: XCircle },
  late: { label: "Tardanza", color: "bg-amber-100 text-amber-700", icon: Clock },
  justified: { label: "Justificado", color: "bg-blue-100 text-blue-700", icon: FileText }
};

export default function StudentAttendancePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [settings, setSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadSettings();
  }, [token]);

  useEffect(() => {
    loadAttendance();
  }, [token, selectedMonth]);

  const loadSettings = async () => {
    try {
      const res = await axios.get(`${API}/api/settings/public/${subdomain}`, { headers });
      if (res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    }
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      // Get first and last day of selected month
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      const res = await axios.get(
        `${API}/api/attendance/student?start_date=${startDate}&end_date=${endDate}`, 
        { headers }
      );
      setAttendance(res.data.records || []);
    } catch (err) {
      console.error("Error loading attendance:", err);
      // If endpoint doesn't exist, show empty state
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  // Get display values from settings
  const schoolName = settings?.system_name || user?.school_name || "Portal Alumno";
  const logoUrl = settings?.logo_url;

  // Navigate months
  const prevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
    if (next <= new Date()) {
      setSelectedMonth(next);
    }
  };

  // Calculate stats for selected month
  const stats = {
    present: attendance.filter(a => a.status === "present").length,
    absent: attendance.filter(a => a.status === "absent").length,
    late: attendance.filter(a => a.status === "late").length,
    justified: attendance.filter(a => a.status === "justified").length,
    total: attendance.length
  };

  // Calculate attendance percentage
  const attendancePercent = stats.total > 0
    ? Math.round(((stats.present + stats.justified) / stats.total) * 100)
    : 0;

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    // Empty slots for days before first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, status: null });
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = attendance.find(a => a.date === dateStr);
      days.push({
        day,
        date: dateStr,
        status: record?.status || null,
        isWeekend: [0, 6].includes(new Date(year, month, day).getDay())
      });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Student Sidebar */}
      <StudentSidebar
        active="asistencia"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Identical to Owner's Portal */}
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Title */}
          <div className="flex items-center gap-2 mb-6">
            <CalendarCheck className="w-6 h-6 text-emerald-500" />
            <h2 className="text-xl font-bold text-slate-800">Mi Asistencia</h2>
          </div>

          {/* Month Navigator */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              
              <h2 className="text-lg font-semibold text-slate-800 capitalize">
                {selectedMonth.toLocaleDateString("es-PE", { month: "long", year: "numeric" })}
              </h2>
              
              <button
                onClick={nextMonth}
                disabled={selectedMonth.getMonth() === new Date().getMonth() && selectedMonth.getFullYear() === new Date().getFullYear()}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white col-span-2 lg:col-span-1">
                  <p className="text-white/80 text-sm">Asistencia</p>
                  <p className="text-3xl font-bold">{attendancePercent}%</p>
                </div>
                
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-emerald-600 mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Asistencias</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{stats.present}</p>
                </div>
                
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Tardanzas</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{stats.late}</p>
                </div>
                
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-red-600 mb-1">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Faltas</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{stats.absent}</p>
                </div>
                
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">Justificadas</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{stats.justified}</p>
                </div>
              </div>

              {/* Calendar View */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                  Calendario de Asistencia
                </h3>
                
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, idx) => (
                    <div
                      key={idx}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm ${
                        cell.day === null
                          ? ""
                          : cell.status
                            ? STATUS_CONFIG[cell.status]?.color || "bg-slate-100"
                            : cell.isWeekend
                              ? "bg-slate-50 text-slate-400"
                              : "bg-slate-50 text-slate-600"
                      }`}
                      title={cell.status ? STATUS_CONFIG[cell.status]?.label : ""}
                    >
                      {cell.day && (
                        <>
                          <span className={`font-medium ${cell.status ? "" : ""}`}>{cell.day}</span>
                          {cell.status && (
                            <span className="mt-0.5">
                              {cell.status === "present" && "✓"}
                              {cell.status === "absent" && "✗"}
                              {cell.status === "late" && "⏰"}
                              {cell.status === "justified" && "📄"}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className={`w-4 h-4 rounded ${config.color}`} />
                      <span className="text-slate-600">{config.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendance List */}
              {attendance.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <h3 className="font-semibold text-slate-800 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-emerald-500" />
                    Detalle del Mes
                  </h3>
                  <div className="divide-y divide-slate-100">
                    {attendance.map((record, idx) => {
                      const config = STATUS_CONFIG[record.status];
                      const StatusIcon = config?.icon || Calendar;
                      return (
                        <div key={idx} className="px-4 py-3 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config?.color || "bg-slate-100"}`}>
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">
                              {new Date(record.date + "T00:00:00").toLocaleDateString("es-PE", { 
                                weekday: "long", 
                                day: "numeric", 
                                month: "long" 
                              })}
                            </p>
                            {record.notes && (
                              <p className="text-sm text-slate-500">{record.notes}</p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm ${config?.color || "bg-slate-100"}`}>
                            {config?.label || record.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {attendance.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CalendarCheck className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-slate-700 mb-2">Sin registros este mes</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto">
                    Cuando se registre tu asistencia, la verás aquí
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
