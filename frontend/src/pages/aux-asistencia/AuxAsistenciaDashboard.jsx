import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import DashboardHeader from "../../components/DashboardHeader";
import { QrCode, ClipboardList, Loader2, RefreshCw, Users, GraduationCap, Clock, UserCheck, UserX, AlertCircle, ClipboardCheck, FileText, UserCog } from "lucide-react";
import MobileBottomNav from "../../components/MobileBottomNav";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS_STUDENT = {
  present: "#10b981",
  late: "#f59e0b",
  absent: "#ef4444",
  justified: "#6366f1",
};

const COLORS_TEACHER = {
  present: "#0ea5e9",
  late: "#f97316",
  absent: "#e11d48",
  justified: "#8b5cf6",
};

const STATUS_LABELS = {
  present: "Presente",
  late: "Tardanza",
  absent: "Ausente",
  justified: "Justificado",
};

function SummaryCard({ icon: Icon, label, value, color, bgColor, testId }) {
  return (
    <div className={`${bgColor} rounded-xl p-4 flex items-center gap-3 border border-white/40`} data-testid={testId}>
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function PieSummary({ data, title, colors, testId }) {
  const pieData = Object.entries(data)
    .filter(([k]) => k !== "total")
    .map(([key, val]) => ({ name: STATUS_LABELS[key], value: val, key }))
    .filter(d => d.value > 0);

  if (pieData.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={testId}>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Sin datos hoy</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={testId}>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 mb-3">Total: {data.total}</p>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
            {pieData.map((entry) => (
              <Cell key={entry.key} fill={colors[entry.key]} />
            ))}
          </Pie>
          <Tooltip formatter={(val) => [val, ""]} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.fill }}></span>
          <span className="text-slate-600">{STATUS_LABELS[p.dataKey]}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

export default function AuxAsistenciaDashboard({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [stats, setStats] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;
  const basePath = subdomain ? `/${subdomain}` : "";

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await axios.get(`${API}/school/info`, { headers });
        setSettings(res.data);
      } catch {}
    };
    loadSettings();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [scansRes, statsRes] = await Promise.all([
        axios.get(`${API}/attendance/my-scans-today`, { headers }),
        axios.get(`${API}/attendance/aux-dashboard-stats`, { headers }),
      ]);
      setScanCount(scansRes.data.total || 0);
      setStats(statsRes.data);
    } catch {
      setScanCount(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const cards = [
    {
      title: "Escanear Asistencia",
      description: "Registra la asistencia de alumnos y profesores con QR",
      icon: QrCode,
      color: "from-sky-500 to-blue-600",
      borderColor: "border-sky-200",
      iconBg: "bg-sky-100",
      iconColor: "text-sky-600",
      onClick: () => navigate(`${basePath}/aux-asistencia/escanear`),
      testId: "card-escanear",
    },
    {
      title: "Asistencia Manual Alumnos",
      description: "Marcar asistencia de estudiantes por grado y seccion",
      icon: GraduationCap,
      color: "from-indigo-500 to-violet-600",
      borderColor: "border-indigo-200",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      onClick: () => navigate(`${basePath}/aux-asistencia/asistencias?tab=students`),
      testId: "card-asistencia-alumnos",
    },
    {
      title: "Asistencia Manual Profesores",
      description: "Marcar asistencia de docentes del dia",
      icon: UserCog,
      color: "from-purple-500 to-fuchsia-600",
      borderColor: "border-purple-200",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      onClick: () => navigate(`${basePath}/aux-asistencia/asistencias?tab=teachers`),
      testId: "card-asistencia-profesores",
    },
    {
      title: "Reportes",
      description: "Reportes de asistencia por grado, seccion y fechas",
      icon: FileText,
      color: "from-amber-500 to-orange-600",
      borderColor: "border-amber-200",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      onClick: () => navigate(`${basePath}/aux-asistencia/asistencias?tab=reports`),
      testId: "card-reportes",
    },
    {
      title: "Mis Asistencias de Hoy",
      description: "Ver las asistencias que registraste hoy",
      icon: ClipboardList,
      color: "from-emerald-500 to-teal-600",
      borderColor: "border-emerald-200",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      onClick: () => navigate(`${basePath}/aux-asistencia/mis-escaneos`),
      badge: scanCount > 0 ? `${scanCount} registradas hoy` : null,
      testId: "card-mis-escaneos",
    },
  ];

  const todayStudents = stats?.today_summary?.students || {};
  const todayTeachers = stats?.today_summary?.teachers || {};

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="aux-asistencia-dashboard">
      <Sidebar
        active="aux-inicio"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name}
        subdomain={subdomain}
        token={token}
        user={user}
      />

      <div className="flex-1 min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.school_name}
          subdomain={subdomain}
          token={token}
        />

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
          </div>
        ) : (
          <main className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Welcome header */}
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-6 sm:p-8 text-white" data-testid="aux-welcome">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
                Bienvenido, {user?.name}
              </h1>
              <p className="text-sky-100 capitalize">{today}</p>
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {cards.map((card) => (
                <button
                  key={card.testId}
                  onClick={card.onClick}
                  data-testid={card.testId}
                  className={`group relative bg-white rounded-2xl border ${card.borderColor} p-6 sm:p-8 text-left hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
                >
                  <div className={`w-14 h-14 rounded-xl ${card.iconBg} flex items-center justify-center mb-5`}>
                    <card.icon className={`w-7 h-7 ${card.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                    {card.title}
                  </h3>
                  <p className="text-slate-500 text-sm">{card.description}</p>
                  {card.badge && (
                    <span className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {card.badge}
                    </span>
                  )}
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} opacity-5 rounded-bl-[80px] rounded-tr-2xl`}></div>
                </button>
              ))}
            </div>

            {/* Today Summary */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>
                Resumen de Hoy
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard icon={UserCheck} label="Alumnos presentes" value={todayStudents.present || 0} color="bg-emerald-500" bgColor="bg-emerald-50" testId="stat-student-present" />
                <SummaryCard icon={Clock} label="Alumnos tardanza" value={todayStudents.late || 0} color="bg-amber-500" bgColor="bg-amber-50" testId="stat-student-late" />
                <SummaryCard icon={UserCheck} label="Profesores presentes" value={todayTeachers.present || 0} color="bg-sky-500" bgColor="bg-sky-50" testId="stat-teacher-present" />
                <SummaryCard icon={Clock} label="Profesores tardanza" value={todayTeachers.late || 0} color="bg-orange-500" bgColor="bg-orange-50" testId="stat-teacher-late" />
              </div>
            </div>

            {/* Pie Charts - Today */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PieSummary data={todayStudents} title="Alumnos - Distribucion de Hoy" colors={COLORS_STUDENT} testId="pie-students-today" />
              <PieSummary data={todayTeachers} title="Profesores - Distribucion de Hoy" colors={COLORS_TEACHER} testId="pie-teachers-today" />
            </div>

            {/* Student Attendance Chart */}
            {stats?.student_daily && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6" data-testid="chart-students">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>
                      Asistencia de Alumnos
                    </h3>
                    <p className="text-xs text-slate-400">Ultimos 14 dias</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.student_daily} barGap={1} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} formatter={(val) => STATUS_LABELS[val]} />
                    <Bar dataKey="present" stackId="a" fill={COLORS_STUDENT.present} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="late" stackId="a" fill={COLORS_STUDENT.late} />
                    <Bar dataKey="absent" stackId="a" fill={COLORS_STUDENT.absent} />
                    <Bar dataKey="justified" stackId="a" fill={COLORS_STUDENT.justified} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Teacher Attendance Chart */}
            {stats?.teacher_daily && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6" data-testid="chart-teachers">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>
                      Asistencia de Profesores
                    </h3>
                    <p className="text-xs text-slate-400">Ultimos 14 dias</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.teacher_daily} barGap={1} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} formatter={(val) => STATUS_LABELS[val]} />
                    <Bar dataKey="present" stackId="a" fill={COLORS_TEACHER.present} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="late" stackId="a" fill={COLORS_TEACHER.late} />
                    <Bar dataKey="absent" stackId="a" fill={COLORS_TEACHER.absent} />
                    <Bar dataKey="justified" stackId="a" fill={COLORS_TEACHER.justified} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Quick refresh */}
            <div className="flex justify-center pb-20 lg:pb-4">
              <button
                onClick={loadData}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-sky-600 transition-colors"
                data-testid="btn-refresh-dashboard"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar datos
              </button>
            </div>
          </main>
        )}
      </div>
      <MobileBottomNav role="auxiliar_asistencia" />
    </div>
  );
}
