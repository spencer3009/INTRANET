import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  CalendarCheck, Loader2, CheckCircle, XCircle, Clock, FileText,
  Calendar, ChevronLeft, ChevronRight, TrendingUp, BarChart3, PieChart
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  present: { label: "Asistio", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle, chartColor: "#10B981" },
  absent: { label: "Falto", color: "bg-red-100 text-red-700", icon: XCircle, chartColor: "#EF4444" },
  late: { label: "Tardanza", color: "bg-amber-100 text-amber-700", icon: Clock, chartColor: "#F59E0B" },
  justified: { label: "Justificado", color: "bg-blue-100 text-blue-700", icon: FileText, chartColor: "#3B82F6" }
};

export default function ParentAttendancePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [settings, setSettings] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadAttendanceForChild = useCallback(async (childId, month) => {
    setLoading(true);
    try {
      const year = month.getFullYear();
      const m = month.getMonth();
      const startDate = new Date(year, m, 1).toISOString().split('T')[0];
      const endDate = new Date(year, m + 1, 0).toISOString().split('T')[0];
      const res = await axios.get(`${API}/api/parent/attendance?student_id=${childId}&start_date=${startDate}&end_date=${endDate}`, { headers });
      setAttendance(res.data.records || []);
    } catch (err) {
      console.error("Error:", err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

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
          localStorage.setItem('selected_child_id', child.id);
          await loadAttendanceForChild(child.id, selectedMonth);
        } else { setLoading(false); }
      } catch (err) { console.error("Error:", err); setLoading(false); }
    };
    init();
  }, [token]);

  useEffect(() => {
    if (selectedChild) loadAttendanceForChild(selectedChild.id, selectedMonth);
  }, [selectedMonth]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    localStorage.setItem('selected_child_id', newChild.id);
    await loadAttendanceForChild(newChild.id, selectedMonth);
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  const prevMonth = () => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  const nextMonth = () => {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
    if (next <= new Date()) setSelectedMonth(next);
  };

  const stats = useMemo(() => {
    const s = { present: 0, absent: 0, late: 0, justified: 0, total: attendance.length };
    attendance.forEach(a => { if (s[a.status] !== undefined) s[a.status]++; });
    return s;
  }, [attendance]);
  const attendancePercent = stats.total > 0 ? Math.round(((stats.present + stats.justified) / stats.total) * 100) : 0;

  const generateCalendarDays = useCallback(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: null, status: null });
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = attendance.find(a => a.date === dateStr);
      days.push({ day, date: dateStr, status: record?.status || null, isWeekend: [0, 6].includes(new Date(year, month, day).getDay()) });
    }
    return days;
  }, [selectedMonth, attendance]);

  const calendarDays = generateCalendarDays();

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="parent-attendance-page">
      <ParentSidebar active="asistencia" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange} />
      {sidebarExpanded && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} roleLabel="Padre/Apoderado" profilePath="/parent/profile" />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <CalendarCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>
                Asistencia de {selectedChild?.name || ""}
              </h1>
            </div>
          </div>

          {/* Month Nav */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
              <h2 className="text-lg font-semibold text-slate-800 capitalize">{selectedMonth.toLocaleDateString("es-PE", { month: "long", year: "numeric" })}</h2>
              <button onClick={nextMonth} disabled={selectedMonth.getMonth() === new Date().getMonth() && selectedMonth.getFullYear() === new Date().getFullYear()} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white col-span-2 lg:col-span-1">
                  <p className="text-white/80 text-sm">Asistencia</p>
                  <p className="text-3xl font-bold">{attendancePercent}%</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-emerald-600 mb-1"><CheckCircle className="w-4 h-4" /><span className="text-sm font-medium">Asistencias</span></div>
                  <p className="text-2xl font-bold text-slate-800">{stats.present}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-1"><Clock className="w-4 h-4" /><span className="text-sm font-medium">Tardanzas</span></div>
                  <p className="text-2xl font-bold text-slate-800">{stats.late}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-red-600 mb-1"><XCircle className="w-4 h-4" /><span className="text-sm font-medium">Faltas</span></div>
                  <p className="text-2xl font-bold text-slate-800">{stats.absent}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-blue-600 mb-1"><FileText className="w-4 h-4" /><span className="text-sm font-medium">Justificadas</span></div>
                  <p className="text-2xl font-bold text-slate-800">{stats.justified}</p>
                </div>
              </div>

              {/* Calendar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-emerald-500" />Calendario de Asistencia</h3>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, idx) => (
                    <div key={idx} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm ${
                      cell.day === null ? "" :
                      cell.status ? (STATUS_CONFIG[cell.status]?.color || "bg-slate-100") :
                      cell.isWeekend ? "bg-slate-50 text-slate-400" : "bg-slate-50 text-slate-600"
                    }`} title={cell.status ? STATUS_CONFIG[cell.status]?.label : ""}>
                      {cell.day && (
                        <>
                          <span className="font-medium">{cell.day}</span>
                          {cell.status && (
                            <span className="mt-0.5">
                              {cell.status === "present" && <CheckCircle className="w-3 h-3" />}
                              {cell.status === "absent" && <XCircle className="w-3 h-3" />}
                              {cell.status === "late" && <Clock className="w-3 h-3" />}
                              {cell.status === "justified" && <FileText className="w-3 h-3" />}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-2 text-sm"><span className={`w-4 h-4 rounded ${config.color}`} /><span className="text-slate-600">{config.label}</span></div>
                  ))}
                </div>
              </div>

              {/* Detail List */}
              {attendance.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <h3 className="font-semibold text-slate-800 px-4 py-3 border-b border-slate-100 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-emerald-500" />Detalle del Mes</h3>
                  <div className="divide-y divide-slate-100">
                    {attendance.map((record, idx) => {
                      const config = STATUS_CONFIG[record.status];
                      const StatusIcon = config?.icon || Calendar;
                      const entryTime = record.entry_time ? (() => { try { return new Date(record.entry_time).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }); } catch { return record.check_in_time || null; } })() : (record.check_in_time || null);
                      const exitTime = record.exit_time ? (() => { try { return new Date(record.exit_time).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }); } catch { return null; } })() : null;
                      return (
                        <div key={idx} className="px-4 py-3 flex items-center gap-4" data-testid={`attendance-record-${record.date}`}>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config?.color || "bg-slate-100"}`}>
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800">{new Date(record.date + "T00:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</p>
                            {record.notes && <p className="text-sm text-slate-500">{record.notes}</p>}
                          </div>
                          {/* Entry/Exit times */}
                          <div className="flex items-center gap-3 text-sm" data-testid={`attendance-times-${record.date}`}>
                            {entryTime && (
                              <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg font-medium">
                                Entrada {entryTime}
                              </span>
                            )}
                            {exitTime && (
                              <span className="text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg font-medium">
                                Salida {exitTime}
                              </span>
                            )}
                            {record.total_minutes != null && (
                              <span className="text-slate-400 text-xs">
                                {Math.floor(record.total_minutes / 60)}h {record.total_minutes % 60}m
                              </span>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm flex-shrink-0 ${config?.color || "bg-slate-100"}`}>{config?.label || record.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {attendance.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><CalendarCheck className="w-8 h-8 text-emerald-400" /></div>
                  <h3 className="font-semibold text-slate-700 mb-2">Sin registros este mes</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto">Cuando se registre la asistencia, la veras aqui</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <MessageCenter token={token} user={user} />
    </div>
  );
}
