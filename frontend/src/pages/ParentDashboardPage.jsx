import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import MobileBottomNav from "../components/MobileBottomNav";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import HeroCarousel from "../components/HeroCarousel";
import MiniCalendar from "../components/MiniCalendar";
import BroadcastPopup from "../components/BroadcastPopup";
import HealthAlertPopup from "../components/HealthAlertPopup";
import AttendanceToast from "../components/AttendanceToast";
import {
  BookOpen,
  ClipboardList,
  Bell,
  Calendar,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  GraduationCap,
  Users,
  CalendarCheck,
  CheckCircle,
  Eye,
  User,
  UserCheck,
  UserPlus,
  Wallet,
  AlertTriangle,
  CircleDollarSign,
  TrendingUp,
  Receipt,
  QrCode,
  Clock,
  XCircle
} from "lucide-react";
import YapePaymentModal from "../components/YapePaymentModal";

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
  const [enrollmentEnabled, setEnrollmentEnabled] = useState(false);
  
  const [parentProfile, setParentProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [paymentData, setPaymentData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [banners, setBanners] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [yapeConfig, setYapeConfig] = useState(null);
  const [yapeSchedule, setYapeSchedule] = useState([]);
  const [yapeModalPayment, setYapeModalPayment] = useState(null);
  
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

        const [profileRes, settingsRes, bannersRes, calendarRes, enrollConfigRes, yapeConfigRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API}/api/dashboard/banners/active`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/calendar/events?start_date=${startDate}&end_date=${endDate}`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/school/enrollment-config`, { headers }).catch(() => ({ data: {} })),
          axios.get(`${API}/api/parent-payments/yape-config`, { headers }).catch(() => ({ data: { enabled: false } })),
        ]);
        
        setParentProfile(profileRes.data);
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (settingsRes.data) setSettings(settingsRes.data);
        setBanners(bannersRes.data || []);
        setCalendarEvents(calendarRes.data || []);
        setEnrollmentEnabled(enrollConfigRes.data?.parent_self_enrollment_enabled || false);
        if (yapeConfigRes.data) setYapeConfig(yapeConfigRes.data);
        
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
      const [dashboardRes, coursesRes, paymentsRes, yapeScheduleRes] = await Promise.all([
        axios.get(`${API}/api/parent/dashboard?student_id=${childId}`, { headers }),
        axios.get(`${API}/api/parent/courses?student_id=${childId}`, { headers }),
        axios.get(`${API}/api/parent/payments?student_id=${childId}`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/api/parent-payments/schedule/${childId}`, { headers }).catch(() => ({ data: { schedule: [] } })),
      ]);
      setDashboardData(dashboardRes.data);
      setCourses(coursesRes.data.courses || []);
      setPaymentData(paymentsRes.data);
      setYapeSchedule(yapeScheduleRes.data?.schedule || []);
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
    if (subdomain) navigate(`/${subdomain}${path}`);
    else navigate(path);
  };

  if (!loading && children.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <ParentSidebar active={activeSection} onNavigate={setActiveSection} expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName}
          subdomain={subdomain} user={user} children={[]} selectedChild={null} onSelectChild={() => {}} />
        <div className="flex-1 flex flex-col min-w-0">
          <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout}
            logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain} token={token}
            roleLabel="Padre/Apoderado" profilePath="/parent/profile" />
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="w-12 h-12 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">Bienvenido al Portal de Padres</h2>
              <p className="text-slate-500 mb-8">{enrollmentEnabled ? "Registra a tu hijo/a para iniciar el proceso de matricula. El colegio revisara los datos y te notificara cuando sea aprobada." : "No tienes estudiantes vinculados a tu cuenta. Contacta al administrador del colegio para vincular a tu hijo/a."}</p>
              {enrollmentEnabled && (
              <button
                onClick={() => navigateTo("/parent/registrar-alumno")}
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-base transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-3"
                data-testid="register-child-btn"
              >
                <UserPlus className="w-6 h-6" />
                Registrar a mi hijo
              </button>
              )}
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

        <HealthAlertPopup
          token={token}
          selectedChildId={selectedChild?.id}
          childName={selectedChild ? `${selectedChild.name} ${selectedChild.last_name || ""}`.trim() : ""}
        />
        <BroadcastPopup token={token} />
        <AttendanceToast />

        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {/* Read-only info banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3 flex-wrap" data-testid="parent-dashboard-banner">
            <Eye className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700">
              Estás viendo la información de <span className="font-semibold">{studentInfo.name} {studentInfo.last_name}</span>
            </p>
            {enrollmentEnabled && (
            <button
              onClick={() => navigateTo("/parent/registrar-alumno")}
              className="ml-auto text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5"
              data-testid="register-another-child-btn"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Registrar otro hijo
            </button>
            )}
            {children.length > 1 && (
              <div className="ml-auto relative group">
                <button className="flex items-center gap-2 bg-white/80 hover:bg-white rounded-lg px-3 py-1.5 border border-emerald-200 transition-colors cursor-pointer" data-testid="child-switcher-btn">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-700 font-medium">Cambiar hijo</span>
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-[200] min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                  {children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => handleChildChange(child)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                        selectedChild?.id === child.id
                          ? "bg-emerald-50 text-emerald-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                      data-testid={`child-option-${child.id}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        selectedChild?.id === child.id ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {(child.name || "A")[0]}
                      </div>
                      <span className="flex-1">{child.name} {child.last_name || ""}</span>
                      {child.enrollment_status === "pending" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">Pendiente</span>
                      )}
                      {child.enrollment_status === "rejected" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">No aprobado</span>
                      )}
                      {selectedChild?.id === child.id && <CheckCircle className="w-3.5 h-3.5 ml-auto text-emerald-500" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Enrollment status banner */}
          {selectedChild?.enrollment_status === "pending" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-3" data-testid="enrollment-pending-banner">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Matricula pendiente de aprobacion</p>
                <p className="text-xs text-amber-600">El colegio esta revisando la solicitud de matricula. Te notificaremos cuando sea aprobada.</p>
              </div>
            </div>
          )}
          {selectedChild?.enrollment_status === "rejected" && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-3" data-testid="enrollment-rejected-banner">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Matricula no aprobada</p>
                {selectedChild.enrollment_rejection_reason && (
                  <p className="text-xs text-red-600 mt-1">Motivo: {selectedChild.enrollment_rejection_reason}</p>
                )}
              </div>
            </div>
          )}

          {/* Mobile-only: Student Profile at top */}
          <div className="lg:hidden mb-4" data-testid="mobile-student-profile">
            <div className="flex items-center gap-2 px-1 mb-2">
              <User className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alumno seleccionado</span>
            </div>
            <StudentProfileCard student={studentInfo} dashboardData={dashboardData} academic={academic} />
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
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <CalendarCheck className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-emerald-100 tracking-wide">Asistencia Hoy</span>
                </div>
                {(() => {
                  const today = dashboardData?.today_attendance;
                  const status = (today?.status || "").toLowerCase();
                  if (!today?.status) {
                    return (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-white/70">Sin registro</p>
                          <p className="text-xs text-emerald-200 mt-0.5">Aún no se registra hoy</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-emerald-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                      </div>
                    );
                  }
                  const statusLabels = {
                    "presente": "Presente", "present": "Presente", "p": "Presente",
                    "tardanza": "Tardanza", "late": "Tardanza", "t": "Tardanza",
                    "ausente": "Ausente", "absent": "Ausente", "a": "Ausente",
                    "justificado": "Justificado", "justified": "Justificado", "j": "Justificado"
                  };
                  const statusColors = {
                    "presente": "bg-white/30", "present": "bg-white/30", "p": "bg-white/30",
                    "tardanza": "bg-amber-400/40", "late": "bg-amber-400/40", "t": "bg-amber-400/40",
                    "ausente": "bg-red-400/40", "absent": "bg-red-400/40", "a": "bg-red-400/40",
                    "justificado": "bg-blue-400/40", "justified": "bg-blue-400/40", "j": "bg-blue-400/40"
                  };
                  return (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${statusColors[status] || "bg-white/20"}`}>
                            {statusLabels[status] || today.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-emerald-100">
                          {today.entry_time && (
                            <span>Entrada: <strong className="text-white">{today.entry_time}</strong></span>
                          )}
                          {today.exit_time && (
                            <span>Salida: <strong className="text-white">{today.exit_time}</strong></span>
                          )}
                          {!today.exit_time && today.entry_time && (
                            <span className="text-emerald-200/70">Sin salida</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-emerald-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>
                  );
                })()}
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


          {/* Financial Status + Yape Card + Student Profile */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-4 items-start" data-testid="financial-profile-section">
            {/* Left Column: Financial + Yape */}
            <div className={`${paymentData ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
              <div className={`grid gap-5 ${yapeConfig?.enabled ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {paymentData ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-5" data-testid="financial-status">
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
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                      <CircleDollarSign className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-emerald-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        S/ {((paymentData.summary.paid_amount || 0) + (paymentData.matricula?.paid ? (paymentData.matricula?.amount || 0) : 0)).toLocaleString('es-PE')}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-medium">Total Pagado</p>
                    </div>
                    <div className={`rounded-xl p-3 text-center border ${
                      paymentData.summary.debt_amount > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${paymentData.summary.debt_amount > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                      <p className={`text-lg font-bold ${paymentData.summary.debt_amount > 0 ? 'text-red-700' : 'text-slate-400'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                        S/ {(paymentData.summary.debt_amount || 0).toLocaleString('es-PE')}
                      </p>
                      <p className={`text-[10px] font-medium ${paymentData.summary.debt_amount > 0 ? 'text-red-600' : 'text-slate-400'}`}>Deuda Total</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                      <TrendingUp className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-blue-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        S/ {(paymentData.summary.total_annual || paymentData.summary.total_amount || 0).toLocaleString('es-PE')}
                      </p>
                      <p className="text-[10px] text-blue-600 font-medium">Total Anual</p>
                    </div>
                    <div className={`rounded-xl p-3 text-center border ${
                      paymentData.matricula.paid ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
                    }`}>
                      <Receipt className={`w-5 h-5 mx-auto mb-1 ${paymentData.matricula.paid ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <p className={`text-lg font-bold ${paymentData.matricula.paid ? 'text-emerald-700' : 'text-amber-700'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {paymentData.matricula.paid ? `S/ ${(paymentData.matricula.amount || 0).toLocaleString('es-PE')}` : 'Pendiente'}
                      </p>
                      <p className={`text-[10px] font-medium ${paymentData.matricula.paid ? 'text-emerald-600' : 'text-amber-600'}`}>Matrícula {paymentData.matricula.paid ? '- Pagada' : ''}</p>
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
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 h-full flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sin información financiera disponible</p>
                  </div>
                </div>
              )}

              {/* Yape Payment Card - only when enabled */}
              {yapeConfig?.enabled && (() => {
                const pendingItems = yapeSchedule.filter(s =>
                  (s.status === 'pending' || s.status === 'overdue') && s.yape_status !== 'pendiente_verificacion'
                );
                const verifyingItems = yapeSchedule.filter(s => s.yape_status === 'pendiente_verificacion');
                const nextCuota = pendingItems[0] || verifyingItems[0] || null;
                const isVerifying = nextCuota?.yape_status === 'pendiente_verificacion';
                const isOverdue = nextCuota?.status === 'overdue';
                const allPaid = !nextCuota && yapeSchedule.length > 0;
                const monthNames = {1:"Enero",2:"Febrero",3:"Marzo",4:"Abril",5:"Mayo",6:"Junio",7:"Julio",8:"Agosto",9:"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre"};

                return (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col" data-testid="yape-dashboard-card">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                          <QrCode className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">Pagar con Yape</h3>
                          <p className="text-xs text-slate-500">Proxima cuota del alumno</p>
                        </div>
                      </div>
                      {nextCuota && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                          isVerifying ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          isOverdue ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {isVerifying ? 'EN VERIFICACION' : isOverdue ? 'VENCIDO' : 'PENDIENTE'}
                        </span>
                      )}
                      {allPaid && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200">AL DIA</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {paymentData && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-600">Progreso: {paymentData.summary.paid_percentage}%</span>
                          <span className="text-xs text-slate-500">{paymentData.summary.paid_count}/{paymentData.summary.total_months} meses</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                          {paymentData.summary.paid_count > 0 && (
                            <div className="h-full bg-purple-500 transition-all duration-700"
                              style={{ width: `${(paymentData.summary.paid_count / paymentData.summary.total_months) * 100}%` }} />
                          )}
                          {paymentData.summary.pending_count > 0 && (
                            <div className="h-full bg-purple-200 transition-all duration-700"
                              style={{ width: `${(paymentData.summary.pending_count / paymentData.summary.total_months) * 100}%` }} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Next cuota info */}
                    {allPaid ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                        <CheckCircle className="w-10 h-10 text-emerald-500 mb-2" />
                        <p className="font-bold text-emerald-700 text-sm">Estas al dia con tus pagos</p>
                        <p className="text-xs text-slate-500 mt-1">Todas las cuotas estan pagadas</p>
                      </div>
                    ) : nextCuota ? (
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-base mb-1">
                          {nextCuota.description || nextCuota.concept || `Pension ${monthNames[nextCuota.month] || ''} ${nextCuota.year || ''}`}
                        </p>
                        {nextCuota.payment_date && (
                          <p className={`text-xs mb-3 ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                            {isOverdue ? (
                              <>Vencido hace {Math.ceil((Date.now() - new Date(nextCuota.payment_date).getTime()) / 86400000)} dias</>
                            ) : (
                              <>Vence: {new Date(nextCuota.payment_date).toLocaleDateString('es-PE', {day:'numeric',month:'long',year:'numeric'})}</>
                            )}
                          </p>
                        )}

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 text-center mb-4 border border-purple-100">
                          <p className="text-2xl font-black text-purple-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            S/ {(nextCuota.amount || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-purple-500 font-medium mt-0.5">Monto de la pension</p>
                        </div>

                        {isVerifying ? (
                          <div className="w-full py-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                            <span className="text-sm font-semibold text-blue-700 flex items-center justify-center gap-2">
                              <Clock className="w-4 h-4" /> Pago en verificacion
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              let m = nextCuota.month;
                              let y = nextCuota.year;
                              if (!m && nextCuota.payment_date) {
                                m = parseInt(nextCuota.payment_date.split("-")[1]);
                                y = parseInt(nextCuota.payment_date.split("-")[0]);
                              }
                              setYapeModalPayment({
                                ...nextCuota,
                                student_id: selectedChild?.id,
                                student_name: `${selectedChild?.name || ''} ${selectedChild?.last_name || ''}`.trim(),
                                month: m,
                                year: y,
                                month_name: nextCuota.description || nextCuota.concept,
                              });
                            }}
                            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-md"
                            data-testid="yape-dashboard-pay-btn"
                          >
                            <QrCode className="w-4 h-4" />
                            Pagar con Yape
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center py-4 text-center text-slate-400">
                        <p className="text-sm">Sin cuotas registradas</p>
                      </div>
                    )}
                  </div>
                );
              })()}
              </div>
            </div>

            {/* Right Column: Student Profile (30%) - desktop only */}
            <div className="hidden lg:block lg:col-span-4" data-testid="profile-column">
              <div className="space-y-3 h-full flex flex-col">
                <div className="flex items-center gap-2 px-1">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alumno seleccionado</span>
                </div>
                <div className="flex-1">
                  <StudentProfileCard student={studentInfo} dashboardData={dashboardData} academic={academic} />
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 space-y-4">
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
                        <div key={course.id} onClick={() => navigateTo(`/parent/courses/${course.id}`)}
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
                          <div key={task.id} onClick={() => navigateTo(`/parent/courses/${task.subject_id}?task=${task.id}`)}
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

            </div>

            {/* Right column */}
            <div className="lg:col-span-4 space-y-4">
              <MiniCalendar events={calendarEvents} />

              {/* Circular Progress Charts - Tasks & Attendance */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200" data-testid="progress-tasks">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardList className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-slate-800 text-sm">Progreso de Tareas</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                      <circle
                        cx="60" cy="60" r="52" fill="none"
                        strokeWidth="12"
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
                      <span className={`text-lg font-bold ${
                        !dashboardData?.task_progress?.total_tasks ? "text-slate-400" :
                        dashboardData?.task_progress?.percentage >= 80 ? "text-emerald-600" :
                        dashboardData?.task_progress?.percentage >= 50 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {dashboardData?.task_progress?.total_tasks ? `${dashboardData.task_progress.percentage}%` : "\u2014"}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">
                      {dashboardData?.task_progress?.total_tasks
                        ? `${dashboardData.task_progress.tasks_submitted} de ${dashboardData.task_progress.total_tasks}`
                        : "0 de 0"}
                    </p>
                    <p className="text-xs text-slate-500">tareas entregadas</p>
                    {dashboardData?.task_progress?.total_tasks > 0 && (
                      <div className="mt-2 flex items-center gap-1.5">
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

              <div className="bg-white rounded-2xl p-4 border border-slate-200" data-testid="progress-attendance">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarCheck className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-slate-800 text-sm">Asistencia</span>
                </div>
                {(() => {
                  const s = dashboardData?.attendance_summary;
                  const total = s ? (s.present || 0) + (s.absent || 0) + (s.late || 0) + (s.justified || 0) : 0;
                  const attended = s ? (s.present || 0) + (s.justified || 0) : 0;
                  const pct = total > 0 ? Math.round(attended / total * 100) : 0;
                  return (
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                          <circle
                            cx="60" cy="60" r="52" fill="none"
                            strokeWidth="12"
                            strokeLinecap="round"
                            stroke={total === 0 ? "#e2e8f0" : pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"}
                            strokeDasharray={`${2 * Math.PI * 52}`}
                            strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
                            style={{ transition: 'stroke-dashoffset 0.7s ease' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-lg font-bold ${
                            total === 0 ? "text-slate-400" : pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
                          }`}>
                            {total > 0 ? `${pct}%` : "N/A"}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700">
                          {attended} de {total}
                        </p>
                        <p className="text-xs text-slate-500">días registrados</p>
                        {total > 0 && (
                          <div className="mt-2 space-y-1">
                            {s.present > 0 && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-[11px] text-slate-500">{s.present} presentes</span>
                              </div>
                            )}
                            {s.late > 0 && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="text-[11px] text-slate-500">{s.late} tardanzas</span>
                              </div>
                            )}
                            {s.absent > 0 && (
                              <div className="flex items-center gap-1.5">
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
        </main>
      </div>

      <MessageCenter token={token} user={user} />
      <MobileBottomNav role="parent" />
      <YapePaymentModal
        isOpen={!!yapeModalPayment}
        onClose={() => setYapeModalPayment(null)}
        payment={yapeModalPayment}
        yapeConfig={yapeConfig}
        token={token}
        onSuccess={() => {
          if (selectedChild) loadChildDashboard(selectedChild.id);
        }}
      />
    </div>
  );
}
