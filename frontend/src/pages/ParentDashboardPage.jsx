import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import HeroCarousel from "../components/HeroCarousel";
import MiniCalendar from "../components/MiniCalendar";
import {
  BookOpen,
  ClipboardList,
  Bell,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Loader2,
  GraduationCap,
  Users,
  CalendarCheck,
  CheckCircle,
  Eye,
  User,
  UserCheck,
  Wallet,
  AlertTriangle,
  CircleDollarSign,
  TrendingUp,
  Receipt
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const PRIORITY_COLORS = {
  normal: "bg-blue-100 text-blue-700",
  important: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700"
};

function StudentProfileCard({ student, dashboardData, academic }) {
  const userName = student?.name || "Alumno";
  const userLastName = student?.last_name || "";
  const fullName = userLastName ? `${userName} ${userLastName}` : userName;
  const userPhoto = student?.photo_url;
  
  const gradeName = academic?.grado?.nombre || academic?.grado?.name || "";
  const sectionName = academic?.seccion?.nombre || academic?.seccion?.name || "";
  const levelName = academic?.nivel?.nombre || academic?.nivel?.name || "";
  const academicInfo = [gradeName, sectionName].filter(Boolean).join(" – ");
  
  const coursesCount = dashboardData?.courses_count || dashboardData?.stats?.courses_count || 0;
  const classmates = dashboardData?.stats?.section_students_count || 0;
  const pendingTasks = dashboardData?.upcoming_tasks?.length || dashboardData?.stats?.pending_tasks || 0;
  
  const attendance = dashboardData?.attendance_summary;
  let attendancePercent = "N/A";
  if (attendance) {
    const total = (attendance.present || 0) + (attendance.absent || 0) + (attendance.late || 0) + (attendance.justified || 0);
    if (total > 0) {
      const attended = (attendance.present || 0) + (attendance.justified || 0);
      attendancePercent = `${Math.round((attended / total) * 100)}%`;
    }
  }

  const getInitials = (name) => {
    if (!name) return "A";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center" data-testid="child-profile-card">
      <div className="relative w-20 h-20 mx-auto mb-3">
        {userPhoto ? (
          <img src={userPhoto} alt={fullName} className="w-20 h-20 rounded-full object-cover ring-4 ring-emerald-100" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center ring-4 ring-emerald-100">
            <span className="text-2xl font-bold text-white">{getInitials(fullName)}</span>
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-white">
          <GraduationCap className="w-4 h-4 text-white" />
        </div>
      </div>
      
      <div className="mb-2 flex justify-center">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-emerald-100 text-emerald-700 border-emerald-200">
          <GraduationCap className="w-3 h-3" />
          ALUMNO
        </span>
      </div>
      
      <h3 className="font-bold text-slate-800 text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>{fullName}</h3>
      {academicInfo && <p className="text-sm text-slate-600 mt-1 font-medium">{academicInfo}</p>}
      {levelName && <p className="text-xs text-slate-400 mt-0.5">{levelName}</p>}
      
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{coursesCount}</p>
          <p className="text-[11px] text-slate-500">Cursos</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{classmates}</p>
          <p className="text-[11px] text-slate-500">Compañeros</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{pendingTasks}</p>
          <p className="text-[11px] text-slate-500">Pendientes</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{attendancePercent}</p>
          <p className="text-[11px] text-slate-500">Asistencia</p>
        </div>
      </div>
    </div>
  );
}

export default function ParentDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("inicio");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [parentProfile, setParentProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [paymentData, setPaymentData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [banners, setBanners] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  
  const [coursesPage, setCoursesPage] = useState(1);
  const [tasksPage, setTasksPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0).toISOString().split('T')[0];

        const [profileRes, settingsRes, bannersRes, calendarRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API}/api/dashboard/banners/active`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/calendar/events?start_date=${startDate}&end_date=${endDate}`, { headers }).catch(() => ({ data: [] }))
        ]);
        
        setParentProfile(profileRes.data);
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (settingsRes.data) setSettings(settingsRes.data);
        setBanners(bannersRes.data || []);
        setCalendarEvents(calendarRes.data || []);
        
        if (childrenList.length > 0) {
          const savedChildId = localStorage.getItem('selected_child_id');
          const childToSelect = childrenList.find(c => c.id === savedChildId) || childrenList[0];
          setSelectedChild(childToSelect);
          await loadChildDashboard(childToSelect.id);
        }
      } catch (err) {
        console.error("Error loading parent data:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [token]);

  const loadChildDashboard = async (childId) => {
    try {
      const [dashboardRes, coursesRes, paymentsRes] = await Promise.all([
        axios.get(`${API}/api/parent/dashboard?student_id=${childId}`, { headers }),
        axios.get(`${API}/api/parent/courses?student_id=${childId}`, { headers }),
        axios.get(`${API}/api/parent/payments?student_id=${childId}`, { headers }).catch(() => ({ data: null }))
      ]);
      setDashboardData(dashboardRes.data);
      setCourses(coursesRes.data.courses || []);
      setPaymentData(paymentsRes.data);
      setCoursesPage(1);
      setTasksPage(1);
    } catch (err) {
      console.error("Error loading child dashboard:", err);
    }
  };

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    setLoading(true);
    localStorage.setItem('selected_child_id', newChild.id);
    await loadChildDashboard(newChild.id);
    setLoading(false);
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  const navigateTo = (path) => {
    if (subdomain) navigate(`/school/${subdomain}${path}`);
    else navigate(path);
  };

  if (!loading && children.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ParentSidebar active={activeSection} onNavigate={setActiveSection} expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName}
          subdomain={subdomain} user={user} children={[]} selectedChild={null} onSelectChild={() => {}} />
        <div className="flex-1 flex flex-col lg:ml-16">
          <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout}
            logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain} token={token}
            roleLabel="Padre/Apoderado" profilePath="/parent/profile" />
          <main className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-12 h-12 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Sin estudiantes vinculados</h2>
              <p className="text-slate-500">No tienes estudiantes vinculados a tu cuenta. Contacta al administrador del colegio para vincular a tu hijo/a.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando portal de padres...</p>
        </div>
      </div>
    );
  }

  const academic = dashboardData?.academic || {};
  const studentInfo = dashboardData?.student || selectedChild || {};

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ParentSidebar
        active={activeSection}
        onNavigate={setActiveSection}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={parentProfile || user}
        children={children}
        selectedChild={selectedChild}
        onSelectChild={handleChildChange}
      />

      {sidebarExpanded && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
          roleLabel="Padre/Apoderado"
          profilePath="/parent/profile"
        />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Read-only info banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3" data-testid="parent-dashboard-banner">
            <Eye className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700">
              Estás viendo la información de <span className="font-semibold">{studentInfo.name} {studentInfo.last_name}</span>
            </p>
            {children.length > 1 && (
              <div className="ml-auto flex items-center gap-2 bg-white/60 rounded-lg px-3 py-1">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-emerald-700 font-medium">{children.length} hijos vinculados</span>
              </div>
            )}
          </div>

          {/* Quick Stats Cards - Student Dashboard Design */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div 
              onClick={() => navigateTo("/parent/courses")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)',
                boxShadow: '0 10px 40px -10px rgba(15, 23, 42, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              }}
              data-testid="stat-card-courses"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-600/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 opacity-80" />
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/20 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-lg">
                    <BookOpen className="w-5 h-5 text-cyan-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300 tracking-wide">Mis Cursos</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.courses_count || dashboardData?.stats?.courses_count || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigateTo("/parent/tasks")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                boxShadow: '0 10px 40px -10px rgba(37, 99, 235, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
              data-testid="stat-card-tasks"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-[100px]" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-sky-300 via-blue-200 to-indigo-300 opacity-60" />
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-blue-100 tracking-wide">Tareas Pendientes</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.upcoming_tasks?.length || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-blue-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigateTo("/parent/attendance")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                boxShadow: '0 10px 40px -10px rgba(5, 150, 105, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
              data-testid="stat-card-attendance"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-4 right-4 w-16 h-16 border-4 border-white/10 rounded-full" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-300 via-green-200 to-teal-300 opacity-60" />
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <CalendarCheck className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-emerald-100 tracking-wide">Asistencias</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.attendance_summary?.present || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-emerald-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            <div 
              onClick={() => navigateTo("/parent/messages")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
                boxShadow: '0 10px 40px -10px rgba(217, 119, 6, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
              data-testid="stat-card-messages"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute top-4 right-4 w-3 h-3 bg-white/40 rounded-full animate-pulse" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-300 opacity-60" />
              <div className="relative flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-amber-100 tracking-wide">Mensajes</span>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {dashboardData?.unread_messages || 0}
                  </p>
                  <ChevronRight className="w-5 h-5 text-amber-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </div>


          {/* Financial Status Section */}
          {paymentData && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6" data-testid="financial-status">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    paymentData.summary.overall_status === 'moroso' 
                      ? 'bg-red-100' 
                      : paymentData.summary.overall_status === 'pendiente' 
                        ? 'bg-amber-100' 
                        : 'bg-emerald-100'
                  }`}>
                    <Wallet className={`w-5 h-5 ${
                      paymentData.summary.overall_status === 'moroso' 
                        ? 'text-red-600' 
                        : paymentData.summary.overall_status === 'pendiente' 
                          ? 'text-amber-600' 
                          : 'text-emerald-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Estado Financiero</h3>
                    <p className="text-xs text-slate-500">Pensiones mensuales {new Date().getFullYear()}</p>
                  </div>
                </div>
                
                {paymentData.summary.overall_status === 'moroso' && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 animate-pulse" data-testid="morosidad-alert">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-bold text-red-700">MOROSIDAD DETECTADA</span>
                  </div>
                )}
                {paymentData.summary.overall_status === 'al_dia' && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700">AL DÍA</span>
                  </div>
                )}
              </div>

              {/* Multi-color Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Progreso de pagos: {paymentData.summary.paid_percentage}%
                  </span>
                  <span className="text-sm text-slate-500">
                    {paymentData.summary.paid_count} de {paymentData.summary.total_months} meses
                  </span>
                </div>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                  {paymentData.summary.paid_count > 0 && (
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-700"
                      style={{ width: `${(paymentData.summary.paid_count / paymentData.summary.total_months) * 100}%` }}
                      title={`${paymentData.summary.paid_count} pagados`}
                    />
                  )}
                  {paymentData.summary.pending_count > 0 && (
                    <div 
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
                      style={{ width: `${(paymentData.summary.pending_count / paymentData.summary.total_months) * 100}%` }}
                      title={`${paymentData.summary.pending_count} pendientes`}
                    />
                  )}
                  {paymentData.summary.overdue_count > 0 && (
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-700"
                      style={{ width: `${(paymentData.summary.overdue_count / paymentData.summary.total_months) * 100}%` }}
                      title={`${paymentData.summary.overdue_count} morosos`}
                    />
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-600">{paymentData.summary.paid_count} pagados</span>
                  </div>
                  {paymentData.summary.pending_count > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-xs text-slate-600">{paymentData.summary.pending_count} pendientes</span>
                    </div>
                  )}
                  {paymentData.summary.overdue_count > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-xs text-red-600 font-semibold">{paymentData.summary.overdue_count} morosos</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                  <CircleDollarSign className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-emerald-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    S/ {paymentData.summary.paid_amount.toLocaleString('es-PE')}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium">Total Pagado</p>
                </div>
                <div className={`rounded-xl p-3 text-center border ${
                  paymentData.summary.debt_amount > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
                }`}>
                  <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${paymentData.summary.debt_amount > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                  <p className={`text-lg font-bold ${paymentData.summary.debt_amount > 0 ? 'text-red-700' : 'text-slate-400'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                    S/ {paymentData.summary.debt_amount.toLocaleString('es-PE')}
                  </p>
                  <p className={`text-[10px] font-medium ${paymentData.summary.debt_amount > 0 ? 'text-red-600' : 'text-slate-400'}`}>Deuda Total</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <TrendingUp className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-blue-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    S/ {paymentData.summary.total_amount.toLocaleString('es-PE')}
                  </p>
                  <p className="text-[10px] text-blue-600 font-medium">Total Anual</p>
                </div>
                <div className={`rounded-xl p-3 text-center border ${
                  paymentData.matricula.paid ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
                }`}>
                  <Receipt className={`w-5 h-5 mx-auto mb-1 ${paymentData.matricula.paid ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <p className={`text-lg font-bold ${paymentData.matricula.paid ? 'text-emerald-700' : 'text-amber-700'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {paymentData.matricula.paid ? 'Pagada' : 'Pendiente'}
                  </p>
                  <p className={`text-[10px] font-medium ${paymentData.matricula.paid ? 'text-emerald-600' : 'text-amber-600'}`}>Matrícula</p>
                </div>
              </div>

              {/* Link to full payments detail */}
              <button 
                onClick={() => navigateTo("/parent/payments")}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
                data-testid="view-payments-detail"
              >
                <Receipt className="w-4 h-4" />
                Ver detalle de pagos
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <HeroCarousel banners={banners} user={studentInfo} schoolName={schoolName} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Courses */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-cyan-500" />
                      Cursos
                      <span className="text-xs font-normal text-slate-400 ml-1">({courses.length})</span>
                    </h2>
                    <button onClick={() => navigateTo("/parent/courses")}
                      className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1">
                      Ver todos <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 flex-1">
                    {courses.length > 0 ? (
                      courses.slice((coursesPage - 1) * ITEMS_PER_PAGE, coursesPage * ITEMS_PER_PAGE).map((course) => (
                        <div key={course.id} onClick={() => navigateTo(`/parent/course/${course.id}`)}
                          className="px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: course.color || "#6366f1" }}>
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 truncate text-sm">{course.name}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {course.teacher?.name ? `${course.teacher.name} ${course.teacher.last_name || ""}` : course.teacher_name || "Sin profesor"}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p className="text-sm">No hay cursos asignados</p>
                      </div>
                    )}
                  </div>
                  {courses.length > ITEMS_PER_PAGE && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="text-xs text-slate-500">
                        {(coursesPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(coursesPage * ITEMS_PER_PAGE, courses.length)} de {courses.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCoursesPage(p => Math.max(1, p - 1))} disabled={coursesPage === 1}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        {Array.from({ length: Math.ceil(courses.length / ITEMS_PER_PAGE) }, (_, i) => (
                          <button key={i + 1} onClick={() => setCoursesPage(i + 1)}
                            className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                              coursesPage === i + 1 ? "bg-cyan-500 text-white" : "text-slate-600 hover:bg-slate-200"
                            }`}>{i + 1}</button>
                        ))}
                        <button onClick={() => setCoursesPage(p => Math.min(Math.ceil(courses.length / ITEMS_PER_PAGE), p + 1))}
                          disabled={coursesPage === Math.ceil(courses.length / ITEMS_PER_PAGE)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tasks */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-amber-500" />
                      Tareas Próximas
                      <span className="text-xs font-normal text-slate-400 ml-1">({dashboardData?.upcoming_tasks?.length || 0})</span>
                    </h2>
                    <button onClick={() => navigateTo("/parent/tasks")}
                      className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1">
                      Ver todas <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 flex-1">
                    {dashboardData?.upcoming_tasks?.length > 0 ? (
                      dashboardData.upcoming_tasks.slice((tasksPage - 1) * ITEMS_PER_PAGE, tasksPage * ITEMS_PER_PAGE).map((task) => {
                        const dueDate = task.due_date || task.metadata?.due_date;
                        return (
                          <div key={task.id} onClick={() => navigateTo(`/parent/course/${task.subject_id}`)}
                            className="px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: task.subject_color || "#f59e0b" }}>
                              <ClipboardList className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 truncate text-sm">{task.title}</p>
                              <p className="text-xs text-slate-500 truncate">{task.subject_name}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-medium text-slate-600">
                                {dueDate && !isNaN(new Date(dueDate).getTime())
                                  ? new Date(dueDate).toLocaleDateString("es-PE", { day: "numeric", month: "short" })
                                  : "Sin fecha"}
                              </p>
                              <p className="text-[10px] text-slate-400">Fecha límite</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                        <p className="font-medium text-slate-700">Sin tareas pendientes</p>
                        <p className="text-xs text-slate-400 mt-1">El alumno está al día</p>
                      </div>
                    )}
                  </div>
                  {(dashboardData?.upcoming_tasks?.length || 0) > ITEMS_PER_PAGE && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="text-xs text-slate-500">
                        {(tasksPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(tasksPage * ITEMS_PER_PAGE, dashboardData.upcoming_tasks.length)} de {dashboardData.upcoming_tasks.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setTasksPage(p => Math.max(1, p - 1))} disabled={tasksPage === 1}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        {Array.from({ length: Math.ceil(dashboardData.upcoming_tasks.length / ITEMS_PER_PAGE) }, (_, i) => (
                          <button key={i + 1} onClick={() => setTasksPage(i + 1)}
                            className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                              tasksPage === i + 1 ? "bg-amber-500 text-white" : "text-slate-600 hover:bg-slate-200"
                            }`}>{i + 1}</button>
                        ))}
                        <button onClick={() => setTasksPage(p => Math.min(Math.ceil(dashboardData.upcoming_tasks.length / ITEMS_PER_PAGE), p + 1))}
                          disabled={tasksPage === Math.ceil(dashboardData.upcoming_tasks.length / ITEMS_PER_PAGE)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Circular Progress Charts - Tasks & Attendance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200" data-testid="progress-tasks">
                  <div className="flex items-center gap-2 mb-4">
                    <ClipboardList className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold text-slate-800">Progreso de Tareas</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="relative w-28 h-28 flex-shrink-0">
                      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                        <circle
                          cx="60" cy="60" r="52" fill="none"
                          strokeWidth="10"
                          strokeLinecap="round"
                          stroke={
                            !dashboardData?.task_progress?.total_tasks ? "#e2e8f0" :
                            dashboardData?.task_progress?.percentage >= 80 ? "#10b981" :
                            dashboardData?.task_progress?.percentage >= 50 ? "#f59e0b" : "#ef4444"
                          }
                          strokeDasharray={`${2 * Math.PI * 52}`}
                          strokeDashoffset={`${2 * Math.PI * 52 * (1 - (dashboardData?.task_progress?.percentage || 0) / 100)}`}
                          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-2xl font-bold ${
                          !dashboardData?.task_progress?.total_tasks ? "text-slate-400" :
                          dashboardData?.task_progress?.percentage >= 80 ? "text-emerald-600" :
                          dashboardData?.task_progress?.percentage >= 50 ? "text-amber-600" : "text-red-600"
                        }`}>
                          {dashboardData?.task_progress?.total_tasks ? `${dashboardData.task_progress.percentage}%` : "\u2014"}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        {dashboardData?.task_progress?.total_tasks
                          ? `${dashboardData.task_progress.tasks_submitted} de ${dashboardData.task_progress.total_tasks}`
                          : "0 de 0"}
                      </p>
                      <p className="text-xs text-slate-500">tareas entregadas</p>
                      {dashboardData?.task_progress?.total_tasks > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            dashboardData?.task_progress?.percentage >= 80 ? "bg-emerald-500" :
                            dashboardData?.task_progress?.percentage >= 50 ? "bg-amber-500" : "bg-red-500"
                          }`} />
                          <span className="text-[11px] text-slate-500">
                            {dashboardData?.task_progress?.percentage >= 80 ? "Excelente progreso" :
                             dashboardData?.task_progress?.percentage >= 50 ? "Progreso regular" : "Necesita mejorar"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200" data-testid="progress-attendance">
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarCheck className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold text-slate-800">Asistencia</span>
                  </div>
                  {(() => {
                    const s = dashboardData?.attendance_summary;
                    const total = s ? (s.present || 0) + (s.absent || 0) + (s.late || 0) + (s.justified || 0) : 0;
                    const attended = s ? (s.present || 0) + (s.justified || 0) : 0;
                    const pct = total > 0 ? Math.round(attended / total * 100) : 0;
                    return (
                      <div className="flex items-center gap-6">
                        <div className="relative w-28 h-28 flex-shrink-0">
                          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                            <circle
                              cx="60" cy="60" r="52" fill="none"
                              strokeWidth="10"
                              strokeLinecap="round"
                              stroke={total === 0 ? "#e2e8f0" : pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"}
                              strokeDasharray={`${2 * Math.PI * 52}`}
                              strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
                              style={{ transition: 'stroke-dashoffset 0.7s ease' }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-2xl font-bold ${
                              total === 0 ? "text-slate-400" : pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
                            }`}>
                              {total > 0 ? `${pct}%` : "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 mb-1">
                            {attended} de {total}
                          </p>
                          <p className="text-xs text-slate-500">días registrados</p>
                          {total > 0 && (
                            <div className="mt-3 space-y-1.5">
                              {s.present > 0 && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span className="text-[11px] text-slate-500">{s.present} presentes</span>
                                </div>
                              )}
                              {s.late > 0 && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                                  <span className="text-[11px] text-slate-500">{s.late} tardanzas</span>
                                </div>
                              )}
                              {s.absent > 0 && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-red-500" />
                                  <span className="text-[11px] text-slate-500">{s.absent} faltas</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="lg:col-span-4 space-y-6">
              <StudentProfileCard student={studentInfo} dashboardData={dashboardData} academic={academic} />
              <MiniCalendar events={calendarEvents} />
            </div>
          </div>
        </main>
      </div>

      <MessageCenter token={token} user={user} />
    </div>
  );
}
