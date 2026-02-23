import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  CalendarCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  present: { label: "Presente", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  absent: { label: "Ausente", color: "bg-red-100 text-red-700", icon: XCircle },
  late: { label: "Tardanza", color: "bg-amber-100 text-amber-700", icon: Clock },
  justified: { label: "Justificado", color: "bg-blue-100 text-blue-700", icon: AlertCircle },
  presente: { label: "Presente", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  ausente: { label: "Ausente", color: "bg-red-100 text-red-700", icon: XCircle },
  tardanza: { label: "Tardanza", color: "bg-amber-100 text-amber-700", icon: Clock },
  justificado: { label: "Justificado", color: "bg-blue-100 text-blue-700", icon: AlertCircle },
};

export default function ParentAttendancePage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("asistencia");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({});
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [settings, setSettings] = useState(null);
  
  // Month filter
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadParentProfile();
  }, [token]);

  useEffect(() => {
    if (selectedChild) {
      loadAttendance(selectedChild.id);
      localStorage.setItem('selected_child_id', selectedChild.id);
    }
  }, [selectedChild, selectedMonth]);

  const loadParentProfile = async () => {
    try {
      const [profileRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/parent/me`, { headers }),
        axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
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

  const loadAttendance = async (studentId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/parent/attendance?student_id=${studentId}&month=${selectedMonth}`, { headers });
      setRecords(res.data.records || []);
      setStats(res.data.stats || {});
      setAttendanceRate(res.data.attendance_rate || 0);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  // Navigate months
  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  };

  if (loading && !selectedChild) {
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

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
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
          <div className="bg-gradient-to-r from-cyan-500 to-teal-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <CalendarCheck className="w-8 h-8 inline-block mr-2 -mt-1" />
                  Asistencia de {selectedChild?.name}
                </h1>
                <p className="text-cyan-100">
                  Registro de asistencia escolar
                </p>
              </div>
              <div className="bg-white/20 rounded-xl px-6 py-3 text-center">
                <p className="text-3xl font-bold">{attendanceRate}%</p>
                <p className="text-xs text-cyan-100">Tasa de Asistencia</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.present || 0}</p>
              <p className="text-xs text-slate-500">Presente</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.absent || 0}</p>
              <p className="text-xs text-slate-500">Ausente</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats.late || 0}</p>
              <p className="text-xs text-slate-500">Tardanza</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.justified || 0}</p>
              <p className="text-xs text-slate-500">Justificado</p>
            </div>
          </div>

          {/* Month Navigator */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="text-center">
                <p className="font-semibold text-slate-800 capitalize">{formatMonth(selectedMonth)}</p>
                <p className="text-xs text-slate-500">{stats.total || 0} registros</p>
              </div>
              <button
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Attendance Records */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Registro de Asistencia</h3>
            </div>
            
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
              </div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500">Sin registros de asistencia para este mes</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {records.map((record, idx) => {
                  const statusKey = record.status?.toLowerCase();
                  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.present;
                  const Icon = config.icon;
                  const date = record.date ? new Date(record.date + 'T00:00:00') : null;
                  
                  return (
                    <div key={record.id || idx} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-14 text-center">
                          {date && (
                            <>
                              <p className="text-2xl font-bold text-slate-800">{date.getDate()}</p>
                              <p className="text-xs text-slate-500 capitalize">
                                {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                              </p>
                            </>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                            <Icon className="w-4 h-4" />
                            {config.label}
                          </div>
                          {record.check_in_time && (
                            <p className="text-xs text-slate-500 mt-1">
                              Hora de ingreso: {record.check_in_time}
                            </p>
                          )}
                        </div>
                        
                        {date && (
                          <p className="text-sm text-slate-400">
                            {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <MessageCenter token={token} user={user} />
    </div>
  );
}
